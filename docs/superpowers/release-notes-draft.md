# Release notes draft

Pending entries for the next release. Move them into `CHANGELOG.md` when the
version is frozen.

## Breaking changes

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

## Added

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
- `di-bag-graph` is publishable as its own npm package (`tools/graph`).
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

## Fixed and improved

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
