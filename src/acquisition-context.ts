import { libraryError } from './errors';
import { createProvider as createProviderHandle } from './provider';
import type { Provider, ProviderBase } from './provider';
import type { Factory } from './registration';
import { retainDescription, sourceDescription } from './provider-operations';
import { factoryReturnKind } from './acquisition-mode';
import type { Acquired, FactoryReturnKind, NativeOutput, AutoOutput, SyncOutput } from './acquisition-mode';
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
   * Pass the release callback itself, such as `() => socket.close()`, rather than calling it here.
   * @param disposer - Releases the acquired resource when the factory fails or the container closes.
   */
  pushDisposer(this: void, disposer: (this: void, disposerContext: DisposerContext) => void | Promise<void>): void;
}
type ContextFactory = (this: void, dependencies: never, factoryContext: FactoryContext) => unknown;
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
  if (bag.factoryReceivesContext !== undefined && typeof bag.factoryReceivesContext !== 'boolean') throw libraryError(
    'DI_BAG_INVALID_ARGUMENT', 'createProvider factoryReceivesContext must be true when present',
    { operation: 'createProvider', argument: 'factoryReceivesContext', expected: 'a boolean' },
  );
  if (bag.factoryReceivesContext === false) throw libraryError(
    'DI_BAG_INVALID_ARGUMENT', 'createProvider factoryReceivesContext must be true when present',
    { operation: 'createProvider', argument: 'factoryReceivesContext', expected: "one of: 'true'" },
  );
  return factoryProvider(factory, returnKind, bag.factoryReceivesContext === true);
}
type FactoryType = Factory;
/** Build the provider for one validated factory. */
function factoryProvider(callback: Factory | ContextFactory, returnKind: FactoryReturnKind, contextual: boolean): ProviderBase {
  const handle = createProviderHandle<Factory, Readonly<{}>, readonly [], TokenDependencyContract, unknown>();
  const create: Factory = contextual ? ((dependencies: never, factoryContext?: FactoryContext) =>
    (callback as ContextFactory)(dependencies, factoryContext!)) : callback as Factory;
  retainDescription(handle, sourceDescription(create, undefined, [], returnKind, contextual));
  return handle;
}
