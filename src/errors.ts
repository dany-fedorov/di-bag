/** Stable category for a diagnostic created by DI Bag itself. */
export type DiBagErrorCode = `DI_BAG_${string}`;
/** Structured library diagnostics. Application-owned payloads retain their identity. */
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

/** One disposer failure, associated with the acquisition that owned it. */
export interface CleanupFailure {
  readonly acquisitionId: symbol;
  readonly bindingId: symbol;
  readonly label: string;
  readonly error: unknown;
}

/** A plugin descriptor or produced value crossed the checked plugin boundary. */
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

/** Original cleanup causes and detached acquisition diagnostics, in attempt order. */
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

/** Acquisition failure after the new bag has finished releasing its resources. */
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

/** Prompt cancellation; cleanup remains awaitable for uncooperative factories. */
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

/** What a close deadline or abort interrupted: labels still in progress when the wait stopped. */
export interface CloseProgress {
  /** Labels of disposers that started and had not completed. */
  readonly pending: readonly string[];
  /** Labels of acquisitions close was still draining before running disposers. */
  readonly acquiring: readonly string[];
}

/**
 * A `close({ timeoutMs, signal })` wait stopped before cleanup finished; cleanup keeps running.
 * `code` is `DI_BAG_CLOSE_TIMEOUT` for the deadline and `DI_BAG_CLOSE_ABORTED` for the signal.
 * @example
 * ```ts
 * import { DiBag, DiBagCloseCancelledError } from 'di-bag/node';
 *
 * const bag = DiBag.createBuilder().register({ value: () => 1 }).build();
 * try {
 *   await bag.close({ timeoutMs: 5_000 });
 * } catch (error) {
 *   if (error instanceof DiBagCloseCancelledError) console.error(error.details.pending);
 *   throw error;
 * }
 * ```
 */
export class DiBagCloseCancelledError extends Error {
  declare readonly code: 'DI_BAG_CLOSE_TIMEOUT' | 'DI_BAG_CLOSE_ABORTED';
  declare readonly details: Readonly<{ operation: 'close'; reason: 'aborted' | 'timeout'; timeoutMs?: number } & CloseProgress>;
  /**
   * @param reason - Whether an external abort or the close deadline stopped the wait.
   * @param cause - The abort reason, or a `TimeoutError` DOMException for the deadline.
   * @param cleanupPromise - The bag's shared shutdown promise; it settles when cleanup eventually finishes.
   * @param progress - Labels still in progress when the wait stopped.
   * @param timeoutMs - The deadline that elapsed, for `reason: 'timeout'`.
   */
  constructor(
    readonly reason: 'aborted' | 'timeout',
    cause: unknown,
    readonly cleanupPromise: Promise<void>,
    progress: CloseProgress,
    timeoutMs?: number,
  ) {
    const code = reason === 'timeout' ? 'DI_BAG_CLOSE_TIMEOUT' : 'DI_BAG_CLOSE_ABORTED';
    const waiting = progress.pending.length ? `; disposers still running: ${progress.pending.join(', ')}`
      : progress.acquiring.length ? `; acquisitions still pending: ${progress.acquiring.join(', ')}` : '';
    super(diagnosticMessage(code, `Bag close ${reason === 'timeout' ? `timed out after ${timeoutMs}ms` : 'aborted'}${waiting}`), { cause });
    this.name = 'DiBagCloseCancelledError';
    diagnostic(this, code, {
      operation: 'close', reason, ...(timeoutMs === undefined ? {} : { timeoutMs }),
      pending: Object.freeze([...progress.pending]), acquiring: Object.freeze([...progress.acquiring]),
    });
    void cleanupPromise.catch(() => {});
  }
}
