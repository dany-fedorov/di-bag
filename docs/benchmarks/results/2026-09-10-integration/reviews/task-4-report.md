# Task 4 implementation report

Status: DONE, scoped implementation and verification complete; commit recorded below.

## Scope and implementation

Implemented the pre-resolved numeric `StartupOptions.concurrency` option after measuring the parallel/sequential resource tradeoff. Positive safe integers bound selected readiness workers; `1` follows sequential readiness. Default parallel behavior is preserved, including eager starts before asynchronous failure observation. Numeric workers stop dequeueing on observed failure/cancellation, and existing runtime rollback retains started ownership. Readiness uses `runtime.acquire`, never exposed-thenable assimilation. Options are snapshotted once and invalid integers fail before factories.

Added deterministic startup coverage for bounds 1/2/larger-than-selection, empty selections, getter snapshots, duplicate scoped/transient lifetimes, raw projected readiness with pending owned source, exact promises, failure/abort/timeout rollback, cleanup failure, validation and synchronous factory-triggered abort. Positive/negative source types and emitted consumer shape include the new option. Shared physical package fixture tests numeric startup via existing installed/deleted-producer machinery. Extended existing `tests/runtime-scale.node.mjs`; there is no new emitted file or CI command-list change.

Measured observer burst/backlog and close source/disposer waits before and after both emitters. No observer or close API/runtime change is justified: slow externally rooted observer work sustains additional retention, and a host deadline bounds waiting while underlying memoized close preserves ownership. Tutorial and server guidance explain limits and demonstrate handled `Promise.race` use. Numeric API comments, including `Builder.start`, and generated references are refreshed.

The two deferred scale checks were not directly covered: added reverse incoming-index retention/work assertions on consumer release, and an anchored exact branching-cycle message with rejected edge absence.

## Evidence and decisions

Durable detailed investigation, measurements, limitations and reproduction: `docs/benchmarks/results/2026-09-10-workload-controls/README.md`. It includes complete declared-dependency routing feasibility and a smaller prewalk counterexample. All individual measurements/checks retain full logs and command/status records. Source manifests hash all source files before/after; production patch plus exact baseline reconstruct the changes; both emitter manifests hash emitted files.

Baseline: clean `9bee9cd9a14f4c0a57113de7e9eb3afc01d887b8`, branch `fix/persistent-graph-performance`. Classic/native builds were emitted into separate `/tmp/di-bag-task4-{classic,native}-{before,after}` directories. Serial fresh Node 24.20.0 workers used default stack, `--expose-gc --max-old-space-size=512`, 30-second process limits and `/tmp/di-bag-compiler-heavy.lock`. Root was told when both timed observation batches began/ended and kept competing load off. No tests overlapped timed observations. Installed tools were not changed: Bun 1.4.2, npm 11.19.0, classic compiler 6.0.3, native 7.0.2.

All 22 baseline and 26 after workload workers passed. At 96 selected providers, peak active workspace/calls changed from parallel 96/24 MiB to numeric 8/2 MiB. Classic startup was 21.89 ms parallel, 61.41 ms bound 8, 474.97 ms sequential; native 21.07/60.08/480.86 ms. All modes called/readied/disposed all 96 once. Heap peaks include uncollected garbage and are separately labeled from active workspace counts; post-GC baseline/final heap is retained. Timings are descriptive, not CI thresholds.

Observer N=10,000 produces 20,000 events with zero callback deliveries during the synchronous burst. All deliver in order after a turn; pending callback gates remain rooted externally. Classic baseline after-GC heap: ~14.0 MB queued observed burst, ~9.0 MB fast drain, ~31.4 MB externally pending drain, ~9.1 MB after resolving/rejecting gates. All 200 deliberate rejections reach onError once in order. This delta includes application gates/promises and library failure-state retention, not merely an undrained library event queue. No silent drops/caps were added. Close controls prove prompt application deadlines, original pending/memoized close, exact eventual disposal and exact cleanup errors after source and disposer gates release.

Declared raw positional chains pass 100 and 500, but both emitters at 1,000 throw RangeError before callbacks; retained as explicit limitations. Existing 1,000 raw/automatic named cold chains pass. The prewalk counterexample adds a transient acquisition, changes tuple values and acquisition event order. A feasible specialized iterative route needs original-consumer attempt frames and position-specific one-time value handoff through source publication/owner/cycle/projection boundaries. `withContext` has arbitrary named dependencies, not an available tuple. No unsafe prewalk, factory replay, global registry, arbitrary-depth rewrite or implicit async conversion was implemented. This meets the requested bounded investigation, not arbitrary-depth support.

