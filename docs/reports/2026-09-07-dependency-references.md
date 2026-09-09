# Optional and lazy dependency references

The reference increment is implemented through `55bfcb7` on `feat/v0.1`.
`DiBag.optional(token)` and `DiBag.lazy(token)` work alongside ordinary tokens in
`fromTokens`, `fromFunction` and `fromClass`. Immutable authenticated handles retain
the token's invariant service contract. Required and optional graph obligations
remain distinct through builders, modules, lifetimes and emitted declarations.

An optional read returns absence only when no binding exists. A present undefined
service is acquired and owned normally; factory failures, native rejections and
cycles retain their existing behavior. A lazy closure acquires on invocation,
using the capturing attempt's lexical graph, owner context and shutdown admission.
Scoped/root targets retain their cache, transients acquire per call, and observed
edges govern cleanup. Neither reference implicitly awaits a value or adds an owner.

## Verification

- Focused runtime regression: 53 pass, 276 assertions, including 16 new reference
  tests/102 assertions. Coverage includes every adapter, absent/present/failing
  optionals, lazy cache/transient identity, private modules and renamed exports,
  shared/root ownership, strict-root checks, synchronous/post-await cycles,
  failed-source retained closures and source-specific shutdown admission.
- Complete classic type fixture suite: 93 pass, 373 assertions. New cases retain
  optional external/exportless module obligations, exact mixed tuples, default/rest
  parameters, inline native Promise inference, explicit/reflected method views,
  provider unions, never rejection and a 64-reference tuple.
- Native source audit: 101 files, 527 expected regions, 500 matched, the same
  27 existing diagnostic-quality gaps, zero unexpected diagnostics or failures.
  All 49 new negative regions match. Focused native checks also consume actual
  inferred declarations with producer source absent.
- Corrected physical matrix:
  `bun test tests/native-package.test.ts tests/package.test.ts` exits 0 with
  63 tests/945 assertions in 123.01 seconds. Both classic/native archives execute
  Node/Bun CommonJS/ESM assertions for optional absence/failure/undefined ownership,
  raw Promise identity, deferred transient acquisition, parent graph/context through
  selected sharing, once-only cleanup and closed-owner rejection. Both emitters'
  physical `.d.cts`/`.d.mts` inferred producers are consumed by both compilers after
  deleting producer source.
- Final `npm run check` exits 0: 613 tests, 3,209 assertions, 452.42 seconds,
  strict classic typecheck and build. Final native strict typecheck/build also
  exit 0. All six runnable examples pass, including the updated composition example.

The first physical run failed four tests because the fixture helpers missed two
inline `import('../../../src')` type queries. Their missing-import errors replaced
the intended invariant-reference diagnostic. `55bfcb7` globally routes relative
root type imports in both helpers; both original imports and the diagnostic marker
remain. Independent review approves the runtime/type implementation, and scoped
review closes the sole package finding with no new breakage.

Compatibility regressions caught during implementation were corrected without
weakening tests: ordinary mutable token tuples preserve exact graph types, indexed
tokenKeys metadata remains available, long reference tuple filtering avoids the
early recursion limit, and overload ordering preserves native nominal diagnostics
and unannotated lazy Promise inference.

## Remaining program work

Aliases and contributions remain required E1 work. The alias design follows under
`2026-09-07-aliases.md`; it is not implemented by this increment. Observers/plugins,
individual-chain scale limits, the 27 native diagnostic-quality gaps, broader
compatibility/performance evidence and release handoff remain open. The branch
push remains pending the specific export approval requested after automatic
approval review rejected it. No package publication was attempted.
