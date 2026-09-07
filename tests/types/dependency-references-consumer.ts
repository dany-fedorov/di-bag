import { DiBag, type ProviderOutput, type ProviderAcquired, type ProviderOptionalTokenNeeds } from '../../src';
import { bag, builder, emptyBuilder, retainedFeature, optional, lazy, number, key, native, raw, fromClass, Client, reflectedProvider } from './dependency-references';
import type { Assert, Equal } from './assert';
const value = bag.resolve('optional'); const absent = builder.end().resolve('optional');
export type Exact = [Assert<Equal<typeof value, number | undefined>>, Assert<Equal<typeof absent, number | undefined>>,
  Assert<Equal<ProviderOutput<typeof optional>, number | undefined>>, Assert<Equal<ProviderOptionalTokenNeeds<typeof optional>, typeof number>>,
  Assert<Equal<ProviderOutput<typeof lazy>, { get: () => number }>>, Assert<Equal<ProviderOutput<typeof fromClass>, Client>>,
  Assert<Equal<ProviderAcquired<typeof native>, number>>, Assert<Equal<ProviderAcquired<typeof raw>, Promise<number> | undefined>>,
  Assert<Equal<ProviderOutput<typeof reflectedProvider>, { maybe: number | undefined; get: () => number }>>];
emptyBuilder.end(); DiBag.begin().install(retainedFeature).end();
const wrong = DiBag.token(key).of<string>();
// @ts-expect-error optional presence preserves its nominal service contract across declarations
builder.bind(wrong, () => 'wrong');
// @ts-expect-error exportless module retains its optional obligation
emptyBuilder.bind(wrong, () => 'wrong');
// @ts-expect-error retained public provider carries optional obligations in its module constraints
DiBag.begin().bind(wrong, () => 'wrong').install(retainedFeature);
// @ts-expect-error lazy declaration retains completeness
DiBag.begin().add({ lazy }).end();
