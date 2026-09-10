"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Runtime = exports.BindingGraph = void 0;
const acquisition_1 = require("./acquisition");
const persistent_map_1 = require("./persistent-map");
const persistent_sequence_1 = require("./persistent-sequence");
const errors_1 = require("./errors");
const registration_1 = require("./registration");
const acquisition_mode_1 = require("./acquisition-mode");
const emptyContributions = Object.freeze([]);
const emptyNames = new Map();
/** Immutable descriptions and path-copied lookup storage. Retained maps never escape. */
class BindingGraph {
    #bindings = new persistent_map_1.PersistentMap();
    #publicSlots = new persistent_map_1.PersistentMap();
    #publicReferences = new persistent_map_1.PersistentMap();
    #lexicalUsers = new persistent_map_1.PersistentMap();
    #privateReferences = new persistent_map_1.PersistentMap();
    #contributed = new persistent_map_1.PersistentMap();
    // Only former public bindings are candidates; constructor-only private
    // registrations remain available to whole-graph preflight.
    #obsolete = new persistent_map_1.PersistentMap();
    #contributions = new persistent_map_1.PersistentMap();
    #bindingCache = new Map();
    #registrationCache = new Map();
    #publicCache = new Map();
    #contributionCache = new Map();
    #explicitlyClassified = false;
    constructor(description = { bindings: new Map(), publicSlots: new Map() }) {
        const lexicalSnapshots = new Map();
        for (const [id, binding] of description.bindings) {
            let lexical = lexicalSnapshots.get(binding.localNames);
            if (!lexical) {
                const snapshot = new Map();
                const privateIds = [];
                for (const [name, ref] of binding.localNames) {
                    const copiedRef = Object.freeze({ ...ref });
                    snapshot.set(name, copiedRef);
                    if (copiedRef.kind === 'private')
                        privateIds.push(copiedRef.id);
                }
                lexical = { id: Symbol('lexical'), names: snapshot, privateIds };
                lexicalSnapshots.set(binding.localNames, lexical);
                for (const target of privateIds)
                    this.#privateReferences = this.#privateReferences.set(target, (this.#privateReferences.get(target) ?? 0) + 1);
            }
            this.#lexicalUsers = this.#lexicalUsers.set(lexical.id, (this.#lexicalUsers.get(lexical.id) ?? 0) + 1);
            this.#bindings = this.#bindings.set(id, {
                lexical,
                description: Object.freeze({ id: binding.id, label: binding.label, registration: binding.registration, localNames: lexical.names }),
                normalized: Object.freeze((0, registration_1.normalize)(binding.registration)),
            });
        }
        for (const [key, id] of description.publicSlots) {
            this.#publicSlots = this.#publicSlots.set(key, id);
            this.#publicReferences = this.#publicReferences.set(id, (this.#publicReferences.get(id) ?? 0) + 1);
        }
        for (const [key, ids] of description.contributions ?? []) {
            const snapshot = Object.freeze([...ids]);
            this.#contributions = this.#contributions.set(key, { values: snapshot });
            for (const id of snapshot)
                this.#contributed = this.#contributed.set(id, true);
        }
    }
    /** Share only storage roots. Caches never retain ancestor wrappers or old arrays. */
    copy() {
        const graph = new BindingGraph();
        graph.#bindings = this.#bindings;
        graph.#publicSlots = this.#publicSlots;
        graph.#publicReferences = this.#publicReferences;
        graph.#lexicalUsers = this.#lexicalUsers;
        graph.#privateReferences = this.#privateReferences;
        graph.#contributed = this.#contributed;
        graph.#obsolete = this.#obsolete;
        graph.#contributions = this.#contributions;
        return graph;
    }
    entry(id) {
        const entry = this.#bindings.get(id);
        if (entry) {
            this.#bindingCache.set(id, entry.description);
            this.#registrationCache.set(id, entry.normalized);
        }
        return entry;
    }
    slot(key) {
        const id = this.#publicSlots.get(key);
        if (id !== undefined)
            this.#publicCache.set(key, id);
        return id;
    }
    addBinding(label, registration) {
        const id = Symbol(label);
        this.#bindings = this.#bindings.set(id, {
            description: Object.freeze({ id, label, registration, localNames: emptyNames }),
            normalized: Object.freeze((0, registration_1.normalize)(registration)),
        });
        return id;
    }
    contributionBindings(key) {
        let ids = this.#contributionCache.get(key);
        if (!ids) {
            const sequence = this.#contributions.get(key);
            if (!sequence)
                return emptyContributions;
            ids = (0, persistent_sequence_1.materialize)(sequence);
            this.#contributionCache.set(key, ids);
        }
        return ids;
    }
    withContribution(key, registration) {
        const graph = this.copy();
        const id = graph.addBinding(`contribution:${String(key)}`, registration);
        graph.#contributions = graph.#contributions.set(key, (0, persistent_sequence_1.append)(graph.#contributions.get(key), { values: [id] }));
        graph.#contributed = graph.#contributed.set(id, true);
        return graph;
    }
    hasPublic(key) { return this.#publicCache.has(key) || this.#publicSlots.has(key); }
    hasBinding(id) { return this.#bindings.has(id); }
    /** Immutable graphs need explicit-mode validation only once; configured forks are O(1). */
    preflight(context) {
        if (context.isNativePromise || this.#explicitlyClassified)
            return;
        for (const [, { normalized: description }] of this.#bindings) {
            (0, acquisition_mode_1.requireClassificationCapability)([description.acquisition, ...description.operations.flatMap(operation => 'acquisition' in operation ? [operation.acquisition] : [])], context);
        }
        this.#explicitlyClassified = true;
    }
    publicBinding(key) {
        return this.#publicCache.get(key) ?? this.requirePublicBinding(key);
    }
    requirePublicBinding(key) {
        const id = this.slot(key);
        if (id === undefined)
            throw new Error(`no factory for ${String(key)}`);
        return id;
    }
    findDependency(from, localName) {
        const ref = (this.#bindingCache.get(from) ?? this.entry(from)?.description)?.localNames.get(localName);
        if (ref?.kind === 'private')
            return ref.id;
        const key = ref?.key ?? localName;
        return this.#publicCache.get(key) ?? this.slot(key);
    }
    dependency(from, localName) {
        const ref = (this.#bindingCache.get(from) ?? this.entry(from)?.description)?.localNames.get(localName);
        return ref?.kind === 'private' ? ref.id : this.publicBinding(ref?.key ?? localName);
    }
    registration(id) {
        return this.#registrationCache.get(id) ?? this.requireRegistration(id);
    }
    requireRegistration(id) {
        const registration = this.entry(id)?.normalized;
        if (!registration)
            throw new Error(`no factory for ${this.label(id)}`);
        return registration;
    }
    label(id) { return (this.#bindingCache.get(id) ?? this.entry(id)?.description)?.label ?? String(id); }
    withPublicRegistrations(registrations) {
        return this.withPublicBindings(Object.keys(registrations).map(key => [key, registrations[key]]));
    }
    /** Replace ordered slots and prune only unreferenced public replacement history. */
    withPublicBindings(entries) {
        if (entries.length === 0)
            return this;
        const graph = this.copy();
        for (const [key, registration] of entries) {
            const previous = graph.#publicSlots.get(key);
            const id = graph.addBinding(String(key), registration);
            graph.#publicSlots = graph.#publicSlots.set(key, id);
            graph.#publicReferences = graph.#publicReferences.set(id, 1);
            if (previous !== undefined) {
                const remaining = (graph.#publicReferences.get(previous) ?? 1) - 1;
                if (remaining)
                    graph.#publicReferences = graph.#publicReferences.set(previous, remaining);
                else {
                    graph.#publicReferences = graph.#publicReferences.delete(previous);
                    graph.#obsolete = graph.#obsolete.set(previous, true);
                    graph.prune([previous]);
                }
            }
        }
        return graph;
    }
    withPublicBinding(key, registration) {
        return this.withPublicBindings([[key, registration]]);
    }
    releaseLexical(entry, pending) {
        const lexical = entry.lexical;
        if (!lexical)
            return;
        const remaining = this.#lexicalUsers.get(lexical.id) - 1;
        if (remaining) {
            this.#lexicalUsers = this.#lexicalUsers.set(lexical.id, remaining);
            return;
        }
        this.#lexicalUsers = this.#lexicalUsers.delete(lexical.id);
        for (const id of lexical.privateIds) {
            const count = this.#privateReferences.get(id) - 1;
            if (count)
                this.#privateReferences = this.#privateReferences.set(id, count);
            else {
                this.#privateReferences = this.#privateReferences.delete(id);
                pending.push(id);
            }
        }
    }
    /** No recursion or graph-wide scan, even when losing a snapshot unlocks a chain. */
    prune(pending) {
        while (pending.length) {
            const id = pending.pop();
            if (!this.#obsolete.has(id) || this.#publicReferences.has(id) || this.#privateReferences.has(id) || this.#contributed.has(id))
                continue;
            const entry = this.#bindings.get(id);
            this.#bindings = this.#bindings.delete(id);
            this.#obsolete = this.#obsolete.delete(id);
            if (entry)
                this.releaseLexical(entry, pending);
        }
    }
    /** Install disjoint public slots atomically, retaining lexical private refs. */
    withInstallation(description) {
        for (const key of description.publicSlots.keys()) {
            if (this.hasPublic(key))
                throw new Error(`duplicate registration: ${String(key)}`);
        }
        const installation = new BindingGraph(description);
        const graph = this.copy();
        const pending = [];
        // Publish all incoming protection before releasing overwritten descriptions.
        for (const [id, count] of installation.#lexicalUsers)
            graph.#lexicalUsers = graph.#lexicalUsers.set(id, count);
        for (const [id, count] of installation.#privateReferences)
            graph.#privateReferences = graph.#privateReferences.set(id, (graph.#privateReferences.get(id) ?? 0) + count);
        for (const [id] of installation.#contributed)
            graph.#contributed = graph.#contributed.set(id, true);
        for (const [key, id] of installation.#publicSlots)
            graph.#publicSlots = graph.#publicSlots.set(key, id);
        for (const [id, count] of installation.#publicReferences)
            graph.#publicReferences = graph.#publicReferences.set(id, (graph.#publicReferences.get(id) ?? 0) + count);
        for (const [id, entry] of installation.#bindings) {
            const previous = graph.#bindings.get(id);
            if (previous)
                graph.releaseLexical(previous, pending);
            graph.#bindings = graph.#bindings.set(id, entry);
            graph.#obsolete = graph.#obsolete.delete(id);
        }
        for (const [key, sequence] of installation.#contributions)
            graph.#contributions = graph.#contributions.set(key, (0, persistent_sequence_1.append)(graph.#contributions.get(key), sequence));
        graph.prune(pending);
        return graph;
    }
}
exports.BindingGraph = BindingGraph;
/** Each runtime owns its acquisitions; immutable descriptions remain reusable. */
class Runtime {
    graph;
    context;
    detach;
    parentAcquisitions;
    acquisitions;
    children = new Set();
    closing;
    constructor(graph, context, detach = undefined, parentAcquisitions, shared = []) {
        this.graph = graph;
        this.context = context;
        this.detach = detach;
        this.parentAcquisitions = parentAcquisitions;
        graph.preflight(context);
        this.acquisitions = new acquisition_1.Acquisitions(graph, context, parentAcquisitions, shared);
        this.observeScope('scope-opened');
    }
    resolve(key) {
        return this.acquisitions.resolve(key);
    }
    resolveAll(key) { return this.acquisitions.resolveAll(key); }
    inspectAll(key) {
        return Object.freeze(this.graph.contributionBindings(key).map(bindingId => this.inspectBinding(bindingId)));
    }
    acquire(key) {
        return this.acquisitions.acquire(key);
    }
    isTransient(key) {
        return this.acquisitions.isTransient(this.graph.publicBinding(key));
    }
    inspect(key) {
        return this.inspectBinding(this.graph.publicBinding(key));
    }
    inspectBinding(bindingId) {
        return Object.freeze({
            bindingId,
            label: this.graph.label(bindingId),
            ...this.acquisitions.inspectDescription(bindingId),
            acquisitions: this.acquisitions.inspect(bindingId),
        });
    }
    assertOpen() {
        if (this.closing)
            throw new Error('bag is closing');
        this.acquisitions.assertOpen();
    }
    scope(graph = this.graph, shared = []) {
        this.assertOpen();
        let child;
        child = new Runtime(graph, this.context, () => { this.children.delete(child); }, this.acquisitions, shared);
        this.children.add(child);
        return child;
    }
    close(cause) {
        if (this.closing)
            return this.closing;
        let fulfill;
        let reject;
        const closing = new Promise((resolve, fail) => { fulfill = resolve; reject = fail; });
        // Publish before recursively closing children or starting local cleanup.
        this.closing = closing;
        this.observeScope('scope-closing');
        const childClosing = [...this.children].map(child => {
            try {
                return child.close(cause);
            }
            catch (error) {
                return Promise.reject(error);
            }
        });
        const childResults = Promise.allSettled(childClosing);
        let localClosing;
        try {
            localClosing = this.acquisitions.close(childClosing.length > 0 ? childResults.then(() => undefined) : undefined, cause);
        }
        catch (error) {
            localClosing = Promise.reject(error);
        }
        void this.finishClose(childResults, localClosing).then(() => { fulfill(); this.observeScope('scope-closed'); }, error => { reject(error); this.observeScope('scope-close-failed', error); });
        const detach = this.detach;
        this.detach = undefined;
        if (detach)
            void closing.then(() => { detach(); }, () => { detach(); });
        return closing;
    }
    observeScope(kind, error) {
        if (!this.context.observers)
            return;
        const fields = {
            scopeId: this.acquisitions.ownerId,
            ...(this.parentAcquisitions ? { parentScopeId: this.parentAcquisitions.ownerId } : {}),
        };
        this.context.observers.emit(kind === 'scope-close-failed' ? { ...fields, kind, error } : { ...fields, kind });
    }
    async finishClose(childResults, localClosing) {
        const [children, local] = await Promise.all([
            childResults,
            localClosing.then(() => ({ status: 'fulfilled', value: undefined }), reason => ({ status: 'rejected', reason })),
        ]);
        const failures = [];
        const unexpected = [];
        for (const result of [...children, local]) {
            if (result.status === 'fulfilled')
                continue;
            if (result.reason instanceof errors_1.DiBagCleanupError)
                failures.push(...result.reason.failures);
            else
                unexpected.push(result.reason);
        }
        if (unexpected.length > 0) {
            const errors = failures.length > 0
                ? [new errors_1.DiBagCleanupError(failures), ...unexpected]
                : unexpected;
            throw new AggregateError(errors, `Failed to close ${errors.length} runtime operation(s)`);
        }
        if (failures.length > 0)
            throw new errors_1.DiBagCleanupError(failures);
    }
}
exports.Runtime = Runtime;
