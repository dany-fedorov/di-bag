import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';
import { DiBag as Core } from '../src';
import { isPromise } from 'node:util/types';
import { runInNewContext } from 'node:vm';
import { withoutBuiltinModule } from './host-builtin-module';

for (const stage of ['source', 'projection', 'metadata'] as const) {
  test(`close waits for a native acquisition with shadowed then at ${stage}`, async () => {
    let release!: (value: { id: number }) => void;
    const value = { id: 7 };
    const pending = new Promise<{ id: number }>(resolve => { release = resolve; });
    Object.defineProperty(pending, 'then', { value: undefined });
    const disposed: unknown[] = [];
    const factory = stage === 'source' ? () => pending : stage === 'projection'
      ? DiBag.transformService(() => 0, { mode: 'direct', transform: () => pending })
      : DiBag.withMetadata(() => pending, { dynamic: { mode: 'direct', describe: () => ({ stage: 'metadata' }) } });
    const bag = DiBag.createBuilder().register({
      value: DiBag.withDisposal(factory, resource => { disposed.push(resource); }),
    }).build();
    expect(bag.resolve('value')).toBe(pending);
    let closed = false;
    const closing = bag.close().then(() => { closed = true; });
    await Promise.resolve();
    await Promise.resolve();
    const before = { closed, disposed: [...disposed] };
    release(value);
    await closing;
    expect(before).toEqual({ closed: false, disposed: [] });
    expect(disposed).toEqual([value]);
  });
}

test('bare entry resolves automatic async factories through the host classifier', async () => {
  const pending = Promise.resolve(42);
  const thenable = { then: (resolve: (value: number) => void) => resolve(1) };
  const bag = Core.createBuilder().register({
    answer: async () => 42,
    same: () => pending,
    thenable: Core.fromFactory(() => thenable, { acquisitionMode: 'raw' }),
  }).build();
  expect(await bag.resolve('answer')).toBe(42);
  expect(bag.resolve('same')).toBe(pending);
  expect(bag.resolve('thenable')).toBe(thenable);
  const scope = bag.createScope();
  const fork = bag.fork();
  // Scopes and forks reuse the classifier resolved at build.
  withoutBuiltinModule(() => { expect(scope.resolve('same')).toBe(pending); expect(fork.resolve('same')).toBe(pending); });
  await Promise.all([scope.close(), fork.close()]);
  await bag.close();
  const started = await Core.createBuilder().register({ answer: async () => 7 }).buildAndStart(['answer']);
  expect(await started.resolve('answer')).toBe(7);
  await started.close();
});

test('bare entry fires DI_BAG_CLASSIFIER_REQUIRED on hosts without a usable process.getBuiltinModule', () => {
  const build = () => Core.createBuilder().register({ value: () => 1 }).build();
  for (const replacement of [undefined, 1, () => undefined, () => ({}), () => ({ isPromise: true })]) {
    expect(() => withoutBuiltinModule(build, replacement)).toThrow('DI_BAG_CLASSIFIER_REQUIRED: this host has no process.getBuiltinModule');
  }
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'process')!;
  for (const host of [undefined, null]) {
    Object.defineProperty(globalThis, 'process', { configurable: true, writable: true, value: host });
    try { expect(build).toThrow('DI_BAG_CLASSIFIER_REQUIRED'); }
    finally { Object.defineProperty(globalThis, 'process', descriptor); }
  }
});

test('an explicit classifier wins and explicit graphs never consult the host', async () => {
  let loads = 0;
  const classified: unknown[] = [];
  const counting = (id: string) => { loads++; return id === 'node:util/types' ? { isPromise } : undefined; };
  const configured = Core.withConfiguration({ runtime: { isNativePromise: value => { classified.push(value); return isPromise(value); } } });
  const [explicit, automatic] = withoutBuiltinModule(() => [
    Core.createBuilder().register({ raw: Core.fromFactory(() => 1, { acquisitionMode: 'raw' }) }).build(),
    configured.createBuilder().register({ value: () => 2 }).build(),
  ], counting);
  expect(explicit.resolve('raw')).toBe(1);
  expect(automatic.resolve('value')).toBe(2);
  expect(classified).toEqual([2]);
  expect(loads).toBe(0);
  const detected = withoutBuiltinModule(() => Core.createBuilder().register({ value: async () => 3 }).build(), counting);
  expect(await detected.resolve('value')).toBe(3);
  expect(loads).toBe(1);
  await Promise.all([explicit.close(), automatic.close(), detected.close()]);
});

