# Performance evidence closeout

The performance work adds reproducible evidence boundaries without making a
general speed claim. Runtime and compiler observations are informational;
optional third-party context is absent because its packages are unavailable.

## Intrinsic runtime baseline

The retained source checkpoint `8ee8696` has two complete comparisons against
the intrinsic baseline `739b509`, using seeds 17 and 29. Each seed covers seven
scenarios at 10 and 100 providers. Every one of the 14 rows contains five
warm-ups and 31 measured fresh children for both implementations: 140 warm-up
and 868 measured children per seed. Execution order alternates within pairs,
and raw output precedes validation in the journal.

Both runs were ordinary-host measurements. No row met all three review
predicates, and the controlled-runner marker was absent. All rows therefore
remain `informational`; they support no regression verdict or universal speed
claim. The retained raw evidence, package/archive identities, tool hashes and
method are in
`docs/benchmarks/results/2026-09-08-8ee8696/`.

## Compiler controls

The retained `e5456f8` control run has 18 accepted summaries, 90 warm-ups and
558 fresh measured children across classic TypeScript 6 and native TypeScript
7. Its JSONL contains 668 records and has SHA-256
`3f13f311f553b870f86651eb7817e983d7b9400858bec8e65c203bba76452979`.
These rows compare only matching compiler and fixture identities.

The separate exhaustive matrix remains visible at 83/108 accepted. Its 25
failures are not converted into successes by the repeated controls. Older
single-observation tables in `docs/benchmarks/typescript.md` remain labelled
historical.

## Optional comparators

Task 5 adds a tested `ComparatorAdapter` admission boundary for synchronous
named graphs. Admission validates exact metadata and source hash, a fixed
three-service linear result, singleton identity, transient freshness and
explicit asynchronous disposal. Construction and resolution must themselves be
synchronous. Malformed metadata, changed workload results, identity/lifetime
errors and failed or partial cleanup produce `not-comparable`.

Typed Inject and Awilix are absent from both `package-lock.json` and the
installed tree. The actual `--comparators` command records each as
`unavailable: not-lockfile-pinned` in
`docs/benchmarks/results/2026-09-08-ad70a14/comparators.jsonl`. No dependency was
downloaded, no adapter was added and no third-party throughput row exists.
Future admitted data must be labelled **restricted common-subset throughput**;
it cannot stand in for modules, private exports, typed closure, tokens, aliases,
selected sharing, native Promise observation or ownership semantics.

The existing runtime baseline was not rerun for this documentation and
comparator-status change. Its source, fixture and lockfile identities are
already retained at the exact measured checkpoints, and this task does not
alter the runtime implementation or benchmark workload.

## Verification

The final focused performance matrix passed 71 tests / 363 assertions,
including a real archive build of the intrinsic baseline and child-process
tests for forbidden rejected comparator results. Independent scoped re-review
reported no remaining findings. The final repository gate passed 876 tests /
5,189 assertions across 48 files, followed by a successful classic build.
