import type { ContributionConstraint, CheckedContributions, CompleteContributions, RenamedContribution, ModuleContributionConstraints } from './contribution-types';
import type { Module } from './module';
import type { Registrations } from './registration';
import type { Entry, Needs, RegistrationsFromEntries, ServicesOf, Singleton, Unsatisfied } from './types';
import type { MetadataKeyUnion, Provider, ProviderOutput, ProviderNamedDependencies, ProviderRegistrationMetadata, ProviderAcquisitionMetadata, ProviderAcquiredValue, ProviderGraphContract, ProviderRequiredTokens, ProviderOptionalTokens, ProviderCollectionTokens, BoundToken } from './provider';
import type { TokenDependencyContract, WrongToken, MissingToken } from './token-types';
import type { TokenBase, TokenKey, TokenService } from './tokens';
import type { LifetimeObligation, PrivateLifetimes, LexicalProvider, RenamedLifetimeObligation, EnclosedLifetimeObligation } from './lifetime-types';

export type NeedConstraint =
  | LifetimeObligation
  | ContributionConstraint
  | { readonly kind: 'all'; readonly token: TokenBase }
  | { readonly kind: 'export' | 'external'; readonly consumer: string | symbol; readonly needs: object }
  | { readonly kind: 'token-export' | 'token-external' | 'optional-token-export' | 'optional-token-external'; readonly consumer: string | symbol; readonly token: TokenBase }
  | { readonly kind: 'opaque' };

type WrongConstraint<C extends NeedConstraint, A extends Registrations> =
  C extends { readonly needs: object; readonly consumer: string | symbol }
    // Public registration maps have required slots. Compare each overlapping
    // value directly to avoid rebuilding a large Pick<Available> per consumer.
    ? {
        [K in keyof C['needs'] & keyof ServicesOf<A>]:
          ServicesOf<A>[K] extends C['needs'][K] ? never : C['consumer'];
      }[keyof C['needs'] & keyof ServicesOf<A>]
    : never;
type MissingConstraint<C extends NeedConstraint, Available extends object> =
  C extends { readonly needs: object } ? Exclude<keyof C['needs'], keyof Available> : never;

type WrongTokenConstraint<C, A extends Registrations> = C extends { kind: 'contribution' | 'all' } ? never : C extends { token: infer T } ? WrongToken<T, A>
  : C extends { kind: 'opaque' } ? 'opaque' : never;
type MissingTokenConstraint<C, A extends Registrations> = C extends { kind: 'contribution' | 'all' | 'optional-token-export' | 'optional-token-external' } ? never : C extends { token: infer T } ? MissingToken<T, A>
  : C extends { kind: 'opaque' } ? 'opaque' : never;

type ConstraintRelationships<C, A extends object> = C extends { readonly consumer: infer Consumer; readonly needs: infer N }
  ? { [K in keyof N & keyof A]: A[K] extends N[K] ? never : { consumer: Consumer; dependency: K; expected: N[K]; provided: A[K] } }[keyof N & keyof A]
  : never;
type MissingConstraintRelationships<C, A extends object> = C extends { readonly consumer: infer Consumer; readonly needs: infer N }
  ? { [K in Exclude<keyof N, keyof A>]: { consumer: Consumer; dependency: K; expected: N[K]; provided: undefined } }[Exclude<keyof N, keyof A>]
  : never;

export type CheckedConstraints<C extends NeedConstraint, A extends Registrations> =
  [WrongConstraint<C, A> | WrongTokenConstraint<C, A>] extends [never] ? CheckedContributions<C, A>
    : Unsatisfied<'provided service does not satisfy its consumer dependency', { tokens: WrongConstraint<C, A> | WrongTokenConstraint<C, A>; relationships: ConstraintRelationships<C, ServicesOf<A>> }>;
export type IncrementalConstraints<
  C extends NeedConstraint,
  MC extends NeedConstraint,
  Old extends Registrations,
  Incoming extends Registrations,
> = [Extract<C | MC, { kind: 'contribution' | 'all' | 'opaque' | 'lifetime' }>] extends [never]
  ? unknown extends CheckedConstraints<C, Incoming>
    ? CheckedConstraints<MC, import('./types').OverrideRegistrations<Old, Incoming>>
    : CheckedConstraints<C, Incoming>
  : CheckedConstraints<C | MC, import('./types').OverrideRegistrations<Old, Incoming>>;
