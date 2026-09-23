# Phase 09 provider-facade compiler evidence

The measured candidate is `c19880d39c51ee8ef8af6ba26d1c1b5124ce4d58` (`phase-09-provider-methods`), with a clean tracked tree. Task 4 is complete; compatibility decorators still exist at this checkpoint, so the old and new provider workers ran against the same source. The twelve standard generators retain the Phase 8 source bytes and topology: there were no old lifetime/disposal decoration sites in those generators to migrate. The separate 100-provider worker compares the old decorator shape with the selected facade shape.

## Toolchain and guarded commands

All successful runs used Node `v24.20.0`, npm `11.19.0`, the guard's pinned Bun `1.4.0` PATH, and `GOMAXPROCS=2`. The installed `typescript` wrapper package metadata says `6.0.2`; the TypeScript API actually imported by every measured worker reports `6.0.3`. The installed native wrapper is `7.0.2`, but these evidence workers used the TypeScript 6.0.3 API. The guard kept its runtime stop condition unchanged: available memory below 3 GiB or memory `full avg10` above 10 for ten seconds. Commands were serialized through `/tmp/di-bag-resume-20260921/run-guarded.py` with subprocess-capable execution.

```sh
DI_BAG_GUARD_MIN_AVAILABLE_GIB=12 python3 /tmp/di-bag-resume-20260921/run-guarded.py phase09-task05-standard-c19880d-retry-02-subprocess /tmp/di-bag-resume-20260921/phase09 node scripts/evidence-cases.mjs --compare docs/superpowers/plans/evidence/baseline.md --json /tmp/phase-09-evidence.json
DI_BAG_GUARD_MIN_AVAILABLE_GIB=9 python3 /tmp/di-bag-resume-20260921/run-guarded.py phase09-task05-provider-old-c19880d-subprocess-03-9gib-native /tmp/di-bag-resume-20260921/phase09 node scripts/check-provider-method-scale.ts old
DI_BAG_GUARD_MIN_AVAILABLE_GIB=9 python3 /tmp/di-bag-resume-20260921/run-guarded.py phase09-task05-provider-new-c19880d-subprocess-01-9gib-native /tmp/di-bag-resume-20260921/phase09 node scripts/check-provider-method-scale.ts new
```

The standard run retained the 12 GiB launch floor. The user explicitly authorized a 9 GiB launch floor for the two remaining, separately guarded provider workers; no budget, workload, or runtime stop condition changed. Node's native TypeScript stripping ran those workers after the prescribed `--import tsx` form failed because `tsx` is not installed. Their logs retain the `MODULE_TYPELESS_PACKAGE_JSON` warning; it did not reject either worker.

The successful receipt stems below each have `.json` (guard receipt), `.log` (complete worker log), `.guard-stdout.log`, and `.rows.json` under `/tmp/di-bag-resume-20260921/gates-phase00/`:

| Gate | Receipt stem | Exit | Resource stop | Guard minimum available GiB | Row SHA-256 |
| --- | --- | ---: | --- | ---: | --- |
| Twelve standard rows | `phase09-task05-standard-c19880d-retry-02-subprocess` | 0 | no | 9.91 | `e9f639feff74aaeab33d4d0f779d3ef399d5d53ad931431f995810d62f51ae9d` |
| Old 100 providers | `phase09-task05-provider-old-c19880d-subprocess-03-9gib-native` | 0 | no | 10.73 | `79b4500a2f1423e9cc3508ad1957da3097a4f5c45ce2de8445f9a708a562621d` |
| New 100 providers | `phase09-task05-provider-new-c19880d-subprocess-01-9gib-native` | 0 | no | 10.28 | `adba2e825322f74a574272590fa5b257dff39de4b08ec95763614f6a84cfdf51` |

Each archived `.rows.json` has that same hash as its corresponding `/tmp/phase-09-evidence.json`, `/tmp/phase-09-provider-old.json`, or `/tmp/phase-09-provider-new.json`. Guard starts and complete outputs identify the same candidate and commands. The controller's fresh resource observations and all earlier attempt receipts are recorded in the Task 5 writer report.

## Twelve standard cases against the original phase-0 baseline

The ceiling in each row is exactly `floor(baseline instantiations × 1.10)` from [`baseline.md`](baseline.md). Change is `(measured / baseline − 1) × 100`, rounded here to two decimal places. Milliseconds and max RSS are descriptive; acceptance and the ceiling are the gates.

