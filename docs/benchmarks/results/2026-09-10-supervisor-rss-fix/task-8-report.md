# Task 8: confirm process exit after missing-RSS samples

## Source and scope

Checkout `/tmp/di-bag-performance-integration`, branch `fix/persistent-graph-performance`, BASE `2dbcc30836b84c6dbeb5ceefc8ce5f5f0554bd29`.
Only implementation changes are `scripts/native-process.ts` and `tests/native-process.test.ts`. Supporting evidence is confined to this directory; the ignored controller report is copied to `.superpowers/sdd/2026-09-10-performance-completion/task-8-report.md`.

The BASE `src` Git tree is `87655e8e10b85de67f8c57a7ccf71b3e91b63755`. `git diff HEAD -- src tests/release-artifacts.test.ts tests/native-package.test.ts package.json package-lock.json` is empty. Runtime, public types, fixture scope, compiler selection, package admission, worker limits and release tests are unchanged.

## Observations, hypothesis and reproduction

CI run 34441303410 at the BASE above failed with 922 pass / 1 fail. Its archived raw log `ci-34441303410-failure.log`, line 587, records the release verifier's `native7/cts/classic6` negative program returning status 2, signal null, both expected diagnostics matched, but termination reason `monitor` and error `VmRSS is missing`. The root controller independently confirmed the run's exact head through GitHub.

CI run 34441306074 also failed with 921 pass / 2 fail. Archived `ci-34441306074-failure.log`, line 587, records the equivalent `classic6/cts/classic6` negative-program failure; line 759 records a classic package-emitter build with status 0, signal null, and the same missing-RSS monitor failure. The controller independently confirmed the same BASE head via GitHub; exact run metadata is retained in `ci-34441306074-metadata.json` (pull_request event).

The sampler previously handled its second missing-RSS result by trusting the state in that asynchronous sample. The ENOENT/ESRCH error path already used independent, fresh kernel state. A non-zombie snapshot can predate the child's exit by the time its promise continuation runs. A real zombie still answers `kill(pid, 0)`, while the JS exit callback has not yet run. Thus neither the old sample nor PID existence is sufficient to classify the process as live.

Two regression cases use real Node children, pipes, exit statuses 0 and 2, and Linux `/proc`. The injected read boundary removes VmRSS from two real non-zombie snapshots. During the second read, JS event dispatch is blocked until the actual child reaches State Z; a real successful PID probe proves the existence check alone cannot distinguish this state. The stale snapshot is then returned to the real supervisor. Both regressions fail on BASE with correct exact streams/status but termination reason `monitor`. This establishes the missing-RSS stale-sample bug; the historical CI logs do not expose their precise kernel snapshots, so they cannot prove the exact scheduling of every historical failure.

## Fix and invariants

A local `hasExited` helper reuses the existing exceptional-path logic: trust an observed child exit event, an ESRCH PID probe, or fresh synchronous `/proc/PID/status` state Z/X. If the fresh path cannot be read, only ESRCH from a second PID probe confirms disappearance. A malformed state, permission failure or other unconfirmed failure remains fail-closed for a live child.

The second missing-RSS sample now uses this independent confirmation, as do ENOENT/ESRCH errors. Missing fields alone never imply exit. A live child without valid RSS is still terminated on sample two; EIO/EACCES still terminate immediately. Added live EACCES and malformed VmRSS controls pass. The first-missing-sample grace, sampling interval, timeout, memory and combined output limits, UTF-8 byte bound, exact exit status and streams, pending-sample drainage, pipe-close wait and reaping are unchanged. Existing real-zombie ENOENT/ESRCH, delayed sample cleanup, inherited pipes, spawn failure and resource-limit tests pass.

## RED/GREEN evidence and commands

All paths below are relative to this directory. Commands ran in the checkout above. Actual child-process checks use approved normal host execution after a preserved sandbox failure; heavy commands run serially under `/tmp/di-bag-compiler-heavy.lock`.

