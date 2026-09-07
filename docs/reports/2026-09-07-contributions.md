# Typed contribution collections

The contribution implementation and reviewed archive correction are committed
through `123cd0d` on `feat/v0.1`, with all required local gates complete.
`.contribute(token, registration)` appends ordered, independently checked providers
on builders and module builders. `.resolveAll(token)` returns a fresh frozen
readonly service array, and authenticated `DiBag.all(token)` supplies that array
to all three positional adapters. Empty collections are valid.

Collections and singular bindings have distinct lookup channels. Host operations
and module installation/declaration order define array order. Explicit module
contributions install even with no ordinary exports and retain private helpers;
repeated modules/handles create independent bindings. `ModuleContributions<M>`
exposes the readonly collection service view. `.inspectAll(token)` returns copied,
frozen snapshots without acquiring items and uses conservative metadata types.

Each item retains its canonical lifetime, exposed Promise/value, owner context,
dependency edges and cleanup. Collection resolution adds no aggregate attempt or
implicit awaiting. Partial failure preserves the original error and already
accepted ownership for normal shutdown; retries reuse cached accepted items.
Private ordinary dependencies keep their lexical maps; group lookup uses the
genuine collection token in the effective owner graph. Shared ordinary aggregate
providers retain the parent's whole acquisition, while direct child collection
reads follow normal override and root/scoped/transient routing.

The invariant C carrier retains each contributor independently through builders,
bags and modules, including private/exportless requirements, later all-reference
compatibility and lifetime walks. Default-never paths retain existing exact
contracts. Named callable contribution interfaces preserve inferred extracted
methods without exporting the private diagnostic brand.

## Completed focused and archive evidence

- New contribution runtime suite: 13 tests / 77 assertions. Relevant combined
  runtime regression: 132 tests / 660 assertions, covering adapters, aliases,
  references, lifetimes, modules, selected scopes and startup.
- Related classic fixture regression: 25 tests / 81 assertions. The contribution
  source/consumer, source-removed declaration and negative fixture checks pass;
  51 primary negative regions match, producing 53 raw native diagnostics.
- Strict classic/native project checks pass. Focused native source producers and
  consumers and physical native declarations with producer source deleted pass
  with `skipLibCheck: false`.
- Native source audit exits 0: 107 files, 622 expected regions, 595 matched, the
  same 27 existing diagnostic-quality gaps, zero unexpected diagnostics/failures.
  All 51 contribution regions match. Log:
  `/tmp/di-bag-contributions-native.log`.
- Corrected unchanged actual archive matrix exits 0: 71 tests, 1,037 assertions,
  158.17 seconds. Both emitters produce physical `.d.cts`/`.d.mts` inferred
  declarations consumed by both compilers after source deletion. Runtime routes
  execute in Node/Bun CommonJS/ESM, including portable explicit-mode core behavior.
  Log: `/tmp/di-bag-contributions-pending-raw-package.log`.
- Final `npm run check` exits 0: 667 tests, 3,497 assertions, 543.07 seconds,
  strict classic typecheck/build and unchanged diagnostic/compiler-work gates.
  Log: `/tmp/di-bag-contributions-full-check.log`.
- Final native strict typecheck/build exit 0. All seven runnable examples pass,
  including the private-module pipeline printing `Hello, DI!`. The full source
  audit above covers the same unchanged implementation; the subsequent correction
  only strengthens the shared archive runtime fixture.

## Review and implementation corrections

Independent review approves the runtime/type implementation and finds one archive
coverage gap: the raw Promise had already fulfilled. `123cd0d` leaves a separate
raw Promise unresolved while releasing the controlled native Promise and awaiting
successful close. Exact exposed/disposer identity remains checked. The corrected
matrix passes, and scoped review closes the sole finding with no new breakage.

Implementation REDs also exposed private diagnostic-brand nameability in inferred
methods and a nested private-helper captive check that incorrectly retained the
contributor's original-provider context. Named callable interfaces and correct
lexical traversal resolve those cases without weakening inferred fixtures or
lifetime requirements. The example uses async main to fit the repository's strict
CommonJS format. No native allowance, negative marker or compiler-work ceiling
was relaxed.

## Design decisions and costs

- Explicit module contributions survive an empty ordinary export selection;
  collection identity is its own public token channel. A future selective
  contribution-export API would need separate policy.
- Existing aggregate providers and scope sharing expose/borrow collections;
  there is no additional collection-sharing operation. Callers declare an
  aggregate provider when they need to share the whole collection acquisition.
- Runtime and checked graph integration were implemented together because
  private requirements and lifetime ownership cross the same boundaries.
- Named contribution callables preserve emitted generic contracts and keep the
  diagnostic brand private. They add one closure per Builder/ModuleBuilder;
  ordinary graphs also retain an empty internal collection map. The unchanged
  compiler-work gates and separate release performance work cover practical costs.

## Remaining program work

E1 composition is implemented and verified locally: class/positional adapters,
optional/lazy references, aliases and typed contributions have passed their
required gates. Lifecycle observers, dynamic-plugin
validation, individual-chain limits, the 27 native message gaps, broader
runtime/bundler/performance evidence and release handoff remain open. Observer
preparation follows `2026-09-07-lifecycle-observers.md` without changing source
during the completed contribution verification. Branch push remains pending the export approval
requested after automatic approval review rejected it; no publication occurred.
