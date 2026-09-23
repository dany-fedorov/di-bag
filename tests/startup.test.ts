import { expect, test } from 'bun:test';
import * as api from '../src';
import { DiBag as Core } from '../src';
import { deferred } from './helpers';
import { getEventListeners } from 'node:events';

const { DiBag, DiBagCleanupError, DiBagServiceReadinessError, DiBagServiceReadinessCancelledError } = api;

test('contexts follow acquisition owners through child-first roots and independent forks', async () => {
  const root = DiBag.createBuilder().withServices({
    scoped: DiBag.fromFactory((_deps: {}, factoryCtx) => factoryCtx, { context: 'acquisition' }),
    root: DiBag.withLifetime(DiBag.fromFactory((_deps: {}, factoryCtx) => factoryCtx, { context: 'acquisition' }), 'root'),
    transient: DiBag.withLifetime(DiBag.fromFactory((_deps: {}, factoryCtx) => factoryCtx, { context: 'acquisition' }), 'transient'),
  }).buildContainer();
  const child = root.createChildContainer();
  const sibling = root.createChildContainer();
  const fork = child.createIndependentContainer();
  const rootContext = child.resolve('root');
  const childContext = child.resolve('scoped');
  const siblingContext = sibling.resolve('scoped');
  const forkContext = fork.resolve('root');
  // Each acquisition owns its context object; the cancellation signal is the owner's.
  expect(rootContext.signal).toBe(root.resolve('scoped').signal);
  expect(child.resolve('transient').signal).toBe(childContext.signal);
  expect(Object.isFrozen(childContext)).toBe(true);
  expect(childContext.signal.aborted).toBe(false);
  await child.close();
  expect(childContext.signal.aborted).toBe(true);
  expect(rootContext.signal.aborted).toBe(false);
  expect(siblingContext.signal.aborted).toBe(false);
  await root.close();
  expect(rootContext.signal.aborted).toBe(true);
  expect(siblingContext.signal.aborted).toBe(true);
  expect(forkContext.signal.aborted).toBe(false);
  await fork.close();
});

test('abort listeners cannot reenter any closing scope admission gate', async () => {
  const root = DiBag.createBuilder().withServices({ context: DiBag.fromFactory((_deps: {}, factoryCtx) => factoryCtx, { context: 'acquisition' }) }).buildContainer();
  const child = root.createChildContainer();
  const sibling = root.createChildContainer();
  let called = false;
  child.resolve('context').signal.addEventListener('abort', () => {
    called = true;
    for (const bag of [root, child, sibling]) expect(() => bag.resolve('context')).toThrow(/clos/);
  });
  await root.close();
  expect(called).toBe(true);
});

test('startup waits for selected native acquisition while leaving unrelated providers lazy', async () => {
  const gate = deferred<number>();
  let calls = 0;
  let lazy = 0;
  const starting = DiBag.createBuilder().withServices({
    service: () => { calls++; return gate.promise; },
    lazy: () => ++lazy,
  }).buildContainer().ensureServicesReady(['service', 'service']);
  let ready = false;
  void starting.then(() => { ready = true; });
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(calls).toBe(1);
  expect(ready).toBe(false);
  gate.resolve(42);
  const bag = await starting;
  expect(bag.resolve('service')).toBe(gate.promise);
  expect(lazy).toBe(0);
  await bag.close();
});

test('startup uses native observation with shadowed then and treats raw promises as ready', async () => {
  const native = deferred<number>();
  Object.defineProperty(native.promise, 'then', { value: undefined });
  const raw = deferred<number>();
  const disposed: unknown[] = [];
  const starting = Core.createBuilder().withServices({
    native: Core.fromFactory((_deps: {}, _factoryCtx) => native.promise, { context: 'acquisition', ...{ acquisitionMode: 'nativePromise' } }),
    raw: Core.withDisposal(Core.fromFactory(() => raw.promise, { acquisitionMode: 'raw' }), value => { disposed.push(value); }),
  }).buildContainer().ensureServicesReady(['native', 'raw']);
  let ready = false;
  void starting.then(() => { ready = true; });
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(ready).toBe(false);
  native.resolve(1);
  const bag = await starting;
  expect(bag.resolve('native')).toBe(native.promise);
  await bag.close();
  expect(disposed).toEqual([raw.promise]);
});

