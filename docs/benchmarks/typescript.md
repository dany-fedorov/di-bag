# TypeScript compiler scale

DI Bag checks dependency graphs in the type system, so one long fluent
expression costs compiler time, memory, and stack depth. This page records the
measured limits for the pinned compilers, states the limit plainly, and explains
how to reproduce every number.

## The limit, plainly

One fluent expression is bounded by the compiler's recursion budget on V8's
default stack: the classic checker descends through a call chain recursively,
and how many calls fit depends on whether its functions run as interpreted or
optimized code, so the ceiling is a bracket, not a constant. The same
library-free chain overflows at 575 calls when compiled alone and passes at
1,015 when the program first checks the library.

- **Classic TypeScript 6.0.3.** A chain of 1,000 `.register()` calls is accepted;
  1,015 calls overflow the stack, one step below a library-free chain compiled
  under the same conditions (accepted at 1,015, overflowing at 1,031). A bulk
  map followed by individual `.replace()` calls is accepted at 952; at 968 one
  of three runs exceeded the 60-second budget, and 1,000 overflows the stack.
  The overflow is V8's stack budget: the same 1,000-replacement expression passes
  unchanged with a larger stack (`--stack-size=4000`, an attribution instrument,
  not a supported configuration) in 55.9 s and 3,215 MiB. DI Bag's types add a
  per-form constant at the innermost call, measured as 15 calls for chains and
  63 for replacements against the control, not a per-call cost.
- **Native TypeScript 7.0.2.** No stack ceiling: a library-free chain of 2,500
  calls checks in 0.4 s. A 1,000-call chain takes 17.0 s and 1,684 MiB; the
  search reaches the 3,072 MiB memory budget of these measurements at 1,398
  chained calls (1,375 accepted) and 1,093 replacements (1,069 accepted), with
  no crash.
- **Budget 500 calls per expression.** Cost is quadratic (0.79 M, 14.0 M and
  53.8 M instantiations for 100, 500 and 1,000 chained calls on either
  compiler), the ceiling moves with JIT state and host load, and editors check
  the same expression on the same stack. Beyond 500, group.

## Grouping guidance, measured

The same 1,000 linearly dependent providers, valid graph, on the recorded host
(compile time, peak RSS, instantiations):

| Shape | Classic 6.0.3 | Native 7.0.2 |
| --- | --- | --- |
| One bulk `register({ … })` map | 3.4 s, 606 MiB, 2.5 M | 1.1 s, 207 MiB, 2.5 M |
| Twenty registration maps of 50, one `register` each | 3.5 s, 643 MiB, 3.5 M | 1.2 s, 240 MiB, 3.5 M |
| Twenty named modules of 50, one `installModule` each | 15.5 s, 3,112 MiB, 3.5 M | 7.1 s, 2,469 MiB, 3.5 M |
| 1,000 chained `register` calls | 35.9 s, 2,713 MiB, 53.8 M | 17.0 s, 1,684 MiB, 53.8 M |
| Bulk map, then 1,000 `replace` calls | stack overflow at the default stack | 23.9 s, 2,606 MiB, 85.9 M |

Bulk maps and registration groups are the cheapest shapes. Named modules keep
the instantiation count of groups but cost more time and memory: at 1,000
providers the classic check needs about 3 GiB (three runs under the 3,072 MiB
heap limit: 15.5–15.6 s and 3,107–3,112 MiB; one run with an 8 GiB heap limit:
15.0 s and 3,068 MiB), at the edge of the matrix workers' heap limit. Missing
and wrong-shaped dependencies are rejected at the expected boundary in every
grouped and named-module case on both compilers (`tests/type-scale.test.ts`,
and the `grouped` rows below).

## Recorded results

Recorded 2026-09-18 at d018d50 (library source identical to 2e6602f) on Linux
7.0.11, x64, 24 CPUs, 31,689 MiB, Node v24.20.0; one run per row through the
matrix (`npm run benchmark:types`). The host was shared with other workloads
(1-minute load average 1.4–3.9 during the matrices), so timings carry that
noise. "Rejected at the boundary" counts the missing and wrong-shape scenarios
whose intended diagnostic occurred exactly once at the generated boundary with
no TS2589.

### Classic 6.0.3

