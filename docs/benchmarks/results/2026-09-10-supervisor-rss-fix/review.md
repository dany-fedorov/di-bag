### Spec Compliance

- ✅ Spec compliant for BASE `2dbcc30836b84c6dbeb5ceefc8ce5f5f0554bd29` through HEAD `21b137f9da9ce6f1e7c7804d8c243c30d180e081`. The repeated missing-RSS path now requires independent exit confirmation (`scripts/native-process.ts:45`, `scripts/native-process.ts:71`). Missing RSS alone is insufficient: an observed exit, ESRCH, or fresh synchronous State Z/X is necessary; unsuccessful or malformed fresh evidence returns false.
- ✅ The ENOENT/ESRCH path reuses its existing proof logic without relaxing permission/error handling (`scripts/native-process.ts:45`, `scripts/native-process.ts:83`). The first missing-RSS grace and ordinary RSS handling remain unchanged (`scripts/native-process.ts:68`).
- ✅ Real-child regressions cover stale non-zombie samples followed by proven zombie state for statuses 0 and 2, exact stdout/stderr, absence of monitor errors, and reaping (`tests/native-process.test.ts:73`). Live-child missing/malformed RSS and EIO/EACCES/ENOENT/ESRCH controls assert termination, sampling counts, and reaping (`tests/native-process.test.ts:25`).
- ✅ Scope is the supervisor helper/decision and focused tests/evidence. The visible implementation hunks leave output collection, timeout setup, pending-sample handling and close cleanup unchanged (`scripts/native-process.ts:35`, `scripts/native-process.ts:44`, `scripts/native-process.ts:90`). The source identity and unchanged library/limit/fixture scope are documented at `docs/benchmarks/results/2026-09-10-supervisor-rss-fix/task-8-report.md:9`.
- ⚠️ Unchanged whole-branch worker-bound and library contracts were not independently re-audited in this scoped review. Prior approvals remain the authority; hosted CI on the new head remains the controller's completion gate (`docs/benchmarks/results/2026-09-10-supervisor-rss-fix/task-8-report.md:78`).

### Strengths

- The helper consolidates the exceptional-path proof rather than duplicating it, and the second probe accepts only ESRCH when the fresh proc read fails (`scripts/native-process.ts:45`). A stale asynchronous state cannot override fresh zombie evidence.
- The regression keeps real OS process state, pipes and statuses while controlling only the status-read boundary; it proves that kill(pid, 0) still succeeds for the zombie (`tests/native-process.test.ts:81`, `tests/native-process.test.ts:87`). Its first-two-samples guard permits legitimate later genuine reads (`tests/native-process.test.ts:79`).
- Historical CI evidence accurately distinguishes observed symptoms from the scheduling hypothesis: status 2 with accepted diagnostics at `docs/benchmarks/results/2026-09-10-supervisor-rss-fix/ci-34441303410-failure.log:587`; a separate status-0 package-emitter failure at `docs/benchmarks/results/2026-09-10-supervisor-rss-fix/ci-34441306074-failure.log:759`. The latter justifies native-package validation.

### Issues

- Critical: none.
- Important: none.
- Minor: none. Recorded final validation contains no warnings or unexplained failures; historical RED, sandbox and diagnostic logs are explicitly retained as investigation evidence, not claimed as successful validation (`docs/benchmarks/results/2026-09-10-supervisor-rss-fix/task-8-report.md:31`).

### Checks

- Read the prepared diff once; historical log bodies were filtered. Initial tool-output truncation was resolved by reading the brief/report and exact validation evidence, without rereading/regenerating the diff or crawling other source files.
- Verified refined RED shows both intended monitor failures (`docs/benchmarks/results/2026-09-10-supervisor-rss-fix/red-refined.log:13`, `docs/benchmarks/results/2026-09-10-supervisor-rss-fix/red-refined.log:26`).
- Verified supervisor GREEN: 22 pass, 0 fail, 117 assertions (`docs/benchmarks/results/2026-09-10-supervisor-rss-fix/green.log:27`), including live fail-closed, exit-race, drainage/reaping and resource-limit controls (`docs/benchmarks/results/2026-09-10-supervisor-rss-fix/green.log:4`).
- Verified release GREEN: 90 pass, 0 fail, 388 assertions, including real physical archive/declaration verification (`docs/benchmarks/results/2026-09-10-supervisor-rss-fix/release-green.log:89`, `docs/benchmarks/results/2026-09-10-supervisor-rss-fix/release-green.log:95`).
- Verified native-package GREEN: 2 pass, 0 fail, 1206 assertions (`docs/benchmarks/results/2026-09-10-supervisor-rss-fix/package-green.log:7`). Both source typechecks exit 0 (`docs/benchmarks/results/2026-09-10-supervisor-rss-fix/typecheck-classic.log:27`, `docs/benchmarks/results/2026-09-10-supervisor-rss-fix/typecheck-native.log:27`).
- No test commands were run: code inspection raised no concrete unresolved doubt requiring another probe. No source, Git or branch mutations; only this requested report was written.

### Assessment

**Task quality: Approved.**

The narrow helper extraction repairs the reproduced stale-sample classification while retaining fail-closed live-process monitoring. Real-process RED/GREEN evidence and the targeted release/package validation support approval with no findings.