test('a ready native projection starts while its source remains pending until shutdown', async () => {
  const source = deferred<number>();
  const owned: number[] = [];
  const outcome = await DiBag.createBuilder().withServices({
    projected: DiBag.transformService(DiBag.withDisposal(() => source.promise, value => { owned.push(value); }), { mode: 'direct', transform: () => Promise.resolve(42) }),
  }).buildContainer().ensureServicesReady(['projected'], { totalTimeoutMs: 30 }).then(bag => ({ bag }), error => ({ error }));
  source.resolve(7);
  if ('error' in outcome) {
    await outcome.error.disposalPromise;
    throw outcome.error;
  }
  expect(await outcome.bag.resolve('projected')).toBe(42);
  await outcome.bag.close();
  expect(owned).toEqual([7]);
});

test('failed native projection aborts a cooperative pending source before cleanup', async () => {
  const cause = new Error('project');
  const disposed: number[] = [];
  const source = DiBag.withDisposal(DiBag.fromFactory((_deps: {}, factoryCtx) => new Promise<number>(resolve => {
    factoryCtx.signal.addEventListener('abort', () => resolve(7), { once: true });
  }), { context: 'acquisition' }), value => { disposed.push(value); });
  const error: unknown = await DiBag.createBuilder().withServices({
    service: DiBag.transformService(source, { mode: 'direct', transform: () => Promise.reject(cause) }),
  }).buildContainer().ensureServicesReady(['service'], { totalTimeoutMs: 30 }).catch(error => error);
  if (error instanceof DiBagServiceReadinessCancelledError) await error.disposalPromise;
  expect(error).toBeInstanceOf(DiBagServiceReadinessError);
  if (!(error instanceof DiBagServiceReadinessError)) throw error;
  expect(error.cause).toBe(cause);
  expect(disposed).toEqual([7]);
});

test('sequential startup waits before invoking the next selection', async () => {
  const gate = deferred<number>();
  const calls: string[] = [];
  const starting = DiBag.createBuilder().withServices({
    first: () => { calls.push('first'); return gate.promise; },
    second: () => { calls.push('second'); return 2; },
  }).buildContainer().ensureServicesReady(['first', 'second'], { maxConcurrentServiceKeys: 1 });
  expect(calls).toEqual(['first']);
  gate.resolve(1);
  const bag = await starting;
  expect(calls).toEqual(['first', 'second']);
  await bag.close();
});

test('startup selects genuine tokens and keeps separate owned transient attempts', async () => {
  const key = Symbol('selected');
  const token = DiBag.token(key).of<number>();
  let calls = 0;
  const disposed: number[] = [];
  const builder = DiBag.createBuilder().withTokenService(token, DiBag.withLifetime(DiBag.withDisposal(() => ++calls, value => { disposed.push(value); }), 'transient'));
  const bag = await builder.buildContainer().ensureServicesReady([token, token]);
  expect(calls).toBe(2);
  expect(bag.serviceSnapshot(token).acquisitions).toHaveLength(2);
  await bag.close();
  expect(disposed).toEqual([2, 1]);
  const independent = await builder.buildContainer().ensureServicesReady([]);
  expect(calls).toBe(2);
  expect(independent.resolve(token)).toBe(3);
  await independent.close();
});

test('late contextual dependencies receive an already aborted owner signal', async () => {
  const gate = deferred<void>();
  const bag = DiBag.createBuilder().withServices({
    late: DiBag.fromFactory((_deps: {}, factoryCtx) => factoryCtx.signal.aborted, { context: 'acquisition' }),
    first: async (deps: { late: boolean }) => { await gate.promise; return deps.late; },
  }).buildContainer();
  const value = bag.resolve('first');
  const closing = bag.close();
  await Promise.resolve();
  gate.resolve();
  expect(await value).toBe(true);
  await closing;
});

