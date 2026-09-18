import { libraryError } from './errors';
import { createProvider } from './provider';
import type { Provider, ProviderBase } from './provider';
import type { Factory } from './registration';
import { retainDescription, sourceDescription } from './provider-operations';
import { acquisitionMode } from './acquisition-mode';
import type { Acquired, AcquisitionMode, AutoOutput, NativeOutput, ModeOptions } from './acquisition-mode';
import type { TokenDependencyContract } from './token-types';

/**
 * Why a pushed disposer is running: the factory never returned, or it did and the
 * attempt's service-level disposers — `withDisposal` on the returned value and any
 * projection ownership — have just run.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#release-partial-acquisition
 */
export interface DisposerContext {
  /**
   * `'factory-failed'`: the factory threw, rejected, or was cancelled; no service exists.
   * `'no-service-disposer'`: the factory returned and nothing owns the service.
   * `'service-disposed'`: every service-level disposer ran without throwing.
   * `'service-disposal-failed'`: a service-level disposer threw; pushed disposers still run.
   */
  readonly reason: 'factory-failed' | 'no-service-disposer' | 'service-disposed' | 'service-disposal-failed';
}
/**
 * Cooperative cancellation and acquisition-local ownership supplied to a context-aware factory.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#start-selected-services-and-cancel-cooperatively
 */
export interface AcquisitionContext {
  /** Aborted when the acquisition's owning scope begins closing. */
  readonly signal: AbortSignal;
  /**
   * Own a resource this factory has already acquired. Pushed disposers run exactly once, last
   * pushed first: at once if the factory fails, otherwise at `close()` after every service-level
   * disposer, with `disposerCtx.reason` saying which. Give each resource one disposer — here or
   * in `withDisposal`, not both — or test `reason` before releasing a resource the service owns.
   * @param disposer - Releases the resource acquired immediately before this call.
   */
  pushDisposer(this: void, disposer: (this: void, disposerCtx: DisposerContext) => void | Promise<void>): void;
}
type ContextFactory = (this: void, deps: never, factoryCtx: AcquisitionContext) => unknown;
/**
 * The named-dependency factory contract retained by an acquisition-context callback.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#start-selected-services-and-cancel-cooperatively
 */
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
export function fromFactory<F extends (this: void, deps: never, factoryCtx: AcquisitionContext) => ('nativePromise' extends M ? Promise<unknown> : unknown), M extends AcquisitionMode = 'auto'>(
  callback: F & AutoOutput<ReturnType<NoInfer<F>>, NoInfer<M>>,
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
  callback: F & NativeOutput<ReturnType<NoInfer<F>>, NoInfer<M>> & AutoOutput<ReturnType<NoInfer<F>>, NoInfer<M>>,
  ...options: FactoryOptions<M>
): Provider<F, Readonly<{}>, readonly [], TokenDependencyContract, Acquired<ReturnType<F>, M>>;
export function fromFactory(callback: Factory | ContextFactory, options?: { readonly context?: 'acquisition'; readonly acquisitionMode?: AcquisitionMode }): ProviderBase {
  if (typeof callback !== 'function') throw libraryError('DI_BAG_INVALID_FACTORY', 'fromFactory requires a function', { operation: 'fromFactory' });
  const mode = acquisitionMode(options);
  if (options?.context !== undefined && options.context !== 'acquisition') throw libraryError('DI_BAG_INVALID_FACTORY', 'fromFactory context must be acquisition', { operation: 'fromFactory' });
  const contextual = options?.context === 'acquisition';
  const handle = createProvider<Factory, Readonly<{}>, readonly [], TokenDependencyContract, unknown>();
  const create: Factory = contextual ? ((deps: never, factoryCtx?: AcquisitionContext) => (callback as ContextFactory)(deps, factoryCtx!)) : callback as Factory;
  retainDescription(handle, sourceDescription(create, undefined, [], mode, contextual));
  return handle;
}
