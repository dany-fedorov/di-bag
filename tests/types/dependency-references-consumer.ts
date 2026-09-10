import { DiBag, type ProviderOutput, type ProviderAcquiredValue, type ProviderOptionalTokens } from '../../src';
import { bag, builder, emptyBuilder, retainedFeature, optional, lazy, number, key, native, raw, fromClass, Client, reflectedProvider } from './dependency-references';
import type { Assert, Equal } from './assert';
const value = bag.resolve('optional'); const absent = builder.build().resolve('optional');
export type Exact = [Assert<Equal<typeof value, number | undefined>>, Assert<Equal<typeof absent, number | undefined>>,
  Assert<Equal<ProviderOutput<typeof optional>, number | undefined>>, Assert<Equal<ProviderOptionalTokens<typeof optional>, typeof number>>,
  Assert<Equal<ProviderOutput<typeof lazy>, { get: () => number }>>, Assert<Equal<ProviderOutput<typeof fromClass>, Client>>,
  Assert<Equal<ProviderAcquiredValue<typeof native>, number>>, Assert<Equal<ProviderAcquiredValue<typeof raw>, Promise<number> | undefined>>,
  Assert<Equal<ProviderOutput<typeof reflectedProvider>, { maybe: number | undefined; get: () => number }>>];
emptyBuilder.build(); DiBag.createBuilder().installModule(retainedFeature).build();
const wrong = DiBag.token(key).of<string>();
// @ts-expect-error optional presence preserves its nominal service contract across declarations
builder.register(wrong, () => 'wrong');
// @ts-expect-error exportless module retains its optional obligation
emptyBuilder.register(wrong, () => 'wrong');
// @ts-expect-error retained public provider carries optional obligations in its module constraints
DiBag.createBuilder().register(wrong, () => 'wrong').installModule(retainedFeature);
// @ts-expect-error lazy declaration retains completeness
DiBag.createBuilder().register({ lazy }).build();
