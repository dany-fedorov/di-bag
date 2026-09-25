import { expect, test } from 'bun:test';
import { DiBag } from '../src';
import { DiBag as Core } from '../src';
import { isPromise } from 'node:util/types';
import { runInNewContext } from 'node:vm';
import { withoutBuiltinModule } from './host-builtin-module';

const caught = (run: () => unknown): { code?: string; message: string; details: Record<string, unknown> } => {
  try { run(); } catch (error) { return error as never; }
  throw new Error('expected a throw');
};

for (const stage of ['source', 'projection', 'metadata'] as const) {
  test(`close waits for a native acquisition with shadowed then at ${stage}`, async () => {
    let release!: (value: { id: number }) => void;
    const value = { id: 7 };
    const pending = new Promise<{ id: number }>(resolve => { release = resolve; });
    Object.defineProperty(pending, 'then', { value: undefined });
    const disposed: unknown[] = [];
    const factory = stage === 'source' ? () => pending : stage === 'projection'
      ? DiBag.providerWithTransformedService({ provider: () => 0, transformService: () => pending, callbackReceives: 'exposed-service' })
      : DiBag.providerWithAcquisitionMetadata({ provider: () => pending, describeAcquisition: () => ({ stage: 'metadata' }), callbackReceives: 'exposed-service' });
    const bag = DiBag.createBuilder().withServices({
      value: DiBag.providerWithDisposal({ provider: factory, disposeService: resource => { disposed.push(resource); } }),
    }).buildContainer();
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
  const bag = Core.createBuilder().withServices({
    answer: async () => 42,
    same: () => pending,
    thenable: Core.createProvider(() => thenable, { factoryReturnKind: 'uninspected' }),
  }).buildContainer();
  expect(await bag.resolve('answer')).toBe(42);
  expect(bag.resolve('same')).toBe(pending);
  expect(bag.resolve('thenable')).toBe(thenable);
  const scope = bag.createChildContainer();
  const fork = bag.createIndependentContainer();
  // Scopes and forks reuse the classifier resolved at build.
  withoutBuiltinModule(() => { expect(scope.resolve('same')).toBe(pending); expect(fork.resolve('same')).toBe(pending); });
  await Promise.all([scope.close(), fork.close()]);
  await bag.close();
  const started = await Core.createBuilder().withServices({ answer: async () => 7 }).buildContainer().ensureServicesReady(['answer']);
  expect(await started.resolve('answer')).toBe(7);
  await started.close();
});

test('bare entry fires DI_BAG_CLASSIFIER_REQUIRED on hosts without a usable process.getBuiltinModule', () => {
  const build = () => Core.createBuilder().withServices({ value: () => 1 }).buildContainer();
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
    Core.createBuilder().withServices({ raw: Core.createProvider(() => 1, { factoryReturnKind: 'uninspected' }) }).buildContainer(),
    configured.createBuilder().withServices({ value: () => 2 }).buildContainer(),
  ], counting);
  expect(explicit.resolve('raw')).toBe(1);
  expect(automatic.resolve('value')).toBe(2);
  expect(classified).toEqual([2]);
  expect(loads).toBe(0);
  const detected = withoutBuiltinModule(() => Core.createBuilder().withServices({ value: async () => 3 }).buildContainer(), counting);
  expect(await detected.resolve('value')).toBe(3);
  expect(loads).toBe(1);
  await Promise.all([explicit.close(), automatic.close(), detected.close()]);
});

test('unconfigured core preflights every stage and private module before any factory effects', () => {
  let calls = 0;
  const source = Core.createProvider(() => { calls++; return 1; }, { factoryReturnKind: 'uninspected' });
  const automatic = () => { calls++; return 2; };
  const feature = Core.createBuilder().withServices({ hidden: automatic, public: source }).buildModule({ exportedServiceKeys: ['public'] });
  const cases: Array<[() => unknown, readonly string[]]> = [
    [() => Core.createBuilder().withServices({ source, automatic }).buildContainer(), ['automatic']],
    [() => Core.createBuilder().withServices({ projected: Core.providerWithTransformedService({ provider: source, transformService: value => { calls++; return value; }, callbackReceives: 'exposed-service' }) }).buildContainer(), ['projected']],
    [() => Core.createBuilder().withInstalledModules([feature]).buildContainer(), ['hidden']],
  ];
  for (const [finalize, bindings] of cases) {
    const failure = caught(() => withoutBuiltinModule<unknown>(finalize));
    expect(failure.code).toBe('DI_BAG_CLASSIFIER_REQUIRED');
    expect(failure.details.bindings).toEqual(bindings);
  }
  expect(calls).toBe(0);
});

