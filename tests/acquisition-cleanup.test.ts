import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';
import { DiBagCleanupError, DiBagStartupError } from '../src';
import { deferred } from './helpers';

test('a failed acquisition releases each resource it had already acquired, once', async () => {
  const released: string[] = [];
  const bag = DiBag.createBuilder().register({
    session: DiBag.fromFactory(async (_deps: {}, context) => {
      released.push('open:a');
      context.defer(() => { released.push('close:a'); });
      throw new Error('handshake');
    }, { context: 'acquisition' }),
  }).build();
  await expect(bag.resolve('session')).rejects.toThrow('handshake');
  await bag.close();
  expect(released).toEqual(['open:a', 'close:a']);
});

test('a successful acquisition discards its deferred actions and keeps withDisposal ownership', async () => {
  const events: string[] = [];
  const bag = DiBag.createBuilder().register({
    session: DiBag.withDisposal(
      DiBag.fromFactory((_deps: {}, context) => {
        context.defer(() => { events.push('rollback'); });
        return 'session';
      }, { context: 'acquisition' }),
      value => { events.push(`dispose:${value}`); },
    ),
  }).build();
  expect(bag.resolve('session')).toBe('session');
  await bag.close();
  expect(events).toEqual(['dispose:session']);
});

test('deferred actions run in reverse registration order', async () => {
  const released: number[] = [];
  const bag = DiBag.createBuilder().register({
    service: DiBag.fromFactory(async (_deps: {}, context) => {
      for (const index of [1, 2, 3]) context.defer(() => { released.push(index); });
      throw new Error('late');
    }, { context: 'acquisition' }),
  }).build();
  await expect(bag.resolve('service')).rejects.toThrow('late');
  await bag.close();
  expect(released).toEqual([3, 2, 1]);
});

test('one rejecting deferred action never skips the rest and surfaces at close', async () => {
  const released: string[] = [];
  const bag = DiBag.createBuilder().register({
    service: DiBag.fromFactory(async (_deps: {}, context) => {
      context.defer(() => { released.push('outer'); });
      context.defer(() => { throw new Error('release failed'); });
      context.defer(() => { released.push('inner'); });
      throw new Error('acquire');
    }, { context: 'acquisition' }),
  }).build();
  await expect(bag.resolve('service')).rejects.toThrow('acquire');
  const failure = await bag.close().then(() => undefined, (error: unknown) => error);
  expect(released).toEqual(['inner', 'outer']);
  expect(failure).toBeInstanceOf(DiBagCleanupError);
  expect((failure as DiBagCleanupError).failures).toHaveLength(1);
  expect((failure as DiBagCleanupError).failures[0]!.label).toBe('service');
});

test('a rejecting source runs its rollback and never reaches the ownership stage', async () => {
  const events: string[] = [];
  const bag = DiBag.createBuilder().register({
    service: DiBag.withDisposal(
      DiBag.fromFactory(async (_deps: {}, context) => {
        context.defer(() => { events.push('rollback'); });
        return Promise.reject(new Error('rejected'));
      }, { context: 'acquisition', acquisitionMode: 'nativePromise' }),
      () => { events.push('dispose'); },
    ),
  }).build();
  await expect(bag.resolve('service')).rejects.toThrow('rejected');
  await bag.close();
  expect(events).toEqual(['rollback']);
});

test('a projection failing after the factory returned releases the value exactly once', async () => {
  const events: string[] = [];
  const bag = DiBag.createBuilder().register({
    service: DiBag.transformService(
      DiBag.withDisposal(
        DiBag.fromFactory(async (_deps: {}, context) => {
          context.defer(() => { events.push('rollback'); });
          return { id: 1 };
        }, { context: 'acquisition' }),
        () => { events.push('dispose'); },
      ),
      { mode: 'awaited', transform: () => { throw new Error('projection'); } },
    ),
  }).build();
  await expect(bag.resolve('service') as Promise<unknown>).rejects.toThrow('projection');
  await bag.close();
  // The factory returned, so ownership moved to withDisposal: one release, not two.
  expect(events).toEqual(['dispose']);
});

// A direct projection over an asynchronous source makes the result ready while
// the source is still pending. A source rejection then never retires the attempt,
// so its rollback waits for close() and only runs because the projection is owned.
// This pins the known limitation recorded in the design note; see docs/superpowers.
test('a direct projection over a rejecting source defers its rollback to close', async () => {
  const events: string[] = [];
  const bag = DiBag.createBuilder().register({
    service: DiBag.withDisposal(
      DiBag.transformService(
        DiBag.fromFactory((_deps: {}, context) => {
          context.defer(() => { events.push('rollback'); });
          return Promise.reject(new Error('source'));
        }, { context: 'acquisition', acquisitionMode: 'nativePromise' }),
        { mode: 'direct', transform: promise => ({ wrapped: promise }) },
      ),
      () => { events.push('dispose'); },
    ),
  }).build();
  const wrapper = bag.resolve('service');
  await expect(wrapper.wrapped).rejects.toThrow('source');
  expect(events).toEqual([]);
  await bag.close();
  // Rollback precedes the value the same acquisition owns.
  expect(events).toEqual(['rollback', 'dispose']);
});

