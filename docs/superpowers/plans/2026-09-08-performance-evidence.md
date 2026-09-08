# Performance evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add validated repeated runtime and compiler-control measurements with reproducible provenance, an intrinsic baseline, and truthful reporting.

**Architecture:** Dedicated parent runners build/install archives, fork one child per sample, validate deterministic semantic results, and write raw JSONL before calculating statistics. Runtime current/baseline work uses a fixed source checkpoint; compiler controls wrap the existing compiler fixtures without weakening the exhaustive matrix.

**Tech Stack:** TypeScript 6/Native 7, Node `process.hrtime.bigint`, npm pack/offline install, Bun test, existing compiler/native supervision.

**Spec:** `docs/superpowers/specs/2026-09-08-performance-evidence-design.md`

## Global Constraints

- Baseline is commit `739b509`, produced with `git archive`; never compare a dirty worktree as baseline.
- Every sample is a fresh process copied with its scenario tree into an installed archive consumer; no source import, install/build/copy/fixture-construction/priming time, logging, assertions, GC forcing or test framework occurs in its timed interval.
- Use five warm-ups and 31 retained samples per scenario/implementation; alternate baseline/current pair order using a recorded seed.
- Reject invalid exit/schema/checksum/semantic/timeout/RSS samples; do not discard them as outliers.
- Store raw samples, environment/tool/archive/fixture hashes, command and derived statistics in checked-in JSONL/Markdown evidence.
- Normal PR timing is informational. Controlled-runner flags require median >=15% slower, p95 >=20% slower and paired-bootstrap median-ratio 95% CI >1.10, then independent confirmation.
- Preserve full compiler matrix failures and historical compiler tables; classic6 and native7 are separate series.
- No tool or comparator package may be downloaded by a measurement command; unavailable state is explicit.

### Task 1: Runtime sample schema, child protocol and statistics

**Files:** Create `scripts/performance-evidence.ts`, `scripts/runtime-benchmark-child.ts`, `tests/performance-evidence.test.ts`.

**Interfaces:** Produce `RuntimeScenario = 'build-close' | 'cold-linear-resolve' | 'warm-root-resolve' | 'scope-resolve-close' | 'transient-resolve-close' | 'raw-promise-identity' | 'node-native-promise'`; `PreparedScenario`; `TimedScenarioResult`; `BenchmarkSample`; `BenchmarkSummary`; `prepareScenario(name, providers, DiBag): Promise<PreparedScenario>`; `runTimed(prepared): Promise<TimedScenarioResult>`; `verifyScenario(prepared, timed): RuntimeWorkResult`; `runRuntimeChild(request): Promise<BenchmarkSample>`; `summarize(samples): BenchmarkSummary`; `validateRuntimeSample(request, child): BenchmarkSample`.

- [x] **Step 1: Write failing schema/statistics tests.**

```ts
test('rejects a correct duration with an incorrect workload checksum', () => {
  expect(() => validateRuntimeSample(request, completedChild({ checksum: 'wrong' })))
    .toThrow('runtime checksum mismatch');
});
test('computes summary from all raw nanoseconds', () => {
  expect(summarize([1n, 2n, 3n, 4n, 5n]).medianNanoseconds).toBe('3');
});
```

- [x] **Step 2: Run the RED test.**

Run: `bun test tests/performance-evidence.test.ts`

Expected: FAIL because runner exports are absent.

- [x] **Step 3: Implement canonical JSON schema and statistic functions.**

Child request includes lane, scenario, provider count, archive identity, implementation identity and order slot. Child output is exactly `{ lane, scenario, providers, resolvedDiBag, elapsedNanoseconds, checksum, factories, disposers, cleanupLog }`; serialize bigint duration as a decimal string. Child calls `prepareScenario`, captures `const start = process.hrtime.bigint()`, awaits only `runTimed`, captures `const elapsedNanoseconds = process.hrtime.bigint() - start`, then calls `verifyScenario` and prints one JSON object. Parent rejects extra stdout/stderr, any `resolvedDiBag` outside the current consumer's real `node_modules/di-bag`, and derives sorted min/p05/median/p95/mean/stddev/max without rounding raw values. Implement a deterministic paired bootstrap (10,000 seeded resamples) returning `medianRatioCi95`.

- [x] **Step 4: Run focused GREEN tests.**

Run: `bun test tests/performance-evidence.test.ts`

Expected: PASS, including malformed JSON, status/signal/timeout, wrong identity, invalid arithmetic and reproducible bootstrap-seed mutations.

### Task 2: Installed-archive scenarios and current-only evidence

**Files:** Create `tests/benchmarks/runtime-scenarios.ts`, `tests/runtime-benchmark-child.test.ts`; modify `scripts/runtime-benchmark-child.ts`, `scripts/performance-evidence.ts`, `package.json`.

