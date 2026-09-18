// tests/test-lanes.test.ts
import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
// Bun's fs typings lack readdirSync's recursive option; walk explicitly.
function walk(directory: string, prefix = ''): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(resolve(directory, entry.name), `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`]);
}
function lane(name: string): string[] {
  const result = spawnSync(process.execPath, ['scripts/test-lane.mjs', name, '--list'], { cwd: root, encoding: 'utf8' });
  expect(result.status).toBe(0);
  return result.stdout.trim().split('\n').filter(Boolean);
}

test('the two lanes partition every test file exactly once', () => {
  const fast = lane('fast');
  const compiler = lane('compiler');
  const all = walk(resolve(root, 'tests'))
    .filter(name => name.endsWith('.test.ts'))
    .map(name => `tests/${name}`)
    .sort();
  expect([...fast, ...compiler].sort()).toEqual(all);
  expect(fast.some(file => file === 'tests/types.test.ts')).toBe(false);
  expect(compiler).toContain('tests/types.test.ts');
  expect(compiler).toContain('tests/platform/browser-worker.test.ts');
  expect(fast).toContain('tests/scopes.test.ts');
  expect(fast).toContain('tests/react/project-runtime.test.ts');
  expect(fast).toContain('tests/react/runtime-owner.test.ts');
});
