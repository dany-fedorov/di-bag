import { DiBag, DiBagDisposalError } from 'di-bag';
import type { Container, Container as AnyBag, Builder } from 'di-bag';
import type * as DiBagTypes from 'di-bag';

export type { Container as Bag } from 'di-bag';
export { DiBagDisposalError as DiBagCleanupError };

type Registrations = Record<string, () => unknown>;
export type App = Container<Registrations>;
export type Other = AnyBag<Registrations>;
export type Qualified = DiBagTypes.Container<Registrations>;
export type Lazy = import('di-bag').Container<Registrations>;
export type Unchanged = Builder<never>;

// A local type with a library name is not a library type.
interface Shelf { Bag: string }
export const shelf: Shelf = { Bag: 'paper' };

export function isCleanup(error: unknown): error is DiBagDisposalError {
  return error instanceof DiBagDisposalError;
}

export const bag: Container<{ value: () => number }> = DiBag.createBuilder().register({ value: () => 1 }).build();
export const loaded = import('di-bag');
