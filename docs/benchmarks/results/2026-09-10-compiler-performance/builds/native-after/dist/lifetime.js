"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withLifetime = withLifetime;
const provider_1 = require("./provider");
const provider_operations_1 = require("./provider-operations");
function withLifetime(registration, lifetime, options) {
    if (lifetime !== 'root' && lifetime !== 'scoped' && lifetime !== 'transient')
        throw new Error('invalid lifetime policy');
    let captureScoped = false;
    if (options !== undefined) {
        if (typeof options !== 'object' || options === null || Array.isArray(options))
            throw new Error('invalid lifetime options');
        const keys = Reflect.ownKeys(options);
        if (keys.some(key => key !== 'captureScoped') || ('captureScoped' in options && !Object.hasOwn(options, 'captureScoped')))
            throw new Error('invalid lifetime options');
        if (keys.length) {
            if (lifetime !== 'root')
                throw new Error('lifetime capture options require root');
            const selected = Reflect.get(options, 'captureScoped');
            if (typeof selected !== 'boolean')
                throw new Error('invalid lifetime capture value');
            captureScoped = selected;
        }
    }
    const policy = Object.freeze({ kind: lifetime, captureScoped });
    const description = (0, provider_operations_1.describe)(registration);
    const handle = (0, provider_1.createProvider)();
    (0, provider_operations_1.retainDescription)(handle, Object.freeze({ ...description, lifetime: policy }));
    return handle;
}