for (const outcome of ['success', 'failure', 'aborted', 'timeout'] as const) test(`startup removes its abort listener on ${outcome}`, async () => {
  const controller = new AbortController();
  const gate = deferred<number>();
  const starting = DiBag.createBuilder().withServices({ service: () => gate.promise }).buildContainer().ensureServicesReady(['service'], { abortSignal: controller.signal, totalTimeoutMs: outcome === 'timeout' ? 5 : 10000 });
  const result = starting.catch(error => error);
  expect(getEventListeners(controller.signal, 'abort')).toHaveLength(1);
  if (outcome === 'success') gate.resolve(1);
  if (outcome === 'failure') gate.reject('failed');
  if (outcome === 'aborted') controller.abort();
  const value = await result;
  expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
  gate.resolve(1);
  if (value instanceof DiBagServiceReadinessCancelledError) await value.disposalPromise;
  else if (outcome === 'success') await value.close();
});

test('startup snapshots option getters once after snapshotting all selected keys', async () => {
  const keys: ['first'] = ['first'];
  let reads = 0;
  const calls: string[] = [];
  const bag = await DiBag.createBuilder().withServices({
    first: () => { calls.push('first'); return 1; },
    second: () => { calls.push('second'); return 2; },
  }).buildContainer().ensureServicesReady(keys, { get maxConcurrentServiceKeys() {
    reads++;
    Reflect.set(keys, 0, 'second');
    return 1;
  } });
  expect(reads).toBe(1);
  expect(calls).toEqual(['first']);
  await bag.close();
});

test('sequential startup stops after failure and waits for cleanup with original causes', async () => {
  const cleanup = deferred<void>();
  const cleanupStarted = deferred<void>();
  const acquisitionError = new Error('acquire');
  const disposalError = new Error('dispose');
  const calls: string[] = [];
  const starting = DiBag.createBuilder().withServices({
    first: DiBag.withDisposal(() => { calls.push('first'); return 1; }, async () => {
      cleanupStarted.resolve(); await cleanup.promise; throw disposalError;
    }),
    fail: () => { calls.push('fail'); throw acquisitionError; },
    last: () => { calls.push('last'); return 2; },
  }).buildContainer().ensureServicesReady(['first', 'fail', 'last'], { maxConcurrentServiceKeys: 1 });
  const outcome = starting.catch(error => error);
  await cleanupStarted.promise;
  let rejected = false;
  void outcome.then(() => { rejected = true; });
  await Promise.resolve();
  expect(rejected).toBe(false);
  cleanup.resolve();
  const error: unknown = await outcome;
  expect(error).toBeInstanceOf(DiBagServiceReadinessError);
  if (!(error instanceof DiBagServiceReadinessError)) throw new Error('expected startup error');
  expect(error.cause).toBe(acquisitionError);
  expect(error.disposalFailures.map(failure => failure.error)).toEqual([disposalError]);
  expect(Object.isFrozen(error.disposalFailures)).toBe(true);
  expect(calls).toEqual(['first', 'fail']);
});

test('parallel startup starts later selections after synchronous failure and cleans pending ownership', async () => {
  const gate = deferred<number>();
  let calls = 0;
  const disposed: number[] = [];
  const starting = DiBag.createBuilder().withServices({
    fail: () => { throw undefined; },
    later: DiBag.withDisposal(() => { calls++; return gate.promise; }, value => { disposed.push(value); }),
  }).buildContainer().ensureServicesReady(['fail', 'later']);
  const outcome = starting.catch(error => error);
  expect(calls).toBe(1);
  gate.resolve(2);
  const error: unknown = await outcome;
  expect(error).toBeInstanceOf(DiBagServiceReadinessError);
  if (!(error instanceof DiBagServiceReadinessError)) throw new Error('expected startup error');
  expect(error.cause).toBeUndefined();
  expect(disposed).toEqual([2]);
});

