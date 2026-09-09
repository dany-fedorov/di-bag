# TypeScript compiler scale

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

The `--native` variants retain these same cases but supervise the native
executable directly; their separate measurements and Linux limits appear below.

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

## Historical incremental-check results (TypeScript 5.9.3)

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

## Historical 5.9.3 remaining work

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

## Native 7.0.2 original named matrix (2026-09-07)

The original generators and boundaries were retained: no fluent-expression
rewrite, lower count, widened consumer, or fixture diagnostic-gap exception.
This run uses native TypeScript 7.0.2 on Linux, Node v24.20.0 as the report
runner, and the unchanged production source at controller checkpoint `cc9dbdcdc70edb9872177b77cddf9767aa0b67ab`.
Source SHA-256: `7a9c58960cd7349341e9eaeb348f40a072230df03f5aa0ed67fb328c78b38448`.
Each raw row also records its generated-source hash and exact compiler identity.

The actual native executable is supervised directly, sequentially, with a
60,000 ms timeout, 3,072 MiB sampled child-RSS threshold, 4 MiB combined output
cap, and 20 ms RSS sampling. Wall time includes process supervision; RSS is the
observed native child peak, not the Node launcher, a whole process tree, or the
native compiler's separately reported memory metric. No other compiler checks
were run concurrently. These are single observations, not statistical speed or
editor-latency guarantees. Native extended metrics remain labeled separately
and do not replace classic instantiation regression counters.

The named report accepted 28 of 36 cases. The 100/500 replacement wrong-shape
cases were rejected by the compiler, but failed the intended useful-message
requirement. All three 1,000-call chained cases timed out; all three 1,000-call
replacement cases exceeded the RSS threshold. These are failed measurements,
not evidence of intended type rejection. Raw stdout, stderr, diagnostics,
exit/signal/termination evidence and summary are retained in
`.superpowers/sdd/2026-09-07-modern-compilers/task-2-native-named-matrix.jsonl`.

| Providers | Form | Case | Wall ms | Sampled peak MiB | Diagnostics / outcome |
| ---: | --- | --- | ---: | ---: | --- |
| 100 | bulk | valid | 108 | 66.6 | 0 |
| 100 | bulk | missing | 118 | 68.5 | 1: TS2684 |
| 100 | bulk | wrong-shape | 120 | 68.5 | 1: TS2345 |
| 100 | chained | valid | 407 | 104.8 | 0 |
| 100 | chained | missing | 394 | 109.1 | 1: TS2684 |
| 100 | chained | wrong-shape | 398 | 106.3 | 1: TS2345 |
| 100 | grouped | valid | 114 | 68.5 | 0 |
| 100 | grouped | missing | 126 | 69.4 | 1: TS2684 |
| 100 | grouped | wrong-shape | 135 | 67.1 | 1: TS2345 |
| 100 | replacement | valid | 897 | 155.4 | 0 |
| 100 | replacement | missing | 933 | 146.8 | 1: TS2684 |
| 100 | replacement | wrong-shape | 973 | 146.2 | FAIL: intended message missing (TS2769) |
| 500 | bulk | valid | 377 | 112.4 | 0 |
| 500 | bulk | missing | 370 | 109.0 | 1: TS2684 |
| 500 | bulk | wrong-shape | 370 | 115.0 | 1: TS2345 |
| 500 | chained | valid | 29776 | 693.5 | 0 |
| 500 | chained | missing | 29813 | 676.7 | 1: TS2684 |
| 500 | chained | wrong-shape | 29771 | 641.7 | 1: TS2345 |
| 500 | grouped | valid | 413 | 115.5 | 0 |
| 500 | grouped | missing | 439 | 113.7 | 1: TS2684 |
| 500 | grouped | wrong-shape | 414 | 114.1 | 1: TS2345 |
| 500 | replacement | valid | 21129 | 1582.3 | 0 |
| 500 | replacement | missing | 20978 | 1475.4 | 1: TS2684 |
| 500 | replacement | wrong-shape | 22089 | 1691.2 | FAIL: intended message missing (TS2769) |
| 1000 | bulk | valid | 1003 | 165.9 | 0 |
| 1000 | bulk | missing | 1002 | 164.2 | 1: TS2684 |
| 1000 | bulk | wrong-shape | 1023 | 172.0 | 1: TS2345 |
| 1000 | chained | valid | 60036 | 559.7 | FAIL: timeout |
| 1000 | chained | missing | 60038 | 525.1 | FAIL: timeout |
| 1000 | chained | wrong-shape | 60037 | 549.4 | FAIL: timeout |
| 1000 | grouped | valid | 1300 | 218.9 | 0 |
| 1000 | grouped | missing | 1389 | 211.7 | 1: TS2684 |
| 1000 | grouped | wrong-shape | 1278 | 204.3 | 1: TS2345 |
| 1000 | replacement | valid | 50407 | 3073.1 | FAIL: memory |
| 1000 | replacement | missing | 43728 | 3074.0 | FAIL: memory |
| 1000 | replacement | wrong-shape | 49571 | 3073.0 | FAIL: memory |

