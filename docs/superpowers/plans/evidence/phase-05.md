# Phase 05 compile-shape evidence

Measured with Node v24.20.0 and TypeScript 6.0.3. The initial bag rows use Task 5 source `5375ba93fcd588c7d84672e07982fd917d7c21fb` plus the uncommitted initial Task 6 generators; their raw commands, JSON rows and guard logs are retained, while their generated TypeScript source text was not separately saved. The final fallback and refreshed S7 rows use both the modified public facade/runtime and the updated positional generators committed with this evidence. Every row ran in a fresh, sequential Node process under the 8 GiB guard. Raw outputs are under `/tmp/di-bag-resume-20260921/phase05-task6-*`; guard records are under `/tmp/di-bag-resume-20260921/gates-phase00/phase05-task6-*`.

## S7 module list

These are the final rows after the adopted `withTokenService(token, provider)` fallback. Every valid row had no diagnostics.

| Count | Shape | Instantiations | Diagnostics |
| --- | --- | ---: | --- |
| 1 | separate-0.4 | 184,066 | none |
| 1 | separate-0.5 | 183,295 | none |
| 1 | one-list | 183,295 | none |
| 10 | separate-0.4 | 231,516 | none |
| 10 | separate-0.5 | 219,571 | none |
| 10 | one-list | 217,711 | none |
| 50 | separate-0.4 | 578,256 | none |
| 50 | separate-0.5 | 447,711 | none |
| 50 | one-list | 439,531 | none |
| 100 | separate-0.4 | 1,324,431 | none |
| 100 | separate-0.5 | 888,136 | none |
| 100 | one-list | 876,556 | none |

At 10 modules the list is 0.85% below separate 0.5 calls; at 50 it is 1.83% below. The 100-module list is 29.40% below the 1,241,644 phase-0 baseline. The same-tree `modules valid 100` sanity row is exactly 1,324,431, equal to `separate-0.4`. The collision case has exactly one TS2322 at its marked `boundaryLine` 44 and names `register introduces new names or typed tokens only`; its final worker row retains the full message. The original worker row truncated that message at 160 characters, so `phase05-task6-s7-collision-raw-r2` independently preserved the identical full diagnostic after an initial scratch-import-only failure.

**S7: adopted.** All valid cases compile, the collision is exact, Task 5's first three module-list negatives report on their list elements, the fold reduces cost at 10 and 50, and the cumulative 100-module result is 876,556 versus the 1,365,808 limit.

## S1 initial bag measurement

| Case | Count | Old on entry | Bag on entry | Bag change |
| --- | ---: | ---: | ---: | ---: |
| bulk | 100 | 241,410 | 241,412 | +0.0008% |
| chained | 100 | 864,679 | 864,879 | +0.0231% |
| grouped | 100 | 248,701 | 248,705 | +0.0016% |
| replacement | 100 | 1,113,669 | 1,071,799 | -3.7596% |
| bindings | 100 | 929,331 | 1,206,389 | +29.8126% |
| modules | 100 | 1,324,215 | 1,324,215 | 0.0000% |
| bulk | 500 | 890,610 | 890,612 | +0.0002% |
| chained | 500 | 14,012,279 | 14,013,279 | +0.0071% |
| grouped | 500 | 1,143,877 | 1,143,897 | +0.0017% |
| replacement | 500 | 21,851,669 | 20,842,599 | -4.6178% |
| bindings | 500 | 12,235,131 | 19,720,389 | +61.1784% |
| modules | 500 | 19,803,615 | 19,803,615 | 0.0000% |

All twelve rows were accepted with no diagnostics. Against the phase-0 baseline, replacement is +3.93% at 100 and -4.25% at 500. The initial token-service bag is +42.39% at 100 and +62.27% at 500, so it requires the measured fallback.

| Method | Old shape at 100 | Bag shape at 100 | Change |
| --- | ---: | ---: | ---: |
| withServiceAlias | 2,030,589 | 1,999,091 | -1.5512% |
| withCollectionContribution | 1,252,861 | 882,358 | -29.5726% |

