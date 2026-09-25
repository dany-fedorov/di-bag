import { expect, test } from 'bun:test';
import { DiBag } from '../src';
import { DiBagDisposalError, DiBagCloseCancelledError, DiBagServiceReadinessError } from '../src';
import { deferred } from './helpers';

const tick = () => new Promise<void>(resolve => setImmediate(resolve));

test('a failed acquisition releases each resource it had already acquired, once', async () => {
  const released: string[] = [];
  const bag = DiBag.createBuilder().withServices({
    session: DiBag.createProvider(async (_deps: {}, factoryCtx) => {
      released.push('open:a');
      factoryCtx.pushDisposer(() => { released.push('close:a'); });
      throw new Error('handshake');
    }, { factoryReceivesContext: true }),
  }).buildContainer();
  await expect(bag.resolve('session')).rejects.toThrow('handshake');
  await bag.close();
  expect(released).toEqual(['open:a', 'close:a']);
});

test('a successful acquisition keeps its pushed disposers and runs them after the service disposer at close', async () => {
  const events: string[] = [];
  const bag = DiBag.createBuilder().withServices({
    session: DiBag.providerWithDisposal({ provider: DiBag.createProvider((_deps: {}, factoryCtx) => {
        factoryCtx.pushDisposer(() => { events.push('rollback'); });
        return 'session';
      }, { factoryReceivesContext: true }), disposeService: value => { events.push(`dispose:${value}`); } }),
  }).buildContainer();
  expect(bag.resolve('session')).toBe('session');
  await tick();
  expect(events).toEqual([]);
  await bag.close();
  expect(events).toEqual(['dispose:session', 'rollback']);
});

test('pushed disposers run last pushed first', async () => {
  const released: number[] = [];
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.createProvider(async (_deps: {}, factoryCtx) => {
      for (const index of [1, 2, 3]) factoryCtx.pushDisposer(() => { released.push(index); });
      throw new Error('late');
    }, { factoryReceivesContext: true }),
  }).buildContainer();
  await expect(bag.resolve('service')).rejects.toThrow('late');
  await bag.close();
  expect(released).toEqual([3, 2, 1]);
});

test('one rejecting pushed disposer never skips the rest and surfaces at close', async () => {
  const released: string[] = [];
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.createProvider(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { released.push('outer'); });
      factoryCtx.pushDisposer(() => { throw new Error('release failed'); });
      factoryCtx.pushDisposer(() => { released.push('inner'); });
      throw new Error('acquire');
    }, { factoryReceivesContext: true }),
  }).buildContainer();
  await expect(bag.resolve('service')).rejects.toThrow('acquire');
  const failure = await bag.close().then(() => undefined, (error: unknown) => error);
  expect(released).toEqual(['inner', 'outer']);
  expect(failure).toBeInstanceOf(DiBagDisposalError);
  expect((failure as DiBagDisposalError).failures).toHaveLength(1);
  expect((failure as DiBagDisposalError).failures[0]!.bindingLabel).toBe('service');
});

test('a rejecting source runs its rollback and never reaches the ownership stage', async () => {
  const events: string[] = [];
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.providerWithDisposal({ provider: DiBag.createProvider(async (_deps: {}, factoryCtx) => {
        factoryCtx.pushDisposer(() => { events.push('rollback'); });
        return Promise.reject(new Error('rejected'));
      }, { factoryReturnKind: 'native-promise', factoryReceivesContext: true }), disposeService: () => { events.push('dispose'); } }),
  }).buildContainer();
  await expect(bag.resolve('service')).rejects.toThrow('rejected');
  await bag.close();
  expect(events).toEqual(['rollback']);
});

test('a projection failing after the factory returned disposes the service, then the stack, once each', async () => {
  const events: string[] = [];
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.providerWithTransformedService({ provider: DiBag.providerWithDisposal({ provider: DiBag.createProvider(async (_deps: {}, factoryCtx) => {
          factoryCtx.pushDisposer(() => { events.push('rollback'); });
          return { id: 1 };
        }, { factoryReceivesContext: true }), disposeService: () => { events.push('dispose'); } }), transformService: () => { throw new Error('projection'); }, callbackReceives: 'fulfilled-value' }),
  }).buildContainer();
  await expect(bag.resolve('service') as Promise<unknown>).rejects.toThrow('projection');
  await tick();
  // The factory returned, so the bag owns its stack below the service disposer; retirement runs both.
  expect(events).toEqual(['dispose', 'rollback']);
  await bag.close();
  expect(events).toEqual(['dispose', 'rollback']);
});

