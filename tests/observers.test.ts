import { expect, test } from 'bun:test';
import { DiBag, type LifecycleEvent, type ObserverFailure } from '../src';
import { DiBag as NodeDiBag } from '../src/node';

function recording() {
  const events: LifecycleEvent[] = [];
  const failures: ObserverFailure[] = [];
  const observed = DiBag.withConfiguration({ observers: [{ onEvent(event) { events.push(event); }, onError(failure) { failures.push(failure); } }] });
  return { events, failures, observed };
}
const flush = () => new Promise<void>(resolve => queueMicrotask(resolve));

test('observers preserve raw identity and explicit ownership', async () => {
  const { events, failures, observed } = recording();
  const value = Promise.resolve({ id: 1 });
  let disposed = 0;
  const bag = observed.createBuilder().register({
    value: observed.withDisposal(observed.fromFactory(() => value, { acquisitionMode: 'raw' }),
      acquired => { expect(acquired).toBe(value); disposed++; }),
  }).alias('copy', 'value').build();
  expect(bag.resolve('copy')).toBe(value);
  expect(bag.resolve('value')).toBe(value);
  const inspection = bag.inspect('value');
  expect(events).toEqual([]);
  await bag.close();
  await flush();
  expect(disposed).toBe(1);
  expect(failures).toEqual([]);
  expect(events.map(event => event.kind)).toEqual(['scope-opened', 'acquisition-started', 'acquisition-ready', 'scope-closing', 'cleanup-started', 'cleanup-completed', 'scope-closed']);
  const attempts = events.filter(event => event.kind === 'acquisition-started');
  expect(attempts).toHaveLength(1);
  expect(attempts[0]!.bindingId).toBe(inspection.bindingId);
  expect(attempts[0]!.acquisitionId).toBe(inspection.acquisitions[0]!.acquisitionId);
  expect(events.every(Object.isFrozen)).toBe(true);
});

test('ready follows the final native stage while retaining exposed identity', async () => {
  const { events, observed } = recording();
  let sourceReady!: (value: number) => void;
  let finalReady!: (value: number) => void;
  const source = new Promise<number>(resolve => { sourceReady = resolve; });
  const final = new Promise<number>(resolve => { finalReady = resolve; });
  const bag = observed.createBuilder().register({ value: observed.transformService(observed.fromFactory(() => source, { acquisitionMode: 'nativePromise' }), { mode: 'direct', transform: () => final, ...{ acquisitionMode: 'nativePromise' } }) }).build();
  expect(bag.resolve('value')).toBe(final);
  sourceReady(1);
  await flush();
  expect(events.some(event => event.kind === 'acquisition-ready')).toBe(false);
  finalReady(2);
  await final;
  await flush();
  expect(events.filter(event => event.kind === 'acquisition-ready')).toHaveLength(1);
  await bag.close();
});

test('observer failure monitoring handles throws, rejection and throwing then without gating shutdown', async () => {
  const errors = [new Error('throw'), new Error('reject'), new Error('then')];
  const failures: ObserverFailure[] = [];
  const observed = errors.reduce((facade, error, index) => facade.withConfiguration({ observers: [{
    onEvent(event) {
      if (event.kind !== 'scope-opened') return;
      if (index === 0) throw error;
      if (index === 1) return Promise.reject(error);
      return { get then() { throw error; } };
    },
    onError(failure) { failures.push(failure); if (index === 0) throw new Error('sink'); return Promise.reject(new Error('sink')); },
  }] }), DiBag).withConfiguration({ observers: [{ onEvent: () => new Promise(() => {}), onError: () => {} }] });
  const bag = observed.createBuilder().build();
  await bag.close();
  await flush();
  expect(failures).toHaveLength(3);
  for (const error of errors) expect(failures.some(failure => failure.error === error)).toBe(true);
  expect(failures.every(Object.isFrozen)).toBe(true);
  expect(failures.every(failure => failure.event.kind === 'scope-opened')).toBe(true);
});

