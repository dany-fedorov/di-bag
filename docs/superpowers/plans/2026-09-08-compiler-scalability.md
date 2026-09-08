# Compiler Scalability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve individual-chain/compiler scalability while preserving exact contracts and produce honest original 100/500/1000 matrix evidence on both compiler lanes.

**Architecture:** Retain flat Entry history and existing invariant builder state. Narrow directional graph projections, then make root module installation incremental for proved constraint categories while retaining conservative full checks elsewhere. Bounded feasibility gates prevent an unproved optimization from becoming an API/state redesign.

**Tech Stack:** Bun tests, Node supervised workers, classic TypeScript API 6.0.3 through wrapper 6.0.2, native TypeScript 7.0.2, actual npm archives, Linux process supervision and flock.

**Spec:** `docs/superpowers/specs/2026-09-08-compiler-scalability-design.md`. Also read `2026-09-08-native-diagnostics-design.md` before changing shared builder files.

## Global Constraints

- Keep classic API TypeScript 6.0.3 through wrapper 6.0.2 and native TypeScript 7.0.2 pinned; compiler migration requires a separate justified design.
- Keep strict NodeNext checking, exactOptionalPropertyTypes, noUncheckedIndexedAccess, ES2022, and existing declaration/package routes.
- Preserve exact synchronous/Promise outputs, required receivers, provider metadata, acquisition frames, acquired values, token identity and graph G, and module constraints C.
- Preserve invariant Builder entry history and safe standard Parameters/ReturnType views; no cast-free history erasure or any-based validation escape is acceptable.
- Preserve all invalid program bodies, useful primary requirements, explicit supplemental diagnostics, and existing native gap fingerprints unless individually proved resolved.
- Keep original generated source forms, counts, imports, consumer assignments, and diagnostic boundaries; no batching, statement splitting, stack increase, or type erasure may substitute for a failed row.
- Keep 100-case classic ceilings at 1500000 named and 2000000 token instantiations, with zero diagnostics.
- Run one compiler-heavy process at a time across source audits, package builds, work gates, experiments, and matrices.
- Keep native limits at 60000 ms, 3072 MiB sampled child RSS, 20 ms sampling, and 4194304 combined output bytes; keep classic workers at 60000 ms, 3072 MiB old-space, default stack, and 4194304 output bytes.
- Do not conflate classic heap limits, native sampled RSS, native metrics, classic instantiations, or editor latency.
- No required decorators, reflect-metadata, custom compiler transforms, dynamic code generation, new runtime dependencies, or runtime ownership changes.
- Work in the existing approved checkout; do not change box repositories or publish, push, merge, remove workspaces, or store credentials under this plan.

---

## Execution and file ownership

Use the existing approved checkout, not a new branch/worktree. This document
authorizes no execution during its authoring. On execution, inspect current HEAD
and dirty paths first; the inspected planning checkpoint is
`739b509eb7942e4e26c972a711d003aaf8769997`, not an assumed immutable execution HEAD.
Read the enterprise tracker and preserve unrelated edits.

Task 1 owns selected-case orchestration and evidence validation. Task 2 owns
`src/types.ts` directional projections. Task 3 owns root install checking and
`src/module-types.ts`. Task 4 owns fixture routing and new evidence/reporting.
The diagnostics plan owns replacement overloads. Do not concurrently edit
`src/di-bag.ts`; apply its candidate only to the current checker boundary.

All compiler-heavy commands below acquire the same outer lock:

```sh
command -v flock
flock -x /tmp/di-bag-compiler-heavy.lock bun test tests/incremental-scale.test.ts
```

Do not acquire this lock recursively in a child worker; hold it for the complete
parent command. A shell command using a standalone worker without parent timeout
is not a permitted measurement. Small experiment children may use 10 seconds and
512 MiB, separately labelled; accepted rows retain original limits. Keep progress
updates while asynchronous tools yield. Store new logs under
`.superpowers/sdd/2026-09-08-compiler-scalability/`; do not alter old matrix files.

## Task 1: Strict selected-case evidence and current RED controls

**Files:**

