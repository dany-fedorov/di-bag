import { DiBagCleanupError } from './errors';
import type { CleanupFailure } from './errors';
import type { BindingGraph, BindingId } from './runtime';
import type { AcquisitionSnapshot } from './inspection';

type AcquisitionId = symbol;
type State = 'creating' | 'pending' | 'ready' | 'failed' | 'disposing' | 'disposed';
interface Ownership {
  readonly value: unknown;
  readonly dispose: (value: never) => void | Promise<void>;
}
interface Acquisition {
  readonly id: AcquisitionId;
  readonly bindingId: BindingId;
  readonly ownerId: symbol;
  readonly label: string;
  readonly dependencies: Set<AcquisitionId>;
  state: State;
  exposed: unknown;
  ownership: Ownership | undefined;
  pending: Promise<void> | undefined;
}

const observePromise = Promise.prototype.then<void, void>;

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    'then' in value &&
    typeof value.then === 'function'
  );
}

/** Mutable, runtime-local attempts. Binding descriptions never carry ownership. */
export class Acquisitions {
  private readonly ownerId = Symbol('owner');
  private readonly cache = new Map<BindingId, Acquisition>();
  private readonly attempts = new Map<AcquisitionId, Acquisition>();
  private readonly pending = new Map<AcquisitionId, Promise<void>>();
  // Insertion order is successful ownership acceptance order, including promises.
  private readonly owned = new Map<AcquisitionId, Acquisition>();
  private state: 'open' | 'closing' | 'closed' = 'open';
  private closing: Promise<void> | undefined;

  constructor(private readonly graph: BindingGraph) {}

  resolve(key: string): unknown {
    this.assertOpen();
    return this.resolveBinding(this.graph.publicBinding(key));
  }

  inspect(bindingId: BindingId): readonly AcquisitionSnapshot[] {
    const snapshots: AcquisitionSnapshot[] = [];
    for (const attempt of this.attempts.values()) {
      if (attempt.bindingId !== bindingId) continue;
      snapshots.push(Object.freeze({
        acquisitionId: attempt.id,
        state: attempt.state,
        metadata: Object.freeze([] as const),
      }));
    }
    return Object.freeze(snapshots);
  }

