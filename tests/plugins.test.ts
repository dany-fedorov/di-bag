import { expect, test } from 'bun:test';
import { DiBag, DiBagCleanupError, DiBagPluginValidationError, DiBagServiceReadinessError } from '../src';
import type { LifecycleEvent } from '../src';
import { deferred } from './helpers';

test('plugin validation retains raw source ownership on success and failure', async () => {
  const valid = { run: () => 42 };
  const invalid = { run: 42 };
  const disposed: unknown[] = [];
  const wrap = (value: unknown) => DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: {
    apiVersion: 1,
    create: () => value,
    dispose: (acquired: unknown) => { disposed.push(acquired); },
  }, factoryReturnKind: 'uninspected', isValidPluginOutput: (value: unknown): value is { run(): number } =>
      typeof value === 'object' && value !== null &&
      'run' in value && typeof value.run === 'function' });
  const good = DiBag.createBuilder().withServices({ plugin: wrap(valid) }).buildContainer();
  expect(good.resolve('plugin')).toBe(valid);
  expect(good.resolve('plugin').run()).toBe(42);
  const bad = DiBag.createBuilder().withServices({ plugin: wrap(invalid) }).buildContainer();
  expect(() => bad.resolve('plugin')).toThrow(DiBagPluginValidationError);
  await Promise.all([good.close(), bad.close()]);
  expect(disposed).toHaveLength(2);
  expect(disposed).toContain(valid);
  expect(disposed).toContain(invalid);
});

test('plugin descriptor requires own protocol fields before factory effects', () => {
  let created = 0;
  const invalid = [
    null,
    [],
    { apiVersion: 2, create: () => { created++; } },
    { apiVersion: 1 },
    { apiVersion: 1, create: 1 },
    { apiVersion: 1, create: () => {}, dispose: undefined },
  ];
  for (const descriptor of invalid) {
    let failure: unknown;
    try { DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: descriptor, factoryReturnKind: 'uninspected', isValidPluginOutput: (value): value is unknown => value === value }); }
    catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(DiBagPluginValidationError);
    expect((failure as DiBagPluginValidationError).phase).toBe('descriptor');
    expect((failure as DiBagPluginValidationError).details.operation).toBe('createProviderFromPlugin');
  }
  const inherited = Object.create({ apiVersion: 1, create: () => { created++; } });
  expect(() => DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: inherited, factoryReturnKind: 'uninspected', isValidPluginOutput: (value): value is unknown => value === value })).toThrow(DiBagPluginValidationError);
  expect(created).toBe(0);
});

test('plugin preflight validates dependencies and options before descriptor reads', () => {
  let reads = 0;
  const descriptor = {
    get apiVersion() { reads++; return 1; },
    create: () => 1,
  };
  expect(() => Reflect.apply(DiBag.createProviderFromPlugin, undefined, [{ dependencies: [], pluginDescriptor: descriptor,
    isValidPluginOutput: (value: unknown): value is number => typeof value === 'number',
  }])).toThrow('factoryReturnKind');
  expect(reads).toBe(0);
  const key = Symbol('dependency'); const dependency = DiBag.createToken(key).forService<number>();
  expect(() => Reflect.apply(DiBag.createProviderFromPlugin, undefined, [{ dependencies: [{ ...dependency }], pluginDescriptor: descriptor,
    factoryReturnKind: 'uninspected', isValidPluginOutput: (value: unknown): value is number => typeof value === 'number',
  }])).toThrow('token');
  expect(reads).toBe(0);
});

test('plugin descriptor preflight preserves accessor errors and ignores extra getters', () => {
  const apiVersionFailure = new Error('apiVersion getter');
  const version = {
    get apiVersion() { throw apiVersionFailure; },
    create: () => 1,
  };
  expect(() => DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: version, factoryReturnKind: 'uninspected', isValidPluginOutput: (value): value is number => typeof value === 'number' })).toThrow(apiVersionFailure);
  let extraReads = 0;
  const provider = DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: {
    apiVersion: 1,
    create: () => 1,
    get ignored() { extraReads++; return 'ignored'; },
  }, factoryReturnKind: 'uninspected', isValidPluginOutput: (value): value is number => typeof value === 'number' });
  const bag = DiBag.createBuilder().withServices({ provider }).buildContainer();
  expect(bag.resolve('provider')).toBe(1);
  expect(extraReads).toBe(0);
  return bag.close();
});