## TDD and failures retained

- RED: `bun test tests/startup.test.ts --test-name-pattern 'numeric startup|bounded startup'` before production edits: 0 pass, 10 fail, 22 filtered. Numeric options rejected as `invalid startup concurrency`, so expected factory calls were absent.
- First GREEN attempt: 31 pass, 1 fail. The test's portable Core fixture accidentally used automatic acquisition for its later provider. Error: automatic acquisition classification requires configuration. Fixed only that fixture to explicit raw mode.
- GREEN: `bun test tests/startup.test.ts`: 32 pass, 0 fail, before the later additional synchronous-abort coverage.
- Restricted physical command: 115 source-type tests passed, while package setup reproduced empty Bun subprocess output/status 226 and native-package empty `process.execPath` causing npm ENOENT. Retained full log; reran unchanged physical package gates using scoped host execution already authorized by root. No source-type gates were weakened or repeated unnecessarily.
- Tool version manifest retains a mistaken native `bin/tsc.js` lookup (MODULE_NOT_FOUND) and corrected `bin/tsc` 7.0.2 lookup. Initial source discovery had harmless missing-file guesses (`AGENTS.md`, singular dependency-reference and guessed acquisition/provider filenames); actual plural/renamed sources were found with rg. No such lookup informed implementation without reading the real source.

## Self-review

Reviewed implementation and all added regression oracles. The bounded scheduler shares a worker failure flag rather than reusing overall settled state, preserving cancellation during rollback. Worker-array size is capped at selected length even for MAX_SAFE_INTEGER. Explicit concurrency defaults and validation remain compatible. Tests use real acquisition/disposal and external gates; wall-clock samples are evidence only. Reverse-index test intentionally inspects the internal index as a direct retention/work oracle; public forward behavior alone would miss stale IDs. Tightened the branching-cycle assertion to anchored full message during review. Final checks pass; no correctness doubts remain.

Generated output additionally updates stale Module/ModuleBuilder source locations and Complete/ForkContext/Overrides/Selected/Selection helper signatures from earlier task changes. Root was informed and approved retaining exact generator output. Both generators/semantics are unaffected beyond startup option comment/type/scheduling.

## Controller-owned work

Not performed or claimed: all-audit integrated before/after reruns, expensive full repository checks, whole-branch independent review, push/PR/merge/remote proof, final requirement ledger/plan audit. Root owns these after scoped review. No network/publication, original-checkout writes, subagents, or SDD force-adds occurred.

## Exact command results

Every command below was executed by the durable recorder; detailed output is the identically named `.log` in the evidence directory. Source commit and exact diff hashes are in `commands.jsonl`.

