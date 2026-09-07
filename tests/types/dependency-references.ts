import { DiBag, type ProviderOutput, type ProviderAcquired, type ProviderTokenNeeds, type ProviderOptionalTokenNeeds, type ModuleRequires, type TokenGraph } from '../../src';
import type { ProviderGraph } from '../../src/provider';
import type { Assert, Equal } from './assert';
export const key = Symbol('number');
export const number = DiBag.token(key).of<number>();
export const optionalHandle = DiBag.optional(number);
export const lazyHandle = DiBag.lazy(number);
export const optional = DiBag.fromFunction([DiBag.optional(number)], value => value);
export const lazy = DiBag.fromFunction([DiBag.lazy(number)], get => ({ get }));
export const bag = DiBag.begin().add({ optional }).end();
export const mixed = DiBag.fromTokens([number, optionalHandle, lazyHandle], (value, maybe, get) => ({ value, maybe, get }));
export class Client { constructor(readonly maybe: number | undefined, readonly get: () => number) {} }
export const fromClass = DiBag.fromClass([optionalHandle, lazyHandle], Client);
export const feature = DiBag.module().add({ optional }).exports(['optional']);
export const emptyFeature = DiBag.module().add({ optional }).exports([]);
export const builder = DiBag.begin().install(feature);
export const emptyBuilder = DiBag.begin().install(emptyFeature);
export const requiredFeature = DiBag.module().add({ lazy }).exports(['lazy']);
export const ownedOptional = DiBag.withDisposal(DiBag.withMetadata(optional, { label: 'optional' as const }), value => { void value; });
export const retainedFeature = DiBag.module().add({ ownedOptional }).exports(['ownedOptional']);
export const complete = DiBag.begin().bind(number, () => 42).add({ lazy, mixed, fromClass }).end();
export const defaulted = DiBag.fromFunction([optionalHandle], (value = 3) => value);
export const rest = DiBag.fromFunction([optionalHandle, optionalHandle], (...values: (number | undefined)[]) => values);
const promiseKey = Symbol('promise'); const promised = DiBag.token(promiseKey).of<Promise<number>>();
export const raw = DiBag.fromFunction([DiBag.optional(promised)], value => value, { acquisition: 'raw' });
export const native = DiBag.fromFunction([DiBag.lazy(promised)], get => get(), { acquisition: 'native' });
export const promiseHandle = DiBag.lazy(promised);
const value = bag.resolve('optional');
export type Exact = [Assert<Equal<typeof value, number | undefined>>, Assert<Equal<ProviderOutput<typeof optional>, number | undefined>>,
  Assert<Equal<ProviderTokenNeeds<typeof optional>, never>>, Assert<Equal<ProviderOptionalTokenNeeds<typeof optional>, typeof number>>,
  Assert<Equal<ProviderTokenNeeds<typeof lazy>, typeof number>>, Assert<Equal<ProviderOptionalTokenNeeds<typeof lazy>, never>>,
  Assert<Equal<ProviderGraph<typeof mixed>, TokenGraph<readonly [typeof number, typeof number], never, readonly [typeof number]>>>,
  Assert<Equal<ProviderOutput<typeof lazy>, { get: () => number }>>,
  Assert<Equal<ModuleRequires<typeof feature>, Readonly<{ [key]?: number }>>>,
  Assert<Equal<ModuleRequires<typeof emptyFeature>, Readonly<{ [key]?: number }>>>,
  Assert<Equal<ModuleRequires<typeof requiredFeature>, Readonly<{ [key]: number }>>>,
  Assert<Equal<ProviderOutput<typeof defaulted>, number>>, Assert<Equal<ProviderOutput<typeof rest>, (number | undefined)[]>>,
  Assert<Equal<ProviderAcquired<typeof raw>, Promise<number> | undefined>>, Assert<Equal<ProviderAcquired<typeof native>, number>>];
export type Unions = [Assert<Equal<ProviderTokenNeeds<NoInfer<typeof optional | typeof lazy>>, typeof number>>,
  Assert<Equal<ProviderOptionalTokenNeeds<NoInfer<typeof optional | typeof lazy>>, typeof number>>];
builder.end(); emptyBuilder.end(); DiBag.begin().install(retainedFeature).end();
const privateFeature = DiBag.module().bind(number, () => 5).add({ optional, lazy }).exports(['optional', 'lazy']).rename('optional', 'maybe');
DiBag.begin().install(privateFeature).end();
const rootOptional = DiBag.withLifetime(optional, 'root');
DiBag.begin().add({ rootOptional }).end();
DiBag.begin().bind(number, DiBag.withLifetime(() => 1, 'root')).add({ rootOptional }).end();
const rootLazy = DiBag.withLifetime(lazy, 'root');
const rootBag = DiBag.begin().bind(number, DiBag.withLifetime(() => 1, 'root')).add({ rootLazy }).end();
rootBag.scope([number], { [key]: () => 2 });
DiBag.fromFunction<readonly [typeof optionalHandle], (value: number | undefined) => number | undefined>([optionalHandle], value => value);
DiBag.fromClass<readonly [typeof optionalHandle, typeof lazyHandle], typeof Client>([optionalHandle, lazyHandle], Client);
const reflected: typeof DiBag.fromFunction = DiBag.fromFunction;
export const reflectedProvider = reflected([optionalHandle, lazyHandle], (maybe, get) => ({ maybe, get }));
const mutableTokens: [typeof number] = [number];
export const mutable = DiBag.fromTokens(mutableTokens, value => value);
export type Mutable = Assert<Equal<ProviderGraph<typeof mutable>, TokenGraph<[typeof number]>>>;
export const nativeTokens = DiBag.fromTokens([DiBag.lazy(promised)], get => get(), { acquisition: 'native' });
export const explicitNative = DiBag.fromFunction<readonly [typeof promiseHandle], (get: () => Promise<number>) => Promise<number>, 'native'>([promiseHandle], get => get(), { acquisition: 'native' });
export type NativeExact = [Assert<Equal<ProviderAcquired<typeof nativeTokens>, number>>, Assert<Equal<ProviderAcquired<typeof explicitNative>, number>>];
const reflectedOptional: typeof DiBag.optional = DiBag.optional;
const reflectedLazy: typeof DiBag.lazy = DiBag.lazy;
export const reflectedHandles = DiBag.fromFunction([reflectedOptional(number), reflectedLazy(number)], (value, get) => ({ value, get }));
const eight = [optionalHandle, optionalHandle, optionalHandle, optionalHandle, optionalHandle, optionalHandle, optionalHandle, optionalHandle] as const;
const sixtyFour = [...eight, ...eight, ...eight, ...eight, ...eight, ...eight, ...eight, ...eight] as const;
export const longTuple = DiBag.fromTokens(sixtyFour, (...values) => values[0]);
export type LongTuple = Assert<Equal<ProviderOptionalTokenNeeds<typeof longTuple>, typeof number>>;
