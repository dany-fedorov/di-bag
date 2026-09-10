"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unconfigured = void 0;
exports.runtimeContext = runtimeContext;
exports.acquisitionMode = acquisitionMode;
exports.requireClassificationCapability = requireClassificationCapability;
exports.unconfigured = Object.freeze({});
function runtimeContext(options, previous = exports.unconfigured) {
    if (typeof options !== 'object' || options === null)
        throw new Error('configuration requires isNativePromise');
    const { isNativePromise } = options;
    if (typeof isNativePromise !== 'function')
        throw new Error('configuration requires isNativePromise');
    return Object.freeze({ ...previous, isNativePromise });
}
function acquisitionMode(options, fallback = 'auto') {
    if (options === undefined)
        return fallback;
    if (typeof options !== 'object' || options === null)
        throw new Error('invalid acquisition options');
    const selected = options.acquisition;
    const mode = selected === undefined ? fallback : selected;
    if (mode !== 'auto' && mode !== 'raw' && mode !== 'native')
        throw new Error('invalid acquisition mode');
    return mode;
}
function requireClassificationCapability(modes, context) {
    if (context.isNativePromise)
        return;
    for (const mode of modes)
        if (mode === 'auto') {
            throw new Error('Automatic acquisition classification requires DiBag.configure, di-bag/node, or explicit acquisition modes');
        }
}
