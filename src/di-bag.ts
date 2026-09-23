import { libraryError, libraryTypeError } from './errors';
import { LifecycleObservers } from './observers';
import type { LifecycleObserver } from './observers';
import { contributionEntry } from './contributions';
import type { BuilderWithCollectionContribution } from './contribution-types';
import type { BuilderBuildModule, BuilderWithInstalledModules, BuilderWithReplacedService, BuilderWithServiceAlias, BuilderWithServices, BuilderWithTokenService } from './builder-method-types';
import { aliasEntry } from './aliases';
import { optional, lazy } from './dependency-references';
import { normalize, snapshotAdd, withDisposal } from './registration';
import { snapshotOptionsBag } from './options-bag';
import type { Registration, Registrations } from './registration';
import { BindingGraph, BagRuntime } from './runtime';
import { moduleGraph, sealModule } from './module';
import type { CompositionReport } from './composition-report';
import type { CheckedConstraints, CompleteConstraints, NeedConstraint } from './module-types';
import type { CheckedLifetimes, WithoutExportObligations } from './lifetime-types';
import { withLifetime } from './lifetime';
import { createProvider, fromFactory, fromSyncFactory, fromAsyncFactory } from './acquisition-context';
import { closeRuntime, ensureRuntimeReady } from './startup';
import { selectChildContainer, selectIndependentContainer } from './scope-selection';
import type { CreateChildContainerOptions, CreateIndependentContainerOptions, DisjointChildContainerSelection, UnsharedAliases, ScopedAliases } from './scope-types';
import type { CheckedChildContainerLifetimes } from './lifetime-types';
import type { CloseOptions, EnsureServicesReadyOptions } from './startup';
import { withMetadata, transformService, withTokenBinding } from './provider';
import { createProviderFromFunction, createProviderFromClass, fromFunction, fromClass } from './composition';
import { runtimeContext, unconfigured } from './acquisition-mode';
import type { RuntimeContext, RuntimeOptions } from './acquisition-mode';
import type { ProviderRegistrationMetadata, ProviderAcquisitionMetadata } from './provider';
import type { GraphSnapshot, RegistrationSnapshot } from './inspection';
import { createToken, token, readSingleServiceKey, readToken, wrongTokenKind } from './tokens';
import { createProviderFromPlugin, fromPlugin } from './plugins';
import type { CreateProviderFromPlugin, PluginProviderFactory } from './plugins';
import type { CollectionItem, CollectionTokenBase, TokenBase, TokenKind } from './tokens';
import type { CollectionTokenMember, SingleServiceTokenMember, SelectionKey } from './token-types';
import type {
  CheckDependencyCompatibility,
  CheckDependencyCompleteness,
  Entry,
  OverrideFactoryContext,
  RegistrationsFromEntries,
  OverrideRegistrations,
  Overrides,
  ReboundSelection,
  ServicesOf,
  ReplacementOutput,
  SelectedRegistrations,
  Selection,
} from './types';

// A public member under an unexported symbol retains its type in .d.ts output;
// TypeScript strips the types of ordinary private fields during declaration emit.
declare const constraintInvariant: unique symbol;

function readGraphToken(
  graph: BindingGraph,
  value: unknown,
  operation: string,
): Readonly<{ key: symbol; kind: TokenKind }> {
  const token = readToken(value);
  graph.assertTokenKind(token.key, token.kind, operation);
  return token;
}

function positionalChildOptions(args: readonly unknown[]): unknown {
  if (args.length === 0) return undefined;
  if (args.length === 1) {
    return args[0] === undefined
      ? undefined
      : snapshotOptionsBag(args[0], 'createChildContainer', [], ['sharedParentServiceKeys']);
  }
  if (args.length !== 2 && args.length !== 3) {
    throw libraryError('DI_BAG_INVALID_ARGUMENT', 'createChildContainer accepts zero, one, two, or three arguments', {
      operation: 'createChildContainer', argument: 'arguments.length', expected: "one of: '0', '1', '2', '3'",
    });
  }
  const sharing = args.length === 3 && args[2] !== undefined
    ? snapshotOptionsBag(args[2], 'createChildContainer', [], ['sharedParentServiceKeys'])
    : Object.create(null) as Record<string, unknown>;
  const options: Record<string, unknown> = {
    replacedServiceKeys: args[0],
    replacementProviders: args[1],
  };
  if (Object.hasOwn(sharing, 'sharedParentServiceKeys')) {
    options.sharedParentServiceKeys = sharing.sharedParentServiceKeys;
  }
  return options;
}

function positionalIndependentOptions(args: readonly unknown[]): unknown {
  if (args.length === 0) return undefined;
  if (args.length === 1) {
    return args[0] === undefined
      ? undefined
      : snapshotOptionsBag(args[0], 'createIndependentContainer', [], []);
  }
  if (args.length !== 2) {
    throw libraryError('DI_BAG_INVALID_ARGUMENT', 'createIndependentContainer accepts zero arguments, undefined, an empty options object, or selected keys and replacement providers', {
      operation: 'createIndependentContainer', argument: 'arguments.length', expected: "one of: '0', '1', '2'",
    });
  }
  return { replacedServiceKeys: args[0], replacementProviders: args[1] };
}

/**
 * A resolving container with lazy acquisition, caching, and independent resource ownership.
 *
 * Create containers through {@link DiBagApi.createBuilder} followed by {@link Builder.buildContainer}, and make services
 * ready ahead of use with {@link Container.ensureServicesReady}; the class is exported as a type and has no public constructor.
 * @typeParam ServiceRegistrations - The map from each public service name or token symbol to its registration.
 * @typeParam Constraints - The requirements, contributions and lifetime obligations that installed modules retain on this graph.
 * @see https://dany-fedorov.github.io/di-bag/agent/api-card.html#container
 */
class Container<ServiceRegistrations extends Registrations, Constraints extends NeedConstraint = never> {
  /** @internal */
  declare readonly [constraintInvariant]: (value: Constraints) => Constraints;
  readonly #graph: BindingGraph;
  readonly #runtime: BagRuntime;

  private readonly context: RuntimeContext;

  constructor(graph: BindingGraph, context: RuntimeContext, runtime?: BagRuntime) {
    this.#graph = graph;
    this.#runtime = runtime ?? new BagRuntime(graph, context);
    // Derived containers reuse the classifier the runtime resolved, so detection runs once per build.
    this.context = this.#runtime.context;
  }

