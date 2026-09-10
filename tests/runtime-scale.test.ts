import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';
import { AcquisitionFamily } from '../src/acquisition-family';
import type { AttemptIdentity } from '../src/acquisition-family';
import { BindingGraph } from '../src/runtime';
import type { BindingDescription, BindingRef } from '../src/runtime';

// Count real graph work instead of asserting machine-dependent latency limits.
class MeasuredDependencies extends Set<symbol> {
  deletions = 0;
  traversals = 0;
  override delete(id: symbol): boolean { this.deletions++; return super.delete(id); }
  override [Symbol.iterator](): SetIterator<symbol> { this.traversals++; return super[Symbol.iterator](); }
  override values(): SetIterator<symbol> { this.traversals++; return super.values(); }
}

function identity(label: string, dependencies = new MeasuredDependencies()): AttemptIdentity {
  return { id: Symbol(label), bindingId: Symbol(label), ownerId: Symbol('owner'),
    label, dependencies, ancestry: undefined, state: 'ready' };
}

test('closing a deep graph disposes every dependent before its dependency exactly once', async () => {
  const count = 12_000;
  const disposed: number[] = [];
  const registrations = Object.fromEntries(Array.from({ length: count }, (_, index) => [
    `p${index}`, DiBag.withDisposal(DiBag.fromFactory((deps: Record<string, unknown>) => ({
      index, link: () => index + 1 < count ? deps[`p${index + 1}`] : undefined,
    }), { acquisitionMode: 'raw' }), value => { disposed.push(value.index); }),
  ]));
  // The generated JavaScript-shaped graph exercises runtime depth independently
  // of TypeScript's finite-key admission. Every dependency is registered.
  const bag = Reflect.apply(DiBag.createBuilder().register, DiBag.createBuilder(), [registrations]).build();
  const nodes = Array.from({ length: count }, (_, index) => bag.resolve(`p${index}`));
  for (let index = 0; index < count - 1; index++) nodes[index].link();
  const closing = bag.close();
  expect(bag.close()).toBe(closing);
  await closing;
  expect(disposed).toEqual(Array.from({ length: count }, (_, index) => index));
  await bag.close();
  expect(disposed).toHaveLength(count);
}, 15_000);

test('retiring an acquisition touches only its actual incoming consumers', () => {
  const family = new AcquisitionFamily();
  const target = identity('target');
  const consumer = identity('consumer');
  const unrelated = Array.from({ length: 1000 }, (_, index) => identity(`unrelated${index}`));
  for (const attempt of [target, consumer, ...unrelated]) family.add(attempt);
  family.recordEdge(consumer, target);
  family.retireIncoming(target);
  expect(consumer.dependencies.has(target.id)).toBe(false);
  expect(unrelated.reduce((sum, attempt) => sum + (attempt.dependencies as MeasuredDependencies).deletions, 0)).toBe(0);
});

test('repeated reads of an existing edge do not traverse the downstream graph again', () => {
  const family = new AcquisitionFamily();
  const consumer = identity('consumer');
  const downstream = Array.from({ length: 100 }, (_, index) => identity(`p${index}`));
  for (const attempt of [consumer, ...downstream]) family.add(attempt);
  for (let index = 0; index < downstream.length - 1; index++) family.recordEdge(downstream[index]!, downstream[index + 1]!);
  family.recordEdge(consumer, downstream[0]!);
  for (const attempt of downstream) (attempt.dependencies as MeasuredDependencies).traversals = 0;
  for (let index = 0; index < 1000; index++) family.recordEdge(consumer, downstream[0]!);
  expect(consumer.dependencies.size).toBe(1);
  expect(downstream.reduce((sum, attempt) => sum + (attempt.dependencies as MeasuredDependencies).traversals, 0)).toBe(0);
  expect(() => family.recordEdge(downstream.at(-1)!, consumer)).toThrow('cycle:');
});

test('late edges across a deep ready graph find cycles without overflowing the stack', () => {
  const family = new AcquisitionFamily();
  const chain = Array.from({ length: 12_000 }, (_, index) => identity(`p${index}`));
  const reader = identity('reader');
  for (const attempt of [...chain, reader]) family.add(attempt);
  for (let index = 0; index < chain.length - 1; index++) family.recordEdge(chain[index]!, chain[index + 1]!);
  expect(() => family.recordEdge(reader, chain[0]!)).not.toThrow();
  expect(() => family.recordEdge(chain.at(-1)!, reader)).toThrow('cycle:');
  expect(chain.at(-1)!.dependencies.has(reader.id)).toBe(false);
});

test('one module lexical map is snapshotted once while external mutations stay isolated', () => {
  let reads = 0;
  const privateId = Symbol('private');
  const ref: BindingRef = { get kind() { reads++; return 'private' as const; }, id: privateId };
  const localNames = new Map([['value', ref]]);
  const bindings = new Map<symbol, BindingDescription>();
  for (let index = 0; index < 100; index++) {
    const id = Symbol(`p${index}`);
    bindings.set(id, { id, label: `p${index}`, registration: () => index, localNames });
  }
  const graph = new BindingGraph({ bindings, publicSlots: new Map() });
  expect(reads).toBe(1);
  localNames.clear();
  const derived = graph.withPublicBinding('another', () => 1);
  for (const id of bindings.keys()) expect(derived.dependency(id, 'value')).toBe(privateId);
});

test('releasing a consumer removes its reverse incoming entries without retiring live peers', () => {
  const family = new AcquisitionFamily();
  const target = identity('target'), other = identity('other');
  const first = identity('first'), peer = identity('peer');
  for (const attempt of [target, other, first, peer]) family.add(attempt);
  family.recordEdge(first, target); family.recordEdge(first, other); family.recordEdge(peer, target);
  // Direct retention/work oracle: forward behavior alone misses stale reverse IDs.
  const incoming = Reflect.get(family, 'incoming') as Map<symbol, Set<symbol>>;
  family.release(first);
  expect(incoming.has(other.id)).toBe(false);
  expect([...incoming.get(target.id)!]).toEqual([peer.id]);
  family.retireIncoming(target);
  expect(peer.dependencies.has(target.id)).toBe(false);
  expect((first.dependencies as MeasuredDependencies).deletions).toBe(0);
  expect((peer.dependencies as MeasuredDependencies).deletions).toBe(1);
  expect(incoming.size).toBe(0);
});

test('a branching late cycle reports the first dependency-order path and leaves its rejected edge absent', () => {
  const family = new AcquisitionFamily();
  const [a, dead, b, c, d] = ['a', 'dead', 'b', 'c', 'd'].map(label => identity(label)) as [AttemptIdentity, AttemptIdentity, AttemptIdentity, AttemptIdentity, AttemptIdentity];
  for (const attempt of [a, dead, b, c, d]) family.add(attempt);
  family.recordEdge(a, dead); family.recordEdge(a, b); family.recordEdge(a, c);
  family.recordEdge(b, d); family.recordEdge(c, d);
  expect(() => family.recordEdge(d, a)).toThrow(/^cycle: a -> b -> d -> a$/);
  expect(d.dependencies.size).toBe(0);
});
