import { expect, test } from 'bun:test';
import { runInNewContext } from 'node:vm';
import { DiBag } from '../src';
import { withoutBuiltinModule } from './host-builtin-module';

test('createProvider preserves every factory return policy', async () => {
  let thenReads = 0;
  const structural = Object.defineProperty({}, 'then', { get() { thenReads++; throw new Error('must not read'); } });
  const pending = Promise.resolve({ id: 1 });
  const disposed: unknown[] = [];
  const container = DiBag.createBuilder().withServices({
    automatic: DiBag.createProvider(async () => 1),
    synchronous: DiBag.createProvider((): object => structural, { factoryReturnKind: 'sync-value' }),
    uninspected: DiBag.withDisposal(
      DiBag.createProvider((): object => pending, { factoryReturnKind: 'uninspected' }),
      value => { disposed.push(value); },
    ),
    native: DiBag.withDisposal(
      DiBag.createProvider(() => pending, { factoryReturnKind: 'native-promise' }),
      value => { disposed.push(value); },
    ),
  }).buildContainer();

  expect(container.resolve('automatic')).toBeInstanceOf(Promise);
  expect(container.resolve('synchronous')).toBe(structural);
  expect(container.resolve('uninspected')).toBe(pending);
  expect(container.resolve('native')).toBe(pending);
  expect(thenReads).toBe(0);
  const kinds = new Map(container.graphSnapshot().bindings.map(binding => [binding.label, binding.factoryReturnKind]));
  expect(kinds).toEqual(new Map([
    ['automatic', 'auto-detect'],
    ['synchronous', 'sync-value'],
    ['uninspected', 'uninspected'],
    ['native', 'native-promise'],
  ]));
  await container.close();
  expect(disposed).toContain(pending);
  expect(disposed).toContain(await pending);
});

test('native-promise uses the engine native-Promise check without invoking then', async () => {
  const crossRealm = runInNewContext('Promise.resolve({ id: 2 })') as Promise<{ id: number }>;
  class ServicePromise<T> extends Promise<T> {}
  const subclass = ServicePromise.resolve({ id: 3 });
  subclass.then = () => { throw new Error('own then must not run'); };
  for (const promise of [crossRealm, subclass]) {
    const container = withoutBuiltinModule(() => DiBag.createBuilder().withServices({
      service: DiBag.createProvider(() => promise, { factoryReturnKind: 'native-promise' }),
    }).buildContainer());
    expect(container.resolve('service')).toBe(promise);
    await container.close();
  }
  let calls = 0;
  const thenable = { then() { calls++; } };
  const invalid = withoutBuiltinModule(() => DiBag.createBuilder().withServices({
    service: DiBag.createProvider(() => thenable as never, { factoryReturnKind: 'native-promise' }),
  }).buildContainer());
  expect(() => invalid.resolve('service')).toThrow(TypeError);
  expect(calls).toBe(0);
  await invalid.close();
});

test('factoryReceivesContext supplies abortSignal and acquisition-local disposal', async () => {
  const events: string[] = [];
  let signal: AbortSignal | undefined;
  const container = DiBag.createBuilder().withServices({
    service: DiBag.createProvider((_dependencies: {}, factoryContext) => {
      signal = factoryContext.abortSignal;
      factoryContext.pushDisposer(disposerContext => { events.push(disposerContext.reason); });
      return 1;
    }, { factoryReturnKind: 'sync-value', factoryReceivesContext: true }),
  }).buildContainer();
  expect(container.resolve('service')).toBe(1);
  expect(signal).toBeInstanceOf(AbortSignal);
  expect(signal?.aborted).toBe(false);
  await container.close();
  expect(signal?.aborted).toBe(true);
  expect(events).toEqual(['no-service-disposer']);
});

test('createProvider snapshots its option bag and reports final validation details', () => {
  let kindReads = 0;
  let contextReads = 0;
  const options = {
    get factoryReturnKind() { kindReads++; return 'sync-value' as const; },
    get factoryReceivesContext() { contextReads++; return true as const; },
  };
  const provider = DiBag.createProvider((_dependencies: {}, _factoryContext) => 1, options);
  expect(typeof provider).toBe('object');
  expect([kindReads, contextReads]).toEqual([1, 1]);

  const call = DiBag.createProvider as (...arguments_: unknown[]) => unknown;
  for (const [arguments_, expected] of [
    [[1], { operation: 'createProvider', argument: 'factory', expected: 'a function' }],
    [[() => 1, null], { operation: 'createProvider', argument: 'options', expected: 'an object' }],
    [[() => 1, { extra: true }], { operation: 'createProvider', argument: 'options', expected: 'only the own properties: factoryReturnKind, factoryReceivesContext' }],
    [[() => 1, { factoryReturnKind: 'raw' }], { operation: 'createProvider', argument: 'factoryReturnKind', expected: "one of: 'auto-detect', 'sync-value', 'native-promise', 'uninspected'" }],
    [[() => 1, { factoryReceivesContext: false }], { operation: 'createProvider', argument: 'factoryReceivesContext', expected: "one of: 'true'" }],
  ] as const) {
    try { Reflect.apply(call, undefined, arguments_ as unknown as unknown[]); throw new Error('expected rejection'); }
    catch (error) {
      expect((error as { code?: string }).code).toBe('DI_BAG_INVALID_ARGUMENT');
      expect((error as { details?: unknown }).details).toEqual(expected);
    }
  }
});

