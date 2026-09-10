/** Shared behavioral checks executed from physical packages on Node and Bun. */
export const startupRuntimeAssertions = `{
  const assert = (await import('node:assert/strict')).default;
  const { DiBagStartupError, DiBagStartupCancelledError } = await import('di-bag');
  let lazyCalls = 0;
  const token = DiBag.token(Symbol('startup')).of();
  const feature = DiBag.module().add({
    hidden: DiBag.withContext((_deps, context) => context),
    service: ({ hidden }) => hidden,
  }).exports(['service']);
  const started = await DiBag.begin().install(feature).bind(token, () => 42)
    .add({ lazy: () => ++lazyCalls }).start(['service', token]);
  assert.equal(started.resolve(token), 42);
  assert.equal(lazyCalls, 0);
  const context = started.resolve('service');
  assert.equal(Object.isFrozen(context), true);
  const child = started.scope();
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
  const starting = DiBag.begin().add({
    native: DiBag.withContext((_deps, _context) => native, { acquisition: 'native' }),
    raw: DiBag.withDisposal(DiBag.factory(() => raw, { acquisition: 'raw' }), value => { rawDisposed.push(value); }),
  }).start(['native', 'raw']);
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
  const failed = await DiBag.begin().add({
    owned: DiBag.withDisposal(() => 1, () => { throw cleanupError; }),
    fail: () => { throw setupError; },
  }).start(['owned', 'fail'], { concurrency: 'sequential' }).catch(error => error);
  assert.ok(failed instanceof DiBagStartupError);
  assert.equal(failed.cause, setupError);
  assert.equal(failed.cleanupFailures[0].error, cleanupError);

  for (const reason of ['aborted', 'timeout']) {
    const controller = new AbortController();
    let finish;
    let signal;
    const gate = new Promise(resolve => { finish = resolve; });
    const cleanup = [];
    const pending = DiBag.begin().add({
      late: () => 17,
      value: DiBag.withDisposal(DiBag.withContext(async (deps, context) => {
        signal = context.signal;
        await gate;
        return deps.late;
      }), value => { cleanup.push(value); }),
    }).start(['value'], reason === 'aborted' ? { signal: controller.signal } : { timeoutMs: 5 });
    const outcome = pending.catch(error => error);
    if (reason === 'aborted') controller.abort('stop');
    const cancelled = await outcome;
    assert.ok(cancelled instanceof DiBagStartupCancelledError);
    assert.equal(cancelled.reason, reason);
    assert.equal(signal.aborted, true);
    assert.deepEqual(cleanup, []);
    finish();
    await cancelled.cleanup;
    assert.deepEqual(cleanup, [17]);
  }

  for (const concurrency of [1, 2]) {
    const gates = Array.from({ length: 3 }, () => {
      let release;
      const promise = new Promise(resolve => { release = resolve; });
      return { promise, release };
    });
    const calls = [], disposed = [];
    const provider = index => DiBag.withDisposal(() => {
      calls.push(index); return gates[index].promise;
    }, value => { disposed.push(value); });
    const pending = DiBag.begin().add({ a: provider(0), b: provider(1), c: provider(2) })
      .start(['a', 'b', 'c'], { concurrency });
    assert.deepEqual(calls, concurrency === 1 ? [0] : [0, 1]);
    gates[0].release(10);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(calls, concurrency === 1 ? [0, 1] : [0, 1, 2]);
    gates[1].release(11); gates[2].release(12);
    const bag = await pending;
    assert.equal(bag.resolve('a'), gates[0].promise);
    await bag.close(); assert.deepEqual(disposed, [12, 11, 10]);
  }
  let invalidCalls = 0;
  const boundedBuilder = DiBag.begin().add({ item: () => ++invalidCalls });
  for (const concurrency of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(boundedBuilder.start(['item'], { concurrency }), /invalid startup concurrency/);
  }
  assert.equal(invalidCalls, 0);
}`;
