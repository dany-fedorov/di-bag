# Performance Completion Implementation Plan

> **For agentic workers:** Use subagent-driven-development for independent tasks,
> with a read-only task review and an integrated final review.

**Goal:** Merge the first fixes and measurably improve every remaining audit finding.
**Architecture:** Separate transient payload lifetime from acquisition records,
use persistent immutable graph storage, reduce cold-resolution frames and shared
ancestry work, then optimize compiler checks against unchanged generators.
**Tech Stack:** TypeScript, Node 24.20.0, Bun, classic 6.0.3/native 7.0.2.
**Spec:** docs/superpowers/specs/2026-09-10-performance-completion-design.md

## Global Constraints

- Preserve exact exposed values and promise identity; do not replay user factories.
- Preserve cleanup ownership/order, cycle checks, lexical references, root/scoped
  boundaries and immutable previous builder views.
- Do not modify or publish the concurrent metadata refactor in the original checkout.
- No new runtime dependencies or global strong registries of collectible symbols.
- Use unchanged audit/compiler workloads and record all failed observations.
- Benchmarks run serially, separate from compiler/test load.
- Check results against the exact source/build being committed and merged.

## Task 0 — publish the first fixes

Files: existing first-fix source/tests/evidence and CI changes only.
- [x] Install isolated locked dependencies and run complete checks.
- [x] Commit only performance-related files, push, create PR against verified main.
- [x] Check remote reviews/checks, merge, and verify the merge on origin/main.

## Task 1 — transient payload retention and cold acquisition

Files: src/acquisition.ts, src/acquisition-family.ts, src/provider-execution.ts;
new focused runtime/Node tests and audit probes.
- [x] Write failing GC/retention probes for discarded borrowed transient arrays,
  native promises and mapped outputs; retain independent disposal/metadata oracles.
- [x] Add the original 1,000 raw-provider cold chain to Node regression coverage;
  assert final value 1000, exactly one invocation per factory, and preserved cycles.
- [x] Separate returned transient values from retained acquisition state, clear
  unnecessary fulfilled-stage references, and compact completed borrowed records
  where existing inspection and retained-proxy behavior can be preserved.
- [x] Specialize operation-free raw evaluation to remove wrapper frames, and
  replace copied ancestry with shared history plus effective active-cycle checks.
- [x] Run ownership, retry, metadata, lifetime and promise tests; record before/after
  heap and 100/500/1000/deeper cold-chain outcomes in fresh Node workers.
- [x] Commit the tested task, produce a report and obtain a scoped review.

Task 1 implementation notes and verification contract:
- Current payload references exist in Acquisition.exposed and ProviderExecution's
  final ValueStage.exposed/value. Hand-off applies at resolve, resolveCollection,
  dependency read and startup acquire (which discards output). Aliases must use the
  canonical lifetime. Ownership stages independently retain required disposal values.
- Clearing a stage must never precede map/frame processing or pending ownership
  acceptance. A ready projection can coexist with a pending source; readiness and
  shutdown source admission are deliberately independent. Keep failure errors and
  inspectFrames data. Record intentional per-attempt history overhead separately.
- A direct raw path inside resolveBinding can invoke create with no receiver,
  then publish a completed result to ProviderExecution. Restrict specialization to
  cases whose pipeline is provably equivalent; contextual providers can stay on
  the general path. Raw Promise/then-getter values must remain unobserved.
- Ancestry may become linked history. Preserve existing cycle label order when a
  cycle is found; an active binding+owner index can skip scans for unrelated
  creating/pending providers. Do not index every ready transient indefinitely.
- Measure the equivalent ordinary-function cold chain through the Node facade
  (automatic acquisition) too. If safely possible, improve that source path as
  well; retain automatic classification, then-getter checks, ownership acceptance
  and the existing source-throw behavior of asynchronous projection pipelines.
  The raw control stays mandatory; record any remaining automatic-mode limit.
- The 1,000-node Node regression must run without increased stack size. Test raw
  named factories exactly once, thenable identity, reentrant creating cycles,
  after-await cycles, retained lazy proxy cycles and root/scoped boundaries.