| Form | Operations | Valid graph | Compile | Peak RSS | Instantiations | Negative cases |
| --- | --- | --- | --- | --- | --- | --- |
| bulk | 100 | accepted | 1.0 s | 364 MiB | 158,620 | 2/2 rejected at the boundary |
| chained | 100 | accepted | 1.4 s | 409 MiB | 787,433 | 2/2 rejected at the boundary |
| grouped | 100 | accepted | 1.0 s | 364 MiB | 165,967 | 2/2 rejected at the boundary |
| replacement | 100 | accepted | 1.4 s | 407 MiB | 1,030,879 | 2/2 rejected at the boundary |
| bulk | 500 | accepted | 1.6 s | 435 MiB | 806,220 | 2/2 rejected at the boundary |
| chained | 500 | accepted | 10.0 s | 1,530 MiB | 13,955,833 | 2/2 rejected at the boundary |
| grouped | 500 | accepted | 1.7 s | 420 MiB | 1,059,991 | 2/2 rejected at the boundary |
| replacement | 500 | accepted | 12.0 s | 2,056 MiB | 21,767,279 | 2/2 rejected at the boundary |
| bulk | 1,000 | accepted | 3.4 s | 606 MiB | 2,515,720 | 2/2 rejected at the boundary |
| chained | 1,000 | accepted | 35.9 s | 2,713 MiB | 53,816,333 | 2/2 rejected at the boundary |
| grouped | 1,000 | accepted | 3.5 s | 643 MiB | 3,547,681 | 2/2 rejected at the boundary |
| replacement | 1,000 | stack overflow | | | | 0/2 (both overflow) |
| bindings | 100 | accepted | 1.8 s | 441 MiB | 846,866 | 2/2 rejected at the boundary |
| modules | 100 | accepted | 2.2 s | 549 MiB | 1,241,263 | 2/2 rejected at the boundary |
| bindings | 500 | accepted | 9.3 s | 1,684 MiB | 12,152,666 | 2/2 rejected at the boundary |
| modules | 500 | accepted | 15.0 s | 2,087 MiB | 19,718,663 | 2/2 rejected at the boundary |
| bindings | 1,000 | accepted | 28.7 s | 2,667 MiB | 44,959,916 | 2/2 rejected at the boundary |
| modules | 1,000 | accepted | 55.0 s | 2,953 MiB | 74,090,413 | 2/2 rejected at the boundary |

The classic named matrix accepts 33 of 36 cases; the three failures are the
1,000-replacement valid, missing and wrong-shape cases, each a
`RangeError: Maximum call stack size exceeded`. The token matrix accepts 18 of
18. The 1,000-token-module case takes 55.0 s of the 60-second budget.

### Native 7.0.2

| Form | Operations | Valid graph | Total time | Peak RSS | Instantiations | Negative cases |
| --- | --- | --- | --- | --- | --- | --- |
| bulk | 100 | accepted | 0.1 s | 97 MiB | 146,745 | 2/2 rejected at the boundary |
| chained | 100 | accepted | 0.3 s | 123 MiB | 775,819 | 2/2 rejected at the boundary |
| grouped | 100 | accepted | 0.1 s | 97 MiB | 154,255 | 2/2 rejected at the boundary |
| replacement | 100 | accepted | 0.3 s | 133 MiB | 1,019,267 | 2/2 rejected at the boundary |
| bulk | 500 | accepted | 0.4 s | 143 MiB | 795,545 | 2/2 rejected at the boundary |
| chained | 500 | accepted | 4.2 s | 550 MiB | 13,945,819 | 2/2 rejected at the boundary |
| grouped | 500 | accepted | 0.4 s | 154 MiB | 1,049,487 | 2/2 rejected at the boundary |
| replacement | 500 | accepted | 5.6 s | 702 MiB | 21,756,867 | 2/2 rejected at the boundary |
| bulk | 1,000 | accepted | 1.1 s | 207 MiB | 2,506,545 | 2/2 rejected at the boundary |
| chained | 1,000 | accepted | 17.0 s | 1,684 MiB | 53,808,319 | 2/2 rejected at the boundary |
| grouped | 1,000 | accepted | 1.2 s | 240 MiB | 3,538,687 | 2/2 rejected at the boundary |
| replacement | 1,000 | accepted | 23.9 s | 2,606 MiB | 85,928,867 | 2/2 rejected at the boundary |
| bindings | 100 | accepted | 0.4 s | 153 MiB | 828,102 | 2/2 rejected at the boundary |
| modules | 100 | accepted | 0.6 s | 171 MiB | 1,230,634 | 2/2 rejected at the boundary |
| bindings | 500 | accepted | 4.2 s | 667 MiB | 12,105,502 | 2/2 rejected at the boundary |
| modules | 500 | accepted | 7.0 s | 973 MiB | 19,708,834 | 2/2 rejected at the boundary |
| bindings | 1,000 | accepted | 15.9 s | 1,704 MiB | 44,877,252 | 2/2 rejected at the boundary |
| modules | 1,000 | accepted | 27.4 s | 2,488 MiB | 74,081,584 | 2/2 rejected at the boundary |

The native matrices accept 36 of 36 and 18 of 18.

### Ceilings

