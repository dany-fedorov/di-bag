// tests/test-lanes.test.ts
import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

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
  expect(compiler).toContain('tests/platform/react-page.test.ts');
  expect(fast).toContain('tests/scopes.test.ts');
  expect(fast).toContain('tests/react/project-runtime.test.ts');
  expect(fast).toContain('tests/react/runtime-owner.test.ts');
});

test('compiler lane timeout headroom preserves fast options, file selection, forwarding, and child status', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'di-bag-test-lane-'));
  const fakeBun = join(temporary, 'bun');
  const argvFile = join(temporary, 'argv.json');
  writeFileSync(fakeBun, `#!/usr/bin/env node
const { writeFileSync } = require('node:fs');
writeFileSync(process.env.DI_BAG_TEST_LANE_ARGV_FILE, JSON.stringify(process.argv.slice(2)));
process.exit(Number(process.env.DI_BAG_TEST_LANE_EXIT_STATUS || 0));
`);
  chmodSync(fakeBun, 0o755);
  const forwarded = '--test-name-pattern=selected';
  function invoke(name: 'fast' | 'compiler', options: string[], status = 0) {
    rmSync(argvFile, { force: true });
    const result = spawnSync(process.execPath, ['scripts/test-lane.mjs', name, ...options], {
      cwd: root, encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${temporary}:${process.env.PATH ?? ''}`,
        DI_BAG_TEST_LANE_ARGV_FILE: argvFile,
        DI_BAG_TEST_LANE_EXIT_STATUS: String(status),
      },
    });
    return { result, argv: existsSync(argvFile) ? JSON.parse(readFileSync(argvFile, 'utf8')) as string[] : undefined };
  }
  try {
    const fastFiles = lane('fast');
    const compilerFiles = lane('compiler');
    const listed = invoke('compiler', ['--list', forwarded]);
    expect(listed.result.status).toBe(0);
    expect(listed.result.stdout.trim().split('\n')).toEqual(compilerFiles);
    expect(listed.argv).toBeUndefined();

    const fast = invoke('fast', [forwarded]);
    expect(fast.result.status).toBe(0);
    expect(fast.argv).toEqual(['test', ...fastFiles, forwarded]);

    const rejected = invoke('compiler', [forwarded], 23);
    expect(rejected.result.status).toBe(23);
    const compiler = invoke('compiler', [forwarded]);
    expect(compiler.result.status).toBe(0);
    expect(compiler.argv).toEqual(['test', '--timeout=30000', ...compilerFiles, forwarded]);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
