# Modern Compiler Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver supported exact inline inference on the classic modern compiler and independently verify native compiler package/source/scale contracts.

**Architecture:** Official side-by-side development aliases retain the classic compiler API while adding the native CLI. No library signature or runtime changes. Physical native projects and supervised processes produce independent evidence. Ruling7 explicitly separates native rejection checks from its27 known overload-message limitations; classic diagnostics and matrix acceptance remain strict.

**Tech Stack:** Node 24.20.0, Bun 1.4.0, classic TypeScript 6.0.3 through compatibility wrapper 6.0.2, native TypeScript 7.0.2, npm lockfile and real local box archives.

**Spec:** `docs/superpowers/specs/2026-09-07-modern-compilers-design.md`.

## Global Constraints

- No required decorators, reflect-metadata, parameter-name parsing, custom compiler transforms, or dynamic code generation.
- Plain functions, classes through adapters, promises, and ordinary service values remain supported.
- Preserve exact synchronous versus Promise-valued service types; never silently await an ordinary factory dependency.
- Preserve `DiBag.withDisposal` and explicit owned-versus-borrowed intent; method names alone never transfer ownership.
- Sharing is configurable and explicit; sharing an instance also shares its already-bound dependencies.
- Application startup closes resources it owns and initiates closure of bags it created; factories clean partial acquisitions before returning ownership.
- Justified public API changes are authorized; document migration and retain supported inference cases in regression tests.
- Test production behavior and compile-time contracts, including negative fixtures; record failing evidence before implementation.
- No publication, remote push, or credential storage without a separate explicit request; prepare local commits, package artifacts, and publishing instructions.
- Do not describe casts, unchecked JavaScript, or dynamically unknown plugins as compile-time proofs.

Use the existing approved checkout `/home/df/wd/personal/di-bag`, branch `feat/v0.1`.
Controller separately handles authorized non-force feature-branch pushes. Workers
must not push, publish, merge, delete workspaces, store credentials or spawn agents.
Actual compiler/package/git writes require approved execution; use `login:false`.
Restricted empty-output status0 is not evidence. Use apply_patch for file edits.

## File ownership and task interfaces

- Task1: toolchain manifest/lock/config; existing compiler/package runners;
  modern inline source/consumer/negative fixtures; migration and evidence.
- Task2: native execution/parser/project helpers; native source/package tests;
  existing benchmark parent plus extracted evaluator and direct tests; native
  manifest/scripts and current scale evidence. It consumes Task1's exact fixture
  text and official classic aliases, not a separate copy of the library.
- No production `src` changes are planned. Report real declaration portability
  failures before adding any type export or annotation. Empty-fork performance
  remains assigned to the later runtime/lifecycle increment.

### Task 1: Adopt the classic modern compiler and prove exact inline inference

**Files:** Modify `package.json`, `package-lock.json`, `tsconfig.json`,
`tests/compiler.ts`, `tests/incremental-scale.test.ts`, `tests/types.test.ts`,
`tests/package.test.ts`, `tests/box-package.test.ts`, `tests/token-package.test.ts`,
`README.md`, `docs/migrations/0.1-to-enterprise.md`; create
`tests/types/modern-inline.ts`, `tests/types/modern-inline-consumer.ts`,
`tests/types/negative/modern-inline.ts`,
`docs/reports/2026-09-07-modern-compilers.md`.

**Interfaces:** Existing compilerProgram/diagnostics/describeDiagnostic remain.
Classic API reports `6.0.3`; wrapper package version is separately `6.0.2`.
Export fixture values `raw`, `inline`, `twice`, `inlineService`, `inlinePromised`
for the unchanged downstream fixture. No new public library API.

- [ ] **Step 1: Add actual source and installed RED fixtures.**

Use this complete positive fixture in `tests/types/modern-inline.ts`:

```ts
import { DiBag, type ProviderOutput, type ProviderNeeds, type ProviderMetadata,
  type ProviderAcquisitionMetadata, type ValBoxFrame } from '../../src';
import type { ProviderFactory } from '../../src/provider';
import { fromValBox } from '../../src/val-box';
import type { Assert, Equal } from './assert';

export const raw = { snapshot(this: { snapshot: unknown }) {
  return { value: { present: true as const, value: Promise.resolve(42) },
    metadata: { present: true as const, value: { owner: 'db' } }, alias: null };
} };
const factory = () => ({ snapshot() { return {
  value: { present: true as const, value: raw },
  metadata: { present: false as const }, alias: '',
}; } });
const predeclared = fromValBox(factory);
export const inline = fromValBox(() => ({ snapshot() { return {
  value: { present: true as const, value: raw },
  metadata: { present: false as const }, alias: '',
}; } }));
export const twice = fromValBox(inline);
const predeclaredTwice = fromValBox(predeclared);
type SnapshotChecks = [
  Assert<Equal<ProviderOutput<typeof inline>, typeof raw>>,
  Assert<Equal<ProviderNeeds<typeof inline>, Record<never, never>>>,
  Assert<Equal<ProviderFactory<typeof inline>, (this: void, deps: Record<never, never>) => typeof raw>>,
  Assert<Equal<ProviderMetadata<typeof inline>, Readonly<{}>>>,
  Assert<Equal<ProviderOutput<typeof twice>, Promise<number>>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof twice>, readonly [ValBoxFrame<never>, ValBoxFrame<{owner:string}>]>>,
  Assert<Equal<ProviderOutput<typeof predeclared>, typeof raw>>,
  Assert<Equal<ProviderOutput<typeof predeclaredTwice>, Promise<number>>>,
];
const providers = {
  service: () => ({ read() { return Number(1); }, extra() { return true; } }),
  promised: async () => 7,
};
const root = DiBag.begin().add(providers).end();
const overrides = {
  service: () => ({ read() { return 3; }, extra() { return true; }, richer() { return 9; } }),
  promised: async ({service}: {service: {richer(): number}}) => service.richer(),
};
const predeclaredFork = root.fork(['service', 'promised'], overrides);
const inlineFork = root.fork(['service', 'promised'], {
  service: () => ({ read() { return 3; }, extra() { return true; }, richer() { return 9; } }),
  promised: async ({service}: {service: {richer(): number}}) => service.richer(),
});
export const inlineService = inlineFork.resolve('service');
export const inlinePromised = inlineFork.resolve('promised');
type ForkChecks = [
  Assert<Equal<typeof inlineService, {read(): number; extra(): boolean; richer(): number}>>,
  Assert<Equal<typeof inlinePromised, Promise<number>>>,
];
const control: number = predeclaredFork.resolve('service').richer();
```

Create `modern-inline-consumer.ts` using the same imported Assert/Equal helper:

```ts
import type { ProviderOutput, ProviderNeeds, ProviderAcquisitionMetadata, ValBoxFrame } from '../../src';
import { raw, inline, twice, inlineService, inlinePromised } from './modern-inline';
import type { Assert, Equal } from './assert';
type Contracts = [
  Assert<Equal<ProviderOutput<typeof inline>, typeof raw>>,
  Assert<Equal<ProviderNeeds<typeof inline>, Record<never, never>>>,
  Assert<Equal<ProviderOutput<typeof twice>, Promise<number>>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof twice>, readonly [ValBoxFrame<never>, ValBoxFrame<{owner:string}>]>>,
  Assert<Equal<typeof inlineService, {read(): number; extra(): boolean; richer(): number}>>,
  Assert<Equal<typeof inlinePromised, Promise<number>>>,
];
```

Add a source test named `modern inline inference retains exact contracts` that
compiles the consumer and requires zero diagnostics. Add `modern-inline.ts` to
the actual installed CJS/ESM fixture list in box-package.test.ts; reuse its existing
redirection of internal type imports and Assert/Equal. Before changing dependencies
run `bun test tests/types.test.ts --test-name-pattern 'modern inline'` and
`bun test tests/box-package.test.ts --test-name-pattern modern-inline`.
Record actual TS2345/TS2322 and exact-assertion failures. A syntax, import or
missing-file error is not the intended RED. Preserve predeclared controls.

- [ ] **Step 2: Add matched invalid cases and adopt the exact classic aliases.**

The negative fixture imports DiBag/fromValBox from the adjacent source paths,
defines the same root service/promised registrations, and has separate markers:

```ts
// diagnostic: not assignable
root.fork(['service', 'promised'], {
  service: () => ({ read() { return 3; }, extra() { return true; } }),
  promised: async ({service}: {service: {richer(): number}}) => service.richer(),
});
// diagnostic: invalid val-box snapshot capability
fromValBox(() => ({ snapshot(required: string) {
  return { value: {present: true as const, value: required}, metadata: {present: false as const}, alias: null };
} }));
// diagnostic: invalid val-box snapshot capability
fromValBox(() => ({ snapshot(this: {missing: true}) {
  return { value: {present: true as const, value: 1}, metadata: {present: false as const}, alias: null };
} }));
```

Add the negative fixture to installed routing; source negative discovery already
exists. These are coverage unless the actual baseline shows a new bug.

Change only development tooling/configuration:

```json
{
  "devDependencies": {
    "typescript": "npm:@typescript/typescript6@6.0.2"
  },
  "overrides": {
    "@typescript/old": "npm:typescript@6.0.3"
  },
  "scripts": {
    "typecheck": "tsc6 -p tsconfig.json",
    "build": "tsc6 -p ./tsconfig.build.json"
  }
}
```

Retain all other manifest fields/dependencies/scripts. Generate the lock through
npm with lifecycle scripts disabled, no audit/funding and explicit registry.
Inspect lock versions and assert imported ts.version is exactly6.0.3. No global
install, box dependency, compiler peer or runtime dependency is added.
Keep @typescript/old transitive: making it direct would introduce a second tsc
bin alongside Task2's native compiler. The exact override was verified with
npm11 in an isolated install, including both aliases: tsc6 resolves6.0.3 and
tsc resolves7.0.2. Recheck those command targets after Task2 installs native.
In tsconfig.json set module/moduleResolution to `NodeNext` and rootDir to `.`;
retain all strictness, ES2022, include/exclude and other flags. In compiler.ts
set `module: ts.ModuleKind.NodeNext` and `moduleResolution: ts.ModuleResolutionKind.NodeNext`.
Replace the three package-runner `node_modules/typescript/bin/tsc` paths with
`node_modules/typescript/bin/tsc6`. Build still overrides rootDir to src and emits
the existing CommonJS package format. No ignoreDeprecations or stable-ordering
flag is needed. Update only the work gate's expected version to6.0.3; leave its
1.5M/2M ceilings and original graphs unchanged pending actual measurements.

- [ ] **Step 3: Verify installed feature emission and real-box inference.**

In box-package.test.ts, for each existing commonjs/module mode, add a test using
the installed di-bag archive and the unchanged modern-inline producer/consumer.
Redirect only import edges and inline Assert/Equal, just as existing fixtures do.
Producer path `modern-feature.cts`/`.mts`; use strict NodeNext, declaration plus
emitDeclarationOnly, explicit rootDir/outDir=consumer. Collect writes in a Map.
Require zero pre-emit/emit diagnostics and a `.d.cts`/`.d.mts` entry.
Consumer source replaces `./modern-inline` with `./modern-feature.cjs`/`.mjs`.
Its host exposes only the emitted declaration, makes producer source absent, and
requires all existing exact assertions without changing the consumer body.

Use the existing token-package host pattern, including these actual assertions:

```ts
expect(consuming.getSourceFile(featurePath)).toBeUndefined();
expect(consuming.getSourceFile(declarationPath)).toBeDefined();
expect(ts.getPreEmitDiagnostics(consuming).map(error =>
  ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
```

In the existing installed `real` box fixture, retain `boxed` and add:

```ts
const nested = fromValBox(() => ({ snapshot() { return {
  value: { present: true as const, value: boxed },
  metadata: { present: false as const }, alias: null,
}; } }));
const nestedValue = fromValBox(nested);
type Nested = [Assert<Equal<ProviderOutput<typeof nested>, typeof boxed>>,
  Assert<Equal<ProviderOutput<typeof nestedValue>, Promise<number>>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof nestedValue>, readonly [ValBoxFrame<never>, ValBoxFrame<{owner:string}>]>>];
```

Run source/installed/token-package contracts and both work gates. If an inferred
declaration is not portable, stop for the exact compiler diagnostic and a scoped
controller decision; do not annotate exports into a weaker view or add casts.

- [ ] **Step 4: Verify, document and commit the adopted inference contract.**

