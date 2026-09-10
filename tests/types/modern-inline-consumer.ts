import type { ProviderOutput, ProviderNamedDependencies, ProviderAcquisitionMetadata } from '../../src';
import { raw, inline, twice, inlineService, inlinePromised } from './modern-inline';
import type { Assert, Equal } from './assert';
type Contracts = [
  Assert<Equal<ProviderOutput<typeof inline>, typeof raw>>,
  Assert<Equal<ProviderNamedDependencies<typeof inline>, Record<never, never>>>,
  Assert<Equal<ProviderOutput<typeof twice>, Promise<number>>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof twice>, readonly [Readonly<{}>, Readonly<{owner:string}>]>>,
  Assert<Equal<typeof inlineService, {read(): number; extra(): boolean; richer(): number}>>,
  Assert<Equal<typeof inlinePromised, Promise<number>>>,
];
