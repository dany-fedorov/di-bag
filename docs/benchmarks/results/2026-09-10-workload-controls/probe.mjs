import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
const [entry, kind, mode, size] = process.argv.slice(2);
const { DiBag, DiBagCleanupError } = createRequire(import.meta.url)(entry);
const count = Number(size);
const turn = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const heap = () => { global.gc(); return process.memoryUsage().heapUsed; };
const began = performance.now();
let result;
if (kind === 'observer') {
  const gates = [], failures = [], delivered = [];
  let pending = 0;
  const facade = mode === 'none' ? DiBag : DiBag.observe({
    onEvent(event) {
      assert.ok(Object.isFrozen(event));
      const index = delivered.length;
      delivered.push(event.kind);
      if (mode === 'fast') return;
      const gate = deferred(); gates.push(gate); pending++;
      return gate.promise.finally(() => { pending--; });
    },
    onError({ error }) { failures.push(error); },
  });
  const bag = facade.begin().add({ item: DiBag.withLifetime(DiBag.factory(() => 1, { acquisition: 'raw' }), 'transient') }).end();
  await turn();
  if (gates.length) { gates.shift().resolve(); await turn(); }
  delivered.length = 0;
  const before = heap();
  for (let index = 0; index < count; index++) assert.equal(bag.resolve('item'), 1);
  const burst = { delivered: delivered.length, pending, heap: heap() };
  assert.equal(burst.delivered, 0);
  await turn();
  const drained = { delivered: delivered.length, pending, heap: heap() };
  assert.equal(drained.delivered, mode === 'none' ? 0 : count * 2);
  for (let index = 0; index < delivered.length; index += 2) assert.deepEqual(delivered.slice(index, index + 2), ['acquisition-started', 'acquisition-ready']);
  const expectedErrors = [];
  for (let index = 0; index < gates.length; index++) {
    if (index % 100 === 0) { expectedErrors.push(index); gates[index].reject(index); }
    else gates[index].resolve();
  }
  gates.length = 0;
  await turn();
  assert.deepEqual(failures, expectedErrors);
  assert.equal(pending, 0);
  const released = { delivered: delivered.length, pending, failures: failures.length, heap: heap() };
  const closing = bag.close();
  await closing; await turn();
  for (const gate of gates) gate.resolve();
  gates.length = 0; await turn();
  result = { before, burst, drained, released };
} else if (kind === 'startup') {
  let calls = 0, active = 0, peak = 0, disposed = 0, ready = 0, peakHeap = 0;
  const external = new Set();
  const registrations = Object.fromEntries(Array.from({ length: count }, (_, index) => [`p${index}`, DiBag.withDisposal(() => {
    calls++; active++; peak = Math.max(peak, active);
    const gate = deferred();
    // Application-owned in-flight workspace, released independently of the library.
    const request = { gate, workspace: Array(32768).fill(index) };
    external.add(request);
    peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed);
    setTimeout(() => { external.delete(request); active--; ready++; gate.resolve(index); }, 4);
    return gate.promise;
  }, () => { disposed++; })]));
  const builder = DiBag.begin().add(registrations);
  const before = heap();
  const started = performance.now();
  const bag = await builder.start(Object.keys(registrations), { concurrency: /^\d+$/.test(mode) ? Number(mode) : mode });
  const startupMs = performance.now() - started;
  assert.equal(calls, count); assert.equal(ready, count); assert.equal(active, 0); assert.equal(external.size, 0);
  await bag.close(); assert.equal(disposed, count);
  result = { before, peakHeap, after: heap(), calls, peak, ready, disposed, startupMs, applicationPeakWorkspaceBytes: peak * 32768 * 8 };
} else if (kind === 'close') {
  const source = deferred(), disposer = deferred(), disposalStarted = deferred();
  let calls = 0, disposed = 0, settled = false;
  const error = new Error('external disposer failed');
  const bag = DiBag.begin().add({ item: DiBag.withDisposal(() => { calls++; return source.promise; }, async value => {
    assert.equal(value, 42); disposed++; disposalStarted.resolve(); await disposer.promise;
    if (mode === 'failure') throw error;
  }) }).end();
  bag.resolve('item');
  if (mode === 'fulfilled') { source.resolve(42); disposer.resolve(); }
  const close = bag.close();
  assert.equal(close, bag.close());
  const outcome = close.then(() => { settled = true; return 'closed'; }, error => { settled = true; return error; });
  const waits = [];
  if (mode !== 'fulfilled') {
    for (const stage of ['source', 'disposer']) {
      const start = performance.now();
      const outcomeAtDeadline = await Promise.race([outcome, new Promise(resolve => setTimeout(() => resolve('deadline'), 5))]);
      assert.equal(outcomeAtDeadline, 'deadline'); assert.equal(settled, false); assert.equal(close, bag.close());
      waits.push({ stage, waitMs: performance.now() - start, settled, disposed });
      if (stage === 'source') { assert.equal(disposed, 0); source.resolve(42); await disposalStarted.promise; }
      else { assert.equal(disposed, 1); disposer.resolve(); }
    }
  }
  const final = await outcome;
  if (mode === 'failure') { assert.ok(final instanceof DiBagCleanupError); assert.equal(final.failures[0].error, error); }
  else assert.equal(final, 'closed');
  assert.equal(calls, 1); assert.equal(disposed, 1); assert.equal(close, bag.close());
  result = { waits, calls, disposed, settled, errorCount: final instanceof DiBagCleanupError ? final.failures.length : 0, heap: heap() };
} else throw new Error('unknown probe');
console.log(JSON.stringify({ entry, kind, mode, count, node: process.version, flags: process.execArgv, elapsedMs: performance.now() - began, ...result }));
