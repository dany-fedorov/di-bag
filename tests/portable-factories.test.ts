import { expect, test } from 'bun:test';
import { runInNewContext } from 'node:vm';
import { DiBag } from '../src';
import { withoutBuiltinModule } from './host-builtin-module';

type Config = { readonly url: string };
type Catalog = { names(): Promise<string[]>; close(): Promise<void> };

// The tutorial's "Portable mode" example; keep the two in step.
function portableApplication(log: string[]) {
  return DiBag.createBuilder()
    .register({
      config: DiBag.fromSyncFactory((): Config => ({ url: 'memory:' })),
      catalog: DiBag.withDisposal(
        DiBag.fromAsyncFactory(async ({ config }: { config: Config }): Promise<Catalog> => ({
          names: async () => [config.url],
          close: async () => { log.push('catalog.close'); },
        })),
        catalog => catalog.close(),
      ),
      handler: DiBag.fromSyncFactory(({ catalog }: { catalog: Promise<Catalog> }) => ({
        list: async () => (await catalog).names(),
      })),
    })
    .build();
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
  const feature = DiBag.createBuilder().register({
    hidden: DiBag.fromSyncFactory(() => 'hidden'),
    shown: DiBag.fromAsyncFactory(async ({ hidden }: { hidden: string }) => `${hidden}/shown`),
  }).buildModule(['shown'], { label: 'feature' });
  const bag = withoutBuiltinModule(() => DiBag.createBuilder().installModule(feature).register({
    config: DiBag.withLifetime(DiBag.fromSyncFactory(() => ({ url: 'memory:' })), 'root'),
    db: DiBag.withLifetime(DiBag.withDisposal(DiBag.fromAsyncFactory(async ({ config }: { config: { url: string } }) => ({ url: config.url })), db => { log.push(`end:${db.url}`); }), 'root'),
    projected: DiBag.transformService(DiBag.fromSyncFactory(() => 1), { mode: 'direct', transform: value => value + 1, acquisitionMode: 'raw' }),
  }).build());
  const db = bag.resolve('db');
  expect((await db).url).toBe('memory:');
  expect(await bag.resolve('shown')).toBe('hidden/shown');
  expect(bag.resolve('projected')).toBe(2);
  const scope = bag.createScope();
  const fork = bag.fork();
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
  const bag = withoutBuiltinModule(() => DiBag.createBuilder().register({
    value: DiBag.fromSyncFactory((): object => value),
    // Reached only through a cast: the type rejects a Promise, the runtime is plain raw.
    promise: DiBag.withDisposal(DiBag.fromSyncFactory((): object => pending), resource => { disposed.push(resource); }),
    later: DiBag.fromAsyncFactory(async () => 1),
  }).build());
  expect(bag.resolve('value')).toBe(value);
  expect(bag.resolve('promise')).toBe(pending);
  expect(reads).toBe(0);
  const modes = new Map(bag.inspectGraph().bindings.map(binding => [binding.label, binding.acquisitionMode]));
  expect(modes.get('value')).toBe('raw');
  expect(modes.get('later')).toBe('nativePromise');
  await bag.close();
  expect(disposed).toEqual([pending]);
});

test('fromAsyncFactory exposes the Promise and hands its fulfilled value to the disposer', async () => {
  const pending = Promise.resolve({ id: 1 });
  const disposed: unknown[] = [];
  const bag = withoutBuiltinModule(() => DiBag.createBuilder().register({
    value: DiBag.withDisposal(DiBag.fromAsyncFactory(() => pending), resource => { disposed.push(resource); }),
  }).build());
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
  const bag = withoutBuiltinModule(() => DiBag.createBuilder().register({
    value: DiBag.withDisposal(DiBag.fromAsyncFactory(() => pending), resource => { disposed.push(resource); }),
  }).build());
  expect(bag.resolve('value')).toBe(pending);
  await bag.close();
  expect(disposed).toEqual([{ id: 1 }]);
});

test('fromAsyncFactory with a non-Promise fails that acquisition with a TypeError and never calls then', async () => {
  let thenCalls = 0;
  const thenable = { then() { thenCalls++; } };
  const bag = withoutBuiltinModule(() => DiBag.createBuilder().register({
    thenable: DiBag.fromAsyncFactory(() => thenable as never),
    plain: DiBag.fromAsyncFactory(() => 7 as never),
  }).build());
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
  const bag = withoutBuiltinModule(() => DiBag.createBuilder().register({
    sync: DiBag.fromSyncFactory((_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(disposerCtx => { events.push(`sync:${disposerCtx.reason}`); });
      return factoryCtx.signal.aborted;
    }, { context: 'acquisition' }),
    async: DiBag.fromAsyncFactory(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(disposerCtx => { events.push(`async:${disposerCtx.reason}`); });
      await Promise.resolve();
      return factoryCtx.signal.aborted;
    }, { context: 'acquisition' }),
  }).build());
  expect(bag.resolve('sync')).toBe(false);
  expect(await bag.resolve('async')).toBe(false);
  await bag.close();
  expect(events.sort()).toEqual(['async:no-service-disposer', 'sync:no-service-disposer']);
});
