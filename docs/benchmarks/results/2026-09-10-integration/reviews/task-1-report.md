# Task 1 report — transient payload lifetime and cold acquisition

Status: implementation and verification complete; controller owns scoped review and final integration. Base: `6771cb413ab02ef541e273543292ee1352438db7`. Branch: `fix/acquisition-performance`. Working tree: `/tmp/di-bag-performance-integration`. Original concurrent-refactor tree was untouched. No push or merge performed.

## Implementation

- `src/acquisition.ts`: canonical attempts record their transient lifetime. `takeExposed` reads the original returned value and clears only transient `exposed` storage. Public resolve, alias-routed resolve, collection reads, proxy dependency reads and startup acquire all use this handoff. Startup continues to wait on execution readiness rather than assimilating the exposed service.
- Operation-free, non-contextual factories invoke receiver-free directly inside `resolveBinding`. `publishSource` classifies/observes/owns the returned value after the factory call unwinds, eliminating the evaluate/capture/create wrapper frames from recursive dependency reads. Raw values stay entirely unobserved. Automatic/native sources retain the original classifier/then-getter/native-observer checks. Direct throws revoke source admission before retirement. Contextual sources and operation pipelines retain their general evaluation path and failure semantics.
- `src/provider-execution.ts`: each value stage is marked consumed only after its projections have captured their inputs and its ownership declarations have been processed. Consuming clears `exposed`/`value`, while native callbacks independently accept exact fulfilled ownership values and retain readiness/error state. Pending owner lists drain only after fulfillment/failure. A ready projection cannot cause premature source compaction while any source/projection work remains pending.
- Fully drained, ready, borrowed execution records compact to either a shared empty completed record or an attempt-specific record holding immutable frames. Inspection still returns fresh frozen arrays. Releasing a frame-bearing record drops its own frame reference without mutating prior snapshots or the shared empty record. Drain callbacks reference the attempt's current execution, avoiding closure retention of obsolete execution machinery through saved dependency proxies.
- `src/acquisition-family.ts`: linked ID-only ancestry shares history in O(1). An active binding+owner index gates ancestry materialization. Only a possible repeated active binding constructs the original ordered diagnostic path. Synchronous public reentry and post-await ancestry remain covered, while the existing iterative dependency-cycle traversal and retirement reverse index remain intact. Ready attempts leave the active index; attempt history remains available for inspection and retained proxies.
- No runtime dependencies, graph-storage edits, public type-helper changes, factory replay, promise wrapping, or larger stack settings.

## TDD and exact verification commands

All commands ran from `/tmp/di-bag-performance-integration`. Logs live under `docs/benchmarks/results/2026-09-10-acquisition-performance/`.

1. Wrote the initial GC and fresh-process raw cold-chain tests before production edits. Ran:

   `DI_BAG_RUNTIME_ENTRY=/tmp/di-bag-performance-first-fixes-baseline/dist/node.js node --expose-gc --test --test-isolation=none tests/acquisition-retention.node.mjs tests/runtime-scale.node.mjs`

   Exit 1; 8 pass, 9 fail: eight real retention failures and the fresh-worker 1,000 raw chain stack overflow (`node-red.log`). The first non-isolated cold-chain experiment was warmed by preceding tests and passed on the baseline; it was corrected to spawn a fresh worker. A separate baseline cold-only invocation also failed with RangeError (`cold-red.log`):

   `DI_BAG_RUNTIME_ENTRY=/tmp/di-bag-performance-first-fixes-baseline/dist/node.js node --test --test-isolation=none --test-name-pattern='cold-resolves' tests/runtime-scale.node.mjs`

2. After initial implementation, `npm run build:native` exited 0 and the same emitted Node command without the entry override passed 17/17 (`node-first-green.log`). Focused Bun tests exposed the existing frame snapshot identity oracle: 185 pass, 1 fail (`focused-first.log`). `CompletedExecution.inspectFrames` was corrected to return fresh frozen arrays.

3. Added automatic cold-chain and retained-proxy shutdown admission regressions before expanding the direct path. Ran:

   `node --test --test-isolation=none tests/runtime-scale.node.mjs`

   Exit 1; 9 pass, 2 fail: automatic 1,000 cold chain and raw direct-throw admission (`auto-and-failed-source-red.log`). Broadened only operation-free direct invocation and revoked admission for direct failure. Node became 20/20 (`node-second-green.log`). Focused Bun became 186/186 (`focused-green.log`). The focused command was:

   `bun test tests/runtime-scale.test.ts tests/acquisition.test.ts tests/acquisition-mode.test.ts tests/disposal.test.ts tests/lifetimes.test.ts tests/observers.test.ts tests/startup.test.ts tests/dependency-references.test.ts tests/projections.test.ts tests/box-adapters.test.ts tests/aliases.test.ts`

