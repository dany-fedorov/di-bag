import type { Complete, From, Entries, Entry, Checked, Merge, Unsatisfied, Needs } from '../src/types';
import type { Registration, Registrations, DisposableFactory } from '../src/registration';
import type { InvalidGraphs, MissingTokens, TokenGraph, Binding } from '../src/token-types';
import type { Provider, ProviderBase } from '../src/provider';
import type { Token } from '../src/tokens';
import type { Builder, Bag } from '../src/di-bag';
import type { CheckedLifetimes } from '../src/lifetime-types';
import type { CompleteConstraints, NeedConstraint } from '../src/module-types';

type RequiredOf<R extends Registrations> = { [K in keyof R]: keyof Needs<R[K]> }[keyof R];
type Legacy<R extends Registrations> = [Exclude<RequiredOf<R>, keyof R> | MissingTokens<R>] extends [never]
  ? [InvalidGraphs<R>] extends [never] ? unknown
    : Unsatisfied<'token dependency has an incompatible or opaque contract', { tokens: InvalidGraphs<R> }>
  : Unsatisfied<'missing factories', { missing: Exclude<RequiredOf<R>, keyof R> | MissingTokens<R> }>;
type Equal<X,Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;
type Assert<T extends true> = T;

type Good = () => number;
type Missing = (deps: {absent: number}) => number;
type Present = (deps: {value: number}) => string;
declare const tokenKey: unique symbol;
declare const secondKey: unique symbol;
type TestToken = Token<typeof tokenKey, number>;
type TokenConsumer = Provider<() => number, {}, readonly [], TokenGraph<readonly [TestToken]>>;
type OptionalTokenConsumer = Provider<() => number, {}, readonly [], TokenGraph<readonly [], never, readonly [TestToken]>>;
type Cases = {
  any: any;
  never: never;
  empty: {};
  finite: {value: Good; user: Present};
  missing: {user: Missing};
  unknownOutput: {value: Registration};
  erasedProvider: {value: ProviderBase};
  anyValue: {value: any};
  neverValue: {value: never};
  optionalGood: {value?: Good};
  optionalMissing: {value?: Missing};
  readonlyGood: {readonly value: Good; readonly user: Present};
  readonlyMissing: {readonly user: Missing};
  unionSameKey: {value: Good} | {value: Missing};
  unionDifferentKeys: {value: Good} | {user: Missing};
  unionEmpty: {} | {user: Missing};
  unionAny: {value: Good} | any;
  intersection: {value: Good} & {user: Present};
  callable: (() => void) & {value: Good};
  constructable: (new () => object) & {value: Good};
  stringIndexGood: Record<string, Good>;
  stringIndexMissing: Record<string, Missing>;
  symbolIndexGood: Record<symbol, Good>;
  symbolIndexMissing: Record<symbol, Missing>;
  numberIndexGood: Record<number, Good>;
  numberIndexMissing: Record<number, Missing>;
  templateIndexGood: Record<`value:${string}`, Good>;
  templateIndexMissing: Record<`value:${string}`, Missing>;
  stringIndexAny: Record<string, any>;
  symbolIndexAny: Record<symbol, any>;
  numberIndexAny: Record<number, any>;
  registrationIndex: Registrations;
  readonlyIndex: Readonly<Registrations>;
  tokenPresent: {[tokenKey]: Binding<TestToken, Good>; consumer: TokenConsumer};
  tokenAbsent: {consumer: TokenConsumer};
  tokenWrong: {[tokenKey]: Good; consumer: TokenConsumer};
  tokenOptionalAbsent: {consumer: OptionalTokenConsumer};
  tokenOptionalWrong: {[tokenKey]: Good; consumer: OptionalTokenConsumer};
  tokenAndNamedMissing: {consumer: TokenConsumer; named: Missing};
  symbolAny: {[tokenKey]: any};
  symbolNever: {[tokenKey]: never};
  fromAny: From<any>;
  fromNever: From<never>;
  fromEntry: From<Entry>;
  fromUnion: From<{key: 'value'; registration: Good} | {key: 'user'; registration: Present}>;
  fromString: From<{key: string; registration: Good}>;
  fromSymbol: From<{key: symbol; registration: Good}>;
  fromMixed: From<{key: string | typeof tokenKey; registration: Missing}>;
};
type ConcreteEqual = { [K in keyof Cases]: Equal<Complete<Cases[K]>, Legacy<Cases[K]>> };
type ConcreteAssertion = Assert<ConcreteEqual[keyof Cases]>;
type DeferredAssertion = Assert<Equal<<R extends Registrations>() => Complete<R>, <R extends Registrations>() => Legacy<R>>>;
export declare const concreteEqual: ConcreteEqual;
export declare const concreteCandidate: { [K in keyof Cases]: Complete<Cases[K]> };
export declare const concreteLegacy: { [K in keyof Cases]: Legacy<Cases[K]> };

