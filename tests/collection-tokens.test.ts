import { expect, test } from 'bun:test';
import { DiBag } from '../src';
import { deferred } from './helpers';

type Diagnostic = { readonly code: string; readonly details: Readonly<Record<string, unknown>>; readonly message: string };
const thrown = (run: () => unknown): Diagnostic => {
  try { run(); } catch (error) { return error as Diagnostic; }
  throw new Error('expected a throw');
};
const turn = () => new Promise<void>(resolve => setImmediate(resolve));

test('forCollectionOf creates a frozen genuine handle next to forService', () => {
  const key = Symbol('numbers');
  const factory = DiBag.createToken(key);
  expect(Object.keys(factory)).toEqual(['forService', 'forCollectionOf']);
  expect(Object.isFrozen(factory)).toBe(true);
  const numbers = factory.forCollectionOf<number>();
  expect(numbers.symbol).toBe(key);
  expect(Object.hasOwn(numbers, 'key')).toBe(false);
  expect(Object.isFrozen(numbers)).toBe(true);
  expect(numbers).not.toBe(factory.forCollectionOf<number>());
  for (const fake of [{ ...numbers }, Object.create(numbers), { key }]) {
    expect(thrown(() => (DiBag.createBuilder().withCollectionContribution as Function)({ collectionToken: fake, provider: () => 1 })).code).toBe('DI_BAG_INVALID_TOKEN');
  }
});

test('withTokenService rejects a collection token as the wrong kind, before it reads the provider', () => {
  const key = Symbol('numbers');
  const numbers = DiBag.createToken(key).forCollectionOf<number>();
  const error = thrown(() => (DiBag.createBuilder().withTokenService as Function)(numbers, 'not a provider'));
  expect(error.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
  expect(error.details).toEqual({ operation: 'withTokenService', expectedKind: 'single-service', receivedKind: 'collection' });
  expect(Object.isFrozen(error.details)).toBe(true);
  expect(error.message).toBe('DI_BAG_WRONG_TOKEN_KIND: withTokenService requires a single-service token, but Symbol(numbers) is a collection token; see https://dany-fedorov.github.io/di-bag/agent/errors.html#di-bag-wrong-token-kind');
});

test('resolve of a collection token returns a fresh frozen list in contribution order, and an empty list is valid', async () => {
  const numbersKey = Symbol('numbers');
  const numbers = DiBag.createToken(numbersKey).forCollectionOf<number>();
  const empty = DiBag.createBuilder().buildContainer();
  const none = empty.resolveCollection(numbers);
  expect(none).toEqual([]); expect(Object.isFrozen(none)).toBe(true);
  const bag = DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: () => 1 }).withCollectionContribution({ collectionToken: numbers, provider: () => 2 }).buildContainer();
  const first = bag.resolveCollection(numbers);
  expect(first).toEqual([1, 2]); expect(Object.isFrozen(first)).toBe(true); expect(bag.resolveCollection(numbers)).not.toBe(first);
  await bag.close(); await empty.close();
  expect(thrown(() => bag.resolveCollection(numbers)).code).toBe('DI_BAG_CLOSED');
});

test('inspect of a collection token returns one snapshot per contribution and runs no factory', async () => {
  const itemsKey = Symbol('items');
  const items = DiBag.createToken(itemsKey).forCollectionOf<number>(); let calls = 0;
  const bag = DiBag.createBuilder().withCollectionContribution({ collectionToken: items, provider: DiBag.withMetadata(() => ++calls, { static: { name: 'a' } }) }).withCollectionContribution({ collectionToken: items, provider: () => ++calls }).buildContainer();
  const before = bag.serviceSnapshot(items);
  expect(calls).toBe(0); expect(Object.isFrozen(before)).toBe(true);
  expect(before.map(snapshot => snapshot.acquisitions.length)).toEqual([0, 0]);
  expect(before[0]!.registrationMetadata).toEqual({ name: 'a' });
  bag.resolveCollection(items);
  expect(bag.serviceSnapshot(items).map(snapshot => snapshot.acquisitions.length)).toEqual([1, 1]);
  expect(DiBag.createBuilder().buildContainer().serviceSnapshot(items)).toEqual([]);
  await bag.close();
});

