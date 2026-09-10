# Incremental dependency-check work

This candidate skips empty named comparisons, avoids filtering disjoint histories
for new token checks, and caches extraction of retained token requirements. Broad
string/any histories retain the original per-entry check. An explicit never-key
guard preserves generic wrappers whose registration type remains unresolved.
Incoming validation and error priority, output inference, runtime behavior,
retained consumer checks, generators and resource limits remain unchanged.

The named and binding work ceilings are tightened to 790,000 and 1,300,000
instantiations at 100 operations. Both fail on the baseline; the source gate
passes 123 tests with 502 assertions after the optimization. New public fixtures
cover incompatible bindings in any-key histories, error details with mixed
opaque/concrete token needs, and a generic never-key binding wrapper.

## Rejected prototypes and review

The first cached-token prototype incorrectly accepted mismatched token bindings
in manually annotated any-key histories. Numeric-intersection IsAny guards were
simplified to false through the constrained key type, so the final implementation
retains the original path for broad histories. The guard reproducer is retained.

Independent review then found a public generic regression: a never-key history
with an unresolved registration type could defer the cached token check and
reject a previously valid bind call. The guarded implementation reduces that
history before inspecting the registration. The regression probes produce zero
diagnostics on baseline and guarded source, two on the original unsafe cache,
and one on the broad-history-only repair.

The independent guarded comparison preserves 3,799 concrete semantic tuples,
all 38 existing generic rejection locations/codes and 62 function return types.
Eight already-rejected generic calls render internal helper names differently.
Two apparent alias differences are mutually assignable with identical admission
and error details; there is no claim of universally identical diagnostic text.
The initial fixture comparison preserves 642 raw diagnostics and 669 positive
variable types. New positive regression fixtures are validated separately.

Earlier prototypes before the final never-key guard still report TS2589 at 1,000 native bindings or
module installations. Reduced work or completion inside time/memory caps does
not make those cases accepted. They are exploratory results, not final committed
candidate acceptance rows.

## Final validation and scale results

Candidate `6e95bffd96c7ec23b7f09816d633636e587128e8` passes 96 package/declaration tests, both typechecks, all 639 native diagnostic checks and documentation validation. Final review found no remaining code or test issues. All 24 committed-source cases completed; collection completion is separate from fixture acceptance. Source,
fixtures and benchmark inputs are pinned in the accompanying manifests. All
scripts retain original absolute experiment paths; recreate the pinned checkouts
or adjust those path constants when reproducing.

The original serial collection used clean baseline `4eb654d` and candidate
`6e95bff`, unchanged generators, default stacks and the existing 60-second,
3,072-MiB and 4-MiB-output bounds. Node was 24.20.0, classic TypeScript 6.0.3,
native TypeScript 7.0.2. Local Bun gates used pinned Bun 1.4.0. All sixteen paired
500-operation cases were accepted.

| 500-operation form | Classic instantiations, before → after | Native instantiations, before → after |
| --- | ---: | ---: |
| chained | 14,782,360 → 14,414,026 (−2.49%) | 14,767,400 → 14,399,056 (−2.49%) |
| replacement | 27,951,123 → 27,940,071 (−0.04%) | 27,936,952 → 27,925,787 (−0.04%) |
| bindings | 26,136,168 → 23,629,621 (−9.59%) | 26,084,086 → 23,577,427 (−9.61%) |
| modules | 38,959,250 → 35,708,698 (−8.34%) | 38,946,551 → 35,695,884 (−8.35%) |

Replacement work is essentially unchanged. Time and memory are single fresh
process observations and do not establish a statistical trend. The following
table retains all memory costs, including increases. Native reported compiler
memory and full timings are in `measurements/summary.json` and the raw rows.

| 500-operation form | Classic peak MiB, before → after | Native sampled peak MiB, before → after |
| --- | ---: | ---: |
| chained | 1736.00 → 1648.00 | 639.69 → 631.63 |
| replacement | 2158.00 → 2194.00 | 1129.66 → 1133.29 |
| bindings | 2083.00 → 1778.00 | 879.66 → 826.85 |
| modules | 2189.00 → 2116.00 | 1023.61 → 1026.46 |

| Original 1,000-operation form | Classic result | Native result |
| --- | --- | --- |
| chained | compiler stack overflow | timeout |
| replacement | compiler stack overflow | memory |
| bindings | TS2589 | TS2589 |
| modules | worker timeout | TS2589 |

8 original 1,000-operation cases remain rejected. The full compiler scaling
goal remains open. Lower work or memory, and reaching a diagnostic within the
time limit, do not turn an error into an accepted case.

`measurements/rows.jsonl` retains all raw rows; its manifest pins commits and
source hashes. `collection-completed.json` records terminal collection state.
`artifact-sha256.json` covers every retained artifact except itself. Raw logs
retain their original whitespace, including blank lines at the end of the two
typecheck logs. The later evidence-only commit keeps source, tests, generators
and package inputs identical to this reviewed and measured candidate.