Both chain comparisons use `resolveCollection` for collection reads and have no diagnostics.

## Positional token-service fallback

| Count | Phase-0 baseline | Initial bag | Positional fallback | Fallback vs baseline |
| --- | ---: | ---: | ---: | ---: |
| 100 | 847,247 | 1,206,389 | 928,847 | +9.6312% |
| 500 | 12,153,047 | 19,720,389 | 12,231,847 | +0.6484% |

Both fallback rows have no diagnostics and stay within the 10% cumulative limit.

## Positional replacement fallback

The object-bag replacement form preserved its diagnostics but lost the inferred
replacement output once contribution consumers were present. Two bounded type
shapes retained that regression, so the measured fallback keeps the existing
two-argument call shape under the new method name.

| Count | Phase-0 baseline | Initial bag | Positional fallback | Fallback vs baseline |
| --- | ---: | ---: | ---: | ---: |
| 100 | 1,031,260 | 1,071,799 | 1,114,200 | +8.0426% |
| 500 | 21,767,660 | 20,842,599 | 21,853,000 | +0.3920% |

Both valid fallback rows have no diagnostics and stay within the 10% cumulative
limit. The 100-call wrong-shape row reports exactly one TS2769 at generated line
152, includes `provided service does not satisfy its consumer dependency`, and
does not report TS2589. The initial bag rows remain the historical Task 6
measurement; the positional rows use the Task 8 fallback source and generator.
The accepted rows ran with the pinned Node v24.20.0 and TypeScript 6.0.3. Three
earlier Bun-launched rows reported the runtime compatibility version v26.3.0 and
are excluded; the first pinned retry was also excluded after the known sandbox
`spawnSync git` restriction. Their raw outputs remain preserved.

The same prerequisite puts the deprecated positional `buildModule` overload
before the current options-bag overload so reflected declarations and rejected
current bags select the current signature. Four terminal lifetime fixtures were
projected to the current bag without changing their markers or graph constraints.
Focused source checks, native7 CTS/MTS consumers, and the combined classic6/native7
physical matrix preserve both valid forms and all diagnostic controls.

Task 5's post-facade raw compiler proof reported `builder-renames.ts` at lines 14, 19, 25, 32, 37, 43, 49, 56, 62, 70, 75 and 77, and `installed-modules.ts` at 19, 26, 33, 40, 46 and 50. The current-tree proof `phase05-task6-fallback-raw-diagnostics` confirms that after the positional fallback, the first three diagnostics remain on argument lines 14, 19 and 25 with the same named output, duplicate and token-kind messages; every retained bag and module-element location remains unchanged.

- **S1 withServices: adopted.** Old-to-new changes are at most +0.0231% across bulk, chained and grouped.
- **S1 withTokenService: fallback.** The bag exceeded baseline by +42.39%/+62.27%; the positional form is +9.63%/+0.65%.
- **S1 withServiceAlias: adopted.** The 100-call bag is 1.55% below the positional form.
- **S1 withCollectionContribution: adopted.** The 100-call bag is 29.57% below the positional form.
- **S1 withReplacedService: fallback.** Two bounded bag-signature repairs retained the unannotated output-inference regression; the positional form is +8.04%/+0.39% against baseline and retains the zero-dependency fast path.

At the Task 6 boundary, generated documentation remained under the temporary phase exception: the fully generated tree had 124 pages and 301 snippets, with only the unchanged 417-line API card exceeding its 400-line budget. The generated fallback diff and seven new facade pages are retained at `/tmp/di-bag-resume-20260921/phase05-task6-fallback-generated-docs*` before restoration. After restoration, `phase05-task6-fallback-docs-check-restored` records the expected 27/29 state: the budget and first stale generated-facade link fail; the guard launched above 8 GiB and was not resource-stopped. Tasks 12–13 close both exceptions, as the final evidence below records.

