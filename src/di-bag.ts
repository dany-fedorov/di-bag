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
import type { Module } from './module';
import type { CheckedConstraints, CompleteConstraints, ExternalRequirements, IncrementalConstraints, ModulePublicProviders, ModuleSealedConstraints, NeedConstraint } from './module-types';
import type { CheckedLifetimes } from './lifetime-types';
import { withLifetime } from './lifetime';
import { fromFactory } from './acquisition-context';
import { startRuntime } from './startup';
import { selectScope } from './scope-selection';
import type { ScopeOptions, DisjointScopeSelection, UnsharedAliases, ScopedAliases } from './scope-types';
import type { CheckedScopeLifetimes } from './lifetime-types';
import type { StartupOptions } from './startup';
import { withMetadata, transformService, withTokenBinding } from './provider';
import { fromFunction, fromClass } from './composition';
import { runtimeContext, unconfigured } from './acquisition-mode';
import type { RuntimeContext, RuntimeOptions } from './acquisition-mode';
import type { ProviderRegistrationMetadata, ProviderAcquisitionMetadata } from './provider';
import type { RegistrationSnapshot } from './inspection';
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
 */
class Bag<R extends Registrations, C extends NeedConstraint = never> {
  /** @internal */
  declare readonly [constraintInvariant]: (value: C) => C;
  readonly #graph: BindingGraph;
  readonly #runtime: BagRuntime;

  constructor(graph: BindingGraph, private readonly context: RuntimeContext, runtime?: BagRuntime) {
    this.#graph = graph;
    this.#runtime = runtime ?? new BagRuntime(graph, context);
  }

  /**
   * Resolve a named or typed-token service, acquiring it lazily when needed.
   * Scoped and root services are cached according to their lifetime; transient services
   * create a new acquisition for each call. Promise-valued services keep their identity.
   * @param token - An existing public string name or typed token.
   * @returns The service exposed by the selected registration.
   * @throws If the bag is closing, the token is invalid, acquisition fails, or a runtime cycle is found.
   */
  resolve<K extends (keyof R & string) | TokenBase>(token: K & ([K] extends [string] ? unknown : TokenMember<R, K>)): ServicesOf<R>[SelectionKey<K> & keyof R];
  resolve(token: unknown): unknown {
    return this.#runtime.resolve(typeof token === 'string' ? token : readTokenKey(token));
  }

