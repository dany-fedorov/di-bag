import { DiBag, type Provider, type ProviderOrFactory } from '../../../src';
type Registration = ProviderOrFactory;
const provider = DiBag.providerWithRegistrationMetadata({ provider: ({ clock }: { clock: number }) => clock, registrationMetadata: { owner: 'team' } });
// diagnostic: required service registrations are missing
DiBag.createBuilder().withServices({ provider }).buildContainer();
// diagnostic: consumer dependency
DiBag.createBuilder().withServices({ provider, clock: () => 'wrong' });
// diagnostic: duplicate metadata
DiBag.providerWithRegistrationMetadata({ provider: provider, registrationMetadata: { owner: 'duplicate' } });
const key = Symbol('owner');
const symbolProvider = DiBag.providerWithRegistrationMetadata({ provider: () => 1, registrationMetadata: { [key]: 'team' } });
// diagnostic: duplicate metadata
DiBag.providerWithRegistrationMetadata({ provider: symbolProvider, registrationMetadata: { [key]: 'duplicate' } });
// diagnostic: finite string or unique-symbol
DiBag.providerWithRegistrationMetadata({ provider: () => 1, registrationMetadata: { 42: 'numeric' } });
const indexed: Record<string, number> = {};
// diagnostic: finite string or unique-symbol
DiBag.providerWithRegistrationMetadata({ provider: () => 1, registrationMetadata: indexed });
const symbolIndexed: Record<symbol, number> = {};
// diagnostic: finite string or unique-symbol
DiBag.providerWithRegistrationMetadata({ provider: () => 1, registrationMetadata: symbolIndexed });
const templateIndexed: Record<`app:${string}`, number> = {};
// diagnostic: finite string or unique-symbol
DiBag.providerWithRegistrationMetadata({ provider: () => 1, registrationMetadata: templateIndexed });
// diagnostic: not assignable
DiBag.providerWithRegistrationMetadata({ provider: function (this: { value: number }) { return this.value; }, registrationMetadata: {} });
// diagnostic: not assignable
DiBag.createBuilder().withServices({ provider: { ...provider } });
// diagnostic: not assignable
DiBag.providerWithRegistrationMetadata({ provider: { ...provider }, registrationMetadata: {} });
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
bag.createIndependentContainer(['clock'], { clock: DiBag.providerWithRegistrationMetadata({ provider: () => 'wrong', registrationMetadata: {} }) });
// diagnostic: Property 'missing' is missing
bag.createIndependentContainer(['clock'], { clock: DiBag.providerWithRegistrationMetadata({ provider: ({ missing }: { missing: number }) => missing, registrationMetadata: {} }) });