**Interfaces:** Produce `prepareScenario`, `runTimed`, and `verifyScenario` from Task 1, and `npm run benchmark:runtime` mapped to `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/performance-evidence.ts --current`.

- [x] **Step 1: Write failing semantic scenario tests.**

```ts
test('scope-resolve-close verifies work after its timed operation', async () => {
  const prepared = await prepareScenario('scope-resolve-close', 10, DiBag);
  const timed = await runTimed(prepared);
  expect(verifyScenario(prepared, timed)).toMatchObject({
    checksum: 'scope-10', factories: 13, disposers: 3,
    cleanupLog: ['transient-2', 'transient-1', 'scoped'],
  });
});
```

- [x] **Step 2: Run the RED test.**

Run: `bun test tests/runtime-benchmark-child.test.ts`

Expected: FAIL because scenario fixture does not exist.

- [x] **Step 3: Implement each fixed workload.**

For each N in `10` and `100`, `prepareScenario` creates all named linear binding descriptors, counters, raw Promise and lifecycle log outside timing. The sole construction measurement is `build-close`: it times `DiBag.begin().add(bindings).end()` then `.close()` and verifies zero factories. `cold-linear-resolve` builds an unprimed bag in preparation, times one terminal resolve, and verifies N factories/checksum; `warm-root-resolve` builds and primes before the timer, then times one terminal cache resolve and verifies no additional factory calls; `scope-resolve-close` prepares the parent then times `scope()`, root/scoped/two transient resolves and child `.close()`, verifying identity/count/log afterwards; `transient-resolve-close` prepares the bag then times N transient resolves and `.close()`, verifying N distinct values/disposals afterwards; `raw-promise-identity` prepares the raw provider then times one resolve and close, verifying exact resolved/disposed object afterwards. `node-native-promise` uses the same phases with `di-bag/node`, and no portable/comparator scenario imports it.

- [x] **Step 4: Install an archive and fork samples only after setup.**

Use `packIsolatedClassic` defined in `scripts/platform-evidence.ts`, then invoke `[node.argv[0], npmCli, 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', archive.path]` in a temporary consumer. Copy `scripts/runtime-benchmark-child.ts` to `consumer/scripts/runtime-benchmark-child.ts` and `tests/benchmarks/runtime-scenarios.ts` to `consumer/tests/benchmarks/runtime-scenarios.ts`, preserving the child's `../tests/benchmarks/runtime-scenarios.ts` relative import; then execute `consumer/scripts/runtime-benchmark-child.ts` with the pinned Node argv. The child imports bare `di-bag`, prints `require.resolve('di-bag')`/`realpath` as `resolvedDiBag`, and the parent requires it to begin with `realpath(consumer/node_modules/di-bag) + sep`. Perform copying, module loading and `prepareScenario` before `hrtime`; run five warm-up children then 31 sample children serially.

- [x] **Step 5: Run focused and package gates.**

Run: `bun test tests/runtime-benchmark-child.test.ts tests/performance-evidence.test.ts && npm run build && bun test tests/native-package.test.ts && npm run benchmark:runtime`

Expected: focused/package checks pass and a current-only informational evidence row has 31 validated samples. If a pinned prerequisite is unavailable, retain `unavailable`; never create synthetic timing data.

### Task 3: Baseline comparison and controlled-runner verdicts

**Files:** Create `tests/performance-baseline.test.ts`; modify `scripts/performance-evidence.ts`, `package.json`, `docs/benchmarks/results/`.

**Interfaces:** Produce `buildBaselineArchive(root, '739b509'): Promise<PackedArchive>` and `comparePaired(current, baseline, seed): ComparisonVerdict` where status is `'informational' | 'review' | 'unavailable' | 'fail'`.

- [x] **Step 1: Write failing baseline/verdict tests.**

```ts
test('review requires all three regression predicates', () => {
  expect(comparePaired(current, baseline, 17)).toMatchObject({ status: 'review' });
  expect(comparePaired(withP95Ratio(current, 1.19), baseline, 17)).toMatchObject({ status: 'informational' });
});
```

- [x] **Step 2: Run the RED test.**

Run: `bun test tests/performance-baseline.test.ts`

Expected: FAIL because baseline archiving and verdict policy do not exist.

- [x] **Step 3: Build baseline reproducibly and alternate pairs.**

Run `git archive --format=tar 739b509` into a unique temporary tree, record commit/tree/archive/lock hashes, build and pack it with the same pinned tools as current. For each scenario/count, execute pairs `A,B` then `B,A` until each implementation has 31 samples. Persist order seed and every sample before summaries.

- [x] **Step 4: Implement evidence status policy and two-run confirmation.**

On ordinary machines return `informational` after structural validation. Permit `review` only with an environment marker for dedicated controlled runner and all thresholds. Store a `confirmationRequired: true` record; a second different-seed 31-sample run must independently meet thresholds before prose names a regression.

- [x] **Step 5: Run focused and repeatability gates.**

