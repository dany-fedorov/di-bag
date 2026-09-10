"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fromSasBox = fromSasBox;
const provider_1 = require("./provider");
const acquisition_mode_1 = require("./acquisition-mode");
/**
 * Adapt a structural sas-box capability without transferring ownership.
 * `sync` invokes the immediate capability, `async` awaits the box and async capability,
 * and `sync-first` prefers a defined synchronous capability before falling back to async.
 * @param registration - A registration exposing the required structural box capability.
 * @param options - Required capability mode; acquisition is accepted only for `sync`.
 * @returns A provider retaining source dependencies, metadata, frames, lifetime, and ownership.
 * @throws If the selected runtime capability is missing or not callable.
 */
function fromSasBox(registration, options) {
    const { mode } = options;
    if (mode !== 'sync' && mode !== 'async' && mode !== 'sync-first')
        throw new Error('invalid sas-box mode');
    if (mode !== 'sync' && 'acquisition' in options)
        throw new Error('acquisition options require the synchronous sas-box mode');
    const acquisition = mode === 'sync' ? (0, acquisition_mode_1.acquisitionMode)(options) : 'native';
    return (0, provider_1.transform)(registration, {
        kind: mode === 'sync' ? 'map-sync' : 'map-async',
        acquisition: mode === 'sync' ? acquisition : 'native',
        project(value) {
            if (value === null || (typeof value !== 'object' && typeof value !== 'function'))
                throw new Error('invalid sas-box capability');
            const box = value;
            const sync = mode === 'async' ? undefined : box.sync;
            const selected = mode === 'sync' || (mode === 'sync-first' && typeof sync === 'function') ? sync : box.async;
            if (typeof selected !== 'function')
                throw new Error('invalid sas-box capability');
            return Reflect.apply(selected, box, []);
        },
    });
}
