# Task 3: compiler work on the original generators

Status: implementation and required verification complete; ready for controller-scoped review. No publication or merge performed. Implementation commit: `ec9b0312c20336beb020533aef93a735990889a2`.

The retained change reduces deterministic type instantiations on unchanged named chains, token bindings and token modules. At 500 operations the reductions are approximately 9.2%, 4.3% and 3.0% on both compilers. Replacements remain effectively unchanged, with the small increases reported below. The complete original matrix accepts 85/108 rows; 23 original 1,000-operation cases remain outside the fixed bounds. This task does not claim to close those limits.

## Implementation and contracts

Only `src/types.ts` changes in production. `OldTokenWrong` previously re-evaluated each retained entry's token needs against every arriving registration map. When an incoming map has no symbol keys, a typed token cannot match it. The new private `OpaqueTokenNeeds` helper caches the remaining opaque-contract check per retained entry, independently of that map. Disjoint key sets avoid an unnecessary exclusion; overlapping keys still exclude replacements. Entries whose key is `never` are explicitly excluded, matching the original exclusion semantics.

The helper retains `WrongToken<needs, {}>` instead of blindly returning `never`: manually annotated opaque histories must still fail at `.add`, even when the new registration uses an unrelated name. Required/optional token needs, distribution across entries and opaque graph unions, exact invalid symbol keys, replacement removal and diagnostic precedence remain checked. Public `Builder<E,C>` annotations and inference are unchanged. There are no casts, proof flags, trusted branches, executable builder changes or modified generators/acceptance rules.

The tests characterize exact helper results, manual and mixed opaque histories, never-key entries, and provider extraction branch order for callable intersections, unions, readonly/optional metadata and graph carriers. The installed-package fixture router now recognizes the existing internal `types` module so the same assertions run against physical declarations. The rejected ProviderParts implementation is absent from final source.

Named-100 and token-100 deterministic work ceilings are now 850,000 and 1,450,000, respectively. These rounded bounds reject BASE and pass the corrected final source. The replacement ceiling remains 1,500,000. The earlier aspirational 820,000 value was an experiment target, not a requirement. The pre-existing optional historical 25% environment switch was not modified or adopted as a gate.

## Provenance and measurement protocol

BASE is `451a62bfffaf524852ca2b016dcb8eddff0de493`. Its fresh selected-before collection is copied verbatim into `before/`: 24 original valid cases (four forms × three sizes × two compilers), 16 accepted at 100/500 and eight retained 1,000 failures. Preparation evidence predating BASE is labeled historical and is not substituted for this baseline.

Before aggregate source SHA-256: `a87501a8658d9abe818bdb5961b4d6cdf961b063c8b347d6cbc61186e640552e`.

Final aggregate source SHA-256: `a84596a679eef3c4415b09d3bebcbb2f5a2302b2bc390d278d2432bd99f907a7`.

All final gates, original rows and repeats ran with this frozen final production source, before committing it; the row provenance honestly records BASE plus dirty `src/types.ts`. `final-provenance.json` retains per-file source, final emitted build, compiler package and unchanged original generator/harness hashes. Baseline provenance does not contain a dedicated pre-edit emitted-build snapshot. `builds/` reconstructs both before and final source with each pinned emitter after measurements; it is explicitly not relabeled as a pre-edit observation. All four builds succeed and every emitted runtime `.js` file is byte-identical before/after within each emitter. Emitted declaration hashes are retained per build in `builds/commands.jsonl`.

Node is 24.20.0; classic TypeScript API is 6.0.3 through the installed 6.0.2 wrapper, native TypeScript is 7.0.2. Original workers retain default stack, 60 seconds, 3072 MiB and 4 MiB output limits. Original generators in `tests/compiler.ts` and worker admission in `scripts/compiler-case.ts` are unchanged. All heavy operations were serial under `/tmp/di-bag-compiler-heavy.lock`; no controller/compiler/test load ran concurrently. Sandbox-only Bun subprocess capture returned empty stdout with status zero; the same focused commands were rerun with scoped host execution, as for the controller baseline. No harness behavior was changed for that environment issue.

Each collection directory retains exact argv, cwd, statuses, raw stdout/stderr, source snapshots, generated hashes, compiler identities, work, timing and RSS when available. `summarize.py` independently reconciles all 108 expected identities, raw row equality, accepted-to-exit-status correspondence, absence of outer timeouts/stderr, stable source/HEAD/status, cross-lane generated hashes and matching before/after generated hashes. A failed worker remains failed even when its collector exits zero. Six final repeated rows have identical work and generated/source hashes to their matrix counterparts. These are deterministic work observations, not a many-sample latency study or an editor responsiveness claim.

