import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { test } from 'node:test';

// Run against an emitted runtime: Node's stack limit differs from Bun's.
// DI_BAG_RUNTIME_ENTRY can select an isolated build without touching dist/.
const require = createRequire(import.meta.url);
const { DiBag } = require(resolve(process.env.DI_BAG_RUNTIME_ENTRY ?? 'dist/node.js'));
const count = 12_000;

function chain(dispose) {
  const registrations = Object.fromEntries(Array.from({ length: count }, (_, index) => {
    const provider = DiBag.fromFactory(deps => ({
      index, link: () => index + 1 < count ? deps[`p${index + 1}`] : deps.reader,
    }), { acquisitionMode: 'raw' });
    return [`p${index}`, dispose ? DiBag.withDisposal(provider, dispose) : provider];
  }));
  registrations.reader = DiBag.fromFactory(deps => () => deps.p0, { acquisitionMode: 'raw' });
  const bag = DiBag.createBuilder().register(registrations).build();
  const nodes = Array.from({ length: count }, (_, index) => bag.resolve(`p${index}`));
  for (let index = 0; index < count - 1; index++) nodes[index].link();
  return { bag, nodes };
}

test('Node disposes a deep ready graph in dependency order and only once', async () => {
  const disposed = [];
  const { bag } = chain(value => { disposed.push(value.index); });
  const closing = bag.close();
  assert.equal(bag.close(), closing);
  await closing;
  assert.deepEqual(disposed, Array.from({ length: count }, (_, index) => index));
  await bag.close();
  assert.equal(disposed.length, count);
});

test('Node admits a late acyclic edge and rejects a late cycle across a deep graph', async () => {
  const { bag, nodes } = chain();
  try {
    const reader = bag.resolve('reader');
    assert.equal(reader(), nodes[0]);
    assert.throws(() => nodes.at(-1).link(), /^Error: cycle:/);
  } finally {
    await bag.close();
  }
});

for (const mode of ['raw', 'auto']) test(`Node cold-resolves 1,000 ${mode} named factories exactly once without increasing its stack`, async () => {
  // A fresh process prevents earlier wide/deep tests from warming V8's resolver.
  async function cold(entry, mode) {
    const { default: assert } = await import('node:assert/strict');
    const { createRequire } = await import('node:module');
    const { DiBag } = createRequire(import.meta.url)(entry);
    const calls = Array(1000).fill(0);
    const registrations = Object.fromEntries(Array.from({ length: 1000 }, (_, index) => {
      const create = deps => {
        calls[index]++;
        return index === 0 ? 1 : deps[`p${index - 1}`] + 1;
      };
      return [`p${index}`, mode === 'raw' ? DiBag.fromFactory(create, { acquisitionMode: 'raw' }) : create];
    }));
    const bag = DiBag.createBuilder().register(registrations).build();
    try {
      assert.equal(bag.resolve('p999'), 1000);
      assert.equal(bag.resolve('p999'), 1000);
      assert.deepEqual(calls, Array(1000).fill(1));
    } finally { await bag.close(); }
  }
  const entry = resolve(process.env.DI_BAG_RUNTIME_ENTRY ?? 'dist/node.js');
  const child = spawnSync(process.execPath, ['--input-type=module', '--eval', `await (${cold})(${JSON.stringify(entry)}, ${JSON.stringify(mode)})`], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr || child.stdout);
});

test('raw fast acquisition preserves unobserved thenable and promise identity and factory receiver', async () => {
  let reads = 0;
  const thenable = { get then() { reads++; throw new Error('must not inspect raw then'); } };
  const promise = Promise.resolve(42);
  const bag = DiBag.createBuilder().register({
    thenable: DiBag.fromFactory(function () { assert.equal(this, undefined); return thenable; }, { acquisitionMode: 'raw' }),
    promise: DiBag.fromFactory(() => promise, { acquisitionMode: 'raw' }),
  }).build();
  assert.equal(bag.resolve('thenable'), thenable);
  assert.equal(bag.resolve('promise'), promise);
  assert.equal(bag.resolve('promise'), promise);
  await bag.close();
  assert.equal(reads, 0);
});

for (const lifetime of ['scoped', 'transient']) {
  test(`raw ${lifetime} public reentrant creating cycles invoke the factory once`, async () => {
    let calls = 0;
    const bag = DiBag.createBuilder().register({
      value: DiBag.withLifetime(DiBag.fromFactory(() => { calls++; return bag.resolve('value'); }, { acquisitionMode: 'raw' }), lifetime),
    }).build();
    assert.throws(() => bag.resolve('value'), /^Error: cycle: value -> value$/);
    assert.equal(calls, 1);
    await bag.close();
  });
}

test('native transient ancestry rejects after-await cycles with the original label order', async () => {
  let calls = 0;
  const transient = create => DiBag.withLifetime(DiBag.fromFactory(create, { acquisitionMode: 'nativePromise' }), 'transient');
  const bag = DiBag.createBuilder().register({
    a: transient(async deps => { calls++; await Promise.resolve(); return deps.b; }),
    b: transient(async deps => { await Promise.resolve(); return deps.a; }),
  }).build();
  await assert.rejects(bag.resolve('a'), /^Error: cycle: a -> b -> a$/);
  assert.equal(calls, 1);
  await bag.close();
});

