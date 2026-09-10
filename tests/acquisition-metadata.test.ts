import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';
import { DiBag as PortableDiBag } from '../src/di-bag';
import { deferred } from './helpers';

test('metadata is lazy, ordered, copied with hidden symbols, and retained after projection', async () => {
  const symbol = Symbol('origin');
  const payload = { mutable: 1 };
  const metadata = { origin: 'first', payload };
  Object.defineProperty(metadata, symbol, { value: payload });
  Object.defineProperty(metadata, 'hidden', { value: 42 });
  let calls = 0;
  let during: unknown;
  const source = () => {
    during = bag.inspect('value').acquisitions[0]!.acquisitionMetadata;
    return { value: payload, origin: 'source' };
  };
  const first = DiBag.withMetadata(source, { dynamic: { mode: 'direct', describe: function (this: void, result) {
    expect(this).toBeUndefined();
    expect(result.origin).toBe('source');
    calls++;
    return metadata;
  } } });
  const value = DiBag.transformService(DiBag.withMetadata(first, { dynamic: { mode: 'direct', describe: result => ({ second: result.origin }) } }), { mode: 'direct', transform: result => result.value });
  const bag = DiBag.createBuilder().register({ value }).build();
  expect(calls).toBe(0);
  expect(bag.inspect('value').acquisitions).toEqual([]);
  expect(bag.resolve('value')).toBe(payload);
  expect(bag.resolve('value')).toBe(payload);
  expect(calls).toBe(1);
  expect(during).toEqual([{ present: false }, { present: false }]);
  const frames = bag.inspect('value').acquisitions[0]!.acquisitionMetadata;
  expect(frames[1]).toEqual({ present: true, value: { second: 'source' } });
  const frame = frames[0];
  expect(frame.present).toBe(true);
  if (frame.present) {
    expect(frame.value).not.toBe(metadata);
    expect(Object.isFrozen(frame.value)).toBe(true);
    expect(frame.value.payload).toBe(payload);
    expect(Reflect.get(frame.value, symbol)).toBe(payload);
    expect(Reflect.get(frame.value, 'hidden')).toBe(42);
    metadata.origin = 'changed';
    expect(frame.value.origin).toBe('first');
    payload.mutable = 2;
    expect(frame.value.payload.mutable).toBe(2);
  }
  await bag.close();
});

test('immediate metadata retains raw Promise identity, policy, and outer disposer value', async () => {
  const gate = deferred<number>();
  let disposed: unknown;
  let thenReads = 0;
  Object.defineProperty(gate.promise, 'then', { get() { thenReads++; throw new Error('raw then getter'); } });
  const raw = PortableDiBag.fromFactory(() => gate.promise, { acquisitionMode: 'raw' });
  const source = PortableDiBag.withMetadata(PortableDiBag.transformService(raw, { mode: 'direct', transform: value => value, ...{ acquisitionMode: 'raw' } }), { static: { team: 'native' } });
  const annotated = PortableDiBag.withMetadata(source, { dynamic: { mode: 'direct', describe: value => ({ exact: value }) } });
  const bag = PortableDiBag.createBuilder().register({ value: PortableDiBag.withDisposal(annotated, value => { disposed = value; }) }).build();
  expect(bag.resolve('value')).toBe(gate.promise);
  expect(bag.inspect('value').acquisitions[0]!.state).toBe('ready');
  await bag.close();
  expect(disposed).toBe(gate.promise);
  expect(thenReads).toBe(0);
  gate.resolve(3);
});

test('async metadata awaits raw thenables and exposes a native Promise', async () => {
  const raw = { then(resolve: (value: { origin: string }) => unknown) { return resolve({ origin: 'remote' }); } };
  const source = PortableDiBag.fromFactory(() => raw, { acquisitionMode: 'raw' });
  const bag = PortableDiBag.createBuilder().register({ value: PortableDiBag.withMetadata(source, { dynamic: { mode: 'awaited', describe: result => ({ origin: result.origin }) } }) }).build();
  const value = bag.resolve('value');
  expect(value).toBeInstanceOf(Promise);
  expect(bag.inspect('value').acquisitions[0]!.acquisitionMetadata).toEqual([{ present: false }]);
  await expect(value).resolves.toEqual({ origin: 'remote' });
  expect(bag.inspect('value').acquisitions[0]!.acquisitionMetadata).toEqual([{ present: true, value: { origin: 'remote' } }]);
  await bag.close();
});

