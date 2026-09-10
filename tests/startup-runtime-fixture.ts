/** Shared behavioral checks executed from physical packages on Node and Bun. */
export const startupRuntimeAssertions = `{
  const assert = (await import('node:assert/strict')).default;
  const { DiBagStartupError, DiBagStartupCancelledError } = await import('di-bag');
  let lazyCalls = 0;
  const token = DiBag.token(Symbol('startup')).of();
  const feature = DiBag.createModuleBuilder().register({
    hidden: DiBag.fromFactory((_deps, context) => context, { context: 'acquisition' }),
    service: ({ hidden }) => hidden,
  }).buildModule(['service']);
  const started = await DiBag.createBuilder().installModule(feature).register(token, () => 42).register({ lazy: () => ++lazyCalls }).buildAndStart(['service', token]);
  assert.equal(started.resolve(token), 42);
  assert.equal(lazyCalls, 0);
  const context = started.resolve('service');
  assert.equal(Object.isFrozen(context), true);
  const child = started.createScope();
  const childContext = child.resolve('service');
  await child.close();
  assert.equal(childContext.signal.aborted, true);
  assert.equal(context.signal.aborted, false);
  await started.close();
  assert.equal(context.signal.aborted, true);

  let releaseNative;
  const native = new Promise(resolve => { releaseNative = resolve; });
  Object.defineProperty(native, 'then', { value: undefined });
  const raw = new Promise(() => {});
  const rawDisposed = [];
  const starting = DiBag.createBuilder().register({
    native: DiBag.fromFactory((_deps, _context) => native, { context: 'acquisition', ...{ acquisitionMode: 'nativePromise' } }),
    raw: DiBag.withDisposal(DiBag.fromFactory(() => raw, { acquisitionMode: 'raw' }), value => { rawDisposed.push(value); }),
  }).buildAndStart(['native', 'raw']);
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
  const failed = await DiBag.createBuilder().register({
    owned: DiBag.withDisposal(() => 1, () => { throw cleanupError; }),
    fail: () => { throw setupError; },
  }).buildAndStart(['owned', 'fail'], { startupOrder: 'sequential' }).catch(error => error);
  assert.ok(failed instanceof DiBagStartupError);
  assert.equal(failed.cause, setupError);
  assert.equal(failed.cleanupFailures[0].error, cleanupError);

  for (const reason of ['aborted', 'timeout']) {
    const controller = new AbortController();
    let finish;
    let signal;
    const gate = new Promise(resolve => { finish = resolve; });
    const cleanup = [];
    const pending = DiBag.createBuilder().register({
      late: () => 17,
      value: DiBag.withDisposal(DiBag.fromFactory(async (deps, context) => {
        signal = context.signal;
        await gate;
        return deps.late;
      }, { context: 'acquisition' }), value => { cleanup.push(value); }),
    }).buildAndStart(['value'], reason === 'aborted' ? { signal: controller.signal } : { timeoutMs: 5 });
    const outcome = pending.catch(error => error);
    if (reason === 'aborted') controller.abort('stop');
    const cancelled = await outcome;
    assert.ok(cancelled instanceof DiBagStartupCancelledError);
    assert.equal(cancelled.reason, reason);
    assert.equal(signal.aborted, true);
    assert.deepEqual(cleanup, []);
    finish();
    await cancelled.cleanupPromise;
    assert.deepEqual(cleanup, [17]);
  }
}`;
