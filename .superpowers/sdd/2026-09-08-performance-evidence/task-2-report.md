# Task 2: installed-archive runtime scenarios

Implemented the seven fixed runtime workloads at 10 and 100 providers, with
separate `prepareScenario`, `runTimed`, and `verifyScenario` phases. The child
loads `di-bag` (or the Node-only `di-bag/node` scenario) by bare specifier from
an offline-installed packed archive and reports its physical resolved entry.
The parent rejects output outside the real installed package, runs five fresh
warm-up children, and then retains 31 fresh sample children serially.

The current-only run is informational. It makes no comparative performance
claim. Its clone-safe rows retain package-relative resolved entries, the packed
archive SHA-256, exact Git/source/lock/fixture/tool/environment identities,
every raw nanosecond sample, and summary statistics in
`task-2-runtime-current.jsonl`. The incremental journal at
`docs/benchmarks/results/2026-09-08-ed083a1/runtime-current-raw.jsonl` retains a
run header and all 504 child executions before validating each child, so a late
failure cannot erase earlier or rejected evidence. Temporary paths are replaced
with explicit `$CONSUMER` and `$ARCHIVE_BUILD` markers.

Verification:

- Focused scenarios/protocol: 39 pass, 0 fail, 170 assertions.
- Classic typecheck: pass.
- Classic package build: pass (`task-2-build.log`).
- Native installed-package matrix: 2 pass, 0 fail, 1,152 assertions
  (`task-2-native-package.log`).
- Current runtime evidence: 14 informational rows, 434 retained samples and 70
  warm-ups; every row contains 31 samples, and the journal contains its header
  plus all 504 child executions (`task-2-runtime-current.jsonl`).
- Independent evidence validation: all 14 summaries and 505 journal rows parse;
  every scenario/size group has serial slots 0–35 with five warm-ups and 31
  samples (`task-2-evidence-validation.log`).

Two pre-sample command attempts exposed ESM direct-entry and `require.resolve`
assumptions. Both failed before producing timing rows. The final child uses a
consumer-anchored `createRequire`, and the complete matrix then exited zero.

Independent review found that the initial scope fixture used scoped linear
providers, transient verification observed factory-side values, row provenance
was incomplete, and output was buffered until the whole matrix completed. The
follow-up makes the linear scope chain root-owned, checks actual returned
root/scoped/transient identities, repeatedly resolves one transient key, adds
the complete provenance block, and journals each execution before validation.
