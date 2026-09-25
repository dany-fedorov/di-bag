import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const script = resolve(__dirname, '../scripts/check-docs-retired-names.mjs');
const root = resolve(__dirname, 'fixtures/docs-retired-names');
const run = (...files: string[]) => {
  // Bun 1.4.0 drops Node child output in pipes; regular-file descriptors preserve it.
  const capture = mkdtempSync(join(tmpdir(), 'retired-names-output-'));
  const output = openSync(join(capture, 'stdout'), 'w+');
  const errors = openSync(join(capture, 'stderr'), 'w+');
  try {
    const result = spawnSync('node', [script, '--root', root, '--map', resolve(root, 'map.json'), ...files], { stdio: ['ignore', output, errors] });
    return { status: result.status, stdout: readFileSync(join(capture, 'stdout'), 'utf8'), stderr: readFileSync(join(capture, 'stderr'), 'utf8') };
  } finally {
    closeSync(output);
    closeSync(errors);
    rmSync(capture, { recursive: true, force: true });
  }
};

test('current names, the product name, an options bag and ordinary English pass', () => {
  const result = run('docs/guides/clean.md');
  expect(result.stdout).toBe('');
  expect(result.status).toBe(0);
});

test('a removed call, type, code, value, import and each retired word are reported with file and line', () => {
  const result = run('docs/guides/stale.md');
  expect(result.status).toBe(1);
  expect(result.stdout.trim().split('\n')).toEqual([
    'docs/guides/stale.md:3: retired call build',
    'docs/guides/stale.md:3: retired name Bag',
    'docs/guides/stale.md:4: retired name DI_BAG_CYCLE',
    'docs/guides/stale.md:4: retired value root',
    'docs/guides/stale.md:4: retired import di-bag/node',
    'docs/guides/stale.md:5: retired word cleanup',
    'docs/guides/stale.md:5: retired word startup',
    'docs/guides/stale.md:5: retired word bag',
    'docs/guides/stale.md:5: retired word scope',
    'docs/guides/stale.md:5: retired word fork',
  ]);
});

test('without file arguments it reads the guides of the root', () => {
  const result = run();
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('finding(s) in 7 file(s)');
});

test('fences suppress retired prose words but retain removed API findings', () => {
  const result = run('docs/guides/fenced.md');
  expect(result.status).toBe(1);
  expect(result.stdout.trim().split('\n')).toEqual([
    'docs/guides/fenced.md:5: retired call build',
    'docs/guides/fenced.md:6: retired name DI_BAG_CYCLE',
    'docs/guides/fenced.md:7: retired value root',
    'docs/guides/fenced.md:8: retired import di-bag/node',
    'docs/guides/fenced.md:11: retired word cleanup',
  ]);
});

test('Markdown link destinations do not count as prose but labels, titles and nearby words do', () => {
  const result = run('docs/guides/link-destinations.md');
  expect(result.status).toBe(1);
  expect(result.stdout.trim().split('\n')).toEqual([
    'docs/guides/link-destinations.md:4: retired word scope',
    'docs/guides/link-destinations.md:5: retired word cleanup',
    'docs/guides/link-destinations.md:6: retired word fork',
    'docs/guides/link-destinations.md:7: retired word scope',
    'docs/guides/link-destinations.md:8: retired call build',
    'docs/guides/link-destinations.md:9: retired call build',
  ]);
});

test('the naming guide preserves its historical vocabulary table without exempting nearby prose', () => {
  const result = run('docs/guides/api-naming.md');
  expect(result.status).toBe(1);
  expect(result.stdout.trim().split('\n')).toEqual([
    'docs/guides/api-naming.md:10: retired name DI_BAG_CYCLE',
    'docs/guides/api-naming.md:10: retired word cleanup',
    'docs/guides/api-naming.md:14: retired word cleanup',
    'docs/guides/api-naming.md:15: retired call build',
    'docs/guides/api-naming.md:22: retired name DI_BAG_CYCLE',
    'docs/guides/api-naming.md:22: retired word cleanup',
    'docs/guides/api-naming.md:28: retired name DI_BAG_CYCLE',
    'docs/guides/api-naming.md:28: retired word cleanup',
    'docs/guides/api-naming.md:32: retired word bag',
  ]);
});

test('the historical migration guide is excluded consistently, even when named', () => {
  for (const spelling of ['docs/guides/migrating-to-0.5.md', './docs/guides/migrating-to-0.5.md', resolve(root, 'docs/guides/migrating-to-0.5.md')]) {
    const result = run(spelling);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  }
});

test('only valid closers end tilde and blockquote fences before prose scanning resumes', () => {
  const result = run('docs/guides/fence-containers.md');
  expect(result.status).toBe(1);
  expect(result.stdout.trim().split('\n')).toEqual([
    'docs/guides/fence-containers.md:8: retired word cleanup',
    'docs/guides/fence-containers.md:15: retired word family',
    'docs/guides/fence-containers.md:17: retired word cleanup',
  ]);
});

test('an unquoted line ends an open blockquote fence and is scanned as prose', () => {
  const result = run('docs/guides/blockquote-exit.md');
  expect(result.status).toBe(1);
  expect(result.stdout.trim()).toBe('docs/guides/blockquote-exit.md:5: retired word cleanup');
});
