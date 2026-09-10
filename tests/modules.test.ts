import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';

test('a module private retry keeps the caught failed attempt separate', async () => {
  let first = true;
  const valueA = { id: 'a' };
  const valueB = { id: 'b' };
  const events: string[] = [];
  const feature = DiBag.createBuilder().register({
    a: DiBag.withDisposal((deps: { b: typeof valueB }) => {
      try { void deps.b; } catch {}
      return valueA;
    }, value => { events.push(value.id); }),
    b: DiBag.withDisposal((deps: { a: typeof valueA }) => {
      if (first) { first = false; throw new Error('first attempt'); }
      expect(deps.a).toBe(valueA);
      return valueB;
    }, value => { events.push(value.id); }),
    retry: (deps: { b: typeof valueB }) => () => deps.b,
  }).buildModule(['a', 'retry']);
  const bag = DiBag.createBuilder().installModule(feature).build();
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
  const feature = DiBag.createBuilder().register({
    connection: DiBag.withDisposal(() => ({ open: true }), () => { events.push('connection'); }),
    service: ({ connection, logger }: { connection: { open: boolean }; logger: { log(message: string): void } }) =>
      ({ read() { logger.log('read'); return connection.open; }, extra() { return 7; } }),
    privateReader: ({ service }: { service: { read(): boolean; extra(): number } }) => () => service.read(),
    handler: DiBag.withDisposal(({ privateReader }: { privateReader(): boolean }) => privateReader,
      () => { events.push('handler'); }),
  }).buildModule(['service', 'handler']);
  const builder = DiBag.createBuilder().installModule(feature).register({
    logger: DiBag.withDisposal(() => ({ log(message: string) { events.push(message); } }), () => { events.push('logger'); }),
  });
  const root = builder.build();
  const child = root.fork(['service'], { service: () => ({ read() { return false; }, extra() { return 8; } }) });
  expect(root.resolve('handler')()).toBe(true);
  expect(child.resolve('handler')()).toBe(false);
  const replaced = builder.replace('service', () => ({ read() { return false; }, extra() { return 9; }, added: true })).build();
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
  const module = DiBag.createBuilder().register({
    state: DiBag.withDisposal(() => ({ id: ++next }), state => { events.push(state.id); }),
    read: ({ state }: { state: { id: number } }) => state,
  }).buildModule(['read']);
  const root = DiBag.createBuilder().installModule(module.renameExport('read', 'left')).installModule(module.renameExport('read', 'right')).build();
  expect(root.resolve('left')).toEqual({ id: 1 });
  expect(root.resolve('right')).toEqual({ id: 2 });
  expect(root.resolve('left')).not.toBe(root.resolve('right'));
  const child = root.fork();
  expect(child.resolve('left')).toEqual({ id: 3 });
  await root.close();
  expect(events).toEqual([2, 1]);
  await child.close();
  expect(events).toEqual([2, 1, 3]);
});

test('rename preserves original parameter names even when an export takes a private name', async () => {
  const module = DiBag.createBuilder().register({
    privateValue: () => 3,
    publicValue: () => 5,
    read: ({ privateValue, publicValue, external }: { privateValue: number; publicValue: number; external: number }) =>
      [privateValue, publicValue, external],
  }).buildModule(['publicValue', 'read']).renameExport('publicValue', 'privateValue');
  expect(module.renameExport('read', 'read')).toBe(module);
  const root = DiBag.createBuilder().installModule(module).register({ external: () => 7 }).build();
  const child = root.fork(['privateValue'], { privateValue: () => 11 });
  expect(root.resolve('read')).toEqual([3, 5, 7]);
  expect(child.resolve('read')).toEqual([3, 11, 7]);
  await root.close(); await child.close();
});

