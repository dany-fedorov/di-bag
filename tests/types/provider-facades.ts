import { DiBag, type ProviderAcquiredValue, type ProviderOutput, type ProviderRegistrationMetadata, type ProviderAcquisitionMetadata, type ProviderGraphContract } from '../../src';
import type { Assert, Equal } from './assert';
const source = DiBag.createProvider(async ({ count }: { count: number }) => ({ count }));
const owned = DiBag.providerWithDisposal({ provider: source, disposeService: value => { const n: number = value.count; void n; } });
const registered = DiBag.providerWithRegistrationMetadata({ provider: owned, registrationMetadata: { owner: 'team' as const } });
const framed = DiBag.providerWithAcquisitionMetadata({ provider: registered, callbackReceives: 'fulfilled-value', describeAcquisition: value => ({ count: value.count }) });
const lifetimed = DiBag.providerWithLifetime({ provider: framed, lifetime: 'singleton:one-per-container-tree', allowsScopedDependencies: true });
export const decorated = DiBag.providerWithTransformedService({ provider: lifetimed, callbackReceives: 'fulfilled-value', transformService: value => value.count });
type _Output = Assert<Equal<ProviderOutput<typeof decorated>, Promise<number>>>;
type _Acquired = Assert<Equal<ProviderAcquiredValue<typeof decorated>, number>>;
type _Metadata = Assert<Equal<ProviderRegistrationMetadata<typeof decorated>, Readonly<{ owner: 'team' }>>>;
type _Frames = Assert<Equal<ProviderAcquisitionMetadata<typeof decorated>, readonly [Readonly<{ count: number }> ]>>;
type _Lifetime = Assert<Equal<ProviderGraphContract<typeof decorated>['lifetime'], Readonly<{ kind: 'singleton'; allowsScopedDependencies: true }>>>;
const strictSingleton = DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'singleton:one-per-container-tree', allowsScopedDependencies: false });
type _StrictLifetime = Assert<Equal<ProviderGraphContract<typeof strictSingleton>['lifetime'], Readonly<{ kind: 'singleton'; allowsScopedDependencies: false }>>>;
DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' });
DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'transient:one-per-resolve' });
const optionalLifetimeBag: { readonly provider: () => number; readonly lifetime: 'singleton:one-per-container-tree'; readonly allowsScopedDependencies?: boolean } = {
  provider: () => 1,
  lifetime: 'singleton:one-per-container-tree',
};
DiBag.providerWithLifetime(optionalLifetimeBag);
DiBag.providerWithLifetime<() => number, 'scoped:one-per-container'>({ provider: () => 1, lifetime: 'scoped:one-per-container' });
DiBag.providerWithLifetime<() => number, 'singleton:one-per-container-tree', { readonly allowsScopedDependencies: true }>({ provider: () => 1, lifetime: 'singleton:one-per-container-tree', allowsScopedDependencies: true });
const replacement = DiBag.providerWithDisposal({ provider: () => 2, disposeService: value => { const n: number = value; void n; } });
DiBag.createBuilder().withServices({ value: () => 1 }).withReplacedService('value', replacement);
const mappedReplacement = DiBag.providerWithTransformedService({ provider: () => 2, callbackReceives: 'exposed-service', transformService: value => value + 1 });
DiBag.createBuilder().withServices({ value: () => 1 }).withReplacedService('value', mappedReplacement);
const framedReplacement = DiBag.providerWithAcquisitionMetadata({ provider: () => Promise.resolve(2), callbackReceives: 'fulfilled-value', describeAcquisition: value => ({ value }) });
DiBag.createBuilder().withServices({ value: () => Promise.resolve(1) }).withReplacedService('value', framedReplacement);
const numberSymbol = Symbol('number');
const numberToken = DiBag.createToken(numberSymbol).forService<number>();
const tokenProvider = DiBag.providerWithLifetime({ provider: () => 3, lifetime: 'transient:one-per-resolve' });
DiBag.createBuilder().withTokenService(numberToken, tokenProvider).buildContainer().resolve(numberToken) satisfies number;

const nativeMapped = DiBag.providerWithTransformedService({ provider: DiBag.createProvider(() => Promise.resolve(1), { factoryReturnKind: 'native-promise' }), callbackReceives: 'exposed-service', transformService: value => value.then(number => String(number)), transformReturnKind: 'native-promise' });
type _NativeOutput = Assert<Equal<ProviderOutput<typeof nativeMapped>, Promise<string>>>;
type _NativeAcquired = Assert<Equal<ProviderAcquiredValue<typeof nativeMapped>, string>>;
const awaitedMapped = DiBag.providerWithTransformedService({ provider: DiBag.createProvider(() => Promise.resolve(1), { factoryReturnKind: 'native-promise' }), callbackReceives: 'fulfilled-value', transformService: value => value + 1 });
type _AwaitedOutput = Assert<Equal<ProviderOutput<typeof awaitedMapped>, Promise<number>>>;
const rawPromiseOwned = DiBag.providerWithDisposal({ provider: DiBag.createProvider(() => Promise.resolve(1), { factoryReturnKind: 'uninspected' }), disposeService: value => { const exact: Promise<number> = value; void exact; } });
type _RawPromiseOwned = Assert<Equal<ProviderAcquiredValue<typeof rawPromiseOwned>, Promise<number>>>;
const syncWrappedPromise = DiBag.providerWithTransformedService({ provider: () => 1, transformReturnKind: 'sync-value', transformService: value => ({ value: Promise.resolve(value) }), callbackReceives: 'exposed-service' });
type _SyncWrappedPromise = Assert<Equal<ProviderOutput<typeof syncWrappedPromise>, { value: Promise<number> }>>;
const reorderedNative = DiBag.providerWithTransformedService({ provider: () => 1, transformReturnKind: 'native-promise', callbackReceives: 'exposed-service', transformService: value => Promise.resolve(String(value)) });
type _ReorderedNative = Assert<Equal<ProviderOutput<typeof reorderedNative>, Promise<string>>>;
DiBag.providerWithTransformedService<typeof source, (value: { count: number }) => number>({ provider: source, callbackReceives: 'fulfilled-value', transformService: value => value.count });
DiBag.providerWithTransformedService<() => number, (value: number) => Promise<string>, 'native-promise'>({ provider: () => 1, callbackReceives: 'exposed-service', transformService: value => Promise.resolve(String(value)), transformReturnKind: 'native-promise' });
