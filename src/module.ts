import { libraryError } from './errors';
import type { BindingDescription, BindingGraph, BindingId, BindingKey, BindingRef, GraphDescription } from './runtime';
import type { Registrations } from './registration';
import type { CurrentRequirementKeyAdmission, NeedConstraint, NewRequirementKeyAdmission, PublicRegistrations, Renamed, RenamedConstraints, RenamedProviders, RenamedRequirementConstraints, RenamedRequirementProviders, RenameKeys } from './module-types';
import { readSingleServiceKey } from './tokens';
import { snapshotOptionsBag } from './options-bag';

interface ModuleDescription {
  /** The sealed graph: every binding that was retained when the builder sealed. */
  readonly graph: GraphDescription;
  /** Public slot -> original local name. Factory parameter names never change. */
  readonly exports: ReadonlyMap<BindingKey, BindingKey>;
  /** Prefix for every non-exported binding label of an installation. */
  readonly label: string | undefined;
  /** Original local requirement -> current host key. */
  readonly requirementRenames: ReadonlyMap<string, string>;
}

/**
 * Options for {@link Builder.buildModule}.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#reuse-named-modules
 */
export interface ModuleOptions {
  /**
   * Name each installation's private bindings `<moduleLabel>/<key>` in error messages, cycle paths,
   * `graphSnapshot()`, and observer events. Nested labels compose: `outer/inner/key`.
   * Exported bindings keep their bare key.
   */
  readonly moduleLabel?: string;
}
const descriptions = new WeakMap<object, ModuleDescription>();
declare const moduleInvariant: unique symbol;

/**
 * A sealed, non-resolving module with private providers and selected public exports.
 * Create modules through {@link DiBagApi.createBuilder} and {@link Builder.buildModule}; this
 * type-only class has no public constructor.
 * @typeParam ExportedServices - The services this module exports, keyed by export name or token symbol.
 * @typeParam RequiredServices - The services the installing builder must provide.
 * @typeParam Constraints - The checks retained from the sealed graph and applied again at installation.
 * @typeParam PublicProviders - The provider contract of each export, as the installing builder sees it.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#reuse-named-modules
 */
class Module<ExportedServices extends object, RequiredServices extends object, Constraints extends NeedConstraint = never, PublicProviders extends Registrations = PublicRegistrations<ExportedServices>> {
  declare private readonly nominal: void;
  // Unexported symbol keeps all contracts invariant in emitted declarations too.
  /** @internal */
  declare readonly [moduleInvariant]: (value: [ExportedServices, RequiredServices, Constraints, PublicProviders]) => [ExportedServices, RequiredServices, Constraints, PublicProviders];

  constructor(description: ModuleDescription) {
    descriptions.set(this, {
      graph: description.graph,
      exports: new Map(description.exports),
      label: description.label,
      requirementRenames: new Map(description.requirementRenames),
    });
    Object.freeze(this);
  }

