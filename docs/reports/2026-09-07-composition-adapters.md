# Class and positional function adapters

The adapter increment is implemented through `68930c0` on `feat/v0.1`.
`DiBag.fromClass` constructs the original concrete class from declared token
arguments, preserving private fields, prototypes and `new.target`.
`DiBag.fromFunction` invokes an existing positional function with an undefined
receiver. Bound methods remain supported. Both preserve acquisition modes,
exact Promise values, graph obligations and explicitly declared ownership.

Finite token tuples are checked against the actual declared parameter tuple,
including default, optional and rest parameters. Omitted inline defaults retain
their inferred types. Existing `fromTokens` callbacks remain compatible,
including callbacks that intentionally ignore selected arguments.

## Verification

- Focused runtime/token tests: 30 pass, 143 assertions, including 18 adapter
  runtime tests. Source and emitted-declaration focused tests: 5 pass,
  17 assertions. All 31 new native negative markers match without gap allowances.
- Native source audit: 98 files, 478 expected
  diagnostic regions, 451 matched and the same 27 pre-existing quality gaps;
  zero unexpected diagnostics or failed files.
- Physical package matrix after correction:
  `bun test tests/native-package.test.ts tests/package.test.ts` exits 0 with
  59 tests and 899 assertions in 117.32 seconds. Both classic/native archives
  execute actual assertions on Node/Bun in CommonJS and ESM. Both emitters'
  `.d.cts` and `.d.mts` producers retain inferred module, builder and bag contracts
  after source deletion, checked by both downstream compilers.
- Independent runtime review passed 18 tests/99 assertions and checked additional
  static default/rest/receiver/explicit-generic cases. Final review identified
  two package defects: an unexported `ModuleConstraints` declaration dependency
  and a rewrite that missed a second producer import. `68930c0` fixes both;
  scoped re-review approves with no new breakage.
- Final `npm run check` exits 0: 586 tests, 3,043 assertions, 439.26 seconds,
  strict classic typecheck and build. Native strict typecheck/build also exit 0,
  and all six runnable examples pass.

The first complete-check attempt failed at those physical package defects and
later encountered compiler-test timeouts under concurrent load; it has no final
success result. The corrected check runs serially with other compiler-heavy
verification paused. No timeout or native diagnostic allowance was relaxed.

## Remaining program work

This increment implements classes and positional functions within E1. Aliases,
optional/lazy references and contributions remain required composition work.
Observers/plugins, individual-chain compiler limits, native diagnostic quality,
broader compatibility/performance evidence and the final release handoff remain
open. Branch push is pending the specific export authorization requested after
automatic approval review rejected it; no package publication was attempted.
