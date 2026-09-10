import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
const require = createRequire(import.meta.url);
const entry = resolve(process.argv[2]);
const { DiBag } = require(entry);
const { BindingGraph } = require(resolve(dirname(entry), 'runtime.js'));
const scenario = process.argv[3], count = Number(process.argv[4]), sample = Number(process.argv[5]);
const heap = () => { global.gc(); return process.memoryUsage().heapUsed; };
const raw = value => DiBag.factory(() => value, { acquisition: 'raw' });
const row = { scenario, count, sample, node: process.version, weakSymbols: (() => { try { new WeakMap().set(Symbol(), 1); return true; } catch { return false; } })() };
const strings = Array.from({ length: count }, (_, i) => `p${i}`);
const keys = scenario.includes('tokens') ? strings.map(() => Symbol('same')) : strings;
const provider = raw(1);
const before = heap();
const start = performance.now();
let graph = new BindingGraph();
if (scenario.startsWith('bulk')) graph = graph.withPublicBindings(keys.map(key => [key, provider]));
else if (scenario.startsWith('incremental')) for (const key of keys) graph = graph.withPublicBinding(key, provider);
else if (scenario === 'replacement-memory') {
  for (let i = 0; i < count; i++) graph = graph.withPublicBinding('item', raw(new Array(256).fill(i)));
} else if (scenario === 'contribution-append' || scenario === 'contribution-cached-memory') {
  const key = Symbol('group');
  for (let i = 0; i < count; i++) {
    graph = graph.withContribution(key, provider);
    if (scenario === 'contribution-cached-memory') graph.contributionBindings(key);
  }
  assert.equal(graph.contributionBindings(key).length, count);
} else if (scenario === 'retained-versions') {
  const versions = [];
  for (let i = 0; i < count; i++) { graph = graph.withPublicBinding('item', raw(i)); versions.push(graph); }
  row.elapsedMs = performance.now() - start;
  row.retainedHeapBytes = heap() - before;
  for (let i = 0; i < count; i++) assert.equal(versions[i].registration(versions[i].publicBinding('item')).create(), i);
  row.retainedVersions = versions.length;
} else throw new Error(scenario);
row.elapsedMs ??= performance.now() - start;
row.retainedHeapBytes ??= heap() - before;
if (scenario.startsWith('bulk') || scenario.startsWith('incremental')) for (const key of keys) assert.equal(graph.registration(graph.publicBinding(key)).create(), 1);
console.log(JSON.stringify(row));