## Before/after original valid rows

| Lane | Count/form | Before | After | Reduction | Compile ms before → after | RSS MiB before → after |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| classic | 100 chained | 905,984 | 845,023 | 6.729% | 1,535 → 1,406 | 408.0 → 403.0 |
| native | 100 chained | 889,213 | 828,272 | 6.853% | 369 → 342 | 133.3 → 120.6 |
| classic | 100 replacement | 1,403,919 | 1,404,241 | -0.023% | 1,672 → 1,592 | 415.0 → 417.0 |
| native | 100 replacement | 1,387,833 | 1,388,175 | -0.025% | 426 → 424 | 149.2 → 143.2 |
| classic | 100 bindings | 1,483,243 | 1,436,931 | 3.122% | 2,113 → 1,888 | 447.0 → 456.0 |
| native | 100 bindings | 1,459,466 | 1,413,170 | 3.172% | 574 → 555 | 163.6 → 159.2 |
| classic | 100 modules | 2,106,425 | 2,060,013 | 2.203% | 2,672 → 2,478 | 584.0 → 588.0 |
| native | 100 modules | 2,090,642 | 2,044,246 | 2.219% | 818 → 809 | 184.9 → 201.9 |
| classic | 500 chained | 17,513,384 | 15,908,223 | 9.165% | 13,782 → 11,345 | 1881.0 → 1836.0 |
| native | 500 chained | 17,497,013 | 15,891,872 | 9.174% | 29,998 → 21,003 | 737.0 → 676.6 |
| classic | 500 replacement | 31,198,119 | 31,199,241 | -0.004% | 18,324 → 18,138 | 2107.0 → 2131.0 |
| native | 500 replacement | 31,184,033 | 31,185,175 | -0.004% | 8,722 → 8,704 | 1125.4 → 1154.9 |
| classic | 500 bindings | 28,500,443 | 27,268,531 | 4.322% | 17,388 → 16,663 | 2175.0 → 2123.0 |
| native | 500 bindings | 28,448,266 | 27,216,370 | 4.330% | 8,576 → 8,150 | 909.6 → 858.4 |
| classic | 500 modules | 41,317,025 | 40,084,613 | 2.983% | 33,858 → 28,340 | 2231.0 → 2179.0 |
| native | 500 modules | 41,302,442 | 40,070,046 | 2.984% | 17,591 → 14,752 | 1069.4 → 1021.2 |

The six repeated final cases are classic/native 100 chained, 100 bindings and 500 chained (`final-repeats/`). All retained final repeated counters match exactly. Positive reductions above are the principal evidence; process/compiler time and RSS are shared-machine observations and can vary. No source from the provisional never-key variant is mixed into final-source statistics.

## Complete original matrix and remaining failures

The final inventory is 108 original cases: both compilers, counts 100/500/1000, named bulk/chained/grouped/replacement with valid/missing/wrong-shape, and tokens bindings/modules with valid/missing-final-token/mismatched-invariant-service. All 72 cases at 100/500 are accepted. At 1,000, all 12 bulk/grouped named cases are accepted, along with native bindings missing-final-token. The other 23 cases fail:

| Lane | 1,000-operation forms/scenarios | Rows | Observed failure |
| --- | --- | ---: | --- |
| Classic | chained and replacement, all scenarios | 6 | `RangeError`, checker `instantiateType` stack |
| Classic | bindings and modules, all scenarios | 6 | 60-second timeout |
| Native | chained, all scenarios | 3 | timeout |
| Native | replacement, all scenarios | 3 | 3072 MiB RSS cap |
| Native | bindings valid | 1 | TS2589 |
| Native | bindings mismatched invariant service | 1 | TS2589 plus TS2345; intended diagnostic alone is insufficient |
| Native | modules valid and mismatched invariant service | 2 | RSS cap near the time limit |
| Native | modules missing-final-token | 1 | timeout |

Totals are classic named 30/36, classic tokens 12/18, native named 30/36, native tokens 13/18: **85 accepted, 23 failed**. `summary.json` enumerates every failed identity; `final-matrix/rows.jsonl` preserves the actual diagnostics, stderr, resource observations and termination reasons. The eight selected baseline 1,000 valid cases remain unaccepted. The historical 83/108 inventory used different source and is not a directly paired before matrix.

## Controls and attribution

There are 24 fresh library-free API controls in script context and 24 matching external-module controls with `export {};`. Each retains the original generated chained/replacement expression, replacing only the import with a local nongeneric API or a minimal generic Entry/From history. Classic controls use the same `compilerProgram` API, target/options and virtual compiler path as the original worker; native controls use the same native API/options. They are explanatory fixtures, never substitutes for original acceptance rows.

