import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { setImmediate } from 'node:timers/promises';
const require = createRequire(import.meta.url);
const { DiBag } = require(resolve(process.argv[2]));
const scenario = process.argv[3];
const count = Number(process.argv[4]);
const sample = Number(process.argv[5]);
const result = { scenario, count, sample, node: process.version };
const raw = create => DiBag.factory(create, { acquisition: 'raw' });
const transient = create => DiBag.withLifetime(create, 'transient');
const heap = () => { globalThis.gc(); return process.memoryUsage().heapUsed; };
if (scenario === 'cold-chain-auto') {
  let created = 0;
  const bindings = Object.fromEntries(Array.from({ length: count }, (_, i) => [`p${i}`, deps => { created++; return i ? deps[`p${i - 1}`] + 1 : 1; }]));
  const bag = DiBag.begin().add(bindings).end();
  const start = performance.now();
  try { result.value = bag.resolve(`p${count - 1}`); assert.equal(result.value, count); } catch (error) {
    result.error = { name: error.name, message: error.message, stack: error.stack?.split('\n').slice(0, 6) };
  }
  result.elapsedMs = performance.now() - start;
  result.created = created;
  await bag.close();
} else {
  const refs = [];
  let created = 0;
  let projected = 0;
  let disposed = 0;
  const source = DiBag.factory(() => {
    const value = Array(256).fill(created++);
    const promise = Promise.resolve(value);
    refs.push(new WeakRef(value), new WeakRef(promise));
    return promise;
  }, { acquisition: 'native' });
  const mapped = DiBag.mapAsync(source, value => {
    projected++;
    const output = Array(256).fill(value[0]);
    refs.push(new WeakRef(output));
    return output;
  });
  const chosen = scenario === 'transient-native-memory' ? source
    : scenario === 'transient-mapped-memory' ? mapped
    : scenario === 'transient-history-memory' ? raw(() => { created++; })
    : scenario === 'cleanup-control' ? DiBag.withDisposal(source, value => {
      assert.equal(value, refs[value[0] * 2].deref());
      disposed++;
    }) : undefined;
  if (!chosen) throw new Error(`unknown scenario: ${scenario}`);
  const bag = DiBag.begin().add({ item: transient(chosen) }).end();
  const before = heap();
  await (async () => {
    for (let i = 0; i < count; i++) {
      if (scenario === 'transient-history-memory') bag.resolve('item');
      else assert.equal((await bag.resolve('item'))[0], i);
    }
  })();
  await setImmediate();
  result.retainedHeapBytes = heap() - before;
  result.retainedPayloads = refs.filter(ref => ref.deref() !== undefined).length;
  result.retainedAcquisitions = bag.inspect('item').acquisitions.length;
  result.created = created;
  result.projected = projected;
  await bag.close();
  assert.equal(disposed, scenario === 'cleanup-control' ? count : 0);
  result.disposed = disposed;
  refs.length = 0;
  await setImmediate();
  result.afterCloseHeapBytes = heap() - before;
}
console.log(JSON.stringify(result));
