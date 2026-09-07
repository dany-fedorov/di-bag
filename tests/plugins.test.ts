import { expect, test } from 'bun:test';
import { DiBag, DiBagCleanupError, DiBagPluginError, DiBagStartupError } from '../src';
import type { LifecycleEvent } from '../src';
import { deferred } from './helpers';

test('plugin validation retains raw source ownership on success and failure', async () => {
  const valid = { run: () => 42 };
  const invalid = { run: 42 };
  const disposed: unknown[] = [];
  const wrap = (value: unknown) => DiBag.fromPlugin([], {
    apiVersion: 1,
    create: () => value,
    dispose: (acquired: unknown) => { disposed.push(acquired); },
  }, {
    acquisition: 'raw',
    validate: (value: unknown): value is { run(): number } =>
      typeof value === 'object' && value !== null &&
      'run' in value && typeof value.run === 'function',
  });
  const good = DiBag.begin().add({ plugin: wrap(valid) }).end();
  expect(good.resolve('plugin')).toBe(valid);
  expect(good.resolve('plugin').run()).toBe(42);
  const bad = DiBag.begin().add({ plugin: wrap(invalid) }).end();
  expect(() => bad.resolve('plugin')).toThrow(DiBagPluginError);
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
    try { DiBag.fromPlugin([], descriptor, { acquisition: 'raw', validate: (value): value is unknown => value === value }); }
    catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(DiBagPluginError);
    expect((failure as DiBagPluginError).phase).toBe('descriptor');
  }
  const inherited = Object.create({ apiVersion: 1, create: () => { created++; } });
  expect(() => DiBag.fromPlugin([], inherited, { acquisition: 'raw', validate: (value): value is unknown => value === value }))
    .toThrow(DiBagPluginError);
  expect(created).toBe(0);
});

test('plugin preflight validates dependencies and options before descriptor reads', () => {
  let reads = 0;
  const descriptor = {
    get apiVersion() { reads++; return 1; },
    create: () => 1,
  };
  expect(() => Reflect.apply(DiBag.fromPlugin, undefined, [[], descriptor, {}])).toThrow('acquisition mode');
  expect(reads).toBe(0);
  const key = Symbol('dependency'); const dependency = DiBag.token(key).of<number>();
  expect(() => Reflect.apply(DiBag.fromPlugin, undefined, [[{ ...dependency }], descriptor, {
    acquisition: 'raw', validate: (value: unknown): value is number => typeof value === 'number',
  }])).toThrow('token');
  expect(reads).toBe(0);
});

test('plugin descriptor preflight preserves accessor errors and ignores extra getters', () => {
  const apiVersionFailure = new Error('apiVersion getter');
  const version = {
    get apiVersion() { throw apiVersionFailure; },
    create: () => 1,
  };
  expect(() => DiBag.fromPlugin([], version, { acquisition: 'raw', validate: (value): value is number => typeof value === 'number' }))
    .toThrow(apiVersionFailure);
  let extraReads = 0;
  const provider = DiBag.fromPlugin([], {
    apiVersion: 1,
    create: () => 1,
    get ignored() { extraReads++; return 'ignored'; },
  }, { acquisition: 'raw', validate: (value): value is number => typeof value === 'number' });
  const bag = DiBag.begin().add({ provider }).end();
  expect(bag.resolve('provider')).toBe(1);
  expect(extraReads).toBe(0);
  return bag.close();
});

test('plugin snapshots dependencies, options and callbacks before later mutation', async () => {
  const oneKey = Symbol('one'); const one = DiBag.token(oneKey).of<number>();
  const twoKey = Symbol('two'); const two = DiBag.token(twoKey).of<number>();
  const dependencies: unknown[] = [one];
  const options = {
    acquisition: 'raw' as const,
    validate: (value: unknown): value is number => typeof value === 'number',
  };
  const descriptor = {
    get apiVersion() {
      dependencies[0] = two;
      options.validate = (value: unknown): value is number => value === 2;
      return 1;
    },
    create: (value: number) => value,
  };
  const provider = Reflect.apply(DiBag.fromPlugin, undefined, [dependencies, descriptor, options]);
  dependencies[0] = two;
  descriptor.create = () => 2;
  const builder = DiBag.begin().bind(one, DiBag.factory(() => 1, { acquisition: 'raw' }))
    .bind(two, DiBag.factory(() => 2, { acquisition: 'raw' }));
  const added = Reflect.apply(builder.add, builder, [{ provider }]);
  const bag = Reflect.apply(added.end, added, []) as { resolve(key: string): unknown; close(): Promise<void> };
  expect(bag.resolve('provider')).toBe(1);
  await bag.close();
});

