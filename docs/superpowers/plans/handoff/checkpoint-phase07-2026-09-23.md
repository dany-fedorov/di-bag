# Phase 7 checkpoint — 2026-09-23

Phase 7 requirement renaming is complete, reviewed, and merged **locally** into `next`. Continue the existing migration from Phase 8. No Phase 8 source work, remote publication, publishing, or tagging is claimed here.

## Local integration and publication boundary

- Local `next` is `129b8bfd7821d6be5a905e6453d9f682d30051d5` (`merge: complete phase 7 requirement renaming`), with parents Phase 6 merge `ec186dacd7bda9375ca7efbdbf3527a1ea01dafa` and Phase 7 branch head `2a805e1d50865439437508b5f01e7efe1cd6b758`. The tracked worktree was clean before this handoff was added.
- Phase 7 commits: `64f030774bd0041da1ed56b16722ad5eec9ee19c` (runtime/types/graph/checked docs), `ca4c090d4bfda5b8f3c91c0b50c8c07e11678c3a` (S6 evidence), and `2a805e1d50865439437508b5f01e7efe1cd6b758` (API-card classification guard). The final scoped re-review reports **0 Critical, 0 Important, 0 Minor** findings.
- Local `origin/next` is `828dae93357d7c44d6b0a49ff753eec4bdbe29c3`; `next` is 20 commits ahead, including Phase 6 and Phase 7. This is a local tracking-ref observation, not proof of the server's current state. Remote push requires fresh user approval; do not attempt or retry a push from this checkpoint. The local merge ruling below does not grant publication approval.
- The Phase 7 branch remains at `2a805e1`. Preserve the existing host-owned worktrees listed by `git worktree list`, including the main `next` tree, Phase 0–7 trees, Phase 3 history, Phase 5 agent-eval, Phase 6 codemod, and the two scratchpad checkouts. Do not prune or repurpose them as part of the handoff.

## Receipts and decision

The branch Task 7 report and guarded receipts live in `/tmp/di-bag-resume-20260921/phase07/.superpowers/sdd/2026-09-21-08-requirement-renaming/` and `/tmp/di-bag-resume-20260921/gates-phase00/phase07-*`. Branch final runs reported `exitCode: 0`, `resourceStopped: false`: `npm run check` (644 runtime; 593 compiler/package; build), `docs:check` (31 tests, 119 snippets), `graph:check` (30), `codemod:check` (75), native typecheck/build, native diagnostic check (151 files, 821 expected/819 matched, two known gaps, zero unexpected/failures), Node retention/scale (36), agent-eval (7), naming ratchet (3, no list diff), and all nine top-level `examples/*.ts` programs. The later documentation-only fix passed focused API-card 5/5 and `docs:check` 32/32; no library/type source changed afterward. The final premerge `npm run check` receipt is `phase07-premerge-final` (593 compiler/package tests, 4,125 assertions, build; exit 0, no resource stop). The postmerge `phase07-next-merged-check` receipt reports the same compiler/package count and build, exit 0, no resource stop. These receipts do not claim a fresh nested-example or browser run.

[Phase 7 evidence](../evidence/phase-07.md) records twelve accepted cumulative instantiation changes, in 100 then 500 order for bulk, chained, grouped, replacement, bindings, modules: **-7.6%, -2.2%, -7.3%, -1.2%, -1.5%, -36.1%; -1.3%, -0.3%, -1.0%, -0.0%, -0.1%, -46.6%**. All are under the +10% ceiling. The separate 20-module worker was accepted with zero diagnostics, 194,205 instantiations, 1,266 ms, and 370 MiB max RSS; it has no comparable numeric ceiling. **S6: adopt requirement renaming**; conditional Task 6 fallback was skipped. S7 remains plural `withInstalledModules`. Runtime cannot generally validate unknown or colliding named requirements after type erasure; the compiler enforces those cases.

The initial sandboxed evidence and child-process gates encountered `EPERM`; permitted guarded reruns passed. An initial full check exposed global Bun 1.4.2 versus pinned 1.4.0. An **ignored**, workspace-local `tools/platform-versions.local.json` in the Phase 7 tree changes only both Bun executable paths to the verified scratchpad Bun 1.4.0; exact JSON delta, ignore status, hash, focused identity test, and final full check were recorded. This reproduces the Phase 7 platform setup without changing tracked pins or global Bun. One native-build launch deferred at 11.99 GiB against the 12 GiB floor and passed on retry. Retain failed receipts; do not relabel them as green.

## Canonical `Ruling:` decisions, in ledger order

The authoritative ledger is `/tmp/di-bag-resume-20260921/phase07/.superpowers/sdd/2026-09-21-08-requirement-renaming/progress.md`. Its literal rulings are preserved here with their cost if wrong:

1. Keep the Phase 7 API-card `withRenamedRequirement` allowlist, without publishing unrelated Module methods. Cost: a second maintenance list could hide future methods. The final fix retains the bounded card and adds an included/excluded reflection guard plus a synthetic future-method rejection; re-review closed the Minor.
2. Locally merge Phase 7 into `next` without another prompt, consistent with the sequential program and the user's instruction to assume and document. Cost: local integration precedes any separate PR preference. No remote publication follows without fresh approval.
3. Preserve Phase 6 `moduleGraph(value, index?)` and put requirement remapping below its validation block; the plan's `operation` parameter was stale. Cost: a future caller needing that parameter requires coordinated signature expansion.
4. Replace the stale token-kind prose assertion with structured `DI_BAG_WRONG_TOKEN_KIND` details. Cost: that fixture no longer pins prose, which is separately covered.
5. Preserve token `unique symbol` and restore exact module types after intentional runtime-only casts. Cost: casts could conceal contract drift; typed installation and full typecheck mitigate it.
6. Move only Task 2's wrong-shape marker to the full graph expression, bind the token symbol to `configKey`, and assert exact consumer/dependency/expected/provided details. Cost: graph-error locality is less narrow; property markers remain for admission errors.
7. Accept unresolved install identity as Task 3's initial missing-feature RED, restore assertion order, and keep whole-view opacity. Cost: initial RED alone proves recognition, not remapping; final green missing-host and remapping controls cover both.
8. Carry an internal `{ requirement: string }` missing lookup through nested graph boundaries while preserving factory-local dependency names and concrete/opaque precedence. Cost: another lookup variant can affect precedence or empty strings; nested/repeated/missing/opaque tests cover it.
9. Add optional `members` filtering to the API-card generator for a bounded Module group. Cost: future methods could be omitted; the final reflection classification test now fails on an unclassified addition.
10. Use the ignored local platform manifest with exactly two Bun path changes. Cost: reproduction depends on local override state and does not fix global Bun drift; pinned hash, manifest comparison, ignore check, and gate receipts cover this run.
11. Correct Task 7's example claim to the nine programs matched by `examples/*.ts`. Cost: the loop gives no independent nested/browser execution evidence; the six nested files' helper/module/declaration roles were inspected and the report states the limit.

## Phase 8 entry

Use the accepted [Phase 8 provider-sources plan](../2026-09-21-09-provider-sources.md) and [master plan](../2026-09-21-00-swift-api-style-master.md). Commit this checkpoint on `next` before creating the `phase-08-provider-sources` branch. Then start from the locally merged `next` and perform Task 0 before source edits:

```sh
git switch next
git switch -c phase-08-provider-sources
export PATH="/tmp/claude-1000/-home-df-wd-personal-di-bag/7818417c-3b3a-48db-9bef-85624eff953b/scratchpad/bun/bin:$PATH"
export npm_config_update_notifier=false
bun --version
node --version
git status --short
rg -n "withServices|withTokenService|withCollectionContribution|buildContainer|createChildContainer|createIndependentContainer|withRenamedRequirement" src/di-bag.ts src/module.ts
rg -n "fromFactory|fromSyncFactory|fromAsyncFactory|fromFunction|fromClass|fromPlugin|readonly token:|AcquisitionMode|AcquisitionContext" src/di-bag.ts src/index.ts src/acquisition-context.ts src/composition.ts src/plugins.ts
rg -n "tokenKinds" src/runtime.ts src/module.ts
rg -n "export function snapshotOptionsBag|inspectValue" src/options-bag.ts
rg -n "freshCollectionView" src
node -e "const m=require('./tools/codemod/rename-map.json'); console.log(m.version, m.methods.length, m.types.length)"
```

Record the exact migration counts with Task 0 Step 2's commands. Read final Phase 4 evidence first: its S5 collection-read fallback is explicit `resolveCollection`, and ordinary `resolve` remains single-service-only. Verify Phase 7 `ModuleDescription.requirementRenames`, Phase 4 `GraphDescription.tokenKinds`, `freshCollectionView`, the optional fifth `snapshotOptionsBag` parameter, and the accepted Phase 6 positional replacement signatures. Preserve both metadata maps in their respective copies, the inherited scope generic prefix/default, the cumulative codemod map, and the root browser-safe contract. Phase 8 changes provider constructors, return-kind/context vocabulary, and token authoring; provider decorators wait for Phase 9. S4 is **uncompiled**: prove inline dependencies-bag inference and all twelve cumulative budget cases; after three serious repairs or a breach, execute the plan's complete positional function/class fallback. The plan controls each green commit and final gate; its executors do not push, publish, merge, or start Phase 9.

The maintainer lifted the historical heavy-command hold in `resume-2026-09-21.md:196`. Phase 8 heavy work is authorized and must be serialized. Require at least **12 GiB available** before complete/compiler-budget/archive-intensive gates, and at least **8 GiB available** before smaller guarded commands, per the Phase 6 checkpoint. Monitor memory pressure throughout; use `GOMAXPROCS=2`, task-owned caches, and never lower these thresholds or overlap lanes. No new per-lane lift is needed unless a later explicit hold is recorded. Preserve pinned Bun 1.4.0, Node 24.20.0, npm 11.19.0, task-owned caches, and existing dependency links. Do not push or retry remote publication from this handoff.
