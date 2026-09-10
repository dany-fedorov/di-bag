# Entry and replacement compiler projections — 2026-09-10

The original 1,000-operation native named-registration and replacement cases now pass, including their missing/wrong-shape error controls. All original binding/module cases remain accepted on both compilers. Classic TypeScript still overflows on the 1,000-call named and replacement forms; those six valid/error rows remain failures.

The clean final collection contains **40 rows: 34 accepted and 6 failed**. Baseline: `fb5fe6c736fc0c21b32b93dfc9e170c955209bb9` (PR 9 merge). Measured source: `59d10c6c8ac13d63171f9f39c170da048d7e208c`. Later evidence commits preserve this production source.

## What changed

- A private `ReplacementFactory<O>` names the contextual replacement return type while preserving its explicit receiver, `NoInfer`, overload order and admission checks.
- The private `WrongConstraint` helper delays the same `Provided<A>` projection until a named-dependency constraint needs it.
- A private `RegistrationEntry<K,V>` gives the compiler a literal key to compare before the full registration type. The public `Entries` mapped type keeps its original keys and object fields.
- Local replacement requirements distribute over surviving keys without allocating a mapped property for every absent requirement. Each union-valued registration stays grouped; implicit needs optionality and explicit `undefined` retain their previous meanings.

These are type-level changes in three production files. Runtime implementations, scale generators, diagnostic acceptance rules, dependency versions and supervisor limits are unchanged. The complete 35-file identities and unchanged compiler inputs are recorded in [source-manifest.json](source-manifest.json).

## Clean performance comparison

| 500-operation form | Classic instantiations before → after | Native instantiations before → after |
| --- | ---: | ---: |
| chained | 14,410,637 → 14,152,556 (-1.791%) | 14,395,692 → 14,137,937 (-1.791%) |
| replacement | 27,936,682 → 21,735,925 (-22.196%) | 27,922,423 → 21,720,888 (-22.210%) |
| bindings | 12,268,514 → 12,012,427 (-2.087%) | 12,216,345 → 11,960,572 (-2.094%) |
| modules | 19,520,267 → 19,509,176 (-0.057%) | 19,507,479 → 19,496,708 (-0.055%) |

| 500-operation form | Compiler | Process time before → after | Observed peak RSS before → after |
| --- | --- | ---: | ---: |
| chained | classic | 10.666 → 9.672 s | 1717.00 → 1439.00 MiB |
| chained | native | 20.750 → 4.284 s | 659.72 → 529.01 MiB |
| replacement | classic | 17.347 → 11.536 s | 2221.00 → 1797.00 MiB |
| replacement | native | 8.326 → 5.741 s | 1072.45 → 735.28 MiB |
| bindings | classic | 10.278 → 9.325 s | 1769.00 → 1571.00 MiB |
| bindings | native | 4.704 → 4.203 s | 733.00 → 584.37 MiB |
| modules | classic | 15.374 → 14.854 s | 2013.00 → 1974.00 MiB |
| modules | native | 7.368 → 6.894 s | 872.78 → 812.36 MiB |

