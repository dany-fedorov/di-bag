# Documentation Phase D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all 20 findings and the 10 cross-page inconsistencies of the phase C review of the server, React, integration, and comparison guides.

**Architecture:** Docs-first, with three small code changes the findings require (a renamed example helper, a new integration test, and variable renames in the React example). Six tasks, one per page or concern, each ending green on `npm run docs:check`, `npm run docs:retired-names`, and `npm run docs:build`. The spec carries every replacement text and code block; tasks cite the spec's finding numbers and copy their text verbatim unless a step says otherwise.

**Tech Stack:** Markdown, TypeScript 6 (`tsc6`), Bun test runner (`npm run test:fast`), VitePress build.

**Spec:** `docs/superpowers/specs/2026-10-31-docs-review-phase-c-findings.md` (findings 1.1 to 3.8 and "Cross-page inconsistencies" 1 to 10).

## Global Constraints

- Branch `docs/phase-d`, created from `docs/follow-up` (which is PR #45 on top of `main`). Do not push or merge from inside a task.
- Human-facing pages pass `npm run docs:retired-names`: never write bag, scope, scopes, fork, cleanup, startup, family, "root lifetime", "acquisition mode", or a pre-0.5 API name (`replace(`, `register(`, `build(`, `fork(`); `scoped` is fine. No em-dashes in new prose.
- A `ts` block in a guide that imports only `di-bag` and `node:*` is compiled by `npm run docs:check` under `strict`; every block the spec marks as compiled must keep that property. An unused `@ts-expect-error` fails the check.
- Every claim of verification in a guide ("tested", "type-checked", "verifies") must name a test, script, or check that exists in the repository. Where none exists, weaken the claim; do not add an Elysia dependency (finding 3.2: take the "weaken the claim" option).
- Existing anchors linked from other pages keep working: `server-integration.md#close-each-request-container`, `#type-check-the-recipes` (new, finding 3.3), `react-integration.md#build-the-application-runtime-once`, `enterprise-integration.md` section ids. When a heading moves, keep its text so its id is unchanged; when a heading is renamed, add an explicit `{#old-id}`.
- `examples/README.md` rows and the README's guide links stay accurate after renames.
- `tests/react/*.test.ts` and `scripts/react-browser-lane.ts` must keep passing after any edit under `examples/react/`; `tests/enterprise-integration.test.ts` must pass after the helper rename.
- Commit messages end with the attribution trailer the implementer's harness instructs.

---

## Task 1: Reorder the server guide

Findings 2.1 and 2.4. Text moves only; no new prose except the two sentences the spec gives.

**Files:**
- Modify: `docs/guides/server-integration.md`

- [ ] **Step 1: Record the heading list before**

Run: `grep -n '^## \|^### ' docs/guides/server-integration.md > /tmp/server-headings-before.txt` and keep it for the report.

- [ ] **Step 2: Reorder per finding 2.1**

Produce this section order, moving whole sections (heading to the line before the next heading of the same or higher level) with a script or careful cut and paste:

1. The opening (title, breadcrumb, intro paragraphs, Contents list).
2. "Build the application once" (currently the single-container section).
3. "Choose the owner of each service" (the owner table).
4. "One child container per request" (the request-container section). Change its first sentence to: `Add a per-request value to the application from the previous section.` Keep the rest.
5. "Close each request container".
6. "Make services ready before listening": the current "Readiness failures and deadlines" section moved here, shortened to its first code block plus the two sentences that explain that a failed `ensureServicesReady` has already closed the container and that `totalTimeoutMs` and `abortSignal` bound the wait. Keep the heading text `Readiness failures and deadlines` so its id survives; put the new title as a sentence, not a heading.
7. "Connect a shutdown signal", minus its bounded-wait code block and the paragraph around it.
8. The host recipes in order: Node HTTP, Express, Fastify, Bun, Elysia, Deno.
9. A new `## Bound the shutdown wait` section holding the bounded-wait block and paragraph removed in 7.
10. Disconnects, streaming, and WebSockets; Background jobs; the test section; Organize a larger application; Troubleshooting (unchanged order).

- [ ] **Step 3: Split Deno from portable acquisition per finding 2.4**

Rename the section "Deno and portable acquisition" to `## Deno {#deno-and-portable-acquisition}` (explicit old id). Keep its first two paragraphs (Deno needs nothing extra), then the `server.ts` block. Move the browser-and-worker `application.ts` material into a new section placed after "Bound the shutdown wait": `## Browsers, workers, and other hosts without process.getBuiltinModule`, opened with the two sentences in finding 2.4 ("No server on this page needs this. Read it when the same `application.ts` must also load in a browser or worker; the [React guide](react-integration.md#build-the-application-runtime-once) is the browser recipe.").

- [ ] **Step 4: Update the Contents list**

Rewrite the Contents list at the top so it lists the sections in the new order with their anchors.

- [ ] **Step 5: Check and commit**

Run: `npm run docs:check && npm run docs:retired-names && npm run docs:build`
Expected: PASS. Diff the heading list: `grep -n '^## \|^### ' docs/guides/server-integration.md` must contain every heading from Step 1 (renamed ones with their explicit old id) plus the two new ones.

```bash
git add docs/guides/server-integration.md
git commit -m "docs: order the server guide from one container to request containers to hosts"
```

---

## Task 2: Server guide text: hook, type-check section, Elysia, modules, troubleshooting

Findings 1.3, 2.3, 2.6, 3.2 (weaken), 3.3, 3.7; cross-page items 6 and 9.

**Files:**
- Modify: `docs/guides/server-integration.md`
- Modify: `README.md` (one sentence, cross-page item 6)

- [ ] **Step 1: Replace the opening (finding 1.3)**

Replace the intro paragraphs between the breadcrumb line and the Contents list with the three paragraphs in finding 1.3 verbatim.

- [ ] **Step 2: Add the type-check section (finding 3.3)**

Insert `## Type-check the recipes {#type-check-the-recipes}` with the spec's text, JSON block, and shell block directly after the Contents list. Add it to the Contents list.

- [ ] **Step 3: Elysia (findings 2.6 and 3.2)**

In the Elysia section: replace the inline graph definition with the five-line import block from finding 2.6; use `createRequestContainer(app, crypto.randomUUID())` in `derive`; listen on `{ port: 3000, hostname: '127.0.0.1' }`; use `onShutdown(() => server.stop())` if `onShutdown` accepts a function returning `void | Promise<void>` (check `node-shutdown.ts` as shown earlier on the page; if it requires a Promise, wrap: `onShutdown(async () => { await server.stop(); })`). Replace the "type-checked against that package" sentences with the finding 3.2 "weaken the claim" paragraph verbatim.

- [ ] **Step 4: Modules in "Organize a larger application" (finding 2.3)**

Insert the `### Split features into modules` paragraph and the compiled block from finding 2.3 before the table; change the table's first row to list `buildModule, withInstalledModules, withRenamedRequirement, withRenamedExport` with link text "Build modules as units of work" pointing at `tutorial.md#reuse-named-modules`.

- [ ] **Step 5: Troubleshooting and option names (finding 3.7)**

Change the lifetime sentence to name `allowsScopedDependencies: true` as the spec says. Replace the troubleshooting table with the spec's table verbatim.

- [ ] **Step 6: Job comment (cross-page item 9)**

In the background-jobs snippet, replace the comment `Acknowledge the message after work and disposal succeed` with `The request helper is reused on purpose: a job is one owned operation.` and add after the block one sentence: `Acknowledge the message only after this call resolves.`

- [ ] **Step 7: README "tested recipes" (cross-page item 6)**

In `README.md` "Tradeoffs and limits", change `are tested recipes for both` to `are recipes for both; the React recipe runs in CI, the server recipes compile where they import only di-bag`.

- [ ] **Step 8: Check and commit**

Run: `npm run docs:check && npm run docs:retired-names && npm run docs:build`
Expected: PASS; the new compiled blocks (finding 2.3's) are in the snippet count.

```bash
git add docs/guides/server-integration.md README.md
git commit -m "docs: give the server guide a checkable opening, a type-check section, and an error table"
```

---

## Task 3: Integration guide and the owned-container helper

Findings 1.4, 2.2, 3.1, 3.4; cross-page items 1 (integration page name), 2, 3.

**Files:**
- Rename: `examples/integration/owned-scope.ts` → `examples/integration/owned-container.ts`
- Modify: `tests/enterprise-integration.test.ts`
- Modify: `docs/guides/enterprise-integration.md`, `docs/guides/server-integration.md` (one sentence and the breadcrumb), `README.md` (link texts), `docs/README.md` (row text), `examples/README.md` (row), `tools/docs/vitepress.config.mjs` (no change expected; verify the label is "Integration patterns")

- [ ] **Step 1: Rename the helper (finding 3.4)**

`git mv examples/integration/owned-scope.ts examples/integration/owned-container.ts`. Rename the function to `withOwnedContainer`, its parameter to `container`, the doc comment to `/** Application recipe: acquire a fresh owned container, run work, then close it. */`, and the message to `'Work and container disposal both failed'`. Update every import and assertion in `tests/enterprise-integration.test.ts`. Run: `bun test tests/enterprise-integration.test.ts`. Expected: PASS.

- [ ] **Step 2: Add the independent-container test (finding 3.1)**

In `tests/enterprise-integration.test.ts`, next to the test "test substitutions retain private module contracts…", add a test that builds the same private-module graph, calls `original.createIndependentContainer(['clock'], { clock: () => ({ now: () => 7 }) })`, asserts the module's exported `result` resolves to `7` in the fixture and to the original clock's value in `original`, and closes both. Run the file; expected PASS.

- [ ] **Step 3: Rewrite the integration guide**

- H1 → `# Integration patterns: dynamic features, fixtures, and framework boundaries` (finding 1.4). Keep the old H1's id by adding `{#request-containers-test-fixtures-and-dynamic-features}`.
- Opening paragraph → finding 1.4's paragraph; then finding 1.4's compiled block.
- "One child container per operation" → the four-line section from finding 2.2, linking `../../examples/integration/owned-container.ts`.
- "Checked test substitutions" → finding 3.1's compiled block, then the sentence `The integration suite verifies this with both createIndependentContainer and builder.withReplacedService.` (with backticks on the two names), then the existing Nest/Angular paragraph.
- Keep the dynamic-features section after these, trimmed of anything the new opening block already shows.

- [ ] **Step 4: Names and links (cross-page items 1 and 2)**

- `server-integration.md` breadcrumb: the link to this page reads `Integration patterns`.
- `server-integration.md`: the sentence introducing the helper reads `Save the following helper as owned-container.ts. It is a copy of [examples/integration/owned-container.ts](../../examples/integration/owned-container.ts), which tests/enterprise-integration.test.ts exercises.` (backticks on file names).
- `README.md`: both links to the page read `Integration patterns`.
- `docs/README.md`: the row's link text reads `Integration patterns`.
- `examples/README.md`: the row becomes `[integration/owned-container.ts](integration/owned-container.ts) | The withOwnedContainer helper the server and integration guides teach; tests/enterprise-integration.test.ts exercises it.` (backticks as in the other rows).

- [ ] **Step 5: Check and commit**

Run: `npm run docs:check && npm run docs:retired-names && npm run docs:build && bun test tests/enterprise-integration.test.ts`
Expected: PASS.

```bash
git add -A examples/integration tests/enterprise-integration.test.ts docs/guides/enterprise-integration.md docs/guides/server-integration.md README.md docs/README.md examples/README.md
git commit -m "docs: make the integration guide lead with its tested dynamic-feature recipe and one owned-container helper"
```

---

## Task 4: React guide

Findings 1.1, 2.5, 3.5, 3.8 (React part); cross-page item 10 (React example vocabulary).

**Files:**
- Modify: `docs/guides/react-integration.md`
- Modify: `examples/react/project-runtime.ts`, `examples/react/app-runtime.ts` (variable and comment renames only)

- [ ] **Step 1: Opening (finding 1.1)**

Replace the opening paragraphs (after the breadcrumb, before the first heading) with finding 1.1's four paragraphs verbatim.

- [ ] **Step 2: Owner table and untested patterns (finding 2.5)**

Reduce "Who owns what" to the Application and Project rows; add the `## Beyond this recipe (not tested)` section from finding 2.5 before "When this becomes a package".

- [ ] **Step 3: Make the project-runtime block compile (finding 3.5, option a)**

Move `DocumentsStore`, `ProjectServices`, and `ProjectRuntime` (finding 3.5's definitions) into the compiled block after `AppRuntime`. Merge the project-runtime block into that compiled block so the page has one compiled `ts` block followed by prose, and make the two resolves `await Promise.all([...])` as the spec shows. Confirm with `npm run docs:check` that the merged block compiles.

- [ ] **Step 4: Example vocabulary (finding 3.5 step 4; cross-page item 10)**

In `examples/react/project-runtime.ts` and `examples/react/app-runtime.ts`, rename the variable `bag` to `container` and reword the comments "the bag never disposes it" and "acquisition mode" without retired words. Run: `bun test tests/react` and `npm run check:react-browser` (if Playwright's Chromium is installed; if the lane cannot run locally, say so and rely on CI's `portable` job).

- [ ] **Step 5: Comparison table provenance (finding 3.8)**

Under the comparison heading add `Reviewed against each project's documentation on 2026-10-31: Obsidian <version>, inversify-react <version>, react-ioc <version>.` with versions from `npm view <package> version` (run it; if the registry is unreachable, write `(version not checked)` and say so). Rewrite the sweeping sentence to `None of the three documents asynchronous service readiness, cancellation of a replaced readiness attempt, or teardown that outlives effect disposal.`

- [ ] **Step 6: Check and commit**

Run: `npm run docs:check && npm run docs:retired-names && npm run docs:build && bun test tests/react`
Expected: PASS.

```bash
git add docs/guides/react-integration.md examples/react/project-runtime.ts examples/react/app-runtime.ts
git commit -m "docs: state what the React guide tests, compile its runtime block, and retire old words in the example"
```

---

## Task 5: Comparison guide

Findings 1.2, 1.5, 2.7, 3.6, 3.8 (comparison part); cross-page items 5 and 7.

**Files:**
- Modify: `docs/guides/comparison.md`

- [ ] **Step 1: Hook and structure (finding 1.5)**

Replace the opening through the "radical modularity" paragraph with: the two-sentence hook (finding 1.5 item 1), the compiled block and follow-up sentence from finding 3.6, and a copy of the README's six-row comparison table with each row linking to its `###` section below. Rename the H1 to `# Comparison with alternatives {#choosing-a-dependency-injection-approach}` (cross-page item 1). Replace "Radical modularity" with "Modules as units of work" linking `examples-modularity.md` and `../../AGENTS.md#module-layout` (cross-page item 5).

- [ ] **Step 2: The singleton rule (finding 1.2)**

Move the lifetime paragraph into "Costs and limits" (or the lifetimes row of the new table) with the corrected sentence from finding 1.2 verbatim.

- [ ] **Step 3: Per-library table (finding 2.7)**

After "What type-safe means here", add the spec's table; fill each cell only from sources already cited in the subsections, leaving a cell blank where the cited docs do not say, and link each filled cell to the sentence it summarizes.

- [ ] **Step 4: Cycle detection sentence (finding 3.6, cross-page item 7)**

Replace "Dependency cycles are detected during resolution" with the spec's sentence linking `../../tools/graph/README.md`.

- [ ] **Step 5: Versions and date (finding 3.8)**

Add a "Versions reviewed" line: for each library run `npm view <package> version` and record it; replace `blob/master` links with `blob/v<version>` permalinks only where `curl -sI` returns 200 for the new URL, otherwise keep the existing link. Update the review date to 2026-10-31 and re-read each subsection's claims against the cited pages (fetch them; if a fetch fails, keep the claim and note it in the report).

- [ ] **Step 6: Check and commit**

Run: `npm run docs:check && npm run docs:retired-names && npm run docs:build`
Expected: PASS; the finding 3.6 block compiles with its `@ts-expect-error` consumed.

```bash
git add docs/guides/comparison.md
git commit -m "docs: open the comparison with the compile-time check and a summary table"
```

---

## Task 6: Cross-page cleanup and gates

Cross-page items 3, 4, 10 (documentation.md sentence); final verification.

**Files:**
- Modify: `docs/guides/server-integration.md`, `docs/guides/react-integration.md` (duplicate paragraph), `docs/guides/documentation.md`

- [ ] **Step 1: One copy of the "tracks acquisition work" paragraph (cross-page item 3)**

Keep the paragraph in the server guide's "Disconnects, streaming, and WebSockets" section with an explicit id `{#acquisition-not-method-calls}`. In the React guide's close-timeout passage, replace the duplicate with one sentence linking `server-integration.md#acquisition-not-method-calls`. (Task 3 already removed the integration guide's copy.)

- [ ] **Step 2: One canonical test-substitution example (cross-page item 4)**

In the server guide's test section, keep the code but add one sentence before it: `The same pattern with a module fixture is the [fixture-test recipe](../agent/recipes.md#fixture-test).`

- [ ] **Step 3: Say which guide blocks are compiled (cross-page item 10)**

In `docs/guides/documentation.md`, change the sentence that says `docs:check` type-checks only AGENTS.md, `docs/agent/*.md`, and `@example`s so it also says: `and every ts block in README.md and docs/guides/*.md that imports only di-bag and node:* modules`.

- [ ] **Step 4: Full gates**

```bash
npm run docs:generate && git status --short docs/reference docs/agent
npm run docs:check
npm run docs:retired-names
node --test --test-isolation=none tools/docs/test/*.test.mjs
npm run docs:build
npm run typecheck
npm run test:fast
bun test tests/release-artifacts.test.ts --timeout=30000
```

Expected: every command exits 0; `git status` after generate is empty.

- [ ] **Step 5: Commit**

```bash
git add docs/guides/server-integration.md docs/guides/react-integration.md docs/guides/documentation.md
git commit -m "docs: remove duplicated passages across the server, React, and integration guides"
```
