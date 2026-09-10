# Task 2 report — persistent graph and module storage

Status: implementation, self-review and final verification complete. Controller owns scoped review and final integration. Worktree `/tmp/di-bag-performance-integration`, branch `fix/persistent-graph-performance`, base `56e502e125fd29760f03493ea4b16f126edb145e`. No original-checkout changes, subagents, push, PR or merge. The controller extended scope to the measured ModuleBuilder copying problem and the CI command list.

## Implementation

- `src/persistent-map.ts`: private immutable bitmap trie, four hash bits per level, at most eight branch levels. Lookup and iteration are iterative; update/delete path copying is depth-bounded. Collision buckets compare complete string/symbol identity and collapse safely after deletion. No full-table cloning and no chain of prior wrappers. FNV-1a hashes strings/registered symbol keys; collectible local/well-known symbol identities use a process-global WeakMap. No process-global strong symbol registry.
- On hosts rejecting symbol WeakMap keys, local symbols hash their descriptions and collision buckets maintain identity correctness. This fallback is functional but many same-description symbols can make construction quadratic. It is not the scalable path claimed for tested hosts. Node24.20.0 and Bun1.4.2 exercise the real implementation; controller capability smoke also verifies Deno2.9.6 and Chromium153.0.8010.12. The portable full integration gate remains controller-owned.
- `src/persistent-sequence.ts`: private immutable append/concat nodes with iterative ordered materialization. Nodes never store materialized-array caches or version wrappers. Graph caches are per-current-graph only.
- `src/runtime.ts`: BindingGraph retains the same methods. Persistent tables combine immutable binding descriptions with normalized registrations. Native binding, registration, public-slot and contribution caches contain graph-owned keys only; derived graphs begin with fresh caches. Warm lookup methods access native caches directly and isolate persistent traversal to miss helpers.
- Public-reference counts preserve an ID exposed through multiple slots. Contributions retain their IDs independently. Each distinct input lexical map is snapshotted/scanned once, and frozen reference fields are reused rather than rereading getters. Snapshot-user counts and private-ID counts follow only currently retained bindings. Displaced former-public IDs become pruning candidates; removal iteratively releases lexical snapshots and any newly unprotected former-public targets. Constructor-only private registrations stay available to preflight. Dangling private references remain inspectable. Still-referenced private cycles are conservatively retained; no general graph cycle collector is promised.
- `src/module.ts`: ModuleBuilder uses the same private map/sequence helpers, with a separate insertion-key sequence to preserve declaration order and replacement positions. Exports materialize native snapshots once. Earlier builders, lexical exports/renames, contributions and aliases remain unchanged. Public signatures and constructor signatures are unchanged; emitted declaration differences add only private helper declarations.
- `.github/workflows/ci.yml`: both existing emitted-Node commands now also run `tests/graph-retention.node.mjs`, keeping `--expose-gc` and the existing two files.

## TDD and verification evidence

All commands below ran in the isolated worktree. Logs are under `docs/benchmarks/results/2026-09-10-graph-performance/`.

