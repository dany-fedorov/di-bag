import type { TokenBase, TokenKey, TokenService } from './tokens';
import type { Unsatisfied } from './types';

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
type ValidToken<T> = [T] extends [never] ? false : true extends IsUnion<T> ? false
  : T extends TokenBase ? SingletonSymbol<TokenKey<T>> : false;
type InvalidElements<T extends readonly unknown[]> = { [I in keyof T]-?: ValidToken<T[I]> extends true ? never : I }[number];
export type TokenTupleAdmission<T extends readonly unknown[]> = true extends IsUnion<T> ? InvalidTuple
  : number extends T['length'] ? InvalidTuple : T extends Required<T>
    ? [InvalidElements<T>] extends [never] ? unknown : InvalidTuple : InvalidTuple;
type InvalidTuple = Unsatisfied<'tokens require a finite tuple of individually known token handles', {}>;
export type TokenArguments<T extends readonly TokenBase[]> = { -readonly [I in keyof T]: TokenService<T[I]> };
export type ReboundGraph<G extends GraphContract, T extends TokenBase> = G extends TokenGraph<infer R, TokenBase>
  ? TokenGraph<R, T> : OpaqueGraph;