test('rollback runs without waiting for the bag to close', async () => {
  const released: string[] = [];
  const bag = DiBag.createBuilder().register({
    service: DiBag.fromFactory(async (_deps: {}, context) => {
      context.defer(() => { released.push('socket'); });
      throw new Error('handshake');
    }, { context: 'acquisition' }),
  }).build();
  await expect(bag.resolve('service')).rejects.toThrow('handshake');
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(released).toEqual(['socket']);
  await bag.close();
  expect(released).toEqual(['socket']);
});

test('rollback reports each failure through the cleanup observer channel', async () => {
  const events: string[] = [];
  const Observed = DiBag.withConfiguration({
    observers: [{
      onEvent: event => { if (event.kind.startsWith('cleanup')) events.push(event.kind); },
      onError: () => {},
    }],
  });
  const bag = Observed.createBuilder().register({
    service: Observed.fromFactory(async (_deps: {}, context) => {
      context.defer(() => { throw new Error('release failed'); });
      throw new Error('acquire');
    }, { context: 'acquisition' }),
  }).build();
  await expect(bag.resolve('service')).rejects.toThrow('acquire');
  await expect(bag.close()).rejects.toBeInstanceOf(DiBagCleanupError);
  expect(events).toEqual(['cleanup-started', 'cleanup-failed', 'cleanup-completed']);
});

test('defer is rejected after an asynchronous factory has settled', async () => {
  let escaped!: { defer: (action: () => void) => void };
  const bag = DiBag.createBuilder().register({
    service: DiBag.fromFactory(async (_deps: {}, context) => {
      escaped = context;
      return 'ok';
    }, { context: 'acquisition' }),
  }).build();
  expect(await bag.resolve('service')).toBe('ok');
  expect(() => escaped.defer(() => {})).toThrow(/DI_BAG_CLEANUP_AFTER_FACTORY/);
  await bag.close();
});

test('each acquisition receives its own context object over the owner signal', () => {
  const bag = DiBag.createBuilder().register({
    first: DiBag.fromFactory((_deps: {}, context) => context, { context: 'acquisition' }),
    second: DiBag.fromFactory((_deps: {}, context) => context, { context: 'acquisition' }),
  }).build();
  const first = bag.resolve('first');
  const second = bag.resolve('second');
  expect(first).not.toBe(second);
  expect(first.signal).toBe(second.signal);
  return bag.close();
});

test('cancelling a scope mid-acquisition runs the deferred actions of the abandoned attempt', async () => {
  const gate = deferred<void>();
  const released: string[] = [];
  const bag = DiBag.createBuilder().register({
    service: DiBag.fromFactory(async (_deps: {}, context) => {
      context.defer(() => { released.push('socket'); });
      await gate.promise;
      context.signal.throwIfAborted();
      return 'never';
    }, { context: 'acquisition' }),
  }).build();
  const pending = bag.resolve('service');
  const closing = bag.close();
  gate.resolve();
  await expect(pending).rejects.toThrow();
  await closing;
  expect(released).toEqual(['socket']);
});

test('defer rejects a value that is not a function', async () => {
  const bag = DiBag.createBuilder().register({
    service: DiBag.fromFactory((_deps: {}, context) => {
      expect(() => (context as { defer: (action: unknown) => void }).defer(42)).toThrow(/DI_BAG_INVALID_CLEANUP/);
      return 'ok';
    }, { context: 'acquisition' }),
  }).build();
  expect(bag.resolve('service')).toBe('ok');
  await bag.close();
});

test('defer is rejected after a synchronous factory has returned', async () => {
  let escaped!: { defer: (action: () => void) => void };
  const bag = DiBag.createBuilder().register({
    service: DiBag.fromFactory((_deps: {}, context) => {
      escaped = context;
      return 'ok';
    }, { context: 'acquisition' }),
  }).build();
  expect(bag.resolve('service')).toBe('ok');
  expect(() => escaped.defer(() => {})).toThrow(/DI_BAG_CLEANUP_AFTER_FACTORY/);
  await bag.close();
});

test('a synchronous factory releases its deferred resource after the failure propagates', async () => {
  const released: string[] = [];
  const bag = DiBag.createBuilder().register({
    service: DiBag.fromFactory((_deps: {}, context) => {
      context.defer(() => { released.push('handle'); });
      throw new Error('sync');
    }, { context: 'acquisition' }),
  }).build();
  expect(() => bag.resolve('service')).toThrow('sync');
  await bag.close();
  expect(released).toEqual(['handle']);
});

