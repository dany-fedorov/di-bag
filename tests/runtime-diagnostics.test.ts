import { expect, test } from 'bun:test';
import { getEventListeners } from 'node:events';
import { DiBag, DiBagCleanupError, DiBagCloseCancelledError, DiBagPluginValidationError, DiBagStartupCancelledError, type GraphSnapshot, type LifecycleEvent } from '../src/node';
import { DiBag as Core } from '../src';
import { withoutBuiltinModule } from './host-builtin-module';

// Dynamic graphs below are cast past the compiler on purpose: these tests pin runtime labels.
type LooseBag = { resolve(key: string): unknown; inspectGraph(): GraphSnapshot; close(): Promise<void> };
const buildLoose = (builder: unknown) => (builder as { build(): unknown }).build() as LooseBag;

const page = 'https://dany-fedorov.github.io/di-bag/agent/errors.html';
const caught = (run: () => unknown): Error & { code: string; details: Record<string, unknown> } => {
  try { run(); } catch (error) { return error as never; }
  throw new Error('expected a throw');
};
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('library messages carry the code, the original text, and the errors-page section', async () => {
  const missing = caught(() => (DiBag.createBuilder().register({ a: () => 1 }).build().resolve as Function)('absent'));
  expect(missing.code).toBe('DI_BAG_MISSING_REGISTRATION');
  expect(missing.message).toBe(`DI_BAG_MISSING_REGISTRATION: Service "absent" is not registered.; see ${page}#di-bag-missing-registration`);
  expect(missing.details).toEqual({ operation: 'resolve', key: 'absent' });

  const cycle = caught(() => DiBag.createBuilder().register({
    a: ({ b }: { b: number }) => b, b: ({ a }: { a: number }) => a,
  } as never).build().resolve('a' as never));
  expect(cycle.message).toBe(`DI_BAG_CYCLE: cycle: a -> b -> a; see ${page}#di-bag-cycle`);
  expect(cycle.details.path).toEqual(['a', 'b', 'a']);

  const classifier = caught(() => withoutBuiltinModule(() => Core.createBuilder().register({ value: () => 1 }).build()));
  expect(classifier.message).toBe(`DI_BAG_CLASSIFIER_REQUIRED: this host has no process.getBuiltinModule; 1 registration uses automatic acquisition: "value"; use DiBag.fromSyncFactory or DiBag.fromAsyncFactory (or an explicit acquisitionMode) for each, or configure DiBag.withConfiguration({ runtime: { isNativePromise } }); see ${page}#di-bag-classifier-required`);

  const typeError = caught(() => DiBag.withConfiguration(null as never));
  expect(typeError).toBeInstanceOf(TypeError);
  expect(typeError.message).toStartWith('DI_BAG_INVALID_CONFIGURATION: withConfiguration requires an options object; see ');

  const plugin = new DiBagPluginValidationError('output', 'rejected');
  expect(plugin.message).toBe(`DI_BAG_PLUGIN_VALIDATION: Invalid plugin output: rejected; see ${page}#di-bag-plugin-validation`);

  const bag = DiBag.createBuilder().register({ value: DiBag.withDisposal(() => 1, () => { throw new Error('boom'); }) }).build();
  bag.resolve('value');
  const cleanup = await bag.close().catch(error => error);
  expect(cleanup).toBeInstanceOf(DiBagCleanupError);
  expect(cleanup.message).toBe(`DI_BAG_CLEANUP_FAILED: Failed to run 1 disposal callback(s); see ${page}#di-bag-cleanup-failed`);

  const startup = await DiBag.createBuilder().register({ slow: () => new Promise(() => {}) }).buildAndStart(['slow'], { timeoutMs: 1 }).catch(error => error);
  expect(startup).toBeInstanceOf(DiBagStartupCancelledError);
  expect(startup.message).toBe(`DI_BAG_STARTUP_CANCELLED: Bag startup timeout; see ${page}#di-bag-startup-cancelled`);
  expect(startup.cause.message).toBe(`DI_BAG_STARTUP_TIMEOUT: Bag startup timed out; see ${page}#di-bag-startup-timeout`);
});

