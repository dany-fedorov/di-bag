# Release notes draft

Pending changelog entries for the agentic-scale hardening work. The release
contract in `tests/release-artifacts.test.ts` requires `CHANGELOG.md` to start
with the frozen package version and forbids an `## Unreleased` section, so
these notes stay here until the maintainer bumps the package version. At that
point, move them under the new version heading in `CHANGELOG.md` and delete
this file.

## Plans 01 to 06

- Split `npm test` into `test:fast` and `test:compiler` lanes and share one
  TypeScript program across compiler-driven tests. No runtime or public API changes.
- Add the `di-bag-graph` tool (`tools/graph`) that extracts builder chains,
  declared named dependencies, module exports and installations, lifetimes,
  async outputs, cycles, and unresolved names into JSON.
- Add `bag.inspectGraph()` with `GraphSnapshot` and `BindingSnapshot`: every
  binding, contribution group, and observed dependency edge, without acquiring.
- A factory's dependency object now throws `DI_BAG_INVALID_DEPENDENCY_ACCESS`
  for `in`, `Object.keys`, spread, `JSON.stringify`, and descriptor reads instead
  of silently reporting an empty object. Destructuring and direct reads are unchanged.
- Missing-service, lifetime-capture, and unknown-key compile-time messages now
  name the services involved, for example
  `required service registrations are missing: clock` and
  `root lifetime cannot capture scoped dependency: db -> config`.
- Add `builder.verifyGraph()` and the `CompositionReport<B>` type for a one-line
  build verdict anchored at the call.
- Plain and disposable factories, and `auto`-mode `fromFactory`, `fromFunction`,
  and `fromClass`, now reject declared outputs that are thenables but not
  Promises at compile time. Select an explicit `acquisitionMode`, or augment
  `DiBagPolicy` with `structuralThenables: 'allow'` to disable the check.

## Plan 07: module declaration erasure

- No library change. Sealed module declarations still name private registrations. The full implementation
  prints a 2,095-byte declaration with no private names and rejects private root captives at `buildModule`, but it
  exceeds two compiler-work ceilings in `tests/incremental-scale.test.ts`: 100 installed token modules measure
  1,241,108 instantiations (ceiling 1,220,000), and 100 named replacements measure 1,030,831 (ceiling 1,030,000).
  It is kept on the local branch `plan-07-module-erasure-full`; the plan file's `## Status` section has the numbers
  and the options.
- Add `tests/module-declarations.test.ts` and the `module-erasure` fixtures that characterize declaration size and
  private-name leakage. The assertions that need erasure are skipped.

### Breaking changes

- None on this branch. If `plan-07-module-erasure-full` is adopted, the type-only exports `LexicalContext`,
  `ModuleScope`, `Enclosed`, `RenamedContext`, `EnclosedLifetimeObligation`, `RenamedLifetimeObligation`, and
  `RenamedLifetimeProviders` are removed in favor of `LifetimeObligation` and `Reach`; `Contribution` loses its third
  type parameter; and a root that captures a scoped service inside its own module is rejected by `buildModule`
  instead of the host's `build()`.
