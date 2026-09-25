import { expect, test } from 'bun:test';
import { DiBag } from '../src';

const caught = (run: () => unknown): any => { try { run(); } catch (error) { return error; } throw new Error('expected throw'); };

test('fallback bags retain all stages, ownership and operation names', async () => {
  const events: string[] = [];
  const source = DiBag.createProvider(() => ({ value: 2 }));
  const owned = DiBag.providerWithDisposal({ provider: source, disposeService: service => { events.push(`source:${service.value}`); } });
  const registered = DiBag.providerWithRegistrationMetadata({ provider: owned, registrationMetadata: { owner: 'platform' as const } });
  const framed = DiBag.providerWithAcquisitionMetadata({ provider: registered, callbackReceives: 'exposed-service', describeAcquisition: service => ({ before: service.value }) });
  const mapped = DiBag.providerWithTransformedService({ provider: framed, callbackReceives: 'exposed-service', transformService: service => service.value * 3 });
  const final = DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: mapped, disposeService: service => { events.push(`mapped:${service}`); } }), lifetime: 'singleton:one-per-container-tree' });
  expect(Object.isFrozen(final)).toBe(true);
  expect(Object.getOwnPropertyNames(Object.getPrototypeOf(final))).toEqual(['constructor']);
  const container = DiBag.createBuilder().withServices({ value: final }).buildContainer();
  expect(container.resolve('value')).toBe(6);
  const snapshot = container.serviceSnapshot('value');
  expect(snapshot.registrationMetadata).toEqual({ owner: 'platform' });
  expect(snapshot.acquisitions[0]?.acquisitionMetadata).toEqual([{ isPresent: true, value: { before: 2 } }]);
  await container.close();
  expect(events).toEqual(['mapped:6', 'source:2']);
});

test('fulfilled callbacks await input while exposed callbacks preserve identity', async () => {
  const pending = Promise.resolve(4);
  let exposed: unknown;
  const directSource = DiBag.createProvider(() => pending, { factoryReturnKind: 'native-promise' });
  const direct = DiBag.providerWithTransformedService({ provider: DiBag.providerWithAcquisitionMetadata({ provider: directSource, callbackReceives: 'exposed-service', describeAcquisition: value => { exposed = value; return { direct: true }; } }), callbackReceives: 'exposed-service', transformService: value => value, transformReturnKind: 'native-promise' });
  const fulfilledSource = DiBag.createProvider(() => pending, { factoryReturnKind: 'native-promise' });
  const fulfilled = DiBag.providerWithTransformedService({ provider: DiBag.providerWithAcquisitionMetadata({ provider: fulfilledSource, callbackReceives: 'fulfilled-value', describeAcquisition: value => ({ value }) }), callbackReceives: 'fulfilled-value', transformService: value => value + 1 });
  const container = DiBag.createBuilder().withServices({ direct, fulfilled }).buildContainer();
  expect(container.resolve('direct')).toBe(pending);
  expect(await container.resolve('fulfilled')).toBe(5);
  expect(exposed).toBe(pending);
  await container.close();
});

test('fallback bags snapshot own fields and reject malformed combinations', () => {
  const provider = DiBag.createProvider(() => 1);
  let reads = 0;
  const transformed = DiBag.providerWithTransformedService({
    get provider() { reads++; return provider; },
    get transformService() { reads++; return (value: number) => value + reads; },
    get callbackReceives() { reads++; return 'exposed-service' as const; },
  });
  expect(reads).toBe(3);
  const container = DiBag.createBuilder().withServices({ transformed }).buildContainer();
  expect(container.resolve('transformed')).toBe(4);
  expect(container.resolve('transformed')).toBe(4);
  expect(reads).toBe(3);
  const inherited = Object.create({ callbackReceives: 'exposed-service' }); inherited.transformService = (value: number) => value;
  const cases: readonly [() => unknown, string, object][] = [
    [() => (DiBag as any).providerWithTransformedService({ provider: {}, callbackReceives: 'exposed-service', transformService: (value: unknown) => value }), 'DI_BAG_INVALID_PROVIDER', { operation: 'providerWithTransformedService' }],
    [() => (DiBag as any).providerWithDisposal({ provider, disposeService: 1 }), 'DI_BAG_INVALID_ARGUMENT', { operation: 'providerWithDisposal', argument: 'disposeService', expected: 'a function' }],
    ...(['root', 'scoped', 'transient'] as const).map(lifetime => [
      () => (DiBag as any).providerWithLifetime({ provider, lifetime }),
      'DI_BAG_INVALID_ARGUMENT',
      { operation: 'providerWithLifetime', argument: 'lifetime', expected: "one of: 'singleton:one-per-container-tree', 'scoped:one-per-container', 'transient:one-per-resolve'" },
    ] as const),
    [() => (DiBag as any).providerWithAcquisitionMetadata({ provider, callbackReceives: 'other', describeAcquisition() { return {}; } }), 'DI_BAG_INVALID_ARGUMENT', { operation: 'providerWithAcquisitionMetadata', argument: 'callbackReceives', expected: "one of: 'exposed-service', 'fulfilled-value'" }],
    [() => (DiBag as any).providerWithTransformedService({ provider, callbackReceives: 'fulfilled-value', transformService: (x: unknown) => x, transformReturnKind: 'sync-value' }), 'DI_BAG_INVALID_ARGUMENT', { operation: 'providerWithTransformedService', argument: 'transformReturnKind', expected: "absent when callbackReceives is 'fulfilled-value'" }],
    [() => (DiBag as any).providerWithTransformedService(Object.assign(inherited, { provider })), 'DI_BAG_INVALID_ARGUMENT', { operation: 'providerWithTransformedService', argument: 'options', expected: 'only the own properties: provider, transformService, callbackReceives, transformReturnKind' }],
    [() => (DiBag as any).providerWithAcquisitionMetadata({ provider, describeAcquisition: () => ({}), callbackReceives: 'exposed-service', [Symbol('extra')]: true }), 'DI_BAG_INVALID_ARGUMENT', { operation: 'providerWithAcquisitionMetadata', argument: 'options', expected: 'only the own properties: provider, describeAcquisition, callbackReceives' }],
  ];
  for (const [run, code, details] of cases) { const error = caught(run); expect(error.code).toBe(code); expect(error.details).toEqual(details); }
});