- Create: `scripts/compiler-case.ts`, `scripts/check-compiler-case.ts`.
- Create: `tests/compiler-case.test.ts`.
- Read/reuse: `tests/compiler.ts`, `scripts/benchmark-result.ts`, `scripts/native-scale.ts`, `scripts/native-compiler.ts`, `scripts/benchmark-types.ts`, `scripts/check-token-scale.ts`.
- Evidence: `.superpowers/sdd/2026-09-08-compiler-scalability/baseline.jsonl`.

**Interfaces:** Export `CompilerLane = 'classic' | 'native'`,
`parseCompilerCase(args: readonly string[]): {lane: CompilerLane; item: MatrixCase}`,
and `runCompilerCase(root: string, lane: CompilerLane, item: MatrixCase): Promise<Record<string, unknown>>`.
The CLI takes exactly lane/count/form/scenario, prints one JSON row and exits 1
when `accepted !== true`. Existing whole-report commands keep their current
collector semantics.

- [ ] **Step 1: Write parser and acceptance RED tests before creating the helper.**

```ts
import { expect, test } from 'bun:test';
import { parseCompilerCase } from '../scripts/compiler-case';
import { evaluateWorker } from '../scripts/benchmark-result';

test('selected compiler case admits only original matrix identities', () => {
  expect(parseCompilerCase(['native', '500', 'modules', 'valid'])).toEqual({
    lane: 'native', item: { count: 500, form: 'modules', scenario: 'valid' },
  });
  for (const args of [
    ['native', '501', 'modules', 'valid'],
    ['classic', '500', 'modules', 'wrong-shape'],
    ['native', '500', 'chained', 'missing-final-token'],
    ['other', '100', 'bulk', 'valid'],
    ['classic', '100', 'bulk', 'valid', 'extra'],
  ]) expect(() => parseCompilerCase(args)).toThrow();
});

test('a claimed accepted result cannot hide an original-boundary failure', () => {
  const item = { count: 100, form: 'replacement', scenario: 'wrong-shape' } as const;
  const diagnostic = { file: '/tmp/graph.ts', line: 152, column: 10,
    code: 2345, message: 'a dependency has the wrong shape' };
  const row = { ...item, accepted: true, boundaryLine: 152, diagnostics: [diagnostic] };
  const child = { status: 0, signal: null, stderr: '', stdout: JSON.stringify(row) };
  expect(evaluateWorker(item, child, '/tmp/graph.ts').accepted).toBe(true);
  for (const diagnostics of [
    [], [{ ...diagnostic, code: 2589 }], [{ ...diagnostic, line: 153 }],
    [{ ...diagnostic, file: '/tmp/other.ts' }],
    [{ ...diagnostic, message: 'The last overload gave the following error.' }],
  ]) expect(evaluateWorker(item, {
    ...child, stdout: JSON.stringify({ ...row, diagnostics }),
  }, '/tmp/graph.ts').accepted).toBe(false);
});
```

Run `bun test tests/compiler-case.test.ts`; expect missing helper/import RED.
Existing `tests/benchmark-types.test.ts` already has malformed-JSON, process,
same-file cascade and duplicate-boundary controls; retain them.

- [ ] **Step 2: Implement exact identity parsing and supervised dispatch.**

In `scripts/compiler-case.ts`, use this parser:

```ts
export type CompilerLane = 'classic' | 'native';
export function parseCompilerCase(args: readonly string[]) {
  const [lane, countText, form, scenario] = args;
  const count = Number(countText);
  const token = form === 'bindings' || form === 'modules';
  const forms = ['bulk', 'chained', 'grouped', 'replacement', 'bindings', 'modules'];
  const scenarios = token
    ? ['valid', 'missing-final-token', 'mismatched-invariant-service']
    : ['valid', 'missing', 'wrong-shape'];
  if (args.length !== 4 || (lane !== 'classic' && lane !== 'native')
    || !['100', '500', '1000'].includes(countText ?? '')
    || !forms.includes(form ?? '') || !scenarios.includes(scenario ?? '')) {
    throw new Error('expected lane count form scenario from the original matrix');
  }
  return { lane, item: { count, form, scenario } as MatrixCase };
}
```

Import `MatrixCase/evaluateWorker`, `nativeScale/resolveNative`,
`spawnSync/execFileSync`, `resolve`, and the existing source/boundary generators.
The native branch calls `await nativeScale(root, await resolveNative(root), item)`.
The classic branch uses exactly:

