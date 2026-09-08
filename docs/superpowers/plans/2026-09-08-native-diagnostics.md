# Native Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover all 27 useful native replacement messages while preserving direct-call inference, standard utility-type soundness and physical package contracts.

**Architecture:** Add a strict replacement audit independent of the existing gap fallback. Investigate a factored general replacement overload whose result retains accepted history for reflected generic domains, while retaining the precise first named overload. Adopt only after both compiler lanes pass reflection, inference, diagnostic and package gates.

**Tech Stack:** TypeScript 6.0.3 classic API/wrapper 6.0.2, TypeScript 7.0.2 native CLI, Node/Bun, strict NodeNext, actual classic/native archives, Linux supervised compiler processes and flock.

**Spec:** `docs/superpowers/specs/2026-09-08-native-diagnostics-design.md`; companion `docs/superpowers/specs/2026-09-08-compiler-scalability-design.md`.

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

## Execution boundary and task ownership

Read the enterprise tracker, modern-compiler diagnostic addendum and both new
specifications before execution. This is a new scoped signature experiment; it
does not reopen or claim success for the rejected historical overload candidates.
Use current HEAD in the existing approved checkout and preserve unrelated edits.
No implementation occurs merely by authoring this plan.

Task 1 owns audit/reflection oracles; Task 2 owns replacement helpers/signatures
only after feasibility; Task 3 owns installed/declaration routing; Task 4 owns
final proof and reporting. The scale plan owns graph-checker implementations and
canonical 108-row collection. Serialize shared `src/di-bag.ts` changes and
compile against the combined current source, never a stale copied signature.

Use `flock -x /tmp/di-bag-compiler-heavy.lock` around every compiler-heavy parent
command, including full tests/packages; do not recursively lock child compilers.
Each native compiler remains under `compileNative` supervision. Scratch
experiments use owned paths under `/tmp`, immutable baseline source snapshots and
explicit recorded deltas. Put retained evidence in
`.superpowers/sdd/2026-09-08-native-diagnostics/`.

## Task 1: Strict native audit and reflection oracle

**Files:**

- Create: `scripts/replacement-diagnostics.ts`, `scripts/check-replacement-diagnostics.ts`.
- Create: `tests/native-replacement-diagnostics.test.ts`.
- Create: `tests/types/replacement-reflection.ts`, `tests/types/negative/replacement-reflection.ts`.
- Modify: `tests/types.test.ts` for positive routing.
- Reuse unchanged: `tests/diagnostic-markers.ts`, `tests/native-diagnostic-markers.ts`, `scripts/native-compiler.ts`.

**Interfaces:** Export `replacementDiagnosticFixtures` (the fixed ten relative
fixture paths), `evaluateReplacementDiagnostics(source, file, diagnostics, checked)`,
and `auditReplacementDiagnostics(root: string)`. Evaluation returns the strict
matcher result plus `accepted`; audit returns rows and
`{accepted, missingPrimary, primaryExpected, primaryMatched, supplementalExpected, supplementalMatched, unexpected}`.
The CLI prints JSON audit evidence and exits 1 unless accepted. No native fallback
is consulted and the fixture inventory does not shrink when gap comments vanish.

- [x] **Step 1: Write strict-oracle RED and mutation tests.**

```ts
import { expect, test } from 'bun:test';
import { evaluateReplacementDiagnostics } from '../scripts/replacement-diagnostics';
test('strict replacement audit requires useful primary text at its own region', () => {
  const source = '// diagnostic: a dependency has the wrong shape\nreplace();';
  const error = { file: '/fixture.ts', line: 2, column: 1, code: 2345,
    message: 'a dependency has the wrong shape' };
  expect(evaluateReplacementDiagnostics(source, '/fixture.ts', [error], true).accepted).toBe(true);
  for (const errors of [
    [], [{ ...error, file: '/other.ts' }], [{ ...error, code: 2589 }],
    [{ ...error, message: 'No overload matches this call. The last overload gave the following error.' }],
    [error, { ...error, message: 'unrelated diagnostic' }],
  ]) expect(evaluateReplacementDiagnostics(source, '/fixture.ts', errors, true).accepted).toBe(false);
  expect(evaluateReplacementDiagnostics(source, '/fixture.ts', [error], false).accepted).toBe(false);
  const separated = source + '\n// diagnostic: missing factories\nend();';
  expect(evaluateReplacementDiagnostics(separated, '/fixture.ts', [{ ...error, line: 4 }], true).accepted).toBe(false);
});
```

