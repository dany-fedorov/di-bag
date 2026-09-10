"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optional = optional;
exports.lazy = lazy;
exports.all = all;
exports.snapshotReferences = snapshotReferences;
const tokens_1 = require("./tokens");
class ReferenceBase {
}
class DependencyReference extends ReferenceBase {
}
const references = new WeakMap();
function reference(token, kind) {
    const key = (0, tokens_1.readTokenKey)(token);
    const handle = new DependencyReference();
    references.set(handle, Object.freeze({ key, kind }));
    Object.freeze(handle);
    return handle;
}
/**
 * Describe a positional dependency that supplies `undefined` only when the token is unbound.
 * A present `undefined` value and acquisition failures remain present dependency results.
 * @param token - The genuine typed token to read optionally.
 * @returns An immutable reference accepted by positional provider adapters.
 */
function optional(token, ...invalid) { return reference(token, 'optional'); }
/**
 * Describe a positional dependency supplied as an on-demand lookup function.
 * Each invocation follows the target lifetime and records its dependency edge then.
 * @param token - The genuine typed token to resolve lazily.
 * @returns An immutable lazy reference accepted by positional provider adapters.
 */
function lazy(token, ...invalid) { return reference(token, 'lazy'); }
/**
 * Describe a positional dependency containing every contribution for a token.
 * @param token - The genuine collection token.
 * @returns An immutable reference that supplies a fresh frozen array, including when empty.
 */
function all(token, ...invalid) { return reference(token, 'all'); }
/** Indexed snapshots ignore tuple iterators and retain only authenticated records. */
function snapshotReferences(value) {
    if (!Array.isArray(value))
        throw new Error('tokens must be a tuple');
    const selected = [];
    const length = value.length;
    for (let index = 0; index < length; index++)
        selected[index] = value[index];
    return Object.freeze(selected.map(handle => {
        const retained = typeof handle === 'object' && handle !== null ? references.get(handle) : undefined;
        return Object.freeze({ slot: Symbol('argument'), key: retained?.key ?? (0, tokens_1.readTokenKey)(handle), kind: retained?.kind ?? 'required' });
    }));
}
