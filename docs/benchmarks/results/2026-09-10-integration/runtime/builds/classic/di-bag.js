"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiBag = void 0;
const observers_1 = require("./observers");
const contributions_1 = require("./contributions");
const aliases_1 = require("./aliases");
const dependency_references_1 = require("./dependency-references");
const registration_1 = require("./registration");
const runtime_1 = require("./runtime");
const module_1 = require("./module");
const lifetime_1 = require("./lifetime");
const acquisition_context_1 = require("./acquisition-context");
const startup_1 = require("./startup");
const scope_selection_1 = require("./scope-selection");
const provider_1 = require("./provider");
const composition_1 = require("./composition");
const acquisition_mode_1 = require("./acquisition-mode");
const tokens_1 = require("./tokens");
const plugins_1 = require("./plugins");
/**
 * A resolving container with lazy acquisition, caching, and independent resource ownership.
 *
 * Create bags through {@link Facade.begin} followed by {@link Builder.end} or
 * {@link Builder.start}; the class is exported as a type and has no public constructor.
 */
class Bag {
    context;
    #graph;
    #runtime;
    constructor(graph, context, runtime) {
        this.context = context;
        this.#graph = graph;
        this.#runtime = runtime ?? new runtime_1.Runtime(graph, context);
    }
    resolve(token) {
        return this.#runtime.resolve(typeof token === 'string' ? token : (0, tokens_1.readTokenKey)(token));
    }
    resolveAll(token) { return this.#runtime.resolveAll((0, tokens_1.readTokenKey)(token)); }
    inspectAll(token) { return this.#runtime.inspectAll((0, tokens_1.readTokenKey)(token)); }
    inspect(token) {
        return this.#runtime.inspect(typeof token === 'string' ? token : (0, tokens_1.readTokenKey)(token));
    }
    scope(...args) {
        this.#runtime.assertOpen();
        const { graph, shared } = (0, scope_selection_1.selectScope)(this.#graph, args, key => this.#runtime.isTransient(key));
        return new Bag(graph, this.context, this.#runtime.scope(graph, shared));
    }
    fork(keys, overrides) {
        this.#runtime.assertOpen();
        if (keys === undefined && overrides === undefined) {
            return new Bag(this.#graph, this.context);
        }
        if (!Array.isArray(keys) ||
            typeof overrides !== 'object' ||
            overrides === null) {
            throw new Error('fork requires selected keys and an override object');
        }
        // Snapshot indexed entries before override getters can mutate the tuple.
        // A tuple's custom iterator need not enumerate its declared indexed keys.
        const selectedKeys = [];
        const length = keys.length;
        for (let index = 0; index < length; index++) {
            selectedKeys[index] = keys[index];
        }
        if (selectedKeys.length === 0)
            return new Bag(this.#graph, this.context);
        const publicKeys = selectedKeys.map(value => typeof value === 'string' ? value : (0, tokens_1.readTokenKey)(value));
        for (const token of publicKeys) {
            if (!this.#graph.hasPublic(token)) {
                throw new Error(`fork accepts existing tokens only: ${String(token)}`);
            }
            if (!Object.hasOwn(overrides, token)) {
                throw new Error(`missing override: ${String(token)}`);
            }
        }
        const selectedBindings = [];
        for (const token of publicKeys) {
            const registration = Reflect.get(overrides, token);
            (0, registration_1.normalize)(registration);
            selectedBindings.push([token, registration]);
        }
        return new Bag(this.#graph.withPublicBindings(selectedBindings), this.context);
    }
    /**
     * Close this bag, drain in-flight work, and dispose owned resources once.
     * Dependents are disposed before dependencies; remaining independent acquisitions use
     * reverse acquisition order. Repeated calls return the same promise.
     * @returns The shared shutdown promise.
     * @throws {@link DiBagCleanupError} when one or more disposers fail after all cleanup is attempted.
     */
    close() {
        return this.#runtime.close();
    }
}
/**
 * An immutable, type-checked application graph builder.
 * Create one with {@link Facade.begin}; every operation returns a new builder.
 */
class Builder {
    context;
    #graph;
    constructor(graph, context) {
        this.context = context;
        this.#graph = graph;
    }
    // Infer actual keys before checking context-sensitive method-returning factories.
    /**
     * Add new string-named registrations.
     * @param more - A finite object whose own string keys are service names and values are registrations.
     * @returns A new builder containing snapshots of the supplied registrations.
     * @throws If the input is malformed, contains a non-string key, or duplicates a public name.
     */
    add(more) {
        const snapshot = (0, registration_1.snapshotAdd)(more, key => this.#graph.hasPublic(key));
        // The snapshot retains every checked own registration, including hidden keys.
        return new Builder(this.#graph.withPublicRegistrations(snapshot), this.context);
    }
    /**
     * Add another lookup name or token for an existing service.
     * @param destination - A new string name or typed token.
     * @param target - The existing name or token whose canonical acquisition is reused.
     * @returns A new builder; aliases add no cache or ownership of their own.
     */
    alias(destination, target, ...invalid) {
        const [key, registration] = (0, aliases_1.aliasEntry)(destination, target, key => this.#graph.hasPublic(key));
        return new Builder(this.#graph.withPublicBinding(key, registration), this.context);
    }
    /**
     * Append a provider to a typed-token collection.
     * @param token - The collection's typed token.
     * @param registration - A registration whose output satisfies the token service type.
     * @returns A new builder preserving contribution order.
     */
    // A named callable keeps extracted generic methods nameable in consumer declarations.
    contribute = ((token, registration) => {
        const [key, value] = (0, contributions_1.contributionEntry)(token, registration);
        return new Builder(this.#graph.withContribution(key, value), this.context);
    });
    /**
     * Bind a registration to a typed token.
     * @param token - A new typed token identity.
     * @param registration - A registration whose exposed output satisfies the token service type.
     * @returns A new builder retaining the provider's metadata, lifetime, dependencies, and ownership stages.
     */
    bind(token, registration) {
        const key = (0, tokens_1.readTokenKey)(token);
        if (this.#graph.hasPublic(key))
            throw new Error(`duplicate registration: ${String(key)}`);
        return new Builder(this.#graph.withPublicBinding(key, (0, provider_1.withTokenBinding)(token, registration)), this.context);
    }
    replace(selection, registration) {
        const key = typeof selection === 'string' ? selection : (0, tokens_1.readTokenKey)(selection);
        if (!this.#graph.hasPublic(key)) {
            throw new Error(`replace accepts existing tokens only: ${String(key)}`);
        }
        (0, registration_1.normalize)(registration);
        return new Builder(this.#graph.withPublicBinding(key, registration), this.context);
    }
    /**
     * Install a sealed module, allocating fresh private bindings for this installation.
     * @param module - A module whose public names do not collide and whose external requirements remain checkable.
     * @returns A new builder exposing only the module's selected exports.
     */
    install(module) {
        return new Builder(this.#graph.withInstallation((0, module_1.moduleGraph)(module)), this.context);
    }
    /**
     * Finish a complete graph as a lazy bag.
     * @returns A fresh bag that owns the acquisitions it creates.
     * @throws At runtime if automatic acquisition is used without a configured Promise classifier.
     */
    end() {
        return new Bag(this.#graph, this.context);
    }
    /**
     * Create a fresh bag and acquire selected services before returning it.
     * @param keys - A finite tuple of existing names or typed tokens to make ready.
     * @param options - Optional cancellation signal, positive timeout, and parallel, sequential, or positive safe integer bounded scheduling.
     * @returns A promise for the new bag after every selected final stage is ready.
     * @throws {@link DiBagStartupError} after rollback on acquisition failure, or
     * {@link DiBagStartupCancelledError} promptly on abort or timeout.
     */
    async start(keys, options) {
        const runtime = await (0, startup_1.startRuntime)(this.#graph, this.context, keys, options);
        return new Bag(this.#graph, this.context, runtime);
    }
}
function facade(context) {
    return Object.freeze({
        configure: (options) => facade((0, acquisition_mode_1.runtimeContext)(options, context)),
        observe: (options) => facade(Object.freeze({ ...context, observers: observers_1.Observers.append(context.observers, options) })),
        factory: provider_1.factory,
        token: tokens_1.token,
        optional: dependency_references_1.optional,
        lazy: dependency_references_1.lazy,
        all: dependency_references_1.all,
        fromTokens: provider_1.fromTokens,
        fromPlugin: plugins_1.fromPlugin,
        fromFunction: composition_1.fromFunction,
        fromClass: composition_1.fromClass,
        begin: () => new Builder(new runtime_1.BindingGraph(), context),
        module: module_1.beginModule,
        withDisposal: registration_1.withDisposal,
        withLifetime: lifetime_1.withLifetime,
        withContext: acquisition_context_1.withContext,
        withMetadata: provider_1.withMetadata,
        mapSync: provider_1.mapSync,
        mapAsync: provider_1.mapAsync,
    });
}
/** The portable, immutable DI Bag facade. Configure `auto` acquisition or use explicit modes. */
exports.DiBag = facade(acquisition_mode_1.unconfigured);
