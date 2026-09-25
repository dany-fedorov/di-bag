// tests/builder-renames.test.ts
// Runtime behavior of the 0.5.0 builder methods: the options bags, the module list, and the renamed terminals.
import { expect, test } from 'bun:test';
import { DiBag } from '../src';

type Clock = { now(): number };
type Failure = Error & { code?: string; details?: Record<string, unknown> };
const clockKey = Symbol('clock');
const clock = DiBag.createToken(clockKey).forService<Clock>();
const toolsKey = Symbol('tools');
const tools = DiBag.createToken(toolsKey).forCollectionOf<string>();
const toolKey = Symbol('tool');
const tool = DiBag.createToken(toolKey).forService<string>();

function caught(run: () => unknown): Failure {
  try { run(); } catch (error) { return error as Failure; }
  throw new Error('expected the call to throw');
}
// The malformed calls below do not type-check on purpose; `loose` reaches the runtime validation.
const loose = (builder: object) => builder as Record<string, (...args: unknown[]) => any>;

test('the renamed builder methods build the same graph as their 0.4.0 forms', async () => {
  const app = DiBag.createBuilder()
    .withServices({ config: () => ({ url: 'memory:' }) })
    .withTokenService(clock, (): Clock => ({ now: () => 1 }))
    .withServiceAlias({ aliasKey: 'now', targetServiceKey: clock })
    .withCollectionContribution({ collectionToken: tools, provider: () => 'search' })
    .withCollectionContribution({ collectionToken: tools, provider: () => 'fetch' })
    .withReplacedService('config', () => ({ url: 'replaced:' }))
    .withReplacedService(clock, (): Clock => ({ now: () => 2 }))
    .buildContainer();
  expect(app.resolve('config')).toEqual({ url: 'replaced:' });
  expect(app.resolve(clock).now()).toBe(2);
  expect(app.resolve('now')).toBe(app.resolve(clock));
  expect(app.resolveCollection(tools)).toEqual(['search', 'fetch']);
  await app.close();
});

test('withReplacedService preserves fresh frozen collection read views', async () => {
  const owned: readonly string[] = ['file', 'syslog'];
  const app = DiBag.createBuilder()
    .withCollectionContribution({ collectionToken: tools, provider: () => 'ignored' })
    .withServices({ joined: DiBag.createProviderFromFunction({ dependencies: [tools], factoryFunction: (list: readonly string[]) => list.join('+') }) })
    .withReplacedService(tools, () => owned)
    .buildContainer();
  const first = app.resolveCollection(tools);
  const second = app.resolveCollection(tools);
  expect(first).toEqual(owned);
  expect(first).not.toBe(owned);
  expect(Object.isFrozen(first)).toBe(true);
  expect(second).not.toBe(first);
  expect(app.resolve('joined')).toBe('file+syslog');
  await app.close();
});

test('every builder method returns a new builder and leaves the receiver unchanged', async () => {
  const base = DiBag.createBuilder().withServices({ value: () => 1 });
  const extended = base.withServices({ other: () => 2 });
  expect(extended).not.toBe(base);
  const app = base.buildContainer();
  expect(() => loose(app).resolve!('other')).toThrow("DI_BAG_UNKNOWN_SERVICE_KEY");
  expect(base.verifyGraphAtCompileTime()).toBeUndefined();
  await app.close();
});

test('portable builder callables share prototype functions and preserve a borrowed receiver', async () => {
  const first = DiBag.createBuilder().withServices({ firstOnly: () => 1 });
  const second = DiBag.createBuilder().withServices({ secondOnly: () => 2 });
  for (const operation of ['withServices', 'withTokenService', 'withServiceAlias', 'withReplacedService', 'withInstalledModules', 'buildModule'] as const) {
    expect(first[operation]).toBe(second[operation]);
  }
  const borrowed = loose(first).withServices!;
  const extended = borrowed.call(second, { added: () => 3 });
  const app = extended.buildContainer();
  expect(app.resolve('secondOnly')).toBe(2);
  expect(app.resolve('added')).toBe(3);
  expect(() => app.resolve('firstOnly')).toThrow('DI_BAG_UNKNOWN_SERVICE_KEY');
  await app.close();
});

