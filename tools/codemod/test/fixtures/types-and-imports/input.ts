import { DiBag, DiBagCleanupError } from 'di-bag/node';
import type { Bag, Bag as AnyBag, Builder } from 'di-bag/node';
import type * as DiBagTypes from 'di-bag';

export type { Bag } from 'di-bag/node';
export { DiBagCleanupError };

type Registrations = Record<string, () => unknown>;
export type App = Bag<Registrations>;
export type Other = AnyBag<Registrations>;
export type Qualified = DiBagTypes.Bag<Registrations>;
export type Lazy = import('di-bag/node').Bag<Registrations>;
export type Unchanged = Builder<never>;

// A local type with a library name is not a library type.
interface Shelf { Bag: string }
export const shelf: Shelf = { Bag: 'paper' };

export function isCleanup(error: unknown): error is DiBagCleanupError {
  return error instanceof DiBagCleanupError;
}

export const bag: Bag<{ value: () => number }> = DiBag.createBuilder().register({ value: () => 1 }).build();
export const loaded = import('di-bag/node');
