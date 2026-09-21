# Swift API Style 0.5.0: Master Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the phase plans task-by-task. This master plan is not executed directly. It fixes what every phase plan shares: constraints, assumptions, protocol, environment, evidence rules and the phase order. Read it before any phase plan.

**Goal:** Ship di-bag 0.5.0 with the public API renamed and reshaped per the spec, seven behavior changes, a codemod, and a migration path.

**Architecture:** Every phase follows expand, migrate, contract: add the new API next to the old one with its own tests, move every call site in the repo with the codemod and by hand, then remove the old API. All work lands on the integration branch `next`. A controller session merges phases, pushes, and releases; executors never push or publish.

**Tech Stack:** TypeScript 6.0.2 (classic, `tsc6`) and 7.0.2 (native, `tsc`), Bun 1.4.0 test runner, Node 24.20.0, npm 11.19.0, TypeDoc and VitePress under `tools/docs`, the TypeScript compiler API for `tools/graph` and `tools/codemod`.

**Spec:** `docs/superpowers/specs/2026-09-20-swift-api-style.md`, with worked examples in `docs/superpowers/specs/2026-09-20-swift-api-style-examples.md`. The spec's rename map is the source of truth for every name. When a plan and the spec disagree on a name, the spec wins and the plan is wrong.

## Global Constraints

- Names, option names, string values, error codes and type names are exactly those in the spec's "Rename map", "Vocabulary" and "Behavior changes" sections. Do not invent, shorten or "improve" a name.
- Lifetime values are `'singleton:one-per-container-tree'` (default), `'scoped:one-per-container'`, `'transient:one-per-resolve'`. Only the full value is accepted.
- One breaking release: `di-bag` 0.5.0, `di-bag-graph` 0.2.0, new package `di-bag-codemod` 0.1.0.
- The package has zero runtime dependencies and must stay that way. `di-bag` must keep bundling for browsers: no `node:` import in `src/index.ts` or anything it imports.
- Parameter shape rule (spec, standard rule 4): no required input means one optional bag; one required input that reads as a phrase with the method name is positional, followed by an optional bag; two or more required inputs take one bag. Never two positional parameters.
- Every phase ends green on all of: `npm run check`, `npm run docs:check`, `npm run graph:check`, `npm run codemod:check` (from phase 1 on), `npm run typecheck:native`, `npm run build:native`, `npm run check:native`, `node --expose-gc --test --test-isolation=none tests/runtime-scale.node.mjs tests/acquisition-retention.node.mjs tests/graph-retention.node.mjs` (CI runs these three suites; they read `dist/`, so build first), `npm run agent-eval:test`, and every `examples/*.ts` run with Bun.
- `AGENTS.md` has a budget of 150 lines, enforced by `npm run docs:check`, and it is at the limit. An edit there must not add lines.
- Compile budget: relative to the 0.4.0 baseline in `docs/superpowers/plans/evidence/baseline.md`, instantiation counts of the benchmark worker cases may grow by at most 10% in total across all phases. A shape that cannot fit takes the fallback named in the spec's "Shapes decided by measurement" table, and the phase records the measurement in `docs/guides/api-naming.md` under "Measured exceptions".
- Runtime messages keep the format `DI_BAG_CODE: message; see <errors page>#<anchor>`. Every runtime code has a section in `docs/agent/errors.md`; `npm run docs:check` enforces it.
- Commits use Conventional Commits and end with the two attribution lines given in "Commit format" below. Executors commit on the phase branch only. Executors never push, never publish, never merge, never edit the spec's decisions.

## Assumptions

The maintainer asked for no questions. Each assumption below was made by the controller and is binding for executors.

