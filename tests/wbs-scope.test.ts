import { expect, test } from 'bun:test';
import { DiBag, DiBagCleanupError } from '../src';
import {
  Collector,
  Source,
  createBatch,
  createRoot,
  runExample,
  stopApplication,
} from '../examples/wbs-scope';

test('WBS scopes borrow infrastructure and recreate stores, collectors and services', async () => {
  const lifecycle: string[] = [];
  const source = new Source(lifecycle);
  const root = createRoot(source, lifecycle, () => 42);
  const a = createBatch(
    root,
    source.stores('a'),
    () => new Collector('a', lifecycle),
  );
  const b = createBatch(
    root,
    source.stores('b'),
    () => new Collector('b', lifecycle),
  );
  try {
    for (const token of ['source', 'clock', 'replayBuffer'] as const) {
      expect(a.resolve(token)).toBe(root.resolve(token));
      expect(b.resolve(token)).toBe(root.resolve(token));
    }
    expect(a.resolve('stores')).not.toBe(b.resolve('stores'));
    expect(a.resolve('workItems')).not.toBe(root.resolve('workItems'));
    expect(a.resolve('workItems')).not.toBe(b.resolve('workItems'));
    expect(a.resolve('broadcast')).not.toBe(b.resolve('broadcast'));

    a.resolve('workItems').rename('first', 'Alpha');
    b.resolve('workItems').rename('second', 'Beta');
    expect(a.resolve('broadcast').snapshot()).toEqual([
      { id: 'first', title: 'Alpha', at: 42, scope: 'a' },
    ]);
    expect(b.resolve('broadcast').snapshot()).toEqual([
      { id: 'second', title: 'Beta', at: 42, scope: 'b' },
    ]);
    expect(root.resolve('replayBuffer').snapshot()).toEqual([]);
    a.resolve('broadcast').flushTo(root.resolve('replayBuffer'));
    await a.close();
    expect(root.resolve('replayBuffer').snapshot()).toEqual([
      { id: 'first', title: 'Alpha', at: 42, scope: 'a' },
    ]);
    expect(b.resolve('broadcast').snapshot()).toHaveLength(1);
    expect(source.stores('reader').get('second')?.title).toBe('Beta');
  } finally {
    await stopApplication(source, root, [a, b]);
  }
  expect(lifecycle).toEqual([
    'source:open',
    'replay:open',
    'collector:a:open',
    'collector:b:open',
    'collector:a:close',
    'collector:b:close',
    'replay:close',
    'source:close',
  ]);
});

test('an explicitly shared WBS service keeps its original stores and broadcaster', async () => {
  const lifecycle: string[] = [];
  const source = new Source(lifecycle);
  const root = createRoot(source, lifecycle, () => 7);
  const batch = createBatch(
    root,
    source.stores('batch'),
    () => new Collector('batch', lifecycle),
  );
  const shared = batch.fork(['workItems'], { workItems: () => root.resolve('workItems') });
  try {
    expect(shared.resolve('workItems')).toBe(root.resolve('workItems'));
    expect(shared.resolve('stores').scope).toBe('batch');
    shared.resolve('workItems').rename('item', 'Root-bound');
    expect(root.resolve('replayBuffer').snapshot()).toEqual([
      { id: 'item', title: 'Root-bound', at: 7, scope: 'root' },
    ]);
    expect(shared.resolve('broadcast').snapshot()).toEqual([]);
  } finally {
    await stopApplication(source, root, [shared, batch]);
  }
});

test('closing the root disposes its resources but leaves the startup-owned source usable', async () => {
  const lifecycle: string[] = [];
  const source = new Source(lifecycle);
  const root = createRoot(source, lifecycle);
  root.resolve('workItems').rename('item', 'Before shutdown');
  await root.close();
  expect(lifecycle).toEqual(['source:open', 'replay:open', 'replay:close']);
  expect(source.stores('reader').get('item')?.title).toBe('Before shutdown');
  source.close();
  expect(() => source.stores('reader').get('item')).toThrow(/closed/);
});