test('plugin snapshots dependencies, options and callbacks before later mutation', async () => {
  const oneKey = Symbol('one'); const one = DiBag.createToken(oneKey).forService<number>();
  const twoKey = Symbol('two'); const two = DiBag.createToken(twoKey).forService<number>();
  const dependencies: unknown[] = [one];
  const options = {
    dependencies,
    factoryReturnKind: 'uninspected' as const,
    isValidPluginOutput: (value: unknown): value is number => typeof value === 'number',
    pluginDescriptor: undefined as unknown,
  };
  const descriptor = {
    get apiVersion() {
      dependencies[0] = two;
      options.isValidPluginOutput = (value: unknown): value is number => value === 2;
      return 1;
    },
    create: (value: number) => value,
  };
  options.pluginDescriptor = descriptor;
  const provider = Reflect.apply(DiBag.createProviderFromPlugin, undefined, [options]);
  dependencies[0] = two;
  descriptor.create = () => 2;
  const builder = DiBag.createBuilder().withTokenService(one, DiBag.createProvider(() => 1, { factoryReturnKind: 'uninspected' })).withTokenService(two, DiBag.createProvider(() => 2, { factoryReturnKind: 'uninspected' }));
  const added = Reflect.apply(builder.withServices, builder, [{ provider }]);
  const bag = Reflect.apply(added.buildContainer, added, []) as { resolve(key: string): unknown; close(): Promise<void> };
  expect(bag.resolve('provider')).toBe(1);
  await bag.close();
});

test('plugin routes required optional lazy and all dependency references positionally', async () => {
  const requiredKey = Symbol('required'); const required = DiBag.createToken(requiredKey).forService<number>();
  const absentKey = Symbol('absent'); const absent = DiBag.createToken(absentKey).forService<number>();
  const lazyKey = Symbol('lazy'); const lazy = DiBag.createToken(lazyKey).forService<number>();
  const collectedKey = Symbol('collected'); const collected = DiBag.createToken(collectedKey).forCollectionOf<number>();
  const provider = DiBag.createProviderFromPlugin({ dependencies: [required, DiBag.optional(absent), DiBag.lazy(lazy), collected], pluginDescriptor: {
    apiVersion: 1,
    create: (value: number, maybe: number | undefined, get: () => number, all: readonly number[]) => ({ value, maybe, get, all }),
  }, factoryReturnKind: 'uninspected', isValidPluginOutput: (value): value is { value: number; maybe: number | undefined; get(): number; all: readonly number[] } => typeof value === 'object' && value !== null });
  const bag = DiBag.createBuilder().withTokenService(required, DiBag.createProvider(() => 1, { factoryReturnKind: 'uninspected' })).withTokenService(lazy, DiBag.createProvider(() => 2, { factoryReturnKind: 'uninspected' })).withCollectionContribution({ collectionToken: collected, provider: DiBag.createProvider(() => 3, { factoryReturnKind: 'uninspected' }) }).withCollectionContribution({ collectionToken: collected, provider: DiBag.createProvider(() => 4, { factoryReturnKind: 'uninspected' }) }).withServices({ provider }).buildContainer();
  const value = bag.resolve('provider');
  expect(value.value).toBe(1); expect(value.maybe).toBeUndefined(); expect(value.get()).toBe(2); expect(value.all).toEqual([3, 4]);
  await bag.close();
});

test('raw plugin validation does not assimilate values or validator results', async () => {
  const hostile = { get then(): never { throw new Error('must not read then'); } };
  const never = new Promise<void>(() => {});
  for (const value of [hostile, never, undefined, () => 3]) {
    const provider = DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: { apiVersion: 1, create: () => value }, factoryReturnKind: 'uninspected', isValidPluginOutput: (candidate): candidate is typeof value => candidate === value });
    const bag = DiBag.createBuilder().withServices({ provider }).buildContainer();
    expect(bag.resolve('provider')).toBe(value);
    await bag.close();
  }
  for (const result of [false, 1, Promise.resolve(true), { then() { return true; } }]) {
    const provider = DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: { apiVersion: 1, create: () => 1 }, factoryReturnKind: 'uninspected', isValidPluginOutput: (() => result) as unknown as (value: unknown) => value is number });
    const bag = DiBag.createBuilder().withServices({ provider }).buildContainer();
    let failure: unknown;
    try { bag.resolve('provider'); } catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(DiBagPluginValidationError);
    expect((failure as DiBagPluginValidationError).phase).toBe('output');
    await bag.close();
  }
});