test('native acquisition remains pending and disposes fulfilled values after immediate annotation', async () => {
  const gate = deferred<number>();
  const disposed: number[] = [];
  const source = PortableDiBag.fromFactory(() => gate.promise, { acquisitionMode: 'nativePromise' });
  const bag = PortableDiBag.createBuilder().register({ value: PortableDiBag.withDisposal(
    PortableDiBag.withMetadata(source, { dynamic: { mode: 'direct', describe: promise => ({ promise }) } }), value => { disposed.push(value); },
  ) }).build();
  expect(bag.resolve('value')).toBe(gate.promise);
  expect(bag.inspect('value').acquisitions[0]!.state).toBe('pending');
  const closing = bag.close();
  gate.resolve(7);
  await closing;
  expect(disposed).toEqual([7]);
});

test('annotation errors preserve original failures, cleanup, and independent retries and scopes', async () => {
  const cause = { annotation: 'failed' };
  const disposed: number[] = [];
  let attempt = 0;
  const service = DiBag.withMetadata(DiBag.withDisposal(() => ++attempt, value => { disposed.push(value); }), { dynamic: { mode: 'direct', describe: value => {
    if (value === 1) throw cause;
    return { attempt: value };
  } } });
  const bag = DiBag.createBuilder().register({ service }).build();
  let failure: unknown;
  try { bag.resolve('service'); } catch (error) { failure = error; }
  expect(failure).toBe(cause);
  expect(bag.resolve('service')).toBe(2);
  const child = bag.createScope();
  expect(child.resolve('service')).toBe(3);
  expect(bag.inspect('service').acquisitions.at(-1)!.acquisitionMetadata).toEqual([{ present: true, value: { attempt: 2 } }]);
  expect(child.inspect('service').acquisitions[0]!.acquisitionMetadata).toEqual([{ present: true, value: { attempt: 3 } }]);
  await child.close();
  await bag.close();
  expect(disposed).toEqual([1, 3, 2]);
});

test('async annotation rejection cleans source ownership and skips failed sources', async () => {
  const cause = new Error('annotation');
  const disposed: number[] = [];
  let called = false;
  const bag = DiBag.createBuilder().register({
    annotation: DiBag.withMetadata(DiBag.withDisposal(async () => 1, value => { disposed.push(value); }), { dynamic: { mode: 'awaited', describe: () => { throw cause; } } }),
    source: DiBag.withMetadata(() => { throw cause; }, { dynamic: { mode: 'awaited', describe: () => { called = true; return {}; } } }),
  }).build();
  await expect(bag.resolve('annotation')).rejects.toBe(cause);
  await expect(bag.resolve('source')).rejects.toBe(cause);
  await bag.close();
  expect(disposed).toEqual([1]);
  expect(called).toBe(false);
});

test('metadata callbacks and returned records reject malformed and asynchronous values', async () => {
  for (const async of [false, true]) {
    const decorate = (callback: () => object) => async
      ? DiBag.withMetadata(() => 1, { dynamic: { mode: 'awaited', describe: callback } })
      : DiBag.withMetadata(() => 1, { dynamic: { mode: 'direct', describe: callback } });
    expect(() => decorate(null as never)).toThrow();
    for (const invalid of [null, undefined, 1, 'metadata', [], () => ({}), Promise.resolve({}), { then() {} }, Object.create({ then() {} })]) {
      const bag = DiBag.createBuilder().register({ value: decorate((() => invalid) as never) }).build();
      if (!async) expect(() => bag.resolve('value')).toThrow();
      else await expect(bag.resolve('value')).rejects.toThrow();
      await bag.close();
    }
  }
});

test('annotations retain present undefined values and add no ownership', async () => {
  let disposed = false;
  const value = { present: true as const, value: undefined, dispose() { disposed = true; } };
  const bag = DiBag.withConfiguration({ observers: [{ onEvent() {}, onError() {} }] }).createBuilder().register({
    value: DiBag.withMetadata(() => value, { dynamic: { mode: 'direct', describe: result => ({ presence: result.present, payload: result.value }) } }),
  }).build();
  expect(bag.resolve('value')).toBe(value);
  expect(bag.inspect('value').acquisitions[0]!.acquisitionMetadata).toEqual([{ present: true, value: { presence: true, payload: undefined } }]);
  await bag.close();
  expect(disposed).toBe(false);
});

