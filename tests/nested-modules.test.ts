import { expect, test } from 'bun:test';
import { DiBag } from '../src';

// One builder seals modules and builds bags, so a module can install modules.
// These tests pin the runtime rules for nesting: fresh identities at every
// depth, lexical name resolution, and host visibility of exports only.

test('one builder value yields both a bag and a module, and later operations leave the module unchanged', async () => {
  const builder = DiBag.createBuilder().withServices({ value: () => 1, read: ({ value }: { value: number }) => value * 10 });
  const bag = builder.buildContainer();
  const module = builder.buildModule({ exportedServiceKeys: ['read'] });
  const changed = builder.withReplacedService('value', () => 5);
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
    state: DiBag.providerWithDisposal({ provider: () => ({ id: ++next }), disposeService: state => { events.push(`state${state.id}`); } }),
    read: ({ state }: { state: { id: number } }) => state.id,
  }).buildModule({ exportedServiceKeys: ['read'] });
  const outer = DiBag.createBuilder().withInstalledModules([inner]).withServices({
    wrap: DiBag.providerWithDisposal({ provider: ({ read }: { read: number }) => ({ read }), disposeService: wrap => { events.push(`wrap${wrap.read}`); } }),
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
    connection: () => 'inner-connection',
    service: ({ connection, logger, clock }: { connection: string; logger: string; clock: string }) => [connection, logger, clock],
  }).buildModule({ exportedServiceKeys: ['service'] });
  const outer = DiBag.createBuilder()
    .withInstalledModules([inner])
    .withServices({ connection: () => 'outer-connection', logger: () => 'outer-logger' })
    .withServices({ outerView: ({ connection, service }: { connection: string; service: string[] }) => [connection, ...service] })
    .buildModule({ exportedServiceKeys: ['service', 'outerView'] });
  const host = DiBag.createBuilder()
    .withInstalledModules([outer])
    .withServices({ connection: () => 'host-connection', logger: () => 'host-logger', clock: () => 'host-clock' })
    .buildContainer();
  expect(host.resolve('service')).toEqual(['inner-connection', 'outer-logger', 'host-clock']);
  expect(host.resolve('outerView')).toEqual(['outer-connection', 'inner-connection', 'outer-logger', 'host-clock']);
  expect(host.resolve('connection')).toBe('host-connection');
  await host.close();
});

test('host replacements, forks and scopes of an outer export reach inner consumers through the public slot', async () => {
  const inner = DiBag.createBuilder().withServices({
    service: ({ config }: { config: { mode: string } }) => `service:${config.mode}`,
  }).buildModule({ exportedServiceKeys: ['service'] });
  const outer = DiBag.createBuilder().withInstalledModules([inner]).withServices({ config: () => ({ mode: 'outer' }) }).buildModule({ exportedServiceKeys: ['service', 'config'] });
  const builder = DiBag.createBuilder().withInstalledModules([outer]);
  const root = builder.buildContainer();
  const replaced = builder.withReplacedService('config', () => ({ mode: 'replaced' })).buildContainer();
  const fork = root.createIndependentContainer(['config'], { config: () => ({ mode: 'fork' }) });
  const scope = root.createChildContainer(['config'], { config: () => ({ mode: 'scope' }) });
  expect(root.resolve('service')).toBe('service:outer');
  expect(replaced.resolve('service')).toBe('service:replaced');
  expect(fork.resolve('service')).toBe('service:fork');
  expect(scope.resolve('service')).toBe('service:scope');
  await scope.close(); await fork.close(); await replaced.close(); await root.close();
});

test('renaming a nested export at the outer level keeps inner references and the inner rename intact', async () => {
  const inner = DiBag.createBuilder().withServices({
    base: () => 2,
    doubled: ({ base }: { base: number }) => base * 2,
  }).buildModule({ exportedServiceKeys: ['base', 'doubled'] }).withRenamedExport({ currentExportKey: 'base', newExportKey: 'innerBase' });
  const outer = DiBag.createBuilder()
    .withInstalledModules([inner])
    .withServices({ sum: ({ innerBase, doubled }: { innerBase: number; doubled: number }) => innerBase + doubled })
    .buildModule({ exportedServiceKeys: ['innerBase', 'sum'] })
    .withRenamedExport({ currentExportKey: 'innerBase', newExportKey: 'hostBase' });
  const host = DiBag.createBuilder().withInstalledModules([outer]).withServices({ base: () => 100, innerBase: () => 200 }).buildContainer();
  expect(host.resolve('hostBase')).toBe(2);
  expect(host.resolve('sum')).toBe(6);
  // The inner base is exported, so a host override of its final name reaches inner consumers too.
  const fork = host.createIndependentContainer(['hostBase'], { hostBase: () => 10 });
  expect(fork.resolve('sum')).toBe(30);
  await fork.close(); await host.close();
});

