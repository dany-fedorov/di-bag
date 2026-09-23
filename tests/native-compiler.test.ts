import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { compileNative, matchDiagnosticMarkers, parseNativeDiagnostics, resolveNative } from '../scripts/native-compiler.ts';
import { compileGeneratedNative, nativeScale } from '../scripts/native-scale.ts';
import { controlScaleSource } from './compiler';
import { matchNativeDiagnosticMarkers, nativeDiagnosticGapMessages } from './native-diagnostic-markers.ts';

test('parser retains real native multiline diagnostics, positions and metrics', () => {
  const output = "invalid.ts(3,7): error TS2322: Type '{ read(): { value: string; }; }' is not assignable to type 'Needs'.\r\n  The types returned by 'read().value' are incompatible between these types.\r\n    Type 'string' is not assignable to type 'number'.\r\nFiles: 64\r\nMemory used: 61602K\r\nTotal time: 0.209s\r\n";
  const parsed = parseNativeDiagnostics(output, '/tmp/probe');
  expect(parsed.diagnostics).toHaveLength(1);
  expect(parsed.diagnostics[0]).toMatchObject({ file: '/tmp/probe/invalid.ts', line: 3, column: 7, code: 2322 });
  expect(parsed.diagnostics[0]!.message).toContain("\n    Type 'string'");
  expect(parsed.metrics).toEqual({ Files: 64, 'Memory used': 61602, 'Total time': 0.209 });
  expect(parsed.unparsed).toEqual([]);
});
test('parser exposes configuration errors, TS2589 and unknown output', () => {
  expect(parseNativeDiagnostics("error TS5058: missing config\nx.ts(9,2): error TS2589: excessive\nunknown output\n", '/tmp').diagnostics).toEqual([{ code: 5058, message: 'missing config' }, { file: '/tmp/x.ts', line: 9, column: 2, code: 2589, message: 'excessive' }]);
  expect(parseNativeDiagnostics('unknown output\n', '/tmp').unparsed).toEqual(['unknown output']);
});
test('source marker gate rejects wrong file, region, message, TS2589 and unmatched cascades', () => {
  const source = '// diagnostic: required service registrations are missing\ncall();\n// diagnostic: consumer dependency\ncall();';
  const good = [{ file: '/tmp/source.ts', line: 2, code: 2345, message: 'required service registrations are missing' },
    { file: '/tmp/source.ts', line: 4, code: 2345, message: 'consumer dependency' }];
  expect(matchDiagnosticMarkers(source, '/tmp/source.ts', good)).toMatchObject({ expected: 2, matched: 2, unexpected: [], missing: [] });
  for (const change of [{ file: '/tmp/config.json' }, { line: 4 }, { message: 'other' }, { code: 2589 }]) {
    expect(matchDiagnosticMarkers(source, '/tmp/source.ts', [{ ...good[0]!, ...change }, good[1]!])).toMatchObject({ expected: 2, matched: 1 });
  }
  expect(matchDiagnosticMarkers(source, '/tmp/source.ts', [...good, { ...good[0]!, message: 'cascade' }]).unexpected).toHaveLength(1);
});
test('verified native executable checks real nonempty valid and invalid projects', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'di-bag-native-parser-'));
  try {
    const compiler = await resolveNative(process.cwd());
    expect(compiler.version).toBe('7.0.2');
    writeFileSync(join(directory, 'valid.ts'), 'export const answer: number = 42;');
    writeFileSync(join(directory, 'invalid.ts'), 'export const answer: number = "wrong";');
    const valid = await compileNative(compiler, directory, [join(directory, 'valid.ts')]);
    expect(valid.checked).toBe(true); expect(valid.status).toBe(0); expect(valid.diagnostics).toEqual([]);
    expect(valid.metrics.Files).toBeGreaterThan(0);
    const invalid = await compileNative(compiler, directory, [join(directory, 'invalid.ts')]);
    expect(invalid.checked).toBe(true); expect(invalid.status).toBe(1);
    expect(invalid.diagnostics).toMatchObject([{ file: join(directory, 'invalid.ts'), line: 1, code: 2322 }]);
    const configuration = await compileNative(compiler, directory, [join(directory, 'valid.ts')], { moduleResolution: 'invalid' });
    expect(configuration.checked).toBe(false); expect(configuration.status).toBe(1);
    expect(configuration.diagnostics).toMatchObject([{ file: join(directory, 'tsconfig.native.json'), code: 6046 }]);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 15000);

