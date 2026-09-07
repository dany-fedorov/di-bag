import { DiBag, type AcquisitionContext, type ProviderAcquired, type ProviderNeeds, type ProviderOutput } from '../../src';
import type { Assert, Equal } from './assert';

const key: unique symbol = Symbol('startup');
export const selectedToken = DiBag.token(key).of<{ readonly value: 42 }>();
export const contextual = DiBag.withContext((deps: { input: { readonly label: 'exact' } }, context) => ({
  read() { return deps.input.label; },
  signal: context.signal,
}));
const rawPromise = Promise.resolve({ value: 42 as const });
export const raw = DiBag.withDisposal(DiBag.withContext((_deps: {}, _context) => rawPromise, { acquisition: 'raw' }), value => {
  const exact: Promise<{ value: 42 }> = value;
  void exact;
});
const feature = DiBag.module().add({
  hidden: DiBag.withContext((deps: { input: { readonly label: 'exact' } }, context) => ({ label: deps.input.label, signal: context.signal })),
  exported: (deps: { hidden: { label: 'exact'; signal: AbortSignal } }) => deps.hidden,
}).exports(['exported']).rename('exported', 'renamed');
export const builder = DiBag.begin().install(feature)
  .bind(selectedToken, DiBag.withContext((_deps: {}, _context) => ({ value: 42 as const })))
  .add({ input: () => ({ label: 'exact' as const }), contextual: DiBag.withMetadata(contextual, { owner: 'startup' as const }), raw });
export const lazy = builder.end();
export const started = builder.start(['contextual', selectedToken, 'raw', 'renamed']);
export const sequential = builder.start(['contextual'], { concurrency: 'sequential', signal: new AbortController().signal, timeoutMs: 100 });
export const empty = builder.start([]);
export const native = DiBag.withContext(async (_deps: {}, context) => ({ signal: context.signal, value: 1 as const }), { acquisition: 'native' });
export const noDeps = DiBag.withContext(() => 7 as const);
export const reflected = builder.start<readonly ['contextual']>;
export type Contracts = [
  Assert<Equal<Awaited<typeof started>, typeof lazy>>,
  Assert<Equal<typeof sequential, typeof started>>,
  Assert<Equal<typeof empty, typeof started>>,
  Assert<Equal<ReturnType<typeof reflected>, typeof started>>,
  Assert<Equal<ProviderNeeds<typeof contextual>, { input: { readonly label: 'exact' } }>>,
  Assert<Equal<ProviderOutput<typeof contextual>, { read(): 'exact'; signal: AbortSignal }>>,
  Assert<Equal<ProviderAcquired<typeof raw>, Promise<{ value: 42 }>>>,
  Assert<Equal<ProviderOutput<typeof native>, Promise<{ signal: AbortSignal; value: 1 }>>>,
  Assert<Equal<ProviderOutput<typeof noDeps>, 7>>,
  Assert<Equal<AcquisitionContext['signal'], AbortSignal>>,
];
