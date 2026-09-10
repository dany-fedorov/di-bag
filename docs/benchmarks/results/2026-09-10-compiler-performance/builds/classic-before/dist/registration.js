"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalize = void 0;
exports.withDisposal = withDisposal;
exports.snapshotAdd = snapshotAdd;
const provider_1 = require("./provider");
const provider_operations_1 = require("./provider-operations");
var provider_operations_2 = require("./provider-operations");
Object.defineProperty(exports, "normalize", { enumerable: true, get: function () { return provider_operations_2.normalize; } });
// A private member is lost on spread; structural copies cannot be registrations.
class Owned {
    create;
    constructor(create) {
        this.create = create;
    }
}
function withDisposal(registration, dispose) {
    if (typeof registration !== 'function')
        return (0, provider_1.transform)(registration, { kind: 'owned', dispose });
    const handle = new Owned(registration);
    (0, provider_operations_1.retainDescription)(handle, (0, provider_operations_1.sourceDescription)(registration, dispose));
    return handle;
}
/** Preflight every own key before reading getters; retain hidden own entries. */
function snapshotAdd(more, hasKey) {
    if (typeof more !== 'object' || more === null || Array.isArray(more)) {
        throw new Error('registrations must be a string-keyed object');
    }
    const keys = Reflect.ownKeys(more);
    for (const key of keys) {
        if (typeof key !== 'string')
            throw new Error('registration keys must be strings');
        if (hasKey(key))
            throw new Error(`duplicate registration: ${key}`);
    }
    const snapshot = Object.create(null);
    for (const key of keys) {
        const registration = Reflect.get(more, key);
        (0, provider_operations_1.normalize)(registration);
        snapshot[key] = registration;
    }
    return snapshot;
}
