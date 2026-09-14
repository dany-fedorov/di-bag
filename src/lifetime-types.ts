import type { ContributionConstraint } from './contribution-types';
import type { Registration, Registrations } from './registration';
import type { ProviderGraphContract, ProviderNamedDependencies, ProviderRequiredTokens, ProviderOptionalTokens, ProviderCollectionTokens } from './provider';
import type { TokenBase, TokenKey } from './tokens';
import type { CheckDependencyCompatibility, CheckDependencyCompleteness, NameText, SeeErrors, Unsatisfied } from './types';
import type { CheckedConstraints, CompleteConstraints, NeedConstraint } from './module-types';

/**
 * Where a sealed lifetime walk leaves its module: an export or external name the installing
 * host resolves, a typed-token collection the host completes, or a private scoped dead end.
 * @see https://dany-fedorov.github.io/di-bag/agent/errors.html#root-capture
 */
export type Reach =
  | { readonly kind: 'export' | 'external'; readonly key: PropertyKey }
  | { readonly kind: 'collection'; readonly key: symbol }
  | { readonly kind: 'scoped'; readonly key: PropertyKey };
/**
 * A compact seal-time lifetime record that replaces a module's private registrations:
 * `root-reach` names a private strict root, `export-reach` an export the host checks as a root or
 * walks through as a transient or alias, and `contribution-reach` a sealed contribution group
 * that is checked as a root or walked by collecting roots. Each record carries one reach.
 * @see https://dany-fedorov.github.io/di-bag/agent/errors.html#root-capture
 */
export type LifetimeObligation =
  | { readonly kind: 'root-reach'; readonly root: PropertyKey; readonly reach: Reach }
  | { readonly kind: 'export-reach'; readonly export: PropertyKey; readonly reach: Reach }
  | { readonly kind: 'contribution-reach'; readonly group: symbol; readonly policy: 'root' | 'transient'; readonly reach: Reach };

// A contribution has no key; its site renders as `contribution`.
type ContributionSite = { readonly kind: 'contribution' };
type SiteText<S> = S extends ContributionSite ? 'contribution' : NameText<S>;
type CaptiveText<C> = C extends { readonly root: infer R; readonly dependency: infer D } ? `${SiteText<R>} -> ${SiteText<D>}` : never;

// Distribute registration unions and NoInfer wrappers so each member keeps its own policy.
type Members<V> = V extends infer T & {} ? T extends Registration ? T : never : never;
type Strict<T> = ProviderGraphContract<T> extends infer G ? G extends { readonly lifetime: { readonly kind: 'root'; readonly allowScopedDependencies: infer A } }
  ? [A] extends [true] ? false : true : false : false;
type Carrying<T> = ProviderGraphContract<T> extends infer G
  ? G extends { readonly alias: PropertyKey } | { readonly lifetime: { readonly kind: 'transient' } } ? true : false : false;
type StrictMembers<V> = Members<V> extends infer T ? T extends Registration ? true extends Strict<T> ? T : never : never : never;
type CarrierMembers<V> = Members<V> extends infer T ? T extends Registration ? true extends Strict<T> | Carrying<T> ? T : never : never : never;
type Dependencies<V> = V extends Registration ? keyof ProviderNamedDependencies<V> | TokenKey<ProviderRequiredTokens<V> | ProviderOptionalTokens<V>> : never;
// A projected alias has no dependency object left; its target is the alias key.
type AliasKeys<V> = ProviderGraphContract<V> extends infer G ? G extends { readonly alias: infer A } ? A : never : never;
type CollectionKeys<V> = ProviderCollectionTokens<V> extends infer T ? T extends TokenBase ? TokenKey<T> : never : never;
// Most graphs declare no lifetime or alias at all; they cannot hold a captive or a carrier,
// so every lifetime walk below is skipped for them. This keeps per-module sealing cheap.
type Lifetimed<V> = V extends infer T & {} ? ProviderGraphContract<T> extends infer G
  ? G extends { readonly lifetime: unknown } | { readonly alias: unknown } | { readonly sharedAlias: unknown } ? true : never : never : never;
type ContributionRegistrations<C> = C extends ContributionConstraint ? C['registration'] : never;
type NeedsLifetimeWalk<R extends Registrations, C> = [Extract<C, LifetimeObligation>] extends [never]
  ? Lifetimed<R[keyof R] | ContributionRegistrations<C>> : true;
type ExportReaches<C, K> = C extends { readonly kind: 'export-reach'; readonly export: K; readonly reach: infer X } ? X : never;

