import type { FramePresenceTuple } from './inspection';
import type { Lifetime } from './lifetime';
/** Identity shared by lifecycle events for one owning scope. */
export interface ScopeEventFields {
    /** The scope that owns the transition. */
    readonly scopeId: symbol;
    /** The tracked parent, present only for child-scope events. */
    readonly parentScopeId?: symbol;
}
/** Copied binding and acquisition details carried by acquisition and cleanup events. */
export interface AcquisitionEventFields {
    readonly scopeId: symbol;
    readonly bindingId: symbol;
    readonly acquisitionId: symbol;
    readonly label: string;
    readonly lifetime: Lifetime;
    readonly metadata: Readonly<object>;
    readonly frames: FramePresenceTuple<readonly unknown[]>;
}
/**
 * A frozen discriminated lifecycle transition emitted after the corresponding state change.
 * Narrow on `kind` to access failure, cleanup outcome, or disposal-index fields.
 */
export type LifecycleEvent = (ScopeEventFields & {
    readonly kind: 'scope-opened';
}) | (ScopeEventFields & {
    readonly kind: 'scope-closing';
}) | (ScopeEventFields & {
    readonly kind: 'scope-closed';
}) | (ScopeEventFields & {
    readonly kind: 'scope-close-failed';
    readonly error: unknown;
}) | (AcquisitionEventFields & {
    readonly kind: 'acquisition-started';
}) | (AcquisitionEventFields & {
    readonly kind: 'acquisition-ready';
}) | (AcquisitionEventFields & {
    readonly kind: 'cleanup-started';
}) | (AcquisitionEventFields & {
    readonly kind: 'acquisition-failed';
    readonly error: unknown;
}) | (AcquisitionEventFields & {
    readonly kind: 'cleanup-failed';
    readonly error: unknown;
    readonly disposalIndex: number;
}) | (AcquisitionEventFields & {
    readonly kind: 'cleanup-completed';
    readonly outcome: 'success' | 'failure';
});
/** A failure thrown or rejected by an observer together with its original event. */
export interface ObserverFailure {
    readonly error: unknown;
    readonly event: LifecycleEvent;
}
/** An asynchronous, non-gating callback for frozen lifecycle events. */
export type ObserverCallback = (this: void, event: LifecycleEvent) => unknown;
/** Reports failures from one observer's event callback; its own failures are consumed. */
export type ObserverErrorCallback = (this: void, failure: ObserverFailure) => unknown;
/** Both callbacks required by {@link Facade.observe}. */
export interface ObserverOptions {
    /** Receives events in transition and observer-registration order on a microtask queue. */
    readonly onEvent: ObserverCallback;
    /** Receives synchronous throws and rejected results from `onEvent`. */
    readonly onError: ObserverErrorCallback;
}
export declare class Observers {
    private readonly callbacks;
    private constructor();
    static append(previous: Observers | undefined, options: ObserverOptions): Observers;
    emit(event: LifecycleEvent): void;
}