test('rejecting accidentally async metadata observes its rejected Promise in both modes', async () => {
  // Structural widening can hide an async return type from the static admission check.
  const describe: () => object = async () => { throw new Error('invalid async metadata'); };
  for (const async of [false, true]) {
    const value = async
      ? DiBag.withMetadata(() => 1, { dynamic: { mode: 'awaited', describe: describe } })
      : DiBag.withMetadata(() => 1, { dynamic: { mode: 'direct', describe: describe } });
    const bag = DiBag.createBuilder().register({ value }).build();
    if (async) await expect(bag.resolve('value')).rejects.toBeInstanceOf(TypeError);
    else expect(() => bag.resolve('value')).toThrow(TypeError);
    await bag.close();
  }
  // Let the runtime report any unhandled rejection to the test runner.
  await new Promise<void>(resolve => setTimeout(resolve, 0));
});

test('metadata requires plain records and accepts records without a prototype', async () => {
  class Origin {
    source = 'remote';
    label() { return this.source; }
  }
  for (const async of [false, true]) {
    const decorate = (describe: () => object) => async
      ? DiBag.withMetadata(() => 1, { dynamic: { mode: 'awaited', describe: describe } })
      : DiBag.withMetadata(() => 1, { dynamic: { mode: 'direct', describe: describe } });
    for (const invalid of [new Date(), new Origin()]) {
      const bag = DiBag.createBuilder().register({ value: decorate(() => invalid) }).build();
      if (async) await expect(bag.resolve('value')).rejects.toBeInstanceOf(TypeError);
      else expect(() => bag.resolve('value')).toThrow(TypeError);
      await bag.close();
    }
    const record = Object.assign(Object.create(null), { source: 'remote' });
    const bag = DiBag.createBuilder().register({ value: decorate(() => record) }).build();
    expect(await bag.resolve('value')).toBe(1);
    expect(bag.inspect('value').acquisitions[0]!.acquisitionMetadata).toEqual([
      { present: true, value: { source: 'remote' } },
    ]);
    await bag.close();
  }
});

test('metadata getters are captured exactly once, including an ordinary then field', async () => {
  let reads = 0;
  const metadata = { get then() { return ++reads; } };
  const bag = DiBag.createBuilder().register({ value: DiBag.withMetadata(() => 1, { dynamic: { mode: 'direct', describe: () => metadata } }) }).build();
  expect(bag.resolve('value')).toBe(1);
  expect(reads).toBe(1);
  expect(bag.inspect('value').acquisitions[0]!.acquisitionMetadata).toEqual([{ present: true, value: { then: 1 } }]);
  await bag.close();
});

test('metadata retains typed token dependencies and root and transient lifetime caching', async () => {
  const key = Symbol('metadata dependency');
  const token = DiBag.token(key).of<{ value: number }>();
  let captures = 0;
  const source = DiBag.fromFunction([token], dependency => ({ dependency }));
  const root = DiBag.withMetadata(DiBag.withLifetime(source, 'root'), { dynamic: { mode: 'direct', describe: value => ({ count: ++captures, dependency: value.dependency }) } });
  const transient = DiBag.withMetadata(DiBag.withLifetime(() => ++captures, 'transient'), { dynamic: { mode: 'direct', describe: value => ({ count: value }) } });
  const dependency = { value: 42 };
  const bag = DiBag.createBuilder().register(token, DiBag.withLifetime(() => dependency, 'root')).register({ root, transient }).build();
  const child = bag.createScope();
  expect(child.resolve('root')).toBe(bag.resolve('root'));
  expect(child.resolve('root').dependency).toBe(dependency);
  expect(bag.resolve('transient')).toBe(2);
  expect(bag.resolve('transient')).toBe(3);
  expect(bag.inspect('transient').acquisitions.map(attempt => attempt.acquisitionMetadata)).toEqual([
    [{ present: true, value: { count: 2 } }], [{ present: true, value: { count: 3 } }],
  ]);
  await child.close();
  await bag.close();
});