// ---- Seal time: what does each registration reach outside its module? ----
// Exports stop the walk (the host may replace them), roots end it, private scoped registrations
// are dead ends, and private transients and aliases are followed. Collections are completed by
// the installing host, so they are retained unresolved.
type Reached<R extends Registrations, P, C, D, Visited> = D extends P ? { readonly kind: 'export'; readonly key: D }
  : D extends keyof R ? D extends Visited ? never : ReachTarget<R, P, C, R[D], D, Visited | D>
  : D extends PropertyKey ? { readonly kind: 'external'; readonly key: D } : never;
type ReachTarget<R extends Registrations, P, C, V, D, Visited> = Members<V> extends infer T ? T extends Registration
  ? ProviderGraphContract<T> extends infer G
    ? G extends { readonly kind: 'opaque' } ? never
    : G extends { readonly alias: PropertyKey } ? Reaches<R, P, C, T, D, Visited>
    : G extends { readonly lifetime: { readonly kind: 'root' } } ? never
    : G extends { readonly lifetime: { readonly kind: 'transient' } } ? Reaches<R, P, C, T, D, Visited>
    : { readonly kind: 'scoped'; readonly key: D }
    : never : never : never;
type Reaches<R extends Registrations, P, C, V, K, Visited> =
  | Reached<R, P, C, Dependencies<V> | AliasKeys<V>, Visited>
  | Follow<R, P, C, ExportReaches<C, K>, Visited>
  | (CollectionKeys<V> extends infer T ? T extends symbol ? { readonly kind: 'collection'; readonly key: T } : never : never);
// A retained reach names a key of this builder; re-walk it here.
type Follow<R extends Registrations, P, C, X, Visited> = X extends { readonly kind: 'export' | 'external'; readonly key: infer D } ? Reached<R, P, C, D, Visited> : X;

type AsRoot<Root, X> = X extends Reach ? { readonly kind: 'root-reach'; readonly root: Root; readonly reach: X } : never;
type AsExport<K, X> = X extends Reach ? { readonly kind: 'export-reach'; readonly export: K; readonly reach: X } : never;
type AsContribution<T, Policy, X> = X extends Reach ? { readonly kind: 'contribution-reach'; readonly group: T; readonly policy: Policy; readonly reach: X } : never;

type PrivateRoots<R extends Registrations, P, C> = {
  [K in Exclude<keyof R, P>]: [StrictMembers<R[K]>] extends [never] ? never : AsRoot<K, Reaches<R, P, C, StrictMembers<R[K]>, K, K>>;
}[Exclude<keyof R, P>];
type RetainedRoots<R extends Registrations, P, C, O = C> = O extends { readonly kind: 'root-reach'; readonly root: infer Root; readonly reach: infer X }
  ? AsRoot<Root, Follow<R, P, C, X, never>> : never;
type ExportObligations<R extends Registrations, P, C> = {
  [K in P & keyof R]: [CarrierMembers<R[K]>] extends [never] ? never : AsExport<K, Reaches<R, P, C, CarrierMembers<R[K]>, K, K>>;
}[P & keyof R];
type ContributionPolicy<T> = true extends Strict<T> ? 'root'
  : ProviderGraphContract<T> extends infer G ? G extends { readonly lifetime: { readonly kind: 'transient' } } ? 'transient' : never : never;
type OwnContributions<R extends Registrations, P, C, I = Extract<C, ContributionConstraint>> = I extends ContributionConstraint
  ? Members<I['registration']> extends infer T ? T extends Registration ? ContributionPolicy<T> extends infer Policy ? Policy extends 'root' | 'transient'
    ? AsContribution<TokenKey<I['token']>, Policy, Reaches<R, P, C, T, never, never>> : never : never : never : never
  : never;
type RetainedContributions<R extends Registrations, P, C, O = C> = O extends { readonly kind: 'contribution-reach'; readonly group: infer T; readonly policy: infer Policy; readonly reach: infer X }
  ? AsContribution<T, Policy, Follow<R, P, C, X, never>> : never;
type ContributionObligations<R extends Registrations, P, C> = OwnContributions<R, P, C> | RetainedContributions<R, P, C>;
type Scoped = { readonly reach: { readonly kind: 'scoped' } };
// Roots nobody can replace: private roots and every contribution checked as a root.
type Unreplaceable<R extends Registrations, P, C> = PrivateRoots<R, P, C> | RetainedRoots<R, P, C> | Extract<ContributionObligations<R, P, C>, { readonly policy: 'root' }>;
type SealCaptives<R extends Registrations, P, C> = Extract<Unreplaceable<R, P, C>, Scoped>;
type SealCaptiveText<O> = O extends { readonly reach: { readonly key: infer D } }
  ? `${O extends { readonly root: infer Root } ? SiteText<Root> : 'contribution'} -> ${NameText<D>}` : never;
