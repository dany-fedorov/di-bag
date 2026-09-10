import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
// Usage: node --expose-gc probe.mjs <compiled node.js> <scenario> <count> [sample]
if (!process.argv[2] || !global.gc) throw new Error('Supply a compiled node.js entry and run Node with --expose-gc');
const { DiBag } = require(resolve(process.argv[2]));
const scenario = process.argv[3];
const count = Number(process.argv[4]);
const sample = Number(process.argv[5] ?? 0);
if (!Number.isSafeInteger(count) || count < 1) throw new Error('count must be a positive integer');
const now = () => performance.now();
const raw = create => DiBag.factory(create, { acquisition: 'raw' });
const result = { scenario, count, sample, node: process.version };
const heap = () => { global.gc(); return process.memoryUsage().heapUsed; };
const describeError = error => ({ name: error.name, message: error.message, stack: error.stack?.split('\n').slice(0, 6), errors: error.errors?.map(describeError) });
if (scenario === 'close-flat') {
  let disposed = 0;
  const bag = DiBag.begin().add({ item: DiBag.withLifetime(DiBag.withDisposal(raw(() => 1), () => { disposed++; }), 'transient') }).end();
  for (let i = 0; i < count; i++) bag.resolve('item');
  const start = now();
  await bag.close();
  result.elapsedMs = now() - start;
  assert.equal(disposed, count);
  result.disposed = disposed;
} else if (scenario === 'transient-memory') {
  const bag = DiBag.begin().add({ item: DiBag.withLifetime(raw(() => new Array(256).fill(7)), 'transient') }).end();
  const before = heap();
  for (let i = 0; i < count; i++) bag.resolve('item');
  result.retainedHeapBytes = heap() - before;
  result.retainedAcquisitions = bag.inspect('item').acquisitions.length;
  assert.equal(result.retainedAcquisitions, count);
  const start = now();
  await bag.close();
  result.closeMs = now() - start;
  result.afterCloseHeapBytes = heap() - before;
} else if (scenario === 'warm-proxy' || scenario === 'close-deep') {
  const bindings = Object.create(null);
  let disposed = 0;
  for (let i = 0; i < count; i++) {
    const p = raw(deps => ({ link: () => i + 1 < count ? deps[`p${i + 1}`] : undefined }));
    bindings[`p${i}`] = scenario === 'close-deep' ? DiBag.withDisposal(p, () => { disposed++; }) : p;
  }
  bindings.reader = raw(deps => () => deps.p0);
  const bag = DiBag.begin().add(bindings).end();
  const nodes = Array.from({ length: count }, (_, i) => bag.resolve(`p${i}`));
  for (let i = 0; i < count - 1; i++) assert.equal(nodes[i].link(), nodes[i + 1]);
  if (scenario === 'warm-proxy') {
    const read = bag.resolve('reader');
    assert.equal(read(), nodes[0]);
    for (let i = 0; i < 100; i++) read();
    const iterations = 10000;
    let start = now();
    for (let i = 0; i < iterations; i++) read();
    result.proxyMs = now() - start;
    start = now();
    for (let i = 0; i < iterations; i++) bag.resolve('p0');
    result.directMs = now() - start;
    result.iterations = iterations;
    await bag.close();
  } else {
    const start = now();
    try { await bag.close(); } catch (error) { result.error = describeError(error); }
    result.elapsedMs = now() - start;
    result.disposed = disposed;
    result.expectedDisposals = count;
    result.afterCloseAcquisitions = bag.inspect('p0').acquisitions.length;
    await bag.close().catch(() => {});
    result.disposedAfterSecondClose = disposed;
    try { bag.resolve('p0'); } catch (error) { result.resolveAfterClose = error.message; }
  }
} else if (scenario === 'scope-override') {
  const bindings = Object.fromEntries(Array.from({ length: count }, (_, i) => [`p${i}`, raw(() => i)]));
  const bag = DiBag.begin().add(bindings).end();
  const replacement = { p0: raw(() => -1) };
  const iterations = 100;
  for (let i = 0; i < 5; i++) { await bag.scope().close(); await bag.scope(['p0'], replacement).close(); }
  let start = now();
  for (let i = 0; i < iterations; i++) await bag.scope().close();
  result.plainMs = now() - start;
  start = now();
  for (let i = 0; i < iterations; i++) await bag.scope(['p0'], replacement).close();
  result.overrideMs = now() - start;
  result.iterations = iterations;
  await bag.close();
} else if (scenario === 'cold-chain') {
  let created = 0;
  const bindings = Object.fromEntries(Array.from({ length: count }, (_, i) => [`p${i}`, raw(deps => { created++; return i ? deps[`p${i - 1}`] + 1 : 1; })]));
  const bag = DiBag.begin().add(bindings).end();
  const start = now();
  try { result.value = bag.resolve(`p${count - 1}`); assert.equal(result.value, count); } catch (error) { result.error = describeError(error); }
  result.elapsedMs = now() - start;
  result.created = created;
  await bag.close();
} else if (scenario === 'module-install') {
  const provider = raw(() => 1);
  const bindings = Object.fromEntries(Array.from({ length: count }, (_, i) => [`p${i}`, provider]));
  const module = DiBag.module().add(bindings).exports(['p0']);
  const before = heap();
  const start = now();
  const bag = DiBag.begin().install(module).end();
  result.installMs = now() - start;
  result.retainedHeapBytes = heap() - before;
  assert.equal(bag.resolve('p0'), 1);
  await bag.close();
} else if (scenario === 'build-incremental' || scenario === 'replace-history') {
  const provider = raw(() => 1);
  const before = heap();
  let start = now();
  let builder = DiBag.begin();
  if (scenario === 'replace-history') {
    builder = builder.add({ item: provider });
    for (let i = 0; i < count; i++) builder = builder.replace('item', raw(() => new Array(256).fill(i)));
  } else {
    for (let i = 0; i < count; i++) builder = builder.add({ [`p${i}`]: provider });
  }
  const bag = builder.end();
  result.incrementalMs = now() - start;
  result.retainedHeapBytes = heap() - before;
  await bag.close();
  if (scenario === 'build-incremental') {
    const bindings = Object.fromEntries(Array.from({ length: count }, (_, i) => [`p${i}`, provider]));
    start = now();
    const bulk = DiBag.begin().add(bindings).end();
    result.bulkMs = now() - start;
    await bulk.close();
  }
} else throw new Error(`Unknown scenario ${scenario}`);
console.log(JSON.stringify(result));
