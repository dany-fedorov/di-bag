> **PARTIAL DRAFT, NOT A PLAN. Do not execute it.** A planner agent was writing this file when the account's spend limit stopped it on 2026-09-21. It holds: header, constraints, what was run, and the start of 'State on entry'. No task is written. It was not reviewed. To finish it, give a planner this file together with `../planner-notes/common.md` and its scope note, and tell it to verify what is here before extending it. The finished plan belongs at `docs/superpowers/plans/2026-09-21-05-collection-tokens.md`.

# Collection Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a token either a single-service token or a collection token, never both: add `DiBag.token(key).forCollectionOf<Item>()`, read a collection through `resolve`, `inspect`, `ensureServicesReady`, dependency lists, `lazy` and alias targets, let `fork`, `createScope` and `replace` swap a whole list, and remove `DiBag.all`, `bag.resolveAll`, `bag.inspectAll`, `CollectionDependency` and the dependency kind `'all'`.

**Architecture:** A second token class, `CollectionToken<TokenSymbol, Item>`, is authenticated by the same WeakMap in `src/tokens.ts`, which now also records the kind. At run time a collection symbol never gets a public slot from `contribute`; every read (`resolve`, `acquire`, `inspect`, the dependency proxy, an alias) asks one helper that returns the public slot when a replacement put one there and the contribution list otherwise. At compile time contributions stay in the builder's constraint parameter; `resolve` and `inspect` gain one conditional on the token kind (spike S5), dependency tuples route a collection token into the graph contract's collection member, and replacement signatures see a collection token as a synthetic slot of the registrations map. The phase follows expand, migrate, contract: both kinds are accepted by `contribute`, `all`, `resolveAll` and `inspectAll` until every call site has moved.

**Tech Stack:** TypeScript 6.0.2 (`tsc6`) and 7.0.2 (`tsc`), Bun 1.4.0 (`bun test`), Node 24.20.0, `tools/codemod` from phase 1, TypeDoc under `tools/docs`, `scripts/evidence-cases.mjs` from phase 0.

**Spec:** `docs/superpowers/specs/2026-09-20-swift-api-style.md`, sections "Collection tokens" (under "Behavior changes"), "Facade", "Builder" and "Container" rows for `all`, `contribute`, `resolveAll`, `inspectAll`, "Snapshots and events" (the `tokenDependencies` row), "Errors" (`DI_BAG_WRONG_TOKEN_KIND`), "Exported types" (`CollectionDependency`), "Shapes decided by measurement" (S5) and "Migration support". Worked examples 4, 7 and 8 in `docs/superpowers/specs/2026-09-20-swift-api-style-examples.md`. Read `docs/superpowers/plans/2026-09-21-00-swift-api-style-master.md` first: its protocol, environment, commit format, evidence rules and gate list apply to every task here. This is phase 4 of its phase table. The spec's names win over anything written here.

## Global Constraints

