# Synchronize kernel-exit regression tests

Main CI run [34446838890](https://github.com/dany-fedorov/di-bag/actions/runs/34446838890)
on `892fe0889204e5b2bf10ba1c7a84ae619c870165` passed 936 tests and failed the two
kernel memory teardown regression tests. Both failed because `exitingPid` stayed
zero. Their total durations were 18.95 ms and 18.85 ms; the tests scheduled their
second sample after 20 ms. This is consistent with the child exiting before the
second sample could start. Independently, observing the brief R/no-VmRSS window
depends on scheduler timing even when a second sample starts.

The replacement tests stop a real Bash child before it exits, prime the missing
RSS sample, then resume the child in the second sample. They hold JS exit
notification until the child's real zombie state is available. At the filesystem
boundary they replay only the previously observed R state; actual missing memory,
PF_EXITING flags, PID and thread inventory remain real. Exit codes 0 and 2,
stdout, stderr, normal completion and reaping are required. No production source,
supervision limit, timeout, test skip or retry policy changes.

These are deterministic regression inputs, not fresh observations of the kernel's
transient R state. The original real observation script and snapshots remain in
[the preceding investigation](../2026-09-10-supervisor-rss-fix/integration-round-1/observe-kernel-exit.mjs).

Validation uses the CI-pinned Bun 1.4.0. A temporary production mutation requiring
Z instead of accepting R with PF_EXITING causes both revised tests to fail with
`terminationReason: 'monitor'`, while preserving their real exit codes and pipes.
The production file was then restored. Twenty focused runs, ten on one CPU and
ten on two CPUs, passed all 40 cases. The original live-child monitor rejection,
dead leader/live worker, malformed and unreadable evidence, limits, drain and
reaping tests remain in the suite.

The initial full local supervisor command failed because Bun 1.4.0's synchronous
Node executable probe returned empty output inside this sandbox. The same probe
outside the sandbox returned the actual Node path. That failed run is retained as
`sandbox-supervisor-failure.log`; the subsequent host run is recorded separately.

Host validation passed all 123 supervisor and release-artifact tests, with 564
assertions, in 19.86 seconds. Full hosted CI is required before merging this repair.
