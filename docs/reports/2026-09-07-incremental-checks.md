# Incremental dependency-check integration

Builder additions and replacements now validate only dependency relationships
that cross the boundary between already-accepted history and the incoming
registrations. The incoming registration map still passes through the complete
`Checked<N>` contract first. This preserves admission and incoming-error
precedence while avoiding repeated validation of every relationship in fluent
builder history.

The change is limited to the five builder checks for `add`, `bind`, the two named
`replace` overloads and token `replace`. Module construction, installation,
forking, closure, runtime behavior, contextual inputs and inferred outputs remain
unchanged. `IncrementalChecked` is exported only from the internal `types.ts`
module; it is not added to the package root API.

## Compiler-work gates

Both gates compile real generated public API calls with the existing compiler
options and virtual-source host. TypeScript is pinned at 5.9.3, so a compiler
upgrade must explicitly review these work counters.

| Public program | Before | After | Ceiling | Reduction |
| --- | ---: | ---: | ---: | ---: |
| 100 chained named additions, valid | 3,749,643 | 838,875 | 1,500,000 | 77.6% |
| 100 token bindings, valid | 10,296,781 | 1,361,372 | 2,000,000 | 86.8% |

The pre-change programs both had zero diagnostics and visible JSON output; their
tests failed only because the instantiation counts exceeded the fixed ceilings.
After the change both programs still have zero diagnostics and pass those
ceilings. The workers retain all prior JSON fields and CLI arguments and now add
the compiler's `instantiations` counter.

These ceilings are regression gates, not general performance guarantees. They do
not claim portable latency or memory limits, and they do not remove the existing
larger advisory scale cases.

The later root-builder history guard did not change either observed compiler
counter: 100 chained named additions remained at 838,875 instantiations and 100
token bindings remained at 1,361,372, both with zero diagnostics.

## Contract coverage

New source and packed-package fixtures cover both directions of named and token
relationships, forward additions, grouped additions, named and token replacement,
binding output admission, opaque provider graphs and bound-token contracts,
missing dependencies, private module constraints, exact richer replacement
outputs, explicit replacement generics, provider graph metadata and acquisition
frames. The fixtures compile against both CommonJS and ESM installed declarations.

One simultaneous-error control intentionally changes the selected useful
diagnostic: when an incoming group contains both an invalid local named edge and
a wrong token edge, the incoming `Checked<N>` result now reports the named shape
error before cross-boundary token validation. The pre-change semantic RED reported
the token-contract error instead. Existing supported method-return replacement
inference remains covered by its unchanged fixture.

## Root builder view correction

Before the final matrices, a cast-free structural assignment demonstrated that
root `Builder` views could erase an already-accepted consumer dependency. This
predated incremental checking: it compiled with zero diagnostics both before and
after the Task 1 algorithm change, then an apparently valid replacement caused
`TypeError: value.toFixed is not a function` at runtime. Root `Builder`'s existing
phantom member now retains both its entry history and module constraint as an
invariant readonly tuple. No runtime code, checker algorithm, method signature,
`Bag`, or `ModuleBuilder` changed.

Source fixtures prove exact same-registration and equivalent individual-add
histories remain assignable and preserve synchronous string and
`Promise<boolean>` outputs. Negative source and installed CommonJS/ESM fixtures
reject erased and widened builder histories; the already-rejecting `Bag` and
module-builder neighborhood controls remain rejected. Builder annotations are
therefore intentionally stricter: retain inferred or exact builder types instead
of erasing provider/consumer contracts through structural annotations or casts.

## Current bounded matrices

The corrected declaration boundary at `8daad9a` was measured with TypeScript
5.9.3, Node v24.20.0, Bun 1.4.0, a 3,072 MiB worker old-space cap and a 60-second
timeout. The two matrices ran sequentially. Compiler time and peak RSS are
single observations, not editor guarantees.

- The original 36-case named report accepted 30 cases. Every 100 and 500 case,
  plus all 1,000 bulk/grouped cases, completed with the required valid or exact
  boundary result. All six 1,000 chained/replacement cases exited status 1 with
  a TypeScript `RangeError: Maximum call stack size exceeded` before JSON output.
