import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';
import { DiBagCleanupError, DiBagStartupError } from '../src';
import { deferred } from './helpers';

const tick = () => new Promise<void>(resolve => setImmediate(resolve));

test('a failed acquisition releases each resource it had already acquired, once', async () => {
  const released: string[] = [];
  const bag = DiBag.createBuilder().register({
    session: DiBag.fromFactory(async (_deps: {}, factoryCtx) => {
      released.push('open:a');
      factoryCtx.pushDisposer(() => { released.push('close:a'); });
      throw new Error('handshake');
    }, { context: 'acquisition' }),
  }).build();
  await expect(bag.resolve('session')).rejects.toThrow('handshake');
  await bag.close();
  expect(released).toEqual(['open:a', 'close:a']);
});

test('a successful acquisition discards its pushed disposers and keeps withDisposal ownership', async () => {
  const events: string[] = [];
  const bag = DiBag.createBuilder().register({
    session: DiBag.withDisposal(
      DiBag.fromFactory((_deps: {}, factoryCtx) => {
        factoryCtx.pushDisposer(() => { events.push('rollback'); });
        return 'session';
      }, { context: 'acquisition' }),
      value => { events.push(`dispose:${value}`); },
    ),
  }).build();
  expect(bag.resolve('session')).toBe('session');
  await bag.close();
  expect(events).toEqual(['dispose:session']);
});

test('pushed disposers run last pushed first', async () => {
  const released: number[] = [];
  const bag = DiBag.createBuilder().register({
    service: DiBag.fromFactory(async (_deps: {}, factoryCtx) => {
      for (const index of [1, 2, 3]) factoryCtx.pushDisposer(() => { released.push(index); });
      throw new Error('late');
    }, { context: 'acquisition' }),
  }).build();
  await expect(bag.resolve('service')).rejects.toThrow('late');
  await bag.close();
  expect(released).toEqual([3, 2, 1]);
});