```ts
const tokens = item.form === 'bindings' || item.form === 'modules';
const args = tokens
  ? [resolve(root, 'scripts/check-token-scale.ts'), item.form, item.scenario, String(item.count)]
  : [resolve(root, 'scripts/benchmark-types.ts'), '--worker', String(item.count), item.form, item.scenario];
const child = spawnSync(process.execPath, [
  '--max-old-space-size=3072', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', ...args,
], { cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 4194304 });
const row = evaluateWorker(item, {
  status: child.status, signal: child.signal, stdout: child.stdout, stderr: child.stderr,
  ...(child.error ? { error: child.error.message } : {}),
}, resolve(root, tokens ? 'tests/generated-token-scale.ts' : 'tests/generated-type-scale.ts'));
```

Recompute the expected boundary from the unchanged generator and reject a row
whose boundary differs, even if its own claimed diagnostic/boundary pair matches.
Require `resolve(root) === process.cwd()` because existing generator paths are
resolved at module import. Attach source commit/dirty status, recursively sorted
`src/**/*.ts` SHA-256, generated-source SHA-256 and process wall time. Use Node
`createHash`, `readdirSync({withFileTypes:true})`, `readFileSync`, and
`execFileSync('git',['rev-parse','HEAD'])`; hash path names plus file bytes as
`nativeScale` does. Capture dirty state with `git status --porcelain -- src`.
Do not claim clean commit provenance when those bytes differ from HEAD.

The CLI implementation is:

```ts
import { parseCompilerCase, runCompilerCase } from './compiler-case.ts';
async function main() {
  const { lane, item } = parseCompilerCase(process.argv.slice(2));
  const row = await runCompilerCase(process.cwd(), lane, item);
  console.log(JSON.stringify(row));
  if (row.accepted !== true) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
```

- [ ] **Step 3: Add real small controls and run GREEN.**

Add tests calling `runCompilerCase` for classic/native 100 bulk valid and missing.
Assert exact case identity, compiler identity, nonempty hash fields, accepted true,
and useful missing diagnostics at the generated boundary. Add a spawned CLI test
for an invalid identity: nonzero exit, no JSON success. Bound outer Bun tests at
65000 ms per selected case; execute under the shared lock.

```sh
flock -x /tmp/di-bag-compiler-heavy.lock bun test tests/compiler-case.test.ts tests/benchmark-types.test.ts tests/native-compiler.test.ts --timeout 120000
```

- [ ] **Step 4: Collect current representative RED evidence, serially.**

Run one current 100 named/work control, 100 token/work control, native 500 modules
valid, native 1000 bindings valid, native 1000 chained valid, and native 100
replacement wrong-shape. Use the selected CLI; for example:

```sh
flock -x /tmp/di-bag-compiler-heavy.lock node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-compiler-case.ts native 500 modules valid
flock -x /tmp/di-bag-compiler-heavy.lock node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-compiler-case.ts native 1000 bindings valid
flock -x /tmp/di-bag-compiler-heavy.lock node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-compiler-case.ts native 1000 chained valid
flock -x /tmp/di-bag-compiler-heavy.lock node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-compiler-case.ts native 100 replacement wrong-shape
flock -x /tmp/di-bag-compiler-heavy.lock bun test tests/incremental-scale.test.ts
```

Retain actual outputs, including unexpected current improvements. A historical
failure that now passes is not genuine current RED. Do not run all large rows
during this reconnaissance step.

- [ ] **Step 5: Verify the evidence interface and make a scoped checkpoint.**

Run `npm run typecheck` under the lock, `git diff --check`, and inspect that
no generator or acceptance allowance changed. Commit only the new helper/CLI/tests
after GREEN: `git add scripts/compiler-case.ts scripts/check-compiler-case.ts tests/compiler-case.test.ts`,
then `git commit -m "test: add strict selected compiler case runner"`.
Request review of worker supervision, identity validation and honest RED evidence.

## Task 2: Dependency-directed root projections

