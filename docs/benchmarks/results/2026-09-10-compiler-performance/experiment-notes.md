# Compiler-only experiments

All experiments use unchanged generators and supervised selected-case workers.
Numbered directories retain source snapshots and raw commands. Rejected changes
were reverted; no runtime source was changed.

| Experiment | Classic 100 chained | Classic 100 bindings | Decision |
| --- | ---: | ---: | --- |
| Fresh BASE | 905,984 | 1,483,243 | Baseline |
| 1: aggregate empty token needs | 912,486 | not run | Rejected: named work increased |
| 2: cache opaque errors for string-key arrivals | 850,067 | 1,436,931 | Retained as basis |
| 3: additionally remove symbol-free incoming lookup maps | 844,820 | 1,461,876 | Rejected: token work increased versus experiment 2 |
| 4: skip exclusion for disjoint keys | 835,123 | 1,436,931 | Provisional; never-key over-rejection found in self-review |
| 5: additionally skip empty named Pick comparisons | 825,222 | 1,505,636 | Rejected: token work increased beyond BASE |
| 6: share five-parameter Provider inference alone | 907,135 | 1,497,045 | Rejected: both workloads increased |
| 7: aggregate token-key overlap | 951,113 | 1,681,183 | Rejected: work increased; opaque unions risk losing exact invalid keys |
| Final: preserve exclusion of never-key entries | 845,023 | 1,436,931 | Retained; exact never-key RED is fixed |

Experiment 1 retains its direct raw row and source in the top-level hypothesis-1
files. Experiment 6 was measured alone against BASE after the scan variants
produced diminishing returns. Its provider source is retained; the final provider
implementation is identical to BASE.

The historical 14–19% named shortcut returned `never` whenever the incoming map
had no symbol keys. The retained historical source and SHA-256 identify that
implementation. Applying it to current BASE fails the exact helper assertion and
drops two manual opaque-history diagnostics in
`historical-shortcut-contract-red.log`. Final completion still rejects the opaque
graph, but the admission boundary changes. Current requirements preserve this
boundary, so the cached helper retains `WrongToken<needs, {}>`. The prior report's
larger combined token shortcut is historical evidence, not a transferable fresh
result. Its exact combined implementation was not recovered here, so its reported
percentages are not projected onto this implementation. The current incoming-map
variant regressed token work and was rejected; this does not rule out every
possible faster equivalent formulation.

Initial `work-red.log` is an environmental failure: sandboxed Bun returned empty
Node child stdout with exit zero, also reproduced by a tiny `console.log(123)`
child. The real-host rerun produced the intended work RED. No compiler, harness,
acceptance rule or resource ceiling changed for this environment issue.

Initial aspirational work ceilings were not plan requirements. Rounded final
ceilings were rechecked on exact BASE in `final-ceilings-red.log`. The existing
optional historical 25% experiment switch remains untouched and is not a gate
adopted by this plan.

The disjoint-key shortcut initially overlooked a degenerate entry with `key:
never`: original exclusion removes that entry for every incoming map. The new
exact assertion failed (`never-key-red.log`). Filtering never-key entries inside
the cached helper restores that behavior; final source/work verification passes
all 118 tests. Intermediate gates remain separately labeled. The corrected
classic 500-chain count is 15,908,223 versus 17,513,384 before (9.2% reduction).
