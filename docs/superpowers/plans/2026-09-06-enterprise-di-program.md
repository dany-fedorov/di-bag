# Enterprise DI Program

**Goal:** Implement the complete enterprise DI design, including independently
publishable sas-box and val-box improvements, type safety, composition,
lifecycles, extensions, compatibility evidence, and release instructions.

**Spec:** `docs/superpowers/specs/2026-09-06-enterprise-di-design.md`.

This is the cross-repository program tracker. Detailed subsystem plans carry
the executable test-first tasks. The user explicitly requested continuous
execution; do not stop for another planning approval between increments.

## Milestones

- [ ] Box libraries: execute `2026-09-06-box-foundations.md`; review both repos and record commits/artifact names.
- [ ] Type foundation: execute `2026-09-06-type-foundations.md`; close registration/override/descriptor/receiver loopholes, preserve inference, and establish compiler-scale gates.
- [ ] Providers and modules: immutable descriptions, named/typed tokens, open requirements, private providers, checked exports and overrides.
- [ ] Box integration: optional adapter subpaths using the real packaged libraries; typed static/acquisition metadata and plain service values.
- [ ] Lifetime runtime: root/scoped/transient identities, explicit sharing, lifetime-leak checks, per-instance ownership.
- [ ] Startup and shutdown: eager acquisition, partial-failure cleanup, cancellation, timeout and late-completion handling, structured aggregate cleanup failures.
- [ ] Composition extensions: direct classes/positional functions, aliases, optional/lazy dependencies, typed contributions.
- [ ] Diagnostics and plugins: typed lifecycle observers, immutable inspection views, validated dynamic plugin boundary.
- [ ] Compatibility and comparison: package consumers, runtime/bundler matrix, reproducible performance and compiler measurements, adversarial integration tests.
- [ ] Release handoff: complete examples, migrations, changelogs, verified tarballs, and safe publication instructions for all three libraries.

## Execution rules

The design's Global Constraints apply to every milestone. Add the detailed
subsystem plan before implementation of that milestone. Record discoveries and
decisions in a plan-scoped ledger. Never replace a missing capability with a
documentation-only claim or treat a generated CI file as a successful run.

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