test('native plugin validates fulfilled values, caches final output and releases source ownership', async () => {
  const gate = deferred<{ id: number }>();
  const disposed: { id: number }[] = [];
  const provider = DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: {
    apiVersion: 1,
    create: () => gate.promise,
    dispose(value: { id: number }) { disposed.push(value); },
  }, factoryReturnKind: 'native-promise', isValidPluginOutput: (value): value is { id: number } => typeof value === 'object' && value !== null && 'id' in value });
  const bag = DiBag.createBuilder().withServices({ provider }).buildContainer();
  const first = bag.resolve('provider'); const second = bag.resolve('provider');
  expect(first).toBe(second);
  const closing = bag.close();
  gate.resolve({ id: 7 });
  await expect(first).resolves.toEqual({ id: 7 });
  await closing;
  expect(disposed).toEqual([{ id: 7 }]);
});

test('native plugin rejection and output validation preserve causes and ownership', async () => {
  const rejection = new Error('source rejection');
  const rejected = DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: { apiVersion: 1, create: () => Promise.reject(rejection) }, factoryReturnKind: 'native-promise', isValidPluginOutput: (value): value is number => typeof value === 'number' });
  const rejectedBag = DiBag.createBuilder().withServices({ rejected }).buildContainer();
  await expect(rejectedBag.resolve('rejected')).rejects.toBe(rejection);
  await rejectedBag.close();
  const disposed: unknown[] = [];
  const invalid = { id: 'invalid' };
  const invalidProvider = DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: {
    apiVersion: 1, create: () => Promise.resolve(invalid), dispose: (value: unknown) => { disposed.push(value); },
  }, factoryReturnKind: 'native-promise', isValidPluginOutput: (value): value is { id: number } => typeof value === 'object' && value !== null && (value as { id?: unknown }).id === 1 });
  const invalidBag = DiBag.createBuilder().withServices({ invalidProvider }).buildContainer();
  await expect(invalidBag.resolve('invalidProvider')).rejects.toBeInstanceOf(DiBagPluginValidationError);
  await invalidBag.close();
  expect(disposed).toEqual([invalid]);
});

test('native plugins require a genuine Promise source', async () => {
  let validated = 0;
  const provider = DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: {
    apiVersion: 1,
    create: () => ({ then() { throw new Error('must not assimilate'); } }),
  }, factoryReturnKind: 'native-promise', isValidPluginOutput: (value): value is number => { validated++; return typeof value === 'number'; } });
  const bag = DiBag.createBuilder().withServices({ provider }).buildContainer();
  await expect(bag.resolve('provider')).rejects.toBeInstanceOf(TypeError);
  expect(validated).toBe(0);
  await bag.close();
});

test('startup rollback releases an accepted plugin source once', async () => {
  const failure = new Error('startup failure');
  const disposed: number[] = [];
  const plugin = DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: {
    apiVersion: 1, create: () => 5, dispose: (value: unknown) => { if (typeof value === 'number') disposed.push(value); },
  }, factoryReturnKind: 'uninspected', isValidPluginOutput: (value): value is number => typeof value === 'number' });
  const builder = DiBag.createBuilder().withServices({ plugin, failure: DiBag.createProvider(() => { throw failure; }, { factoryReturnKind: 'uninspected' }) });
  let caught: unknown;
  try { await builder.buildContainer().ensureServicesReady(['plugin', 'failure']); } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(DiBagServiceReadinessError);
  expect((caught as DiBagServiceReadinessError).cause).toBe(failure);
  expect(disposed).toEqual([5]);
});

