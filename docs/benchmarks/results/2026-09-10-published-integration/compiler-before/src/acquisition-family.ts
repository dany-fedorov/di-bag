import type { BindingId } from './runtime';

export type AcquisitionId = symbol;
export interface AttemptIdentity {
  readonly id: AcquisitionId;
  readonly bindingId: BindingId;
  readonly ownerId: symbol;
  readonly label: string;
  readonly dependencies: Set<AcquisitionId>;
  readonly ancestry: readonly AcquisitionId[];
  state: 'creating' | 'pending' | 'ready' | 'failed' | 'disposing' | 'disposed';
}

/** Family-wide identity and traversal only; finalizers stay with their owner. */
export class AcquisitionFamily {
  private readonly attempts = new Map<AcquisitionId, AttemptIdentity>();
  private readonly incoming = new Map<AcquisitionId, Set<AcquisitionId>>();
  private readonly constructing: AcquisitionId[] = [];

  add(attempt: AttemptIdentity): void { this.attempts.set(attempt.id, attempt); }
  release(attempt: AttemptIdentity): void {
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

  ancestry(bindingId: BindingId, ownerId: symbol, label: string, from?: AttemptIdentity): readonly AcquisitionId[] {
    const source = from ?? this.attempts.get(this.constructing.at(-1)!);
    const ancestry = source ? [...source.ancestry, source.id] : [];
    // A public synchronous resolve has no proxy edge, but is still construction.
    const active = [...new Set([...ancestry, ...this.constructing])]
      .map(id => this.attempts.get(id))
      .filter((attempt): attempt is AttemptIdentity => !!attempt && (attempt.state === 'creating' || attempt.state === 'pending'));
    const repeated = active.findIndex(attempt => attempt.bindingId === bindingId && attempt.ownerId === ownerId);
    if (repeated !== -1) throw new Error(`cycle: ${[...active.slice(repeated).map(attempt => attempt.label), label].join(' -> ')}`);
    return ancestry;
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
      throw new Error(`cycle: ${labels.join(' -> ')}`);
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
