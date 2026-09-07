import type { ProviderOutput, ProviderNeeds, ProviderAcquisitionMetadata, ValBoxFrame } from '../../src';
import { raw, inline, twice, inlineService, inlinePromised } from './modern-inline';
import type { Assert, Equal } from './assert';
type Contracts = [
  Assert<Equal<ProviderOutput<typeof inline>, typeof raw>>,
  Assert<Equal<ProviderNeeds<typeof inline>, Record<never, never>>>,
  Assert<Equal<ProviderOutput<typeof twice>, Promise<number>>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof twice>, readonly [ValBoxFrame<never>, ValBoxFrame<{owner:string}>]>>,
  Assert<Equal<typeof inlineService, {read(): number; extra(): boolean; richer(): number}>>,
  Assert<Equal<typeof inlinePromised, Promise<number>>>,
];