**Files:** Modify `src/types.ts`; create `tests/types/incremental-projections.ts`
and `tests/types/negative/incremental-projections.ts`; modify
`tests/incremental-scale.test.ts` only to add a candidate work assertion with a
captured baseline, never to change existing ceilings.
**Interfaces:** Internal `RelevantEntries<E extends Entry, K extends PropertyKey>`
and `RelevantProvided<E extends Entry, K extends PropertyKey>`; existing
`IncrementalChecked<E,N>` input/result contract remains unchanged.

- [ ] **Step 1: Add exact projection and graph-behavior tests.**

```ts
import { DiBag } from '../../src';
import type { Assert, Equal } from './assert';
import type { Entries, RelevantProvided } from '../../src/types';
type R = { a: () => number; b: () => Promise<string> };
type Projected = Assert<Equal<RelevantProvided<Entries<R>, 'b'>, { b: Promise<string> }>>;
const before = DiBag.begin().add({
  value: () => 1,
  read: ({ value }: { value: number }) => value.toFixed(),
});
export const changed = before.replace('read', () => true).replace('value', () => 'new');
export const synchronous = changed.end().resolve('value');
type Exact = Assert<Equal<typeof synchronous, string>>;
```

Negative fixture bodies:

```ts
import { DiBag } from '../../../src';
// diagnostic: a dependency has the wrong shape
DiBag.begin().add({ read: ({ value }: { value: number }) => value }).add({ value: () => 'wrong' });
// diagnostic: a dependency has the wrong shape
DiBag.begin().add({ value: () => 'wrong' }).add({ read: ({ value }: { value: number }) => value });
const graph = DiBag.begin().add({ value: () => 1,
  a: ({ value }: { value: number }) => value,
  b: ({ value }: { value: number }) => value });
// diagnostic: a dependency has the wrong shape
graph.add({ later: ({ value }: { value: string }) => value });
```

Keep existing replacement negatives and their declared gaps intact. The missing
projection exports give interface RED; the behavioral cases are initially passing
compatibility controls. Before production changes run the two original work
programs and record their actual instantiations. Add a targeted comparison requiring
candidate work `<= Math.floor(baselineInstantiations * 0.75)`; record that it fails
against the unchanged baseline. This target does not replace either fixed ceiling.

- [ ] **Step 2: Implement the projection candidate without changing public generics.**

```ts
export type RelevantEntries<E extends Entry, K extends PropertyKey> =
  E extends Entry ? E['key'] extends K ? E : never : never;
export type RelevantProvided<E extends Entry, K extends PropertyKey> = {
  [P in RelevantEntries<E, K> as P['key']]: ProviderOutput<P['registration']>;
};
type NewWrong<E extends Entry, N extends Registrations> = {
  [K in keyof N]: RelevantProvided<E, Exclude<keyof Needs<N[K]>, keyof N>>
    extends Pick<Needs<N[K]>, Exclude<keyof Needs<N[K]>, keyof N> & E['key']>
      ? never : K;
}[keyof N];
type OldWrong<E extends Entry, N extends Registrations> = E extends Entry
  ? E['key'] extends keyof N ? never
    : [keyof Needs<E['registration']> & keyof N] extends [never] ? never
    : Pick<Provided<N>, keyof Needs<E['registration']> & keyof N> extends
      Pick<Needs<E['registration']>, keyof Needs<E['registration']> & keyof N>
        ? never : E['key']
  : never;
```

Use the existing imported `ProviderOutput`. For `NewTokenWrong`, project
surviving E only to `TokenKey<ProviderTokenNeeds<N[K]> | ProviderOptionalTokenNeeds<N[K]>>`
before calling `WrongToken`. For `OldTokenWrong`, skip only when that dependency
key union has no overlap with `keyof N`; exclude overwritten consumers first.
Import `TokenKey` from `./tokens`. Keep `Checked<N>`, unknown/opaque admission,
error selection and final `Complete` unchanged.

- [ ] **Step 3: Run source/reflection and work GREEN before larger cases.**

```sh
flock -x /tmp/di-bag-compiler-heavy.lock bun test tests/types.test.ts --test-name-pattern 'incremental|replacement|builder views|modern inline|token'
flock -x /tmp/di-bag-compiler-heavy.lock bun test tests/incremental-scale.test.ts tests/type-scale.test.ts tests/token-scale.test.ts --timeout 120000
flock -x /tmp/di-bag-compiler-heavy.lock npm run check:native
```

