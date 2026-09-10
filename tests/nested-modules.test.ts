import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';

// One builder seals modules and builds bags, so a module can install modules.
// These tests pin the runtime rules for nesting: fresh identities at every
// depth, lexical name resolution, and host visibility of exports only.

test('one builder value yields both a bag and a module, and later operations leave the module unchanged', async () => {
  const builder = DiBag.createBuilder().register({ value: () => 1, read: ({ value }: { value: number }) => value * 10 });
  const bag = builder.build();
  const module = builder.buildModule(['read']);
  const changed = builder.replace('value', () => 5);
  const host = DiBag.createBuilder().installModule(module).build();
  const changedBag = changed.build();
  expect(bag.resolve('read')).toBe(10);
  expect(host.resolve('read')).toBe(10);
  expect(changedBag.resolve('read')).toBe(50);
  expect(() => (host.resolve as Function)('value')).toThrow('is not registered');
  await bag.close(); await host.close(); await changedBag.close();
});

test('nested installations receive fresh private identities and ownership at every depth', async () => {
  const events: string[] = [];
  let next = 0;
  const inner = DiBag.createBuilder().register({
    state: DiBag.withDisposal(() => ({ id: ++next }), state => { events.push(`state${state.id}`); }),
    read: ({ state }: { state: { id: number } }) => state.id,
  }).buildModule(['read']);
  const outer = DiBag.createBuilder().installModule(inner).register({
    wrap: DiBag.withDisposal(({ read }: { read: number }) => ({ read }), wrap => { events.push(`wrap${wrap.read}`); }),
  }).buildModule(['wrap']);
  const host = DiBag.createBuilder()
    .installModule(outer.renameExport('wrap', 'left'))
    .installModule(outer.renameExport('wrap', 'right'))
    .build();
  expect(host.resolve('left')).toEqual({ read: 1 });
  expect(host.resolve('right')).toEqual({ read: 2 });
  expect(host.resolve('left')).toBe(host.resolve('left'));
  expect(() => (host.resolve as Function)('read')).toThrow('is not registered');
  expect(() => (host.resolve as Function)('wrap')).toThrow('is not registered');
  const fork = host.fork();
  expect(fork.resolve('right')).toEqual({ read: 3 });
  await host.close();
  expect(events).toEqual(['wrap2', 'state2', 'wrap1', 'state1']);
  await fork.close();
  expect(events).toEqual(['wrap2', 'state2', 'wrap1', 'state1', 'wrap3', 'state3']);
});

test('names resolve lexically: inner scope, then the enclosing module, then the host', async () => {
  const inner = DiBag.createBuilder().register({
    connection: () => 'inner-connection',
    service: ({ connection, logger, clock }: { connection: string; logger: string; clock: string }) => [connection, logger, clock],
  }).buildModule(['service']);
  const outer = DiBag.createBuilder()
    .installModule(inner)
    .register({ connection: () => 'outer-connection', logger: () => 'outer-logger' })
    .register({ outerView: ({ connection, service }: { connection: string; service: string[] }) => [connection, ...service] })
    .buildModule(['service', 'outerView']);
  const host = DiBag.createBuilder()
    .installModule(outer)
    .register({ connection: () => 'host-connection', logger: () => 'host-logger', clock: () => 'host-clock' })
    .build();
  expect(host.resolve('service')).toEqual(['inner-connection', 'outer-logger', 'host-clock']);
  expect(host.resolve('outerView')).toEqual(['outer-connection', 'inner-connection', 'outer-logger', 'host-clock']);
  expect(host.resolve('connection')).toBe('host-connection');
  await host.close();
});

test('host replacements, forks and scopes of an outer export reach inner consumers through the public slot', async () => {
  const inner = DiBag.createBuilder().register({
    service: ({ config }: { config: { mode: string } }) => `service:${config.mode}`,
  }).buildModule(['service']);
  const outer = DiBag.createBuilder().installModule(inner).register({ config: () => ({ mode: 'outer' }) }).buildModule(['service', 'config']);
  const builder = DiBag.createBuilder().installModule(outer);
  const root = builder.build();
  const replaced = builder.replace('config', () => ({ mode: 'replaced' })).build();
  const fork = root.fork(['config'], { config: () => ({ mode: 'fork' }) });
  const scope = root.createScope(['config'], { config: () => ({ mode: 'scope' }) });
  expect(root.resolve('service')).toBe('service:outer');
  expect(replaced.resolve('service')).toBe('service:replaced');
  expect(fork.resolve('service')).toBe('service:fork');
  expect(scope.resolve('service')).toBe('service:scope');
  await scope.close(); await fork.close(); await replaced.close(); await root.close();
});

test('renaming a nested export at the outer level keeps inner references and the inner rename intact', async () => {
  const inner = DiBag.createBuilder().register({
    base: () => 2,
    doubled: ({ base }: { base: number }) => base * 2,
  }).buildModule(['base', 'doubled']).renameExport('base', 'innerBase');
  const outer = DiBag.createBuilder()
    .installModule(inner)
    .register({ sum: ({ innerBase, doubled }: { innerBase: number; doubled: number }) => innerBase + doubled })
    .buildModule(['innerBase', 'sum'])
    .renameExport('innerBase', 'hostBase');
  const host = DiBag.createBuilder().installModule(outer).register({ base: () => 100, innerBase: () => 200 }).build();
  expect(host.resolve('hostBase')).toBe(2);
  expect(host.resolve('sum')).toBe(6);
  // The inner base is exported, so a host override of its final name reaches inner consumers too.
  const fork = host.fork(['hostBase'], { hostBase: () => 10 });
  expect(fork.resolve('sum')).toBe(30);
  await fork.close(); await host.close();
});