- Tests to inspect first: runtime-scale, acquisition-mode, disposal, lifetimes,
  observers, startup, dependency-references, inspection, async-cycle tests. Find
  actual files with rg. Run focused tests during iteration and complete runtime
  suites plus both typechecks/builds and Node regressions before commit. Controller
  owns the expensive package/compiler full check before merge.
- Keep meaningful GC tests in a separate Node file runnable with --expose-gc and
  --test-isolation=none; weak references require yielding to a new job before GC.
  Report the original transient-memory probe before/after (10,000 arrays of 256
  numbers), plus async and mapped outputs and cleanup identity controls.
- Existing initial evidence came from a metadata-refactor common tree. New paired
  evidence must use the actual merged main source as baseline; preserve source and
  build hashes and every failed cold-chain row. Use a new results subdirectory.
- You may change tests/runtime-scale.test.ts where internal ancestry type changes;
  preserve its existing work-count and disposal assertions. Add Node invocation
  to CI if a new --expose-gc test is introduced. No public type-only changes.

## Task 2 — persistent graph storage and obsolete bindings

Files: src/runtime.ts, src/module.ts runtime storage, new private persistent storage
helpers, storage/runtime tests.
Consumes: unchanged BindingGraph public internal methods. Produces: the same methods
with structural sharing, collision-safe string/symbol lookup and safe pruning.
- [x] Add regressions for earlier builder immutability, colliding keys, token identity,
  private references, shared roots and contribution order during repeated updates.
- [x] Record 100/1,000/5,000 incremental/bulk/replacement/scope/contribution baselines.
- [x] Implement persistent lookup storage with bounded-depth iterative lookup and
  path copying; avoid full-table cloning or retaining ancestor wrapper objects.
- [x] Store contributions with cheap persistent append and lazy ordered materialization.
- [x] Track public/private reachability needed to prune obsolete replaced bindings
  without deleting lexical private targets or changing parent-owned root behavior.
- [x] Run graph/module/scope/token/contribution/alias and emitted runtime tests;
  prove construction and retained-memory improvements on original workloads.
- [x] Commit the tested task, produce a report and obtain a scoped review.

Task 2 compatibility and measurement notes:
- The public builder and runtime use symbol identity, including distinct tokens
  with the same description. Test many same-description keys as a performance
  case as well as a correctness case; label-only hashing must not silently
  recreate quadratic construction in the supported platform lanes.
- Keep graph lookup methods stable. Native per-graph caches may retain only keys
  already owned by that graph; new versions must not retain prior wrapper/cache
  objects or obsolete binding IDs. A combined descriptor/normalized entry can
  avoid duplicate persistent-table work if it stays private.
- Preserve the existing runtime requirements. If symbol WeakMap keys are used for
  hashing, verify support on the tested hosts and provide a functional fallback
  for hosts without that capability; do not require a global strong symbol index.
- Lexical maps are shared snapshots: scan each distinct map once when building
  private-reference protection. Repeating its full scan per binding reintroduces
  finding 5. Safe conservative retention for still-referenced private bindings
  must be explained separately from the unreferenced public replacement workload.
- Bulk insertion, repeated contribution append, replacement and scoped override
  are separate measurements. Check warm resolution/proxy reads after the storage
  change so construction improvements do not conceal a hot-path regression.
- Count current users of each shared lexical snapshot and its protected private IDs.
  Protection must not survive merely because an earlier graph used that snapshot.
  When the last current user disappears, prune newly unreferenced former public
  bindings without rescanning the whole graph; retain constructor-only private
  registrations and existing private references for their original preflight contract.
- Apply the same storage helpers to module-local registrations and contributions:
  their measured 5,000 incremental additions take about 1.7 seconds before this
  change. Preserve lexical declaration order, the position of replaced keys,
  immutable prior builders, exported snapshots and rename behavior. Materialize
  the existing ModuleDescription at the export boundary. Keep public type
  signatures unchanged and retain paired module-local measurements.

## Task 3 — compiler bottlenecks

