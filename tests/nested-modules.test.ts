import { expect, test } from 'bun:test';
import { DiBag } from '../src';

// One builder seals modules and builds bags, so a module can install modules.
// These tests pin the runtime rules for nesting: fresh identities at every
// depth, lexical name resolution, and host visibility of exports only.

test('one builder value yields both a bag and a module, and later operations leave the module unchanged', async () => {
  const builder = DiBag.createBuilder().withServices({ value: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), read: DiBag.providerWithLifetime({ provider: ({ value }: { value: number }) => value * 10, lifetime: 'scoped:one-per-container' }) });
  const bag = builder.buildContainer();
  const module = builder.buildModule({ exportedServiceKeys: ['read'] });
  const changed = builder.withReplacedService('value', DiBag.providerWithLifetime({ provider: () => 5, lifetime: 'scoped:one-per-container' }));
  const host = DiBag.createBuilder().withInstalledModules([module]).buildContainer();
  const changedBag = changed.buildContainer();
  expect(bag.resolve('read')).toBe(10);
  expect(host.resolve('read')).toBe(10);
  expect(changedBag.resolve('read')).toBe(50);
  expect(() => (host.resolve as Function)('value')).toThrow('is not registered');
  await bag.close(); await host.close(); await changedBag.close();
});

test('nested installations receive fresh private identities and ownership at every depth', async () => {
  const events: string[] = [];
  let next = 0;
  const inner = DiBag.createBuilder().withServices({
    state: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: () => ({ id: ++next }), disposeService: state => { events.push(`state${state.id}`); } }), lifetime: 'scoped:one-per-container' }),
    read: DiBag.providerWithLifetime({ provider: ({ state }: { state: { id: number } }) => state.id, lifetime: 'scoped:one-per-container' }),
  }).buildModule({ exportedServiceKeys: ['read'] });
  const outer = DiBag.createBuilder().withInstalledModules([inner]).withServices({
    wrap: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: ({ read }: { read: number }) => ({ read }), disposeService: wrap => { events.push(`wrap${wrap.read}`); } }), lifetime: 'scoped:one-per-container' }),
  }).buildModule({ exportedServiceKeys: ['wrap'] });
  const host = DiBag.createBuilder()
    .withInstalledModules([outer.withRenamedExport({ currentExportKey: 'wrap', newExportKey: 'left' })])
    .withInstalledModules([outer.withRenamedExport({ currentExportKey: 'wrap', newExportKey: 'right' })])
    .buildContainer();
  expect(host.resolve('left')).toEqual({ read: 1 });
  expect(host.resolve('right')).toEqual({ read: 2 });
  expect(host.resolve('left')).toBe(host.resolve('left'));
  expect(() => (host.resolve as Function)('read')).toThrow('is not registered');
  expect(() => (host.resolve as Function)('wrap')).toThrow('is not registered');
  const fork = host.createIndependentContainer();
  expect(fork.resolve('right')).toEqual({ read: 3 });
  await host.close();
  expect(events).toEqual(['wrap2', 'state2', 'wrap1', 'state1']);
  await fork.close();
  expect(events).toEqual(['wrap2', 'state2', 'wrap1', 'state1', 'wrap3', 'state3']);
});