  /**
   * Return a module view with one string-named export renamed through an options object.
   * @param options - The current export and its noncolliding new name.
   * @returns A new sealed module, or the same instance when both names are equal.
   * @throws `DI_BAG_INVALID_ARGUMENT` for a malformed options object or export name, `DI_BAG_UNKNOWN_SERVICE_KEY` for an unknown current export.
   * @example
   * ```ts
   * const feature = DiBag.createBuilder().withServices({ service: () => 1 })
   *   .buildModule({ exportedServiceKeys: ['service'] });
   * const renamed = feature.withRenamedExport({ currentExportKey: 'service', newExportKey: 'featureService' });
   * ```
   */
  withRenamedExport<const CurrentExportKey extends string, const NewExportKey extends string>(
    options: {
      readonly currentExportKey: CurrentExportKey & RenameKeys<ExportedServices, CurrentExportKey, NewExportKey, 'withRenamedExport'>;
      readonly newExportKey: NewExportKey & RenameKeys<ExportedServices, CurrentExportKey, NewExportKey, 'withRenamedExport'>;
    },
  ): Module<Renamed<ExportedServices, CurrentExportKey, NewExportKey>, RequiredServices, RenamedConstraints<Constraints, CurrentExportKey, NewExportKey>, RenamedProviders<PublicProviders, CurrentExportKey, NewExportKey>> {
    const { currentExportKey, newExportKey } = snapshotOptionsBag(
      options, 'withRenamedExport', ['currentExportKey', 'newExportKey'],
    );
    const description = descriptions.get(this)!;
    if (typeof currentExportKey !== 'string') {
      throw libraryError('DI_BAG_INVALID_ARGUMENT', 'withRenamedExport requires an existing export', {
        operation: 'withRenamedExport', argument: 'currentExportKey', expected: 'a string', currentExportKey, newExportKey,
      });
    }
    if (!description.exports.has(currentExportKey)) {
      throw libraryError('DI_BAG_UNKNOWN_SERVICE_KEY', 'withRenamedExport requires an existing export', {
        operation: 'withRenamedExport', serviceKey: currentExportKey,
      });
    }
    if (typeof newExportKey !== 'string') {
      throw libraryError('DI_BAG_INVALID_ARGUMENT', 'withRenamedExport requires a string new export key', {
        operation: 'withRenamedExport', argument: 'newExportKey', expected: 'a string', currentExportKey, newExportKey,
      });
    }
    if (currentExportKey === newExportKey) return this as unknown as Module<Renamed<ExportedServices, CurrentExportKey, NewExportKey>, RequiredServices, RenamedConstraints<Constraints, CurrentExportKey, NewExportKey>, RenamedProviders<PublicProviders, CurrentExportKey, NewExportKey>>;
    if (description.exports.has(newExportKey)) {
      throw libraryError('DI_BAG_DUPLICATE_SERVICE_KEY', `duplicate export: ${newExportKey}`, {
        operation: 'withRenamedExport', currentExportKey, newExportKey, serviceKey: newExportKey,
      });
    }
    const exports = new Map(description.exports);
    const localName = exports.get(currentExportKey)!;
    exports.delete(currentExportKey);
    exports.set(newExportKey, localName);
    return new Module({ graph: description.graph, exports, label: description.label, requirementRenames: description.requirementRenames });
  }