  /**
   * Resolve every contribution for a typed token in declaration and installation order.
   * @param token - The collection token whose contributions to acquire.
   * @returns A fresh frozen array; an unpopulated collection returns an empty array.
   * @throws If the bag is closing, the token is invalid, or a contribution fails.
   */
  resolveAll<T extends TokenBase>(token: T & TokenTupleAdmission<readonly [T]> & CollectionMember<T, C>,
    ...invalid: [T] extends [never] ? [never] : []): ReadonlyArray<TokenService<T>>;
  resolveAll(token: unknown): readonly unknown[] { return this.#runtime.resolveAll(readTokenKey(token)); }

  /**
   * Inspect every contribution for a token without running its factories.
   * @param token - The collection token to inspect.
   * @returns Frozen snapshots in contribution order.
   */
  inspectAll<T extends TokenBase>(token: T & TokenTupleAdmission<readonly [T]> & CollectionMember<T, C>,
    ...invalid: [T] extends [never] ? [never] : []): readonly RegistrationSnapshot<object, readonly unknown[]>[];
  inspectAll(token: unknown): readonly RegistrationSnapshot<object, readonly unknown[]>[] { return this.#runtime.inspectAll(readTokenKey(token)); }

  /**
   * Inspect static metadata and copied acquisition state without resolving a service.
   * @param token - An existing public string name or typed token.
   * @returns A frozen point-in-time snapshot. Application-owned metadata payloads are not frozen.
   */
  inspect<K extends (keyof R & string) | TokenBase>(token: K & ([K] extends [string] ? unknown : TokenMember<R, K>)): RegistrationSnapshot<ProviderRegistrationMetadata<R[SelectionKey<K> & keyof R]>, ProviderAcquisitionMetadata<R[SelectionKey<K> & keyof R]>>;
  inspect(token: unknown): unknown {
    return this.#runtime.inspect(typeof token === 'string' ? token : readTokenKey(token));
  }

  /**
   * Create a tracked child that borrows selected parent acquisitions.
   * @param options - A checked selection of non-transient services to share lazily.
   * @returns A child owned by this bag; closing the parent closes the child first.
   */
  createScope<const S extends readonly unknown[]>(options: ScopeOptions<R, S>): Bag<ScopedAliases<R, R, S>, C>;
  /**
   * Create a tracked child with selected replacements and optional parent sharing.
   * @param keys - Existing names or tokens to replace in the child.
   * @param overrides - Own registration properties for every selected key.
   * @param options - A disjoint selection of non-transient parent acquisitions to share.
   * @returns A child with fresh scoped acquisitions and ownership for unshared services.
   * @throws If the runtime selections, overrides, or sharing options are invalid.
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
      CheckedScopeLifetimes<NoInfer<ScopedAliases<OverrideRegistrations<R, ReboundSelection<R, SelectedRegistrations<K, O>>>, R, S>>, NoInfer<SelectedRegistrations<K, O>>, C>,
    options?: ScopeOptions<R, S> & DisjointScopeSelection<K, S>,
  ): Bag<ScopedAliases<OverrideRegistrations<R, ReboundSelection<R, SelectedRegistrations<K, O>>>, R, S>, C>;
  /**
   * Create a tracked child with the same graph and fresh scoped acquisitions.
   * @returns A child that is closed before its parent finishes closing.
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
   */
  fork(this: Bag<R, C> & CheckedLifetimes<UnsharedAliases<R>, C>): Bag<UnsharedAliases<R>, C>;
  // The graph-aware bound keeps the first inference pass applicable and requires
  // selected registrations even with explicit generics. The argument's Record
  // supplies callable context; unselected keys stay outside checks and results.
  /**
   * Create an independent bag with selected replacements.
   * @param keys - Existing names or tokens to replace.
   * @param overrides - Own registration properties for every selected key.
   * @returns A fresh ownership family whose graph uses the checked replacements.
   * @throws If a selected key is absent or lacks an own override.
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
      CheckedLifetimes<UnsharedAliases<OverrideRegistrations<R, ReboundSelection<R, SelectedRegistrations<K, O>>>>, C>,
  ): Bag<UnsharedAliases<OverrideRegistrations<R, ReboundSelection<R, SelectedRegistrations<K, O>>>>, C>;
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
   * reverse acquisition order. Repeated calls return the same promise.
   * @returns The shared shutdown promise.
   * @throws {@link DiBagCleanupError} when one or more disposers fail after all cleanup is attempted.
   */
  close(): Promise<void> {
    return this.#runtime.close();
  }
}

/**
 * An immutable, type-checked graph builder. Every operation returns a new builder.
 * Create one with {@link DiBagApi.createBuilder}. The same builder value can
 * {@link Builder.build} a bag once its graph is complete, or
 * {@link Builder.buildModule} a reusable module whose unmet dependencies become
 * requirements the installing host must satisfy.
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
   * @param more - A finite object whose own string keys are service names and values are registrations.
   * @returns A new builder containing snapshots of the supplied registrations.
   * @throws If the input is malformed, contains a non-string key, or duplicates a public name.
   */
  register<N extends { [K in keyof N]: Registration }>(
    more: N & Registrations & ([N] extends [never]
      ? never
      : NamedAdmission<N> & IntroducesKeys<EntryKeys<E>, keyof N> & IncrementalChecked<E, N> &
        CheckedConstraints<C, OverrideRegistrations<RegistrationsFromEntries<E>, N>>),
  ): Builder<E | RegistrationEntries<N>, C>;
  /**
   * Register a provider to a typed token.
   * @param token - A new typed token identity.
   * @param registration - A registration whose exposed output satisfies the token service type.
   * @returns A new builder retaining the provider's metadata, lifetime, dependencies, and ownership stages.
   */
  register<T extends TokenBase, V extends Registration>(
    token: T & TokenTupleAdmission<readonly [T]> & IntroducesKeys<EntryKeys<E>, TokenKey<T>>,
    registration: V & Registration & BindingOutput<NoInfer<T>, NoInfer<V>> &
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
   */
  replace<const K extends string, V extends (ReplacementFactory<ReplacementOutput<NoInfer<RegistrationsFromEntries<E>>, K, C>>) | FactoryWithDisposal<ReplacementFactory<ReplacementOutput<NoInfer<RegistrationsFromEntries<E>>, K, C>>>>(
    key: K & ReplacementKeyOf<EntryKeys<E>, K>,
    registration: V & (Factory | FactoryWithDisposal<Factory>) & ZeroDependencyAdmission<NoInfer<V>> &
      CheckedConstraints<C, OverrideRegistrations<RegistrationsFromEntries<E>, Record<K, NoInfer<V>>>>,
  ): Builder<Exclude<E, { key: K }> | { key: K; registration: V }, C>;
  /**
   * Replace an existing named or typed-token registration.
   * @param key - The single existing name or token to replace.
   * @param registration - A replacement compatible with the token and known consumers.
   * @returns A new builder with the replacement and its inferred service type.
   */
  replace<const K extends string | TokenBase, V extends Registration>(
    key: K & NoInfer<ReplacementAdmission<RegistrationsFromEntries<E>, K>>,
    registration: V & Registration & BuilderReplacementRegistration<E, C, NoInfer<K>, V>,
  ): Builder<ReplacedEntries<E, K, V>, C>;
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
   * @param module - A module whose public names do not collide and whose external requirements remain checkable.
   * @returns A new builder exposing only the module's selected exports.
   */
  installModule<P extends object, R extends object, MC extends NeedConstraint, D extends Registrations>(
    module: Module<P, R, MC, D> & IntroducesKeys<EntryKeys<E>, keyof D> &
      IncrementalChecked<E, D> &
      IncrementalConstraints<C, MC, RegistrationsFromEntries<E>, D>,
  ): Builder<E | RegistrationEntries<D>, C | MC> {
    return new Builder(this.#graph.withInstallation(moduleGraph(module)), this.context);
  }

  /**
   * Seal this graph as a reusable module and select its public names and typed tokens.
   * Unselected registrations stay private to each installation; unmet dependencies
   * become requirements of the module. Installed modules nest: their private
   * bindings and retained constraints are re-scoped inside this module.
   * @param keys - A finite tuple of existing names or tokens; an empty tuple is allowed.
   * @returns An immutable module that can be renamed or installed in another builder.
   * @throws If the selection is not a tuple or contains an absent name or token.
   */
  buildModule<const K extends readonly unknown[]>(keys: K & Selection<RegistrationsFromEntries<E>, K, 'buildModule'>): Module<
    Pick<ServicesOf<RegistrationsFromEntries<E>>, Extract<SelectionKey<K[number]>, keyof RegistrationsFromEntries<E>>>,
    ExternalRequirements<ModuleSealedConstraints<E, C, Extract<SelectionKey<K[number]>, keyof RegistrationsFromEntries<E>>>>,
    ModuleSealedConstraints<E, C, Extract<SelectionKey<K[number]>, keyof RegistrationsFromEntries<E>>>,
    ModulePublicProviders<RegistrationsFromEntries<E>, Extract<SelectionKey<K[number]>, keyof RegistrationsFromEntries<E>>>
  > {
    return sealModule(this.#graph, keys) as never;
  }

  /**
   * Finish a complete graph as a lazy bag.
   * @returns A fresh bag that owns the acquisitions it creates.
   * @throws At runtime if automatic acquisition is used without a configured Promise classifier.
   */
  build(this: Builder<E, C> & CheckDependencyCompleteness<RegistrationsFromEntries<E>> & CompleteConstraints<C, RegistrationsFromEntries<E>> & CheckedLifetimes<RegistrationsFromEntries<E>, C>): Bag<RegistrationsFromEntries<E>, C> {
    return new Bag(this.#graph, this.context);
  }

  /**
   * Create a fresh bag and acquire selected services before returning it.
   * @param keys - A finite tuple of existing names or typed tokens to make ready.
   * @param options - Optional cancellation signal, positive timeout, and parallel, sequential, or positive safe integer bounded scheduling.
   * @returns A promise for the new bag after every selected final stage is ready.
   * @throws {@link DiBagStartupError} after rollback on acquisition failure, or
   * {@link DiBagStartupCancelledError} promptly on abort or timeout.
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

/** Immutable facade configuration. Observers append in the supplied order. */
export interface ConfigurationOptions {
  readonly runtime?: RuntimeOptions;
  readonly observers?: readonly ObserverOptions[];
}
/** The immutable public entry surface used by {@link DiBag} and derived facades. */
export interface DiBagApi {
  /** Return a facade with inherited runtime settings and appended observers. */
  withConfiguration: (options: ConfigurationOptions) => DiBagApi;
  /** Describe a named-dependency factory, optionally receiving acquisition context. */
  fromFactory: typeof fromFactory;
  /** Create a nominal typed token with a diagnostic label. */
  token: typeof token;
  /** Create a positional dependency that yields undefined only when unregistered. */
  optional: typeof optional;
  /** Create a positional dependency resolved on demand by the receiving service. */
  lazy: typeof lazy;
  /** Create a positional dependency containing ordered collection contributions. */
  all: typeof all;
  /** Validate an unknown plugin descriptor and its acquired output at a checked boundary. */
  fromPlugin: PluginProviderFactory;
  /** Adapt a positional function with strict dependency tuple and argument checking. */
  fromFunction: typeof fromFunction;
  /** Adapt a concrete constructor with positional dependency injection. */
  fromClass: typeof fromClass;
  /** Begin an empty immutable graph; build creates its owning bag, buildModule seals a reusable module. */
  createBuilder: () => Builder<never>;
  /** Attach owned-value cleanup while retaining earlier disposal stages. */
  withDisposal: typeof withDisposal;
  /** Select root, scoped, or transient caching within an ownership family. */
  withLifetime: typeof withLifetime;
  /** Attach registration metadata and ordered acquisition metadata in direct or awaited mode. */
  withMetadata: typeof withMetadata;
  /** Transform the exposed service while retaining dependencies, metadata, lifetime, and existing ownership. */
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
/** The portable, immutable DI Bag facade. Configure `auto` acquisition or use explicit modes. */
export const DiBag: DiBagApi = facade(unconfigured);
