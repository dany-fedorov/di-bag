import type { ProviderGraph } from './provider';
import type { Registrations } from './registration';
import type { SelectionKey } from './token-types';
import type { Selection, Unsatisfied } from './types';

type Transients<R extends Registrations, S extends readonly unknown[]> = {
  [K in SelectionKey<S[number]> & keyof R]: Extract<ProviderGraph<R[K]>, { readonly lifetime: { readonly kind: 'transient' } }> extends never ? never : K;
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
