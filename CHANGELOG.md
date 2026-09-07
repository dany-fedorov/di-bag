# Changelog

## Unreleased

### Added

- `Bag.scope()` creates a tracked child with fresh acquisitions and ownership over
  the parent's immutable binding graph. Parent shutdown closes live descendants
  before parent-owned resources; independently closed children detach after their
  close settles, while forks remain independent roots.
- The root package now type-exports `Entries`, alongside `From` and `Provided`, so
  inferred child-scope producer declarations are portable across installed-package
  CommonJS and ESM consumers without annotations.
