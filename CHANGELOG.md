# Changelog

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
