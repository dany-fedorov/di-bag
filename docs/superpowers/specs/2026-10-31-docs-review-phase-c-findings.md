# Documentation review, phase C: server, React, integration, and comparison guides

Reviewed on 2026-10-31 at commit `2fcd0f8` (read-only). This file is the spec for the phase D plan.

Pages:

- `docs/guides/server-integration.md` (828 lines; sidebar "Server recipes")
- `docs/guides/react-integration.md` (367 lines; sidebar "React and browser runtimes")
- `docs/guides/enterprise-integration.md` (155 lines; sidebar "Integration patterns")
- `docs/guides/comparison.md` (184 lines; sidebar "Comparison with alternatives")

## What I checked, and how

- **Retired words.** `node scripts/check-docs-retired-names.mjs` prints `0 finding(s) in 19 file(s)`. All proposed text below avoids
  the forbidden words. Note that the checker does not see identifiers such as
  `withOwnedScope`, because `\bscopes?\b` does not match inside a camel-case name. Linked
  example files are not checked at all (see finding 3.4).
- **Which blocks compile.** `tools/docs/lib/agent-docs.mjs` (`isStandaloneProgram`, line 162)
  compiles a guide `ts` block only when it imports `di-bag` and nothing other than `node:*`. A
  block with a relative import (`./application.ts`) or with no imports is not compiled.
  The compiled blocks are:
  - server: lines 43, 90, 223, 541, and 652
  - React: line 79
  - integration guide (`enterprise-integration.md`): none
  - comparison: none (the page has no code at all)
- **The uncompiled server recipe compiles.** I extracted `application.ts` (43–77),
  `owned-container.ts` (125–148), `handle-request.ts` (157–167), the job snippet (735–742) and
  the test (753–784) into a scratch project and ran `tsc6` with `di-bag` mapped to `src/index.ts`.
  Result: 0 errors with `allowImportingTsExtensions: true`. Without that option the same files fail with
  `TS5097: An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled`.
- **No server recipe is tested.** `grep -rln "withOwnedContainer|handleRequest|createRequestContainer" tests scripts examples`
  finds nothing, and there is no Elysia file anywhere in the repo outside `node_modules`.
- **The integration test suite.** I read `tests/enterprise-integration.test.ts` and
  `tests/fixtures/enterprise-feature.ts` (see finding 3.1).
- **The React lane.** CI's `portable` job runs `npm run check:react-browser` (`.github/workflows/ci.yml:107`, `on: push`).
  Pins match the page: `react` 19.3.0 in `package.json`, `playwright` 1.63.0 and `esbuild` 0.28.2 in
  `tools/platform/package.json`, and the installed Chromium manifest reports 153.0.8010.12.
  `scripts/react-browser-lane.ts:54` asserts generation 2 in development and 1 in production.
  `examples/react/runtime-owner.ts` is 186 lines.
