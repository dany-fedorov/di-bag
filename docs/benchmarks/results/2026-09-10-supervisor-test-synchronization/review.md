# Synchronized kernel-exit regression review

Reviewed base `892fe0889204e5b2bf10ba1c7a84ae619c870165` through candidate `363d17f64274afe46639d85499d18e8cc09db089` in `/tmp/di-bag-replacement-performance` on 2026-09-10. Review was read-only on the checkout; only this report was written. No subagents were dispatched.

## Strengths

- The only executable change is the pair of tests at `tests/native-process.test.ts:108`. Production `scripts/` and `src/`, limits, test count, skip policy, and retry policy are unchanged.
- The STOP/CONT handshake at `tests/native-process.test.ts:128` removes the original prerequisite that Bash survive until a timer's second sample. The first read waits for a stopped child and primes the missing-RSS counter; the second resumes that same child and synchronously waits for its real zombie state. `Atomics.wait` yields CPU time while keeping JavaScript exit callbacks pending. This covers the short-lived-child failure shown in the original CI log without trying to extend the transient kernel window through a larger allocation.
- The replay at `tests/native-process.test.ts:117` changes only process/task state to R. The task flags and inventory are read from the actual exiting child; no PF_EXITING bit, successful exit proof, or return value from the supervisor is mocked. The second sample verifies that the actual zombie status has no VmRSS. Both variants require real exit status 0/2, null signal, exact stdout/stderr, no monitor reason/error, and a reaped PID (`tests/native-process.test.ts:147`).
- The test comments and evidence README explicitly distinguish modeled R state from a fresh kernel observation. The preceding observation script and Bash snapshots still exist, and contain real R/no-VmRSS/PF_EXITING evidence. Removing the allocation from the regression harness does not remove the historical empirical justification.
- Relevant surrounding coverage is retained: live children with missing or unreadable memory data, dead leader/live worker, malformed task records, task-inventory races, output/memory/time limits, pending reads, stream draining, and reaping.

## Synchronization and cleanup assessment

The saved original synchronous reader avoids reading the replay while waiting for the real STOP/Z states. JavaScript remains blocked between SIGCONT and the stable zombie observation; the returned async callback resolves through the microtask continuation before normal child exit notification. Thus the second missing-RSS sample reaches the actual exit-proof branch. Both synchronization loops have a two-second bound. A synchronization/read/signal error propagates through the existing supervisor monitor-error path, which sends SIGKILL and waits for child closure; SIGKILL also terminates a stopped child. Successful completion awaits the supervisor's pipe closure and pending sample before asserting reaping. The filesystem spy is restored in `finally` at `tests/native-process.test.ts:153`, including assertion failures. I found no new child-leak or spy-leak path in this change.

## Findings by severity

- **Critical:** none.
- **Important:** none.
- **Minor:** none requiring a change.

The complete-range whitespace check reports trailing whitespace only in the retained raw `post-merge-ci-failed.log`. This is an evidence-format observation, not a correctness finding; changing the raw log just for whitespace would also change its recorded hash.

## Verification and evidence limits

- Independently ran, under `/tmp/di-bag-compiler-heavy.lock`:
  `/tmp/di-bag-bun-1.4.0/bun-linux-x64/bun test tests/native-process.test.ts --test-name-pattern 'pre-zombie kernel exit evidence'`.
  Result: **2 pass, 0 fail, 10 assertions**, 130 ms total; cases took 30.31 ms and 23.33 ms.
- Verified all 25 recorded evidence-file hashes, the production/test hashes, and the pinned Bun binary hash. The checkout remained clean and HEAD unchanged.
- Inspected all 20 affinity logs: each records both revised cases passing, totaling 40 passing cases. Their one/two CPU assignments are described by the README and filenames; the individual Bun logs do not themselves capture the affinity command.
- The retained mutation log records both cases reaching the result assertions with real exit status and pipes, then failing because `terminationReason` is `monitor`. This supports the stated Z-only regression oracle. The exact temporary patch is described in prose rather than retained as a diff; I did not mutate production or rerun that mutation during this read-only review. Current production matches the recorded restored hash and the base version.
- The host log records 123 passes, zero failures, and 564 assertions in 19.86 seconds. The separate sandbox failure log retains the empty-executable error and 27 failures; it is not represented as a successful run. The original CI log records 936 passes and the two old failures at 18.95/18.85 ms, consistent with completion before the scheduled second sample.
- I did not repeat the full suite or hosted CI, as requested.

## Merge verdict

**Approved from code review; merge after the required hosted CI passes on the candidate revision.** No code or evidence correction is required by this review. The repair preserves a meaningful real-process regression oracle while removing dependence on observing a brief kernel state in real time; the recorded negative control and independent focused pass support that conclusion.
