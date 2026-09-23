import { DiBag } from '../../src';
import type { Provider, ProviderAcquiredValue, ProviderOutput, ProviderRegistrationMetadata, PublicProviders } from '../../src';
import type { ProviderBase } from '../../src/provider';
import type { Assert, Equal } from './assert';

const pending = Promise.resolve({ id: 7 });
export const raw = DiBag.createProvider(() => pending, { factoryReturnKind: 'uninspected' });
export const native = DiBag.createProvider(() => pending, { factoryReturnKind: 'native-promise' });
export const rawOwned = DiBag.withDisposal(raw, value => { const exact: Promise<{ id: number }> = value; void exact; });
export const nativeOwned = DiBag.withDisposal(native, value => { const exact: { id: number } = value; void exact; });
export const metadata = DiBag.withMetadata(rawOwned, { static: { owner: 'raw' as const } });
export const key: unique symbol = Symbol('raw');
export const token = DiBag.createToken(key).forService<Promise<{ id: number }>>();
export const tokenProvider = DiBag.createProviderFromFunction({ dependencies: [token], factoryFunction: value => value, factoryReturnKind: 'uninspected' });
export const feature = DiBag.createBuilder().withTokenService(token, metadata).withServices({ raw: rawOwned }).buildModule({ exportedServiceKeys: [token, 'raw'] });
export const bag = DiBag.createBuilder().withInstalledModules([feature]).withReplacedService('raw', raw).buildContainer();
export const projected = DiBag.transformService(native, { mode: 'direct', transform: value => value, ...{ acquisitionMode: 'uninspected' } });
export const framed = DiBag.withMetadata(raw, { dynamic: { mode: 'direct', describe: () => ({ source: 'raw' }) } });
export const capability = DiBag.transformService(DiBag.createProvider(() => ({ read: () => pending }), { factoryReturnKind: 'uninspected' }), { mode: 'direct', transform: source => source.read(), ...{ acquisitionMode: 'uninspected' } });
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
