import { normalize, withDisposal } from './registration';
import type { Registration, Registrations } from './registration';
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

type Cleanup = () => void | Promise<void>;

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    'then' in value &&
    typeof value.then === 'function'
  );
}

/** A lazy graph with independent memoization and resource ownership. */
class Bag<R extends Registrations> {
  private readonly registrations: R;
  private readonly memo = new Map<string, unknown>();
  private readonly edges = new Map<string, Set<string>>();
  private readonly pending = new Map<string, Promise<void>>();
  private readonly creating = new Set<string>();
  private readonly cleanups = new Map<string, Cleanup>();
  private state: 'open' | 'closing' | 'closed' = 'open';
  private closing: Promise<void> | undefined;

  constructor(registrations: R) {
    this.registrations = Object.freeze({ ...registrations });
  }

  resolve<K extends keyof R & string>(token: K): Provided<R>[K] {
    this.assertOpen();
    return this.resolveToken(token) as Provided<R>[K];
  }

  /** Replace existing tokens; the fork creates and owns its own instances. */
  fork(): Bag<R>;
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
      Complete<Merge<R, Selected<K, O>>>,
  ): Bag<Merge<R, Selected<K, O>>>;
  fork(keys?: readonly unknown[], overrides?: object): Bag<Registrations> {
    this.assertOpen();
    if (keys === undefined && overrides === undefined) {
      return new Bag(this.registrations);
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
      if (!Object.hasOwn(this.registrations, token)) {
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
    return new Bag({ ...this.registrations, ...selected });
  }

  /** Drain acquisitions, then dispose dependents before dependencies, once. */
  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.state = 'closing';
    // Defer cleanup until this.closing is set, including for reentrant close calls.
    this.closing = Promise.resolve().then(() => this.disposeAll());
    return this.closing;
  }

  private assertOpen(): void {
    if (this.state !== 'open') throw new Error(`bag is ${this.state}`);
  }

  private resolveToken(token: string): unknown {
    if (this.memo.has(token)) return this.memo.get(token);
    if (!Object.hasOwn(this.registrations, token))
      throw new Error(`no factory for ${token}`);
    const registration = this.registrations[token];
    if (registration === undefined) throw new Error(`no factory for ${token}`);
    const { create, dispose } = normalize(registration);
    this.edges.set(token, new Set());
    const deps = new Proxy(Object.create(null) as Record<string, unknown>, {
      get: (_, key) => {
        if (typeof key !== 'string') return undefined;
        // A factory already in flight may finish discovering its dependencies
        // during shutdown. Resolved services cannot start new work during close.
        if (
          this.state === 'closed' ||
          (this.state === 'closing' &&
            !this.pending.has(token) &&
            !this.creating.has(token))
        ) {
          throw new Error(`bag is ${this.state}`);
        }
        this.recordEdge(token, key);
        return this.resolveToken(key);
      },
    });

    // Checked proves that the lazy proxy supplies each factory's parameter shape.
    let value: unknown;
    this.creating.add(token);
    try {
      value = create(deps as never);
    } catch (error) {
      this.edges.delete(token);
      throw error;
    } finally {
      this.creating.delete(token);
    }
    this.memo.set(token, value);
    const acquired = (fulfilled: unknown) => {
      if (dispose) this.cleanups.set(token, () => dispose(fulfilled as never));
    };
    try {
      if (isThenable(value)) {
        // Preserve the original return value/promise. This observer never rejects.
        const observed = Promise.resolve(value).then(
          (fulfilled) => {
            acquired(fulfilled);
            this.pending.delete(token);
          },
          () => {
            this.memo.delete(token);
            this.edges.delete(token);
            this.pending.delete(token);
          },
        );
        this.pending.set(token, observed);
      } else {
        acquired(value);
      }
    } catch (error) {
      // Inspection and observer setup can execute user getters or methods.
      // An unclassified result has not transferred fulfilled-value ownership.
      this.memo.delete(token);
      this.edges.delete(token);
      this.pending.delete(token);
      throw error;
    }
    return value;
  }

  private recordEdge(from: string, to: string): void {
    const path = this.path(to, from, new Set());
    if (path) throw new Error(`cycle: ${[...path, to].join(' -> ')}`);
    this.edges.get(from)?.add(to);
  }

  private path(
    from: string,
    to: string,
    seen: Set<string>,
  ): string[] | undefined {
    if (from === to) return [from];
    if (seen.has(from)) return undefined;
    seen.add(from);
    for (const dependency of this.edges.get(from) ?? []) {
      const rest = this.path(dependency, to, seen);
      if (rest) return [from, ...rest];
    }
    return undefined;
  }

  private async disposeAll(): Promise<void> {
    let failed = false;
    let firstError: unknown;
    try {
      // Pending factories can start further dependencies, so drain to a fixed point.
      while (this.pending.size > 0) await Promise.all(this.pending.values());
      const ordered: Cleanup[] = [];
      const visited = new Set<string>();
      const visit = (token: string) => {
        if (visited.has(token)) return;
        visited.add(token);
        for (const dependency of this.edges.get(token) ?? []) visit(dependency);
        const cleanup = this.cleanups.get(token);
        if (cleanup) ordered.push(cleanup);
      };
      for (const token of this.cleanups.keys()) visit(token);
      for (const cleanup of ordered.reverse()) {
        try {
          await cleanup();
        } catch (error) {
          if (!failed) {
            failed = true;
            firstError = error;
          }
        }
      }
    } finally {
      this.state = 'closed';
      this.memo.clear();
      this.edges.clear();
      this.cleanups.clear();
    }
    if (failed) throw firstError;
  }
}

class Builder<E extends Entry> {
  constructor(private readonly registrations: From<E>) {}

  // Infer actual keys before checking context-sensitive method-returning factories.
  add<N extends { [K in keyof N]: Registration }>(
    more: N & Registrations & Introduces<From<E>, N> & Checked<Merge<From<E>, N>>,
  ): Builder<E | Entries<N>> {
    if (typeof more !== 'object' || more === null || Array.isArray(more)) {
      throw new Error('registrations must be a string-keyed object');
    }
    const keys = Reflect.ownKeys(more);
    for (const key of keys) {
      if (typeof key !== 'string') throw new Error('registration keys must be strings');
      if (Object.hasOwn(this.registrations, key)) {
        throw new Error(`duplicate registration: ${key}`);
      }
    }
    const snapshot: Registrations = Object.create(null);
    for (const key of keys as string[]) {
      const registration = more[key];
      normalize(registration);
      snapshot[key] = registration as Registration;
    }
    // The snapshot retains every checked own registration, including hidden keys.
    return new Builder(
      { ...this.registrations, ...snapshot } as From<E | Entries<N>>,
    );
  }

  replace<const K extends string, V extends Registration>(
    key: K & ReplacementKey<From<E>, K>,
    registration: V & Registration & Checked<Merge<From<E>, Record<K, NoInfer<V>>>>,
  ): Builder<Exclude<E, { key: K }> | { key: K; registration: V }> {
    if (typeof key !== 'string' || !Object.hasOwn(this.registrations, key)) {
      throw new Error(`replace accepts existing tokens only: ${String(key)}`);
    }
    normalize(registration);
    return new Builder(
      { ...this.registrations, [key]: registration } as From<
        Exclude<E, { key: K }> | { key: K; registration: V }
      >,
    );
  }

  end(this: Builder<E> & Complete<From<E>>): Bag<From<E>> {
    return new Bag(this.registrations);
  }
}

export type { Bag };

export const DiBag = {
  begin: (): Builder<never> => new Builder({}),
  withDisposal,
};
