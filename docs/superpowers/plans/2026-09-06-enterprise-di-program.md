# Enterprise DI Program

**Goal:** Implement the complete enterprise DI design, including independently
publishable sas-box and val-box improvements, type safety, composition,
lifecycles, extensions, compatibility evidence, and release instructions.

**Spec:** `docs/superpowers/specs/2026-09-06-enterprise-di-design.md`.

This is the cross-repository program tracker. Detailed subsystem plans carry
the executable test-first tasks. The user explicitly requested continuous
execution; do not stop for another planning approval between increments.

## Milestones

- [x] Box libraries: `2026-09-06-box-foundations.md` completed; final review clean after the sas-box generic-constructor correction. Evidence: `docs/reports/2026-09-06-box-foundations.md`.
- [x] Type foundation: `2026-09-06-type-foundations.md` tasks complete; carried observer correction resolved by reviewed named-module Task1. Evidence: `docs/reports/2026-09-06-type-foundations.md`. Initial scale gates pass; larger limits remain required work below.
- [ ] Providers and modules: named open modules, private bindings, checked exports and overrides are complete (`2026-09-06-named-modules.md`; evidence in `docs/reports/2026-09-06-named-modules.md`). Immutable provider transformations are complete through final correction `6874760`, with clean scoped review; typed symbol tokens remain required.
- [x] Box integration: adapters use real packaged libraries, typed acquisition frames and plain service values; final shared union-type correction `6874760` and scoped review are complete. Evidence: `docs/reports/2026-09-06-provider-transformations.md`.
- [x] Acquisition foundation: `2026-09-06-acquisition-foundations.md` completed through `fd83085`; task review and final scoped review are clean. Evidence: `docs/reports/2026-09-06-acquisition-foundations.md`, including the explicit structural-thenable conversion migration.
- [ ] Lifetime runtime: root/scoped/transient policies, explicit sharing and lifetime-leak checks on the per-attempt acquisition foundation.
- [ ] Startup and shutdown: eager acquisition, partial-failure cleanup, cancellation, timeout and late-completion handling, structured aggregate cleanup failures.
- [ ] Composition extensions: direct classes/positional functions, aliases, optional/lazy dependencies, typed contributions.
- [ ] Diagnostics and plugins: typed lifecycle observers, immutable inspection views, validated dynamic plugin boundary.
- [ ] Compatibility and comparison: package consumers, runtime/bundler matrix, reproducible performance and compiler measurements, adversarial integration tests.
- [ ] Compiler/inference follow-up: resolve the measured 500/1000 individual-chain limits, large-graph latency, and the inline async richer-selected override combination; preserve all existing contracts and the cast-free predeclared-object workaround. Actual nominal-module 1000-provider gates now pass, separately from registration groups. A bounded inference candidate and its unproved boundaries are recorded in `docs/reports/2026-09-06-inline-fork-inference.md`; it has not been adopted.
  Also resolve the context-sensitive inline nested `snapshot()` factory case
  found during adapter Task3; predeclaring the identical factory preserves exact
  types without annotations/casts. See the provider-transformations report.
- [ ] Release handoff: complete examples, migrations, changelogs, verified tarballs, and safe publication instructions for all three libraries.

## Execution rules

The design's Global Constraints apply to every milestone. Add the detailed
subsystem plan before implementation of that milestone. Record discoveries and
decisions in a plan-scoped ledger. Never replace a missing capability with a
documentation-only claim or treat a generated CI file as a successful run.

Execution refinement: per-acquisition shutdown bookkeeping precedes owned
provider transformations and box adapters, so projection failures and late
ownership have a correct place to be tracked. The provider/adapter refinement
is `docs/superpowers/specs/2026-09-06-provider-transformations-design.md`.
This prerequisite does not remove or complete later lifetime/startup work.
The completed provider plan is `2026-09-06-provider-transformations.md`: typed
metadata/inspection, staged mappings/ownership, then real optional box adapters.
Its metadata/inspection task is complete at `06918c8`, staged mappings/
ownership at `6a71ab4`, and box adapters at `ae36def`. Broad final review found a
shared `NoInfer` union extraction defect; `6874760` corrects it and preserves
replacement inference, with clean final scoped review. Typed-token integration
now has the binding design `2026-09-07-typed-tokens-design.md` and executable
plan `2026-09-07-typed-tokens.md`: internal identity/routing, checked public/module
composition, then actual package/compiler integration. Implementation remains open.
The internal token foundation is complete at `1048e29`, with clean task review;
public token/module composition is complete at `d58937c`, with task review
Approved and one bulk-fork efficiency follow-up. Final package/scale integration
and the broad token review remain open.
The incremental-check candidate is documented
in `docs/reports/2026-09-06-incremental-check-investigation.md`, not adopted.

## Current evidence

- Initial di-bag `npm run check`: 73 tests passed; strict typecheck/build passed.
- Both upstream box repositories were resolved and cloned. After separate
  user authorization, verified intermediate checkpoints were non-force pushed
  to their `feat/enterprise-foundations` branches, with exact remote SHA checks.
  No package has been published. Evidence is in the box-foundations report.
- Type-boundary investigation ran independently of box implementation.
- Read-only type investigation completed: nominal disposal handles, explicit
  selected overrides, duplicate-rejecting additions, and singleton replacement
  address the concrete counterexamples; flat entry unions compiled 250 chained
  additions in the feasibility probe. These findings are not implementation.
