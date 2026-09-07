# Changelog

## Unreleased

### Added

- `DiBag.fromClass` adapts concrete constructors and `DiBag.fromFunction` adapts
  positional callbacks with checked typed-token arguments. Both preserve exact
  outputs, acquisition modes and explicit ownership; classes retain prototypes,
  private fields and `new.target`. Optional/rest parameters and bound receivers
  are supported without decorators or parameter-name reflection.
- `Bag.scope({ share })` borrows selected parent acquisitions, and
  `Bag.scope(keys, overrides, { share }?)` supplies checked child overrides.
  Sharing retains parent dependencies, Promise identity, context and ownership;
  conflicts and transient sharing reject before override getters run. New root
  overrides are owned by their defining child and inherited by its descendants.
- Selected scope contracts are verified through physical classic/native
  declarations and packed Node/Bun CommonJS/ESM consumers.
- `Builder.start(keys, options?)` eagerly acquires selected names/tokens in a fresh
  bag, with parallel/sequential startup, rollback on failure, external cancellation
  and finite positive timeouts. `DiBagStartupError` retains setup and cleanup
  causes; `DiBagStartupCancelledError` rejects promptly and exposes eventual cleanup.
- `DiBag.withContext` supplies a frozen acquisition-owner context and AbortSignal,
  preserving named dependencies, exact output/acquired types and explicit modes.
  Closing a scope cooperatively aborts its context before draining owned work.
- Startup readiness observes the final acquisition stage independently of pending
  source/projection work; shutdown still drains every stage. Raw Promise values
  remain raw and native Promise identity is unchanged.
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
