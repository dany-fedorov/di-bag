import type { Registration } from './registration';
/** Authenticate and snapshot one entry before creating its independent binding. */
export declare function contributionEntry(token: unknown, registration: Registration): readonly [symbol, Registration];
