> Historical intermediate candidate. The complete original evidence and its manifest are preserved in [complete-evidence.tar.gz](complete-evidence.tar.gz). The manifest applies to the archive contents.

# Replacement context and constraint projection

The original native 1,000-replacement workload exhausts the 3,072 MiB RSS limit on the PR9 merge. This follow-up reduces compiler work while keeping the original generated calls, invalid-input boundaries and compiler limits.

The change is limited to two private type helpers. `ReplacementFactory<O>` captures the computed contextual output independently of the builder's entry history and retained constraints, preserving its explicit `this: void` receiver and the existing `NoInfer` placement. `WrongConstraint<C, A>` constructs the existing `Provided<A>` map inside its named-needs branch. Empty constraints can therefore finish without forcing every property of the replacement merge's `Omit` map. The public constraint conditional, indexed output comparison, overloads, admissions and runtime remain intact.

A diagnostic-only classic compiler allocation trace at 100 replacements records 9,901 constructed `Omit` properties on the baseline and one with the combined change. The trace instruments allocation counting and is separate from acceptance benchmarks. The corresponding uninstrumented instantiation count falls from 1,271,682 to 1,039,623. The permanent 100-replacement ceiling is tightened from 1,300,000 to 1,070,000; a second regression checks the original native 1,000-replacement valid workload. Both tests fail before the source change and pass afterward.

Final source: `3360a96516daa7483c490a1bcacaa1ed16ec7ce1`. The clean collection contains **40 rows: 31 accepted and 9 failed**. All paired 500-operation rows use identical generated source on the baseline and candidate.

| 500-operation form | Classic instantiations before → after | Native instantiations before → after |
| --- | ---: | ---: |
| chained | 14,410,637 → 14,152,119 (-1.794%) | 14,395,692 → 14,137,571 (-1.793%) |
| replacement | 27,936,682 → 22,378,223 (-19.897%) | 27,922,423 → 22,363,866 (-19.907%) |
| bindings | 12,268,514 → 12,012,490 (-2.087%) | 12,216,345 → 11,960,709 (-2.093%) |
| modules | 19,520,267 → 19,514,245 (-0.031%) | 19,507,479 → 19,501,848 (-0.029%) |

| Original 1,000-operation form | Scenario | Compiler | Accepted | Result | Process time | Observed peak RSS |
| --- | --- | --- | --- | --- | ---: | ---: |
| chained | valid | classic | no | compiler stack overflow | 1.171 s | unavailable |
| chained | missing | classic | no | compiler stack overflow | 1.170 s | unavailable |
| chained | wrong-shape | classic | no | compiler stack overflow | 1.163 s | unavailable |
| chained | valid | native | no | timeout | 60.070 s | 565.23 MiB |
| chained | missing | native | no | timeout | 60.071 s | 630.93 MiB |
| chained | wrong-shape | native | no | timeout | 60.070 s | 578.90 MiB |
| replacement | valid | classic | no | compiler stack overflow | 1.163 s | unavailable |
| replacement | missing | classic | no | compiler stack overflow | 1.142 s | unavailable |
| replacement | wrong-shape | classic | no | compiler stack overflow | 1.166 s | unavailable |
| replacement | valid | native | yes | zero diagnostics | 28.200 s | 3058.11 MiB |
| replacement | missing | native | yes | intended boundary error; no TS2589 | 27.553 s | 3038.89 MiB |
| replacement | wrong-shape | native | yes | intended boundary error; no TS2589 | 27.876 s | 2877.23 MiB |
| bindings | valid | classic | yes | zero diagnostics | 29.401 s | 2679.00 MiB |
| bindings | missing-final-token | classic | yes | intended boundary error; no TS2589 | 28.319 s | 2661.00 MiB |
| bindings | mismatched-invariant-service | classic | yes | intended boundary error; no TS2589 | 28.804 s | 2675.00 MiB |
| bindings | valid | native | yes | zero diagnostics | 14.957 s | 1660.59 MiB |
| bindings | missing-final-token | native | yes | intended boundary error; no TS2589 | 14.861 s | 1518.27 MiB |
| bindings | mismatched-invariant-service | native | yes | intended boundary error; no TS2589 | 14.910 s | 1570.44 MiB |
| modules | valid | classic | yes | zero diagnostics | 52.932 s | 2996.00 MiB |
| modules | missing-final-token | classic | yes | intended boundary error; no TS2589 | 53.391 s | 2954.00 MiB |
| modules | mismatched-invariant-service | classic | yes | intended boundary error; no TS2589 | 53.483 s | 2955.00 MiB |
| modules | valid | native | yes | zero diagnostics | 28.725 s | 2371.80 MiB |
| modules | missing-final-token | native | yes | intended boundary error; no TS2589 | 28.577 s | 2500.22 MiB |
| modules | mismatched-invariant-service | native | yes | intended boundary error; no TS2589 | 28.710 s | 2421.55 MiB |

