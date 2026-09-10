import { DiBag, type ProviderOutput, type ProviderAcquiredValue, type ProviderRequiredTokens, type ProviderOptionalTokens, type ModuleRequiredServices, type TokenDependencyContract } from '../../src';
import type { ProviderGraphContract } from '../../src/provider';
import type { Assert, Equal } from './assert';
export const key = Symbol('number');
export const number = DiBag.token(key).of<number>();
export const optionalHandle = DiBag.optional(number);
export const lazyHandle = DiBag.lazy(number);
export const optional = DiBag.fromFunction([DiBag.optional(number)], value => value);
export const lazy = DiBag.fromFunction([DiBag.lazy(number)], get => ({ get }));
export const bag = DiBag.createBuilder().register({ optional }).build();
export const mixed = DiBag.fromFunction([number, optionalHandle, lazyHandle], (value, maybe, get) => ({ value, maybe, get }));
export class Client { constructor(readonly maybe: number | undefined, readonly get: () => number) {} }
export const fromClass = DiBag.fromClass([optionalHandle, lazyHandle], Client);
export const feature = DiBag.createModuleBuilder().register({ optional }).buildModule(['optional']);
export const emptyFeature = DiBag.createModuleBuilder().register({ optional }).buildModule([]);
export const builder = DiBag.createBuilder().installModule(feature);
export const emptyBuilder = DiBag.createBuilder().installModule(emptyFeature);
export const requiredFeature = DiBag.createModuleBuilder().register({ lazy }).buildModule(['lazy']);
export const ownedOptional = DiBag.withDisposal(DiBag.withMetadata(optional, { static: { label: 'optional' as const } }), value => { void value; });
export const retainedFeature = DiBag.createModuleBuilder().register({ ownedOptional }).buildModule(['ownedOptional']);
export const complete = DiBag.createBuilder().register(number, () => 42).register({ lazy, mixed, fromClass }).build();
export const defaulted = DiBag.fromFunction([optionalHandle], (value = 3) => value);
export const rest = DiBag.fromFunction([optionalHandle, optionalHandle], (...values: (number | undefined)[]) => values);
const promiseKey = Symbol('promise'); const promised = DiBag.token(promiseKey).of<Promise<number>>();
export const raw = DiBag.fromFunction([DiBag.optional(promised)], value => value, { acquisitionMode: 'raw' });
export const native = DiBag.fromFunction([DiBag.lazy(promised)], get => get(), { acquisitionMode: 'nativePromise' });
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
builder.build(); emptyBuilder.build(); DiBag.createBuilder().installModule(retainedFeature).build();
const privateFeature = DiBag.createModuleBuilder().register(number, () => 5).register({ optional, lazy }).buildModule(['optional', 'lazy']).renameExport('optional', 'maybe');
DiBag.createBuilder().installModule(privateFeature).build();
const rootOptional = DiBag.withLifetime(optional, 'root');
DiBag.createBuilder().register({ rootOptional }).build();
DiBag.createBuilder().register(number, DiBag.withLifetime(() => 1, 'root')).register({ rootOptional }).build();
const rootLazy = DiBag.withLifetime(lazy, 'root');
const rootBag = DiBag.createBuilder().register(number, DiBag.withLifetime(() => 1, 'root')).register({ rootLazy }).build();
rootBag.createScope([number], { [key]: () => 2 });
DiBag.fromFunction<readonly [typeof optionalHandle], (value: number | undefined) => number | undefined>([optionalHandle], value => value);
DiBag.fromClass<readonly [typeof optionalHandle, typeof lazyHandle], typeof Client>([optionalHandle, lazyHandle], Client);
const reflected: typeof DiBag.fromFunction = DiBag.fromFunction;
export const reflectedProvider = reflected([optionalHandle, lazyHandle], (maybe, get) => ({ maybe, get }));
const mutableTokens: [typeof number] = [number];
export const mutable = DiBag.fromFunction(mutableTokens, value => value);
export type Mutable = Assert<Equal<ProviderGraphContract<typeof mutable>, TokenDependencyContract<[typeof number]>>>;
export const nativeTokens = DiBag.fromFunction([DiBag.lazy(promised)], get => get(), { acquisitionMode: 'nativePromise' });
export const explicitNative = DiBag.fromFunction<readonly [typeof promiseHandle], (get: () => Promise<number>) => Promise<number>, 'nativePromise'>([promiseHandle], get => get(), { acquisitionMode: 'nativePromise' });
export type NativeExact = [Assert<Equal<ProviderAcquiredValue<typeof nativeTokens>, number>>, Assert<Equal<ProviderAcquiredValue<typeof explicitNative>, number>>];
const reflectedOptional: typeof DiBag.optional = DiBag.optional;
const reflectedLazy: typeof DiBag.lazy = DiBag.lazy;
export const reflectedHandles = DiBag.fromFunction([reflectedOptional(number), reflectedLazy(number)], (value, get) => ({ value, get }));
const eight = [optionalHandle, optionalHandle, optionalHandle, optionalHandle, optionalHandle, optionalHandle, optionalHandle, optionalHandle] as const;
const sixtyFour = [...eight, ...eight, ...eight, ...eight, ...eight, ...eight, ...eight, ...eight] as const;
export const longTuple = DiBag.fromFunction(sixtyFour, (...values) => values[0]);
export type LongTuple = Assert<Equal<ProviderOptionalTokens<typeof longTuple>, typeof number>>;