test('one rejecting pushed disposer never skips the rest and surfaces at close', async () => {
  const released: string[] = [];
  const bag = DiBag.createBuilder().register({
    service: DiBag.fromFactory(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { released.push('outer'); });
      factoryCtx.pushDisposer(() => { throw new Error('release failed'); });
      factoryCtx.pushDisposer(() => { released.push('inner'); });
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
      DiBag.fromFactory(async (_deps: {}, factoryCtx) => {
        factoryCtx.pushDisposer(() => { events.push('rollback'); });
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
        DiBag.fromFactory(async (_deps: {}, factoryCtx) => {
          factoryCtx.pushDisposer(() => { events.push('rollback'); });
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

test('rollback runs without waiting for the bag to close', async () => {
  const released: string[] = [];
  const bag = DiBag.createBuilder().register({
    service: DiBag.fromFactory(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { released.push('socket'); });
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
    service: Observed.fromFactory(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { throw new Error('release failed'); });
      throw new Error('acquire');
    }, { context: 'acquisition' }),
  }).build();
  await expect(bag.resolve('service')).rejects.toThrow('acquire');
  await expect(bag.close()).rejects.toBeInstanceOf(DiBagCleanupError);
  expect(events).toEqual(['cleanup-started', 'cleanup-failed', 'cleanup-completed']);
});

test('pushDisposer is rejected after an asynchronous factory has settled', async () => {
  let escaped!: { pushDisposer: (disposer: () => void) => void };
  const bag = DiBag.createBuilder().register({
    service: DiBag.fromFactory(async (_deps: {}, factoryCtx) => {
      escaped = factoryCtx;
      return 'ok';
    }, { context: 'acquisition' }),
  }).build();
  expect(await bag.resolve('service')).toBe('ok');
  expect(() => escaped.pushDisposer(() => {})).toThrow(/DI_BAG_CLEANUP_AFTER_FACTORY/);
  await bag.close();
});

test('each acquisition receives its own context object over the owner signal', () => {
  const bag = DiBag.createBuilder().register({
    first: DiBag.fromFactory((_deps: {}, factoryCtx) => factoryCtx, { context: 'acquisition' }),
    second: DiBag.fromFactory((_deps: {}, factoryCtx) => factoryCtx, { context: 'acquisition' }),
  }).build();
  const first = bag.resolve('first');
  const second = bag.resolve('second');
  expect(first).not.toBe(second);
  expect(first.signal).toBe(second.signal);
  return bag.close();
});

test('cancelling a scope mid-acquisition runs the pushed disposers of the abandoned attempt', async () => {
  const gate = deferred<void>();
  const released: string[] = [];
  const bag = DiBag.createBuilder().register({
    service: DiBag.fromFactory(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { released.push('socket'); });
      await gate.promise;
      factoryCtx.signal.throwIfAborted();
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

test('pushDisposer rejects a value that is not a function', async () => {
  const bag = DiBag.createBuilder().register({
    service: DiBag.fromFactory((_deps: {}, factoryCtx) => {
      expect(() => (factoryCtx as { pushDisposer: (disposer: unknown) => void }).pushDisposer(42)).toThrow(/DI_BAG_INVALID_CLEANUP/);
      return 'ok';
    }, { context: 'acquisition' }),
  }).build();
  expect(bag.resolve('service')).toBe('ok');
  await bag.close();
});

test('pushDisposer is rejected after a synchronous factory has returned', async () => {
  let escaped!: { pushDisposer: (disposer: () => void) => void };
  const bag = DiBag.createBuilder().register({
    service: DiBag.fromFactory((_deps: {}, factoryCtx) => {
      escaped = factoryCtx;
      return 'ok';
    }, { context: 'acquisition' }),
  }).build();
  expect(bag.resolve('service')).toBe('ok');
  expect(() => escaped.pushDisposer(() => {})).toThrow(/DI_BAG_CLEANUP_AFTER_FACTORY/);
  await bag.close();
});

test('each transient attempt owns its own pushed disposers', async () => {
  const released: number[] = [];
  let attempts = 0;
  const bag = DiBag.createBuilder().register({
    service: DiBag.withLifetime(DiBag.fromFactory((_deps: {}, factoryCtx) => {
      const index = attempts++;
      factoryCtx.pushDisposer(() => { released.push(index); });
      throw new Error(`attempt ${index}`);
    }, { context: 'acquisition' }), 'transient'),
  }).build();
  expect(() => bag.resolve('service')).toThrow('attempt 0');
  expect(() => bag.resolve('service')).toThrow('attempt 1');
  await bag.close();
  expect(released).toEqual([0, 1]);
});

test('close waits for an asynchronous pushed disposer to finish', async () => {
  const gate = deferred<void>();
  const released: string[] = [];
  const bag = DiBag.createBuilder().register({
    service: DiBag.fromFactory(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(async () => { await gate.promise; released.push('socket'); });
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
    service: DiBag.fromFactory(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { released.push('before'); });
      await Promise.resolve();
      afterAwait = () => factoryCtx.pushDisposer(() => { released.push('after'); });
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
    socket: DiBag.fromFactory(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { throw new Error('release failed'); });
      throw new Error('handshake');
    }, { context: 'acquisition' }),
  }).buildAndStart(['socket']).then(() => undefined, (error: unknown) => error);
  expect(failure).toBeInstanceOf(DiBagStartupError);
  const { cleanupFailures } = failure as DiBagStartupError;
  expect(cleanupFailures).toHaveLength(1);
  expect(cleanupFailures[0]!.label).toBe('socket');
  expect((cleanupFailures[0]!.error as Error).message).toBe('release failed');
});

test('a retried scoped acquisition pushes onto a fresh stack', async () => {
  const released: number[] = [];
  let attempts = 0;
  let first!: { pushDisposer: (disposer: () => void) => void };
  const bag = DiBag.createBuilder().register({
    service: DiBag.fromFactory((_deps: {}, factoryCtx) => {
      const index = attempts++;
      if (index === 0) first = factoryCtx;
      factoryCtx.pushDisposer(() => { released.push(index); });
      throw new Error(`attempt ${index}`);
    }, { context: 'acquisition' }),
  }).build();
  expect(() => bag.resolve('service')).toThrow('attempt 0');
  expect(() => bag.resolve('service')).toThrow('attempt 1');
  expect(() => first.pushDisposer(() => {})).toThrow(/DI_BAG_CLEANUP_AFTER_FACTORY/);
  await bag.close();
  expect(released).toEqual([0, 1]);
});

test('a root service acquired through a child runs its rollback on the owning bag', async () => {
  const released: string[] = [];
  const root = DiBag.createBuilder().register({
    shared: DiBag.withLifetime(DiBag.fromFactory(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { released.push('shared'); });
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
    socket: DiBag.fromFactory(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { released.push('socket'); });
      throw new Error('handshake');
    }, { context: 'acquisition' }),
  }).buildAndStart(['socket']).then(() => undefined, (error: unknown) => error);
  expect(failure).toBeInstanceOf(DiBagStartupError);
  expect((failure as DiBagStartupError).cause).toBeInstanceOf(Error);
  expect(((failure as DiBagStartupError).cause as Error).message).toBe('handshake');
  expect(released).toEqual(['socket']);
});

test('a direct projection over a rejecting source runs its rollback when the source settles', async () => {
  const events: string[] = [];
  const bag = DiBag.createBuilder().register({
    service: DiBag.withDisposal(
      DiBag.transformService(
        DiBag.fromFactory((_deps: {}, factoryCtx) => {
          factoryCtx.pushDisposer(() => { events.push('rollback'); });
          return Promise.reject(new Error('source'));
        }, { context: 'acquisition', acquisitionMode: 'nativePromise' }),
        { mode: 'direct', transform: promise => ({ wrapped: promise }) },
      ),
      () => { events.push('dispose'); },
    ),
  }).build();
  const wrapper = bag.resolve('service');
  await expect(wrapper.wrapped).rejects.toThrow('source');
  await tick();
  expect(events).toEqual(['rollback']);
  await bag.close();
  // The owned wrapper is disposed at close; the stack already ran when the factory failed.
  expect(events).toEqual(['rollback', 'dispose']);
});

test('a direct projection over a rejecting source with no ownership still runs its rollback', async () => {
  const events: string[] = [];
  const bag = DiBag.createBuilder().register({
    service: DiBag.transformService(DiBag.fromFactory(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { events.push('rollback'); });
      await Promise.resolve();
      throw new Error('source');
    }, { context: 'acquisition' }), { mode: 'direct', transform: promise => ({ wrapped: promise }) }),
  }).build();
  await expect(bag.resolve('service').wrapped).rejects.toThrow('source');
  await tick();
  expect(events).toEqual(['rollback']);
  expect(bag.inspect('service').acquisitions[0]!.state).toBe('ready');
  await bag.close();
  expect(events).toEqual(['rollback']);
});

test('a disposer pushed after a direct wrapper was handed out is still honoured', async () => {
  const events: string[] = [];
  const bag = DiBag.createBuilder().register({
    service: DiBag.transformService(DiBag.fromFactory(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { events.push('early'); });
      await Promise.resolve();
      factoryCtx.pushDisposer(() => { events.push('late'); });
      throw new Error('source');
    }, { context: 'acquisition' }), { mode: 'direct', transform: promise => ({ wrapped: promise }) }),
  }).build();
  await expect(bag.resolve('service').wrapped).rejects.toThrow('source');
  await tick();
  expect(events).toEqual(['late', 'early']);
  await bag.close();
});

test('a close racing an in-flight rollback waits for it before disposing anything', async () => {
  const events: string[] = [];
  const gate = deferred<void>();
  const bag = DiBag.createBuilder().register({
    service: DiBag.withDisposal(DiBag.transformService(DiBag.fromFactory(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(async () => { events.push('rollback-start'); await gate.promise; events.push('rollback-end'); });
      await Promise.resolve();
      throw new Error('source');
    }, { context: 'acquisition' }), { mode: 'direct', transform: promise => ({ wrapped: promise }) }), () => { events.push('dispose'); }),
  }).build();
  await expect(bag.resolve('service').wrapped).rejects.toThrow('source');
  const closing = bag.close();
  await tick();
  expect(events).toEqual(['rollback-start']);
  gate.resolve();
  await closing;
  expect(events).toEqual(['rollback-start', 'rollback-end', 'dispose']);
});

test('a failing factory hands every pushed disposer the same frozen factory-failed context', async () => {
  const seen: unknown[] = [];
  const bag = DiBag.createBuilder().register({
    service: DiBag.fromFactory(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(disposerCtx => { seen.push(disposerCtx); });
      factoryCtx.pushDisposer(disposerCtx => { seen.push(disposerCtx); });
      throw new Error('handshake');
    }, { context: 'acquisition' }),
  }).build();
  await expect(bag.resolve('service')).rejects.toThrow('handshake');
  await tick();
  expect(seen).toHaveLength(2);
  expect(seen[0]).toBe(seen[1]);
  expect(seen[0]).toEqual({ reason: 'factory-failed' });
  expect(Object.isFrozen(seen[0])).toBe(true);
  await bag.close();
});

test('a synchronous failure never runs a pushed disposer inline with the throw', async () => {
  const released: string[] = [];
  const bag = DiBag.createBuilder().register({
    service: DiBag.fromFactory((_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { released.push('handle'); });
      throw new Error('sync');
    }, { context: 'acquisition' }),
  }).build();
  expect(() => bag.resolve('service')).toThrow('sync');
  expect(released).toEqual([]);
  await tick();
  expect(released).toEqual(['handle']);
  await bag.close();
});

test('rollback events follow acquisition-failed and never precede it', async () => {
  const kinds: string[] = [];
  const Observed = DiBag.withConfiguration({ observers: [{ onEvent: event => { if (!event.kind.startsWith('scope')) kinds.push(event.kind); }, onError: () => {} }] });
  const bag = Observed.createBuilder().register({
    service: Observed.fromFactory(async (_deps: {}, factoryCtx) => { factoryCtx.pushDisposer(() => {}); await Promise.resolve(); throw new Error('source'); }, { context: 'acquisition' }),
  }).build();
  await expect(bag.resolve('service')).rejects.toThrow('source');
  await tick();
  expect(kinds).toEqual(['acquisition-started', 'acquisition-failed', 'cleanup-started', 'cleanup-completed']);
  await bag.close();
  expect(kinds).toEqual(['acquisition-started', 'acquisition-failed', 'cleanup-started', 'cleanup-completed']);
});
