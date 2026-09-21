> **PARTIAL DRAFT, NOT A PLAN. Do not execute it.** A planner agent was writing this file when the account's spend limit stopped it on 2026-09-21. It holds: header, constraints, what was verified, 'State on entry', the file structure and Task 0. No implementation task is written. It was not reviewed. To finish it, give a planner this file together with `../planner-notes/common.md` and its scope note, and tell it to verify what is here before extending it. The finished plan belongs at `docs/superpowers/plans/2026-09-21-07-container-renames.md`.

# Container Renames (Phase 6) Implementation Plan

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
- `details.operation` and the method name inside a message become the 0.5.0 method name in the same commit that adds the method.
- `AGENTS.md` is at its 150-line budget, enforced by `npm run docs:check`. Every edit there replaces text inside existing lines; `wc -l AGENTS.md` must print `150` or less after each edit.
- Compile budget: instantiations of the twelve evidence cases may grow by at most 10% in total against `docs/superpowers/plans/evidence/baseline.md`, cumulatively over all phases.
- Never delete, skip or weaken a test or a negative fixture to get green. Most caught errors in tests are typed `any`, so the compiler does not flag a missed rename of an option key or an error field; use the audit greps in each task.
- Every command runs from the repository root with this environment:

```bash
export PATH="/tmp/claude-1000/-home-df-wd-personal-di-bag/7818417c-3b3a-48db-9bef-85624eff953b/scratchpad/bun/bin:$PATH"
export npm_config_update_notifier=false
bun --version   # must print 1.4.0
node --version  # must print v24.20.0
```

- Commits use Conventional Commits and end with these two lines. Commit after each task. The codemod's mechanical rewrite is its own commit whose body holds the exact command.

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
| `src/scope-selection.ts` | modify | `selectChildContainer` and `selectIndependentContainer`: read the one options bag (own properties only, unknown keys rejected, keys copied by index). Later: `selectScope` deleted |
| `src/scope-types.ts` | modify | `CreateChildContainerOptions`, `CreateIndependentContainerOptions`, `DisjointChildContainerSelection`. Later: `ScopeOptions`, `DisjointScopeSelection` deleted |
| `src/lifetime-types.ts` | modify | `CheckedScopeLifetimes` renamed to `CheckedChildContainerLifetimes` |
| `src/types.ts` | modify | `Overrides` takes the operation name for its message; default operation names follow the renames |
| `src/di-bag.ts` | modify | new methods on the class, later the class rename to `Container`, `ConfigurationOptions.lifecycleObservers`, JSDoc that feeds the API card |
| `src/module.ts`, `src/module-types.ts` | modify | `withRenamedExport({ currentExportKey, newExportKey })` and its compile-time message |
| `src/observers.ts` | modify | `LifecycleObserver { onLifecycleEvent, onObserverFailure }` |
| `src/acquisition.ts`, `src/runtime.ts` | modify | the message `container is closing` / `container is closed` (Task 9) |
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

