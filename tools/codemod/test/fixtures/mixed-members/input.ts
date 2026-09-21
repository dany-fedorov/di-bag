import { DiBag } from 'di-bag';
import type { DiBagCloseCancelledError, DiBagStartupCancelledError, LifecycleEvent, Presence } from 'di-bag';
import type { BagRuntime } from '../node_modules/di-bag/dist/runtime.js';

class Registry {
  resolve(name: string): unknown { return name; }
}

declare const choose: boolean;
const bag = DiBag.createBuilder().register({ value: () => 1 }).build();
const mixed = choose ? bag : new Registry();
export const called = mixed.resolve('value');
export const referenced = mixed.resolve;
export const { resolve: destructured } = mixed;

interface OwnPresence {
  readonly present: true;
  readonly value: number;
}

export const presence: Presence<number> | OwnPresence = { present: true, value: 1 };

interface OwnEvent {
  readonly kind: 'scope-opened' | 'scope-closed';
  readonly scopeId: symbol;
}

export const opened = (event: LifecycleEvent | OwnEvent) => event.kind === 'scope-opened';

declare const runtime: BagRuntime;
const libraryMixed = choose ? bag : runtime;
export const conflicting = libraryMixed.resolve('value');

declare const cleanupError: DiBagStartupCancelledError | DiBagCloseCancelledError;
export const conflictingProperty = cleanupError.cleanupPromise;
