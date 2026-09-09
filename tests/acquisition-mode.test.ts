import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';
import { DiBag as Core } from '../src';
import { isPromise } from 'node:util/types';
import { runInNewContext } from 'node:vm';

for (const stage of ['source', 'projection', 'metadata'] as const) {
  test(`close waits for a native acquisition with shadowed then at ${stage}`, async () => {
    let release!: (value: { id: number }) => void;
    const value = { id: 7 };
    const pending = new Promise<{ id: number }>(resolve => { release = resolve; });
    Object.defineProperty(pending, 'then', { value: undefined });
    const disposed: unknown[] = [];
    const factory = stage === 'source' ? () => pending : stage === 'projection'
      ? DiBag.mapSync(() => 0, () => pending)
      : DiBag.withAcquisitionMetadata(() => pending, () => ({ stage: 'metadata' }));
    const bag = DiBag.begin().add({
      value: DiBag.withDisposal(factory, resource => { disposed.push(resource); }),
    }).end();
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

test('unconfigured core preflights every stage and private module before any factory effects', () => {
  let calls = 0;
  const source = Core.factory(() => { calls++; return 1; }, { acquisition: 'raw' });
  const automatic = () => { calls++; return 2; };
  const feature = Core.module().add({ hidden: automatic, public: source }).exports(['public']);
  for (const finalize of [
    () => Core.begin().add({ source, automatic }).end(),
    () => Core.begin().add({ projected: Core.mapSync(source, value => { calls++; return value; }) }).end(),
    () => Core.begin().install(feature).end(),
  ]) expect(finalize).toThrow(/classification.*configure.*node.*explicit/i);
  expect(calls).toBe(0);
});

test('facades snapshot and isolate their predicate, carrying it through builders and forks', async () => {
  const options: { isNativePromise: (value: unknown) => boolean } = { isNativePromise: isPromise };
  const configured = Core.configure(options);
  options.isNativePromise = () => { throw new Error('mutated options'); };
  const pending = Promise.resolve(7);
  const symbol = Symbol('shared registry');
  const key = Core.token(symbol).of<Promise<number>>();
  const provider = Core.factory(() => pending, { acquisition: 'auto' });
  const feature = Core.module().bind(key, provider).exports([key]);
  const bag = configured.begin().install(feature).end();
  const forks = [bag.fork(), bag.fork([key], { [key.key]: () => pending })];
  for (const item of [bag, ...forks]) { expect(item.resolve(key)).toBe(pending); await item.close(); }
  expect(() => Core.begin().add({ value: () => 1 }).end()).toThrow('classification');
  const failure = new Error('predicate failure');
  const other = Core.configure({ isNativePromise: () => { throw failure; } }).begin().add({ value: () => 1 }).end();
  expect(() => other.resolve('value')).toThrow(failure);
  await other.close();
});

test('invalid configuration, modes and classifier results fail explicitly', async () => {
  for (const options of [null, {}, { isNativePromise: 1 }]) {
    expect(() => Reflect.apply(Core.configure, undefined, [options])).toThrow('isNativePromise');
  }
  for (const options of [null, {}, { acquisition: 'guess' }, { acquisition: null }]) {
    expect(() => Reflect.apply(Core.factory, undefined, [() => 1, options])).toThrow('acquisition');
  }
  const bad = Reflect.apply(Core.configure, undefined, [{ isNativePromise: () => 'yes' }]);
  const bag = bad.begin().add({ value: () => 1 }).end();
  expect(() => bag.resolve('value')).toThrow('boolean');
  await bag.close();
});

test('automatic ordinary values preserve the then-presence guard', async () => {
  let reads = 0;
  const value = new Proxy({}, { has: () => false, get: () => { reads++; throw new Error('unexpected then read'); } });
  const bag = DiBag.begin().add({ value: () => value }).end();
  expect(bag.resolve('value')).toBe(value);
  expect(reads).toBe(0);
  await bag.close();
});

test('raw Promise and then-getter values retain exact ownership without observation or waiting', async () => {
  const pending = new Promise<number>(() => {});
  const throwing = { get then(): never { throw new Error('raw getter'); } };
  const disposed: unknown[] = [];
  const bag = Core.begin().add({
    pending: Core.withDisposal(Core.factory(() => pending, { acquisition: 'raw' }), value => { disposed.push(value); }),
    throwing: Core.withDisposal(Core.factory(() => throwing, { acquisition: 'raw' }), value => { disposed.push(value); }),
  }).end();
  expect(bag.resolve('pending')).toBe(pending);
  expect(bag.resolve('throwing')).toBe(throwing);
  await bag.close();
  expect(disposed).toEqual([throwing, pending]);
});

test('explicit native and async projections work without a classifier and preserve previous owners', async () => {
  const pending = Promise.resolve({ id: 7 });
  const disposed: unknown[] = [];
  const source = Core.withDisposal(Core.factory(() => pending, { acquisition: 'raw' }), value => { disposed.push(value); });
  const native = Core.withDisposal(Core.mapSync(source, value => value, { acquisition: 'native' }), value => { disposed.push(value); });
  const bag = Core.begin().add({ native, mapped: Core.mapAsync(Core.factory(() => 3, { acquisition: 'raw' }), value => value + 1) }).end();
  expect(bag.resolve('native')).toBe(pending);
  expect(await bag.resolve('mapped')).toBe(4);
  await bag.close();
  expect(disposed).toEqual([{ id: 7 }, pending]);
});

for (const foreign of [false, true]) for (const mode of ['auto', 'native'] as const) {
  test(`${mode} observes ${foreign ? 'foreign' : 'local'} native state with non-callable then`, async () => {
    const resource = { id: 7 };
    const pending: Promise<typeof resource> = foreign ? runInNewContext('Promise.resolve(resource)', { resource }) : Promise.resolve(resource);
    Object.defineProperty(pending, 'then', { value: undefined });
    const disposed: unknown[] = [];
    const bag = DiBag.begin().add({ value: DiBag.withDisposal(DiBag.factory(() => pending, { acquisition: mode }), value => { disposed.push(value); }) }).end();
    expect(bag.resolve('value')).toBe(pending);
    await bag.close();
    expect(disposed).toEqual([resource]);
  });
}

test('native metadata preserves raw presence records and explicit payload projection', async () => {
  const pending = new Promise<number>(() => {});
  const source = Core.withAcquisitionMetadata(
    Core.factory(() => ({ present: true as const, value: pending }), { acquisition: 'raw' }),
    () => ({ source: 'pending' }),
  );
  const disposed: unknown[] = [];
  const raw = Core.withDisposal(Core.mapSync(source, record => record.value, { acquisition: 'raw' }), value => { disposed.push(value); });
  const bag = Core.begin().add({ presence: source, raw }).end();
  expect(bag.resolve('presence')).toEqual({ present: true, value: pending });
  expect(bag.resolve('raw')).toBe(pending);
  await bag.close();
  expect(disposed).toEqual([pending]);
});

test('async metadata retains a native output contract without a portable classifier', async () => {
  const source = Core.factory(() => Promise.resolve(7), { acquisition: 'native' });
  const bag = Core.begin().add({ value: Core.withAcquisitionMetadataAsync(source, value => ({ result: value })) }).end();
  expect(await bag.resolve('value')).toBe(7);
  expect(bag.inspect('value').acquisitions[0]?.metadata).toEqual([{ present: true, value: { result: 7 } }]);
  await bag.close();
});
