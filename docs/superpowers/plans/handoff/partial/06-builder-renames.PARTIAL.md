> **PARTIAL DRAFT, NOT A PLAN. Do not execute it.** A planner agent was writing this file when the account's spend limit stopped it on 2026-09-21. It holds: header through Task 6 (the options bag helper, the new builder methods, `buildModule` with one bag, `withInstalledModules`, compiler fixtures, spikes S1 and S7 with both fallbacks). Still missing: the migrate step (codemod map entries and transforms, generated source held in strings, Markdown), the contract step, the agent docs, the gate and the self-review. The draft itself refers to them as Tasks 7 to 12. It was not reviewed. To finish it, give a planner this file together with `../planner-notes/common.md` and its scope note, and tell it to verify what is here before extending it. The finished plan belongs at `docs/superpowers/plans/2026-09-21-06-builder-renames.md`.

# Builder Renames (Phase 5) Implementation Plan

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
export PATH="/tmp/claude-1000/-home-df-wd-personal-di-bag/7818417c-3b3a-48db-9bef-85624eff953b/scratchpad/bun/bin:$PATH"
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
- That run caught a defect in the first draft of Task 3, which is why its dispatch rule reads as it does. The draft treated every single non-array argument of `buildModule` as the new bag, so `buildModule('a')` raised `DI_BAG_INVALID_ARGUMENT` where `tests/nested-modules.test.ts` (`sealing rejects unknown keys and forged modules exactly as before`) expects the 0.4.0 message `buildModule requires a key tuple`. Now only a lone plain object is the bag, and the non-object case moves to the contract step (Task 13).
- Bun strips types without checking them, so none of this says anything about whether a signature compiles.

**Measured by reading tracked files (`git grep -o`, and a parse-only scan that builds no program and no checker):** the call-site counts in "State on entry" and in Tasks 8 and 9. `.replace(` and `.build(` counts include `String.prototype.replace` and other non-library calls, and the scan counts a call inside a comment as code, so every such number is an upper bound on what the codemod rewrites, not a prediction of its summary line.

**Not run, and why:**

- No TypeScript signature in this plan was compiled: not the bag signatures, not the `buildModule` overload, not the module-list fold. Each is marked where it stands, with the positive and negative cases the executor must see and the spec's fallback.
- The codemod was not run: `tools/codemod` is created by phase 1 and did not exist. What this plan says the codemod does is derived from reading the engine's source in the phase 1 plan.
- `npm run docs:generate`, `npm run docs:check`, `npm run graph:check`, the evidence cases and every gate command were not run. Statements about the API card's line budget and about generated reference pages are predictions from reading `tools/docs/lib`.
- The prototype was the 0.4.0 source, not the tree the executor starts from. Phases 2 to 4 change `src` first. In particular phase 4 adds a token-kind check (`DI_BAG_WRONG_TOKEN_KIND`) to `register(token, ...)`, `contribute` and the alias destination; where it sits and what its helper is called was not knowable, so Task 2 tells the executor to find it with `grep` and copy it.

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

Do not run `npm run docs:generate` or `npm run docs:check` between Task 2 and Task 13. `tools/docs/lib/api-card.mjs` refuses a card over 400 lines; the card is 354 lines at 0.4.0 and every builder method adds an entry with its example, so with both generations of methods on `Builder` the generator is expected to refuse. This is a prediction from reading the generator, not something that was run.

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
- Produces: `snapshotOptionsBag(options: unknown, operation: string, required: readonly string[], optional?: readonly string[]): Record<string, unknown>`. It throws `DI_BAG_INVALID_ARGUMENT` with `details: { operation, argument, expected }`: `argument: 'options'`, `expected: 'an object'` for a value that is not a plain object; `argument: 'options'`, `expected: 'only the own properties: a, b'` for an unknown, symbol-keyed or inherited property; `argument: '<name>'`, `expected: 'present'` for a missing required property. It reads each property once, after every check has passed. Phases 6 and 8 reuse it for their bags.

- [ ] **Step 1: Create the helper**

Create `src/options-bag.ts`:

```ts
import { libraryError } from './errors';

/**
 * Snapshot the own properties of an options bag once, before any value is used.
 * Inherited, symbol-keyed and unknown properties are rejected, so a prototype or an
 * accessor that answers differently on a second read cannot change the call.
 * Every listed property is read exactly once, in the order `required` then `optional`.
 */
export function snapshotOptionsBag(
  options: unknown,
  operation: string,
  required: readonly string[],
  optional: readonly string[] = [],
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
    if (Object.hasOwn(options, name)) snapshot[name] = Reflect.get(options, name);
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

- [ ] **Step 3: Commit**

The helper has no caller yet, so there is nothing to run. Task 2 tests it through the four methods that use it.

```bash
git add src/options-bag.ts docs/agent/errors.md
git commit -F - <<'MSG'
feat(builder): snapshotOptionsBag reads an options bag once

Own properties only; an unknown, symbol-keyed or inherited property and a
missing required property raise DI_BAG_INVALID_ARGUMENT with operation,
argument and expected.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

---

### Task 2: `withServices`, the four bag methods, `verifyGraphAtCompileTime`, `buildContainer` (expand, spike S1)

**Files:**
- Modify: `src/di-bag.ts`, `src/contribution-types.ts`, `src/aliases.ts`, `src/registration.ts`, `src/index.ts`
- Test: `tests/builder-renames.test.ts` (create; Tasks 3 and 4 make its last five tests pass)

**Interfaces:**
- Consumes: `snapshotOptionsBag` from Task 1. The helpers the old methods already call: `snapshotAdd`, `readTokenKey`, `withTokenBinding`, `aliasEntry`, `contributionEntry`, `normalize`.
- Produces, on `class Builder<Entries, Constraints>`: `withServices(providersByName)`, `withTokenService({ token, provider })`, `withServiceAlias({ aliasKey, targetServiceKey })`, the readonly property `withCollectionContribution` typed `BuilderWithCollectionContribution<Entries, Constraints>`, `withReplacedService({ serviceKey, provider })` with its zero-dependency overload first, `verifyGraphAtCompileTime()`, `buildContainer()`. The old methods stay until Task 13.

**The signatures below are UNCOMPILED.** The planner could not run the compiler. Each one is the 0.4.0 signature with its two parameter types moved, unchanged, into the properties of one `options` object, and with `E` and `C` written as `Entries` and `Constraints` (phase 2). The runtime bodies ran in a prototype (see "What was verified"). Task 5 holds the positive and negative cases that must hold, and Task 6 the fallback per method.

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
  ];
  for (const [run, code, details] of checks) {
    const error = caught(run);
    expect(error.code).toBe(code);
    expect(error.details).toEqual(details);
  }
  expect(caught(() => loose(builder).withServiceAlias!({ aliasKey: 'other', targetServiceKey: 'absent' })).message).toContain('withServiceAlias requires an existing named target');
  expect(caught(() => loose(builder).withReplacedService!({ serviceKey: 'absent', provider: () => 1 })).message).toContain('withReplacedService accepts existing names or typed tokens only: absent');
  expect(caught(() => loose(builder).withTokenService!({ token: { key: clockKey }, provider: () => 1 })).code).toBe('DI_BAG_INVALID_TOKEN');
  expect(caught(() => loose(builder).withCollectionContribution!({ collectionToken: tools, provider: 42 })).code).toBe('DI_BAG_INVALID_REGISTRATION');
  expect(caught(() => loose(builder).withReplacedService!({ serviceKey: 'value', provider: 42 })).code).toBe('DI_BAG_INVALID_REGISTRATION');
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
  // A lone value that is not a plain object still means the 0.4.0 form while both forms exist; Task 13 adds that case.
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
Expected: `0 pass`, `11 fail`. Ten tests fail with `withServices is not a function` and the test `an options bag is read once` fails with `withTokenService is not a function`. (Measured with the adapted copy against the untouched 0.4.0 source.)

- [ ] **Step 3: Let the shared helpers name the calling method**

During the expand step two generations of methods share each helper, so the helper takes the operation name. Task 13 removes the parameter again.

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

With `operation` left at its default both helpers produce exactly the 0.4.0 messages and details, so no existing test changes. If phase 4 added a token-kind check to `aliasEntry`, leave it as it is and pass it `operation` where it names the method.

- [ ] **Step 4: Add the type of the contribution property**

