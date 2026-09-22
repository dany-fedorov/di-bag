# Phase 06 compile-shape evidence

Measured with Node v24.20.0 and TypeScript 6.0.3 on the final Task 7 candidate
based on `f352736`. Every compiler command ran under the resource guard.

## S3 container derivation

**Decision: positional fallback.** The designed replacement options bag failed
contextual inference in three bounded signature attempts. The printed signature
inferred `replacementProviders` as `never`; deferring the complete admission with
`NoInfer`, then exposing transparent direct inference positions, each overflowed
the TypeScript mapped-type instantiator. The patches and raw logs are retained as
`phase06-task2-candidate{1,2,3}-source.diff` and
`phase06-task2-types-focused{1,2,3}.log` under the resume scratch tree.

The fallback keeps no-argument, explicit `undefined`, empty-bag, and share-only
forms. Only replacement pairs are positional. A same-tree control confirmed that
the retained positional `fork` and `createScope` signatures likewise require
dependency parameter annotations; the fallback fixture therefore annotates only
the three positive dependency parameters and the missing-dependency negative.
Richer replacement outputs and every admission remain asserted. Raw proof is
`phase06-task2-fallback-legacy-control.log`; the rejected explicit-context probe
is `phase06-task2-fallback-explicit-context-probe.log`.

Command:

```sh
node scripts/evidence-cases.mjs --compare docs/superpowers/plans/evidence/baseline.md \
  --json /tmp/di-bag-phase-06/migrated-generators.json
```

The accepted final JSON SHA-256 is
`248b161db054622a800924da1f834b5a40c4989c15df3b6966d27a12a61ce90a`.
Every row had no diagnostics and remained within the unchanged cumulative 10%
limit. The earlier accepted `s3-fallback.json` predates the reviewed
optional-`never` empty-bag correction and is retained as superseded evidence.

| Case | Count | Baseline | Phase 06 | Change |
| --- | ---: | ---: | ---: | ---: |
| bulk | 100 | 159,001 | 159,887 | +0.6% |
| chained | 100 | 787,814 | 783,354 | -0.6% |
| grouped | 100 | 166,348 | 167,180 | +0.5% |
| replacement | 100 | 1,031,260 | 1,032,346 | +0.1% |
| bindings | 100 | 847,247 | 847,092 | -0.0% |
| modules | 100 | 1,241,644 | 806,384 | -35.1% |
| bulk | 500 | 806,601 | 809,087 | +0.3% |
| chained | 500 | 13,956,214 | 13,931,754 | -0.2% |
| grouped | 500 | 1,060,372 | 1,062,372 | +0.2% |
| replacement | 500 | 21,767,660 | 21,771,146 | +0.0% |
| bindings | 500 | 12,153,047 | 12,150,092 | -0.0% |
| modules | 500 | 19,719,044 | 10,539,784 | -46.6% |

The focused final candidate passes 21 runtime tests with 49 assertions, three
compiler fixtures with 11 assertions, both TypeScript source checks, and
emitted-declaration consumption. The initial runtime RED, all rejected inference attempts,
raw final diagnostics, and resource summaries remain under
`/tmp/di-bag-resume-20260921/gates-phase00/phase06-task2-*`.

## Task 7 service-snapshot declaration

Native TypeScript 7 reports only the final failed overload from emitted
declarations. The final `serviceSnapshot` declaration therefore retains the two
ordinary inference overloads verbatim and appends a non-distributive,
kind-aware diagnostic overload. Exact named, single-token, and collection-token
calls keep their original returns; the existing single-token and collection
negative families keep their exact messages in source and installed-package
consumers.

Raw `Parameters<typeof container.serviceSnapshot>` was already restrictive at
the Task 7 checkpoint: the generic collection overload collapsed to erased-base
admission and accepted no concrete name or token. The final declaration does not
expand that admission and does not admit erased handles through
`OmitThisParameter`, `.call`, `.apply`, or `.bind`. Raw `ReturnType` intentionally
broadens from collection-only to the truthful union of an ordinary snapshot and
a collection snapshot array.

The complete package/declaration matrix passed 188 tests and 2,218 assertions
across both emitters, cts/mts, runtime consumers, and hidden-source declaration
consumers. The twelve compiler-budget cases above have no diagnostics, no
TS2589, and remain within the cumulative 10% ceiling. Guard receipts are
`phase06-task7-package-native-token-release-final-design` and
`phase06-task7-compiler-budget-final2`.
