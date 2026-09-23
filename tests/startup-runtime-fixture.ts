/** Shared behavioral checks executed from physical packages on Node and Bun. */
export const startupRuntimeAssertions = `{
  const assert = (await import('node:assert/strict')).default;
  const { DiBagServiceReadinessError, DiBagServiceReadinessCancelledError } = await import('di-bag');
  let lazyCalls = 0;
  const token = DiBag.createToken(Symbol('startup')).forService();
  const feature = DiBag.createBuilder().withServices({
    hidden: DiBag.createProvider((_deps, context) => context, { factoryReceivesContext: true }),
    service: ({ hidden }) => hidden,
  }).buildModule({ exportedServiceKeys: ['service'] });
  const started = await DiBag.createBuilder().withInstalledModules([feature]).withTokenService(token, () => 42).withServices({ lazy: () => ++lazyCalls }).buildContainer().ensureServicesReady(['service', token]);
  assert.equal(started.resolve(token), 42);
  assert.equal(lazyCalls, 0);
  const context = started.resolve('service');
  assert.equal(Object.isFrozen(context), true);
  const child = started.createChildContainer();
  const childContext = child.resolve('service');
  await child.close();
  assert.equal(childContext.abortSignal.aborted, true);
  assert.equal(context.abortSignal.aborted, false);
  await started.close();
  assert.equal(context.abortSignal.aborted, true);

  let releaseNative;
  const native = new Promise(resolve => { releaseNative = resolve; });
  Object.defineProperty(native, 'then', { value: undefined });
  const raw = new Promise(() => {});
  const rawDisposed = [];
  const starting = DiBag.createBuilder().withServices({
    native: DiBag.createProvider((_deps, _context) => native, { factoryReceivesContext: true, ...{ factoryReturnKind: 'native-promise' } }),
    raw: DiBag.withDisposal(DiBag.createProvider(() => raw, { factoryReturnKind: 'uninspected' }), value => { rawDisposed.push(value); }),
  }).buildContainer().ensureServicesReady(['native', 'raw']);
  let ready = false;
  void starting.then(() => { ready = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ready, false);
  releaseNative(7);
  const modes = await starting;
  assert.equal(modes.resolve('native'), native);
  await modes.close();
  assert.deepEqual(rawDisposed, [raw]);

  const setupError = new Error('setup');
  const cleanupError = new Error('cleanup');
  const failed = await DiBag.createBuilder().withServices({
    owned: DiBag.withDisposal(() => 1, () => { throw cleanupError; }),
    fail: () => { throw setupError; },
  }).buildContainer().ensureServicesReady(['owned', 'fail'], { maxConcurrentServiceKeys: 1 }).catch(error => error);
  assert.ok(failed instanceof DiBagServiceReadinessError);
  assert.equal(failed.cause, setupError);
  assert.equal(failed.disposalFailures[0].error, cleanupError);

  for (const reason of ['aborted', 'timeout']) {
    const controller = new AbortController();
    let finish;
    let signal;
    const gate = new Promise(resolve => { finish = resolve; });
    const cleanup = [];
    const pending = DiBag.createBuilder().withServices({
      late: () => 17,
      value: DiBag.withDisposal(DiBag.createProvider(async (deps, context) => {
        signal = context.abortSignal;
        await gate;
        return deps.late;
      }, { factoryReceivesContext: true }), value => { cleanup.push(value); }),
    }).buildContainer().ensureServicesReady(['value'], reason === 'aborted' ? { abortSignal: controller.signal } : { totalTimeoutMs: 5 });
    const outcome = pending.catch(error => error);
    if (reason === 'aborted') controller.abort('stop');
    const cancelled = await outcome;
    assert.ok(cancelled instanceof DiBagServiceReadinessCancelledError);
    assert.equal(cancelled.reason, reason);
    assert.equal(signal.aborted, true);
    assert.deepEqual(cleanup, []);
    finish();
    await cancelled.disposalPromise;
    assert.deepEqual(cleanup, [17]);
  }

  for (const startupOrder of [1, 2]) {
    const gates = Array.from({ length: 3 }, () => {
      let release;
      const promise = new Promise(resolve => { release = resolve; });
      return { promise, release };
    });
    const calls = [], disposed = [];
    const provider = index => DiBag.withDisposal(() => {
      calls.push(index); return gates[index].promise;
    }, value => { disposed.push(value); });
    const pending = DiBag.createBuilder().withServices({ a: provider(0), b: provider(1), c: provider(2) })
      .buildContainer().ensureServicesReady(['a', 'b', 'c'], { maxConcurrentServiceKeys: startupOrder });
    assert.deepEqual(calls, startupOrder === 1 ? [0] : [0, 1]);
    gates[0].release(10);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(calls, startupOrder === 1 ? [0, 1] : [0, 1, 2]);
    gates[1].release(11); gates[2].release(12);
    const bag = await pending;
    assert.equal(bag.resolve('a'), gates[0].promise);
    await bag.close(); assert.deepEqual(disposed, [12, 11, 10]);
  }
  let invalidCalls = 0;
  const boundedBuilder = DiBag.createBuilder().withServices({ item: () => ++invalidCalls });
  for (const startupOrder of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(boundedBuilder.buildContainer().ensureServicesReady(['item'], { maxConcurrentServiceKeys: startupOrder }), /ensureServicesReady maxConcurrentServiceKeys must be a positive safe integer/);
  }
  assert.equal(invalidCalls, 0);
}`;
