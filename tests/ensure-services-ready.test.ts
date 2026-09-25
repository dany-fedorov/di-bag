import { expect, test } from 'bun:test';
import { getEventListeners } from 'node:events';
import { DiBag, DiBagDisposalError, DiBagServiceReadinessCancelledError, DiBagServiceReadinessError } from '../src';
import { deferred } from './helpers';

const turn = () => new Promise<void>(resolve => setImmediate(resolve));

test('ensureServicesReady resolves to the same bag once the listed services are ready and leaves the rest lazy', async () => {
  const gate = deferred<number>();
  let mailerCalls = 0;
  const bag = DiBag.createBuilder().withServices({
    db: () => gate.promise,
    mailer: () => ++mailerCalls,
  }).buildContainer();
  const ensuring = bag.ensureServicesReady(['db']);
  let ready = false;
  void ensuring.then(() => { ready = true; });
  await turn();
  expect(ready).toBe(false);
  gate.resolve(7);
  expect(await ensuring).toBe(bag);
  expect(bag.resolve('db')).toBe(gate.promise);
  expect(mailerCalls).toBe(0);
  await bag.close();
});

test('ensureServicesReady accepts typed tokens, duplicates and an empty tuple', async () => {
  const key = Symbol('port');
  const port = DiBag.createToken(key).forService<number>();
  let calls = 0;
  const bag = DiBag.createBuilder().withTokenService(port, () => ++calls).withServices({ name: () => 'api' }).buildContainer();
  expect(await bag.ensureServicesReady([])).toBe(bag);
  expect(calls).toBe(0);
  await bag.ensureServicesReady([port, 'name', port]);
  expect(calls).toBe(1);
  expect(bag.resolve(port)).toBe(1);
  await bag.close();
});

test('repeated readiness calls reuse cached services and may add more', async () => {
  let calls = 0;
  const bag = DiBag.createBuilder().withServices({ a: () => ++calls, b: () => 'b' }).buildContainer();
  await bag.ensureServicesReady(['a']);
  await bag.ensureServicesReady(['a', 'b']);
  expect(calls).toBe(1);
  expect(bag.resolve('b')).toBe('b');
  await bag.close();
});

test('maxConcurrentServiceKeys 1 acquires the listed services one after another in tuple order', async () => {
  const gate = deferred<number>();
  const calls: string[] = [];
  const bag = DiBag.createBuilder().withServices({
    first: () => { calls.push('first'); return gate.promise; },
    second: () => { calls.push('second'); return 2; },
  }).buildContainer();
  const ensuring = bag.ensureServicesReady(['first', 'second'], { maxConcurrentServiceKeys: 1 });
  expect(calls).toEqual(['first']);
  gate.resolve(1);
  await ensuring;
  expect(calls).toEqual(['first', 'second']);
  await bag.close();
});

test('an omitted bound acquires every listed service at once', async () => {
  const gate = deferred<number>();
  const calls: string[] = [];
  const bag = DiBag.createBuilder().withServices({
    first: () => { calls.push('first'); return gate.promise; },
    second: () => { calls.push('second'); return 2; },
  }).buildContainer();
  const ensuring = bag.ensureServicesReady(['first', 'second']);
  expect(calls).toEqual(['first', 'second']);
  gate.resolve(1);
  await ensuring;
  await bag.close();
});

test('a child scope is made ready and resolves to that scope', async () => {
  const parent = DiBag.createBuilder().withServices({ session: () => ({ id: Math.random() }) }).buildContainer();
  const child = parent.createChildContainer();
  expect(await child.ensureServicesReady(['session'])).toBe(child);
  expect(child.resolve('session')).not.toBe(parent.resolve('session'));
  await parent.close();
});