test('a two-input builder method rejects a malformed options bag before it reads a value', () => {
  const builder = DiBag.createBuilder().withServices({ value: () => 1 });
  const cases: readonly [string, readonly string[]][] = [
    ['withServiceAlias', ['aliasKey', 'targetServiceKey']],
    ['withCollectionContribution', ['collectionToken', 'provider']],
  ];
  for (const [operation, [first, second]] of cases) {
    const call = (options: unknown) => caught(() => loose(builder)[operation]!(options));
    for (const options of [undefined, null, 42, 'text', [], () => 1]) {
      const error = call(options);
      expect(error.code).toBe('DI_BAG_INVALID_ARGUMENT');
      expect(error.details).toEqual({ operation, argument: 'options', expected: 'an object' });
      expect(error.message).toBe(`DI_BAG_INVALID_ARGUMENT: ${operation} requires one options object; see https://dany-fedorov.github.io/di-bag/agent/errors.html#di-bag-invalid-argument`);
    }
    const onlyOwn = { operation, argument: 'options', expected: `only the own properties: ${first}, ${second}` };
    let reads = 0;
    const unknownOption = { get [first!]() { reads++; return clock; }, [second!]: () => 1, extra: true };
    expect(call(unknownOption).details).toEqual(onlyOwn);
    expect(call({ [first!]: clock, [second!]: () => 1, [Symbol('hidden')]: true }).details).toEqual(onlyOwn);
    expect(call(Object.create({ [first!]: clock, [second!]: () => 1 })).details).toEqual(onlyOwn);
    expect(call({ [first!]: clock }).details).toEqual({ operation, argument: second, expected: 'present' });
    expect(call({ [second!]: () => 1 }).details).toEqual({ operation, argument: first, expected: 'present' });
    expect(reads).toBe(0);
  }
});

test('a retained options bag is read once, so an accessor cannot change the call after validation', async () => {
  let reads = 0;
  const options = { collectionToken: tools, get provider() { reads++; return reads === 1 ? () => 'search' : 42; } };
  const app = loose(DiBag.createBuilder()).withCollectionContribution!(options).buildContainer();
  expect(reads).toBe(1);
  expect(app.resolveCollection(tools)).toEqual(['search']);
  await app.close();
});