Append to `src/contribution-types.ts`. Take the two parameter types from `BuilderContribute` AS IT IS ON ENTRY (phase 4 narrowed the token to a collection token); the text below is derived from the 0.4.0 type, where the first parameter is `T & TokenTupleAdmission<readonly [T]>` and the second is the long `V & ...` intersection. If the on-entry type differs, keep its parameter types and only move them into the bag:

```ts
/**
 * The checked generic `withCollectionContribution` callable exposed by a builder.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#compose-an-ordered-collection
 */
export type BuilderWithCollectionContribution<E extends Entry, C extends NeedConstraint> = <T extends TokenBase, V extends Registration>(
  options: {
    readonly collectionToken: T & TokenTupleAdmission<readonly [T]>;
    readonly provider: V & Registration & BindingOutput<NoInfer<T>, NoInfer<V>> & CheckedConstraints<C | Contribution<NoInfer<T>, NoInfer<V>>, RegistrationsFromEntries<E>>;
  },
  ...invalid: [T] extends [never] ? [never] : [V] extends [never] ? [never] : []
) => import('./di-bag').Builder<E, C | Contribution<T, V>>;
```

In `src/index.ts`, export it next to the old one: `export type { BuilderContribute, BuilderWithCollectionContribution } from './contribution-types';`

- [ ] **Step 5: Add the methods to `class Builder`**

In `src/di-bag.ts`, add `import { snapshotOptionsBag } from './options-bag';` and add `BuilderWithCollectionContribution` to the type import from `./contribution-types`. Insert the block below directly after the `installModule` method. If phase 4 placed a token-kind check at the top of the two-argument branch of `register`, in `contribute`, or on the alias destination (you located it in "State on entry"), call the same check at the top of `withTokenService`, `withCollectionContribution` and `withServiceAlias`, after `snapshotOptionsBag`, with the new method name as its operation.

```ts
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
    return new Builder(this.#graph.withPublicRegistrations(snapshot), this.context);
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
      readonly token: T & TokenTupleAdmission<readonly [T]> & IntroducesKeys<EntryKeys<Entries>, TokenKey<T>>;
      readonly provider: V & Registration & BindingOutput<NoInfer<T>, NoInfer<V>> & ThenableAdmission<Record<TokenKey<T>, NoInfer<V>>> &
        IncrementalChecked<Entries, Record<TokenKey<T>, TokenBinding<NoInfer<T>, NoInfer<V>>>> &
        CheckedConstraints<Constraints, OverrideRegistrations<RegistrationsFromEntries<Entries>, Record<TokenKey<T>, TokenBinding<NoInfer<T>, NoInfer<V>>>>>;
    },
  ): Builder<Entries | { key: TokenKey<T>; registration: TokenBinding<T, V> }, Constraints> {
    const { token, provider } = snapshotOptionsBag(options, 'withTokenService', ['token', 'provider']);
    const key = readTokenKey(token);
    if (this.#graph.hasPublic(key)) throw libraryError('DI_BAG_DUPLICATE_REGISTRATION', `duplicate registration: ${String(key)}`, { operation: 'withTokenService', key });
    return new Builder(this.#graph.withPublicBinding(key, withTokenBinding(token as never, provider as never)), this.context) as never;
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
      readonly aliasKey: D & (unknown extends AliasAdmission<D> ? Introduces<RegistrationsFromEntries<Entries>, AliasEntries<RegistrationsFromEntries<Entries>, D, T>> : AliasAdmission<D>);
      readonly targetServiceKey: T & AliasAdmission<T> & (unknown extends AliasAdmission<T>
        ? AliasTarget<RegistrationsFromEntries<Entries>, T> & AliasDestination<RegistrationsFromEntries<Entries>, NoInfer<D>, T> : unknown) &
        (unknown extends AliasAdmission<D> & AliasAdmission<T>
          ? IncrementalChecked<Entries, AliasEntries<RegistrationsFromEntries<Entries>, NoInfer<D>, NoInfer<T>>> & CheckedConstraints<Constraints, OverrideRegistrations<RegistrationsFromEntries<Entries>, AliasEntries<RegistrationsFromEntries<Entries>, NoInfer<D>, NoInfer<T>>>> : unknown);
    },
    ...invalid: [D] extends [never] ? [never] : [T] extends [never] ? [never] : []
  ): Builder<Entries | AliasEntry<RegistrationsFromEntries<Entries>, D, T>, Constraints> {
    const { aliasKey, targetServiceKey } = snapshotOptionsBag(options, 'withServiceAlias', ['aliasKey', 'targetServiceKey']);
    const [key, registration] = aliasEntry(aliasKey, targetServiceKey, candidate => this.#graph.hasPublic(candidate), 'withServiceAlias');
    return new Builder(this.#graph.withPublicBinding(key, registration), this.context) as never;
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
    const { collectionToken, provider } = snapshotOptionsBag(options, 'withCollectionContribution', ['collectionToken', 'provider']);
    const [key, value] = contributionEntry(collectionToken, provider as Registration);
    return new Builder(this.#graph.withContribution(key, value), this.context);
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
      readonly serviceKey: K & NoInfer<ReplacementAdmission<RegistrationsFromEntries<Entries>, K>>;
      readonly provider: V & Registration & BuilderReplacementRegistration<Entries, Constraints, NoInfer<K>, V>;
    },
  ): Builder<ReplacedEntries<Entries, K, V>, WithoutExportObligations<Constraints, SelectionKey<K>>>;
  withReplacedService(options: unknown): unknown {
    const { serviceKey, provider } = snapshotOptionsBag(options, 'withReplacedService', ['serviceKey', 'provider']);
    const key = typeof serviceKey === 'string' ? serviceKey : readTokenKey(serviceKey);
    if (!this.#graph.hasPublic(key)) {
      throw libraryError('DI_BAG_INVALID_REPLACEMENT', `withReplacedService accepts existing names or typed tokens only: ${String(key)}`, { operation: 'withReplacedService', key });
    }
    normalize(provider);
    return new Builder(this.#graph.withPublicBinding(key, provider as Registration), this.context);
  }
```