test('a failed readiness call on a child scope closes that scope only', async () => {
  const cause = new Error('session store offline');
  const disposed: string[] = [];
  const parent = DiBag.createBuilder().withServices({
    pool: DiBag.providerWithDisposal({ provider: () => ({ name: 'pool' }), disposeService: () => { disposed.push('pool'); } }),
    cache: DiBag.providerWithDisposal({ provider: () => ({ name: 'cache' }), disposeService: () => { disposed.push('cache'); } }),
    session: DiBag.providerWithDisposal({ provider: ({ pool }: { pool: { name: string } }) => ({ owner: pool.name }), disposeService: () => { disposed.push('session'); } }),
    broken: (): number => { throw cause; },
  }).buildContainer();
  const parentCache = parent.resolve('cache');
  const child = parent.createChildContainer({ sharedParentServiceKeys: ['cache'] });
  const error: unknown = await child.ensureServicesReady(['session', 'cache', 'broken'], { maxConcurrentServiceKeys: 1 }).catch(caught => caught);
  expect(error).toBeInstanceOf(DiBagServiceReadinessError);
  if (!(error instanceof DiBagServiceReadinessError)) throw error;
  expect(error.cause).toBe(cause);
  expect(disposed).toEqual(['session', 'pool']);
  expect(() => child.resolve('session')).toThrow('DI_BAG_CLOSED');
  expect(parent.resolve('cache')).toBe(parentCache);
  expect(parent.resolve('pool')).toEqual({ name: 'pool' });
  await parent.close();
  expect(disposed.slice(2).sort()).toEqual(['cache', 'pool']);
});

test('an independent fork is made ready and closed on its own', async () => {
  const app = DiBag.createBuilder().withServices({
    clock: () => ({ now: () => 42 }),
    stamp: ({ clock }: { clock: { now(): number } }) => clock.now(),
  }).buildContainer();
  const forked = app.createIndependentContainer(['clock'], { clock: () => ({ now: () => 7 }) });
  expect(await forked.ensureServicesReady(['stamp'])).toBe(forked);
  expect(forked.resolve('stamp')).toBe(7);
  await forked.close();
  expect(app.resolve('stamp')).toBe(42);
  await app.close();
});

test('a factory failure closes this bag and reports disposal failures', async () => {
  const cause = new Error('offline');
  const disposalFailure = new Error('dispose');
  const calls: string[] = [];
  const bag = DiBag.createBuilder().withServices({
    owned: DiBag.providerWithDisposal({ provider: () => { calls.push('owned'); return 1; }, disposeService: () => { throw disposalFailure; } }),
    db: (): number => { calls.push('db'); throw cause; },
    queued: () => { calls.push('queued'); return 3; },
  }).buildContainer();
  const error: unknown = await bag.ensureServicesReady(['owned', 'db', 'queued'], { maxConcurrentServiceKeys: 1 }).catch(caught => caught);
  expect(error).toBeInstanceOf(DiBagServiceReadinessError);
  if (!(error instanceof DiBagServiceReadinessError)) throw error;
  expect(error.name).toBe('DiBagServiceReadinessError');
  expect(error.code).toBe('DI_BAG_SERVICE_READINESS_FAILED');
  expect(error.cause).toBe(cause);
  expect(error.disposalFailures.map(failure => failure.error)).toEqual([disposalFailure]);
  expect(Object.isFrozen(error.disposalFailures)).toBe(true);
  expect(error.disposalError).toBeInstanceOf(DiBagDisposalError);
  expect(error.details).toEqual({ operation: 'ensureServicesReady', disposalFailures: error.disposalFailures });
  expect(error.message).toContain('DI_BAG_SERVICE_READINESS_FAILED: The listed services are not ready: a factory failed; this bag is closed;');
  expect(error.message).toContain('#di-bag-service-readiness-failed');
  expect(calls).toEqual(['owned', 'db']);
  expect(() => bag.resolve('owned')).toThrow('DI_BAG_CLOSED');
});

test('a timeout names the services that were still pending and closes the bag', async () => {
  const gate = deferred<number>();
  const bag = DiBag.createBuilder().withServices({ fast: () => 1, slow: () => gate.promise }).buildContainer();
  const error: unknown = await bag.ensureServicesReady(['fast', 'slow'], { totalTimeoutMs: 5 }).catch(caught => caught);
  expect(error).toBeInstanceOf(DiBagServiceReadinessCancelledError);
  if (!(error instanceof DiBagServiceReadinessCancelledError)) throw error;
  expect(error.name).toBe('DiBagServiceReadinessCancelledError');
  expect(error.reason).toBe('timeout');
  expect(error.code).toBe('DI_BAG_SERVICE_READINESS_CANCELLED');
  expect(error.details).toEqual({ operation: 'ensureServicesReady', reason: 'timeout', totalTimeoutMs: 5, disposersStillRunning: [], acquisitionsStillPending: ['slow'] });
  expect(error.message).toContain('The listed services were not ready: the wait timed out after 5ms; acquisitions still pending: slow; this bag is closing;');
  const cause = error.cause as { name: string; code?: string; details?: unknown };
  expect(cause.name).toBe('TimeoutError');
  expect(cause.code).toBe('DI_BAG_SERVICE_READINESS_TIMEOUT');
  expect(cause.details).toEqual({ operation: 'ensureServicesReady', totalTimeoutMs: 5 });
  expect(() => bag.resolve('fast')).toThrow(/DI_BAG_CLOS/);
  gate.resolve(1);
  await error.disposalPromise;
  expect(() => bag.resolve('fast')).toThrow('DI_BAG_CLOSED');
});

