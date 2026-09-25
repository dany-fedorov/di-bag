# TypeScript compiler scale

DI Bag checks dependency graphs in the type system, so one long fluent
expression costs compiler time, memory, and stack depth. This page records the
measured limits for the pinned compilers, compares 0.5.0 with 0.4.0, and
explains how to reproduce every number.

## The limit, plainly

One fluent expression is bounded by the compiler's process budgets. The
classic checker also descends through a call chain recursively, so its ceiling
depends on V8's stack and JIT state. Near a 60-second or 3,072 MiB limit, host
load can move the first failed count; the ceiling is therefore a measured
bracket, not a constant.

- **Classic TypeScript 6.0.3.** A chain of 1,015 `.withServices()` calls is
  accepted; 1,031 is flaky and counts as failed because one repeat exceeded
  the 60-second budget. The library-free control accepts 1,046 and overflows
  the V8 stack at 1,062. A bulk map followed by individual
  `.withReplacedService()` calls accepts 937 and times out at 952. Named modules
  reach the 1,500-call search bound without a failure.
- **Native TypeScript 7.0.2.** A chain accepts 1,304 calls; 1,328 is flaky and
  counts as failed because one repeat times out. Replacement accepts 1,069 and
  reaches the 3,072 MiB measurement budget at 1,093. The library-free control
  and named modules both reach the 2,500-call search bound without a failure.
- **Budget 500 calls per expression.** The 0.5.0 matrices still show
  super-linear growth: on classic TypeScript, 100, 500, and 1,000 chained calls
  instantiate 0.77 M, 13.91 M, and 53.75 M types. Editors check the same
  expression under similarly variable host conditions. Beyond 500, group.

## Grouping guidance, measured

For the same 1,000 linearly dependent providers on the recorded host, the
0.5.0 valid cases were:

| Shape | Classic 6.0.3 | Native 7.0.2 |
| --- | --- | --- |
| One bulk `withServices({ … })` map | 3.477 s, 560 MiB, 2.50 M | 1.055 s, 205 MiB, 2.52 M |
| Twenty provider maps of 50, one `withServices` call each | 4.368 s, 597 MiB, 3.53 M | 1.369 s, 254 MiB, 3.55 M |
| 1,000 chained `withServices` calls | 42.826 s, 2,695 MiB, 53.75 M | 20.450 s, 1,760 MiB, 53.76 M |
| Bulk map, then 1,000 `withReplacedService` calls | 60 s timeout | 29.156 s, 2,496 MiB, 85.95 M |
| 1,000 distinct token modules in one `withInstalledModules` call | 53.719 s, 2,383 MiB, 38.22 M | 27.668 s, 1,603 MiB, 38.23 M |

Bulk maps and registration groups remain the cheapest shapes. Token modules
are substantially cheaper in 0.5.0 than in 0.4.0 by instantiation count, but
the classic 1,000-module missing-token negative case crossed its 60-second
worker budget in this run. Missing and wrong-shaped dependencies were rejected
at the generated boundary in every other matrix case without TS2589.

## Recorded results

The 0.5.0 results were recorded 2026-09-25 at `e66bf5e` on Linux
7.0.11, x64, 24 CPUs, 31,689 MiB, Node v24.20.0, Bun 1.4.0,
TypeScript 6.0.3 and native TypeScript 7.0.2. The 0.4.0 columns retain the
2026-09-18 results recorded at `d018d50` (library source identical to
`2e6602f`) on the same host class and toolchain. Timings and RSS are
informational and carry shared-host noise; instantiation counts are the
deterministic comparison.

In each release column below, values are **compile time / peak RSS /
instantiations**. The change column is in that same order. "Rejected at the
boundary" means the intended diagnostic occurred exactly once at the generated
boundary with no TS2589.

### Classic 6.0.3

