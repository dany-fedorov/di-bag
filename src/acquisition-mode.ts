import { libraryError } from './errors';
import type { LifecycleObservers } from './observers';
import type { SeeErrors, StructuralThenable, Unsatisfied } from './types';

/**
 * How an acquisition stage treats its returned value: configured classification,
 * the exact raw value, or an observed native Promise fulfillment.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#portable-mode
 */
export type AcquisitionMode = 'auto' | 'raw' | 'nativePromise';
/**
 * Portable facade configuration for `auto` acquisition stages.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#portable-mode
 */
export interface RuntimeOptions {
  /** Return true only for native Promises the host can observe without thenable assimilation. */
  readonly isNativePromise: (this: void, value: unknown) => boolean;
}
export interface RuntimeContext { readonly isNativePromise?: RuntimeOptions['isNativePromise']; readonly observers?: LifecycleObservers }
export const unconfigured: RuntimeContext = Object.freeze({});
export function runtimeContext(options: RuntimeOptions, previous: RuntimeContext = unconfigured): RuntimeContext {
  if (typeof options !== 'object' || options === null) throw libraryError('DI_BAG_INVALID_CONFIGURATION', 'withConfiguration runtime requires isNativePromise', { operation: 'withConfiguration' });
  const { isNativePromise } = options;
  if (typeof isNativePromise !== 'function') throw libraryError('DI_BAG_INVALID_CONFIGURATION', 'withConfiguration runtime requires isNativePromise', { operation: 'withConfiguration' });
  return Object.freeze({ ...previous, isNativePromise });
}
export type Acquired<O, M extends AcquisitionMode> = M extends 'raw' ? O : Awaited<O>;
export type ModeOptions<M extends AcquisitionMode, Default extends AcquisitionMode = 'auto'> = Default extends M
  ? { readonly acquisitionMode?: M } : { readonly acquisitionMode: M };
export type StageOptions<M extends AcquisitionMode> = 'auto' extends M
  ? [options?: { readonly acquisitionMode: M }] : [options: { readonly acquisitionMode: M }];
export type NativeOutput<O, M extends AcquisitionMode> = 'nativePromise' extends M
  ? [O] extends [Promise<unknown>] ? unknown : Unsatisfied<'nativePromise acquisition requires a Promise output', {}>
  : unknown;
/** Reject a structural thenable output when the stage would classify it automatically. */
export type AutoOutput<O, M extends AcquisitionMode> = 'auto' extends M
  ? true extends StructuralThenable<O>
    ? Unsatisfied<`factory output is a structural thenable; return a native Promise or select acquisitionMode raw or nativePromise${SeeErrors<'structural-thenable'>}`, {}>
    : unknown
  : unknown;
export function acquisitionMode(options: { readonly acquisitionMode?: AcquisitionMode } | undefined, fallback: AcquisitionMode = 'auto'): AcquisitionMode {
  if (options === undefined) return fallback;
  if (typeof options !== 'object' || options === null) throw libraryError('DI_BAG_INVALID_ACQUISITION_MODE', 'invalid acquisition options', { option: 'acquisitionMode' });
  const selected = options.acquisitionMode;
  const mode = selected === undefined ? fallback : selected;
  if (mode !== 'auto' && mode !== 'raw' && mode !== 'nativePromise') throw libraryError('DI_BAG_INVALID_ACQUISITION_MODE', 'invalid acquisitionMode: use auto, raw, or nativePromise', { option: 'acquisitionMode' });
  return mode;
}
/**
 * Read the host classifier through `process.getBuiltinModule` (Node, Bun, Deno). A call, not an
 * import, keeps `node:` specifiers out of the root entry's module graph for bundlers and browsers.
 */
function hostClassifier(): RuntimeOptions['isNativePromise'] | undefined {
  const host: unknown = (globalThis as { readonly process?: unknown }).process;
  if (typeof host !== 'object' || host === null) return undefined;
  const load: unknown = (host as { readonly getBuiltinModule?: unknown }).getBuiltinModule;
  if (typeof load !== 'function') return undefined;
  const types: unknown = Reflect.apply(load, host, ['node:util/types']);
  if (typeof types !== 'object' || types === null) return undefined;
  const { isPromise } = types as { readonly isPromise?: unknown };
  return typeof isPromise === 'function' ? isPromise as RuntimeOptions['isNativePromise'] : undefined;
}
/** Resolve the classifier when a graph first needs one; a configured classifier always wins. */
export function requireClassifier(context: RuntimeContext): RuntimeContext {
  if (context.isNativePromise) return context;
  const isNativePromise = hostClassifier();
  if (isNativePromise) return Object.freeze({ ...context, isNativePromise });
  throw libraryError('DI_BAG_CLASSIFIER_REQUIRED', 'this host has no process.getBuiltinModule; configure DiBag.withConfiguration({ runtime: { isNativePromise } }) or give each automatic registration an explicit acquisitionMode', { option: 'runtime.isNativePromise' });
}