Run `bun test tests/native-replacement-diagnostics.test.ts`; expect missing-helper
RED. Add a supplemental-marker case requiring its exact TS code and text; removing
it must fail even if the useful primary matches. Existing gap-matcher mutation
tests remain unchanged as historical guardrails.

- [x] **Step 2: Implement the strict evaluator and fixed inventory.**

```ts
import { matchDiagnosticMarkers, type Diagnostic } from '../tests/diagnostic-markers.ts';
export const replacementDiagnosticFixtures = [
  'negative/incremental.ts',
  'negative/inline-replacement-wrong-shape.ts',
  'negative/module-hidden-private-needs.ts',
  'negative/module-narrowing.ts',
  'negative/module-rename.ts',
  'negative/provider-boundaries.ts',
  'negative/replacement-context.ts',
  'negative/replacement-wrong-shape.ts',
  'negative/required-this.ts',
  'negative/union-replace.ts',
] as const;
export function evaluateReplacementDiagnostics(
  source: string, file: string, diagnostics: readonly Diagnostic[], checked: boolean,
) {
  const result = matchDiagnosticMarkers(source, file, diagnostics);
  return { ...result, accepted: checked && result.missing.length === 0
    && result.unexpected.length === 0 };
}
```

Implement audit with `mkdtempSync(join(tmpdir(),'di-bag-replacement-audit-'))`,
`resolveNative(root)`, and a serial `for...of` over the fixed list. Resolve each
file under `tests/types`, read unchanged source, call
`compileNative(compiler,directory,[file],{skipLibCheck:true})`, evaluate strict
markers and retain process evidence whenever `checked` is false. Sum primary
and supplemental counts independently; `missingPrimary` counts only missing
non-supplemental markers. Always delete only the owned scratch directory in
`finally`. Use `ReturnType<typeof evaluateReplacementDiagnostics>` for row
typing; do not widen diagnostics to any.

CLI:

```ts
import { auditReplacementDiagnostics } from './replacement-diagnostics.ts';
auditReplacementDiagnostics(process.cwd()).then(result => {
  console.log(JSON.stringify(result));
  if (!result.accepted) process.exitCode = 1;
}).catch(error => { console.error(error); process.exitCode = 1; });
```

- [x] **Step 3: Add reflection source controls and prove the baseline.**

Positive producer:

```ts
import { DiBag } from '../../src';
import type { Assert, Equal } from './assert';
export const builder = DiBag.begin().add({
  value: () => 1, consumer: ({ value }: { value: number }) => value + 1,
});
export const moduleBuilder = DiBag.module().add({
  value: () => 1, consumer: ({ value }: { value: number }) => value + 1,
});
type IsAny<T> = 0 extends (1 & T) ? true : false;
type FunctionMatch = typeof builder.replace extends (...args: any) => infer R
  ? { matched: true; result: R } : { matched: false };
type Utilities = [
  Assert<Equal<FunctionMatch['matched'], true>>,
  Assert<Equal<IsAny<ReturnType<typeof builder.replace>>, false>>,
  Assert<Equal<IsAny<ReturnType<typeof moduleBuilder.replace>>, false>>,
];
export type ModuleView = ReturnType<typeof moduleBuilder.replace>;
export const moduleView: ModuleView = moduleBuilder;
export const feature = moduleView.exports(['value', 'consumer']);
export const result = DiBag.begin().install(feature).end().resolve('consumer');
type Exact = Assert<Equal<typeof result, number>>;
export const forward = (factory: () => number) => builder.replace('value', factory);
type Forward = Assert<Equal<Parameters<typeof forward>, [factory: () => number]>>;
```

Negative fixture:

```ts
import { DiBag } from '../../../src';
const builder = DiBag.begin().add({
  value: () => 1, consumer: ({ value }: { value: number }) => value + 1,
});
type View = ReturnType<typeof builder.replace>;
// diagnostic: is not assignable to type
const view: View = builder;
const empty = DiBag.begin();
const erasedAdd = empty.add<{ value: () => number; consumer: () => number }>;
// diagnostic: is not assignable to type
const erased: ReturnType<typeof erasedAdd> = builder;
const moduleBuilder = DiBag.module().add({
  value: () => 1, consumer: ({ value }: { value: number }) => value + 1,
});
const moduleView: ReturnType<typeof moduleBuilder.replace> = moduleBuilder;
const value = DiBag.begin().install(moduleView.exports(['consumer'])).end().resolve('consumer');
// diagnostic: Type 'number' is not assignable to type 'string'.
const wrong: string = value;
```

Add one positive source test using `diagnostics(resolve(__dirname,
'types/replacement-reflection.ts'))` and zero diagnostics. The negative fixture
is discovered by the current negative-file loop. These should pass baseline;
they are strengthened soundness controls. The historical combined-overload
scratch candidate must fail FunctionMatch/non-any and erase the root assignment
diagnostic, reproducing real unsafe RED before any new candidate is assessed.

- [x] **Step 4: Run audit GREEN as an evidence collector, keeping parity RED explicit.**

```sh
flock -x /tmp/di-bag-compiler-heavy.lock bun test tests/native-replacement-diagnostics.test.ts tests/native-diagnostic-markers.test.ts tests/diagnostic-markers.test.ts
flock -x /tmp/di-bag-compiler-heavy.lock bun test tests/types.test.ts --test-name-pattern 'replacement|builder views'
flock -x /tmp/di-bag-compiler-heavy.lock node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-replacement-diagnostics.ts
```

The first two commands pass. The strict CLI is expected to exit 1 with 27 missing
useful primary messages on the unchanged known baseline. Capture actual inventory
and process evidence; if current source differs, record actual counts rather
than forcing 27. A native process/configuration failure is not diagnostic RED.

- [x] **Step 5: Checkpoint the green audit tooling and guard fixtures.**

Run locked classic typecheck, then `git diff --check`; commit scoped files with
`git commit -m "test: add strict native replacement diagnostic oracle"`.
Review fixed inventory, process supervision and utility attacks. The report
collector is complete; native diagnostic parity is still open.

## Task 2: Bounded result-normalization experiment and checked adoption

**Files:** Create `src/replacement-types.ts` only after scratch feasibility;
modify `src/di-bag.ts`, `src/module.ts`; retain/extend Task 1 fixtures.
The ten original negative files may lose only individually stale gap comments.
**Interfaces:** `ReplacementAdmission<R,K>`,
`BuilderReplacementRegistration<E,C,K,V>`,
`ModuleReplacementRegistration<E,C,K,V>`, `ReplacedEntries<E,K,V>`.
All are internal named type aliases; no root export or runtime implementation
change is assumed.

- [x] **Step 1: Write the real parity RED gate and freeze candidate controls.**

Add a test in `tests/native-replacement-diagnostics.test.ts` calling
`auditReplacementDiagnostics(process.cwd())`, requiring accepted true,
missingPrimary 0, unexpected 0 and equal primary/supplemental expected/matched.
Give it 120000 ms and run under the outer lock. It must fail for the current
27 missing useful messages before source edits.

Save original `src` text plus unchanged ten fixtures and utility/inference
controls in an owned scratch copy. Use the same strict options and actual native
CLI; preserve relative layout. Include `replacement-supported.ts`,
`replacement-context.ts`, `incremental.ts`, `tokens.ts`,
`modern-inline.ts`, `builder-views.ts`, `negative/replacement-views.ts`
and their needed imports. No weakened fixture bodies.

- [x] **Step 2: Implement the single causal candidate in scratch.**

The candidate helper contents are:

```ts
import type { Registration, Registrations } from './registration';
import type { Entry, From, Merge, Checked, IncrementalChecked, ReplacementKey } from './types';
import type { NeedConstraint, CheckedConstraints } from './module-types';
import type { ContributionConstraint, CheckedContributions } from './contribution-types';
import type { TokenBase, TokenKey } from './tokens';
import type { Binding, BindingOutput, TokenMember } from './token-types';

export type ReplacementAdmission<R extends Registrations, K extends string | TokenBase> =
  [K] extends [string] ? ReplacementKey<R, K> : TokenMember<R, K>;

export type BuilderReplacementRegistration<
  E extends Entry, C extends NeedConstraint, K extends string | TokenBase, V extends Registration,
> = [K] extends [string]
  ? IncrementalChecked<E, Record<K, NoInfer<V>>> &
    CheckedConstraints<C, Merge<From<E>, Record<K, NoInfer<V>>>>
  : [K] extends [TokenBase]
    ? BindingOutput<NoInfer<K>, NoInfer<V>> &
      IncrementalChecked<E, Record<TokenKey<K>, Binding<NoInfer<K>, NoInfer<V>>>> &
      CheckedConstraints<C, Merge<From<E>, Record<TokenKey<K>, Binding<NoInfer<K>, NoInfer<V>>>>>
    : never;

export type ModuleReplacementRegistration<
  E extends Entry, C extends ContributionConstraint, K extends string | TokenBase, V extends Registration,
> = [K] extends [string]
  ? Checked<Merge<From<E>, Record<K, NoInfer<V>>>> &
    CheckedContributions<C, Merge<From<E>, Record<K, NoInfer<V>>>>
  : [K] extends [TokenBase]
    ? BindingOutput<NoInfer<K>, NoInfer<V>> &
      Checked<Merge<From<E>, Record<TokenKey<K>, Binding<NoInfer<K>, NoInfer<V>>>>> &
      CheckedContributions<C, Merge<From<E>, Record<TokenKey<K>, Binding<NoInfer<K>, NoInfer<V>>>>>
    : never;

type ReflectedEntry = { key: never; registration: Binding<TokenBase, Registration> };
export type ReplacedEntries<
  E extends Entry, K extends string | TokenBase, V extends Registration,
> = [K] extends [string] ? Exclude<E, { key: K }> | { key: K; registration: V }
  : [K] extends [TokenBase]
    ? Exclude<E, { key: TokenKey<K> }> | { key: TokenKey<K>; registration: Binding<K, V> }
    : E | ReflectedEntry;
```

Retain the exact precise first named overload in each builder. Replace only the
general named/token pair with:

```ts
replace<const K extends string | TokenBase, V extends Registration>(
  key: K & NoInfer<ReplacementAdmission<From<E>, K>>,
  registration: V & Registration & BuilderReplacementRegistration<E, C, NoInfer<K>, V>,
): Builder<ReplacedEntries<E, K, V>, C>;
```

In ModuleBuilder use `ModuleReplacementRegistration` and return
`ModuleBuilder<ReplacedEntries<E,K,V>,C>`. Keep runtime bodies, first-overload
context, invariant witnesses and method generic argument order. The fallback
entry is a reflected-type representation only; it must not admit a broad key.

- [x] **Step 3: Run the smallest soundness gate before a full corpus.**

Compile Task 1 positive/negative reflection controls on both compilers and assert
the exact expected locations/messages. Compile implicit/explicit token and named
replacement positives from `replacement-supported.ts`; keep exact required,
optional/default-argument and method-return cases from `replacement-context.ts`.
Explicit invalid `unknown` V generics in existing negatives must reject.

Inspect the inferred FunctionMatch, ReturnType and Parameters values, not only
whether a program exits without errors. If reflection is still any or implicit
token inference fails, this candidate is rejected immediately. Do not run package
or matrix work after this failure.

Only one equivalent result factoring may follow: define
`type ReplacementState<E,K,V> = { readonly entries: ReplacedEntries<E,K,V> }`
and return the same builder with `ReplacementState<E,K,V>['entries']`.
Keep admission/validation identical so the comparison answers whether named
state indexing changes the failed match. No further fallback overloads, any
inputs, union-erasing state, or arbitrary NoInfer variations are allowed.

- [x] **Step 4: If feasible, prove all source messages before production adoption.**

Run the strict audit and complete classic/native source fixture corpus against
scratch. Required domains include name unions, widened/template/unknown names;
mixed string/token selections; broad TokenBase, union token handles, same-symbol
incompatible services; required-this factories; opaque G/bound contracts; both
relationship directions; installed/renamed private constraints; optional vs
explicit undefined; plain/owned/provider unions and module contributions.

All useful primary messages must match, supplements remain exact, and there may
be no new token-message loss. A NoInfer alias hiding singleton-key text fails the
gate just as in the historical experiment. Both work ceilings and grouped1000
controls must pass before adopting scratch production text.

