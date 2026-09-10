import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';
import * as source from '../src/di-bag';
import { BindingGraph } from '../src/runtime';
import { runInNewContext } from 'node:vm';
import { normalize } from '../src/registration';

test('fork changes only the selected key hidden behind a narrowed override map', () => {
  const root = DiBag.createBuilder().register({ a: () => 1, b: () => 2 }).build();
  const actual = { a: () => 3, b: () => 'wrong' };
  const narrowed: { a: () => number } = actual;
  const child = root.fork(['a'], narrowed);
  const b: number = child.resolve('b');
  expect(b).toBe(2);
  expect(child.resolve('a')).toBe(3);
  expect(root.resolve('a')).toBe(1);
});

test('unselected override values and getters never participate', () => {
  const root = DiBag.createBuilder().register({ a: () => 1, b: () => 2 }).build();
  const child = root.fork(['a'], {
    a: () => 3,
    b: 'not a factory',
    get unused(): never { throw new Error('unselected getter invoked'); },
  });
  expect(child.resolve('a')).toBe(3);
  expect(child.resolve('b')).toBe(2);
});

test('hidden duplicate additions throw atomically and leave builders reusable', () => {
  const builder = DiBag.createBuilder().register({ b: () => 2 });
  const actual = { a: () => 3, b: () => 'wrong' };
  const narrowed: { a: () => number } = actual;
  expect(() => builder.register(narrowed)).toThrow(/duplicate.*b/);
  expect(builder.build().resolve('b')).toBe(2);
  expect(builder.register({ a: () => 4 }).build().resolve('a')).toBe(4);
});

test('hidden new keys cannot later silently replace visible registrations', () => {
  const actual = { a: () => 1, hidden: () => 'hidden' };
  const narrowed: { a: () => number } = actual;
  const builder = DiBag.createBuilder().register(narrowed);
  expect(() => builder.register({ hidden: () => 2 })).toThrow(/duplicate.*hidden/);
  expect(builder.build().resolve('a')).toBe(1);
});

test('add snapshots every own entry and validates before producing a builder', () => {
  const builder = DiBag.createBuilder().register({ a: () => 1 });
  const hiddenDuplicate = Object.defineProperty({ b: () => 2 }, 'a', { value: () => 3 });
  expect(() => builder.register(hiddenDuplicate)).toThrow(/duplicate.*a/);
  const invalid = { b: () => 2, hidden: 42 };
  const narrowed: { b: () => number } = invalid;
  expect(() => builder.register(narrowed)).toThrow(/invalid.*registration/);
  expect(builder.register({ b: () => 3 }).build().resolve('b')).toBe(3);
  let reads = 0;
  const snapshot = builder.register({ get b() { reads++; return () => reads; } });
  expect(reads).toBe(1);
  expect(snapshot.build().resolve('b')).toBe(1);
});

test('replacement writes its explicit key and preserves earlier builders', () => {
  const builder = DiBag.createBuilder().register({ a: () => 1, b: () => 2 });
  const changed = builder.replace('a', () => 'new').build();
  expect(changed.resolve('a')).toBe('new');
  expect(changed.resolve('b')).toBe(2);
  expect(builder.build().resolve('a')).toBe(1);
  expect(() => Reflect.apply(builder.replace, builder, ['missing', () => 3])).toThrow(/existing.*missing/);
});

test('fork requires selected own entries before reading any selected getter', () => {
  const root = DiBag.createBuilder().register({ a: () => 1, b: () => 2 }).build();
  let reads = 0;
  const overrides = { get a() { reads++; return () => 3; } };
  expect(() => Reflect.apply(root.fork, root, [['a', 'b'], overrides])).toThrow(/missing override.*b/);
  expect(reads).toBe(0);
  expect(() => Reflect.apply(root.fork, root, [['b'], Object.create({ b: () => 4 })])).toThrow(/missing override.*b/);
  expect(() => Reflect.apply(root.fork, root, [['unknown'], { unknown: () => 4 }])).toThrow(/existing.*unknown/);
  expect(root.resolve('b')).toBe(2);
});

test('fork snapshots selection before an override getter mutates the caller tuple', () => {
  const root = DiBag.createBuilder().register({ a: () => 1, b: () => 2 }).build();
  const keys: ['a', 'b'] = ['a', 'b'];
  const child = root.fork(keys, {
    get a() { keys.splice(1); return () => 3; },
    b: () => 4 as const,
  });
  const b: 4 = child.resolve('b');
  expect(b).toBe(4);
});

test('fork selects indexed tuple entries even when its iterator omits a key', () => {
  const root = DiBag.createBuilder().register({ a: () => 1, b: () => 2 }).build();
  const keys: ['a', 'b'] = ['a', 'b'];
  keys[Symbol.iterator] = function* () {
    yield keys[0];
    return undefined;
  };
  const child = root.fork(keys, { a: () => 3, b: () => 4 as const });
  const b: 4 = child.resolve('b');
  expect(b).toBe(4);
});

