import type { TokenKeyAdmission } from './token-types';
declare const tokenInvariant: unique symbol;
/**
 * The common type-only base for genuine typed-token handles.
 * Create tokens through `DiBag.token`; fabricated structural values are not authenticated.
 */
declare class TokenBase {
    private readonly nominal;
}
/**
 * An immutable typed-token handle pairing a canonical symbol with an invariant service contract.
 * Create one with `DiBag.token(key).of<Service>()`.
 */
declare class Token<K extends symbol, S> extends TokenBase {
    readonly key: K;
    /** @internal */
    readonly [tokenInvariant]: (value: [K, S]) => [K, S];
    constructor(key: K);
}
/** Extract the canonical unique-symbol key from a typed token. */
export type TokenKey<T> = T extends infer U & {} ? U extends Token<infer K, infer _S> ? K : never : never;
/** Extract the invariant service contract declared by a typed token. */
export type TokenService<T> = T extends infer U & {} ? U extends Token<infer _K, infer S> ? S : never : never;
/**
 * Create a typed-token factory from the caller's canonical unique symbol.
 * Reusing the same key and service type produces compatible handles; copied or fabricated
 * objects are rejected at runtime.
 * @param key - An individually known unique symbol used as the runtime binding identity.
 * @returns An object whose `of<Service>()` method creates an immutable typed token.
 * @example
 * ```ts
 * const clockKey = Symbol('clock');
 * const clock = DiBag.token(clockKey).of<{ now(): number }>();
 * ```
 */
export declare function token<const K extends symbol>(key: K & TokenKeyAdmission<K>, ...invalid: [K] extends [never] ? [TokenKeyAdmission<K>] : []): {
    /**
     * Declare the invariant service contract carried by this token handle.
     * @typeParam S - The service type accepted by bindings and returned by resolution.
     * @returns A genuine immutable token paired with the canonical symbol key.
     */
    readonly of: <S>() => Token<K, S>;
};
/** A copied, proxied or fabricated shape cannot authenticate a token. */
export declare function readTokenKey(value: unknown): symbol;
export declare function snapshotTokens(value: unknown): readonly TokenBase[];
export type { Token, TokenBase };
