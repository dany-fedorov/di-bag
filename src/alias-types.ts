import type { Provider, ProviderOutput } from './provider';
import type { Registrations } from './registration';
import type { CollectionTokenBase, TokenBase } from './tokens';
import type { SelectionKey, TokenDependencyContract, TokenValue, ValidToken, WrongToken } from './token-types';
import type { CollectionMember } from './contribution-types';
import type { Singleton, Unsatisfied } from './types';

export type AliasSelection = string | TokenBase;
export type AliasAdmission<T> = Singleton<T> extends true ? unknown : ValidToken<T> extends true ? unknown
  : Unsatisfied<'alias requires one singleton name or genuine token', {}>;
export { type AliasDestinationAdmission } from './token-types';
export type AliasTarget<R extends Registrations, C, T> = T extends string
  ? T extends keyof R ? unknown : Unsatisfied<'alias requires an existing named target', {}>
  : T extends CollectionTokenBase ? CollectionMember<T, C>
  : [WrongToken<T, R>] extends [never] ? unknown : Unsatisfied<'token dependency has an incompatible or opaque contract', {}>;
/**
 * Resolve the service type exposed by a possible alias target.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#give-a-dependency-another-lookup-name
 */
export type AliasOutput<R extends Registrations, T> = T extends string
  ? T extends keyof R ? ProviderOutput<R[T]> : never : TokenValue<T>;
export type AliasDestination<R extends Registrations, D, T> = D extends TokenBase
  ? [AliasOutput<R, T>] extends [TokenValue<D>] ? unknown
    : Unsatisfied<'alias output is not assignable to destination service', {}> : unknown;
// The synthetic needs retain replacement/completeness obligations. The marker
// tells lifetime walks to follow the target without adding a lifetime boundary.
/**
 * A provider contract that forwards a destination to a canonical target acquisition.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#give-a-dependency-another-lookup-name
 */
export type AliasRegistration<R extends Registrations, D, T> = Provider<
  (this: void, dependencies: T extends string ? Record<T, AliasOutput<R, T>> : Record<never, never>) => AliasOutput<R, T>,
  Readonly<object>, readonly unknown[],
  T extends CollectionTokenBase
    ? TokenDependencyContract<readonly [], D extends TokenBase ? D : never, readonly [], readonly [T]>
    : TokenDependencyContract<T extends TokenBase ? readonly [T] : readonly [], D extends TokenBase ? D : never> & { readonly alias: SelectionKey<T> },
  unknown
>;
/**
 * The single registration-map entry introduced by an alias operation.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#give-a-dependency-another-lookup-name
 */
export type AliasEntries<R extends Registrations, D, T> = Record<SelectionKey<D>, AliasRegistration<R, D, T>>;
/** Reflected generic methods cannot introduce a checked singleton destination. */
export type AliasEntry<R extends Registrations, D, T> = unknown extends AliasAdmission<D> & AliasAdmission<T>
  ? { key: SelectionKey<D>; registration: AliasRegistration<R, D, T> } : never;