test('plugin routes required optional lazy and all dependency references positionally', async () => {
  const requiredKey = Symbol('required'); const required = DiBag.token(requiredKey).of<number>();
  const absentKey = Symbol('absent'); const absent = DiBag.token(absentKey).of<number>();
  const lazyKey = Symbol('lazy'); const lazy = DiBag.token(lazyKey).of<number>();
  const collectedKey = Symbol('collected'); const collected = DiBag.token(collectedKey).of<number>();
  const provider = DiBag.fromPlugin([required, DiBag.optional(absent), DiBag.lazy(lazy), DiBag.all(collected)], {
    apiVersion: 1,
    create: (value: number, maybe: number | undefined, get: () => number, all: readonly number[]) => ({ value, maybe, get, all }),
  }, {
    acquisition: 'raw',
    validate: (value): value is { value: number; maybe: number | undefined; get(): number; all: readonly number[] } => typeof value === 'object' && value !== null,
  });
  const bag = DiBag.begin().bind(required, DiBag.factory(() => 1, { acquisition: 'raw' }))
    .bind(lazy, DiBag.factory(() => 2, { acquisition: 'raw' }))
    .contribute(collected, DiBag.factory(() => 3, { acquisition: 'raw' }))
    .contribute(collected, DiBag.factory(() => 4, { acquisition: 'raw' })).add({ provider }).end();
  const value = bag.resolve('provider');
  expect(value.value).toBe(1); expect(value.maybe).toBeUndefined(); expect(value.get()).toBe(2); expect(value.all).toEqual([3, 4]);
  await bag.close();
});

test('raw plugin validation does not assimilate values or validator results', async () => {
  const hostile = { get then(): never { throw new Error('must not read then'); } };
  const never = new Promise<void>(() => {});
  for (const value of [hostile, never, undefined, () => 3]) {
    const provider = DiBag.fromPlugin([], { apiVersion: 1, create: () => value }, {
      acquisition: 'raw',
      validate: (candidate): candidate is typeof value => candidate === value,
    });
    const bag = DiBag.begin().add({ provider }).end();
    expect(bag.resolve('provider')).toBe(value);
    await bag.close();
  }
  for (const result of [false, 1, Promise.resolve(true), { then() { return true; } }]) {
    const provider = DiBag.fromPlugin([], { apiVersion: 1, create: () => 1 }, {
      acquisition: 'raw',
      validate: (() => result) as unknown as (value: unknown) => value is number,
    });
    const bag = DiBag.begin().add({ provider }).end();
    let failure: unknown;
    try { bag.resolve('provider'); } catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(DiBagPluginError);
    expect((failure as DiBagPluginError).phase).toBe('output');
    await bag.close();
  }
});

test('native plugin validates fulfilled values, caches final output and releases source ownership', async () => {
  const gate = deferred<{ id: number }>();
  const disposed: { id: number }[] = [];
  const provider = DiBag.fromPlugin([], {
    apiVersion: 1,
    create: () => gate.promise,
    dispose(value: { id: number }) { disposed.push(value); },
  }, {
    acquisition: 'native',
    validate: (value): value is { id: number } => typeof value === 'object' && value !== null && 'id' in value,
  });
  const bag = DiBag.begin().add({ provider }).end();
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
  const rejected = DiBag.fromPlugin([], { apiVersion: 1, create: () => Promise.reject(rejection) }, {
    acquisition: 'native', validate: (value): value is number => typeof value === 'number',
  });
  const rejectedBag = DiBag.begin().add({ rejected }).end();
  await expect(rejectedBag.resolve('rejected')).rejects.toBe(rejection);
  await rejectedBag.close();
  const disposed: unknown[] = [];
  const invalid = { id: 'invalid' };
  const invalidProvider = DiBag.fromPlugin([], {
    apiVersion: 1, create: () => Promise.resolve(invalid), dispose: (value: unknown) => { disposed.push(value); },
  }, { acquisition: 'native', validate: (value): value is { id: number } => typeof value === 'object' && value !== null && (value as { id?: unknown }).id === 1 });
  const invalidBag = DiBag.begin().add({ invalidProvider }).end();
  await expect(invalidBag.resolve('invalidProvider')).rejects.toBeInstanceOf(DiBagPluginError);
  await invalidBag.close();
  expect(disposed).toEqual([invalid]);
});

