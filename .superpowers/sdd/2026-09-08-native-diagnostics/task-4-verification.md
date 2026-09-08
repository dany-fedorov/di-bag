# Task 4 retained verification

All compiler-heavy commands ran serially under
`/tmp/di-bag-compiler-heavy.lock`. Expected strict-parity and selected native
failures are retained as evidence rather than converted to passing outcomes.

| Gate | Retained log | Outcome |
| --- | --- | --- |
| classic 100 replacement wrong-shape | `task-4-classic-100-replacement-wrong-shape.log` | accepted at line 152 with useful message |
| classic 500 replacement wrong-shape | `task-4-classic-500-replacement-wrong-shape.log` | accepted at line 752 with useful message |
| native 100 replacement wrong-shape | `task-4-native-100-replacement-wrong-shape.log` | expected exit 1: useful message missing at line 152 |
| native 500 replacement wrong-shape | `task-4-native-500-replacement-wrong-shape.log` | expected exit 1: useful message missing at line 752 |
| strict audit | `task-4-strict-audit.log` | expected exit 1: 68/95 primaries, 27 gaps, 1/1 supplements |
| focused source/work/marker suite | `task-4-focused.log` | 133 tests, 482 assertions, 0 failures |
| native contract audit | `task-4-check-native.log` | 121 files, 660 expected, 633 matched, 27 declared gaps, 0 failures |
| native strict typecheck | `task-4-typecheck-native.log` | exit 0 |
| native declaration build | `task-4-build-native.log` | exit 0 |
| box/archive package suite | `task-4-box-package.log` | 113 tests, 313 assertions, 0 failures |
| token/reflection package suite | `task-4-token-package.log` | 12 tests, 60 assertions, 0 failures |
| core package suite | `task-4-package.log` | 77 tests, 495 assertions, 0 failures |
| physical classic/native package suite | `task-4-native-package.log` | 2 tests, 1,152 assertions, 0 failures |
| full repository gate | `task-4-check.log` | 780 tests, 4,632 assertions, 0 failures; typecheck/build pass |
| repeated strict audit | `task-4-strict-audit-repeat.log` | expected exit 1: unchanged 68/95 and 27 gaps |

The recomputed production-source SHA-256 is
`90d656f628878dd926da736db2ce4781f9763e9d5fdc0f6834ae0128f475c198`,
identical to the final 108-row compiler-scalability evidence. No source or
generator file changed after that collection.

Each runnable example has an exact stdout log named
`task-4-example-<name>.log`; all nine commands exited zero.
