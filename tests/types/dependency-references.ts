import { DiBag, type ProviderOutput, type ProviderAcquiredValue, type ProviderRequiredTokens, type ProviderOptionalTokens, type ModuleRequiredServices, type TokenDependencyContract } from '../../src';
import type { ProviderGraphContract } from '../../src/provider';
import type { Assert, Equal } from './assert';
export const key = Symbol('number');
export const number = DiBag.createToken(key).forService<number>();
export const optionalHandle = DiBag.optional(number);
export const lazyHandle = DiBag.lazy(number);
export const optional = DiBag.createProviderFromFunction({ dependencies: [DiBag.optional(number)], factoryFunction: value => value });
export const lazy = DiBag.createProviderFromFunction({ dependencies: [DiBag.lazy(number)], factoryFunction: get => ({ get }) });
export const bag = DiBag.createBuilder().withServices({ optional }).buildContainer();
export const mixed = DiBag.createProviderFromFunction({ dependencies: [number, optionalHandle, lazyHandle], factoryFunction: (value, maybe, get) => ({ value, maybe, get }) });
export class Client { constructor(readonly maybe: number | undefined, readonly get: () => number) {} }
export const classProvider = DiBag.createProviderFromClass({ dependencies: [optionalHandle, lazyHandle], serviceClass: Client });
export const feature = DiBag.createBuilder().withServices({ optional }).buildModule({ exportedServiceKeys: ['optional'] });
export const emptyFeature = DiBag.createBuilder().withServices({ optional }).buildModule({ exportedServiceKeys: [] });
export const builder = DiBag.createBuilder().withInstalledModules([feature]);
export const emptyBuilder = DiBag.createBuilder().withInstalledModules([emptyFeature]);
export const requiredFeature = DiBag.createBuilder().withServices({ lazy }).buildModule({ exportedServiceKeys: ['lazy'] });
export const ownedOptional = DiBag.providerWithDisposal({ provider: DiBag.providerWithRegistrationMetadata({ provider: optional, registrationMetadata: { label: 'optional' as const } }), disposeService: value => { void value; } });
export const retainedFeature = DiBag.createBuilder().withServices({ ownedOptional }).buildModule({ exportedServiceKeys: ['ownedOptional'] });
export const complete = DiBag.createBuilder().withTokenService(number, () => 42).withServices({ lazy, mixed, classProvider }).buildContainer();
export const defaulted = DiBag.createProviderFromFunction({ dependencies: [optionalHandle], factoryFunction: (value = 3) => value });
export const rest = DiBag.createProviderFromFunction({ dependencies: [optionalHandle, optionalHandle], factoryFunction: (...values: (number | undefined)[]) => values });
const promiseKey = Symbol('promise'); const promised = DiBag.createToken(promiseKey).forService<Promise<number>>();
export const raw = DiBag.createProviderFromFunction({ dependencies: [DiBag.optional(promised)], factoryFunction: value => value, factoryReturnKind: 'uninspected' });
export const native = DiBag.createProviderFromFunction({ dependencies: [DiBag.lazy(promised)], factoryFunction: get => get(), factoryReturnKind: 'native-promise' });
export const promiseHandle = DiBag.lazy(promised);
const value = bag.resolve('optional');
export type Exact = [Assert<Equal<typeof value, number | undefined>>, Assert<Equal<ProviderOutput<typeof optional>, number | undefined>>,
  Assert<Equal<ProviderRequiredTokens<typeof optional>, never>>, Assert<Equal<ProviderOptionalTokens<typeof optional>, typeof number>>,
  Assert<Equal<ProviderRequiredTokens<typeof lazy>, typeof number>>, Assert<Equal<ProviderOptionalTokens<typeof lazy>, never>>,
  Assert<Equal<ProviderGraphContract<typeof mixed>, TokenDependencyContract<readonly [typeof number, typeof number], never, readonly [typeof number]>>>,
  Assert<Equal<ProviderOutput<typeof lazy>, { get: () => number }>>,
  Assert<Equal<ModuleRequiredServices<typeof feature>, Readonly<{ [key]?: number }>>>,
  Assert<Equal<ModuleRequiredServices<typeof emptyFeature>, Readonly<{ [key]?: number }>>>,
  Assert<Equal<ModuleRequiredServices<typeof requiredFeature>, Readonly<{ [key]: number }>>>,
  Assert<Equal<ProviderOutput<typeof defaulted>, number>>, Assert<Equal<ProviderOutput<typeof rest>, (number | undefined)[]>>,
  Assert<Equal<ProviderAcquiredValue<typeof raw>, Promise<number> | undefined>>, Assert<Equal<ProviderAcquiredValue<typeof native>, number>>];
