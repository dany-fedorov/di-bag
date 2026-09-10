import { libraryError } from './errors';
import { PersistentMap } from './persistent-map';
import { append, materialize } from './persistent-sequence';
import type { Sequence } from './persistent-sequence';
import { contributionEntry } from './contributions';
import type { ModuleContribute, ContributionConstraint, CheckedContributions, ModuleContributionConstraints } from './contribution-types';
import { aliasEntry } from './aliases';
import type { AliasSelection, AliasAdmission, AliasTarget, AliasDestination, AliasEntry, AliasEntries } from './alias-types';
import { normalize, snapshotAdd } from './registration';
import type { FactoryWithDisposal, Factory, Registration, Registrations } from './registration';
import type { BindingDescription, BindingId, BindingRef, GraphDescription } from './runtime';
import type { CheckDependencyCompatibility, RegistrationEntries, Entry, RegistrationsFromEntries, Introduces, OverrideRegistrations, ServicesOf, ReplacementKey, ReplacementOutput, Selection } from './types';
import type { ExternalRequirements, ModuleConstraints, NeedConstraint, ModulePublicProviders, PublicRegistrations, Renamed, RenamedConstraints, RenameKeys } from './module-types';
import type { RenamedLifetimeProviders } from './lifetime-types';
import { readTokenKey } from './tokens';
import { withTokenBinding } from './provider';
import type { TokenBase, TokenKey } from './tokens';
import type { TokenBinding, BindingOutput, TokenMember, TokenTupleAdmission, SelectionKey } from './token-types';
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
 * Create modules through {@link DiBagApi.createModuleBuilder} and {@link ModuleBuilder.buildModule}; this
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
    return new Module({ registrations: description.registrations, exports, contributions: description.contributions });
  }
}

/**
 * An immutable builder for a reusable graph with private services and explicit exports.
 * Create one with {@link DiBagApi.createModuleBuilder}; module builders do not resolve or own services.
 */
class ModuleBuilder<E extends Entry, C extends ContributionConstraint = never> {
  /** @internal */
  declare readonly [moduleInvariant]: (value: readonly [RegistrationsFromEntries<E>, C]) => readonly [RegistrationsFromEntries<E>, C];
  #registrations = new PersistentMap<Registration>();
  #order: Sequence<BindingKey> | undefined;
  #contributions: Sequence<readonly [symbol, Registration]> | undefined;
  constructor(registrations: ReadonlyMap<BindingKey, Registration> = new Map(), contributions: readonly (readonly [symbol, Registration])[] = []) {
    if (contributions.length) this.#contributions = { values: Object.freeze([...contributions]) };
    for (const [key, registration] of registrations) this.setRegistration(key, registration);
  }

  private copy<N extends Entry, D extends ContributionConstraint = C>(): ModuleBuilder<N, D> {
    const builder = new ModuleBuilder<N, D>();
    builder.#registrations = this.#registrations;
    builder.#order = this.#order;
    builder.#contributions = this.#contributions;
    return builder;
  }

