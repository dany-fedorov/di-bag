import { libraryError } from './errors';
import { createProvider } from './provider';
import type { Provider, ProviderBase } from './provider';
import type { Factory } from './registration';
import { retainDescription, sourceDescription } from './provider-operations';
import { acquisitionMode } from './acquisition-mode';
import type { Acquired, AcquisitionMode, NativeOutput, ModeOptions } from './acquisition-mode';
import type { TokenDependencyContract } from './token-types';

/** Cooperative cancellation information supplied to a context-aware acquisition. */
export interface AcquisitionContext {
  /** Aborted when the acquisition's owning scope begins closing. */
  readonly signal: AbortSignal;
}
type ContextFactory = (this: void, deps: never, context: AcquisitionContext) => unknown;
/** The named-dependency factory contract retained by an acquisition-context callback. */
export type ContextualFactory<F extends ContextFactory> = (this: void,
  deps: Parameters<F> extends [] ? {} : Parameters<F>[0],
) => ReturnType<F>;
type FactoryOptions<M extends AcquisitionMode> = 'auto' extends M
  ? [options?: { readonly context?: never; readonly acquisitionMode?: M }]
  : [options: { readonly context?: never; readonly acquisitionMode: M }];

/**
 * Describe a named-dependency factory receiving its acquisition owner's cancellation signal.
 * Context allocation is opt-in through `context: 'acquisition'`, independent of callback arity.
 * @param callback - A receiver-free factory taking dependencies and acquisition context.
 * @param options - Context selection and result policy; acquisitionMode defaults to auto.
 * @returns A lazy provider preserving exact output and named dependencies; adds no ownership.
 * @typeParam F - The complete callback signature, retaining dependency and output inference.
 * @typeParam M - The raw, nativePromise, or configured auto acquisition policy.
 */
export function fromFactory<F extends (this: void, deps: never, context: AcquisitionContext) => ('nativePromise' extends M ? Promise<unknown> : unknown), M extends AcquisitionMode = 'auto'>(
  callback: F,
  options: { readonly context: 'acquisition' } & ModeOptions<M>,
): Provider<ContextualFactory<F>, Readonly<{}>, readonly [], TokenDependencyContract, Acquired<ReturnType<F>, M>>;
/**
 * Describe a named-dependency factory with explicit or automatic result acquisition.
 * Raw mode preserves the exact acquired value; nativePromise observes Promise fulfillment.
 * @param callback - A receiver-free factory taking its named dependency object.
 * @param options - Optional result acquisitionMode, defaulting to auto.
 * @returns A lazy provider retaining exact output and dependency types without adding ownership.
 * @typeParam F - The exact factory signature and exposed result.
 * @typeParam M - The raw, nativePromise, or configured auto acquisition policy.
 */
export function fromFactory<F extends Factory, M extends AcquisitionMode = 'auto'>(
  callback: F & NativeOutput<ReturnType<NoInfer<F>>, NoInfer<M>>,
  ...options: FactoryOptions<M>
): Provider<F, Readonly<{}>, readonly [], TokenDependencyContract, Acquired<ReturnType<F>, M>>;
export function fromFactory(callback: Factory | ContextFactory, options?: { readonly context?: 'acquisition'; readonly acquisitionMode?: AcquisitionMode }): ProviderBase {
  if (typeof callback !== 'function') throw libraryError('DI_BAG_INVALID_FACTORY', 'fromFactory requires a function', { operation: 'fromFactory' });
  const mode = acquisitionMode(options);
  if (options?.context !== undefined && options.context !== 'acquisition') throw libraryError('DI_BAG_INVALID_FACTORY', 'fromFactory context must be acquisition', { operation: 'fromFactory' });
  const contextual = options?.context === 'acquisition';
  const handle = createProvider<Factory, Readonly<{}>, readonly [], TokenDependencyContract, unknown>();
  const create: Factory = contextual ? ((deps: never, context?: AcquisitionContext) => (callback as ContextFactory)(deps, context!)) : callback as Factory;
  retainDescription(handle, sourceDescription(create, undefined, [], mode, contextual));
  return handle;
}