test('ensureServicesReady waits for every contribution of a collection token', async () => {
  const clientsKey = Symbol('clients');
  const clients = DiBag.createToken(clientsKey).forCollectionOf<Promise<string>>();
  const slow = deferred<string>(); const started: string[] = [];
  const bag = DiBag.createBuilder().withCollectionContribution({ collectionToken: clients, provider: () => { started.push('fast'); return Promise.resolve('fast'); } })
    .withCollectionContribution({ collectionToken: clients, provider: () => { started.push('slow'); return slow.promise; } })
    .withServices({ unrelated: () => { started.push('unrelated'); return 1; } }).buildContainer();
  let ready = false;
  const ensuring = bag.ensureServicesReady([clients]).then(same => { ready = true; return same; });
  await turn(); expect(started).toEqual(['fast', 'slow']); expect(ready).toBe(false);
  slow.resolve('slow'); expect(await ensuring).toBe(bag);
  expect(await Promise.all(bag.resolveCollection(clients))).toEqual(['fast', 'slow']);
  expect(started).toEqual(['fast', 'slow']); await bag.close();
});

test('each contribution keeps its own lifetime and disposer when the list is read through resolve', async () => {
  const objectsKey = Symbol('objects');
  const objects = DiBag.createToken(objectsKey).forCollectionOf<{ id: number }>();
  let ids = 0; const disposed: number[] = [];
  const create = DiBag.withDisposal(() => ({ id: ++ids }), value => { disposed.push(value.id); });
  const bag = DiBag.createBuilder()
    .withCollectionContribution({ collectionToken: objects, provider: DiBag.withLifetime(create, 'root') })
    .withCollectionContribution({ collectionToken: objects, provider: create })
    .withCollectionContribution({ collectionToken: objects, provider: DiBag.withLifetime(create, 'transient') })
    .buildContainer();
  const first = bag.resolveCollection(objects); const again = bag.resolveCollection(objects);
  expect(first[0]).toBe(again[0]); expect(first[1]).toBe(again[1]); expect(first[2]).not.toBe(again[2]);
  const child = bag.createChildContainer(); const scoped = child.resolveCollection(objects);
  expect(scoped[0]).toBe(first[0]); expect(scoped[1]).not.toBe(first[1]);
  await child.close(); await bag.close();
  expect(disposed.length).toBe(ids); expect(new Set(disposed).size).toBe(ids);
});

test('ensureServicesReady accepts a collection token nothing contributes to, and closes the bag when a contribution fails', async () => {
  const hooksKey = Symbol('hooks');
  const hooks = DiBag.createToken(hooksKey).forCollectionOf<number>();
  const empty = DiBag.createBuilder().buildContainer();
  expect(await empty.ensureServicesReady([hooks])).toBe(empty); await empty.close();
  const disposed: number[] = [];
  const failing = DiBag.createBuilder()
    .withCollectionContribution({ collectionToken: hooks, provider: DiBag.withDisposal(() => 1, value => { disposed.push(value); }) })
    .withCollectionContribution({ collectionToken: hooks, provider: () => { throw new Error('failed contribution'); } }).buildContainer();
  await expect(failing.ensureServicesReady([hooks])).rejects.toThrow();
  expect(disposed).toEqual([1]); expect(thrown(() => failing.resolveCollection(hooks)).code).toBe('DI_BAG_CLOSED');
});

