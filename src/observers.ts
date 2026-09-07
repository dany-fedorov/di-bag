import type { FramePresenceTuple } from './inspection';
import type { Lifetime } from './lifetime';

export interface ScopeEventFields {
  readonly scopeId: symbol;
  readonly parentScopeId?: symbol;
}
export interface AcquisitionEventFields {
  readonly scopeId: symbol;
  readonly bindingId: symbol;
  readonly acquisitionId: symbol;
  readonly label: string;
  readonly lifetime: Lifetime;
  readonly metadata: Readonly<object>;
  readonly frames: FramePresenceTuple<readonly unknown[]>;
}
export type LifecycleEvent =
  | (ScopeEventFields & { readonly kind: 'scope-opened' })
  | (ScopeEventFields & { readonly kind: 'scope-closing' })
  | (ScopeEventFields & { readonly kind: 'scope-closed' })
  | (ScopeEventFields & { readonly kind: 'scope-close-failed'; readonly error: unknown })
  | (AcquisitionEventFields & { readonly kind: 'acquisition-started' })
  | (AcquisitionEventFields & { readonly kind: 'acquisition-ready' })
  | (AcquisitionEventFields & { readonly kind: 'cleanup-started' })
  | (AcquisitionEventFields & { readonly kind: 'acquisition-failed'; readonly error: unknown })
  | (AcquisitionEventFields & { readonly kind: 'cleanup-failed'; readonly error: unknown; readonly disposalIndex: number })
  | (AcquisitionEventFields & { readonly kind: 'cleanup-completed'; readonly outcome: 'success' | 'failure' });
export interface ObserverFailure {
  readonly error: unknown;
  readonly event: LifecycleEvent;
}
export type ObserverCallback = (this: void, event: LifecycleEvent) => unknown;
export type ObserverErrorCallback = (this: void, failure: ObserverFailure) => unknown;
export interface ObserverOptions {
  readonly onEvent: ObserverCallback;
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
export class Observers {
  private constructor(private readonly callbacks: readonly ObserverOptions[]) {}

  static append(previous: Observers | undefined, options: ObserverOptions): Observers {
    if (typeof options !== 'object' || options === null) throw new TypeError('observe requires onEvent and onError callbacks');
    const { onEvent, onError } = options;
    if (typeof onEvent !== 'function' || typeof onError !== 'function') throw new TypeError('observe requires onEvent and onError callbacks');
    return new Observers([...(previous?.callbacks ?? []), Object.freeze({ onEvent, onError })]);
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
