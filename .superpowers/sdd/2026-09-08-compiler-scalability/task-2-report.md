# Task 2: dependency-directed root projections

Source checkpoint: `94288a32c2ca9f21d60d10f6f04b84f9a8049aed`.

## Decision

No projection candidate was adopted. All three permitted causal variants missed
the mandatory 25% compiler-work reduction, and two variants increased work.
The final tree has no `src/types.ts` delta.

## TDD evidence

- Interface RED: the positive projection fixture reported that
  `RelevantProvided` was not exported, followed by its dependent equality
  assertion failure.
- Work RED on the unchanged source: named chained 100 was 883,806
  instantiations against a 662,854 candidate ceiling; token bindings 100 was
  1,461,065 against a 1,095,798 candidate ceiling.
- Diagnostic mutation RED: changing the third negative fixture's dependency
  from `string` to the compatible `number` made the marker oracle report that
  exact expected diagnostic as missing. Restoring `string` returned 1/1 tests
  and 5 assertions to GREEN.
- The reproducible candidate gate is
  `DI_BAG_REQUIRE_PROJECTION_REDUCTION=1 flock -x /tmp/di-bag-compiler-heavy.lock bun test tests/incremental-scale.test.ts --timeout 120000`.
  Normal runs retain the two original absolute ceilings.

## Candidate measurements

| Candidate | Named chained 100 | Change | Token bindings 100 | Change | Decision |
|---|---:|---:|---:|---:|---|
| Baseline | 883,806 | — | 1,461,065 | — | Control |
| 1: full plan projection | 952,919 | +7.8% | 1,626,200 | +11.3% | Rejected |
| 2: named projection, prior token checks | 878,145 | -0.6% | 1,534,208 | +5.0% | Rejected |
| 3: `OldWrong` no-overlap shortcut only | 873,932 | -1.1% | 1,529,797 | +4.7% | Rejected |

Required candidate ceilings were 662,854 named and 1,095,798 token
instantiations. The experiments used the original generated programs, classic
TypeScript 6.0.3, Node v24.20.0, 3,072 MiB old-space, the default stack, and the
shared compiler lock.

## Retained coverage and final verification

- Focused source/reflection slice: 18 tests, 54 assertions, 0 failures.
- Full classic type-contract suite: 107 tests, 423 assertions, 0 failures.
- Incremental work controls: 2 tests, 20 assertions, 0 failures; observed
  883,806 named and 1,461,065 token instantiations.
- Named scale: 15 tests, 45 assertions, 0 failures, including valid, missing,
  and wrong-shape 1,000-provider reusable-module cases.
- Token scale: 6 tests, 36 assertions, 0 failures.
- Native audit: 115 fixtures, 650 expected diagnostics, 623 matched, 27 declared
  gaps, 0 unexpected diagnostics, 0 failures. The new negative fixture matched
  all 3 expected diagnostics on native TypeScript 7.0.2.
- Classic and native typecheck/build commands exited 0. `git diff --check`
  exited 0.

The retained fixtures guard cross-boundary wrong shapes in both insertion
orders, an unrelated multi-consumer history, replacement inference, and exact
synchronous resolution. Larger selected candidate rows were not run because the
candidate failed the preceding mandatory work gate and its source delta was
reverted. Task 3 must seek a different causal boundary rather than revive these
projection forms without a new design and threshold evidence.
