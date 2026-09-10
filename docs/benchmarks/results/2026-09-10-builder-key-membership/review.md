# Independent review: builder key membership

Reviewed base `405e814a4310f0bc1ff215219e658730dc551d2b` through candidate `e8c7eac0811358e698e7ddb609e25a1c358607fd` in `/tmp/di-bag-replacement-spike`. The checkout remained at that candidate and clean during this review. No repository, index, or HEAD mutations were made. The compiler probe used an in-memory virtual source and source-file substitutions.

## Strengths

- The production change is confined to two TypeScript files and four builder admission sites. Runtime statements, builder type parameters, returned history types, output inference, retained constraints, and graph validation are unchanged.
- `EntryKeys` retains the original `keyof From<E>` evaluation when `string extends E['key']`. This preserves implicit numeric index membership for broad string histories, and also retains the old route for `any`. The new public reflected-parameter assertion detects the concrete regression in the discarded direct-key-only prototype.
- `IntroducesKeys` preserves the existing non-distributive never check, duplicate-key intersection, error brand, and details. `ReplacementKeyOf` preserves singleton checking before existing-key checking and the exact failure brand/details. Registration value unions in manually overlapping histories do not participate in either membership question.
- All other uses of `Introduces` and `ReplacementKey` remain available and unchanged. Generated documentation accurately mirrors the changed signatures and source locations.

## Critical findings

None.

## Important findings

None.

## Minor findings

None requiring a change. There is one compatibility nuance to describe accurately in evidence: preserving admission and error priority does not imply byte-for-byte diagnostic text equality for every possible program. In the independent probe, rejected generic calls now print `IntroducesKeys<EntryKeys<E>, ...>` where the baseline prints `Introduces<From<E>, ...>`. Some rejected numeric-looking replacement calls also change compiler ellipsis rendering from `DisposableFactory<Factory>` to `DisposableFactory<...>`. Both remain rejected by the same admission rule; this is diagnostic presentation, not a correctness regression.

## Verification

### Independent checks

- Read the complete production, test, and generated documentation diff. `git diff --check` passed.
- Confirmed existing baseline snapshot blobs exactly match the base commit's two production files. The candidate builder snapshot is exact; the candidate types snapshot differs only by the three explanatory comment lines.
- Compared the saved contract documents directly: the same 124 files, all 642 raw diagnostic records, and all 668 declaration/type records are identical between baseline and preserved-key candidate (the variant-label metadata appropriately differs).
- Ran a short compiler-API differential probe under `/tmp/di-bag-compiler-heavy.lock`, with a 55-second timeout. The probe completed successfully and released the lock before the parent's long measurements began. It used the baseline files and current exact candidate production files without editing the checkout.
- Probed 17 histories: `never`, `any`, finite string unions, broad string, broad symbol, an entry with a never key, an entry with an any key, number and bigint string templates, a prefixed string template, `string & {}`, branded string, unique symbol, branded symbol, duplicate entries with different registration values, partially overlapping key unions, and mixed broad-string/unique-symbol history.
- Across those histories, all 34 reflected `add` parameter types (ordinary string key and numeric key) matched. Both variants produced 23 expected diagnostics for the tested rejected calls; observed differences were helper-name and ellipsis presentation described above. Broad string numeric admission retains `never`.
- Generic forwarding compiled in both versions when the wrapper supplies the original guards, including `Introduces<From<E>, N>`, `IncrementalChecked<E, N>`, and retained constraint checks. Forwarding through `Parameters<typeof b.add<N>>[0]` also compiled in both. Calls adding a concrete key to unresolved narrower generic histories were rejected in both at duplicate admission. This specifically checks generic behavior beyond substituting concrete histories into aliases.

These probes support compatibility; they are not a mathematical proof for every TypeScript generic formulation or compiler release.

### Existing validation inspected

Read the supplied log endings and verification manifest:

- `/tmp/di-bag-builder-keys-source-green.log`: 123 passed, 0 failed, 502 assertions, including the tightened work ceilings.
- `/tmp/di-bag-builder-keys-package-green.log`: 96 passed, 0 failed, 1,782 assertions, including installed declaration consumption.
- Classic and native project typechecks: exit status 0 in `/tmp/di-bag-builder-keys-verification.json` and corresponding logs.
- `/tmp/di-bag-builder-keys-native-audit.log`: 124 files accepted, 639 expected diagnostics matched, zero unexpected diagnostics/failures.
- `/tmp/di-bag-builder-keys-docs-check.log`: generated API Markdown current and 109 pages prepared successfully.

I did not redundantly rerun these full suites or claim their runs as my own. The changed regression ceilings are stricter; no benchmark generator, workload limit, or test expectation was weakened.

## Readiness

**Ready to merge: Yes, for this scoped compiler-work reduction.** No correctness or compatibility issue requiring revision was found in the exact reviewed candidate. The broad-history fallback addresses the substantive membership-equivalence trap, and generic forwarding plus public extracted methods were independently exercised.

Final 500/1,000 bounded performance rows and any evidence-only additions after this candidate remain the parent agent's responsibility and are outside this review's inspected diff. This review does not assert that the original 1,000-registration compiler failures are fixed, and does not close that larger goal.