## Final contracted surface

The first cumulative run at `85ff86e` accepted all twelve programs but failed the unchanged budget: bulk100 was 213,689 versus 159,001 (+34.39%) and grouped100 was 220,982 versus 166,348 (+32.84%). Generator inspection found no workload widening. Checker attribution localized the fixed expansion to repeated variance discovery across the recursively typed `Builder` surface. Declaring both `Builder` parameters `in out` expresses the invariance already enforced by its retained function witness; emitted JavaScript is byte-identical, while the package declaration adds only those variance modifiers.

The final accepted file is `/tmp/di-bag-phase-05/final-evidence-invariance-final.json` (SHA256 `3910c17f361bf62e7d72a10d8b6879311f403411b6f569e1ec9a3350f806084f`). It was measured with Node v24.20.0 and TypeScript 6.0.3 in fresh sequential processes under the 8 GiB guard; all rows are accepted and have no diagnostics.

| Case | Count | Baseline | Phase 5 | Cumulative change |
| --- | ---: | ---: | ---: | ---: |
| bulk | 100 | 159,001 | 147,709 | -7.1% |
| chained | 100 | 787,814 | 771,176 | -2.1% |
| grouped | 100 | 166,348 | 155,002 | -6.8% |
| replacement | 100 | 1,031,260 | 1,020,168 | -1.1% |
| bindings | 100 | 847,247 | 834,914 | -1.5% |
| modules | 100 | 1,241,644 | 794,206 | -36.0% |
| bulk | 500 | 806,601 | 796,909 | -1.2% |
| chained | 500 | 13,956,214 | 13,919,576 | -0.3% |
| grouped | 500 | 1,060,372 | 1,050,194 | -1.0% |
| replacement | 500 | 21,767,660 | 21,758,968 | -0.0399% |
| bindings | 500 | 12,153,047 | 12,137,914 | -0.1% |
| modules | 500 | 19,719,044 | 10,527,606 | -46.6% |

The final documentation gate passes 29/29 tests, 114 snippets and 141 prepared pages; the API card is 365/400 lines. The first full phase check exposed diagnostic-display truncation at source, classic package and native package boundaries plus one stale independent replacement-diagnostic inventory row. Full text is scoped to negative-fixture batches so the grouped 1,000-provider scale control stays below the compiler recursion limit; token markers remain exact and the two reviewed native gaps remain exactly two. The final full check passes 607 fast tests with 16,157 assertions and 586 compiler tests with 4,102 assertions; its build exits 0. Docs, graph, codemod, native compiler, retention, agent-evaluation and example gates are also green.

The entry and final call-site censuses use the same group order as Task 0: top-level tests, other test directories, positive types, negative types, Node tests, examples, agent evaluation, other scripts, graph tooling, agent docs and deferred guides. Complete group tables are retained at `/tmp/di-bag-resume-20260921/phase05-task0-call-site-counts.txt`, `/tmp/di-bag-resume-20260921/phase05-task14-final-old-counts.txt` and `/tmp/di-bag-resume-20260921/phase05-task14-final-new-counts.txt`.

| Old-name census | register | alias | contribute | replace | installModule | verifyGraph | buildModule | build |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Entry | 1,542 | 114 | 163 | 198 | 364 | 16 | 334 | 1,068 |
| Final | 87 | 6 | 9 | 84 | 28 | 2 | 364 | 66 |

| Final new-name census | withServices | withTokenService | withServiceAlias | withCollectionContribution | withReplacedService | withInstalledModules | verifyGraphAtCompileTime | buildContainer |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Total | 1,279 | 246 | 119 | 174 | 132 | 365 | 34 | 1,043 |

Final old-name totals are confined to reviewed codemod, graph and migration fixtures, pinned S1/S7 comparison branches, the benchmark adapter, the Phase 4 helper literal and deferred guides; executable retired calls outside those exact owners are zero.
