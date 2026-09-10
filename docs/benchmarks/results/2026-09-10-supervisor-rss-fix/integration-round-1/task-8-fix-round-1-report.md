# Task 8 integration fix round 1: prove task-group exit before zombie state

## Source, historical failures and provenance

Worktree `/tmp/di-bag-performance-integration`, branch `fix/persistent-graph-performance`, BASE `3e9720e970f1fcc20e42105bed6ba6d02261d89e`. The prior Task 8 report and evidence are unchanged. This round owns only `scripts/native-process.ts`, `tests/native-process.test.ts`, a diagnostic-only field in `scripts/verify-release-artifacts.ts`, and this evidence directory.

Both GitHub runs 34442849869 (pull_request) and 34442847927 (push) failed at exactly BASE: 926 pass, 1 fail out of 927. Their original failure logs and independently fetched metadata are retained here. The archive verifier's positive classic6 CTS compiler commands returned status 0, signal null, empty stderr, but termination reason `monitor`. The wrapper omitted `result.error`, so these logs do **not** prove which monitor branch fired. The error-only wrapper change now retains that field without changing acceptance, command argv, limits or output handling.

The supervisor is not stale archive code. `tests/release-artifacts.test.ts` directly imports `../scripts/verify-release-artifacts.ts`, which directly imports `./native-process.ts`. The temporary checkout path in the failing argv identifies the compiler executable and consumer files, not the executing supervisor module. The physical test copies source, fixtures and configuration for package construction, then calls the already imported verifier. Both historical CI heads contain the reviewed Task 8 helper. This provenance rules out the temporary checkout pathname as evidence of an older supervisor.

The library `src` tree remains `87655e8e10b85de67f8c57a7ccf71b3e91b63755`. Diff against BASE is empty for `src`, package/dependency manifests, release tests and package tests. No public type, runtime, compiler setting, workflow, fixture, admission criterion or worker limit changed.

## Root cause investigation and real observations

The previous helper accepted a fresh state Z/X or PID disappearance. That still misses an earlier irreversible exit phase. The pinned Linux v6.8 sources supplied by the controller show `do_exit` sets task flag `PF_EXITING` (0x00000004), clears `current->mm` during `exit_mm`, and reaches `exit_notify` / `EXIT_ZOMBIE` later. `/proc/PID/status` omits memory fields when `get_task_mm` returns null; `/proc/PID/stat` exposes task flags in field 9. See [the retained primary-source note](linux-exit-lifecycle-notes.md) for exact upstream links and the distinction between task exit and whole-group exit. The local kernel was Linux 7.0.11-76070011-generic; the CI kernel was not established.

Observation sequence:

- Twenty ordinary Node children with 256 MiB retained buffers did not expose the gap at the unchanged 20ms sampling interval (`exit-observe.log`); this is a negative observation, not evidence the gap cannot occur.
- Four real Python `os._exit(0)` children after 256 MiB allocation produced roughly 1,900–2,400 synchronous State R / missing-VmRSS snapshots each, with flags 4194316 (PF_EXITING set), before clean exit and exact stdout/stderr. The original 12,079,697-byte raw snapshot log is preserved losslessly as `exit-snapshot.log.gz`. `python-exit-observe.log` records ordinary supervisor observations; there was no claim that all these unprimed 20ms runs failed.
- Node `process.exit`, `process.reallyExit` and single-threaded-flag probes sometimes exposed the gap but also showed a zombie leader with two remaining threads. Therefore requiring one thread, or trusting a zombie leader alone, would be incorrect.
- `/bin/bash` retains a 64 MiB shell variable until native exit and reliably exposes the actual pre-zombie phase without Python or a C compiler in the regression suite. `observe-kernel-exit.mjs` is a standalone reproducible timing probe. Its command was `flock /tmp/di-bag-compiler-heavy.lock node docs/benchmarks/results/2026-09-10-supervisor-rss-fix/integration-round-1/observe-kernel-exit.mjs > .../kernel-exit-timed.log 2>&1`. Exit 0 produced 693 observed pre-zombie samples over 4.021ms; exit 2 produced 655 over 3.538ms. Complete initial status records, per-thread stat records and exact clean output/status are retained. These are observed windows, not universal timing guarantees.
- A real Bun worker continued running and allocating after its thread leader invoked libc `pthread_exit`. The old helper trusted the leader's Z state and waited until the 3000ms timeout. This exposed a pre-existing live-worker monitoring gap that a leader-only PF_EXITING fix would preserve.

The new real exit 0/2 regressions prime one missing-RSS sample at the existing read boundary, then synchronously observe and return an actual State R / missing-VmRSS snapshot with PF_EXITING set. The supervisor's independent fresh reads remain real. On BASE, both retain exact exit status and streams but falsely report `monitor`. The live-worker regression instead expects immediate monitor failure and reaping; BASE gives `timeout`. `red.log` records all three failures. These establish actual lifecycle defects consistent with the CI symptoms; because the historical wrapper omitted the error, the exact branch/interleaving in each hosted failure remains unproven.

## Technical decision and preserved invariants

Independent exit proof now enumerates `/proc/PID/task`, parses a fresh complete stat record for each thread, and requires PF_EXITING for every proven thread. A final independent enumeration must be nonempty, include the proven leader and contain only proven-exiting TIDs. A new/unverified remaining thread, empty listing, malformed stat, permission failure or live thread remains fail-closed. A task stat read returning ENOENT or ESRCH is accepted only if that TID is absent from the final listing. If the process directory becomes unreadable, a fresh PID probe must independently return ESRCH; unreadability alone proves nothing. Observed child exit events remain trusted.

