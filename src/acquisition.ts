import { DiBagCleanupError } from './errors';
import type { CleanupFailure } from './errors';
import type { BindingGraph, BindingId, BindingKey } from './runtime';
import type { AcquisitionSnapshot } from './inspection';
import { ProviderExecution } from './provider-execution';
import type { RuntimeContext } from './acquisition-mode';

type AcquisitionId = symbol;
type State = 'creating' | 'pending' | 'ready' | 'failed' | 'disposing' | 'disposed';
interface Acquisition {
  readonly id: AcquisitionId;
  readonly bindingId: BindingId;
  readonly ownerId: symbol;
  readonly label: string;
  readonly dependencies: Set<AcquisitionId>;
  state: State;
  exposed: unknown;
  execution: ProviderExecution;
}

/** Mutable, runtime-local attempts. Binding descriptions never carry ownership. */
export class Acquisitions {
  private readonly ownerId = Symbol('owner');
  private readonly cache = new Map<BindingId, Acquisition>();
  private readonly attempts = new Map<AcquisitionId, Acquisition>();
  private readonly retired = new Map<AcquisitionId, Promise<void>>();
  private readonly failures: (CleanupFailure & { sequence: number })[] = [];
  private invocationSequence = 0;
  // Insertion order is successful ownership acceptance order, including promises.
  private readonly owned = new Map<AcquisitionId, Acquisition>();
  private state: 'open' | 'closing' | 'closed' = 'open';
  private closing: Promise<void> | undefined;

  constructor(private readonly graph: BindingGraph, private readonly context: RuntimeContext) {}

  resolve(key: BindingKey): unknown {
    this.assertOpen();
    return this.resolveBinding(this.graph.publicBinding(key));
  }

  inspect(bindingId: BindingId): readonly AcquisitionSnapshot<readonly unknown[]>[] {
    const snapshots: AcquisitionSnapshot<readonly unknown[]>[] = [];
    for (const attempt of this.attempts.values()) {
      if (attempt.bindingId !== bindingId) continue;
      snapshots.push(Object.freeze({
        acquisitionId: attempt.id,
        state: attempt.state,
        metadata: attempt.execution.inspectFrames(),
      }));
    }
    return Object.freeze(snapshots);
  }

  assertOpen(): void {
    if (this.state !== 'open') throw new Error(`bag is ${this.state}`);
  }

  close(beforeDispose?: Promise<void>): Promise<void> {
    if (this.closing) return this.closing;
    this.state = 'closing';
    // Publish the barrier before invoking any finalizer, including reentrant ones.
    this.closing = Promise.resolve().then(() => this.disposeAll(beforeDispose));
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
    const description = this.graph.registration(bindingId);
    const attempt: Acquisition = {
      id: Symbol(this.graph.label(bindingId)),
      bindingId,
      ownerId: this.ownerId,
      label: this.graph.label(bindingId),
      dependencies: new Set(),
      state: 'creating',
      exposed: undefined,
      execution: new ProviderExecution({
        accepted: () => { this.owned.set(attempt.id, attempt); },
        settled: () => {
          if (attempt.execution.state === 'failed') this.retire(attempt);
          else attempt.state = 'ready';
        },
        invoking: () => this.invocationSequence++,
        cleanupFailed: (sequence, error) => {
          this.failures.push({ sequence, acquisitionId: attempt.id, bindingId: attempt.bindingId, label: attempt.label, error });
        },
      }, description, this.context),
    };
    this.cache.set(bindingId, attempt);
    this.attempts.set(attempt.id, attempt);
    if (from) this.recordEdge(from, attempt);
    const deps = new Proxy(Object.create(null) as Record<string, unknown>, {
      get: (_, key) => {
        if (typeof key === 'symbol' && !description.tokenKeys.includes(key)) return undefined;
        // Only this attempt's in-flight factory can discover dependencies in close.
        if (
          this.state === 'closed' ||
          (this.state === 'closing' && !attempt.execution.sourceInFlight)
        ) {
          throw new Error(`bag is ${this.state}`);
        }
        return this.resolveBinding(this.graph.dependency(bindingId, key), attempt);
      },
    });
    try {
      const value = attempt.execution.evaluate(description, deps);
      attempt.exposed = value;
      attempt.state = attempt.execution.state;
      return value;
    } catch (error) {
      this.retire(attempt);
      throw error;
    }
  }

  private retire(attempt: Acquisition): void {
    if (this.cache.get(attempt.bindingId) === attempt) this.cache.delete(attempt.bindingId);
    attempt.state = 'failed';
    attempt.exposed = undefined;
    // No consumer acquired this failed exposed value. Keep this attempt's
    // outgoing edges and pending work, but abandon unsuccessful incoming reads.
    for (const consumer of this.attempts.values()) consumer.dependencies.delete(attempt.id);
    if (this.retired.has(attempt.id)) return;
    const release = () => {
      attempt.dependencies.clear();
      attempt.execution.release();
      this.attempts.delete(attempt.id);
      this.owned.delete(attempt.id);
      this.retired.delete(attempt.id);
    };
    // Incoming IDs may dangle; never substitute a cached retry's identity.
    if (!attempt.execution.hasOwnership && !attempt.execution.work.length) { release(); return; }
    const cleanup = attempt.execution.dispose().then(release);
    this.retired.set(attempt.id, cleanup);
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

  private async disposeAll(beforeDispose?: Promise<void>): Promise<void> {
    let failures: CleanupFailure[] = [];
    try {
      if (beforeDispose) await beforeDispose;
      // Sources and projections can still acquire dependencies or retire work.
      while (true) {
        const work = [...this.retired.values(), ...[...this.attempts.values()].flatMap(attempt => attempt.execution.work)];
        if (!work.length) break;
        await Promise.all(work);
      }
      const ordered: Acquisition[] = [];
      const visited = new Set<AcquisitionId>();
      const visit = (id: AcquisitionId) => {
        if (visited.has(id)) return;
        visited.add(id);
        const attempt = this.attempts.get(id);
        if (!attempt) return;
        for (const dependency of attempt.dependencies) visit(dependency);
        if (attempt.execution.hasOwnership) ordered.push(attempt);
      };
      for (const id of this.owned.keys()) visit(id);
      for (const attempt of ordered.reverse()) {
        attempt.state = 'disposing';
        await attempt.execution.dispose();
        attempt.state = 'disposed';
      }
      failures = [...this.failures].sort((a, b) => a.sequence - b.sequence)
        .map(({ acquisitionId, bindingId, label, error }) => ({ acquisitionId, bindingId, label, error }));
    } finally {
      this.state = 'closed';
      for (const attempt of this.attempts.values()) {
        attempt.dependencies.clear();
        attempt.exposed = undefined;
        attempt.execution.release();
      }
      this.cache.clear();
      this.attempts.clear();
      this.retired.clear();
      this.failures.length = 0;
      this.owned.clear();
    }
    if (failures.length > 0) throw new DiBagCleanupError(failures);
  }
}