1. Before storage edits: `bun test tests/persistent-graph.test.ts` produced 6 pass / 2 expected failures (`graph-red.log`). `hasBinding` still returned true for obsolete public IDs after replacement, including the last of multiple public slots. The same test source included earlier-version stress, same-description symbol identity, known FNV collision strings, own special keys, private/public aliases, contribution order, shared lexical scans, dangling refs, unused-private preflight and parent-owned roots.
2. Before storage edits: `DI_BAG_RUNTIME_ENTRY=/tmp/di-bag-graph-before/classic/node.js node --expose-gc --test --test-isolation=none tests/graph-retention.node.mjs` failed the replacement-retention oracle: 300 obsolete factory/payload/ID weak targets remained reachable (`retention-red.log`). Old contribution arrays already released under the copying implementation; that control specifically guards against a persistent append implementation retaining old cached wrappers.
3. Initial persistent storage passed the focused graph/module/scope/token/contribution/alias suite (89/89, `focused-green.log`). Native/classic emitted intermediate suites passed 26 tests. Helper tests also check collision deletion and 20,000 mixed operations against an independent native-map oracle.
4. Controller clarified that private protection must follow live snapshots rather than ancestry. Wrote last-snapshot-user and 3,000-link iterative-pruning tests, then ran `bun test tests/persistent-graph.test.ts`: 8 pass / 2 expected failures (`live-private-red.log`). Implemented snapshot-user/private-ID counts and iterative pruning. `bun test tests/persistent-graph.test.ts tests/persistent-map.test.ts tests/binding-graph.test.ts tests/runtime-scale.test.ts` passed 25/25 (`live-private-green.log`). Final GC coverage also proves the displaced target IDs and payloads actually become collectible after removing the final consumer.
5. After controller authorized the module extension, `bun test tests/persistent-module.test.ts` produced 1 pass / 1 expected failure (`module-red.log`): adding one item revisited 2,001 existing native-map entries. After storage reuse, `bun test tests/persistent-module.test.ts tests/modules.test.ts tests/token-modules.test.ts tests/contributions.test.ts tests/aliases.test.ts` passed 51/51 (`module-green.log`). The work control now visits fewer than 10 entries. A behavior control preserves order, replacement position, renamed lexical exports and old builders.
6. An initial full runtime pass caught one real regression: the lexical `kind` getter was read twice (`runtime-initial.log`: 378 pass / 1 fail). Protection bookkeeping now reads the already-frozen copied reference. The focused snapshot rerun passed (`snapshot-green.log`). Initial typecheck failures were test-fixture typing issues: a dynamic map represented as a finite fixture, a token created without preserving its unique-symbol variable, a readonly-array annotation and invoking a contravariant normalized factory with an uncast argument. Their original diagnostics remain in `typecheck-initial.log`, `typecheck-native-initial.log` and `typecheck-module-initial.log`.
7. The added last-consumer GC test initially retained one payload because replacement closures were defined in the payload factory's lexical context. Moving those replacement functions outside that context made the payload collectible without changing production code. `node-private-gc-context-failure.log` preserves that fixture failure. `node-intermediate.log` is an intermediate emit run, not final evidence.
8. Fully warmed measurements exposed native-cache call/branch overhead. Kept the initial measurements and exact source snapshot under `initial-after/`; made direct cache access and cache-miss helper changes. A focused intermediate cache experiment is preserved in `hot-cache-focused.jsonl`, `hot-cache-manifest.json` and `hot-cache-runtime.ts.snapshot`. Then reran all final gates and the complete after measurement set. The optimization reduces but does not eliminate warmed-read overhead; see measured tradeoffs below.

Final focused command (`final-focused.log`), 81 pass / 0 fail:

`bun test tests/persistent-graph.test.ts tests/persistent-map.test.ts tests/persistent-module.test.ts tests/binding-graph.test.ts tests/runtime-scale.test.ts tests/modules.test.ts tests/contributions.test.ts tests/tokens.test.ts tests/aliases.test.ts`

Final full runtime-only command (`runtime-tests.log`), 383 pass / 0 fail / 15,010 assertions:

`bun test tests/acquisition-mode.test.ts tests/acquisition.test.ts tests/aliases.test.ts tests/binding-graph.test.ts tests/boundaries.test.ts tests/box-adapters.test.ts tests/composition-adapters.test.ts tests/contributions.test.ts tests/dependency-references.test.ts tests/disposal.test.ts tests/enterprise-integration.test.ts tests/final-adversarial-integration.test.ts tests/lifetimes.test.ts tests/modules.test.ts tests/observers.test.ts tests/plugins.test.ts tests/projections.test.ts tests/providers.test.ts tests/runtime-scale.test.ts tests/runtime.test.ts tests/scopes.test.ts tests/selected-scope-runtime.test.ts tests/selected-scopes.test.ts tests/startup.test.ts tests/token-modules.test.ts tests/tokens.test.ts tests/wbs-scope.test.ts tests/persistent-graph.test.ts tests/persistent-map.test.ts tests/persistent-module.test.ts`

Final full compiler gates, each exit 0 (serialized with `/tmp/di-bag-compiler-heavy.lock`):

- `npm run typecheck` (`typecheck.log`, classic6.0.3)
- `npm run typecheck:native` (`typecheck-native.log`, native7.0.2)
- `npm run build` (`build-classic.log`)
- `npm run build:native` (`build-native.log`)

After the classic emit, copied its outputs to `/tmp/di-bag-graph-after/classic` and ran:

`DI_BAG_RUNTIME_ENTRY=/tmp/di-bag-graph-after/classic/node.js node --expose-gc --test --test-isolation=none tests/acquisition-retention.node.mjs tests/runtime-scale.node.mjs tests/graph-retention.node.mjs`

After the native emit, copied outputs to `/tmp/di-bag-graph-after/native` and ran:

`node --expose-gc --test --test-isolation=none tests/acquisition-retention.node.mjs tests/runtime-scale.node.mjs tests/graph-retention.node.mjs`

Each exited 0, 27 pass / 0 fail (`node-classic-green.log`, `node-native-green.log`). The task adds 5 GC/fallback tests to the existing 22 acquisition/runtime emitted regressions. No compiler/package tests were included in the runtime-only command. No empty-output sandbox worker failures occurred in this task's final checks. The controller separately owns the existing CI supervisor/package timeout issues.

## Measurement source and artifact identity

