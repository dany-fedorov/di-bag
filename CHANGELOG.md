# Changelog

## 0.1.0

### Added

- `DiBag.fromPlugin(dependencies, descriptor, { acquisition, validate })`
  authenticates an application-selected unknown descriptor and admits its checked
  result as one typed provider. Descriptors use own `apiVersion: 1` and `create`
  fields with optional original-value disposal; explicit raw/native acquisition,
  synchronous predicate validation, canonical cleanup and module composition
  retain existing dependency, ownership and observer contracts.
- `DiBag.observe({ onEvent, onError })` appends immutable lifecycle observers.
  Frozen events report canonical scope, acquisition and accepted-cleanup identity,
  final-stage readiness, metadata and original failures. Queued callbacks preserve
  graph values and ownership; callback failures use the required error sink and
  asynchronous observer work never gates shutdown.
- `.contribute(token, provider)`, `.resolveAll(token)` and `DiBag.all(token)`
  compose ordered collections with independently checked dependencies, lifetimes
  and cleanup. Module contributions retain private helpers and installation order
  even with no ordinary exports; frozen arrays preserve exact exposed values.
  `ModuleContributions` and `.inspectAll(token)` expose conservative collection views.

- `Builder.alias` and `ModuleBuilder.alias` add checked name/token lookup aliases
  that preserve the canonical target's identity, Promise mode, transient behavior,
  ownership, module privacy and selected parent sharing. Inspection shows the direct
  target relationship and canonical acquisition snapshots.
- `DiBag.optional(token)` and `DiBag.lazy(token)` provide explicit dependency
  references in all positional adapters. Optional absence preserves present-value
  validation and acquisition failures; lazy calls preserve lexical graph, lifetime,
  context and shutdown rules. Module and declaration contracts retain both kinds
  of dependency, with no implicit awaiting or ownership transfer.
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
