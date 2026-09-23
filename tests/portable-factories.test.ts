import { expect, test } from 'bun:test';
import { runInNewContext } from 'node:vm';
import { DiBag } from '../src';
import { withoutBuiltinModule } from './host-builtin-module';

type Config = { readonly url: string };
type Catalog = { names(): Promise<string[]>; close(): Promise<void> };

// The tutorial's "Portable mode" example; keep the two in step.
function portableApplication(log: string[]) {
  return DiBag.createBuilder()
    .withServices({
      config: DiBag.createProvider((): Config => ({ url: 'memory:' }), { factoryReturnKind: 'sync-value' }),
      catalog: DiBag.withDisposal(
        DiBag.createProvider(async ({ config }: { config: Config }): Promise<Catalog> => ({
          names: async () => [config.url],
          close: async () => { log.push('catalog.close'); },
        }), { factoryReturnKind: 'native-promise' }),
        catalog => catalog.close(),
      ),
      handler: DiBag.createProvider(({ catalog }: { catalog: Promise<Catalog> }) => ({
        list: async () => (await catalog).names(),
      }), { factoryReturnKind: 'sync-value' }),
    })
    .buildContainer();
}

test('the tutorial portable example builds and runs without process.getBuiltinModule', async () => {
  const log: string[] = [];
  const app = withoutBuiltinModule(() => portableApplication(log));
  expect(app.resolve('config')).toEqual({ url: 'memory:' });
  expect(app.resolve('catalog')).toBeInstanceOf(Promise);
  expect(await app.resolve('handler').list()).toEqual(['memory:']);
  await app.close();
  expect(log).toEqual(['catalog.close']);
});

test('modules, lifetimes, scopes, forks and direct transforms stay portable', async () => {
  const log: string[] = [];
  const feature = DiBag.createBuilder().withServices({
    hidden: DiBag.createProvider(() => 'hidden', { factoryReturnKind: 'sync-value' }),
    shown: DiBag.createProvider(async ({ hidden }: { hidden: string }) => `${hidden}/shown`, { factoryReturnKind: 'native-promise' }),
  }).buildModule({ exportedServiceKeys: ['shown'], moduleLabel: 'feature' });
  const bag = withoutBuiltinModule(() => DiBag.createBuilder().withInstalledModules([feature]).withServices({
    config: DiBag.withLifetime(DiBag.createProvider(() => ({ url: 'memory:' }), { factoryReturnKind: 'sync-value' }), 'root'),
    db: DiBag.withLifetime(DiBag.withDisposal(DiBag.createProvider(async ({ config }: { config: { url: string } }) => ({ url: config.url }), { factoryReturnKind: 'native-promise' }), db => { log.push(`end:${db.url}`); }), 'root'),
    projected: DiBag.transformService(DiBag.createProvider(() => 1, { factoryReturnKind: 'sync-value' }), { mode: 'direct', transform: value => value + 1, acquisitionMode: 'uninspected' }),
  }).buildContainer());
  const db = bag.resolve('db');
  expect((await db).url).toBe('memory:');
  expect(await bag.resolve('shown')).toBe('hidden/shown');
  expect(bag.resolve('projected')).toBe(2);
  const scope = bag.createChildContainer();
  const fork = bag.createIndependentContainer();
  withoutBuiltinModule(() => {
    expect(scope.resolve('db')).toBe(db);
    expect(fork.resolve('config')).toEqual({ url: 'memory:' });
  });
  await scope.close();
  await fork.close();
  await bag.close();
  expect(log).toEqual(['end:memory:']);
});

test('fromSyncFactory exposes the exact value, never reads then, and is a raw stage', async () => {
  let reads = 0;
  const value: object = Object.defineProperty({}, 'then', { get() { reads++; throw new Error('never read'); } });
  const pending: object = Promise.resolve(7);
  const disposed: unknown[] = [];
  const bag = withoutBuiltinModule(() => DiBag.createBuilder().withServices({
    value: DiBag.createProvider((): object => value, { factoryReturnKind: 'sync-value' }),
    // Reached only through a cast: the type rejects a Promise, the runtime is plain raw.
    promise: DiBag.withDisposal(DiBag.createProvider((): object => pending, { factoryReturnKind: 'sync-value' }), resource => { disposed.push(resource); }),
    later: DiBag.createProvider(async () => 1, { factoryReturnKind: 'native-promise' }),
  }).buildContainer());
  expect(bag.resolve('value')).toBe(value);
  expect(bag.resolve('promise')).toBe(pending);
  expect(reads).toBe(0);
  const modes = new Map(bag.graphSnapshot().bindings.map(binding => [binding.label, binding.factoryReturnKind]));
  expect(modes.get('value')).toBe('sync-value');
  expect(modes.get('later')).toBe('native-promise');
  await bag.close();
  expect(disposed).toEqual([pending]);
});

