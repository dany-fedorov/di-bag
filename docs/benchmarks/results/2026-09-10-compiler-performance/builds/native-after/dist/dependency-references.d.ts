import type { TokenBase, TokenService } from './tokens';
import type { TokenTupleAdmission, ValidToken } from './token-types';
declare const referenceInvariant: unique symbol;
declare class ReferenceBase {
    private readonly nominal;
}
declare class DependencyReference<T extends TokenBase, K extends 'optional' | 'lazy' | 'all'> extends ReferenceBase {
    readonly [referenceInvariant]: (value: [T, K]) => [T, K];
}
/** A positional dependency that yields the token service or `undefined` when unbound. */
export type OptionalReference<T extends TokenBase> = DependencyReference<T, 'optional'>;
/** A positional dependency that yields all contributions for a token as a readonly array. */
export type AllReference<T extends TokenBase> = DependencyReference<T, 'all'>;
/** A positional dependency that yields a function which resolves the token on demand. */
export type LazyReference<T extends TokenBase> = DependencyReference<T, 'lazy'>;
/** A typed token or one of the positional dependency-reference handles. */
export type Dependency = TokenBase | ReferenceBase;
type ReferenceParts<R> = R extends {
    readonly [referenceInvariant]: (...args: never[]) => [infer T extends TokenBase, infer K];
} ? [T, K] : never;
export type DependencyToken<R> = R extends TokenBase ? R : ReferenceParts<R>[0];
export type DependencyKind<R> = R extends TokenBase ? 'required' : ReferenceParts<R>[1];
export type DependencyValue<R> = R extends TokenBase ? TokenService<R> : ReferenceParts<R> extends [infer T, infer K] ? K extends 'optional' ? TokenService<T> | undefined : K extends 'lazy' ? () => TokenService<T> : K extends 'all' ? ReadonlyArray<TokenService<T>> : never : never;
export type ValidDependency<R> = [R] extends [never] ? false : ValidToken<R> extends true ? true : R extends ReferenceBase ? ValidToken<DependencyToken<R>> : false;
export interface ArgumentReference {
    readonly slot: symbol;
    readonly key: symbol;
    readonly kind: 'required' | 'optional' | 'lazy' | 'all';
}
/**
 * Describe a positional dependency that supplies `undefined` only when the token is unbound.
 * A present `undefined` value and acquisition failures remain present dependency results.
 * @param token - The genuine typed token to read optionally.
 * @returns An immutable reference accepted by positional provider adapters.
 */
export declare function optional<T extends TokenBase>(token: T & TokenTupleAdmission<readonly [T]>, ...invalid: [T] extends [never] ? [TokenTupleAdmission<readonly [T]>] : []): OptionalReference<T>;
/**
 * Describe a positional dependency supplied as an on-demand lookup function.
 * Each invocation follows the target lifetime and records its dependency edge then.
 * @param token - The genuine typed token to resolve lazily.
 * @returns An immutable lazy reference accepted by positional provider adapters.
 */
export declare function lazy<T extends TokenBase>(token: T & TokenTupleAdmission<readonly [T]>, ...invalid: [T] extends [never] ? [TokenTupleAdmission<readonly [T]>] : []): LazyReference<T>;
/**
 * Describe a positional dependency containing every contribution for a token.
 * @param token - The genuine collection token.
 * @returns An immutable reference that supplies a fresh frozen array, including when empty.
 */
export declare function all<T extends TokenBase>(token: T & TokenTupleAdmission<readonly [T]>, ...invalid: [T] extends [never] ? [TokenTupleAdmission<readonly [T]>] : []): AllReference<T>;
/** Indexed snapshots ignore tuple iterators and retain only authenticated records. */
export declare function snapshotReferences(value: unknown): readonly ArgumentReference[];
export {};