test('rollback runs without waiting for the bag to close', async () => {
  const released: string[] = [];
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.createProvider(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { released.push('socket'); });
      throw new Error('handshake');
    }, { factoryReceivesContext: true }),
  }).buildContainer();
  await expect(bag.resolve('service')).rejects.toThrow('handshake');
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(released).toEqual(['socket']);
  await bag.close();
  expect(released).toEqual(['socket']);
});

test('rollback reports each failure through the cleanup observer channel', async () => {
  const events: string[] = [];
  const Observed = DiBag.withConfiguration({
    lifecycleObservers: [{
      onLifecycleEvent: event => { if (event.kind.startsWith('disposal')) events.push(event.kind); },
      onObserverFailure: () => {},
    }],
  });
  const bag = Observed.createBuilder().withServices({
    service: Observed.createProvider(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { throw new Error('release failed'); });
      throw new Error('acquire');
    }, { factoryReceivesContext: true }),
  }).buildContainer();
  await expect(bag.resolve('service')).rejects.toThrow('acquire');
  await expect(bag.close()).rejects.toBeInstanceOf(DiBagDisposalError);
  expect(events).toEqual(['disposal-started', 'disposal-failed', 'disposal-completed']);
});

test('pushDisposer is rejected after an asynchronous factory has settled', async () => {
  let escaped!: { pushDisposer: (disposer: () => void) => void };
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.createProvider(async (_deps: {}, factoryCtx) => {
      escaped = factoryCtx;
      return 'ok';
    }, { factoryReceivesContext: true }),
  }).buildContainer();
  expect(await bag.resolve('service')).toBe('ok');
  expect(() => escaped.pushDisposer(() => {})).toThrow(/DI_BAG_DISPOSER_PUSHED_AFTER_FACTORY/);
  const late = (() => { try { escaped.pushDisposer(() => {}); } catch (error) { return error as { code: string; details: unknown }; } throw new Error('expected a throw'); })();
  expect(late.code).toBe('DI_BAG_DISPOSER_PUSHED_AFTER_FACTORY');
  expect(late.details).toEqual({ operation: 'pushDisposer' });
  await bag.close();
});

test('each acquisition receives its own context object over the owner signal', () => {
  const bag = DiBag.createBuilder().withServices({
    first: DiBag.createProvider((_deps: {}, factoryCtx) => factoryCtx, { factoryReceivesContext: true }),
    second: DiBag.createProvider((_deps: {}, factoryCtx) => factoryCtx, { factoryReceivesContext: true }),
  }).buildContainer();
  const first = bag.resolve('first');
  const second = bag.resolve('second');
  expect(first).not.toBe(second);
  expect(first.abortSignal).toBe(second.abortSignal);
  return bag.close();
});

test('cancelling a scope mid-acquisition runs the pushed disposers of the abandoned attempt', async () => {
  const gate = deferred<void>();
  const released: string[] = [];
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.createProvider(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { released.push('socket'); });
      await gate.promise;
      factoryCtx.abortSignal.throwIfAborted();
      return 'never';
    }, { factoryReceivesContext: true }),
  }).buildContainer();
  const pending = bag.resolve('service');
  const closing = bag.close();
  gate.resolve();
  await expect(pending).rejects.toThrow();
  await closing;
  expect(released).toEqual(['socket']);
});

test('pushDisposer rejects a value that is not a function', async () => {
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.createProvider((_deps: {}, factoryCtx) => {
      expect(() => (factoryCtx as { pushDisposer: (disposer: unknown) => void }).pushDisposer(42)).toThrow(/DI_BAG_INVALID_ARGUMENT/);
      return 'ok';
    }, { factoryReceivesContext: true }),
  }).buildContainer();
  expect(bag.resolve('service')).toBe('ok');
  await bag.close();
});

