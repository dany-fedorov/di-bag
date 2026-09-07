import type { CanonicalLifetime } from './lifetime-types';
import type { Provider, ProviderGraph, ProviderFactory, ProviderMetadata, ProviderAcquisitionMetadata, ProviderAcquired } from './provider';
import type { Registration, Registrations } from './registration';
import type { SelectionKey } from './token-types';
import type { Selection, Unsatisfied } from './types';

type Transients<R extends Registrations, S extends readonly unknown[]> = {
  [K in SelectionKey<S[number]> & keyof R]: 'transient' extends CanonicalLifetime<R, K> ? K : never;
}[SelectionKey<S[number]> & keyof R];

export type ScopeOptions<R extends Registrations, S extends readonly unknown[]> = {
  readonly share: S & Selection<R, S, 'scope share'> & (
    [Transients<R, S>] extends [never] ? unknown
      : Unsatisfied<'scope cannot share transient providers', { tokens: Transients<R, S> }>
  );
};

export type DisjointScopeSelection<K extends readonly unknown[], S extends readonly unknown[]> =
  [SelectionKey<K[number]> & SelectionKey<S[number]>] extends [never] ? unknown
    : Unsatisfied<'scope cannot share and override the same token', { tokens: SelectionKey<K[number]> & SelectionKey<S[number]> }>;

// Selected sharing belongs to one runtime. Retain alias-only parent routing for
// its checks, then clear it when constructing an independent fork or fresh scope.
type SharedKeys<R extends Registrations> = {
  [K in keyof R]: ProviderGraph<R[K]> extends { readonly sharedAlias: unknown } ? K : never;
}[keyof R];
type Unshared<V extends Registration> = ProviderGraph<V> extends {
  readonly sharedAlias: { readonly original: infer O extends Registration };
} ? O : V;
export type UnsharedAliases<R extends Registrations> = [SharedKeys<R>] extends [never] ? R
  : Omit<R, SharedKeys<R>> & { [K in SharedKeys<R>]: Unshared<R[K]> };
type AliasKeys<R extends Registrations, S extends readonly unknown[]> = {
  [K in SelectionKey<S[number]> & keyof R]: ProviderGraph<R[K]> extends { readonly alias: PropertyKey } ? K : never;
}[SelectionKey<S[number]> & keyof R];
type SharedAlias<R extends Registrations, Parent extends Registrations, K extends keyof R> = Provider<
  ProviderFactory<R[K]>, ProviderMetadata<R[K]> & object, ProviderAcquisitionMetadata<R[K]>,
  ProviderGraph<R[K]> & { readonly sharedAlias: { readonly registrations: Parent; readonly source: K; readonly original: R[K] } },
  ProviderAcquired<R[K]>
>;
type RetainShared<R extends Registrations, Parent extends Registrations, S extends readonly unknown[]> =
  [AliasKeys<R, S>] extends [never] ? R
    : Omit<R, AliasKeys<R, S>> & { [K in AliasKeys<R, S>]: SharedAlias<R, Parent, K> };
export type ScopedAliases<R extends Registrations, Parent extends Registrations, S extends readonly unknown[]> = RetainShared<UnsharedAliases<R>, Parent, S>;
