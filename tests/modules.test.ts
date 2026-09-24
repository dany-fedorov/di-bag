import { expect, test } from 'bun:test';
import { DiBag } from '../src';

test('a module private retry keeps the caught failed attempt separate', async () => {
  let first = true;
  const valueA = { id: 'a' };
  const valueB = { id: 'b' };
  const events: string[] = [];
  const feature = DiBag.createBuilder().withServices({
    a: DiBag.providerWithDisposal({ provider: (deps: { b: typeof valueB }) => {
      try { void deps.b; } catch {}
      return valueA;
    }, disposeService: value => { events.push(value.id); } }),
    b: DiBag.providerWithDisposal({ provider: (deps: { a: typeof valueA }) => {
      if (first) { first = false; throw new Error('first attempt'); }
      expect(deps.a).toBe(valueA);
      return valueB;
    }, disposeService: value => { events.push(value.id); } }),
    retry: (deps: { b: typeof valueB }) => () => deps.b,
  }).buildModule({ exportedServiceKeys: ['a', 'retry'] });
  const bag = DiBag.createBuilder().withInstalledModules([feature]).buildContainer();
  expect(bag.resolve('a')).toBe(valueA);
  const retry = bag.resolve('retry');
  expect(retry()).toBe(valueB);
  expect(retry()).toBe(valueB);
  expect(bag.resolve('a')).toBe(valueA);
  await bag.close();
  expect(events).toEqual(['b', 'a']);
});

test('module private dependencies follow exported replacements and fresh forks', async () => {
  const events: string[] = [];
  const feature = DiBag.createBuilder().withServices({
    connection: DiBag.providerWithDisposal({ provider: () => ({ open: true }), disposeService: () => { events.push('connection'); } }),
    service: ({ connection, logger }: { connection: { open: boolean }; logger: { log(message: string): void } }) =>
      ({ read() { logger.log('read'); return connection.open; }, extra() { return 7; } }),
    privateReader: ({ service }: { service: { read(): boolean; extra(): number } }) => () => service.read(),
    handler: DiBag.providerWithDisposal({ provider: ({ privateReader }: { privateReader(): boolean }) => privateReader, disposeService: () => { events.push('handler'); } }),
  }).buildModule({ exportedServiceKeys: ['service', 'handler'] });
  const builder = DiBag.createBuilder().withInstalledModules([feature]).withServices({
    logger: DiBag.providerWithDisposal({ provider: () => ({ log(message: string) { events.push(message); } }), disposeService: () => { events.push('logger'); } }),
  });
  const root = builder.buildContainer();
  const child = root.createIndependentContainer(['service'], { service: () => ({ read() { return false; }, extra() { return 8; } }) });
  expect(root.resolve('handler')()).toBe(true);
  expect(child.resolve('handler')()).toBe(false);
  const replaced = builder.withReplacedService('service', () => ({ read() { return false; }, extra() { return 9; }, added: true })).buildContainer();
  expect(replaced.resolve('service').added).toBe(true);
  expect(replaced.resolve('handler')()).toBe(false);
  await child.close();
  await replaced.close();
  await root.close();
  expect(events).toEqual(['read', 'handler', 'handler', 'handler', 'logger', 'connection']);
});

test('renamed repeated installations isolate private instances and cleanup', async () => {
  const events: number[] = [];
  let next = 0;
  const module = DiBag.createBuilder().withServices({
    state: DiBag.providerWithDisposal({ provider: () => ({ id: ++next }), disposeService: state => { events.push(state.id); } }),
    read: ({ state }: { state: { id: number } }) => state,
  }).buildModule({ exportedServiceKeys: ['read'] });
  const root = DiBag.createBuilder().withInstalledModules([module.withRenamedExport({ currentExportKey: 'read', newExportKey: 'left' })]).withInstalledModules([module.withRenamedExport({ currentExportKey: 'read', newExportKey: 'right' })]).buildContainer();
  expect(root.resolve('left')).toEqual({ id: 1 });
  expect(root.resolve('right')).toEqual({ id: 2 });
  expect(root.resolve('left')).not.toBe(root.resolve('right'));
  const child = root.createIndependentContainer();
  expect(child.resolve('left')).toEqual({ id: 3 });
  await root.close();
  expect(events).toEqual([2, 1]);
  await child.close();
  expect(events).toEqual([2, 1, 3]);
});

test('rename preserves original parameter names even when an export takes a private name', async () => {
  const module = DiBag.createBuilder().withServices({
    privateValue: () => 3,
    publicValue: () => 5,
    read: ({ privateValue, publicValue, external }: { privateValue: number; publicValue: number; external: number }) =>
      [privateValue, publicValue, external],
  }).buildModule({ exportedServiceKeys: ['publicValue', 'read'] }).withRenamedExport({ currentExportKey: 'publicValue', newExportKey: 'privateValue' });
  expect(module.withRenamedExport({ currentExportKey: 'read', newExportKey: 'read' })).toBe(module);
  const root = DiBag.createBuilder().withInstalledModules([module]).withServices({ external: () => 7 }).buildContainer();
  const child = root.createIndependentContainer(['privateValue'], { privateValue: () => 11 });
  expect(root.resolve('read')).toEqual([3, 5, 7]);
  expect(child.resolve('read')).toEqual([3, 11, 7]);
  await root.close(); await child.close();
});