Run `bun test tests/types.test.ts tests/package.test.ts tests/box-package.test.ts tests/token-package.test.ts tests/incremental-scale.test.ts`.
Iterate only failing focused tests, then run `npm run check` once on final code,
all four `examples/*.ts`, and `git diff --check`. Record actual counts/outputs,
6.0.3 work counters, lockfile aliases and emitted package format. Verify no
production signature/runtime changes. README/migration state the supported
compiler floor6.0.3 and both newly supported inline contracts; 5.9 limitations
and scale records remain labeled history, not claimed fixes on5.9.
The modern-compilers report distinguishes source, actual installed, emitted and
downstream proof, and leaves native/large-scale/enterprise obligations open.
Commit `build: adopt modern compiler inference with package regression gates`.

### Task 2: Verify native compiler contracts with supervised original scale reports

**Files:** Modify `package.json`, `package-lock.json`, `tsconfig.json`,
`tsconfig.build.json`, `scripts/benchmark-types.ts`, `tests/benchmark-types.test.ts`,
`tests/box-package.test.ts`,
`tests/types.test.ts`, `tests/types/negative/fork-dependency-shape.ts`,
`tests/types/negative/fork-missing.ts`, `tests/types/negative/fork-selection.ts`,
`tests/types/negative/inline-fork-dependency-shape.ts`,
`tests/types/negative/inline-fork-missing.ts`,
`tests/types/negative/inline-fork-wrong-shape.ts`,
`tests/types/negative/required-this.ts`, `tests/types/negative/tokens.ts`,
`tests/types/negative/indexed-registrations.ts`,
`tests/types/negative/provider-boundaries.ts`,
`tests/types/negative/provider-module-metadata.ts`,
`tests/types/negative/provider-projections.ts`, `tests/types/negative/provider-unions.ts`,
`docs/benchmarks/typescript.md`, `docs/reports/2026-09-07-modern-compilers.md`,
`README.md`; create `scripts/native-process.ts`, `scripts/native-compiler.ts`,
`scripts/native-scale.ts`, `scripts/check-native-contracts.ts`,
`scripts/benchmark-result.ts`, `tests/native-process.test.ts`,
`tests/native-compiler.test.ts`, `tests/native-package.test.ts`,
`tests/box-contract-fixtures.ts`, `tests/diagnostic-markers.ts`,
`tests/diagnostic-markers.test.ts`.

Ruling7 additionally permits comment-only native-gap declarations in the ten
affected negative files, a native-specific diagnostic matcher/fingerprint helper
and its tests, supported replacement utility fixtures and cast-free history-view
rejection fixtures, and their source/installed routing. It does not permit any
production signature change or the isolated union-alias marker change.

**Interfaces:** Consume unchanged scaleSource/tokenScaleSource and boundary mappers,
Task1's modern-inline producer/consumer fixtures, current packed box archives,
and classic API6.0.3. New pure process/parser/evaluator helpers are development
infrastructure, never package root exports or production imports. Resolve native
7.0.2 from the exact installed platform package; do not import unstable APIs.

- [ ] **Step 1: Add pure evaluator contracts and real supervisor tests before implementation.**

Extract the current parent worker evaluation to benchmark-result.ts, retaining
its exact semantic checks and raw failure fields. Expose these interfaces:

```ts
export type MatrixCase = { count: number; form: 'bulk' | 'chained' | 'grouped' | 'replacement' | 'bindings' | 'modules'; scenario: 'valid' | 'missing' | 'wrong-shape' | 'missing-final-token' | 'mismatched-invariant-service' };
export type WorkerEvidence = { status: number | null; signal: string | null; error?: string; stdout: string; stderr: string };
export function evaluateWorker(item: MatrixCase, child: WorkerEvidence, expectedPath: string): Record<string, unknown>;
export function acceptDiagnostics(diagnostics: readonly {file?: string; line?: number; code: number; message: string}[], item: MatrixCase, expectedPath: string, boundaryLine: unknown): boolean;
```

The evaluator parses and runtime-validates JSON; never trust a child's accepted
flag. Share the actual diagnostic predicate between classic and native rows.
Direct tests construct honest serialized success/negative controls and mutate
one field at a time: malformed/array/null JSON, wrong count/form/scenario,
missing/malformed diagnostics, stderr, nonzero status, signal, error, empty output,
wrong file, right message on wrong line, right line with wrong message, TS2589,
duplicate intended diagnostics. Require failure and retained raw process evidence.
Assert all successful and failed row identities remain the requested identity,
and aggregate accepted/failure counts agree with the rows. Preserve existing real
worker tests as integration coverage; no large compiler matrices in unit tests.

