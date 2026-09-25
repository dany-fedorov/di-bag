import { expect, test } from 'bun:test';
import { getEventListeners } from 'node:events';
import { DiBag, DiBagDisposalError, DiBagCloseCancelledError, DiBagPluginValidationError, DiBagServiceReadinessCancelledError, type GraphSnapshot, type LifecycleEvent } from '../src';
import { DiBag as Core } from '../src';
import { withoutBuiltinModule } from './host-builtin-module';

// Dynamic graphs below are cast past the compiler on purpose: these tests pin runtime labels.
type LooseBag = { resolve(key: string): unknown; graphSnapshot(): GraphSnapshot; close(): Promise<void> };
const buildLoose = (builder: unknown) => (builder as { buildContainer(): unknown }).buildContainer() as LooseBag;

const page = 'https://dany-fedorov.github.io/di-bag/agent/errors.html';
const caught = (run: () => unknown): Error & { code: string; details: Record<string, unknown> } => {
  try { run(); } catch (error) { return error as never; }
  throw new Error('expected a throw');
};
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('library messages carry the code, the original text, and the errors-page section', async () => {
  const missing = caught(() => (DiBag.createBuilder().withServices({ a: () => 1 }).buildContainer().resolve as Function)('absent'));
  expect(missing.code).toBe('DI_BAG_UNKNOWN_SERVICE_KEY');
  expect(missing.message).toBe(`DI_BAG_UNKNOWN_SERVICE_KEY: Service "absent" is not registered.; see ${page}#di-bag-unknown-service-key`);
  expect(missing.details).toEqual({ operation: 'resolve', serviceKey: 'absent' });

  const cycle = caught(() => DiBag.createBuilder().withServices({
    a: ({ b }: { b: number }) => b, b: ({ a }: { a: number }) => a,
  } as never).buildContainer().resolve('a' as never));
  expect(cycle.message).toBe(`DI_BAG_DEPENDENCY_CYCLE: cycle: a -> b -> a; see ${page}#di-bag-dependency-cycle`);
  expect(cycle.details.path).toEqual(['a', 'b', 'a']);

  const classifier = caught(() => withoutBuiltinModule(() => Core.createBuilder().withServices({ value: () => 1 }).buildContainer()));
  expect(classifier.message).toBe(`DI_BAG_CLASSIFIER_REQUIRED: this host has no process.getBuiltinModule; 1 provider uses auto-detect factory return kind: "value"; use DiBag.createProvider(factory, { factoryReturnKind: 'sync-value' }) or factoryReturnKind: 'native-promise' for each, or configure DiBag.withConfiguration({ runtime: { isNativePromise } }); see ${page}#di-bag-classifier-required`);

  const typeError = caught(() => DiBag.withConfiguration(null as never));
  expect(typeError.code).toBe('DI_BAG_INVALID_ARGUMENT');
  expect(typeError.details).toEqual({ operation: 'withConfiguration', argument: 'options', expected: 'an object' });
  expect(typeError.message).toBe(`DI_BAG_INVALID_ARGUMENT: withConfiguration requires one options object; see ${page}#di-bag-invalid-argument`);

  const plugin = new DiBagPluginValidationError('output', 'rejected');
  expect(plugin.message).toBe(`DI_BAG_PLUGIN_VALIDATION: Invalid plugin output: rejected; see ${page}#di-bag-plugin-validation`);

  const bag = DiBag.createBuilder().withServices({ value: DiBag.providerWithDisposal({ provider: () => 1, disposeService: () => { throw new Error('boom'); } }) }).buildContainer();
  bag.resolve('value');
  const cleanup = await bag.close().catch(error => error);
  expect(cleanup).toBeInstanceOf(DiBagDisposalError);
  expect(cleanup.message).toBe(`DI_BAG_DISPOSAL_FAILED: Failed to run 1 disposal callback(s); see ${page}#di-bag-disposal-failed`);
  expect(cleanup.code).toBe('DI_BAG_DISPOSAL_FAILED');
  expect(cleanup.name).toBe('DiBagDisposalError');
  expect(cleanup.failures.map((failure: { bindingLabel: string }) => failure.bindingLabel)).toEqual(['value']);
  expect(cleanup.failures[0]).not.toHaveProperty('label');

  const readiness = await DiBag.createBuilder().withServices({ slow: () => new Promise(() => {}) }).buildContainer().ensureServicesReady(['slow'], { totalTimeoutMs: 1 }).catch(error => error);
  expect(readiness).toBeInstanceOf(DiBagServiceReadinessCancelledError);
  expect(readiness.message).toBe(`DI_BAG_SERVICE_READINESS_CANCELLED: The listed services were not ready: the wait timed out after 1ms; acquisitions still pending: slow; this container is closing; see ${page}#di-bag-service-readiness-cancelled`);
  expect(readiness.cause.message).toBe(`DI_BAG_SERVICE_READINESS_TIMEOUT: The listed services were not ready before the deadline; see ${page}#di-bag-service-readiness-timeout`);
});

