export interface CleanupFailure {
  readonly acquisitionId: symbol;
  readonly bindingId: symbol;
  readonly label: string;
  readonly error: unknown;
}

/** A plugin descriptor or produced value crossed the checked plugin boundary. */
export class DiBagPluginError extends Error {
  constructor(readonly phase: 'descriptor' | 'output', readonly reason: string) {
    super(`Invalid plugin ${phase}: ${reason}`);
    this.name = 'DiBagPluginError';
  }
}

/** Original cleanup causes and detached acquisition diagnostics, in attempt order. */
export class DiBagCleanupError extends AggregateError {
  readonly failures: readonly CleanupFailure[];

  constructor(failures: readonly CleanupFailure[]) {
    const snapshot = Object.freeze(failures.map(item => Object.freeze({ ...item })));
    super(snapshot.map(item => item.error), `Failed to dispose ${snapshot.length} acquisition(s)`);
    this.name = 'DiBagCleanupError';
    this.failures = snapshot;
  }
}

/** Acquisition failure after the new bag has finished releasing its resources. */
export class DiBagStartupError extends Error {
  readonly cleanupFailures: readonly CleanupFailure[];

  constructor(cause: unknown, cleanupFailures: readonly CleanupFailure[], readonly cleanupError?: unknown) {
    super('Failed to start bag', { cause });
    this.name = 'DiBagStartupError';
    this.cleanupFailures = Object.freeze(cleanupFailures.map(item => Object.freeze({ ...item })));
  }
}

/** Prompt cancellation; cleanup remains awaitable for uncooperative factories. */
export class DiBagStartupCancelledError extends Error {
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
