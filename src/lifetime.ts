import { libraryError, libraryTypeError } from './errors';
import type { Factory, Registration } from './registration';
import { createProvider } from './provider';
import type { Provider, ProviderBase, ProviderFactory, RetainedMetadata, ProviderAcquisitionMetadata, ProviderGraphContract, ProviderAcquiredValue } from './provider';
import { describe, retainDescription } from './provider-operations';
import { snapshotOptionsBag } from './options-bag';
import type { GraphContract } from './token-types';
import type { Singleton, Unsatisfied } from './types';

/**
 * Cache at the ownership-family root, once per scope, or once per resolution.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#choose-root-scoped-or-transient-caching
 */
export type Lifetime = 'singleton:one-per-container-tree' | 'scoped:one-per-container' | 'transient:one-per-resolve';
export type LifetimeKind = 'singleton' | 'scoped' | 'transient';
type LegacyLifetime = 'root' | 'scoped' | 'transient';
type LegacyInvalidOption<L, O> = O extends infer Candidate & {} ? Candidate extends unknown ? Exclude<keyof Candidate, 'allowScopedDependencies'> extends never
  ? L extends 'root' ? Candidate extends { readonly allowScopedDependencies?: boolean } ? never : true
    : 'allowScopedDependencies' extends keyof Candidate ? true : never
  : true : never : never;
type LegacyOptionsAdmission<L, O> = [LegacyInvalidOption<L, O>] extends [never] ? unknown
  : Unsatisfied<'withLifetime allowScopedDependencies requires root lifetime and a boolean value', {}>;
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
  : Unsatisfied<'withLifetime allowsScopedDependencies requires singleton lifetime and a boolean value', {}>;
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
type LegacyLifetimeValue<SelectedLifetime extends LegacyLifetime> =
  SelectedLifetime extends 'root' ? 'singleton:one-per-container-tree'
  : SelectedLifetime extends 'scoped' ? 'scoped:one-per-container'
  : 'transient:one-per-resolve';
type LegacyOptions<Options> = Options extends { readonly allowScopedDependencies: infer Allowed }
  ? { readonly allowsScopedDependencies: Allowed }
  : Options;

/**
 * Select family-root caching, per-scope caching, or a fresh owned attempt per read.
 * Strict roots cannot capture scoped dependencies. Wrapping preserves the factory,
 * acquired value, metadata, frames, and ownership stages.
 * @param registration - The registration whose caching policy to replace.
 * @param lifetime - An individually known `root`, `scoped`, or `transient` literal.
 * @returns A provider with the selected lifetime policy.
 */
export function withLifetime<R extends Registration, const L extends LegacyLifetime>(
  registration: R & Registration,
  lifetime: L & (Singleton<L> extends true ? unknown : Unsatisfied<'lifetime requires an individually known policy literal', {}>),
): Provider<ProviderFactory<R>, RetainedMetadata<R>, ProviderAcquisitionMetadata<R>, LifetimeGraph<ProviderGraphContract<R>, LegacyLifetimeValue<L>, undefined>, ProviderAcquiredValue<R>>;
/**
 * Select a lifetime and optionally permit a root provider to capture scoped dependencies.
 * @param registration - The registration whose caching policy to replace.
 * @param lifetime - An individually known `root`, `scoped`, or `transient` literal.
 * @param options - Root-only `{ allowScopedDependencies: boolean }` admission.
 * @returns A provider preserving factory, output, metadata, frames, and ownership stages.
 */
export function withLifetime<R extends Registration, const L extends LegacyLifetime, const O extends object | undefined>(
  registration: R & Registration,
  lifetime: L & (Singleton<L> extends true ? unknown : Unsatisfied<'lifetime requires an individually known policy literal', {}>),
  options: O & LegacyOptionsAdmission<NoInfer<L>, NoInfer<O>>,
): Provider<ProviderFactory<R>, RetainedMetadata<R>, ProviderAcquisitionMetadata<R>, LifetimeGraph<ProviderGraphContract<R>, LegacyLifetimeValue<L>, LegacyOptions<O>>, ProviderAcquiredValue<R>>;
export function withLifetime(registration: Registration, lifetime: LegacyLifetime, options?: object): ProviderBase {
  return selectLegacyLifetime(registration, lifetime, options);
}

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

/** @internal compatibility used only until Task 6 removes the facade. */
function selectLegacyLifetime(registration: Registration, lifetime: LegacyLifetime, options?: unknown): ProviderBase {
  if (lifetime !== 'root' && lifetime !== 'scoped' && lifetime !== 'transient') throw libraryError('DI_BAG_INVALID_LIFETIME', 'invalid lifetime policy', { operation: 'withLifetime', lifetime });
  if (options !== undefined && (typeof options !== 'object' || options === null || Array.isArray(options))) throw libraryError('DI_BAG_INVALID_LIFETIME', 'invalid lifetime options', { operation: 'withLifetime', lifetime });
  const keys = options === undefined ? [] : Reflect.ownKeys(options);
  if (keys.some(key => key !== 'allowScopedDependencies') || (options !== undefined && 'allowScopedDependencies' in options && !Object.hasOwn(options, 'allowScopedDependencies'))) throw libraryError('DI_BAG_INVALID_LIFETIME', 'invalid lifetime options', { operation: 'withLifetime', lifetime });
  if (keys.length && lifetime !== 'root') throw libraryError('DI_BAG_INVALID_LIFETIME', 'withLifetime allowScopedDependencies requires root lifetime', { operation: 'withLifetime', lifetime });
  const allowed = keys.length ? Reflect.get(options as object, 'allowScopedDependencies') : false;
  if (typeof allowed !== 'boolean') throw libraryError('DI_BAG_INVALID_LIFETIME', 'withLifetime allowScopedDependencies must be boolean', { operation: 'withLifetime', lifetime });
  const translated = lifetime === 'root' ? 'singleton:one-per-container-tree'
    : lifetime === 'scoped' ? 'scoped:one-per-container'
    : 'transient:one-per-resolve';
  const translatedOptions = keys.length ? { allowsScopedDependencies: allowed } : undefined;
  return selectLifetime(compatibilityProvider(registration, 'withLifetime'), translated, translatedOptions);
}

/** @internal expand-only bridge; delete with FactoryWithDisposal in Task 6. */
function compatibilityProvider(registration: Registration, operation: string): ProviderBase {
  if (typeof registration === 'function') {
    const handle = createProvider<Factory, object, readonly unknown[], GraphContract, unknown>();
    retainDescription(handle, describe(registration, operation));
    return handle;
  }
  describe(registration, operation);
  return registration as ProviderBase;
}
