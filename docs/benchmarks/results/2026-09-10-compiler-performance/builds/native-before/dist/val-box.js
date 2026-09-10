"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fromValBox = fromValBox;
exports.fromValBoxAsync = fromValBoxAsync;
const provider_1 = require("./provider");
const acquisition_mode_1 = require("./acquisition-mode");
function fromValBox(registration, options) {
    return adapt(registration, options, false);
}
function fromValBoxAsync(registration, options) {
    return adapt(registration, options, true);
}
function adapt(registration, options, async) {
    if (options !== undefined && (options === null || typeof options !== 'object'))
        throw new Error('invalid val-box value options');
    const selected = options?.value;
    if (options !== undefined && selected === undefined && (async || !('acquisition' in options)))
        throw new Error('val-box options require a value selection');
    const mode = selected === undefined ? 'required' : selected;
    if (mode !== 'required' && mode !== 'presence')
        throw new Error('invalid val-box value mode');
    const acquisition = async ? 'native' : (0, acquisition_mode_1.acquisitionMode)(options, mode === 'presence' ? 'raw' : 'auto');
    if (!async && mode === 'presence' && acquisition === 'native')
        throw new Error('native acquisition is invalid for val-box presence');
    return (0, provider_1.transform)(registration, {
        kind: async ? 'frame-async' : 'frame-sync',
        acquisition: async ? 'native' : acquisition,
        project(box) {
            if (box === null || (typeof box !== 'object' && typeof box !== 'function'))
                throw new Error('invalid val-box snapshot capability');
            const method = Reflect.get(box, 'snapshot');
            if (typeof method !== 'function')
                throw new Error('invalid val-box snapshot capability');
            const snapshot = Reflect.apply(method, box, []);
            if (!record(snapshot))
                throw new Error('invalid val-box snapshot');
            const value = copyPresence(snapshot.value);
            const metadata = copyPresence(snapshot.metadata);
            const alias = snapshot.alias;
            if (alias !== null && typeof alias !== 'string')
                throw new Error('invalid val-box snapshot alias');
            const frame = Object.freeze({ kind: 'val-box', metadata, alias });
            if (mode === 'presence')
                return { value, frame };
            if (!value.present)
                throw new Error('val-box value is absent');
            return { value: value.value, frame };
        },
    });
}
function record(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function copyPresence(value) {
    if (!record(value))
        throw new Error('invalid val-box snapshot presence');
    const present = value.present;
    if (present === false)
        return Object.freeze({ present: false });
    if (present !== true || !('value' in value))
        throw new Error('invalid val-box snapshot presence');
    return Object.freeze({ present: true, value: value.value });
}
