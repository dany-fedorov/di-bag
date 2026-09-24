---
status: accepted
---

# Default providers to one singleton per container tree

Most DI Bag services are stateless application services, repositories, or clients, so an
unmarked provider now creates one service for a root container and all of its child
containers. Per-request state and every consumer that captures it are marked
`'scoped:one-per-container'`; transient providers remain explicit. This makes the common
case terse while keeping request boundaries visible at the provider that owns them.

Two compile-time rules guard the model. A singleton may not depend on a scoped service
unless its provider explicitly uses
`DiBag.providerWithLifetime({ provider, lifetime: 'singleton:one-per-container-tree', allowsScopedDependencies: true })`.
A child container may replace only scoped and transient services; replacing a singleton
requires an independent container because inherited singleton consumers have already fixed
their dependency graph. Runtime enforces the child replacement rule for JavaScript and for
callers that bypass TypeScript.

Module sealing retains an obligation when a singleton reaches an external requirement.
The installing host may satisfy that requirement with a scoped provider, including after
`withRenamedRequirement`, so discarding the reach at the module boundary would make the
capture check unsound.

## Remaining gap

The graph cannot infer that dependency-free state is conceptually per request. If a request
id, unit of work, or similar provider has no scoped dependency and its author forgets the
scoped mark, it is shared across child containers. The migration codemod pins the old scoped
meaning in programs that used `createScope`; developers then remove pins only where sharing
is intended.

## Considered options

- Keep scoped as the default. This preserves 0.4 behavior but makes every ordinary stateless
  service allocate once per child container and leaves the common application shape verbose.
- Select a default per builder. This moves lifetime meaning away from each provider, makes
  installed modules depend on host policy, and creates two interpretations of the same module.
- Use NestJS-style scope bubbling. DI Bag discovers named dependencies lazily through a Proxy,
  so it cannot know the complete runtime dependency graph before factories run; bubbling would
  make cache ownership change after acquisition and would still miss dependency-free request
  state.
- Remove child containers. Independent containers avoid the replacement ambiguity, but they
  also give up shared singleton clients, tracked parent-child shutdown, and the inexpensive
  request-container pattern.

## Consequences

Old code that creates child containers can compile with different instance counts, so this is
the release's one silent semantic migration. The type-aware `--pin-lifetimes` transform
preserves old behavior. Complete host graphs with no scoped provider skip the lifetime walk;
module sealing still retains external reaches. A disposable transient remains owned until the
container that resolved it closes.
