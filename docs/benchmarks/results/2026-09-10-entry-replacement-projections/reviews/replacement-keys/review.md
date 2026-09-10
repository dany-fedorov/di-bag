# Supplemental compatibility review: distribute surviving replacement keys

Baseline: source archive of `3360a96516daa7483c490a1bcacaa1ed16ec7ce1`.
Candidate: `/tmp/di-bag-replacement-key-probe/distributed-keys.types.ts`; SHA-256 `989496869408ae077e50d585feb1a5bf350061ac34a2abee1ee7217dd8992686`.
Baseline `types.ts` SHA-256: `e41819567885a7853d8ce63bac81521cc5279f6858f7e6874021ba75d4818ce6`.

## Strengths

- `types.ts:220` distributes the surviving **keys**, preserving one `Required<Needs<R[P]>>` projection for each key. Union-valued registrations retain their original grouping. It leaves key exclusion, the replacement's own old-requirement removal, optionality treatment, retained module constraints, and final output inference intact.
- The helper change is private and type-only. The baseline archive and other three candidate snapshots match, and source hashes verify that only `types.ts` differs among all 35 source files.
- Paired public utility, inference, overload, diagnostic, declaration, and consumer checks found no change-specific incompatibility.

## Issues

Critical: none found.

Important: none found.

Minor: none requiring a change before adoption.

## Verification

Review scratch: `/tmp/di-bag-replacement-key-review`. No production files, HEAD, index, prior review artifacts, or benchmark inputs were modified by this reviewer. Compiler processes were serialized with `/tmp/di-bag-compiler-heavy.lock`, using pinned Bun 1.4.0, classic TypeScript runtime 6.0.3, and the authenticated native 7.0.2 compiler with unchanged supervision limits. Both engines used strict options, exact optional properties, unchecked index protection, and `skipLibCheck: false`.

- **600 concrete public `ReplacementOutput` equality assertions** against the legacy definition pass on baseline/candidate and both engines. These cover 30 registration-map shapes with 12 key shapes, plus all 30 maps with eight retained-constraint shapes. Cases include `R` unions/intersections, optional/readonly/symbol/numeric/broad maps, `never`/`any`, opaque/provider and union-valued registrations, optional dependency values, explicit `undefined`, self requirements, `K = never`/`any`/union/broad keys, and retained `C = never`/`any`/`unknown`/union needs.
- **Eight direct output assertions** pass, including retained inner value unions, incompatible separate consumers producing `never`, optional versus explicitly undefined needs, removed old self requirements, union-valued registrations, union maps sharing a consumer key, and union maps with distinct consumer keys.
- **167 open-generic equality/assignment probes** preserve the same 122 baseline rejections at identical codes and locations. The 45 accepted probes (one equality, 44 reciprocal assignments) also pass in emitted declarations. Fully deferred equality against a separately copied private conditional helper is already rejected by the baseline; these differential failures are retained and are not claimed as successful generic proofs.
- **Replacement and reverse inference:** existing context/supported/reflection fixtures plus reused extracted/specialized overload checks pass. Generic full-overload equality and reciprocal assignment continue to pass. Additional inference through public `ReplacementOutput` preserves literal `42`, object, function, promise, optional-consumer, union-valued-consumer, and retained-constraint values. Generic map/key inference stays `Registrations`/`PropertyKey`. The 18 focused inference type renderings match exactly.
- **57 negative diagnostics and 57 repository markers** match across eight replacement, module-narrowing, and rename fixtures, with no missing or unexpected diagnostics. Full diagnostic text is identical in the final semantic probe for each paired engine. The open-generic probe has two private-helper diagnostic text differences; codes and locations match.
- **201 semantic, 88 open-generic, 147 declaration-stage, and seven consumer variable/function type renderings** are identical between versions in the classic comparisons.
- **43 emitted declaration files per version/engine**, zero emit diagnostics. Only `src/types.d.ts` differs. Every emitted review fixture and existing replacement fixture is byte-identical between versions for its compiler.
- **Fresh declaration consumers pass** on both engines with `skipLibCheck: false`, including extracted replacement calls, exact outputs, public output and reverse-inference assertions, and expected rejection of wrong shapes, lost promise wrappers, reflected history erasure, and missing callback dependencies.

The previous 352-case `CheckedConstraints` review was not repeated because that implementation is unchanged. Full repository suites and scale cases were not duplicated; the coordinator owns those gates.

## Reproduction

Run `bash /tmp/di-bag-replacement-key-review/reproduce.sh`.

Evidence: `source-identity.json`, `summary.json`, `markers.json`, the source fixtures and workers, all per-compiler JSON results, and the two emitted `types.d.ts` diffs beside this report. Preliminary `focus` results preceded adding accepted open-generic and reverse-inference assertions; the final semantic/declaration/consumer results include those assertions.

## Assessment

**Go for this distributed-key helper**, conditional on the coordinator's full repository and original-limit performance gates for the exact candidate hash above.

No compatibility blocker was found. This verdict does not cover the separate `RegistrationEntry<K,V>` experiment or its combination with this helper. The reported native 1,000-replacement improvement is owned by the coordinator and was not independently rerun for this review.