/** Every compact lifetime obligation a sealing builder retains for its installing host. */
export type SealedLifetimes<R extends Registrations, P extends PropertyKey, C> = [NeedsLifetimeWalk<R, C>] extends [never] ? never
  // A graph whose shapes were already rejected by register retains no reach: its walk would report twice.
  : unknown extends CheckDependencyCompatibility<R>
    ? | Exclude<Unreplaceable<R, P, C>, Scoped>
      | ExportObligations<R, P, C>
      | Extract<ContributionObligations<R, P, C>, { readonly policy: 'transient' }>
    : never;
/** Reject sealing when a root the host cannot replace captures a scoped service of the same module. */
export type SealAdmission<R extends Registrations, P extends PropertyKey, C> = [NeedsLifetimeWalk<R, C>] extends [never] ? unknown
  : [SealCaptives<R, P, C>] extends [never] ? unknown
  // Shape errors were already reported by register; do not add a captive report on top of them.
  : unknown extends CheckDependencyCompatibility<R>
    ? Unsatisfied<`root lifetime cannot capture scoped dependency: ${SealCaptiveText<SealCaptives<R, P, C>>}${SeeErrors<'root-capture'>}`, { readonly captives: SealCaptives<R, P, C> }>
    : unknown;
type RenamedReach<X, Old, New> = X extends { readonly kind: 'export'; readonly key: Old } ? { readonly kind: 'export'; readonly key: New } : X;
/** Rename one export inside retained lifetime obligations. */
export type RenamedObligation<O, Old extends string, New extends string> =
  O extends { readonly kind: 'export-reach'; readonly export: infer K; readonly reach: infer X }
    ? { readonly kind: 'export-reach'; readonly export: K extends Old ? New : K; readonly reach: RenamedReach<X, Old, New> }
  : O extends { readonly kind: 'root-reach'; readonly root: infer Root; readonly reach: infer X }
    ? { readonly kind: 'root-reach'; readonly root: Root; readonly reach: RenamedReach<X, Old, New> }
  : O extends { readonly kind: 'contribution-reach'; readonly group: infer T; readonly policy: infer Policy; readonly reach: infer X }
    ? { readonly kind: 'contribution-reach'; readonly group: T; readonly policy: Policy; readonly reach: RenamedReach<X, Old, New> }
  : O;
/** Drop the obligations of replaced exports: the replacement brings its own graph. */
export type WithoutExportObligations<C, K> = [Extract<C, { readonly kind: 'export-reach'; readonly export: K }>] extends [never] ? C
  : Exclude<C, { readonly kind: 'export-reach'; readonly export: K }>;

// ---- Host time: does any strict root reach a scoped registration? ----
type Captured<D> = { readonly captured: D };
type GroupReaches<C, T> = C extends { readonly kind: 'contribution-reach'; readonly group: T; readonly policy: 'transient'; readonly reach: infer X } ? X : never;
type Collected<T> = { readonly collection: T };
type HostReach<R extends Registrations, C, D, Visited> = D extends keyof R ? D extends Visited ? never : HostTarget<R, C, R[D], D, Visited | D> : never;
type HostTarget<R extends Registrations, C, V, D, Visited> = Members<V> extends infer T ? T extends Registration
  ? ProviderGraphContract<T> extends infer G
    // A selected child alias resolves in its parent's registrations.
    ? G extends { readonly sharedAlias: { readonly registrations: infer S extends Registrations; readonly source: infer K } } ? HostReach<S, C, K, never>
    : G extends { readonly kind: 'opaque' } ? never
    : G extends { readonly alias: PropertyKey } ? HostReaches<R, C, T, D, Visited>
    : G extends { readonly lifetime: { readonly kind: 'root' } } ? never
    : G extends { readonly lifetime: { readonly kind: 'transient' } } ? HostReaches<R, C, T, D, Visited>
    : Captured<D>
    : never : never : never;
type HostReaches<R extends Registrations, C, V, K, Visited> =
  | HostReach<R, C, Dependencies<V> | AliasKeys<V>, Visited>
  | HostFollow<R, C, ExportReaches<C, K>, Visited>
  | HostCollection<R, C, CollectionKeys<V>, Visited>;
type HostFollow<R extends Registrations, C, X, Visited> = X extends { readonly kind: 'scoped'; readonly key: infer S } ? Captured<S>
  : X extends { readonly kind: 'collection'; readonly key: infer T } ? HostCollection<R, C, T, Visited>
  : X extends { readonly key: infer D } ? HostReach<R, C, D, Visited> : never;
