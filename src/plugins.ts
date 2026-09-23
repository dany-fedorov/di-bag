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
 * A synchronous predicate that admits an unknown plugin output as a service type.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#admit-an-application-selected-plugin
 */
export type PluginOutputValidator<V> = (this: void, pluginOutput: unknown) => pluginOutput is V;
/**
 * The provider contract produced by {@link DiBagApi.createProviderFromPlugin}.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#admit-an-application-selected-plugin
 */
export type PluginProvider<T extends readonly DependencyReference[], V, M extends PluginReturnKind> = Provider<
  () => M extends 'uninspected' ? V : Promise<Awaited<V>>,
  Readonly<{}>,
  readonly [],
  ReferenceGraph<T>,
  M extends 'uninspected' ? V : Awaited<V>
>;

type PluginDescriptor = {
  readonly apiVersion: 1;
  readonly create: (...dependencies: readonly unknown[]) => unknown;
  readonly dispose?: (value: unknown) => void | Promise<void>;
};

function invalidDescriptor(reason: string): DiBagPluginValidationError {
  return new DiBagPluginValidationError('descriptor', reason);
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

function createPluginProvider(options: unknown):
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
  const descriptor = validateDescriptor(bag.pluginDescriptor);
  const validate = bag.isValidPluginOutput as PluginOutputValidator<unknown>;
  const create: Factory = (dependencies: Record<symbol, unknown>) => Reflect.apply(
    descriptor.create, undefined, references.map(reference => Reflect.get(dependencies, reference.slot)),
  );
  const dispose = descriptor.dispose === undefined ? undefined : (value: never) => Reflect.apply(descriptor.dispose!, undefined, [value]);
  const project = (value: unknown): unknown => {
    if (Reflect.apply(validate, undefined, [value]) !== true) throw new DiBagPluginValidationError('output', 'plugin output failed validation');
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
