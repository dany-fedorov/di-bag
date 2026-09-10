# Final completion token projection review

**Ready to merge: yes, after the coordinator's final source/integration gates pass. No outstanding review findings.**

Reviewed the actual three-file working-tree diff in `/tmp/di-bag-replacement-spike`, branch `fix/completion-token-projection`, against HEAD/base `e3cc8869dbc9c11a56c0cf777b2e73d0d7b8f666`. Review was read-only on the production checkout. No additional compiler runs were needed for this final pass.

## Production change

`src/types.ts:140` adds the commented homomorphic `CompletionMap` and uses it only as the input to typed-token `MissingTokens` and `InvalidGraphs` checks inside `Complete<R>`. Named completion checks, error ordering, error details, public alias nameability and builder method signatures remain intact.

A direct file comparison confirmed that removing only the two explanatory comment lines makes the actual source **byte-identical to the previously reviewed `token-projection.ts` snapshot**. The base file is also byte-identical to the independently tested baseline snapshot. Actual production `src/types.ts` SHA-256: `e41819567885a7853d8ce63bac81521cc5279f6858f7e6874021ba75d4818ce6`.

The comment resolves the prior minor recommendation by explaining the cached key projection and the repeated work it avoids.

## Regression tests

- `tests/incremental-scale.test.ts:8` tightens the existing 100-token-binding ceiling from 1,300,000 to **1,220,000 instantiations**. The test still verifies the real compiler process exits successfully, the expected fixture/form/compiler identity, zero diagnostics, and a positive integer instantiation count. The coordinator's recorded baseline value, 1,289,021, fails the new guard; the measured preferred variant, 1,198,298, passes with room for small unrelated changes. This protects the actual performance improvement rather than a particular implementation spelling.
- `tests/native-compiler.test.ts:63` adds the **original 1000 dependent token-binding graph** through the existing `nativeScale` helper. Inspection confirms the fixture declares distinct typed tokens, chains each provider's dependency on its predecessor, calls `.end()`, and resolves the final token as `number`. It therefore exercises the reported completion failure and the resulting usable bag.
- The new native test supplies no compiler-limit override. `nativeScale` calls `compileNative` with its original **60-second, 3072-MiB, 4-MiB-output** limits. Its assertions require `checked: true`, `accepted: true`, status 0, no diagnostics, the exact 7.0.2 native compiler, and positive observed RSS. The helper rejects signal/timeout/memory/output/monitor failures and unparsed output before marking a result checked. A terminated or partially checked compiler cannot satisfy this test.
- The 65-second Bun test timeout follows the surrounding native controls and accommodates the inner 60-second compiler limit. The coordinator recorded the actual baseline failure as TS2589 at `.end()` and reports the preferred original-1000 graph passes both compiler implementations. Final gate completion remains the coordinator's responsibility.

## Compatibility evidence carried forward

The independent probes passed with **underlying classic TypeScript 6.0.3** and native **TypeScript 7.0.2**:

- 48 exact concrete comparisons against the legacy `Complete` body, including `any`, `never`, optional/readonly/union maps, broad and template indices, unique-symbol/token contracts, broad and finite `From<E>` histories, and exact error details.
- 12 deferred generic assignment checks, generic-function equality, and 8 `.end()`/`.start()` wrappers carrying legacy/current completion proofs plus generic retained-constraint and lifetime proofs.
- Reflected scope/fork/end/start methods and scope/fork wrapper return types emit **byte-identical declarations**, 55,030 bytes, between baseline and preferred source.

Version correction: `@typescript/typescript6` is the **6.0.2 wrapper package**, but the imported compiler's `ts.version`, captured in the saved probe JSON, is **6.0.3**. The initial review report has been corrected. The semantic evidence itself is unchanged.

Detailed probes and raw results are in `/tmp/di-bag-completion-projection-review/`; the corrected first-pass report is `/tmp/di-bag-completion-projection-review.md`.

## Findings and assessment

No critical, important or minor issues remain in the actual production/test diff. The tests cover both an instantiation regression at a tractable size and successful compilation of the original failing graph within unchanged limits. The source precisely matches the preferred implementation already subjected to independent semantic and declaration checks.

This change does not establish that every 1000-node module graph compiles. Preserve the separately reported native module-resolution ceiling as a remaining limitation when presenting the result.
