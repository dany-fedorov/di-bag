"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.token = token;
exports.readTokenKey = readTokenKey;
exports.snapshotTokens = snapshotTokens;
/**
 * The common type-only base for genuine typed-token handles.
 * Create tokens through `DiBag.token`; fabricated structural values are not authenticated.
 */
class TokenBase {
}
/**
 * An immutable typed-token handle pairing a canonical symbol with an invariant service contract.
 * Create one with `DiBag.token(key).of<Service>()`.
 */
class Token extends TokenBase {
    key;
    constructor(key) {
        super();
        this.key = key;
    }
}
const keys = new WeakMap();
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
function token(key, 
// An uninhabited key is assignable to every intersection; arity rejects its
// explicit generic erasure without weakening ordinary key inference.
...invalid) {
    if (typeof key !== 'symbol')
        throw new Error('token key must be a symbol');
    return Object.freeze({ of: () => {
            const handle = new Token(key);
            keys.set(handle, key);
            Object.freeze(handle);
            return handle;
        } });
}
/** A copied, proxied or fabricated shape cannot authenticate a token. */
function readTokenKey(value) {
    if (typeof value !== 'object' || value === null)
        throw new Error('invalid token');
    const key = keys.get(value);
    if (key === undefined)
        throw new Error('invalid token');
    return key;
}
function snapshotTokens(value) {
    if (!Array.isArray(value))
        throw new Error('tokens must be a tuple');
    const selected = [];
    const length = value.length;
    for (let index = 0; index < length; index++)
        selected[index] = value[index];
    for (const handle of selected)
        readTokenKey(handle);
    return Object.freeze(selected);
}
