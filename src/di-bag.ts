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
import { withMetadata, mapSync, mapAsync, fromTokens, withTokenBinding, factory } from './provider';
import { fromFunction, fromClass } from './composition';
import { runtimeContext, unconfigured } from './acquisition-mode';
import type { RuntimeContext, RuntimeOptions } from './acquisition-mode';
import type { ProviderMetadata, ProviderAcquisitionMetadata } from './provider';
import type { InspectionSnapshot } from './inspection';
import { token, readTokenKey } from './tokens';
import { fromPlugin } from './plugins';
import type { TokenBase, TokenKey, TokenService } from './tokens';
import type { Binding, BindingOutput, TokenMember, TokenTupleAdmission, SelectionKey, ReboundSelection } from './token-types';
import type { BuilderReplacementRegistration, ReplacementAdmission, ReplacedEntries } from './replacement-types';
import type {
  Checked,
  Complete,
  Entries,
  Entry,
  ForkContext,
  From,
  IncrementalChecked,
  Introduces,
  Merge,
  Overrides,
  Provided,
  ReplacementKey,
  ReplacementOutput,
  Selected,
  Selection,
  NamedAdmission,
} from './types';

// A public member under an unexported symbol retains its type in .d.ts output;
// TypeScript strips the types of ordinary private fields during declaration emit.
declare const constraintInvariant: unique symbol;

/** A lazy graph with independent memoization and resource ownership. */
class Bag<R extends Registrations, C extends NeedConstraint = never> {
  declare readonly [constraintInvariant]: (value: C) => C;
  readonly #graph: BindingGraph;
  readonly #runtime: Runtime;

  constructor(graph: BindingGraph, private readonly context: RuntimeContext, runtime?: Runtime) {
    this.#graph = graph;
    this.#runtime = runtime ?? new Runtime(graph, context);
  }

  resolve<K extends (keyof R & string) | TokenBase>(token: K & ([K] extends [string] ? unknown : TokenMember<R, K>)): Provided<R>[SelectionKey<K> & keyof R];
  resolve(token: unknown): unknown {
    return this.#runtime.resolve(typeof token === 'string' ? token : readTokenKey(token));
  }

