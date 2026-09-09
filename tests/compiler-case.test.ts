import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect, test } from 'bun:test';
import { evaluateWorker } from '../scripts/benchmark-result.ts';
import {
  compilerCaseExitCode,
  parseCompilerCase,
  runCompilerCase,
  verifyCompilerCaseEvidence,
  type CompilerLane,
} from '../scripts/compiler-case.ts';

test('selected compiler case admits only original matrix identities', () => {
  expect(parseCompilerCase(['native', '500', 'modules', 'valid'])).toEqual({
    lane: 'native', item: { count: 500, form: 'modules', scenario: 'valid' },
  });
  expect(parseCompilerCase(['classic', '1000', 'replacement', 'wrong-shape'])).toEqual({
    lane: 'classic', item: { count: 1000, form: 'replacement', scenario: 'wrong-shape' },
  });

  for (const args of [
    ['native', '501', 'modules', 'valid'],
    ['classic', '500', 'modules', 'wrong-shape'],
    ['native', '500', 'chained', 'missing-final-token'],
    ['other', '100', 'bulk', 'valid'],
    ['classic', '100', 'bulk', 'valid', 'extra'],
    ['classic', '100', 'bindings', 'missing'],
    ['native', '1000', 'replacement', 'mismatched-invariant-service'],
  ]) expect(() => parseCompilerCase(args)).toThrow();
});

test('a claimed accepted result cannot hide an original-boundary failure', () => {
  const item = { count: 100, form: 'replacement', scenario: 'wrong-shape' } as const;
  const diagnostic = {
    file: '/tmp/graph.ts', line: 152, column: 10,
    code: 2345, message: 'a dependency has the wrong shape',
  };
  const row = { ...item, accepted: true, boundaryLine: 152, diagnostics: [diagnostic] };
  const child = { status: 0, signal: null, stderr: '', stdout: JSON.stringify(row) };
  expect(evaluateWorker(item, child, '/tmp/graph.ts').accepted).toBe(true);
  for (const diagnostics of [
    [],
    [{ ...diagnostic, code: 2589 }],
    [{ ...diagnostic, line: 153 }],
    [{ ...diagnostic, file: '/tmp/other.ts' }],
    [{ ...diagnostic, message: 'The last overload gave the following error.' }],
  ]) expect(evaluateWorker(item, {
    ...child, stdout: JSON.stringify({ ...row, diagnostics }),
  }, '/tmp/graph.ts').accepted).toBe(false);
});

const validItem = { count: 100, form: 'bulk', scenario: 'valid' } as const;
if (false) {
  // @ts-expect-error runCompilerCase does not expose test injection to callers.
  void runCompilerCase(process.cwd(), 'classic', validItem, {});
}
const cleanSnapshot = {
  sourceCommit: '0123456789abcdef',
  sourceStatus: '',
  sourceSha256: 'a'.repeat(64),
  generatedSha256: 'b'.repeat(64),
};

function verifyFakeEvidence(
  lane: CompilerLane,
  row: Record<string, unknown>,
  expectedBoundaryLine: number | undefined,
  snapshots: readonly (typeof cleanSnapshot)[] = [cleanSnapshot, cleanSnapshot],
) {
  return verifyCompilerCaseEvidence(
    lane,
    row,
    expectedBoundaryLine,
    snapshots[0]!,
    snapshots[1]!,
    1,
  );
}

test('direct selected-case calls reject invalid lane and matrix identities before dispatch', async () => {
  for (const [lane, item] of [
    ['other', validItem],
    ['classic', { ...validItem, count: 101 }],
    ['native', { count: 100, form: 'modules', scenario: 'wrong-shape' }],
    ['classic', { count: 500, form: 'chained', scenario: 'missing-final-token' }],
  ] as const) {
    await expect(runCompilerCase(process.cwd(), lane as CompilerLane, item as never))
      .rejects.toThrow('expected lane count form scenario from the original matrix');
  }
});

test('recomputed boundary rejects self-consistent worker evidence at the wrong boundary', async () => {
  const item = { count: 100, form: 'replacement', scenario: 'wrong-shape' } as const;
  const row = verifyFakeEvidence('classic', {
    ...item,
    accepted: true,
    boundaryLine: 151,
    diagnostics: [{
      file: resolve(process.cwd(), 'tests/generated-type-scale.ts'),
      line: 151,
      code: 2345,
      message: 'a dependency has the wrong shape',
    }],
  }, 152);

  expect(row).toMatchObject({
    accepted: false,
    boundaryLine: 151,
    expectedBoundaryLine: 152,
    failureReason: 'worker boundary differs from the original generated source',
  });
});