test('configuration snapshots callbacks, appends in order and retains classification', async () => {
  const seen: string[] = [];
  const callback = function(this: void) { expect(this).toBeUndefined(); seen.push('first'); };
  const options = { onEvent: callback, onError() {} };
  const base = NodeDiBag.withConfiguration({ observers: [options] });
  const builder = base.createBuilder();
  options.onEvent = () => { throw new Error('mutated'); };
  const appended = base.withConfiguration({ observers: [{ onEvent() { seen.push('second'); }, onError() {} }] }).withConfiguration({ runtime: { isNativePromise: value => value instanceof Promise } });
  const a = builder.register({ value: () => 1 }).build();
  const b = appended.createBuilder().register({ value: () => Promise.resolve(2) }).build();
  expect(a.resolve('value')).toBe(1);
  expect(await b.resolve('value')).toBe(2);
  await Promise.all([a.close(), b.close()]);
  expect(seen.slice(0, 5)).toEqual(['first', 'first', 'second', 'first', 'first']);
  expect(Object.isFrozen(base)).toBe(true);
  expect(() => DiBag.withConfiguration({ observers: [{ onEvent() {} } as never] })).toThrow();
  expect(() => DiBag.withConfiguration({ observers: [{ onEvent: 1, onError() {} } as never] })).toThrow();
  expect(() => DiBag.withConfiguration({ observers: [null as never] })).toThrow();
  const { observed, events } = recording();
  expect(() => observed.createBuilder().register({ value: () => 1 }).build()).toThrow('classification');
  await flush();
  expect(events).toEqual([]);
});

test('reentrant observer resolution runs outside factory ancestry and respects published close', async () => {
  let bag!: ReturnType<typeof makeBag>;
  const failures: ObserverFailure[] = [];
  let calls = 0;
  const observed = NodeDiBag.withConfiguration({ observers: [{
    onEvent(event) {
      if (event.kind === 'acquisition-started' && calls === 0) { calls++; expect(bag.resolve('value')).toBe(1); }
      if (event.kind === 'scope-closing') expect(() => bag.resolve('value')).toThrow('closing');
    }, onError(failure) { failures.push(failure); },
  }] });
  function makeBag() { return observed.createBuilder().register({ value: () => 1 }).build(); }
  bag = makeBag();
  bag.resolve('value');
  await flush();
  expect(calls).toBe(1);
  await bag.close();
  expect(failures).toEqual([]);
});

test('canonical owners distinguish shared roots, independent forks, contributions and transients', async () => {
  const { events, observed } = recording();
  const raw = observed.fromFactory(() => ({}), { acquisitionMode: 'raw' });
  const key = Symbol('collection'); const token = observed.token(key).of<object>();
  const bag = observed.createBuilder().register({ root: observed.withLifetime(raw, 'root'), shared: raw, fresh: observed.withLifetime(raw, 'transient') }).alias('copy', 'shared').contribute(token, raw).contribute(token, raw).build();
  const child = bag.createScope({ share: ['copy'] });
  const fork = bag.fork();
  child.resolve('root'); child.resolve('copy'); child.resolve('fresh'); child.resolve('fresh');
  child.resolveAll(token);
  fork.resolve('root');
  const rootInspection = bag.inspect('root'); const sharedInspection = bag.inspect('shared');
  const contributionIds = child.inspectAll(token).map(item => item.acquisitions[0]!.acquisitionId);
  await flush();
  const opened = events.filter(event => event.kind === 'scope-opened');
  const started = events.filter(event => event.kind === 'acquisition-started');
  expect(opened).toHaveLength(3);
  expect(opened[1]!.parentScopeId).toBe(opened[0]!.scopeId);
  expect('parentScopeId' in opened[0]!).toBe(false);
  expect('parentScopeId' in opened[2]!).toBe(false);
  for (const inspection of [rootInspection, sharedInspection]) {
    const event = started.find(event => event.acquisitionId === inspection.acquisitions[0]!.acquisitionId)!;
    expect(event.scopeId).toBe(opened[0]!.scopeId);
    expect(event.bindingId).toBe(inspection.bindingId);
  }
  expect(started.filter(event => event.label === 'fresh')).toHaveLength(2);
  expect(new Set(started.map(event => event.acquisitionId)).size).toBe(7);
  for (const id of contributionIds) expect(started.find(event => event.acquisitionId === id)!.scopeId).toBe(opened[1]!.scopeId);
  await Promise.all([bag.close(), fork.close()]);
  expect(events.some(event => event.kind === 'cleanup-started')).toBe(false);
});

