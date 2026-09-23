import { libraryError } from './errors';
import { snapshotReferences } from './dependency-references';
import type { DependencyReference } from './dependency-references';
import { DiBagPluginValidationError } from './errors';
import { createProvider, transformService } from './provider';
import type { Provider } from './provider';
import { retainDescription, sourceDescription } from './provider-operations';
import type { Factory } from './registration';
import type { DependencyTupleAdmission, ReferenceGraph } from './token-types';
import { snapshotOptionsBag } from './options-bag';

/** The explicit return policy for the new plugin provider constructor. */
export type PluginReturnKind = 'uninspected' | 'native-promise';

/** Options for a versioned plugin descriptor and a synchronous output predicate. */
export interface CreateProviderFromPluginOptions<
  ReturnKind extends PluginReturnKind,
  Service,
  Dependencies extends readonly DependencyReference[] = readonly DependencyReference[],
> {
  readonly dependencies: Dependencies;
  readonly pluginDescriptor: unknown;
  readonly isValidPluginOutput: PluginOutputValidator<Service>;
  readonly factoryReturnKind: ReturnKind;
}

/** Callable adapter for a plugin descriptor with a finite dependency tuple. */
export type CreateProviderFromPlugin = <
  const Dependencies extends readonly DependencyReference[],
  Service,
  ReturnKind extends PluginReturnKind,
>(options: CreateProviderFromPluginOptions<ReturnKind, Service, Dependencies> & {
  readonly dependencies: Dependencies & DependencyTupleAdmission<Dependencies>;
}) => PluginProvider<Dependencies, Service, ReturnKind>;

/**
 * The explicit output boundary used for an application-selected plugin.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#admit-an-application-selected-plugin
 * @deprecated Use FactoryReturnKind.
 */
export type PluginAcquisitionMode = 'raw' | 'nativePromise';
/**
 * A synchronous predicate that admits an unknown plugin output as a service type.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#admit-an-application-selected-plugin
 */
export type PluginOutputValidator<V> = (this: void, pluginOutput: unknown) => pluginOutput is V;
/**
 * Validation and acquisition choices for {@link DiBagApi.fromPlugin}.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#admit-an-application-selected-plugin
 * @deprecated Use CreateProviderFromPluginOptions.
 */
export interface PluginOptions<M extends PluginAcquisitionMode, V> {
  /** Preserve the exact result with `raw`, or await a genuine native Promise with `nativePromise`. */
  readonly acquisitionMode: M;
  /** Must synchronously return exactly `true` for acceptable output values. */
  readonly validate: PluginOutputValidator<V>;
}
/**
 * The provider contract produced by {@link DiBagApi.fromPlugin}.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#admit-an-application-selected-plugin
 */
export type PluginProvider<T extends readonly DependencyReference[], V, M extends PluginReturnKind | PluginAcquisitionMode> = Provider<
  () => M extends 'raw' | 'uninspected' ? V : Promise<Awaited<V>>,
  Readonly<{}>,
  readonly [],
  ReferenceGraph<T>,
  M extends 'raw' | 'uninspected' ? V : Awaited<V>
>;

type PluginDescriptor = {
  readonly apiVersion: 1;
  readonly create: (...dependencies: readonly unknown[]) => unknown;
  readonly dispose?: (value: unknown) => void | Promise<void>;
};

function invalidDescriptor(reason: string, operation: 'fromPlugin' | 'createProviderFromPlugin' = 'fromPlugin'): DiBagPluginValidationError {
  return new DiBagPluginValidationError('descriptor', reason, operation);
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

function validateDescriptor(value: unknown, operation: 'fromPlugin' | 'createProviderFromPlugin' = 'fromPlugin'): PluginDescriptor {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalidDescriptor('plugin descriptor must be a non-array object', operation);
  }
  if (!Object.hasOwn(value, 'apiVersion')) throw invalidDescriptor('plugin descriptor requires own apiVersion', operation);
  if (Reflect.get(value, 'apiVersion') !== 1) throw invalidDescriptor('plugin apiVersion must be 1', operation);
  if (!Object.hasOwn(value, 'create')) throw invalidDescriptor('plugin descriptor requires own create', operation);
  const create = Reflect.get(value, 'create');
  if (typeof create !== 'function') throw invalidDescriptor('plugin create must be a function', operation);
  if (!Object.hasOwn(value, 'dispose')) return Object.freeze({ apiVersion: 1, create });
  const dispose = Reflect.get(value, 'dispose');
  if (typeof dispose !== 'function') throw invalidDescriptor('plugin dispose must be a function when present', operation);
  return Object.freeze({ apiVersion: 1, create, dispose });
}

