import { expect, test } from 'bun:test';
import { BindingGraph } from '../src/runtime';
import type { BindingDescription, BindingRef } from '../src/runtime';
import { Runtime } from './runtime-context';
import { DiBag } from '../src/node';

const binding = (id: symbol, value: number, localNames: ReadonlyMap<string | symbol, BindingRef> = new Map()): BindingDescription =>
  ({ id, label: String(id), registration: () => value, localNames });

test('replacement removes obsolete public IDs while earlier versions retain their own values', () => {
  let current = new BindingGraph().withPublicBinding('item', () => 0);
  const versions = [current];
  for (let i = 1; i <= 3000; i++) {
    const previous = current.publicBinding('item');
    current = current.withPublicBinding('item', () => i);
    expect(current.hasBinding(previous)).toBe(false);
    if (i % 100 === 0) versions.push(current);
  }
  for (let i = 0; i < versions.length; i++) {
    const version = versions[i]!;
    expect(version.registration(version.publicBinding('item')).create({} as never)).toBe(i * 100);
  }
});

test('replacement counts all public slots and contribution references to a binding', () => {
  const id = Symbol('shared'), key = Symbol('group');
  const original = new BindingGraph({ bindings: new Map([[id, binding(id, 1)]]), publicSlots: new Map([['a', id], ['b', id]]) });
  const one = original.withPublicBinding('a', () => 2);
  expect(one.hasBinding(id)).toBe(true);
  const two = one.withPublicBinding('b', () => 3);
  expect(two.hasBinding(id)).toBe(false);
  expect(original.publicBinding('a')).toBe(id);
  const contributed = new BindingGraph({ bindings: new Map([[id, binding(id, 1)]]), publicSlots: new Map([['a', id]]), contributions: new Map([[key, [id]]]) });
  const updated = contributed.withPublicBinding('a', () => 2);
  expect(updated.hasBinding(id)).toBe(true);
  expect(updated.contributionBindings(key)).toEqual([id]);
});

test('private aliases protect replaced IDs but public aliases follow current slots', async () => {
  const id = Symbol('target'), privateAlias = Symbol('privateAlias'), publicAlias = Symbol('publicAlias');
  const localNames = new Map<string, BindingRef>([['private', { kind: 'private', id }], ['public', { kind: 'public', key: 'target' }]]);
  const makeAlias = (alias: symbol, name: string): BindingDescription => ({ id: alias, label: name, registration: (deps: Record<string, number>) => deps[name], localNames });
  const original = new BindingGraph({ bindings: new Map([[id, binding(id, 1)], [privateAlias, makeAlias(privateAlias, 'private')], [publicAlias, makeAlias(publicAlias, 'public')]]), publicSlots: new Map([['target', id], ['private', privateAlias], ['public', publicAlias]]) });
  const updated = original.withPublicBinding('target', () => 2);
  expect(updated.hasBinding(id)).toBe(true);
  const runtime = new Runtime(updated);
  expect(runtime.resolve('private')).toBe(1);
  expect(runtime.resolve('public')).toBe(2);
  await runtime.close();
});

test('constructor keeps unused private registrations for explicit preflight and dangling refs for inspection', () => {
  const unused = Symbol('unused'), dangling = Symbol('dangling'), consumer = Symbol('consumer');
  const value = new BindingGraph({ bindings: new Map([[unused, binding(unused, 1)], [consumer, binding(consumer, 2, new Map([['missing', { kind: 'private', id: dangling }]]))]]), publicSlots: new Map() });
  expect(value.hasBinding(unused)).toBe(true);
  expect(value.dependency(consumer, 'missing')).toBe(dangling);
  expect(() => value.preflight({})).toThrow();
});

test('shared lexical input maps are snapshotted once per installation', () => {
  let visited = 0;
  class LexicalMap extends Map<string, BindingRef> {
    override *[Symbol.iterator](): MapIterator<[string, BindingRef]> {
      for (const entry of super[Symbol.iterator]()) { visited++; yield entry; }
    }
  }
  const names = new LexicalMap(Array.from({ length: 1000 }, (_, i) => [`name${i}`, { kind: 'private', id: Symbol() }]));
  const bindings = Array.from({ length: 1000 }, (_, i) => { const id = Symbol(); return [id, binding(id, i, names)] as const; });
  const value = new BindingGraph().withInstallation({ bindings: new Map(bindings), publicSlots: new Map() });
  expect(visited).toBe(1000);
  expect(value.hasBinding(bindings[999]![0])).toBe(true);
});

