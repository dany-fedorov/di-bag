import type { ModuleContribute, ContributionConstraint, CheckedContributions, ModuleContributionConstraints } from './contribution-types';
import type { AliasSelection, AliasAdmission, AliasTarget, AliasDestination, AliasEntry, AliasEntries } from './alias-types';
import type { DisposableFactory, Factory, Registration, Registrations } from './registration';
import type { GraphDescription } from './runtime';
import type { Checked, Entries, Entry, From, Introduces, Merge, Provided, ReplacementKey, ReplacementOutput, Selection } from './types';
import type { ExternalRequirements, ModuleConstraints, NeedConstraint, ModulePublicProviders, PublicRegistrations, Renamed, RenamedConstraints, RenameKeys } from './module-types';
import type { RenamedLifetimeProviders } from './lifetime-types';
import type { TokenBase, TokenKey } from './tokens';
import type { Binding, BindingOutput, TokenTupleAdmission, SelectionKey } from './token-types';
import type { ModuleReplacementRegistration, ReplacementAdmission, ReplacedEntries, ZeroDependencyAdmission } from './replacement-types';
import type { NamedAdmission } from './types';
import type { BindingKey } from './runtime';
interface ModuleDescription {
    readonly contributions: readonly (readonly [symbol, Registration])[];
    readonly registrations: ReadonlyMap<BindingKey, Registration>;
    /** Public slot -> original local name. Factory parameter names never change. */
    readonly exports: ReadonlyMap<BindingKey, BindingKey>;
}
declare const moduleInvariant: unique symbol;
/**
 * A sealed, non-resolving module with private registrations and selected public exports.
 * Create modules through {@link Facade.module} and {@link ModuleBuilder.exports}; this
 * type-only class has no public constructor.
 */
declare class Module<P extends object, R extends object, C extends NeedConstraint = never, D extends Registrations = PublicRegistrations<P>> {
    private readonly nominal;
    /** @internal */
    readonly [moduleInvariant]: (value: [P, R, C, D]) => [P, R, C, D];
    constructor(description: ModuleDescription);
    /**
     * Return a module view with one string-named export renamed.
     * Factory dependency names and private identities remain unchanged.
     * @param oldKey - An existing public string export.
     * @param newKey - A noncolliding string-literal export name.
     * @returns A new sealed module, or the same instance when both names are equal.
     * @throws If runtime input names are invalid, absent, or collide.
     */
    rename<const Old extends string, const New extends string>(oldKey: Old & RenameKeys<P, Old, New>, newKey: New & RenameKeys<P, Old, New>): Module<Renamed<P, Old, New>, R, RenamedConstraints<C, Old, New>, RenamedLifetimeProviders<D, Old, New>>;
}
/**
 * An immutable builder for a reusable graph with private services and explicit exports.
 * Create one with {@link Facade.module}; module builders do not resolve or own services.
 */
