import { Observers } from './observers';
import type { ObserverOptions } from './observers';
import { contributionEntry } from './contributions';
import type { BuilderContribute, CollectionMember } from './contribution-types';
import { aliasEntry } from './aliases';
import type { AliasSelection, AliasAdmission, AliasTarget, AliasDestination, AliasEntry, AliasEntries } from './alias-types';
import { optional, lazy, all } from './dependency-references';
import { normalize, snapshotAdd, withDisposal } from './registration';
import type { DisposableFactory, Factory, Registration, Registrations } from './registration';
import { BindingGraph, Runtime } from './runtime';
import type { BindingKey } from './runtime';
import { beginModule, moduleGraph } from './module';
import type { Module } from './module';
import type { CheckedConstraints, CompleteConstraints, IncrementalConstraints, NeedConstraint } from './module-types';
import type { CheckedLifetimes } from './lifetime-types';
import { withLifetime } from './lifetime';
import { withContext } from './acquisition-context';
import { startRuntime } from './startup';
import { selectScope } from './scope-selection';
import type { ScopeOptions, DisjointScopeSelection, UnsharedAliases, ScopedAliases } from './scope-types';
import type { CheckedScopeLifetimes } from './lifetime-types';
import type { StartupOptions } from './startup';
import { withMetadata, withAcquisitionMetadata, withAcquisitionMetadataAsync, mapSync, mapAsync, fromTokens, withTokenBinding, factory } from './provider';
import { fromFunction, fromClass } from './composition';
import { runtimeContext, unconfigured } from './acquisition-mode';
import type { RuntimeContext, RuntimeOptions } from './acquisition-mode';
import type { ProviderMetadata, ProviderAcquisitionMetadata } from './provider';
import type { InspectionSnapshot } from './inspection';
import { token, readTokenKey } from './tokens';
import { fromPlugin } from './plugins';
import type { TokenBase, TokenKey, TokenService } from './tokens';
import type { Binding, BindingOutput, TokenMember, TokenTupleAdmission, SelectionKey, ReboundSelection } from './token-types';
import type { BuilderReplacementRegistration, ReplacementAdmission, ReplacedEntries, ZeroDependencyAdmission } from './replacement-types';
import type {
  Checked,
  Complete,
  Entries,
  Entry,
  EntryKeys,
  ForkContext,
  From,
  IncrementalChecked,
  IntroducesKeys,
  Merge,
  Overrides,
  Provided,
  ReplacementKeyOf,
  ReplacementOutput,
  Selected,
  Selection,
  NamedAdmission,
} from './types';

// A public member under an unexported symbol retains its type in .d.ts output;
// TypeScript strips the types of ordinary private fields during declaration emit.
declare const constraintInvariant: unique symbol;

/**
 * A resolving container with lazy acquisition, caching, and independent resource ownership.
 *
 * Create bags through {@link Facade.begin} followed by {@link Builder.end} or
 * {@link Builder.start}; the class is exported as a type and has no public constructor.
 */
class Bag<R extends Registrations, C extends NeedConstraint = never> {
  /** @internal */
  declare readonly [constraintInvariant]: (value: C) => C;
  readonly #graph: BindingGraph;
  readonly #runtime: Runtime;

  constructor(graph: BindingGraph, private readonly context: RuntimeContext, runtime?: Runtime) {
    this.#graph = graph;
    this.#runtime = runtime ?? new Runtime(graph, context);
  }

