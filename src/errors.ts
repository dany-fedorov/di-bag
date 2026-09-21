/**
 * Stable category for a diagnostic created by DI Bag itself.
 * @see https://dany-fedorov.github.io/di-bag/agent/errors.html#runtime-codes
 */
export type DiBagErrorCode = `DI_BAG_${string}`;
/**
 * Structured library diagnostics. Application-owned payloads retain their identity.
 * @see https://dany-fedorov.github.io/di-bag/agent/errors.html#runtime-codes
 */
export interface DiBagDiagnostic {
  readonly code: DiBagErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
}
// The one place the errors page URL lives; fragments follow the site's heading slugs.
const errorsPage = 'https://dany-fedorov.github.io/di-bag/agent/errors.html';
/** Prefix the code and append the errors-page section so a stack trace names both. */
export function diagnosticMessage(code: DiBagErrorCode, message: string): string {
  return `${code}: ${message}; see ${errorsPage}#${code.toLowerCase().replaceAll('_', '-')}`;
}
/** Attach only at library-owned error creation sites whose message came from {@link diagnosticMessage}; never modify application errors. */
export function diagnostic<E extends Error>(error: E, code: DiBagErrorCode, details: Readonly<Record<string, unknown>> = {}): E & DiBagDiagnostic {
  Object.defineProperties(error, {
    code: { value: code, enumerable: true },
    details: { value: Object.freeze({ ...details }), enumerable: true },
  });
  return error as E & DiBagDiagnostic;
}
export function libraryError(code: DiBagErrorCode, message: string, details: Readonly<Record<string, unknown>> = {}): Error & DiBagDiagnostic {
  return diagnostic(new Error(diagnosticMessage(code, message)), code, details);
}
export function libraryTypeError(code: DiBagErrorCode, message: string, details: Readonly<Record<string, unknown>> = {}): TypeError & DiBagDiagnostic {
  return diagnostic(new TypeError(diagnosticMessage(code, message)), code, details);
}

/**
 * One disposer failure, associated with the acquisition that owned it.
 * @see https://dany-fedorov.github.io/di-bag/agent/errors.html#di-bag-cleanup-failed
 */
export interface CleanupFailure {
  readonly acquisitionId: symbol;
  readonly bindingId: symbol;
  readonly label: string;
  readonly error: unknown;
}

/**
 * A plugin descriptor or its acquired output failed validation at the checked plugin boundary.
 * @example
 * ```ts
 * import { DiBag, DiBagPluginValidationError } from 'di-bag';
 *
 * try {
 *   DiBag.fromPlugin([], { apiVersion: 2 }, { acquisitionMode: 'raw', validate: (pluginOutput): pluginOutput is string => typeof pluginOutput === 'string' });
 * } catch (error) {
 *   if (error instanceof DiBagPluginValidationError) console.error(error.phase, error.reason);
 * }
 * ```
 */
export class DiBagPluginValidationError extends Error {
  declare readonly code: 'DI_BAG_PLUGIN_VALIDATION';
  declare readonly details: Readonly<Record<string, unknown>>;
  /**
   * @param phase - Whether descriptor authentication or output validation failed.
   * @param reason - A stable description of the rejected boundary condition.
   */
  constructor(readonly phase: 'descriptor' | 'output', readonly reason: string) {
    super(diagnosticMessage('DI_BAG_PLUGIN_VALIDATION', `Invalid plugin ${phase}: ${reason}`));
    this.name = 'DiBagPluginValidationError';
    diagnostic(this, 'DI_BAG_PLUGIN_VALIDATION', { operation: 'fromPlugin', phase, reason });
  }
}

/**
 * One or more disposers failed during `close()`; every cleanup was still attempted.
 * `failures` lists each original error with the label of the service it belonged to, in attempt order.
 * @example
 * ```ts
 * import { DiBag, DiBagCleanupError } from 'di-bag';
 *
 * const bag = DiBag.createBuilder().register({ value: () => 1 }).build();
 * await bag.close().catch((error: unknown) => {
 *   if (error instanceof DiBagCleanupError) for (const failure of error.failures) console.error(failure.label, failure.error);
 * });
 * ```
 */
