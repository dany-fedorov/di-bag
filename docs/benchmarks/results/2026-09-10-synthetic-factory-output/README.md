# Cache synthetic factories by their service output

Original 1,000-module compilation repeatedly expands callback and registration types while resolving the final service. The change factors zero-argument callable types into private `OutputFactory<O> = () => O` aliases in provider and module projections. The callable captures its computed output, allowing the compiler to reuse it without traversing the full callback context. Public selection, admission, graph and acquisition types retain their original definitions. Runtime code is unchanged.

## Source identities and verification

Baseline: `c058be3e4c2852c768a68591c94893ba75776a1c` (PR 8 merge). Final measured source commit, complete file hashes and exact command results are recorded in the source and measurement manifests. Documentation/evidence commits preserve those production source bytes.

The original resource limits remain unchanged: 60 seconds and 4 MiB captured output with default stacks; classic uses a 3,072 MiB V8 old-space limit, while native uses the existing 3,072 MiB observed-RSS supervisor limit. Recorded classic peak RSS is an observation, not a separate enforced RSS ceiling. Classic uses TypeScript 6.0.3 on Node 24.20.0; native uses TypeScript 7.0.2. Local tests use Bun 1.4.0. Timings and observed RSS are serial fresh-process observations, not portable latency or memory guarantees.

Final source: `3414490a23bfbf76cba14b9d4044788964b59853`. The clean-commit collection contains **32 rows: 28 accepted and 4 failed**. All paired 500-operation rows use the same original generated source on the baseline and candidate.

| 500-operation form | Classic instantiations before → after | Native instantiations before → after |
| --- | ---: | ---: |
| chained | 14,410,597 → 14,410,637 (+0.000%) | 14,395,626 → 14,395,692 (+0.000%) |
| replacement | 27,936,642 → 27,936,682 (+0.000%) | 27,922,357 → 27,922,423 (+0.000%) |
| bindings | 21,375,698 → 12,268,514 (-42.605%) | 21,323,499 → 12,216,345 (-42.709%) |
| modules | 35,705,269 → 19,520,267 (-45.329%) | 35,692,454 → 19,507,479 (-45.346%) |

| Original 1,000-operation form | Scenario | Compiler | Accepted | Result | Process time | Observed peak RSS |
| --- | --- | --- | --- | --- | ---: | ---: |
| chained | valid | classic | no | compiler stack overflow | 1.169 s | unavailable |
| chained | valid | native | no | timeout | 60.080 s | 711.05 MiB |
| replacement | valid | classic | no | compiler stack overflow | 1.192 s | unavailable |
| replacement | valid | native | no | memory | 27.451 s | 3072.23 MiB |
| bindings | valid | classic | yes | zero diagnostics | 34.565 s | 2934.00 MiB |
| bindings | valid | native | yes | zero diagnostics | 17.249 s | 2053.29 MiB |
| modules | valid | classic | yes | zero diagnostics | 53.371 s | 2956.00 MiB |
| modules | valid | native | yes | zero diagnostics | 28.592 s | 2365.03 MiB |
| bindings | missing-final-token | classic | yes | intended boundary error; no TS2589 | 34.544 s | 2961.00 MiB |
| bindings | mismatched-invariant-service | classic | yes | intended boundary error; no TS2589 | 34.393 s | 3051.00 MiB |
| bindings | missing-final-token | native | yes | intended boundary error; no TS2589 | 17.385 s | 2004.79 MiB |
| bindings | mismatched-invariant-service | native | yes | intended boundary error; no TS2589 | 17.442 s | 2050.85 MiB |
| modules | missing-final-token | classic | yes | intended boundary error; no TS2589 | 52.943 s | 2953.00 MiB |
| modules | mismatched-invariant-service | classic | yes | intended boundary error; no TS2589 | 53.908 s | 3029.00 MiB |
| modules | missing-final-token | native | yes | intended boundary error; no TS2589 | 28.669 s | 2502.25 MiB |
| modules | mismatched-invariant-service | native | yes | intended boundary error; no TS2589 | 28.659 s | 2483.59 MiB |

