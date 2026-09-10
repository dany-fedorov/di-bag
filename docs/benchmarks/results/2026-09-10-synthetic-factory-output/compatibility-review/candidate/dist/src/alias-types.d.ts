import type { Provider, ProviderOutput } from './provider';
import type { Registrations } from './registration';
import type { TokenBase, TokenService } from './tokens';
import type { SelectionKey, TokenGraph, ValidToken, WrongToken } from './token-types';
import type { Singleton, Unsatisfied } from './types';
export type AliasSelection = string | TokenBase;
export type AliasAdmission<T> = Singleton<T> extends true ? unknown : ValidToken<T> extends true ? unknown : Unsatisfied<'alias requires one singleton name or genuine token', {}>;
export type AliasTarget<R extends Registrations, T> = T extends string ? T extends keyof R ? unknown : Unsatisfied<'alias requires an existing named target', {}> : [WrongToken<T, R>] extends [never] ? unknown : Unsatisfied<'token dependency has an incompatible or opaque contract', {}>;
/** Resolve the service type exposed by a possible alias target. */
export type AliasOutput<R extends Registrations, T> = T extends string ? T extends keyof R ? ProviderOutput<R[T]> : never : TokenService<T>;
export type AliasDestination<R extends Registrations, D, T> = D extends TokenBase ? [AliasOutput<R, T>] extends [TokenService<D>] ? unknown : Unsatisfied<'alias output is not assignable to destination service', {}> : unknown;
/** A provider contract that forwards a destination to a canonical target acquisition. */
export type AliasRegistration<R extends Registrations, D, T> = Provider<(this: void, deps: T extends string ? Record<T, AliasOutput<R, T>> : Record<never, never>) => AliasOutput<R, T>, Readonly<object>, readonly unknown[], TokenGraph<T extends TokenBase ? readonly [T] : readonly [], D extends TokenBase ? D : never> & {
    readonly alias: SelectionKey<T>;
}, unknown>;
/** The single registration-map entry introduced by an alias operation. */
export type AliasEntries<R extends Registrations, D, T> = Record<SelectionKey<D>, AliasRegistration<R, D, T>>;
/** Reflected generic methods cannot introduce a checked singleton destination. */
export type AliasEntry<R extends Registrations, D, T> = unknown extends AliasAdmission<D> & AliasAdmission<T> ? {
    key: SelectionKey<D>;
    registration: AliasRegistration<R, D, T>;
} : never;