test('renamed methods preserve the collection-token kind boundary before reading later properties', () => {
  const singleKey = Symbol('single');
  const collectionKey = Symbol('collection');
  const single = DiBag.createToken(singleKey).forService<number>();
  const collection = DiBag.createToken(collectionKey).forCollectionOf<number>();
  let laterReads = 0;
  const cases: readonly [() => unknown, string, 'single-service' | 'collection', 'single-service' | 'collection', string][] = [
    [
      () => loose(DiBag.createBuilder()).withTokenService!(collection, () => []),
      'withTokenService', 'single-service', 'collection', 'Symbol(collection)',
    ],
    [
      () => loose(DiBag.createBuilder()).withCollectionContribution!({ collectionToken: single, get provider() { laterReads++; return () => 1; } }),
      'withCollectionContribution', 'collection', 'single-service', 'Symbol(single)',
    ],
    [
      () => loose(DiBag.createBuilder()).withServiceAlias!({ aliasKey: collection, get targetServiceKey() { laterReads++; return 'missing'; } }),
      'withServiceAlias', 'single-service', 'collection', 'Symbol(collection)',
    ],
  ];
  for (const [run, operation, expectedKind, receivedKind, key] of cases) {
    const error = caught(run);
    expect(error.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
    expect(error.details).toEqual({ operation, expectedKind, receivedKind });
    expect(error.message).toBe(`DI_BAG_WRONG_TOKEN_KIND: ${operation} requires a ${expectedKind} token, but ${key} is a ${receivedKind} token; see https://dany-fedorov.github.io/di-bag/agent/errors.html#di-bag-wrong-token-kind`);
  }
  expect(laterReads).toBe(0);
});

test('the bag methods report distinct codes under their own operation names', () => {
  const builder = DiBag.createBuilder()
    .withServices({ value: () => 1 })
    .withTokenService(clock, (): Clock => ({ now: () => 1 }));
  const checks: readonly [() => unknown, string, Record<string, unknown>][] = [
    [() => loose(builder).withServices!({ value: () => 2 }), 'DI_BAG_DUPLICATE_SERVICE_KEY', { operation: 'withServices', serviceKey: 'value' }],
    [() => loose(builder).withServices!(42), 'DI_BAG_INVALID_ARGUMENT', { operation: 'withServices', argument: 'services', expected: 'an object' }],
    [() => loose(builder).withTokenService!(clock, () => ({ now: () => 2 })), 'DI_BAG_DUPLICATE_SERVICE_KEY', { operation: 'withTokenService', serviceKey: clockKey }],
    [() => loose(builder).withServiceAlias!({ aliasKey: 'value', targetServiceKey: clock }), 'DI_BAG_DUPLICATE_SERVICE_KEY', { operation: 'withServiceAlias', serviceKey: 'value' }],
    [() => loose(builder).withServiceAlias!({ aliasKey: 'other', targetServiceKey: 'absent' }), 'DI_BAG_UNKNOWN_SERVICE_KEY', { operation: 'withServiceAlias', serviceKey: 'absent' }],
    [() => loose(builder).withReplacedService!('absent', () => 1), 'DI_BAG_UNKNOWN_SERVICE_KEY', { operation: 'withReplacedService', serviceKey: 'absent' }],
    [() => loose(DiBag.createBuilder()).withTokenService!(clock, 42), 'DI_BAG_INVALID_PROVIDER', { operation: 'withTokenService' }],
    [() => loose(DiBag.createBuilder()).withCollectionContribution!({ collectionToken: tools, provider: 42 }), 'DI_BAG_INVALID_PROVIDER', { operation: 'withCollectionContribution' }],
    [() => loose(builder).withReplacedService!('value', 42), 'DI_BAG_INVALID_PROVIDER', { operation: 'withReplacedService' }],
  ];
  for (const [run, code, details] of checks) {
    const error = caught(run);
    expect(error.code).toBe(code);
    expect(error.details).toEqual(details);
  }
  expect(caught(() => loose(builder).withServiceAlias!({ aliasKey: 'other', targetServiceKey: 'absent' })).message).toContain('withServiceAlias requires an existing named target');
  expect(caught(() => loose(builder).withReplacedService!('absent', () => 1)).message).toContain('withReplacedService accepts existing names or typed tokens only: absent');
  expect(caught(() => loose(builder).withTokenService!({ key: clockKey }, () => 1)).code).toBe('DI_BAG_INVALID_TOKEN');
});

test('withInstalledModules installs in list order, and contributions follow that order', async () => {
  const first = DiBag.createBuilder()
    .withServices({ firstName: () => 'first' })
    .withCollectionContribution({ collectionToken: tools, provider: () => 'first' })
    .buildModule({ exportedServiceKeys: [] as const, moduleLabel: 'first' });
  const second = DiBag.createBuilder()
    .withServices({ secondName: () => 'second' })
    .withCollectionContribution({ collectionToken: tools, provider: () => 'second' })
    .buildModule({ exportedServiceKeys: [] as const, moduleLabel: 'second' });
  const third = DiBag.createBuilder()
    .withServices({ thirdName: () => 'third' })
    .withCollectionContribution({ collectionToken: tools, provider: () => 'third' })
    .buildModule({ exportedServiceKeys: [] as const, moduleLabel: 'third' });
  const listed = DiBag.createBuilder().withInstalledModules([first, second, third]).buildContainer();
  const reversed = DiBag.createBuilder().withInstalledModules([third, second, first]).buildContainer();
  const separate = DiBag.createBuilder().withInstalledModules([first]).withInstalledModules([second]).withInstalledModules([third]).buildContainer();
  expect(listed.resolveCollection(tools)).toEqual(['first', 'second', 'third']);
  expect(reversed.resolveCollection(tools)).toEqual(['third', 'second', 'first']);
  expect(separate.resolveCollection(tools)).toEqual(['first', 'second', 'third']);
  for (const graph of [listed, separate]) {
    const labels = graph.graphSnapshot().bindings.map(binding => binding.label);
    expect(labels.slice(0, 3)).toEqual([
      'first/contribution:Symbol(tools)',
      'second/contribution:Symbol(tools)',
      'third/contribution:Symbol(tools)',
    ]);
    expect(labels.slice(3).sort()).toEqual(['first/firstName', 'second/secondName', 'third/thirdName']);
  }
  await Promise.all([listed.close(), reversed.close(), separate.close()]);
});

test('a module of the list may require what a later module or the host provides', async () => {
  const consumer = DiBag.createBuilder()
    .withServices({ report: ({ logger, name }: { logger: (line: string) => string; name: string }) => logger(name) })
    .buildModule({ exportedServiceKeys: ['report'], moduleLabel: 'consumer' });
  const logging = DiBag.createBuilder()
    .withServices({ prefix: () => '[log] ', logger: ({ prefix }: { prefix: string }) => (line: string) => prefix + line })
    .buildModule({ exportedServiceKeys: ['logger'] });
  const app = DiBag.createBuilder().withInstalledModules([consumer, logging]).withServices({ name: () => 'Ada' }).buildContainer();
  expect(app.resolve('report')).toBe('[log] Ada');
  expect(DiBag.createBuilder().withInstalledModules([]).buildContainer().graphSnapshot().bindings).toEqual([]);
  await app.close();
});

test('withInstalledModules rejects a bad list as a whole and names the bad element', () => {
  const logging = DiBag.createBuilder().withServices({ logger: () => 1 }).buildModule({ exportedServiceKeys: ['logger'] });
  const other = DiBag.createBuilder().withServices({ other: () => 2 }).buildModule({ exportedServiceKeys: ['other'] });
  const host = DiBag.createBuilder().withServices({ taken: () => 0 });
  const install = (modules: unknown) => caught(() => loose(host).withInstalledModules!(modules));

  for (const modules of [undefined, null, 42, 'modules', {}, logging, new Set([logging])]) {
    const error = install(modules);
    expect(error.code).toBe('DI_BAG_INVALID_ARGUMENT');
    expect(error.details).toEqual({ operation: 'withInstalledModules', argument: 'modules', expected: 'an array' });
  }
  const notAModule = install([logging, {}, other]);
  expect(notAModule.code).toBe('DI_BAG_INVALID_MODULE');
  expect(notAModule.details).toEqual({ operation: 'withInstalledModules', index: 1 });
  expect(notAModule.message).toContain('withInstalledModules requires genuine modules: element 1 is not one');
  expect(install([logging, 42]).details).toEqual({ operation: 'withInstalledModules', index: 1 });
  // A hole reads as undefined, which is not a module.
  expect(install([logging, , other]).details).toEqual({ operation: 'withInstalledModules', index: 1 });

  // Two modules of one list export the same name: the second is the duplicate.
  const twice = install([logging, other, logging]);
  expect(twice.code).toBe('DI_BAG_DUPLICATE_SERVICE_KEY');
  expect(twice.details).toEqual({ operation: 'withInstalledModules', serviceKey: 'logger' });
  // A module export collides with the host.
  const colliding = DiBag.createBuilder().withServices({ taken: () => 1 }).buildModule({ exportedServiceKeys: ['taken'] });
  expect(install([other, colliding]).details).toEqual({ operation: 'withInstalledModules', serviceKey: 'taken' });
  // Builders are immutable: the host is still usable and still has one service.
  const app = host.buildContainer();
  expect(app.graphSnapshot().bindings.map(binding => binding.label)).toEqual(['taken']);
});

test('withInstalledModules snapshots the list by index, so an iterator or a later write cannot substitute modules', async () => {
  const genuine = DiBag.createBuilder().withServices({ value: () => 'genuine' }).buildModule({ exportedServiceKeys: ['value'] });
  const substitute = DiBag.createBuilder().withServices({ value: () => 'substitute' }).buildModule({ exportedServiceKeys: ['value'] });
  const modules = [genuine];
  (modules as any)[Symbol.iterator] = function* () { yield substitute; };
  const builder = loose(DiBag.createBuilder()).withInstalledModules!(modules);
  modules[0] = substitute;
  const app = builder.buildContainer();
  expect(app.resolve('value')).toBe('genuine');
  await app.close();
});

test('module-list token-kind conflicts name the renamed operation', () => {
  const key = Symbol('installed-kind');
  const single = DiBag.createToken(key).forService<number>();
  const collection = DiBag.createToken(key).forCollectionOf<number>();
  const module = DiBag.createBuilder()
    .withCollectionContribution({ collectionToken: collection, provider: () => 2 })
    .buildModule({ exportedServiceKeys: [] });
  const nested = DiBag.createBuilder().withInstalledModules([module])
    .buildModule({ exportedServiceKeys: [] });
  for (const candidate of [module, nested]) {
    const host = DiBag.createBuilder()
      .withTokenService(single, () => 1);
    const error = caught(() => loose(host).withInstalledModules!([candidate]));
    expect(error.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
    expect(error.details).toEqual({
      operation: 'withInstalledModules', expectedKind: 'single-service', receivedKind: 'collection',
    });
  }
});

test('buildModule takes one bag, and the module label names private bindings', async () => {
  const orders = DiBag.createBuilder()
    .withServices({ repository: () => new Map<string, number>() })
    .withServices({ placeOrder: ({ repository }: { repository: Map<string, number> }) => (id: string) => repository.set(id, 1).size })
    .buildModule({ exportedServiceKeys: ['placeOrder'], moduleLabel: 'orders' });
  const app = DiBag.createBuilder().withInstalledModules([orders]).buildContainer();
  expect(app.resolve('placeOrder')('a')).toBe(1);
  expect(app.graphSnapshot().bindings.map(binding => binding.label).sort()).toEqual(['orders/repository', 'placeOrder']);
  await app.close();
  const builder = DiBag.createBuilder().withServices({ value: () => 1 });
  expect(() => builder.buildModule({ exportedServiceKeys: ['value'] })).not.toThrow();
  expect(() => loose(builder).buildModule!({ exportedServiceKeys: ['value'], moduleLabel: undefined })).not.toThrow();
  expect(() => builder.buildModule({ exportedServiceKeys: [] })).not.toThrow();
});

test('buildModule rejects a malformed bag, a malformed key list and a malformed moduleLabel', () => {
  const builder = DiBag.createBuilder().withServices({ value: () => 1 });
  const seal = (options: unknown) => caught(() => loose(builder).buildModule!(options));
  // The contracted method accepts only the checked options bag.
  const onlyOwn = { operation: 'buildModule', argument: 'options', expected: 'only the own properties: exportedServiceKeys, moduleLabel' };
  expect(seal({ exportedServiceKeys: ['value'], label: 'orders' }).details).toEqual(onlyOwn);
  expect(seal(Object.create({ exportedServiceKeys: ['value'] })).details).toEqual(onlyOwn);
  expect(seal({ moduleLabel: 'orders' }).details).toEqual({ operation: 'buildModule', argument: 'exportedServiceKeys', expected: 'present' });
  for (const moduleLabel of ['', 1, null, {}]) {
    const error = seal({ exportedServiceKeys: ['value'], moduleLabel });
    expect(error.code).toBe('DI_BAG_INVALID_ARGUMENT');
    expect(error.details).toEqual({ operation: 'buildModule', argument: 'moduleLabel', expected: 'a non-empty string' });
    expect(error.message).toContain('buildModule moduleLabel must be a non-empty string');
  }
  const notATuple = seal({ exportedServiceKeys: 'value' });
  expect(notATuple.code).toBe('DI_BAG_INVALID_ARGUMENT');
  expect(notATuple.details).toEqual({ operation: 'buildModule', argument: 'exportedServiceKeys', expected: 'an array' });
  expect(seal({ exportedServiceKeys: ['absent'] }).code).toBe('DI_BAG_UNKNOWN_SERVICE_KEY');
});
