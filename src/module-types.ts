import type { Module } from './module';
import type { Registrations } from './registration';
import type { Needs, Provided, Singleton, Unsatisfied } from './types';
import type { MetadataKeyUnion, Provider, ProviderOutput, ProviderNeeds, ProviderMetadata, ProviderAcquisitionMetadata, ProviderGraph, ProviderTokenNeeds, BoundToken } from './provider';
import type { TokenGraph, WrongToken, MissingToken } from './token-types';
import type { TokenBase, TokenKey, TokenService } from './tokens';

export type NeedConstraint =
  | { readonly kind: 'export' | 'external'; readonly consumer: string | symbol; readonly needs: object }
  | { readonly kind: 'token-export' | 'token-external'; readonly consumer: string | symbol; readonly token: TokenBase }
  | { readonly kind: 'opaque' };

type WrongConstraint<C extends NeedConstraint, Available extends object> =
  C extends { readonly needs: object; readonly consumer: string | symbol }
    // Public registration maps have required slots. Compare each overlapping
    // value directly to avoid rebuilding a large Pick<Available> per consumer.
    ? {
        [K in keyof C['needs'] & keyof Available]:
          Available[K] extends C['needs'][K] ? never : C['consumer'];
      }[keyof C['needs'] & keyof Available]
    : never;
type MissingConstraint<C extends NeedConstraint, Available extends object> =
  C extends { readonly needs: object } ? Exclude<keyof C['needs'], keyof Available> : never;

type WrongTokenConstraint<C, A extends Registrations> = C extends { token: infer T } ? WrongToken<T, A>
  : C extends { kind: 'opaque' } ? 'opaque' : never;
type MissingTokenConstraint<C, A extends Registrations> = C extends { token: infer T } ? MissingToken<T, A>
  : C extends { kind: 'opaque' } ? 'opaque' : never;

export type CheckedConstraints<C extends NeedConstraint, A extends Registrations> =
  [WrongConstraint<C, Provided<A>> | WrongTokenConstraint<C, A>] extends [never] ? unknown
    : Unsatisfied<'a dependency has the wrong shape', { tokens: WrongConstraint<C, Provided<A>> | WrongTokenConstraint<C, A> }>;
export type CompleteConstraints<C extends NeedConstraint, A extends Registrations> =
  [MissingConstraint<C, Provided<A>> | MissingTokenConstraint<C, A>] extends [never] ? unknown
    : Unsatisfied<'missing factories', { missing: MissingConstraint<C, Provided<A>> | MissingTokenConstraint<C, A> }>;

// Separate exported and external references even when a later rename makes
// their lookup keys equal. Keep consumers distributive, never intersect needs
// before validating them: incompatible requirements must not become `never`.
type Constraint<K extends string | symbol, N, Keys extends keyof N, Kind extends string> =
  [Keys] extends [never] ? never : { readonly consumer: K; readonly needs: Pick<N, Keys>; readonly kind: Kind };
export type ModuleConstraints<R extends Registrations, Public extends keyof R> = {
  [K in keyof R & (string | symbol)]:
    | Constraint<K, Needs<R[K]>, Extract<keyof Needs<R[K]>, Public>, 'export'>
    | Constraint<K, Needs<R[K]>, Exclude<keyof Needs<R[K]>, keyof R>, 'external'>
    | TokenConstraint<K, ProviderTokenNeeds<R[K]>, R, Public>
    | ([ProviderGraph<R[K]>] extends [TokenGraph<readonly TokenBase[], TokenBase>] ? never : { readonly kind: 'opaque' });
}[keyof R & (string | symbol)];
type TokenConstraint<K extends string | symbol, T, R, Public> = T extends TokenBase
  ? TokenKey<T> extends Public ? { readonly consumer: K; readonly token: T; readonly kind: 'token-export' }
    : TokenKey<T> extends keyof R ? never : { readonly consumer: K; readonly token: T; readonly kind: 'token-external' }
  : never;

type Intersect<U> = (U extends unknown ? (value: U) => void : never) extends
  (value: infer I) => void ? I : never;
type External<C> = C extends { kind: 'external'; needs: infer N } ? N
  : C extends { kind: 'token-external'; token: infer T } ? Record<TokenKey<T>, TokenService<T>> : never;
export type ExternalRequirements<C> = [External<C>] extends [never] ? Readonly<{}>
  : Readonly<Intersect<External<C>>>;

export type PublicRegistrations<P extends object> = { [K in keyof P]: () => P[K] };
// Retain opaque registrations as opaque, and consider keys of every metadata
// union member before deciding whether the legacy synthetic default is enough.
export type PublicProvider<R> = R extends Registrations[string]
  ? unknown extends ProviderNeeds<R> ? R
    : [ProviderGraph<R>] extends [TokenGraph<readonly TokenBase[], TokenBase>] ? [MetadataKeyUnion<ProviderMetadata<R>> | BoundToken<R>] extends [never]
      ? ProviderAcquisitionMetadata<R> extends readonly [] ? () => ProviderOutput<R>
        : Provider<() => ProviderOutput<R>, ProviderMetadata<R> & object, ProviderAcquisitionMetadata<R>, TokenGraph<readonly [], BoundToken<R>>>
      : Provider<() => ProviderOutput<R>, ProviderMetadata<R> & object, ProviderAcquisitionMetadata<R>, TokenGraph<readonly [], BoundToken<R>>>
    : R
  : never;
export type PublicProviders<R extends object> = { [K in keyof R]: PublicProvider<R[K]> };
export type Renamed<P extends object, Old extends string, New extends string> = {
  [K in keyof P as K extends Old ? New : K]: P[K];
};
export type RenamedConstraints<C extends NeedConstraint, Old extends string, New extends string> =
  C extends { readonly kind: 'export'; readonly consumer: string | symbol; readonly needs: object }
    ? { readonly consumer: C['consumer']; readonly needs: Renamed<C['needs'], Old, New>; readonly kind: 'export' }
    : C;
export type RenameKeys<P, Old extends string, New extends string> =
  Singleton<Old> extends true ? Singleton<New> extends true
    ? Old extends keyof P ? New extends Exclude<keyof P, Old> ? InvalidRename : unknown
      : InvalidRename : InvalidRename : InvalidRename;
type InvalidRename = Unsatisfied<'rename requires an existing export and a noncolliding singleton string-literal name', {}>;

export type ModuleProvides<M> = M extends Module<infer P, infer _R, infer _C, infer _D> ? Readonly<P> : never;
export type ModuleRequires<M> = M extends Module<infer _P, infer R, infer _C, infer _D> ? Readonly<R> : never;
