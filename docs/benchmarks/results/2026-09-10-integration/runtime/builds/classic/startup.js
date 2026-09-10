"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startRuntime = startRuntime;
const runtime_1 = require("./runtime");
const tokens_1 = require("./tokens");
const errors_1 = require("./errors");
function snapshotOptions(options) {
    if (options === undefined)
        return {};
    if (typeof options !== 'object' || options === null || Array.isArray(options))
        throw new Error('invalid startup options');
    const supported = ['signal', 'timeoutMs', 'concurrency'];
    if (Reflect.ownKeys(options).some(key => typeof key !== 'string' || !supported.includes(key)) ||
        supported.some(key => key in options && !Object.hasOwn(options, key)))
        throw new Error('invalid startup options');
    const selected = Object.create(null);
    for (const key of supported)
        if (Object.hasOwn(options, key))
            selected[key] = Reflect.get(options, key);
    if (Object.hasOwn(selected, 'timeoutMs') && (typeof selected.timeoutMs !== 'number' || !Number.isFinite(selected.timeoutMs) || selected.timeoutMs <= 0)) {
        throw new Error('startup timeoutMs must be finite and positive');
    }
    if (Object.hasOwn(selected, 'concurrency') && selected.concurrency !== 'parallel' && selected.concurrency !== 'sequential' &&
        !(typeof selected.concurrency === 'number' && Number.isSafeInteger(selected.concurrency) && selected.concurrency > 0))
        throw new Error('invalid startup concurrency');
    if (Object.hasOwn(selected, 'signal')) {
        try {
            Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted').get.call(selected.signal);
        }
        catch {
            throw new Error('startup signal must be an AbortSignal');
        }
    }
    return selected;
}
/** One startup transaction; never assimilate an exposed service to establish readiness. */
function startRuntime(graph, context, keys, options) {
    if (!Array.isArray(keys))
        throw new Error('startup requires selected keys');
    const selected = [];
    const length = keys.length;
    for (let index = 0; index < length; index++) {
        const value = keys[index];
        const key = typeof value === 'string' ? value : (0, tokens_1.readTokenKey)(value);
        if (!graph.hasPublic(key))
            throw new Error(`startup accepts existing tokens only: ${String(key)}`);
        selected.push(key);
    }
    const { signal, timeoutMs, concurrency = 'parallel' } = snapshotOptions(options);
    const runtime = new runtime_1.Runtime(graph, context);
    return new Promise((resolve, reject) => {
        let settled = false;
        let timer;
        const began = performance.now();
        const release = () => {
            if (timer !== undefined)
                clearTimeout(timer);
            signal?.removeEventListener('abort', aborted);
        };
        const cancel = (reason, cause) => {
            if (settled)
                return;
            settled = true;
            release();
            reject(new errors_1.DiBagStartupCancelledError(reason, cause, runtime.close(cause)));
        };
        const aborted = () => { if (signal?.aborted)
            cancel('aborted', signal.reason); };
        const checkCancellation = () => {
            aborted();
            if (!settled && timeoutMs !== undefined && performance.now() - began >= timeoutMs) {
                cancel('timeout', new DOMException('Bag startup timed out', 'TimeoutError'));
            }
            return settled;
        };
        const schedule = () => {
            if (checkCancellation() || timeoutMs === undefined)
                return;
            // Long deadlines must not wrap into an immediate timer on Node/Bun.
            timer = setTimeout(schedule, Math.min(2 ** 31 - 1, Math.max(1, timeoutMs - (performance.now() - began))));
        };
        signal?.addEventListener('abort', aborted, { once: true });
        if (checkCancellation())
            return;
        if (timeoutMs !== undefined)
            schedule();
        const runBounded = (limit) => {
            let next = 0;
            let failed = false;
            const worker = async () => {
                while (next < selected.length) {
                    if (failed || checkCancellation())
                        return;
                    const key = selected[next++];
                    try {
                        await runtime.acquire(key);
                    }
                    catch (cause) {
                        // Stop other workers before rollback begins, even if cleanup waits.
                        failed = true;
                        throw cause;
                    }
                }
            };
            return Promise.all(Array.from({ length: Math.min(limit, selected.length) }, worker));
        };
        const runParallel = () => {
            const pending = [];
            for (const key of selected) {
                if (checkCancellation())
                    break;
                pending.push(runtime.acquire(key));
            }
            return Promise.all(pending);
        };
        const work = concurrency === 'parallel' ? runParallel() : runBounded(concurrency === 'sequential' ? 1 : concurrency);
        void work.then(() => {
            if (checkCancellation())
                return;
            settled = true;
            release();
            resolve(runtime);
        }, async (cause) => {
            if (checkCancellation())
                return;
            let cleanupError;
            try {
                await runtime.close(cause);
            }
            catch (error) {
                cleanupError = error;
            }
            if (checkCancellation())
                return;
            settled = true;
            release();
            reject(new errors_1.DiBagStartupError(cause, cleanupError instanceof errors_1.DiBagCleanupError ? cleanupError.failures : [], cleanupError));
        });
    });
}
