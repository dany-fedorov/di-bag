# Selected sharing and child override evidence

Implementation: runtime `439bc84`, public API and package integration `8836b8f`.
Binding specification: `docs/superpowers/specs/2026-09-07-selected-scopes-design.md`.

`Bag.scope({ share })` borrows selected cached parent acquisitions;
`Bag.scope(keys, overrides, { share }?)` adds checked child overrides. Selections
are snapshotted by index, ignore custom iterators and unselected properties, and
reject conflicting keys, transient sharing, unknown options and missing bindings
before reading override values. Duplicate selections read each override once.

Runtime routing follows binding identity. Shared values retain parent dependencies,
metadata, exact Promise identity, context and ownership. Inherited roots keep their
original graph; new root overrides anchor at the defining child. Child close does
not abort or finalize ancestor acquisitions; parent close waits for descendants,
including late dependency discovery. Inspection follows the same owner route.
Independent forks recheck lifetime captives against their new graph, including
the no-argument fork of a child whose dependency overrides are local.

## Verification

- RED: nine internal runtime cases failed before routing existed; five public
  behavior cases failed with the old no-argument-only scope API. Positive type
  fixtures likewise failed on the unsupported calls before implementation.
- Focused runtime scope/lifetime/startup suite: 75 passed / 365 assertions.
  Public sharing suite adds six passing cases for ordinary/token overrides,
  pending values, hostile selections, duplicate/empty tuples and root context.
- Final `npm run check` with subprocess permission: exit 0, **557 tests passed,
  zero failed, 2,878 assertions**, 399.58 seconds for the tests; strict classic
  typecheck and declaration build pass. Production source/tests were unchanged
  after this run; subsequent selected-scope edits record evidence only.
- Native source audit: exit 0, **95 files, 447 expected diagnostic regions,
  420 directly matched, 27 unchanged existing gaps**, no unexpected diagnostics
  and no failed fixtures. All 23 new selected-scope regions match directly.
  Native strict typecheck and declaration build also pass.
- Package covering run: **55 tests / 853 assertions**, no failures, 106.14 seconds.
  Both emitter archives run on Node and Bun in CJS and ESM (eight combinations).
  Shared private module resources, token overrides, pending/raw Promise identity,
  child-root anchoring and exactly-once dependency-ordered cleanup are asserted.
- Inferred producers emit physical `.d.cts` and `.d.mts` files from installed
  classic/native archives. Source is removed before downstream compilation with
  both compilers. Tests retain exact richer overrides, token identities, Promise
  outputs, metadata, inherited constraints and child-root output additions.
- All five examples execute, including `examples/scopes.ts`; diff checks pass.

The first package run under the restricted sandbox was invalid: forbidden Node
subprocesses returned empty output through Bun and failed npm-path discovery.
The same package tests passed with subprocess permission; no assertions or
limits were relaxed. A new positive fixture initially declared a literal-return
`1` callback while replacing it with `number`; it was corrected to declare the
intended general-number service. That was a fixture error, not an inference fix.

## Independent reviews

Task 1 review exported `439bc84` into an isolated `/tmp` tree and passed 78 tests /
387 assertions, including three additional owner-context, rollback/retry and raw
Promise probes. Spec compliance and code quality both pass, without findings.

Final review covers `dc14d36..8836b8f`, including public types and package checks.
Five independent runtime probes pass (21 assertions), and 14 additional negative
static probes plus inferred positive contracts pass on classic/native compilers.
They cover explicit generics, reflected methods, retained private root obligations,
renamed private transients, malformed options, token authentication and root
anchoring. Spec compliance and code quality both pass, without findings.

## Remaining program work

The lifecycle and startup acceptance rows now have implementation and current
verification evidence. Composition adapters, aliases, optional/lazy dependencies,
contributions, lifecycle observers, dynamic-plugin validation, large individual
compiler chains, the 27 native diagnostic-quality gaps, broader platform and
performance evidence, adversarial integration and final release handoff remain
required. No package has been published by this increment.