test('each transient attempt owns its own deferred actions', async () => {
  const released: number[] = [];
  let attempts = 0;
  const bag = DiBag.createBuilder().register({
    service: DiBag.withLifetime(DiBag.fromFactory((_deps: {}, context) => {
      const index = attempts++;
      context.defer(() => { released.push(index); });
      throw new Error(`attempt ${index}`);
    }, { context: 'acquisition' }), 'transient'),
  }).build();
  expect(() => bag.resolve('service')).toThrow('attempt 0');
  expect(() => bag.resolve('service')).toThrow('attempt 1');
  await bag.close();
  expect(released).toEqual([0, 1]);
});

test('close waits for an asynchronous deferred action to finish', async () => {
  const gate = deferred<void>();
  const released: string[] = [];
  const bag = DiBag.createBuilder().register({
    service: DiBag.fromFactory(async (_deps: {}, context) => {
      context.defer(async () => { await gate.promise; released.push('socket'); });
      throw new Error('handshake');
    }, { context: 'acquisition' }),
  }).build();
  await expect(bag.resolve('service')).rejects.toThrow('handshake');
  const closing = bag.close();
  let closed = false;
  void closing.then(() => { closed = true; });
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(closed).toBe(false);
  expect(released).toEqual([]);
  gate.resolve();
  await closing;
  expect(released).toEqual(['socket']);
});

test('a raw asynchronous factory settles at its first await, as documented', async () => {
  const released: string[] = [];
  let afterAwait!: () => void;
  const bag = DiBag.createBuilder().register({
    service: DiBag.fromFactory(async (_deps: {}, context) => {
      context.defer(() => { released.push('before'); });
      await Promise.resolve();
      afterAwait = () => context.defer(() => { released.push('after'); });
      throw new Error('rejected');
    }, { context: 'acquisition', acquisitionMode: 'raw' }),
  }).build();
  // Raw acquisition completes on return, so the bag never observes the rejection.
  await expect(bag.resolve('service') as Promise<unknown>).rejects.toThrow('rejected');
  expect(afterAwait).toThrow(/DI_BAG_CLEANUP_AFTER_FACTORY/);
  await bag.close();
  expect(released).toEqual([]);
});

test('a rollback failure during startup is reported on DiBagStartupError', async () => {
  const failure = await DiBag.createBuilder().register({
    socket: DiBag.fromFactory(async (_deps: {}, context) => {
      context.defer(() => { throw new Error('release failed'); });
      throw new Error('handshake');
    }, { context: 'acquisition' }),
  }).buildAndStart(['socket']).then(() => undefined, (error: unknown) => error);
  expect(failure).toBeInstanceOf(DiBagStartupError);
  const { cleanupFailures } = failure as DiBagStartupError;
  expect(cleanupFailures).toHaveLength(1);
  expect(cleanupFailures[0]!.label).toBe('socket');
  expect((cleanupFailures[0]!.error as Error).message).toBe('release failed');
});

test('a retried scoped acquisition registers cleanup on a fresh list', async () => {
  const released: number[] = [];
  let attempts = 0;
  let first!: { defer: (action: () => void) => void };
  const bag = DiBag.createBuilder().register({
    service: DiBag.fromFactory((_deps: {}, context) => {
      const index = attempts++;
      if (index === 0) first = context;
      context.defer(() => { released.push(index); });
      throw new Error(`attempt ${index}`);
    }, { context: 'acquisition' }),
  }).build();
  expect(() => bag.resolve('service')).toThrow('attempt 0');
  expect(() => bag.resolve('service')).toThrow('attempt 1');
  expect(() => first.defer(() => {})).toThrow(/DI_BAG_CLEANUP_AFTER_FACTORY/);
  await bag.close();
  expect(released).toEqual([0, 1]);
});

test('a root service acquired through a child runs its rollback on the owning bag', async () => {
  const released: string[] = [];
  const root = DiBag.createBuilder().register({
    shared: DiBag.withLifetime(DiBag.fromFactory(async (_deps: {}, context) => {
      context.defer(() => { released.push('shared'); });
      throw new Error('root failed');
    }, { context: 'acquisition' }), 'root'),
  }).build();
  const child = root.createScope();
  await expect(child.resolve('shared')).rejects.toThrow('root failed');
  await child.close();
  expect(released).toEqual(['shared']);
  await root.close();
  expect(released).toEqual(['shared']);
});

test('startup rollback releases resources hidden inside an unfinished factory', async () => {
  const released: string[] = [];
  const failure = await DiBag.createBuilder().register({
    socket: DiBag.fromFactory(async (_deps: {}, context) => {
      context.defer(() => { released.push('socket'); });
      throw new Error('handshake');
    }, { context: 'acquisition' }),
  }).buildAndStart(['socket']).then(() => undefined, (error: unknown) => error);
  expect(failure).toBeInstanceOf(DiBagStartupError);
  expect((failure as DiBagStartupError).cause).toBeInstanceOf(Error);
  expect(((failure as DiBagStartupError).cause as Error).message).toBe('handshake');
  expect(released).toEqual(['socket']);
});
