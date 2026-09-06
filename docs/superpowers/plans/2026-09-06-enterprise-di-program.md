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
- [ ] Providers and modules: named open modules, private bindings, checked exports and overrides are complete (`2026-09-06-named-modules.md`; evidence in `docs/reports/2026-09-06-named-modules.md`). Immutable provider transformations and typed symbol tokens remain required.
- [ ] Box integration: optional adapter subpaths using the real packaged libraries; typed static/acquisition metadata and plain service values.
- [x] Acquisition foundation: `2026-09-06-acquisition-foundations.md` completed through `fd83085`; task review and final scoped review are clean. Evidence: `docs/reports/2026-09-06-acquisition-foundations.md`, including the explicit structural-thenable conversion migration.
- [ ] Lifetime runtime: root/scoped/transient policies, explicit sharing and lifetime-leak checks on the per-attempt acquisition foundation.
- [ ] Startup and shutdown: eager acquisition, partial-failure cleanup, cancellation, timeout and late-completion handling, structured aggregate cleanup failures.
- [ ] Composition extensions: direct classes/positional functions, aliases, optional/lazy dependencies, typed contributions.
- [ ] Diagnostics and plugins: typed lifecycle observers, immutable inspection views, validated dynamic plugin boundary.
- [ ] Compatibility and comparison: package consumers, runtime/bundler matrix, reproducible performance and compiler measurements, adversarial integration tests.
- [ ] Compiler/inference follow-up: resolve the measured 500/1000 individual-chain limits, large-graph latency, and the inline async richer-selected override combination; preserve all existing contracts and the cast-free predeclared-object workaround. Actual nominal-module 1000-provider gates now pass, separately from registration groups. A bounded inference candidate and its unproved boundaries are recorded in `docs/reports/2026-09-06-inline-fork-inference.md`; it has not been adopted.
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
The next executable plan is `2026-09-06-provider-transformations.md`: typed
metadata/inspection, staged mappings/ownership, then real optional box adapters.
Its metadata/inspection task is complete at `06918c8`; mappings and box adapters
remain in progress. The independent incremental-check candidate is documented
in `docs/reports/2026-09-06-incremental-check-investigation.md`, not adopted.

## Current evidence

- Initial di-bag `npm run check`: 73 tests passed; strict typecheck/build passed.
- Both upstream box repositories were resolved and cloned without changing
  their remote state. No package has been published or pushed.
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
  all current scale gates, and both examples. The provider plan is not complete.
