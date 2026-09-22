import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';
import { deferred } from './helpers';

type Diagnostic = { readonly code: string; readonly details: Readonly<Record<string, unknown>>; readonly message: string };
const thrown = (run: () => unknown): Diagnostic => {
  try { run(); } catch (error) { return error as Diagnostic; }
  throw new Error('expected a throw');
};
const turn = () => new Promise<void>(resolve => setImmediate(resolve));

test('forCollectionOf creates a frozen genuine handle next to of', () => {
  const key = Symbol('numbers');
  const factory = DiBag.token(key);
  expect(Object.keys(factory)).toEqual(['of', 'forCollectionOf']);
  expect(Object.isFrozen(factory)).toBe(true);
  const numbers = factory.forCollectionOf<number>();
  expect(numbers.key).toBe(key);
  expect(Object.isFrozen(numbers)).toBe(true);
  expect(numbers).not.toBe(factory.forCollectionOf<number>());
  for (const fake of [{ ...numbers }, Object.create(numbers), { key }]) {
    expect(thrown(() => (DiBag.createBuilder().contribute as Function)(fake, () => 1)).code).toBe('DI_BAG_INVALID_TOKEN');
  }
});

test('register rejects a collection token as the wrong kind, before it reads the provider', () => {
  const key = Symbol('numbers');
  const numbers = DiBag.token(key).forCollectionOf<number>();
  const error = thrown(() => (DiBag.createBuilder().register as Function)(numbers, 'not a provider'));
  expect(error.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
  expect(error.details).toEqual({ operation: 'register', expectedKind: 'single-service', receivedKind: 'collection' });
  expect(Object.isFrozen(error.details)).toBe(true);
  expect(error.message).toBe('DI_BAG_WRONG_TOKEN_KIND: register requires a single-service token, but Symbol(numbers) is a collection token; see https://dany-fedorov.github.io/di-bag/agent/errors.html#di-bag-wrong-token-kind');
});
