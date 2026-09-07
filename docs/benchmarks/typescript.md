# TypeScript compiler scale

Run from the repository root with Node 24 or later:

```sh
npm run benchmark:types
npm run benchmark:types -- --tokens
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

The default JSON-lines report retains the original 36 named cases. The explicit
`--tokens` mode adds 18 token cases: 100, 500, and 1,000 bindings or distinct
modules, each valid, missing its final token, or using an invariantly mismatched
service. Both reports include compiler and process wall times, peak RSS in MiB
where the worker completes, complete diagnostics, diagnostic counts/codes, and
the first diagnostic.
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

## Historical flat-accumulation results (commit `3a618e4`)

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

All 500-call individual-chain workers in that historical run were terminated after the 60-second
resource limit (SIGTERM, ETIMEDOUT). An earlier exploratory valid 500-add worker
also exceeded 180 seconds. All 1,000-call individual-chain workers exited with
`RangeError: Maximum call stack size exceeded` in TypeScript's binder
(`setParent` / `bind`), before diagnostics could be collected. Increasing the
Node stack or changing the generated expression would be a different measured
configuration; neither is silently substituted here.

## Current incremental-check results

Recorded on 2026-09-07 against the production declaration boundary at
`8daad9a`, with TypeScript 5.9.3, Node v24.20.0, and Bun 1.4.0. Workers used
the original generated source layout, Node's default stack, a 3,072 MiB
old-space cap, a 60-second timeout, and no parallel matrix execution. These are
single observations, not stable editor-latency or memory guarantees. Full raw
worker JSON, including every diagnostic and failure stack, is retained in
`.superpowers/sdd/2026-09-07-incremental-checks/task-2-named-matrix.jsonl` and
`task-2-token-matrix.jsonl`.

The named report accepted 30 of 36 cases. Unlike the historical run, every
500-provider case completed, including the original fluent syntax. All six
1,000-call chained/replacement cases still failed before returning JSON with
status 1 and `RangeError: Maximum call stack size exceeded` in TypeScript's
expression checker. They are failed measurements, including the negative cases;
none is counted as a type rejection.

| Providers | Form | Case | Compiler ms | Process ms | Peak MiB | Diagnostics / outcome |
| ---: | --- | --- | ---: | ---: | ---: | --- |
| 100 | bulk | valid | 632 | 889 | 316 | 0 |
| 100 | bulk | missing | 641 | 909 | 331 | 1: TS2684 |
| 100 | bulk | wrong-shape | 654 | 915 | 329 | 1: TS2345 |
| 100 | chained | valid | 1,155 | 1,415 | 452 | 0 |
| 100 | chained | missing | 1,168 | 1,426 | 452 | 1: TS2684 |
| 100 | chained | wrong-shape | 1,170 | 1,435 | 456 | 1: TS2345 |
| 100 | grouped | valid | 638 | 897 | 335 | 0 |
| 100 | grouped | missing | 646 | 899 | 316 | 1: TS2684 |
| 100 | grouped | wrong-shape | 638 | 899 | 327 | 1: TS2345 |
| 100 | replacement | valid | 2,212 | 2,500 | 617 | 0 |
| 100 | replacement | missing | 2,237 | 2,539 | 613 | 1: TS2684 |
| 100 | replacement | wrong-shape | 2,300 | 2,579 | 617 | 1: TS2769 |
| 500 | bulk | valid | 1,189 | 1,458 | 397 | 0 |
| 500 | bulk | missing | 1,187 | 1,452 | 398 | 1: TS2684 |
| 500 | bulk | wrong-shape | 1,219 | 1,481 | 401 | 1: TS2345 |
| 500 | chained | valid | 11,494 | 11,894 | 1,819 | 0 |
| 500 | chained | missing | 11,377 | 11,764 | 1,847 | 1: TS2684 |
| 500 | chained | wrong-shape | 11,311 | 11,705 | 1,846 | 1: TS2345 |
| 500 | grouped | valid | 1,282 | 1,546 | 454 | 0 |
| 500 | grouped | missing | 1,266 | 1,535 | 452 | 1: TS2684 |
| 500 | grouped | wrong-shape | 1,264 | 1,528 | 455 | 1: TS2345 |
| 500 | replacement | valid | 39,194 | 39,631 | 2,460 | 0 |
| 500 | replacement | missing | 39,005 | 39,464 | 2,506 | 1: TS2684 |
| 500 | replacement | wrong-shape | 40,682 | 41,131 | 2,552 | 1: TS2769 |
| 1000 | bulk | valid | 2,663 | 2,939 | 492 | 0 |
| 1000 | bulk | missing | 2,630 | 2,900 | 483 | 1: TS2684 |
| 1000 | bulk | wrong-shape | 2,664 | 2,939 | 508 | 1: TS2345 |
| 1000 | chained | valid | — | 835 | — | Compiler stack overflow |
| 1000 | chained | missing | — | 851 | — | Compiler stack overflow |
| 1000 | chained | wrong-shape | — | 837 | — | Compiler stack overflow |
| 1000 | grouped | valid | 2,915 | 3,199 | 647 | 0 |
| 1000 | grouped | missing | 2,862 | 3,157 | 659 | 1: TS2684 |
| 1000 | grouped | wrong-shape | 2,878 | 3,168 | 633 | 1: TS2345 |
| 1000 | replacement | valid | — | 847 | — | Compiler stack overflow |
| 1000 | replacement | missing | — | 866 | — | Compiler stack overflow |
| 1000 | replacement | wrong-shape | — | 874 | — | Compiler stack overflow |

The token report accepted 9 of 18 cases. All 100-token and 500-binding cases
completed. The three 500-module cases and all six 1,000-token cases reached the
60-second limit; each was terminated with `SIGTERM`/`ETIMEDOUT`, empty stdout,
and no compiler result. The binding invariant cases that completed produced two
diagnostics: TS2684 at `.end()` and the required TS2345 at the marked binding;
only the latter boundary determines acceptance.

| Tokens | Form | Case | Compiler ms | Process ms | Peak MiB | Diagnostics / outcome |
| ---: | --- | --- | ---: | ---: | ---: | --- |
| 100 | bindings | valid | 1,606 | 1,879 | 516 | 0 |
| 100 | bindings | missing-final-token | 1,559 | 1,835 | 512 | 1: TS2684 |
| 100 | bindings | mismatched-invariant-service | 1,608 | 1,878 | 517 | 2: TS2684, TS2345 |
| 100 | modules | valid | 4,930 | 5,233 | 782 | 0 |
| 100 | modules | missing-final-token | 4,910 | 5,210 | 781 | 1: TS2684 |
| 100 | modules | mismatched-invariant-service | 4,990 | 5,294 | 782 | 1: TS2345 |
| 500 | bindings | valid | 16,109 | 16,498 | 1,928 | 0 |
| 500 | bindings | missing-final-token | 15,691 | 16,084 | 1,934 | 1: TS2684 |
| 500 | bindings | mismatched-invariant-service | 16,012 | 16,410 | 1,945 | 2: TS2684, TS2345 |
| 500 | modules | valid | — | 60,212 | — | Timeout (SIGTERM / ETIMEDOUT) |
| 500 | modules | missing-final-token | — | 60,225 | — | Timeout (SIGTERM / ETIMEDOUT) |
| 500 | modules | mismatched-invariant-service | — | 60,202 | — | Timeout (SIGTERM / ETIMEDOUT) |
| 1000 | bindings | valid | — | 60,279 | — | Timeout (SIGTERM / ETIMEDOUT) |
| 1000 | bindings | missing-final-token | — | 60,236 | — | Timeout (SIGTERM / ETIMEDOUT) |
| 1000 | bindings | mismatched-invariant-service | — | 60,287 | — | Timeout (SIGTERM / ETIMEDOUT) |
| 1000 | modules | valid | — | 60,239 | — | Timeout (SIGTERM / ETIMEDOUT) |
| 1000 | modules | missing-final-token | — | 60,235 | — | Timeout (SIGTERM / ETIMEDOUT) |
| 1000 | modules | mismatched-invariant-service | — | 60,222 | — | Timeout (SIGTERM / ETIMEDOUT) |

## Remaining work

The 100-operation depth failure is fixed, and the current 500-call named cases
complete, but this is not a claim of 1,000-call-chain support. The six original
1,000-call named failures remain open compiler-scale work. Token modules at 500
and both token forms at 1,000 also remain outside the 60-second evidence bound.
Passing grouped or bulk cases does not establish acceptable editor latency.

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
