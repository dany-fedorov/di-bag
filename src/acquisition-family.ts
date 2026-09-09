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
  private readonly constructing: AcquisitionId[] = [];

  add(attempt: AttemptIdentity): void { this.attempts.set(attempt.id, attempt); }
  release(attempt: AttemptIdentity): void { this.attempts.delete(attempt.id); }
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
    for (const consumer of this.attempts.values()) consumer.dependencies.delete(attempt.id);
  }

  recordEdge(from: AttemptIdentity, to: AttemptIdentity): void {
    // A retained failed proxy may be used again, but its retired ID stays dead.
    if (!this.attempts.has(from.id)) return;
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
}
