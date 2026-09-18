# Compiler Scale Limits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close issue #29 by measuring, not guessing, where a single fluent DI Bag expression stops compiling on classic TypeScript 6.0.3 and native 7.0.2, preserving that measurement as a reproducible benchmark mode, recording compile time and memory per case for both compilers, and stating the limit and the grouping guidance plainly in the docs.

**Architecture:** A new informational benchmark, `scripts/benchmark-compiler-ceiling.ts` (`npm run benchmark:compiler-ceiling`), bisects the largest accepted call count per form between a lower and an upper bound, repeats each count, classifies every failure (stack overflow, heap, timeout, supervision limit, diagnostics), and, for a classic stack overflow, reruns the smallest failing count once with a larger V8 stack to attribute the failure. It reuses the generators in `tests/compiler.ts` (plus a warm library-free control and a named-module generator moved there), the classic worker pattern of `scripts/benchmark-types.ts`, and the native supervision of `scripts/native-scale.ts`. Evidence goes to `docs/benchmarks/results/` (untracked, like every other raw run); the committed evidence is the summary transcribed into `docs/benchmarks/typescript.md`. A type optimization is a conditional, time-boxed experiment gated on what the bisection shows.

**Tech Stack:** TypeScript compiler API (classic, in-process worker per case), native `tsc` supervised on Linux (`scripts/native-process.ts`), Node 24 scripts, bun:test.

**Spec:** none; this plan carries its own design section. Issue: https://github.com/dany-fedorov/di-bag/issues/29.

**Starting point:** `main` at 2e6602f. Nothing here depends on `feat/push-disposer`. The findings below were measured on e1d4037 (that branch); the builder types in `src/di-bag.ts`, `src/types.ts` and `src/replacement-types.ts` are unchanged from `main` there. The scratch probe used for the findings is in the session scratchpad as `ceiling-probe.ts`; Task 3 replaces it with a preserved script.

## Global Constraints

- Zero runtime dependencies; minimum TypeScript 6.0.3; `npm run check:native` must keep passing.
- The classic compiler is `typescript@6.0.3` behind the `@typescript/typescript6` shim (`node_modules/typescript/lib/typescript.js` is `module.exports = require("@typescript/old")`); `ts.version` prints `6.0.3` and tests pin that string. The native compiler is `@typescript/native` 7.0.2 (`scripts/native-compiler.ts` refuses any other version).
- Native supervision requires Linux (`validateLimits` in `scripts/native-process.ts`). Fixed limits, unchanged by this plan: native 60 s, 3,072 MiB sampled RSS, 4 MiB output; classic workers `--max-old-space-size=3072` and a 60 s `spawnSync` timeout.
- `parseCompilerCase` and `runCompilerCase` in `scripts/compiler-case.ts` admit only the original matrix (counts 100/500/1000, six forms); `tests/compiler-case.test.ts` pins the rejection of anything else. Never relax them; the ceiling mode is a separate script.
- Every compiler-lane test file must be listed in `scripts/test-lane.mjs`; `tests/test-lanes.test.ts` checks that the two lanes partition `tests/**/*.test.ts`.
- `tests/package.test.ts` fails on the npm update notice: run the compiler lane as `npm_config_update_notifier=false npm run test:compiler`. It also has a pre-existing 5 s timeout flake under load; rerun it alone before treating it as a regression.
- Release gates need Bun pinned at 1.4.0; they are not part of this plan.
- Benchmarks are informational. Their exit status reports completion, not acceptance; timings are never test pass criteria. `docs/benchmarks/results/` is untracked and stays untracked (see Decision D4).
- `CHANGELOG.md` gains no `## Unreleased` heading (`tests/release-artifacts.test.ts`). If Task 5 changes a signature, its changelog text goes in the design note of that task, for the next release chore.
- `AGENTS.md` is at its 150-line budget and is not touched; the README bullet and the benchmark page are the discovery path for the limit.
- Commit prefixes: `feat:`, `fix:`, `test:`, `docs:`, `chore:`. `npm run typecheck && npm run test:fast` before every commit; `npm_config_update_notifier=false npm run test:compiler` before the PR.

---

## Design

### What the issue asks, and what is already true

