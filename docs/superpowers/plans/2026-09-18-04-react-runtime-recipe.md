# React Runtime Recipe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close issue #30 with a documented, runnable, tested React/browser recipe: a framework-free application runtime built at bootstrap, project runtimes that an effect-driven `RuntimeOwner` starts, replaces, and closes without ever publishing a stale or closed bag, narrow services in React Context, and an external store bridged through `useSyncExternalStore` — verified in Bun without React and in the pinned Chromium with React 19.

**Architecture:** `examples/react/` holds the recipe. Three framework-free modules do the work: `app-runtime.ts` (the app bag, `buildAndStart` once at bootstrap), `project-runtime.ts` (one independent bag per project that borrows app services by value and owns an exclusive project lock), and `runtime-owner.ts` (`select`/`release`/`retry`, a generation counter with an `AbortController` per startup, a serialized teardown chain with an optional bounded wait, an explicit failure sink, and `subscribe`/`getSnapshot`). A ~40-line React layer (`react-runtime.tsx`) keys `useEffect` on identity and reads status with `useSyncExternalStore`. A new script `scripts/react-browser-lane.ts` bundles the example with the pinned esbuild and runs a scripted scenario in the pinned Chromium page (development and production builds) through the existing Playwright driver pattern.

**Tech Stack:** TypeScript, bun:test, React 19.3.0 + react-dom 19.3.0 (devDependencies only), esbuild 0.28.2 / Playwright 1.63.0 / Chromium 153.0.8010.12 from `tools/platform`, VitePress docs.

**Spec:** GitHub issue #30 (`gh issue view 30`); its acceptance criteria are the checklist. The Design section below is the design record for this plan; there is no separate spec file.