export type Unions = [Assert<Equal<ProviderRequiredTokens<NoInfer<typeof optional | typeof lazy>>, typeof number>>,
  Assert<Equal<ProviderOptionalTokens<NoInfer<typeof optional | typeof lazy>>, typeof number>>];
builder.buildContainer(); emptyBuilder.buildContainer(); DiBag.createBuilder().withInstalledModules([retainedFeature]).buildContainer();
const privateFeature = DiBag.createBuilder().withTokenService(number, () => 5).withServices({ optional, lazy }).buildModule({ exportedServiceKeys: ['optional', 'lazy'] }).withRenamedExport({ currentExportKey: 'optional', newExportKey: 'maybe' });
DiBag.createBuilder().withInstalledModules([privateFeature]).buildContainer();
const rootOptional = DiBag.providerWithLifetime({ provider: optional, lifetime: 'singleton:one-per-container-tree' });
DiBag.createBuilder().withServices({ rootOptional }).buildContainer();
DiBag.createBuilder().withTokenService(number, DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'singleton:one-per-container-tree' })).withServices({ rootOptional }).buildContainer();
const rootLazy = DiBag.providerWithLifetime({ provider: lazy, lifetime: 'singleton:one-per-container-tree' });
const rootBag = DiBag.createBuilder().withTokenService(number, DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'singleton:one-per-container-tree' })).withServices({ rootLazy }).buildContainer();
rootBag.createChildContainer([number], { [key]: () => 2 });
DiBag.createProviderFromFunction<readonly [typeof optionalHandle], (value: number | undefined) => number | undefined>({ dependencies: [optionalHandle], factoryFunction: value => value });
DiBag.createProviderFromClass<readonly [typeof optionalHandle, typeof lazyHandle], typeof Client>({ dependencies: [optionalHandle, lazyHandle], serviceClass: Client });
const reflected: typeof DiBag.createProviderFromFunction = DiBag.createProviderFromFunction;
export const reflectedProvider = reflected({ dependencies: [optionalHandle, lazyHandle], factoryFunction: (maybe, get) => ({ maybe, get }) });
const mutableTokens: [typeof number] = [number];
export const mutable = DiBag.createProviderFromFunction({ dependencies: mutableTokens, factoryFunction: value => value });
export type Mutable = Assert<Equal<ProviderGraphContract<typeof mutable>, TokenDependencyContract<[typeof number]>>>;
export const nativeTokens = DiBag.createProviderFromFunction({ dependencies: [DiBag.lazy(promised)], factoryFunction: get => get(), factoryReturnKind: 'native-promise' });
export const explicitNative = DiBag.createProviderFromFunction<readonly [typeof promiseHandle], (get: () => Promise<number>) => Promise<number>, 'native-promise'>({ dependencies: [promiseHandle], factoryFunction: get => get(), factoryReturnKind: 'native-promise' });
export type NativeExact = [Assert<Equal<ProviderAcquiredValue<typeof nativeTokens>, number>>, Assert<Equal<ProviderAcquiredValue<typeof explicitNative>, number>>];
const reflectedOptional: typeof DiBag.optional = DiBag.optional;
const reflectedLazy: typeof DiBag.lazy = DiBag.lazy;
export const reflectedHandles = DiBag.createProviderFromFunction({ dependencies: [reflectedOptional(number), reflectedLazy(number)], factoryFunction: (value, get) => ({ value, get }) });
const eight = [optionalHandle, optionalHandle, optionalHandle, optionalHandle, optionalHandle, optionalHandle, optionalHandle, optionalHandle] as const;
const sixtyFour = [...eight, ...eight, ...eight, ...eight, ...eight, ...eight, ...eight, ...eight] as const;
export const longTuple = DiBag.createProviderFromFunction({ dependencies: sixtyFour, factoryFunction: (...values) => values[0] });
export type LongTuple = Assert<Equal<ProviderOptionalTokens<typeof longTuple>, typeof number>>;
