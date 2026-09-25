# Phase 6 checkpoint — 2026-09-22

The maintainer requested a push and resumable handoff. Execution is stopped; no agent-owned compiler, test, package, or guarded command remains running. Resume the existing program rather than restarting the migration.

## Pushed source and authority

- `origin/phase-06-container-renames`: **f352736e6a4e43450dc45c3d997f7ad904515239**, an explicitly unfinished Task 7 checkpoint (27 files). It is not approved for contraction or merge.
- Last independently reviewed source unit: Task 6, **594e91c59e90c743c63660b2ee074d7a2f3c1d15**. All earlier Phase 6 source prerequisites are ancestors of the pushed checkpoint.
- Phases 0–5 are complete and merged/pushed to `next`. Phase 6 has not been merged. Phases 7–13, the final `next` → `main` PR, publishing, and tagging remain.
- The authoritative plans and this handoff live on **`origin/next`**. The phase branch contains an older tracked plan copy: read [the current phase plan](../2026-09-21-07-container-renames.md) from `next`, not that older copy. Do not merge planning commits into the source branch merely to refresh its instructions.
- The [master plan](../2026-09-21-00-swift-api-style-master.md) and [resume ledger](resume-2026-09-21.md) preserve the whole program, prior reviews, fallback decisions, and downstream corrections.

Existing local worktrees are `/home/df/wd/personal/di-bag` (`next`) and `/tmp/di-bag-resume-20260921/phase06` (`phase-06-container-renames`). If the temporary worktree is gone, fetch the two remote branches and create an isolated checkout from the pushed phase branch. The checkpoint changes are already committed: do not reapply its archived diff.

## Durable evidence

[Evidence archive](checkpoints/phase06-f352736-evidence.tar.gz) and [archive checksum](checkpoints/phase06-f352736-evidence.sha256) contain 422 files, 3,289,281 uncompressed bytes. The 625,164-byte archive has SHA-256:

`df67c57737a3dcef4cfd821e21890dcf4b38ff9f8fb477a5e8e5353692bf679f`

Every archived payload was checked against its manifest. The archive includes source/hand-migration patches, all retained Phase 6 gate logs and resource receipts, accepted and rejected S3 evidence, both SDD directories, independent review records, the migration helper/inventories, authored-doc drafts, benchmark preservation notes, and the resource-guard script. `MANIFEST.json` records each original local path, size, and checksum. It contains no dependency installation, credential configuration, or publishing token.

To inspect without depending on old temporary paths:

```sh
cd docs/superpowers/plans/handoff/checkpoints
sha256sum -c phase06-f352736-evidence.sha256
mkdir -p /tmp/di-bag-phase06-resume-evidence
tar -xzf phase06-f352736-evidence.tar.gz -C /tmp/di-bag-phase06-resume-evidence
```

Start with `phase06-checkpoint-evidence/sdd-main/task-7-checkpoint.md`, `task-6-report.md`, and `task-6-review.md`. The archived Task 7 report describes the pre-commit freeze; its 27 modified files are now committed in `f352736`. Its final benchmark review is still pending.

## Verified state and remaining Task 7 work

Task 6 passed 636 fast tests (16,227 assertions), 137 compiler tests (521 assertions), graph 23/23, agent-eval 7/7, source typecheck, and build. Its exact committed diff matches reviewed SHA-256 `20378fa608f5e804d2383b91d7f96c0ab298f732dd0fc4de2f221c16bacb2ea4`. All 135 manual codemod rows are accounted for; no second checker write is needed.

Task 7 has migrated the ten named package/node derivation calls plus twelve calls in eight generated runtime templates, applied the four-file authored-doc patch, updated package `Container` strings, and edited the current benchmark adapter/root-entry selection. Its frozen and committed diff has SHA-256 `3f3100bc958970099be7df731f1a1f92812e95c152c8fdf25bbe5647a40c49cc`.

Only the focused observer-negative check (1/1, five assertions) and source `typecheck2` are green for Task 7. `typecheck1` failed after the helper rewrote ten private `BagRuntime.inspect` calls; those exact private calls were restored, then `typecheck2` passed. Both logs are retained. No Task 7 benchmark, package, compiler-budget, complete runtime, or docs gate is claimed green.

Resume in this order:

