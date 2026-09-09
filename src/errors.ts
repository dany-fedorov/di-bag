/** One disposer failure, associated with the acquisition that owned it. */
export interface CleanupFailure {
  readonly acquisitionId: symbol;
  readonly bindingId: symbol;
  readonly label: string;
  readonly error: unknown;
}

/** A plugin descriptor or produced value crossed the checked plugin boundary. */
export class DiBagPluginError extends Error {
  /**
   * @param phase - Whether descriptor authentication or output validation failed.
   * @param reason - A stable description of the rejected boundary condition.
   */
  constructor(readonly phase: 'descriptor' | 'output', readonly reason: string) {
    super(`Invalid plugin ${phase}: ${reason}`);
    this.name = 'DiBagPluginError';
  }
}

/** Original cleanup causes and detached acquisition diagnostics, in attempt order. */
export class DiBagCleanupError extends AggregateError {
  /** Frozen cleanup failures in finalizer invocation order. */
  readonly failures: readonly CleanupFailure[];

  /** @param failures - Structured failures whose original errors also populate `AggregateError.errors`. */
  constructor(failures: readonly CleanupFailure[]) {
    const snapshot = Object.freeze(failures.map(item => Object.freeze({ ...item })));
    super(snapshot.map(item => item.error), `Failed to dispose ${snapshot.length} acquisition(s)`);
    this.name = 'DiBagCleanupError';
    this.failures = snapshot;
  }
}

/** Acquisition failure after the new bag has finished releasing its resources. */
export class DiBagStartupError extends Error {
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
  }
}

/** Prompt cancellation; cleanup remains awaitable for uncooperative factories. */
export class DiBagStartupCancelledError extends Error {
  /**
   * @param reason - Whether an external abort or startup timeout cancelled the wait.
   * @param cause - The abort reason or generated timeout error.
   * @param cleanup - Eventual shutdown of the partially started bag; cancellation does not await it.
   */
  constructor(
    readonly reason: 'aborted' | 'timeout',
    cause: unknown,
    readonly cleanup: Promise<void>,
  ) {
    super(`Bag startup ${reason}`, { cause });
    this.name = 'DiBagStartupCancelledError';
    void cleanup.catch(() => {});
  }
}