- Module design investigation completed: installations need independent private
  identities and shared public lookup slots; private consumers of an exported
  service must observe a fork's public override. Per-export wrapper bags would
  hide ownership edges and are not the selected runtime architecture.
- Named-module Task1 implements the internal binding graph at `4f6aab4`:
  isolated symbol identities, lexical references, immutable descriptions, and
  native Promise bookkeeping with original exposed identity. Task review is
  clean; independent full check passes 122 tests / 419 assertions, typecheck,
  declaration build, package consumers and WBS.
- Public named modules are implemented at `9b9fb98`; task and final broad reviews
  are clean. Independent exact-HEAD verification passes 144 tests / 527
  assertions, typecheck/build, CJS/ESM consumers, all nominal-module scale cases
  and both examples. The lifecycle retry defect is addressed by the acquisition
  foundation below; compiler/inference limitations remain required follow-up.
- Acquisition identity and aggregate shutdown are implemented at `179fa2e`:
  full check 155 tests / 602 assertions, task review clean. Final review found
  native Promise-subclass assimilation; `fd83085` fixes it with direct native
  observation and an independent native pending barrier. Independent covering
  check passes 74 tests / 300 assertions, strict builds and both examples;
  final scoped review is clean. Structural thenables use explicit conversion
  inside factories; no host-specific core dependency or guessed fallback.
- Typed immutable provider metadata and checked inspection are implemented at
  `06918c8`, retaining metadata through module export/rename/install and exact
  original factory contracts. Task review is clean; independent full check:
  181 tests / 813 assertions, strict typecheck/build, real CJS/ESM consumers,
  all current scale gates, and both examples. Later provider tasks are below.
- Staged sync/async mappings and additive ownership are implemented at `6a71ab4`.
  Task review is clean; independent exact-commit full check: 204 tests / 956
  assertions, strict typecheck/build, all scale and package gates, both examples.
  Retired cleanup waits for its own pending work; explicit required disposer
  receivers are rejected. Adapter and final-review evidence follows.
- Optional adapter subpaths and ordered acquisition frames are implemented at
  `ae36def`, including failed-retirement incoming-edge correction. Task review
  is clean; independent exact-commit full check: 230 tests / 1,174 assertions,
  strict typecheck/build, real box/core consumers, all current scales and three
  examples. The nested inline snapshot factory needs a predeclared-factory
  workaround until the required inference follow-up.
- Final shared union extraction and compatible replacement inference are corrected
  at `6874760`. Full check: 240 tests / 1,322 assertions, strict typecheck/build,
  current scales and actual packages; six later negative calls have a separate
  source/CJS/ESM covering run. Controller independent committed-state check:
  27 tests / 381 assertions plus strict typecheck/build and all three examples.
  Final scoped review is clean, both findings addressed, no residual issues.
- Bounded token and lifetime carrier investigations are recorded in
  `docs/reports/2026-09-06-typed-token-investigation.md` and
  `docs/reports/2026-09-06-lifetime-contract-investigation.md`. Only the token
  identity sketch has source/emitted compiler evidence; the lifetime proposal
  remains unadopted. The additional token carrier investigation is recorded in
  `docs/reports/2026-09-06-typed-token-carrier-investigation.md`: isolating a nested
  inferred resolve return and using a bounded indexed output retained all 32
  expected diagnostics at 29 positions in both source and emitted consumers,
  under a 384 MiB / 10-second child bound. This supports the selected fourth
  provider contract, not a production scalability claim. The production plan
  preserves export-time module projection, unlike the bounded prototype.
- Fresh pre-token baseline at `e26bb16`: `npm run check` passed 240 tests / 1,334
  assertions in 312.67 seconds, strict typecheck and declaration build. No token
  production implementation was present in that run.
- Token Task1 is implemented at `1048e29`: genuine invariant token identities,
  retained provider graph contracts and shared internal symbol acquisition routes.
  Full check:264tests/1560assertions, typecheck/build and all3examples; controller
  independent committed-state covering run:30tests/250assertions, strict builds,
  actual package consumers and all3examples. Initial task review is clean, no
  findings. Evidence: `docs/reports/2026-09-07-typed-tokens.md`. This is an internal
  foundation checkpoint, not completion of public tokens or milestone M1.
- Bounded scope-inheritance comparison is recorded in
  `docs/research/2026-09-07-scope-inheritance.md`, using pinned Awilix source,
  official Inversify hierarchy documentation and pinned Effect4RC source.
  It separates first-child construction, child shadowing and borrowing ownership.
  Recommendations remain unadopted until the lifecycle refinement; no upstream
  runtime test or benchmark was executed by that research.
- Token Task2 is implemented at `d58937c`: checked root/module binding, token
  replacement/resolution/inspection and mixed selected overrides. Real feature
  declaration emission exposed TS4118; a named Record view preserves emission and
  exact contracts without user casts/annotations. Full check:287tests/1812assertions,
  strict builds/all3examples; later fixture-only additions have covering checks.
  Controller committed-state verification:45focused tests/472assertions plus
  18token runtime tests/67assertions, strict builds and all3examples. Task review
  Approved; one bulk-fork repeated-graph-build performance finding remains for
  the broad final review. Token Task3 and larger enterprise rows remain required.
