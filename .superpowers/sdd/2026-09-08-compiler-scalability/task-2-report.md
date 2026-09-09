# Task 2: dependency-directed root projections

Initial source checkpoint: `94288a32c2ca9f21d60d10f6f04b84f9a8049aed`.
The retained provenance rerun used base commit
`8f9dcdede3eb551f3d8cf2a37ea9474ee174f482`.

## Decision

No projection candidate was adopted. All three permitted causal variants missed
the mandatory 25% compiler-work reduction, and two variants increased work.
The final tree has no `src/types.ts` delta.

The proposed `RelevantEntries` and `RelevantProvided` exports exist only in the
retained candidate patches. The committed fixture does not claim that interface;
it checks the observable builder result, provider graphs, and cross-boundary
admission behavior that every candidate had to preserve.

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
- Token-boundary mutation RED: changing the wider token service to the compatible
  `number` service removed exactly the two new cross-boundary token diagnostics.
  The marker oracle reported both as missing before the mismatch was restored.
- The reproducible candidate gate is
  `DI_BAG_REQUIRE_PROJECTION_REDUCTION=1 flock -x /tmp/di-bag-compiler-heavy.lock bun test tests/incremental-scale.test.ts --timeout 120000`.
  Normal runs retain the two original absolute ceilings.

## Candidate measurements

The exact patches are `candidate-1-full.patch`,
`candidate-2-named-only.patch`, and
`candidate-3-old-wrong-shortcut.patch` in this directory. Their structured raw
selected-runner rows are the adjacent `candidate-*-results.jsonl` files. Every
row includes compiler and Node identities, base commit, dirty source status,
source and generated hashes before and after execution, process results, and
work metrics. `candidate-manifest.json` records the exact commands, limits, file
mapping, expected source hash, artifact checksums, and the required
`git apply --unidiff-zero` reconstruction command for each candidate.

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
- Native audit: 115 fixtures, 652 expected diagnostics, 625 matched, 27 declared
  gaps, 0 unexpected diagnostics, 0 failures. The expanded negative fixture
  matched all 5 expected diagnostics on native TypeScript 7.0.2.
- Classic and native typecheck/build commands exited 0. `git diff --check`
  exited 0.

The retained fixtures guard named and token cross-boundary checks in both
insertion orders, unrelated history, replacement inference, exact resolved
values, the resulting `{ value: string; read: boolean }` output map, and the
ordinary `TokenGraph` of both replacement providers. They do not assert the
rejected projection helper exports. Larger selected candidate rows were not run
because the candidate failed the preceding mandatory work gate and its source
delta was reverted. Task 3 must seek a different causal boundary rather than
revive these projection forms without a new design and threshold evidence.
