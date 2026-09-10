"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aliasEntry = aliasEntry;
const provider_1 = require("./provider");
const provider_operations_1 = require("./provider-operations");
const tokens_1 = require("./tokens");
/** Authenticate both selections before constructing any retained registration. */
function aliasEntry(destination, target, hasKey) {
    const key = typeof destination === 'string' ? destination : (0, tokens_1.readTokenKey)(destination);
    const targetKey = typeof target === 'string' ? target : (0, tokens_1.readTokenKey)(target);
    if (hasKey(key))
        throw new Error(`duplicate registration: ${String(key)}`);
    if (typeof target === 'string' && !hasKey(targetKey))
        throw new Error('alias requires an existing named target');
    const handle = (0, provider_1.createProvider)();
    // This source is unreachable: canonical routing happens before evaluation.
    // Raw prevents an alias from inventing Promise-classification requirements.
    (0, provider_operations_1.retainDescription)(handle, Object.freeze({
        ...(0, provider_operations_1.sourceDescription)(() => { throw new Error('alias source cannot execute'); }, undefined, [], 'raw'),
        alias: targetKey,
    }));
    return [key, handle];
}