| Form | Operations | 0.4.0 | 0.5.0 | Change | 0.5.0 negative cases |
| --- | ---: | --- | --- | --- | --- |
| bulk | 100 | 1.0 s / 364 MiB / 158,620 | 1.109 s / 364 MiB / 143,120 | +10.9% / +0.0% / -9.8% | 2/2 rejected at the boundary |
| bulk | 500 | 1.6 s / 435 MiB / 806,220 | 1.928 s / 427 MiB / 791,520 | +20.5% / -1.8% / -1.8% | 2/2 rejected at the boundary |
| bulk | 1,000 | 3.4 s / 606 MiB / 2,515,720 | 3.477 s / 560 MiB / 2,502,020 | +2.3% / -7.6% / -0.5% | 2/2 rejected at the boundary |
| chained | 100 | 1.4 s / 409 MiB / 787,433 | 1.572 s / 395 MiB / 766,587 | +12.3% / -3.4% / -2.6% | 2/2 rejected at the boundary |
| chained | 500 | 10.0 s / 1,530 MiB / 13,955,833 | 11.408 s / 1,434 MiB / 13,914,187 | +14.1% / -6.3% / -0.3% | 2/2 rejected at the boundary |
| chained | 1,000 | 35.9 s / 2,713 MiB / 53,816,333 | 42.826 s / 2,695 MiB / 53,748,687 | +19.3% / -0.7% / -0.1% | 2/2 rejected at the boundary |
| grouped | 100 | 1.0 s / 364 MiB / 165,967 | 1.102 s / 355 MiB / 150,413 | +10.2% / -2.5% / -9.4% | 2/2 rejected at the boundary |
| grouped | 500 | 1.7 s / 420 MiB / 1,059,991 | 1.809 s / 410 MiB / 1,044,805 | +6.4% / -2.4% / -1.4% | 2/2 rejected at the boundary |
| grouped | 1,000 | 3.5 s / 643 MiB / 3,547,681 | 4.368 s / 597 MiB / 3,532,955 | +24.8% / -7.2% / -0.4% | 2/2 rejected at the boundary |
| replacement | 100 | 1.4 s / 407 MiB / 1,030,879 | 1.707 s / 398 MiB / 1,016,697 | +21.9% / -2.2% / -1.4% | 2/2 rejected at the boundary |
| replacement | 500 | 12.0 s / 2,056 MiB / 21,767,279 | 13.177 s / 2,038 MiB / 21,758,697 | +9.8% / -0.9% / -0.0% | 2/2 rejected at the boundary |
| replacement | 1,000 | stack overflow | 60 s timeout | status only | 0/2 (both timed out) |
| bindings | 100 | 1.8 s / 441 MiB / 846,866 | 1.992 s / 422 MiB / 831,220 | +10.7% / -4.3% / -1.8% | 2/2 rejected at the boundary |
| bindings | 500 | 9.3 s / 1,684 MiB / 12,152,666 | 10.870 s / 1,669 MiB / 12,136,620 | +16.9% / -0.9% / -0.1% | 2/2 rejected at the boundary |
| bindings | 1,000 | 28.7 s / 2,667 MiB / 44,959,916 | 36.235 s / 2,576 MiB / 44,943,370 | +26.3% / -3.4% / -0.0% | 2/2 rejected at the boundary |
| modules | 100 | 2.2 s / 549 MiB / 1,241,263 | 2.270 s / 441 MiB / 790,212 | +3.2% / -19.7% / -36.3% | 2/2 rejected at the boundary |
| modules | 500 | 15.0 s / 2,087 MiB / 19,718,663 | 11.465 s / 1,490 MiB / 10,524,812 | -23.6% / -28.6% / -46.6% | 2/2 rejected at the boundary |
| modules | 1,000 | 55.0 s / 2,953 MiB / 74,090,413 | 53.719 s / 2,383 MiB / 38,218,062 | -2.3% / -19.3% / -48.4% | 1/2; missing-token case timed out |

The named matrix accepted 33 of 36 cases; the three 1,000-replacement
scenarios timed out. The token matrix accepted 17 of 18; only the
1,000-module missing-token case timed out. Every completed negative case
reported the intended boundary diagnostic.