  private setRegistration(key: BindingKey, registration: Registration): void {
    if (!this.#registrations.has(key)) this.#order = append(this.#order, { values: [key] });
    this.#registrations = this.#registrations.set(key, registration);
  }

  /**
   * Add new string-named registrations to the module's local graph.
   * @param more - A finite object of new named registrations.
   * @returns A new module builder containing snapshots of the supplied registrations.
   * @throws If the input is malformed, contains non-string keys, or duplicates a local name.
   */
  register<N extends { [K in keyof N]: Registration }>(
    more: N & Registrations & NamedAdmission<N> & Introduces<RegistrationsFromEntries<E>, N> & CheckDependencyCompatibility<OverrideRegistrations<RegistrationsFromEntries<E>, N>> & CheckedContributions<C, OverrideRegistrations<RegistrationsFromEntries<E>, N>>,
  ): ModuleBuilder<E | RegistrationEntries<N>, C>;
  /**
   * Register a local provider to a typed token.
   * @param token - A new local token identity.
   * @param registration - A registration whose output satisfies the token service contract.
   * @returns A new module builder retaining provider behavior and type contracts.
   */
  register<T extends TokenBase, V extends Registration>(
    token: T & TokenTupleAdmission<readonly [T]> & Introduces<RegistrationsFromEntries<E>, Record<TokenKey<T>, V>>,
    registration: V & Registration & BindingOutput<NoInfer<T>, NoInfer<V>> &
      CheckDependencyCompatibility<OverrideRegistrations<RegistrationsFromEntries<E>, Record<TokenKey<T>, TokenBinding<NoInfer<T>, NoInfer<V>>>>> & CheckedContributions<C, OverrideRegistrations<RegistrationsFromEntries<E>, Record<TokenKey<T>, TokenBinding<NoInfer<T>, NoInfer<V>>>>>,
  ): ModuleBuilder<E | { key: TokenKey<T>; registration: TokenBinding<T, V> }, C>;
  register(moreOrToken: unknown, registration?: Registration): unknown {
    if (arguments.length === 1) {
      const snapshot = snapshotAdd(moreOrToken, key => this.#registrations.has(key));
      const builder = this.copy();
      for (const [key, registration] of Object.entries(snapshot)) builder.setRegistration(key, registration);
      return builder;
    }
    const key = readTokenKey(moreOrToken);
    if (this.#registrations.has(key)) throw libraryError('DI_BAG_DUPLICATE_REGISTRATION', `duplicate registration: ${String(key)}`, { operation: 'register', key });
    const builder = this.copy();
    builder.setRegistration(key, withTokenBinding(moreOrToken as never, registration as never));
    return builder;
  }

  /**
   * Add another local name or token for an existing canonical acquisition.
   * @param destination - A new local string name or token.
   * @param target - The local or externally supplied name or token to alias.
   * @returns A new module builder; the alias creates no separate cache or owner.
   */
  alias<const D extends AliasSelection, const T extends AliasSelection>(
    destination: D & (unknown extends AliasAdmission<D> ? Introduces<RegistrationsFromEntries<E>, AliasEntries<RegistrationsFromEntries<E>, D, T>> : AliasAdmission<D>),
    target: T & AliasAdmission<T> & (unknown extends AliasAdmission<T>
      ? AliasTarget<RegistrationsFromEntries<E>, T> & AliasDestination<RegistrationsFromEntries<E>, NoInfer<D>, T> : unknown) &
      (unknown extends AliasAdmission<D> & AliasAdmission<T>
        ? CheckDependencyCompatibility<OverrideRegistrations<RegistrationsFromEntries<E>, AliasEntries<RegistrationsFromEntries<E>, NoInfer<D>, NoInfer<T>>>> & CheckedContributions<C, OverrideRegistrations<RegistrationsFromEntries<E>, AliasEntries<RegistrationsFromEntries<E>, NoInfer<D>, NoInfer<T>>>> : unknown),
    ...invalid: [D] extends [never] ? [never] : [T] extends [never] ? [never] : []
  ): ModuleBuilder<E | AliasEntry<RegistrationsFromEntries<E>, D, T>, C> {
    const [key, registration] = aliasEntry(destination, target, key => this.#registrations.has(key));
    const builder = this.copy<E | AliasEntry<RegistrationsFromEntries<E>, D, T>>();
    builder.setRegistration(key, registration);
    return builder;
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
    const builder = this.copy();
    builder.#contributions = append(this.#contributions, { values: [entry] });
    return builder;
  }) as ModuleContribute<E, C>;



  // ZeroDependencyAdmission proves empty needs and ReplacementOutput proves
  // surviving local consumers. Repeating CheckDependencyCompatibility here
  // only rescans the accepted module; the general overload retains full checks.
  /**
   * Replace one existing string-named local registration with a dependency-free factory.
   * @param key - The existing singleton string-literal name.
   * @param registration - A replacement checked against surviving module consumers.
   * @returns A new module builder with the replacement.
   * @typeParam V - The exact replacement factory or disposable-factory type.
   */
  replace<const K extends string, V extends ((this: void) => ReplacementOutput<RegistrationsFromEntries<E>, K>) | FactoryWithDisposal<(this: void) => ReplacementOutput<RegistrationsFromEntries<E>, K>>>(
    key: K & ReplacementKey<RegistrationsFromEntries<E>, K>,
    registration: V & (Factory | FactoryWithDisposal<Factory>) & ZeroDependencyAdmission<NoInfer<V>> & CheckedContributions<C, OverrideRegistrations<RegistrationsFromEntries<E>, Record<K, NoInfer<V>>>>,
  ): ModuleBuilder<Exclude<E, { key: K }> | { key: K; registration: V }, C>;
  /**
   * Replace one existing local name or token.
   * @param key - The local service name or typed token to replace.
   * @param registration - A replacement compatible with the token and known consumers.
   * @returns A new module builder with the replacement.
   */
  replace<const K extends string | TokenBase, V extends Registration>(
    key: K & NoInfer<ReplacementAdmission<RegistrationsFromEntries<E>, K>>,
    registration: V & Registration & ModuleReplacementRegistration<E, C, NoInfer<K>, V>,
  ): ModuleBuilder<ReplacedEntries<E, K, V>, C>;
  replace(selection: string | TokenBase, registration: Registration): unknown {
    const key = typeof selection === 'string' ? selection : readTokenKey(selection);
    if (!this.#registrations.has(key)) throw libraryError('DI_BAG_INVALID_REPLACEMENT', `replace accepts existing names or typed tokens only: ${String(key)}`, { operation: 'replace', key });
    normalize(registration);
    const builder = this.copy();
    builder.setRegistration(key, registration);
    return builder;
  }

  /**
   * Seal the module and select its public names and typed tokens.
   * Unselected registrations stay private to each installation.
   * @param keys - A finite tuple of existing local names or tokens; an empty tuple is allowed.
   * @returns An immutable module that can be renamed or installed in an application builder.
   * @throws If the selection is not a tuple or contains an absent token.
   */
  buildModule<const K extends readonly unknown[]>(keys: K & Selection<RegistrationsFromEntries<E>, K, 'buildModule'>): Module<
    Pick<ServicesOf<RegistrationsFromEntries<E>>, Extract<SelectionKey<K[number]>, keyof RegistrationsFromEntries<E>>>,
    ExternalRequirements<ModuleConstraints<RegistrationsFromEntries<E>, Extract<SelectionKey<K[number]>, keyof RegistrationsFromEntries<E>>> | ModuleContributionConstraints<C, RegistrationsFromEntries<E>, Extract<SelectionKey<K[number]>, keyof RegistrationsFromEntries<E>>>>,
    ModuleConstraints<RegistrationsFromEntries<E>, Extract<SelectionKey<K[number]>, keyof RegistrationsFromEntries<E>>> | ModuleContributionConstraints<C, RegistrationsFromEntries<E>, Extract<SelectionKey<K[number]>, keyof RegistrationsFromEntries<E>>>,
    ModulePublicProviders<RegistrationsFromEntries<E>, Extract<SelectionKey<K[number]>, keyof RegistrationsFromEntries<E>>>
  > {
    if (!Array.isArray(keys)) throw libraryError('DI_BAG_INVALID_EXPORT', 'buildModule requires a key tuple', { operation: 'buildModule' });
    const selected: unknown[] = [];
    const length = keys.length;
    for (let index = 0; index < length; index++) selected[index] = keys[index];
    const exports = new Map<BindingKey, BindingKey>();
    for (const value of selected) {
      const key = typeof value === 'string' ? value : readTokenKey(value);
      if (!this.#registrations.has(key)) throw libraryError('DI_BAG_INVALID_EXPORT', 'buildModule accepts existing names or typed tokens only', { operation: 'buildModule' });
      exports.set(key, key);
    }
    const registrations = new Map<BindingKey, Registration>();
    if (this.#order) for (const key of materialize(this.#order)) registrations.set(key, this.#registrations.get(key)!);
    return new Module({ registrations, exports, contributions: this.#contributions ? materialize(this.#contributions) : [] });
  }
}

/** Internal normalization: every install receives fresh private binding IDs. */
export function moduleGraph(value: object): GraphDescription {
  const description = descriptions.get(value);
  if (!description) throw libraryError('DI_BAG_INVALID_MODULE', 'installModule requires a genuine module', { operation: 'installModule' });
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
