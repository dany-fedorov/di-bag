// This CJS host boundary stays buildable without requiring consumer Node types.
declare const require: (specifier: 'node:util/types') => { isPromise: (this: void, value: unknown) => boolean };
const { isPromise } = require('node:util/types');
import { DiBag as CoreDiBag } from './di-bag';
export * from './index';
export const DiBag: typeof CoreDiBag = CoreDiBag.configure({ isNativePromise: isPromise });
