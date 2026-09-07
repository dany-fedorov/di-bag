import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect, test } from 'bun:test';
import {
  compilerProgram,
  describeDiagnostic,
  scaleBoundaryLine,
  scalePath,
  scaleSource,
} from './compiler';
import type { ScaleCase, ScaleForm } from './compiler';
import ts from 'typescript';
import { evaluateWorker, type MatrixCase, type WorkerEvidence } from '../scripts/benchmark-result.ts';

test('parent evaluator validates untrusted worker evidence and preserves requested identities', () => {
  const item: MatrixCase = { count: 100, form: 'bulk', scenario: 'missing' };
  const diagnostic = { file: scalePath, line: 7, code: 2345, message: 'missing factories' };
  const result = { ...item, accepted: false, boundaryLine: 7, diagnostics: [diagnostic] };
  const evidence: WorkerEvidence = { status: 0, signal: null, stdout: JSON.stringify(result), stderr: '' };
  const good = evaluateWorker(item, evidence, scalePath);
  expect(good.accepted).toBe(true);
  const failures: WorkerEvidence[] = [
    ...['{', '[]', 'null', ''].map(stdout => ({ ...evidence, stdout })),
    ...[{ count: 500 }, { form: 'chained' }, { scenario: 'valid' }, { diagnostics: undefined },
      { diagnostics: [{}] }, { diagnostics: [{ ...diagnostic, file: 7 }] }, { diagnostics: [{ ...diagnostic, line: '7' }] },
      { diagnostics: [{ ...diagnostic, file: '/wrong.ts' }] },
      { diagnostics: [{ ...diagnostic, line: 8 }] }, { diagnostics: [{ ...diagnostic, message: 'wrong' }] },
      { diagnostics: [{ ...diagnostic, code: 2589 }] }, { diagnostics: [diagnostic, diagnostic] },
    ].map(change => ({ ...evidence, stdout: JSON.stringify({ ...result, ...change, accepted: true }) })),
    ...[{ stderr: 'warning' }, { status: 3 }, { signal: 'SIGKILL' }, { error: 'spawn failed' }]
      .map(change => ({ ...evidence, ...change })),
  ];
  const rows = failures.map(bad => {
    const row = evaluateWorker(item, bad, scalePath);
    expect(row).toMatchObject({ ...item, accepted: false, ...bad });
    expect(row.failureReason).toBeString();
    return row;
  });
  const valid = { ...item, scenario: 'valid' as const };
  const validRow = evaluateWorker(valid, { ...evidence, stdout: JSON.stringify({ ...valid, diagnostics: [] }) }, scalePath);
  expect(validRow).toMatchObject({ ...valid, accepted: true });
  const all = [good, validRow, ...rows];
  expect(all.filter(row => row.accepted).length).toBe(2);
  expect(all.filter(row => !row.accepted).length).toBe(failures.length);
  expect(evaluateWorker(item, { ...evidence, stdout: JSON.stringify({ ...result, diagnostics: [diagnostic,
    { ...diagnostic, line: 8, message: 'same-file cascade' }] }) }, scalePath).accepted).toBe(true);
});

for (const args of [['--native', '--native'], ['--tokens', '--tokens'], ['--unknown'], ['--native', '--tokens', '--unknown']]) {
  test(`benchmark rejects unsupported flags: ${args.join(' ')}`, () => {
    const child = spawnSync('node', ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', resolve(__dirname, '../scripts/benchmark-types.ts'), ...args],
      { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024 });
    expect(child.status).not.toBe(0); expect(child.stdout).toBe('');
    expect(child.stderr).toContain('invalid benchmark arguments');
  });
}

const forms = ['bulk', 'chained', 'grouped', 'replacement'] satisfies ScaleForm[];
const scenarios = ['valid', 'missing', 'wrong-shape'] satisfies ScaleCase[];

for (const form of forms) {
  for (const scenario of scenarios) {
    test(`named benchmark boundary: 100 ${form} ${scenario}`, () => {
      const source = scaleSource(100, form, scenario);
      const errors = ts.getPreEmitDiagnostics(compilerProgram(scalePath, source)).map(describeDiagnostic);
      const boundaryLine = scaleBoundaryLine(source, 100, form, scenario);

      if (scenario === 'valid') {
        expect(boundaryLine).toBeUndefined();
        expect(errors).toEqual([]);
        return;
      }

      const intended = scenario === 'missing' ? 'missing factories' : 'a dependency has the wrong shape';
      expect(boundaryLine).toBeDefined();
      expect(errors.every(error => error.file === scalePath)).toBe(true);
      expect(errors.some(error => error.code === 2589)).toBe(false);
      expect(errors.filter(error =>
        error.line === boundaryLine && error.message.includes(intended),
      )).toHaveLength(1);
    }, 120_000);
  }
}

const tokenWorker = resolve(__dirname, '../scripts/check-token-scale.ts');
const namedWorker = resolve(__dirname, '../scripts/benchmark-types.ts');

test('named benchmark worker retains complete boundary diagnostics', () => {
  const child = spawnSync('node', [
    '--max-old-space-size=3072', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
    namedWorker, '--worker', '100', 'chained', 'wrong-shape',
  ], { encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024 });

  expect({ status: child.status, signal: child.signal, error: child.error?.message, stderr: child.stderr })
    .toEqual({ status: 0, signal: null, error: undefined, stderr: '' });
  expect(child.stdout.trim().length).toBeGreaterThan(0);
  const result = JSON.parse(child.stdout);
  expect(result).toMatchObject({ count: 100, form: 'chained', scenario: 'wrong-shape' });
  expect(result.boundaryLine).toBeNumber();
  expect(result.diagnostics.filter((error: { file?: string; line?: number; message: string }) =>
    error.file === scalePath
      && error.line === result.boundaryLine
      && error.message.includes('a dependency has the wrong shape'),
  )).toHaveLength(1);
}, 65_000);

test('token worker defaults a valid invocation to 100 services', () => {
  const child = spawnSync('node', [
    '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', tokenWorker, 'bindings', 'valid',
  ], { encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024 });

  expect({ status: child.status, signal: child.signal, error: child.error?.message, stderr: child.stderr })
    .toEqual({ status: 0, signal: null, error: undefined, stderr: '' });
  expect(child.stdout.trim().length).toBeGreaterThan(0);
  expect(JSON.parse(child.stdout)).toMatchObject({ count: 100, form: 'bindings', scenario: 'valid' });
}, 65_000);

test('token worker accepts an explicit supported count', () => {
  const child = spawnSync('node', [
    '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', tokenWorker, 'bindings', 'valid', '100',
  ], { encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024 });

  expect({ status: child.status, signal: child.signal, error: child.error?.message, stderr: child.stderr })
    .toEqual({ status: 0, signal: null, error: undefined, stderr: '' });
  expect(child.stdout.trim().length).toBeGreaterThan(0);
  expect(JSON.parse(child.stdout)).toMatchObject({ count: 100, form: 'bindings', scenario: 'valid' });
}, 65_000);

for (const [name, args] of [
  ['an extra argument', ['bindings', 'valid', '100', 'extra']],
  ['count zero', ['bindings', 'valid', '0']],
  ['an unsupported count', ['bindings', 'valid', '101']],
  ['an invalid form', ['invalid-form', 'valid']],
  ['an invalid scenario', ['bindings', 'invalid-scenario']],
] as const) {
  test(`token worker rejects ${name} before compilation`, () => {
    const child = spawnSync('node', [
      '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', tokenWorker, ...args,
    ], { encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024 });

    expect(child.status).not.toBe(0);
    expect(child.stdout).toBe('');
  });
}
