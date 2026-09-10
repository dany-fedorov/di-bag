import type { ContributionConstraint } from './contribution-types';
import type { Registration, Registrations } from './registration';
import type { Provider, ProviderFactory, ProviderGraphContract, ProviderNamedDependencies, ProviderRequiredTokens, ProviderOptionalTokens, ProviderCollectionTokens, ProviderRegistrationMetadata, ProviderAcquisitionMetadata, ProviderAcquiredValue } from './provider';
import type { GraphContract } from './token-types';
import type { TokenKey } from './tokens';
import type { CheckDependencyCompatibility, CheckDependencyCompleteness, Unsatisfied } from './types';
import type { CheckedConstraints, CompleteConstraints, NeedConstraint, Renamed } from './module-types';

/** A module provider's retained local registrations and public-to-local export mapping. */
export type LexicalContext<R extends Registrations = Registrations, E extends object = object> = {
  readonly registrations: R;
  /** Current public name -> original local name. */
  readonly exports: E;
};
export type LifetimeObligation = {
  readonly kind: 'lifetime';
  readonly source: PropertyKey;
  readonly context: LexicalContext;
};
type ExportMap<P extends PropertyKey> = { readonly [K in P]: K };
type Strict<R> = ProviderGraphContract<R> extends infer G ? G extends { readonly lifetime: { readonly kind: 'root'; readonly allowScopedDependencies: infer C } }
  ? [C] extends [true] ? false : true : false : false;
export type PrivateLifetimes<R extends Registrations, P extends keyof R> = {
  [K in Exclude<keyof R, P>]: true extends Strict<R[K]>
    ? { readonly kind: 'lifetime'; readonly source: K; readonly context: LexicalContext<R, ExportMap<P>> } : never;
}[Exclude<keyof R, P>];

export type LexicalProvider<V extends Registration, R extends Registrations, P extends keyof R, K extends keyof R> =
  V extends infer T & {} ? T extends Registration ? [Extract<ProviderGraphContract<T>, { readonly lifetime: { readonly kind: 'root' | 'transient' } } | { readonly alias: PropertyKey }>] extends [never] ? T
    : Provider<ProviderFactory<T>, ProviderRegistrationMetadata<T> & object, ProviderAcquisitionMetadata<T>, ProviderGraphContract<T> & {
      readonly lexical: { readonly source: K; readonly context: LexicalContext<R, ExportMap<P>> };
    }, ProviderAcquiredValue<T>> : never : never;

type RenamedGraph<G extends GraphContract, Old extends string, New extends string> = G extends {
  readonly lexical: { readonly source: infer K; readonly context: LexicalContext<infer R, infer E> };
} ? Omit<G, 'lexical'> & { readonly lexical: { readonly source: K; readonly context: LexicalContext<R, Renamed<E, Old, New>> } } : G;
export type RenamedLifetimeProvider<V extends Registration, Old extends string, New extends string> =
  V extends infer T & {} ? T extends Registration ? ProviderGraphContract<T> extends { readonly lexical: unknown }
    ? Provider<ProviderFactory<T>, ProviderRegistrationMetadata<T> & object, ProviderAcquisitionMetadata<T>, RenamedGraph<ProviderGraphContract<T>, Old, New>, ProviderAcquiredValue<T>> : T : never : never;
/** Rename public lifetime-carrier registrations while preserving their lexical sources. */
export type RenamedLifetimeProviders<D extends Registrations, Old extends string, New extends string> = {
  [K in keyof D as K extends Old ? New : K]: RenamedLifetimeProvider<D[K], Old, New>;
};
/** Rename a retained lifetime obligation's public export view. */
export type RenamedLifetimeObligation<C extends LifetimeObligation, Old extends string, New extends string> = {
  readonly kind: 'lifetime'; readonly source: C['source'];
  readonly context: LexicalContext<C['context']['registrations'], Renamed<C['context']['exports'], Old, New>>;
};