test('native provider facade diagnostics retain two exact reviewed quality gaps', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'di-bag-native-provider-facades-'));
  try {
    const compiler = await resolveNative(process.cwd());
    const fixtureRoot = resolve(process.cwd(), 'tests/types');
    const cases = [
      { file: 'negative/provider-facades.ts', primaryExpected: 15, primaryMatched: 13, knownNativeRejections: 2 },
      { file: 'negative/provider-facade-lifetime-controls.ts', primaryExpected: 6, primaryMatched: 6, knownNativeRejections: 0 },
      { file: 'negative/provider-facade-modes.ts', primaryExpected: 2, primaryMatched: 2, knownNativeRejections: 0 },
      { file: 'provider-facades.ts', primaryExpected: 0, primaryMatched: 0, knownNativeRejections: 0 },
    ] as const;
    for (const item of cases) {
      const file = resolve(fixtureRoot, item.file);
      const result = await compileNative(compiler, directory, [file], { skipLibCheck: true, noErrorTruncation: true });
      expect(result.checked, item.file).toBe(true);
      const markers = matchNativeDiagnosticMarkers(readFileSync(file, 'utf8'), file, result.diagnostics);
      expect(markers, item.file).toMatchObject({
        accepted: true,
        primaryExpected: item.primaryExpected,
        primaryMatched: item.primaryMatched,
        knownNativeRejections: item.knownNativeRejections,
        unexpected: [],
        unresolved: [],
        declarationErrors: [],
      });
      if (item.file !== 'negative/provider-facades.ts') {
        expect(markers.gaps, item.file).toEqual([]);
      } else {
        expect(result.diagnostics).toHaveLength(15);
        expect(markers.status).toBe('accepted-with-diagnostic-gaps');
        expect(markers.gaps.map(gap => ({
          id: gap.id,
          line: gap.diagnostic.line,
          column: gap.diagnostic.column,
          code: gap.diagnostic.code,
        }))).toEqual([
          { id: 'last-provider-acquisition-mode', line: 22, column: 51, code: 2769 },
          { id: 'last-provider-transform-fulfilled-mode', line: 27, column: 50, code: 2769 },
        ]);
        expect(markers.gaps.map(gap => gap.diagnostic.message)).toEqual(markers.gaps.map(gap => nativeDiagnosticGapMessages[gap.id]!));
        const source = readFileSync(file, 'utf8');
        expect(markers.gaps.map(gap => source.split('\n')[gap.diagnostic.line! - 1]!.slice(gap.diagnostic.column! - 1))).toEqual([
          "callbackReceives: 'later', describeAcquisition: value => ({ value }) });",
          "callbackReceives: 'fulfilled-value', transformService: value => value, transformReturnKind: 'sync-value' });",
        ]);
      }
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 65000);

for (const item of [
  { count: 100, form: 'bulk', scenario: 'valid' },
  { count: 100, form: 'bulk', scenario: 'missing' },
  { count: 100, form: 'bindings', scenario: 'valid' },
  { count: 100, form: 'bindings', scenario: 'missing-final-token' },
] as const) test(`native small control ${item.form} ${item.scenario}`, async () => {
  const row = await nativeScale(process.cwd(), await resolveNative(process.cwd()), item);
  expect(row).toMatchObject({ ...item, accepted: true, typescript: '7.0.2' });
  expect(row.status).toBe(item.scenario === 'valid' ? 0 : 1);
  expect(row.peakObservedRssMiB).toBeGreaterThan(0);
}, 65000);

test('native compiler completes 1000 dependent token bindings within the original limits', async () => {
  const row = await nativeScale(process.cwd(), await resolveNative(process.cwd()), {
    count: 1000, form: 'bindings', scenario: 'valid',
  });
  expect(row).toMatchObject({
    count: 1000, form: 'bindings', scenario: 'valid', typescript: '7.0.2',
    checked: true, accepted: true, status: 0, diagnostics: [],
  });
  expect(row.peakObservedRssMiB).toBeGreaterThan(0);
}, 65000);

test('native compiler resolves the final service from 1000 dependent token modules within the original limits', async () => {
  const row = await nativeScale(process.cwd(), await resolveNative(process.cwd()), {
    count: 1000, form: 'modules', scenario: 'valid',
  });
  expect(row).toMatchObject({
    count: 1000, form: 'modules', scenario: 'valid', typescript: '7.0.2',
    checked: true, accepted: true, status: 0, diagnostics: [],
  });
  expect(row.peakObservedRssMiB).toBeGreaterThan(0);
}, 65000);

test('native compiler completes 1000 named replacements within the original limits', async () => {
  const row = await nativeScale(process.cwd(), await resolveNative(process.cwd()), {
    count: 1000, form: 'replacement', scenario: 'valid',
  });
  expect(row).toMatchObject({
    count: 1000, form: 'replacement', scenario: 'valid', typescript: '7.0.2',
    checked: true, accepted: true, status: 0, diagnostics: [],
  });
  expect(row.peakObservedRssMiB).toBeGreaterThan(0);
}, 65000);

test('native compiler completes 1000 dependent named additions within the original limits', async () => {
  const row = await nativeScale(process.cwd(), await resolveNative(process.cwd()), {
    count: 1000, form: 'chained', scenario: 'valid',
  });
  expect(row).toMatchObject({
    count: 1000, form: 'chained', scenario: 'valid', typescript: '7.0.2',
    checked: true, accepted: true, status: 0, diagnostics: [],
  });
  expect(row.peakObservedRssMiB).toBeGreaterThan(0);
}, 65000);

test('a generated source outside the matrix compiles in a native project with provenance', async () => {
  const result = await compileGeneratedNative(process.cwd(), await resolveNative(process.cwd()), {
    fileName: 'generated-type-scale.ts', source: controlScaleSource(20),
  });
  expect(result).toMatchObject({ checked: true, status: 0, diagnostics: [], typescript: '7.0.2' });
  expect(result.file.endsWith('/tests/generated-type-scale.ts')).toBe(true);
  expect(result.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
  expect(result.generatedSha256).toMatch(/^[0-9a-f]{64}$/);
  expect(result.nativeMetrics.Instantiations).toBeGreaterThan(0);
}, 65000);