  resolveAll<T extends TokenBase>(token: T & TokenTupleAdmission<readonly [T]> & CollectionMember<T, C>,
    ...invalid: [T] extends [never] ? [never] : []): ReadonlyArray<TokenService<T>>;
  resolveAll(token: unknown): readonly unknown[] { return this.#runtime.resolveAll(readTokenKey(token)); }

  inspectAll<T extends TokenBase>(token: T & TokenTupleAdmission<readonly [T]> & CollectionMember<T, C>,
    ...invalid: [T] extends [never] ? [never] : []): readonly InspectionSnapshot<object, readonly unknown[]>[];
  inspectAll(token: unknown): readonly InspectionSnapshot<object, readonly unknown[]>[] { return this.#runtime.inspectAll(readTokenKey(token)); }

  /** Inspect descriptions and copied attempt state without resolving a service. */
  inspect<K extends (keyof R & string) | TokenBase>(token: K & ([K] extends [string] ? unknown : TokenMember<R, K>)): InspectionSnapshot<ProviderMetadata<R[SelectionKey<K> & keyof R]>, ProviderAcquisitionMetadata<R[SelectionKey<K> & keyof R]>>;
  inspect(token: unknown): unknown {
    return this.#runtime.inspect(typeof token === 'string' ? token : readTokenKey(token));
  }

  /** Create a tracked child, optionally borrowing parent services and overriding selected slots. */
  scope<const S extends readonly unknown[]>(options: ScopeOptions<R, S>): Bag<ScopedAliases<R, R, S>, C>;
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
  scope(): Bag<UnsharedAliases<R>, C>;
  scope(...args: unknown[]): unknown {
    this.#runtime.assertOpen();
    const { graph, shared } = selectScope(this.#graph, args, key => this.#runtime.isTransient(key));
    return new Bag(graph, this.context, this.#runtime.scope(graph, shared));
  }

  /** Replace existing tokens; the fork creates and owns its own instances. */
  fork(this: Bag<R, C> & CheckedLifetimes<UnsharedAliases<R>, C>): Bag<UnsharedAliases<R>, C>;
  // The graph-aware bound keeps the first inference pass applicable and requires
  // selected registrations even with explicit generics. The argument's Record
  // supplies callable context; unselected keys stay outside checks and results.
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

  /** Drain acquisitions, then dispose dependents before dependencies, once. */
  close(): Promise<void> {
    return this.#runtime.close();
  }
}

class Builder<E extends Entry, C extends NeedConstraint = never> {
  // Preserve accepted registration history and module constraints through views.
  declare readonly [constraintInvariant]:
    (value: readonly [E, C]) => readonly [E, C];
  readonly #graph: BindingGraph;

  constructor(graph: BindingGraph, private readonly context: RuntimeContext) {
    this.#graph = graph;
  }

  // Infer actual keys before checking context-sensitive method-returning factories.
  add<N extends { [K in keyof N]: Registration }>(
    more: N & Registrations & NamedAdmission<N> & Introduces<From<E>, N> & IncrementalChecked<E, N> &
      CheckedConstraints<C, Merge<From<E>, N>>,
  ): Builder<E | Entries<N>, C> {
    const snapshot = snapshotAdd(more, key => this.#graph.hasPublic(key));
    // The snapshot retains every checked own registration, including hidden keys.
    return new Builder(this.#graph.withPublicRegistrations(snapshot), this.context);
  }

  alias<const D extends AliasSelection, const T extends AliasSelection>(
    destination: D & (unknown extends AliasAdmission<D> ? Introduces<From<E>, AliasEntries<From<E>, D, T>> : AliasAdmission<D>),
    target: T & AliasAdmission<T> & (unknown extends AliasAdmission<T>
      ? AliasTarget<From<E>, T> & AliasDestination<From<E>, NoInfer<D>, T> : unknown) &
      (unknown extends AliasAdmission<D> & AliasAdmission<T>
        ? IncrementalChecked<E, AliasEntries<From<E>, NoInfer<D>, NoInfer<T>>> & CheckedConstraints<C, Merge<From<E>, AliasEntries<From<E>, NoInfer<D>, NoInfer<T>>>> : unknown),
    ...invalid: [D] extends [never] ? [never] : [T] extends [never] ? [never] : []
  ): Builder<E | AliasEntry<From<E>, D, T>, C> {
    const [key, registration] = aliasEntry(destination, target, key => this.#graph.hasPublic(key));
    return new Builder(this.#graph.withPublicBinding(key, registration), this.context);
  }

  // A named callable keeps extracted generic methods nameable in consumer declarations.
  readonly contribute: BuilderContribute<E, C> = ((token: unknown, registration: Registration) => {
    const [key, value] = contributionEntry(token, registration);
    return new Builder(this.#graph.withContribution(key, value), this.context);
  }) as BuilderContribute<E, C>;

  bind<T extends TokenBase, V extends Registration>(
    token: T & TokenTupleAdmission<readonly [T]> & Introduces<From<E>, Record<TokenKey<T>, V>>,
    registration: V & Registration & BindingOutput<NoInfer<T>, NoInfer<V>> &
      IncrementalChecked<E, Record<TokenKey<T>, Binding<NoInfer<T>, NoInfer<V>>>> &
      CheckedConstraints<C, Merge<From<E>, Record<TokenKey<T>, Binding<NoInfer<T>, NoInfer<V>>>>>,
  ): Builder<E | { key: TokenKey<T>; registration: Binding<T, V> }, C> {
    const key = readTokenKey(token);
    if (this.#graph.hasPublic(key)) throw new Error(`duplicate registration: ${String(key)}`);
    return new Builder(this.#graph.withPublicBinding(key, withTokenBinding<T, V>(token, registration)), this.context);
  }

  // Give the preliminary callable context real empty needs and a consumer-safe
  // output. Final checks still inspect V; the general overload retains required
  // factory parameters and mixed registrations, including explicit K,V calls.
  replace<const K extends string, V extends ((this: void) => ReplacementOutput<From<E>, K, C>) | DisposableFactory<(this: void) => ReplacementOutput<From<E>, K, C>>>(
    key: K & ReplacementKey<From<E>, K>,
    registration: V & (Factory | DisposableFactory<Factory>) & IncrementalChecked<E, Record<K, NoInfer<V>>> &
      CheckedConstraints<C, Merge<From<E>, Record<K, NoInfer<V>>>>,
  ): Builder<Exclude<E, { key: K }> | { key: K; registration: V }, C>;
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

  install<P extends object, R extends object, MC extends NeedConstraint, D extends Registrations>(
    module: Module<P, R, MC, D> & Introduces<From<E>, D> &
      IncrementalChecked<E, D> &
      IncrementalConstraints<C, MC, From<E>, D>,
  ): Builder<E | Entries<D>, C | MC> {
    return new Builder(this.#graph.withInstallation(moduleGraph(module)), this.context);
  }

  end(this: Builder<E, C> & Complete<From<E>> & CompleteConstraints<C, From<E>> & CheckedLifetimes<From<E>, C>): Bag<From<E>, C> {
    return new Bag(this.#graph, this.context);
  }

  /** Acquire selected services in a fresh bag, rolling back failed startup. */
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

export interface Facade {
  observe: (options: ObserverOptions) => Facade;
  configure: (options: RuntimeOptions) => Facade;
  factory: typeof factory;
  token: typeof token;
  optional: typeof optional;
  lazy: typeof lazy;
  all: typeof all;
  fromTokens: typeof fromTokens;
  fromPlugin: typeof fromPlugin;
  fromFunction: typeof fromFunction;
  fromClass: typeof fromClass;
  begin: () => Builder<never>;
  module: typeof beginModule;
  withDisposal: typeof withDisposal;
  withLifetime: typeof withLifetime;
  withContext: typeof withContext;
  withMetadata: typeof withMetadata;
  mapSync: typeof mapSync;
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
  mapSync,
  mapAsync,
}); }
export const DiBag: Facade = facade(unconfigured);
