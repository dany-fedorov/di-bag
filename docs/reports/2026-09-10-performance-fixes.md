# Runtime performance fixes — 2026-09-10

This follow-up fixes the deep-disposal failure and three avoidable runtime costs
from the [performance audit](2026-09-10-performance-audit.md). Public acquisition,
inspection, lifetime, and disposal semantics are preserved.

## Changes

- Disposal uses an explicit DFS stack. It preserves dependency and insertion
  order without consuming one JavaScript stack frame per dependency.
- Cycle detection also uses an explicit DFS stack. Re-reading an existing edge
  skips traversal; a new edge still undergoes cycle detection, and lifetime
  capture validation remains before cache/edge handling.
- A reverse dependency index limits retirement to actual incoming consumers.
  Releasing a consumer removes its outgoing index memberships before clearing
  its dependency set, including asynchronous failed-acquisition rollback.
- Binding graphs snapshot each shared module lexical map once. Derived graphs
  share encapsulated binding descriptions and normalized registrations, copying
  only their lookup tables and changed contribution arrays. Caller-owned maps
  and reference objects remain isolated from graph state.

Implementation: [acquisition.ts](../../src/acquisition.ts),
[acquisition-family.ts](../../src/acquisition-family.ts),
[runtime.ts](../../src/runtime.ts).

## Measurements

These comparisons use the same audit probe, Node 24.20.0, fresh processes, forced
GC for memory observations, a 512 MiB V8 old-space cap, and a 30-second process
deadline. Each repeated scenario runs before then after for each of three
samples; the table reports their medians. These local measurements are
informational, not a controlled-runner regression verdict.

The baseline contains the concurrent native-provider-metadata changes, with
only the three performance implementation files restored to their pre-fix
versions. Source hashes confirm that those are the only source differences
between the compared builds.

| Workload | Before | After |
| --- | ---: | ---: |
| Close 10,000 trivial owned acquisitions | 556.84 ms | 18.17 ms |
| 10,000 retained-proxy reads, 1,000 downstream services | 665.35 ms | 4.22 ms |
| Create/close 100 scopes overriding one of 1,000 providers | 48.37 ms | 17.23 ms |
| Install one 1,000-provider module | 212.48 ms | 2.74 ms |
| Heap retained by that module installation | 65.83 MiB | 0.35 MiB |

The deep graph case, measured once per build, changed from a stack overflow and
**zero disposers invoked** to **all 12,000 disposers invoked**. A second close
does not duplicate cleanup. The independent Node regression verifies exact
dependent-before-dependency order.

Single-process construction observations also improved: 5,000 individual
additions fell from 6,080 ms to 2,088 ms, and 5,000 replacements of one key fell
from 4,481 ms to 1,215 ms. Lookup-table copying and old binding retention remain;
these improvements do not establish linear construction complexity.

Raw [before](../benchmarks/results/2026-09-10-runtime-fixes/before.jsonl) and
[after](../benchmarks/results/2026-09-10-runtime-fixes/after.jsonl) observations,
[source/build identities and medians](../benchmarks/results/2026-09-10-runtime-fixes/manifest.json)
are retained. The warm-proxy probe times its direct-resolution control after its
proxy loop; those very short control times have different JIT warmup exposure
and are not used as a regression verdict.

## Verification

- The new Bun tests initially failed on full-family retirement scans, repeated
  traversal of existing edges, and duplicate module lexical-map snapshots.
- Both new Node tests initially failed with stack overflows: one during disposal,
  the other while adding a late edge to a deep ready graph. Bun could handle the
  original 12,000-node depth, so Node-specific coverage is necessary.
- **344 runtime tests across 25 files passed**, with 1,681 assertions. Coverage
  includes disposal, failed acquisition retries, root/shared scopes, private
  module bindings, aliases, contributions, observers, startup and metadata.
- Both Node regressions passed against **classic and native emitted builds**.
- Classic and native full-project typechecking passed. Both production builds
  emitted successfully to isolated temporary directories.
- An independent read-only review found no blocking correctness issue.

Regression files: [Bun runtime scale tests](../../tests/runtime-scale.test.ts),
[Node runtime scale tests](../../tests/runtime-scale.node.mjs). The
[CI workflow](../../.github/workflows/ci.yml) runs the Node regressions after
both classic and native builds. The unrelated packaging, compiler-matrix and
browser test suites were not rerun for these runtime changes.

The [evidence directory](../benchmarks/results/2026-09-10-runtime-fixes) retains
the failing and passing test logs. To run the Node regression against an
isolated build:

```sh
./node_modules/.bin/tsc6 -p tsconfig.build.json \
  --outDir /tmp/di-bag-performance-fixed-dist --declaration false
DI_BAG_RUNTIME_ENTRY=/tmp/di-bag-performance-fixed-dist/node.js \
  node --test --test-isolation=none tests/runtime-scale.node.mjs
```

## Remaining limits

The paired probes explicitly confirm two unfixed cases:

- Borrowed transient values and their inspection records still remain until the
  owning bag closes. Ten thousand 256-number arrays retain about 34 MiB in both
  builds. Closing that bag is much faster after this change, but open-bag memory
  retention requires a separate decision about value/history retention.
- Cold synchronous resolution of a 1,000-service linear chain still overflows
  the factory/proxy call stack. Iterative cleanup and cycle search do not make
  arbitrary synchronous user factories resumable.

Immutable builder lookup tables are still copied, and replaced binding
descriptions are still retained. Persistent graph storage or reachability-based
pruning needs to preserve private lexical references and ancestor root ownership.
The original TypeScript fluent-chain/compiler limits also remain.

Use short-lived scopes for repeated transient work and bulk/grouped registration
for large static compositions while those designs are addressed.

## Merge verification

The performance patch was isolated onto `main` at `da6ec93` for integration,
excluding the concurrent metadata refactor. The first full `npm run check`
completed 996 tests successfully and failed one archive setup check: a valid
SHA512 integrity value containing `+/` was mistaken for an absolute path by the
release evidence validator. The retained [initial merge log](../benchmarks/results/2026-09-10-runtime-fixes/merge-check-initial.log)
records the failure. A focused validation repair and deterministic regression
accompany the runtime patch.

Both production emitters built successfully on the isolated integration tree,
and both Node scale regressions passed against each output. Native full-project
typechecking also passed. These additional merge checks supersede the earlier
statement that packaging and browser suites had not been rerun; the initial
full run passed their other executed cases, with the archive setup failure kept
explicit here.

The native source-contract gate accepted all 124 fixtures, matching all 670
expected diagnostics with zero unexpected diagnostics or failures.
`npm run docs:check` passed 11 documentation tests and confirmed current generated
API pages after installing the separate locked documentation toolchain.

The archive repair passed its deterministic checksum regression and all 90
release-artifact tests (422 assertions). Both full-project typechecks passed
again after that repair. Every runnable example also completed successfully.
The PR's full CI gates remain the final merge verification.
