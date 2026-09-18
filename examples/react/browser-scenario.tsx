import { StrictMode, version } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { bootstrap } from './bootstrap';
import { createMemoryStorage, createMemoryTransport, gate } from './fakes';

/** One structured result per run; `scripts/react-browser-lane.ts` compares it exactly. */
export type ScenarioReport = {
  readonly lane: 'react-page-development' | 'react-page-production';
  readonly react: string;
  readonly mounted: { readonly status: string; readonly project: string; readonly generation: number };
  readonly documentAdded: { readonly count: number };
  readonly switchedToBeta: { readonly status: string; readonly project: string; readonly lockEvents: readonly string[] };
  readonly brokenFailed: { readonly status: string; readonly message: string; readonly lockEvents: readonly string[] };
  readonly backToAlpha: { readonly status: string; readonly project: string; readonly documents: number };
  readonly unmounted: { readonly state: string; readonly lockEvents: readonly string[] };
  readonly unmountDuringStartup: { readonly state: string; readonly gammaCalls: number; readonly lockEvents: readonly string[]; readonly published: boolean };
  readonly closed: { readonly transportCloses: number; readonly failures: readonly string[]; readonly unhandled: readonly string[] };
};

declare global {
  interface Window {
    __diBagReactReport?: (report: ScenarioReport) => void;
    __diBagReactError?: (message: string) => void;
  }
}

// esbuild substitutes this at bundle time; Strict Mode double-invokes effects only in development.
const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';

async function until(predicate: () => boolean, label: string): Promise<void> {
  const began = performance.now();
  while (!predicate()) {
    if (performance.now() - began > 5_000) throw new Error(`timed out waiting for ${label}`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

const statusElement = () => document.querySelector('[data-status]');
const status = () => statusElement()?.getAttribute('data-status') ?? 'none';
const project = () => statusElement()?.getAttribute('data-project') ?? 'none';
const documentCount = () => document.querySelectorAll('li').length;

/** Change the project through the real select element, the way a user would. */
function choose(projectId: string): void {
  const select = document.querySelector<HTMLSelectElement>('[data-testid="project"]');
  if (select === null) throw new Error('project selector is missing');
  select.value = projectId;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

async function run(): Promise<ScenarioReport> {
  const unhandled: string[] = [];
  window.addEventListener('unhandledrejection', event => { unhandled.push(String(event.reason)); });
  window.addEventListener('error', event => { unhandled.push(event.message); });
  const gammaGate = gate();
  const storage = createMemoryStorage();
  const transport = createMemoryTransport({ failing: ['broken'], manifestGate: id => (id === 'gamma' ? gammaGate.opened : undefined) });
  const failures: string[] = [];
  const container = document.createElement('div');
  document.body.append(container);
  const { app, owner, root } = await bootstrap(container, { storage, transport }, {
    projects: ['alpha', 'beta', 'broken'],
    initial: 'alpha',
    onFailure: failure => { failures.push(failure.phase); },
  });

  await until(() => status() === 'ready' && project() === 'alpha', 'alpha ready');
  const snapshot = owner.getSnapshot();
  const mounted = { status: status(), project: project(), generation: snapshot.state === 'ready' ? snapshot.generation : -1 };

  document.querySelector<HTMLButtonElement>('[data-testid="add"]')?.click();
  await until(() => documentCount() === 1, 'one document');
  const documentAdded = { count: documentCount() };

  choose('beta');
  await until(() => status() === 'ready' && project() === 'beta', 'beta ready');
  const switchedToBeta = { status: status(), project: project(), lockEvents: [...storage.events] };

  choose('broken');
  await until(() => status() === 'failed' && project() === 'broken', 'broken failed');
  const brokenFailed = { status: status(), message: statusElement()?.getAttribute('data-message') ?? '', lockEvents: [...storage.events] };

  choose('alpha');
  await until(() => status() === 'ready' && project() === 'alpha', 'alpha ready again');
  const backToAlpha = { status: status(), project: project(), documents: documentCount() };

  root.unmount();
  await owner.settled();
  const unmounted = { state: owner.getSnapshot().state, lockEvents: [...storage.events] };

  let published = false;
  const unsubscribe = owner.subscribe(() => {
    const current = owner.getSnapshot();
    if (current.state === 'ready' && current.identity === 'gamma') published = true;
  });
  const second = document.createElement('div');
  document.body.append(second);
  const secondRoot = createRoot(second);
  secondRoot.render(<StrictMode><App owner={owner} projects={['gamma']} initial="gamma" /></StrictMode>);
  await until(() => transport.calls.includes('gamma'), 'gamma startup in flight');
  secondRoot.unmount();
  gammaGate.open();
  await owner.settled();
  unsubscribe();
  const unmountDuringStartup = {
    state: owner.getSnapshot().state,
    gammaCalls: transport.calls.filter(id => id === 'gamma').length,
    lockEvents: [...storage.events],
    published,
  };

  await owner.close();
  await app.close();
  await new Promise(resolve => setTimeout(resolve, 50));
  const closed = { transportCloses: transport.closes, failures, unhandled };

  return { lane: `react-page-${mode}`, react: version, mounted, documentAdded, switchedToBeta, brokenFailed, backToAlpha, unmounted, unmountDuringStartup, closed };
}

run().then(
  report => { window.__diBagReactReport?.(report); },
  (error: unknown) => { window.__diBagReactError?.(error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error)); },
);