  /**
   * Return a module view that asks its host for a requirement under a new name.
   * Factory parameter names and private bindings retain their lexical meaning.
   * @param options - The current requirement and its noncolliding new host key.
   * @returns A new sealed module, or this module when both keys are equal.
   * @throws `DI_BAG_INVALID_ARGUMENT` for malformed options; `DI_BAG_UNKNOWN_SERVICE_KEY`
   * for a known non-requirement; `DI_BAG_DUPLICATE_SERVICE_KEY` for a known collision.
   * @remarks Type checking rejects unknown requirements and all name collisions.
   * Runtime checks cover only facts available without executing a factory.
   * @example
   * ```ts
   * const feature = DiBag.createBuilder()
   *   .withServices({ answer: ({ config }: { config: number }) => config })
   *   .buildModule({ exportedServiceKeys: ['answer'] });
   * const app = DiBag.createBuilder()
   *   .withInstalledModules([feature.withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'featureConfig' })])
   *   .withServices({ featureConfig: () => 42 }).buildContainer();
   * console.log(app.resolve('answer'));
   * await app.close();
   * ```
   */
  withRenamedRequirement<const CurrentRequirementKey extends string, const NewRequirementKey extends string>(
    options: {
      readonly currentRequirementKey: CurrentRequirementKey & CurrentRequirementKeyAdmission<RequiredServices, CurrentRequirementKey>;
      readonly newRequirementKey: NewRequirementKey & NewRequirementKeyAdmission<ExportedServices, RequiredServices, CurrentRequirementKey, NewRequirementKey>;
    },
  ): Module<ExportedServices, Renamed<RequiredServices, CurrentRequirementKey, NewRequirementKey>, RenamedRequirementConstraints<Constraints, CurrentRequirementKey, NewRequirementKey>, RenamedRequirementProviders<PublicProviders, CurrentRequirementKey, NewRequirementKey>> {
    const { currentRequirementKey, newRequirementKey } = snapshotOptionsBag(
      options, 'withRenamedRequirement', ['currentRequirementKey', 'newRequirementKey'],
    );
    if (typeof currentRequirementKey !== 'string') {
      throw libraryError('DI_BAG_INVALID_ARGUMENT', 'withRenamedRequirement currentRequirementKey must be a string', {
        operation: 'withRenamedRequirement', argument: 'currentRequirementKey', expected: 'a string',
      });
    }
    if (typeof newRequirementKey !== 'string') {
      throw libraryError('DI_BAG_INVALID_ARGUMENT', 'withRenamedRequirement newRequirementKey must be a string', {
        operation: 'withRenamedRequirement', argument: 'newRequirementKey', expected: 'a string',
      });
    }
    const description = descriptions.get(this)!;
    const source = [...description.requirementRenames].find(([, hostKey]) => hostKey === currentRequirementKey)?.[0];
    if (description.exports.has(currentRequirementKey) || (description.requirementRenames.has(currentRequirementKey) && source === undefined)) {
      throw libraryError('DI_BAG_UNKNOWN_SERVICE_KEY', `withRenamedRequirement requires an existing requirement: ${currentRequirementKey}`, {
        operation: 'withRenamedRequirement', serviceKey: currentRequirementKey,
      });
    }
    if (currentRequirementKey === newRequirementKey) return this as never;
    if (description.exports.has(newRequirementKey) || [...description.requirementRenames].some(([original, hostKey]) => original !== source && hostKey === newRequirementKey)) {
      throw libraryError('DI_BAG_DUPLICATE_SERVICE_KEY', `duplicate service key: ${newRequirementKey}`, {
        operation: 'withRenamedRequirement', serviceKey: newRequirementKey,
      });
    }
    const requirementRenames = new Map(description.requirementRenames);
    requirementRenames.set(source ?? currentRequirementKey, newRequirementKey);
    return new Module({ graph: description.graph, exports: description.exports, label: description.label, requirementRenames });
  }
}

/**
 * Seal a builder graph into a module. Runtime validation only: the selected
 * keys must be a tuple of existing public names or typed tokens.
 * @internal
 */
export function sealModule(graph: BindingGraph, keys: unknown, moduleLabel?: unknown): Module<never, never, never, never> {
  const label = checkedModuleLabel(moduleLabel);
  if (!Array.isArray(keys)) throw libraryError('DI_BAG_INVALID_ARGUMENT', 'buildModule requires a key tuple', { operation: 'buildModule', argument: 'exportedServiceKeys', expected: 'an array' });
  // Snapshot indexed entries before a custom iterator can substitute keys.
  const selected: unknown[] = [];
  const length = keys.length;
  for (let index = 0; index < length; index++) selected[index] = keys[index];
  const exports = new Map<BindingKey, BindingKey>();
  for (const value of selected) {
    const key = typeof value === 'string'
      ? value
      : readSingleServiceKey(value, 'buildModule');
    if (typeof value !== 'string') {
      graph.assertTokenKind(key as symbol, 'single-service', 'buildModule');
    }
    if (!graph.hasPublic(key)) throw libraryError('DI_BAG_UNKNOWN_SERVICE_KEY', 'buildModule accepts existing names or typed tokens only', { operation: 'buildModule', serviceKey: key });
    exports.set(key, key);
  }
  return new Module({ graph: graph.describe(), exports, label, requirementRenames: new Map() });
}

