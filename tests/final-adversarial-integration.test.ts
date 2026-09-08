import { expect, test } from 'bun:test';
import { finalAdversarialExpectedResult, runFinalAdversarialSourceMatrix } from './final-adversarial-runtime-fixture';

test('I1-I13 preserve the deterministic adversarial source oracle', async () => {
  expect(await runFinalAdversarialSourceMatrix()).toEqual(finalAdversarialExpectedResult);
});
