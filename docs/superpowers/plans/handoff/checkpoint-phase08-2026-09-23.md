# Phase 8 checkpoint — 2026-09-23

Phase 8 provider sources are complete, independently reviewed, and merged **locally** into `next`. Continue the migration from Phase 9. No Phase 9 source work, remote publication, publishing, or tagging is claimed here.

## Local integration and publication boundary

- Local `next` is `4887004983037cfa12f5613bf6c85a7b737d16c7` (`merge: complete phase 8 provider sources`), with parents Phase 7 checkpoint `18d6c4b1da4b715608bd74f1942a91d4209f3889` and Phase 8 branch head `ec3ffb1384f941f94765153d656833496a685ba6`. The tracked worktree is clean.
- Phase 8 commits, in order: `16c7f71` (provider constructors), `acaa642` (expand documentation), `80201f3` (codemod), `83c95cd` (mechanical migration), `90172be` (nonliteral return-kind preservation), `17e0fb7` (consumer documentation), `d6084c2` (compatibility removal), `e928909` (final evidence), and `ec3ffb1` (nested codemod-rule validation). The final scoped re-review reports **0 Critical, 0 Important, 0 Minor** findings.
- Local `origin/next` is `828dae93357d7c44d6b0a49ff753eec4bdbe29c3`; `next` is 31 commits ahead. This is a local tracking-ref observation, not proof of server state. Remote push still requires fresh user approval; do not attempt or retry it from this checkpoint.
- The Phase 8 branch remains at `ec3ffb1`. Preserve existing host-owned worktrees and ignored SDD records; do not prune or repurpose them during handoff.

## Verification and evidence

The branch receipts and reports live under `/tmp/di-bag-resume-20260921/gates-phase00/` and `/tmp/di-bag-resume-20260921/phase08/.superpowers/sdd/2026-09-21-09-provider-sources/`. The final Phase 8 lane passed all eleven serialized gates: full `npm run check` (655 fast tests; 605 compiler/package tests with 4,207 assertions; build), `docs:check` (35 tests, 114 typed agent snippets, 140 pages), `graph:check` (32), `codemod:check` (86 before the final validator repair), native typecheck/build and diagnostics (154 files, exactly seven inherited accepted diagnostic-quality gaps, zero unexpected failures), Node retention/scale (36), agent-eval (7), and all nine top-level examples. The validator repair then passed 88/88 codemod tests and fresh scoped re-review.

The first postmerge receipt, `phase08-next-merged-check`, exited 2 during typecheck because ignored worktree-local `dist/` still contained Phase 7 declarations; self-importing browser/Deno fixtures therefore saw a `DiBagApi` without `createProvider` and `createToken`. No tracked source repair was made. `phase08-next-refresh-build` regenerated `dist/` from merged source and exited 0. The unchanged rerun `phase08-next-merged-check-b` then passed 605/605 compiler/package tests with 4,207 assertions and the final build; exit 0, no resource stop, 528.1 seconds, minimum available memory 6.86 GiB. Refresh ignored build output before future postmerge self-import checks.

[Phase 8 evidence](../evidence/phase-08.md) records twelve accepted cumulative instantiation changes, in 100 then 500 order for bulk, chained, grouped, replacement, bindings, modules: **-8.49%, -2.39%, -8.14%, -1.29%, -1.42%, -36.01%; -1.47%, -0.28%, -1.17%, -0.05%, -0.04%, -46.56%**. Every row is below the +10% ceiling. **S4: adopt object-bag positional providers** after one serious signature repair; no fallback was required.

The final retired-name audit has exactly 20 classified lines: eleven unrelated token data fields, six vendored 0.4 graph-fixture rows, two token-scale function names, and one scanner regex. The historical `scripts/phase05-strings.py` remains byte-identical to `21817b0`, SHA-256 `814c708fc113a48860f9597c86c25002c27dff0c57e2e9733382d30b694c08a3`. Stale prose at `docs/guides/api-reference.md:44-51` is explicitly deferred to Phase 12; no executable legacy provider-source consumer remains outside the deliberate 0.4 fixture.

## Binding decisions carried forward

1. Keep `ChildContainerShareAdmission`; the Phase 8 plan's `ScopeShareAdmission` spelling was stale. Preserve scope generic order/defaults, `GraphDescription.tokenKinds`, `ModuleDescription.requirementRenames`, `freshCollectionView`, and the optional fifth `snapshotOptionsBag` hook.
2. Public providers use `FactoryReturnKind = 'auto-detect' | 'sync-value' | 'native-promise' | 'uninspected'` and `FactoryContext = { abortSignal, pushDisposer }`. The checked return-kind admission stays property-local; contextual `any` is only an inference seed.
3. `createProviderFromFunction` and `createProviderFromClass` keep object option bags under adopted S4. Plugin construction returns its distinct cached Promise. Singleton symbol arguments must come from bound constants.
4. Public tokens expose `.symbol`, not `.key`. `transformService`'s `acquisitionMode` remains only until Phase 9; broader runtime vocabulary changes wait for Phase 12 where the plans say so.
5. Final native diagnostics retain exactly seven accepted inherited quality gaps and zero unexpected failures. Do not silently promote those gaps or weaken marker checks.
6. The late `phase08-task5-full-check-b-escalated` receipt completed after its controlling session was considered lost and overlapped the replacement `-c-escalated` run by timestamps. The final Task 6 and postmerge gates are the authoritative serialized acceptance runs; preserve the historical receipts and corrected SDD narrative.

## Phase 9 entry

Use the accepted [Phase 9 provider-methods plan](../2026-09-21-10-provider-methods.md) and [master plan](../2026-09-21-00-swift-api-style-master.md). Create `phase-09-provider-methods` from this locally merged checkpoint, establish a fresh ignored SDD workspace, and execute Task 0 before source edits. The binding execution order is Task 0, Task 3 codemod, Tasks 1–2 plus Task 5 Step 1 as one expand commit, Task 4 migration, Task 5 Steps 2–3 evidence decision, then Task 6 contract removal.

Phase 9 moves decorators onto immutable `Provider` handles and migrates lifetime vocabulary. Preserve Phase 8's `CreateProviderFromPluginOptions<ReturnKind, Service, Dependencies = ...>` prefix, accumulated codemod mappings, collection-token behavior, external lifetime-reach remapping, and all decisions above. Singleton-capture and closing/closed message-family prose remains deferred to Phase 12. Start by refreshing ignored `dist/` in the new worktree before any self-importing full check.

Heavy work remains authorized but serialized: require at least **12 GiB available** before full/compiler-budget/archive-intensive gates and **8 GiB** before smaller guarded commands, with pinned Bun 1.4.0, Node 24.20.0, npm 11.19.0, `GOMAXPROCS=2`, and task-owned caches. Never lower thresholds or overlap lanes. Do not push, publish, tag, or merge Phase 9 without its own completed review and gate.