Accepted negative rows mean invalid code was rejected at the original marked boundary without TS2589. Raw rows preserve any additional diagnostics permitted by the original oracle. The historical 108-row matrix was not rerun or relabeled. Named and replacement 1,000-operation limitations remain open; this change targets token factories and module projections.

Classic 1,000-module compilation remains close to the original time and memory bounds. Completing on this host does not establish comfortable editor-scale memory or latency. The 500-operation named and replacement work changes by 40 classic or 66 native instantiations; those rows are retained rather than described as reductions.

Local verification covers 940 passing tests from the full run, followed by all **29 platform checks passing** after the ignored tool manifest was refreshed. The original full-run failure remains recorded below. Both builds and source typechecks passed; emitted Node regressions passed **31 tests per compiler**. The native audit matched **639/639 expected diagnostics across 124 files**, with zero unexpected. Generated references, documentation checks and all nine examples passed. Hosted full-suite CI and final merge verification are separate publication gates tracked by the pull request.

## Root cause and compatibility

The [architecture review](architecture-review.md) traces contextual final-resolution inference into the compiler's object instantiation mapper. Captured type arguments are mapped before the cache lookup, so repeating the same deep callback structure still costs work. The small instrumented 200-module comparison reduces total instantiations from 6,349,369 to 3,685,817 and attributed final-resolution work from 295,172 to 11,000. This diagnostic prototype is separate from final unmodified-compiler acceptance measurements.

Earlier output-map shortcuts were rejected for losing optionality, tightening `any` selection or changing deferred/reflected inference. Entry-cache variants were rejected for generic construction/install incompatibility or increased replacement work. The adopted output aliases preserve zero-argument callable shape and do not introduce a receiver, `NoInfer`, a new conditional branch or `Awaited`. The [independent paired review](compatibility-review/review.md) passes generic equality, bidirectional assignment, inference, declaration emission and separate consumers on both compilers with `skipLibCheck: false`. It records 263 identical classic inferred type displays and 43 emitted files per variant; only the two intended source declarations differ. The same 16 pre-existing exploratory negative diagnostics remain on each variant; they are not unexpected candidate errors. Raw results and pinned source trees are retained under `compatibility-review/`.

## Regression evidence and reproduction

The 100-binding and 100-module work ceilings fail against baseline (1,198,298 > 850,000 and 1,884,069 > 1,220,000). The original native 1,000-module test fails at final resolution with TS2589, then passes with the source change. All four incremental work tests and the new native case pass together. Raw red and green logs are under `regressions/`.

An initial full validation run was interrupted after npm printed its update notice to stderr, violating the package harness's empty-stderr requirement despite process exit zero. Its raw output and interruption reason remain under `regressions/`. Subsequent verification sets `npm_config_update_notifier=false`; compiler versions and checks are unchanged. The full suite then recorded 940 passing tests and one stale-tool-pin failure: the tracked `tools/platform-versions.json` fallback referred to an ambient Bun executable that had changed, while the test command used the pinned 1.4.0 binary. The absent ignored `tools/platform-versions.local.json` override was generated with CI's existing `npm run platform:pin` setup step, and the affected platform suite was rerun. Raw failures remain visible; they are not relabeled as a green full-suite run.

`collector.py` runs the repository's original `scripts/check-compiler-case.ts` from separate clean baseline/candidate checkouts. It verifies both commits, every source file and generated-program hashes before and after each row. `summarizer.py` validates the complete 32-row case set and retains failed rows. Scratch absolute paths in reproduction scripts identify the original checkout layout; set them to equivalent local checkouts when reproducing.

The bundled `compatibility-review/baseline` and `compatibility-review/candidate` trees are complete. To rerun that review from this archive, point `run.mjs` and `verify-results.py` at the bundled review directory and your repository/compiler checkout, then run them directly. The archived `setup.py` reconstructs the original scratch layout from earlier fixture paths and can be skipped when using these complete trees.
