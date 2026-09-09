# Enterprise verification implementation plan

> **For agentic workers:** Use executing-plans to implement tasks in order.

**Goal:** Close the current parity-review and repeatable verification gaps, then push the verified branch.

**Architecture:** Retain the existing DI API and platform archive oracles. Add local executable pin capture, locked platform tools, a strict platform acceptance mode and CI; publish an explicit NestJS/Angular parity assessment.

**Tech Stack:** TypeScript 6.0.3 and native 7.0.2, Node 24.20.0, Bun 1.4.0, Deno 2.9.6, esbuild 0.28.2, Playwright 1.63.0 and its Chromium build.

**Spec:** `docs/superpowers/specs/2026-09-09-enterprise-verification-design.md`.

## Global constraints

- No required decorators, reflect-metadata, parameter-name parsing, custom compiler transforms, or dynamic code generation.
- Preserve exact synchronous versus Promise-valued service types; never silently await an ordinary factory dependency.
- No production dependency changes; no weakening of compiler, archive or lifecycle oracles.
- Preserve the existing untracked execution handoff.
- Run compiler-heavy gates serially under `/tmp/di-bag-compiler-heavy.lock`.
- Push is explicitly authorized; publication and source tagging are outside this task.

## Task 1: Required platform evidence

Files: `scripts/platform-evidence.ts`, `tests/platform-evidence.test.ts`.

- [x] Add failing tests calling `platformEvidenceExitCode(rows, true)` for a
  canonical all-pass matrix (0), unavailable Deno/browser (1), missing rows (1),
  duplicate rows (1), reordered rows (1), and a failed browser (1).
- [x] Verify RED with `bun test tests/platform-evidence.test.ts -t 'required platform'`.
- [x] Add a default-false `required` boolean and validate the canonical matrix
  before applying `rows.every(row => row.status === 'pass')` in strict mode.
  Parse only zero arguments or `--required` in the CLI; reject unknown options.
- [x] Test local manifest precedence and malformed-local rejection, then make
  `readManifest` prefer the ignored local file when it exists.
- [x] Run the focused platform suite.

## Task 2: Reproducible host provisioning and CI

Files: `scripts/pin-platform-tools.ts`, `tests/platform-tools.test.ts`,
`tools/platform/package.json`, `tools/platform/package-lock.json`, `.gitignore`,
`.github/workflows/ci.yml`, `package.json`, `README.md`.

- [x] Add failing real-process tests for exported
  `captureToolPin(argv, expectedVersion, versionArgs)` and check returned hashes,
  version mismatch, stderr, nonzero exits and missing executables.
- [x] Implement bounded version probes and executable hashes. Discover Node,
  npm, Bun and the installed classic compiler; require pinned foundation versions.
  `--all` resolves the three platform packages from `tools/platform`, checks their
  locked versions, and obtains Chromium's executable and expected browser version
  from Playwright's installed metadata. Write a complete local manifest only after
  every selected tool succeeds. Reject unknown CLI arguments.
- [x] Pin Deno 2.9.6, esbuild 0.28.2 and Playwright 1.63.0 in a private tools
  package; install with `npm install --prefix tools/platform --no-audit --no-fund`
  and install its Chromium build into an ignored local browser cache.
- [x] Add `platform:pin` and `check:platform` npm scripts. Create a read-only
  push/PR workflow using Node 24.20.0/Bun 1.4.0, `npm ci`, foundation pinning,
  `npm run check` and native checks, then platform tool `npm ci`, Chromium
  installation, all-tool pinning and `npm run check:platform`. Upload evidence
  even after failure. Use immutable action revisions verified from upstream.
- [x] Run local Deno/Chromium package evidence and the provisioned platform tests.
  Investigate actual failures without changing their expected service results.

## Task 3: Parity review, verification and push

Files: new `docs/research/2026-09-09-enterprise-parity.md`, new readiness report,
`README.md`, enterprise program tracker.

- [x] Research NestJS/Angular and established containers against official sources;
  map every DI capability to public APIs and tests and record differences/gaps.
- [x] Create `examples/integration/owned-scope.ts` with
  `withOwnedScope<S extends { close(): Promise<void> }, R>(acquire: () => S | Promise<S>, work: (scope: S) => R): Promise<Awaited<R>>`.
  First add `tests/enterprise-integration.test.ts` proving overlapping request
  scopes observe distinct overrides through private module dependencies while
  sharing one root service, close their own resources exactly once, and preserve
  handler plus cleanup errors. Add a local dynamic-import fixture proving typed
  module installation, contribution ordering, selected startup and owned unload.
  Record RED, implement the executor, and run the runtime tests and typecheck.
  Explain the executable recipe in `docs/guides/enterprise-integration.md`.
- [x] Resolve actionable findings and document exact supported boundaries;
  reconcile stale tracker statements against current release evidence.
- [x] Run `npm run check`, native typecheck/build/audit, all runnable examples,
  strict platform evidence and independent review. Retain actual output counts.
- [x] Run `git diff --check`, inspect the complete staged file list, commit only
  task-owned changes, push `HEAD:feat/v0.1`, and verify remote SHA equals local HEAD.
- [x] Audit the full user objective and original enterprise acceptance rows before
  marking complete; missing evidence or parity remains unfinished work.

## Hosted CI follow-up

The first hosted run found fresh-checkout assumptions after the local gates and
initial push. Delivery remains open until these corrections pass hosted CI.

- [x] Install the tracked sas-box/val-box archives as development dependencies
  and import their public exports in the adversarial source fixtures.
- [x] Copy the active platform identity into the broken-archive fixture, so
  missing build input remains the reason for failure on every provisioned host.
- [x] Give real browser protocol mutations the existing production lane budget,
  including cold startup; retain the deliberately short timeout mutation.
- [x] Reproduce the remaining release-verifier setup failure in an isolated
  clone and replace ignored sibling paths with fixture-owned canonical
  directories while preserving all production validation.
- [x] Add live-process, pending-exit-callback and post-exit `ESRCH` regressions;
  route `ESRCH` through the existing disappearance probe and retain all resource
  limits, live-monitor rejection and stream draining. Include exact process
  metadata in compiler failure messages.
- [x] Verify the checkout/setup corrections locally and in an isolated clone,
  and obtain an independent review with no actionable findings.
- [x] Verify the supervisor correction with all 16 focused tests, both source
  typecheckers and an independent code review. Full gates remain a separate
  acceptance requirement below.

Delivery requires pushing the follow-up and observing both hosted jobs pass for
the delivered revision. The [branch workflow history](https://github.com/dany-fedorov/di-bag/actions/workflows/ci.yml?query=branch%3Afeat%2Fv0.1)
is the revision-specific acceptance record; local success alone does not establish
hosted acceptance.