test('application errors keep their message untouched', () => {
  const original = new Error('application failure');
  const bag = DiBag.createBuilder().register({ value: () => { throw original; } }).build();
  expect(caught(() => bag.resolve('value')) as unknown).toBe(original);
  expect(original.message).toBe('application failure');
});

test('a module label names private bindings in messages, cycle paths, inspectGraph, and observers', async () => {
  const events: LifecycleEvent[] = [];
  const api = DiBag.withConfiguration({ observers: [{ onEvent: event => { events.push(event); }, onError() {} }] });
  const orders = api.createBuilder().register({
    repository: ({ database }: { database: string }) => `repo:${database}`,
    left: ({ right }: { right: number }) => right,
    right: ({ left }: { left: number }) => left,
  }).register({
    placeOrder: ({ repository }: { repository: string }) => repository,
    loop: ({ left }: { left: number }) => left,
    broken: ({ absent }: { absent: number }) => absent,
  } as never).buildModule(['placeOrder', 'loop', 'broken'] as never, { label: 'orders' });

  const bag = buildLoose(api.createBuilder().installModule(orders as never).register({ database: () => 'db' } as never));
  expect(bag.resolve('placeOrder')).toBe('repo:db');

  const cycle = caught(() => bag.resolve('loop'));
  expect(cycle.code).toBe('DI_BAG_CYCLE');
  expect(cycle.details.path).toEqual(['orders/left', 'orders/right', 'orders/left']);
  expect(cycle.message).toContain('cycle: orders/left -> orders/right -> orders/left;');

  const missing = caught(() => bag.resolve('broken'));
  expect(missing.code).toBe('DI_BAG_MISSING_DEPENDENCY');
  expect(missing.details.consumer).toBe('broken');

  const labels = bag.inspectGraph().bindings.map(binding => [binding.label, binding.keys]);
  expect(labels).toEqual(expect.arrayContaining([
    ['placeOrder', ['placeOrder']], ['orders/repository', []], ['orders/left', []], ['orders/right', []], ['database', ['database']],
  ]));
  await tick();
  expect(events.filter(event => event.kind === 'acquisition-started').map(event => 'label' in event && event.label))
    .toContain('orders/repository');
  await bag.close();
});

test('a private consumer is named with its label when its own dependency is missing', async () => {
  const feature = DiBag.createBuilder().register({
    worker: ({ absent }: { absent: number }) => absent,
  } as never).register({ run: ({ worker }: { worker: number }) => worker } as never).buildModule(['run'] as never, { label: 'jobs' });
  const bag = buildLoose(DiBag.createBuilder().installModule(feature as never));
  const error = caught(() => bag.resolve('run'));
  expect(error.details.consumer).toBe('jobs/worker');
  expect(error.details.path).toEqual(['run', 'jobs/worker', 'absent']);
  expect(error.message).toContain('Cannot resolve "jobs/worker"');
  await bag.close();
});

test('nested module labels compose outward and unlabeled modules keep bare keys', async () => {
  const inner = DiBag.createBuilder().register({ state: () => 1, read: ({ state }: { state: number }) => state }).buildModule(['read'], { label: 'inner' });
  const outer = DiBag.createBuilder().installModule(inner).register({ wrap: ({ read }: { read: number }) => read + 1 }).buildModule(['wrap'], { label: 'outer' });
  const labeled = DiBag.createBuilder().installModule(outer).build();
  expect(labeled.resolve('wrap')).toBe(2);
  expect(labeled.inspectGraph().bindings.map(binding => binding.label).sort()).toEqual(['outer/inner/state', 'outer/read', 'wrap']);

  const unlabeledOuter = DiBag.createBuilder().installModule(inner).register({ wrap: ({ read }: { read: number }) => read }).buildModule(['wrap']);
  const mixed = DiBag.createBuilder().installModule(unlabeledOuter.renameExport('wrap', 'renamed')).build();
  expect(mixed.inspectGraph().bindings.map(binding => binding.label).sort()).toEqual(['inner/state', 'read', 'wrap']);

  const plain = DiBag.createBuilder().installModule(DiBag.createBuilder().register({ state: () => 1, read: ({ state }: { state: number }) => state }).buildModule(['read'])).build();
  expect(plain.inspectGraph().bindings.map(binding => binding.label).sort()).toEqual(['read', 'state']);
  await Promise.all([labeled.close(), mixed.close(), plain.close()]);
});

