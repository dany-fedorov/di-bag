import { DiBag } from '../../../src';
import type { ProviderAcquired } from '../../../src';
import type { ProviderBase } from '../../../src/provider';
const pending = Promise.resolve({ id: 7 });
const raw = DiBag.factory(() => pending, { acquisition: 'raw' });
const native = DiBag.factory(() => pending, { acquisition: 'native' });
// diagnostic: native acquisition requires a Promise output
DiBag.factory(() => 7, { acquisition: 'native' });
// diagnostic: No overload matches
DiBag.withDisposal(raw, (value: { id: number }) => {});
// diagnostic: No overload matches
DiBag.withDisposal(native, (value: Promise<{ id: number }>) => {});
// diagnostic: not assignable
DiBag.factory(() => 7, { acquisition: 'guess' });
// diagnostic: not assignable
DiBag.factory(function(this: { id: number }) { return this.id; }, { acquisition: 'raw' });
// diagnostic: not assignable
DiBag.configure({ isNativePromise: (value: Promise<unknown>) => true });
// diagnostic: not assignable
DiBag.configure({ isNativePromise: () => 'yes' });
// diagnostic: not assignable
DiBag.mapSync(native, () => 7, { acquisition: 'native' });
// diagnostic: not assignable
DiBag.fromTokens([], () => 7, { acquisition: 'native' });
// diagnostic: Expected 3 arguments
DiBag.mapSync<typeof native, (value: typeof pending) => typeof pending, 'raw'>(native, value => value);
// diagnostic: Expected 3 arguments
DiBag.fromTokens<readonly [], () => typeof pending, 'raw'>([], () => pending);
declare const union: typeof raw | typeof native;
// diagnostic: No overload matches
DiBag.withDisposal(union, (value: { id: number }) => {});
declare const erased: ProviderBase;
// diagnostic: No overload matches
DiBag.withDisposal(erased, (value: Promise<unknown>) => {});
declare const acquired: ProviderAcquired<ProviderBase>;
// diagnostic: not assignable
const number: number = acquired;
