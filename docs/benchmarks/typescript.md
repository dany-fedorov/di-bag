# TypeScript compiler scale

Run from the repository root with Node 24 or later:

```sh
npm run benchmark:types
```

The command runs 36 cases, each in a fresh Node process: 100, 500, and 1,000
providers in bulk, individually chained, grouped, and replacement-heavy forms,
each with a valid graph, a missing final dependency, and an incompatible
intermediate dependency. Groups are reusable registration objects containing
50 providers. They are not nominal modules; actual module-scale evidence belongs
to the later module implementation.

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

The JSON-lines report includes compiler and process wall times, peak RSS in MiB
where the worker completes, diagnostic counts/codes, and the first diagnostic.
Each worker has a 60-second resource limit. Timeouts and compiler crashes are
reported as failed measurements, never as passing type checks. The command
finishes with an explicit acceptance/failure summary; its exit status indicates
report completion, not that every measured form passed. Unit tests have no
performance threshold.

## Environment and baseline

Recorded on 2026-09-06, Linux, TypeScript 5.9.3, Node v24.20.0, Bun 1.4.0.
The pre-change source was commit `9820e21`. All table measurements use separate
Node workers. These are single observations on a shared development machine,
not statistical performance comparisons; other development checks overlapped
some samples. Compiler caches are not reused between measurements.

| Baseline, 100 providers | Compiler ms | Process ms | Peak MiB | Diagnostics |
| --- | ---: | ---: | ---: | --- |
| Bulk | 403 | 657 | 264 | 0 |
| Chained additions | 3,703 | 3,982 | 622 | 161, including TS2589 |
| Groups of 50 | 409 | 657 | 269 | 0 |
| Individual replacements | 6,996 | 7,299 | 868 | 169, including TS2589 |

Baseline missing and wrong-shape cases worked for bulk and grouped forms.
Both chained and replacement negative forms also hit TS2589, so their
rejections did not establish that the graph checks worked at that scale.
The pre-change 1,000-provider grouped unit gate passed. Larger baseline chains
were not collected as a complete matrix; the table does not imply otherwise.

## Flat accumulation results

Builders now retain a flat union of `{ key, registration }` entries. Graph
checks reconstruct map views, while the public `Bag<R>` generic remains a map.
The public API and runtime behavior are unchanged.

The completed report accepted 24 of 36 cases (including intended negative
rejections). All 12 cases involving 500/1,000 individual additions or
replacements failed to complete graph checking. A dash means the worker did not
return a compiler time or peak-memory report.

