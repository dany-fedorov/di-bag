import { expect, test } from 'bun:test';
import { DiBag } from '../src';
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
    during = bag.serviceSnapshot('value').acquisitions[0]!.acquisitionMetadata;
    return { value: payload, origin: 'source' };
  };
  const first = DiBag.providerWithAcquisitionMetadata({ provider: source, describeAcquisition: function (this: void, result) {
    expect(this).toBeUndefined();
    expect(result.origin).toBe('source');
    calls++;
    return metadata;
  }, callbackReceives: 'exposed-service' });
  const value = DiBag.providerWithTransformedService({ provider: DiBag.providerWithAcquisitionMetadata({ provider: first, describeAcquisition: result => ({ second: result.origin }), callbackReceives: 'exposed-service' }), transformService: result => result.value, callbackReceives: 'exposed-service' });
  const bag = DiBag.createBuilder().withServices({ value }).buildContainer();
  expect(calls).toBe(0);
  expect(bag.serviceSnapshot('value').acquisitions).toEqual([]);
  expect(bag.resolve('value')).toBe(payload);
  expect(bag.resolve('value')).toBe(payload);
  expect(calls).toBe(1);
  expect(during).toEqual([{ present: false }, { present: false }]);
  const frames = bag.serviceSnapshot('value').acquisitions[0]!.acquisitionMetadata;
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
  const raw = PortableDiBag.createProvider(() => gate.promise, { factoryReturnKind: 'uninspected' });
  const source = PortableDiBag.providerWithRegistrationMetadata({ provider: PortableDiBag.providerWithTransformedService({ provider: raw, transformService: value => value, callbackReceives: 'exposed-service', transformReturnKind: 'uninspected' }), registrationMetadata: { team: 'native' } });
  const annotated = PortableDiBag.providerWithAcquisitionMetadata({ provider: source, describeAcquisition: value => ({ exact: value }), callbackReceives: 'exposed-service' });
  const bag = PortableDiBag.createBuilder().withServices({ value: PortableDiBag.providerWithDisposal({ provider: annotated, disposeService: value => { disposed = value; } }) }).buildContainer();
  expect(bag.resolve('value')).toBe(gate.promise);
  expect(bag.serviceSnapshot('value').acquisitions[0]!.state).toBe('ready');
  await bag.close();
  expect(disposed).toBe(gate.promise);
  expect(thenReads).toBe(0);
  gate.resolve(3);
});

test('async metadata awaits raw thenables and exposes a native Promise', async () => {
  const raw = { then(resolve: (value: { origin: string }) => unknown) { return resolve({ origin: 'remote' }); } };
  const source = PortableDiBag.createProvider(() => raw, { factoryReturnKind: 'uninspected' });
  const bag = PortableDiBag.createBuilder().withServices({ value: PortableDiBag.providerWithAcquisitionMetadata({ provider: source, describeAcquisition: result => ({ origin: result.origin }), callbackReceives: 'fulfilled-value' }) }).buildContainer();
  const value = bag.resolve('value');
  expect(value).toBeInstanceOf(Promise);
  expect(bag.serviceSnapshot('value').acquisitions[0]!.acquisitionMetadata).toEqual([{ present: false }]);
  await expect(value).resolves.toEqual({ origin: 'remote' });
  expect(bag.serviceSnapshot('value').acquisitions[0]!.acquisitionMetadata).toEqual([{ present: true, value: { origin: 'remote' } }]);
  await bag.close();
});

test('native acquisition remains pending and disposes fulfilled values after immediate annotation', async () => {
  const gate = deferred<number>();
  const disposed: number[] = [];
  const source = PortableDiBag.createProvider(() => gate.promise, { factoryReturnKind: 'native-promise' });
  const bag = PortableDiBag.createBuilder().withServices({ value: PortableDiBag.providerWithDisposal({ provider: PortableDiBag.providerWithAcquisitionMetadata({ provider: source, describeAcquisition: promise => ({ promise }), callbackReceives: 'exposed-service' }), disposeService: value => { disposed.push(value); } }) }).buildContainer();
  expect(bag.resolve('value')).toBe(gate.promise);
  expect(bag.serviceSnapshot('value').acquisitions[0]!.state).toBe('pending');
  const closing = bag.close();
  gate.resolve(7);
  await closing;
  expect(disposed).toEqual([7]);
});