test('buildModule rejects malformed label options', () => {
  const builder = DiBag.createBuilder().register({ value: () => 1 });
  for (const options of [null, 'orders', [], { label: '' }, { label: 1 }, { label: 'x', other: true }, Object.create({ label: 'x' })]) {
    const error = caught(() => builder.buildModule(['value'], options as never));
    expect(error.code).toBe('DI_BAG_INVALID_EXPORT');
    expect(error.details).toEqual({ operation: 'buildModule', option: 'label' });
  }
  expect(() => builder.buildModule(['value'], {})).not.toThrow();
  expect(() => builder.buildModule(['value'], { label: undefined } as never)).not.toThrow();
});

test('close({ timeoutMs }) rejects naming the never-settling disposer and keeps cleanup awaitable', async () => {
  let release!: () => void;
  const disposed: string[] = [];
  const bag = DiBag.createBuilder().register({
    fast: DiBag.withDisposal(() => 'fast', () => { disposed.push('fast'); }),
    stuck: DiBag.withDisposal(({ fast }: { fast: string }) => fast, () => new Promise<void>(resolve => { release = resolve; })),
  }).build();
  bag.resolve('stuck');
  const error = await bag.close({ timeoutMs: 1 }).catch(caughtError => caughtError);
  expect(error).toBeInstanceOf(DiBagCloseCancelledError);
  expect(error.code).toBe('DI_BAG_CLOSE_TIMEOUT');
  expect(error.reason).toBe('timeout');
  expect(error.details).toEqual({ operation: 'close', reason: 'timeout', timeoutMs: 1, pending: ['stuck'], acquiring: [] });
  expect(error.message).toBe(`DI_BAG_CLOSE_TIMEOUT: Bag close timed out after 1ms; disposers still running: stuck; see ${page}#di-bag-close-timeout`);
  expect(error.cause.name).toBe('TimeoutError');
  expect(error.cause.code).toBe('DI_BAG_CLOSE_TIMEOUT');
  expect(() => bag.resolve('fast')).toThrow('DI_BAG_CLOSING');

  let settled = false;
  void error.cleanupPromise.then(() => { settled = true; });
  await tick();
  expect(settled).toBe(false);
  expect(disposed).toEqual([]);
  release();
  await error.cleanupPromise;
  expect(settled).toBe(true);
  expect(disposed).toEqual(['fast']);
  expect(error.cleanupPromise).toBe(bag.close());
});

test('close deadline reports pending acquisitions when cleanup is still draining them', async () => {
  const bag = DiBag.createBuilder().register({ slow: () => new Promise<number>(() => {}) }).build();
  void bag.resolve('slow');
  const error = await bag.close({ timeoutMs: 1 }).catch(caughtError => caughtError);
  expect(error.details.pending).toEqual([]);
  expect(error.details.acquiring).toEqual(['slow']);
  expect(error.message).toContain('acquisitions still pending: slow;');
});