test('names resolve lexically: inner scope, then the enclosing module, then the host', async () => {
  const inner = DiBag.createBuilder().withServices({
    connection: DiBag.providerWithLifetime({ provider: () => 'inner-connection', lifetime: 'scoped:one-per-container' }),
    service: DiBag.providerWithLifetime({ provider: ({ connection, logger, clock }: { connection: string; logger: string; clock: string }) => [connection, logger, clock], lifetime: 'scoped:one-per-container' }),
  }).buildModule({ exportedServiceKeys: ['service'] });
  const outer = DiBag.createBuilder()
    .withInstalledModules([inner])
    .withServices({ connection: DiBag.providerWithLifetime({ provider: () => 'outer-connection', lifetime: 'scoped:one-per-container' }), logger: DiBag.providerWithLifetime({ provider: () => 'outer-logger', lifetime: 'scoped:one-per-container' }) })
    .withServices({ outerView: DiBag.providerWithLifetime({ provider: ({ connection, service }: { connection: string; service: string[] }) => [connection, ...service], lifetime: 'scoped:one-per-container' }) })
    .buildModule({ exportedServiceKeys: ['service', 'outerView'] });
  const host = DiBag.createBuilder()
    .withInstalledModules([outer])
    .withServices({ connection: DiBag.providerWithLifetime({ provider: () => 'host-connection', lifetime: 'scoped:one-per-container' }), logger: DiBag.providerWithLifetime({ provider: () => 'host-logger', lifetime: 'scoped:one-per-container' }), clock: DiBag.providerWithLifetime({ provider: () => 'host-clock', lifetime: 'scoped:one-per-container' }) })
    .buildContainer();
  expect(host.resolve('service')).toEqual(['inner-connection', 'outer-logger', 'host-clock']);
  expect(host.resolve('outerView')).toEqual(['outer-connection', 'inner-connection', 'outer-logger', 'host-clock']);
  expect(host.resolve('connection')).toBe('host-connection');
  await host.close();
});

test('host replacements, forks and scopes of an outer export reach inner consumers through the public slot', async () => {
  const inner = DiBag.createBuilder().withServices({
    service: DiBag.providerWithLifetime({ provider: ({ config }: { config: { mode: string } }) => `service:${config.mode}`, lifetime: 'scoped:one-per-container' }),
  }).buildModule({ exportedServiceKeys: ['service'] });
  const outer = DiBag.createBuilder().withInstalledModules([inner]).withServices({ config: DiBag.providerWithLifetime({ provider: () => ({ mode: 'outer' }), lifetime: 'scoped:one-per-container' }) }).buildModule({ exportedServiceKeys: ['service', 'config'] });
  const builder = DiBag.createBuilder().withInstalledModules([outer]);
  const root = builder.buildContainer();
  const replaced = builder.withReplacedService('config', DiBag.providerWithLifetime({ provider: () => ({ mode: 'replaced' }), lifetime: 'scoped:one-per-container' })).buildContainer();
  const fork = root.createIndependentContainer(['config'], { config: DiBag.providerWithLifetime({ provider: () => ({ mode: 'fork' }), lifetime: 'scoped:one-per-container' }) });
  const scope = root.createChildContainer(['config'], { config: DiBag.providerWithLifetime({ provider: () => ({ mode: 'scope' }), lifetime: 'scoped:one-per-container' }) });
  expect(root.resolve('service')).toBe('service:outer');
  expect(replaced.resolve('service')).toBe('service:replaced');
  expect(fork.resolve('service')).toBe('service:fork');
  expect(scope.resolve('service')).toBe('service:scope');
  await scope.close(); await fork.close(); await replaced.close(); await root.close();
});

test('renaming a nested export at the outer level keeps inner references and the inner rename intact', async () => {
  const inner = DiBag.createBuilder().withServices({
    base: DiBag.providerWithLifetime({ provider: () => 2, lifetime: 'scoped:one-per-container' }),
    doubled: DiBag.providerWithLifetime({ provider: ({ base }: { base: number }) => base * 2, lifetime: 'scoped:one-per-container' }),
  }).buildModule({ exportedServiceKeys: ['base', 'doubled'] }).withRenamedExport({ currentExportKey: 'base', newExportKey: 'innerBase' });
  const outer = DiBag.createBuilder()
    .withInstalledModules([inner])
    .withServices({ sum: DiBag.providerWithLifetime({ provider: ({ innerBase, doubled }: { innerBase: number; doubled: number }) => innerBase + doubled, lifetime: 'scoped:one-per-container' }) })
    .buildModule({ exportedServiceKeys: ['innerBase', 'sum'] })
    .withRenamedExport({ currentExportKey: 'innerBase', newExportKey: 'hostBase' });
  const host = DiBag.createBuilder().withInstalledModules([outer]).withServices({ base: DiBag.providerWithLifetime({ provider: () => 100, lifetime: 'scoped:one-per-container' }), innerBase: DiBag.providerWithLifetime({ provider: () => 200, lifetime: 'scoped:one-per-container' }) }).buildContainer();
  expect(host.resolve('hostBase')).toBe(2);
  expect(host.resolve('sum')).toBe(6);
  // The inner base is exported, so a host override of its final name reaches inner consumers too.
  const fork = host.createIndependentContainer(['hostBase'], { hostBase: DiBag.providerWithLifetime({ provider: () => 10, lifetime: 'scoped:one-per-container' }) });
  expect(fork.resolve('sum')).toBe(30);
  await fork.close(); await host.close();
});

