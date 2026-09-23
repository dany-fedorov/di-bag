import { DiBag, type Provider } from '../../../src';
type Registration = Parameters<typeof DiBag.withMetadata>[0];
const provider = DiBag.withMetadata(({ clock }: { clock: number }) => clock, { static: { owner: 'team' } });
// diagnostic: required service registrations are missing
DiBag.createBuilder().withServices({ provider }).buildContainer();
// diagnostic: consumer dependency
DiBag.createBuilder().withServices({ provider, clock: () => 'wrong' });
// diagnostic: duplicate metadata
DiBag.withMetadata(provider, { static: { owner: 'duplicate' } });
const key = Symbol('owner');
const symbolProvider = DiBag.withMetadata(() => 1, { static: { [key]: 'team' } });
// diagnostic: duplicate metadata
DiBag.withMetadata(symbolProvider, { static: { [key]: 'duplicate' } });
// diagnostic: finite string or unique-symbol
DiBag.withMetadata(() => 1, { static: { 42: 'numeric' } });
const indexed: Record<string, number> = {};
// diagnostic: finite string or unique-symbol
DiBag.withMetadata(() => 1, { static: indexed });
const symbolIndexed: Record<symbol, number> = {};
// diagnostic: finite string or unique-symbol
DiBag.withMetadata(() => 1, { static: symbolIndexed });
const templateIndexed: Record<`app:${string}`, number> = {};
// diagnostic: finite string or unique-symbol
DiBag.withMetadata(() => 1, { static: templateIndexed });
// diagnostic: not assignable
DiBag.withMetadata(function (this: { value: number }) { return this.value; }, { static: {} });
// diagnostic: not assignable
DiBag.createBuilder().withServices({ provider: { ...provider } });
// diagnostic: not assignable
DiBag.withMetadata({ ...provider }, { static: {} });
// diagnostic: not assignable
const erasedMetadata: Provider<({ clock }: { clock: number }) => number, {}, readonly []> = provider;
// diagnostic: not assignable
const erasedFactory: Provider<() => number, { readonly owner: string }, readonly []> = provider;
declare const erased: Registration;
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 required service registrations are missing
DiBag.createBuilder().withServices({ erased }).buildContainer();
// diagnostic: factory dependencies must be finite
DiBag.createBuilder().withServices({ value: () => 1 }).withReplacedService('value', erased).buildContainer();
// diagnostic: factory dependencies must be finite
DiBag.createBuilder().withServices({ erased }).buildModule({ exportedServiceKeys: ['erased'] });
const bag = DiBag.createBuilder().withServices({ provider, clock: () => 1 }).buildContainer();
// diagnostic: does not exist
bag.serviceSnapshot('provider').registrationMetadata.other;
// diagnostic: does not exist
bag.serviceSnapshot('provider').acquisitions[0]!.value;
// diagnostic: read-only
bag.serviceSnapshot('provider').registrationMetadata.owner = 'other';
// diagnostic: does not exist
bag.serviceSnapshot('provider').acquisitions.push({});
// diagnostic: read-only
bag.serviceSnapshot('provider').acquisitions[0]!.state = 'failed';
// diagnostic: not assignable
bag.serviceSnapshot('unknown');
// diagnostic: not assignable
bag.createIndependentContainer(['clock'], { clock: DiBag.withMetadata(() => 'wrong', { static: {} }) });
// diagnostic: Property 'missing' is missing
bag.createIndependentContainer(['clock'], { clock: DiBag.withMetadata(({ missing }: { missing: number }) => missing, { static: {} }) });
