import { expect, test } from 'bun:test';
import * as api from '../src/node';
import { DiBag as Core } from '../src';
import { deferred } from './helpers';
import { getEventListeners } from 'node:events';

const { DiBag, DiBagCleanupError, DiBagStartupError, DiBagStartupCancelledError } = api;

test('contexts follow acquisition owners through child-first roots and independent forks', async () => {
  const root = DiBag.begin().add({
    scoped: DiBag.withContext((_deps: {}, context) => context),
    root: DiBag.withLifetime(DiBag.withContext((_deps: {}, context) => context), 'root'),
    transient: DiBag.withLifetime(DiBag.withContext((_deps: {}, context) => context), 'transient'),
  }).end();
  const child = root.scope();
  const sibling = root.scope();
  const fork = child.fork();
  const rootContext = child.resolve('root');
  const childContext = child.resolve('scoped');
  const siblingContext = sibling.resolve('scoped');
  const forkContext = fork.resolve('root');
  expect(rootContext).toBe(root.resolve('scoped'));
  expect(child.resolve('transient')).toBe(childContext);
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
  const root = DiBag.begin().add({ context: DiBag.withContext((_deps: {}, context) => context) }).end();
  const child = root.scope();
  const sibling = root.scope();
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
  const starting = DiBag.begin().add({
    service: () => { calls++; return gate.promise; },
    lazy: () => ++lazy,
  }).start(['service', 'service']);
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
  const starting = Core.begin().add({
    native: Core.withContext((_deps: {}, _context) => native.promise, { acquisition: 'native' }),
    raw: Core.withDisposal(Core.factory(() => raw.promise, { acquisition: 'raw' }), value => { disposed.push(value); }),
  }).start(['native', 'raw']);
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
  const outcome = await DiBag.begin().add({
    projected: DiBag.mapSync(DiBag.withDisposal(() => source.promise, value => { owned.push(value); }), () => Promise.resolve(42)),
  }).start(['projected'], { timeoutMs: 30 }).then(bag => ({ bag }), error => ({ error }));
  source.resolve(7);
  if ('error' in outcome) {
    await outcome.error.cleanup;
    throw outcome.error;
  }
  expect(await outcome.bag.resolve('projected')).toBe(42);
  await outcome.bag.close();
  expect(owned).toEqual([7]);
});

test('failed native projection aborts a cooperative pending source before cleanup', async () => {
  const cause = new Error('project');
  const disposed: number[] = [];
  const source = DiBag.withDisposal(DiBag.withContext((_deps: {}, context) => new Promise<number>(resolve => {
    context.signal.addEventListener('abort', () => resolve(7), { once: true });
  })), value => { disposed.push(value); });
  const error: unknown = await DiBag.begin().add({
    service: DiBag.mapSync(source, () => Promise.reject(cause)),
  }).start(['service'], { timeoutMs: 30 }).catch(error => error);
  if (error instanceof DiBagStartupCancelledError) await error.cleanup;
  expect(error).toBeInstanceOf(DiBagStartupError);
  if (!(error instanceof DiBagStartupError)) throw error;
  expect(error.cause).toBe(cause);
  expect(disposed).toEqual([7]);
});

test('sequential startup waits before invoking the next selection', async () => {
  const gate = deferred<number>();
  const calls: string[] = [];
  const starting = DiBag.begin().add({
    first: () => { calls.push('first'); return gate.promise; },
    second: () => { calls.push('second'); return 2; },
  }).start(['first', 'second'], { concurrency: 'sequential' });
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
  const builder = DiBag.begin().bind(token, DiBag.withLifetime(DiBag.withDisposal(() => ++calls, value => { disposed.push(value); }), 'transient'));
  const bag = await builder.start([token, token]);
  expect(calls).toBe(2);
  expect(bag.inspect(token).acquisitions).toHaveLength(2);
  await bag.close();
  expect(disposed).toEqual([2, 1]);
  const independent = await builder.start([]);
  expect(calls).toBe(2);
  expect(independent.resolve(token)).toBe(3);
  await independent.close();
});

