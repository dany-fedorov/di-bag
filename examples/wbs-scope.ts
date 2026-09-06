import { DiBag } from '../src';

export type Change = Readonly<{
  id: string;
  title: string;
  at: number;
  scope: string;
}>;

interface Stores {
  readonly scope: string;
  save(change: Change): void;
  get(id: string): Change | undefined;
}

interface Broadcaster {
  publish(change: Change): void;
}

// One application-owned backing store, with different scope-bound adapters.
// These adapters demonstrate dependency binding, not database transactions.
export class Source {
  private readonly records = new Map<string, Change>();
  private closed = false;

  constructor(private readonly lifecycle: string[]) {
    lifecycle.push('source:open');
  }

  stores(scope: string): Stores {
    this.assertOpen();
    return {
      scope,
      save: (change) => {
        this.assertOpen();
        this.records.set(change.id, change);
      },
      get: (id) => {
        this.assertOpen();
        return this.records.get(id);
      },
    };
  }

  close(): void {
    this.assertOpen();
    this.closed = true;
    this.records.clear();
    this.lifecycle.push('source:close');
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('source is closed');
  }
}

class ReplayBuffer implements Broadcaster {
  private readonly changes: Change[] = [];
  private closed = false;

  constructor(private readonly lifecycle: string[]) {
    lifecycle.push('replay:open');
  }

  publish(change: Change): void {
    this.assertOpen();
    this.changes.push(change);
  }

  snapshot(): readonly Change[] {
    this.assertOpen();
    return this.changes.slice();
  }

  close(): void {
    this.assertOpen();
    this.closed = true;
    this.changes.length = 0;
    this.lifecycle.push('replay:close');
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('replay buffer is closed');
  }
}

// A batch collects announcements until application code decides to publish.
export class Collector implements Broadcaster {
  private readonly pending: Change[] = [];
  private closed = false;

  constructor(
    private readonly scope: string,
    private readonly lifecycle: string[],
  ) {
    lifecycle.push(`collector:${scope}:open`);
  }

  publish(change: Change): void {
    this.assertOpen();
    this.pending.push(change);
  }

  snapshot(): readonly Change[] {
    this.assertOpen();
    return this.pending.slice();
  }

  flushTo(target: Broadcaster): void {
    this.assertOpen();
    for (const change of this.pending) target.publish(change);
    this.pending.length = 0;
  }

  close(): void {
    this.assertOpen();
    this.closed = true;
    this.pending.length = 0;
    this.lifecycle.push(`collector:${this.scope}:close`);
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('collector is closed');
  }
}

export function createRoot(
  source: Source,
  lifecycle: string[],
  now: () => number = Date.now,
) {
  return DiBag.begin()
    .add({
      source: () => source, // Borrowed from startup; no disposal declaration.
      clock: () => ({ now }),
      replayBuffer: DiBag.withDisposal(
        () => new ReplayBuffer(lifecycle),
        (buffer) => buffer.close(),
      ),
      stores: ({ source }: { source: Source }) => source.stores('root'),
      broadcast: ({
        replayBuffer,
      }: {
        replayBuffer: ReplayBuffer;
      }): Broadcaster => replayBuffer,
      workItems: ({
        stores,
        clock,
        broadcast,
      }: {
        stores: Stores;
        clock: { now(): number };
        broadcast: Broadcaster;
      }) => ({
        rename(id: string, title: string): void {
          const change = { id, title, at: clock.now(), scope: stores.scope };
          stores.save(change);
          broadcast.publish(change);
        },
      }),
    })
    .end();
}

export function createBatch(
  root: ReturnType<typeof createRoot>,
  stores: Stores,
  openCollector: () => Collector,
) {
  return root.fork(['source', 'clock', 'replayBuffer', 'stores', 'broadcast'], {
    source: () => root.resolve('source'),
    clock: () => root.resolve('clock'),
    replayBuffer: () => root.resolve('replayBuffer'),
    stores: () => stores,
    // If opening/preparing the collector fails, openCollector must clean up
    // what it acquired. The bag takes ownership only on successful return.
    broadcast: DiBag.withDisposal(openCollector, (collector) =>
      collector.close(),
    ),
    // workItems is deliberately not overridden: its factory sees batch deps.
  });
}

interface ClosableBag {
  close(): Promise<void>;
}

// Startup coordinates lifetimes. This is application code, not a di-bag API.
export async function stopApplication(
  source: Source,
  root: ClosableBag,
  batches: readonly ClosableBag[],
): Promise<void> {
  const errors: unknown[] = [];
  for (const owner of [...batches, root, source]) {
    try {
      await owner.close();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0)
    throw new AggregateError(errors, 'Application cleanup failed');
}

export async function runExample() {
  const lifecycle: string[] = [];
  const source = new Source(lifecycle);
  const root = createRoot(source, lifecycle, () => 42);
  const batches: ReturnType<typeof createBatch>[] = [];
  try {
    const replay = root.resolve('replayBuffer');
    const a = createBatch(
      root,
      source.stores('batch-a'),
      () => new Collector('batch-a', lifecycle),
    );
    batches.push(a);
    const b = createBatch(
      root,
      source.stores('batch-b'),
      () => new Collector('batch-b', lifecycle),
    );
    batches.push(b);
    a.resolve('workItems').rename('one', 'Plan milestone');
    b.resolve('workItems').rename('two', 'Verify ownership');
    a.resolve('broadcast').flushTo(replay);
    b.resolve('broadcast').flushTo(replay);
    return { changes: replay.snapshot(), lifecycle };
  } finally {
    await stopApplication(source, root, batches);
  }
}

if (require.main === module) {
  runExample().then(
    (report) => console.log(JSON.stringify(report, null, 2)),
    (error) => {
      console.error(error);
      process.exitCode = 1;
    },
  );
}