test('string collisions, special own keys and same-description symbols stay distinct across updates', () => {
  // These strings collide under FNV-1a; equality must still compare complete keys.
  const keys: (string | symbol)[] = ['__proto__', 'constructor', '', 'costarring', 'liquid', Symbol.for('registered'), Symbol.iterator];
  keys.push(...Array.from({ length: 3000 }, () => Symbol('same')));
  let value = new BindingGraph();
  for (let i = 0; i < keys.length; i++) value = value.withPublicBinding(keys[i]!, () => i);
  const previous = value;
  value = value.withPublicBinding('costarring', () => -1);
  for (let i = 0; i < keys.length; i++) expect(previous.registration(previous.publicBinding(keys[i]!)).create({} as never)).toBe(i);
  expect(value.registration(value.publicBinding('costarring')).create({} as never)).toBe(-1);
  expect(value.registration(value.publicBinding('liquid')).create({} as never)).toBe(4);
  expect(value.hasPublic(Symbol('same'))).toBe(false);
});

test('materialized contributions retain order through append and installation without changing old arrays', () => {
  const key = Symbol('group');
  let value = new BindingGraph();
  const snapshots: (readonly symbol[])[] = [];
  for (let i = 0; i < 1000; i++) {
    value = value.withContribution(key, () => i);
    if (i % 100 === 0) snapshots.push(value.contributionBindings(key));
  }
  const id = Symbol('installed');
  const installed = value.withInstallation({ bindings: new Map([[id, binding(id, 1000)]]), publicSlots: new Map(), contributions: new Map([[key, [id]]]) });
  expect(installed.contributionBindings(key).map(id => installed.registration(id).create({} as never))).toEqual(Array.from({ length: 1001 }, (_, i) => i));
  expect(value.contributionBindings(key)).toHaveLength(1000);
  snapshots.forEach((ids, index) => { expect(ids.length).toBe(index * 100 + 1); expect(Object.isFrozen(ids)).toBe(true); });
});

test('root lifetime stays parent-owned after a child overrides one shared public slot', async () => {
  const id = Symbol('root'); let creates = 0;
  const original = new BindingGraph({ bindings: new Map([[id, { ...binding(id, 1), registration: DiBag.withLifetime(() => ++creates, 'root') }]]), publicSlots: new Map([['a', id], ['b', id]]) });
  const parent = new Runtime(original);
  const child = parent.scope(original.withPublicBinding('a', () => 9));
  expect(child.resolve('b')).toBe(1);
  expect(parent.resolve('a')).toBe(1);
  expect(child.resolve('a')).toBe(9);
  expect(creates).toBe(1);
  await parent.close();
});

test('former public targets are pruned when the last user of a shared lexical snapshot is replaced', () => {
  const target = Symbol('target'), a = Symbol('a'), b = Symbol('b');
  const names = new Map<string, BindingRef>([['target', { kind: 'private', id: target }]]);
  const original = new BindingGraph({ bindings: new Map([[target, binding(target, 1)], [a, binding(a, 2, names)], [b, binding(b, 3, names)]]), publicSlots: new Map([['target', target], ['a', a], ['b', b]]) });
  const updated = original.withPublicBinding('target', () => 4).withPublicBinding('a', () => 5);
  expect(updated.hasBinding(target)).toBe(true);
  const final = updated.withPublicBinding('b', () => 6);
  expect(final.hasBinding(target)).toBe(false);
  expect(original.hasBinding(target)).toBe(true);
  expect(updated.dependency(b, 'target')).toBe(target);
});

test('pruning cascades iteratively through displaced lexical targets', () => {
  const ids = Array.from({ length: 3000 }, () => Symbol('link'));
  let value = new BindingGraph({ bindings: new Map(ids.map((id, i) => [id, binding(id, i, i ? new Map([['previous', { kind: 'private', id: ids[i - 1]! }]]) : new Map())])), publicSlots: new Map(ids.map((id, i) => [`p${i}`, id])) });
  for (let i = 0; i < ids.length - 1; i++) value = value.withPublicBinding(`p${i}`, () => -1);
  expect(value.hasBinding(ids[0]!)).toBe(true);
  value = value.withPublicBinding(`p${ids.length - 1}`, () => -1);
  for (const id of ids) expect(value.hasBinding(id)).toBe(false);
});
