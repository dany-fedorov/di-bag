# Changelog

## 0.5.0

The API is pre-1.0. This release renames almost every public name, so that a
call reads as a sentence and an option says what it holds, and it changes three
behaviors. Run the codemod BEFORE upgrading, then read the
[migration guide](docs/guides/migrating-to-0.5.md), which lists every rename.

### Migration

- `npx di-bag-codemod --project tsconfig.json --write` rewrites a project while
  the 0.4.0 types are still installed. It is type-aware, reshapes arguments,
  adjusts child-replacement lifetimes only when the graph proves the adjustment
  is needed, and reports ambiguous cases instead of guessing. New package:
  `di-bag-codemod` 0.1.0.
- Every removed callable name still exists at run time for the 0.5 line as a
  function that throws `DI_BAG_REMOVED_API` and names its replacement in
  `details.replacement`. This guarantee covers callable names only: removed
  types, fields, and import specifiers have no runtime stub. The types omit all
  removed APIs, so TypeScript rejects their use at compile time.

### Breaking changes: behavior

- A child container replaces only scoped and transient services. Replacing a
  singleton in a child does not compile; `createIndependentContainer` may
  replace anything.
- A token is either for one service, `createToken(symbol).forService<S>()`, or
  for a collection, `createToken(symbol).forCollectionOf<Item>()`. A collection
  is read with `container.resolveCollection(collectionToken)` or as a collection
  dependency, and inspected with `container.serviceSnapshot(collectionToken)`.
  `DiBag.all`, `resolveAll` and `inspectAll` are removed. Using a token of the
  wrong kind is a compile error and `DI_BAG_WRONG_TOKEN_KIND` at run time.
- `di-bag/node` is removed. Import from `di-bag`; the package finds the host's
  Promise classifier by itself.

The default remains `'scoped:one-per-container'`. Lifetime values now state
their caching boundary: `'singleton:one-per-container-tree'`,
`'scoped:one-per-container'` and `'transient:one-per-resolve'`. This is a naming
change, not a change to the default lifetime.

### Breaking changes: names

- The builder: `withServices`, `withTokenService`, `withServiceAlias`,
  `withCollectionContribution`, `withReplacedService(serviceKey, provider)`,
  `withInstalledModules` (a list), `verifyGraphAtCompileTime`,
  `buildModule({ exportedServiceKeys, moduleLabel })`, and `buildContainer`.
  `buildAndStart` is
  `builder.buildContainer().ensureServicesReady(serviceKeys, options)`.
- The container, which was `Bag`: `serviceSnapshot`, `graphSnapshot`,
  `createChildContainer(replacedServiceKeys, replacementProviders, options?)`,
  `createIndependentContainer(replacedServiceKeys, replacementProviders)`, and
  `close({ abortSignal, waitTimeoutMs })`. Readiness options are
  `{ abortSignal, totalTimeoutMs, maxConcurrentServiceKeys }`. No-argument and
  empty-bag forms remain available for both derivation methods, the child also
  accepts a share-only bag, and explicit `undefined` is accepted exactly where
  the selected overload permits it.
- Providers: `DiBag.createProvider(factory, options?)`,
  `DiBag.createProviderFromFunction(options)`,
  `DiBag.createProviderFromClass(options)`, and
  `DiBag.createProviderFromPlugin(options)`, with option-bag names including
  `factoryReturnKind` and `factoryReceivesContext`. Decorators are the five
  facade calls `DiBag.providerWithDisposal`, `DiBag.providerWithLifetime`,
  `DiBag.providerWithRegistrationMetadata`,
  `DiBag.providerWithAcquisitionMetadata`, and
  `DiBag.providerWithTransformedService`; each takes an option bag containing
  its `provider`.
- Modules: `module.withRenamedExport({ currentExportKey, newExportKey })` and
  `module.withRenamedRequirement({ currentRequirementKey, newRequirementKey })`.
  String requirements can be renamed; typed tokens retain their global identity.
- Configuration: `withConfiguration({ runtime, lifecycleObservers })`, an
  observer being `{ onLifecycleEvent, onObserverFailure }`.