type PublicSite<K> = { readonly kind: 'public'; readonly key: K };
type PrivateSite<C, K> = { readonly kind: 'private'; readonly context: C; readonly key: K };
type Captive<Root, Site> = { readonly root: Root; readonly dependency: Site };
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Seen<S, V> = true extends (V extends unknown ? Equal<S, V> : never) ? true : false;
type PublicKey<E, K> = { [P in keyof E]: Equal<E[P], K> extends true ? P : never }[keyof E];
type Dependencies<V extends Registration> = keyof ProviderNamedDependencies<V> | TokenKey<ProviderRequiredTokens<V> | ProviderOptionalTokens<V>>;

// A single lexical walk serves public roots, private obligations, and tokens.
type WalkDependency<H extends Registrations, C, K, Root, Visited, G> = K extends PropertyKey
  ? C extends LexicalContext<infer R, infer E> ? K extends keyof R
    ? [PublicKey<E, K>] extends [never] ? WalkTarget<H, R[K], C, Root, PrivateSite<C, K>, Visited, G>
      : WalkPublic<H, PublicKey<E, K>, Root, Visited, G>
    : WalkPublic<H, K, Root, Visited, G>
  : WalkPublic<H, K, Root, Visited, G> : never;
type WalkPublic<H extends Registrations, K, Root, Visited, G> = K extends keyof H
  ? WalkTarget<H, H[K], undefined, Root, PublicSite<K>, Visited, G> : never;
type WalkTarget<H extends Registrations, V extends Registration, C, Root, Site, Visited, G> =
  V extends infer T & {} ? T extends Registration ? ProviderGraphContract<T> extends infer PG
    ? PG extends { readonly sharedAlias: { readonly registrations: infer P extends Registrations; readonly source: infer K } }
      ? WalkPublic<P, K, Root, never, G>
      : PG extends { readonly kind: 'opaque' } ? never
      : PG extends { readonly alias: PropertyKey }
        ? Seen<Site, Visited> extends true ? never : WalkSource<H, T, C, Root, Visited | Site, G>
      : PG extends { readonly lifetime: { readonly kind: 'root' } } ? never
        : PG extends { readonly lifetime: { readonly kind: 'transient' } }
          ? Seen<Site, Visited> extends true ? never : WalkSource<H, T, C, Root, Visited | Site, G>
          : Captive<Root, Site>
    : never : never : never;
type WalkSource<H extends Registrations, V extends Registration, C, Root, Visited, G> = ProviderGraphContract<V> extends {
  readonly lexical: { readonly source: infer K; readonly context: infer L extends LexicalContext };
} ? K extends keyof L['registrations'] ? WalkDeclared<H, L['registrations'][K], L, Root, Visited, G> : never
  : C extends LexicalContext & { readonly registration: infer Original extends Registration } ? WalkDeclared<H, Original, LexicalContext<C['registrations'], C['exports']>, Root, Visited, G> : WalkDeclared<H, V, C, Root, Visited, G>;
// Local shape errors have already been reported by ModuleBuilder.register. External
// dependencies are intentionally absent here, so local completeness is not required.
type WalkDeclared<H extends Registrations, V extends Registration, C, Root, Visited, G> =
  unknown extends (C extends LexicalContext ? CheckDependencyCompatibility<C['registrations']> : unknown)
    ? WalkDependency<H, C, Dependencies<V>, Root, Visited, G> | WalkCollection<H, ProviderCollectionTokens<V>, Root, Visited, G> : never;
type CheckRoot<H extends Registrations, V extends Registration, C, Site, G> = V extends infer T & {}
  ? T extends Registration ? true extends Strict<T> ? WalkSource<H, T, C, Site, Site, G> : never : never : never;
type PublicCaptives<H extends Registrations, G> = { [K in keyof H]: CheckRoot<H, H[K], undefined, PublicSite<K>, G> }[keyof H];
type PrivateCaptives<H extends Registrations, C, G> = C extends LifetimeObligation
  ? C['source'] extends keyof C['context']['registrations']
    ? CheckRoot<H, C['context']['registrations'][C['source']], C['context'], PrivateSite<C['context'], C['source']>, G> : never : never;
