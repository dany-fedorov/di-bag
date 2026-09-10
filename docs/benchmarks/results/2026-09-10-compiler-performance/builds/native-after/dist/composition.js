"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fromFunction = fromFunction;
exports.fromClass = fromClass;
const acquisition_mode_1 = require("./acquisition-mode");
const provider_1 = require("./provider");
const provider_operations_1 = require("./provider-operations");
const dependency_references_1 = require("./dependency-references");
function fromFunction(tokens, callback, ...modeOptions) {
    const acquisition = (0, acquisition_mode_1.acquisitionMode)(modeOptions[0]);
    const references = (0, dependency_references_1.snapshotReferences)(tokens);
    if (typeof callback !== 'function')
        throw new Error('composition callback must be a function');
    const create = (deps) => Reflect.apply(callback, undefined, references.map(reference => Reflect.get(deps, reference.slot)));
    const handle = (0, provider_1.createProvider)();
    (0, provider_operations_1.retainDescription)(handle, (0, provider_operations_1.sourceDescription)(create, undefined, references.map(reference => reference.key), acquisition, false, references));
    return handle;
}
/**
 * Adapt a concrete constructor while preserving its prototype, private fields, and `new.target`.
 * @param tokens - A finite tuple whose dependency values match the constructor parameters.
 * @param constructor - The concrete class or constructable function to instantiate.
 * @param modeOptions - Optional acquisition mode for the constructed result.
 * @returns A lazy provider that constructs one instance per acquisition attempt.
 * @throws When the supplied runtime value is not constructable.
 */
function fromClass(tokens, constructor, ...modeOptions) {
    const acquisition = (0, acquisition_mode_1.acquisitionMode)(modeOptions[0]);
    const references = (0, dependency_references_1.snapshotReferences)(tokens);
    // A Proxy is constructable exactly when its target is. Its inert trap avoids
    // running the target or reading its prototype, even when the target is a Proxy.
    if (typeof constructor !== 'function')
        throw new Error('composition requires a concrete constructor');
    try {
        Reflect.construct(new Proxy(constructor, { construct: () => ({}) }), []);
    }
    catch {
        throw new Error('composition requires a concrete constructor');
    }
    const create = (deps) => Reflect.construct(constructor, references.map(reference => Reflect.get(deps, reference.slot)));
    const handle = (0, provider_1.createProvider)();
    (0, provider_operations_1.retainDescription)(handle, (0, provider_operations_1.sourceDescription)(create, undefined, references.map(reference => reference.key), acquisition, false, references));
    return handle;
}
