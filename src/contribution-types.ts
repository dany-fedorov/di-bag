import type { ProviderOrFactory, Registrations } from './registration';
import type { CollectionItem, CollectionTokenBase, TokenBase, TokenKey, TokenService } from './tokens';
import type { ValidToken, TokenTupleAdmission, CollectionBindingOutput } from './token-types';
import type { CheckDependencyCompatibility, CheckDependencyCompleteness, SeeErrors, Unsatisfied, Entry, RegistrationsFromEntries } from './types';
import type { BoundToken, ProviderCollectionTokens } from './provider';
import type { Module } from './module';
import type { RegistrationConstraints, PublicProvider, NeedConstraint, CheckedConstraints } from './module-types';

declare const contributionSite: unique symbol;
/**
 * Each union member retains one independently checked provider and its group.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#compose-an-ordered-collection
 */
export type Contribution<T extends TokenBase = TokenBase, V extends ProviderOrFactory = ProviderOrFactory> = {
  readonly kind: 'contribution'; readonly token: T; readonly registration: V;
};
/**
 * The erased contribution contract retained by checked builders and modules.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#compose-an-ordered-collection
 */
export type ContributionConstraint = Contribution<TokenBase, ProviderOrFactory>;
type Groups<C> = Extract<C, ContributionConstraint>;
type Same<A, B> = [A] extends [B] ? [B] extends [A] ? true : false : false;
type WrongMember<T, G> = G extends ContributionConstraint ? TokenKey<T> extends TokenKey<G['token']>
  ? Same<T, G['token']> extends true ? never : TokenKey<T> : never : never;
export type WrongGroup<T, C> = T extends unknown ? ValidToken<T> extends true ? WrongMember<T, Groups<C>> : 'opaque collection contract' : never;
export type CollectionMember<T, C> = T extends TokenBase
  ? [WrongGroup<T, C>] extends [never] ? unknown : Unsatisfied<'collection token has an incompatible or opaque contract', {}>
  : Unsatisfied<'collection token has an incompatible or opaque contract', {}>;
type RetainedCollectionKeys<C> = TokenKey<Extract<Extract<C, ContributionConstraint>['token'], CollectionTokenBase>>;
export type RegisterTokenAdmission<T, C> = T extends CollectionTokenBase
  ? Unsatisfied<'withTokenService requires a single-service token', {}>
  : TokenKey<T> extends RetainedCollectionKeys<C>
    ? Unsatisfied<'token symbol is already a collection in this graph', {}> : unknown;
export type CollectionTokenAdmission<R extends Registrations, T> = T extends CollectionTokenBase
  ? TokenKey<T> extends keyof R
    ? BoundToken<R[TokenKey<T>]> extends CollectionTokenBase ? unknown
      : Unsatisfied<'token symbol is already a single service in this graph', {}>
    : unknown
  : Unsatisfied<'withCollectionContribution requires a collection token', {}>;
type ContributionGraph<A extends Registrations, V extends ProviderOrFactory> = A & Record<typeof contributionSite, V>;
type WrongProvider<C, A extends Registrations> = C extends ContributionConstraint
  ? unknown extends CheckDependencyCompatibility<ContributionGraph<A, C['registration']>> ? never : C : never;
// Only failing contributions expand their retained consumer/dependency diagnostics.
type ContributionFailures<C, A extends Registrations> = C extends ContributionConstraint
  ? { readonly consumer: TokenKey<C['token']>; readonly diagnostic: CheckDependencyCompatibility<ContributionGraph<A, C['registration']>> }
  : never;
type MissingProvider<C, A extends Registrations> = C extends ContributionConstraint
  ? unknown extends CheckDependencyCompleteness<ContributionGraph<A, C['registration']>> ? never : C : never;
type CollectionNeeds<C, A extends Registrations> = ProviderCollectionTokens<A[keyof A]>
  | (C extends ContributionConstraint
      ? ProviderCollectionTokens<C['registration']>
      : C extends { kind: 'collection'; token: infer T }
        ? T
        : never);
type GroupErrors<C, A extends Registrations> = WrongGroup<Groups<C>['token'] | CollectionNeeds<C, A>, C>;
export type CheckedContributions<C, A extends Registrations> = [Groups<C>] extends [never] ? unknown
  : [GroupErrors<C, A>] extends [never] ? [WrongProvider<C, A>] extends [never] ? unknown
    : Unsatisfied<`contribution service is incompatible with its consumer dependency contract${SeeErrors<'unsatisfied-consumer'>}`, { readonly failures: ContributionFailures<WrongProvider<C, A>, A> }>
  : Unsatisfied<'collection token has an incompatible or opaque contract', {}>;
export type CompleteContributions<C, A extends Registrations> = [MissingProvider<C, A>] extends [never] ? unknown
  : Unsatisfied<`required service registrations are missing${SeeErrors<'missing-service'>}`, { readonly contributions: MissingProvider<C, A> }>;
/**
 * Retain a contribution's projected provider and its checked needs when its builder seals.
 * Lifetime reach is retained separately as compact obligations. A contribution retained
 * from an inner installation is already projected and has no needs left to re-scope.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#compose-an-ordered-collection
 */
export type ModuleContributionConstraints<C, R extends Registrations, P extends keyof R> = C extends ContributionConstraint
  ? Contribution<C['token'], PublicProvider<C['registration']>> | RegistrationConstraints<C['registration'], R, P>
  : never;
/**
 * Project a module's typed-token collections as readonly service arrays.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#compose-an-ordered-collection
 */
export type ModuleContributions<M> = M extends Module<infer _P, infer _R, infer C, infer _D>
  ? Readonly<{ [T in Groups<C>['token'] as TokenKey<T>]: T extends CollectionTokenBase ? readonly CollectionItem<T>[] : ReadonlyArray<TokenService<T>> }> : never;

/**
 * The checked generic `withCollectionContribution` callable exposed by a builder.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#compose-an-ordered-collection
 */
export type BuilderWithCollectionContribution<E extends Entry, C extends NeedConstraint> = <T extends TokenBase, V extends ProviderOrFactory>(
  options: {
    readonly collectionToken: T & (
      unknown extends TokenTupleAdmission<readonly [T]>
        ? CollectionTokenAdmission<RegistrationsFromEntries<E>, T>
        : TokenTupleAdmission<readonly [T]>
    );
    readonly provider: V & ProviderOrFactory & (
      unknown extends TokenTupleAdmission<readonly [NoInfer<T>]>
        ? unknown extends CollectionTokenAdmission<RegistrationsFromEntries<E>, NoInfer<T>>
          ? NoInfer<T> extends CollectionTokenBase
            ? CollectionBindingOutput<NoInfer<T>, NoInfer<V>>
              & CheckedConstraints<C | Contribution<NoInfer<T>, NoInfer<V>>, RegistrationsFromEntries<E>>
            : never
          : unknown
        : unknown
    );
  },
  ...invalid: [T] extends [never] ? [never] : [V] extends [never] ? [never] : []
) => import('./di-bag').Builder<E, C | Contribution<T, V>>;
