import { expect, test } from 'bun:test';
import { DiBag, DiBagCleanupError } from '../src/node';

function caught(callback: () => unknown): any {
  try { callback(); } catch (error) { return error; }
  throw new Error('expected an error');
}

test('combined metadata retains static descriptions and ordered direct/awaited frames', async () => {
  const value = Promise.resolve({ id: 7 });
  const base = DiBag.fromFactory(() => value, { acquisitionMode: 'raw' });
  const direct = DiBag.withMetadata(base, {
    static: { module: 'billing' },
    dynamic: { mode: 'direct', describe: pending => ({ same: pending === value }) },
  });
  const annotated = DiBag.withMetadata(direct, {
    dynamic: { mode: 'awaited', describe: item => ({ id: item.id, payload: undefined }) },
  });
  const bag = DiBag.createBuilder().register({ direct, annotated }).build();
  expect(bag.inspect('annotated').registrationMetadata).toEqual({ module: 'billing' });
  expect(bag.resolve('direct')).toBe(value);
  expect(await bag.resolve('annotated')).toEqual({ id: 7 });
  expect(bag.inspect('annotated').acquisitions[0]!.acquisitionMetadata).toEqual([
    { present: true, value: { same: true } },
    { present: true, value: { id: 7, payload: undefined } },
  ]);
  await bag.close();
});

test('metadata collisions preflight and asynchronous metadata callbacks reject', async () => {
  const source = DiBag.withMetadata(() => 1, { static: { owner: 'a' } });
  let reads = 0;
  const collision = caught(() => DiBag.withMetadata(source, { static: { get owner() { reads++; return 'b'; } } } as never));
  expect(collision.code).toBe('DI_BAG_DUPLICATE_METADATA');
  expect(Object.isFrozen(collision.details)).toBe(true);
  expect(reads).toBe(0);
  for (const mode of ['direct', 'awaited'] as const) {
    const bad = DiBag.withMetadata(() => 1, { dynamic: { mode, describe: async () => ({ bad: true }) } } as never);
    const bag = DiBag.createBuilder().register({ bad }).build();
    if (mode === 'direct') expect(caught(() => bag.resolve('bad')).code).toBe('DI_BAG_INVALID_METADATA');
    else await expect(bag.resolve('bad')).rejects.toMatchObject({ code: 'DI_BAG_INVALID_METADATA' });
    await bag.close();
  }
});

test('transformService retains earlier ownership and raw output disposal policy', async () => {
  const disposed: unknown[] = [];
  const connection = { id: 9 };
  const pending = Promise.resolve('result');
  const source = DiBag.withDisposal(() => connection, value => { disposed.push(value); });
  const transformed = DiBag.withDisposal(DiBag.transformService(source, {
    mode: 'direct', acquisitionMode: 'raw', transform: value => { expect(value).toBe(connection); return pending; },
  }), value => { disposed.push(value); });
  const bag = DiBag.createBuilder().register({ transformed }).build();
  expect(bag.resolve('transformed')).toBe(pending);
  await bag.close();
  expect(disposed).toEqual([pending, connection]);
});

test('register, acquisition context, modules and immutable observer configuration compose', async () => {
  const order: number[] = [];
  const observer = (id: number) => ({ onEvent: () => { order.push(id); }, onError: () => {} });
  const api = DiBag.withConfiguration({ observers: [observer(1)] }).withConfiguration({ observers: [observer(2)] });
  const configKey = Symbol('config');
  const token = api.token(configKey).of<number>();
  let signal: AbortSignal | undefined;
  const module = api.createModuleBuilder().register({ internal: () => 3 }).buildModule(['internal']).renameExport('internal', 'number');
  const bag = api.createBuilder().register(token, () => 4).installModule(module).register({
    contextual: api.fromFactory(({ number }: { number: number }, context) => { signal = context.signal; return number; }, { context: 'acquisition' }),
  }).build();
  expect(bag.resolve(token)).toBe(4);
  expect(bag.resolve('contextual')).toBe(3);
  const child = bag.createScope();
  await bag.close();
  expect(signal!.aborted).toBe(true);
  expect(caught(() => child.resolve('number')).message).toContain('closed');
  expect(order.length).toBeGreaterThan(0);
  for (let index = 0; index < order.length; index += 2) expect(order.slice(index, index + 2)).toEqual([1, 2]);
});

