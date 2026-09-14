import { libraryError, libraryTypeError } from './errors';
import { LifecycleObservers } from './observers';
import type { ObserverOptions } from './observers';
import { contributionEntry } from './contributions';
import type { BuilderContribute, CollectionMember } from './contribution-types';
import { aliasEntry } from './aliases';
import type { AliasSelection, AliasAdmission, AliasTarget, AliasDestination, AliasEntry, AliasEntries } from './alias-types';
import { optional, lazy, all } from './dependency-references';
import { normalize, snapshotAdd, withDisposal } from './registration';
import type { FactoryWithDisposal, Factory, Registration, Registrations } from './registration';
import { BindingGraph, BagRuntime } from './runtime';
import type { BindingKey } from './runtime';
import { moduleGraph, sealModule } from './module';
import type { Module, ModuleOptions } from './module';
import type { CompositionReport } from './composition-report';
import type { CheckedConstraints, CompleteConstraints, ExternalRequirements, IncrementalConstraints, ModulePublicProviders, ModuleSealedConstraints, NeedConstraint } from './module-types';
import type { CheckedLifetimes, SealAdmission, WithoutExportObligations } from './lifetime-types';
import { withLifetime } from './lifetime';
import { fromFactory } from './acquisition-context';
import { closeRuntime, startRuntime } from './startup';
import { selectScope } from './scope-selection';
import type { ScopeOptions, DisjointScopeSelection, UnsharedAliases, ScopedAliases } from './scope-types';
import type { CheckedScopeLifetimes } from './lifetime-types';
import type { CloseOptions, StartupOptions } from './startup';
import { withMetadata, transformService, withTokenBinding } from './provider';
import { fromFunction, fromClass } from './composition';
import { runtimeContext, unconfigured } from './acquisition-mode';
import type { RuntimeContext, RuntimeOptions } from './acquisition-mode';
import type { ProviderRegistrationMetadata, ProviderAcquisitionMetadata } from './provider';
import type { GraphSnapshot, RegistrationSnapshot } from './inspection';
import { token, readTokenKey } from './tokens';
import { fromPlugin } from './plugins';
import type { PluginProviderFactory } from './plugins';
import type { TokenBase, TokenKey, TokenService } from './tokens';
import type { TokenBinding, BindingOutput, TokenMember, TokenTupleAdmission, SelectionKey, ReboundSelection } from './token-types';
import type { BuilderReplacementRegistration, ReplacementAdmission, ReplacedEntries, ZeroDependencyAdmission } from './replacement-types';
import type {
  CheckDependencyCompatibility,
  CheckDependencyCompleteness,
  RegistrationEntries,
  Entry,
  EntryKeys,
  ExportedServices,
  OverrideFactoryContext,
  RegistrationsFromEntries,
  IncrementalChecked,
  Introduces,
  IntroducesKeys,
  OverrideRegistrations,
  Overrides,
  ServicesOf,
  ReplacementKeyOf,
  ReplacementOutput,
  SelectedRegistrations,
  Selection,
  NamedAdmission,
  ThenableAdmission,
} from './types';

type ReplacementFactory<O> = (this: void) => O;

// A public member under an unexported symbol retains its type in .d.ts output;
// TypeScript strips the types of ordinary private fields during declaration emit.
declare const constraintInvariant: unique symbol;

/**
 * A resolving container with lazy acquisition, caching, and independent resource ownership.
 *
 * Create bags through {@link DiBagApi.createBuilder} followed by {@link Builder.build} or
 * {@link Builder.buildAndStart}; the class is exported as a type and has no public constructor.
 * @see https://dany-fedorov.github.io/di-bag/agent/api-card.html#bag
 */
class Bag<R extends Registrations, C extends NeedConstraint = never> {
  /** @internal */
  declare readonly [constraintInvariant]: (value: C) => C;
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
   * Resolve a named or typed-token service, acquiring it lazily when needed.
   * Scoped and root services are cached according to their lifetime; transient services
   * create a new acquisition for each call. Promise-valued services keep their identity.
   * An async factory's service is its Promise; nothing is awaited for you.
   * @param token - An existing public string name or typed token.
   * @returns The service exposed by the selected registration.
   * @throws `DI_BAG_CLOSING` or `DI_BAG_CLOSED` after `close()`; `DI_BAG_INVALID_TOKEN` or `DI_BAG_MISSING_REGISTRATION` for a bad selection;
   * during acquisition `DI_BAG_MISSING_DEPENDENCY`, `DI_BAG_CYCLE`, `DI_BAG_LIFETIME_DEPENDENCY`, `DI_BAG_INVALID_DEPENDENCY_ACCESS`,
   * `DI_BAG_STRUCTURAL_THENABLE`, `DI_BAG_INVALID_CLASSIFIER_RESULT`, `DI_BAG_INVALID_METADATA`, `DI_BAG_PLUGIN_VALIDATION`,
   * or the factory's own error.
   * @example
   * ```ts
   * const bag = DiBag.createBuilder().register({ greeting: () => 'hello' }).build();
   * const greeting: string = bag.resolve('greeting');
   * ```
   */
  resolve<K extends (keyof R & string) | TokenBase>(token: K & ([K] extends [string] ? unknown : TokenMember<R, K>)): ServicesOf<R>[SelectionKey<K> & keyof R];
  resolve(token: unknown): unknown {
    return this.#runtime.resolve(typeof token === 'string' ? token : readTokenKey(token));
  }

