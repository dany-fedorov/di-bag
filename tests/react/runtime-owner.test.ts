import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test';
import { DiBag, DiBagDisposalError, DiBagServiceReadinessError, type CloseOptions } from '../../src';
import { RuntimeOwner, type OwnerFailure } from '../../examples/react/runtime-owner';
import { deferred } from '../helpers';

const tick = () => new Promise<void>(resolve => setImmediate(resolve));
async function settle(): Promise<void> { for (let round = 0; round < 5; round++) await tick(); }
const unhandled: unknown[] = [];
const collect = (reason: unknown) => { unhandled.push(reason); };
beforeAll(() => { process.on('unhandledRejection', collect); });
afterAll(() => { process.off('unhandledRejection', collect); });
afterEach(async () => { await settle(); expect(unhandled).toEqual([]); });

type FakeRuntime = { readonly identity: string; close(options?: CloseOptions): Promise<void> };

type Fakes = {
  readonly log: string[];
  /** Hold a startup open per identity; an identity without a gate is ready at once. */
  readonly readyGate?: (identity: string) => Promise<void> | undefined;
  readonly disposeGate?: (identity: string) => Promise<void> | undefined;
  readonly failing?: string[];
  readonly disposeFailing?: readonly string[];
  /** Exclusive: acquiring an identity already in the set throws. */
  readonly lock?: Set<string>;
};

/** A real bag per startup: ensureServicesReady supplies cancellation and rollback; only the factories are fake. */
function fakeStart(fakes: Fakes) {
  return async (identity: string, signal: AbortSignal): Promise<FakeRuntime> => {
    fakes.log.push(`start:${identity}`);
    const bag = await DiBag.createBuilder().withServices({
      resource: DiBag.providerWithDisposal({ provider: DiBag.createProvider(async () => {
          if (fakes.lock?.has(identity)) throw new Error(`${identity} is held`);
          fakes.lock?.add(identity);
          fakes.log.push(`acquire:${identity}`);
          await fakes.readyGate?.(identity);
          return identity;
        }, { factoryReturnKind: 'native-promise' }), disposeService: async value => {
          fakes.log.push(`dispose:${value}`);
          await fakes.disposeGate?.(value);
          fakes.lock?.delete(value);
          if (fakes.disposeFailing?.includes(value)) throw new Error(`${value} dispose failed`);
        } }),
      // Fails after `resource` is owned, so a failed startup has something to roll back.
      checkpoint: DiBag.createProvider(async ({ resource }: { resource: Promise<string> }) => {
        await resource;
        if (fakes.failing?.includes(identity)) throw new Error(`${identity} failed`);
        return true;
      }, { factoryReturnKind: 'native-promise' }),
    }).buildContainer().ensureServicesReady(['resource', 'checkpoint'], { abortSignal: signal });
    fakes.log.push(`ready:${identity}`);
    return { identity, close: options => bag.close(options) };
  };
}

function createOwner(fakes: Fakes, options: { closeTimeoutMs?: number } = {}) {
  const failures: OwnerFailure[] = [];
  const statuses: string[] = [];
  const owner = new RuntimeOwner<FakeRuntime>({ start: fakeStart(fakes), onFailure: failure => { failures.push(failure); }, ...options });
  owner.subscribe(() => {
    const status = owner.getSnapshot();
    statuses.push('identity' in status ? `${status.state}:${status.identity}#${status.generation}` : status.state);
  });
  return { owner, failures, statuses };
}

test('select starts a runtime, ready publishes it, and release closes it', async () => {
  const fakes: Fakes = { log: [] };
  const { owner, statuses, failures } = createOwner(fakes);
  expect(owner.getSnapshot()).toEqual({ state: 'idle' });
  const selection = owner.select('a');
  expect(owner.getSnapshot()).toEqual({ state: 'starting', identity: 'a', generation: 1 });
  await settle();
  const ready = owner.getSnapshot();
  expect(ready).toMatchObject({ state: 'ready', identity: 'a', generation: 1 });
  expect(owner.getSnapshot()).toBe(ready);
  expect(Object.isFrozen(ready)).toBe(true);
  selection.release();
  expect(owner.getSnapshot()).toEqual({ state: 'idle' });
  await owner.settled();
  expect(fakes.log).toEqual(['start:a', 'acquire:a', 'ready:a', 'dispose:a']);
  expect(statuses).toEqual(['starting:a#1', 'ready:a#1', 'idle']);
  expect(failures).toEqual([]);
});

