# Compiler performance evidence — 2026-09-10

The type-only change reduces 500-operation instantiations by about 9.2% for named chains, 4.3% for token bindings and 3.0% for token modules on both pinned compilers. Replacement work is effectively unchanged. The complete original matrix accepts **85/108** rows; all 23 failures remain recorded.

- [Full report](task-3-report.md): implementation, comparisons, rejected variants, RED/GREEN, contracts and limitations.
- [Machine summary](summary.json): all failed identities, before/after work/time/RSS, both API control contexts and gate results.
- [Fresh baseline](before/manifest.json) and [final matrix](final-matrix/manifest.json): original rows and source snapshots; every directory's `commands.jsonl` preserves exact commands and raw output.
- [Final provenance](final-provenance.json), [artifact hashes](artifact-manifest.json), [repeated final rows](final-repeats/rows.jsonl) and [reconstructed builds](builds/summary.json).
- [Experiment notes](experiment-notes.md), retained numbered experiment directories and RED logs: failed variants are evidence, not accepted implementations.
- [Final gates](gates/commands.jsonl), [source test commands](direct-test-commands.jsonl), [external-module API controls](module-controls/commands.jsonl), [script API controls](controls/commands.jsonl) and [original audit spot checks](controls/audit-spotchecks.jsonl).

Run collectors only serially under `/tmp/di-bag-compiler-heavy.lock`, with the recorded Node/compiler pins and unchanged original resource bounds. Collector completion does not imply workload acceptance. Historical and intermediate evidence are explicitly labeled; reconstructed builds are not pre-edit observations.