for (const field of ['sourceCommit', 'sourceStatus', 'sourceSha256', 'generatedSha256'] as const) {
  test(`selected evidence rejects ${field} drift while compilation runs`, async () => {
    const after = { ...cleanSnapshot, [field]: `${cleanSnapshot[field]}-changed` };
    const row = verifyFakeEvidence('classic', {
      ...validItem, accepted: true, boundaryLine: undefined, diagnostics: [],
    }, undefined, [cleanSnapshot, after]);

    expect(row).toMatchObject({
      accepted: false,
      sourceCommitBefore: cleanSnapshot.sourceCommit,
      sourceCommitAfter: after.sourceCommit,
      sourceStatusBefore: cleanSnapshot.sourceStatus,
      sourceStatusAfter: after.sourceStatus,
      sourceSha256Before: cleanSnapshot.sourceSha256,
      sourceSha256After: after.sourceSha256,
      generatedSha256Before: cleanSnapshot.generatedSha256,
      generatedSha256After: after.generatedSha256,
      failureReason: 'repository provenance changed while compiler case was running',
    });
  });
}

test('native selected evidence preserves the hash of the compiled snapshot', async () => {
  const compiledHash = 'c'.repeat(64);
  const row = verifyFakeEvidence('native', {
    ...validItem,
    accepted: true,
    boundaryLine: undefined,
    diagnostics: [],
    sourceSha256: compiledHash,
    generatedSha256: cleanSnapshot.generatedSha256,
    sourceCommit: cleanSnapshot.sourceCommit,
  }, undefined);

  expect(row).toMatchObject({
    accepted: false,
    sourceSha256: compiledHash,
    sourceSha256Before: cleanSnapshot.sourceSha256,
    failureReason: 'compiled snapshot differs from starting repository provenance',
  });
});

test('compiler CLI deterministically selects exit status from simulated evidence', async () => {
  expect(compilerCaseExitCode({ ...validItem, accepted: false, failureReason: 'simulated rejection' })).toBe(1);
  expect(compilerCaseExitCode({ ...validItem, accepted: true })).toBe(0);
});

test('classic process failures retain compiler identity and complete provenance', () => {
  const row = verifyFakeEvidence('classic', {
    ...validItem,
    accepted: false,
    diagnostics: [],
    failureReason: 'worker did not complete cleanly',
  }, undefined);

  expect(row).toMatchObject({
    accepted: false,
    typescript: '6.0.3',
    node: process.version,
    sourceCommit: cleanSnapshot.sourceCommit,
    sourceStatus: cleanSnapshot.sourceStatus,
    sourceSha256: cleanSnapshot.sourceSha256,
    generatedSha256: cleanSnapshot.generatedSha256,
    failureReason: 'worker did not complete cleanly',
  });
});

for (const lane of ['classic', 'native'] as const) {
  for (const scenario of ['valid', 'missing'] as const) {
    test(`${lane} selected 100 bulk ${scenario} returns verified evidence`, async () => {
      const row = await runCompilerCase(process.cwd(), lane, { count: 100, form: 'bulk', scenario });
      expect(row).toMatchObject({ count: 100, form: 'bulk', scenario, accepted: true });
      expect(row.typescript).toBe(lane === 'classic' ? '6.0.3' : '7.0.2');
      expect(row.sourceCommit).toBeString();
      expect(row.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(row.generatedSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(row.sourceCommitBefore).toBe(row.sourceCommitAfter);
      expect(row.sourceStatusBefore).toBe(row.sourceStatusAfter);
      expect(row.sourceSha256Before).toBe(row.sourceSha256After);
      expect(row.generatedSha256Before).toBe(row.generatedSha256After);
      expect(row.sourceSha256).toBe(row.sourceSha256Before);
      expect(row.generatedSha256).toBe(row.generatedSha256Before);
      expect(row.processMilliseconds).toBeNumber();
      if (scenario === 'valid') {
        expect(row.diagnostics).toEqual([]);
      } else {
        expect(row.boundaryLine).toBeNumber();
        expect(row.diagnostics).toBeArrayOfSize(1);
        expect((row.diagnostics as Array<{ line: number; message: string }>)[0]).toMatchObject({
          line: row.boundaryLine,
        });
        expect((row.diagnostics as Array<{ message: string }>)[0]!.message).toContain('missing factories');
      }
    }, 65_000);
  }
}

test('selected compiler CLI rejects an invalid identity without JSON success', () => {
  const child = spawnSync('node', [
    '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
    resolve(__dirname, '../scripts/check-compiler-case.ts'),
    'native', '501', 'modules', 'valid',
  ], { cwd: process.cwd(), encoding: 'utf8', timeout: 10_000, maxBuffer: 1024 * 1024 });

  expect(child.status).not.toBe(0);
  expect(child.stdout).toBe('');
  expect(child.stderr).toContain('expected lane count form scenario from the original matrix');
});