test('pushDisposer is rejected after a synchronous factory has returned', async () => {
  let escaped!: { pushDisposer: (disposer: () => void) => void };
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.createProvider((_deps: {}, factoryCtx) => {
      escaped = factoryCtx;
      return 'ok';
    }, { factoryReceivesContext: true }),
  }).buildContainer();
  expect(bag.resolve('service')).toBe('ok');
  expect(() => escaped.pushDisposer(() => {})).toThrow(/DI_BAG_DISPOSER_PUSHED_AFTER_FACTORY/);
  await bag.close();
});

test('each transient attempt owns its own pushed disposers', async () => {
  const released: number[] = [];
  let attempts = 0;
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.providerWithLifetime({ provider: DiBag.createProvider((_deps: {}, factoryCtx) => {
      const index = attempts++;
      factoryCtx.pushDisposer(() => { released.push(index); });
      throw new Error(`attempt ${index}`);
    }, { factoryReceivesContext: true }), lifetime: 'transient:one-per-resolve' }),
  }).buildContainer();
  expect(() => bag.resolve('service')).toThrow('attempt 0');
  expect(() => bag.resolve('service')).toThrow('attempt 1');
  await bag.close();
  expect(released).toEqual([0, 1]);
});

test('close waits for an asynchronous pushed disposer to finish', async () => {
  const gate = deferred<void>();
  const released: string[] = [];
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.createProvider(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(async () => { await gate.promise; released.push('socket'); });
      throw new Error('handshake');
    }, { factoryReceivesContext: true }),
  }).buildContainer();
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
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.createProvider(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { released.push('before'); });
      await Promise.resolve();
      afterAwait = () => factoryCtx.pushDisposer(() => { released.push('after'); });
      throw new Error('rejected');
    }, { factoryReturnKind: 'uninspected', factoryReceivesContext: true }),
  }).buildContainer();
  // Raw acquisition completes on return, so the bag owns the early push and never observes the rejection.
  await expect(bag.resolve('service') as Promise<unknown>).rejects.toThrow('rejected');
  expect(afterAwait).toThrow(/DI_BAG_DISPOSER_PUSHED_AFTER_FACTORY/);
  await tick();
  expect(released).toEqual([]);
  await bag.close();
  expect(released).toEqual(['before']);
});

test('a rollback failure during readiness is reported on DiBagServiceReadinessError', async () => {
  const failure = await DiBag.createBuilder().withServices({
    socket: DiBag.createProvider(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { throw new Error('release failed'); });
      throw new Error('handshake');
    }, { factoryReceivesContext: true }),
  }).buildContainer().ensureServicesReady(['socket']).then(() => undefined, (error: unknown) => error);
  expect(failure).toBeInstanceOf(DiBagServiceReadinessError);
  const { disposalFailures } = failure as DiBagServiceReadinessError;
  expect(disposalFailures).toHaveLength(1);
  expect(disposalFailures[0]!.bindingLabel).toBe('socket');
  expect((disposalFailures[0]!.error as Error).message).toBe('release failed');
});

test('a retried scoped acquisition pushes onto a fresh stack', async () => {
  const released: number[] = [];
  let attempts = 0;
  let first!: { pushDisposer: (disposer: () => void) => void };
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.createProvider((_deps: {}, factoryCtx) => {
      const index = attempts++;
      if (index === 0) first = factoryCtx;
      factoryCtx.pushDisposer(() => { released.push(index); });
      throw new Error(`attempt ${index}`);
    }, { factoryReceivesContext: true }),
  }).buildContainer();
  expect(() => bag.resolve('service')).toThrow('attempt 0');
  expect(() => bag.resolve('service')).toThrow('attempt 1');
  expect(() => first.pushDisposer(() => {})).toThrow(/DI_BAG_DISPOSER_PUSHED_AFTER_FACTORY/);
  await bag.close();
  expect(released).toEqual([0, 1]);
});

test('a root service acquired through a child runs its rollback on the owning bag', async () => {
  const released: string[] = [];
  const root = DiBag.createBuilder().withServices({
    shared: DiBag.providerWithLifetime({ provider: DiBag.createProvider(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { released.push('shared'); });
      throw new Error('root failed');
    }, { factoryReceivesContext: true }), lifetime: 'singleton:one-per-container-tree' }),
  }).buildContainer();
  const child = root.createChildContainer();
  await expect(child.resolve('shared')).rejects.toThrow('root failed');
  await child.close();
  expect(released).toEqual(['shared']);
  await root.close();
  expect(released).toEqual(['shared']);
});

