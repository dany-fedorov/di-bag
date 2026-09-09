import { snapshotReferences } from './dependency-references';
import type { Dependency } from './dependency-references';
import { DiBagPluginError } from './errors';
import { createProvider, mapAsync, mapSync } from './provider';
import type { Provider } from './provider';
import { retainDescription, sourceDescription } from './provider-operations';
import type { Factory } from './registration';
import type { DependencyTupleAdmission, ReferenceGraph } from './token-types';

export type PluginAcquisition = 'raw' | 'native';
export type PluginPredicate<V> = (this: void, value: unknown) => value is V;
export interface PluginOptions<M extends PluginAcquisition, V> {
  readonly acquisition: M;
  readonly validate: PluginPredicate<V>;
}
export type PluginResult<T extends readonly Dependency[], V, M extends PluginAcquisition> = Provider<
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

function invalidDescriptor(reason: string): DiBagPluginError {
  return new DiBagPluginError('descriptor', reason);
}

function validateOptions<V>(value: unknown): { readonly acquisition: PluginAcquisition; readonly validate: PluginPredicate<V> } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('plugin requires acquisition and validate options');
  }
  if (!Object.hasOwn(value, 'acquisition')) throw new Error('plugin requires an acquisition mode');
  const acquisition = Reflect.get(value, 'acquisition');
  if (acquisition !== 'raw' && acquisition !== 'native') throw new Error('invalid plugin acquisition mode');
  if (!Object.hasOwn(value, 'validate')) throw new Error('plugin requires a validation predicate');
  const validate = Reflect.get(value, 'validate');
  if (typeof validate !== 'function') throw new Error('plugin validation predicate must be a function');
  return Object.freeze({ acquisition, validate: validate as PluginPredicate<V> });
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

/** Authenticate an unknown plugin descriptor at a declared dependency boundary. */
export function fromPlugin<const T extends readonly Dependency[], V, M extends PluginAcquisition>(
  dependencies: T & DependencyTupleAdmission<T>,
  plugin: unknown,
  options: PluginOptions<M, V>,
): PluginResult<T, V, M> {
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
      throw new DiBagPluginError('output', 'plugin output failed validation');
    }
    return value as V;
  };
  if (selected.acquisition === 'raw') {
    const source = createProvider<Factory, Readonly<{}>, readonly [], ReferenceGraph<T>, unknown>();
    retainDescription(source, sourceDescription(create, dispose, references.map(reference => reference.key), 'raw', false, references));
    return mapSync(source, project, { acquisition: 'raw' }) as unknown as PluginResult<T, V, M>;
  }
  const source = createProvider<() => Promise<unknown>, Readonly<{}>, readonly [], ReferenceGraph<T>, unknown>();
  retainDescription(source, sourceDescription(create, dispose, references.map(reference => reference.key), 'native', false, references));
  return mapAsync(source, project) as unknown as PluginResult<T, V, M>;
}
