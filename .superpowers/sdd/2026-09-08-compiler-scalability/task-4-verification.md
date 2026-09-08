# Task 4 retained verification

The commands below ran serially. Exit status was 0 for every verification gate
and runnable example. Raw logs are stored beside this file.

| Gate | Retained log | Result |
| --- | --- | --- |
| package/archive suite | `task-4-package.log` | 175 tests, 713 assertions, 0 failures |
| `npm run check` | `task-4-check.log` | 746 tests, 3,989 assertions, 0 failures; classic typecheck/build passed |
| `npm run typecheck:native` | `task-4-typecheck-native.log` | exit 0 |
| `npm run build:native` | `task-4-build-native.log` | exit 0 |
| `npm run check:native` | `task-4-check-native.log` | 118 files, 657 expected, 630 matched, 27 declared gaps, 0 unexpected, 0 failures |
| focused compiler/work/native suite | `task-4-focused.log` | 25 tests, 144 assertions, 0 failures |
| post-review compiler/collector/work/native suite | `task-4-provenance-focused.log` | 51 tests, 263 assertions, 0 failures |

The full-check log includes both physical native-package emitter tests:
classic6 completed in 72.79 seconds and native7 in 59.06 seconds. The dedicated
pre-matrix physical run also passed 2 tests and 696 assertions in 140.03 seconds.
The independent reviewer repeated the physical classic/native package test on
committed source: 2 tests, 696 assertions, 0 failures in 139.32 seconds.

## Runnable examples

| Path | Status | Retained exact stdout |
| --- | ---: | --- |
| `examples/wbs-scope.ts` | 0 | `task-4-example-wbs-scope.log` |
| `examples/modules.ts` | 0 | `task-4-example-modules.log` |
| `examples/box-adapters.ts` | 0 | `task-4-example-box-adapters.log` |
| `examples/tokens.ts` | 0 | `task-4-example-tokens.log` |
| `examples/scopes.ts` | 0 | `task-4-example-scopes.log` |
| `examples/composition.ts` | 0 | `task-4-example-composition.log` |
| `examples/contributions.ts` | 0 | `task-4-example-contributions.log` |
| `examples/observers.ts` | 0 | `task-4-example-observers.log` |
| `examples/plugins.ts` | 0 | `task-4-example-plugins.log` |