test('failed final projections retire accepted ownership once and preserve cleanup errors', async () => {
  const { events, observed } = recording();
  const acquisitionError = new Error('projection'); const cleanupError = new Error('dispose');
  const disposed: string[] = [];
  const source = observed.withDisposal(observed.fromFactory(() => 1, { acquisitionMode: 'raw' }), () => { disposed.push('first'); throw cleanupError; });
  const second = observed.withDisposal(source, () => { disposed.push('second'); });
  const bag = observed.createBuilder().register({ value: observed.transformService(second, { mode: 'direct', transform: () => { throw acquisitionError; }, ...{ acquisitionMode: 'raw' } }) }).build();
  expect(() => bag.resolve('value')).toThrow(acquisitionError);
  let closeError: unknown;
  try { await bag.close(); } catch (error) { closeError = error; }
  await flush();
  expect(disposed).toEqual(['second', 'first']);
  expect(events.filter(event => event.kind === 'acquisition-failed').map(event => event.error)).toEqual([acquisitionError]);
  expect(events.filter(event => event.kind === 'cleanup-started')).toHaveLength(1);
  expect(events.filter(event => event.kind === 'cleanup-completed').map(event => event.outcome)).toEqual(['failure']);
  const failure = events.find(event => event.kind === 'cleanup-failed')!;
  expect(failure.error).toBe(cleanupError); expect(failure.disposalSequence).toBe(1);
  expect(events.find(event => event.kind === 'scope-close-failed')!.error).toBe(closeError);
});

test('intermediate native failure bypassed by raw projection is not final failure', async () => {
  const { events, observed } = recording();
  const source = Promise.reject(new Error('bypassed'));
  const bag = observed.createBuilder().register({ value: observed.transformService(observed.fromFactory(() => source, { acquisitionMode: 'nativePromise' }), { mode: 'direct', transform: () => 42, ...{ acquisitionMode: 'raw' } }) }).build();
  expect(bag.resolve('value')).toBe(42);
  await bag.close();
  expect(events.filter(event => event.kind === 'acquisition-ready')).toHaveLength(1);
  expect(events.filter(event => event.kind === 'acquisition-failed')).toHaveLength(0);
});

test('private module frames are immutable snapshots without freezing application metadata', async () => {
  const { events, observed } = recording();
  const payload = { owner: 'application' };
  const wrapped = observed.withMetadata(observed.withMetadata(observed.fromFactory(() => 7, { acquisitionMode: 'raw' }), { static: { payload } }), { dynamic: { mode: 'direct', describe: () => ({ payload }) } });
  const feature = observed.createBuilder().register({ secret: wrapped, publicValue: observed.fromFactory(({ secret }: { secret: number }) => secret, { acquisitionMode: 'raw' }) }).buildModule(['publicValue']);
  const bag = observed.createBuilder().installModule(feature).build();
  expect(bag.resolve('publicValue')).toBe(7);
  await flush();
  const started = events.find(event => event.kind === 'acquisition-started' && event.acquisitionMetadata.length)!;
  const ready = events.find(event => event.kind === 'acquisition-ready' && event.acquisitionMetadata.length)!;
  if (!('acquisitionMetadata' in started) || !('acquisitionMetadata' in ready)) throw new Error('missing framed events');
  expect(started.acquisitionMetadata).toEqual([{ present: false }]);
  expect(ready.acquisitionMetadata).toEqual([{ present: true, value: { payload } }]);
  expect(Object.isFrozen(ready.acquisitionMetadata)).toBe(true);
  expect(Object.isFrozen(ready.acquisitionMetadata[0])).toBe(true);
  expect(Object.isFrozen(ready.registrationMetadata)).toBe(true);
  expect(Reflect.get(ready.registrationMetadata, 'payload')).toBe(payload);
  expect(Object.isFrozen(payload)).toBe(false);
  await bag.close();
  expect(ready.acquisitionMetadata).toHaveLength(1);
  expect(started.acquisitionMetadata).toEqual([{ present: false }]);
});

