import { DiBag } from '../../../src';
import type { ProviderAcquiredValue } from '../../../src';
import type { ProviderBase } from '../../../src/provider';
const pending = Promise.resolve({ id: 7 });
const raw = DiBag.createProvider(() => pending, { factoryReturnKind: 'uninspected' });
const native = DiBag.createProvider(() => pending, { factoryReturnKind: 'native-promise' });
// diagnostic: native-promise factory return kind requires a Promise output
DiBag.createProvider(() => 7, { factoryReturnKind: 'native-promise' });
// diagnostic: not assignable
DiBag.providerWithDisposal({ provider: raw, disposeService: (value: { id: number }) => {} });
// diagnostic: not assignable
DiBag.providerWithDisposal({ provider: native, disposeService: (value: Promise<{ id: number }>) => {} });
// diagnostic: not assignable
DiBag.createProvider(() => 7, { factoryReturnKind: 'guess' });
// diagnostic: not assignable
DiBag.createProvider(function(this: { id: number }) { return this.id; }, { factoryReturnKind: 'uninspected' });
// diagnostic: not assignable
DiBag.withConfiguration({ runtime: { isNativePromise: (value: Promise<unknown>) => true } });
// diagnostic: not assignable
DiBag.withConfiguration({ runtime: { isNativePromise: () => 'yes' } });
// diagnostic: not assignable
DiBag.providerWithTransformedService({ provider: native, transformService: () => 7, callbackReceives: 'exposed-service', transformReturnKind: 'native-promise' });
// diagnostic: not assignable
DiBag.createProviderFromFunction({ dependencies: [], factoryFunction: () => 7, factoryReturnKind: 'native-promise' });
// diagnostic: Property 'transformReturnKind' is missing
DiBag.providerWithTransformedService<typeof native, (value: typeof pending) => typeof pending, 'uninspected'>({ provider: native, transformService: value => value, callbackReceives: 'exposed-service' });
// diagnostic: Property 'factoryReturnKind' is missing
DiBag.createProviderFromFunction<readonly [], () => typeof pending, 'uninspected'>({ dependencies: [], factoryFunction: () => pending });
declare const union: typeof raw | typeof native;
// diagnostic: not assignable
DiBag.providerWithDisposal({ provider: union, disposeService: (value: { id: number }) => {} });
declare const erased: ProviderBase;
// diagnostic: not assignable
DiBag.providerWithDisposal({ provider: erased, disposeService: (value: Promise<unknown>) => {} });
declare const acquired: ProviderAcquiredValue<ProviderBase>;
// diagnostic: not assignable
const number: number = acquired;
