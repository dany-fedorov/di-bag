# TypeScript compiler scale

DI Bag checks dependency graphs in the type system, so very long fluent
expressions cost compiler time, memory, and instantiation depth. This page
records the measured limits for the pinned compilers and explains how to run
the benchmarks that produced them.

## Recorded results

The latest collection reruns the 24 original 1,000-operation cases for named
registration, replacement, token binding, and token modules, alongside 16 paired
500-operation measurements. It accepts 34 of 40 rows. The six failures are all
classic-compiler stack overflows on 1,000-operation named registration and
replacement expressions.

| 1,000-operation form | Classic TypeScript 6.0.3 | Native TypeScript 7.0.2 |
| --- | --- | --- |
| One fluent expression of named registrations | Stack overflow | Accepted |
| One fluent expression of replacements | Stack overflow | Accepted |
| Typed-token bindings | Accepted | Accepted |
| Token modules | Accepted | Accepted |

Each entry covers a valid graph and both intended error cases. Accepted error
cases mean the compiler rejected the invalid graph at the expected boundary;
crashes and excessive-instantiation errors never count as successful rejection.
Results are tied to the recorded source and toolchain. Passing these synthetic
cases does not guarantee a particular editor latency, memory use, or arbitrary
graph size.

## Supported scale

The release contract supports individual operations through the continuously
tested 100-operation gates and retained 500-operation measurements. At 1,000
providers, use bulk registration, registration groups of 50, or reusable named
modules of 50. The grouped and named-module valid, missing, and wrong-shape cases
pass on the pinned classic and native compilers.

A single classic 1,000-call fluent expression remains outside the supported
bounds. A library-free fluent control with no generics passes at 550 calls and
overflows the TypeScript 6.0.3 binder at 575, so part of that limit is the
compiler's own recursion budget rather than DI Bag's types. Native 7.0.2 accepts
all four 1,000-operation forms within its fixed time and memory limits, and its
replacement diagnostics match the classic compiler with zero reviewed gaps.

## Run the benchmarks

Run from the repository root with Node 24 or later:

```sh
npm run benchmark:types
npm run benchmark:types -- --tokens
npm run benchmark:types -- --native
npm run benchmark:types -- --native --tokens
npm run benchmark:compiler-controls
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

The `--native` variants retain these same cases but supervise the native
executable directly, with the Linux limits described in the
[development guide](../guides/development.md#compiler-checks-and-scale).
Benchmark commands write their JSON-lines evidence under
`docs/benchmarks/results/`, named by date and commit.