test('native plugins require a genuine Promise source', async () => {
  let validated = 0;
  const provider = DiBag.fromPlugin([], {
    apiVersion: 1,
    create: () => ({ then() { throw new Error('must not assimilate'); } }),
  }, { acquisition: 'native', validate: (value): value is number => { validated++; return typeof value === 'number'; } });
  const bag = DiBag.begin().add({ provider }).end();
  await expect(bag.resolve('provider')).rejects.toBeInstanceOf(TypeError);
  expect(validated).toBe(0);
  await bag.close();
});

test('startup rollback releases an accepted plugin source once', async () => {
  const failure = new Error('startup failure');
  const disposed: number[] = [];
  const plugin = DiBag.fromPlugin([], {
    apiVersion: 1, create: () => 5, dispose: (value: unknown) => { if (typeof value === 'number') disposed.push(value); },
  }, { acquisition: 'raw', validate: (value): value is number => typeof value === 'number' });
  const builder = DiBag.begin().add({ plugin, failure: DiBag.factory(() => { throw failure; }, { acquisition: 'raw' }) });
  let caught: unknown;
  try { await builder.start(['plugin', 'failure']); } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(DiBagStartupError);
  expect((caught as DiBagStartupError).cause).toBe(failure);
  expect(disposed).toEqual([5]);
});

test('plugin callbacks use no receiver and preserve factory and validator failures', async () => {
  const factoryFailure = new Error('factory failure');
  const failingFactory = DiBag.fromPlugin([], {
    apiVersion: 1,
    create(this: undefined) { expect(this).toBeUndefined(); throw factoryFailure; },
  }, { acquisition: 'raw', validate: (value): value is number => typeof value === 'number' });
  const factoryBag = DiBag.begin().add({ failingFactory }).end();
  expect(() => factoryBag.resolve('failingFactory')).toThrow(factoryFailure);
  await factoryBag.close();
  const validatorFailure = new Error('validator failure');
  const disposed: number[] = [];
  const failingValidator = DiBag.fromPlugin([], {
    apiVersion: 1,
    create(this: undefined) { expect(this).toBeUndefined(); return 4; },
    dispose(this: undefined, value: number) { expect(this).toBeUndefined(); disposed.push(value); },
  }, { acquisition: 'raw', validate(this: void, _value): _value is number { expect(this).toBeUndefined(); throw validatorFailure; } });
  const validatorBag = DiBag.begin().add({ failingValidator }).end();
  expect(() => validatorBag.resolve('failingValidator')).toThrow(validatorFailure);
  await validatorBag.close();
  expect(disposed).toEqual([4]);
});

test('plugin composition retains module privacy, aliases, contributions and selected sharing', async () => {
  const dependencyKey = Symbol('dependency'); const dependency = DiBag.token(dependencyKey).of<number>();
  const collectionKey = Symbol('collection'); const collection = DiBag.token(collectionKey).of<{ id: number }>();
  let created = 0;
  const plugin = DiBag.fromPlugin([dependency], {
    apiVersion: 1,
    create: (id: number) => ({ id, sequence: ++created }),
  }, { acquisition: 'raw', validate: (value): value is { id: number; sequence: number } => typeof value === 'object' && value !== null });
  const feature = DiBag.module().add({ plugin }).alias('copy', 'plugin').contribute(collection, plugin).exports(['plugin', 'copy']);
  const bag = DiBag.begin().bind(dependency, DiBag.factory(() => 1, { acquisition: 'raw' })).install(feature).end();
  const parent = bag.resolve('plugin');
  expect(bag.resolve('copy')).toBe(parent);
  expect(bag.resolveAll(collection).map(value => value.id)).toEqual([1]);
  const child = bag.scope([dependency], { [dependencyKey]: DiBag.factory(() => 2, { acquisition: 'raw' }) }, { share: ['plugin'] });
  expect(child.resolve('plugin')).toBe(parent);
  expect(created).toBe(2);
  await child.close(); await bag.close();
  const privateKey = Symbol('private'); const privateDependency = DiBag.token(privateKey).of<number>();
  const privatePlugin = DiBag.fromPlugin([privateDependency], {
    apiVersion: 1, create: (id: number) => ({ id }),
  }, { acquisition: 'raw', validate: (value): value is { id: number } => typeof value === 'object' && value !== null });
  const privateFeature = DiBag.module().bind(privateDependency, DiBag.factory(() => 9, { acquisition: 'raw' }))
    .add({ privatePlugin }).exports(['privatePlugin']);
  const privateBag = DiBag.begin().install(privateFeature).end();
  expect(privateBag.resolve('privatePlugin').id).toBe(9);
  await privateBag.close();
});