export class DiBagCleanupError extends AggregateError {
  declare readonly code: 'DI_BAG_CLEANUP_FAILED';
  declare readonly details: Readonly<Record<string, unknown>>;
  /** Frozen cleanup failures in finalizer invocation order. */
  readonly failures: readonly CleanupFailure[];

  /** @param failures - Structured failures whose original errors also populate `AggregateError.errors`. */
  constructor(failures: readonly CleanupFailure[]) {
    const snapshot = Object.freeze(failures.map(item => Object.freeze({ ...item })));
    super(snapshot.map(item => item.error), diagnosticMessage('DI_BAG_CLEANUP_FAILED', `Failed to run ${snapshot.length} disposal callback(s)`));
    this.name = 'DiBagCleanupError';
    diagnostic(this, 'DI_BAG_CLEANUP_FAILED', { operation: 'close', failedCallbacks: snapshot.length, failures: snapshot });
    this.failures = snapshot;
  }
}

/**
 * `buildAndStart` failed to acquire a selected service; the new bag has already released its resources.
 * `cause` is the original failure and `cleanupFailures` lists disposers that failed during rollback.
 * @example
 * ```ts
 * import { DiBag, DiBagStartupError } from 'di-bag';
 *
 * const builder = DiBag.createBuilder().register({ db: async (): Promise<number> => { throw new Error('offline'); } });
 * try {
 *   await builder.buildAndStart(['db']);
 * } catch (error) {
 *   if (error instanceof DiBagStartupError) console.error(error.cause, error.cleanupFailures);
 * }
 * ```
 */
export class DiBagStartupError extends Error {
  declare readonly code: 'DI_BAG_STARTUP_FAILED';
  declare readonly details: Readonly<Record<string, unknown>>;
  /** Frozen rollback disposal failures in invocation order. */
  readonly cleanupFailures: readonly CleanupFailure[];

  /**
   * @param cause - The original selected-service acquisition failure.
   * @param cleanupFailures - Structured failures collected while rolling back the new bag.
   * @param cleanupError - The complete shutdown error, when rollback itself rejected.
   */
  constructor(cause: unknown, cleanupFailures: readonly CleanupFailure[], readonly cleanupError?: unknown) {
    super(diagnosticMessage('DI_BAG_STARTUP_FAILED', 'Failed to start bag'), { cause });
    this.name = 'DiBagStartupError';
    this.cleanupFailures = Object.freeze(cleanupFailures.map(item => Object.freeze({ ...item })));
    diagnostic(this, 'DI_BAG_STARTUP_FAILED', { operation: 'buildAndStart', cleanupFailures: this.cleanupFailures });
  }
}

/**
 * `buildAndStart` stopped waiting on abort or timeout; `cleanupPromise` settles when the partial bag is released.
 * On timeout, `cause` carries `DI_BAG_STARTUP_TIMEOUT`.
 * @example
 * ```ts
 * import { DiBag, DiBagStartupCancelledError } from 'di-bag';
 *
 * const builder = DiBag.createBuilder().register({ db: () => new Promise<number>(() => {}) });
 * try {
 *   await builder.buildAndStart(['db'], { timeoutMs: 1_000 });
 * } catch (error) {
 *   if (error instanceof DiBagStartupCancelledError) await error.cleanupPromise;
 * }
 * ```
 */
export class DiBagStartupCancelledError extends Error {
  declare readonly code: 'DI_BAG_STARTUP_CANCELLED';
  declare readonly details: Readonly<Record<string, unknown>>;
  /**
   * @param reason - Whether an external abort or startup timeout cancelled the wait.
   * @param cause - The abort reason or generated timeout error.
   * @param cleanupPromise - Eventual shutdown of the partially started bag; cancellation does not await it.
   */
  constructor(
    readonly reason: 'aborted' | 'timeout',
    cause: unknown,
    readonly cleanupPromise: Promise<void>,
  ) {
    super(diagnosticMessage('DI_BAG_STARTUP_CANCELLED', `Bag startup ${reason}`), { cause });
    this.name = 'DiBagStartupCancelledError';
    diagnostic(this, 'DI_BAG_STARTUP_CANCELLED', { operation: 'buildAndStart', reason });
    void cleanupPromise.catch(() => {});
  }
}

