# Task 6: CI supervision and package-test repair

Status: scoped implementation and required verification complete; ready for independent controller review.

## Source and scope

- Checkout: `/tmp/di-bag-performance-integration`; branch `fix/persistent-graph-performance`.
- BASE: `e5e4b927e7b23279397e9fedbf416fa35ae2d13c` (clean dispatch tree including reviewed Task 2 runtime changes).
- Owned code: `scripts/native-process.ts`, `tests/native-process.test.ts`, `tests/native-package.test.ts` only. No runtime/public-type/compiler-limit/scale-generator/acceptance changes.
- Durable evidence: `docs/benchmarks/results/2026-09-10-ci-performance/`. Local ignored SDD copies are retained for the controller workflow. Controller owns plan and ledger.

## Diagnosis and preserved failures

Acquisition CI run 34420434125 at 56e502e, `/tmp/di-bag-acquisition-ci-failure.log`, contains:

```text
command failed: {"argv":["/tmp/di-bag-release-candidate/task3-test-2511/checkout/node_modules/.bin/tsc6","-p","/tmp/di-bag-release-candidate/task3-test-2511/real-work/full-consumer/declarations-classic6-cts/tsconfig.json"],"status":0,"signal":null,"terminationReason":"monitor","stderr":""}
(fail) native installed contracts and physical downstream declarations from classic6 [122443.18ms]
  ^ this test timed out after 120000ms.
(fail) native installed contracts and physical downstream declarations from native7 [120000.10ms]
  ^ this test timed out after 120000ms.
```

Same package deadline categories recur in `/tmp/di-bag-merged-main-ci-failure.log`, run 34418728341. Original logs and original `.superpowers/sdd/2026-09-10-performance-completion/zombie-supervisor-{bun,node}.json` are untouched local controller evidence. Truncated older CI diagnostics do not reveal the exact underlying status-read error; the regression proves a concrete exit-order bug consistent with the observed outcome, not that every historical failure had precisely this cause.

`kill(pid, 0)` confirms existence, not execution: a real Linux zombie answers it before JavaScript receives the child's exit event. The tests block JS event processing until a real child reaches State Z, then inject ENOENT/ESRCH at the status-read boundary. Before the fix both return status 0 and correct stdout/stderr but terminationReason monitor.

## RED/GREEN command ledger

Commands below preserve the exact historical invocations from the checkout above, including their original SDD output paths. Each named log is now committed beside this report under the same basename; bare log filenames refer to this durable directory. Actual host process commands use scoped escalation because the sandbox suppresses `execFileSync('node', ['-p', 'process.execPath'])` output.

1. Initial sandbox attempt, exit 1 (environmental failure, not valid RED):
   `bun test tests/native-process.test.ts -t 'supervisor drains and reaps a zombie' > .superpowers/sdd/2026-09-10-performance-completion/task-6-supervisor-red-sandbox.log 2>&1`
   Both tests fail with `ERR_INVALID_ARG_VALUE: The argument 'file' cannot be empty. Received ''`.
2. Host RED, exit 1:
   `bun test tests/native-process.test.ts -t 'supervisor drains and reaps a zombie' > .superpowers/sdd/2026-09-10-performance-completion/task-6-supervisor-red.log 2>&1`
   Result: 0 pass, 2 fail, 16 filtered, 6 assertions, 223ms. Both fail `expect(result.terminationReason).toBeUndefined()` with received `"monitor"`, after status/streams match.
3. Host GREEN, exit 0:
   `bun test tests/native-process.test.ts > .superpowers/sdd/2026-09-10-performance-completion/task-6-supervisor-green.log 2>&1`
   18 pass, 0 fail, 93 assertions, 777ms. Includes all original live-child EIO/ENOENT/ESRCH/missing-VmRSS, pending-read cleanup, inherited pipes, reaping, timeout/memory/output, spawn and validation checks.
4. Node host control, exit 0:
   `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON .superpowers/sdd/2026-09-10-performance-completion/task-6-zombie-diagnostic.mjs > .superpowers/sdd/2026-09-10-performance-completion/task-6-zombie-node.log 2>&1`
   Node24.20.0, observed State Z and successful existence probe, status0, signalnull, expected stdout, no error/terminationReason, 84ms. Adapted only output filenames in the supplied diagnostic to preserve original RED JSON.

## Supervisor implementation