| Original 1,000-operation form | Scenario | Compiler | Accepted | Result | Process time | Observed peak RSS |
| --- | --- | --- | --- | --- | ---: | ---: |
| chained | valid | classic | no | compiler stack overflow | 1.172 s | unavailable |
| chained | missing | classic | no | compiler stack overflow | 1.167 s | unavailable |
| chained | wrong-shape | classic | no | compiler stack overflow | 1.171 s | unavailable |
| chained | valid | native | yes | zero diagnostics | 17.259 s | 1735.30 MiB |
| chained | missing | native | yes | intended boundary error; no TS2589 | 17.293 s | 1774.34 MiB |
| chained | wrong-shape | native | yes | intended boundary error; no TS2589 | 17.238 s | 1703.85 MiB |
| replacement | valid | classic | no | compiler stack overflow | 1.175 s | unavailable |
| replacement | missing | classic | no | compiler stack overflow | 1.156 s | unavailable |
| replacement | wrong-shape | classic | no | compiler stack overflow | 1.156 s | unavailable |
| replacement | valid | native | yes | zero diagnostics | 23.935 s | 2584.32 MiB |
| replacement | missing | native | yes | intended boundary error; no TS2589 | 23.882 s | 2465.38 MiB |
| replacement | wrong-shape | native | yes | intended boundary error; no TS2589 | 24.359 s | 2528.78 MiB |
| bindings | valid | classic | yes | zero diagnostics | 28.813 s | 2665.00 MiB |
| bindings | missing-final-token | classic | yes | intended boundary error; no TS2589 | 28.888 s | 2689.00 MiB |
| bindings | mismatched-invariant-service | classic | yes | intended boundary error; no TS2589 | 28.751 s | 2671.00 MiB |
| bindings | valid | native | yes | zero diagnostics | 14.944 s | 1672.89 MiB |
| bindings | missing-final-token | native | yes | intended boundary error; no TS2589 | 14.898 s | 1637.01 MiB |
| bindings | mismatched-invariant-service | native | yes | intended boundary error; no TS2589 | 14.968 s | 1659.35 MiB |
| modules | valid | classic | yes | zero diagnostics | 54.052 s | 2984.00 MiB |
| modules | missing-final-token | classic | yes | intended boundary error; no TS2589 | 52.890 s | 2969.00 MiB |
| modules | mismatched-invariant-service | classic | yes | intended boundary error; no TS2589 | 53.370 s | 3029.00 MiB |
| modules | valid | native | yes | zero diagnostics | 26.204 s | 2540.99 MiB |
| modules | missing-final-token | native | yes | intended boundary error; no TS2589 | 26.130 s | 2539.89 MiB |
| modules | mismatched-invariant-service | native | yes | intended boundary error; no TS2589 | 26.094 s | 2394.04 MiB |

Accepted negative rows mean invalid code was rejected at the original marked boundary without TS2589. All cases use fresh processes, default stacks, a 60-second deadline and 4 MiB captured-output bound. The classic worker retains its 3,072 MiB V8 old-space heap limit (`--max-old-space-size=3072`); the native supervisor retains its separate 3,072 MiB sampled RSS bound. Classic observed RSS is reported but is not enforced by that heap option. Classic runtime is 6.0.3; the authenticated native compiler is 7.0.2. All paired 500-operation rows have identical generated source. Timings and observed RSS are single observations on this host, not portable guarantees. The raw [40 rows](measurements/rows.jsonl), [derived summary](measurements/summary.json) and [collection manifest](measurements/manifest.json) retain successful and failed results, commands, diagnostics, resource measurements and source hashes.

This collection repeats all 24 original 1,000-operation valid/error cases for these four forms. It does not relabel or claim a rerun of the historical 108-row matrix. The remaining classic failures are still under investigation; the evidence does not establish that they are unavoidable library-independent limits.

## Diagnostic profiles and intermediate results

Native CPU profiling of the original 500-call named form found 15.81 of 23.43 sampled CPU seconds (67.48% flat) in `ast.GetSourceFileOfNode`, mostly beneath union type-mapper comparisons. After the combined change the profile contains 7.32 sampled CPU seconds and no flat samples in that function. No samples does not mean zero actual execution. Our inference is that comparing distinct entry keys earlier avoids repeatedly walking source-file ancestry while comparing retained registration maps. These diagnostic runs use `--pprofDir` and are separate from the clean acceptance measurements.

