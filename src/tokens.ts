import { libraryError, type DiBagDiagnostic } from './errors';
import type { TokenKeyAdmission } from './token-types';

declare const tokenInvariant: unique symbol;
declare const collectionTokenInvariant: unique symbol;
/**
 * The common type-only base for genuine typed-token handles.
 * Create tokens through `DiBag.token`; fabricated structural values are not authenticated.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#use-typed-tokens-for-explicit-positional-injection
 */
class TokenBase {
  declare private readonly nominal: void;
}
/**
 * An immutable typed-token handle pairing a canonical symbol with an invariant service contract.
 * Create one with `DiBag.token(key).of<Service>()`.
 * @typeParam TokenSymbol - The unique symbol that is this token's runtime identity.
 * @typeParam Service - The service type that bindings must produce and that resolution returns.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#use-typed-tokens-for-explicit-positional-injection
 */
class Token<TokenSymbol extends symbol, Service> extends TokenBase {
  /** @internal */
  declare readonly [tokenInvariant]: (value: [TokenSymbol, Service]) => [TokenSymbol, Service];
  readonly key: TokenSymbol;
  constructor(readonly symbol: TokenSymbol) { super(); this.key = symbol; }
}

/** The common type-only base for genuine collection-token handles. */
class CollectionTokenBase extends TokenBase {
  declare private readonly collectionNominal: void;
}
/**
 * An immutable typed-token handle pairing a canonical symbol with an invariant
 * collection item contract.
 * Create one with `DiBag.token(key).forCollectionOf<Item>()`.
 * @typeParam TokenSymbol - The unique symbol that is this token's runtime identity.
 * @typeParam Item - The item type accepted by contributions and returned in collection views.
 */
class CollectionToken<TokenSymbol extends symbol, Item> extends CollectionTokenBase {
  /** @internal */
  declare readonly [collectionTokenInvariant]:
    (value: [TokenSymbol, Item]) => [TokenSymbol, Item];
  readonly key: TokenSymbol;
  constructor(readonly symbol: TokenSymbol) {
    super();
    this.key = symbol;
  }
}

/**
 * Extract the canonical unique-symbol key from a typed token.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#use-typed-tokens-for-explicit-positional-injection
 */
export type TokenKey<T> = T extends infer U & {}
  ? U extends Token<infer K, infer _S>
    ? K
    : U extends CollectionToken<infer K, infer _Item> ? K : never
  : never;
/**
 * Extract the invariant service contract declared by a typed token.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#use-typed-tokens-for-explicit-positional-injection
 */
export type TokenService<T> = T extends infer U & {} ? U extends Token<infer _K, infer S> ? S : never : never;
/** Extract the invariant item contract declared by a collection token. */
export type CollectionItem<T> = T extends CollectionToken<infer _TokenSymbol, infer Item> ? Item : never;
/** The authenticated runtime channel carried by a typed-token handle. */
export type TokenKind = 'single-service' | 'collection';
const tokens = new WeakMap<TokenBase, Readonly<{ key: symbol; kind: TokenKind }>>();

/**
 * Create a typed-token factory from the caller's canonical unique symbol.
 * Reusing the same key and service type produces compatible handles; copied or fabricated
 * objects are rejected at runtime.
 * @param symbol - An individually known unique symbol used as the runtime binding identity.
 * @returns A factory whose `.forService<Service>()` creates a single-service token and whose `.forCollectionOf<Item>()` creates a collection token.
 * @example
 * ```ts
 * const clockKey = Symbol('clock');
 * const clock = DiBag.createToken(clockKey).forService<{ now(): number }>();
 * ```
 */