This is sufficient because PF_EXITING is irreversible and a thread in that phase cannot return to userspace and create more threads or allocations. Proving every remaining thread avoids exempting a live worker behind a dead leader. The stat parser handles unescaped comm names by locating the final `)`, verifies the expected PID, requires a full record and valid state, and accepts only canonical decimal flags within unsigned 32-bit range. Arbitrary missing RSS is never treated as exit evidence.

Timeout, sampling interval, RSS ceiling, combined output cap, exact byte-bound UTF-8 handling, first missing-sample grace, pending-read drainage, close-event stream drainage and reaping remain unchanged. Exit proof does not set the JS exited flag or disable the timeout. Fresh task enumeration/stat reads occur only on exceptional monitor paths. The added test prerequisite is the existing Linux environment with `/bin/bash` and Bun FFI access to `libc.so.6`; the real leader/worker test is mandatory, not conditionally skipped.

## RED/GREEN and validation ledger

All test commands ran in the worktree on the already authorized host execution path, since the original Task 8 sandbox fault was established and retained in its existing report. All compiler-heavy work and real lifecycle probes were serialized with `flock /tmp/di-bag-compiler-heavy.lock`. No controller heavy load competed.

- `bun test tests/native-process.test.ts -t 'kernel releases memory|thread leader exits'`: 0 pass, 3 fail, 22 filtered; `red.log`, exit 1. Supervisor implementation was exactly BASE; only new tests and the wrapper diagnostic field existed.
- Initial group-proof implementation: 26 pass, 0 fail, 145 assertions; `green.log`, exit 0.
- Additional proof-boundary controls initially failed their interception assertion because a default `fs` import did not intercept ESM named bindings. Preserved `proof-controls-binding-attempt.log`; this is test harness evidence, not product RED. Using the actual `node:fs` ESM namespace made all five controls pass (`proof-controls.log`).
- The pre-ESRCH final run passed 31 tests / 165 assertions; both typechecks, 90 release tests and 2 package tests also passed. These logs remain as `before-esrch-*`. The tested helper's SHA-256 was `259deba4600a61af5b29623e69cf3fe9c5116d4a511b40bf4a498a1de851f892`; package command finished before the helper changed (95.66s wall).
- Self-review identified the same proc disappearance semantics on the new per-thread stat path. `bun test tests/native-process.test.ts -t 'departed thread'` proved ENOENT accepted but ESRCH incorrectly killed the real child before expected exit 2 and streams: 1 pass, 1 fail (`departed-thread-red.log`, exit 1). The final fix treats both codes alike only when the final enumeration independently proves absence.
- Frozen final source: `bun test tests/native-process.test.ts`: 33 pass, 0 fail, 175 assertions (`green-final.log`, exit 0). This includes both original Task 8 regressions, original Task 6 races, all live failure/resource/drain/reaping controls, real pre-zombie exit 0/2, real leader/live-worker, strict parser, empty/new/unproven/permission/malformed group controls, and both disappeared-thread codes.

Final classic typecheck passed in 7.10s, native typecheck in 1.00s, and the full release suite passed 90 tests / 388 assertions in 19.13s, all exit 0. The final full package suite passed 2 tests / 1206 assertions in 98.09s wall (classic6 57.20s, native7 40.67s), exit 0; whole-command maximum RSS was 2,982,080 KiB. This is a validation run, not a compiler-performance comparison or a worker-limit change. Each command uses `flock /tmp/di-bag-compiler-heavy.lock /usr/bin/time -v` with `npm run typecheck`, `npm run typecheck:native`, `bun test tests/release-artifacts.test.ts`, or `bun test tests/native-package.test.ts`, respectively. Final logs have unprefixed names.

## Frozen code and historical log SHA-256

- `scripts/native-process.ts`: `84a7dec43ac3d6cc92f5d8f1a069b5543c95230852f8a79962959e9a075d41b9`
- `scripts/verify-release-artifacts.ts`: `5611fe145a33a07f8475ba6f1ec60d571d723891fb5ed43148332e11160f2267`
- `tests/native-process.test.ts`: `e1f6a205c1c527e390521a34437e684b22855d821ad76710560d7aa9333c8b27`
- `ci-34442849869-failure.log`: `69078f97930edb0bca5279b5ebaf714fc41a9c9e9e7109790529781218bfd309`
- `ci-34442847927-failure.log`: `ce8360bce088749fc9b82ad1cf078b227f0ae41d57e8c06329bc470008477965`

Implementation whitespace checks pass. The raw CI logs intentionally preserve their original whitespace and bytes. Source identity and exact changed-file inventory are checked again before commit. The root controller owns independent review, publication, hosted CI and merge; this worker does not publish.


## Completion and exact inventory

Status: DONE for this bounded implementation and local verification wave. All required final gates passed on the frozen code hashes above. `git diff HEAD -- src package.json package-lock.json tests/release-artifacts.test.ts tests/native-package.test.ts` is empty at the BASE head. The exact modified/added files are recorded in `changed-files.txt`; the three implementation/test files are the only changes outside this evidence directory. The ignored controller report is an identical copy at `.superpowers/sdd/2026-09-10-performance-completion/task-8-fix-round-1-report.md`.

Self-review checked whole-thread-group proof, both disappearance codes, nonempty final evidence, malformed/permission failure, strict parsing, unchanged limits and lifecycle cleanup. Final implementation whitespace checks pass. Raw CI whitespace is retained for byte identity. No source/library/performance-workload changes, publishing or merge occurred. The controller must independently review this new commit and run hosted CI; the opaque prior positive-command failures are not retrospectively relabeled as proven missing-RSS errors.
