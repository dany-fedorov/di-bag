import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { App } from './app';
import { createAppRuntime, type AppAdapters, type AppRuntime } from './app-runtime';
import { createProjectRuntime, type ProjectRuntime } from './project-runtime';
import { RuntimeOwner, type OwnerFailure } from './runtime-owner';

export type BootstrapOptions = {
  readonly projects: readonly string[];
  readonly initial: string;
  /** Where teardown failures go. Default: `console.error`. */
  readonly onFailure?: (failure: OwnerFailure) => void;
  readonly closeTimeoutMs?: number;
  /**
   * The dev server's hot-module handle, e.g. Vite's `import.meta.hot`, passed by the
   * page entry. A plain bundle has none and omits it.
   */
  readonly hot?: { dispose(callback: () => void): void };
};

export type Bootstrapped = {
  readonly app: AppRuntime;
  readonly owner: RuntimeOwner<ProjectRuntime>;
  readonly root: Root;
  shutdown(): Promise<void>;
};

/**
 * Explicit bootstrap: the app runtime starts before React renders, and the owner
 * lives outside every component. Nothing side-effectful happens during render.
 */
export async function bootstrap(container: HTMLElement, adapters: AppAdapters, options: BootstrapOptions): Promise<Bootstrapped> {
  const app = await createAppRuntime(adapters, { totalTimeoutMs: 5_000 });
  const owner = new RuntimeOwner<ProjectRuntime>({
    start: (projectId, signal) => createProjectRuntime(app.services, projectId, { abortSignal: signal, totalTimeoutMs: 5_000 }),
    onFailure: options.onFailure ?? (failure => { console.error('project runtime teardown', failure); }),
    ...(options.closeTimeoutMs === undefined ? {} : { closeTimeoutMs: options.closeTimeoutMs }),
  });
  const root = createRoot(container);
  root.render(<StrictMode><App owner={owner} projects={options.projects} initial={options.initial} /></StrictMode>);
  let shuttingDown: Promise<void> | undefined;
  // Project runtimes borrow the app's transport, so they close before the app bag does.
  const shutdown = () => shuttingDown ??= (async () => { root.unmount(); await owner.close(); await app.close(); })();
  // A dev server with HMR replaces this module: close what this instance owns before the next one boots.
  options.hot?.dispose(() => { void shutdown(); });
  // Navigation never waits for this. It is best effort; server-side leases and locks need their own expiry.
  window.addEventListener('pagehide', () => { void shutdown(); }, { once: true });
  return { app, owner, root, shutdown };
}
