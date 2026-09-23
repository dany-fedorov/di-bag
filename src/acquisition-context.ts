import { libraryError } from './errors';
import { createProvider as createProviderHandle } from './provider';
import type { Provider, ProviderBase } from './provider';
import type { Factory } from './registration';
import { retainDescription, sourceDescription } from './provider-operations';
import { acquisitionMode, factoryReturnKind, normalizeLegacyMode } from './acquisition-mode';
import type { Acquired, AcquisitionMode, FactoryReturnKind, NativeOutput, AutoOutput, SyncOutput, LegacyAcquired, LegacyAsyncOutput, LegacyAutoOutput, LegacyNativeOutput, LegacyModeOptions, LegacySyncOutput } from './acquisition-mode';
import { snapshotOptionsBag } from './options-bag';
import type { TokenDependencyContract } from './token-types';

/**
 * Why a pushed disposer is running: the factory never returned, or it did and the
 * service disposer — the `withDisposal` on the value this factory returned — has
 * just run. Ownership a consumer attaches to a transformed value does not count.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#release-partial-acquisition
 */
export interface DisposerContext {
  /**
   * `'factory-failed'`: the factory threw, rejected, or was cancelled; no service exists.
   * `'no-service-disposer'`: the factory returned and no `withDisposal` owns that value.
   * `'service-disposed'`: the service disposer ran without throwing.
   * `'service-disposal-failed'`: the service disposer threw; pushed disposers still run.
   */
  readonly reason: 'factory-failed' | 'no-service-disposer' | 'service-disposed' | 'service-disposal-failed';
}
/**
 * Cooperative cancellation and acquisition-local ownership supplied to a context-aware factory.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#start-selected-services-and-cancel-cooperatively
 */
export interface FactoryContext {
  /** Aborted when the acquisition's owning container begins closing. */
  readonly abortSignal: AbortSignal;
  /**
   * Own a resource acquired during this factory call; pushed disposers run once in reverse order.
   * @param disposer - Releases the acquired resource when the factory fails or the container closes.
   */
  pushDisposer(this: void, disposer: (this: void, disposerContext: DisposerContext) => void | Promise<void>): void;
}
/** @deprecated Use FactoryContext. */
export interface AcquisitionContext extends FactoryContext {
  /** Aborted when the acquisition's owning container begins closing. */
  readonly signal: AbortSignal;
  /**
   * Own a resource this factory has already acquired. Pushed disposers run exactly once, last
   * pushed first: at once if the factory fails, otherwise at `close()` after every disposer of the
   * service, with `disposerContext.reason` saying which. `withDisposal` owns the returned value; push
   * what is acquired on the way, and test `reason` before releasing the returned value itself.
   * @param disposer - Releases the resource acquired immediately before this call.
   */
  pushDisposer(this: void, disposer: (this: void, disposerContext: DisposerContext) => void | Promise<void>): void;
}
type ContextFactory = (this: void, dependencies: never, factoryContext: FactoryContext) => unknown;
type LegacyContextFactory = (this: void, dependencies: never, acquisitionContext: AcquisitionContext) => unknown;
/**
 * The named-dependency factory contract retained by an acquisition-context callback.
 * @typeParam F - The contextual callback whose named dependencies and return type are retained.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#start-selected-services-and-cancel-cooperatively
 */
export type ContextualFactory<F extends (this: void, dependencies: never, factoryContext: never) => unknown> = (this: void,
  dependencies: Parameters<F> extends [] ? {} : Parameters<F>[0],
) => ReturnType<F>;
type ReturnKindAdmission<Output, ReturnKind extends FactoryReturnKind> =
  NativeOutput<Output, NoInfer<ReturnKind>>
  & AutoOutput<Output, NoInfer<ReturnKind>>
  & SyncOutput<Output, NoInfer<ReturnKind>>;
type CheckedReturnKindOptions<Output, ReturnKind extends FactoryReturnKind> =
  'auto-detect' extends ReturnKind
    ? unknown extends NativeOutput<Output, NoInfer<ReturnKind>>
        & SyncOutput<Output, NoInfer<ReturnKind>>
      ? { readonly factoryReturnKind?: ReturnKind & ReturnKindAdmission<Output, ReturnKind> }
      : { readonly factoryReturnKind: ReturnKind & ReturnKindAdmission<Output, ReturnKind> }
    : { readonly factoryReturnKind: ReturnKind & ReturnKindAdmission<Output, ReturnKind> };
/**
 * Create a provider from a named-dependency factory that also receives FactoryContext.
 * @typeParam F - The exact callback signature and output.
 * @typeParam ReturnKind - How its output is acquired.
 */
export function createProvider<
  F extends (this: void, dependencies: never, factoryContext: FactoryContext) => any,
  ReturnKind extends FactoryReturnKind = 'auto-detect',
