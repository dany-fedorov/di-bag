"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiBagStartupCancelledError = exports.DiBagStartupError = exports.DiBagCleanupError = exports.DiBagPluginError = void 0;
/** A plugin descriptor or produced value crossed the checked plugin boundary. */
class DiBagPluginError extends Error {
    phase;
    reason;
    /**
     * @param phase - Whether descriptor authentication or output validation failed.
     * @param reason - A stable description of the rejected boundary condition.
     */
    constructor(phase, reason) {
        super(`Invalid plugin ${phase}: ${reason}`);
        this.phase = phase;
        this.reason = reason;
        this.name = 'DiBagPluginError';
    }
}
exports.DiBagPluginError = DiBagPluginError;
/** Original cleanup causes and detached acquisition diagnostics, in attempt order. */
class DiBagCleanupError extends AggregateError {
    /** Frozen cleanup failures in finalizer invocation order. */
    failures;
    /** @param failures - Structured failures whose original errors also populate `AggregateError.errors`. */
    constructor(failures) {
        const snapshot = Object.freeze(failures.map(item => Object.freeze({ ...item })));
        super(snapshot.map(item => item.error), `Failed to dispose ${snapshot.length} acquisition(s)`);
        this.name = 'DiBagCleanupError';
        this.failures = snapshot;
    }
}
exports.DiBagCleanupError = DiBagCleanupError;
/** Acquisition failure after the new bag has finished releasing its resources. */
class DiBagStartupError extends Error {
    cleanupError;
    /** Frozen rollback disposal failures in invocation order. */
    cleanupFailures;
    /**
     * @param cause - The original selected-service acquisition failure.
     * @param cleanupFailures - Structured failures collected while rolling back the new bag.
     * @param cleanupError - The complete shutdown error, when rollback itself rejected.
     */
    constructor(cause, cleanupFailures, cleanupError) {
        super('Failed to start bag', { cause });
        this.cleanupError = cleanupError;
        this.name = 'DiBagStartupError';
        this.cleanupFailures = Object.freeze(cleanupFailures.map(item => Object.freeze({ ...item })));
    }
}
exports.DiBagStartupError = DiBagStartupError;
/** Prompt cancellation; cleanup remains awaitable for uncooperative factories. */
class DiBagStartupCancelledError extends Error {
    reason;
    cleanup;
    /**
     * @param reason - Whether an external abort or startup timeout cancelled the wait.
     * @param cause - The abort reason or generated timeout error.
     * @param cleanup - Eventual shutdown of the partially started bag; cancellation does not await it.
     */
    constructor(reason, cause, cleanup) {
        super(`Bag startup ${reason}`, { cause });
        this.reason = reason;
        this.cleanup = cleanup;
        this.name = 'DiBagStartupCancelledError';
        void cleanup.catch(() => { });
    }
}
exports.DiBagStartupCancelledError = DiBagStartupCancelledError;
