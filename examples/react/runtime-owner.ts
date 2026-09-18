import { DiBagStartupCancelledError, type CloseOptions } from '../../src';

/** Anything with an asynchronous close: a DI Bag bag or a wrapper around one. */
export interface Closable {
  close(options?: CloseOptions): Promise<void>;
}

export type RuntimeStatus<T> =
  | { readonly state: 'idle' }
  | { readonly state: 'starting'; readonly identity: string; readonly generation: number }
  | { readonly state: 'ready'; readonly identity: string; readonly generation: number; readonly runtime: T }
  | { readonly state: 'failed'; readonly identity: string; readonly generation: number; readonly error: unknown }
  | { readonly state: 'closed' };

/** What the owner could not do quietly. Every one reaches `onFailure`; none is a swallowed promise. */
export type OwnerFailure =
  | { readonly phase: 'close-failed'; readonly identity: string; readonly generation: number; readonly error: unknown }
  | { readonly phase: 'close-wait-expired'; readonly identity: string; readonly generation: number; readonly timeoutMs: number };

export interface RuntimeOwnerOptions<T extends Closable> {
  /** Start a runtime for an identity. Must reject once `signal` aborts; `buildAndStart` does. */
  readonly start: (identity: string, signal: AbortSignal) => Promise<T>;
  /** The application's error sink: telemetry, a toast, a log. */
  readonly onFailure: (failure: OwnerFailure) => void;
  /**
   * Bound the wait on a retiring runtime before the next one starts.
   * Unset: wait however long teardown takes, so exclusive resources never overlap.
   * Set: after the deadline the next runtime starts anyway and the sink hears
   * `close-wait-expired`; the teardown keeps running and a late failure still reaches the sink.
   */
  readonly closeTimeoutMs?: number;
}

/** The live selection. Releasing a stale one is a no-op, which is what Strict Mode's extra cleanup needs. */
export interface Selection {
  readonly identity: string;
  release(): void;
}

interface Slot<T> {
  readonly generation: number;
  readonly identity: string;
  readonly controller: AbortController;
  runtime: T | undefined;
  /** Settles once this slot owes nothing more: its startup settled and any teardown it owes finished. */
  readonly done: Promise<void>;
  finish(): void;
}

const expired = Symbol('close-wait-expired');

/**
 * Owns at most one runtime at a time, keyed by an identity such as a project id.
 * Startups are numbered; one that finishes after its slot was replaced is closed
 * and never published. Teardowns are serialized: the next runtime starts only
 * after the previous slot settled or its bounded wait expired.
 * `subscribe`/`getSnapshot` follow the `useSyncExternalStore` contract.
 */
export class RuntimeOwner<T extends Closable> {
  private generation = 0;
  private current: Slot<T> | undefined;
  private live: Selection | undefined;
  private chain: Promise<void> = Promise.resolve();
  private status: RuntimeStatus<T> = Object.freeze<RuntimeStatus<T>>({ state: 'idle' });
  private readonly listeners = new Set<() => void>();
  private closed = false;

  constructor(private readonly options: RuntimeOwnerOptions<T>) {}

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  readonly getSnapshot = (): RuntimeStatus<T> => this.status;

  /** Select an identity. Selecting the current identity again keeps its runtime unless it failed. */
  select(identity: string): Selection {
    if (this.closed) throw new Error('runtime owner is closed');
    const selection: Selection = { identity, release: () => this.release(selection) };
    this.live = selection;
    const kept = this.current !== undefined && this.current.identity === identity && this.status.state !== 'failed';
    if (!kept) this.replace(identity);
    return selection;
  }

  /** Start the live identity again after a failed startup. */
  retry(): void {
    if (this.live !== undefined && this.status.state === 'failed') this.replace(this.live.identity);
  }

  /** Resolves once every teardown enqueued so far has settled or its bounded wait expired. */
  settled(): Promise<void> {
    return this.chain;
  }

  /** Retire the current runtime, wait for it, and refuse further selections. */
  async close(): Promise<void> {
    this.closed = true;
    this.live = undefined;
    if (this.current !== undefined) { this.retire(this.current); this.current = undefined; }
    this.publish({ state: 'closed' });
    await this.chain;
  }

  private release(selection: Selection): void {
    if (this.live !== selection) return;
    this.live = undefined;
    if (this.current !== undefined) { this.retire(this.current); this.current = undefined; }
    this.publish({ state: 'idle' });
  }

  private replace(identity: string): void {
    if (this.current !== undefined) this.retire(this.current);
    let finish!: () => void;
    const done = new Promise<void>(resolve => { finish = resolve; });
    const slot: Slot<T> = { generation: ++this.generation, identity, controller: new AbortController(), runtime: undefined, done, finish };
    this.current = slot;
    this.publish({ state: 'starting', identity, generation: slot.generation });
    void this.run(slot);
  }

  /** Abort the slot's startup or close its runtime, and make every later startup wait for it. */
  private retire(slot: Slot<T>): void {
    slot.controller.abort(new Error(`runtime ${slot.identity}#${slot.generation} was released`));
    const runtime = slot.runtime;
    if (runtime !== undefined) {
      slot.runtime = undefined;
      void this.settle(slot, runtime.close());
    }
    this.chain = this.chain.then(() => this.awaitRetired(slot));
  }

  private async run(slot: Slot<T>): Promise<void> {
    await this.chain;
    if (slot.controller.signal.aborted) { slot.finish(); return; }
    let runtime: T;
    try {
      runtime = await this.options.start(slot.identity, slot.controller.signal);
    } catch (error) {
      if (slot.controller.signal.aborted) {
        // Cancelled: the partial runtime is still being released, and that release is this slot's to finish.
        await this.settle(slot, error instanceof DiBagStartupCancelledError ? error.cleanupPromise : Promise.resolve());
      } else {
        // A genuine failure. buildAndStart has already rolled back what it acquired.
        this.publish({ state: 'failed', identity: slot.identity, generation: slot.generation, error });
        slot.finish();
      }
      return;
    }
    if (slot.controller.signal.aborted) {
      // Finished after replacement: closed now, never published.
      await this.settle(slot, runtime.close());
      return;
    }
    slot.runtime = runtime;
    this.publish({ state: 'ready', identity: slot.identity, generation: slot.generation, runtime });
  }

  /** Report a failed teardown to the sink and mark the slot done once the teardown settled. Never rejects. */
  private async settle(slot: Slot<T>, teardown: Promise<void>): Promise<void> {
    try {
      await teardown;
    } catch (error) {
      this.options.onFailure({ phase: 'close-failed', identity: slot.identity, generation: slot.generation, error });
    } finally {
      slot.finish();
    }
  }

  /** Wait for a retired slot, bounded when configured. An expiry is reported; the slot keeps settling in the background. */
  private async awaitRetired(slot: Slot<T>): Promise<void> {
    const timeoutMs = this.options.closeTimeoutMs;
    if (timeoutMs === undefined) { await slot.done; return; }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<typeof expired>(resolve => { timer = setTimeout(() => resolve(expired), timeoutMs); });
    const outcome = await Promise.race([slot.done, deadline]);
    clearTimeout(timer);
    if (outcome === expired) this.options.onFailure({ phase: 'close-wait-expired', identity: slot.identity, generation: slot.generation, timeoutMs });
  }

  private publish(status: RuntimeStatus<T>): void {
    this.status = Object.freeze(status);
    for (const listener of [...this.listeners]) listener();
  }
}