  /**
   * Resolve a named or typed-token service, acquiring it lazily when needed.
   * Scoped and root services are cached according to their lifetime; transient services
   * create a new acquisition for each call. Promise-valued services keep their identity.
   * @param token - An existing public string name or typed token.
   * @returns The service exposed by the selected registration.
   * @throws If the bag is closing, the token is invalid, acquisition fails, or a runtime cycle is found.
   */
  resolve<K extends (keyof R & string) | TokenBase>(token: K & ([K] extends [string] ? unknown : TokenMember<R, K>)): Provided<R>[SelectionKey<K> & keyof R];
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
    ...invalid: [T] extends [never] ? [never] : []): readonly InspectionSnapshot<object, readonly unknown[]>[];
  inspectAll(token: unknown): readonly InspectionSnapshot<object, readonly unknown[]>[] { return this.#runtime.inspectAll(readTokenKey(token)); }

  /**
   * Inspect static metadata and copied acquisition state without resolving a service.
   * @param token - An existing public string name or typed token.
   * @returns A frozen point-in-time snapshot. Application-owned metadata payloads are not frozen.
   */
  inspect<K extends (keyof R & string) | TokenBase>(token: K & ([K] extends [string] ? unknown : TokenMember<R, K>)): InspectionSnapshot<ProviderMetadata<R[SelectionKey<K> & keyof R]>, ProviderAcquisitionMetadata<R[SelectionKey<K> & keyof R]>>;
  inspect(token: unknown): unknown {
    return this.#runtime.inspect(typeof token === 'string' ? token : readTokenKey(token));
  }

  /**
   * Create a tracked child that borrows selected parent acquisitions.
   * @param options - A checked selection of non-transient services to share lazily.
   * @returns A child owned by this bag; closing the parent closes the child first.
   */
  scope<const S extends readonly unknown[]>(options: ScopeOptions<R, S>): Bag<ScopedAliases<R, R, S>, C>;
  /**
   * Create a tracked child with selected replacements and optional parent sharing.
   * @param keys - Existing names or tokens to replace in the child.
   * @param overrides - Own registration properties for every selected key.
   * @param options - A disjoint selection of non-transient parent acquisitions to share.
   * @returns A child with fresh scoped acquisitions and ownership for unshared services.
   * @throws If the runtime selections, overrides, or sharing options are invalid.
   */
  scope<
    const K extends readonly unknown[],
    O extends ForkContext<R, K, O>,
    const S extends readonly unknown[] = readonly [],
  >(
    keys: K & Selection<R, K, 'scope'>,
    overrides: O & object & Record<SelectionKey<K[number]>, Registration> &
      Overrides<R, Selected<K, O>> &
      Checked<Merge<R, ReboundSelection<R, Selected<K, O>>>> &
      Complete<Merge<R, ReboundSelection<R, Selected<K, O>>>> &
      CheckedConstraints<C, Merge<R, ReboundSelection<R, Selected<K, O>>>> &
      CompleteConstraints<C, Merge<R, ReboundSelection<R, Selected<K, O>>>> &
      CheckedScopeLifetimes<NoInfer<ScopedAliases<Merge<R, ReboundSelection<R, Selected<K, O>>>, R, S>>, NoInfer<Selected<K, O>>, C>,
    options?: ScopeOptions<R, S> & DisjointScopeSelection<K, S>,
  ): Bag<ScopedAliases<Merge<R, ReboundSelection<R, Selected<K, O>>>, R, S>, C>;
  /**
   * Create a tracked child with the same graph and fresh scoped acquisitions.
   * @returns A child that is closed before its parent finishes closing.
   */
  scope(): Bag<UnsharedAliases<R>, C>;
  scope(...args: unknown[]): unknown {
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
    O extends ForkContext<R, K, O>,
  >(
    keys: K & Selection<R, K>,
    overrides: O &
      object &
      Record<SelectionKey<K[number]>, Registration> &
      Overrides<R, Selected<K, O>> &
      Checked<Merge<R, ReboundSelection<R, Selected<K, O>>>> &
      Complete<Merge<R, ReboundSelection<R, Selected<K, O>>>> &
      CheckedConstraints<C, Merge<R, ReboundSelection<R, Selected<K, O>>>> &
      CompleteConstraints<C, Merge<R, ReboundSelection<R, Selected<K, O>>>> &
      CheckedLifetimes<UnsharedAliases<Merge<R, ReboundSelection<R, Selected<K, O>>>>, C>,
  ): Bag<UnsharedAliases<Merge<R, ReboundSelection<R, Selected<K, O>>>>, C>;
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
      throw new Error('fork requires selected keys and an override object');
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
        throw new Error(`fork accepts existing tokens only: ${String(token)}`);
      }
      if (!Object.hasOwn(overrides, token)) {
        throw new Error(`missing override: ${String(token)}`);
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
 * An immutable, type-checked application graph builder.
 * Create one with {@link Facade.begin}; every operation returns a new builder.
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
  /**
   * Add new string-named registrations.
   * @param more - A finite object whose own string keys are service names and values are registrations.
   * @returns A new builder containing snapshots of the supplied registrations.
   * @throws If the input is malformed, contains a non-string key, or duplicates a public name.
   */
  add<N extends { [K in keyof N]: Registration }>(
    more: N & Registrations & NamedAdmission<N> & IntroducesKeys<EntryKeys<E>, keyof N> & IncrementalChecked<E, N> &
      CheckedConstraints<C, Merge<From<E>, N>>,
  ): Builder<E | Entries<N>, C> {
    const snapshot = snapshotAdd(more, key => this.#graph.hasPublic(key));
    // The snapshot retains every checked own registration, including hidden keys.
    return new Builder(this.#graph.withPublicRegistrations(snapshot), this.context);
  }

  /**
   * Add another lookup name or token for an existing service.
   * @param destination - A new string name or typed token.
   * @param target - The existing name or token whose canonical acquisition is reused.
   * @returns A new builder; aliases add no cache or ownership of their own.
   */
  alias<const D extends AliasSelection, const T extends AliasSelection>(
    destination: D & (unknown extends AliasAdmission<D> ? IntroducesKeys<EntryKeys<E>, keyof AliasEntries<From<E>, D, T>> : AliasAdmission<D>),
    target: T & AliasAdmission<T> & (unknown extends AliasAdmission<T>
      ? AliasTarget<From<E>, T> & AliasDestination<From<E>, NoInfer<D>, T> : unknown) &
      (unknown extends AliasAdmission<D> & AliasAdmission<T>
        ? IncrementalChecked<E, AliasEntries<From<E>, NoInfer<D>, NoInfer<T>>> & CheckedConstraints<C, Merge<From<E>, AliasEntries<From<E>, NoInfer<D>, NoInfer<T>>>> : unknown),
    ...invalid: [D] extends [never] ? [never] : [T] extends [never] ? [never] : []
  ): Builder<E | AliasEntry<From<E>, D, T>, C> {
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

  /**
   * Bind a registration to a typed token.
   * @param token - A new typed token identity.
   * @param registration - A registration whose exposed output satisfies the token service type.
   * @returns A new builder retaining the provider's metadata, lifetime, dependencies, and ownership stages.
   */
  bind<T extends TokenBase, V extends Registration>(
    token: T & TokenTupleAdmission<readonly [T]> & IntroducesKeys<EntryKeys<E>, TokenKey<T>>,
    registration: V & Registration & BindingOutput<NoInfer<T>, NoInfer<V>> &
      IncrementalChecked<E, Record<TokenKey<T>, Binding<NoInfer<T>, NoInfer<V>>>> &
      CheckedConstraints<C, Merge<From<E>, Record<TokenKey<T>, Binding<NoInfer<T>, NoInfer<V>>>>>,
  ): Builder<E | { key: TokenKey<T>; registration: Binding<T, V> }, C> {
    const key = readTokenKey(token);
    if (this.#graph.hasPublic(key)) throw new Error(`duplicate registration: ${String(key)}`);
    return new Builder(this.#graph.withPublicBinding(key, withTokenBinding<T, V>(token, registration)), this.context);
  }

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
  replace<const K extends string, V extends ((this: void) => ReplacementOutput<NoInfer<From<E>>, K, C>) | DisposableFactory<(this: void) => ReplacementOutput<NoInfer<From<E>>, K, C>>>(
    key: K & ReplacementKeyOf<EntryKeys<E>, K>,
    registration: V & (Factory | DisposableFactory<Factory>) & ZeroDependencyAdmission<NoInfer<V>> &
      CheckedConstraints<C, Merge<From<E>, Record<K, NoInfer<V>>>>,
  ): Builder<Exclude<E, { key: K }> | { key: K; registration: V }, C>;
  /**
   * Replace an existing named or typed-token registration.
   * @param key - The single existing name or token to replace.
   * @param registration - A replacement compatible with the token and known consumers.
   * @returns A new builder with the replacement and its inferred service type.
   */
  replace<const K extends string | TokenBase, V extends Registration>(
    key: K & NoInfer<ReplacementAdmission<From<E>, K>>,
    registration: V & Registration & BuilderReplacementRegistration<E, C, NoInfer<K>, V>,
  ): Builder<ReplacedEntries<E, K, V>, C>;
  replace(selection: string | TokenBase, registration: Registration): unknown {
    const key = typeof selection === 'string' ? selection : readTokenKey(selection);
    if (!this.#graph.hasPublic(key)) {
      throw new Error(`replace accepts existing tokens only: ${String(key)}`);
    }
    normalize(registration);
    return new Builder(this.#graph.withPublicBinding(key, registration), this.context);
  }

  /**
   * Install a sealed module, allocating fresh private bindings for this installation.
   * @param module - A module whose public names do not collide and whose external requirements remain checkable.
   * @returns A new builder exposing only the module's selected exports.
   */
  install<P extends object, R extends object, MC extends NeedConstraint, D extends Registrations>(
    module: Module<P, R, MC, D> & IntroducesKeys<EntryKeys<E>, keyof D> &
      IncrementalChecked<E, D> &
      IncrementalConstraints<C, MC, From<E>, D>,
  ): Builder<E | Entries<D>, C | MC> {
    return new Builder(this.#graph.withInstallation(moduleGraph(module)), this.context);
  }

  /**
   * Finish a complete graph as a lazy bag.
   * @returns A fresh bag that owns the acquisitions it creates.
   * @throws At runtime if automatic acquisition is used without a configured Promise classifier.
   */
  end(this: Builder<E, C> & Complete<From<E>> & CompleteConstraints<C, From<E>> & CheckedLifetimes<From<E>, C>): Bag<From<E>, C> {
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
  async start<const K extends readonly unknown[]>(
    this: Builder<E, C> & Complete<From<E>> & CompleteConstraints<C, From<E>> & CheckedLifetimes<From<E>, C>,
    keys: K & Selection<From<E>, K, 'start'>,
    options?: StartupOptions,
  ): Promise<Bag<From<E>, C>> {
    const runtime = await startRuntime(this.#graph, this.context, keys, options);
    return new Bag(this.#graph, this.context, runtime);
  }
}

export type { Bag, Builder };

/** The immutable public entry surface used by {@link DiBag} and derived facades. */
export interface Facade {
  /** Return a facade with one additional asynchronous lifecycle observer. */
  observe: (options: ObserverOptions) => Facade;
  /** Return a facade using the supplied trusted native-Promise predicate for `auto` stages. */
  configure: (options: RuntimeOptions) => Facade;
  /** Describe a factory with an explicit acquisition mode. */
  factory: typeof factory;
  /** Create a typed token factory from a canonical unique symbol. */
  token: typeof token;
  /** Create an optional positional dependency reference. */
  optional: typeof optional;
  /** Create a lazy positional dependency reference. */
  lazy: typeof lazy;
  /** Create an ordered-collection positional dependency reference. */
  all: typeof all;
  /** Create a provider that injects token references into a callback. */
  fromTokens: typeof fromTokens;
  /** Validate an unknown plugin descriptor and its acquired output. */
  fromPlugin: typeof fromPlugin;
  /** Adapt an existing positional function as a provider. */
  fromFunction: typeof fromFunction;
  /** Adapt an existing concrete constructor as a provider. */
  fromClass: typeof fromClass;
  /** Begin an empty immutable application graph. */
  begin: () => Builder<never>;
  /** Begin an empty immutable module graph. */
  module: typeof beginModule;
  /** Attach owned-value cleanup to a registration. */
  withDisposal: typeof withDisposal;
  /** Select root, scoped, or transient acquisition caching. */
  withLifetime: typeof withLifetime;
  /** Adapt a factory to receive its acquisition cancellation context. */
  withContext: typeof withContext;
  /** Attach static inspection and observer metadata. */
  withMetadata: typeof withMetadata;
  /** Describe the exact source output with synchronous acquisition metadata. */
  withAcquisitionMetadata: typeof withAcquisitionMetadata;
  /** Await the source and describe its value with synchronous acquisition metadata. */
  withAcquisitionMetadataAsync: typeof withAcquisitionMetadataAsync;
  /** Project a registration's exact source value synchronously. */
  mapSync: typeof mapSync;
  /** Await and project a registration through a native Promise boundary. */
  mapAsync: typeof mapAsync;
}
function facade(context: RuntimeContext): Facade { return Object.freeze({
  configure: (options: RuntimeOptions): Facade => facade(runtimeContext(options, context)),
  observe: (options: ObserverOptions): Facade => facade(Object.freeze({ ...context, observers: Observers.append(context.observers, options) })),
  factory,
  token,
  optional,
  lazy,
  all,
  fromTokens,
  fromPlugin,
  fromFunction,
  fromClass,
  begin: (): Builder<never> => new Builder(new BindingGraph(), context),
  module: beginModule,
  withDisposal,
  withLifetime,
  withContext,
  withMetadata,
  withAcquisitionMetadata,
  withAcquisitionMetadataAsync,
  mapSync,
  mapAsync,
}); }
/** The portable, immutable DI Bag facade. Configure `auto` acquisition or use explicit modes. */
export const DiBag: Facade = facade(unconfigured);
