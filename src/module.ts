import { libraryError } from './errors';
import type { BindingDescription, BindingGraph, BindingId, BindingKey, BindingRef, GraphDescription } from './runtime';
import type { Registrations } from './registration';
import type { NeedConstraint, PublicRegistrations, Renamed, RenamedConstraints, RenameKeys } from './module-types';
import type { RenamedLifetimeProviders } from './lifetime-types';
import { readTokenKey } from './tokens';

interface ModuleDescription {
  /** The sealed graph: every binding that was retained when the builder sealed. */
  readonly graph: GraphDescription;
  /** Public slot -> original local name. Factory parameter names never change. */
  readonly exports: ReadonlyMap<BindingKey, BindingKey>;
}
const descriptions = new WeakMap<object, ModuleDescription>();
declare const moduleInvariant: unique symbol;

/**
 * A sealed, non-resolving module with private registrations and selected public exports.
 * Create modules through {@link DiBagApi.createBuilder} and {@link Builder.buildModule}; this
 * type-only class has no public constructor.
 */
class Module<P extends object, R extends object, C extends NeedConstraint = never, D extends Registrations = PublicRegistrations<P>> {
  declare private readonly nominal: void;
  // Unexported symbol keeps all contracts invariant in emitted declarations too.
  /** @internal */
  declare readonly [moduleInvariant]: (value: [P, R, C, D]) => [P, R, C, D];

  constructor(description: ModuleDescription) {
    descriptions.set(this, { graph: description.graph, exports: new Map(description.exports) });
    Object.freeze(this);
  }

  /**
   * Return a module view with one string-named export renamed.
   * Factory dependency names and private identities remain unchanged.
   * @param oldKey - An existing public string export.
   * @param newKey - A noncolliding string-literal export name.
   * @returns A new sealed module, or the same instance when both names are equal.
   * @throws If runtime input names are invalid, absent, or collide.
   */
  renameExport<const Old extends string, const New extends string>(
    oldKey: Old & RenameKeys<P, Old, New>, newKey: New & RenameKeys<P, Old, New>,
  ): Module<Renamed<P, Old, New>, R, RenamedConstraints<C, Old, New>, RenamedLifetimeProviders<D, Old, New>> {
    const description = descriptions.get(this)!;
    if (typeof oldKey !== 'string' || !description.exports.has(oldKey)) throw libraryError('DI_BAG_INVALID_EXPORT', 'renameExport requires an existing export', { operation: 'renameExport', oldKey, newKey });
    if (typeof newKey !== 'string') throw libraryError('DI_BAG_INVALID_EXPORT', 'renameExport requires a string name', { operation: 'renameExport', oldKey, newKey });
    if (oldKey as string === newKey) return this as unknown as Module<Renamed<P, Old, New>, R, RenamedConstraints<C, Old, New>, RenamedLifetimeProviders<D, Old, New>>;
    if (description.exports.has(newKey)) throw libraryError('DI_BAG_INVALID_EXPORT', `duplicate export: ${newKey}`, { operation: 'renameExport', oldKey, newKey });
    const exports = new Map(description.exports);
    const localName = exports.get(oldKey)!;
    exports.delete(oldKey);
    exports.set(newKey, localName);
    return new Module({ graph: description.graph, exports });
  }
}

/**
 * Seal a builder graph into a module. Runtime validation only: the selected
 * keys must be a tuple of existing public names or typed tokens.
 * @internal
 */
export function sealModule(graph: BindingGraph, keys: unknown): Module<never, never, never, never> {
  if (!Array.isArray(keys)) throw libraryError('DI_BAG_INVALID_EXPORT', 'buildModule requires a key tuple', { operation: 'buildModule' });
  // Snapshot indexed entries before a custom iterator can substitute keys.
  const selected: unknown[] = [];
  const length = keys.length;
  for (let index = 0; index < length; index++) selected[index] = keys[index];
  const exports = new Map<BindingKey, BindingKey>();
  for (const value of selected) {
    const key = typeof value === 'string' ? value : readTokenKey(value);
    if (!graph.hasPublic(key)) throw libraryError('DI_BAG_INVALID_EXPORT', 'buildModule accepts existing names or typed tokens only', { operation: 'buildModule' });
    exports.set(key, key);
  }
  return new Module({ graph: graph.describe(), exports });
}

/**
 * Internal normalization: every install receives fresh binding identities at
 * every nesting depth. Names resolve lexically: a binding's own local names
 * (from an inner installation) win, then the module's public names, then the
 * installing host's public slots.
 */
export function moduleGraph(value: object): GraphDescription {
  const description = descriptions.get(value);
  if (!description) throw libraryError('DI_BAG_INVALID_MODULE', 'installModule requires a genuine module', { operation: 'installModule' });
  const { graph, exports } = description;
  const ids = new Map<BindingId, BindingId>();
  for (const [id, binding] of graph.bindings) ids.set(id, Symbol(binding.label));
  const exportNames = new Map<BindingKey, BindingKey>();
  for (const [publicKey, localKey] of exports) exportNames.set(localKey, publicKey);
  // Every public name of the sealed graph, as seen by its own bindings.
  const scopeNames = new Map<BindingKey, BindingRef>();
  for (const [key, id] of graph.publicSlots) {
    const exported = exportNames.get(key);
    scopeNames.set(key, exported === undefined ? { kind: 'private', id: ids.get(id)! } : { kind: 'public', key: exported });
  }
  const remap = (ref: BindingRef): BindingRef => ref.kind === 'private'
    ? { kind: 'private', id: ids.get(ref.id) ?? ref.id }
    : scopeNames.get(ref.key) ?? ref;
  // Share one lexical map per distinct inner scope so the graph deduplicates snapshots.
  const nested = new Map<BindingDescription['localNames'], ReadonlyMap<BindingKey, BindingRef>>();
  const localNamesFor = (binding: BindingDescription): ReadonlyMap<BindingKey, BindingRef> => {
    if (binding.localNames.size === 0) return scopeNames;
    let names = nested.get(binding.localNames);
    if (!names) {
      const merged = new Map(scopeNames);
      for (const [name, ref] of binding.localNames) merged.set(name, remap(ref));
      names = merged;
      nested.set(binding.localNames, names);
    }
    return names;
  };
  const bindings = new Map<BindingId, BindingDescription>();
  for (const [id, binding] of graph.bindings) {
    const fresh = ids.get(id)!;
    bindings.set(fresh, { id: fresh, label: binding.label, registration: binding.registration, localNames: localNamesFor(binding) });
  }
  const publicSlots = new Map<BindingKey, BindingId>();
  for (const [publicKey, localKey] of exports) publicSlots.set(publicKey, ids.get(graph.publicSlots.get(localKey)!)!);
  const contributions = new Map<symbol, BindingId[]>();
  for (const [key, group] of graph.contributions ?? []) contributions.set(key, group.map(id => ids.get(id)!));
  return { bindings, publicSlots, contributions };
}

export type { Module };
