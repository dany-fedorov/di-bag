export interface CleanupFailure {
  readonly acquisitionId: symbol;
  readonly bindingId: symbol;
  readonly label: string;
  readonly error: unknown;
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