>(
  factory: F & AutoOutput<ReturnType<NoInfer<F>>, NoInfer<ReturnKind>>,
  options: { readonly factoryReceivesContext: true }
    & CheckedReturnKindOptions<ReturnType<NoInfer<F>>, ReturnKind>,
): Provider<ContextualFactory<F>, Readonly<{}>, readonly [], TokenDependencyContract,
  Acquired<ReturnType<F>, ReturnKind>>;
export function createProvider<F extends FactoryType, ReturnKind extends FactoryReturnKind = 'auto-detect'>(
  factory: F & AutoOutput<ReturnType<NoInfer<F>>, NoInfer<ReturnKind>>,
  ...options: {} extends CheckedReturnKindOptions<ReturnType<NoInfer<F>>, ReturnKind>
    ? [options?: { readonly factoryReceivesContext?: never }
        & CheckedReturnKindOptions<ReturnType<NoInfer<F>>, ReturnKind>]
    : [options: { readonly factoryReceivesContext?: never }
        & CheckedReturnKindOptions<ReturnType<NoInfer<F>>, ReturnKind>]
): Provider<F, Readonly<{}>, readonly [], TokenDependencyContract,
  Acquired<ReturnType<F>, ReturnKind>>;
export function createProvider(factory: FactoryType | ContextFactory, options?: unknown): ProviderBase {
  if (typeof factory !== 'function') throw libraryError('DI_BAG_INVALID_ARGUMENT', 'createProvider requires a factory function', {
    operation: 'createProvider', argument: 'factory', expected: 'a function',
  });
  const bag = options === undefined ? Object.create(null) as Record<string, unknown>
    : snapshotOptionsBag(options, 'createProvider', [], ['factoryReturnKind', 'factoryReceivesContext']);
  const returnKind = factoryReturnKind(bag.factoryReturnKind, 'createProvider');
  if (bag.factoryReceivesContext !== undefined && bag.factoryReceivesContext !== true) throw libraryError(
    'DI_BAG_INVALID_ARGUMENT', 'createProvider factoryReceivesContext must be true when present',
    { operation: 'createProvider', argument: 'factoryReceivesContext', expected: "one of: 'true'" },
  );
  return factoryProvider(factory, returnKind, bag.factoryReceivesContext === true);
}
type FactoryType = Factory;
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
export function fromFactory<F extends (this: void, dependencies: never, factoryContext: AcquisitionContext) => ('nativePromise' extends M ? Promise<unknown> : unknown), M extends AcquisitionMode = 'auto'>(
  callback: F & LegacyAutoOutput<ReturnType<NoInfer<F>>, NoInfer<M>>,
  options: { readonly context: 'acquisition' } & LegacyModeOptions<M>,
): Provider<ContextualFactory<F>, Readonly<{}>, readonly [], TokenDependencyContract, LegacyAcquired<ReturnType<F>, M>>;
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
  callback: F & LegacyNativeOutput<ReturnType<NoInfer<F>>, NoInfer<M>> & LegacyAutoOutput<ReturnType<NoInfer<F>>, NoInfer<M>>,
  ...options: FactoryOptions<M>
): Provider<F, Readonly<{}>, readonly [], TokenDependencyContract, LegacyAcquired<ReturnType<F>, M>>;
export function fromFactory(callback: Factory | ContextFactory, options?: { readonly context?: 'acquisition'; readonly acquisitionMode?: AcquisitionMode }): ProviderBase {
  if (typeof callback !== 'function') throw libraryError('DI_BAG_INVALID_FACTORY', 'fromFactory requires a function', { operation: 'fromFactory' });
  const mode = acquisitionMode(options);
  if (options?.context !== undefined && options.context !== 'acquisition') throw libraryError('DI_BAG_INVALID_FACTORY', 'fromFactory context must be acquisition', { operation: 'fromFactory' });
  return factoryProvider(callback, normalizeLegacyMode(mode), options?.context === 'acquisition');
}

/** Build the provider for one validated factory; `fromFactory` and both portable helpers end here. */
function factoryProvider(callback: Factory | ContextFactory | LegacyContextFactory, returnKind: FactoryReturnKind, contextual: boolean): ProviderBase {
  const handle = createProviderHandle<Factory, Readonly<{}>, readonly [], TokenDependencyContract, unknown>();
  const create: Factory = contextual ? ((dependencies: never, factoryContext?: FactoryContext & AcquisitionContext) =>
    (callback as ContextFactory | LegacyContextFactory)(dependencies, factoryContext!)) : callback as Factory;
  retainDescription(handle, sourceDescription(create, undefined, [], returnKind, contextual));
  return handle;
}

type PortableFactoryOptions = { readonly context?: never; readonly acquisitionMode?: never };
type ContextualPortableFactoryOptions = { readonly context: 'acquisition'; readonly acquisitionMode?: never };

