import { contributionEntry } from './contributions';
import type { ModuleContribute, ContributionConstraint, CheckedContributions, ModuleContributionConstraints } from './contribution-types';
import { aliasEntry } from './aliases';
import type { AliasSelection, AliasAdmission, AliasTarget, AliasDestination, AliasEntry, AliasEntries } from './alias-types';
import { normalize, snapshotAdd } from './registration';
import type { DisposableFactory, Factory, Registration, Registrations } from './registration';
import type { BindingDescription, BindingId, BindingRef, GraphDescription } from './runtime';
import type { Checked, Entries, Entry, From, Introduces, Merge, Provided, ReplacementKey, ReplacementOutput, Selection } from './types';
import type { ExternalRequirements, ModuleConstraints, NeedConstraint, ModulePublicProviders, PublicRegistrations, Renamed, RenamedConstraints, RenameKeys } from './module-types';
import type { RenamedLifetimeProviders } from './lifetime-types';
import { readTokenKey } from './tokens';
import { withTokenBinding } from './provider';
import type { TokenBase, TokenKey } from './tokens';
import type { Binding, BindingOutput, TokenMember, TokenTupleAdmission, SelectionKey } from './token-types';
import type { ModuleReplacementRegistration, ReplacementAdmission, ReplacedEntries, ZeroDependencyAdmission } from './replacement-types';
import type { NamedAdmission } from './types';
import type { BindingKey } from './runtime';

interface ModuleDescription {
  readonly contributions: readonly (readonly [symbol, Registration])[];
  readonly registrations: ReadonlyMap<BindingKey, Registration>;
  /** Public slot -> original local name. Factory parameter names never change. */
  readonly exports: ReadonlyMap<BindingKey, BindingKey>;
}
const descriptions = new WeakMap<object, ModuleDescription>();
declare const moduleInvariant: unique symbol;

/** A sealed, non-resolving module. All four contracts are invariant. */
class Module<P extends object, R extends object, C extends NeedConstraint = never, D extends Registrations = PublicRegistrations<P>> {
  declare private readonly nominal: void;
  // Unexported symbol keeps all contracts invariant in emitted declarations too.
  declare readonly [moduleInvariant]: (value: [P, R, C, D]) => [P, R, C, D];

  constructor(description: ModuleDescription) {
    descriptions.set(this, { contributions: Object.freeze([...description.contributions]), registrations: new Map(description.registrations), exports: new Map(description.exports) });
    Object.freeze(this);
  }

  rename<const Old extends string, const New extends string>(
    oldKey: Old & RenameKeys<P, Old, New>, newKey: New & RenameKeys<P, Old, New>,
  ): Module<Renamed<P, Old, New>, R, RenamedConstraints<C, Old, New>, RenamedLifetimeProviders<D, Old, New>> {
    const description = descriptions.get(this)!;
    if (typeof oldKey !== 'string' || !description.exports.has(oldKey)) throw new Error('rename requires an existing export');
    if (typeof newKey !== 'string') throw new Error('rename requires a string name');
    if (oldKey as string === newKey) return this as unknown as Module<Renamed<P, Old, New>, R, RenamedConstraints<C, Old, New>, RenamedLifetimeProviders<D, Old, New>>;
    if (description.exports.has(newKey)) throw new Error(`duplicate export: ${newKey}`);
    const exports = new Map(description.exports);
    const localName = exports.get(oldKey)!;
    exports.delete(oldKey);
    exports.set(newKey, localName);
    return new Module({ registrations: description.registrations, exports, contributions: description.contributions });
  }
}

class ModuleBuilder<E extends Entry, C extends ContributionConstraint = never> {
  declare readonly [moduleInvariant]: (value: readonly [From<E>, C]) => readonly [From<E>, C];
  readonly #registrations: ReadonlyMap<BindingKey, Registration>;
  readonly #contributions: readonly (readonly [symbol, Registration])[];
  constructor(registrations: ReadonlyMap<BindingKey, Registration> = new Map(), contributions: readonly (readonly [symbol, Registration])[] = []) {
    this.#contributions = Object.freeze([...contributions]);
    this.#registrations = new Map(registrations);
  }

