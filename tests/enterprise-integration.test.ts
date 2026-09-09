import { expect, test } from 'bun:test';
import { DiBag, DiBagCleanupError, DiBagStartupError } from '../src/node';
import { withOwnedScope } from '../examples/integration/owned-scope';

test('overlapping requests isolate private dependencies and release scopes before the shared root', async () => {
  const released: string[] = [];
  const signals: AbortSignal[] = [];
  let roots = 0;
  const feature = DiBag.module().add({
    privateSession: DiBag.withDisposal(DiBag.withContext(
      ({ request }: { request: { id: string } }, context) => {
        signals.push(context.signal);
        return { id: request.id };
      },
    ), session => { released.push(session.id); }),
    handler: ({ privateSession, database }: {
      privateSession: { id: string }; database: { serial: number };
    }) => ({ request: privateSession.id, database }),
  }).exports(['handler']);
  const root = DiBag.begin().install(feature).add({
    request: () => ({ id: 'root' }),
    database: DiBag.withLifetime(DiBag.withDisposal(
      () => ({ serial: ++roots }), () => { released.push('database'); },
    ), 'root'),
  }).end();
  let entered = 0;
  let release!: () => void;
  const bothEntered = new Promise<void>(resolve => { release = resolve; });
  const run = (id: string) => withOwnedScope(
    () => root.scope(['request'], { request: () => ({ id }) }),
    async scope => {
      const handler = scope.resolve('handler');
      if (++entered === 2) release();
      await bothEntered;
      expect(signals.every(signal => !signal.aborted)).toBe(true);
      return handler;
    },
  );
  try {
    const [first, second] = await Promise.all([run('first'), run('second')]);
    expect([first.request, second.request]).toEqual(['first', 'second']);
    expect(first.database).toBe(second.database);
    expect(roots).toBe(1);
    expect([...released].sort()).toEqual(['first', 'second']);
    expect(signals.every(signal => signal.aborted)).toBe(true);
  } finally {
    await root.close();
  }
  expect(released).toHaveLength(3);
  expect(released[2]).toBe('database');
});

test('owned-scope fixture preserves handler and cleanup failures without closing twice', async () => {
  const handlerFailure = new Error('handler');
  const cleanupFailure = new Error('cleanup');
  let closes = 0;
  const builder = DiBag.begin().add({
    resource: DiBag.withDisposal(() => 42, () => { closes++; throw cleanupFailure; }),
  });
  const result = await withOwnedScope(() => builder.end(), scope => {
    scope.resolve('resource');
    throw handlerFailure;
  }).catch(error => error);
  expect(result).toBeInstanceOf(AggregateError);
  expect(result.errors[0]).toBe(handlerFailure);
  expect(result.errors[1]).toBeInstanceOf(DiBagCleanupError);
  expect(result.errors[1].failures[0].error).toBe(cleanupFailure);
  expect(closes).toBe(1);
});

test('test substitutions retain private module contracts and fresh transient instances', async () => {
  let created = 0;
  const feature = DiBag.module().add({
    privateRead: ({ clock }: { clock: { now(): number } }) => clock.now(),
    result: ({ privateRead }: { privateRead: number }) => privateRead,
  }).exports(['result']);
  const builder = DiBag.begin().install(feature).add({
    clock: () => ({ now: () => Date.now() }),
    attempt: DiBag.withLifetime(() => ({ id: ++created }), 'transient'),
  });
  await withOwnedScope(() => builder.replace('clock', () => ({ now: () => 7 })).end(), scope => {
    const value: number = scope.resolve('result');
    expect(value).toBe(7);
    expect(scope.resolve('attempt')).not.toBe(scope.resolve('attempt'));
  });
});

test('a dynamically imported module starts private providers and unloads contributions exactly once', async () => {
  const { feature, steps, reset, disposals } = await import('./fixtures/enterprise-feature.ts');
  reset();
  const result = await withOwnedScope(
    () => DiBag.begin().install(feature).start(['handler']),
    scope => {
      expect(scope.resolveAll(steps).map(step => step('x'))).toEqual(['private:x', 'x!']);
      return scope.resolve('handler')('ok');
    },
  );
  expect(result).toBe('private:OK!');
  expect(disposals[0]).toBe('handler');
  expect([...disposals].sort()).toEqual(['handler', 'plugin', 'private']);
});

test('owned-scope fixture preserves a thrown undefined value and cleanup-only failure', async () => {
  let closes = 0;
  let caught = false;
  try {
    await withOwnedScope(() => ({ async close() { closes++; } }), () => { throw undefined; });
  } catch (error) {
    caught = true;
    expect(error).toBeUndefined();
  }
  expect(caught).toBe(true);
  expect(closes).toBe(1);
  const cleanupFailure = new Error('cleanup-only');
  const result = await withOwnedScope(
    () => ({ async close() { throw cleanupFailure; } }), () => 42,
  ).catch(error => error);
  expect(result).toBe(cleanupFailure);
});

test('owned-scope work result types follow explicit awaiting of structural thenables', async () => {
  const thenable: PromiseLike<number> = {
    then: (fulfilled, rejected) => Promise.resolve(42).then(fulfilled, rejected),
  };
  let closed = false;
  const result: Promise<number> = withOwnedScope(
    () => ({ async close() { closed = true; } }), () => thenable,
  );
  await result.then(value => {
    const exact: number = value;
    expect(exact).toBe(42);
    expect(closed).toBe(true);
  });
});

test('a fixture whose startup fails releases acquired resources without admitting work', async () => {
  const failure = new Error('startup');
  let released = 0;
  let work = 0;
  const builder = DiBag.begin().add({
    resource: DiBag.withDisposal(() => ({ ready: true }), () => { released++; }),
    handler: ({ resource }: { resource: { ready: boolean } }) => {
      expect(resource.ready).toBe(true);
      throw failure;
    },
  });
  const result = await withOwnedScope(() => builder.start(['handler']), () => { work++; }).catch(error => error);
  expect(result).toBeInstanceOf(DiBagStartupError);
  expect(result.cause).toBe(failure);
  expect(released).toBe(1);
  expect(work).toBe(0);
});