Files: type-only helpers and narrowly justified builder signatures; compiler probes,
scale gates and documentation. Do not modify runtime task files.
- [x] Reproduce named/token/module 100/500/1000 costs with bounded original workers.
- [x] Trace excessive instantiations against existing prior experiments and type helpers.
- [x] Test one semantic-preserving optimization at a time; preserve inference and
  all intended negative boundaries. Do not count an incidental diagnostic as success.
- [x] Isolate remaining stack/parser limits with library-free controls; preserve both
  original failures and supported controls in the report.
- [x] Run complete positive/negative source and emitted declaration checks on both
  compilers, retain fresh instantiation/time/RSS evidence, then commit and review.

## Task 4 — remaining workload risks and integrated completion

Files: observers/startup/close only where measurements establish a justified change;
workload tests, docs and final evidence ledger.
- [x] Measure slow-observer producer load, bounded selected startup and uncooperative
  acquisition/cleanup waits. Record contract limits and application work separately.
- [x] Implement and test explicit bounded mechanisms as needed without silently
  dropping ownership obligations or breaking default API contracts.
- [x] Re-run every audit finding's before/after probes against the integrated build.
- [ ] Run full checks and an independent whole-branch review; fix blocking findings.
- [ ] Push and merge follow-up changes, verify remote state and exact merged checks.
- [x] Produce a requirement-by-requirement completion audit. Leave the goal active
  if any original finding lacks a demonstrated improvement or required merge proof.

## Task 5 — repair archive checksum path false positive (merge prerequisite)

Files: scripts/create-release-manifest.ts, tests/release-artifacts.test.ts only.
- The full check and isolated archive verifier fail because assertPublicPathSafe
  treats a legitimate integrity digest containing `+/` as an absolute path.
  Evidence: /tmp/di-bag-archive-diagnostic.log; temporary diagnostic edit reverted.
- Add a deterministic regression using valid SHA512 SRI with `+/` (and a leading
  slash in the base64 part) in the package integrity field. Preserve rejection
  of actual absolute paths in public fields and command args, including values
  masquerading as integrity but failing the exact canonical digest shape.
- Make the smallest field-aware fix. Do not exempt arbitrary strings containing
  sha512, general plus/slash text, or arbitrary keys/unknown nested objects from
  absolute-path checks. Existing archive digest validation must still run.
- Keep existing static verifier mutation tests working: malformed path-free
  integrity can still be diagnosed by the static verifier, as currently.
- TDD: focused failing test before code, passing release-artifacts file afterward;
  run classic/native typechecks. Full suite controller handles after your report.
- Work at /tmp/di-bag-performance-integration, branch fix/runtime-performance.
  Commit only these two files. Other source/test/docs changes belong to root.
- Do not dispatch subagents. No network/push/merge. Preserve all unrelated edits.
- Full report: implementation, exact red/green commands/results, changed files,
  self-review concerns; return only status, commit, test summary, report path.


## Task 6 — repair CI process monitoring and aggregate package checks

Files: scripts/native-process.ts, tests/native-process.test.ts, narrowly scoped
native-package test organization, focused verification/evidence documentation.
Runs after Task 2 review and before Task 3 compiler optimization.

- [x] Reproduce the process-monitor false failure with a deterministic real-child
  exit-order control. Acquisition CI 34420434125 rejected a successful classic
  declaration build with status 0, signal null and terminationReason monitor.
  Preserve the exact failure and investigate the exit/error ordering before edits.
- [x] Distinguish a running child from an exited zombie when Linux status reads
  race child-exit notification. Preserve fail-closed monitoring for live children,
  unchanged per-worker time/RSS/output limits, stream drainage and child reaping.
- [x] Reproduce and diagnose the aggregate native-package test deadline failures.
  Each emitter test currently runs both CJS/ESM consumers and many independent
  source/emitted-declaration checks under one 120-second test deadline. Preserve
  every contract, both emitters, both consumers and deleted-producer assertions.
  Prefer removing repeated work; splitting independent format cases is permitted
  if needed to make the test deadline cover a meaningful unit. Do not increase
  compiler worker limits or change original scale generators/acceptance rules.
- [x] Run focused process-supervisor tests, full release-artifact and native-package
  checks, both typechecks, retain exact results, commit and obtain scoped review.
  Full integrated checks remain the controller's responsibility after Task 3/4.