test('annotation errors preserve original failures, cleanup, and independent retries and scopes', async () => {
  const cause = { annotation: 'failed' };
  const disposed: number[] = [];
  let attempt = 0;
  const service = DiBag.providerWithAcquisitionMetadata({ provider: DiBag.providerWithDisposal({ provider: () => ++attempt, disposeService: value => { disposed.push(value); } }), describeAcquisition: value => {
    if (value === 1) throw cause;
    return { attempt: value };
  }, callbackReceives: 'exposed-service' });
  const bag = DiBag.createBuilder().withServices({ service }).buildContainer();
  let failure: unknown;
  try { bag.resolve('service'); } catch (error) { failure = error; }
  expect(failure).toBe(cause);
  expect(bag.resolve('service')).toBe(2);
  const child = bag.createChildContainer();
  expect(child.resolve('service')).toBe(3);
  expect(bag.serviceSnapshot('service').acquisitions.at(-1)!.acquisitionMetadata).toEqual([{ present: true, value: { attempt: 2 } }]);
  expect(child.serviceSnapshot('service').acquisitions[0]!.acquisitionMetadata).toEqual([{ present: true, value: { attempt: 3 } }]);
  await child.close();
  await bag.close();
  expect(disposed).toEqual([1, 3, 2]);
});

test('async annotation rejection cleans source ownership and skips failed sources', async () => {
  const cause = new Error('annotation');
  const disposed: number[] = [];
  let called = false;
  const bag = DiBag.createBuilder().withServices({
    annotation: DiBag.providerWithAcquisitionMetadata({ provider: DiBag.providerWithDisposal({ provider: async () => 1, disposeService: value => { disposed.push(value); } }), describeAcquisition: () => { throw cause; }, callbackReceives: 'fulfilled-value' }),
    source: DiBag.providerWithAcquisitionMetadata({ provider: () => { throw cause; }, describeAcquisition: () => { called = true; return {}; }, callbackReceives: 'fulfilled-value' }),
  }).buildContainer();
  await expect(bag.resolve('annotation')).rejects.toBe(cause);
  await expect(bag.resolve('source')).rejects.toBe(cause);
  await bag.close();
  expect(disposed).toEqual([1]);
  expect(called).toBe(false);
});

test('metadata callbacks and returned records reject malformed and asynchronous values', async () => {
  for (const async of [false, true]) {
    const decorate = (callback: () => object) => async
      ? DiBag.providerWithAcquisitionMetadata({ provider: () => 1, describeAcquisition: callback, callbackReceives: 'fulfilled-value' })
      : DiBag.providerWithAcquisitionMetadata({ provider: () => 1, describeAcquisition: callback, callbackReceives: 'exposed-service' });
    expect(() => decorate(null as never)).toThrow();
    for (const invalid of [null, undefined, 1, 'metadata', [], () => ({}), Promise.resolve({}), { then() {} }, Object.create({ then() {} })]) {
      const bag = DiBag.createBuilder().withServices({ value: decorate((() => invalid) as never) }).buildContainer();
      if (!async) expect(() => bag.resolve('value')).toThrow();
      else await expect(bag.resolve('value')).rejects.toThrow();
      await bag.close();
    }
  }
});

test('annotations retain present undefined values and add no ownership', async () => {
  let disposed = false;
  const value = { present: true as const, value: undefined, dispose() { disposed = true; } };
  const bag = DiBag.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent() {}, onObserverFailure() {} }] }).createBuilder().withServices({
    value: DiBag.providerWithAcquisitionMetadata({ provider: () => value, describeAcquisition: result => ({ presence: result.present, payload: result.value }), callbackReceives: 'exposed-service' }),
  }).buildContainer();
  expect(bag.resolve('value')).toBe(value);
  expect(bag.serviceSnapshot('value').acquisitions[0]!.acquisitionMetadata).toEqual([{ present: true, value: { presence: true, payload: undefined } }]);
  await bag.close();
  expect(disposed).toBe(false);
});