If neither factoring passes, revert only candidate changes, keep the strict
oracle and RED evidence, and write the minimal FunctionMatch counterexample plus
the explicit method-split/upstream alternatives into the new report. Remove the
unimplemented parity-success test from ordinary passing suites by keeping it as
the explicit failing CLI/report gate; do not turn its failure into an allowance.
Native parity stays open. A public method split or compiler migration requires a
new design amendment, not another undocumented candidate.

- [x] **Step 5: Adopt only proved source and remove individually stale gaps.**

Copy the passing helper/signature delta to current production, incorporating
current scale-checker helpers and C constraints. Remove gap comments only where
the unchanged original useful marker now matches. Keep primary/supplemental
comments and invalid programs unchanged. Retain historical fingerprint unit tests
even after production inventory reaches zero.

```sh
flock -x /tmp/di-bag-compiler-heavy.lock bun test tests/native-replacement-diagnostics.test.ts tests/types.test.ts --timeout 120000
flock -x /tmp/di-bag-compiler-heavy.lock npm run check:native
flock -x /tmp/di-bag-compiler-heavy.lock bun test tests/incremental-scale.test.ts tests/type-scale.test.ts tests/token-scale.test.ts --timeout 120000
```

Expect strict parity, unchanged exact inference/utility tests, zero unexpected
diagnostics and fixed ceilings. Run classic/native builds and `git diff --check`.
Commit scoped helper/signature/fixture changes with
`git commit -m "fix(types): preserve replacement diagnostics and reflected history"`
only on full GREEN. Review utility safety and preserved module contribution C.

Task 2 outcome: both permitted factorizations passed the focused classic/native
utility, reflection, inference and history controls, but each stopped at 94/95
strict native primary messages because `negative/union-replace.ts` line 8 kept
the singleton-key text hidden behind `NoInfer<InvalidReplacement<...>>`. The
adoption guard therefore left production signatures, fixtures and all 27 gap
fingerprints unchanged. Replayable patches, raw rows, hashes and the minimized
FunctionMatch reproduction are retained in
`.superpowers/sdd/2026-09-08-native-diagnostics/task-2-report.md`.

## Task 3: Full physical replacement diagnostic and utility proof

**Files:** Modify `tests/box-contract-fixtures.ts`, `tests/box-package.test.ts`,
`tests/native-package.test.ts`, `tests/token-package.test.ts`;
create `tests/types/replacement-reflection-consumer.ts`;
reuse the ten original negatives and `tests/types/modules/feature.ts`.
**Interfaces:** Fixed audit inventory feeds installed-fixture coverage; existing
`boxContractSource` must route source imports to actual installed declarations.
Physical producer feature name is `replacement-reflection` in both emitter lanes.

- [x] **Step 1: Write downstream-only exact checks and missing-routing RED.**

```ts
import { builder, moduleBuilder, result, forward } from './replacement-reflection';
import type { Assert, Equal } from './assert';
type IsAny<T> = 0 extends (1 & T) ? true : false;
type Exact = [
  Assert<Equal<typeof result, number>>,
  Assert<Equal<IsAny<ReturnType<typeof builder.replace>>, false>>,
  Assert<Equal<IsAny<ReturnType<typeof moduleBuilder.replace>>, false>>,
  Assert<Equal<Parameters<typeof forward>, [factory: () => number]>>,
];
```

Before routing, assert the installed feature .d.cts/.d.mts exists and producer
source is absent; capture the missing artifact/routing RED. Source fixture
success alone is insufficient.

- [x] **Step 2: Route all ten original negative programs without changing bodies.**

Append the ten fixed inventory files to `boxContractFixtures` only if absent,
plus `replacement-reflection.ts`, `negative/replacement-reflection.ts` and
`replacement-context.ts`. Existing `negative/incremental.ts` is already present.
Preserve every diagnostic marker and line by changing import specifiers only.

Two concrete routing additions are required:

```ts
.replace(/from '(?:\.\.\/)+src\/di-bag'/g, "from 'di-bag'")
.replace("from '../modules/feature'", "from './replacement-module-feature.js'")
```

The replacement-wrong-shape fixture imports internal source di-bag; its installed
counterpart uses the public root. Before checking module-narrowing, physically
write `replacement-module-feature.ts` into the consumer directory using unchanged
`tests/types/modules/feature.ts` with its source-root import routed to `di-bag`.
The `.js` import resolves that `.ts` support file in both NodeNext modes.
Require zero diagnostics in the support module; never inline a weaker module
object into the invalid fixture.