  assertOpen(): void {
    if (this.state !== 'open') throw new Error(`bag is ${this.state}`);
  }

  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.state = 'closing';
    // Publish the barrier before invoking any finalizer, including reentrant ones.
    this.closing = Promise.resolve().then(() => this.disposeAll());
    return this.closing;
  }

  private resolveBinding(bindingId: BindingId, from?: Acquisition): unknown {
    const cached = this.cache.get(bindingId);
    if (cached) {
      if (from) this.recordEdge(from, cached);
      // A factory or then getter can reenter through public resolve as well.
      if (cached.state === 'creating') throw new Error(`cycle: ${cached.label} -> ${cached.label}`);
      return cached.exposed;
    }
    const { create, dispose } = this.graph.registration(bindingId);
    const attempt: Acquisition = {
      id: Symbol(this.graph.label(bindingId)),
      bindingId,
      ownerId: this.ownerId,
      label: this.graph.label(bindingId),
      dependencies: new Set(),
      state: 'creating',
      exposed: undefined,
      ownership: undefined,
      pending: undefined,
    };
    this.cache.set(bindingId, attempt);
    this.attempts.set(attempt.id, attempt);
    if (from) this.recordEdge(from, attempt);
    const deps = new Proxy(Object.create(null) as Record<string, unknown>, {
      get: (_, key) => {
        if (typeof key !== 'string') return undefined;
        // Only this attempt's in-flight factory can discover dependencies in close.
        if (
          this.state === 'closed' ||
          (this.state === 'closing' && attempt.state !== 'creating' && attempt.state !== 'pending')
        ) {
          throw new Error(`bag is ${this.state}`);
        }
        return this.resolveBinding(this.graph.dependency(bindingId, key), attempt);
      },
    });
    const acquired = (value: unknown) => {
      attempt.state = 'ready';
      if (dispose) {
        attempt.ownership = { value, dispose };
        this.owned.set(attempt.id, attempt);
      }
    };
    try {
      // The checked facade validates factory parameter shapes before graph creation.
      const value = create(deps as never);
      attempt.exposed = value;
      if (isThenable(value)) {
        // Only intrinsic observation establishes native Promise state. Do not
        // assimilate structural inputs or retry constructor/species setup errors.
        // The observer's species result is user-controlled, so drain our own barrier.
        let settled!: () => void;
        const observed = new Promise<void>(resolve => { settled = resolve; });
        observePromise.call(
          value,
          fulfilled => {
            acquired(fulfilled);
            this.finishPending(attempt);
            settled();
          },
          () => {
            this.finishPending(attempt);
            this.evictIfCurrent(attempt);
            settled();
          },
        );
        attempt.state = 'pending';
        attempt.pending = observed;
        this.pending.set(attempt.id, observed);
      } else {
        acquired(value);
      }
      return value;
    } catch (error) {
      // Failed creation, inspection or observer setup has not transferred ownership.
      this.finishPending(attempt);
      this.evictIfCurrent(attempt);
      throw error;
    }
  }

  private finishPending(attempt: Acquisition): void {
    this.pending.delete(attempt.id);
    attempt.pending = undefined;
  }

  private evictIfCurrent(attempt: Acquisition): void {
    if (this.cache.get(attempt.bindingId) === attempt) this.cache.delete(attempt.bindingId);
    attempt.dependencies.clear();
    attempt.state = 'failed';
    attempt.exposed = undefined;
    // Incoming IDs can safely dangle: traversal never substitutes a cached retry.
    if (!attempt.ownership && !attempt.pending) this.attempts.delete(attempt.id);
  }

  private recordEdge(from: Acquisition, to: Acquisition): void {
    const path = this.path(to.id, from.id, new Set());
    if (path) {
      const labels = [...path, to.id].map(id => this.attempts.get(id)!.label);
      throw new Error(`cycle: ${labels.join(' -> ')}`);
    }
    from.dependencies.add(to.id);
  }

  private path(from: AcquisitionId, to: AcquisitionId, seen: Set<AcquisitionId>): AcquisitionId[] | undefined {
    const attempt = this.attempts.get(from);
    if (!attempt) return undefined;
    if (from === to) return [from];
    if (seen.has(from)) return undefined;
    seen.add(from);
    for (const dependency of attempt.dependencies) {
      const rest = this.path(dependency, to, seen);
      if (rest) return [from, ...rest];
    }
    return undefined;
  }

  private async disposeAll(): Promise<void> {
    const failures: CleanupFailure[] = [];
    try {
      // Pending factories may start more dependencies; drain to a fixed point.
      while (this.pending.size > 0) await Promise.all(this.pending.values());
      const ordered: Acquisition[] = [];
      const visited = new Set<AcquisitionId>();
      const visit = (id: AcquisitionId) => {
        if (visited.has(id)) return;
        visited.add(id);
        const attempt = this.attempts.get(id);
        if (!attempt) return;
        for (const dependency of attempt.dependencies) visit(dependency);
        if (attempt.ownership) ordered.push(attempt);
      };
      for (const id of this.owned.keys()) visit(id);
      for (const attempt of ordered.reverse()) {
        const { dispose, value } = attempt.ownership!;
        attempt.state = 'disposing';
        try {
          await dispose(value as never);
        } catch (error) {
          failures.push({ acquisitionId: attempt.id, bindingId: attempt.bindingId, label: attempt.label, error });
        } finally {
          attempt.state = 'disposed';
          attempt.ownership = undefined;
        }
      }
    } finally {
      this.state = 'closed';
      for (const attempt of this.attempts.values()) {
        attempt.dependencies.clear();
        attempt.exposed = undefined;
        attempt.ownership = undefined;
        attempt.pending = undefined;
      }
      this.cache.clear();
      this.attempts.clear();
      this.pending.clear();
      this.owned.clear();
    }
    if (failures.length > 0) throw new DiBagCleanupError(failures);
  }
}
