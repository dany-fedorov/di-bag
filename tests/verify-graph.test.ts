import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';

test('verifyGraph runs no factories, returns undefined, and leaves the builder usable', async () => {
  let calls = 0;
  const builder = DiBag.createBuilder().register({ config: () => { calls++; return 1; } });
  expect(builder.verifyGraph()).toBeUndefined();
  expect(calls).toBe(0);
  const bag = builder.build();
  expect(bag.resolve('config')).toBe(1);
  await bag.close();
});