Add the same dependency setup in classic box-package and native-package loops.
Keep unrelated type-internal routing exactly as currently supported. Assert each
negative's diagnostics belong to its actual consumer path/region, with no TS2589.

- [x] **Step 3: Add both emitter branches and source-deletion consumer routing.**

Add `replacement-reflection` to native-package feature inventory AND its
`emitter === 'classic6'` classic-emission selection, so the classic-emitter
case cannot silently use native producer emission. Add the feature name to the
downstream import rewrite expression. Add the equivalent classic physical route
in token-package tests. Use existing `existsSync`, owned source-directory removal
and `Program.getSourceFile` assertions to prove the producer is unavailable and
the expected declaration is loaded.

Replace the native-package hardcoded four-gap expectation only after Task 2
actually closes those incremental gaps:

```ts
expect({ fixture, knownNativeRejections: markers.knownNativeRejections })
  .toEqual({ fixture, knownNativeRejections: 0 });
```

If feasibility failed, leave that expectation at its baseline exact four and
do not claim the parity package task complete. No new fixture gap allowances.

- [ ] **Step 4: Run installed/emitted GREEN and checkpoint.**

```sh
flock -x /tmp/di-bag-compiler-heavy.lock bun test tests/box-package.test.ts --timeout 120000
flock -x /tmp/di-bag-compiler-heavy.lock bun test tests/token-package.test.ts --timeout 120000
flock -x /tmp/di-bag-compiler-heavy.lock bun test tests/native-package.test.ts --timeout 120000 --verbose
flock -x /tmp/di-bag-compiler-heavy.lock bun test tests/package.test.ts --timeout 120000
```

Both actual library emitters, .cts/.mts source checks, physical .d.cts/.d.mts
feature declarations and both downstream compilers must retain exact utilities,
module numeric output and every original useful negative message. Preserve the
existing Node/Bun CJS/ESM runtime tests, real boxes and core-without-boxes route.
No public type export may be added merely to silence TS4023: first capture the
nameability RED and make a justified export decision. Run diff/typecheck and
commit `test: verify replacement parity through physical package declarations`.

Task 3 package proof is implemented at the Task 2 no-adoption source. Both
emitters and both downstream module formats retain the exact utility contracts,
and all ten fixed negative programs now traverse installed declarations. The
package gates accept only the pre-existing per-fixture native fingerprints,
which total 27. Step 4 remains incomplete because native useful-message parity
did not recover; detailed RED/GREEN evidence is retained in
`.superpowers/sdd/2026-09-08-native-diagnostics/task-3-report.md`.

## Task 4: Work/scale/native/full verification and honest closure

**Files:** Create `docs/reports/2026-09-08-native-diagnostics.md`;
modify enterprise tracker and `docs/benchmarks/typescript.md` only for new proved
outcomes. Reuse `scripts/check-replacement-diagnostics.ts` and the scale plan's
`scripts/check-compiler-case.ts`.
**Interfaces:** Canonical scale evidence is 36 named + 18 token cases for each
compiler at final stable combined source. The scale plan owns collection; this
task independently verifies relevant identities/boundaries and source hashes.

- [ ] **Step 1: Prove the exact original message-related matrix failures are fixed.**

After the selected-case runner exists, execute:

```sh
flock -x /tmp/di-bag-compiler-heavy.lock node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-compiler-case.ts native 100 replacement wrong-shape
flock -x /tmp/di-bag-compiler-heavy.lock node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-compiler-case.ts native 500 replacement wrong-shape
flock -x /tmp/di-bag-compiler-heavy.lock node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-compiler-case.ts classic 100 replacement wrong-shape
flock -x /tmp/di-bag-compiler-heavy.lock node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-compiler-case.ts classic 500 replacement wrong-shape
```

Each requires its original useful message at generated line 152 or 752, no
TS2589/unrelated-file diagnostic, and clean supervised completion. If the scale
runner is not yet implemented, use existing `nativeScale` through a bounded test
in `tests/native-replacement-diagnostics.test.ts`; the exact interface is
`await nativeScale(process.cwd(), await resolveNative(process.cwd()),
{count:100,form:'replacement',scenario:'wrong-shape'})`, then repeat count 500.
Do not invoke an unsupported CLI flag or standalone unsupervised classic worker.

