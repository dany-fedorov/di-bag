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
    const provider = DiBag.factory(deps => ({
      index, link: () => index + 1 < count ? deps[`p${index + 1}`] : deps.reader,
    }), { acquisition: 'raw' });
    return [`p${index}`, dispose ? DiBag.withDisposal(provider, dispose) : provider];
  }));
  registrations.reader = DiBag.factory(deps => () => deps.p0, { acquisition: 'raw' });
  const bag = DiBag.begin().add(registrations).end();
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
      return [`p${index}`, mode === 'raw' ? DiBag.factory(create, { acquisition: 'raw' }) : create];
    }));
    const bag = DiBag.begin().add(registrations).end();
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
  const bag = DiBag.begin().add({
    thenable: DiBag.factory(function () { assert.equal(this, undefined); return thenable; }, { acquisition: 'raw' }),
    promise: DiBag.factory(() => promise, { acquisition: 'raw' }),
  }).end();
  assert.equal(bag.resolve('thenable'), thenable);
  assert.equal(bag.resolve('promise'), promise);
  assert.equal(bag.resolve('promise'), promise);
  await bag.close();
  assert.equal(reads, 0);
});

for (const lifetime of ['scoped', 'transient']) {
  test(`raw ${lifetime} public reentrant creating cycles invoke the factory once`, async () => {
    let calls = 0;
    const bag = DiBag.begin().add({
      value: DiBag.withLifetime(DiBag.factory(() => { calls++; return bag.resolve('value'); }, { acquisition: 'raw' }), lifetime),
    }).end();
    assert.throws(() => bag.resolve('value'), /^Error: cycle: value -> value$/);
    assert.equal(calls, 1);
    await bag.close();
  });
}

test('native transient ancestry rejects after-await cycles with the original label order', async () => {
  let calls = 0;
  const transient = create => DiBag.withLifetime(DiBag.factory(create, { acquisition: 'native' }), 'transient');
  const bag = DiBag.begin().add({
    a: transient(async deps => { calls++; await Promise.resolve(); return deps.b; }),
    b: transient(async deps => { await Promise.resolve(); return deps.a; }),
  }).end();
  await assert.rejects(bag.resolve('a'), /^Error: cycle: a -> b -> a$/);
  assert.equal(calls, 1);
  await bag.close();
});

test('ready borrowed transient proxies keep late cycle and root capture checks', async () => {
  const raw = create => DiBag.factory(create, { acquisition: 'raw' });
  const transient = create => DiBag.withLifetime(raw(create), 'transient');
  const bag = DiBag.begin().add({
    scoped: raw(() => 42),
    root: DiBag.withLifetime(raw(deps => deps.bridge), 'root'),
    bridge: transient(deps => ({ read: () => deps.scoped })),
    reader: raw(deps => ({ next: () => deps.link })),
    link: transient(deps => ({ next: () => deps.reader })),
  }).end();
  const child = bag.scope();
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
  const bag = DiBag.begin().add({
    value: () => 42,
    failed: mode === 'raw' ? DiBag.factory(create, { acquisition: 'raw' }) : create,
  }).end();
  assert.throws(() => bag.resolve('failed'), error => error === cause);
  assert.equal(read(), 42);
  const closing = bag.close();
  assert.throws(read, /bag is closing/);
  await closing;
  assert.throws(read, /bag is closed/);
});
