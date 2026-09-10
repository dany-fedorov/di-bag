import { DiBag } from '../../src';
import type { Provider, ProviderAcquiredValue, ProviderOutput, ProviderRegistrationMetadata, PublicProviders } from '../../src';
import type { ProviderBase } from '../../src/provider';
import type { Assert, Equal } from './assert';

const pending = Promise.resolve({ id: 7 });
export const raw = DiBag.fromFactory(() => pending, { acquisitionMode: 'raw' });
export const native = DiBag.fromFactory(() => pending, { acquisitionMode: 'nativePromise' });
export const rawOwned = DiBag.withDisposal(raw, value => { const exact: Promise<{ id: number }> = value; void exact; });
export const nativeOwned = DiBag.withDisposal(native, value => { const exact: { id: number } = value; void exact; });
export const metadata = DiBag.withMetadata(rawOwned, { static: { owner: 'raw' as const } });
export const key: unique symbol = Symbol('raw');
export const token = DiBag.token(key).of<Promise<{ id: number }>>();
export const tokenProvider = DiBag.fromFunction([token], value => value, { acquisitionMode: 'raw' });
export const feature = DiBag.createModuleBuilder().register(token, metadata).register({ raw: rawOwned }).buildModule([token, 'raw']);
export const bag = DiBag.createBuilder().installModule(feature).replace('raw', raw).build();
export const projected = DiBag.transformService(native, { mode: 'direct', transform: value => value, ...{ acquisitionMode: 'raw' } });
export const framed = DiBag.withMetadata(raw, { dynamic: { mode: 'direct', describe: () => ({ source: 'raw' }) } });
export const capability = DiBag.transformService(DiBag.fromFactory(() => ({ read: () => pending }), { acquisitionMode: 'raw' }), { mode: 'direct', transform: source => source.read(), ...{ acquisitionMode: 'raw' } });
export type Checks = [
  Assert<Equal<ProviderOutput<typeof raw>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof rawOwned>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof nativeOwned>, { id: number }>>,
  Assert<Equal<ProviderAcquiredValue<typeof metadata>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderRegistrationMetadata<typeof metadata>, Readonly<{ owner: 'raw' }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof tokenProvider>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquiredValue<PublicProviders<{ raw: typeof raw }>['raw']>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof projected>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof framed>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof capability>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof raw | typeof native>, Promise<{ id: number }> | { id: number }>>,
  Assert<Equal<ProviderAcquiredValue<ProviderBase>, unknown>>,
  Assert<Equal<ProviderAcquiredValue<Provider<() => Promise<number>>>, number>>,
];
