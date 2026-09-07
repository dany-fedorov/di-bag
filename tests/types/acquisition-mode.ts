import { DiBag } from '../../src';
import type { Provider, ProviderAcquired, ProviderOutput, ProviderMetadata, PublicProviders } from '../../src';
import type { ProviderBase } from '../../src/provider';
import type { Assert, Equal } from './assert';
import { fromValBox } from '../../src/val-box';
import { fromSasBox } from '../../src/sas-box';

const pending = Promise.resolve({ id: 7 });
export const raw = DiBag.factory(() => pending, { acquisition: 'raw' });
export const native = DiBag.factory(() => pending, { acquisition: 'native' });
export const rawOwned = DiBag.withDisposal(raw, value => { const exact: Promise<{ id: number }> = value; void exact; });
export const nativeOwned = DiBag.withDisposal(native, value => { const exact: { id: number } = value; void exact; });
export const metadata = DiBag.withMetadata(rawOwned, { owner: 'raw' as const });
export const key: unique symbol = Symbol('raw');
export const token = DiBag.token(key).of<Promise<{ id: number }>>();
export const tokenProvider = DiBag.fromTokens([token], value => value, { acquisition: 'raw' });
export const feature = DiBag.module().bind(token, metadata).add({ raw: rawOwned }).exports([token, 'raw']);
export const bag = DiBag.begin().install(feature).replace('raw', raw).end();
export const projected = DiBag.mapSync(native, value => value, { acquisition: 'raw' });
export const framed = fromValBox(DiBag.factory(() => ({ snapshot: () => ({ value: { present: true as const, value: pending }, metadata: { present: false as const }, alias: null }) }), { acquisition: 'raw' }), { value: 'required', acquisition: 'raw' });
export const capability = fromSasBox(DiBag.factory(() => ({ sync: () => pending }), { acquisition: 'raw' }), { mode: 'sync', acquisition: 'raw' });
export type Checks = [
  Assert<Equal<ProviderOutput<typeof raw>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquired<typeof rawOwned>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquired<typeof nativeOwned>, { id: number }>>,
  Assert<Equal<ProviderAcquired<typeof metadata>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderMetadata<typeof metadata>, Readonly<{ owner: 'raw' }>>>,
  Assert<Equal<ProviderAcquired<typeof tokenProvider>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquired<PublicProviders<{ raw: typeof raw }>['raw']>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquired<typeof projected>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquired<typeof framed>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquired<typeof capability>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquired<typeof raw | typeof native>, Promise<{ id: number }> | { id: number }>>,
  Assert<Equal<ProviderAcquired<ProviderBase>, unknown>>,
  Assert<Equal<ProviderAcquired<Provider<() => Promise<number>>>, number>>,
];
