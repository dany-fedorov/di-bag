import { normalize, snapshotAdd, withDisposal } from './registration';
import type { DisposableFactory, Factory, Registration, Registrations } from './registration';
import { BindingGraph, Runtime } from './runtime';
import { beginModule, moduleGraph } from './module';
import type { Module } from './module';
import type { CheckedConstraints, CompleteConstraints, NeedConstraint } from './module-types';
import { withMetadata, mapSync, mapAsync } from './provider';
import type { ProviderMetadata, ProviderAcquisitionMetadata } from './provider';
import type { InspectionSnapshot } from './inspection';
import type {
  Checked,
  Complete,
  Entries,
  Entry,
  ForkContext,
  From,
  Introduces,
  Merge,
  Overrides,
  Provided,
  ReplacementKey,
  Selected,
  Selection,
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

  resolve<K extends keyof R & string>(token: K): Provided<R>[K] {
    return this.#runtime.resolve(token) as Provided<R>[K];
  }

  /** Inspect descriptions and copied attempt state without resolving a service. */
  inspect<K extends keyof R & string>(token: K): InspectionSnapshot<ProviderMetadata<R[K]>, ProviderAcquisitionMetadata<R[K]>> {
    return this.#runtime.inspect(token) as InspectionSnapshot<ProviderMetadata<R[K]>, ProviderAcquisitionMetadata<R[K]>>;
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
      Record<Extract<K[number], string>, Registration> &
      Overrides<R, Selected<K, O>> &
      Checked<Merge<R, Selected<K, O>>> &
      Complete<Merge<R, Selected<K, O>>> &
      CheckedConstraints<C, Provided<Merge<R, Selected<K, O>>>> &
      CompleteConstraints<C, Provided<Merge<R, Selected<K, O>>>>,
  ): Bag<Merge<R, Selected<K, O>>, C>;
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
    for (const token of selectedKeys) {
      if (typeof token !== 'string') throw new Error('fork keys must be strings');
      if (!this.#graph.hasPublic(token)) {
        throw new Error(`fork accepts existing tokens only: ${token}`);
      }
      if (!Object.hasOwn(overrides, token)) {
        throw new Error(`missing override: ${token}`);
      }
    }
    const selected: Registrations = Object.create(null);
    for (const token of selectedKeys as string[]) {
      const registration: unknown = Reflect.get(overrides, token);
      normalize(registration);
      selected[token] = registration as Registration;
    }
    return new Bag(this.#graph.withPublicRegistrations(selected));
  }

  /** Drain acquisitions, then dispose dependents before dependencies, once. */
  close(): Promise<void> {
    return this.#runtime.close();
  }
}

class Builder<E extends Entry, C extends NeedConstraint = never> {
  declare readonly [constraintInvariant]: (value: C) => C;
  readonly #graph: BindingGraph;

  constructor(graph: BindingGraph) {
    this.#graph = graph;
  }

  // Infer actual keys before checking context-sensitive method-returning factories.
  add<N extends { [K in keyof N]: Registration }>(
    more: N & Registrations & Introduces<From<E>, N> & Checked<Merge<From<E>, N>> &
      CheckedConstraints<C, Provided<Merge<From<E>, N>>>,
  ): Builder<E | Entries<N>, C> {
    const snapshot = snapshotAdd(more, key => this.#graph.hasPublic(key));
    // The snapshot retains every checked own registration, including hidden keys.
    return new Builder(this.#graph.withPublicRegistrations(snapshot));
  }

  // Keep callable context available before validating the inferred registration;
  // the second overload also admits predeclared factory/provider unions.
  replace<const K extends string, V extends Factory | DisposableFactory<Factory>>(
    key: K & ReplacementKey<From<E>, K>,
    registration: V & (Factory | DisposableFactory<Factory>) & Checked<Merge<From<E>, Record<K, NoInfer<V>>>> &
      CheckedConstraints<C, Provided<Merge<From<E>, Record<K, NoInfer<V>>>>>,
  ): Builder<Exclude<E, { key: K }> | { key: K; registration: V }, C>;
  replace<const K extends string, V extends Registration>(
    key: K & ReplacementKey<From<E>, K>,
    registration: V & Registration & Checked<Merge<From<E>, Record<K, NoInfer<V>>>> &
      CheckedConstraints<C, Provided<Merge<From<E>, Record<K, NoInfer<V>>>>>,
  ): Builder<Exclude<E, { key: K }> | { key: K; registration: V }, C>;
  replace<const K extends string, V extends Registration>(
    key: K,
    registration: V,
  ): Builder<Exclude<E, { key: K }> | { key: K; registration: V }, C> {
    if (typeof key !== 'string' || !this.#graph.hasPublic(key)) {
      throw new Error(`replace accepts existing tokens only: ${String(key)}`);
    }
    normalize(registration);
    return new Builder(this.#graph.withPublicRegistrations({ [key]: registration }));
  }

  install<P extends object, R extends object, MC extends NeedConstraint, D extends Registrations>(
    module: Module<P, R, MC, D> & Introduces<From<E>, D> &
      Checked<Merge<From<E>, D>> &
      CheckedConstraints<C | MC, Provided<Merge<From<E>, D>>>,
  ): Builder<E | Entries<D>, C | MC> {
    return new Builder(this.#graph.withInstallation(moduleGraph(module)));
  }

  end(this: Builder<E, C> & Complete<From<E>> & CompleteConstraints<C, Provided<From<E>>>): Bag<From<E>, C> {
    return new Bag(this.#graph);
  }
}

export type { Bag };

export const DiBag: {
  begin: () => Builder<never>;
  module: typeof beginModule;
  withDisposal: typeof withDisposal;
  withMetadata: typeof withMetadata;
  mapSync: typeof mapSync;
  mapAsync: typeof mapAsync;
} = {
  begin: (): Builder<never> => new Builder(new BindingGraph()),
  module: beginModule,
  withDisposal,
  withMetadata,
  mapSync,
  mapAsync,
};
