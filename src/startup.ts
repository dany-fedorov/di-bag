import { diagnostic, diagnosticMessage, libraryError } from './errors';
import type { BagRuntime, BindingGraph, BindingKey } from './runtime';
import { readToken } from './tokens';
import { DiBagDisposalError, DiBagCloseCancelledError, DiBagServiceReadinessCancelledError, DiBagServiceReadinessError } from './errors';
import type { DiBagErrorCode } from './errors';

/**
 * Bounds the wait of {@link Container.close}; cleanup itself keeps running after either fires.
 * @see https://dany-fedorov.github.io/di-bag/agent/errors.html#di-bag-close-timeout
 */
export interface CloseOptions {
  /** Aborting it stops the wait promptly. Cleanup keeps running. */
  readonly abortSignal?: AbortSignal;
  /** A finite positive deadline in milliseconds for the wait, not for the cleanup. */
  readonly waitTimeoutMs?: number;
}

/**
 * Options of {@link Container.ensureServicesReady}.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#start-selected-services-and-cancel-cooperatively
 */
export interface EnsureServicesReadyOptions {
  /** Aborting it stops the wait and closes this container. */
  readonly abortSignal?: AbortSignal;
  /** A finite positive deadline in milliseconds for the whole call, until every listed service is ready. It is not per service. On expiry this container is closed. */
  readonly totalTimeoutMs?: number;
  /** How many entries of `serviceKeys` are acquired at once, in tuple order. Omitted means all at once, `1` means one after another. It does not limit the dependencies a factory reads. */
  readonly maxConcurrentServiceKeys?: number;
}

/** Snapshot own cancellation options once, so getters and prototypes cannot change them later. */
/**
 * Format a timeout error's stack before handing it on. An unformatted stack keeps
 * the frames that created it alive, and these are closures over the runtime; a
 * readiness timeout also becomes the reason on every signal the container handed out.
 */
function formatted<E extends Error>(error: E): E {
  void error.stack;
  return error;
}