Then, directly after the `verifyGraph` method:

```ts
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
```

And directly after the `build` method, with the same `this` type that `build` has on your tree:

```ts
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
```

- [ ] **Step 6: Run the tests**

Run: `bun test tests/builder-renames.test.ts`
Expected: `5 pass`, `6 fail`. The six are the four tests whose title starts with `withInstalledModules` or `a module of the list`, and the two `buildModule` tests; Tasks 3 and 4 make them pass. (Measured with the adapted copy against the planner's prototype cut back to this task's state.)

Run: `npm run typecheck`
Expected: exit 0. This is the FIRST time these signatures meet the compiler. An error inside `src/di-bag.ts` on one of the new signatures is a defect of this plan's uncompiled design, not of your transcription: try to repair the signature while keeping the bag shape, at most three serious attempts per method, and if the shape cannot be made to work take that method's fallback in Task 6.

- [ ] **Step 7: Commit**

```bash
git add src tests/builder-renames.test.ts
git commit -F - <<'MSG'
feat(builder): withServices, the four bag methods, verifyGraphAtCompileTime, buildContainer

Added next to the 0.4.0 methods. Two-input methods take one options bag that
is read once through snapshotOptionsBag.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

---

### Task 3: `buildModule` takes one bag (expand)

**Files:**
- Modify: `src/di-bag.ts`, `src/module.ts`
- Test: `tests/builder-renames.test.ts` (the two `buildModule` tests)

**Interfaces:**
- Consumes: `snapshotOptionsBag` (Task 1).
- Produces: the overload `buildModule(options: ModuleOptions & { exportedServiceKeys })` in front of the 0.4.0 overload; `ModuleOptions.moduleLabel`; `sealModule(graph, keys, moduleLabel?)`, whose third parameter is now the label VALUE; `positionalModuleLabel(options)`, which keeps the 0.4.0 validation of `{ label? }` alive until Task 13.
- The name stays `buildModule`, so both shapes must live under one name while call sites move. The runtime tells them apart: exactly one argument that is a plain object (not `null`, not an array) is the 0.5.0 bag; everything else, including a lone string, keeps its 0.4.0 meaning and its 0.4.0 errors until Task 13.

**The overload below is UNCOMPILED.** It relies on a `const` type parameter being inferred from a PROPERTY of the argument (`exportedServiceKeys: K & Selection<...>`), where 0.4.0 infers it from the argument itself (`keys: K & Selection<...>`). Must hold (Task 5 has the fixtures): `K` is inferred as a readonly tuple of literals from an inline array; an unknown key is reported on the `exportedServiceKeys` property with the `Selection` message for the operation `'buildModule'`; `ModuleOptions` keeps the documentation of `moduleLabel`. If inference from the property fails, the spec gives no positional fallback for this method (rule 4 puts the single input in the bag under its role name), so repair the signature: first try declaring the parameter as one inline object type, `options: { readonly exportedServiceKeys: K & ...; readonly moduleLabel?: string }`, without the intersection with `ModuleOptions`.

While both overloads exist, a negative fixture that calls `buildModule` can report `No overload matches this call` on the method name instead of the `Unsatisfied` message on the argument. `tests/types.test.ts` may therefore show failures in `type rejection:` tests that call `buildModule`, from this task until Task 13 removes the old overload. That is expected; do not edit a marker to get green in between. This is a prediction, not an observation.

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

```ts
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
      readonly exportedServiceKeys: K & Selection<RegistrationsFromEntries<Entries>, K, 'buildModule'> & SealAdmission<RegistrationsFromEntries<Entries>, Extract<SelectionKey<K[number]>, keyof RegistrationsFromEntries<Entries>>, Constraints>;
    },
  ): Module<
    ExportedServices<ServicesOf<RegistrationsFromEntries<Entries>>, Extract<SelectionKey<K[number]>, keyof RegistrationsFromEntries<Entries>>>,
    ExternalRequirements<ModuleSealedConstraints<Entries, Constraints, Extract<SelectionKey<K[number]>, keyof RegistrationsFromEntries<Entries>>>>,
    ModuleSealedConstraints<Entries, Constraints, Extract<SelectionKey<K[number]>, keyof RegistrationsFromEntries<Entries>>>,
    ModulePublicProviders<RegistrationsFromEntries<Entries>, Extract<SelectionKey<K[number]>, keyof RegistrationsFromEntries<Entries>>>
  >;
  /** @deprecated The 0.4.0 form; the contract step of phase 5 removes it. */
