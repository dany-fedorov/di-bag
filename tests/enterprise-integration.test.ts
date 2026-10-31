import { expect, test } from 'bun:test';
import { DiBag, DiBagDisposalError, DiBagServiceReadinessError } from '../src';
import { withOwnedContainer } from '../examples/integration/owned-container';

test('overlapping requests isolate private dependencies and release containers before the shared root', async () => {
  const released: string[] = [];
  const signals: AbortSignal[] = [];
  let roots = 0;
  const feature = DiBag.createBuilder().withServices({
    privateSession: DiBag.providerWithDisposal({ provider: DiBag.createProvider(({ request }: { request: { id: string } }, context) => {
        signals.push(context.abortSignal);
        return { id: request.id };
      }, { factoryReceivesContext: true }), disposeService: session => { released.push(session.id); } }),
    handler: ({ privateSession, database }: {
      privateSession: { id: string }; database: { serial: number };
    }) => ({ request: privateSession.id, database }),
  }).buildModule({ exportedServiceKeys: ['handler'] });
  const root = DiBag.createBuilder().withInstalledModules([feature]).withServices({
    request: () => ({ id: 'root' }),
    database: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: () => ({ serial: ++roots }), disposeService: () => { released.push('database'); } }), lifetime: 'singleton:one-per-container-tree' }),
  }).buildContainer();
  let entered = 0;
  let release!: () => void;
  const bothEntered = new Promise<void>(resolve => { release = resolve; });
  const run = (id: string) => withOwnedContainer(
    () => root.createChildContainer(['request'], { request: () => ({ id }) }),
    async container => {
      const handler = container.resolve('handler');
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

test('owned-container fixture preserves handler and cleanup failures without closing twice', async () => {
  const handlerFailure = new Error('handler');
  const cleanupFailure = new Error('cleanup');
  let closes = 0;
  const builder = DiBag.createBuilder().withServices({
    resource: DiBag.providerWithDisposal({ provider: () => 42, disposeService: () => { closes++; throw cleanupFailure; } }),
  });
  const result = await withOwnedContainer(() => builder.buildContainer(), container => {
    container.resolve('resource');
    throw handlerFailure;
  }).catch(error => error);
  expect(result).toBeInstanceOf(AggregateError);
  expect(result.errors[0]).toBe(handlerFailure);
  expect(result.errors[1]).toBeInstanceOf(DiBagDisposalError);
  expect(result.errors[1].failures[0].error).toBe(cleanupFailure);
  expect(closes).toBe(1);
});

test('test substitutions retain private module contracts and fresh transient instances', async () => {
  let created = 0;
  const feature = DiBag.createBuilder().withServices({
    privateRead: ({ clock }: { clock: { now(): number } }) => clock.now(),
    result: ({ privateRead }: { privateRead: number }) => privateRead,
  }).buildModule({ exportedServiceKeys: ['result'] });
  const builder = DiBag.createBuilder().withInstalledModules([feature]).withServices({
    clock: () => ({ now: () => Date.now() }),
    attempt: DiBag.providerWithLifetime({ provider: () => ({ id: ++created }), lifetime: 'transient:one-per-resolve' }),
  });
  await withOwnedContainer(() => builder.withReplacedService('clock', () => ({ now: () => 7 })).buildContainer(), container => {
    const value: number = container.resolve('result');
    expect(value).toBe(7);
    expect(container.resolve('attempt')).not.toBe(container.resolve('attempt'));
  });
});

test('an independent test container replaces a private module dependency and both owners close', async () => {
  const feature = DiBag.createBuilder().withServices({
    privateRead: ({ clock }: { clock: { now(): number } }) => clock.now(),
    result: ({ privateRead }: { privateRead: number }) => privateRead,
  }).buildModule({ exportedServiceKeys: ['result'] });
  const original = DiBag.createBuilder().withInstalledModules([feature]).withServices({
    clock: () => ({ now: () => 1000 }),
  }).buildContainer();
  const fixture = original.createIndependentContainer(['clock'], { clock: () => ({ now: () => 7 }) });
  try {
    const value: number = fixture.resolve('result');
    expect(value).toBe(7);
    expect(original.resolve('result')).toBe(1000);
  } finally {
    await fixture.close();
    await original.close();
  }
});

test('a dynamically imported module starts private providers and unloads contributions exactly once', async () => {
  const { feature, steps, reset, disposals } = await import('./fixtures/enterprise-feature.ts');
  reset();
  const result = await withOwnedContainer(
    () => DiBag.createBuilder().withInstalledModules([feature]).buildContainer().ensureServicesReady(['handler']),
    container => {
      expect(container.resolveCollection(steps).map(step => step('x'))).toEqual(['private:x', 'x!']);
      return container.resolve('handler')('ok');
    },
  );
  expect(result).toBe('private:OK!');
  expect(disposals[0]).toBe('handler');
  expect([...disposals].sort()).toEqual(['handler', 'plugin', 'private']);
});

test('owned-container fixture preserves a thrown undefined value and cleanup-only failure', async () => {
  let closes = 0;
  let caught = false;
  try {
    await withOwnedContainer(() => ({ async close() { closes++; } }), () => { throw undefined; });
  } catch (error) {
    caught = true;
    expect(error).toBeUndefined();
  }
  expect(caught).toBe(true);
  expect(closes).toBe(1);
  const cleanupFailure = new Error('cleanup-only');
  const result = await withOwnedContainer(
    () => ({ async close() { throw cleanupFailure; } }), () => 42,
  ).catch(error => error);
  expect(result).toBe(cleanupFailure);
});

test('owned-container work result types follow explicit awaiting of structural thenables', async () => {
  const thenable: PromiseLike<number> = {
    then: (fulfilled, rejected) => Promise.resolve(42).then(fulfilled, rejected),
  };
  let closed = false;
  const result: Promise<number> = withOwnedContainer(
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
  const builder = DiBag.createBuilder().withServices({
    resource: DiBag.providerWithDisposal({ provider: () => ({ ready: true }), disposeService: () => { released++; } }),
    handler: ({ resource }: { resource: { ready: boolean } }) => {
      expect(resource.ready).toBe(true);
      throw failure;
    },
  });
  const result = await withOwnedContainer(() => builder.buildContainer().ensureServicesReady(['handler']), () => { work++; }).catch(error => error);
  expect(result).toBeInstanceOf(DiBagServiceReadinessError);
  expect(result.cause).toBe(failure);
  expect(released).toBe(1);
  expect(work).toBe(0);
});