For ENOENT/ESRCH only, after a successful PID existence probe, read a fresh `/proc/PID/status` synchronously to distinguish State Z/X from a live process. This tiny exceptional-path read observes exit state before JS notification without adding a delay or weakening sampling on live children. If the fresh read itself fails, a second PID probe must report ESRCH to establish disappearance; otherwise monitoring fails closed. Unexpected EIO still fails closed. The normal sampler, worker limits, pending-read wait, stream collection, exit/close handling and child reaping remain unchanged.

## Package investigation

Both formats currently repeat the same downstream dependency/library parsing and checking for sixteen independent consumer modules. All sixteen use explicit imports/exports, and inspection found no `declare global` or `declare module` in `tests/types` or `src`. Consolidating their downstream programs therefore cannot supply ambient requirements across these fixtures. Every producer is still independently emitted, physically deleted, and checked absent before consumption.

Package baseline command (host, shared lock), exit 0:

```sh
flock /tmp/di-bag-compiler-heavy.lock /usr/bin/time -v bun test tests/native-package.test.ts > .superpowers/sdd/2026-09-10-performance-completion/task-6-package-baseline.log 2>&1
```

Unchanged package tests: classic6 84,741.00ms; native7 68,826.95ms; 2 pass, 0 fail, 1,210 assertions; Bun total153.76s, measured wall153.79s, user351.86s, system37.76s, maxRSS1,596,256KiB. This host does not reproduce the CI deadline failure; the preserved real CI failure supplies that RED evidence. No artificial delays, CPU throttling, or altered deadlines were used. The baseline process loaded the original supervisor before its fix was edited; source/runtime/package fixtures remained at BASE throughout.

### Preserved matrix and deterministic work counts

- 2 emitters × 2 formats =4 installations; both emitter-level120,000ms tests remain.
- 55 box fixtures per installation =220 independent native contract checks, with unchanged marker accounting, TS2589 rejection and known-gap acceptance.
- 16 producer/declaration/consumer pairs per installation =64 pairs; every producer independently emitted, declaration verified present, source directory deleted, producer verified absent, downstream explicitly included and checked by both compilers.
- Existing emitter routing preserved exactly (classic6 emits14 selected feature producers per format; the existing modern-inline/token-modules path uses native emission). No source fixtures changed.
- Both Node and Bun execute both scope and final-adversarial runtime oracles in each installation:16 runtime executions.
- Replacement-module support check retained once per installation:4 checks.
- Downstream native compile calls64 →4; classic downstream programs64 →4. Every downstream source is still a root file and every diagnostic must be absent.
- Including unchanged box/support/producer work: compileNative calls324 →264; classic createProgram calls92 →32. Compiler identity/build children unchanged (4), so supervised compiler launches328 →268. This is harness work reduction, not a claim of compiler implementation improvement.
- Per worker:60,000ms,3072MiB,4MiB output,sample20ms, default stack unchanged.

The batch has no fixture scope sharing: all16 consumers contain module imports, emitted producer declarations are external modules, and no global/module augmentation exists in the source corpus. Physical deletion happens before either downstream compiler opens the batch. The classic program also explicitly verifies every downstream and declaration was loaded, and no producer was loaded.

Package GREEN command (same host/shared lock):

```sh
flock /tmp/di-bag-compiler-heavy.lock /usr/bin/time -v bun test tests/native-package.test.ts > .superpowers/sdd/2026-09-10-performance-completion/task-6-package-green.log 2>&1
```

Package GREEN, exit0: classic6 55,827.28ms; native7 41,263.51ms;2 pass,0 fail,1,218 assertions; Bun total97.26s, measured wall97.30s,user243.17s,system22.79s. Wall reduction56.49s (36.7%) on this single matched host run. Both original120s aggregate deadlines retained, with no format split. This is not a CI timing guarantee.

**Memory tradeoff:** `/usr/bin/time` maximum RSS increased from1,596,256KiB to2,224,848KiB (~1.52 →2.12GiB). The combined classic downstream program shares parse work but retains more consumer state at once. These are whole-command high-water observations, not individual native-worker RSS. The per-worker3072MiB ceiling is unchanged and no supervised worker exceeded it. Future full CI/integrated checks should watch memory as well as elapsed time.

Release verification (host/shared lock), exit0:

```sh
flock /tmp/di-bag-compiler-heavy.lock /usr/bin/time -v bun test tests/release-artifacts.test.ts > .superpowers/sdd/2026-09-10-performance-completion/task-6-release-green.log 2>&1
```

