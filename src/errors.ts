/** Stable category for a diagnostic created by DI Bag itself. */
export type DiBagErrorCode = `DI_BAG_${string}`;
/** Structured library diagnostics. Application-owned payloads retain their identity. */
export interface DiBagDiagnostic {
  readonly code: DiBagErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
}
/** Attach only at library-owned error creation sites; never modify application errors. */
export function diagnostic<E extends Error>(error: E, code: DiBagErrorCode, details: Readonly<Record<string, unknown>> = {}): E & DiBagDiagnostic {
  Object.defineProperties(error, {
    code: { value: code, enumerable: true },
    details: { value: Object.freeze({ ...details }), enumerable: true },
  });
  return error as E & DiBagDiagnostic;
}
export function libraryError(code: DiBagErrorCode, message: string, details: Readonly<Record<string, unknown>> = {}): Error & DiBagDiagnostic {
  return diagnostic(new Error(message), code, details);
}
export function libraryTypeError(code: DiBagErrorCode, message: string, details: Readonly<Record<string, unknown>> = {}): TypeError & DiBagDiagnostic {
  return diagnostic(new TypeError(message), code, details);
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
    super(`Invalid plugin ${phase}: ${reason}`);
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
    super(snapshot.map(item => item.error), `Failed to run ${snapshot.length} disposal callback(s)`);
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
    super('Failed to start bag', { cause });
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
    super(`Bag startup ${reason}`, { cause });
    this.name = 'DiBagStartupCancelledError';
    diagnostic(this, 'DI_BAG_STARTUP_CANCELLED', { operation: 'buildAndStart', reason });
    void cleanupPromise.catch(() => {});
  }
}
