/**
 * The narrow interfaces the React tree sees. Components receive these through
 * Context; they never receive a bag, a builder, or a `resolve` function.
 */

export type DocumentRecord = { readonly id: string; readonly title: string };

/**
 * The `useSyncExternalStore` contract: `getSnapshot` returns the same value until
 * something changed, and every change calls each subscribed listener once.
 */
export interface ExternalStore<S> {
  subscribe(this: void, listener: () => void): () => void;
  getSnapshot(this: void): S;
}

/** Exclusive per-project handle: a second holder is refused until this one releases. */
export interface ProjectLock {
  readonly projectId: string;
  release(): Promise<void>;
}

/** App-level persistence, e.g. IndexedDB. Borrowed by every project runtime; nothing closes it. */
export interface Storage {
  load(projectId: string): Promise<readonly DocumentRecord[]>;
  save(projectId: string, documents: readonly DocumentRecord[]): Promise<void>;
  lock(projectId: string): Promise<ProjectLock>;
}

/** App-level network client, e.g. `fetch` with auth. Owned by the app bag, borrowed by project runtimes. */
export interface Transport {
  fetchManifest(projectId: string, signal: AbortSignal): Promise<{ readonly name: string }>;
  close(): Promise<void>;
}

/** What the app hands to each project runtime. */
export interface AppServices {
  readonly storage: Storage;
  readonly transport: Transport;
}

/** A project's documents as an external store React can subscribe to. */
export interface DocumentsStore extends ExternalStore<readonly DocumentRecord[]> {
  add(title: string): Promise<void>;
}

/** What a project runtime exposes to components. */
export interface ProjectServices {
  readonly projectId: string;
  readonly name: string;
  readonly documents: DocumentsStore;
}