- This is phase 4 of the master plan. Branch: `phase-04-collection-tokens`, cut from `next`. Executors never push, publish, merge, or edit the spec.
- Names introduced here are final 0.5.0 names from the spec: `forCollectionOf`, `CollectionToken`, `DI_BAG_WRONG_TOKEN_KIND`, and the two kind values `'single-service'` and `'collection'` (the spec's vocabulary words "single-service token" and "collection token", in kebab-case). Do not shorten or vary them.
- Support types this plan adds are not in the spec, so the plan names them, and they follow the naming guide: `CollectionTokenBase`, `CollectionItem`, `CollectionSelection`, `SingleServiceTokenAdmission`, `CollectionTokenAdmission`, `WrongTokenKind`, `CollectionSlots`. If the naming test rejects one, choose another compliant name; never add a violation to the list.
- Names that are NOT changed in this phase, even though later phases change them: `DiBag.token`, `.of<S>()`, `token.key`, `register`, `contribute`, `alias`, `replace`, `installModule`, `build`, `buildModule`, `resolve`, `inspect`, `inspectGraph`, `fork`, `createScope`, the class `Bag`, the snapshot fields `tokenDependencies[].key` and `.kind`, `contributions[].token`, and the codes `DI_BAG_INVALID_OVERRIDE`, `DI_BAG_INVALID_SCOPE`, `DI_BAG_INVALID_REPLACEMENT`, `DI_BAG_INVALID_STARTUP`, `DI_BAG_INVALID_EXPORT`. Leave every one of them alone.
- A NEW validation site in this phase raises `DI_BAG_WRONG_TOKEN_KIND` with `details: { operation, expectedKind, receivedKind }`. `operation` is the method name as it is in this phase (`register`, `alias`, `contribute`, `optional`, `createScope`, `buildModule`); each later rename phase updates it.
- Every library error message keeps the form `DI_BAG_CODE: message; see <errors page>#<anchor>`, and every single-quoted `'DI_BAG_*'` literal in `src/` has exactly one section in `docs/agent/errors.md`. `npm run docs:check` enforces both directions, so the code and its section land in the same commit. Keep the literal on the same line as its `libraryError(` call: the inventory script of phase 11 reads it that way.
- Compile budget: the twelve evidence cases may grow by at most 10% in total across all phases (master plan). This phase touches hot signatures (`resolve`, `register`, `fromFunction`), so it measures twice: after the expand step, which is spike S5, and after the contract step.
- Every compile-time signature in this plan is UNCOMPILED (master plan, assumption 11): it was designed by reading the code, and the TypeScript compiler was not run. Each task that changes types lists the positive and negative cases that must hold. Compile them first. When a signature does not hold, repair it within the names above; after three serious attempts, or over budget, take the fallback of Task 6.
- `AGENTS.md` is at its 150-line budget. This phase does not edit it.
- The package keeps zero runtime dependencies, and `src/index.ts` must not import a `node:` module.
- Never delete, skip or weaken a test or a negative fixture to get green. A failing assertion on a message this phase did not touch is a behavior change to report.
- Environment for every command (master plan, "Environment"):

```bash
export PATH="/tmp/claude-1000/-home-df-wd-personal-di-bag/7818417c-3b3a-48db-9bef-85624eff953b/scratchpad/bun/bin:$PATH"
export npm_config_update_notifier=false
bun --version   # 1.4.0
node --version  # v24.20.0
```

## What was run for this plan, and what was not

Written on 2026-09-21 against the 0.4.0 source (`src/` is unchanged on `next` since `v0.4.0`), with Bun 1.4.0 and Node 24.20.0.

**Run.**

- A probe at the unmodified 0.4.0 source (4 tests, 21 assertions, all passed) confirmed what this phase changes: for a token that only has contributions, `resolve` and `inspect` throw `DI_BAG_MISSING_REGISTRATION`, `fork` throws `DI_BAG_INVALID_OVERRIDE`, `createScope` (keys and `share`) throws `DI_BAG_INVALID_SCOPE`, `replace` throws `DI_BAG_INVALID_REPLACEMENT`, `buildModule` throws `DI_BAG_INVALID_EXPORT`, `buildAndStart` rejects with `DI_BAG_INVALID_STARTUP`; a bare token, `lazy` and an alias read only the single channel (`DI_BAG_MISSING_DEPENDENCY`), `optional` yields `undefined`; with one token on both channels `resolveAll` and an `all` reader ignore the public slot; `Object.keys(DiBag.token(key))` is `['of']`.
- The runtime edits of Tasks 1 to 4 (expand) and of Task 9 (contract) were applied to two scratch copies of `src/`. `bun test` does not type-check, so this proves behavior only. Because phase 3 had not been executed, the expand copy got a stand-in `Bag.ensureServicesReady(serviceKeys)` with the key loop of the phase 3 plan and no options; the collection branch of Task 2 Step 5 was applied to that stand-in.
- The complete `tests/collection-tokens.test.ts` of Tasks 1 to 4 (13 tests, 85 assertions): 0 pass and 13 fail at the unmodified source, first error `forCollectionOf is not a function`; 13 pass on the expand copy and 13 pass on the contract copy.
- On the expand copy the untouched `tests/contributions.test.ts` still passes (13 tests): the old channel keeps working until the contract step.
- On the contract copy, after the migration this plan prescribes: `tests/contributions.test.ts` (13), `tests/nested-modules.test.ts` (11), `tests/persistent-module.test.ts` (2), `tests/plugins.test.ts` (18), `tests/inspect-graph.test.ts` (3), `tests/observers.test.ts` (13), `tests/enterprise-integration.test.ts` (7), `tests/persistent-graph.test.ts` (11), `tests/final-adversarial-integration.test.ts` (13) all pass, `examples/contributions.ts` prints `Hello, DI!`, and the three migrated fixture strings (`contributionRuntimeAssertions`, `observerRuntimeAssertions`, `pluginRuntimeAssertions`) evaluate without an assertion failure. The unmigrated `contributionRuntimeAssertions` fails there, which shows the harness is sensitive.
- The script of Task 8 Step 4 (`phase05_strings.py`) ran on copies of its five files: every count matched, a second run reported `already migrated`.
- The three codemod transforms of Task 7, their shared analysis and the two-line engine change ran once, on the engine code of the phase 1 plan (byte-identical to that plan's code blocks) and the vendored published 0.4.0 declarations, over the two fixture inputs of Task 7 only: the inputs type-check, and the output and the four manual items are exactly the fixture files of Task 7. The same run over `examples/contributions.ts` (import changed to `di-bag`) converted it with no manual item. That run took 0.6 s and 236 MiB.
- Every count in this plan was measured with the command next to it.

**Not run.** `tsc`, `tsc6`, `npm run typecheck`, `npm run build`, `npm run check`, `npm run docs:check`, the evidence cases, and the codemod over this repository (its program would load `src`). So: no type-level signature, no fixture under `tests/types/`, no TypeDoc output, no instantiation count and no list of codemod manual items for this repository is confirmed. The manual items of Task 8 are a prediction from a text census.

## State on entry

Phases 0 to 3 are merged into `next`. Confirm each line before Task 1. If a name differs, find the real one with `grep` and adjust only that reference; do not guess.

| Expectation | Command | Expected |
| --- | --- | --- |
| Phase 0: the naming ratchet and the evidence helper exist | `ls tests/api-naming.test.ts tests/api-naming-known-violations.json scripts/evidence-cases.mjs docs/superpowers/plans/evidence/baseline.md` | four paths, no error |
| Phase 1: the codemod exists, with one transform | `ls tools/codemod/cli.mjs tools/codemod/rename-map.json && ls tools/codemod/lib/transforms` | the two files, then `build-and-start.mjs index.mjs` |
| Phase 2: role names for class type parameters | `grep -n "^class Bag<\|^class Builder<" src/di-bag.ts` | `class Bag<ServiceRegistrations extends Registrations, Constraints extends NeedConstraint = never>` and `class Builder<Entries extends Entry, Constraints extends NeedConstraint = never>` |
| Phase 2: `Token<TokenSymbol, Service>` | `grep -n "^class Token<" src/tokens.ts` | `class Token<TokenSymbol extends symbol, Service> extends TokenBase {` |
| Phase 2: `dependencies`, not `deps`, in signatures | `grep -c "deps: \|factoryCtx" src/alias-types.ts src/acquisition-context.ts` | `0` for both files |
| Phase 3: `ensureServicesReady` exists, `buildAndStart` is gone | `grep -c "ensureServicesReady" src/di-bag.ts; grep -c "buildAndStart" src/di-bag.ts src/startup.ts` | a number above 0, then `0` twice |
| Phase 3: the key loop this phase edits | `grep -n "graph.hasPublic(key)" src/startup.ts` | one line, inside `ensureRuntimeReady` |
| This phase has not run | `grep -rn "forCollectionOf\|WRONG_TOKEN_KIND" src docs/agent tools/codemod \| wc -l` | `0` |
| Still 0.4.0 names | `grep -c "resolveAll\|inspectAll" src/di-bag.ts; grep -c "  all: typeof all;" src/di-bag.ts` | a number above 0, then `1` |

Public names this phase works with, as they are on entry: `DiBag.token(key).of<S>()`, `token.key`, `DiBag.optional`, `DiBag.lazy`, `DiBag.all`, `DiBag.fromFunction`, `DiBag.fromClass`, `DiBag.fromPlugin`, `builder.register`, `builder.contribute`, `builder.alias`, `builder.replace`, `builder.installModule`, `builder.buildModule`, `builder.build`, `bag.resolve`, `bag.resolveAll`, `bag.inspect`, `bag.inspectAll`, `bag.inspectGraph`, `bag.fork`, `bag.createScope`, `bag.ensureServicesReady(serviceKeys, { abortSignal, totalTimeoutMs, maxConcurrentServiceKeys })`, `bag.close({ abortSignal, waitTimeoutMs })`.

Inside `class Bag` the type parameters are `ServiceRegistrations` and `Constraints`; inside `class Builder` they are `Entries` and `Constraints`. Type parameters of methods, functions and helper types kept their letters. Where this plan quotes a 0.4.0 line that contains `R`, `E` or `C` of those two classes, the line on disk has the role name.

Facts about the code that the tasks rely on, all read on 2026-09-21:

- `src/tokens.ts` authenticates a token through the module-private `const keys = new WeakMap<TokenBase, symbol>()`; `readTokenKey(value)` throws `DI_BAG_INVALID_TOKEN` for anything that is not in it.
- Contributions live in `BindingGraph.#contributions`, keyed by symbol, separate from `#publicSlots`. `contribute` never creates a public slot. `fork`, `createScope` and `replace` write a public slot with `withPublicBinding`.
- `ScopeAcquisitions.resolve(key)` goes through `graph.publicBinding(key)`, which throws `DI_BAG_MISSING_REGISTRATION` without a slot. The dependency proxy in `resolveBinding` reads through the local `read(key, optional, all)`.
- `Selection`, `TokenMember`, `Overrides`, `OverrideFactoryContext` and `SelectedRegistrations` (`src/types.ts`, `src/token-types.ts`) admit a token only when its symbol is a key of the registrations map. Contributions are `Contribution<T, V>` members of the constraint parameter, never keys of that map.
- `ReferenceGraph<T>` (`src/token-types.ts`) has a fast path, `T extends readonly TokenBase[] ? TokenDependencyContract<T>`, that treats every bare token as required; `MissingTokens` then demands a binding for it.
- `tools/graph/lib/extract.mjs` does not read `contribute`, `all`, `resolveAll` or `inspectAll` (`grep -n "contribut\|resolveAll\|inspectAll" tools/graph/lib/*.mjs tools/graph/test/*.mjs` prints nothing), and neither do `scripts/agent-eval`, `AGENTS.md` or `docs/agent/recipes.md`. The generators `scaleSource` and `tokenScaleSource` in `tests/compiler.ts` emit none of the calls this phase renames. None of them changes in this phase.

