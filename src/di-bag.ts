import { normalize, withDisposal } from './registration';
import type { Registrations } from './registration';
import type { Checked, Complete, Merge, Overrides, Provided } from './types';

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
export class Bag<R extends Registrations> {
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
  fork<O extends Registrations>(
    overrides: O &
      Overrides<R, O> &
      Checked<Merge<R, O>> &
      Complete<Merge<R, O>>,
  ): Bag<Merge<R, O>> {
    this.assertOpen();
    for (const token of Object.keys(overrides)) {
      if (!Object.hasOwn(this.registrations, token)) {
        throw new Error(`fork accepts existing tokens only: ${token}`);
      }
    }
    return new Bag({ ...this.registrations, ...overrides } as Merge<R, O>);
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

class Builder<R extends Registrations> {
  constructor(private readonly registrations: R) {}

  add<N extends Registrations>(
    more: N & Checked<Merge<R, N>>,
  ): Builder<Merge<R, N>> {
    return new Builder({ ...this.registrations, ...more } as Merge<R, N>);
  }

  end(this: Builder<R> & Complete<R>): Bag<R> {
    return new Bag(this.registrations);
  }
}

export const DiBag = {
  begin: (): Builder<Record<never, never>> => new Builder({}),
  withDisposal,
};