- Snapshots and events: `isPresent`, `bindingLabel`, `serviceKeys`,
  `isOwnedByContainer`, `factoryReturnKind`, `tokenSymbol`, `dependencyKind`,
  `collectionTokenSymbol`, `consumerBindingId`, `dependencyBindingId`,
  `containerId`, `parentContainerId`; event kinds `container-*` and
  `disposal-*`.
- Errors: a code names a kind of failure and never a method, which is in
  `details.operation`. 32 codes replace the 42 of 0.4.0. Every malformed
  argument is `DI_BAG_INVALID_ARGUMENT` with `details: { operation, argument,
  expected }`. `DiBagCleanupError` is `DiBagDisposalError`, the startup errors
  are `DiBagServiceReadinessError` and
  `DiBagServiceReadinessCancelledError`, and `cleanup...` fields are
  `disposal...`. The guide has the full table, including the six codes that were
  split.

### Added

- `module.withRenamedRequirement({ currentRequirementKey, newRequirementKey })`
  renames a string-keyed requirement without a wrapper module. Typed-token
  requirements retain their global identity and cannot be renamed.
- `ensureServicesReady` works on any container, reports what is still pending
  when it is cancelled, and takes `maxConcurrentServiceKeys`.
- `FactoryContext.abortSignal`, and a factory context for positional factories.
- `docs/guides/api-naming.md`, the naming rules this release follows, with a
  test that holds the public surface to them.

### Tools

- `di-bag-graph` 0.2.0 reads 0.5.0 builder chains. Its node field `owned` is now
  `isOwnedByContainer`.
- `di-bag-codemod` 0.1.0, see Migration.

## 0.4.0

The API is pre-1.0; this release adds ownership for resources a factory acquires
on the way, portable factories for browsers and workers, and a tested React
recipe. It changes one error message and the identity of acquisition contexts.

### Breaking changes