test('facades snapshot and isolate their predicate, carrying it through builders and forks', async () => {
  const options: { isNativePromise: (value: unknown) => boolean } = { isNativePromise: isPromise };
  const configured = Core.withConfiguration({ runtime: options });
  options.isNativePromise = () => { throw new Error('mutated options'); };
  const pending = Promise.resolve(7);
  const symbol = Symbol('shared registry');
  const key = Core.createToken(symbol).forService<Promise<number>>();
  const provider = Core.createProvider(() => pending, { factoryReturnKind: 'auto-detect' });
  const feature = Core.createBuilder().withTokenService(key, provider).buildModule({ exportedServiceKeys: [key] });
  const bag = configured.createBuilder().withInstalledModules([feature]).buildContainer();
  const forks = [bag.createIndependentContainer(), bag.createIndependentContainer([key], { [key.symbol]: () => pending })];
  for (const item of [bag, ...forks]) { expect(item.resolve(key)).toBe(pending); await item.close(); }
  expect(() => withoutBuiltinModule(() => Core.createBuilder().withServices({ value: () => 1 }).buildContainer())).toThrow('DI_BAG_CLASSIFIER_REQUIRED: this host has no process.getBuiltinModule');
  const failure = new Error('predicate failure');
  const other = Core.withConfiguration({ runtime: { isNativePromise: () => { throw failure; } } }).createBuilder().withServices({ value: () => 1 }).buildContainer();
  expect(() => other.resolve('value')).toThrow(failure);
  await other.close();
});

test('invalid configuration, modes and classifier results fail explicitly', async () => {
  for (const options of [null, {}, { isNativePromise: 1 }]) {
    expect(() => Reflect.apply(Core.withConfiguration, undefined, [{ runtime: options }])).toThrow('isNativePromise');
  }
  for (const options of [null, { factoryReturnKind: 'guess' }, { factoryReturnKind: null }]) {
    expect(() => Reflect.apply(Core.createProvider, undefined, [() => 1, options])).toThrow();
  }
  const bad = Reflect.apply(Core.withConfiguration, undefined, [{ runtime: { isNativePromise: () => 'yes' } }]);
  const bag = bad.createBuilder().withServices({ value: () => 1 }).buildContainer();
  expect(() => bag.resolve('value')).toThrow('boolean');
  await bag.close();
});

test('automatic ordinary values preserve the then-presence guard', async () => {
  let reads = 0;
  const value = new Proxy({}, { has: () => false, get: () => { reads++; throw new Error('unexpected then read'); } });
  const bag = DiBag.createBuilder().withServices({ value: () => value }).buildContainer();
  expect(bag.resolve('value')).toBe(value);
  expect(reads).toBe(0);
  await bag.close();
});

test('raw Promise and then-getter values retain exact ownership without observation or waiting', async () => {
  const pending = new Promise<number>(() => {});
  const throwing = { get then(): never { throw new Error('raw getter'); } };
  const disposed: unknown[] = [];
  const bag = Core.createBuilder().withServices({
    pending: Core.providerWithDisposal({ provider: Core.createProvider(() => pending, { factoryReturnKind: 'uninspected' }), disposeService: value => { disposed.push(value); } }),
    throwing: Core.providerWithDisposal({ provider: Core.createProvider(() => throwing, { factoryReturnKind: 'uninspected' }), disposeService: value => { disposed.push(value); } }),
  }).buildContainer();
  expect(bag.resolve('pending')).toBe(pending);
  expect(bag.resolve('throwing')).toBe(throwing);
  await bag.close();
  expect(disposed).toEqual([throwing, pending]);
});

test('explicit native and async projections work without a classifier and preserve previous owners', async () => {
  const pending = Promise.resolve({ id: 7 });
  const disposed: unknown[] = [];
  const source = Core.providerWithDisposal({ provider: Core.createProvider(() => pending, { factoryReturnKind: 'uninspected' }), disposeService: value => { disposed.push(value); } });
  const native = Core.providerWithDisposal({ provider: Core.providerWithTransformedService({ provider: source, transformService: value => value, callbackReceives: 'exposed-service', transformReturnKind: 'native-promise' }), disposeService: value => { disposed.push(value); } });
  const bag = Core.createBuilder().withServices({ native, mapped: Core.providerWithTransformedService({ provider: Core.createProvider(() => 3, { factoryReturnKind: 'uninspected' }), transformService: value => value + 1, callbackReceives: 'fulfilled-value' }) }).buildContainer();
  expect(bag.resolve('native')).toBe(pending);
  expect(await bag.resolve('mapped')).toBe(4);
  await bag.close();
  expect(disposed).toEqual([{ id: 7 }, pending]);
});

for (const foreign of [false, true]) for (const mode of ['auto-detect', 'native-promise'] as const) {
  test(`${mode} observes ${foreign ? 'foreign' : 'local'} native state with non-callable then`, async () => {
    const resource = { id: 7 };
    const pending: Promise<typeof resource> = foreign ? runInNewContext('Promise.resolve(resource)', { resource }) : Promise.resolve(resource);
    Object.defineProperty(pending, 'then', { value: undefined });
    const disposed: unknown[] = [];
    const bag = DiBag.createBuilder().withServices({ value: DiBag.providerWithDisposal({ provider: DiBag.createProvider(() => pending, { factoryReturnKind: mode }), disposeService: value => { disposed.push(value); } }) }).buildContainer();
    expect(bag.resolve('value')).toBe(pending);
    await bag.close();
    expect(disposed).toEqual([resource]);
  });
}

