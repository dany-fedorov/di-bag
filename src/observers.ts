import { libraryTypeError } from './errors';
import type { AcquisitionMetadataPresence } from './inspection';
import type { Lifetime } from './lifetime';

/**
 * Identity shared by lifecycle events for one owning container.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#observe-lifecycle-transitions
 */
export interface ContainerEventFields {
  /** The container that owns the transition. */
  readonly containerId: symbol;
  /** The tracked parent, present only for child-container events. */
  readonly parentContainerId?: symbol;
}
/**
 * Copied binding and acquisition details carried by acquisition and disposal events.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#observe-lifecycle-transitions
 */
export interface AcquisitionEventFields {
  readonly containerId: symbol;
  readonly bindingId: symbol;
  readonly acquisitionId: symbol;
  readonly bindingLabel: string;
  readonly lifetime: Lifetime;
  readonly registrationMetadata: Readonly<object>;
  readonly acquisitionMetadata: AcquisitionMetadataPresence<readonly unknown[]>;
}
/**
 * A frozen discriminated lifecycle transition emitted after the corresponding state change.
 * Narrow on `kind` to access failure, disposal outcome, or disposal-index fields.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#observe-lifecycle-transitions
 */
export type LifecycleEvent =
  | (ContainerEventFields & { readonly kind: 'container-opened' })
  | (ContainerEventFields & { readonly kind: 'container-closing' })
  | (ContainerEventFields & { readonly kind: 'container-closed' })
  | (ContainerEventFields & { readonly kind: 'container-close-failed'; readonly error: unknown })
  | (AcquisitionEventFields & { readonly kind: 'acquisition-started' })
  | (AcquisitionEventFields & { readonly kind: 'acquisition-ready' })
  | (AcquisitionEventFields & { readonly kind: 'disposal-started' })
  | (AcquisitionEventFields & { readonly kind: 'acquisition-failed'; readonly error: unknown })
  | (AcquisitionEventFields & { readonly kind: 'disposal-failed'; readonly error: unknown; readonly disposalSequence: number })
  | (AcquisitionEventFields & { readonly kind: 'disposal-completed'; readonly outcome: 'success' | 'failure' });
/**
 * A failure thrown or rejected by an observer together with its original event.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#observe-lifecycle-transitions
 */
export interface ObserverFailure {
  readonly error: unknown;
  readonly event: LifecycleEvent;
}
/**
 * An asynchronous, non-gating callback for frozen lifecycle events.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#observe-lifecycle-transitions
 */
export type ObserverCallback = (this: void, event: LifecycleEvent) => unknown;
/**
 * Reports failures from one observer's event callback; its own failures are consumed.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#observe-lifecycle-transitions
 */
export type ObserverErrorCallback = (this: void, failure: ObserverFailure) => unknown;
/**
 * Both callbacks required by {@link DiBagApi.withConfiguration}.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#observe-lifecycle-transitions
 */
export interface LifecycleObserver {
  /** Receives events in transition and observer attachment order on a microtask queue. */
  readonly onLifecycleEvent: ObserverCallback;
  /** Receives synchronous throws and rejected results from `onLifecycleEvent`. */
  readonly onObserverFailure: ObserverErrorCallback;
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
let queue: Array<{ event: LifecycleEvent; callbacks: readonly LifecycleObserver[] }> | undefined;
export class LifecycleObservers {
  private constructor(private readonly callbacks: readonly LifecycleObserver[]) {}

  static append(previous: LifecycleObservers | undefined, observer: unknown): LifecycleObservers {
    if (typeof observer !== 'object' || observer === null) {
      throw libraryTypeError('DI_BAG_INVALID_ARGUMENT', 'withConfiguration lifecycleObservers require onLifecycleEvent and onObserverFailure callbacks', { operation: 'withConfiguration', argument: 'lifecycleObservers[]', expected: 'an object' });
    }
    const onLifecycleEvent = Reflect.get(observer, 'onLifecycleEvent') as unknown;
    const onObserverFailure = Reflect.get(observer, 'onObserverFailure') as unknown;
    if (typeof onLifecycleEvent !== 'function') {
      throw libraryTypeError('DI_BAG_INVALID_ARGUMENT', 'withConfiguration lifecycleObservers require onLifecycleEvent and onObserverFailure callbacks', { operation: 'withConfiguration', argument: 'lifecycleObservers[].onLifecycleEvent', expected: 'a function' });
    }
    if (typeof onObserverFailure !== 'function') {
      throw libraryTypeError('DI_BAG_INVALID_ARGUMENT', 'withConfiguration lifecycleObservers require onLifecycleEvent and onObserverFailure callbacks', { operation: 'withConfiguration', argument: 'lifecycleObservers[].onObserverFailure', expected: 'a function' });
    }
    return new LifecycleObservers([...(previous?.callbacks ?? []), Object.freeze({
      onLifecycleEvent: onLifecycleEvent as ObserverCallback,
      onObserverFailure: onObserverFailure as ObserverErrorCallback,
    })]);
  }

  emit(event: LifecycleEvent): void {
    const delivery = { event: Object.freeze(event), callbacks: this.callbacks };
    if (queue) { queue.push(delivery); return; }
    queue = [delivery];
    queueMicrotask(() => {
      // Detach this batch: reentrant transitions schedule another microtask.
      const deliveries = queue!;
      queue = undefined;
      for (const { event, callbacks } of deliveries) for (const { onLifecycleEvent, onObserverFailure } of callbacks) {
        const failed = (error: unknown) => {
          try { monitor(onObserverFailure(Object.freeze({ error, event })), ignore); }
          catch { /* Error reporting must not recursively report itself. */ }
        };
        try { monitor(onLifecycleEvent(event), failed); }
        catch (error) { failed(error); }
      }
    });
  }
}