- **API names.** `allowsScopedDependencies` is in `src/lifetime.ts:18` and in errors.md#singleton-captures-scoped.
  `maxConcurrentServiceKeys` is in `src/startup.ts:27`. `CloseOptions` and `EnsureServicesReadyOptions`
  are exported from `src/index.ts:13`. `createChildContainer(keys, providers)` is a valid positional overload
  (`src/di-bag.ts:70`, errors.md#di-bag-singleton-replacement).
- **Proposed code.** Every new `ts` block proposed below was compiled with `tsc6` (strict,
  `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, NodeNext), and the runnable ones were run with Bun.

---

## Goal 1: a strong, true hook

### 1.1 [5/5] React: "Every claim below is pinned" is false

**Where:** `react-integration.md:9-11`

**What's wrong.** The page says: "Every claim below is pinned by `tests/react` (Bun, no React)
and by a run of the example in a real Chromium". The page itself contradicts that:

- Line 360 says the comparison table's "documented behavior was not re-tested here".
- Line 36's "User session" runtime has no example and no test.
- Lines 49-53 give SSR advice while saying "This recipe has no SSR example".
- The HMR `hot.dispose` and `pagehide` paths (lines 293-304) are not exercised by
  `tests/react/*.test.ts` or the browser lane.

**Why it matters.** This is the first verifiable promise on the page, and a reader who checks it finds it false.

**Proposed change.** Replace lines 5-14 with:

> A project switch in a React app has to stop the old project's work, release its lock,
> and only then open the next one, even when Strict Mode mounts every effect twice.
> This guide does that with a ~190-line framework-free `RuntimeOwner` and a 49-line hook file.
> In development, the browser lane checks that Strict Mode's setup, effect disposal, and setup
> sequence ends at generation 2 with no console warning.
>
> The complete recipe is in [`examples/react`](../../examples/react). The owner's guarantees
> are pinned by `tests/react` (Bun, no React). The composition is exercised in a real Chromium
> by `npm run check:react-browser`, in development and production builds. The user-session row,
> the SSR advice, and the comparison with other libraries are guidance and are not tested.
>
> The package stays React-free: components receive narrow services through Context,
> never a container.

### 1.2 [5/5] Comparison: the singleton rule is stated with no exception

**Where:** `comparison.md:15-17`

**What's wrong.** "The compiler rejects a singleton that depends on a scoped service" is
overstated. `DiBag.providerWithLifetime({ ..., lifetime: 'singleton:one-per-container-tree',
allowsScopedDependencies: true })` admits that dependency on purpose. This is documented in
errors.md#singleton-captures-scoped and implemented at `src/lifetime.ts:18` and
`src/acquisition.ts:286`. The server guide states the exception (`server-integration.md:191-193`);
the comparison page does not.

**Why it matters.** A comparison page is where readers check claims against other libraries,
so an absolute claim with a documented exception undermines the page.

**Proposed change.** Replace the sentence with:

> The compiler rejects a singleton that depends on a scoped service unless that
> registration sets `allowsScopedDependencies: true`, and it names both services:
> `singleton lifetime cannot capture scoped dependency: <singleton> -> <scoped>`.

### 1.3 [4/5] Server: the first screen makes no specific case, and the host list omits Elysia

**Where:** `server-integration.md:1-13`

**What's wrong.** The opening says what the page does ("builds one small application and
connects it to Node HTTP, Express, Fastify, Bun, and Deno") but not why a reader should read
on. The host list also omits Elysia, which has its own section at line 459. The first screen
is spent on runtime flags (`"type": "module"`, Node 24) instead of the claim.

**Why it matters.** This page is the most likely landing page from a search such as "DI per
request Express". Its first screen should state a checkable difference.

**Proposed change.** Replace lines 5-13 with the text below. Every claim in it was verified
against `errors.md#singleton-captures-scoped`, the compiled application block at line 43, and
the `ensureServicesReady` contract in the API card.

> Each request gets a child container. Its request ID, caller, and transaction belong to that
> child and are released when the child closes. The connection pool is created once in the
> application container. If a shared service starts depending on per-request state, `tsc` rejects
> the graph with `singleton lifetime cannot capture scoped dependency: <shared> -> <request>`
> before any request runs.
>
> One `application.ts` below serves Node HTTP, Express, Fastify, Bun, Elysia, and Deno; only the
> server file changes. `ensureServicesReady` makes the pool ready before the listener opens.
> If it fails, the container is already closed.
>
> The examples are TypeScript files in a package with `"type": "module"`. Node 24 runs them
> with `node server.ts`; Bun with `bun run server.ts`. Type-check them with the settings in
> [Type-check the recipes](#type-check-the-recipes) (see finding 3.3).

### 1.4 [4/5] Integration guide: no hook, a title that matches no link to it, and no code in the first 23 lines

**Where:** `enterprise-integration.md:1-9`

**What's wrong.**

- The H1 "Request containers, test fixtures, and dynamic features" matches none of the links
  to the page: the sidebar says "Integration patterns", the server breadcrumb (`server-integration.md:3`)
  says "Ownership recipes", and the README (lines 239 and 357) says "integration recipes" and
  "Integration guide".
- The first paragraph is abstract ("supplies the ownership and composition primitives needed
  at a request, job, message or UI environment boundary").
- The page's one capability that no other guide covers is the tested dynamic-feature lifecycle
  (lines 102-135), and it appears last, with no code (only a `text` list of steps).

**Why it matters.** A reader cannot tell from the first screen what this page has that the
server guide does not.

**Proposed change.**

1. Rename the H1 to `# Integration patterns: dynamic features, fixtures, and framework boundaries`.
   Make the server breadcrumb and README link text "Integration patterns".
2. Replace lines 5-9 with:

   > Load a feature with `import()`, validate its plugin descriptor, install it as a typed module,
   > make its exports ready, and close it. Closing disposes the plugin and every private
   > provider exactly once. `tests/enterprise-integration.test.ts` runs this sequence through a
   > real dynamic import. The block below compiles in CI and runs as is.

3. Put this block directly under the opening, before the current lines 11-67 (which finding 2.3
   proposes to shorten). It compiles under `tsc6` strict and prints `plugin disposed` once under Bun.

```ts
import assert from 'node:assert/strict';
import { DiBag } from 'di-bag';

type Transform = (text: string) => string;
const pluginKey = Symbol('feature-plugin');
const plugin = DiBag.createToken(pluginKey).forService<Transform>();

// In an application this value comes from `await import(configuredPath)`.
const descriptor: unknown = {
  apiVersion: 1,
  create: (): Transform => text => text.toUpperCase(),
  dispose: () => console.log('plugin disposed'),
};

const feature = DiBag.createBuilder()
  .withTokenService(plugin, DiBag.createProviderFromPlugin({
    dependencies: [],
    pluginDescriptor: descriptor,
    factoryReturnKind: 'uninspected',
    isValidPluginOutput: (value: unknown): value is Transform => typeof value === 'function',
  }))
  .withServices({
    handler: DiBag.createProviderFromFunction({
      dependencies: [plugin],
      factoryFunction: (transform: Transform) => (text: string) => `${transform(text)}!`,
    }),
  })
  .buildModule({ exportedServiceKeys: ['handler'], moduleLabel: 'feature' });

const app = await DiBag.createBuilder()
  .withInstalledModules([feature])
  .buildContainer()
  .ensureServicesReady(['handler']);
try {
  assert.equal(app.resolve('handler')('ok'), 'OK!');
} finally {
  await app.close(); // disposes the plugin once
}
```

### 1.5 [4/5] Comparison: a generic opener, retired positioning, and 36 lines before the first comparison

**Where:** `comparison.md:5-36`

**What's wrong.**

- Line 5 opens with "DI Bag is a good fit when you want ordinary TypeScript factories…"
  followed by a nine-item feature list. No claim on the first screen is concrete enough to check.
- Lines 12-17 explain lifetime strings before the reader knows what is being compared.
- Lines 24-30 use "Radical modularity", while the README now uses "Modules as units of work"
  (`README.md:245`).
- The page has no summary table; the README's comparison table (`README.md:276-283`) is better
  at answering "should I read on".

**Why it matters.** A reader comparing options decides on the first screen. Here they get adjectives instead of a checkable difference.

**Proposed change.** Replace lines 5-30 with:

1. A two-sentence hook:

   > DI Bag's distinguishing check is that a missing or mismatched dependency fails `tsc`, naming
   > the service, before any container exists; most of the alternatives below find it when the
   > service is first resolved. The other differences are object-parameter factories, modules with
   > private services, and explicit ownership of what each container acquired.

2. The compiled block from finding 3.6.
3. A copy of the README's six-row "Alternative / Reasons to choose it / DI Bag's different emphasis"
   table, with each row linking to the `###` section below it.
4. Move the lifetime paragraph (lines 12-17, corrected per finding 1.2) into "Costs and limits",
   or into a lifetimes row of a per-library table.
5. Replace "Radical modularity" (line 24) with "Modules as units of work" and link
   `examples-modularity.md` and `../../AGENTS.md#module-layout`.

---

## Goal 2: gradual exposition

### 2.1 [4/5] Server: the hard variant comes first and the concepts come after the code that uses them

**Where:** `server-integration.md:35-250` and `645-692`

**What's wrong.** The current order is:

1. Request containers (line 35), whose first code nests `providerWithLifetime(providerWithDisposal(...))`
   and calls `ensureServicesReady` with no explanation.
2. The simpler single-container version ("Build the application once", line 85), introduced as "Use this smaller `application.ts` instead".
3. The owner table (line 179), which explains the lifetimes the first block already used.
4. The shutdown-deadline code with `DiBagCloseCancelledError` (lines 223-243), before any server has been shown.
5. "Readiness failures and deadlines" (line 645), after all six host recipes, even though every recipe calls `ensureServicesReady`.

**Why it matters.** A human reading top to bottom meets three concepts (singleton lifetime,
owned disposal, readiness) in one block and is told what they mean 140 to 600 lines later.

**Proposed change.** Reorder the sections, keeping their text except where noted:

1. Build the application once (current 85-119): one container, no lifetimes.
2. Choose the owner of each service (current 179-194): introduces singleton, scoped, and transient.
3. One child container per request (current 35-83): now builds on 1 and 2. Change its opening to
   "Add a per-request value to the application from the previous section".
4. Close each request container (121-177).
5. Make services ready before listening (move 645-692 here, and shorten it to the first code block plus two sentences).
6. Connect a shutdown signal (196-221). Move the bounded-wait block (223-250) into a new
   "Bound the shutdown wait" subsection placed after the host recipes.
7. The host recipes: Node HTTP, Express, Fastify, Bun, Elysia, Deno.
8. Bound the shutdown wait; Disconnects, streaming, and WebSockets; Background jobs; Test; Organize; Troubleshooting.

Update the Contents list (lines 17-33) to match.

### 2.2 [4/5] Integration guide: two of its three sections repeat the server guide under a different helper name

**Where:** `enterprise-integration.md:11-100`

**What's wrong.**

- "One child container per operation" (lines 11-67) repeats `server-integration.md` sections
  "Close each request container" and "Disconnects, streaming, and WebSockets", in places almost
  word for word. Compare `enterprise-integration.md:47-49` with `server-integration.md:702-705`:
  "A container tracks acquisition work and disposal, not every later method call…".
- It calls the helper `withOwnedScope`, while the server guide's identical helper is `withOwnedContainer`.
- "Checked test substitutions" (lines 69-100) repeats `server-integration.md:749-791` and the README's "Swap a dependency for a test".

**Why it matters.** A human reading both pages learns the same idea twice under two names. An
agent greps for one helper name and misses the other.

**Proposed change.**

- Replace lines 11-67 with a four-line section:

  > ## One child container per operation
  >
  > Requests, jobs, and messages share one ownership shape: open a child container, run the
  > work, close the child, and keep both errors if both fail. The
  > [server guide](server-integration.md#close-each-request-container) builds it step by step;
  > [`examples/integration/owned-container.ts`](../../examples/integration/owned-container.ts)
  > is the tested `withOwnedContainer` helper (see finding 3.4). Two facts are specific to
  > embedding: never pass the shared application container as `acquire()`, and a failed
  > `ensureServicesReady` has already closed its container.

- Replace lines 69-100 with the compiled block from finding 3.1 and the existing Nest/Angular
  paragraph (lines 96-100).
- The page then reads: dynamic features (the hook, finding 1.4), then fixtures, then framework boundaries.

### 2.3 [4/5] Server: "Organize a larger application" ignores modules as units of work

**Where:** `server-integration.md:793-810`

**What's wrong.** The table lists nine APIs but not:

- the module layout (`contract.ts` / `module.ts` / `check.ts` / `tsconfig.json`)
- `verifyGraphAtCompileTime()` or `src/app.check.ts`
- the per-module `tsc --noEmit -p src/features/<name>/tsconfig.json` check
- `withRenamedRequirement`, which AGENTS.md rule 8 names next to `withRenamedExport`

Its first row links `tutorial.md#reuse-named-modules`; that heading is now "Build modules as
units of work" (tutorial line 350), so the link text and target disagree in vocabulary.

**Why it matters.** This is where a server reader graduates from one file to a codebase, and
the README's central positioning ("Modules as units of work") is missing from it.

**Proposed change.** Insert before the table:

> ### Split features into modules
>
> Move each feature's factories into `src/features/<name>/module.ts` and export only the
> services the server resolves. Install every module in one list in `src/app.ts`, and keep a
> `src/app.check.ts` that verifies the merged graph without building it. The layout and the
> per-module check command are in [AGENTS.md](../../AGENTS.md#module-layout); the
> [modules guide](examples-modularity.md) has runnable programs.

Then add this block, which compiles and runs:

```ts
import { DiBag } from 'di-bag';

type Catalog = Map<string, string>;
type RequestContext = { id: string };

// src/features/catalog/module.ts
const catalogModule = DiBag.createBuilder()
  .withServices({
    handler: ({ catalog, request }: { catalog: Promise<Catalog>; request: RequestContext }) => ({
      async list() {
        return { requestId: request.id, items: Array.from((await catalog).values()) };
      },
    }),
  })
  .buildModule({ exportedServiceKeys: ['handler'], moduleLabel: 'catalog' });

// src/app.check.ts
DiBag.createBuilder()
  .withInstalledModules([catalogModule])
  .withServices({
    catalog: DiBag.providerWithLifetime({
      provider: async (): Promise<Catalog> => new Map([['book', 'A good book']]),
      lifetime: 'singleton:one-per-container-tree',
    }),
    request: (): RequestContext => ({ id: 'outside-request' }),
  })
  .verifyGraphAtCompileTime() satisfies void;
```

In the table's first row, change the API list to
`buildModule, withInstalledModules, withRenamedRequirement, withRenamedExport` and the link text to "Build modules as units of work".

### 2.4 [3/5] Server: "Deno and portable acquisition" mixes two audiences

**Where:** `server-integration.md:527-643`

**What's wrong.** The section opens with Deno (which needs nothing extra, per lines 529-530 and errors.md#di-bag-classifier-required
"Node, Bun, and Deno never raise it"). It then spends lines 535-595 on a browser and worker
`application.ts` that no server on this page needs, and only then shows the Deno server.

A Deno reader has to get past 60 lines of irrelevant code. A browser reader will not look for
this in a server guide; the React guide covers browsers.

**Why it matters.** Gradual exposition means each section serves the reader it is titled for.

**Proposed change.**

- Rename the section to `## Deno`. Keep lines 529-533, then go straight to the `server.ts` block (597-643).
- Move lines 535-595 into a new section near the end, `## Browsers, workers, and other hosts without process.getBuiltinModule`.
  Open it with "No server on this page needs this. Read it when the same `application.ts` must also load in a browser or worker; the
  [React guide](react-integration.md#build-the-application-runtime-once) is the browser recipe."
- Update the Contents entry.

### 2.5 [3/5] React: the opening table lists runtimes the page never builds

**Where:** `react-integration.md:33-53`

**What's wrong.** "Who owns what" has three rows. The second ("User session … The same owner
pattern keyed by user id") has no code, example, or test. The third rule (lines 49-53) gives
SSR advice ("create the app runtime per request or per worker") for a recipe that "has no SSR
example". A reader meets these before the first code block, mixed in with the tested material.

**Why it matters.** Untested patterns presented first, with the same weight as tested ones,
blur which parts the page proves.

**Proposed change.**

- Reduce the table to the Application and Project rows.
- Move the User session row and the SSR rule into a new final section before "When this becomes a package":

  > ## Beyond this recipe (not tested)
  >
  > - **A user session.** Use a second `RuntimeOwner` keyed by user id when a session acquires
  >   resources such as token refresh or a presence socket. Close it on sign-out, before the next session starts.
  > - **Server rendering.** A runtime created at module import time is shared by every request
  >   in a server-rendered process. Create the app runtime per request or per worker, never per module.

### 2.6 [3/5] Server: the Elysia recipe drops the shared `application.ts` and the shared shutdown

**Where:** `server-integration.md:459-525`

**What's wrong.** Every other host reuses `createApplication` and `createRequestContainer`, as
promised at lines 174-177 ("The framework recipes below use the request-container application").
Elysia redefines the whole graph inline (lines 472-489) with a different request ID source (`crypto.randomUUID()` in `derive`).
It also:

- handles only `SIGTERM` with `process.once` (line 517), not `onShutdown`, so Ctrl-C (SIGINT) skips closing the container
- listens on all interfaces (`.listen(3000)`, line 515), while every other recipe uses `127.0.0.1`

**Why it matters.** A reader comparing recipes cannot tell which differences matter. An agent
copying it gets a second, diverging definition of the graph.

**Proposed change.** Replace lines 466-489 with:

```ts
import { Elysia } from 'elysia';
import { createApplication, createRequestContainer } from './application.ts';
import { onShutdown } from './node-shutdown.ts';

const app = await createApplication();
```

In `derive` (line 500), use `createRequestContainer(app, crypto.randomUUID())`. Change line 515
to `.listen({ port: 3000, hostname: '127.0.0.1' })` and line 517 to `onShutdown(() => server.stop());`.
Keep the existing paragraph at lines 520-525. (Whether `Elysia.stop()` returns a Promise for
`onShutdown` must be checked against `elysia@1.4.30`; see finding 3.2.)

### 2.7 [3/5] Comparison: no per-library row for the properties the page says it distinguishes

**Where:** `comparison.md:53-159`

**What's wrong.** `documentation.md` (rules section, "Keep comparison claims specific…")
requires distinguishing a typed lookup from graph checks, Promise-valued services from awaited
dependencies, and feature availability from stability. The page does this, but only in prose
spread over six subsections. A reader has to rebuild the matrix themselves.

**Why it matters.** Gradual exposition for a comparison means a summary first, with detail on demand.

**Proposed change.** After the "What type-safe means here" section, add a table. Each cell must
link the sentence it summarizes in the subsections below, and the table carries the page's
review date.

| | Missing dependency found | Async dependency | Who closes child containers | Decorators |
| --- | --- | --- | --- | --- |
| DI Bag | `tsc` at `buildContainer()` / `verifyGraphAtCompileTime()` | `Promise<T>` service, consumer awaits | Parent closes tracked children | None |
| Awilix | Resolution (strict mode checks lifetimes at runtime) | — | Caller | None |
| InversifyJS | Resolution | `getAsync` awaits | — | Optional |
| TSyringe | Resolution | `Promise<T>` value, not awaited | — | Required for constructor injection |
| Typed Inject | `tsc`, in registration order | `Promise<T>` value | Child-first `dispose()` | None |
| Effect | Program type | Effect | Finalizers run when the resource is released | None |

Fill the "—" cells only from the sources already cited in the subsections. Leave a cell blank
where the cited docs do not say.

---

## Goal 3: API usage an agent can act on

### 3.1 [5/5] Integration guide: the test suite does not verify the substitution code the page shows

**Where:** `enterprise-integration.md:71-94`

**What's wrong.** The page shows `original.createIndependentContainer(['clock'], { clock: () => ({ now: () => 7 }) })`, then says:

- "The integration suite verifies that a private module consumer sees the override and that transient acquisitions remain distinct."
- "The fixture and original are independent owners. Close both…"

The suite's test for this (`tests/enterprise-integration.test.ts:66-82`, "test substitutions retain
private module contracts…") does not call `createIndependentContainer` at all. It calls
`builder.withReplacedService('clock', () => ({ now: () => 7 })).buildContainer()`, a builder-level
replacement with a single owner. The claim attaches test evidence to an API the test does not use.

**Why it matters.** An agent takes "verified by the suite" as permission to rely on the exact call shown.

**Proposed change.** Do both of these:

- **Make the claim true.** Add a second test to `tests/enterprise-integration.test.ts` that uses
  `createIndependentContainer` over the same private-module graph, asserts `result === 7`, and
  closes both containers.
- **Make the page block compile.** Replace lines 71-88 with the block below. It compiles under
  `tsc6` strict and runs under Bun. Then change line 90 to "The integration suite verifies this
  with both `createIndependentContainer` and `builder.withReplacedService`."

```ts
import assert from 'node:assert/strict';
import { DiBag } from 'di-bag';

type Clock = { now(): number };

const reader = DiBag.createBuilder()
  .withServices({
    privateRead: ({ clock }: { clock: Clock }) => clock.now(),
    result: ({ privateRead }: { privateRead: number }) => privateRead,
  })
  .buildModule({ exportedServiceKeys: ['result'], moduleLabel: 'reader' });

const original = DiBag.createBuilder()
  .withInstalledModules([reader])
  .withServices({ clock: (): Clock => ({ now: () => Date.now() }) })
  .buildContainer();
const fixture = original.createIndependentContainer(['clock'], {
  clock: (): Clock => ({ now: () => 7 }),
});
try {
  const value: number = fixture.resolve('result');
  assert.equal(value, 7);
} finally {
  await fixture.close();
  await original.close();
}
```

### 3.2 [5/5] Server: "type-checked against that package" for Elysia has no evidence in the repo

**Where:** `server-integration.md:461-463`

**What's wrong.** "This version of the recipe was type-checked against that package and the
built DI Bag package." There is no Elysia dependency, fixture, script, or test anywhere in the
repo. `grep -rli elysia` over `tests`, `scripts`, `tools`, and `package.json` finds nothing. The
claim came in with `7414d20` (a docs-only commit that changed one file). Nothing re-checks it
when `di-bag`'s types change. The block is not compiled by `docs:check`, because it imports `elysia`.

**Why it matters.** It is the only recipe on the page that claims verification, and the claim cannot be reproduced.

**Proposed change.** Pick one:

- **Weaken the claim.** Replace lines 461-463 with:

  > Install `elysia@1.4.30` in the application. This recipe is not compiled or run by this
  > repository's checks; verify it against your Elysia version. It creates a child container
  > for each request.

- **Make it true.** Add `elysia@1.4.30` to `tools/platform/package.json`, and a
  `tests/platform/elysia-recipe.test.ts` that extracts the block, compiles it against the emitted
  declarations, and runs one request under Bun. Then keep the sentence and name the test.

### 3.3 [4/5] Server: the recipes do not type-check without a compiler option the page never mentions

**Where:** `server-integration.md:9-13`. This affects every block that imports `./*.ts`: lines 157, 256, 318, 378, 417, 599, and 753.

**What's wrong.** The page says "Runtime execution does not replace type checking with the
supported compiler" but never says how to type-check its files. I ran `tsc6` on the extracted
recipe: imports such as `from './application.ts'` fail with
`TS5097: An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled`
unless that option (with `noEmit`) or `rewriteRelativeImportExtensions` is set. With it, the
whole recipe (application, helpers, job, test) compiles with 0 errors.

**Why it matters.** An agent following AGENTS.md's "run the full type-check" will hit TS5097 on the first file and may "fix" it by removing the extensions, which breaks `node server.ts`.

**Proposed change.** Add a section after the opening, `## Type-check the recipes {#type-check-the-recipes}`:

> The recipes import sibling files with a `.ts` extension, so Node 24 and Bun can run them
> directly. Type-check them with:
>
> ```json
> {
>   "compilerOptions": {
>     "strict": true,
>     "module": "NodeNext",
>     "moduleResolution": "NodeNext",
>     "target": "ES2022",
>     "noEmit": true,
>     "allowImportingTsExtensions": true
>   }
> }
> ```
>
> ```sh
> npx tsc -p tsconfig.json
> ```
>
> To emit JavaScript instead, replace `noEmit` and `allowImportingTsExtensions` with
> `"rewriteRelativeImportExtensions": true`.

### 3.4 [4/5] Server and integration guide: two copies of the helper, only one tested, and the tested one uses retired vocabulary

**Where:**

- `server-integration.md:123-153` (`withOwnedContainer`, untested)
- `enterprise-integration.md:13-21` (links `examples/integration/owned-scope.ts`)
- `examples/integration/owned-scope.ts:1,2,14`

**What's wrong.** The server guide's `withOwnedContainer` is not compiled (it has no `di-bag`
import) and no test exercises it. The integration guide's `withOwnedScope` is the same function,
and `tests/enterprise-integration.test.ts` tests it thoroughly: `AggregateError` order,
`throw undefined`, close exactly once. But its file:

- uses retired words in its doc comment ("a fresh owned bag/scope") and its error message ("Work and scope cleanup both failed")
- differs from the server copy's message ("Work and container disposal both failed")

`docs:retired-names` does not scan `examples/`.

**Why it matters.** An agent searching for the helper finds two names and two messages. The
one the server guide teaches is not the one CI tests.

**Proposed change.**

1. `git mv examples/integration/owned-scope.ts examples/integration/owned-container.ts`.
2. Rename the function to `withOwnedContainer` and its parameter to `container`.
3. Change the doc comment to `/** Application recipe: acquire a fresh owned container, run work, then close it. */`
   and the message to `'Work and container disposal both failed'`.
4. Update the imports in `tests/enterprise-integration.test.ts` (lines 3 and onward).
5. In `server-integration.md:123`, replace "Save the following helper as `owned-container.ts`. It is application code."
   with "Save the following helper as `owned-container.ts`. It is a copy of
   [`examples/integration/owned-container.ts`](../../examples/integration/owned-container.ts), which
   `tests/enterprise-integration.test.ts` exercises."
6. Optionally, add `examples/` to the file list in `scripts/check-docs-retired-names.mjs`, or a separate comment-only check for it.

### 3.5 [4/5] React: the project-runtime block does not compile on its own and has drifted from its source

**Where:** `react-integration.md:123-164`

**What's wrong.** This block has no `import` line, so `docs:check` skips it. It also uses three
types the page never declares: `DocumentsStore` (line 139), `ProjectRuntime` (line 158), and
`ProjectServices` (implied at line 162). An agent copying the page cannot compile it.

It has also drifted from its source, `examples/react/project-runtime.ts:49-53`. The source
resolves both services with `Promise.all([bag.resolve('manifest'), bag.resolve('documents')])`;
the page awaits them one after the other (lines 160-161). Separately, the source uses `bag` as a
variable name, which is retired vocabulary in a linked example.

**Why it matters.** This is the core of the page's API usage, and nothing pins it to the code that is actually tested.

**Proposed change.**

1. Move the three types into the compiled block at line 79, after `AppRuntime`:

```ts
type DocumentsStore = {
  subscribe(this: void, listener: () => void): () => void;
  getSnapshot(this: void): readonly DocumentRecord[];
  add(title: string): Promise<void>;
};
type ProjectServices = { readonly projectId: string; readonly name: string; readonly documents: DocumentsStore };
type ProjectRuntime = { readonly services: ProjectServices; close(options?: CloseOptions): Promise<void> };
```

2. Make block 2 compile. Either:
   - (a) merge it into block 1, so the page has one compiled `ts` block followed by prose; or
   - (b) teach the guide loop in `tools/docs/lib/agent-docs.mjs` (lines 145-153) to honor the
     existing `// continues: <heading-id>` marker that agent pages already use. Start block 2 with
     `// continues: build-the-application-runtime-once` and give that heading an explicit `{#…}` id.
3. Make lines 160-161 match the source: `const [manifest, documents] = await Promise.all([container.resolve('manifest'), container.resolve('documents')]);`
4. Rename `bag` to `container` in `examples/react/project-runtime.ts` and `app-runtime.ts`, and the
   comments "the bag never disposes it" and "acquisition mode" in `app-runtime.ts:12-19`.

### 3.6 [3/5] Comparison: no code, though the page's central claim is a compile-time check

**Where:** `comparison.md:38-51` ("What type-safe means here")

**What's wrong.** The page argues that DI Bag "checks completeness at `buildContainer()`" but
shows nothing. An agent cannot see the message to grep for. The section also omits
`verifyGraphAtCompileTime()`, which AGENTS.md rule 9 names as the way to report the same message
on its own line. It says cycles are "detected during resolution" without the README's addition
(`README.md:317-318`) that `di-bag-graph` finds them before running.

**Why it matters.** A comparison claim backed by a snippet that CI compiles is checkable; one backed only by prose is not.

**Proposed change.**

- After line 45, add this block. It compiles under `tsc6`, and `docs:check` will compile it
  because it imports only `di-bag`; an unused `@ts-expect-error` fails the build, as in the README.

```ts
import { DiBag } from 'di-bag';

type Db = { query(sql: string): Promise<readonly unknown[]> };

const builder = DiBag.createBuilder().withServices({
  repository: ({ db }: { db: Db }) => ({ list: () => db.query('select 1') }),
});

// @ts-expect-error required services are missing: db
builder.buildContainer();
```

- Follow it with: "The message is `required services are missing: db`; `builder.verifyGraphAtCompileTime() satisfies void;` reports it without building. See the [error index](../agent/errors.md#missing-service)."
- Replace "Dependency cycles are detected during resolution" (lines 49-50) with "Dependency cycles are detected at resolution, or before running by [`di-bag-graph`](../../tools/graph/README.md)."

### 3.7 [4/5] Server: troubleshooting and lifetime prose omit the exact option names and messages an agent greps for

**Where:** `server-integration.md:191-193`, `812-823`

**What's wrong.**

- Line 192 says "unless it explicitly allows scoped dependencies" but never names `allowsScopedDependencies`.
- Line 818 ("A child override does not affect a shared handler | Sharing borrows the parent's complete acquisition") never names `sharedParentServiceKeys`.
- The troubleshooting table gives one code (`DI_BAG_CLASSIFIER_REQUIRED`) and no compile-time message text, although AGENTS.md rule 9 says to read a rejection by its message and branch on `code`.

**Why it matters.** Troubleshooting is the section an agent reaches with an error string in hand, and it can only match what is written.

**Proposed change.**

- Line 192: change it to "unless its `providerWithLifetime` call sets `allowsScopedDependencies: true`".
- Replace the table with these rows. The message texts come from errors.md and `src/lifetime-types.ts:248`.

| Symptom or message | Code / section | What to check |
| --- | --- | --- |
| `required services are missing: <key>` | [missing-service](../agent/errors.md#missing-service) | Register `<key>`, or supply it from the host when it is a module requirement. |
| `singleton lifetime cannot capture scoped dependency: <a> -> <b>` | [singleton-captures-scoped](../agent/errors.md#singleton-captures-scoped) | Make `<b>` singleton or `<a>` scoped; `allowsScopedDependencies: true` only for a deliberate capture. |
| `createChildContainer cannot replace singleton service: <key>` | [`DI_BAG_SINGLETON_REPLACEMENT`](../agent/errors.md#di-bag-singleton-replacement) | Mark it `'scoped:one-per-container'`, or use `createIndependentContainer`. |
| Every request sees the placeholder ID | — | Resolve the handler from `createRequestContainer`, not the application container. |
| A child override does not reach a handler | — | The handler is singleton or listed in `sharedParentServiceKeys`; keep it scoped. |
| `buildContainer()` throws in a browser or worker | [`DI_BAG_CLASSIFIER_REQUIRED`](../agent/errors.md#di-bag-classifier-required) | `details.bindings` names each factory; give it `factoryReturnKind`. |
| A dependency object cannot be spread or enumerated | [`DI_BAG_INVALID_DEPENDENCY_ACCESS`](../agent/errors.md#di-bag-invalid-dependency-access) | Read declared properties directly. |
| `ensureServicesReady` rejects | [`DI_BAG_SERVICE_READINESS_FAILED`](../agent/errors.md#di-bag-service-readiness-failed) / [`_CANCELLED`](../agent/errors.md#di-bag-service-readiness-cancelled) | The container is already closed; read `cause`, or await `disposalPromise`. |
| `close()` rejects after `waitTimeoutMs` | [`DI_BAG_CLOSE_TIMEOUT`](../agent/errors.md#di-bag-close-timeout) | `details.disposersStillRunning` names the disposer that never settles. |
| Disposal never runs | — | Attach `DiBag.providerWithDisposal` and close the owning container. |

### 3.8 [3/5] React and comparison: comparison claims lack the date and versions the writing rules require

**Where:** `react-integration.md:341-360`, `comparison.md:32-36`

**What's wrong.** The rules section of `documentation.md` says: "Keep comparison claims specific
and link to the other library's official docs or source… Record version-sensitive lifetime and review dates."

- **React page.** The Obsidian / inversify-react / react-ioc table has no review date and no
  versions. Line 357 makes a sweeping negative claim: "None of the three models asynchronous
  service readiness, cancellation of a replaced readiness attempt, or teardown that outlives effect disposal".
  Line 360 admits the behavior "was not re-tested".
- **Comparison page.** It is dated 2026-09-10 but gives no version for any library. Its links
  target default branches (`awilix/blob/master/src/container.ts`, `tsyringe/blob/master/...`,
  `typed-inject/blob/master/...`), which line 34 concedes "can change".

**Why it matters.** An agent or reader cannot tell whether a claim still holds, and a negative claim about another library is the kind most likely to go stale.

**Proposed change.**

- **React page.** Add under the heading: "Reviewed against each project's documentation on <date>:
  Obsidian <version>, inversify-react <version>, react-ioc <version>." Rewrite line 357 as "None of
  the three documents asynchronous service readiness, …" so the claim is about documentation, which is what was reviewed.
- **Comparison page.** Add a "Versions reviewed" line naming each library's version on the
  review date. Replace `blob/master` links with tag or commit permalinks for those versions.
  Re-review, since the 0.5 renames landed after 2026-09-10, and update the date.

---

## Score counts

| Score | Count | Findings |
| --- | --- | --- |
| 5/5 | 4 | 1.1, 1.2, 3.1, 3.2 |
| 4/5 | 10 | 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 3.3, 3.4, 3.5, 3.7 |
| 3/5 | 6 | 2.4, 2.5, 2.6, 2.7, 3.6, 3.8 |
| 2/5 | 0 | |
| 1/5 | 0 | |

## Cross-page inconsistencies

1. **The integration page has five names:**
   - H1 "Request containers, test fixtures, and dynamic features"
   - sidebar "Integration patterns"
   - server breadcrumb "Ownership recipes" (`server-integration.md:3`)
   - README "integration recipes" (line 239) and "Integration guide" (line 357)
   - comparison "integration recipes" (`comparison.md:158`)

   The comparison page's H1 "Choosing a dependency injection approach" also differs from its sidebar label "Comparison with alternatives".
2. **The helper has two names and two messages:** `withOwnedContainer` / "Work and container
   disposal both failed" in the server guide, and `withOwnedScope` / "Work and scope cleanup both
   failed" in the integration guide and its example (finding 3.4).
3. **The same paragraph appears three times.** "A container tracks acquisition work and disposal,
   not every later method call" is at `server-integration.md:702-709`, `enterprise-integration.md:43-55`,
   and, for close timeouts, `react-integration.md:284-286`.
4. **The test-substitution example appears four times**: README "Swap a dependency for a test",
   `server-integration.md:749-791`, `enterprise-integration.md:69-94`, and recipes.md#fixture-test,
   with different service names (`config`, `catalog`, `clock`). Pick one canonical example (the
   recipe) and link it from the guides.
5. **Positioning vocabulary.** The README says "Modules as units of work"; `comparison.md:24` says
   "Radical modularity". The server, React, and integration pages never mention modules as the unit
   of work, `verifyGraphAtCompileTime`, or the `check.ts` layout.
6. **"Tested recipes" means different things.** `README.md:329-330` calls the server and React
   guides "tested recipes". Only React's is tested; the server guide's host recipes are not compiled
   or run (only its `di-bag`-only blocks compile), and its own closing line 827 calls them
   "application recipes, not packaged framework adapters". Either qualify the README sentence or
   add a server recipe test.
7. **Where cycle detection happens.** `comparison.md:49` says "during resolution". `README.md:317`
   says "at runtime, or before running by `di-bag-graph`".
8. **The singleton rule.** The server guide (191-193) gives the `allowsScopedDependencies`
   exception; the comparison page (15-17) states the rule as absolute (finding 1.2).
9. **The job recipe reuses request names.** `server-integration.md:735-742` handles a job with
   `createRequestContainer(app, 'job-42')`; the integration guide says "operation". Consider
   `createOperationContainer` in both, or say that the request helper is reused on purpose. The
   comment "Acknowledge the message after work and disposal succeed" names a step the snippet does not show.
10. **Linked examples are outside the retired-names check.** `examples/integration/owned-scope.ts`,
    `examples/react/app-runtime.ts`, `project-runtime.ts`, `runtime-owner.ts`, and `services.ts` use
    "bag", "scope", "cleanup", "startup", and "acquisition mode" in comments and variable names, and
    all are linked from these guides. `docs/guides/documentation.md` also says `docs:check`
    type-checks only AGENTS.md, `docs/agent/*.md`, and `@example`s; in fact
    `tools/docs/lib/agent-docs.mjs:145-153` also compiles standalone guide and README blocks. That
    sentence should say so, so writers know which guide blocks are protected.
