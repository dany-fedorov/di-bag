import { libraryError } from './errors';
import type { LifecycleObservers } from './observers';
import type { IsAny, SeeErrors, StructuralThenable, Unsatisfied } from './types';

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
  readonly isNativePromise: (this: void, candidate: unknown) => boolean;
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
type PromiseOutput<O> = O extends infer T & {} ? T extends Promise<unknown> ? true : false : false;
/** Reject a Promise or thenable output where the helper declares the stage synchronous; `any` is exempt. */
export type SyncOutput<O> = IsAny<O> extends true ? unknown
  : true extends PromiseOutput<O> | StructuralThenable<O>
    ? Unsatisfied<`fromSyncFactory output must not be a Promise or thenable; use fromAsyncFactory for a Promise, or fromFactory with acquisitionMode raw to make the Promise object the service${SeeErrors<'portable-factory-output'>}`, {}>
    : unknown;
/** Require a Promise output where the helper declares the stage asynchronous. */
export type AsyncOutput<O> = [O] extends [Promise<unknown>] ? unknown
  : Unsatisfied<`fromAsyncFactory requires a Promise output; use fromSyncFactory for a synchronous value${SeeErrors<'portable-factory-output'>}`, {}>;
export function acquisitionMode(options: { readonly acquisitionMode?: AcquisitionMode } | undefined, fallback: AcquisitionMode = 'auto'): AcquisitionMode {
  if (options === undefined) return fallback;
  if (typeof options !== 'object' || options === null) throw libraryError('DI_BAG_INVALID_ACQUISITION_MODE', 'invalid acquisition options', { option: 'acquisitionMode' });
  const selected = options.acquisitionMode;
  const mode = selected === undefined ? fallback : selected;
  if (mode !== 'auto' && mode !== 'raw' && mode !== 'nativePromise') throw libraryError('DI_BAG_INVALID_ACQUISITION_MODE', 'invalid acquisitionMode: use auto, raw, or nativePromise', { option: 'acquisitionMode' });
  return mode;
}
/**
 * The root entry self-configures through `process.getBuiltinModule` (Node, Bun, Deno). A call,
 * not an import, keeps `node:` specifiers out of its module graph for bundlers and browsers.
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
export function resolveClassifier(context: RuntimeContext): RuntimeContext | undefined {
  if (context.isNativePromise) return context;
  const isNativePromise = hostClassifier();
  return isNativePromise ? Object.freeze({ ...context, isNativePromise }) : undefined;
}
const namedBindings = 8;
/** The graph has automatic stages and no classifier; `bindings` labels every such registration. */
export function classifierRequired(bindings: readonly string[]): Error {
  const sorted = [...bindings].sort();
  const shown = sorted.slice(0, namedBindings).map(label => JSON.stringify(label)).join(', ');
  const rest = sorted.length - Math.min(sorted.length, namedBindings);
  const count = sorted.length === 1 ? '1 registration uses' : `${sorted.length} registrations use`;
  return libraryError('DI_BAG_CLASSIFIER_REQUIRED', `this host has no process.getBuiltinModule; ${count} automatic acquisition: ${shown}${rest ? `, and ${rest} more` : ''}; use DiBag.fromSyncFactory or DiBag.fromAsyncFactory (or an explicit acquisitionMode) for each, or configure DiBag.withConfiguration({ runtime: { isNativePromise } })`, { option: 'runtime.isNativePromise', bindings: Object.freeze(sorted) });
}
