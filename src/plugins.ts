import { libraryError } from './errors';
import { snapshotReferences } from './dependency-references';
import type { DependencyReference } from './dependency-references';
import { DiBagPluginValidationError } from './errors';
import { createProvider, transformService } from './provider';
import type { Provider } from './provider';
import { retainDescription, sourceDescription } from './provider-operations';
import type { Factory } from './registration';
import type { DependencyTupleAdmission, ReferenceGraph } from './token-types';

/** The explicit output boundary used for an application-selected plugin. */
export type PluginAcquisitionMode = 'raw' | 'nativePromise';
/** A synchronous predicate that admits an unknown plugin output as a service type. */
export type PluginOutputValidator<V> = (this: void, value: unknown) => value is V;
/** Validation and acquisition choices for {@link DiBagApi.fromPlugin}. */
export interface PluginOptions<M extends PluginAcquisitionMode, V> {
  /** Preserve the exact result with `raw`, or await a genuine native Promise with `nativePromise`. */
  readonly acquisitionMode: M;
  /** Must synchronously return exactly `true` for acceptable output values. */
  readonly validate: PluginOutputValidator<V>;
}
/** The provider contract produced by {@link DiBagApi.fromPlugin}. */
export type PluginProvider<T extends readonly DependencyReference[], V, M extends PluginAcquisitionMode> = Provider<
  () => M extends 'raw' ? V : Promise<Awaited<V>>,
  Readonly<{}>,
  readonly [],
  ReferenceGraph<T>,
  M extends 'raw' ? V : Awaited<V>
>;

type PluginDescriptor = {
  readonly apiVersion: 1;
  readonly create: (...dependencies: readonly unknown[]) => unknown;
  readonly dispose?: (value: unknown) => void | Promise<void>;
};

function invalidDescriptor(reason: string): DiBagPluginValidationError {
  return new DiBagPluginValidationError('descriptor', reason);
}

function validateOptions<V>(value: unknown): { readonly acquisitionMode: PluginAcquisitionMode; readonly validate: PluginOutputValidator<V> } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw libraryError('DI_BAG_INVALID_PLUGIN_OPTIONS', 'fromPlugin requires acquisitionMode and validate options', { operation: 'fromPlugin' });
  }
  if (!Object.hasOwn(value, 'acquisitionMode')) throw libraryError('DI_BAG_INVALID_PLUGIN_OPTIONS', 'fromPlugin requires acquisitionMode', { operation: 'fromPlugin' });
  const acquisitionMode = Reflect.get(value, 'acquisitionMode');
  if (acquisitionMode !== 'raw' && acquisitionMode !== 'nativePromise') throw libraryError('DI_BAG_INVALID_PLUGIN_OPTIONS', 'fromPlugin acquisitionMode must be raw or nativePromise', { operation: 'fromPlugin' });
  if (!Object.hasOwn(value, 'validate')) throw libraryError('DI_BAG_INVALID_PLUGIN_OPTIONS', 'fromPlugin requires a validation predicate', { operation: 'fromPlugin' });
  const validate = Reflect.get(value, 'validate');
  if (typeof validate !== 'function') throw libraryError('DI_BAG_INVALID_PLUGIN_OPTIONS', 'fromPlugin validate must be a function', { operation: 'fromPlugin' });
  return Object.freeze({ acquisitionMode, validate: validate as PluginOutputValidator<V> });
}

function validateDescriptor(value: unknown): PluginDescriptor {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalidDescriptor('plugin descriptor must be a non-array object');
  }
  if (!Object.hasOwn(value, 'apiVersion')) throw invalidDescriptor('plugin descriptor requires own apiVersion');
  if (Reflect.get(value, 'apiVersion') !== 1) throw invalidDescriptor('plugin apiVersion must be 1');
  if (!Object.hasOwn(value, 'create')) throw invalidDescriptor('plugin descriptor requires own create');
  const create = Reflect.get(value, 'create');
  if (typeof create !== 'function') throw invalidDescriptor('plugin create must be a function');
  if (!Object.hasOwn(value, 'dispose')) return Object.freeze({ apiVersion: 1, create });
  const dispose = Reflect.get(value, 'dispose');
  if (typeof dispose !== 'function') throw invalidDescriptor('plugin dispose must be a function when present');
  return Object.freeze({ apiVersion: 1, create, dispose });
}