type ContributionSite<C> = { readonly kind: 'contribution'; readonly contribution: C };
type WalkCollection<H extends Registrations, T, Root, Visited, G, Items = Extract<G, ContributionConstraint>> =
  Items extends ContributionConstraint ? TokenKey<Items['token']> extends TokenKey<T>
    ? WalkTarget<H, Items['registration'], Items['context'], Root, ContributionSite<Items>, Visited, G> : never : never;
type ContributionCaptives<H extends Registrations, G, Items = Extract<G, ContributionConstraint>> = Items extends ContributionConstraint
  ? CheckRoot<H, Items['registration'], Items['context'], ContributionSite<Items>, G> : never;
type Captives<R extends Registrations, C> = PublicCaptives<R, C> | PrivateCaptives<R, C, C> | ContributionCaptives<R, C>;
// Inherited roots construct in their already-validated ancestor graph. Only
// roots newly introduced by this scope can capture its overridden dependencies.
type OverrideCaptives<R extends Registrations, O extends Registrations, G> = {
  [K in keyof O & keyof R]: CheckRoot<R, R[K], undefined, PublicSite<K>, G>;
}[keyof O & keyof R];
/** Reject root providers introduced by a scope override when they capture scoped dependencies. */
export type CheckedScopeLifetimes<R extends Registrations, O extends Registrations, G = never> =
  [OverrideCaptives<R, O, G>] extends [never] ? unknown
    : Unsatisfied<'root lifetime cannot capture scoped dependency', { readonly captives: OverrideCaptives<R, O, G> }>;
/** Reject strict root providers that transitively capture scoped dependencies. */
export type CheckedLifetimes<R extends Registrations, C extends NeedConstraint> =
  [Captives<R, C>] extends [never] ? unknown
    : unknown extends CheckDependencyCompatibility<R> & CheckDependencyCompleteness<R> & CheckedConstraints<C, R> & CompleteConstraints<C, R>
      ? Unsatisfied<'root lifetime cannot capture scoped dependency', { readonly captives: Captives<R, C> }>
      : unknown;

// Sharing needs the current canonical policy, including private module targets
// and public replacements. Alias cycles terminate without inventing a policy.
type PolicyDependency<H extends Registrations, C, K, Visited> = K extends PropertyKey
  ? C extends LexicalContext<infer R, infer E> ? K extends keyof R
    ? [PublicKey<E, K>] extends [never] ? PolicyTarget<H, R[K], C, PrivateSite<C, K>, Visited>
      : PolicyPublic<H, PublicKey<E, K>, Visited>
    : PolicyPublic<H, K, Visited>
  : PolicyPublic<H, K, Visited> : never;
type PolicyPublic<H extends Registrations, K, Visited> = K extends keyof H
  ? PolicyTarget<H, H[K], undefined, PublicSite<K>, Visited> : never;
type PolicyTarget<H extends Registrations, V extends Registration, C, Site, Visited> =
  Seen<Site, Visited> extends true ? never : ProviderGraphContract<V> extends infer G
    ? G extends { readonly sharedAlias: { readonly registrations: infer P extends Registrations; readonly source: infer K } }
      ? PolicyPublic<P, K, never>
      : G extends { readonly alias: infer K }
      ? G extends { readonly lexical: { readonly source: infer S; readonly context: infer L extends LexicalContext } }
        ? S extends keyof L['registrations'] ? ProviderGraphContract<L['registrations'][S]> extends { readonly alias: infer A }
          ? PolicyDependency<H, L, A, Visited | Site> : never : never
        : PolicyDependency<H, C, K, Visited | Site>
      : G extends { readonly lifetime: { readonly kind: infer K } } ? K : 'scoped'
    : never;
export type CanonicalLifetime<R extends Registrations, K extends keyof R> = PolicyPublic<R, K, never>;