test('contributions inside nested modules install in declaration order and resolve their private dependencies', async () => {
  const groupKey = Symbol('group');
  const group = DiBag.createToken(groupKey).forCollectionOf<string>();
  const inner = DiBag.createBuilder()
    .withServices({ secret: () => 'inner-secret' })
    .withCollectionContribution({ collectionToken: group, provider: ({ secret }: { secret: string }) => `inner:${secret}` })
    .buildModule({ exportedServiceKeys: [] });
  const outer = DiBag.createBuilder()
    .withCollectionContribution({ collectionToken: group, provider: () => 'outer-first' })
    .withInstalledModules([inner])
    .withServices({ secret: () => 'outer-secret' })
    .withCollectionContribution({ collectionToken: group, provider: ({ secret }: { secret: string }) => `outer:${secret}` })
    .buildModule({ exportedServiceKeys: [] });
  const host = DiBag.createBuilder()
    .withCollectionContribution({ collectionToken: group, provider: () => 'host-first' })
    .withInstalledModules([outer])
    .withServices({ secret: () => 'host-secret' })
    .withCollectionContribution({ collectionToken: group, provider: ({ secret }: { secret: string }) => `host:${secret}` })
    .buildContainer();
  expect(host.resolveCollection(group)).toEqual(['host-first', 'outer-first', 'inner:inner-secret', 'outer:outer-secret', 'host:host-secret']);
  expect(host.serviceSnapshot(group)).toHaveLength(5);
  await host.close();
});

test('aliases survive nesting whether their target is exported or private', async () => {
  const inner = DiBag.createBuilder()
    .withServices({ target: () => 'value' })
    .withServiceAlias({ aliasKey: 'innerAlias', targetServiceKey: 'target' })
    .buildModule({ exportedServiceKeys: ['innerAlias'] });
  const outer = DiBag.createBuilder()
    .withInstalledModules([inner])
    .withServiceAlias({ aliasKey: 'outerAlias', targetServiceKey: 'innerAlias' })
    .withServices({ consumer: ({ outerAlias }: { outerAlias: string }) => `${outerAlias}!` })
    .buildModule({ exportedServiceKeys: ['outerAlias', 'consumer'] });
  const host = DiBag.createBuilder().withInstalledModules([outer]).buildContainer();
  expect(host.resolve('outerAlias')).toBe('value');
  expect(host.resolve('consumer')).toBe('value!');
  expect(() => (host.resolve as Function)('innerAlias')).toThrow('is not registered');
  await host.close();
});

test('three nesting levels forward unmet requirements outward and keep replaced history private', async () => {
  const leaf = DiBag.createBuilder().withServices({
    leafValue: ({ external }: { external: number }) => external + 1,
  }).buildModule({ exportedServiceKeys: ['leafValue'] });
  const middleBuilder = DiBag.createBuilder().withInstalledModules([leaf]).withServices({ middleValue: ({ leafValue }: { leafValue: number }) => leafValue * 2 });
  const middle = middleBuilder.withReplacedService('middleValue', ({ leafValue }: { leafValue: number }) => leafValue * 3).buildModule({ exportedServiceKeys: ['middleValue'] });
  const top = DiBag.createBuilder().withInstalledModules([middle]).withServices({ topValue: ({ middleValue }: { middleValue: number }) => middleValue + 100 }).buildModule({ exportedServiceKeys: ['topValue'] });
  const host = DiBag.createBuilder().withInstalledModules([top]).withServices({ external: () => 1 }).buildContainer();
  expect(host.resolve('topValue')).toBe(106);
  const missing = (DiBag.createBuilder().withInstalledModules as Function)([top]).buildContainer();
  expect(() => missing.resolve('topValue')).toThrow('dependency "external" is not registered');
  await host.close(); await missing.close();
});

test('an outer module with no exports still installs nested contributions and nothing else', async () => {
  const groupKey = Symbol('group');
  const group = DiBag.createToken(groupKey).forCollectionOf<number>();
  const inner = DiBag.createBuilder().withServices({ hidden: () => 1 }).withCollectionContribution({ collectionToken: group, provider: ({ hidden }: { hidden: number }) => hidden }).buildModule({ exportedServiceKeys: ['hidden'] });
  const outer = DiBag.createBuilder().withInstalledModules([inner]).buildModule({ exportedServiceKeys: [] });
  const host = DiBag.createBuilder().withInstalledModules([outer]).buildContainer();
  expect(host.resolveCollection(group)).toEqual([1]);
  expect(() => (host.resolve as Function)('hidden')).toThrow('is not registered');
  await host.close();
});

test('startup and child scopes acquire nested exports through the host runtime', async () => {
  const events: string[] = [];
  const inner = DiBag.createBuilder().withServices({
    resource: DiBag.providerWithDisposal({ provider: async () => { events.push('open'); return 'ready'; }, disposeService: () => { events.push('close'); } }),
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
  const builder = DiBag.createBuilder().withServices({ a: () => 1 });
  expect(() => (builder.buildModule as Function)({ exportedServiceKeys: ['missing'] })).toThrow('existing names or typed tokens only');
  expect(() => (builder.buildModule as Function)({ exportedServiceKeys: 'a' })).toThrow('key tuple');
  const module = builder.buildModule({ exportedServiceKeys: ['a'] });
  expect(() => (DiBag.createBuilder().withInstalledModules as Function)([{ ...module }])).toThrow('withInstalledModules requires genuine modules: element 0 is not one');
  expect(() => (DiBag.createBuilder().withServices({ a: () => 2 }).withInstalledModules as Function)([module])).toThrow('duplicate registration: a');
});
