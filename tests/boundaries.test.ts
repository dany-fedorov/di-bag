import { expect, test } from 'bun:test';
import { DiBag } from '../src';
import * as source from '../src/di-bag';
import { runInNewContext } from 'node:vm';
import { normalize } from '../src/registration';

test('fork changes only the selected key hidden behind a narrowed override map', () => {
  const root = DiBag.begin().add({ a: () => 1, b: () => 2 }).end();
  const actual = { a: () => 3, b: () => 'wrong' };
  const narrowed: { a: () => number } = actual;
  const child = root.fork(['a'], narrowed);
  const b: number = child.resolve('b');
  expect(b).toBe(2);
  expect(child.resolve('a')).toBe(3);
  expect(root.resolve('a')).toBe(1);
});

test('unselected override values and getters never participate', () => {
  const root = DiBag.begin().add({ a: () => 1, b: () => 2 }).end();
  const child = root.fork(['a'], {
    a: () => 3,
    b: 'not a factory',
    get unused(): never { throw new Error('unselected getter invoked'); },
  });
  expect(child.resolve('a')).toBe(3);
  expect(child.resolve('b')).toBe(2);
});

test('hidden duplicate additions throw atomically and leave builders reusable', () => {
  const builder = DiBag.begin().add({ b: () => 2 });
  const actual = { a: () => 3, b: () => 'wrong' };
  const narrowed: { a: () => number } = actual;
  expect(() => builder.add(narrowed)).toThrow(/duplicate.*b/);
  expect(builder.end().resolve('b')).toBe(2);
  expect(builder.add({ a: () => 4 }).end().resolve('a')).toBe(4);
});

test('hidden new keys cannot later silently replace visible registrations', () => {
  const actual = { a: () => 1, hidden: () => 'hidden' };
  const narrowed: { a: () => number } = actual;
  const builder = DiBag.begin().add(narrowed);
  expect(() => builder.add({ hidden: () => 2 })).toThrow(/duplicate.*hidden/);
  expect(builder.end().resolve('a')).toBe(1);
});

test('add snapshots every own entry and validates before producing a builder', () => {
  const builder = DiBag.begin().add({ a: () => 1 });
  const hiddenDuplicate = Object.defineProperty({ b: () => 2 }, 'a', { value: () => 3 });
  expect(() => builder.add(hiddenDuplicate)).toThrow(/duplicate.*a/);
  const invalid = { b: () => 2, hidden: 42 };
  const narrowed: { b: () => number } = invalid;
  expect(() => builder.add(narrowed)).toThrow(/invalid.*registration/);
  expect(builder.add({ b: () => 3 }).end().resolve('b')).toBe(3);
  let reads = 0;
  const snapshot = builder.add({ get b() { reads++; return () => reads; } });
  expect(reads).toBe(1);
  expect(snapshot.end().resolve('b')).toBe(1);
});

test('replacement writes its explicit key and preserves earlier builders', () => {
  const builder = DiBag.begin().add({ a: () => 1, b: () => 2 });
  const changed = builder.replace('a', () => 'new').end();
  expect(changed.resolve('a')).toBe('new');
  expect(changed.resolve('b')).toBe(2);
  expect(builder.end().resolve('a')).toBe(1);
  expect(() => Reflect.apply(builder.replace, builder, ['missing', () => 3])).toThrow(/existing.*missing/);
});

test('fork requires selected own entries before reading any selected getter', () => {
  const root = DiBag.begin().add({ a: () => 1, b: () => 2 }).end();
  let reads = 0;
  const overrides = { get a() { reads++; return () => 3; } };
  expect(() => Reflect.apply(root.fork, root, [['a', 'b'], overrides])).toThrow(/missing override.*b/);
  expect(reads).toBe(0);
  expect(() => Reflect.apply(root.fork, root, [['b'], Object.create({ b: () => 4 })])).toThrow(/missing override.*b/);
  expect(() => Reflect.apply(root.fork, root, [['unknown'], { unknown: () => 4 }])).toThrow(/existing.*unknown/);
  expect(root.resolve('b')).toBe(2);
});

test('fork snapshots selection before an override getter mutates the caller tuple', () => {
  const root = DiBag.begin().add({ a: () => 1, b: () => 2 }).end();
  const keys: ['a', 'b'] = ['a', 'b'];
  const child = root.fork(keys, {
    get a() { keys.splice(1); return () => 3; },
    b: () => 4 as const,
  });
  const b: 4 = child.resolve('b');
  expect(b).toBe(4);
});

test('runtime registration validation rejects cloned and forged owned handles', () => {
  const owned = DiBag.withDisposal(() => 1, value => { value.toFixed(); });
  expect(Object.isFrozen(owned)).toBe(true);
  const builder = DiBag.begin();
  for (const value of [{ ...owned }, { ...owned, create: () => 'wrong' }, Object.create(owned)]) {
    expect(() => Reflect.apply(builder.add, builder, [{ value }])).toThrow(/invalid.*registration/);
  }
  expect(builder.add({ value: owned }).end().resolve('value')).toBe(1);
});

test('normalization does not expose mutable ownership registry metadata', async () => {
  let disposed: number | undefined;
  const owned = DiBag.withDisposal(() => 1, value => { disposed = value; });
  normalize(owned).create = () => 'wrong';
  const bag = DiBag.begin().add({ value: owned }).end();
  expect(bag.resolve('value')).toBe(1);
  await bag.close();
  expect(disposed).toBe(1);
});

test('unchecked source Bag construction is not exported', () => {
  expect(Object.hasOwn(source, 'Bag')).toBe(false);
});

test('plain registration maps from another realm retain their own factories', () => {
  const builder = DiBag.begin();
  const foreign = runInNewContext('({ value: () => 42 })');
  const bag = Reflect.apply(builder.add, builder, [foreign]).end();
  expect(bag.resolve('value')).toBe(42);
});