Accepted negative rows mean invalid code was rejected at the original marked boundary without TS2589. Raw rows retain every diagnostic and the unchanged oracle decides acceptance. The original native 1,000-replacement valid/missing/wrong-shape cases now pass. All twelve original binding/module cases remain accepted. The classic 1,000 named/replacement stacks and native 1,000 named timeout remain open. This collection reruns all 24 original 1,000-operation cases for these four forms; it does not reclassify the historical 108-row matrix.

Local verification passed **942 tests, zero failures and 18,897 assertions**, both compiler builds and source typechecks, **31 emitted Node regressions per compiler**, and the strict native audit (**639/639 expected diagnostics across 124 files**, zero unexpected). Generated references, documentation checks and all nine examples passed. The local platform manifest was refreshed before verification and npm update notifications were disabled to match CI. All 18 validation steps and their raw logs are retained under `gates/`. The pull request records hosted CI and merge verification.

The initial combined native 1,000 valid probe completed with 3,014.19 MiB peak observed RSS, leaving a narrow margin. Error probes subsequently completed with less observed RSS. Timings and memory are observations from this host; acceptance under the original limits does not establish comfortable editor latency or a portable memory guarantee. All collected failures remain in the result tables.

Three further throwaway changes were not adopted: filtering the requirement map increased small-case work and timed out on the original native 1,000 valid case; an extra per-registration helper added work; capturing the individual requirement value saved only 591 small-case instantiations and was not advanced to compatibility or large-scale acceptance. Those prototypes are retained under `probes/`, explicitly separate from the reviewed production source.

The independent paired review checks the exact two candidate snapshots against the prior published source. Both compiler versions pass 352 concrete `CheckedConstraints` equalities, 15 deferred equalities, 36 reciprocal assignments, the full extracted replacement-overload equality and assignments, declaration emit and fresh consumers with `skipLibCheck: false`. All 170 selected negative diagnostic markers match (172 diagnostics). Fully unresolved comparisons against separately copied legacy helpers preserve their existing rejections and are not counted as successful proofs. One classic inferred type rendering changes union-arm order; callable equality and reciprocal assignment still pass. Full compiler messages are not claimed byte-identical. See [review](../reviews/context-constraints/review.md) and its raw evidence.

Source and measurement identity are recorded in `source-manifest.json`, `measurements/manifest.json` and each raw row. The review's base source at `3a42173d9faacc63ad7728545580a63389d56de2` is byte-identical across all 35 source files to the benchmark baseline, PR9 merge `fb5fe6c736fc0c21b32b93dfc9e170c955209bb9`. The original generator, workers, package versions and limits are unchanged. Classic uses a 3,072 MiB V8 old-space cap; native uses the 3,072 MiB RSS supervisor. Both retain 60 seconds, 4 MiB output and default stack settings.

The raw scripts retain the exact `/tmp` paths used during collection and review; reproducing elsewhere requires adjusting those workspace paths. Failed early exploratory fixtures and all RED outputs are retained, not counted as passing verification. `artifact-manifest.json` fingerprints the published evidence files. Existing historical reports retain their own source identities and results.
