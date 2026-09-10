import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';

test('contributions preserve order, empty reads and array immutability', async () => {
  const key = Symbol('number');
  const numbers = DiBag.token(key).of<number>();
  const empty = DiBag.createBuilder().build();
  expect(empty.resolveAll(numbers)).toEqual([]);
  const bag = DiBag.createBuilder().contribute(numbers, () => 1).contribute(numbers, () => 2).build();
  const first = bag.resolveAll(numbers);
  expect(first).toEqual([1, 2]);
  expect(Object.isFrozen(first)).toBe(true);
  expect(bag.resolveAll(numbers)).not.toBe(first);
  await bag.close();
  await empty.close();
});

// These controls catch accidental singular/group merging and deduplication.
test('host and repeated exportless modules append distinct lexical bindings', async () => {
  const key = Symbol('items'); const items = DiBag.token(key).of<{ id: number; label: string }>();
  let ids = 0; const disposed: number[] = [];
  const sharedHandle = DiBag.withDisposal(({ helper }: { helper: number }) => ({ id: helper, label: 'module' }), value => { disposed.push(value.id); });
  const feature = DiBag.createBuilder().register({ helper: () => ++ids }).contribute(items, sharedHandle).contribute(items, sharedHandle).buildModule([]);
  const base = DiBag.createBuilder().contribute(items, () => ({ id: 0, label: 'host' }));
  const bag = base.installModule(feature).installModule(feature).register(items, () => ({ id: 99, label: 'singular' })).build();
  expect(bag.resolveAll(items).map(value => value.id)).toEqual([0, 1, 1, 2, 2]);
  expect(bag.resolve(items).id).toBe(99);
  const baseBag = base.build();
  expect(baseBag.resolveAll(items)).toEqual([{ id: 0, label: 'host' }]);
  await baseBag.close();
  expect(new Set(bag.inspectAll(items).map(value => value.bindingId)).size).toBe(5);
  await bag.close();
  expect(disposed.sort()).toEqual([1, 1, 2, 2]);
});

test('all adapters select frozen arrays and retain module export renames', async () => {
  const key = Symbol('numbers'); const numbers = DiBag.token(key).of<number>();
  class Total { constructor(readonly values: readonly number[]) {} }
  const feature = DiBag.createBuilder().register({ helper: () => 7 }).contribute(numbers, ({ helper }: { helper: number }) => helper).buildModule(['helper']).renameExport('helper', 'renamed');
  const ref = DiBag.all(numbers);
  const bag = DiBag.createBuilder().installModule(feature).register({
    tokens: DiBag.fromFunction([ref], values => values),
    fn: DiBag.fromFunction([ref], values => values.reduce((a, b) => a + b, 0)),
    cls: DiBag.fromClass([ref], Total),
  }).build();
  expect(Object.isFrozen(ref)).toBe(true);
  expect(bag.resolve('tokens')).toEqual([7]);
  expect(Object.isFrozen(bag.resolve('tokens'))).toBe(true);
  expect(bag.resolve('fn')).toBe(7);
  expect(bag.resolve('cls')).toBeInstanceOf(Total);
  expect(bag.resolve('cls').values).toEqual([7]);
  const fork = bag.fork(['renamed'], { renamed: () => 9 });
  expect(fork.resolveAll(numbers)).toEqual([9]);
  await fork.close(); await bag.close();
});

test('root scoped and transient contributions retain individual ownership', async () => {
  const key = Symbol('objects'); const objects = DiBag.token(key).of<{ id: number }>();
  let ids = 0; const disposed: number[] = [];
  const create = DiBag.withDisposal(() => ({ id: ++ids }), value => { disposed.push(value.id); });
  const bag = DiBag.createBuilder().contribute(objects, DiBag.withLifetime(create, 'root')).contribute(objects, create).contribute(objects, DiBag.withLifetime(create, 'transient')).build();
  const first = bag.resolveAll(objects); const again = bag.resolveAll(objects);
  expect(first[0]).toBe(again[0]); expect(first[1]).toBe(again[1]); expect(first[2]).not.toBe(again[2]);
  const child = bag.createScope(); const scoped = child.resolveAll(objects);
  expect(scoped[0]).toBe(first[0]); expect(scoped[1]).not.toBe(first[1]);
  const fork = bag.fork(); expect(fork.resolveAll(objects)[0]).not.toBe(first[0]);
  await child.close(); expect(disposed).not.toContain(first[0]!.id);
  await fork.close(); await bag.close();
  expect(disposed.length).toBe(ids); expect(new Set(disposed).size).toBe(ids);
});