test('close({ signal }) stops the wait on abort with DI_BAG_CLOSE_ABORTED and removes its listener', async () => {
  let release!: () => void;
  const bag = DiBag.createBuilder().register({
    stuck: DiBag.withDisposal(() => 1, () => new Promise<void>(resolve => { release = resolve; })),
  }).build();
  bag.resolve('stuck');
  const controller = new AbortController();
  const reason = new Error('shutdown budget spent');
  const closing = bag.close({ signal: controller.signal, timeoutMs: 60_000 }).catch(error => error);
  expect(getEventListeners(controller.signal, 'abort')).toHaveLength(1);
  await tick();
  controller.abort(reason);
  const error = await closing;
  expect(error).toBeInstanceOf(DiBagCloseCancelledError);
  expect(error.code).toBe('DI_BAG_CLOSE_ABORTED');
  expect(error.cause).toBe(reason);
  expect(error.details).toEqual({ operation: 'close', reason: 'aborted', pending: ['stuck'], acquiring: [] });
  expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
  release();
  await error.cleanupPromise;
});

test('an already aborted signal still starts cleanup and rejects immediately', async () => {
  const disposed: number[] = [];
  const bag = DiBag.createBuilder().register({ value: DiBag.withDisposal(() => 1, value => { disposed.push(value); }) }).build();
  bag.resolve('value');
  const controller = new AbortController();
  controller.abort('now');
  const error = await bag.close({ signal: controller.signal }).catch(caughtError => caughtError);
  expect(error.code).toBe('DI_BAG_CLOSE_ABORTED');
  await error.cleanupPromise;
  expect(disposed).toEqual([1]);
});

test('bounded close resolves or rejects with the ordinary outcome when cleanup finishes first', async () => {
  const bag = DiBag.createBuilder().register({ value: DiBag.withDisposal(() => 1, () => {}) }).build();
  bag.resolve('value');
  const controller = new AbortController();
  await bag.close({ timeoutMs: 1_000, signal: controller.signal });
  expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
  expect(await bag.close({ timeoutMs: 1 })).toBeUndefined();

  const failing = DiBag.createBuilder().register({ value: DiBag.withDisposal(() => 1, () => { throw new Error('boom'); }) }).build();
  failing.resolve('value');
  expect(await failing.close({ timeoutMs: 1_000 }).catch(error => error)).toBeInstanceOf(DiBagCleanupError);
});

test('scopes and forks accept close options; a child deadline names the child disposer', async () => {
  let release!: () => void;
  const root = DiBag.createBuilder().register({
    session: DiBag.withDisposal(() => 1, () => new Promise<void>(resolve => { release = resolve; })),
  }).build();
  const child = root.createScope();
  child.resolve('session');
  const childError = await child.close({ timeoutMs: 1 }).catch(error => error);
  expect(childError.details.pending).toEqual(['session']);
  release();
  await childError.cleanupPromise;

  const fork = root.fork();
  fork.resolve('session');
  const parentChild = root.createScope();
  parentChild.resolve('session');
  const rootError = await root.close({ timeoutMs: 1 }).catch(error => error);
  expect(rootError.code).toBe('DI_BAG_CLOSE_TIMEOUT');
  expect(rootError.details.pending).toEqual(['session']);
  release();
  await rootError.cleanupPromise;
  const forkError = await fork.close({ timeoutMs: 1 }).catch(error => error);
  release();
  await forkError.cleanupPromise;
});

test('close rejects malformed options without starting cleanup', async () => {
  const bag = DiBag.createBuilder().register({ value: () => 1 }).build();
  for (const options of [null, [], { timeoutMs: 0 }, { timeoutMs: Infinity }, { timeoutMs: '1' }, { signal: {} }, { startupOrder: 'sequential' }, Object.create({ timeoutMs: 1 })]) {
    const error = await bag.close(options as never).catch(caughtError => caughtError);
    expect(error.code).toBe('DI_BAG_INVALID_CLOSE');
    expect(error.details).toEqual({ operation: 'close' });
  }
  expect(bag.resolve('value')).toBe(1);
  await bag.close({});
  expect(() => bag.resolve('value')).toThrow('DI_BAG_CLOSED');
});
