import { DiBag, type CloseOptions, type EnsureServicesReadyOptions } from '../../src';
import type { AppServices, DocumentRecord, DocumentsStore, ProjectLock, ProjectServices, Storage, Transport } from './services';

export interface ProjectRuntime {
  readonly services: ProjectServices;
  close(options?: CloseOptions): Promise<void>;
}

/**
 * One project's graph. It borrows the app's services by value (no disposer, so
 * closing a project never touches them) and owns the project lock. The lock is
 * the exclusive resource: two runtimes for one project cannot hold it at once.
 */
export function createProjectBuilder(app: AppServices, projectId: string) {
  return DiBag.createBuilder().register({
    projectId: DiBag.fromSyncFactory(() => projectId),
    storage: DiBag.fromSyncFactory((): Storage => app.storage),
    transport: DiBag.fromSyncFactory((): Transport => app.transport),
    lock: DiBag.withDisposal(
      DiBag.fromAsyncFactory(({ storage, projectId }: { storage: Storage; projectId: string }) => storage.lock(projectId)),
      lock => lock.release(),
    ),
    // Depends on the lock so nothing is fetched for a project another runtime still holds.
    manifest: DiBag.fromAsyncFactory(
      async ({ transport, projectId, lock }: { transport: Transport; projectId: string; lock: Promise<ProjectLock> }, factoryCtx) => {
        await lock;
        return transport.fetchManifest(projectId, factoryCtx.signal);
      },
      { context: 'acquisition' },
    ),
    documents: DiBag.fromAsyncFactory(
      async ({ storage, projectId, lock }: { storage: Storage; projectId: string; lock: Promise<ProjectLock> }): Promise<DocumentsStore> => {
        await lock;
        let snapshot = await storage.load(projectId);
        const listeners = new Set<() => void>();
        return {
          subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
          getSnapshot: () => snapshot,
          async add(title) {
            const next: readonly DocumentRecord[] = [...snapshot, { id: `${projectId}-${snapshot.length + 1}`, title }];
            await storage.save(projectId, next);
            snapshot = next;
            for (const listener of [...listeners]) listener();
          },
        };
      },
    ),
  });
}

/** Start a project runtime; `options.abortSignal` cancels the wait and releases what was acquired. */
export async function createProjectRuntime(app: AppServices, projectId: string, options?: EnsureServicesReadyOptions): Promise<ProjectRuntime> {
  const bag = await createProjectBuilder(app, projectId).build().ensureServicesReady(['lock', 'manifest', 'documents'], options);
  const [manifest, documents] = await Promise.all([bag.resolve('manifest'), bag.resolve('documents')]);
  const services: ProjectServices = { projectId, name: manifest.name, documents };
  return { services, close: closeOptions => bag.close(closeOptions) };
}
