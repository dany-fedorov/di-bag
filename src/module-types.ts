import type { ContributionConstraint, CheckedContributions, CompleteContributions, ModuleContributionConstraints } from './contribution-types';
import type { Module } from './module';
import type { Registration, Registrations } from './registration';
import type { Entry, Intersect, NameText, Needs, Resolved, RegistrationsFromEntries, ServicesOf, Singleton, Unsatisfied } from './types';
import type { MetadataKeyUnion, Provider, ProviderFactory, ProviderOutput, ProviderNamedDependencies, ProviderRegistrationMetadata, ProviderAcquisitionMetadata, ProviderAcquiredValue, ProviderGraphContract, ProviderRequiredTokens, ProviderOptionalTokens, ProviderCollectionTokens, BoundToken } from './provider';
import type { GraphContract, TokenDependencyContract, WrongToken, MissingToken } from './token-types';
import type { TokenBase, TokenKey, TokenService } from './tokens';
import type { LifetimeObligation, RenamedObligation, SealedLifetimes } from './lifetime-types';

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
> = [Extract<C | MC, { kind: 'contribution' | 'all' | 'opaque' | 'root-reach' | 'export-reach' | 'contribution-reach' }>] extends [never]
  ? unknown extends CheckedConstraints<C, Incoming>
    ? CheckedConstraints<MC, import('./types').OverrideRegistrations<Old, Incoming>>
    : CheckedConstraints<C, Incoming>
  : CheckedConstraints<C | MC, import('./types').OverrideRegistrations<Old, Incoming>>;
export type CompleteConstraints<C extends NeedConstraint, A extends Registrations> =
  [MissingConstraint<C, ServicesOf<A>> | MissingTokenConstraint<C, A>] extends [never] ? CompleteContributions<C, A>
    : Unsatisfied<`required service registrations are missing: ${NameText<MissingConstraint<C, ServicesOf<A>> | MissingTokenConstraint<C, A>>}`, { missing: MissingConstraint<C, ServicesOf<A>> | MissingTokenConstraint<C, A>; relationships: MissingConstraintRelationships<C, ServicesOf<A>> }>;

// Separate exported and external references even when a later rename makes
// their lookup keys equal. Keep consumers distributive, never intersect needs
// before validating them: incompatible requirements must not become `never`.
type Constraint<K extends string | symbol, N, Keys extends keyof N, Kind extends string> =
  [Keys] extends [never] ? never : { readonly consumer: K; readonly needs: Resolved<Pick<N, Keys>>; readonly kind: Kind };
// Union and indexed-access aliases keep their names through instantiation, and a union built from
// named unions prints through them. These answer through a resolved conditional branch instead, so
// a sealed module's declaration prints constraint objects, not the registrations they came from.
export type RegistrationConstraints<V extends Registrations[string], R extends Registrations, Public extends keyof R, K extends string | symbol = string | symbol> = [V] extends [unknown]
  ? | Constraint<K, Needs<V>, Extract<keyof Needs<V>, Public>, 'export'>
    | Constraint<K, Needs<V>, Exclude<keyof Needs<V>, keyof R>, 'external'>
    | (ProviderCollectionTokens<V> extends infer T ? T extends TokenBase ? { readonly kind: 'all'; readonly token: T } : never : never)
    | TokenConstraint<K, ProviderRequiredTokens<V>, R, Public>
    | TokenConstraint<K, ProviderOptionalTokens<V>, R, Public, true>
    | ([ProviderGraphContract<V>] extends [TokenDependencyContract<readonly TokenBase[], TokenBase, readonly TokenBase[]>] ? never : { readonly kind: 'opaque' })
  : never;
/** Retained requirements of a module's public and private registrations. */
export type ModuleConstraints<R extends Registrations, Public extends keyof R> = [R] extends [unknown] ? {
  [K in keyof R & (string | symbol)]: RegistrationConstraints<R[K], R, Public, K>;
}[keyof R & (string | symbol)] : never;
type TokenConstraint<K extends string | symbol, T, R, Public, Optional extends boolean = false> = T extends TokenBase
  ? TokenKey<T> extends Public ? { readonly consumer: K; readonly token: T; readonly kind: Optional extends true ? 'optional-token-export' : 'token-export' }
    : TokenKey<T> extends keyof R ? never : { readonly consumer: K; readonly token: T; readonly kind: Optional extends true ? 'optional-token-external' : 'token-external' }
  : never;

type ExternalNames<C> = C extends { kind: 'external'; needs: infer N } ? N : never;
type ExternalTokens<C> = C extends { kind: 'token-external'; token: infer T } ? Record<TokenKey<T>, TokenService<T>>
  : C extends { kind: 'optional-token-external'; token: infer T } ? Partial<Record<TokenKey<T>, TokenService<T>>> : never;
