import { expect, test } from 'bun:test';
import { DiBag, DiBagCleanupError } from '../src/node';
import { deferred } from './helpers';

test('a retry does not inherit the identity of a caught failed attempt', async () => {
  let first = true;
  const valueA = { id: 'a' };
  const valueB = { id: 'b' };
  const bag = DiBag.createBuilder().register({
    a: (deps: { b: typeof valueB }) => {
      try { void deps.b; } catch {}
      return valueA;
    },
    b: (deps: { a: typeof valueA }) => {
      if (first) { first = false; throw new Error('first attempt'); }
      expect(deps.a).toBe(valueA);
      return valueB;
    },
  }).build();
  expect(bag.resolve('a')).toBe(valueA);
  expect(bag.resolve('b')).toBe(valueB);
  expect(bag.resolve('a')).toBe(valueA);
  await bag.close();
});

test('a caught rejected attempt does not retarget its incoming edge to the retry', async () => {
  let first = true;
  const valueA = { id: 'a' };
  const valueB = { id: 'b' };
  const rejected = Promise.reject<typeof valueB>(new Error('first attempt'));
  const events: string[] = [];
  let originalA: Promise<typeof valueA> | undefined;
  let originalB: Promise<typeof valueB> | undefined;
  const bag = DiBag.createBuilder().register({
    a: DiBag.withDisposal((deps: { b: Promise<typeof valueB> }) => {
      originalA = (async () => {
        try { await deps.b; } catch {}
        return valueA;
      })();
      return originalA;
    }, value => { events.push(value.id); }),
    b: DiBag.withDisposal((deps: { a: Promise<typeof valueA> }) => {
      if (first) { first = false; return rejected; }
      originalB = (async () => {
        expect(await deps.a).toBe(valueA);
        return valueB;
      })();
      return originalB;
    }, value => { events.push(value.id); }),
  }).build();
  const a = bag.resolve('a');
  expect(originalA).toBe(a);
  expect(bag.resolve('b')).toBe(rejected);
  expect(await a).toBe(valueA);
  const b = bag.resolve('b');
  expect(originalB).toBe(b);
  expect(bag.resolve('b')).toBe(b);
  expect(await b).toBe(valueB);
  expect(bag.resolve('a')).toBe(a);
  await bag.close();
  expect(events).toEqual(['b', 'a']);
});

test('shutdown preserves every cleanup cause and its acquisition identity', async () => {
  const first = new Error('first cleanup');
  const events: string[] = [];
  const bag = DiBag.createBuilder().register({
    a: DiBag.withDisposal(() => 'a', () => { events.push('a'); throw first; }),
    b: DiBag.withDisposal(({ a }: { a: string }) => a + 'b', async () => {
      events.push('b');
      throw undefined;
    }),
    c: DiBag.withDisposal(() => 'c', () => { events.push('c'); }),
  }).build();
  bag.resolve('b');
  bag.resolve('c');
  const closing = bag.close();
  expect(bag.close()).toBe(closing);
  let failure: unknown;
  try { await closing; } catch (error) { failure = error; }
  expect(failure).toBeInstanceOf(DiBagCleanupError);
  if (!(failure instanceof DiBagCleanupError)) throw new Error('missing aggregate');
  expect(events).toEqual(['c', 'b', 'a']);
  expect(failure.errors).toEqual([undefined, first]);
  expect(failure.failures.map(item => item.error)).toEqual([undefined, first]);
  expect(failure.failures[0]!.error).toBeUndefined();
  expect(failure.failures[1]!.error).toBe(first);
  expect(failure.failures.map(item => item.label)).toEqual(['b', 'a']);
  expect(new Set(failure.failures.map(item => item.acquisitionId)).size).toBe(2);
  expect(failure.failures.every(item => typeof item.bindingId === 'symbol' &&
    typeof item.acquisitionId === 'symbol' && item.acquisitionId !== item.bindingId)).toBe(true);
  expect(Object.isFrozen(failure.failures)).toBe(true);
  expect(failure.failures.every(Object.isFrozen)).toBe(true);
  expect(bag.close()).toBe(closing);
  await expect(bag.close()).rejects.toBe(failure);
  expect(events).toEqual(['c', 'b', 'a']);
});

test('cleanup diagnostics snapshot caller records without cloning the original cause', () => {
  const cause = { reason: 'cleanup' };
  const record = { acquisitionId: Symbol('attempt'), bindingId: Symbol('binding'), label: 'resource', error: cause };
  const input = [record];
  const error = new DiBagCleanupError(input);
  record.label = 'changed';
  input.length = 0;
  expect(error.failures).toHaveLength(1);
  expect(error.failures[0]!.label).toBe('resource');
  expect(error.failures[0]!.error).toBe(cause);
  expect(error.errors[0]).toBe(cause);
  expect(error.failures[0]).not.toBe(record);
  expect(Object.isFrozen(error.failures)).toBe(true);
  expect(Object.isFrozen(error.failures[0])).toBe(true);
});

test('a failed attempt cannot borrow its pending retry permission to acquire during close', async () => {
  const gate = deferred<number>();
  const failure = new Error('first attempt');
  let first = true;
  let lateRead = () => 0;
  const events: string[] = [];
  const bag = DiBag.createBuilder().register({
    resource: DiBag.withDisposal(() => { events.push('resource:open'); return 42; },
      () => { events.push('resource:close'); }),
    holder: DiBag.withDisposal((deps: { resource: number }) => {
      if (first) {
        first = false;
        lateRead = () => deps.resource;
        throw failure;
      }
      return gate.promise;
    }, () => { events.push('holder:close'); }),
  }).build();
  expect(() => bag.resolve('holder')).toThrow(failure);
  expect(bag.resolve('holder')).toBe(gate.promise);
  const closing = bag.close();
  expect(lateRead).toThrow('bag is closing');
  gate.resolve(7);
  await closing;
  expect(events).toEqual(['holder:close']);
  expect(lateRead).toThrow('bag is closed');
});

test('a completed factory cannot start late acquisitions while another factory drains', async () => {
  const gate = deferred<number>();
  const events: string[] = [];
  const bag = DiBag.createBuilder().register({
    resource: () => { events.push('resource:open'); return 42; },
    reader: (deps: { resource: number }) => () => deps.resource,
    pending: DiBag.withDisposal(() => gate.promise, () => { events.push('pending:close'); }),
  }).build();
  const read = bag.resolve('reader');
  expect(bag.resolve('pending')).toBe(gate.promise);
  const closing = bag.close();
  expect(read).toThrow('bag is closing');
  gate.resolve(7);
  await closing;
  expect(events).toEqual(['pending:close']);
});

test('a retained failed proxy follows live dependencies without traversing removed attempts', async () => {
  let readA = () => 0;
  const bag = DiBag.createBuilder().register({
    a: (deps: { b: number }) => {
      try { void deps.b; } catch {}
      return 42;
    },
    b: (deps: { a: number }): number => {
      readA = () => deps.a;
      throw new Error('failed');
    },
  }).build();
  expect(bag.resolve('a')).toBe(42);
  expect(readA()).toBe(42);
  await bag.close();
  expect(readA).toThrow('bag is closed');
});