test('startup rollback observes accepted cleanup while preserving the startup cause', async () => {
  const { events, observed } = recording();
  const failure = new Error('startup');
  const builder = observed.createBuilder().register({
    good: observed.withDisposal(observed.fromFactory(() => 1, { acquisitionMode: 'raw' }), () => {}),
    bad: observed.fromFactory(() => Promise.reject(failure), { acquisitionMode: 'nativePromise' }),
  });
  let error: unknown;
  try { await builder.buildAndStart(['good', 'bad']); } catch (caught) { error = caught; }
  await flush();
  expect((error as Error).cause).toBe(failure);
  expect(events.filter(event => event.kind === 'acquisition-failed').map(event => event.error)).toEqual([failure]);
  expect(events.filter(event => event.kind === 'cleanup-completed').map(event => event.outcome)).toEqual(['success']);
  expect(events.filter(event => event.kind === 'scope-closed')).toHaveLength(1);
});

test('cancellation observes late accepted resources and final failure without awaiting telemetry', async () => {
  const { events, observed } = recording();
  const abort = new AbortController();
  const failure = new Error('cancelled');
  let acquired!: (value: number) => void;
  const pending = new Promise<number>(resolve => { acquired = resolve; });
  let disposed = 0;
  const builder = observed.createBuilder().register({
    good: observed.withDisposal(observed.fromFactory(() => pending, { acquisitionMode: 'nativePromise' }), () => { disposed++; }),
    bad: observed.fromFactory((_deps: {}, context) => new Promise<never>((_resolve, reject) => {
      context.signal.addEventListener('abort', () => reject(failure), { once: true });
    }), { context: 'acquisition', ...{ acquisitionMode: 'nativePromise' } }),
  });
  const startup = builder.buildAndStart(['good', 'bad'], { signal: abort.signal });
  abort.abort(failure);
  let cancelled!: import('../src').DiBagStartupCancelledError;
  try { await startup; } catch (error) { cancelled = error as typeof cancelled; }
  acquired(1);
  await cancelled.cleanupPromise;
  await flush();
  expect(disposed).toBe(1);
  expect(events.filter(event => event.kind === 'acquisition-failed').map(event => event.error)).toEqual([failure]);
  expect(events.filter(event => event.kind === 'cleanup-started')).toHaveLength(1);
  expect(events.filter(event => event.kind === 'scope-closing')).toHaveLength(1);
  expect(events.filter(event => event.kind === 'scope-closed')).toHaveLength(1);
});

test('throwing-then error sink results are consumed and appending duplicates keeps every callback', async () => {
  const error = new Error('event'); const sinkError = new Error('sink');
  let seen = 0; let reported = 0;
  const options = { onEvent() { seen++; throw error; }, onError(failure: ObserverFailure) { reported++; expect(failure.error).toBe(error); return { get then() { throw sinkError; } }; } };
  const bag = DiBag.withConfiguration({ observers: [options] }).withConfiguration({ observers: [options] }).createBuilder().build();
  await bag.close();
  await flush();
  expect(seen).toBe(6); expect(reported).toBe(6);
});

test('delivery keeps emission order across immutable appended facade configurations', async () => {
  const seen: LifecycleEvent[] = [];
  const base = DiBag.withConfiguration({ observers: [{ onEvent(event) { seen.push(event); }, onError() {} }] });
  const appended = base.withConfiguration({ observers: [{ onEvent() {}, onError() {} }] });
  const a = base.createBuilder().register({ value: base.fromFactory(() => 1, { acquisitionMode: 'raw' }) }).build();
  const b = appended.createBuilder().build();
  a.resolve('value');
  await flush();
  expect(seen.map(event => event.kind)).toEqual(['scope-opened', 'scope-opened', 'acquisition-started', 'acquisition-ready']);
  await Promise.all([a.close(), b.close()]);
});