test('rejecting accidentally async metadata observes its rejected Promise in both modes', async () => {
  // Structural widening can hide an async return type from the static admission check.
  const describe: () => object = async () => { throw new Error('invalid async metadata'); };
  for (const async of [false, true]) {
    const value = async
      ? DiBag.providerWithAcquisitionMetadata({ provider: () => 1, describeAcquisition: describe, callbackReceives: 'fulfilled-value' })
      : DiBag.providerWithAcquisitionMetadata({ provider: () => 1, describeAcquisition: describe, callbackReceives: 'exposed-service' });
    const bag = DiBag.createBuilder().withServices({ value }).buildContainer();
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
      ? DiBag.providerWithAcquisitionMetadata({ provider: () => 1, describeAcquisition: describe, callbackReceives: 'fulfilled-value' })
      : DiBag.providerWithAcquisitionMetadata({ provider: () => 1, describeAcquisition: describe, callbackReceives: 'exposed-service' });
    for (const invalid of [new Date(), new Origin()]) {
      const bag = DiBag.createBuilder().withServices({ value: decorate(() => invalid) }).buildContainer();
      if (async) await expect(bag.resolve('value')).rejects.toBeInstanceOf(TypeError);
      else expect(() => bag.resolve('value')).toThrow(TypeError);
      await bag.close();
    }
    const record = Object.assign(Object.create(null), { source: 'remote' });
    const bag = DiBag.createBuilder().withServices({ value: decorate(() => record) }).buildContainer();
    expect(await bag.resolve('value')).toBe(1);
    expect(bag.serviceSnapshot('value').acquisitions[0]!.acquisitionMetadata).toEqual([
      { present: true, value: { source: 'remote' } },
    ]);
    await bag.close();
  }
});

test('metadata getters are captured exactly once, including an ordinary then field', async () => {
  let reads = 0;
  const metadata = { get then() { return ++reads; } };
  const bag = DiBag.createBuilder().withServices({ value: DiBag.providerWithAcquisitionMetadata({ provider: () => 1, describeAcquisition: () => metadata, callbackReceives: 'exposed-service' }) }).buildContainer();
  expect(bag.resolve('value')).toBe(1);
  expect(reads).toBe(1);
  expect(bag.serviceSnapshot('value').acquisitions[0]!.acquisitionMetadata).toEqual([{ present: true, value: { then: 1 } }]);
  await bag.close();
});

test('metadata retains typed token dependencies and root and transient lifetime caching', async () => {
  const key = Symbol('metadata dependency');
  const token = DiBag.createToken(key).forService<{ value: number }>();
  let captures = 0;
  const source = DiBag.createProviderFromFunction({ dependencies: [token], factoryFunction: dependency => ({ dependency }) });
  const root = DiBag.providerWithAcquisitionMetadata({ provider: DiBag.providerWithLifetime({ provider: source, lifetime: 'singleton:one-per-container-tree' }), describeAcquisition: value => ({ count: ++captures, dependency: value.dependency }), callbackReceives: 'exposed-service' });
  const transient = DiBag.providerWithAcquisitionMetadata({ provider: DiBag.providerWithLifetime({ provider: () => ++captures, lifetime: 'transient:one-per-resolve' }), describeAcquisition: value => ({ count: value }), callbackReceives: 'exposed-service' });
  const dependency = { value: 42 };
  const bag = DiBag.createBuilder().withTokenService(token, DiBag.providerWithLifetime({ provider: () => dependency, lifetime: 'singleton:one-per-container-tree' })).withServices({ root, transient }).buildContainer();
  const child = bag.createChildContainer();
  expect(child.resolve('root')).toBe(bag.resolve('root'));
  expect(child.resolve('root').dependency).toBe(dependency);
  expect(bag.resolve('transient')).toBe(2);
  expect(bag.resolve('transient')).toBe(3);
  expect(bag.serviceSnapshot('transient').acquisitions.map(attempt => attempt.acquisitionMetadata)).toEqual([
    [{ present: true, value: { count: 2 } }], [{ present: true, value: { count: 3 } }],
  ]);
  await child.close();
  await bag.close();
});
