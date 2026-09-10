import { DiBag, type ProviderAcquired, type ProviderAcquisitionMetadata, type ProviderGraph, type ProviderMetadata, type ProviderNeeds, type ProviderOutput } from '../../src';
import type { Assert, Equal } from './assert';

const source = DiBag.withMetadata(({ seed }: { seed: number }) => ({ value: seed, origin: 'local' as const }), { owner: 'team' as const });
export const first = DiBag.withAcquisitionMetadata(source, result => ({ origin: result.origin }));
export const annotated = DiBag.withAcquisitionMetadata(first, result => ({ value: result.value }));
export const projected = DiBag.mapSync(annotated, result => result.value);
export const asynchronous = DiBag.withAcquisitionMetadataAsync(async () => ({ value: 1 }), result => ({ value: result.value }));
const raw = DiBag.factory(() => Promise.resolve(1), { acquisition: 'raw' });
export const rawAnnotated = DiBag.withAcquisitionMetadata(raw, promise => ({ promise }));
DiBag.withDisposal(rawAnnotated, promise => { const exact: Promise<number> = promise; void exact; });
export type Contracts = [
  Assert<Equal<ProviderOutput<typeof annotated>, { value: number; origin: 'local' }>>,
  Assert<Equal<ProviderAcquired<typeof annotated>, ProviderAcquired<typeof source>>>,
  Assert<Equal<ProviderNeeds<typeof annotated>, { seed: number }>>,
  Assert<Equal<ProviderMetadata<typeof annotated>, Readonly<{ owner: 'team' }>>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof projected>, readonly [Readonly<{ origin: 'local' }>, Readonly<{ value: number }>]>>,
  Assert<Equal<ProviderGraph<typeof annotated>, ProviderGraph<typeof source>>>,
  Assert<Equal<ProviderOutput<typeof asynchronous>, Promise<{ value: number }>>>,
  Assert<Equal<ProviderAcquired<typeof rawAnnotated>, Promise<number>>>,
];
declare const union: (() => { value: number }) | (() => { value: string });
const unionAnnotated = DiBag.withAcquisitionMetadata(union, result => ({ value: result.value }));
type OpaqueRegistration = Exclude<Parameters<typeof DiBag.withMetadata>[0], ((...args: never[]) => unknown) | { create: unknown }>;
declare const opaque: OpaqueRegistration;
const opaqueAnnotated = DiBag.withAcquisitionMetadata(opaque, result => ({ value: result }));
export type ErasedContracts = [
  Assert<Equal<ProviderOutput<typeof unionAnnotated>, { value: number } | { value: string }>>,
  Assert<Equal<ProviderOutput<typeof opaqueAnnotated>, unknown>>,
  Assert<Equal<ProviderNeeds<typeof opaqueAnnotated>, unknown>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof opaqueAnnotated>, readonly [...unknown[], Readonly<{ value: unknown }>]>>,
];