test('native metadata preserves raw presence records and explicit payload projection', async () => {
  const pending = new Promise<number>(() => {});
  const source = Core.providerWithAcquisitionMetadata({ provider: Core.createProvider(() => ({ present: true as const, value: pending }), { factoryReturnKind: 'uninspected' }), describeAcquisition: () => ({ source: 'pending' }), callbackReceives: 'exposed-service' });
  const disposed: unknown[] = [];
  const raw = Core.providerWithDisposal({ provider: Core.providerWithTransformedService({ provider: source, transformService: record => record.value, callbackReceives: 'exposed-service', transformReturnKind: 'uninspected' }), disposeService: value => { disposed.push(value); } });
  const bag = Core.createBuilder().withServices({ presence: source, raw }).buildContainer();
  expect(bag.resolve('presence')).toEqual({ present: true, value: pending });
  expect(bag.resolve('raw')).toBe(pending);
  await bag.close();
  expect(disposed).toEqual([pending]);
});

test('async metadata retains a native output contract without a portable classifier', async () => {
  const source = Core.createProvider(() => Promise.resolve(7), { factoryReturnKind: 'native-promise' });
  const bag = Core.createBuilder().withServices({ value: Core.providerWithAcquisitionMetadata({ provider: source, describeAcquisition: value => ({ result: value }), callbackReceives: 'fulfilled-value' }) }).buildContainer();
  expect(await bag.resolve('value')).toBe(7);
  expect(bag.serviceSnapshot('value').acquisitions[0]?.acquisitionMetadata).toEqual([{ isPresent: true, value: { result: 7 } }]);
  await bag.close();
});

test('DI_BAG_CLASSIFIER_REQUIRED names every automatic registration, sorted, and suggests the helpers', () => {
  const raw = Core.createProvider(() => 1, { factoryReturnKind: 'uninspected' });
  const feature = Core.createBuilder().withServices({ hidden: () => 1, shown: ({ hidden }: { hidden: number }) => hidden }).buildModule({ exportedServiceKeys: ['shown'], moduleLabel: 'billing' });
  const failure = caught(() => withoutBuiltinModule(() => Core.createBuilder().withInstalledModules([feature]).withServices({
    raw,
    plain: () => 2,
    projected: Core.providerWithTransformedService({ provider: raw, transformService: value => value, callbackReceives: 'exposed-service' }),
    sync: Core.createProvider(() => 3, { factoryReturnKind: 'sync-value' }),
    pending: Core.createProvider(async () => 4, { factoryReturnKind: 'native-promise' }),
  }).buildContainer()));
  expect(failure.code).toBe('DI_BAG_CLASSIFIER_REQUIRED');
  expect(failure.details).toEqual({ option: 'runtime.isNativePromise', bindings: ['billing/hidden', 'plain', 'projected', 'shown'] });
  expect(Object.isFrozen(failure.details.bindings)).toBe(true);
  expect(failure.message).toBe("DI_BAG_CLASSIFIER_REQUIRED: this host has no process.getBuiltinModule; 4 registrations use auto-detect factory return kind: \"billing/hidden\", \"plain\", \"projected\", \"shown\"; use DiBag.createProvider(factory, { factoryReturnKind: 'sync-value' }) or factoryReturnKind: 'native-promise' for each, or configure DiBag.withConfiguration({ runtime: { isNativePromise } }); see https://dany-fedorov.github.io/di-bag/agent/errors.html#di-bag-classifier-required");
});

test('the classifier message lists at most eight registrations; details carry them all', () => {
  const registrations = Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`s${String(index).padStart(2, '0')}`, () => index]));
  const failure = caught(() => withoutBuiltinModule(() => Core.createBuilder().withServices(registrations as never).buildContainer()));
  expect(failure.details.bindings).toHaveLength(12);
  expect(failure.message).toContain("12 registrations use auto-detect factory return kind: \"s00\", \"s01\", \"s02\", \"s03\", \"s04\", \"s05\", \"s06\", \"s07\", and 4 more; use DiBag.createProvider(factory, { factoryReturnKind: 'sync-value' })");
});

test('a host classifier is consulted once, at the first automatic registration', async () => {
  let loads = 0;
  const counting = (id: string) => { loads++; return id === 'node:util/types' ? { isPromise } : undefined; };
  const bag = withoutBuiltinModule(() => Core.createBuilder().withServices({ a: () => 1, b: () => 2, c: () => 3 }).buildContainer(), counting);
  expect(loads).toBe(1);
  await bag.close();
});