The generic negative-file loop in `tests/types.test.ts` picks up new negatives;
add one named positive test compiling `incremental-projections.ts` via existing
`diagnostics/describeDiagnostic`. Include existing `builder-views`,
`replacement-supported`, `replacement-views`, provider union/receiver and
modern inline fixtures. Native gap totals must not grow.

If the candidate cannot improve relevant work without changing diagnostics or
the grouped1000 gate, revert its source delta. At most three causal projection
variants; record the measured outcome before selecting another architecture.

- [ ] **Step 4: Validate original named/binding cases and checkpoint.**

Use selected runner classic/native 500 chained valid and wrong-shape, 500 bindings
valid/invariant mismatch, and 1000 chained/bindings valid, one process at a time.
Failures remain explicit; do not run repeated timeout rows merely to vary syntax.
Run locked `npm run typecheck`, `npm run build`, then `git diff --check`.
Commit only the adopted projection and source/work tests with
`git commit -m "perf(types): narrow incremental dependency projections"`.
Review soundness and unchanged worker/ceiling contracts before Task 3.

## Task 3: Incremental installation constraints and remaining-depth decision

**Files:** Modify `src/module-types.ts`, `src/di-bag.ts`; create
`tests/types/incremental-modules.ts`, `tests/types/negative/incremental-modules.ts`.
Read `src/contribution-types.ts`, `src/lifetime-types.ts`, `src/token-types.ts`.
**Interfaces:** Export internal
`IncrementalConstraints<C extends NeedConstraint, MC extends NeedConstraint, Old extends Registrations, Incoming extends Registrations>`.
Root install retains `Builder<E | Entries<D>, C | MC>`.

- [ ] **Step 1: Write private/forward/token installation regression fixtures.**

Positive producer:

```ts
import { DiBag } from '../../src';
import type { Assert, Equal } from './assert';
const requirement = DiBag.module().add({
  hidden: ({ value }: { value: number }) => value.toFixed(),
}).exports([]);
const values = DiBag.module().add({ value: () => 1 }).exports(['value']);
export const left = DiBag.begin().install(requirement).install(values).end();
export const right = DiBag.begin().install(values).install(requirement).end();
export const result = right.resolve('value');
type Exact = Assert<Equal<typeof result, number>>;
const key = Symbol('value');
export const token = DiBag.token(key).of<number>();
const tokenNeed = DiBag.module().add({ hidden: DiBag.fromTokens([token], x => x) }).exports([]);
export const tokenGraph = DiBag.begin().install(tokenNeed).bind(token, () => 1).end();
```

Negative body:

```ts
import { DiBag } from '../../../src';
const needed = DiBag.module().add({ hidden: ({ value }: { value: number }) => value }).exports([]);
const wrong = DiBag.module().add({ value: () => 'wrong' }).exports(['value']);
// diagnostic: a dependency has the wrong shape
DiBag.begin().install(needed).install(wrong);
// diagnostic: a dependency has the wrong shape
DiBag.begin().install(wrong).install(needed);
// diagnostic: missing factories
DiBag.begin().install(needed).end();
const key = Symbol('value');
const narrow = DiBag.token(key).of<number>();
const wide = DiBag.token(key).of<number | string>();
const needsWide = DiBag.module().add({ hidden: DiBag.fromTokens([wide], x => x) }).exports([]);
// diagnostic: a dependency has the wrong shape
DiBag.begin().bind(narrow, () => 1).install(needsWide);
```

Add source positive routing. Use current 500/modules/valid failed selected-case
assertion as performance RED; retain initially passing semantic controls.

- [ ] **Step 2: Implement plain-constraint incrementality with full fallback.**

```ts
export type IncrementalConstraints<
  C extends NeedConstraint, MC extends NeedConstraint,
  Old extends Registrations, Incoming extends Registrations,
> = [Extract<C | MC, { kind: 'contribution' | 'all' | 'opaque' | 'lifetime' }>] extends [never]
  ? unknown extends CheckedConstraints<C, Incoming>
    ? CheckedConstraints<MC, import('./types').Merge<Old, Incoming>>
    : CheckedConstraints<C, Incoming>
  : CheckedConstraints<C | MC, import('./types').Merge<Old, Incoming>>;
```

