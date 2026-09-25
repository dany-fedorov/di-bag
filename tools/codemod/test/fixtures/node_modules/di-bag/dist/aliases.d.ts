import type { Registration } from './registration';
import type { BindingKey } from './runtime';
/** Authenticate both selections before constructing any retained registration. */
export declare function aliasEntry(destination: unknown, target: unknown, hasKey: (key: BindingKey) => boolean): readonly [BindingKey, Registration];
