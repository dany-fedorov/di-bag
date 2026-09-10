import { libraryError } from './errors';
import type { Factory, Registration } from './registration';
import { createProvider } from './provider';
import type { Provider, ProviderFactory, RetainedMetadata, ProviderAcquisitionMetadata, ProviderGraphContract, ProviderAcquiredValue } from './provider';
import { describe, retainDescription } from './provider-operations';
import type { GraphContract } from './token-types';
import type { Singleton, Unsatisfied } from './types';

/** Cache at the ownership-family root, once per scope, or once per resolution. */
export type Lifetime = 'root' | 'scoped' | 'transient';
export interface LifetimePolicy {
  readonly kind: Lifetime;
  readonly allowScopedDependencies: boolean;
}
type Admission<L> = Singleton<L> extends true ? unknown : Unsatisfied<'lifetime requires an individually known policy literal', {}>;
type InvalidOption<L, O> = O extends infer T & {} ? T extends unknown ? Exclude<keyof T, 'allowScopedDependencies'> extends never
  ? L extends 'root' ? T extends { readonly allowScopedDependencies?: boolean } ? never : true
    : 'allowScopedDependencies' extends keyof T ? true : never
  : true : never : never;
type Options<L, O> = [InvalidOption<L, O>] extends [never] ? unknown : InvalidOptions;
type InvalidOptions = Unsatisfied<'withLifetime allowScopedDependencies requires root lifetime and a boolean value', {}>;
export type LifetimeGraph<G extends GraphContract, L extends Lifetime, O> = G extends infer T & {}
  ? T extends GraphContract ? L extends 'scoped' ? 'lifetime' extends keyof T ? Omit<T, 'lifetime'> : T
    : Omit<T, 'lifetime'> & { readonly lifetime: { readonly kind: L; readonly allowScopedDependencies: [O] extends [{ readonly allowScopedDependencies: true }] ? true : false } }
  : never : never;

/**
 * Select family-root caching, per-scope caching, or a fresh owned attempt per read.
 * Strict roots cannot capture scoped dependencies. Wrapping preserves the factory,
 * acquired value, metadata, frames, and ownership stages.
 * @param registration - The registration whose caching policy to replace.
 * @param lifetime - An individually known `root`, `scoped`, or `transient` literal.
 * @returns A provider with the selected lifetime policy.
 */
export function withLifetime<R extends Registration, const L extends Lifetime>(
  registration: R & Registration,
  lifetime: L & Admission<L>,
): Provider<ProviderFactory<R>, RetainedMetadata<R>, ProviderAcquisitionMetadata<R>, LifetimeGraph<ProviderGraphContract<R>, L, undefined>, ProviderAcquiredValue<R>>;
/**
 * Select a lifetime and optionally permit a root provider to capture scoped dependencies.
 * @param registration - The registration whose caching policy to replace.
 * @param lifetime - An individually known `root`, `scoped`, or `transient` literal.
 * @param options - Root-only `{ allowScopedDependencies: boolean }` admission.
 * @returns A provider preserving factory, output, metadata, frames, and ownership stages.
 */
export function withLifetime<R extends Registration, const L extends Lifetime, const O extends object | undefined>(
  registration: R & Registration,
  lifetime: L & Admission<L>,
  options: O & Options<NoInfer<L>, NoInfer<O>>,
): Provider<ProviderFactory<R>, RetainedMetadata<R>, ProviderAcquisitionMetadata<R>, LifetimeGraph<ProviderGraphContract<R>, L, O>, ProviderAcquiredValue<R>>;
export function withLifetime(registration: Registration, lifetime: Lifetime, options?: object): unknown {
  if (lifetime !== 'root' && lifetime !== 'scoped' && lifetime !== 'transient') throw libraryError('DI_BAG_INVALID_LIFETIME', 'invalid lifetime policy', { operation: 'withLifetime', lifetime });
  let allowScopedDependencies = false;
  if (options !== undefined) {
    if (typeof options !== 'object' || options === null || Array.isArray(options)) throw libraryError('DI_BAG_INVALID_LIFETIME', 'invalid lifetime options', { operation: 'withLifetime', lifetime });
    const keys = Reflect.ownKeys(options);
    if (keys.some(key => key !== 'allowScopedDependencies') || ('allowScopedDependencies' in options && !Object.hasOwn(options, 'allowScopedDependencies'))) throw libraryError('DI_BAG_INVALID_LIFETIME', 'invalid lifetime options', { operation: 'withLifetime', lifetime });
    if (keys.length) {
      if (lifetime !== 'root') throw libraryError('DI_BAG_INVALID_LIFETIME', 'withLifetime allowScopedDependencies requires root lifetime', { operation: 'withLifetime', lifetime });
      const selected: unknown = Reflect.get(options, 'allowScopedDependencies');
      if (typeof selected !== 'boolean') throw libraryError('DI_BAG_INVALID_LIFETIME', 'withLifetime allowScopedDependencies must be boolean', { operation: 'withLifetime', lifetime });
      allowScopedDependencies = selected;
    }
  }
  const policy = Object.freeze({ kind: lifetime, allowScopedDependencies });
  const description = describe(registration);
  const handle = createProvider<Factory, object, readonly unknown[], GraphContract, unknown>();
  retainDescription(handle, Object.freeze({ ...description, lifetime: policy }));
  return handle;
}
