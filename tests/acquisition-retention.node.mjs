import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';

// WeakRef targets survive their current job. Always yield before forcing GC.
// Run: node --expose-gc --test --test-isolation=none tests/acquisition-retention.node.mjs
const require = createRequire(import.meta.url);
const entry = resolve(process.env.DI_BAG_RUNTIME_ENTRY ?? 'dist/node.js');
const { DiBag } = require(entry);
assert.equal(typeof globalThis.gc, 'function', 'this suite requires --expose-gc');
const transient = provider => DiBag.withLifetime(provider, 'transient');
const raw = create => DiBag.fromFactory(create, { acquisitionMode: 'raw' });
const native = create => DiBag.fromFactory(create, { acquisitionMode: 'nativePromise' });

async function collected(refs) {
  for (let attempt = 0; attempt < 8; attempt++) {
    await setImmediate();
    globalThis.gc();
    if (refs.every(ref => ref.deref() === undefined)) return;
  }
  assert.equal(refs.filter(ref => ref.deref() !== undefined).length, 0, 'discarded borrowed payloads remain reachable');
}

for (const route of ['resolve', 'alias', 'dependency', 'collection', 'startup']) {
  test(`discarded raw transient arrays are collectible after ${route}`, async () => {
    const refs = [];
    let calls = 0;
    const provider = transient(raw(() => {
      calls++;
      const value = Array(256).fill(calls);
      refs.push(new WeakRef(value));
      return value;
    }));
    const token = DiBag.token(Symbol('arrays')).of();
    const builder = route === 'collection' ? DiBag.createBuilder().contribute(token, provider)
      : DiBag.createBuilder().register({ value: provider, reader: raw(deps => () => deps.value.length) }).alias('copy', 'value');
    const bag = route === 'startup' ? await builder.buildAndStart(['copy']) : builder.build();
    try {
      if (route !== 'startup') for (let index = 0; index < 16; index++) {
        if (route === 'collection') assert.equal(bag.resolveAll(token)[0].length, 256);
        else if (route === 'dependency') assert.equal(bag.resolve('reader')(), 256);
        else assert.equal(bag.resolve(route === 'alias' ? 'copy' : 'value')[0], index + 1);
      }
      assert.equal(calls, route === 'startup' ? 1 : 16);
      await collected(refs);
      const inspection = route === 'collection' ? bag.inspectAll(token)[0] : bag.inspect('copy');
      assert.equal(inspection.acquisitions.length, calls);
      assert.ok(inspection.acquisitions.every(attempt => attempt.state === 'ready'));
      assert.equal(new Set(inspection.acquisitions.map(attempt => attempt.acquisitionId)).size, calls);
    } finally { await bag.close(); }
  });
}

for (const mapped of [false, true]) {
  test(`discarded native transient promises and ${mapped ? 'mapped' : 'source'} arrays are collectible`, async () => {
    const refs = [];
    let sourceCalls = 0;
    let mapCalls = 0;
    const source = native(() => {
      sourceCalls++;
      const value = Array(256).fill(7);
      const promise = Promise.resolve(value);
      refs.push(new WeakRef(value), new WeakRef(promise));
      return promise;
    });
    const provider = mapped ? DiBag.transformService(source, { mode: 'awaited', transform: value => {
      mapCalls++;
      assert.equal(value[0], 7);
      const output = Array(256).fill(9);
      refs.push(new WeakRef(output));
      return output;
    } }) : source;
    const bag = DiBag.createBuilder().register({ value: transient(provider) }).build();
    try {
      await (async () => {
        for (let index = 0; index < 16; index++) {
          const pending = bag.resolve('value');
          refs.push(new WeakRef(pending));
          assert.equal((await pending)[0], mapped ? 9 : 7);
        }
      })();
      await collected(refs);
      assert.equal(sourceCalls, 16);
      assert.equal(mapCalls, mapped ? 16 : 0);
      assert.equal(bag.inspect('value').acquisitions.length, 16);
    } finally { await bag.close(); }
  });
}