type HostCollection<R extends Registrations, C, T, Visited> = T extends symbol ? Collected<T> extends Visited ? never
  : | HostContributions<R, C, T, Visited | Collected<T>>
    | HostFollow<R, C, GroupReaches<C, T>, Visited | Collected<T>>
  : never;
type HostContributions<R extends Registrations, C, T, Visited, I = Extract<C, ContributionConstraint>> = I extends ContributionConstraint
  ? TokenKey<I['token']> extends T ? Members<I['registration']> extends infer M ? M extends Registration ? ProviderGraphContract<M> extends infer G
    ? G extends { readonly kind: 'opaque' } ? never
    : G extends { readonly lifetime: { readonly kind: 'root' } } ? never
    : G extends { readonly lifetime: { readonly kind: 'transient' } } ? HostReaches<R, C, M, never, Visited>
    : Captured<ContributionSite>
    : never : never : never : never
  : never;
type Captive<Root, X> = X extends Captured<infer D> ? { readonly root: Root; readonly dependency: D } : never;
type RootCaptives<R extends Registrations, C, Keys extends keyof R> = {
  [K in Keys]: [StrictMembers<R[K]>] extends [never] ? never : Captive<K, HostReaches<R, C, StrictMembers<R[K]>, K, K>>;
}[Keys];
type ContributionRootCaptives<R extends Registrations, C, I = Extract<C, ContributionConstraint>> = I extends ContributionConstraint
  ? [StrictMembers<I['registration']>] extends [never] ? never : Captive<ContributionSite, HostReaches<R, C, StrictMembers<I['registration']>, never, never>>
  : never;
type ObligationCaptives<R extends Registrations, C, O = C> =
  O extends { readonly kind: 'root-reach'; readonly root: infer Root; readonly reach: infer X } ? Captive<Root, HostFollow<R, C, X, never>>
  : O extends { readonly kind: 'contribution-reach'; readonly policy: 'root'; readonly reach: infer X } ? Captive<ContributionSite, HostFollow<R, C, X, never>>
  : never;
type Captives<R extends Registrations, C> = RootCaptives<R, C, keyof R> | ContributionRootCaptives<R, C> | ObligationCaptives<R, C>;
/**
 * Reject strict root providers that transitively capture scoped dependencies.
 * @see https://dany-fedorov.github.io/di-bag/agent/errors.html#root-capture
 */
export type CheckedLifetimes<R extends Registrations, C extends NeedConstraint> = [NeedsLifetimeWalk<R, C>] extends [never] ? unknown
  : [Captives<R, C>] extends [never] ? unknown
    : unknown extends CheckDependencyCompatibility<R> & CheckDependencyCompleteness<R> & CheckedConstraints<C, R> & CompleteConstraints<C, R>
      ? Unsatisfied<`root lifetime cannot capture scoped dependency: ${CaptiveText<Captives<R, C>>}${SeeErrors<'root-capture'>}`, { readonly captives: Captives<R, C> }>
      : unknown;
// Inherited roots construct in their already-validated ancestor graph. Only
// roots newly introduced by this scope can capture its overridden dependencies.
type OverrideCaptives<R extends Registrations, O extends Registrations, C> = RootCaptives<R, C, keyof O & keyof R>;
/**
 * Reject root providers introduced by a scope override when they capture scoped dependencies.
 * @see https://dany-fedorov.github.io/di-bag/agent/errors.html#root-capture
 */
export type CheckedScopeLifetimes<R extends Registrations, O extends Registrations, C = never> = [NeedsLifetimeWalk<R, C>] extends [never] ? unknown
  : [OverrideCaptives<R, O, C>] extends [never] ? unknown
    : Unsatisfied<`root lifetime cannot capture scoped dependency: ${CaptiveText<OverrideCaptives<R, O, C>>}${SeeErrors<'root-capture'>}`, { readonly captives: OverrideCaptives<R, O, C> }>;

// Sharing needs the current canonical policy, including public replacements and
// parent sharing routes. Alias cycles terminate without inventing a policy.
type PolicyOf<R extends Registrations, K, Visited> = K extends keyof R ? K extends Visited ? never : PolicyTarget<R, R[K], Visited | K> : never;
type PolicyTarget<R extends Registrations, V, Visited> = ProviderGraphContract<V> extends infer G
  ? G extends { readonly sharedAlias: { readonly registrations: infer P extends Registrations; readonly source: infer K } } ? PolicyOf<P, K, never>
  : G extends { readonly alias: infer K } ? PolicyOf<R, K, Visited>
  : G extends { readonly lifetime: { readonly kind: infer L } } ? L : 'scoped'
  : never;
export type CanonicalLifetime<R extends Registrations, K extends keyof R> = PolicyOf<R, K, never>;