test('unconfigured core preflights every stage and private module before any factory effects', () => {
  let calls = 0;
  const source = Core.fromFactory(() => { calls++; return 1; }, { acquisitionMode: 'raw' });
  const automatic = () => { calls++; return 2; };
  const feature = Core.createBuilder().register({ hidden: automatic, public: source }).buildModule(['public']);
  for (const finalize of [
    () => Core.createBuilder().register({ source, automatic }).build(),
    () => Core.createBuilder().register({ projected: Core.transformService(source, { mode: 'direct', transform: value => { calls++; return value; } }) }).build(),
    () => Core.createBuilder().installModule(feature).build(),
  ]) expect(() => withoutBuiltinModule<unknown>(finalize)).toThrow(/^DI_BAG_CLASSIFIER_REQUIRED: this host has no process\.getBuiltinModule; configure DiBag\.withConfiguration\(\{ runtime: \{ isNativePromise \} \}\) or give each automatic registration an explicit acquisitionMode; see https:\/\/dany-fedorov\.github\.io\/di-bag\/agent\/errors\.html#di-bag-classifier-required$/);
  expect(calls).toBe(0);
});

test('facades snapshot and isolate their predicate, carrying it through builders and forks', async () => {
  const options: { isNativePromise: (value: unknown) => boolean } = { isNativePromise: isPromise };
  const configured = Core.withConfiguration({ runtime: options });
  options.isNativePromise = () => { throw new Error('mutated options'); };
  const pending = Promise.resolve(7);
  const symbol = Symbol('shared registry');
  const key = Core.token(symbol).of<Promise<number>>();
  const provider = Core.fromFactory(() => pending, { acquisitionMode: 'auto' });
  const feature = Core.createBuilder().register(key, provider).buildModule([key]);
  const bag = configured.createBuilder().installModule(feature).build();
  const forks = [bag.fork(), bag.fork([key], { [key.key]: () => pending })];
  for (const item of [bag, ...forks]) { expect(item.resolve(key)).toBe(pending); await item.close(); }
  expect(() => withoutBuiltinModule(() => Core.createBuilder().register({ value: () => 1 }).build())).toThrow('DI_BAG_CLASSIFIER_REQUIRED: this host has no process.getBuiltinModule');
  const failure = new Error('predicate failure');
  const other = Core.withConfiguration({ runtime: { isNativePromise: () => { throw failure; } } }).createBuilder().register({ value: () => 1 }).build();
  expect(() => other.resolve('value')).toThrow(failure);
  await other.close();
});

test('invalid configuration, modes and classifier results fail explicitly', async () => {
  for (const options of [null, {}, { isNativePromise: 1 }]) {
    expect(() => Reflect.apply(Core.withConfiguration, undefined, [{ runtime: options }])).toThrow('isNativePromise');
  }
  for (const options of [null, { acquisitionMode: 'guess' }, { acquisitionMode: null }]) {
    expect(() => Reflect.apply(Core.fromFactory, undefined, [() => 1, options])).toThrow('acquisition');
  }
  const bad = Reflect.apply(Core.withConfiguration, undefined, [{ runtime: { isNativePromise: () => 'yes' } }]);
  const bag = bad.createBuilder().register({ value: () => 1 }).build();
  expect(() => bag.resolve('value')).toThrow('boolean');
  await bag.close();
});

test('automatic ordinary values preserve the then-presence guard', async () => {
  let reads = 0;
  const value = new Proxy({}, { has: () => false, get: () => { reads++; throw new Error('unexpected then read'); } });
  const bag = DiBag.createBuilder().register({ value: () => value }).build();
  expect(bag.resolve('value')).toBe(value);
  expect(reads).toBe(0);
  await bag.close();
});

test('raw Promise and then-getter values retain exact ownership without observation or waiting', async () => {
  const pending = new Promise<number>(() => {});
  const throwing = { get then(): never { throw new Error('raw getter'); } };
  const disposed: unknown[] = [];
  const bag = Core.createBuilder().register({
    pending: Core.withDisposal(Core.fromFactory(() => pending, { acquisitionMode: 'raw' }), value => { disposed.push(value); }),
    throwing: Core.withDisposal(Core.fromFactory(() => throwing, { acquisitionMode: 'raw' }), value => { disposed.push(value); }),
  }).build();
  expect(bag.resolve('pending')).toBe(pending);
  expect(bag.resolve('throwing')).toBe(throwing);
  await bag.close();
  expect(disposed).toEqual([throwing, pending]);
});

test('explicit native and async projections work without a classifier and preserve previous owners', async () => {
  const pending = Promise.resolve({ id: 7 });
  const disposed: unknown[] = [];
  const source = Core.withDisposal(Core.fromFactory(() => pending, { acquisitionMode: 'raw' }), value => { disposed.push(value); });
  const native = Core.withDisposal(Core.transformService(source, { mode: 'direct', transform: value => value, ...{ acquisitionMode: 'nativePromise' } }), value => { disposed.push(value); });
  const bag = Core.createBuilder().register({ native, mapped: Core.transformService(Core.fromFactory(() => 3, { acquisitionMode: 'raw' }), { mode: 'awaited', transform: value => value + 1 }) }).build();
  expect(bag.resolve('native')).toBe(pending);
  expect(await bag.resolve('mapped')).toBe(4);
  await bag.close();
  expect(disposed).toEqual([{ id: 7 }, pending]);
});

for (const foreign of [false, true]) for (const mode of ['auto', 'nativePromise'] as const) {
  test(`${mode} observes ${foreign ? 'foreign' : 'local'} native state with non-callable then`, async () => {
    const resource = { id: 7 };
    const pending: Promise<typeof resource> = foreign ? runInNewContext('Promise.resolve(resource)', { resource }) : Promise.resolve(resource);
    Object.defineProperty(pending, 'then', { value: undefined });
    const disposed: unknown[] = [];
    const bag = DiBag.createBuilder().register({ value: DiBag.withDisposal(DiBag.fromFactory(() => pending, { acquisitionMode: mode }), value => { disposed.push(value); }) }).build();
    expect(bag.resolve('value')).toBe(pending);
    await bag.close();
    expect(disposed).toEqual([resource]);
  });
}

test('native metadata preserves raw presence records and explicit payload projection', async () => {
  const pending = new Promise<number>(() => {});
  const source = Core.withMetadata(Core.fromFactory(() => ({ present: true as const, value: pending }), { acquisitionMode: 'raw' }), { dynamic: { mode: 'direct', describe: () => ({ source: 'pending' }) } });
  const disposed: unknown[] = [];
  const raw = Core.withDisposal(Core.transformService(source, { mode: 'direct', transform: record => record.value, ...{ acquisitionMode: 'raw' } }), value => { disposed.push(value); });
  const bag = Core.createBuilder().register({ presence: source, raw }).build();
  expect(bag.resolve('presence')).toEqual({ present: true, value: pending });
  expect(bag.resolve('raw')).toBe(pending);
  await bag.close();
  expect(disposed).toEqual([pending]);
});

test('async metadata retains a native output contract without a portable classifier', async () => {
  const source = Core.fromFactory(() => Promise.resolve(7), { acquisitionMode: 'nativePromise' });
  const bag = Core.createBuilder().register({ value: Core.withMetadata(source, { dynamic: { mode: 'awaited', describe: value => ({ result: value }) } }) }).build();
  expect(await bag.resolve('value')).toBe(7);
  expect(bag.inspect('value').acquisitions[0]?.acquisitionMetadata).toEqual([{ present: true, value: { result: 7 } }]);
  await bag.close();
});
