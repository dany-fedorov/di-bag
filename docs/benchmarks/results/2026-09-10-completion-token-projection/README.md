# Cache registration keys for final typed-token checks

The original 1,000-binding program reaches TypeScript's per-expression instantiation limit while checking `.end()`. A homomorphic registration map at the typed-token completion boundary prevents repeated key remapping. The public `Complete<R>` conditional, named-dependency checks, error ordering, registration history, and returned service types remain intact.

This directory contains the diagnostic investigation, rejected prototypes, regression evidence, independent review, and final measurements. Compiler limits and original source generators are unchanged. No benchmark row substitutes grouped registrations for the original fluent workload.

## Source identities

Baseline: merge `e3cc8869dbc9c11a56c0cf777b2e73d0d7b8f666` (PR #7). Its production source is identical to `6e95bffd96c7ec23b7f09816d633636e587128e8`, used by the temporary probes. The final source commit and aggregate hashes are recorded in `source-manifest.json` and `measurements/manifest.json` after collection. Compiler versions are classic TypeScript 6.0.3 and native TypeScript 7.0.2; Node is 24.20.0 and local test runs use Bun 1.4.0.

The final source is the `probes/token-projection.ts` snapshot plus two explanatory comment lines. The public `From<E>` map and every builder method signature remain unchanged. Only `MissingTokens` and `InvalidGraphs` inside `Complete` receive the projected map.

## Root cause

`trace/` records the original 1,000-binding program with in-memory logging added to the installed classic compiler. It reaches `instantiationCount === 5,000,000` at depth 14 while checking `.end()`. The repeated work is the `P in E` key remapping in `From<E>`, via `getIndexTypeForMappedType`. The homomorphic projection exposes a reusable key constraint to token graph checks. Trace logging changes no compiler limit; the trace is diagnostic attribution, not the final acceptance run.

The first trace harness contained an injected newline syntax error; that failed attempt and the corrected worker are retained. `Error.stackTraceLimit` in the detailed trace controls printed frames, not the execution stack limit.

## Compatibility and rejected alternatives

The preferred temporary source matches all 642 existing raw fixture diagnostics and all 669 inferred variable declarations across 124 source files. Independent review compares 48 registration shapes, 12 deferred generic assignment directions, generic-function equality, and eight `.end()`/`.start()` wrappers with retained constraints and lifetime proofs on both compilers. Extracted scope/fork/end/start declarations are byte-identical to the baseline, 55,030 bytes. See `review.md`, `final-review.md`, and `review-probes/`.

- Globally projecting public `From<E>` either failed generic constraints or increased small named/replacement compiler work. These `history-exploration/` candidates were not adopted. The valid Extract-valued global prototype passed native 1,000 bindings but did not fix 1,000-module resolution.
- Moving all of `Complete` behind private `ProjectedComplete` passed the semantic checks but grew the reflected-method declaration probe from 55,030 to 139,906 bytes. The preferred source preserves the public conditional alias and avoids that expansion.
- `resolution-exploration/` isolates `NoInfer` around the final `resolve()` token guard. All small probes compiled, but instantiation counts increased slightly. None of those source changes was adopted.

Prototype rows are labeled throwaway and pinned to their source snapshots. They are separate from final clean-commit benchmark acceptance. Some rejected prototypes intentionally have diagnostics; their raw records are retained as rejected experiments.

## Regression tests and integration

The baseline fails the tightened 100-binding work ceiling: 1,289,021 instantiations exceeds 1,220,000. It also fails the new original 1,000-binding native regression with TS2589 at `.end()`. The production source gate passes all 132 tests with 540 assertions, including both regressions. The native test uses the existing 60-second, 3072-MiB RSS and 4-MiB output limits without overrides.

The final clean-commit collection contains **28 rows: 22 accepted and 6 failed**. All 16 paired 500-operation rows pass. Each result retains the exact original generated source hash and compiler version.

| 500-operation form | Classic before → after | Native before → after |
| --- | ---: | ---: |
| chained | 14,414,026 → 14,410,597 (−0.024%) | 14,399,056 → 14,395,626 (−0.024%) |
| replacement | 27,940,071 → 27,936,642 (−0.012%) | 27,925,787 → 27,922,357 (−0.012%) |
| bindings | 23,629,621 → 21,375,698 (−9.539%) | 23,577,427 → 21,323,499 (−9.560%) |
| modules | 35,708,698 → 35,705,269 (−0.010%) | 35,695,884 → 35,692,454 (−0.010%) |

| Original 1,000-operation form | Scenario | Compiler | Accepted | Result | Process time |
| --- | --- | --- | --- | --- | ---: |
| chained | valid | classic | no | compiler stack overflow | 1.176 s |
| chained | valid | native | no | timeout | 60.084 s |
| replacement | valid | classic | no | compiler stack overflow | 1.159 s |
| replacement | valid | native | no | memory | 29.308 s |
| bindings | valid | classic | yes | zero diagnostics | 54.741 s |
| bindings | valid | native | yes | zero diagnostics | 26.440 s |
| modules | valid | classic | no | worker timeout | 60.273 s |
| modules | valid | native | no | TS2589 | 55.454 s |
| bindings | missing-final-token | classic | yes | intended boundary error; no TS2589 | 53.806 s |
| bindings | mismatched-invariant-service | classic | yes | intended boundary error; no TS2589 | 53.951 s |
| bindings | missing-final-token | native | yes | intended boundary error; no TS2589 | 26.169 s |
| bindings | mismatched-invariant-service | native | yes | intended boundary error; no TS2589 | 26.369 s |

Accepted negative rows mean the original required diagnostic occurred at its marked boundary without TS2589; they do not mean invalid code compiled successfully. Raw rows retain any additional diagnostics allowed by the original oracle.

All six original 1,000-binding scenarios are listed above rather than inferring negative behavior from the valid case. The full historical 108-row matrix was not rerun here. The named/replacement/module 1,000-operation limitations remain unresolved; their six failed valid rows are retained. Classic binding compilation also remains expensive and close to the existing time/memory bounds, despite now completing.

Local integration: **132 source/regression tests passed, 540 assertions; 96 package tests passed, 1,782 assertions**. Both source typechecks passed. Native diagnostic audit: **639/639 matched across 124 files, zero unexpected**. Generated references and documentation checks passed. Hosted full-suite CI and final merge verification are recorded with the pull request.

At 500 bindings, the paired classic run used 1,781 → 1,743 MiB max RSS and 14.976 → 14.249 seconds process time; native used 839.63 → 776.92 MiB observed peak RSS and 7.229 → 6.742 seconds. These are individual observations. Final 1,000-binding process time and memory remain in the raw rows; no broad memory or editor-latency guarantee is claimed.

## Reproduction and interpretation

The collector runs `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-compiler-case.ts <classic|native> <500|1000> <form> <scenario>` from the corresponding clean checkout. `measurements/manifest.json` pins both commits and every production source file; each raw row verifies source and generated-program hashes before and after compilation. `collector.py` and `summarizer.py` preserve every result and verify the complete case set.

Temporary review/trace scripts retain the absolute `/tmp` paths at which they ran. To reproduce them elsewhere, create checkouts at the recorded commits and update those path prefixes without changing the snapshots, generators, compiler versions, or limits. `artifact-manifest.json` checksums the published files. Compiler work counts are deterministic for these pinned programs; time and RSS are individual serial observations, not statistical latency or memory guarantees.
