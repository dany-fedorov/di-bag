import { DiBag, type ProviderAcquiredValue, type ProviderAcquisitionMetadata, type ProviderGraphContract, type ProviderRegistrationMetadata, type ProviderNamedDependencies, type ProviderOrFactory, type ProviderOutput } from '../../src';
import type { Assert, Equal } from './assert';

const source = DiBag.providerWithRegistrationMetadata({ provider: ({ seed }: { seed: number }) => ({ value: seed, origin: 'local' as const }), registrationMetadata: { owner: 'team' as const } });
export const first = DiBag.providerWithAcquisitionMetadata({ provider: source, describeAcquisition: result => ({ origin: result.origin }), callbackReceives: 'exposed-service' });
export const annotated = DiBag.providerWithAcquisitionMetadata({ provider: first, describeAcquisition: result => ({ value: result.value }), callbackReceives: 'exposed-service' });
export const projected = DiBag.providerWithTransformedService({ provider: annotated, transformService: result => result.value, callbackReceives: 'exposed-service' });
export const asynchronous = DiBag.providerWithAcquisitionMetadata({ provider: async () => ({ value: 1 }), describeAcquisition: result => ({ value: result.value }), callbackReceives: 'fulfilled-value' });
const raw = DiBag.createProvider(() => Promise.resolve(1), { factoryReturnKind: 'uninspected' });
export const rawAnnotated = DiBag.providerWithAcquisitionMetadata({ provider: raw, describeAcquisition: promise => ({ promise }), callbackReceives: 'exposed-service' });
DiBag.providerWithDisposal({ provider: rawAnnotated, disposeService: promise => { const exact: Promise<number> = promise; void exact; } });
export type Contracts = [
  Assert<Equal<ProviderOutput<typeof annotated>, { value: number; origin: 'local' }>>,
  Assert<Equal<ProviderAcquiredValue<typeof annotated>, ProviderAcquiredValue<typeof source>>>,
  Assert<Equal<ProviderNamedDependencies<typeof annotated>, { seed: number }>>,
  Assert<Equal<ProviderRegistrationMetadata<typeof annotated>, Readonly<{ owner: 'team' }>>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof projected>, readonly [Readonly<{ origin: 'local' }>, Readonly<{ value: number }>]>>,
  Assert<Equal<ProviderGraphContract<typeof annotated>, ProviderGraphContract<typeof source>>>,
  Assert<Equal<ProviderOutput<typeof asynchronous>, Promise<{ value: number }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof rawAnnotated>, Promise<number>>>,
];
declare const union: (() => { value: number }) | (() => { value: string });
const unionAnnotated = DiBag.providerWithAcquisitionMetadata({ provider: union, describeAcquisition: result => ({ value: result.value }), callbackReceives: 'exposed-service' });
type OpaqueRegistration = Exclude<ProviderOrFactory, ((...args: never[]) => unknown) | { create: unknown }>;
declare const opaque: OpaqueRegistration;
const opaqueAnnotated = DiBag.providerWithAcquisitionMetadata({ provider: opaque, describeAcquisition: result => ({ value: result }), callbackReceives: 'exposed-service' });
export type ErasedContracts = [
  Assert<Equal<ProviderOutput<typeof unionAnnotated>, { value: number } | { value: string }>>,
  Assert<Equal<ProviderOutput<typeof opaqueAnnotated>, unknown>>,
  Assert<Equal<ProviderNamedDependencies<typeof opaqueAnnotated>, unknown>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof opaqueAnnotated>, readonly [...unknown[], Readonly<{ value: unknown }>]>>,
];
