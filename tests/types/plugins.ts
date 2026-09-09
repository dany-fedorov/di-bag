import { DiBag } from '../../src';
import type { PluginOptions, PluginPredicate, ProviderAcquired, ProviderAllTokenNeeds, ProviderGraph, ProviderOptionalTokenNeeds, ProviderOutput, ProviderTokenNeeds, TokenGraph } from '../../src';
import type { Assert, Equal } from './assert';

export interface Handler { handle(value: string): string }
export const handlerKey = Symbol('handler');
export const handler = DiBag.token(handlerKey).of<Handler>();
export const numberKey = Symbol('number');
export const number = DiBag.token(numberKey).of<number>();
export const optionalKey = Symbol('optional');
export const optional = DiBag.token(optionalKey).of<number>();
export const lazyKey = Symbol('lazy');
export const lazy = DiBag.token(lazyKey).of<number>();
export const allKey = Symbol('all');
export const all = DiBag.token(allKey).of<number>();
export const selected: unknown = {
  apiVersion: 1,
  create: (value: number) => ({ handle: (text: string) => `${value}:${text}` }),
};
export const raw = DiBag.fromPlugin([number], selected, {
  acquisition: 'raw',
  validate: (value): value is Handler => typeof value === 'object' && value !== null && 'handle' in value,
});
export const native = DiBag.fromPlugin([], selected, {
  acquisition: 'native',
  validate: (value): value is Handler => typeof value === 'object' && value !== null && 'handle' in value,
});
export const references = DiBag.fromPlugin([number, DiBag.optional(optional), DiBag.lazy(lazy), DiBag.all(all)], selected, {
  acquisition: 'raw',
  validate: (value): value is Handler => typeof value === 'object' && value !== null && 'handle' in value,
});
export const rawOwned = DiBag.withDisposal(raw, value => { const exact: Handler = value; void exact; });
export const nativeOwned = DiBag.withDisposal(native, value => { const exact: Handler = value; void exact; });
export const feature = DiBag.module().bind(handler, raw).exports([handler]);
export const bag = DiBag.begin().bind(number, DiBag.factory(() => 7, { acquisition: 'raw' })).install(feature).end();
export const value = bag.resolve(handler);
export const fromPlugin = DiBag.fromPlugin;
export const extracted = fromPlugin([], selected, {
  acquisition: 'raw',
  validate: (value): value is Handler => typeof value === 'object' && value !== null && 'handle' in value,
});
export const privateKey = Symbol('private');
export const privateToken = DiBag.token(privateKey).of<number>();
export const privatePlugin = DiBag.fromPlugin([privateToken], selected, {
  acquisition: 'raw',
  validate: (value): value is Handler => typeof value === 'object' && value !== null && 'handle' in value,
});
export const privateFeature = DiBag.module().bind(privateToken, DiBag.factory(() => 1, { acquisition: 'raw' }))
  .add({ privatePlugin }).exports(['privatePlugin']);
export const privateBag = DiBag.begin().install(privateFeature).end();
export type Exact = [
  Assert<Equal<typeof value, Handler>>,
  Assert<Equal<ProviderOutput<typeof raw>, Handler>>,
  Assert<Equal<ProviderAcquired<typeof raw>, Handler>>,
  Assert<Equal<ProviderOutput<typeof native>, Promise<Handler>>>,
  Assert<Equal<ProviderAcquired<typeof native>, Handler>>,
  Assert<Equal<ProviderGraph<typeof raw>, TokenGraph<readonly [typeof number]>>>,
  Assert<Equal<ProviderTokenNeeds<typeof references>, typeof number | typeof lazy>>,
  Assert<Equal<ProviderOptionalTokenNeeds<typeof references>, typeof optional>>,
  Assert<Equal<ProviderAllTokenNeeds<typeof references>, typeof all>>,
  Assert<Equal<ProviderAcquired<typeof rawOwned>, Handler>>,
  Assert<Equal<ProviderAcquired<typeof nativeOwned>, Handler>>,
  Assert<Equal<ThisParameterType<PluginPredicate<Handler>>, void>>,
  Assert<Equal<PluginOptions<'raw', Handler>['acquisition'], 'raw'>>,
];
