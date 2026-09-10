import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileNative, matchDiagnosticMarkers, parseNativeDiagnostics, resolveNative } from '../scripts/native-compiler.ts';
import { nativeScale } from '../scripts/native-scale.ts';

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
  expect(parseNativeDiagnostics("error TS5058: missing config\nx.ts(9,2): error TS2589: excessive\nunknown output\n", '/tmp').diagnostics)
    .toEqual([{ code: 5058, message: 'missing config' }, { file: '/tmp/x.ts', line: 9, column: 2, code: 2589, message: 'excessive' }]);
  expect(parseNativeDiagnostics('unknown output\n', '/tmp').unparsed).toEqual(['unknown output']);
});
test('source marker gate rejects wrong file, region, message, TS2589 and unmatched cascades', () => {
  const source = '// diagnostic: missing factories\ncall();\n// diagnostic: wrong shape\ncall();';
  const good = [{ file: '/tmp/source.ts', line: 2, code: 2345, message: 'missing factories' },
    { file: '/tmp/source.ts', line: 4, code: 2345, message: 'wrong shape' }];
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
