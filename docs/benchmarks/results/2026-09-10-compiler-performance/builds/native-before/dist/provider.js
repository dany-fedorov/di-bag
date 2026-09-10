"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProvider = createProvider;
exports.fromTokens = fromTokens;
exports.withTokenBinding = withTokenBinding;
exports.transform = transform;
exports.mapSync = mapSync;
exports.mapAsync = mapAsync;
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
