# Container Renames (Phase 6) Implementation Plan

> **Status: Accepted for planning.** Controller review repairs are recorded in `docs/superpowers/plans/handoff/resume-2026-09-21.md`; execution and phase gates remain subject to the active heavy-command hold.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the `Bag` type to `Container`, give the container, module and configuration calls their 0.5.0 names and one-bag shapes (`serviceSnapshot`, `graphSnapshot`, `createChildContainer`, `createIndependentContainer`, `withRenamedExport`, `lifecycleObservers`), and remove the `di-bag/node` entry point.

**Architecture:** Expand, migrate, contract, as the master plan prescribes. The new methods, option names and type names are added next to the old ones on the class that is still called `Bag`; the codemod then moves every typed call site in ONE pass while the 0.4.0 declaration names still resolve; everything the codemod cannot read (source held in strings, `.mjs` suites, packaging expectations, Markdown, the graph tool's fixtures) is moved by hand; only then are the old names, the class name `Bag` and `src/node.ts` removed. Spike S3 decides whether `replacementProviders` can be contextually typed from `replacedServiceKeys` inside one object literal; the fallback keeps the pair positional.

**Tech Stack:** TypeScript 6.0.2 (`tsc6`) and 7.0.2 (`tsc`), Bun 1.4.0 (`bun test`), Node 24.20.0, `tools/codemod` from phase 1, TypeDoc and VitePress under `tools/docs`, `tools/graph`.

**Spec:** `docs/superpowers/specs/2026-09-20-swift-api-style.md`, sections "Vocabulary" (container, child container, independent container), "Rename map" (tables "Facade", "Container", "Module", "Exported types"), "One entry point", and the S3 row of "Shapes decided by measurement". Worked examples 2, 3, 4, 6, 11, 12 and 13 in `docs/superpowers/specs/2026-09-20-swift-api-style-examples.md`. Master plan: `docs/superpowers/plans/2026-09-21-00-swift-api-style-master.md`, phase 6 row; its protocol, environment, commit format, evidence rules and gate list apply to every task here. The spec's names win over anything written in this plan.

## Global Constraints

- This is phase 6 of the master plan. Branch: `phase-06-container-renames`, cut from `next`. Executors never push, publish, merge, or edit the spec's decisions.
- Names introduced here are final 0.5.0 names, copied from the spec: `Container`, `serviceSnapshot`, `graphSnapshot`, `createChildContainer`, `createIndependentContainer`, `replacedServiceKeys`, `replacementProviders`, `sharedParentServiceKeys`, `withRenamedExport`, `currentExportKey`, `newExportKey`, `lifecycleObservers`, `onLifecycleEvent`, `onObserverFailure`, `LifecycleObserver`, `CreateChildContainerOptions`, `CreateIndependentContainerOptions`, `CheckedChildContainerLifetimes`, `DisjointChildContainerSelection`. Do not shorten or vary them.
- Names that stay in this phase although later phases change them: `DiBag.token(...).of<S>()` and `token.key` (phase 8), `DiBag.withLifetime`, `DiBag.withDisposal`, `withMetadata`, `transformService` and the lifetime values `'root'`, `'scoped'`, `'transient'` (phases 8 to 10), every error code including `DI_BAG_INVALID_SCOPE`, `DI_BAG_INVALID_OVERRIDE`, `DI_BAG_INVALID_EXPORT` and `DI_BAG_INVALID_CONFIGURATION` (phase 11), the event kinds `scope-opened` and the fields `scopeId`, `parentScopeId`, `label`, and the type `ScopeEventFields` (phase 11), `ObserverFailure`, `ObserverCallback`, `ObserverErrorCallback` (the spec does not rename them).
- Names that stay for good: the product and facade name `DiBag`, the package name `di-bag`, the `DI_BAG_` code prefix, `resolve`, `close`, `ensureServicesReady`, and the internal class `BagRuntime` with its file `src/runtime.ts` (decision and reason in Task 8).
- Parameter shape rule (spec, standard rule 4): both container-deriving calls have no required input, so each takes one optional bag. `withRenamedExport` has two required inputs, so it takes one bag. Never two positional parameters, except under the S3 fallback, which the spec names.
- The package keeps zero runtime dependencies, and after this phase nothing under `src/` may contain a `node:` specifier in an `import` or `require`. `process.getBuiltinModule('node:util/types')` in `src/acquisition-mode.ts` is a call, not an import, and stays.
- Runtime messages keep the format `DI_BAG_CODE: message; see <errors page>#<anchor>`. A reworded existing throw site keeps its 0.4.0 code; phase 11 moves it. A NEW validation site raises `DI_BAG_INVALID_ARGUMENT` with `details: { operation, argument, expected }` written as an object literal at the throw site, and `expected` taken from the closed vocabulary of `docs/superpowers/plans/2026-09-21-12-observability-and-errors.md` Task 9.
- `details.operation` and the method name inside a message become the 0.5.0 method name in the same commit that adds the method. The two messages `bag is closing` and `bag is closed` are the explicit exception: their 15 assertions and the three interpolation sites remain unchanged until the separate plan 12, `2026-09-21-12-observability-and-errors.md`, which implements master phase 11.
- Preserve phase 4's collection value boundary. A replacement provider owns and disposes its original array value, while each `resolve`, lazy read, and alias read returns a fresh frozen shallow view through `freshCollectionView`. Container renaming must continue through the phase-4 graph/runtime collection channel; it must not read a replacement public binding directly.
- Master assumption 10 authorizes this bounded phase-6 exception: from `feat!: add container derivation APIs` through `refactor!: migrate generated and agent container calls`, only generated-reference freshness or API-card coverage/budget failures caused solely by simultaneous old/new public declarations may be red. Capture the actual failing assertions and counts before using it; a predicted failure is not evidence. All applicable compiler, runtime, codemod, graph, and other documentation checks must pass. Record affected hashes and the precise red checks in commit bodies and the phase report; bisect skips only those hashes. Tasks 8 through 11 end the exception with a green `refactor!: contract container API and publish reference` commit, preserving the unchanged 400-line card limit. No red state may be merged or released.
- Reuse phase 5's `snapshotOptionsBag(options, operation, required, optional?)` from `src/options-bag.ts` for every new bag. Do not duplicate object-shape validation. The helper requires a non-null, non-array object, rejects unknown own keys and supported inherited keys, and reads each allowed own property once after all shape checks pass. It does not restrict the object prototype.
- `AGENTS.md` is at its 150-line budget, enforced by `npm run docs:check`. Every edit there replaces text inside existing lines; `wc -l AGENTS.md` must print `150` or less after each edit.
- Compile budget: instantiations of the twelve evidence cases may grow by at most 10% in total against `docs/superpowers/plans/evidence/baseline.md`, cumulatively over all phases.
- Never delete, skip or weaken a test or a negative fixture to get green. Most caught errors in tests are typed `any`, so the compiler does not flag a missed rename of an option key or an error field; use the audit greps in each task.
- Every command runs from the repository root with this environment:

```bash
export PATH="<the directory that holds Bun 1.4.0>/bin:$PATH"
export npm_config_update_notifier=false
bun --version   # must print 1.4.0
node --version  # must print v24.20.0
```

- Commits use Conventional Commits and end with these two lines. Commit after each task except the explicitly combined Tasks 1–2 and coherent Tasks 8–11 contract groups. The codemod's mechanical rewrite is its own commit whose body holds the exact command.

```
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
```

## What was verified for this plan, and what was not

This plan was written on 2026-09-21 against the 0.4.0 source on `next`, under a memory guard that forbade running the TypeScript compiler in any form. Read every claim below with that in mind.

- **Read, not run:** every statement about `src/`, the tests, the scripts, the docs tooling and the graph tool comes from reading the files at commit `491a33b`. Phases 3 to 5 will have changed some of them before this phase starts; "State on entry" tells you how to confirm each name.
- **Run:** the runtime probes listed in the section "Probes that were run" at the end of this plan, each as one `bun test` file with the pinned Bun 1.4.0 in a scratch worktree of the 0.4.0 source. Every count in this plan was produced by the `git grep` or `grep` command printed next to it, run at commit `491a33b`; re-run the command on your tree, because phases 3 to 5 move the numbers.
- **Not run, and therefore UNCOMPILED:** every TypeScript signature in Tasks 1 to 5, every compiler fixture, every codemod fixture, and every change to a `.mjs` tool. No `tsc`, `tsc6`, `npm run typecheck`, `npm run build`, `npm test`, `npm run docs:check`, `npm run graph:check`, benchmark or evidence script was run for this plan. Where a task contains an uncompiled design it says so once, lists the positive and negative cases that must hold, and gives the fallback.
- An interrupted earlier attempt at this plan left an UNVERIFIED compiler transcript in the planner's scratch directory. It is used in Task 1 only as a warning about one shape (three overloads that all take one argument), never as evidence that something works.

Execution prerequisite: the active heavy-command hold must be lifted before running the build, compiler-lane, documentation-generation, benchmark/evidence or full-gate commands below. The separately serialized single `tsc6 -p tsconfig.json` exception with at least 6 GiB available does not authorize those commands. Narrow planning probes do not verify this phase.

## State on entry

Phases 0 to 5 are merged into `next`. The code this plan was written against still had the 0.4.0 names, so the names below are DERIVED from the master plan's phase table, the spec and plans 01 to 04. Confirm every row before Task 1. When a row differs, find the real name with `grep`, use it wherever this plan uses the expected one, and say so in the phase report. Do not guess.

Public names on entry:

- Facade: `DiBag.createBuilder()`, `DiBag.withConfiguration({ runtime, observers })`, `DiBag.token(symbol).of<S>()` and `DiBag.token(symbol).forCollectionOf<Item>()` (phase 4; `createToken` and `forService` arrive in phase 8), `DiBag.fromFactory`, `fromSyncFactory`, `fromAsyncFactory`, `fromFunction`, `fromClass`, `fromPlugin`, `optional`, `lazy`, `withDisposal`, `withLifetime`, `withMetadata`, `transformService`. `DiBag.all` is gone (phase 4).
- Builder (phase 5): `withServices(providersByName)`, `withTokenService({ token, provider })`, `withServiceAlias({ aliasKey, targetServiceKey })`, `withCollectionContribution({ collectionToken, provider })`, `withReplacedService({ serviceKey, provider })`, `withInstalledModules(modules)`, `verifyGraphAtCompileTime()`, `buildModule({ exportedServiceKeys, moduleLabel? })`, `buildContainer()`. Spikes S1 and S7 belong to phase 5: if S1 fell back, the two-input builder methods are positional (`withTokenService(token, provider)`); if S7 fell back, the install call is `withInstalledModule(module)`. Read `docs/superpowers/plans/evidence/phase-05.md` and adjust the test code in this plan accordingly. `withServices`, `buildContainer` and `buildModule({ exportedServiceKeys })` do not depend on a spike.
- The class returned by `buildContainer()` is still called `Bag<ServiceRegistrations, Constraints>` (type parameters renamed in phase 2) and has `resolve`, `inspect`, `inspectGraph`, `createScope` (three overloads), `fork` (two overloads), `close({ abortSignal?, waitTimeoutMs? })`, `ensureServicesReady(serviceKeys, options?)` (phase 3). `resolveAll` and `inspectAll` are gone (phase 4); `resolve(collectionToken)` returns the list and `inspect(collectionToken)` returns a list of snapshots.
- Module: `module.renameExport(oldKey, newKey)`. `module.withRenamedRequirement` does not exist yet (phase 7).
- Configuration: `ConfigurationOptions { runtime?, observers? }`, `ObserverOptions { onEvent, onError }`.
- Entry points: `di-bag` and `di-bag/node` (`src/node.ts`).
- Support types this phase renames: `ScopeOptions`, `DisjointScopeSelection` (`src/scope-types.ts`), `CheckedScopeLifetimes` (`src/lifetime-types.ts`), `ObserverOptions` (`src/observers.ts`).

```bash
git switch next && git status --short
# expect: no output
bun --version && node --version
# expect: 1.4.0 and v24.20.0
grep -n "^class Bag<" src/di-bag.ts
# expect: one line that starts: class Bag<ServiceRegistrations extends Registrations, Constraints extends NeedConstraint
grep -c "ensureServicesReady" src/di-bag.ts; grep -c "buildAndStart" src/di-bag.ts
# expect (phase 3 landed): a number above 0, then 0
grep -c -e "resolveAll" -e "inspectAll" src/di-bag.ts; grep -c "forCollectionOf" src/tokens.ts
# expect (phase 4 landed): 0, then a number above 0
grep -c -e "buildContainer(this" -e "^  withServices" src/di-bag.ts; grep -c -e "^  build(this" -e "^  register[<(]" src/di-bag.ts
# expect (phase 5 landed): a number above 0, then 0
grep -c -e "^  createScope[<(]" -e "^  fork[<(]" -e "^  inspect[<(]" -e "^  inspectGraph(" src/di-bag.ts; grep -c -e "createChildContainer" -e "serviceSnapshot" src/di-bag.ts
# expect (this phase has not run): a number above 0, then 0
ls src/node.ts && grep -c '"./node"' package.json
# expect: the path, then 1
node -e "const m=require('./tools/codemod/rename-map.json'); const from=(m.methods??[]).map(e=>e.from); console.log(from.includes('build'), from.includes('createScope'), (m.imports??[]).length)"
# expect (the map holds phases 3 to 5 and nothing of this phase): true false 0
grep -c -e '"retired-word: export Bag"' -e '"retired-word: export ScopeOptions"' -e '"retired-word: export DisjointScopeSelection"' -e '"retired-word: export CheckedScopeLifetimes"' -e '"retired-word: member createScope"' -e '"retired-word: member fork"' tests/api-naming-known-violations.json
# expect (the naming ratchet still lists this phase's six entries): 6
grep -c "^### DI_BAG_INVALID_ARGUMENT" docs/agent/errors.md
# expect: 0 or 1. Task 1 Step 9 needs the answer.
```

Measured at commit `491a33b` (0.4.0 names), to size the work. Re-run on your tree; earlier phases do not touch these calls, so the numbers should be close.

```bash
for name in '\.createScope\(' '\.fork\(' '\.inspect\(' '\.inspectGraph\(' '\.renameExport\(' '\bobservers:' '\bonEvent\b' '\bonError\b' '\bBag\b'; do
  printf '%-18s' "$name"; for area in tests examples scripts tools/graph docs/agent AGENTS.md src; do printf '%s=%s ' "$area" "$(git grep -hoE "$name" -- "$area" | wc -l)"; done; echo
done
```

| Pattern | tests | examples | scripts | tools/graph | docs/agent | AGENTS.md | src |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `.createScope(` | 177 | 2 | 28 | 0 | 7 | 0 | 1 |
| `.fork(` | 135 | 3 | 8 | 0 | 7 | 0 | 1 |
| `.inspect(` | 174 | 2 | 0 | 0 | 2 | 0 | 6 |
| `.inspectGraph(` | 13 | 0 | 0 | 0 | 4 | 0 | 2 |
| `.renameExport(` | 75 | 0 | 0 | 1 | 1 | 0 | 0 |
| `observers:` | 53 | 1 | 0 | 0 | 2 | 0 | 2 |
| `onEvent` | 52 | 1 | 0 | 0 | 3 | 0 | 10 |
| `onError` | 67 | 1 | 0 | 0 | 3 | 0 | 9 |
| the word `Bag` | 28 | 1 | 8 | 3 | 2 | 2 | 25 |

The spec says that about 200 files import the second entry. That number was not reproduced: `git grep -lE "src/node|di-bag/node" -- . ':!docs/superpowers'` lists 76 tracked files, 36 of them `tests/*.test.ts` files with the line `from '../src/node'`. Task 7 lists every one of the 76 by kind.

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `src/options-bag.ts` | consume, do not duplicate | Phase-5 `snapshotOptionsBag(options, operation, required, optional?)` validates and snapshots option bags |
| `src/scope-selection.ts` | modify | `selectChildContainer` and `selectIndependentContainer`: use `snapshotOptionsBag`, then snapshot selected tuple indices before reading provider getters. Later: `selectScope` deleted |
| `src/scope-types.ts` | modify | `CreateChildContainerOptions`, `CreateIndependentContainerOptions`, `DisjointChildContainerSelection`. Later: `ScopeOptions`, `DisjointScopeSelection` deleted |
| `src/lifetime-types.ts` | modify | `CheckedScopeLifetimes` renamed to `CheckedChildContainerLifetimes` |
| `src/types.ts` | modify | `Overrides` takes the operation name for its message; default operation names follow the renames |
| `src/di-bag.ts` | modify | new methods on the class, later the class rename to `Container`, `ConfigurationOptions.lifecycleObservers`, JSDoc that feeds the API card |
| `src/module.ts`, `src/module-types.ts` | modify | `withRenamedExport({ currentExportKey, newExportKey })` and its compile-time message |
| `src/observers.ts` | modify | `LifecycleObserver { onLifecycleEvent, onObserverFailure }` |
| `src/acquisition.ts`, `src/runtime.ts` | audit | preserve closing/closed messages; plan 12 owns their rename |
| `src/acquisition-mode.ts` | modify | one comment and nothing else; `hostClassifier` already does what the removed entry did |
| `src/node.ts` | delete | the second entry point |
| `src/index.ts` | modify | the export list follows |
| `package.json`, `tsconfig.build.json`, `tools/docs/typedoc.json`, `tools/docs/lib/coverage.mjs`, `tools/docs/vitepress.config.mjs` | modify | one entry point |
| `tests/container-derivation.test.ts` | create | runtime tests of both new calls and their bag parsing |
| `tests/container-names.test.ts` | create | runtime tests of `serviceSnapshot`, `graphSnapshot`, `withRenamedExport`, the configuration names, and, after the contract step, the absence of every old name |
| `tests/types/container-derivation.ts`, `tests/types/container-derivation-consumer.ts`, `tests/types/negative/container-derivation.ts` | create | the S3 compiler fixtures |
| `tests/types.test.ts` | modify | registers the two positive fixtures |
| `tools/codemod/rename-map.json`, `tools/codemod/test/fixtures/container-renames/` | modify, create | this phase's map entries and one fixture pair |
| `tests/**`, `examples/**` | modify | call sites: by the codemod where typed, by `reshape-untyped.mjs` and by hand where not |
| `/tmp/di-bag-phase-06/reshape-untyped.mjs` | create, not committed | text-level migration of calls the codemod cannot read |
| `scripts/agent-eval/**`, `tools/graph/**`, `scripts/*.ts`, `.github/workflows/ci.yml` | modify | untyped call sites, the graph tool's rename reader and README, packaging expectations |
| `AGENTS.md`, `docs/agent/recipes.md`, `docs/agent/errors.md`, `docs/guides/api-reference.md` (rows that link to deleted pages only) | modify | documentation that `npm run docs:check` verifies |
| `docs/agent/api-card.md`, `docs/reference/**` | regenerate | never edited by hand |
| `tools/docs/api-card-tasks.json`, `tools/docs/lib/api-card.mjs`, `tools/docs/test/*.test.mjs` | modify | the card's receiver becomes `container`; pinned signatures follow |
| `tests/types/negative/api-renaming.ts` | modify | one line per removed name |
| `tests/api-naming-known-violations.json` | shrink | six entries leave |
| `docs/superpowers/plans/evidence/phase-06.md` | create | the S3 decision and the twelve measurements |

Task groups: Task 0 is the entry check. Tasks 1 to 4 are the expand step (Task 1 is spike S3 with its measurement). Tasks 5 to 7 are the migrate step. Tasks 8 to 10 are the contract step. Task 11 regenerates documentation and Task 12 is the gate.

---

### Task 0: Branch, entry check, scratch directory

**Files:** none in the repository. Creates `/tmp/di-bag-phase-06/`.

- [ ] **Step 1: Create the branch**

```bash
git switch next && git pull --ff-only 2>/dev/null; git switch -c phase-06-container-renames
mkdir -p /tmp/di-bag-phase-06
```

- [ ] **Step 2: Run every row of "State on entry"**

Expected: every expectation holds. Write down three facts that later tasks need: whether S1 fell back (positional `withTokenService`), whether S7 fell back (`withInstalledModule`), and whether `docs/agent/errors.md` already has a `DI_BAG_INVALID_ARGUMENT` section.

- [ ] **Step 3: Build once, so that tests reading `dist/` start from a current build**

Run: `npm run build`
Expected: exits 0.

---

### Task 1: Expand container derivation and decide spike S3

**Files:**
- Modify: `src/scope-types.ts`
- Modify: `src/lifetime-types.ts`
- Modify: `src/di-bag.ts`
- Modify: `src/types.ts`
- Create: `tests/types/container-derivation.ts`
- Create: `tests/types/container-derivation-consumer.ts`
- Create: `tests/types/negative/container-derivation.ts`
- Modify: `tests/types.test.ts`
- Create: `docs/superpowers/plans/evidence/phase-06.md`

**Interfaces:**
- Consumes: phase 5's `snapshotOptionsBag(options: unknown, operation: string, required: readonly string[], optional: readonly string[] = [], inspectValue?: (name: string, value: unknown) => void): Record<string, unknown>`; the class type parameters `ServiceRegistrations` and `Constraints`; phase 4's final `Selection<ServiceRegistrations, Constraints, Keys, Operation>`, `SelectionRegistrations`, `ReboundSelected`, `AppliedSelection`, `OverrideFactoryContext`, `ScopeShareAdmission`, `ScopedAliases`, and `UnsharedAliases` helpers. Do not reconstruct the pre-collection replacement graph.
- Produces: `CreateChildContainerOptions`, `CreateIndependentContainerOptions`, `CheckedChildContainerLifetimes`, `DisjointChildContainerSelection`, and `Bag.createChildContainer` / `Bag.createIndependentContainer` during expand. Task 8 renames the receiver type to `Container`.

This type design is **UNCOMPILED**. The executor must prove inline and external tuples, named and token keys, collection tokens, consumer declaration output, wrong outputs, missing/extra providers, unknown keys, overlap, and root-capture diagnostics. After three serious attempts, or when any evidence case exceeds +10%, use Step 8's complete positional fallback.

- [ ] **Step 1: Write the positive fixture**

Create `tests/types/container-derivation.ts`:

```ts
import { DiBag, type Bag } from '../../src';
import type { Assert, Equal } from './assert';

type Clock = { now(): number };
const clockKey = Symbol('clock');
const clocksKey = Symbol('clocks');
const clock = DiBag.token(clockKey).of<Clock>();
const clocks = DiBag.token(clocksKey).forCollectionOf<Clock>();

const root = DiBag.createBuilder()
  .withServices({ value: () => 1, clock: (): Clock => ({ now: () => 1 }) })
  .withTokenService({ token: clock, provider: (): Clock => ({ now: () => 2 }) })
  .withCollectionContribution({ collectionToken: clocks, provider: (): Clock => ({ now: () => 3 }) })
  .buildContainer();

export const emptyChild = root.createChildContainer();
export const emptyIndependent = root.createIndependentContainer();
export const emptyChildBag = root.createChildContainer({});
export const emptyIndependentBag = root.createIndependentContainer({});
export const inline = root.createIndependentContainer({
  replacedServiceKeys: ['clock'],
  replacementProviders: { clock: ({ value }) => ({ now: () => value + 6, source: 'test' as const }) },
});
type Inline = Assert<Equal<ReturnType<typeof inline.resolve<'clock'>>, { now(): number; source: 'test' }>>;

const keys = ['value', clock] as const;
export const external = root.createIndependentContainer({
  replacementProviders: { value: () => 4, [clockKey]: ({ value }) => ({ now: () => value + 4 }) },
  replacedServiceKeys: keys,
});
export const child = root.createChildContainer({
  replacedServiceKeys: [clocks],
  replacementProviders: { [clocksKey]: ({ value }) => [{ now: () => value + 7 }] },
  sharedParentServiceKeys: ['value'],
});
const collection: readonly Clock[] = child.resolve(clocks);
const annotation: Bag<{ value: () => number }> = DiBag.createBuilder().withServices({ value: () => 1 }).buildContainer();
void collection; void annotation; void emptyChildBag; void emptyIndependentBag;
```

These three unannotated destructuring parameters are deliberate contextual-inference probes: named service with keys first, token service with providers first, and collection token with keys first. Keep both property orders. If inference fails, record it as an S3 failure; do not add annotations that hide it.

If phase 5 chose the positional fallback for S1, change only the two builder calls to that recorded syntax.

- [ ] **Step 2: Write the negative fixture**

Create `tests/types/negative/container-derivation.ts`; use the exact diagnostic-marker format from `tests/types/negative/scopes.ts`:

```ts
import { DiBag } from '../../../src';

const key = Symbol('clock');
const clock = DiBag.token(key).of<{ now(): number }>();
const root = DiBag.createBuilder().withServices({ a: () => 1, b: () => 'b' })
  .withTokenService({ token: clock, provider: () => ({ now: () => 1 }) }).buildContainer();

// diagnostic: replacementProviders are required when replacedServiceKeys are present
root.createIndependentContainer({ replacedServiceKeys: ['a'] });
// diagnostic: replacedServiceKeys are required when replacementProviders are present
root.createIndependentContainer({ replacementProviders: { a: () => 2 } });
// diagnostic: createIndependentContainer accepts existing names or typed tokens only
root.createIndependentContainer({ replacedServiceKeys: ['missing'], replacementProviders: { missing: () => 1 } });
// diagnostic: provided service does not satisfy its consumer dependency
root.createIndependentContainer({ replacedServiceKeys: ['a'], replacementProviders: { a: () => 'wrong' } });
// diagnostic: missing createIndependentContainer replacement provider
root.createIndependentContainer({ replacedServiceKeys: ['a', 'b'], replacementProviders: { a: () => 2 } });
// diagnostic: createChildContainer cannot share and replace the same service
root.createChildContainer({ replacedServiceKeys: ['a'], replacementProviders: { a: () => 2 }, sharedParentServiceKeys: ['a'] });
// diagnostic: createChildContainer sharedParentServiceKeys accepts existing names or typed tokens only
root.createChildContainer({ sharedParentServiceKeys: ['missing'] });
// diagnostic: provided service does not satisfy its consumer dependency
root.createIndependentContainer({ replacedServiceKeys: [clock], replacementProviders: { [key]: () => ({ now: 'wrong' }) } });

const incomplete = DiBag.createBuilder().withServices({
  selected: () => 1,
  consumer: ({ selected }: { selected: number }) => selected,
}).buildContainer();
// diagnostic: required service registrations are missing
incomplete.createIndependentContainer({ replacedServiceKeys: ['selected'], replacementProviders: { selected: ({ missing }) => missing } });

const lifetime = DiBag.createBuilder().withServices({
  db: DiBag.withLifetime(() => 1, 'root'),
  rootService: DiBag.withLifetime(({ db }: { db: number }) => db, 'root'),
}).buildContainer();
// diagnostic: root lifetime cannot capture scoped dependency
lifetime.createIndependentContainer({ replacedServiceKeys: ['db'], replacementProviders: { db: () => 2 } });
```

Compiler text comes from existing helper aliases. If it differs, update the operation-string type parameters in `src/types.ts` and `src/scope-types.ts` to the quoted 0.5.0 names, rerun, and put the exact emitted text in the markers. Never weaken the rejected expression.

- [ ] **Step 3: Add the renamed types and option bags**

Add `CheckedChildContainerLifetimes` beside the old lifetime name in `src/lifetime-types.ts` with the complete existing body and compatibility alias:

```ts
export type CheckedChildContainerLifetimes<
  R extends Registrations,
  O extends Registrations,
  C = never,
> = [NeedsLifetimeWalk<R, C>] extends [never] ? unknown
  : [OverrideCaptives<R, O, C>] extends [never] ? unknown
    : Unsatisfied<`root lifetime cannot capture scoped dependency: ${CaptiveText<OverrideCaptives<R, O, C>>}${SeeErrors<'root-capture'>}`, {
        readonly captives: OverrideCaptives<R, O, C>;
      }>;

/** @deprecated Use CheckedChildContainerLifetimes. Removed after the codemod migration. */
export type CheckedScopeLifetimes<
  R extends Registrations,
  O extends Registrations,
  C = never,
> = CheckedChildContainerLifetimes<R, O, C>;
```

In `src/scope-types.ts`, keep `ScopeOptions` and `DisjointScopeSelection` unchanged and add these exported shapes beside them; keep property order exactly as shown:

```ts
export type CreateIndependentContainerOptions<
  ServiceRegistrations extends Registrations,
  Constraints extends NeedConstraint = never,
  ReplacedServiceKeys extends readonly unknown[] = readonly [],
  ReplacementProviders = never,
> = ReplacementOptions<ServiceRegistrations, Constraints, ReplacedServiceKeys, ReplacementProviders, 'createIndependentContainer'>;

type ReplacementOptions<
  ServiceRegistrations extends Registrations,
  Constraints extends NeedConstraint,
  ReplacedServiceKeys extends readonly unknown[],
  ReplacementProviders,
  Operation extends string,
> =
  [ReplacedServiceKeys[number]] extends [never]
    ? { readonly replacedServiceKeys?: undefined; readonly replacementProviders?: undefined }
    : {
        readonly replacedServiceKeys: ReplacedServiceKeys
          & Selection<ServiceRegistrations, Constraints, ReplacedServiceKeys, Operation>;
        readonly replacementProviders: ReplacementProviders;
      };

export type CreateChildContainerOptions<
  ServiceRegistrations extends Registrations,
  SharedParentServiceKeys extends readonly unknown[],
  Constraints extends NeedConstraint = never,
  ReplacedServiceKeys extends readonly unknown[] = readonly [],
  ReplacementProviders = never,
> = ReplacementOptions<ServiceRegistrations, Constraints, ReplacedServiceKeys, ReplacementProviders, 'createChildContainer'> & {
  readonly sharedParentServiceKeys?: SharedParentServiceKeys
    & Selection<ServiceRegistrations, Constraints, SharedParentServiceKeys, 'createChildContainer sharedParentServiceKeys'>
    & ScopeShareAdmission<SharedParentServiceKeys> & (
    [Transients<ServiceRegistrations, SharedParentServiceKeys>] extends [never] ? unknown
      : Unsatisfied<'createChildContainer cannot share transient providers', { tokens: Transients<ServiceRegistrations, SharedParentServiceKeys> }>
  );
} & DisjointChildContainerSelection<ReplacedServiceKeys, SharedParentServiceKeys>;

export type DisjointChildContainerSelection<ReplacedServiceKeys extends readonly unknown[], SharedParentServiceKeys extends readonly unknown[]> =
  [SelectionKey<ReplacedServiceKeys[number]> & SelectionKey<SharedParentServiceKeys[number]>] extends [never] ? unknown
    : Unsatisfied<'createChildContainer cannot share and replace the same service', {
        tokens: SelectionKey<ReplacedServiceKeys[number]> & SelectionKey<SharedParentServiceKeys[number]>;
      }>;
```

The first two generic positions of `CreateChildContainerOptions` deliberately match phase 4's corrected `ScopeOptions<ServiceRegistrations, SharedKeys, Constraints = never>` contract. `Constraints` stays third and defaulted, and replacement generics are appended fourth and fifth. This is what makes the phase-1 schema-supported `{ "from": "ScopeOptions", "to": "CreateChildContainerOptions" }` entry safe for existing two-argument annotations. `CreateIndependentContainerOptions` is new, so its defaults only serve the empty-bag overload.

- [ ] **Step 4: Add the one-bag overloads beside the old methods**

Add the following overload heads inside `class Bag<ServiceRegistrations, Constraints>`. For both replacement overloads, paste the complete existing `fork` / selected `createScope` intersection after `ReplacementProviders & object`: `Record`, `Overrides`, dependency compatibility/completeness, checked/complete constraints, and the corresponding checked lifetime expression. Merely saying “same checks” in source is forbidden; the resulting declaration must contain every named type below.

```ts
createChildContainer(
  options?: CreateChildContainerOptions<ServiceRegistrations, readonly [], Constraints>,
): Bag<UnsharedAliases<ServiceRegistrations>, Constraints>;
createChildContainer<const SharedParentServiceKeys extends readonly unknown[]>(
  options: CreateChildContainerOptions<ServiceRegistrations, SharedParentServiceKeys, Constraints>,
): Bag<ScopedAliases<ServiceRegistrations, ServiceRegistrations, SharedParentServiceKeys>, Constraints>;
createChildContainer<const ReplacedServiceKeys extends readonly unknown[], ReplacementProviders extends OverrideFactoryContext<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>, const SharedParentServiceKeys extends readonly unknown[] = readonly []>(
  options: CreateChildContainerOptions<ServiceRegistrations, SharedParentServiceKeys, Constraints, ReplacedServiceKeys,
    ReplacementProviders & object & Record<SelectionKey<ReplacedServiceKeys[number]>, Registration> &
    Overrides<SelectionRegistrations<ServiceRegistrations, ReplacedServiceKeys>, ReboundSelected<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>> &
    CheckDependencyCompatibility<AppliedSelection<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>> &
    CheckDependencyCompleteness<AppliedSelection<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>> &
    CheckedConstraints<Constraints, AppliedSelection<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>> &
    CompleteConstraints<Constraints, AppliedSelection<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>> &
    CheckedChildContainerLifetimes<NoInfer<ScopedAliases<AppliedSelection<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>, ServiceRegistrations, SharedParentServiceKeys>>, NoInfer<ReboundSelected<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>>, WithoutExportObligations<Constraints, SelectionKey<ReplacedServiceKeys[number]>>>,
    >,
): Bag<ScopedAliases<AppliedSelection<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>, ServiceRegistrations, SharedParentServiceKeys>, WithoutExportObligations<Constraints, SelectionKey<ReplacedServiceKeys[number]>>>;

createIndependentContainer(
  this: Bag<ServiceRegistrations, Constraints> & CheckedLifetimes<UnsharedAliases<ServiceRegistrations>, Constraints>,
  options?: CreateIndependentContainerOptions<ServiceRegistrations, Constraints>,
): Bag<UnsharedAliases<ServiceRegistrations>, Constraints>;
createIndependentContainer<const ReplacedServiceKeys extends readonly unknown[], ReplacementProviders extends OverrideFactoryContext<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>>(
  options: CreateIndependentContainerOptions<ServiceRegistrations, Constraints, ReplacedServiceKeys,
    ReplacementProviders & object & Record<SelectionKey<ReplacedServiceKeys[number]>, Registration> &
    Overrides<SelectionRegistrations<ServiceRegistrations, ReplacedServiceKeys>, ReboundSelected<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>> &
    CheckDependencyCompatibility<AppliedSelection<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>> &
    CheckDependencyCompleteness<AppliedSelection<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>> &
    CheckedConstraints<Constraints, AppliedSelection<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>> &
    CompleteConstraints<Constraints, AppliedSelection<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>> &
    CheckedLifetimes<UnsharedAliases<AppliedSelection<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>>, WithoutExportObligations<Constraints, SelectionKey<ReplacedServiceKeys[number]>>>>,
): Bag<UnsharedAliases<AppliedSelection<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>>, WithoutExportObligations<Constraints, SelectionKey<ReplacedServiceKeys[number]>>>;
```

Add overload declarations here, but do not add a temporary implementation and do not type-check or commit this task in isolation. Task 2 Steps 3 and 4 immediately add the exact selectors and public bodies before any compiler command. This avoids a transient implementation whose validation or collection routing differs from the final expand API.

- [ ] **Step 5: Create and register the declaration consumer before any check**

Create `tests/types/container-derivation-consumer.ts`:

```ts
import { child, emptyChild, emptyIndependent, external, inline } from './container-derivation';
const a: number = emptyChild.resolve('value');
const b: number = emptyIndependent.resolve('value');
const c: number = external.resolve('value');
const d: 7 | number = inline.resolve('clock').now();
const e = child.resolve('value');
void a; void b; void c; void d; void e;
```

In `tests/types.test.ts`, add the direct consumer test beside `selected scopes retain exact inferred cross-file contracts`:

```ts
test('container derivation retains exact inferred cross-file contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/container-derivation-consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});
```

Append `'container-derivation'` to the existing declaration-consumption fixture array that begins with `'lifetimes'`; do not create a second emitter. Register `tests/types/negative/container-derivation.ts` in the existing negative-marker discovery only if that discovery is not already glob-based. The consumer therefore exists and both direct/declaration tests are registered before Task 2 runs either compiler route.

- [ ] **Step 6: Preserve expand compatibility and continue directly into Task 2**

Keep `ScopeOptions`, `CheckedScopeLifetimes`, and `DisjointScopeSelection` exported with those exact phase-4 definitions throughout expand. Task 8 removes them only after every import and declaration has migrated.

Do not run a compiler, evidence command, declaration-consumer command, or commit yet. Continue immediately with Task 2 Steps 1 through 4, then use Task 2 Step 5 for the first check of this combined implementation.

- [ ] **Step 8: Record the complete fallback that Task 2 Step 6 applies if S3 fails**

Do not apply this step yet. Task 2 first installs the adopted direct parser, then its Step 5 runs the first compiler check. If that check rejects S3, Task 2 Step 6 applies everything below as one bounded substitution.

Keep no-argument and share-only overloads. Change replacement forms to:

```ts
createChildContainer<const ReplacedServiceKeys extends readonly unknown[], ReplacementProviders extends OverrideFactoryContext<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>, const SharedParentServiceKeys extends readonly unknown[] = readonly []>(
  replacedServiceKeys: ReplacedServiceKeys & Selection<ServiceRegistrations, Constraints, ReplacedServiceKeys, 'createChildContainer'>,
  replacementProviders: ReplacementProviders & object & Record<SelectionKey<ReplacedServiceKeys[number]>, Registration> & Overrides<SelectionRegistrations<ServiceRegistrations, ReplacedServiceKeys>, ReboundSelected<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>> & CheckDependencyCompatibility<AppliedSelection<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>> & CheckDependencyCompleteness<AppliedSelection<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>> & CheckedConstraints<Constraints, AppliedSelection<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>> & CompleteConstraints<Constraints, AppliedSelection<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>> & CheckedChildContainerLifetimes<NoInfer<ScopedAliases<AppliedSelection<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>, ServiceRegistrations, SharedParentServiceKeys>>, NoInfer<ReboundSelected<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>>, WithoutExportObligations<Constraints, SelectionKey<ReplacedServiceKeys[number]>>>,
  options?: { readonly sharedParentServiceKeys?: SharedParentServiceKeys & Selection<ServiceRegistrations, Constraints, SharedParentServiceKeys, 'createChildContainer sharedParentServiceKeys'> & ScopeShareAdmission<SharedParentServiceKeys> } & DisjointChildContainerSelection<ReplacedServiceKeys, SharedParentServiceKeys>,
): Bag<ScopedAliases<AppliedSelection<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>, ServiceRegistrations, SharedParentServiceKeys>, WithoutExportObligations<Constraints, SelectionKey<ReplacedServiceKeys[number]>>>;

createIndependentContainer<const ReplacedServiceKeys extends readonly unknown[], ReplacementProviders extends OverrideFactoryContext<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>>(
  replacedServiceKeys: ReplacedServiceKeys & Selection<ServiceRegistrations, Constraints, ReplacedServiceKeys, 'createIndependentContainer'>,
  replacementProviders: ReplacementProviders & object & Record<SelectionKey<ReplacedServiceKeys[number]>, Registration> & Overrides<SelectionRegistrations<ServiceRegistrations, ReplacedServiceKeys>, ReboundSelected<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>> & CheckDependencyCompatibility<AppliedSelection<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>> & CheckDependencyCompleteness<AppliedSelection<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>> & CheckedConstraints<Constraints, AppliedSelection<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>> & CompleteConstraints<Constraints, AppliedSelection<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>> & CheckedLifetimes<UnsharedAliases<AppliedSelection<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>>, WithoutExportObligations<Constraints, SelectionKey<ReplacedServiceKeys[number]>>>,
): Bag<UnsharedAliases<AppliedSelection<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>>, WithoutExportObligations<Constraints, SelectionKey<ReplacedServiceKeys[number]>>>;
```

Under this fallback only, replace the public implementations from Task 2 Step 4 with these complete bodies. The helper snapshots the optional third bag before constructing the adopted internal bag; the selectors retain tuple-index-before-provider-getter ordering and all operation details:

```ts
function positionalChildOptions(args: readonly unknown[]): unknown {
  if (args.length === 0) return undefined;
  if (args.length === 1) return args[0];
  if (args.length !== 2 && args.length !== 3) {
    throw libraryError('DI_BAG_INVALID_ARGUMENT', 'createChildContainer accepts zero, one, two, or three arguments in the measured fallback', {
      operation: 'createChildContainer', argument: 'arguments.length', expected: "one of: '0', '1', '2', '3'",
    });
  }
  const sharing = args.length === 3 && args[2] !== undefined
    ? snapshotOptionsBag(args[2], 'createChildContainer', [], ['sharedParentServiceKeys'])
    : Object.create(null) as Record<string, unknown>;
  const options: Record<string, unknown> = {
    replacedServiceKeys: args[0],
    replacementProviders: args[1],
  };
  if (Object.hasOwn(sharing, 'sharedParentServiceKeys')) {
    options.sharedParentServiceKeys = sharing.sharedParentServiceKeys;
  }
  return options;
}

function positionalIndependentOptions(args: readonly unknown[]): unknown {
  if (args.length === 0) return undefined;
  if (args.length !== 2) {
    throw libraryError('DI_BAG_INVALID_ARGUMENT', 'createIndependentContainer accepts zero or two arguments in the measured fallback', {
      operation: 'createIndependentContainer', argument: 'arguments.length', expected: "one of: '0', '2'",
    });
  }
  return { replacedServiceKeys: args[0], replacementProviders: args[1] };
}

createChildContainer(...args: unknown[]): unknown {
  this.#runtime.assertOpen();
  const { graph, shared } = selectChildContainer(
    this.#graph,
    positionalChildOptions(args),
    serviceKey => this.#runtime.isTransient(serviceKey),
  );
  return new Bag(graph, this.context, this.#runtime.scope(graph, shared));
}

createIndependentContainer(...args: unknown[]): unknown {
  this.#runtime.assertOpen();
  const graph = selectIndependentContainer(this.#graph, positionalIndependentOptions(args));
  return new Bag(graph, this.context);
}
```

Append these complete tests only when S3 records the positional fallback; do not retain the adopted-bag variants of the same calls:

```ts
test('positional fallback normalizes every supported child and independent form', async () => {
  const root = DiBag.createBuilder().withServices({ value: () => 1, shared: () => ({ id: 1 }) }).buildContainer();
  const parentShared = root.resolve('shared');
  const emptyChild = root.createChildContainer();
  const shareOnly = root.createChildContainer({ sharedParentServiceKeys: ['shared'] });
  const replaced = root.createChildContainer(['value'], { value: () => 2 });
  const explicitUndefined = root.createChildContainer(['value'], { value: () => 3 }, undefined);
  const replacedAndShared = root.createChildContainer(
    ['value'],
    { value: () => 4 },
    { sharedParentServiceKeys: ['shared'] },
  );
  const emptyIndependent = root.createIndependentContainer();
  const independent = root.createIndependentContainer(['value'], { value: () => 5 });
  expect(emptyChild.resolve('value')).toBe(1);
  expect(shareOnly.resolve('shared')).toBe(parentShared);
  expect(replaced.resolve('value')).toBe(2);
  expect(explicitUndefined.resolve('value')).toBe(3);
  expect(replacedAndShared.resolve('value')).toBe(4);
  expect(replacedAndShared.resolve('shared')).toBe(parentShared);
  expect(emptyIndependent.resolve('value')).toBe(1);
  expect(independent.resolve('value')).toBe(5);
  await Promise.all([
    emptyChild.close(), shareOnly.close(), replaced.close(), explicitUndefined.close(),
    replacedAndShared.close(), emptyIndependent.close(), independent.close(), root.close(),
  ]);
});

test.each([
  ['createChildContainer', [[], {}, {}, {}], "one of: '0', '1', '2', '3'"],
  ['createIndependentContainer', [[]], "one of: '0', '2'"],
] as const)('positional fallback rejects malformed arity for %s', (operation, args, expected) => {
  const root = DiBag.createBuilder().withServices({ value: () => 1 }).buildContainer();
  try {
    (root[operation] as (...values: unknown[]) => unknown)(...args);
    throw new Error('expected arity rejection');
  } catch (error) {
    expect(error).toMatchObject({
      code: 'DI_BAG_INVALID_ARGUMENT',
      details: { operation, argument: 'arguments.length', expected },
    });
  }
});

test('positional fallback snapshots selected indices before a provider getter runs', async () => {
  const selected = ['value'] as const;
  const root = DiBag.createBuilder().withServices({ value: () => 1 }).buildContainer();
  const independent = root.createIndependentContainer(selected, {
    get value() { (selected as unknown as string[])[0] = 'missing'; return () => 2; },
  });
  expect(independent.resolve('value')).toBe(2);
  await independent.close(); await root.close();
});
```

These cases cover argument-count handling, explicit `undefined`, third-bag validation through `snapshotOptionsBag`, selection snapshot order, operation details, sharing, and both ownership forms. They are skipped entirely when S3 adopts the bag.

Rewrite all fixture calls to the positional pair followed by `{ sharedParentServiceKeys }`, change the codemod expected output and transform in Task 5 accordingly, rerun Task 2 Steps 5–7, record `Decision: positional fallback` and all failed attempts in phase evidence, and append the exception to `docs/guides/api-naming.md`.

- [ ] **Step 9: Hand the complete uncommitted expand set to Task 2**

Confirm `git diff --name-only` contains only the Task 1 files listed above, then continue directly into Task 2. Do not stage or commit. Task 2 Step 8 makes the single checked derivation commit after types, runtime selectors, declaration consumption, and S3 evidence all pass together.

---
### Task 2: Implement the derivation option-bag parsers and runtime behavior

**Files:**
- Modify: `src/scope-selection.ts`
- Modify: `src/di-bag.ts`
- Create: `tests/container-derivation.test.ts`
- Modify: `docs/agent/errors.md` only if `DI_BAG_INVALID_ARGUMENT` has no section on entry

**Interfaces:**
- Consumes: `snapshotOptionsBag` from phase 5 and Task 1's overloads.
- Produces: `selectChildContainer(graph, options, isTransient)` returning `{ graph, shared }`; `selectIndependentContainer(graph, options)` returning a `BindingGraph`; direct runtime implementations of both public calls.

- [ ] **Step 1: Write the runtime tests**

Create `tests/container-derivation.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { DiBag } from '../src';

describe('container derivation option bags', () => {
  test('creates empty child and independent containers with distinct ownership', async () => {
    let disposed = 0;
    const root = DiBag.createBuilder().withServices({
      value: DiBag.withDisposal(() => ({}), () => { disposed++; }),
    }).buildContainer();
    const child = root.createChildContainer();
    const independent = root.createIndependentContainer();
    const emptyChild = root.createChildContainer({});
    const emptyIndependent = root.createIndependentContainer({});
    child.resolve('value'); independent.resolve('value');
    emptyChild.resolve('value'); emptyIndependent.resolve('value');
    await root.close();
    expect(disposed).toBe(2);
    await Promise.all([independent.close(), emptyIndependent.close()]);
    expect(disposed).toBe(4);
  });

  test('replaces selected services and shares selected parent acquisitions', async () => {
    let acquired = 0;
    const root = DiBag.createBuilder().withServices({
      shared: () => ({ id: ++acquired }),
      value: () => 1,
    }).buildContainer();
    const parentShared = root.resolve('shared');
    const child = root.createChildContainer({
      replacedServiceKeys: ['value'],
      replacementProviders: { value: () => 2 },
      sharedParentServiceKeys: ['shared'],
    });
    expect(child.resolve('value')).toBe(2);
    expect(child.resolve('shared')).toBe(parentShared);
    await child.close(); await root.close();
  });

  test('supports token and collection-token computed provider keys', async () => {
    const key = Symbol('clock');
    const listKey = Symbol('clocks');
    const clock = DiBag.token(key).of<{ now(): number }>();
    const clocks = DiBag.token(listKey).forCollectionOf<{ now(): number }>();
    const root = DiBag.createBuilder()
      .withTokenService({ token: clock, provider: () => ({ now: () => 1 }) })
      .withCollectionContribution({ collectionToken: clocks, provider: () => ({ now: () => 2 }) })
      .buildContainer();
    const replacement = [{ now: () => 4 }];
    let disposed: unknown;
    const independent = root.createIndependentContainer({
      replacedServiceKeys: [clock, clocks],
      replacementProviders: {
        [key]: () => ({ now: () => 3 }),
        [listKey]: DiBag.withDisposal(
          (): readonly { now(): number }[] => replacement,
          value => { disposed = value; },
        ),
      },
    });
    expect(independent.resolve(clock).now()).toBe(3);
    const first = independent.resolve(clocks);
    const second = independent.resolve(clocks);
    expect(first.map(value => value.now())).toEqual([4]);
    expect(first).not.toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(replacement).not.toBe(first);
    await independent.close();
    expect(disposed).toBe(replacement);
    await root.close();
  });

  test.each([
    ['single-service', 'collection'],
    ['collection', 'single-service'],
  ] as const)('rejects a %s selection when the graph already owns the symbol as %s before reading its provider', (selectedKind, graphKind) => {
    const key = Symbol('same-key');
    const tokenFactory = DiBag.token(key);
    const single = tokenFactory.of<number>();
    const collection = tokenFactory.forCollectionOf<number>();
    const root = graphKind === 'single-service'
      ? DiBag.createBuilder().withTokenService({ token: single, provider: () => 1 }).buildContainer()
      : DiBag.createBuilder().withCollectionContribution({ collectionToken: collection, provider: () => 1 }).buildContainer();
    const selected = selectedKind === 'single-service' ? single : collection;
    let providerReads = 0;
    const providers = { get [key]() { providerReads++; return () => selectedKind === 'collection' ? [2] : 2; } };
    try {
      (root.createIndependentContainer as (...args: unknown[]) => unknown)({
        replacedServiceKeys: [selected], replacementProviders: providers,
      });
      throw new Error('expected token-kind rejection');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'DI_BAG_WRONG_TOKEN_KIND',
        details: { operation: 'createIndependentContainer', expectedKind: graphKind, receivedKind: selectedKind },
      });
    }
    expect(providerReads).toBe(0);
  });

  test('snapshots tuple indices before provider getters can mutate them', async () => {
    const selected = ['value'] as const;
    const root = DiBag.createBuilder().withServices({ value: () => 1 }).buildContainer();
    const independent = root.createIndependentContainer({
      replacedServiceKeys: selected,
      replacementProviders: { get value() { (selected as unknown as string[])[0] = 'missing'; return () => 2; } },
    });
    expect(independent.resolve('value')).toBe(2);
    await independent.close(); await root.close();
  });

  test('reads every allowed option and provider property exactly once', async () => {
    const reads = { replacedServiceKeys: 0, replacementProviders: 0, sharedParentServiceKeys: 0, value: 0 };
    const providers = { get value() { reads.value++; return () => 2; } };
    const options = {
      get replacedServiceKeys() { reads.replacedServiceKeys++; return ['value'] as const; },
      get replacementProviders() { reads.replacementProviders++; return providers; },
      get sharedParentServiceKeys() { reads.sharedParentServiceKeys++; return ['shared'] as const; },
    };
    const root = DiBag.createBuilder().withServices({ value: () => 1, shared: () => 3 }).buildContainer();
    const child = root.createChildContainer(options);
    expect(child.resolve('value')).toBe(2);
    expect(reads).toEqual({ replacedServiceKeys: 1, replacementProviders: 1, sharedParentServiceKeys: 1, value: 1 });
    await child.close(); await root.close();
  });

  test.each(['createChildContainer', 'createIndependentContainer'] as const)('reports malformed replacement providers for %s', operation => {
    const root = DiBag.createBuilder().withServices({ value: () => 1 }).buildContainer();
    try {
      root[operation]({ replacedServiceKeys: ['value'], replacementProviders: { value: 1 } } as never);
      throw new Error('expected malformed provider rejection');
    } catch (error) {
      expect(error).toMatchObject({ code: 'DI_BAG_INVALID_REGISTRATION', details: { operation } });
    }
  });

  test.each([
    [null, 'createIndependentContainer requires one options object'],
    [{ extra: true }, 'createIndependentContainer does not accept the option extra'],
    [{ replacedServiceKeys: ['value'] }, 'replacementProviders'],
    [{ replacementProviders: { value: () => 2 } }, 'replacedServiceKeys'],
  ] as const)('rejects malformed independent options %#', (options, message) => {
    const root = DiBag.createBuilder().withServices({ value: () => 1 }).buildContainer();
    expect(() => root.createIndependentContainer(options as never)).toThrow(message);
  });

  test('rejects inherited and overlapping child options before provider getters', () => {
    const root = DiBag.createBuilder().withServices({ value: () => 1 }).buildContainer();
    const inherited = Object.create({ sharedParentServiceKeys: ['value'] });
    expect(() => root.createChildContainer(inherited)).toThrow('createChildContainer reads own properties only');
    let read = false;
    expect(() => root.createChildContainer({
      replacedServiceKeys: ['value'],
      replacementProviders: { get value() { read = true; return () => 2; } },
      sharedParentServiceKeys: ['value'],
    })).toThrow('createChildContainer cannot share and replace the same service');
    expect(read).toBe(false);
  });
});
```

Use the phase-5 positional builder syntax if S1 fell back.

- [ ] **Step 2: Run the new file and confirm red**

Run: `bun test tests/container-derivation.test.ts`

Expected: failure because the new implementations still delegate incompletely or do not exist.

- [ ] **Step 3: Add explicit selectors beside expand-compatible `selectScope`**

Implement these exact exported signatures in `src/scope-selection.ts`:

```ts
export function selectChildContainer(
  graph: BindingGraph,
  options: unknown,
  isTransient: (serviceKey: BindingKey) => boolean,
): { readonly graph: BindingGraph; readonly shared: readonly BindingId[] };

export function selectIndependentContainer(
  graph: BindingGraph,
  options: unknown,
): BindingGraph;
```

Use the following complete normalization flow in both selectors:

```ts
type SelectedKey = {
  readonly key: BindingKey;
  readonly tokenKind: TokenKind | undefined;
  readonly isCollection: boolean;
};

function snapshotSelection(selection: unknown, operation: string, argument: string): SelectedKey[] {
  if (!Array.isArray(selection)) throw libraryError('DI_BAG_INVALID_ARGUMENT', `${operation} requires ${argument} to be an array`, {
    operation, argument, expected: 'an array',
  });
  const values: unknown[] = [];
  const length = selection.length;
  for (let index = 0; index < length; index++) values[index] = selection[index];
  return values.map(value => {
    if (typeof value === 'string') return { key: value, tokenKind: undefined, isCollection: false };
    const { key, kind } = readToken(value);
    return { key, tokenKind: kind, isCollection: kind === 'collection' };
  });
}

function claimContainerSelectionTokenKinds(
  graph: BindingGraph,
  selected: readonly SelectedKey[],
  operation: string,
): BindingGraph {
  let claimed = graph;
  for (const { key, tokenKind } of selected) {
    if (tokenKind !== undefined) claimed = claimed.withTokenKind(key as symbol, tokenKind, operation);
  }
  return claimed;
}

function selectedBindings(graph: BindingGraph, operation: string, selected: readonly SelectedKey[], providers: unknown): Array<readonly [BindingKey, Registration]> {
  if (typeof providers !== 'object' || providers === null || Array.isArray(providers)) {
    throw libraryError('DI_BAG_INVALID_ARGUMENT', `${operation} requires replacementProviders to be an object`, {
      operation, argument: 'replacementProviders', expected: 'an object',
    });
  }
  for (const { key, isCollection } of selected) {
    if (!isCollection && !graph.hasPublic(key)) throw libraryError('DI_BAG_INVALID_OVERRIDE', `${operation} accepts existing names or typed tokens only: ${String(key)}`, { operation });
    if (!Object.hasOwn(providers, key)) throw libraryError('DI_BAG_INVALID_OVERRIDE', `missing ${operation} replacement provider: ${String(key)}`, { operation });
  }
  const bindings: Array<readonly [BindingKey, Registration]> = [];
  const seen = new Set<BindingKey>();
  for (const { key } of selected) {
    if (seen.has(key)) continue;
    seen.add(key);
    const registration: unknown = Reflect.get(providers, key);
    normalize(registration, operation);
    bindings.push([key, registration as Registration]);
  }
  return bindings;
}
```

For `selectIndependentContainer`, return `graph` when `options === undefined`; otherwise call `snapshotOptionsBag(options, 'createIndependentContainer', [], ['replacedServiceKeys', 'replacementProviders'])`, require both replacement properties together, snapshot keys before reading any provider getter, and return `graph.withPublicBindings(...)`.

For `selectChildContainer`, call `snapshotOptionsBag(options, 'createChildContainer', [], ['replacedServiceKeys', 'replacementProviders', 'sharedParentServiceKeys'])`; require replacement properties together; snapshot both selections; validate every key and the overlap before calling `selectedBindings`; reject transient shared services; deduplicate shared binding ids; return the replaced graph and shared ids. `snapshotOptionsBag` owns non-null/non-array object validation, supported inherited-property rejection, unknown-own-key rejection, and getter snapshot behavior; do not reproduce it.

Use these complete bodies:

```ts
function replacementPair(options: Record<string, unknown>, operation: string): {
  readonly selected: readonly SelectedKey[];
  readonly providers: unknown;
} {
  const hasKeys = Object.hasOwn(options, 'replacedServiceKeys');
  const hasProviders = Object.hasOwn(options, 'replacementProviders');
  if (hasKeys !== hasProviders) {
    const argument = hasKeys ? 'replacementProviders' : 'replacedServiceKeys';
    throw libraryError('DI_BAG_INVALID_ARGUMENT', `${operation} requires replacedServiceKeys and replacementProviders together`, {
      operation, argument, expected: 'present',
    });
  }
  return hasKeys
    ? { selected: snapshotSelection(options.replacedServiceKeys, operation, 'replacedServiceKeys'), providers: options.replacementProviders }
    : { selected: [], providers: undefined };
}

export function selectIndependentContainer(graph: BindingGraph, options: unknown): BindingGraph {
  if (options === undefined) return graph;
  const bag = snapshotOptionsBag(options, 'createIndependentContainer', [], ['replacedServiceKeys', 'replacementProviders']);
  const { selected, providers } = replacementPair(bag, 'createIndependentContainer');
  if (selected.length === 0) return graph;
  const selectedGraph = claimContainerSelectionTokenKinds(graph, selected, 'createIndependentContainer');
  return selectedGraph.withPublicBindings(selectedBindings(selectedGraph, 'createIndependentContainer', selected, providers), 'createIndependentContainer');
}

export function selectChildContainer(
  graph: BindingGraph,
  options: unknown,
  isTransient: (serviceKey: BindingKey) => boolean,
): { readonly graph: BindingGraph; readonly shared: readonly BindingId[] } {
  if (options === undefined) return { graph, shared: [] };
  const bag = snapshotOptionsBag(options, 'createChildContainer', [], [
    'replacedServiceKeys', 'replacementProviders', 'sharedParentServiceKeys',
  ]);
  const { selected, providers } = replacementPair(bag, 'createChildContainer');
  const selectedGraph = claimContainerSelectionTokenKinds(graph, selected, 'createChildContainer');
  const sharedKeys = Object.hasOwn(bag, 'sharedParentServiceKeys')
    ? snapshotSelection(bag.sharedParentServiceKeys, 'createChildContainer', 'sharedParentServiceKeys')
    : [];
  for (const { key, isCollection } of sharedKeys) {
    if (isCollection) throw wrongTokenKind('createChildContainer', 'single-service', key as symbol);
  }
  for (const { key, isCollection } of [...selected, ...sharedKeys]) {
    if (!isCollection && !selectedGraph.hasPublic(key)) throw libraryError('DI_BAG_INVALID_SCOPE', `createChildContainer accepts existing names or typed tokens only: ${String(key)}`, { operation: 'createChildContainer' });
  }
  const selectedSet = new Set(selected.map(entry => entry.key));
  const shared = [...new Set(sharedKeys.map(entry => entry.key))].map(key => {
    if (selectedSet.has(key)) throw libraryError('DI_BAG_INVALID_SCOPE', `createChildContainer cannot share and replace the same service: ${String(key)}`, { operation: 'createChildContainer' });
    if (isTransient(key)) throw libraryError('DI_BAG_INVALID_SCOPE', `createChildContainer cannot share transient providers: ${String(key)}`, { operation: 'createChildContainer' });
    return selectedGraph.publicBinding(key);
  });
  const bindings = selected.length === 0 ? [] : selectedBindings(selectedGraph, 'createChildContainer', selected, providers);
  return { graph: bindings.length === 0 ? selectedGraph : selectedGraph.withPublicBindings(bindings, 'createChildContainer'), shared };
}
```

The existing `DI_BAG_INVALID_SCOPE` / `DI_BAG_INVALID_OVERRIDE` validation sites keep their codes when reworded. The two genuinely new pair-presence and non-array validation sites use `DI_BAG_INVALID_ARGUMENT` and literal `{ operation, argument, expected }`. If Task 0 found no section, copy the `DI_BAG_INVALID_ARGUMENT` section verbatim from plan 12 Task 9 into `docs/agent/errors.md` in this commit.

`withTokenKind` plus `withPublicBindings` is the only collection replacement installation path. Do not add a container-level cache or direct collection return. The existing phase-4 `resolve`/lazy/alias routing must still call `freshCollectionView` for a replacement public binding, while disposal receives the provider's original array; the runtime test above pins identity, freezing, freshness, and disposal identity.

- [ ] **Step 4: Connect the public implementations**

Add these exact implementation bodies beneath Task 1's overloads; there are no temporary bodies to replace:

```ts
createChildContainer(options?: unknown): unknown {
  this.#runtime.assertOpen();
  const { graph, shared } = selectChildContainer(this.#graph, options, serviceKey => this.#runtime.isTransient(serviceKey));
  return new Bag(graph, this.context, this.#runtime.scope(graph, shared));
}

createIndependentContainer(options?: unknown): unknown {
  this.#runtime.assertOpen();
  const graph = selectIndependentContainer(this.#graph, options);
  return new Bag(graph, this.context);
}
```

Under the S3 fallback, use the exact `positionalChildOptions`, `positionalIndependentOptions`, and `(...args: unknown[])` bodies in Task 1 Step 8. They feed these same selectors and are the only positional validation path.

- [ ] **Step 5: Run the runtime and compiler tests**

```bash
bun test tests/container-derivation.test.ts
bun test tests/scopes.test.ts tests/selected-scopes.test.ts tests/runtime-diagnostics.test.ts
bun test tests/types.test.ts --test-name-pattern 'container derivation'
npm run typecheck
npm run typecheck:native
```

Expected: all pass; the registered positive/negative/consumer fixtures have zero unexpected diagnostics under both compilers, and no old scope/fork behavior regresses during expand. This is the first compiler command after adding the overloads and exact implementation.

- [ ] **Step 6: Decide S3 and measure all twelve cases**

If Step 5 rejects contextual inference, make at most three serious signature repairs while retaining every inference/negative case. After three failed repairs, apply Task 1 Step 8 completely, rerun Task 2 Steps 1–5, and record `Decision: positional fallback`. If the preferred form passes, record `Decision: adopted one options bag`. The cumulative evidence budget below can also require the fallback.

```bash
node scripts/evidence-cases.mjs --compare docs/superpowers/plans/evidence/baseline.md --json /tmp/di-bag-phase-06/s3.json
```

Expected: twelve accepted rows, no token-case diagnostics, and every cumulative instantiation delta at or below +10%. Create `docs/superpowers/plans/evidence/phase-06.md` with the decision, compiler versions, commands, failed attempts if any, and `case | baseline | phase 06 | change` for all twelve rows.

- [ ] **Step 7: Exercise the already-registered declaration consumer**

```bash
bun test tests/types.test.ts --test-name-pattern 'container derivation.*cross-file|container-derivation.*declaration consumption'
npm run typecheck:native
```

Expected: both exit 0 and the emitted declaration preserves the inferred named, token, collection, empty-bag, and child return types. Do not create or register the consumer here; Task 1 Step 5 already did both before the first check.

- [ ] **Step 8: Commit the combined type and runtime derivation API**

```bash
git add src/scope-types.ts src/lifetime-types.ts src/scope-selection.ts src/di-bag.ts src/types.ts tests/container-derivation.test.ts tests/types tests/types.test.ts docs/agent/errors.md docs/superpowers/plans/evidence/phase-06.md docs/guides/api-naming.md
git commit -m "feat!: add container derivation APIs"
```

Omit `docs/guides/api-naming.md` if the preferred bag succeeds. The commit contains the exact implementation that Step 5 checked; it never contains declaration-only overloads or a temporary wrapper.

---

### Task 3: Expand snapshot and module names

**Files:**
- Modify: `src/di-bag.ts`
- Modify: `src/module.ts`
- Modify: `src/module-types.ts`
- Create: `tests/container-names.test.ts`

**Interfaces:**
- Consumes: the existing `inspect` overloads, `inspectGraph`, and `Module.renameExport` implementation.
- Produces: all `serviceSnapshot` overloads that phase 4 left after collection consolidation, `graphSnapshot(): GraphSnapshot`, and `Module.withRenamedExport({ currentExportKey, newExportKey })`.

- [ ] **Step 1: Write the failing runtime tests**

Create `tests/container-names.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { DiBag } from '../src';

describe('0.5 container names', () => {
  test('reads named, token, collection, and graph snapshots without acquisition', async () => {
    const tokenKey = Symbol('token');
    const listKey = Symbol('list');
    const token = DiBag.token(tokenKey).of<number>();
    const list = DiBag.token(listKey).forCollectionOf<number>();
    const container = DiBag.createBuilder().withServices({ named: () => 1 })
      .withTokenService({ token, provider: () => 2 })
      .withCollectionContribution({ collectionToken: list, provider: () => 3 })
      .buildContainer();
    expect(container.serviceSnapshot('named').acquisitions).toEqual([]);
    expect(container.serviceSnapshot(token).acquisitions).toEqual([]);
    expect(container.serviceSnapshot(list)).toHaveLength(1);
    expect(container.graphSnapshot().bindings.length).toBe(3);
    await container.close();
  });

  test('renames a module export through one options bag', async () => {
    const feature = DiBag.createBuilder().withServices({ value: () => 1 })
      .buildModule({ exportedServiceKeys: ['value'], moduleLabel: 'feature' })
      .withRenamedExport({ currentExportKey: 'value', newExportKey: 'answer' });
    const container = DiBag.createBuilder().withInstalledModules([feature]).buildContainer();
    expect(container.resolve('answer')).toBe(1);
    await container.close();
  });

  test('module rename snapshots the option bag and reports the new operation', () => {
    const feature = DiBag.createBuilder().withServices({ value: () => 1 })
      .buildModule({ exportedServiceKeys: ['value'] });
    expect(() => feature.withRenamedExport({ currentExportKey: 'missing', newExportKey: 'answer' })).toThrow('withRenamedExport requires an existing export');
    try { feature.withRenamedExport({ currentExportKey: 'missing', newExportKey: 'answer' }); }
    catch (error: any) { expect(error.details.operation).toBe('withRenamedExport'); }
  });
});
```

Adapt only phase-5 S1/S7 fallback call syntax.

- [ ] **Step 2: Run the test and confirm red**

Run: `bun test tests/container-names.test.ts`

Expected: missing-method failures.

- [ ] **Step 3: Add every snapshot overload with the exact existing return types**

Use the full post-phase-4 primary signature (if phase 4 evidence records its fallback, rename `inspectCollection` to `serviceSnapshot` with that fallback's exact signature instead):

```ts
serviceSnapshot<ServiceKey extends (keyof ServiceRegistrations & string) | TokenBase>(
  serviceKey: ServiceKey & ([ServiceKey] extends [string] ? unknown : ServiceKeyMember<ServiceRegistrations, Constraints, ServiceKey>),
): ServiceKey extends CollectionTokenBase
  ? readonly RegistrationSnapshot[]
  : RegistrationSnapshot<
      ProviderRegistrationMetadata<ServiceRegistrations[SelectionKey<ServiceKey> & keyof ServiceRegistrations]>,
      ProviderAcquisitionMetadata<ServiceRegistrations[SelectionKey<ServiceKey> & keyof ServiceRegistrations]>
    >;
serviceSnapshot(serviceKey: unknown): unknown {
  if (typeof serviceKey === 'string') return this.#runtime.inspect(serviceKey);
  const { key, kind } = readGraphToken(this.#graph, serviceKey, 'serviceSnapshot');
  return kind === 'collection'
    ? this.#runtime.inspectCollection(key)
    : this.#runtime.inspect(key);
}

graphSnapshot(): GraphSnapshot { return this.#runtime.inspectGraph(); }
```

Update the new JSDoc examples and `@param` names, but retain the old methods until Task 8.

- [ ] **Step 4: Add the module options bag and method**

In `src/module-types.ts`, change `InvalidRename` text to `withRenamedExport requires an existing export and a noncolliding singleton string-literal name`. In `src/module.ts`, add:

```ts
withRenamedExport<const CurrentExportKey extends string, const NewExportKey extends string>(
  options: {
    readonly currentExportKey: CurrentExportKey & RenameKeys<ExportedServices, CurrentExportKey, NewExportKey>;
    readonly newExportKey: NewExportKey & RenameKeys<ExportedServices, CurrentExportKey, NewExportKey>;
  },
): Module<Renamed<ExportedServices, CurrentExportKey, NewExportKey>, RequiredServices, RenamedConstraints<Constraints, CurrentExportKey, NewExportKey>, RenamedProviders<PublicProviders, CurrentExportKey, NewExportKey>>;
```

Implement it with `snapshotOptionsBag(options, 'withRenamedExport', ['currentExportKey', 'newExportKey'])`. Validate strings/absence/collision exactly as `renameExport` does, but use the new message, detail keys `currentExportKey` and `newExportKey`, and `details.operation: 'withRenamedExport'`. This is a reshaped existing site, so it retains `DI_BAG_INVALID_EXPORT`.

Use this complete body after the signature:

```ts
{
  const { currentExportKey, newExportKey } = snapshotOptionsBag(
    options, 'withRenamedExport', ['currentExportKey', 'newExportKey'],
  );
  const description = descriptions.get(this)!;
  if (typeof currentExportKey !== 'string' || !description.exports.has(currentExportKey)) {
    throw libraryError('DI_BAG_INVALID_EXPORT', 'withRenamedExport requires an existing export', {
      operation: 'withRenamedExport', currentExportKey, newExportKey,
    });
  }
  if (typeof newExportKey !== 'string') {
    throw libraryError('DI_BAG_INVALID_EXPORT', 'withRenamedExport requires a string new export key', {
      operation: 'withRenamedExport', currentExportKey, newExportKey,
    });
  }
  if (currentExportKey === newExportKey) return this as unknown as Module<Renamed<ExportedServices, CurrentExportKey, NewExportKey>, RequiredServices, RenamedConstraints<Constraints, CurrentExportKey, NewExportKey>, RenamedProviders<PublicProviders, CurrentExportKey, NewExportKey>>;
  if (description.exports.has(newExportKey)) {
    throw libraryError('DI_BAG_INVALID_EXPORT', `duplicate export: ${newExportKey}`, {
      operation: 'withRenamedExport', currentExportKey, newExportKey,
    });
  }
  const exports = new Map(description.exports);
  const localName = exports.get(currentExportKey)!;
  exports.delete(currentExportKey);
  exports.set(newExportKey, localName);
  return new Module({ graph: description.graph, exports, label: description.label });
}
```

- [ ] **Step 5: Run narrow tests**

```bash
bun test tests/container-names.test.ts tests/inspect-graph.test.ts tests/modules.test.ts
npm run typecheck
```

Expected: pass and no diagnostics.

- [ ] **Step 6: Commit**

```bash
git add src/di-bag.ts src/module.ts src/module-types.ts tests/container-names.test.ts
git commit -m "feat!: add container snapshot and module names"
```

---

### Task 4: Expand lifecycle observer configuration names

**Files:**
- Modify: `src/observers.ts`
- Modify: `src/di-bag.ts`
- Modify: `tests/container-names.test.ts`
- Modify: `tests/types/observers.ts`
- Modify: `tests/types/observers-consumer.ts`
- Modify: `tests/types/negative/observers.ts`

**Interfaces:**
- Consumes: `ObserverCallback`, `ObserverErrorCallback`, and `LifecycleObservers` queue semantics.
- Produces: `LifecycleObserver { onLifecycleEvent, onObserverFailure }` and `ConfigurationOptions.lifecycleObservers?: readonly LifecycleObserver[]`.

- [ ] **Step 1: Add runtime coverage**

Append to `tests/container-names.test.ts`:

```ts
test('delivers lifecycle events and failures through the renamed callbacks', async () => {
  const kinds: string[] = [];
  const failures: unknown[] = [];
  const observed = DiBag.withConfiguration({ lifecycleObservers: [{
    onLifecycleEvent(event) { kinds.push(event.kind); if (event.kind === 'scope-opened') throw new Error('observer'); },
    onObserverFailure(failure) { failures.push(failure.error); },
  }] });
  const container = observed.createBuilder().buildContainer();
  await container.close();
  await new Promise<void>(resolve => queueMicrotask(resolve));
  expect(kinds).toEqual(['scope-opened', 'scope-closing', 'scope-closed']);
  expect(failures).toHaveLength(1);
});

test('keeps legacy observers working throughout expand', async () => {
  const kinds: string[] = [];
  const observed = DiBag.withConfiguration({ observers: [{
    onEvent(event) { kinds.push(`old:${event.kind}`); },
    onError() {},
  }] });
  const container = observed.createBuilder().buildContainer();
  await container.close();
  await new Promise<void>(resolve => queueMicrotask(resolve));
  expect(kinds).toEqual(['old:scope-opened', 'old:scope-closing', 'old:scope-closed']);
});

test('composes legacy and renamed observer configurations', async () => {
  const kinds: string[] = [];
  const oldConfigured = DiBag.withConfiguration({ observers: [{
    onEvent(event) { kinds.push(`old:${event.kind}`); }, onError() {},
  }] });
  const mixed = oldConfigured.withConfiguration({ lifecycleObservers: [{
    onLifecycleEvent(event) { kinds.push(`new:${event.kind}`); }, onObserverFailure() {},
  }] });
  const container = mixed.createBuilder().buildContainer();
  await container.close();
  await new Promise<void>(resolve => queueMicrotask(resolve));
  expect(kinds).toContain('old:scope-opened');
  expect(kinds).toContain('new:scope-opened');
});

test('rejects both observer fields in one options bag', () => {
  expect(() => DiBag.withConfiguration({ observers: [], lifecycleObservers: [] } as never)).toThrow('observers or lifecycleObservers, not both');
});
```

Run: `bun test tests/container-names.test.ts`

Expected: type/runtime failure because the names do not exist.

- [ ] **Step 2: Add the renamed observer interface beside the old one**

```ts
export interface LifecycleObserver {
  readonly onLifecycleEvent: ObserverCallback;
  readonly onObserverFailure: ObserverErrorCallback;
}
```

Keep one private callback record so old and new public shapes can coexist during expand:

```ts
type ObserverRecord = {
  readonly onEvent: ObserverCallback;
  readonly onError: ObserverErrorCallback;
};

static appendLegacy(current: LifecycleObservers | undefined, observer: unknown): LifecycleObservers {
  if ((typeof observer !== 'object' && typeof observer !== 'function') || observer === null) {
    throw libraryTypeError('DI_BAG_INVALID_CONFIGURATION', 'withConfiguration observers require onEvent and onError callbacks', { operation: 'withConfiguration' });
  }
  const onEvent = Reflect.get(observer, 'onEvent') as unknown;
  const onError = Reflect.get(observer, 'onError') as unknown;
  if (typeof onEvent !== 'function' || typeof onError !== 'function') {
    throw libraryTypeError('DI_BAG_INVALID_CONFIGURATION', 'withConfiguration observers require onEvent and onError callbacks', { operation: 'withConfiguration' });
  }
  return new LifecycleObservers([...(current?.callbacks ?? []), { onEvent: onEvent as ObserverCallback, onError: onError as ObserverErrorCallback }]);
}

static append(current: LifecycleObservers | undefined, observer: unknown): LifecycleObservers {
  if ((typeof observer !== 'object' && typeof observer !== 'function') || observer === null) {
    throw libraryTypeError('DI_BAG_INVALID_CONFIGURATION', 'withConfiguration lifecycleObservers require onLifecycleEvent and onObserverFailure callbacks', { operation: 'withConfiguration' });
  }
  const onLifecycleEvent = Reflect.get(observer, 'onLifecycleEvent') as unknown;
  const onObserverFailure = Reflect.get(observer, 'onObserverFailure') as unknown;
  if (typeof onLifecycleEvent !== 'function' || typeof onObserverFailure !== 'function') {
    throw libraryTypeError('DI_BAG_INVALID_CONFIGURATION', 'withConfiguration lifecycleObservers require onLifecycleEvent and onObserverFailure callbacks', { operation: 'withConfiguration' });
  }
  return new LifecycleObservers([...(current?.callbacks ?? []), {
    onEvent: onLifecycleEvent as ObserverCallback,
    onError: onObserverFailure as ObserverErrorCallback,
  }]);
}
```

Keep the queue over `ObserverRecord` and its existing `onEvent`/`onError` destructuring. This is private compatibility storage, not a public retired name. Retain event kinds/fields and `ScopeEventFields` until plan 12, phase 11.

- [ ] **Step 3: Add `ConfigurationOptions.lifecycleObservers` beside `observers`**

During expand, let `ConfigurationOptions` accept either property and reject an object that supplies both. Replace the facade body with:

```ts
withConfiguration: (options: ConfigurationOptions): DiBagApi => {
  const bag = snapshotOptionsBag(options, 'withConfiguration', [], ['runtime', 'observers', 'lifecycleObservers']);
  if (Object.hasOwn(bag, 'observers') && Object.hasOwn(bag, 'lifecycleObservers')) {
    throw libraryTypeError('DI_BAG_INVALID_ARGUMENT', 'withConfiguration accepts observers or lifecycleObservers, not both', {
      operation: 'withConfiguration', argument: 'observers', expected: "absent when lifecycleObservers is 'present'",
    });
  }
  const runtime = bag.runtime as RuntimeOptions | undefined;
  const usesLifecycleNames = Object.hasOwn(bag, 'lifecycleObservers');
  const lifecycleObservers = (usesLifecycleNames ? bag.lifecycleObservers : bag.observers) as readonly unknown[] | undefined;
  let configured = runtime === undefined ? context : runtimeContext(runtime, context);
  if (lifecycleObservers !== undefined) {
    if (!Array.isArray(lifecycleObservers)) throw libraryTypeError('DI_BAG_INVALID_CONFIGURATION', 'withConfiguration lifecycleObservers must be an array', { operation: 'withConfiguration' });
    for (const observer of lifecycleObservers) {
      configured = Object.freeze({
        ...configured,
        observers: usesLifecycleNames
          ? LifecycleObservers.append(configured.observers, observer)
          : LifecycleObservers.appendLegacy(configured.observers, observer),
      });
    }
  }
  return facade(configured);
},
```

The new both-fields rejection uses `DI_BAG_INVALID_ARGUMENT` and a literal allowed detail object. The renamed pre-existing array/callback validation keeps `DI_BAG_INVALID_CONFIGURATION`.

The old observer API must continue passing until the codemod migration. In `tests/types/observers.ts`, add `LifecycleObserver` to the type import and append:

```ts
export const onLifecycleEvent = (event: LifecycleEvent) => event.kind;
export const onObserverFailure = (failure: ObserverFailure) => failure.error;
export const lifecycleObserver = { onLifecycleEvent, onObserverFailure } satisfies LifecycleObserver;
export const lifecycleObserved = DiBag.withConfiguration({ lifecycleObservers: [lifecycleObserver] });
export function inferredLifecycleObserver() {
  return lifecycleObserved.withConfiguration({ lifecycleObservers: [{
    onLifecycleEvent(event) { return event.kind; },
    onObserverFailure(failure) { return failure.error; },
  }] });
}
```

In `tests/types/observers-consumer.ts`, import `lifecycleObserved` and `inferredLifecycleObserver`, then append:

```ts
const lifecycleComposed = lifecycleObserved.withConfiguration({ lifecycleObservers: [{
  onLifecycleEvent: async event => event.kind,
  onObserverFailure: async failure => failure.error,
}] });
const lifecycleExact: typeof lifecycleObserved = inferredLifecycleObserver();
lifecycleComposed.createBuilder().buildContainer();
void lifecycleExact;
// @ts-expect-error required failure callback survives declaration emission
lifecycleObserved.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent(event: LifecycleEvent) {} }] });
// @ts-expect-error observer callbacks have a void receiver
lifecycleObserved.withConfiguration({ lifecycleObservers: [{
  onLifecycleEvent(this: { owner: string }, event: LifecycleEvent) {},
  onObserverFailure(failure: ObserverFailure) {},
}] });
```

Append these complete negative cases to `tests/types/negative/observers.ts`:

```ts
// diagnostic: onObserverFailure
DiBag.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent(event) {} }] });
// diagnostic: onLifecycleEvent
DiBag.withConfiguration({ lifecycleObservers: [{ onObserverFailure(failure) {} }] });
// diagnostic: not assignable
DiBag.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent: 1, onObserverFailure(failure) {} }] });
// diagnostic: not assignable
DiBag.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent(event) {}, onObserverFailure: null }] });
// diagnostic: not assignable
DiBag.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent(this: { owner: string }, event: LifecycleEvent) {}, onObserverFailure(failure) {} }] });
// diagnostic: not assignable
DiBag.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent(event) {}, onObserverFailure(this: { owner: string }, failure: ObserverFailure) {} }] });
// diagnostic: not assignable
DiBag.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent(event: { kind: 'scope-opened' }) {}, onObserverFailure(failure) {} }] });
```

- [ ] **Step 4: Run narrow checks**

```bash
bun test tests/container-names.test.ts tests/observers.test.ts
bun test tests/types.test.ts --test-name-pattern observers
```

Expected: pass; the old and new configuration names both work during expand.

- [ ] **Step 5: Commit**

```bash
git add src/observers.ts src/di-bag.ts tests/container-names.test.ts tests/types/observers.ts tests/types/observers-consumer.ts tests/types/negative/observers.ts
git commit -m "feat!: rename lifecycle observer configuration"
```

---
### Task 5: Teach the codemod every phase-6 rename and shape

**Files:**
- Modify: `tools/codemod/rename-map.json`
- Modify: `tools/codemod/rename-map.schema.json`
- Modify: `tools/codemod/lib/rewrite.mjs`
- Create: `tools/codemod/lib/transforms/container-derivation.mjs`
- Modify: `tools/codemod/lib/transforms/index.mjs`
- Create: `tools/codemod/test/fixtures/container-renames/input.ts`
- Create: `tools/codemod/test/fixtures/container-renames/expected.ts`
- Create: `tools/codemod/test/fixtures/container-renames/expected-manual.json`
- Modify: `tools/codemod/test/transforms.test.mjs`
- Modify: `tools/codemod/test/rename-map.test.mjs`
- Modify: `tools/codemod/test/pack.test.mjs`
- Modify: older fixture expected files containing phase-6 names

**Interfaces:**
- Consumes: phase 1's transform API plus this task's optional method-entry `transformNames` and `nameForRole(role)` extension; owner strings always name the 0.4.0 declaration.
- Produces: one pass that composes type/property/import/method rewrites and reshapes all three `createScope` and both `fork` forms.

- [ ] **Step 1: Add the exact rename-map entries**

Merge these entries into their existing arrays; retain every earlier entry:

```json
{
  "methods": [
    { "owner": "Bag", "from": "inspect", "to": "serviceSnapshot" },
    { "owner": "Bag", "from": "inspectAll", "to": "serviceSnapshot", "transform": "collection-read" },
    { "owner": "Bag", "from": "inspectGraph", "to": "graphSnapshot" },
    { "owner": "Bag", "from": "createScope", "to": "createChildContainer", "arity": [0, 1, 2, 3], "transform": "container-derivation", "transformNames": { "keys": "replacedServiceKeys", "providers": "replacementProviders", "sharing": "sharedParentServiceKeys" } },
    { "owner": "Bag", "from": "fork", "to": "createIndependentContainer", "arity": [0, 1, 2], "transform": "container-derivation", "transformNames": { "keys": "replacedServiceKeys", "providers": "replacementProviders" } },
    { "owner": "Module", "from": "renameExport", "to": "withRenamedExport", "arguments": { "kind": "bag", "names": ["currentExportKey", "newExportKey"] } }
  ],
  "options": [
    { "owner": "DiBagApi", "method": "withConfiguration", "argument": 0, "from": "observers", "to": "lifecycleObservers" }
  ],
  "properties": [
    { "owner": "ObserverOptions", "from": "onEvent", "to": "onLifecycleEvent" },
    { "owner": "ObserverOptions", "from": "onError", "to": "onObserverFailure" },
    { "owner": "ScopeOptions", "from": "share", "to": "sharedParentServiceKeys" }
  ],
  "types": [
    { "from": "Bag", "to": "Container" },
    { "from": "ScopeOptions", "to": "CreateChildContainerOptions" },
    { "from": "CheckedScopeLifetimes", "to": "CheckedChildContainerLifetimes" },
    { "from": "DisjointScopeSelection", "to": "DisjointChildContainerSelection" },
    { "from": "ObserverOptions", "to": "LifecycleObserver" }
  ],
  "imports": [
    { "from": "di-bag/node", "to": "di-bag" },
    { "fromSuffix": "/src/node", "toSuffix": "/src" }
  ]
}
```

Replace the existing `Bag.inspectAll` entry in place; do not append a duplicate. Its phase-4 `collection-read` transform remains, but its target must now be `serviceSnapshot`. The map always spans original0.4 to current0.5; `nameOf` does not transitively follow `inspectAll -> inspect -> serviceSnapshot`.

`CreateIndependentContainerOptions` is new and has no type-map entry. Every `owner` remains an actual 0.4.0 declaration. `transformNames` is method-entry metadata, not a declaration lookup namespace; the transform reads it through the engine API below. `CreateChildContainerOptions` orders its generics as registrations, shared keys, defaulted constraints, replaced keys, replacement providers. The phase-1 type rename therefore preserves every old `ScopeOptions<R, S>` annotation; phase 4's internal three-argument use remains `CreateChildContainerOptions<R, S, C>`.

Extend the `methods.items.properties` object in `rename-map.schema.json` with this optional field; retain `additionalProperties: false` on a method entry:

```json
"transformNames": {
  "type": "object",
  "minProperties": 1,
  "additionalProperties": { "type": "string", "minLength": 1 }
}
```

Update the `MethodEntry` JSDoc typedef in `lib/rename-map.mjs` with `transformNames?: Record<string, string>`. In `validateRenameMap`'s existing methods loop, immediately after the transform/arguments exclusivity check, add:

```js
if (entry.transformNames !== undefined) {
  const names = entry.transformNames;
  if (entry.transform === undefined) bad('methods', index, 'transformNames requires transform');
  if (typeof names !== 'object' || names === null || Array.isArray(names)
      || Object.keys(names).length === 0 || !Object.values(names).every(isString)) {
    bad('methods', index, 'transformNames must map at least one role to a non-empty string');
  }
}
```

`loadRenameMap` already delegates every accepted-key/value check to `validateRenameMap`; it needs no separate allowlist edit. The JSON schema's method-entry `additionalProperties: false` now recognizes the new key, and the runtime validator above recognizes its value contract.

In `lib/rewrite.mjs`, pass the selected method entry into the transform API and expose one exact role lookup:

```js
function transformApi(member, entry) {
  return {
    ts, checker, program, library, sourceFile, member, text, slice, start, assemble, objectLiteral, quote, manual,
    nameOf: index.nameOf,
    nameForRole(role) {
      const value = entry?.transformNames?.[role];
      if (value === undefined) throw new Error(`transform ${entry?.transform ?? '<unknown>'} has no name for role ${role}`);
      return value;
    },
  };
}

// In rewriteCall's existing custom-transform branch:
const result = transforms[entry.transform](call, transformApi(member, entry));
```

Replace only this result line in the existing custom-transform branch. Retain the preceding
`memberCoverage` completeness and call-plan consistency checks, and retain the following
`result === undefined` skip handling unchanged.

Update the transform-API JSDoc/type description beside this code to include `nameForRole(role)`. Append these exact assertions to `rename-map.test.mjs` and update the shipped-map transform id list in its existing validity test to `['build-and-start', 'collection-read', 'collection-reference', 'collection-token', 'container-derivation']`:

```js
test('custom-transform role names survive loading the shipped map', () => {
  const loaded = loadRenameMap(
    join(packageRoot, 'rename-map.json'),
    ['build-and-start', 'collection-read', 'collection-reference', 'collection-token', 'container-derivation'],
  );
  const entry = loaded.methods.find(method => method.owner === 'Bag' && method.from === 'createScope');
  assert.deepEqual(entry.transformNames, {
    keys: 'replacedServiceKeys',
    providers: 'replacementProviders',
    sharing: 'sharedParentServiceKeys',
  });
});

test('custom-transform role names require a transform and non-empty targets', () => {
  assert.deepEqual(validateRenameMap({
    version: 1,
    methods: [{
      owner: 'Bag', from: 'createScope', to: 'createChildContainer',
      transformNames: { keys: '' },
    }],
  }, ['container-derivation']), [
    'methods[0]: transformNames requires transform',
    'methods[0]: transformNames must map at least one role to a non-empty string',
  ]);
});
```

This is a backwards-compatible optional map field; no earlier entry changes.

- [ ] **Step 2: Implement and register `container-derivation`**

Export the default transform `containerDerivation(call, api)` and register its id. Read `call.expression.name.text` as the 0.4.0 method and ask `api.nameOf('Bag', oldName)` for the emitted method name; never hardcode it. Apply this table:

| 0.4 call | Adopted output |
| --- | --- |
| `createScope()` | `createChildContainer()` |
| `createScope({ share })` | `createChildContainer({ sharedParentServiceKeys: share })` |
| `createScope(keys, providers)` | `createChildContainer({ replacedServiceKeys: keys, replacementProviders: providers })` |
| `createScope(keys, providers, { share })` | `createChildContainer({ replacedServiceKeys: keys, replacementProviders: providers, sharedParentServiceKeys: share })` |
| `fork()` | `createIndependentContainer()` |
| `fork(keys, providers)` | `createIndependentContainer({ replacedServiceKeys: keys, replacementProviders: providers })` |

Use `api.assemble(call, replacements)` so nested phase transforms compose and untouched comments, whitespace, trailing commas, and multiline layout survive. Accept scope options only when it is an object literal containing the sole syntactic key `share` and no spread/computed key. Ask `api.nameOf` for the method and `api.nameForRole` for every emitted field name. Otherwise call `api.manual(call, 'the createScope options are not an object literal; rewrite it to createChildContainer by hand')` and return `undefined`. Spread call arguments are reported by the engine.

Under the S3 fallback, emit `createChildContainer(keys, providers, { sharedParentServiceKeys: share })` and `createIndependentContainer(keys, providers)`; zero-argument and share-only output remains unchanged.

Under the S3 positional fallback, replace only the three adopted branches with these source-preserving variants:

```js
if (oldName === 'fork' && args.length === 2) {
  return api.assemble(call, replacements);
}
if (oldName === 'createScope' && args.length === 2) {
  return api.assemble(call, replacements);
}
if (oldName === 'createScope' && args.length === 3) {
  const shared = shareReplacements(args[2], call, api, names.shared);
  return shared === undefined ? undefined : api.assemble(call, [...replacements, ...shared]);
}
```

Place these before the adopted branches they replace; do not leave both versions reachable. Update `expected.ts` lines for `child2`, `child3`, and `fork1` to the exact positional output and keep the same literal manual report.

- [ ] **Step 3: Pin composition with a fixture**

Create `tools/codemod/lib/transforms/container-derivation.mjs` with this complete adopted-shape implementation:

```js
// tools/codemod/lib/transforms/container-derivation.mjs
function methodReplacement(call, api) {
  const name = call.expression.name;
  return { start: api.start(name), end: name.end, text: api.nameOf('Bag', name.text) };
}

function fieldNames(oldName, api) {
  const names = {
    keys: api.nameForRole('keys'),
    providers: api.nameForRole('providers'),
  };
  return oldName === 'createScope'
    ? { ...names, shared: api.nameForRole('sharing') }
    : names;
}

function shareReplacements(options, call, api, sharedName) {
  const { ts } = api;
  if (!ts.isObjectLiteralExpression(options) || options.properties.length !== 1) {
    api.manual(call, 'the createScope options are not an object literal; rewrite it to createChildContainer by hand');
    return undefined;
  }
  const [property] = options.properties;
  if (ts.isShorthandPropertyAssignment(property) && property.name.text === 'share') {
    return [{ start: api.start(property.name), end: property.name.end, text: `${sharedName}: share` }];
  }
  if (ts.isPropertyAssignment(property) && !ts.isComputedPropertyName(property.name)
      && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
      && property.name.text === 'share') {
    return [{ start: api.start(property.name), end: property.name.end, text: sharedName }];
  }
  api.manual(call, 'the createScope options are not an object literal; rewrite it to createChildContainer by hand');
  return undefined;
}

function openingBraceEnd(options, api) {
  const opening = api.start(options);
  return api.slice(opening + 1, opening + 2) === ' ' ? opening + 2 : opening + 1;
}

function wrapPair(call, api, names, args, replacements) {
  replacements.push(
    { start: api.start(args[0]), end: api.start(args[0]), text: `{ ${names.keys}: ` },
    { start: api.start(args[1]), end: api.start(args[1]), text: `${names.providers}: ` },
    { start: args[1].end, end: args[1].end, text: ' }' },
  );
  return api.assemble(call, replacements);
}

export default function containerDerivation(call, api) {
  const oldName = call.expression.name.text;
  const args = [...call.arguments];
  const names = fieldNames(oldName, api);
  const replacements = [methodReplacement(call, api)];
  if (oldName === 'fork') {
    if (args.length === 0) return api.assemble(call, replacements);
    if (args.length === 2) return wrapPair(call, api, names, args, replacements);
    api.manual(call, 'fork is called with an unexpected number of arguments; rewrite it to createIndependentContainer by hand');
    return undefined;
  }
  if (args.length === 0) return api.assemble(call, replacements);
  if (args.length === 1) {
    const shared = shareReplacements(args[0], call, api, names.shared);
    return shared === undefined ? undefined : api.assemble(call, [...replacements, ...shared]);
  }
  if (args.length === 2) return wrapPair(call, api, names, args, replacements);
  if (args.length === 3) {
    const shared = shareReplacements(args[2], call, api, names.shared);
    if (shared === undefined) return undefined;
    replacements.push(
      { start: api.start(args[0]), end: api.start(args[0]), text: `{ ${names.keys}: ` },
      { start: api.start(args[1]), end: api.start(args[1]), text: `${names.providers}: ` },
      { start: api.start(args[2]), end: openingBraceEnd(args[2], api), text: '' },
      ...shared,
    );
    return api.assemble(call, replacements);
  }
  api.manual(call, 'createScope is called with an unexpected number of arguments; rewrite it to createChildContainer by hand');
  return undefined;
}
```

Register the transform without replacing earlier registrations:

```js
import containerDerivation from './container-derivation.mjs';

export const transforms = {
  'build-and-start': buildAndStart,
  'container-derivation': containerDerivation,
};
```


Create `input.ts`:

```ts
import { DiBag, type Bag, type ObserverOptions, type ScopeOptions } from 'di-bag/node';
const root = DiBag.createBuilder().register({ a: () => 1, b: () => 2 }).build();
const keys = ['a'] as const;
const replacements = { a: () => 3 };
const sharing = { share: ['b'] as const };
const observer: ObserverOptions = { onEvent() {}, onError() {} };
export const configured = DiBag.withConfiguration({ observers: [observer] });
export const a = root.inspect('a');
export const graph = root.inspectGraph();
export const child0 = root.createScope();
export const child1 = root.createScope({ share: ['b'] });
export const child2 = root.createScope(keys, replacements);
export const child3 = root.createScope(keys /* k */, replacements /* p */, { share: ['b'], });
export const manual = root.createScope(keys, replacements, sharing);
export const fork0 = root.fork();
export const fork1 = root.fork(keys, replacements);
export const preserved = root.createScope(
  keys, // selected keys stay commented
  replacements, // providers keep the trailing comma
);
export const nested = root.fork(['a'], { a: () => DiBag.createBuilder().register({ inner: () => 1 }).build() });
export type App = Bag<{ a: () => number }>;
export type ChildOptions = ScopeOptions<{ a: () => number }, readonly ['a']>;
export type ConstrainedChildOptions = ScopeOptions<{ a: () => number }, readonly ['a'], never>;
const collection = DiBag.token(Symbol('collection')).of<number>();
const collectionContainer = DiBag.createBuilder().contribute(collection, () => 1).build();
export const collectionSnapshots = collectionContainer.inspectAll(collection);
```

The adopted `expected.ts` is:

```ts
import { DiBag, type Container, type LifecycleObserver, type CreateChildContainerOptions } from 'di-bag';
const root = DiBag.createBuilder().withServices({ a: () => 1, b: () => 2 }).buildContainer();
const keys = ['a'] as const;
const replacements = { a: () => 3 };
const sharing = { share: ['b'] as const };
const observer: LifecycleObserver = { onLifecycleEvent() {}, onObserverFailure() {} };
export const configured = DiBag.withConfiguration({ lifecycleObservers: [observer] });
export const a = root.serviceSnapshot('a');
export const graph = root.graphSnapshot();
export const child0 = root.createChildContainer();
export const child1 = root.createChildContainer({ sharedParentServiceKeys: ['b'] });
export const child2 = root.createChildContainer({ replacedServiceKeys: keys, replacementProviders: replacements });
export const child3 = root.createChildContainer({ replacedServiceKeys: keys /* k */, replacementProviders: replacements /* p */, sharedParentServiceKeys: ['b'], });
export const manual = root.createScope(keys, replacements, sharing);
export const fork0 = root.createIndependentContainer();
export const fork1 = root.createIndependentContainer({ replacedServiceKeys: keys, replacementProviders: replacements });
export const preserved = root.createChildContainer(
  { replacedServiceKeys: keys, // selected keys stay commented
  replacementProviders: replacements }, // providers keep the trailing comma
);
export const nested = root.createIndependentContainer({ replacedServiceKeys: ['a'], replacementProviders: { a: () => DiBag.createBuilder().withServices({ inner: () => 1 }).buildContainer() } });
export type App = Container<{ a: () => number }>;
export type ChildOptions = CreateChildContainerOptions<{ a: () => number }, readonly ['a']>;
export type ConstrainedChildOptions = CreateChildContainerOptions<{ a: () => number }, readonly ['a'], never>;
const collection = DiBag.token(Symbol('collection')).forCollectionOf<number>();
const collectionContainer = DiBag.createBuilder().withCollectionContribution({ collectionToken: collection, provider: () => 1 }).buildContainer();
export const collectionSnapshots = collectionContainer.serviceSnapshot(collection);
```

Use the actual phase-5 builder syntax, including its recorded S1 fallback for the appended contribution if selected. The appended collection regression must compose the phase-4 token/read transforms with the final snapshot name in one pass. `expected-manual.json` has one item at the `manual` line with the exact Step-2 reason.

For the shown input, create this exact `expected-manual.json` (line 14 is the `manual` declaration in the fixture above):

```json
[
  {
    "line": 14,
    "reason": "the createScope options are not an object literal; rewrite it to createChildContainer by hand"
  }
]
```

If formatting changes the fixture line, use the actual 1-based line printed by `nl -ba input.ts`; the reason string is exact. The harness uses deep equality on literal `{ line, reason }` objects; it does not accept patterns.

In `tools/codemod/test/transforms.test.mjs`, update the pinned registry keys to `['build-and-start', 'collection-read', 'collection-reference', 'collection-token', 'container-derivation']`. Add a test through the real `runCodemod` helper and vendored 0.4.0 declarations, using the fixture's exact `root.createScope(keys /* k */, replacements /* p */, { share: ['b'], })` call and an alternate method entry whose `to` is `spawnChild` and whose `transformNames` targets are `chosenKeys`, `providerMap`, and `parentKeys`. The exact transformed line is:

```ts
export const child3 = root.spawnChild({ chosenKeys: keys /* k */, providerMap: replacements /* p */, parentKeys: ['b'], });
```

Use the original-program checker path; do not invoke `containerDerivation` directly and do not mock `assemble`. Append this complete test, adding `runCodemod`, `defaultMapFile`, `readFileSync`, `fixturesRoot`, and `fixturesProgram` to the file's existing imports where absent:

```js
test('container derivation uses mapped role names and preserves three-argument trivia', () => {
  const shipped = JSON.parse(readFileSync(defaultMapFile, 'utf8'));
  const alternate = {
    ...shipped,
    methods: shipped.methods.map(entry => entry.owner === 'Bag' && entry.from === 'createScope'
      ? {
          ...entry,
          to: 'spawnChild',
          transformNames: { keys: 'chosenKeys', providers: 'providerMap', sharing: 'parentKeys' },
        }
      : entry),
  };
  const common = {
    typescript: compiler.ts,
    root: fixturesRoot,
    program: fixturesProgram(),
    only: ['container-renames/input.ts'],
  };
  const alternateResult = runCodemod({ ...common, map: alternate });
  assert.match(alternateResult.files[0].text,
    /export const child3 = root\.spawnChild\(\{ chosenKeys: keys \/\* k \*\/, providerMap: replacements \/\* p \*\/, parentKeys: \['b'\], \}\);/);
  const shippedResult = runCodemod({ ...common, map: shipped });
  assert.match(shippedResult.files[0].text,
    /export const child3 = root\.createChildContainer\(\{ replacedServiceKeys: keys \/\* k \*\/, replacementProviders: replacements \/\* p \*\/, sharedParentServiceKeys: \['b'\], \}\);/);
});
```

These two original-program assertions pin comments, one space before the renamed sharing field, and the trailing comma. The shipped fixture still byte-compares the whole file through `fixtures.test.mjs`.

In `tools/codemod/test/pack.test.mjs`, append `lib/transforms/container-derivation.mjs` to the exact packed-file list. Preserve phase 5's accumulated `builder-renames` expected output, including the collection-token `.forCollectionOf<string>()` line; update only the later names emitted by this phase.

- [ ] **Step 4: Run and commit the codemod checks**

```bash
npm run codemod:check
git add tools/codemod
git commit -m "feat(codemod): migrate container APIs"
```

Expected: exit 0; older fixtures still pass, including nested transforms.

---

### Task 6: Run the codemod once over typed call sites

**Files:**
- Modify: typed `.ts` and `.tsx` files under `tests/`, `examples/`, `scripts/agent-eval/`, and `tools/graph/test/fixtures/`
- Modify: older codemod expected fixtures that emit a phase-6 name
- Create: `/tmp/di-bag-phase-06/codemod-report.txt` (untracked)

**Interfaces:**
- Consumes: dual old/new declarations and Task 5's codemod.
- Produces: typed code on phase-6 names except explicit negative and codemod-input fixtures.

- [ ] **Step 1: Rebuild, preview, and read every manual item**

```bash
npm run build
node tools/codemod/cli.mjs --project tsconfig.json --library-root src --library-root dist --extra-files 'tests/types/negative/*.ts' --report /tmp/di-bag-phase-06/codemod-report.txt
```

Expected: rewrites outside `src`; every manual item has a file, line, and exact Task-5 reason.

- [ ] **Step 2: Apply exactly once and resolve manual items**

```bash
node tools/codemod/cli.mjs --project tsconfig.json --library-root src --library-root dist --extra-files 'tests/types/negative/*.ts' --write --report /tmp/di-bag-phase-06/codemod-report.txt
```

Migrate each reported `ScopeOptions` annotation, receiver typed `any`, spread, or indirect options object at its construction site. Do not rerun the codemod.

- [ ] **Step 3: Audit and test**

```bash
git diff --check
git diff --stat
git diff -- tests/types/negative
grep -rnE '\.(createScope|fork|inspect|inspectGraph|renameExport)\(' tests examples scripts/agent-eval tools/graph/test/fixtures --include='*.ts' --include='*.tsx'
grep -rnE "from ['\"](di-bag/node|.*src/node)['\"]" tests examples scripts/agent-eval tools/graph/test/fixtures --include='*.ts' --include='*.tsx'
npm run typecheck
bun test tests/container-derivation.test.ts tests/container-names.test.ts tests/scopes.test.ts tests/selected-scopes.test.ts tests/modules.test.ts tests/observers.test.ts
```

Expected: greps show only explicit rejection/codemod inputs; checks pass.

- [ ] **Step 4: Commit the mechanical rewrite by itself**

```bash
git add tests examples scripts/agent-eval tools/graph/test/fixtures tools/codemod/test/fixtures
git commit -F - <<'MSG'
refactor!: move typed call sites to container APIs

node tools/codemod/cli.mjs --project tsconfig.json --library-root src --library-root dist --extra-files 'tests/types/negative/*.ts' --write

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

---

### Task 7: Migrate generated strings, graph tooling, and shipped agent material

**Files:**
- Modify: `tests/compiler.ts`, package/native/token/release tests, `tests/host-builtin-module.ts`, `tests/*.node.mjs`
- Modify: `scripts/benchmark-types.ts`, `scripts/compiler-case.ts`, `scripts/benchmark-compiler-ceiling.ts`, `scripts/runtime-benchmark-child.ts`, `scripts/platform-evidence.ts`, `scripts/react-browser-lane.ts`, `scripts/agent-eval/**`
- Modify: `tools/graph/lib/extract.mjs`, `tools/graph/README.md`, `tools/graph/test/**`
- Modify: `AGENTS.md`, `docs/agent/recipes.md`, `docs/agent/errors.md`, `tools/docs/api-card-tasks.json`
- Create: `/tmp/di-bag-phase-06/reshape-untyped.mjs` (untracked migration helper)

**Interfaces:**
- Consumes: all adopted phase-6 names and phase 5's `moduleLabel` option.
- Produces: generated/runtime source on 0.5.0 names; graph schema stays version 1 with `Unit.kind: 'bag' | 'module'`.

- [ ] **Step 1: Migrate generated-source templates**

Create `/tmp/di-bag-phase-06/reshape-untyped.mjs` first. It performs only context-free declaration/member/import renames, records exact per-file counts, and refuses to leave a positional derivation call for a human to overlook:

```js
import { globSync, readFileSync, writeFileSync } from 'node:fs';

const patterns = [
  'tests/**/*.{ts,tsx,mjs}', 'scripts/**/*.{ts,tsx,mjs}',
  'tools/graph/**/*.{ts,tsx,mjs,md}', 'AGENTS.md', 'docs/agent/*.md',
];
const excluded = /(?:api-renaming\.ts|tools\/codemod\/test\/fixtures|tools\/graph\/test\/fixtures\/.*0-4)/;
const files = [...new Set(patterns.flatMap(pattern => globSync(pattern)))].filter(file => !excluded.test(file)).sort();
const rules = [
  [/(['"])(di-bag\/node)\1/g, (_m, quote) => `${quote}di-bag${quote}`, 'root import'],
  [/(\/src)\/node(?=['"])/g, '$1', 'source root import'],
  [/\bCheckedScopeLifetimes\b/g, 'CheckedChildContainerLifetimes', 'lifetime type'],
  [/\bDisjointScopeSelection\b/g, 'DisjointChildContainerSelection', 'disjoint type'],
  [/\bScopeOptions\b/g, 'CreateChildContainerOptions', 'child options type'],
  [/\bObserverOptions\b/g, 'LifecycleObserver', 'observer type'],
  [/\.inspectGraph\(/g, '.graphSnapshot(', 'graph snapshot'],
  [/\.inspect\(/g, '.serviceSnapshot(', 'service snapshot'],
  [/\.renameExport\(\s*([^,()]+?)\s*,\s*([^,()]+?)\s*\)/g, '.withRenamedExport({ currentExportKey: $1, newExportKey: $2 })', 'module export bag'],
  [/\bobservers\s*:/g, 'lifecycleObservers:', 'observer list field'],
  [/\bonEvent\s*:/g, 'onLifecycleEvent:', 'observer event field'],
  [/\bonError\s*:/g, 'onObserverFailure:', 'observer failure field'],
  [/\bonEvent\s*\(/g, 'onLifecycleEvent(', 'observer event method'],
  [/\bonError\s*\(/g, 'onObserverFailure(', 'observer failure method'],
];
const inventory = { before: {}, changes: {}, after: {} };
const retired = /\.(?:createScope|fork|inspect|inspectGraph|renameExport)\(|\b(?:ScopeOptions|CheckedScopeLifetimes|DisjointScopeSelection|ObserverOptions)\b|\b(?:observers|onEvent|onError)\s*:/g;
for (const file of files) {
  const unresolved = readFileSync(file, 'utf8').match(/\.(?:createScope|fork)\s*\(/g) ?? [];
  if (unresolved.length) throw new Error(`${file}: ${unresolved.length} derivation call(s) require an explicit one-bag reshape before this script writes anything`);
}
for (const file of files) {
  let text = readFileSync(file, 'utf8');
  inventory.before[file] = [...text.matchAll(retired)].length;
  const counts = {};
  for (const [pattern, replacement, label] of rules) {
    let count = 0;
    text = text.replace(pattern, (...args) => {
      count++;
      return typeof replacement === 'function' ? replacement(...args) : replacement.replace(/\$(\d+)/g, (_m, n) => args[Number(n)]);
    });
    if (count) counts[label] = count;
  }
  inventory.changes[file] = counts;
  inventory.after[file] = [...text.matchAll(retired)].length;
  if (inventory.before[file] > 0 && Object.keys(counts).length === 0) throw new Error(`${file}: retired inventory changed by no rule`);
  writeFileSync(file, text);
}
writeFileSync('/tmp/di-bag-phase-06/untyped-inventory.json', `${JSON.stringify(inventory, null, 2)}\n`);
if (Object.values(inventory.after).some(count => count !== 0)) throw new Error('retired names remain; inspect untyped-inventory.json');
```

Run it after the exact derivation-bag edits in Steps 1 through 4. Expected before inventory: every nonzero file belongs to the explicit file groups in this task. Expected after inventory: every value is `0`. Review `changes` file by file; reject an empty change record for a nonzero input. The script deliberately aborts on a positional derivation call; edit that specific source string to one of the two canonical bags shown below, then rerun from the task commit's clean starting tree. Do not add a permissive regex.

Before editing, capture the positional derivation inventory from the phase entry tree:

```bash
rg -n '\.(createScope|fork)\(' tests/*.node.mjs tests/compiler.ts tests/package.test.ts tests/native-package.test.ts tests/token-package.test.ts tests/release-artifacts.test.ts tests/host-builtin-module.ts scripts --glob '!scripts/agent-eval/**' > /tmp/di-bag-phase-06/untyped-derivations.before.txt
cat /tmp/di-bag-phase-06/untyped-derivations.before.txt
test "$(wc -l < /tmp/di-bag-phase-06/untyped-derivations.before.txt)" -eq 10
```

The expected ten calls and their exact replacements are:

| File | Count | Entry call | Exact replacement |
| --- | ---: | --- | --- |
| `tests/runtime-scale.node.mjs` | 1 | `bag.createScope()` | `bag.createChildContainer()` |
| `tests/native-package.test.ts` generated source | 2 | `parent.createScope()`; `child.fork()` | `parent.createChildContainer()`; `child.createIndependentContainer()` |
| `tests/token-package.test.ts` generated source | 1 | `root.fork([samePublicToken], { [publicKey]: () => childValue })` | `root.createIndependentContainer({ replacedServiceKeys: [samePublicToken], replacementProviders: { [publicKey]: () => childValue } })` |
| `tests/package.test.ts` generated source | 2 | `parent.createScope()`; `scope.fork()` | `parent.createChildContainer()`; `scope.createIndependentContainer()` |
| `tests/package.test.ts` generated source | 1 | multiline `bag.fork(['clock'], { ... })` | `bag.createIndependentContainer({ replacedServiceKeys: ['clock'], replacementProviders: { ... } })` with the provider object and its indentation unchanged |
| `tests/package.test.ts` generated source | 1 | `bag.fork()` | `bag.createIndependentContainer()` |
| `tests/package.test.ts` generated source | 1 | `composed.fork(['clock'], { clock: () => ({ ... }) })` | `composed.createIndependentContainer({ replacedServiceKeys: ['clock'], replacementProviders: { clock: () => ({ ... }) } })` |
| `tests/package.test.ts` generated source | 1 | `composed.fork(['clock', 'promised'], asyncOverrides)` | `composed.createIndependentContainer({ replacedServiceKeys: ['clock', 'promised'], replacementProviders: asyncOverrides })` |

Apply only those ten replacements before running `reshape-untyped.mjs`. Then run the same `rg` into `/tmp/di-bag-phase-06/untyped-derivations.after.txt`; expected output is empty and `test ! -s` passes. `scripts/agent-eval/**` is excluded because Task 6 sends those real TypeScript calls through the checker-backed codemod. The graph tool's 0.4 fixtures remain deliberately excluded compatibility inputs.

In `tests/compiler.ts` and all three compiler scripts, apply the codemod table inside source strings: derivation bags, `Container`, snapshots, module bag, and observer fields. Keep the twelve cases logically identical.

```bash
node scripts/evidence-cases.mjs --compare docs/superpowers/plans/evidence/baseline.md --json /tmp/di-bag-phase-06/migrated-generators.json
```

Expected: twelve accepted rows and no token diagnostics. Replace Task 1's provisional phase values with these final values in `phase-06.md`.

- [ ] **Step 2: Migrate package/runtime strings**

Apply the same rewrites in `tests/package.test.ts`, `tests/native-package.test.ts`, `tests/token-package.test.ts`, `tests/release-artifacts.test.ts`, `tests/host-builtin-module.ts`, the three `.node.mjs` suites, and generated code under `scripts/`. Every `di-bag/node` import becomes `di-bag`. Compile strings import `type Container`. Keep the runtime assertion that type-only `Container`, `Module`, and `Provider` are not constructible exports. Release-artifact expected entries become `['di-bag']`.

`tests/token-package.test.ts` still compares ESM and CJS views of the root package for canonical token identity. `scripts/runtime-benchmark-child.ts` loads `di-bag` in both runtime scenarios. `scripts/platform-evidence.ts` replaces the node-subpath boundary fact with root-entry coverage. Leave the `scripts/react-browser-lane.ts` assertion about `src/node.ts` until Task 10 deletes that file.

- [ ] **Step 3: Update graph recognition without changing JSON**

In `tools/graph/lib/extract.mjs`, recognize `buildContainer` and phase 5's module terminal, while retaining `build`, `buildAndStart`, `buildModule`, and `renameExport` to analyze 0.4.0 projects. Parse `withRenamedExport({ currentExportKey, newExportKey })` beside positional `renameExport`; a spread or nonliteral options bag remains untraceable.

Keep output `kind: 'bag'`. `tools/graph/README.md` must say a source `buildContainer()` emits established schema-v1 `kind: "bag"`. Do not change expected JSON kind values.

Run: `npm run graph:check`

Expected: exit 0; every unit kind remains `bag` or `module`.

- [ ] **Step 4: Migrate agent-eval and shipped agent docs**

Migrate `scripts/agent-eval/reference/**`, `scripts/agent-eval/skeleton/**`, `AGENTS.md`, and `docs/agent/*.md`. Use these canonical shapes:

```ts
const child = container.createChildContainer({
  replacedServiceKeys: ['request'],
  replacementProviders: { request: () => requestContext },
  sharedParentServiceKeys: ['client'],
});
const testContainer = container.createIndependentContainer({
  replacedServiceKeys: ['clock'],
  replacementProviders: { clock: (): Clock => ({ now: () => 0 }) },
});
```

Update `tools/docs/api-card-tasks.json` rows exactly:

```json
{ "task": "Replace services for a test", "call": "container.createIndependentContainer" }
{ "task": "Open a child container", "call": "container.createChildContainer" }
```

Use receiver `container` for close, readiness, and snapshot rows. Delete a summary-exception id only if that exact renamed task id is present. Replace lines in `AGENTS.md`; never add lines.

- [ ] **Step 5: Audit and test**

```bash
node /tmp/di-bag-phase-06/reshape-untyped.mjs
cat /tmp/di-bag-phase-06/untyped-inventory.json
rg -n '\.(createScope|fork)\(' tests/*.node.mjs tests/compiler.ts tests/package.test.ts tests/native-package.test.ts tests/token-package.test.ts tests/release-artifacts.test.ts tests/host-builtin-module.ts scripts --glob '!scripts/agent-eval/**' > /tmp/di-bag-phase-06/untyped-derivations.after.txt
test ! -s /tmp/di-bag-phase-06/untyped-derivations.after.txt
grep -rnE '\.(createScope|fork|inspect|inspectGraph|renameExport)\(' tests examples scripts tools/graph AGENTS.md docs/agent --exclude='api-renaming.ts' --exclude-dir='container-renames'
grep -rnE '\b(Bag|ScopeOptions|CheckedScopeLifetimes|DisjointScopeSelection|ObserverOptions)\b' tests examples scripts tools/graph AGENTS.md docs/agent --exclude='api-renaming.ts' --exclude-dir='container-renames'
grep -rnE '\b(observers|onEvent|onError)\s*:' tests examples scripts tools/graph AGENTS.md docs/agent --exclude-dir='container-renames'
wc -l AGENTS.md
npm run agent-eval:test
npm run graph:check
```

Expected: only deliberate compatibility/rejection fixtures remain; line count is 150 or less; both suites pass.

- [ ] **Step 6: Commit**

```bash
git add tests examples scripts tools/graph tools/docs/api-card-tasks.json AGENTS.md docs/agent docs/superpowers/plans/evidence/phase-06.md
git commit -m "refactor!: migrate generated and agent container calls"
```

---

### Task 8: Contract the public type and container methods

**Files:**
- Modify: `src/di-bag.ts`, `src/scope-selection.ts`, `src/scope-types.ts`, `src/lifetime-types.ts`, `src/types.ts`, `src/startup.ts`, `src/index.ts`
- Modify: `tests/container-names.test.ts`
- Modify: `tests/types/negative/api-renaming.ts`
- Modify: `tests/package.test.ts`

**Interfaces:**
- Consumes: migrated call sites and adopted S3 shape.
- Produces: `Container<ServiceRegistrations, Constraints>` as the only public container type; no `Bag`, `inspect`, `inspectGraph`, `createScope`, `fork`, `ScopeOptions`, `CheckedScopeLifetimes`, or `DisjointScopeSelection` declaration.

- [ ] **Step 1: Add contract tests before deleting names**

Append to `tests/container-names.test.ts`:

```ts
test('retired container members are absent at runtime', () => {
  const container = DiBag.createBuilder().buildContainer() as unknown as Record<string, unknown>;
  for (const name of ['inspect', 'inspectGraph', 'createScope', 'fork']) expect(name in container).toBe(false);
});
```

Append these lines to `tests/types/negative/api-renaming.ts` (and use the file's post-codemod root import):

```ts
// diagnostic: no exported member
import type { Bag } from '../../../src';
// diagnostic: no exported member
import type { ScopeOptions } from '../../../src';
// diagnostic: no exported member
import type { CheckedScopeLifetimes } from '../../../src';
// diagnostic: no exported member
import type { DisjointScopeSelection } from '../../../src';
const retiredContainer = DiBag.createBuilder().buildContainer();
// diagnostic: does not exist
retiredContainer.inspect('value');
// diagnostic: does not exist
retiredContainer.inspectGraph();
// diagnostic: does not exist
retiredContainer.createScope();
// diagnostic: does not exist
retiredContainer.fork();
```

Because a single invalid import may suppress useful member diagnostics, split the type imports into one statement per retired export if the fixture harness reports fewer diagnostics than markers.

Run the negative-fixture test and `bun test tests/container-names.test.ts`. Expected: fail because old exports/members remain.

- [ ] **Step 2: Rename the class and every public-context helper**

In `src/di-bag.ts`, rename the declaration and exact export:

```ts
class Container<ServiceRegistrations extends Registrations, Constraints extends NeedConstraint = never> { /* existing body */ }
export type { Container, Builder };
```

Every `new Bag`, return type, `this` type, builder `buildContainer` return, JSDoc `{@link Bag...}`, example variable, and public-facing prose becomes `Container`/`container`. Audit identifier names matching `BuildBag|BagBuild|BuiltBag` and rename any phase-5 helper to the equivalent `BuildContainer|ContainerBuild|BuiltContainer` form. Export `Container` from `src/index.ts` and remove `Bag`.

Keep `BagRuntime`: it is an internal runtime/ownership engine, never exported, and renaming it would add churn without changing user vocabulary. Keep `DiBag`, every `DiBag*Error`, the package name, and `DI_BAG_*` codes because the spec explicitly preserves them.

- [ ] **Step 3: Remove old methods and support types**

Delete `inspect`, `inspectGraph`, all `createScope` overloads/body, all `fork` overloads/body, `selectScope`, `ScopeOptions`, `CheckedScopeLifetimes`, and `DisjointScopeSelection`. Remove their imports and old JSDoc. Export these exact phase-6 types from `src/index.ts`:

```ts
export type { Container, Builder, DiBagApi, ConfigurationOptions } from './di-bag';
export type { CreateChildContainerOptions, CreateIndependentContainerOptions, DisjointChildContainerSelection, UnsharedAliases, ScopedAliases, SharedAliasProviders } from './scope-types';
export type { CheckedLifetimes, CheckedChildContainerLifetimes, LifetimeObligation, Reach } from './lifetime-types';
```

No extra sharing-only options type is exported: `CreateChildContainerOptions` covers that overload through its defaulted replacement generics.

- [ ] **Step 4: Update container terminology except deferred message families**

Change user-facing comments/JSDoc in `src/` from bag/scope/fork to container/child container/independent container. Change `startup.ts` links from `Bag.close` to `Container.close` and authorized “Bag close” prose to “Container close”. Do **not** modify these three runtime constructions:

```ts
diagnosticMessage('DI_BAG_CLOSING', 'bag is closing')
diagnosticMessage('DI_BAG_CLOSED', `bag is ${state}`)
```

The exact code may have two acquisition sites and one runtime site. Preserve all 10 `toThrow('bag is closing')` and 5 `toThrow('bag is closed')` assertions for plan 12 (phase 11). Run:

```bash
grep -rhoE "toThrow\((/|['\x60])[^)]*" tests | grep -iE '\bbag is (closing|closed)\b' | sort | uniq -c
```

Expected: `10 ...bag is closing` and `5 ...bag is closed`. No replacement command is run in this phase.

- [ ] **Step 5: Run contract tests and audits**

```bash
bun test tests/container-names.test.ts
bun test tests/types.test.ts --test-name-pattern 'api renaming|container derivation'
grep -rnE '^class Bag\b|export type \{[^}]*\bBag\b|\b(ScopeOptions|CheckedScopeLifetimes|DisjointScopeSelection|ObserverOptions)\b' src tests examples scripts tools/graph AGENTS.md docs/agent --exclude='api-renaming.ts' --exclude-dir='container-renames'
grep -rnE '\.(createScope|fork|inspect|inspectGraph|renameExport)\(' src tests examples scripts tools/graph AGENTS.md docs/agent --exclude='api-renaming.ts' --exclude-dir='container-renames'
grep -rnE "operation: '(inspect|inspectGraph|createScope|fork|renameExport)'|\b(observers|onEvent|onError)\s*:" src tests examples scripts tools/graph AGENTS.md docs/agent --exclude-dir='container-renames'
```

Expected: tests pass. At this contract point, the first two greps show only the Task-9 observer/module expand declarations and explicit negative/codemod-input fixtures; the operation grep has no container-operation hit. Record every allowed path, and require the final Task-12 rerun to have only its explicitly excluded fixtures. `BagRuntime`, `DiBag*`, package names, codes, and graph `kind: "bag"` do not match these declaration/member patterns and remain intentionally.

- [ ] **Step 6: Keep the checked contract changes uncommitted**

Record the Step-5 results, run `git diff --check`, and continue directly into Task 9. Do not stage or commit: module/observer contraction, node-entry removal, regenerated reference files, and the source declaration removals must land together in Task 11's coherent green contract commit.

---

### Task 9: Contract module and lifecycle configuration names

**Files:**
- Modify: `src/module.ts`, `src/module-types.ts`, `src/observers.ts`, `src/di-bag.ts`, `src/index.ts`
- Modify: `tests/container-names.test.ts`, `tests/types/negative/api-renaming.ts`

**Interfaces:**
- Consumes: all call sites migrated in Tasks 6–7.
- Produces: only `withRenamedExport`, `lifecycleObservers`, `LifecycleObserver.onLifecycleEvent`, and `LifecycleObserver.onObserverFailure`.

- [ ] **Step 1: Add removed-name tests**

Append to the negative fixture with one `// diagnostic: does not exist` per line:

```ts
// diagnostic: no exported member
import type { ObserverOptions } from '../../../src';
const moduleForRename = DiBag.createBuilder().withServices({ value: () => 1 }).buildModule({ exportedServiceKeys: ['value'] });
// diagnostic: does not exist
moduleForRename.renameExport('value', 'other');
// diagnostic: does not exist
DiBag.withConfiguration({ observers: [] });
const lifecycleObserver = { onLifecycleEvent() {}, onObserverFailure() {} } satisfies import('../../../src').LifecycleObserver;
// diagnostic: does not exist
lifecycleObserver.onEvent;
// diagnostic: does not exist
lifecycleObserver.onError;
```

Append a runtime check that `renameExport` is absent from a built module. Run the narrow tests; expected: fail while old names remain.

- [ ] **Step 2: Remove old declarations and expand-only branches**

Delete `Module.renameExport`; remove old `InvalidRename` wording. Remove `ObserverOptions`, `ConfigurationOptions.observers`, the both-fields conflict branch, and `LifecycleObservers.appendLegacy`. Replace the expand-only private record with `readonly LifecycleObserver[]`; make `append(previous, observer)` validate/read `onLifecycleEvent` and `onObserverFailure` once as in Task 4, freeze that new-shape pair, and make the queue destructure/call those two names. This removes every internal `onEvent`/`onError` access together with the public declarations. Export `LifecycleObserver` from `src/index.ts`. Keep `ObserverCallback`, `ObserverErrorCallback`, and `ObserverFailure` unchanged, per spec. Keep event kinds, `ScopeEventFields`, and event field names for plan 12, master phase 11.

The contracted storage and delivery edits are exact:

```ts
let queue: Array<{ event: LifecycleEvent; callbacks: readonly LifecycleObserver[] }> | undefined;

private constructor(private readonly callbacks: readonly LifecycleObserver[]) {}

static append(previous: LifecycleObservers | undefined, observer: unknown): LifecycleObservers {
  if ((typeof observer !== 'object' && typeof observer !== 'function') || observer === null) {
    throw libraryTypeError('DI_BAG_INVALID_CONFIGURATION', 'withConfiguration lifecycleObservers require onLifecycleEvent and onObserverFailure callbacks', { operation: 'withConfiguration' });
  }
  const onLifecycleEvent = Reflect.get(observer, 'onLifecycleEvent') as unknown;
  const onObserverFailure = Reflect.get(observer, 'onObserverFailure') as unknown;
  if (typeof onLifecycleEvent !== 'function' || typeof onObserverFailure !== 'function') {
    throw libraryTypeError('DI_BAG_INVALID_CONFIGURATION', 'withConfiguration lifecycleObservers require onLifecycleEvent and onObserverFailure callbacks', { operation: 'withConfiguration' });
  }
  return new LifecycleObservers([...(previous?.callbacks ?? []), Object.freeze({
    onLifecycleEvent: onLifecycleEvent as ObserverCallback,
    onObserverFailure: onObserverFailure as ObserverErrorCallback,
  })]);
}

// Inside emit's existing delivery loop:
for (const { event, callbacks } of deliveries) for (const { onLifecycleEvent, onObserverFailure } of callbacks) {
  const failed = (error: unknown) => {
    try { monitor(onObserverFailure(Object.freeze({ error, event })), ignore); }
    catch { /* Error reporting must not recursively report itself. */ }
  };
  try { monitor(onLifecycleEvent(event), failed); }
  catch (error) { failed(error); }
}
```

- [ ] **Step 3: Verify operation names and messages**

```bash
grep -rnE "operation: '(inspect|inspectGraph|createScope|fork|renameExport)'|\b(observers|onEvent|onError)\b" src
grep -rnE '\b(renameExport|ObserverOptions)\b' src
```

Expected: no output except event callback type descriptions that do not use retired property names. All reworded validation sites retain their 0.4.0 codes, and details use `serviceSnapshot`, `graphSnapshot`, `createChildContainer`, `createIndependentContainer`, or `withRenamedExport`.

- [ ] **Step 4: Run and retain the checked changes for the contract group**

```bash
bun test tests/container-names.test.ts tests/modules.test.ts tests/observers.test.ts
bun test tests/types.test.ts --test-name-pattern 'api renaming|observers'
```

Expected: tests pass. Continue with all changes unstaged into Task 10.

---

### Task 10: Remove the `di-bag/node` entry point

**Files:**
- Delete: `src/node.ts`
- Delete: generated `docs/reference/node/**`
- Modify: `package.json`, `tsconfig.build.json`, `tools/docs/typedoc.json`, `tools/docs/lib/coverage.mjs`, `tools/docs/vitepress.config.mjs`, `.github/workflows/ci.yml`
- Modify: package/platform/release tests and `scripts/react-browser-lane.ts`
- Modify: `src/acquisition-mode.ts`

**Interfaces:**
- Consumes: root-entry imports migrated in Tasks 6–7 and existing `hostClassifier()`.
- Produces: one `di-bag` export for ESM/CJS/browser; Node 22.3+, Node 24, and Bun use `process.getBuiltinModule('node:util/types')` through the main entry.

- [ ] **Step 1: Pin root-entry behavior and subpath absence**

In `tests/package.test.ts`, retain its packed temporary consumer and make its ESM script import `DiBag` from `di-bag`, build `{ promised: () => Promise.resolve(42) }`, await `resolve('promised')`, assert `42`, and close. Add the same assertions to its CommonJS script with `const { DiBag } = require('di-bag')`. In both scripts, assert importing/requiring `di-bag/node` rejects with `ERR_PACKAGE_PATH_NOT_EXPORTED`. Update `tests/native-package.test.ts` and `tests/token-package.test.ts` to import both ESM and CJS views from the root while preserving their compiler/token-identity assertions. Update `tests/release-artifacts.test.ts` to assert there is no `node.js`, `node.d.ts`, node condition, or `./node` export.

The runtime fact behind this change was probed on Bun 1.4.0 during planning: the main `src/index` entry automatically classified `Promise.resolve(42)` and closed successfully. The executor must additionally run the package test under Node 24 after rebuilding.

- [ ] **Step 2: Delete the entry and packaging references**

Delete `src/node.ts`. In `package.json`, remove the complete `exports['./node']` object and any node-specific `files`/script item. Change `tsconfig.build.json` include to only `src/index.ts`. Remove the node entry from TypeDoc, coverage roots, VitePress labels/navigation, and CI/package loops. Delete generated `docs/reference/node/` only after confirming the index reference tree exists.

In `src/acquisition-mode.ts`, update only the comment to state that the root entry self-configures through `process.getBuiltinModule`; do not change `hostClassifier`. No file reachable from `src/index.ts` gains a `node:` import.

- [ ] **Step 3: Update platform and browser assertions**

Delete `scripts/react-browser-lane.ts`'s special rejection of input `src/node.ts`; keep its assertion that bundled root code contains no `node:` import. In `tests/composition-adapters.test.ts`, keep the `withoutBuiltinModule` case and assert a plain factory fails with `DI_BAG_CLASSIFIER_REQUIRED` while `fromSyncFactory` and `fromAsyncFactory` build and resolve. In `tests/platform/browser-worker.test.ts` and `tests/platform/browser-entry.ts`, import the root package, keep the same three explicit-classifier assertions inside the worker, and assert the bundle has no `node:` input. `tests/host-builtin-module.ts` remains only their helper and is not listed as a test target.

- [ ] **Step 4: Run focused packaging checks**

```bash
npm run build
bun test tests/package.test.ts tests/native-package.test.ts tests/token-package.test.ts tests/release-artifacts.test.ts tests/composition-adapters.test.ts tests/platform/browser-worker.test.ts
node --input-type=module -e "import { DiBag } from './dist/index.js'; const c=DiBag.createBuilder().withServices({ promised:()=>Promise.resolve(42) }).buildContainer(); if(await c.resolve('promised')!==42) throw Error('ESM root classifier'); await c.close()"
node -e "const { DiBag }=require('./dist/index.js'); (async()=>{const c=DiBag.createBuilder().withServices({ promised:()=>Promise.resolve(42) }).buildContainer(); if(await c.resolve('promised')!==42) throw Error('CJS root classifier'); await c.close()})()"
grep -rnE "di-bag/node|src/node|reference/node|['\"]\./node['\"]" package.json tsconfig.build.json src tests examples scripts tools .github AGENTS.md docs/agent
grep -rnE "from ['\"]node:|require\(['\"]node:" src
```

Expected: run the two `node` probes with the repository's pinned Node 24.20.0 from `scripts/pin-platform-tools.ts`; both exit 0. Package, portable-host, and browser-worker tests pass. The first grep has only codemod input/expected fixtures that deliberately demonstrate import migration; the second grep has no output. `process.getBuiltinModule('node:util/types')` remains because it is a runtime call, not an import.

- [ ] **Step 5: Retain node-entry removals for the contract group**

```bash
git ls-files src/node.ts docs/reference/node > /tmp/di-bag-phase-06/deleted-node-paths.txt
test -s /tmp/di-bag-phase-06/deleted-node-paths.txt
cat /tmp/di-bag-phase-06/deleted-node-paths.txt
```

Expected: the file lists the actual tracked node entry and generated node-reference paths removed by this task. Do not stage or commit. Task 11 regenerates the reference tree and commits these deletions with the final source contract.

---

### Task 11: Regenerate reference docs and close the naming ratchet

**Files:**
- Modify: `tools/docs/api-card-tasks.json`, `tools/docs/lib/api-card.mjs`, `tools/docs/test/api-card.test.mjs`, `tools/docs/test/exact-rendering.test.mjs`
- Modify: `tools/docs/api-card-summary-exceptions.json` only for stale ids
- Modify: `docs/guides/api-reference.md` only for generated-page rows
- Modify: `tests/documented-names.test.ts` if its receiver inventory is literal
- Modify: `tests/api-naming-known-violations.json`
- Regenerate: `docs/agent/api-card.md`, `docs/reference/index/**`

**Interfaces:**
- Consumes: final source declarations and phase-2 exact-rendering/summary tests.
- Produces: generated documentation for `Container` and the new option/support types; no generated `Bag`, node entry, scope-option, or observer-option page.

- [ ] **Step 1: Update docs-tool receiver and exact-signature expectations**

In `tools/docs/lib/api-card.mjs`, rename only the display receiver/category from `bag` to `container`; keep package/product references to DI Bag. In `api-card.test.mjs`, find TypeDoc child `Container` and expect names such as `container.close`. Update `exact-rendering.test.mjs` to read `index/interfaces/Container.md` and pin these fragments, adjusted only if S3 used its recorded fallback:

```text
serviceSnapshot<ServiceKey extends (keyof ServiceRegistrations & string) | TokenBase>
graphSnapshot(): GraphSnapshot
createChildContainer<const SharedParentServiceKeys extends readonly unknown[]>
createIndependentContainer<const ReplacedServiceKeys extends readonly unknown[]
withRenamedExport<const CurrentExportKey extends string, const NewExportKey extends string>
lifecycleObservers?: readonly LifecycleObserver[]
```

Pin `LifecycleObserver`'s two properties too. Remove old exact assertions for `Bag`, `inspect`, `createScope`, `ObserverOptions`, and `src/node`.

- [ ] **Step 2: Regenerate, then edit only allowed reference links**

```bash
npm run build
npm run docs:generate
```

Expected: TypeDoc creates `Container`, `CreateChildContainerOptions`, `CreateIndependentContainerOptions`, `CheckedChildContainerLifetimes`, `DisjointChildContainerSelection`, and `LifecycleObserver` pages; it removes the corresponding old pages and all `docs/reference/node/**` pages.

Update only the affected rows in `docs/guides/api-reference.md` so their links point at those new files. Do not rewrite guide prose; phase 12 owns it. Never hand-edit generated `docs/reference/**` or `docs/agent/api-card.md`.

- [ ] **Step 3: Shrink the known-violation list through its ratchet**

```bash
UPDATE_API_NAMING_VIOLATIONS=1 bun test tests/api-naming.test.ts
bun test tests/api-naming.test.ts tests/documented-names.test.ts
```

Expected: both pass. Confirm the six entry-state violations for export `Bag`, `ScopeOptions`, `DisjointScopeSelection`, `CheckedScopeLifetimes`, and members `createScope`/`fork` are gone. Do not hand-delete unrelated entries belonging to phases 7–11.

- [ ] **Step 4: Run docs checks and stale-id checks**

```bash
node --test tools/docs/test/api-card.test.mjs tools/docs/test/api-card-summaries.test.mjs tools/docs/test/exact-rendering.test.mjs
npm run docs:check
wc -l AGENTS.md
```

Expected: all pass, no stale summary exception, all generated files current, and `AGENTS.md` at most 150 lines.

- [ ] **Step 5: Commit the complete coherent source-and-generated-doc contract**

```bash
git add src package.json tsconfig.build.json tools/docs .github tests scripts docs/agent/api-card.md docs/reference docs/guides/api-reference.md tests/api-naming-known-violations.json tests/documented-names.test.ts AGENTS.md
git diff --cached --check
git commit -m "refactor!: contract container API and publish reference"
```

This one commit owns Tasks 8 through 11: removal of old container/module/observer declarations, deletion of the node entry and generated node reference, package/CI changes, regenerated `Container` reference/API card, ratchet updates, and final JSDoc. Immediately after committing, rerun `npm run docs:check`, the Task-8/9 contract tests, and Task-10 package tests against `HEAD`; all must pass. The bounded phase-6 generated-doc exception ends here; report only failures actually observed at preceding named commits.

---

### Task 12: Contract audit, final evidence, and full phase gate

**Files:**
- Modify: `docs/superpowers/plans/evidence/phase-06.md`
- Modify: any in-scope file whose audit or gate exposes a missed phase-6 migration

**Interfaces:**
- Consumes: contracted source, migrated repository, regenerated docs.
- Produces: a green phase with complete evidence and a controller-ready report.

- [ ] **Step 1: Run retired-name and operation audits**

```bash
grep -rnE '^class Bag\b|export type \{[^}]*\bBag\b|\b(ScopeOptions|CheckedScopeLifetimes|DisjointScopeSelection|ObserverOptions)\b' src tests examples scripts tools/graph AGENTS.md docs/agent --exclude='api-renaming.ts' --exclude-dir='container-renames'
grep -rnE '\.(createScope|fork|inspect|inspectGraph|renameExport)\(' src tests examples scripts tools/graph AGENTS.md docs/agent --exclude='api-renaming.ts' --exclude-dir='container-renames'
grep -rnE "operation: '(inspect|inspectGraph|createScope|fork|renameExport)'|\b(observers|onEvent|onError)\s*:" src tests examples scripts tools/graph AGENTS.md docs/agent --exclude-dir='container-renames'
grep -rnE "di-bag/node|src/node|reference/node|['\"]\./node['\"]" package.json tsconfig.build.json src tests examples scripts tools .github AGENTS.md docs/agent --exclude-dir='container-renames'
grep -rnE "from ['\"]node:|require\(['\"]node:" src
```

Expected: no executable old API outside deliberate negative/codemod/graph compatibility fixtures; no `node:` import in `src`. Inspect all `Bag` substring hits: only `DiBag`, `DiBag*`, `DI_BAG_*`, `BagRuntime`, product prose, and the two deferred close-state messages may remain.

- [ ] **Step 2: Recount message assertions without changing them**

```bash
grep -rhoE "toThrow\((/|['\x60])[^)]*" tests | grep -iE '\bbag is (closing|closed)\b' | sort | uniq -c
grep -rnE "bag is \$\{state\}|bag is closing|bag is closed" src
```

Expected: 10 `bag is closing`, 5 `bag is closed`, and three runtime construction sites. These remain until `2026-09-21-12-observability-and-errors.md` (phase 11). Ten unrelated `bag` hits in package name `di-bag` also remain and must not be rewritten.

- [ ] **Step 3: Re-run final compile evidence**

```bash
node scripts/evidence-cases.mjs --compare docs/superpowers/plans/evidence/baseline.md --json /tmp/di-bag-phase-06/final.json
```

Expected: twelve rows accepted, token diagnostics empty, each cumulative delta at or below +10%. Replace phase evidence values with the final numbers, state adopted/fallback, and record TypeScript versions and commands. If over budget, take Task 1 Step 8 and repeat Tasks 2, 5–12 with the fallback; do not waive the budget.

- [ ] **Step 4: Run the complete master-plan gate**

```bash
npm run check
npm run docs:check
npm run graph:check
npm run codemod:check
npm run typecheck:native
npm run build:native
npm run check:native
npm run build
node --expose-gc --test --test-isolation=none tests/runtime-scale.node.mjs tests/acquisition-retention.node.mjs tests/graph-retention.node.mjs
npm run agent-eval:test
for example in examples/*.ts; do bun run "$example" >/dev/null || { echo "FAILED $example"; exit 1; }; done
```

Expected: every command exits 0, both compiler lanes have zero diagnostics, all test lanes report zero failures, and the examples loop prints nothing. The final classic build restores `dist/` after native build output.

- [ ] **Step 5: Verify the codemod from a clean 0.4.0 fixture**

```bash
npm run codemod:check
node --test tools/codemod/test/fixtures.test.mjs tools/codemod/test/transforms.test.mjs
```

Expected: exit 0; the fixture harness transforms a temporary copy, compares it byte-for-byte with `expected.ts`, and deep-compares the literal manual report with `expected-manual.json`.

- [ ] **Step 6: Commit final evidence and report**

```bash
git add docs/superpowers/plans/evidence/phase-06.md
git commit -m "docs(plans): record phase 6 evidence"
git status --short
git log --oneline next..HEAD
```

Expected: clean status. Report branch, commits, every gate result, S3 decision/numbers, manual codemod items resolved, the deliberate `BagRuntime` and `kind: "bag"` decisions, and deviations in at most 60 lines.

---

## Planning-time probes and limits

The planner ran one Bun 1.4.0 file against the private archived 0.4.0 tree `/tmp/di-bag-resume-20260921/probe-07` and removed it afterward. Three tests passed: the main entry self-configured `Promise.resolve(42)`; `fork` snapshotted tuple indices before an override getter mutated the tuple; and close-state errors contained `bag is closing` then `bag is closed`. The archive remained otherwise unchanged. After controller review, a TypeScript `createSourceFile` parse-only check parsed all 45 TypeScript/JavaScript code blocks, wrapping class-member and facade-property fragments in declarations, with zero syntax diagnostics. A separate range-replacement probe passed both the shipped three-argument transform and alternate role-name/trivia output. `review-plan.py` reported 13 tasks, 70 steps, balanced fences, zero placeholders, and a complete header/self-review. No compiler program, build, docs, graph, evidence, or full test command was run during planning, so all proposed signatures and original-program transform composition remain uncompiled until execution.

## Self-review

**Spec coverage.** Tasks 1 and 2 cover S3, both derivation methods, all positive/negative inference cases, option validation, sharing, ownership, and the positional fallback. Tasks 3 and 4 cover snapshots, module export rename, and observer configuration. Tasks 5 through 7 provide the 0.4.0-to-0.5.0 codemod, golden fixture, typed/untyped migration, graph compatibility, generators, agent-eval, `AGENTS.md`, and docs sources. Tasks 8 through 10 remove every old declaration and the Node entry while retaining internal `BagRuntime`, `DiBag`, codes, and graph JSON `kind: "bag"`. Tasks 11 and 12 regenerate docs, shrink the ratchet, measure all twelve cases, audit errors/details, and run every master gate.

**Exact message inventory.** This phase intentionally replaces none of the measured assertion strings. The exact inventory is 10 occurrences of `'bag is closing'` and 5 of `'bag is closed'`; common-plan obligations move them in plan 12 (`2026-09-21-12-observability-and-errors.md`, phase 11). The plan supplies both count commands and guards the three source sites.

**Type consistency.** The one-bag overloads consistently use `Selection<ServiceRegistrations, Constraints, Keys, Operation>`, `SelectionRegistrations`, `ReboundSelected`, and `AppliedSelection`; their fields are `replacedServiceKeys`, `replacementProviders`, and `sharedParentServiceKeys`. `CreateChildContainerOptions` preserves the original registrations/shared-keys generic positions, appends defaulted constraints third, and appends replacement generics after it. Return types use `CheckedChildContainerLifetimes` and `DisjointChildContainerSelection`. The module bag always uses `currentExportKey`/`newExportKey`. Observer types always use `LifecycleObserver`, `lifecycleObservers`, `onLifecycleEvent`, and `onObserverFailure`. Codemod owners intentionally remain the 0.4.0 names.

**Placeholder scan.** The executor must substitute measured numeric evidence because planning was forbidden to run compilers; the procedure, decision rule, table columns, and fallback are complete. No implementation step delegates unspecified error handling or tests. Any `if S1/S7/S3` branch is tied to a prior evidence file and includes the exact alternative syntax.

Controller cumulative-map probe: `/tmp/di-bag-resume-20260921/cumulative-codemod/check-snapshot.mjs` used the recovered phase01/04 engine and original published0.4 declarations. Before the explicit map-target correction it emitted `app.inspect(list)`; after replacing the existing entry target it emitted `app.serviceSnapshot(list)`, with no manual rows (320MiB maximum RSS). This is a narrow checker-backed codemod probe, not a compiler diagnostic/declaration or complete accumulated-map proof.
