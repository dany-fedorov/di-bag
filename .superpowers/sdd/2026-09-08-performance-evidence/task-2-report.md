# Task 2: installed-archive runtime scenarios

Implemented the seven fixed runtime workloads at 10 and 100 providers, with
separate `prepareScenario`, `runTimed`, and `verifyScenario` phases. The child
loads `di-bag` (or the Node-only `di-bag/node` scenario) by bare specifier from
an offline-installed packed archive and reports its physical resolved entry.
The parent rejects output outside the real installed package, runs five fresh
warm-up children, and then retains 31 fresh sample children serially.

The current-only run is informational. It makes no comparative performance
claim. Its clone-safe rows retain package-relative resolved entries, the packed
archive SHA-256, source identity, every raw nanosecond sample, and summary
statistics in `task-2-runtime-current.jsonl`.

Verification:

- Focused scenarios/protocol: 36 pass, 0 fail, 144 assertions.
- Classic typecheck: pass.
- Classic package build: pass (`task-2-build.log`).
- Native installed-package matrix: 2 pass, 0 fail, 1,152 assertions
  (`task-2-native-package.log`).
- Current runtime evidence: 14 informational rows, 434 retained samples and 70
  warm-ups; every row contains 31 samples (`task-2-runtime-current.jsonl`).

Two pre-sample command attempts exposed ESM direct-entry and `require.resolve`
assumptions. Both failed before producing timing rows. The final child uses a
consumer-anchored `createRequire`, and the complete matrix then exited zero.
