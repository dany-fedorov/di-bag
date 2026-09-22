# Builder Renames (Phase 5) Implementation Plan

> **Planning review accepted:** see `handoff/resume-2026-09-21.md`. Execution still requires the master plan entry state and lifted phase-gate hold; uncompiled signatures and predicted results below remain executor obligations.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every `Builder` method its 0.5.0 name and parameter shape (`withServices`, `withTokenService`, `withServiceAlias`, `withCollectionContribution`, `withReplacedService`, `withInstalledModules`, `verifyGraphAtCompileTime`, the `buildModule` bag, `buildContainer`), move every call site in the repository, and remove the 0.4.0 names.

**Architecture:** Expand, migrate, contract, as the master plan prescribes. The new methods are added to `class Builder` next to the old ones and share the old runtime paths; two-input methods read one options bag through a new own-property snapshot helper, and `withInstalledModules` folds the three per-module compile-time checks over a `const` tuple so that a rejected module is reported on its own array element. Spikes S1 (bags) and S7 (module list) are measured while both APIs exist, each with a complete fallback task list. The codemod then rewrites the typed call sites; generated-source strings, JavaScript tests, Markdown, the graph tool and the agent-eval projects are migrated by hand with exact procedures; finally the old methods are deleted.

**Tech Stack:** TypeScript 6.0.2 (`tsc6`) and 7.0.2 (`tsc`), Bun 1.4.0 (`bun test`), Node 24.20.0, `tools/codemod` (phase 1), `tools/graph`, `tools/docs`, `scripts/evidence-cases.mjs` (phase 0).

**Spec:** `docs/superpowers/specs/2026-09-20-swift-api-style.md`, sections "The standard" (rules 3 and 4), "Rename map", subsection "Builder", "Exported types" (`ModuleOptions.label`, `BuilderContribute`), "Installing a list of modules", "Shapes decided by measurement" (S1, S7) and "Acceptance". Worked examples 5, 6, 7 and 8 in `docs/superpowers/specs/2026-09-20-swift-api-style-examples.md`. Master plan: `docs/superpowers/plans/2026-09-21-00-swift-api-style-master.md`, phase 5 row. Read the master plan first: its protocol, environment, commit format, evidence rules and gate list apply to every task here. The spec's names win over anything written in this plan.

## Global Constraints

- This is phase 5 of the master plan. Branch: `phase-05-builder-renames`, cut from `next`. Executors commit on that branch only: no push, no publish, no merge, no edits to the spec's decisions.
- The names are exactly the spec's: `withServices(providersByName)`, `withTokenService({ token, provider })`, `withServiceAlias({ aliasKey, targetServiceKey })`, `withCollectionContribution({ collectionToken, provider })`, `withReplacedService({ serviceKey, provider })`, `withInstalledModules(modules)`, `verifyGraphAtCompileTime()`, `buildModule({ exportedServiceKeys, moduleLabel? })`, `buildContainer()`, the type `BuilderWithCollectionContribution`, the property `ModuleOptions.moduleLabel`. Do not shorten or vary them.
- Names that are NOT changed in this phase, even though later phases change them: the class `Bag` and everything on it (`resolve`, `inspect`, `inspectGraph`, `createScope`, `fork`), `module.renameExport`, `DiBag.token(key).of<S>()`, every facade function (`fromFactory`, `withLifetime`, `withDisposal`, ...), the type `Registration`, every runtime code. Leave every one of them alone. The word "bag" in a message or JSDoc sentence stays until phase 6.
- Parameter shape rule (spec, standard rule 4): never two positional parameters. The only exception this phase may take is a measured fallback of spike S1, recorded in `docs/guides/api-naming.md` under "Measured exceptions".
- Runtime codes do not change in this phase. An existing validation site that is reworded keeps its 0.4.0 code (`DI_BAG_INVALID_REGISTRATION`, `DI_BAG_DUPLICATE_REGISTRATION`, `DI_BAG_INVALID_ALIAS`, `DI_BAG_INVALID_REPLACEMENT`, `DI_BAG_INVALID_EXPORT`, `DI_BAG_INVALID_MODULE`); phase 11 moves it. A NEW validation site that rejects a malformed argument raises `DI_BAG_INVALID_ARGUMENT` with `details: { operation, argument, expected }` written as an object literal at the throw site, with `expected` from the closed vocabulary of plan 12 Task 9.
- Every `details.operation` value and every message that names a builder method takes the 0.5.0 method name. Two message families are not touched: `bag is closing` / `bag is closed`, and the root-captures-scoped message.
- Every runtime message keeps the form `DI_BAG_CODE: message; see <errors page>#<anchor>`. Every `'DI_BAG_*'` literal in `src/` has exactly one section in `docs/agent/errors.md` and the reverse; `npm run docs:check` enforces both directions.
- `AGENTS.md` is at its 150-line budget. An edit there must not add a line.
- The package keeps zero runtime dependencies, and `src/index.ts` must not import a `node:` module.
- Compile budget: each of the twelve evidence cases stays within +10% of `docs/superpowers/plans/evidence/baseline.md`, cumulatively over all phases.
- Never delete, skip or weaken a test or a negative fixture to get green. Most caught errors in tests are typed `any`, so the compiler does not flag a missed rename of `details.operation` or of a message: use the audit greps in each task.
- Environment for every command (master plan, "Environment"):

```bash
export PATH="<the directory that holds Bun 1.4.0>/bin:$PATH"
export npm_config_update_notifier=false
bun --version   # 1.4.0
node --version  # v24.20.0
```

- Commits use Conventional Commits and end with these two lines:

```
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
```

## What was verified while writing this plan, and what was not

The planner worked under a memory guard that forbade running the TypeScript compiler over `src` in any form, and the codemod (`tools/codemod`) did not exist yet. Read every claim below with that in mind.

**Run, with the pinned Bun 1.4.0, on one file at a time:**

- The runtime code of Tasks 1 to 4 (the options bag helper, the seven new methods, the `buildModule` bag, the list installation) was applied to a scratch copy of the 0.4.0 `src` and the test file of Task 2 was run against it in an ADAPTED form: `forCollectionOf<string>()` replaced by `of<string>()` and `.resolve(tools)` replaced by `.resolveAll(tools)`, because collection tokens arrive in phase 4 and do not exist at 0.4.0. Result: 11 pass, 0 fail, 175 `expect()` calls. The file as printed in this plan, `tests/builder-renames.test.ts`, was NOT run: it cannot run before phase 4 has landed.
- Four single-assertion mutants of that adapted file (contribution order reversed, bad element index 0 instead of 1, `reads` expected 1 instead of 0, the substituted module expected to win) each failed exactly the one intended test and nothing else. The mutants were deleted.
- Five existing 0.4.0 test files were run UNMODIFIED, with their helper files, against the prototype, to check that the expand step leaves old behavior alone: `tests/nested-modules.test.ts` 11 pass, `tests/runtime-diagnostics.test.ts` 13 pass, `tests/aliases.test.ts` 19 pass, `tests/contributions.test.ts` 13 pass, `tests/modules.test.ts` 10 pass, 0 fail in each. No other existing test file was run, and the fast lane as a whole was not.
- The graph-tool prototype was inspected and its dedicated one-file test was rerun by the finishing planner with pinned Bun 1.4.0: `tools/graph/test/builder-names.test.mjs` passed 2 tests, 0 failed. That is direct evidence only for the extractor code and fixtures printed in Task 11; it is not evidence for TypeScript signatures or the final phase tree.
- After the draft was recovered, the controller ran `node_modules/.bin/tsc6 -p tsconfig.json` once over the preserved dirty prototype: exit 0, 8.84 seconds, maximum RSS 1,173,024 KiB. The log is archived at `/tmp/di-bag-resume-20260921/probe-06/old-builder-prototype-typecheck.log`. That prototype includes the earlier positive `tests/types/builder-renames.ts` fixture, so this is evidence only that the earlier 0.4.0-adapted draft type-checked. The final Task 2 code below was subsequently corrected to derive from phase 4's collection-kind contract and is not the prototype code. `tsconfig.json` excludes `tests/types/negative` and `tests/types/isolated`, so the run establishes nothing about the printed final signatures, property-position diagnostics, list-element diagnostics, fallbacks, phase-4 integration, or the actual phase-entry tree.
- That run caught a defect in the first draft of Task 3, which is why its dispatch rule reads as it does. The draft treated every single non-array argument of `buildModule` as the new bag, so `buildModule('a')` raised `DI_BAG_INVALID_ARGUMENT` where `tests/nested-modules.test.ts` (`sealing rejects unknown keys and forged modules exactly as before`) expects the 0.4.0 message `buildModule requires a key tuple`. Now only a lone plain object is the bag, and the non-object case moves to the contract step (Task 12).
- Bun strips types without checking them, so none of this says anything about whether a signature compiles.

**Measured by reading tracked files (`git grep -o`, and a parse-only scan that builds no program and no checker):** the call-site counts in "State on entry" and in Tasks 8 and 9. `.replace(` and `.build(` counts include `String.prototype.replace` and other non-library calls, and the scan counts a call inside a comment as code, so every such number is an upper bound on what the codemod rewrites, not a prediction of its summary line.

**Not run, and why:**

- No TypeScript signature was compiled during the original drafting session. The later controller run described above compiled the recovered positive prototype only. Each signature remains marked where it stands because the executor must still compile it on the real phase-entry tree, observe every negative diagnostic position, and take the spec's fallback when a decision rule fails.
- The codemod was not run: `tools/codemod` is created by phase 1 and did not exist. What this plan says the codemod does is derived from reading the engine's source in the phase 1 plan.
- `npm run docs:generate`, `npm run docs:check`, `npm run graph:check`, the evidence cases and every gate command were not run. Statements about the API card's line budget and about generated reference pages are predictions from reading `tools/docs/lib`.
- The prototype was the 0.4.0 source, not the tree the executor starts from. Phases 2 to 4 change `src` first. Task 2 therefore prints the final phase-4-derived collection and single-service helpers; the executor confirms those exact entry contracts in Task 0 before applying the rename-only changes.

## State on entry

Phases 0 to 4 are merged into `next`. The code the planner read was still the 0.4.0 source, so every line below is derived from the master plan's phase table and the plans of phases 0 to 3, and must be confirmed with its command before Task 1. If a name differs, find the real one with `grep` and adjust only that reference; do not guess. The plan of phase 4 (`2026-09-21-05-collection-tokens.md`) was a header without tasks when this plan was written, so what phase 4 did to `contribute`, to the token-kind check and to the codemod map is confirmed here by `grep`, not by reading its plan.

| Expectation | Command | Expected |
| --- | --- | --- |
| A clean phase branch | `git switch next && git switch -c phase-05-builder-renames && git status --short` | no output |
| Pinned tools | `bun --version && node --version` | `1.4.0` and `v24.20.0` |
| Phase 2: role names inside `Builder` and `Bag` | `grep -n "^class Builder<\|^class Bag<" src/di-bag.ts` | `class Builder<Entries extends Entry, Constraints extends NeedConstraint = never>` and `class Bag<ServiceRegistrations extends Registrations, Constraints extends NeedConstraint = never>` |
| Phase 3: `buildAndStart` is gone, `ensureServicesReady` exists | `grep -c "buildAndStart" src/di-bag.ts; grep -c "ensureServicesReady" src/di-bag.ts` | `0`, then a number above 0 |
| Phase 4: collection tokens exist; `all`, `resolveAll`, `inspectAll` are gone | `grep -n "forCollectionOf" src/tokens.ts \| head -3; grep -c "resolveAll\|inspectAll" src/di-bag.ts` | at least one line, then `0` |
| Phase 4: where the token-kind check lives | `grep -n "DI_BAG_WRONG_TOKEN_KIND" src/*.ts` | the throw sites; note the helper that `register(token, ...)`, `contribute` and the alias destination call, Task 2 reuses it |
| The builder still has its 0.4.0 names | `grep -n "^  register<\|^  alias<\|^  readonly contribute:\|^  replace<\|^  installModule<\|^  verifyGraph<\|^  buildModule<\|^  build(this" src/di-bag.ts` | ten lines at 0.4.0 (measured): two `register` overloads, one `alias`, one `contribute`, two `replace` overloads, one `installModule`, one `verifyGraph`, one `buildModule`, one `build`. An earlier phase may have added an overload; what matters is that all eight names are present |
| None of the new names exists | `grep -c "withServices\|withTokenService\|withServiceAlias\|withCollectionContribution\|withReplacedService\|withInstalledModules\|verifyGraphAtCompileTime\|buildContainer" src/*.ts \| grep -v ":0"` | no output |
| The shape of `contribute` on entry | `grep -n "export type BuilderContribute" -A 6 src/contribution-types.ts` | a callable type with two parameters, a token and a registration; Task 2 moves exactly these two parameter types into one bag |
| The codemod and its shipped map | `ls tools/codemod/cli.mjs && grep -c '"owner": "Builder"' tools/codemod/rename-map.json` | the path, then a number (1 after phase 3: `buildAndStart`) |
| Which codemod fixtures run the SHIPPED map | `for d in tools/codemod/test/fixtures/*/; do [ -f "$d/input.ts" ] && [ ! -f "$d/map.json" ] && echo "$d"; done` | `build-and-start/` and `ensure-services-ready/`, plus whatever phase 4 added. Task 7 updates the `expected.ts` of every directory this prints |
| The naming ratchet still lists this phase's five entries | `grep -c "builder-method-prefix" tests/api-naming-known-violations.json` | `5` |
| The summary exception this phase deletes | `grep -c "builder-alias" tools/docs/api-card-summary-exceptions.json` | `1` |
| Evidence of the previous phase | `ls docs/superpowers/plans/evidence/` | `baseline.md` and one file per earlier phase that measured |

### The size of the migration, measured

The table counts `.name(` in tracked files at the 0.4.0 source (commit `491a33b`). `.replace(` and `.build(` also match `String.prototype.replace` and other non-library calls, so those two columns are upper bounds. Phases 3 and 4 move the numbers (phase 3 turned about 80 `buildAndStart` calls into `.build().ensureServicesReady(`; phase 4 removed the two-channel token test). Save the script below, run it on your tree before Task 8 and after Task 9, and put both tables in the phase report.

| Group | register | alias | contribute | replace | installModule | verifyGraph | buildModule | build |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `tests/*.ts` | 628 | 48 | 56 | 75 | 96 | 1 | 88 | 467 |
| `tests/<dir>/` except `types` | 13 | 1 | 2 | 0 | 1 | 0 | 2 | 7 |
| `tests/types`, positive | 244 | 18 | 18 | 46 | 86 | 2 | 85 | 165 |
| `tests/types/negative` | 396 | 33 | 35 | 48 | 105 | 3 | 104 | 173 |
| `tests/*.node.mjs` | 21 | 1 | 1 | 0 | 0 | 0 | 0 | 18 |
| `examples` | 18 | 3 | 3 | 2 | 5 | 0 | 5 | 8 |
| `scripts/agent-eval` | 21 | 0 | 0 | 4 | 20 | 9 | 8 | 12 |
| `scripts`, other | 1 | 0 | 0 | 11 | 0 | 0 | 0 | 1 |
| `tools/graph` | 15 | 0 | 0 | 0 | 10 | 0 | 8 | 9 |
| `AGENTS.md`, `docs/agent` | 74 | 3 | 6 | 4 | 16 | 17 | 12 | 41 |
| `docs/guides`, `README.md` | 65 | 3 | 5 | 2 | 14 | 1 | 12 | 47 |

There are 1,344 `createBuilder()` chains under `tests`, `examples`, `scripts` and `tools/graph`. The spec's round figures (2,000 `register`, 1,100 `build()`, 1,700 chains) are higher than what was counted here; the difference was not investigated.