function snapshotOptions(options: unknown, operation: 'ensureServicesReady' | 'close', code: DiBagErrorCode, supported: readonly string[], timeoutKey: string, signalKey: string): Record<string, unknown> {
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
        cancel('timeout', formatted(diagnostic(new DOMException(diagnosticMessage('DI_BAG_CLOSE_TIMEOUT', 'Container close timed out'), 'TimeoutError'), 'DI_BAG_CLOSE_TIMEOUT', { operation: 'close', waitTimeoutMs: timeoutMs })));
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

function snapshotReadinessOptions(options: EnsureServicesReadyOptions | undefined): EnsureServicesReadyOptions {
  const selected = snapshotOptions(options, 'ensureServicesReady', 'DI_BAG_INVALID_STARTUP', ['abortSignal', 'totalTimeoutMs', 'maxConcurrentServiceKeys'], 'totalTimeoutMs', 'abortSignal');
  const bound = selected.maxConcurrentServiceKeys;
  if (Object.hasOwn(selected, 'maxConcurrentServiceKeys') && !(typeof bound === 'number' && Number.isSafeInteger(bound) && bound > 0)) {
    throw libraryError('DI_BAG_INVALID_STARTUP', 'ensureServicesReady maxConcurrentServiceKeys must be a positive safe integer', { operation: 'ensureServicesReady', option: 'maxConcurrentServiceKeys' });
  }
  return selected as EnsureServicesReadyOptions;
}

/**
 * Acquire the listed services on an existing runtime and wait until each is ready.
 * Invalid input throws before any factory runs and leaves the runtime untouched. A factory
 * failure, an abort, or the deadline closes this runtime; never assimilate an exposed service
 * to establish readiness.
 */
type SelectedReadinessEntry = Readonly<{
  key: BindingKey;
  isCollection: boolean;
}>;

export function ensureRuntimeReady(runtime: BagRuntime, graph: BindingGraph, keys: readonly unknown[], options?: EnsureServicesReadyOptions): Promise<void> {
  runtime.assertOpen();
  if (!Array.isArray(keys)) throw libraryError('DI_BAG_INVALID_STARTUP', 'ensureServicesReady requires a tuple of service keys', { operation: 'ensureServicesReady' });
  const selected: SelectedReadinessEntry[] = [];
  const length = keys.length;
  for (let index = 0; index < length; index++) {
    const value: unknown = keys[index];
    const token = typeof value === 'string' ? undefined : readToken(value);
    if (token !== undefined) {
      graph.assertTokenKind(token.key, token.kind, 'ensureServicesReady');
    }
    const key = token === undefined ? value as string : token.key;
    const isCollection = token?.kind === 'collection';
    if (!isCollection && !graph.hasPublic(key)) throw libraryError('DI_BAG_UNKNOWN_SERVICE_KEY', `ensureServicesReady accepts existing names or typed tokens only: ${String(key)}`, { operation: 'ensureServicesReady', serviceKey: key });
    selected.push({ key, isCollection });
  }
  const { abortSignal, totalTimeoutMs, maxConcurrentServiceKeys } = snapshotReadinessOptions(options);
  const acquire = (entry: SelectedReadinessEntry): Promise<void> => entry.isCollection
    ? runtime.acquireCollection(entry.key as symbol)
    : runtime.acquire(entry.key);
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const began = performance.now();
    const release = () => {
      if (timer !== undefined) clearTimeout(timer);
      abortSignal?.removeEventListener('abort', aborted);
    };
    const cancel = (reason: 'aborted' | 'timeout', cause: unknown) => {
      if (settled) return;
      settled = true;
      release();
      // Read the report before close starts, while the slow acquisitions are still pending.
      const progress = runtime.closeProgress();
      reject(new DiBagServiceReadinessCancelledError(reason, cause, runtime.close(cause), progress, reason === 'timeout' ? totalTimeoutMs : undefined));
    };
    const aborted = () => { if (abortSignal?.aborted) cancel('aborted', abortSignal.reason); };
    const checkCancellation = () => {
      aborted();
      if (!settled && totalTimeoutMs !== undefined && performance.now() - began >= totalTimeoutMs) {
        cancel('timeout', formatted(diagnostic(new DOMException(diagnosticMessage('DI_BAG_SERVICE_READINESS_TIMEOUT', 'The listed services were not ready before the deadline'), 'TimeoutError'), 'DI_BAG_SERVICE_READINESS_TIMEOUT', { operation: 'ensureServicesReady', totalTimeoutMs })));
      }
      return settled;
    };
    const schedule = () => {
      if (checkCancellation() || totalTimeoutMs === undefined) return;
      // Long deadlines must not wrap into an immediate timer on Node/Bun.
      timer = setTimeout(schedule, Math.min(2 ** 31 - 1, Math.max(1, totalTimeoutMs - (performance.now() - began))));
    };
    abortSignal?.addEventListener('abort', aborted, { once: true });
    if (checkCancellation()) return;
    if (totalTimeoutMs !== undefined) schedule();

    const runBounded = (limit: number) => {
      let next = 0;
      let failed = false;
      const worker = async () => {
        while (next < selected.length) {
          if (failed || checkCancellation()) return;
          const entry = selected[next++]!;
          try { await acquire(entry); }
          catch (cause) {
            // Stop other workers before rollback begins, even if cleanup waits.
            failed = true;
            throw cause;
          }
        }
      };
      return Promise.all(Array.from({ length: Math.min(limit, selected.length) }, worker));
    };
    const runAllAtOnce = () => {
      const pending: Promise<void>[] = [];
      for (const entry of selected) {
        if (checkCancellation()) break;
        pending.push(acquire(entry));
      }
      return Promise.all(pending);
    };
    const work = maxConcurrentServiceKeys === undefined ? runAllAtOnce() : runBounded(maxConcurrentServiceKeys);
    void work.then(() => {
      if (checkCancellation()) return;
      settled = true;
      release();
      resolve();
    }, async cause => {
      if (checkCancellation()) return;
      let disposalError: unknown;
      try { await runtime.close(cause); }
      catch (error) { disposalError = error; }
      if (checkCancellation()) return;
      settled = true;
      release();
      reject(new DiBagServiceReadinessError(cause, disposalError instanceof DiBagDisposalError ? disposalError.failures : [], disposalError));
    });
  });
}