The profile baseline is intermediate source `3360a96516daa7483c490a1bcacaa1ed16ec7ce1`, not the PR 9 baseline used in the table. All 35 baseline/final source files were checked against those exact revisions. The [before summary](probes/di-bag-named-checker-probe/native500-cpu-summary.json), [after summary](probes/di-bag-named-checker-probe/native500-final-cpu-summary.json) and [complete named probes](probes/di-bag-named-checker-probe/complete-probes.tar.gz) retain raw gzip profiles, sources, readers and caller analysis. The reader follows the standard [pprof profile schema](https://github.com/google/pprof/blob/main/proto/profile.proto).

The intermediate two-file candidate passed native 1,000 replacements at 3,058.11 MiB observed RSS, leaving only 13.89 MiB below the original bound. Its [historical 40-row overview](intermediate/README.md), [summary](intermediate/summary.json), and [complete evidence archive](intermediate/complete-evidence.tar.gz) remain preserved with their original source and checksums. That narrow margin motivated the additional key-distribution change. Historical text in the archived intermediate report describes the common limit as RSS; the lane-specific distinction above corrects that wording without changing the archived measurements or their manifest. The distributed-only prototype used 80,882,355 native instantiations and 2,477.51 MiB at 1,000 replacements; the combined entry change costs some replacement work relative to that prototype while also fixing native named chains. [Replacement probe evidence](probes/di-bag-replacement-key-probe/complete-probes.tar.gz) retains the comparison. Prototype measurements are not substituted for the clean final rows above.

Rejected experiments are retained in the archives: filtering mapped requirement keys increased work and timed out, and an extra add-input alias left the classic stack failure unchanged. Earlier conditional/scoped entry aliases failed generic construction or wrapper compatibility and are not used. Classic diagnostic stack traces remain evidence of a failure, not a proof of an upstream-only cause.

## Compatibility and validation

Three independent, successive reviews found no change-specific blocker: [context and constraints](reviews/context-constraints/review.md), [distributed replacement keys](reviews/replacement-keys/review.md), and [the exact combined entry/replacement source](reviews/combined/review.md). Their adjacent `complete-review.tar.gz` archives preserve all raw paired results, declarations, consumers, fixtures and scripts. The first review covers 352 concrete constraint cases; the second covers 600 paired public replacement-output assertions; the combined review adds generic entry construction and wrappers, 35 targeted output comparisons, 57 negative markers, 48 emitted declarations per version/engine and fresh strict consumers. These are successive scopes, not a claim that all matrices were repeated in the last review. Baseline-rejected generic probes remain recorded as differential failures, not successful equality proofs.

Local validation passed **943 tests, zero failures and 18,899 assertions**, both compiler builds and source typechecks, **31 emitted Node regressions per compiler**, and the strict native audit (**639/639 expected diagnostics across 124 files**, zero unexpected diagnostics). Generated references, documentation checks and all nine examples passed. All 18 steps and their raw logs are in [the verification manifest](gates/di-bag-final-projection-integration-verification.json). Pinned Bun 1.4.0 was used, the ignored local platform manifest was refreshed before the run, and npm update notifications were disabled to match CI.

Regression tests retain both original native 1,000-operation valid probes and tighten the classic 100-replacement ceiling to 1,030,000 instantiations. The new generic entry constructor and replacement-output characterizations first passed against the previous source. The new performance gates failed on that previous source, then passed with the final implementation; the RED, baseline-characterization and GREEN logs are retained under `gates/`. Hosted CI and merge verification are tracked on the pull request.

## Reproduction and artifact identity

Use the pinned dependencies from the repository and clean checkouts at the baseline and measured revisions. The collection and review scripts preserve the original local `/tmp` workspace paths; adjust those paths to equivalent isolated checkouts before running elsewhere. Extract a review or probe archive into its matching scratch directory before using its reproduction script. Run `collect.py <measured-source>`, then `summarize.py`; `stage.py` and `finalize.py` package the evidence. Compilation was serialized through `/tmp/di-bag-compiler-heavy.lock` so benchmark processes did not overlap suites or other compiler probes.

[artifact-manifest.json](artifact-manifest.json) checksums every other file in this published artifact directory, including nested manifests and complete archives. The historical intermediate manifest applies to the original archive contents; the outer manifest separately covers the copied historical overview. Archives contain only relative regular-file paths and omit `node_modules` and symlinks.
