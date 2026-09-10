"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sourceDescription = sourceDescription;
exports.retainDescription = retainDescription;
exports.describe = describe;
exports.normalize = normalize;
const emptyMetadata = Object.freeze({});
const scopedLifetime = Object.freeze({ kind: 'scoped', captureScoped: false });
const descriptions = new WeakMap();
function sourceDescription(create, dispose, tokenKeys = [], acquisition = 'auto', contextual = false, references = []) {
    const selected = Object.freeze([...tokenKeys]);
    const argumentsSnapshot = Object.freeze(references.map(reference => Object.freeze({ ...reference })));
    const source = Object.freeze(dispose ? { kind: 'source', create, dispose, tokenKeys: selected, references: argumentsSnapshot, acquisition, contextual } : { kind: 'source', create, tokenKeys: selected, references: argumentsSnapshot, acquisition, contextual });
    return Object.freeze({ source, operations: Object.freeze([]), metadata: emptyMetadata, lifetime: scopedLifetime });
}
/** One registry authenticates both ownership handles and transformed providers. */
function retainDescription(handle, description) {
    descriptions.set(handle, description);
    Object.freeze(handle);
}
function describe(registration) {
    if (typeof registration === 'function')
        return sourceDescription(registration);
    if (typeof registration === 'object' && registration !== null) {
        const description = descriptions.get(registration);
        if (description)
            return description;
    }
    throw new Error('invalid factory registration');
}
function normalize(registration) {
    const description = describe(registration);
    const { create, dispose, tokenKeys, references, acquisition, contextual } = description.source;
    const { metadata, operations, lifetime } = description;
    const alias = description.alias === undefined ? {} : { alias: description.alias };
    return dispose ? { ...alias, create, dispose, tokenKeys, references, acquisition, metadata, operations, lifetime, contextual } : { ...alias, create, tokenKeys, references, acquisition, metadata, operations, lifetime, contextual };
}
