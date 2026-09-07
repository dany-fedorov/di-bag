import type { Registration, Registrations } from './registration';
import type { Provider, ProviderFactory, ProviderGraph, ProviderNeeds, ProviderTokenNeeds, ProviderMetadata, ProviderAcquisitionMetadata, ProviderAcquired } from './provider';
import type { GraphContract } from './token-types';
import type { TokenKey } from './tokens';
import type { Checked, Complete, Unsatisfied } from './types';
import type { CheckedConstraints, CompleteConstraints, NeedConstraint, Renamed } from './module-types';

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
type Strict<R> = ProviderGraph<R> extends infer G ? G extends { readonly lifetime: { readonly kind: 'root'; readonly captureScoped: infer C } }
  ? [C] extends [true] ? false : true : false : false;
export type PrivateLifetimes<R extends Registrations, P extends keyof R> = {
  [K in Exclude<keyof R, P>]: true extends Strict<R[K]>
    ? { readonly kind: 'lifetime'; readonly source: K; readonly context: LexicalContext<R, ExportMap<P>> } : never;
}[Exclude<keyof R, P>];

export type LexicalProvider<V extends Registration, R extends Registrations, P extends keyof R, K extends keyof R> =
  V extends infer T & {} ? T extends Registration ? [Extract<ProviderGraph<T>, { readonly lifetime: { readonly kind: 'root' | 'transient' } }>] extends [never] ? T
    : Provider<ProviderFactory<T>, ProviderMetadata<T> & object, ProviderAcquisitionMetadata<T>, ProviderGraph<T> & {
      readonly lexical: { readonly source: K; readonly context: LexicalContext<R, ExportMap<P>> };
    }, ProviderAcquired<T>> : never : never;

type RenamedGraph<G extends GraphContract, Old extends string, New extends string> = G extends {
  readonly lexical: { readonly source: infer K; readonly context: LexicalContext<infer R, infer E> };
} ? Omit<G, 'lexical'> & { readonly lexical: { readonly source: K; readonly context: LexicalContext<R, Renamed<E, Old, New>> } } : G;
export type RenamedLifetimeProvider<V extends Registration, Old extends string, New extends string> =
  V extends infer T & {} ? T extends Registration ? ProviderGraph<T> extends { readonly lexical: unknown }
    ? Provider<ProviderFactory<T>, ProviderMetadata<T> & object, ProviderAcquisitionMetadata<T>, RenamedGraph<ProviderGraph<T>, Old, New>, ProviderAcquired<T>> : T : never : never;
export type RenamedLifetimeProviders<D extends Registrations, Old extends string, New extends string> = {
  [K in keyof D as K extends Old ? New : K]: RenamedLifetimeProvider<D[K], Old, New>;
};
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
type Dependencies<V extends Registration> = keyof ProviderNeeds<V> | TokenKey<ProviderTokenNeeds<V>>;

// A single lexical walk serves public roots, private obligations, and tokens.
type WalkDependency<H extends Registrations, C, K, Root, Visited> = K extends PropertyKey
  ? C extends LexicalContext<infer R, infer E> ? K extends keyof R
    ? [PublicKey<E, K>] extends [never] ? WalkTarget<H, R[K], C, Root, PrivateSite<C, K>, Visited>
      : WalkPublic<H, PublicKey<E, K>, Root, Visited>
    : WalkPublic<H, K, Root, Visited>
  : WalkPublic<H, K, Root, Visited> : never;
type WalkPublic<H extends Registrations, K, Root, Visited> = K extends keyof H
  ? WalkTarget<H, H[K], undefined, Root, PublicSite<K>, Visited> : never;
type WalkTarget<H extends Registrations, V extends Registration, C, Root, Site, Visited> =
  V extends infer T & {} ? T extends Registration ? ProviderGraph<T> extends infer G
    ? G extends { readonly kind: 'opaque' } ? never
      : G extends { readonly lifetime: { readonly kind: 'root' } } ? never
        : G extends { readonly lifetime: { readonly kind: 'transient' } }
          ? Seen<Site, Visited> extends true ? never : WalkSource<H, T, C, Root, Visited | Site>
          : Captive<Root, Site>
    : never : never : never;
type WalkSource<H extends Registrations, V extends Registration, C, Root, Visited> = ProviderGraph<V> extends {
  readonly lexical: { readonly source: infer K; readonly context: infer L extends LexicalContext };
} ? K extends keyof L['registrations'] ? WalkDeclared<H, L['registrations'][K], L, Root, Visited> : never
  : WalkDeclared<H, V, C, Root, Visited>;
// Local shape errors have already been reported by ModuleBuilder.add. External
// dependencies are intentionally absent here, so local completeness is not required.
type WalkDeclared<H extends Registrations, V extends Registration, C, Root, Visited> =
  unknown extends (C extends LexicalContext ? Checked<C['registrations']> : unknown)
    ? WalkDependency<H, C, Dependencies<V>, Root, Visited> : never;
type CheckRoot<H extends Registrations, V extends Registration, C, Site> = V extends infer T & {}
  ? T extends Registration ? true extends Strict<T> ? WalkSource<H, T, C, Site, Site> : never : never : never;
type PublicCaptives<H extends Registrations> = { [K in keyof H]: CheckRoot<H, H[K], undefined, PublicSite<K>> }[keyof H];
type PrivateCaptives<H extends Registrations, C> = C extends LifetimeObligation
  ? C['source'] extends keyof C['context']['registrations']
    ? CheckRoot<H, C['context']['registrations'][C['source']], C['context'], PrivateSite<C['context'], C['source']>> : never : never;
type Captives<R extends Registrations, C> = PublicCaptives<R> | PrivateCaptives<R, C>;
export type CheckedLifetimes<R extends Registrations, C extends NeedConstraint> =
  [Captives<R, C>] extends [never] ? unknown
    : unknown extends Checked<R> & Complete<R> & CheckedConstraints<C, R> & CompleteConstraints<C, R>
      ? Unsatisfied<'root lifetime cannot capture scoped dependency', { readonly captives: Captives<R, C> }>
      : unknown;
