# Task 4: repeated compiler controls

Implemented `benchmark:compiler-controls` for the exact supported named
chained 100, named grouped 1,000, and token bindings 100 valid/negative
controls. Classic and native run as separate compiler-identity series. Each row
uses five warm-ups and 31 retained fresh child processes, serially. Every sample
validates exact case identity, required marker multiplicity at the generated
boundary, TS2589 absence, clean/stable source and fixture provenance, positive
work metrics, and the existing compiler-case acceptance result before it enters
a summary.

TDD evidence:

- RED: missing runner import, 0 pass / 1 fail.
- Initial GREEN: 7 tests / 19 assertions for markers, identity, invalid metrics,
  provenance drift, deterministic raw statistics, serial 5+31 collection, and
  the exact nine-case catalog.
- Review-fix GREEN: 11 tests / 29 assertions, adding strict diagnostic and
  compiler-identity normalization, native/classic metric extraction, positive
  instantiation work, canonical diagnostic paths, fixed lane order, and raw
  failed/spawn evidence journaling before rejection.
- Focused combined gate: 32 tests / 137 assertions, zero failures.

Retained evidence at implementation commit
`e5456f8e435cddb03b1dc61b3c777bb9916d35da` contains 668 JSONL records: one
header, 648 child samples, 18 summaries, and one completion record. The samples
comprise 90 warm-ups and 558 retained observations. Independent validation
recomputed min/p05/median/mean/population-standard-deviation/p95/max and checked
every sample's marker, diagnostics, compiler work, provenance, and compiler
identity. All 18 rows passed. The raw journal SHA-256 is
`3f13f311f553b870f86651eb7817e983d7b9400858bec8e65c203bba76452979`.
The unchanged completed journal preserves compiler-emitted absolute path text;
a separately validated clone-stable identity manifest maps all 504 sample
diagnostics to their declared generated fixtures. New runner output emits the
stable relative path directly, and failures retain the raw child row or spawn
error before the command exits.

The prescribed exhaustive matrices ran once, serially, with unchanged fixtures
and limits. They remain classic named 30/36, classic token 12/18, native named
28/36, and native token 13/18: 83/108 total. All 25 failures are retained in the
checked-in lane logs; the repeated controls do not replace or soften them.

Final review-fix gate: `npm run check` passed with 866 tests, 5,149 assertions, zero
failures, and a successful build. The original untracked execution handoff was
not modified. No network, push, or publish action occurred.

Independent review found three Important issues: invalid child evidence could
escape before journaling, diagnostic file paths were not clone-stable, and zero
instantiations were accepted. It also found missing normalization/lane mutation
coverage. All findings were addressed without rerunning completed controls.