test('invalid installations and export views fail atomically and reject forged modules', async () => {
  const module = DiBag.createBuilder().register({ a: () => 1, b: () => 2 }).buildModule(['a', 'b']);
  const builder = DiBag.createBuilder().register({ b: () => 9 });
  expect(() => (builder.installModule as Function)(module)).toThrow('duplicate registration: b');
  expect(() => (DiBag.createBuilder().installModule as Function)({ ...module })).toThrow('module');
  expect(() => (module.renameExport as Function)('a', 'b')).toThrow('duplicate export');
  expect(() => (module.renameExport as Function)('absent', 'x')).toThrow('existing export');
  const root = builder.installModule(module.renameExport('b', 'c')).build();
  expect(root.resolve('a')).toBe(1);
  expect(root.resolve('b')).toBe(9);
  expect(root.resolve('c')).toBe(2);
  await root.close();
});

test('exports use indexed tuple snapshots and preserve hidden local registrations', async () => {
  const all = { publicValue: () => 4, hidden: () => 8 };
  const visible: { publicValue: () => number } = all;
  const builder = DiBag.createBuilder().register(visible);
  expect(() => (builder.register as Function)({ hidden: () => 9 })).toThrow('duplicate registration');
  const keys = ['publicValue'] as const;
  Object.defineProperty(keys, Symbol.iterator, { value: function* () { yield 'hidden'; } });
  const root = DiBag.createBuilder().installModule(builder.buildModule(keys)).build();
  expect(root.resolve('publicValue')).toBe(4);
  expect(() => (root.resolve as Function)('hidden')).toThrow('is not registered');
  expect(() => (builder.buildModule as Function)(['missing'])).toThrow('existing');
  await root.close();
});

test('module promise identity, retry and post-await cycle diagnostics use the host runtime', async () => {
  let attempts = 0;
  const original = Promise.resolve(42);
  const module = DiBag.createBuilder().register({
    identity: () => original,
    retry: async () => { if (++attempts === 1) throw new Error('retry me'); return 7; },
    a: async (deps: { b: Promise<number> }): Promise<number> => { await Promise.resolve(); return deps.b; },
    b: async (deps: { a: Promise<number> }): Promise<number> => { await Promise.resolve(); return deps.a; },
  }).buildModule(['identity', 'retry', 'a']);
  const root = DiBag.createBuilder().installModule(module).build();
  expect(root.resolve('identity')).toBe(original);
  await expect(root.resolve('retry')).rejects.toThrow('retry me');
  expect(await root.resolve('retry')).toBe(7);
  await expect(root.resolve('a')).rejects.toThrow('cycle: a -> b -> a');
  await root.close();
});

test('renaming an export leaves an unrelated external requirement at its original slot', async () => {
  const module = DiBag.createBuilder().register({
    value: () => 1,
    read: ({ value, external }: { value: number; external: number }) => [value, external],
  }).buildModule(['value', 'read']).renameExport('value', 'external').renameExport('external', 'renamed');
  const root = DiBag.createBuilder().installModule(module).register({ external: () => 7 }).build();
  expect(root.resolve('read')).toEqual([1, 7]);
  await root.close();
});

test('module providers can be replaced before sealing without mutating earlier views', async () => {
  const builder = DiBag.createBuilder().register({ value: () => 1 });
  const original = builder.buildModule(['value']);
  const changed = builder.replace('value', () => 'changed').buildModule(['value']).renameExport('value', 'changed');
  const root = DiBag.createBuilder().installModule(original).installModule(changed).build();
  expect(root.resolve('value')).toBe(1);
  expect(root.resolve('changed')).toBe('changed');
  await root.close();
});

test('close drains module acquisitions that discover private and host dependencies after await', async () => {
  const events: string[] = [];
  const feature = DiBag.createBuilder().register({
    privateResource: DiBag.withDisposal(async (deps: { external: Promise<number> }) => {
      await Promise.resolve();
      return await deps.external;
    }, () => { events.push('private'); }),
    publicResource: DiBag.withDisposal(async (deps: { privateResource: Promise<number> }) => {
      await Promise.resolve();
      return await deps.privateResource;
    }, () => { events.push('public'); }),
  }).buildModule(['publicResource']);
  const root = DiBag.createBuilder().installModule(feature).register({
    external: DiBag.withDisposal(async () => 42, () => { events.push('external'); }),
  }).build();
  const acquired = root.resolve('publicResource');
  const closing = root.close();
  expect(await acquired).toBe(42);
  await closing;
  expect(events).toEqual(['public', 'private', 'external']);
});
