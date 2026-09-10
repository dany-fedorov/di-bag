import { DiBag } from '../../src';
import { bag, extracted, handler, native, number, privateBag, raw, rawOwned, references, selected } from './plugins';
import type { Assert, Equal } from './assert';
import type { ProviderAcquiredValue, ProviderCollectionTokens, ProviderOptionalTokens, ProviderOutput, ProviderRequiredTokens } from '../../src';

const value = bag.resolve(handler);
export type Exact = [
  Assert<Equal<typeof value, { handle(value: string): string }>>,
  Assert<Equal<ProviderOutput<typeof raw>, { handle(value: string): string }>>,
  Assert<Equal<ProviderAcquiredValue<typeof native>, { handle(value: string): string }>>,
  Assert<Equal<ProviderOutput<typeof native>, Promise<{ handle(value: string): string }>>>,
  Assert<Equal<ProviderOutput<typeof extracted>, { handle(value: string): string }>>,
  Assert<Equal<ProviderRequiredTokens<typeof references>, typeof number | typeof import('./plugins').lazy>>,
  Assert<Equal<ProviderOptionalTokens<typeof references>, typeof import('./plugins').optional>>,
  Assert<Equal<ProviderCollectionTokens<typeof references>, typeof import('./plugins').all>>,
  Assert<Equal<ProviderAcquiredValue<typeof rawOwned>, { handle(value: string): string }>>,
];
DiBag.createBuilder().register(number, DiBag.fromFactory(() => 1, { acquisitionMode: 'raw' })).register({ extracted }).build();
const privateValue = privateBag.resolve('privatePlugin');
privateValue.handle('private');
void selected;
