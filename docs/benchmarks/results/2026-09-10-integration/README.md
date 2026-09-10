# Integrated performance evidence

The [finding-by-finding report](../../../reports/2026-09-10-performance-completion.md)
explains improvements, regressions and remaining contract limits. Measured source
is `079b0013a19667247257509407704597a7ab3221`; documentation/evidence commits
after it do not change production code. This directory records local evidence.
It is not evidence that follow-up changes have been published or merged.

| Directory / file | Evidence and interpretation |
|---|---|
| `runtime/` | Exact original 47 workloads against original classic, final classic and final native builds: 141 rows, 135 accepted. Six failed observations retained. Includes original probe, collectors, source, both final builds, manifests, raw commands and derived summary. |
| `compiler/` | Final-source 24 original valid cases: both compilers, four fluent forms, 100/500/1,000 operations. Original worker limits unchanged; every failed case remains. `summarize.py` verifies source/generator/compiler identities and compares with Task 3's fresh baseline. |
| `compiler-sandbox-failure/` | Initial 24 attempts all failed provenance capture with `spawnSync git EPERM` before a compiler worker could start. Host rerun used the unchanged collector and bounds. These are infrastructure failures, not compiler performance results. |
| `compiler-spotchecks/` | Original classic 1,000 chained/grouped audit commands with default stack, 1,024 MiB old space and 30-second deadline. A successful grouped control does not replace the failed fluent row. |
| `gates/` | First complete verification recorder on `e0b28de`: one stale diagnostic-inventory failure in 1,043 tests, retained. Native typecheck/build/31 Node regressions, strict 674-marker audit, docs, required portable lanes and all examples pass. Classic Node was correctly skipped because the full check had failed before rebuilding. |
| `gates-rerun/` | Full `npm run check` after inventory-only repair `079b001`: 1,043 tests pass, then classic build and all 31 classic Node regressions pass. All 37 production source hashes match the first gate run. Includes optional read-only process-tree RSS sampling. |
| `task-3-controller-baseline-build-crosscheck.json` | Retained Task 2 build snapshots match reconstructed Task 3 baseline builds byte for byte on both emitters. This preserves the scoped review's provenance qualification without representing reconstruction as a pre-edit observation. |
| `reviews/` | Durable copies of scoped reports/reviews and the final whole-branch review record. |
| `artifact-manifest.json` | Hash inventory of this integration directory and the required portable artifact directory; excludes only itself. |

Required portable results are retained separately in
[`../2026-09-10-e0b28de/`](../2026-09-10-e0b28de/). Actual hosts are Node 24.20.0,
Bun 1.4.2, Deno 2.9.6 and Chromium 153.0.8010.12. CI pins Bun 1.4.0; current CI
must still run after publication. Compiler versions are classic TypeScript 6.0.3
and native TypeScript 7.0.2. Per-worker memory and full-suite process memory are
distinct measurements; neither is the library's retained payload footprint.

Collectors run serially under `/tmp/di-bag-compiler-heavy.lock`, with no competing
test/benchmark load and frozen source/HEAD. Raw command outputs include original
temporary paths and whitespace. Process exit 0 from a collector means it completed
recording; use each row's `accepted` flag to judge workload success. The earlier
complete 108-case compiler matrix remains at its explicitly recorded Task 3
revision in [`../2026-09-10-compiler-performance/`](../2026-09-10-compiler-performance/).

To derive tables from the retained data, run from the repository root:

```sh
python3 docs/benchmarks/results/2026-09-10-integration/runtime/summarize-final-runtime.py \
  docs/benchmarks/results/2026-09-10-integration/runtime
python3 docs/benchmarks/results/2026-09-10-integration/compiler/summarize.py
```

The collectors also preserve exact commands for independent reproduction with
the recorded commits and installed tools. Recollection requires fresh output
directories and matching historical baseline sources/builds; it must not overwrite
these retained observations.