- `baseline-classic-build`: `npm run build -- --outDir /tmp/di-bag-task4-classic-before` → exit 0, 1.121 s.
- `baseline-native-build`: `npm run build:native -- --outDir /tmp/di-bag-task4-native-before` → exit 0, 0.246 s.
- `before-classic-observer-none-1000`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-classic-before/node.js observer none 1000` → exit 0, 0.064 s.
- `before-classic-observer-fast-1000`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-classic-before/node.js observer fast 1000` → exit 0, 0.071 s.
- `before-classic-observer-pending-1000`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-classic-before/node.js observer pending 1000` → exit 0, 0.079 s.
- `before-classic-observer-none-10000`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-classic-before/node.js observer none 10000` → exit 0, 0.088 s.
- `before-classic-observer-fast-10000`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-classic-before/node.js observer fast 10000` → exit 0, 0.105 s.
- `before-classic-observer-pending-10000`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-classic-before/node.js observer pending 10000` → exit 0, 0.145 s.
- `before-classic-startup-parallel-96`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-classic-before/node.js startup parallel 96` → exit 0, 0.089 s.
- `before-classic-startup-sequential-96`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-classic-before/node.js startup sequential 96` → exit 0, 0.537 s.
- `before-classic-close-fulfilled-0`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-classic-before/node.js close fulfilled 0` → exit 0, 0.048 s.
- `before-classic-close-pending-0`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-classic-before/node.js close pending 0` → exit 0, 0.058 s.
- `before-classic-close-failure-0`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-classic-before/node.js close failure 0` → exit 0, 0.071 s.
- `before-native-observer-none-1000`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-native-before/node.js observer none 1000` → exit 0, 0.070 s.
- `before-native-observer-fast-1000`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-native-before/node.js observer fast 1000` → exit 0, 0.079 s.
- `before-native-observer-pending-1000`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-native-before/node.js observer pending 1000` → exit 0, 0.081 s.
- `before-native-observer-none-10000`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-native-before/node.js observer none 10000` → exit 0, 0.082 s.
- `before-native-observer-fast-10000`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-native-before/node.js observer fast 10000` → exit 0, 0.116 s.
- `before-native-observer-pending-10000`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-native-before/node.js observer pending 10000` → exit 0, 0.146 s.
- `before-native-startup-parallel-96`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-native-before/node.js startup parallel 96` → exit 0, 0.084 s.
- `before-native-startup-sequential-96`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-native-before/node.js startup sequential 96` → exit 0, 0.544 s.
- `before-native-close-fulfilled-0`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-native-before/node.js close fulfilled 0` → exit 0, 0.053 s.
- `before-native-close-pending-0`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-native-before/node.js close pending 0` → exit 0, 0.060 s.
- `before-native-close-failure-0`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-native-before/node.js close failure 0` → exit 0, 0.063 s.
- `bounded-startup-red`: `bun test tests/startup.test.ts --test-name-pattern 'numeric startup|bounded startup'` → exit 1, 0.018 s.
- `bounded-startup-green`: `bun test tests/startup.test.ts` → exit 1, 0.049 s.
- `bounded-startup-green-fixed`: `bun test tests/startup.test.ts` → exit 0, 0.046 s.
- `scale-coverage`: `bun test tests/runtime-scale.test.ts` → exit 0, 0.177 s.
- `typecheck-classic`: `npm run typecheck` → exit 0, 6.253 s.
- `typecheck-native`: `npm run typecheck:native` → exit 0, 0.919 s.
- `final-classic-build`: `npm run build -- --outDir /tmp/di-bag-task4-classic-after` → exit 0, 1.102 s.
- `final-native-build`: `npm run build:native -- --outDir /tmp/di-bag-task4-native-after` → exit 0, 0.239 s.
- `docs-generate`: `npm run docs:generate` → exit 0, 1.818 s.
- `docs-check`: `npm run docs:check` → exit 0, 4.736 s.
- `after-classic-observer-none-1000`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-classic-after/node.js observer none 1000` → exit 0, 0.070 s.
- `after-classic-observer-fast-1000`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-classic-after/node.js observer fast 1000` → exit 0, 0.077 s.
- `after-classic-observer-pending-1000`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-classic-after/node.js observer pending 1000` → exit 0, 0.081 s.
- `after-classic-observer-none-10000`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-classic-after/node.js observer none 10000` → exit 0, 0.093 s.
- `after-classic-observer-fast-10000`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-classic-after/node.js observer fast 10000` → exit 0, 0.110 s.
- `after-classic-observer-pending-10000`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-classic-after/node.js observer pending 10000` → exit 0, 0.148 s.
- `after-classic-startup-parallel-96`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-classic-after/node.js startup parallel 96` → exit 0, 0.085 s.
- `after-classic-startup-sequential-96`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-classic-after/node.js startup sequential 96` → exit 0, 0.536 s.
- `after-classic-startup-1-96`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-classic-after/node.js startup 1 96` → exit 0, 0.547 s.
- `after-classic-startup-8-96`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-classic-after/node.js startup 8 96` → exit 0, 0.119 s.
- `after-classic-close-fulfilled-0`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-classic-after/node.js close fulfilled 0` → exit 0, 0.056 s.
- `after-classic-close-pending-0`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-classic-after/node.js close pending 0` → exit 0, 0.064 s.
- `after-classic-close-failure-0`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-classic-after/node.js close failure 0` → exit 0, 0.068 s.
- `after-native-observer-none-1000`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-native-after/node.js observer none 1000` → exit 0, 0.064 s.
- `after-native-observer-fast-1000`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-native-after/node.js observer fast 1000` → exit 0, 0.067 s.
- `after-native-observer-pending-1000`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-native-after/node.js observer pending 1000` → exit 0, 0.067 s.
- `after-native-observer-none-10000`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-native-after/node.js observer none 10000` → exit 0, 0.090 s.
- `after-native-observer-fast-10000`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-native-after/node.js observer fast 10000` → exit 0, 0.114 s.
- `after-native-observer-pending-10000`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-native-after/node.js observer pending 10000` → exit 0, 0.140 s.
- `after-native-startup-parallel-96`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-native-after/node.js startup parallel 96` → exit 0, 0.078 s.
- `after-native-startup-sequential-96`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-native-after/node.js startup sequential 96` → exit 0, 0.553 s.
- `after-native-startup-1-96`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-native-after/node.js startup 1 96` → exit 0, 0.539 s.
- `after-native-startup-8-96`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-native-after/node.js startup 8 96` → exit 0, 0.115 s.
- `after-native-close-fulfilled-0`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-native-after/node.js close fulfilled 0` → exit 0, 0.052 s.
- `after-native-close-pending-0`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-native-after/node.js close pending 0` → exit 0, 0.065 s.
- `after-native-close-failure-0`: `timeout 30s node --expose-gc --max-old-space-size=512 /tmp/di-bag-performance-integration/docs/benchmarks/results/2026-09-10-workload-controls/probe.mjs /tmp/di-bag-task4-native-after/node.js close failure 0` → exit 0, 0.068 s.
- `declared-classic-chain-100`: `timeout 30s node --expose-gc --max-old-space-size=512 docs/benchmarks/results/2026-09-10-workload-controls/declared-probe.mjs /tmp/di-bag-task4-classic-after/node.js chain 100` → exit 0, 0.058 s.
- `declared-classic-chain-500`: `timeout 30s node --expose-gc --max-old-space-size=512 docs/benchmarks/results/2026-09-10-workload-controls/declared-probe.mjs /tmp/di-bag-task4-classic-after/node.js chain 500` → exit 0, 0.064 s.
- `declared-classic-chain-1000`: `timeout 30s node --expose-gc --max-old-space-size=512 docs/benchmarks/results/2026-09-10-workload-controls/declared-probe.mjs /tmp/di-bag-task4-classic-after/node.js chain 1000` → exit 1, 0.074 s.
- `declared-classic-normal-0`: `timeout 30s node --expose-gc --max-old-space-size=512 docs/benchmarks/results/2026-09-10-workload-controls/declared-probe.mjs /tmp/di-bag-task4-classic-after/node.js normal 0` → exit 0, 0.047 s.
- `declared-classic-prewalk-0`: `timeout 30s node --expose-gc --max-old-space-size=512 docs/benchmarks/results/2026-09-10-workload-controls/declared-probe.mjs /tmp/di-bag-task4-classic-after/node.js prewalk 0` → exit 0, 0.048 s.
- `declared-native-chain-100`: `timeout 30s node --expose-gc --max-old-space-size=512 docs/benchmarks/results/2026-09-10-workload-controls/declared-probe.mjs /tmp/di-bag-task4-native-after/node.js chain 100` → exit 0, 0.047 s.
- `declared-native-chain-500`: `timeout 30s node --expose-gc --max-old-space-size=512 docs/benchmarks/results/2026-09-10-workload-controls/declared-probe.mjs /tmp/di-bag-task4-native-after/node.js chain 500` → exit 0, 0.062 s.
- `declared-native-chain-1000`: `timeout 30s node --expose-gc --max-old-space-size=512 docs/benchmarks/results/2026-09-10-workload-controls/declared-probe.mjs /tmp/di-bag-task4-native-after/node.js chain 1000` → exit 1, 0.075 s.
- `declared-native-normal-0`: `timeout 30s node --expose-gc --max-old-space-size=512 docs/benchmarks/results/2026-09-10-workload-controls/declared-probe.mjs /tmp/di-bag-task4-native-after/node.js normal 0` → exit 0, 0.049 s.
- `declared-native-prewalk-0`: `timeout 30s node --expose-gc --max-old-space-size=512 docs/benchmarks/results/2026-09-10-workload-controls/declared-probe.mjs /tmp/di-bag-task4-native-after/node.js prewalk 0` → exit 0, 0.049 s.
- `covering-runtime`: `bun test tests/acquisition-mode.test.ts tests/acquisition.test.ts tests/aliases.test.ts tests/binding-graph.test.ts tests/boundaries.test.ts tests/box-adapters.test.ts tests/composition-adapters.test.ts tests/contributions.test.ts tests/dependency-references.test.ts tests/disposal.test.ts tests/enterprise-integration.test.ts tests/final-adversarial-integration.test.ts tests/lifetimes.test.ts tests/modules.test.ts tests/observers.test.ts tests/persistent-graph.test.ts tests/persistent-map.test.ts tests/persistent-module.test.ts tests/plugins.test.ts tests/projections.test.ts tests/providers.test.ts tests/runtime-scale.test.ts tests/runtime.test.ts tests/scopes.test.ts tests/selected-scope-runtime.test.ts tests/selected-scopes.test.ts tests/startup.test.ts tests/token-modules.test.ts tests/tokens.test.ts tests/wbs-scope.test.ts` → exit 0, 0.588 s.
- `node-classic`: `env DI_BAG_RUNTIME_ENTRY=/tmp/di-bag-task4-classic-after/node.js node --expose-gc --test --test-isolation=none tests/runtime-scale.node.mjs tests/acquisition-retention.node.mjs tests/graph-retention.node.mjs` → exit 0, 0.639 s.
- `node-native`: `env DI_BAG_RUNTIME_ENTRY=/tmp/di-bag-task4-native-after/node.js node --expose-gc --test --test-isolation=none tests/runtime-scale.node.mjs tests/acquisition-retention.node.mjs tests/graph-retention.node.mjs` → exit 0, 0.644 s.
- `physical-and-source-types-sandbox`: `bun test tests/types.test.ts tests/package.test.ts tests/native-package.test.ts` → exit 1, 65.218 s.
- `physical-packages-host`: `bun test tests/package.test.ts tests/native-package.test.ts` → exit 0, 146.797 s.
- `startup-final`: `bun test tests/startup.test.ts` → exit 0, 0.073 s.
- `scale-final`: `bun test tests/runtime-scale.test.ts` → exit 0, 0.183 s.
- `typecheck-final`: `npm run typecheck` → exit 0, 6.315 s.
- `typecheck-native-final`: `npm run typecheck:native` → exit 0, 0.825 s.
- `diff-check`: `git diff --check` → exit 0, 0.006 s.

## Files changed

- `docs/guides/server-integration.md`
- `docs/guides/tutorial.md`
- `docs/reference/index/interfaces/Builder.md`
- `docs/reference/index/interfaces/Module.md`
- `docs/reference/index/interfaces/ModuleBuilder.md`
- `docs/reference/index/interfaces/StartupOptions.md`
- `docs/reference/index/type-aliases/Complete.md`
- `docs/reference/index/type-aliases/ForkContext.md`
- `docs/reference/index/type-aliases/Overrides.md`
- `docs/reference/index/type-aliases/Selected.md`
- `docs/reference/index/type-aliases/Selection.md`
- `src/di-bag.ts`
- `src/startup.ts`
- `tests/runtime-scale.node.mjs`
- `tests/runtime-scale.test.ts`
- `tests/startup-runtime-fixture.ts`
- `tests/startup.test.ts`
- `tests/types/negative/startup.ts`
- `tests/types/startup-consumer.ts`
- `tests/types/startup.ts`
- `docs/benchmarks/results/2026-09-10-workload-controls/`: durable source/build identities, probes, recorder, manifests, raw logs, README and source patch.

## Final verification summary

- Covering runtime: 396/396 across 30 files; final affected startup 33/33 and scale 7/7 after added synchronous-abort/full-message checks.
- Emitted Node: 31/31 for classic and 31/31 for native, including all existing retention and cold-depth regressions.
- Source exact/negative/declaration contracts: 115/115, including startup positive numeric and negative boolean boundaries.
- Physical packages, unchanged host command: 81/81 including both native-package physical producer/deleted-producer scenarios; 1,731 expectations, 146.797 seconds. Restricted attempt retained separately.
- Both source typechecks passed again after final test-only edits; both measured production builds passed. Source files are unchanged from after measurements.
- docs:generate and docs:check pass (11 documentation tests, 108 generated API pages, 204 valid TypeScript blocks); tracked source diff --check passes. The later all-files staged check reports only exact raw-log/patch whitespace, intentionally preserved; the staged src/tests/guides/reference check passes.
- 48/48 workload workers passed; declared-depth feasibility separately retains 8 passing controls and 2 depth-1,000 stack failures.

Known limits are documented contract/workload limits, not hidden completion claims: observer pending memory needs producer/application control; host deadlines stop waiting without terminating ownership; numeric startup bounds selected workers rather than dependency fanout; declared adapter chains remain stack-limited and require separate architectural work for arbitrary depth. Root's final integrated requirements remain outstanding by division of responsibility.

Staged evidence whitespace triage: `git diff --cached --check` exits 2 for original npm/Bun trailing blank lines/diagnostic spaces and source-patch context lines, retained verbatim; `git diff --cached --check -- src tests docs/guides docs/reference` exits 0. Full outputs and exact command statuses are in durable `staged-all-diff-check.log` / `staged-source-docs-diff-check.log` and commands.jsonl. No evidence stripping or whitespace gate override was used.

## Commit and handoff

`e0b28defbf3d3f8c62afd4a4cd20d0dda46ef842` — feat(startup): bound selected readiness concurrency with workload evidence.

Post-commit `git status --short` is empty. Only explicit owned paths were staged. No workflow report or other SDD files are committed. No processes remain running under this task; root may resume heavy integration work. Scoped review is controller-owned and follows this handoff.