function createPluginProvider(options: unknown, operation: 'fromPlugin' | 'createProviderFromPlugin' = 'createProviderFromPlugin'):
  PluginProvider<readonly DependencyReference[], unknown, PluginReturnKind> {
  const bag = snapshotOptionsBag(options, 'createProviderFromPlugin', [
    'dependencies', 'pluginDescriptor', 'isValidPluginOutput', 'factoryReturnKind',
  ]);
  if (!Array.isArray(bag.dependencies)) throw libraryError(
    'DI_BAG_INVALID_ARGUMENT', 'createProviderFromPlugin dependencies must be an array',
    { operation: 'createProviderFromPlugin', argument: 'dependencies', expected: 'an array' },
  );
  const references = snapshotReferences(bag.dependencies);
  if (bag.factoryReturnKind !== 'uninspected' && bag.factoryReturnKind !== 'native-promise') throw libraryError(
    'DI_BAG_INVALID_ARGUMENT', 'createProviderFromPlugin factoryReturnKind must be explicit',
    { operation: 'createProviderFromPlugin', argument: 'factoryReturnKind', expected: "one of: 'uninspected', 'native-promise'" },
  );
  if (typeof bag.isValidPluginOutput !== 'function') throw libraryError(
    'DI_BAG_INVALID_ARGUMENT', 'createProviderFromPlugin requires an output predicate',
    { operation: 'createProviderFromPlugin', argument: 'isValidPluginOutput', expected: 'a function' },
  );
  const descriptor = validateDescriptor(bag.pluginDescriptor, operation);
  const validate = bag.isValidPluginOutput as PluginOutputValidator<unknown>;
  const create: Factory = (dependencies: Record<symbol, unknown>) => Reflect.apply(
    descriptor.create, undefined, references.map(reference => Reflect.get(dependencies, reference.slot)),
  );
  const dispose = descriptor.dispose === undefined ? undefined : (value: never) => Reflect.apply(descriptor.dispose!, undefined, [value]);
  const project = (value: unknown): unknown => {
    if (Reflect.apply(validate, undefined, [value]) !== true) throw new DiBagPluginValidationError('output', 'plugin output failed validation', operation);
    return value;
  };
  if (bag.factoryReturnKind === 'uninspected') {
    const source = createProvider<Factory, Readonly<{}>, readonly [], ReferenceGraph<readonly DependencyReference[]>, unknown>();
    retainDescription(source, sourceDescription(create, dispose, references.map(reference => reference.key), 'uninspected', false, references));
    return transformService(source, { mode: 'direct', transform: project, acquisitionMode: 'uninspected' }) as unknown as PluginProvider<readonly DependencyReference[], unknown, PluginReturnKind>;
  }
  const source = createProvider<() => Promise<unknown>, Readonly<{}>, readonly [], ReferenceGraph<readonly DependencyReference[]>, unknown>();
  retainDescription(source, sourceDescription(create, dispose, references.map(reference => reference.key), 'native-promise', false, references));
  return transformService(source, { mode: 'awaited', transform: project }) as unknown as PluginProvider<readonly DependencyReference[], unknown, PluginReturnKind>;
}

export const createProviderFromPlugin: CreateProviderFromPlugin = createPluginProvider as CreateProviderFromPlugin;

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
function legacyPluginProvider<const T extends readonly DependencyReference[], V, M extends PluginAcquisitionMode>(
  dependencies: T & DependencyTupleAdmission<T>,
  plugin: unknown,
  options: PluginOptions<M, V>,
): PluginProvider<T, V, M> {
  const references = snapshotReferences(dependencies);
  const selected = validateOptions<V>(options);
  const descriptor = validateDescriptor(plugin);
  const create: Factory = (dependencyProxy: Record<symbol, unknown>) => Reflect.apply(
    descriptor.create,
    undefined,
    references.map(reference => Reflect.get(dependencyProxy, reference.slot)),
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
    retainDescription(source, sourceDescription(create, dispose, references.map(reference => reference.key), 'uninspected', false, references));
    return transformService(source, { mode: 'direct', transform: project, acquisitionMode: 'raw' }) as unknown as PluginProvider<T, V, M>;
  }
  const source = createProvider<() => Promise<unknown>, Readonly<{}>, readonly [], ReferenceGraph<T>, unknown>();
  retainDescription(source, sourceDescription(create, dispose, references.map(reference => reference.key), 'native-promise', false, references));
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
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#admit-an-application-selected-plugin
 * @deprecated Use CreateProviderFromPlugin.
 */
export type PluginProviderFactory = <const T extends readonly DependencyReference[], V, M extends PluginAcquisitionMode>(
  dependencies: T & DependencyTupleAdmission<T>,
  plugin: unknown,
  options: PluginOptions<M, V>,
) => PluginProvider<T, V, M>;

// Both signatures retain the same tuple admission and invariant provider result.
// Generic assignability otherwise re-infers T as T & DependencyTupleAdmission<T>,
// applying admission twice. Name the public callable without widening either contract.
export const fromPlugin: PluginProviderFactory = legacyPluginProvider as PluginProviderFactory;
