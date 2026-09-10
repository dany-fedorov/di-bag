# Final publication and evidence review — 2026-09-10

**Assessment: GO for publication and merge of the reviewed source and evidence.** No unresolved change-specific compatibility or evidence blocker was found. This verdict does not close the six remaining classic compiler stack failures and does not claim the historical 108-row matrix was rerun.

Review was read-only on `/tmp/di-bag-replacement-spike`, following the requesting-code-review skill and reviewer template. No compiler subprocesses or production edits were performed during this final publication review. Earlier paired compatibility reviews and the coordinator's completed integration runs were verified from their preserved evidence.

## Exact scope and identity

- Baseline: `fb5fe6c736fc0c21b32b93dfc9e170c955209bb9`.
- Committed measured source: `59d10c6c8ac13d63171f9f39c170da048d7e208c`.
- Candidate `src/di-bag.ts` SHA-256: `cc2f7d4e835925acc36e84b1c54df62468d8076f2472fbac4e71df5239425085`.
- Candidate `src/module-types.ts` SHA-256: `8c1c4de6d8a49e56b6a14683e195a948398f751130ce6d89a87eebeb3fa89ed5`.
- Candidate `src/types.ts` SHA-256: `99018c35fa2432b13efdf689de4afe45163cf56602a7b42b147840f803af59e9`.

All 35 production file hashes match the committed source and recorded manifest. These three files are the only production differences from the baseline. The eight recorded compiler inputs, including generators, acceptance logic, supervisors and dependency manifests, match the baseline and candidate commits. The final working-tree audit found only documentation publication changes; measured production and test source remained at the reviewed commit.

The reviewed evidence snapshot at `/tmp/di-bag-final-projection-evidence` contains **241 files, 240 verified checksums and 4,305,615 bytes excluding its outer manifest**. Its outer `artifact-manifest.json` SHA-256 is `ca2384059f026f092eb6a6ca997d87a5ed34ed814b27ce51ed0a390b06dfbcc6`. This identifies the snapshot before adding this publication review and the final documentation logs. Such additive publication files require a regenerated outer manifest; the existing 240 payload hashes must remain unchanged.

## Strengths and compatibility evidence

The implementation preserves public construction and replacement contracts while changing private compiler allocation and comparison structure. It retains replacement overload order, explicit receiver, `NoInfer`, admission checks, projected constraint semantics, and the grouping of union-valued registrations. Runtime behavior and the original benchmark oracle are unchanged.

The three successive review scopes are accurately represented in the publication README:

- Context/constraints: 352 concrete `CheckedConstraints` comparisons, deferred generic and reciprocal assignment probes, replacement inference/reflection, selected negative fixtures, declaration emission and fresh strict consumers on classic 6.0.3 and native 7.0.2.
- Distributed replacement keys: 600 public `ReplacementOutput` comparisons, optional/readonly/numeric/symbol/broad-map and union cases, retained generic rejections, contextual inference, emitted declarations and consumers.
- Exact combined entry/replacement source: generic `Entries` construction, `From`, builder and installed-module wrappers; 19 entry comparisons, 35 targeted replacement comparisons and eight direct output assertions; 57 expected negative markers; 48 emitted declarations per compiler/version pairing and fresh consumers.

The staged reports, summaries and identities match the original review artifacts. The exact combined review's 35 candidate source hashes match the measured commit. Baseline-rejected generic probes remain explicitly rejected on both sides; they are not reported as proofs of generic equality. Observed declaration union-arm ordering differences are recorded with passing exact-type and consumer checks. The combined review did not rerun the two earlier large unchanged matrices.

## Measurement reconciliation

The final collection has exactly the planned **40 unique rows: 16 paired baseline/candidate 500-operation valid rows and 24 candidate original 1,000-operation valid/error rows**. It contains 34 accepted cases and six failures. All 12 native original 1,000-operation cases are accepted. All 12 binding/module original 1,000-operation cases across both compilers are accepted; these groups overlap.

