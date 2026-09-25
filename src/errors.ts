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
 * @see https://dany-fedorov.github.io/di-bag/agent/errors.html#di-bag-disposal-failed
 */
export interface DisposalFailure {
  readonly acquisitionId: symbol;
  readonly bindingId: symbol;
  readonly bindingLabel: string;
  readonly error: unknown;
}

/**
 * A plugin descriptor or its acquired output failed validation at the checked plugin boundary.
 * @example
 * ```ts
 * import { DiBag, DiBagPluginValidationError } from 'di-bag';
 *
 * try {
 *   DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: { apiVersion: 2 }, factoryReturnKind: 'uninspected', isValidPluginOutput: (pluginOutput): pluginOutput is string => typeof pluginOutput === 'string' });
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
  constructor(
    readonly phase: 'descriptor' | 'output',
    readonly reason: string,
    operation: 'createProviderFromPlugin' = 'createProviderFromPlugin',
  ) {
    super(diagnosticMessage('DI_BAG_PLUGIN_VALIDATION', `Invalid plugin ${phase}: ${reason}`));
    this.name = 'DiBagPluginValidationError';
    diagnostic(this, 'DI_BAG_PLUGIN_VALIDATION', { operation, phase, reason });
  }
}

/**
 * One or more disposers failed during `close()`; every disposal was still attempted.
 * `failures` lists each original error with the label of the service it belonged to, in attempt order.
 * @example
 * ```ts
 * import { DiBag, DiBagDisposalError } from 'di-bag';
 *
 * const container = DiBag.createBuilder().withServices({ value: () => 1 }).buildContainer();
 * await container.close().catch((error: unknown) => {
 *   if (error instanceof DiBagDisposalError) for (const failure of error.failures) console.error(failure.bindingLabel, failure.error);
 * });
 * ```
 */
export class DiBagDisposalError extends AggregateError {
  declare readonly code: 'DI_BAG_DISPOSAL_FAILED';
  declare readonly details: Readonly<Record<string, unknown>>;
  /** Frozen disposal failures in finalizer invocation order. */
  readonly failures: readonly DisposalFailure[];

  /** @param failures - Structured failures whose original errors also populate `AggregateError.errors`. */
  constructor(failures: readonly DisposalFailure[]) {
    const snapshot = Object.freeze(failures.map(item => Object.freeze({ ...item })));
    super(snapshot.map(item => item.error), diagnosticMessage('DI_BAG_DISPOSAL_FAILED', `Failed to run ${snapshot.length} disposal callback(s)`));
    this.name = 'DiBagDisposalError';
    diagnostic(this, 'DI_BAG_DISPOSAL_FAILED', { operation: 'close', failedCallbacks: snapshot.length, failures: snapshot });
    this.failures = snapshot;
  }
}

/**
 * `ensureServicesReady` could not make a listed service ready, and this container is now closed.
 * `cause` is the original failure and `disposalFailures` lists disposers that failed while the container closed.
 * @example
 * ```ts
 * import { DiBag, DiBagServiceReadinessError } from 'di-bag';
 *
 * const container = DiBag.createBuilder().withServices({ db: async (): Promise<number> => { throw new Error('offline'); } }).buildContainer();
 * try {
 *   await container.ensureServicesReady(['db']);
 * } catch (error) {
 *   if (error instanceof DiBagServiceReadinessError) console.error(error.cause, error.disposalFailures);
 * }
 * ```
 */
export class DiBagServiceReadinessError extends Error {
  declare readonly code: 'DI_BAG_SERVICE_READINESS_FAILED';
  declare readonly details: Readonly<Record<string, unknown>>;
  /** Frozen disposal failures in invocation order, collected while this container closed. */
  readonly disposalFailures: readonly DisposalFailure[];

  /**
   * @param cause - The original failure of a listed service or of one of its dependencies.
   * @param disposalFailures - Structured failures collected while closing the container.
   * @param disposalError - The complete shutdown error, when closing itself rejected.
   */
  constructor(cause: unknown, disposalFailures: readonly DisposalFailure[], readonly disposalError?: unknown) {
    super(diagnosticMessage('DI_BAG_SERVICE_READINESS_FAILED', 'The listed services are not ready: a factory failed; this container is closed'), { cause });
    this.name = 'DiBagServiceReadinessError';
    this.disposalFailures = Object.freeze(disposalFailures.map(item => Object.freeze({ ...item })));
    diagnostic(this, 'DI_BAG_SERVICE_READINESS_FAILED', { operation: 'ensureServicesReady', disposalFailures: this.disposalFailures });
  }
}

/**
 * `ensureServicesReady` stopped waiting on abort or timeout; this container is closing and `disposalPromise` settles when it has closed.
 * `details` names what was still in progress. On timeout, `cause` carries `DI_BAG_SERVICE_READINESS_TIMEOUT`.
 * @example
 * ```ts
 * import { DiBag, DiBagServiceReadinessCancelledError } from 'di-bag';
 *
 * const container = DiBag.createBuilder().withServices({ db: () => new Promise<number>(() => {}) }).buildContainer();
 * try {
 *   await container.ensureServicesReady(['db'], { totalTimeoutMs: 1_000 });
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
   * @param disposalPromise - Eventual shutdown of this container; cancellation does not await it.
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
    super(diagnosticMessage('DI_BAG_SERVICE_READINESS_CANCELLED', `The listed services were not ready: the wait ${reason === 'timeout' ? `timed out after ${totalTimeoutMs}ms` : 'was aborted'}${waiting}; this container is closing`), { cause });
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
 * A `close({ waitTimeoutMs, abortSignal })` wait stopped before disposal finished; disposal keeps running.
 * `code` is `DI_BAG_CLOSE_TIMEOUT` for the deadline and `DI_BAG_CLOSE_ABORTED` for the signal.
 * @example
 * ```ts
 * import { DiBag, DiBagCloseCancelledError } from 'di-bag';
 *
 * const container = DiBag.createBuilder().withServices({ value: () => 1 }).buildContainer();
 * try {
 *   await container.close({ waitTimeoutMs: 5_000 });
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
   * @param disposalPromise - The container's shared shutdown promise; it settles when disposal eventually finishes.
   * @param progress - Labels still in progress when the wait stopped.
   * @param waitTimeoutMs - The deadline that elapsed, for `reason: 'timeout'`.
   */
  constructor(
    readonly reason: 'aborted' | 'timeout',
    cause: unknown,
    readonly disposalPromise: Promise<void>,
    progress: CloseProgress,
    waitTimeoutMs?: number,
  ) {
    const code = reason === 'timeout' ? 'DI_BAG_CLOSE_TIMEOUT' : 'DI_BAG_CLOSE_ABORTED';
    const waiting = progress.disposersStillRunning.length ? `; disposers still running: ${progress.disposersStillRunning.join(', ')}`
      : progress.acquisitionsStillPending.length ? `; acquisitions still pending: ${progress.acquisitionsStillPending.join(', ')}` : '';
    super(diagnosticMessage(code, `Container close ${reason === 'timeout' ? `timed out after ${waitTimeoutMs}ms` : 'aborted'}${waiting}`), { cause });
    this.name = 'DiBagCloseCancelledError';
    diagnostic(this, code, {
      operation: 'close', reason, ...(waitTimeoutMs === undefined ? {} : { waitTimeoutMs }),
      disposersStillRunning: Object.freeze([...progress.disposersStillRunning]),
      acquisitionsStillPending: Object.freeze([...progress.acquisitionsStillPending]),
    });
    void disposalPromise.catch(() => {});
  }
}