test('late contextual dependencies receive an already aborted owner signal', async () => {
  const gate = deferred<void>();
  const bag = DiBag.begin().add({
    late: DiBag.withContext((_deps: {}, context) => context.signal.aborted),
    first: async (deps: { late: boolean }) => { await gate.promise; return deps.late; },
  }).end();
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
  const starting = DiBag.begin().add({ service: () => gate.promise }).start(['service'], { signal: controller.signal, timeoutMs: outcome === 'timeout' ? 5 : 10000 });
  const result = starting.catch(error => error);
  expect(getEventListeners(controller.signal, 'abort')).toHaveLength(1);
  if (outcome === 'success') gate.resolve(1);
  if (outcome === 'failure') gate.reject('failed');
  if (outcome === 'aborted') controller.abort();
  const value = await result;
  expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
  gate.resolve(1);
  if (value instanceof DiBagStartupCancelledError) await value.cleanup;
  else if (outcome === 'success') await value.close();
});

test('startup snapshots option getters once after snapshotting all selected keys', async () => {
  const keys: ['first'] = ['first'];
  let reads = 0;
  const calls: string[] = [];
  const bag = await DiBag.begin().add({
    first: () => { calls.push('first'); return 1; },
    second: () => { calls.push('second'); return 2; },
  }).start(keys, { get concurrency() {
    reads++;
    Reflect.set(keys, 0, 'second');
    return 'sequential' as const;
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
  const starting = DiBag.begin().add({
    first: DiBag.withDisposal(() => { calls.push('first'); return 1; }, async () => {
      cleanupStarted.resolve(); await cleanup.promise; throw disposalError;
    }),
    fail: () => { calls.push('fail'); throw acquisitionError; },
    last: () => { calls.push('last'); return 2; },
  }).start(['first', 'fail', 'last'], { concurrency: 'sequential' });
  const outcome = starting.catch(error => error);
  await cleanupStarted.promise;
  let rejected = false;
  void outcome.then(() => { rejected = true; });
  await Promise.resolve();
  expect(rejected).toBe(false);
  cleanup.resolve();
  const error: unknown = await outcome;
  expect(error).toBeInstanceOf(DiBagStartupError);
  if (!(error instanceof DiBagStartupError)) throw new Error('expected startup error');
  expect(error.cause).toBe(acquisitionError);
  expect(error.cleanupFailures.map(failure => failure.error)).toEqual([disposalError]);
  expect(Object.isFrozen(error.cleanupFailures)).toBe(true);
  expect(calls).toEqual(['first', 'fail']);
});

test('parallel startup starts later selections after synchronous failure and cleans pending ownership', async () => {
  const gate = deferred<number>();
  let calls = 0;
  const disposed: number[] = [];
  const starting = DiBag.begin().add({
    fail: () => { throw undefined; },
    later: DiBag.withDisposal(() => { calls++; return gate.promise; }, value => { disposed.push(value); }),
  }).start(['fail', 'later']);
  const outcome = starting.catch(error => error);
  expect(calls).toBe(1);
  gate.resolve(2);
  const error: unknown = await outcome;
  expect(error).toBeInstanceOf(DiBagStartupError);
  if (!(error instanceof DiBagStartupError)) throw new Error('expected startup error');
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
  const starting = DiBag.begin().add({
    value: DiBag.withDisposal(DiBag.withContext(async (deps: { late: number }, context) => {
      signal = context.signal;
      await gate.promise;
      return deps.late;
    }), value => { disposed.push(value); throw cleanupError; }),
    late: () => 42,
  }).start(['value'], reason === 'aborted' ? { signal: abort.signal } : { timeoutMs: 5 });
  const outcome = starting.catch(error => error);
  if (reason === 'aborted') abort.abort(cause);
  const error: unknown = await outcome;
  expect(error).toBeInstanceOf(DiBagStartupCancelledError);
  if (!(error instanceof DiBagStartupCancelledError)) throw new Error('expected cancellation');
  expect(error.reason).toBe(reason);
  if (reason === 'aborted') expect(error.cause).toBe(cause);
  expect(signal?.aborted).toBe(true);
  expect(disposed).toEqual([]);
  gate.resolve();
  const cleanup: unknown = await error.cleanup.catch(error => error);
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
  const error: unknown = await DiBag.begin().add({ value: () => ++calls }).start(['value'], { signal: controller.signal }).catch(error => error);
  expect(error).toBeInstanceOf(DiBagStartupCancelledError);
  if (!(error instanceof DiBagStartupCancelledError)) throw new Error('expected cancellation');
  expect(error.cause).toBe(cause);
  await error.cleanup;
  expect(calls).toBe(0);
});

test('cancellation can interrupt cleanup after ordinary startup failure', async () => {
  const cleanup = deferred<void>();
  const began = deferred<void>();
  const controller = new AbortController();
  const starting = DiBag.begin().add({
    owned: DiBag.withDisposal(() => 1, async () => { began.resolve(); await cleanup.promise; }),
    fail: () => { throw new Error('setup'); },
  }).start(['owned', 'fail'], { signal: controller.signal });
  const outcome = starting.catch(error => error);
  await began.promise;
  controller.abort('stop waiting');
  const error: unknown = await outcome;
  expect(error).toBeInstanceOf(DiBagStartupCancelledError);
  if (!(error instanceof DiBagStartupCancelledError)) throw new Error('expected cancellation');
  cleanup.resolve();
  await error.cleanup;
});

test('successful startup removes external cancellation and snapshots indexed selections', async () => {
  const controller = new AbortController();
  const calls: string[] = [];
  const keys: ['value'] = ['value'];
  keys[Symbol.iterator] = function* () { throw new Error('do not iterate'); };
  const bag = await DiBag.begin().add({
    value: DiBag.withContext((_deps: {}, context) => { calls.push('value'); return context; }),
    hidden: () => { calls.push('hidden'); return 2; },
  }).start(keys, { signal: controller.signal, timeoutMs: 2 ** 32 });
  controller.abort();
  expect(bag.resolve('value').signal.aborted).toBe(false);
  expect(calls).toEqual(['value']);
  await bag.close();
});

test('invalid startup inputs reject before factory or unsupported option getter effects', async () => {
  let effects = 0;
  const builder = DiBag.begin().add({ value: () => ++effects });
  const start = builder.start.bind(builder) as (...args: unknown[]) => Promise<unknown>;
  for (const options of [null, [], true, { timeoutMs: 0 }, { timeoutMs: -1 }, { timeoutMs: Infinity }, { timeoutMs: NaN }, { timeoutMs: '1' }, { concurrency: 'serial' }, { signal: {} }, { other: true, get timeoutMs() { effects++; return 1; } }, Object.create({ timeoutMs: 1 })]) {
    await expect(start(['value'], options)).rejects.toThrow(/startup/);
  }
  for (const keys of [undefined, 'value', [null], ['missing'], [{ key: Symbol('fake') }]]) {
    await expect(start(keys)).rejects.toThrow();
  }
  expect(effects).toBe(0);
});

for (const concurrency of [1, 2, 20]) test(`numeric startup ${concurrency} bounds selected readiness and preserves promise identity`, async () => {
  const gates = [deferred<number>(), deferred<number>(), deferred<number>()];
  const calls: number[] = [];
  const disposed: number[] = [];
  const provider = (index: number) => DiBag.withDisposal(() => { calls.push(index); return gates[index]!.promise; }, value => { disposed.push(value); });
  const starting = DiBag.begin().add({ a: provider(0), b: provider(1), c: provider(2) })
    .start(['a', 'b', 'c'], { concurrency });
  const outcome = starting.catch(error => error);
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(calls).toEqual(concurrency === 1 ? [0] : concurrency === 2 ? [0, 1] : [0, 1, 2]);
  gates[0]!.resolve(10);
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(calls).toEqual(concurrency === 1 ? [0, 1] : [0, 1, 2]);
  gates[1]!.resolve(11); gates[2]!.resolve(12);
  const bag = await outcome;
  if (bag instanceof Error) throw bag;
  expect(bag.resolve('a')).toBe(gates[0]!.promise);
  await bag.close();
  expect(disposed).toEqual([12, 11, 10]);
});

for (const concurrency of [1, 2]) test(`numeric startup ${concurrency} snapshots options and retains duplicate selected lifetimes`, async () => {
  let reads = 0, scoped = 0, transient = 0;
  const disposed: number[] = [];
  const builder = DiBag.begin().add({
    scoped: () => ++scoped,
    transient: DiBag.withLifetime(DiBag.withDisposal(() => ++transient, value => { disposed.push(value); }), 'transient'),
  });
  const bag = await builder.start(['scoped', 'scoped', 'transient', 'transient'], { get concurrency() { reads++; return concurrency; } });
  expect(reads).toBe(1); expect(scoped).toBe(1); expect(transient).toBe(2);
  await bag.close(); expect(disposed).toEqual([2, 1]);
  await (await builder.start([], { concurrency })).close();
});

test('numeric startup uses final raw readiness while owned sources remain pending', async () => {
  const source = deferred<number>();
  let thenReads = 0, later = 0;
  const raw = { get then() { thenReads++; throw new Error('raw then'); } };
  const disposed: number[] = [];
  const bag = await Core.begin().add({
    projected: Core.mapSync(Core.withDisposal(Core.factory(() => source.promise, { acquisition: 'native' }), value => { disposed.push(value); }), () => raw, { acquisition: 'raw' }),
    later: Core.factory(() => ++later, { acquisition: 'raw' }),
  }).start(['projected', 'later'], { concurrency: 1 });
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
  const starting = DiBag.begin().add({
    a: DiBag.withDisposal(() => { calls.push('a'); return gates[0]!.promise; }, value => { disposed.push(value); }),
    b: DiBag.withDisposal(() => { calls.push('b'); return gates[1]!.promise; }, value => { disposed.push(value); throw cleanupError; }),
    queued: () => { calls.push('queued'); return 3; },
  }).start(['a', 'b', 'queued'], { concurrency: 2, signal: abort.signal, ...(terminal === 'timeout' ? { timeoutMs: 5 } : {}) });
  const outcome = starting.catch(error => error);
  let settled = false; void outcome.then(() => { settled = true; });
  expect(calls).toEqual(['a', 'b']);
  if (terminal === 'failure') gates[0]!.reject(cause);
  else if (terminal === 'aborted') abort.abort(cause);
  let cancellation: InstanceType<typeof DiBagStartupCancelledError> | undefined;
  if (terminal === 'failure') {
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(settled).toBe(false);
  } else {
    const error: unknown = await outcome;
    expect(error).toBeInstanceOf(DiBagStartupCancelledError);
    if (!(error instanceof DiBagStartupCancelledError)) throw error;
    cancellation = error;
    expect(error.reason).toBe(terminal);
  }
  expect(calls).toEqual(['a', 'b']);
  gates[0]!.resolve(1); gates[1]!.resolve(2);
  if (cancellation) {
    const cleanup: unknown = await cancellation.cleanup.catch(error => error);
    expect(cleanup).toBeInstanceOf(DiBagCleanupError);
    if (!(cleanup instanceof DiBagCleanupError)) throw cleanup;
    expect(cleanup.failures[0]!.error).toBe(cleanupError);
  } else {
    const error: unknown = await outcome;
    expect(error).toBeInstanceOf(DiBagStartupError);
    if (!(error instanceof DiBagStartupError)) throw error;
    expect(error.cause).toBe(cause); expect(error.cleanupFailures[0]!.error).toBe(cleanupError);
  }
  expect(calls).toEqual(['a', 'b']);
  expect(disposed).toEqual(terminal === 'failure' ? [2] : [2, 1]);
});

test('numeric startup rejects invalid bounds before factories', async () => {
  let calls = 0;
  const builder = DiBag.begin().add({ value: () => ++calls });
  for (const concurrency of [0, -1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    await expect(builder.start(['value'], { concurrency })).rejects.toThrow('invalid startup concurrency');
  }
  expect(calls).toBe(0);
  await (await builder.start(['value'], { concurrency: Number.MAX_SAFE_INTEGER })).close();
  expect(calls).toBe(1);
});

test('numeric startup stops initial worker admission when a factory aborts synchronously', async () => {
  const abort = new AbortController();
  const source = deferred<number>();
  const calls: string[] = [], disposed: number[] = [];
  const outcome = await DiBag.begin().add({
    first: DiBag.withDisposal(() => { calls.push('first'); abort.abort('stop'); return source.promise; }, value => { disposed.push(value); }),
    next: () => { calls.push('next'); return 2; },
  }).start(['first', 'next'], { concurrency: 2, signal: abort.signal }).catch(error => error);
  expect(outcome).toBeInstanceOf(DiBagStartupCancelledError);
  if (!(outcome instanceof DiBagStartupCancelledError)) throw outcome;
  expect(calls).toEqual(['first']);
  source.resolve(42); await outcome.cleanup;
  expect(disposed).toEqual([42]);
});