Before changes, copied the exact base `src` and both production emits into `/tmp/di-bag-graph-before`. The runner verifies every baseline source file against `git show 56e502e125fd29760f03493ea4b16f126edb145e:src/<file>`. Final and baseline manifests record every source/build hash, compiler version, Node version and primary probe hash. `evidence-identity.json` records extra probes, final tests and workflow hashes. The original audit probe is byte-identical. Final source hashes were checked against the final measured manifest after all source edits.

Executed:

- `python3 docs/benchmarks/results/2026-09-10-graph-performance/run.py before`
- `python3 docs/benchmarks/results/2026-09-10-graph-performance/run-module.py`
- `python3 docs/benchmarks/results/2026-09-10-graph-performance/run.py after`
- `python3 docs/benchmarks/results/2026-09-10-graph-performance/run-module-after.py`
- `python3 docs/benchmarks/results/2026-09-10-graph-performance/run-hot.py`

Each runner exits 0 and preserves every child command/status/stdout/stderr. All measurements are serial fresh Node24.20.0 workers with `timeout 30s`, `--expose-gc`, `--max-old-space-size=512`, default stack, counts100/1,000/5,000, 3 samples per emitter. Root was notified before and after measurement phases; no controller heavy local work overlapped them. Construction is timed before GC, retained heap separately after forced GC. Old-builder stress is separate from current-only heap controls. Paired final data and initial experiments together cover 894 workers; the only six failures are baseline 5,000 retained-version heap exhaustion at the configured512MiB limit (recorded status1, no timeouts).

`README.md` provides the compact comparison, all scenario counts/min/median/max live in JSON, and raw stderr retains the baseline heap failures. Initial-after source was reconstructed exactly and verified against its recorded SHA256 before archiving; all other initial-after source files match the final source.

## Final selected measurements (classic, count5,000)

| Scenario | Metric | Before | Final |
| --- | --- | ---: | ---: |
| build-incremental | incrementalMs | 2,001.839 | 27.201 |
| build-incremental | retainedHeapBytes | 2,908,488.000 | 3,385,624.000 |
| replace-history | incrementalMs | 1,187.320 | 18.183 |
| replace-history | retainedHeapBytes | 4,407,128.000 | 404,640.000 |
| scope-override | overrideMs | 107.346 | 1.507 |
| module-install | installMs | 11.111 | 19.839 |
| module-install | retainedHeapBytes | 1,726,112.000 | 1,700,736.000 |
| incremental-tokens | elapsedMs | 1,854.798 | 14.661 |
| incremental-tokens | retainedHeapBytes | 2,863,112.000 | 3,771,072.000 |
| replacement-memory | elapsedMs | 1,229.269 | 22.428 |
| replacement-memory | retainedHeapBytes | 14,831,936.000 | 364,424.000 |
| contribution-append | elapsedMs | 1,217.769 | 14.480 |
| contribution-append | retainedHeapBytes | 2,846,920.000 | 3,359,504.000 |

Original bulk construction: 3.686→10.607ms. Fully warmed500k reads: direct19.483→22.301ms and proxy39.079→43.125ms; these imply approximately5.6ns and8.1ns additional cost per read. Keeping5,000 historical versions now succeeds at about9.47MB where all baseline workers exhausted512MiB. Both-emitter module-local comparisons and all min/median/max values are in the evidence README/JSON.

## Self-review and limits

- Reviewed the entire runtime/module diff and helper/test implementations. Public graph methods and module type signatures remain stable; provider execution and acquisition files are untouched.
- Live snapshot counts handle shared maps once, release private targets after the last current consumer, and process long release chains iteratively. Installation publishes all incoming private/contribution/public protection before releasing any overwritten binding description. Explicitly installed unused private records are retained for preflight.
- Private cycles with live references, constructor-only private bindings and deliberately retained old builders remain live by design. Unreferenced former-public replacement history does not remain live. Per-version caches never propagate to a new graph; both graph wrappers and cached contribution arrays have GC controls.
- The fallback on older hosts without weak symbol keys is correct but not asymptotically scalable for same-description symbols. No supported-runtime requirement or dependency was added.
- Bulk graph construction, one-shot module installation and current-only live-unique graph heap have regressions reported quantitatively in README. Fully warmed resolution/proxy reads also retain small absolute overhead despite the cache refinement. This task does not claim performance parity for those controls or arbitrary improvements to every operation.
- The controller owns independent scoped review, the full package/compiler/portable integration gates, and any final publication decisions. This report and internal briefs are not part of the library commit.

## Explicit files changed

- src/runtime.ts
- src/module.ts
- src/persistent-map.ts (new)
- src/persistent-sequence.ts (new)
- tests/persistent-graph.test.ts (new)
- tests/persistent-map.test.ts (new)
- tests/persistent-module.test.ts (new)
- tests/graph-retention.node.mjs (new)
- .github/workflows/ci.yml
- docs/benchmarks/results/2026-09-10-graph-performance/ (new probes, manifests, raw rows, summaries, source snapshots and logs)

