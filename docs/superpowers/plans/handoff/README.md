# Handoff: the 0.5.0 Swift API style program

Written 2026-09-21 by the controller session, when it could go no further. Read this file first, then the master plan `../2026-09-21-00-swift-api-style-master.md`.

**Resume in progress:** the maintainer instructed Codex to continue with Sol medium subagents, without questions, making and documenting assumptions. Read [the resume ledger](resume-2026-09-21.md) for current evidence, rulings, reviews and remaining work. The historical tables and blockers below are not the current status. Phases 0–4 have passed their gates and are merged/pushed to `next`; Phase 4's merge is `5d83187`, reviewed source/docs head `7bce085`. Collection tokens use the measured `resolveCollection`/`inspectCollection` fallback. The final compiler-budget table accepts all twelve cases, at most +6.002%; full checks pass 592 fast and 577 compiler tests, with the other phase gates green. The final docs-only review correction is approved; all retained evidence and SDD records are archived with checksums. Phase 5 builder renames has completed expand, portable declarations and S1/S7 measurements at reviewed `16d24f2`. Six public callable facades fix observed private-name leaks. Task 6 selected `withTokenService(token, provider)` as the measured cost fallback, with its source and downstream checks passing. Task 8 additionally selected `withReplacedService(serviceKey, provider)` after a real inference regression and two bounded bag repairs failed. Its reviewed source prerequisite is committed at `306f0a9`: inference, runtime, full declaration matrix and pinned-Node compiler budgets pass, with a narrow module-overload ordering repair and four terminal fixture preparations. The other selected bags and module list remain unchanged. Task 7’s shipped codemod and mixed-generation safety are reviewed at `5ba7465` (70 tests pass); Task 8 typed-call-site migration has preserved and restored two failed mechanical trials; the inference and fixture repairs are committed, and the aligned codemod is reviewed at `3318503` (70 tests pass). Attempt 3 committed 2,964 generated rewrites across 168 files at `badcc416` after its compiler/runtime/typecheck/build/codemod gates passed. Independent review approved it; the separate hand migration is reviewed and committed at `19012b8` (17 files, including indirect contribution consumers). Its exact final 86-row report retains three migrated current `buildModule` calls conservatively. The supplemental 11-file type-query/helper migration is reviewed and committed at `a926bf7`; Task 9A generated-source migration is reviewed and committed at `037804e`, with its focused, package/native and actual Node runtime gates passing. The benchmark adapter (9B), qualified-type-query codemod repair (9C), local agent-eval migration (10), and bilingual graph extractor (11) are reviewed and committed through a3c4ea8. Combined builder contraction and shipped documentation (12–13) are reviewed and committed at 85ff86e. Task 14 repaired recursive type-checking cost with explicit Builder invariance at 32c4338; all twelve compiler-budget cases now pass below baseline. The full gates exposed diagnostic rendering issues, repaired at d08a839, followed by one genuine scale-test depth error from the global display option. The reviewed cache-preserving scope correction is committed at 8b33d7c. All final gates pass: 607 fast tests, 586 compiler tests, docs, graph, codemod, native validation, retention, agent-eval harness and nine examples. The API card is 365 lines against the unchanged 400-line limit. Final evidence/report and archive review precede the Phase 5 merge. Pushes and resource-guarded checks remain authorized: one heavy lane, at least 12 GiB launch headroom for complete checks and whole-project codemod runs, and 8 GiB for smaller gates. Phases 5–13, the final pull request to `main`, and publishing remain outstanding.

## The goal, in the maintainer's words

Finish planning the renames and the orthogonality refactoring, described well enough for an Opus agent at medium effort to execute; then execute; push; merge `next` into `main`; release to npm with the automation token the maintainer supplied. The maintainer also said: do not ask questions, make assumptions and document them.

## Where things stand

| Item | State |
| --- | --- |
| Spec, examples, glossary | done, on `next`: `docs/superpowers/specs/2026-09-20-swift-api-style.md`, its `-examples.md` companion, `CONTEXT.md` |
| Master plan (00) | done, on `next`; twelve recorded assumptions |
| Plans 01, 02, 03, 04 (phases 0 to 3) | done, on `next` |
| Plans 12, 13, 14 (phases 11, 12, 13) | done, on `next`; each says exactly what was run when it was written and what was not |
| Plans 05, 06, 07 (phases 4, 5, 6) | PARTIAL drafts under `partial/`, not reviewed. 06 is far along (Tasks 0 to 6 of about 12); 05 and 07 have no task yet |
| Plans 08, 09, 10, 11 (phases 7 to 10) | not started; their scope notes are in `planner-notes/` |
| Phase 0 implementation | six commits on branch `phase-00-naming-baseline` (pushed to origin). UNVERIFIED: the fast lane passed (546 tests), the compiler lane never completed. Not merged |
| Phases 1 to 13 | not started |
| Merge to `main`, npm release, tag | not started |

## Two blocks, both real, neither to be worked around

1. **The account's monthly spend limit.** Subagents died with HTTP 429 "monthly spend limit" twice on 2026-09-21: eleven planner forks, then seven fresh planner agents, the second time minutes after a one-agent probe had succeeded. A probe that succeeds says nothing about headroom. Do not delegate to subagents until the maintainer says the limit was raised. Do not switch models or split work into smaller agents to get under it.
2. **Memory.** The harness stopped the phase 0 gate run (`npm run check` and the rest) because the machine was critically low on memory, and said not to start it again unasked. The controller promised the maintainer to hold every heavy command until told the machine has room: `npm run check`, `npm run test:compiler`, the evidence and benchmark scripts, and the TypeScript compiler over `src`. At last look: 30 GB RAM, 11 GB available, swap 15 of 19 GB used, WebStorm and a QEMU virtual machine among the large users. `bun test <one file>`, `node <one script>`, `grep` and reading are fine. Refined later the same day, after measuring: ONE type-check of `src`, `tests` and `examples` (`tsc6 -p tsconfig.json`) takes 8 seconds and peaks at 1.2 GB, so a single compiler process is a light command. The controller therefore allows itself single `tsc6` runs for type prototypes, one at a time, only when `free -g` shows at least 6 GB available. The hold stays on everything that runs many compiler processes or for minutes: `npm run check`, `npm run test:compiler`, the evidence and benchmark scripts, and above all the stopped phase 0 gate. Consequence: no phase can be VERIFIED, so none can be merged, until the maintainer lifts this.