## Native 7.0.2 original token matrix (2026-09-07)

This sequential run uses the same source identity, compiler and limits as the
named run, with all 18 original cases. It accepted 10: all six 100-token cases,
all three 500-binding cases, and the 1,000-binding missing-final-token case.
All six 500/1,000-module cases timed out. The 1,000-binding valid and invariant
mismatch cases returned TS2589, so neither establishes the required graph
contract. The missing-final-token case passing does not establish general
1,000-binding support. Raw evidence is retained in
`.superpowers/sdd/2026-09-07-modern-compilers/task-2-native-token-matrix.jsonl`.

| Tokens | Form | Case | Wall ms | Sampled peak MiB | Diagnostics / outcome |
| ---: | --- | --- | ---: | ---: | --- |
| 100 | bindings | valid | 548 | 136.0 | 0 |
| 100 | bindings | missing-final-token | 520 | 136.8 | 1: TS2684 |
| 100 | bindings | mismatched-invariant-service | 547 | 137.1 | 2: TS2684, TS2345 |
| 100 | modules | valid | 2278 | 204.3 | 0 |
| 100 | modules | missing-final-token | 2290 | 201.5 | 1: TS2684 |
| 100 | modules | mismatched-invariant-service | 2243 | 204.2 | 1: TS2345 |
| 500 | bindings | valid | 8421 | 920.3 | 0 |
| 500 | bindings | missing-final-token | 8079 | 791.4 | 1: TS2684 |
| 500 | bindings | mismatched-invariant-service | 8399 | 838.0 | 2: TS2684, TS2345 |
| 500 | modules | valid | 60053 | 893.0 | FAIL: timeout |
| 500 | modules | missing-final-token | 60056 | 898.3 | FAIL: timeout |
| 500 | modules | mismatched-invariant-service | 60058 | 894.7 | FAIL: timeout |
| 1000 | bindings | valid | 33844 | 2803.0 | FAIL: TS2589 |
| 1000 | bindings | missing-final-token | 33433 | 2553.2 | 1: TS2684 |
| 1000 | bindings | mismatched-invariant-service | 33911 | 2808.8 | FAIL: TS2589, TS2345 |
| 1000 | modules | valid | 60074 | 1166.1 | FAIL: timeout |
| 1000 | modules | missing-final-token | 60072 | 1169.7 | FAIL: timeout |
| 1000 | modules | mismatched-invariant-service | 60073 | 1172.5 | FAIL: timeout |

