import { DiBag, type ProviderOutput, type ProviderAcquiredValue, type ProviderOptionalTokens } from '../../src';
import { bag, builder, emptyBuilder, retainedFeature, optional, lazy, number, key, native, raw, classProvider, Client, reflectedProvider } from './dependency-references';
import type { Assert, Equal } from './assert';
const value = bag.resolve('optional'); const absent = builder.buildContainer().resolve('optional');
export type Exact = [Assert<Equal<typeof value, number | undefined>>, Assert<Equal<typeof absent, number | undefined>>,
  Assert<Equal<ProviderOutput<typeof optional>, number | undefined>>, Assert<Equal<ProviderOptionalTokens<typeof optional>, typeof number>>,
  Assert<Equal<ProviderOutput<typeof lazy>, { get: () => number }>>, Assert<Equal<ProviderOutput<typeof classProvider>, Client>>,
  Assert<Equal<ProviderAcquiredValue<typeof native>, number>>, Assert<Equal<ProviderAcquiredValue<typeof raw>, Promise<number> | undefined>>,
  Assert<Equal<ProviderOutput<typeof reflectedProvider>, { maybe: number | undefined; get: () => number }>>];
emptyBuilder.buildContainer(); DiBag.createBuilder().withInstalledModules([retainedFeature]).buildContainer();
const wrong = DiBag.createToken(key).forService<string>();
// @ts-expect-error optional presence preserves its nominal service contract across declarations
builder.withTokenService(wrong, () => 'wrong');
// @ts-expect-error exportless module retains its optional obligation
emptyBuilder.withTokenService(wrong, () => 'wrong');
// @ts-expect-error retained public provider carries optional obligations in its module constraints
DiBag.createBuilder().withTokenService(wrong, () => 'wrong').withInstalledModules([retainedFeature]);
// @ts-expect-error lazy declaration retains completeness
DiBag.createBuilder().withServices({ lazy }).buildContainer();
