import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test';
import { DiBagServiceReadinessCancelledError, DiBagServiceReadinessError } from '../../src';
import { createAppRuntime } from '../../examples/react/app-runtime';
import { createMemoryStorage, createMemoryTransport } from '../../examples/react/fakes';
import { createProjectRuntime } from '../../examples/react/project-runtime';
import { deferred } from '../helpers';

const tick = () => new Promise<void>(resolve => setImmediate(resolve));
const unhandled: unknown[] = [];
const collect = (reason: unknown) => { unhandled.push(reason); };
beforeAll(() => { process.on('unhandledRejection', collect); });
afterAll(() => { process.off('unhandledRejection', collect); });
afterEach(async () => { await tick(); expect(unhandled).toEqual([]); });

// The in-memory adapters are the test configuration; the composition is the one the browser runs.
function fakes(options: Parameters<typeof createMemoryTransport>[0] = {}) {
  return { storage: createMemoryStorage(), transport: createMemoryTransport(options) };
}

test('two project runtimes isolate what they own and share only the borrowed app services', async () => {
  const adapters = fakes();
  const app = await createAppRuntime(adapters);
  const a = await createProjectRuntime(app.services, 'a');
  const b = await createProjectRuntime(app.services, 'b');
  expect(a.services.documents).not.toBe(b.services.documents);
  expect(a.services.name).toBe('Project a');
  expect([...adapters.storage.held].sort()).toEqual(['a', 'b']);
  await a.services.documents.add('first');
  expect(b.services.documents.getSnapshot()).toEqual([]);
  await a.close();
  // Closing a project releases its lock and nothing the app owns.
  expect([...adapters.storage.held]).toEqual(['b']);
  expect(adapters.transport.closes).toBe(0);
  await b.services.documents.add('still works');
  expect(b.services.documents.getSnapshot()).toHaveLength(1);
  await b.close();
  expect(adapters.transport.closes).toBe(0);
  await app.close();
  expect(adapters.transport.closes).toBe(1);
  expect(adapters.storage.events).toEqual(['acquire:a', 'acquire:b', 'release:a', 'release:b']);
});

test('a failing manifest fetch fails startup and releases the lock acquired before it', async () => {
  const adapters = fakes({ failing: ['broken'] });
  const app = await createAppRuntime(adapters);
  const error = await createProjectRuntime(app.services, 'broken').then(() => undefined, (failure: unknown) => failure);
  expect(error).toBeInstanceOf(DiBagServiceReadinessError);
  expect((error as DiBagServiceReadinessError).cause).toBeInstanceOf(Error);
  expect(((error as DiBagServiceReadinessError).cause as Error).message).toBe('no manifest for broken');
  expect((error as DiBagServiceReadinessError).disposalFailures).toEqual([]);
  expect(adapters.storage.events).toEqual(['acquire:broken', 'release:broken']);
  expect(adapters.storage.held.size).toBe(0);
  await app.close();
});

test('a cancelled startup rejects promptly and releases the lock once the fetch settles', async () => {
  const manifest = deferred<void>();
  const adapters = fakes({ manifestGate: id => (id === 'slow' ? manifest.promise : undefined) });
  const app = await createAppRuntime(adapters);
  const controller = new AbortController();
  const starting = createProjectRuntime(app.services, 'slow', { abortSignal: controller.signal });
  await tick();
  expect(adapters.storage.events).toEqual(['acquire:slow']);
  controller.abort();
  const error = await starting.then(() => undefined, (failure: unknown) => failure);
  expect(error).toBeInstanceOf(DiBagServiceReadinessCancelledError);
  // Cooperative: the fetch has not settled, so the lock is still held and cleanup is still pending.
  expect(adapters.storage.held.has('slow')).toBe(true);
  manifest.resolve();
  await (error as DiBagServiceReadinessCancelledError).disposalPromise;
  expect(adapters.storage.events).toEqual(['acquire:slow', 'release:slow']);
  await app.close();
});

test('the same project cannot be opened twice while its lock is held', async () => {
  const adapters = fakes();
  const app = await createAppRuntime(adapters);
  const first = await createProjectRuntime(app.services, 'a');
  const error = await createProjectRuntime(app.services, 'a').then(() => undefined, (failure: unknown) => failure);
  expect(error).toBeInstanceOf(DiBagServiceReadinessError);
  expect(((error as DiBagServiceReadinessError).cause as Error).message).toBe('project a is locked by another runtime');
  await first.services.documents.add('still mine');
  await first.close();
  const second = await createProjectRuntime(app.services, 'a');
  expect(second.services.documents.getSnapshot()).toEqual([{ id: 'a-1', title: 'still mine' }]);
  await second.close();
  await app.close();
  expect(adapters.storage.events).toEqual(['acquire:a', 'release:a', 'acquire:a', 'release:a']);
});

test('the documents store is an external store: stable snapshots, one notification per change', async () => {
  const adapters = fakes();
  const app = await createAppRuntime(adapters);
  const runtime = await createProjectRuntime(app.services, 'a');
  const { documents } = runtime.services;
  const before = documents.getSnapshot();
  expect(documents.getSnapshot()).toBe(before);
  let notified = 0;
  const unsubscribe = documents.subscribe(() => { notified += 1; });
  await documents.add('one');
  expect(notified).toBe(1);
  const after = documents.getSnapshot();
  expect(after).not.toBe(before);
  expect(documents.getSnapshot()).toBe(after);
  unsubscribe();
  await documents.add('two');
  expect(notified).toBe(1);
  expect(documents.getSnapshot()).toHaveLength(2);
  await runtime.close();
  await app.close();
});
