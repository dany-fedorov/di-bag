import { expect, test } from 'bun:test';
import {
  captureCompilerControlSample,
  collectCompilerControl,
  compilerControlCases,
  compilerControlLanes,
  normalizeCompilerSample,
  summarizeCompilerControl,
  validateCompilerControl,
  type CompilerControlSample,
} from '../scripts/benchmark-compiler-controls.ts';

const negativeCase = compilerControlCases.find(control =>
  control.case === 'named-chained-100-missing',
)!;
const validCase = compilerControlCases.find(control =>
  control.case === 'named-chained-100-valid',
)!;

function completedSample(overrides: Partial<CompilerControlSample> = {}): CompilerControlSample {
  return {
    compiler: 'classic6:6.0.3',
    case: negativeCase.case,
    count: 100,
    form: 'chained',
    scenario: 'missing',
    compileMilliseconds: 1100,
    processMilliseconds: 1400,
    maxRssMiB: 450,
    instantiations: 120_000,
    diagnostics: [{
      file: '/repo/tests/generated-type-scale.ts',
      line: 102,
      code: 2684,
      message: 'This context is required service registrations are missing for missingFinal',
    }],
    boundaryLine: 102,
    accepted: true,
    sourceCommitBefore: 'abc123',
    sourceCommitAfter: 'abc123',
    sourceStatusBefore: '',
    sourceStatusAfter: '',
    sourceSha256Before: 'source-hash',
    sourceSha256After: 'source-hash',
    generatedSha256Before: 'fixture-hash',
    generatedSha256After: 'fixture-hash',
    ...overrides,
  };
}

test('negative controls reject a fast compile that lost its marker', () => {
  expect(validateCompilerControl(negativeCase, completedSample({
    diagnostics: [],
    compileMilliseconds: 1,
  }))).toMatchObject({ accepted: false, reason: 'expected marker missing' });
});

test('negative controls require exactly one marker at the generated boundary', () => {
  const extra = { ...completedSample().diagnostics[0]!, line: 103 };
  expect(validateCompilerControl(negativeCase, completedSample({
    diagnostics: [...completedSample().diagnostics, extra],
  }))).toMatchObject({ accepted: true });
  expect(validateCompilerControl(negativeCase, completedSample({
    diagnostics: [...completedSample().diagnostics, completedSample().diagnostics[0]!],
  }))).toMatchObject({ accepted: false, reason: 'expected marker occurred more than once' });
  expect(validateCompilerControl(negativeCase, completedSample({
    diagnostics: [{ ...completedSample().diagnostics[0]!, code: 2589 }],
  }))).toMatchObject({ accepted: false, reason: 'compiler returned TS2589' });
});

test('valid controls reject diagnostics and case identity substitution', () => {
  const valid = completedSample({
    case: validCase.case,
    scenario: 'valid',
    diagnostics: [],
    boundaryLine: undefined,
  });
  expect(validateCompilerControl(validCase, valid)).toMatchObject({ accepted: true });
  expect(validateCompilerControl(validCase, { ...valid, diagnostics: completedSample().diagnostics })).toMatchObject({ accepted: false, reason: 'valid control returned diagnostics' });
  expect(validateCompilerControl(validCase, { ...valid, count: 1000 })).toMatchObject({ accepted: false, reason: 'control identity mismatch' });
});

test('controls reject invalid work metrics and source provenance drift', () => {
  for (const sample of [
    completedSample({ compileMilliseconds: Number.NaN }),
    completedSample({ processMilliseconds: 0 }),
    completedSample({ maxRssMiB: -1 }),
    completedSample({ instantiations: -1 }),
    completedSample({ instantiations: 0 }),
  ]) {
    expect(validateCompilerControl(negativeCase, sample)).toMatchObject({ accepted: false, reason: 'invalid compiler work metrics' });
  }
  expect(validateCompilerControl(negativeCase, completedSample({ sourceCommitAfter: 'def456' }))).toMatchObject({ accepted: false, reason: 'compiler provenance changed' });
  expect(validateCompilerControl(negativeCase, completedSample({ generatedSha256After: 'other-fixture' }))).toMatchObject({ accepted: false, reason: 'compiler provenance changed' });
  expect(validateCompilerControl(negativeCase, completedSample({
    sourceStatusBefore: ' M src/index.ts',
    sourceStatusAfter: ' M src/index.ts',
  }))).toMatchObject({ accepted: false, reason: 'source tree is dirty' });
});

test('normalizer validates classic work and canonicalizes diagnostic paths', () => {
  const raw = {
    ...completedSample(),
    case: undefined,
    compiler: undefined,
    milliseconds: 123,
    typescript: '6.0.3',
    maxRssMiB: 300,
    instantiations: 456,
    diagnostics: [{
      ...completedSample().diagnostics[0]!,
      file: '/an/ephemeral/checkout/tests/generated-type-scale.ts',
    }],
  };
  expect(normalizeCompilerSample(negativeCase, 'classic6:6.0.3:hash', 'classic', raw)).toMatchObject({
    compiler: 'classic6:6.0.3:hash',
    compileMilliseconds: 123,
    processMilliseconds: 1400,
    maxRssMiB: 300,
    instantiations: 456,
    diagnostics: [{ file: 'tests/generated-type-scale.ts', line: 102, code: 2684 }],
  });
  expect(() => normalizeCompilerSample(negativeCase, 'classic6:6.0.3:hash', 'classic', {
    ...raw,
    diagnostics: [{ ...raw.diagnostics[0]!, file: 7 }],
  })).toThrow('compiler row has malformed diagnostics');
  expect(() => normalizeCompilerSample(negativeCase, 'classic6:6.0.3:hash', 'classic', {
    ...raw,
    typescript: '6.0.4',
  })).toThrow('compiler row identity differs from requested compiler');
});