/** The label of a module: absent, or a non-empty string. */
function checkedModuleLabel(moduleLabel: unknown): string | undefined {
  if (moduleLabel === undefined) return undefined;
  if (typeof moduleLabel !== 'string' || moduleLabel === '') throw libraryError('DI_BAG_INVALID_ARGUMENT', 'buildModule moduleLabel must be a non-empty string', { operation: 'buildModule', argument: 'moduleLabel', expected: 'a non-empty string' });
  return moduleLabel;
}

/**
 * Internal normalization: every install receives fresh binding identities at
 * every nesting depth. Names resolve lexically: a binding's own local names
 * (from an inner installation) win, then the module's public names, then the
 * installing host's public slots.
 */
export function moduleGraph(value: unknown, index?: number): GraphDescription {
  const description = typeof value === 'object' && value !== null ? descriptions.get(value) : undefined;
  if (!description) {
    throw libraryError('DI_BAG_INVALID_MODULE', `withInstalledModules requires genuine modules: element ${index} is not one`, { operation: 'withInstalledModules', index });
  }
  const { graph, exports, label, requirementRenames } = description;
  const exported = new Set<BindingId>();
  for (const localKey of exports.values()) exported.add(graph.publicSlots.get(localKey)!);
  const labelOf = (id: BindingId, binding: BindingDescription) =>
    label === undefined || exported.has(id) ? binding.label : `${label}/${binding.label}`;
  const ids = new Map<BindingId, BindingId>();
  for (const [id, binding] of graph.bindings) ids.set(id, Symbol(labelOf(id, binding)));
  const exportNames = new Map<BindingKey, BindingKey>();
  for (const [publicKey, localKey] of exports) exportNames.set(localKey, publicKey);
  const scopeNames = new Map<BindingKey, BindingRef>();
  for (const [key, id] of graph.publicSlots) {
    const publicKey = exportNames.get(key);
    scopeNames.set(key, publicKey === undefined
      ? { kind: 'private', id: ids.get(id)! }
      : { kind: 'public', key: publicKey });
  }
  const hostNames = new Map(scopeNames);
  for (const [localKey, hostKey] of requirementRenames) {
    if (!hostNames.has(localKey)) hostNames.set(localKey, { kind: 'public', key: hostKey });
  }
  const remap = (ref: BindingRef): BindingRef => ref.kind === 'private'
    ? { kind: 'private', id: ids.get(ref.id) ?? ref.id }
    : scopeNames.get(ref.key) ?? {
        kind: 'public',
        key: typeof ref.key === 'string' ? requirementRenames.get(ref.key) ?? ref.key : ref.key,
      };
  const nested = new Map<BindingDescription['localNames'], ReadonlyMap<BindingKey, BindingRef>>();
  const localNamesFor = (binding: BindingDescription): ReadonlyMap<BindingKey, BindingRef> => {
    if (binding.localNames.size === 0) return hostNames;
    let names = nested.get(binding.localNames);
    if (!names) {
      const merged = new Map(hostNames);
      for (const [name, ref] of binding.localNames) merged.set(name, remap(ref));
      names = merged;
      nested.set(binding.localNames, names);
    }
    return names;
  };
  const bindings = new Map<BindingId, BindingDescription>();
  for (const [id, binding] of graph.bindings) {
    const fresh = ids.get(id)!;
    bindings.set(fresh, {
      id: fresh, label: labelOf(id, binding), registration: binding.registration,
      localNames: localNamesFor(binding),
    });
  }
  const publicSlots = new Map<BindingKey, BindingId>();
  for (const [publicKey, localKey] of exports) publicSlots.set(publicKey, ids.get(graph.publicSlots.get(localKey)!)!);
  const contributions = new Map<symbol, BindingId[]>();
  for (const [key, group] of graph.contributions ?? []) contributions.set(key, group.map(id => ids.get(id)!));
  return {
    bindings,
    publicSlots,
    contributions,
    tokenKinds: new Map(graph.tokenKinds ?? []),
  };
}

export type { Module };