Both contexts have the same outcome pattern. All classic 100/500 controls pass. All classic 1,000 controls overflow in binding/flow (`isNarrowableReference`, `bindWorker`); this demonstrates a separate library-free source-shape limit. The original DI 1,000 errors occur in checker `instantiateType`. The differing stacks do not establish that binding alone caused the original checker failure, nor that a helper optimization cannot affect the checker limit. No parser failure was observed in these fresh API controls. Historical CLI controls are retained separately and cannot alone attribute an API worker failure.

Native nongeneric controls pass at all sizes. Native generic chained controls pass at 100/500 and time out at 1,000; generic replacement passes at 1,000 (11,558,675 instantiations, about six process seconds). Thus plain native syntax depth does not explain its original failures; growing generic history itself can reach a bound without DI graph checks. Original native replacement memory exhaustion is not reproduced by that minimal generic replacement, so library checking still contributes substantially. The control is explanatory and does not isolate every token/module cost or prove one universal cause.

The original audit spot checks use unchanged workers, a 30-second outer bound and `--max-old-space-size=1024` (`controls/audit-spotchecks.jsonl`). Classic 1,000 chained valid exits 1 in 1.36 seconds with checker `instantiateType` RangeError. Original grouped valid exits 0 in 3.62 process seconds, 3,336 compiler ms, 587 MiB RSS and 2,582,342 instantiations. Grouping is a supported control, not a repair of the original fluent case.

## Hypotheses, rejected variants and RED/GREEN

`experiment-notes.md` gives the per-hypothesis table. Every measured variant retains its source and command/row evidence, including regressions. Empty-needs aggregation increased named work. Removing symbol-free new lookup maps improved named work but worsened token work versus the retained scan candidate. Skipping empty named Pick comparisons worsened token work beyond BASE. ProviderParts sharing, measured alone against BASE after exact provider characterization, increased both workloads and was reverted. Aggregated token-key overlap increased work and risked collapsing opaque union error keys.

A historical 14–19% named shortcut was recovered read-only, hashed and retained. It returns `never` whenever the new map has no symbol keys. Applying that exact rule to current BASE changes the manual opaque-history admission boundary: an exact assertion fails and two required `.add` diagnostics disappear (`historical-shortcut-contract-red.log`). A later `.end` error does not preserve that boundary. The final cached helper keeps the check and therefore has smaller gains. The exact earlier combined token implementation behind reported 25–31% savings was not recovered; those percentages are not projected onto the current implementation or claimed to be fully explained. The currently tested new-map alternative regressed, without ruling out all other sound improvements.

| Evidence | Exact result |
| --- | --- |
| `work-red.log` | Environmental sandbox failure, not a valid work RED |
| `work-red-unsandboxed.log` | BASE named 905,984 exceeds initial 820,000 experiment target |
| `parts-red.log` | Work RED plus an initially incorrect opaque `.end` expectation; fixed to existing missing-first precedence |
| `characterization-baseline.log`, `parts-characterization-baseline.log` | New boundary and extraction characterizations pass on BASE |
| `final-ceilings-red.log` | BASE named 905,984 > 850,000 and tokens 1,483,243 > 1,450,000; replacement passes |
| `source-green.log`, `intermediate-gates/` | Provisional candidate passed; explicitly intermediate |
| `never-key-red.log` | Self-review's exact never-key assertion fails on provisional shortcut |
| `final-source-green.log` | Corrected final source: 118 pass, 0 fail, 477 assertions, 82.62 seconds |

The never-key RED is material: original exclusion removes `{ key: never; registration: Opaque }` for every incoming map. Filtering that entry in the cached helper restores the result while retaining measurable reductions. The covering final gates and matrix were all rerun on the corrected source.

## Required final gates

All commands below ran serially on the frozen corrected source and exited zero; exact stdout/stderr and elapsed times are in `gates/commands.jsonl` and sibling logs. Source RED/GREEN commands are in `direct-test-commands.jsonl`.

