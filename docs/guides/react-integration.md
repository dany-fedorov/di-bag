# Using DI Bag with React in the browser

[← README](../../README.md) · [Server recipes](server-integration.md) · [Complete API guide](api-reference.md)

This guide connects DI Bag's ownership primitives to React's lifecycle in a
browser application: one application runtime built at bootstrap, project
runtimes that start and stop as the user switches projects, narrow services in
Context, and an external store bridged through `useSyncExternalStore`. The
complete recipe is in [`examples/react`](../../examples/react). Every claim
below is pinned by `tests/react` (Bun, no React) and by a run of the example in
a real Chromium (`npm run check:react-browser`).

The package stays React-free. There is no `useResolve()` hook here and none is
needed: components ask for services, not for a container.

## Contents

- [Who owns what](#who-owns-what)
- [When props and Context are enough](#when-props-and-context-are-enough)
- [Build the application runtime once](#build-the-application-runtime-once)
- [A project runtime borrows, owns, and starts](#a-project-runtime-borrows-owns-and-starts)
- [The runtime owner](#the-runtime-owner)
- [Connect it to React](#connect-it-to-react)
- [Reactivity is separate from resolution](#reactivity-is-separate-from-resolution)
- [Failures and what a timeout means](#failures-and-what-a-timeout-means)
- [Development HMR and navigation](#development-hmr-and-navigation)
- [Test without React, then in a browser](#test-without-react-then-in-a-browser)
- [Compared with Obsidian, inversify-react, and react-ioc](#compared-with-obsidian-inversify-react-and-react-ioc)
- [When this becomes a package](#when-this-becomes-a-package)

## Who owns what

| Runtime | Lives for | Created by | Typically holds | Closed by |
| --- | --- | --- | --- | --- |
| Application | The page | `bootstrap()`, before `createRoot` | Configuration, transport, storage, anything every project shares | `shutdown()` on HMR dispose; best effort on `pagehide` |
| User session | One signed-in user | The same owner pattern keyed by user id, if a session acquires resources | Token refresh, per-user caches, a presence socket | Sign-out, before the next session starts |
| Project | One selected project | `RuntimeOwner.select(projectId)` from an effect | The project lock, its document store, its manifest | Switching projects, unmount, `owner.close()` |

Three rules follow from [ownership](../../README.md#give-resources-a-clear-owner):

- **Shared means owned once, borrowed everywhere else.** The app bag owns the
  transport with `withDisposal`; a project runtime registers the same transport
  with a plain factory and no disposer, so closing a project never closes it.
  The owner of a borrowed value must outlive its borrowers, which is why
  `shutdown()` closes project runtimes before the app bag.
- **No bag per component.** A bag is an ownership family with startup and
  teardown; a component is a render function. Give each *lifetime* one runtime
  and pass its narrow services down through Context.
- **No module-scope user singletons.** A runtime created at module import time
  is shared by every request in a server-rendered process. This recipe has no
  SSR example; if you render on the server, create the app runtime per request
  or per worker, never per module, and keep user state in a session runtime.
  See [lifetime rules](tutorial.md#choose-a-lifetime).

## When props and Context are enough

If nothing needs asynchronous startup or asynchronous cleanup, you do not need
the owner. Build the services once and pass them down:

```tsx
const services = { clock: () => Date.now(), format: (value: number) => new Date(value).toISOString() };
const Services = createContext(services);
root.render(<Services.Provider value={services}><App /></Services.Provider>);
```

Reach for a bag when a service must be *started* before use (a lock, a socket,
a database handle), must be *released* when its owner goes away, or must be
*replaced* when an identity changes. Reach for the owner below when React is
the thing deciding when that happens.

## Build the application runtime once

`bootstrap()` runs before React renders. Every stage names its acquisition
mode: browsers have no `process.getBuiltinModule`, so an `auto` stage would
throw `DI_BAG_CLASSIFIER_REQUIRED` at `build()`; see
[portable mode](tutorial.md#portable-mode). The `fromSyncFactory`/`fromAsyncFactory`
helpers ([#28](https://github.com/dany-fedorov/di-bag/issues/28)) are the
explicit modes with less repetition; the semantics are those of
`acquisitionMode: 'raw'` and `'nativePromise'`.

```ts
import { DiBag, type CloseOptions, type EnsureServicesReadyOptions } from 'di-bag';

export function createAppBuilder(adapters: AppAdapters) {
  return DiBag.createBuilder().withServices({
    // Borrowed: IndexedDB-style storage has no close; the bag never disposes it.
    storage: DiBag.providerWithLifetime({ provider: DiBag.createProvider((): Storage => adapters.storage, { factoryReturnKind: 'sync-value' }), lifetime: 'singleton:one-per-container-tree' }),
    // Owned: bootstrap hands the transport over, and the app bag closes it exactly once.
    transport: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: DiBag.createProvider((): Transport => adapters.transport, { factoryReturnKind: 'sync-value' }), disposeService: transport => transport.close() }), lifetime: 'singleton:one-per-container-tree' }),
  });
}

export async function createAppRuntime(adapters: AppAdapters, options?: EnsureServicesReadyOptions): Promise<AppRuntime> {
  const bag = await createAppBuilder(adapters).buildContainer().ensureServicesReady(['storage', 'transport'], options);
  const services: AppServices = { storage: bag.resolve('storage'), transport: bag.resolve('transport') };
  return { services, close: closeOptions => bag.close(closeOptions) };
}
```

The runtime object exposes `services` and `close`; nothing in React sees the bag.

## A project runtime borrows, owns, and starts

A project runtime is an independent bag. It borrows the app's services by
value and owns what only it uses: the exclusive project lock, the manifest,
and the document store. `buildAndStart` is the startup: the caller's `signal`
cancels it, and failure rolls back what was acquired.

```ts
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
    documents: DiBag.fromAsyncFactory(async ({ storage, projectId, lock }: { storage: Storage; projectId: string; lock: Promise<ProjectLock> }): Promise<DocumentsStore> => {
      await lock;
      let snapshot = await storage.load(projectId);
      const listeners = new Set<() => void>();
      return {
        subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
        getSnapshot: () => snapshot,
        async add(title) {
          const next = [...snapshot, { id: `${projectId}-${snapshot.length + 1}`, title }];
          await storage.save(projectId, next);
          snapshot = next;
          for (const listener of [...listeners]) listener();
        },
      };
    }),
  });
}

export async function createProjectRuntime(app: AppServices, projectId: string, options?: StartupOptions): Promise<ProjectRuntime> {
  const bag = await createProjectBuilder(app, projectId).buildAndStart(['lock', 'manifest', 'documents'], options);
  const [manifest, documents] = await Promise.all([bag.resolve('manifest'), bag.resolve('documents')]);
  return { services: { projectId, name: manifest.name, documents }, close: closeOptions => bag.close(closeOptions) };
}
```

When the manifest fetch fails, `buildAndStart` rejects with
`DiBagStartupError` *after* releasing the lock it had already acquired; the
cause is on `error.cause`. When the caller aborts, it rejects promptly with
`DiBagStartupCancelledError`, and `error.cleanupPromise` settles once the
in-flight fetch has settled and the lock is released — cancellation is
cooperative, which is why `fetchManifest` receives `factoryCtx.signal`.

A factory that acquires *several* things before it can return owns the
intermediate ones itself through `factoryCtx.pushDisposer` (issue
[#27](https://github.com/dany-fedorov/di-bag/issues/27), see
[release a partially acquired resource](tutorial.md#release-partial-acquisition)).
That covers what a factory registered; a factory that opened a handle and
neither returned it nor pushed a disposer has leaked it, and nothing here
recovers it.

## The runtime owner

[`runtime-owner.ts`](../../examples/react/runtime-owner.ts) is framework-free
and generic over anything with `close()`. It owns at most one runtime at a
time, keyed by an identity.

```ts
const owner = new RuntimeOwner<ProjectRuntime>({
  start: (projectId, signal) => createProjectRuntime(app.services, projectId, { signal, timeoutMs: 5_000 }),
  onFailure: failure => telemetry.report(failure),
  closeTimeoutMs: 2_000,
});
const selection = owner.select('alpha');   // status: starting → ready | failed
selection.release();                        // status: idle; the runtime closes
```

What it guarantees, each pinned by a test in `tests/react/runtime-owner.test.ts`:

- **A replaced startup never becomes current.** Every startup gets a
  generation and its own `AbortController`. `select` of a different identity
  (or `release`) aborts the current one. If `start` still fulfils afterwards,
  the runtime is closed at once and never published; if it rejects with
  `DiBagStartupCancelledError`, its `cleanupPromise` is awaited and owned.
- **Teardowns are serialized.** The next startup begins only after the previous
  slot has settled: its close finished, or its cancelled startup's cleanup
  finished. An exclusive resource such as the project lock therefore cannot be
  held by two runtimes at once.
- **The wait can be bounded, and a bound is not proof.** With
  `closeTimeoutMs`, the owner stops waiting after the deadline, reports
  `{ phase: 'close-wait-expired' }` to `onFailure`, and starts the replacement.
  The old teardown keeps running; a later rejection still reaches the sink as
  `close-failed`. This is the intentional overlap policy: the resource itself
  refuses a second holder, so the replacement's startup fails visibly instead
  of sharing silently. Leave `closeTimeoutMs` unset to never overlap.
- **Nothing is swallowed.** React does not await effect cleanup promises, so the
  owner keeps them: every `close()` rejection and every expired wait goes to
  `onFailure`. The owner never logs.
- **Only the live selection releases.** `release()` on a stale selection is a
  no-op. `retry()` restarts the live identity after a failed startup without
  changing which selection is live.
- **Status is an external store.** `subscribe`/`getSnapshot` return frozen,
  referentially stable `RuntimeStatus` values:
  `idle | starting | ready | failed | closed`.

## Connect it to React

[`react-runtime.tsx`](../../examples/react/react-runtime.tsx) is the whole
React-specific layer:

```tsx
export function useSelectedRuntime<T extends Closable>(owner: RuntimeOwner<T>, identity: string): RuntimeStatus<T> {
  useEffect(() => {
    const selection = owner.select(identity);
    return () => { selection.release(); };
  }, [owner, identity]);
  return useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
}
```

Selection happens in an effect, never in render or `useMemo`: rendering must
be free of side effects, and Strict Mode proves it by running setup, cleanup,
and setup again in development. With this hook that sequence releases the
first selection — before its startup was even invoked, because the owner
starts after one microtask — and ends with a fresh, usable generation 2. The
browser lane asserts exactly that (`mounted.generation` is 2 in the
development build and 1 in production).

`RuntimeProvider` renders one of three states and puts the narrow
`ProjectServices` in Context; components call `projectServices.useServices()`.
Use one provider per owner. Two components that need the same project share
the provider above them; two panes that need different projects get two owners.

```tsx
<RuntimeProvider owner={owner} identity={projectId} context={projectServices.Context} services={runtime => runtime.services}
  starting={<p>Opening {projectId}…</p>}
  failed={(error, retry) => <p>Could not open {projectId}: {failureMessage(error)} <button onClick={retry}>Retry</button></p>}>
  <Documents />
</RuntimeProvider>
```

## Reactivity is separate from resolution

Resolving a service gives you access to it. It does not tell React when the
service's state changes. The document store exposes the
`useSyncExternalStore` shape — `subscribe` and a `getSnapshot` that is stable
until something changed — and the component subscribes:

```tsx
const list = useSyncExternalStore(documents.subscribe, documents.getSnapshot);
```

Any store with that shape works the same way: a Zustand store's `subscribe`
and `getState`, a Redux store, or your own. DI Bag adds no observable system.

## Failures and what a timeout means

| What happened | Where it shows | What was released |
| --- | --- | --- |
| A selected factory threw during startup | `status.state === 'failed'`, `error` is `DiBagStartupError` with `cause` | Everything already owned, before the rejection |
| The identity changed during startup | Nothing; the startup is cancelled | Everything the cancelled startup owned, once its factories settle |
| A disposer rejected at close | `onFailure({ phase: 'close-failed', error })`, `error` is `DiBagCleanupError` | Every other disposer still ran |
| Teardown outlived `closeTimeoutMs` | `onFailure({ phase: 'close-wait-expired' })`, then `close-failed` if it eventually fails | Unknown until it settles; the replacement may fail on the exclusive resource |

`bag.close({ timeoutMs })` gives the same bounded wait at the library level and
names the disposers still running in `error.details.pending`; see
[cleanup waits for your work by default](../../README.md#tradeoffs-and-limits).

## Development HMR and navigation

`bootstrap()` returns `shutdown()`, which unmounts, closes the owner, then
closes the app bag. Two hooks call it:

- **HMR.** A dev server that replaces the page entry's module leaves the old
  module's runtime alive unless the old module closes it. Under a Vite-style
  server the entry passes `hot: import.meta.hot` to `bootstrap()`, which calls
  `hot.dispose(() => shutdown())`; a plain bundle has no `import.meta.hot` and
  omits the option. The entry passes it, rather than `bootstrap` reading
  `import.meta` itself, so the recipe type-checks as the CommonJS the example
  directory compiles to. State that must survive a reload belongs in storage,
  not in a runtime.
- **Navigation.** `pagehide` calls `shutdown()` too, but the browser never
  waits for it. Do not rely on awaited unload cleanup for correctness: an
  exclusive lock held in a server or in shared storage needs its own expiry or
  heartbeat, and a project reopened in a new tab must be able to take over.

## Test without React, then in a browser

The owner and the composition are plain TypeScript, so their tests run in Bun
with fake factories and manually settled promises:

```sh
bun test tests/react
```

The same composition runs with the in-memory `Storage` and `Transport` fakes
in tests and in the browser example; a real application swaps them for
IndexedDB and `fetch` in `bootstrap()`.

The browser lane bundles the example with the pinned esbuild and drives it in
the pinned Chromium, in a development build (Strict Mode double invocation)
and a production build:

```sh
npm ci --prefix tools/platform --no-audit --no-fund
export PLAYWRIGHT_BROWSERS_PATH="$PWD/tools/platform/.browsers"
node tools/platform/node_modules/playwright/cli.js install chromium
npm run platform:pin -- --all
npm run check:react-browser
npm run example:react   # writes a page you can open from disk
```

CI's portable job runs `check:react-browser` on every push. Versions
exercised: React 19.3.0 (`package.json` devDependencies), Chromium
153.0.8010.12 as installed by Playwright 1.63.0, esbuild 0.28.2
(`tools/platform/package.json`). Each evidence row in
`docs/benchmarks/results/<date>-<sha>/react-browser.jsonl` records the React
version the page reported, the build mode, and the pinned tool versions. The
lane fails on any page error, any unhandled rejection the scenario observed,
and any console `error` or `warning`, so React's own warnings are assertions.

## Compared with Obsidian, inversify-react, and react-ioc

| Idea | [Obsidian](https://wix-incubator.github.io/obsidian/docs/documentation/) | [inversify-react](https://github.com/Kukkimonsuta/inversify-react) | [react-ioc](https://github.com/gnaeus/react-ioc) | This recipe |
| --- | --- | --- | --- | --- |
| Scoping | `@graph` classes with `@singleton` or `@lifecycleBound` scopes; a bound graph is destroyed when its last requester unmounts | A `Provider` per subtree; providers form a container hierarchy | `@provider` per component subtree; nested providers form scopes | One bag per lifetime (app, session, project); the owner closes a project runtime when its selection is released |
| Access from components | Injection into components, hooks, and classes | `useInjection(id)`, `useContainer()` | `useInstance(Service)` | A Context per narrow services interface; no generic resolution hook |
| Startup | Synchronous graph construction | Synchronous resolution | Synchronous construction, lazy registration | Asynchronous `buildAndStart` with cancellation, rollback, and explicit loading and failure states |
| Disposal | Graph cleared on unmount | Not documented | `.dispose()` called on created instances when the provider unmounts | `close()` with ordered disposers; rejections and bounded waits reach an explicit sink |
| Reactivity | Built-in `Observable` and `useObserver` | None | None | Any `subscribe`/`getSnapshot` store through `useSyncExternalStore` |
| Requirements | Decorators, Babel plugin | Decorators optional (`reflect-metadata` for `@resolve`) | Decorators optional; React 16.6+ | No decorators, no peer dependency; React 19 exercised |

Adopted: a graph per lifecycle that is destroyed when its last requester goes
away (Obsidian); a provider per ownership level and a hierarchy of them
(inversify-react); disposal when the provider unmounts (react-ioc). Left out
deliberately: decorators and metadata, a generic injection hook, a
library-owned observable system, and constructing containers during render —
none of the three models asynchronous startup, cancellation of a replaced
startup, or teardown that outlives an effect cleanup, which is what this
recipe is for. The precedents are React-container designs to compare against,
not endorsements, and their documented behaviour was not re-tested here.

## When this becomes a package

The owner is ~200 lines you copy. It becomes an optional package only when a
second application in another repository adopts `runtime-owner.ts` unchanged
and the React layer needs a change that would otherwise be copied into both.
Until then, a peer dependency costs more than the copy.
