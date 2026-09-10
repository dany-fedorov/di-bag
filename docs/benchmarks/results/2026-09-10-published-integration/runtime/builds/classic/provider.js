"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProvider = createProvider;
exports.fromTokens = fromTokens;
exports.withTokenBinding = withTokenBinding;
exports.transform = transform;
exports.mapSync = mapSync;
exports.mapAsync = mapAsync;
exports.withAcquisitionMetadata = withAcquisitionMetadata;
exports.withAcquisitionMetadataAsync = withAcquisitionMetadataAsync;
exports.withMetadata = withMetadata;
exports.factory = factory;
const provider_operations_1 = require("./provider-operations");
const tokens_1 = require("./tokens");
const dependency_references_1 = require("./dependency-references");
const acquisition_mode_1 = require("./acquisition-mode");
// Non-generic admission preserves invariant concrete contracts at graph boundaries.
/** A type-only common contract for immutable provider descriptions. */
class ProviderBase {
}
/**
 * An immutable provider description retaining factory, metadata, inspection-frame,
 * dependency-graph, and acquired-value contracts.
 *
 * Create providers through {@link Facade.factory}, composition adapters, or provider
 * decorators. This type-only class has no public constructor.
 */
class Provider extends ProviderBase {
}
/** Internal construction bridge; authentication remains in retainDescription. */
function createProvider() {
    return new Provider();
}
function fromTokens(tokens, callback, ...modeOptions) {
    const acquisition = (0, acquisition_mode_1.acquisitionMode)(modeOptions[0]);
    const references = (0, dependency_references_1.snapshotReferences)(tokens);
    if (typeof callback !== 'function')
        throw new Error('token callback must be a function');
    const create = (deps) => {
        const args = references.map(reference => Reflect.get(deps, reference.slot));
        return Reflect.apply(callback, undefined, args);
    };
    const handle = new Provider();
    (0, provider_operations_1.retainDescription)(handle, (0, provider_operations_1.sourceDescription)(create, undefined, references.map(reference => reference.key), acquisition, false, references));
    return handle;
}
/** Bind a checked output without changing the reusable source's retained needs. */
function withTokenBinding(token, registration) {
    (0, tokens_1.readTokenKey)(token);
    const handle = new Provider();
    (0, provider_operations_1.retainDescription)(handle, (0, provider_operations_1.describe)(registration));
    return handle;
}
/** Extend an authenticated description without exposing its operations. */
function transform(registration, operation) {
    const description = (0, provider_operations_1.describe)(registration);
    const handle = new Provider();
    (0, provider_operations_1.retainDescription)(handle, Object.freeze({ ...description, operations: Object.freeze([...description.operations, Object.freeze(operation)]) }));
    return handle;
}
/**
 * Project a registration's exact source value without awaiting either stage.
 * Dependencies, metadata, earlier ownership stages, and lifetime policy are retained;
 * mapping itself does not transfer ownership.
 * @param registration - The source factory, owned factory, or provider.
 * @param project - A receiver-free projector called with the exact exposed source value.
 * @param modeOptions - Optional acquisition mode for the projected result.
 * @returns A reusable provider exposing the projector's exact return value.
 * @typeParam P - The exact synchronous projector signature retained by the provider.
 */
function mapSync(registration, project, ...modeOptions) {
    return transform(registration, { kind: 'map-sync', project, acquisition: (0, acquisition_mode_1.acquisitionMode)(modeOptions[0]) });
}
/**
 * Await a registration's source and projector result through an explicit async boundary.
 * Dependencies, metadata, earlier ownership stages, and lifetime policy are retained.
 * @param registration - The source factory, owned factory, or provider.
 * @param project - A receiver-free projector receiving the awaited source value.
 * @returns A provider exposing a native Promise of the awaited projection.
 * @typeParam P - The exact asynchronous-boundary projector signature retained by the provider.
 */
function mapAsync(registration, project) {
    return transform(registration, { kind: 'map-async', project, acquisition: 'native' });
}
/**
 * Describe the exact source output with acquisition-local metadata, without awaiting it.
 * Retains the source value identity, acquisition mode, dependencies, lifetime, and ownership.
 * @param registration - The source registration to describe.
 * @param describe - A receiver-free synchronous callback returning a plain object record.
 * @returns A provider appending a shallowly copied and frozen metadata frame per acquisition.
 * @typeParam P - The exact synchronous metadata callback signature retained by the provider.
 * @throws If the callback or its returned record is invalid, or annotation fails.
 */
