import type { Observers } from './observers';
import type { Unsatisfied } from './types';

/**
 * How an acquisition stage treats its returned value: configured classification,
 * the exact raw value, or an observed native Promise fulfillment.
 */
export type AcquisitionMode = 'auto' | 'raw' | 'native';
/** Portable facade configuration for `auto` acquisition stages. */
export interface RuntimeOptions {
  /** Return true only for native Promises the host can observe without thenable assimilation. */
  readonly isNativePromise: (this: void, value: unknown) => boolean;
}
export interface RuntimeContext { readonly isNativePromise?: RuntimeOptions['isNativePromise']; readonly observers?: Observers }
export const unconfigured: RuntimeContext = Object.freeze({});
export function runtimeContext(options: RuntimeOptions, previous: RuntimeContext = unconfigured): RuntimeContext {
  if (typeof options !== 'object' || options === null) throw new Error('configuration requires isNativePromise');
  const { isNativePromise } = options;
  if (typeof isNativePromise !== 'function') throw new Error('configuration requires isNativePromise');
  return Object.freeze({ ...previous, isNativePromise });
}
export type Acquired<O, M extends AcquisitionMode> = M extends 'raw' ? O : Awaited<O>;
export type ModeOptions<M extends AcquisitionMode, Default extends AcquisitionMode = 'auto'> = Default extends M
  ? { readonly acquisition?: M } : { readonly acquisition: M };
export type StageOptions<M extends AcquisitionMode> = 'auto' extends M
  ? [options?: { readonly acquisition: M }] : [options: { readonly acquisition: M }];
export type NativeOutput<O, M extends AcquisitionMode> = 'native' extends M
  ? [O] extends [Promise<unknown>] ? unknown : Unsatisfied<'native acquisition requires a Promise output', {}>
  : unknown;
export function acquisitionMode(options: { readonly acquisition?: AcquisitionMode } | undefined, fallback: AcquisitionMode = 'auto'): AcquisitionMode {
  if (options === undefined) return fallback;
  if (typeof options !== 'object' || options === null) throw new Error('invalid acquisition options');
  const selected = options.acquisition;
  const mode = selected === undefined ? fallback : selected;
  if (mode !== 'auto' && mode !== 'raw' && mode !== 'native') throw new Error('invalid acquisition mode');
  return mode;
}
export function requireClassificationCapability(modes: Iterable<AcquisitionMode>, context: RuntimeContext): void {
  if (context.isNativePromise) return;
  for (const mode of modes) if (mode === 'auto') {
    throw new Error('Automatic acquisition classification requires DiBag.configure, di-bag/node, or explicit acquisition modes');
  }
}