/**
 * `ensureServicesReady` could not make a listed service ready, and this bag is now closed.
 * `cause` is the original failure and `disposalFailures` lists disposers that failed while the bag closed.
 * @example
 * ```ts
 * import { DiBag, DiBagServiceReadinessError } from 'di-bag';
 *
 * const bag = DiBag.createBuilder().register({ db: async (): Promise<number> => { throw new Error('offline'); } }).build();
 * try {
 *   await bag.ensureServicesReady(['db']);
 * } catch (error) {
 *   if (error instanceof DiBagServiceReadinessError) console.error(error.cause, error.disposalFailures);
 * }
 * ```
 */
export class DiBagServiceReadinessError extends Error {
  declare readonly code: 'DI_BAG_SERVICE_READINESS_FAILED';
  declare readonly details: Readonly<Record<string, unknown>>;
  /** Frozen disposal failures in invocation order, collected while this bag closed. */
  readonly disposalFailures: readonly CleanupFailure[];

  /**
   * @param cause - The original failure of a listed service or of one of its dependencies.
   * @param disposalFailures - Structured failures collected while closing the bag.
   * @param disposalError - The complete shutdown error, when closing itself rejected.
   */
  constructor(cause: unknown, disposalFailures: readonly CleanupFailure[], readonly disposalError?: unknown) {
    super(diagnosticMessage('DI_BAG_SERVICE_READINESS_FAILED', 'The listed services are not ready: a factory failed; this bag is closed'), { cause });
    this.name = 'DiBagServiceReadinessError';
    this.disposalFailures = Object.freeze(disposalFailures.map(item => Object.freeze({ ...item })));
    diagnostic(this, 'DI_BAG_SERVICE_READINESS_FAILED', { operation: 'ensureServicesReady', disposalFailures: this.disposalFailures });
  }
}

/**
 * `ensureServicesReady` stopped waiting on abort or timeout; this bag is closing and `disposalPromise` settles when it has closed.
 * `details` names what was still in progress. On timeout, `cause` carries `DI_BAG_SERVICE_READINESS_TIMEOUT`.
 * @example
 * ```ts
 * import { DiBag, DiBagServiceReadinessCancelledError } from 'di-bag';
 *
 * const bag = DiBag.createBuilder().register({ db: () => new Promise<number>(() => {}) }).build();
 * try {
 *   await bag.ensureServicesReady(['db'], { totalTimeoutMs: 1_000 });
 * } catch (error) {
 *   if (error instanceof DiBagServiceReadinessCancelledError) console.error(error.details.acquisitionsStillPending);
 * }
 * ```
 */
export class DiBagServiceReadinessCancelledError extends Error {
  declare readonly code: 'DI_BAG_SERVICE_READINESS_CANCELLED';
  declare readonly details: Readonly<{ operation: 'ensureServicesReady'; reason: 'aborted' | 'timeout'; totalTimeoutMs?: number } & CloseProgress>;
  /**
   * @param reason - Whether an external abort or the deadline cancelled the wait.
   * @param cause - The abort reason or the generated timeout error.
   * @param disposalPromise - Eventual shutdown of this bag; cancellation does not await it.
   * @param progress - Labels still in progress when the wait stopped.
   * @param totalTimeoutMs - The deadline that elapsed, for `reason: 'timeout'`.
   */
  constructor(
    readonly reason: 'aborted' | 'timeout',
    cause: unknown,
    readonly disposalPromise: Promise<void>,
    progress: CloseProgress,
    totalTimeoutMs?: number,
  ) {
    const waiting = progress.acquisitionsStillPending.length ? `; acquisitions still pending: ${progress.acquisitionsStillPending.join(', ')}`
      : progress.disposersStillRunning.length ? `; disposers still running: ${progress.disposersStillRunning.join(', ')}` : '';
    super(diagnosticMessage('DI_BAG_SERVICE_READINESS_CANCELLED', `The listed services were not ready: the wait ${reason === 'timeout' ? `timed out after ${totalTimeoutMs}ms` : 'was aborted'}${waiting}; this bag is closing`), { cause });
    this.name = 'DiBagServiceReadinessCancelledError';
    diagnostic(this, 'DI_BAG_SERVICE_READINESS_CANCELLED', {
      operation: 'ensureServicesReady', reason, ...(totalTimeoutMs === undefined ? {} : { totalTimeoutMs }),
      disposersStillRunning: Object.freeze([...progress.disposersStillRunning]),
      acquisitionsStillPending: Object.freeze([...progress.acquisitionsStillPending]),
    });
    void disposalPromise.catch(() => {});
  }
}

