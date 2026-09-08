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
9 pass
0 fail
64 expect() calls
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