Change root install parameter only:

```ts
module: Module<P, R, MC, D> & Introduces<From<E>, D> &
  IncrementalChecked<E, D> & IncrementalConstraints<C, MC, From<E>, D>
```

Keep runtime body, return, module invariants, public projection, closure and
lifetime checks unchanged. Existing C is retained even when no present providers
satisfy it. Optional token constraints reject incompatible present services while
permitting absence; do not treat every token-tagged member as required.

- [ ] **Step 3: Exercise fallback and all retained constraints.**

```sh
flock -x /tmp/di-bag-compiler-heavy.lock bun test tests/types.test.ts --test-name-pattern 'module|incremental|contribution|lifetime|alias|replacement|builder views'
flock -x /tmp/di-bag-compiler-heavy.lock bun test tests/incremental-scale.test.ts tests/type-scale.test.ts tests/token-scale.test.ts --timeout 120000
flock -x /tmp/di-bag-compiler-heavy.lock npm run check:native
```

Keep complete negative corpus coverage (the final audit is unfiltered). Inspect
named rename collisions, private/export same-name requirements, all/optional token
collections, lexical root captive constraints and mixed contribution groups.
Extend new fixtures with imported existing producer exports where a retained
contract is otherwise absent; never copy an erased substitute provider.

- [ ] **Step 4: Measure modules and isolate any remaining 1000-depth failure.**

Run selected classic/native 500 modules valid/missing/invariant and 1000 modules
valid, then 1000 bindings valid. Use exact source and bounds. In owned scratch
only, compare expression-prefix stages before end, after end, and after resolve;
include a non-generic 1000-call same-expression control to distinguish compiler
syntax depth. Label these as diagnostic controls, and retain full original
expression as acceptance.

If neither projection nor install optimization reaches the unchanged bound,
write a decision record in this plan's evidence report defining whether a sealed
index state or verified compiler migration is necessary. A cache amendment must
specify its invariant carrier and prove mismatched explicit generic/ReturnType
views impossible before implementation; this plan does not authorize an unproved
extra generic. Keep failing rows open and preserve the successful smaller changes.

- [ ] **Step 5: Review and checkpoint adopted installation changes.**

Run locked classic typecheck/build and `git diff --check`. Commit only the adopted
helper, install operand and fixtures with
`git commit -m "perf(types): check module installation relationships incrementally"`.
Review the full fallback categories and replacement retention, not only the
generated chain that became faster.

## Task 4: Physical declarations, original matrices and final redundant proof

**Files:** Modify `tests/types.test.ts`, `tests/box-contract-fixtures.ts`,
`tests/native-package.test.ts`, `tests/token-package.test.ts`;
create `tests/types/incremental-modules-consumer.ts`;
create `docs/reports/2026-09-08-compiler-scalability.md`;
modify `docs/benchmarks/typescript.md` and enterprise program tracker.
**Interfaces:** Reuse existing `boxContractFixtures/boxContractSource` routing,
physical producer emission/deletion machinery, `runCompilerCase`, and original
full-report commands. No public production export is predetermined.

- [ ] **Step 1: Add declaration-only consumer RED before fixture routing.**

```ts
import { result, token, tokenGraph } from './incremental-modules';
import type { Assert, Equal } from './assert';
const resolved = tokenGraph.resolve(token);
type Exact = [Assert<Equal<typeof result, number>>, Assert<Equal<typeof resolved, number>>];
```

Add `incremental-modules.ts` and its negative fixture to
`boxContractFixtures`; route the feature/consumer through the existing physical
producer lists in native-package/token-package tests. Assert the producer source
does not exist and the actual declaration does exist before downstream checking.
In native-package, add `incremental-modules` to the feature list, the
`emitter === 'classic6'` producer-emission branch, and the downstream import
rewrite expression. The classic archive case must actually use classic feature
emission; adding only a feature-list entry would silently take the native branch.
Include `builder-views.ts`, `negative/builder-views.ts`,
`replacement-supported.ts`, `negative/replacement-views.ts` in installed routes
if absent. Exported inferred builders must emit without weaker annotations.