test('shared aggregate borrows the parent graph while a lazy registry reads its local graph', async () => {
  const key = Symbol('numbers'); const numbers = DiBag.token(key).of<number>();
  const registryKey = Symbol('registry'); const registry = DiBag.token(registryKey).of<readonly number[]>();
  const bag = DiBag.createBuilder().register({ helper: () => 1 }).contribute(numbers, ({ helper }: { helper: number }) => helper).register(registry, DiBag.fromFunction([DiBag.all(numbers)], values => values)).register({ lazy: DiBag.fromFunction([DiBag.lazy(registry)], get => get) }).build();
  const child = bag.createScope(['helper'], { helper: () => 2 }, { share: [registry] });
  expect(child.resolve(registry)).toBe(bag.resolve(registry));
  expect(child.resolveAll(numbers)).toEqual([2]); expect(child.resolve('lazy')()).toEqual([1]);
  const fork = child.fork(); expect(fork.resolve('lazy')()).toEqual([2]);
  await child.close(); await fork.close(); await bag.close();
});

test('partial failure retains accepted ownership and retries only failed contributors', async () => {
  const key = Symbol('number'); const numbers = DiBag.token(key).of<number>();
  let first = 0; let second = 0; const disposed: number[] = []; const failure = new Error('second');
  const bag = DiBag.createBuilder().contribute(numbers, DiBag.withDisposal(() => ++first, value => { disposed.push(value); })).contribute(numbers, () => { if (++second === 1) throw failure; return 2; }).build();
  expect(() => bag.resolveAll(numbers)).toThrow(failure); expect(disposed).toEqual([]);
  expect(bag.resolveAll(numbers)).toEqual([1, 2]); expect(first).toBe(1); expect(second).toBe(2);
  await bag.close(); await bag.close(); expect(disposed).toEqual([1]);
});

test('pending native and raw promises preserve identity and disposal payloads', async () => {
  const key = Symbol('promises'); const promises = DiBag.token(key).of<Promise<number>>();
  let release!: (value: number) => void; const pending = new Promise<number>(resolve => { release = resolve; });
  const seen: unknown[] = [];
  const native = DiBag.withDisposal(DiBag.fromFactory(() => pending, { acquisitionMode: 'nativePromise' }), value => { seen.push(value); });
  const raw = DiBag.withDisposal(DiBag.fromFactory(() => pending, { acquisitionMode: 'raw' }), value => { seen.push(value); });
  const bag = DiBag.createBuilder().contribute(promises, native).contribute(promises, raw).build();
  const values = bag.resolveAll(promises); expect(values[0]).toBe(pending); expect(values[1]).toBe(pending);
  const closing = bag.close(); let closed = false; void closing.then(() => { closed = true; });
  await Promise.resolve(); expect(closed).toBe(false); release(5); await closing;
  expect(seen).toContain(5); expect(seen).toContain(pending); expect(seen.length).toBe(2);
});

test('self collections participate in ordinary cycle detection', async () => {
  const key = Symbol('cycle'); const values = DiBag.token(key).of<number>();
  const bag = DiBag.createBuilder().contribute(values, DiBag.fromFunction([DiBag.all(values)], items => items.length)).build();
  expect(() => bag.resolveAll(values)).toThrow(/cycle/); await bag.close();
});

test('inspection is immutable nonresolving and does not freeze application values', async () => {
  const key = Symbol('items'); const items = DiBag.token(key).of<{ value: number }>();
  let calls = 0; const service = { value: 1 };
  const bag = DiBag.createBuilder().contribute(items, DiBag.withMetadata(() => { calls++; return service; }, { static: { label: 'a' } })).build();
  const before = bag.inspectAll(items); expect(calls).toBe(0);
  expect(Object.isFrozen(before)).toBe(true); expect(Object.isFrozen(before[0])).toBe(true);
  expect(before[0]!.acquisitions).toEqual([]); expect(before[0]!.registrationMetadata).toEqual({ label: 'a' });
  bag.resolveAll(items); const after = bag.inspectAll(items);
  expect(after[0]!.acquisitions.length).toBe(1); expect(before[0]!.acquisitions).toEqual([]);
  service.value = 2; expect(bag.resolveAll(items)[0]!.value).toBe(2); await bag.close();
});

