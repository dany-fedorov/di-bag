import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect, test } from 'bun:test';
import type { TokenScaleCase, TokenScaleForm } from './compiler';

type WorkerResult = {
  count: number;
  form: TokenScaleForm;
  scenario: TokenScaleCase;
  milliseconds: number;
  maxRssMiB: number;
  boundaryLine?: number;
  diagnostics: Array<{ code: number; file?: string; line?: number; column?: number; message: string }>;
};

const worker = resolve(__dirname, '../scripts/check-token-scale.ts');
const generated = resolve(__dirname, 'generated-token-scale.ts');

for (const form of ['bindings', 'modules'] satisfies TokenScaleForm[]) {
  for (const scenario of ['valid', 'missing-final-token', 'mismatched-invariant-service'] satisfies TokenScaleCase[]) {
    test(`token scale: 100 ${form} ${scenario}`, () => {
      const child = spawnSync('node', [
        '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', worker, form, scenario,
      ], { encoding: 'utf8', timeout: 60_000, maxBuffer: 1024 * 1024 });
      expect({ status: child.status, signal: child.signal, error: child.error?.message, stderr: child.stderr })
        .toEqual({ status: 0, signal: null, error: undefined, stderr: '' });
      const result = JSON.parse(child.stdout.toString()) as WorkerResult;
      expect({ count: result.count, form: result.form, scenario: result.scenario })
        .toEqual({ count: 100, form, scenario });
      if (scenario === 'valid') {
        expect(result.diagnostics).toEqual([]);
        expect(result.boundaryLine).toBeUndefined();
        return;
      }
      expect(result.boundaryLine).toBeDefined();
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics.every(error => error.file === generated && error.line !== undefined && error.column !== undefined)).toBe(true);
      expect(result.diagnostics.some(error => error.code === 2589)).toBe(false);
      const intended = scenario === 'missing-final-token' ? 'missing factories'
        : form === 'bindings' ? 'token dependency has an incompatible or opaque contract'
          : 'a dependency has the wrong shape';
      expect(result.diagnostics.some(error =>
        error.line === result.boundaryLine && error.message.includes(intended),
      )).toBe(true);
    }, 65_000);
  }
}