test('borrowed mapped payloads are collectible while independent inspection frames survive', async () => {
  const refs = [];
  const frame = { tag: 'retained metadata' };
  const source = raw(() => {
    const value = Array(256).fill(11);
    refs.push(new WeakRef(value));
    return { value };
  });
  const annotated = DiBag.withMetadata(source, { dynamic: { mode: 'direct', describe: () => ({ metadata: frame }) } });
  const bag = DiBag.createBuilder().register({ value: transient(DiBag.transformService(annotated, { mode: 'direct', transform: source => source.value, ...{ acquisitionMode: 'raw' } })) }).build();
  try {
    for (let index = 0; index < 16; index++) assert.equal(bag.resolve('value')[0], 11);
    const before = bag.inspect('value');
    await collected(refs);
    assert.deepEqual(bag.inspect('value'), before);
    assert.equal(before.acquisitions.length, 16);
    assert.equal(before.acquisitions[0].acquisitionMetadata[0].value.metadata, frame);
  } finally { await bag.close(); }
});

test('transient owned source and mapped identities survive GC until reverse stage cleanup', async () => {
  const refs = [];
  const disposed = [];
  const own = (provider, label) => DiBag.withDisposal(provider, value => {
    assert.equal(value, refs[label].deref());
    disposed.push(label);
  });
  const source = own(native(() => {
    const value = Array(256).fill(1);
    refs[0] = new WeakRef(value);
    return Promise.resolve(value);
  }), 0);
  const mapped = own(DiBag.transformService(source, { mode: 'awaited', transform: value => {
    assert.equal(value[0], 1);
    const result = Array(256).fill(2);
    refs[1] = new WeakRef(result);
    return result;
  } }), 1);
  const bag = DiBag.createBuilder().register({ value: transient(mapped) }).build();
  await bag.resolve('value');
  await setImmediate();
  globalThis.gc();
  assert.ok(refs.every(ref => ref.deref() !== undefined));
  await bag.close();
  assert.deepEqual(disposed, [1, 0]);
  await collected(refs);
});

test('closing releases compacted frame payloads even when a dependency proxy is retained', async () => {
  const refs = [];
  function describe() {
    const frame = { tag: 'release on close' };
    refs.push(new WeakRef(frame));
    return { metadata: frame };
  }
  const bag = DiBag.createBuilder().register({
    other: raw(() => 42),
    value: transient(DiBag.withMetadata(raw(deps => () => deps.other), { dynamic: { mode: 'direct', describe: describe } })),
  }).build();
  const read = bag.resolve('value');
  assert.equal(read(), 42);
  await setImmediate();
  globalThis.gc();
  assert.notEqual(refs[0].deref(), undefined);
  await bag.close();
  await collected(refs);
  assert.throws(read, /bag is closed/);
});

test('a ready borrowed projection drops its payload while pending source ownership and close admission survive', async () => {
  let open;
  const gate = new Promise(resolve => { open = resolve; });
  const outputs = [];
  const sources = [];
  const disposed = [];
  const source = DiBag.withDisposal(native(async deps => {
    await gate;
    const value = { root: deps.root };
    sources.push(new WeakRef(value));
    return value;
  }), value => {
    assert.equal(value, sources[0].deref());
    assert.equal(value.root, 42);
    disposed.push('source');
  });
  const bag = DiBag.createBuilder().register({
    root: DiBag.withLifetime(DiBag.withDisposal(raw(() => 42), () => { disposed.push('root'); }), 'root'),
    value: transient(DiBag.transformService(source, { mode: 'direct', transform: () => {
      const value = Array(256).fill(3);
      outputs.push(new WeakRef(value));
      return value;
    }, ...{ acquisitionMode: 'raw' } })),
  }).build();
  assert.equal(bag.resolve('value')[0], 3);
  assert.equal(bag.inspect('value').acquisitions[0].state, 'ready');
  try { await collected(outputs); } finally {
    const closing = bag.close();
    open();
    await closing;
  }
  assert.deepEqual(disposed, ['source', 'root']);
});
