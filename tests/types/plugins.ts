import { DiBag } from '../../src';
import type { PluginOptions, PluginPredicate, ProviderAcquired, ProviderGraph, ProviderOutput, TokenGraph } from '../../src';
import type { Assert, Equal } from './assert';

export interface Handler { handle(value: string): string }
export const handlerKey = Symbol('handler');
export const handler = DiBag.token(handlerKey).of<Handler>();
export const numberKey = Symbol('number');
export const number = DiBag.token(numberKey).of<number>();
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
export const feature = DiBag.module().bind(handler, raw).exports([handler]);
export const bag = DiBag.begin().bind(number, DiBag.factory(() => 7, { acquisition: 'raw' })).install(feature).end();
export const value = bag.resolve(handler);
export const fromPlugin = DiBag.fromPlugin;
export const extracted = fromPlugin([], selected, {
  acquisition: 'raw',
  validate: (value): value is Handler => typeof value === 'object' && value !== null && 'handle' in value,
});
export type Exact = [
  Assert<Equal<typeof value, Handler>>,
  Assert<Equal<ProviderOutput<typeof raw>, Handler>>,
  Assert<Equal<ProviderAcquired<typeof raw>, Handler>>,
  Assert<Equal<ProviderOutput<typeof native>, Promise<Handler>>>,
  Assert<Equal<ProviderAcquired<typeof native>, Handler>>,
  Assert<Equal<ProviderGraph<typeof raw>, TokenGraph<readonly [typeof number]>>>,
  Assert<Equal<ThisParameterType<PluginPredicate<Handler>>, void>>,
  Assert<Equal<PluginOptions<'raw', Handler>['acquisition'], 'raw'>>,
];