test('contributions inside nested modules install in declaration order and resolve their private dependencies', async () => {
  const groupKey = Symbol('group');
  const group = DiBag.createToken(groupKey).forCollectionOf<string>();
  const inner = DiBag.createBuilder()
    .withServices({ secret: DiBag.providerWithLifetime({ provider: () => 'inner-secret', lifetime: 'scoped:one-per-container' }) })
    .withCollectionContribution({ collectionToken: group, provider: DiBag.providerWithLifetime({ provider: ({ secret }: { secret: string }) => `inner:${secret}`, lifetime: 'scoped:one-per-container' }) })
    .buildModule({ exportedServiceKeys: [] });
  const outer = DiBag.createBuilder()
    .withCollectionContribution({ collectionToken: group, provider: DiBag.providerWithLifetime({ provider: () => 'outer-first', lifetime: 'scoped:one-per-container' }) })
    .withInstalledModules([inner])
    .withServices({ secret: DiBag.providerWithLifetime({ provider: () => 'outer-secret', lifetime: 'scoped:one-per-container' }) })
    .withCollectionContribution({ collectionToken: group, provider: DiBag.providerWithLifetime({ provider: ({ secret }: { secret: string }) => `outer:${secret}`, lifetime: 'scoped:one-per-container' }) })
    .buildModule({ exportedServiceKeys: [] });
  const host = DiBag.createBuilder()
    .withCollectionContribution({ collectionToken: group, provider: DiBag.providerWithLifetime({ provider: () => 'host-first', lifetime: 'scoped:one-per-container' }) })
    .withInstalledModules([outer])
    .withServices({ secret: DiBag.providerWithLifetime({ provider: () => 'host-secret', lifetime: 'scoped:one-per-container' }) })
    .withCollectionContribution({ collectionToken: group, provider: DiBag.providerWithLifetime({ provider: ({ secret }: { secret: string }) => `host:${secret}`, lifetime: 'scoped:one-per-container' }) })
    .buildContainer();
  expect(host.resolveCollection(group)).toEqual(['host-first', 'outer-first', 'inner:inner-secret', 'outer:outer-secret', 'host:host-secret']);
  expect(host.serviceSnapshot(group)).toHaveLength(5);
  await host.close();
});

test('aliases survive nesting whether their target is exported or private', async () => {
  const inner = DiBag.createBuilder()
    .withServices({ target: DiBag.providerWithLifetime({ provider: () => 'value', lifetime: 'scoped:one-per-container' }) })
    .withServiceAlias({ aliasKey: 'innerAlias', targetServiceKey: 'target' })
    .buildModule({ exportedServiceKeys: ['innerAlias'] });
  const outer = DiBag.createBuilder()
    .withInstalledModules([inner])
    .withServiceAlias({ aliasKey: 'outerAlias', targetServiceKey: 'innerAlias' })
    .withServices({ consumer: DiBag.providerWithLifetime({ provider: ({ outerAlias }: { outerAlias: string }) => `${outerAlias}!`, lifetime: 'scoped:one-per-container' }) })
    .buildModule({ exportedServiceKeys: ['outerAlias', 'consumer'] });
  const host = DiBag.createBuilder().withInstalledModules([outer]).buildContainer();
  expect(host.resolve('outerAlias')).toBe('value');
  expect(host.resolve('consumer')).toBe('value!');
  expect(() => (host.resolve as Function)('innerAlias')).toThrow('is not registered');
  await host.close();
});