Run: `bun test tests/performance-baseline.test.ts tests/performance-evidence.test.ts && npm run benchmark:runtime -- --baseline=739b509 --seed=17 && npm run benchmark:runtime -- --baseline=739b509 --seed=29`

Expected: schema, order alternation and reproducible source identities pass; each command produces complete rows or explicit unavailable rows.

### Task 4: Repeated compiler controls without weakening the full matrix

**Files:** Create `scripts/benchmark-compiler-controls.ts`, `tests/benchmark-compiler-controls.test.ts`; modify `package.json`, `docs/benchmarks/typescript.md`.

**Interfaces:** Produce `npm run benchmark:compiler-controls` and `CompilerControlRow` with `compiler`, `case`, `warmups`, `samples`, `compileMilliseconds`, `processMilliseconds`, `maxRssMiB`, `instantiations`, `diagnostics`, `markerAccepted`.

- [x] **Step 1: Write failing exact-marker tests.**

```ts
test('negative controls reject a fast compile that lost its marker', () => {
  expect(validateCompilerControl(negativeCase, { diagnostics: [], compileMilliseconds: 1 }))
    .toMatchObject({ accepted: false, reason: 'expected marker missing' });
});
```

- [x] **Step 2: Run the RED test.**

Run: `bun test tests/benchmark-compiler-controls.test.ts`

Expected: FAIL because the control runner is absent.

- [x] **Step 3: Implement fresh-child supported controls.**

Reuse `scaleSource`, `tokenScaleSource`, diagnostic marker evaluators and `nativeScale` supervision semantics. Execute valid/missing/wrong-shape for named chained 100, named grouped 1000 and token bindings 100: five warm-ups, 31 fresh child samples, classic then native as separate output series. Preserve exact marker at the generated boundary and record whole process/RSS/instantiations.

- [x] **Step 4: Document series limits and keep exhaustive failures visible.**

Add a dated section that labels repeated controls informational/comparable only to matching compiler identities. Link to raw evidence and explicitly retain full `npm run benchmark:types`, including non-completing 500/1000 rows; do not claim controls establish those limits.

- [x] **Step 5: Run focused, existing matrix and full gates.**

Run: `bun test tests/benchmark-compiler-controls.test.ts tests/benchmark-types.test.ts && npm run benchmark:compiler-controls && npm run benchmark:types && npm run benchmark:types -- --native && npm run benchmark:types -- --native --tokens && npm run check`

Expected: control rows have complete samples/markers; exhaustive output retains failures exactly; full check passes. The informational exhaustive command's nonzero exit is recorded according to its existing convention, not hidden.

### Task 5: Optional comparator boundary and truthful public report

**Files:** Create `tests/benchmarks/comparator-contract.ts`, `tests/comparator-contract.test.ts`; modify `scripts/performance-evidence.ts`, `README.md`, `docs/benchmarks/results/`, `docs/superpowers/plans/2026-09-06-enterprise-di-program.md` only after actual evidence exists.

**Interfaces:** Produce `ComparatorAdapter` with `{ name, version, sourceSha256, semantics: 'restricted-common-subset', buildGraph(count): unknown, resolve(graph, name): unknown, dispose(graph): Promise<void> }`; statuses include `'not-comparable'`.

- [x] **Step 1: Write failing common-subset/admission tests.**

```ts
test('comparator cannot enter lifecycle table without the common contract', async () => {
  await expect(validateComparator(incompleteAdapter)).resolves.toMatchObject({ status: 'not-comparable' });
});
```

- [x] **Step 2: Run the RED test.**

Run: `bun test tests/comparator-contract.test.ts`

Expected: FAIL because comparator protocol is absent.

- [x] **Step 3: Add adapters only after exact lockfile-pinned packages are installed and reviewed.**

Implement Typed Inject and Awilix adapters only for synchronous named graphs, singleton/transient resolution and explicit lifecycle where supported. Hash adapter source and package archive; record license/version. Exclude all other di-bag semantics in the table. If either cannot satisfy the test, emit `not-comparable` and stop rather than change its workload.

- [x] **Step 4: Publish only supported claims.**

README and report must label ordinary measurements “informational”, comparator data “restricted common-subset throughput”, old rows “historical”, and missing tools “unavailable”. Add no universal speed, feature-quality, bundle-budget or platform claim absent matching retained results.

- [x] **Step 5: Run final focused/package/full gates and review evidence.**

Run: `bun test tests/performance-evidence.test.ts tests/runtime-benchmark-child.test.ts tests/performance-baseline.test.ts tests/benchmark-compiler-controls.test.ts tests/comparator-contract.test.ts && npm run benchmark:runtime -- --baseline=739b509 --seed=17 && npm run benchmark:compiler-controls && npm run check && git diff --check`

Expected: every result is structurally valid, all provisioned measurements are complete, unavailable/not-comparable states are explicit, package/full checks pass, and claim language matches the retained JSONL rows.
