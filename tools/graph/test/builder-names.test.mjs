import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { extractDependencyGraph } from '../lib/extract.mjs';

const root = resolve(import.meta.dirname, '../../..');
const extract = name => extractDependencyGraph({ files: [resolve(root, 'tools/graph/test/fixtures', name)], root });
const shape = graph => graph.units.map(({ id, file, line, installs, nodes, ...rest }) => ({
  ...rest, installs: installs.length, nodes: nodes.map(({ line: _line, ...node }) => node),
}));

test('a graph written with the 0.5.0 builder calls is read like the same graph in 0.4.0 calls', () => {
  const before = extract('builder-names-0-4.ts');
  const after = extract('builder-names-0-5.ts');
  assert.equal(before.units.length, 3);
  assert.deepEqual(shape(after).slice(0, 3), shape(before));
  assert.deepEqual(after.issues.map(({ unit, ...issue }) => issue), before.issues.map(({ unit, ...issue }) => issue));
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

test('repeated collection contribution providers are omitted equally while ordinary services retain their edges', () => {
  for (const name of ['builder-names-0-4.ts', 'builder-names-0-5.ts']) {
    const graph = extract(name);
    const app = graph.units[2];
    assert.equal(app.nodes.some(node => node.key === 'events'), false, name);
    assert.deepEqual(app.edges.filter(edge => edge.from === 'ordinary'), [{ from: 'ordinary', to: 'leftDependency' }], name);
    assert.equal(app.edges.some(edge => edge.to === 'rightDependency'), false, name);
  }
});
