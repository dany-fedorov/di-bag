import { normalize, snapshotAdd } from './registration';
import type { DisposableFactory, Factory, Registration, Registrations } from './registration';
import type { BindingDescription, BindingId, BindingRef, GraphDescription } from './runtime';
import type { Checked, Entries, Entry, From, Introduces, Merge, Provided, ReplacementKey, Selection } from './types';
import type { ExternalRequirements, ModuleConstraints, NeedConstraint, PublicProviders, PublicRegistrations, Renamed, RenamedConstraints, RenameKeys } from './module-types';

interface ModuleDescription {
  readonly registrations: ReadonlyMap<string, Registration>;
  /** Public slot -> original local name. Factory parameter names never change. */
  readonly exports: ReadonlyMap<string, string>;
}
const descriptions = new WeakMap<object, ModuleDescription>();
declare const moduleInvariant: unique symbol;

/** A sealed, non-resolving module. All four contracts are invariant. */
class Module<P extends object, R extends object, C extends NeedConstraint = never, D extends Registrations = PublicRegistrations<P>> {
  declare private readonly nominal: void;
  // Unexported symbol keeps all contracts invariant in emitted declarations too.
  declare readonly [moduleInvariant]: (value: [P, R, C, D]) => [P, R, C, D];

  constructor(description: ModuleDescription) {
    descriptions.set(this, { registrations: new Map(description.registrations), exports: new Map(description.exports) });
    Object.freeze(this);
  }

  rename<const Old extends string, const New extends string>(
    oldKey: Old & RenameKeys<P, Old, New>, newKey: New & RenameKeys<P, Old, New>,
  ): Module<Renamed<P, Old, New>, R, RenamedConstraints<C, Old, New>, Renamed<D, Old, New>> {
    const description = descriptions.get(this)!;
    if (typeof oldKey !== 'string' || !description.exports.has(oldKey)) throw new Error('rename requires an existing export');
    if (typeof newKey !== 'string') throw new Error('rename requires a string name');
    if (oldKey as string === newKey) return this as unknown as Module<Renamed<P, Old, New>, R, RenamedConstraints<C, Old, New>, Renamed<D, Old, New>>;
    if (description.exports.has(newKey)) throw new Error(`duplicate export: ${newKey}`);
    const exports = new Map(description.exports);
    const localName = exports.get(oldKey)!;
    exports.delete(oldKey);
    exports.set(newKey, localName);
    return new Module({ registrations: description.registrations, exports });
  }
}

class ModuleBuilder<E extends Entry> {
  readonly #registrations: ReadonlyMap<string, Registration>;
  constructor(registrations: ReadonlyMap<string, Registration> = new Map()) {
    this.#registrations = new Map(registrations);
  }

  add<N extends { [K in keyof N]: Registration }>(
    more: N & Registrations & Introduces<From<E>, N> & Checked<Merge<From<E>, N>>,
  ): ModuleBuilder<E | Entries<N>> {
    const snapshot = snapshotAdd(more, key => this.#registrations.has(key));
    return new ModuleBuilder(new Map([...this.#registrations, ...Object.entries(snapshot)]));
  }

  // Separate first-pass callable context from admission of opaque provider bases.
  replace<const K extends string, V extends Factory | DisposableFactory<Factory>>(
    key: K & ReplacementKey<From<E>, K>,
    registration: V & (Factory | DisposableFactory<Factory>) & Checked<Merge<From<E>, Record<K, NoInfer<V>>>>,
  ): ModuleBuilder<Exclude<E, { key: K }> | { key: K; registration: V }>;
  replace<const K extends string, V extends Registration>(
    key: K & ReplacementKey<From<E>, K>,
    registration: V & Registration & Checked<Merge<From<E>, Record<K, NoInfer<V>>>>,
  ): ModuleBuilder<Exclude<E, { key: K }> | { key: K; registration: V }>;
  replace<const K extends string, V extends Registration>(
    key: K,
    registration: V,
  ): ModuleBuilder<Exclude<E, { key: K }> | { key: K; registration: V }> {
    if (typeof key !== 'string' || !this.#registrations.has(key)) throw new Error(`replace accepts existing tokens only: ${String(key)}`);
    normalize(registration);
    const registrations = new Map(this.#registrations);
    registrations.set(key, registration);
    return new ModuleBuilder(registrations);
  }

  exports<const K extends readonly unknown[]>(keys: K & Selection<From<E>, K, 'exports'>): Module<
    Pick<Provided<From<E>>, Extract<K[number], keyof From<E>>>,
    ExternalRequirements<ModuleConstraints<From<E>, Extract<K[number], keyof From<E>>>>,
    ModuleConstraints<From<E>, Extract<K[number], keyof From<E>>>,
    PublicProviders<Pick<From<E>, Extract<K[number], keyof From<E>>>>
  > {
    if (!Array.isArray(keys)) throw new Error('exports requires a key tuple');
    const selected: unknown[] = [];
    const length = keys.length;
    for (let index = 0; index < length; index++) selected[index] = keys[index];
    const exports = new Map<string, string>();
    for (const key of selected) {
      if (typeof key !== 'string' || !this.#registrations.has(key)) throw new Error('exports accepts existing tokens only');
      exports.set(key, key);
    }
    return new Module({ registrations: this.#registrations, exports });
  }
}

/** Internal normalization: every install receives fresh private binding IDs. */
export function moduleGraph(value: object): GraphDescription {
  const description = descriptions.get(value);
  if (!description) throw new Error('install requires a genuine module');
  const ids = new Map<string, BindingId>();
  for (const key of description.registrations.keys()) ids.set(key, Symbol(key));
  const publicSlots = new Map<string, BindingId>();
  const localNames = new Map<string, BindingRef>();
  for (const [key, id] of ids) localNames.set(key, { kind: 'private', id });
  for (const [publicKey, localKey] of description.exports) {
    publicSlots.set(publicKey, ids.get(localKey)!);
    localNames.set(localKey, { kind: 'public', key: publicKey });
  }
  const bindings = new Map<BindingId, BindingDescription>();
  for (const [key, registration] of description.registrations) {
    const id = ids.get(key)!;
    bindings.set(id, { id, label: key, registration, localNames });
  }
  return { bindings, publicSlots };
}

export const beginModule = (): ModuleBuilder<never> => new ModuleBuilder();
export type { Module };
