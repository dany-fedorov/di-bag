# Native provider metadata implementation plan

> **For agentic workers:** Use subagent-driven-development for independent tasks;
> root coordinates shared files, final verification, and code review.

**Goal:** Make DI Bag self-contained while retaining typed acquisition metadata.
**Architecture:** Native factories/projections and Presence records; two native
metadata decorators reuse existing acquisition frames. Standalone release tooling.
**Tech Stack:** TypeScript, Bun, Node, npm, TypeDoc, VitePress.
**Spec:** docs/superpowers/specs/2026-09-10-native-provider-metadata-design.md

## Global constraints

No runtime dependencies. Preserve acquisition, graph, lifetime, and ownership
contracts. No edits to independent repositories or pre-existing untracked files.
No merge or force push. Separate agents own disjoint file sets below.
Final verification and delivery use the isolated `refactor/remove-box-adapters`
branch; preserve concurrent edits in the original checkout.

## Task 1: Native acquisition metadata

Owner: native metadata agent. Files: src/provider.ts, src/di-bag.ts,
src/provider-operations.ts and src/provider-execution.ts if necessary;
tests/acquisition-metadata.test.ts, tests/types/acquisition-metadata.ts and
negative counterpart. Add immediate and async decorators from the spec, tested
red/green. Consumers compose `DiBag.mapSync(DiBag.withAcquisitionMetadata(load,
r => ({ origin: r.origin })), r => r.value)`; async equivalent awaits `load`.
Tests prove lazy capture, typed ordered frames, independent retries/scopes,
shallow copies, errors and cleanup, raw/native Promise semantics, callback
validation, and optional values. New decorators appear on every Facade.

- [x] Write and run failing behavioral/type tests.
- [x] Implement native decorators and run focused tests.
- [x] Report exact signatures and reviewable changes to root.

## Task 2: Standalone package and release tooling

Owner: packaging agent. Files: package.json, package-lock.json,
tsconfig.build.json, scripts/create-release-manifest.ts,
scripts/verify-release-artifacts.ts, tests/release-artifacts.test.ts,
tests/package.test.ts, tests/native-package.test.ts, tests/box-package.test.ts,
tests/box-contract-fixtures.ts, tests/token-package.test.ts,
tests/platform-evidence.test.ts, tests/lifetime-declarations.test.ts and
archived tests/fixtures/box-packages. Remove extra package requirements,
subpath exports, cross-package matrix. Retain one-package archive integrity,
consumer and declaration checks. Coordinate renamed shared fixture helper with
root; root owns individual types/*.ts fixture migrations.

- [x] Adapt package consumer tests to standalone exports; verify old package fails.
- [x] Update package metadata, fixture harness, and single-package release checks.
- [x] Run package and release tests, report all changes and outstanding failures.

## Task 3: Native documentation

Owner: docs agent. Files: README.md, PUBLISHING.md, docs/guides/*.md,
docs/migrations/*.md, tools/docs configuration/coverage/test files, and
examples/box-adapters.ts (replace with examples/provider-metadata.ts).
Replace optional adapter guidance with native factories, Presence records,
static metadata and runtime acquisition metadata from Task 1. Remove current
research promoting external adapters. Audit older history/reports for obsolete
integration requirements; report their disposition. Do not regenerate reference
output until Task 1 is ready; root runs final generation.

- [x] Update guides, runnable native example, package and publishing documentation.
- [x] Update TypeDoc entry points and coverage tests for root/node only.
- [x] Validate Markdown links, report remaining historical references.

## Task 4: Root migration, integration, and verification

Owner: root. Files: src/index.ts, src/sas-box.ts, src/val-box.ts,
remaining tests/*.ts and tests/types/**/*.ts, generated docs/reference output.
Delete package-specific implementation and adapter-only runtime/type tests;
replace remaining fixtures with ordinary functions/records and native metadata
without reducing unrelated lifetime, inference, observer, or ownership coverage.
Remove stale build output before packaging. Add new metadata fixtures to compiler
consumer harness. Preserve the original three untracked user documents.

- [x] Migrate runtime and type fixtures and remove old public exports/implementations.
- [x] Reconcile tasks and run typecheck, full tests/build, native contracts, docs
  generation/check/build and package/release checks as appropriate.
- [x] Review complete diff with independent reviewer; fix material findings.
- Commit and push reviewable feature branch; report validation and limitations.

## Verification results

- The complete isolated `npm run check` passed: 887 tests, zero failures,
  TypeScript checking and a clean classic build. npm update notices were disabled.
- Native checking/build passed; all 124 native contract fixtures were accepted,
  with 635 expected diagnostics matched and no unexpected diagnostics.
- Documentation generation/check/build passed: 102 API pages, 197 checked
  TypeScript blocks, and 110 rendered pages with 13,436 verified links and assets.
- Independent review covered the native API, migrated contracts, package and
  release conversion, metadata timing, and clean-checkout verification fixes.
- Broader historical records and concurrent workspace work were preserved.