test('acquisition metadata callback failures name the fallback facade', () => {
  for (const result of [() => [], () => new Date(), () => ({ then() {} })]) {
    const provider = DiBag.providerWithAcquisitionMetadata({ provider: () => 1,
      callbackReceives: 'exposed-service',
      describeAcquisition: result as () => never,
    });
    const container = DiBag.createBuilder().withServices({ value: provider }).buildContainer();
    const error = caught(() => container.resolve('value'));
    expect(error).toBeInstanceOf(TypeError);
    expect(error.code).toBe('DI_BAG_INVALID_ACQUISITION_METADATA');
    expect(error.details.operation).toBe('providerWithAcquisitionMetadata');
  }
});

test('expand compatibility composes the retained disposal wrapper', async () => {
  const events: number[] = [];
  const owned = DiBag.providerWithDisposal({ provider: () => 2, disposeService: value => { events.push(value); } });
  const lifetimed = DiBag.providerWithLifetime({ provider: owned, lifetime: 'singleton:one-per-container-tree' });
  const metadata = DiBag.providerWithRegistrationMetadata({ provider: lifetimed, registrationMetadata: { legacy: true } });
  const transformed = DiBag.providerWithTransformedService({ provider: metadata, transformService: value => value + 1, callbackReceives: 'exposed-service' });
  const container = DiBag.createBuilder().withServices({ value: transformed }).buildContainer();
  expect(container.resolve('value')).toBe(3);
  expect(container.serviceSnapshot('value').registrationMetadata).toEqual({ legacy: true });
  await container.close();
  expect(events).toEqual([2]);
});

test('full lifetime values drive caches, snapshots, events, and diagnostics', async () => {
  let singleton = 0, scoped = 0, transient = 0;
  const events: string[] = [];
  const observed = DiBag.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent(event) { if ('lifetime' in event) events.push(event.lifetime); }, onObserverFailure() {} }] });
  const root = observed.createBuilder().withServices({
    singleton: observed.providerWithLifetime({ provider: () => ++singleton, lifetime: 'singleton:one-per-container-tree' }),
    scoped: observed.providerWithLifetime({ provider: () => ++scoped, lifetime: 'scoped:one-per-container' }),
    transient: observed.providerWithLifetime({ provider: () => ++transient, lifetime: 'transient:one-per-resolve' }),
  }).buildContainer();
  expect(root.resolve('singleton')).toBe(root.resolve('singleton'));
  expect(root.resolve('scoped')).toBe(root.resolve('scoped'));
  expect(root.resolve('transient')).not.toBe(root.resolve('transient'));
  const child = root.createChildContainer();
  expect(child.resolve('singleton')).toBe(root.resolve('singleton'));
  expect(child.resolve('scoped')).not.toBe(root.resolve('scoped'));
  expect(root.graphSnapshot().bindings.map(binding => binding.lifetime)).toEqual(['singleton:one-per-container-tree', 'scoped:one-per-container', 'transient:one-per-resolve']);
  await child.close(); await root.close();
  await Promise.resolve();
  expect(events.length).toBeGreaterThan(0);
  expect(events.every(value => value.includes(':one-per-'))).toBe(true);
});