- [ ] **Step 2: Run all source/utility/work/native regression gates.**

```sh
flock -x /tmp/di-bag-compiler-heavy.lock node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-replacement-diagnostics.ts
flock -x /tmp/di-bag-compiler-heavy.lock bun test tests/types.test.ts tests/incremental-scale.test.ts tests/native-diagnostic-markers.test.ts --timeout 120000
flock -x /tmp/di-bag-compiler-heavy.lock npm run check:native
flock -x /tmp/di-bag-compiler-heavy.lock npm run typecheck:native
flock -x /tmp/di-bag-compiler-heavy.lock npm run build:native
```

Useful primaries and exact supplements are separately reported; zero gap inventory
must correspond to unchanged expression coverage. Check that source inventory
did not silently lose a file when comments disappeared.

- [ ] **Step 3: Consume or collect the complete original matrix, serially.**

If the scale plan already collected final-source rows after these signatures,
verify their hashes and exact 36/18/36/18 identities rather than rerun them.
Otherwise run these existing commands under the lock, retaining each entire log:

```sh
flock -x /tmp/di-bag-compiler-heavy.lock npm run benchmark:types
flock -x /tmp/di-bag-compiler-heavy.lock npm run benchmark:types -- --tokens
flock -x /tmp/di-bag-compiler-heavy.lock npm run benchmark:types -- --native
flock -x /tmp/di-bag-compiler-heavy.lock npm run benchmark:types -- --native --tokens
```

The original remaining time/memory/depth failures remain failures even if all 27
messages are repaired. Collector exit status, source-gap fingerprints or an
intended error accompanied by TS2589 do not grant row acceptance. No concurrency
with package or source runs.

- [ ] **Step 4: Run redundant integration, archives and all examples.**

```sh
flock -x /tmp/di-bag-compiler-heavy.lock npm run check
flock -x /tmp/di-bag-compiler-heavy.lock bun test tests/native-package.test.ts --timeout 120000 --verbose
flock -x /tmp/di-bag-compiler-heavy.lock node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-replacement-diagnostics.ts
bun run examples/wbs-scope.ts
bun run examples/modules.ts
bun run examples/box-adapters.ts
bun run examples/tokens.ts
bun run examples/scopes.ts
bun run examples/composition.ts
bun run examples/contributions.ts
bun run examples/observers.ts
bun run examples/plugins.ts
git diff --check
```

The user prefers redundant testing: this full check follows focused and physical
proof deliberately. Preserve actual command outputs and assertions; no compiler
heavy process overlaps any other. Later repetition needs a new delta/failure or
an independent committed-state verification reason.

- [ ] **Step 5: Record exact outcomes and obtain independent final review.**

Report original27/current useful counts, supplements, package emitter/module
routes, ReturnType FunctionMatch and cast-free assignment evidence, original
100/500 replacement boundaries, unchanged ceilings and all unresolved scale rows.
Retain the old gap fingerprints and historical report unchanged. Update tracker
native parity only if zero gaps and all package/source invariants pass; do not
mark enterprise T2 complete while scale failures remain.

Run one independent committed-state covering check of reflection, strict audit,
work ceilings and physical package declarations after the final scoped commit.
If feasibility failed, the final report must say which candidate failed and
which exact invariant stopped adoption, preserve the original production
signatures/allowances, and identify the required migration/upstream decision.
Do not label that outcome diagnostic parity or leave an ordinary suite falsely
green by removing required negative expressions.

## Self-review checklist

- [ ] Fixed ten-file inventory still covers all 27 original expressions after comment removal.
- [ ] Both direct-call and standard utility/reflection contracts pass on both compilers.
- [ ] Root erased view rejects and safe module reflected view still yields exact numbers.
- [ ] Module replacement retains contribution C and full registration validation.
- [ ] All ten installed negative fixtures resolve real archive declarations, including module support source.
- [ ] Classic feature emitter branch actually uses classic emission; producer source is absent downstream.
- [ ] Native source/package gaps are removed only after useful-marker proof, without new allowances.
- [ ] Original matrix syntax/boundaries and fixed work/resource ceilings remain intact.
- [ ] Failed candidate feasibility remains an open program obligation with concrete evidence.