### Native 7.0.2

| Form | Operations | 0.4.0 | 0.5.0 | Change | 0.5.0 negative cases |
| --- | ---: | --- | --- | --- | --- |
| bulk | 100 | 0.1 s / 97 MiB / 146,745 | 0.108 s / 96 MiB / 154,751 | +8.0% / -0.7% / +5.5% | 2/2 rejected at the boundary |
| bulk | 500 | 0.4 s / 143 MiB / 795,545 | 0.367 s / 156 MiB / 804,351 | -8.3% / +9.0% / +1.1% | 2/2 rejected at the boundary |
| bulk | 1,000 | 1.1 s / 207 MiB / 2,506,545 | 1.055 s / 205 MiB / 2,516,351 | -4.1% / -1.1% / +0.4% | 2/2 rejected at the boundary |
| chained | 100 | 0.3 s / 123 MiB / 775,819 | 0.324 s / 133 MiB / 778,468 | +8.0% / +8.0% / +0.3% | 2/2 rejected at the boundary |
| chained | 500 | 4.2 s / 550 MiB / 13,945,819 | 5.029 s / 536 MiB / 13,927,668 | +19.7% / -2.5% / -0.1% | 2/2 rejected at the boundary |
| chained | 1,000 | 17.0 s / 1,684 MiB / 53,808,319 | 20.450 s / 1,760 MiB / 53,764,168 | +20.3% / +4.5% / -0.1% | 2/2 rejected at the boundary |
| grouped | 100 | 0.1 s / 97 MiB / 154,255 | 0.117 s / 97 MiB / 162,196 | +17.0% / -0.1% / +5.1% | 2/2 rejected at the boundary |
| grouped | 500 | 0.4 s / 154 MiB / 1,049,487 | 0.458 s / 155 MiB / 1,057,796 | +14.5% / +1.0% / +0.8% | 2/2 rejected at the boundary |
| grouped | 1,000 | 1.2 s / 240 MiB / 3,538,687 | 1.369 s / 254 MiB / 3,547,456 | +14.1% / +5.7% / +0.2% | 2/2 rejected at the boundary |
| replacement | 100 | 0.3 s / 133 MiB / 1,019,267 | 0.338 s / 131 MiB / 1,028,592 | +12.7% / -1.7% / +0.9% | 2/2 rejected at the boundary |
| replacement | 500 | 5.6 s / 702 MiB / 21,756,867 | 6.435 s / 707 MiB / 21,771,792 | +14.9% / +0.7% / +0.1% | 2/2 rejected at the boundary |
| replacement | 1,000 | 23.9 s / 2,606 MiB / 85,928,867 | 29.156 s / 2,496 MiB / 85,950,792 | +22.0% / -4.2% / +0.0% | 2/2 rejected at the boundary |
| bindings | 100 | 0.4 s / 153 MiB / 828,102 | 0.455 s / 151 MiB / 836,319 | +13.7% / -1.2% / +1.0% | 2/2 rejected at the boundary |
| bindings | 500 | 4.2 s / 667 MiB / 12,105,502 | 5.213 s / 640 MiB / 12,114,519 | +24.1% / -4.0% / +0.1% | 2/2 rejected at the boundary |
| bindings | 1,000 | 15.9 s / 1,704 MiB / 44,877,252 | 20.849 s / 1,564 MiB / 44,887,269 | +31.1% / -8.2% / +0.0% | 2/2 rejected at the boundary |
| modules | 100 | 0.6 s / 171 MiB / 1,230,634 | 0.556 s / 181 MiB / 802,868 | -7.3% / +5.7% / -34.8% | 2/2 rejected at the boundary |
| modules | 500 | 7.0 s / 973 MiB / 19,708,834 | 5.169 s / 697 MiB / 10,537,868 | -26.2% / -28.4% / -46.5% | 2/2 rejected at the boundary |
| modules | 1,000 | 27.4 s / 2,488 MiB / 74,081,584 | 27.668 s / 1,603 MiB / 38,231,618 | +1.0% / -35.6% / -48.4% | 2/2 rejected at the boundary |