// Named needs merge into one resolved object, so a need several consumers share prints once.
// Token needs stay `Record` references: declaration emit cannot serialize an expanded unique-symbol property.
export type ExternalRequirements<C> = [ExternalNames<C>] extends [never]
  ? [ExternalTokens<C>] extends [never] ? Readonly<{}> : Readonly<Intersect<ExternalTokens<C>>>
  : [ExternalTokens<C>] extends [never] ? Readonly<Resolved<Intersect<ExternalNames<C>>>>
  : Readonly<Resolved<Intersect<ExternalNames<C>>> & Intersect<ExternalTokens<C>>>;

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
type WithoutAlias<G> = { [K in keyof G as K extends 'alias' ? never : K]: G[K] };
// An exported alias to a private target takes that target's lifetime, so the target name does
// not leave the module; one to an export or an external name keeps following that name.
type AliasEnd<R extends Registrations, P, A, Visited> = A extends P ? { readonly alias: A }
  : A extends keyof R ? A extends Visited ? {} : ProviderGraphContract<R[A]> extends infer G
    ? G extends { readonly alias: infer B } ? AliasEnd<R, P, B, Visited | A>
    : G extends { readonly lifetime: infer L } ? { readonly lifetime: L } : {}
    : never
  : { readonly alias: A };
type SealedProvider<R extends Registrations, P, V> = PublicProvider<V> extends infer T ? T extends Registration
  ? ProviderGraphContract<T> extends { readonly alias: infer A }
    ? AliasEnd<R, P, A, never> extends infer F ? F extends object
      ? Provider<ProviderFactory<T>, ProviderRegistrationMetadata<T> & object, ProviderAcquisitionMetadata<T>, Extract<Resolved<WithoutAlias<ProviderGraphContract<T>> & F>, GraphContract>, ProviderAcquiredValue<T>>
      : never : never
    : T
  : never : never;
// Symbol-keyed exports stay `Record` references; declaration emit cannot expand a unique-symbol property.
type SymbolProviders<R extends Registrations, P extends keyof R, K = P> =
  Extract<Intersect<K extends symbol ? Record<K, SealedProvider<R, P, R[K & keyof R]>> : never>, Registrations>;
/**
 * Project selected module exports to dependency-free providers that keep behavioral contracts.
 * The conditional answer carries no alias, so declarations print the providers, not the registrations.
 */
export type ModulePublicProviders<R extends Registrations, P extends keyof R> = [Extract<P, symbol>] extends [never]
  ? { [K in P]: SealedProvider<R, P, R[K]> }
  : [Extract<P, string>] extends [never] ? SymbolProviders<R, P>
  : { [K in Extract<P, string>]: SealedProvider<R, P, R[K]> } & SymbolProviders<R, P>;
/** Rename one string key in an object contract. */
export type Renamed<P extends object, Old extends string, New extends string> = {
  [K in keyof P as K extends Old ? New : K]: P[K];
};
type AliasesTo<D, Old> = { [K in keyof D]: ProviderGraphContract<D[K]> extends { readonly alias: Old } ? K : never }[keyof D];
type RenamedAlias<V, Old, New> = V extends Registration ? ProviderGraphContract<V> extends { readonly alias: Old }
  ? Provider<ProviderFactory<V>, ProviderRegistrationMetadata<V> & object, ProviderAcquisitionMetadata<V>, Extract<Resolved<WithoutAlias<ProviderGraphContract<V>> & { readonly alias: New }>, GraphContract>, ProviderAcquiredValue<V>>
  : V : V;
/** Rename one export in a module's public providers, including exported aliases that follow it. */
export type RenamedProviders<D extends object, Old extends string, New extends string> = [AliasesTo<D, Old>] extends [never] ? Renamed<D, Old, New>
  : { [K in keyof D as K extends Old ? New : K]: RenamedAlias<D[K], Old, New> };
export type RenamedConstraints<C extends NeedConstraint, Old extends string, New extends string> =
  C extends LifetimeObligation ? RenamedObligation<C, Old, New> : C extends { readonly kind: 'export'; readonly consumer: string | symbol; readonly needs: object }
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
  // Sealing re-derives retained lifetime obligations in this module's scope (SealedLifetimes).
  : C extends LifetimeObligation ? never
  : C extends { readonly kind: 'export' | 'external'; readonly consumer: infer K extends string | symbol; readonly needs: infer N extends object }
    ? Constraint<K, N, Extract<keyof N, P>, 'export'> | Constraint<K, N, Exclude<keyof N, keyof R>, 'external'>
  : C extends { readonly kind: 'token-export' | 'token-external'; readonly consumer: infer K extends string | symbol; readonly token: infer T }
    ? TokenConstraint<K, T, R, P>
  : C extends { readonly kind: 'optional-token-export' | 'optional-token-external'; readonly consumer: infer K extends string | symbol; readonly token: infer T }
    ? TokenConstraint<K, T, R, P, true>
  : C;
/** Every constraint a sealed module carries: its own registrations' needs, re-scoped retained constraints, and compact lifetime obligations. */
// The outer conditional keeps this exported alias name off the result, so declarations print its members.
export type ModuleSealedConstraints<E extends Entry, C extends NeedConstraint, P extends keyof RegistrationsFromEntries<E>> = [P] extends [unknown]
  ? ModuleConstraints<RegistrationsFromEntries<E>, P> | SealedConstraints<C, RegistrationsFromEntries<E>, P> | SealedLifetimes<RegistrationsFromEntries<E>, P, C>
  : never;

/** Extract a readonly map of services publicly exposed by a module. */
export type ModuleExportedServices<M> = M extends Module<infer P, infer _R, infer _C, infer _D> ? Readonly<P> : never;
/** Extract a readonly map of services a module requires from its host. */
export type ModuleRequiredServices<M> = M extends Module<infer _P, infer R, infer _C, infer _D> ? Readonly<R> : never;