**Starting point:** branch `feat/react-runtime-recipe` from `feat/push-disposer` at e1d4037 (so the guide can name `factoryCtx.pushDisposer` for the #27 explanation). Rebase onto `main` once the push-disposer PR merges. If you must start from `main` instead, the only change is the one sentence in Task 5 that names `pushDisposer`: name `defer` there.

## Global Constraints

- Zero runtime dependencies in the published package. React lands only in root `devDependencies`, pinned exactly: `react` `19.3.0`, `react-dom` `19.3.0`, `@types/react` `19.3.0`, `@types/react-dom` `19.3.0` (verified with `npm view` on 2026-09-18; if `npm view react version` prints a newer patch, pin the printed version everywhere this plan says 19.3.0).
- Minimum TypeScript 6.0.3; `npm run typecheck:native` and `npm run check:native` must keep passing. `tsconfig.json` gains `"jsx": "react-jsx"` and nothing else.
- `src/` is not modified by this plan. The only change outside `examples/react`, `tests`, `scripts`, `docs`, `tools/docs`, `.github`, `package.json`, `package-lock.json`, `tsconfig.json`, and `README.md` is two added `export` keywords in `scripts/platform-evidence.ts`.
- The example uses the portable `di-bag` root entry (`import ... from '../../src'`, like every other example) and gives **every** factory stage an explicit `acquisitionMode`. No `di-bag/node`, no `node:` imports, no Node polyfills anywhere under `examples/react/`.
- `AGENTS.md` stays untouched (it is at its 150-line budget). `CHANGELOG.md` gains no `## Unreleased` heading; the changelog text lives at the end of this plan.
- Fast-lane tests are deterministic: gates are `deferred()` promises settled by the test; the only real timers are the `closeTimeoutMs: 5` cases, which wait 20 ms.
- Every test file registers a `process.on('unhandledRejection')` collector and asserts it stays empty; the browser scenario reports `unhandledrejection` and `error` events in its result.
- `README.md` has an uncommitted, unrelated tagline edit in the working tree. Do not revert it; stage only the lines you change (`git add -p README.md`).
- Commit prefixes: `feat:`, `fix:`, `test:`, `docs:`, `chore:`. Before every commit: `npm run typecheck && npm_config_update_notifier=false npm run test:fast`.
- Release gates run under the pinned Bun 1.4.0 (`tools/platform-versions.json`); the local Bun 1.4.2 is fine for development.

---

## Design

### What the issue asks for, in the repository's terms

A **project runtime** is a *bag*: an ownership family with its own acquisitions. Switching projects is not a scope change inside one bag; it is closing one ownership family and starting another. The primitives already exist: `builder.buildAndStart(keys, { signal, timeoutMs })` starts selected services and rolls back on failure (`DiBagStartupError`) or cancellation (`DiBagStartupCancelledError` with `cleanupPromise`); `bag.close()` disposes dependents before dependencies and rejects with `DiBagCleanupError` when a disposer fails; a `withDisposal` factory's value is an **owned resource**, a plain factory's value is **borrowed** (CONTEXT.md). What is missing is the piece that connects those to React's mount/cleanup/remount and identity changes, and that is the `RuntimeOwner`.

### Three layers

1. **Application runtime** (`examples/react/app-runtime.ts`): built once by `bootstrap()` before `createRoot`, from adapters the host chose (`Storage`, `Transport`). `transport` is owned (`withDisposal`), `storage` is borrowed (an IndexedDB-style store has nothing to close). Lifetime `root`.
2. **Project runtime** (`examples/react/project-runtime.ts`): `createProjectRuntime(app.services, projectId, { signal })` builds an *independent* bag whose `storage` and `transport` registrations return the app's instances with no disposer — borrowed by value, so closing a project cannot dispose them — and which owns `lock` (exclusive per project), `manifest` (fetched through the transport, cooperative via `factoryCtx.signal`), and `documents` (an external store). `buildAndStart(['lock', 'manifest', 'documents'], { signal })` is the startup.
3. **Runtime owner** (`examples/react/runtime-owner.ts`): framework-free, generic over anything with `close()`.

### The owner's contract

- `select(identity): Selection` — makes this the **live selection**. If the current runtime has the same identity and did not fail, it is kept; otherwise the current slot is retired and a new slot (generation `n+1`, fresh `AbortController`) starts. `Selection.release()` retires the current slot only if that selection is still live; releasing a stale selection is a no-op. That is exactly what Strict Mode's setup → cleanup → setup needs: the first selection is released (its slot aborted before or during startup), the second becomes live and ends `ready` with generation 2.
- `retry()` — restarts the live identity after a `failed` startup without changing which selection is live, so the effect's eventual cleanup still releases the retried runtime.
- **Never publish a stale runtime.** `run(slot)` checks `slot.controller.signal.aborted` after `start` settles. A runtime that arrives late is closed at once and never published; a startup that rejects after abort is treated as cancelled and its `DiBagStartupCancelledError.cleanupPromise` is awaited and owned.
- **Serialized teardown.** `retire(slot)` appends `awaitRetired(slot)` to a chain; every startup begins with `await this.chain`. A slot's `done` promise settles only when its startup has settled *and* any teardown it owes (close of its runtime, or cleanup of its cancelled startup) has settled. So a replacement never starts while the previous runtime's disposers are running — the exclusive lock cannot overlap.
- **Bounded wait is opt-in and uniform.** With `closeTimeoutMs` set, `awaitRetired` races `slot.done` against a timer; on expiry the sink receives `{ phase: 'close-wait-expired' }` and the chain proceeds. The teardown keeps running and a later rejection still reaches the sink as `close-failed`. The overlap that follows is the documented policy: the resource itself refuses a second holder, so the replacement's startup fails visibly instead of silently sharing. Unset (the default) means wait however long teardown takes.
- **Explicit sink.** `onFailure(failure)` receives every `close-failed` and `close-wait-expired`. Nothing is swallowed; nothing is logged by the owner.
- `subscribe`/`getSnapshot` publish frozen, referentially stable `RuntimeStatus` values: `idle | starting | ready | failed | closed`.
- `close()` retires the current slot, publishes `closed`, awaits the chain; `select` after `close` throws. `settled()` returns the chain for tests and shutdown.

### React layer (`examples/react/react-runtime.tsx`)

`useRuntimeStatus(owner)` = `useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot)`. `useSelectedRuntime(owner, identity)` selects in `useEffect` keyed on `[owner, identity]` and releases in cleanup. `createServicesContext<S>(name)` gives a Context plus `useServices()`. `RuntimeProvider` renders `starting`, `failed(error, retry)`, or the Context provider with `services(runtime)` — components see `ProjectServices`, never the bag. One provider per owner; the guide says so.

### Reactivity

`DocumentsStore extends ExternalStore<readonly DocumentRecord[]>` with `subscribe`/`getSnapshot`/`add`. `Documents` calls `useSyncExternalStore(documents.subscribe, documents.getSnapshot)`. Resolving `documents` gives access; subscribing gives re-renders. The guide states that distinction.

### Browser lane

`scripts/react-browser-lane.ts` bundles `examples/react/browser-scenario.tsx` with the pinned esbuild (`--platform=browser --format=esm --jsx=automatic --define:process.env.NODE_ENV=...`), twice: `development` (unminified, `--jsx-dev`; Strict Mode's double effect invocation exists only here) and `production` (`--minify`). `assertReactMetafile` allows inputs only under `src/`, `examples/react/`, `node_modules/react/`, `node_modules/react-dom/`, `node_modules/scheduler/`, and rejects `node:` inputs, externals, and `src/node.ts`. `executeReactPage` mirrors `executeBrowserWorker` but is a **page**: `page.setContent` with a body, `page.addScriptTag({ content, type: 'module' })`, an exposed `__diBagReactReport` function, `pageerror` and typed `console` capture. The scenario drives the real DOM (select change events, button clicks) and reports one structured object; `evaluateReactPageProtocol` compares it to `expectedReactReport(mode, reactVersion)` exactly, fails on any console `error`/`warning`, any page error, or any timeout. Rows are written to `docs/benchmarks/results/<date>-<sha7>/react-browser.jsonl` (untracked, uploaded by CI like `platform.jsonl`). `npm run check:react-browser` requires both rows to pass; the portable CI job runs it after `check:platform`.

### Versions exercised in CI

React 19.3.0 (root `package.json`), Chromium 153.0.8010.12 as installed by Playwright 1.63.0, esbuild 0.28.2 (`tools/platform/package.json`); each row records `react`, `mode`, and the pinned tool versions.

### Decisions and rejected alternatives

1. **Project runtime is an independent bag, not `app.createScope()`.** `buildAndStart` is the only startup primitive with cancellation and rollback; a scope has none, and a tracked child ties teardown ordering to the parent. Borrowing by value makes "not disposed by the wrong owner" structural rather than a convention. Cost: the app owner must close project runtimes before the app bag (bootstrap's `shutdown` does), because a borrowed transport must outlive its borrowers.
2. **Handle-based release, not `release(identity)`.** With `retry()` and Strict Mode both in play, identity-keyed release is ambiguous (which of two selections of `alpha` is releasing?). A `Selection` handle that only acts while live is precise and makes stale-effect cleanup a no-op by construction.
3. **No reference counting or deferred release.** A refcount with a grace period would avoid the extra startup Strict Mode causes, but it relies on timing and hides ordering bugs — the very thing this issue asks to prove. The owner already waits one microtask (`await this.chain`) before calling `start`, so the synchronous setup-cleanup-setup never invokes the first startup at all; the second selection is generation 2 and is the one that runs. Expensive shared work belongs in the app runtime, which lives outside effects.
4. **Owner-side bounded wait, not `bag.close({ timeoutMs })`.** The library's bounded close names pending disposers, which is valuable, but the owner must also bound the wait for a cancelled startup's `cleanupPromise` and for a `start` that ignores its signal, and racing two expiry mechanisms of equal duration makes the reported shape nondeterministic. One uniform race keeps the tests exact; the guide points at `close({ timeoutMs })` for labels.
5. **React in root `devDependencies`, not `tools/platform`.** `tsconfig.json` includes `examples`, so the `.tsx` files are covered by `npm run typecheck` and the native compiler with no second tsconfig; esbuild resolves `react` from the root as any consumer would. The published package is unaffected (`tests/release-artifacts.test.ts` checks `dependencies`, not `devDependencies`).
6. **A separate lane script, not a fourth row in `platform-evidence.ts`.** `writePlatformMatrix` and `platformEvidenceExitCode` pin a three-row matrix (`archive, deno-root, browser-worker-minified`) and `tests/platform-evidence.test.ts` pins that contract. The React lane reuses `verifyTool`, `stableJson`, `platformGit`, `playwrightPackageEntry` and writes its own `react-browser.jsonl`.
7. **Bundle from `src`, not from the packed archive.** The archive lane already proves the packed root entry runs in a browser; the React lane proves the recipe. Consistent with every other example importing `'../../src'`.
8. **Development and production builds both run.** Strict Mode only double-invokes in development; the minified production bundle is what ships. The expected report differs only in `mounted.generation` (2 vs 1).
9. **Console policy:** `log`/`info`/`debug` are recorded in the row but allowed (React's DevTools nag is `info`); `error` and `warning` fail the lane, which makes React's own warnings (missing keys, act, hydration) assertions.
10. **#28 dependency.** The recipe uses `DiBag.fromFactory(f, { acquisitionMode })` everywhere. Task 6 is conditional: if `DiBag.fromSyncFactory`/`fromAsyncFactory` exist when this plan executes, switch the example and the guide to them; otherwise leave the explicit modes and the guide's one-sentence note.
11. **Graduation criterion** (recorded, not done here): the owner becomes an optional package (`@di-bag/react` or `di-bag-react`) only when a second application in a different repository adopts `runtime-owner.ts` unchanged and the React layer needs a change that would otherwise be copied in both. Until then the example is the deliverable; copying ~200 lines is cheaper than a peer dependency.
12. **What is adopted from the precedents:** from Obsidian, graphs (here bags) scoped to a lifecycle and destroyed when the last requester unmounts, and gradual adoption; from inversify-react, a Context `Provider` per ownership level and a hierarchy of providers (app → project); from react-ioc, disposal when the provider unmounts. **Left out:** decorators and `reflect-metadata`, a generic `useInjection()`/`useInstance()` hook (components receive narrow interfaces), a library-owned observable system (Obsidian's `Observable`/`useObserver`; here any `subscribe`/`getSnapshot` store), and creating containers during render or in constructors — startup is asynchronous and effect-owned here, which none of the three model.

### File structure

| File | Responsibility |
| --- | --- |
| `examples/react/services.ts` | Narrow interfaces the React tree sees; `ExternalStore` shape |
| `examples/react/fakes.ts` | In-memory `Storage`/`Transport` with gates; used by tests and the browser scenario |
| `examples/react/app-runtime.ts` | `createAppBuilder`, `createAppRuntime` |
| `examples/react/project-runtime.ts` | `createProjectBuilder`, `createProjectRuntime` |
| `examples/react/runtime-owner.ts` | `RuntimeOwner`, `RuntimeStatus`, `OwnerFailure`, `Selection` |
| `examples/react/react-runtime.tsx` | `useRuntimeStatus`, `useSelectedRuntime`, `createServicesContext`, `RuntimeProvider` |
| `examples/react/app.tsx` | The demo UI: project selector, status states, documents list |
| `examples/react/bootstrap.tsx` | `bootstrap(container, adapters, options)`: app runtime, owner, root, `shutdown`, HMR and `pagehide` hooks |
| `examples/react/main.tsx` | The human-runnable page entry |
| `examples/react/browser-scenario.tsx` | The CI-driven scenario and its `ScenarioReport` type |
| `scripts/react-browser-lane.ts` | Bundle, drive, evaluate, evidence rows, CLI (`--required`, `--page`) |
| `tests/react/project-runtime.test.ts` | Composition: isolation, borrowing, failure rollback, cancellation, the store |
| `tests/react/runtime-owner.test.ts` | Owner behaviour with real bags and fake factories |
| `tests/platform/react-page.test.ts` | Metafile and protocol oracles, driver mapping, real Chromium run when provisioned |
| `docs/guides/react-integration.md` | The guide |

---

### Task 1: The framework-free composition — services, fakes, app runtime, project runtime

**Files:**
- Modify: `package.json:78-82` (`devDependencies`), `package-lock.json` (via `npm install`), `tsconfig.json:2-15` (`jsx`)
- Create: `examples/react/services.ts`, `examples/react/fakes.ts`, `examples/react/app-runtime.ts`, `examples/react/project-runtime.ts`
- Test: `tests/react/project-runtime.test.ts`
- Modify: `tests/test-lanes.test.ts:28-31` (one pin)

**Interfaces:**
- Consumes: `DiBag.createBuilder`, `DiBag.fromFactory(f, { acquisitionMode })`, `DiBag.withDisposal`, `DiBag.withLifetime`, `builder.buildAndStart(keys, options?: StartupOptions)`, `bag.close(options?: CloseOptions)`, `DiBagStartupError`, `DiBagStartupCancelledError` from `src`.
- Produces: `createMemoryStorage(options?: { releaseGate?: (projectId: string) => Promise<void> | undefined }): MemoryStorage` (`events: string[]`, `held: ReadonlySet<string>`); `createMemoryTransport(options?: { failing?: readonly string[]; manifestGate?: (projectId: string) => Promise<void> | undefined }): MemoryTransport` (`calls: string[]`, `closes: number`); `gate(): { opened: Promise<void>; open(): void }`; `createAppRuntime(adapters: AppAdapters, options?: StartupOptions): Promise<AppRuntime>` where `AppRuntime = { services: AppServices; close(options?: CloseOptions): Promise<void> }`; `createProjectRuntime(app: AppServices, projectId: string, options?: StartupOptions): Promise<ProjectRuntime>` where `ProjectRuntime = { services: ProjectServices; close(options?: CloseOptions): Promise<void> }`; `ProjectServices = { projectId: string; name: string; documents: DocumentsStore }`; `DocumentsStore = ExternalStore<readonly DocumentRecord[]> & { add(title: string): Promise<void> }`.

- [ ] **Step 1: Install React as exact development dependencies and enable JSX**

Run: `npm install --save-dev --save-exact react@19.3.0 react-dom@19.3.0 @types/react@19.3.0 @types/react-dom@19.3.0`
Expected: `package.json` `devDependencies` now lists the four packages with exact versions (no `^`), `package-lock.json` updated, `dependencies` still absent.

In `tsconfig.json` add `"jsx": "react-jsx",` after `"target": "es2022",`.

Run: `npm run typecheck`
Expected: PASS (no `.tsx` files exist yet; this proves the option is accepted).

- [ ] **Step 2: Write the narrow service interfaces**

Create `examples/react/services.ts`:

```ts
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
```

- [ ] **Step 3: Write the in-memory adapters**

Create `examples/react/fakes.ts`:

```ts
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
```

- [ ] **Step 4: Write the application runtime**

Create `examples/react/app-runtime.ts`:

```ts
import { DiBag, type CloseOptions, type StartupOptions } from '../../src';
import type { AppServices, Storage, Transport } from './services';

export type AppAdapters = { readonly storage: Storage; readonly transport: Transport };

export interface AppRuntime {
  readonly services: AppServices;
  close(options?: CloseOptions): Promise<void>;
}

/**
 * The application graph. Built once at bootstrap, outside React, from adapters the
 * host chose. Every stage names its acquisition mode: browsers have no
 * `process.getBuiltinModule`, so `auto` would throw `DI_BAG_CLASSIFIER_REQUIRED`.
 */
export function createAppBuilder(adapters: AppAdapters) {
  return DiBag.createBuilder().register({
    // Borrowed: IndexedDB-style storage has no close; the bag never disposes it.
    storage: DiBag.withLifetime(DiBag.fromFactory((): Storage => adapters.storage, { acquisitionMode: 'raw' }), 'root'),
    // Owned: bootstrap hands the transport over, and the app bag closes it exactly once.
    transport: DiBag.withLifetime(
      DiBag.withDisposal(DiBag.fromFactory((): Transport => adapters.transport, { acquisitionMode: 'raw' }), transport => transport.close()),
      'root',
    ),
  });
}

export async function createAppRuntime(adapters: AppAdapters, options?: StartupOptions): Promise<AppRuntime> {
  const bag = await createAppBuilder(adapters).buildAndStart(['storage', 'transport'], options);
  const services: AppServices = { storage: bag.resolve('storage'), transport: bag.resolve('transport') };
  return { services, close: closeOptions => bag.close(closeOptions) };
}
```

- [ ] **Step 5: Write the project runtime**

Create `examples/react/project-runtime.ts`:

```ts
import { DiBag, type CloseOptions, type StartupOptions } from '../../src';
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
    projectId: DiBag.fromFactory(() => projectId, { acquisitionMode: 'raw' }),
    storage: DiBag.fromFactory((): Storage => app.storage, { acquisitionMode: 'raw' }),
    transport: DiBag.fromFactory((): Transport => app.transport, { acquisitionMode: 'raw' }),
    lock: DiBag.withDisposal(
      DiBag.fromFactory(({ storage, projectId }: { storage: Storage; projectId: string }) => storage.lock(projectId), { acquisitionMode: 'nativePromise' }),
      lock => lock.release(),
    ),
    // Depends on the lock so nothing is fetched for a project another runtime still holds.
    manifest: DiBag.fromFactory(
      async ({ transport, projectId, lock }: { transport: Transport; projectId: string; lock: Promise<ProjectLock> }, factoryCtx) => {
        await lock;
        return transport.fetchManifest(projectId, factoryCtx.signal);
      },
      { context: 'acquisition', acquisitionMode: 'nativePromise' },
    ),
    documents: DiBag.fromFactory(
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
      { acquisitionMode: 'nativePromise' },
    ),
  });
}

/** Start a project runtime; `options.signal` cancels the wait and releases what was acquired. */
export async function createProjectRuntime(app: AppServices, projectId: string, options?: StartupOptions): Promise<ProjectRuntime> {
  const bag = await createProjectBuilder(app, projectId).buildAndStart(['lock', 'manifest', 'documents'], options);
  const [manifest, documents] = await Promise.all([bag.resolve('manifest'), bag.resolve('documents')]);
  const services: ProjectServices = { projectId, name: manifest.name, documents };
  return { services, close: closeOptions => bag.close(closeOptions) };
}
```

- [ ] **Step 6: Write the failing composition tests**

Create `tests/react/project-runtime.test.ts`:

```ts
import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test';
import { DiBagStartupCancelledError, DiBagStartupError } from '../../src';
import { createAppRuntime } from '../../examples/react/app-runtime';
import { createMemoryStorage, createMemoryTransport } from '../../examples/react/fakes';
import { createProjectRuntime } from '../../examples/react/project-runtime';
import { deferred } from '../helpers';

const tick = () => new Promise<void>(resolve => setImmediate(resolve));
const unhandled: unknown[] = [];
const collect = (reason: unknown) => { unhandled.push(reason); };
beforeAll(() => { process.on('unhandledRejection', collect); });
afterAll(() => { process.off('unhandledRejection', collect); });
afterEach(async () => { await tick(); expect(unhandled).toEqual([]); });

// The in-memory adapters are the test configuration; the composition is the one the browser runs.
function fakes(options: Parameters<typeof createMemoryTransport>[0] = {}) {
  return { storage: createMemoryStorage(), transport: createMemoryTransport(options) };
}

test('two project runtimes isolate what they own and share only the borrowed app services', async () => {
  const adapters = fakes();
  const app = await createAppRuntime(adapters);
  const a = await createProjectRuntime(app.services, 'a');
  const b = await createProjectRuntime(app.services, 'b');
  expect(a.services.documents).not.toBe(b.services.documents);
  expect(a.services.name).toBe('Project a');
  expect([...adapters.storage.held].sort()).toEqual(['a', 'b']);
  await a.services.documents.add('first');
  expect(b.services.documents.getSnapshot()).toEqual([]);
  await a.close();
  // Closing a project releases its lock and nothing the app owns.
  expect([...adapters.storage.held]).toEqual(['b']);
  expect(adapters.transport.closes).toBe(0);
  await b.services.documents.add('still works');
  expect(b.services.documents.getSnapshot()).toHaveLength(1);
  await b.close();
  expect(adapters.transport.closes).toBe(0);
  await app.close();
  expect(adapters.transport.closes).toBe(1);
  expect(adapters.storage.events).toEqual(['acquire:a', 'acquire:b', 'release:a', 'release:b']);
});

test('a failing manifest fetch fails startup and releases the lock acquired before it', async () => {
  const adapters = fakes({ failing: ['broken'] });
  const app = await createAppRuntime(adapters);
  const error = await createProjectRuntime(app.services, 'broken').then(() => undefined, (failure: unknown) => failure);
  expect(error).toBeInstanceOf(DiBagStartupError);
  expect((error as DiBagStartupError).cause).toBeInstanceOf(Error);
  expect(((error as DiBagStartupError).cause as Error).message).toBe('no manifest for broken');
  expect((error as DiBagStartupError).cleanupFailures).toEqual([]);
  expect(adapters.storage.events).toEqual(['acquire:broken', 'release:broken']);
  expect(adapters.storage.held.size).toBe(0);
  await app.close();
});

test('a cancelled startup rejects promptly and releases the lock once the fetch settles', async () => {
  const manifest = deferred<void>();
  const adapters = fakes({ manifestGate: id => (id === 'slow' ? manifest.promise : undefined) });
  const app = await createAppRuntime(adapters);
  const controller = new AbortController();
  const starting = createProjectRuntime(app.services, 'slow', { signal: controller.signal });
  await tick();
  expect(adapters.storage.events).toEqual(['acquire:slow']);
  controller.abort();
  const error = await starting.then(() => undefined, (failure: unknown) => failure);
  expect(error).toBeInstanceOf(DiBagStartupCancelledError);
  // Cooperative: the fetch has not settled, so the lock is still held and cleanup is still pending.
  expect(adapters.storage.held.has('slow')).toBe(true);
  manifest.resolve();
  await (error as DiBagStartupCancelledError).cleanupPromise;
  expect(adapters.storage.events).toEqual(['acquire:slow', 'release:slow']);
  await app.close();
});

test('the same project cannot be opened twice while its lock is held', async () => {
  const adapters = fakes();
  const app = await createAppRuntime(adapters);
  const first = await createProjectRuntime(app.services, 'a');
  const error = await createProjectRuntime(app.services, 'a').then(() => undefined, (failure: unknown) => failure);
  expect(error).toBeInstanceOf(DiBagStartupError);
  expect(((error as DiBagStartupError).cause as Error).message).toBe('project a is locked by another runtime');
  await first.services.documents.add('still mine');
  await first.close();
  const second = await createProjectRuntime(app.services, 'a');
  expect(second.services.documents.getSnapshot()).toEqual([{ id: 'a-1', title: 'still mine' }]);
  await second.close();
  await app.close();
  expect(adapters.storage.events).toEqual(['acquire:a', 'release:a', 'acquire:a', 'release:a']);
});

test('the documents store is an external store: stable snapshots, one notification per change', async () => {
  const adapters = fakes();
  const app = await createAppRuntime(adapters);
  const runtime = await createProjectRuntime(app.services, 'a');
  const { documents } = runtime.services;
  const before = documents.getSnapshot();
  expect(documents.getSnapshot()).toBe(before);
  let notified = 0;
  const unsubscribe = documents.subscribe(() => { notified += 1; });
  await documents.add('one');
  expect(notified).toBe(1);
  const after = documents.getSnapshot();
  expect(after).not.toBe(before);
  expect(documents.getSnapshot()).toBe(after);
  unsubscribe();
  await documents.add('two');
  expect(notified).toBe(1);
  expect(documents.getSnapshot()).toHaveLength(2);
  await runtime.close();
  await app.close();
});
```

Then in `tests/test-lanes.test.ts` add, after the line `expect(fast).toContain('tests/scopes.test.ts');`:

```ts
  expect(fast).toContain('tests/react/project-runtime.test.ts');
```

- [ ] **Step 7: Run the tests**

Run: `bun test tests/react/project-runtime.test.ts`
Expected: PASS, 5 tests. (Steps 2–5 were written before the test because the test exercises the whole composition; if a test fails, the composition is wrong, not the test — fix the example.) If the first test fails on `events` order, `close()` disposed the transport: the `transport` registration in `project-runtime.ts` has a disposer it must not have.

Run: `npm run typecheck && npm_config_update_notifier=false npm run test:fast && bun test tests/test-lanes.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json examples/react tests/react tests/test-lanes.test.ts
git commit -m "feat(examples): framework-free app and project runtimes for the React recipe"
```

---

### Task 2: The runtime owner

**Files:**
- Create: `examples/react/runtime-owner.ts`
- Test: `tests/react/runtime-owner.test.ts`
- Modify: `tests/test-lanes.test.ts` (one pin)

**Interfaces:**
- Consumes: `DiBagStartupCancelledError` (its `cleanupPromise`), `CloseOptions` from `src`.
- Produces: `class RuntimeOwner<T extends Closable>` with `constructor(options: RuntimeOwnerOptions<T>)`, `select(identity: string): Selection`, `retry(): void`, `settled(): Promise<void>`, `close(): Promise<void>`, `readonly subscribe: (listener: () => void) => () => void`, `readonly getSnapshot: () => RuntimeStatus<T>`; `interface Closable { close(options?: CloseOptions): Promise<void> }`; `type RuntimeStatus<T>` (`idle | starting | ready | failed | closed`); `type OwnerFailure` (`close-failed | close-wait-expired`); `interface RuntimeOwnerOptions<T> { start(identity, signal): Promise<T>; onFailure(failure): void; closeTimeoutMs?: number }`; `interface Selection { identity: string; release(): void }`.

- [ ] **Step 1: Write the failing tests**

Create `tests/react/runtime-owner.test.ts`:

```ts
import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test';
import { DiBag, DiBagCleanupError, DiBagStartupError, type CloseOptions } from '../../src';
import { RuntimeOwner, type OwnerFailure } from '../../examples/react/runtime-owner';
import { deferred } from '../helpers';

const tick = () => new Promise<void>(resolve => setImmediate(resolve));
async function settle(): Promise<void> { for (let round = 0; round < 5; round++) await tick(); }
const unhandled: unknown[] = [];
const collect = (reason: unknown) => { unhandled.push(reason); };
beforeAll(() => { process.on('unhandledRejection', collect); });
afterAll(() => { process.off('unhandledRejection', collect); });
afterEach(async () => { await settle(); expect(unhandled).toEqual([]); });

type FakeRuntime = { readonly identity: string; close(options?: CloseOptions): Promise<void> };

type Fakes = {
  readonly log: string[];
  /** Hold a startup open per identity; an identity without a gate is ready at once. */
  readonly readyGate?: (identity: string) => Promise<void> | undefined;
  readonly disposeGate?: (identity: string) => Promise<void> | undefined;
  readonly failing?: string[];
  readonly disposeFailing?: readonly string[];
  /** Exclusive: acquiring an identity already in the set throws. */
  readonly lock?: Set<string>;
};

/** A real bag per startup: buildAndStart supplies cancellation and rollback; only the factories are fake. */
function fakeStart(fakes: Fakes) {
  return async (identity: string, signal: AbortSignal): Promise<FakeRuntime> => {
    fakes.log.push(`start:${identity}`);
    const bag = await DiBag.createBuilder().register({
      resource: DiBag.withDisposal(
        DiBag.fromFactory(async () => {
          if (fakes.lock?.has(identity)) throw new Error(`${identity} is held`);
          fakes.lock?.add(identity);
          fakes.log.push(`acquire:${identity}`);
          await fakes.readyGate?.(identity);
          return identity;
        }, { acquisitionMode: 'nativePromise' }),
        async value => {
          fakes.log.push(`dispose:${value}`);
          await fakes.disposeGate?.(value);
          fakes.lock?.delete(value);
          if (fakes.disposeFailing?.includes(value)) throw new Error(`${value} dispose failed`);
        },
      ),
      // Fails after `resource` is owned, so a failed startup has something to roll back.
      checkpoint: DiBag.fromFactory(async ({ resource }: { resource: Promise<string> }) => {
        await resource;
        if (fakes.failing?.includes(identity)) throw new Error(`${identity} failed`);
        return true;
      }, { acquisitionMode: 'nativePromise' }),
    }).buildAndStart(['resource', 'checkpoint'], { signal });
    fakes.log.push(`ready:${identity}`);
    return { identity, close: options => bag.close(options) };
  };
}

function createOwner(fakes: Fakes, options: { closeTimeoutMs?: number } = {}) {
  const failures: OwnerFailure[] = [];
  const statuses: string[] = [];
  const owner = new RuntimeOwner<FakeRuntime>({ start: fakeStart(fakes), onFailure: failure => { failures.push(failure); }, ...options });
  owner.subscribe(() => {
    const status = owner.getSnapshot();
    statuses.push('identity' in status ? `${status.state}:${status.identity}#${status.generation}` : status.state);
  });
  return { owner, failures, statuses };
}

test('select starts a runtime, ready publishes it, and release closes it', async () => {
  const fakes: Fakes = { log: [] };
  const { owner, statuses, failures } = createOwner(fakes);
  expect(owner.getSnapshot()).toEqual({ state: 'idle' });
  const selection = owner.select('a');
  expect(owner.getSnapshot()).toEqual({ state: 'starting', identity: 'a', generation: 1 });
  await settle();
  const ready = owner.getSnapshot();
  expect(ready).toMatchObject({ state: 'ready', identity: 'a', generation: 1 });
  expect(owner.getSnapshot()).toBe(ready);
  expect(Object.isFrozen(ready)).toBe(true);
  selection.release();
  expect(owner.getSnapshot()).toEqual({ state: 'idle' });
  await owner.settled();
  expect(fakes.log).toEqual(['start:a', 'acquire:a', 'ready:a', 'dispose:a']);
  expect(statuses).toEqual(['starting:a#1', 'ready:a#1', 'idle']);
  expect(failures).toEqual([]);
});

test('Strict Mode setup-cleanup-setup ends with a fresh generation 2 and never starts generation 1', async () => {
  const fakes: Fakes = { log: [] };
  const { owner, statuses } = createOwner(fakes);
  const first = owner.select('a');
  first.release();
  const second = owner.select('a');
  await settle();
  expect(owner.getSnapshot()).toMatchObject({ state: 'ready', identity: 'a', generation: 2 });
  expect(fakes.log).toEqual(['start:a', 'acquire:a', 'ready:a']);
  first.release();
  expect(owner.getSnapshot()).toMatchObject({ state: 'ready', generation: 2 });
  second.release();
  await owner.settled();
  expect(fakes.log).toEqual(['start:a', 'acquire:a', 'ready:a', 'dispose:a']);
  expect(statuses).toEqual(['starting:a#1', 'idle', 'starting:a#2', 'ready:a#2', 'idle']);
});

test('a release during startup cancels it and releases what the startup had acquired', async () => {
  const ready = deferred<void>();
  const fakes: Fakes = { log: [], readyGate: () => ready.promise };
  const { owner, statuses, failures } = createOwner(fakes);
  const selection = owner.select('a');
  await settle();
  expect(fakes.log).toEqual(['start:a', 'acquire:a']);
  selection.release();
  expect(owner.getSnapshot()).toEqual({ state: 'idle' });
  ready.resolve();
  await owner.settled();
  expect(fakes.log).toEqual(['start:a', 'acquire:a', 'dispose:a']);
  expect(statuses).not.toContain('ready:a#1');
  expect(failures).toEqual([]);
});

test('a startup finishing after its identity was replaced is never published and is released first', async () => {
  const gates = { a: deferred<void>(), b: deferred<void>() };
  const fakes: Fakes = { log: [], readyGate: identity => gates[identity as 'a' | 'b'].promise };
  const { owner, statuses } = createOwner(fakes);
  owner.select('a');
  await settle();
  owner.select('b');
  expect(owner.getSnapshot()).toEqual({ state: 'starting', identity: 'b', generation: 2 });
  await settle();
  expect(fakes.log).toEqual(['start:a', 'acquire:a']);
  gates.a.resolve();
  await settle();
  expect(fakes.log).toEqual(['start:a', 'acquire:a', 'dispose:a', 'start:b', 'acquire:b']);
  gates.b.resolve();
  await settle();
  expect(owner.getSnapshot()).toMatchObject({ state: 'ready', identity: 'b', generation: 2 });
  expect(statuses).not.toContain('ready:a#1');
  await owner.close();
});

test('a start that ignores its signal delays the replacement only until the bounded wait expires', async () => {
  const log: string[] = [];
  const failures: OwnerFailure[] = [];
  const late = deferred<FakeRuntime>();
  const owner = new RuntimeOwner<FakeRuntime>({
    start: identity => (identity === 'a' ? late.promise : Promise.resolve({ identity, close: async () => { log.push(`close:${identity}`); } })),
    onFailure: failure => { failures.push(failure); },
    closeTimeoutMs: 5,
  });
  owner.select('a');
  await settle();
  owner.select('b');
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(failures).toEqual([{ phase: 'close-wait-expired', identity: 'a', generation: 1, timeoutMs: 5 }]);
  expect(owner.getSnapshot()).toMatchObject({ state: 'ready', identity: 'b', generation: 2 });
  late.resolve({ identity: 'a', close: async () => { log.push('close:a'); } });
  await settle();
  expect(log).toEqual(['close:a']);
  expect(owner.getSnapshot()).toMatchObject({ state: 'ready', identity: 'b' });
  await owner.close();
  expect(log).toEqual(['close:a', 'close:b']);
});

test('a failed startup publishes the error after buildAndStart released what it acquired', async () => {
  const fakes: Fakes = { log: [], failing: ['a'] };
  const { owner } = createOwner(fakes);
  owner.select('a');
  await settle();
  const status = owner.getSnapshot();
  expect(status).toMatchObject({ state: 'failed', identity: 'a', generation: 1 });
  expect((status as { error: unknown }).error).toBeInstanceOf(DiBagStartupError);
  expect(fakes.log).toEqual(['start:a', 'acquire:a', 'dispose:a']);
  owner.retry();
  await settle();
  expect(owner.getSnapshot()).toMatchObject({ state: 'failed', generation: 2 });
  expect(fakes.log).toEqual(['start:a', 'acquire:a', 'dispose:a', 'start:a', 'acquire:a', 'dispose:a']);
});

test('retry starts the live identity again and the original selection still releases it', async () => {
  const failing = ['a'];
  const fakes: Fakes = { log: [], failing };
  const { owner } = createOwner(fakes);
  const selection = owner.select('a');
  await settle();
  expect(owner.getSnapshot()).toMatchObject({ state: 'failed', generation: 1 });
  failing.length = 0;
  owner.retry();
  await settle();
  expect(owner.getSnapshot()).toMatchObject({ state: 'ready', identity: 'a', generation: 2 });
  selection.release();
  await owner.settled();
  expect(fakes.log.at(-1)).toBe('dispose:a');
  expect(owner.getSnapshot()).toEqual({ state: 'idle' });
});

test('a rejecting disposer reaches the sink and the replacement still starts', async () => {
  const fakes: Fakes = { log: [], disposeFailing: ['a'] };
  const { owner, failures } = createOwner(fakes);
  owner.select('a');
  await settle();
  owner.select('b');
  await settle();
  expect(failures).toHaveLength(1);
  expect(failures[0]).toMatchObject({ phase: 'close-failed', identity: 'a', generation: 1 });
  expect((failures[0] as { error: unknown }).error).toBeInstanceOf(DiBagCleanupError);
  expect(owner.getSnapshot()).toMatchObject({ state: 'ready', identity: 'b', generation: 2 });
  expect(fakes.log).toEqual(['start:a', 'acquire:a', 'ready:a', 'dispose:a', 'start:b', 'acquire:b', 'ready:b']);
  await owner.close();
});

test('without a deadline a replacement waits for the exclusive resource to be released', async () => {
  const disposing = deferred<void>();
  const fakes: Fakes = { log: [], disposeGate: () => disposing.promise, lock: new Set() };
  const { owner, failures } = createOwner(fakes);
  const first = owner.select('a');
  await settle();
  first.release();
  owner.select('a');
  await settle();
  expect(fakes.log).toEqual(['start:a', 'acquire:a', 'ready:a', 'dispose:a']);
  expect(owner.getSnapshot()).toEqual({ state: 'starting', identity: 'a', generation: 2 });
  disposing.resolve();
  await settle();
  expect(fakes.log).toEqual(['start:a', 'acquire:a', 'ready:a', 'dispose:a', 'start:a', 'acquire:a', 'ready:a']);
  expect(owner.getSnapshot()).toMatchObject({ state: 'ready', identity: 'a', generation: 2 });
  expect(failures).toEqual([]);
  await owner.close();
});

test('an expired bounded wait is reported, the replacement proceeds, and the late teardown still reports', async () => {
  const disposing = deferred<void>();
  const fakes: Fakes = { log: [], disposeGate: () => disposing.promise, disposeFailing: ['a'], lock: new Set() };
  const { owner, failures } = createOwner(fakes, { closeTimeoutMs: 5 });
  const first = owner.select('a');
  await settle();
  first.release();
  owner.select('a');
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(failures).toEqual([{ phase: 'close-wait-expired', identity: 'a', generation: 1, timeoutMs: 5 }]);
  // The documented overlap policy: the replacement started while 'a' was still held, so its startup failed visibly.
  const status = owner.getSnapshot();
  expect(status).toMatchObject({ state: 'failed', identity: 'a', generation: 2 });
  expect((((status as { error: unknown }).error as DiBagStartupError).cause as Error).message).toBe('a is held');
  expect(fakes.log).toEqual(['start:a', 'acquire:a', 'ready:a', 'dispose:a', 'start:a']);
  disposing.resolve();
  await settle();
  expect(failures).toHaveLength(2);
  expect(failures[1]).toMatchObject({ phase: 'close-failed', identity: 'a', generation: 1 });
  owner.retry();
  await settle();
  expect(owner.getSnapshot()).toMatchObject({ state: 'ready', identity: 'a', generation: 3 });
  await owner.close();
  expect(failures.map(failure => failure.phase)).toEqual(['close-wait-expired', 'close-failed', 'close-failed']);
});

test('selecting the current identity again keeps the runtime and only the newest selection releases it', async () => {
  const fakes: Fakes = { log: [] };
  const { owner } = createOwner(fakes);
  const first = owner.select('a');
  await settle();
  const second = owner.select('a');
  expect(owner.getSnapshot()).toMatchObject({ state: 'ready', generation: 1 });
  first.release();
  expect(owner.getSnapshot()).toMatchObject({ state: 'ready', generation: 1 });
  second.release();
  expect(owner.getSnapshot()).toEqual({ state: 'idle' });
  await owner.settled();
  expect(fakes.log).toEqual(['start:a', 'acquire:a', 'ready:a', 'dispose:a']);
});

test('close retires the runtime, waits for it, and refuses later selections', async () => {
  const fakes: Fakes = { log: [] };
  const { owner, statuses } = createOwner(fakes);
  owner.select('a');
  await settle();
  await owner.close();
  expect(fakes.log).toEqual(['start:a', 'acquire:a', 'ready:a', 'dispose:a']);
  expect(owner.getSnapshot()).toEqual({ state: 'closed' });
  expect(() => owner.select('b')).toThrow('runtime owner is closed');
  expect(statuses).toEqual(['starting:a#1', 'ready:a#1', 'closed']);
});

test('unsubscribe stops notifications', async () => {
  const { owner } = createOwner({ log: [] });
  let calls = 0;
  const unsubscribe = owner.subscribe(() => { calls += 1; });
  const selection = owner.select('a');
  expect(calls).toBe(1);
  await settle();
  expect(calls).toBe(2);
  unsubscribe();
  selection.release();
  expect(calls).toBe(2);
  await owner.settled();
});
```

Then in `tests/test-lanes.test.ts` add, after the `project-runtime` pin from Task 1:

```ts
  expect(fast).toContain('tests/react/runtime-owner.test.ts');
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/react/runtime-owner.test.ts`
Expected: FAIL — `Cannot find module '../../examples/react/runtime-owner'`.

- [ ] **Step 3: Write the owner**

Create `examples/react/runtime-owner.ts`:

```ts
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
```

Why `await this.chain` is the first statement of `run`: it is what makes Strict Mode's synchronous setup-cleanup-setup never invoke the first startup (the slot is aborted before the microtask runs), and it is what serializes every startup behind the previous slot's teardown. Do not move it.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test tests/react/runtime-owner.test.ts`
Expected: PASS, 13 tests. If the "without a deadline" test sees a second `start:a` before `disposing.resolve()`, `retire` is not appending `awaitRetired` before `replace` runs — check the order in `replace` (retire first, then create the slot). If the "Strict Mode" test logs two `start:a`, `run` is not awaiting the chain before calling `start`.

Run: `npm run typecheck && npm_config_update_notifier=false npm run test:fast && bun test tests/test-lanes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add examples/react/runtime-owner.ts tests/react/runtime-owner.test.ts tests/test-lanes.test.ts
git commit -m "feat(examples): runtime owner with generations, serialized teardown, and an explicit failure sink"
```

---

### Task 3: The React layer, the demo UI, bootstrap, and the browser scenario

No runtime test in this task: React needs a DOM, which Task 4 supplies in the pinned Chromium. The gate here is the type check, which covers every `.tsx` file through `tsconfig.json`'s `examples` include.

**Files:**
- Create: `examples/react/react-runtime.tsx`, `examples/react/app.tsx`, `examples/react/bootstrap.tsx`, `examples/react/main.tsx`, `examples/react/browser-scenario.tsx`

**Interfaces:**
- Consumes: `RuntimeOwner`, `RuntimeStatus`, `Closable`, `OwnerFailure` (Task 2); `createAppRuntime`, `AppAdapters`, `AppRuntime`, `createProjectRuntime`, `ProjectRuntime`, `ProjectServices`, fakes (Task 1); `react`, `react-dom/client`.
- Produces: `useRuntimeStatus(owner)`, `useSelectedRuntime(owner, identity)`, `createServicesContext<S>(name): { Context, useServices }`, `RuntimeProvider` (props `owner, identity, context, services, starting, failed, children`); `App({ owner, projects, initial })`; `bootstrap(container, adapters, options: { projects, initial, onFailure?, closeTimeoutMs? }): Promise<{ app, owner, root, shutdown }>`; `type ScenarioReport` (consumed by Task 4's `expectedReactReport`).

- [ ] **Step 1: Write the React layer**

Create `examples/react/react-runtime.tsx`:

```tsx
import { createContext, useContext, useEffect, useSyncExternalStore, type Context, type ReactNode } from 'react';
import type { Closable, RuntimeOwner, RuntimeStatus } from './runtime-owner';

/** The owner's status as React state; the snapshot is stable until the owner publishes another. */
export function useRuntimeStatus<T extends Closable>(owner: RuntimeOwner<T>): RuntimeStatus<T> {
  return useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
}

/**
 * Keep `identity` selected while the calling component is mounted with it. Selection
 * happens in an effect, never during render, so Strict Mode's setup-cleanup-setup
 * releases the first selection and ends with a fresh one.
 */
export function useSelectedRuntime<T extends Closable>(owner: RuntimeOwner<T>, identity: string): RuntimeStatus<T> {
  useEffect(() => {
    const selection = owner.select(identity);
    return () => { selection.release(); };
  }, [owner, identity]);
  return useRuntimeStatus(owner);
}

/** A Context for one narrow services interface plus the hook that reads it. */
export function createServicesContext<S>(name: string): { Context: Context<S | undefined>; useServices: () => S } {
  const Context = createContext<S | undefined>(undefined);
  return {
    Context,
    useServices: () => {
      const services = useContext(Context);
      if (services === undefined) throw new Error(`${name} are only available below a ready RuntimeProvider`);
      return services;
    },
  };
}

/** Selects `identity` for its lifetime and renders one of three states. One provider per owner. */
export function RuntimeProvider<T extends Closable, S>(props: {
  owner: RuntimeOwner<T>;
  identity: string;
  context: Context<S | undefined>;
  services: (runtime: T) => S;
  starting: ReactNode;
  failed: (error: unknown, retry: () => void) => ReactNode;
  children: ReactNode;
}): ReactNode {
  const status = useSelectedRuntime(props.owner, props.identity);
  if (status.state === 'ready') return <props.context.Provider value={props.services(status.runtime)}>{props.children}</props.context.Provider>;
  if (status.state === 'failed') return props.failed(status.error, () => props.owner.retry());
  return props.starting;
}
```

- [ ] **Step 2: Write the demo UI**

Create `examples/react/app.tsx`:

```tsx
import { useState, useSyncExternalStore } from 'react';
import { DiBagStartupError } from '../../src';
import type { ProjectRuntime } from './project-runtime';
import { createServicesContext, RuntimeProvider } from './react-runtime';
import type { RuntimeOwner } from './runtime-owner';
import type { ProjectServices } from './services';

export const projectServices = createServicesContext<ProjectServices>('project services');

/** The startup error wraps the factory's failure; show the cause. */
export function failureMessage(error: unknown): string {
  const cause = error instanceof DiBagStartupError ? error.cause : error;
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
```

- [ ] **Step 3: Write bootstrap and the page entry**

Create `examples/react/bootstrap.tsx`:

```tsx
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
  const app = await createAppRuntime(adapters, { timeoutMs: 5_000 });
  const owner = new RuntimeOwner<ProjectRuntime>({
    start: (projectId, signal) => createProjectRuntime(app.services, projectId, { signal, timeoutMs: 5_000 }),
    onFailure: options.onFailure ?? (failure => { console.error('project runtime teardown', failure); }),
    ...(options.closeTimeoutMs === undefined ? {} : { closeTimeoutMs: options.closeTimeoutMs }),
  });
  const root = createRoot(container);
  root.render(<StrictMode><App owner={owner} projects={options.projects} initial={options.initial} /></StrictMode>);
  let shuttingDown: Promise<void> | undefined;
  // Project runtimes borrow the app's transport, so they close before the app bag does.
  const shutdown = () => shuttingDown ??= (async () => { root.unmount(); await owner.close(); await app.close(); })();
  // A dev server with HMR replaces this module: close what this instance owns before the next one boots.
  onModuleReplaced(() => { void shutdown(); });
  // Navigation never waits for this. It is best effort; server-side leases and locks need their own expiry.
  window.addEventListener('pagehide', () => { void shutdown(); }, { once: true });
  return { app, owner, root, shutdown };
}

/** Vite-style `import.meta.hot`; a plain bundle has none and skips this. */
function onModuleReplaced(callback: () => void): void {
  (import.meta as unknown as { hot?: { dispose(callback: () => void): void } }).hot?.dispose(callback);
}
```

Create `examples/react/main.tsx`:

```tsx
import { bootstrap } from './bootstrap';
import { createMemoryStorage, createMemoryTransport } from './fakes';

// The runnable page: in-memory adapters stand in for IndexedDB and fetch. `npm run example:react` builds it.
const container = document.getElementById('root');
if (container === null) throw new Error('main.tsx needs a <div id="root"> to render into');
void bootstrap(container, { storage: createMemoryStorage(), transport: createMemoryTransport({ failing: ['broken'] }) }, {
  projects: ['alpha', 'beta', 'broken'],
  initial: 'alpha',
});
```

- [ ] **Step 4: Write the browser scenario**

Create `examples/react/browser-scenario.tsx`:

```tsx
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
```

- [ ] **Step 5: Type-check both compilers**

Run: `npm run typecheck && npm run typecheck:native`
Expected: PASS. Likely first errors and their fixes: `Cannot find module 'react/jsx-runtime'` means Task 1's install did not add `@types/react` — rerun the install; `'props.context.Provider' cannot be used as a JSX component` means `Context` was imported as a value instead of `type Context` — keep the `type` modifier.

If the platform tools are provisioned locally (`tools/platform-versions.local.json` shows esbuild pinned), also smoke the bundle now:

Run: `tools/platform/node_modules/esbuild/bin/esbuild examples/react/browser-scenario.tsx --bundle --platform=browser --format=esm --target=es2022 --jsx=automatic --jsx-dev '--define:process.env.NODE_ENV="development"' --log-level=error --outfile=/dev/null`
Expected: exit 0 and no output. A `node:` resolution error here means a `src` import reached the node facade — the example must import `'../../src'` only.

- [ ] **Step 6: Commit**

```bash
git add examples/react
git commit -m "feat(examples): React layer, demo UI, bootstrap, and browser scenario for the runtime owner"
```

---

### Task 4: The real-browser lane

**Files:**
- Create: `scripts/react-browser-lane.ts`
- Test: `tests/platform/react-page.test.ts`
- Modify: `scripts/platform-evidence.ts:228` (`function platformGit` → `export function platformGit`) and `:424` (`function playwrightPackageEntry` → `export function playwrightPackageEntry`)
- Modify: `scripts/test-lane.mjs:10` (add `'platform/react-page'` after `'platform/browser-worker'`), `tests/test-lanes.test.ts` (one pin)
- Modify: `package.json:22-47` (two scripts), `.github/workflows/ci.yml:88-90`

**Interfaces:**
- Consumes: `verifyTool`, `stableJson`, `platformGit`, `playwrightPackageEntry`, `PlatformRow`, `VerifiedTool`, `ToolUnavailableReason` from `scripts/platform-evidence.ts`; `ScenarioReport` (type only) from Task 3.
- Produces: `assertReactMetafile(value: unknown): void`; `installedReactVersion(root?): string`; `laneName(mode): string`; `expectedReactReport(mode, react): ScenarioReport`; `bundleReactEntry(esbuild, mode, options?: { entry?: string; format?: 'esm' | 'iife'; root?: string }): ReactBundle`; `evaluateReactPageProtocol(transcript, expected): { status: 'pass' } | { status: 'fail'; reason: string }`; `executeReactPage: ReactPageDriver`; `runReactPageLane(bundle, chromium, driver?, timeoutMs = 30_000, unavailablePlaywright?): Promise<PlatformRow>`; `runReactBrowserEvidence(root?): Promise<readonly PlatformRow[]>`; `writeReactPage(esbuild, directory, root?): string`.

- [ ] **Step 1: Write the failing lane tests**

Create `tests/platform/react-page.test.ts`:

```ts
import { afterEach, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import {
  assertReactMetafile,
  bundleReactEntry,
  evaluateReactPageProtocol,
  expectedReactReport,
  installedReactVersion,
  laneName,
  runReactPageLane,
  type ReactBundle,
  type ReactPageDriver,
  type ReactPageTranscript,
} from '../../scripts/react-browser-lane';
import { verifyTool, type VerifiedTool } from '../../scripts/platform-evidence';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

const react = installedReactVersion();
const fakeChromium = {
  status: 'pinned', name: 'chromium', argv: ['/fake/chromium'], versionArgv: ['/fake/chromium', '--version'],
  version: '1', versionText: '1\n', sha256: '1'.repeat(64), hashPath: '/fake/chromium',
} satisfies VerifiedTool;

function fakeBundle(source = 'void 0;', mode: 'development' | 'production' = 'development'): ReactBundle {
  const directory = mkdtempSync(join(tmpdir(), 'di-bag-react-test-'));
  roots.push(directory);
  const path = join(directory, 'bundle.js');
  const bytes = Uint8Array.from(Buffer.from(source));
  writeFileSync(path, bytes);
  const metafilePath = join(directory, 'bundle-meta.json');
  writeFileSync(metafilePath, '{"inputs":{},"outputs":{"bundle.js":{}}}\n');
  return { mode, path, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, metafilePath, react };
}

function transcript(overrides: Partial<ReactPageTranscript> = {}): ReactPageTranscript {
  return { reports: [expectedReactReport('development', react)], errors: [], console: [], timedOut: false, ...overrides };
}

const cleanMetafile = {
  inputs: {
    'examples/react/browser-scenario.tsx': { imports: [{ path: 'src/index.ts', kind: 'import-statement' }, { path: 'node_modules/react/index.js', kind: 'import-statement' }] },
    'src/index.ts': { imports: [] },
    'node_modules/react/index.js': { imports: [{ path: 'node_modules/react/cjs/react.development.js', kind: 'require-call' }] },
    'node_modules/react/cjs/react.development.js': { imports: [] },
    'node_modules/react-dom/client.js': { imports: [] },
    'node_modules/scheduler/index.js': { imports: [] },
  },
  outputs: { 'bundle.js': { imports: [] } },
};

test('react metafile accepts src, the example, and the React packages only', () => {
  expect(() => assertReactMetafile(cleanMetafile)).not.toThrow();
  const mutations: Array<[string, unknown, string]> = [
    ['node builtin input', { ...cleanMetafile, inputs: { ...cleanMetafile.inputs, 'node:fs': {} } }, 'node: input'],
    ['node facade', { ...cleanMetafile, inputs: { ...cleanMetafile.inputs, 'src/node.ts': {} } }, 'node facade'],
    ['foreign package', { ...cleanMetafile, inputs: { ...cleanMetafile.inputs, 'node_modules/lodash/index.js': {} } }, 'outside the allowed roots'],
    ['other example', { ...cleanMetafile, inputs: { ...cleanMetafile.inputs, 'examples/scopes.ts': {} } }, 'outside the allowed roots'],
    ['parent traversal', { ...cleanMetafile, inputs: { ...cleanMetafile.inputs, '../elsewhere/x.js': {} } }, 'outside the repository'],
    ['absolute path', { ...cleanMetafile, inputs: { ...cleanMetafile.inputs, '/tmp/x.js': {} } }, 'outside the repository'],
    ['external import', { ...cleanMetafile, inputs: { ...cleanMetafile.inputs, 'src/index.ts': { imports: [{ path: 'https://cdn.example/react.js', external: true }] } } }, 'external input'],
    ['node import', { ...cleanMetafile, inputs: { ...cleanMetafile.inputs, 'src/index.ts': { imports: [{ path: 'node:util/types', external: true }] } } }, 'node: input'],
    ['two outputs', { ...cleanMetafile, outputs: { 'a.js': {}, 'b.js': {} } }, 'exactly one output'],
    ['malformed', { inputs: [] }, 'invalid esbuild metafile'],
  ];
  for (const [name, metafile, message] of mutations) expect(() => assertReactMetafile(metafile), name).toThrow(message);
});

test('page protocol accepts exactly one matching report and rejects everything else', () => {
  const expected = expectedReactReport('development', react);
  expect(evaluateReactPageProtocol(transcript(), expected)).toEqual({ status: 'pass' });
  expect(evaluateReactPageProtocol(transcript({ reports: [] }), expected)).toEqual({ status: 'fail', reason: 'page posted no report' });
  expect(evaluateReactPageProtocol(transcript({ reports: [expected, expected] }), expected)).toEqual({ status: 'fail', reason: 'page posted extra reports' });
  expect(evaluateReactPageProtocol(transcript({ reports: [{ ...expected, mounted: { ...expected.mounted, generation: 7 } }] }), expected)).toEqual({ status: 'fail', reason: 'page report mismatch' });
  expect(evaluateReactPageProtocol(transcript({ reports: [expectedReactReport('production', react)] }), expected)).toEqual({ status: 'fail', reason: 'page report mismatch' });
  expect(evaluateReactPageProtocol(transcript({ reports: [{ ...expected, closed: { ...expected.closed, unhandled: ['boom'] } }] }), expected)).toEqual({ status: 'fail', reason: 'page report mismatch' });
  expect(evaluateReactPageProtocol(transcript({ reports: [{ ...expected, unmountDuringStartup: { ...expected.unmountDuringStartup, published: true } }] }), expected)).toEqual({ status: 'fail', reason: 'page report mismatch' });
  expect(evaluateReactPageProtocol(transcript({ errors: ['Uncaught TypeError'] }), expected)).toEqual({ status: 'fail', reason: 'page error: Uncaught TypeError' });
  expect(evaluateReactPageProtocol(transcript({ console: [{ type: 'error', text: 'Each child in a list should have a unique "key" prop.' }] }), expected)).toEqual({ status: 'fail', reason: 'page console error: Each child in a list should have a unique "key" prop.' });
  expect(evaluateReactPageProtocol(transcript({ console: [{ type: 'warning', text: 'deprecated' }] }), expected)).toEqual({ status: 'fail', reason: 'page console warning: deprecated' });
  expect(evaluateReactPageProtocol(transcript({ console: [{ type: 'info', text: 'Download the React DevTools' }] }), expected)).toEqual({ status: 'pass' });
  expect(evaluateReactPageProtocol(transcript({ timedOut: true }), expected)).toEqual({ status: 'fail', reason: 'page timed out' });
  const cyclic: { self?: unknown } = {};
  cyclic.self = cyclic;
  expect(evaluateReactPageProtocol(transcript({ reports: [cyclic] }), expected)).toEqual({ status: 'fail', reason: 'page report mismatch' });
});

test('development and production expect the same scenario except the Strict Mode generation', () => {
  const development = expectedReactReport('development', react);
  const production = expectedReactReport('production', react);
  expect(development.lane).toBe('react-page-development');
  expect(production.lane).toBe('react-page-production');
  expect(development.mounted.generation).toBe(2);
  expect(production.mounted.generation).toBe(1);
  expect({ ...development, lane: '', mounted: { ...development.mounted, generation: 0 } })
    .toEqual({ ...production, lane: '', mounted: { ...production.mounted, generation: 0 } });
  expect(development.unmountDuringStartup).toEqual({
    state: 'idle', gammaCalls: 1, published: false,
    lockEvents: ['acquire:alpha', 'release:alpha', 'acquire:beta', 'release:beta', 'acquire:broken', 'release:broken', 'acquire:alpha', 'release:alpha', 'acquire:gamma', 'release:gamma'],
  });
  expect(development.closed).toEqual({ transportCloses: 1, failures: [], unhandled: [] });
});

test('react page lane rechecks the bundle and maps driver outcomes', async () => {
  const bundle = fakeBundle();
  const pass: ReactPageDriver = async () => transcript();
  await expect(runReactPageLane(bundle, fakeChromium, pass)).resolves.toMatchObject({ status: 'pass', lane: 'react-page-development', react, mode: 'development' });
  await expect(runReactPageLane({ ...bundle, sha256: '0'.repeat(64) }, fakeChromium, pass)).resolves.toMatchObject({ status: 'fail', reason: 'react bundle SHA-256 mismatch' });
  const errorDriver: ReactPageDriver = async () => transcript({ errors: ['scenario exploded'] });
  await expect(runReactPageLane(bundle, fakeChromium, errorDriver)).resolves.toMatchObject({ status: 'fail', reason: 'page error: scenario exploded' });
  const consoleDriver: ReactPageDriver = async () => transcript({ console: [{ type: 'error', text: 'act warning' }] });
  await expect(runReactPageLane(bundle, fakeChromium, consoleDriver)).resolves.toMatchObject({ status: 'fail', reason: 'page console error: act warning' });
  const neverDriver: ReactPageDriver = async (_bytes, _tool, signal) => new Promise(resolveTranscript => {
    signal.addEventListener('abort', () => resolveTranscript(transcript({ timedOut: true })), { once: true });
  });
  await expect(runReactPageLane(bundle, fakeChromium, neverDriver, 10)).resolves.toMatchObject({ status: 'fail', reason: 'page timed out' });
  const throwingDriver: ReactPageDriver = async () => { throw new Error('browser setup failed'); };
  await expect(runReactPageLane(bundle, fakeChromium, throwingDriver)).resolves.toMatchObject({ status: 'fail', reason: 'browser setup failed' });
  await expect(runReactPageLane(bundle, { status: 'unavailable', reason: 'not-provisioned' })).resolves.toMatchObject({ status: 'unavailable', reason: 'not-provisioned' });
  await expect(runReactPageLane(bundle, fakeChromium, undefined, 6_000, { status: 'unavailable', reason: 'not-provisioned' })).resolves.toMatchObject({ status: 'unavailable', reason: 'playwright-not-provisioned' });
});

test('provisioned browser tools run the React scenario in development and production builds', async () => {
  const root = resolve(__dirname, '../..');
  const [esbuild, playwright, chromium] = await Promise.all([verifyTool(root, 'esbuild'), verifyTool(root, 'playwright'), verifyTool(root, 'chromium')]);
  const tools = [esbuild, playwright, chromium];
  if (tools.some(tool => tool.status === 'unavailable')) {
    // The portable CI job provisions them and runs `npm run check:react-browser` as the required gate.
    expect(tools.filter(tool => tool.status === 'unavailable').length).toBeGreaterThan(0);
    return;
  }
  for (const mode of ['development', 'production'] as const) {
    const bundle = bundleReactEntry(esbuild as VerifiedTool, mode);
    try {
      const row = await runReactPageLane(bundle, chromium as VerifiedTool);
      expect(row, mode).toMatchObject({ lane: laneName(mode), status: 'pass', react });
    } finally {
      rmSync(dirname(bundle.path), { recursive: true, force: true });
    }
  }
}, 120_000);
```

In `scripts/test-lane.mjs` line 10, change `'platform/browser-worker', 'release-artifacts',` to `'platform/browser-worker', 'platform/react-page', 'release-artifacts',`. In `tests/test-lanes.test.ts` add after the `expect(compiler).toContain('tests/platform/browser-worker.test.ts');` line:

```ts
  expect(compiler).toContain('tests/platform/react-page.test.ts');
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/platform/react-page.test.ts`
Expected: FAIL — `Cannot find module '../../scripts/react-browser-lane'`.

- [ ] **Step 3: Export the two helpers from the platform script**

In `scripts/platform-evidence.ts` change line 228 `function platformGit(): PlatformRow['git'] {` to `export function platformGit(): PlatformRow['git'] {` and line 424 `function playwrightPackageEntry(tool: VerifiedTool): string {` to `export function playwrightPackageEntry(tool: VerifiedTool): string {`. Nothing else in that file changes.

- [ ] **Step 4: Write the lane script**

Create `scripts/react-browser-lane.ts`. It must stay Node-type-strippable (no enums, no parameter properties, `import type` for types):

```ts
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { platformGit, playwrightPackageEntry, stableJson, verifyTool } from './platform-evidence.ts';
import type { PlatformRow, ToolUnavailableReason, VerifiedTool } from './platform-evidence.ts';
import type { ScenarioReport } from '../examples/react/browser-scenario.tsx';

export type ReactBuildMode = 'development' | 'production';
export type ReactBundle = {
  readonly mode: ReactBuildMode;
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly metafilePath: string;
  /** The installed react version, read from node_modules; the scenario reports `React.version` and they must agree. */
  readonly react: string;
};
export type ReactConsoleMessage = { readonly type: string; readonly text: string };
export type ReactPageTranscript = {
  readonly reports: readonly unknown[];
  readonly errors: readonly string[];
  readonly console: readonly ReactConsoleMessage[];
  readonly timedOut: boolean;
};
export type ReactPageDriver = (bundleBytes: Uint8Array, chromium: VerifiedTool, signal: AbortSignal) => Promise<ReactPageTranscript>;
type Unavailable = { status: 'unavailable'; reason: ToolUnavailableReason };
type Assertion = { status: 'pass' } | { status: 'fail'; reason: string };

const laneRoot = resolve(process.cwd());
const laneScript = resolve(laneRoot, 'scripts', 'react-browser-lane.ts');
const allowedInputRoots = ['src/', 'examples/react/', 'node_modules/react/', 'node_modules/react-dom/', 'node_modules/scheduler/'];
const quietConsole = new Set(['log', 'info', 'debug']);

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function laneName(mode: ReactBuildMode): string {
  return `react-page-${mode}`;
}

/** The one scenario, as the page must report it. Only the Strict Mode generation differs between builds. */
export function expectedReactReport(mode: ReactBuildMode, react: string): ScenarioReport {
  const lockEvents = [
    'acquire:alpha', 'release:alpha', 'acquire:beta', 'release:beta', 'acquire:broken', 'release:broken',
    'acquire:alpha', 'release:alpha', 'acquire:gamma', 'release:gamma',
  ];
  return {
    lane: mode === 'development' ? 'react-page-development' : 'react-page-production',
    react,
    mounted: { status: 'ready', project: 'alpha', generation: mode === 'development' ? 2 : 1 },
    documentAdded: { count: 1 },
    switchedToBeta: { status: 'ready', project: 'beta', lockEvents: lockEvents.slice(0, 3) },
    brokenFailed: { status: 'failed', message: 'no manifest for broken', lockEvents: lockEvents.slice(0, 6) },
    backToAlpha: { status: 'ready', project: 'alpha', documents: 1 },
    unmounted: { state: 'idle', lockEvents: lockEvents.slice(0, 8) },
    unmountDuringStartup: { state: 'idle', gammaCalls: 1, lockEvents, published: false },
    closed: { transportCloses: 1, failures: [], unhandled: [] },
  };
}

type MetafileImport = { path?: unknown; external?: unknown };

/** Inputs must come from src, the example, or the React packages; nothing external, nothing from node. */
export function assertReactMetafile(value: unknown): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid esbuild metafile');
  const { inputs, outputs } = value as { inputs?: unknown; outputs?: unknown };
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs) || !outputs || typeof outputs !== 'object' || Array.isArray(outputs)) {
    throw new Error('invalid esbuild metafile');
  }
  if (Object.keys(outputs).length !== 1) throw new Error('react bundle must have exactly one output');
  for (const [input, detail] of Object.entries(inputs as Record<string, unknown>)) {
    if (input.startsWith('node:')) throw new Error(`react bundle contains a node: input: ${input}`);
    if (isAbsolute(input) || input.split('/').includes('..')) throw new Error(`react bundle input is outside the repository: ${input}`);
    if (input === 'src/node.ts') throw new Error('react bundle contains the node facade');
    if (!allowedInputRoots.some(prefix => input.startsWith(prefix))) throw new Error(`react bundle input is outside the allowed roots: ${input}`);
    const imports = (detail as { imports?: unknown } | null)?.imports ?? [];
    if (!Array.isArray(imports)) throw new Error('invalid esbuild metafile');
    for (const imported of imports as MetafileImport[]) {
      if (typeof imported?.path !== 'string') throw new Error('invalid esbuild metafile');
      if (imported.path.startsWith('node:')) throw new Error(`react bundle contains a node: input: ${imported.path}`);
      if (imported.external === true) throw new Error(`react bundle contains an external input: ${imported.path}`);
    }
  }
}

export function installedReactVersion(root = laneRoot): string {
  const manifest = JSON.parse(readFileSync(join(root, 'node_modules', 'react', 'package.json'), 'utf8')) as { version?: unknown };
  if (typeof manifest.version !== 'string') throw new Error('installed react package has no version');
  return manifest.version;
}

/** Bundle one entry with the verified esbuild. Development keeps Strict Mode's double invocation; production is what ships. */
export function bundleReactEntry(
  esbuild: VerifiedTool | Unavailable,
  mode: ReactBuildMode,
  options: { readonly entry?: string; readonly format?: 'esm' | 'iife'; readonly root?: string } = {},
): ReactBundle {
  if (esbuild.status === 'unavailable') throw new Error(`esbuild unavailable: ${esbuild.reason}`);
  if (esbuild.name !== 'esbuild') throw new Error('react bundling requires the verified esbuild tool');
  const root = options.root ?? laneRoot;
  const entry = options.entry ?? 'examples/react/browser-scenario.tsx';
  const out = mkdtempSync(join(tmpdir(), `di-bag-react-${mode}-`));
  const path = join(out, 'bundle.js');
  const metafilePath = join(out, 'bundle-meta.json');
  const args = [
    entry, '--bundle', '--platform=browser', `--format=${options.format ?? 'esm'}`, '--target=es2022', '--jsx=automatic',
    `--define:process.env.NODE_ENV="${mode}"`, ...(mode === 'production' ? ['--minify'] : ['--jsx-dev']),
    '--log-level=error', `--outfile=${path}`, `--metafile=${metafilePath}`,
  ];
  const result = spawnSync(esbuild.argv[0], [...esbuild.argv.slice(1), ...args], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.signal !== null || result.status !== 0 || result.stderr !== '') {
    rmSync(out, { recursive: true, force: true });
    throw new Error(`react bundling failed: ${result.stderr || result.stdout}`);
  }
  assertReactMetafile(JSON.parse(readFileSync(metafilePath, 'utf8')));
  const bytes = Uint8Array.from(readFileSync(path));
  return { mode, path, sha256: sha256(bytes), bytes: bytes.length, metafilePath, react: installedReactVersion(root) };
}

export function evaluateReactPageProtocol(transcript: ReactPageTranscript, expected: ScenarioReport): Assertion {
  if (transcript.timedOut) return { status: 'fail', reason: 'page timed out' };
  if (transcript.errors.length > 0) return { status: 'fail', reason: `page error: ${transcript.errors[0]}` };
  const noisy = transcript.console.find(message => !quietConsole.has(message.type));
  if (noisy) return { status: 'fail', reason: `page console ${noisy.type}: ${noisy.text}` };
  if (transcript.reports.length === 0) return { status: 'fail', reason: 'page posted no report' };
  if (transcript.reports.length !== 1) return { status: 'fail', reason: 'page posted extra reports' };
  let actual: string;
  try { actual = stableJson(transcript.reports[0]); }
  catch { return { status: 'fail', reason: 'page report mismatch' }; }
  if (actual !== stableJson(expected)) return { status: 'fail', reason: 'page report mismatch' };
  return { status: 'pass' };
}

/** A page, not a Worker: React needs a document. The module script runs the scenario and reports through an exposed function. */
export const executeReactPage: ReactPageDriver = async (bundleBytes, chromiumTool, signal) => {
  const playwrightTool = await verifyTool(laneRoot, 'playwright');
  if (playwrightTool.status === 'unavailable') throw new Error(`playwright unavailable: ${playwrightTool.reason}`);
  const module = await import(pathToFileURL(playwrightPackageEntry(playwrightTool)).href) as any;
  const playwright = module.chromium ? module : module.default;
  if (!playwright?.chromium) throw new Error('verified Playwright module has no Chromium API');
  const browser = await playwright.chromium.launch({ executablePath: chromiumTool.hashPath });
  if (signal.aborted) {
    await browser.close();
    return { reports: [], errors: [], console: [], timedOut: true };
  }
  const abort = () => { void browser.close().catch(() => undefined); };
  signal.addEventListener('abort', abort, { once: true });
  const reports: unknown[] = [], errors: string[] = [], consoleOutput: ReactConsoleMessage[] = [];
  let timedOut = false;
  try {
    const page = await browser.newPage();
    page.on('console', (message: any) => { consoleOutput.push({ type: message.type(), text: message.text() }); });
    page.on('pageerror', (error: Error) => { errors.push(error.message); });
    await page.exposeFunction('__diBagReactReport', (report: unknown) => { reports.push(report); });
    await page.exposeFunction('__diBagReactError', (message: string) => { errors.push(message); });
    await page.setContent('<!doctype html><meta charset="utf-8"><title>di-bag react scenario</title>');
    await page.addScriptTag({ content: new TextDecoder().decode(bundleBytes), type: 'module' });
    while (reports.length === 0 && errors.length === 0 && !signal.aborted) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    if (signal.aborted) timedOut = true;
    else await new Promise(resolve => setTimeout(resolve, 100));
  } finally {
    signal.removeEventListener('abort', abort);
    await browser.close();
  }
  return { reports, errors, console: consoleOutput, timedOut };
};

function describeTool(tool: VerifiedTool | Unavailable): Record<string, unknown> {
  return tool.status === 'unavailable' ? { status: 'unavailable', reason: tool.reason } : { status: 'pinned', version: tool.version, sha256: tool.sha256 };
}

export async function runReactPageLane(
  bundle: ReactBundle,
  chromium: VerifiedTool | Unavailable,
  driver?: ReactPageDriver,
  timeoutMs = 30_000,
  unavailablePlaywright?: Unavailable,
): Promise<PlatformRow> {
  const row = (status: PlatformRow['status'], fields: Record<string, unknown> = {}): PlatformRow => ({
    schema: 1, lane: laneName(bundle.mode), status, utc: new Date().toISOString(), git: platformGit(),
    react: bundle.react, mode: bundle.mode, bundleSha256: bundle.sha256, bytes: bundle.bytes, ...fields,
  });
  if (chromium.status === 'unavailable') return row('unavailable', { reason: chromium.reason });
  if (chromium.name !== 'chromium') return row('fail', { reason: 'react page lane requires the verified chromium tool' });
  try {
    if (!driver) {
      const playwright = unavailablePlaywright ?? await verifyTool(laneRoot, 'playwright');
      if (playwright.status === 'unavailable') return row('unavailable', { reason: `playwright-${playwright.reason}` });
    }
    if (!existsSync(bundle.path) || !statSync(bundle.path).isFile()) throw new Error('react bundle does not exist');
    const bytes = Uint8Array.from(readFileSync(bundle.path));
    if (sha256(bytes) !== bundle.sha256) throw new Error('react bundle SHA-256 mismatch');
    const controller = new AbortController();
    const timeout = Symbol('react-page-timeout');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const execution = (driver ?? executeReactPage)(bytes, chromium, controller.signal);
    let transcript: ReactPageTranscript | typeof timeout;
    try {
      transcript = await Promise.race([
        execution,
        new Promise<typeof timeout>(resolveTimeout => { timer = setTimeout(() => resolveTimeout(timeout), timeoutMs); }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
    if (transcript === timeout) {
      controller.abort();
      await Promise.race([execution.catch(() => undefined), new Promise(resolveCleanup => setTimeout(resolveCleanup, 250))]);
      return row('fail', { reason: 'page timed out' });
    }
    const assertion = evaluateReactPageProtocol(transcript, expectedReactReport(bundle.mode, bundle.react));
    if (assertion.status === 'fail') return row('fail', { reason: assertion.reason, console: transcript.console, report: transcript.reports[0] ?? null });
    return row('pass', { console: transcript.console, chromium: chromium.version });
  } catch (error) {
    return row('fail', { reason: error instanceof Error ? error.message : String(error) });
  }
}

export function writeReactEvidence(root: string, rows: readonly PlatformRow[]): string {
  const first = rows[0];
  if (!first) throw new Error('no react evidence rows');
  const directory = join(root, 'docs', 'benchmarks', 'results', `${first.utc.slice(0, 10)}-${first.git.sha.slice(0, 7)}`);
  mkdirSync(directory, { recursive: true });
  const path = join(directory, 'react-browser.jsonl');
  writeFileSync(path, `${rows.map(row => stableJson(row)).join('\n')}\n`);
  return path;
}

/** Both builds, one row each, written next to the platform evidence. */
export async function runReactBrowserEvidence(root = laneRoot): Promise<readonly PlatformRow[]> {
  const [esbuild, playwright, chromium] = await Promise.all([verifyTool(root, 'esbuild'), verifyTool(root, 'playwright'), verifyTool(root, 'chromium')]);
  const tools = { esbuild: describeTool(esbuild), playwright: describeTool(playwright), chromium: describeTool(chromium) };
  const rows: PlatformRow[] = [];
  for (const mode of ['development', 'production'] as const) {
    let row: PlatformRow;
    if (esbuild.status === 'unavailable') {
      row = { schema: 1, lane: laneName(mode), status: 'unavailable', reason: `esbuild-${esbuild.reason}`, utc: new Date().toISOString(), git: platformGit() };
    } else {
      let bundle: ReactBundle | undefined;
      try {
        bundle = bundleReactEntry(esbuild, mode, { root });
        row = await runReactPageLane(bundle, chromium, undefined, 30_000, playwright.status === 'unavailable' ? playwright : undefined);
      } catch (error) {
        row = { schema: 1, lane: laneName(mode), status: 'fail', reason: error instanceof Error ? error.message : String(error), utc: new Date().toISOString(), git: platformGit() };
      } finally {
        if (bundle) rmSync(dirname(bundle.path), { recursive: true, force: true });
      }
    }
    rows.push({ ...row, tools });
  }
  writeReactEvidence(root, rows);
  return rows;
}

/** A page a person can open from disk: a classic script, because file:// blocks module scripts. */
export function writeReactPage(esbuild: VerifiedTool | Unavailable, directory: string, root = laneRoot): string {
  const bundle = bundleReactEntry(esbuild, 'development', { entry: 'examples/react/main.tsx', format: 'iife', root });
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'main.js'), readFileSync(bundle.path));
  rmSync(dirname(bundle.path), { recursive: true, force: true });
  const path = join(directory, 'index.html');
  writeFileSync(path, '<!doctype html>\n<meta charset="utf-8">\n<title>DI Bag React example</title>\n<div id="root"></div>\n<script src="./main.js"></script>\n');
  return path;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === laneScript) {
  const args = process.argv.slice(2);
  const fail = (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  };
  if (args[0] === '--page' && args.length === 1) {
    verifyTool(laneRoot, 'esbuild')
      .then(esbuild => { process.stdout.write(`${writeReactPage(esbuild, mkdtempSync(join(tmpdir(), 'di-bag-react-page-')))}\n`); })
      .catch(fail);
  } else if (args.length === 0 || (args.length === 1 && args[0] === '--required')) {
    runReactBrowserEvidence().then(rows => {
      for (const row of rows) process.stdout.write(`${stableJson(row)}\n`);
      process.exitCode = args[0] === '--required'
        ? (rows.every(row => row.status === 'pass') ? 0 : 1)
        : (rows.some(row => row.status === 'fail') ? 1 : 0);
    }).catch(fail);
  } else {
    process.stderr.write('Usage: node scripts/react-browser-lane.ts [--required | --page]\n');
    process.exit(1);
  }
}
```

- [ ] **Step 5: Register the scripts and the CI step**

In `package.json` `scripts`, after `"check:platform": ...` add:

```json
    "check:react-browser": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/react-browser-lane.ts --required",
    "example:react": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/react-browser-lane.ts --page",
```

In `.github/workflows/ci.yml`, in the `portable` job, replace

```yaml
      - run: npm run check:platform
      - name: Exercise platform failure oracles
        run: bun test tests/platform-evidence.test.ts tests/platform-tools.test.ts tests/platform-deno.test.ts tests/platform/browser-worker.test.ts
```

with

```yaml
      - run: npm run check:platform
      - run: npm run check:react-browser
      - name: Exercise platform failure oracles
        run: bun test tests/platform-evidence.test.ts tests/platform-tools.test.ts tests/platform-deno.test.ts tests/platform/browser-worker.test.ts tests/platform/react-page.test.ts
```

The existing `upload-artifact` step already collects `docs/benchmarks/results/`, so `react-browser.jsonl` (with the `react`, `mode`, and pinned tool versions) is published with every run.

- [ ] **Step 6: Run the oracle tests, then the real lane if tools are provisioned**

Run: `bun test tests/platform/react-page.test.ts tests/test-lanes.test.ts tests/platform-evidence.test.ts tests/platform/browser-worker.test.ts`
Expected: PASS. The real-run test returns early unless esbuild, Playwright, and Chromium are pinned locally.

To run the real lane (this is what CI does; `tools/platform/node_modules` and `.browsers/chromium-1243` already exist on the development machine):

```sh
npm ci --prefix tools/platform --no-audit --no-fund
export PLAYWRIGHT_BROWSERS_PATH="$PWD/tools/platform/.browsers"
node tools/platform/node_modules/playwright/cli.js install chromium
npm run platform:pin -- --all
npm run check:react-browser
```

Expected: two JSON rows on stdout, both `"status":"pass"`, `"react":"19.3.0"`, `"mode":"development"` and `"mode":"production"`, `"chromium":"153.0.8010.12"`, exit code 0, and `docs/benchmarks/results/<today>-<sha7>/react-browser.jsonl` written (untracked; do not commit it). Then `bun test tests/platform/react-page.test.ts` runs the real scenario too.

Diagnosing a failing row: `reason: 'page report mismatch'` prints the actual `report` in the row — diff it against `expectedReactReport`. A `mounted.generation` of 1 in development means the bundle was not built with `NODE_ENV=development` (check the `--define`). A `page console error:` whose text starts with `Warning:` is a React warning in the example; fix the example, never the console policy. `page error: timed out waiting for ...` names the scenario step that never happened.

- [ ] **Step 7: Commit**

```bash
git add scripts/react-browser-lane.ts scripts/platform-evidence.ts scripts/test-lane.mjs tests/platform/react-page.test.ts tests/test-lanes.test.ts package.json .github/workflows/ci.yml
git commit -m "test(platform): run the React recipe in the pinned Chromium in development and production builds"
```

---

### Task 5: The guide, navigation, and cross-links

**Files:**
- Create: `docs/guides/react-integration.md`
- Modify: `tools/docs/vitepress.config.mjs:10-17` (sidebar), `README.md:249-251` (bullet) and `:257` (Explore table), `docs/README.md:12-13` (map), `docs/guides/development.md:27-33` and `:60-71` (lanes), `docs/guides/enterprise-integration.md:127-135` (framework boundaries)

Guide snippets are not type-checked by `docs:check` (only `AGENTS.md` and `docs/agent/` are), so every snippet below is copied from the example files of Tasks 1–3 with `'../../src'` rewritten to `'di-bag'`. If you changed an example file, change the snippet the same way.

- [ ] **Step 1: Write the guide**

Create `docs/guides/react-integration.md` (the outer fence below is four backticks only because the guide contains code fences; copy the content, not the fence):

````markdown
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
  See [lifetime rules](tutorial.md#choose-root-scoped-or-transient-caching).

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
[portable mode](tutorial.md#portable-mode). Issue
[#28](https://github.com/dany-fedorov/di-bag/issues/28) proposes shorthand
helpers for exactly this repetition; the semantics below do not change with them.

```ts
import { DiBag, type CloseOptions, type StartupOptions } from 'di-bag';

export function createAppBuilder(adapters: AppAdapters) {
  return DiBag.createBuilder().register({
    // Borrowed: IndexedDB-style storage has no close; the bag never disposes it.
    storage: DiBag.withLifetime(DiBag.fromFactory((): Storage => adapters.storage, { acquisitionMode: 'raw' }), 'root'),
    // Owned: bootstrap hands the transport over, and the app bag closes it exactly once.
    transport: DiBag.withLifetime(
      DiBag.withDisposal(DiBag.fromFactory((): Transport => adapters.transport, { acquisitionMode: 'raw' }), transport => transport.close()),
      'root',
    ),
  });
}

export async function createAppRuntime(adapters: AppAdapters, options?: StartupOptions): Promise<AppRuntime> {
  const bag = await createAppBuilder(adapters).buildAndStart(['storage', 'transport'], options);
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
    projectId: DiBag.fromFactory(() => projectId, { acquisitionMode: 'raw' }),
    storage: DiBag.fromFactory((): Storage => app.storage, { acquisitionMode: 'raw' }),
    transport: DiBag.fromFactory((): Transport => app.transport, { acquisitionMode: 'raw' }),
    lock: DiBag.withDisposal(
      DiBag.fromFactory(({ storage, projectId }: { storage: Storage; projectId: string }) => storage.lock(projectId), { acquisitionMode: 'nativePromise' }),
      lock => lock.release(),
    ),
    // Depends on the lock so nothing is fetched for a project another runtime still holds.
    manifest: DiBag.fromFactory(
      async ({ transport, projectId, lock }: { transport: Transport; projectId: string; lock: Promise<ProjectLock> }, factoryCtx) => {
        await lock;
        return transport.fetchManifest(projectId, factoryCtx.signal);
      },
      { context: 'acquisition', acquisitionMode: 'nativePromise' },
    ),
    documents: DiBag.fromFactory(async ({ storage, projectId, lock }: { storage: Storage; projectId: string; lock: Promise<ProjectLock> }): Promise<DocumentsStore> => {
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
    }, { acquisitionMode: 'nativePromise' }),
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

- **HMR.** A dev server that replaces `bootstrap`'s module leaves the old
  module's runtime alive unless the old module closes it. `import.meta.hot?.dispose(() => shutdown())`
  does that for Vite-style servers; a plain bundle has no `import.meta.hot` and
  skips it. State that must survive a reload belongs in storage, not in a
  runtime.
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
````

- [ ] **Step 2: Register the page and cross-link it**

`tools/docs/vitepress.config.mjs` — in the `'Start here'` items, after `{ text: 'Server recipes', link: '/guides/server-integration' },` add:

```js
    { text: 'React and browser runtimes', link: '/guides/react-integration' },
```

`README.md` — replace the bullet at lines 249–251 with:

```markdown
- **Framework integration belongs to the application.** DI Bag provides the
  composition and ownership primitives; the host connects request, job, or UI
  lifecycles. The [server guide](docs/guides/server-integration.md) and the
  [React guide](docs/guides/react-integration.md) are tested recipes for both.
```

and in the "Explore further" table, after the `| [Server guide](docs/guides/server-integration.md) | ... |` row add:

```markdown
| [React guide](docs/guides/react-integration.md) | Browser applications: one app runtime at bootstrap, project runtimes owned from effects, Strict Mode, cancellation, bounded teardown, and `useSyncExternalStore`. |
```

`docs/README.md` — after the `| [Server guide](guides/server-integration.md) | ... |` row add:

```markdown
| [React guide](guides/react-integration.md) | Own application and project runtimes from React effects in the browser: Strict Mode, cancellation, bounded teardown, and external stores. |
```

`docs/guides/development.md` — in the paragraph beginning `` `npm test` runs two lanes. ``, after the sentence ending `run it after every source change.` insert: `` `tests/react/` holds the React recipe's owner and composition tests; they run in the fast lane without React. `` Then in "Portable runtime checks": change the first sentence to `A separate CI job runs the actual packed root package in Deno and a minified Chromium Worker, and the React example in a Chromium page.`; add `npm run check:react-browser` as the last line of the code block; and after the sentence ending `` `evidence:platform` remains an informational collector that can record unavailable portable tools. `` insert: `` `check:react-browser` bundles `examples/react` with the pinned esbuild and runs it in the pinned Chromium in development and production builds, writing `react-browser.jsonl` next to the platform evidence; both rows must pass. ``

`docs/guides/enterprise-integration.md` — in "Framework boundaries", after the sentence ending `[Angular hierarchy](https://angular.dev/guide/di/hierarchical-dependency-injection).` add a new paragraph:

```markdown
For React in the browser, the [React guide](react-integration.md) ships a tested
owner that bridges effect setup and cleanup to runtime startup and close.
```

- [ ] **Step 3: Check the docs**

Run: `npm ci --prefix tools/docs --no-audit --no-fund && npm run docs:check && npm run docs:build`
Expected: `docs:check` prints the prepared page count including the new guide and "Agent docs are consistent"; `docs:build` prints `Verified N rendered pages and M internal links, anchors, assets, and message URLs.` with no missing anchor. If it reports `missing anchor` for a Contents link, the heading text and the link slug disagree — VitePress slugs are the heading lowercased with punctuation removed and spaces as hyphens (`Compared with Obsidian, inversify-react, and react-ioc` → `compared-with-obsidian-inversify-react-and-react-ioc`). If it reports `missing page` for `examples/react/...`, the link must be relative from `docs/guides/` (`../../examples/react/...`); the site tooling rewrites it to GitHub.

- [ ] **Step 4: Commit**

```bash
git add docs/guides/react-integration.md docs/README.md docs/guides/development.md docs/guides/enterprise-integration.md tools/docs/vitepress.config.mjs
git add -p README.md
git commit -m "docs: React and browser runtime guide with a tested owner recipe"
```

For `git add -p README.md`, stage only the framework-integration bullet and the Explore row; leave the unrelated tagline hunk unstaged.

---

### Task 6 (conditional): Adopt the #28 helpers if they have landed

**Files:**
- Modify: `examples/react/app-runtime.ts`, `examples/react/project-runtime.ts`, `docs/guides/react-integration.md`

- [ ] **Step 1: Check whether the helpers exist**

Run: `grep -n "fromSyncFactory\|fromAsyncFactory" src/di-bag.ts src/index.ts`
If nothing prints, skip this task entirely; the guide's one-sentence note about #28 stays as written.

- [ ] **Step 2: Replace the explicit modes**

If both helpers exist, in `examples/react/app-runtime.ts` and `examples/react/project-runtime.ts` replace every `DiBag.fromFactory(f, { acquisitionMode: 'raw' })` with `DiBag.fromSyncFactory(f)` and every `DiBag.fromFactory(f, { acquisitionMode: 'nativePromise' })` with `DiBag.fromAsyncFactory(f)`. Keep `manifest` on `DiBag.fromFactory(f, { context: 'acquisition', acquisitionMode: 'nativePromise' })` unless the helper's signature in `src/di-bag.ts` accepts `{ context: 'acquisition' }`. Make the identical replacements in the two snippets of the guide, and rewrite the guide's sentence beginning `Issue [#28]` to: `` The `fromSyncFactory`/`fromAsyncFactory` helpers ([#28](https://github.com/dany-fedorov/di-bag/issues/28)) are the explicit modes with less repetition; the semantics are those of `acquisitionMode: 'raw'` and `'nativePromise'`. ``

- [ ] **Step 3: Verify and commit**

Run: `npm run typecheck && npm_config_update_notifier=false npm run test:fast` (and `npm run check:react-browser` if the tools are provisioned).
Expected: PASS with the same test counts as before.

```bash
git add examples/react docs/guides/react-integration.md
git commit -m "refactor(examples): use the portable factory helpers in the React recipe"
```

---

### Task 7: Full gate and PR text

- [ ] Run, in order: `npm run check`; `node --expose-gc --test --test-isolation=none tests/runtime-scale.node.mjs tests/acquisition-retention.node.mjs tests/graph-retention.node.mjs`; `npm run typecheck:native`; `npm run build:native`; `npm run check:native`; `npm run graph:check`; `npm run agent-eval:test`; `for f in examples/*.ts; do bun "$f" || exit 1; done`; `npm run docs:check`; and, with the platform tools pinned (Task 4 Step 6), `npm run check:platform && npm run check:react-browser`.
- [ ] Expected: all green. `tests/package.test.ts` may time out under load; rerun `npm_config_update_notifier=false bun test tests/package.test.ts` alone before investigating.
- [ ] Confirm `git diff --stat main` touches nothing under `src/`, that `CHANGELOG.md` and `AGENTS.md` are untouched, that `package.json` `dependencies` is still absent, and that `docs/benchmarks/results/` has no staged files.
- [ ] Confirm the acceptance checklist of #30 against the evidence: each criterion below names the test that pins it.
  - Typechecks, bundles, executes in a real browser without Node polyfills; versions stated — `npm run typecheck`, `assertReactMetafile` (no `node:` inputs, no externals), `check:react-browser` rows with `react`, `mode`, `chromium`; the guide's "Test without React, then in a browser" section.
  - Strict Mode leaves a fresh usable runtime, no leaked subscriptions or closed-bag reuse — owner test "Strict Mode setup-cleanup-setup ..."; browser `mounted.generation` 2 in development; `documentAdded` after it.
  - Identity change during pending startup cannot publish the old runtime; owned resources eventually disposed — owner tests "a startup finishing after its identity was replaced ..." and "a start that ignores its signal ..."; composition test "a cancelled startup ...".
  - Unmount during startup: cancellation, no unhandled rejection, no stale publication — owner test "a release during startup ..."; browser `unmountDuringStartup` with `published: false` and `closed.unhandled: []`.
  - Startup failure renders a failure state and releases acquired owned resources; #27 explained — owner test "a failed startup ..."; composition test "a failing manifest fetch ..."; browser `brokenFailed`; guide section "A project runtime borrows, owns, and starts".
  - Teardown failure to an explicit sink; disposal rejection and bounded-wait expiry exercised — owner tests "a rejecting disposer ..." and "an expired bounded wait ...".
  - Exclusive resource: no overlap, or a documented and tested overlap policy — owner tests "without a deadline ..." (no overlap) and "an expired bounded wait ..." (the policy); browser `switchedToBeta.lockEvents` order.
  - Two concurrent project runtimes isolate owned services and share borrowed ones — composition test "two project runtimes ...".
  - External-store updates reach React through the subscription bridge — composition test "the documents store is an external store ..."; browser `documentAdded`.
  - Fake transport/storage uses the same composition — `tests/react/project-runtime.test.ts` and `browser-scenario.tsx` both call `bootstrap`/`createAppRuntime` with `createMemoryStorage`/`createMemoryTransport`.
  - When plain factories plus props/Context suffice; no mandatory React dependency or generic `useResolve()` — guide sections "When props and Context are enough" and "Connect it to React"; `package.json` `dependencies` absent.
- [ ] PR body: the changelog block below, "Closes #30", the versions line ("Exercised: React 19.3.0, Chromium 153.0.8010.12 via Playwright 1.63.0, esbuild 0.28.2"), and the verification line in the style of e1d4037 ("Verified: N fast, N compiler, 33 retention, native typecheck/build/contracts, graph, agent-eval, docs, all examples, platform and react-browser lanes.").

---

## Risks

1. **`process.on('unhandledRejection')` under Bun's test runner.** Bun also fails a test file on an unhandled rejection between tests, so if the listener is not invoked the guard still holds; if the listener *is* invoked but Bun no longer fails the file, the `afterEach` assertion is the guard. Either way a leak fails the suite.
2. **Strict Mode timing.** The "never starts generation 1" claim depends on React running cleanup and the second setup synchronously after the first setup, which React 19 does in `commitDoubleInvokeEffectsInDEV`. If a future React runs them across tasks, `mounted.generation` stays 2 but the owner would invoke and cancel generation 1 (`start:a` twice in the log) — behaviourally still correct, and only the owner test's log expectation would need updating.
3. **React DevTools console nag.** React's development build prints an `info` message when `location.protocol` is `http:`, `https:` or `file:`; the page is `about:blank`, and `info` is allowed anyway. Do not tighten the console policy to include `info`.
4. **`import.meta` in an IIFE bundle.** `writeReactPage` bundles `main.tsx` as `iife` for `file://`; esbuild replaces `import.meta` with an empty object and would warn, which `--log-level=error` suppresses. `bootstrap.tsx` guards `hot?.` so the page still works.
5. **`select` value changes under React.** The scenario sets `select.value` and dispatches a bubbling `change` event; React's controlled `<select>` handles that. If React ever ignores it, use `input` as well (`select.dispatchEvent(new Event('input', { bubbles: true }))`).
6. **Two bounded-wait tests use real timers** (`closeTimeoutMs: 5`, wait 20 ms). Under heavy load 20 ms could pass before the expiry callback runs; if a flake appears, raise the wait to 50 ms, never lower the timeout.
7. **`tests/test-lanes.test.ts`** pins the lane partition; every new test file must be in exactly one lane. `tests/react/*.test.ts` fall into the fast lane by default; `tests/platform/react-page.test.ts` must be listed in `compilerLane` or the partition test fails.
8. **Node type stripping of `scripts/react-browser-lane.ts`.** Node 24 strips types but rejects enums, namespaces, and parameter properties, and needs `import type` for type-only imports (the `.tsx` type import is erased). `tests/platform/react-page.test.ts` runs the same file under Bun, so the CLI path is the only Node-specific surface; `npm run check:react-browser` exercises it.
9. **`exactOptionalPropertyTypes`.** Spreading `{ closeTimeoutMs: undefined }` into `RuntimeOwnerOptions` is a type error; `bootstrap.tsx` and the owner tests spread conditionally for that reason.
10. **`docs:build` anchors.** The guide's Contents list and the four tutorial anchors it links (`#portable-mode`, `#release-partial-acquisition`, `#choose-root-scoped-or-transient-caching`, `#start-selected-services-and-cancel-cooperatively`) are verified by `verifyBuiltSite`; a renamed heading fails the build, not the check.

## Line estimate

| Area | Files | Estimate |
| --- | --- | --- |
| Example, framework-free | `services.ts`, `fakes.ts`, `app-runtime.ts`, `project-runtime.ts`, `runtime-owner.ts` | +420 |
| Example, React | `react-runtime.tsx`, `app.tsx`, `bootstrap.tsx`, `main.tsx`, `browser-scenario.tsx` | +300 |
| Lane | `scripts/react-browser-lane.ts`, two `export`s in `platform-evidence.ts`, `test-lane.mjs`, `package.json`, `ci.yml` | +290 / −3 |
| Tests | `tests/react/*.test.ts` (18 cases), `tests/platform/react-page.test.ts` (5 cases), `test-lanes.test.ts` | +520 |
| Docs | `docs/guides/react-integration.md`, nav, README, docs map, development, enterprise | +330 / −3 |
| Dependencies | `package.json`, `package-lock.json`, `tsconfig.json` | +5 and the lockfile |

## Changelog entry for the next release chore

```md
### Added

- A tested React/browser recipe in `examples/react` with a guide at
  `docs/guides/react-integration.md`
  ([#30](https://github.com/dany-fedorov/di-bag/issues/30)): an application
  runtime built once at bootstrap, project runtimes that borrow app services and
  own an exclusive lock, and a framework-free `RuntimeOwner` that starts,
  replaces, and closes runtimes from React effects — a replaced startup is never
  published, teardowns are serialized, a bounded wait reports its expiry to an
  explicit sink, and status is an external store for `useSyncExternalStore`.
  The owner and composition are tested in Bun without React; the example runs in
  the pinned Chromium in development (Strict Mode) and production builds through
  `npm run check:react-browser`. React is a development dependency only; the
  package remains React-free.
```
