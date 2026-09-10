# Synchronize zombie fixtures with complete thread exit

The post-merge CI run for `681270e3574ef938cec45ba413b00e16a2309087` failed one supervisor test: 953 tests passed and one failed. The test injected an `ESRCH` status-read error as soon as Node's main thread reported `Z`, then expected successful process completion. The supervisor correctly reported a monitor failure when another thread was still running.

The unchanged test reproduced the failure once in 100 local repetitions. A separate diagnostic run reproduced it once in 200 real Node child lifecycles. Its failing trace shows the main thread in `Z` with `PF_EXITING` set and a remaining `SignalInspector` thread in `R` with `PF_EXITING` clear. The diagnostic copy adds trace recording and can affect timing; the original uninstrumented test independently reproduced the failure.

The repair changes only test synchronization. The two Node fixture families now wait for one status snapshot containing both `State: Z` and `Threads: 1` before injecting exit-related errors or returning a stale status snapshot. The zombie leader cannot resume user code, and no other thread remains to keep the process alive. The predicate uses independent status fields rather than the supervisor's task-flag checker.

All child commands, deadlines, resource limits, result assertions, and production code remain unchanged. The existing real zombie-leader/live-worker regression continues to require a monitor failure. The repaired tests still verify exit codes, exact stdout/stderr, absence of false monitor errors, and reaping before completion.

## Evidence and reproduction

- [Original hosted failure](original-ci.log), from [run 34505780726](https://github.com/dany-fedorov/di-bag/actions/runs/34505780726).
- [Original test repetitions](original-test-repeat.log): 99 pass, one failure with the same monitor classification.
- [All diagnostic lifecycle observations](observations.jsonl) and [the failing observation](failed-observations.json).
- [Diagnostic worker](observe.ts), [instrumented supervisor](native-process.instrumented.ts), and [instrumentation identity](instrumentation-identity.json). These are diagnostic artifacts; production uses the unchanged supervisor.
- [Validation commands and outcomes](verification/gates.json) and their raw logs in `verification/`.
- [Independent review](review.md).

Run the repository's pinned Bun with:

```sh
bun test tests/native-process.test.ts --test-name-pattern 'supervisor drains and reaps a zombie|supervisor confirms exit .* after stale non-zombie status' --rerun-each 100
bun test tests/native-process.test.ts
npm run typecheck
npm run typecheck:native
```

The diagnostic worker expects its instrumented supervisor in the same directory and uses Node from `PATH`. It runs 200 serial short-lived children; it does not replace the original test or any compiler performance acceptance case. [The artifact manifest](artifact-manifest.json) records source identities and payload checksums.