| Providers | Form | Case | Compiler ms | Process ms | Peak MiB | Diagnostics / outcome |
| ---: | --- | --- | ---: | ---: | ---: | --- |
| 100 | bulk | valid | 440 | 698 | 264 | 0 |
| 100 | bulk | missing | 465 | 736 | 271 | 1: TS2684 |
| 100 | bulk | wrong-shape | 453 | 711 | 276 | 1: TS2345 |
| 100 | chained | valid | 2016 | 2317 | 618 | 0 |
| 100 | chained | missing | 2049 | 2342 | 634 | 1: TS2684 |
| 100 | chained | wrong-shape | 2993 | 3305 | 632 | 50: TS2345 |
| 100 | grouped | valid | 453 | 719 | 277 | 0 |
| 100 | grouped | missing | 492 | 749 | 293 | 1: TS2684 |
| 100 | grouped | wrong-shape | 431 | 681 | 281 | 1: TS2345 |
| 100 | replacement | valid | 5597 | 5921 | 807 | 0 |
| 100 | replacement | missing | 5596 | 5917 | 810 | 1: TS2684 |
| 100 | replacement | wrong-shape | 5833 | 6189 | 806 | 2: TS2345, TS2322 |
| 500 | bulk | valid | 820 | 1115 | 384 | 0 |
| 500 | bulk | missing | 906 | 1184 | 361 | 1: TS2684 |
| 500 | bulk | wrong-shape | 999 | 1272 | 377 | 1: TS2345 |
| 500 | chained | valid | — | 60290 | — | Timeout (60 seconds) |
| 500 | chained | missing | — | 60242 | — | Timeout (60 seconds) |
| 500 | chained | wrong-shape | — | 60182 | — | Timeout (60 seconds) |
| 500 | grouped | valid | 2756 | 3047 | 642 | 0 |
| 500 | grouped | missing | 2745 | 3047 | 642 | 1: TS2684 |
| 500 | grouped | wrong-shape | 2714 | 3007 | 639 | 5: TS2345 |
| 500 | replacement | valid | — | 60187 | — | Timeout (60 seconds) |
| 500 | replacement | missing | — | 60140 | — | Timeout (60 seconds) |
| 500 | replacement | wrong-shape | — | 60232 | — | Timeout (60 seconds) |
| 1000 | bulk | valid | 1314 | 1577 | 393 | 0 |
| 1000 | bulk | missing | 1335 | 1605 | 391 | 1: TS2684 |
| 1000 | bulk | wrong-shape | 1823 | 2092 | 416 | 1: TS2345 |
| 1000 | chained | valid | — | 518 | — | Compiler stack overflow |
| 1000 | chained | missing | — | 528 | — | Compiler stack overflow |
| 1000 | chained | wrong-shape | — | 536 | — | Compiler stack overflow |
| 1000 | grouped | valid | 15865 | 16182 | 957 | 0 |
| 1000 | grouped | missing | 15847 | 16175 | 955 | 1: TS2684 |
| 1000 | grouped | wrong-shape | 16081 | 16402 | 952 | 10: TS2345 |
| 1000 | replacement | valid | — | 520 | — | Compiler stack overflow |
| 1000 | replacement | missing | — | 514 | — | Compiler stack overflow |
| 1000 | replacement | wrong-shape | — | 519 | — | Compiler stack overflow |

For 1,000 grouped providers, the missing dependency produced TS2684 at
`tests/generated-type-scale.ts:1002:13`, containing “missing factories.”
The wrong intermediate shape produced TS2345 first at
`tests/generated-type-scale.ts:1012:6`, containing “a dependency has the wrong
shape.” Multiple wrong-shape diagnostics reflect subsequent additions
rechecking the invalid graph. Replacement's wrong-shape case also gets TS2322
from its checked consumer assignment.

All 500-call individual-chain workers were terminated after the 60-second
resource limit (SIGTERM, ETIMEDOUT). An earlier exploratory valid 500-add worker
also exceeded 180 seconds. All 1,000-call individual-chain workers exited with
`RangeError: Maximum call stack size exceeded` in TypeScript's binder
(`setParent` / `bind`), before diagnostics could be collected. Increasing the
Node stack or changing the generated expression would be a different measured
configuration; neither is silently substituted here.

## Remaining work

The 100-operation depth failure is fixed, but this is not a general claim of
1,000-call-chain support. Large individual chains remain open compiler-scale
work. Grouped acceptance also does not establish acceptable editor latency:
the new 1,000-provider grouped Bun checks took roughly 28 seconds in the first
focused run, compared with roughly 5 seconds before the change. These timings
were not controlled comparisons, but the observed cost warrants follow-up.

A targeted virtual-source experiment checked reconstructed updated entry maps
directly, retaining independent input validation for numeric/symbol/non-finite
keys. It preserved all existing positive and negative fixtures but introduced
TS2589 at the required 1,000-provider grouped gate (33.57 seconds in a fresh
Node worker). That experiment was rejected. Further graph-check optimization
must preserve all current inference and rejection contracts.

One follow-up hypothesis is to retain a cached map view alongside the entry
union. Because additions reject duplicate keys, that view could accumulate with
`R & N`, avoiding `Omit` on additions. The two representations would have to stay
correlated through replacement, with no public generic escape hatch. This has
not been implemented or measured here.