for (const reason of ['aborted', 'timeout'] as const) test(`${reason} rejects before late ownership and exposes eventual cleanup failure`, async () => {
  const gate = deferred<void>();
  const abort = new AbortController();
  const cause = new Error('abort');
  const cleanupError = new Error('late cleanup');
  const disposed: number[] = [];
  let signal: AbortSignal | undefined;
  const starting = DiBag.createBuilder().withServices({
    value: DiBag.withDisposal(DiBag.fromFactory(async (deps: { late: number }, factoryCtx) => {
      signal = factoryCtx.signal;
      await gate.promise;
      return deps.late;
    }, { context: 'acquisition' }), value => { disposed.push(value); throw cleanupError; }),
    late: () => 42,
  }).buildContainer().ensureServicesReady(['value'], reason === 'aborted' ? { abortSignal: abort.signal } : { totalTimeoutMs: 5 });
  const outcome = starting.catch(error => error);
  if (reason === 'aborted') abort.abort(cause);
  const error: unknown = await outcome;
  expect(error).toBeInstanceOf(DiBagServiceReadinessCancelledError);
  if (!(error instanceof DiBagServiceReadinessCancelledError)) throw new Error('expected cancellation');
  expect(error.reason).toBe(reason);
  if (reason === 'aborted') expect(error.cause).toBe(cause);
  expect(signal?.aborted).toBe(true);
  expect(disposed).toEqual([]);
  gate.resolve();
  const cleanup: unknown = await error.disposalPromise.catch(error => error);
  expect(cleanup).toBeInstanceOf(DiBagCleanupError);
  if (!(cleanup instanceof DiBagCleanupError)) throw new Error('expected cleanup error');
  expect(cleanup.failures[0]!.error).toBe(cleanupError);
  expect(disposed).toEqual([42]);
});

test('already aborted startup does not invoke any factories', async () => {
  const controller = new AbortController();
  const cause = { cancelled: true };
  controller.abort(cause);
  let calls = 0;
  const error: unknown = await DiBag.createBuilder().withServices({ value: () => ++calls }).buildContainer().ensureServicesReady(['value'], { abortSignal: controller.signal }).catch(error => error);
  expect(error).toBeInstanceOf(DiBagServiceReadinessCancelledError);
  if (!(error instanceof DiBagServiceReadinessCancelledError)) throw new Error('expected cancellation');
  expect(error.cause).toBe(cause);
  await error.disposalPromise;
  expect(calls).toBe(0);
});

test('cancellation can interrupt cleanup after ordinary startup failure', async () => {
  const cleanup = deferred<void>();
  const began = deferred<void>();
  const controller = new AbortController();
  const starting = DiBag.createBuilder().withServices({
    owned: DiBag.withDisposal(() => 1, async () => { began.resolve(); await cleanup.promise; }),
    fail: () => { throw new Error('setup'); },
  }).buildContainer().ensureServicesReady(['owned', 'fail'], { abortSignal: controller.signal });
  const outcome = starting.catch(error => error);
  await began.promise;
  controller.abort('stop waiting');
  const error: unknown = await outcome;
  expect(error).toBeInstanceOf(DiBagServiceReadinessCancelledError);
  if (!(error instanceof DiBagServiceReadinessCancelledError)) throw new Error('expected cancellation');
  cleanup.resolve();
  await error.disposalPromise;
});

test('successful startup removes external cancellation and snapshots indexed selections', async () => {
  const controller = new AbortController();
  const calls: string[] = [];
  const keys: ['value'] = ['value'];
  keys[Symbol.iterator] = function* () { throw new Error('do not iterate'); };
  const bag = await DiBag.createBuilder().withServices({
    value: DiBag.fromFactory((_deps: {}, factoryCtx) => { calls.push('value'); return factoryCtx; }, { context: 'acquisition' }),
    hidden: () => { calls.push('hidden'); return 2; },
  }).buildContainer().ensureServicesReady(keys, { abortSignal: controller.signal, totalTimeoutMs: 2 ** 32 });
  controller.abort();
  expect(bag.resolve('value').signal.aborted).toBe(false);
  expect(calls).toEqual(['value']);
  await bag.close();
});