test('startup rollback releases resources hidden inside an unfinished factory', async () => {
  const released: string[] = [];
  const failure = await DiBag.createBuilder().withServices({
    socket: DiBag.createProvider(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { released.push('socket'); });
      throw new Error('handshake');
    }, { factoryReceivesContext: true }),
  }).buildContainer().ensureServicesReady(['socket']).then(() => undefined, (error: unknown) => error);
  expect(failure).toBeInstanceOf(DiBagServiceReadinessError);
  expect((failure as DiBagServiceReadinessError).cause).toBeInstanceOf(Error);
  expect(((failure as DiBagServiceReadinessError).cause as Error).message).toBe('handshake');
  expect(released).toEqual(['socket']);
});

test('a direct projection over a rejecting source runs its rollback when the source settles', async () => {
  const events: string[] = [];
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.providerWithDisposal({ provider: DiBag.providerWithTransformedService({ provider: DiBag.createProvider((_deps: {}, factoryCtx) => {
          factoryCtx.pushDisposer(() => { events.push('rollback'); });
          return Promise.reject(new Error('source'));
        }, { factoryReturnKind: 'native-promise', factoryReceivesContext: true }), transformService: promise => ({ wrapped: promise }), callbackReceives: 'exposed-service' }), disposeService: () => { events.push('dispose'); } }),
  }).buildContainer();
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
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.providerWithTransformedService({ provider: DiBag.createProvider(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { events.push('rollback'); });
      await Promise.resolve();
      throw new Error('source');
    }, { factoryReceivesContext: true }), transformService: promise => ({ wrapped: promise }), callbackReceives: 'exposed-service' }),
  }).buildContainer();
  await expect(bag.resolve('service').wrapped).rejects.toThrow('source');
  await tick();
  expect(events).toEqual(['rollback']);
  expect(bag.serviceSnapshot('service').acquisitions[0]!.state).toBe('ready');
  await bag.close();
  expect(events).toEqual(['rollback']);
});

test('a disposer pushed after a direct wrapper was handed out is still honoured', async () => {
  const events: string[] = [];
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.providerWithTransformedService({ provider: DiBag.createProvider(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { events.push('early'); });
      await Promise.resolve();
      factoryCtx.pushDisposer(() => { events.push('late'); });
      throw new Error('source');
    }, { factoryReceivesContext: true }), transformService: promise => ({ wrapped: promise }), callbackReceives: 'exposed-service' }),
  }).buildContainer();
  await expect(bag.resolve('service').wrapped).rejects.toThrow('source');
  await tick();
  expect(events).toEqual(['late', 'early']);
  await bag.close();
});

test('a close racing an in-flight rollback waits for it before disposing anything', async () => {
  const events: string[] = [];
  const gate = deferred<void>();
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.providerWithDisposal({ provider: DiBag.providerWithTransformedService({ provider: DiBag.createProvider(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(async () => { events.push('rollback-start'); await gate.promise; events.push('rollback-end'); });
      await Promise.resolve();
      throw new Error('source');
    }, { factoryReceivesContext: true }), transformService: promise => ({ wrapped: promise }), callbackReceives: 'exposed-service' }), disposeService: () => { events.push('dispose'); } }),
  }).buildContainer();
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
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.createProvider(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(disposerCtx => { seen.push(disposerCtx); });
      factoryCtx.pushDisposer(disposerCtx => { seen.push(disposerCtx); });
      throw new Error('handshake');
    }, { factoryReceivesContext: true }),
  }).buildContainer();
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
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.createProvider((_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { released.push('handle'); });
      throw new Error('sync');
    }, { factoryReceivesContext: true }),
  }).buildContainer();
  expect(() => bag.resolve('service')).toThrow('sync');
  expect(released).toEqual([]);
  await tick();
  expect(released).toEqual(['handle']);
  await bag.close();
});

