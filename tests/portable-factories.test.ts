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
      config: DiBag.providerWithLifetime({ provider: DiBag.createProvider((): Config => ({ url: 'memory:' }), { factoryReturnKind: 'sync-value' }), lifetime: 'scoped:one-per-container' }),
      catalog: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: DiBag.createProvider(async ({ config }: { config: Config }): Promise<Catalog> => ({
          names: async () => [config.url],
          close: async () => { log.push('catalog.close'); },
        }), { factoryReturnKind: 'native-promise' }), disposeService: catalog => catalog.close() }), lifetime: 'scoped:one-per-container' }),
      handler: DiBag.providerWithLifetime({ provider: DiBag.createProvider(({ catalog }: { catalog: Promise<Catalog> }) => ({
        list: async () => (await catalog).names(),
      }), { factoryReturnKind: 'sync-value' }), lifetime: 'scoped:one-per-container' }),
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
    hidden: DiBag.providerWithLifetime({ provider: DiBag.createProvider(() => 'hidden', { factoryReturnKind: 'sync-value' }), lifetime: 'scoped:one-per-container' }),
    shown: DiBag.providerWithLifetime({ provider: DiBag.createProvider(async ({ hidden }: { hidden: string }) => `${hidden}/shown`, { factoryReturnKind: 'native-promise' }), lifetime: 'scoped:one-per-container' }),
  }).buildModule({ exportedServiceKeys: ['shown'], moduleLabel: 'feature' });
  const bag = withoutBuiltinModule(() => DiBag.createBuilder().withInstalledModules([feature]).withServices({
    config: DiBag.providerWithLifetime({ provider: DiBag.createProvider(() => ({ url: 'memory:' }), { factoryReturnKind: 'sync-value' }), lifetime: 'singleton:one-per-container-tree' }),
    db: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: DiBag.createProvider(async ({ config }: { config: { url: string } }) => ({ url: config.url }), { factoryReturnKind: 'native-promise' }), disposeService: db => { log.push(`end:${db.url}`); } }), lifetime: 'singleton:one-per-container-tree' }),
    projected: DiBag.providerWithLifetime({ provider: DiBag.providerWithTransformedService({ provider: DiBag.createProvider(() => 1, { factoryReturnKind: 'sync-value' }), transformService: value => value + 1, callbackReceives: 'exposed-service', transformReturnKind: 'uninspected' }), lifetime: 'scoped:one-per-container' }),
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

test('sync-value exposes the exact value and never reads then', async () => {
  let reads = 0;
  const value: object = Object.defineProperty({}, 'then', { get() { reads++; throw new Error('never read'); } });
  const pending: object = Promise.resolve(7);
  const disposed: unknown[] = [];
  const bag = withoutBuiltinModule(() => DiBag.createBuilder().withServices({
    value: DiBag.providerWithLifetime({ provider: DiBag.createProvider((): object => value, { factoryReturnKind: 'sync-value' }), lifetime: 'scoped:one-per-container' }),
    // Reached only through a cast: the type rejects a Promise, the runtime is plain raw.
    promise: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: DiBag.createProvider((): object => pending, { factoryReturnKind: 'sync-value' }), disposeService: resource => { disposed.push(resource); } }), lifetime: 'scoped:one-per-container' }),
    later: DiBag.providerWithLifetime({ provider: DiBag.createProvider(async () => 1, { factoryReturnKind: 'native-promise' }), lifetime: 'scoped:one-per-container' }),
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

test('native-promise exposes the Promise and hands its fulfilled value to the disposer', async () => {
  const pending = Promise.resolve({ id: 1 });
  const disposed: unknown[] = [];
  const bag = withoutBuiltinModule(() => DiBag.createBuilder().withServices({
    value: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: DiBag.createProvider(() => pending, { factoryReturnKind: 'native-promise' }), disposeService: resource => { disposed.push(resource); } }), lifetime: 'scoped:one-per-container' }),
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
] as const) test(`native-promise observes ${name} through the engine's own check`, async () => {
  const pending = make();
  const disposed: unknown[] = [];
  const bag = withoutBuiltinModule(() => DiBag.createBuilder().withServices({
    value: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: DiBag.createProvider(() => pending, { factoryReturnKind: 'native-promise' }), disposeService: resource => { disposed.push(resource); } }), lifetime: 'scoped:one-per-container' }),
  }).buildContainer());
  expect(bag.resolve('value')).toBe(pending);
  await bag.close();
  expect(disposed).toEqual([{ id: 1 }]);
});

test('native-promise with a non-Promise fails that acquisition with a TypeError and never calls then', async () => {
  let thenCalls = 0;
  const thenable = { then() { thenCalls++; } };
  const bag = withoutBuiltinModule(() => DiBag.createBuilder().withServices({
    thenable: DiBag.providerWithLifetime({ provider: DiBag.createProvider(() => thenable as never, { factoryReturnKind: 'native-promise' }), lifetime: 'scoped:one-per-container' }),
    plain: DiBag.providerWithLifetime({ provider: DiBag.createProvider(() => 7 as never, { factoryReturnKind: 'native-promise' }), lifetime: 'scoped:one-per-container' }),
  }).buildContainer());
  expect(() => bag.resolve('thenable')).toThrow(TypeError);
  expect(() => bag.resolve('plain')).toThrow(TypeError);
  expect(thenCalls).toBe(0);
  await bag.close();
});

test('createProvider rejects invalid callbacks and options with DI_BAG_INVALID_ARGUMENT', () => {
  const create = DiBag.createProvider as (...args: unknown[]) => unknown;
  expect(() => create(1)).toThrow('DI_BAG_INVALID_ARGUMENT: createProvider requires a factory function');
  expect(() => create(undefined)).toThrow('DI_BAG_INVALID_ARGUMENT: createProvider requires a factory function');
  expect(() => create(() => 1, null)).toThrow('DI_BAG_INVALID_ARGUMENT: createProvider requires one options object');
  expect(() => create(() => 1, { extra: true })).toThrow('DI_BAG_INVALID_ARGUMENT: createProvider does not accept the option extra');
  expect(() => create(async () => 1, { factoryReturnKind: 'invalid' })).toThrow('DI_BAG_INVALID_ARGUMENT: createProvider factoryReturnKind must name a supported return policy');
  expect(() => create(async () => 1, { factoryReceivesContext: 'later' })).toThrow('DI_BAG_INVALID_ARGUMENT: createProvider factoryReceivesContext must be true when present');
});

test('contextual helpers receive the signal and own pushed disposers', async () => {
  const events: string[] = [];
  const bag = withoutBuiltinModule(() => DiBag.createBuilder().withServices({
    sync: DiBag.providerWithLifetime({ provider: DiBag.createProvider((_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(disposerCtx => { events.push(`sync:${disposerCtx.reason}`); });
      return factoryCtx.abortSignal.aborted;
    }, { factoryReturnKind: 'sync-value', factoryReceivesContext: true }), lifetime: 'scoped:one-per-container' }),
    async: DiBag.providerWithLifetime({ provider: DiBag.createProvider(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(disposerCtx => { events.push(`async:${disposerCtx.reason}`); });
      await Promise.resolve();
      return factoryCtx.abortSignal.aborted;
    }, { factoryReturnKind: 'native-promise', factoryReceivesContext: true }), lifetime: 'scoped:one-per-container' }),
  }).buildContainer());
  expect(bag.resolve('sync')).toBe(false);
  expect(await bag.resolve('async')).toBe(false);
  await bag.close();
  expect(events.sort()).toEqual(['async:no-service-disposer', 'sync:no-service-disposer']);
});
