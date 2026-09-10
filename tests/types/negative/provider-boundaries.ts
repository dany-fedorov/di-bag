import { DiBag, type Provider } from '../../../src';
type Registration = Parameters<typeof DiBag.withMetadata>[0];
const provider = DiBag.withMetadata(({ clock }: { clock: number }) => clock, { static: { owner: 'team' } });
// diagnostic: required service registrations are missing
DiBag.createBuilder().register({ provider }).build();
// diagnostic: consumer dependency
DiBag.createBuilder().register({ provider, clock: () => 'wrong' });
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
DiBag.createBuilder().register({ provider: { ...provider } });
// diagnostic: not assignable
DiBag.withMetadata({ ...provider }, { static: {} });
// diagnostic: not assignable
const erasedMetadata: Provider<({ clock }: { clock: number }) => number, {}, readonly []> = provider;
// diagnostic: not assignable
const erasedFactory: Provider<() => number, { readonly owner: string }, readonly []> = provider;
declare const erased: Registration;
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 required service registrations are missing
DiBag.createBuilder().register({ erased }).build();
// diagnostic: factory dependencies must be finite
DiBag.createBuilder().register({ value: () => 1 }).replace('value', erased).build();
// diagnostic: factory dependencies must be finite
DiBag.createModuleBuilder().register({ erased }).buildModule(['erased']);
const bag = DiBag.createBuilder().register({ provider, clock: () => 1 }).build();
// diagnostic: does not exist
bag.inspect('provider').registrationMetadata.other;
// diagnostic: does not exist
bag.inspect('provider').acquisitions[0]!.value;
// diagnostic: read-only
bag.inspect('provider').registrationMetadata.owner = 'other';
// diagnostic: does not exist
bag.inspect('provider').acquisitions.push({});
// diagnostic: read-only
bag.inspect('provider').acquisitions[0]!.state = 'failed';
// diagnostic: not assignable
bag.inspect('unknown');
// diagnostic: not assignable
bag.fork(['clock'], { clock: DiBag.withMetadata(() => 'wrong', { static: {} }) });
// diagnostic: Property 'missing' is missing
bag.fork(['clock'], { clock: DiBag.withMetadata(({ missing }: { missing: number }) => missing, { static: {} }) });
