import type { TokenBase, TokenKey, TokenService } from './tokens';
import type { Unsatisfied } from './types';
import type { Registration, Registrations } from './registration';
import type { BoundToken, Provider, ProviderFactory, ProviderGraph, ProviderMetadata, ProviderAcquisitionMetadata, ProviderAcquired, ProviderOutput, ProviderTokenNeeds } from './provider';

export type TokenGraph<T extends readonly TokenBase[] = readonly [], B extends TokenBase = never> = {
  readonly kind: 'tokens'; readonly required: T; readonly bound: B;
};
export type OpaqueGraph = { readonly kind: 'opaque' };
export type GraphContract = TokenGraph<readonly TokenBase[], TokenBase> | OpaqueGraph;

type IsUnion<T, Whole = T> = T extends Whole ? [Whole] extends [T] ? false : true : never;
type SingletonSymbol<K> = [K] extends [never] ? false : [K] extends [symbol]
  ? symbol extends K ? false : true extends IsUnion<K> ? false : true : false;
export type TokenKeyAdmission<K> = SingletonSymbol<K> extends true ? unknown
  : Unsatisfied<'token requires a singleton unique-symbol key', {}>;
export type ValidToken<T> = [T] extends [never] ? false : true extends IsUnion<T> ? false
  : T extends TokenBase ? SingletonSymbol<TokenKey<T>> : false;
type InvalidElements<T extends readonly unknown[]> = { [I in keyof T]-?: ValidToken<T[I]> extends true ? never : I }[number];
export type TokenTupleAdmission<T extends readonly unknown[]> = true extends IsUnion<T> ? InvalidTuple
  : number extends T['length'] ? InvalidTuple : T extends Required<T>
    ? [InvalidElements<T>] extends [never] ? unknown : InvalidTuple : InvalidTuple;
type InvalidTuple = Unsatisfied<'tokens require a finite tuple of individually known token handles', {}>;
export type TokenArguments<T extends readonly TokenBase[]> = { -readonly [I in keyof T]: TokenService<T[I]> };
export type ReboundGraph<G extends GraphContract, T extends TokenBase> = G extends TokenGraph<infer R, TokenBase>
  ? TokenGraph<R, T> : OpaqueGraph;

export type Binding<T extends TokenBase, R extends Registration> = Provider<ProviderFactory<R>, ProviderMetadata<R> & object, ProviderAcquisitionMetadata<R>, ReboundGraph<ProviderGraph<R>, T>, ProviderAcquired<R>>;
export type BindingOutput<T extends TokenBase, R extends Registration> = [ProviderOutput<R>] extends [TokenService<T>] ? unknown
  : Unsatisfied<'token binding output is not assignable to its service', {}>;
export type SelectionKey<T> = T extends string ? T : TokenKey<T>;
type SameToken<A, B> = [A] extends [B] ? [B] extends [A] ? true : false : false;
export type WrongToken<T, R extends Registrations> = T extends unknown
  ? ValidToken<T> extends true ? TokenKey<T> extends keyof R
    ? SameToken<T, BoundToken<R[TokenKey<T>]>> extends true ? never : TokenKey<T>
    : never : 'opaque token contract' : never;
export type MissingToken<T, R extends Registrations> = T extends unknown
  ? ValidToken<T> extends true ? Exclude<TokenKey<T>, keyof R> : 'opaque token contract' : never;
export type TokenMember<R extends Registrations, T> = ValidToken<T> extends true
  ? [WrongToken<T, R> | MissingToken<T, R>] extends [never] ? unknown
    : Unsatisfied<'token must match an existing binding contract', {}>
  : Unsatisfied<'token must be an individually known genuine handle', {}>;
export type InvalidGraphs<R extends Registrations> = {
  [K in keyof R]: [ProviderGraph<R[K]>] extends [TokenGraph<readonly TokenBase[], TokenBase>]
    ? WrongToken<ProviderTokenNeeds<R[K]>, R> | InvalidBound<BoundToken<R[K]>> : K;
}[keyof R];
type InvalidBound<B> = B extends unknown ? ValidToken<B> extends true ? never : 'opaque binding contract' : never;
export type MissingTokens<R extends Registrations> = {
  [K in keyof R]: MissingToken<ProviderTokenNeeds<R[K]>, R>;
}[keyof R];
export type ReboundSelection<R extends Registrations, O extends Registrations> = [Extract<keyof O, symbol>] extends [never] ? O : {
  [K in keyof O]: K extends keyof R ? K extends symbol
    ? Binding<BoundToken<R[K]>, O[K]> : O[K] : O[K];
};
