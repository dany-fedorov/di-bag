# Task 5: optional comparator boundary and truthful public report

Implemented a `ComparatorAdapter` admission boundary for the restricted common
subset. A candidate must retain an exact name/version/source hash, build and
resolve synchronously, produce the fixed three-service named result, preserve
singleton identity, create fresh transient values, and explicitly dispose every
resolved lifecycle probe. Failures return `not-comparable` rather than entering
a throughput table.

Optional package inspection separately checks the lockfile integrity/version,
the installed package name/version, and adapter package identity. Typed Inject
and Awilix are absent from the actual lockfile and installed tree, so the new
`--comparators` command emits two `unavailable: not-lockfile-pinned` rows. No
package was downloaded, no adapter was fabricated and no third-party timing was
run.

TDD evidence:

- Initial RED: the comparator protocol module was absent; 0 pass / 1 fail.
- First GREEN: 9 tests / 27 assertions cover admission, malformed metadata,
  async construction/resolution, changed graph output, singleton/transient
  errors, partial/failed disposal, absent/install states, version drift and CLI
  output.
- Identity mutation RED: a same-version lookalike installed package was
  incorrectly admitted.
- Identity mutation GREEN: installed package names are now exact; 9 tests / 28
  assertions and classic typecheck pass.
- Broad focused gate: 70 tests / 350 assertions across runtime semantics,
  child protocol, baseline construction, compiler controls and comparators.

The retained status evidence is under
`docs/benchmarks/results/2026-09-08-bf8b1ac/`. Runtime baseline evidence from
`8ee8696` and compiler controls from `e5456f8` were reused because this task
changes neither runtime implementation nor workload. A fresh structural recount
confirmed each runtime seed has 14 informational summaries, 140 warmups and 868
measured children, with zero rows satisfying every review predicate. Existing
compiler evidence retains 18 summaries, 90 warmups and 558 samples as recorded
by its completion row and independently validated Task 4 report.

The first full repository gate after the public-report delta passed 875 tests,
5,176 assertions and the classic build in 578.97 seconds. Its retained log is
`/tmp/di-bag-performance-task5-check.log`; the focused log is
`/tmp/di-bag-performance-task5-focused.log`. A final full gate follows the
identity mutation correction and review before Task 5 is marked complete.
