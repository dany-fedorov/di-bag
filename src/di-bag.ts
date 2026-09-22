import { libraryError, libraryTypeError } from './errors';
import { LifecycleObservers } from './observers';
import type { ObserverOptions } from './observers';
import { contributionEntry } from './contributions';
import type { BuilderWithCollectionContribution } from './contribution-types';
import type { BuilderBuildModule, BuilderWithInstalledModules, BuilderWithReplacedService, BuilderWithServiceAlias, BuilderWithServices, BuilderWithTokenService } from './builder-method-types';
import { aliasEntry } from './aliases';
import { optional, lazy } from './dependency-references';
import { normalize, snapshotAdd, withDisposal } from './registration';
import { snapshotOptionsBag } from './options-bag';
import type { Registration, Registrations } from './registration';
import { BindingGraph, BagRuntime } from './runtime';
import type { BindingKey } from './runtime';
import { moduleGraph, sealModule } from './module';
import type { CompositionReport } from './composition-report';
import type { CheckedConstraints, CompleteConstraints, NeedConstraint } from './module-types';
import type { CheckedLifetimes, WithoutExportObligations } from './lifetime-types';
import { withLifetime } from './lifetime';
import { fromFactory, fromSyncFactory, fromAsyncFactory } from './acquisition-context';
import { closeRuntime, ensureRuntimeReady } from './startup';
import { selectChildContainer, selectIndependentContainer, selectScope } from './scope-selection';
import type { CreateChildContainerOptions, CreateIndependentContainerOptions, DisjointChildContainerSelection, ScopeOptions, DisjointScopeSelection, UnsharedAliases, ScopedAliases } from './scope-types';
import type { CheckedChildContainerLifetimes, CheckedScopeLifetimes } from './lifetime-types';
import type { CloseOptions, EnsureServicesReadyOptions } from './startup';
import { withMetadata, transformService, withTokenBinding } from './provider';
import { fromFunction, fromClass } from './composition';
import { runtimeContext, unconfigured } from './acquisition-mode';
import type { RuntimeContext, RuntimeOptions } from './acquisition-mode';
import type { ProviderRegistrationMetadata, ProviderAcquisitionMetadata } from './provider';
import type { GraphSnapshot, RegistrationSnapshot } from './inspection';
import { token, readSingleServiceKey, readToken, wrongTokenKind } from './tokens';
import { fromPlugin } from './plugins';
import type { PluginProviderFactory } from './plugins';
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