test('ready borrowed transient proxies keep late cycle and root capture checks', async () => {
  const raw = create => DiBag.fromFactory(create, { acquisitionMode: 'raw' });
  const transient = create => DiBag.withLifetime(raw(create), 'transient');
  const bag = DiBag.createBuilder().register({
    scoped: raw(() => 42),
    root: DiBag.withLifetime(raw(deps => deps.bridge), 'root'),
    bridge: transient(deps => ({ read: () => deps.scoped })),
    reader: raw(deps => ({ next: () => deps.link })),
    link: transient(deps => ({ next: () => deps.reader })),
  }).build();
  const child = bag.createScope();
  const bridge = child.resolve('root');
  assert.throws(bridge.read, /root lifetime cannot capture scoped dependency: root -> scoped/);
  const reader = bag.resolve('reader');
  assert.throws(reader.next().next, /^Error: cycle: reader -> link -> reader$/);
  assert.equal(child.resolve('scoped'), 42);
  await bag.close();
});

for (const mode of ['raw', 'auto']) test(`failed direct ${mode} sources cannot use retained proxies during close`, async () => {
  let read;
  const cause = new Error('source failed');
  const create = deps => { read = () => deps.value; throw cause; };
  const bag = DiBag.createBuilder().register({
    value: () => 42,
    failed: mode === 'raw' ? DiBag.fromFactory(create, { acquisitionMode: 'raw' }) : create,
  }).build();
  assert.throws(() => bag.resolve('failed'), error => error === cause);
  assert.equal(read(), 42);
  const closing = bag.close();
  assert.throws(read, /bag is closing/);
  await closing;
  assert.throws(read, /bag is closed/);
});

function gate() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const turn = () => new Promise(resolve => setImmediate(resolve));

for (const startupOrder of [1, 2]) test(`Node numeric startup ${startupOrder} bounds selected readiness without awaiting raw outputs`, async () => {
  const gates = [gate(), gate(), gate()];
  const calls = [], disposed = [];
  const provider = index => DiBag.withDisposal(() => { calls.push(index); return gates[index].promise; }, value => { disposed.push(value); });
  const starting = DiBag.createBuilder().register({ a: provider(0), b: provider(1), c: provider(2) }).buildAndStart(['a', 'b', 'c'], { startupOrder });
  assert.deepEqual(calls, startupOrder === 1 ? [0] : [0, 1]);
  gates[0].resolve(10); await turn();
  assert.deepEqual(calls, startupOrder === 1 ? [0, 1] : [0, 1, 2]);
  gates[1].resolve(11); gates[2].resolve(12);
  const bag = await starting;
  assert.equal(bag.resolve('a'), gates[0].promise);
  await bag.close(); assert.deepEqual(disposed, [12, 11, 10]);

  let reads = 0, later = 0;
  const raw = { get then() { reads++; throw new Error('raw then'); } };
  const ready = await DiBag.createBuilder().register({
    raw: DiBag.fromFactory(() => raw, { acquisitionMode: 'raw' }), later: () => ++later,
  }).buildAndStart(['raw', 'later'], { startupOrder });
  assert.equal(ready.resolve('raw'), raw); assert.equal(reads, 0); assert.equal(later, 1);
  await ready.close();
});

test('Node observer burst drains in transition and registration order while external callback gates remain pending', async () => {
  const pending = [], events = [], failures = [];
  const bag = DiBag.withConfiguration({ observers: [{
    onEvent(event) { const wait = gate(); pending.push(wait); events.push(`first:${event.kind}`); return wait.promise; },
    onError({ error }) { failures.push(error); },
  }] }).withConfiguration({ observers: [{ onEvent(event) { events.push(`second:${event.kind}`); }, onError() { assert.fail('fast observer failed'); } }] }).createBuilder().register({ value: DiBag.withLifetime(DiBag.fromFactory(() => 1, { acquisitionMode: 'raw' }), 'transient') }).build();
  await turn(); pending.shift().resolve(); events.length = 0;
  for (let i = 0; i < 100; i++) assert.equal(bag.resolve('value'), 1);
  assert.equal(events.length, 0); await turn();
  assert.equal(pending.length, 200);
  assert.deepEqual(events, Array.from({ length: 100 }, () => [
    'first:acquisition-started', 'second:acquisition-started', 'first:acquisition-ready', 'second:acquisition-ready',
  ]).flat());
  pending.forEach((wait, index) => index % 2 ? wait.resolve() : wait.reject(index)); pending.length = 0;
  await turn(); assert.deepEqual(failures, Array.from({ length: 100 }, (_, index) => index * 2));
  await bag.close(); await turn(); pending.forEach(wait => wait.resolve()); await turn();
});

test('Node application wait deadlines preserve memoized pending source and disposer cleanup', async () => {
  const source = gate(), disposer = gate(), entered = gate();
  const error = new Error('dispose failed');
  let count = 0, settled = false;
  const bag = DiBag.createBuilder().register({ value: DiBag.withDisposal(() => source.promise, async value => {
    assert.equal(value, 42); count++; entered.resolve(); await disposer.promise; throw error;
  }) }).build();
  bag.resolve('value');
  const closing = bag.close();
  const outcome = closing.catch(error => error).then(value => { settled = true; return value; });
  for (const stage of ['source', 'disposer']) {
    // Gate-based CI oracle: the host's deadline event fires without requiring a wall-time threshold.
    const deadline = gate();
    const waited = Promise.race([outcome, deadline.promise]);
    deadline.resolve('deadline'); assert.equal(await waited, 'deadline');
    assert.equal(settled, false); assert.equal(bag.close(), closing);
    if (stage === 'source') { assert.equal(count, 0); source.resolve(42); await entered.promise; }
    else { assert.equal(count, 1); disposer.resolve(); }
  }
  const failure = await outcome;
  assert.equal(failure.failures[0].error, error); assert.equal(failure.failures.length, 1);
  assert.equal(count, 1); assert.equal(bag.close(), closing);
});
