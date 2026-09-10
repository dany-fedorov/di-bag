import type { Registration, Registrations } from './registration';
import type { TokenBase, TokenKey, TokenService } from './tokens';
import type { ValidToken, TokenTupleAdmission, BindingOutput } from './token-types';
import type { Checked, Complete, Unsatisfied, Entry, From } from './types';
import type { ProviderAllTokenNeeds } from './provider';
import type { Module } from './module';
import type { RegistrationConstraints, PublicProvider, Renamed, NeedConstraint, CheckedConstraints } from './module-types';
import type { LexicalContext } from './lifetime-types';
declare const contributionSite: unique symbol;
/** Each union member retains one independently checked provider and its group. */
export type Contribution<T extends TokenBase = TokenBase, V extends Registration = Registration, L = undefined> = {
    readonly kind: 'contribution';
    readonly token: T;
    readonly registration: V;
    readonly context: L;
};
/** The erased contribution contract retained by checked builders and modules. */
export type ContributionConstraint = Contribution<TokenBase, Registration, unknown>;
type Groups<C> = Extract<C, ContributionConstraint>;
type Same<A, B> = [A] extends [B] ? [B] extends [A] ? true : false : false;
type WrongMember<T, G> = G extends ContributionConstraint ? TokenKey<T> extends TokenKey<G['token']> ? Same<T, G['token']> extends true ? never : TokenKey<T> : never : never;
export type WrongGroup<T, C> = T extends unknown ? ValidToken<T> extends true ? WrongMember<T, Groups<C>> : 'opaque collection contract' : never;
export type CollectionMember<T, C> = [WrongGroup<T, C>] extends [never] ? unknown : Unsatisfied<'collection token has an incompatible or opaque contract', {}>;
type ContributionGraph<A extends Registrations, V extends Registration> = A & Record<typeof contributionSite, V>;
type WrongProvider<C, A extends Registrations> = C extends ContributionConstraint ? unknown extends Checked<ContributionGraph<A, C['registration']>> ? never : C : never;
type MissingProvider<C, A extends Registrations> = C extends ContributionConstraint ? unknown extends Complete<ContributionGraph<A, C['registration']>> ? never : C : never;
type AllNeeds<C, A extends Registrations> = ProviderAllTokenNeeds<A[keyof A]> | (C extends ContributionConstraint ? ProviderAllTokenNeeds<C['registration']> : C extends {
    kind: 'all';
    token: infer T;
} ? T : never);
type GroupErrors<C, A extends Registrations> = WrongGroup<Groups<C>['token'] | AllNeeds<C, A>, C>;
export type CheckedContributions<C, A extends Registrations> = [Groups<C>] extends [never] ? unknown : [GroupErrors<C, A>] extends [never] ? [WrongProvider<C, A>] extends [never] ? unknown : Unsatisfied<'a contribution dependency has the wrong shape or incompatible contract', {}> : Unsatisfied<'collection token has an incompatible or opaque contract', {}>;
export type CompleteContributions<C, A extends Registrations> = [MissingProvider<C, A>] extends [never] ? unknown : Unsatisfied<'missing factories', {
    readonly contributions: MissingProvider<C, A>;
}>;
/** Retain a module contribution's provider checks and lexical private-service context. */
export type ModuleContributionConstraints<C, R extends Registrations, P extends keyof R> = C extends ContributionConstraint ? Contribution<C['token'], PublicProvider<C['registration']>, LexicalContext<R, {
    readonly [K in P]: K;
}> & {
    readonly registration: C['registration'];
}> | RegistrationConstraints<C['registration'], R, P> : never;
export type RenamedContribution<C extends ContributionConstraint, Old extends string, New extends string> = C['context'] extends LexicalContext<infer R, infer E> ? Contribution<C['token'], C['registration'], LexicalContext<R, Renamed<E, Old, New>> & Pick<C['context'], Exclude<keyof C['context'], keyof LexicalContext>>> : C;
/** Project a module's typed-token collections as readonly service arrays. */
export type ModuleContributions<M> = M extends Module<infer _P, infer _R, infer C, infer _D> ? Readonly<{
    [T in Groups<C>['token'] as TokenKey<T>]: ReadonlyArray<TokenService<T>>;
}> : never;
/** The checked generic `contribute` callable exposed by an application builder. */
export type BuilderContribute<E extends Entry, C extends NeedConstraint> = <T extends TokenBase, V extends Registration>(token: T & TokenTupleAdmission<readonly [T]>, registration: V & Registration & BindingOutput<NoInfer<T>, NoInfer<V>> & CheckedConstraints<C | Contribution<NoInfer<T>, NoInfer<V>>, From<E>>, ...invalid: [T] extends [never] ? [never] : [V] extends [never] ? [never] : []) => import('./di-bag').Builder<E, C | Contribution<T, V>>;
/** The checked generic `contribute` callable exposed by a module builder. */
export type ModuleContribute<E extends Entry, C extends ContributionConstraint> = <T extends TokenBase, V extends Registration>(token: T & TokenTupleAdmission<readonly [T]>, registration: V & Registration & BindingOutput<NoInfer<T>, NoInfer<V>> & CheckedContributions<C | Contribution<NoInfer<T>, NoInfer<V>>, From<E>>, ...invalid: [T] extends [never] ? [never] : [V] extends [never] ? [never] : []) => import('./module').ModuleBuilder<E, C | Contribution<T, V>>;
export {};
