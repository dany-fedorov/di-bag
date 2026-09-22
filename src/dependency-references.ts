import { libraryError } from './errors';
import { readToken, wrongTokenKind } from './tokens';
import type { TokenBase, TokenService } from './tokens';
import type { OptionalTokenAdmission, TokenTupleAdmission, TokenValue, ValidToken } from './token-types';

declare const referenceInvariant: unique symbol;
class ReferenceBase {
  declare private readonly nominal: void;
}
class DependencyHandle<T extends TokenBase, K extends 'optional' | 'lazy'> extends ReferenceBase {
  declare readonly [referenceInvariant]: (value: [T, K]) => [T, K];
}
/**
 * A positional dependency that yields the token service or `undefined` when unbound.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#declare-optional-and-lazy-dependencies
 */
export type OptionalDependency<T extends TokenBase> = DependencyHandle<T, 'optional'>;
/**
 * A positional dependency that yields a function which resolves the token on demand.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#declare-optional-and-lazy-dependencies
 */
export type LazyDependency<T extends TokenBase> = DependencyHandle<T, 'lazy'>;
/**
 * A typed token or one of the positional dependency-reference handles.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#adapt-classes-and-positional-functions
 */
export type DependencyReference = TokenBase | ReferenceBase;
// Extract invariant carriers through a covariant view of their return tuple.
type ReferenceParts<R> = R extends { readonly [referenceInvariant]: (...args: never[]) => [infer T extends TokenBase, infer K] } ? [T, K] : never;
export type DependencyToken<R> = R extends TokenBase ? R : ReferenceParts<R>[0];
export type DependencyKind<R> = R extends TokenBase ? 'required' : ReferenceParts<R>[1];
export type DependencyValue<R> = R extends TokenBase ? TokenValue<R>
  : ReferenceParts<R> extends [infer T, infer K] ? K extends 'optional' ? TokenService<T> | undefined
    : K extends 'lazy' ? () => TokenValue<T> : never : never;
export type ValidDependency<R> = [R] extends [never] ? false : ValidToken<R> extends true ? true
  : R extends ReferenceBase ? ValidToken<DependencyToken<R>> : false;

export interface ArgumentReference {
  readonly slot: symbol;
  readonly key: symbol;
  readonly kind: 'required' | 'optional' | 'lazy';
  readonly isCollection: boolean;
}
const references = new WeakMap<object, Readonly<{
  key: symbol;
  kind: 'required' | 'optional' | 'lazy';
  isCollection: boolean;
}>>();

function reference<T extends TokenBase, K extends 'optional' | 'lazy'>(token: T, kind: K): DependencyHandle<T, K> {
  const { key, kind: tokenKind } = readToken(token);
  const isCollection = tokenKind === 'collection';
  if (isCollection && kind === 'optional') {
    throw wrongTokenKind('optional', 'single-service', key);
  }
  const handle = new DependencyHandle<T, K>();
  references.set(handle, Object.freeze({
    key,
    kind,
    isCollection,
  }));
  Object.freeze(handle);
  return handle;
}

/**
 * Describe a positional dependency that supplies `undefined` only when the token is unbound.
 * A present `undefined` value and acquisition failures remain present dependency results.
 * @param token - The genuine typed token to read optionally.
 * @returns An immutable reference accepted by positional provider adapters.
 */
export function optional<T extends TokenBase>(token: T & TokenTupleAdmission<readonly [T]> & OptionalTokenAdmission<T>,
  ...invalid: [T] extends [never] ? [TokenTupleAdmission<readonly [T]>] : []
): OptionalDependency<T> { return reference<T, 'optional'>(token, 'optional'); }

/**
 * Describe a positional dependency supplied as an on-demand lookup function.
 * Each invocation follows the target lifetime and records its dependency edge then.
 * @param token - The genuine typed token to resolve lazily.
 * @returns An immutable lazy reference accepted by positional provider adapters.
 */
export function lazy<T extends TokenBase>(token: T & TokenTupleAdmission<readonly [T]>,
  ...invalid: [T] extends [never] ? [TokenTupleAdmission<readonly [T]>] : []
): LazyDependency<T> { return reference<T, 'lazy'>(token, 'lazy'); }

/** Indexed snapshots ignore tuple iterators and retain only authenticated records. */
export function snapshotReferences(value: unknown): readonly ArgumentReference[] {
  if (!Array.isArray(value)) {
    throw libraryError('DI_BAG_INVALID_TOKEN', 'tokens must be a tuple', {
      operation: 'token',
    });
  }
  const selected: unknown[] = [];
  const length = value.length;
  for (let index = 0; index < length; index++) selected[index] = value[index];
  return Object.freeze(selected.map(handle => {
    const retained = typeof handle === 'object' && handle !== null ? references.get(handle) : undefined;
    if (retained) {
      return Object.freeze({
        slot: Symbol('argument'),
        key: retained.key,
        kind: retained.kind,
        isCollection: retained.isCollection,
      });
    }
    const { key, kind } = readToken(handle);
    return Object.freeze({
      slot: Symbol('argument'),
      key,
      kind: 'required' as const,
      isCollection: kind === 'collection',
    });
  }));
}
