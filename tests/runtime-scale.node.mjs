import assert from 'node:assert/strict';
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
