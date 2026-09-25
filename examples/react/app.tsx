import { useState, useSyncExternalStore } from 'react';
import { DiBagServiceReadinessError } from '../../src';
import type { ProjectRuntime } from './project-runtime';
import { createServicesContext, RuntimeProvider } from './react-runtime';
import type { RuntimeOwner } from './runtime-owner';
import type { ProjectServices } from './services';

export const projectServices = createServicesContext<ProjectServices>('project services');

/** The startup error wraps the factory's failure; show the cause. */
export function failureMessage(error: unknown): string {
  const cause = error instanceof DiBagServiceReadinessError ? error.cause : error;
  return cause instanceof Error ? cause.message : String(cause);
}

export function App({ owner, projects, initial }: { owner: RuntimeOwner<ProjectRuntime>; projects: readonly string[]; initial: string }) {
  const [projectId, setProjectId] = useState(initial);
  return (
    <main>
      <label>
        Project{' '}
        <select data-testid="project" value={projectId} onChange={event => setProjectId(event.target.value)}>
          {projects.map(id => <option key={id} value={id}>{id}</option>)}
        </select>
      </label>
      <RuntimeProvider
        owner={owner}
        identity={projectId}
        context={projectServices.Context}
        services={runtime => runtime.services}
        starting={<p data-status="starting" data-project={projectId}>Opening {projectId}…</p>}
        failed={(error, retry) => (
          <p data-status="failed" data-project={projectId} data-message={failureMessage(error)}>
            Could not open {projectId}: {failureMessage(error)} <button onClick={retry}>Retry</button>
          </p>
        )}
      >
        <Documents />
      </RuntimeProvider>
    </main>
  );
}

function Documents() {
  const { projectId, name, documents } = projectServices.useServices();
  // Re-renders come from the store's subscription, not from having resolved the service.
  const list = useSyncExternalStore(documents.subscribe, documents.getSnapshot);
  return (
    <section data-status="ready" data-project={projectId}>
      <h1>{name}</h1>
      <ul>{list.map(document => <li key={document.id}>{document.title}</li>)}</ul>
      <button data-testid="add" onClick={() => { documents.add(`Note ${list.length + 1}`).catch((error: unknown) => { console.error(error); }); }}>
        Add document
      </button>
    </section>
  );
}
