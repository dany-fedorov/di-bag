# Current-main integration verification

This directory records the candidate that combines the performance work with
published native-provider metadata main. The branch is published in
[PR 3](https://github.com/dany-fedorov/di-bag/pull/3); hosted checks and merge proof
are still pending at this evidence revision. Candidate source is
`04818af869e762a02fb66b7d1b9df07f54dfb650`, whose
parents include performance `3a93cda` and published main
`f5eb4d363e2769c6553d470fff13d3f1ee19f425`.

Earlier evidence in `../2026-09-10-integration/` remains historical evidence from
the pre-metadata source. It is not relabeled as measurements of this candidate.
The [Task 7 integration report](../2026-09-10-main-integration/README.md) records
manual test/fixture migrations, current source identities and focused checks.

## Original runtime audit repeated

All original 47 workloads ran in fresh serial Node 24.20.0 processes on original
classic source `da6ec93` and both current-candidate emits. Original probe and
workload identities are unchanged. Default stack, 512 MiB old space and a
30-second deadline are unchanged. Source, builds and raw observations were
reconciled by the controller. All 141 observations remain in `runtime/rows.jsonl`;
135 are accepted. The six failures are original cold 1,000/2,000, two original
10,000-deep closes, and final cold 2,000 on both emits.

| Original workload | Original classic | Combined classic | Combined native |
|---|---:|---:|---:|
| Flat close 10,000, median of three | 550.19 ms | 17.26 ms | 14.90 ms |
| Deep close 10,000, two observations | 0 disposed in both | All 10,000 disposed in both; median 25.89 ms | All 10,000 disposed in both; median 23.83 ms |
| Borrowed transient retained heap, 10,000 arrays of 256 | 35,554,000 bytes | 3,954,904 bytes | 3,955,064 bytes |
| 10,000 warm proxy reads, 1,000 downstream, median of three | 638.18 ms | 2.71 ms | 2.65 ms |
| Module installation, 1,000 providers | 188.46 ms / 69,028,800 heap bytes | 5.63 ms / 498,192 bytes | 5.34 ms / 491,712 bytes |
| 5,000 incremental registrations | 5,361.91 ms | 24.84 ms | 31.96 ms |
| 5,000 replacements | 3,991.66 ms / 4,386,912 heap bytes | 21.31 ms / 398,360 bytes | 18.06 ms / 398,064 bytes |
| 100 one-override scopes on 5,000 providers, median of three | 278.98 ms | 1.55 ms | 1.62 ms |
| Cold raw named 1,000 chain | Stack overflow | Value 1,000, exactly 1,000 calls, 10.51 ms | Value 1,000, exactly 1,000 calls, 10.84 ms |

Unmarked measurements are single observations. Costs that increased remain:
bulk 5,000 registration takes 5.72 ms originally versus 11.77/10.03 ms; retained
heap for a distinct 5,000-provider graph grows from 2,880,472 bytes to
3,380,592/3,380,568; the short direct-read median grows from 0.67 ms to
1.45/1.42 ms per 10,000 reads. These are host observations, not latency guarantees.
Transient inspection still retains 10,000 attempts while the bag stays open;
owned payloads remain independently retained until exact disposal completes.

`runtime/manifest.json` contains source/build/tool identities; `commands.jsonl`
contains every subprocess status and output; `summary.json` contains medians of
accepted observations only alongside all failures. A collector's successful exit
means recording completed, not that every workload passed.

## Compiler and merge verification

`compiler-before/` captures the unchanged original 100/500 valid workloads from
exact current main `f5eb4d3`. `compiler-after/` captures original 100/500/1,000
valid workloads from the combined candidate. Both use pinned classic 6.0.3 and
native 7.0.2, unchanged default stacks, 60-second workers, 3,072 MiB bounds and
4 MiB captured output. Failed cases are retained. The complete earlier 108-case
matrix remains at its recorded source revision in the compiler-performance
directory. Current strict source/package diagnostic gates separately verify
native-provider metadata contracts.

Both baseline and combined candidate pass all 16 cases at 100/500. All eight
combined-candidate 1,000-operation fluent cases fail. Classic named/replacement
crash in type instantiation, classic bindings/modules time out, native named
times out, native replacement/modules exceed the RSS limit, and native bindings
reports TS2589. The original separate classic 30-second/1,024 MiB spot checks
still crash for chained 1,000; grouped 1,000 passes with zero diagnostics,
2,582,137 instantiations, 3,304 ms and 606 MiB RSS.

| 500-operation form | Main classic work | Combined classic work | Change | Main native work | Combined native work | Change |
|---|---:|---:|---:|---:|---:|---:|
| Named | 17,509,543 | 15,908,018 | −9.15% | 17,492,431 | 15,893,117 | −9.14% |
| Bindings | 28,496,602 | 27,268,326 | −4.31% | 28,442,393 | 27,216,308 | −4.31% |
| Modules | 41,313,184 | 40,084,408 | −2.97% | 41,298,244 | 40,071,768 | −2.97% |
| Replacement | 31,194,278 | 31,199,036 | +0.015% | 31,177,801 | 31,184,913 | +0.023% |

Work means compiler instantiations. `compiler-summary.json` and its reproducer
`summarize-compiler.py` reconcile all 40 rows, source snapshots, package identities
and original generated-source hashes. The sole harness difference is the reviewed
`scripts/native-process.ts` exit-race repair, verified against both Git revisions;
generator, remaining harness files, worker bounds and admission rules match.
The before selection covers 100/500 only; no new paired 1,000 baseline is claimed.
An initial controller summary assertion correctly caught this supervisor difference;
the reconciler now verifies the exact difference explicitly rather than treating
the two harness inventories as identical. Raw measurements were not changed.

The actual current native inventory is 639 markers across 124 source files,
with 106 primary plus one supplemental marker in the independent replacement
audit. Upstream's aggregate package-test deadline is now 300,000 ms; original
Task 6's 120-second measurements retain that historical limit. Compiler worker
limits were not changed. Publication, hosted CI and merge status must be read
from their explicit records, not inferred from this directory name.

The [independent integration review](integration-review.md) found no Critical,
Important or actionable Minor issue and required no production repair. The
original full-branch review remains in the historical integration directory.
The evidence commit `2dbcc30` leaves the measured source, tests, compiler helpers,
dependencies and workflows unchanged from `04818af`. Subsequent hosted CI exposed
a second process-monitor exit race: correct compiler exit statuses 0 and 2 were
rejected after repeated missing-RSS samples. The [narrow repair and regression
evidence](../2026-09-10-supervisor-rss-fix/task-8-report.md) at `21b137f` changes only
the supervisor and its tests. Production source, workload generators, worker
limits, dependencies and workflows remain identical to the measured candidate.
These measurements retain their original harness revision; hosted CI on the
repaired candidate remains the merge gate.