1. **Spikes run inside their phase.** The spec lists the eight spikes as one phase. A spike needs the real signature in `src`, so each spike is the expand step of the phase that introduces the shape. Phase 1 builds the codemod and the evidence harness instead.
2. **Instantiations are the budget metric.** They are deterministic. Compile time and peak memory are recorded but advisory, because the host is shared.
3. **Guides are rewritten once.** `docs/guides/*.md` and `README.md` are not type-checked, so they are rewritten in one pass in phase 12, which also makes their standalone examples part of `npm run docs:check`. `AGENTS.md`, `docs/agent/*.md`, the generated API card and reference are checked by `npm run docs:check` and are updated in every phase that breaks them. Nothing deploys from `next`, so stale guides there are harmless.
4. **Old names disappear in the contract step of their phase.** Throwing stubs for removed runtime names are generated once, in phase 13, from the codemod's rename map.
5. **No agent evaluation run.** The spec suggests comparing `scripts/agent-eval` pass rates before and after. Running it launches headless agents, which this environment forbids. `npm run agent-eval:test` still has to pass, and the reference solutions under `scripts/agent-eval/reference` are migrated like any other call site.
6. **A decision record is written.** Phase 10 adds `docs/adr/0001-singleton-by-default.md`.
7. **Release without provenance.** 0.5.0 is published from a local archive with an automation token, as 0.2.0 to 0.4.0 were. `di-bag-graph` 0.2.0 and `di-bag-codemod` 0.1.0 are published first.
8. **Merge by pull request.** `next` is merged into `main` through a pull request after CI is green. If the permission system refuses the merge, the controller stops and reports; it does not push to `main` by another route.
9. **Heavy scale tests are not part of a phase gate.** `npm run benchmark:types` full matrices and the 1,000-operation cases need up to 17 GB. Phases run the worker cases listed under "Evidence" only. The full matrix runs once, in phase 13.
10. **A phase plan may declare a commit that is red on purpose.** A field of a value the library RETURNS cannot be renamed with the old and new name side by side, so phase 11 (Tasks 4, 10 and 11) commits the codemod's rewrite of the readers first and the rename of the declarations directly after it; phase 12 (Task 3) leaves `npm run docs:check` red from the moment the guides' examples are compiled until the guides are rewritten. Phase 5 also declares the Task 4 expand commit and Task 5–11 intermediate commits red for generated-documentation checks only: exposing both builder API generations is predicted to exceed the API card budget; the executor must capture the actual documentation failures before using this exception, and omit a red-state claim when the checks pass. Their applicable runtime and compiler checks still pass; Task 12–13 contracts the surface and regenerates documentation together, and the final card budget is never relaxed. Phase 6 permits the same bounded generated-doc exception from `feat!: add container derivation APIs` through `refactor!: migrate generated and agent container calls`: only observed generated-reference freshness or API-card coverage/budget failures caused by the dual public surface qualify. Capture the exact failures first; all applicable compiler/runtime/codemod/graph and other documentation checks remain green. Tasks 8–11 form one coherent source-and-docs contract commit, `refactor!: contract container API and publish reference`, which ends the exception and restores the unchanged 400-line card budget. Only commits that a plan names this way may be red, each says so in its body, and the phase still ends green. `git bisect` must skip them; the phase report lists their hashes.
11. **Compile-time designs in plans 05 to 11 are uncompiled.** When those plans were written, the machine was short of memory and the TypeScript compiler was not run over `src`. Runtime behavior in them was probed for real; every type-level signature is a proposal. The executor compiles it first, against the positive and negative cases the plan lists; if it does not hold, the executor repairs the signature within the spec's names, and takes the spec's fallback under the "When stuck" rule.
12. **Gates grow with the program.** From the end of phase 11, `node scripts/error-code-inventory.mjs src` must exit 0. From the end of phase 12, `npm run docs:check` includes the retired-name check of the guides. Phase 13 adds `npm run codemod:acceptance`. A phase runs every gate that exists when it starts, plus its own.

## Environment

Run every command from the repository root with the pinned Bun first on `PATH`:

```bash
export PATH="<the directory that holds Bun 1.4.0>/bin:$PATH"   # the planning session kept it in its own scratch directory, which may be gone
export npm_config_update_notifier=false
bun --version   # must print 1.4.0
node --version  # must print v24.20.0
```

Install that Bun anywhere outside the repository, once: `curl -fsSL https://bun.sh/install | BUN_INSTALL=<dir> bash -s "bun-v1.4.0"` and put `<dir>/bin` first on `PATH`. A different Bun makes `tests/platform-evidence.test.ts` fail.

| Command | What it checks | Typical time |
| --- | --- | --- |
| `npm run typecheck` | classic compiler over `src`, `tests`, `examples` | 10 s |
| `npm run test:fast` | runtime tests, `bun test` | 1 min |
| `npm run test:compiler` | compiler fixtures, packaging, native and platform tools | 10 to 25 min |
| `npm run check` | typecheck, both test lanes, build | the sum |
| `npm run build` | emits `dist/` with `tsc6`; tests under `tests/platform` and the package tests read `dist/`, so rebuild after changing `src` | 15 s |
| `npm run docs:generate` | regenerates `docs/agent/api-card.md` and `docs/reference/` from JSDoc | 30 s |
| `npm run docs:check` | docs tool tests, generated files current, agent doc snippets type-check, error coverage, site links | 1 min |
| `npm run graph:check` | `tools/graph` tests | 30 s |
| `node scripts/test-lane.mjs fast tests/<file>.test.ts` does not filter; use `bun test tests/<file>.test.ts` | one test file | seconds |