test('an abort rejects promptly with the abort reason and settles disposalPromise after cleanup', async () => {
  const gate = deferred<number>();
  const controller = new AbortController();
  const reason = new Error('shutting down');
  const disposed: number[] = [];
  const bag = DiBag.createBuilder().withServices({
    slow: DiBag.providerWithDisposal({ provider: () => gate.promise, disposeService: value => { disposed.push(value); } }),
  }).buildContainer();
  const outcome = bag.ensureServicesReady(['slow'], { abortSignal: controller.signal }).catch(caught => caught);
  expect(getEventListeners(controller.signal, 'abort')).toHaveLength(1);
  controller.abort(reason);
  const error: unknown = await outcome;
  expect(error).toBeInstanceOf(DiBagServiceReadinessCancelledError);
  if (!(error instanceof DiBagServiceReadinessCancelledError)) throw error;
  expect(error.reason).toBe('aborted');
  expect(error.cause).toBe(reason);
  expect(error.details).toEqual({ operation: 'ensureServicesReady', reason: 'aborted', disposersStillRunning: [], acquisitionsStillPending: ['slow'] });
  expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
  expect(disposed).toEqual([]);
  gate.resolve(9);
  await error.disposalPromise;
  expect(disposed).toEqual([9]);
});

test('an already aborted signal closes the bag and runs no factory', async () => {
  const controller = new AbortController();
  const reason = { cancelled: true };
  controller.abort(reason);
  let calls = 0;
  const bag = DiBag.createBuilder().withServices({ value: () => ++calls }).buildContainer();
  const error: unknown = await bag.ensureServicesReady(['value'], { abortSignal: controller.signal }).catch(caught => caught);
  expect(error).toBeInstanceOf(DiBagServiceReadinessCancelledError);
  if (!(error instanceof DiBagServiceReadinessCancelledError)) throw error;
  expect(error.cause).toBe(reason);
  await error.disposalPromise;
  expect(calls).toBe(0);
  expect(() => bag.resolve('value')).toThrow('DI_BAG_CLOSED');
});

test('after success the abort listener and the timer are gone and a later abort does not close the bag', async () => {
  const controller = new AbortController();
  const bag = DiBag.createBuilder().withServices({ value: () => 1 }).buildContainer();
  await bag.ensureServicesReady(['value'], { abortSignal: controller.signal, totalTimeoutMs: 2 ** 32 });
  expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
  controller.abort();
  expect(bag.resolve('value')).toBe(1);
  await bag.close();
});

