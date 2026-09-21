// tools/graph/test/extract.test.mjs
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { extractDependencyGraph } from '../lib/extract.mjs';

const root = resolve(import.meta.dirname, '../../..');
const fixture = resolve(root, 'tools/graph/test/fixtures/split-builder.ts');
const graph = extractDependencyGraph({ files: [fixture], root });
const unit = id => graph.units.find(candidate => candidate.id === id);

test('every builder chain becomes a unit in source order with its kind and exports', () => {
  assert.deepEqual(graph.units.map(candidate => [candidate.kind, candidate.exports]), [
    ['module', ['retrieve']], ['bag', []], ['bag', []],
  ]);
  assert.equal(graph.units[0].file, 'tools/graph/test/fixtures/split-builder.ts');
  assert.equal(graph.units[0].line, 4);
  assert.equal(graph.units[2].line, 20);
  assert.deepEqual(graph.units[0].requirements, ['search']);
  assert.equal(graph.units[1].requirements, undefined);
});

test('a chain continued from a partial builder collects every registration', () => {
  const app = graph.units[1];
  assert.deepEqual(app.nodes.map(node => node.key), ['search', 'run', 'db']);
  assert.deepEqual(app.installs, [graph.units[0].id]);
  const db = app.nodes.find(node => node.key === 'db');
  assert.deepEqual(db, { key: 'db', line: 15, dependencies: ['search'], async: true, lifetime: 'root', owned: true });
  assert.deepEqual(app.edges, [{ from: 'db', to: 'search' }, { from: 'run', to: 'retrieve' }]);
});

test('declared dependencies come from the factory parameter type', () => {
  const retrieve = graph.units[0].nodes.find(node => node.key === 'retrieve');
  assert.deepEqual(retrieve.dependencies, ['search', 'normalize']);
  assert.equal(retrieve.async, false);
  assert.equal(retrieve.lifetime, 'scoped');
});

test('cycles and unresolved names are reported as issues', () => {
  const cyclic = graph.units[2];
  assert.deepEqual(graph.issues.filter(issue => issue.unit === cyclic.id), [
    { kind: 'cycle', unit: cyclic.id, path: ['a', 'b', 'a'] },
    { kind: 'unresolved', unit: cyclic.id, consumer: 'lonely', dependency: 'missing' },
  ]);
  // `run` depends on `retrieve`, which an installed module exports: resolved, not an issue.
  assert.equal(graph.issues.some(issue => issue.unit === graph.units[1].id), false);
});

test('build() is still the end of the chain when ensureServicesReady follows it', () => {
  const ready = extractDependencyGraph({ files: [resolve(root, 'tools/graph/test/fixtures/ready-chain.ts')], root });
  assert.deepEqual(ready.units.map(candidate => [candidate.kind, candidate.nodes.map(node => node.key)]), [['bag', ['db', 'report']]]);
  assert.deepEqual(ready.units[0].edges, [{ from: 'report', to: 'db' }]);
  assert.deepEqual(ready.issues, []);
});