export type CompleteConstraints<C extends NeedConstraint, A extends Registrations> =
  [MissingConstraint<C, ServicesOf<A>> | MissingTokenConstraint<C, A>] extends [never] ? CompleteContributions<C, A>
    : Unsatisfied<'required service registrations are missing', { missing: MissingConstraint<C, ServicesOf<A>> | MissingTokenConstraint<C, A>; relationships: MissingConstraintRelationships<C, ServicesOf<A>> }>;

// Separate exported and external references even when a later rename makes
// their lookup keys equal. Keep consumers distributive, never intersect needs
// before validating them: incompatible requirements must not become `never`.
type Constraint<K extends string | symbol, N, Keys extends keyof N, Kind extends string> =
  [Keys] extends [never] ? never : { readonly consumer: K; readonly needs: Pick<N, Keys>; readonly kind: Kind };
export type RegistrationConstraints<V extends Registrations[string], R extends Registrations, Public extends keyof R, K extends string | symbol = string | symbol> =
    | Constraint<K, Needs<V>, Extract<keyof Needs<V>, Public>, 'export'>
    | Constraint<K, Needs<V>, Exclude<keyof Needs<V>, keyof R>, 'external'>
    | (ProviderCollectionTokens<V> extends infer T ? T extends TokenBase ? { readonly kind: 'all'; readonly token: T } : never : never)
    | TokenConstraint<K, ProviderRequiredTokens<V>, R, Public>
    | TokenConstraint<K, ProviderOptionalTokens<V>, R, Public, true>
    | ([ProviderGraphContract<V>] extends [TokenDependencyContract<readonly TokenBase[], TokenBase, readonly TokenBase[]>] ? never : { readonly kind: 'opaque' });
/** Retained requirements of a module's public and private registrations. */
export type ModuleConstraints<R extends Registrations, Public extends keyof R> = {
  [K in keyof R & (string | symbol)]: RegistrationConstraints<R[K], R, Public, K>;
}[keyof R & (string | symbol)] | PrivateLifetimes<R, Public>;
type TokenConstraint<K extends string | symbol, T, R, Public, Optional extends boolean = false> = T extends TokenBase
  ? TokenKey<T> extends Public ? { readonly consumer: K; readonly token: T; readonly kind: Optional extends true ? 'optional-token-export' : 'token-export' }
    : TokenKey<T> extends keyof R ? never : { readonly consumer: K; readonly token: T; readonly kind: Optional extends true ? 'optional-token-external' : 'token-external' }
  : never;

type Intersect<U> = (U extends unknown ? (value: U) => void : never) extends
  (value: infer I) => void ? I : never;
type External<C> = C extends { kind: 'external'; needs: infer N } ? N
  : C extends { kind: 'token-external'; token: infer T } ? Record<TokenKey<T>, TokenService<T>>
    : C extends { kind: 'optional-token-external'; token: infer T } ? Partial<Record<TokenKey<T>, TokenService<T>>> : never;
export type ExternalRequirements<C> = [External<C>] extends [never] ? Readonly<{}>
  : Readonly<Intersect<External<C>>>;

// Capture the output independently of the registration retained by its public projection.
type OutputFactory<O> = () => O;

export type PublicRegistrations<P extends object> = { [K in keyof P]: () => P[K] };
// Retain opaque registrations as opaque, and consider keys of every metadata
// union member before deciding whether the legacy synthetic default is enough.
export type PublicProvider<R> = R extends Registrations[string]
  ? unknown extends ProviderNamedDependencies<R> ? R
    : [ProviderGraphContract<R>] extends [TokenDependencyContract<readonly TokenBase[], TokenBase, readonly TokenBase[]>] ? [Extract<ProviderGraphContract<R>, { readonly lifetime: unknown } | { readonly alias: PropertyKey }>] extends [never] ? [MetadataKeyUnion<ProviderRegistrationMetadata<R>> | BoundToken<R>] extends [never]
      ? ProviderAcquisitionMetadata<R> extends readonly []
        ? [ProviderAcquiredValue<R>] extends [Awaited<ProviderOutput<R>>]
          ? [Awaited<ProviderOutput<R>>] extends [ProviderAcquiredValue<R>] ? OutputFactory<ProviderOutput<R>> : RetainedPublicProvider<R>
          : RetainedPublicProvider<R>
        : RetainedPublicProvider<R>
      : RetainedPublicProvider<R>
    : RetainedPublicProvider<R>
    : R
  : never;