test('positional function appends FactoryContext after required, optional, lazy, and collection values', async () => {
  const requiredSymbol = Symbol('required');
  const absentSymbol = Symbol('absent');
  const lazySymbol = Symbol('lazy');
  const itemsSymbol = Symbol('items');
  const required = DiBag.createToken(requiredSymbol).forService<number>();
  const absent = DiBag.createToken(absentSymbol).forService<number>();
  const lazy = DiBag.createToken(lazySymbol).forService<number>();
  const items = DiBag.createToken(itemsSymbol).forCollectionOf<number>();
  let seen: readonly unknown[] | undefined;
  const provider = DiBag.createProviderFromFunction({
    dependencies: [required, DiBag.optional(absent), DiBag.lazy(lazy), items],
    factoryReceivesContext: true,
    factoryReturnKind: 'sync-value',
    factoryFunction(value, maybe, get, collection, factoryContext) {
      seen = [value, maybe, get(), collection, factoryContext.abortSignal];
      return value + get() + collection.length;
    },
  });
  const container = DiBag.createBuilder()
    .withTokenService(required, () => 1)
    .withTokenService(lazy, () => 2)
    .withCollectionContribution({ collectionToken: items, provider: () => 3 })
    .withCollectionContribution({ collectionToken: items, provider: () => 4 })
    .withServices({ provider })
    .buildContainer();
  expect(container.resolve('provider')).toBe(5);
  expect(seen?.slice(0, 4)).toEqual([1, undefined, 2, [3, 4]]);
  expect(seen?.[4]).toBeInstanceOf(AbortSignal);
  await container.close();
});

test('class adapter constructs with new and never receives FactoryContext', async () => {
  const portSymbol = Symbol('port');
  const port = DiBag.createToken(portSymbol).forService<number>();
  class Client {
    readonly argumentCount: number;
    constructor(readonly port: number) { this.argumentCount = arguments.length; }
  }
  const provider = DiBag.createProviderFromClass({ dependencies: [port], serviceClass: Client, factoryReturnKind: 'sync-value' });
  const container = DiBag.createBuilder()
    .withTokenService(port, () => 8080)
    .withServices({ provider })
    .buildContainer();
  const client = container.resolve('provider');
  expect(client).toBeInstanceOf(Client);
  expect([client.port, client.argumentCount]).toEqual([8080, 1]);
  await container.close();
});

test('plugin adapter snapshots its bag, validates output, and preserves source ownership', async () => {
  const dependencySymbol = Symbol('dependency');
  const dependency = DiBag.createToken(dependencySymbol).forService<number>();
  const valid = { run: () => 42 };
  const disposed: unknown[] = [];
  const provider = DiBag.createProviderFromPlugin({
    dependencies: [dependency],
    pluginDescriptor: {
      apiVersion: 1,
      create: (value: number) => value === 7 ? valid : null,
      dispose: (value: unknown) => { disposed.push(value); },
    },
    factoryReturnKind: 'uninspected',
    isValidPluginOutput: (value: unknown): value is typeof valid => value === valid,
  });
  const container = DiBag.createBuilder()
    .withTokenService(dependency, () => 7)
    .withServices({ provider })
    .buildContainer();
  expect(container.resolve('provider')).toBe(valid);
  await container.close();
  expect(disposed).toEqual([valid]);
});