```bash
mkdir -p /tmp/di-bag-phase-05 && cat > /tmp/di-bag-phase-05/count-call-sites.sh <<'SH'
#!/usr/bin/env bash
# Counts `.name(` occurrences in TRACKED files, by group. Upper bounds: `.replace(` and `.build(` also match non-library calls.
count() { git grep -oE "$1" -- "${@:2}" 2>/dev/null | wc -l; }
names="${NAMES:-register alias contribute replace installModule verifyGraph buildModule build}"
printf "%-28s" group; for name in $names; do printf " %13s" "$name"; done; echo
row() { label=$1; shift; printf "%-28s" "$label"; for name in $names; do printf " %13s" "$(count "\.${name}\(" "$@")"; done; echo; }
row "tests/*.ts"                 ':(glob)tests/*.ts'
row "tests/<dir>/ except types"  ':(glob)tests/*/**' ':(exclude,glob)tests/types/**'
row "tests/types (positive)"     ':(glob)tests/types/**' ':(exclude,glob)tests/types/negative/**'
row "tests/types/negative"       ':(glob)tests/types/negative/**'
row "tests/*.node.mjs"           ':(glob)tests/*.mjs'
row "examples"                   examples
row "scripts/agent-eval"         scripts/agent-eval
row "scripts (other)"            ':(glob)scripts/*.ts' ':(glob)scripts/*.mjs'
row "tools/graph"                tools/graph
row "AGENTS.md + docs/agent"     AGENTS.md docs/agent
row "docs/guides + README.md"    docs/guides README.md
SH
chmod +x /tmp/di-bag-phase-05/count-call-sites.sh && /tmp/di-bag-phase-05/count-call-sites.sh
# After the phase, the same script counts the new names:
# NAMES="withServices withTokenService withServiceAlias withCollectionContribution withReplacedService withInstalledModules verifyGraphAtCompileTime buildContainer" /tmp/di-bag-phase-05/count-call-sites.sh
```

### Where the codemod cannot reach

The codemod rewrites a call only when the checker resolves it to a library declaration, in a file of the program. Measured at the 0.4.0 source:

| Place | Why | Size | Task |
| --- | --- | --- | --- |
| Builder calls inside string and template literals | generated source is text | 207 calls in 15 files: `tests/package.test.ts` 43, `tests/contributions-runtime-fixture.ts` 24, `tests/plugins-runtime-fixture.ts` 22, `tests/aliases-runtime-fixture.ts` 21, `tests/observers-runtime-fixture.ts` 20, `tests/compiler.ts` 19, `tests/token-package.test.ts` 16, `tests/dependency-references-runtime-fixture.ts` 14, `tests/startup-runtime-fixture.ts` 10, `tests/selected-scope-runtime-fixture.ts` 6, `tests/composition-adapters-runtime-fixture.ts` 4, and 2 each in `tests/benchmark-compiler-ceiling.test.ts`, `tests/compiler-reuse.test.ts`, `tests/native-package.test.ts`, `scripts/verify-release-artifacts.ts` | 9 |
| `tests/*.node.mjs` | JavaScript without types | 41 calls in 2 files | 9 |
| `tests/types/isolated/thenable-policy.ts` | excluded by `tsconfig.json` and not matched by `tests/types/negative/*.ts` | 1 call: `DiBag.createBuilder().register({ users: () => new QueryBuilder() })` | 8, by a second `--extra-files` |
| `scripts/agent-eval` | outside `tsconfig.json`; the skeleton and reference projects import `di-bag` from their own install | 70 library calls: `reference` 32, `hidden` 28, `skeleton` 10. The table above shows 74 for this group because its four `.replace(` matches are all `String.prototype.replace` (`lib/harness.mjs`, `skeleton/resolve-ts.mjs`, `test/harness.test.mjs` twice); leave those four alone | 10 |
| `tools/graph/test/fixtures` | outside `tsconfig.json`, and kept at 0.4.0 on purpose: they prove the extractor still reads 0.4.0 chains | 41 calls; the one other match under `tools/graph` is a comment in `lib/extract.mjs` | 11 |
| `AGENTS.md`, `docs/agent/*.md` | Markdown; checked by `npm run docs:check` | 108 mentions to edit by hand: `docs/agent/errors.md` 68, `docs/agent/recipes.md` 34, `AGENTS.md` 6. The other 65 of the 173 in the table are in `docs/agent/api-card.md`, which is generated from JSDoc and never edited | 12 |
| `docs/guides`, `README.md` | Markdown; rewritten in phase 12, except the layout block that `AGENTS.md` must copy byte for byte | 149 mentions | 12, one block only |

The scan that produced the first row parses each file alone with `ts.createSourceFile`; it builds no program. Task 9 contains it, so the numbers can be reproduced on the entry tree.

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `src/options-bag.ts` | create | `snapshotOptionsBag`: reads the own properties of an options bag once; the first `DI_BAG_INVALID_ARGUMENT` site of the builder |
| `src/install-types.ts` | create | the compile-time fold of `withInstalledModules` over a module tuple (spike S7) |
| `src/di-bag.ts` | modify | the nine 0.5.0 builder methods next to the old ones (expand), then the old ones deleted (contract) |
| `src/contribution-types.ts` | modify | `BuilderWithCollectionContribution`; `BuilderContribute` deleted in the contract step |
| `src/module.ts` | modify | `ModuleOptions.moduleLabel`, the label check, `moduleGraph` naming the bad list element |
| `src/runtime.ts`, `src/aliases.ts`, `src/registration.ts`, `src/provider-operations.ts` | modify | `details.operation` and messages take the new method names |
| `src/types.ts`, `src/alias-types.ts` | modify (contract) | compile-time messages that name `register`, `replace`, `alias` |
| `src/index.ts` | modify | export `BuilderWithCollectionContribution` in place of `BuilderContribute` |
| `tests/builder-renames.test.ts` | create | runtime tests of the new methods (fast lane) |
| `tests/types/builder-renames.ts`, `tests/types/negative/builder-renames.ts`, `tests/types/negative/installed-modules.ts` | create | compiler fixtures: bags, the `buildModule` bag, the module list, errors on the offending property and element |
| `tests/compiler.ts`, `scripts/check-token-scale.ts` | modify | generators emit 0.5.0 calls; a `module-list` form for S7 |
| `tools/codemod/rename-map.json`, `tools/codemod/test/fixtures/builder-renames/`, the `expected.ts` of every fixture that runs the shipped map, `tools/codemod/test/cli.test.mjs` | modify, create | map entries and their fixture |
| `tools/graph/lib/extract.mjs`, `tools/graph/test/fixtures/builder-names-0-5.ts`, `tools/graph/test/extract.test.mjs`, `tools/graph/README.md` | modify, create | the extractor reads both generations of names and shapes |
| `scripts/agent-eval/reference`, `skeleton`, `hidden` | modify | 70 call sites by hand |
| `AGENTS.md`, `docs/guides/examples-modularity.md` (layout block only), `docs/agent/recipes.md`, `docs/agent/errors.md`, `tools/docs/api-card-tasks.json`, `tools/docs/api-card-summary-exceptions.json`, `tools/docs/test/api-card.test.mjs`, `tools/docs/test/exact-rendering.test.mjs`, `docs/guides/api-reference.md` (one row) | modify | documentation that `npm run docs:check` verifies |
| `tests/types/negative/api-renaming.ts`, `tests/api-naming-known-violations.json` | modify | removed names fail to compile; the ratchet shrinks by five |
| `docs/superpowers/plans/evidence/phase-05.md` | create | spike numbers, decisions, the twelve cases |

Tasks 4 through 11 are the master plan's explicit generated-documentation exception. While both builder generations are public, generation is predicted to exceed the unchanged 400-line API-card budget and the generated output becomes stale. This prediction was not measured on the phase-entry tree. Before the first exception commit, run `npm run docs:generate` and `npm run docs:check` separately, retain both outputs, and confirm every failure falls within that documentation-only scope. If they pass, keep that commit green and omit its red-state paragraph; other failures require repair. Those eight commits may be red for those two documentation commands only; every applicable source, runtime, compiler, codemod, agent-eval, and graph check in their task must pass. Each commit body names this exception. Do not hide either API generation or relax the budget. Tasks 12 and 13 contract the source and regenerate documentation in one green commit before merge; Task 14 runs the unchanged final gates. The phase report lists all eight commit hashes with their observed status and gives only the red hashes that `git bisect` must skip. Revalidate the exception when its failure changes; no hypothetical failure is evidence.

---

### Task 0: Branch, entry check, starting counts

**Files:** none.

- [ ] **Step 1: Create the branch and confirm the state on entry**

Run every command of the "State on entry" table. Stop and report to the controller if `buildAndStart` still exists, if `forCollectionOf` does not, or if any new name already exists.

- [ ] **Step 2: Record the starting counts**

Save and run `/tmp/di-bag-phase-05/count-call-sites.sh` from "State on entry". Keep its output for the report.

---

### Task 1: The options bag helper

**Files:**
- Create: `src/options-bag.ts`
- Modify: `docs/agent/errors.md` (only when the section does not exist yet)
- Test: `tests/builder-renames.test.ts` (Task 2 adds the tests that reach it through the public methods)

**Interfaces:**
- Produces: `snapshotOptionsBag(options: unknown, operation: string, required: readonly string[], optional?: readonly string[], inspectValue?: (name: string, value: unknown) => void): Record<string, unknown>`. It throws `DI_BAG_INVALID_ARGUMENT` with `details: { operation, argument, expected }`: `argument: 'options'`, `expected: 'an object'` for a non-null, non-array non-object; `argument: 'options'`, `expected: 'only the own properties: a, b'` for an unknown own key, a symbol key, or a supported property inherited rather than owned; `argument: '<name>'`, `expected: 'present'` for a missing required property. It reads each property once, after all shape checks pass. `inspectValue` runs immediately after each property read and before the next property, which lets a token-kind failure stop before the provider getter is read. Phases 6 and 8 reuse it for their bags.

- [ ] **Step 1: Create the helper**

Create `src/options-bag.ts`:

```ts
import { libraryError } from './errors';

/**
 * Snapshot the own properties of an options bag once, before any value is used.
 * Unknown own or symbol-keyed properties are rejected. A supported property supplied
 * only by the prototype is rejected, so an accessor cannot substitute it for an own value.
 * Every listed property is read exactly once, in the order `required` then `optional`.
 */
export function snapshotOptionsBag(
  options: unknown,
  operation: string,
  required: readonly string[],
  optional: readonly string[] = [],
  inspectValue?: (name: string, value: unknown) => void,
): Record<string, unknown> {
  const supported = [...required, ...optional];
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    throw libraryError('DI_BAG_INVALID_ARGUMENT', `${operation} requires one options object`, { operation, argument: 'options', expected: 'an object' });
  }
  for (const key of Reflect.ownKeys(options)) {
    if (typeof key !== 'string' || !supported.includes(key)) {
      throw libraryError('DI_BAG_INVALID_ARGUMENT', `${operation} does not accept the option ${String(key)}`, { operation, argument: 'options', expected: `only the own properties: ${supported.join(', ')}` });
    }
  }
  for (const name of supported) {
    if (name in options && !Object.hasOwn(options, name)) {
      throw libraryError('DI_BAG_INVALID_ARGUMENT', `${operation} reads own properties only: ${name} is inherited`, { operation, argument: 'options', expected: `only the own properties: ${supported.join(', ')}` });
    }
  }
  for (const name of required) {
    if (!Object.hasOwn(options, name)) {
      throw libraryError('DI_BAG_INVALID_ARGUMENT', `${operation} requires the option ${name}`, { operation, argument: name, expected: 'present' });
    }
  }
  const snapshot: Record<string, unknown> = Object.create(null);
  for (const name of supported) {
    if (Object.hasOwn(options, name)) {
      const value = Reflect.get(options, name);
      inspectValue?.(name, value);
      snapshot[name] = value;
    }
  }
  return snapshot;
}
```

This exact file ran in the planner's prototype. `libraryError` lives in `src/errors.ts` and its first parameter is the template type `` `DI_BAG_${string}` ``, so a new code needs no declaration.

- [ ] **Step 2: Give the code its section, unless an earlier phase already did**

Run: `grep -c "^### DI_BAG_INVALID_ARGUMENT " docs/agent/errors.md`

If it prints `1`, skip this step. If it prints `0`, this phase is the first to raise the code, and `npm run docs:check` requires a section for every code that `src` raises. Insert the section below directly before the heading `### DI_BAG_INVALID_CLASSIFIER_RESULT`, which at 0.4.0 follows `### DI_BAG_INVALID_ALIAS`; the 22 `DI_BAG_INVALID_` sections are kept in alphabetical order by convention. `npm run docs:check` checks that each code has a section, not where it stands, and the page as a whole is not strictly sorted (`DI_BAG_CLOSED` is out of byte order), so confirm the neighbours with `grep -n "^### DI_BAG_INVALID_" docs/agent/errors.md` and do not reorder anything else. The text is the one plan 12 (Task 9 Step 6) fixes for this code, with one change: its example there calls `DiBag.createProvider`, which does not exist before phase 8, and examples on this page are type-checked, so the example here uses a call of this phase. The example was not compiled by the planner. If `npm run docs:check` rejects it in Task 13, keep the prose and fix the example; phase 11 replaces it with plan 12's.

````markdown
### DI_BAG_INVALID_ARGUMENT {#di-bag-invalid-argument}

**When:** a call receives an argument of the wrong shape: a factory that is not a
function, an options bag that is not an object or holds an unknown property, an
option of the wrong type, a value outside a fixed set. Every public method
raises it, some as a `TypeError`.

**Cause:** the call site is not type-checked, or a cast silenced the compiler,
which rejects every one of these. `details` says exactly what was wrong:
`operation` is the method, `argument` is the parameter or option (a dotted path
for a nested option, `[]` for an element of a list), and `expected` completes
the sentence "must be ...".

**Fix:** branch on `details.argument`, not on the message. Remove the cast and
let the compiler point at the argument.

```ts
import { DiBag } from 'di-bag';

try {
  DiBag.createBuilder().withInstalledModules('not a list' as never);
} catch (error) {
  const { operation, argument, expected } = (error as { details: Record<string, unknown> }).details;
  console.error(`${String(operation)}: ${String(argument)} must be ${String(expected)}`);
}
```
````

- [ ] **Step 3: Leave the helper and error section uncommitted**

The helper has no caller yet, and the checked error-page example uses the expand API completed by Task 4. Leave both files uncommitted, continue through Tasks 2 to 4, and include them in Task 4's expand commit after its applicable runtime and compiler checks pass. That commit uses the explicit generated-documentation exception above; Tasks 12 and 13 later verify this example with the contracted public surface.

---

### Task 2: `withServices`, the four bag methods, `verifyGraphAtCompileTime`, `buildContainer` (expand, spike S1)

**Files:**
- Modify: `src/di-bag.ts`, `src/contribution-types.ts`, `src/alias-types.ts`, `src/aliases.ts`, `src/token-types.ts`, `src/tokens.ts`, `src/provider.ts`, `src/registration.ts`, `src/provider-operations.ts`, `src/contributions.ts`, `src/index.ts`
- Test: `tests/builder-renames.test.ts` (create; Tasks 3 and 4 make its last five tests pass)

**Interfaces:**
- Consumes: `snapshotOptionsBag` from Task 1. The helpers the old methods already call: `snapshotAdd`, `readTokenKey`, `withTokenBinding`, `aliasEntry`, `contributionEntry`, `normalize`.
- Produces, on `class Builder<Entries, Constraints>`: `withServices(providersByName)`, `withTokenService({ token, provider })`, `withServiceAlias({ aliasKey, targetServiceKey })`, the readonly property `withCollectionContribution` typed `BuilderWithCollectionContribution<Entries, Constraints>`, `withReplacedService({ serviceKey, provider })` with its zero-dependency overload first, `verifyGraphAtCompileTime()`, `buildContainer()`. The old methods stay until Task 12.

**Historical evidence does not compile these final signatures.** An earlier 0.4.0-adapted version moved the old parameter types into `options` properties and compiled its positive fixture. The signatures printed below additionally incorporate phase 4's collection-kind admissions and have not met the compiler on the phase-entry tree or any negative property-position fixture. Task 5 holds the positive and negative cases that must hold, and Task 6 the fallback per method.

- [ ] **Step 1: Write the failing test**

Create `tests/builder-renames.test.ts`. It uses the API as it is on entry to this phase: `DiBag.token(key).of<S>()` and `forCollectionOf<Item>()`, `bag.resolve(collectionToken)` for a list, `bag.inspectGraph()`, `import ... from '../src/node'` (phase 6 moves the import). An adapted copy (`of<string>()` for `forCollectionOf<string>()`, `resolveAll(tools)` for `resolve(tools)`) passed against the planner's prototype: 11 pass, 175 `expect()` calls. This file itself was never run.

```ts
// tests/builder-renames.test.ts
// Runtime behavior of the 0.5.0 builder methods: the options bags, the module list, and the renamed terminals.
import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';

type Clock = { now(): number };
type Failure = Error & { code?: string; details?: Record<string, unknown> };
const clockKey = Symbol('clock');
const clock = DiBag.token(clockKey).of<Clock>();
const toolsKey = Symbol('tools');
const tools = DiBag.token(toolsKey).forCollectionOf<string>();
const tool = DiBag.token(Symbol('tool')).of<string>();

function caught(run: () => unknown): Failure {
  try { run(); } catch (error) { return error as Failure; }
  throw new Error('expected the call to throw');
}
// The malformed calls below do not type-check on purpose; `loose` reaches the runtime validation.
const loose = (builder: object) => builder as Record<string, (...args: unknown[]) => any>;

test('the renamed builder methods build the same graph as their 0.4.0 forms', async () => {
  const app = DiBag.createBuilder()
    .withServices({ config: () => ({ url: 'memory:' }) })
    .withTokenService({ token: clock, provider: (): Clock => ({ now: () => 1 }) })
    .withServiceAlias({ aliasKey: 'now', targetServiceKey: clock })
    .withCollectionContribution({ collectionToken: tools, provider: () => 'search' })
    .withCollectionContribution({ collectionToken: tools, provider: () => 'fetch' })
    .withReplacedService({ serviceKey: 'config', provider: () => ({ url: 'replaced:' }) })
    .withReplacedService({ serviceKey: clock, provider: (): Clock => ({ now: () => 2 }) })
    .buildContainer();
  expect(app.resolve('config')).toEqual({ url: 'replaced:' });
  expect(app.resolve(clock).now()).toBe(2);
  expect(app.resolve('now')).toBe(app.resolve(clock));
  expect(app.resolve(tools)).toEqual(['search', 'fetch']);
  await app.close();
});

test('withReplacedService preserves fresh frozen collection read views', async () => {
  const owned: readonly string[] = ['file', 'syslog'];
  const app = DiBag.createBuilder()
    .withCollectionContribution({ collectionToken: tools, provider: () => 'ignored' })
    .withServices({ joined: DiBag.fromFunction([tools], (list: readonly string[]) => list.join('+')) })
    .withReplacedService({ serviceKey: tools, provider: () => owned })
    .buildContainer();
  const first = app.resolve(tools);
  const second = app.resolve(tools);
  expect(first).toEqual(owned);
  expect(first).not.toBe(owned);
  expect(Object.isFrozen(first)).toBe(true);
  expect(second).not.toBe(first);
  expect(app.resolve('joined')).toBe('file+syslog');
  await app.close();
});

test('every builder method returns a new builder and leaves the receiver unchanged', async () => {
  const base = DiBag.createBuilder().withServices({ value: () => 1 });
  const extended = base.withServices({ other: () => 2 });
  expect(extended).not.toBe(base);
  const app = base.buildContainer();
  expect(() => loose(app).resolve('other')).toThrow("DI_BAG_MISSING_REGISTRATION");
  expect(base.verifyGraphAtCompileTime()).toBeUndefined();
  await app.close();
});

test('a two-input builder method rejects a malformed options bag before it reads a value', () => {
  const builder = DiBag.createBuilder().withServices({ value: () => 1 });
  const cases: readonly [string, readonly string[]][] = [
    ['withTokenService', ['token', 'provider']],
    ['withServiceAlias', ['aliasKey', 'targetServiceKey']],
    ['withCollectionContribution', ['collectionToken', 'provider']],
    ['withReplacedService', ['serviceKey', 'provider']],
  ];
  for (const [operation, [first, second]] of cases) {
    const call = (options: unknown) => caught(() => loose(builder)[operation]!(options));
    for (const options of [undefined, null, 42, 'text', [], () => 1]) {
      const error = call(options);
      expect(error.code).toBe('DI_BAG_INVALID_ARGUMENT');
      expect(error.details).toEqual({ operation, argument: 'options', expected: 'an object' });
      expect(error.message).toBe(`DI_BAG_INVALID_ARGUMENT: ${operation} requires one options object; see https://dany-fedorov.github.io/di-bag/agent/errors.html#di-bag-invalid-argument`);
    }
    const onlyOwn = { operation, argument: 'options', expected: `only the own properties: ${first}, ${second}` };
    let reads = 0;
    const unknownOption = { get [first!]() { reads++; return clock; }, [second!]: () => 1, extra: true };
    expect(call(unknownOption).details).toEqual(onlyOwn);
    expect(call({ [first!]: clock, [second!]: () => 1, [Symbol('hidden')]: true }).details).toEqual(onlyOwn);
    expect(call(Object.create({ [first!]: clock, [second!]: () => 1 })).details).toEqual(onlyOwn);
    expect(call({ [first!]: clock }).details).toEqual({ operation, argument: second, expected: 'present' });
    expect(call({ [second!]: () => 1 }).details).toEqual({ operation, argument: first, expected: 'present' });
    expect(reads).toBe(0);
  }
});

test('an options bag is read once, so an accessor cannot change the call after validation', async () => {
  let reads = 0;
  const options = { token: clock, get provider() { reads++; return reads === 1 ? (): Clock => ({ now: () => 7 }) : 42; } };
  const app = loose(DiBag.createBuilder()).withTokenService!(options).buildContainer();
  expect(reads).toBe(1);
  expect(app.resolve(clock).now()).toBe(7);
  await app.close();
});

