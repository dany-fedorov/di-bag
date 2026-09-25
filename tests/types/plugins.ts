import { DiBag } from '../../src';
import type { CreateProviderFromPluginOptions, PluginOutputValidator, ProviderAcquiredValue, ProviderCollectionTokens, ProviderGraphContract, ProviderOptionalTokens, ProviderOutput, ProviderRequiredTokens, TokenDependencyContract } from '../../src';
import type { Assert, Equal } from './assert';

export interface Handler { handle(value: string): string }
export const handlerKey = Symbol('handler');
export const handler = DiBag.createToken(handlerKey).forService<Handler>();
export const numberKey = Symbol('number');
export const number = DiBag.createToken(numberKey).forService<number>();
export const optionalKey = Symbol('optional');
export const optional = DiBag.createToken(optionalKey).forService<number>();
export const lazyKey = Symbol('lazy');
export const lazy = DiBag.createToken(lazyKey).forService<number>();
export const allKey = Symbol('all');
export const all = DiBag.createToken(allKey).forCollectionOf<number>();
export const selected: unknown = {
  apiVersion: 1,
  create: (value: number) => ({ handle: (text: string) => `${value}:${text}` }),
};
export const raw = DiBag.createProviderFromPlugin({ dependencies: [number], pluginDescriptor: selected, factoryReturnKind: 'uninspected', isValidPluginOutput: (value): value is Handler => typeof value === 'object' && value !== null && 'handle' in value });
export const native = DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: selected, factoryReturnKind: 'native-promise', isValidPluginOutput: (value): value is Handler => typeof value === 'object' && value !== null && 'handle' in value });
export const references = DiBag.createProviderFromPlugin({ dependencies: [number, DiBag.optional(optional), DiBag.lazy(lazy), all], pluginDescriptor: selected, factoryReturnKind: 'uninspected', isValidPluginOutput: (value): value is Handler => typeof value === 'object' && value !== null && 'handle' in value });
export const rawOwned = DiBag.providerWithDisposal({ provider: raw, disposeService: value => { const exact: Handler = value; void exact; } });
export const nativeOwned = DiBag.providerWithDisposal({ provider: native, disposeService: value => { const exact: Handler = value; void exact; } });
export const feature = DiBag.createBuilder().withTokenService(handler, raw).buildModule({ exportedServiceKeys: [handler] });
export const bag = DiBag.createBuilder().withTokenService(number, DiBag.createProvider(() => 7, { factoryReturnKind: 'uninspected' })).withInstalledModules([feature]).buildContainer();
export const value = bag.resolve(handler);
export const createPlugin = DiBag.createProviderFromPlugin;
export const extracted = createPlugin({ dependencies: [], pluginDescriptor: selected,
  factoryReturnKind: 'uninspected',
  isValidPluginOutput: (value): value is Handler => typeof value === 'object' && value !== null && 'handle' in value,
});
export const privateKey = Symbol('private');
export const privateToken = DiBag.createToken(privateKey).forService<number>();
export const privatePlugin = DiBag.createProviderFromPlugin({ dependencies: [privateToken], pluginDescriptor: selected, factoryReturnKind: 'uninspected', isValidPluginOutput: (value): value is Handler => typeof value === 'object' && value !== null && 'handle' in value });
export const privateFeature = DiBag.createBuilder().withTokenService(privateToken, DiBag.createProvider(() => 1, { factoryReturnKind: 'uninspected' })).withServices({ privatePlugin }).buildModule({ exportedServiceKeys: ['privatePlugin'] });
export const privateBag = DiBag.createBuilder().withInstalledModules([privateFeature]).buildContainer();
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
  Assert<Equal<CreateProviderFromPluginOptions<'uninspected', Handler>['factoryReturnKind'], 'uninspected'>>,
];