test('without a projection the rollback pair follows acquisition-failed', async () => {
  const kinds: string[] = [];
  const Observed = DiBag.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent: event => { if (!event.kind.startsWith('container')) kinds.push(event.kind); }, onObserverFailure: () => {} }] });
  const bag = Observed.createBuilder().withServices({
    service: Observed.createProvider(async (_deps: {}, factoryCtx) => { factoryCtx.pushDisposer(() => {}); await Promise.resolve(); throw new Error('source'); }, { factoryReceivesContext: true }),
  }).buildContainer();
  await expect(bag.resolve('service')).rejects.toThrow('source');
  await tick();
  expect(kinds).toEqual(['acquisition-started', 'acquisition-failed', 'disposal-started', 'disposal-completed']);
  await bag.close();
  expect(kinds).toEqual(['acquisition-started', 'acquisition-failed', 'disposal-started', 'disposal-completed']);
});

test('close runs projection ownership, then the service disposer, then pushed disposers last-pushed-first', async () => {
  const events: string[] = [];
  const gate = deferred<void>();
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.providerWithDisposal({ provider: DiBag.providerWithTransformedService({ provider: DiBag.providerWithDisposal({ provider: DiBag.createProvider(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { events.push('pool.end'); });
      factoryCtx.pushDisposer(() => { events.push('socket.close'); });
      return 'session';
    }, { factoryReceivesContext: true }), disposeService: () => { events.push('session.close'); } }), transformService: async () => { await gate.promise; return 'projected'; }, callbackReceives: 'fulfilled-value' }), disposeService: () => { events.push('projected.dispose'); } }),
  }).buildContainer();
  const pending = bag.resolve('service');
  const closing = bag.close();
  await tick();
  gate.resolve();
  await pending;
  await closing;
  expect(events).toEqual(['projected.dispose', 'session.close', 'socket.close', 'pool.end']);
});

test('failure before return runs the stack last-pushed-first before close', async () => {
  const events: string[] = [];
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.providerWithDisposal({ provider: DiBag.createProvider(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { events.push('pool.end'); });
      factoryCtx.pushDisposer(() => { events.push('socket.close'); });
      throw new Error('handshake');
    }, { factoryReceivesContext: true }), disposeService: () => { events.push('session.close'); } }),
  }).buildContainer();
  await expect(bag.resolve('service')).rejects.toThrow('handshake');
  await tick();
  expect(events).toEqual(['socket.close', 'pool.end']);
  await bag.close();
  expect(events).toEqual(['socket.close', 'pool.end']);
});

test('a direct projection over a source that later fulfils accepts the stack into ownership', async () => {
  const events: string[] = [];
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.providerWithDisposal({ provider: DiBag.providerWithTransformedService({ provider: DiBag.createProvider(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { events.push('pool.end'); });
      await Promise.resolve();
      factoryCtx.pushDisposer(() => { events.push('socket.close'); });
      return 'session';
    }, { factoryReceivesContext: true }), transformService: promise => ({ wrapped: promise }), callbackReceives: 'exposed-service' }), disposeService: () => { events.push('wrapper.dispose'); } }),
  }).buildContainer();
  expect(await bag.resolve('service').wrapped).toBe('session');
  await tick();
  expect(bag.serviceSnapshot('service').acquisitions[0]!.state).toBe('ready');
  await bag.close();
  expect(events).toEqual(['wrapper.dispose', 'socket.close', 'pool.end']);
});

test('a pushed stack alone makes the attempt owned', async () => {
  const events: string[] = [];
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.providerWithTransformedService({ provider: DiBag.createProvider(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { events.push('pool.end'); });
      return 1;
    }, { factoryReceivesContext: true }), transformService: promise => ({ wrapped: promise }), callbackReceives: 'exposed-service' }),
  }).buildContainer();
  await bag.resolve('service').wrapped;
  await tick();
  await bag.close();
  expect(events).toEqual(['pool.end']);
});

test('every successful transient attempt keeps its stack until close', async () => {
  const events: string[] = [];
  let attempts = 0;
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.providerWithLifetime({ provider: DiBag.createProvider((_deps: {}, factoryCtx) => {
      const index = attempts++;
      factoryCtx.pushDisposer(() => { events.push(`end${index}`); });
      return index;
    }, { factoryReceivesContext: true }), lifetime: 'transient:one-per-resolve' }),
  }).buildContainer();
  bag.resolve('service');
  bag.resolve('service');
  bag.resolve('service');
  expect(bag.serviceSnapshot('service').acquisitions).toHaveLength(3);
  await bag.close();
  expect(events).toEqual(['end2', 'end1', 'end0']);
});

