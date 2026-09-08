# Task 1 report — strict native replacement diagnostic oracle

Source checkpoint: `8586fe64db4f818b95aece1ee88a8f18a213614a`.

## RED/GREEN evidence

The strict-oracle test was written before its implementation. Its first run
failed because `scripts/replacement-diagnostics.ts` did not exist:

```text
$ bun test tests/native-replacement-diagnostics.test.ts
error: Cannot find module '../scripts/replacement-diagnostics'
0 pass
1 fail
1 error
```

After adding the strict evaluator and fixed inventory, the initial focused test passed:

```text
$ bun test tests/native-replacement-diagnostics.test.ts
3 pass
0 fail
13 expect() calls
```

Review then identified that a marker and its invalid expression could disappear
together. The added immutable per-fixture inventory test reproduced that hole
before the evaluator consumed fixed inventory. The inventory now freezes all 95
ordered primary message fragments and the supplemental TS2684/`missing factories`
pair, rather than counts alone. Its GREEN run has 4 tests and 24
assertions. Removing both lines from `negative/replacement-wrong-shape.ts` now
reports inventory `{ primaryExpected: 1, primaryActual: 0 }` and rejects.
Changing that marker and its emitted diagnostic to generic `No overload matches
this call` also rejects even though the ordinary marker matcher reports no
missing or unexpected diagnostic. Mutating the supplemental marker and matching
diagnostic to TS2345/generic overload text rejects on the frozen code/text pair.

The mutation cases reject an absent diagnostic, wrong file, TS2589, generic
last-overload text, an unrelated extra diagnostic, unchecked process evidence,
a diagnostic in a different primary region, and supplemental diagnostics with
missing or incorrect code/text. The inventory assertion fixes all ten source
paths independently of `diagnostic-native-gap` comments.

## Strict parity evidence

The supervised native 7.0.2 CLI audit compiled the ten fixtures serially and
exited 1 for the intended diagnostic-quality RED, with every compiler process
checked successfully:

| Measure | Actual |
| --- | ---: |
| fixed fixtures | 10 |
| primary expected | 95 |
| useful primary matched | 68 |
| useful primary missing | 27 |
| supplemental expected/matched | 1 / 1 |
| unexpected overload diagnostics | 27 |

The missing inventory is distributed as follows: incremental 4,
inline-replacement-wrong-shape 1, module-hidden-private-needs 1,
module-narrowing 1, module-rename 1, provider-boundaries 1,
replacement-context 12, replacement-wrong-shape 1, required-this 1, and
union-replace 4. The strict collector does not consult the existing native-gap
fallback. Native diagnostic parity therefore remains open.

## Reflection and regression evidence

```text
$ bun test tests/native-replacement-diagnostics.test.ts tests/native-diagnostic-markers.test.ts tests/diagnostic-markers.test.ts
31 pass, 0 fail, 69 expect() calls

$ bun test tests/types.test.ts --test-name-pattern 'replacement|builder views'
11 pass, 0 fail, 31 expect() calls

$ npm run typecheck
exit 0

$ npm run check:native
120 files; 660 expected; 633 matched; 27 known native rejections;
11/11 supplements; 0 unexpected; 0 failures
```

The new classic and native reflection controls prove non-any root/module
`ReturnType`, conditional `FunctionMatch`, exact forwarding parameters, retained
numeric module output, cast-free root-history assignment rejection, erased-add
assignment rejection, and wrong module-output assignment rejection.

## Rejected combined-overload reproduction

`historical-combined-overload.patch` reconstructs the prior combined overload
against this task's source checkpoint while preserving current root constraints
and module contribution constraints. `git apply --check --unidiff-zero` succeeds. The manifest
records SHA-256 hashes for the patch, baseline/candidate source, both oracles,
the native runner, and both raw outputs.

The classic oracle exited 1 with both selected tests failing. The positive
fixture emitted five unexpected diagnostics: its `FunctionMatch` assertion,
both root/module non-any assertions, retained module history, and exact result
assertion all failed. The negative fixture matched only 1/3 markers because the
root history assignment became cast-free and the module result no longer
retained exact `number` output. Native 7.0.2 reproduced the same result under
checked compiler supervision: five positive unexpected diagnostics, then 1/3
negative matches with the root-assignment and numeric-output markers missing.

Raw evidence is retained in `historical-combined-overload-classic.log` and
`historical-combined-overload-native.jsonl`; the replay source is
`historical-combined-overload-native.ts`. Production `src/di-bag.ts` and
`src/module.ts` still have their baseline hashes and no diff.

## Files

- `scripts/replacement-diagnostics.ts`
- `scripts/check-replacement-diagnostics.ts`
- `tests/native-replacement-diagnostics.test.ts`
- `tests/types/replacement-reflection.ts`
- `tests/types/negative/replacement-reflection.ts`
- `tests/types.test.ts`
- `docs/superpowers/plans/2026-09-08-native-diagnostics.md`
- `.superpowers/sdd/2026-09-08-native-diagnostics/historical-combined-overload.patch`
- `.superpowers/sdd/2026-09-08-native-diagnostics/historical-combined-overload-manifest.json`
- `.superpowers/sdd/2026-09-08-native-diagnostics/historical-combined-overload-native.ts`
- `.superpowers/sdd/2026-09-08-native-diagnostics/historical-combined-overload-classic.log`
- `.superpowers/sdd/2026-09-08-native-diagnostics/historical-combined-overload-native.jsonl`

## Concern

The strict CLI is intentionally red on the current production signatures. Task
2 must keep it as the independent parity gate while assessing the bounded
replacement signature candidates; a process failure or the existing gap
fallback cannot satisfy it.