Across both native matrices, 38 of 54 cases meet the original acceptance rule.
The 16 failures remain open compiler-scale/diagnostic-quality work. Separately,
the source and installed rejection gate records 27 explicitly known source
message gaps; those declarations never grant matrix acceptance. Classic 6.0.3
remains primary, and no full new classic large matrix was run to replace the
labeled 5.9.3 historical tables above.

## Final TypeScript 6/native 7 matrix (2026-09-08)

The final combined compiler-scalability source has production-source SHA-256
`90d656f628878dd926da736db2ce4781f9763e9d5fdc0f6834ae0128f475c198`.
All 108 original rows ran serially with unchanged source forms and limits. The
classic named/token matrices accept 30/36 and 12/18; the native named/token
matrices accept 28/36 and 13/18. This is 83/108 overall.

The 500 individual-module rows now all pass on both lanes. The 25 remaining
failures comprise six classic 1000 named stack overflows, six classic 1000 token
timeouts, two native replacement message failures, three native 1000 named
timeouts, three native 1000 named replacement memory kills, two native 1000
binding TS2589 failures, and three native 1000-module timeouts. These stay open;
collector completion does not convert them into accepted rows.

| Lane | Selected valid control | Median compiler ms | Three-run range ms | Instantiations |
| --- | --- | ---: | ---: | ---: |
| classic | 100 chained | 1,442 | 1,416-1,453 | 902,444 |
| classic | 100 bindings | 1,945 | 1,940-1,952 | 1,479,703 |
| classic | 500 modules | 29,898 | 26,733-30,778 | 41,313,485 |
| native | 100 chained | 395 | 392-427 | 882,741 |
| native | 100 bindings | 584 | 566-590 | 1,452,944 |
| native | 500 modules | 15,257 | 14,898-16,467 | 41,297,853 |

The three serial observations are cold shared-machine measurements, not editor
latency guarantees. Exact rows, diagnostics, generated hashes and summaries are
retained under `.superpowers/sdd/2026-09-08-compiler-scalability/task-4-*`.
The full interpretation and package proof are in
`docs/reports/2026-09-08-compiler-scalability.md`.

## Native replacement diagnostic closeout (2026-09-08)

The bounded replacement-signature experiment did not meet its strict adoption
gate. Its best two candidates each matched 94/95 useful primary messages; the
remaining union-name case exposed a private `NoInfer<InvalidReplacement<...>>`
alias. No production signature was adopted and the original 27 native gap
fingerprints remain.

Fresh selected-case runs at the same production-source SHA-256
`90d656f628878dd926da736db2ce4781f9763e9d5fdc0f6834ae0128f475c198`
confirmed the existing matrix classification: classic 6.0.3 accepted the 100
and 500 replacement wrong-shape rows with the required useful message at lines
152 and 752; native 7.0.2 rejected both at the correct boundaries with TS2769
but omitted that message. The strict source audit remained 68/95 useful
primaries with 27 gaps and 1/1 supplements. The matching source hash permits
reuse of the final 108 rows above; their 83/108 result and 25 unresolved rows do
not change. Full evidence is in
`docs/reports/2026-09-08-native-diagnostics.md`.

## Repeated supported controls (2026-09-08)

The repeated control runner measured exactly three supported fixture families:
named chained 100, named grouped 1,000, and token bindings 100. Each valid,
missing, and wrong-shape control ran in five warm-up children followed by 31
retained fresh children. Classic TypeScript 6.0.3 and native TypeScript 7.0.2
are separate series identified by compiler binary hash. Every negative sample
retained exactly one required message at its generated boundary and no TS2589;
every valid sample retained zero diagnostics. The runner also validated case
identity, clean and stable source provenance, generated-source hash, compiler
work, process wall time, RSS, instantiations, and all derived statistics.

These shared-machine figures are informational and are comparable only with a
run using the same compiler identity and protocol. Values below are medians of
all 31 retained samples. They do not set a performance threshold.