test('a consumer disposes its stages and stack before its dependency starts', async () => {
  const events: string[] = [];
  const bag = DiBag.createBuilder().withServices({
    dep: DiBag.providerWithDisposal({ provider: DiBag.createProvider((_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { events.push('dep.stack'); });
      return 'dep';
    }, { factoryReceivesContext: true }), disposeService: () => { events.push('dep.service'); } }),
    consumer: DiBag.providerWithDisposal({ provider: DiBag.createProvider(({ dep }: { dep: string }, factoryCtx) => {
      factoryCtx.pushDisposer(() => { events.push('consumer.stack'); });
      return `${dep}!`;
    }, { factoryReceivesContext: true }), disposeService: () => { events.push('consumer.service'); } }),
  }).buildContainer();
  bag.resolve('consumer');
  await bag.close();
  expect(events).toEqual(['consumer.service', 'consumer.stack', 'dep.service', 'dep.stack']);
});

test('startup rollback releases the stack of a service that had already succeeded', async () => {
  const events: string[] = [];
  const failure = await DiBag.createBuilder().withServices({
    a: DiBag.createProvider((_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { events.push('a.stack'); });
      return 'a';
    }, { factoryReceivesContext: true }),
    b: DiBag.createProvider(async ({ a }: { a: string }, factoryCtx) => {
      void a;
      factoryCtx.pushDisposer(() => { throw new Error('b.stack failed'); });
      throw new Error('b');
    }, { factoryReceivesContext: true }),
  }).buildContainer().ensureServicesReady(['a', 'b']).then(() => undefined, (error: unknown) => error);
  expect(events).toEqual(['a.stack']);
  expect((failure as DiBagServiceReadinessError).disposalFailures.map(item => (item.error as Error).message)).toEqual(['b.stack failed']);
});

test('a factory that succeeds while the bag is closing still has its stack disposed', async () => {
  const events: string[] = [];
  const gate = deferred<void>();
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.createProvider(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { events.push('pool.end'); });
      await gate.promise;
      return 'ok';
    }, { factoryReceivesContext: true }),
  }).buildContainer();
  const pending = bag.resolve('service');
  const closing = bag.close();
  await tick();
  gate.resolve();
  await pending;
  await closing;
  expect(events).toEqual(['pool.end']);
});

const pushing = (events: string[], name: string) => DiBag.providerWithDisposal({ provider: DiBag.createProvider((_deps: {}, factoryCtx) => {
  factoryCtx.pushDisposer(() => { events.push(`${name}.stack`); });
  return name;
}, { factoryReceivesContext: true }), disposeService: () => { events.push(`${name}.service`); } });

test('a root service acquired through a child owns its stack on the root', async () => {
  const events: string[] = [];
  const root = DiBag.createBuilder().withServices({ rooted: DiBag.providerWithLifetime({ provider: pushing(events, 'root'), lifetime: 'singleton:one-per-container-tree' }), scoped: pushing(events, 'scoped') }).buildContainer();
  const child = root.createChildContainer();
  child.resolve('rooted');
  child.resolve('scoped');
  await child.close();
  expect(events).toEqual(['scoped.service', 'scoped.stack']);
  await root.close();
  expect(events).toEqual(['scoped.service', 'scoped.stack', 'root.service', 'root.stack']);
});

test('a fork owns the stacks of its own acquisitions', async () => {
  const events: string[] = [];
  const root = DiBag.createBuilder().withServices({ service: pushing(events, 'service') }).buildContainer();
  const fork = root.createIndependentContainer([], {});
  fork.resolve('service');
  await root.close();
  expect(events).toEqual([]);
  await fork.close();
  expect(events).toEqual(['service.service', 'service.stack']);
});

test('a binding shared to the parent owns its stack on the parent', async () => {
  const events: string[] = [];
  const root = DiBag.createBuilder().withServices({ a: pushing(events, 'a'), b: pushing(events, 'b') }).buildContainer();
  const child = root.createChildContainer({ sharedParentServiceKeys: ['a'] });
  child.resolve('a');
  child.resolve('b');
  await child.close();
  expect(events).toEqual(['b.service', 'b.stack']);
  await root.close();
  expect(events).toEqual(['b.service', 'b.stack', 'a.service', 'a.stack']);
});

