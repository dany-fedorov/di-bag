import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { extractDependencyGraph } from '../lib/extract.mjs';

const root = resolve(import.meta.dirname, '../../..');
const extract = name => extractDependencyGraph({ files: [resolve(root, 'tools/graph/test/fixtures', name)], root });
test('a graph written with the 0.5.0 builder calls is extracted completely', () => {
  const graph = extract('builder-names-0-5.ts');
  assert.equal(graph.units.length, 4);
  assert.deepEqual(graph.units.map(unit => unit.kind), ['module', 'module', 'bag', 'bag']);
});

test('options bags are read by property name, and a module list by element, inline or behind a constant', () => {
  const graph = extract('builder-names-0-5.ts');
  const [retrieval, clocks, app, inline] = graph.units;
  assert.deepEqual([retrieval.kind, retrieval.label, retrieval.exports], ['module', 'retrieval', ['retrieve']]);
  assert.deepEqual(app.installs, [retrieval.id, clocks.id]);
  assert.deepEqual(inline.installs, [retrieval.id, clocks.id]);
  assert.deepEqual(app.nodes.map(node => node.key), ['search', 'run', 'leftDependency', 'rightDependency', 'ordinary', 'search']);
  assert.deepEqual(graph.issues.map(issue => issue.dependency), ['normalize']);
});

test('repeated collection contribution providers are omitted while ordinary services retain their edges', () => {
  const graph = extract('builder-names-0-5.ts');
  const app = graph.units[2];
  assert.equal(app.nodes.some(node => node.key === 'events'), false);
  assert.deepEqual(app.edges.filter(edge => edge.from === 'ordinary'), [{ from: 'ordinary', to: 'leftDependency' }]);
  assert.equal(app.edges.some(edge => edge.to === 'rightDependency'), false);
});