// Body checks force the compiler to relate deferred conditionals rather than
// merely comparing their later concrete substitutions.
export function genericToLegacy<R extends Registrations>(value: Complete<R>): Legacy<R> { return value; }
export function genericToCandidate<R extends Registrations>(value: Legacy<R>): Complete<R> { return value; }
export function genericKeyToLegacy<K extends string>(value: Complete<Record<K, Good>>): Legacy<Record<K, Good>> { return value; }
export function genericKeyToCandidate<K extends string>(value: Legacy<Record<K, Good>>): Complete<Record<K, Good>> { return value; }
export function genericValueToLegacy<V extends Registration>(value: Complete<{value: V}>): Legacy<{value: V}> { return value; }
export function genericValueToCandidate<V extends Registration>(value: Legacy<{value: V}>): Complete<{value: V}> { return value; }
export function genericEntriesToLegacy<E extends Entry>(value: Complete<From<E>>): Legacy<From<E>> { return value; }
export function genericEntriesToCandidate<E extends Entry>(value: Legacy<From<E>>): Complete<From<E>> { return value; }
export function genericNoInferToLegacy<R extends Registrations>(value: Complete<NoInfer<R>>): Legacy<NoInfer<R>> { return value; }
export function genericNoInferToCandidate<R extends Registrations>(value: Legacy<NoInfer<R>>): Complete<NoInfer<R>> { return value; }
export function genericReadonlyToLegacy<R extends Registrations>(value: Complete<Readonly<R>>): Legacy<Readonly<R>> { return value; }
export function genericReadonlyToCandidate<R extends Registrations>(value: Legacy<Readonly<R>>): Complete<Readonly<R>> { return value; }

// Existing exported Complete is also used as the admission proof for Builder.
export function wrapperEnd<E extends Entry>(builder: Builder<E> & Legacy<From<E>> & CheckedLifetimes<From<E>, never>) { return builder.end(); }
export function wrapperStart<E extends Entry>(builder: Builder<E> & Legacy<From<E>> & CheckedLifetimes<From<E>, never>) { return builder.start([] as const); }
export function completeWrapperEnd<E extends Entry>(builder: Builder<E> & Complete<From<E>> & CheckedLifetimes<From<E>, never>) { return builder.end(); }
export function completeWrapperStart<E extends Entry>(builder: Builder<E> & Complete<From<E>> & CheckedLifetimes<From<E>, never>) { return builder.start([] as const); }
export function constrainedWrapperEnd<E extends Entry, C extends NeedConstraint>(builder: Builder<E, C> & Legacy<From<E>> & CompleteConstraints<C, From<E>> & CheckedLifetimes<From<E>, C>) { return builder.end(); }
export function constrainedWrapperStart<E extends Entry, C extends NeedConstraint>(builder: Builder<E, C> & Legacy<From<E>> & CompleteConstraints<C, From<E>> & CheckedLifetimes<From<E>, C>) { return builder.start([] as const); }
export function constrainedCompleteWrapperEnd<E extends Entry, C extends NeedConstraint>(builder: Builder<E, C> & Complete<From<E>> & CompleteConstraints<C, From<E>> & CheckedLifetimes<From<E>, C>) { return builder.end(); }
export function constrainedCompleteWrapperStart<E extends Entry, C extends NeedConstraint>(builder: Builder<E, C> & Complete<From<E>> & CompleteConstraints<C, From<E>> & CheckedLifetimes<From<E>, C>) { return builder.start([] as const); }