- `DI_BAG_CLASSIFIER_REQUIRED` now names every registration that still uses
  automatic acquisition, sorted: the first eight in the message, all of them in
  `details.bindings`, private module services as `<label>/<key>`. The message
  suggests `fromSyncFactory` and `fromAsyncFactory`. Code matching the full
  message text must match the new text; the `this host has no
  process.getBuiltinModule` prefix, `code`, and `details.option` are unchanged
  ([#28](https://github.com/dany-fedorov/di-bag/issues/28)).
- Each acquisition now receives its own frozen `AcquisitionContext` rather than
  one shared per scope. The `signal` is unchanged — still the owning bag's, shared
  by every acquisition it owns — so code comparing context objects by identity
  should compare `context.signal` instead.

### Added

- `factoryCtx.pushDisposer(disposer)` on the acquisition context makes the bag own
  a resource a factory acquired before it could return
  ([#27](https://github.com/dany-fedorov/di-bag/issues/27),
  [#32](https://github.com/dany-fedorov/di-bag/issues/32)). Pushed disposers run
  exactly once, last pushed first: at once when the factory throws, rejects, or is
  cancelled, otherwise at `close()` — or at retirement after a later projection
  fails — after every disposer of the service. Each receives a `DisposerContext`
  whose `reason` is `'factory-failed'`, `'no-service-disposer'`,
  `'service-disposed'`, or `'service-disposal-failed'`, describing the
  `withDisposal` on the returned value, so a disposer for a resource the returned
  value also releases can act only when that disposer did not. Failures are
  reported like `close()` disposer failures. New codes `DI_BAG_INVALID_CLEANUP`
  and `DI_BAG_CLEANUP_AFTER_FACTORY`; new exported type `DisposerContext`.
- `DiBag.fromSyncFactory(create, options?)` and `DiBag.fromAsyncFactory(create, options?)`
  ([#28](https://github.com/dany-fedorov/di-bag/issues/28)): `fromFactory` with
  `acquisitionMode: 'raw'` and `'nativePromise'` fixed by name, so a graph built
  from them runs on hosts without `process.getBuiltinModule` (browsers, workers)
  with no classifier. The compiler rejects a Promise, a union with a Promise
  member, or a thenable output on `fromSyncFactory` and a non-Promise output on
  `fromAsyncFactory` (family `portable-factory-output`). Both accept
  `{ context: 'acquisition' }`; an `acquisitionMode` option is rejected at
  compile time and with `DI_BAG_INVALID_FACTORY` at runtime. A Promise that is
  itself the service keeps `fromFactory(create, { acquisitionMode: 'raw' })`.
- A tested React/browser recipe in `examples/react` with a guide at
  `docs/guides/react-integration.md`
  ([#30](https://github.com/dany-fedorov/di-bag/issues/30)): an application
  runtime built once at bootstrap, project runtimes that borrow app services and
  own an exclusive lock, and a framework-free `RuntimeOwner` that starts,
  replaces, and closes runtimes from React effects — a replaced startup is never
  published, teardowns are serialized, a bounded wait reports its expiry to an
  explicit sink, and status is an external store for `useSyncExternalStore`.
  React is a development dependency only; the package remains React-free.

### Fixed and improved

- A `signal` kept after its bag closed no longer keeps the closed bag in memory.
  A `close()` without a cause now aborts with one shared `AbortError`, created at
  load, whose message names `DI_BAG_CLOSING`; before, each close created an
  `AbortError` whose stack retained the bag's scope and graph.
- A `close({ timeoutMs, signal })` that stops waiting while a failed factory's
  pushed disposers are still running lists that acquisition under
  `details.pending`.
- The [compiler benchmark guide](docs/benchmarks/typescript.md) states the
  single-expression ceiling from measurements
  ([#29](https://github.com/dany-fedorov/di-bag/issues/29)): classic TypeScript
  6.0.3 accepts 1,000 chained `register` calls and overflows V8's stack at 1,015,
  and accepts about 950 replacements; native 7.0.2 has no stack ceiling and reaches
  its memory budget near 1,100–1,400 calls. The guidance is at most 500 calls per
  expression. `npm run benchmark:compiler-ceiling` reproduces the search.
- `di-bag-graph` is unchanged at 0.1.0.

## 0.3.0

The API is pre-1.0; this release changes error message text and sealed module
types that 0.2.0 exposed, and ships agent documentation in the package.

### Breaking changes

- Every library-created error message now has the form
  `<code>: <message>; see https://dany-fedorov.github.io/di-bag/agent/errors.html#<code-slug>`.
  `code` and `details` are unchanged; code that matched message text must match
  the new text or branch on `code`.
- `DI_BAG_CLASSIFIER_REQUIRED` has new message text: `this host has no
  process.getBuiltinModule; configure DiBag.withConfiguration({ runtime: {
  isNativePromise } }) or give each automatic registration an explicit
  acquisitionMode`.
- Sealed module types no longer carry the module's private registrations.
  `buildModule` returns a `Module` whose exports, requirements, and public
  providers print as resolved object types, and whose lifetime state is a set of
  compact reach records. Private registration keys remain only as quoted string
  values of `consumer`, `root`, `export`, `group`, and `reach.key` fields, where
  host diagnostics use them. A private strict root or root contribution that
  captures a private scoped service is now rejected at `buildModule` instead of
  at the installing host's `build()`.
- Removed exported types: `LexicalContext`, `ModuleScope`, `Enclosed`,
  `RenamedContext`, `RenamedLifetimeObligation`, `EnclosedLifetimeObligation`,
  `RenamedLifetimeProviders`. Added: `LifetimeObligation`, `Reach`.
- The bare `di-bag` entry configures its native-Promise classifier on hosts that
  expose `process.getBuiltinModule` (Node, Bun, Deno), loading `node:util/types`
  at the first `build()` or `buildAndStart()` of a graph with automatic
  acquisition. Such graphs no longer throw `DI_BAG_CLASSIFIER_REQUIRED` there;
  it still fires on hosts without `process.getBuiltinModule` (browsers,
  workers). An explicit `withConfiguration({ runtime: { isNativePromise } })`
  still wins, the root entry still has no `node:` imports, and `di-bag/node`
  is unchanged.

### Added

- `buildModule(keys, { label })`: private bindings of each installation are
  labeled `<label>/<key>` in error messages, cycle paths, `inspectGraph()`, and
  observer events; nested labels compose as `outer/inner/key`. `ModuleOptions`
  type.
- `close({ timeoutMs?, signal? })` on bags, scopes, and forks bounds the wait for
  cleanup. It rejects with `DiBagCloseCancelledError` (`DI_BAG_CLOSE_TIMEOUT` or
  `DI_BAG_CLOSE_ABORTED`) whose `details.pending` lists unfinished disposers,
  `details.acquiring` lists acquisitions still draining, and whose
  `cleanupPromise` settles when cleanup finishes. `CloseOptions` and
  `CloseProgress` types. Malformed options reject with `DI_BAG_INVALID_CLOSE`.
- `di-bag-graph` 0.1.0 is published alongside this release as its own npm
  package (`tools/graph`).
  `npx di-bag-graph --check` fails CI on dependency cycles and unresolved names
  before any factory runs, including cycles and missing requirements that span
  modules installed from other files. It uses the project's TypeScript 6.0.3+
  compiler API when present, otherwise its own TypeScript 6.
- The package ships agent documentation: `AGENTS.md` (rules, module layout,
  per-module check command) and `docs/agent/` (`recipes.md` with six task
  recipes, `errors.md` with one section per `DI_BAG_*` code and per compile-time
  message family). Package `files` are `dist`, `AGENTS.md`, and `docs/agent`.
- The recommended module layout adds `check.ts` and a per-module
  `tsconfig.json` in each module directory, `src/app.check.ts`, and one
  `installModule` call per line in `src/app.ts`.
- The documentation site publishes `docs/agent/` at `/agent/`.
- `docs/agent/api-card.md` ships in the package: every runtime call (facade
  members, `Builder` and `Bag` methods, error classes) with its summary, the
  `DI_BAG_*` codes it can raise, and a type-checked example, plus a "one way per
  task" table. It is generated from JSDoc by `npm run docs:generate`, which
  refuses a runtime call without `@example`. Public runtime declarations name
  their `@throws` codes, and exported types link to their guide section with
  `@see`.
- `npm run docs:check` type-checks every TypeScript block in `AGENTS.md`,
  `docs/agent/`, and `@example` comments against the emitted declarations;
  enforces the size budgets of `AGENTS.md` (150 lines), recipes (under 60 lines
  each), and the API card (400 lines); keeps the layout copy in `AGENTS.md`
  identical to the modularity guide; checks that every `DI_BAG_*` code has an
  errors-page section; and resolves every documentation URL cited in `src/`.

### Fixed and improved

- Compile-time messages end with the errors-page section for their family, for
  example `required service registrations are missing: clock; see
  https://dany-fedorov.github.io/di-bag/agent/errors.html#missing-service`.
  Missing-service, root-capture, unknown-key (including `requires a finite
  tuple` and `token must match an existing binding contract`),
  structural-thenable, and contribution-incompatibility (`#unsatisfied-consumer`)
  messages carry their own section; `override value is not assignable to the
  original token` points at the new `#wrong-override` section. The unnamed wrong-shape message at `register`,
  `installModule`, and `replace` points at `#wrong-shape`, which says to call
  `verifyGraph()`; the same report from `verifyGraph()` points at
  `#unsatisfied-consumer`. Existing message text is unchanged up to the suffix,
  so prefix matches keep working; exact matches need the suffix. Measured cost:
  +85 instantiations in each 100-provider incremental case.

## 0.2.0

The API is pre-1.0; this release rejects some code that 0.1.1 accepted.

### Breaking changes

- A factory's dependency object now throws `DI_BAG_INVALID_DEPENDENCY_ACCESS`
  for `in`, `Object.keys`, spread, `JSON.stringify`, and descriptor reads instead
  of silently reporting an empty object. Destructuring and direct reads are unchanged.
- Plain and disposable factories, and `auto`-mode `fromFactory`, `fromFunction`,
  and `fromClass`, now reject declared outputs that are thenables but not Promises
  at compile time, such as query builders. Select an explicit `acquisitionMode`, or
  augment `DiBagPolicy` with `structuralThenables: 'allow'` to disable the check.
  The runtime rejection is unchanged.

### Added

- `builder.verifyGraph()` and the `CompositionReport<B>` type: a compile-time build
  verdict, with details, anchored at the call. Use `builder.verifyGraph() satisfies void;`.
- `bag.inspectGraph()` with `GraphSnapshot` and `BindingSnapshot`: every binding,
  contribution group, and observed dependency edge, without acquiring anything.
- The `DiBagPolicy` interface for project-wide compile-time switches.
- Missing-service, lifetime-capture, and unknown-key compile-time messages now name
  the services involved, for example `required service registrations are missing: clock`
  and `root lifetime cannot capture scoped dependency: db -> config`. Wrong-shape
  messages from `register`, `replace`, and `installModule` stay generic to keep
  compiler work within its measured limits; `verifyGraph()` reports their details.

### Fixed and improved

- The repository's `npm test` runs a fast runtime lane and a compiler lane, and
  compiler-driven tests share one TypeScript program.
- The repository includes `di-bag-graph` (`tools/graph`, not published), which
  extracts builder chains, declared named dependencies, module exports, lifetimes,
  cycles, and unresolved names into JSON.
- Tests now measure sealed module declarations. Emitted module declarations still
  name private registrations; see the [compiler scale notes](docs/benchmarks/typescript.md).
- Native TypeScript 7.0.2 reports one reviewed diagnostic-quality gap: it rejects a
  contextual `fromFactory` that returns a structural thenable with a generic
  overload message.

## 0.1.1

- Refresh the npm README with concise, self-contained package value and practical
  guidance for agentic development, LLM harnesses, and agent graphs.
- Keep detailed package guides while moving positioning research out of public
  documentation.
- No runtime or public API changes.

## 0.1.0

Release-candidate changes in this repository. This heading identifies the local
package version; it does not establish that the version has been published.
The API is pre-1.0 and includes breaking changes from earlier checkouts.

### Breaking changes

- Merge `ModuleBuilder` into a single `Builder`. `DiBag.createModuleBuilder()`
  and the `ModuleBuilder`, `BagBuilder`, and `ModuleContribute` types are removed;
  `DiBag.createBuilder()` returns a `Builder` that both builds bags and seals
  modules. Modules can now install modules.
- Consolidate builders, registration, configuration, metadata, and transformation
  APIs under descriptive names. For example, use `createBuilder`, `register`,
  `build`, and `createScope`. Compatibility aliases are not retained.
- Separate adding registrations from replacing them: `register` rejects
  duplicates, while `replace` checks the surviving consumers.
- Require explicit key selections for fork and scope overrides. Preserve exact
  builder histories and owned provider handles so structural narrowing or
  spreading cannot silently erase dependency or cleanup contracts.

### Added

- Immutable builders for named factories and typed tokens, with checks for
  declared dependencies, service contracts, and replacements.
- Reusable modules with private services, selected exports, and export renaming.
  Private dependency constraints remain checked after installation and replacement.
- Class and function adapters, optional and lazy token dependencies, lookup
  aliases, and ordered contributions resolved with `resolveAll`.
- Root, scoped, and transient lifetimes; tracked child scopes with selected
  sharing and overrides; independent forks for separate instances and cleanup.
  Root services reject scoped dependency capture unless explicitly allowed.
- Explicit disposal ownership with dependency-ordered cleanup. Transformations
  retain existing ownership, and cleanup failures preserve their original errors.
- Selected startup through `buildAndStart`, with parallel, sequential, or bounded
  scheduling, rollback on failure, and cooperative cancellation or timeouts.
  Acquisition contexts expose the owning scope's `AbortSignal`.
- Static and per-acquisition metadata through `withMetadata`, inspection without
  resolution, and lifecycle observers with a separate callback-error sink.
- `fromPlugin` for an application-selected descriptor with runtime output
  validation and optional disposal of the original acquired value.
- A portable `di-bag` entry and a `di-bag/node` entry with native Promise
  detection for Node and Bun. The package has zero runtime dependencies.
- Generated API reference, tutorials, server recipes, migration guides, and
  packed-package checks for Node, Bun, Deno, and a browser Worker.

### Fixed and improved

- Structured `DI_BAG_*` diagnostics, accurate cleanup failure counts and
  closed-bag messages, and clearer dependency paths in runtime and compiler errors.
- Iterative cleanup planning, faster immutable graph updates and module
  installation, and reduced retention of completed borrowed values. Some bulk
  construction and lookup costs increased; see the
  [performance evidence](docs/guides/development.md#performance-evidence).
- Reduced compiler work for registrations, tokens, and replacements, while
  retaining declaration and negative-diagnostic checks. Large fluent expressions
  still have limits; see the [compiler results](docs/benchmarks/typescript.md).
