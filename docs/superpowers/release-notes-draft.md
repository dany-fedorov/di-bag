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

## Fixed and improved