- The 18-case token report accepted 9 cases. Every 100 case and every 500 binding
  case completed. All three 500-module cases and all six 1,000 cases timed out
  with `SIGTERM`/`ETIMEDOUT` and empty stdout.

Timeouts, stack overflows, empty output, wrong case identity, malformed JSON,
TS2589, off-file diagnostics and off-boundary messages are never counted as type
rejections. The exact 36-row and 18-row tables are in the TypeScript benchmark
document; full diagnostics and child failure evidence are retained in
`.superpowers/sdd/2026-09-07-incremental-checks/task-2-named-matrix.jsonl` and
`task-2-token-matrix.jsonl`. The remaining named and token failures are open
enterprise compiler-scale work, not a completion claim.

## Verification

- Focused compiler-work gate: 2 tests passed, 0 failed.
- Focused incremental source contracts: 2 tests passed, 0 failed.
- Source plus installed CommonJS/ESM and token declaration contracts: 100 tests
  passed, 0 failed, with 838 assertions.
- Full `npm run check`: strict typecheck, 308 tests passed across 19 files with
  1,964 assertions, and the declaration build completed successfully.
- All four runnable examples completed successfully: WBS ownership, named
  modules, box adapters and token modules. `git diff --check` was clean.
- Controller verification of committed `d6c2710a6f953fdb66e1d829fb2ea08c683fb338`:
  strict typecheck, 32 passing compiler-work / installed box and token package
  tests with 361 assertions in 20.24 seconds, strict build, all four examples
  and diff check. Every command exited 0 with visible test/example output.
- Builder-history RED: the equivalent-history positive passed while the new
  negative fixture failed because its first expected “not assignable” diagnostic
  was absent. After the one-member guard, the focused builder run passed 2 tests
  with 8 assertions.
- Builder-history source, installed CommonJS/ESM, token-package and compiler-work
  compatibility passed 108 tests with 878 assertions. The positive installed
  fixture initially exposed the `.cts`/`.mts` generic-arrow parser requirement;
  adding the syntax-only `<B,>` comma made all four installed builder-view cases
  pass without changing their contract.
- Current scale harness coverage passed 28 tests with 117 assertions; strict
  typecheck and declaration build both exited 0 before matrix collection.
- Final `npm run check` completed strict typecheck, 334 tests across 20 files
  with 2,044 assertions, and the declaration build. The WBS ownership, named
  modules, box adapters and token modules examples all completed successfully;
  final diff and artifact consistency checks were clean.
- Controller verification of committed production/harness `659acdd` passed
  strict typecheck, 56 benchmark/work/installed-package tests with 433 assertions
  in 40.95 seconds, two source builder-view tests with eight assertions,
  declaration build, all four examples, and diff check. Every command exited 0.
  Only controller documentation changed during this run.

Both task reviews are approved. Task 2 has one Minor for final-review triage:
direct unit coverage of the parent report evaluator's failure branches. The
reviewer's initial scope finding was withdrawn after distinguishing measurement
Task 2 from enterprise requirement T2. The controller independently reconciled
all 54 artifact rows, including the 39 accepted diagnostic/work records and all
15 process failures. Broad final review remains separate. The bounded reports
do not close the enterprise program while the larger cases still fail to complete.

## Decisions and their costs

1. Incremental checks reuse flat entry history. The measured reduction supports
   this smaller integration; if insufficient, old-entry scans and module checks
   will require further checker redesign.
2. Incoming errors precede cross-token and cross-named errors, avoiding
   conflicting diagnostic records collapsing to `never`. The compatibility cost
   is a different first diagnostic for simultaneously invalid graphs.
3. Pinned compiler-work ceilings use 1.5 million named and 2 million token
   instantiations, with 60-second / 3,072 MiB workers. They separate baseline from
   improvement without asserting portable latency; upgrades may need recalibration.
4. Existing report workers retain the named default and gain explicit `--tokens`
   mode. This preserves old invocations but adds CLI/JSON compatibility logic.
5. The demonstrated view-erasure hole required the root Builder's existing
   invariant member to retain `[E, C]` before the final measurements. The cost is
   stricter builder annotations and possible compatibility/measurement rework.
6. The fixture's generic identity arrow uses `<B,>` for installed `.cts`/`.mts`
   parsing. This changes only syntax, with fixture maintenance as its possible cost.