test('native-promise plugin validates fulfillment, disposes it, and never assimilates structural thenables', async () => {
  const fulfilled = { run: () => 9 };
  const pending = Promise.resolve(fulfilled);
  const disposed: unknown[] = [];
  const provider = DiBag.createProviderFromPlugin({
    dependencies: [],
    pluginDescriptor: { apiVersion: 1, create: () => pending, dispose: (value: unknown) => { disposed.push(value); } },
    factoryReturnKind: 'native-promise',
    isValidPluginOutput: (value: unknown): value is typeof fulfilled => value === fulfilled,
  });
  const container = DiBag.createBuilder().withServices({ provider }).buildContainer();
  const exposed = container.resolve('provider');
  expect(exposed).not.toBe(pending);
  expect(container.resolve('provider')).toBe(exposed);
  await expect(exposed).resolves.toBe(fulfilled);
  await container.close();
  expect(disposed).toEqual([fulfilled]);

  const rejected = DiBag.createBuilder().withServices({
    provider: DiBag.createProviderFromPlugin({
      dependencies: [],
      pluginDescriptor: { apiVersion: 1, create: () => Promise.reject(new Error('plugin failed')) },
      factoryReturnKind: 'native-promise',
      isValidPluginOutput: (_value: unknown): _value is never => false,
    }),
  }).buildContainer();
  await expect(rejected.resolve('provider')).rejects.toThrow('plugin failed');
  await rejected.close();

  let thenCalls = 0;
  const thenable = { then() { thenCalls++; } };
  const invalid = DiBag.createBuilder().withServices({
    provider: DiBag.createProviderFromPlugin({
      dependencies: [],
      pluginDescriptor: { apiVersion: 1, create: () => thenable },
      factoryReturnKind: 'native-promise',
      isValidPluginOutput: (_value: unknown): _value is never => false,
    }),
  }).buildContainer();
  await expect(invalid.resolve('provider')).rejects.toBeInstanceOf(TypeError);
  expect(thenCalls).toBe(0);
  await invalid.close();
});

test('native-promise plugin rejects invalid fulfillment and disposes the source once', async () => {
  const rejectedValue = { run: 0 };
  const disposed: unknown[] = [];
  const provider = DiBag.createProviderFromPlugin({
    dependencies: [],
    pluginDescriptor: {
      apiVersion: 1,
      create: () => Promise.resolve(rejectedValue),
      dispose: (value: unknown) => { disposed.push(value); },
    },
    factoryReturnKind: 'native-promise',
    isValidPluginOutput: (value: unknown): value is { run: 1 } =>
      typeof value === 'object' && value !== null && 'run' in value && value.run === 1,
  });
  const container = DiBag.createBuilder().withServices({ provider }).buildContainer();
  const exposed = container.resolve('provider');
  await expect(exposed).rejects.toMatchObject({
    code: 'DI_BAG_PLUGIN_VALIDATION',
    details: { operation: 'createProviderFromPlugin', phase: 'output', reason: 'plugin output failed validation' },
  });
  await container.close();
  expect(disposed).toEqual([rejectedValue]);
});

test('new source bags reject malformed arguments before factory effects', () => {
  const call = (name: 'createProviderFromFunction' | 'createProviderFromClass' | 'createProviderFromPlugin', options: unknown) => {
    try { Reflect.apply(DiBag[name] as (...arguments_: unknown[]) => unknown, undefined, [options]); throw new Error('expected rejection'); }
    catch (error) { return error as { code: string; details: unknown }; }
  };
  expect(call('createProviderFromFunction', { dependencies: [], factoryFunction: 1 })).toMatchObject({
    code: 'DI_BAG_INVALID_ARGUMENT', details: { operation: 'createProviderFromFunction', argument: 'factoryFunction', expected: 'a function' },
  });
  expect(call('createProviderFromFunction', { dependencies: null, factoryFunction: () => 1 })).toMatchObject({
    code: 'DI_BAG_INVALID_ARGUMENT', details: { operation: 'createProviderFromFunction', argument: 'dependencies', expected: 'an array' },
  });
  expect(call('createProviderFromClass', { dependencies: [], serviceClass: () => 1 })).toMatchObject({
    code: 'DI_BAG_INVALID_ARGUMENT', details: { operation: 'createProviderFromClass', argument: 'serviceClass', expected: 'a constructor that can be called with new' },
  });
  expect(call('createProviderFromPlugin', { dependencies: [], pluginDescriptor: {}, factoryReturnKind: 'uninspected' })).toMatchObject({
    code: 'DI_BAG_INVALID_ARGUMENT', details: { operation: 'createProviderFromPlugin', argument: 'isValidPluginOutput', expected: 'present' },
  });
});

test('createToken publishes symbol and both exclusive token constructors', () => {
  const symbol = Symbol('service');
  const factory = DiBag.createToken(symbol);
  expect(Object.keys(factory)).toContain('forService');
  expect(Object.keys(factory)).toContain('forCollectionOf');
  expect(Object.isFrozen(factory)).toBe(true);
  const service = factory.forService<number>();
  const collection = factory.forCollectionOf<number>();
  expect(service.symbol).toBe(symbol);
  expect(Object.hasOwn(service, 'key')).toBe(false);
  expect(collection.symbol).toBe(symbol);
  expect(Object.hasOwn(collection, 'key')).toBe(false);
  expect(Object.isFrozen(service)).toBe(true);
  expect(Object.isFrozen(collection)).toBe(true);
  const builder = DiBag.createBuilder();
  expect(() => Reflect.apply(builder.withTokenService, builder, [collection, () => 1])).toThrow('DI_BAG_WRONG_TOKEN_KIND');
});
