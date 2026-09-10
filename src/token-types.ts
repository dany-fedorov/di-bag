import type { TokenBase, TokenKey, TokenService } from './tokens';
import type { DependencyReference, DependencyValue, DependencyToken, DependencyKind, ValidDependency } from './dependency-references';
import type { Unsatisfied } from './types';
import type { Registration, Registrations } from './registration';
import type { BoundToken, Provider, ProviderFactory, ProviderGraphContract, ProviderRegistrationMetadata, ProviderAcquisitionMetadata, ProviderAcquiredValue, ProviderOutput, ProviderRequiredTokens, ProviderOptionalTokens } from './provider';

/** A provider's retained required, bound, and optional typed-token contracts. */
export type TokenDependencyContract<T extends readonly TokenBase[] = readonly [], B extends TokenBase = never, O extends readonly TokenBase[] = readonly []> = {
  readonly kind: 'tokens'; readonly required: T; readonly bound: B; readonly optional: O;
};
export type OpaqueGraph = { readonly kind: 'opaque' };
export type GraphContract = TokenDependencyContract<readonly TokenBase[], TokenBase, readonly TokenBase[]> | OpaqueGraph;

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
type InvalidDependencies<T extends readonly unknown[]> = { [I in keyof T]-?: true extends IsUnion<T[I]> ? I : ValidDependency<T[I]> extends true ? never : I }[number];
export type DependencyTupleAdmission<T extends readonly unknown[]> = true extends IsUnion<T> ? InvalidTuple
  : number extends T['length'] ? InvalidTuple : T extends Required<T>
    ? [InvalidDependencies<T>] extends [never] ? unknown : InvalidTuple : InvalidTuple;
export type TokenArguments<T extends readonly DependencyReference[]> = { -readonly [I in keyof T]: DependencyValue<T[I]> };
type ReferenceTokens<T extends readonly DependencyReference[], Kind extends 'required' | 'optional' | 'all', SelectedRegistrations extends readonly TokenBase[] = readonly []> = T extends readonly [infer H extends DependencyReference, ...infer Rest extends readonly DependencyReference[]]
  ? (DependencyKind<H> extends 'lazy' ? 'required' : DependencyKind<H>) extends Kind
    ? ReferenceTokens<Rest, Kind, readonly [...SelectedRegistrations, DependencyToken<H>]> : ReferenceTokens<Rest, Kind, SelectedRegistrations>
  : SelectedRegistrations;
export type ReferenceGraph<T extends readonly DependencyReference[]> = T extends readonly TokenBase[] ? TokenDependencyContract<T>
  : TokenDependencyContract<ReferenceTokens<T, 'required'>, never, ReferenceTokens<T, 'optional'>> &
    (ReferenceTokens<T, 'all'> extends readonly [] ? unknown : { readonly all: ReferenceTokens<T, 'all'> });
export type ReboundGraph<G extends GraphContract, T extends TokenBase> = G extends infer U & {}
  ? U extends TokenDependencyContract<readonly TokenBase[], TokenBase, readonly TokenBase[]> ? { [K in keyof U]: K extends 'bound' ? T : U[K] } : U extends GraphContract ? U : never
  : never;

/** A registration rebound to an invariant typed-token service contract. */
export type TokenBinding<T extends TokenBase, R extends Registration> = Provider<ProviderFactory<R>, ProviderRegistrationMetadata<R> & object, ProviderAcquisitionMetadata<R>, ReboundGraph<ProviderGraphContract<R>, T>, ProviderAcquiredValue<R>>;
export type BindingOutput<T extends TokenBase, R extends Registration> = [ProviderOutput<R>] extends [TokenService<T>] ? unknown
  : Unsatisfied<'token binding output is not assignable to its service', { token: TokenKey<T>; expected: TokenService<T>; provided: ProviderOutput<R> }>;
/** Convert a string selection to itself or a typed token to its symbol key. */
export type SelectionKey<T> = T extends string ? T : TokenKey<T>;
type SameToken<A, B> = [A] extends [B] ? [B] extends [A] ? true : false : false;
export type WrongToken<T, R extends Registrations> = T extends unknown
  ? ValidToken<T> extends true ? TokenKey<T> extends keyof R
    ? SameToken<T, BoundToken<R[TokenKey<T>]>> extends true ? never : TokenKey<T>
    : never : 'opaque token contract' : never;
export type MissingToken<T, R extends Registrations> = T extends unknown
  ? ValidToken<T> extends true ? Exclude<TokenKey<T>, keyof R> : 'opaque token contract' : never;
/** Admit a genuine token only when it exactly matches an existing binding contract. */
export type TokenMember<R extends Registrations, T> = ValidToken<T> extends true
  ? [WrongToken<T, R> | MissingToken<T, R>] extends [never] ? unknown
    : Unsatisfied<'token must match an existing binding contract', {}>
  : Unsatisfied<'token must be an individually known genuine handle', {}>;
export type InvalidGraphs<R extends Registrations> = {
  [K in keyof R]: [ProviderGraphContract<R[K]>] extends [TokenDependencyContract<readonly TokenBase[], TokenBase, readonly TokenBase[]>]
    ? WrongToken<ProviderRequiredTokens<R[K]> | ProviderOptionalTokens<R[K]>, R> | InvalidBound<BoundToken<R[K]>> : K;
}[keyof R];
type InvalidBound<B> = B extends unknown ? ValidToken<B> extends true ? never : 'opaque binding contract' : never;
export type MissingTokens<R extends Registrations> = {
  [K in keyof R]: MissingToken<ProviderRequiredTokens<R[K]>, R>;
}[keyof R];
// Keep the symbol-keyed mapped result nameable in inferred declarations.
/** Rebind symbol-keyed override registrations to the original typed-token contracts. */
export type ReboundProviders<R extends Registrations, O extends Registrations> = {
  [K in keyof O]: K extends keyof R ? K extends symbol
    ? TokenBinding<BoundToken<R[K]>, O[K]> : O[K] : O[K];
};
/** Preserve named overrides and rebind any symbol-keyed override providers. */
export type ReboundSelection<R extends Registrations, O extends Registrations> = [Extract<keyof O, symbol>] extends [never] ? O : ReboundProviders<R, O>;