- `bun test tests/native-process.test.ts -t 'after stale non-zombie status'` initially failed in the sandbox because the existing Node executable lookup returned an empty path (`red-sandbox.log`). This is environmental evidence, not RED.
- The same command on the host failed both new assertions on BASE with received `monitor`, after exact status/streams matched (`red.log`, exit 1).
- Initial fixed-suite attempt had one failure (`green-attempt-1.log`); temporary tracing (`probe-diagnostic.log`) showed correct fresh State Z confirmation, followed by the test's own `Expected a live snapshot` error on a legitimate third read. The test now injects only its first two snapshots and permits subsequent genuine reads. No diagnostic tracing remains in implementation.
- Reverted only the implementation to BASE and reran the refined filter: 0 pass, 2 fail, 20 filtered, 8 assertions (`red-refined.log`, exit 1). Both fail on the intended monitor assertion.
- Restored the fix; `bun test tests/native-process.test.ts`: 22 pass, 0 fail, 117 assertions (`green.log`, exit 0).
- `flock /tmp/di-bag-compiler-heavy.lock /usr/bin/time -v npm run typecheck`: exit 0, 6.39s wall (`typecheck-classic.log`).
- `flock /tmp/di-bag-compiler-heavy.lock /usr/bin/time -v npm run typecheck:native`: exit 0, 0.90s wall (`typecheck-native.log`).
- `flock /tmp/di-bag-compiler-heavy.lock /usr/bin/time -v bun test tests/release-artifacts.test.ts`: 90 pass, 0 fail, 388 assertions, 18.07s wall (`release-green.log`, exit 0), including the real physical archive/declaration verifier that failed in CI.

- `flock /tmp/di-bag-compiler-heavy.lock /usr/bin/time -v bun test tests/native-package.test.ts`: 2 pass, 0 fail, 1206 assertions, 97.02s wall (`package-green.log`, exit 0). Classic6 55.99s, native7 40.79s; whole-command maxRSS 2,214,996 KiB. Added to verification after the controller supplied the second real CI package-build failure; package tests remain unchanged.

## Exact changed files

Implementation and regression files:

- `scripts/native-process.ts`
- `tests/native-process.test.ts`

Added evidence files (all under `docs/benchmarks/results/2026-09-10-supervisor-rss-fix/`):

- `ci-34441303410-failure.log`
- `ci-34441306074-failure.log`
- `ci-34441306074-metadata.json`
- `green-attempt-1.log`
- `green.log`
- `package-green.log`
- `probe-diagnostic.log`
- `red-refined.log`
- `red-sandbox.log`
- `red.log`
- `release-green.log`
- `task-8-report.md`
- `typecheck-classic.log`
- `typecheck-native.log`

The ignored controller report duplicates this document at `.superpowers/sdd/2026-09-10-performance-completion/task-8-report.md`. `git diff HEAD^ HEAD --check -- scripts/native-process.ts tests/native-process.test.ts docs/benchmarks/results/2026-09-10-supervisor-rss-fix/task-8-report.md` passes. The unrestricted committed diff check reports only original trailing whitespace in the two preserved CI logs; their raw bytes remain unchanged for historical integrity. All required local verification is complete; the controller owns new-head hosted CI and independent review.

## Retained byte identities

SHA-256:

- `ci-34441303410-failure.log`: `14c3cc3a27a2a1e163778f3d883a247a124394f79b531ff2ebd63393f976b70e`
- `ci-34441306074-failure.log`: `1a64c90cedec2ba14d8809373654971ce52a08f2f792f077cd8c2f584c691eaf`
- `scripts/native-process.ts`: `406ad84ba09dce36d7596b1545897aa92cd0fc4a29a228ee6dd947286f8ca4ee`
- `tests/native-process.test.ts`: `888e5f1ea97faf4a5f5c8bead1d696d4c2c3033bbd4c51a61fa4f4318a9e470f`

## Self-review

The helper preserves the existing ENOENT/ESRCH exit-proof behavior and adds it only to the repeated-missing-RSS branch. It adds one small synchronous read on exceptional paths, with no normal-sample delay. No workload/limit/fixture/acceptance changes or library changes are included. Full hosted CI and independent re-review on the new commit belong to the root controller; no publishing or merge was performed by this worker.
