import { expect, test } from 'bun:test';
import { finalAdversarialExpectedResult, runFinalAdversarialSourceMatrix } from './final-adversarial-runtime-fixture';

// This probe accepts only the already-recorded I12 ordering defect so every other row remains
// independently selectable while the unmodified runtime retains the precise I12 RED below.
const nonI12Probe = runFinalAdversarialSourceMatrix(true);

for (const id of ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8', 'I9', 'I10', 'I11', 'I13'] as const) {
  test(`${id} preserves its deterministic adversarial source oracle`, async () => {
    expect((await nonI12Probe)[id]).toEqual(finalAdversarialExpectedResult[id]);
  });
}

test('I12 preserves immediate ownership before accepted late cleanup', async () => {
  expect((await runFinalAdversarialSourceMatrix()).I12).toEqual(finalAdversarialExpectedResult.I12);
});
