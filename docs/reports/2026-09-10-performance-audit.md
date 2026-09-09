# Performance failure audit — 2026-09-10

The highest-priority failure is lost resource cleanup after a deep dependency
graph overflows the disposal traversal. Long-lived transient workloads, repeated
dependency reads, large modules, and scope overrides also expose costs that the
existing 10/100-provider runtime benchmarks do not cover.

This is an investigation, with proposed remedies below. Production code was not
changed as part of this audit.

## Evidence and scope

Runtime measurements use the emitted Node entry from commit
`da6ec93ad13ce457e07318138bd0e1c080e19eb7`. Other edits appeared in the shared
workspace during the audit. To establish provenance, a fresh build of that Git
commit was compared with the measured output: every emitted file matched byte
for byte. Compiler spot checks were also repeated in that isolated source copy.

Environment: Linux x86-64, Node 24.20.0, installed TypeScript 6.0.3, Bun 1.4.2.
Each recorded runtime observation ran in a fresh Node process, serially, with
`--expose-gc`, a 512 MiB V8 old-space cap, and a 30-second process deadline.
The cap is not a total-process memory limit. Timing tables use the median of
three processes where indicated; memory and other scaling probes use single
observations. These are diagnostic measurements, not portable latency limits or
controlled-runner regression verdicts. Payload size is explicit in memory cases.

Artifacts: [probe](../benchmarks/results/2026-09-10-da6ec93/probe.mjs),
[47 runtime observations](../benchmarks/results/2026-09-10-da6ec93/runtime.jsonl),
[source/build identities](../benchmarks/results/2026-09-10-da6ec93/manifest.json),
[runtime test log](../benchmarks/results/2026-09-10-da6ec93/runtime-tests.log).

## 1. High: deep cleanup can abandon every owned resource

**Trigger:** acquire 10,000 owned services, then establish a linear dependency
chain through their retained dependency proxies. This avoids deep factory
recursion: all services exist before the edges are added. Close the bag.

**Observed:** `close()` rejects with an `AggregateError` containing
`RangeError: Maximum call stack size exceeded`; **0 of 10,000 disposers run**.
Acquisition inspection is then empty, resolution reports `bag is closed`, and
a second close still runs zero disposers. The 1,000-service control disposes
all 1,000 resources. Both outcomes were reproduced in a second process.

**Cause:** the recursive traversal in [acquisition.ts](../../src/acquisition.ts)
at lines 298–308 builds the entire disposal order before running any finalizer.
If traversal throws, the `finally` block at lines 316–329 clears the records and
ownership stages regardless. The memoized close promise prevents recovery.

**Consequence:** valid, sufficiently deep graphs can leak connections, file
handles, or other explicitly owned resources at shutdown. This is a correctness
failure triggered by graph scale, not merely a slow close.

**Remedy:** use an iterative postorder traversal and preserve cleanup obligations
if planning fails. Add a regression that acquires nodes independently, links a
deep acyclic graph, and checks every disposer and dependency order. It should
also verify idempotent close and aggregation of actual disposer failures.

## 2. High for long-lived bags: transient values remain strongly retained

**Trigger:** repeatedly resolve a borrowed transient provider and discard every
returned value. The probe returns an array of 256 numbers and attaches no
disposer.

| Resolutions | Heap retained after forced GC | Acquisition records |
| ---: | ---: | ---: |
| 1,000 | 3.44 MiB | 1,000 |
| 5,000 | 17.01 MiB | 5,000 |
| 10,000 | 33.90 MiB | 10,000 |

After close and GC, the 10,000-resolution case retained approximately 0.18 MiB
above its baseline. This is retention for the lifetime of the open bag, not a
claim that those values remain leaked after successful close.

**Cause:** [acquisition.ts](../../src/acquisition.ts), lines 210–212, skips the
instance cache for transients but still adds every successful acquisition to
`attempts` and the family. The acquisition's `exposed` value and execution result
hold the payload. Successful attempts are released at close; inspection exposes
all of them while open.

**Consequence:** resolving transients directly from a process-lifetime bag can
grow heap with total resolutions even when callers keep no references. More
retained attempts also increase shutdown cost in finding 3.

**Remedy:** define a bounded retention policy for borrowed transient values,
separately from ownership accounting and inspection metadata. Preserve retained
proxy lifetime/cycle checks when changing this policy. An immediate application
workaround is a short-lived scope for each unit of work, closed in `finally`.
Changing transient identity semantics is unnecessary.

## 3. Medium: releasing acquisitions performs quadratic work

The probe resolves one owned transient repeatedly; its factory returns `1`,
its disposer only increments a counter, and there are no dependency edges.

| Acquisitions | Median complete close, three processes |
| ---: | ---: |
| 1,000 | 9.93 ms |
| 5,000 | 121.70 ms |
| 10,000 | 514.99 ms |