| Compiler | Control | Case | Compile ms | Process ms | Peak MiB | Instantiations |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| classic 6.0.3 | named chained 100 | valid | 1,454 | 1,742 | 397 | 902,444 |
| classic 6.0.3 | named chained 100 | missing | 1,460 | 1,749 | 399 | 898,603 |
| classic 6.0.3 | named chained 100 | wrong-shape | 1,472 | 1,758 | 399 | 905,700 |
| classic 6.0.3 | named grouped 1,000 | valid | 3,302 | 3,598 | 664 | 2,699,591 |
| classic 6.0.3 | named grouped 1,000 | missing | 3,266 | 3,559 | 643 | 2,664,429 |
| classic 6.0.3 | named grouped 1,000 | wrong-shape | 3,289 | 3,587 | 649 | 2,698,561 |
| classic 6.0.3 | token bindings 100 | valid | 1,975 | 2,242 | 445 | 1,479,703 |
| classic 6.0.3 | token bindings 100 | missing | 1,957 | 2,225 | 438 | 1,412,637 |
| classic 6.0.3 | token bindings 100 | wrong-shape | 1,979 | 2,245 | 444 | 1,475,246 |
| native 7.0.2 | named chained 100 | valid | 362 | 396 | 125.7 | 882,741 |
| native 7.0.2 | named chained 100 | missing | 362 | 397 | 120.6 | 878,900 |
| native 7.0.2 | named chained 100 | wrong-shape | 362 | 393 | 121.2 | 885,998 |
| native 7.0.2 | named grouped 1,000 | valid | 1,245 | 1,296 | 240.1 | 2,682,508 |
| native 7.0.2 | named grouped 1,000 | missing | 1,242 | 1,293 | 243.1 | 2,647,346 |
| native 7.0.2 | named grouped 1,000 | wrong-shape | 1,250 | 1,301 | 238.0 | 2,681,479 |
| native 7.0.2 | token bindings 100 | valid | 548 | 590 | 154.5 | 1,452,944 |
| native 7.0.2 | token bindings 100 | missing | 536 | 581 | 153.6 | 1,385,867 |
| native 7.0.2 | token bindings 100 | wrong-shape | 544 | 587 | 154.5 | 1,448,487 |

The [raw journal](results/2026-09-08-e5456f8/compiler-controls-2026-09-08T11-21-35.870Z.jsonl)
the [clone-stable diagnostic identities](results/2026-09-08-e5456f8/compiler-controls-diagnostic-identities.json),
and [evidence manifest](results/2026-09-08-e5456f8/README.md) retain all samples,
statistics, hashes, diagnostics, and command provenance. The same evidence
directory retains fresh logs for the full four-lane matrix. Its result remains
83/108 with the same 25 unresolved rows described above. In particular, these
smaller repeated controls do not establish the 500/1,000 individual-chain
limits and do not replace the non-completing exhaustive rows.

## Supported scale contract (2026-09-09)

The final type-only follow-up reduced 100/500 named replacement work by about
64-66% while preserving the complete source, package and declaration contracts.
Native replacement diagnostic parity now has zero reviewed gaps, closing the two
diagnostic-quality failures in the frozen matrix. The complete matrix has not
been relabelled because its source predates these changes.

The unchanged classic 1000-call AST is outside the supported source shape. A
zero-generic fluent control passes at 550 calls and overflows the TypeScript 6.0.3
binder at 575, before library checking. Native 1000 chained, replacement and
token forms still cross fixed time, memory or instantiation bounds. Soundness and
declaration-emission probes rejected the remaining type-only shortcuts.

The release contract supports individual operations through the continuously
tested 100-operation gates and retained 500-operation measurements. At 1,000
providers, use bulk registration, registration groups of 50, or reusable named
modules of 50. The grouped and named-module valid, missing and wrong-shape cases
pass on the pinned classic and native compilers. The original 108-row inventory
remains available to detect compiler changes and to prevent failed fluent rows
from being mistaken for accepted checks.
