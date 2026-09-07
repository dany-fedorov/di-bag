import { readTokenKey } from './tokens';
import type { TokenBase, TokenService } from './tokens';
import type { TokenTupleAdmission, ValidToken } from './token-types';

declare const referenceInvariant: unique symbol;
class ReferenceBase {
  declare private readonly nominal: void;
}
class DependencyReference<T extends TokenBase, K extends 'optional' | 'lazy' | 'all'> extends ReferenceBase {
  declare readonly [referenceInvariant]: (value: [T, K]) => [T, K];
}
export type OptionalReference<T extends TokenBase> = DependencyReference<T, 'optional'>;
export type AllReference<T extends TokenBase> = DependencyReference<T, 'all'>;
export type LazyReference<T extends TokenBase> = DependencyReference<T, 'lazy'>;
export type Dependency = TokenBase | ReferenceBase;
// Extract invariant carriers through a covariant view of their return tuple.
type ReferenceParts<R> = R extends { readonly [referenceInvariant]: (...args: never[]) => [infer T extends TokenBase, infer K] } ? [T, K] : never;
export type DependencyToken<R> = R extends TokenBase ? R : ReferenceParts<R>[0];
export type DependencyKind<R> = R extends TokenBase ? 'required' : ReferenceParts<R>[1];
export type DependencyValue<R> = R extends TokenBase ? TokenService<R>
  : ReferenceParts<R> extends [infer T, infer K] ? K extends 'optional' ? TokenService<T> | undefined
    : K extends 'lazy' ? () => TokenService<T> : K extends 'all' ? ReadonlyArray<TokenService<T>> : never : never;
export type ValidDependency<R> = [R] extends [never] ? false : ValidToken<R> extends true ? true
  : R extends ReferenceBase ? ValidToken<DependencyToken<R>> : false;

export interface ArgumentReference {
  readonly slot: symbol;
  readonly key: symbol;
  readonly kind: 'required' | 'optional' | 'lazy' | 'all';
}
const references = new WeakMap<object, Readonly<{ key: symbol; kind: 'optional' | 'lazy' | 'all' }>>();

function reference<T extends TokenBase, K extends 'optional' | 'lazy' | 'all'>(token: T, kind: K): DependencyReference<T, K> {
  const key = readTokenKey(token);
  const handle = new DependencyReference<T, K>();
  references.set(handle, Object.freeze({ key, kind }));
  Object.freeze(handle);
  return handle;
}

/** Supply undefined only when this token has no binding in the lexical graph. */
export function optional<T extends TokenBase>(token: T & TokenTupleAdmission<readonly [T]>,
  ...invalid: [T] extends [never] ? [TokenTupleAdmission<readonly [T]>] : []
): OptionalReference<T> { return reference<T, 'optional'>(token, 'optional'); }

/** Defer each dependency read within the capturing provider's acquisition. */
export function lazy<T extends TokenBase>(token: T & TokenTupleAdmission<readonly [T]>,
  ...invalid: [T] extends [never] ? [TokenTupleAdmission<readonly [T]>] : []
): LazyReference<T> { return reference<T, 'lazy'>(token, 'lazy'); }

/** Supply every present contributor, including an empty frozen array. */
export function all<T extends TokenBase>(token: T & TokenTupleAdmission<readonly [T]>,
  ...invalid: [T] extends [never] ? [TokenTupleAdmission<readonly [T]>] : []
): AllReference<T> { return reference<T, 'all'>(token, 'all'); }

/** Indexed snapshots ignore tuple iterators and retain only authenticated records. */
export function snapshotReferences(value: unknown): readonly ArgumentReference[] {
  if (!Array.isArray(value)) throw new Error('tokens must be a tuple');
  const selected: unknown[] = [];
  const length = value.length;
  for (let index = 0; index < length; index++) selected[index] = value[index];
  return Object.freeze(selected.map(handle => {
    const retained = typeof handle === 'object' && handle !== null ? references.get(handle) : undefined;
    return Object.freeze({ slot: Symbol('argument'), key: retained?.key ?? readTokenKey(handle), kind: retained?.kind ?? 'required' });
  }));
}