test('fork batches selected replacements without using the single-binding graph path', () => {
  const root = DiBag.createBuilder().register({ a: () => 1, b: () => 2 }).build();
  const original = BindingGraph.prototype.withPublicBinding;
  const originalBatch = BindingGraph.prototype.withPublicBindings;
  let singleReplacements = 0;
  let batchReplacements = 0;
  BindingGraph.prototype.withPublicBinding = function (key, registration) {
    singleReplacements++;
    return original.call(this, key, registration);
  };
  BindingGraph.prototype.withPublicBindings = function (entries) {
    batchReplacements++;
    return originalBatch.call(this, entries);
  };
  try {
    const child = root.fork(['a', 'b'], { a: () => 3, b: () => 4 as const });
    expect(child.resolve('a')).toBe(3);
    expect(child.resolve('b')).toBe(4);
    expect(singleReplacements).toBe(0);
    expect(batchReplacements).toBe(1);
  } finally {
    BindingGraph.prototype.withPublicBinding = original;
    BindingGraph.prototype.withPublicBindings = originalBatch;
  }
});

test('empty forks reuse the graph without reading unselected values and retain fresh ownership', async () => {
  let next = 0;
  const disposed: number[] = [];
  const root = DiBag.createBuilder().register({
    value: DiBag.withDisposal(() => ++next, value => { disposed.push(value); }),
  }).build();
  const keys: [] = [];
  keys[Symbol.iterator] = function* () { throw new Error('iterator invoked'); };
  const overrides = new Proxy({}, { get() { throw new Error('override read'); } });
  const originalBatch = BindingGraph.prototype.withPublicBindings;
  let batchReplacements = 0;
  BindingGraph.prototype.withPublicBindings = function (entries) {
    batchReplacements++;
    return originalBatch.call(this, entries);
  };
  try {
    const child = root.fork(keys, overrides);
    expect(batchReplacements).toBe(0);
    expect(root.resolve('value')).toBe(1);
    expect(child.resolve('value')).toBe(2);
    expect(() => Reflect.apply(root.fork, root, [[], null])).toThrow('override object');
    expect(() => Reflect.apply(root.fork, root, [[], undefined])).toThrow('override object');
    await Promise.all([root.close(), child.close()]);
    expect(disposed.sort()).toEqual([1, 2]);
  } finally {
    BindingGraph.prototype.withPublicBindings = originalBatch;
  }
});

test('selected overrides can depend on richer capabilities of other selected services', () => {
  const root = DiBag.createBuilder().register({
    clock: () => ({ now: () => 42 }),
    service: ({ clock }: { clock: { now(): number } }) => ({ stamp: () => clock.now() }),
  }).build();
  const child = root.fork(['clock', 'service'], {
    clock: () => ({ now() { return 7; }, zone() { return 'utc' as const; } }),
    service: ({ clock }: { clock: { now(): number; zone(): 'utc' } }) => ({
      stamp() { return clock.now(); },
      zone() { return clock.zone(); },
    }),
  });
  expect(child.resolve('service').stamp()).toBe(7);
  expect(child.resolve('service').zone()).toBe('utc');
  expect(root.resolve('service').stamp()).toBe(42);
});

test('runtime registration validation rejects cloned and forged owned handles', () => {
  const owned = DiBag.withDisposal(() => 1, value => { value.toFixed(); });
  expect(Object.isFrozen(owned)).toBe(true);
  const builder = DiBag.createBuilder();
  for (const value of [{ ...owned }, { ...owned, create: () => 'wrong' }, Object.create(owned)]) {
    expect(() => Reflect.apply(builder.register, builder, [{ value }])).toThrow(/invalid.*registration/);
  }
  expect(builder.register({ value: owned }).build().resolve('value')).toBe(1);
});

test('normalization does not expose mutable ownership registry metadata', async () => {
  let disposed: number | undefined;
  const owned = DiBag.withDisposal(() => 1, value => { disposed = value; });
  normalize(owned).create = () => 'wrong';
  const bag = DiBag.createBuilder().register({ value: owned }).build();
  expect(bag.resolve('value')).toBe(1);
  await bag.close();
  expect(disposed).toBe(1);
});

test('unchecked source Bag construction is not exported', () => {
  expect(Object.hasOwn(source, 'Bag')).toBe(false);
});

test('plain registration maps from another realm retain their own factories', () => {
  const builder = DiBag.createBuilder();
  const foreign = runInNewContext('({ value: () => 42 })');
  const bag = Reflect.apply(builder.register, builder, [foreign]).build();
  expect(bag.resolve('value')).toBe(42);
});
