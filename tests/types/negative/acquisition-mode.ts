import { DiBag } from '../../../src';
import type { ProviderAcquiredValue } from '../../../src';
import type { ProviderBase } from '../../../src/provider';
const pending = Promise.resolve({ id: 7 });
const raw = DiBag.createProvider(() => pending, { factoryReturnKind: 'uninspected' });
const native = DiBag.createProvider(() => pending, { factoryReturnKind: 'native-promise' });
// diagnostic: native-promise factory return kind requires a Promise output
DiBag.createProvider(() => 7, { factoryReturnKind: 'native-promise' });
// diagnostic: No overload matches
DiBag.withDisposal(raw, (value: { id: number }) => {});
// diagnostic: No overload matches
DiBag.withDisposal(native, (value: Promise<{ id: number }>) => {});
// diagnostic: not assignable
DiBag.fromFactory(() => 7, { acquisitionMode: 'guess' });
// diagnostic: not assignable
DiBag.createProvider(function(this: { id: number }) { return this.id; }, { factoryReturnKind: 'uninspected' });
// diagnostic: not assignable
DiBag.withConfiguration({ runtime: { isNativePromise: (value: Promise<unknown>) => true } });
// diagnostic: not assignable
DiBag.withConfiguration({ runtime: { isNativePromise: () => 'yes' } });
// diagnostic: not assignable
DiBag.transformService(native, { mode: 'direct', transform: () => 7, ...{ acquisitionMode: 'nativePromise' } });
// diagnostic: not assignable
DiBag.createProviderFromFunction({ dependencies: [], factoryFunction: () => 7, factoryReturnKind: 'native-promise' });
// diagnostic: Property 'acquisitionMode' is missing
DiBag.transformService<typeof native, (value: typeof pending) => typeof pending, 'raw'>(native, { mode: 'direct', transform: value => value });
// diagnostic: Property 'factoryReturnKind' is missing
DiBag.createProviderFromFunction<readonly [], () => typeof pending, 'uninspected'>({ dependencies: [], factoryFunction: () => pending });
declare const union: typeof raw | typeof native;
// diagnostic: No overload matches
DiBag.withDisposal(union, (value: { id: number }) => {});
declare const erased: ProviderBase;
// diagnostic: No overload matches
DiBag.withDisposal(erased, (value: Promise<unknown>) => {});
declare const acquired: ProviderAcquiredValue<ProviderBase>;
// diagnostic: not assignable
const number: number = acquired;