Implement native-process.ts around node:child_process.spawn with this contract:

```ts
export type ProcessLimits = { timeoutMilliseconds: number; maxRssMiB: number; maxOutputBytes: number; sampleMilliseconds: number };
export type NativeProcessResult = { status: number | null; signal: string | null; stdout: string; stderr: string; milliseconds: number; peakObservedRssMiB: number; terminationReason?: 'timeout' | 'memory' | 'output' | 'monitor' | 'spawn'; error?: string };
export function supervise(executable: string, args: readonly string[], cwd: string, limits: ProcessLimits): Promise<NativeProcessResult>;
```

Require positive finite limits and Linux memory monitoring. Invoke the native
executable directly, monitor `/proc/<owned child pid>/status` VmRSS every20ms,
track sampled peak, and terminate/reap on threshold, timeout, output overflow or
unexpected monitor failure. ENOENT during observed process exit is not a false
monitor failure. Preserve both output streams up to the bound and an explicit
overflow reason; no unbounded strings. Resolve only after the child has exited
and streams closed; clear timers/listeners on every route. A failed spawn returns
explicit evidence, not a successful empty run.

Use actual small Node child processes for tests: a clean child with stdout and
stderr; exit3; nonexistent executable; persistent child with20ms timeout; an
8MiB-or-lower RSS threshold against a persistent ordinary Node child; output
larger than a1KiB test limit. Verify reasons, output, status/signal and completion
without lingering child/timer handles. Test invalid limits and unsupported-OS
policy without running unbounded work. Record missing-interface RED, then GREEN.

- [ ] **Step 2: Install the native lane and implement checked CLI parsing/projects.**

Add the development alias `@typescript/native: npm:typescript@7.0.2`, lock it with
npm scripts disabled, and verify native/wrapper/classic implementation versions.
Add `typecheck:native` (`tsc -p tsconfig.json`), `build:native`
(`tsc -p tsconfig.build.json`), and `check:native`
(`node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-native-contracts.ts`).
Keep classic typecheck/build and compiler-work gates. To typecheck runtime `.ts`
imports in test-visible helper files, root noEmit config may set
allowImportingTsExtensions:true; build must explicitly set it false. No public
source import rewrite or compiler transform is permitted. Keep entry execution
inside async main functions; avoid making root CJS files depend on top-level await.

native-compiler.ts resolves `@typescript/native/package.json`, then from that
installation resolves `@typescript/typescript-${process.platform}-${process.arch}/package.json`.
On Linux the binary is its `lib/tsc`; verify both package versions and a bounded
`--version` result exactly7.0.2. Do not reuse the Node wrapper's RSS.
Use a physical scratch tsconfig with explicit strict/noUncheckedIndexedAccess/
exactOptionalPropertyTypes, ES2022, NodeNext module/resolution, types:[], noEmit,
and an explicit files list. Keep package-consumer skipLibCheck disabled. Native
source/scale checks preserve the existing source helper's skipLibCheck setting.

Expose `parseNativeDiagnostics(stdout, cwd)` returning diagnostics, recognized
extended-diagnostic metrics, and unparsed lines. Parse actual
`file(line,column): error TS1234: message` records, retaining following message
lines. Read valid and invalid real tiny-compiler outputs before finalizing the
parser, including platform line endings. Do not silently ignore unmatched output.
Return normalized absolute files and1-based positions. A no-emit valid case must
exit0 with zero diagnostics; an intended-invalid case must have the compiler's
observed diagnostic exit code and a corresponding diagnostic. Configuration
errors, unknown output, signal/termination, stderr and version mismatch fail.
Escalate a real exit-format disagreement rather than guessing a wider success set.

Add parser tests for real captured valid/negative output, multiline messages,
wrong file/line, config diagnostics without a file, TS2589 and unrecognized text.
Use actual emitted artifacts or recognized extended-diagnostic output to prove
the compiler processed a nonempty files list; empty process output is not proof.

