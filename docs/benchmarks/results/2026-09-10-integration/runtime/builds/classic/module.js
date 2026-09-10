"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.beginModule = void 0;
exports.moduleGraph = moduleGraph;
const persistent_map_1 = require("./persistent-map");
const persistent_sequence_1 = require("./persistent-sequence");
const contributions_1 = require("./contributions");
const aliases_1 = require("./aliases");
const registration_1 = require("./registration");
const tokens_1 = require("./tokens");
const provider_1 = require("./provider");
const descriptions = new WeakMap();
/**
 * A sealed, non-resolving module with private registrations and selected public exports.
 * Create modules through {@link Facade.module} and {@link ModuleBuilder.exports}; this
 * type-only class has no public constructor.
 */
class Module {
    constructor(description) {
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
    rename(oldKey, newKey) {
        const description = descriptions.get(this);
        if (typeof oldKey !== 'string' || !description.exports.has(oldKey))
            throw new Error('rename requires an existing export');
        if (typeof newKey !== 'string')
            throw new Error('rename requires a string name');
        if (oldKey === newKey)
            return this;
        if (description.exports.has(newKey))
            throw new Error(`duplicate export: ${newKey}`);
        const exports = new Map(description.exports);
        const localName = exports.get(oldKey);
        exports.delete(oldKey);
        exports.set(newKey, localName);
        return new Module({ registrations: description.registrations, exports, contributions: description.contributions });
    }
}
/**
 * An immutable builder for a reusable graph with private services and explicit exports.
 * Create one with {@link Facade.module}; module builders do not resolve or own services.
 */
class ModuleBuilder {
    #registrations = new persistent_map_1.PersistentMap();
    #order;
    #contributions;
    constructor(registrations = new Map(), contributions = []) {
        if (contributions.length)
            this.#contributions = { values: Object.freeze([...contributions]) };
        for (const [key, registration] of registrations)
            this.setRegistration(key, registration);
    }
    copy() {
        const builder = new ModuleBuilder();
        builder.#registrations = this.#registrations;
        builder.#order = this.#order;
        builder.#contributions = this.#contributions;
        return builder;
    }
    setRegistration(key, registration) {
        if (!this.#registrations.has(key))
            this.#order = (0, persistent_sequence_1.append)(this.#order, { values: [key] });
        this.#registrations = this.#registrations.set(key, registration);
    }
    /**
     * Add new string-named registrations to the module's local graph.
     * @param more - A finite object of new named registrations.
     * @returns A new module builder containing snapshots of the supplied registrations.
     * @throws If the input is malformed, contains non-string keys, or duplicates a local name.
     */
    add(more) {
        const snapshot = (0, registration_1.snapshotAdd)(more, key => this.#registrations.has(key));
        const builder = this.copy();
        for (const [key, registration] of Object.entries(snapshot))
            builder.setRegistration(key, registration);
        return builder;
    }
    /**
     * Add another local name or token for an existing canonical acquisition.
     * @param destination - A new local string name or token.
     * @param target - The local or externally supplied name or token to alias.
     * @returns A new module builder; the alias creates no separate cache or owner.
     */
    alias(destination, target, ...invalid) {
        const [key, registration] = (0, aliases_1.aliasEntry)(destination, target, key => this.#registrations.has(key));
        const builder = this.copy();
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
    contribute = ((token, registration) => {
        const entry = (0, contributions_1.contributionEntry)(token, registration);
        const builder = this.copy();
        builder.#contributions = (0, persistent_sequence_1.append)(this.#contributions, { values: [entry] });
        return builder;
    });
    /**
     * Bind a local registration to a typed token.
     * @param token - A new local token identity.
     * @param registration - A registration whose output satisfies the token service contract.
     * @returns A new module builder retaining provider behavior and type contracts.
     */
    bind(token, registration) {
        const key = (0, tokens_1.readTokenKey)(token);
        if (this.#registrations.has(key))
            throw new Error(`duplicate registration: ${String(key)}`);
        const builder = this.copy();
        builder.setRegistration(key, (0, provider_1.withTokenBinding)(token, registration));
        return builder;
    }
    replace(selection, registration) {
        const key = typeof selection === 'string' ? selection : (0, tokens_1.readTokenKey)(selection);
        if (!this.#registrations.has(key))
            throw new Error(`replace accepts existing tokens only: ${String(key)}`);
        (0, registration_1.normalize)(registration);
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
    exports(keys) {
        if (!Array.isArray(keys))
            throw new Error('exports requires a key tuple');
        const selected = [];
        const length = keys.length;
        for (let index = 0; index < length; index++)
            selected[index] = keys[index];
        const exports = new Map();
        for (const value of selected) {
            const key = typeof value === 'string' ? value : (0, tokens_1.readTokenKey)(value);
            if (!this.#registrations.has(key))
                throw new Error('exports accepts existing tokens only');
            exports.set(key, key);
        }
        const registrations = new Map();
        if (this.#order)
            for (const key of (0, persistent_sequence_1.materialize)(this.#order))
                registrations.set(key, this.#registrations.get(key));
        return new Module({ registrations, exports, contributions: this.#contributions ? (0, persistent_sequence_1.materialize)(this.#contributions) : [] });
    }
}
/** Internal normalization: every install receives fresh private binding IDs. */
function moduleGraph(value) {
    const description = descriptions.get(value);
    if (!description)
        throw new Error('install requires a genuine module');
    const ids = new Map();
    for (const key of description.registrations.keys())
        ids.set(key, Symbol(String(key)));
    const publicSlots = new Map();
    const localNames = new Map();
    for (const [key, id] of ids)
        localNames.set(key, { kind: 'private', id });
    for (const [publicKey, localKey] of description.exports) {
        publicSlots.set(publicKey, ids.get(localKey));
        localNames.set(localKey, { kind: 'public', key: publicKey });
    }
    const bindings = new Map();
    for (const [key, registration] of description.registrations) {
        const id = ids.get(key);
        bindings.set(id, { id, label: String(key), registration, localNames });
    }
    const contributions = new Map();
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
const beginModule = () => new ModuleBuilder();
exports.beginModule = beginModule;
