/** One disposer failure, associated with the acquisition that owned it. */
export interface CleanupFailure {
    readonly acquisitionId: symbol;
    readonly bindingId: symbol;
    readonly label: string;
    readonly error: unknown;
}
/** A plugin descriptor or produced value crossed the checked plugin boundary. */
export declare class DiBagPluginError extends Error {
    readonly phase: 'descriptor' | 'output';
    readonly reason: string;
    /**
     * @param phase - Whether descriptor authentication or output validation failed.
     * @param reason - A stable description of the rejected boundary condition.
     */
    constructor(phase: 'descriptor' | 'output', reason: string);
}
/** Original cleanup causes and detached acquisition diagnostics, in attempt order. */
export declare class DiBagCleanupError extends AggregateError {
    /** Frozen cleanup failures in finalizer invocation order. */
    readonly failures: readonly CleanupFailure[];
    /** @param failures - Structured failures whose original errors also populate `AggregateError.errors`. */
    constructor(failures: readonly CleanupFailure[]);
}
/** Acquisition failure after the new bag has finished releasing its resources. */
export declare class DiBagStartupError extends Error {
    readonly cleanupError?: unknown;
    /** Frozen rollback disposal failures in invocation order. */
    readonly cleanupFailures: readonly CleanupFailure[];
    /**
     * @param cause - The original selected-service acquisition failure.
     * @param cleanupFailures - Structured failures collected while rolling back the new bag.
     * @param cleanupError - The complete shutdown error, when rollback itself rejected.
     */
    constructor(cause: unknown, cleanupFailures: readonly CleanupFailure[], cleanupError?: unknown);
}
/** Prompt cancellation; cleanup remains awaitable for uncooperative factories. */
export declare class DiBagStartupCancelledError extends Error {
    readonly reason: 'aborted' | 'timeout';
    readonly cleanup: Promise<void>;
    /**
     * @param reason - Whether an external abort or startup timeout cancelled the wait.
     * @param cause - The abort reason or generated timeout error.
     * @param cleanup - Eventual shutdown of the partially started bag; cancellation does not await it.
     */
    constructor(reason: 'aborted' | 'timeout', cause: unknown, cleanup: Promise<void>);
}
