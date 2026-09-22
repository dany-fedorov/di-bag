import type { Registration, Registrations } from './registration';
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
export type Contribution<T extends TokenBase = TokenBase, V extends Registration = Registration> = {
  readonly kind: 'contribution'; readonly token: T; readonly registration: V;
};
/**
 * The erased contribution contract retained by checked builders and modules.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#compose-an-ordered-collection
 */
export type ContributionConstraint = Contribution<TokenBase, Registration>;
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
  ? Unsatisfied<'register requires a single-service token', {}>
  : TokenKey<T> extends RetainedCollectionKeys<C>
    ? Unsatisfied<'token symbol is already a collection in this graph', {}> : unknown;
export type CollectionTokenAdmission<R extends Registrations, T> = T extends CollectionTokenBase
  ? TokenKey<T> extends keyof R
    ? BoundToken<R[TokenKey<T>]> extends CollectionTokenBase ? unknown
      : Unsatisfied<'token symbol is already a single service in this graph', {}>
    : unknown
  : Unsatisfied<'contribute requires a collection token', {}>;
type ContributionGraph<A extends Registrations, V extends Registration> = A & Record<typeof contributionSite, V>;
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
 * The checked generic `contribute` callable exposed by a builder.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#compose-an-ordered-collection
 */
export type BuilderContribute<
  Entries extends Entry,
  Constraints extends NeedConstraint,
> = <
  TokenHandle extends TokenBase,
  Provider extends Registration,
>(
  token: TokenHandle & (
    unknown extends TokenTupleAdmission<readonly [TokenHandle]>
      ? CollectionTokenAdmission<RegistrationsFromEntries<Entries>, TokenHandle>
      : TokenTupleAdmission<readonly [TokenHandle]>
  ),
  registration: Provider & Registration & (
    unknown extends TokenTupleAdmission<readonly [NoInfer<TokenHandle>]>
      ? unknown extends CollectionTokenAdmission<RegistrationsFromEntries<Entries>, NoInfer<TokenHandle>>
        ? NoInfer<TokenHandle> extends CollectionTokenBase
          ? CollectionBindingOutput<NoInfer<TokenHandle>, NoInfer<Provider>>
            & CheckedConstraints<
                Constraints | Contribution<NoInfer<TokenHandle>, NoInfer<Provider>>,
                RegistrationsFromEntries<Entries>
              >
          : never
        : unknown
      : unknown
  ),
  ...invalid: [TokenHandle] extends [never]
    ? [never]
    : [Provider] extends [never] ? [never] : []
) => import('./di-bag').Builder<
  Entries,
  Constraints | Contribution<TokenHandle, Provider>
>;
