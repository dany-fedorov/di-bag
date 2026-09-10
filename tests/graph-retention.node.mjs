import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
const { BindingGraph } = require(resolve(dirname(resolve(process.env.DI_BAG_RUNTIME_ENTRY ?? 'dist/node.js')), 'runtime.js'));
assert.equal(typeof globalThis.gc, 'function', 'run with --expose-gc');
async function collected(refs) {
  for (let attempt = 0; attempt < 8; attempt++) {
    await setImmediate(); globalThis.gc();
    if (refs.every(ref => ref.deref() === undefined)) return;
  }
  assert.equal(refs.filter(ref => ref.deref() !== undefined).length, 0, 'obsolete graph objects remain reachable');
}

test('current graph releases replaced factories, payloads, IDs and warmed ancestor wrappers', async () => {
  const refs = [];
  function replace(graph, i) {
    const payload = new Array(256).fill(i), factory = () => payload;
    refs.push(new WeakRef(graph), new WeakRef(factory), new WeakRef(payload));
    graph = graph.withPublicBinding('item', factory);
    const id = graph.publicBinding('item');
    graph.registration(id); graph.label(id); graph.findDependency(id, 'item');
    refs.push(new WeakRef(id));
    return graph;
  }
  let graph = new BindingGraph();
  for (let i = 0; i < 100; i++) graph = replace(graph, i);
  graph = graph.withPublicBinding('item', () => 'final');
  await collected(refs);
  assert.equal(graph.registration(graph.publicBinding('item')).create(), 'final');
});

test('contribution append and installation release earlier cached arrays and graph wrappers', async () => {
  const refs = [], key = Symbol('group');
  let graph = new BindingGraph();
  function append(graph, i) {
    const next = graph.withContribution(key, () => i);
    refs.push(new WeakRef(graph), new WeakRef(next.contributionBindings(key)));
    return next;
  }
  for (let i = 0; i < 100; i++) graph = append(graph, i);
  const id = Symbol('installed');
  graph = graph.withInstallation({ bindings: new Map([[id, { id, label: 'installed', registration: () => 100, localNames: new Map() }]]), publicSlots: new Map(), contributions: new Map([[key, [id]]]) });
  await collected(refs);
  assert.deepEqual(graph.contributionBindings(key).map(id => graph.registration(id).create()), Array.from({ length: 101 }, (_, i) => i));
});

test('a private lexical reference intentionally retains an overridden factory', async () => {
  const id = Symbol('private'), consumer = Symbol('consumer');
  let factory = () => 'private'; const ref = new WeakRef(factory);
  const graph = (() => { const initial = new BindingGraph({ bindings: new Map([[id, { id, label: 'private', registration: factory, localNames: new Map() }], [consumer, { id: consumer, label: 'consumer', registration: () => 0, localNames: new Map([['value', { kind: 'private', id }]]) }]]), publicSlots: new Map([['value', id], ['consumer', consumer]]) });
  return initial.withPublicBinding('value', () => 'public'); })();
  factory = undefined;
  await setImmediate(); globalThis.gc();
  assert.ok(ref.deref());
  assert.equal(graph.registration(graph.dependency(consumer, 'value')).create(), 'private');
});

test('symbol lookup remains functional on hosts that reject weak symbol keys', async () => {
  const { readFileSync } = await import('node:fs');
  const { runInNewContext } = await import('node:vm');
  const filename = resolve(dirname(resolve(process.env.DI_BAG_RUNTIME_ENTRY ?? 'dist/node.js')), 'persistent-map.js');
  class ObjectOnlyWeakMap extends WeakMap {
    set(key, value) { if (typeof key === 'symbol') throw new TypeError('unsupported weak key'); return super.set(key, value); }
  }
  const exports = {};
  runInNewContext(readFileSync(filename, 'utf8'), { exports, WeakMap: ObjectOnlyWeakMap });
  const keys = [Symbol('same'), Symbol('same'), Symbol.for('same'), Symbol.iterator, 'Symbol(same)'];
  let map = new exports.PersistentMap();
  keys.forEach((key, i) => { map = map.set(key, i); });
  const previous = map;
  map = map.delete(keys[1]).set(keys[0], 9);
  keys.forEach((key, i) => assert.equal(previous.get(key), i));
  assert.equal(map.get(keys[0]), 9); assert.equal(map.has(keys[1]), false);
  for (let i = 2; i < keys.length; i++) assert.equal(map.get(keys[i]), i);
});

test('removing the last lexical consumer releases displaced private targets and snapshots', async () => {
  const refs = [];
  // Define replacements outside build's lexical context: V8 can share the
  // captured payload slot between otherwise unrelated closures in that scope.
  const replacement = () => 4, nextConsumer = () => 5;
  function build() {
    const target = Symbol('target'), consumer = Symbol('consumer');
    const payload = [1, 2, 3], factory = () => payload;
    const names = new Map([['value', { kind: 'private', id: target }]]);
    refs.push(new WeakRef(target), new WeakRef(consumer), new WeakRef(payload), new WeakRef(factory));
    const original = new BindingGraph({ bindings: new Map([[target, { id: target, label: 'target', registration: factory, localNames: new Map() }], [consumer, { id: consumer, label: 'consumer', registration: () => 0, localNames: names }]]), publicSlots: new Map([['target', target], ['consumer', consumer]]) });
    return original.withPublicBinding('target', replacement).withPublicBinding('consumer', nextConsumer);
  }
  const graph = build();
  await collected(refs);
  assert.equal(graph.registration(graph.publicBinding('target')).create(), 4);
});
