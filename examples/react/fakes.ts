import type { DocumentRecord, ProjectLock, Storage, Transport } from './services';

/** A manually opened gate: tests and the browser scenario decide when an operation may proceed. */
export type Gate = { readonly opened: Promise<void>; open(): void };
export function gate(): Gate {
  let open!: () => void;
  const opened = new Promise<void>(resolve => { open = resolve; });
  return { opened, open };
}

type Hold = (projectId: string) => Promise<void> | undefined;

export type MemoryStorage = Storage & {
  /** `acquire:<id>` and `release:<id>` in the order they happened. */
  readonly events: string[];
  readonly held: ReadonlySet<string>;
};

/** In-memory storage. `releaseGate` lets a caller hold a lock release open. */
export function createMemoryStorage(options: { readonly releaseGate?: Hold } = {}): MemoryStorage {
  const documents = new Map<string, readonly DocumentRecord[]>();
  const held = new Set<string>();
  const events: string[] = [];
  return {
    events,
    held,
    async load(projectId) { return documents.get(projectId) ?? []; },
    async save(projectId, records) { documents.set(projectId, records); },
    async lock(projectId) {
      // Runs synchronously up to the first await: the acquire event is recorded when the factory is called.
      if (held.has(projectId)) throw new Error(`project ${projectId} is locked by another runtime`);
      held.add(projectId);
      events.push(`acquire:${projectId}`);
      return {
        projectId,
        async release() {
          await options.releaseGate?.(projectId);
          held.delete(projectId);
          events.push(`release:${projectId}`);
        },
      };
    },
  };
}

export type MemoryTransport = Transport & {
  /** Project ids in `fetchManifest` call order. */
  readonly calls: string[];
  readonly closes: number;
};

/** In-memory transport. `failing` ids reject; `manifestGate` holds a fetch open until released. */
export function createMemoryTransport(options: { readonly failing?: readonly string[]; readonly manifestGate?: Hold } = {}): MemoryTransport {
  const calls: string[] = [];
  let closes = 0;
  return {
    calls,
    get closes() { return closes; },
    async fetchManifest(projectId, signal) {
      calls.push(projectId);
      await options.manifestGate?.(projectId);
      if (signal.aborted) throw new Error(`manifest fetch for ${projectId} was cancelled`);
      if (options.failing?.includes(projectId)) throw new Error(`no manifest for ${projectId}`);
      return { name: `Project ${projectId}` };
    },
    async close() { closes += 1; },
  };
}
