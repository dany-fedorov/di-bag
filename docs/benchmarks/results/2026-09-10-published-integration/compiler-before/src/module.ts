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

/**
 * A sealed, non-resolving module with private registrations and selected public exports.
 * Create modules through {@link Facade.module} and {@link ModuleBuilder.exports}; this
 * type-only class has no public constructor.
 */
class Module<P extends object, R extends object, C extends NeedConstraint = never, D extends Registrations = PublicRegistrations<P>> {
  declare private readonly nominal: void;
  // Unexported symbol keeps all contracts invariant in emitted declarations too.
  /** @internal */
  declare readonly [moduleInvariant]: (value: [P, R, C, D]) => [P, R, C, D];

  constructor(description: ModuleDescription) {
    descriptions.set(this, { contributions: Object.freeze([...description.contributions]), registrations: new Map(description.registrations), exports: new Map(description.exports) });
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

/**
 * An immutable builder for a reusable graph with private services and explicit exports.
 * Create one with {@link Facade.module}; module builders do not resolve or own services.
 */
class ModuleBuilder<E extends Entry, C extends ContributionConstraint = never> {
  /** @internal */
  declare readonly [moduleInvariant]: (value: readonly [From<E>, C]) => readonly [From<E>, C];
  readonly #registrations: ReadonlyMap<BindingKey, Registration>;
  readonly #contributions: readonly (readonly [symbol, Registration])[];
  constructor(registrations: ReadonlyMap<BindingKey, Registration> = new Map(), contributions: readonly (readonly [symbol, Registration])[] = []) {
    this.#contributions = Object.freeze([...contributions]);
    this.#registrations = new Map(registrations);
  }

  /**
   * Add new string-named registrations to the module's local graph.
   * @param more - A finite object of new named registrations.
   * @returns A new module builder containing snapshots of the supplied registrations.
   * @throws If the input is malformed, contains non-string keys, or duplicates a local name.
   */
  add<N extends { [K in keyof N]: Registration }>(
    more: N & Registrations & NamedAdmission<N> & Introduces<From<E>, N> & Checked<Merge<From<E>, N>> & CheckedContributions<C, Merge<From<E>, N>>,
  ): ModuleBuilder<E | Entries<N>, C> {
    const snapshot = snapshotAdd(more, key => this.#registrations.has(key));
    return new ModuleBuilder(new Map([...this.#registrations, ...Object.entries(snapshot)]), this.#contributions);
  }

  /**
   * Add another local name or token for an existing canonical acquisition.
   * @param destination - A new local string name or token.
   * @param target - The local or externally supplied name or token to alias.
   * @returns A new module builder; the alias creates no separate cache or owner.
   */
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

  /**
   * Append a provider to a typed-token collection contributed by this module.
   * Contributions are installed even when the module exports no ordinary services.
   * @param token - The collection token.
   * @param registration - A registration compatible with the token service type.
   * @returns A new module builder preserving contribution order.
   */
  readonly contribute: ModuleContribute<E, C> = ((token: unknown, registration: Registration) => {
    const entry = contributionEntry(token, registration);
    return new ModuleBuilder(this.#registrations, [...this.#contributions, entry]);
  }) as ModuleContribute<E, C>;

  /**
   * Bind a local registration to a typed token.
   * @param token - A new local token identity.
   * @param registration - A registration whose output satisfies the token service contract.
   * @returns A new module builder retaining provider behavior and type contracts.
   */
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
  /**
   * Replace one existing string-named local registration with a dependency-free factory.
   * @param key - The existing singleton string-literal name.
   * @param registration - A replacement checked against surviving module consumers.
   * @returns A new module builder with the replacement.
   * @typeParam V - The exact replacement factory or disposable-factory type.
   */
  replace<const K extends string, V extends ((this: void) => ReplacementOutput<From<E>, K>) | DisposableFactory<(this: void) => ReplacementOutput<From<E>, K>>>(
    key: K & ReplacementKey<From<E>, K>,
    registration: V & (Factory | DisposableFactory<Factory>) & ZeroDependencyAdmission<NoInfer<V>> & CheckedContributions<C, Merge<From<E>, Record<K, NoInfer<V>>>>,
  ): ModuleBuilder<Exclude<E, { key: K }> | { key: K; registration: V }, C>;
  /**
   * Replace one existing local name or token.
   * @param key - The local service name or typed token to replace.
   * @param registration - A replacement compatible with the token and known consumers.
   * @returns A new module builder with the replacement.
   */
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

  /**
   * Seal the module and select its public names and typed tokens.
   * Unselected registrations stay private to each installation.
   * @param keys - A finite tuple of existing local names or tokens; an empty tuple is allowed.
   * @returns An immutable module that can be renamed or installed in an application builder.
   * @throws If the selection is not a tuple or contains an absent token.
   */
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

/** Begin an empty immutable module graph. */
export const beginModule = (): ModuleBuilder<never> => new ModuleBuilder();
export type { Module, ModuleBuilder };