test('renamed methods preserve the collection-token kind boundary before reading later properties', () => {
  const single = DiBag.token(Symbol('single')).of<number>();
  const collection = DiBag.token(Symbol('collection')).forCollectionOf<number>();
  let laterReads = 0;
  const cases: readonly [() => unknown, string, 'single-service' | 'collection', 'single-service' | 'collection', string][] = [
    [
      () => loose(DiBag.createBuilder()).withTokenService!({ token: collection, get provider() { laterReads++; return () => []; } }),
      'withTokenService', 'single-service', 'collection', 'Symbol(collection)',
    ],
    [
      () => loose(DiBag.createBuilder()).withCollectionContribution!({ collectionToken: single, get provider() { laterReads++; return () => 1; } }),
      'withCollectionContribution', 'collection', 'single-service', 'Symbol(single)',
    ],
    [
      () => loose(DiBag.createBuilder()).withServiceAlias!({ aliasKey: collection, get targetServiceKey() { laterReads++; return 'missing'; } }),
      'withServiceAlias', 'single-service', 'collection', 'Symbol(collection)',
    ],
  ];
  for (const [run, operation, expectedKind, receivedKind, key] of cases) {
    const error = caught(run);
    expect(error.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
    expect(error.details).toEqual({ operation, expectedKind, receivedKind });
    expect(error.message).toBe(`DI_BAG_WRONG_TOKEN_KIND: ${operation} requires a ${expectedKind} token, but ${key} is a ${receivedKind} token; see https://dany-fedorov.github.io/di-bag/agent/errors.html#di-bag-wrong-token-kind`);
  }
  expect(laterReads).toBe(0);
});

test('the bag methods keep the 0.4.0 codes of the checks they share, under their own operation names', () => {
  const builder = DiBag.createBuilder()
    .withServices({ value: () => 1 })
    .withTokenService({ token: clock, provider: (): Clock => ({ now: () => 1 }) });
  const checks: readonly [() => unknown, string, Record<string, unknown>][] = [
    [() => loose(builder).withServices!({ value: () => 2 }), 'DI_BAG_DUPLICATE_REGISTRATION', { operation: 'withServices', key: 'value' }],
    [() => loose(builder).withServices!(42), 'DI_BAG_INVALID_REGISTRATION', { operation: 'withServices' }],
    [() => loose(builder).withTokenService!({ token: clock, provider: () => ({ now: () => 2 }) }), 'DI_BAG_DUPLICATE_REGISTRATION', { operation: 'withTokenService', key: clockKey }],
    [() => loose(builder).withServiceAlias!({ aliasKey: 'value', targetServiceKey: clock }), 'DI_BAG_DUPLICATE_REGISTRATION', { operation: 'withServiceAlias', key: 'value' }],
    [() => loose(builder).withServiceAlias!({ aliasKey: 'other', targetServiceKey: 'absent' }), 'DI_BAG_INVALID_ALIAS', { operation: 'withServiceAlias', target: 'absent' }],
    [() => loose(builder).withReplacedService!({ serviceKey: 'absent', provider: () => 1 }), 'DI_BAG_INVALID_REPLACEMENT', { operation: 'withReplacedService', key: 'absent' }],
    [() => loose(DiBag.createBuilder()).withTokenService!({ token: clock, provider: 42 }), 'DI_BAG_INVALID_REGISTRATION', { operation: 'withTokenService' }],
    [() => loose(DiBag.createBuilder()).withCollectionContribution!({ collectionToken: tools, provider: 42 }), 'DI_BAG_INVALID_REGISTRATION', { operation: 'withCollectionContribution' }],
    [() => loose(builder).withReplacedService!({ serviceKey: 'value', provider: 42 }), 'DI_BAG_INVALID_REGISTRATION', { operation: 'withReplacedService' }],
  ];
  for (const [run, code, details] of checks) {
    const error = caught(run);
    expect(error.code).toBe(code);
    expect(error.details).toEqual(details);
  }
  expect(caught(() => loose(builder).withServiceAlias!({ aliasKey: 'other', targetServiceKey: 'absent' })).message).toContain('withServiceAlias requires an existing named target');
  expect(caught(() => loose(builder).withReplacedService!({ serviceKey: 'absent', provider: () => 1 })).message).toContain('withReplacedService accepts existing names or typed tokens only: absent');
  expect(caught(() => loose(builder).withTokenService!({ token: { key: clockKey }, provider: () => 1 })).code).toBe('DI_BAG_INVALID_TOKEN');
});

test('withInstalledModules installs in list order, and contributions follow that order', async () => {
  const contributing = (name: string) => DiBag.createBuilder()
    .withServices({ [`${name}Name`]: () => name } as Record<string, () => string>)
    .withCollectionContribution({ collectionToken: tools, provider: () => name })
    .buildModule({ exportedServiceKeys: [] as const, moduleLabel: name });
  const first = contributing('first');
  const second = contributing('second');
  const third = contributing('third');
  const listed = DiBag.createBuilder().withInstalledModules([first, second, third]).buildContainer();
  const reversed = DiBag.createBuilder().withInstalledModules([third, second, first]).buildContainer();
  const separate = DiBag.createBuilder().withInstalledModules([first]).withInstalledModules([second]).withInstalledModules([third]).buildContainer();
  expect(listed.resolve(tools)).toEqual(['first', 'second', 'third']);
  expect(reversed.resolve(tools)).toEqual(['third', 'second', 'first']);
  expect(separate.resolve(tools)).toEqual(['first', 'second', 'third']);
  expect(listed.inspectGraph().bindings.map(binding => binding.label)).toEqual(separate.inspectGraph().bindings.map(binding => binding.label));
  await Promise.all([listed.close(), reversed.close(), separate.close()]);
});

test('a module of the list may require what a later module or the host provides', async () => {
  const consumer = DiBag.createBuilder()
    .withServices({ report: ({ logger, name }: { logger: (line: string) => string; name: string }) => logger(name) })
    .buildModule({ exportedServiceKeys: ['report'], moduleLabel: 'consumer' });
  const logging = DiBag.createBuilder()
    .withServices({ prefix: () => '[log] ', logger: ({ prefix }: { prefix: string }) => (line: string) => prefix + line })
    .buildModule({ exportedServiceKeys: ['logger'] });
  const app = DiBag.createBuilder().withInstalledModules([consumer, logging]).withServices({ name: () => 'Ada' }).buildContainer();
  expect(app.resolve('report')).toBe('[log] Ada');
  expect(DiBag.createBuilder().withInstalledModules([]).buildContainer().inspectGraph().bindings).toEqual([]);
  await app.close();
});

test('withInstalledModules rejects a bad list as a whole and names the bad element', () => {
  const logging = DiBag.createBuilder().withServices({ logger: () => 1 }).buildModule({ exportedServiceKeys: ['logger'] });
  const other = DiBag.createBuilder().withServices({ other: () => 2 }).buildModule({ exportedServiceKeys: ['other'] });
  const host = DiBag.createBuilder().withServices({ taken: () => 0 });
  const install = (modules: unknown) => caught(() => loose(host).withInstalledModules!(modules));

  for (const modules of [undefined, null, 42, 'modules', {}, logging, new Set([logging])]) {
    const error = install(modules);
    expect(error.code).toBe('DI_BAG_INVALID_ARGUMENT');
    expect(error.details).toEqual({ operation: 'withInstalledModules', argument: 'modules', expected: 'an array' });
  }
  const notAModule = install([logging, {}, other]);
  expect(notAModule.code).toBe('DI_BAG_INVALID_MODULE');
  expect(notAModule.details).toEqual({ operation: 'withInstalledModules', index: 1 });
  expect(notAModule.message).toContain('withInstalledModules requires genuine modules: element 1 is not one');
  expect(install([logging, 42]).details).toEqual({ operation: 'withInstalledModules', index: 1 });
  // A hole reads as undefined, which is not a module.
  expect(install([logging, , other]).details).toEqual({ operation: 'withInstalledModules', index: 1 });

  // Two modules of one list export the same name: the second is the duplicate.
  const twice = install([logging, other, logging]);
  expect(twice.code).toBe('DI_BAG_DUPLICATE_REGISTRATION');
  expect(twice.details).toEqual({ operation: 'withInstalledModules', key: 'logger' });
  // A module export collides with the host.
  const colliding = DiBag.createBuilder().withServices({ taken: () => 1 }).buildModule({ exportedServiceKeys: ['taken'] });
  expect(install([other, colliding]).details).toEqual({ operation: 'withInstalledModules', key: 'taken' });
  // Builders are immutable: the host is still usable and still has one service.
  const app = host.buildContainer();
  expect(app.inspectGraph().bindings.map(binding => binding.label)).toEqual(['taken']);
});

test('withInstalledModules snapshots the list by index, so an iterator or a later write cannot substitute modules', async () => {
  const genuine = DiBag.createBuilder().withServices({ value: () => 'genuine' }).buildModule({ exportedServiceKeys: ['value'] });
  const substitute = DiBag.createBuilder().withServices({ value: () => 'substitute' }).buildModule({ exportedServiceKeys: ['value'] });
  const modules = [genuine];
  modules[Symbol.iterator] = function* () { yield substitute; };
  const builder = loose(DiBag.createBuilder()).withInstalledModules!(modules);
  modules[0] = substitute;
  const app = builder.buildContainer();
  expect(app.resolve('value')).toBe('genuine');
  await app.close();
});

test('buildModule takes one bag, and the module label names private bindings', async () => {
  const orders = DiBag.createBuilder()
    .withServices({ repository: () => new Map<string, number>() })
    .withServices({ placeOrder: ({ repository }: { repository: Map<string, number> }) => (id: string) => repository.set(id, 1).size })
    .buildModule({ exportedServiceKeys: ['placeOrder'], moduleLabel: 'orders' });
  const app = DiBag.createBuilder().withInstalledModules([orders]).buildContainer();
  expect(app.resolve('placeOrder')('a')).toBe(1);
  expect(app.inspectGraph().bindings.map(binding => binding.label).sort()).toEqual(['orders/repository', 'placeOrder']);
  await app.close();
  const builder = DiBag.createBuilder().withServices({ value: () => 1 });
  expect(() => builder.buildModule({ exportedServiceKeys: ['value'] })).not.toThrow();
  expect(() => loose(builder).buildModule!({ exportedServiceKeys: ['value'], moduleLabel: undefined })).not.toThrow();
  expect(() => builder.buildModule({ exportedServiceKeys: [] })).not.toThrow();
});

test('buildModule rejects a malformed bag, a malformed key list and a malformed moduleLabel', () => {
  const builder = DiBag.createBuilder().withServices({ value: () => 1 });
  const seal = (options: unknown) => caught(() => loose(builder).buildModule!(options));
  // A lone value that is not a plain object still means the 0.4.0 form while both forms exist; Task 12 adds that case.
  const onlyOwn = { operation: 'buildModule', argument: 'options', expected: 'only the own properties: exportedServiceKeys, moduleLabel' };
  expect(seal({ exportedServiceKeys: ['value'], label: 'orders' }).details).toEqual(onlyOwn);
  expect(seal(Object.create({ exportedServiceKeys: ['value'] })).details).toEqual(onlyOwn);
  expect(seal({ moduleLabel: 'orders' }).details).toEqual({ operation: 'buildModule', argument: 'exportedServiceKeys', expected: 'present' });
  for (const moduleLabel of ['', 1, null, {}]) {
    const error = seal({ exportedServiceKeys: ['value'], moduleLabel });
    expect(error.code).toBe('DI_BAG_INVALID_EXPORT');
    expect(error.details).toEqual({ operation: 'buildModule', option: 'moduleLabel' });
    expect(error.message).toContain('buildModule moduleLabel must be a non-empty string');
  }
  const notATuple = seal({ exportedServiceKeys: 'value' });
  expect(notATuple.code).toBe('DI_BAG_INVALID_EXPORT');
  expect(notATuple.details).toEqual({ operation: 'buildModule' });
  expect(seal({ exportedServiceKeys: ['absent'] }).code).toBe('DI_BAG_INVALID_EXPORT');
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `bun test tests/builder-renames.test.ts`
Expected: `0 pass`, `13 fail`. Every test reaches at least one renamed method that is absent. This count is predicted from the printed thirteen-test file; the historical adapted copy predated the collection-kind and collection-replacement read-view tests and measured `0 pass`, `11 fail`.

- [ ] **Step 3: Let the shared helpers name the calling method**

During the expand step two generations of methods share each helper, so the helper takes the operation name. Task 12 removes the compatibility form again.

In `src/registration.ts`, change the signature of `snapshotAdd` and its three throw sites:

```ts
export function snapshotAdd(more: unknown, hasKey: (key: string) => boolean, operation: 'register' | 'withServices' = 'register'): Registrations {
```

and replace `{ operation: 'register' }` (twice) with `{ operation }` and `{ operation: 'register', key }` (once) with `{ operation, key }`. Check: `grep -c "operation: 'register'" src/registration.ts` prints `0`.

In `src/aliases.ts`, change the signature of `aliasEntry` and its two throw sites:

```ts
export function aliasEntry(destination: unknown, target: unknown, hasKey: (key: BindingKey) => boolean, operation: 'alias' | 'withServiceAlias' = 'alias'): readonly [BindingKey, Registration] {
```

`{ operation: 'alias', key }` becomes `{ operation, key }`, and the second throw becomes:

```ts
  if (typeof target === 'string' && !hasKey(targetKey)) throw libraryError('DI_BAG_INVALID_ALIAS', `${operation} requires an existing named target`, { operation, target: targetKey });
```

With `operation` left at its default both helpers produce exactly the 0.4.0 messages and details, so no existing test changes. The complete phase-4-derived `aliasEntry` below passes `operation` to its single-service destination check.

Phase 4's final collection contract is binding here: `CollectionTokenBase`, `CollectionBindingOutput`, `RegisterTokenAdmission`, `readToken`, `readSingleServiceKey` and `wrongTokenKind` already exist. Do not substitute `TokenBase`, `BindingOutput` or `readTokenKey` in the new collection/single-service paths.

In `src/provider-operations.ts`, thread the caller name through invalid-provider normalization while keeping old callers stable:

```ts
export function describe(registration: unknown, operation = 'register'): ProviderDescription {
  if (typeof registration === 'function') return sourceDescription(registration as Factory);
  if (typeof registration === 'object' && registration !== null) {
    const description = descriptions.get(registration);
    if (description) return description;
  }
  throw libraryError('DI_BAG_INVALID_REGISTRATION', 'invalid factory registration', { operation });
}

export function normalize(registration: unknown, operation = 'register'): {
  lifetime: LifetimePolicy;
  alias?: string | symbol;
  create: Factory;
  acquisitionMode: AcquisitionMode;
  tokenKeys: readonly symbol[];
  references: readonly ArgumentReference[];
  contextual: boolean;
  dispose?: (value: never) => void | Promise<void>;
  metadata: Readonly<object>;
  operations: readonly ProviderOperation[];
} {
  const description = describe(registration, operation);
  const { create, dispose, tokenKeys, references, acquisitionMode, contextual } = description.source;
  const { metadata, operations, lifetime } = description;
  const alias = description.alias === undefined ? {} : { alias: description.alias };
  return dispose
    ? { ...alias, create, dispose, tokenKeys, references, acquisitionMode, metadata, operations, lifetime, contextual }
    : { ...alias, create, tokenKeys, references, acquisitionMode, metadata, operations, lifetime, contextual };
}
```

In `snapshotAdd`, call `normalize(registration, operation)`. In `src/provider.ts`, add a final optional parameter to the existing `withTokenBinding` signature and use it only when reading the provider description:

```ts
export function withTokenBinding<T extends TokenBase, R extends Registration>(
  token: T & TokenTupleAdmission<readonly [T]>,
  registration: R & Registration & BindingOutput<NoInfer<T>, NoInfer<R>>,
  operation = 'register',
): Provider<ProviderFactory<R>, RetainedMetadata<R>, ProviderAcquisitionMetadata<R>, ReboundGraph<ProviderGraphContract<R>, T>, ProviderAcquiredValue<R>> {
  readTokenKey(token);
  const handle = new Provider<ProviderFactory<R>, RetainedMetadata<R>, ProviderAcquisitionMetadata<R>, ReboundGraph<ProviderGraphContract<R>, T>, ProviderAcquiredValue<R>>();
  retainDescription(handle, describe(registration, operation));
  return handle;
}
```

Copy the exact return type and `BindingOutput` spelling from phase 4 if it differs only by an equivalent alias; the behavioral change is the `operation` parameter and `describe(registration, operation)`. The old `register` call omits it. `withTokenService` passes `'withTokenService'`.

In `src/contributions.ts`, preserve collection authentication and change only the caller label:

```ts
export function contributionEntry(token: unknown, registration: Registration, operation: 'contribute' | 'withCollectionContribution' = 'contribute'): readonly [symbol, Registration] {
  const { key, kind } = readToken(token);
  if (kind !== 'collection') throw wrongTokenKind(operation, 'collection', key);
  normalize(registration, operation);
  return Object.freeze([key, registration]);
}
```

In `src/aliases.ts`, preserve phase 4's collection-capable target and authenticate only the destination as single-service. Change its exact body to accept the operation:

```ts
const collectionAliasLifetime = Object.freeze({
  kind: 'transient' as const,
  allowScopedDependencies: false,
});

export function aliasEntry(destination: unknown, target: unknown, hasKey: (key: BindingKey) => boolean, operation: 'alias' | 'withServiceAlias' = 'alias'): readonly [BindingKey, Registration] {
  const key = typeof destination === 'string'
    ? destination
    : readSingleServiceKey(destination, operation);
  const targetToken = typeof target === 'string' ? undefined : readToken(target);
  const targetKey = targetToken === undefined ? target as string : targetToken.key;
  if (hasKey(key)) {
    throw libraryError(
      'DI_BAG_DUPLICATE_REGISTRATION',
      `duplicate registration: ${String(key)}`,
      { operation, key },
    );
  }
  if (typeof target === 'string' && !hasKey(targetKey)) {
    throw libraryError(
      'DI_BAG_INVALID_ALIAS',
      `${operation} requires an existing named target`,
      { operation, target: targetKey },
    );
  }
  const handle = createProvider();
  if (targetToken?.kind === 'collection') {
    const reference = Object.freeze({
      slot: Symbol('argument'),
      key: targetToken.key,
      kind: 'required' as const,
      isCollection: true,
    });
    retainDescription(handle, Object.freeze({
      ...sourceDescription(
        (dependencies: Record<symbol, unknown>) =>
          Reflect.get(dependencies, reference.slot),
        undefined,
        [targetToken.key],
        'raw',
        false,
        [reference],
      ),
      lifetime: collectionAliasLifetime,
    }));
    return [key, handle];
  }
  retainDescription(handle, Object.freeze({
    ...sourceDescription(
      () => {
        throw libraryError(
          'DI_BAG_INTERNAL_STATE',
          'alias source cannot execute',
          {},
        );
      },
      undefined,
      [],
      'raw',
    ),
    alias: targetKey,
  }));
  return [key, handle];
}
```

Imports retain phase 4's `createProvider`, `retainDescription`, `readToken` and `readSingleServiceKey`; remove `readTokenKey`. The required phase-6 substitutions are limited to the destination operation, error details and missing-target message; target `readToken`, the collection reference, transient collection-alias lifetime and dependency factory stay intact.

The new methods call `contributionEntry(collectionToken, provider as Registration, 'withCollectionContribution')`, `normalize(provider, 'withReplacedService')`, and `withTokenBinding(token, provider, 'withTokenService')`. The old methods use defaults until Task 12 deletes them.

- [ ] **Step 4: Add the type of the contribution property**

Append to `src/contribution-types.ts`. Take the two parameter types from `BuilderContribute` AS IT IS ON ENTRY (phase 4 narrowed the token to a collection token); the text below is derived from the 0.4.0 type, where the first parameter is `T & TokenTupleAdmission<readonly [T]>` and the second is the long `V & ...` intersection. If the on-entry type differs, keep its parameter types and only move them into the bag:

```ts
/**
 * The checked generic `withCollectionContribution` callable exposed by a builder.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#compose-an-ordered-collection
 */
export type BuilderWithCollectionContribution<E extends Entry, C extends NeedConstraint> = <T extends CollectionTokenBase, V extends Registration>(
  options: {
    readonly collectionToken: T & TokenTupleAdmission<readonly [T]> & CollectionTokenAdmission<RegistrationsFromEntries<E>, T>;
    readonly provider: V & Registration & CollectionBindingOutput<NoInfer<T>, NoInfer<V>> & CheckedConstraints<C | Contribution<NoInfer<T>, NoInfer<V>>, RegistrationsFromEntries<E>>;
  },
  ...invalid: [T] extends [never] ? [never] : [V] extends [never] ? [never] : []
) => import('./di-bag').Builder<E, C | Contribution<T, V>>;
```

Import `CollectionTokenAdmission` from its phase-4 owner in this file. In `src/index.ts`, export the callable next to the old one: `export type { BuilderContribute, BuilderWithCollectionContribution } from './contribution-types';`

- [ ] **Step 5: Add the methods to `class Builder`**

In `src/di-bag.ts`, add `import { snapshotOptionsBag } from './options-bag';`, import `readSingleServiceKey`, `readToken` and `wrongTokenKind` from the same phase-4 modules that export them on entry, and add `BuilderWithCollectionContribution` to the type import from `./contribution-types`. Insert the complete block below directly after the `installModule` method. Its inspection callback validates the first property before `snapshotOptionsBag` reads the provider or target property.

````ts
  // Infer actual keys before checking context-sensitive method-returning factories.
  // Defer named admission until N is inferred, so trying this signature for a
  // malformed argument does not project the entire retained history.
  /**
   * Add new string-named services.
   * A factory declares its dependencies in the type of its one object parameter; destructure it or read `dependencies.name`, never spread it.
   * @param providersByName - A finite object whose own string keys are service names and whose values are providers or plain factories.
   * @returns A new builder containing snapshots of the supplied providers.
   * @throws `DI_BAG_INVALID_REGISTRATION` for a malformed object or value; `DI_BAG_DUPLICATE_REGISTRATION` for a name already registered.
   * @example
   * ```ts
   * type Clock = { now(): number };
   * const builder = DiBag.createBuilder()
   *   .withServices({ clock: (): Clock => ({ now: () => Date.now() }) })
   *   .withServices({ stamp: ({ clock }: { clock: Clock }) => clock.now() });
   * ```
   */
  withServices<N extends { [K in keyof N]: Registration }>(
    providersByName: N & Registrations & ([N] extends [never]
      ? never
      : NamedAdmission<N> & ThenableAdmission<N> & IntroducesKeys<EntryKeys<Entries>, keyof N> & IncrementalChecked<Entries, N> &
        CheckedConstraints<Constraints, OverrideRegistrations<RegistrationsFromEntries<Entries>, N>>),
  ): Builder<Entries | RegistrationEntries<N>, Constraints> {
    const snapshot = snapshotAdd(providersByName, key => this.#graph.hasPublic(key), 'withServices');
    return new Builder(this.#graph.withPublicRegistrations(snapshot, 'withServices'), this.context);
  }

  /**
   * Add the single service of a typed token.
   * @param options - `token` is a new single-service token; `provider` is a provider or plain factory whose exposed output satisfies the token's service type.
   * @returns A new builder retaining the provider's metadata, lifetime, dependencies, and ownership stages.
   * @throws `DI_BAG_INVALID_ARGUMENT` for a malformed options object; `DI_BAG_INVALID_TOKEN` for a bad token;
   * `DI_BAG_DUPLICATE_REGISTRATION` when the token already has a service; `DI_BAG_INVALID_REGISTRATION` for an invalid provider.
   * @example
   * ```ts
   * const clockKey = Symbol('clock');
   * const clock = DiBag.token(clockKey).of<{ now(): number }>();
   * const builder = DiBag.createBuilder().withTokenService({ token: clock, provider: () => ({ now: () => Date.now() }) });
   * ```
   */
  withTokenService<T extends TokenBase, V extends Registration>(
    options: {
      readonly token: T & TokenTupleAdmission<readonly [T]> & RegisterTokenAdmission<T, Constraints> & IntroducesKeys<EntryKeys<Entries>, TokenKey<T>>;
      readonly provider: V & Registration & BindingOutput<NoInfer<T>, NoInfer<V>> & ThenableAdmission<Record<TokenKey<T>, NoInfer<V>>> &
        IncrementalChecked<Entries, Record<TokenKey<T>, TokenBinding<NoInfer<T>, NoInfer<V>>>> &
        CheckedConstraints<Constraints, OverrideRegistrations<RegistrationsFromEntries<Entries>, Record<TokenKey<T>, TokenBinding<NoInfer<T>, NoInfer<V>>>>>;
    },
  ): Builder<Entries | { key: TokenKey<T>; registration: TokenBinding<T, V> }, Constraints> {
    let key: symbol | undefined;
    const { token, provider } = snapshotOptionsBag(options, 'withTokenService', ['token', 'provider'], [], (name, value) => {
      if (name === 'token') key = readSingleServiceKey(value, 'withTokenService');
    });
    const serviceKey = key!;
    const graph = this.#graph.withTokenKind(serviceKey, 'single-service', 'withTokenService');
    if (graph.hasPublic(serviceKey)) throw libraryError('DI_BAG_DUPLICATE_REGISTRATION', `duplicate registration: ${String(serviceKey)}`, { operation: 'withTokenService', key: serviceKey });
    return new Builder(graph.withPublicBinding(serviceKey, withTokenBinding(token as never, provider as never, 'withTokenService'), 'withTokenService'), this.context) as never;
  }

  /**
   * Add another lookup name for an existing service.
   * @param options - `aliasKey` is a new string name or single-service token; `targetServiceKey` is the existing name or token whose canonical acquisition is reused.
   * @returns A new builder; aliases add no cache or ownership of their own.
   * @throws `DI_BAG_INVALID_ARGUMENT` for a malformed options object; `DI_BAG_INVALID_TOKEN` for a bad token;
   * `DI_BAG_DUPLICATE_REGISTRATION` when the alias key exists; `DI_BAG_INVALID_ALIAS` for an absent named target.
   * @example
   * ```ts
   * const builder = DiBag.createBuilder()
   *   .withServices({ clock: () => Date.now() })
   *   .withServiceAlias({ aliasKey: 'now', targetServiceKey: 'clock' });
   * ```
   */
  withServiceAlias<const D extends AliasSelection, const T extends AliasSelection>(
    options: {
      readonly aliasKey: D & AliasDestinationAdmission<D> & (unknown extends AliasAdmission<D> ? Introduces<RegistrationsFromEntries<Entries>, AliasEntries<RegistrationsFromEntries<Entries>, D, T>> : AliasAdmission<D>);
      readonly targetServiceKey: T & AliasAdmission<T> & (unknown extends AliasAdmission<T>
        ? AliasTarget<RegistrationsFromEntries<Entries>, Constraints, T> & AliasDestination<RegistrationsFromEntries<Entries>, NoInfer<D>, T> : unknown) &
        (unknown extends AliasAdmission<D> & AliasAdmission<T>
          ? IncrementalChecked<Entries, AliasEntries<RegistrationsFromEntries<Entries>, NoInfer<D>, NoInfer<T>>> & CheckedConstraints<Constraints, OverrideRegistrations<RegistrationsFromEntries<Entries>, AliasEntries<RegistrationsFromEntries<Entries>, NoInfer<D>, NoInfer<T>>>> : unknown);
    },
    ...invalid: [D] extends [never] ? [never] : [T] extends [never] ? [never] : []
  ): Builder<Entries | AliasEntry<RegistrationsFromEntries<Entries>, D, T>, Constraints> {
    const { aliasKey, targetServiceKey } = snapshotOptionsBag(options, 'withServiceAlias', ['aliasKey', 'targetServiceKey'], [], (name, value) => {
      if (name === 'aliasKey' && typeof value !== 'string') readSingleServiceKey(value, 'withServiceAlias');
    });
    let graph = this.#graph;
    for (const value of [aliasKey, targetServiceKey]) {
      if (typeof value === 'string') continue;
      const selected = readToken(value);
      graph = graph.withTokenKind(selected.key, selected.kind, 'withServiceAlias');
    }
    const [key, registration] = aliasEntry(aliasKey, targetServiceKey, candidate => graph.hasPublic(candidate), 'withServiceAlias');
    return new Builder(graph.withPublicBinding(key, registration, 'withServiceAlias'), this.context) as never;
  }

  /**
   * Append a provider to the list of a collection token.
   * @param options - `collectionToken` names the list; `provider` is a provider or plain factory whose output satisfies the token's item type.
   * @returns A new builder preserving contribution order.
   * @throws `DI_BAG_INVALID_ARGUMENT` for a malformed options object; `DI_BAG_INVALID_TOKEN` for a bad token; `DI_BAG_INVALID_REGISTRATION` for an invalid provider.
   * @example
   * ```ts
   * const toolsKey = Symbol('tools');
   * const tools = DiBag.token(toolsKey).forCollectionOf<string>();
   * const builder = DiBag.createBuilder()
   *   .withCollectionContribution({ collectionToken: tools, provider: () => 'search' })
   *   .withCollectionContribution({ collectionToken: tools, provider: () => 'fetch' });
   * ```
   */
  // A named callable keeps extracted generic methods nameable in consumer declarations.
  readonly withCollectionContribution: BuilderWithCollectionContribution<Entries, Constraints> = ((options: unknown) => {
    const { collectionToken, provider } = snapshotOptionsBag(options, 'withCollectionContribution', ['collectionToken', 'provider'], [], (name, value) => {
      if (name !== 'collectionToken') return;
      const { key, kind } = readToken(value);
      if (kind !== 'collection') throw wrongTokenKind('withCollectionContribution', 'collection', key);
    });
    const [key, value] = contributionEntry(collectionToken, provider as Registration, 'withCollectionContribution');
    return new Builder(this.#graph.withContribution(key, value, 'withCollectionContribution'), this.context);
  }) as BuilderWithCollectionContribution<Entries, Constraints>;

  // ZeroDependencyAdmission proves empty needs, while ReplacementOutput proves
  // every surviving consumer requirement. Repeating
  // IncrementalChecked here only rescans accepted history. The general overload
  // retains full checks for parameters, mixed providers and explicit K,V.
  // Keep the fixed history out of replacement-factory inference with NoInfer.
  /**
   * Replace an existing string-named service with a dependency-free factory.
   * @param options - `serviceKey` is one existing string-literal service name; `provider` is the replacement, checked against every surviving consumer.
   * @returns A new builder with the replacement.
   * @typeParam V - The exact replacement factory or disposable-factory type.
   * @throws `DI_BAG_INVALID_ARGUMENT` for a malformed options object; `DI_BAG_INVALID_REPLACEMENT` for an absent key; `DI_BAG_INVALID_REGISTRATION` for an invalid provider.
   * @example
   * ```ts
   * const builder = DiBag.createBuilder()
   *   .withServices({ clock: () => Date.now() })
   *   .withReplacedService({ serviceKey: 'clock', provider: () => 0 });
   * ```
   */
  withReplacedService<const K extends string, V extends (ReplacementFactory<ReplacementOutput<NoInfer<RegistrationsFromEntries<Entries>>, K, Constraints>>) | FactoryWithDisposal<ReplacementFactory<ReplacementOutput<NoInfer<RegistrationsFromEntries<Entries>>, K, Constraints>>>>(
    options: {
      readonly serviceKey: K & ReplacementKeyOf<EntryKeys<Entries>, K>;
      readonly provider: V & (Factory | FactoryWithDisposal<Factory>) & ZeroDependencyAdmission<NoInfer<V>> &
        CheckedConstraints<Constraints, OverrideRegistrations<RegistrationsFromEntries<Entries>, Record<K, NoInfer<V>>>>;
    },
  ): Builder<Exclude<Entries, { key: K }> | { key: K; registration: V }, WithoutExportObligations<Constraints, K>>;
  /**
   * Replace an existing named or typed-token service.
   * @param options - `serviceKey` is the single existing name or token to replace; `provider` is a replacement compatible with the token and known consumers.
   * @returns A new builder with the replacement and its inferred service type.
   * @throws `DI_BAG_INVALID_ARGUMENT` for a malformed options object; `DI_BAG_INVALID_REPLACEMENT` for an absent key; `DI_BAG_INVALID_TOKEN` or `DI_BAG_INVALID_REGISTRATION` for malformed input.
   */
  withReplacedService<const K extends string | TokenBase, V extends Registration>(
    options: {
      readonly serviceKey: K & NoInfer<ReplacementAdmission<RegistrationsFromEntries<Entries>, Constraints, K>>;
      readonly provider: V & Registration & BuilderReplacementRegistration<Entries, Constraints, NoInfer<K>, V>;
    },
  ): Builder<ReplacedEntries<Entries, K, V>, WithoutExportObligations<Constraints, SelectionKey<K>>>;
  withReplacedService(options: unknown): unknown {
    const { serviceKey, provider } = snapshotOptionsBag(options, 'withReplacedService', ['serviceKey', 'provider']);
    const selected = typeof serviceKey === 'string' ? undefined : readToken(serviceKey);
    const key = selected === undefined ? serviceKey as string : selected.key;
    const graph = selected === undefined
      ? this.#graph
      : this.#graph.withTokenKind(selected.key, selected.kind, 'withReplacedService');
    if (selected?.kind !== 'collection' && !graph.hasPublic(key)) {
      throw libraryError('DI_BAG_INVALID_REPLACEMENT', `withReplacedService accepts existing names or typed tokens only: ${String(key)}`, { operation: 'withReplacedService', key });
    }
    normalize(provider, 'withReplacedService');
    return new Builder(graph.withPublicBinding(key, provider as Registration, 'withReplacedService'), this.context);
  }
````

Then, directly after the `verifyGraph` method:

````ts
  /**
   * Report at the type level why this graph would not build; the runtime call does nothing.
   * Write `builder.verifyGraphAtCompileTime() satisfies void;` so a rejected graph fails on that line with
   * the complete message and details, instead of at the start of the builder expression.
   * @returns `void` for a buildable graph; otherwise the failure that `buildContainer()` would report.
   * @example
   * ```ts
   * const builder = DiBag.createBuilder().withServices({ greeting: () => 'hello' });
   * builder.verifyGraphAtCompileTime() satisfies void;
   * ```
   */
  // A generic `this` keeps the report out of every builder instantiation (about 11k fewer instantiations per 100 calls).
  verifyGraphAtCompileTime<Self extends Builder<Entries, Constraints>>(this: Self): CompositionReport<Self>;
  verifyGraphAtCompileTime(): unknown { return undefined; }
````

And directly after the `build` method, with the same `this` type that `build` has on your tree:

````ts
  /**
   * Finish a complete graph as a lazy container.
   * The container owns what it acquires; close it when done.
   * @returns A fresh container that owns the acquisitions it creates.
   * @throws `DI_BAG_CLASSIFIER_REQUIRED` when a provider uses `auto` acquisition, the facade has no Promise
   * classifier, and the host has no `process.getBuiltinModule`.
   * @example
   * ```ts
   * const app = DiBag.createBuilder().withServices({ greeting: () => 'hello' }).buildContainer();
   * await app.close();
   * ```
   */
  buildContainer(this: Builder<Entries, Constraints> & CheckDependencyCompleteness<RegistrationsFromEntries<Entries>> & CompleteConstraints<Constraints, RegistrationsFromEntries<Entries>> & CheckedLifetimes<RegistrationsFromEntries<Entries>, Constraints>): Bag<RegistrationsFromEntries<Entries>, Constraints> {
    return new Bag(this.#graph, this.context);
  }
````

- [ ] **Step 6: Run the tests**

Run: `bun test tests/builder-renames.test.ts`
Expected: `7 pass`, `6 fail`. The six failures are the four tests whose title starts with `withInstalledModules` or `a module of the list`, and the two `buildModule` tests. The added collection-kind boundary and collection-replacement read-view tests are among the seven passes. The historical adapted prototype measured `5 pass`, `6 fail` before those tests were added; Tasks 3 and 4 make the printed thirteen-test file pass.

Run: `npm run typecheck`
Expected: exit 0. This is the first time these signatures meet the compiler on the actual phase-entry tree. An error inside `src/di-bag.ts` on one of the new signatures can reveal a mismatch hidden by the historical 0.4.0-adapted prototype: repair the signature while keeping the bag shape, at most three serious attempts per method, and if the shape cannot be made to work take that method's fallback in Task 6.

- [ ] **Step 7: Leave the expand work uncommitted until all expand tests are green**

Task 2 intentionally leaves six assertions red because Tasks 3 and 4 implement the APIs they exercise. Do not commit this state; continue directly to Task 3. Task 4 makes the single expand commit after all thirteen tests pass.

---

### Task 3: `buildModule` takes one bag (expand)

**Files:**
- Modify: `src/di-bag.ts`, `src/module.ts`
- Test: `tests/builder-renames.test.ts` (the two `buildModule` tests)

**Interfaces:**
- Consumes: `snapshotOptionsBag` (Task 1).
- Produces: the overload `buildModule(options: ModuleOptions & { exportedServiceKeys })` in front of the 0.4.0 overload; `ModuleOptions.moduleLabel`; `sealModule(graph, keys, moduleLabel?)`, whose third parameter is now the label VALUE; `positionalModuleLabel(options)`, which keeps the 0.4.0 validation of `{ label? }` alive until Task 12.
- The name stays `buildModule`, so both shapes must live under one name while call sites move. The runtime tells them apart: exactly one argument that is a plain object (not `null`, not an array) is the 0.5.0 bag; everything else, including a lone string, keeps its 0.4.0 meaning and its 0.4.0 errors until Task 12.

**The overload compiled only in the recovered positive prototype.** It relies on a `const` type parameter being inferred from a PROPERTY of the argument (`exportedServiceKeys: K & Selection<...>`), where 0.4.0 infers it from the argument itself (`keys: K & Selection<...>`). Must still hold on the real tree (Task 5 has the fixtures): `K` is inferred as a readonly tuple of literals from an inline array; an unknown key is reported on the `exportedServiceKeys` property with the `Selection` message for the operation `'buildModule'`; `ModuleOptions` keeps the documentation of `moduleLabel`. The negative property-position case was excluded from the controller's compiler run. If inference from the property fails, the spec gives no positional fallback for this method (rule 4 puts the single input in the bag under its role name), so repair the signature: first try declaring the parameter as one inline object type, `options: { readonly exportedServiceKeys: K & ...; readonly moduleLabel?: string }`, without the intersection with `ModuleOptions`.

While both overloads exist, a negative fixture that calls `buildModule` can report `No overload matches this call` on the method name instead of the `Unsatisfied` message on the argument. `tests/types.test.ts` may therefore show failures in `type rejection:` tests that call `buildModule`, from this task until Task 12 removes the old overload. That is expected; do not edit a marker to get green in between. This is a prediction, not an observation.

- [ ] **Step 1: `src/module.ts`**

In the interface `ModuleOptions`, replace the property `label` and its comment with:

```ts
  /**
   * Name each installation's private bindings `<moduleLabel>/<key>` in error messages, cycle paths,
   * `inspectGraph()`, and observer events. Nested labels compose: `outer/inner/key`.
   * Exported bindings keep their bare key.
   */
  readonly moduleLabel?: string;
  /** @deprecated The 0.4.0 name of `moduleLabel`, read only by the positional form; the contract step of phase 5 removes it. */
  readonly label?: string;
```

Change the head of `sealModule` to take the label value:

```ts
export function sealModule(graph: BindingGraph, keys: unknown, moduleLabel?: unknown): Module<never, never, never, never> {
  const label = checkedModuleLabel(moduleLabel);
```

Replace the whole function `moduleLabel` with these two. The first is the existing check of the label value, reworded to the new option name; it keeps its 0.4.0 code. The second is the 0.4.0 function under a new name, unchanged in behavior:

```ts
/** The label of a module: absent, or a non-empty string. */
function checkedModuleLabel(moduleLabel: unknown): string | undefined {
  if (moduleLabel === undefined) return undefined;
  if (typeof moduleLabel !== 'string' || moduleLabel === '') throw libraryError('DI_BAG_INVALID_EXPORT', 'buildModule moduleLabel must be a non-empty string', { operation: 'buildModule', option: 'moduleLabel' });
  return moduleLabel;
}

/** The 0.4.0 positional options `{ label? }`. The contract step of phase 5 removes this function. */
export function positionalModuleLabel(options: unknown): unknown {
  if (options === undefined) return undefined;
  const invalid = () => libraryError('DI_BAG_INVALID_EXPORT', 'buildModule options must be { label?: string } with a non-empty label', { operation: 'buildModule', option: 'label' });
  if (typeof options !== 'object' || options === null || Array.isArray(options)) throw invalid();
  if (Reflect.ownKeys(options).some(key => key !== 'label') || ('label' in options && !Object.hasOwn(options, 'label'))) throw invalid();
  if (!Object.hasOwn(options, 'label')) return undefined;
  const label: unknown = Reflect.get(options, 'label');
  if (label === undefined) return undefined;
  if (typeof label !== 'string' || label === '') throw invalid();
  return label;
}
```

- [ ] **Step 2: `src/di-bag.ts`**

Import `positionalModuleLabel` from `./module`. Put this overload directly in front of the existing `buildModule` signature, and move the JSDoc block of `buildModule` in front of it with its `@param` lines and example rewritten (the API card takes the summary and example from the first documented signature):

````ts
  /**
   * Seal this graph as a reusable module and select its public names and typed tokens.
   * Unselected services stay private to each installation; unmet dependencies
   * become requirements of the module. Installed modules nest: their private
   * bindings and retained constraints are re-scoped inside this module.
   * @param options - `exportedServiceKeys` is a finite tuple of existing names or tokens, and may be empty. `moduleLabel` is optional;
   * each installation names its private bindings `<moduleLabel>/<key>` in error messages, cycle paths, `inspectGraph()`, and observer events.
   * @returns An immutable module that can be renamed or installed in another builder.
   * @throws `DI_BAG_INVALID_ARGUMENT` for a malformed options object; `DI_BAG_INVALID_EXPORT` if the selection is not a tuple,
   * contains an absent name or token, or the label is not a non-empty string; `DI_BAG_INVALID_TOKEN` for a value that is not a genuine token.
   * @example
   * ```ts
   * const orders = DiBag.createBuilder()
   *   .withServices({ repository: () => new Map<string, number>() })
   *   .withServices({ placeOrder: ({ repository }: { repository: Map<string, number> }) => (id: string) => repository.set(id, 1) })
   *   .buildModule({ exportedServiceKeys: ['placeOrder'], moduleLabel: 'orders' });
   * // Errors and inspectGraph() name the private binding 'orders/repository'.
   * const app = DiBag.createBuilder().withInstalledModules([orders]).buildContainer();
   * ```
   */
  buildModule<const K extends readonly unknown[]>(
    options: ModuleOptions & {
      readonly exportedServiceKeys: K & Selection<RegistrationsFromEntries<Entries>, Constraints, K, 'buildModule'> & ModuleExportAdmission<K> & SealAdmission<RegistrationsFromEntries<Entries>, Extract<SelectionKey<K[number]>, keyof RegistrationsFromEntries<Entries>>, Constraints>;
    },
  ): Module<
    ExportedServices<ServicesOf<RegistrationsFromEntries<Entries>>, Extract<SelectionKey<K[number]>, keyof RegistrationsFromEntries<Entries>>>,
    ExternalRequirements<ModuleSealedConstraints<Entries, Constraints, Extract<SelectionKey<K[number]>, keyof RegistrationsFromEntries<Entries>>>>,
    ModuleSealedConstraints<Entries, Constraints, Extract<SelectionKey<K[number]>, keyof RegistrationsFromEntries<Entries>>>,
    ModulePublicProviders<RegistrationsFromEntries<Entries>, Extract<SelectionKey<K[number]>, keyof RegistrationsFromEntries<Entries>>>
  >;
  /** @deprecated The 0.4.0 form; the contract step of phase 5 removes it. */
````

The existing signature follows unchanged, but it loses its body: end it with `>;` instead of `> { return sealModule(...) as never; }`, and add the implementation after it:

```ts
  buildModule(first: unknown, second?: unknown): unknown {
    // Only a lone plain object is the 0.5.0 bag. Everything else keeps its 0.4.0 meaning and its 0.4.0 errors,
    // including a lone value that is not an array. The contract step of phase 5 removes this branch.
    const isOptionsBag = arguments.length === 1 && typeof first === 'object' && first !== null && !Array.isArray(first);
    if (!isOptionsBag) return sealModule(this.#graph, first, positionalModuleLabel(second));
    const { exportedServiceKeys, moduleLabel } = snapshotOptionsBag(first, 'buildModule', ['exportedServiceKeys'], ['moduleLabel']);
    return sealModule(this.#graph, exportedServiceKeys, moduleLabel);
  }
```

- [ ] **Step 3: Run the tests**

Run: `bun test tests/builder-renames.test.ts -t buildModule`
Expected: `1 pass`, `1 fail`. `buildModule rejects a malformed bag...` passes. `buildModule takes one bag...` still fails, on `withInstalledModules is not a function`, until Task 4. (Measured with the adapted copy against the prototype cut back to this task's state.)

Run: `bun test tests/runtime-diagnostics.test.ts tests/nested-modules.test.ts`
Expected: `0 fail`. These files seal modules through the 0.4.0 form, with and without `{ label }`, and `nested-modules` calls `buildModule('a')`, all of which must behave exactly as before. At the 0.4.0 source they have 13 and 11 tests; both passed unmodified against the prototype.

Run: `npm run typecheck`
Expected: exit 0. See the note above if the new overload is rejected or if an existing positive fixture stops inferring `K`.

- [ ] **Step 4: Leave the second expand increment uncommitted**

The focused `buildModule` run still has one expected failure because Task 4 adds `withInstalledModules`. Do not commit this state; continue directly to Task 4.

---

### Task 4: `withInstalledModules` (expand, spike S7)

**Files:**
- Create: `src/options-bag.ts` (carried uncommitted from Task 1)
- Create: `src/install-types.ts`
- Modify: `src/di-bag.ts`, `src/module.ts`, `src/runtime.ts`
- Modify: `docs/agent/errors.md` (carried uncommitted from Task 1)
- Test: `tests/builder-renames.test.ts` (the four module-list tests)

**Interfaces:**
- Produces: `withInstalledModules<const Modules extends readonly unknown[]>(modules: Modules & InstalledModulesAdmission<Entries, Constraints, Modules>): Builder<InstalledModulesEntries<...>, InstalledModulesConstraints<...>>`; `moduleGraph(value, operation?, index?)`; `BindingGraph.withInstallation(description, operation?)`.
- Runtime contract, all of it run in the prototype: a value that is not an array raises `DI_BAG_INVALID_ARGUMENT` (`argument: 'modules'`, `expected: 'an array'`); the list is snapshotted by index before anything is read again; every element is described before any is installed, and a bad element raises `DI_BAG_INVALID_MODULE` with `details: { operation: 'withInstalledModules', index }`; installation runs in list order on the accumulating graph, so an export collision between two modules of one list raises `DI_BAG_DUPLICATE_REGISTRATION` for the later one; contributions keep list order; an empty list is valid.

**The fold compiled only in the recovered positive prototype.** The later controller run included `src/install-types.ts` and the positive builder fixture, but excluded the negative element-position fixture and did not include phase 4. `InstallFold` walks the tuple head first, carrying the entries and constraints accumulated so far as type ARGUMENTS (evaluated at each step, so the recursion is a tail call and not a nest of deferred object members), and appends to `Checked` one element per module: the module intersected with the same three checks `installModule` applies today (`IntroducesKeys`, `IncrementalChecked`, `IncrementalConstraints`), evaluated against the builder PLUS the modules before it. The parameter type `Modules & Checked` is intended to make a failed check an assignability error of ONE tuple element. Task 5 must prove that position, and Task 6 must still test 50 modules.

Must hold (Task 5 has the fixtures, Task 6 measures and decides):
1. One module, ten modules and fifty modules in one list compile with no `TS2589` (excessively deep instantiation).
2. A list installs like the same modules installed one call at a time: the resulting builder type resolves the same keys, and a requirement met by a LATER module of the list or by the host is accepted.
3. Two modules of one list that export the same name: the error is on the SECOND one's element, with the `IntroducesKeys` message.
4. A module whose export collides with the builder: the error is on that module's element.
5. A later module that provides a service of the wrong type for an earlier module's requirement: the error is on the later module's element, with the `unsatisfied-consumer` message.
6. An element that is not a module, and a widened `Module[]` array: rejected with the `NotAModule` message.
7. An empty list and an `as const` list declared separately both compile.

Fallback (spec, S7): the singular `withInstalledModule(module)`. Its complete task list is in Task 6.

- [ ] **Step 1: Create `src/install-types.ts`**

```ts
import type { Module } from './module';
import type { IncrementalConstraints, NeedConstraint } from './module-types';
import type { Registrations } from './registration';
import type { Entry, EntryKeys, IncrementalChecked, IntroducesKeys, RegistrationEntries, RegistrationsFromEntries, Unsatisfied } from './types';

type NotAModule = Unsatisfied<'withInstalledModules requires a finite tuple of genuine modules', {}>;

// Tail-recursive, so a long list is evaluated iteratively. The running entries, constraints and
// checked elements are separate type arguments because type arguments are computed at every step;
// members of an object type are computed lazily and would nest one level per module.
// Each module is checked against the builder plus the modules before it, exactly as separate
// installs would be, and each check is intersected into ITS element, so the compiler reports a
// failure on that element of the array literal.
type InstallFold<Modules extends readonly unknown[], Entries extends Entry, Constraints extends NeedConstraint, Checked extends readonly unknown[]> =
  Modules extends readonly [infer Head, ...infer Rest]
    ? Head extends Module<infer _P, infer _R, infer MC extends NeedConstraint, infer D extends Registrations>
      ? InstallFold<Rest, Entries | RegistrationEntries<D>, Constraints | MC, readonly [
          ...Checked,
          Head & IntroducesKeys<EntryKeys<Entries>, keyof D> &
            IncrementalChecked<Entries, D> &
            IncrementalConstraints<Constraints, MC, RegistrationsFromEntries<Entries>, D>,
        ]>
      : InstallFold<Rest, Entries, Constraints, readonly [...Checked, NotAModule]>
    : { readonly entries: Entries; readonly constraints: Constraints; readonly checked: Checked };

type Installed<Entries extends Entry, Constraints extends NeedConstraint, Modules extends readonly unknown[]> =
  InstallFold<Modules, Entries, Constraints, readonly []>;

/** The element-wise admission of a module list: element `i` carries the checks of module `i`. */
export type InstalledModulesAdmission<Entries extends Entry, Constraints extends NeedConstraint, Modules extends readonly unknown[]> =
  number extends Modules['length'] ? NotAModule : Installed<Entries, Constraints, Modules>['checked'];
/** The builder entries after every module of the list is installed. */
export type InstalledModulesEntries<Entries extends Entry, Constraints extends NeedConstraint, Modules extends readonly unknown[]> =
  Installed<Entries, Constraints, Modules>['entries'];
/** The retained constraints after every module of the list is installed. */
export type InstalledModulesConstraints<Entries extends Entry, Constraints extends NeedConstraint, Modules extends readonly unknown[]> =
  Installed<Entries, Constraints, Modules>['constraints'];
```

- [ ] **Step 2: Let `moduleGraph` and `withInstallation` name the list and the element**

In `src/module.ts`, replace the first three lines of `moduleGraph` (signature, lookup, throw) with:

```ts
export function moduleGraph(value: unknown, operation: 'installModule' | 'withInstalledModules' = 'installModule', index?: number): GraphDescription {
  const description = typeof value === 'object' && value !== null ? descriptions.get(value) : undefined;
  if (!description) {
    if (operation === 'installModule') throw libraryError('DI_BAG_INVALID_MODULE', 'installModule requires a genuine module', { operation: 'installModule' });
    throw libraryError('DI_BAG_INVALID_MODULE', `withInstalledModules requires genuine modules: element ${index} is not one`, { operation: 'withInstalledModules', index });
  }
```

`WeakMap.prototype.get` answers `undefined` for a key that is not an object, but the explicit `typeof` test keeps the parameter `unknown` without a cast. In `src/runtime.ts`, change the head of `withInstallation`:

```ts
  withInstallation(description: GraphDescription, operation: 'installModule' | 'withInstalledModules' = 'installModule'): BindingGraph {
    for (const key of description.publicSlots.keys()) {
      if (this.hasPublic(key)) throw libraryError('DI_BAG_DUPLICATE_REGISTRATION', `duplicate registration: ${String(key)}`, { operation, key });
```

Preserve phase 4's complete token-kind propagation, including `moduleGraph`'s `tokenKinds` return member. In `BindingGraph.withInstallation`, change its phase-4 validation loop to use the passed operation:

```ts
for (const [key, kind] of installation.#tokenKinds) {
  this.assertTokenKind(key as symbol, kind, operation);
}
```

The graph constructor may retain its `installModule` label for importing a self-consistent internal description; every host-versus-module kind conflict must use the public caller's operation. Add this test to `tests/builder-renames.test.ts`:

```ts
test('module-list token-kind conflicts name the renamed operation', () => {
  const key = Symbol('installed-kind');
  const single = DiBag.token(key).of<number>();
  const collection = DiBag.token(key).forCollectionOf<number>();
  const module = DiBag.createBuilder()
    .withCollectionContribution({ collectionToken: collection, provider: () => 2 })
    .buildModule({ exportedServiceKeys: [] });
  const nested = DiBag.createBuilder().withInstalledModules([module])
    .buildModule({ exportedServiceKeys: [] });
  for (const candidate of [module, nested]) {
    const host = DiBag.createBuilder()
      .withTokenService({ token: single, provider: () => 1 });
    const error = caught(() => loose(host).withInstalledModules!([candidate]));
    expect(error.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
    expect(error.details).toEqual({
      operation: 'withInstalledModules', expectedKind: 'single-service', receivedKind: 'collection',
    });
  }
});
```

This controller-added regression was not run during planning. The final focused file now contains 14 tests; historical prototype counts above describe their historical files only.

- [ ] **Step 3: Add the method**

In `src/di-bag.ts`, add `import type { InstalledModulesAdmission, InstalledModulesConstraints, InstalledModulesEntries } from './install-types';` and insert directly after `withReplacedService`:

````ts
  /**
   * Install sealed modules in list order, allocating fresh private bindings for each installation.
   * Each module is checked against this builder plus the modules before it in the list.
   * The installing host must provide every requirement that no module of the graph provides.
   * @param modules - A finite list of modules whose public names collide neither with this builder nor with each other.
   * @returns A new builder exposing only the selected exports of each module; contributions keep list order.
   * @throws `DI_BAG_INVALID_ARGUMENT` when `modules` is not an array; `DI_BAG_INVALID_MODULE` for an element not made by `buildModule`;
   * `DI_BAG_DUPLICATE_REGISTRATION` when an export name is already registered. A rejected list changes nothing.
   * @example
   * ```ts
   * const greeting = DiBag.createBuilder()
   *   .withServices({ greet: ({ name }: { name: string }) => `hello, ${name}` })
   *   .buildModule({ exportedServiceKeys: ['greet'] });
   * const app = DiBag.createBuilder().withInstalledModules([greeting]).withServices({ name: () => 'Ada' }).buildContainer();
   * ```
   */
  withInstalledModules<const Modules extends readonly unknown[]>(
    modules: Modules & InstalledModulesAdmission<Entries, Constraints, Modules>,
  ): Builder<InstalledModulesEntries<Entries, Constraints, Modules>, InstalledModulesConstraints<Entries, Constraints, Modules>> {
    if (!Array.isArray(modules)) {
      throw libraryError('DI_BAG_INVALID_ARGUMENT', 'withInstalledModules requires an array of modules', { operation: 'withInstalledModules', argument: 'modules', expected: 'an array' });
    }
    // Snapshot indexed entries before a custom iterator or an accessor can substitute modules.
    const selected: unknown[] = [];
    const length = modules.length;
    for (let index = 0; index < length; index++) selected[index] = modules[index];
    // Describe every element before installing any, so a list with a bad element runs no installation.
    const descriptions = selected.map((module, index) => moduleGraph(module, 'withInstalledModules', index));
    let graph = this.#graph;
    for (const description of descriptions) graph = graph.withInstallation(description, 'withInstalledModules');
    return new Builder(graph, this.context) as never;
  }
````

- [ ] **Step 4: Run the tests**

Run: `bun test tests/builder-renames.test.ts`
Expected: `14 pass`, `0 fail`.

Run: `bun test tests/nested-modules.test.ts tests/modules.test.ts tests/contributions.test.ts tests/aliases.test.ts`
Expected: `0 fail`; `installModule`, `alias`, `contribute` and `register` still go through the same helpers with their default operation. These four files passed unmodified against the prototype (11, 10, 13 and 19 tests at the 0.4.0 source).

Run: `npm run typecheck`
Expected: exit 0. If `src/install-types.ts` or the method signature is rejected on the actual phase-entry tree, repair it keeping the target shape (three serious attempts), then take the fallback of Task 6.

- [ ] **Step 5: Commit the expand state under the generated-documentation exception**

```bash
git add src tests docs/agent/errors.md
git commit -F - <<'MSG'
feat(builder): add the 0.5 builder surface

Adds the renamed builder methods, the buildModule options bag, and ordered
module-list installation next to the 0.4 surface. The applicable runtime and
compiler checks are green.

Generated-documentation-only red under the phase-5 exception; the phase
evidence records the observed failures and commands. The 400-line API-card
budget is unchanged. Skip this commit during git bisect; Tasks 12-13
contract the surface and restore both documentation checks.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

---

### Reference for Tasks 5 and 13: the assertions this phase breaks, measured

Measured at the 0.4.0 source with the commands shown. Re-run them on your tree before Task 12; phases 3 and 4 may have added or removed a line.

```bash
# runtime messages asserted with toThrow, by this phase's words (word boundaries)
grep -rhoE "toThrow\((/|['\`])[^)]*" tests | grep -E "\b(register|alias|contribute|replace|installModule|verifyGraph|buildModule|build|key tuple|genuine module|label)\b" | sort | uniq -c
# every message text this phase rewords, in any assertion style, including string fixtures and .mjs
for text in "replace accepts" "alias requires" "existing named target" "installModule requires" "genuine module" "key tuple" "buildModule options" "non-empty label"; do printf "%-28s %s\n" "$text" "$(git grep -lF "$text" -- tests scripts examples tools/graph | tr '\n' ' ')"; done
# details.operation
git grep -nE "operation: '(register|alias|contribute|replace|installModule|buildModule)'" -- tests scripts examples tools docs/agent AGENTS.md
# compile-time markers
git grep -hoE "// diagnostic(-also)?: .*" -- tests | grep -E "\b(register|alias|contribute|replace|installModule|verifyGraph)\b" | sort | uniq -c
```

| What | Where | Count | What the contract/docs tasks do |
| --- | --- | --- | --- |
| `toThrow('key tuple')`, `toThrow('genuine module')` | `tests/nested-modules.test.ts`, test `sealing rejects unknown keys and forged modules exactly as before` | 1 each | the CALLS are reshaped; both strings still match, because the new list message `withInstalledModules requires genuine modules: element 0 is not one` contains `genuine module` and the key-tuple site keeps its message |
| `details` equal to `{ operation: 'buildModule', option: 'label' }` | `tests/runtime-diagnostics.test.ts`, test `buildModule rejects malformed label options` | 1 | the test is rewritten: the option is `moduleLabel`, and a malformed bag is a different code |
| `toThrow('alias')` | `tests/release-artifacts.test.ts` | 1 | NOTHING. It is about path aliasing in `parseReleaseTreeArgs`, not about the builder. The method-word grep finds it; leave it alone |
| `replace accepts`, `alias requires`, `existing named target`, `installModule requires`, `non-empty label` | nowhere under `tests`, `scripts`, `examples`, `tools/graph` | 0 | rewording these runtime messages breaks no assertion |
| `buildModule options` | `tools/graph/test/cross-module.test.mjs` | 1 | a test TITLE, no assertion; Task 11 rewords the title |
| `// diagnostic: replace requires one existing singleton string-literal key` | `tests/types/negative` | 5 markers, one of them with the full text and URL | reworded with the message in `src/types.ts`; the same four strings are pinned in `scripts/replacement-diagnostics.ts` (`negative/union-replace.ts`) |
| `// diagnostic: register introduces new names or typed tokens only` | `tests/types/negative` | 2 markers and 1 `diagnostic-also` | reworded with the message in `src/types.ts` |
| the same two messages and `alias requires an existing named target` | `docs/agent/errors.md` | 4 lines, one of them an `// expect-error:` marker that `npm run docs:check` compiles | Task 12 |
| `... accepts existing names or typed tokens only` | `tests/types/negative` | 9 markers: `buildAndStart` 2, `createScope` 1, `createScope share` 4, `fork` 2 | NOTHING. None names `buildModule`. `Selection` interpolates its operation label, and `buildModule` keeps its name, so the label `'buildModule'` and its message do not change in this phase |

The `toThrow` inventory sees only `toThrow(` followed by a string or a regular expression. The second command is the net for everything else, which is why it searches for message TEXT.

---

### Task 5: Compiler fixtures for the new shapes

**Files:**
- Create: `tests/types/builder-renames.ts`, `tests/types/negative/builder-renames.ts`, `tests/types/negative/installed-modules.ts`
- Modify: `tests/types.test.ts` (one `test(...)` block for the positive fixture; negative fixtures are discovered by directory listing)

**Interfaces:**
- Consumes: the signatures of Tasks 2 to 4.
- Produces: the evidence for criterion 1 of spikes S1 and S7 (spec, "Shapes decided by measurement": every fixture passes and each diagnostic lands on the offending property).

**Only the positive fixture compiled in the recovered prototype.** Both negative fixtures were excluded and have never run. How a negative fixture proves WHERE an error lands: `tests/diagnostic-markers.ts` accepts a diagnostic for a `// diagnostic:` marker only when its line is at or after the marker's line and before the next marker's line, and `tests/types.test.ts` fails on any diagnostic no marker claims. Each call below is written over several lines with the marker directly above the offending property or list element. A diagnostic reported on the call's first line, above the marker, is unclaimed and fails the fixture. So: if a fixture fails with an unexpected diagnostic on the line of `.withInstalledModules([` or of the method name, the shape does NOT report on the element, which is a spike failure, not a marker to move. If it fails because the MESSAGE differs (for instance the compiler prints the outer `No overload matches this call` for `withReplacedService`, which has two overloads), read the full flattened message with the command in Step 4 and correct the marker text to a substring the diagnostic really contains. Never delete a case.

- [ ] **Step 1: The positive fixture**

Create `tests/types/builder-renames.ts`:

```ts
import { DiBag } from '../../src/node';
import type { Module } from '../../src/node';

type Clock = { now(): number };
const clockKey = Symbol('clock');
const clock = DiBag.token(clockKey).of<Clock>();
const toolsKey = Symbol('tools');
const tools = DiBag.token(toolsKey).forCollectionOf<string>();

// Every bag method in one chain; both overloads of withReplacedService.
const chained = DiBag.createBuilder()
  .withServices({ config: () => ({ url: 'x' }) })
  .withTokenService({ token: clock, provider: (): Clock => ({ now: () => 1 }) })
  .withServiceAlias({ aliasKey: 'now', targetServiceKey: clock })
  .withCollectionContribution({ collectionToken: tools, provider: () => 'search' })
  .withReplacedService({ serviceKey: 'config', provider: () => ({ url: 'y' }) })
  .withReplacedService({ serviceKey: clock, provider: (): Clock => ({ now: () => 2 }) })
  .withReplacedService({ serviceKey: tools, provider: (): readonly string[] => ['local'] });
chained.verifyGraphAtCompileTime() satisfies void;
const app = chained.buildContainer();
export const aliased: Clock = app.resolve('now');
export const config: { url: string } = app.resolve('config');
export const names: readonly string[] = app.resolve(tools);

// A shorthand bag: the property names equal the variable names.
const token = clock;
const provider = (): Clock => ({ now: () => 3 });
export const shorthand: Clock = DiBag.createBuilder().withTokenService({ token, provider }).buildContainer().resolve(clock);

// A replacement with dependencies takes the general overload.
const derived = DiBag.createBuilder()
  .withServices({ base: () => 1, derived: ({ base }: { base: number }) => base + 1 })
  .withReplacedService({ serviceKey: 'derived', provider: ({ base }: { base: number }) => base * 2 });
export const derivedValue: number = derived.buildContainer().resolve('derived');

// A disposable factory through the zero-dependency overload, and a token alias of a named service.
const owned = DiBag.createBuilder()
  .withServices({ connection: DiBag.withDisposal(() => ({ open: true }), connection => { connection.open = false; }) })
  .withReplacedService({ serviceKey: 'connection', provider: DiBag.withDisposal(() => ({ open: false }), () => {}) })
  .withServices({ time: (): Clock => ({ now: () => 4 }) })
  .withServiceAlias({ aliasKey: clock, targetServiceKey: 'time' });
export const viaToken: Clock = owned.buildContainer().resolve(clock);

// buildModule: an inline tuple, an empty tuple, a token, a label.
const logging = DiBag.createBuilder()
  .withServices({ prefix: () => '[m]', logger: ({ prefix }: { prefix: string }) => ({ log: (line: string) => prefix + line }) })
  .buildModule({ exportedServiceKeys: ['logger'], moduleLabel: 'logging' });
const feature = DiBag.createBuilder()
  .withServices({ service: ({ logger }: { logger: { log(line: string): string } }) => ({ read: () => logger.log('x') }) })
  .buildModule({ exportedServiceKeys: ['service'] });
const tokenFeature = DiBag.createBuilder()
  .withTokenService({ token: clock, provider: (): Clock => ({ now: () => 5 }) })
  .buildModule({ exportedServiceKeys: [clock] });
const contributing = DiBag.createBuilder()
  .withCollectionContribution({ collectionToken: tools, provider: () => 'fetch' })
  .buildModule({ exportedServiceKeys: [] });
export const exportsNothing: Module<{}, {}, any, any> = contributing;

// A list: a requirement met by a LATER module of the same list, a token module, a contributing module.
const listed = DiBag.createBuilder().withInstalledModules([feature, logging, tokenFeature, contributing]).buildContainer();
export const service: { read(): string } = listed.resolve('service');
export const moduleClock: Clock = listed.resolve(clock);
export const moduleTools: readonly string[] = listed.resolve(tools);
// The same modules one call at a time resolve the same keys.
const separate = DiBag.createBuilder().withInstalledModules([feature]).withInstalledModules([logging]).withInstalledModules([tokenFeature]).buildContainer();
export const sameService: { read(): string } = separate.resolve('service');
// An empty list, a list declared separately, a requirement met by the host, a host service between two lists.
DiBag.createBuilder().withInstalledModules([]).buildContainer();
const declared = [feature, logging] as const;
DiBag.createBuilder().withInstalledModules(declared).buildContainer();
DiBag.createBuilder().withInstalledModules([feature]).withServices({ logger: () => ({ log: (line: string) => line }) }).buildContainer();
DiBag.createBuilder().withInstalledModules([feature]).withServices({ extra: () => 1 }).withInstalledModules([logging]).buildContainer();
```

The assignment `exportsNothing: Module<{}, {}, any, any>` only checks that an empty export tuple yields a module; if `Module`'s invariance marker rejects `any` there, delete that one line, not the case above it.

Register it in `tests/types.test.ts`, next to the block for `types/api-renaming.ts`:

```ts
test('the 0.5.0 builder shapes infer the same contracts as the 0.4.0 forms', () => {
  expect(diagnostics(resolve(__dirname, 'types/builder-renames.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});
```

- [ ] **Step 2: The negative fixture for the bags**

Create `tests/types/negative/builder-renames.ts`. The marker texts are the messages of the checks each signature reuses, as they read in `src` at 0.4.0.

```ts
import { DiBag } from '../../../src/node';

type Clock = { now(): number };
const clockKey = Symbol('clock');
const clock = DiBag.token(clockKey).of<Clock>();
const tool = DiBag.token(Symbol('tool')).of<string>();
const tools = DiBag.token(Symbol('tools')).forCollectionOf<string>();

DiBag.createBuilder().withTokenService({
  token: clock,
  // diagnostic: token binding output is not assignable to its service
  provider: () => ({ now: () => 'late' }),
});

DiBag.createBuilder().withTokenService({ token: clock, provider: (): Clock => ({ now: () => 1 }) }).withTokenService({
  // diagnostic: register introduces new names or typed tokens only
  token: clock,
  provider: (): Clock => ({ now: () => 2 }),
});

DiBag.createBuilder().withTokenService({
  // diagnostic: register requires a single-service token
  token: tools,
  provider: () => ['wrong channel'],
});

DiBag.createBuilder().withServices({ a: () => 1 }).withServiceAlias({
  aliasKey: 'b',
  // diagnostic: alias requires an existing named target
  targetServiceKey: 'missing',
});

DiBag.createBuilder().withServices({ a: () => 1 }).withServiceAlias({
  // diagnostic: register introduces new names or typed tokens only
  aliasKey: 'a',
  targetServiceKey: 'a',
});

DiBag.createBuilder().withServices({ a: () => 1 }).withServiceAlias({
  // diagnostic: alias destination requires a single-service token
  aliasKey: tools,
  targetServiceKey: 'a',
});

DiBag.createBuilder().withCollectionContribution({
  // diagnostic: contribute requires a collection token
  collectionToken: tool,
  provider: () => 'search',
});

DiBag.createBuilder().withCollectionContribution({
  collectionToken: tools,
  // diagnostic: collection contribution output is not assignable to its item
  provider: () => 42,
});

// Zero-dependency fast path: the diagnostic must land on serviceKey.
DiBag.createBuilder().withServices({ a: () => 1 }).withReplacedService({
  // diagnostic: replace requires one existing singleton string-literal key
  serviceKey: 'missing',
  provider: () => 2,
});

// General replacement path: a dependency-bearing provider cannot use the zero-dependency overload.
DiBag.createBuilder().withServices({ a: () => 1, b: () => 2, consumer: ({ a }: { a: number }) => a }).withReplacedService({
  serviceKey: 'a',
  // diagnostic: consumer dependency
  provider: ({ b }: { b: number }) => 'text',
});

// Two overloads while the 0.4.0 form exists: one line each for now. Task 12 spreads these two over several lines.
// diagnostic: buildModule accepts existing names or typed tokens only
DiBag.createBuilder().withServices({ a: () => 1 }).buildModule({ exportedServiceKeys: ['missing'] });
// diagnostic: is not assignable to type 'string'
DiBag.createBuilder().withServices({ a: () => 1 }).buildModule({ exportedServiceKeys: ['a'], moduleLabel: 1 });
```

Every S1 call above places its marker directly above the offending property. An outer `No overload matches this call` reported on the method/call line is a spike failure for that method, even when the nested text contains the expected phrase. The zero-dependency and general replacement paths are separate cases because preserving the fast overload is part of S1. The two `buildModule` cases below are not S1; while its old overload exists their markers remain above the statement, and Task 12 removes that overload and requires the `exportedServiceKeys`/`moduleLabel` property positions.

In the contract step (Task 12), reword every marker backed by a shared old/new admission type: the two `register introduces ...` markers, `register requires a single-service token`, `alias requires ...`, `alias destination requires ...`, `contribute requires ...`, and `replace requires ...`. Until then they carry the 0.4.0 wording because both public generations share those check types. Task 12 also adds a case this file cannot hold yet: the 0.4.0 option `label` must be rejected, which is only true once the deprecated `ModuleOptions.label` is gone.

- [ ] **Step 3: The negative fixture for the module list**

Create `tests/types/negative/installed-modules.ts`:

```ts
import { DiBag } from '../../../src/node';
import type { Module } from '../../../src/node';

const logging = DiBag.createBuilder()
  .withServices({ logger: () => ({ log: (line: string) => line }) })
  .buildModule({ exportedServiceKeys: ['logger'] });
const feature = DiBag.createBuilder()
  .withServices({ service: ({ logger }: { logger: { log(line: string): string } }) => ({ read: () => logger.log('x') }) })
  .buildModule({ exportedServiceKeys: ['service'] });
const numericLogger = DiBag.createBuilder()
  .withServices({ logger: () => ({ log: (line: number) => String(line) }) })
  .buildModule({ exportedServiceKeys: ['logger'] });

// Two modules of one list export the same name: the SECOND element is the offender.
DiBag.createBuilder().withInstalledModules([
  logging,
  feature,
  // diagnostic: register introduces new names or typed tokens only
  logging,
]);

// A module export collides with the builder.
DiBag.createBuilder().withServices({ logger: () => 1 }).withInstalledModules([
  feature,
  // diagnostic: register introduces new names or typed tokens only
  logging,
]);

// A later module provides the wrong type for an earlier module's requirement.
DiBag.createBuilder().withInstalledModules([
  feature,
  // diagnostic: provided service does not satisfy its consumer dependency
  numericLogger,
]);

// An element that is not a module.
DiBag.createBuilder().withInstalledModules([
  feature,
  // diagnostic: withInstalledModules requires a finite tuple of genuine modules
  42,
]);

// A widened array has no positions to check.
declare const widened: Module<object, object>[];
// diagnostic: withInstalledModules requires a finite tuple of genuine modules
DiBag.createBuilder().withInstalledModules(widened);

// A missing requirement is still reported by the terminal, as it is for separate installs.
// diagnostic: required service registrations are missing
DiBag.createBuilder().withInstalledModules([feature]).buildContainer();
```

- [ ] **Step 4: Run them**

Run: `bun test tests/types.test.ts -t "0.5.0 builder shapes|builder-renames|installed-modules"`
Expected: `3 pass`, `0 fail`.

To see every diagnostic of one fixture with its line and full text:

```bash
cat > /tmp/di-bag-phase-05/show-diagnostics.test.ts <<'TS'
import { test } from 'bun:test';
import { resolve } from 'node:path';
import { describeDiagnostic, diagnostics } from '/ABSOLUTE/PATH/TO/REPO/tests/compiler';
test('show', () => { for (const item of diagnostics(resolve(process.env.FIXTURE!)).map(describeDiagnostic)) console.log(item.line, item.column, item.message.slice(0, 600)); });
TS
sed -i "s#/ABSOLUTE/PATH/TO/REPO#$PWD#" /tmp/di-bag-phase-05/show-diagnostics.test.ts
FIXTURE=tests/types/negative/installed-modules.ts bun test /tmp/di-bag-phase-05/show-diagnostics.test.ts
```

What decides the spikes here: for S7, cases one to three of `installed-modules.ts` must report on the element line. For S1, every `withTokenService`, `withServiceAlias`, `withCollectionContribution` and `withReplacedService` case above must report on its marked property line. Both replacement paths must pass independently. `buildModule` is outside S1. Record each result, with the line the compiler reported, in `docs/superpowers/plans/evidence/phase-05.md` (Task 6 creates it).

- [ ] **Step 5: Commit**

```bash
git add tests/types tests/types.test.ts
git commit -F - <<'MSG'
test(types): fixtures for the builder bags and the module list

Negative cases put their marker on the offending property or list element, so
a diagnostic reported on the whole call fails the fixture.

Generated-documentation-only red under the phase-5 exception; the phase
evidence records the observed failures and commands. The 400-line API-card
budget is unchanged. Skip this commit during git bisect; Tasks 12-13
contract the surface and restore both documentation checks.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

---

### Task 6: Measure spikes S1 and S7, decide, and the two fallbacks

**Files:**
- Modify: `tests/compiler.ts` (the `moduleListScaleSource` generator)
- Create: `scripts/check-module-list-scale.ts`, `scripts/check-builder-bag-scale.ts`, `docs/superpowers/plans/evidence/phase-05.md`
- Modify, only when a fallback is taken: `docs/guides/api-naming.md` ("Measured exceptions")

**Interfaces:**
- Consumes: `scripts/evidence-cases.mjs` (phase 0), `compilerProgram`, `describeDiagnostic` from `tests/compiler.ts`.
- Produces: the decision for each of the four bag methods and for the module list, BEFORE any call site moves. The decision cannot wait for the contract step: the codemod maps 0.4.0 names, so once it has rewritten 2,000 call sites into bags there is no map that takes them back.

Why the expand state is the right place to measure: old and new methods exist side by side, so the same graph written both ways is compiled against the same `src`, and the RATIO new/old is the cost of the shape alone. Absolute numbers in this state are inflated by the doubled `Builder` surface and are not compared with the baseline.

- [ ] **Step 1: Add the module-list generator**

Append to `tests/compiler.ts`. The planner ran this function under Node and read its output for counts 1, 2, 3, 10 and 50 (a 50-module list is one call with 50 elements; the collision marker of a 10-module list sits on line 44, on the repeated element). Nothing it emits was compiled. `DiBag.token(...).of<number>()` and `DiBag.fromFunction` are the names on entry; phase 8 renames them here as everywhere else.

```ts
export type ModuleListShape = 'separate-0.4' | 'separate-0.5' | 'one-list';
export type ModuleListCase = 'valid' | 'colliding-export';

/**
 * `count` distinct token modules, each depending on the one before it, installed into one host.
 * `separate-0.4` installs them with one `installModule` call each (what 0.4.0 callers write),
 * `separate-0.5` with one `withInstalledModules([module])` call each, `one-list` with a single list.
 * `colliding-export` repeats the first module as the last element; the marker sits on that element.
 */
export function moduleListScaleSource(count: number, shape: ModuleListShape, scenario: ModuleListCase = 'valid') {
  if (!Number.isInteger(count) || count < 1) throw new Error('module list count must be at least one');
  const old = shape === 'separate-0.4';
  const declarations = Array.from({ length: count }, (_, index) =>
    `const key${index} = Symbol('service${index}');\nconst token${index} = DiBag.token(key${index}).of<number>();`);
  const provider = (index: number) => index === 0 ? '() => 1' : `DiBag.fromFunction([token${index - 1}], value => value + 1)`;
  const modules = Array.from({ length: count }, (_, index) => old
    ? `const module${index} = DiBag.createBuilder().register(token${index}, ${provider(index)}).buildModule([token${index}]);`
    : `const module${index} = DiBag.createBuilder().withTokenService({ token: token${index}, provider: ${provider(index)} }).buildModule({ exportedServiceKeys: [token${index}] });`);
  const names = Array.from({ length: count }, (_, index) => `module${index}`);
  const boundary = '/* module-list-boundary */';
  if (scenario === 'colliding-export') names.push(`module0 ${boundary}`);
  const installs = shape === 'one-list'
    ? `  .withInstalledModules([\n${names.map(name => name.includes(boundary) ? `    ${name.replace(` ${boundary}`, '')}, ${boundary}` : `    ${name},`).join('\n')}\n  ])`
    : names.map(name => {
      const marker = name.includes(boundary) ? ` ${boundary}` : '';
      const bare = name.replace(` ${boundary}`, '');
      return old ? `  .installModule(${bare})${marker}` : `  .withInstalledModules([${bare}])${marker}`;
    }).join('\n');
  const terminal = old ? '.build()' : '.buildContainer()';
  return `import { DiBag } from '../src';
${declarations.join('\n')}
${modules.join('\n')}
const graph = DiBag.createBuilder()
${installs}
  ${terminal};
const result: number = graph.resolve(token${count - 1});
`;
}
```

- [ ] **Step 2: Add the worker**

Create `scripts/check-module-list-scale.ts`, modelled on `scripts/check-token-scale.ts`:

```ts
import { performance } from 'node:perf_hooks';
import ts from 'typescript';
import { compilerProgram, describeDiagnostic, moduleListScaleSource, tokenScalePath } from '../tests/compiler.ts';
import type { ModuleListCase, ModuleListShape } from '../tests/compiler.ts';

const shapes: ModuleListShape[] = ['separate-0.4', 'separate-0.5', 'one-list'];
const scenarios: ModuleListCase[] = ['valid', 'colliding-export'];
const shape = shapes.find(value => value === process.argv[2]);
const scenario = scenarios.find(value => value === process.argv[3]);
const count = Number(process.argv[4]);
if (!shape || !scenario || process.argv.length > 5 || ![1, 10, 50, 100].includes(count)) throw new Error('usage: check-module-list-scale.ts <separate-0.4|separate-0.5|one-list> <valid|colliding-export> <1|10|50|100>');

const source = moduleListScaleSource(count, shape, scenario);
const start = performance.now();
const program = compilerProgram(tokenScalePath, source);
const diagnostics = ts.getPreEmitDiagnostics(program).map(describeDiagnostic);
const boundary = source.split('\n').findIndex(line => line.includes('module-list-boundary')) + 1;
console.log(JSON.stringify({
  count, shape, scenario, typescript: ts.version, node: process.version,
  milliseconds: Math.round(performance.now() - start),
  maxRssMiB: Math.round(process.resourceUsage().maxRSS / 1024),
  boundaryLine: boundary === 0 ? undefined : boundary,
  diagnostics: diagnostics.map(item => ({ code: item.code, line: item.line, message: item.message.slice(0, 160) })),
  instantiations: program.getInstantiationCount(),
}));
```

- [ ] **Step 3: Measure S7**

One case per process, never in parallel:

```bash
N="node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON"
for count in 1 10 50 100; do for shape in separate-0.4 separate-0.5 one-list; do $N scripts/check-module-list-scale.ts $shape valid $count; done; done | tee /tmp/di-bag-phase-05/s7.jsonl
$N scripts/check-module-list-scale.ts one-list colliding-export 10
```

Read the rows this way:

| Comparison | What it isolates |
| --- | --- |
| `one-list` against `separate-0.5`, same count | the fold alone: both declare their modules with the same 0.5.0 calls and differ only in how they install them |
| `separate-0.5` against `separate-0.4`, same count | the renames and bags without any list: `withTokenService`, the `buildModule` bag, a one-element list per call |
| `separate-0.4` at 100 against `node scripts/check-token-scale.ts modules valid 100` run on the same tree | a sanity check: the two generators emit the same calls, so the counts are expected to be equal or within a fraction of a percent. A large gap means the generator was mistyped |

**Decision rule for S7.** Adopt the list when all of these hold; otherwise take the fallback below.
1. Every `valid` row has `diagnostics: []`, in particular no code 2589 at 50 modules.
2. The `colliding-export` row has exactly one diagnostic, its `line` equals `boundaryLine`, and its message contains `introduces new names or typed tokens only`.
3. Cases one to three of `tests/types/negative/installed-modules.ts` passed in Task 5.
4. `one-list` costs at most 10% more instantiations than `separate-0.5` at 10 and at 50 modules. A list is expected to cost LESS than separate calls, because one call checks what N calls checked; that expectation was not measured.
5. Use the 100-module rows because the cumulative evidence case is `modules 100`. Let `B` be its phase-0 baseline instantiations, `P` the on-entry `separate-0.4` result, and `N` the on-entry `one-list` result. Record `r = N / P` and the projected final value `F = P * r` (which equals `N` on the same entry tree). The cumulative rule is exactly `F <= 1.10 * B`; an earlier improvement gives headroom automatically and is never subtracted as a percentage. This is separate from criterion 4's fold-only comparison and from the `separate-0.5` rename-only row.

- [ ] **Step 4: Measure S1**

Two of the four bag methods are covered by an evidence case: `bindings` is a chain of `register(token, provider)` and `replacement` a chain of `replace(key, provider)`. Give `tests/compiler.ts` a switch that the evidence script's child processes inherit. At the top of `tests/compiler.ts`, below the imports:

```ts
/** Spike S1 of phase 5 only: `DI_BAG_SCALE_API=0.5` makes the scale generators emit the 0.5.0 builder calls. Task 9 removes the switch. */
const bagCalls = process.env.DI_BAG_SCALE_API === '0.5';
```

In `scaleSource`, the three `.register(` strings become `${bagCalls ? '.withServices(' : '.register('}`, the replacement line becomes

```ts
        return bagCalls ? `.withReplacedService({ serviceKey: 'svc${index}', provider: ${factory} })` : `.replace('svc${index}', ${factory})`;
```

and the terminal `.build()` becomes `${bagCalls ? '.buildContainer()' : '.build()'}`. In `tokenScaleSource`, the binding line becomes

```ts
      return bagCalls ? `  .withTokenService({ token: token${index}, provider: ${provider(index)} })${marker}` : `  .register(token${index}, ${provider(index)})${marker}`;
```

Leave its `modules` form alone in this step; S7 measured it. Then:

```bash
node scripts/evidence-cases.mjs --json /tmp/di-bag-phase-05/s1-old.json > /tmp/di-bag-phase-05/s1-old.md
DI_BAG_SCALE_API=0.5 node scripts/evidence-cases.mjs --json /tmp/di-bag-phase-05/s1-new.json > /tmp/di-bag-phase-05/s1-new.md
node -e "
const load = file => new Map(require(file).map(row => [row.form + ' ' + row.count, row]));
const before = load('/tmp/di-bag-phase-05/s1-old.json'), after = load('/tmp/di-bag-phase-05/s1-new.json');
for (const [id, row] of after) console.log(id.padEnd(18), String(before.get(id).instantiations).padStart(12), String(row.instantiations).padStart(12), ((row.instantiations / before.get(id).instantiations - 1) * 100).toFixed(1) + '%', row.accepted ? '' : 'REJECTED');
"
```

Both runs take about 75 seconds each and up to 2.3 GB for a 500-operation case; run nothing else heavy meanwhile. `withServiceAlias` and `withCollectionContribution` have no evidence case. Create `scripts/check-builder-bag-scale.ts` with the complete worker below:

```ts
import { performance } from 'node:perf_hooks';
import ts from 'typescript';
import { compilerProgram, describeDiagnostic, tokenScalePath } from '../tests/compiler.ts';

type Form = 'alias' | 'contribution';
type Shape = 'positional-0.4' | 'bag-0.5';
const forms: readonly Form[] = ['alias', 'contribution'];
const shapes: readonly Shape[] = ['positional-0.4', 'bag-0.5'];
const form = forms.find(value => value === process.argv[2]);
const shape = shapes.find(value => value === process.argv[3]);
const count = Number(process.argv[4]);
if (!form || !shape || process.argv.length !== 5 || !Number.isSafeInteger(count) || count < 1) {
  throw new Error('usage: check-builder-bag-scale.ts <alias|contribution> <positional-0.4|bag-0.5> <positive-count>');
}
const bags = shape === 'bag-0.5';
const aliasChain = (count: number, bags: boolean) => `import { DiBag } from '${process.cwd()}/src';
const base = DiBag.createBuilder().${bags ? 'withServices' : 'register'}({ svc: () => 1 });
const graph = base
${Array.from({ length: count }, (_, index) => bags ? `  .withServiceAlias({ aliasKey: 'alias${index}', targetServiceKey: 'svc' })` : `  .alias('alias${index}', 'svc')`).join('\n')}
  .${bags ? 'buildContainer' : 'build'}();
const last: number = graph.resolve('alias${count - 1}');
`;
const contributionChain = (count: number, bags: boolean) => `import { DiBag } from '${process.cwd()}/src';
const key = Symbol('items');
const items = DiBag.token(key).forCollectionOf<number>();
const graph = DiBag.createBuilder()
${Array.from({ length: count }, (_, index) => bags ? `  .withCollectionContribution({ collectionToken: items, provider: () => ${index} })` : `  .contribute(items, () => ${index})`).join('\n')}
  .${bags ? 'buildContainer' : 'build'}();
const all: readonly number[] = graph.resolve(items);
`;

const source = form === 'alias' ? aliasChain(count, bags) : contributionChain(count, bags);
const start = performance.now();
const program = compilerProgram(tokenScalePath, source);
const diagnostics = ts.getPreEmitDiagnostics(program).map(describeDiagnostic);
console.log(JSON.stringify({
  form, shape, count, typescript: ts.version, node: process.version,
  milliseconds: Math.round(performance.now() - start),
  maxRssMiB: Math.round(process.resourceUsage().maxRSS / 1024),
  diagnostics: diagnostics.map(item => ({ code: item.code, line: item.line, message: item.message.slice(0, 160) })),
  instantiations: program.getInstantiationCount(),
}));
```

Run one fresh process per row, never in parallel:

```bash
N="node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON"
for form in alias contribution; do
  for shape in positional-0.4 bag-0.5; do
    $N scripts/check-builder-bag-scale.ts "$form" "$shape" 100
  done
done | tee /tmp/di-bag-phase-05/s1-pairs.jsonl
```

Expected: four JSON rows; each has the requested `form`, `shape`, `count: 100`, `diagnostics: []`, and a positive `instantiations` value.

**Decision rule for S1, per method.** Adopt the bag when its fixtures of Task 5 report on the property, and:
- `withTokenService`: for each of `bindings 100` and `bindings 500`, let baseline be `B`, old-on-entry be `P`, new-on-entry be `N`, and ratio `r = N / P`; require the projected final `F = P * r = N` to satisfy `F <= 1.10 * B`.
- `withReplacedService`: apply the same formula to `replacement 100` and `replacement 500`. Also confirm the zero-dependency fast path survived: the `replacement` rows must not grow by a multiple. At 0.4.0 the fast path is what keeps `replacement 500` at 21.8 million instantiations; losing it shows as a jump far beyond 10%.
- `withServiceAlias`, `withCollectionContribution`: the 100-call chain grows by no more than 10%.
- `bulk`, `chained` and `grouped` only rename `register` to `withServices`; they are expected to move by well under 1%, and a larger move means something other than the rename changed.

- [ ] **Step 5: Write the evidence file**

Create `docs/superpowers/plans/evidence/phase-05.md` with: the S7 table (count, shape, instantiations, diagnostics), the S1 table (case, old, new, change), the two chain measurements, the line each Task 5 negative case was reported on, and one line per decision: `S1 withTokenService: adopted` or `fallback`, likewise the other three, and `S7: adopted` or `fallback`, each with the number that decided it. Commit it with the generator and the worker:

```bash
git add tests/compiler.ts scripts/check-module-list-scale.ts scripts/check-builder-bag-scale.ts docs/superpowers/plans/evidence/phase-05.md
git commit -F - <<'MSG'
test(evidence): measure the builder bags and the module list

Generated-documentation-only red under the phase-5 exception; the phase
evidence records the observed failures and commands. The 400-line API-card
budget is unchanged. Skip this commit during git bisect; Tasks 12-13
contract the surface and restore both documentation checks.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

#### Fallback for S1, per method: two positional parameters

Take it only for a method that failed its rule, and keep the bag for the others. For a failed method `M` with positional names `(first, second)`: `withTokenService(token, provider)`, `withServiceAlias(aliasKey, targetServiceKey)`, `withCollectionContribution(collectionToken, provider)`, `withReplacedService(serviceKey, provider)`.

1. In `src/di-bag.ts` (for the contribution, in `src/contribution-types.ts`), replace the parameter `options: { readonly first: A; readonly second: B }` by the two parameters `first: A, second: B` with the SAME types `A` and `B`. This is exactly the 0.4.0 signature under the new name. Keep the `...invalid` rest parameter where the method has one.
2. In the body, delete the `snapshotOptionsBag` line and use the parameters directly. The method then has no new validation site and raises no `DI_BAG_INVALID_ARGUMENT`.
3. In the JSDoc, write one `@param` per parameter, remove `DI_BAG_INVALID_ARGUMENT` from `@throws`, and make the example positional.
4. In `tests/builder-renames.test.ts`: remove the method's row from the `cases` list of `a two-input builder method rejects a malformed options bag...`, and call it positionally everywhere else. For `withTokenService` also rewrite `an options bag is read once...` against a method that kept its bag, or delete that test if none did.
5. In the fixtures of Task 5, call the method positionally; the markers stay on the offending ARGUMENT line.
6. In Task 7, the method's map entry loses its `arguments` member and becomes a plain rename: `{ "owner": "Builder", "from": "alias", "to": "withServiceAlias" }`. For `register` keep `"arity": [2]`.
7. In Tasks 9 to 12, write that method positionally in every generator, fixture and document, and teach `tools/graph` the positional form under the new name (Task 11 says where).
8. Record it. Add one row to the table under "Measured exceptions" in `docs/guides/api-naming.md`: the shape in the design note (`withServiceAlias({ aliasKey, targetServiceKey })`), the fallback taken (`withServiceAlias(aliasKey, targetServiceKey)`), the measurement that forced it (the case, old and new instantiations, the percentage, or the fixture case whose diagnostic left its property), and `docs/superpowers/plans/evidence/phase-05.md` as the record.

#### Fallback for S7: the singular `withInstalledModule(module)`

1. Delete `src/install-types.ts` and its import.
2. In `src/di-bag.ts`, replace `withInstalledModules` by the method below. Its signature is `installModule`'s, under the new name:

```ts
  withInstalledModule<P extends object, R extends object, MC extends NeedConstraint, D extends Registrations>(
    module: Module<P, R, MC, D> & IntroducesKeys<EntryKeys<Entries>, keyof D> &
      IncrementalChecked<Entries, D> &
      IncrementalConstraints<Constraints, MC, RegistrationsFromEntries<Entries>, D>,
  ): Builder<Entries | RegistrationEntries<D>, Constraints | MC> {
    return new Builder(this.#graph.withInstallation(moduleGraph(module, 'withInstalledModule'), 'withInstalledModule'), this.context);
  }
```

   Its JSDoc is the one of `withInstalledModules` with "a sealed module" for "sealed modules in list order", without the sentence about the list, without `DI_BAG_INVALID_ARGUMENT`, and with the example calling `.withInstalledModule(greeting)`.
3. In `src/module.ts` and `src/runtime.ts`, the operation union becomes `'installModule' | 'withInstalledModule'`, `moduleGraph` loses its `index` parameter, and its message for the new operation is `withInstalledModule requires a genuine module`.
4. In `tests/builder-renames.test.ts`: every `.withInstalledModules([a, b])` becomes `.withInstalledModule(a).withInstalledModule(b)`. Delete the tests `withInstalledModules snapshots the list by index...` and the non-array and hole cases of `withInstalledModules rejects a bad list...`; keep its not-a-module, duplicate and collision cases with `details` equal to `{ operation: 'withInstalledModule' }` and `{ operation: 'withInstalledModule', key }`. Keep the order test: separate calls must still contribute in call order.
5. Delete `tests/types/negative/installed-modules.ts` and move its first three cases, as separate calls with the marker above the offending call's argument, into `tests/types/negative/builder-renames.ts`. In `tests/types/builder-renames.ts` install one module per call.
6. Task 7: the map entry is `{ "owner": "Builder", "from": "installModule", "to": "withInstalledModule" }` with no `arguments`, and the fixture's expected file has no array brackets.
7. Tasks 9 to 12: one call per module everywhere; `AGENTS.md` keeps "one call per line"; `tools/graph` learns only the new name. `tests/compiler.ts` keeps `moduleListScaleSource` out: delete it and `scripts/check-module-list-scale.ts` after recording their numbers.
8. Record it under "Measured exceptions" in `docs/guides/api-naming.md`, as in the S1 fallback, with the failed criterion: the count at which `TS2589` appeared, or the line on which the collision was reported, or the percentage.

---

### Task 7: Teach the codemod every 0.4.0 builder call (migrate, data first)

**Files:**
- Modify: `tools/codemod/rename-map.json`
- Create: `tools/codemod/test/fixtures/builder-renames/input.ts`, `expected.ts`, `expected-manual.json`
- Modify: every shipped-map fixture `expected.ts` found by Task 0, especially `build-and-start/expected.ts`
- Test: `tools/codemod/test/fixtures.test.mjs`, `tools/codemod/test/rename-map.test.mjs`

**Interfaces:**
- Consumes: phase 1's generic `bag` and `array` argument transforms. A map owner is the declaration's **0.4.0** name. A reshaped member reference that is not called remains unchanged and becomes a manual item.
- Produces: one-pass 0.4.0-to-0.5.0 rewrites. `buildAndStart`'s existing transform now emits `buildContainer()` because it asks `api.nameOf('Builder', 'build')`.

- [ ] **Step 1: Add the exact shipped-map entries**

Merge these entries into the existing arrays; do not replace entries from phases 3 and 4. If Task 6 selected a fallback, apply the exact map variation stated in that fallback instead.

```json
{
  "methods": [
    { "owner": "Builder", "from": "register", "to": "withServices", "arity": [1] },
    { "owner": "Builder", "from": "register", "to": "withTokenService", "arity": [2], "arguments": { "kind": "bag", "names": ["token", "provider"] } },
    { "owner": "Builder", "from": "alias", "to": "withServiceAlias", "arguments": { "kind": "bag", "names": ["aliasKey", "targetServiceKey"] } },
    { "owner": "Builder", "from": "contribute", "to": "withCollectionContribution", "arguments": { "kind": "bag", "names": ["collectionToken", "provider"] } },
    { "owner": "Builder", "from": "replace", "to": "withReplacedService", "arguments": { "kind": "bag", "names": ["serviceKey", "provider"] } },
    { "owner": "Builder", "from": "installModule", "to": "withInstalledModules", "arguments": { "kind": "array" } },
    { "owner": "Builder", "from": "verifyGraph", "to": "verifyGraphAtCompileTime" },
    { "owner": "Builder", "from": "buildModule", "to": "buildModule", "arguments": { "kind": "bag", "names": ["exportedServiceKeys"], "trailing": { "mode": "merge", "keys": { "label": "moduleLabel" } } } },
    { "owner": "Builder", "from": "build", "to": "buildContainer" }
  ],
  "properties": [
    { "owner": "ModuleOptions", "from": "label", "to": "moduleLabel" }
  ],
  "types": [
    { "from": "BuilderContribute", "to": "BuilderWithCollectionContribution" }
  ]
}
```

Keep the method/property/type changes in this single pass: consumer declarations may import `BuilderContribute` and then call its two positional parameters.

- [ ] **Step 2: Add the fixture input**

Create `tools/codemod/test/fixtures/builder-renames/input.ts`:

```ts
import { DiBag, type BuilderContribute, type ModuleOptions } from 'di-bag';

const clockKey = Symbol('clock');
const clock = DiBag.token(clockKey).of<{ now(): number }>();
const toolsKey = Symbol('tools');
const tools = DiBag.token(toolsKey).of<string>();
const label = 'feature';
const options: ModuleOptions = { label };
const deferredOptions: ModuleOptions = options;

const feature = DiBag.createBuilder()
  .register({ name: () => 'Ada' })
  .register(clock, () => ({ now: () => 1 }))
  .alias('now', clock)
  .contribute(tools, () => 'search')
  .replace('name', () => 'Grace')
  .buildModule(['name', clock], { label });

export const deferred = DiBag.createBuilder()
  .register({ value: () => 1 })
  .buildModule(['value'], deferredOptions);

const builder = DiBag.createBuilder().installModule(feature);
builder.verifyGraph() satisfies void;
export const app = builder.build();
export const extracted: BuilderContribute<any, any> = builder.contribute;
```

Create `expected.ts`:

```ts
import { DiBag, type BuilderWithCollectionContribution, type ModuleOptions } from 'di-bag';

const clockKey = Symbol('clock');
const clock = DiBag.token(clockKey).of<{ now(): number }>();
const toolsKey = Symbol('tools');
const tools = DiBag.token(toolsKey).forCollectionOf<string>();
const label = 'feature';
const options: ModuleOptions = { moduleLabel: label };
const deferredOptions: ModuleOptions = options;

const feature = DiBag.createBuilder()
  .withServices({ name: () => 'Ada' })
  .withTokenService({ token: clock, provider: () => ({ now: () => 1 }) })
  .withServiceAlias({ aliasKey: 'now', targetServiceKey: clock })
  .withCollectionContribution({ collectionToken: tools, provider: () => 'search' })
  .withReplacedService({ serviceKey: 'name', provider: () => 'Grace' })
  .buildModule({ exportedServiceKeys: ['name', clock], moduleLabel: label });

export const deferred = DiBag.createBuilder()
  .withServices({ value: () => 1 })
  .buildModule(['value'], deferredOptions);

const builder = DiBag.createBuilder().withInstalledModules([feature]);
builder.verifyGraphAtCompileTime() satisfies void;
export const app = builder.buildContainer();
export const extracted: BuilderWithCollectionContribution<any, any> = builder.contribute;
```

The accumulated phase-4 map changes `DiBag.token(...).of<string>()` to `.forCollectionOf<string>()` because the original `Builder.contribute` establishes the token as collection-only; the fixture must pin that cross-transform behavior. The nonliteral `deferredOptions` call cannot be merged safely, so its call remains 0.4.0 text in `expected.ts` even though the separately typed object's `label` property is renamed. The final property reference likewise cannot safely be reshaped.

Create `expected-manual.json` with the exact input-source line numbers and reasons:

```json
[
  {
    "line": 21,
    "reason": "the last argument of buildModule is not an object literal; merge it into the buildModule bag by hand"
  },
  {
    "line": 26,
    "reason": "contribute is referenced without being called; rewrite this reference to withCollectionContribution by hand"
  }
]
```

The expected source keeps `buildModule(['value'], deferredOptions)` and `builder.contribute` unchanged, while the child `.register({ value: ... })` still becomes `.withServices({ value: ... })` because recursive child rewrites compose even when the parent call is manual. If the fixture input above is deliberately reformatted, update these two numbers from the fixture runner in the same edit.

- [ ] **Step 3: Update composed fixtures and run the codemod tests**

In every fixture that uses the shipped map, update its expected output for names introduced here. In `build-and-start/expected.ts`, the chain ends `.buildContainer().ensureServicesReady(...)`. Do not edit fixture `input.ts`: it is always 0.4.0 input.

Run:

```bash
node --test tools/codemod/test/rename-map.test.mjs tools/codemod/test/fixtures.test.mjs
```

Expected: exit 0; every subtest passes. Then run `npm run codemod:check`; expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add tools/codemod
git commit -F - <<'MSG'
feat(codemod): migrate the builder surface

The map still describes one pass from 0.4.0 source to 0.5.0 source.

Generated-documentation-only red under the phase-5 exception; the phase
evidence records the observed failures and commands. The 400-line API-card
budget is unchanged. Skip this commit during git bisect; Tasks 12-13
contract the surface and restore both documentation checks.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

---

### Task 8: Apply the codemod to typed repository call sites (migrate)

**Files:**
- Modify: typed `.ts` call sites under `tests/`, `examples/`, and root `scripts/` included by `tsconfig.json`
- Modify: `tests/types/isolated/thenable-policy.ts`
- Verify and preserve: `tests/types/negative/startup.ts` (migrate its legitimate builder calls in the prior preparation commit; its two rejected old-close controls, `timeoutMs: 1` and `signal: new AbortController().signal`, remain byte-identical)
- Create temporarily, then delete: `/tmp/di-bag-phase-05/codemod-dry-run-report.json`, `/tmp/di-bag-phase-05/codemod-manual-classification.json`, `/tmp/di-bag-phase-05/negative-startup-before.ts`, `/tmp/di-bag-phase-05/negative-startup-prepared.ts`, `/tmp/di-bag-phase-05/all-negative-files.txt`, `/tmp/di-bag-phase-05/codemod-write-negative-files.txt`, `/tmp/di-bag-phase-05/codemod-write-command.sh`, `/tmp/di-bag-phase-05/codemod-write-report.json`, `/tmp/di-bag-phase-05/codemod-generated-files.txt`, `/tmp/di-bag-phase-05/codemod-working-tree-files.txt`, `/tmp/di-bag-phase-05/codemod-manual-files.txt`, the Task 8 documentation status/log/inventory files, and the three commit-message files below

**Interfaces:**
- Consumes: Task 7's shipped map, phase 1's CLI, and Phase 4's preserved rejected old-close controls. The accumulated map still contains Phase 3's `Bag.close` option renames.
- Produces: a compiler/runtime-green preparation commit for the coherent `startup.ts` builder projection, a pure report-generated mechanical commit, and a separate compiler/runtime-green hand commit when manual items exist. All checker-resolvable 0.4.0 builder calls in the main project use the Task 6 decision; the two old-close controls remain rejected. Generated text, JavaScript, Markdown, graph fixtures and agent-eval projects remain for later tasks.

- [ ] **Step 1: Build declarations and preview every negative fixture**

```bash
npm run build
node tools/codemod/cli.mjs --project tsconfig.json --library-root src --library-root dist --extra-files 'tests/types/negative/*.ts' --extra-files 'tests/types/isolated/*.ts' --report /tmp/di-bag-phase-05/codemod-dry-run-report.json
node - <<'JS'
const { writeFileSync } = require('node:fs');
const report = require('/tmp/di-bag-phase-05/codemod-dry-run-report.json');
const skipped = report.manual.filter(item => item.reason.startsWith('this file was left untouched'));
const startup = report.files.filter(item => item.file === 'tests/types/negative/startup.ts');
if (report.written !== false || skipped.length !== 0 || startup.length !== 1) process.exit(1);
const closeReason = 'argument 1 of close is not a literal; where it is built, apply: key signal to abortSignal; key timeoutMs to waitTimeoutMs';
const inherited = new Set([
  'examples/react/app-runtime.ts',
  'examples/react/project-runtime.ts',
  'tests/react/runtime-owner.test.ts',
  'tests/runtime-diagnostics.test.ts',
].map(file => `${file}\0${closeReason}`));
for (const key of inherited) {
  if (report.manual.filter(item => `${item.file}\0${item.reason}` === key).length !== 1) throw new Error(`missing or duplicate inherited manual: ${key}`);
}
const classified = report.manual.map(item => ({
  file: item.file,
  line: item.line,
  reason: item.reason,
  owner: inherited.has(`${item.file}\0${item.reason}`) ? 'phase-3-retained-pass-through' : null,
  resolution: inherited.has(`${item.file}\0${item.reason}`) ? 'already migrated where the nonliteral CloseOptions value is built; retain this exact pass-through report' : null,
}));
writeFileSync('/tmp/di-bag-phase-05/codemod-manual-classification.json', `${JSON.stringify(classified, null, 2)}\n`);
console.log({ written: report.written, skipped: skipped.length, startup: startup.length, manuals: classified.length });
JS
```

Expected: exit 0, `written: false`, a non-zero rewrite count, and no file skipped. Read every
manual item. Do not convert arbitrary `.replace()` or `.build()` calls reported outside a library
declaration. Classify a manual item as either a prerequisite without which the generated tree cannot
pass its runtime/compiler checks, or a post-mechanical hand migration. Never fold either into the
mechanical commit.

The classification file pins every row by exact path, line and reason. The script preclassifies the
four inherited Phase 3 `close` pass-through rows by exact path/reason. Fill every remaining `null`
with `task-8-prerequisite`, `task-8-post-mechanical`, or the exact later task number and a concrete
resolution. A later owner is valid only when that task's Files/Interfaces explicitly own the path and
surface. Before continuing, assert that no `null` remains and record the classification in the Task 8
report; do not treat an inherited or later-owned manual as an unresolved Task 8 defect.

```bash
node - <<'JS'
const rows = require('/tmp/di-bag-phase-05/codemod-manual-classification.json');
const owners = new Set(['phase-3-retained-pass-through', 'task-8-prerequisite', 'task-8-post-mechanical', 'task-9', 'task-10', 'task-11', 'task-12', 'task-13']);
if (rows.some(row => !owners.has(row.owner) || typeof row.resolution !== 'string' || row.resolution.length === 0)) process.exit(1);
console.log(rows.map(({ file, line, reason, owner }) => ({ file, line, reason, owner })));
JS
```

The inclusive preview deliberately finds both kinds of change in
`tests/types/negative/startup.ts`: legitimate builder rewrites and the accumulated map's two
forbidden old-close rewrites. Save the entry bytes and apply only the exact codemod projection with
those two controls restored:

```bash
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { loadTypeScript, runCodemod } from './tools/codemod/lib/codemod.mjs';
const root = process.cwd();
const file = 'tests/types/negative/startup.ts';
const before = readFileSync(file, 'utf8');
const compiler = loadTypeScript(root);
const result = runCodemod({
  typescript: compiler.ts,
  root,
  project: 'tsconfig.json',
  extraFiles: ['tests/types/negative/*.ts', 'tests/types/isolated/*.ts'],
  libraryRoots: ['src', 'dist'],
  only: [file],
});
assert.equal(result.files.length, 1);
assert.equal(result.files[0].file, file);
let prepared = result.files[0].text;
const controls = [
  ['closable.close({ timeoutMs: 1 });', 'closable.close({ waitTimeoutMs: 1 });'],
  ['closable.close({ signal: new AbortController().signal });', 'closable.close({ abortSignal: new AbortController().signal });'],
];
for (const [oldText, mappedText] of controls) {
  assert.equal(before.split(oldText).length - 1, 1, `expected one old-close control: ${oldText}`);
  assert.equal(prepared.split(oldText).length - 1, 0, `codemod did not map control: ${oldText}`);
  assert.equal(prepared.split(mappedText).length - 1, 1, `unexpected mapped control count: ${mappedText}`);
  prepared = prepared.replace(mappedText, oldText);
}
assert.notEqual(prepared, before, 'startup fixture has no legitimate builder migration');
writeFileSync('/tmp/di-bag-phase-05/negative-startup-before.ts', before);
writeFileSync('/tmp/di-bag-phase-05/negative-startup-prepared.ts', prepared);
writeFileSync(file, prepared);
console.log('startup preparation: codemod projection with exactly two old-close controls restored');
JS
```

Run the focused negative fixture, the full typecheck, codemod checks, and the applicable narrow
runtime tests. If a classified manual prerequisite is required to make the generated boundary pass,
resolve it now and include it in this preparation commit; otherwise leave every manual item for Step
5. The two old-close statements must remain byte-identical to their entry text.

Apply the global generated-documentation exception to this and the next two Task 8 commits exactly
as observed. Immediately before each commit, set `task8_docs_label` to `preparation`, `mechanical`, or
`hand` and run this procedure on the intended commit tree before staging:

```bash
git diff --name-only | LC_ALL=C sort -u > "/tmp/di-bag-phase-05/docs-intended-tracked-${task8_docs_label}.txt"
git ls-files --others --exclude-standard | LC_ALL=C sort -u > "/tmp/di-bag-phase-05/docs-intended-untracked-${task8_docs_label}.txt"
set +e
npm run docs:generate > "/tmp/di-bag-phase-05/docs-generate-${task8_docs_label}.log" 2>&1
docs_generate_exit=$?
set -e
git diff --name-only | LC_ALL=C sort -u > "/tmp/di-bag-phase-05/docs-after-generate-tracked-${task8_docs_label}.txt"
git ls-files --others --exclude-standard | LC_ALL=C sort -u > "/tmp/di-bag-phase-05/docs-after-generate-untracked-${task8_docs_label}.txt"
comm -13 "/tmp/di-bag-phase-05/docs-intended-tracked-${task8_docs_label}.txt" "/tmp/di-bag-phase-05/docs-after-generate-tracked-${task8_docs_label}.txt" > "/tmp/di-bag-phase-05/docs-generated-tracked-${task8_docs_label}.txt"
comm -13 "/tmp/di-bag-phase-05/docs-intended-untracked-${task8_docs_label}.txt" "/tmp/di-bag-phase-05/docs-after-generate-untracked-${task8_docs_label}.txt" > "/tmp/di-bag-phase-05/docs-generated-untracked-${task8_docs_label}.txt"
while IFS= read -r file; do
  [ -z "$file" ] || case "$file" in docs/reference/*|docs/agent/api-card.md) ;; *) echo "unexpected generated path: $file" >&2; exit 1 ;; esac
done < "/tmp/di-bag-phase-05/docs-generated-tracked-${task8_docs_label}.txt"
while IFS= read -r file; do
  [ -z "$file" ] || case "$file" in docs/reference/*|docs/agent/api-card.md) ;; *) echo "unexpected generated path: $file" >&2; exit 1 ;; esac
done < "/tmp/di-bag-phase-05/docs-generated-untracked-${task8_docs_label}.txt"
if [ -s "/tmp/di-bag-phase-05/docs-generated-tracked-${task8_docs_label}.txt" ]; then
  git restore --pathspec-from-file="/tmp/di-bag-phase-05/docs-generated-tracked-${task8_docs_label}.txt"
fi
while IFS= read -r file; do [ -z "$file" ] || rm -- "$file"; done < "/tmp/di-bag-phase-05/docs-generated-untracked-${task8_docs_label}.txt"
git diff --name-only | LC_ALL=C sort -u | cmp --silent "/tmp/di-bag-phase-05/docs-intended-tracked-${task8_docs_label}.txt" -
git ls-files --others --exclude-standard | LC_ALL=C sort -u | cmp --silent "/tmp/di-bag-phase-05/docs-intended-untracked-${task8_docs_label}.txt" -
set +e
npm run docs:check > "/tmp/di-bag-phase-05/docs-check-${task8_docs_label}.log" 2>&1
docs_check_exit=$?
set -e
if [ "$docs_generate_exit" -eq 0 ] && [ ! -s "/tmp/di-bag-phase-05/docs-generated-tracked-${task8_docs_label}.txt" ] && [ ! -s "/tmp/di-bag-phase-05/docs-generated-untracked-${task8_docs_label}.txt" ] && [ "$docs_check_exit" -eq 0 ]; then
  printf '%s\n' green > "/tmp/di-bag-phase-05/docs-status-${task8_docs_label}.txt"
else
  printf '%s\n' candidate-generated-documentation-only > "/tmp/di-bag-phase-05/docs-status-${task8_docs_label}.txt"
fi
```

This deliberately runs `docs:check` after restoring only generated documentation, so its result
describes the tree that will be committed. Inspect both logs and generated-path inventories. Replace
`candidate-generated-documentation-only` with exactly `generated-documentation-only` only when every
observed difference/failure is inside the authorized stale-generated-doc or unchanged 400-line
budget scope; otherwise stop. A clean `docs:check` does not make the commit green when
`docs:generate` changed tracked or untracked output. Only an exact `green` status omits the exception
paragraph and bisect skip. Runtime, compiler, codemod, and applicable graph/agent checks remain
mandatory green.

Record the exact preparation paths and commit only this coherent compiler/runtime-green preparation. The message
builder makes the documentation paragraph conditional on that observed status:

```bash
bun test tests/types.test.ts -t startup
npm run typecheck
npm run codemod:check
bun test tests/builder-renames.test.ts
git diff --name-only | LC_ALL=C sort -u > /tmp/di-bag-phase-05/codemod-manual-files.txt
test -s /tmp/di-bag-phase-05/codemod-manual-files.txt
git add --pathspec-from-file=/tmp/di-bag-phase-05/codemod-manual-files.txt
task8_docs_status=$(cat /tmp/di-bag-phase-05/docs-status-preparation.txt)
{
  printf '%s\n' 'refactor!: prepare coherent typed builder migrations' '' 'Migrates the startup fixture’s legitimate builder calls while retaining its' 'two deliberately rejected old-close controls. Any additional path in this' 'commit is a recorded green prerequisite for the generated rewrite.'
  case "$task8_docs_status" in
    green) ;;
    generated-documentation-only) printf '%s\n' '' 'Generated-documentation-only red under the phase-5 exception; the phase' 'evidence records the observed npm run docs:generate and npm run docs:check' 'failures. The unchanged 400-line budget is restored by Tasks 12-13.' ;;
    *) exit 1 ;;
  esac
  printf '%s\n' '' 'Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>' 'Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL'
} > /tmp/di-bag-phase-05/codemod-preparation-commit-message.txt
git commit -F /tmp/di-bag-phase-05/codemod-preparation-commit-message.txt
```

- [ ] **Step 2: Rebuild and prove the post-preparation startup result exactly**

```bash
npm run build
node tools/codemod/cli.mjs --project tsconfig.json --library-root src --library-root dist --extra-files 'tests/types/negative/*.ts' --extra-files 'tests/types/isolated/*.ts' --report /tmp/di-bag-phase-05/codemod-dry-run-report.json
node - <<'JS'
const report = require('/tmp/di-bag-phase-05/codemod-dry-run-report.json');
const skipped = report.manual.filter(item => item.reason.startsWith('this file was left untouched'));
const startup = report.files.filter(item => item.file === 'tests/types/negative/startup.ts');
if (report.written !== false || skipped.length !== 0 || startup.length !== 1) process.exit(1);
console.log({ written: report.written, skipped: skipped.length, startup: startup.length, manuals: report.manual.length });
JS
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { loadTypeScript, runCodemod } from './tools/codemod/lib/codemod.mjs';
const root = process.cwd();
const file = 'tests/types/negative/startup.ts';
const before = readFileSync(file, 'utf8');
let expected = before;
const controls = [
  ['closable.close({ timeoutMs: 1 });', 'closable.close({ waitTimeoutMs: 1 });'],
  ['closable.close({ signal: new AbortController().signal });', 'closable.close({ abortSignal: new AbortController().signal });'],
];
for (const [oldText, mappedText] of controls) {
  assert.equal(expected.split(oldText).length - 1, 1, `expected one old-close control: ${oldText}`);
  expected = expected.replace(oldText, mappedText);
}
const compiler = loadTypeScript(root);
const result = runCodemod({
  typescript: compiler.ts,
  root,
  project: 'tsconfig.json',
  extraFiles: ['tests/types/negative/*.ts', 'tests/types/isolated/*.ts'],
  libraryRoots: ['src', 'dist'],
  only: [file],
});
assert.equal(result.files.length, 1);
assert.equal(result.files[0].file, file);
assert.equal(result.files[0].text, expected);
assert.equal(result.manual.filter(item => item.reason.startsWith('this file was left untouched')).length, 0);
writeFileSync('/tmp/di-bag-phase-05/negative-startup-prepared.ts', before);
console.log('startup preview: exactly two inherited old-close controls remain');
JS
```

Expected: the inclusive report still has `written: false`, zero skipped files, and exactly one
`startup.ts` entry. The exact-text proof rejects any remaining legitimate builder rewrite or any
third proposed change in that file.

- [ ] **Step 3: Write every typed file except the protected startup fixture**

Replace only the negative glob in the write command with a sorted explicit inventory that omits
exactly `tests/types/negative/startup.ts`. Retain the project, both library roots, and the isolated
glob:

```bash
rg --files tests/types/negative -g '*.ts' | LC_ALL=C sort > /tmp/di-bag-phase-05/all-negative-files.txt
grep -vxF 'tests/types/negative/startup.ts' /tmp/di-bag-phase-05/all-negative-files.txt > /tmp/di-bag-phase-05/codemod-write-negative-files.txt
python3 - <<'PY'
from pathlib import Path
all_files = Path('/tmp/di-bag-phase-05/all-negative-files.txt').read_text().splitlines()
write_files = Path('/tmp/di-bag-phase-05/codemod-write-negative-files.txt').read_text().splitlines()
assert all_files == sorted(set(all_files))
assert write_files == sorted(set(write_files))
assert [item for item in all_files if item not in write_files] == ['tests/types/negative/startup.ts']
assert write_files == [item for item in all_files if item != 'tests/types/negative/startup.ts']
PY
git diff --exit-code
git diff --cached --quiet
mapfile -t negative_extra_files < /tmp/di-bag-phase-05/codemod-write-negative-files.txt
negative_extra_args=()
for file in "${negative_extra_files[@]}"; do negative_extra_args+=(--extra-files "$file"); done
write_command=(node tools/codemod/cli.mjs --project tsconfig.json --library-root src --library-root dist "${negative_extra_args[@]}" --extra-files 'tests/types/isolated/*.ts' --write --report /tmp/di-bag-phase-05/codemod-write-report.json)
printf '%q ' "${write_command[@]}" > /tmp/di-bag-phase-05/codemod-write-command.sh
printf '\n' >> /tmp/di-bag-phase-05/codemod-write-command.sh
"${write_command[@]}"
node - <<'JS'
const { writeFileSync } = require('node:fs');
const report = require('/tmp/di-bag-phase-05/codemod-write-report.json');
const skipped = report.manual.filter(item => item.reason.startsWith('this file was left untouched'));
const startup = report.files.filter(item => item.file === 'tests/types/negative/startup.ts');
const generated = report.files.filter(item => item.rewrites > 0).map(item => item.file).sort();
if (report.written !== true || skipped.length !== 0 || startup.length !== 0 || generated.length === 0 || new Set(generated).size !== generated.length) process.exit(1);
writeFileSync('/tmp/di-bag-phase-05/codemod-generated-files.txt', `${generated.join('\n')}\n`);
console.log({ files: report.files.length, rewrites: report.files.reduce((sum, item) => sum + item.rewrites, 0), manual: report.manual.length, generated: generated.length });
JS
cmp --silent tests/types/negative/startup.ts /tmp/di-bag-phase-05/negative-startup-prepared.ts
bun test tests/types.test.ts -t startup
npm run typecheck
npm run codemod:check
bun test tests/builder-renames.test.ts
git diff --check
```

Every command above must pass. A manual item may remain because the old builder surface is still
present, but it may not make this boundary compiler/runtime red. If one is a prerequisite for green,
restore only the report-generated paths, make the prerequisite preparation commit described in Step
1, rebuild, and repeat Steps 2–3. Never change the accumulated map, rewrite either old-close control,
or use a red compiler/runtime waiver.

The failed-trial restoration is exact and must return to the clean post-preparation tree:

```bash
git diff --cached --quiet
git restore --pathspec-from-file=/tmp/di-bag-phase-05/codemod-generated-files.txt
git diff --exit-code
git diff --cached --quiet
```

- [ ] **Step 4: Commit only the report-generated mechanical rewrite**

Prove the successful report's generated inventory is exactly the working-tree diff, then stage only
that inventory. Reobserve both documentation commands and reset `task8_docs_status` before running
this block:

```bash
git diff --cached --quiet
git diff --name-only | LC_ALL=C sort > /tmp/di-bag-phase-05/codemod-working-tree-files.txt
cmp --silent /tmp/di-bag-phase-05/codemod-generated-files.txt /tmp/di-bag-phase-05/codemod-working-tree-files.txt
git add --pathspec-from-file=/tmp/di-bag-phase-05/codemod-generated-files.txt
git diff --cached --name-only | LC_ALL=C sort | cmp --silent /tmp/di-bag-phase-05/codemod-generated-files.txt -
task8_docs_status=$(cat /tmp/di-bag-phase-05/docs-status-mechanical.txt)
{
  printf '%s\n' 'refactor!: mechanically migrate typed builder calls' '' 'Generated with:'
  cat /tmp/di-bag-phase-05/codemod-write-command.sh
  printf '%s\n' '' 'Explicit sorted negative-fixture inventory (startup.ts is the sole omission):'
  cat /tmp/di-bag-phase-05/codemod-write-negative-files.txt
  printf '%s\n' '' 'Report-generated staged-file inventory:'
  cat /tmp/di-bag-phase-05/codemod-generated-files.txt
  case "$task8_docs_status" in
    green) ;;
    generated-documentation-only) printf '%s\n' '' 'Generated-documentation-only red under the phase-5 exception; the phase' 'evidence records the observed npm run docs:generate and npm run docs:check' 'failures. The unchanged 400-line budget is restored by Tasks 12-13.' ;;
    *) exit 1 ;;
  esac
  printf '%s\n' '' 'Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>' 'Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL'
} > /tmp/di-bag-phase-05/codemod-mechanical-commit-message.txt
git commit -F /tmp/di-bag-phase-05/codemod-mechanical-commit-message.txt
```

This is the only Task 8 commit called mechanical. Do not stage a manual resolution, diagnostic
marker edit, or unrelated file.

- [ ] **Step 5: Resolve manual items separately and preserve current diagnostics**

Resolve every remaining manual item in files owned by this task. For a reshaped extracted reference,
use an explicitly typed wrapper, for example:

```ts
const addTool = (collectionToken: typeof tools, provider: () => string) =>
  builder.withCollectionContribution({ collectionToken, provider });
```

The expanded old and new builder methods still share the existing admission types. Therefore keep
the current diagnostic marker text byte-for-byte in Task 8. The following nine replacements are the
Task 12 contract edit, when source diagnostics and fixtures change atomically; audit them now, but do
not apply them early:

| Old text | New text |
| --- | --- |
| `register requires finite string-keyed registration objects` | `withServices requires finite string-keyed provider objects` |
| `register introduces new names or typed tokens only` | `withServices and withTokenService introduce new names or typed tokens only` |
| `replace requires one existing singleton string-literal key` | `withReplacedService requires one existing singleton string-literal key` |
| `alias requires one singleton name or genuine token` | `withServiceAlias requires one singleton name or genuine token` |
| `alias requires an existing named target` | `withServiceAlias requires an existing named target` |
| `alias output is not assignable to destination service` | `withServiceAlias output is not assignable to alias service` |
| `register requires a single-service token` | `withTokenService requires a single-service token` |
| `alias destination requires a single-service token` | `withServiceAlias destination requires a single-service token` |
| `contribute requires a collection token` | `withCollectionContribution requires a collection token` |

Search all marker variants, including `diagnostic-also`, and save the inventory for Task 12:

```bash
rg -n "register requires|register introduces|replace requires|alias requires|alias output|contribute requires" tests/types tests/*.test.ts
```

If a focused compiler result contradicts the stated shared-type ordering, stop and report the exact
source diagnostic and fixture rather than changing markers speculatively or accepting a red compiler
commit.

The runtime assertion inventory for this phase is exactly one 0.4.0 `toThrow(...)` prefix at the planner's source:

```text
1 toThrow('alias'
```

It occurs in `tests/release-artifacts.test.ts`; rewrite its generated source/assertion consistently when Task 9 migrates that string fixture. This exact inventory was produced with:

```bash
grep -rhoE "toThrow\((/|['\`])[^)]*" tests | grep -iE "\b(register|alias|contribute|replace|installModule|verifyGraph|buildModule|build)\b" | sort | uniq -c
```

- [ ] **Step 6: Prove and commit the hand migration separately**

```bash
node tools/codemod/cli.mjs --project tsconfig.json --library-root src --library-root dist --extra-files 'tests/types/negative/*.ts' --extra-files 'tests/types/isolated/*.ts' --report /tmp/di-bag-phase-05/codemod-dry-run-report.json
node - <<'JS'
const assert = require('node:assert/strict');
const report = require('/tmp/di-bag-phase-05/codemod-dry-run-report.json');
const classified = require('/tmp/di-bag-phase-05/codemod-manual-classification.json');
const skipped = report.manual.filter(item => item.reason.startsWith('this file was left untouched'));
const startup = report.files.filter(item => item.file === 'tests/types/negative/startup.ts');
const outside = report.files.filter(item => item.file !== 'tests/types/negative/startup.ts' && item.rewrites !== 0);
const key = item => `${item.file}\0${item.reason}`;
const counts = rows => [...rows.reduce((map, row) => map.set(key(row), (map.get(key(row)) ?? 0) + 1), new Map())].sort(([a], [b]) => a.localeCompare(b));
const allowed = classified.filter(item => !item.owner.startsWith('task-8'));
assert.equal(report.written, false);
assert.equal(skipped.length, 0);
assert.equal(startup.length, 1);
assert.equal(outside.length, 0);
assert.deepEqual(counts(report.manual), counts(allowed), 'manual rows differ from exact inherited/later-owner classification');
console.log({ startupRewrites: startup[0].rewrites, outsideRewrites: outside.length, retainedOrLaterManuals: report.manual.length });
JS
bun test tests/types.test.ts -t "builder|module|alias|contribution|replacement|verify"
bun test tests/builder-renames.test.ts
npm run typecheck
npm run codemod:check
git diff --check
```

Expected: the preview has `0 rewrites` outside `startup.ts`; every Task 8-owned manual is gone; each
remaining manual matches the exact path/reason of a classified inherited pass-through or later owner;
and the Step 2 exact-text proof still establishes that `startup.ts` proposes only the two protected
close-control rewrites. Every compiler/runtime command passes. If the first test filter initializes
all fixtures, allow its normal runtime; do not weaken markers.

Reobserve both documentation commands and reset `task8_docs_status` before running this commit block:

```bash
git diff --name-only | LC_ALL=C sort -u > /tmp/di-bag-phase-05/codemod-manual-files.txt
test -s /tmp/di-bag-phase-05/codemod-manual-files.txt
git add --pathspec-from-file=/tmp/di-bag-phase-05/codemod-manual-files.txt
task8_docs_status=$(cat /tmp/di-bag-phase-05/docs-status-hand.txt)
{
  printf '%s\n' 'refactor!: finish typed builder migrations by hand'
  case "$task8_docs_status" in
    green) ;;
    generated-documentation-only) printf '%s\n' '' 'Generated-documentation-only red under the phase-5 exception; the phase' 'evidence records the observed npm run docs:generate and npm run docs:check' 'failures. The unchanged 400-line budget is restored by Tasks 12-13.' ;;
    *) exit 1 ;;
  esac
  printf '%s\n' '' 'Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>' 'Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL'
} > /tmp/di-bag-phase-05/codemod-hand-commit-message.txt
git commit -F /tmp/di-bag-phase-05/codemod-hand-commit-message.txt
```

Make this hand commit only when the manual-file inventory is nonempty; never create an empty commit.
Keep every runtime/compiler check green.

---

### Task 9: Migrate generated source strings and JavaScript tests

**Files:**
- Modify: `tests/compiler.ts`, `tests/package.test.ts`, `tests/token-package.test.ts`, `tests/native-package.test.ts`, `tests/*-runtime-fixture.ts`, `tests/*.node.mjs`, `tests/benchmark-compiler-ceiling.test.ts`, `tests/compiler-reuse.test.ts`
- Modify: `scripts/benchmark-types.ts`, `scripts/compiler-case.ts`, `scripts/benchmark-compiler-ceiling.ts`, `scripts/check-token-scale.ts`, `scripts/verify-release-artifacts.ts`, and any other `scripts/` generator the audit prints

**Interfaces:**
- Consumes: Task 6's adopted/fallback shapes.
- Produces: every generated TypeScript program and untyped runtime chain uses the 0.5.0 builder calls; `scaleSource` and `tokenScaleSource` no longer need `DI_BAG_SCALE_API`.

- [ ] **Step 1: Audit strings before editing**

Run this parse-only scanner; it creates no TypeScript program:

```bash
node --input-type=module <<'NODE'
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const files = execFileSync('git', ['ls-files', 'tests', 'scripts'], { encoding: 'utf8' }).trim().split('\n');
const names = /\.(register|alias|contribute|replace|installModule|verifyGraph|buildModule|build)\s*\(/g;
for (const file of files) {
  if (!/\.(?:ts|mjs)$/.test(file)) continue;
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const visit = node => {
    if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
      const text = node.getText(source); const hits = [...text.matchAll(names)];
      if (hits.length) console.log(file, source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, hits.map(hit => hit[1]).join(','));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
NODE
```

Expected on the historical 0.4.0 tree: 207 calls in 15 files listed under "Where the codemod cannot reach". Save the entry-tree output; phases 3 and 4 may change the number.

- [ ] **Step 2: Rewrite every generated chain using one table**

Apply these syntax rules to template/string contents and to the two `.node.mjs` suites:

| 0.4.0 source | 0.5.0 source |
| --- | --- |
| `.register({ ... })` | `.withServices({ ... })` |
| `.register(token, provider)` | `.withTokenService({ token, provider })` |
| `.alias(destination, target)` | `.withServiceAlias({ aliasKey: destination, targetServiceKey: target })` |
| `.contribute(token, provider)` | `.withCollectionContribution({ collectionToken: token, provider })` |
| `.replace(key, provider)` | `.withReplacedService({ serviceKey: key, provider })` |
| `.installModule(module)` | `.withInstalledModules([module])` |
| `.verifyGraph()` | `.verifyGraphAtCompileTime()` |
| `.buildModule(keys)` | `.buildModule({ exportedServiceKeys: keys })` |
| `.buildModule(keys, { label: value })` | `.buildModule({ exportedServiceKeys: keys, moduleLabel: value })` |
| `.build()` | `.buildContainer()` |

For multiline generated fragments, keep interpolation expressions byte-for-byte and change only the surrounding syntax. `tests/compiler.ts` must remove `bagCalls` and emit 0.5.0 unconditionally in `scaleSource`, `tokenScaleSource`, and `moduleListScaleSource`; keep `separate-0.4` only in the S7 evidence generator because it is an explicit comparison form.

- [ ] **Step 3: Prove no hidden generated call remains**

Rerun the scanner from Step 1. Expected: no old builder call inside a string except the intentional `separate-0.4` branch of `moduleListScaleSource` and literal migration fixtures under `tools/codemod` (outside this scan). Then run:

```bash
bun test tests/package.test.ts tests/token-package.test.ts tests/native-package.test.ts
bun test tests/runtime-scale.node.mjs tests/acquisition-retention.node.mjs
```

Expected: all tests pass. The `.node.mjs` files are safe here because Bun runs their assertions directly; the final Node command remains in Task 14.

- [ ] **Step 4: Commit**

```bash
git add tests scripts
git commit -F - <<'MSG'
refactor!: migrate generated builder source

Generated-documentation-only red under the phase-5 exception; the phase
evidence records the observed failures and commands. The 400-line API-card
budget is unchanged. Skip this commit during git bisect; Tasks 12-13
contract the surface and restore both documentation checks.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

---

### Task 10: Migrate the agent-eval projects

**Files:**
- Modify: `scripts/agent-eval/reference/**`, `scripts/agent-eval/skeleton/**`, `scripts/agent-eval/hidden/checks/**`, `scripts/agent-eval/hidden/tests/**`

**Interfaces:**
- Consumes: the syntax table in Task 9.
- Produces: reference solutions, starter code and hidden checks all describe and accept the same 0.5.0 builder surface.

- [ ] **Step 1: Rewrite all library calls by hand**

Use the Task 9 table for the 70 library calls measured on 0.4.0: reference 32, hidden 28, skeleton 10. Leave four `String.prototype.replace` calls alone (`lib/harness.mjs`, `skeleton/resolve-ts.mjs`, `test/harness.test.mjs` twice). In each `src/app.ts` and `src/app.check.ts`, install modules as one array with one element per line:

```ts
DiBag.createBuilder()
  .withInstalledModules([
    catalogModule,
    checkoutModule,
  ])
  .withServices({ config: () => fixtureConfig })
  .verifyGraphAtCompileTime() satisfies void;
```

Do not merge arrays across an intervening `withServices` call; list order and chain order are observable.

- [ ] **Step 2: Run the local harness tests**

```bash
npm run agent-eval:test
rg -n "\.(register|alias|contribute|replace|installModule|verifyGraph|build)\(" scripts/agent-eval
```

Expected: the test script exits 0. The grep has no DI Bag call; inspect the four expected `String.prototype.replace` hits and no others. Do not run the agent evaluation itself.

- [ ] **Step 3: Commit**

```bash
git add scripts/agent-eval
git commit -F - <<'MSG'
refactor(agent-eval): use the 0.5 builder surface

Generated-documentation-only red under the phase-5 exception; the phase
evidence records the observed failures and commands. The 400-line API-card
budget is unchanged. Skip this commit during git bisect; Tasks 12-13
contract the surface and restore both documentation checks.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

---

### Task 11: Make the graph extractor bilingual

**Files:**
- Modify: `tools/graph/lib/extract.mjs`, `tools/graph/README.md`
- Create: `tools/graph/test/builder-names.test.mjs`, `tools/graph/test/fixtures/builder-names-0-4.ts`, `tools/graph/test/fixtures/builder-names-0-5.ts`
- Test: `tools/graph/test/builder-names.test.mjs`, existing `tools/graph/test/*.test.mjs`

**Interfaces:**
- Consumes: both the 0.4.0 calls and Task 6's 0.5.0 adopted/fallback shapes.
- Produces: extraction of `buildContainer`, builder bags, module-list elements (inline or through a `const`), and the `buildModule` bag while retaining every 0.4.0 syntax. The extractor remains syntactic and does not execute getters.

- [ ] **Step 1: Add the two equivalent fixtures**

Create `tools/graph/test/fixtures/builder-names-0-4.ts`:

```ts
declare const DiBag: any;
declare const clock: any;
type Search = { find(query: string): Promise<readonly string[]> };
const retrieval = DiBag.createBuilder().register({
  normalize: () => (question: string) => question.trim(),
  retrieve: ({ search, normalize }: { search: Search; normalize: (question: string) => string }) => async (question: string) => search.find(normalize(question)),
}).buildModule(['retrieve'], { label: 'retrieval' });
const clocks = DiBag.createBuilder().register(clock, () => ({ now: () => 0 })).buildModule([clock]);
export const app = DiBag.createBuilder()
  .installModule(retrieval)
  .installModule(clocks)
  .register({
    search: (): Search => ({ find: async () => [] }),
    run: ({ retrieve, now }: { retrieve: (question: string) => Promise<readonly string[]>; now: number }) => retrieve,
  })
  .alias('now', clock)
  .replace('search', async ({ normalize }: { normalize: unknown }) => ({ find: async () => [] }))
  .build();
```

Create `builder-names-0-5.ts`:

```ts
declare const DiBag: any;
declare const clock: any;
type Search = { find(query: string): Promise<readonly string[]> };
const retrieval = DiBag.createBuilder().withServices({
  normalize: () => (question: string) => question.trim(),
  retrieve: ({ search, normalize }: { search: Search; normalize: (question: string) => string }) => async (question: string) => search.find(normalize(question)),
}).buildModule({ exportedServiceKeys: ['retrieve'], moduleLabel: 'retrieval' });
const clocks = DiBag.createBuilder().withTokenService({ token: clock, provider: () => ({ now: () => 0 }) }).buildModule({ exportedServiceKeys: [clock] });
const modules = [retrieval, clocks] as const;
export const app = DiBag.createBuilder()
  .withInstalledModules(modules)
  .withServices({
    search: (): Search => ({ find: async () => [] }),
    run: ({ retrieve, now }: { retrieve: (question: string) => Promise<readonly string[]>; now: number }) => retrieve,
  })
  .withServiceAlias({ aliasKey: 'now', targetServiceKey: clock })
  .withReplacedService({ serviceKey: 'search', provider: async ({ normalize }: { normalize: unknown }) => ({ find: async () => [] }) })
  .buildContainer();
export const inline = DiBag.createBuilder().withInstalledModules([retrieval, clocks]).withServices({ search: (): Search => ({ find: async () => [] }) }).buildContainer();
```

- [ ] **Step 2: Add the extractor test**

Create `tools/graph/test/builder-names.test.mjs`:

```js
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { extractDependencyGraph } from '../lib/extract.mjs';

const root = resolve(import.meta.dirname, '../../..');
const extract = name => extractDependencyGraph({ files: [resolve(root, 'tools/graph/test/fixtures', name)], root });
const shape = graph => graph.units.map(({ id, file, line, installs, nodes, ...rest }) => ({
  ...rest, installs: installs.length, nodes: nodes.map(({ line: _line, ...node }) => node),
}));

test('a graph written with the 0.5.0 builder calls is read like the same graph in 0.4.0 calls', () => {
  const before = extract('builder-names-0-4.ts');
  const after = extract('builder-names-0-5.ts');
  assert.equal(before.units.length, 3);
  assert.deepEqual(shape(after).slice(0, 3), shape(before));
  assert.deepEqual(after.issues.map(({ unit, ...issue }) => issue), before.issues.map(({ unit, ...issue }) => issue));
});

test('options bags are read by property name, and a module list by element, inline or behind a constant', () => {
  const [retrieval, clocks, app, inline] = extract('builder-names-0-5.ts').units;
  assert.deepEqual([retrieval.kind, retrieval.label, retrieval.exports], ['module', 'retrieval', ['retrieve']]);
  assert.deepEqual(app.installs, [retrieval.id, clocks.id]);
  assert.deepEqual(inline.installs, [retrieval.id, clocks.id]);
  assert.deepEqual(app.nodes.map(node => node.key), ['search', 'run', 'search']);
  assert.deepEqual(extract('builder-names-0-5.ts').issues.map(issue => issue.dependency), ['normalize']);
});
```

- [ ] **Step 3: Extend `extract.mjs`**

Put new names first but retain old terminals:

```js
const TERMINALS = new Set(['buildContainer', 'buildModule', 'build', 'buildAndStart']);
```

Add these helpers immediately before `readUnit`:

```js
function bagProperty(literal, name) {
  for (const property of literal.properties) {
    if (ts.isPropertyAssignment(property) && keyText(property.name) === name) return property.initializer;
    if (ts.isShorthandPropertyAssignment(property) && property.name.text === name) return property.name;
  }
  return undefined;
}

function optionsBag(call) {
  return call.arguments.length === 1 && ts.isObjectLiteralExpression(call.arguments[0]) ? call.arguments[0] : undefined;
}

function listedModules(argument, checker) {
  let expression = skipOuter(argument);
  if (ts.isIdentifier(expression)) {
    const initializer = initializerOf(expression, checker);
    if (initializer && ts.isArrayLiteralExpression(skipOuter(initializer))) expression = skipOuter(initializer);
  }
  return ts.isArrayLiteralExpression(expression) ? [...expression.elements] : [argument];
}
```

Replace `readUnit` in full with this implementation. The bag branches precede the legacy bulk branch so `buildModule({ ... })` cannot be mistaken for services. The two-argument and singular-install branches intentionally recognize the measured S1/S7 fallbacks as well as the 0.4.0 forms:

```js
function readUnit(terminal, sourceFile, checker, root) {
  const calls = chainCalls(terminal, checker);
  const nodes = [], installs = [], aliases = [];
  let exports = [], label;
  for (const call of calls) {
    const name = methodName(call);
    const bag = optionsBag(call);
    const pushNode = (keyExpression, providerExpression) => {
      const { inner, lifetime, owned } = unwrap(providerExpression);
      const { dependencies, async } = describeFactory(inner, checker);
      const { line } = sourceFile.getLineAndCharacterOfPosition(call.getStart(sourceFile));
      nodes.push({ key: keyText(keyExpression), line: line + 1, dependencies, async, lifetime, owned });
    };
    if ((name === 'withTokenService' || name === 'withReplacedService') && bag) {
      const key = bagProperty(bag, name === 'withTokenService' ? 'token' : 'serviceKey');
      const provider = bagProperty(bag, 'provider');
      if (key && provider) pushNode(key, provider);
    } else if (name === 'withServiceAlias' && bag) {
      const from = bagProperty(bag, 'aliasKey'), to = bagProperty(bag, 'targetServiceKey');
      if (from && to) aliases.push({ from: keyText(from), to: keyText(to) });
    } else if (name === 'withInstalledModules' && call.arguments.length === 1) {
      installs.push(...listedModules(call.arguments[0], checker));
    } else if (name === 'buildModule' && bag && !ts.isArrayLiteralExpression(call.arguments[0])) {
      const keys = bagProperty(bag, 'exportedServiceKeys');
      if (keys && ts.isArrayLiteralExpression(skipOuter(keys))) exports = skipOuter(keys).elements.map(keyText);
      const moduleLabel = bagProperty(bag, 'moduleLabel');
      if (moduleLabel && ts.isStringLiteralLike(moduleLabel)) label = moduleLabel.text;
    } else if ((name === 'register' || name === 'replace' || name === 'withServices') && call.arguments.length === 1 && ts.isObjectLiteralExpression(call.arguments[0])) {
      for (const property of call.arguments[0].properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const { inner, lifetime, owned } = unwrap(property.initializer);
        const { dependencies, async } = describeFactory(inner, checker);
        const { line } = sourceFile.getLineAndCharacterOfPosition(property.getStart(sourceFile));
        nodes.push({ key: keyText(property.name), line: line + 1, dependencies, async, lifetime, owned });
      }
    } else if (['register', 'replace', 'withTokenService', 'withReplacedService'].includes(name) && call.arguments.length === 2) {
      pushNode(call.arguments[0], call.arguments[1]);
    } else if ((name === 'alias' || name === 'withServiceAlias') && call.arguments.length === 2) {
      aliases.push({ from: keyText(call.arguments[0]), to: keyText(call.arguments[1]) });
    } else if ((name === 'installModule' || name === 'withInstalledModule') && call.arguments.length === 1) {
      installs.push(call.arguments[0]);
    } else if (name === 'buildModule' && call.arguments[0] && ts.isArrayLiteralExpression(call.arguments[0])) {
      exports = call.arguments[0].elements.map(keyText);
      const options = call.arguments[1];
      const property = options && ts.isObjectLiteralExpression(options)
        ? options.properties.find(candidate => ts.isPropertyAssignment(candidate) && keyText(candidate.name) === 'label') : undefined;
      if (property && ts.isStringLiteralLike(property.initializer)) label = property.initializer.text;
    }
  }
  const { line } = sourceFile.getLineAndCharacterOfPosition(calls[0].getStart(sourceFile));
  const file = relative(root, sourceFile.fileName);
  const kind = methodName(terminal) === 'buildModule' ? 'module' : 'bag';
  return { id: `${file}:${line + 1}`, kind, file, line: line + 1, ...(label === undefined ? {} : { label }), exports, installs, nodes, aliases, terminal };
}
```

- [ ] **Step 4: Update README and run the tool tests**

In `tools/graph/README.md`, list `buildContainer()` and the `buildModule({ exportedServiceKeys, moduleLabel })` bag first; explain that `withInstalledModules([...])` is expanded in list order and that 0.4.0 names remain accepted for migration analysis. Change `verifyGraph()` to `verifyGraphAtCompileTime()` in user guidance.

```bash
node --test tools/graph/test/builder-names.test.mjs
npm run graph:check
```

Expected: first command `pass 2`, `fail 0`; full graph check exits 0. The finishing planner reran the first command against the historical prototype with pinned Bun 1.4.0 and observed exactly that result.

- [ ] **Step 5: Commit**

```bash
git add tools/graph
git commit -F - <<'MSG'
feat(graph): read both builder API generations

Generated-documentation-only red under the phase-5 exception; the phase
evidence records the observed failures and commands. The 400-line API-card
budget is unchanged. Skip this commit during git bisect; Tasks 12-13
contract the surface and restore both documentation checks.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

---

### Task 12: Remove the 0.4.0 builder surface (contract)

**Files:**
- Modify: `src/di-bag.ts`, `src/contribution-types.ts`, `src/index.ts`, `src/module.ts`, `src/registration.ts`, `src/aliases.ts`, `src/runtime.ts`, `src/provider-operations.ts`, `src/types.ts`, `src/alias-types.ts`
- Modify: `tests/types/negative/api-renaming.ts`, `tests/types/negative/builder-renames.ts`, `tests/api-naming-known-violations.json`
- Modify: migrated compiler markers and runtime assertions under `tests/`

**Interfaces:**
- Consumes: Task 6's recorded choice. The target signatures are exactly the full signatures in Tasks 2–4, or the corresponding complete fallback in Task 6.
- Produces: `Builder` exposes only `withServices`, `withTokenService`, `withServiceAlias`, `withCollectionContribution`, `withReplacedService`, `withInstalledModules`, `verifyGraphAtCompileTime`, `buildModule({ exportedServiceKeys, moduleLabel? })`, and `buildContainer`. It exports only `BuilderWithCollectionContribution`.

- [ ] **Step 1: Add negative coverage before deleting declarations**

Append to `tests/types/negative/api-renaming.ts`; keep one statement per expected diagnostic:

```ts
const retiredBuilder = DiBag.createBuilder();
// diagnostic: does not exist
retiredBuilder.register({ value: () => 1 });
// diagnostic: does not exist
retiredBuilder.alias('other', 'value');
// diagnostic: does not exist
retiredBuilder.contribute(number, () => 1);
// diagnostic: does not exist
retiredBuilder.replace('value', () => 2);
// diagnostic: does not exist
retiredBuilder.installModule({});
// diagnostic: does not exist
retiredBuilder.verifyGraph();
// diagnostic: does not exist
retiredBuilder.build();
// diagnostic: Expected 1 arguments
DiBag.createBuilder().withServices({ value: () => 1 }).buildModule(['value']);
```

Also import the old type on its own line with its marker in the import list style this fixture already uses after phases 3–4:

```ts
// diagnostic: no exported member
import type { BuilderContribute } from '../../../src';
```

In `tests/types/negative/builder-renames.ts`, add:

```ts
const moduleBuilder = DiBag.createBuilder().withServices({ value: () => 1 });
// diagnostic: Object literal may only specify known properties
moduleBuilder.buildModule({ exportedServiceKeys: ['value'], label: 'old' });
```

Run `bun test tests/types.test.ts -t "api renaming|builder-renames"`. Expected before deletion: the new cases fail their negative-fixture assertions because the old names still compile.

- [ ] **Step 2: Delete old declarations and compatibility dispatch**

In `src/di-bag.ts`, remove both `register` overloads and implementation, `alias`, `contribute`, both `replace` overloads and implementation, `installModule`, both `verifyGraph` declarations, `build`, the positional `buildModule` overload, and every old JSDoc example. Replace the dual `buildModule` implementation with the single body:

```ts
  buildModule<const ExportedServiceKeys extends readonly unknown[]>(
    options: ModuleOptions & {
      readonly exportedServiceKeys: ExportedServiceKeys & Selection<RegistrationsFromEntries<Entries>, Constraints, ExportedServiceKeys, 'buildModule'> & ModuleExportAdmission<ExportedServiceKeys> &
        SealAdmission<RegistrationsFromEntries<Entries>, Extract<SelectionKey<ExportedServiceKeys[number]>, keyof RegistrationsFromEntries<Entries>>, Constraints>;
    },
  ): Module<
    ExportedServices<ServicesOf<RegistrationsFromEntries<Entries>>, Extract<SelectionKey<ExportedServiceKeys[number]>, keyof RegistrationsFromEntries<Entries>>>,
    ExternalRequirements<ModuleSealedConstraints<Entries, Constraints, Extract<SelectionKey<ExportedServiceKeys[number]>, keyof RegistrationsFromEntries<Entries>>>>,
    ModuleSealedConstraints<Entries, Constraints, Extract<SelectionKey<ExportedServiceKeys[number]>, keyof RegistrationsFromEntries<Entries>>>,
    ModulePublicProviders<RegistrationsFromEntries<Entries>, Extract<SelectionKey<ExportedServiceKeys[number]>, keyof RegistrationsFromEntries<Entries>>>
  > {
    const { exportedServiceKeys, moduleLabel } = snapshotOptionsBag(options, 'buildModule', ['exportedServiceKeys'], ['moduleLabel']);
    return sealModule(this.#graph, exportedServiceKeys, moduleLabel) as never;
  }
```

Use the phase-2 generic names `Entries` and `Constraints` throughout; if Task 3 retained a shorter generic in its tested signature, update the whole class consistently rather than mixing letters.

In `src/contribution-types.ts`, delete `BuilderContribute`. In `src/index.ts`, replace its export with:

```ts
export type { BuilderWithCollectionContribution } from './contribution-types';
```

In `src/module.ts`, delete `ModuleOptions.label` and `positionalModuleLabel`. `sealModule` keeps `(graph, keys, moduleLabel?)`; `moduleGraph` accepts only the selected Task 6 operation (`withInstalledModules` plus `index`, or singular `withInstalledModule`). In `src/runtime.ts`, `withInstallation` reports that same new operation without an old-name default.

- [ ] **Step 3: Collapse shared runtime helpers onto the new operation names**

Remove the temporary old/new unions introduced only for expand compatibility:

```ts
// src/registration.ts
export function snapshotAdd(providersByName: unknown, hasKey: (key: string) => boolean): Registrations
// every details object uses { operation: 'withServices' }

// src/aliases.ts
export function aliasEntry(aliasKey: unknown, targetServiceKey: unknown, hasKey: (key: BindingKey) => boolean): readonly [BindingKey, Registration]
// messages/details use withServiceAlias

// src/contributions.ts
export function contributionEntry(collectionToken: unknown, provider: Registration): readonly [symbol, Registration]
// normalize(provider, 'withCollectionContribution')
```

Keep `describe(registration, operation = 'register')` and `normalize(registration, operation = 'register')`: internal non-builder callers retain their existing default, while every builder path passes its 0.5.0 method name. `snapshotAdd` passes `withServices`; `contributionEntry` passes `withCollectionContribution`; replacement passes `withReplacedService`; the phase-4 token-binding helper passes `withTokenService`. Audit the four invalid-provider cases in `tests/builder-renames.test.ts` for both `.code` and `details.operation`. Do not change any error code.

Make the runtime strings exact:

```text
withServiceAlias requires an existing named target
withReplacedService accepts existing names or typed tokens only: <key>
withInstalledModules requires genuine modules: element <index> is not one
buildModule moduleLabel must be a non-empty string
```

Every matching `details.operation` is respectively `withServiceAlias`, `withReplacedService`, `withInstalledModules`, `buildModule`; installation collisions say `withInstalledModules`.

- [ ] **Step 4: Rename compiler messages at their definitions**

In `src/types.ts`, `src/alias-types.ts`, `src/contribution-types.ts` and the phase-4 file that defines `RegisterTokenAdmission`, use exactly the nine Task 8 replacements. Change both `Introduces` and `IntroducesKeys`; change both `ReplacementKey` and `ReplacementKeyOf`. In the same uncommitted atomic unit, apply those exact replacements to every matching `diagnostic:`/`diagnostic-also:` marker and source-owned compiler assertion inventoried by Task 8; Task 8 deliberately kept their shared old wording. In particular, change the string literals inside `RegisterTokenAdmission`, `AliasDestinationAdmission`, and the collection-token admission used by `BuilderWithCollectionContribution`; retain those helper type names and their detail objects. Do not change the error-page anchor fragments. Rerun:

```bash
rg -n "register requires|register introduces|replace requires|alias requires|alias output|contribute requires" src tests/types tests/*.test.ts docs/agent
```

Expected: no old phrase. Every test marker must equal the new source substring.

- [ ] **Step 5: Shrink the naming ratchet**

Run:

```bash
UPDATE_API_NAMING_VIOLATIONS=1 bun test tests/api-naming.test.ts
git diff -- tests/api-naming-known-violations.json
```

Expected: these five entries disappear and no entry is added:

```text
builder-method-prefix: alias
builder-method-prefix: contribute
builder-method-prefix: installModule
builder-method-prefix: register
builder-method-prefix: replace
```

Run the test again without the environment variable; expected: pass.

- [ ] **Step 6: Audit every retired name and operation**

```bash
rg -n "\b(BuilderContribute|register|alias|contribute|replace|installModule|verifyGraph|build)\b" src tests examples scripts AGENTS.md docs/agent tools/docs tools/graph
rg -n "operation: ['\"](register|alias|replace|installModule)['\"]" src tests
```

Every remaining hit must be one of: codemod 0.4.0 input/map/vendor declarations, `tools/graph`'s deliberately bilingual code and 0.4 fixture, the new negative-renaming fixture, an unrelated JavaScript method (`String.prototype.replace`), or a guide deferred by the master plan. There must be no retired public declaration, executable repo call, JSDoc example, runtime operation detail or stale test marker.

- [ ] **Step 7: Run contract tests, then continue without committing**

```bash
bun test tests/builder-renames.test.ts
bun test tests/types.test.ts -t "api renaming|builder-renames|installed-modules|alias|replacement"
bun test tests/runtime-diagnostics.test.ts tests/aliases.test.ts tests/contributions.test.ts tests/modules.test.ts tests/nested-modules.test.ts
```

Expected: all pass. This is the first required compile of the final signatures. If the positive/negative cases fail, make up to three serious repairs without changing spec names, then take Task 6's applicable fallback and update every later artifact consistently.

Do not commit yet: checked snippets and generated API files still name the removed methods. Continue directly to Task 13 and make one green contract-plus-docs commit after `npm run docs:check` passes.

---

### Task 13: Update shipped agent documentation and API-card contracts

**Files:**
- Modify: `AGENTS.md`, `docs/agent/recipes.md`, `docs/agent/errors.md`
- Modify: the matching module-layout block in `docs/guides/examples-modularity.md`
- Modify: `tools/docs/api-card-tasks.json`, `tools/docs/test/api-card.test.mjs`, `tools/docs/test/exact-rendering.test.mjs`
- Modify: `tools/docs/api-card-summary-exceptions.json` if phase 2 created it
- Modify: `docs/guides/api-reference.md`
- Regenerate: `docs/agent/api-card.md`, `docs/reference/**`

**Interfaces:**
- Consumes: final Task 6 shape and Task 12's final public declarations.
- Produces: the shipped one-way-per-task docs contain only 0.5.0 builder calls. General guides and `README.md` remain for phase 12, except the byte-identical layout block.

- [ ] **Step 1: Rewrite `AGENTS.md` without adding a line**

Use the Task 9 syntax mapping in every code block. Replace Rules 8 and 9 with the same number of lines:

```markdown
8. **Modules.** Add factories with `withServices`, then
   `buildModule({ exportedServiceKeys: ['exported'], moduleLabel: 'billing' })`.
   Unregistered needs become requirements: the host supplies them after
   `withInstalledModules([module])`; private services are named `billing/store`.
9. **Read a rejection at its name.** A graph error is an assignability error
   whose type is `Unsatisfied<"message", details>`, reported where the builder
   expression starts. `builder.verifyGraphAtCompileTime() satisfies void;`
```

Keep the remainder of Rule 9 unchanged. In the layout block use:

```text
  module.ts          # buildModule({ exportedServiceKeys: [...] }) over the private factories
src/app.ts           # installs modules in one withInstalledModules([...]) list
src/app.check.ts     # verifyGraphAtCompileTime() on the application builder: the merge check
```

Copy that entire layout block byte-for-byte to `docs/guides/examples-modularity.md`. In examples, format module lists one element per array line.

- [ ] **Step 2: Rewrite the agent recipes and error examples**

Apply Task 9's mapping to every executable snippet in `docs/agent/recipes.md` and `docs/agent/errors.md`. Prose uses the new method names too. Exact message replacements in `docs/agent/errors.md` are the nine rows of Task 8 Step 3. Keep anchors unchanged: source `@see` links and `SeeErrors<...>` depend on them. Keep `bag is closing`, `bag is closed`, and root-captures-scoped text untouched.

- [ ] **Step 3: Pin the API card's new names**

Edit `tools/docs/api-card-tasks.json` in place; preserve every row added by phases 3 and 4, including `{ "task": "Wait for services before accepting work", "call": "bag.ensureServicesReady" }` after the build row and any collection-token task. Make only these targeted row substitutions:

```text
{ "task": "Register a service", "call": "builder.register" }
becomes `{ "task": "Register services by name", "call": "builder.withServices" }`

{ "task": "Install a module", "call": "builder.installModule" }
becomes `{ "task": "Install modules", "call": "builder.withInstalledModules" }`

{ "task": "Check the graph on its own line", "call": "builder.verifyGraph" }
becomes `{ "task": "Check the graph on its own line", "call": "builder.verifyGraphAtCompileTime" }`

{ "task": "Build a bag", "call": "builder.build" }
becomes `{ "task": "Build a bag", "call": "builder.buildContainer" }`
```

`builder.buildModule` stays under "Seal a module". Do not reorder untouched rows.

In `api-card.test.mjs`, require `builder.withServices` and `builder.withCollectionContribution` in place of `builder.register` and `builder.contribute`; change its deliberately invalid multi-call test to `['bag.fork', 'builder.withReplacedService']`. In `exact-rendering.test.mjs`, read `BuilderWithCollectionContribution.md` and assert its bag properties `readonly collectionToken:` and `readonly provider:` plus `Builder<E, C | Contribution<T, V>>`. Phase 2 renamed the exported class's own parameters; this standalone callable retains the parameter names of `BuilderContribute`. Delete the `builder-alias` id from `api-card-summary-exceptions.json`; a removed id must not remain.

In `docs/guides/api-reference.md`, replace the `BuilderContribute` row and link with `BuilderWithCollectionContribution`. No other guide prose changes in this phase.

- [ ] **Step 4: Generate and verify**

```bash
npm run build
npm run docs:generate
npm run docs:check
wc -l AGENTS.md
test "$(wc -l < docs/agent/api-card.md)" -le 400
```

Expected: all commands exit 0; `AGENTS.md` is at most 150 lines; the contracted API card is at most the unchanged 400-line limit; `docs/reference/index/type-aliases/BuilderContribute.md` is gone and `BuilderWithCollectionContribution.md` exists. The current generator writes to a temporary tree, then removes `docs/reference` recursively before copying that tree into place, so successful generation necessarily deletes the old page. If the old page remains, treat that as a failed or bypassed generation: rerun `npm run docs:generate` and investigate its exit/output. Never remove or hand-edit one generated Markdown page as a substitute for a successful full-tree generation.

- [ ] **Step 5: Commit the contract and documentation together**

```bash
git add src tests AGENTS.md docs/agent docs/guides/examples-modularity.md docs/guides/api-reference.md docs/reference tools/docs
git commit -F - <<'MSG'
refactor!: contract the builder API and update shipped docs

Removes the 0.4 builder methods only in the same green commit that migrates
checked agent snippets and regenerates the API card and reference pages.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

---

### Task 14: Post-contract evidence, full gates and phase report

**Files:**
- Modify: `docs/superpowers/plans/evidence/phase-05.md`
- Inspect only: the whole phase diff

**Interfaces:**
- Consumes: the contracted source, all migrated call sites, generated docs and Task 6's spike decisions.
- Produces: the required twelve-case cumulative evidence, green phase gates, final call-site counts and the controller report.

- [ ] **Step 1: Measure all twelve cases after the contract step**

Run the phase-0 harness once, serially:

```bash
node scripts/evidence-cases.mjs --json /tmp/di-bag-phase-05/final-evidence.json | tee /tmp/di-bag-phase-05/final-evidence.md
```

Expected: twelve rows; every named worker has `accepted: true`; every token worker has `diagnostics: []`. Append to `phase-05.md` a table with `case`, `baseline instantiations`, `phase 5 instantiations`, `cumulative change %`. Compare against `docs/superpowers/plans/evidence/baseline.md`; every row must be at most +10%. Preserve the earlier S1/S7 tables and adopted/fallback decisions.

If any row breaches +10%, first verify the generator uses the final Task 6 shape and the zero-dependency replacement overload. Repair accidental type expansion. If a selected spike shape itself causes the breach, take its Task 6 fallback, update source/codemod/fixtures/docs/graph consistently, rerun all narrow tests, then rerun evidence. Do not change the threshold.

- [ ] **Step 2: Run focused phase checks**

```bash
bun test tests/builder-renames.test.ts
bun test tests/api-naming.test.ts
bun test tests/types.test.ts -t "0.5.0 builder shapes|builder-renames|installed-modules|api renaming"
node --test tools/codemod/test/rename-map.test.mjs tools/codemod/test/fixtures.test.mjs
node --test tools/graph/test/builder-names.test.mjs
npm run agent-eval:test
```

Expected: every command exits 0. The graph test reports `pass 2`, `fail 0`.

- [ ] **Step 3: Run the complete phase gate in master-plan order**

```bash
npm run check
npm run docs:check
npm run graph:check
npm run codemod:check
npm run typecheck:native
npm run build:native
npm run check:native
node --expose-gc --test --test-isolation=none tests/runtime-scale.node.mjs tests/acquisition-retention.node.mjs tests/graph-retention.node.mjs
npm run agent-eval:test
for example in examples/*.ts; do bun "$example"; done
```

Expected: every command exits 0; both compiler lanes, every runtime lane, docs, graph, codemod, agent-eval and every example pass. Run them serially. If a compiler-lane test times out around 5 seconds, rerun that one file on an idle host as the master plan says; report it as a flake only if the isolated run passes.

- [ ] **Step 4: Audit names, messages and final counts**

```bash
/tmp/di-bag-phase-05/count-call-sites.sh
NAMES="withServices withTokenService withServiceAlias withCollectionContribution withReplacedService withInstalledModules verifyGraphAtCompileTime buildContainer" /tmp/di-bag-phase-05/count-call-sites.sh
grep -rhoE "toThrow\((/|['\`])[^)]*" tests | grep -iE "\b(register|alias|contribute|replace|installModule|verifyGraph|buildModule|build)\b" | sort | uniq -c
rg -n "operation: ['\"](register|alias|replace|installModule)['\"]" src tests
git status --short
git diff --check next...HEAD
```

Expected: old executable DI Bag call counts are zero outside the explicit codemod/graph/migration fixtures and deferred guides; new-name counts account for their replacements; the old assertion inventory is empty; the operation grep is empty outside deliberate old-syntax fixtures; `git diff --check` prints nothing. Put the before and after count tables in the phase report.

- [ ] **Step 5: Commit evidence and send the report**

```bash
git add docs/superpowers/plans/evidence/phase-05.md
git commit -F - <<'MSG'
test(evidence): record final builder rename costs

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

Report to the controller in at most 60 lines: branch `phase-05-builder-renames`; `git log --oneline next..HEAD`; each gate and its last summary line; each S1 method decision and S7 decision with the deciding number; all twelve cumulative percentages; before/after call-site counts; any manual codemod items; any fallback or deviation and why. Add a table naming the exact hashes produced by Tasks 4, 5, 6, 7, Task 8's preparation, pure mechanical and optional hand commits, and Tasks 9, 10 and 11. For Task 8, cite the exact expanded write command, full and write negative-fixture inventories, report-generated staged inventory, startup exact-text/byte proof, focused compiler result, exact path/reason/owner manual classification, and the fact that marker text stayed unchanged for Task 12. Mark every listed commit with its actually observed `green` or `generated-documentation only` status, include the `docs:generate` outcome/diff, restored-tree `docs:check` outcome and exact failures for each red commit, and give the exact `git bisect skip <hash>...` command covering only those red hashes. Confirm that the Task 12-13 contract/docs commit and HEAD pass both `npm run docs:generate`/clean-tree comparison and `npm run docs:check` with the unchanged 400-line budget. Never push, publish or merge.

---

## Self-Review

**Spec coverage.** Tasks 1–4 expand every builder name and shape; Task 5 pins positive, negative, property-site and list-element diagnostics; Task 6 measures S1 and S7 at the required sizes and gives a complete per-method positional fallback plus the singular-module fallback; Tasks 7–10 migrate the codemod, typed code, generated source, JavaScript and agent-eval; Task 11 keeps the graph tool bilingual; Task 12 removes every old declaration and renames operations/messages; Task 13 updates shipped docs and generated references; Task 14 measures all twelve post-contract cases and runs every master-plan gate. No phase-5 spec item is left without a task.

**Evidence boundary.** The inherited historical prototype ran the Task 1–4 runtime source against adapted 0.4.0 tokens (11 pass), four mutants, and five existing files; the finishing planner independently inspected that diff and reran only the graph-tool prototype test (2 pass). The controller later type-checked the positive prototype and positive `builder-renames.ts` fixture successfully, but the negative fixtures were excluded. The final collection-token form, diagnostic positions, and actual later-phase entry tree remain unverified. The executor's Tasks 2, 4, 5, 6, 8, 12 and 14 are the authoritative checks on that tree.

**Typed migration boundary.** Task 8 keeps discovery inclusive, asserts both saved-preview predicates, migrates `startup.ts` builder calls in a prior compiler/runtime-green preparation while retaining its two rejected old-close controls, and proves that only those controls remain before omitting exactly that fixture from the write inventory. The mechanical commit starts with an empty index, is staged solely from the write report, and has an exact clean-tree restore path for a failed trial; manual items land separately afterward and inherited/later-owner rows remain only under an exact path/reason classification. Diagnostic markers retain the expanded surface's actual shared admission wording until Task 12 changes source diagnostics, markers and assertions atomically. Documentation status is determined from generation diff plus `docs:check` on the restored commit tree; documentation-only red is recorded only when those commands actually observe it, while runtime and compiler red are never allowed.

**Compiler provenance.** The controller confirmed that the npm `typescript` wrapper package is 6.0.2 while `require('typescript').version` reports the delegated `@typescript/old` 6.0.3 compiler. Evidence rows that record 6.0.3 are consistent with the pinned toolchain.

**Placeholder scan.** No placeholder directives remain. Conditional steps are limited to measured S1/S7 fallbacks, an earlier phase already creating `DI_BAG_INVALID_ARGUMENT`, and files that exist only after earlier phases; each says how to decide and gives complete resulting code or syntax.

**Type consistency.** Public generics use phase-2 names `Entries` and `Constraints`; the callable is `BuilderWithCollectionContribution`; the module bag is `{ exportedServiceKeys, moduleLabel? }`; codemod properties, docs, graph extraction and negative fixtures use those exact names. The map owner remains the 0.4.0 `Builder`, as required.

**Known risks for the executor.** Earlier forms of the tuple fold and bag signatures compiled only on the historical positive prototype; the final phase-4-derived signatures, negative diagnostic positions and 50-module recursion may require the supplied fallbacks. Task 0 confirms the exact phase-4 helper names and Task 2 preserves their printed contracts. Typed codemod totals cannot be predicted from 0.4.0 counts because earlier phases change the tree; the report records actual counts. API-card tasks must preserve phase-3/4 rows. The full gate is memory-heavy and must run serially.