test('Strict Mode setup-cleanup-setup ends with a fresh generation 2 and never starts generation 1', async () => {
  const fakes: Fakes = { log: [] };
  const { owner, statuses } = createOwner(fakes);
  const first = owner.select('a');
  first.release();
  const second = owner.select('a');
  await settle();
  expect(owner.getSnapshot()).toMatchObject({ state: 'ready', identity: 'a', generation: 2 });
  expect(fakes.log).toEqual(['start:a', 'acquire:a', 'ready:a']);
  first.release();
  expect(owner.getSnapshot()).toMatchObject({ state: 'ready', generation: 2 });
  second.release();
  await owner.settled();
  expect(fakes.log).toEqual(['start:a', 'acquire:a', 'ready:a', 'dispose:a']);
  expect(statuses).toEqual(['starting:a#1', 'idle', 'starting:a#2', 'ready:a#2', 'idle']);
});

test('a release during startup cancels it and releases what the startup had acquired', async () => {
  const ready = deferred<void>();
  const fakes: Fakes = { log: [], readyGate: () => ready.promise };
  const { owner, statuses, failures } = createOwner(fakes);
  const selection = owner.select('a');
  await settle();
  expect(fakes.log).toEqual(['start:a', 'acquire:a']);
  selection.release();
  expect(owner.getSnapshot()).toEqual({ state: 'idle' });
  ready.resolve();
  await owner.settled();
  expect(fakes.log).toEqual(['start:a', 'acquire:a', 'dispose:a']);
  expect(statuses).not.toContain('ready:a#1');
  expect(failures).toEqual([]);
});

test('a startup finishing after its identity was replaced is never published and is released first', async () => {
  const gates = { a: deferred<void>(), b: deferred<void>() };
  const fakes: Fakes = { log: [], readyGate: identity => gates[identity as 'a' | 'b'].promise };
  const { owner, statuses } = createOwner(fakes);
  owner.select('a');
  await settle();
  owner.select('b');
  expect(owner.getSnapshot()).toEqual({ state: 'starting', identity: 'b', generation: 2 });
  await settle();
  expect(fakes.log).toEqual(['start:a', 'acquire:a']);
  gates.a.resolve();
  await settle();
  expect(fakes.log).toEqual(['start:a', 'acquire:a', 'dispose:a', 'start:b', 'acquire:b']);
  gates.b.resolve();
  await settle();
  expect(owner.getSnapshot()).toMatchObject({ state: 'ready', identity: 'b', generation: 2 });
  expect(statuses).not.toContain('ready:a#1');
  await owner.close();
});

test('a start that ignores its signal delays the replacement only until the bounded wait expires', async () => {
  const log: string[] = [];
  const failures: OwnerFailure[] = [];
  const late = deferred<FakeRuntime>();
  const owner = new RuntimeOwner<FakeRuntime>({
    start: identity => (identity === 'a' ? late.promise : Promise.resolve({ identity, close: async () => { log.push(`close:${identity}`); } })),
    onFailure: failure => { failures.push(failure); },
    closeTimeoutMs: 5,
  });
  owner.select('a');
  await settle();
  owner.select('b');
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(failures).toEqual([{ phase: 'close-wait-expired', identity: 'a', generation: 1, timeoutMs: 5 }]);
  expect(owner.getSnapshot()).toMatchObject({ state: 'ready', identity: 'b', generation: 2 });
  late.resolve({ identity: 'a', close: async () => { log.push('close:a'); } });
  await settle();
  expect(log).toEqual(['close:a']);
  expect(owner.getSnapshot()).toMatchObject({ state: 'ready', identity: 'b' });
  await owner.close();
  expect(log).toEqual(['close:a', 'close:b']);
});

test('a failed startup publishes the error after ensureServicesReady released what it acquired', async () => {
  const fakes: Fakes = { log: [], failing: ['a'] };
  const { owner } = createOwner(fakes);
  owner.select('a');
  await settle();
  const status = owner.getSnapshot();
  expect(status).toMatchObject({ state: 'failed', identity: 'a', generation: 1 });
  expect((status as { error: unknown }).error).toBeInstanceOf(DiBagServiceReadinessError);
  expect(fakes.log).toEqual(['start:a', 'acquire:a', 'dispose:a']);
  owner.retry();
  await settle();
  expect(owner.getSnapshot()).toMatchObject({ state: 'failed', generation: 2 });
  expect(fakes.log).toEqual(['start:a', 'acquire:a', 'dispose:a', 'start:a', 'acquire:a', 'dispose:a']);
});

test('retry starts the live identity again and the original selection still releases it', async () => {
  const failing = ['a'];
  const fakes: Fakes = { log: [], failing };
  const { owner } = createOwner(fakes);
  const selection = owner.select('a');
  await settle();
  expect(owner.getSnapshot()).toMatchObject({ state: 'failed', generation: 1 });
  failing.length = 0;
  owner.retry();
  await settle();
  expect(owner.getSnapshot()).toMatchObject({ state: 'ready', identity: 'a', generation: 2 });
  selection.release();
  await owner.settled();
  expect(fakes.log.at(-1)).toBe('dispose:a');
  expect(owner.getSnapshot()).toEqual({ state: 'idle' });
});

