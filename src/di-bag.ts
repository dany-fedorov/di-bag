import { normalize, snapshotAdd, withDisposal } from './registration';
import type { DisposableFactory, Factory, Registration, Registrations } from './registration';
import { BindingGraph, Runtime } from './runtime';
import type { BindingKey } from './runtime';
import { beginModule, moduleGraph } from './module';
import type { Module } from './module';
import type { CheckedConstraints, CompleteConstraints, NeedConstraint } from './module-types';
import { withMetadata, mapSync, mapAsync, fromTokens, withTokenBinding } from './provider';
import type { ProviderMetadata, ProviderAcquisitionMetadata } from './provider';
import type { InspectionSnapshot } from './inspection';
import { token, readTokenKey } from './tokens';
import type { TokenBase, TokenKey } from './tokens';
import type { Binding, BindingOutput, TokenMember, TokenTupleAdmission, SelectionKey, ReboundSelection } from './token-types';
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

  constructor(graph: BindingGraph) {
    this.#graph = graph;
    this.#runtime = new Runtime(graph);
  }

  resolve<K extends (keyof R & string) | TokenBase>(token: K & ([K] extends [string] ? unknown : TokenMember<R, K>)): Provided<R>[SelectionKey<K> & keyof R];
  resolve(token: unknown): unknown {
    return this.#runtime.resolve(typeof token === 'string' ? token : readTokenKey(token));
  }

  /** Inspect descriptions and copied attempt state without resolving a service. */
  inspect<K extends (keyof R & string) | TokenBase>(token: K & ([K] extends [string] ? unknown : TokenMember<R, K>)): InspectionSnapshot<ProviderMetadata<R[SelectionKey<K> & keyof R]>, ProviderAcquisitionMetadata<R[SelectionKey<K> & keyof R]>>;
  inspect(token: unknown): unknown {
    return this.#runtime.inspect(typeof token === 'string' ? token : readTokenKey(token));
  }

  /** Replace existing tokens; the fork creates and owns its own instances. */
  fork(): Bag<R, C>;
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
      CompleteConstraints<C, Merge<R, ReboundSelection<R, Selected<K, O>>>>,
  ): Bag<Merge<R, ReboundSelection<R, Selected<K, O>>>, C>;
  fork(keys?: readonly unknown[], overrides?: object): unknown {
    this.#runtime.assertOpen();
    if (keys === undefined && overrides === undefined) {
      return new Bag(this.#graph);
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
    return new Bag(this.#graph.withPublicBindings(selectedBindings));
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

  constructor(graph: BindingGraph) {
    this.#graph = graph;
  }

  // Infer actual keys before checking context-sensitive method-returning factories.
  add<N extends { [K in keyof N]: Registration }>(
    more: N & Registrations & NamedAdmission<N> & Introduces<From<E>, N> & IncrementalChecked<E, N> &
      CheckedConstraints<C, Merge<From<E>, N>>,
  ): Builder<E | Entries<N>, C> {
    const snapshot = snapshotAdd(more, key => this.#graph.hasPublic(key));
    // The snapshot retains every checked own registration, including hidden keys.
    return new Builder(this.#graph.withPublicRegistrations(snapshot));
  }

  bind<T extends TokenBase, V extends Registration>(
    token: T & TokenTupleAdmission<readonly [T]> & Introduces<From<E>, Record<TokenKey<T>, V>>,
    registration: V & Registration & BindingOutput<NoInfer<T>, NoInfer<V>> &
      IncrementalChecked<E, Record<TokenKey<T>, Binding<NoInfer<T>, NoInfer<V>>>> &
      CheckedConstraints<C, Merge<From<E>, Record<TokenKey<T>, Binding<NoInfer<T>, NoInfer<V>>>>>,
  ): Builder<E | { key: TokenKey<T>; registration: Binding<T, V> }, C> {
    const key = readTokenKey(token);
    if (this.#graph.hasPublic(key)) throw new Error(`duplicate registration: ${String(key)}`);
    return new Builder(this.#graph.withPublicBinding(key, withTokenBinding<T, V>(token, registration)));
  }

  // Give the preliminary callable context real empty needs and a consumer-safe
  // output. Final checks still inspect V; the general overload retains required
  // factory parameters and mixed registrations, including explicit K,V calls.
  replace<const K extends string, V extends ((this: void) => ReplacementOutput<From<E>, K, C>) | DisposableFactory<(this: void) => ReplacementOutput<From<E>, K, C>>>(
    key: K & ReplacementKey<From<E>, K>,
    registration: V & (Factory | DisposableFactory<Factory>) & IncrementalChecked<E, Record<K, NoInfer<V>>> &
      CheckedConstraints<C, Merge<From<E>, Record<K, NoInfer<V>>>>,
  ): Builder<Exclude<E, { key: K }> | { key: K; registration: V }, C>;
  replace<const K extends string, V extends Registration>(
    key: K & ReplacementKey<From<E>, K>,
    registration: V & Registration & IncrementalChecked<E, Record<K, NoInfer<V>>> &
      CheckedConstraints<C, Merge<From<E>, Record<K, NoInfer<V>>>>,
  ): Builder<Exclude<E, { key: K }> | { key: K; registration: V }, C>;
  replace<T extends TokenBase, V extends Registration>(
    token: T & TokenMember<From<E>, T>,
    registration: V & Registration & BindingOutput<NoInfer<T>, NoInfer<V>> &
      IncrementalChecked<E, Record<TokenKey<T>, Binding<NoInfer<T>, NoInfer<V>>>> &
      CheckedConstraints<C, Merge<From<E>, Record<TokenKey<T>, Binding<NoInfer<T>, NoInfer<V>>>>>,
  ): Builder<Exclude<E, { key: TokenKey<T> }> | { key: TokenKey<T>; registration: Binding<T, V> }, C>;
  replace(selection: string | TokenBase, registration: Registration): unknown {
    const key = typeof selection === 'string' ? selection : readTokenKey(selection);
    if (!this.#graph.hasPublic(key)) {
      throw new Error(`replace accepts existing tokens only: ${String(key)}`);
    }
    normalize(registration);
    return new Builder(this.#graph.withPublicBinding(key, registration));
  }

  install<P extends object, R extends object, MC extends NeedConstraint, D extends Registrations>(
    module: Module<P, R, MC, D> & Introduces<From<E>, D> &
      Checked<Merge<From<E>, D>> &
      CheckedConstraints<C | MC, Merge<From<E>, D>>,
  ): Builder<E | Entries<D>, C | MC> {
    return new Builder(this.#graph.withInstallation(moduleGraph(module)));
  }

  end(this: Builder<E, C> & Complete<From<E>> & CompleteConstraints<C, From<E>>): Bag<From<E>, C> {
    return new Bag(this.#graph);
  }
}

export type { Bag };

export const DiBag: {
  token: typeof token;
  fromTokens: typeof fromTokens;
  begin: () => Builder<never>;
  module: typeof beginModule;
  withDisposal: typeof withDisposal;
  withMetadata: typeof withMetadata;
  mapSync: typeof mapSync;
  mapAsync: typeof mapAsync;
} = {
  token,
  fromTokens,
  begin: (): Builder<never> => new Builder(new BindingGraph()),
  module: beginModule,
  withDisposal,
  withMetadata,
  mapSync,
  mapAsync,
};
