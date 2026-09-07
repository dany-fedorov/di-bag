import { DiBag } from '../../src';
import { bag, extracted, handler, native, number, privateBag, raw, rawOwned, references, selected } from './plugins';
import type { Assert, Equal } from './assert';
import type { ProviderAcquired, ProviderAllTokenNeeds, ProviderOptionalTokenNeeds, ProviderOutput, ProviderTokenNeeds } from '../../src';

const value = bag.resolve(handler);
export type Exact = [
  Assert<Equal<typeof value, { handle(value: string): string }>>,
  Assert<Equal<ProviderOutput<typeof raw>, { handle(value: string): string }>>,
  Assert<Equal<ProviderAcquired<typeof native>, { handle(value: string): string }>>,
  Assert<Equal<ProviderOutput<typeof native>, Promise<{ handle(value: string): string }>>>,
  Assert<Equal<ProviderOutput<typeof extracted>, { handle(value: string): string }>>,
  Assert<Equal<ProviderTokenNeeds<typeof references>, typeof number | typeof import('./plugins').lazy>>,
  Assert<Equal<ProviderOptionalTokenNeeds<typeof references>, typeof import('./plugins').optional>>,
  Assert<Equal<ProviderAllTokenNeeds<typeof references>, typeof import('./plugins').all>>,
  Assert<Equal<ProviderAcquired<typeof rawOwned>, { handle(value: string): string }>>,
];
DiBag.begin().bind(number, DiBag.factory(() => 1, { acquisition: 'raw' })).add({ extracted }).end();
const privateValue = privateBag.resolve('privatePlugin');
privateValue.handle('private');
void selected;
