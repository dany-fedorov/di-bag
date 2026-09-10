import type { Provider } from './provider';
import type { Acquired, AcquisitionMode, StageOptions } from './acquisition-mode';
import type { TokenGraph } from './token-types';
/** Cooperative cancellation information supplied to a context-aware acquisition. */
export interface AcquisitionContext {
    /** The signal aborted when the acquisition's owning scope begins closing. */
    readonly signal: AbortSignal;
}
type ContextFactory = (this: void, deps: never, context: AcquisitionContext) => unknown;
/** The ordinary one-argument factory signature exposed by a context-aware callback. */
export type ContextualFactory<F extends ContextFactory> = (this: void, deps: Parameters<F> extends [] ? {} : Parameters<F>[0]) => ReturnType<F>;
/**
 * Adapt a factory to receive the acquisition owner's cancellation context.
 * @param callback - A receiver-free factory taking named dependencies and an {@link AcquisitionContext}.
 * @param modeOptions - Optional acquisition mode for the callback result.
 * @returns A lazy provider whose public factory contract contains only named dependencies.
 * @typeParam F - The exact context-aware callback signature retained by the provider.
 */
export declare function withContext<F extends (this: void, deps: never, context: AcquisitionContext) => ('native' extends M ? Promise<unknown> : unknown), M extends AcquisitionMode = 'auto'>(callback: F, ...modeOptions: StageOptions<M>): Provider<ContextualFactory<F>, Readonly<{}>, readonly [], TokenGraph, Acquired<ReturnType<F>, M>>;
export {};
