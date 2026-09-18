import { bootstrap } from './bootstrap';
import { createMemoryStorage, createMemoryTransport } from './fakes';

// The runnable page: in-memory adapters stand in for IndexedDB and fetch. `npm run example:react` builds it.
// Under a Vite-style dev server, also pass `hot: import.meta.hot` so a hot update closes this instance's runtimes.
const container = document.getElementById('root');
if (container === null) throw new Error('main.tsx needs a <div id="root"> to render into');
void bootstrap(container, { storage: createMemoryStorage(), transport: createMemoryTransport({ failing: ['broken'] }) }, {
  projects: ['alpha', 'beta', 'broken'],
  initial: 'alpha',
});