Test-log trailing whitespace was normalized for git diff --check. Raw worker stdout/stderr remain exact JSON strings. The controller-owned plan edit remains unstaged.

Implementation commit: `cb88d0c061349229423131de563ffe5ed44a75d3` — `perf: share immutable graph and module storage and prune obsolete bindings`. Final commit whitespace check passes; only the controller-owned plan edit remains unstaged.

## Scoped-review fix round 1

Fix base: `8f763c8a25516c5ee911a2e95caeeb3f90227c2a`. Review: `task-2-review.md`, one Important issue. The contribution constructor snapshotted caller IDs for its persistent sequence, then iterated the original IDs again to derive pruning protection. A getter-backed array could supply a different ID on the second read. The fix creates one frozen array and uses it both for storage and contribution protection. No other runtime behavior or helper design changed.

RED command:

`bun test tests/persistent-graph.test.ts > docs/benchmarks/results/2026-09-10-graph-performance/review-fix-red.log 2>&1`

Exit 1, 10 pass / 1 fail. The new test expected `{ reads: 1, ids: [target], hasTarget: true }` after replacing the target's public slot; actual output was `{ reads: 2, ids: [target], hasTarget: false }`. This independently confirms the extra caller read and the resulting inconsistent contribution protection. After the assertion, the regression also resolves the replacement public service and the original contributed service.

GREEN covering command:

`bun test tests/persistent-graph.test.ts tests/binding-graph.test.ts tests/contributions.test.ts tests/modules.test.ts tests/token-modules.test.ts tests/persistent-module.test.ts tests/runtime-scale.test.ts > docs/benchmarks/results/2026-09-10-graph-performance/review-fix-green.log 2>&1`

Exit 0, 56 pass / 0 fail / 9,379 assertions. The new regression sees one caller read and successfully resolves both the replacement public service and the original contribution.

Reran the exact full runtime-only command listed above, now 384 pass / 0 fail / 15,013 assertions (`runtime-tests.log`). Reran `npm run typecheck`, `npm run typecheck:native`, `npm run build`, and `npm run build:native` under the shared compiler lock; all exit 0. After each emitter reran the exact Node commands listed above, including the classic entry override; each exits 0 with 27 pass / 0 fail. Logs remain `typecheck.log`, `typecheck-native.log`, `build-classic.log`, `build-native.log`, `node-classic-green.log`, and `node-native-green.log`.

Before editing production code, preserved the prior final measurement/verification artifacts under `docs/benchmarks/results/2026-09-10-graph-performance/pre-review-fix/`, including the exact previous runtime source snapshot. Also saved both previous emitted builds under `/tmp/di-bag-graph-pre-review-fix/{classic,native}` and verified their hashes and the runtime source against the archived manifest. Those archived rows describe the pre-review-fix source; their old `/tmp/di-bag-graph-after` paths have since been reused by refreshed emits.

After all gates passed, notified the controller before and after the measurement phase and reran:

- `python3 docs/benchmarks/results/2026-09-10-graph-performance/run.py after`
- `python3 docs/benchmarks/results/2026-09-10-graph-performance/run-module-after.py`
- `python3 docs/benchmarks/results/2026-09-10-graph-performance/run-hot.py`

All three runners exit 0; all 306 refreshed fresh Node workers exit 0 with valid observations, no timeouts or failures. Counts, heap/stack settings, sample counts, emitters and original workloads are unchanged. Final `manifest-after.json`, `evidence-identity.json`, and new `review-fix-identity.json` identify the revised source/builds/tests. The original before source/build manifest, graph before commands/rows/summaries, module before commands/rows/summaries, and original probe were verified byte-for-byte against the fix-base commit and remain unchanged. Every earlier failure and observation is preserved. The evidence now contains 1,200 actual timed workers across all phases, with only the same six historical baseline heap-exhaustion failures.

Updated README tables to the refreshed values; earlier metric prose/tables in this report describe the archived pre-review-fix measurements. Warm-read timings vary between runs and still do not justify a parity claim; the existing disclosed bulk/install/live-heap tradeoffs remain. No performance architecture change was made for this fix.

Files changed for this round: `src/runtime.ts`, `tests/persistent-graph.test.ts`, and the task-owned graph-performance evidence directory. The full report is internal and untracked. Self-review confirmed that both contribution consumers iterate the frozen snapshot and no caller-owned array is revisited. No other review concern or additional scope was introduced.

Fix-round commit: `e5e4b927e7b23279397e9fedbf416fa35ae2d13c` — `fix: protect contributions from their single input snapshot`. Final commit whitespace check passes and the working tree is clean.