test('normalizer extracts native extended metrics without substituting process time', () => {
  const raw = {
    ...completedSample(),
    case: undefined,
    compiler: undefined,
    milliseconds: 400,
    typescript: '7.0.2',
    peakObservedRssMiB: 155.5,
    nativeMetrics: { 'Total time': 0.321, Instantiations: 777 },
    diagnostics: [{
      ...completedSample().diagnostics[0]!,
      file: '/tmp/di-bag-native-scale-random/tests/generated-type-scale.ts',
    }],
  };
  expect(normalizeCompilerSample(negativeCase, 'native7:7.0.2:hash', 'native', raw)).toMatchObject({
    compiler: 'native7:7.0.2:hash',
    compileMilliseconds: 321,
    processMilliseconds: 400,
    maxRssMiB: 155.5,
    instantiations: 777,
    diagnostics: [{ file: 'tests/generated-type-scale.ts', line: 102, code: 2684 }],
  });
});

test('summary preserves every ordered sample and derives literal statistics', () => {
  const samples = [1, 2, 3, 4, 100].map((compileMilliseconds, index) =>
    completedSample({
      compileMilliseconds,
      processMilliseconds: compileMilliseconds + 10,
      maxRssMiB: 200 + index,
      instantiations: 1000 + index,
    }));
  expect(summarizeCompilerControl(negativeCase, 'classic6:6.0.3', [], samples)).toMatchObject({
    compiler: 'classic6:6.0.3',
    case: 'named-chained-100-missing',
    warmups: 0,
    samples: 5,
    compileMilliseconds: { values: [1, 2, 3, 4, 100], min: 1, median: 3, p95: 100, max: 100 },
    processMilliseconds: { values: [11, 12, 13, 14, 110], median: 13 },
    maxRssMiB: { values: [200, 201, 202, 203, 204], median: 202 },
    instantiations: { values: [1000, 1001, 1002, 1003, 1004], median: 1002 },
    markerAccepted: true,
  });
});

test('collector performs five warm-ups then 31 retained samples serially', async () => {
  let active = 0;
  let maximumActive = 0;
  let calls = 0;
  const observed: number[] = [];
  const row = await collectCompilerControl(validCase, 'classic6:6.0.3', async () => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    const call = calls++;
    observed.push(call);
    await Promise.resolve();
    active -= 1;
    return completedSample({
      case: validCase.case,
      scenario: 'valid',
      diagnostics: [],
      boundaryLine: undefined,
      compileMilliseconds: call + 1,
      processMilliseconds: call + 2,
    });
  });
  expect({ calls, maximumActive, observed }).toEqual({
    calls: 36,
    maximumActive: 1,
    observed: Array.from({ length: 36 }, (_, index) => index),
  });
  expect(row).toMatchObject({ warmups: 5, samples: 31, markerAccepted: true });
  expect(row.compileMilliseconds.values).toEqual(Array.from({ length: 31 }, (_, index) => index + 6));
});

test('catalog contains only the exact nine supported controls', () => {
  expect(compilerControlLanes).toEqual(['classic', 'native']);
  expect(compilerControlCases.map(control => control.case)).toEqual([
    'named-chained-100-valid',
    'named-chained-100-missing',
    'named-chained-100-wrong-shape',
    'named-grouped-1000-valid',
    'named-grouped-1000-missing',
    'named-grouped-1000-wrong-shape',
    'token-bindings-100-valid',
    'token-bindings-100-missing-final-token',
    'token-bindings-100-mismatched-invariant-service',
  ]);
});

test('failed child evidence is journaled before normalization rejects it', async () => {
  const records: unknown[] = [];
  const raw = {
    ...completedSample(),
    case: undefined,
    compiler: undefined,
    milliseconds: 123,
    typescript: '6.0.3',
    maxRssMiB: 300,
    instantiations: 456,
    status: 1,
    stdout: '{"diagnostics":[]}',
    stderr: 'compiler failed',
    accepted: false,
  };
  await expect(captureCompilerControlSample(
    negativeCase,
    'classic6:6.0.3:hash',
    'classic',
    'sample',
    7,
    async () => raw,
    record => records.push(record),
  )).rejects.toThrow('compiler case was not accepted');
  expect(records).toEqual([{
    schema: 1,
    type: 'failure',
    phase: 'sample',
    index: 7,
    lane: 'classic',
    compiler: 'classic6:6.0.3:hash',
    case: 'named-chained-100-missing',
    error: 'Error: named-chained-100-missing: compiler case was not accepted',
    raw,
  }]);
});

test('spawn failures are journaled even when no child row exists', async () => {
  const records: unknown[] = [];
  await expect(captureCompilerControlSample(
    validCase,
    'native7:7.0.2:hash',
    'native',
    'warmup',
    2,
    async () => { throw new Error('native spawn failed'); },
    record => records.push(record),
  )).rejects.toThrow('native spawn failed');
  expect(records).toEqual([{
    schema: 1,
    type: 'failure',
    phase: 'warmup',
    index: 2,
    lane: 'native',
    compiler: 'native7:7.0.2:hash',
    case: 'named-chained-100-valid',
    error: 'Error: native spawn failed',
  }]);
});
