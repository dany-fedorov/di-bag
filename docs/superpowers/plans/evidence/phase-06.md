# Phase 06 compile-shape evidence

Measured with Node v24.20.0 and TypeScript 6.0.3 on the uncommitted Tasks 1–2
candidate based on `324d4a7`. Every compiler command ran under the resource guard.

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
  --json /tmp/di-bag-phase-06/s3-fallback-final.json
```

The accepted JSON SHA-256 is
`a043ae905c978dbc8060580f1e6cd05b15d8148a532dab1e6f2cc09df7b4d2fd`.
Every row had no diagnostics and remained within the unchanged cumulative 10%
limit. The earlier accepted `s3-fallback.json` predates the reviewed
optional-`never` empty-bag correction and is retained as superseded evidence.

| Case | Count | Baseline | Phase 06 | Change |
| --- | ---: | ---: | ---: | ---: |
| bulk | 100 | 159,001 | 158,369 | -0.4% |
| chained | 100 | 787,814 | 781,836 | -0.8% |
| grouped | 100 | 166,348 | 165,662 | -0.4% |
| replacement | 100 | 1,031,260 | 1,030,828 | -0.0% |
| bindings | 100 | 847,247 | 845,574 | -0.2% |
| modules | 100 | 1,241,644 | 804,866 | -35.2% |
| bulk | 500 | 806,601 | 807,569 | +0.1% |
| chained | 500 | 13,956,214 | 13,930,236 | -0.2% |
| grouped | 500 | 1,060,372 | 1,060,854 | +0.0% |
| replacement | 500 | 21,767,660 | 21,769,628 | +0.0% |
| bindings | 500 | 12,153,047 | 12,148,574 | -0.0% |
| modules | 500 | 19,719,044 | 10,538,266 | -46.6% |

The focused final candidate passes 21 runtime tests with 49 assertions, three
compiler fixtures with 11 assertions, both TypeScript source checks, and
emitted-declaration consumption. The initial runtime RED, all rejected inference attempts,
raw final diagnostics, and resource summaries remain under
`/tmp/di-bag-resume-20260921/gates-phase00/phase06-task2-*`.
