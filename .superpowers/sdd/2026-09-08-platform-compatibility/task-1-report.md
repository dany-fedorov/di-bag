# Task 1 report — platform tool and archive evidence primitives

Source checkpoint: `a113436e9e5f749455cfd86e464a6000f6e91bf1`.

## RED/GREEN evidence

The initial focused test was written before the evidence module. Its RED run
failed because `scripts/platform-evidence.ts` did not exist:

```text
$ bun test tests/platform-evidence.test.ts
Cannot find module '../scripts/platform-evidence.ts'
0 pass, 1 fail, 1 error
```

The final focused suite covers exact version/hash probes, incomplete pins,
missing executables, all explicit unavailable rows, hostile child status,
signals, stderr, malformed/noncanonical/extra output, lane mismatch and result
mismatch. Archive tests reject multiple tarballs, stderr, unsafe filenames,
missing package documents, every missing declared JavaScript or declaration
export, absent/mutated archives, stale hashes and stale file inventories. A
real integration test copies the package inputs, builds them with the pinned
classic compiler, packs with the pinned npm CLI, and validates the resulting
archive and hash.

```text
$ bun test tests/platform-evidence.test.ts
10 pass
0 fail
91 expect() calls
```

The direct process gates run outside managed child-process interception. A
sandboxed diagnostic run returned synthetic `EPERM` child results for the
script-backed npm and TypeScript probes; the unrestricted focused run exercised
the actual pinned programs.

## Exact offline tool probe

| Tool | Result | Exact version |
| --- | --- | --- |
| Node | pinned | 24.20.0 |
| npm CLI | pinned | 11.19.0 |
| classic TypeScript | pinned | 6.0.3 |
| Bun | pinned | 1.4.0 |
| Deno | unavailable: not-provisioned | — |
| esbuild | unavailable: not-provisioned | — |
| Playwright | unavailable: not-provisioned | — |
| Chromium | unavailable: not-provisioned | — |

The unavailable tools were not downloaded. Because esbuild and Playwright had
no actual offline version or executable to pin, `package.json` and
`package-lock.json` remain unchanged.

## Redundant foundation gates

```text
$ npm run typecheck
exit 0

$ npm run build
exit 0

$ bun test tests/native-package.test.ts
2 pass
0 fail
1,152 expect() calls
Ran 2 tests across 1 file. [158.03s]
```

## Files

- `tools/platform-versions.json`
- `scripts/platform-evidence.ts`
- `tests/platform-evidence.test.ts`
- `docs/superpowers/plans/2026-09-08-platform-compatibility.md`
- `.superpowers/sdd/2026-09-08-platform-compatibility/task-1-report.md`

## Remaining scope

Task 1 establishes evidence primitives only. Deno consumers and browser lanes
remain Tasks 2 and 3, and the evidence command/result summary remains Task 4.

## Independent review fix round

Review found three false-certification paths. Tests first reproduced each one:
an owned JSON `__proto__` field disappeared during canonicalization; a working
but unrelated `versionArgv` could certify an absent runtime in `argv`; and
plain text bytes could pass archive validation when paired with their own hash
and fabricated file inventory.

Canonical JSON now uses null-prototype accumulators and rejects unexpected
`__proto__` fields at root and nested levels. A version command must extend the
exact invocation argv, and the invoked runtime and hashed tool artifact must
both exist before probing. Archive validation now decompresses gzip internally,
validates tar magic, headers, checksums, entry bounds, termination, paths and
duplicates, and checks claimed plus required exports against the actual tar
inventory. This avoids relying on an additional unpinned system `tar` tool.

The focused review-fix RED run had three failing tests for those three paths.
Re-review then reproduced a PAX path-override bypass in the tar inventory.
Another RED/GREEN mutation now supplies a standards-shaped PAX header that
renames the following raw entry. The checker accepts only regular files and
directories and rejects metadata, links and other entry types rather than
silently misinterpreting them.

The GREEN run is superseded by the final 10-test, 91-assertion result above;
classic typecheck and build also exited zero after the fixes.

## Exact-evidence hardening round

A later review required canonical child bytes, a closed archive allowlist,
exact compiler/npm invocation and strict row provenance. New RED mutations
showed that reordered root and nested keys were accepted; archive claims and
bytes could each contain extra files; package documents could differ from the
isolated inputs; tar data after the terminator was ignored; `packIsolatedClassic`
could substitute the separately supplied Node runtime; and abbreviated SHAs or
noncanonical/invalid timestamps could select evidence directories.

The evaluator now requires `stableJson(actual) + "\\n"`. Archive validation
derives the complete allowlist from the fresh `dist` tree plus the three package
documents, requires claimed and actual inventories to equal it in both
directions, rejects source/test/credential files, rejects nonzero tar trailers,
parses the archived package manifest and compares package document bytes to the
isolated inputs. Build and pack run through the exact verified `classic6` and
`npm` argv after enforcing their common pinned Node runtime. Evidence rows
require a lowercase 40-character Git SHA and an exactly round-trippable UTC ISO
timestamp.

Final verification:

```text
$ bun test tests/platform-evidence.test.ts
10 pass, 0 fail, 91 expect() calls

$ npm run typecheck && npm run build && git diff --check
exit 0
```

The native archive suite was not repeated in this round because no `src`,
package manifest, lockfile or compiler dependency changed; its fresh
2-test/1,152-assertion result above remains applicable to the same package
source.
