import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const cases = [
  { name: '100 named additions', args: ['scripts/benchmark-types.ts', '--worker', '100', 'chained', 'valid'], ceiling: 1_500_000 },
  { name: '100 token bindings', args: ['scripts/check-token-scale.ts', 'bindings', 'valid'], ceiling: 2_000_000 },
] as const;

for (const item of cases) {
  test(`incremental compiler work: ${item.name}`, () => {
    const child = spawnSync('node', [
      '--max-old-space-size=3072', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', ...item.args,
    ], { cwd: resolve(__dirname, '..'), encoding: 'utf8', timeout: 60_000, maxBuffer: 1024 * 1024 });
    expect({ status: child.status, signal: child.signal, error: child.error?.message, stderr: child.stderr })
      .toEqual({ status: 0, signal: null, error: undefined, stderr: '' });
    expect(child.stdout.trim().length).toBeGreaterThan(0);
    const result = JSON.parse(child.stdout);
    expect(result.count).toBe(100);
    expect(result.scenario).toBe('valid');
    expect(result.form).toBe(item.args[0].includes('benchmark') ? 'chained' : 'bindings');
    expect(result.typescript).toBe('6.0.3');
    if ('diagnostics' in result) expect(result.diagnostics).toEqual([]);
    else { expect(result.accepted).toBe(true); expect(result.diagnosticCount).toBe(0); }
    expect(Number.isInteger(result.instantiations)).toBe(true);
    expect(result.instantiations).toBeGreaterThan(0);
    expect(result.instantiations).toBeLessThanOrEqual(item.ceiling);
  }, 65_000);
}