type PublicGraph<G> = G extends TokenDependencyContract<readonly TokenBase[], TokenBase, readonly TokenBase[]> ? { [K in keyof G]: K extends 'required' | 'optional' | 'all' ? readonly [] : G[K] } : never;
type RetainedPublicProvider<R extends Registrations[string]> = Provider<OutputFactory<ProviderOutput<R>>, ProviderRegistrationMetadata<R> & object, ProviderAcquisitionMetadata<R>, PublicGraph<ProviderGraphContract<R>>, ProviderAcquiredValue<R>>;
/** Project registrations to dependency-free public descriptions while retaining behavioral contracts. */
export type PublicProviders<R extends object> = { [K in keyof R]: PublicProvider<R[K]> };
/** Project selected module exports while retaining their lexical private graph where required. */
export type ModulePublicProviders<R extends Registrations, P extends keyof R> = { [K in P]: LexicalProvider<PublicProvider<R[K]>, R, P, K> };
/** Rename one string key in an object contract. */
export type Renamed<P extends object, Old extends string, New extends string> = {
  [K in keyof P as K extends Old ? New : K]: P[K];
};
export type RenamedConstraints<C extends NeedConstraint, Old extends string, New extends string> =
  C extends ContributionConstraint ? RenamedContribution<C, Old, New> : C extends LifetimeObligation ? RenamedLifetimeObligation<C, Old, New> : C extends { readonly kind: 'export'; readonly consumer: string | symbol; readonly needs: object }
    ? { readonly consumer: C['consumer']; readonly needs: Renamed<C['needs'], Old, New>; readonly kind: 'export' }
    : C;
export type RenameKeys<P, Old extends string, New extends string> =
  Singleton<Old> extends true ? Singleton<New> extends true
    ? Old extends keyof P ? New extends Exclude<keyof P, Old> ? InvalidRename : unknown
      : InvalidRename : InvalidRename : InvalidRename;
type InvalidRename = Unsatisfied<'renameExport requires an existing export and a noncolliding singleton string-literal name', {}>;

/**
 * Re-scope every constraint a builder retained from installed modules and
 * contributions when that builder seals into a module with exports `P`.
 * Needs on an export stay checkable by the host; needs satisfied privately are
 * final and drop; unsatisfied needs remain external requirements of the module.
 */
export type SealedConstraints<C extends NeedConstraint, R extends Registrations, P extends keyof R> = C extends ContributionConstraint
  ? ModuleContributionConstraints<C, R, P>
  : C extends LifetimeObligation ? EnclosedLifetimeObligation<C, R, P>
  : C extends { readonly kind: 'export' | 'external'; readonly consumer: infer K extends string | symbol; readonly needs: infer N extends object }
    ? Constraint<K, N, Extract<keyof N, P>, 'export'> | Constraint<K, N, Exclude<keyof N, keyof R>, 'external'>
  : C extends { readonly kind: 'token-export' | 'token-external'; readonly consumer: infer K extends string | symbol; readonly token: infer T }
    ? TokenConstraint<K, T, R, P>
  : C extends { readonly kind: 'optional-token-export' | 'optional-token-external'; readonly consumer: infer K extends string | symbol; readonly token: infer T }
    ? TokenConstraint<K, T, R, P, true>
  : C;
/** Every constraint a sealed module carries: its own registrations' needs plus re-scoped retained constraints. */
export type ModuleSealedConstraints<E extends Entry, C extends NeedConstraint, P extends keyof RegistrationsFromEntries<E>> =
  ModuleConstraints<RegistrationsFromEntries<E>, P> | SealedConstraints<C, RegistrationsFromEntries<E>, P>;

/** Extract a readonly map of services publicly exposed by a module. */
export type ModuleExportedServices<M> = M extends Module<infer P, infer _R, infer _C, infer _D> ? Readonly<P> : never;
/** Extract a readonly map of services a module requires from its host. */
export type ModuleRequiredServices<M> = M extends Module<infer _P, infer R, infer _C, infer _D> ? Readonly<R> : never;
