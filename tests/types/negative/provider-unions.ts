import { DiBag, type ProviderOrFactory } from '../../../src';

const good = (_deps: { dep: boolean }) => ({
  read: () => 42,
});
const provider = DiBag.providerWithRegistrationMetadata({ provider: good, registrationMetadata: { owner: 'source' } });
const owned = DiBag.providerWithDisposal({ provider: good, disposeService: () => {} });
const bad = () => ({ read: (): unknown => 42 });
declare const mixed: typeof provider | typeof owned | typeof bad;
declare const reversed: typeof bad | typeof owned | typeof provider;
// diagnostic: not assignable
DiBag.providerWithTransformedService({ provider: mixed, transformService: (value: number) => value.toFixed(), callbackReceives: 'exposed-service' });
// diagnostic: not assignable
DiBag.providerWithTransformedService({ provider: mixed, transformService: (value: number) => value.toFixed(), callbackReceives: 'fulfilled-value' });
// diagnostic: not assignable
DiBag.providerWithDisposal({ provider: mixed, disposeService: (value: number) => { value.toFixed(); } });
// diagnostic: duplicate metadata
DiBag.providerWithRegistrationMetadata({ provider: mixed, registrationMetadata: { owner: 'duplicate' } });
// diagnostic: duplicate metadata
DiBag.providerWithRegistrationMetadata({ provider: reversed, registrationMetadata: { owner: 'duplicate' } });
// diagnostic: required service registrations are missing
DiBag.createBuilder().withServices({ mapped: DiBag.providerWithTransformedService({ provider: mixed, transformService: value => value.read(), callbackReceives: 'exposed-service' }) }).buildContainer();

type Registration = ProviderOrFactory;
type Opaque = Exclude<Registration, ((...args: never[]) => unknown) | { create: unknown }>;
declare const opaqueMixed: NoInfer<Opaque | typeof owned | typeof bad>;
// diagnostic: not assignable
DiBag.providerWithTransformedService({ provider: opaqueMixed, transformService: (value: number) => value.toFixed(), callbackReceives: 'exposed-service' });
// diagnostic: not assignable
DiBag.providerWithDisposal({ provider: opaqueMixed, disposeService: (value: number) => {} });
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 required service registrations are missing
DiBag.createBuilder().withServices({ mapped: DiBag.providerWithTransformedService({ provider: opaqueMixed, transformService: () => 42, callbackReceives: 'exposed-service' }) }).buildContainer();
