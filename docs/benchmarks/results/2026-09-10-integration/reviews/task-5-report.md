# Task 5 report — archive checksum path validation repair

## Status

DONE

Base: `da6ec93ad13ce457e07318138bd0e1c080e19eb7`

Commit: `0b54fff` (`fix: allow canonical integrity digests in public evidence`)

## Root cause and implementation

`assertPublicPathSafe` recursively treated every string alike. A valid SHA-512 SRI payload can contain `+/`; because `/` follows `+`, `containsAbsolutePath` interpreted that substring as the beginning of an absolute path and rejected otherwise valid public evidence.

The repair carries the public projection path through recursive validation. It bypasses the absolute-path heuristic only at `packages[number].integrity` and only when the value has the exact canonical shape for one 64-byte SHA-512 SRI digest: `sha512-`, 86 canonical base64 characters, and `==` padding. Keys, command values, other public fields, and nested values continue through the existing absolute-path check.

The regression uses this fixed valid SRI value:

`sha512-/ul7PV5WpdFxqftO2GgDAni9hloVlI9rKAlfydsKkI3FuovS7AqB4EeIU5G+/2I/lYfvhH3nNnhmxKUBek00zQ==`

Its payload is 88 characters, decodes to 64 bytes, round-trips to the same base64 text, begins with `/`, and contains `+/`. The test also proves that `sha512-+/etc/secret` remains rejected in the package integrity slot and that an absolute path under a nested metadata key named `integrity` remains rejected.

## TDD evidence

RED, before production code:

```text
bun test tests/release-artifacts.test.ts -t 'allows canonical SHA-512 SRI only in package integrity fields' 2>&1 | tee /tmp/di-bag-task-5-red.log
```

Result: the new test failed at `assertPublicPathSafe` with `public evidence contains an unsanitized absolute path`; `0 pass`, `1 fail`, `89 filtered out`. The shell pipeline itself returned zero because `pipefail` was not enabled, while Bun's captured output records the expected test failure. A direct immediate rerun returned exit 1 during fixture setup because the failed run left `/tmp/di-bag-release-candidate/task2-test-2`; that generated test directory was removed before GREEN.

GREEN, after the production change:

```text
bun test tests/release-artifacts.test.ts -t 'allows canonical SHA-512 SRI only in package integrity fields'
```

Result: exit 0; `1 pass`, `0 fail`, `89 filtered out`, `3 expect() calls`.

File-level verification:

```text
bun test tests/release-artifacts.test.ts
```

Sandboxed attempts reached `74 pass` and then hit `spawnSync node EPERM` in the archive-verifier compiler version setup. The same exact command was rerun outside that process sandbox and completed with exit 0: `90 pass`, `0 fail`, `422 expect() calls`. This includes the existing `sha512-bad` static-verifier mutation, all absolute command/path controls, all digest checks, and the real archive consumer/declaration oracles.

Typechecks:

```text
npm run typecheck
npm run typecheck:native
```

Both exited 0 (`tsc6 -p tsconfig.json` and `tsc -p tsconfig.json`).

Diff validation:

```text
git diff --check -- scripts/create-release-manifest.ts tests/release-artifacts.test.ts
```

Result: exit 0 with no output.

## Changed files

- `scripts/create-release-manifest.ts`
- `tests/release-artifacts.test.ts`

## Self-review

- Scope is restricted by both structural path and canonical SRI shape; arbitrary strings containing `sha512`, plus/slash text, and nested keys named `integrity` are not exempted.
- Existing command sanitization still calls `containsAbsolutePath` directly and therefore cannot inherit the package-integrity exception.
- Existing path-key validation remains unscoped, so unsafe object keys are still rejected.
- The static verifier still recomputes and compares archive `sha256`, `sha512`, and SRI integrity values. The existing path-free malformed-integrity mutation ran and passed in the file-level suite.
- Removing the new package-integrity exception reproduces the observed regression failure; broadening the exception to key name alone would fail the nested metadata control.

## Concerns

None. The only anomalous runs were caused by the managed process sandbox blocking nested compiler spawning; the identical file-level command passed outside that sandbox.