test('a dependency list accepts a collection token, lazy supplies a getter, and optional is the wrong kind', async () => {
  const numbersKey = Symbol('numbers');
  const numbers = DiBag.createToken(numbersKey).forCollectionOf<number>();
  class Total { constructor(readonly values: readonly number[]) {} }
  const plugin: unknown = { apiVersion: 1, create: (values: readonly number[]) => values.length };
  const bag = DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: () => 3 }).withCollectionContribution({ collectionToken: numbers, provider: () => 4 }).withServices({
    sum: DiBag.createProviderFromFunction({ dependencies: [numbers], factoryFunction: values => values.reduce((total, value) => total + value, 0) }),
    total: DiBag.createProviderFromClass({ dependencies: [numbers], serviceClass: Total }),
    count: DiBag.createProviderFromPlugin({ dependencies: [numbers], pluginDescriptor: plugin, factoryReturnKind: 'uninspected', isValidPluginOutput: (value): value is number => typeof value === 'number' }),
    later: DiBag.createProviderFromFunction({ dependencies: [DiBag.lazy(numbers)], factoryFunction: getNumbers => getNumbers }),
  }).buildContainer();
  expect(bag.resolve('sum')).toBe(7); expect(bag.resolve('total').values).toEqual([3, 4]);
  expect(Object.isFrozen(bag.resolve('total').values)).toBe(true); expect(bag.resolve('count')).toBe(2);
  const getNumbers = bag.resolve('later'); expect(getNumbers()).toEqual([3, 4]); expect(getNumbers()).not.toBe(getNumbers());
  const graph = bag.graphSnapshot();
  const kinds = (label: string) => graph.bindings.find(binding => binding.label === label)!.tokenDependencies.map(dependency => dependency.kind);
  expect(kinds('sum')).toEqual(['required']); expect(kinds('later')).toEqual(['lazy']);
  const error = thrown(() => (DiBag.optional as Function)(numbers));
  expect(error.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
  expect(error.details).toEqual({ operation: 'optional', expectedKind: 'single-service', receivedKind: 'collection' });
  expect(error.message).toContain('optional requires a single-service token'); expect(error.message).toContain('#di-bag-wrong-token-kind');
  await bag.close();
});

test('a consumer of an empty collection receives an empty list, also inside a module', async () => {
  const hooksKey = Symbol('hooks');
  const hooks = DiBag.createToken(hooksKey).forCollectionOf<() => void>();
  const feature = DiBag.createBuilder().withServices({ hookCount: DiBag.createProviderFromFunction({ dependencies: [hooks], factoryFunction: list => list.length }) }).buildModule({ exportedServiceKeys: ['hookCount'] });
  const lonely = DiBag.createBuilder().withInstalledModules([feature]).buildContainer();
  expect(lonely.resolve('hookCount')).toBe(0);
  const host = DiBag.createBuilder().withCollectionContribution({ collectionToken: hooks, provider: () => () => {} }).withInstalledModules([feature]).buildContainer();
  expect(host.resolve('hookCount')).toBe(1);
  await lonely.close(); await host.close();
});

test('an alias gives the list a name, so a named factory reaches it', async () => {
  const controllersKey = Symbol('controllers');
  const controllers = DiBag.createToken(controllersKey).forCollectionOf<string>();
  const feature = DiBag.createBuilder().withCollectionContribution({ collectionToken: controllers, provider: () => 'users' }).buildModule({ exportedServiceKeys: [] });
  const bag = DiBag.createBuilder().withInstalledModules([feature]).withCollectionContribution({ collectionToken: controllers, provider: () => 'orders' })
    .withServiceAlias({ aliasKey: 'controllers', targetServiceKey: controllers })
    .withServices({ router: ({ controllers }: { controllers: readonly string[] }) => controllers.join(',') }).buildContainer();
  expect(bag.resolve('router')).toBe('users,orders');
  const named = bag.resolve('controllers'); expect(named).toEqual(['users', 'orders']); expect(Object.isFrozen(named)).toBe(true);
  expect(bag.resolve('controllers')).not.toBe(named); expect(bag.serviceSnapshot('controllers').aliasTarget).toBeUndefined();
  await bag.close();
});

