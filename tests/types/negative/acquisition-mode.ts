import { DiBag } from '../../../src';
import type { ProviderAcquiredValue } from '../../../src';
import type { ProviderBase } from '../../../src/provider';
const pending = Promise.resolve({ id: 7 });
const raw = DiBag.fromFactory(() => pending, { acquisitionMode: 'raw' });
const native = DiBag.fromFactory(() => pending, { acquisitionMode: 'nativePromise' });
// diagnostic: nativePromise acquisition requires a Promise output
DiBag.fromFactory(() => 7, { acquisitionMode: 'nativePromise' });
// diagnostic: No overload matches
DiBag.withDisposal(raw, (value: { id: number }) => {});
// diagnostic: No overload matches
DiBag.withDisposal(native, (value: Promise<{ id: number }>) => {});
// diagnostic: not assignable
DiBag.fromFactory(() => 7, { acquisitionMode: 'guess' });
// diagnostic: not assignable
DiBag.fromFactory(function(this: { id: number }) { return this.id; }, { acquisitionMode: 'raw' });
// diagnostic: not assignable
DiBag.withConfiguration({ runtime: { isNativePromise: (value: Promise<unknown>) => true } });
// diagnostic: not assignable
DiBag.withConfiguration({ runtime: { isNativePromise: () => 'yes' } });
// diagnostic: not assignable
DiBag.transformService(native, { mode: 'direct', transform: () => 7, ...{ acquisitionMode: 'nativePromise' } });
// diagnostic: not assignable
DiBag.fromFunction([], () => 7, { acquisitionMode: 'nativePromise' });
// diagnostic: Property 'acquisitionMode' is missing
DiBag.transformService<typeof native, (value: typeof pending) => typeof pending, 'raw'>(native, { mode: 'direct', transform: value => value });
// diagnostic: Expected 3 arguments
DiBag.fromFunction<readonly [], () => typeof pending, 'raw'>([], () => pending);
declare const union: typeof raw | typeof native;
// diagnostic: No overload matches
DiBag.withDisposal(union, (value: { id: number }) => {});
declare const erased: ProviderBase;
// diagnostic: No overload matches
DiBag.withDisposal(erased, (value: Promise<unknown>) => {});
declare const acquired: ProviderAcquiredValue<ProviderBase>;
// diagnostic: not assignable
const number: number = acquired;
