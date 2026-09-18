import { DiBag, type AcquisitionContext, type CloseOptions, type DiBagCloseCancelledError, type ProviderAcquiredValue, type ProviderNamedDependencies, type ProviderOutput } from '../../src';
import type { Assert, Equal } from './assert';

const key: unique symbol = Symbol('startup');
export const selectedToken = DiBag.token(key).of<{ readonly value: 42 }>();
export const contextual = DiBag.fromFactory((deps: { input: { readonly label: 'exact' } }, context) => ({
  read() { return deps.input.label; },
  signal: context.signal,
}), { context: 'acquisition' });
const rawPromise = Promise.resolve({ value: 42 as const });
export const raw = DiBag.withDisposal(DiBag.fromFactory((_deps: {}, _context) => rawPromise, { context: 'acquisition', ...{ acquisitionMode: 'raw' } }), value => {
  const exact: Promise<{ value: 42 }> = value;
  void exact;
});
const feature = DiBag.createBuilder().register({
  hidden: DiBag.fromFactory((deps: { input: { readonly label: 'exact' } }, context) => ({ label: deps.input.label, signal: context.signal }), { context: 'acquisition' }),
  exported: (deps: { hidden: { label: 'exact'; signal: AbortSignal } }) => deps.hidden,
}).buildModule(['exported']).renameExport('exported', 'renamed');
export const builder = DiBag.createBuilder().installModule(feature).register(selectedToken, DiBag.fromFactory((_deps: {}, _context) => ({ value: 42 as const }), { context: 'acquisition' })).register({ input: () => ({ label: 'exact' as const }), contextual: DiBag.withMetadata(contextual, { static: { owner: 'startup' as const } }), raw });
export const lazy = builder.build();
export const started = builder.buildAndStart(['contextual', selectedToken, 'raw', 'renamed']);
export const sequential = builder.buildAndStart(['contextual'], { startupOrder: 'sequential', signal: new AbortController().signal, timeoutMs: 100 });
export const bounded = builder.buildAndStart(['contextual'], { startupOrder: 4 });
export const empty = builder.buildAndStart([]);
export const native = DiBag.fromFactory(async (_deps: {}, context) => ({ signal: context.signal, value: 1 as const }), { context: 'acquisition', ...{ acquisitionMode: 'nativePromise' } });
export const noDeps = DiBag.fromFactory(() => 7 as const, { context: 'acquisition' });
export const rollback = DiBag.fromFactory((_deps: {}, context) => {
  context.defer(() => {});
  context.defer(async () => {});
  return 'released' as const;
}, { context: 'acquisition' });
export const reflected = builder.buildAndStart<readonly ['contextual']>;
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
  Assert<Equal<Parameters<AcquisitionContext['defer']>, [action: (this: void) => void | Promise<void>]>>,
  Assert<Equal<ReturnType<AcquisitionContext['defer']>, void>>,
  Assert<Equal<ProviderOutput<typeof rollback>, 'released'>>,
];

const closeBag = DiBag.createBuilder().register({ value: () => 1 }).build();
export const closed = closeBag.close();
export const boundedClose = closeBag.close({ timeoutMs: 100, signal: new AbortController().signal });
export const scopeClosed = closeBag.createScope().close({ timeoutMs: 1 });
export const labeledModule = DiBag.createBuilder().register({ hidden: () => 1, shown: ({ hidden }: { hidden: number }) => hidden }).buildModule(['shown'], { label: 'feature' });
export const unlabeledModule = DiBag.createBuilder().register({ hidden: () => 1, shown: ({ hidden }: { hidden: number }) => hidden }).buildModule(['shown']);
export type CloseContracts = [
  Assert<Equal<typeof closed, Promise<void>>>,
  Assert<Equal<typeof boundedClose, Promise<void>>>,
  Assert<Equal<typeof scopeClosed, Promise<void>>>,
  Assert<Equal<Parameters<typeof closeBag.close>[0], CloseOptions | undefined>>,
  Assert<Equal<typeof labeledModule, typeof unlabeledModule>>,
  Assert<Equal<DiBagCloseCancelledError['code'], 'DI_BAG_CLOSE_TIMEOUT' | 'DI_BAG_CLOSE_ABORTED'>>,
  Assert<Equal<DiBagCloseCancelledError['details']['pending'], readonly string[]>>,
];