4. Self-review added the GC oracle for frame payloads after close while retaining a dependency proxy. Ran:

   `node --expose-gc --test --test-isolation=none tests/acquisition-retention.node.mjs`

   Exit 1; the new test retained one metadata object (`closed-frame-red.log`). Fixed attempt-specific frame release and removed obsolete-execution capture from the drain callback. The emitted Node suite then passed 21/21. Added the ready-projection/pending-owned-source GC/cleanup control; final emitted Node suites pass 22/22.

5. Reran the final complete Node test source against the merged-main baseline using the override command in step 1. Exit 1; 11 pass, 11 expected failures (`final-tests-baseline-red.log`). All nine borrowed payload scenarios and both raw/automatic cold chains fail on that baseline; cleanup identity, closed-frame release, cycles, raw identity, receivers and failed-proxy admission controls pass.

6. Full runtime-only suite, exit 0, 369 pass / 0 fail, 1,807 assertions (`runtime-tests.log`):

   `bun test tests/acquisition-mode.test.ts tests/acquisition.test.ts tests/aliases.test.ts tests/binding-graph.test.ts tests/boundaries.test.ts tests/box-adapters.test.ts tests/composition-adapters.test.ts tests/contributions.test.ts tests/dependency-references.test.ts tests/disposal.test.ts tests/enterprise-integration.test.ts tests/final-adversarial-integration.test.ts tests/lifetimes.test.ts tests/modules.test.ts tests/observers.test.ts tests/plugins.test.ts tests/projections.test.ts tests/providers.test.ts tests/runtime-scale.test.ts tests/runtime.test.ts tests/scopes.test.ts tests/selected-scope-runtime.test.ts tests/selected-scopes.test.ts tests/startup.test.ts tests/token-modules.test.ts tests/tokens.test.ts tests/wbs-scope.test.ts`

7. Both typechecks and builds exited 0:

   - `npm run typecheck` (`typecheck.log`, classic 6.0.3)
   - `npm run typecheck:native` (`typecheck-native.log`, native 7.0.2)
   - `npm run build` (`build-classic.log`)
   - `npm run build:native` (`build-native.log`)

   After each build, ran `node --expose-gc --test --test-isolation=none tests/acquisition-retention.node.mjs tests/runtime-scale.node.mjs`. Each exited 0 with 22 pass / 0 fail (`node-classic-green.log`, `node-native-green.log`). The classic and native emitted outputs were copied to separate temporary directories before measurement. CI invokes both tests after both emitters with `--expose-gc`.

8. An initially broader command also included `tests/types.test.ts`, `tests/incremental-scale.test.ts`, and `tests/token-scale.test.ts` in the runtime list. It ran 493 tests: 484 passed, 9 failed because child processes exited 0 but had empty stdout (`runtime-and-compiler-workers.log`). On controller instruction, after benchmarking reran exactly:

   `bun test tests/incremental-scale.test.ts tests/token-scale.test.ts`

   outside the process sandbox via `require_escalated`; exit 0, 9 pass / 0 fail / 66 assertions in 22.18 seconds (`compiler-workers-unsandboxed.log`). No compiler worker or type helpers were changed. Controller still owns the expensive full package/compiler/CI integration check.

## Measurement evidence

Executed `python3 docs/benchmarks/results/2026-09-10-acquisition-performance/run-paired.py`, exit 0. Controller was notified before and after; no heavy tests ran concurrently. Every baseline source file matched `git show 6771cb413ab02ef541e273543292ee1352438db7:src/<file>` byte-for-byte. The copied original probe is unchanged from the audit. The manifest captures both compiler versions, all source/build hashes, both probe hashes, runner hash and final Node-test hashes.

204 serial fresh Node 24.20.0 workers; 3 samples × 17 cases × 4 builds (classic/native, before/after). Each worker used `timeout 30s node --expose-gc --max-old-space-size=512 <probe> <entry> <scenario> <count> <sample>`. No stack-size override. `commands.jsonl` preserves exact argv, stdout, stderr and status; `observations.jsonl` retains all failed cold rows, including RangeErrors reported by workers that exited 0. `summary.json` has min/median/max; README.md has a compact table.

