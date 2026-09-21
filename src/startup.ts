import { diagnostic, diagnosticMessage, libraryError } from './errors';
import { BagRuntime } from './runtime';
import type { BindingGraph, BindingKey } from './runtime';
import type { RuntimeContext } from './acquisition-mode';
import { readTokenKey } from './tokens';
import { DiBagCleanupError, DiBagCloseCancelledError, DiBagStartupCancelledError, DiBagStartupError } from './errors';
import type { DiBagErrorCode } from './errors';

/**
 * Controls eager acquisition performed by {@link Builder.buildAndStart}.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#start-selected-services-and-cancel-cooperatively
 */
export interface StartupOptions {
  /** An external signal that promptly cancels the startup wait and begins cleanup. */
  readonly signal?: AbortSignal;
  /** A finite positive deadline in milliseconds. */
  readonly timeoutMs?: number;
  /** Start together (`parallel`, default), in tuple order (`sequential`), or with a positive safe integer bound on selected readiness waits. Dependency fanout is not bounded. */
  readonly startupOrder?: 'parallel' | 'sequential' | number;
}

/**
 * Bounds the wait of {@link Bag.close}; cleanup itself keeps running after either fires.
 * @see https://dany-fedorov.github.io/di-bag/agent/errors.html#di-bag-close-timeout
 */
export interface CloseOptions {
  /** Aborting it stops the wait promptly. Cleanup keeps running. */
  readonly abortSignal?: AbortSignal;
  /** A finite positive deadline in milliseconds for the wait, not for the cleanup. */
  readonly waitTimeoutMs?: number;
}

/** Snapshot own cancellation options once, so getters and prototypes cannot change them later. */
/**
 * Format a timeout error's stack before handing it on. An unformatted stack keeps
 * the frames that created it alive, and these are closures over the runtime; a
 * startup timeout also becomes the reason on every signal the bag handed out.
 */
function formatted<E extends Error>(error: E): E {
  void error.stack;
  return error;
}

function snapshotOptions(options: unknown, operation: 'buildAndStart' | 'close', code: DiBagErrorCode, supported: readonly string[], timeoutKey = 'timeoutMs', signalKey = 'signal'): Record<string, unknown> {
  if (options === undefined) return {};
  if (typeof options !== 'object' || options === null || Array.isArray(options)) throw libraryError(code, `invalid ${operation} options`, { operation });
  if (Reflect.ownKeys(options).some(key => typeof key !== 'string' || !supported.includes(key)) ||
    supported.some(key => key in options && !Object.hasOwn(options, key))) throw libraryError(code, `invalid ${operation} options`, { operation });
  const selected: Record<string, unknown> = Object.create(null);
  for (const key of supported) if (Object.hasOwn(options, key)) selected[key] = Reflect.get(options, key);
  const timeout = selected[timeoutKey];
  if (Object.hasOwn(selected, timeoutKey) && (typeof timeout !== 'number' || !Number.isFinite(timeout) || timeout <= 0)) {
    throw libraryError(code, `${operation} ${timeoutKey} must be finite and positive`, { operation });
  }
  if (Object.hasOwn(selected, signalKey)) {
    try { Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted')!.get!.call(selected[signalKey]); }
    catch { throw libraryError(code, `${operation} ${signalKey} must be an AbortSignal`, { operation }); }
  }
  return selected;
}

function snapshotStartupOptions(options: StartupOptions | undefined): StartupOptions {
  const selected = snapshotOptions(options, 'buildAndStart', 'DI_BAG_INVALID_STARTUP', ['signal', 'timeoutMs', 'startupOrder']);
  if (Object.hasOwn(selected, 'startupOrder') && selected.startupOrder !== 'parallel' && selected.startupOrder !== 'sequential' &&
    !(typeof selected.startupOrder === 'number' && Number.isSafeInteger(selected.startupOrder) && selected.startupOrder > 0)) throw libraryError('DI_BAG_INVALID_STARTUP', 'buildAndStart startupOrder must be parallel, sequential, or a positive safe integer', { operation: 'buildAndStart', option: 'startupOrder' });
  return selected as StartupOptions;
}

/**
 * Close with a bounded wait. Cleanup starts (or continues) exactly as for `close()`; the deadline
 * and signal only stop waiting, and the rejection carries the shared shutdown promise.
 */
export function closeRuntime(runtime: BagRuntime, options: CloseOptions | undefined): Promise<void> {
  if (options === undefined) return runtime.close();
  let selected: CloseOptions;
  try { selected = snapshotOptions(options, 'close', 'DI_BAG_INVALID_CLOSE', ['abortSignal', 'waitTimeoutMs'], 'waitTimeoutMs', 'abortSignal') as CloseOptions; }
  catch (error) { return Promise.reject(error); }
  const { abortSignal: signal, waitTimeoutMs: timeoutMs } = selected;
  const closing = runtime.close();
  if (signal === undefined && timeoutMs === undefined) return closing;
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const began = performance.now();
    const release = () => {
      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener('abort', aborted);
    };
    const cancel = (reason: 'aborted' | 'timeout', cause: unknown) => {
      if (settled) return;
      settled = true;
      release();
      reject(new DiBagCloseCancelledError(reason, cause, closing, runtime.closeProgress(), reason === 'timeout' ? timeoutMs : undefined));
    };
    const aborted = () => { if (signal?.aborted) cancel('aborted', signal.reason); };
    const schedule = () => {
      if (settled || timeoutMs === undefined) return;
      if (performance.now() - began >= timeoutMs) {
        cancel('timeout', formatted(diagnostic(new DOMException(diagnosticMessage('DI_BAG_CLOSE_TIMEOUT', 'Bag close timed out'), 'TimeoutError'), 'DI_BAG_CLOSE_TIMEOUT', { operation: 'close', waitTimeoutMs: timeoutMs })));
        return;
      }
      // Long deadlines must not wrap into an immediate timer on Node/Bun.
      timer = setTimeout(schedule, Math.min(2 ** 31 - 1, Math.max(1, timeoutMs - (performance.now() - began))));
    };
    signal?.addEventListener('abort', aborted, { once: true });
    aborted();
    if (settled) return;
    schedule();
    closing.then(
      () => { if (settled) return; settled = true; release(); resolve(); },
      error => { if (settled) return; settled = true; release(); reject(error); },
    );
  });
}

