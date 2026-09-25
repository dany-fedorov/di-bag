import { DiBag, type ProviderOrFactory } from '../../../src';
// diagnostic: not assignable
DiBag.providerWithAcquisitionMetadata({ provider: () => 1, describeAcquisition: () => 2, callbackReceives: 'exposed-service' });
// diagnostic: not assignable
DiBag.providerWithAcquisitionMetadata({ provider: () => 1, describeAcquisition: () => null, callbackReceives: 'exposed-service' });
// diagnostic: acquisition metadata must be a synchronous object record
// diagnostic-also: TS2769 No overload matches this call.
DiBag.providerWithAcquisitionMetadata({ provider: () => 1, describeAcquisition: async () => ({ origin: 'async' }), callbackReceives: 'exposed-service' });
// diagnostic: acquisition metadata must be a synchronous object record
DiBag.providerWithAcquisitionMetadata({ provider: () => 1, describeAcquisition: async () => ({ origin: 'async' }), callbackReceives: 'fulfilled-value' });
// diagnostic: acquisition metadata must be a synchronous object record
// diagnostic-also: TS2769 No overload matches this call.
DiBag.providerWithAcquisitionMetadata({ provider: () => 1, describeAcquisition: () => [], callbackReceives: 'exposed-service' });
// diagnostic: acquisition metadata must be a synchronous object record
// diagnostic-also: TS2769 No overload matches this call.
DiBag.providerWithAcquisitionMetadata({ provider: () => 1, describeAcquisition: () => () => 1, callbackReceives: 'exposed-service' });
// diagnostic: acquisition metadata must be a synchronous object record
// diagnostic-also: TS2769 No overload matches this call.
DiBag.providerWithAcquisitionMetadata({ provider: () => 1, describeAcquisition: () => ({ then() {} }), callbackReceives: 'exposed-service' });
declare const unionMetadata: { origin: string } | Promise<{ origin: string }>;
// diagnostic: acquisition metadata must be a synchronous object record
// diagnostic-also: TS2769 No overload matches this call.
DiBag.providerWithAcquisitionMetadata({ provider: () => 1, describeAcquisition: () => unionMetadata, callbackReceives: 'exposed-service' });
// diagnostic: not assignable
DiBag.providerWithAcquisitionMetadata({ provider: () => Promise.resolve(1), describeAcquisition: (value: number) => ({ value }), callbackReceives: 'exposed-service' });
// diagnostic: not assignable
DiBag.providerWithAcquisitionMetadata({ provider: () => Promise.resolve(1), describeAcquisition: (value: Promise<number>) => ({ value }), callbackReceives: 'fulfilled-value' });
// diagnostic: not assignable
DiBag.providerWithAcquisitionMetadata({ provider: () => 1, describeAcquisition: function (this: { origin: string }, value) { return { origin: this.origin, value }; }, callbackReceives: 'exposed-service' });
type OpaqueRegistration = Exclude<ProviderOrFactory, ((...args: never[]) => unknown) | { create: unknown }>;
declare const opaque: OpaqueRegistration;
// diagnostic: not assignable
DiBag.providerWithAcquisitionMetadata({ provider: opaque, describeAcquisition: (value: number) => ({ value }), callbackReceives: 'exposed-service' });
// diagnostic: factory dependencies must be finite
// diagnostic-also: TS2684 required service registrations are missing
DiBag.createBuilder().withServices({ value: DiBag.providerWithAcquisitionMetadata({ provider: opaque, describeAcquisition: value => ({ value }), callbackReceives: 'exposed-service' }) }).buildContainer();
const annotated = DiBag.providerWithAcquisitionMetadata({ provider: ({ dep }: { dep: number }) => dep, describeAcquisition: value => ({ value }), callbackReceives: 'exposed-service' });
// diagnostic: required service registrations are missing
DiBag.createBuilder().withServices({ annotated }).buildContainer();
// diagnostic: consumer dependency
DiBag.createBuilder().withServices({ annotated, dep: () => 'wrong' });
// diagnostic: read-only
DiBag.createBuilder().withServices({ value: DiBag.providerWithAcquisitionMetadata({ provider: () => 1, describeAcquisition: value => ({ value }), callbackReceives: 'exposed-service' }) }).buildContainer().serviceSnapshot('value').acquisitions[0]!.acquisitionMetadata[0] = { isPresent: false };