test('invalid input rejects before any factory runs and leaves the bag usable', async () => {
  let effects = 0;
  const bag = DiBag.createBuilder().withServices({ value: () => ++effects }).buildContainer();
  const ensure = bag.ensureServicesReady.bind(bag) as (...args: unknown[]) => Promise<unknown>;
  const invalidOptions: readonly (readonly [unknown, string, string])[] = [
    [null, 'options', 'an object'], [[], 'options', 'an object'], [true, 'options', 'an object'],
    [{ totalTimeoutMs: 0 }, 'totalTimeoutMs', 'a finite positive number'], [{ totalTimeoutMs: -1 }, 'totalTimeoutMs', 'a finite positive number'],
    [{ totalTimeoutMs: Infinity }, 'totalTimeoutMs', 'a finite positive number'], [{ totalTimeoutMs: NaN }, 'totalTimeoutMs', 'a finite positive number'],
    [{ totalTimeoutMs: '1' }, 'totalTimeoutMs', 'a finite positive number'],
    [{ maxConcurrentServiceKeys: 0 }, 'maxConcurrentServiceKeys', 'a positive safe integer'],
    [{ maxConcurrentServiceKeys: -1 }, 'maxConcurrentServiceKeys', 'a positive safe integer'],
    [{ maxConcurrentServiceKeys: 0.5 }, 'maxConcurrentServiceKeys', 'a positive safe integer'],
    [{ maxConcurrentServiceKeys: NaN }, 'maxConcurrentServiceKeys', 'a positive safe integer'],
    [{ maxConcurrentServiceKeys: Infinity }, 'maxConcurrentServiceKeys', 'a positive safe integer'],
    [{ maxConcurrentServiceKeys: Number.MAX_SAFE_INTEGER + 1 }, 'maxConcurrentServiceKeys', 'a positive safe integer'],
    [{ maxConcurrentServiceKeys: 'serial' }, 'maxConcurrentServiceKeys', 'a positive safe integer'],
    [{ abortSignal: {} }, 'abortSignal', 'an AbortSignal'],
    [{ timeoutMs: 1 }, 'options', 'only the own properties: abortSignal, totalTimeoutMs, maxConcurrentServiceKeys'],
    [{ signal: new AbortController().signal }, 'options', 'only the own properties: abortSignal, totalTimeoutMs, maxConcurrentServiceKeys'],
    [{ startupOrder: 'sequential' }, 'options', 'only the own properties: abortSignal, totalTimeoutMs, maxConcurrentServiceKeys'],
    [{ other: true, get totalTimeoutMs() { effects++; return 1; } }, 'options', 'only the own properties: abortSignal, totalTimeoutMs, maxConcurrentServiceKeys'],
    [Object.create({ totalTimeoutMs: 1 }), 'options', 'only the own properties: abortSignal, totalTimeoutMs, maxConcurrentServiceKeys'],
  ];
  for (const [options, argument, expected] of invalidOptions) {
    const error = await ensure(['value'], options).catch((caught: unknown) => caught) as { code?: string; message?: string; details?: unknown };
    expect(error.code).toBe('DI_BAG_INVALID_ARGUMENT');
    expect(error.details).toEqual({ operation: 'ensureServicesReady', argument, expected });
    expect(error.message).toContain('ensureServicesReady');
  }
  const bound = await ensure(['value'], { maxConcurrentServiceKeys: 0 }).catch((caught: unknown) => caught) as { message: string; details: unknown };
  expect(bound.message).toContain('ensureServicesReady maxConcurrentServiceKeys must be a positive safe integer');
  expect(bound.details).toEqual({ operation: 'ensureServicesReady', argument: 'maxConcurrentServiceKeys', expected: 'a positive safe integer' });
  for (const keys of [undefined, 'value', [null], ['missing'], [{ key: Symbol('fake') }]]) {
    await expect(ensure(keys)).rejects.toThrow();
  }
  expect(effects).toBe(0);
  expect(bag.resolve('value')).toBe(1);
  await bag.ensureServicesReady(['value'], { maxConcurrentServiceKeys: Number.MAX_SAFE_INTEGER });
  await bag.close();
});

test('a closing or closed bag rejects with its state code', async () => {
  const bag = DiBag.createBuilder().withServices({ value: () => 1 }).buildContainer();
  await bag.close();
  const error = await bag.ensureServicesReady(['value']).catch((caught: unknown) => caught) as { code?: string };
  expect(error.code).toBe('DI_BAG_CLOSED');
});

test('the readiness errors carry their code, their details and a message that says what happened to the bag', () => {
  const cause = new Error('offline');
  const failed = new DiBagServiceReadinessError(cause, []);
  expect(failed.name).toBe('DiBagServiceReadinessError');
  expect(failed.code).toBe('DI_BAG_SERVICE_READINESS_FAILED');
  expect(failed.cause).toBe(cause);
  expect(failed.message).toContain('The listed services are not ready: a factory failed; this bag is closed;');
  const cancelled = new DiBagServiceReadinessCancelledError('timeout', cause, Promise.resolve(), { disposersStillRunning: [], acquisitionsStillPending: ['db'] }, 5);
  expect(cancelled.name).toBe('DiBagServiceReadinessCancelledError');
  expect(cancelled.code).toBe('DI_BAG_SERVICE_READINESS_CANCELLED');
  expect(cancelled.details).toEqual({ operation: 'ensureServicesReady', reason: 'timeout', totalTimeoutMs: 5, disposersStillRunning: [], acquisitionsStillPending: ['db'] });
  expect(cancelled.message).toContain('the wait timed out after 5ms; acquisitions still pending: db; this bag is closing;');
});

test('the 0.4 startup names are gone at run time', async () => {
  const api = await import('../src/index.js') as Record<string, unknown>;
  expect('buildAndStart' in DiBag.createBuilder()).toBe(false);
  expect(api.DiBagStartupError).toBeUndefined();
  expect(api.DiBagStartupCancelledError).toBeUndefined();
});