| Acceptance criterion (#29) | State on `main` | This plan |
| --- | --- | --- |
| Preserve fixtures for long chains, replacements, bulk, composed modules | `tests/compiler.ts` generates bulk, chained, grouped, replacement, token bindings and token modules; `tests/type-scale.test.ts` holds a named-module generator privately | Task 1 moves the named-module generator into `tests/compiler.ts` and adds a warm library-free control; Task 3 preserves the bisection itself |
| Report classic and native separately, with compile time, memory and failure threshold | The matrices already emit `milliseconds`, `maxRssMiB`, `instantiations` (classic) and `Total time`, `peakObservedRssMiB`, `Instantiations` (native), but `docs/benchmarks/typescript.md` records only accepted/failed per 1,000-operation form | Tasks 4 and 6 measure and tabulate per case; the threshold comes from the new mode |
| Demonstrate whether implementation changes improve the failing cases | Not done | Task 4's attribution decides; Task 5 is the bounded experiment |
| Missing/incompatible dependencies stay compile-time failures | Pinned by 77 negative fixtures, the type-scale suite and both matrices' negative scenarios | Unchanged; Task 5's kill criteria include them |
| Document grouping/module boundaries with measured examples | README and `docs/guides/development.md` name bulk, groups of 50 and named modules, without numbers | Task 6 |
| State the limit plainly | The page says "about" nothing: it names 1,000 as failing and 575 as a control ceiling | Task 6, from Task 4's numbers |

### Findings this plan builds on

Measured 2026-09-18 on one host (Linux 7.0.11, 24 cores, 32 GiB, Node v24.20.0), one run per cell unless noted, through the same in-process worker the matrix uses (`compilerProgram` + `getPreEmitDiagnostics`, `--max-old-space-size=3072`, default V8 stack). Classic = 6.0.3, native = 7.0.2.

| Form | Calls | Classic outcome | Compile | Peak RSS | Instantiations |
| --- | --- | --- | --- | --- | --- |
| chained | 100 | accepted | 1.5 s | 404 MiB | 0.79 M |
| chained | 500 | accepted | 10.9 s | 1,496 MiB | 13.96 M |
| chained | 700 | accepted | 19.5 s | 2,178 MiB | 26.8 M |
| chained | 850 | accepted | 26.9 s | 2,324 MiB | 39.1 M |
| chained | 1,000 | accepted (twice, once via the exact `--worker` path) | 36.7 s | 2,716 MiB | 53.8 M |
| chained | 1,250 | stack overflow after 1.0 s, in the checker's descent (`checkPropertyAccessExpression ← resolveCallExpression ← …`) | | | |
| replacement | 100 | accepted | 1.4 s | 404 MiB | 1.03 M |
| replacement | 750 | accepted | 26.1 s | 2,800 MiB | 48.5 M |
| replacement | 1,000 | stack overflow after 3 s, in `instantiateInstantiableTypes ↔ map` under `getContextualSignature` (contextual typing of the innermost argument, the 1,000-key bulk map, at chain depth 1,001) | | | |
| replacement | 1,000 with `--stack-size=4000` | accepted | 55.6 s | 3,202 MiB | 85.9 M |
| bulk | 1,000 | accepted | 3.4 s | 573 MiB | 2.5 M |
| grouped (maps of 50) | 1,000 | accepted | 3.5 s | 638 MiB | 3.5 M |
| control, cold (no imports) | 550 / 575 | accepted / stack overflow in the checker's descent | 0.3 s | 220 MiB | 0 |
| control, warm (imports `src`) | 575, 700, 850, 1,000 | accepted | 1.0 s | 360 MiB | 95 k |
| control, warm | 1,250 | stack overflow in the checker's descent | | | |
| control, warm | 1,500, 2,000, 3,000 | stack overflow in the binder (`bind ← bindEachChild ← bindCallExpressionFlow`) | | | |
| chained, native | 1,000 | accepted; check time 17.4 s of 17.5 s total | 17.5 s | 1,719 MiB peak RSS (1,131 MiB "Memory used") | 53.8 M |

1. **The recorded control number is a JIT artifact, and its attribution is wrong.** `docs/benchmarks/typescript.md` says a library-free control "overflows the TypeScript 6.0.3 binder at 575". A control with no imports does crash at 575, but in the checker, and the same chain compiled after `src/` (as every DI Bag case is) passes at 1,000 and crashes at 1,250. The checker's descent through a call chain costs about eleven frames per call; how many fit in V8's default stack depends on whether those functions run as interpreted or optimized code, which depends on how much the checker has already done in that process. The ceiling is therefore a range, not a constant, and the control must be compiled under the same conditions as the library cases.
2. **The recorded chained failure is stale.** The 1,000-call chained case, recorded as a stack overflow on 2026-09-10 (d7980a0, before c9d5f31 merged the builders and before plans 01–07), is accepted today at the default stack. Only the replacement form still fails at 1,000.
3. **The remaining failure is V8's stack budget, provably.** The replacement case passes unchanged with `--stack-size=4000`. DI Bag's chained ceiling sits in the same bracket as TypeScript's own warm control (1,000 accepted, 1,250 overflowing); the replacement ceiling is in 750–1,000, at most a couple of hundred calls lower, because its innermost call is a 1,000-key bulk map whose properties are contextually typed at maximum depth. No change to DI Bag's types can reduce the per-call descent cost, which is the compiler's; the only DI Bag lever is the per-form constant at the innermost frame.
4. **Cost is quadratic.** Instantiations grow roughly with the square of the call count (0.79 M → 13.96 M → 53.8 M for 100 → 500 → 1,000 chained), and time and memory follow. Even where a 1,000-replacement expression does not overflow, it needs 86 M instantiations, 56 s and 3.2 GiB, at the edge of the matrix's 60 s and 3 GiB limits. Bulk maps, groups of 50 and named modules check the same 1,000 providers in about 3.5 s and 0.6 GiB.
5. **Native has no stack ceiling, only budgets.** The Go compiler's stacks grow on demand; its instantiation count for 1,000 chained calls matches classic's exactly, at half the time and memory. Its ceiling within the fixed limits is where the 60 s budget runs out.

### Decisions

**D1. A separate script, not a matrix flag.** `scripts/benchmark-compiler-ceiling.ts` with `npm run benchmark:compiler-ceiling`. The matrix worker (`benchmark-types.ts --worker`) and `runCompilerCase` refuse counts outside 100/500/1000 by design, with tests pinning that; the ceiling needs arbitrary counts, repeats and failure classification, which do not belong in the accepted-matrix contract. The new script reuses `scaleSource`, `compilerProgram`, `describeDiagnostic`, `resolveNative` and the native project builder; it does not import `runCompilerCase`.

**D2. Forms and scenario.** Forms: `chained`, `replacement`, `control` (the warm library-free chain), `named-modules` (providers in reusable named modules of 50, installed into one host). Scenario: `valid` only. The negative scenarios are already exercised at 100, 500 and 1,000 by the matrices and the type-scale suite; a ceiling is a statement about acceptance, and a negative case at the ceiling would only report whichever failure comes first. Token bindings and modules are out of scope: both compilers accept them at 1,000 and the recorded statement for them stays "no ceiling observed up to 1,000".

**D3. Bisection rules.** `--from` and `--to` are probed first: a failing lower bound or a passing upper bound ends the search. Otherwise binary search until the bracket is at most `--resolution` calls wide (default 25). Each count runs `--repeats` times (default 3) and passes only if every repeat is accepted; the first failed repeat ends that count. `largestAccepted` is the largest count where all repeats passed, `smallestFailed` the smallest count where any failed, and mixed counts are listed as `flaky`. Failure kinds: `stack-overflow` (stderr has `Maximum call stack size exceeded`), `heap` (`heap out of memory`), `timeout` (spawn timeout or native `terminationReason: 'timeout'`), `memory` / `output` (native supervision), `diagnostics` (the compiler finished with errors, including TS2589), `crash` (anything else). For a classic `stack-overflow`, the script reruns `smallestFailed` once with `--stack-size=<--stack-size, default 4000>` KiB and records `attribution: 'v8-stack-budget'` when that passes, `'not-stack-budget'` otherwise. The larger stack is an attribution instrument only; it is never documented as a user workaround (V8 can fault when the flag exceeds the thread's stack).

**D4. Evidence is untracked; the page is the record.** Runs write JSON lines to `docs/benchmarks/results/<YYYY-MM-DD>-<commit7>/compiler-ceiling-<utc>.jsonl`, the convention of `benchmark-compiler-controls.ts`. Commit 727285d ("docs: remove historical documentation") deliberately deleted raw result artifacts; this plan keeps that decision and transcribes summaries (date, commit, host, compiler identities, numbers) into `docs/benchmarks/typescript.md`. `.gitignore` is not changed: `scripts/performance-evidence.ts` treats `docs/benchmarks/results/` paths as clone-safe references, so ignoring the directory would silently break a deliberate comparison commit; the untracked directory in `git status` is the reminder not to add it. Rejected: committing JSONL (host-specific, large, removed once already); a CI gate on the ceiling (a 15–30 minute run whose exact number moves with JIT state and host load).

**D5. Type optimization is conditional and bounded.** Task 5 runs only if Task 4 shows, for `chained` or `replacement`, `failureKind === 'stack-overflow'`, `attribution === 'v8-stack-budget'`, and `control.largestAccepted − form.largestAccepted ≥ 200`. Below that gap the per-form constant is not worth an API-shape change: the descent cost is the compiler's, and the docs state the measured gap instead. If it runs, it has one named candidate with an exact diff, one measurement, and a keep-or-revert rule; missing and wrong-shape dependencies must stay compile-time failures with the same marker text in every negative fixture on both compilers, and the incremental-scale ceilings must hold. Expected outcome, from the findings: the gap is below 200 for `chained` and at most 250 for `replacement`, so Task 5 most likely records "not triggered".

**D6. The limit statement.** The page, README and development guide will say, in this shape and with Task 4's numbers: "One fluent expression is limited by the compiler's recursion budget on V8's default stack, about eleven checker frames per call: on the recorded host, classic 6.0.3 accepts a 1,000-call chain and overflows between 1,000 and 1,250, the same bracket as a library-free control; a bulk map followed by individual replacements overflows between 750 and 1,000. The number moves with JIT state and host load, so budget at most 500 calls per expression and group beyond that. Native 7.0.2 has no stack ceiling; a 1,000-call chain takes 17 s and 1.7 GiB, and the 60 s budget runs out near N." Grouping guidance quotes the bulk, grouped and named-module numbers for 1,000 providers on both compilers. The stale binder sentence and the "classic still fails the 1,000-call named registration case" sentences are removed.

**D7. The warm control.** `controlScaleSource(count)` is `import { DiBag } from '../src'; const seed: unknown = DiBag;` followed by `declare const builder: { register(more: object): typeof builder; build(): { resolve(key: string): number } };` and `count` `.register({ svcN: () => N })` calls. Importing `src` puts the library in the program so the checker visits it first, exactly as in the library cases. It lives in `tests/compiler.ts` next to `scaleSource` so a test can pin its shape.

**D8. Native project reuse.** `scripts/native-scale.ts` gains `compileGeneratedNative(root, compiler, { fileName, source })`, the temporary-project half of `nativeScale`, and `nativeScale` calls it. The ceiling script uses it for every form, including the two the matrix does not know. Existing rows keep every key (`tests/native-compiler.test.ts`, `tests/compiler-case.test.ts` match on them).

**D9. Native defaults.** The native lane keeps the fixed limits, so its ceiling is where a probe exceeds 60 s or 3,072 MiB; the classification says `timeout` or `memory`, and the page says "budget", not "crash". Recommended ranges in Task 4: classic `--from 500 --to 1500`, native `--from 1000 --to 2500`; `named-modules` as a point measurement (`--from 1000 --to 1000 --repeats 1`) on both lanes, which is how the grouping guidance gets its numbers.

**D10. Names.** `CeilingForm`, `ceilingForms`, `FailureKind`, `ProbeResult`, `CeilingOutcome`, `CeilingSearch`, `bisectCeiling`, `classifyFailure`, `classicProbe`, `nativeProbe`, `ceilingSource`, `parseCeilingArguments`; in `tests/compiler.ts`: `controlScaleSource`, `namedModuleScaleSource`. Row `type` values: `header`, `probe`, `attribution`, `summary`, `complete`.

### Rejected alternatives

- **Relaxing the matrix worker to any count.** It would blur the accepted-matrix contract that `parseCompilerCase`, `tests/compiler-case.test.ts` and the compiler controls rely on.
- **A second bisection axis over `--stack-size`** (the smallest stack at which each form passes a fixed count). Precise, but users cannot change the stack, and the calls axis with a warm control already answers attribution.
- **Changing `register`/`replace` types up front.** The findings show the per-call cost is TypeScript's; any change would buy at most the innermost constant and risk the diagnostic text that 77 fixtures pin. Hence D5.
- **A summary-to-Markdown generator.** The page is edited by hand today; a generator for one table per run is more code than the transcription it saves.
- **An AGENTS.md rule about chain length.** The file is at budget, and the limit is far above what an agent writes by hand; the README bullet links the page.

### File structure

- Create: `scripts/benchmark-compiler-ceiling.ts` (worker, probes, classification, bisection, CLI, evidence).
- Create: `tests/benchmark-compiler-ceiling.test.ts` (generator pins, bisection and classification units, worker smoke, CLI rejection).
- Modify: `tests/compiler.ts` (add `controlScaleSource`, `namedModuleScaleSource`), `tests/type-scale.test.ts` (import the moved generator).
- Modify: `scripts/native-scale.ts` (extract `compileGeneratedNative`), `tests/native-compiler.test.ts` (one test).
- Modify: `scripts/test-lane.mjs` (lane membership), `package.json` (script).
- Modify: `docs/benchmarks/typescript.md`, `README.md:245-248`, `docs/guides/development.md:109-133`.
- Conditionally modify (Task 5): `src/di-bag.ts:364-369`, regenerated `docs/reference/**`.

---

### Task 1: Generators — the warm control and the named-module form in `tests/compiler.ts`

**Files:**
- Modify: `tests/compiler.ts` (append after `tokenScaleBoundaryLine`, line 214)
- Modify: `tests/type-scale.test.ts:2,24-49` (import the moved generator, delete the private one)
- Modify: `scripts/test-lane.mjs:6-11` (add `'benchmark-compiler-ceiling'` to `compilerLane`)
- Create: `tests/benchmark-compiler-ceiling.test.ts`

**Interfaces:**
- Produces: `export function controlScaleSource(count: number): string` and `export function namedModuleScaleSource(count: number, scenario?: ScaleCase): string` in `tests/compiler.ts`. `ScaleForm` is unchanged (the matrix must keep rejecting the new forms).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/benchmark-compiler-ceiling.test.ts
import { expect, test } from 'bun:test';
import { controlScaleSource, describeDiagnostic, diagnostics, namedModuleScaleSource, scalePath } from './compiler';

test('the control chain imports the library so the checker is warm, then registers count times', () => {
  const source = controlScaleSource(3);
  expect(source.startsWith("import { DiBag } from '../src';\nconst seed: unknown = DiBag;\n")).toBe(true);
  // The first call shares the `const bag = builder` line, so count dotted calls, not line starts.
  expect(source.match(/\.register\(/g)).toHaveLength(3);
  expect(source).toContain("bag.resolve('svc2')");
  expect(source).not.toContain('createBuilder');
  expect(() => controlScaleSource(0)).toThrow('control scale count must be at least one');
});

test('the control chain compiles clean', () => {
  expect(diagnostics(scalePath, controlScaleSource(5)).map(describeDiagnostic)).toEqual([]);
}, 60_000);

test('named modules hold 50 providers each and the fault sits in the last module', () => {
  const valid = namedModuleScaleSource(120);
  expect(valid.match(/^const feature\d+ = /gm)).toHaveLength(3);
  expect(valid.match(/\.installModule\(feature\d+\)/g)).toHaveLength(3);
  expect(valid).toContain("bag.resolve('svc60')");
  expect(valid).toContain("bag.resolve('svc119')");
  expect(valid).toContain("reused.resolve('svc49')");
  expect(namedModuleScaleSource(120, 'missing')).toContain('svc100: ({ missingFinal }: { missingFinal: number })');
  expect(namedModuleScaleSource(120, 'wrong-shape')).toContain('svc100: ({ svc99 }: { svc99: string })');
  expect(namedModuleScaleSource(1000, 'missing')).toContain('svc950: ({ missingFinal }');
  expect(() => namedModuleScaleSource(49)).toThrow('named module scale count must be at least 50');
  expect(() => namedModuleScaleSource(50, 'missing')).toThrow('negative named module scenarios need at least two modules');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/benchmark-compiler-ceiling.test.ts`
Expected: FAIL — `controlScaleSource` and `namedModuleScaleSource` are not exported from `./compiler`.

- [ ] **Step 3: Add the generators**

Append to `tests/compiler.ts`:

```ts
/**
 * A library-free fluent chain of `count` calls. It imports the library without using it so the
 * program contains `src` and the checker visits it first, as it does for every library case:
 * the same chain compiled alone overflows at 575 calls where this one passes at 1,000, because
 * V8's optimized checker frames are smaller than its interpreted ones.
 */
export function controlScaleSource(count: number) {
  if (!Number.isInteger(count) || count < 1) throw new Error('control scale count must be at least one');
  const calls = Array.from({ length: count }, (_, index) => `.register({ svc${index}: () => ${index} })`).join('\n');
  return `import { DiBag } from '../src';
const seed: unknown = DiBag;
declare const builder: { register(more: object): typeof builder; build(): { resolve(key: string): number } };
const bag = builder${calls}.build();
const last: number = bag.resolve('svc${count - 1}');
`;
}

/** `count` linearly dependent providers in reusable named modules of 50, installed into one host; the fault opens the last module. */
export function namedModuleScaleSource(count: number, scenario: ScaleCase = 'valid') {
  if (!Number.isInteger(count) || count < 50) throw new Error('named module scale count must be at least 50');
  const groups = Math.ceil(count / 50);
  if (scenario !== 'valid' && groups < 2) throw new Error('negative named module scenarios need at least two modules');
  const fault = (groups - 1) * 50;
  const modules = Array.from({ length: groups }, (_, group) => {
    const size = Math.min(50, count - group * 50);
    const entries = Array.from({ length: size }, (_, offset) => {
      const index = group * 50 + offset;
      if (index === 0) return 'svc0: () => 1';
      const dependency = scenario === 'missing' && index === fault ? 'missingFinal' : `svc${index - 1}`;
      const shape = scenario === 'wrong-shape' && index === fault ? 'string' : 'number';
      return `svc${index}: ({ ${dependency} }: { ${dependency}: ${shape} }) => ${shape === 'string' ? `${dependency}.length` : `${dependency} + 1`}`;
    });
    const names = Array.from({ length: size }, (_, offset) => `'svc${group * 50 + offset}'`).join(', ');
    return `const feature${group} = DiBag.createBuilder().register({ ${entries.join(',\n')} }).buildModule([${names}]);`;
  });
  return `import { DiBag } from '../src';
${modules.join('\n')}
const bag = DiBag.createBuilder()${modules.map((_, index) => `.installModule(feature${index})`).join('\n')}.build();
const first: number = bag.resolve('svc0');
const middle: number = bag.resolve('svc${Math.floor(count / 2)}');
const last: number = bag.resolve('svc${count - 1}');
const reused = DiBag.createBuilder().installModule(feature0).build();
const reusableResult: number = reused.resolve('svc49');
`;
}
```

For `count = 1000` this reproduces the private generator in `tests/type-scale.test.ts` byte for byte (twenty modules, fault at `svc950`, `middle` at `svc500`).

- [ ] **Step 4: Use it from the type-scale suite**

In `tests/type-scale.test.ts` change line 2 to `import { describeDiagnostic, diagnostics, namedModuleScaleSource, scalePath, scaleSource } from './compiler';`, delete the `namedModuleSource` function (lines 24–45), and in the last loop replace `namedModuleSource(scenario)` with `namedModuleScaleSource(1000, scenario)`.

- [ ] **Step 5: Put the new test file in the compiler lane**

In `scripts/test-lane.mjs` insert `'benchmark-compiler-ceiling', ` before `'benchmark-compiler-controls'` in the `compilerLane` set (the file compiles programs).

- [ ] **Step 6: Run the tests**

Run: `bun test tests/benchmark-compiler-ceiling.test.ts tests/type-scale.test.ts tests/test-lanes.test.ts`
Expected: PASS. `type-scale` still reports the same three named-module tests green (the 1,000 case takes tens of seconds on classic; the suite timeout is 120 s).

Run: `npm run typecheck && npm run test:fast`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tests/compiler.ts tests/type-scale.test.ts tests/benchmark-compiler-ceiling.test.ts scripts/test-lane.mjs
git commit -m "test(compiler): share the named-module generator and add a warm library-free control chain"
```

---

### Task 2: `compileGeneratedNative` — the native project builder the ceiling mode can call

**Files:**
- Modify: `scripts/native-scale.ts` (whole file, 35 lines)
- Modify: `tests/native-compiler.test.ts` (append one test)

**Interfaces:**
- Produces: `export type NativeGenerated = { fileName: 'generated-type-scale.ts' | 'generated-token-scale.ts'; source: string }` and `export async function compileGeneratedNative(root: string, compiler: NativeCompiler, generated: NativeGenerated)` returning the `compileNative` result plus `file`, `typescript`, `compiler`, `sourceCommit`, `sourceSha256`, `generatedSha256`, `nativeMetrics`.
- `nativeScale(root, compiler, item)` keeps its signature and every row key.

- [ ] **Step 1: Write the failing test** (append to `tests/native-compiler.test.ts`; add `compileGeneratedNative` to the import from `'../scripts/native-scale.ts'` and `controlScaleSource` to the import from `'./compiler'`)

```ts
test('a generated source outside the matrix compiles in a native project with provenance', async () => {
  const result = await compileGeneratedNative(process.cwd(), await resolveNative(process.cwd()), {
    fileName: 'generated-type-scale.ts', source: controlScaleSource(20),
  });
  expect(result).toMatchObject({ checked: true, status: 0, diagnostics: [], typescript: '7.0.2' });
  expect(result.file.endsWith('/tests/generated-type-scale.ts')).toBe(true);
  expect(result.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
  expect(result.generatedSha256).toMatch(/^[0-9a-f]{64}$/);
  expect(result.nativeMetrics.Instantiations).toBeGreaterThan(0);
}, 65000);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test tests/native-compiler.test.ts -t "outside the matrix"`
Expected: FAIL — `compileGeneratedNative` is not exported.

- [ ] **Step 3: Extract the project builder**

Replace `scripts/native-scale.ts` with:

```ts
import { cpSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { scaleSource, scaleBoundaryLine, tokenScaleSource, tokenScaleBoundaryLine } from '../tests/compiler.ts';
import type { ScaleCase, ScaleForm, TokenScaleCase, TokenScaleForm } from '../tests/compiler.ts';
import { acceptDiagnostics, type MatrixCase } from './benchmark-result.ts';
import { compileNative, type NativeCompiler } from './native-compiler.ts';

export type NativeGenerated = { fileName: 'generated-type-scale.ts' | 'generated-token-scale.ts'; source: string };

/** Compile one generated file against a copy of `src` in a temporary native project; the caller decides acceptance. */
export async function compileGeneratedNative(root: string, compiler: NativeCompiler, generated: NativeGenerated) {
  const directory = mkdtempSync(join(tmpdir(), 'di-bag-native-scale-'));
  try {
    cpSync(join(root, 'src'), join(directory, 'src'), { recursive: true });
    mkdirSync(join(directory, 'tests'));
    const file = join(directory, 'tests', generated.fileName);
    writeFileSync(file, generated.source);
    const hash = createHash('sha256');
    const sourceFiles = (folder: string): string[] => readdirSync(join(directory, 'src', folder), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? sourceFiles(join(folder, entry.name)) : [join(folder, entry.name)]);
    for (const source of sourceFiles('').filter(name => name.endsWith('.ts')).sort()) {
      hash.update(source); hash.update(new Uint8Array(readFileSync(join(directory, 'src', source))));
    }
    const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    const result = await compileNative(compiler, directory, [file], { skipLibCheck: true });
    return { ...result, file, typescript: compiler.version, compiler, sourceCommit, sourceSha256: hash.digest('hex'),
      generatedSha256: createHash('sha256').update(generated.source).digest('hex'), nativeMetrics: result.metrics };
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

export async function nativeScale(root: string, compiler: NativeCompiler, item: MatrixCase): Promise<Record<string, unknown>> {
  const tokens = item.form === 'bindings' || item.form === 'modules';
  const source = tokens ? tokenScaleSource(item.count, item.form as TokenScaleForm, item.scenario as TokenScaleCase)
    : scaleSource(item.count, item.form as ScaleForm, item.scenario as ScaleCase);
  const boundaryLine = tokens ? tokenScaleBoundaryLine(source) : scaleBoundaryLine(source, item.count, item.form as ScaleForm, item.scenario as ScaleCase);
  const { file, ...result } = await compileGeneratedNative(root, compiler, { fileName: tokens ? 'generated-token-scale.ts' : 'generated-type-scale.ts', source });
  const accepted = result.checked && acceptDiagnostics(result.diagnostics, item, file, boundaryLine);
  return { ...item, ...result, accepted, boundaryLine,
    ...(!accepted ? { failureReason: !result.checked ? 'native process or output did not pass checked completion' : 'native diagnostics did not satisfy original boundary contract' } : {}) };
}
```

The row keys are the same as before (`...item`, the `compileNative` result, `accepted`, `boundaryLine`, `typescript`, `compiler`, `sourceCommit`, `sourceSha256`, `generatedSha256`, `nativeMetrics`, optional `failureReason`); only `file` is held back, as before.

- [ ] **Step 4: Run the native suites**

Run: `bun test tests/native-compiler.test.ts tests/compiler-case.test.ts`
Expected: PASS, including the four 1,000-operation native tests and the two `native selected 100 bulk` rows (Linux only).

Run: `npm run typecheck && npm run test:fast`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/native-scale.ts tests/native-compiler.test.ts
git commit -m "chore(benchmark): extract the native temporary project so any generated source can be supervised"
```

---

### Task 3: `scripts/benchmark-compiler-ceiling.ts` — worker, probes, classification, bisection, CLI, evidence

**Files:**
- Create: `scripts/benchmark-compiler-ceiling.ts`
- Modify: `package.json` (add `"benchmark:compiler-ceiling"` after `"benchmark:compiler-controls"`)
- Modify: `tests/benchmark-compiler-ceiling.test.ts` (append)

**Interfaces:**
- Consumes: `controlScaleSource`, `namedModuleScaleSource`, `scaleSource`, `compilerProgram`, `describeDiagnostic`, `scalePath` (Task 1); `compileGeneratedNative` (Task 2); `resolveNative`, `nativeLimits`, `NativeCompiler` (`scripts/native-compiler.ts`).
- Produces (exported, tested): `CeilingForm`, `ceilingForms`, `FailureKind`, `ProbeResult`, `CeilingOutcome`, `ceilingSource(count, form)`, `stackSizeKiB(execArgv)`, `classifyFailure(child)`, `classicProbe(root, count, form, stackKiB?)`, `nativeProbe(root, compiler, count, form)`, `bisectCeiling(probe, options)`, `parseCeilingArguments(args)`, `classicLimits`.
- CLI: `node scripts/benchmark-compiler-ceiling.ts [--native] [--form <f>]... [--from N] [--to M] [--resolution R] [--repeats K] [--stack-size KiB]`; worker: `--worker <count> <form>`.

- [ ] **Step 1: Write the failing tests** (append to `tests/benchmark-compiler-ceiling.test.ts`; add the imports at the top of the file)

```ts
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { bisectCeiling, classicProbe, classifyFailure, parseCeilingArguments, type ProbeResult } from '../scripts/benchmark-compiler-ceiling.ts';

const root = resolve(__dirname, '..');
const script = resolve(root, 'scripts/benchmark-compiler-ceiling.ts');
const failed = (kind: 'stack-overflow' | 'timeout'): ProbeResult => ({ accepted: false, kind });
const options = { from: 500, to: 1500, resolution: 25, repeats: 2 };

test('the bisection brackets a deterministic threshold within the resolution', async () => {
  const counts: number[] = [];
  const search = await bisectCeiling(async count => { counts.push(count); return count <= 700 ? { accepted: true } : failed('stack-overflow'); }, options);
  expect(counts).toEqual([500, 500, 1500, 1000, 750, 625, 625, 687, 687, 718, 702]);
  expect(search).toMatchObject({ largestAccepted: 687, smallestFailed: 702, failureKind: 'stack-overflow', flaky: [], largestAcceptedSample: { accepted: true } });
  expect(search.samples.map(sample => sample.count)).toEqual([500, 1500, 1000, 750, 625, 687, 718, 702]);
});

test('a count that fails on a later repeat is conservative and reported as flaky', async () => {
  let seen = 0;
  const search = await bisectCeiling(async count => {
    if (count === 687 && ++seen === 2) return failed('stack-overflow');
    return count <= 700 ? { accepted: true } : failed('stack-overflow');
  }, options);
  expect(search).toMatchObject({ largestAccepted: 671, smallestFailed: 687, flaky: [687] });
});

test('endpoints end the search early and a point range probes once', async () => {
  const low = await bisectCeiling(async () => failed('timeout'), options);
  expect(low.largestAccepted).toBeUndefined();
  expect(low).toMatchObject({ smallestFailed: 500, failureKind: 'timeout' });
  expect(low.samples).toHaveLength(1);
  const high = await bisectCeiling(async () => ({ accepted: true }), options);
  expect(high.smallestFailed).toBeUndefined();
  expect(high.largestAccepted).toBe(1500);
  expect(high.samples.map(sample => sample.count)).toEqual([500, 1500]);
  const point = await bisectCeiling(async () => ({ accepted: true }), { ...options, from: 1000, to: 1000, repeats: 1 });
  expect(point.samples).toEqual([{ count: 1000, results: [{ accepted: true }] }]);
  for (const bad of [{ from: 0 }, { to: 400 }, { resolution: 0 }, { repeats: 1.5 }]) {
    await expect(bisectCeiling(async () => ({ accepted: true }), { ...options, ...bad })).rejects.toThrow('invalid ceiling search');
  }
});

test('failure kinds are classified from the child evidence', () => {
  const child = { status: 1 as number | null, signal: null as string | null, stderr: '', timedOut: false, terminationReason: undefined as string | undefined, diagnosticCount: undefined as number | undefined };
  expect(classifyFailure({ ...child, timedOut: true })).toBe('timeout');
  expect(classifyFailure({ ...child, terminationReason: 'timeout' })).toBe('timeout');
  expect(classifyFailure({ ...child, terminationReason: 'memory' })).toBe('memory');
  expect(classifyFailure({ ...child, terminationReason: 'output' })).toBe('output');
  expect(classifyFailure({ ...child, stderr: 'RangeError: Maximum call stack size exceeded\n    at checkExpression' })).toBe('stack-overflow');
  expect(classifyFailure({ ...child, stderr: 'FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory' })).toBe('heap');
  expect(classifyFailure({ ...child, status: 0, diagnosticCount: 2 })).toBe('diagnostics');
  expect(classifyFailure({ ...child, signal: 'SIGKILL' })).toBe('crash');
});

test('arguments select lane, forms and search bounds, and reject anything else', () => {
  expect(parseCeilingArguments([])).toEqual({ lane: 'classic', forms: ['chained', 'replacement', 'control', 'named-modules'], from: 500, to: 1500, resolution: 25, repeats: 3, stackKiB: 4000 });
  expect(parseCeilingArguments(['--native', '--form', 'control', '--from', '1000', '--to', '1000', '--repeats', '1'])).toMatchObject({ lane: 'native', forms: ['control'], from: 1000, to: 1000, repeats: 1 });
  for (const args of [['--form'], ['--form', 'bulk'], ['--form', 'chained', '--form', 'chained'], ['--from', '600', '--to', '500'], ['--repeats', '0'], ['--stack-size', 'big'], ['--unknown']]) {
    expect(() => parseCeilingArguments(args)).toThrow('invalid ceiling arguments');
  }
});

for (const [count, form] of [[20, 'chained'], [20, 'replacement'], [20, 'control'], [100, 'named-modules']] as const) {
  test(`ceiling worker compiles ${count} ${form} and reports its metrics`, () => {
    const child = spawnSync(process.execPath, ['--stack-size=1200', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', script, '--worker', String(count), form],
      { cwd: root, encoding: 'utf8', timeout: 60_000, maxBuffer: 1024 * 1024 });
    expect({ status: child.status, signal: child.signal, stderr: child.stderr }).toEqual({ status: 0, signal: null, stderr: '' });
    const row = JSON.parse(child.stdout);
    expect(row).toMatchObject({ count, form, typescript: '6.0.3', stackKiB: 1200, diagnosticCount: 0, codes: [] });
    expect(row.instantiations).toBeGreaterThan(0);
    expect(row.maxRssMiB).toBeGreaterThan(0);
  }, 65_000);
}

test('a classic probe returns an accepted outcome with metrics for a small chain', () => {
  const outcome = classicProbe(root, 20, 'chained');
  expect(outcome).toMatchObject({ lane: 'classic', form: 'chained', count: 20, accepted: true, diagnosticCount: 0, stderrHead: '' });
  expect(outcome.stackKiB).toBeUndefined();
  expect(outcome.instantiations).toBeGreaterThan(0);
}, 65_000);

test('ceiling worker and CLI reject malformed cases before compiling', () => {
  for (const args of [['--worker', '20'], ['--worker', 'x', 'chained'], ['--worker', '20', 'bulk'], ['--worker', '20', 'chained', 'extra']]) {
    const child = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', script, ...args], { cwd: root, encoding: 'utf8', timeout: 10_000 });
    expect(child.status).not.toBe(0); expect(child.stdout).toBe(''); expect(child.stderr).toContain('invalid ceiling case');
  }
  const cli = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', script, '--bogus'], { cwd: root, encoding: 'utf8', timeout: 10_000 });
  expect(cli.status).not.toBe(0); expect(cli.stdout).toBe(''); expect(cli.stderr).toContain('invalid ceiling arguments');
});
```

The end-to-end CLI is deliberately not run under test: a run writes into `docs/benchmarks/results/` and takes minutes. Task 4 exercises it.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/benchmark-compiler-ceiling.test.ts`
Expected: FAIL — the module `../scripts/benchmark-compiler-ceiling.ts` does not exist.

- [ ] **Step 3: Write the script**

```ts
// scripts/benchmark-compiler-ceiling.ts
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { cpus, release, totalmem } from 'node:os';
import { basename, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import ts from 'typescript';
import { compilerProgram, controlScaleSource, describeDiagnostic, namedModuleScaleSource, scalePath, scaleSource } from '../tests/compiler.ts';
import { nativeLimits, resolveNative, type NativeCompiler } from './native-compiler.ts';
import { compileGeneratedNative } from './native-scale.ts';

/**
 * Informational ceiling search: the largest single-expression call count each compiler accepts per form,
 * with every failure classified and a classic stack overflow attributed by one rerun on a larger V8 stack.
 * Not a gate: the number moves with JIT state and host load (docs/benchmarks/typescript.md).
 */
export type CeilingForm = 'chained' | 'replacement' | 'control' | 'named-modules';
export const ceilingForms: readonly CeilingForm[] = ['chained', 'replacement', 'control', 'named-modules'];
export type CeilingLane = 'classic' | 'native';
export type FailureKind = 'stack-overflow' | 'heap' | 'timeout' | 'memory' | 'output' | 'diagnostics' | 'crash';
export type ProbeResult = { accepted: true } | { accepted: false; kind: FailureKind };
export type CeilingOutcome = ProbeResult & {
  lane: CeilingLane; form: CeilingForm; count: number; stackKiB: number | undefined;
  milliseconds: number; compileMilliseconds: number | undefined; maxRssMiB: number | undefined;
  instantiations: number | undefined; diagnosticCount: number | undefined; stderrHead: string;
};
export type CeilingSearchOptions = { from: number; to: number; resolution: number; repeats: number };
export type CeilingSearch<R extends ProbeResult> = CeilingSearchOptions & {
  largestAccepted: number | undefined; largestAcceptedSample: R | undefined;
  smallestFailed: number | undefined; failureKind: FailureKind | undefined;
  flaky: number[]; samples: Array<{ count: number; results: R[] }>;
};
export type CeilingOptions = CeilingSearchOptions & { lane: CeilingLane; forms: CeilingForm[]; stackKiB: number };
export type ChildEvidence = {
  status: number | null; signal: string | null; stderr: string; timedOut: boolean;
  terminationReason: string | undefined; diagnosticCount: number | undefined;
};

// The same budget the matrix worker runs under (scripts/compiler-case.ts).
export const classicLimits = { timeoutMilliseconds: 60_000, maxOldSpaceMiB: 3072 } as const;

export function ceilingSource(count: number, form: CeilingForm): string {
  if (form === 'control') return controlScaleSource(count);
  if (form === 'named-modules') return namedModuleScaleSource(count, 'valid');
  return scaleSource(count, form, 'valid');
}

export function stackSizeKiB(execArgv: readonly string[]): number | undefined {
  const flag = execArgv.find(argument => argument.startsWith('--stack-size='));
  return flag === undefined ? undefined : Number(flag.slice('--stack-size='.length));
}

export function classifyFailure(child: ChildEvidence): FailureKind {
  if (child.timedOut || child.terminationReason === 'timeout') return 'timeout';
  if (child.terminationReason === 'memory') return 'memory';
  if (child.terminationReason === 'output') return 'output';
  if (child.stderr.includes('Maximum call stack size exceeded')) return 'stack-overflow';
  if (/heap out of memory|Allocation failed/i.test(child.stderr)) return 'heap';
  if (child.signal === null && child.diagnosticCount !== undefined && child.diagnosticCount > 0) return 'diagnostics';
  return 'crash';
}

const head = (text: string) => text.split('\n').slice(0, 12).join('\n');

export function classicProbe(root: string, count: number, form: CeilingForm, stackKiB?: number): CeilingOutcome {
  const child = spawnSync(process.execPath, [
    ...(stackKiB === undefined ? [] : [`--stack-size=${stackKiB}`]),
    `--max-old-space-size=${classicLimits.maxOldSpaceMiB}`, '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
    resolve(root, 'scripts/benchmark-compiler-ceiling.ts'), '--worker', String(count), form,
  ], { cwd: root, encoding: 'utf8', timeout: classicLimits.timeoutMilliseconds, maxBuffer: 4_194_304 });
  let row: Record<string, unknown> = {};
  try { row = JSON.parse(child.stdout) as Record<string, unknown>; } catch { /* a crashed or killed worker prints nothing */ }
  const number = (key: string) => typeof row[key] === 'number' ? row[key] as number : undefined;
  const diagnosticCount = number('diagnosticCount');
  const completed = child.status === 0 && child.signal === null && child.error === undefined && child.stderr === '';
  const accepted = completed && row.count === count && row.form === form && diagnosticCount === 0;
  const base = {
    lane: 'classic' as const, form, count, stackKiB, milliseconds: number('milliseconds') ?? 0, compileMilliseconds: number('milliseconds'),
    maxRssMiB: number('maxRssMiB'), instantiations: number('instantiations'), diagnosticCount, stderrHead: head(child.stderr),
  };
  if (accepted) return { ...base, accepted: true };
  return { ...base, accepted: false, kind: classifyFailure({
    status: child.status, signal: child.signal, stderr: child.stderr, terminationReason: undefined, diagnosticCount,
    timedOut: (child.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT',
  }) };
}

export async function nativeProbe(root: string, compiler: NativeCompiler, count: number, form: CeilingForm): Promise<CeilingOutcome> {
  const result = await compileGeneratedNative(root, compiler, { fileName: 'generated-type-scale.ts', source: ceilingSource(count, form) });
  const diagnosticCount = result.checked ? result.diagnostics.length : undefined;
  const accepted = result.checked && result.status === 0 && result.diagnostics.length === 0;
  const totalSeconds = result.metrics['Total time'];
  const base = {
    lane: 'native' as const, form, count, stackKiB: undefined, milliseconds: result.milliseconds,
    compileMilliseconds: totalSeconds === undefined ? undefined : Math.round(totalSeconds * 1000),
    maxRssMiB: Math.round(result.peakObservedRssMiB), instantiations: result.metrics.Instantiations, diagnosticCount, stderrHead: head(result.stderr),
  };
  if (accepted) return { ...base, accepted: true };
  return { ...base, accepted: false, kind: classifyFailure({
    status: result.status, signal: result.signal, stderr: result.stderr, timedOut: false, terminationReason: result.terminationReason, diagnosticCount,
  }) };
}

/**
 * Probe both bounds, then halve the bracket until it is at most `resolution` wide. A count passes only when
 * every repeat is accepted; the first failed repeat ends it. `largestAccepted` is conservative by construction.
 */
export async function bisectCeiling<R extends ProbeResult>(probe: (count: number) => Promise<R>, options: CeilingSearchOptions): Promise<CeilingSearch<R>> {
  const { from, to, resolution, repeats } = options;
  if (![from, to, resolution, repeats].every(value => Number.isInteger(value) && value > 0) || to < from) throw new Error('invalid ceiling search');
  const search: CeilingSearch<R> = { from, to, resolution, repeats, largestAccepted: undefined, largestAcceptedSample: undefined, smallestFailed: undefined, failureKind: undefined, flaky: [], samples: [] };
  const passes = async (count: number): Promise<boolean> => {
    const results: R[] = [];
    for (let index = 0; index < repeats; index += 1) {
      const result = await probe(count);
      results.push(result);
      if (!result.accepted) break;
    }
    search.samples.push({ count, results });
    const last = results.at(-1)!;
    if (last.accepted) {
      if (search.largestAccepted === undefined || count > search.largestAccepted) { search.largestAccepted = count; search.largestAcceptedSample = last; }
      return true;
    }
    if (results.length > 1) search.flaky.push(count);
    if (search.smallestFailed === undefined || count < search.smallestFailed) { search.smallestFailed = count; search.failureKind = (last as { kind: FailureKind }).kind; }
    return false;
  };
  if (!(await passes(from)) || from === to || await passes(to)) return search;
  let low = from, high = to;
  while (high - low > resolution) {
    const middle = low + Math.floor((high - low) / 2);
    if (await passes(middle)) low = middle; else high = middle;
  }
  return search;
}

const numericFlags = { '--from': 'from', '--to': 'to', '--resolution': 'resolution', '--repeats': 'repeats', '--stack-size': 'stackKiB' } as const;

export function parseCeilingArguments(args: readonly string[]): CeilingOptions {
  const options: CeilingOptions = { lane: 'classic', forms: [], from: 500, to: 1500, resolution: 25, repeats: 3, stackKiB: 4000 };
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]!;
    if (flag === '--native') { options.lane = 'native'; continue; }
    const value = args[index + 1];
    index += 1;
    if (flag === '--form') {
      const form = ceilingForms.find(candidate => candidate === value);
      if (!form || options.forms.includes(form)) throw new Error('invalid ceiling arguments');
      options.forms.push(form);
      continue;
    }
    const key = Object.hasOwn(numericFlags, flag) ? numericFlags[flag as keyof typeof numericFlags] : undefined;
    if (!key || value === undefined || !/^\d+$/.test(value) || Number(value) < 1) throw new Error('invalid ceiling arguments');
    options[key] = Number(value);
  }
  if (options.forms.length === 0) options.forms = [...ceilingForms];
  if (options.to < options.from) throw new Error('invalid ceiling arguments');
  return options;
}

async function main() {
  const options = parseCeilingArguments(process.argv.slice(2));
  const root = process.cwd();
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const sourceStatus = execFileSync('git', ['status', '--porcelain', '--', 'src'], { cwd: root, encoding: 'utf8' }).trim();
  const native = options.lane === 'native' ? await resolveNative(root) : undefined;
  const utc = new Date().toISOString();
  const directory = resolve(root, 'docs/benchmarks/results', `${utc.slice(0, 10)}-${commit.slice(0, 7)}`);
  const evidencePath = resolve(directory, `compiler-ceiling-${utc.replaceAll(':', '-')}.jsonl`);
  mkdirSync(directory, { recursive: true });
  const record = (entry: Record<string, unknown>) => { const line = JSON.stringify(entry); appendFileSync(evidencePath, `${line}\n`); console.log(line); };
  record({
    schema: 1, type: 'header', status: 'informational', utc, commit, sourceStatus, lane: options.lane,
    typescript: native?.version ?? ts.version, ...(native ? { compiler: native } : {}), node: process.version,
    host: { platform: process.platform, release: release(), arch: process.arch, cpus: cpus().length, memoryMiB: Math.round(totalmem() / 1048576) },
    limits: native ? nativeLimits : classicLimits, options,
    note: 'Informational. A count passes only when every repeat is accepted. Attribution reruns a classic stack overflow once on a larger V8 stack; that stack is not a supported configuration.',
  });
  const summaries: Record<string, unknown>[] = [];
  for (const form of options.forms) {
    const search = await bisectCeiling(async count => {
      const outcome = native ? await nativeProbe(root, native, count, form) : classicProbe(root, count, form);
      record({ schema: 1, type: 'probe', ...outcome });
      return outcome;
    }, options);
    const { samples, ...rest } = search;
    let attribution: 'v8-stack-budget' | 'not-stack-budget' | undefined;
    if (!native && search.smallestFailed !== undefined && search.failureKind === 'stack-overflow') {
      const outcome = classicProbe(root, search.smallestFailed, form, options.stackKiB);
      record({ schema: 1, type: 'attribution', ...outcome });
      attribution = outcome.accepted ? 'v8-stack-budget' : 'not-stack-budget';
    }
    const summary = { schema: 1, type: 'summary', lane: options.lane, form, ...rest, probes: samples.length, ...(attribution ? { attribution } : {}) };
    record(summary);
    summaries.push(summary);
  }
  record({ schema: 1, type: 'complete', forms: summaries.length, evidence: relative(root, evidencePath) });
}

if (process.argv[2] === '--worker') {
  const count = Number(process.argv[3]);
  const form = ceilingForms.find(candidate => candidate === process.argv[4]);
  if (process.argv.length !== 5 || !form || !Number.isInteger(count) || count < 1) throw new Error('invalid ceiling case');
  const source = ceilingSource(count, form);
  const start = performance.now();
  const program = compilerProgram(scalePath, source);
  const errors = ts.getPreEmitDiagnostics(program).map(describeDiagnostic);
  console.log(JSON.stringify({
    count, form, typescript: ts.version, node: process.version, stackKiB: stackSizeKiB(process.execArgv),
    milliseconds: Math.round(performance.now() - start),
    maxRssMiB: Math.round(process.resourceUsage().maxRSS / 1024),
    instantiations: program.getInstantiationCount(),
    diagnosticCount: errors.length, codes: [...new Set(errors.map(error => error.code))], firstDiagnostic: errors[0],
  }));
} else if (basename(process.argv[1] ?? '') === 'benchmark-compiler-ceiling.ts') {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
```

Two things the executor must not "fix": the worker prints diagnostics counts and exits 0 even with diagnostics (that is how `classifyFailure` reaches `diagnostics`), and `classicProbe` reports `milliseconds: 0` for a worker that printed nothing (a crash has no compile time; the parent's wall time is not a compile time).

- [ ] **Step 4: Add the npm script**

In `package.json`, after the `"benchmark:compiler-controls"` line insert:

```json
    "benchmark:compiler-ceiling": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/benchmark-compiler-ceiling.ts",
```

- [ ] **Step 5: Run the tests**

Run: `bun test tests/benchmark-compiler-ceiling.test.ts`
Expected: PASS (the four worker cases take 1–3 s each).

Run: `npm run typecheck && npm run test:fast`
Expected: PASS. If `typecheck` reports that `last.kind` or `options[key]` does not type-check, keep the shapes above and add the narrowing cast shown; do not widen `CeilingOptions`.

- [ ] **Step 6: Smoke the CLI once, then delete its output**

Run: `npm run benchmark:compiler-ceiling -- --form control --from 20 --to 20 --repeats 1`
Expected: five JSON lines on stdout (`header`, `probe`, `summary` with `largestAccepted: 20`, `complete`) and the same lines in the file named by `complete.evidence`. Then `rm -r docs/benchmarks/results` so the smoke run is not mistaken for evidence; `git status` must show no file under `docs/benchmarks/`.

- [ ] **Step 7: Commit**

```bash
git add scripts/benchmark-compiler-ceiling.ts package.json tests/benchmark-compiler-ceiling.test.ts
git commit -m "feat(benchmark): bisect the single-expression compiler ceiling per form with failure attribution"
```

---

### Task 4: Measure the ceilings on both compilers and decide Task 5

No source changes. The deliverable is four evidence files, their `summary` lines copied into the session scratchpad, and a recorded go/no-go for Task 5. Linux only. Budget 45 minutes of machine time; run nothing else heavy meanwhile (host load moves the number, Finding 1).

**Files:**
- Read: evidence under `docs/benchmarks/results/<date>-<commit7>/compiler-ceiling-*.jsonl` (untracked; never `git add`)
- Write: `<scratchpad>/ceiling-summaries.jsonl` (the eight `summary` lines, for Task 6)

- [ ] **Step 1: Preconditions**

Run: `git status --porcelain -- src` (must print nothing) and `git rev-parse --short HEAD` (record it; the evidence directory carries it). Confirm `node --version` is v24 and `bun --version` prints; confirm `uname -s` is `Linux`.

- [ ] **Step 2: Classic ceilings**

Run, one after the other:

```sh
npm run benchmark:compiler-ceiling -- --form control --form chained --form replacement --from 500 --to 1500
npm run benchmark:compiler-ceiling -- --form named-modules --from 1000 --to 1000 --repeats 1
```

Expected: the first prints a `summary` per form. From the findings: `control` and `chained` with `largestAccepted` in 1,000–1,125 and `smallestFailed` at most 1,250 with `failureKind: 'stack-overflow'` and `attribution: 'v8-stack-budget'`; `replacement` with `largestAccepted` in 750–1,000 and `smallestFailed` at most 1,000, same kind and attribution. Each `chained` or `replacement` probe near 1,000 takes 35–60 s; expect 15–25 minutes in total. The second run prints one `probe` (accepted, about 3–5 s, under 1 GiB) and a `summary` with `largestAccepted: 1000`.

If a `summary` shows `attribution: 'not-stack-budget'`, rerun that form with `--stack-size 8000 --from <largestAccepted> --to <smallestFailed>`; if it still fails on the larger stack, the failure is not stack-bound and Task 5 runs regardless of the gap (its Step 2 identifies the frames).

If any `flaky` list is non-empty, keep the run (the conservative rule already excluded those counts) and mention the flaky counts on the page (Task 6).

- [ ] **Step 3: Native ceilings**

Run:

```sh
npm run benchmark:compiler-ceiling -- --native --form control --form chained --form replacement --from 1000 --to 2500
npm run benchmark:compiler-ceiling -- --native --form named-modules --from 1000 --to 1000 --repeats 1
```

Expected: no `stack-overflow` anywhere (Finding 5). `chained` and `replacement` end with `failureKind: 'timeout'` or `'memory'`, which is the 60 s / 3,072 MiB budget of `nativeLimits`, and `largestAccepted` somewhere in 1,000–2,000; `control` may pass at 2,500 (`smallestFailed` undefined). About 10–15 minutes.

- [ ] **Step 4: Collect the summaries**

Run: `grep -h '"type":"summary"' docs/benchmarks/results/*/compiler-ceiling-*.jsonl > <scratchpad>/ceiling-summaries.jsonl && wc -l <scratchpad>/ceiling-summaries.jsonl`
Expected: 8 lines (four forms × two lanes). Also copy the `header` line of one classic and one native file (host, compiler identities, limits) next to them; Task 6 quotes them.

- [ ] **Step 5: Decide Task 5**

For `chained` and for `replacement` on the classic lane compute `gap = control.largestAccepted − form.largestAccepted`. Task 5 runs if, for either form, all of: `failureKind === 'stack-overflow'`, `attribution === 'v8-stack-budget'`, `gap ≥ 200`. Otherwise Task 5 is skipped and the page records the gap as the measured cost of DI Bag's types (Task 6). Write the decision and the two gaps on the first line of `<scratchpad>/ceiling-summaries.jsonl` as a JSON comment line `{"decision":"task-5-<run|skipped>","gapChained":N,"gapReplacement":M}`; Task 7 puts it in the PR description. This plan file is not edited.

Leave the evidence directory in place until Task 6 has transcribed it; `git status` will list it as untracked, which is expected.

---

### Task 5 (conditional): One bounded experiment on the innermost admission of `register`

Run only under the Task 4 Step 5 condition. Time box: half a day. Outcome is either a kept change with evidence, or a recorded rejection with evidence; both are success. The candidate targets the one frame DI Bag owns at the bottom of the descent: contextual typing of the innermost argument (Finding 3). It does not touch `replace`: in the replacement form the innermost call is the bulk `register`.

**Files:**
- Modify: `src/di-bag.ts:364-369` (the named-map `register` overload)
- Regenerate: `docs/reference/**`, `docs/reference/api-coverage.json` (`npm run docs:generate`) if the change is kept
- Read: `tests/types/negative/*.ts` markers; `tests/incremental-scale.test.ts` ceilings (chained 810,000; replacement 1,060,000; bindings 870,000; modules 1,275,000 instantiations)

- [ ] **Step 1: Size DI Bag's constant in stack terms before touching anything**

For the failing form's `smallestFailed` count `S` (from the summary), find the smallest stack at which the form passes and the smallest at which the control passes at the same count. Run each of these in turn until the first accepted outcome, largest stack first, then narrow:

```sh
for k in 4000 2000 1500 1200 1000; do node --stack-size=$k --max-old-space-size=3072 --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/benchmark-compiler-ceiling.ts --worker S replacement > /dev/null 2>&1 && echo "replacement passes at $k KiB"; done
for k in 4000 2000 1500 1200 1000; do node --stack-size=$k --max-old-space-size=3072 --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/benchmark-compiler-ceiling.ts --worker S control > /dev/null 2>&1 && echo "control passes at $k KiB"; done
```

Record both smallest passing stacks. If the form needs less than 15 % more stack than the control at the same count, DI Bag's constant is inside the JIT noise band already documented; stop here, record "rejected: constant under 15 % of the budget" with the two numbers, and go to Task 6. Otherwise continue.

- [ ] **Step 2: Capture the innermost frames**

Run: `node --max-old-space-size=3072 --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/benchmark-compiler-ceiling.ts --worker S replacement 2>&1 >/dev/null | head -14`
Expected: `RangeError: Maximum call stack size exceeded` and the top frames. If the frames are the descent (`checkPropertyAccessExpression ← resolveCallExpression ← …`, as for `chained` at 1,250), the constant is not in contextual typing and the candidate below cannot help: record "rejected: overflow in the descent, no library frame" and go to Task 6. If they are `instantiateInstantiableTypes ↔ map` under `getContextualSignature` (as for `replacement` at 1,000), continue.

- [ ] **Step 3: Apply Candidate A**

Replace `src/di-bag.ts:364-369` with:

```ts
  register<N extends { [K in keyof N]: Registration }>(
    // Graph checks sit on `this`, as on build(): the argument's contextual type then carries only the
    // per-map admissions, which is what the checker instantiates for every property at the bottom of a chain.
    this: Builder<E, C> & ([N] extends [never] ? unknown : IncrementalChecked<E, N> & CheckedConstraints<C, OverrideRegistrations<RegistrationsFromEntries<E>, N>>),
    more: N & Registrations & ([N] extends [never]
      ? never
      : NamedAdmission<N> & ThenableAdmission<N> & IntroducesKeys<EntryKeys<E>, keyof N>),
  ): Builder<E | RegistrationEntries<N>, C>;
```

Nothing else changes: the token overload, `alias`, `replace`, and `installModule` keep their shapes, and the implementation signature is untouched.

- [ ] **Step 4: Kill criteria, in this order; the first failure reverts the change**

1. `npm run typecheck` — clean.
2. `bun test tests/types.test.ts` — every negative fixture still matches its `// diagnostic:` markers; in particular the wrong-shape and missing markers that come from `register` calls must still be reported on the same line. A marker that moved to the method name line is a failure.
3. `npm run check:native` — the native audit reports the same reviewed gaps as before (one, the structural-thenable arity message) and nothing new.
4. `bun test tests/incremental-scale.test.ts tests/type-scale.test.ts tests/benchmark-types.test.ts` — the instantiation ceilings hold and the 100-case boundary tests pass.
5. `npm run docs:generate && npm run docs:check` — the reference regenerates and every AGENTS.md / `docs/agent` snippet still type-checks against the emitted declarations.
6. Measurement: `npm run benchmark:compiler-ceiling -- --form replacement --from <largestAccepted> --to <smallestFailed + 250> --repeats 3` on the changed tree. Keep the change only if the new `largestAccepted` is at least 100 calls above the Task 4 value and the classic matrix's 1,000-call `replacement` valid case is accepted at the default stack (`node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-compiler-case.ts classic 1000 replacement valid` exits 0).

- [ ] **Step 5: Keep or revert**

Keep: `npm run test:fast`, then

```bash
git add src/di-bag.ts docs/reference
git commit -m "perf(types): check register's graph admissions on this, below the argument's contextual type"
```

and add to the design note for the next release chore (in the PR description, not `CHANGELOG.md`): "Changed: the named-map `register` overload reports missing and incompatible dependencies through its `this` context, like `build()`; message text is unchanged." Revert: `git checkout -- src/di-bag.ts docs/reference` and record on the page (Task 6): "Moving the graph admissions of `register` onto `this` was measured on <date>: largest accepted replacement chain <before> → <after>; rejected because <criterion>."

---

### Task 6: Rerun the matrices and rewrite the docs

**Files:**
- Write (scratch): `<scratchpad>/classic-named.jsonl`, `classic-tokens.jsonl`, `native-named.jsonl`, `native-tokens.jsonl`
- Modify: `docs/benchmarks/typescript.md` (whole file)
- Modify: `README.md:245-248` (the "Graph types have a compiler cost" bullet)
- Modify: `docs/guides/development.md:109-133`

Every number below is the 2026-09-18 finding; replace each with the value from Task 4 and this task's runs where they differ. The sentence shapes stay.

- [ ] **Step 1: Run the four matrices on the clean tree** (Linux; about 10–15 minutes; `npm run` prefixes stdout, so call the script directly)

```sh
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/benchmark-types.ts > <scratchpad>/classic-named.jsonl
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/benchmark-types.ts --tokens > <scratchpad>/classic-tokens.jsonl
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/benchmark-types.ts --native > <scratchpad>/native-named.jsonl
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/benchmark-types.ts --native --tokens > <scratchpad>/native-tokens.jsonl
```

Expected: the last line of each file is `{"cases":N,"accepted":M,"failures":[…]}`. From the findings: classic named 36 cases with exactly three failures (`1000 replacement` valid, missing, wrong-shape: `worker did not complete cleanly`), classic tokens 18/18, native named 36/36, native tokens 18/18. A `1000 chained` classic failure would contradict Finding 2; if it appears, check the host load and rerun that row alone with `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-compiler-case.ts classic 1000 chained valid` before writing anything.

- [ ] **Step 2: Tabulate**

Run this once per file to print Markdown rows (valid scenario: time, memory, instantiations; negative scenarios: accepted counts):

```sh
node -e '
const rows = require("fs").readFileSync(process.argv[1], "utf8").trim().split("\n").map(l => JSON.parse(l)).filter(r => r.form);
for (const r of rows.filter(r => r.scenario === "valid")) {
  const neg = rows.filter(o => o.form === r.form && o.count === r.count && o.scenario !== "valid");
  const time = r.nativeMetrics ? r.nativeMetrics["Total time"] : (r.milliseconds ?? 0) / 1000;
  const mem = r.nativeMetrics ? r.peakObservedRssMiB : r.maxRssMiB;
  console.log(`| ${r.form} | ${r.count.toLocaleString("en-US")} | ${r.accepted ? "accepted" : r.failureReason} | ${time ? time.toFixed(1) + " s" : ""} | ${mem ? Math.round(mem).toLocaleString("en-US") + " MiB" : ""} | ${r.instantiations ?? r.nativeMetrics?.Instantiations ?? ""} | ${neg.filter(o => o.accepted).length}/${neg.length} rejected at the boundary |`);
}' <scratchpad>/classic-named.jsonl
```

- [ ] **Step 3: Rewrite `docs/benchmarks/typescript.md`**

Replace the file with the structure below, filling the tables from Step 2 and the ceiling section from `<scratchpad>/ceiling-summaries.jsonl`:

````markdown
# TypeScript compiler scale

DI Bag checks dependency graphs in the type system, so one long fluent
expression costs compiler time, memory, and stack depth. This page records the
measured limits for the pinned compilers, states the limit plainly, and explains
how to reproduce every number.

## The limit, plainly

One fluent expression is bounded by the compiler's recursion budget on V8's
default stack: checking a call chain costs about eleven checker frames per call,
and how many fit depends on whether those functions run as interpreted or
optimized code, so the ceiling is a bracket, not a constant.

- **Classic TypeScript 6.0.3.** A chain of 1,000 `.register()` calls is accepted;
  the chain overflows between 1,000 and 1,250 calls, the same bracket as a
  library-free chain with no generics compiled under the same conditions. A bulk
  map followed by individual `.replace()` calls overflows between 750 and 1,000.
  The overflow is V8's stack budget: the same 1,000-replacement expression passes
  unchanged with a larger stack (`--stack-size=4000`, an attribution instrument,
  not a supported configuration). DI Bag's types add a per-form constant at the
  innermost call — measured as <gapChained> calls for chains and <gapReplacement>
  for replacements — not a per-call cost.
- **Native TypeScript 7.0.2.** No stack ceiling: a 1,000-call chain takes 17 s
  and 1.7 GiB, and the search reaches the 60 s / 3 GiB budget of these
  measurements near <native largestAccepted> calls, with no crash.
- **Budget 500 calls per expression.** Cost is quadratic (0.8 M, 14 M and 54 M
  instantiations for 100, 500 and 1,000 chained calls on either compiler), the
  ceiling moves with JIT state and host load, and editors check the same
  expression on the same stack. Beyond 500, group.

## Grouping guidance, measured

The same 1,000 linearly dependent providers, valid graph, on the recorded host:

| Shape | Classic 6.0.3 | Native 7.0.2 |
| --- | --- | --- |
| One bulk `register({ … })` map | 3.4 s, 573 MiB, 2.5 M instantiations | <native-named.jsonl: bulk 1000 valid> |
| Twenty registration maps of 50, one `register` each | 3.5 s, 638 MiB, 3.5 M | <native-named.jsonl: grouped 1000 valid> |
| Twenty named modules of 50, one `installModule` each | <classic named-modules summary: largestAcceptedSample> | <native named-modules summary: largestAcceptedSample> |
| 1,000 chained `register` calls | 36.7 s, 2,716 MiB, 53.8 M | 17.5 s, 1,719 MiB, 53.8 M |
| Bulk map, then 1,000 `replace` calls | stack overflow at the default stack | <native-named.jsonl: replacement 1000 valid> |

Missing and wrong-shaped dependencies are rejected at the expected boundary in
every grouped and named-module case on both compilers (`tests/type-scale.test.ts`,
and the `grouped` rows below).

## Recorded results

Recorded <date> at <commit7> on <host from the header: platform, cpus, memory>,
Node <version>; one run per row through the matrix (`npm run benchmark:types`).
"Rejected at the boundary" counts the missing and wrong-shape scenarios whose
intended diagnostic occurred exactly once at the generated boundary with no
TS2589.

### Classic 6.0.3

| Form | Operations | Valid graph | Compile | Peak RSS | Instantiations | Negative cases |
| --- | --- | --- | --- | --- | --- | --- |
<Step 2 rows for classic-named.jsonl, then classic-tokens.jsonl>

### Native 7.0.2

| Form | Operations | Valid graph | Total time | Peak RSS | Instantiations | Negative cases |
| --- | --- | --- | --- | --- | --- | --- |
<Step 2 rows for native-named.jsonl, then native-tokens.jsonl>

### Ceilings

Recorded <date> at <commit7> with `npm run benchmark:compiler-ceiling`
(`--from 500 --to 1500` classic, `--from 1000 --to 2500` native, resolution 25,
three repeats per count; a count passes only when every repeat is accepted).

| Form | Classic largest accepted | Classic smallest failed | Failure | Attribution | Native largest accepted | Native smallest failed | Failure |
| --- | --- | --- | --- | --- | --- | --- | --- |
| control (library-free chain) | | | | | | | |
| chained | | | | | | | |
| replacement | | | | | | | |

<If any `flaky` list was non-empty: "Counts <list> passed some repeats and failed others; they count as failed.">
<If Task 5 ran: the one-paragraph keep/reject record from Task 5 Step 5.>

Results are tied to the recorded source and toolchain. Passing these synthetic
cases does not guarantee a particular editor latency, memory use, or arbitrary
graph size.

## Run the benchmarks

Run from the repository root with Node 24 or later:

```sh
npm run benchmark:types
npm run benchmark:types -- --tokens
npm run benchmark:types -- --native
npm run benchmark:types -- --native --tokens
npm run benchmark:compiler-controls
npm run benchmark:compiler-ceiling
npm run benchmark:compiler-ceiling -- --native --from 1000 --to 2500
```

<Keep the existing four paragraphs "The default command runs 36 cases …" through
"… Separate incremental-work tests bound deterministic compiler instantiation
counts." unchanged.>

`benchmark:compiler-ceiling` bisects the largest accepted single-expression call
count per form — `chained`, `replacement`, `control` (a library-free chain that
imports the library so the checker is as warm as in every other case), and
`named-modules` — between `--from` and `--to` (defaults 500 and 1,500) to a
`--resolution` of 25 calls, running each count `--repeats` times (default 3).
Every failure is classified (`stack-overflow`, `heap`, `timeout`, `memory`,
`output`, `diagnostics`, `crash`); a classic stack overflow is rerun once with
`--stack-size` (default 4,000 KiB) and recorded as `v8-stack-budget` when that
passes. `--form <f>` selects forms; `--from N --to N --repeats 1` is a point
measurement. Each classic probe runs in a fresh Node process under the matrix
limits; `--native` supervises the native executable under the Linux limits
described in the [development guide](../guides/development.md#compiler-checks-and-scale).
Benchmark commands write their JSON-lines evidence under
`docs/benchmarks/results/`, named by date and commit; the directory is not
committed, and this page is the record.
````

Delete the old "Supported scale" section entirely (its binder sentence and its "single classic 1,000-call fluent expression remains outside the supported bounds" sentence are both superseded).

- [ ] **Step 4: README bullet** (replace lines 245–248)

```markdown
- **Graph types have a compiler cost.** One fluent expression is bounded by the
  compiler's recursion budget: classic TypeScript 6.0.3 accepts about 1,000
  chained calls and overflows beyond that (about 750–1,000 for a bulk map
  followed by individual replacements); native 7.0.2 has no such ceiling. Keep an
  expression to 500 calls or fewer and use bulk registration, groups, or named
  modules beyond that. See the [compiler evidence](docs/benchmarks/typescript.md).
```

- [ ] **Step 5: Development guide** (replace lines 109–120; add the command)

```markdown
Builders accumulate a flat union of registration entries internally; the public
`Bag<R>` type still takes a registration map. Compile-time acceptance tests cover
100 chained additions, 100 replacements, and 1,000 providers assembled from
reusable registration groups and named modules, including missing and
wrong-shaped dependencies. One fluent expression is bounded by the compiler's
recursion budget on V8's default stack: classic 6.0.3 accepts a 1,000-call chain
and overflows between 1,000 and 1,250 calls, the same bracket as a library-free
chain; a bulk map followed by individual replacements overflows between 750 and
1,000. Native 7.0.2 has no stack ceiling. Budget 500 calls per expression; at
1,000 providers, bulk registration, registration groups of 50, or named modules
of 50 check in about 3.5 s and 0.6 GiB on classic. These are measured brackets
with fixed limits, not a promise about every application or editor session. The
[compiler benchmark guide](../benchmarks/typescript.md) records the measured
limits, the ceiling search, and the benchmark commands.
```

In the command block (lines 124–130) add `npm run benchmark:compiler-ceiling` after `npm run benchmark:compiler-controls`.

- [ ] **Step 6: Check and commit**

Run: `npm run docs:check`
Expected: "Agent docs are consistent" and the site preparation reports every page with no missing documentation link (the page keeps its anchor `#compiler-checks-and-scale` target in the development guide).

Run: `git status --porcelain` — only the three docs files are modified; `docs/benchmarks/results/` is untracked and stays that way; now `rm -r docs/benchmarks/results` so it cannot be added by accident.

```bash
git add docs/benchmarks/typescript.md README.md docs/guides/development.md
git commit -m "docs(benchmarks): state the single-expression compiler ceiling with measured brackets and grouping costs"
```

---

### Task 7: Full gate, PR, issue

- [ ] Run, in order: `npm run typecheck`; `npm run test:fast`; `npm_config_update_notifier=false npm run test:compiler`; `npm run build`; `npm run typecheck:native && npm run build:native && npm run check:native`; `npm run docs:check`; `npm run graph:check`.
- [ ] Expected: all green. `tests/package.test.ts` may time out under load; rerun `bun test tests/package.test.ts` alone before investigating. The compiler lane now includes `tests/benchmark-compiler-ceiling.test.ts` (about 15 s) and the new native test (about 5 s).
- [ ] `git status --porcelain` prints nothing: no `docs/benchmarks/results/`, no `tests/generated-type-scale.ts`, no scratch files. `git diff --stat main` touches only `scripts/`, `tests/`, `package.json`, `README.md`, `docs/benchmarks/typescript.md`, `docs/guides/development.md`, and, only if Task 5 kept its change, `src/di-bag.ts` and `docs/reference/**`.
- [ ] PR body: the "The limit, plainly" bullets from the page; the Task 4 decision line (`task-5-run` or `task-5-skipped` with both gaps); the two commands that reproduce the ceilings; "Closes #29"; the verification line in the style of 2e6602f ("Verified: N fast, N compiler, native typecheck/build/contracts, docs, graph; classic and native matrices and ceilings rerun on <date>."); the changelog block from Task 5 Step 5 if applicable.
- [ ] Issue #29 closing comment (posted when the PR merges): the three "The limit, plainly" bullets, the grouping table, the sentence "The recorded 575-call control was a cold-JIT artifact and the 1,000-call chained failure was stale; the remaining classic failure is V8's stack budget, proven by the larger-stack rerun, and DI Bag's types add a per-form constant of <gapChained>/<gapReplacement> calls, not a per-call cost", and a link to the page.

---

## Risks

1. **The bracket moves.** Finding 1 is the whole point: a loaded host or a different JIT tiering order shifts the ceiling by tens of calls. Task 4 runs alone, with three repeats, and the page states brackets and the reason. Do not "fix" a flaky count by rerunning until it passes; the conservative rule exists for that.
2. **Native budget, not native ceiling.** Past 1,500 calls a native probe exceeds 60 s or 3 GiB; the classification says so. Do not raise `nativeLimits` to find a crash that is not there.
3. **`compileGeneratedNative` row keys.** `tests/native-compiler.test.ts` and `tests/compiler-case.test.ts` match on `typescript`, `checked`, `status`, `diagnostics`, `peakObservedRssMiB`, `sourceCommit`, `sourceSha256`, `generatedSha256`; the extraction must keep every one and hold back only `file`.
4. **`scalePath` is cwd-relative.** The worker must run with `cwd: root` (it does in `classicProbe`); a test that calls `classicProbe` from another directory would compile the wrong path.
5. **Type-scale timing.** `namedModuleScaleSource(1000)` must reproduce the old generator exactly; a change in `middle` or the fault index would silently alter what the three named-module tests check. The Task 1 test pins `svc950` and `svc500`.
6. **Task 5 diagnostics.** A `this`-parameter admission can move a marker from the argument line to the method line in a multi-line fixture; kill criterion 2 catches it, and the change is reverted rather than the fixture edited.
7. **Stale sentences elsewhere.** `docs/guides/comparison.md:165-167` ("measured compiler limits; bulk registration and modules can help") stays true and is not edited; `docs/guides/examples-modularity.md:363` links the page and is not edited. If a search for `575` or `binder` finds any other mention, fix it in Task 6.
8. **Evidence hygiene.** Two untracked artifacts can appear during this plan (`docs/benchmarks/results/`, `tests/generated-type-scale.ts` in Task 5); Tasks 3, 6 and 7 each check `git status` for them.

## Line estimate

| Area | Files | Estimate |
| --- | --- | --- |
| Generators | `tests/compiler.ts`, `tests/type-scale.test.ts` | +45 / −25 |
| Native project | `scripts/native-scale.ts`, `tests/native-compiler.test.ts` | +30 / −20 |
| Ceiling mode | `scripts/benchmark-compiler-ceiling.ts`, `package.json`, `scripts/test-lane.mjs` | +190 / −1 |
| Tests | `tests/benchmark-compiler-ceiling.test.ts` | +120 |
| Docs | `docs/benchmarks/typescript.md`, `README.md`, `docs/guides/development.md` | +110 / −60 |
| Conditional | `src/di-bag.ts`, `docs/reference/**` | +6 / −5, generated |
