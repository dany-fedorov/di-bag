import type { TokenKeyAdmission } from './token-types';

declare const tokenInvariant: unique symbol;
class TokenBase {
  declare private readonly nominal: void;
}
class Token<K extends symbol, S> extends TokenBase {
  declare readonly [tokenInvariant]: (value: [K, S]) => [K, S];
  constructor(readonly key: K) { super(); }
}

export type TokenKey<T> = T extends infer U & {} ? U extends Token<infer K, infer _S> ? K : never : never;
export type TokenService<T> = T extends infer U & {} ? U extends Token<infer _K, infer S> ? S : never : never;
const keys = new WeakMap<TokenBase, symbol>();

/** Only the caller's canonical unique symbol can establish a typed identity. */
export function token<const K extends symbol>(
  key: K & TokenKeyAdmission<K>,
  // An uninhabited key is assignable to every intersection; arity rejects its
  // explicit generic erasure without weakening ordinary key inference.
  ...invalid: [K] extends [never] ? [TokenKeyAdmission<K>] : []
): { readonly of: <S>() => Token<K, S> } {
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