test('an alias destination rejects a collection token as the wrong kind', () => {
  const numbersKey = Symbol('numbers');
  const numbers = DiBag.createToken(numbersKey).forCollectionOf<number>();
  const error = thrown(() => (DiBag.createBuilder().withServices({ value: () => 1 }).withServiceAlias as Function)({ aliasKey: numbers, targetServiceKey: 'value' }));
  expect(error.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
  expect(error.details).toEqual({ operation: 'withServiceAlias', expectedKind: 'single-service', receivedKind: 'collection' });
});

test('a single-service token and a collection token never merge', async () => {
  const loggerKey = Symbol('logger');
  const sinksKey = Symbol('loggerSinks');
  const logger = DiBag.createToken(loggerKey).forService<string>();
  const loggerSinks = DiBag.createToken(sinksKey).forCollectionOf<string>();
  const bag = DiBag.createBuilder().withCollectionContribution({ collectionToken: loggerSinks, provider: () => 'console' }).withCollectionContribution({ collectionToken: loggerSinks, provider: () => 'file' })
    .withTokenService(logger, DiBag.createProviderFromFunction({ dependencies: [loggerSinks], factoryFunction: sinks => `fan-out(${sinks.join(',')})` })).buildContainer();
  expect(bag.resolve(logger)).toBe('fan-out(console,file)'); expect(bag.resolveCollection(loggerSinks)).toEqual(['console', 'file']);
  expect(bag.graphSnapshot().contributions.map(group => group.token)).toEqual([loggerSinks.symbol]); await bag.close();
});

test('fork replaces a whole list, and the replacement wins for every reader', async () => {
  const controllersKey = Symbol('controllers');
  const controllers = DiBag.createToken(controllersKey).forCollectionOf<string>();
  let real = 0;
  const app = DiBag.createBuilder()
    .withCollectionContribution({ collectionToken: controllers, provider: () => { real++; return 'users'; } })
    .withCollectionContribution({ collectionToken: controllers, provider: () => { real++; return 'orders'; } })
    .withServiceAlias({ aliasKey: 'controllers', targetServiceKey: controllers })
    .withServices({
      router: ({ controllers }: { controllers: readonly string[] }) => controllers.join(','),
      count: DiBag.createProviderFromFunction({ dependencies: [controllers], factoryFunction: list => list.length }),
      later: DiBag.createProviderFromFunction({ dependencies: [DiBag.lazy(controllers)], factoryFunction: getList => getList }),
    }).buildContainer();
  const fake: readonly string[] = ['fake'];
  let disposed: readonly string[] | undefined;
  const replacement = DiBag.withDisposal(
    () => fake,
    value => { disposed = value; },
  );
  const testApp = app.createIndependentContainer(
    [controllers],
    { [controllers.symbol]: replacement },
  );
  const direct = testApp.resolveCollection(controllers);
  const lazy = testApp.resolve('later')();
  const named = testApp.resolve('controllers');
  expect(direct).toEqual(fake); expect(direct).not.toBe(fake);
  expect(Object.isFrozen(direct)).toBe(true);
  expect(lazy).toEqual(fake); expect(lazy).not.toBe(direct);
  expect(named).toEqual(fake); expect(named).not.toBe(lazy);
  expect(Object.isFrozen(named)).toBe(true);
  expect(testApp.resolve('router')).toBe('fake');
  expect(testApp.resolve('count')).toBe(1);
  expect(testApp.serviceSnapshot(controllers).map(snapshot => snapshot.acquisitions.length)).toEqual([1]);
  expect(await testApp.ensureServicesReady([controllers])).toBe(testApp); expect(real).toBe(0);
  expect(app.resolveCollection(controllers)).toEqual(['users', 'orders']); expect(app.serviceSnapshot(controllers).length).toBe(2);
  const again = testApp.createIndependentContainer([controllers], { [controllers.symbol]: () => ['again'] });
  expect(again.resolveCollection(controllers)).toEqual(['again']);
  const unusedKey = Symbol('unused');
  const unused = DiBag.createToken(unusedKey).forCollectionOf<number>();
  const filled = app.createIndependentContainer([unused], { [unused.symbol]: () => [1, 2] });
  expect(filled.resolveCollection(unused)).toEqual([1, 2]);
  expect(thrown(() => (app.createIndependentContainer as Function)([controllers], {})).code).toBe('DI_BAG_INVALID_OVERRIDE');
  await again.close(); await filled.close(); await testApp.close();
  expect(disposed).toBe(fake);
  await app.close();
});

test('createScope and builder replace swap a list the same way', async () => {
  const sinksKey = Symbol('sinks');
  const sinks = DiBag.createToken(sinksKey).forCollectionOf<string>();
  const builder = DiBag.createBuilder().withCollectionContribution({ collectionToken: sinks, provider: () => 'console' })
    .withServices({ names: DiBag.createProviderFromFunction({ dependencies: [sinks], factoryFunction: list => list.join('+') }) });
  const app = builder.buildContainer();
  const child = app.createChildContainer([sinks], { [sinks.symbol]: () => ['memory'] });
  expect(child.resolveCollection(sinks)).toEqual(['memory']); expect(child.resolve('names')).toBe('memory');
  expect(app.resolve('names')).toBe('console');
  const replaced = builder.withReplacedService(sinks, () => ['file', 'syslog']).buildContainer();
  expect(replaced.resolveCollection(sinks)).toEqual(['file', 'syslog']); expect(replaced.resolve('names')).toBe('file+syslog');
  const later = builder.withReplacedService(sinks, () => ['first']).withCollectionContribution({ collectionToken: sinks, provider: () => 'ignored' }).buildContainer();
  expect(later.resolveCollection(sinks)).toEqual(['first']);
  expect(thrown(() => (app.createChildContainer as Function)([sinks], {})).code).toBe('DI_BAG_INVALID_OVERRIDE');
  await child.close(); await app.close(); await replaced.close(); await later.close();
});

test('share and buildModule reject a collection token as the wrong kind', async () => {
  const numbersKey = Symbol('numbers');
  const numbers = DiBag.createToken(numbersKey).forCollectionOf<number>();
  const builder = DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: () => 1 });
  const wrong = (operation: string) => ({ operation, expectedKind: 'single-service', receivedKind: 'collection' });
  const exported = thrown(() => (builder.buildModule as Function)({ exportedServiceKeys: [numbers] }));
  expect(exported.code).toBe('DI_BAG_WRONG_TOKEN_KIND'); expect(exported.details).toEqual(wrong('buildModule'));
  const bag = builder.buildContainer();
  const shared = thrown(() => (bag.createChildContainer as Function)({ sharedParentServiceKeys: [numbers] }));
  expect(shared.code).toBe('DI_BAG_WRONG_TOKEN_KIND'); expect(shared.details).toEqual(wrong('createChildContainer'));
  const replaced = bag.createIndependentContainer([numbers], { [numbers.symbol]: () => [5] });
  expect(thrown(() => (replaced.createChildContainer as Function)({ sharedParentServiceKeys: [numbers] })).code).toBe('DI_BAG_WRONG_TOKEN_KIND');
  const resolved = thrown(() => (replaced.resolve as Function)(numbers));
  expect(resolved.code).toBe('DI_BAG_WRONG_TOKEN_KIND'); expect(resolved.details).toEqual(wrong('resolve'));
  const inspected = replaced.serviceSnapshot(numbers);
  expect(inspected).toHaveLength(1); expect(inspected[0]!.acquisitions).toEqual([]);
  const serviceKey = Symbol('service');
  const service = DiBag.createToken(serviceKey).forService<number>();
  const serviceBag = DiBag.createBuilder().withTokenService(service, () => 1).buildContainer();
  const collectionWrong = (operation: string) => ({ operation, expectedKind: 'collection', receivedKind: 'single-service' });
  const collectionResolved = thrown(() => (serviceBag.resolveCollection as Function)(service));
  expect(collectionResolved.code).toBe('DI_BAG_WRONG_TOKEN_KIND'); expect(collectionResolved.details).toEqual(collectionWrong('resolveCollection'));
  const collectionInspected = serviceBag.serviceSnapshot(service);
  expect(collectionInspected.acquisitions).toEqual([]);
  const forgedService = DiBag.createToken(numbersKey).forService<number>();
  const forgedCollection = DiBag.createToken(serviceKey).forCollectionOf<number>();
  const forgedServiceInspected = thrown(() => (replaced.serviceSnapshot as Function)(forgedService));
  expect(forgedServiceInspected.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
  expect(forgedServiceInspected.details).toEqual(collectionWrong('serviceSnapshot'));
  const forgedCollectionInspected = thrown(() => (serviceBag.serviceSnapshot as Function)(forgedCollection));
  expect(forgedCollectionInspected.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
  expect(forgedCollectionInspected.details).toEqual(wrong('serviceSnapshot'));
  await serviceBag.close();
  await replaced.close(); await bag.close();
});

test('one graph cannot use the same symbol for both token kinds', async () => {
  const key = Symbol('shared');
  const service = DiBag.createToken(key).forService<number>();
  const collection = DiBag.createToken(key).forCollectionOf<number>();

  const registered = DiBag.createBuilder().withTokenService(service, () => 1);
  const collectionAfterService = thrown(() =>
    (registered as any).withCollectionContribution({ collectionToken: collection, provider: () => 2 }),
  );
  expect(collectionAfterService.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
  expect(collectionAfterService.details).toEqual({
    operation: 'withCollectionContribution',
    expectedKind: 'single-service',
    receivedKind: 'collection',
  });

  const contributed = DiBag.createBuilder().withCollectionContribution({ collectionToken: collection, provider: () => 2 });
  const serviceAfterCollection = thrown(() =>
    (contributed as any).withTokenService(service, () => 1),
  );
  expect(serviceAfterCollection.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
  expect(serviceAfterCollection.details).toEqual({
    operation: 'withTokenService',
    expectedKind: 'collection',
    receivedKind: 'single-service',
  });

  const serviceBag = DiBag.createBuilder().withTokenService(service, () => 1).buildContainer();
  const collectionBag = DiBag.createBuilder()
    .withCollectionContribution({ collectionToken: collection, provider: () => 2 })
    .buildContainer();
  expect(serviceBag.resolve(service)).toBe(1);
  expect(collectionBag.resolveCollection(collection)).toEqual([2]);
  await serviceBag.close();
  await collectionBag.close();
});

test('module installation preserves token kinds through nested sealing', () => {
  const key = Symbol('module-shared');
  const service = DiBag.createToken(key).forService<number>();
  const collection = DiBag.createToken(key).forCollectionOf<number>();
  const collectionModule = DiBag.createBuilder()
    .withCollectionContribution({ collectionToken: collection, provider: () => 2 }).buildModule({ exportedServiceKeys: [] });
  const nested = DiBag.createBuilder()
    .withInstalledModules([collectionModule]).buildModule({ exportedServiceKeys: [] });
  for (const module of [collectionModule, nested]) {
    const host = DiBag.createBuilder().withTokenService(service, () => 1);
    const error = thrown(() => (host as any).withInstalledModules([module]));
    expect(error.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
    expect(error.details).toEqual({
      operation: 'withInstalledModules', expectedKind: 'single-service', receivedKind: 'collection',
    });
  }
  const serviceModule = DiBag.createBuilder()
    .withTokenService(service, () => 1).buildModule({ exportedServiceKeys: [service] });
  const host = DiBag.createBuilder().withCollectionContribution({ collectionToken: collection, provider: () => 2 });
  const error = thrown(() => (host as any).withInstalledModules([serviceModule]));
  expect(error.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
  expect(error.details).toEqual({
    operation: 'withInstalledModules', expectedKind: 'collection', receivedKind: 'single-service',
  });
});

test('withCollectionContribution rejects a single-service token as the wrong kind, before it reads the provider', () => {
  const serviceKey = Symbol('service');
  const service = DiBag.createToken(serviceKey).forService<number>();
  const error = thrown(() => (DiBag.createBuilder().withCollectionContribution as Function)({ collectionToken: service, provider: 'not a provider' }));
  expect(error.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
  expect(error.details).toEqual({ operation: 'withCollectionContribution', expectedKind: 'collection', receivedKind: 'single-service' });
});