test('invalid startup inputs reject before factory or unsupported option getter effects', async () => {
  let effects = 0;
  const bag = DiBag.createBuilder().withServices({ value: () => ++effects }).buildContainer();
  const start = bag.ensureServicesReady.bind(bag) as (...args: unknown[]) => Promise<unknown>;
  for (const options of [null, [], true, { totalTimeoutMs: 0 }, { totalTimeoutMs: -1 }, { totalTimeoutMs: Infinity }, { totalTimeoutMs: NaN }, { totalTimeoutMs: '1' }, { maxConcurrentServiceKeys: 'serial' }, { abortSignal: {} }, { timeoutMs: 1 }, { startupOrder: 'sequential' }, { other: true, get totalTimeoutMs() { effects++; return 1; } }, Object.create({ totalTimeoutMs: 1 })]) {
    await expect(start(['value'], options)).rejects.toThrow(/ensureServicesReady/);
  }
  for (const keys of [undefined, 'value', [null], ['missing'], [{ key: Symbol('fake') }]]) {
    await expect(start(keys)).rejects.toThrow();
  }
  expect(effects).toBe(0);
  await bag.close();
});
for (const startupOrder of [1, 2, 20]) test(`numeric startup ${startupOrder} bounds selected readiness and preserves promise identity`, async () => {
  const gates = [deferred<number>(), deferred<number>(), deferred<number>()];
  const calls: number[] = [];
  const disposed: number[] = [];
  const provider = (index: number) => DiBag.withDisposal(() => { calls.push(index); return gates[index]!.promise; }, value => { disposed.push(value); });
  const starting = DiBag.createBuilder().withServices({ a: provider(0), b: provider(1), c: provider(2) }).buildContainer().ensureServicesReady(['a', 'b', 'c'], { maxConcurrentServiceKeys: startupOrder });
  const outcome = starting.catch(error => error);
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(calls).toEqual(startupOrder === 1 ? [0] : startupOrder === 2 ? [0, 1] : [0, 1, 2]);
  gates[0]!.resolve(10);
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(calls).toEqual(startupOrder === 1 ? [0, 1] : [0, 1, 2]);
  gates[1]!.resolve(11); gates[2]!.resolve(12);
  const bag = await outcome;
  if (bag instanceof Error) throw bag;
  expect(bag.resolve('a')).toBe(gates[0]!.promise);
  await bag.close();
  expect(disposed).toEqual([12, 11, 10]);
});

for (const startupOrder of [1, 2]) test(`numeric startup ${startupOrder} snapshots options and retains duplicate selected lifetimes`, async () => {
  let reads = 0, scoped = 0, transient = 0;
  const disposed: number[] = [];
  const builder = DiBag.createBuilder().withServices({
    scoped: () => ++scoped,
    transient: DiBag.withLifetime(DiBag.withDisposal(() => ++transient, value => { disposed.push(value); }), 'transient'),
  });
  const bag = await builder.buildContainer().ensureServicesReady(['scoped', 'scoped', 'transient', 'transient'], { get maxConcurrentServiceKeys() { reads++; return startupOrder; } });
  expect(reads).toBe(1); expect(scoped).toBe(1); expect(transient).toBe(2);
  await bag.close(); expect(disposed).toEqual([2, 1]);
  await (await builder.buildContainer().ensureServicesReady([], { maxConcurrentServiceKeys: startupOrder })).close();
});

test('numeric startup uses final raw readiness while owned sources remain pending', async () => {
  const source = deferred<number>();
  let thenReads = 0, later = 0;
  const raw = { get then() { thenReads++; throw new Error('raw then'); } };
  const disposed: number[] = [];
  const bag = await Core.createBuilder().withServices({
    projected: Core.transformService(Core.withDisposal(Core.fromFactory(() => source.promise, { acquisitionMode: 'nativePromise' }), value => { disposed.push(value); }), { mode: 'direct', transform: () => raw, ...{ acquisitionMode: 'raw' } }),
    later: Core.fromFactory(() => ++later, { acquisitionMode: 'raw' }),
  }).buildContainer().ensureServicesReady(['projected', 'later'], { maxConcurrentServiceKeys: 1 });
  expect(later).toBe(1); expect(thenReads).toBe(0); expect(bag.resolve('projected')).toBe(raw);
  const closing = bag.close(); source.resolve(7); await closing;
  expect(disposed).toEqual([7]); expect(thenReads).toBe(0);
});