/**
 * What a close deadline or abort interrupted: labels still in progress when the wait stopped.
 * @see https://dany-fedorov.github.io/di-bag/agent/errors.html#di-bag-close-timeout
 */
export interface CloseProgress {
  /** Labels of disposers that started and had not completed. */
  readonly disposersStillRunning: readonly string[];
  /** Labels of acquisitions that had started and were not ready yet. */
  readonly acquisitionsStillPending: readonly string[];
}

/**
 * A `close({ waitTimeoutMs, abortSignal })` wait stopped before cleanup finished; cleanup keeps running.
 * `code` is `DI_BAG_CLOSE_TIMEOUT` for the deadline and `DI_BAG_CLOSE_ABORTED` for the signal.
 * @example
 * ```ts
 * import { DiBag, DiBagCloseCancelledError } from 'di-bag';
 *
 * const bag = DiBag.createBuilder().register({ value: () => 1 }).build();
 * try {
 *   await bag.close({ waitTimeoutMs: 5_000 });
 * } catch (error) {
 *   if (error instanceof DiBagCloseCancelledError) console.error(error.details.disposersStillRunning);
 *   throw error;
 * }
 * ```
 */
export class DiBagCloseCancelledError extends Error {
  declare readonly code: 'DI_BAG_CLOSE_TIMEOUT' | 'DI_BAG_CLOSE_ABORTED';
  declare readonly details: Readonly<{ operation: 'close'; reason: 'aborted' | 'timeout'; waitTimeoutMs?: number } & CloseProgress>;
  /**
   * @param reason - Whether an external abort or the close deadline stopped the wait.
   * @param cause - The abort reason, or a `TimeoutError` DOMException for the deadline.
   * @param cleanupPromise - The bag's shared shutdown promise; it settles when cleanup eventually finishes.
   * @param progress - Labels still in progress when the wait stopped.
   * @param waitTimeoutMs - The deadline that elapsed, for `reason: 'timeout'`.
   */
  constructor(
    readonly reason: 'aborted' | 'timeout',
    cause: unknown,
    readonly cleanupPromise: Promise<void>,
    progress: CloseProgress,
    waitTimeoutMs?: number,
  ) {
    const code = reason === 'timeout' ? 'DI_BAG_CLOSE_TIMEOUT' : 'DI_BAG_CLOSE_ABORTED';
    const waiting = progress.disposersStillRunning.length ? `; disposers still running: ${progress.disposersStillRunning.join(', ')}`
      : progress.acquisitionsStillPending.length ? `; acquisitions still pending: ${progress.acquisitionsStillPending.join(', ')}` : '';
    super(diagnosticMessage(code, `Bag close ${reason === 'timeout' ? `timed out after ${waitTimeoutMs}ms` : 'aborted'}${waiting}`), { cause });
    this.name = 'DiBagCloseCancelledError';
    diagnostic(this, code, {
      operation: 'close', reason, ...(waitTimeoutMs === undefined ? {} : { waitTimeoutMs }),
      disposersStillRunning: Object.freeze([...progress.disposersStillRunning]),
      acquisitionsStillPending: Object.freeze([...progress.acquisitionsStillPending]),
    });
    void cleanupPromise.catch(() => {});
  }
}
