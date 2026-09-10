import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';
import { deferred } from './helpers';

test('selected sharing keeps parent dependencies while child overrides stay local', async () => {
  const released: string[] = [];
  const root = DiBag.createBuilder().register({
    config: () => ({ id: 'parent' }),
    service: DiBag.withDisposal(({ config }: { config: { id: string } }) => ({ config }), () => { released.push('parent'); }),
  }).build();
  const child = root.createScope(['config'], { config: () => ({ id: 'child', extra: true }) }, { share: ['service'] });
  expect(child.resolve('config')).toEqual({ id: 'child', extra: true });
  expect(child.resolve('service').config.id).toBe('parent');
  expect(child.resolve('service')).toBe(root.resolve('service'));
  expect(child.inspect('service').acquisitions).toEqual(root.inspect('service').acquisitions);
  await child.close();
  expect(released).toEqual([]);
  await root.close();
  expect(released).toEqual(['parent']);
});

test('mixed token selections retain exact borrowed pending values and override bindings', async () => {
  const key = Symbol('value');
  const token = DiBag.token(key).of<{ id: number }>();
  const gate = deferred<number>();
  const root = DiBag.createBuilder().register(token, () => ({ id: 1 })).register({ pending: () => gate.promise }).build();
  const child = root.createScope([token], { [key]: () => ({ id: 2, added: true }) }, { share: ['pending'] });
  expect(child.resolve(token)).toEqual({ id: 2, added: true });
  expect(child.resolve('pending')).toBe(gate.promise);
  expect(root.resolve('pending')).toBe(gate.promise);
  gate.resolve(3);
  await root.close();
});

test('scope snapshots selections and ignores unselected override getters and tuple iterators', async () => {
  const root = DiBag.createBuilder().register({ a: () => 1, b: () => 2, c: () => 3 }).build();
  const keys: ['a'] = ['a'];
  const shared: ['b'] = ['b'];
  keys[Symbol.iterator] = function* () { throw new Error('override iterator'); };
  shared[Symbol.iterator] = function* () { throw new Error('share iterator'); };
  let reads = 0;
  const overrides = {
    get a() { reads++; keys[0] = 'c' as 'a'; shared[0] = 'c' as 'b'; return () => 10; },
    get c(): () => number { throw new Error('unselected'); },
  };
  const child = root.createScope(keys, overrides, { share: shared });
  expect(reads).toBe(1);
  expect(child.resolve('a')).toBe(10);
  expect(child.resolve('b')).toBe(2);
  expect(child.resolve('c')).toBe(3);
  expect(child.inspect('b').acquisitions).toEqual(root.inspect('b').acquisitions);
  await root.close();
});

test('invalid selections reject before override values or provider effects', async () => {
  let calls = 0;
  const root = DiBag.createBuilder().register({ a: () => { calls++; return 1; }, transient: DiBag.withLifetime(() => 2, 'transient') }).build();
  const scope = root.createScope.bind(root) as (...args: unknown[]) => unknown;
  const overrides = { get a() { calls++; return () => 10; } };
  for (const args of [
    [undefined], [null], [{}], [{ share: [] }, {}],
    [{ share: ['missing'] }], [{ share: ['transient'] }],
    [{ share: [], other: true }], [Object.create({ share: [] })],
    [['a'], overrides, { share: ['a'] }],
    [['a', 'missing'], overrides], [['a'], {}],
    [['a'], overrides, { share: [Symbol('forged')] }],
    [['a'], overrides, { share: [], unexpected: true }],
    [['a'], overrides, { share: ['transient'] }],
    [['a'], overrides, undefined, 'extra'],
  ]) expect(() => scope(...args)).toThrow();
  expect(calls).toBe(0);
  await root.close();
});

test('empty selections are lazy and duplicates read each override once', async () => {
  let calls = 0;
  const root = DiBag.createBuilder().register({ a: () => ({ id: ++calls }) }).build();
  const empty = root.createScope([], { get a(): () => { id: number } { throw new Error('unselected'); } }, { share: [] });
  const sharing = root.createScope({ share: ['a', 'a'] });
  expect(calls).toBe(0);
  expect(sharing.resolve('a')).toBe(root.resolve('a'));
  expect(empty.resolve('a')).not.toBe(root.resolve('a'));
  let reads = 0;
  const overridden = root.createScope(['a', 'a'], { get a() { reads++; return () => ({ id: 9 }); } });
  expect(overridden.resolve('a').id).toBe(9);
  expect(reads).toBe(1);
  await root.close();
});

test('inherited strict roots keep their graph when a child overrides a dependency as scoped', async () => {
  const root = DiBag.createBuilder().register({
    config: DiBag.withLifetime(() => ({ id: 'parent' }), 'root'),
    service: DiBag.withLifetime(({ config }: { config: { id: string } }) => ({ config }), 'root'),
  }).build();
  const child = root.createScope(['config'], { config: () => ({ id: 'child' }) });
  expect(child.resolve('config').id).toBe('child');
  expect(child.resolve('service').config.id).toBe('parent');
  expect(child.resolve('service')).toBe(root.resolve('service'));
  await root.close();
});