/** One startup transaction; never assimilate an exposed service to establish readiness. */
export function startRuntime(graph: BindingGraph, context: RuntimeContext, keys: readonly unknown[], options?: StartupOptions): Promise<BagRuntime> {
  if (!Array.isArray(keys)) throw libraryError('DI_BAG_INVALID_STARTUP', 'buildAndStart requires selected keys', { operation: 'buildAndStart' });
  const selected: BindingKey[] = [];
  const length = keys.length;
  for (let index = 0; index < length; index++) {
    const value: unknown = keys[index];
    const key = typeof value === 'string' ? value : readTokenKey(value);
    if (!graph.hasPublic(key)) throw libraryError('DI_BAG_INVALID_STARTUP', `buildAndStart accepts existing names or typed tokens only: ${String(key)}`, { operation: 'buildAndStart' });
    selected.push(key);
  }
  const { signal, timeoutMs, startupOrder = 'parallel' } = snapshotStartupOptions(options);
  const runtime = new BagRuntime(graph, context);
  return new Promise<BagRuntime>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const began = performance.now();
    const release = () => {
      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener('abort', aborted);
    };
    const cancel = (reason: 'aborted' | 'timeout', cause: unknown) => {
      if (settled) return;
      settled = true;
      release();
      reject(new DiBagStartupCancelledError(reason, cause, runtime.close(cause)));
    };
    const aborted = () => { if (signal?.aborted) cancel('aborted', signal.reason); };
    const checkCancellation = () => {
      aborted();
      if (!settled && timeoutMs !== undefined && performance.now() - began >= timeoutMs) {
        cancel('timeout', formatted(diagnostic(new DOMException(diagnosticMessage('DI_BAG_STARTUP_TIMEOUT', 'Bag startup timed out'), 'TimeoutError'), 'DI_BAG_STARTUP_TIMEOUT', { operation: 'buildAndStart', timeoutMs })));
      }
      return settled;
    };
    const schedule = () => {
      if (checkCancellation() || timeoutMs === undefined) return;
      // Long deadlines must not wrap into an immediate timer on Node/Bun.
      timer = setTimeout(schedule, Math.min(2 ** 31 - 1, Math.max(1, timeoutMs - (performance.now() - began))));
    };
    signal?.addEventListener('abort', aborted, { once: true });
    if (checkCancellation()) return;
    if (timeoutMs !== undefined) schedule();

    const runBounded = (limit: number) => {
      let next = 0;
      let failed = false;
      const worker = async () => {
        while (next < selected.length) {
          if (failed || checkCancellation()) return;
          const key = selected[next++]!;
          try { await runtime.acquire(key); }
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
      const pending: Promise<void>[] = [];
      for (const key of selected) {
        if (checkCancellation()) break;
        pending.push(runtime.acquire(key));
      }
      return Promise.all(pending);
    };
    const work = startupOrder === 'parallel' ? runParallel() : runBounded(startupOrder === 'sequential' ? 1 : startupOrder);
    void work.then(() => {
      if (checkCancellation()) return;
      settled = true;
      release();
      resolve(runtime);
    }, async cause => {
      if (checkCancellation()) return;
      let cleanupError: unknown;
      try { await runtime.close(cause); }
      catch (error) { cleanupError = error; }
      if (checkCancellation()) return;
      settled = true;
      release();
      reject(new DiBagStartupError(cause, cleanupError instanceof DiBagCleanupError ? cleanupError.failures : [], cleanupError));
    });
  });
}