test('application errors keep their message untouched', () => {
  const original = new Error('application failure');
  const bag = DiBag.createBuilder().withServices({ value: () => { throw original; } }).buildContainer();
  expect(caught(() => bag.resolve('value')) as unknown).toBe(original);
  expect(original.message).toBe('application failure');
});

test('a module label names private bindings in messages, cycle paths, graphSnapshot, and observers', async () => {
  const events: LifecycleEvent[] = [];
  const api = DiBag.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent: event => { events.push(event); }, onObserverFailure() {} }] });
  const orders = api.createBuilder().withServices({
    repository: ({ database }: { database: string }) => `repo:${database}`,
    left: ({ right }: { right: number }) => right,
    right: ({ left }: { left: number }) => left,
  }).withServices({
    placeOrder: ({ repository }: { repository: string }) => repository,
    loop: ({ left }: { left: number }) => left,
    broken: ({ absent }: { absent: number }) => absent,
  } as never).buildModule({ exportedServiceKeys: ['placeOrder', 'loop', 'broken'] as never, moduleLabel: 'orders' });

  const bag = buildLoose(api.createBuilder().withInstalledModules([orders] as never).withServices({ database: () => 'db' } as never));
  expect(bag.resolve('placeOrder')).toBe('repo:db');

  const cycle = caught(() => bag.resolve('loop'));
  expect(cycle.code).toBe('DI_BAG_DEPENDENCY_CYCLE');
  expect(cycle.details.path).toEqual(['orders/left', 'orders/right', 'orders/left']);
  expect(cycle.message).toContain('cycle: orders/left -> orders/right -> orders/left;');

  const missing = caught(() => bag.resolve('broken'));
  expect(missing.code).toBe('DI_BAG_MISSING_DEPENDENCY');
  expect(missing.details.consumer).toBe('broken');

  const labels = bag.graphSnapshot().bindings.map(binding => [binding.bindingLabel, binding.serviceKeys]);
  expect(labels).toEqual(expect.arrayContaining([
    ['placeOrder', ['placeOrder']], ['orders/repository', []], ['orders/left', []], ['orders/right', []], ['database', ['database']],
  ]));
  await tick();
  expect(events.filter(event => event.kind === 'acquisition-started').map(event => 'bindingLabel' in event && event.bindingLabel))
    .toContain('orders/repository');
  await bag.close();
});

test('a private consumer is named with its label when its own dependency is missing', async () => {
  const feature = DiBag.createBuilder().withServices({
    worker: ({ absent }: { absent: number }) => absent,
  } as never).withServices({ run: ({ worker }: { worker: number }) => worker } as never).buildModule({ exportedServiceKeys: ['run'] as never, moduleLabel: 'jobs' });
  const bag = buildLoose(DiBag.createBuilder().withInstalledModules([feature] as never));
  const error = caught(() => bag.resolve('run'));
  expect(error.details.consumer).toBe('jobs/worker');
  expect(error.details.path).toEqual(['run', 'jobs/worker', 'absent']);
  expect(error.message).toContain('Cannot resolve "jobs/worker"');
  await bag.close();
});

test('nested module labels compose outward and unlabeled modules keep bare keys', async () => {
  const inner = DiBag.createBuilder().withServices({ state: () => 1, read: ({ state }: { state: number }) => state }).buildModule({ exportedServiceKeys: ['read'], moduleLabel: 'inner' });
  const outer = DiBag.createBuilder().withInstalledModules([inner]).withServices({ wrap: ({ read }: { read: number }) => read + 1 }).buildModule({ exportedServiceKeys: ['wrap'], moduleLabel: 'outer' });
  const labeled = DiBag.createBuilder().withInstalledModules([outer]).buildContainer();
  expect(labeled.resolve('wrap')).toBe(2);
  expect(labeled.graphSnapshot().bindings.map(binding => binding.bindingLabel).sort()).toEqual(['outer/inner/state', 'outer/read', 'wrap']);

  const unlabeledOuter = DiBag.createBuilder().withInstalledModules([inner]).withServices({ wrap: ({ read }: { read: number }) => read }).buildModule({ exportedServiceKeys: ['wrap'] });
  const mixed = DiBag.createBuilder().withInstalledModules([unlabeledOuter.withRenamedExport({ currentExportKey: 'wrap', newExportKey: 'renamed' })]).buildContainer();
  expect(mixed.graphSnapshot().bindings.map(binding => binding.bindingLabel).sort()).toEqual(['inner/state', 'read', 'wrap']);

  const plain = DiBag.createBuilder().withInstalledModules([DiBag.createBuilder().withServices({ state: () => 1, read: ({ state }: { state: number }) => state }).buildModule({ exportedServiceKeys: ['read'] })]).buildContainer();
  expect(plain.graphSnapshot().bindings.map(binding => binding.bindingLabel).sort()).toEqual(['read', 'state']);
  await Promise.all([labeled.close(), mixed.close(), plain.close()]);
});