```

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

- [ ] **Step 4: Commit**

```bash
git add src tests
git commit -F - <<'MSG'
feat(builder): buildModule accepts one bag with exportedServiceKeys and moduleLabel

The 0.4.0 positional form stays until the call sites have moved.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

---

### Task 4: `withInstalledModules` (expand, spike S7)

**Files:**
- Create: `src/install-types.ts`
- Modify: `src/di-bag.ts`, `src/module.ts`, `src/runtime.ts`
- Test: `tests/builder-renames.test.ts` (the four module-list tests)

**Interfaces:**
- Produces: `withInstalledModules<const Modules extends readonly unknown[]>(modules: Modules & InstalledModulesAdmission<Entries, Constraints, Modules>): Builder<InstalledModulesEntries<...>, InstalledModulesConstraints<...>>`; `moduleGraph(value, operation?, index?)`; `BindingGraph.withInstallation(description, operation?)`.
- Runtime contract, all of it run in the prototype: a value that is not an array raises `DI_BAG_INVALID_ARGUMENT` (`argument: 'modules'`, `expected: 'an array'`); the list is snapshotted by index before anything is read again; every element is described before any is installed, and a bad element raises `DI_BAG_INVALID_MODULE` with `details: { operation: 'withInstalledModules', index }`; installation runs in list order on the accumulating graph, so an export collision between two modules of one list raises `DI_BAG_DUPLICATE_REGISTRATION` for the later one; contributions keep list order; an empty list is valid.

**The fold below is UNCOMPILED by this planner.** The file comes from a scratch prototype of an earlier planning session whose compile results were not recorded, so treat it as a design that has never met the compiler. What it is meant to do: `InstallFold` walks the tuple head first, carrying the entries and constraints accumulated so far as type ARGUMENTS (evaluated at each step, so the recursion is a tail call and not a nest of deferred object members), and appends to `Checked` one element per module: the module intersected with the same three checks `installModule` applies today (`IntroducesKeys`, `IncrementalChecked`, `IncrementalConstraints`), evaluated against the builder PLUS the modules before it. The parameter type `Modules & Checked` then makes a failed check an assignability error of ONE tuple element, which the compiler reports on that element of the array literal. `const Modules` infers a tuple from an inline array, the same pattern as `buildModule`'s `const K` at 0.4.0.

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