- [ ] **Step 3: Add full native source and installed declaration verification.**

Apply the evidence-based diagnostic fixture refinement from the spec before
requiring cross-lane GREEN. Change comments only: seven fork markers retain the
exact offending type plus `is not assignable to type`, omitting their internal
ProviderBase/union-order suffix. The tokens.ts missing generic key marker becomes
`Property '[key]' is missing`. Declare11 supplemental diagnostics already present
on both compilers using `// diagnostic-also: TS<code> <message>` immediately after
the primary marker; these do not begin a new region. The exact existing cases:
indexed-registrations line6 TS2345 `add introduces new tokens only`;
provider-boundaries line37, provider-module-metadata line25,
provider-projections lines31/33/35/37/40/42/44, provider-unions line63:
TS2684 `missing factories`. These are pre-edit source lines; attach to the same
expressions, not hard-coded line numbers after comments shift them.

Move the pure matchDiagnosticMarkers helper into tests/diagnostic-markers.ts,
consumed by classic source/box tests and the native helper. Preserve primary
file/region/message semantics; require exact code as well for supplements.
Require321 primary and11 supplemental expectations from the original corpus.
Classic must match all useful requirements; native accounting follows Ruling7
below. Tests prove a supplement cannot substitute
for a missing primary, and reject wrong code/file/region, TS2589 and any unrelated
extra diagnostic. Positive/negative program bodies remain unchanged. Record the
existing RED and cross-lane rejection results. Native overload-message parity
remains explicitly open under Ruling7 rather than prompting a type-unsafe API
redesign.

Apply the spec's Ruling7 before proceeding: retain production src unchanged and
declare exactly27 observed native overload gaps beside the existing primary
comments in incremental, inline-replacement-wrong-shape, module-hidden-private-needs,
module-narrowing, module-rename, provider-boundaries, replacement-context,
replacement-wrong-shape, required-this and union-replace negative fixtures.
Use three exact observed multiline TS2769 fingerprints (ordinary string,
string-union intersection elaboration, open-template argument), not a generic
code or substring exemption. Each declaration belongs to one primary region,
does not open a new region, and is native-only. Keep the shared classic matcher
strict. Native output separately reports useful matches, known overload
rejections, supplemental matches, unresolved requirements and unexpected errors.
For the original corpus require294useful+27known native rejections+11supplements,
not a misleading332useful-match count. Installed fixtures consume the same
declarations and require four known gaps in negative/incremental.ts per variant.
Reject absent/duplicate/stale/misplaced declarations, wrong fingerprint/code/file/
region, TS2589, missing actual rejection and unrelated extra diagnostics in
direct tests. A classic marker must never use the native exception.

Add positive concrete named/token replacement and wrapper non-any proofs, and
standard ReturnType non-any plus negative builder/module history-view assignment
regressions. Baseline source stays unchanged; the unsafe isolated signature is
retained only as RED evidence. Add these fixtures to both installed lanes.
Report any pre-existing unsupported forwarding form as a limitation, not as a
positive or a silently suppressed error. All original fixtures/assertions remain.

check-native-contracts.ts enumerates the actual `tests/types` TypeScript fixtures,
using source paths without changing their bodies. Compile supported positives
and all negative fixtures through physical projects and the supervised native
CLI. Match each existing diagnostic marker's file/region/message or its explicitly
declared Ruling7 native overload rejection, reject every
unexpected diagnostic or TS2589, and print explicit expected/matched/unexpected
counts. Include Task1's unchanged modern producer and consumer. No lowered count,
suppression or annotation may replace a failing native case. Count diagnostic
gaps separately and retain the unmet useful-message requirements in reports.

native-package.test.ts builds and packs actual di-bag archives using each emitter
(`tsc6` and native `tsc`) separately, installs each archive and the two real box
fixtures into owned temp consumers with offline/scripts-disabled npm, and checks
both `.cts` and `.mts` consumers through native7.0.2. Use the unchanged modern
fixtures with only package/import/assertion routing, plus actual ValBox nested
inline snapshot assertions from Task1. Verify token-module feature/consumer and
all installed negative fixtures currently selected by box-package.test.ts.