test('pushed disposers learn that no service disposer exists', async () => {
  const reasons: string[] = [];
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.createProvider((_deps: {}, factoryCtx) => { factoryCtx.pushDisposer(disposerCtx => { reasons.push(disposerCtx.reason); }); return 1; }, { factoryReceivesContext: true }),
  }).buildContainer();
  bag.resolve('service');
  await bag.close();
  expect(reasons).toEqual(['no-service-disposer']);
});

test('pushed disposers learn that the service disposer succeeded', async () => {
  const reasons: string[] = [];
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.providerWithDisposal({ provider: DiBag.providerWithTransformedService({ provider: DiBag.providerWithDisposal({ provider: DiBag.createProvider((_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(disposerCtx => { reasons.push(disposerCtx.reason); });
      return 1;
    }, { factoryReceivesContext: true }), disposeService: () => {} }), transformService: value => value, callbackReceives: 'exposed-service' }), disposeService: () => {} }),
  }).buildContainer();
  bag.resolve('service');
  await bag.close();
  expect(reasons).toEqual(['service-disposed']);
});

test('pushed disposers learn that the service disposer threw and still run', async () => {
  const reasons: string[] = [];
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.providerWithDisposal({ provider: DiBag.providerWithTransformedService({ provider: DiBag.providerWithDisposal({ provider: DiBag.createProvider((_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(disposerCtx => { reasons.push(disposerCtx.reason); });
      return 1;
    }, { factoryReceivesContext: true }), disposeService: () => { throw new Error('inner'); } }), transformService: value => value, callbackReceives: 'exposed-service' }), disposeService: () => {} }),
  }).buildContainer();
  bag.resolve('service');
  const failure = await bag.close().then(() => undefined, (error: unknown) => error);
  expect(failure).toBeInstanceOf(DiBagDisposalError);
  expect((failure as DiBagDisposalError).failures).toHaveLength(1);
  expect(reasons).toEqual(['service-disposal-failed']);
});

test('the recommended reason check releases a resource the service owns exactly once', async () => {
  const closes: string[] = [];
  const socket = { closed: false, close() { if (this.closed) throw new Error('double close'); this.closed = true; closes.push('socket'); } };
  const bag = DiBag.createBuilder().withServices({
    session: DiBag.providerWithDisposal({ provider: DiBag.createProvider((_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(disposerCtx => { if (disposerCtx.reason !== 'service-disposed') socket.close(); });
      return { close: () => socket.close() };
    }, { factoryReceivesContext: true }), disposeService: session => session.close() }),
  }).buildContainer();
  bag.resolve('session');
  await bag.close();
  expect(closes).toEqual(['socket']);
});

test('a successful acquisition reports one cleanup pair at close covering stages and stack', async () => {
  const kinds: string[] = [];
  const Observed = DiBag.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent: event => { if (!event.kind.startsWith('container')) kinds.push(event.kind); }, onObserverFailure: () => {} }] });
  const bag = Observed.createBuilder().withServices({
    service: Observed.providerWithDisposal({ provider: Observed.createProvider((_deps: {}, factoryCtx) => { factoryCtx.pushDisposer(() => {}); return 1; }, { factoryReceivesContext: true }), disposeService: () => {} }),
  }).buildContainer();
  bag.resolve('service');
  await bag.close();
  expect(kinds).toEqual(['acquisition-started', 'acquisition-ready', 'disposal-started', 'disposal-completed']);
});

test('a direct projection whose source fails reports a rollback run and, at close, a disposal run', async () => {
  const kinds: string[] = [];
  const Observed = DiBag.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent: event => { if (!event.kind.startsWith('container')) kinds.push(event.kind); }, onObserverFailure: () => {} }] });
  const bag = Observed.createBuilder().withServices({
    service: Observed.providerWithDisposal({ provider: Observed.providerWithTransformedService({ provider: Observed.createProvider(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => {});
      await Promise.resolve();
      throw new Error('source');
    }, { factoryReceivesContext: true }), transformService: promise => ({ wrapped: promise }), callbackReceives: 'exposed-service' }), disposeService: () => {} }),
  }).buildContainer();
  await expect(bag.resolve('service').wrapped).rejects.toThrow('source');
  await tick();
  expect(kinds).toEqual(['acquisition-started', 'acquisition-ready', 'disposal-started', 'disposal-completed']);
  await bag.close();
  expect(kinds).toEqual(['acquisition-started', 'acquisition-ready', 'disposal-started', 'disposal-completed', 'disposal-started', 'disposal-completed']);
});