  /**
   * Resolve a registered service, acquiring it lazily when needed.
   * Scoped and root services are cached according to their lifetime; transient services
   * create a new acquisition for each call. Promise-valued services keep their identity.
   * An async factory's service is its Promise; nothing is awaited for you.
   * @param token - An existing public string name or typed token.
   * @returns The service exposed by the selected registration.
   * @throws `DI_BAG_CLOSING` or `DI_BAG_CLOSED` after `close()`; `DI_BAG_INVALID_TOKEN`, `DI_BAG_WRONG_TOKEN_KIND`, or `DI_BAG_MISSING_REGISTRATION` for a bad selection;
   * during acquisition `DI_BAG_MISSING_DEPENDENCY`, `DI_BAG_CYCLE`, `DI_BAG_LIFETIME_DEPENDENCY`, `DI_BAG_INVALID_DEPENDENCY_ACCESS`,
   * `DI_BAG_STRUCTURAL_THENABLE`, `DI_BAG_INVALID_CLASSIFIER_RESULT`, `DI_BAG_INVALID_METADATA`, `DI_BAG_PLUGIN_VALIDATION`,
   * or the factory's own error.
   * @example
   * ```ts
   * const container = DiBag.createBuilder().withServices({ greeting: () => 'hello' }).buildContainer();
   * const greeting: string = container.resolve('greeting');
   * ```
   */
  resolve<K extends (keyof ServiceRegistrations & string) | TokenBase>(token: K & ([K] extends [string] ? unknown : SingleServiceTokenMember<ServiceRegistrations, K>)): ServicesOf<ServiceRegistrations>[SelectionKey<K> & keyof ServiceRegistrations];
  resolve(serviceKey: unknown): unknown {
    if (typeof serviceKey === 'string') {
      return this.#runtime.resolve(serviceKey);
    }
    const { key, kind } = readGraphToken(this.#graph, serviceKey, 'resolve');
    if (kind !== 'single-service') {
      throw wrongTokenKind('resolve', 'single-service', key);
    }
    return this.#runtime.resolve(key);
  }

  /**
   * Resolve every contribution for a collection token as a fresh frozen list.
   * @param token - The collection token to read.
   * @returns Contributions in declaration order, or an empty list.
   * @throws `DI_BAG_INVALID_TOKEN` or `DI_BAG_WRONG_TOKEN_KIND` for a bad handle or kind;
   * `DI_BAG_CLOSING` or `DI_BAG_CLOSED` after close begins; or a contribution's acquisition errors as listed for {@link Container.resolve}.
   * @example
   * ```ts
   * const toolsKey = Symbol('tools');
   * const tools = DiBag.token(toolsKey).forCollectionOf<string>();
   * const container = DiBag.createBuilder().buildContainer();
   * const names: readonly string[] = container.resolveCollection(tools);
   * ```
   */
  resolveCollection<T extends CollectionTokenBase>(token: T & CollectionTokenMember<Constraints, T>,
    ...invalid: [T] extends [never] ? [never] : []): readonly CollectionItem<T>[] {
    const { key, kind } = readGraphToken(
      this.#graph,
      token,
      'resolveCollection',
    );
    if (kind !== 'collection') {
      throw wrongTokenKind('resolveCollection', 'collection', key);
    }
    return this.#runtime.resolveCollection(key) as readonly CollectionItem<T>[];
  }

  /**
   * Inspect a service registration through any supported public key without resolving it.
   * @param serviceKey - The public service name or typed token to inspect.
   * @returns The service snapshot, or one snapshot per collection contribution.
   * @throws `DI_BAG_INVALID_TOKEN` or `DI_BAG_WRONG_TOKEN_KIND` for a bad handle or kind.
   * @example
   * ```ts
   * const container = DiBag.createBuilder().withServices({ greeting: () => 'hello' }).buildContainer();
   * const snapshot = container.serviceSnapshot('greeting');
   * await container.close();
   * ```
   */
  serviceSnapshot<ServiceKey extends (keyof ServiceRegistrations & string) | TokenBase>(
    serviceKey: ServiceKey & ([ServiceKey] extends [string] ? unknown : SingleServiceTokenMember<ServiceRegistrations, ServiceKey>),
    ...invalid: [ServiceKey] extends [never] ? [never] : []
  ): RegistrationSnapshot<
    ProviderRegistrationMetadata<ServiceRegistrations[SelectionKey<ServiceKey> & keyof ServiceRegistrations]>,
    ProviderAcquisitionMetadata<ServiceRegistrations[SelectionKey<ServiceKey> & keyof ServiceRegistrations]>
  >;
  /**
   * Inspect every contribution to a collection without resolving it.
   * @param collectionToken - The typed collection token to inspect.
   * @returns One service snapshot per collection contribution.
   * @throws `DI_BAG_INVALID_TOKEN` or `DI_BAG_WRONG_TOKEN_KIND` for a bad handle or kind.
   * @example
   * ```ts
   * const handlersKey = Symbol('handlers');
   * const handlers = DiBag.token(handlersKey).forCollectionOf<() => void>();
   * const container = DiBag.createBuilder()
   *   .withCollectionContribution({ collectionToken: handlers, provider: () => () => {} })
   *   .buildContainer();
   * const snapshots = container.serviceSnapshot(handlers);
   * await container.close();
   * ```
   */
  serviceSnapshot<CollectionToken extends CollectionTokenBase>(
    collectionToken: CollectionToken & CollectionTokenMember<Constraints, CollectionToken>,
    ...invalid: [CollectionToken] extends [never] ? [never] : []
  ): readonly RegistrationSnapshot<object, readonly unknown[]>[];
  serviceSnapshot<ServiceKey extends (keyof ServiceRegistrations & string) | TokenBase>(
    serviceKey: ServiceKey & (
      [ServiceKey] extends [string] ? unknown
        : [ServiceKey] extends [CollectionTokenBase] ? CollectionTokenMember<Constraints, ServiceKey>
          : SingleServiceTokenMember<ServiceRegistrations, ServiceKey>
    ),
    ...invalid: [ServiceKey] extends [never] ? [never] : []
  ): TokenBase extends ServiceKey
    ? RegistrationSnapshot<object, readonly unknown[]> | readonly RegistrationSnapshot<object, readonly unknown[]>[]
    : ServiceKey extends CollectionTokenBase
      ? readonly RegistrationSnapshot<object, readonly unknown[]>[]
      : RegistrationSnapshot<
        ProviderRegistrationMetadata<ServiceRegistrations[SelectionKey<ServiceKey> & keyof ServiceRegistrations]>,
        ProviderAcquisitionMetadata<ServiceRegistrations[SelectionKey<ServiceKey> & keyof ServiceRegistrations]>
      >;
  serviceSnapshot(serviceKey: unknown, ..._invalid: unknown[]): unknown {
    if (typeof serviceKey === 'string') return this.#runtime.inspect(serviceKey);
    const { key, kind } = readGraphToken(this.#graph, serviceKey, 'serviceSnapshot');
    return kind === 'collection'
      ? this.#runtime.inspectCollection(key)
      : this.#runtime.inspect(key);
  }

  /**
   * Describe every resolvable binding and the dependency edges observed so far.
   * @returns A frozen point-in-time graph snapshot without acquiring services.
   * @example
   * ```ts
   * const container = DiBag.createBuilder().withServices({ greeting: () => 'hello' }).buildContainer();
   * const labels = container.graphSnapshot().bindings.map(binding => binding.label);
   * await container.close();
   * ```
   */
  graphSnapshot(): GraphSnapshot { return this.#runtime.inspectGraph(); }

  /**
   * Create a tracked child container with fresh ownership for unshared services.
   * Share selected non-transient parent acquisitions through the optional options object. To replace services,
   * pass selected keys and providers first, then the sharing options.
   * @returns A child owned by this container; closing the parent closes the child first.
   * @throws `DI_BAG_INVALID_ARGUMENT` for malformed arguments; `DI_BAG_INVALID_SCOPE` for an invalid or transient shared service;
   * `DI_BAG_INVALID_OVERRIDE` for an invalid replacement selection; `DI_BAG_INVALID_TOKEN` or `DI_BAG_WRONG_TOKEN_KIND` for a bad token or kind.
   * @example
   * ```ts
   * const parent = DiBag.createBuilder().withServices({ config: () => ({ port: 3000 }) }).buildContainer();
   * const child = parent.createChildContainer({ sharedParentServiceKeys: ['config'] });
   * const config = child.resolve('config');
   * await child.close();
   * await parent.close();
   * ```
   */
  createChildContainer(
    options?: CreateChildContainerOptions<ServiceRegistrations, readonly [], Constraints>,
  ): Container<UnsharedAliases<ServiceRegistrations>, Constraints>;
  createChildContainer<const SharedParentServiceKeys extends readonly unknown[]>(
    options: CreateChildContainerOptions<ServiceRegistrations, SharedParentServiceKeys, Constraints>,
  ): Container<ScopedAliases<ServiceRegistrations, ServiceRegistrations, SharedParentServiceKeys>, Constraints>;
  createChildContainer<
    const ReplacedServiceKeys extends readonly unknown[],
    ReplacementProviders extends OverrideFactoryContext<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>,
    const SharedParentServiceKeys extends readonly unknown[] = readonly [],
  >(
    replacedServiceKeys: ReplacedServiceKeys & Selection<ServiceRegistrations, Constraints, ReplacedServiceKeys, 'createChildContainer'>,
    replacementProviders: ReplacementProviders & object & Record<SelectionKey<ReplacedServiceKeys[number]>, Registration> &
      Overrides<ServiceRegistrations, ReboundSelection<ServiceRegistrations, ReplacedServiceKeys, SelectedRegistrations<ReplacedServiceKeys, ReplacementProviders>>, ReplacedServiceKeys, 'createChildContainer'> &
      CheckDependencyCompatibility<OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, ReplacedServiceKeys, SelectedRegistrations<ReplacedServiceKeys, ReplacementProviders>>>> &
      CheckDependencyCompleteness<OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, ReplacedServiceKeys, SelectedRegistrations<ReplacedServiceKeys, ReplacementProviders>>>> &
      CheckedConstraints<Constraints, OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, ReplacedServiceKeys, SelectedRegistrations<ReplacedServiceKeys, ReplacementProviders>>>> &
      CompleteConstraints<Constraints, OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, ReplacedServiceKeys, SelectedRegistrations<ReplacedServiceKeys, ReplacementProviders>>>> &
      CheckedChildContainerLifetimes<NoInfer<ScopedAliases<OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, ReplacedServiceKeys, SelectedRegistrations<ReplacedServiceKeys, ReplacementProviders>>>, ServiceRegistrations, SharedParentServiceKeys>>, NoInfer<ReboundSelection<ServiceRegistrations, ReplacedServiceKeys, SelectedRegistrations<ReplacedServiceKeys, ReplacementProviders>>>, WithoutExportObligations<Constraints, SelectionKey<ReplacedServiceKeys[number]>>>,
    options?: Pick<CreateChildContainerOptions<ServiceRegistrations, SharedParentServiceKeys, Constraints>, 'sharedParentServiceKeys'>
      & DisjointChildContainerSelection<ReplacedServiceKeys, SharedParentServiceKeys>,
  ): Container<ScopedAliases<OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, ReplacedServiceKeys, SelectedRegistrations<ReplacedServiceKeys, ReplacementProviders>>>, ServiceRegistrations, SharedParentServiceKeys>, WithoutExportObligations<Constraints, SelectionKey<ReplacedServiceKeys[number]>>>;
  createChildContainer(...args: unknown[]): unknown {
    this.#runtime.assertOpen();
    const { graph, shared } = selectChildContainer(this.#graph, positionalChildOptions(args), serviceKey => this.#runtime.isTransient(serviceKey));
    return new Container(graph, this.context, this.#runtime.scope(graph, shared));
  }

  /**
   * Create an independent container with fresh instances and no replacements.
   * Pass no argument, `undefined`, or an empty options object.
   * @returns A container with independent acquisition and ownership state.
   * @throws `DI_BAG_INVALID_ARGUMENT` for malformed arguments.
   */
  createIndependentContainer(
    this: Container<ServiceRegistrations, Constraints> & CheckedLifetimes<UnsharedAliases<ServiceRegistrations>, Constraints>,
    options?: CreateIndependentContainerOptions<ServiceRegistrations, Constraints>,
  ): Container<UnsharedAliases<ServiceRegistrations>, Constraints>;
  /**
   * Create an independent container with fresh instances and checked replacements.
   * @returns A container with independent acquisition and ownership state.
   * @throws `DI_BAG_INVALID_ARGUMENT` for malformed arguments; `DI_BAG_INVALID_OVERRIDE` for an invalid replacement selection;
   * `DI_BAG_INVALID_REGISTRATION` for a malformed provider; `DI_BAG_INVALID_TOKEN` or `DI_BAG_WRONG_TOKEN_KIND` for a bad token or kind.
   * @example
   * ```ts
   * const parent = DiBag.createBuilder().withServices({ clock: () => Date.now() }).buildContainer();
   * const independent = parent.createIndependentContainer(['clock'], { clock: () => 0 });
   * const now = independent.resolve('clock');
   * await independent.close();
   * await parent.close();
   * ```
   */
  createIndependentContainer<
    const ReplacedServiceKeys extends readonly unknown[],
    ReplacementProviders extends OverrideFactoryContext<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>,
  >(
    replacedServiceKeys: ReplacedServiceKeys & Selection<ServiceRegistrations, Constraints, ReplacedServiceKeys, 'createIndependentContainer'>,
    replacementProviders: ReplacementProviders & object & Record<SelectionKey<ReplacedServiceKeys[number]>, Registration> &
      Overrides<ServiceRegistrations, ReboundSelection<ServiceRegistrations, ReplacedServiceKeys, SelectedRegistrations<ReplacedServiceKeys, ReplacementProviders>>, ReplacedServiceKeys, 'createIndependentContainer'> &
      CheckDependencyCompatibility<OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, ReplacedServiceKeys, SelectedRegistrations<ReplacedServiceKeys, ReplacementProviders>>>> &
      CheckDependencyCompleteness<OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, ReplacedServiceKeys, SelectedRegistrations<ReplacedServiceKeys, ReplacementProviders>>>> &
      CheckedConstraints<Constraints, OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, ReplacedServiceKeys, SelectedRegistrations<ReplacedServiceKeys, ReplacementProviders>>>> &
      CompleteConstraints<Constraints, OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, ReplacedServiceKeys, SelectedRegistrations<ReplacedServiceKeys, ReplacementProviders>>>> &
      CheckedLifetimes<UnsharedAliases<OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, ReplacedServiceKeys, SelectedRegistrations<ReplacedServiceKeys, ReplacementProviders>>>>, WithoutExportObligations<Constraints, SelectionKey<ReplacedServiceKeys[number]>>>,
  ): Container<UnsharedAliases<OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, ReplacedServiceKeys, SelectedRegistrations<ReplacedServiceKeys, ReplacementProviders>>>>, WithoutExportObligations<Constraints, SelectionKey<ReplacedServiceKeys[number]>>>;
  createIndependentContainer(...args: unknown[]): unknown {
    this.#runtime.assertOpen();
    const graph = selectIndependentContainer(this.#graph, positionalIndependentOptions(args));
    return new Container(graph, this.context);
  }

  /**
   * Make the listed services ready before continuing, then resolve to this same container.
   * Each listed service is acquired now, with whatever its factory reads, and the call waits until it is ready;
   * every other service stays lazy. List the services whose readiness you need before the next line runs, such as
   * a database pool or a cache client. Works on a built container, a child container, and an independent container, and may be called again.
   * A failed factory, an aborted signal, or an elapsed deadline closes this container: a child container closes only itself,
   * never its parent or a service it borrows.
   * @param serviceKeys - A finite tuple of existing names or typed tokens to wait for; an empty tuple is valid.
   * @param options - An optional abort signal, a deadline for the whole call, and a bound on how many listed keys are acquired at once.
   * @returns A promise for this container once every listed service is ready.
   * @throws {@link DiBagServiceReadinessError} (`DI_BAG_SERVICE_READINESS_FAILED`) after this container has closed because a factory failed;
   * {@link DiBagServiceReadinessCancelledError} (`DI_BAG_SERVICE_READINESS_CANCELLED`) promptly on abort or timeout, naming what was still pending;
   * `DI_BAG_INVALID_STARTUP` for malformed keys or options and `DI_BAG_INVALID_TOKEN` or `DI_BAG_WRONG_TOKEN_KIND` for a bad token or kind, all before any factory runs and with this container left open;
   * `DI_BAG_CLOSING` or `DI_BAG_CLOSED` after `close()`. Each arrives as a rejection.
   * @example
   * ```ts
   * const container = await DiBag.createBuilder()
   *   .withServices({ db: async () => ({ ping: () => true }) })
   *   .buildContainer()
   *   .ensureServicesReady(['db'], { totalTimeoutMs: 5_000 });
   * ```
   */
  async ensureServicesReady<const K extends readonly unknown[]>(
    serviceKeys: K & Selection<ServiceRegistrations, Constraints, K, 'ensureServicesReady'>,
    options?: EnsureServicesReadyOptions,
  ): Promise<this> {
    await ensureRuntimeReady(this.#runtime, this.#graph, serviceKeys, options);
    return this;
  }

  /**
   * Close this container, drain in-flight work, and dispose owned resources once.
   * Dependents are disposed before dependencies; remaining independent acquisitions use
   * reverse acquisition order. Without options the promise waits for cleanup however long it
   * takes, and repeated calls return the same promise. With `waitTimeoutMs` or `abortSignal`, cleanup
   * starts the same way but the returned promise stops waiting when either fires; child and
   * independent containers accept the same options. Close every derived container you create; a parent closes its live children, never independent containers.
   * @param options - An optional deadline and abort signal bounding the wait, not the cleanup.
   * @returns The shared shutdown promise, or a bounded wait on it when options are given.
   * @throws {@link DiBagCleanupError} (`DI_BAG_CLEANUP_FAILED`) when one or more disposers fail after all cleanup is attempted;
   * `DI_BAG_CLOSE_FAILED` for other shutdown failures;
   * {@link DiBagCloseCancelledError} (`DI_BAG_CLOSE_TIMEOUT` or `DI_BAG_CLOSE_ABORTED`) when the wait stops first,
   * naming unfinished disposers in `details.disposersStillRunning`; `DI_BAG_INVALID_CLOSE` for malformed options.
   * @example
   * ```ts
   * const container = DiBag.createBuilder().withServices({ value: () => 1 }).buildContainer();
   * await container.close({ waitTimeoutMs: 10_000, abortSignal: AbortSignal.timeout(15_000) });
   * ```
   */
  close(options?: CloseOptions): Promise<void> {
    return closeRuntime(this.#runtime, options);
  }
}

/**
 * An immutable, type-checked graph builder. Every operation returns a new builder.
 * Create one with {@link DiBagApi.createBuilder}. The same builder value can
 * {@link Builder.buildContainer} a container once its graph is complete, or
 * {@link Builder.buildModule} a reusable module whose unmet dependencies become
 * requirements the installing host must satisfy.
 * @typeParam Entries - The union of accepted registration entries, one per public key.
 * @typeParam Constraints - The requirements, contributions and lifetime obligations that installed modules retain on this graph.
 * @see https://dany-fedorov.github.io/di-bag/agent/api-card.html#builder
 */
class Builder<in out Entries extends Entry, in out Constraints extends NeedConstraint = never> {
  // Preserve accepted registration history and module constraints through views.
  /** @internal */
  declare readonly [constraintInvariant]:
    (value: readonly [Entries, Constraints]) => readonly [Entries, Constraints];
  readonly #graph: BindingGraph;

  constructor(graph: BindingGraph, private readonly context: RuntimeContext) {
    this.#graph = graph;
  }

  // Infer actual keys before checking context-sensitive method-returning factories.
  // Defer named admission until N is inferred, so trying this signature for a
  // malformed argument does not project the entire retained history.
  /**
   * Add new string-named services.
   * A factory declares its dependencies in the type of its one object parameter; destructure it or read `dependencies.name`, never spread it.
   * @param providersByName - A finite object whose own string keys are service names and whose values are providers or plain factories.
   * @returns A new builder containing snapshots of the supplied providers.
   * @throws `DI_BAG_INVALID_REGISTRATION` for a malformed object or value; `DI_BAG_DUPLICATE_REGISTRATION` for a name already registered;
   * `DI_BAG_WRONG_TOKEN_KIND` when a retained token use conflicts with this graph.
   * @example
   * ```ts
   * type Clock = { now(): number };
   * const builder = DiBag.createBuilder().withServices({ clock: (): Clock => ({ now: () => Date.now() }) }).withServices({ stamp: ({ clock }: { clock: Clock }) => clock.now() });
   * ```
   */
  readonly withServices: BuilderWithServices<Entries, Constraints> = this.#withServices as BuilderWithServices<Entries, Constraints>;
  #withServices(providersByName: unknown): unknown {
    const snapshot = snapshotAdd(providersByName, key => this.#graph.hasPublic(key));
    return new Builder(this.#graph.withPublicRegistrations(snapshot, 'withServices'), this.context);
  }

  /**
   * Add the single service of a typed token.
   * @param token - A new single-service token.
   * @param provider - A provider or plain factory whose exposed output satisfies the token's service type.
   * @returns A new builder retaining the provider's metadata, lifetime, dependencies, and ownership stages.
   * @throws `DI_BAG_INVALID_TOKEN` or `DI_BAG_WRONG_TOKEN_KIND` for a bad token or kind;
   * `DI_BAG_DUPLICATE_REGISTRATION` when the token already has a service; `DI_BAG_INVALID_REGISTRATION` for an invalid provider.
   * @example
   * ```ts
   * const clockKey = Symbol('clock');
   * const clock = DiBag.token(clockKey).of<{ now(): number }>();
   * const builder = DiBag.createBuilder().withTokenService(clock, () => ({ now: () => Date.now() }));
   * ```
   */
  readonly withTokenService: BuilderWithTokenService<Entries, Constraints> = this.#withTokenService as BuilderWithTokenService<Entries, Constraints>;
  #withTokenService(token: unknown, provider: unknown): unknown {
    const serviceKey = readSingleServiceKey(token, 'withTokenService');
    const graph = this.#graph.withTokenKind(serviceKey, 'single-service', 'withTokenService');
    if (graph.hasPublic(serviceKey)) throw libraryError('DI_BAG_DUPLICATE_REGISTRATION', `duplicate registration: ${String(serviceKey)}`, { operation: 'withTokenService', key: serviceKey });
    return new Builder(graph.withPublicBinding(serviceKey, withTokenBinding(token as never, provider as never, 'withTokenService'), 'withTokenService'), this.context) as never;
  }

  /**
   * Add another lookup name for an existing service.
   * @param options - `aliasKey` is a new string name or single-service token; `targetServiceKey` is the existing name or token whose canonical acquisition is reused.
   * @returns A new builder; aliases add no cache or ownership of their own.
   * @throws `DI_BAG_INVALID_ARGUMENT` for a malformed options object; `DI_BAG_INVALID_TOKEN` or `DI_BAG_WRONG_TOKEN_KIND` for a bad token or kind;
   * `DI_BAG_DUPLICATE_REGISTRATION` when the alias key exists; `DI_BAG_INVALID_ALIAS` for an absent named target.
   * @example
   * ```ts
   * const builder = DiBag.createBuilder().withServices({ clock: () => Date.now() }).withServiceAlias({ aliasKey: 'now', targetServiceKey: 'clock' });
   * ```
   */
  readonly withServiceAlias: BuilderWithServiceAlias<Entries, Constraints> = this.#withServiceAlias as BuilderWithServiceAlias<Entries, Constraints>;
  #withServiceAlias(options: unknown): unknown {
    const { aliasKey, targetServiceKey } = snapshotOptionsBag(options, 'withServiceAlias', ['aliasKey', 'targetServiceKey'], [], (name, value) => {
      if (name === 'aliasKey' && typeof value !== 'string') readSingleServiceKey(value, 'withServiceAlias');
    });
    let graph = this.#graph;
    for (const value of [aliasKey, targetServiceKey]) {
      if (typeof value === 'string') continue;
      const selected = readToken(value);
      graph = graph.withTokenKind(selected.key, selected.kind, 'withServiceAlias');
    }
    const [key, registration] = aliasEntry(aliasKey, targetServiceKey, candidate => graph.hasPublic(candidate));
    return new Builder(graph.withPublicBinding(key, registration, 'withServiceAlias'), this.context) as never;
  }

  /**
   * Append a provider to the list of a collection token.
   * @param options - `collectionToken` names the list; `provider` is a provider or plain factory whose output satisfies the token's item type.
   * @returns A new builder preserving contribution order.
   * @throws `DI_BAG_INVALID_ARGUMENT` for a malformed options object; `DI_BAG_INVALID_TOKEN` or `DI_BAG_WRONG_TOKEN_KIND` for a bad token or kind; `DI_BAG_INVALID_REGISTRATION` for an invalid provider.
   * @example
   * ```ts
   * const toolsKey = Symbol('tools');
   * const tools = DiBag.token(toolsKey).forCollectionOf<string>();
   * const builder = DiBag.createBuilder().withCollectionContribution({ collectionToken: tools, provider: () => 'search' }).withCollectionContribution({ collectionToken: tools, provider: () => 'fetch' });
   * ```
   */
  // A named callable keeps extracted generic methods nameable in consumer declarations.
  readonly withCollectionContribution: BuilderWithCollectionContribution<Entries, Constraints> = ((options: unknown) => {
    const { collectionToken, provider } = snapshotOptionsBag(options, 'withCollectionContribution', ['collectionToken', 'provider'], [], (name, value) => {
      if (name !== 'collectionToken') return;
      const { key, kind } = readToken(value);
      if (kind !== 'collection') throw wrongTokenKind('withCollectionContribution', 'collection', key);
    });
    const [key, value] = contributionEntry(collectionToken, provider as Registration);
    return new Builder(this.#graph.withContribution(key, value, 'withCollectionContribution'), this.context);
  }) as BuilderWithCollectionContribution<Entries, Constraints>;

  /**
   * Replace an existing binding with a compatible provider, selecting it by name, service token, collection token.
   * @param serviceKey - One existing string-literal service name or typed token.
   * @param provider - The replacement, checked against every surviving consumer.
   * @returns A new builder with the replacement.
   * @throws `DI_BAG_INVALID_REPLACEMENT` for an absent key; `DI_BAG_INVALID_REGISTRATION` for an invalid provider;
   * `DI_BAG_WRONG_TOKEN_KIND` when a retained token use conflicts with this graph.
   * @example
   * ```ts
   * const builder = DiBag.createBuilder().withServices({ clock: () => Date.now() }).withReplacedService('clock', () => 0);
   * ```
   */
  readonly withReplacedService: BuilderWithReplacedService<Entries, Constraints> = this.#withReplacedService as BuilderWithReplacedService<Entries, Constraints>;
  #withReplacedService(serviceKey: unknown, provider: unknown): unknown {
    const selected = typeof serviceKey === 'string' ? undefined : readToken(serviceKey);
    const key = selected === undefined ? serviceKey as string : selected.key;
    const graph = selected === undefined
      ? this.#graph
      : this.#graph.withTokenKind(selected.key, selected.kind, 'withReplacedService');
    if (selected?.kind !== 'collection' && !graph.hasPublic(key)) {
      throw libraryError('DI_BAG_INVALID_REPLACEMENT', `withReplacedService accepts existing names or typed tokens only: ${String(key)}`, { operation: 'withReplacedService', key });
    }
    normalize(provider, 'withReplacedService');
    return new Builder(graph.withPublicBinding(key, provider as Registration, 'withReplacedService'), this.context);
  }

  /**
   * Install sealed modules in list order, allocating fresh private bindings for each installation.
   * Each module is checked against this builder plus the modules before it in the list.
   * The installing host must provide every requirement that no module of the graph provides.
   * @param modules - A finite list of modules whose public names collide neither with this builder nor with each other.
   * @returns A new builder exposing only the selected exports of each module; contributions keep list order.
   * @throws `DI_BAG_INVALID_ARGUMENT` when `modules` is not an array; `DI_BAG_INVALID_MODULE` for an element not made by `buildModule`;
   * `DI_BAG_DUPLICATE_REGISTRATION` when an export name is already registered; `DI_BAG_WRONG_TOKEN_KIND` when an installed token kind conflicts with this graph. A rejected list changes nothing.
   * @example
   * ```ts
   * const greeting = DiBag.createBuilder().withServices({ greet: ({ name }: { name: string }) => `hello, ${name}` }).buildModule({ exportedServiceKeys: ['greet'] });
   * const app = DiBag.createBuilder().withInstalledModules([greeting]).withServices({ name: () => 'Ada' }).buildContainer();
   * ```
   */
  readonly withInstalledModules: BuilderWithInstalledModules<Entries, Constraints> = this.#withInstalledModules as BuilderWithInstalledModules<Entries, Constraints>;
  #withInstalledModules(modules: unknown): unknown {
    if (!Array.isArray(modules)) {
      throw libraryError('DI_BAG_INVALID_ARGUMENT', 'withInstalledModules requires an array of modules', { operation: 'withInstalledModules', argument: 'modules', expected: 'an array' });
    }
    // Snapshot indexed entries before a custom iterator or an accessor can substitute modules.
    const selected: unknown[] = [];
    const length = modules.length;
    for (let index = 0; index < length; index++) selected[index] = modules[index];
    // Describe every element before installing any, so a list with a bad element runs no installation.
    const descriptions = selected.map((module, index) => moduleGraph(module, index));
    let graph = this.#graph;
    for (const description of descriptions) graph = graph.withInstallation(description);
    return new Builder(graph, this.context) as never;
  }

  /**
   * Report at the type level why this graph would not build; the runtime call does nothing.
   * Write `builder.verifyGraphAtCompileTime() satisfies void;` so a rejected graph fails on that line with
   * the complete message and details, instead of at the start of the builder expression.
   * @returns `void` for a buildable graph; otherwise the failure that `buildContainer()` would report.
   * @example
   * ```ts
   * const builder = DiBag.createBuilder().withServices({ greeting: () => 'hello' });
   * builder.verifyGraphAtCompileTime() satisfies void;
   * ```
   */
  // A generic `this` keeps the report out of every builder instantiation (about 11k fewer instantiations per 100 calls).
  verifyGraphAtCompileTime<Self extends Builder<Entries, Constraints>>(this: Self): CompositionReport<Self>;
  verifyGraphAtCompileTime(): unknown { return undefined; }

  /**
   * Seal this graph as a reusable module and select its public names and typed tokens.
   * Unselected services stay private to each installation; unmet dependencies
   * become requirements of the module. Installed modules nest: their private
   * bindings and retained constraints are re-scoped inside this module.
   * @param options - `exportedServiceKeys` is a finite tuple of existing names or tokens, and may be empty. `moduleLabel` is optional;
   * each installation names its private bindings `<moduleLabel>/<key>` in error messages, cycle paths, `graphSnapshot()`, and observer events.
   * @returns An immutable module that can be renamed or installed in another builder.
   * @throws `DI_BAG_INVALID_ARGUMENT` for a malformed options object; `DI_BAG_INVALID_EXPORT` if the selection is not a tuple,
   * contains an absent name or token, or the label is not a non-empty string; `DI_BAG_INVALID_TOKEN` for a value that is not a genuine token;
   * `DI_BAG_WRONG_TOKEN_KIND` when an exported token kind conflicts with this graph.
   * @example
   * ```ts
   * const orders = DiBag.createBuilder()
   *   .withServices({ repository: () => new Map<string, number>() })
   *   .withServices({ placeOrder: ({ repository }: { repository: Map<string, number> }) => (id: string) => repository.set(id, 1) })
   *   .buildModule({ exportedServiceKeys: ['placeOrder'], moduleLabel: 'orders' });
   * // Errors and graphSnapshot() name the private binding 'orders/repository'.
   * const app = DiBag.createBuilder().withInstalledModules([orders]).buildContainer();
   * ```
   */
  readonly buildModule: BuilderBuildModule<Entries, Constraints> = this.#buildModule as BuilderBuildModule<Entries, Constraints>;
  #buildModule(options: unknown): unknown {
    const { exportedServiceKeys, moduleLabel } = snapshotOptionsBag(options, 'buildModule', ['exportedServiceKeys'], ['moduleLabel']);
    return sealModule(this.#graph, exportedServiceKeys, moduleLabel);
  }

  /**
   * Finish a complete graph as a lazy container.
   * The container owns what it acquires; close it when done.
   * @returns A fresh container that owns the acquisitions it creates.
   * @throws `DI_BAG_CLASSIFIER_REQUIRED` when a provider uses `auto` acquisition, the facade has no Promise
   * classifier, and the host has no `process.getBuiltinModule`.
   * @example
   * ```ts
   * const app = DiBag.createBuilder().withServices({ greeting: () => 'hello' }).buildContainer();
   * await app.close();
   * ```
   */
  buildContainer(this: Builder<Entries, Constraints> & CheckDependencyCompleteness<RegistrationsFromEntries<Entries>> & CompleteConstraints<Constraints, RegistrationsFromEntries<Entries>> & CheckedLifetimes<RegistrationsFromEntries<Entries>, Constraints>): Container<RegistrationsFromEntries<Entries>, Constraints> {
    return new Container(this.#graph, this.context);
  }

}

export type { Container, Builder };

/**
 * Immutable facade configuration. Observers append in the supplied order.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#observe-lifecycle-transitions
 */
export interface ConfigurationOptions {
  readonly runtime?: RuntimeOptions;
  readonly lifecycleObservers?: readonly LifecycleObserver[];
}
/**
 * The immutable public entry surface used by {@link DiBag} and derived facades.
 * @see https://dany-fedorov.github.io/di-bag/agent/api-card.html#dibag-facade
 */
export interface DiBagApi {
  /**
   * Create a provider from a named-dependency factory.
   * @example
   * ```ts
   * const config = DiBag.createProvider(() => ({ url: 'memory:' }), { factoryReturnKind: 'sync-value' });
   * ```
   */
  readonly createProvider: typeof createProvider;
  /**
   * Create a provider whose factory receives positional dependency values.
   * @example
   * ```ts
   * const portSymbol = Symbol('port');
   * const port = DiBag.createToken(portSymbol).forService<number>();
   * const client = DiBag.createProviderFromFunction({ dependencies: [port], factoryFunction: value => ({ port: value }) });
   * ```
   */
  readonly createProviderFromFunction: typeof createProviderFromFunction;
  /**
   * Create a provider that constructs a class from positional dependencies.
   * @example
   * ```ts
   * const portSymbol = Symbol('port');
   * const port = DiBag.createToken(portSymbol).forService<number>();
   * class Client { constructor(readonly port: number) {} }
   * const client = DiBag.createProviderFromClass({ dependencies: [port], serviceClass: Client });
   * ```
   */
  readonly createProviderFromClass: typeof createProviderFromClass;
  /**
   * Create a provider from a versioned plugin descriptor.
   * @example
   * ```ts
   * const pluginDescriptor = { apiVersion: 1 as const, create: () => ({ run() {} }) };
   * const plugin = DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor, factoryReturnKind: 'uninspected', isValidPluginOutput: (value): value is { run(): void } => typeof value === 'object' && value !== null });
   * ```
   */
  readonly createProviderFromPlugin: CreateProviderFromPlugin;
  /**
   * Create a nominal token from a symbol.
   * @example
   * ```ts
   * const clockSymbol = Symbol('clock');
   * const clock = DiBag.createToken(clockSymbol).forService<{ now(): number }>();
   * ```
   */
  readonly createToken: typeof createToken;
  /**
   * Return a facade with inherited runtime settings and appended observers.
   * @throws `DI_BAG_INVALID_CONFIGURATION` for a non-object, a runtime without `isNativePromise`, or malformed observers.
   * @example
   * ```ts
   * const Observed = DiBag.withConfiguration({
   *   lifecycleObservers: [{ onLifecycleEvent: event => console.log(event.kind), onObserverFailure: failure => console.error(failure.error) }],
   * });
   * ```
   */
  withConfiguration: (options: ConfigurationOptions) => DiBagApi;
  /**
   * Describe a named-dependency factory with an explicit acquisition mode or the acquisition's abort signal.
   * A factory that returns a non-Promise object with a `then` method needs `acquisitionMode: 'raw'` or must return `Promise.resolve(value)`.
   * @throws `DI_BAG_INVALID_FACTORY` for a non-function or an unknown `context`; `DI_BAG_INVALID_ACQUISITION_MODE` for an unknown mode.
   * @example
   * ```ts
   * type Query = { then(done: (rows: string[]) => void): void };
   * const query = DiBag.fromFactory((): Query => ({ then: done => done([]) }), { acquisitionMode: 'raw' });
   * ```
   */
  fromFactory: typeof fromFactory;
  /**
   * Describe a synchronous factory that runs on every host: the exact return value is the service and `then` is never read.
   * A Promise or thenable output is rejected at compile time; use `fromAsyncFactory`, or `fromFactory` with `acquisitionMode: 'raw'` when the Promise object itself is the service.
   * @throws `DI_BAG_INVALID_FACTORY` for a non-function, an unknown `context`, or an `acquisitionMode` option.
   * @example
   * ```ts
   * const config = DiBag.fromSyncFactory(() => ({ url: 'memory:' }));
   * ```
   */
  fromSyncFactory: typeof fromSyncFactory;
  /**
   * Describe an asynchronous factory that runs on every host: the service is the returned native Promise and `withDisposal` receives its fulfilled value.
   * A non-Promise output is rejected at compile time; a thenable that is not a native Promise fails the acquisition with a `TypeError`.
   * @throws `DI_BAG_INVALID_FACTORY` for a non-function, an unknown `context`, or an `acquisitionMode` option.
   * @example
   * ```ts
   * const db = DiBag.withDisposal(
   *   DiBag.fromAsyncFactory(async ({ config }: { config: { url: string } }) => ({ url: config.url, end: async () => {} })),
   *   db => db.end(),
   * );
   * ```
   */
  fromAsyncFactory: typeof fromAsyncFactory;
  /**
   * Create a typed-token factory from a unique symbol; `.of<Service>()` selects one service, while `.forCollectionOf<Item>()` selects an ordered collection.
   * @throws `DI_BAG_INVALID_TOKEN` when the key is not a symbol.
   * @example
   * ```ts
   * const clockKey = Symbol('clock');
   * const clock = DiBag.token(clockKey).of<{ now(): number }>();
   * ```
   */
  token: typeof token;
  /**
   * Create a positional dependency that yields `undefined` only when the token is unregistered.
   * @throws `DI_BAG_INVALID_TOKEN` for a value that is not a genuine token; `DI_BAG_WRONG_TOKEN_KIND` when a collection token is used as an optional single-service dependency.
   * @example
   * ```ts
   * const clockKey = Symbol('clock');
   * const clock = DiBag.token(clockKey).of<{ now(): number }>();
   * const stamp = DiBag.fromFunction([DiBag.optional(clock)], source => source?.now() ?? 0);
   * ```
   */
  optional: typeof optional;
  /**
   * Create a positional dependency supplied as a function that resolves the token when called.
   * @throws `DI_BAG_INVALID_TOKEN` for a value that is not a genuine token.
   * @example
   * ```ts
   * const clockKey = Symbol('clock');
   * const clock = DiBag.token(clockKey).of<{ now(): number }>();
   * const stamp = DiBag.fromFunction([DiBag.lazy(clock)], getClock => () => getClock().now());
   * ```
   */
  lazy: typeof lazy;
  /**
   * Validate an unknown plugin descriptor now and its acquired output at acquisition.
   * @throws `DI_BAG_INVALID_TOKEN` for a malformed dependency tuple; `DI_BAG_INVALID_PLUGIN_OPTIONS` for malformed options;
   * {@link DiBagPluginValidationError} (`DI_BAG_PLUGIN_VALIDATION`) for an invalid descriptor, or at acquisition for rejected output.
   * @example
   * ```ts
   * declare const descriptor: unknown;
   * const greeter = DiBag.fromPlugin([], descriptor, {
   *   acquisitionMode: 'raw',
   *   validate: (pluginOutput): pluginOutput is () => string => typeof pluginOutput === 'function',
   * });
   * ```
   */
  fromPlugin: PluginProviderFactory;
  /**
   * Adapt a positional function whose parameters receive the listed tokens' services.
   * @throws `DI_BAG_INVALID_TOKEN` for a malformed token tuple; `DI_BAG_INVALID_FUNCTION` for a non-function;
   * `DI_BAG_INVALID_ACQUISITION_MODE` for an unknown mode.
   * @example
   * ```ts
   * const clockKey = Symbol('clock');
   * const clock = DiBag.token(clockKey).of<{ now(): number }>();
   * const stamp = DiBag.fromFunction([clock], source => new Date(source.now()).toISOString());
   * ```
   */
  fromFunction: typeof fromFunction;
  /**
   * Adapt a class whose constructor parameters receive the listed tokens' services.
   * @throws `DI_BAG_INVALID_TOKEN` for a malformed token tuple; `DI_BAG_INVALID_CONSTRUCTOR` for a non-constructable value;
   * `DI_BAG_INVALID_ACQUISITION_MODE` for an unknown mode.
   * @example
   * ```ts
   * class Greeter { constructor(readonly greeting: string) {} }
   * const greetingKey = Symbol('greeting');
   * const greeter = DiBag.fromClass([DiBag.token(greetingKey).of<string>()], Greeter);
   * ```
   */
  fromClass: typeof fromClass;
  /**
   * Begin an empty immutable graph; `buildContainer` creates its owning container, `buildModule` seals a reusable module.
   * @example
   * ```ts
   * const container = DiBag.createBuilder().withServices({ greeting: () => 'hello' }).buildContainer();
   * ```
   */
  createBuilder: () => Builder<never>;
  /**
   * Make the container own a factory's value and run `dispose` on it when the container closes.
   * `close()` runs disposers, dependents first; close every child and independent container you create.
   * @throws `DI_BAG_INVALID_REGISTRATION` when the registration is neither a function nor a provider.
   * @example
   * ```ts
   * const container = DiBag.createBuilder().withServices({ controller: DiBag.withDisposal(() => new AbortController(), controller => controller.abort()) }).buildContainer();
   * await container.close();
   * ```
   */
  withDisposal: typeof withDisposal;
  /**
   * Select `root`, `scoped` (the default), or `transient` caching for a registration.
   * Mark a shared client `root` only when nothing it depends on is scoped.
   * @throws `DI_BAG_INVALID_LIFETIME` for an unknown lifetime or malformed options; `DI_BAG_INVALID_REGISTRATION` for an invalid registration.
   * @example
   * ```ts
   * const container = DiBag.createBuilder().withServices({ cache: DiBag.withLifetime(() => new Map<string, string>(), 'root') }).buildContainer();
   * ```
   */
  withLifetime: typeof withLifetime;
  /**
   * Attach static registration metadata, or per-acquisition metadata in direct or awaited mode.
   * @throws `DI_BAG_INVALID_METADATA` for malformed options or, at acquisition, a describe result that is not a plain record;
   * `DI_BAG_DUPLICATE_METADATA` for a repeated key; `DI_BAG_INVALID_REGISTRATION` for an invalid registration.
   * @example
   * ```ts
   * const greeting = DiBag.withMetadata(() => 'hello', { static: { owner: 'greeting' } });
   * ```
   */
  withMetadata: typeof withMetadata;
  /**
   * Transform the exposed service while retaining dependencies, metadata, lifetime, and existing ownership.
   * @throws `DI_BAG_INVALID_TRANSFORM` for a bad mode or callback; `DI_BAG_INVALID_ACQUISITION_MODE` for an unknown mode;
   * `DI_BAG_INVALID_REGISTRATION` for an invalid registration.
   * @example
   * ```ts
   * const shout = DiBag.transformService(() => 'hello', { mode: 'direct', transform: text => text.toUpperCase() });
   * ```
   */
  transformService: typeof transformService;
}
function facade(context: RuntimeContext): DiBagApi { return Object.freeze({
  withConfiguration: (options: ConfigurationOptions): DiBagApi => {
    const selected = snapshotOptionsBag(options, 'withConfiguration', [], ['runtime', 'lifecycleObservers']);
    const runtime = selected.runtime as RuntimeOptions | undefined;
    const lifecycleObservers = selected.lifecycleObservers as readonly unknown[] | undefined;
    let configured = runtime === undefined ? context : runtimeContext(runtime, context);
    if (lifecycleObservers !== undefined) {
      if (!Array.isArray(lifecycleObservers)) throw libraryTypeError('DI_BAG_INVALID_CONFIGURATION', 'withConfiguration lifecycleObservers must be an array', { operation: 'withConfiguration' });
      for (const observer of lifecycleObservers) {
        configured = Object.freeze({
          ...configured,
          observers: LifecycleObservers.append(configured.observers, observer),
        });
      }
    }
    return facade(configured);
  },
  createProvider, createProviderFromFunction, createProviderFromClass, createProviderFromPlugin, createToken,
  fromFactory, fromSyncFactory, fromAsyncFactory, token, optional, lazy, fromPlugin, fromFunction, fromClass,
  createBuilder: (): Builder<never> => new Builder(new BindingGraph(), context),
  withDisposal, withLifetime, withMetadata, transformService,
}); }
/**
 * The immutable DI Bag facade. `auto` acquisition uses the host classifier where `process.getBuiltinModule`
 * exists; elsewhere wrap factories with `fromSyncFactory` and `fromAsyncFactory`, use explicit modes, or configure a classifier.
 */
export const DiBag: DiBagApi = facade(unconfigured);
