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
- Compile-time messages now name the services involved, for example
  `required service registrations are missing: clock` and
  `root lifetime cannot capture scoped dependency: db -> config`.
- Add `builder.verifyGraph()` and the `CompositionReport<B>` type for a one-line
  build verdict anchored at the call.
- Plain and disposable factories, and `auto`-mode `fromFactory`, `fromFunction`,
  and `fromClass`, now reject declared outputs that are thenables but not
  Promises at compile time. Select an explicit `acquisitionMode`, or augment
  `DiBagPolicy` with `structuralThenables: 'allow'` to disable the check.