test('a bounded close reports an in-flight rollback as pending', async () => {
  const gate = deferred<void>();
  const bag = DiBag.createBuilder().withServices({
    service: DiBag.providerWithTransformedService({ provider: DiBag.createProvider(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => gate.promise);
      await Promise.resolve();
      throw new Error('source');
    }, { factoryReceivesContext: true }), transformService: promise => ({ wrapped: promise }), callbackReceives: 'exposed-service' }),
  }).buildContainer();
  await expect(bag.resolve('service').wrapped).rejects.toThrow('source');
  const failure = await bag.close({ waitTimeoutMs: 5 }).then(() => undefined, (error: unknown) => error);
  expect(failure).toBeInstanceOf(DiBagCloseCancelledError);
  expect((failure as DiBagCloseCancelledError).details.disposersStillRunning).toEqual(['service']);
  gate.resolve();
  await (failure as DiBagCloseCancelledError).disposalPromise;
});

const strictSocket = (closes: string[]) => ({ closed: false, close() { if (this.closed) throw new Error('double close'); this.closed = true; closes.push('socket'); } });

test("a projection owner does not stand in for the returned value's disposer", async () => {
  const closes: string[] = [];
  const socket = strictSocket(closes);
  const bag = DiBag.createBuilder().withServices({
    session: DiBag.providerWithDisposal({ provider: DiBag.providerWithTransformedService({ provider: DiBag.createProvider((_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(disposerCtx => { if (disposerCtx.reason !== 'service-disposed') socket.close(); });
      return { close: () => socket.close() };
    }, { factoryReceivesContext: true }), transformService: session => ({ wrapped: session }), callbackReceives: 'exposed-service' }), disposeService: () => { closes.push('wrapper'); } }),
  }).buildContainer();
  bag.resolve('session');
  await bag.close();
  // The consumer's wrapper knows nothing of the socket, so it must not read as the service disposer.
  expect(closes).toEqual(['wrapper', 'socket']);
});

test("a failing projection disposer does not make the returned value's disposer look failed", async () => {
  const closes: string[] = [];
  const socket = strictSocket(closes);
  const bag = DiBag.createBuilder().withServices({
    session: DiBag.providerWithDisposal({ provider: DiBag.providerWithTransformedService({ provider: DiBag.providerWithDisposal({ provider: DiBag.createProvider((_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(disposerCtx => { if (disposerCtx.reason !== 'service-disposed') socket.close(); });
      return { close: () => socket.close() };
    }, { factoryReceivesContext: true }), disposeService: session => session.close() }), transformService: session => ({ session }), callbackReceives: 'exposed-service' }), disposeService: () => { throw new Error('projection disposer failed'); } }),
  }).buildContainer();
  bag.resolve('session');
  const failure = await bag.close().then(() => undefined, (error: unknown) => error);
  expect(closes).toEqual(['socket']);
  expect((failure as DiBagDisposalError).failures.map(item => (item.error as Error).message)).toEqual(['projection disposer failed']);
});

test('under a projection the rollback pair precedes acquisition-failed', async () => {
  const kinds: string[] = [];
  const Observed = DiBag.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent: event => { if (!event.kind.startsWith('container')) kinds.push(event.kind); }, onObserverFailure: () => {} }] });
  const bag = Observed.createBuilder().withServices({
    service: Observed.providerWithTransformedService({ provider: Observed.createProvider(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => {});
      await Promise.resolve();
      throw new Error('source');
    }, { factoryReceivesContext: true }), transformService: value => value, callbackReceives: 'fulfilled-value' }),
  }).buildContainer();
  await expect(bag.resolve('service') as Promise<unknown>).rejects.toThrow('source');
  await tick();
  // The rollback is anchored on the source; acquisition-failed waits for the projected result.
  expect(kinds).toEqual(['acquisition-started', 'disposal-started', 'acquisition-failed', 'disposal-completed']);
  await bag.close();
  expect(kinds).toEqual(['acquisition-started', 'disposal-started', 'acquisition-failed', 'disposal-completed']);
});
