import { libraryTypeError } from './errors';
import type { AcquisitionMetadataPresence } from './inspection';
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
  readonly registrationMetadata: Readonly<object>;
  readonly acquisitionMetadata: AcquisitionMetadataPresence<readonly unknown[]>;
}
/**
 * A frozen discriminated lifecycle transition emitted after the corresponding state change.
 * Narrow on `kind` to access failure, cleanup outcome, or disposal-index fields.
 */
export type LifecycleEvent =
  | (ScopeEventFields & { readonly kind: 'scope-opened' })
  | (ScopeEventFields & { readonly kind: 'scope-closing' })
  | (ScopeEventFields & { readonly kind: 'scope-closed' })
  | (ScopeEventFields & { readonly kind: 'scope-close-failed'; readonly error: unknown })
  | (AcquisitionEventFields & { readonly kind: 'acquisition-started' })
  | (AcquisitionEventFields & { readonly kind: 'acquisition-ready' })
  | (AcquisitionEventFields & { readonly kind: 'cleanup-started' })
  | (AcquisitionEventFields & { readonly kind: 'acquisition-failed'; readonly error: unknown })
  | (AcquisitionEventFields & { readonly kind: 'cleanup-failed'; readonly error: unknown; readonly disposalSequence: number })
  | (AcquisitionEventFields & { readonly kind: 'cleanup-completed'; readonly outcome: 'success' | 'failure' });
/** A failure thrown or rejected by an observer together with its original event. */
export interface ObserverFailure {
  readonly error: unknown;
  readonly event: LifecycleEvent;
}
/** An asynchronous, non-gating callback for frozen lifecycle events. */
export type ObserverCallback = (this: void, event: LifecycleEvent) => unknown;
/** Reports failures from one observer's event callback; its own failures are consumed. */
export type ObserverErrorCallback = (this: void, failure: ObserverFailure) => unknown;
/** Both callbacks required by {@link DiBagApi.withConfiguration}. */
export interface ObserverOptions {
  /** Receives events in transition and observer-registration order on a microtask queue. */
  readonly onEvent: ObserverCallback;
  /** Receives synchronous throws and rejected results from `onEvent`. */
  readonly onError: ObserverErrorCallback;
}

const then = Promise.prototype.then<void, void>;
const ignore = () => {};
/** Assimilate only callback results, always through a library-owned Promise. */
function monitor(result: unknown, failed: (error: unknown) => void): void {
  if ((typeof result !== 'object' || result === null) && typeof result !== 'function') return;
  const pending = new Promise<unknown>(resolve => { resolve(result); });
  then.call(pending, ignore, failed);
}
// One lazy queue preserves ordering when a callback observes multiple facades.
let queue: Array<{ event: LifecycleEvent; callbacks: readonly ObserverOptions[] }> | undefined;
export class LifecycleObservers {
  private constructor(private readonly callbacks: readonly ObserverOptions[]) {}

  static append(previous: LifecycleObservers | undefined, options: ObserverOptions): LifecycleObservers {
    if (typeof options !== 'object' || options === null) throw libraryTypeError('DI_BAG_INVALID_CONFIGURATION', 'withConfiguration observers require onEvent and onError callbacks', { operation: 'withConfiguration' });
    const { onEvent, onError } = options;
    if (typeof onEvent !== 'function' || typeof onError !== 'function') throw libraryTypeError('DI_BAG_INVALID_CONFIGURATION', 'withConfiguration observers require onEvent and onError callbacks', { operation: 'withConfiguration' });
    return new LifecycleObservers([...(previous?.callbacks ?? []), Object.freeze({ onEvent, onError })]);
  }

  emit(event: LifecycleEvent): void {
    const delivery = { event: Object.freeze(event), callbacks: this.callbacks };
    if (queue) { queue.push(delivery); return; }
    queue = [delivery];
    queueMicrotask(() => {
      // Detach this batch: reentrant transitions schedule another microtask.
      const deliveries = queue!;
      queue = undefined;
      for (const { event, callbacks } of deliveries) for (const { onEvent, onError } of callbacks) {
        const failed = (error: unknown) => {
          try { monitor(onError(Object.freeze({ error, event })), ignore); }
          catch { /* Error reporting must not recursively report itself. */ }
        };
        try { monitor(onEvent(event), failed); }
        catch (error) { failed(error); }
      }
    });
  }
}
