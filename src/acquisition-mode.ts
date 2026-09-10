import { libraryError } from './errors';
import type { LifecycleObservers } from './observers';
import type { Unsatisfied } from './types';

/**
 * How an acquisition stage treats its returned value: configured classification,
 * the exact raw value, or an observed native Promise fulfillment.
 */
export type AcquisitionMode = 'auto' | 'raw' | 'nativePromise';
/** Portable facade configuration for `auto` acquisition stages. */
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
export function acquisitionMode(options: { readonly acquisitionMode?: AcquisitionMode } | undefined, fallback: AcquisitionMode = 'auto'): AcquisitionMode {
  if (options === undefined) return fallback;
  if (typeof options !== 'object' || options === null) throw libraryError('DI_BAG_INVALID_ACQUISITION_MODE', 'invalid acquisition options', { option: 'acquisitionMode' });
  const selected = options.acquisitionMode;
  const mode = selected === undefined ? fallback : selected;
  if (mode !== 'auto' && mode !== 'raw' && mode !== 'nativePromise') throw libraryError('DI_BAG_INVALID_ACQUISITION_MODE', 'invalid acquisitionMode: use auto, raw, or nativePromise', { option: 'acquisitionMode' });
  return mode;
}
export function requireClassificationCapability(modes: Iterable<AcquisitionMode>, context: RuntimeContext): void {
  if (context.isNativePromise) return;
  for (const mode of modes) if (mode === 'auto') {
    throw libraryError('DI_BAG_CLASSIFIER_REQUIRED', 'Automatic acquisition classification requires DiBag.withConfiguration({ runtime }), di-bag/node, or explicit acquisitionMode options', { option: 'runtime.isNativePromise' });
  }
}