/**
 * Validate an unknown plugin descriptor and its output at a declared dependency boundary.
 * The descriptor must have own `apiVersion: 1` and callable `create`, with an optional
 * callable `dispose`. A disposer owns the original acquired value before validation.
 * @param dependencies - Host values supplied to the plugin in positional order.
 * @param plugin - The application-selected unknown descriptor.
 * @param options - Required raw/nativePromise acquisition and a synchronous output predicate.
 * @returns A lazy provider that validates its output when acquired.
 * @throws {@link DiBagPluginValidationError} for an invalid descriptor or rejected output.
 */
function createPluginProvider<const T extends readonly DependencyReference[], V, M extends PluginAcquisitionMode>(
  dependencies: T & DependencyTupleAdmission<T>,
  plugin: unknown,
  options: PluginOptions<M, V>,
): PluginProvider<T, V, M> {
  const references = snapshotReferences(dependencies);
  const selected = validateOptions<V>(options);
  const descriptor = validateDescriptor(plugin);
  const create: Factory = (deps: Record<symbol, unknown>) => Reflect.apply(
    descriptor.create,
    undefined,
    references.map(reference => Reflect.get(deps, reference.slot)),
  );
  const dispose = descriptor.dispose === undefined ? undefined : (value: never) =>
    Reflect.apply(descriptor.dispose!, undefined, [value]);
  const project = (value: unknown): V => {
    if (Reflect.apply(selected.validate, undefined, [value]) !== true) {
      throw new DiBagPluginValidationError('output', 'plugin output failed validation');
    }
    return value as V;
  };
  if (selected.acquisitionMode === 'raw') {
    const source = createProvider<Factory, Readonly<{}>, readonly [], ReferenceGraph<T>, unknown>();
    retainDescription(source, sourceDescription(create, dispose, references.map(reference => reference.key), 'raw', false, references));
    return transformService(source, { mode: 'direct', transform: project, acquisitionMode: 'raw' }) as unknown as PluginProvider<T, V, M>;
  }
  const source = createProvider<() => Promise<unknown>, Readonly<{}>, readonly [], ReferenceGraph<T>, unknown>();
  retainDescription(source, sourceDescription(create, dispose, references.map(reference => reference.key), 'nativePromise', false, references));
  return transformService(source, { mode: 'awaited', transform: project }) as unknown as PluginProvider<T, V, M>;
}

/**
 * Callable checked plugin adapter exposed by DiBag.fromPlugin.
 * The descriptor must have own `apiVersion: 1` and callable `create`, with an optional
 * callable `dispose`. A disposer owns the original acquired value before validation.
 * The named call signature keeps extracted methods nameable in consumer declarations.
 * @param dependencies - Host values supplied to the plugin in positional order.
 * @param plugin - The application-selected unknown descriptor.
 * @param options - Required raw/nativePromise acquisition and a synchronous output predicate.
 * @returns A lazy provider that validates its output when acquired.
 * @throws {@link DiBagPluginValidationError} for an invalid descriptor or rejected output.
 * @typeParam T - The exact positional dependency-reference tuple.
 * @typeParam V - The service admitted by the synchronous output validator.
 * @typeParam M - The raw or nativePromise plugin acquisition policy.
 */
export type PluginProviderFactory = <const T extends readonly DependencyReference[], V, M extends PluginAcquisitionMode>(
  dependencies: T & DependencyTupleAdmission<T>,
  plugin: unknown,
  options: PluginOptions<M, V>,
) => PluginProvider<T, V, M>;

// Both signatures retain the same tuple admission and invariant provider result.
// Generic assignability otherwise re-infers T as T & DependencyTupleAdmission<T>,
// applying admission twice. Name the public callable without widening either contract.
export const fromPlugin: PluginProviderFactory = createPluginProvider as PluginProviderFactory;
