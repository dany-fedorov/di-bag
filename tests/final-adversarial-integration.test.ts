import { expect, test } from 'bun:test';
import { finalAdversarialExpectedResult, runFinalAdversarialSourceMatrix } from './final-adversarial-runtime-fixture';

for (const id of ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8', 'I9', 'I10', 'I11', 'I13'] as const) {
  test(`${id} preserves its deterministic adversarial source oracle`, async () => {
    expect((await runFinalAdversarialSourceMatrix(id))[id]).toEqual(finalAdversarialExpectedResult[id]);
  });
}

test('I12 disposes accepted late ownership before independent immediate ownership', async () => {
  expect((await runFinalAdversarialSourceMatrix('I12')).I12).toEqual(finalAdversarialExpectedResult.I12);
});
