import { expect, test } from 'bun:test';
import { DiBag } from '../src';

test('module private dependencies follow exported replacements and fresh forks', async () => {
  const events: string[] = [];
  const feature = DiBag.module().add({
    connection: DiBag.withDisposal(() => ({ open: true }), () => { events.push('connection'); }),
    service: ({ connection, logger }: { connection: { open: boolean }; logger: { log(message: string): void } }) =>
      ({ read() { logger.log('read'); return connection.open; }, extra() { return 7; } }),
    privateReader: ({ service }: { service: { read(): boolean; extra(): number } }) => () => service.read(),
    handler: DiBag.withDisposal(({ privateReader }: { privateReader(): boolean }) => privateReader,
      () => { events.push('handler'); }),
  }).exports(['service', 'handler']);
  const builder = DiBag.begin().install(feature).add({
    logger: DiBag.withDisposal(() => ({ log(message: string) { events.push(message); } }), () => { events.push('logger'); }),
  });
  const root = builder.end();
  const child = root.fork(['service'], { service: () => ({ read() { return false; }, extra() { return 8; } }) });
  expect(root.resolve('handler')()).toBe(true);
  expect(child.resolve('handler')()).toBe(false);
  const replaced = builder.replace('service', () => ({ read() { return false; }, extra() { return 9; }, added: true })).end();
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
  const module = DiBag.module().add({
    state: DiBag.withDisposal(() => ({ id: ++next }), state => { events.push(state.id); }),
    read: ({ state }: { state: { id: number } }) => state,
  }).exports(['read']);
  const root = DiBag.begin().install(module.rename('read', 'left')).install(module.rename('read', 'right')).end();
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
  const module = DiBag.module().add({
    privateValue: () => 3,
    publicValue: () => 5,
    read: ({ privateValue, publicValue, external }: { privateValue: number; publicValue: number; external: number }) =>
      [privateValue, publicValue, external],
  }).exports(['publicValue', 'read']).rename('publicValue', 'privateValue');
  expect(module.rename('read', 'read')).toBe(module);
  const root = DiBag.begin().install(module).add({ external: () => 7 }).end();
  const child = root.fork(['privateValue'], { privateValue: () => 11 });
  expect(root.resolve('read')).toEqual([3, 5, 7]);
  expect(child.resolve('read')).toEqual([3, 11, 7]);
  await root.close(); await child.close();
});

test('invalid installations and export views fail atomically and reject forged modules', async () => {
  const module = DiBag.module().add({ a: () => 1, b: () => 2 }).exports(['a', 'b']);
  const builder = DiBag.begin().add({ b: () => 9 });
  expect(() => (builder.install as Function)(module)).toThrow('duplicate registration: b');
  expect(() => (DiBag.begin().install as Function)({ ...module })).toThrow('module');
  expect(() => (module.rename as Function)('a', 'b')).toThrow('duplicate export');
  expect(() => (module.rename as Function)('absent', 'x')).toThrow('existing export');
  const root = builder.install(module.rename('b', 'c')).end();
  expect(root.resolve('a')).toBe(1);
  expect(root.resolve('b')).toBe(9);
  expect(root.resolve('c')).toBe(2);
  await root.close();
});

test('exports use indexed tuple snapshots and preserve hidden local registrations', async () => {
  const all = { publicValue: () => 4, hidden: () => 8 };
  const visible: { publicValue: () => number } = all;
  const builder = DiBag.module().add(visible);
  expect(() => (builder.add as Function)({ hidden: () => 9 })).toThrow('duplicate registration');
  const keys = ['publicValue'] as const;
  Object.defineProperty(keys, Symbol.iterator, { value: function* () { yield 'hidden'; } });
  const root = DiBag.begin().install(builder.exports(keys)).end();
  expect(root.resolve('publicValue')).toBe(4);
  expect(() => (root.resolve as Function)('hidden')).toThrow('no factory');
  expect(() => (builder.exports as Function)(['missing'])).toThrow('existing');
  await root.close();
});

test('module promise identity, retry and post-await cycle diagnostics use the host runtime', async () => {
  let attempts = 0;
  const original = Promise.resolve(42);
  const module = DiBag.module().add({
    identity: () => original,
    retry: async () => { if (++attempts === 1) throw new Error('retry me'); return 7; },
    a: async (deps: { b: Promise<number> }): Promise<number> => { await Promise.resolve(); return deps.b; },
    b: async (deps: { a: Promise<number> }): Promise<number> => { await Promise.resolve(); return deps.a; },
  }).exports(['identity', 'retry', 'a']);
  const root = DiBag.begin().install(module).end();
  expect(root.resolve('identity')).toBe(original);
  await expect(root.resolve('retry')).rejects.toThrow('retry me');
  expect(await root.resolve('retry')).toBe(7);
  await expect(root.resolve('a')).rejects.toThrow('cycle: a -> b -> a');
  await root.close();
});

test('renaming an export leaves an unrelated external requirement at its original slot', async () => {
  const module = DiBag.module().add({
    value: () => 1,
    read: ({ value, external }: { value: number; external: number }) => [value, external],
  }).exports(['value', 'read']).rename('value', 'external').rename('external', 'renamed');
  const root = DiBag.begin().install(module).add({ external: () => 7 }).end();
  expect(root.resolve('read')).toEqual([1, 7]);
  await root.close();
});

test('module providers can be replaced before sealing without mutating earlier views', async () => {
  const builder = DiBag.module().add({ value: () => 1 });
  const original = builder.exports(['value']);
  const changed = builder.replace('value', () => 'changed').exports(['value']).rename('value', 'changed');
  const root = DiBag.begin().install(original).install(changed).end();
  expect(root.resolve('value')).toBe(1);
  expect(root.resolve('changed')).toBe('changed');
  await root.close();
});

test('close drains module acquisitions that discover private and host dependencies after await', async () => {
  const events: string[] = [];
  const feature = DiBag.module().add({
    privateResource: DiBag.withDisposal(async (deps: { external: Promise<number> }) => {
      await Promise.resolve();
      return await deps.external;
    }, () => { events.push('private'); }),
    publicResource: DiBag.withDisposal(async (deps: { privateResource: Promise<number> }) => {
      await Promise.resolve();
      return await deps.privateResource;
    }, () => { events.push('public'); }),
  }).exports(['publicResource']);
  const root = DiBag.begin().install(feature).add({
    external: DiBag.withDisposal(async () => 42, () => { events.push('external'); }),
  }).end();
  const acquired = root.resolve('publicResource');
  const closing = root.close();
  expect(await acquired).toBe(42);
  await closing;
  expect(events).toEqual(['public', 'private', 'external']);
});
