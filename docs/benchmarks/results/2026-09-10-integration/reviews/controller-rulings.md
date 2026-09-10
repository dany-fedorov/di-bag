# Controller decisions, in chronological order

Ruling: Add narrowly scoped release checksum false-positive repair before initial merge — full suite exposes legitimate digest rejected as a path, independent of runtime logic — if wrong, path-leak validation could weaken; require exact canonical digest case plus preserved hostile-path tests and read-only review.

Ruling: Extend Task 2 storage reuse to module-local registrations and contributions — the observational baseline measures the same whole-table-copy cost, about 1.7 seconds for 5,000 module additions — if wrong, declaration order or module snapshot semantics could regress; require insertion-order, replacement-position, immutable-view tests and paired evidence.

Ruling: Track users of lexical snapshots in the current graph instead of protecting their targets forever through ancestry — the spec requires pruning obsolete public bindings once no current reference needs them — if wrong, private targets could be pruned too early; require reference counts, last-user regressions, contribution controls and preserved constructor-private preflight.

Ruling: Add a focused CI process-monitor and package-test repair after Task 2 — two successive CI runs rejected valid compiler work and timed out both aggregate package tests, blocking reliable integration evidence — if wrong, supervision could become too permissive or test organization could hide regressions; retain live-child failure oracles, every package contract and unchanged worker limits.