All expected disposers ran. The growing cost is library bookkeeping rather
than application cleanup work.

**Cause:** [acquisition.ts](../../src/acquisition.ts), lines 318–320, calls
`family.retireIncoming()` for every attempt. That method in
[acquisition-family.ts](../../src/acquisition-family.ts), lines 36–37, scans
every remaining family acquisition. An isolated bag therefore performs about
`n(n+1)/2` attempted edge deletions even with zero edges. A child close also
scans acquisitions in the rest of its family. Failed-attempt retirement uses
the same full-family scan.

**Consequence:** large scopes and retry-heavy workloads can stall the event loop
and consume a shutdown deadline even with trivial disposers.

**Remedy:** maintain incoming-edge indexes, or batch family removal so unrelated
acquisitions are not rescanned per removal. Verify flat workloads, overlapping
child scopes, and failed acquisition retries; assert traversal counts rather
than fragile wall-clock thresholds in ordinary CI.

## 4. Medium: cached dependency reads repeatedly traverse downstream services

The probe first acquires an acyclic chain and establishes its edges. A service
returns `() => deps.p0`; the measured calls all read the same already-cached
service through this retained proxy. No factories run during measurement.

| Downstream services | 10,000 proxy reads, median | 10,000 direct `bag.resolve('p0')` calls, median |
| ---: | ---: | ---: |
| 10 | 13.21 ms | 0.97 ms |
| 100 | 56.11 ms | 0.97 ms |
| 1,000 | 621.94 ms | 0.77 ms |

**Cause:** the cache-hit branch in [acquisition.ts](../../src/acquisition.ts),
line 168, always invokes `recordEdge`. In
[acquisition-family.ts](../../src/acquisition-family.ts), lines 40–60, it
allocates a visited set and searches for a reverse path before adding the edge,
even when that exact edge already exists. Cost is proportional to the reachable
subgraph per read, rather than a constant-time cache lookup. The search is also
recursive, introducing another depth-sensitive path.

**Consequence:** service methods retaining `deps` or using lazy dependency getters
can be much slower than top-level cache-hit benchmarks suggest.

**Remedy:** fast-path existing edges; retain cycle detection for new edges and
use an iterative search. Check that late reads between already-ready services
still reject newly introduced cycles. Applications can capture stable scoped
dependencies during construction when repeated dynamic lookup is unnecessary;
that substitution must not change intended transient or lazy behavior.

## 5. Medium: a module duplicates its complete lexical map per binding

The probe builds a module in bulk from identical trivial providers, exports one
service, then measures installation before resolving anything.

| Providers in one module | Install time | Heap retained by installation |
| ---: | ---: | ---: |
| 100 | 3.89 ms | 0.80 MiB |
| 500 | 60.88 ms | 16.57 MiB |
| 1,000 | 206.83 ms | 65.83 MiB |

**Cause:** [module.ts](../../src/module.ts), lines 208–217, correctly shares one
`localNames` map across its binding descriptions. The `BindingGraph` constructor
in [runtime.ts](../../src/runtime.ts), line 45, then clones the entire map and
every reference object separately for every binding. A module with `n` local
bindings produces `n²` lexical-map entries even with no actual dependencies.
Graph reconstructions repeat these copies.

**Consequence:** a large module can consume substantial heap before any factory
runs; installations and overrides can cause allocation and GC spikes.

**Remedy:** share an encapsulated immutable lexical map per installation across
bindings and subsequent graph versions. Preserve private IDs, renamed exports,
and external-slot lookup semantics. Smaller modules limit the immediate cost.

## 6. Medium: incremental construction and overrides copy the whole graph

**Cause:** [runtime.ts](../../src/runtime.ts), lines 116–130, copies all bindings
and public slots, then reconstructs and normalizes all bindings. `add`, `bind`,
`replace`, contributions, and installation repeatedly take equivalent paths.
Individual additions therefore have quadratic aggregate construction cost.
Replacement also retains old binding descriptions, even in the simple case
where no private reference needs them.

**Observed, single processes:** 5,000 individual additions took **5,378 ms**;
one bulk addition of the same 5,000 providers took **5.33 ms**. Replacing a single
public key 5,000 times took **4,234 ms** and retained about **4.19 MiB** of heap
above the pre-builder baseline. The replacement factories were not invoked.

**Request-scope effect, medians of three processes:** creating and closing 100
empty scopes on a 1,000-provider bag took **0.64 ms**. Overriding just one binding
in those scopes took **45.97 ms**. With 5,000 providers, those totals were
**0.65 ms** and **281.12 ms**. No service acquisition is needed to incur that cost.
These flat graphs do not include the additional module copying from finding 5.

