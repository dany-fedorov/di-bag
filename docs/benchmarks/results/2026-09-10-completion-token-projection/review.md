# Completion token projection review

**Assessment: ready to merge the `token-projection.ts` variant, subject to the coordinator's remaining integration checks. No blocking semantic or declaration compatibility finding.**

Reviewed the proposed `src/types.ts` snapshots against `baseline.ts` from source commit `6e95bffd96c7ec23b7f09816d633636e587128e8`. The coordinator reports identical source at the merged baseline `e3cc8869dbc9c11a56c0cf777b2e73d0d7b8f666`. All reviewer mutations were confined to temporary review artifacts under `/tmp`; production working trees, index, branches and HEAD were not changed by this review.

## Strengths

- The preferred variant preserves the public `Complete<R>` conditional alias and its error order. It projects only the outer registration map supplied to `MissingTokens` and `InvalidGraphs`; provider payloads, builder history and returned bag maps retain their original types.
- The homomorphic projection preserves registration property modifiers and unions. The token checks consume map keys and indexed registration values, which is the relevant observational boundary. This is a reasoned compatibility argument, supported by concrete and deferred-generic probes below, rather than an assertion that an identity mapped type is universally identical to its source in TypeScript.
- No `Builder.end()`, `Builder.start()`, lifetime or retained-constraint signature was changed. Independent wrapper probes verify that legacy completion proofs still compose with those APIs.
- Keeping the public alias body directly nameable eliminates the declaration expansion observed in the earlier private-`ProjectedComplete` variant.

## Independent verification

Compiler version correction: the classic probes report underlying `ts.version` **6.0.3**; `@typescript/typescript6` is the **6.0.2** wrapper package. Saved JSON results are authoritative.

All compiler execution acquired `/tmp/di-bag-compiler-heavy.lock`. Classic checks override the source snapshot in memory; native checks use separate temporary source copies. Compiler options include `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, ES2022 and NodeNext, with `skipLibCheck` and no ambient type packages.

| Probe | Baseline | Preferred token projection |
| --- | --- | --- |
| TypeScript 6.0.3 independent semantic probes | 0 diagnostics | 0 diagnostics |
| TypeScript 7.0.2 independent semantic probes | checked, exit 0, 0 diagnostics | checked, exit 0, 0 diagnostics |
| TypeScript 6.0.3 reflected method declaration emit | 0 diagnostics, 55,030 bytes | 0 diagnostics, 55,030 bytes; byte-identical |

The semantic fixture contains:

- Exact type equality against the legacy `Complete` body for **48 registration shapes**: `any`, `never`, empty and finite graphs, missing named factories, erased and opaque providers, `any` and `never` registration values, optional/readonly fields, same-key and disjoint-key unions, empty/any unions, intersections, callable and constructable maps, broad string/symbol/number/template indices, readonly registration indices, present/missing/mismatched required tokens, absent/mismatched optional tokens, mixed named/token failures, unique-symbol values, and finite/broad/empty/any `From<E>` histories. Equality includes error brands and their `missing`/`tokens` detail types.
- **12 deferred assignment checks**, both directions between candidate and legacy completion for generic registration maps, generic keys, generic registration values, generic `From<E>`, `NoInfer<R>` and `Readonly<R>`.
- A strict equality assertion between generic functions returning candidate versus legacy `Complete<R>`.
- **8 generic `.end()` / `.start()` wrapper bodies**, including legacy and current completion proofs and generic retained `NeedConstraint` plus lifetime admission proofs.

The declaration fixture exports extracted `scope`, `fork`, `end` and `start` methods and functions returning the scope/fork methods. It directly covers the two reflected method categories identified by the coordinator's existing-fixture comparison. The preferred emitted file SHA-256 is `101f7e2bd7665f16799e6095648b6b511c92132bd8d361ddc9421b479b799a44`, identical to the baseline.

Artifacts: `/tmp/di-bag-completion-projection-review/probes.ts`, `reflection.ts`, `run.mjs`, `native.mjs`, `baseline.json`, `token-projection.json`, `baseline-native.json`, `token-projection-native.json`, `baseline-emit.json`, `token-projection-emit.json`, emitted files under `emit-baseline/` and `emit-token-projection/`, and source hashes/snapshots recorded in `provenance.json`.

## Issues

### Critical

None found.

### Important

None found in the preferred token-projection variant.

### Minor

`token-projection.ts:140`: Add a short implementation comment explaining why the otherwise redundant-looking `CompletionMap` exists: materialize/cache registration keys before repeated typed-token graph checks. This makes the performance intent reviewable and reduces the chance of a later cleanup removing it. This is not a merge blocker.

### Superseded candidate observation

The initial `completion.ts` variant moved the public body behind private `ProjectedComplete`. Its independent semantic probes and declaration emission passed, but the reflected-method declaration fixture grew from **55,030 to 139,906 bytes** as anonymous completion conditionals expanded. The preferred variant removes this observable regression and produces byte-identical emitted declarations. Do not use the original variant as the final patch.

## Limits and recommendations

These checks are stronger than concrete fixture matching alone, but are not a formal proof for every possible TypeScript type or compiler version. Both project compiler versions were tested. The intentionally adversarial fixture compares two independent recursive admission implementations; its instantiation counts are not application-scale performance evidence.

The coordinator owns the original-scale performance and integration gates. Review does not imply that every 1000-node graph now compiles: the coordinator has already reported the separate native 1000-module `resolve` ceiling. Preserve that limitation when describing the improvement.

Retain the deferred-generic and emitted-declaration compatibility coverage with the final patch, alongside the reproducer for the graph size that triggered this optimization.