- [ ] **Step 3: Add the method**

In `src/di-bag.ts`, add `import type { InstalledModulesAdmission, InstalledModulesConstraints, InstalledModulesEntries } from './install-types';` and insert directly after `withReplacedService`:

```ts
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
```

- [ ] **Step 4: Run the tests**

Run: `bun test tests/builder-renames.test.ts`
Expected: `11 pass`, `0 fail`.

Run: `bun test tests/nested-modules.test.ts tests/modules.test.ts tests/contributions.test.ts tests/aliases.test.ts`
Expected: `0 fail`; `installModule`, `alias`, `contribute` and `register` still go through the same helpers with their default operation. These four files passed unmodified against the prototype (11, 10, 13 and 19 tests at the 0.4.0 source).

Run: `npm run typecheck`
Expected: exit 0. If `src/install-types.ts` or the method signature is rejected, that is a defect of the uncompiled design: repair it keeping the target shape (three serious attempts), then take the fallback of Task 6.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -F - <<'MSG'
feat(builder): withInstalledModules installs a list of modules in order

Each module is checked against the builder plus the modules before it. A bad
element is named by its index and a rejected list installs nothing.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

---

### Reference for Tasks 5 and 13: the assertions this phase breaks, measured

Measured at the 0.4.0 source with the commands shown. Re-run them on your tree before Task 13; phases 3 and 4 may have added or removed a line.

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

| What | Where | Count | What Task 13 does |
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

**All three files are UNCOMPILED.** They state what must hold; they were never run. How a negative fixture proves WHERE an error lands: `tests/diagnostic-markers.ts` accepts a diagnostic for a `// diagnostic:` marker only when its line is at or after the marker's line and before the next marker's line, and `tests/types.test.ts` fails on any diagnostic no marker claims. Each call below is written over several lines with the marker directly above the offending property or list element. A diagnostic reported on the call's first line, above the marker, is unclaimed and fails the fixture. So: if a fixture fails with an unexpected diagnostic on the line of `.withInstalledModules([` or of the method name, the shape does NOT report on the element, which is a spike failure, not a marker to move. If it fails because the MESSAGE differs (for instance the compiler prints the outer `No overload matches this call` for `withReplacedService`, which has two overloads), read the full flattened message with the command in Step 4 and correct the marker text to a substring the diagnostic really contains. Never delete a case.

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
  .withReplacedService({ serviceKey: clock, provider: (): Clock => ({ now: () => 2 }) });
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

// Two overloads: one-line calls with the marker above, exactly as the 0.4.0 fixtures place them for `replace`.
// diagnostic: replace requires one existing singleton string-literal key
DiBag.createBuilder().withServices({ a: () => 1 }).withReplacedService({ serviceKey: 'missing', provider: () => 2 });
// diagnostic: consumer dependency
DiBag.createBuilder().withServices({ a: () => 1, b: ({ a }: { a: number }) => a }).withReplacedService({ serviceKey: 'a', provider: () => 'text' });

