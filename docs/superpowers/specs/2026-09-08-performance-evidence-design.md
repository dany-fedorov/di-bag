# Performance evidence design

**Status:** proposed implementation design, 2026-09-08.

## Decision

Keep compiler resource/diagnostic controls as correctness gates and add a
separate repeated runtime evidence program. It measures an installed packed
archive in fresh children, validates that each workload ran, and reports raw
samples plus derived statistics. Normal PR measurements are informational.
Only a controlled pinned runner may flag a possible regression, and that flag
requires confirmation; it never makes a general claim that di-bag is faster
than another library.

## Inputs, provenance and unavailable state

Current historical compiler tables in `docs/benchmarks/typescript.md` are
single-machine observations. The existing complete matrix remains authoritative
for its reported date, including the open 500/1000 chain/token failures; these
rows must never be removed, converted to passes, or hidden by the smaller
repeated control series.

The intrinsic baseline is pinned to Git commit `739b509` (tree hash recorded
at execution) and built from `git archive`, never from the current dirty tree.
Current and baseline use identical fixture source, lockfile, build tools and
packed-archive protocol. Tool identity is read from
`tools/platform-versions.json`; no runner downloads an executable or package.
An absent pinned tool produces a retained `unavailable` row and no performance
claim.

All raw JSONL/Markdown evidence is committed under
`docs/benchmarks/results/<UTC-date>-<short-sha>/`. Rows retain the canonical
environment, package/binary/fixture hashes, command, warm-up/sample counts,
order seed, each raw elapsed value and derived statistics. They retain invalid
child output as failure evidence rather than dropping it as an outlier.

## Runtime protocol

Each sample starts a fresh child copied into a locally installed archive
consumer with its complete scenario fixture tree: child at
`consumer/scripts/runtime-benchmark-child.ts` and fixture at
`consumer/tests/benchmarks/runtime-scenarios.ts`, preserving their relative
import. The child imports the public root by bare specifier and reports its canonical resolved path; the parent
requires that path to be inside that consumer's `node_modules/di-bag`.
`prepareScenario` performs fixture construction and any mandated priming before
the timer. `runTimed` returns a `Promise`; the child starts
`process.hrtime.bigint()`, awaits `runTimed`, then stops the timer so async
close operations remain in the measured operation. `verifyScenario` runs after
the timer. Installation, archive build, child and
fixture copying, graph-input construction, priming, console I/O, assertions,
test framework work and GC forcing are excluded. The parent rejects nonzero
exits, signals, timeouts, stderr, malformed/noncanonical JSON, wrong identity,
wrong checksum or semantic control failure.

Portable scenarios at exactly 10 and 100 linear named providers are `build-close`,
`cold-linear-resolve`, `warm-root-resolve`, `scope-resolve-close`,
`transient-resolve-close`, and `raw-promise-identity`. `node-native-promise`
is separate, imports `di-bag/node`, and cannot appear in browser/Deno/competitor
claims. Every scenario returns a deterministic checksum, factory/disposer
counts and exact cleanup log. The sole construction measurement is `build-close`,
which times only `begin().add(bindings).end()` followed by `close()` with zero
factory calls. Every resolution scenario constructs its bag during preparation:
`cold-linear-resolve` times one terminal resolve from an unprimed prepared bag
with N factory calls; `warm-root-resolve` prepares/builds and primes before
timing then times one cached terminal resolve with no additional factory calls;
`scope-resolve-close` times child scope
creation, root/scoped/transient resolves and child close against a prepared
parent; `transient-resolve-close` times N transient resolves and close against a
prepared bag; and `raw-promise-identity` times one raw resolve and close against
a prepared bag. `node-native-promise` has the same prepare/run/verify boundary
and is explicitly Node-only.

Run five warm-up children and 31 measured children per scenario/implementation.
For current versus baseline, alternate `A,B`/`B,A` with a recorded stable seed.
Report min, p05, median, p95, mean, standard deviation, max and paired ratios
from raw values. No post-hoc outlier removal is permitted.

## Comparison and verdicts

The only mandatory comparison is current di-bag against `739b509`. On a
dedicated controlled host, flag review if median is at least 15% slower, p95 is
at least 20% slower, and a paired-bootstrap median-ratio 95% interval lies
above 1.10. Repeat an independently ordered 31-sample run before documenting a
regression. PR reports validate structure/statistics but never fail merely for
a noisy delta.

Optional third-party context is limited to lockfile-pinned Typed Inject and
Awilix adapters after semantic review. Their table is labelled “restricted
common-subset throughput” and only covers synchronous named graphs,
singleton/transient resolution and an explicit lifecycle where available.
Modules, private exports, typed closure, tokens, aliases, selected sharing,
native Promise observation and unequal ownership rules are excluded. A library
that cannot meet this contract is recorded `not-comparable`, never forced into
a changed workload. A handwritten `Map` may appear only as “lower-bound
control”, never as a DI-library comparison.

## Compiler controls

`npm run benchmark:types` remains the exhaustive diagnostic/resource matrix
with its nonzero informational outcome. `benchmark:compiler-controls` adds
five warm-ups plus 31 samples only for supported named chained 100, named
grouped 1000 and token binding 100 valid/missing/wrong-shape controls. It
records compiler time, process wall time, RSS and instantiation count. Negative
rows must retain their exact marker. Classic TypeScript 6 and native TypeScript
7 are distinct series and compare only against the identical compiler identity.
