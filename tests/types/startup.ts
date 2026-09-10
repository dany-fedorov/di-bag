import { DiBag, type AcquisitionContext, type ProviderAcquiredValue, type ProviderNamedDependencies, type ProviderOutput } from '../../src';
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
const feature = DiBag.createModuleBuilder().register({
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
];
