import { libraryError } from './errors';
import type { LifecycleObservers } from './observers';
import type { IsAny, SeeErrors, StructuralThenable, Unsatisfied } from './types';

/**
 * How an acquisition stage treats its returned value: configured classification,
 * the exact raw value, or an observed native Promise fulfillment.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#portable-mode
 */
export type FactoryReturnKind = 'auto-detect' | 'sync-value' | 'native-promise' | 'uninspected';
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
export type Acquired<Output, ReturnKind extends FactoryReturnKind> =
  ReturnKind extends 'sync-value' | 'uninspected' ? Output : Awaited<Output>;
export type ReturnKindOptions<ReturnKind extends FactoryReturnKind, Default extends FactoryReturnKind = 'auto-detect'> =
  Default extends ReturnKind ? { readonly factoryReturnKind?: ReturnKind } : { readonly factoryReturnKind: ReturnKind };
export type StageOptions<ReturnKind extends FactoryReturnKind> = 'auto-detect' extends ReturnKind
  ? [options?: { readonly factoryReturnKind: ReturnKind }] : [options: { readonly factoryReturnKind: ReturnKind }];
export type NativeOutput<Output, ReturnKind extends FactoryReturnKind> = 'native-promise' extends ReturnKind
  ? [Output] extends [Promise<unknown>] ? unknown : Unsatisfied<'native-promise factory return kind requires a Promise output', {}>
  : unknown;
export type AutoOutput<Output, ReturnKind extends FactoryReturnKind> = 'auto-detect' extends ReturnKind
  ? true extends StructuralThenable<Output>
    ? Unsatisfied<`factory output is a structural thenable; return a native Promise or select factoryReturnKind 'uninspected' or 'native-promise'${SeeErrors<'structural-thenable'>}`, {}>
    : unknown
  : unknown;
type PromiseOutput<Output> = Output extends infer Value & {} ? Value extends Promise<unknown> ? true : false : false;
export type SyncOutput<Output, ReturnKind extends FactoryReturnKind = 'sync-value'> = 'sync-value' extends ReturnKind
  ? IsAny<Output> extends true ? unknown
    : true extends PromiseOutput<Output> | StructuralThenable<Output>
      ? Unsatisfied<`sync-value output must not be a Promise or thenable; use factoryReturnKind 'native-promise' for a Promise, or 'uninspected' to make the Promise object the service${SeeErrors<'portable-factory-output'>}`, {}>
      : unknown
  : unknown;
export type AsyncOutput<Output> = [Output] extends [Promise<unknown>] ? unknown
  : Unsatisfied<`native-promise factory return kind requires a Promise output; use 'sync-value' for a synchronous value${SeeErrors<'portable-factory-output'>}`, {}>;

const returnKinds: readonly FactoryReturnKind[] = ['auto-detect', 'sync-value', 'native-promise', 'uninspected'];
export function factoryReturnKind(value: unknown, operation: string, fallback: FactoryReturnKind = 'auto-detect', argument = 'factoryReturnKind'): FactoryReturnKind {
  const selected = value === undefined ? fallback : value;
  if (!returnKinds.includes(selected as FactoryReturnKind)) throw libraryError(
    'DI_BAG_INVALID_ARGUMENT', `${operation} ${argument} must name a supported return policy`,
    { operation, argument, expected: "one of: 'auto-detect', 'sync-value', 'native-promise', 'uninspected'" },
  );
  return selected as FactoryReturnKind;
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
  return libraryError('DI_BAG_CLASSIFIER_REQUIRED', `this host has no process.getBuiltinModule; ${count} auto-detect factory return kind: ${shown}${rest ? `, and ${rest} more` : ''}; use DiBag.createProvider(factory, { factoryReturnKind: 'sync-value' }) or factoryReturnKind: 'native-promise' for each, or configure DiBag.withConfiguration({ runtime: { isNativePromise } })`, { option: 'runtime.isNativePromise', bindings: Object.freeze(sorted) });
}
