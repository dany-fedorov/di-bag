# Phase 06 compile-shape evidence

Measured with Node v24.20.0 and classic TypeScript 6.0.3 on the final Phase 6
candidate at `4fed62c`. The complete gate also passed native TypeScript 7.0.2.
Every compiler command ran under the resource guard.

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
  --json /tmp/di-bag-phase-06/final.json
```

The accepted final JSON SHA-256 is
`6b5d4afcf8f573d1d7abec517ef46c1d95364c991412d803c21840027a5eebb7`.
Every row had no diagnostics and remained within the unchanged cumulative 10%
limit. The earlier accepted `s3-fallback.json` predates the reviewed
optional-`never` empty-bag correction and is retained as superseded evidence.

| Case | Count | Baseline | Phase 06 | Change |
| --- | ---: | ---: | ---: | ---: |
| bulk | 100 | 159,001 | 145,644 | -8.4% |
| chained | 100 | 787,814 | 769,111 | -2.4% |
| grouped | 100 | 166,348 | 152,937 | -8.1% |
| replacement | 100 | 1,031,260 | 1,018,103 | -1.3% |
| bindings | 100 | 847,247 | 832,894 | -1.7% |
| modules | 100 | 1,241,644 | 792,186 | -36.2% |
| bulk | 500 | 806,601 | 794,844 | -1.5% |
| chained | 500 | 13,956,214 | 13,917,511 | -0.3% |
| grouped | 500 | 1,060,372 | 1,048,129 | -1.2% |
| replacement | 500 | 21,767,660 | 21,756,903 | -0.0% |
| bindings | 500 | 12,153,047 | 12,135,894 | -0.1% |
| modules | 500 | 19,719,044 | 10,525,586 | -46.6% |

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

## Final phase gate

The final serial gate ran with Bun 1.4.0, Node 24.20.0, npm 11.19.0,
classic TypeScript 6.0.3, native TypeScript 7.0.2, `GOMAXPROCS=2`, and the
notifier disabled. `npm run check`, `docs:check`, `graph:check`,
`codemod:check`, `typecheck:native`, `build:native`, `check:native`, the final
classic `npm run build`, all three Node retention suites, `agent-eval:test`,
and the fail-fast `examples/*.ts` loop passed. The clean published-0.4 codemod
fixtures were then rerun with `npm run codemod:check` and
`node --test tools/codemod/test/fixtures.test.mjs tools/codemod/test/transforms.test.mjs`;
their transformed text matched byte-for-byte and their literal manual reports
deep-matched the checked-in JSON.
