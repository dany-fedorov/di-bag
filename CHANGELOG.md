# Changelog

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
