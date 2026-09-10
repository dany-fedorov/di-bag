"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Observers = void 0;
const then = Promise.prototype.then;
const ignore = () => { };
/** Assimilate only callback results, always through a library-owned Promise. */
function monitor(result, failed) {
    if ((typeof result !== 'object' || result === null) && typeof result !== 'function')
        return;
    const pending = new Promise(resolve => { resolve(result); });
    then.call(pending, ignore, failed);
}
// One lazy queue preserves ordering when a callback observes multiple facades.
let queue;
class Observers {
    callbacks;
    constructor(callbacks) {
        this.callbacks = callbacks;
    }
    static append(previous, options) {
        if (typeof options !== 'object' || options === null)
            throw new TypeError('observe requires onEvent and onError callbacks');
        const { onEvent, onError } = options;
        if (typeof onEvent !== 'function' || typeof onError !== 'function')
            throw new TypeError('observe requires onEvent and onError callbacks');
        return new Observers([...(previous?.callbacks ?? []), Object.freeze({ onEvent, onError })]);
    }
    emit(event) {
        const delivery = { event: Object.freeze(event), callbacks: this.callbacks };
        if (queue) {
            queue.push(delivery);
            return;
        }
        queue = [delivery];
        queueMicrotask(() => {
            // Detach this batch: reentrant transitions schedule another microtask.
            const deliveries = queue;
            queue = undefined;
            for (const { event, callbacks } of deliveries)
                for (const { onEvent, onError } of callbacks) {
                    const failed = (error) => {
                        try {
                            monitor(onError(Object.freeze({ error, event })), ignore);
                        }
                        catch { /* Error reporting must not recursively report itself. */ }
                    };
                    try {
                        monitor(onEvent(event), failed);
                    }
                    catch (error) {
                        failed(error);
                    }
                }
        });
    }
}
exports.Observers = Observers;
