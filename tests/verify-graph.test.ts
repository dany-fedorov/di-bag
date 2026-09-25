import { expect, test } from 'bun:test';
import { DiBag } from '../src';

test('verifyGraph runs no factories, returns undefined, and leaves the builder usable', async () => {
  let calls = 0;
  const builder = DiBag.createBuilder().withServices({ config: () => { calls++; return 1; } });
  expect(builder.verifyGraphAtCompileTime()).toBeUndefined();
  expect(calls).toBe(0);
  const bag = builder.buildContainer();
  expect(bag.resolve('config')).toBe(1);
  await bag.close();
});
