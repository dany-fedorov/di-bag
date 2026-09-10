# API renaming decisions and assumptions

The user requested all planned renaming/refactoring, documentation, push, and
merge to main, with assumptions recorded and no questions. This supersedes the
older native-metadata plan's no-merge constraint. Scope is the complete
[API renaming plan](../../api-renaming-plan.md), including consolidation,
diagnostics, source comments, current guides, examples, declarations and scale
verification. Earlier enterprise plans and historical evidence remain historical.

## Decisions

- Make a breaking API migration with no deprecated aliases. This pre-1.0 change
  keeps one preferred form; document every removed public name in migration notes.
- Use `withMetadata(provider, { static?, dynamic? })`, requiring at least one
  level. Dynamic `mode` is mandatory (`direct` or `awaited`) and `describe` returns
  a synchronous plain record. Preserve exact/direct and awaited Promise semantics,
  ownership stages, static collision checks and ordered metadata presence frames.
- Use only `transformService(provider, { mode, transform, acquisitionMode? })`.
  Direct mode defaults its output acquisition policy to `auto` and accepts `raw`
  or `nativePromise`. Awaited mode always introduces a native Promise stage;
  an output acquisition override is rejected there.
- Consolidate `fromTokens` into strict `fromFunction`. Selected but unused
  dependencies remain in the tuple and are written as explicit unused callback
  parameters, including existing fixtures; never erase dependencies to pass tests.
- Consolidate `factory` and `withContext` into `fromFactory(callback, options?)`.
  `context: 'acquisition'` selects the two-argument callback. Default acquisition
  is `auto`; explicit `raw` and `nativePromise` preserve their contracts. Context
  allocation is opt-in, independent of callback arity.
- Consolidate `add`/`bind` into named-object and typed-token `register` overloads
  on application and module builders. Preserve exact generic inference/checks.
- Consolidate immutable facade configuration into
  `withConfiguration({ runtime?, observers? })`, with observers an ordered readonly
  array of ObserverOptions appended after inherited observers. Omitted runtime
  retains the parent configuration. Empty options produce an equivalent facade.
- Adopt all preferred method/field/type names in the plan, including optional
  `installModule`, `DiBagPluginValidationError`, and internal class renames.
  Retain the explicitly distinct APIs and domain names listed in the plan.
- Replace the type-only `fromPlugin` export with `PluginProviderFactory`.
  Document Provider generic parameters, retaining helper types needed by emitted
  consumer declarations. Do not rename every internal helper for stylistic reasons.
- Library-created runtime errors receive stable `DI_BAG_*` codes and frozen
  structured details. Original application exceptions remain identical, with
  causes retained in existing startup/cleanup wrappers. Correct disposal callback
  counts, closed-state wording, full reentrant cycle paths, and misleading type
  diagnostics; compute richer relationship details only on failing type branches.
- Retain the existing 0.1.0 release-candidate version and update its changelog
  entry in place; version selection and npm publication remain separate release work.
- Keep the standalone root/node package and existing runtime/compiler/platform
  contracts. Do not publish an npm release; push and merge are authorized.

## Integration assumptions

Main advanced to `fb5fe6c` during local publication review. Preserve its persistent
graph and module storage, acquisition retention fixes, compiler projection caches,
and synchronized process-supervisor checks while adopting the renamed API.
Preserve numeric startup scheduling added on main: `startupOrder` accepts
`parallel`, `sequential`, or a positive safe integer. Numeric bounds limit selected
readiness waits; provider dependency fanout remains independent. Keep the new
compiler ceilings and run the Node garbage-collection retention suites after
both compiler builds. Historical benchmark sources and logs keep the API names
that were measured; record combined-source verification separately.

## Verification

Runtime tests cover both metadata modes and transformation result policies,
static/dynamic composition, retries, scopes, tokens, ownership, configuration,
registration and all diagnostic fixes. Both compiler suites cover inference,
negative admission and emitted declaration consumers. Run full check, native
contracts, Node runtime-scale regressions, examples, docs generation/check/build,
release/package checks and applicable compiler-scale/platform checks. Inspect
remote checks and merged main before declaring completion.