The six remaining failures are classic 1,000-operation `chained` and `replacement`, each in `valid`, `missing` and `wrong-shape` scenarios. Raw stderr records `RangeError: Maximum call stack size exceeded`. Their invalid scenarios remain failures because compiler crashes do not satisfy the expected-boundary diagnostic oracle.

I independently regenerated all 40 case strings and original marked boundaries without compilation, checked their SHA-256 values against the recorded inputs, and replayed the original acceptance functions over recorded diagnostics. All 40 acceptance results match. Raw stdout JSON, exit statuses, source identities, commands, compiler versions and summary rows reconcile. All 36 README metric rows reconcile with independently recomputed measurements. No historical 108-row rerun is implied.

The final native valid named chain used 54,713,937 instantiations, 17.259 seconds and 1,735.30 MiB observed peak RSS. The final native valid replacement case used 85,878,388 instantiations, 23.935 seconds and 2,584.32 MiB. The paired 500-operation replacement instantiation reductions are approximately 22.20% classic and 22.21% native. Time and RSS are single-host observations, as the README states.

Original limits remain in place: fresh processes, default stacks, 60-second deadlines and 4 MiB captured-output bounds; classic uses `--max-old-space-size=3072`, while native enforces a separate 3,072 MiB sampled RSS limit. The initially ambiguous common-RSS wording was corrected in the current README, collector description and manifest, with a disclosed description-only correction. The historical archive is preserved and its earlier wording is explicitly qualified.

## Integration, documentation and archive checks

All 18 integration records have status zero and their staged logs match the original logs. The recorded full check has 943 passing tests, zero failures and 18,899 assertions. Both emitted Node suites have 31 passing tests. The strict native audit records 639/639 expected diagnostics across 124 files, zero unexpected diagnostics and zero failures. These are verified completed runs, not reruns by this reviewer.

The final publication documentation logs separately confirm 11 passing documentation tests, current generated API references, 109 prepared Markdown pages, and a successful build verifying 110 rendered pages and 13,436 internal links, anchors and assets. The performance report's latest follow-up accurately retains the six classic failures and identifies earlier measurements as historical.

- Final `docs-check.log` SHA-256: `93b881decaac72665f64cee4c5cb7e1853b60ab93e5355104b91c73b44032eac`.
- Final `docs-build.log` SHA-256: `fc81db8447e19cdbee6399acdd7576cb9dcc8adfb5b96f4c6d3e303bb3bf1f8f`.

All six archives contain safe, relative regular-file members, without duplicate paths, traversal, symlinks, hard links, `.git` or `node_modules`. All 2,654 archived files match their original scratch evidence; normalized archive metadata and the historical archive's internal manifest were checked. Profile source snapshots match all 35 files at their stated intermediate/final revisions. The published profile totals and percentage match the retained summaries; this review did not independently decode raw pprof samples. The README appropriately treats the performance explanation as an inference and distinguishes profiles from clean acceptance runs.

Every outer-manifest payload checksum and byte count passed, the file set is complete, measurement copies match their originals, and all local README links resolve. The finalizer's assertions and generated tables agree with the independently checked inputs and outcomes.

## Issues, recommendation and assessment

No unresolved critical, important or minor issue was found in this reviewed publication scope. The heap-versus-RSS wording issue identified during review is resolved. The six classic stack failures remain an explicit outstanding performance limitation, with no claim that they are unavoidable upstream limits.

Proceed with publication and the normal hosted CI/merge verification for this exact source. Add this report and final documentation logs without rewriting measured evidence, regenerate and verify the outer checksum manifest, and retain the explicit remaining failures. A later production change would require renewed review; an additive documentation artifact does not invalidate the verified source and measurements.

Reproducible supporting checks are retained outside the checkout in `/tmp/di-bag-final-projection-publication-final-check.py`, `/tmp/di-bag-final-projection-publication-audit.py`, `/tmp/di-bag-final-projection-archive-provenance.py` and `/tmp/di-bag-final-projection-replay.mjs`. Their outputs are `/tmp/di-bag-final-projection-publication-final.json`, `...-support.json`, `...-archives.json` and `...-replay.json`. The `-support.json` file is the earlier preflight; its then-absent final-manifest flags are superseded by the completed `-final.json` reconciliation.
