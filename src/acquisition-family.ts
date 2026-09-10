import { libraryError } from './errors';
import type { BindingId } from './runtime';

export type AcquisitionId = symbol;
export interface AcquisitionHistory {
  readonly id: AcquisitionId;
  readonly previous: AcquisitionHistory | undefined;
}
export interface AttemptIdentity {
  readonly id: AcquisitionId;
  readonly bindingId: BindingId;
  readonly ownerId: symbol;
  readonly label: string;
  readonly dependencies: Set<AcquisitionId>;
  readonly ancestry: AcquisitionHistory | undefined;
  state: 'creating' | 'pending' | 'ready' | 'failed' | 'disposing' | 'disposed';
}

/** Family-wide identity and traversal only; finalizers stay with their owner. */
export class AcquisitionFamily {
  private readonly attempts = new Map<AcquisitionId, AttemptIdentity>();
  private readonly incoming = new Map<AcquisitionId, Set<AcquisitionId>>();
  private readonly constructing: AcquisitionId[] = [];

  // Only constructing/pending attempts can repeat an active binding+owner.
  private readonly active = new Map<BindingId, Map<symbol, Set<AcquisitionId>>>();

  add(attempt: AttemptIdentity): void {
    this.attempts.set(attempt.id, attempt);
    if (attempt.state !== 'creating' && attempt.state !== 'pending') return;
    let owners = this.active.get(attempt.bindingId);
    if (!owners) this.active.set(attempt.bindingId, owners = new Map());
    let ids = owners.get(attempt.ownerId);
    if (!ids) owners.set(attempt.ownerId, ids = new Set());
    ids.add(attempt.id);
  }

  deactivate(attempt: AttemptIdentity): void {
    const owners = this.active.get(attempt.bindingId);
    const ids = owners?.get(attempt.ownerId);
    if (!ids) return;
    ids.delete(attempt.id);
    if (!ids.size) owners!.delete(attempt.ownerId);
    if (!owners!.size) this.active.delete(attempt.bindingId);
  }
  release(attempt: AttemptIdentity): void {
    this.deactivate(attempt);
    // Remove this consumer from reverse indexes before its outgoing edges clear.
    for (const dependency of attempt.dependencies) {
      const consumers = this.incoming.get(dependency);
      consumers?.delete(attempt.id);
      if (consumers?.size === 0) this.incoming.delete(dependency);
    }
    this.incoming.delete(attempt.id);
    this.attempts.delete(attempt.id);
  }
  enter(attempt: AttemptIdentity): void { this.constructing.push(attempt.id); }
  leave(): void { this.constructing.pop(); }

  ancestry(bindingId: BindingId, ownerId: symbol, label: string, from?: AttemptIdentity): AcquisitionHistory | undefined {
    const source = from ?? this.attempts.get(this.constructing.at(-1)!);
    const ancestry = source ? { id: source.id, previous: source.ancestry } : undefined;
    // Most cold reads introduce an unrelated binding. Share history in O(1),
    // materializing the original label order only for a possible active cycle.
    if (!this.active.get(bindingId)?.has(ownerId)) return ancestry;
    const history: AcquisitionId[] = [];
    for (let entry = ancestry; entry; entry = entry.previous) history.push(entry.id);
    history.reverse();
    // A public synchronous resolve has no proxy edge, but is still construction.
    const active = [...new Set([...history, ...this.constructing])]
      .map(id => this.attempts.get(id))
      .filter((attempt): attempt is AttemptIdentity => !!attempt && (attempt.state === 'creating' || attempt.state === 'pending'));
    const repeated = active.findIndex(attempt => attempt.bindingId === bindingId && attempt.ownerId === ownerId);
    if (repeated !== -1) throw libraryError('DI_BAG_CYCLE', `cycle: ${[...active.slice(repeated).map(attempt => attempt.label), label].join(' -> ')}`, { path: Object.freeze([...active.slice(repeated).map(attempt => attempt.label), label]) });
    return ancestry;
  }

  dependencyPath(from: AttemptIdentity, dependency: string): readonly string[] {
    // Linked histories stay shared on successful acquisition; only diagnostics
    // materialize the consumer path in root-to-leaf order.
    const history: string[] = [];
    for (let entry = from.ancestry; entry; entry = entry.previous) {
      const label = this.attempts.get(entry.id)?.label;
      if (label !== undefined) history.push(label);
    }
    history.reverse();
    return Object.freeze([...history, from.label, dependency]);
  }

  retireIncoming(attempt: AttemptIdentity): void {
    const consumers = this.incoming.get(attempt.id);
    if (!consumers) return;
    for (const id of consumers) this.attempts.get(id)?.dependencies.delete(attempt.id);
    this.incoming.delete(attempt.id);
  }

  recordEdge(from: AttemptIdentity, to: AttemptIdentity): void {
    // A retained failed proxy may be used again, but its retired ID stays dead.
    if (!this.attempts.has(from.id)) return;
    // Re-reading an existing edge cannot introduce a new cycle.
    if (from.dependencies.has(to.id)) return;
    const path = this.path(to.id, from.id);
    if (path) {
      const labels = [...path, to.id].map(id => this.attempts.get(id)!.label);
      throw libraryError('DI_BAG_CYCLE', `cycle: ${labels.join(' -> ')}`, { path: Object.freeze(labels) });
    }
    from.dependencies.add(to.id);
    const consumers = this.incoming.get(to.id) ?? new Set<AcquisitionId>();
    consumers.add(from.id);
    this.incoming.set(to.id, consumers);
  }

  private path(from: AcquisitionId, to: AcquisitionId): AcquisitionId[] | undefined {
    const attempt = this.attempts.get(from);
    if (!attempt) return undefined;
    if (from === to) return [from];
    if (attempt.dependencies.size === 0) return undefined;
    const seen = new Set<AcquisitionId>([from]);
    const stack = [{ id: from, dependencies: attempt.dependencies.values() }];
    while (stack.length) {
      const next = stack[stack.length - 1]!.dependencies.next();
      if (next.done) { stack.pop(); continue; }
      const dependency = this.attempts.get(next.value);
      if (!dependency) continue;
      if (next.value === to) return [...stack.map(frame => frame.id), to];
      if (seen.has(next.value)) continue;
      seen.add(next.value);
      stack.push({ id: next.value, dependencies: dependency.dependencies.values() });
    }
    return undefined;
  }
}
