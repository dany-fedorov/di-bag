import { DiBag, type Provider, type ProviderOrFactory } from '../../../src';
const source = DiBag.providerWithRegistrationMetadata({ provider: ({ clock }: { clock: number }) => ({ value: clock }), registrationMetadata: { owner: 'team' } });
// diagnostic: not assignable
DiBag.providerWithTransformedService({ provider: source, transformService: (value: { value: string }) => value, callbackReceives: 'exposed-service' });
// diagnostic: not assignable
DiBag.providerWithTransformedService({ provider: source, transformService: (value: { value: string }) => value, callbackReceives: 'fulfilled-value' });
// diagnostic: not assignable
DiBag.providerWithTransformedService({ provider: () => Promise.resolve(1), transformService: (value: number) => value, callbackReceives: 'exposed-service' });
// diagnostic: not assignable
DiBag.providerWithTransformedService({ provider: source, transformService: function (this: { prefix: string }, value) { return this.prefix + value.value; }, callbackReceives: 'exposed-service' });
// diagnostic: not assignable
DiBag.providerWithTransformedService({ provider: source, transformService: function (this: { prefix: string }, value) { return this.prefix + value.value; }, callbackReceives: 'fulfilled-value' });
const mapped = DiBag.providerWithTransformedService({ provider: source, transformService: value => value.value, callbackReceives: 'exposed-service' });
// diagnostic: required service registrations are missing
DiBag.createBuilder().withServices({ mapped }).buildContainer();
// diagnostic: consumer dependency
DiBag.createBuilder().withServices({ mapped, clock: () => 'wrong' });
// diagnostic: not assignable
DiBag.providerWithDisposal({ provider: mapped, disposeService: (value: string) => {} });
// diagnostic: not assignable
DiBag.providerWithTransformedService({ provider: { ...mapped }, transformService: (value: unknown) => value, callbackReceives: 'exposed-service' });
// diagnostic: not assignable
const erased: Provider<() => number, {}, readonly []> = mapped;
type Registration = ProviderOrFactory;
declare const opaque: Exclude<Registration, ((...args: never[]) => unknown) | { create: unknown }>;
// diagnostic: not assignable
DiBag.providerWithTransformedService({ provider: opaque, transformService: (value: number) => value, callbackReceives: 'exposed-service' });
// diagnostic: not assignable
DiBag.providerWithTransformedService({ provider: opaque, transformService: (value: number) => value, callbackReceives: 'fulfilled-value' });
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 required service registrations are missing
DiBag.createBuilder().withServices({ mapped: DiBag.providerWithTransformedService({ provider: opaque, transformService: () => 1, callbackReceives: 'exposed-service' }) }).buildContainer();
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 required service registrations are missing
DiBag.createBuilder().withServices({ mapped: DiBag.providerWithTransformedService({ provider: opaque, transformService: () => 1, callbackReceives: 'fulfilled-value' }) }).buildContainer();
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 required service registrations are missing
DiBag.createBuilder().withServices({ mapped: DiBag.providerWithDisposal({ provider: DiBag.providerWithTransformedService({ provider: opaque, transformService: () => 1, callbackReceives: 'exposed-service' }), disposeService: () => {} }) }).buildContainer();
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 required service registrations are missing
DiBag.createBuilder().withServices({ mapped: DiBag.providerWithTransformedService({ provider: DiBag.providerWithDisposal({ provider: opaque, disposeService: () => {} }), transformService: () => 1, callbackReceives: 'fulfilled-value' }) }).buildContainer();
declare const wrapped: NoInfer<Registration>;
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 required service registrations are missing
DiBag.createBuilder().withServices({ mapped: DiBag.providerWithTransformedService({ provider: wrapped, transformService: () => 1, callbackReceives: 'exposed-service' }) }).buildContainer();
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 required service registrations are missing
DiBag.createBuilder().withServices({ mapped: DiBag.providerWithTransformedService({ provider: wrapped, transformService: () => 1, callbackReceives: 'fulfilled-value' }) }).buildContainer();
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 required service registrations are missing
DiBag.createBuilder().withServices({ mapped: DiBag.providerWithDisposal({ provider: wrapped, disposeService: () => {} }) }).buildContainer();
// diagnostic: factory dependencies must be finite
DiBag.createBuilder().withServices({ mapped: DiBag.providerWithDisposal({ provider: DiBag.providerWithTransformedService({ provider: wrapped, transformService: () => 1, callbackReceives: 'fulfilled-value' }), disposeService: () => {} }) }).buildModule({ exportedServiceKeys: ['mapped'] });
// diagnostic: does not exist
DiBag.providerWithDisposal({ provider: () => 1, disposeService: () => {} }).create = () => 2;
// diagnostic: not assignable
DiBag.providerWithDisposal({ provider: () => 1, disposeService: function (this: { cleanup(): void }, value: number) { this.cleanup(); } });
// diagnostic: not assignable
DiBag.providerWithDisposal({ provider: mapped, disposeService: function (this: { cleanup(): void }, value: number) { this.cleanup(); } });