Classic medians:

| Case | Before | After |
| --- | ---: | ---: |
| Original 10,000 arrays × 256 numbers | 35,554,080 retained bytes | 3,958,792 retained bytes |
| Empty-payload 10,000 attempt-history control | 14,560,680 bytes | 3,890,112 bytes |
| Native transient memory | 37,737,632 bytes; 20,000 live weak targets | 4,754,752 bytes; 0 live weak targets |
| Mapped transient memory | 38,155,232 bytes; 10,000 live weak targets | 5,175,280 bytes; 0 live weak targets |
| Raw cold 100 | 3.220 ms | 1.604 ms |
| Raw cold 500 | 26.035 ms | 5.652 ms |
| Raw cold 1,000 | 0/3 successful; overflow | 3/3 successful; 10.981 ms |
| Auto cold 100 | 3.290 ms | 1.730 ms |
| Auto cold 500 | 22.934 ms | 5.404 ms |
| Auto cold 1,000 | 0/3 successful; overflow | 3/3 successful; 11.235 ms |

Native-emitter original-array medians: 35,554,032 → 3,959,744 retained bytes; raw cold 500: 25.364 → 5.945 ms; raw cold 1,000: overflow → 10.697 ms; auto cold 1,000: overflow → 11.500 ms. Both emitters preserve 10,000 inspection attempts. Native/mapped outputs are all collectible. Owned cleanup controls retain all 10,000 exact arrays through GC and dispose every one exactly once. Retaining those ownership values is intentional; only their redundant native-promise anchors disappear.

All 1,500/2,000/4,000 cold rows still overflow, raw and automatic, both emitters. Recorded failure depth rises from about 758 raw / 759 auto creations to 1,148. Their elapsed times are failure timing, not valid resolution performance. The required 1,000 cold case is fixed; arbitrary synchronous depth is not promised by this implementation.

## Changed files

- `src/acquisition.ts`
- `src/acquisition-family.ts`
- `src/provider-execution.ts`
- `tests/acquisition-retention.node.mjs` (new)
- `tests/runtime-scale.node.mjs`
- `tests/runtime-scale.test.ts` and `tests/lifetimes.test.ts` (internal ancestry fixture representation only)
- `.github/workflows/ci.yml` (GC suite after each emitter)
- `docs/benchmarks/results/2026-09-10-acquisition-performance/` (fresh probes, manifest, raw results, logs, summary and README)

The controller-owned `docs/superpowers/plans/2026-09-10-performance-completion.md` edit remains unstaged. This internal full report is not part of the library commit.

## Self-review and concerns

- Exact raw/native exposed identity and receiver-free calls remain covered; no factory replay or changed pipeline source-throw semantics.
- Ownership values are independent of consumed stage references. Ready final projections retain pending-source shutdown permission until source settlement. Cleanup ownership and reverse order are covered both by the full runtime suite and GC controls.
- Failed attempt IDs and incoming retirement edges remain distinct from retries. Completed borrowed attempt IDs/history remain retained for inspection and late-proxy cycles. The active index excludes ready attempts and is cleared on failure/settlement/release.
- Inspection frames retain present/absent values and nested metadata; calls still return fresh frozen arrays. Close drops per-attempt frame payloads while externally retained snapshots remain valid. The shared empty completed record is never mutated.
- Existing iterative deep graph disposal and late-cycle traversal fixes remain unchanged.
- Intentional lifetime history still costs about 3.9 MB per 10,000 empty transient attempts in this fixture. Values referenced by user metadata or retained user services remain intentionally reachable.
- Remaining limitation: deeper synchronous user-factory chains can exhaust Node's stack; all such rows are retained. Contextual and transformed provider pipelines retain their existing stack structure.
- The nine process-sandbox compiler-worker failures are resolved by the exact unsandboxed rerun and preserved as environmental evidence.
- Scoped review and final integration remain controller responsibilities; no subagents were spawned.

Final artifact check: source and final Node-test hashes still match the measured manifest. Text log trailing whitespace was normalized for `git diff --check`; paired command JSON retains exact stdout/stderr.

Implementation commit: `7c7d6678577af1b82f58934f0b6c05a8f537614e`. Final worktree status contains only the controller-owned plan edit.