/** Validate a portable helper's options; the mode is the helper's, so `acquisitionMode` is refused. */
function portableContext(operation: 'fromSyncFactory' | 'fromAsyncFactory', options: unknown): boolean {
  if (options === undefined) return false;
  if (typeof options !== 'object' || options === null) throw libraryError('DI_BAG_INVALID_FACTORY', `${operation} options must be an object`, { operation });
  if ('acquisitionMode' in options) throw libraryError('DI_BAG_INVALID_FACTORY', `${operation} selects its acquisitionMode itself`, { operation });
  const context: unknown = (options as { readonly context?: unknown }).context;
  if (context !== undefined && context !== 'acquisition') throw libraryError('DI_BAG_INVALID_FACTORY', `${operation} context must be acquisition`, { operation });
  return context === 'acquisition';
}

/**
 * Describe a synchronous named-dependency factory that runs on every host: a `raw` stage whose
 * exact return value is the service, so `then` is never read and no Promise classifier is needed.
 * @param callback - A receiver-free factory taking its named dependency object and the acquisition context.
 * @param options - `context: 'acquisition'`; the acquisition mode is fixed and `acquisitionMode` is rejected.
 * @returns A lazy provider preserving exact output and named dependencies; adds no ownership.
 * @typeParam F - The complete callback signature, retaining dependency and output inference.
 */
export function fromSyncFactory<F extends LegacyContextFactory>(
  callback: F & LegacySyncOutput<ReturnType<NoInfer<F>>>,
  options: ContextualPortableFactoryOptions,
): Provider<ContextualFactory<F>, Readonly<{}>, readonly [], TokenDependencyContract, ReturnType<F>>;
/**
 * Describe a synchronous named-dependency factory that runs on every host: a `raw` stage whose
 * exact return value is the service. A Promise or thenable output is rejected at compile time;
 * use `fromAsyncFactory`, or `fromFactory` with `acquisitionMode: 'raw'` when the Promise object is the service.
 * @param callback - A receiver-free factory taking its named dependency object.
 * @param options - Optional; `acquisitionMode` is rejected because the helper fixes it.
 * @returns A lazy provider retaining exact output and dependency types without adding ownership.
 * @typeParam F - The exact factory signature and exposed result.
 */
export function fromSyncFactory<F extends Factory>(
  callback: F & LegacySyncOutput<ReturnType<NoInfer<F>>>,
  options?: PortableFactoryOptions,
): Provider<F, Readonly<{}>, readonly [], TokenDependencyContract, ReturnType<F>>;
export function fromSyncFactory(callback: Factory | ContextFactory, options?: { readonly context?: 'acquisition' }): ProviderBase {
  if (typeof callback !== 'function') throw libraryError('DI_BAG_INVALID_FACTORY', 'fromSyncFactory requires a function', { operation: 'fromSyncFactory' });
  return factoryProvider(callback, 'sync-value', portableContext('fromSyncFactory', options));
}

/**
 * Describe an asynchronous named-dependency factory that runs on every host: a `nativePromise`
 * stage whose service is the returned Promise and whose owners receive the fulfilled value.
 * @param callback - A receiver-free async factory taking its named dependency object and the acquisition context.
 * @param options - `context: 'acquisition'`; the acquisition mode is fixed and `acquisitionMode` is rejected.
 * @returns A lazy provider exposing the factory's own Promise; adds no ownership.
 * @typeParam F - The complete callback signature, retaining dependency and output inference.
 */
export function fromAsyncFactory<F extends (this: void, dependencies: never, factoryContext: AcquisitionContext) => Promise<unknown>>(
  callback: F,
  options: ContextualPortableFactoryOptions,
): Provider<ContextualFactory<F>, Readonly<{}>, readonly [], TokenDependencyContract, Awaited<ReturnType<F>>>;
/**
 * Describe an asynchronous named-dependency factory that runs on every host: a `nativePromise`
 * stage whose service is the returned Promise and whose owners receive the fulfilled value.
 * A non-Promise output is rejected at compile time; a thenable that is not a native Promise fails the acquisition with a `TypeError`.
 * @param callback - A receiver-free factory returning a native Promise.
 * @param options - Optional; `acquisitionMode` is rejected because the helper fixes it.
 * @returns A lazy provider exposing the factory's own Promise; `withDisposal` receives its fulfilled value.
 * @typeParam F - The exact factory signature and exposed Promise.
 */
export function fromAsyncFactory<F extends Factory>(
  callback: F & LegacyAsyncOutput<ReturnType<NoInfer<F>>>,
  options?: PortableFactoryOptions,
): Provider<F, Readonly<{}>, readonly [], TokenDependencyContract, Awaited<ReturnType<F>>>;
export function fromAsyncFactory(callback: Factory | ContextFactory, options?: { readonly context?: 'acquisition' }): ProviderBase {
  if (typeof callback !== 'function') throw libraryError('DI_BAG_INVALID_FACTORY', 'fromAsyncFactory requires a function', { operation: 'fromAsyncFactory' });
  return factoryProvider(callback, 'native-promise', portableContext('fromAsyncFactory', options));
}