90 pass,0 fail,422 assertions,Bun19.61s,wall19.62s. Includes real offline package install, Node/Bun,CJS/ESM,core-only and declaration oracles; the formerly failing real release-oracle test passed in14,235.73ms. No network/publication/push/merge operations performed.

Classic typecheck (host/shared lock), exit0:

```sh
flock /tmp/di-bag-compiler-heavy.lock /usr/bin/time -v npm run typecheck > .superpowers/sdd/2026-09-10-performance-completion/task-6-typecheck-classic-green.log 2>&1
```

`tsc6 -p tsconfig.json`, no diagnostics,wall6.63s.

Native typecheck (host/shared lock):

```sh
flock /tmp/di-bag-compiler-heavy.lock /usr/bin/time -v npm run typecheck:native > .superpowers/sdd/2026-09-10-performance-completion/task-6-typecheck-native-green.log 2>&1
```

## Self-review

- Diff restricted to three owned files; reviewed Task2 runtime changes untouched.
- Confirmed fresh state is consulted only after ENOENT/ESRCH, live-child errors stay fail-closed, PID-probe failures other than ESRCH cannot authorize exit, normal monitoring and fixed limits are unchanged.
- Regression exercises actual Linux zombie state, real output streams and reaping. Removing fresh-state confirmation makes both newly added tests fail with `monitor`; ignoring every status failure would break existing live-child ENOENT/ESRCH tests. A lost drain/reap/pending-sample wait is covered by existing tests.
- Pair routing/emission and all box fixtures are unchanged. Diagnostic-free batch checks cover all16 explicit root modules. Every pair retains source/declaration existence checks and classic resolution assertions; additional checks confirm every downstream is loaded and sources remain absent at batch consumption.
- Compared deterministic work counts and measured whole-file elapsed time, preserving total-work transparency rather than treating split test deadlines as a compiler improvement.
- `git diff --check` passed. Full source diff reviewed before commit.
- Full integrated checks and independent scoped review remain controller responsibilities; no subagents dispatched here.

## Remaining concerns

1. Exact historic CI status-read error text was truncated; confirmed real-child bug is consistent with historical symptom, without claiming inaccessible evidence.
2. Local pre-change package baseline passed; retained CI supplies actual timeout failures. New timing is a local observation and requires fresh CI/integrated confirmation.
3. Batched classic downstream programs increase whole-command peak RSS as quantified above; fixed worker limits remain intact.
4. Linux `/proc` remains required. The exceptional fresh read is synchronous and local; it avoids a new scheduling delay, and no new configurable limit or stack setting was introduced.

Native typecheck result: exit0, `tsc -p tsconfig.json`, no diagnostics, wall0.89s; exact timing retained in `task-6-typecheck-native-green.log`.

## Tested source identity

Final tested code SHA-256:

- `scripts/native-process.ts`: `8b988350be21773858c72981cb879719ce704914896604c4b68c8c9081c3d257`
- `tests/native-process.test.ts`: `87df4c07c4cc9e08debc82efe1fc3857cfca1000e1382a9c422def0ee8b2b3f8`
- `tests/native-package.test.ts`: `e175e0ff64f7216bc694e8324f326fd970c85259a4f1cc3380a6eedfe4962955`

Preserved CI log SHA-256:

- `/tmp/di-bag-acquisition-ci-failure.log`: `6ca4d680542a5834fbf52679d4750f5f946e22d7788b8965ab2a7d06a511cda1`
- `/tmp/di-bag-merged-main-ci-failure.log`: `dc1632010588685dac35202735aeab5015e57f2cf5c20a124675c36c0d08e6c2`

The tested implementation is commit `e2102aac0b97a065218bb4759b130e2f0f1f72ac`. This artifact-only follow-up moves the report, nine complete command logs, and diagnostic into `docs/benchmarks/results/2026-09-10-ci-performance/`; SDD copies remain locally available but are untracked and ignored. Log bytes and the three tested source hashes are unchanged. The durable diagnostic adjusts only its relative import for the new directory depth. No tests were rerun for this location correction. No plan/ledger artifacts or unrelated files are tracked. Original controller diagnostics and CI logs remain untouched; exact CI failure excerpts and full-file hashes are preserved above.

To rerun the relocated standalone diagnostic from the repository root:

```sh
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON docs/benchmarks/results/2026-09-10-ci-performance/task-6-zombie-diagnostic.mjs
```

For other historical commands, redirect new logs to the durable directory above if desired. Existing committed logs describe the original execution, not an execution after relocation.