test('three nesting levels forward unmet requirements outward and keep replaced history private', async () => {
  const leaf = DiBag.createBuilder().withServices({
    leafValue: DiBag.providerWithLifetime({ provider: ({ external }: { external: number }) => external + 1, lifetime: 'scoped:one-per-container' }),
  }).buildModule({ exportedServiceKeys: ['leafValue'] });
  const middleBuilder = DiBag.createBuilder().withInstalledModules([leaf]).withServices({ middleValue: DiBag.providerWithLifetime({ provider: ({ leafValue }: { leafValue: number }) => leafValue * 2, lifetime: 'scoped:one-per-container' }) });
  const middle = middleBuilder.withReplacedService('middleValue', DiBag.providerWithLifetime({ provider: ({ leafValue }: { leafValue: number }) => leafValue * 3, lifetime: 'scoped:one-per-container' })).buildModule({ exportedServiceKeys: ['middleValue'] });
  const top = DiBag.createBuilder().withInstalledModules([middle]).withServices({ topValue: DiBag.providerWithLifetime({ provider: ({ middleValue }: { middleValue: number }) => middleValue + 100, lifetime: 'scoped:one-per-container' }) }).buildModule({ exportedServiceKeys: ['topValue'] });
  const host = DiBag.createBuilder().withInstalledModules([top]).withServices({ external: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) }).buildContainer();
  expect(host.resolve('topValue')).toBe(106);
  const missing = (DiBag.createBuilder().withInstalledModules as Function)([top]).buildContainer();
  expect(() => missing.resolve('topValue')).toThrow('dependency "external" is not registered');
  await host.close(); await missing.close();
});

test('an outer module with no exports still installs nested contributions and nothing else', async () => {
  const groupKey = Symbol('group');
  const group = DiBag.createToken(groupKey).forCollectionOf<number>();
  const inner = DiBag.createBuilder().withServices({ hidden: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) }).withCollectionContribution({ collectionToken: group, provider: DiBag.providerWithLifetime({ provider: ({ hidden }: { hidden: number }) => hidden, lifetime: 'scoped:one-per-container' }) }).buildModule({ exportedServiceKeys: ['hidden'] });
  const outer = DiBag.createBuilder().withInstalledModules([inner]).buildModule({ exportedServiceKeys: [] });
  const host = DiBag.createBuilder().withInstalledModules([outer]).buildContainer();
  expect(host.resolveCollection(group)).toEqual([1]);
  expect(() => (host.resolve as Function)('hidden')).toThrow('is not registered');
  await host.close();
});

test('startup and child scopes acquire nested exports through the host runtime', async () => {
  const events: string[] = [];
  const inner = DiBag.createBuilder().withServices({
    resource: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: async () => { events.push('open'); return 'ready'; }, disposeService: () => { events.push('close'); } }), lifetime: 'scoped:one-per-container' }),
  }).buildModule({ exportedServiceKeys: ['resource'] });
  const outer = DiBag.createBuilder().withInstalledModules([inner]).withServices({
    scoped: DiBag.providerWithLifetime({ provider: ({ resource }: { resource: Promise<string> }) => resource, lifetime: 'scoped:one-per-container' }),
  }).buildModule({ exportedServiceKeys: ['resource', 'scoped'] });
  const host = await DiBag.createBuilder().withInstalledModules([outer]).buildContainer().ensureServicesReady(['resource']);
  expect(events).toEqual(['open']);
  const child = host.createChildContainer({ sharedParentServiceKeys: ['resource'] });
  expect(await child.resolve('scoped')).toBe('ready');
  await child.close();
  await host.close();
  expect(events).toEqual(['open', 'close']);
});

test('sealing rejects unknown keys and forged modules exactly as before', () => {
  const builder = DiBag.createBuilder().withServices({ a: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) });
  expect(() => (builder.buildModule as Function)({ exportedServiceKeys: ['missing'] })).toThrow('existing names or typed tokens only');
  expect(() => (builder.buildModule as Function)({ exportedServiceKeys: 'a' })).toThrow('key tuple');
  const module = builder.buildModule({ exportedServiceKeys: ['a'] });
  expect(() => (DiBag.createBuilder().withInstalledModules as Function)([{ ...module }])).toThrow('withInstalledModules requires genuine modules: element 0 is not one');
  expect(() => (DiBag.createBuilder().withServices({ a: DiBag.providerWithLifetime({ provider: () => 2, lifetime: 'scoped:one-per-container' }) }).withInstalledModules as Function)([module])).toThrow('duplicate registration: a');
});