1. Read the archived Task 7 checkpoint and benchmark preservation report. Independently review the four benchmark files; preserve pinned `739b509eb7942e4e26c972a711d003aaf8769997` baseline members and allow `di-bag/node` only for the baseline native-Promise scenario. Current scenarios use the root entry.
2. Complete final residual/hand-edit accounting and protected-input hash checks. The helper's 117 → 0 inventory is an intermediate result: ten private inspection rows were restored afterward. **Do not rerun the helper over `tests/selected-scope-runtime.test.ts`.** The plan's printed helper still lacks that exact exclusion; correct it before any future helper execution, without another migration write merely to regenerate counts.
3. Run affected benchmark/current and all seven paired archive smokes, package/native/token/release/runtime checks, graph, and agent-eval checks required by the actual changed-file inventory. Build first where tests consume `dist`. Preserve genuine failed invocations and fix their causes.
4. Run the twelve compiler-budget cases and record the final measured values, then the integrated authored-doc checks. `AGENTS.md` is 150 lines. The only intermediate docs exceptions are the specifically observed generated dual-surface drift allowed by the master plan; missing authored examples or incorrect snippets are not waived.
5. Freeze the Task 7 candidate and report, obtain independent review, and make a normal completion commit on top of the WIP checkpoint. Do not amend away the pushed checkpoint or claim the task complete before its gates pass.
6. Continue Tasks 8–11 as one coherent source/reference contraction, then Task 12's complete phase gate. Merge/push Phase 6 into `next` only after it is fully green and reviewed.

## Boundaries already decided

- S3 chose positional `(keys, providers)` replacement pairs, with optional third `{ sharedParentServiceKeys }` for children. Empty/no-argument/explicit-undefined forms remain. Do not reopen the rejected bag signatures or weaken the compiler budget.
- Preserve both snapshot overloads, both explicit-`never` guards, callable facade exports, and Builder's explicit `in out` variance plus invariant witness.
- Task 8 retires only the temporary `Bag as LegacyContainer` import and alias-identity assertion; retain `defaultBag: Container`, value/declaration-consumer and reflected-method wrapper proofs. Never replace the identity check with a tautology.
- Task 9 keeps `Operation extends string`, changes the rename diagnostic default, and preserves current observer/getter/mutation tests while retiring only the two legacy positive controls. The both-fields payload remains an exact retired-field rejection.
- Task 10 owns `scripts/verify-release-artifacts.ts`: require the root JS/declaration pair, reject retired node files, require the exact root-only export map, and preserve missing-export/removed-file negative tests. Task 11 deletes the obsolete node reference table row rather than repointing it.
- Preserve private runtime inspection, original graph/codemod compatibility inputs, the historical Phase 5 migration script, pinned benchmark baseline, `DI_BAG_*` codes, and the deferred close-state/event vocabulary until their assigned phases.

## Agents, tools, and resources

Use **Sol medium** agents (`gpt-5.6-sol`, `medium`) as requested, one source writer and at most one heavy command at a time. Push authorization persists. Keep tests/resource guards; do not ask again for already authorized routine work.

Use pinned Bun **1.4.0**, Node **24.20.0**, and npm **11.19.0**. Existing binaries are `/tmp/claude-1000/-home-df-wd-personal-di-bag/7818417c-3b3a-48db-9bef-85624eff953b/scratchpad/bun/bin/bun` and `/home/df/.volta/tools/image/node/24.20.0/bin/node`. If absent, recover the same versions; system Bun 1.4.2 is not the pinned runner. Do not mutate the existing read-only dependency symlinks or shared compiler installation.

Use archived `tools/run-guarded.py`: at least 12 GiB available before complete/compiler-budget/archive-intensive gates, at least 8 GiB before smaller guarded commands. Stop only the owned process group after sustained pressure according to the guard; do not lower thresholds or kill unrelated work. At freeze roughly 9 GiB was available. Task 7 typecheck2 completed with minimum 7.77 GiB and no resource stop; wait for the 12 GiB launch floor before its pending budget/full gates. Keep `GOMAXPROCS=2`, npm update notices disabled, and cache writes in task-owned temporary paths.

Required source commit trailers remain in the master plan. Final release authorization remains the original program scope, but publishing is not started: never copy or expose credentials. If the final PR merge is refused by the permission system, stop and report; do not bypass it with a direct main push.
