# API renaming implementation plan

> **For agentic workers:** Use subagent-driven-development for the provider API
> task and independent task/final reviews; root coordinates migration and gates.

**Goal:** Complete the API renaming and consolidation plan and merge verified work.
**Architecture:** Preserve existing authenticated provider operations, graph
contracts and ownership engine; replace public entry shapes and diagnostics.
**Tech Stack:** TypeScript, Bun, Node, TypeDoc, VitePress.
**Spec:** docs/superpowers/specs/2026-09-10-api-renaming-design.md

## Global constraints

No runtime dependencies or compatibility aliases. Preserve raw/native Promise,
metadata separation, acquisition/lifetime/cleanup and generic inference contracts.
Work in /tmp/di-bag-api-renaming; preserve original dirty checkout. Push and merge
authorized by user; no force push or npm publication. Historical evidence is not
rewritten. Run compiler-heavy gates sequentially.

## Task 1: Coherent spelling migration (root)

- [x] Migrate runtime/type tests and consumers to all selected type, method and
  option names, then source and current docs/scripts. Use type-aware edits for
  ambiguous names such as add, metadata and alias; retain native runtime names.
- [x] Verify changed contracts fail against previous API before source migration.
- [x] Preserve ownership/type checks and document every mapping in migration guide.

## Task 2: Consolidated provider and facade API (implementer)

- [x] Add behavioral and type tests for combined metadata and transformation options;
  observe failure, implement overloads in provider.ts, then run focused contracts.
- [x] Implement fromFactory context selection, remove fromTokens public surface,
  and withConfiguration runtime inheritance/ordered observer append in di-bag.ts.
- [x] Consolidate register overloads in di-bag.ts/module.ts preserving admission and
  update public exports. Root migrates existing call sites and fixtures.
- [x] Run focused tests and typecheck, report signatures and remaining migrations.
- [x] Independent task review checks spec and quality; fix material findings.

## Task 3: Diagnostics and explanatory docs (root)

- [x] Reproduce disposal-count, closed-state and reentrant-cycle defects in tests.
- [x] Add coded structured library errors while preserving original application
  exceptions. Correct factual messages, source comments and type error details.
- [x] Update README, guides, examples, migration, changelog and publishing docs.
- [x] Review full rename inventory, generate reference docs and check site links.

## Task 4: Verification and integration (root)

- [x] Run full classic check, native typecheck/build/contracts, declaration consumers,
  Node scale regressions, examples, docs check/build and release/package tests.
- [x] Run applicable compiler-scale and portable platform evidence, review outputs.
- [x] Independent whole-branch review, fix material findings, final requirement audit.
Commit, push, remote checks, merge and main verification are authorized. The
associated PR and main-branch history record their outcome.