Baseline on `next` at the 0.4.0 source: 538 fast tests and 575 compiler-lane tests pass; `npm run check` takes about ten minutes. Compiler-lane tests have a 5,000 ms timeout per test. Under host load one of them can time out (seen: `tests/types.test.ts`, "final-adversarial-integration inferred exports survive declaration consumption", 5,016 ms). A timeout is a flake only if `bun test <that file>` passes when run alone on an idle host; anything else is a failure.

During a task run the narrowest command that proves the step. Run the full gate list from "Global Constraints" once at the end of the phase.

## Repository map

| Path | Responsibility |
| --- | --- |
| `src/index.ts` | the public export list; every exported name appears here |
| `src/di-bag.ts` | `Bag` (becomes `Container`), `Builder`, the `DiBagApi` facade and its JSDoc, which feeds the API card |
| `src/types.ts`, `src/module-types.ts`, `src/lifetime-types.ts`, `src/token-types.ts`, `src/scope-types.ts`, `src/alias-types.ts`, `src/contribution-types.ts`, `src/replacement-types.ts` | compile-time checks. A rejected graph is an assignability error against `Unsatisfied<'message', details>` |
| `src/runtime.ts` | `BindingGraph` (immutable, persistent) and `BagRuntime` (one per container) |
| `src/acquisition.ts`, `src/provider-execution.ts`, `src/acquisition-family.ts` | caching, ownership, disposal, stages |
| `src/provider.ts`, `src/provider-operations.ts`, `src/registration.ts`, `src/lifetime.ts`, `src/acquisition-context.ts`, `src/composition.ts`, `src/plugins.ts` | provider descriptions and the facade functions that build them |
| `src/startup.ts` | eager start and bounded close |
| `src/errors.ts`, `src/observers.ts`, `src/inspection.ts` | error classes, lifecycle events, snapshots |
| `tests/*.test.ts` | runtime tests (fast lane) unless listed in `scripts/test-lane.mjs` |
| `tests/types/*.ts`, `tests/types/negative/*.ts` | compiler fixtures. A negative fixture states each expected error in a `// diagnostic: <message>` comment on the line above; `tests/types.test.ts` and `tests/diagnostic-markers.ts` match them |
| `tests/compiler.ts` | helpers to compile a fixture in-process |
| `scripts/benchmark-types.ts`, `scripts/compiler-case.ts`, `scripts/benchmark-compiler-ceiling.ts` | generated-source benchmarks; they emit API calls as strings and must be migrated like call sites |
| `tools/docs/` | API card and reference generation, agent doc checks; `tools/docs/api-card-tasks.json` is the "one way per task" table |
| `tools/graph/` | the published `di-bag-graph`; `lib/extract.mjs` recognises API calls by name |
| `tools/codemod/` | created in phase 1 |
| `docs/agent/`, `AGENTS.md` | shipped in the package; snippets are type-checked |
| `docs/guides/`, `README.md` | the documentation site; rewritten in phase 12 |
| `examples/` | compiled by `npm run typecheck` and run in CI |
| `scripts/agent-eval/` | evaluation skeleton and reference solutions; has its own tests |

## Protocol for every phase

