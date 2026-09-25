import { expect, test } from 'bun:test';
import { DiBag, DiBagDisposalError } from '../src';
import { deferred } from './helpers';

test('a retry does not inherit the identity of a caught failed attempt', async () => {
  let first = true;
  const valueA = { id: 'a' };
  const valueB = { id: 'b' };
  const bag = DiBag.createBuilder().withServices({
    a: (deps: { b: typeof valueB }) => {
      try { void deps.b; } catch {}
      return valueA;
    },
    b: (deps: { a: typeof valueA }) => {
      if (first) { first = false; throw new Error('first attempt'); }
      expect(deps.a).toBe(valueA);
      return valueB;
    },
  }).buildContainer();
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
  const bag = DiBag.createBuilder().withServices({
    a: DiBag.providerWithDisposal({ provider: (deps: { b: Promise<typeof valueB> }) => {
      originalA = (async () => {
        try { await deps.b; } catch {}
        return valueA;
      })();
      return originalA;
    }, disposeService: value => { events.push(value.id); } }),
    b: DiBag.providerWithDisposal({ provider: (deps: { a: Promise<typeof valueA> }) => {
      if (first) { first = false; return rejected; }
      originalB = (async () => {
        expect(await deps.a).toBe(valueA);
        return valueB;
      })();
      return originalB;
    }, disposeService: value => { events.push(value.id); } }),
  }).buildContainer();
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
  const bag = DiBag.createBuilder().withServices({
    a: DiBag.providerWithDisposal({ provider: () => 'a', disposeService: () => { events.push('a'); throw first; } }),
    b: DiBag.providerWithDisposal({ provider: ({ a }: { a: string }) => a + 'b', disposeService: async () => {
      events.push('b');
      throw undefined;
    } }),
    c: DiBag.providerWithDisposal({ provider: () => 'c', disposeService: () => { events.push('c'); } }),
  }).buildContainer();
  bag.resolve('b');
  bag.resolve('c');
  const closing = bag.close();
  expect(bag.close()).toBe(closing);
  let failure: unknown;
  try { await closing; } catch (error) { failure = error; }
  expect(failure).toBeInstanceOf(DiBagDisposalError);
  if (!(failure instanceof DiBagDisposalError)) throw new Error('missing aggregate');
  expect(events).toEqual(['c', 'b', 'a']);
  expect(failure.errors).toEqual([undefined, first]);
  expect(failure.failures.map(item => item.error)).toEqual([undefined, first]);
  expect(failure.failures[0]!.error).toBeUndefined();
  expect(failure.failures[1]!.error).toBe(first);
  expect(failure.failures.map(item => item.bindingLabel)).toEqual(['b', 'a']);
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
  const record = { acquisitionId: Symbol('attempt'), bindingId: Symbol('binding'), bindingLabel: 'resource', error: cause };
  const input = [record];
  const error = new DiBagDisposalError(input);
  record.bindingLabel = 'changed';
  input.length = 0;
  expect(error.failures).toHaveLength(1);
  expect(error.failures[0]!.bindingLabel).toBe('resource');
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
  const bag = DiBag.createBuilder().withServices({
    resource: DiBag.providerWithDisposal({ provider: () => { events.push('resource:open'); return 42; }, disposeService: () => { events.push('resource:close'); } }),
    holder: DiBag.providerWithDisposal({ provider: (deps: { resource: number }) => {
      if (first) {
        first = false;
        lateRead = () => deps.resource;
        throw failure;
      }
      return gate.promise;
    }, disposeService: () => { events.push('holder:close'); } }),
  }).buildContainer();
  expect(() => bag.resolve('holder')).toThrow(failure);
  expect(bag.resolve('holder')).toBe(gate.promise);
  const closing = bag.close();
  expect(lateRead).toThrow('container is closing');
  gate.resolve(7);
  await closing;
  expect(events).toEqual(['holder:close']);
  expect(lateRead).toThrow('container is closed');
});

test('a completed factory cannot start late acquisitions while another factory drains', async () => {
  const gate = deferred<number>();
  const events: string[] = [];
  const bag = DiBag.createBuilder().withServices({
    resource: () => { events.push('resource:open'); return 42; },
    reader: (deps: { resource: number }) => () => deps.resource,
    pending: DiBag.providerWithDisposal({ provider: () => gate.promise, disposeService: () => { events.push('pending:close'); } }),
  }).buildContainer();
  const read = bag.resolve('reader');
  expect(bag.resolve('pending')).toBe(gate.promise);
  const closing = bag.close();
  expect(read).toThrow('container is closing');
  gate.resolve(7);
  await closing;
  expect(events).toEqual(['pending:close']);
});

test('a retained failed proxy follows live dependencies without traversing removed attempts', async () => {
  let readA = () => 0;
  const bag = DiBag.createBuilder().withServices({
    a: (deps: { b: number }) => {
      try { void deps.b; } catch {}
      return 42;
    },
    b: (deps: { a: number }): number => {
      readA = () => deps.a;
      throw new Error('failed');
    },
  }).buildContainer();
  expect(bag.resolve('a')).toBe(42);
  expect(readA()).toBe(42);
  await bag.close();
  expect(readA).toThrow('container is closed');
});