test('fromAsyncFactory exposes the Promise and hands its fulfilled value to the disposer', async () => {
  const pending = Promise.resolve({ id: 1 });
  const disposed: unknown[] = [];
  const bag = withoutBuiltinModule(() => DiBag.createBuilder().withServices({
    value: DiBag.withDisposal(DiBag.createProvider(() => pending, { factoryReturnKind: 'native-promise' }), resource => { disposed.push(resource); }),
  }).buildContainer());
  expect(bag.resolve('value')).toBe(pending);
  expect(bag.resolve('value')).toBe(pending);
  await bag.close();
  expect(disposed).toEqual([{ id: 1 }]);
});

for (const [name, make] of [
  ['a cross-realm Promise', () => runInNewContext('Promise.resolve({ id: 1 })') as Promise<{ id: number }>],
  ['a Promise subclass with an own then override', () => {
    class ServicePromise<T> extends Promise<T> {}
    const promise = ServicePromise.resolve({ id: 1 });
    promise.then = () => { throw new Error('own then must not run'); };
    return promise as Promise<{ id: number }>;
  }],
] as const) test(`fromAsyncFactory observes ${name} through the engine's own check`, async () => {
  const pending = make();
  const disposed: unknown[] = [];
  const bag = withoutBuiltinModule(() => DiBag.createBuilder().withServices({
    value: DiBag.withDisposal(DiBag.createProvider(() => pending, { factoryReturnKind: 'native-promise' }), resource => { disposed.push(resource); }),
  }).buildContainer());
  expect(bag.resolve('value')).toBe(pending);
  await bag.close();
  expect(disposed).toEqual([{ id: 1 }]);
});

test('fromAsyncFactory with a non-Promise fails that acquisition with a TypeError and never calls then', async () => {
  let thenCalls = 0;
  const thenable = { then() { thenCalls++; } };
  const bag = withoutBuiltinModule(() => DiBag.createBuilder().withServices({
    thenable: DiBag.createProvider(() => thenable as never, { factoryReturnKind: 'native-promise' }),
    plain: DiBag.createProvider(() => 7 as never, { factoryReturnKind: 'native-promise' }),
  }).buildContainer());
  expect(() => bag.resolve('thenable')).toThrow(TypeError);
  expect(() => bag.resolve('plain')).toThrow(TypeError);
  expect(thenCalls).toBe(0);
  await bag.close();
});

test('the helpers reject invalid callbacks and options with DI_BAG_INVALID_FACTORY', () => {
  const sync = DiBag.fromSyncFactory as (...args: unknown[]) => unknown;
  const async = DiBag.fromAsyncFactory as (...args: unknown[]) => unknown;
  expect(() => sync(1)).toThrow('DI_BAG_INVALID_FACTORY: fromSyncFactory requires a function');
  expect(() => async(undefined)).toThrow('DI_BAG_INVALID_FACTORY: fromAsyncFactory requires a function');
  expect(() => sync(() => 1, null)).toThrow('DI_BAG_INVALID_FACTORY: fromSyncFactory options must be an object');
  expect(() => sync(() => 1, { acquisitionMode: 'raw' })).toThrow('DI_BAG_INVALID_FACTORY: fromSyncFactory selects its acquisitionMode itself');
  expect(() => async(async () => 1, { acquisitionMode: 'nativePromise' })).toThrow('DI_BAG_INVALID_FACTORY: fromAsyncFactory selects its acquisitionMode itself');
  expect(() => async(async () => 1, { context: 'later' })).toThrow('DI_BAG_INVALID_FACTORY: fromAsyncFactory context must be acquisition');
});

test('contextual helpers receive the signal and own pushed disposers', async () => {
  const events: string[] = [];
  const bag = withoutBuiltinModule(() => DiBag.createBuilder().withServices({
    sync: DiBag.createProvider((_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(disposerCtx => { events.push(`sync:${disposerCtx.reason}`); });
      return factoryCtx.abortSignal.aborted;
    }, { factoryReturnKind: 'sync-value', factoryReceivesContext: true }),
    async: DiBag.createProvider(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(disposerCtx => { events.push(`async:${disposerCtx.reason}`); });
      await Promise.resolve();
      return factoryCtx.abortSignal.aborted;
    }, { factoryReturnKind: 'native-promise', factoryReceivesContext: true }),
  }).buildContainer());
  expect(bag.resolve('sync')).toBe(false);
  expect(await bag.resolve('async')).toBe(false);
  await bag.close();
  expect(events.sort()).toEqual(['async:no-service-disposer', 'sync:no-service-disposer']);
});