Extract the existing installed box fixture list, real-box source literal and
import/assertion routing into tests/box-contract-fixtures.ts, consumed by both
classic box-package.test.ts and native-package.test.ts. Keep every existing
fixture and assertion unchanged. The helper exports boxContractFixtures and
boxContractSource(fixture: string): string; native cases supply physical paths
matching its existing installed-package import edges. This is one shared
contract fixture, not duplicate lists or independently edited real-box literals.
No test registration, process spawning or compiler state belongs in that helper.
Build each emitter's package in its own owned temporary source/package tree,
copying unmodified production source and package metadata, so native and classic
package checks do not overwrite a shared dist directory.

For modern-inline and token-module features, emit actual native `.d.cts`/`.d.mts`
files into a separate output directory and compile unchanged downstream consumer
text with producer source unavailable. Consumers resolve only the emitted file,
not a hidden source fallback. Include a TypeScript6 API consumer of native-emitted
features to prove cross-lane declaration compatibility. Keep source/project paths
under validated owned temp directories. Reuse existing fixture text; do not copy
library implementation or claim in-memory resolution alone is installation.

Run `npm run typecheck:native`, `npm run build:native`, `npm run check:native` and
the focused native process/parser/package tests. The rejection gates, including
explicit Ruling7 gap accounting, must pass before the large matrices run.
Matrix diagnostic acceptance remains unchanged and does not consume fixture-gap
exceptions. Keep the plain-core-without-box dependency and all four
runtime examples as existing requirements.

- [ ] **Step 4: Run original native matrices and retain every outcome.**

Add benchmark CLI modes `--native` and `--native --tokens` while preserving default,
`--tokens`, and existing worker invocations. Reject unknown/duplicate flags.
native-scale.ts calls the existing generators without rewriting them, copies
unmodified src into an owned scratch `src` directory, and writes the generated
file under sibling `tests` so `../src` retains its original layout. Use the
existing boundary mappers unchanged. Run each compiler directly with:

```ts
const limits = { timeoutMilliseconds: 60_000, maxRssMiB: 3072,
  maxOutputBytes: 4 * 1024 * 1024, sampleMilliseconds: 20 };
```

The report's native branch awaits one directly supervised native process per
case; do not add an outer timeout wrapper that can orphan the native child.
Use acceptDiagnostics for semantic acceptance after checked native completion/
parsing, preserving actual native exit status, streams and termination reason in
each row. Never present a normalized classic worker status as the native exit.
Keep exact compiler identity, source hash/commit, count/form/scenario, diagnostics,
boundary, elapsed time and sampled RSS. Native metrics are labeled as native,
not substituted for Program.getInstantiationCount regression counters.

Run `npm run benchmark:types -- --native` (36named cases) and
`npm run benchmark:types -- --native --tokens` (18token cases) sequentially under
approved execution. Retain full JSONL artifacts in this plan's workspace and
print cases/accepted/failures summaries. Add small native100 controls to ordinary
tests, not these full matrices. Preserve all failed rows; a missing compiler
result is open T2 work, not an intended negative. Do not rerun the whole classic
large matrix merely to replace its labeled5.9 history; new classic scale claims
require their own actual measurement.

- [ ] **Step 5: Verify integration, document actual support and commit.**

Run the covering process/parser/evaluator/native-package/source checks, existing
benchmark/work/token-scale tests, strict typecheck on touched test-visible code,
and full `npm run check` once after final changes. Then native check/build and all
four examples, with diffcheck and artifact identity/summary validation. Classic
and native passes/failures and emitted-package variants must be separately named.
Document actual native observations in the benchmark and modern-compilers report;
retain all historical5.9 tables. README distinguishes primary support, bounded
observed limits and Linux-only supervised reports. No native-scale support is
claimed for a failed form. Record closure of the parent-evaluator test Minor;
keep the unrelated runtime Minor and all uncompleted enterprise rows open.
Commit `test: verify native compiler contracts and original scale reports`.

## Plan self-review and handoff

Task1 closes the demonstrated inference requirement only after source, installed,
emission and downstream proofs. Task2 independently verifies the native compiler
and current large forms, resolves the touched harness coverage gap and preserves
failure evidence. They share tooling/package runners and fixture text but have
separate reviewable outcomes. Full enterprise scope, compiler limits that remain
measured, lifetime/startup and release obligations are not narrowed by this plan.