function claimSelectedTokenKinds(
  graph: BindingGraph,
  values: readonly unknown[],
  operation: string,
): BindingGraph {
  let claimed = graph;
  for (const value of values) {
    if (typeof value === 'string') continue;
    const token = readToken(value);
    claimed = claimed.withTokenKind(token.key, token.kind, operation);
  }
  return claimed;
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
 * Create bags through {@link DiBagApi.createBuilder} followed by {@link Builder.buildContainer}, and make services
 * ready ahead of use with {@link Bag.ensureServicesReady}; the class is exported as a type and has no public constructor.
 * @typeParam ServiceRegistrations - The map from each public service name or token symbol to its registration.
 * @typeParam Constraints - The requirements, contributions and lifetime obligations that installed modules retain on this graph.
 * @see https://dany-fedorov.github.io/di-bag/agent/api-card.html#bag
 */
class Bag<ServiceRegistrations extends Registrations, Constraints extends NeedConstraint = never> {
  /** @internal */
  declare readonly [constraintInvariant]: (value: Constraints) => Constraints;
  readonly #graph: BindingGraph;
  readonly #runtime: BagRuntime;

  private readonly context: RuntimeContext;

  constructor(graph: BindingGraph, context: RuntimeContext, runtime?: BagRuntime) {
    this.#graph = graph;
    this.#runtime = runtime ?? new BagRuntime(graph, context);
    // Scopes and forks reuse the classifier the runtime resolved, so detection runs once per build.
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
   * const bag = DiBag.createBuilder().withServices({ greeting: () => 'hello' }).buildContainer();
   * const greeting: string = bag.resolve('greeting');
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
   * `DI_BAG_CLOSING` or `DI_BAG_CLOSED` after close begins; or a contribution's acquisition errors as listed for {@link Bag.resolve}.
   * @example
   * ```ts
   * const toolsKey = Symbol('tools');
   * const tools = DiBag.token(toolsKey).forCollectionOf<string>();
   * const bag = DiBag.createBuilder().buildContainer();
   * const names: readonly string[] = bag.resolveCollection(tools);
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
   * Inspect static metadata and copied acquisition state without resolving a service.
   * @param token - An existing public string name or typed token.
   * @returns A frozen point-in-time snapshot. Application-owned metadata payloads are not frozen.
   * @throws `DI_BAG_INVALID_TOKEN`, `DI_BAG_WRONG_TOKEN_KIND`, or `DI_BAG_MISSING_REGISTRATION` for a bad selection; `DI_BAG_CYCLE` for an alias cycle.
   * @example
   * ```ts
   * const bag = DiBag.createBuilder().withServices({ greeting: () => 'hello' }).buildContainer();
   * const acquired = bag.inspect('greeting').acquisitions.length;
   * ```
   */
  inspect<K extends (keyof ServiceRegistrations & string) | TokenBase>(token: K & ([K] extends [string] ? unknown : SingleServiceTokenMember<ServiceRegistrations, K>)): RegistrationSnapshot<ProviderRegistrationMetadata<ServiceRegistrations[SelectionKey<K> & keyof ServiceRegistrations]>, ProviderAcquisitionMetadata<ServiceRegistrations[SelectionKey<K> & keyof ServiceRegistrations]>>;
  inspect(serviceKey: unknown): unknown {
    if (typeof serviceKey === 'string') {
      return this.#runtime.inspect(serviceKey);
    }
    const { key, kind } = readGraphToken(this.#graph, serviceKey, 'inspect');
    if (kind !== 'single-service') {
      throw wrongTokenKind('inspect', 'single-service', key);
    }
    return this.#runtime.inspect(key);
  }

  /**
   * Inspect every provider attached to a collection token without resolving it.
   * @param token - The collection token to inspect.
   * @returns One snapshot per contribution in declaration order.
   * @throws `DI_BAG_INVALID_TOKEN` or `DI_BAG_WRONG_TOKEN_KIND` for a bad handle or kind.
   * @example
   * ```ts
   * const toolsKey = Symbol('tools');
   * const tools = DiBag.token(toolsKey).forCollectionOf<string>();
   * const bag = DiBag.createBuilder().buildContainer();
   * const labels = bag.inspectCollection(tools).map(snapshot => snapshot.label);
   * ```
   */
  inspectCollection<T extends CollectionTokenBase>(token: T & CollectionTokenMember<Constraints, T>,
    ...invalid: [T] extends [never] ? [never] : []): readonly RegistrationSnapshot<object, readonly unknown[]>[] {
    const { key, kind } = readGraphToken(
      this.#graph,
      token,
      'inspectCollection',
    );
    if (kind !== 'collection') {
      throw wrongTokenKind('inspectCollection', 'collection', key);
    }
    return this.#runtime.inspectCollection(key);
  }

  /**
   * Inspect a named service, single-service token, or collection token without resolving it.
   * @param serviceKey - The public service name or typed token to inspect.
   * @returns The service snapshot, or one snapshot per collection contribution.
   * @throws `DI_BAG_INVALID_TOKEN` or `DI_BAG_WRONG_TOKEN_KIND` for a bad handle or kind.
   * @example
   * ```ts
   * const bag = DiBag.createBuilder().withServices({ greeting: () => 'hello' }).buildContainer();
   * const snapshot = bag.serviceSnapshot('greeting');
   * await bag.close();
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
   * const handlers = DiBag.token(Symbol('handlers')).forCollectionOf<() => void>();
   * const bag = DiBag.createBuilder()
   *   .withCollectionContribution({ collectionToken: handlers, provider: () => () => {} })
   *   .buildContainer();
   * const snapshots = bag.serviceSnapshot(handlers);
   * await bag.close();
   * ```
   */
  serviceSnapshot<CollectionToken extends CollectionTokenBase>(
    collectionToken: CollectionToken & CollectionTokenMember<Constraints, CollectionToken>,
    ...invalid: [CollectionToken] extends [never] ? [never] : []
  ): readonly RegistrationSnapshot<object, readonly unknown[]>[];
  serviceSnapshot(serviceKey: unknown, ..._invalid: unknown[]): unknown {
    if (typeof serviceKey === 'string') return this.#runtime.inspect(serviceKey);
    const { key, kind } = readGraphToken(this.#graph, serviceKey, 'serviceSnapshot');
    return kind === 'collection'
      ? this.#runtime.inspectCollection(key)
      : this.#runtime.inspect(key);
  }

  /**
   * Describe every binding this bag can resolve and the dependency edges observed so far.
   * Nothing is acquired. Named dependencies declared on factory parameters are not visible
   * until the factory runs; the static graph tool reports them from source.
   * @returns A frozen point-in-time snapshot; application-owned metadata payloads are not frozen.
   * @example
   * ```ts
   * const bag = DiBag.createBuilder().withServices({ greeting: () => 'hello' }).buildContainer();
   * const labels = bag.inspectGraph().bindings.map(binding => binding.label);
   * ```
   */
  inspectGraph(): GraphSnapshot { return this.#runtime.inspectGraph(); }

  /**
   * Describe every resolvable binding and the dependency edges observed so far.
   * @returns A frozen point-in-time graph snapshot without acquiring services.
   * @example
   * ```ts
   * const bag = DiBag.createBuilder().withServices({ greeting: () => 'hello' }).buildContainer();
   * const labels = bag.graphSnapshot().bindings.map(binding => binding.label);
   * await bag.close();
   * ```
   */
  graphSnapshot(): GraphSnapshot { return this.#runtime.inspectGraph(); }

  /**
   * Create a tracked child container with fresh ownership for unshared services.
   * Share selected non-transient parent acquisitions through the optional bag. To replace services,
   * pass selected keys and providers first, then the sharing bag.
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
  ): Bag<UnsharedAliases<ServiceRegistrations>, Constraints>;
  createChildContainer<const SharedParentServiceKeys extends readonly unknown[]>(
    options: CreateChildContainerOptions<ServiceRegistrations, SharedParentServiceKeys, Constraints>,
  ): Bag<ScopedAliases<ServiceRegistrations, ServiceRegistrations, SharedParentServiceKeys>, Constraints>;
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
  ): Bag<ScopedAliases<OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, ReplacedServiceKeys, SelectedRegistrations<ReplacedServiceKeys, ReplacementProviders>>>, ServiceRegistrations, SharedParentServiceKeys>, WithoutExportObligations<Constraints, SelectionKey<ReplacedServiceKeys[number]>>>;
  createChildContainer(...args: unknown[]): unknown {
    this.#runtime.assertOpen();
    const { graph, shared } = selectChildContainer(this.#graph, positionalChildOptions(args), serviceKey => this.#runtime.isTransient(serviceKey));
    return new Bag(graph, this.context, this.#runtime.scope(graph, shared));
  }

  /**
   * Create an independent container with fresh instances and optional checked replacements.
   * Replacements use positional selected keys and providers; an empty options bag remains valid.
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
  createIndependentContainer(
    this: Bag<ServiceRegistrations, Constraints> & CheckedLifetimes<UnsharedAliases<ServiceRegistrations>, Constraints>,
    options?: CreateIndependentContainerOptions<ServiceRegistrations, Constraints>,
  ): Bag<UnsharedAliases<ServiceRegistrations>, Constraints>;
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
  ): Bag<UnsharedAliases<OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, ReplacedServiceKeys, SelectedRegistrations<ReplacedServiceKeys, ReplacementProviders>>>>, WithoutExportObligations<Constraints, SelectionKey<ReplacedServiceKeys[number]>>>;
  createIndependentContainer(...args: unknown[]): unknown {
    this.#runtime.assertOpen();
    const graph = selectIndependentContainer(this.#graph, positionalIndependentOptions(args));
    return new Bag(graph, this.context);
  }

  /**
   * Create a tracked child that borrows selected parent acquisitions.
   * @param options - A checked selection of non-transient services to share lazily.
   * @returns A child owned by this bag; closing the parent closes the child first.
   * @throws `DI_BAG_INVALID_SCOPE` for a malformed or transient share selection; `DI_BAG_INVALID_TOKEN` or `DI_BAG_WRONG_TOKEN_KIND` for a bad token or kind;
   * `DI_BAG_CLOSING` or `DI_BAG_CLOSED` after `close()`.
   */
  createScope<const S extends readonly unknown[]>(options: ScopeOptions<ServiceRegistrations, S, Constraints>): Bag<ScopedAliases<ServiceRegistrations, ServiceRegistrations, S>, Constraints>;
  /**
   * Create a tracked child with selected replacements and optional parent sharing.
   * @param keys - Existing names or tokens to replace in the child.
   * @param overrides - Own registration properties for every selected key.
   * @param options - A disjoint selection of non-transient parent acquisitions to share.
   * @returns A child with fresh scoped acquisitions and ownership for unshared services.
   * @throws `DI_BAG_INVALID_SCOPE` for invalid selections, overrides, or sharing; `DI_BAG_INVALID_TOKEN`, `DI_BAG_WRONG_TOKEN_KIND`, or `DI_BAG_INVALID_REGISTRATION`
   * for malformed input; `DI_BAG_CLOSING` or `DI_BAG_CLOSED` after `close()`; `DI_BAG_CLASSIFIER_REQUIRED` as for {@link Builder.buildContainer}.
   */
  createScope<
    const K extends readonly unknown[],
    O extends OverrideFactoryContext<ServiceRegistrations, K, O>,
    const S extends readonly unknown[] = readonly [],
  >(
    keys: K & Selection<ServiceRegistrations, Constraints, K, 'createScope'>,
    overrides: O & object & Record<SelectionKey<K[number]>, Registration> &
      Overrides<ServiceRegistrations, ReboundSelection<ServiceRegistrations, K, SelectedRegistrations<K, O>>, K> &
      CheckDependencyCompatibility<OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, K, SelectedRegistrations<K, O>>>> &
      CheckDependencyCompleteness<OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, K, SelectedRegistrations<K, O>>>> &
      CheckedConstraints<Constraints, OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, K, SelectedRegistrations<K, O>>>> &
      CompleteConstraints<Constraints, OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, K, SelectedRegistrations<K, O>>>> &
      CheckedScopeLifetimes<NoInfer<ScopedAliases<OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, K, SelectedRegistrations<K, O>>>, ServiceRegistrations, S>>, NoInfer<ReboundSelection<ServiceRegistrations, K, SelectedRegistrations<K, O>>>, WithoutExportObligations<Constraints, SelectionKey<K[number]>>>,
    options?: ScopeOptions<ServiceRegistrations, S, Constraints> & DisjointScopeSelection<K, S>,
  ): Bag<ScopedAliases<OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, K, SelectedRegistrations<K, O>>>, ServiceRegistrations, S>, WithoutExportObligations<Constraints, SelectionKey<K[number]>>>;
  /**
   * Create a tracked child with the same graph and fresh scoped acquisitions.
   * Close every scope you create, typically one per request; closing the parent closes its live scopes first.
   * @returns A child that is closed before its parent finishes closing.
   * @throws `DI_BAG_CLOSING` or `DI_BAG_CLOSED` after `close()`.
   * @example
   * ```ts
   * const app = DiBag.createBuilder().withServices({ requestId: () => Math.random() }).buildContainer();
   * const request = app.createScope();
   * const id: number = request.resolve('requestId');
   * await request.close();
   * ```
   */
  createScope(): Bag<UnsharedAliases<ServiceRegistrations>, Constraints>;
  createScope(...args: unknown[]): unknown {
    this.#runtime.assertOpen();
    const { graph, shared } = selectScope(this.#graph, args, key => this.#runtime.isTransient(key));
    return new Bag(graph, this.context, this.#runtime.scope(graph, shared));
  }

  /**
   * Create an independent bag with the same graph and fresh instances.
   * @returns A new ownership family that must be closed separately.
   * @throws `DI_BAG_CLOSING` or `DI_BAG_CLOSED` after `close()`.
   */
  fork(this: Bag<ServiceRegistrations, Constraints> & CheckedLifetimes<UnsharedAliases<ServiceRegistrations>, Constraints>): Bag<UnsharedAliases<ServiceRegistrations>, Constraints>;
  // The graph-aware bound keeps the first inference pass applicable and requires
  // selected registrations even with explicit generics. The argument's Record
  // supplies callable context; unselected keys stay outside checks and results.
  /**
   * Create an independent bag with selected replacements, the way tests substitute dependencies.
   * Each override must satisfy the original contract; close the fork, since its parent does not.
   * @param keys - Existing names or tokens to replace.
   * @param overrides - Own registration properties for every selected key.
   * @returns A fresh ownership family whose graph uses the checked replacements.
   * @throws `DI_BAG_INVALID_OVERRIDE` for an absent key or a missing own override; `DI_BAG_INVALID_TOKEN`, `DI_BAG_WRONG_TOKEN_KIND`, or `DI_BAG_INVALID_REGISTRATION`
   * for malformed input; `DI_BAG_CLOSING` or `DI_BAG_CLOSED` after `close()`; `DI_BAG_CLASSIFIER_REQUIRED` as for {@link Builder.buildContainer}.
   * @example
   * ```ts
   * type Clock = { now(): number };
   * const app = DiBag.createBuilder().withServices({ clock: (): Clock => ({ now: () => Date.now() }) }).buildContainer();
   * const test = app.fork(['clock'], { clock: (): Clock => ({ now: () => 0 }) });
   * await test.close();
   * ```
   */
  fork<
    const K extends readonly unknown[],
    O extends OverrideFactoryContext<ServiceRegistrations, K, O>,
  >(
    keys: K & Selection<ServiceRegistrations, Constraints, K>,
    overrides: O & object &
      Record<SelectionKey<K[number]>, Registration> &
      Overrides<ServiceRegistrations, ReboundSelection<ServiceRegistrations, K, SelectedRegistrations<K, O>>, K> &
      CheckDependencyCompatibility<OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, K, SelectedRegistrations<K, O>>>> &
      CheckDependencyCompleteness<OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, K, SelectedRegistrations<K, O>>>> &
      CheckedConstraints<Constraints, OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, K, SelectedRegistrations<K, O>>>> &
      CompleteConstraints<Constraints, OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, K, SelectedRegistrations<K, O>>>> &
      CheckedLifetimes<UnsharedAliases<OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, K, SelectedRegistrations<K, O>>>>, WithoutExportObligations<Constraints, SelectionKey<K[number]>>>,
  ): Bag<UnsharedAliases<OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, K, SelectedRegistrations<K, O>>>>, WithoutExportObligations<Constraints, SelectionKey<K[number]>>>;
  fork(keys?: readonly unknown[], overrides?: object): unknown {
    this.#runtime.assertOpen();
    if (keys === undefined && overrides === undefined) {
      return new Bag(this.#graph, this.context);
    }
    if (
      !Array.isArray(keys) ||
      typeof overrides !== 'object' ||
      overrides === null
    ) {
      throw libraryError('DI_BAG_INVALID_OVERRIDE', 'fork requires selected keys and an override object', { operation: 'fork' });
    }
    // Snapshot indexed entries before override getters can mutate the tuple.
    // A tuple's custom iterator need not enumerate its declared indexed keys.
    const selectedKeys: unknown[] = [];
    const length = keys.length;
    for (let index = 0; index < length; index++) {
      selectedKeys[index] = keys[index];
    }
    if (selectedKeys.length === 0) return new Bag(this.#graph, this.context);
    const graph = claimSelectedTokenKinds(this.#graph, selectedKeys, 'fork');
    const collectionKeys = new Set<BindingKey>();
    const publicKeys = selectedKeys.map(value => {
      if (typeof value === 'string') return value;
      const { key, kind } = readToken(value);
      if (kind === 'collection') collectionKeys.add(key);
      return key;
    });
    for (const key of publicKeys) {
      if (!collectionKeys.has(key) && !graph.hasPublic(key)) {
        throw libraryError('DI_BAG_INVALID_OVERRIDE', `fork accepts existing names or typed tokens only: ${String(key)}`, { operation: 'fork' });
      }
      if (!Object.hasOwn(overrides, key)) {
        throw libraryError('DI_BAG_INVALID_OVERRIDE', `missing override: ${String(key)}`, { operation: 'fork' });
      }
    }
    const selectedBindings: Array<readonly [BindingKey, Registration]> = [];
    for (const key of publicKeys) {
      const registration: unknown = Reflect.get(overrides, key);
      normalize(registration);
      selectedBindings.push([key, registration as Registration]);
    }
    return new Bag(graph.withPublicBindings(selectedBindings, 'fork'), this.context);
  }

  /**
   * Make the listed services ready before continuing, then resolve to this same bag.
   * Each listed service is acquired now, with whatever its factory reads, and the call waits until it is ready;
   * every other service stays lazy. List the services whose readiness you need before the next line runs, such as
   * a database pool or a cache client. Works on a built bag, a child scope, and a fork, and may be called again.
   * A failed factory, an aborted signal, or an elapsed deadline closes this bag: a child scope closes only itself,
   * never its parent or a service it borrows.
   * @param serviceKeys - A finite tuple of existing names or typed tokens to wait for; an empty tuple is valid.
   * @param options - An optional abort signal, a deadline for the whole call, and a bound on how many listed keys are acquired at once.
   * @returns A promise for this bag once every listed service is ready.
   * @throws {@link DiBagServiceReadinessError} (`DI_BAG_SERVICE_READINESS_FAILED`) after this bag has closed because a factory failed;
   * {@link DiBagServiceReadinessCancelledError} (`DI_BAG_SERVICE_READINESS_CANCELLED`) promptly on abort or timeout, naming what was still pending;
   * `DI_BAG_INVALID_STARTUP` for malformed keys or options and `DI_BAG_INVALID_TOKEN` or `DI_BAG_WRONG_TOKEN_KIND` for a bad token or kind, all before any factory runs and with this bag left open;
   * `DI_BAG_CLOSING` or `DI_BAG_CLOSED` after `close()`. Each arrives as a rejection.
   * @example
   * ```ts
   * const bag = await DiBag.createBuilder()
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
   * Close this bag, drain in-flight work, and dispose owned resources once.
   * Dependents are disposed before dependencies; remaining independent acquisitions use
   * reverse acquisition order. Without options the promise waits for cleanup however long it
   * takes, and repeated calls return the same promise. With `waitTimeoutMs` or `abortSignal`, cleanup
   * starts the same way but the returned promise stops waiting when either fires; scopes and
   * forks accept the same options. Close every scope and fork you create; a parent closes its live scopes, never forks.
   * @param options - An optional deadline and abort signal bounding the wait, not the cleanup.
   * @returns The shared shutdown promise, or a bounded wait on it when options are given.
   * @throws {@link DiBagCleanupError} (`DI_BAG_CLEANUP_FAILED`) when one or more disposers fail after all cleanup is attempted;
   * `DI_BAG_CLOSE_FAILED` for other shutdown failures;
   * {@link DiBagCloseCancelledError} (`DI_BAG_CLOSE_TIMEOUT` or `DI_BAG_CLOSE_ABORTED`) when the wait stops first,
   * naming unfinished disposers in `details.disposersStillRunning`; `DI_BAG_INVALID_CLOSE` for malformed options.
   * @example
   * ```ts
   * const bag = DiBag.createBuilder().withServices({ value: () => 1 }).buildContainer();
   * await bag.close({ waitTimeoutMs: 10_000, abortSignal: AbortSignal.timeout(15_000) });
   * ```
   */
  close(options?: CloseOptions): Promise<void> {
    return closeRuntime(this.#runtime, options);
  }
}

/**
 * An immutable, type-checked graph builder. Every operation returns a new builder.
 * Create one with {@link DiBagApi.createBuilder}. The same builder value can
 * {@link Builder.buildContainer} a bag once its graph is complete, or
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
   * const builder = DiBag.createBuilder()
   *   .withServices({ clock: (): Clock => ({ now: () => Date.now() }) })
   *   .withServices({ stamp: ({ clock }: { clock: Clock }) => clock.now() });
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
   * const builder = DiBag.createBuilder()
   *   .withServices({ clock: () => Date.now() })
   *   .withServiceAlias({ aliasKey: 'now', targetServiceKey: 'clock' });
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
   * const builder = DiBag.createBuilder()
   *   .withCollectionContribution({ collectionToken: tools, provider: () => 'search' })
   *   .withCollectionContribution({ collectionToken: tools, provider: () => 'fetch' });
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
   * const builder = DiBag.createBuilder()
   *   .withServices({ clock: () => Date.now() })
   *   .withReplacedService('clock', () => 0);
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
   * const greeting = DiBag.createBuilder()
   *   .withServices({ greet: ({ name }: { name: string }) => `hello, ${name}` })
   *   .buildModule({ exportedServiceKeys: ['greet'] });
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
   * each installation names its private bindings `<moduleLabel>/<key>` in error messages, cycle paths, `inspectGraph()`, and observer events.
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
   * // Errors and inspectGraph() name the private binding 'orders/repository'.
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
  buildContainer(this: Builder<Entries, Constraints> & CheckDependencyCompleteness<RegistrationsFromEntries<Entries>> & CompleteConstraints<Constraints, RegistrationsFromEntries<Entries>> & CheckedLifetimes<RegistrationsFromEntries<Entries>, Constraints>): Bag<RegistrationsFromEntries<Entries>, Constraints> {
    return new Bag(this.#graph, this.context);
  }

}

export type { Bag, Builder };

/**
 * Immutable facade configuration. Observers append in the supplied order.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#observe-lifecycle-transitions
 */
export interface ConfigurationOptions {
  readonly runtime?: RuntimeOptions;
  readonly observers?: readonly ObserverOptions[];
}
/**
 * The immutable public entry surface used by {@link DiBag} and derived facades.
 * @see https://dany-fedorov.github.io/di-bag/agent/api-card.html#dibag-facade
 */
export interface DiBagApi {
  /**
   * Return a facade with inherited runtime settings and appended observers.
   * @throws `DI_BAG_INVALID_CONFIGURATION` for a non-object, a runtime without `isNativePromise`, or malformed observers.
   * @example
   * ```ts
   * const Observed = DiBag.withConfiguration({
   *   observers: [{ onEvent: event => console.log(event.kind), onError: failure => console.error(failure.error) }],
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
   * Begin an empty immutable graph; `buildContainer` creates its owning bag, `buildModule` seals a reusable module.
   * @example
   * ```ts
   * const bag = DiBag.createBuilder().withServices({ greeting: () => 'hello' }).buildContainer();
   * ```
   */
  createBuilder: () => Builder<never>;
  /**
   * Make the bag own a factory's value and run `dispose` on it when the bag closes.
   * `close()` runs disposers, dependents first; close every scope and fork you create.
   * @throws `DI_BAG_INVALID_REGISTRATION` when the registration is neither a function nor a provider.
   * @example
   * ```ts
   * const bag = DiBag.createBuilder()
   *   .withServices({ controller: DiBag.withDisposal(() => new AbortController(), controller => controller.abort()) })
   *   .buildContainer();
   * await bag.close();
   * ```
   */
  withDisposal: typeof withDisposal;
  /**
   * Select `root`, `scoped` (the default), or `transient` caching for a registration.
   * Mark a shared client `root` only when nothing it depends on is scoped.
   * @throws `DI_BAG_INVALID_LIFETIME` for an unknown lifetime or malformed options; `DI_BAG_INVALID_REGISTRATION` for an invalid registration.
   * @example
   * ```ts
   * const bag = DiBag.createBuilder()
   *   .withServices({ cache: DiBag.withLifetime(() => new Map<string, string>(), 'root') })
   *   .buildContainer();
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
    if (typeof options !== 'object' || options === null || Array.isArray(options)) throw libraryTypeError('DI_BAG_INVALID_CONFIGURATION', 'withConfiguration requires an options object', { operation: 'withConfiguration' });
    const { runtime, observers } = options;
    let configured = runtime === undefined ? context : runtimeContext(runtime, context);
    if (observers !== undefined) {
      if (!Array.isArray(observers)) throw libraryTypeError('DI_BAG_INVALID_CONFIGURATION', 'withConfiguration observers must be an array', { operation: 'withConfiguration' });
      for (const observer of observers) configured = Object.freeze({ ...configured, observers: LifecycleObservers.append(configured.observers, observer) });
    }
    return facade(configured);
  },
  fromFactory, fromSyncFactory, fromAsyncFactory, token, optional, lazy, fromPlugin, fromFunction, fromClass,
  createBuilder: (): Builder<never> => new Builder(new BindingGraph(), context),
  withDisposal, withLifetime, withMetadata, transformService,
}); }
/**
 * The immutable DI Bag facade. `auto` acquisition uses the host classifier where `process.getBuiltinModule`
 * exists; elsewhere wrap factories with `fromSyncFactory` and `fromAsyncFactory`, use explicit modes, or configure a classifier.
 */
export const DiBag: DiBagApi = facade(unconfigured);
