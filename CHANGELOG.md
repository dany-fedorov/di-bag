# Changelog

## Unreleased

### Added

- `DiBag.withLifetime` selects `root`, `scoped`, or `transient` caching while
  preserving provider contracts and explicit ownership stages. Root values are
  shared within a tracked scope family, scoped remains the default, and transient
  creates one owned attempt per resolution. Strict roots reject captive scoped
  dependencies at graph completion; `{ captureScoped: true }` explicitly permits
  root-context capture without borrowing child-owned state.
- Classic and native emitted archives now verify the inferred lifetime producer
  with its source physically absent, all lifetime diagnostic regions, and exact
  Node/Bun CommonJS/ESM ownership execution. Sixteen emitter-required helper
  aliases are type-only root exports so unannotated declarations remain portable.
- `Bag.scope()` creates a tracked child with fresh acquisitions and ownership over
  the parent's immutable binding graph. Parent shutdown closes live descendants
  before parent-owned resources; independently closed children detach after their
  close settles, while forks remain independent roots.
- The root package now type-exports `Entries`, alongside `From` and `Provided`, so
  inferred child-scope producer declarations are portable across installed-package
  CommonJS and ESM consumers without annotations.