test('a rejecting disposer reaches the sink and the replacement still starts', async () => {
  const fakes: Fakes = { log: [], disposeFailing: ['a'] };
  const { owner, failures } = createOwner(fakes);
  owner.select('a');
  await settle();
  owner.select('b');
  await settle();
  expect(failures).toHaveLength(1);
  expect(failures[0]).toMatchObject({ phase: 'close-failed', identity: 'a', generation: 1 });
  expect((failures[0] as { error: unknown }).error).toBeInstanceOf(DiBagDisposalError);
  expect(owner.getSnapshot()).toMatchObject({ state: 'ready', identity: 'b', generation: 2 });
  expect(fakes.log).toEqual(['start:a', 'acquire:a', 'ready:a', 'dispose:a', 'start:b', 'acquire:b', 'ready:b']);
  await owner.close();
});

test('without a deadline a replacement waits for the exclusive resource to be released', async () => {
  const disposing = deferred<void>();
  const fakes: Fakes = { log: [], disposeGate: () => disposing.promise, lock: new Set() };
  const { owner, failures } = createOwner(fakes);
  const first = owner.select('a');
  await settle();
  first.release();
  owner.select('a');
  await settle();
  expect(fakes.log).toEqual(['start:a', 'acquire:a', 'ready:a', 'dispose:a']);
  expect(owner.getSnapshot()).toEqual({ state: 'starting', identity: 'a', generation: 2 });
  disposing.resolve();
  await settle();
  expect(fakes.log).toEqual(['start:a', 'acquire:a', 'ready:a', 'dispose:a', 'start:a', 'acquire:a', 'ready:a']);
  expect(owner.getSnapshot()).toMatchObject({ state: 'ready', identity: 'a', generation: 2 });
  expect(failures).toEqual([]);
  await owner.close();
});

test('an expired bounded wait is reported, the replacement proceeds, and the late teardown still reports', async () => {
  const disposing = deferred<void>();
  const fakes: Fakes = { log: [], disposeGate: () => disposing.promise, disposeFailing: ['a'], lock: new Set() };
  const { owner, failures } = createOwner(fakes, { closeTimeoutMs: 5 });
  const first = owner.select('a');
  await settle();
  first.release();
  owner.select('a');
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(failures).toEqual([{ phase: 'close-wait-expired', identity: 'a', generation: 1, timeoutMs: 5 }]);
  // The documented overlap policy: the replacement started while 'a' was still held, so its startup failed visibly.
  const status = owner.getSnapshot();
  expect(status).toMatchObject({ state: 'failed', identity: 'a', generation: 2 });
  expect((((status as { error: unknown }).error as DiBagServiceReadinessError).cause as Error).message).toBe('a is held');
  expect(fakes.log).toEqual(['start:a', 'acquire:a', 'ready:a', 'dispose:a', 'start:a']);
  disposing.resolve();
  await settle();
  expect(failures).toHaveLength(2);
  expect(failures[1]).toMatchObject({ phase: 'close-failed', identity: 'a', generation: 1 });
  owner.retry();
  await settle();
  expect(owner.getSnapshot()).toMatchObject({ state: 'ready', identity: 'a', generation: 3 });
  await owner.close();
  expect(failures.map(failure => failure.phase)).toEqual(['close-wait-expired', 'close-failed', 'close-failed']);
});

test('selecting the current identity again keeps the runtime and only the newest selection releases it', async () => {
  const fakes: Fakes = { log: [] };
  const { owner } = createOwner(fakes);
  const first = owner.select('a');
  await settle();
  const second = owner.select('a');
  expect(owner.getSnapshot()).toMatchObject({ state: 'ready', generation: 1 });
  first.release();
  expect(owner.getSnapshot()).toMatchObject({ state: 'ready', generation: 1 });
  second.release();
  expect(owner.getSnapshot()).toEqual({ state: 'idle' });
  await owner.settled();
  expect(fakes.log).toEqual(['start:a', 'acquire:a', 'ready:a', 'dispose:a']);
});

test('close retires the runtime, waits for it, and refuses later selections', async () => {
  const fakes: Fakes = { log: [] };
  const { owner, statuses } = createOwner(fakes);
  owner.select('a');
  await settle();
  await owner.close();
  expect(fakes.log).toEqual(['start:a', 'acquire:a', 'ready:a', 'dispose:a']);
  expect(owner.getSnapshot()).toEqual({ state: 'closed' });
  expect(() => owner.select('b')).toThrow('runtime owner is closed');
  expect(statuses).toEqual(['starting:a#1', 'ready:a#1', 'closed']);
});

test('unsubscribe stops notifications', async () => {
  const { owner } = createOwner({ log: [] });
  let calls = 0;
  const unsubscribe = owner.subscribe(() => { calls += 1; });
  const selection = owner.select('a');
  expect(calls).toBe(1);
  await settle();
  expect(calls).toBe(2);
  unsubscribe();
  selection.release();
  expect(calls).toBe(2);
  await owner.settled();
});