function withAcquisitionMetadata(registration, describe) {
    return annotate(registration, describe, false);
}
/**
 * Await the source and describe its fulfilled value with acquisition-local metadata.
 * Dependencies, lifetime, and existing ownership are retained; annotation adds no ownership.
 * @param registration - The source registration to await and describe.
 * @param describe - A receiver-free synchronous callback returning a plain object record.
 * @returns A provider exposing a native Promise of the source value and appending a frozen frame.
 * @typeParam P - The exact synchronous metadata callback signature retained by the provider.
 * @throws If the callback is invalid; source and annotation failures reject asynchronously.
 */
function withAcquisitionMetadataAsync(registration, describe) {
    return annotate(registration, describe, true);
}
function annotate(registration, callback, async) {
    if (typeof callback !== 'function')
        throw new TypeError('acquisition metadata requires a function');
    const description = (0, provider_operations_1.describe)(registration);
    // Decoration retains the current output stage's mode even across metadata and ownership.
    let acquisition = description.source.acquisition;
    for (const operation of description.operations) {
        if ('acquisition' in operation)
            acquisition = operation.acquisition;
    }
    return transform(registration, {
        kind: async ? 'frame-async' : 'frame-sync',
        acquisition: async ? 'native' : acquisition,
        project(value) {
            const metadata = callback(value);
            if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
                return invalidAcquisitionMetadata(metadata);
            }
            const prototype = Object.getPrototypeOf(metadata);
            if (prototype !== null && prototype !== Object.prototype)
                return invalidAcquisitionMetadata(metadata);
            const frame = Object.create(null);
            for (const key of Reflect.ownKeys(metadata))
                frame[key] = Reflect.get(metadata, key);
            const then = Object.hasOwn(frame, 'then') ? frame.then : Reflect.get(metadata, 'then');
            if (typeof then === 'function')
                return invalidAcquisitionMetadata(metadata);
            return { value, frame: Object.freeze(frame) };
        },
    });
}
function invalidAcquisitionMetadata(value) {
    // A widened callback can return a rejected Promise. Observe that invalid result
    // before throwing, without reading its `then` or assimilating service values.
    // The intrinsic rejects non-Promise receivers without invoking user code.
    try {
        Promise.prototype.then.call(value, () => { }, () => { });
    }
    catch { /* Not an observable native Promise. */ }
    throw new TypeError('acquisition metadata must be a synchronous plain object record');
}
/**
 * Attach static metadata without evaluating the registration or transferring ownership.
 * Own string and symbol keys are copied and frozen; payload objects keep their identity.
 * @param registration - The source registration to describe.
 * @param metadata - A finite, noncolliding metadata record.
 * @returns A provider retaining the source output, dependencies, frames, and ownership stages.
 * @throws If metadata is not an object or an own key duplicates existing metadata.
 */
function withMetadata(registration, metadata) {
    const description = (0, provider_operations_1.describe)(registration);
    if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
        throw new Error('metadata must be a string or symbol-keyed object');
    }
    const keys = Reflect.ownKeys(metadata);
    for (const key of keys) {
        if (Object.hasOwn(description.metadata, key))
            throw new Error(`duplicate metadata: ${String(key)}`);
    }
    // Preflight all keys before evaluating a getter; copy hidden entries as data too.
    const added = Object.create(null);
    for (const key of keys)
        added[key] = Reflect.get(metadata, key);
    Object.freeze(added);
    const combined = Object.freeze(Object.assign(Object.create(null), description.metadata, added));
    const handle = new Provider();
    (0, provider_operations_1.retainDescription)(handle, Object.freeze({
        ...description,
        operations: Object.freeze([...description.operations, Object.freeze({ kind: 'metadata', metadata: added })]),
        metadata: combined,
    }));
    return handle;
}
/**
 * Describe a factory with explicit result acquisition semantics and no ownership transfer.
 * `raw` exposes the exact result, `native` observes Promise fulfillment, and `auto` uses
 * the facade's configured native-Promise predicate.
 * @param create - A receiver-free service factory.
 * @param options - The required acquisition mode for its result.
 * @returns An immutable provider description; the factory remains lazy and per-bag cached.
 * @throws If the factory or acquisition option is invalid.
 */
function factory(create, options) {
    if (typeof create !== 'function')
        throw new Error('factory requires a function');
    if (options === undefined || options === null)
        throw new Error('factory requires an acquisition mode');
    const { acquisition } = options;
    if (acquisition === undefined)
        throw new Error('factory requires an acquisition mode');
    const mode = (0, acquisition_mode_1.acquisitionMode)({ acquisition });
    const handle = new Provider();
    (0, provider_operations_1.retainDescription)(handle, (0, provider_operations_1.sourceDescription)(create, undefined, [], mode));
    return handle;
}
