import { libraryError, libraryTypeError } from './errors';
import { LifecycleObservers } from './observers';
import type { LifecycleObserver } from './observers';
import { contributionEntry } from './contributions';
import type { BuilderWithCollectionContribution } from './contribution-types';
import type { BuilderBuildModule, BuilderWithInstalledModules, BuilderWithReplacedService, BuilderWithServiceAlias, BuilderWithServices, BuilderWithTokenService } from './builder-method-types';
import { aliasEntry } from './aliases';
import { optional, lazy } from './dependency-references';
import { normalize, snapshotAdd } from './registration';
import { snapshotOptionsBag } from './options-bag';
import type { ProviderOrFactory, Registrations } from './registration';
import { BindingGraph, BagRuntime } from './runtime';
import { moduleGraph, sealModule } from './module';
import type { CompositionReport } from './composition-report';
import type { CheckedConstraints, CompleteConstraints, NeedConstraint } from './module-types';
import type { CheckedLifetimes, WithoutExportObligations } from './lifetime-types';
import { createProvider } from './acquisition-context';
import { closeRuntime, ensureRuntimeReady } from './startup';
import { selectChildContainer, selectIndependentContainer } from './scope-selection';
import type { CreateChildContainerOptions, CreateIndependentContainerOptions, DisjointChildContainerSelection, UnsharedAliases, ScopedAliases } from './scope-types';
import type { CheckedChildContainerLifetimes, ChildReplacementAdmission } from './lifetime-types';
import type { CloseOptions, EnsureServicesReadyOptions } from './startup';
import { withTokenBinding } from './provider';
import { providerWithAcquisitionMetadata, providerWithDisposal, providerWithLifetime, providerWithRegistrationMetadata, providerWithTransformedService } from './provider-facades';
import { createProviderFromFunction, createProviderFromClass } from './composition';
import { runtimeContext, unconfigured } from './acquisition-mode';
import type { RuntimeContext, RuntimeOptions } from './acquisition-mode';
import type { ProviderRegistrationMetadata, ProviderAcquisitionMetadata } from './provider';
import type { GraphSnapshot, RegistrationSnapshot } from './inspection';
import { createToken, readSingleServiceKey, readToken, wrongTokenKind } from './tokens';
import { createProviderFromPlugin } from './plugins';
import type { CreateProviderFromPlugin } from './plugins';
import { installRemovedMembers } from './removed-api';
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
 * @typeParam ServiceRegistrations - The map from each public service name or token symbol to its provider.
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
   * Scoped and singleton services are cached according to their lifetime; transient services
   * create a new acquisition for each call. Promise-valued services keep their identity.
   * An async factory's service is its Promise; nothing is awaited for you.
   * @param token - An existing public string name or typed token.
   * @returns The service exposed by the selected provider.
   * @throws `DI_BAG_CLOSING` or `DI_BAG_CLOSED` after `close()`; `DI_BAG_INVALID_TOKEN`, `DI_BAG_WRONG_TOKEN_KIND`, or `DI_BAG_UNKNOWN_SERVICE_KEY` for a bad selection;
   * during acquisition `DI_BAG_MISSING_DEPENDENCY`, `DI_BAG_DEPENDENCY_CYCLE`, `DI_BAG_LIFETIME_DEPENDENCY`, `DI_BAG_INVALID_DEPENDENCY_ACCESS`,
   * `DI_BAG_STRUCTURAL_THENABLE`, `DI_BAG_INVALID_CLASSIFIER_RESULT`, `DI_BAG_INVALID_ACQUISITION_METADATA`, `DI_BAG_PLUGIN_VALIDATION`,
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
   * const tools = DiBag.createToken(toolsKey).forCollectionOf<string>();
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
   * Inspect a service binding through any supported public key without resolving it.
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
   * const handlers = DiBag.createToken(handlersKey).forCollectionOf<() => void>();
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
   * const labels = container.graphSnapshot().bindings.map(binding => binding.bindingLabel);
   * await container.close();
   * ```
   */
  graphSnapshot(): GraphSnapshot { return this.#runtime.inspectGraph(); }

  /**
   * Create a tracked child container with fresh ownership for unshared services.
   * Share selected non-transient parent acquisitions through the optional options object. To replace services,
   * pass selected keys and providers first, then the sharing options.
   * @returns A child owned by this container; closing the parent closes the child first.
   * @throws `DI_BAG_INVALID_ARGUMENT` for malformed arguments; `DI_BAG_CONFLICTING_SERVICE_SELECTION` when one key is shared and replaced or a transient service is shared;
   * `DI_BAG_MISSING_REPLACEMENT_PROVIDER` for a missing replacement provider; `DI_BAG_UNKNOWN_SERVICE_KEY` for an unknown selected key; `DI_BAG_SINGLETON_REPLACEMENT` when a selected inherited provider is singleton;
   * `DI_BAG_INVALID_TOKEN` or `DI_BAG_WRONG_TOKEN_KIND` for a bad token or kind.
   * @example
   * ```ts
   * const parent = DiBag.createBuilder().withServices({ request: DiBag.providerWithLifetime({
   *   provider: () => ({ id: 'initial' }), lifetime: 'scoped:one-per-container',
   * }) }).buildContainer();
   * const child = parent.createChildContainer(['request'], { request: () => ({ id: 'child' }) });
   * const request = child.resolve('request');
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
    replacementProviders: ReplacementProviders & ChildReplacementAdmission<ServiceRegistrations, ReplacedServiceKeys> & object & Record<SelectionKey<ReplacedServiceKeys[number]>, ProviderOrFactory> &
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
    const { graph, shared } = selectChildContainer(this.#graph, positionalChildOptions(args), serviceKey => this.#runtime.lifetimeOf(serviceKey));
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
   * @throws `DI_BAG_INVALID_ARGUMENT` for malformed arguments; `DI_BAG_MISSING_REPLACEMENT_PROVIDER` for a missing replacement provider; `DI_BAG_UNKNOWN_SERVICE_KEY` for an unknown selected key;
   * `DI_BAG_INVALID_PROVIDER` for a malformed provider; `DI_BAG_INVALID_TOKEN` or `DI_BAG_WRONG_TOKEN_KIND` for a bad token or kind.
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
    replacementProviders: ReplacementProviders & object & Record<SelectionKey<ReplacedServiceKeys[number]>, ProviderOrFactory> &
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
   * `DI_BAG_INVALID_ARGUMENT` for malformed keys or options, `DI_BAG_UNKNOWN_SERVICE_KEY` for an unknown key, and `DI_BAG_INVALID_TOKEN` or `DI_BAG_WRONG_TOKEN_KIND` for a bad token or kind, all before any factory runs and with this container left open;
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
   * reverse acquisition order. Without options the promise waits for disposal however long it
   * takes, and repeated calls return the same promise. With `waitTimeoutMs` or `abortSignal`, disposal
   * starts the same way but the returned promise stops waiting when either fires; child and
   * independent containers accept the same options. Close every derived container you create; a parent closes its live children, never independent containers.
   * @param options - An optional deadline and abort signal bounding the wait, not the disposal.
   * @returns The shared shutdown promise, or a bounded wait on it when options are given.
   * @throws {@link DiBagDisposalError} (`DI_BAG_DISPOSAL_FAILED`) when one or more disposers fail after all disposal is attempted;
   * `DI_BAG_CLOSE_FAILED` for other shutdown failures;
   * {@link DiBagCloseCancelledError} (`DI_BAG_CLOSE_TIMEOUT` or `DI_BAG_CLOSE_ABORTED`) when the wait stops first,
   * naming unfinished disposers in `details.disposersStillRunning`; `DI_BAG_INVALID_ARGUMENT` for malformed options.
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
 * @typeParam Entries - The union of accepted provider entries, one per public key.
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
   * Bind typed tokens separately with `withTokenService`.
   * @param providersByName - A finite object whose own string keys are service names and whose values are providers or plain factories.
   * @returns A new builder containing snapshots of the supplied providers.
   * @throws `DI_BAG_INVALID_ARGUMENT` for a malformed object or `DI_BAG_INVALID_PROVIDER` for a malformed value; `DI_BAG_DUPLICATE_SERVICE_KEY` for a name already registered;
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
   * `DI_BAG_DUPLICATE_SERVICE_KEY` when the token already has a service; `DI_BAG_INVALID_PROVIDER` for an invalid provider.
   * @example
   * ```ts
   * const clockKey = Symbol('clock');
   * const clock = DiBag.createToken(clockKey).forService<{ now(): number }>();
   * const builder = DiBag.createBuilder().withTokenService(clock, () => ({ now: () => Date.now() }));
   * ```
   */
  readonly withTokenService: BuilderWithTokenService<Entries, Constraints> = this.#withTokenService as BuilderWithTokenService<Entries, Constraints>;
  #withTokenService(token: unknown, provider: unknown): unknown {
    const serviceKey = readSingleServiceKey(token, 'withTokenService');
    const graph = this.#graph.withTokenKind(serviceKey, 'single-service', 'withTokenService');
    if (graph.hasPublic(serviceKey)) throw libraryError('DI_BAG_DUPLICATE_SERVICE_KEY', `duplicate service key: ${String(serviceKey)}`, { operation: 'withTokenService', serviceKey });
    return new Builder(graph.withPublicBinding(serviceKey, withTokenBinding(token as never, provider as never, 'withTokenService'), 'withTokenService'), this.context) as never;
  }

  /**
   * Add another lookup name for an existing service.
   * @param options - `aliasKey` is a new string name or single-service token; `targetServiceKey` is the existing name or token whose canonical acquisition is reused.
   * @returns A new builder; aliases add no cache or ownership of their own.
   * @throws `DI_BAG_INVALID_ARGUMENT` for a malformed options object; `DI_BAG_INVALID_TOKEN` or `DI_BAG_WRONG_TOKEN_KIND` for a bad token or kind;
   * `DI_BAG_DUPLICATE_SERVICE_KEY` when the alias key exists; `DI_BAG_UNKNOWN_SERVICE_KEY` for an absent named target.
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
   * @throws `DI_BAG_INVALID_ARGUMENT` for a malformed options object; `DI_BAG_INVALID_TOKEN` or `DI_BAG_WRONG_TOKEN_KIND` for a bad token or kind; `DI_BAG_INVALID_PROVIDER` for an invalid provider.
   * @example
   * ```ts
   * const toolsKey = Symbol('tools');
   * const tools = DiBag.createToken(toolsKey).forCollectionOf<string>();
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
    const [key, value] = contributionEntry(collectionToken, provider as ProviderOrFactory);
    return new Builder(this.#graph.withContribution(key, value, 'withCollectionContribution'), this.context);
  }) as BuilderWithCollectionContribution<Entries, Constraints>;

  /**
   * Replace an existing binding with a compatible provider, selecting it by name, service token, collection token.
   * @param serviceKey - One existing string-literal service name or typed token.
   * @param provider - The replacement, checked against every surviving consumer.
   * @returns A new builder with the replacement.
   * @throws `DI_BAG_UNKNOWN_SERVICE_KEY` for an absent key; `DI_BAG_INVALID_PROVIDER` for an invalid provider;
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
      throw libraryError('DI_BAG_UNKNOWN_SERVICE_KEY', `withReplacedService accepts existing names or typed tokens only: ${String(key)}`, { operation: 'withReplacedService', serviceKey: key });
    }
    normalize(provider, 'withReplacedService');
    return new Builder(graph.withPublicBinding(key, provider as ProviderOrFactory, 'withReplacedService'), this.context);
  }

  /**
   * Install sealed modules in list order, allocating fresh private bindings for each installation.
   * Each module is checked against this builder plus the modules before it in the list.
   * The installing host must provide every requirement that no module of the graph provides.
   * @param modules - A finite list of modules whose public names collide neither with this builder nor with each other.
   * @returns A new builder exposing only the selected exports of each module; contributions keep list order.
   * @throws `DI_BAG_INVALID_ARGUMENT` when `modules` is not an array; `DI_BAG_INVALID_MODULE` for an element not made by `buildModule`;
   * `DI_BAG_DUPLICATE_SERVICE_KEY` when an export name is already registered; `DI_BAG_WRONG_TOKEN_KIND` when an installed token kind conflicts with this graph. A rejected list changes nothing.
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
   * bindings and retained constraints are nested inside this module.
   * @param options - `exportedServiceKeys` is a finite tuple of existing names or tokens, and may be empty. `moduleLabel` is optional;
   * each installation names its private bindings `<moduleLabel>/<key>` in error messages, cycle paths, `graphSnapshot()`, and observer events.
   * @returns An immutable module that can be renamed or installed in another builder.
   * @throws `DI_BAG_INVALID_ARGUMENT` for a malformed options object or non-tuple selection
   * or the label is not a non-empty string; `DI_BAG_UNKNOWN_SERVICE_KEY` for an absent name or token; `DI_BAG_INVALID_TOKEN` for a value that is not a genuine token;
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

installRemovedMembers('Builder', Builder.prototype);
installRemovedMembers('Bag', Container.prototype);

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
   * Its return kind must be `uninspected` or `native-promise`: plugin output cannot be inspected to determine the kind.
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
   * @throws `DI_BAG_INVALID_ARGUMENT` for a non-object, a runtime without `isNativePromise`, or malformed observers.
   * @example
   * ```ts
   * const Observed = DiBag.withConfiguration({
   *   lifecycleObservers: [{ onLifecycleEvent: event => console.log(event.kind), onObserverFailure: failure => console.error(failure.error) }],
   * });
   * ```
   */
  withConfiguration: (options: ConfigurationOptions) => DiBagApi;
  /**
   * Create a positional dependency that yields `undefined` only when the token is unregistered.
   * @throws `DI_BAG_INVALID_TOKEN` for a value that is not a genuine token; `DI_BAG_WRONG_TOKEN_KIND` when a collection token is used as an optional single-service dependency.
   * @example
   * ```ts
   * const clockKey = Symbol('clock');
   * const clock = DiBag.createToken(clockKey).forService<{ now(): number }>();
   * const stamp = DiBag.createProviderFromFunction({ dependencies: [DiBag.optional(clock)], factoryFunction: source => source?.now() ?? 0 });
   * ```
   */
  optional: typeof optional;
  /**
   * Create a positional dependency supplied as a function that resolves the token when called.
   * @throws `DI_BAG_INVALID_TOKEN` for a value that is not a genuine token.
   * @example
   * ```ts
   * const clockKey = Symbol('clock');
   * const clock = DiBag.createToken(clockKey).forService<{ now(): number }>();
   * const stamp = DiBag.createProviderFromFunction({ dependencies: [DiBag.lazy(clock)], factoryFunction: getClock => () => getClock().now() });
   * ```
   */
  lazy: typeof lazy;
  /**
   * Begin an empty immutable graph; `buildContainer` creates its owning container, `buildModule` seals a reusable module.
   * @example
   * ```ts
   * const container = DiBag.createBuilder().withServices({ greeting: () => 'hello' }).buildContainer();
   * ```
   */
  createBuilder: () => Builder<never>;
  /**
   * Add an ownership stage to a provider input.
   * @throws `DI_BAG_INVALID_ARGUMENT` for a malformed options object or disposer; `DI_BAG_INVALID_PROVIDER` for an invalid provider.
   * @example
   * ```ts
   * const owned = DiBag.providerWithDisposal({ provider: () => ({ close() {} }), disposeService: service => service.close() });
   * ```
   */
  readonly providerWithDisposal: typeof providerWithDisposal;
  /**
   * Return a provider with singleton, scoped, or transient caching.
   * Providers are scoped per container by default; mark shared clients singleton when none of
   * their dependencies are scoped.
   * @param options - The provider, full lifetime, and optional deliberate scoped-capture allowance for singleton only.
   * @returns A fresh immutable provider retaining every other provider stage.
   * @throws `DI_BAG_INVALID_ARGUMENT` for a malformed options object, lifetime, or option; `DI_BAG_INVALID_PROVIDER` for an invalid provider.
   * @example
   * ```ts
   * const createClient = () => ({ close() {} });
   * const client = DiBag.providerWithLifetime({ provider: DiBag.createProvider(() => createClient()), lifetime: 'singleton:one-per-container-tree' });
   * ```
   */
  readonly providerWithLifetime: typeof providerWithLifetime;
  /**
   * Add noncolliding registration metadata without acquiring the service.
   * @throws `DI_BAG_INVALID_ARGUMENT` for malformed metadata; `DI_BAG_DUPLICATE_METADATA_KEY` for a repeated key; `DI_BAG_INVALID_PROVIDER` for an invalid provider.
   * @example
   * ```ts
   * const registered = DiBag.providerWithRegistrationMetadata({ provider: () => 1, registrationMetadata: { owner: 'platform' } });
   * ```
   */
  readonly providerWithRegistrationMetadata: typeof providerWithRegistrationMetadata;
  /**
   * Append one synchronous acquisition-metadata frame using the selected callback input.
   * @throws `DI_BAG_INVALID_ARGUMENT` for a malformed options object; `DI_BAG_INVALID_ACQUISITION_METADATA` for an invalid callback result; `DI_BAG_INVALID_PROVIDER` for an invalid provider.
   * @example
   * ```ts
   * const observed = DiBag.providerWithAcquisitionMetadata({ provider: () => 1, callbackReceives: 'exposed-service', describeAcquisition: value => ({ value }) });
   * ```
   */
  readonly providerWithAcquisitionMetadata: typeof providerWithAcquisitionMetadata;
  /**
   * Transform the selected callback input while retaining dependencies, metadata, lifetime and ownership stages.
   * @throws `DI_BAG_INVALID_ARGUMENT` for a malformed options object or return policy; `DI_BAG_INVALID_PROVIDER` for an invalid provider.
   * @example
   * ```ts
   * const mapped = DiBag.providerWithTransformedService({ provider: () => 1, callbackReceives: 'exposed-service', transformService: value => String(value) });
   * ```
   */
  readonly providerWithTransformedService: typeof providerWithTransformedService;
}
function facade(context: RuntimeContext): DiBagApi {
  const api: DiBagApi = {
    withConfiguration: (options: ConfigurationOptions): DiBagApi => {
      const selected = snapshotOptionsBag(options, 'withConfiguration', [], ['runtime', 'lifecycleObservers']);
      const runtime = selected.runtime as RuntimeOptions | undefined;
      const lifecycleObservers = selected.lifecycleObservers as readonly unknown[] | undefined;
      let configured = runtime === undefined ? context : runtimeContext(runtime, context);
      if (lifecycleObservers !== undefined) {
        if (!Array.isArray(lifecycleObservers)) throw libraryTypeError('DI_BAG_INVALID_ARGUMENT', 'withConfiguration lifecycleObservers must be an array', { operation: 'withConfiguration', argument: 'lifecycleObservers', expected: 'an array' });
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
    optional, lazy,
    createBuilder: (): Builder<never> => new Builder(new BindingGraph(), context),
    providerWithDisposal, providerWithLifetime, providerWithRegistrationMetadata,
    providerWithAcquisitionMetadata, providerWithTransformedService,
  };
  installRemovedMembers('DiBagApi', api);
  return Object.freeze(api);
}
/**
 * The immutable DI Bag facade. `auto-detect` acquisition uses the host classifier where `process.getBuiltinModule`
 * exists; elsewhere select an explicit `factoryReturnKind` or configure a classifier.
 */
export const DiBag: DiBagApi = facade(unconfigured);