for (const terminal of ['failure', 'aborted', 'timeout'] as const) test(`bounded startup stops dequeuing after ${terminal} and cleans started work`, async () => {
  const gates = [deferred<number>(), deferred<number>()];
  const abort = new AbortController();
  const calls: string[] = [], disposed: number[] = [];
  const cause = new Error('failed');
  const cleanupError = new Error('cleanup');
  const starting = DiBag.createBuilder().withServices({
    a: DiBag.withDisposal(() => { calls.push('a'); return gates[0]!.promise; }, value => { disposed.push(value); }),
    b: DiBag.withDisposal(() => { calls.push('b'); return gates[1]!.promise; }, value => { disposed.push(value); throw cleanupError; }),
    queued: () => { calls.push('queued'); return 3; },
  }).buildContainer().ensureServicesReady(['a', 'b', 'queued'], { maxConcurrentServiceKeys: 2, abortSignal: abort.signal, ...(terminal === 'timeout' ? { totalTimeoutMs: 5 } : {}) });
  const outcome = starting.catch(error => error);
  let settled = false; void outcome.then(() => { settled = true; });
  expect(calls).toEqual(['a', 'b']);
  if (terminal === 'failure') gates[0]!.reject(cause);
  else if (terminal === 'aborted') abort.abort(cause);
  let cancellation: InstanceType<typeof DiBagServiceReadinessCancelledError> | undefined;
  if (terminal === 'failure') {
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(settled).toBe(false);
  } else {
    const error: unknown = await outcome;
    expect(error).toBeInstanceOf(DiBagServiceReadinessCancelledError);
    if (!(error instanceof DiBagServiceReadinessCancelledError)) throw error;
    cancellation = error;
    expect(error.reason).toBe(terminal);
  }
  expect(calls).toEqual(['a', 'b']);
  gates[0]!.resolve(1); gates[1]!.resolve(2);
  if (cancellation) {
    const cleanup: unknown = await cancellation.disposalPromise.catch(error => error);
    expect(cleanup).toBeInstanceOf(DiBagCleanupError);
    if (!(cleanup instanceof DiBagCleanupError)) throw cleanup;
    expect(cleanup.failures[0]!.error).toBe(cleanupError);
  } else {
    const error: unknown = await outcome;
    expect(error).toBeInstanceOf(DiBagServiceReadinessError);
    if (!(error instanceof DiBagServiceReadinessError)) throw error;
    expect(error.cause).toBe(cause); expect(error.disposalFailures[0]!.error).toBe(cleanupError);
  }
  expect(calls).toEqual(['a', 'b']);
  expect(disposed).toEqual(terminal === 'failure' ? [2] : [2, 1]);
});

test('numeric startup rejects invalid bounds before factories', async () => {
  let calls = 0;
  const builder = DiBag.createBuilder().withServices({ value: () => ++calls });
  for (const startupOrder of [0, -1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    await expect(builder.buildContainer().ensureServicesReady(['value'], { maxConcurrentServiceKeys: startupOrder })).rejects.toThrow('ensureServicesReady maxConcurrentServiceKeys must be a positive safe integer');
  }
  expect(calls).toBe(0);
  await (await builder.buildContainer().ensureServicesReady(['value'], { maxConcurrentServiceKeys: Number.MAX_SAFE_INTEGER })).close();
  expect(calls).toBe(1);
});

test('numeric startup stops initial worker admission when a factory aborts synchronously', async () => {
  const abort = new AbortController();
  const source = deferred<number>();
  const calls: string[] = [], disposed: number[] = [];
  const outcome = await DiBag.createBuilder().withServices({
    first: DiBag.withDisposal(() => { calls.push('first'); abort.abort('stop'); return source.promise; }, value => { disposed.push(value); }),
    next: () => { calls.push('next'); return 2; },
  }).buildContainer().ensureServicesReady(['first', 'next'], { maxConcurrentServiceKeys: 2, abortSignal: abort.signal }).catch(error => error);
  expect(outcome).toBeInstanceOf(DiBagServiceReadinessCancelledError);
  if (!(outcome instanceof DiBagServiceReadinessCancelledError)) throw outcome;
  expect(calls).toEqual(['first']);
  source.resolve(42); await outcome.disposalPromise;
  expect(disposed).toEqual([42]);
});