test('buildModule rejects malformed label options', () => {
  const builder = DiBag.createBuilder().withServices({ value: () => 1 });
  for (const moduleLabel of ['', 1, null, {}]) {
    const error = caught(() => (builder.buildModule as Function)({ exportedServiceKeys: ['value'], moduleLabel }));
    expect(error.code).toBe('DI_BAG_INVALID_ARGUMENT');
    expect(error.details).toEqual({ operation: 'buildModule', argument: 'moduleLabel', expected: 'a non-empty string' });
  }
  expect(() => (builder.buildModule as Function)({ exportedServiceKeys: ['value'] })).not.toThrow();
  expect(() => (builder.buildModule as Function)({ exportedServiceKeys: ['value'], moduleLabel: undefined })).not.toThrow();
});

test('close({ waitTimeoutMs }) rejects naming the never-settling disposer and keeps cleanup awaitable', async () => {
  let release!: () => void;
  const disposed: string[] = [];
  const bag = DiBag.createBuilder().withServices({
    fast: DiBag.providerWithDisposal({ provider: () => 'fast', disposeService: () => { disposed.push('fast'); } }),
    stuck: DiBag.providerWithDisposal({ provider: ({ fast }: { fast: string }) => fast, disposeService: () => new Promise<void>(resolve => { release = resolve; }) }),
  }).buildContainer();
  bag.resolve('stuck');
  const error = await bag.close({ waitTimeoutMs: 1 }).catch(caughtError => caughtError);
  expect(error).toBeInstanceOf(DiBagCloseCancelledError);
  expect(error.code).toBe('DI_BAG_CLOSE_TIMEOUT');
  expect(error.reason).toBe('timeout');
  expect(error.details).toEqual({ operation: 'close', reason: 'timeout', waitTimeoutMs: 1, disposersStillRunning: ['stuck'], acquisitionsStillPending: [] });
  expect(error.message).toBe(`DI_BAG_CLOSE_TIMEOUT: Container close timed out after 1ms; disposers still running: stuck; see ${page}#di-bag-close-timeout`);
  expect(error.cause.name).toBe('TimeoutError');
  expect(error.cause.code).toBe('DI_BAG_CLOSE_TIMEOUT');
  expect(() => bag.resolve('fast')).toThrow('DI_BAG_CLOSING');

  let settled = false;
  void error.disposalPromise.then(() => { settled = true; });
  await tick();
  expect(settled).toBe(false);
  expect(disposed).toEqual([]);
  release();
  await error.disposalPromise;
  expect(settled).toBe(true);
  expect(disposed).toEqual(['fast']);
  expect(error.disposalPromise).toBe(bag.close());
});

test('close deadline reports pending acquisitions when cleanup is still draining them', async () => {
  const bag = DiBag.createBuilder().withServices({ slow: () => new Promise<number>(() => {}) }).buildContainer();
  void bag.resolve('slow');
  const error = await bag.close({ waitTimeoutMs: 1 }).catch(caughtError => caughtError);
  expect(error.details.disposersStillRunning).toEqual([]);
  expect(error.details.acquisitionsStillPending).toEqual(['slow']);
  expect(error.message).toContain('acquisitions still pending: slow;');
});

test('close({ abortSignal }) stops the wait on abort with DI_BAG_CLOSE_ABORTED and removes its listener', async () => {
  let release!: () => void;
  const bag = DiBag.createBuilder().withServices({
    stuck: DiBag.providerWithDisposal({ provider: () => 1, disposeService: () => new Promise<void>(resolve => { release = resolve; }) }),
  }).buildContainer();
  bag.resolve('stuck');
  const controller = new AbortController();
  const reason = new Error('shutdown budget spent');
  const closing = bag.close({ abortSignal: controller.signal, waitTimeoutMs: 60_000 }).catch(error => error);
  expect(getEventListeners(controller.signal, 'abort')).toHaveLength(1);
  await tick();
  controller.abort(reason);
  const error = await closing;
  expect(error).toBeInstanceOf(DiBagCloseCancelledError);
  expect(error.code).toBe('DI_BAG_CLOSE_ABORTED');
  expect(error.cause).toBe(reason);
  expect(error.details).toEqual({ operation: 'close', reason: 'aborted', disposersStillRunning: ['stuck'], acquisitionsStillPending: [] });
  expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
  release();
  await error.disposalPromise;
});

