import { DiBag } from '../../src';
import type { PluginOptions, PluginOutputValidator, ProviderAcquiredValue, ProviderCollectionTokens, ProviderGraphContract, ProviderOptionalTokens, ProviderOutput, ProviderRequiredTokens, TokenDependencyContract } from '../../src';
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
  acquisitionMode: 'raw',
  validate: (value): value is Handler => typeof value === 'object' && value !== null && 'handle' in value,
});
export const native = DiBag.fromPlugin([], selected, {
  acquisitionMode: 'nativePromise',
  validate: (value): value is Handler => typeof value === 'object' && value !== null && 'handle' in value,
});
export const references = DiBag.fromPlugin([number, DiBag.optional(optional), DiBag.lazy(lazy), DiBag.all(all)], selected, {
  acquisitionMode: 'raw',
  validate: (value): value is Handler => typeof value === 'object' && value !== null && 'handle' in value,
});
export const rawOwned = DiBag.withDisposal(raw, value => { const exact: Handler = value; void exact; });
export const nativeOwned = DiBag.withDisposal(native, value => { const exact: Handler = value; void exact; });
export const feature = DiBag.createBuilder().register(handler, raw).buildModule([handler]);
export const bag = DiBag.createBuilder().register(number, DiBag.fromFactory(() => 7, { acquisitionMode: 'raw' })).installModule(feature).build();
export const value = bag.resolve(handler);
export const fromPlugin = DiBag.fromPlugin;
export const extracted = fromPlugin([], selected, {
  acquisitionMode: 'raw',
  validate: (value): value is Handler => typeof value === 'object' && value !== null && 'handle' in value,
});
export const privateKey = Symbol('private');
export const privateToken = DiBag.token(privateKey).of<number>();
export const privatePlugin = DiBag.fromPlugin([privateToken], selected, {
  acquisitionMode: 'raw',
  validate: (value): value is Handler => typeof value === 'object' && value !== null && 'handle' in value,
});
export const privateFeature = DiBag.createBuilder().register(privateToken, DiBag.fromFactory(() => 1, { acquisitionMode: 'raw' })).register({ privatePlugin }).buildModule(['privatePlugin']);
export const privateBag = DiBag.createBuilder().installModule(privateFeature).build();
export type Exact = [
  Assert<Equal<typeof value, Handler>>,
  Assert<Equal<ProviderOutput<typeof raw>, Handler>>,
  Assert<Equal<ProviderAcquiredValue<typeof raw>, Handler>>,
  Assert<Equal<ProviderOutput<typeof native>, Promise<Handler>>>,
  Assert<Equal<ProviderAcquiredValue<typeof native>, Handler>>,
  Assert<Equal<ProviderGraphContract<typeof raw>, TokenDependencyContract<readonly [typeof number]>>>,
  Assert<Equal<ProviderRequiredTokens<typeof references>, typeof number | typeof lazy>>,
  Assert<Equal<ProviderOptionalTokens<typeof references>, typeof optional>>,
  Assert<Equal<ProviderCollectionTokens<typeof references>, typeof all>>,
  Assert<Equal<ProviderAcquiredValue<typeof rawOwned>, Handler>>,
  Assert<Equal<ProviderAcquiredValue<typeof nativeOwned>, Handler>>,
  Assert<Equal<ThisParameterType<PluginOutputValidator<Handler>>, void>>,
  Assert<Equal<PluginOptions<'raw', Handler>['acquisitionMode'], 'raw'>>,
];