test('forged tokens references and providers reject before provider effects', async () => {
  const key = Symbol('real'); const token = DiBag.token(key).of<number>(); let effects = 0;
  for (const fake of [key, {}, Object.create(token), { ...token }, DiBag.optional(token), DiBag.all(token)]) {
    expect(() => (DiBag.createBuilder().contribute as Function)(fake, () => { effects++; return 1; })).toThrow();
    expect(() => (DiBag.all as Function)(fake)).toThrow();
  }
  const provider = DiBag.fromFunction([], () => { effects++; return 1; });
  expect(() => (DiBag.createBuilder().contribute as Function)(token, { ...provider })).toThrow();
  expect(() => (DiBag.createBuilder().contribute as Function)(token, {})).toThrow();
  const refs = [DiBag.all(token)]; refs[Symbol.iterator] = function* () { throw new Error('iterator'); };
  const bag = DiBag.createBuilder().contribute(token, () => 1).register({ list: DiBag.fromFunction(refs as [typeof refs[0]], values => values) }).build();
  expect(bag.resolve('list')).toEqual([1]); expect(effects).toBe(0); await bag.close();
  expect(() => bag.resolveAll(token)).toThrow(/closed|closing/);
});

test('cooperative lazy registries admit late collection reads only for their in-flight source', async () => {
  const key = Symbol('items'); const items = DiBag.token(key).of<number>();
  const registryKey = Symbol('registry'); const registry = DiBag.token(registryKey).of<readonly number[]>();
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  const disposed: string[] = []; let read!: () => readonly number[];
  const bag = DiBag.createBuilder().contribute(items, DiBag.withDisposal(() => 7, () => { disposed.push('item'); })).register(registry, DiBag.fromFunction([DiBag.all(items)], values => values)).register({ source: DiBag.withDisposal(DiBag.fromFunction([DiBag.lazy(registry)], async get => {
      read = get; await gate; return get();
    }), () => { disposed.push('source'); }), ready: DiBag.fromFunction([DiBag.lazy(registry)], get => get) }).build();
  const pending = bag.resolve('source'); const ready = bag.resolve('ready'); const closing = bag.close();
  expect(ready).toThrow(/closing/); expect(read()).toEqual([7]);
  release(); expect(await pending).toEqual([7]); await closing;
  expect(disposed).toEqual(['source', 'item']); expect(read).toThrow(/closed/);
});

test('observed strict roots reject cached scoped contributions before owner routing', async () => {
  const key = Symbol('items'); const items = DiBag.token(key).of<number>();
  const root = DiBag.withLifetime(DiBag.fromFunction([DiBag.all(items)], values => values), 'root');
  // An unchecked caller must still meet the observed lifetime boundary.
  const builder = DiBag.createBuilder().contribute(items, () => 1).register({ root });
  const bag = (builder.build as Function).call(builder);
  expect(bag.resolveAll(items)).toEqual([1]);
  expect(() => bag.resolve('root')).toThrow(/root lifetime cannot capture scoped/);
  const child = bag.createScope(); expect(() => child.resolve('root')).toThrow(/root lifetime cannot capture scoped/);
  await bag.close();
});

test('startup failure rolls back accepted contribution ownership', async () => {
  const key = Symbol('items'); const items = DiBag.token(key).of<number>(); const disposed: number[] = [];
  const builder = DiBag.createBuilder().contribute(items, DiBag.withDisposal(() => 1, value => { disposed.push(value); })).contribute(items, () => { throw new Error('failed contribution'); }).register({ aggregate: DiBag.fromFunction([DiBag.all(items)], values => values) });
  await expect(builder.buildAndStart(['aggregate'])).rejects.toThrow(); expect(disposed).toEqual([1]);
});
