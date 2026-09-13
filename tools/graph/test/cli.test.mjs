// tools/graph/test/cli.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '../../..');
const cli = resolve(root, 'tools/graph/cli.mjs');
const fixture = 'tools/graph/test/fixtures/split-builder.ts';

test('the CLI writes JSON and summarizes units and issues', () => {
  const directory = mkdtempSync(join(tmpdir(), 'di-bag-graph-'));
  const out = join(directory, 'graph.json');
  const result = spawnSync(process.execPath, [cli, fixture, '--out', out], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const graph = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(graph.units.length, 3);
  assert.match(result.stdout, /3 units, 8 nodes, 2 issues/);
  rmSync(directory, { recursive: true, force: true });
});

test('--check exits non-zero when issues exist and prints them', () => {
  const result = spawnSync(process.execPath, [cli, fixture, '--check'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /cycle .*a -> b -> a/);
  assert.match(result.stdout, /unresolved .*lonely needs missing/);
});

test('--project reads a tsconfig', () => {
  // Write to a file: the whole repository's JSON exceeds spawnSync's default stdout buffer.
  const directory = mkdtempSync(join(tmpdir(), 'di-bag-graph-'));
  const out = join(directory, 'graph.json');
  const result = spawnSync(process.execPath, [cli, '--project', 'tsconfig.json', '--out', out], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^\d+ units, \d+ nodes, \d+ issues -> /);
  assert.ok(JSON.parse(readFileSync(out, 'utf8')).units.length > 10);
  rmSync(directory, { recursive: true, force: true });
});