test('plugin callbacks use no receiver and preserve factory and validator failures', async () => {
  const factoryFailure = new Error('factory failure');
  const failingFactory = DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: {
    apiVersion: 1,
    create(this: undefined) { expect(this).toBeUndefined(); throw factoryFailure; },
  }, factoryReturnKind: 'uninspected', isValidPluginOutput: (value): value is number => typeof value === 'number' });
  const factoryBag = DiBag.createBuilder().withServices({ failingFactory }).buildContainer();
  expect(() => factoryBag.resolve('failingFactory')).toThrow(factoryFailure);
  await factoryBag.close();
  const validatorFailure = new Error('validator failure');
  const disposed: number[] = [];
  const failingValidator = DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: {
    apiVersion: 1,
    create(this: undefined) { expect(this).toBeUndefined(); return 4; },
    dispose(this: undefined, value: number) { expect(this).toBeUndefined(); disposed.push(value); },
  }, factoryReturnKind: 'uninspected', isValidPluginOutput(this: void, _value): _value is number { expect(this).toBeUndefined(); throw validatorFailure; } });
  const validatorBag = DiBag.createBuilder().withServices({ failingValidator }).buildContainer();
  expect(() => validatorBag.resolve('failingValidator')).toThrow(validatorFailure);
  await validatorBag.close();
  expect(disposed).toEqual([4]);
});

test('plugin composition retains module privacy, aliases, contributions and selected sharing', async () => {
  const dependencyKey = Symbol('dependency'); const dependency = DiBag.createToken(dependencyKey).forService<number>();
  const collectionKey = Symbol('collection'); const collection = DiBag.createToken(collectionKey).forCollectionOf<{ id: number }>();
  let created = 0;
  const plugin = DiBag.createProviderFromPlugin({ dependencies: [dependency], pluginDescriptor: {
    apiVersion: 1,
    create: (id: number) => ({ id, sequence: ++created }),
  }, factoryReturnKind: 'uninspected', isValidPluginOutput: (value): value is { id: number; sequence: number } => typeof value === 'object' && value !== null });
  const feature = DiBag.createBuilder().withServices({ plugin }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'plugin' }).withCollectionContribution({ collectionToken: collection, provider: plugin }).buildModule({ exportedServiceKeys: ['plugin', 'copy'] });
  const bag = DiBag.createBuilder().withTokenService(dependency, DiBag.createProvider(() => 1, { factoryReturnKind: 'uninspected' })).withInstalledModules([feature]).buildContainer();
  const parent = bag.resolve('plugin');
  expect(bag.resolve('copy')).toBe(parent);
  expect(bag.resolveCollection(collection).map(value => value.id)).toEqual([1]);
  const child = bag.createChildContainer([dependency], { [dependencyKey]: DiBag.createProvider(() => 2, { factoryReturnKind: 'uninspected' }) }, { sharedParentServiceKeys: ['plugin'] });
  expect(child.resolve('plugin')).toBe(parent);
  expect(created).toBe(2);
  await child.close(); await bag.close();
  const privateKey = Symbol('private'); const privateDependency = DiBag.createToken(privateKey).forService<number>();
  const privatePlugin = DiBag.createProviderFromPlugin({ dependencies: [privateDependency], pluginDescriptor: {
    apiVersion: 1, create: (id: number) => ({ id }),
  }, factoryReturnKind: 'uninspected', isValidPluginOutput: (value): value is { id: number } => typeof value === 'object' && value !== null });
  const privateFeature = DiBag.createBuilder().withTokenService(privateDependency, DiBag.createProvider(() => 9, { factoryReturnKind: 'uninspected' })).withServices({ privatePlugin }).buildModule({ exportedServiceKeys: ['privatePlugin'] });
  const privateBag = DiBag.createBuilder().withInstalledModules([privateFeature]).buildContainer();
  expect(privateBag.resolve('privatePlugin').id).toBe(9);
  await privateBag.close();
});

test('plugin observers retain the canonical acquisition and cleanup events', async () => {
  const events: string[] = [];
  const observed = DiBag.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent(event) { events.push(event.kind); }, onObserverFailure() {} }] });
  const plugin = observed.createProviderFromPlugin({ dependencies: [], pluginDescriptor: {
    apiVersion: 1, create: () => ({ id: 1 }), dispose: () => {},
  }, factoryReturnKind: 'uninspected', isValidPluginOutput: (value): value is { id: number } => typeof value === 'object' && value !== null });
  const bag = observed.createBuilder().withServices({ plugin }).buildContainer();
  bag.resolve('plugin'); await bag.close();
  expect(events.filter(kind => kind === 'acquisition-started')).toHaveLength(1);
  expect(events.filter(kind => kind === 'acquisition-ready')).toHaveLength(1);
  expect(events.filter(kind => kind === 'cleanup-started')).toHaveLength(1);
  expect(events.filter(kind => kind === 'cleanup-completed')).toHaveLength(1);
});