Recorded 2026-09-18 at d018d50 on the same shared host (1-minute load average
4.0–8.7 during the classic search, 1.6–6.0 during the native search) with
`npm run benchmark:compiler-ceiling` (`--from 500 --to 1500` classic,
`--from 1000 --to 2500` native, resolution 25, three repeats per count; a count
passes only when every repeat is accepted).

| Form | Classic largest accepted | Classic smallest failed | Failure | Attribution | Native largest accepted | Native smallest failed | Failure |
| --- | --- | --- | --- | --- | --- | --- | --- |
| control (library-free chain) | 1,015 | 1,031 | stack overflow | V8 stack budget | 2,500 (upper bound) | none | |
| chained | 1,000 | 1,015 | stack overflow | V8 stack budget | 1,375 | 1,398 | memory budget |
| replacement | 952 | 968 | 60 s budget | | 1,069 | 1,093 | memory budget |
| named modules (point) | 1,000 | | | | 1,000 | | |

The classic control and chained overflows sit in the checker's descent
(`checkPropertyAccessExpression`), except chained at 1,015, which overflowed in
`instantiateType`; at 1,500 calls every form overflows earlier, in the binder. The replacement search ends on time, not
stack: at 968 calls two runs passed in 58.6 s and 56.9 s and the third exceeded
60 s, so 968 counts as failed and is listed as flaky. At 1,000 replacements the
classic compiler overflows in `instantiateInstantiableTypes` under contextual
typing of the innermost bulk map; a separate run of that case with
`--stack-size=4000` was accepted (55.9 s, 3,215 MiB, 85.9 M instantiations). On
native, 1,398 chained calls passed twice and then exceeded the memory budget, so
it is flaky and counts as failed. No native probe overflowed or timed out.

Moving the graph admissions of `register` onto `this` (the one type change that
could lower the innermost constant) was not attempted: it was gated on a gap of
at least 200 calls between the control and a DI Bag form with a stack-bound
failure, and the measured gaps are 15 (chained) and 63 (replacement, whose
failure is the time budget).

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

The default command runs 36 cases, each in a fresh Node process: 100, 500, and 1,000
providers in bulk, individually chained, grouped, and replacement-heavy forms,
each with a valid graph, a missing final dependency, and an incompatible
intermediate dependency. Groups are reusable registration objects containing
50 providers; they are not nominal modules. The `--tokens` mode covers token
modules.

Every generated graph uses public `DiBag` calls and assignments of resolved
services to `number`, with no casts or `any` to erase checking. Factories form
a linear dependency graph. The replacement case first adds that graph in bulk,
then replaces each provider individually; its negative cases introduce the
missing dependency or incompatible value through replacement itself.

The strict in-memory compiler helper resolves real relative source imports and
reports diagnostic codes, file names, line/column positions, and messages.
Negative cases count as accepted only when they contain the intended graph
diagnostic and no TS2589. The unit-test gates require zero diagnostics for 100
chained additions, 100 replacements, and 1,000 grouped providers, and check both
negative graph cases for each form. Existing exact method/Promise inference and
emitted-declaration tests remain in place.

The default JSON-lines report retains the original 36 named cases. The explicit
`--tokens` mode adds 18 token cases: 100, 500, and 1,000 bindings or distinct
modules, each valid, missing its final token, or using an invariantly mismatched
service. Both reports include compiler and process wall times, peak RSS in MiB
where the worker completes, complete diagnostics, diagnostic counts/codes, and
the first diagnostic.
Each worker has a 60-second resource limit. Timeouts and compiler crashes are
reported as failed measurements, never as passing type checks. The command
finishes with an explicit acceptance/failure summary; its exit status indicates
report completion, not that every measured form passed. The contract tests do not
gate wall-clock latency. Separate incremental-work tests bound deterministic
compiler instantiation counts.

`benchmark:compiler-ceiling` bisects the largest accepted single-expression call
count per form — `chained`, `replacement`, `control` (a library-free chain that
imports the library so the checker is as warm as in every other case), and
`named-modules` — between `--from` and `--to` (defaults 500 and 1,500) to a
`--resolution` of 25 calls, running each count `--repeats` times (default 3).
Every failure is classified (`stack-overflow`, `heap`, `timeout`, `memory`,
`output`, `diagnostics`, `crash`); a classic stack overflow is rerun once with
`--stack-size` (default 4,000 KiB) and recorded as `v8-stack-budget` when that
passes. `--form <f>` selects forms; `--from N --to N --repeats 1` is a point
measurement. Each classic probe runs in a fresh Node process under the matrix
limits. The `--native` variants of both commands supervise the native
executable directly, under the Linux limits described in the [development guide](../guides/development.md#compiler-checks-and-scale).
Benchmark commands write their JSON-lines evidence under
`docs/benchmarks/results/`, named by date and commit; the directory is not
committed, and this page is the record.
