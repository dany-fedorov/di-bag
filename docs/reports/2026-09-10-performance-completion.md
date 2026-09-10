# Performance improvements and remaining limits — 2026-09-10

> Later compiler follow-up: [completion token projection evidence](../benchmarks/results/2026-09-10-completion-token-projection/README.md) records successful original 1,000-binding valid, missing-token and incompatible-token cases on both compilers. It also records about 9.5% fewer type instantiations at 500 bindings. The separate 1,000-call named, replacement and module limits remain open; the historical measurements below retain their original source identities.

> Historical report: the measurements and checks below belong to source `079b001`, before native-provider metadata was integrated. The follow-ups are now published in [PR 3](https://github.com/dany-fedorov/di-bag/pull/3). See [current integration evidence](../benchmarks/results/2026-09-10-published-integration/README.md) for the combined source and [the subsequent CI monitor repair](../benchmarks/results/2026-09-10-supervisor-rss-fix/task-8-report.md). Historical publication statements below describe that earlier revision.

All seven runtime findings have a measured improvement. The integrated source
passes 1,043 tests, both compiler builds and 31 emitted Node regressions per
build. This is local verification, not publication or final CI proof. The first
fixes were merged in [PR 2](https://github.com/dany-fedorov/di-bag/pull/2); the
remaining changes are on `fix/persistent-graph-performance` and await publication.

This report compares the original audit source `da6ec93` with integrated source
`079b0013a19667247257509407704597a7ab3221`. The complete source fingerprint is
`84382e4dc6ff5edc7c89f9ec86ec8ec6f8618ba13c783a5939359bb3a3bc878a`.
Later evidence/documentation commits do not change the measured production code.
The unrelated metadata and box-adapter work in the original checkout is excluded.

## The seven runtime findings

Each original workload ran again in a fresh Node 24.20.0 process, serially,
with default stack, a 512 MiB old-space cap and a 30-second deadline. The exact
original probe, all 47 workload identities, source files and emitted JavaScript
were checked against the retained audit manifest. The final classic build is
the paired comparison; the native build is a second-emitter control. Timings
below use three-process medians where marked; the other measurements are single
observations, except deep cleanup, which has two observations per build. They
describe this host and are not portable latency guarantees.

| Audit finding / original workload | Original classic | Final classic | Final native | Change and result |
|---|---:|---:|---:|---|
| 1. Deep close, 10,000 owned services | Both runs overflow; **0 disposed**, including second close | **10,000 disposed** in both runs; median 26.11 ms | **10,000 disposed** in both runs; median 24.60 ms | Iterative disposal planning preserves dependency order and idempotence. |
| 2. Discarded borrowed transients, 10,000 arrays of 256 numbers | 35,554,024 retained heap bytes | 3,953,968 bytes | 3,954,336 bytes | Hand off exposed values and clear completed borrowed execution payloads. All 10,000 inspection attempts remain. |
| 3. Flat close, 10,000 trivial owned acquisitions, median | 508.66 ms | 19.46 ms | 17.42 ms | Reverse incoming-edge indexes remove repeated full-family scans. |
| 4. 10,000 cached proxy reads with 1,000 downstream services, median | 621.06 ms | 2.67 ms | 2.63 ms | Existing-edge fast path avoids repeated traversal; new-edge cycle search is iterative. |
| 5. Install a 1,000-provider module | 195.19 ms / 69,028,800 heap bytes | 6.20 ms / 489,088 bytes | 5.56 ms / 492,024 bytes | Share immutable lexical maps; normalize and protect each snapshot once. |
| 6. Add 5,000 providers individually | 5,416.39 ms | 26.45 ms | 24.51 ms | Persistent keyed storage and ordered contribution sequences share unchanged structure. |
| 6. Replace one public key 5,000 times | 4,024.71 ms / 4,386,920 heap bytes | 21.05 ms / 397,968 bytes | 18.53 ms / 399,680 bytes | Prune obsolete public bindings when no current public or private reference needs them. |
| 6. Create/close 100 scopes with one override on a 5,000-provider bag, median | 279.97 ms | 1.66 ms | 1.53 ms | Scope overrides reuse the persistent graph. |
| 7. Cold raw named chain of 1,000 providers | Stack overflow after 758 factory entries | Value 1,000; exactly 1,000 calls; 11.45 ms | Value 1,000; exactly 1,000 calls; 10.67 ms | Direct operation-free invocation and shared ancestry reduce nested frames and history work. |

The complete collection has **135 accepted observations out of 141**. All six
failures remain: original cold chains of 1,000 and 2,000; two original deep-close
failures; and final cold chains of 2,000 on both emitters. The final 2,000-node
failures enter 1,148 factories before overflowing. Factory depth is still finite;
the result is not arbitrary-depth resolution.

Transient inspection and cycle metadata intentionally grow with successful
acquisitions while the bag remains open. Owned values remain retained until
their exact disposal obligations finish. Separate GC regressions verify borrowed
native promises and mapped payloads become collectible, while 10,000 owned
arrays are disposed with their original identities. Failed attempts, pending
sources, retained dependency proxies and exact exposed promise identity retain
their established behavior.

Storage tests cover immutable older builders, symbol identity and collisions,
contribution order, lexical references, roots, module replacement position and
last-current-user pruning. A contribution getter regression verifies one frozen
snapshot supplies both storage and private-reference protection. Constructor-only
private registrations keep their original preflight checks. Referenced private
cycles can be conservatively retained. On older hosts without weak symbol keys,
the functional fallback can have poor same-description symbol scaling; the
tested Node, Bun, Deno and Chromium lanes support the efficient path.

The final scale regressions also cover removal of a retiring consumer's reverse
index entries and the exact first dependency-order path in a branching late
cycle, including rejection without edge insertion.

### Costs that increased

The original bulk-add control takes 5.40 ms; final classic/native take
10.42/9.61 ms. Retained heap for 5,000 distinct bindings grows from 2,883,456 bytes
to 3,390,776/3,380,952 bytes. The short direct cached-read control grows from
0.69 ms to 1.59/1.45 ms per 10,000 reads. Persistent storage therefore improves
updates and shared versions at a cost to bulk construction, a unique graph's
footprint and direct lookup. It does not improve every operation.

The separate Task 2 warmed 500,000-read control, compared with the acquisition
fix revision rather than original main, measured approximately 10.6 ns additional
direct-read cost and 6.7 ns additional proxy-read cost. Task 2 also measured
5,000 module-local additions improving from 1,730 ms to 24.5 ms, while a single
5,000-provider installation rose from 11.1 ms to 20.6 ms relative to that already
optimized baseline. Baselines are different; these values do not replace the
original-main comparison above.

Runtime evidence: [141 rows](../benchmarks/results/2026-09-10-integration/runtime/rows.jsonl),
[derived summary](../benchmarks/results/2026-09-10-integration/runtime/summary.json),
[source/build manifest](../benchmarks/results/2026-09-10-integration/runtime/manifest.json),
[controller identity checks](../benchmarks/results/2026-09-10-integration/runtime/controller-verification.json),
[acquisition controls](../benchmarks/results/2026-09-10-acquisition-performance/README.md)
and [persistent-storage controls](../benchmarks/results/2026-09-10-graph-performance/README.md).

## Compiler work and unsupported scale

The type-only optimization caches exact historical token validation when an
incoming registration adds no symbol keys and skips exclusion work for disjoint
keys. It preserves manual opaque-error histories, never-valued entries, inference,
error priority and emitted declarations. A faster historical shortcut that
discarded opaque history was rejected after a failing characterization.

The complete original 108-case matrix at the Task 3 revision accepts **85 rows**
and retains **23 failures**. All 72 cases at 100/500 operations pass. At 1,000,
bulk/grouped cases pass on both compilers; the original fluent named, replacement,
binding and module forms retain stack, time, memory or excessive-instantiation
failures. Grouped controls are separate supported forms, not replacements for
failed fluent measurements. Default stacks, worker deadlines, RSS bounds,
output bounds and diagnostic admission rules were not relaxed.

Task 3's 500-operation instantiation reductions are approximately 9.2% for named
chains, 4.3% for token bindings and 3.0% for token modules on both compilers.
Replacement instantiations are effectively unchanged (classic +0.004%). The
final integration repeats the 24 original valid 100/500/1,000 cases against the
complete current source: **all 16 cases at 100/500 pass; all eight at 1,000 fail**.
The earlier 108 rows retain their original source identity; they are not relabeled
as integration measurements.

| Original 500-operation form | Before classic instantiations | Final classic | Change | Final native |
|---|---:|---:|---:|---:|
| Named chain | 17,513,384 | 15,908,236 | −9.17% | 15,891,888 |
| Token bindings | 28,500,443 | 27,268,544 | −4.32% | 27,216,386 |
| Token modules | 41,317,025 | 40,084,626 | −2.98% | 40,070,062 |
| Replacement | 31,198,119 | 31,199,254 | +0.004% | 31,185,191 |

Final 1,000-operation classic named/replacement workers crash in type
instantiation; classic bindings/modules time out. Native named/modules time out,
replacement exceeds the 3,072 MiB RSS bound, and bindings reports TS2589 despite
reducing instantiations from 106,155,886 to 101,192,006. The native module row hit
the time bound in this run, whereas the earlier valid matrix row hit memory;
both observations remain failures. Worker bounds are 60 seconds, 3,072 MiB and
4 MiB captured output, with unchanged default stacks. The original separate
30-second/1,024 MiB classic audit still crashes for chained 1,000; grouped 1,000
passes with zero diagnostics, 2,582,355 instantiations, 3,460 ms and 594 MiB RSS.

All completed work counters differ from the Task 3 matrix by only the additional
13 classic / 16 native instantiations introduced with the numeric startup option.
The [integration compiler summary](../benchmarks/results/2026-09-10-integration/compiler/summary.json)
verifies identical compiler packages, generators and harnesses against the fresh
Task 3 baseline and records every comparison.

Library-free controls run through matching compiler Program APIs in both script
and external-module contexts. Classic's 1,000-operation controls encounter
binder/flow stack limits, while the DI cases crash later in type instantiation;
the controls do not prove those different crashes have a single cause. Native's
plain 1,000-operation syntax control passes; a minimal generic accumulating chain
times out, but a minimal generic replacement chain passes. The DI replacement
memory failure therefore remains a library/type-shape limitation. There is no
claim that all 1,000-operation failures are unavoidable upstream defects.

Exact positive/negative source and physical package gates pass on both compilers.
The independent replacement audit initially exposed three new diagnostic markers
missing from its literal inventory. The fix adds those exact expectations and
updates the fixed total from 103 to 106; marker-removal and weakened-boundary
rejection tests are preserved. The full suite passes after this correction.

Evidence: [Task 3 report and experiments](../benchmarks/results/2026-09-10-compiler-performance/task-3-report.md),
[final integration rows](../benchmarks/results/2026-09-10-integration/compiler/rows.jsonl),
[original audit spot checks](../benchmarks/results/2026-09-10-integration/compiler-spotchecks/commands.jsonl)
and [inventory repair](../benchmarks/results/2026-09-10-compiler-performance/integration-fix-round-1/README.md).
The controller also preserved the pre-existing Task 2 build snapshots' byte-for-byte
match with reconstructed Task 3 baseline builds in a
[durable crosscheck](../benchmarks/results/2026-09-10-integration/task-3-controller-baseline-build-crosscheck.json).
Reconstructed builds are not presented as dedicated pre-edit observations.

## Startup, observer load and cleanup waits

`StartupOptions.concurrency` now accepts a positive safe integer as well as
`parallel` and `sequential`. Selecting 96 asynchronous providers with concurrency
8 reduces peak active application workspaces from 24 MiB to 2 MiB, with roughly
61 ms startup instead of 22 ms parallel or 475 ms sequential on the measured
classic build. All 96 providers run and dispose exactly once. This bounds selected
readiness workers; dependencies inside a selected provider may still fan out.
The default stays eager parallel. Failure/cancellation stops further admission
and drains already-started owned work through the existing cleanup contract.

Observer bursts were measured with synchronous delivery and externally rooted
pending callbacks. Ten thousand acquisitions queue 20,000 events; slow callbacks
can retain their promises, original events and application gates until settled.
All events retain order, and 200 deliberate callback failures reach `onError`
exactly once in order. Lossless production that never waits for consumers cannot
promise finite retention for an indefinitely slower observer. Documentation now
explains application batching and producer control; no events are silently dropped.

Never-settling sources or disposers can keep `close()` pending. A handled host
deadline can stop the application's wait while preserving the identical original
close promise and eventual disposal/error reporting. Tests release source and
disposer gates after the deadline and verify exact cleanup. The library does not
claim arbitrary user promises can be forcibly settled.

The declared positional-token investigation passes depths 100/500 but still
overflows at 1,000 before user callbacks run. A prewalk experiment changes
transient call counts, values and event order, so it was rejected. A compatible
iterative argument-frame route requires splitting acquisition initialization,
argument handoff and source execution while retaining consumer ownership and
lazy semantics; that architecture is documented, not implemented in this change.

[Workload report, measurements and feasibility analysis](../benchmarks/results/2026-09-10-workload-controls/README.md)
retain both failures and application/library memory distinctions. Tutorial,
server guidance and generated API references cover the new startup option and
existing observer/cleanup contracts.

## Integration, review and publication status

- `npm run check`: **1,043 passed, zero failed**, 19,236 assertions; 478.10 seconds
  in the test runner, 485.81 seconds for typecheck, suite and classic build.
- Native typecheck/build and emitted Node regressions: pass; **31 tests on each
  emitter**. Strict native diagnostics: **674/674 markers across 124 files**.
- Documentation check: pass, including 11 tests and current generated references.
  Required Node/Bun/Deno/Chromium portable artifacts and all nine examples pass.
- The first integration run's single inventory failure is preserved. The passing
  native/docs/platform/example gates used `e0b28de`; all 37 production source
  hashes are identical to `079b001`, whose full suite and classic Node gates were
  rerun after the audit-script/test-only repair.
- Restricted-sandbox subprocess failures are preserved separately. The final
  compiler collector's first sandbox attempt failed all 24 provenance captures
  with `spawnSync git EPERM` before compiler work. The unchanged bounded commands
  were rerun with approved host subprocess execution.

The CI supervisor repair accepts a child as exited after a fresh Linux zombie
status confirmation while retaining fail-closed monitoring for live children.
Package checks batch independent consumers without dropping either emitter,
module format, deleted-producer or negative contract. Measured package-only time
fell from 153.79 to 97.30 seconds; package-only max RSS rose from approximately
1.52 to 2.12 GiB. In the final full suite, the two package aggregates take
54.60 and 42.15 seconds, both within the unchanged 120-second deadlines.

The complete test command has a separate high memory cost: the initial GNU time
log reports 12.71 GiB max RSS. During the passing rerun, a read-only 0.5-second
sampler observes a maximum process-tree sum of 10.84 GiB and a largest Bun process
of 10.69 GiB. Those sampled maxima are observations, not exact upper bounds.
They describe the compiler-heavy test process, not library runtime payload memory.
Current hosted CI capacity and results remain to be verified after publication.

All task-scoped reviews passed, including the contribution-snapshot and diagnostic
inventory fixes. The [final whole-branch review](../benchmarks/results/2026-09-10-integration/reviews/final-review.md)
approved `10d7ac7..611bfef` with no Critical, Important or new actionable Minor
finding. No further source change was requested. It explicitly preserves the
historical baseline-snapshot qualification and unresolved scale limitations.
Publication is still pending: automatic approval
review rejected creating the follow-up PR twice because it would not accept a
tool-recorded goal as authorization to disclose the branch and benchmark artifacts
on GitHub. No PR or merge for these follow-ups is claimed.

The user goal remains active: follow-up publication, hosted CI and merge proof
are pending. The retained compiler/runtime depth failures,
observer backlog and uncooperative cleanup limits remain explicit contract limits.
