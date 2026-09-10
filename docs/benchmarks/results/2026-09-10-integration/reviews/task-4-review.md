### Spec Compliance

✅ **Scoped Task 4 requirements satisfied.** Numeric concurrency validates positive safe integers before factories, preserves default parallel scheduling, and limits selected acquisition-readiness workers without assimilating exposed values (`src/startup.ts:28`, `src/startup.ts:81`). Observer/close measurements and declared-depth investigation meet the brief’s acceptance requirements (`docs/benchmarks/results/2026-09-10-workload-controls/README.md:29`, `README.md:43`).

⚠️ **Controller-owned completion remains unverified:** integrated audit reruns, whole-branch review, publication, remote state and exact merged checks. This scoped approval does not establish those steps.

### Strengths

- **Small, coherent scheduler change:** sequential and numeric scheduling share workers; the failure flag stops admission independently of cancellation and rollback settlement. Worker allocation is capped at selection length (`src/startup.ts:81`).
- **Meaningful behavioral coverage:** gates verify limits, exact promise identity, duplicate lifetimes, option snapshots, raw projected readiness with pending ownership, failure/cancellation cleanup, invalid bounds and synchronous factory-triggered abort (`tests/startup.test.ts:338`, `tests/startup.test.ts:371`, `tests/startup.test.ts:386`, `tests/startup.test.ts:442`).
- **Physical and type boundaries covered:** the shared package fixture exercises numeric scheduling, disposal and validation; positive/negative source contracts retain exact return types (`tests/startup-runtime-fixture.ts:80`, `tests/types/startup-consumer.ts:7`, `tests/types/negative/startup.ts:18`).
- **Measurements distinguish resource categories:** active application workspace is separated from observed heap peaks; observer gates remain externally rooted; close deadlines preserve the original pending promise and eventual disposal (`docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs:12`, `probe.mjs:52`, `probe.mjs:72`).
- **Declared-depth investigation is candid and concrete:** both depth-1,000 failures are retained, and the prewalk counterexample demonstrates extra transient calls, changed values and event order. The proposed architectural boundary addresses original-consumer ownership and positional handoff (`docs/benchmarks/results/2026-09-10-workload-controls/README.md:45`, `README.md:56`).
- **Deferred coverage addressed directly:** reverse incoming-entry removal and exact branching-cycle diagnostics now have behavioral/work-count assertions (`tests/runtime-scale.test.ts:99`, `tests/runtime-scale.test.ts:119`).

### Issues

**Critical:** None.

**Important:** None.

**Minor / evidence observations:**

- `docs/benchmarks/results/2026-09-10-workload-controls/staged-all-diff-check.log:1`: the all-files whitespace check remains nonzero because exact raw logs and patch context retain whitespace. This is transparently documented; the source/tests/docs check passes. Preserve the raw evidence and carry this distinction into the controller’s final audit.
- `docs/benchmarks/results/2026-09-10-workload-controls/physical-and-source-types-sandbox.log:10`: the restricted package attempt contains subprocess failure and an unhandled setup error. The unchanged host rerun passes all 81 package tests (`physical-packages-host.log:88`); this is resolved environment evidence, not an outstanding implementation defect.

### Verification and Assessment

- Reviewed the supplied diff in passes. Opened the omitted middle/end of `startRuntime` to check cancellation during rollback.
- Focused outside-diff check confirmed package-fixture injection and startup declaration-consumer wiring (`tests/package.test.ts:119`, `tests/native-package.test.ts:65`, `tests/native-package.test.ts:143`, `tests/types.test.ts:48`).
- Read-only SHA-256 checks matched all **37 current source files** and **296 recorded emitted files** across four builds. Recorded passing test/build/docs evidence supports the report.
- No tests or benchmarks rerun; no checkout mutations or heavy processes.

**Task quality: Approved.** No blocking correctness or scope issue found. The implementation preserves ownership/readiness contracts, and its performance claims stay within the measurements’ demonstrated limits.