Both native matrices accepted all 36 named and all 18 token cases.

### Instantiation budget

No measured row increased instantiations by more than 10% from 0.4.0. The
largest increase is native `bulk` at 100 operations, +5.5%. Classic rows are
flat or lower; the largest module reductions are about 48% at 1,000 operations.
Timing increases above 10% remain visible in the tables and are not release
gates because they vary with host load.

### Repeatability controls

The 0.5.0 control command ran five warmups and retained 31 samples for each of
nine cases on each compiler: 18 summaries, 558 retained samples and 90
warmups. Every valid case compiled without diagnostics, and every negative
case reported its intended marker exactly once. These controls were introduced
after the 0.4.0 capture, so there is no matching 31-sample 0.4.0 column; they
are repeatability evidence, not release-to-release comparison rows.

Values below are medians: **compiler time / process time / peak RSS /
instantiations**.

| Compiler | Case | 0.5.0 median |
| --- | --- | --- |
| Classic 6.0.3 | chained 100, valid | 1.644 s / 1.985 s / 401 MiB / 766,587 |
| Classic 6.0.3 | chained 100, missing | 1.595 s / 1.923 s / 403 MiB / 762,943 |
| Classic 6.0.3 | chained 100, wrong shape | 1.602 s / 1.922 s / 401 MiB / 769,143 |
| Classic 6.0.3 | grouped 1,000, valid | 3.781 s / 4.081 s / 614 MiB / 3,532,955 |
| Classic 6.0.3 | grouped 1,000, missing | 3.820 s / 4.136 s / 613 MiB / 3,506,829 |
| Classic 6.0.3 | grouped 1,000, wrong shape | 3.847 s / 4.158 s / 615 MiB / 3,533,539 |
| Classic 6.0.3 | token bindings 100, valid | 1.956 s / 2.243 s / 423 MiB / 831,220 |
| Classic 6.0.3 | token bindings 100, missing | 2.030 s / 2.331 s / 422 MiB / 826,470 |
| Classic 6.0.3 | token bindings 100, wrong shape | 1.962 s / 2.248 s / 424 MiB / 829,182 |
| Native 7.0.2 | chained 100, valid | 0.304 s / 0.342 s / 131 MiB / 778,468 |
| Native 7.0.2 | chained 100, missing | 0.303 s / 0.338 s / 131 MiB / 774,830 |
| Native 7.0.2 | chained 100, wrong shape | 0.312 s / 0.348 s / 130 MiB / 781,335 |
| Native 7.0.2 | grouped 1,000, valid | 1.284 s / 1.340 s / 251 MiB / 3,547,456 |
| Native 7.0.2 | grouped 1,000, missing | 1.273 s / 1.327 s / 248 MiB / 3,521,336 |
| Native 7.0.2 | grouped 1,000, wrong shape | 1.293 s / 1.346 s / 249 MiB / 3,548,351 |
| Native 7.0.2 | token bindings 100, valid | 0.426 s / 0.468 s / 152 MiB / 836,319 |
| Native 7.0.2 | token bindings 100, missing | 0.418 s / 0.459 s / 151 MiB / 831,568 |
| Native 7.0.2 | token bindings 100, wrong shape | 0.433 s / 0.472 s / 152 MiB / 834,285 |

### Ceilings

Each search uses resolution 25 and three repeats per count. A count passes only
when every repeat is accepted. "Upper bound" means the search reached its
configured maximum without finding a failure; it is not the compiler's true
ceiling. Percentage change compares the largest accepted count.

