import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';
import { deferred } from './helpers';

type Diagnostic = { readonly code: string; readonly details: Readonly<Record<string, unknown>>; readonly message: string };
const thrown = (run: () => unknown): Diagnostic => {
  try { run(); } catch (error) { return error as Diagnostic; }
  throw new Error('expected a throw');
};
const turn = () => new Promise<void>(resolve => setImmediate(resolve));

test('forCollectionOf creates a frozen genuine handle next to of', () => {
  const key = Symbol('numbers');
  const factory = DiBag.token(key);
  expect(Object.keys(factory)).toEqual(['of', 'forCollectionOf']);
  expect(Object.isFrozen(factory)).toBe(true);
  const numbers = factory.forCollectionOf<number>();
  expect(numbers.key).toBe(key);
  expect(Object.isFrozen(numbers)).toBe(true);
  expect(numbers).not.toBe(factory.forCollectionOf<number>());
  for (const fake of [{ ...numbers }, Object.create(numbers), { key }]) {
    expect(thrown(() => (DiBag.createBuilder().contribute as Function)(fake, () => 1)).code).toBe('DI_BAG_INVALID_TOKEN');
  }
});

test('register rejects a collection token as the wrong kind, before it reads the provider', () => {
  const key = Symbol('numbers');
  const numbers = DiBag.token(key).forCollectionOf<number>();
  const error = thrown(() => (DiBag.createBuilder().register as Function)(numbers, 'not a provider'));
  expect(error.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
  expect(error.details).toEqual({ operation: 'register', expectedKind: 'single-service', receivedKind: 'collection' });
  expect(Object.isFrozen(error.details)).toBe(true);
  expect(error.message).toBe('DI_BAG_WRONG_TOKEN_KIND: register requires a single-service token, but Symbol(numbers) is a collection token; see https://dany-fedorov.github.io/di-bag/agent/errors.html#di-bag-wrong-token-kind');
});

test('resolve of a collection token returns a fresh frozen list in contribution order, and an empty list is valid', async () => {
  const numbersKey = Symbol('numbers');
  const numbers = DiBag.token(numbersKey).forCollectionOf<number>();
  const empty = DiBag.createBuilder().build();
  const none = empty.resolveCollection(numbers);
  expect(none).toEqual([]); expect(Object.isFrozen(none)).toBe(true);
  const bag = DiBag.createBuilder().contribute(numbers, () => 1).contribute(numbers, () => 2).build();
  const first = bag.resolveCollection(numbers);
  expect(first).toEqual([1, 2]); expect(Object.isFrozen(first)).toBe(true); expect(bag.resolveCollection(numbers)).not.toBe(first);
  await bag.close(); await empty.close();
  expect(thrown(() => bag.resolveCollection(numbers)).code).toBe('DI_BAG_CLOSED');
});

test('inspect of a collection token returns one snapshot per contribution and runs no factory', async () => {
  const itemsKey = Symbol('items');
  const items = DiBag.token(itemsKey).forCollectionOf<number>(); let calls = 0;
  const bag = DiBag.createBuilder().contribute(items, DiBag.withMetadata(() => ++calls, { static: { name: 'a' } })).contribute(items, () => ++calls).build();
  const before = bag.inspectCollection(items);
  expect(calls).toBe(0); expect(Object.isFrozen(before)).toBe(true);
  expect(before.map(snapshot => snapshot.acquisitions.length)).toEqual([0, 0]);
  expect(before[0]!.registrationMetadata).toEqual({ name: 'a' });
  bag.resolveCollection(items);
  expect(bag.inspectCollection(items).map(snapshot => snapshot.acquisitions.length)).toEqual([1, 1]);
  expect(DiBag.createBuilder().build().inspectCollection(items)).toEqual([]);
  await bag.close();
});

test('ensureServicesReady waits for every contribution of a collection token', async () => {
  const clientsKey = Symbol('clients');
  const clients = DiBag.token(clientsKey).forCollectionOf<Promise<string>>();
  const slow = deferred<string>(); const started: string[] = [];
  const bag = DiBag.createBuilder().contribute(clients, () => { started.push('fast'); return Promise.resolve('fast'); })
    .contribute(clients, () => { started.push('slow'); return slow.promise; })
    .register({ unrelated: () => { started.push('unrelated'); return 1; } }).build();
  let ready = false;
  const ensuring = bag.ensureServicesReady([clients]).then(same => { ready = true; return same; });
  await turn(); expect(started).toEqual(['fast', 'slow']); expect(ready).toBe(false);
  slow.resolve('slow'); expect(await ensuring).toBe(bag);
  expect(await Promise.all(bag.resolveCollection(clients))).toEqual(['fast', 'slow']);
  expect(started).toEqual(['fast', 'slow']); await bag.close();
});

test('each contribution keeps its own lifetime and disposer when the list is read through resolve', async () => {
  const objectsKey = Symbol('objects');
  const objects = DiBag.token(objectsKey).forCollectionOf<{ id: number }>();
  let ids = 0; const disposed: number[] = [];
  const create = DiBag.withDisposal(() => ({ id: ++ids }), value => { disposed.push(value.id); });
  const bag = DiBag.createBuilder()
    .contribute(objects, DiBag.withLifetime(create, 'root'))
    .contribute(objects, create)
    .contribute(objects, DiBag.withLifetime(create, 'transient'))
    .build();
  const first = bag.resolveCollection(objects); const again = bag.resolveCollection(objects);
  expect(first[0]).toBe(again[0]); expect(first[1]).toBe(again[1]); expect(first[2]).not.toBe(again[2]);
  const child = bag.createScope(); const scoped = child.resolveCollection(objects);
  expect(scoped[0]).toBe(first[0]); expect(scoped[1]).not.toBe(first[1]);
  await child.close(); await bag.close();
  expect(disposed.length).toBe(ids); expect(new Set(disposed).size).toBe(ids);
});

test('ensureServicesReady accepts a collection token nothing contributes to, and closes the bag when a contribution fails', async () => {
  const hooksKey = Symbol('hooks');
  const hooks = DiBag.token(hooksKey).forCollectionOf<number>();
  const empty = DiBag.createBuilder().build();
  expect(await empty.ensureServicesReady([hooks])).toBe(empty); await empty.close();
  const disposed: number[] = [];
  const failing = DiBag.createBuilder()
    .contribute(hooks, DiBag.withDisposal(() => 1, value => { disposed.push(value); }))
    .contribute(hooks, () => { throw new Error('failed contribution'); }).build();
  await expect(failing.ensureServicesReady([hooks])).rejects.toThrow();
  expect(disposed).toEqual([1]); expect(thrown(() => failing.resolveCollection(hooks)).code).toBe('DI_BAG_CLOSED');
});

test('a dependency list accepts a collection token, lazy supplies a getter, and optional is the wrong kind', async () => {
  const numbersKey = Symbol('numbers');
  const numbers = DiBag.token(numbersKey).forCollectionOf<number>();
  class Total { constructor(readonly values: readonly number[]) {} }
  const plugin: unknown = { apiVersion: 1, create: (values: readonly number[]) => values.length };
  const bag = DiBag.createBuilder().contribute(numbers, () => 3).contribute(numbers, () => 4).register({
    sum: DiBag.fromFunction([numbers], values => values.reduce((total, value) => total + value, 0)),
    total: DiBag.fromClass([numbers], Total),
    count: DiBag.fromPlugin([numbers], plugin, { acquisitionMode: 'raw', validate: (value): value is number => typeof value === 'number' }),
    later: DiBag.fromFunction([DiBag.lazy(numbers)], getNumbers => getNumbers),
  }).build();
  expect(bag.resolve('sum')).toBe(7); expect(bag.resolve('total').values).toEqual([3, 4]);
  expect(Object.isFrozen(bag.resolve('total').values)).toBe(true); expect(bag.resolve('count')).toBe(2);
  const getNumbers = bag.resolve('later'); expect(getNumbers()).toEqual([3, 4]); expect(getNumbers()).not.toBe(getNumbers());
  const graph = bag.inspectGraph();
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
  const hooks = DiBag.token(hooksKey).forCollectionOf<() => void>();
  const feature = DiBag.createBuilder().register({ hookCount: DiBag.fromFunction([hooks], list => list.length) }).buildModule(['hookCount']);
  const lonely = DiBag.createBuilder().installModule(feature).build();
  expect(lonely.resolve('hookCount')).toBe(0);
  const host = DiBag.createBuilder().contribute(hooks, () => () => {}).installModule(feature).build();
  expect(host.resolve('hookCount')).toBe(1);
  await lonely.close(); await host.close();
});

test('an alias gives the list a name, so a named factory reaches it', async () => {
  const controllersKey = Symbol('controllers');
  const controllers = DiBag.token(controllersKey).forCollectionOf<string>();
  const feature = DiBag.createBuilder().contribute(controllers, () => 'users').buildModule([]);
  const bag = DiBag.createBuilder().installModule(feature).contribute(controllers, () => 'orders')
    .alias('controllers', controllers)
    .register({ router: ({ controllers }: { controllers: readonly string[] }) => controllers.join(',') }).build();
  expect(bag.resolve('router')).toBe('users,orders');
  const named = bag.resolve('controllers'); expect(named).toEqual(['users', 'orders']); expect(Object.isFrozen(named)).toBe(true);
  expect(bag.resolve('controllers')).not.toBe(named); expect(bag.inspect('controllers').aliasTarget).toBeUndefined();
  await bag.close();
});

test('an alias destination rejects a collection token as the wrong kind', () => {
  const numbersKey = Symbol('numbers');
  const numbers = DiBag.token(numbersKey).forCollectionOf<number>();
  const error = thrown(() => (DiBag.createBuilder().register({ value: () => 1 }).alias as Function)(numbers, 'value'));
  expect(error.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
  expect(error.details).toEqual({ operation: 'alias', expectedKind: 'single-service', receivedKind: 'collection' });
});

test('a single-service token and a collection token never merge', async () => {
  const loggerKey = Symbol('logger');
  const sinksKey = Symbol('loggerSinks');
  const logger = DiBag.token(loggerKey).of<string>();
  const loggerSinks = DiBag.token(sinksKey).forCollectionOf<string>();
  const bag = DiBag.createBuilder().contribute(loggerSinks, () => 'console').contribute(loggerSinks, () => 'file')
    .register(logger, DiBag.fromFunction([loggerSinks], sinks => `fan-out(${sinks.join(',')})`)).build();
  expect(bag.resolve(logger)).toBe('fan-out(console,file)'); expect(bag.resolveCollection(loggerSinks)).toEqual(['console', 'file']);
  expect(bag.inspectGraph().contributions.map(group => group.token)).toEqual([loggerSinks.key]); await bag.close();
});

test('fork replaces a whole list, and the replacement wins for every reader', async () => {
  const controllersKey = Symbol('controllers');
  const controllers = DiBag.token(controllersKey).forCollectionOf<string>();
  let real = 0;
  const app = DiBag.createBuilder()
    .contribute(controllers, () => { real++; return 'users'; })
    .contribute(controllers, () => { real++; return 'orders'; })
    .alias('controllers', controllers)
    .register({
      router: ({ controllers }: { controllers: readonly string[] }) => controllers.join(','),
      count: DiBag.fromFunction([controllers], list => list.length),
      later: DiBag.fromFunction([DiBag.lazy(controllers)], getList => getList),
    }).build();
  const fake: readonly string[] = ['fake'];
  let disposed: readonly string[] | undefined;
  const replacement = DiBag.withDisposal(
    () => fake,
    value => { disposed = value; },
  );
  const testApp = app.fork(
    [controllers],
    { [controllers.key]: replacement },
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
  expect(testApp.inspectCollection(controllers).map(snapshot => snapshot.acquisitions.length)).toEqual([1]);
  expect(await testApp.ensureServicesReady([controllers])).toBe(testApp); expect(real).toBe(0);
  expect(app.resolveCollection(controllers)).toEqual(['users', 'orders']); expect(app.inspectCollection(controllers).length).toBe(2);
  const again = testApp.fork([controllers], { [controllers.key]: () => ['again'] });
  expect(again.resolveCollection(controllers)).toEqual(['again']);
  const unusedKey = Symbol('unused');
  const unused = DiBag.token(unusedKey).forCollectionOf<number>();
  const filled = app.fork([unused], { [unused.key]: () => [1, 2] });
  expect(filled.resolveCollection(unused)).toEqual([1, 2]);
  expect(thrown(() => (app.fork as Function)([controllers], {})).code).toBe('DI_BAG_INVALID_OVERRIDE');
  await again.close(); await filled.close(); await testApp.close();
  expect(disposed).toBe(fake);
  await app.close();
});

test('createScope and builder replace swap a list the same way', async () => {
  const sinksKey = Symbol('sinks');
  const sinks = DiBag.token(sinksKey).forCollectionOf<string>();
  const builder = DiBag.createBuilder().contribute(sinks, () => 'console')
    .register({ names: DiBag.fromFunction([sinks], list => list.join('+')) });
  const app = builder.build();
  const child = app.createScope([sinks], { [sinks.key]: () => ['memory'] });
  expect(child.resolveCollection(sinks)).toEqual(['memory']); expect(child.resolve('names')).toBe('memory');
  expect(app.resolve('names')).toBe('console');
  const replaced = builder.replace(sinks, () => ['file', 'syslog']).build();
  expect(replaced.resolveCollection(sinks)).toEqual(['file', 'syslog']); expect(replaced.resolve('names')).toBe('file+syslog');
  const later = builder.replace(sinks, () => ['first']).contribute(sinks, () => 'ignored').build();
  expect(later.resolveCollection(sinks)).toEqual(['first']);
  expect(thrown(() => (app.createScope as Function)([sinks], {})).code).toBe('DI_BAG_INVALID_SCOPE');
  await child.close(); await app.close(); await replaced.close(); await later.close();
});

test('share and buildModule reject a collection token as the wrong kind', async () => {
  const numbersKey = Symbol('numbers');
  const numbers = DiBag.token(numbersKey).forCollectionOf<number>();
  const builder = DiBag.createBuilder().contribute(numbers, () => 1);
  const wrong = (operation: string) => ({ operation, expectedKind: 'single-service', receivedKind: 'collection' });
  const exported = thrown(() => (builder.buildModule as Function)([numbers]));
  expect(exported.code).toBe('DI_BAG_WRONG_TOKEN_KIND'); expect(exported.details).toEqual(wrong('buildModule'));
  const bag = builder.build();
  const shared = thrown(() => (bag.createScope as Function)({ share: [numbers] }));
  expect(shared.code).toBe('DI_BAG_WRONG_TOKEN_KIND'); expect(shared.details).toEqual(wrong('createScope'));
  const replaced = bag.fork([numbers], { [numbers.key]: () => [5] });
  expect(thrown(() => (replaced.createScope as Function)({ share: [numbers] })).code).toBe('DI_BAG_WRONG_TOKEN_KIND');
  const resolved = thrown(() => (replaced.resolve as Function)(numbers));
  expect(resolved.code).toBe('DI_BAG_WRONG_TOKEN_KIND'); expect(resolved.details).toEqual(wrong('resolve'));
  const inspected = thrown(() => (replaced.inspect as Function)(numbers));
  expect(inspected.code).toBe('DI_BAG_WRONG_TOKEN_KIND'); expect(inspected.details).toEqual(wrong('inspect'));
  const serviceKey = Symbol('service');
  const service = DiBag.token(serviceKey).of<number>();
  const serviceBag = DiBag.createBuilder().register(service, () => 1).build();
  const collectionWrong = (operation: string) => ({ operation, expectedKind: 'collection', receivedKind: 'single-service' });
  const collectionResolved = thrown(() => (serviceBag.resolveCollection as Function)(service));
  expect(collectionResolved.code).toBe('DI_BAG_WRONG_TOKEN_KIND'); expect(collectionResolved.details).toEqual(collectionWrong('resolveCollection'));
  const collectionInspected = thrown(() => (serviceBag.inspectCollection as Function)(service));
  expect(collectionInspected.code).toBe('DI_BAG_WRONG_TOKEN_KIND'); expect(collectionInspected.details).toEqual(collectionWrong('inspectCollection'));
  await serviceBag.close();
  await replaced.close(); await bag.close();
});

test('one graph cannot use the same symbol for both token kinds', async () => {
  const key = Symbol('shared');
  const service = DiBag.token(key).of<number>();
  const collection = DiBag.token(key).forCollectionOf<number>();

  const registered = DiBag.createBuilder().register(service, () => 1);
  const collectionAfterService = thrown(() =>
    (registered as any).contribute(collection, () => 2),
  );
  expect(collectionAfterService.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
  expect(collectionAfterService.details).toEqual({
    operation: 'contribute',
    expectedKind: 'single-service',
    receivedKind: 'collection',
  });

  const contributed = DiBag.createBuilder().contribute(collection, () => 2);
  const serviceAfterCollection = thrown(() =>
    (contributed as any).register(service, () => 1),
  );
  expect(serviceAfterCollection.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
  expect(serviceAfterCollection.details).toEqual({
    operation: 'register',
    expectedKind: 'collection',
    receivedKind: 'single-service',
  });

  const serviceBag = DiBag.createBuilder().register(service, () => 1).build();
  const collectionBag = DiBag.createBuilder()
    .contribute(collection, () => 2)
    .build();
  expect(serviceBag.resolve(service)).toBe(1);
  expect(collectionBag.resolveCollection(collection)).toEqual([2]);
  await serviceBag.close();
  await collectionBag.close();
});

test('module installation preserves token kinds through nested sealing', () => {
  const key = Symbol('module-shared');
  const service = DiBag.token(key).of<number>();
  const collection = DiBag.token(key).forCollectionOf<number>();
  const collectionModule = DiBag.createBuilder()
    .contribute(collection, () => 2).buildModule([]);
  const nested = DiBag.createBuilder()
    .installModule(collectionModule).buildModule([]);
  for (const module of [collectionModule, nested]) {
    const host = DiBag.createBuilder().register(service, () => 1);
    const error = thrown(() => (host as any).installModule(module));
    expect(error.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
    expect(error.details).toEqual({
      operation: 'installModule', expectedKind: 'single-service', receivedKind: 'collection',
    });
  }
  const serviceModule = DiBag.createBuilder()
    .register(service, () => 1).buildModule([service]);
  const host = DiBag.createBuilder().contribute(collection, () => 2);
  const error = thrown(() => (host as any).installModule(serviceModule));
  expect(error.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
  expect(error.details).toEqual({
    operation: 'installModule', expectedKind: 'collection', receivedKind: 'single-service',
  });
});

test('contribute rejects a single-service token as the wrong kind, before it reads the provider', () => {
  const serviceKey = Symbol('service');
  const service = DiBag.token(serviceKey).of<number>();
  const error = thrown(() => (DiBag.createBuilder().contribute as Function)(service, 'not a provider'));
  expect(error.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
  expect(error.details).toEqual({ operation: 'contribute', expectedKind: 'collection', receivedKind: 'single-service' });
});