test('startup cleans every owner and discards held announcements when batch work fails', async () => {
  const lifecycle: string[] = [];
  const source = new Source(lifecycle);
  const root = createRoot(source, lifecycle, () => 42);
  const replay = root.resolve('replayBuffer');
  const batch = createBatch(
    root,
    source.stores('failed'),
    () => new Collector('failed', lifecycle),
  );
  const failure = new Error('batch failed');
  const run = async () => {
    try {
      batch.resolve('workItems').rename('item', 'Held announcement');
      expect(replay.snapshot()).toEqual([]);
      throw failure;
    } finally {
      await stopApplication(source, root, [batch]);
    }
  };
  await expect(run()).rejects.toBe(failure);
  expect(lifecycle).toEqual([
    'source:open',
    'replay:open',
    'collector:failed:open',
    'collector:failed:close',
    'replay:close',
    'source:close',
  ]);
});

test('startup still closes later bags and its source when multiple disposers fail', async () => {
  const lifecycle: string[] = [];
  const source = new Source(lifecycle);
  const root = createRoot(source, lifecycle);
  root.resolve('replayBuffer');
  const first = new Error('first cleanup failed');
  const second = new Error('second cleanup failed');
  const failing = (scope: string, error: Error) =>
    root.fork(['broadcast'], {
      broadcast: DiBag.withDisposal(
        () => new Collector(scope, lifecycle),
        (collector) => {
          collector.close();
          throw error;
        },
      ),
    });
  const a = failing('a', first);
  const b = failing('b', second);
  a.resolve('broadcast');
  b.resolve('broadcast');
  const error = await stopApplication(source, root, [a, b]).catch(
    (error) => error as unknown,
  );
  expect(error).toBeInstanceOf(AggregateError);
  if (!(error instanceof AggregateError)) throw new Error('missing application aggregate');
  expect(error.errors).toHaveLength(2);
  const acquisitionIds: symbol[] = [];
  for (const [index, cause] of [first, second].entries()) {
    const scopeFailure: unknown = error.errors[index];
    expect(scopeFailure).toBeInstanceOf(DiBagCleanupError);
    if (!(scopeFailure instanceof DiBagCleanupError)) throw new Error('missing scope aggregate');
    expect(scopeFailure.errors).toEqual([cause]);
    expect(scopeFailure.failures[0]!.error).toBe(cause);
    acquisitionIds.push(scopeFailure.failures[0]!.acquisitionId);
  }
  expect(error.errors[0]).toBe(await a.close().catch(error => error));
  expect(error.errors[1]).toBe(await b.close().catch(error => error));
  expect(acquisitionIds[0]).not.toBe(acquisitionIds[1]);
  expect(lifecycle).toEqual([
    'source:open',
    'replay:open',
    'collector:a:open',
    'collector:b:open',
    'collector:a:close',
    'collector:b:close',
    'replay:close',
    'source:close',
  ]);
});

test('a factory cleans partial acquisition before throwing; the bag does not dispose it twice', async () => {
  const lifecycle: string[] = [];
  const source = new Source(lifecycle);
  const root = createRoot(source, lifecycle);
  root.resolve('replayBuffer');
  const failure = new Error('collector preparation failed');
  const batch = createBatch(root, source.stores('failed'), () => {
    const collector = new Collector('failed', lifecycle);
    try {
      throw failure;
    } catch (error) {
      collector.close();
      throw error;
    }
  });
  expect(() => batch.resolve('workItems')).toThrow(failure);
  await stopApplication(source, root, [batch]);
  expect(lifecycle).toEqual([
    'source:open',
    'replay:open',
    'collector:failed:open',
    'collector:failed:close',
    'replay:close',
    'source:close',
  ]);
});

test('the runnable example reports published work and complete shutdown', async () => {
  expect(await runExample()).toEqual({
    changes: [
      { id: 'one', title: 'Plan milestone', at: 42, scope: 'batch-a' },
      { id: 'two', title: 'Verify ownership', at: 42, scope: 'batch-b' },
    ],
    lifecycle: [
      'source:open',
      'replay:open',
      'collector:batch-a:open',
      'collector:batch-b:open',
      'collector:batch-a:close',
      'collector:batch-b:close',
      'replay:close',
      'source:close',
    ],
  });
});