test('diagnostics count callbacks, retain cycles and preserve application error identity', async () => {
  const applicationError = new Error('application');
  const bad = DiBag.createBuilder().register({ bad: () => { throw applicationError; } }).build();
  expect(caught(() => bad.resolve('bad'))).toBe(applicationError);
  await bad.close();
  const closed = caught(() => bad.resolve('bad'));
  expect(closed).toMatchObject({ code: 'DI_BAG_CLOSED', details: { state: 'closed' } });
  let cycleBag: any;
  cycleBag = DiBag.createBuilder().register({ a: () => cycleBag.resolve('b'), b: () => cycleBag.resolve('a') }).build();
  const cycle = caught(() => cycleBag.resolve('a'));
  expect(cycle.message).toContain('a -> b -> a');
  expect(cycle.details.path).toEqual(['a', 'b', 'a']);
  await cycleBag.close();
  const dispose = () => { throw applicationError; };
  const owned = DiBag.withDisposal(DiBag.withDisposal(() => 1, dispose), dispose);
  const bag = DiBag.createBuilder().register({ owned }).build();
  bag.resolve('owned');
  try { await bag.close(); throw new Error('expected cleanup failure'); }
  catch (error) {
    expect(error).toBeInstanceOf(DiBagCleanupError);
    expect((error as Error).message).toContain('2 disposal callback(s)');
    expect((error as DiBagCleanupError).errors).toEqual([applicationError, applicationError]);
  }
});

test('missing dependency diagnostics identify consumer and complete resolution path', async () => {
  const bag = DiBag.createBuilder().register({ api: ({ db }: { db: unknown }) => db } as never).build();
  const error = caught(() => (bag as any).resolve('api'));
  expect(error.code).toBe('DI_BAG_MISSING_DEPENDENCY');
  expect(error.details).toMatchObject({ consumer: 'api', dependency: 'db', path: ['api', 'db'] });
  expect(Object.isFrozen(error.details.path)).toBe(true);
  await bag.close();
});

test('closed facades distinguish closed from closing across fork and createScope', async () => {
  const bag = DiBag.createBuilder().build();
  const closing = bag.close();
  expect(caught(() => bag.fork())).toMatchObject({ code: 'DI_BAG_CLOSING', details: { state: 'closing' } });
  await closing;
  expect(caught(() => bag.fork())).toMatchObject({ code: 'DI_BAG_CLOSED', details: { state: 'closed' } });
  expect(caught(() => bag.createScope())).toMatchObject({ code: 'DI_BAG_CLOSED', details: { state: 'closed' } });
});

test('metadata rejects inherited top-level options before reading or executing them', () => {
  let reads = 0;
  const options = Object.assign(Object.create({
    get dynamic() { reads++; return { mode: 'invalid', describe: () => ({ invalid: true }) }; },
  }), { static: { tag: 'own' } });
  expect(caught(() => DiBag.withMetadata(() => 1, options))).toMatchObject({ code: 'DI_BAG_INVALID_METADATA' });
  expect(reads).toBe(0);
  const inheritedStatic = Object.assign(Object.create({ static: { tag: 'inherited' } }), {
    dynamic: { mode: 'direct', describe: () => ({}) },
  });
  expect(caught(() => DiBag.withMetadata(() => 1, inheritedStatic))).toMatchObject({ code: 'DI_BAG_INVALID_METADATA' });
});

test('metadata snapshots dynamic mode and callback once before static getters run', async () => {
  let modeReads = 0;
  let callbackReads = 0;
  let optionsReads = 0;
  const dynamic = {
    get mode() { modeReads++; return modeReads === 1 ? 'direct' as const : 'awaited' as const; },
    get describe() { callbackReads++; return (value: number) => ({ value }); },
  };
  const options = {
    get dynamic() { optionsReads++; return dynamic; },
    get static() {
      Object.defineProperty(dynamic, 'describe', { value: () => ({ wrong: true }) });
      return { tag: 'snapshot' };
    },
  };
  // The hostile getter changes modes; its first read is deliberately direct.
  const provider = DiBag.withMetadata(() => 7, options as {
    static: { tag: string };
    dynamic: { mode: 'direct'; describe: (value: number) => { value: number } };
  });
  const bag = DiBag.createBuilder().register({ provider }).build();
  expect(bag.resolve('provider')).toBe(7);
  expect(modeReads).toBe(1);
  expect(callbackReads).toBe(1);
  expect(optionsReads).toBe(1);
  expect(bag.inspect('provider').acquisitions[0]!.acquisitionMetadata).toEqual([{ present: true, value: { value: 7 } }]);
  await bag.close();
});
