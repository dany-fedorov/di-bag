import { DiBag } from '../../src';
import type { Provider, ProviderAcquiredValue, ProviderOutput, ProviderRegistrationMetadata, PublicProviders } from '../../src';
import type { ProviderBase } from '../../src/provider';
import type { Assert, Equal } from './assert';

const pending = Promise.resolve({ id: 7 });
export const raw = DiBag.createProvider(() => pending, { factoryReturnKind: 'uninspected' });
export const native = DiBag.createProvider(() => pending, { factoryReturnKind: 'native-promise' });
export const rawOwned = DiBag.providerWithDisposal({ provider: raw, disposeService: value => { const exact: Promise<{ id: number }> = value; void exact; } });
export const nativeOwned = DiBag.providerWithDisposal({ provider: native, disposeService: value => { const exact: { id: number } = value; void exact; } });
export const metadata = DiBag.providerWithRegistrationMetadata({ provider: rawOwned, registrationMetadata: { owner: 'raw' as const } });
export const key: unique symbol = Symbol('raw');
export const token = DiBag.createToken(key).forService<Promise<{ id: number }>>();
export const tokenProvider = DiBag.createProviderFromFunction({ dependencies: [token], factoryFunction: value => value, factoryReturnKind: 'uninspected' });
export const feature = DiBag.createBuilder().withTokenService(token, metadata).withServices({ raw: rawOwned }).buildModule({ exportedServiceKeys: [token, 'raw'] });
export const bag = DiBag.createBuilder().withInstalledModules([feature]).withReplacedService('raw', raw).buildContainer();
export const projected = DiBag.providerWithTransformedService({ provider: native, transformService: value => value, callbackReceives: 'exposed-service', transformReturnKind: 'uninspected' });
export const framed = DiBag.providerWithAcquisitionMetadata({ provider: raw, describeAcquisition: () => ({ source: 'raw' }), callbackReceives: 'exposed-service' });
export const capability = DiBag.providerWithTransformedService({ provider: DiBag.createProvider(() => ({ read: () => pending }), { factoryReturnKind: 'uninspected' }), transformService: source => source.read(), callbackReceives: 'exposed-service', transformReturnKind: 'uninspected' });
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