  /**
   * Resolve every contribution for a typed token in declaration and installation order.
   * @param token - The collection token whose contributions to acquire.
   * @returns A fresh frozen array; an unpopulated collection returns an empty array.
   * @throws `DI_BAG_CLOSING` or `DI_BAG_CLOSED` after `close()`; `DI_BAG_INVALID_TOKEN` for a bad token;
   * a contribution's acquisition errors as listed for {@link Bag.resolve}.
   * @example
   * ```ts
   * const toolsKey = Symbol('tools');
   * const tools = DiBag.token(toolsKey).of<string>();
   * const bag = DiBag.createBuilder().contribute(tools, () => 'search').contribute(tools, () => 'fetch').build();
   * const names: readonly string[] = bag.resolveAll(tools);
   * ```
   */
  resolveAll<T extends TokenBase>(token: T & TokenTupleAdmission<readonly [T]> & CollectionMember<T, C>,
    ...invalid: [T] extends [never] ? [never] : []): ReadonlyArray<TokenService<T>>;
  resolveAll(token: unknown): readonly unknown[] { return this.#runtime.resolveAll(readTokenKey(token)); }

  /**
   * Inspect every contribution for a token without running its factories.
   * @param token - The collection token to inspect.
   * @returns Frozen snapshots in contribution order.
   * @throws `DI_BAG_INVALID_TOKEN` for a bad token.
   * @example
   * ```ts
   * const toolsKey = Symbol('tools');
   * const tools = DiBag.token(toolsKey).of<string>();
   * const bag = DiBag.createBuilder().contribute(tools, () => 'search').build();
   * const labels = bag.inspectAll(tools).map(snapshot => snapshot.label);
   * ```
   */
  inspectAll<T extends TokenBase>(token: T & TokenTupleAdmission<readonly [T]> & CollectionMember<T, C>,
    ...invalid: [T] extends [never] ? [never] : []): readonly RegistrationSnapshot<object, readonly unknown[]>[];
  inspectAll(token: unknown): readonly RegistrationSnapshot<object, readonly unknown[]>[] { return this.#runtime.inspectAll(readTokenKey(token)); }

  /**
   * Inspect static metadata and copied acquisition state without resolving a service.
   * @param token - An existing public string name or typed token.
   * @returns A frozen point-in-time snapshot. Application-owned metadata payloads are not frozen.
   * @throws `DI_BAG_INVALID_TOKEN` or `DI_BAG_MISSING_REGISTRATION` for a bad selection; `DI_BAG_CYCLE` for an alias cycle.
   * @example
   * ```ts
   * const bag = DiBag.createBuilder().register({ greeting: () => 'hello' }).build();
   * const acquired = bag.inspect('greeting').acquisitions.length;
   * ```
   */
  inspect<K extends (keyof R & string) | TokenBase>(token: K & ([K] extends [string] ? unknown : TokenMember<R, K>)): RegistrationSnapshot<ProviderRegistrationMetadata<R[SelectionKey<K> & keyof R]>, ProviderAcquisitionMetadata<R[SelectionKey<K> & keyof R]>>;
  inspect(token: unknown): unknown {
    return this.#runtime.inspect(typeof token === 'string' ? token : readTokenKey(token));
  }

  /**
   * Describe every binding this bag can resolve and the dependency edges observed so far.
   * Nothing is acquired. Named dependencies declared on factory parameters are not visible
   * until the factory runs; the static graph tool reports them from source.
   * @returns A frozen point-in-time snapshot; application-owned metadata payloads are not frozen.
   * @example
   * ```ts
   * const bag = DiBag.createBuilder().register({ greeting: () => 'hello' }).build();
   * const labels = bag.inspectGraph().bindings.map(binding => binding.label);
   * ```
   */
  inspectGraph(): GraphSnapshot { return this.#runtime.inspectGraph(); }

  /**
   * Create a tracked child that borrows selected parent acquisitions.
   * @param options - A checked selection of non-transient services to share lazily.
   * @returns A child owned by this bag; closing the parent closes the child first.
   * @throws `DI_BAG_INVALID_SCOPE` for a malformed or transient share selection; `DI_BAG_INVALID_TOKEN` for a bad token;
   * `DI_BAG_CLOSING` or `DI_BAG_CLOSED` after `close()`.
   */
  createScope<const S extends readonly unknown[]>(options: ScopeOptions<R, S>): Bag<ScopedAliases<R, R, S>, C>;
  /**
   * Create a tracked child with selected replacements and optional parent sharing.
   * @param keys - Existing names or tokens to replace in the child.
   * @param overrides - Own registration properties for every selected key.
   * @param options - A disjoint selection of non-transient parent acquisitions to share.
   * @returns A child with fresh scoped acquisitions and ownership for unshared services.
   * @throws `DI_BAG_INVALID_SCOPE` for invalid selections, overrides, or sharing; `DI_BAG_INVALID_TOKEN` or `DI_BAG_INVALID_REGISTRATION`
   * for malformed input; `DI_BAG_CLOSING` or `DI_BAG_CLOSED` after `close()`; `DI_BAG_CLASSIFIER_REQUIRED` as for {@link Builder.build}.
   */
  createScope<
    const K extends readonly unknown[],
    O extends OverrideFactoryContext<R, K, O>,
    const S extends readonly unknown[] = readonly [],
  >(
    keys: K & Selection<R, K, 'createScope'>,
    overrides: O & object & Record<SelectionKey<K[number]>, Registration> &
      Overrides<R, SelectedRegistrations<K, O>> &
      CheckDependencyCompatibility<OverrideRegistrations<R, ReboundSelection<R, SelectedRegistrations<K, O>>>> &
      CheckDependencyCompleteness<OverrideRegistrations<R, ReboundSelection<R, SelectedRegistrations<K, O>>>> &
      CheckedConstraints<C, OverrideRegistrations<R, ReboundSelection<R, SelectedRegistrations<K, O>>>> &
      CompleteConstraints<C, OverrideRegistrations<R, ReboundSelection<R, SelectedRegistrations<K, O>>>> &
      CheckedScopeLifetimes<NoInfer<ScopedAliases<OverrideRegistrations<R, ReboundSelection<R, SelectedRegistrations<K, O>>>, R, S>>, NoInfer<SelectedRegistrations<K, O>>, WithoutExportObligations<C, SelectionKey<K[number]>>>,
    options?: ScopeOptions<R, S> & DisjointScopeSelection<K, S>,
  ): Bag<ScopedAliases<OverrideRegistrations<R, ReboundSelection<R, SelectedRegistrations<K, O>>>, R, S>, WithoutExportObligations<C, SelectionKey<K[number]>>>;
  /**
   * Create a tracked child with the same graph and fresh scoped acquisitions.
   * Close every scope you create, typically one per request; closing the parent closes its live scopes first.
   * @returns A child that is closed before its parent finishes closing.
   * @throws `DI_BAG_CLOSING` or `DI_BAG_CLOSED` after `close()`.
   * @example
   * ```ts
   * const app = DiBag.createBuilder().register({ requestId: () => Math.random() }).build();
   * const request = app.createScope();
   * const id: number = request.resolve('requestId');
   * await request.close();
   * ```
   */
  createScope(): Bag<UnsharedAliases<R>, C>;
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
  fork(this: Bag<R, C> & CheckedLifetimes<UnsharedAliases<R>, C>): Bag<UnsharedAliases<R>, C>;
  // The graph-aware bound keeps the first inference pass applicable and requires
  // selected registrations even with explicit generics. The argument's Record
  // supplies callable context; unselected keys stay outside checks and results.
  /**
   * Create an independent bag with selected replacements, the way tests substitute dependencies.
   * Each override must satisfy the original contract; close the fork, since its parent does not.
   * @param keys - Existing names or tokens to replace.
   * @param overrides - Own registration properties for every selected key.
   * @returns A fresh ownership family whose graph uses the checked replacements.
   * @throws `DI_BAG_INVALID_OVERRIDE` for an absent key or a missing own override; `DI_BAG_INVALID_TOKEN` or `DI_BAG_INVALID_REGISTRATION`
   * for malformed input; `DI_BAG_CLOSING` or `DI_BAG_CLOSED` after `close()`; `DI_BAG_CLASSIFIER_REQUIRED` as for {@link Builder.build}.
   * @example
   * ```ts
   * type Clock = { now(): number };
   * const app = DiBag.createBuilder().register({ clock: (): Clock => ({ now: () => Date.now() }) }).build();
   * const test = app.fork(['clock'], { clock: (): Clock => ({ now: () => 0 }) });
   * await test.close();
   * ```
   */
  fork<
    const K extends readonly unknown[],
    O extends OverrideFactoryContext<R, K, O>,
  >(
    keys: K & Selection<R, K>,
    overrides: O &
      object &
      Record<SelectionKey<K[number]>, Registration> &
      Overrides<R, SelectedRegistrations<K, O>> &
      CheckDependencyCompatibility<OverrideRegistrations<R, ReboundSelection<R, SelectedRegistrations<K, O>>>> &
      CheckDependencyCompleteness<OverrideRegistrations<R, ReboundSelection<R, SelectedRegistrations<K, O>>>> &
      CheckedConstraints<C, OverrideRegistrations<R, ReboundSelection<R, SelectedRegistrations<K, O>>>> &
      CompleteConstraints<C, OverrideRegistrations<R, ReboundSelection<R, SelectedRegistrations<K, O>>>> &
      CheckedLifetimes<UnsharedAliases<OverrideRegistrations<R, ReboundSelection<R, SelectedRegistrations<K, O>>>>, WithoutExportObligations<C, SelectionKey<K[number]>>>,
  ): Bag<UnsharedAliases<OverrideRegistrations<R, ReboundSelection<R, SelectedRegistrations<K, O>>>>, WithoutExportObligations<C, SelectionKey<K[number]>>>;
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
    const publicKeys = selectedKeys.map(value => typeof value === 'string' ? value : readTokenKey(value));
    for (const token of publicKeys) {
      if (!this.#graph.hasPublic(token)) {
        throw libraryError('DI_BAG_INVALID_OVERRIDE', `fork accepts existing names or typed tokens only: ${String(token)}`, { operation: 'fork' });
      }
      if (!Object.hasOwn(overrides, token)) {
        throw libraryError('DI_BAG_INVALID_OVERRIDE', `missing override: ${String(token)}`, { operation: 'fork' });
      }
    }
    const selectedBindings: Array<readonly [BindingKey, Registration]> = [];
    for (const token of publicKeys) {
      const registration: unknown = Reflect.get(overrides, token);
      normalize(registration);
      selectedBindings.push([token, registration as Registration]);
    }
    return new Bag(this.#graph.withPublicBindings(selectedBindings), this.context);
  }

  /**
   * Close this bag, drain in-flight work, and dispose owned resources once.
   * Dependents are disposed before dependencies; remaining independent acquisitions use
   * reverse acquisition order. Without options the promise waits for cleanup however long it
   * takes, and repeated calls return the same promise. With `timeoutMs` or `signal`, cleanup
   * starts the same way but the returned promise stops waiting when either fires; scopes and
   * forks accept the same options. Close every scope and fork you create; a parent closes its live scopes, never forks.
   * @param options - An optional deadline and abort signal bounding the wait, not the cleanup.
   * @returns The shared shutdown promise, or a bounded wait on it when options are given.
   * @throws {@link DiBagCleanupError} (`DI_BAG_CLEANUP_FAILED`) when one or more disposers fail after all cleanup is attempted;
   * `DI_BAG_CLOSE_FAILED` for other shutdown failures;
   * {@link DiBagCloseCancelledError} (`DI_BAG_CLOSE_TIMEOUT` or `DI_BAG_CLOSE_ABORTED`) when the wait stops first,
   * naming unfinished disposers in `details.pending`; `DI_BAG_INVALID_CLOSE` for malformed options.
   * @example
   * ```ts
   * const bag = DiBag.createBuilder().register({ value: () => 1 }).build();
   * await bag.close({ timeoutMs: 10_000, signal: AbortSignal.timeout(15_000) });
   * ```
   */
  close(options?: CloseOptions): Promise<void> {
    return closeRuntime(this.#runtime, options);
  }
}

/**
 * An immutable, type-checked graph builder. Every operation returns a new builder.
 * Create one with {@link DiBagApi.createBuilder}. The same builder value can
 * {@link Builder.build} a bag once its graph is complete, or
 * {@link Builder.buildModule} a reusable module whose unmet dependencies become
 * requirements the installing host must satisfy.
 * @see https://dany-fedorov.github.io/di-bag/agent/api-card.html#builder
 */
class Builder<E extends Entry, C extends NeedConstraint = never> {
  // Preserve accepted registration history and module constraints through views.
  /** @internal */
  declare readonly [constraintInvariant]:
    (value: readonly [E, C]) => readonly [E, C];
  readonly #graph: BindingGraph;

  constructor(graph: BindingGraph, private readonly context: RuntimeContext) {
    this.#graph = graph;
  }

  // Infer actual keys before checking context-sensitive method-returning factories.
  // Defer named admission until N is inferred, so trying this overload for a
  // token registration does not project the entire retained history.
  /**
   * Add new string-named registrations.
   * A factory declares its dependencies in the type of its one object parameter; destructure it or read `deps.name`, never spread it.
   * @param more - A finite object whose own string keys are service names and values are registrations.
   * @returns A new builder containing snapshots of the supplied registrations.
   * @throws `DI_BAG_INVALID_REGISTRATION` for a malformed object or value; `DI_BAG_DUPLICATE_REGISTRATION` for a name already registered.
   * @example
   * ```ts
   * type Clock = { now(): number };
   * const builder = DiBag.createBuilder()
   *   .register({ clock: (): Clock => ({ now: () => Date.now() }) })
   *   .register({ stamp: ({ clock }: { clock: Clock }) => clock.now() });
   * ```
   */
  register<N extends { [K in keyof N]: Registration }>(
    more: N & Registrations & ([N] extends [never]
      ? never
      : NamedAdmission<N> & ThenableAdmission<N> & IntroducesKeys<EntryKeys<E>, keyof N> & IncrementalChecked<E, N> &
        CheckedConstraints<C, OverrideRegistrations<RegistrationsFromEntries<E>, N>>),
  ): Builder<E | RegistrationEntries<N>, C>;
  /**
   * Register a provider to a typed token.
   * @param token - A new typed token identity.
   * @param registration - A registration whose exposed output satisfies the token service type.
   * @returns A new builder retaining the provider's metadata, lifetime, dependencies, and ownership stages.
   * @throws `DI_BAG_INVALID_TOKEN` for a bad token; `DI_BAG_DUPLICATE_REGISTRATION` when it is already registered;
   * `DI_BAG_INVALID_REGISTRATION` for an invalid registration.
   */
  register<T extends TokenBase, V extends Registration>(
    token: T & TokenTupleAdmission<readonly [T]> & IntroducesKeys<EntryKeys<E>, TokenKey<T>>,
    registration: V & Registration & BindingOutput<NoInfer<T>, NoInfer<V>> & ThenableAdmission<Record<TokenKey<T>, NoInfer<V>>> &
      IncrementalChecked<E, Record<TokenKey<T>, TokenBinding<NoInfer<T>, NoInfer<V>>>> &
      CheckedConstraints<C, OverrideRegistrations<RegistrationsFromEntries<E>, Record<TokenKey<T>, TokenBinding<NoInfer<T>, NoInfer<V>>>>>,
  ): Builder<E | { key: TokenKey<T>; registration: TokenBinding<T, V> }, C>;
  register(moreOrToken: unknown, registration?: Registration): unknown {
    if (arguments.length === 1) {
      const snapshot = snapshotAdd(moreOrToken, key => this.#graph.hasPublic(key));
      return new Builder(this.#graph.withPublicRegistrations(snapshot), this.context);
    }
    const key = readTokenKey(moreOrToken);
    if (this.#graph.hasPublic(key)) throw libraryError('DI_BAG_DUPLICATE_REGISTRATION', `duplicate registration: ${String(key)}`, { operation: 'register', key });
    return new Builder(this.#graph.withPublicBinding(key, withTokenBinding(moreOrToken as never, registration as never)), this.context);
  }

  /**
   * Add another lookup name or token for an existing service.
   * @param destination - A new string name or typed token.
   * @param target - The existing name or token whose canonical acquisition is reused.
   * @returns A new builder; aliases add no cache or ownership of their own.
   * @throws `DI_BAG_INVALID_TOKEN` for a bad token; `DI_BAG_DUPLICATE_REGISTRATION` when the destination exists;
   * `DI_BAG_INVALID_ALIAS` for an absent named target.
   * @example
   * ```ts
   * const builder = DiBag.createBuilder().register({ clock: () => Date.now() }).alias('now', 'clock');
   * ```
   */
  alias<const D extends AliasSelection, const T extends AliasSelection>(
    destination: D & (unknown extends AliasAdmission<D> ? Introduces<RegistrationsFromEntries<E>, AliasEntries<RegistrationsFromEntries<E>, D, T>> : AliasAdmission<D>),
    target: T & AliasAdmission<T> & (unknown extends AliasAdmission<T>
      ? AliasTarget<RegistrationsFromEntries<E>, T> & AliasDestination<RegistrationsFromEntries<E>, NoInfer<D>, T> : unknown) &
      (unknown extends AliasAdmission<D> & AliasAdmission<T>
        ? IncrementalChecked<E, AliasEntries<RegistrationsFromEntries<E>, NoInfer<D>, NoInfer<T>>> & CheckedConstraints<C, OverrideRegistrations<RegistrationsFromEntries<E>, AliasEntries<RegistrationsFromEntries<E>, NoInfer<D>, NoInfer<T>>>> : unknown),
    ...invalid: [D] extends [never] ? [never] : [T] extends [never] ? [never] : []
  ): Builder<E | AliasEntry<RegistrationsFromEntries<E>, D, T>, C> {
    const [key, registration] = aliasEntry(destination, target, key => this.#graph.hasPublic(key));
    return new Builder(this.#graph.withPublicBinding(key, registration), this.context);
  }

  /**
   * Append a provider to a typed-token collection.
   * @param token - The collection's typed token.
   * @param registration - A registration whose output satisfies the token service type.
   * @returns A new builder preserving contribution order.
   * @throws `DI_BAG_INVALID_TOKEN` for a bad token; `DI_BAG_INVALID_REGISTRATION` for an invalid registration.
   * @example
   * ```ts
   * const toolsKey = Symbol('tools');
   * const tools = DiBag.token(toolsKey).of<string>();
   * const builder = DiBag.createBuilder().contribute(tools, () => 'search').contribute(tools, () => 'fetch');
   * ```
   */
  // A named callable keeps extracted generic methods nameable in consumer declarations.
  readonly contribute: BuilderContribute<E, C> = ((token: unknown, registration: Registration) => {
    const [key, value] = contributionEntry(token, registration);
    return new Builder(this.#graph.withContribution(key, value), this.context);
  }) as BuilderContribute<E, C>;



  // ZeroDependencyAdmission proves empty needs, while ReplacementOutput proves
  // every surviving consumer requirement. Repeating
  // IncrementalChecked here only rescans accepted history. The general overload
  // retains full checks for parameters, mixed registrations and explicit K,V.
  // Keep the fixed history out of replacement-factory inference with NoInfer.
  /**
   * Replace an existing string-named registration with a dependency-free factory.
   * @param key - One existing string-literal service name.
   * @param registration - The replacement, checked against every surviving consumer.
   * @returns A new builder with the replacement.
   * @typeParam V - The exact replacement factory or disposable-factory type.
   * @throws `DI_BAG_INVALID_REPLACEMENT` for an absent key; `DI_BAG_INVALID_REGISTRATION` for an invalid registration.
   * @example
   * ```ts
   * const builder = DiBag.createBuilder().register({ clock: () => Date.now() }).replace('clock', () => 0);
   * ```
   */
  replace<const K extends string, V extends (ReplacementFactory<ReplacementOutput<NoInfer<RegistrationsFromEntries<E>>, K, C>>) | FactoryWithDisposal<ReplacementFactory<ReplacementOutput<NoInfer<RegistrationsFromEntries<E>>, K, C>>>>(
    key: K & ReplacementKeyOf<EntryKeys<E>, K>,
    registration: V & (Factory | FactoryWithDisposal<Factory>) & ZeroDependencyAdmission<NoInfer<V>> &
      CheckedConstraints<C, OverrideRegistrations<RegistrationsFromEntries<E>, Record<K, NoInfer<V>>>>,
  ): Builder<Exclude<E, { key: K }> | { key: K; registration: V }, WithoutExportObligations<C, K>>;
  /**
   * Replace an existing named or typed-token registration.
   * @param key - The single existing name or token to replace.
   * @param registration - A replacement compatible with the token and known consumers.
   * @returns A new builder with the replacement and its inferred service type.
   * @throws `DI_BAG_INVALID_REPLACEMENT` for an absent key; `DI_BAG_INVALID_TOKEN` or `DI_BAG_INVALID_REGISTRATION` for malformed input.
   */
  replace<const K extends string | TokenBase, V extends Registration>(
    key: K & NoInfer<ReplacementAdmission<RegistrationsFromEntries<E>, K>>,
    registration: V & Registration & BuilderReplacementRegistration<E, C, NoInfer<K>, V>,
  ): Builder<ReplacedEntries<E, K, V>, WithoutExportObligations<C, SelectionKey<K>>>;
  replace(selection: string | TokenBase, registration: Registration): unknown {
    const key = typeof selection === 'string' ? selection : readTokenKey(selection);
    if (!this.#graph.hasPublic(key)) {
      throw libraryError('DI_BAG_INVALID_REPLACEMENT', `replace accepts existing names or typed tokens only: ${String(key)}`, { operation: 'replace', key });
    }
    normalize(registration);
    return new Builder(this.#graph.withPublicBinding(key, registration), this.context);
  }

  /**
   * Install a sealed module, allocating fresh private bindings for this installation.
   * The installing host must register every requirement the module does not register itself.
   * @param module - A module whose public names do not collide and whose external requirements remain checkable.
   * @returns A new builder exposing only the module's selected exports.
   * @throws `DI_BAG_INVALID_MODULE` for a value not made by `buildModule`; `DI_BAG_DUPLICATE_REGISTRATION` when an export name is already registered.
   * @example
   * ```ts
   * const greeting = DiBag.createBuilder()
   *   .register({ greet: ({ name }: { name: string }) => `hello, ${name}` })
   *   .buildModule(['greet']);
   * const bag = DiBag.createBuilder().installModule(greeting).register({ name: () => 'Ada' }).build();
   * ```
   */
  installModule<P extends object, R extends object, MC extends NeedConstraint, D extends Registrations>(
    module: Module<P, R, MC, D> & IntroducesKeys<EntryKeys<E>, keyof D> &
      IncrementalChecked<E, D> &
      IncrementalConstraints<C, MC, RegistrationsFromEntries<E>, D>,
  ): Builder<E | RegistrationEntries<D>, C | MC> {
    return new Builder(this.#graph.withInstallation(moduleGraph(module)), this.context);
  }

  /**
   * Report at the type level why this graph would not build; the runtime call does nothing.
   * Write `builder.verifyGraph() satisfies void;` so a rejected graph fails on that line with
   * the complete message and details, instead of at the start of the builder expression.
   * @returns `void` for a buildable graph; otherwise the failure that `build()` would report.
   * @example
   * ```ts
   * const builder = DiBag.createBuilder().register({ greeting: () => 'hello' });
   * builder.verifyGraph() satisfies void;
   * ```
   */
  // A generic `this` keeps the report out of every builder instantiation (about 11k fewer instantiations per 100 calls).
  verifyGraph<Self extends Builder<E, C>>(this: Self): CompositionReport<Self>;
  verifyGraph(): unknown { return undefined; }

  /**
   * Seal this graph as a reusable module and select its public names and typed tokens.
   * Unselected registrations stay private to each installation; unmet dependencies
   * become requirements of the module. Installed modules nest: their private
   * bindings and retained constraints are re-scoped inside this module.
   * @param keys - A finite tuple of existing names or tokens; an empty tuple is allowed.
   * @param options - An optional `label`; each installation names its private bindings `<label>/<key>` in
   * error messages, cycle paths, `inspectGraph()`, and observer events, and nested labels compose as `outer/inner/key`.
   * @returns An immutable module that can be renamed or installed in another builder.
   * @throws `DI_BAG_INVALID_EXPORT` if the selection is not a tuple, contains an absent name or token, or the label is not a non-empty string;
   * `DI_BAG_INVALID_TOKEN` for a value that is not a genuine token.
   * @example
   * ```ts
   * const orders = DiBag.createBuilder()
   *   .register({ repository: () => new Map<string, number>() })
   *   .register({ placeOrder: ({ repository }: { repository: Map<string, number> }) => (id: string) => repository.set(id, 1) })
   *   .buildModule(['placeOrder'], { label: 'orders' });
   * // Errors and inspectGraph() name the private binding 'orders/repository'.
   * const app = DiBag.createBuilder().installModule(orders).build();
   * ```
   */
  buildModule<const K extends readonly unknown[]>(
    keys: K & Selection<RegistrationsFromEntries<E>, K, 'buildModule'> & SealAdmission<RegistrationsFromEntries<E>, Extract<SelectionKey<K[number]>, keyof RegistrationsFromEntries<E>>, C>,
    options?: ModuleOptions,
  ): Module<
    ExportedServices<ServicesOf<RegistrationsFromEntries<E>>, Extract<SelectionKey<K[number]>, keyof RegistrationsFromEntries<E>>>,
    ExternalRequirements<ModuleSealedConstraints<E, C, Extract<SelectionKey<K[number]>, keyof RegistrationsFromEntries<E>>>>,
    ModuleSealedConstraints<E, C, Extract<SelectionKey<K[number]>, keyof RegistrationsFromEntries<E>>>,
    ModulePublicProviders<RegistrationsFromEntries<E>, Extract<SelectionKey<K[number]>, keyof RegistrationsFromEntries<E>>>
  > {
    return sealModule(this.#graph, keys, options) as never;
  }

  /**
   * Finish a complete graph as a lazy bag.
   * The bag owns what it acquires; close it when done.
   * @returns A fresh bag that owns the acquisitions it creates.
   * @throws `DI_BAG_CLASSIFIER_REQUIRED` when a registration uses `auto` acquisition, the facade has no Promise
   * classifier, and the host has no `process.getBuiltinModule`.
   * @example
   * ```ts
   * const bag = DiBag.createBuilder().register({ greeting: () => 'hello' }).build();
   * await bag.close();
   * ```
   */
  build(this: Builder<E, C> & CheckDependencyCompleteness<RegistrationsFromEntries<E>> & CompleteConstraints<C, RegistrationsFromEntries<E>> & CheckedLifetimes<RegistrationsFromEntries<E>, C>): Bag<RegistrationsFromEntries<E>, C> {
    return new Bag(this.#graph, this.context);
  }

  /**
   * Create a fresh bag and acquire selected services before returning it.
   * @param keys - A finite tuple of existing names or typed tokens to make ready.
   * @param options - Optional cancellation signal, positive timeout, and parallel, sequential, or positive safe integer bounded scheduling.
   * @returns A promise for the new bag after every selected final stage is ready.
   * @throws {@link DiBagStartupError} (`DI_BAG_STARTUP_FAILED`) after rollback on acquisition failure;
   * {@link DiBagStartupCancelledError} (`DI_BAG_STARTUP_CANCELLED`) promptly on abort or timeout;
   * `DI_BAG_INVALID_STARTUP` for malformed keys or options; `DI_BAG_INVALID_TOKEN` for a bad token;
   * `DI_BAG_CLASSIFIER_REQUIRED` as for {@link Builder.build}. Each arrives as a rejection.
   * @example
   * ```ts
   * const bag = await DiBag.createBuilder()
   *   .register({ db: async () => ({ ping: () => true }) })
   *   .buildAndStart(['db'], { timeoutMs: 5_000 });
   * ```
   */
  async buildAndStart<const K extends readonly unknown[]>(
    this: Builder<E, C> & CheckDependencyCompleteness<RegistrationsFromEntries<E>> & CompleteConstraints<C, RegistrationsFromEntries<E>> & CheckedLifetimes<RegistrationsFromEntries<E>, C>,
    keys: K & Selection<RegistrationsFromEntries<E>, K, 'buildAndStart'>,
    options?: StartupOptions,
  ): Promise<Bag<RegistrationsFromEntries<E>, C>> {
    const runtime = await startRuntime(this.#graph, this.context, keys, options);
    return new Bag(this.#graph, this.context, runtime);
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
   * Create a typed token from a unique symbol; `.of<Service>()` fixes its service type.
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
   * @throws `DI_BAG_INVALID_TOKEN` for a value that is not a genuine token.
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
   * Create a positional dependency containing every contribution to a collection token, in order.
   * @throws `DI_BAG_INVALID_TOKEN` for a value that is not a genuine token.
   * @example
   * ```ts
   * const toolsKey = Symbol('tools');
   * const tools = DiBag.token(toolsKey).of<string>();
   * const menu = DiBag.fromFunction([DiBag.all(tools)], names => names.join(', '));
   * ```
   */
  all: typeof all;
  /**
   * Validate an unknown plugin descriptor now and its acquired output at acquisition.
   * @throws `DI_BAG_INVALID_TOKEN` for a malformed dependency tuple; `DI_BAG_INVALID_PLUGIN_OPTIONS` for malformed options;
   * {@link DiBagPluginValidationError} (`DI_BAG_PLUGIN_VALIDATION`) for an invalid descriptor, or at acquisition for rejected output.
   * @example
   * ```ts
   * declare const descriptor: unknown;
   * const greeter = DiBag.fromPlugin([], descriptor, {
   *   acquisitionMode: 'raw',
   *   validate: (value): value is () => string => typeof value === 'function',
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
   * Begin an empty immutable graph; `build` creates its owning bag, `buildModule` seals a reusable module.
   * @example
   * ```ts
   * const bag = DiBag.createBuilder().register({ greeting: () => 'hello' }).build();
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
   *   .register({ controller: DiBag.withDisposal(() => new AbortController(), controller => controller.abort()) })
   *   .build();
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
   *   .register({ cache: DiBag.withLifetime(() => new Map<string, string>(), 'root') })
   *   .build();
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
  fromFactory, token, optional, lazy, all, fromPlugin, fromFunction, fromClass,
  createBuilder: (): Builder<never> => new Builder(new BindingGraph(), context),
  withDisposal, withLifetime, withMetadata, transformService,
}); }
/**
 * The immutable DI Bag facade. `auto` acquisition uses the host classifier where `process.getBuiltinModule`
 * exists; elsewhere configure one or use explicit modes.
 */
export const DiBag: DiBagApi = facade(unconfigured);