test('an already aborted signal still starts cleanup and rejects immediately', async () => {
  const disposed: number[] = [];
  const bag = DiBag.createBuilder().withServices({ value: DiBag.providerWithDisposal({ provider: () => 1, disposeService: value => { disposed.push(value); } }) }).buildContainer();
  bag.resolve('value');
  const controller = new AbortController();
  controller.abort('now');
  const error = await bag.close({ abortSignal: controller.signal }).catch(caughtError => caughtError);
  expect(error.code).toBe('DI_BAG_CLOSE_ABORTED');
  await error.disposalPromise;
  expect(disposed).toEqual([1]);
});

test('bounded close resolves or rejects with the ordinary outcome when cleanup finishes first', async () => {
  const bag = DiBag.createBuilder().withServices({ value: DiBag.providerWithDisposal({ provider: () => 1, disposeService: () => {} }) }).buildContainer();
  bag.resolve('value');
  const controller = new AbortController();
  await bag.close({ waitTimeoutMs: 1_000, abortSignal: controller.signal });
  expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
  expect(await bag.close({ waitTimeoutMs: 1 })).toBeUndefined();

  const failing = DiBag.createBuilder().withServices({ value: DiBag.providerWithDisposal({ provider: () => 1, disposeService: () => { throw new Error('boom'); } }) }).buildContainer();
  failing.resolve('value');
  expect(await failing.close({ waitTimeoutMs: 1_000 }).catch(error => error)).toBeInstanceOf(DiBagDisposalError);
});

test('scopes and forks accept close options; a child deadline names the child disposer', async () => {
  let release!: () => void;
  const root = DiBag.createBuilder().withServices({
    session: DiBag.providerWithDisposal({ provider: () => 1, disposeService: () => new Promise<void>(resolve => { release = resolve; }) }),
  }).buildContainer();
  const child = root.createChildContainer();
  child.resolve('session');
  const childError = await child.close({ waitTimeoutMs: 1 }).catch(error => error);
  expect(childError.details.disposersStillRunning).toEqual(['session']);
  release();
  await childError.disposalPromise;

  const fork = root.createIndependentContainer();
  fork.resolve('session');
  const parentChild = root.createChildContainer();
  parentChild.resolve('session');
  const rootError = await root.close({ waitTimeoutMs: 1 }).catch(error => error);
  expect(rootError.code).toBe('DI_BAG_CLOSE_TIMEOUT');
  expect(rootError.details.disposersStillRunning).toEqual(['session']);
  release();
  await rootError.disposalPromise;
  const forkError = await fork.close({ waitTimeoutMs: 1 }).catch(error => error);
  release();
  await forkError.disposalPromise;
});

test('close rejects malformed options without starting cleanup', async () => {
  const bag = DiBag.createBuilder().withServices({ value: () => 1 }).buildContainer();
  const malformed: readonly (readonly [unknown, string, string])[] = [
    [null, 'options', 'an object'], [[], 'options', 'an object'],
    [{ waitTimeoutMs: 0 }, 'waitTimeoutMs', 'a finite positive number'],
    [{ waitTimeoutMs: Infinity }, 'waitTimeoutMs', 'a finite positive number'],
    [{ waitTimeoutMs: '1' }, 'waitTimeoutMs', 'a finite positive number'],
    [{ abortSignal: {} }, 'abortSignal', 'an AbortSignal'],
    [{ timeoutMs: 1 }, 'options', 'only the own properties: abortSignal, waitTimeoutMs'],
    [{ signal: new AbortController().signal }, 'options', 'only the own properties: abortSignal, waitTimeoutMs'],
    [{ startupOrder: 'sequential' }, 'options', 'only the own properties: abortSignal, waitTimeoutMs'],
    [Object.create({ waitTimeoutMs: 1 }), 'options', 'only the own properties: abortSignal, waitTimeoutMs'],
  ];
  for (const [options, argument, expected] of malformed) {
    const error = await bag.close(options as never).catch(caughtError => caughtError);
    expect(error.code).toBe('DI_BAG_INVALID_ARGUMENT');
    expect(error.details).toEqual({ operation: 'close', argument, expected });
  }
  expect(bag.resolve('value')).toBe(1);
  await bag.close({});
  expect(() => bag.resolve('value')).toThrow('DI_BAG_CLOSED');
});