| Command | Result |
| --- | --- |
| `bun test tests/types.test.ts tests/incremental-scale.test.ts` | 118 pass, 0 fail, 477 assertions |
| `npm run typecheck` | Pass |
| `npm run typecheck:native` | Pass |
| `npm run build` | Pass |
| `npm run build:native` | Pass |
| `npm run check:native` | 124 files; 673/673 expected/matched; 662/662 primary, 11/11 supplemental; zero gaps, unexpected diagnostics or failures |
| `bun test tests/package.test.ts tests/box-package.test.ts tests/token-package.test.ts tests/native-package.test.ts tests/lifetime-declarations.test.ts` | 218 pass, 0 fail, 2,179 assertions; installed archives, both physical emitters, physically deleted producer declarations, downstream compiler lanes and runtime smoke |
| `bun test tests/type-scale.test.ts tests/token-scale.test.ts tests/incremental-scale.test.ts` | 24 pass, 0 fail, 111 assertions |
| `python3 …/capture-builds.py` | Four builds pass; before/after runtime JavaScript byte-identical within both emitters |
| `python3 …/summarize.py` | All identity/provenance/row reconciliation assertions pass |

Gate logs, fixture source and emitted-build command journals are hashed in `artifact-manifest.json`. No executable library code changed, so the controller retains responsibility for the planned whole-branch runtime/docs/portable integration rather than duplicating that heavy work here.

## Self-review and handoff

Reviewed the production diff against BASE: only the private token-history scan changes; `provider.ts`, builder signatures, runtime graph storage/acquisition, supervisor, generators and worker limits are unchanged. Reviewed the shortcut's empty/overlapping/disjoint/never key cases, manual opaque histories and exact error precedence; the discovered never-key issue has a retained RED and covering final GREEN. The installed fixture routing extension targets a fixed existing internal module and does not suppress diagnostics. Work ceilings are rounded regression bounds rather than exact private-counter assertions.

Owned source, test and authored documentation diffs pass whitespace checks. Raw compiler emissions and RED logs retain their original trailing/EOF whitespace for hash fidelity; those artifact-only whitespace notices are not normalized away.

All measurements are terminal and the shared lock is released. The implementation is ready for controller-scoped review. Remaining concerns are the explicit 23 original 1,000-case failures, ordinary shared-machine timing variance, and the unrecovered exact historical combined token experiment. No stronger performance claim is made. No original checkout, runtime source, package lock, public API, CI acceptance or resource ceiling was changed.

## Integration fix round 1: independent replacement diagnostic inventory

The controller's full suite on `e0b28defbf3d3f8c62afd4a4cd20d0dda46ef842` exposed an inventory dependency omitted from the original Task 3 scoped gates. The three added manual opaque-history boundaries were matched by the compiler and general audit, but `scripts/replacement-diagnostics.ts` still independently expected the previous 19 incremental markers. The strict replacement audit correctly rejected the mismatch (22 actual versus 19 expected; 106 matched overall versus the fixed 103). This was a test-inventory omission, not a compiler regression or missing diagnostic.

After the controller's frozen integration run terminated and released the shared lock, the unchanged focused command `bun test tests/native-replacement-diagnostics.test.ts` reproduced the RED: 4 pass, 1 fail, 25 assertions. Raw output is retained in `integration-fix-round-1/red.*.log` and the exact command journal. The correction appends the three literal messages in source order: `incompatible or opaque`, `missing factories`, `incompatible or opaque`. Three fixed test totals change from 103 to 106. The independent literal inventory, all ten fixtures, supplemental count, acceptance logic and every removal/weakening oracle are preserved. No `src` file, marker, invalid expression, generator or worker setting changes.

The full focused file is now GREEN: 5 pass, 0 fail, 25 assertions (1.40 process seconds). Standalone `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-replacement-diagnostics.ts` exits zero: 106/106 primary, 1/1 supplemental, zero missing or unexpected; incremental inventory and diagnostics are both exactly 22/22. `npm run typecheck` passes in 6.47 seconds and `npm run typecheck:native` in 0.89 seconds. Every command ran serially under the shared compiler lock; all are terminal. Exact commands, raw outputs, statuses and source hashes are retained beside this report.

The controller's full strict native audit passed on unchanged production source (`../2026-09-10-integration/gates/native-audit.stdout.log`, 674/674 total matched, zero failures). Per the controller's direction, that audit and the full integration suite were not duplicated for this inventory-only correction. The controller owns the final full-suite rerun after independent scoped review. This inventory correction does not affect production source or generators. The earlier 108-row matrix retains its original Task 3 source identity; subsequent controller changes to `di-bag.ts` and `startup.ts` are outside this round and are not relabeled as that measured source.

Self-review compared the complete diff: one literal-array append and three total changes are the only executable/test edits. Search found no further executable dependencies on the old total. The existing fixed inventory continues to reject removed or weakened markers even when source and diagnostics are altered together. This round closes the omitted inventory dependency; it does not change the report's 23 remaining 1,000-operation compiler failures. Independent re-review is pending.
