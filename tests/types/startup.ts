import { DiBag, type AcquisitionContext, type DisposerContext, type CloseOptions, type DiBagCloseCancelledError, type EnsureServicesReadyOptions, type ProviderAcquiredValue, type ProviderNamedDependencies, type ProviderOutput } from '../../src';
import type { Assert, Equal } from './assert';

const key: unique symbol = Symbol('startup');
export const selectedToken = DiBag.token(key).of<{ readonly value: 42 }>();
export const contextual = DiBag.fromFactory((deps: { input: { readonly label: 'exact' } }, factoryCtx) => ({
  read() { return deps.input.label; },
  signal: factoryCtx.signal,
}), { context: 'acquisition' });
const rawPromise = Promise.resolve({ value: 42 as const });
export const raw = DiBag.withDisposal(DiBag.fromFactory((_deps: {}, _factoryCtx) => rawPromise, { context: 'acquisition', ...{ acquisitionMode: 'raw' } }), value => {
  const exact: Promise<{ value: 42 }> = value;
  void exact;
});
const feature = DiBag.createBuilder().withServices({
  hidden: DiBag.fromFactory((deps: { input: { readonly label: 'exact' } }, factoryCtx) => ({ label: deps.input.label, signal: factoryCtx.signal }), { context: 'acquisition' }),
  exported: (deps: { hidden: { label: 'exact'; signal: AbortSignal } }) => deps.hidden,
}).buildModule({ exportedServiceKeys: ['exported'] }).withRenamedExport({ currentExportKey: 'exported', newExportKey: 'renamed' });
export const builder = DiBag.createBuilder().withInstalledModules([feature]).withTokenService(selectedToken, DiBag.fromFactory((_deps: {}, _factoryCtx) => ({ value: 42 as const }), { context: 'acquisition' })).withServices({ input: () => ({ label: 'exact' as const }), contextual: DiBag.withMetadata(contextual, { static: { owner: 'startup' as const } }), raw });
export const lazy = builder.buildContainer();
export const started = lazy.ensureServicesReady(['contextual', selectedToken, 'raw', 'renamed']);
export const sequential = lazy.ensureServicesReady(['contextual'], { maxConcurrentServiceKeys: 1, abortSignal: new AbortController().signal, totalTimeoutMs: 100 });
export const bounded = lazy.ensureServicesReady(['contextual'], { maxConcurrentServiceKeys: 4 });
export const empty = lazy.ensureServicesReady([]);
export const native = DiBag.fromFactory(async (_deps: {}, factoryCtx) => ({ signal: factoryCtx.signal, value: 1 as const }), { context: 'acquisition', ...{ acquisitionMode: 'nativePromise' } });
export const noDeps = DiBag.fromFactory(() => 7 as const, { context: 'acquisition' });
export const pushed = DiBag.fromFactory((_deps: {}, factoryCtx) => {
  factoryCtx.pushDisposer(() => {});
  factoryCtx.pushDisposer(async disposerCtx => { const reason: DisposerContext['reason'] = disposerCtx.reason; void reason; });
  return 'owned' as const;
}, { context: 'acquisition' });
const readyChild = lazy.createChildContainer();
export const readyInChild = readyChild.ensureServicesReady(['contextual']);
const readyFork = lazy.createIndependentContainer();
export const readyInFork = readyFork.ensureServicesReady([selectedToken]);
export type ReadinessContracts = [
  Assert<Equal<Awaited<typeof readyInChild>, typeof readyChild>>,
  Assert<Equal<Awaited<typeof readyInFork>, typeof readyFork>>,
  Assert<Equal<Parameters<typeof lazy.ensureServicesReady>[1], EnsureServicesReadyOptions | undefined>>,
];
export const reflected = lazy.ensureServicesReady<readonly ['contextual']>;
export type Contracts = [
  Assert<Equal<Awaited<typeof started>, typeof lazy>>,
  Assert<Equal<typeof sequential, typeof started>>,
  Assert<Equal<typeof empty, typeof started>>,
  Assert<Equal<typeof bounded, typeof started>>,
  Assert<Equal<ReturnType<typeof reflected>, typeof started>>,
  Assert<Equal<ProviderNamedDependencies<typeof contextual>, { input: { readonly label: 'exact' } }>>,
  Assert<Equal<ProviderOutput<typeof contextual>, { read(): 'exact'; signal: AbortSignal }>>,
  Assert<Equal<ProviderAcquiredValue<typeof raw>, Promise<{ value: 42 }>>>,
  Assert<Equal<ProviderOutput<typeof native>, Promise<{ signal: AbortSignal; value: 1 }>>>,
  Assert<Equal<ProviderOutput<typeof noDeps>, 7>>,
  Assert<Equal<AcquisitionContext['signal'], AbortSignal>>,
  Assert<Equal<Parameters<AcquisitionContext['pushDisposer']>, [disposer: (this: void, disposerContext: DisposerContext) => void | Promise<void>]>>,
  Assert<Equal<ReturnType<AcquisitionContext['pushDisposer']>, void>>,
  Assert<Equal<DisposerContext['reason'], 'factory-failed' | 'no-service-disposer' | 'service-disposed' | 'service-disposal-failed'>>,
  Assert<Equal<ProviderOutput<typeof pushed>, 'owned'>>,
];

const closeBag = DiBag.createBuilder().withServices({ value: () => 1 }).buildContainer();
export const closed = closeBag.close();
export const boundedClose = closeBag.close({ waitTimeoutMs: 100, abortSignal: new AbortController().signal });
export const scopeClosed = closeBag.createChildContainer().close({ waitTimeoutMs: 1 });
export const labeledModule = DiBag.createBuilder().withServices({ hidden: () => 1, shown: ({ hidden }: { hidden: number }) => hidden }).buildModule({ exportedServiceKeys: ['shown'], moduleLabel: 'feature' });
export const unlabeledModule = DiBag.createBuilder().withServices({ hidden: () => 1, shown: ({ hidden }: { hidden: number }) => hidden }).buildModule({ exportedServiceKeys: ['shown'] });
export type CloseContracts = [
  Assert<Equal<typeof closed, Promise<void>>>,
  Assert<Equal<typeof boundedClose, Promise<void>>>,
  Assert<Equal<typeof scopeClosed, Promise<void>>>,
  Assert<Equal<Parameters<typeof closeBag.close>[0], CloseOptions | undefined>>,
  Assert<Equal<typeof labeledModule, typeof unlabeledModule>>,
  Assert<Equal<DiBagCloseCancelledError['code'], 'DI_BAG_CLOSE_TIMEOUT' | 'DI_BAG_CLOSE_ABORTED'>>,
  Assert<Equal<DiBagCloseCancelledError['details']['disposersStillRunning'], readonly string[]>>,
];
