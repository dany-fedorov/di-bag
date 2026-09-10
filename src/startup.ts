import { diagnostic, libraryError } from './errors';
import { BagRuntime } from './runtime';
import type { BindingGraph, BindingKey } from './runtime';
import type { RuntimeContext } from './acquisition-mode';
import { readTokenKey } from './tokens';
import { DiBagCleanupError, DiBagStartupCancelledError, DiBagStartupError } from './errors';

/** Controls eager acquisition performed by {@link Builder.buildAndStart}. */
export interface StartupOptions {
  /** An external signal that promptly cancels the startup wait and begins cleanup. */
  readonly signal?: AbortSignal;
  /** A finite positive deadline in milliseconds. */
  readonly timeoutMs?: number;
  /** Start together (`parallel`, default), in tuple order (`sequential`), or with a positive safe integer bound on selected readiness waits. Dependency fanout is not bounded. */
  readonly startupOrder?: 'parallel' | 'sequential' | number;
}

function snapshotOptions(options: StartupOptions | undefined): StartupOptions {
  if (options === undefined) return {};
  if (typeof options !== 'object' || options === null || Array.isArray(options)) throw libraryError('DI_BAG_INVALID_STARTUP', 'invalid buildAndStart options', { operation: 'buildAndStart' });
  const supported = ['signal', 'timeoutMs', 'startupOrder'];
  if (Reflect.ownKeys(options).some(key => typeof key !== 'string' || !supported.includes(key)) ||
    supported.some(key => key in options && !Object.hasOwn(options, key))) throw libraryError('DI_BAG_INVALID_STARTUP', 'invalid buildAndStart options', { operation: 'buildAndStart' });
  const selected: Record<string, unknown> = Object.create(null);
  for (const key of supported) if (Object.hasOwn(options, key)) selected[key] = Reflect.get(options, key);
  if (Object.hasOwn(selected, 'timeoutMs') && (typeof selected.timeoutMs !== 'number' || !Number.isFinite(selected.timeoutMs) || selected.timeoutMs <= 0)) {
    throw libraryError('DI_BAG_INVALID_STARTUP', 'buildAndStart timeoutMs must be finite and positive', { operation: 'buildAndStart' });
  }
  if (Object.hasOwn(selected, 'startupOrder') && selected.startupOrder !== 'parallel' && selected.startupOrder !== 'sequential' &&
    !(typeof selected.startupOrder === 'number' && Number.isSafeInteger(selected.startupOrder) && selected.startupOrder > 0)) throw libraryError('DI_BAG_INVALID_STARTUP', 'buildAndStart startupOrder must be parallel, sequential, or a positive safe integer', { operation: 'buildAndStart', option: 'startupOrder' });
  if (Object.hasOwn(selected, 'signal')) {
    try { Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted')!.get!.call(selected.signal); }
    catch { throw libraryError('DI_BAG_INVALID_STARTUP', 'buildAndStart signal must be an AbortSignal', { operation: 'buildAndStart' }); }
  }
  return selected as StartupOptions;
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
  const { signal, timeoutMs, startupOrder = 'parallel' } = snapshotOptions(options);
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
        cancel('timeout', diagnostic(new DOMException('Bag startup timed out', 'TimeoutError'), 'DI_BAG_STARTUP_TIMEOUT', { operation: 'buildAndStart', timeoutMs }));
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
