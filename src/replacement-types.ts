import type { NeedConstraint, CheckedConstraints } from './module-types';
import type { ProviderFactory } from './provider';
import type { Registration, Registrations } from './registration';
import type { TokenBinding, BindingOutput, TokenMember } from './token-types';
import type { TokenBase, TokenKey } from './tokens';
import type { Entry, RegistrationsFromEntries, IncrementalChecked, OverrideRegistrations, ReplacementKey } from './types';

type DependencyBearingRegistration<R extends Registration> = R extends unknown
  ? Parameters<ProviderFactory<R>> extends [] ? never : R
  : never;

export type ZeroDependencyAdmission<R extends Registration> =
  [DependencyBearingRegistration<R>] extends [never] ? unknown : never;

export type ReplacementAdmission<R extends Registrations, K extends string | TokenBase> =
  [K] extends [string] ? ReplacementKey<R, K> : TokenMember<R, K>;

export type BuilderReplacementRegistration<
  E extends Entry,
  C extends NeedConstraint,
  K extends string | TokenBase,
  V extends Registration,
> = [K] extends [string]
  ? IncrementalChecked<E, Record<K, NoInfer<V>>>
    & CheckedConstraints<C, OverrideRegistrations<RegistrationsFromEntries<E>, Record<K, NoInfer<V>>>>
  : [K] extends [TokenBase]
    ? BindingOutput<NoInfer<K>, NoInfer<V>>
      & IncrementalChecked<E, Record<TokenKey<K>, TokenBinding<NoInfer<K>, NoInfer<V>>>>
      & CheckedConstraints<C, OverrideRegistrations<RegistrationsFromEntries<E>, Record<TokenKey<K>, TokenBinding<NoInfer<K>, NoInfer<V>>>>>
    : never;

type ReflectedEntry = { key: never; registration: TokenBinding<TokenBase, Registration> };

export type ReplacedEntries<
  E extends Entry,
  K extends string | TokenBase,
  V extends Registration,
> = [K] extends [string]
  ? Exclude<E, { key: K }> | { key: K; registration: V }
  : [K] extends [TokenBase]
    ? Exclude<E, { key: TokenKey<K> }> | {
      key: TokenKey<K>;
      registration: TokenBinding<K, V>;
    }
    : E | ReflectedEntry;