declare class ModuleBuilder<E extends Entry, C extends ContributionConstraint = never> {
    #private;
    /** @internal */
    readonly [moduleInvariant]: (value: readonly [From<E>, C]) => readonly [From<E>, C];
    constructor(registrations?: ReadonlyMap<BindingKey, Registration>, contributions?: readonly (readonly [symbol, Registration])[]);
    private copy;
    private setRegistration;
    /**
     * Add new string-named registrations to the module's local graph.
     * @param more - A finite object of new named registrations.
     * @returns A new module builder containing snapshots of the supplied registrations.
     * @throws If the input is malformed, contains non-string keys, or duplicates a local name.
     */
    add<N extends {
        [K in keyof N]: Registration;
    }>(more: N & Registrations & NamedAdmission<N> & Introduces<From<E>, N> & Checked<Merge<From<E>, N>> & CheckedContributions<C, Merge<From<E>, N>>): ModuleBuilder<E | Entries<N>, C>;
    /**
     * Add another local name or token for an existing canonical acquisition.
     * @param destination - A new local string name or token.
     * @param target - The local or externally supplied name or token to alias.
     * @returns A new module builder; the alias creates no separate cache or owner.
     */
    alias<const D extends AliasSelection, const T extends AliasSelection>(destination: D & (unknown extends AliasAdmission<D> ? Introduces<From<E>, AliasEntries<From<E>, D, T>> : AliasAdmission<D>), target: T & AliasAdmission<T> & (unknown extends AliasAdmission<T> ? AliasTarget<From<E>, T> & AliasDestination<From<E>, NoInfer<D>, T> : unknown) & (unknown extends AliasAdmission<D> & AliasAdmission<T> ? Checked<Merge<From<E>, AliasEntries<From<E>, NoInfer<D>, NoInfer<T>>>> & CheckedContributions<C, Merge<From<E>, AliasEntries<From<E>, NoInfer<D>, NoInfer<T>>>> : unknown), ...invalid: [D] extends [never] ? [never] : [T] extends [never] ? [never] : []): ModuleBuilder<E | AliasEntry<From<E>, D, T>, C>;
    /**
     * Append a provider to a typed-token collection contributed by this module.
     * Contributions are installed even when the module exports no ordinary services.
     * @param token - The collection token.
     * @param registration - A registration compatible with the token service type.
     * @returns A new module builder preserving contribution order.
     */
    readonly contribute: ModuleContribute<E, C>;
    /**
     * Bind a local registration to a typed token.
     * @param token - A new local token identity.
     * @param registration - A registration whose output satisfies the token service contract.
     * @returns A new module builder retaining provider behavior and type contracts.
     */
    bind<T extends TokenBase, V extends Registration>(token: T & TokenTupleAdmission<readonly [T]> & Introduces<From<E>, Record<TokenKey<T>, V>>, registration: V & Registration & BindingOutput<NoInfer<T>, NoInfer<V>> & Checked<Merge<From<E>, Record<TokenKey<T>, Binding<NoInfer<T>, NoInfer<V>>>>> & CheckedContributions<C, Merge<From<E>, Record<TokenKey<T>, Binding<NoInfer<T>, NoInfer<V>>>>>): ModuleBuilder<E | {
        key: TokenKey<T>;
        registration: Binding<T, V>;
    }, C>;
    /**
     * Replace one existing string-named local registration with a dependency-free factory.
     * @param key - The existing singleton string-literal name.
     * @param registration - A replacement checked against surviving module consumers.
     * @returns A new module builder with the replacement.
     * @typeParam V - The exact replacement factory or disposable-factory type.
     */
    replace<const K extends string, V extends ((this: void) => ReplacementOutput<From<E>, K>) | DisposableFactory<(this: void) => ReplacementOutput<From<E>, K>>>(key: K & ReplacementKey<From<E>, K>, registration: V & (Factory | DisposableFactory<Factory>) & ZeroDependencyAdmission<NoInfer<V>> & CheckedContributions<C, Merge<From<E>, Record<K, NoInfer<V>>>>): ModuleBuilder<Exclude<E, {
        key: K;
    }> | {
        key: K;
        registration: V;
    }, C>;
    /**
     * Replace one existing local name or token.
     * @param key - The local service name or typed token to replace.
     * @param registration - A replacement compatible with the token and known consumers.
     * @returns A new module builder with the replacement.
     */
    replace<const K extends string | TokenBase, V extends Registration>(key: K & NoInfer<ReplacementAdmission<From<E>, K>>, registration: V & Registration & ModuleReplacementRegistration<E, C, NoInfer<K>, V>): ModuleBuilder<ReplacedEntries<E, K, V>, C>;
    /**
     * Seal the module and select its public names and typed tokens.
     * Unselected registrations stay private to each installation.
     * @param keys - A finite tuple of existing local names or tokens; an empty tuple is allowed.
     * @returns An immutable module that can be renamed or installed in an application builder.
     * @throws If the selection is not a tuple or contains an absent token.
     */
    exports<const K extends readonly unknown[]>(keys: K & Selection<From<E>, K, 'exports'>): Module<Pick<Provided<From<E>>, Extract<SelectionKey<K[number]>, keyof From<E>>>, ExternalRequirements<ModuleConstraints<From<E>, Extract<SelectionKey<K[number]>, keyof From<E>>> | ModuleContributionConstraints<C, From<E>, Extract<SelectionKey<K[number]>, keyof From<E>>>>, ModuleConstraints<From<E>, Extract<SelectionKey<K[number]>, keyof From<E>>> | ModuleContributionConstraints<C, From<E>, Extract<SelectionKey<K[number]>, keyof From<E>>>, ModulePublicProviders<From<E>, Extract<SelectionKey<K[number]>, keyof From<E>>>>;
}
/** Internal normalization: every install receives fresh private binding IDs. */
export declare function moduleGraph(value: object): GraphDescription;
/** Begin an empty immutable module graph. */
export declare const beginModule: () => ModuleBuilder<never>;
export type { Module, ModuleBuilder };