test('native plugin readiness waits for source validation', async () => {
  const gate = deferred<{ id: number }>();
  let validated = 0;
  const plugin = DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: {
    apiVersion: 1, create: () => gate.promise,
  }, factoryReturnKind: 'native-promise', isValidPluginOutput: (value): value is { id: number } => {
      validated++;
      return typeof value === 'object' && value !== null && 'id' in value;
    } });
  const starting = DiBag.createBuilder().withServices({ plugin }).buildContainer().ensureServicesReady(['plugin']);
  let ready = false;
  void starting.then(() => { ready = true; });
  await Promise.resolve();
  expect(validated).toBe(0);
  expect(ready).toBe(false);
  gate.resolve({ id: 1 });
  const bag = await starting;
  expect(validated).toBe(1);
  expect(ready).toBe(true);
  await bag.close();
});

test('plugin close waits for accepted disposer cleanup exactly once', async () => {
  const gate = deferred<void>();
  let disposed = 0;
  const plugin = DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: {
    apiVersion: 1,
    create: () => 1,
    dispose: async () => { disposed++; await gate.promise; },
  }, factoryReturnKind: 'uninspected', isValidPluginOutput: (value): value is number => typeof value === 'number' });
  const bag = DiBag.createBuilder().withServices({ plugin }).buildContainer();
  expect(bag.resolve('plugin')).toBe(1);
  const closing = bag.close();
  let closed = false;
  void closing.then(() => { closed = true; });
  await Promise.resolve(); await Promise.resolve();
  expect(disposed).toBe(1);
  expect(closed).toBe(false);
  gate.resolve();
  await closing;
  expect(disposed).toBe(1);
});

test('plugin validation errors survive one failed retirement cleanup', async () => {
  const validationFailure = new Error('validation failure');
  const cleanupFailure = new Error('cleanup failure');
  let disposed = 0;
  const plugin = DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: {
    apiVersion: 1,
    create: () => 1,
    dispose: () => { disposed++; throw cleanupFailure; },
  }, factoryReturnKind: 'uninspected', isValidPluginOutput: (_value: unknown): _value is number => { throw validationFailure; } });
  const bag = DiBag.createBuilder().withServices({ plugin }).buildContainer();
  expect(() => bag.resolve('plugin')).toThrow(validationFailure);
  let closeFailure: unknown;
  try { await bag.close(); } catch (error) { closeFailure = error; }
  expect(closeFailure).toBeInstanceOf(DiBagCleanupError);
  expect((closeFailure as DiBagCleanupError).failures.map(failure => failure.error)).toEqual([cleanupFailure]);
  expect(disposed).toBe(1);
});

test('plugin observer lifecycle events identify its canonical acquisition', async () => {
  const events: LifecycleEvent[] = [];
  const observed = DiBag.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent(event) { events.push(event); }, onObserverFailure() {} }] });
  const plugin = observed.createProviderFromPlugin({ dependencies: [], pluginDescriptor: {
    apiVersion: 1, create: () => ({ id: 1 }), dispose: () => {},
  }, factoryReturnKind: 'uninspected', isValidPluginOutput: (value): value is { id: number } => typeof value === 'object' && value !== null });
  const bag = observed.createBuilder().withServices({ plugin }).buildContainer();
  bag.resolve('plugin');
  const inspection = bag.serviceSnapshot('plugin');
  const id = inspection.acquisitions[0]!.acquisitionId;
  await bag.close();
  await Promise.resolve(); await Promise.resolve();
  const lifecycle = events.filter(event => 'acquisitionId' in event);
  expect(lifecycle.map(event => event.acquisitionId)).toEqual([id, id, id, id]);
  expect(lifecycle.map(event => event.bindingId)).toEqual([inspection.bindingId, inspection.bindingId, inspection.bindingId, inspection.bindingId]);
  expect(lifecycle.map(event => event.kind)).toEqual(['acquisition-started', 'acquisition-ready', 'cleanup-started', 'cleanup-completed']);
});