  add<N extends { [K in keyof N]: Registration }>(
    more: N & Registrations & NamedAdmission<N> & Introduces<From<E>, N> & Checked<Merge<From<E>, N>> & CheckedContributions<C, Merge<From<E>, N>>,
  ): ModuleBuilder<E | Entries<N>, C> {
    const snapshot = snapshotAdd(more, key => this.#registrations.has(key));
    return new ModuleBuilder(new Map([...this.#registrations, ...Object.entries(snapshot)]), this.#contributions);
  }

  alias<const D extends AliasSelection, const T extends AliasSelection>(
    destination: D & (unknown extends AliasAdmission<D> ? Introduces<From<E>, AliasEntries<From<E>, D, T>> : AliasAdmission<D>),
    target: T & AliasAdmission<T> & (unknown extends AliasAdmission<T>
      ? AliasTarget<From<E>, T> & AliasDestination<From<E>, NoInfer<D>, T> : unknown) &
      (unknown extends AliasAdmission<D> & AliasAdmission<T>
        ? Checked<Merge<From<E>, AliasEntries<From<E>, NoInfer<D>, NoInfer<T>>>> & CheckedContributions<C, Merge<From<E>, AliasEntries<From<E>, NoInfer<D>, NoInfer<T>>>> : unknown),
    ...invalid: [D] extends [never] ? [never] : [T] extends [never] ? [never] : []
  ): ModuleBuilder<E | AliasEntry<From<E>, D, T>, C> {
    const [key, registration] = aliasEntry(destination, target, key => this.#registrations.has(key));
    return new ModuleBuilder(new Map([...this.#registrations, [key, registration]]), this.#contributions);
  }

  readonly contribute: ModuleContribute<E, C> = ((token: unknown, registration: Registration) => {
    const entry = contributionEntry(token, registration);
    return new ModuleBuilder(this.#registrations, [...this.#contributions, entry]);
  }) as ModuleContribute<E, C>;

  bind<T extends TokenBase, V extends Registration>(
    token: T & TokenTupleAdmission<readonly [T]> & Introduces<From<E>, Record<TokenKey<T>, V>>,
    registration: V & Registration & BindingOutput<NoInfer<T>, NoInfer<V>> &
      Checked<Merge<From<E>, Record<TokenKey<T>, Binding<NoInfer<T>, NoInfer<V>>>>> & CheckedContributions<C, Merge<From<E>, Record<TokenKey<T>, Binding<NoInfer<T>, NoInfer<V>>>>>,
  ): ModuleBuilder<E | { key: TokenKey<T>; registration: Binding<T, V> }, C> {
    const key = readTokenKey(token);
    if (this.#registrations.has(key)) throw new Error(`duplicate registration: ${String(key)}`);
    return new ModuleBuilder(new Map([...this.#registrations, [key, withTokenBinding<T, V>(token, registration)]]), this.#contributions);
  }

  // ZeroDependencyAdmission proves empty needs and ReplacementOutput proves
  // surviving local consumers. Repeating Checked here
  // only rescans the accepted module; the general overload retains full checks.
  replace<const K extends string, V extends ((this: void) => ReplacementOutput<From<E>, K>) | DisposableFactory<(this: void) => ReplacementOutput<From<E>, K>>>(
    key: K & ReplacementKey<From<E>, K>,
    registration: V & (Factory | DisposableFactory<Factory>) & ZeroDependencyAdmission<NoInfer<V>> & CheckedContributions<C, Merge<From<E>, Record<K, NoInfer<V>>>>,
  ): ModuleBuilder<Exclude<E, { key: K }> | { key: K; registration: V }, C>;
  replace<const K extends string | TokenBase, V extends Registration>(
    key: K & NoInfer<ReplacementAdmission<From<E>, K>>,
    registration: V & Registration & ModuleReplacementRegistration<E, C, NoInfer<K>, V>,
  ): ModuleBuilder<ReplacedEntries<E, K, V>, C>;
  replace(selection: string | TokenBase, registration: Registration): unknown {
    const key = typeof selection === 'string' ? selection : readTokenKey(selection);
    if (!this.#registrations.has(key)) throw new Error(`replace accepts existing tokens only: ${String(key)}`);
    normalize(registration);
    const registrations = new Map(this.#registrations);
    registrations.set(key, registration);
    return new ModuleBuilder(registrations, this.#contributions);
  }

  exports<const K extends readonly unknown[]>(keys: K & Selection<From<E>, K, 'exports'>): Module<
    Pick<Provided<From<E>>, Extract<SelectionKey<K[number]>, keyof From<E>>>,
    ExternalRequirements<ModuleConstraints<From<E>, Extract<SelectionKey<K[number]>, keyof From<E>>> | ModuleContributionConstraints<C, From<E>, Extract<SelectionKey<K[number]>, keyof From<E>>>>,
    ModuleConstraints<From<E>, Extract<SelectionKey<K[number]>, keyof From<E>>> | ModuleContributionConstraints<C, From<E>, Extract<SelectionKey<K[number]>, keyof From<E>>>,
    ModulePublicProviders<From<E>, Extract<SelectionKey<K[number]>, keyof From<E>>>
  > {
    if (!Array.isArray(keys)) throw new Error('exports requires a key tuple');
    const selected: unknown[] = [];
    const length = keys.length;
    for (let index = 0; index < length; index++) selected[index] = keys[index];
    const exports = new Map<BindingKey, BindingKey>();
    for (const value of selected) {
      const key = typeof value === 'string' ? value : readTokenKey(value);
      if (!this.#registrations.has(key)) throw new Error('exports accepts existing tokens only');
      exports.set(key, key);
    }
    return new Module({ registrations: this.#registrations, exports, contributions: this.#contributions });
  }
}

/** Internal normalization: every install receives fresh private binding IDs. */
export function moduleGraph(value: object): GraphDescription {
  const description = descriptions.get(value);
  if (!description) throw new Error('install requires a genuine module');
  const ids = new Map<BindingKey, BindingId>();
  for (const key of description.registrations.keys()) ids.set(key, Symbol(String(key)));
  const publicSlots = new Map<BindingKey, BindingId>();
  const localNames = new Map<BindingKey, BindingRef>();
  for (const [key, id] of ids) localNames.set(key, { kind: 'private', id });
  for (const [publicKey, localKey] of description.exports) {
    publicSlots.set(publicKey, ids.get(localKey)!);
    localNames.set(localKey, { kind: 'public', key: publicKey });
  }
  const bindings = new Map<BindingId, BindingDescription>();
  for (const [key, registration] of description.registrations) {
    const id = ids.get(key)!;
    bindings.set(id, { id, label: String(key), registration, localNames });
  }
  const contributions = new Map<symbol, BindingId[]>();
  for (const [key, registration] of description.contributions) {
    const id = Symbol(`contribution:${String(key)}`);
    bindings.set(id, { id, label: `contribution:${String(key)}`, registration, localNames });
    const group = contributions.get(key) ?? [];
    group.push(id);
    contributions.set(key, group);
  }
  return { bindings, publicSlots, contributions };
}

export const beginModule = (): ModuleBuilder<never> => new ModuleBuilder();
export type { Module, ModuleBuilder };