| Case | Count | Baseline instantiations | Measured instantiations | Change | Milliseconds | Max RSS MiB | Accepted | 110% ceiling |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| bulk | 100 | 159,001 | 147,695 | -7.11% | 1,110 | 374 | yes | 174,901 |
| chained | 100 | 787,814 | 771,162 | -2.11% | 1,590 | 424 | yes | 866,595 |
| grouped | 100 | 166,348 | 154,988 | -6.83% | 1,066 | 375 | yes | 182,982 |
| replacement | 100 | 1,031,260 | 1,020,154 | -1.08% | 1,608 | 419 | yes | 1,134,386 |
| bindings | 100 | 847,247 | 837,434 | -1.16% | 2,088 | 463 | yes | 931,971 |
| modules | 100 | 1,241,644 | 796,726 | -35.83% | 2,340 | 489 | yes | 1,365,808 |
| bulk | 500 | 806,601 | 796,895 | -1.20% | 1,872 | 462 | yes | 887,261 |
| chained | 500 | 13,956,214 | 13,919,562 | -0.26% | 11,173 | 1,732 | yes | 15,351,835 |
| grouped | 500 | 1,060,372 | 1,050,180 | -0.96% | 1,841 | 509 | yes | 1,166,409 |
| replacement | 500 | 21,767,660 | 21,758,954 | -0.04% | 13,183 | 2,208 | yes | 23,944,426 |
| bindings | 500 | 12,153,047 | 12,150,034 | -0.02% | 10,860 | 1,888 | yes | 13,368,351 |
| modules | 500 | 19,719,044 | 10,539,726 | -46.55% | 11,850 | 1,835 | yes | 21,690,948 |

All twelve expected identities occurred once, in the expected order. Every row reports `accepted: true`, Node `v24.20.0`, and TypeScript `6.0.3`, and every measured count is below its exact ceiling. This cumulative baseline gate is separate from the ordinary incremental replacement ceiling used in `npm run check`.

## Same-checkpoint 100-provider comparison

Both worker rows report `accepted: true`, empty diagnostics, Node `v24.20.0`, and TypeScript `6.0.3`.

| Shape | Instantiations | Change from old | Milliseconds | Max RSS MiB | Accepted | New ≤ 110% old ceiling |
| --- | ---: | ---: | ---: | ---: | --- | ---: |
| Old decorators | 1,574,426 | reference | 1,889 | 429 | yes | — |
| New `providerWith*` facades | 1,588,843 | +14,417 (+0.9156988007%) | 1,970 | 429 | yes | 1,731,868 |

The exact new ceiling is `floor(1,574,426 × 1.10) = 1,731,868`; the new count has 143,025 instantiations of headroom. The comparison ratio is `1,588,843 / 1,574,426 = 1.009156988007…`.

## Decision and attempt provenance

The preferred Provider instance-method design was rejected after its third and final serious repair. Its preserved `phase09-expand-full-check-unsandboxed.{json,log}` receipt records an ordinary TypeScript 6 named-100 replacement count of 1,407,077 over the unchanged 1,060,000 incremental ceiling and a TypeScript 7 named-1000 replacement memory termination at 3,072.289 MiB. There is no preferred-method old/new provider ratio or accepted preferred expand commit; none is inferred. The complete selected fallback consists of `DiBag.providerWithDisposal`, `providerWithLifetime`, `providerWithRegistrationMetadata`, `providerWithAcquisitionMetadata`, and `providerWithTransformedService`. An initial fallback check also failed the unchanged replacement budget; the separately ruled factory-first overload routing correction preserved provider replacement support and cleared the complete expand gates before this measurement.

Earlier Phase 9 Task 5 attempts remain preserved as provenance, not accepted budget rows: `phase09-task05-standard-c19880d.deferred.json` records a 12 GiB prelaunch deferral; `phase09-task05-standard-c19880d-retry-01.{json,log,guard-stdout.log,rows.json}` records twelve sandbox `spawnSync …/node EPERM` child-launch failures; `phase09-task05-provider-old-c19880d-subprocess-01.deferred.json` records a second 12 GiB prelaunch deferral; and `phase09-task05-provider-old-c19880d-subprocess-02-9gib.{json,log,guard-stdout.log}` records the missing-`tsx` preload before any provider row was produced. The controller's resource and EPERM rulings, the user's 9 GiB override, and the native-Node command ruling authorized the successful serialized attempts above. None of these preliminary attempts supplies compiler-cost evidence.

Decision: **S2 preferred Provider methods rejected; the complete `DiBag.providerWith*` fallback selected and accepted at this expand checkpoint.** Acceptance rests on all twelve standard rows and both same-checkpoint provider rows passing their separate gates above. The final post-contraction twelve-row rerun remains Task 6 work. The old 100-provider worker must not be rerun after compatibility declarations are removed.
