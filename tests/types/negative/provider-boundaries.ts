import { DiBag, type Provider } from '../../../src';
type Registration = Parameters<typeof DiBag.withMetadata>[0];
const provider = DiBag.withMetadata(({ clock }: { clock: number }) => clock, { owner: 'team' });
// diagnostic: missing factories
DiBag.begin().add({ provider }).end();
// diagnostic: wrong shape
DiBag.begin().add({ provider, clock: () => 'wrong' });
// diagnostic: duplicate metadata
DiBag.withMetadata(provider, { owner: 'duplicate' });
const key = Symbol('owner');
const symbolProvider = DiBag.withMetadata(() => 1, { [key]: 'team' });
// diagnostic: duplicate metadata
DiBag.withMetadata(symbolProvider, { [key]: 'duplicate' });
// diagnostic: finite string or unique-symbol
DiBag.withMetadata(() => 1, { 42: 'numeric' });
const indexed: Record<string, number> = {};
// diagnostic: finite string or unique-symbol
DiBag.withMetadata(() => 1, indexed);
const symbolIndexed: Record<symbol, number> = {};
// diagnostic: finite string or unique-symbol
DiBag.withMetadata(() => 1, symbolIndexed);
const templateIndexed: Record<`app:${string}`, number> = {};
// diagnostic: finite string or unique-symbol
DiBag.withMetadata(() => 1, templateIndexed);
// diagnostic: not assignable
DiBag.withMetadata(function (this: { value: number }) { return this.value; }, {});
// diagnostic: not assignable
DiBag.begin().add({ provider: { ...provider } });
// diagnostic: not assignable
DiBag.withMetadata({ ...provider }, {});
// diagnostic: not assignable
const erasedMetadata: Provider<({ clock }: { clock: number }) => number, {}, readonly []> = provider;
// diagnostic: not assignable
const erasedFactory: Provider<() => number, { readonly owner: string }, readonly []> = provider;
declare const erased: Registration;
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 missing factories
DiBag.begin().add({ erased }).end();
// diagnostic: factory dependencies must be finite
// diagnostic-native-gap: last-token-string
DiBag.begin().add({ value: () => 1 }).replace('value', erased).end();
// diagnostic: factory dependencies must be finite
DiBag.module().add({ erased }).exports(['erased']);
const bag = DiBag.begin().add({ provider, clock: () => 1 }).end();
// diagnostic: does not exist
bag.inspect('provider').metadata.other;
// diagnostic: does not exist
bag.inspect('provider').acquisitions[0]!.value;
// diagnostic: read-only
bag.inspect('provider').metadata.owner = 'other';
// diagnostic: does not exist
bag.inspect('provider').acquisitions.push({});
// diagnostic: read-only
bag.inspect('provider').acquisitions[0]!.state = 'failed';
// diagnostic: not assignable
bag.inspect('unknown');
// diagnostic: not assignable
bag.fork(['clock'], { clock: DiBag.withMetadata(() => 'wrong', {}) });
// diagnostic: Property 'missing' is missing
bag.fork(['clock'], { clock: DiBag.withMetadata(({ missing }: { missing: number }) => missing, {}) });