A missing routing/source-deletion assertion is valid harness RED. Any actual
declaration naming failure requires a minimal source/emitted reproducer before a
root type export or API change; never suppress it with skipLibCheck or casts.

- [ ] **Step 2: Run physical archive and source GREEN.**

```sh
flock -x /tmp/di-bag-compiler-heavy.lock bun test tests/types.test.ts --timeout 120000
flock -x /tmp/di-bag-compiler-heavy.lock bun test tests/package.test.ts tests/box-package.test.ts tests/token-package.test.ts --timeout 120000
flock -x /tmp/di-bag-compiler-heavy.lock bun test tests/native-package.test.ts --timeout 120000 --verbose
```

Both classic/native emitters, .cts/.mts consumers and .d.cts/.d.mts downstream
routes must run, with both downstream compilers. Preserve real box frames, modern
inline inference, metadata/acquired types, utility/reflection contracts, shared
token brands, and Node/Bun CJS/ESM runtime smoke tests.

- [ ] **Step 3: Freeze final combined source and collect all 108 original rows.**

Complete companion diagnostic source changes first or explicitly record their
remaining two matrix failures. Run these commands serially:

```sh
flock -x /tmp/di-bag-compiler-heavy.lock npm run benchmark:types
flock -x /tmp/di-bag-compiler-heavy.lock npm run benchmark:types -- --tokens
flock -x /tmp/di-bag-compiler-heavy.lock npm run benchmark:types -- --native
flock -x /tmp/di-bag-compiler-heavy.lock npm run benchmark:types -- --native --tokens
```

Preserve all raw rows and final summaries in new plan evidence. Check exact
36/18/36/18 identities, no duplicates/missing rows, source/generated hashes,
compiler identities and acceptance using `acceptDiagnostics`. Collector exit 0
does not make failure rows pass. If sources change after this freeze, record the
affected evidence as pre-change and rerun affected rows with an explicit mapping.
Do not relabel historical native rows from cc9dbdc.

- [ ] **Step 4: Run redundant final integration and examples.**

```sh
flock -x /tmp/di-bag-compiler-heavy.lock npm run check
flock -x /tmp/di-bag-compiler-heavy.lock npm run typecheck:native
flock -x /tmp/di-bag-compiler-heavy.lock npm run build:native
flock -x /tmp/di-bag-compiler-heavy.lock npm run check:native
flock -x /tmp/di-bag-compiler-heavy.lock bun test tests/compiler-case.test.ts tests/incremental-scale.test.ts tests/native-compiler.test.ts --timeout 120000
git diff --check
```

Run the nine current runnable examples individually, recording path/status/output:

```sh
bun run examples/wbs-scope.ts
bun run examples/modules.ts
bun run examples/box-adapters.ts
bun run examples/tokens.ts
bun run examples/scopes.ts
bun run examples/composition.ts
bun run examples/contributions.ts
bun run examples/observers.ts
bun run examples/plugins.ts
```

Do not invent runtime coverage from a CI file.

- [ ] **Step 5: Publish local evidence and obtain independent covering review.**

The report must state current compiler identities, source hashes, RED/GREEN
commands, original outcome counts, unresolved rows, utility and physical package
proof, fixed ceilings, limits and three-repeat median/range for selected valid
100/500 controls. Append benchmark tables; preserve all historical tables.
Mark T2 incomplete if any required original case or diagnostic parity remains.
Commit the scoped package/tests/report changes after checks, then independently
rerun covering utility, work, selected-original-boundary and physical package
tests on that committed source. No push/publication occurs in this plan.

## Self-review checklist

- [ ] Every original form/count/scenario appears in the four final matrices.
- [ ] Semantic guards, performance RED and historical evidence are labelled separately.
- [ ] Reflection, explicit generics and equivalent-history positives survive both emitters.
- [ ] Full fallback retains contribution/all/opaque/lifetime and private C obligations.
- [ ] No new ceiling, gap allowance, stack flag, producer annotation or source substitution slipped in.
- [ ] All heavy gates share the outer lock, and measurements identify actual source bytes.
- [ ] Failed feasibility produces an explicit unresolved obligation rather than a completion claim.
