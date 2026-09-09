import type { TokenKeyAdmission } from './token-types';

declare const tokenInvariant: unique symbol;
/**
 * The common type-only base for genuine typed-token handles.
 * Create tokens through `DiBag.token`; fabricated structural values are not authenticated.
 */
class TokenBase {
  declare private readonly nominal: void;
}
/**
 * An immutable typed-token handle pairing a canonical symbol with an invariant service contract.
 * Create one with `DiBag.token(key).of<Service>()`.
 */
class Token<K extends symbol, S> extends TokenBase {
  /** @internal */
  declare readonly [tokenInvariant]: (value: [K, S]) => [K, S];
  constructor(readonly key: K) { super(); }
}

/** Extract the canonical unique-symbol key from a typed token. */
export type TokenKey<T> = T extends infer U & {} ? U extends Token<infer K, infer _S> ? K : never : never;
/** Extract the invariant service contract declared by a typed token. */
export type TokenService<T> = T extends infer U & {} ? U extends Token<infer _K, infer S> ? S : never : never;
const keys = new WeakMap<TokenBase, symbol>();

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
export function token<const K extends symbol>(
  key: K & TokenKeyAdmission<K>,
  // An uninhabited key is assignable to every intersection; arity rejects its
  // explicit generic erasure without weakening ordinary key inference.
  ...invalid: [K] extends [never] ? [TokenKeyAdmission<K>] : []
): {
  /**
   * Declare the invariant service contract carried by this token handle.
   * @typeParam S - The service type accepted by bindings and returned by resolution.
   * @returns A genuine immutable token paired with the canonical symbol key.
   */
  readonly of: <S>() => Token<K, S>
} {
  if (typeof key !== 'symbol') throw new Error('token key must be a symbol');
  return Object.freeze({ of: <S>(): Token<K, S> => {
    const handle = new Token<K, S>(key);
    keys.set(handle, key);
    Object.freeze(handle);
    return handle;
  } });
}

/** A copied, proxied or fabricated shape cannot authenticate a token. */
export function readTokenKey(value: unknown): symbol {
  if (typeof value !== 'object' || value === null) throw new Error('invalid token');
  const key = keys.get(value as TokenBase);
  if (key === undefined) throw new Error('invalid token');
  return key;
}

export function snapshotTokens(value: unknown): readonly TokenBase[] {
  if (!Array.isArray(value)) throw new Error('tokens must be a tuple');
  const selected: TokenBase[] = [];
  const length = value.length;
  for (let index = 0; index < length; index++) selected[index] = value[index];
  for (const handle of selected) readTokenKey(handle);
  return Object.freeze(selected);
}

export type { Token, TokenBase };
