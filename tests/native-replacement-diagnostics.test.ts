import { expect, test } from 'bun:test';
import {
  auditReplacementDiagnostics,
  evaluateReplacementDiagnostics,
  replacementDiagnosticExpectations,
  replacementDiagnosticFixtures,
} from '../scripts/replacement-diagnostics';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = '/fixture.ts';
const source = '// diagnostic: a dependency has the wrong shape\nreplace();';
const useful = {
  file,
  line: 2,
  column: 1,
  code: 2345,
  message: 'a dependency has the wrong shape',
};

test('native replacement diagnostics retain every useful primary and supplemental message', async () => {
  const result = await auditReplacementDiagnostics(process.cwd());
  expect(result).toMatchObject({
    accepted: true,
    missingPrimary: 0,
    primaryExpected: 95,
    primaryMatched: 95,
    supplementalExpected: 1,
    supplementalMatched: 1,
    unexpected: 0,
  });
}, 120_000);

test('strict replacement audit requires useful primary text at its own region', () => {
  expect(evaluateReplacementDiagnostics(source, file, [useful], true).accepted).toBe(true);

  for (const diagnostics of [
    [],
    [{ ...useful, file: '/other.ts' }],
    [{ ...useful, code: 2589 }],
    [{ ...useful, message: 'No overload matches this call. The last overload gave the following error.' }],
    [useful, { ...useful, message: 'unrelated diagnostic' }],
  ]) {
    expect(evaluateReplacementDiagnostics(source, file, diagnostics, true).accepted).toBe(false);
  }

  expect(evaluateReplacementDiagnostics(source, file, [useful], false).accepted).toBe(false);

  const separated = `${source}\n// diagnostic: missing factories\nend();`;
  expect(evaluateReplacementDiagnostics(separated, file, [{ ...useful, line: 4 }], true).accepted).toBe(false);
});

test('strict replacement audit requires exact supplemental code and text', () => {
  const supplemented = `${source.replace('replace();', '// diagnostic-also: TS2684 missing factories\nreplace();')}`;
  const supplemental = { ...useful, code: 2684, message: 'missing factories' };

  expect(evaluateReplacementDiagnostics(supplemented, file, [useful, supplemental], true).accepted).toBe(true);
  expect(evaluateReplacementDiagnostics(supplemented, file, [useful], true).accepted).toBe(false);
  expect(evaluateReplacementDiagnostics(supplemented, file, [useful, { ...supplemental, code: 2345 }], true).accepted).toBe(false);
  expect(evaluateReplacementDiagnostics(supplemented, file, [useful, { ...supplemental, message: 'other text' }], true).accepted).toBe(false);

  const removedMarker = evaluateReplacementDiagnostics(
    source,
    file,
    [useful],
    true,
    {
      primary: ['a dependency has the wrong shape'],
      supplemental: [{ code: 2684, message: 'missing factories' }],
    },
  );
  expect(removedMarker.accepted).toBe(false);
  expect(removedMarker.inventory.supplementalActual).toBe(0);

  const weakenedSupplement = supplemented.replace(
    'TS2684 missing factories',
    'TS2345 No overload matches this call',
  );
  const weakenedSupplementResult = evaluateReplacementDiagnostics(
    weakenedSupplement,
    file,
    [useful, { ...supplemental, code: 2345, message: 'No overload matches this call' }],
    true,
    {
      primary: ['a dependency has the wrong shape'],
      supplemental: [{ code: 2684, message: 'missing factories' }],
    },
  );
  expect(weakenedSupplementResult.missing).toEqual([]);
  expect(weakenedSupplementResult.unexpected).toEqual([]);
  expect(weakenedSupplementResult.accepted).toBe(false);
});

test('replacement audit keeps its ten source fixtures independent of native gap comments', () => {
  expect(replacementDiagnosticFixtures).toEqual([
    'negative/incremental.ts',
    'negative/inline-replacement-wrong-shape.ts',
    'negative/module-hidden-private-needs.ts',
    'negative/module-narrowing.ts',
    'negative/module-rename.ts',
    'negative/provider-boundaries.ts',
    'negative/replacement-context.ts',
    'negative/replacement-wrong-shape.ts',
    'negative/required-this.ts',
    'negative/union-replace.ts',
  ]);
  expect(Object.values(replacementDiagnosticExpectations).reduce(
    (total, expected) => ({
      primary: total.primary + expected.primary.length,
      supplemental: total.supplemental + expected.supplemental.length,
    }),
    { primary: 0, supplemental: 0 },
  )).toEqual({ primary: 95, supplemental: 1 });
});

test('replacement audit rejects a fixture when its marker and invalid expression both disappear', () => {
  const fixture = 'negative/replacement-wrong-shape.ts';
  const fixtureFile = resolve(__dirname, 'types', fixture);
  const original = readFileSync(fixtureFile, 'utf8');
  const removed = original.slice(0, original.indexOf('// diagnostic:'));

  const result = evaluateReplacementDiagnostics(
    removed,
    fixtureFile,
    [],
    true,
    replacementDiagnosticExpectations[fixture],
  );
  expect(result.accepted).toBe(false);
  expect(result.inventory).toEqual({
    accepted: false,
    primaryExpected: 1,
    primaryActual: 0,
    supplementalExpected: 0,
    supplementalActual: 0,
  });

  const weakened = original.replace(
    '// diagnostic: wrong shape',
    '// diagnostic: No overload matches this call',
  );
  const weakenedResult = evaluateReplacementDiagnostics(
    weakened,
    fixtureFile,
    [{ ...useful, file: fixtureFile, line: 6, code: 2769, message: 'No overload matches this call' }],
    true,
    replacementDiagnosticExpectations[fixture],
  );
  expect(weakenedResult.missing).toEqual([]);
  expect(weakenedResult.unexpected).toEqual([]);
  expect(weakenedResult.accepted).toBe(false);
});
