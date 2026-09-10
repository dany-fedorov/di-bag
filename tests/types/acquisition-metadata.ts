import { DiBag, type ProviderAcquiredValue, type ProviderAcquisitionMetadata, type ProviderGraphContract, type ProviderRegistrationMetadata, type ProviderNamedDependencies, type ProviderOutput } from '../../src';
import type { Assert, Equal } from './assert';

const source = DiBag.withMetadata(({ seed }: { seed: number }) => ({ value: seed, origin: 'local' as const }), { static: { owner: 'team' as const } });
export const first = DiBag.withMetadata(source, { dynamic: { mode: 'direct', describe: result => ({ origin: result.origin }) } });
export const annotated = DiBag.withMetadata(first, { dynamic: { mode: 'direct', describe: result => ({ value: result.value }) } });
export const projected = DiBag.transformService(annotated, { mode: 'direct', transform: result => result.value });
export const asynchronous = DiBag.withMetadata(async () => ({ value: 1 }), { dynamic: { mode: 'awaited', describe: result => ({ value: result.value }) } });
const raw = DiBag.fromFactory(() => Promise.resolve(1), { acquisitionMode: 'raw' });
export const rawAnnotated = DiBag.withMetadata(raw, { dynamic: { mode: 'direct', describe: promise => ({ promise }) } });
DiBag.withDisposal(rawAnnotated, promise => { const exact: Promise<number> = promise; void exact; });
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
const unionAnnotated = DiBag.withMetadata(union, { dynamic: { mode: 'direct', describe: result => ({ value: result.value }) } });
type OpaqueRegistration = Exclude<Parameters<typeof DiBag.withMetadata>[0], ((...args: never[]) => unknown) | { create: unknown }>;
declare const opaque: OpaqueRegistration;
const opaqueAnnotated = DiBag.withMetadata(opaque, { dynamic: { mode: 'direct', describe: result => ({ value: result }) } });
export type ErasedContracts = [
  Assert<Equal<ProviderOutput<typeof unionAnnotated>, { value: number } | { value: string }>>,
  Assert<Equal<ProviderOutput<typeof opaqueAnnotated>, unknown>>,
  Assert<Equal<ProviderNamedDependencies<typeof opaqueAnnotated>, unknown>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof opaqueAnnotated>, readonly [...unknown[], Readonly<{ value: unknown }>]>>,
];
