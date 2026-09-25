import { libraryTypeError } from './errors';
import type { Factory } from './registration';
import { createProvider } from './provider';
import type { ProviderBase } from './provider';
import { describe, retainDescription } from './provider-operations';
import { snapshotOptionsBag } from './options-bag';
import type { GraphContract } from './token-types';
import type { Singleton, Unsatisfied } from './types';

/**
 * Cache once per container tree, once per container, or once per resolution.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#choose-root-scoped-or-transient-caching
 */
export type Lifetime = 'singleton:one-per-container-tree' | 'scoped:one-per-container' | 'transient:one-per-resolve';
export type LifetimeKind = 'singleton' | 'scoped' | 'transient';
export interface LifetimePolicy {
  readonly kind: LifetimeKind;
  readonly allowsScopedDependencies: boolean;
}
export const publicLifetime = (kind: LifetimeKind): Lifetime => kind === 'singleton' ? 'singleton:one-per-container-tree' : kind === 'scoped' ? 'scoped:one-per-container' : 'transient:one-per-resolve';
export type LifetimeAdmission<SelectedLifetime> = Singleton<SelectedLifetime> extends true
  ? unknown
  : Unsatisfied<'lifetime requires an individually known policy literal', {}>;
type InvalidLifetimeOptions<SelectedLifetime, Options> = Options extends infer Candidate & {}
  ? Candidate extends unknown
    ? Exclude<keyof Candidate, 'allowsScopedDependencies'> extends never
      ? SelectedLifetime extends 'singleton:one-per-container-tree'
        ? Candidate extends { readonly allowsScopedDependencies?: boolean } ? never : true
        : 'allowsScopedDependencies' extends keyof Candidate ? true : never
      : true
    : never
  : never;
export type LifetimeOptions<SelectedLifetime, Options> = [InvalidLifetimeOptions<SelectedLifetime, Options>] extends [never]
  ? unknown
  : Unsatisfied<'providerWithLifetime allowsScopedDependencies requires singleton lifetime and a boolean value', {}>;
type LifetimeKindOf<SelectedLifetime extends Lifetime> =
  SelectedLifetime extends 'singleton:one-per-container-tree' ? 'singleton'
  : SelectedLifetime extends 'scoped:one-per-container' ? 'scoped'
  : 'transient';
export type LifetimeGraph<Graph extends GraphContract, SelectedLifetime extends Lifetime, Options> = Graph extends infer Candidate & {}
  ? Candidate extends GraphContract
    ? LifetimeKindOf<SelectedLifetime> extends 'scoped'
      ? 'lifetime' extends keyof Candidate ? Omit<Candidate, 'lifetime'> : Candidate
      : Omit<Candidate, 'lifetime'> & { readonly lifetime: {
          readonly kind: LifetimeKindOf<SelectedLifetime>;
          readonly allowsScopedDependencies: [Options] extends [{ readonly allowsScopedDependencies: true }] ? true : false;
        } }
    : never
  : never;
export function selectLifetime(provider: ProviderBase, lifetime: unknown, options?: unknown, operation = 'withLifetime'): ProviderBase {
  if (lifetime !== 'singleton:one-per-container-tree' && lifetime !== 'scoped:one-per-container' && lifetime !== 'transient:one-per-resolve') throw libraryTypeError('DI_BAG_INVALID_ARGUMENT', `${operation} lifetime must use a full lifetime value`, { operation, argument: 'lifetime', expected: "one of: 'singleton:one-per-container-tree', 'scoped:one-per-container', 'transient:one-per-resolve'" });
  const bag = options === undefined ? {} : snapshotOptionsBag(options, operation, [], ['allowsScopedDependencies']);
  if (Object.hasOwn(bag, 'allowsScopedDependencies') && lifetime !== 'singleton:one-per-container-tree') throw libraryTypeError('DI_BAG_INVALID_ARGUMENT', `${operation} allowsScopedDependencies is available only for singleton lifetime`, { operation, argument: 'allowsScopedDependencies', expected: "absent unless lifetime is 'singleton:one-per-container-tree'" });
  if (Object.hasOwn(bag, 'allowsScopedDependencies') && typeof bag.allowsScopedDependencies !== 'boolean') throw libraryTypeError('DI_BAG_INVALID_ARGUMENT', `${operation} allowsScopedDependencies must be boolean`, { operation, argument: 'allowsScopedDependencies', expected: 'a boolean' });
  const kind: LifetimeKind = lifetime === 'singleton:one-per-container-tree' ? 'singleton' : lifetime === 'scoped:one-per-container' ? 'scoped' : 'transient';
  const description = describe(provider);
  const handle = createProvider<Factory, object, readonly unknown[], GraphContract, unknown>();
  retainDescription(handle, Object.freeze({ ...description, lifetime: Object.freeze({ kind, allowsScopedDependencies: bag.allowsScopedDependencies === true }) }));
  return handle;
}