// Two overloads while the 0.4.0 form exists: one line each for now. Task 13 spreads these two over several lines.
// diagnostic: buildModule accepts existing names or typed tokens only
DiBag.createBuilder().withServices({ a: () => 1 }).buildModule({ exportedServiceKeys: ['missing'] });
// diagnostic: is not assignable to type 'string'
DiBag.createBuilder().withServices({ a: () => 1 }).buildModule({ exportedServiceKeys: ['a'], moduleLabel: 1 });
```

Why the last four cases are placed differently. `withReplacedService` has two overloads, and during this phase so has `buildModule`. When every overload fails, the compiler may report `No overload matches this call` on the method name instead of on a property, so a marker inside the bag could sit below the diagnostic and reject a shape that is fine. The 0.4.0 fixtures for `replace` (`tests/types/negative/union-replace.ts`, `replacement-wrong-shape.ts`) are one-line calls with the marker above the statement; they never pinned an argument position, so "the diagnostic still lands where it did" means the call's line for this method. The two markers for `replace` are the substrings those 0.4.0 fixtures use. For `buildModule`, Task 13 removes the second overload and then REQUIRES the property position.

In the contract step (Task 13) the two `register introduces ...` markers and the `replace requires ...` marker are reworded with their messages; until then they carry the 0.4.0 wording because the old and new methods share the check types. Task 13 also adds a case this file cannot hold yet: the 0.4.0 option `label` must be rejected, which is only true once the deprecated `ModuleOptions.label` is gone.

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

What decides the spikes here: for S7, cases one to three of `installed-modules.ts` must report on the element line. For S1, the first four cases of `builder-renames.ts` (`withTokenService` twice, `withServiceAlias` twice) must report on the property line; the `withReplacedService` and `buildModule` cases only have to be reported with their message. Record each result, with the line the compiler reported, in `docs/superpowers/plans/evidence/phase-05.md` (Task 6 creates it).

- [ ] **Step 5: Commit**

```bash
git add tests/types tests/types.test.ts
git commit -F - <<'MSG'
test(types): fixtures for the builder bags and the module list

Negative cases put their marker on the offending property or list element, so
a diagnostic reported on the whole call fails the fixture.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

---

### Task 6: Measure spikes S1 and S7, decide, and the two fallbacks

**Files:**
- Modify: `tests/compiler.ts` (the `moduleListScaleSource` generator)
- Create: `scripts/check-module-list-scale.ts`, `docs/superpowers/plans/evidence/phase-05.md`
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
for count in 1 10 50; do for shape in separate-0.4 separate-0.5 one-list; do $N scripts/check-module-list-scale.ts $shape valid $count; done; done | tee /tmp/di-bag-phase-05/s7.jsonl
$N scripts/check-module-list-scale.ts one-list colliding-export 10
$N scripts/check-module-list-scale.ts separate-0.4 valid 100   # sanity: the same calls as the evidence case `modules 100`
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
5. `separate-0.5` at 50 costs at most 10% more than `separate-0.4` at 50, MINUS what earlier phases already spent on the `modules` case (read the `modules` rows of the latest `docs/superpowers/plans/evidence/phase-0N.md`). This is the shape the evidence case `modules` will have after migration, so it is the one the cumulative budget binds.

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

Both runs take about 75 seconds each and up to 2.3 GB for a 500-operation case; run nothing else heavy meanwhile. `withServiceAlias` and `withCollectionContribution` have no evidence case. Measure them with a chain of 100 calls each way, using the same worker pattern: copy `scripts/check-module-list-scale.ts` to `/tmp/di-bag-phase-05/check-pair.ts`, replace the source with the two generators below, and run it once per style.

```ts
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
```

**Decision rule for S1, per method.** Adopt the bag when its fixtures of Task 5 report on the property, and:
- `withTokenService`: `bindings` 100 and 500 grow by no more than 10% minus what earlier phases spent on `bindings`.
- `withReplacedService`: the same for `replacement`. Also confirm the zero-dependency fast path survived: the `replacement` rows must not grow by a multiple. At 0.4.0 the fast path is what keeps `replacement 500` at 21.8 million instantiations; losing it shows as a jump far beyond 10%.
- `withServiceAlias`, `withCollectionContribution`: the 100-call chain grows by no more than 10%.
- `bulk`, `chained` and `grouped` only rename `register` to `withServices`; they are expected to move by well under 1%, and a larger move means something other than the rename changed.

- [ ] **Step 5: Write the evidence file**

Create `docs/superpowers/plans/evidence/phase-05.md` with: the S7 table (count, shape, instantiations, diagnostics), the S1 table (case, old, new, change), the two chain measurements, the line each Task 5 negative case was reported on, and one line per decision: `S1 withTokenService: adopted` or `fallback`, likewise the other three, and `S7: adopted` or `fallback`, each with the number that decided it. Commit it with the generator and the worker:

```bash
git add tests/compiler.ts scripts/check-module-list-scale.ts docs/superpowers/plans/evidence/phase-05.md
git commit -F - <<'MSG'
test(evidence): measure the builder bags and the module list

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