Ask the maintainer about both before anything else. Everything below assumes they were lifted.

## How to resume

1. `git fetch && git switch next && git pull`. Read the master plan, then this folder.
2. **Environment.** The pinned Bun 1.4.0 must be first on `PATH` (`bun --version` prints `1.4.0`). The old session kept it in its own scratch directory, which may be gone; install it anywhere outside the repository with the command in the master plan's "Environment" section. Node 24.20.0, npm 11.19.0, `export npm_config_update_notifier=false`.
3. **Finish the plans**, in this order of value: 06 (extend the partial draft), 05, 07, then 08, 09, 10, 11. One planner per plan. Brief each with `planner-notes/common.md` plus its `planner-notes/NN.md`; in those files `<scratch>` stands for a scratch directory of your own. `common.md` carries a MEMORY GUARD that made every compile-time design in plans 05 to 11 uncompiled (master plan, assumption 11). If the memory block is lifted, drop that guard from the brief and let planners prototype types with `tsc6`, which is how plans 01 to 04 were written and is much better evidence.
   - A planner that prototypes a runtime change needs its own throwaway worktree: `git worktree add --detach <scratch>/exec-NN origin/next`. `src` on `next` is still the 0.4.0 source. Probes run with `bun test <one file>` there. Never share one patched worktree between planners.
   - Obligations that the finished plans put on the unwritten ones are at the end of `planner-notes/common.md`: new validation sites raise `DI_BAG_INVALID_ARGUMENT` with `{ operation, argument, expected }` from the closed vocabulary of plan 12 Task 9; plan 08 creates the errors-page sections `DI_BAG_UNKNOWN_SERVICE_KEY` and `DI_BAG_DUPLICATE_SERVICE_KEY`; plan 11 gives the new child-container rule its own runtime code and section; two message families are left for plan 12 Task 12; codemod map owners are named as at 0.4.0.
4. **Review every plan before committing it**: `python3 docs/superpowers/plans/handoff/review-plan.py <plan.md>` (fences, placeholders, claims of compiling, `git add -A`, secrets), then read its final report against the spec. Stage plan files BY NAME. Never `git add -A` in this repository while a planner is writing.
5. **Verify phase 0**: check out `phase-00-naming-baseline` in a worktree, `npm ci`, `npm ci --prefix tools/graph`, `npm ci --prefix tools/docs`, `npm run platform:pin`, `npm run build`, then the master plan's full gate list. Green: merge into `next` with `--no-ff` and push. A compiler-lane test that times out under load is rerun alone once (master plan, "Environment").
6. **Execute phases 1 to 13**, one at a time, one executor per phase, following the master plan's protocol (branch `phase-NN-<slug>`, expand, migrate with the codemod, contract, regenerate, full gate, report). The controller reviews each report and the diff, merges into `next`, pushes, and only then starts the next phase. Commits that a plan declares red on purpose are listed in the master plan, assumption 10.
7. **Release**: the section "For the controller only" at the end of plan 14. Pull request from `next` to `main`, CI green, `gh pr merge --merge`; if the permission system refuses the merge, stop and report, do not push to `main` another way. Publish `di-bag-graph` 0.2.0, `di-bag-codemod` 0.1.0, then `di-bag` 0.5.0, each from the verified archive; tag `v0.5.0`.

## The npm token

The maintainer supplied an automation token in chat, for publishing only. It was stored in ONE place: `publish.npmrc` (mode 600) in the old session's scratch directory, and used as `npm publish --userconfig <that file>`. It is not in this repository, not in its history (checked with `git log -S`), not in any plan, note or memory file, and it must stay that way. If that file no longer exists, ask the maintainer for the token again. `npm whoami --userconfig <file>` printed `danyfedorov` when it was checked.

## What is in this folder

| Path | What it is |
| --- | --- |
| `README.md` | this file |
| `planner-notes/common.md` | the rules every planner gets, the facts established so far, and the obligations from plans 12 to 14 |
| `planner-notes/05.md` to `14.md` | one scope note per plan, with findings from reading the code. 12, 13 and 14 are kept for the record; their plans are written |
| `partial/*.PARTIAL.md` | the three unfinished drafts, each with a banner that says how far it got |
| `review-plan.py` | the mechanical review run on every plan before it is committed |

## Lessons that cost something to learn

- Measure first, write second. Several numbers in early drafts were wrong because the claim was written in the same command that measured it. Every count in plans 12 to 14 was read from a command's output before it was written down.
- A plan that says "this was checked" must be able to say how. Plans 12 to 14 each end with a list of what was run and what was not.
- The docs check is two-way: every `'DI_BAG_X'` literal in `src` needs a section in `docs/agent/errors.md`, and every section needs a literal. A code and its section change in one commit.
- `package.test.ts` fails on npm's update notice on standard error; hence `npm_config_update_notifier=false`.
- Tests under `tests/platform` and the package tests read `dist/`: build before running them.
- Inside a quoted shell heredoc, Python sees a double backslash as a literal backslash. Generated plan text was always read back, and embedded files were compared byte for byte with their verified sources.
