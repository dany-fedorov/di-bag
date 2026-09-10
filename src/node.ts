// This CJS host boundary stays buildable without requiring consumer Node types.
declare const require: (specifier: 'node:util/types') => { isPromise: (this: void, value: unknown) => boolean };
const { isPromise } = require('node:util/types');
import { DiBag as CoreDiBag } from './di-bag';
export * from './index';
/** The Node/Bun facade preconfigured with the host's native-Promise classifier. */
export const DiBag: typeof CoreDiBag = CoreDiBag.withConfiguration({ runtime: { isNativePromise: isPromise } });
