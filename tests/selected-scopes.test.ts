import { expect, test } from 'bun:test';
import { DiBag } from '../src';
import { deferred } from './helpers';

test('selected sharing keeps parent dependencies while child overrides stay local', async () => {
  const released: string[] = [];
  const root = DiBag.createBuilder().withServices({
    config: () => ({ id: 'parent' }),
    service: DiBag.providerWithDisposal({ provider: ({ config }: { config: { id: string } }) => ({ config }), disposeService: () => { released.push('parent'); } }),
  }).buildContainer();
  const child = root.createChildContainer(['config'], { config: () => ({ id: 'child', extra: true }) }, { sharedParentServiceKeys: ['service'] });
  expect(child.resolve('config')).toEqual({ id: 'child', extra: true });
  expect(child.resolve('service').config.id).toBe('parent');
  expect(child.resolve('service')).toBe(root.resolve('service'));
  expect(child.serviceSnapshot('service').acquisitions).toEqual(root.serviceSnapshot('service').acquisitions);
  await child.close();
  expect(released).toEqual([]);
  await root.close();
  expect(released).toEqual(['parent']);
});

test('mixed token selections retain exact borrowed pending values and override bindings', async () => {
  const key = Symbol('value');
  const token = DiBag.createToken(key).forService<{ id: number }>();
  const gate = deferred<number>();
  const root = DiBag.createBuilder().withTokenService(token, () => ({ id: 1 })).withServices({ pending: () => gate.promise }).buildContainer();
  const child = root.createChildContainer([token], { [key]: () => ({ id: 2, added: true }) }, { sharedParentServiceKeys: ['pending'] });
  expect(child.resolve(token)).toEqual({ id: 2, added: true });
  expect(child.resolve('pending')).toBe(gate.promise);
  expect(root.resolve('pending')).toBe(gate.promise);
  gate.resolve(3);
  await root.close();
});

test('scope snapshots selections and ignores unselected override getters and tuple iterators', async () => {
  const root = DiBag.createBuilder().withServices({ a: () => 1, b: () => 2, c: () => 3 }).buildContainer();
  const keys: ['a'] = ['a'];
  const shared: ['b'] = ['b'];
  keys[Symbol.iterator] = function* () { throw new Error('override iterator'); };
  shared[Symbol.iterator] = function* () { throw new Error('share iterator'); };
  let reads = 0;
  const overrides = {
    get a() { reads++; keys[0] = 'c' as 'a'; shared[0] = 'c' as 'b'; return () => 10; },
    get c(): () => number { throw new Error('unselected'); },
  };
  const child = root.createChildContainer(keys, overrides, { sharedParentServiceKeys: shared });
  expect(reads).toBe(1);
  expect(child.resolve('a')).toBe(10);
  expect(child.resolve('b')).toBe(2);
  expect(child.resolve('c')).toBe(3);
  expect(child.serviceSnapshot('b').acquisitions).toEqual(root.serviceSnapshot('b').acquisitions);
  await root.close();
});

test('invalid selections reject before override values or provider effects', async () => {
  let calls = 0;
  const root = DiBag.createBuilder().withServices({ a: () => { calls++; return 1; }, transient: DiBag.providerWithLifetime({ provider: () => 2, lifetime: 'transient:one-per-resolve' }) }).buildContainer();
  const scope = root.createChildContainer.bind(root) as (...args: unknown[]) => unknown;
  const overrides = { get a() { calls++; return () => 10; } };
  for (const args of [
    [null], [{ sharedParentServiceKeys: [] }, {}],
    [{ sharedParentServiceKeys: ['missing'] }], [{ sharedParentServiceKeys: ['transient'] }],
    [{ sharedParentServiceKeys: [], other: true }], [Object.create({ sharedParentServiceKeys: [] })],
    [['a'], overrides, { sharedParentServiceKeys: ['a'] }],
    [['a', 'missing'], overrides], [['a'], {}],
    [['a'], overrides, { sharedParentServiceKeys: [Symbol('forged')] }],
    [['a'], overrides, { sharedParentServiceKeys: [], unexpected: true }],
    [['a'], overrides, { sharedParentServiceKeys: ['transient'] }],
    [['a'], overrides, undefined, 'extra'],
  ]) expect(() => scope(...args)).toThrow();
  expect(calls).toBe(0);
  await root.close();
});

test('empty selections are lazy and duplicates read each override once', async () => {
  let calls = 0;
  const root = DiBag.createBuilder().withServices({ a: () => ({ id: ++calls }) }).buildContainer();
  const empty = root.createChildContainer([], { get a(): () => { id: number } { throw new Error('unselected'); } }, { sharedParentServiceKeys: [] });
  const sharing = root.createChildContainer({ sharedParentServiceKeys: ['a', 'a'] });
  expect(calls).toBe(0);
  expect(sharing.resolve('a')).toBe(root.resolve('a'));
  expect(empty.resolve('a')).not.toBe(root.resolve('a'));
  let reads = 0;
  const overridden = root.createChildContainer(['a', 'a'], { get a() { reads++; return () => ({ id: 9 }); } });
  expect(overridden.resolve('a').id).toBe(9);
  expect(reads).toBe(1);
  await root.close();
});

test('inherited singleton roots stay shared by a child; independent replacement rebuilds their graph', async () => {
  const root = DiBag.createBuilder().withServices({
    config: DiBag.providerWithLifetime({ provider: () => ({ id: 'parent' }), lifetime: 'singleton:one-per-container-tree' }),
    service: DiBag.providerWithLifetime({ provider: ({ config }: { config: { id: string } }) => ({ config }), lifetime: 'singleton:one-per-container-tree' }),
  }).buildContainer();
  const child = root.createChildContainer();
  expect(child.resolve('config').id).toBe('parent');
  expect(child.resolve('service').config.id).toBe('parent');
  expect(child.resolve('service')).toBe(root.resolve('service'));
  const independent = root.createIndependentContainer(['config'], { config: DiBag.providerWithLifetime({ provider: () => ({ id: 'child' }), lifetime: 'singleton:one-per-container-tree' }) });
  expect(independent.resolve('service').config.id).toBe('child');
  await independent.close();
  await root.close();
});
