# Keep retained history out of replacement inference

The dependency-free named `replace` overload uses the retained registration map
to contextualize the new factory's output. That history is already fixed by the
builder. Wrapping this map in `NoInfer` reduces compiler work while retaining the
same `ReplacementOutput` calculation and the existing consumer constraints.

This is a bounded type-only change to `src/di-bag.ts`. It does not add builder
type parameters, cached validity flags, casts, runtime behavior, or resource
limits. The existing replacement work regression is tightened from 1,500,000 to
1,380,000 instantiations. It fails on the preceding implementation at 1,404,036.

## Measurements

The original `tests/compiler.ts` replacement generator is unchanged. Measurements
use Node 24.20.0, classic TypeScript 6.0.3 and native TypeScript 7.0.2, serially in
fresh workers. The 500/1,000 cases use the original supervisor's 60-second,
3,072-MiB and 4-MiB-output limits with the default stack.

| Original replacement case | Before instantiations | Candidate instantiations | Reduction |
| --- | ---: | ---: | ---: |
| Classic, 100 | 1,404,036 | 1,364,951 | 2.8% |
| Classic, 500 | 31,199,036 | 30,203,551 | 3.2% |
| Native, 500 | 31,184,913 | 30,189,436 | 3.2% |

The native 1,000-replacement case still exceeds the memory cap in both versions.
Those failed rows remain in `experiments/host-large-rows.json`. Native reported
memory at 500 was effectively unchanged (763,783 versus 763,743 KiB); this is a
compiler-work reduction, not a demonstrated memory-cap or stack-depth fix.

Measurements were made against merged source `892fe08`; the implementation branch
starts at `0fa322c`, which changes only supervisor tests and their evidence. Both
bases have the same production source tree. The final source manifest also
includes the explanatory comment added after source-contract verification.

## Investigation and validation

Removing the output check entirely reduced the 100-case count to 754,809, locating
a substantial cost. That ablation is explicitly unsafe and discarded. Direct
entry distribution and entry filtering were also discarded: their handling of
manually annotated overlapping histories differs from reconstructing the map
first. Registration aliases, requirement maps, a dependency index, consumer-map
filtering, and key-filter variants did not improve work. Two initial dependency
index prototypes produced TS2536 and are retained as failed experiments, not
accepted benchmarks. Only the `NoInfer` history adjustment is proposed.

All raw rows, throwaway source snapshots and probe scripts are retained in
`experiments`. The first six large-case attempts failed because the sandbox
blocked the harness's synchronous Git subprocess; host reruns are separate and
keep that evidence. No unsuccessful run is presented as a passing workload.

After the measured change, all 123 source-contract, work-count and strict native
replacement-diagnostic tests passed, with 502 assertions, in 93.19 seconds using
the CI-pinned Bun 1.4.0. This includes exact builder histories, replacement
reflection, surviving local/module consumers, provider metadata and negative
diagnostics. Packaged declaration validation passed all 96 tests (1,782 assertions), including both emitters and consumers. Both source typechecks passed, and the complete native audit matched all 639 diagnostic regions across 124 files with no failures. Documentation checks passed after regenerating the three API pages affected by the declaration change. The initial missing documentation dependency and stale-page results are retained separately. Independent review is pending.