| Form | Classic 0.4.0 | Classic 0.5.0 | Change | Native 0.4.0 | Native 0.5.0 | Change |
| --- | --- | --- | ---: | --- | --- | ---: |
| control | 1,015 / 1,031, stack | 1,046 / 1,062, stack | +3.1% | 2,500 upper bound | 2,500 upper bound | +0.0% |
| chained | 1,000 / 1,015, stack | 1,015 / 1,031, timeout | +1.5% | 1,375 / 1,398, memory | 1,304 / 1,328, timeout | -5.2% |
| replacement | 952 / 968, timeout | 937 / 952, timeout | -1.6% | 1,069 / 1,093, memory | 1,069 / 1,093, memory | +0.0% |
| named modules | 1,000 point | 1,500 upper bound | +50.0% bound | 1,000 point | 2,500 upper bound | +150.0% bound |

Classic chained 1,031 and native chained 1,328 each passed once before a later
repeat timed out, so both are recorded as flaky failures. The classic control's
1,062 stack overflow passed when rerun with `--stack-size=4000`, attributing
that boundary to V8's stack budget. The larger stack is an attribution
instrument, not a supported configuration. No native probe overflowed the
stack.

Results are tied to the recorded source and toolchain. Passing these synthetic
cases does not guarantee a particular editor latency, memory use, or arbitrary
graph size.

## Run the benchmarks

Run from the repository root with Node 24 or later:

```sh
npm run benchmark:types
npm run benchmark:types -- --tokens
npm run benchmark:types -- --native
npm run benchmark:types -- --native --tokens
npm run benchmark:compiler-controls
npm run benchmark:compiler-ceiling
npm run benchmark:compiler-ceiling -- --native --from 1000 --to 2500
```

The default command runs 36 cases, each in a fresh process: 100, 500, and 1,000
providers in bulk, individually chained, grouped, and replacement-heavy forms,
each with a valid graph, a missing final dependency, and an incompatible
intermediate dependency. Groups are reusable registration objects containing
50 providers; they are not nominal modules. The `--tokens` mode covers token
bindings and distinct token modules.

Every generated graph uses public `DiBag` calls and assignments of resolved
services to `number`, with no casts or `any` to erase checking. Factories form
a linear dependency graph. The replacement case first adds that graph in bulk,
then replaces each provider individually; its negative cases introduce the
missing dependency or incompatible value through replacement itself.

The strict in-memory compiler helper resolves real relative source imports and
reports diagnostic codes, file names, line/column positions, and messages.
Negative cases count as accepted only when they contain the intended graph
diagnostic and no TS2589. The unit-test gates require zero diagnostics for 100
chained additions, 100 replacements, and 1,000 grouped providers, and check
both negative graph cases for each form. Existing exact method/Promise
inference and emitted-declaration tests remain in place.

Each worker has a 60-second resource limit. Timeouts and compiler crashes are
reported as failed measurements, never as passing type checks. The command
finishes with an explicit acceptance/failure summary; its exit status indicates
report completion, not that every measured form passed. The contract tests do
not gate wall-clock latency. Separate incremental-work tests bound deterministic
compiler instantiation counts.

`benchmark:compiler-controls` runs five warmups and retains 31 samples for each
of three representative valid/negative shapes in both compiler lanes. It
records compiler and process time, RSS, instantiations, diagnostics, compiler
identity, and source provenance; the source tree must remain clean.

`benchmark:compiler-ceiling` bisects the largest accepted single-expression
call count per form—`chained`, `replacement`, `control` (a library-free chain
that imports the library so the checker is equally warm), and `named-modules`—
between `--from` and `--to` to a `--resolution` of 25 calls, with three repeats
per count. Every failure is classified (`stack-overflow`, `heap`, `timeout`,
`memory`, `output`, `diagnostics`, or `crash`); a classic stack overflow is
rerun once with a larger stack for attribution.

The native variants supervise the native executable directly under the Linux
limits described in the [development guide](../guides/development.md#compiler-checks-and-scale).
Benchmark commands write JSON-lines evidence under
`docs/benchmarks/results/`, named by date and commit; that directory is not
committed, and this page is the durable record.