export function createToken<const TokenSymbol extends symbol>(
  symbol: TokenSymbol & TokenKeyAdmission<TokenSymbol>,
  // An uninhabited key is assignable to every intersection; arity rejects its
  // explicit generic erasure without weakening ordinary key inference.
  ...invalid: [TokenSymbol] extends [never] ? [TokenKeyAdmission<TokenSymbol>] : []
): {
  /** Declare the invariant service contract carried by this token handle. */
  readonly forService: <Service>() => Token<TokenSymbol, Service>;
  /**
   * Declare the invariant service contract carried by this token handle.
   * @typeParam S - The service type accepted by bindings and returned by resolution.
   * @returns A genuine immutable token paired with the canonical symbol key.
   * @deprecated Use forService.
   */
  readonly of: <Service>() => Token<TokenSymbol, Service>;
  /** Declare the invariant item contract carried by a collection token handle. */
  readonly forCollectionOf: <Item>() => CollectionToken<TokenSymbol, Item>;
} {
  if (typeof symbol !== 'symbol') throw libraryError('DI_BAG_INVALID_TOKEN', 'createToken symbol must be a symbol', { operation: 'createToken' });
  const forService = <Service>(): Token<TokenSymbol, Service> => {
    const handle = new Token<TokenSymbol, Service>(symbol);
    tokens.set(handle, Object.freeze({ key: symbol, kind: 'single-service' }));
    Object.freeze(handle);
    return handle;
  };
  return Object.freeze({
    forService,
    forCollectionOf: <Item>(): CollectionToken<TokenSymbol, Item> => {
      const handle = new CollectionToken<TokenSymbol, Item>(symbol);
      tokens.set(handle, Object.freeze({ key: symbol, kind: 'collection' }));
      Object.freeze(handle);
      return handle;
    },
    of: forService,
  });
}

/** @deprecated Use createToken. */
export function token<const TokenSymbol extends symbol>(
  symbol: TokenSymbol & TokenKeyAdmission<TokenSymbol>,
  ...invalid: [TokenSymbol] extends [never] ? [TokenKeyAdmission<TokenSymbol>] : []
): {
  /** Declare a legacy single-service token handle. */
  readonly of: <Service>() => Token<TokenSymbol, Service>;
  /** Declare a legacy collection token handle. */
  readonly forCollectionOf: <Item>() => CollectionToken<TokenSymbol, Item>;
} {
  if (typeof symbol !== 'symbol') throw libraryError(
    'DI_BAG_INVALID_TOKEN', 'token key must be a symbol', { operation: 'token' },
  );
  const factory = createToken<TokenSymbol>(symbol, ...invalid);
  return Object.freeze({
    of: factory.forService,
    forCollectionOf: factory.forCollectionOf,
  });
}

/** A copied, proxied or fabricated shape cannot authenticate a token. */
export function readToken(value: unknown): Readonly<{ key: symbol; kind: TokenKind }> {
  if (typeof value !== 'object' || value === null) throw libraryError('DI_BAG_INVALID_TOKEN', 'invalid token', { expected: 'genuine typed token' });
  const token = tokens.get(value as TokenBase);
  if (token === undefined) throw libraryError('DI_BAG_INVALID_TOKEN', 'invalid token', { expected: 'genuine typed token' });
  return token;
}

export function wrongTokenKind(operation: string, expectedKind: TokenKind, key: symbol): Error & DiBagDiagnostic {
  const receivedKind: TokenKind = expectedKind === 'collection' ? 'single-service' : 'collection';
  return libraryError('DI_BAG_WRONG_TOKEN_KIND', `${operation} requires a ${expectedKind} token, but ${String(key)} is a ${receivedKind} token`, { operation, expectedKind, receivedKind });
}

export function readSingleServiceKey(value: unknown, operation: string): symbol {
  const { key, kind } = readToken(value);
  if (kind === 'collection') throw wrongTokenKind(operation, 'single-service', key);
  return key;
}

export function readTokenKey(value: unknown): symbol {
  return readToken(value).key;
}

export function snapshotTokens(value: unknown): readonly TokenBase[] {
  if (!Array.isArray(value)) throw libraryError('DI_BAG_INVALID_TOKEN', 'tokens must be a tuple', { expected: 'finite token tuple' });
  const selected: TokenBase[] = [];
  const length = value.length;
  for (let index = 0; index < length; index++) selected[index] = value[index];
  for (const handle of selected) readTokenKey(handle);
  return Object.freeze(selected);
}

export type { CollectionToken, CollectionTokenBase, Token, TokenBase };
