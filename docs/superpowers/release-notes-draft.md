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
- `npm run docs:check` type-checks every TypeScript block in `AGENTS.md`,
  `docs/agent/`, and `@example` comments against the emitted declarations;
  enforces the size budgets of `AGENTS.md` (150 lines), recipes (under 60 lines
  each), and the API card (400 lines); keeps the layout copy in `AGENTS.md`
  identical to the modularity guide; checks that every `DI_BAG_*` code has an
  errors-page section; and resolves every documentation URL cited in `src/`.

## Fixed and improved