**Remedy:** share immutable normalized descriptions and represent changes as
overlays or another persistent structure. Prune obsolete bindings only when
private references and ancestor ownership cannot reach them. Prefer bulk
registration for static composition. Add an override-scope benchmark distinct
from the existing no-override scope benchmark.

## 7. Medium: cold resolution has a separate runtime depth limit

**Observed:** the raw synchronous linear-chain probe resolved 100 and 500 services
successfully, but 1,000 and 2,000-service cases threw `RangeError` after entering
758 factories. These are bulk runtime registrations, so no TypeScript fluent
chain is involved. The exact threshold depends on the engine and stack shape.

**Cause:** [acquisition.ts](../../src/acquisition.ts), lines 214–231, recursively
enters factories from the dependency proxy. `AcquisitionFamily.ancestry()` also
copies and scans ancestry at every cold acquisition, adding quadratic work and
storage for deep cold chains.

**Remedy:** explicitly distinguish supported provider count from supported
dependency depth. A staged resolver for declared dependency tuples could avoid
some recursion; arbitrary synchronous proxy-based factories require a more
careful API/design decision. Pre-acquiring services in dependency order is a
possible application workaround when that order is known. Do not silently
change synchronous service outputs to promises.

## TypeScript: confirmed existing limits, separate from runtime failures

Two fresh checks against the isolated commit used the existing public-API
generator with 1,000 providers, TypeScript 6.0.3, default Node stack, a 1,024 MiB
V8 old-space cap, and a 30-second deadline:

- Individual fluent additions: process exit 1, `RangeError` in TypeScript type
  instantiation. This is a compiler crash, not a rejected dependency graph.
- Groups of 50 registrations: exit 0, zero diagnostics; the exact compiler time,
  RSS and instantiation count are in the retained output.

Logs: [fluent chain](../benchmarks/results/2026-09-10-da6ec93/compiler-chained.log),
[grouped control](../benchmarks/results/2026-09-10-da6ec93/compiler-grouped.log).

The [existing supported scale contract](../benchmarks/typescript.md#supported-scale-contract-2026-09-09)
already recommends bulk/grouped/named-module forms at 1,000 providers and records
native compiler time, memory and instantiation limits. This audit did not rerun
the full 108-case compiler matrix or measure editor responsiveness. Passing a
grouped compiler case does not establish safe cold runtime depth (finding 7).

## Coverage and next checks

The ten targeted runtime suites passed: **157 tests, zero failures, 741
assertions**, both in the shared workspace and when repeated against the isolated
Git source copy. The retained log is from the isolated run. The emitted runtime
under measurement was also verified against that source build.

The existing [runtime scenarios](../../tests/benchmarks/runtime-scenarios.ts)
accept only 10 or 100 providers. Their warm case measures a direct resolution,
their scope case uses no overrides, and transient measurements close the bag
after bounded acquisition. This leaves all seven scaling cases above uncovered.

Prioritize iterative disposal and cleanup recovery, then acquisition retention
and family edge removal. Follow with repeated-edge fast paths and immutable graph
sharing. Keep correctness assertions for disposal order, cycles, lexical private
references, lifetime capture, retries and inspection alongside these changes.

Additional workload risks identified by inspection, not measured here: observer
events and unresolved observer callbacks have no backpressure; startup's parallel
mode starts every selected provider; close waits for pending sources and disposers
without its own deadline. These require workload-specific tests. An uncooperative
never-settling factory is an application/contract risk, not evidence of a new
timeout regression. Browser/Bun runtime limits and concurrent request latency
were not benchmarked in this audit.

## Reproduction

Run from the repository root. For exact historical results, first use a checkout
of the commit named above. The probe uses JavaScript public API calls to measure
runtime graph sizes independently of TypeScript admission limits.

```sh
./node_modules/.bin/tsc6 -p tsconfig.build.json \
  --outDir /tmp/di-bag-performance-audit-dist --declaration false

node --expose-gc --max-old-space-size=512 \
  docs/benchmarks/results/2026-09-10-da6ec93/probe.mjs \
  /tmp/di-bag-performance-audit-dist/node.js close-deep 10000
```

Replace the final scenario/count with `close-flat 10000`,
`transient-memory 10000`, `warm-proxy 1000`, `module-install 1000`,
`scope-override 5000`, `build-incremental 5000`, `replace-history 5000`, or
`cold-chain 1000`. Run each in a fresh process; the optional final argument is a
sample number. Expected graph failures are recorded as JSON, so probe exit 0
means observation completed, not that the library passed a regression test.
The retained stack traces contain the temporary paths used during collection.

For compiler spot checks, run each command separately under a process deadline:

```sh
timeout 30s node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
  --max-old-space-size=1024 scripts/benchmark-types.ts --worker 1000 chained valid
timeout 30s node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
  --max-old-space-size=1024 scripts/benchmark-types.ts --worker 1000 grouped valid
```
