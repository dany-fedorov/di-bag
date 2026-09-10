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
export declare class AcquisitionFamily {
    private readonly attempts;
    private readonly incoming;
    private readonly constructing;
    private readonly active;
    add(attempt: AttemptIdentity): void;
    deactivate(attempt: AttemptIdentity): void;
    release(attempt: AttemptIdentity): void;
    enter(attempt: AttemptIdentity): void;
    leave(): void;
    ancestry(bindingId: BindingId, ownerId: symbol, label: string, from?: AttemptIdentity): AcquisitionHistory | undefined;
    retireIncoming(attempt: AttemptIdentity): void;
    recordEdge(from: AttemptIdentity, to: AttemptIdentity): void;
    private path;
}