1. **Branch.** `git switch next && git switch -c phase-NN-<slug>`.
2. **Entry check.** Confirm the phase plan's "State on entry" with `grep`. If a name differs from the plan, find the real one; do not guess.
3. **Expand.** Add the new API next to the old one. Write the failing test first, then the implementation. New runtime tests go in a new file `tests/<feature>.test.ts` or the existing file for that feature. New compiler fixtures go in `tests/types/<feature>.ts` and `tests/types/negative/<feature>.ts` and are registered in `tests/types.test.ts` the way their neighbours are.
4. **Measure**, when the phase plan names a spike. See "Evidence".
5. **Migrate.** Extend the codemod's map and transforms for this phase, with a fixture, then run `npm run build`, then run it over the repo: `node tools/codemod/cli.mjs --project tsconfig.json --library-root src --library-root dist --extra-files 'tests/types/negative/*.ts' --write`. Both roots are needed: most files import `../src`, and seven test files import `di-bag` by name, which resolves to `dist/`. The codemod does not read generated-source strings or Markdown, so `tests/compiler.ts`, `scripts/`, `tests/package.test.ts` and the docs are migrated by hand. Fix what it reports as manual. Migrate generated-source strings in `scripts/` and call sites in `scripts/agent-eval/reference`, `scripts/agent-eval/skeleton`, `tools/graph/test/fixtures`, `AGENTS.md` and `docs/agent/*.md` by hand.
6. **Contract.** Remove the old API from `src`, its exports from `src/index.ts`, and its JSDoc. Add one line per removed name to `tests/types/negative/api-renaming.ts` with the diagnostic the compiler gives.
7. **Regenerate.** `npm run build && npm run docs:generate`. Update `tools/docs/api-card-tasks.json` when a task's call was renamed.
8. **Gate.** Run the full gate list. Every command must pass. Paste the last lines of each into the phase report.
9. **Report.** Reply to the controller with: branch name, commits (`git log --oneline next..HEAD`), gate results, spike outcome with numbers, manual items left, and anything that deviated from the plan with the reason. Keep it under 60 lines.

**When stuck.** A compile-time shape that does not work after three serious attempts, or that exceeds the budget, takes the spec's fallback. Record the attempt and the measurement in `docs/guides/api-naming.md` under "Measured exceptions" and continue. A failing test that the plan did not foresee is fixed if it follows from the rename, and reported if it reveals a behavior change the plan did not ask for. Never delete or skip a test to get green. Never weaken a negative fixture.

### Commit format

```
<type>(<scope>): <summary>

<body when useful>

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
```

Use `feat!:` or `refactor!:` for a breaking change. Commit after each task. Keep the codemod's mechanical rewrite in its own commit whose body contains the exact command that produced it.

## Evidence

Baseline numbers live in `docs/superpowers/plans/evidence/baseline.md`, recorded in phase 0 at the 0.4.0 source. The measured cases are these twelve, each run in a fresh process:

```bash
N="node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON"
for count in 100 500; do
  for form in bulk chained grouped replacement; do
    $N scripts/benchmark-types.ts --worker $count $form valid
  done
  for form in bindings modules; do
    $N scripts/check-token-scale.ts $form valid $count
  done
done
```

Each prints one JSON row that contains `instantiations`. The named worker also prints `accepted`, which must be `true`; the token worker prints its diagnostics, which must be empty. `scripts/evidence-cases.mjs` from phase 0 runs all twelve and applies both rules. The source of every case is generated by `scaleSource` and its token counterpart in `tests/compiler.ts`, as strings of API calls, so a rename phase migrates those generators too. A phase that touches a signature in `src/di-bag.ts` or any `src/*-types.ts` file measures all twelve cases after its contract step and appends a table to `docs/superpowers/plans/evidence/phase-NN.md`: case, baseline, now, change in percent. The cumulative change per case must stay within +10%.

A spike additionally states its decision in that file: adopted or fallback, with the numbers.

## The codemod contract

`tools/codemod` is built in phase 1. Later phases only add data and transforms.

- CLI: `node tools/codemod/cli.mjs --project <tsconfig> [--library-root <dir>]... [--extra-files <glob>]... [--map <file>] [--write] [--report <file>]`. The exact schema of the map (`manual` reasons, `arity` to tell overloads apart, owner strings by declaration kind) is in the phase 1 plan and in `tools/codemod/README.md`. Without `--write` it prints a summary of what it would change. `--library-root src` makes it treat declarations under `src/` as the library, which is how this repo runs it; without it, declarations under a `node_modules/di-bag/` directory are the library. `--extra-files` adds files the tsconfig excludes, such as `tests/types/negative/*.ts`.
- It is type-aware. A call, property access, string value or type reference is rewritten only when the checker resolves it to a library declaration. `String.prototype.replace`, `Promise.all` and `Promise.resolve` are never touched.
- It makes one pass over the original program. Every decision uses the original types. A transform builds its replacement text from the already transformed text of its child nodes, so nested rewrites such as `withLifetime(withDisposal(f, d), 'root')` compose without re-parsing.
- `tools/codemod/rename-map.json` holds the data: `methods` (owner, old name, new name, optional transform id), `options` (owner method, old key, new key), `values` (owner method, argument path, old string, new string), `types` (old export, new export), `codes` (old code, new code, or `"manual"`), `imports` (old specifier, new specifier), `properties` (owner type, old property, new property). Owners are the library's declaration names as they are at the start of the phase: `DiBagApi`, `Builder`, `Bag`, `Module`, `Provider`, and the option and snapshot interfaces.
- A transform never hardcodes an API name it emits. It asks `api.nameOf(owner, oldName)`, which answers from the map. When a later phase renames `build` to `buildContainer`, the `buildAndStart` transform written in phase 3 emits the new name without being edited. Each transform has a fixture pair under `tools/codemod/test/fixtures/<id>/` whose expected file is updated by the phase that changes a name it contains.
- The published codemod maps 0.4.0 straight to 0.5.0, so the map always describes the distance from 0.4.0. In this repo it is run once per phase, after the expand step and before the contract step, while the old names still resolve.
- Anything it cannot decide goes to the report as a manual item with file, line and reason. It never guesses.

## Phases

Each row is one plan file in this directory, one branch, one executor, one controller review. A phase starts from the merged result of the one before it.

| Phase | Plan file | Content | Spikes |
| --- | --- | --- | --- |
| 0 | `2026-09-21-01-naming-guide-and-baseline.md` | `docs/guides/api-naming.md`, the naming test with its known-violations ratchet, the evidence baseline | |
| 1 | `2026-09-21-02-codemod-foundation.md` | `tools/codemod` engine, map format, fixtures against the published 0.4.0 types, CI wiring | |
| 2 | `2026-09-21-03-non-breaking-names.md` | documented parameter names, callback parameter names, generic parameter names, summaries that pass the "or" test | |
| 3 | `2026-09-21-04-ensure-services-ready.md` | `ensureServicesReady`, the pending-work report, `close` options, service readiness errors and codes, removal of `buildAndStart` | |
| 4 | `2026-09-21-05-collection-tokens.md` | `forCollectionOf`, `CollectionToken`, reads through `resolve` and dependency lists, replacement of a list, removal of `all`, `resolveAll`, `inspectAll` | S5 |
| 5 | `2026-09-21-06-builder-renames.md` | `withServices`, `withTokenService`, `withServiceAlias`, `withCollectionContribution`, `withReplacedService`, `withInstalledModules`, `verifyGraphAtCompileTime`, `buildModule` bag, `buildContainer` | S1, S7 |
| 6 | `2026-09-21-07-container-renames.md` | `Container` type, `serviceSnapshot`, `graphSnapshot`, `createChildContainer`, `createIndependentContainer` with one bag, `withRenamedExport`, configuration option names, removal of `di-bag/node` | S3 |
| 7 | `2026-09-21-08-requirement-renaming.md` | `module.withRenamedRequirement` | S6 |
| 8 | `2026-09-21-09-provider-sources.md` | `createProvider`, `createProviderFromFunction`, `createProviderFromClass`, `createProviderFromPlugin`, `factoryReturnKind`, `factoryReceivesContext`, `FactoryContext.abortSignal`, factory context for positional functions, `createToken`, `forService`, `token.symbol` | S4 |
| 9 | `2026-09-21-10-provider-methods.md` | decorators as provider methods, the metadata split, `callbackReceives`, `transformReturnKind`, the lifetime values, removal of `FactoryWithDisposal` from the public surface | S2 |
| 10 | `2026-09-21-11-singleton-default.md` | the default lifetime flip, the child-container replacement rule, the codemod's lifetime pins, the decision record | S8 |
| 11 | `2026-09-21-12-observability-and-errors.md` | snapshot and event fields, container events and ids, the disposal vocabulary, error classes, the code taxonomy, `docs/agent/errors.md`, compile-time message families | |
| 12 | `2026-09-21-13-guides-and-readme.md` | every guide, the README and the comparison rewritten to 0.5.0, the composite recipe, the lifetime guide | |
| 13 | `2026-09-21-14-migration-and-release.md` | throwing stubs, the generated negative fixture and migration guide, `di-bag-graph` 0.2.0, `di-bag-codemod` 0.1.0, changelog, version, release candidate gates | |

The spec's roadmap lists eleven phases. This table splits its phases 5 and 7 so that each plan fits one executor, and moves the spikes per assumption 1. The content is the same.

The naming test's known-violations list must be empty at the end of phase 11.