test('contributions inside nested modules install in declaration order and resolve their private dependencies', async () => {
  const groupKey = Symbol('group');
  const group = DiBag.token(groupKey).of<string>();
  const inner = DiBag.createBuilder()
    .register({ secret: () => 'inner-secret' })
    .contribute(group, ({ secret }: { secret: string }) => `inner:${secret}`)
    .buildModule([]);
  const outer = DiBag.createBuilder()
    .contribute(group, () => 'outer-first')
    .installModule(inner)
    .register({ secret: () => 'outer-secret' })
    .contribute(group, ({ secret }: { secret: string }) => `outer:${secret}`)
    .buildModule([]);
  const host = DiBag.createBuilder()
    .contribute(group, () => 'host-first')
    .installModule(outer)
    .register({ secret: () => 'host-secret' })
    .contribute(group, ({ secret }: { secret: string }) => `host:${secret}`)
    .build();
  expect(host.resolveAll(group)).toEqual(['host-first', 'outer-first', 'inner:inner-secret', 'outer:outer-secret', 'host:host-secret']);
  expect(host.inspectAll(group)).toHaveLength(5);
  await host.close();
});

test('aliases survive nesting whether their target is exported or private', async () => {
  const inner = DiBag.createBuilder()
    .register({ target: () => 'value' })
    .alias('innerAlias', 'target')
    .buildModule(['innerAlias']);
  const outer = DiBag.createBuilder()
    .installModule(inner)
    .alias('outerAlias', 'innerAlias')
    .register({ consumer: ({ outerAlias }: { outerAlias: string }) => `${outerAlias}!` })
    .buildModule(['outerAlias', 'consumer']);
  const host = DiBag.createBuilder().installModule(outer).build();
  expect(host.resolve('outerAlias')).toBe('value');
  expect(host.resolve('consumer')).toBe('value!');
  expect(() => (host.resolve as Function)('innerAlias')).toThrow('is not registered');
  await host.close();
});

test('three nesting levels forward unmet requirements outward and keep replaced history private', async () => {
  const leaf = DiBag.createBuilder().register({
    leafValue: ({ external }: { external: number }) => external + 1,
  }).buildModule(['leafValue']);
  const middleBuilder = DiBag.createBuilder().installModule(leaf).register({ middleValue: ({ leafValue }: { leafValue: number }) => leafValue * 2 });
  const middle = middleBuilder.replace('middleValue', ({ leafValue }: { leafValue: number }) => leafValue * 3).buildModule(['middleValue']);
  const top = DiBag.createBuilder().installModule(middle).register({ topValue: ({ middleValue }: { middleValue: number }) => middleValue + 100 }).buildModule(['topValue']);
  const host = DiBag.createBuilder().installModule(top).register({ external: () => 1 }).build();
  expect(host.resolve('topValue')).toBe(106);
  const missing = (DiBag.createBuilder().installModule as Function)(top).build();
  expect(() => missing.resolve('topValue')).toThrow('dependency "external" is not registered');
  await host.close(); await missing.close();
});

test('an outer module with no exports still installs nested contributions and nothing else', async () => {
  const groupKey = Symbol('group');
  const group = DiBag.token(groupKey).of<number>();
  const inner = DiBag.createBuilder().register({ hidden: () => 1 }).contribute(group, ({ hidden }: { hidden: number }) => hidden).buildModule(['hidden']);
  const outer = DiBag.createBuilder().installModule(inner).buildModule([]);
  const host = DiBag.createBuilder().installModule(outer).build();
  expect(host.resolveAll(group)).toEqual([1]);
  expect(() => (host.resolve as Function)('hidden')).toThrow('is not registered');
  await host.close();
});

test('startup and child scopes acquire nested exports through the host runtime', async () => {
  const events: string[] = [];
  const inner = DiBag.createBuilder().register({
    resource: DiBag.withDisposal(async () => { events.push('open'); return 'ready'; }, () => { events.push('close'); }),
  }).buildModule(['resource']);
  const outer = DiBag.createBuilder().installModule(inner).register({
    scoped: DiBag.withLifetime(({ resource }: { resource: Promise<string> }) => resource, 'scoped'),
  }).buildModule(['resource', 'scoped']);
  const host = await DiBag.createBuilder().installModule(outer).buildAndStart(['resource']);
  expect(events).toEqual(['open']);
  const child = host.createScope({ share: ['resource'] });
  expect(await child.resolve('scoped')).toBe('ready');
  await child.close();
  await host.close();
  expect(events).toEqual(['open', 'close']);
});

test('sealing rejects unknown keys and forged modules exactly as before', () => {
  const builder = DiBag.createBuilder().register({ a: () => 1 });
  expect(() => (builder.buildModule as Function)(['missing'])).toThrow('existing names or typed tokens only');
  expect(() => (builder.buildModule as Function)('a')).toThrow('key tuple');
  const module = builder.buildModule(['a']);
  expect(() => (DiBag.createBuilder().installModule as Function)({ ...module })).toThrow('genuine module');
  expect(() => (DiBag.createBuilder().register({ a: () => 2 }).installModule as Function)(module)).toThrow('duplicate registration: a');
});
