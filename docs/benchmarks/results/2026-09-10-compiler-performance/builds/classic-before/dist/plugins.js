"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fromPlugin = fromPlugin;
const dependency_references_1 = require("./dependency-references");
const errors_1 = require("./errors");
const provider_1 = require("./provider");
const provider_operations_1 = require("./provider-operations");
function invalidDescriptor(reason) {
    return new errors_1.DiBagPluginError('descriptor', reason);
}
function validateOptions(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error('plugin requires acquisition and validate options');
    }
    if (!Object.hasOwn(value, 'acquisition'))
        throw new Error('plugin requires an acquisition mode');
    const acquisition = Reflect.get(value, 'acquisition');
    if (acquisition !== 'raw' && acquisition !== 'native')
        throw new Error('invalid plugin acquisition mode');
    if (!Object.hasOwn(value, 'validate'))
        throw new Error('plugin requires a validation predicate');
    const validate = Reflect.get(value, 'validate');
    if (typeof validate !== 'function')
        throw new Error('plugin validation predicate must be a function');
    return Object.freeze({ acquisition, validate: validate });
}
function validateDescriptor(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw invalidDescriptor('plugin descriptor must be a non-array object');
    }
    if (!Object.hasOwn(value, 'apiVersion'))
        throw invalidDescriptor('plugin descriptor requires own apiVersion');
    if (Reflect.get(value, 'apiVersion') !== 1)
        throw invalidDescriptor('plugin apiVersion must be 1');
    if (!Object.hasOwn(value, 'create'))
        throw invalidDescriptor('plugin descriptor requires own create');
    const create = Reflect.get(value, 'create');
    if (typeof create !== 'function')
        throw invalidDescriptor('plugin create must be a function');
    if (!Object.hasOwn(value, 'dispose'))
        return Object.freeze({ apiVersion: 1, create });
    const dispose = Reflect.get(value, 'dispose');
    if (typeof dispose !== 'function')
        throw invalidDescriptor('plugin dispose must be a function when present');
    return Object.freeze({ apiVersion: 1, create, dispose });
}
/**
 * Validate an unknown plugin descriptor and its output at a declared dependency boundary.
 * The descriptor must have own `apiVersion: 1` and callable `create`, with an optional
 * callable `dispose`. A disposer owns the original acquired value before validation.
 * @param dependencies - Host values supplied to the plugin in positional order.
 * @param plugin - The application-selected unknown descriptor.
 * @param options - Required raw/native acquisition and a synchronous output predicate.
 * @returns A lazy provider that validates its output when acquired.
 * @throws {@link DiBagPluginError} for an invalid descriptor or rejected output.
 */
function fromPlugin(dependencies, plugin, options) {
    const references = (0, dependency_references_1.snapshotReferences)(dependencies);
    const selected = validateOptions(options);
    const descriptor = validateDescriptor(plugin);
    const create = (deps) => Reflect.apply(descriptor.create, undefined, references.map(reference => Reflect.get(deps, reference.slot)));
    const dispose = descriptor.dispose === undefined ? undefined : (value) => Reflect.apply(descriptor.dispose, undefined, [value]);
    const project = (value) => {
        if (Reflect.apply(selected.validate, undefined, [value]) !== true) {
            throw new errors_1.DiBagPluginError('output', 'plugin output failed validation');
        }
        return value;
    };
    if (selected.acquisition === 'raw') {
        const source = (0, provider_1.createProvider)();
        (0, provider_operations_1.retainDescription)(source, (0, provider_operations_1.sourceDescription)(create, dispose, references.map(reference => reference.key), 'raw', false, references));
        return (0, provider_1.mapSync)(source, project, { acquisition: 'raw' });
    }
    const source = (0, provider_1.createProvider)();
    (0, provider_operations_1.retainDescription)(source, (0, provider_operations_1.sourceDescription)(create, dispose, references.map(reference => reference.key), 'native', false, references));
    return (0, provider_1.mapAsync)(source, project);
}