test('plugin observers retain the canonical acquisition and cleanup events', async () => {
  const events: string[] = [];
  const observed = DiBag.observe({ onEvent(event) { events.push(event.kind); }, onError() {} });
  const plugin = observed.fromPlugin([], {
    apiVersion: 1, create: () => ({ id: 1 }), dispose: () => {},
  }, { acquisition: 'raw', validate: (value): value is { id: number } => typeof value === 'object' && value !== null });
  const bag = observed.begin().add({ plugin }).end();
  bag.resolve('plugin'); await bag.close();
  expect(events.filter(kind => kind === 'acquisition-started')).toHaveLength(1);
  expect(events.filter(kind => kind === 'acquisition-ready')).toHaveLength(1);
  expect(events.filter(kind => kind === 'cleanup-started')).toHaveLength(1);
  expect(events.filter(kind => kind === 'cleanup-completed')).toHaveLength(1);
});

test('native plugin readiness waits for source validation', async () => {
  const gate = deferred<{ id: number }>();
  let validated = 0;
  const plugin = DiBag.fromPlugin([], {
    apiVersion: 1, create: () => gate.promise,
  }, {
    acquisition: 'native',
    validate: (value): value is { id: number } => {
      validated++;
      return typeof value === 'object' && value !== null && 'id' in value;
    },
  });
  const starting = DiBag.begin().add({ plugin }).start(['plugin']);
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
  const plugin = DiBag.fromPlugin([], {
    apiVersion: 1,
    create: () => 1,
    dispose: async () => { disposed++; await gate.promise; },
  }, { acquisition: 'raw', validate: (value): value is number => typeof value === 'number' });
  const bag = DiBag.begin().add({ plugin }).end();
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
  const plugin = DiBag.fromPlugin([], {
    apiVersion: 1,
    create: () => 1,
    dispose: () => { disposed++; throw cleanupFailure; },
  }, { acquisition: 'raw', validate: (_value: unknown): _value is number => { throw validationFailure; } });
  const bag = DiBag.begin().add({ plugin }).end();
  expect(() => bag.resolve('plugin')).toThrow(validationFailure);
  let closeFailure: unknown;
  try { await bag.close(); } catch (error) { closeFailure = error; }
  expect(closeFailure).toBeInstanceOf(DiBagCleanupError);
  expect((closeFailure as DiBagCleanupError).failures.map(failure => failure.error)).toEqual([cleanupFailure]);
  expect(disposed).toBe(1);
});

test('plugin observer lifecycle events identify its canonical acquisition', async () => {
  const events: LifecycleEvent[] = [];
  const observed = DiBag.observe({ onEvent(event) { events.push(event); }, onError() {} });
  const plugin = observed.fromPlugin([], {
    apiVersion: 1, create: () => ({ id: 1 }), dispose: () => {},
  }, { acquisition: 'raw', validate: (value): value is { id: number } => typeof value === 'object' && value !== null });
  const bag = observed.begin().add({ plugin }).end();
  bag.resolve('plugin');
  const inspection = bag.inspect('plugin');
  const id = inspection.acquisitions[0]!.acquisitionId;
  await bag.close();
  await Promise.resolve(); await Promise.resolve();
  const lifecycle = events.filter(event => 'acquisitionId' in event);
  expect(lifecycle.map(event => event.acquisitionId)).toEqual([id, id, id, id]);
  expect(lifecycle.map(event => event.bindingId)).toEqual([inspection.bindingId, inspection.bindingId, inspection.bindingId, inspection.bindingId]);
  expect(lifecycle.map(event => event.kind)).toEqual(['acquisition-started', 'acquisition-ready', 'cleanup-started', 'cleanup-completed']);
});
