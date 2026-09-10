# Complete the performance audit improvements

User objective: push and merge the first fixes, then continue until every finding
in the 2026-09-10 performance audit is covered and improved. The work is not
complete merely because existing tests pass or the first four costs improve.

## Scope and acceptance

1. Merge the already reviewed iterative disposal, cycle-search, reverse-edge and
   shared lexical-map fixes into origin/main. Keep the concurrent metadata
   refactor in the original checkout out of this PR.
2. Preserve and rerun regressions for deep disposal, late cycles, flat cleanup,
   repeated dependency reads and module installation (audit findings 1, 3, 4, 5).
3. Release unnecessary strong references to exposed transient service values.
   Preserve owned stage values until disposal, pending-source draining, exact
   promise identity, retained-proxy lifetime/cycle checks, and inspection frames.
   Establish a measurable decrease in live heap after discarded borrowed values,
   for synchronous and asynchronous acquisitions. Record any intentional metadata
   history retention separately from service-value retention.
4. Replace per-operation whole-graph map copies with persistent storage. Preserve
   symbol identity, private lexical references, public override semantics,
   contribution order and immutable earlier builders. Eliminate retained obsolete
   public bindings where no public/private reference requires them. Prove scaling
   across 100/1,000/5,000 operations and inspect retained heap for repeated replacement.
5. Improve cold synchronous resolution on the original raw linear factory graph:
   1,000 providers must resolve on Node's default stack, with factories invoked
   once. Reduce ancestry copying/scanning for deeper graphs. Do not replay user
   factories, erase cycle checks, or implicitly convert synchronous outputs to
   promises. Investigate declared dependency graphs for further iterative routing.
6. Reduce compiler work on original named/token/module scale generators, retaining
   exact inference and positive/negative source/package contracts. Preserve failed
   measurement reporting. Original 1,000-operation cases remain explicit acceptance
   probes; grouped substitutes and larger process limits cannot silently replace
   them. Document and separately prove unavoidable compiler syntax/stack limits.
7. Revisit the audit's inspected workload risks (observer backlog, startup
   concurrency and never-settling cleanup). Measure relevant cases, distinguish
   application work from library overhead, and implement bounded mechanisms where
   they improve library behavior without abandoning ownership obligations.
8. Review, verify, push and merge follow-up changes; retain before/after evidence
   and a finding-by-finding completion audit. Do not claim completion for an
   unresolved row or rely on an older build's checks.

## Design direction

Work in an isolated checkout under /tmp. Runtime acquisition changes, immutable
storage changes and compiler investigations are separate tasks with explicit file
ownership. Existing public contracts are the compatibility baseline. Prefer
removing unnecessary references/work over new user configuration; when a bound
changes observable behavior, make its policy explicit in API docs and regression
tests rather than silently dropping events, metadata or resource cleanup.

Transient acquisition identity, graph edges and inspection metadata are distinct
from the exposed service and owned stage values. Clear the exposed value only
after it has been handed to the caller, and clear fulfilled transient results
only after ownership acceptance and projection processing are safe. Lightweight
completed records may retain inspection/cycle state without retaining payloads.

Persistent keyed storage must avoid process-global strong symbol registries,
retain collision correctness, and support cheap forks. Internal iteration need
not define acquisition order; contribution tuples and the runtime's observed
acquisition order do. Pruning must account for multiple public slots, private
lexical references and inherited root identities.

A raw, operation-free factory path can remove execution-wrapper frames while
preserving raw acquisition semantics. General factories still require their
classification, projection and ownership pipeline. Ancestry should share history
instead of copying complete ancestor arrays per acquisition, with cycle tests
covering synchronous public reentry, pending factories and retained proxies.

Compiler changes require fresh worker measurements and adversarial type tests.
Runtime improvements are not evidence of compiler improvements. An upstream
compiler limit must be isolated with a library-free control before attributing it
outside the library.

## Validation

Use Node 24.20.0, classic TypeScript 6.0.3 and native TypeScript 7.0.2. Record the
actual Bun version. Timings are serial fresh-process observations; do not overlap
performance samples with compiler suites. Keep runtime audit probes, meaningful
work-count regressions and Node stack regressions. Full merge checks include the
complete test suite, both typechecks/builds and emitted Node regressions. Preserve
all failure rows, command statuses and source identities.
