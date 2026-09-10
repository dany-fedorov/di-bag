"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withContext = withContext;
const provider_1 = require("./provider");
const provider_operations_1 = require("./provider-operations");
const acquisition_mode_1 = require("./acquisition-mode");
/**
 * Adapt a factory to receive the acquisition owner's cancellation context.
 * @param callback - A receiver-free factory taking named dependencies and an {@link AcquisitionContext}.
 * @param modeOptions - Optional acquisition mode for the callback result.
 * @returns A lazy provider whose public factory contract contains only named dependencies.
 * @typeParam F - The exact context-aware callback signature retained by the provider.
 */
function withContext(callback, ...modeOptions) {
    if (typeof callback !== 'function')
        throw new Error('context callback must be a function');
    const mode = (0, acquisition_mode_1.acquisitionMode)(modeOptions[0]);
    const create = (deps, context) => callback(deps, context);
    const handle = (0, provider_1.createProvider)();
    (0, provider_operations_1.retainDescription)(handle, (0, provider_operations_1.sourceDescription)(create, undefined, [], mode, true));
    return handle;
}
