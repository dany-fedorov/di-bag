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