test('invalid installations and export views fail atomically and reject forged modules', async () => {
  const module = DiBag.createBuilder().withServices({ a: () => 1, b: () => 2 }).buildModule({ exportedServiceKeys: ['a', 'b'] });
  const builder = DiBag.createBuilder().withServices({ b: () => 9 });
  expect(() => (builder.withInstalledModules as Function)([module])).toThrow('duplicate registration: b');
  expect(() => (DiBag.createBuilder().withInstalledModules as Function)([{ ...module }])).toThrow('module');
  expect(() => (module.withRenamedExport as Function)({ currentExportKey: 'a', newExportKey: 'b' })).toThrow('duplicate export');
  expect(() => (module.withRenamedExport as Function)({ currentExportKey: 'absent', newExportKey: 'x' })).toThrow('existing export');
  const root = builder.withInstalledModules([module.withRenamedExport({ currentExportKey: 'b', newExportKey: 'c' })]).buildContainer();
  expect(root.resolve('a')).toBe(1);
  expect(root.resolve('b')).toBe(9);
  expect(root.resolve('c')).toBe(2);
  await root.close();
});

test('exports use indexed tuple snapshots and preserve hidden local registrations', async () => {
  const all = { publicValue: () => 4, hidden: () => 8 };
  const visible: { publicValue: () => number } = all;
  const builder = DiBag.createBuilder().withServices(visible);
  expect(() => (builder.withServices as Function)({ hidden: () => 9 })).toThrow('duplicate registration');
  const keys = ['publicValue'] as const;
  Object.defineProperty(keys, Symbol.iterator, { value: function* () { yield 'hidden'; } });
  const root = DiBag.createBuilder().withInstalledModules([builder.buildModule({ exportedServiceKeys: keys })]).buildContainer();
  expect(root.resolve('publicValue')).toBe(4);
  expect(() => (root.resolve as Function)('hidden')).toThrow('is not registered');
  expect(() => (builder.buildModule as Function)({ exportedServiceKeys: ['missing'] })).toThrow('existing');
  await root.close();
});

test('module promise identity, retry and post-await cycle diagnostics use the host runtime', async () => {
  let attempts = 0;
  const original = Promise.resolve(42);
  const module = DiBag.createBuilder().withServices({
    identity: () => original,
    retry: async () => { if (++attempts === 1) throw new Error('retry me'); return 7; },
    a: async (deps: { b: Promise<number> }): Promise<number> => { await Promise.resolve(); return deps.b; },
    b: async (deps: { a: Promise<number> }): Promise<number> => { await Promise.resolve(); return deps.a; },
  }).buildModule({ exportedServiceKeys: ['identity', 'retry', 'a'] });
  const root = DiBag.createBuilder().withInstalledModules([module]).buildContainer();
  expect(root.resolve('identity')).toBe(original);
  await expect(root.resolve('retry')).rejects.toThrow('retry me');
  expect(await root.resolve('retry')).toBe(7);
  await expect(root.resolve('a')).rejects.toThrow('cycle: a -> b -> a');
  await root.close();
});

test('renaming an export leaves an unrelated external requirement at its original slot', async () => {
  const module = DiBag.createBuilder().withServices({
    value: () => 1,
    read: ({ value, external }: { value: number; external: number }) => [value, external],
  }).buildModule({ exportedServiceKeys: ['value', 'read'] }).withRenamedExport({ currentExportKey: 'value', newExportKey: 'external' }).withRenamedExport({ currentExportKey: 'external', newExportKey: 'renamed' });
  const root = DiBag.createBuilder().withInstalledModules([module]).withServices({ external: () => 7 }).buildContainer();
  expect(root.resolve('read')).toEqual([1, 7]);
  await root.close();
});

test('module providers can be replaced before sealing without mutating earlier views', async () => {
  const builder = DiBag.createBuilder().withServices({ value: () => 1 });
  const original = builder.buildModule({ exportedServiceKeys: ['value'] });
  const changed = builder.withReplacedService('value', () => 'changed').buildModule({ exportedServiceKeys: ['value'] }).withRenamedExport({ currentExportKey: 'value', newExportKey: 'changed' });
  const root = DiBag.createBuilder().withInstalledModules([original]).withInstalledModules([changed]).buildContainer();
  expect(root.resolve('value')).toBe(1);
  expect(root.resolve('changed')).toBe('changed');
  await root.close();
});

test('close drains module acquisitions that discover private and host dependencies after await', async () => {
  const events: string[] = [];
  const feature = DiBag.createBuilder().withServices({
    privateResource: DiBag.providerWithDisposal({ provider: async (deps: { external: Promise<number> }) => {
      await Promise.resolve();
      return await deps.external;
    }, disposeService: () => { events.push('private'); } }),
    publicResource: DiBag.providerWithDisposal({ provider: async (deps: { privateResource: Promise<number> }) => {
      await Promise.resolve();
      return await deps.privateResource;
    }, disposeService: () => { events.push('public'); } }),
  }).buildModule({ exportedServiceKeys: ['publicResource'] });
  const root = DiBag.createBuilder().withInstalledModules([feature]).withServices({
    external: DiBag.providerWithDisposal({ provider: async () => 42, disposeService: () => { events.push('external'); } }),
  }).buildContainer();
  const acquired = root.resolve('publicResource');
  const closing = root.close();
  expect(await acquired).toBe(42);
  await closing;
  expect(events).toEqual(['public', 'private', 'external']);
});
