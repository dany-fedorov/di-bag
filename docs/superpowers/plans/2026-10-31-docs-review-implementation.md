# Documentation Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all twenty findings of the 2026-10-31 documentation review: a true hook in the README, a module-first reading order for humans, and a complete, example-rich API surface for coding agents.

**Architecture:** Docs-only change in four phases. Phase 1 extends the generated agent docs (JSDoc `@example` blocks, the API card generator's surface, the task table, `llms.txt`). Phase 2 rewrites the top of the README around a compiler-verified demonstration and a one-screen module. Phase 3 reorders the site, the tutorial, and the two "Why DI Bag?" guides, unifies the module vocabulary, and indexes the examples. Phase 4 runs every documentation gate. Each task ends green on `npm run docs:check` or the narrower command named in the task.

**Tech Stack:** Markdown, TypeDoc 0.28 Markdown output (`tools/docs/generate.mjs`), VitePress 1.6.4 (`tools/docs/site.mjs`), Node test runner for `tools/docs/test/*.test.mjs`, TypeScript 6.0.3 for snippet checks.

**Spec:** `docs/superpowers/specs/2026-10-31-docs-review-findings.md`

## Global Constraints

- Branch from `next`: `git switch -c docs/review-findings next`. Do not push, merge, publish, or bump the version.
- `AGENTS.md` is at 149 of its 150-line budget (`agentsBudget` in `tools/docs/lib/agent-docs.mjs`). Any addition replaces an existing line.
- The API card budget `cardBudget` is 400 lines; this plan raises it to 460 in Task 1 because the card gains six entries and the task table gains eleven rows.
- Each recipe section in `docs/agent/recipes.md` stays under 60 lines. This plan does not add recipes.
- The `text` block under "Recommended module layout" in `docs/guides/examples-modularity.md` must stay byte-identical to the one in `AGENTS.md` (`checkLayoutBlock`). Move prose around it; never edit the block.
- Human-facing pages must pass `npm run docs:retired-names`: never write the words `bag`, `scope`, `scopes`, `fork`, `cleanup`, `startup`, `family`, `root lifetime`, `acquisition mode`, or any pre-0.5 API name. `scoped` is allowed. `DI Bag`, `DiBag`, `di-bag-graph`, `DI_BAG_*`, "options bag" are allowed.
- A `ts` block in `README.md` or `docs/guides/*.md` that imports only `di-bag` and `node:*` modules is compiled by `npm run docs:check` and must type-check with `strict`. A `ts` block with a relative import is not compiled.
- Every `@example` in `src/**/*.ts` is compiled by `npm run docs:check`; `import { DiBag } from 'di-bag';` is prepended when the example has no import line.
- Every hook claim must be true of the repository as it is: the npm package ships `dist`, `AGENTS.md`, and `docs/agent` (`package.json` `files`); there are zero runtime dependencies; TypeScript 6.0.3 is the minimum; `tsc` reports `required services are missing: <keys>` for a missing dependency.
- Keep these README anchors: `#why-di-bag`, `#install`, `#quickstart`, `#give-resources-a-clear-owner`, `#tradeoffs-and-limits`, `#runtime-support`, `#modules-as-units-of-work`, `#how-it-compares`. Keep every tutorial anchor, including `#reuse-named-modules`.
- Prose style follows the existing pages: short sentences, no em-dashes, one idea per sentence, method names in backticks.
- Commit after every task with a `docs:` or `feat(docs):` message. Each commit ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## Task 0: Branch and toolchain

**Files:** none changed.

- [ ] **Step 1: Create the branch**

```bash
cd /home/df/wd/personal/di-bag
git switch -c docs/review-findings next
```

- [ ] **Step 2: Install both dependency sets**

```bash
npm ci
npm ci --prefix tools/docs
```

- [ ] **Step 3: Confirm the gates are green before any change**

```bash
npm run docs:generate
npm run docs:check
npm run docs:retired-names
git status --short
```

Expected: `docs:check` prints `Agent docs are consistent: N snippets type-check against the emitted declarations.`; `git status` is clean (the generator reproduces the committed reference). If `git status` shows changes under `docs/reference` or `docs/agent/api-card.md`, stop and report: the committed reference is stale on `next`, and that must be fixed in its own commit first.

---

# Phase 1: agent docs (findings 15, 16, 17, 18, 19, 20)

## Task 1: Complete the API card surface

Findings 15, 17, 18. The card generator in `tools/docs/lib/api-card.mjs` covers `DiBagApi`, `Builder`, `Module` (only `withRenamedRequirement`), and `Container`. Add `Module.withRenamedExport`, the `Module.moduleLabel` accessor, and a new `FactoryContext` group with `abortSignal` and `pushDisposer`, and make the snapshot examples read a field.

**Files:**
- Modify: `src/acquisition-context.ts` (JSDoc on `DisposerContext`, `FactoryContext.abortSignal`, `FactoryContext.pushDisposer`)
- Modify: `src/module.ts:61-76` (JSDoc on `moduleLabel` and `withRenamedExport`)
- Modify: `src/di-bag.ts:185-258` (JSDoc on `serviceSnapshot` and `graphSnapshot`)
- Modify: `tools/docs/lib/api-card.mjs` (`surfaceGroups`, `entry`, accessor and property titles)
- Modify: `tools/docs/lib/agent-docs.mjs:7` (`cardBudget`)
- Modify: `tools/docs/test/api-card.test.mjs`
- Regenerate: `docs/agent/api-card.md`, `docs/reference/**`

**Interfaces:**
- Produces card entries named `module.withRenamedExport`, `module.moduleLabel`, `factoryContext.abortSignal`, `factoryContext.pushDisposer`, under card headings `## Module {#module}` and `## Factory context {#factory-context}`. Task 2 references these names in `api-card-tasks.json`.

- [ ] **Step 1: Write the failing generator test**

Append to `tools/docs/test/api-card.test.mjs`:

```js
test('the card lists module views, the module label, and the factory context', () => {
  const names = runtimeSurface(project).map(item => item.name);
  for (const name of ['module.withRenamedRequirement', 'module.withRenamedExport', 'module.moduleLabel', 'factoryContext.abortSignal', 'factoryContext.pushDisposer']) {
    assert(names.includes(name), name);
  }
  const card = renderApiCard(project, tasks);
  assert.ok(card.includes('### `module.moduleLabel` {#module-modulelabel}'), 'accessor title has no parentheses');
  assert.ok(card.includes('### `factoryContext.abortSignal` {#factorycontext-abortsignal}'), 'property title has no parentheses');
  assert.ok(card.includes('### `factoryContext.pushDisposer(disposer)` {#factorycontext-pushdisposer}'));
  assert.ok(card.includes('## Factory context {#factory-context}'));
  assert.ok(card.indexOf('## Module {#module}') < card.indexOf('## Container {#container}'));
  assert.ok(card.indexOf('## Container {#container}') < card.indexOf('## Factory context {#factory-context}'));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test --test-isolation=none tools/docs/test/api-card.test.mjs`
Expected: FAIL with `module.withRenamedExport` (the first missing name).

- [ ] **Step 3: Extend the generator**

In `tools/docs/lib/api-card.mjs`:

Replace the `surfaceGroups` export with:

```js
import { ReflectionKind } from 'typedoc';
import { cardBudget, codeFragment } from './agent-docs.mjs';

/** The runtime surface the card covers, besides the exported error classes. */
export const surfaceGroups = [
  { name: 'DiBagApi', receiver: 'DiBag', title: 'DiBag facade' },
  { name: 'Builder', receiver: 'builder', title: 'Builder' },
  { name: 'Module', receiver: 'module', title: 'Module', members: ['moduleLabel', 'withRenamedExport', 'withRenamedRequirement'] },
  { name: 'Container', receiver: 'container', title: 'Container' },
  { name: 'FactoryContext', receiver: 'factoryContext', title: 'Factory context' },
];
```

Replace the `entry` function with one that also reads an accessor's getter comment and renders a property or accessor without parentheses:

```js
function entry(reflection, group, receiver) {
  const comments = [
    { comment: reflection.comment },
    ...(reflection.signatures ?? []).map(signature => ({ comment: signature.comment, signature })),
    ...(reflection.getSignature ? [{ comment: reflection.getSignature.comment }] : []),
  ].filter(item => item.comment);
  // The comment carrying the example supplies the summary and, for an overload, the signature.
  const carrier = comments.find(item => examples(item.comment).length);
  const name = receiver ? `${receiver}.${reflection.name}` : reflection.name;
  const codes = receiver
    ? [...new Set(comments.flatMap(item => tags(item.comment, '@throws')).flatMap(tag => partText(tag.content).match(/DI_BAG_[A-Z_]+/g) ?? []))]
    : codeLiterals(reflection);
  const signature = carrier?.signature ?? callSignatures(reflection)[0];
  // A value member (property or accessor) reads as `receiver.name`; a callable one as a call.
  const isValueMember = reflection.kind === ReflectionKind.Accessor || (reflection.kind === ReflectionKind.Property && !callSignatures(reflection).length);
  return {
    group, name, id: anchor(name), line: line(reflection),
    title: receiver && !isValueMember ? `${name}(${parameters(signature).join(', ')})` : name,
    summary: cardSummary(carrier?.comment ?? comments[0]?.comment, name),
    examples: carrier ? examples(carrier.comment) : [],
    codes, codeLabel: receiver ? 'Throws' : 'Code',
  };
}
```

`line(reflection)` already sorts members by source line, so `moduleLabel` (line 62) precedes `withRenamedExport` (line 78) and `withRenamedRequirement`.

In `tools/docs/lib/agent-docs.mjs` change line 7 to:

```js
export const cardBudget = 460;
```

- [ ] **Step 4: Add the JSDoc examples the generator now requires**

`renderApiCard` refuses a runtime call without an `@example`, so the test still fails until every new member has one. Edit `src/acquisition-context.ts`:

```ts
/**
 * Why a pushed disposer is running: the factory never returned, or it did and the
 * service disposer — the `withDisposal` on the value this factory returned — has
 * just run. Ownership a consumer attaches to a transformed value does not count.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#release-partial-acquisition
 * @example
 * ```ts
 * type Socket = { close(): Promise<void> };
 * declare function open(url: string): Promise<Socket>;
 * const socket = DiBag.providerWithDisposal({
 *   provider: DiBag.createProvider(async ({ url }: { url: string }, factoryContext) => {
 *     const connection = await open(url);
 *     // Runs at once if a later step fails; at close() it sees 'service-disposed' and does nothing.
 *     factoryContext.pushDisposer(disposerContext => { if (disposerContext.reason !== 'service-disposed') return connection.close(); });
 *     return connection;
 *   }, { factoryReceivesContext: true }),
 *   disposeService: connection => connection.close(),
 * });
 * ```
 */
export interface DisposerContext {
```

Keep the `reason` property comment as it is. Then on `FactoryContext`:

```ts
export interface FactoryContext {
  /**
   * Aborted when the acquisition's owning container begins closing.
   * @example
   * ```ts
   * declare function fetchCatalog(signal: AbortSignal): Promise<string[]>;
   * const catalog = DiBag.createProvider(async (_dependencies: {}, factoryContext) => fetchCatalog(factoryContext.abortSignal), {
   *   factoryReceivesContext: true, factoryReturnKind: 'native-promise',
   * });
   * ```
   */
  readonly abortSignal: AbortSignal;
  /**
   * Own a resource acquired during this factory call; pushed disposers run once in reverse order.
   * Pass the release callback itself, such as `() => socket.close()`, rather than calling it here.
   * @param disposer - Releases the acquired resource when the factory fails or the container closes.
   * @throws `DI_BAG_DISPOSER_PUSHED_AFTER_FACTORY` when called after the factory settled.
   * @example
   * ```ts
   * declare function openLock(name: string): Promise<{ release(): Promise<void> }>;
   * const worker = DiBag.createProvider(async ({ name }: { name: string }, factoryContext) => {
   *   const lock = await openLock(name);
   *   factoryContext.pushDisposer(() => lock.release()); // released at close(), or at once if the next line throws
   *   return { name };
   * }, { factoryReceivesContext: true });
   * ```
   */
  pushDisposer(this: void, disposer: (this: void, disposerContext: DisposerContext) => void | Promise<void>): void;
}
```

Edit `src/module.ts`. Replace the `moduleLabel` comment:

```ts
  /**
   * The exact label supplied when this module was sealed, if any. Reading it never acquires a service.
   * @example
   * ```ts
   * const feature = DiBag.createBuilder().withServices({ answer: () => 42 })
   *   .buildModule({ exportedServiceKeys: ['answer'], moduleLabel: 'answers' });
   * const label: string | undefined = feature.moduleLabel; // 'answers'
   * ```
   */
  get moduleLabel(): string | undefined {
```

Replace the `withRenamedExport` example so it shows the renamed export in use:

```ts
   * @example
   * ```ts
   * const feature = DiBag.createBuilder().withServices({ service: () => 1 })
   *   .buildModule({ exportedServiceKeys: ['service'] });
   * const renamed = feature.withRenamedExport({ currentExportKey: 'service', newExportKey: 'featureService' });
   * const app = DiBag.createBuilder().withInstalledModules([renamed]).buildContainer();
   * const value: number = app.resolve('featureService');
   * await app.close();
   * ```
```

Edit `src/di-bag.ts`. Replace the `serviceSnapshot` example (the one at line 193, on the string-key overload):

```ts
   * @example
   * ```ts
   * const container = DiBag.createBuilder().withServices({ greeting: () => 'hello' }).buildContainer();
   * const snapshot = container.serviceSnapshot('greeting');
   * console.log(snapshot.bindingLabel, snapshot.lifetime, snapshot.acquisitions.length); // greeting scoped:one-per-container 0
   * await container.close();
   * ```
```

Replace the `graphSnapshot` example:

```ts
   * @example
   * ```ts
   * const billing = DiBag.createBuilder().withServices({ ledger: () => new Map<string, number>() })
   *   .buildModule({ exportedServiceKeys: ['ledger'], moduleLabel: 'billing' });
   * const container = DiBag.createBuilder().withInstalledModules([billing]).buildContainer();
   * const graph = container.graphSnapshot();
   * const installation = graph.moduleInstallations[0]!; // { installationId, moduleLabel: 'billing', parentInstallationId: undefined }
   * const owned = graph.bindings.filter(binding => binding.moduleInstallationId === installation.installationId).map(binding => binding.bindingLabel);
   * await container.close();
   * ```
```

- [ ] **Step 5: Run the generator test and the generator**

Run: `node --test --test-isolation=none tools/docs/test/api-card.test.mjs`
Expected: PASS, all tests.

Run: `npm run docs:generate`
Expected: `Generated N API Markdown pages ... valid TypeScript blocks.` and `docs/agent/api-card.md` now contains `## Factory context {#factory-context}`.

If `docs:generate` reports a TypeDoc validation warning for the new `@throws` on `pushDisposer`, keep the tag: `@throws` is used on every other member. If it reports an unknown symbol in `@see`, leave the existing `@see` lines unchanged.

- [ ] **Step 6: Run the snippet check**

Run: `npm run docs:check`
Expected: PASS. If the snippet compiler rejects `_dependencies: {}` as an unused parameter, rename it to `dependencies` and read nothing from it; `noUnusedParameters` is not set in the snippet workspace, so this is unlikely.

- [ ] **Step 7: Commit**

```bash
git add src/acquisition-context.ts src/module.ts src/di-bag.ts tools/docs/lib/api-card.mjs tools/docs/lib/agent-docs.mjs tools/docs/test/api-card.test.mjs docs/agent/api-card.md docs/reference
git commit -m "docs: complete the API card surface with module views and factory context

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 2: Fill the "one way per task" table

Finding 16. The table is rendered from `tools/docs/api-card-tasks.json`; every `call` must name a card entry.

**Files:**
- Modify: `tools/docs/api-card-tasks.json`
- Modify: `tools/docs/test/api-card.test.mjs`
- Regenerate: `docs/agent/api-card.md`

**Interfaces:**
- Consumes the entry names produced in Task 1.

- [ ] **Step 1: Write the failing test**

Append to `tools/docs/test/api-card.test.mjs`:

```js
test('the task table covers inspection, renames, aliases, adapters, and factory-owned resources', () => {
  const card = renderApiCard(project, tasks);
  for (const [task, call] of [
    ['Inspect one service without resolving it', 'container.serviceSnapshot(serviceKey)'],
    ['Inspect every binding and module installation', 'container.graphSnapshot()'],
    ['Rename a module export', 'module.withRenamedExport(options)'],
    ['Read the label a module was sealed with', 'module.moduleLabel'],
    ['Replace a provider in a builder', 'builder.withReplacedService(serviceKey, provider)'],
    ['Give a service a second name', 'builder.withServiceAlias(options)'],
    ['Register the service of a typed token', 'builder.withTokenService(token, provider)'],
    ['Adapt a class to positional dependencies', 'DiBag.createProviderFromClass(options)'],
    ['Adapt a positional function', 'DiBag.createProviderFromFunction(options)'],
    ['Own a resource acquired inside a factory', 'factoryContext.pushDisposer(disposer)'],
    ['Stop factory work when the container closes', 'factoryContext.abortSignal'],
  ]) assert.ok(card.includes(`| ${task} | [\`${call}\`]`), task);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test --test-isolation=none tools/docs/test/api-card.test.mjs`
Expected: FAIL at `Inspect one service without resolving it`.

- [ ] **Step 3: Add the rows**

Replace the contents of `tools/docs/api-card-tasks.json` with the following. Order is the order an agent meets the tasks: build a graph, shape providers, modules, containers, inspection, factory context.

```json
[
  { "task": "Start a graph", "call": "DiBag.createBuilder" },
  { "task": "Register services by name", "call": "builder.withServices" },
  { "task": "Register the service of a typed token", "call": "builder.withTokenService" },
  { "task": "Create a collection token", "call": "DiBag.createToken" },
  { "task": "Contribute a collection member", "call": "builder.withCollectionContribution" },
  { "task": "Give a service a second name", "call": "builder.withServiceAlias" },
  { "task": "Replace a provider in a builder", "call": "builder.withReplacedService" },
  { "task": "Register a portable factory", "call": "DiBag.createProvider" },
  { "task": "Adapt a class to positional dependencies", "call": "DiBag.createProviderFromClass" },
  { "task": "Adapt a positional function", "call": "DiBag.createProviderFromFunction" },
  { "task": "Attach disposal", "call": "DiBag.providerWithDisposal" },
  { "task": "Choose a lifetime", "call": "DiBag.providerWithLifetime" },
  { "task": "Attach registration metadata", "call": "DiBag.providerWithRegistrationMetadata" },
  { "task": "Attach acquisition metadata", "call": "DiBag.providerWithAcquisitionMetadata" },
  { "task": "Transform a service", "call": "DiBag.providerWithTransformedService" },
  { "task": "Seal a module", "call": "builder.buildModule" },
  { "task": "Install modules", "call": "builder.withInstalledModules" },
  { "task": "Rename a module requirement", "call": "module.withRenamedRequirement" },
  { "task": "Rename a module export", "call": "module.withRenamedExport" },
  { "task": "Read the label a module was sealed with", "call": "module.moduleLabel" },
  { "task": "Check the graph on its own line", "call": "builder.verifyGraphAtCompileTime" },
  { "task": "Build a container", "call": "builder.buildContainer" },
  { "task": "Wait for services before accepting work", "call": "container.ensureServicesReady" },
  { "task": "Replace services for a test", "call": "container.createIndependentContainer" },
  { "task": "Open a child container", "call": "container.createChildContainer" },
  { "task": "Resolve", "call": "container.resolve" },
  { "task": "Resolve a collection", "call": "container.resolveCollection" },
  { "task": "Inspect one service without resolving it", "call": "container.serviceSnapshot" },
  { "task": "Inspect every binding and module installation", "call": "container.graphSnapshot" },
  { "task": "Close", "call": "container.close" },
  { "task": "Own a resource acquired inside a factory", "call": "factoryContext.pushDisposer" },
  { "task": "Stop factory work when the container closes", "call": "factoryContext.abortSignal" }
]
```

- [ ] **Step 4: Regenerate and test**

Run: `npm run docs:generate && node --test --test-isolation=none tools/docs/test/api-card.test.mjs`
Expected: both PASS. Confirm the card line count is under 460: `wc -l docs/agent/api-card.md`.

- [ ] **Step 5: Run the full docs check and commit**

Run: `npm run docs:check`
Expected: PASS.

```bash
git add tools/docs/api-card-tasks.json tools/docs/test/api-card.test.mjs docs/agent/api-card.md
git commit -m "docs: add eleven tasks to the API card task table

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 3: Fix the shipped link and say what ships

Finding 19. `docs/agent/errors.md:831` links to a guide that is not in the package. AGENTS.md has one spare line, so the statement about what ships replaces its second paragraph line instead of adding one.

**Files:**
- Modify: `docs/agent/errors.md:829-831`
- Modify: `AGENTS.md:7-9`

- [ ] **Step 1: Replace the relative link in errors.md**

In the `DI_BAG_REMOVED_API` section change

```markdown
**Fix:** write the replacement. For a whole project, run `npx di-bag-codemod`
BEFORE upgrading, while the 0.4.0 types are still installed; see the
[migration guide](../guides/migrating-to-0.5.md).
```

to

```markdown
**Fix:** write the replacement. For a whole project, run `npx di-bag-codemod`
BEFORE upgrading, while the 0.4.0 types are still installed; see the
[migration guide](https://dany-fedorov.github.io/di-bag/guides/migrating-to-0.5.html).
```

- [ ] **Step 2: State what ships in AGENTS.md**

Replace lines 7 to 9 of `AGENTS.md`:

```markdown
This file ships in `node_modules/di-bag/`. Every call, with one way per task and an example: [docs/agent/api-card.md](docs/agent/api-card.md).
Task recipes: [docs/agent/recipes.md](docs/agent/recipes.md). Every compiler and runtime message: [docs/agent/errors.md](docs/agent/errors.md).
```

with

```markdown
This file and `docs/agent/` ship in `node_modules/di-bag/`; the guides live at https://dany-fedorov.github.io/di-bag/ (also as `llms.txt`).
Every call, one way per task, with an example: [docs/agent/api-card.md](docs/agent/api-card.md). Task recipes: [docs/agent/recipes.md](docs/agent/recipes.md). Every compiler and runtime message: [docs/agent/errors.md](docs/agent/errors.md).
```

Check the line count is still at most 150: `wc -l AGENTS.md`.

- [ ] **Step 3: Check and commit**

Run: `npm run docs:check`
Expected: PASS (`checkMessageUrlsInSources` accepts absolute site links; `checkLayoutBlock` is unaffected because the layout block did not change).

```bash
git add docs/agent/errors.md AGENTS.md
git commit -m "docs: link the migration guide by URL from the shipped agent docs

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 4: Publish llms.txt and llms-full.txt

Finding 20. VitePress copies `public/` into the site root, so `tools/docs/site/public/llms.txt` becomes `https://dany-fedorov.github.io/di-bag/llms.txt`. The site directory is generated by `prepare()` in `site.mjs` and git-ignored.

**Files:**
- Create: `tools/docs/lib/llms.mjs`
- Create: `tools/docs/test/llms.test.mjs`
- Modify: `tools/docs/site.mjs:20-39` (`prepare`)
- Modify: `docs/guides/documentation.md` ("Choose the right source" table)

**Interfaces:**
- Produces `renderLlmsIndex(root)` returning the `llms.txt` string and `renderLlmsFull(root)` returning the `llms-full.txt` string. Both read `AGENTS.md` and `docs/agent/*.md` from `root`.

- [ ] **Step 1: Write the failing test**

Create `tools/docs/test/llms.test.mjs`:

```js
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { renderLlmsFull, renderLlmsIndex } from '../lib/llms.mjs';

test('llms.txt indexes the agent pages and llms-full.txt concatenates them with absolute links', () => {
  const root = mkdtempSync(join(tmpdir(), 'di-bag-llms-'));
  try {
    mkdirSync(join(root, 'docs/agent'), { recursive: true });
    writeFileSync(join(root, 'AGENTS.md'), '# DI Bag: notes\n\nSee [card](docs/agent/api-card.md#one-way-per-task).\n');
    writeFileSync(join(root, 'docs/agent/api-card.md'), '# API card\n\nSee [errors](errors.md#di-bag-closed) and [rules](../../AGENTS.md).\n');
    writeFileSync(join(root, 'docs/agent/recipes.md'), '# Recipes\n');
    writeFileSync(join(root, 'docs/agent/errors.md'), '# Errors\n');
    const index = renderLlmsIndex(root);
    assert.match(index, /^# DI Bag\n/);
    assert.match(index, /- \[AGENTS\.md\]\(https:\/\/dany-fedorov\.github\.io\/di-bag\/llms-full\.txt#agents-md\)/);
    assert.match(index, /- \[API card\]\(https:\/\/dany-fedorov\.github\.io\/di-bag\/agent\/api-card\.html\)/);
    assert.match(index, /- \[Recipes\]\(https:\/\/dany-fedorov\.github\.io\/di-bag\/agent\/recipes\.html\)/);
    assert.match(index, /- \[Errors and messages\]\(https:\/\/dany-fedorov\.github\.io\/di-bag\/agent\/errors\.html\)/);
    const full = renderLlmsFull(root);
    assert.ok(full.indexOf('# DI Bag: notes') < full.indexOf('# API card'));
    assert.ok(full.indexOf('# API card') < full.indexOf('# Recipes'));
    assert.ok(full.indexOf('# Recipes') < full.indexOf('# Errors'));
    assert.match(full, /\[card\]\(https:\/\/dany-fedorov\.github\.io\/di-bag\/agent\/api-card\.html#one-way-per-task\)/);
    assert.match(full, /\[errors\]\(https:\/\/dany-fedorov\.github\.io\/di-bag\/agent\/errors\.html#di-bag-closed\)/);
    assert.match(full, /\[rules\]\(https:\/\/dany-fedorov\.github\.io\/di-bag\/llms-full\.txt#agents-md\)/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tools/docs/test/llms.test.mjs`
Expected: FAIL, cannot find module `../lib/llms.mjs`.

- [ ] **Step 3: Implement the renderer**

Create `tools/docs/lib/llms.mjs`:

```js
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const site = 'https://dany-fedorov.github.io/di-bag/';

/** The pages an agent needs, in reading order, with their website address. */
const pages = [
  { file: 'AGENTS.md', title: 'AGENTS.md', url: `${site}llms-full.txt#agents-md` },
  { file: 'docs/agent/api-card.md', title: 'API card', url: `${site}agent/api-card.html` },
  { file: 'docs/agent/recipes.md', title: 'Recipes', url: `${site}agent/recipes.html` },
  { file: 'docs/agent/errors.md', title: 'Errors and messages', url: `${site}agent/errors.html` },
];

/** Rewrite the relative links the shipped pages use among themselves to website addresses. */
function absoluteLinks(markdown) {
  return markdown.replace(/\]\((?:\.\.\/\.\.\/|docs\/agent\/|)?(AGENTS\.md|api-card\.md|recipes\.md|errors\.md)(#[^)]*)?\)/g, (_, file, fragment = '') => {
    const page = pages.find(page => page.file.endsWith(`/${file}`) || page.file === file);
    return `](${page.url.split('#')[0]}${file === 'AGENTS.md' ? '#agents-md' : fragment})`;
  });
}

/** The llms.txt index: what DI Bag is and where each agent page lives. */
export function renderLlmsIndex() {
  return [
    '# DI Bag', '',
    '> TypeScript dependency injection where the compiler checks the wiring, modules keep a feature\'s services private, and a container releases what it owns when closed. Zero runtime dependencies.', '',
    'The same pages ship in the npm package under `node_modules/di-bag/`. Read AGENTS.md first.', '',
    '## Agent pages', '',
    ...pages.map(page => `- [${page.title}](${page.url})`), '',
    '## Full text', '',
    `- [llms-full.txt](${site}llms-full.txt): every page above in one file`, '',
  ].join('\n');
}

/** Every agent page, in order, with links made absolute. */
export function renderLlmsFull(root) {
  return pages.map(page => {
    const text = readFileSync(join(root, page.file), 'utf8').replace(/\n$/, '');
    return `<!-- ${page.file} -->\n${page.file === 'AGENTS.md' ? '<a id="agents-md"></a>\n' : ''}${absoluteLinks(text)}\n`;
  }).join('\n');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tools/docs/test/llms.test.mjs`
Expected: PASS.

- [ ] **Step 5: Write the files during site preparation**

In `tools/docs/site.mjs` add the import and two writes inside `prepare()` after the theme loop:

```js
import { renderLlmsFull, renderLlmsIndex } from './lib/llms.mjs';
```

```js
  writeChanged(join(site, 'public/llms.txt'), renderLlmsIndex(root));
  writeChanged(join(site, 'public/llms-full.txt'), renderLlmsFull(root));
```

- [ ] **Step 6: Verify the build serves both files**

Run: `npm run docs:check && npm run docs:build && ls tools/docs/site/.vitepress/dist/llms.txt tools/docs/site/.vitepress/dist/llms-full.txt`
Expected: both files listed. `head -12 tools/docs/site/.vitepress/dist/llms.txt` shows the index.

- [ ] **Step 7: Record the source in the documentation guide**

Add one row to the "Choose the right source" table in `docs/guides/documentation.md`, after the API card rows:

```markdown
| `llms.txt` and `llms-full.txt` on the website | [llms.mjs](../../tools/docs/lib/llms.mjs); the full text is AGENTS.md and `docs/agent/` as they are |
```

- [ ] **Step 8: Commit**

```bash
git add tools/docs/lib/llms.mjs tools/docs/test/llms.test.mjs tools/docs/site.mjs docs/guides/documentation.md
git commit -m "docs: publish llms.txt and llms-full.txt from the agent pages

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

# Phase 2: the README hook (findings 1, 2, 3, 4, 5, 7, 13, 14, 20)

## Task 5: Capture the real compiler message

Finding 1 depends on quoting what `tsc` prints. Capture it before writing prose, so the README shows real output.

**Files:** scratch only; nothing committed.

- [ ] **Step 1: Build the package and write the broken quickstart**

```bash
npm run build
mkdir -p /tmp/di-bag-readme-error && cd /tmp/di-bag-readme-error
cat > a.ts <<'TS'
import { DiBag } from '/home/df/wd/personal/di-bag/dist/index.js';

const incomplete = DiBag.createBuilder().withServices({
  greeter: ({ config }: { config: { greeting: string } }) => ({
    greet(name: string) {
      return `${config.greeting}, ${name}!`;
    },
  }),
});

incomplete.buildContainer();
TS
cat > tsconfig.json <<'JSON'
{ "compilerOptions": { "strict": true, "noEmit": true, "module": "nodenext", "moduleResolution": "nodenext", "target": "es2022", "skipLibCheck": true }, "files": ["a.ts"] }
JSON
node /home/df/wd/personal/di-bag/node_modules/typescript/bin/tsc -p tsconfig.json; cd /home/df/wd/personal/di-bag
```

Expected: one error on line 11 whose text contains `required services are missing: config; see https://dany-fedorov.github.io/di-bag/agent/errors.html#missing-service`. Record the exact line and column reported, and the full message text, in the scratchpad file `readme-error.txt` for Task 6.

- [ ] **Step 2: Confirm the second claim**

Change `greeting: 'Hello'`'s type in a complete graph to a number and check the message family:

```bash
cd /tmp/di-bag-readme-error
cat > b.ts <<'TS'
import { DiBag } from '/home/df/wd/personal/di-bag/dist/index.js';

DiBag.createBuilder().withServices({
  config: () => ({ greeting: 42 }),
  greeter: ({ config }: { config: { greeting: string } }) => config.greeting,
}).buildContainer();
TS
sed -i 's/"a.ts"/"b.ts"/' tsconfig.json
node /home/df/wd/personal/di-bag/node_modules/typescript/bin/tsc -p tsconfig.json; cd /home/df/wd/personal/di-bag
```

Expected: an error whose text contains `provided service does not satisfy its consumer dependency` and names `greeter`, `config`, `string`, and `number`. Record it in `readme-error.txt` too. If instead the message is `contribution service is incompatible with its consumer dependency contract`, that is the same family; record whichever appears. If no error is reported, stop: finding 1's second sentence is false and the README text in Task 6 must drop it.

---

## Task 6: Rewrite the top of the README

Findings 1, 2, 4, 5, 14, 20, and the Install half of 3. Everything from the title through the quickstart is replaced; the sections after it are edited in Task 7.

**Files:**
- Modify: `README.md:1-74` (title through the quickstart explanation)

**Interfaces:**
- Produces the anchors `#quickstart`, `#what-the-compiler-catches`, and `#install`; `#why-di-bag` is kept as the heading of the three proof bullets.

- [ ] **Step 1: Replace lines 1 to 74 of README.md with this text**

Every claim below is checked: the package `files` list, zero `dependencies` in `package.json`, the compiler messages captured in Task 5, and the `tsconfig.json` per module in `AGENTS.md`.

````markdown
# DI Bag

Dependency injection for TypeScript where the compiler checks the wiring.
A module keeps a feature's services private behind named exports; a container
creates services on first use and releases what it owns when closed.

[![CI](https://github.com/dany-fedorov/di-bag/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/dany-fedorov/di-bag/actions/workflows/ci.yml)
[![Runtime dependencies: 0](https://img.shields.io/badge/runtime_dependencies-0-2563eb)](package.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-16a34a)](LICENSE)

[Documentation](https://dany-fedorov.github.io/di-bag/) · [Quickstart](#quickstart) · [Modules as units of work](#modules-as-units-of-work) · [Comparison](#how-it-compares) · [Tutorial](docs/guides/tutorial.md) · [API reference](docs/guides/api-reference.md)

Using a coding agent? It reads `node_modules/di-bag/AGENTS.md`, which ships
in the package with the [API card](docs/agent/api-card.md), [recipes](docs/agent/recipes.md),
and [every error message](docs/agent/errors.md). The same pages are at
[llms.txt](https://dany-fedorov.github.io/di-bag/llms.txt).

## Why DI Bag?

- **A missing dependency is a type error, not a crash on the first request.**
  Delete a factory and `tsc` names the missing service. Change a contract and
  `tsc` names the consumer that no longer fits. [See it](#what-the-compiler-catches).
- **One feature is one directory that type-checks alone.** A module exports the
  services it names and hides the rest, so two modules can both have a private
  `store`. A one-statement check file with its own `tsconfig.json` verifies the
  module without the rest of the application. [See a module](#a-module-in-one-screen).
- **Resources have one owner.** Attach a disposer to a factory and `close()`
  runs it, dependents first. A child container per request releases what the
  request acquired. [See ownership](#give-resources-a-clear-owner).

No decorators, no reflection metadata, no base classes, and zero runtime
dependencies. Runs on Node, Bun, Deno, browsers, and workers.

## Install

```sh
npm install di-bag
```

TypeScript 6.0.3 or later with `strict` enabled. Browsers and workers need one
extra option per factory; see [runtime support](#runtime-support). Coming from
0.4? See [upgrading](#upgrading).

## Quickstart

A **factory** creates a **service**. The type of a factory's one object
parameter declares what it depends on. A **container** calls factories on first
use:

```ts
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder()
  .withServices({
    config: () => ({ greeting: 'Hello' }),
    greeter: ({ config }: { config: { greeting: string } }) => ({
      greet(name: string) {
        return `${config.greeting}, ${name}!`;
      },
    }),
  })
  .buildContainer();

const greeter = app.resolve('greeter');
console.log(greeter.greet('Ada')); // Hello, Ada!
await app.close();
```

`resolve('greeter')` creates the greeter and its config the first time, and
returns the same greeter afterwards. TypeScript knows that `greeter` has a
`greet(name: string): string` method, with no cast and no token.

## What the compiler catches

Remove the `config` factory. `buildContainer()` no longer type-checks, and the
message names the missing service:

```ts
import { DiBag } from 'di-bag';

const incomplete = DiBag.createBuilder().withServices({
  greeter: ({ config }: { config: { greeting: string } }) => ({
    greet(name: string) {
      return `${config.greeting}, ${name}!`;
    },
  }),
});

// @ts-expect-error required services are missing: config
incomplete.buildContainer();
```

```text
required services are missing: config; see https://dany-fedorov.github.io/di-bag/agent/errors.html#missing-service
```

Change `greeting` to a number and the message names the consumer that no longer
fits: `provided service does not satisfy its consumer dependency`, with the
consumer, the dependency, the expected type, and the provided type. The
[error index](docs/agent/errors.md#compile-time) lists every message with its
cause and fix. The directive above is not decoration: this repository compiles
the block in CI, and an unused `@ts-expect-error` fails the build.

## A module in one screen

A module is a builder sealed with the names it exports. The host supplies what
the module requires. In a project each comment below is a file; the layout and
the per-module check command are in [AGENTS.md](AGENTS.md#module-layout).

```ts
import { DiBag } from 'di-bag';

// src/features/greeting/contract.ts: what the module exports and what it needs
type Greeter = { greet(name: string): string };
type GreetingConfig = { greeting: string };

// src/features/greeting/module.ts: private factories, named exports
const greetingModule = DiBag.createBuilder()
  .withServices({
    template: ({ config }: { config: GreetingConfig }) => `${config.greeting}, %s!`,
    greeter: ({ template }: { template: string }): Greeter => ({
      greet: name => template.replace('%s', name),
    }),
  })
  .buildModule({ exportedServiceKeys: ['greeter'], moduleLabel: 'greeting' });

// src/app.ts: the host supplies config; template stays private
const app = DiBag.createBuilder()
  .withInstalledModules([greetingModule])
  .withServices({ config: (): GreetingConfig => ({ greeting: 'Hello' }) })
  .buildContainer();

console.log(app.resolve('greeter').greet('Ada')); // Hello, Ada!
await app.close();
```

`app.resolve('template')` is a type error: the module did not export it. Leave
out the `config` factory and the host fails with
`required services are missing: config`. Another module may also call a private
service `template`; the names never meet. [Modules as units of work](#modules-as-units-of-work)
explains the layout, the check file, and the merge check.
````

- [ ] **Step 2: Replace the message text with the captured one**

Open the scratchpad `readme-error.txt` from Task 5. If the captured message differs from the `text` block above in any character after `required services are missing: config`, paste the captured text. Keep only the message, not the `error TS2345` prefix, file name, or position: those vary by editor.

- [ ] **Step 3: Run the snippet check**

Run: `npm run docs:check`
Expected: PASS. All three new `ts` blocks are standalone programs and are compiled. Two failure modes and their fixes:

- `Unused '@ts-expect-error' directive` at `README/block-N.ts`: the error is reported on a different line. Run the Task 5 scratch again, read the reported line, and move the directive to the line before it. If the compiler reports the error on the `const incomplete = DiBag.createBuilder()` line, restructure the block to one chained expression with the directive above `DiBag.createBuilder()`.
- `Argument of type ... template` in the module block: the private `template` is a string, so `{ template: string }` must stay exactly that.

- [ ] **Step 4: Run the retired-name check**

Run: `npm run docs:retired-names`
Expected: `0 finding(s)`. The text above avoids every retired word; if a finding appears, reword the sentence it names.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: open the README with the compiler check and a one-screen module

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 7: Reorder and trim the rest of the README

Findings 3 (the Upgrading half), 5 (badges leave the bottom), 7, 13.

**Files:**
- Modify: `README.md` from `## Swap a dependency for a test` to the end

- [ ] **Step 1: Remove the literal anchor attribute**

Change

```markdown
## Child and independent containers {#child-and-independent-containers}
```

to

```markdown
## Child and independent containers
```

GitHub generates the same id from the heading text, so links to `#child-and-independent-containers` keep working on GitHub and on the site. Confirm nothing else links to it: `grep -rn "child-and-independent-containers" README.md docs AGENTS.md` must show only this heading.

- [ ] **Step 2: Shorten the module section**

The one-screen module in Task 6 now carries the example. Replace the `## Modules as units of work` section body (from the heading to the line before `## How it compares`) with:

```markdown
## Modules as units of work

A module is the unit of work one person or one coding agent can own: a
directory with a small exported contract, private services, and its own tests.
Composition is checked when the modules meet, so several can be developed in
parallel and merged with confidence.

- **A boundary an owner can hold.** `buildModule({ exportedServiceKeys })`
  exports only the named services. Private services and their types stay
  inside, and two modules can use the same private names.
- **Verification without the whole application.** A module declares what its
  host must supply. A one-statement check file installs the module with typed
  fixtures and calls `verifyGraphAtCompileTime()`; tests use
  `createIndependentContainer(keys, providers)` for checked replacements.
- **Checks at merge time.** Installing every module into one builder is where
  independently developed work meets. A missing requirement or a contract that
  no longer matches its consumers fails at `buildContainer()` or
  `verifyGraphAtCompileTime()`; `di-bag-graph` exports the declared edges and
  cycles for review.

If two modules require the same name for different contracts, rename each
requirement at the install site with
`withRenamedRequirement({ currentRequirementKey, newRequirementKey })`, and
colliding exports with `withRenamedExport({ currentExportKey, newExportKey })`.

The directory layout is the map: one directory per module, the contract first.
The [modules guide](docs/guides/examples-modularity.md) shows the layout and
three runnable programs. LLM harnesses and agent graphs are one application of
the pattern; the [agent harness guide](docs/guides/agent-harnesses-and-graphs.md)
is a complete example.
```

- [ ] **Step 3: Move the upgrade text to the end**

Delete the paragraph that begins `The API is pre-1.0 and includes breaking changes.` wherever it survives from the old Install section (Task 6 already removed it; confirm with `grep -n "pre-1.0" README.md`). Insert this section between `## Working on DI Bag` and `## License`:

````markdown
## Upgrading

The API is pre-1.0 and includes breaking changes. From 0.4, run the codemod
before upgrading, while the 0.4 types are still installed, then read the
[0.5 migration guide](docs/guides/migrating-to-0.5.md) and the
[changelog](CHANGELOG.md):

```sh
npx di-bag-codemod --project tsconfig.json --write
```
````

- [ ] **Step 4: Remove the badges from the bottom**

In `## Working on DI Bag`, delete the three badge lines; Task 6 placed them under the title. The section starts directly with `After \`npm ci\`, run the main checks with Node and Bun installed:`.

- [ ] **Step 5: Update the explore table row for the modules guide**

In `## Explore further` change the row

```markdown
| [Radical modularity](docs/guides/examples-modularity.md) | The recommended module layout, separately owned features, isolated tests, and contributed tools. |
```

to

```markdown
| [Modules as units of work](docs/guides/examples-modularity.md) | The recommended module layout, separately owned features, isolated tests, and contributed tools. |
```

- [ ] **Step 6: Check and commit**

Run: `npm run docs:check && npm run docs:retired-names`
Expected: both PASS.

Render check: `grep -n "{#" README.md` prints nothing.

```bash
git add README.md
git commit -m "docs: move upgrade notes and badges, shorten the README module section

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

# Phase 3: gradual exposition (findings 6, 8, 9, 10, 11, 12)

## Task 8: Reorder the sidebar and give the home page a hero

Findings 6 and 8. The sidebar is `guide` in `tools/docs/vitepress.config.mjs`. The home page is the README copied to `index.md` by `prepare()` in `site.mjs`; a `layout: home` front matter adds the hero and VitePress renders the Markdown body beneath it.

**Files:**
- Modify: `tools/docs/vitepress.config.mjs:9-19` (`guide` sidebar groups)
- Modify: `tools/docs/lib/markdown.mjs` (new `homePage`)
- Modify: `tools/docs/test/markdown.test.mjs`
- Modify: `tools/docs/site.mjs:24-28` (`prepare`)

**Interfaces:**
- Produces `homePage(markdown)` in `tools/docs/lib/markdown.mjs`: takes the README text with links already rewritten, returns it with the hero front matter prepended and the first `# DI Bag` heading removed.

- [ ] **Step 1: Write the failing test**

Append to `tools/docs/test/markdown.test.mjs`:

```js
import { homePage } from '../lib/markdown.mjs';

test('the home page gets a hero and loses its duplicate title', () => {
  const page = homePage('# DI Bag\n\nDependency injection for TypeScript.\n\n## Quickstart\n');
  assert.match(page, /^---\nlayout: home\nhero:\n  name: DI Bag\n/);
  assert.match(page, /text: Ordinary services\. Checked composition\. Explicit ownership\./);
  assert.match(page, /link: \/#quickstart/);
  assert.match(page, /link: \/guides\/examples-modularity/);
  assert.match(page, /link: \/agent\/api-card/);
  assert.doesNotMatch(page, /\n# DI Bag\n/);
  assert.match(page, /---\n\nDependency injection for TypeScript\.\n\n## Quickstart\n$/);
  assert.throws(() => homePage('No title\n'), /first line/);
});
```

Put the `import` beside the existing import of `compareTrees, rewriteMarkdownLinks` (merge into one import statement).

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tools/docs/test/markdown.test.mjs`
Expected: FAIL, `homePage` is not exported.

- [ ] **Step 3: Implement `homePage`**

Append to `tools/docs/lib/markdown.mjs`:

```js
/** The VitePress home front matter; the README body renders under the hero. */
const homeFrontMatter = `---
layout: home
hero:
  name: DI Bag
  text: Ordinary services. Checked composition. Explicit ownership.
  tagline: Dependency injection for TypeScript where the compiler checks the wiring, modules keep a feature's services private, and a container releases what it owns.
  actions:
    - theme: brand
      text: Quickstart
      link: /#quickstart
    - theme: alt
      text: Modules as units of work
      link: /guides/examples-modularity
    - theme: alt
      text: API card for agents
      link: /agent/api-card
---
`;

/** Turn the rewritten README into the site's home page. */
export function homePage(markdown) {
  if (!markdown.startsWith('# DI Bag\n')) throw new Error('README.md must start with the "# DI Bag" title on its first line');
  return `${homeFrontMatter}\n${markdown.slice('# DI Bag\n'.length).replace(/^\n+/, '')}`;
}
```

- [ ] **Step 4: Use it in `prepare()`**

In `tools/docs/site.mjs` change the import line to

```js
import { homePage, listFiles, rewriteMarkdownLinks, sitePages } from './lib/markdown.mjs';
```

and the loop body in `prepare()` to

```js
  for (const [source, route] of pages) {
    const rewritten = rewriteMarkdownLinks(readFileSync(join(root, source), 'utf8'), source, pages, root);
    const content = source === 'README.md' ? homePage(rewritten) : rewritten;
    const settings = source.startsWith('docs/reference/') ? '---\neditLink: false\n---\n\n' : '';
    writeChanged(join(site, route), settings + content);
  }
```

- [ ] **Step 5: Reorder the sidebar**

Replace the `guide` constant in `tools/docs/vitepress.config.mjs` with:

```js
const guide = [
  { text: 'Start here', items: [
    { text: 'Introduction', link: '/' },
    { text: 'Complete tutorial', link: '/guides/tutorial' },
    { text: 'Modules as units of work', link: '/guides/examples-modularity' },
    { text: 'Server recipes', link: '/guides/server-integration' },
    { text: 'React and browser runtimes', link: '/guides/react-integration' },
    { text: 'Integration patterns', link: '/guides/enterprise-integration' },
    { text: 'Agent harnesses and graphs', link: '/guides/agent-harnesses-and-graphs' },
    { text: 'Comparison with alternatives', link: '/guides/comparison' },
  ] },
  { text: 'Agent docs', items: [
    { text: 'API card', link: '/agent/api-card' },
    { text: 'Recipes', link: '/agent/recipes' },
    { text: 'Errors and messages', link: '/agent/errors' },
  ] },
  { text: 'Why DI Bag? · Worked examples', items: [
    { text: 'TypeScript-first composition', link: '/guides/examples-type-checking' },
    { text: 'Custom tooling', link: '/guides/examples-extensibility' },
    { text: 'Simple service injection', link: '/guides/examples-plain-services' },
  ] },
  { text: 'Reference', items: [
    { text: 'API overview', link: '/guides/api-reference' },
    { text: 'DiBag facade', link: '/reference/index/interfaces/DiBagApi' },
    { text: 'Builder', link: '/reference/index/interfaces/Builder' },
    { text: 'Container', link: '/reference/index/interfaces/Container' },
    { text: 'All generated APIs', link: '/reference/' },
    { text: 'Migrating to 0.5', link: '/guides/migrating-to-0.5' },
  ] },
  { text: 'Contribute', items: [
    { text: 'Development', link: '/guides/development' },
    { text: 'API naming standard', link: '/guides/api-naming' },
    { text: 'Writing and publishing docs', link: '/guides/documentation' },
  ] },
];
```

The modules guide moved from the worked-examples group into "Start here" so it is listed once.

- [ ] **Step 6: Build and inspect**

Run: `node --test tools/docs/test/markdown.test.mjs && npm run docs:check && npm run docs:build`
Expected: all PASS; `verifyBuiltSite` reports no missing anchor for `/di-bag/#quickstart`.

Run: `npm run docs:preview` in the background, open `http://localhost:4173/di-bag/` (the port is printed), and confirm: the hero shows the name, the three-line tagline, and three buttons; the README body follows; the "Why DI Bag?" heading is the first heading under the hero; the sidebar is hidden on the home page (VitePress hides it for `layout: home`) and present on `/di-bag/guides/tutorial.html` in the new order. Stop the preview.

- [ ] **Step 7: Commit**

```bash
git add tools/docs/vitepress.config.mjs tools/docs/lib/markdown.mjs tools/docs/test/markdown.test.mjs tools/docs/site.mjs
git commit -m "docs: add a home hero and put the tutorial and modules first in the sidebar

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 9: Move modules forward in the tutorial

Finding 9. The section `## Reuse named modules` runs from line 670 to line 769 of `docs/guides/tutorial.md` (the blank line before `## Use typed tokens for explicit positional injection`). It moves to directly after the disposal section and before `## Errors and recovery` (line 349), keeping its anchor.

**Files:**
- Modify: `docs/guides/tutorial.md:17-27` (learning path), `:349`, `:670-769`
- Modify: `docs/guides/api-reference.md:283` (usage topic heading)

- [ ] **Step 1: Move the section with a script, not by hand**

```bash
node - <<'JS'
const fs = require('node:fs');
const path = 'docs/guides/tutorial.md';
const lines = fs.readFileSync(path, 'utf8').split('\n');
const start = lines.findIndex(line => line === '## Reuse named modules');
const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
const target = lines.findIndex(line => line === '## Errors and recovery');
if (start < 0 || end < 0 || target < 0 || target > start) throw new Error(`unexpected layout: ${start} ${end} ${target}`);
const section = lines.splice(start, end - start);
section[0] = '## Build modules as units of work {#reuse-named-modules}';
lines.splice(target, 0, ...section);
fs.writeFileSync(path, lines.join('\n'));
JS
```

Expected: `grep -n "^## " docs/guides/tutorial.md` shows `Build modules as units of work` between `Attach disposal` and `Errors and recovery`, and the section count is unchanged (25 `##` headings).

- [ ] **Step 2: Rewrite the learning path**

Replace the numbered list under `## Learning path` with:

```markdown
1. [Compose and resolve services](#compose-services).
2. Learn how [async work](#async-edges-are-explicit) and [ownership](#attach-disposal-with-providerwithdisposal) behave.
3. Package a feature as a [module](#reuse-named-modules): private services, named exports, and a check that runs without the host.
4. Read how [failures](#errors-and-recovery) and [compile-time rejections](#read-compile-time-rejections) are reported.
5. Choose between [child containers](#create-child-containers), [independent containers](#create-an-independent-container), and [lifetimes](#choose-a-lifetime).
6. Use [typed tokens and positional adapters](#use-typed-tokens-for-explicit-positional-injection) when names and object parameters do not fit.
7. Add [optional or lazy dependencies](#declare-optional-and-lazy-dependencies), [aliases](#give-a-dependency-another-lookup-name), and [ordered collections](#compose-an-ordered-collection).
8. Introduce [projections](#project-services-explicitly), [metadata and inspection](#attach-metadata-and-inspect-without-resolving), [observers](#observe-lifecycle-transitions), or [plugin validation](#admit-an-application-selected-plugin) at explicit boundaries.
9. Read the [portable runtime](#portable-mode) and [native provider metadata](#represent-acquisition-values-and-metadata-natively) rules when those environments apply.
```

- [ ] **Step 3: Check the moved text for order-dependent words**

Run: `sed -n "$(grep -n '^## Build modules' docs/guides/tutorial.md | cut -d: -f1),$(grep -n '^## Errors and recovery' docs/guides/tutorial.md | cut -d: -f1)p" docs/guides/tutorial.md | grep -n -i "above\|below\|earlier\|previous section"`
Expected: no output. The only relative word in the section is "later" in "them later with `withServices`", which describes a call order, not page order.

Then confirm the section does not use a concept introduced after its new position: `grep -n "withReplacedService\|createChildContainer\|createIndependentContainer\|providerWithLifetime\|createToken" <the same range>`; the module section may mention `createToken` for token exports, which the "Compose services" section already links forward to. Leave such mentions.

- [ ] **Step 4: Rename the usage topic in the API overview**

In `docs/guides/api-reference.md` change `### Reuse named modules` to `### Build modules as units of work`. The link under it stays `tutorial.md#reuse-named-modules`.

- [ ] **Step 5: Check and commit**

Run: `npm run docs:check && npm run docs:retired-names && npm run docs:build`
Expected: all PASS; the site check confirms every `#reuse-named-modules` link still resolves.

```bash
git add docs/guides/tutorial.md docs/guides/api-reference.md
git commit -m "docs: teach modules right after ownership in the tutorial

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 10: Lead the two "Why DI Bag?" guides with code

Finding 10, plus the guide title half of finding 11.

**Files:**
- Modify: `docs/guides/examples-modularity.md:1-15`, `:62-66`, `:360-373`
- Modify: `docs/guides/examples-type-checking.md:1-31`

- [ ] **Step 1: Restructure the modules guide**

Replace lines 1 to 15 (the title and the two opening paragraphs) with:

```markdown
# Modules as units of work

A module is the unit of work that one person or one coding agent can own:
implement a feature against its contracts, test it with controlled
dependencies, and integrate it without reaching into another feature's
internals. This guide gives the directory layout, then three runnable programs:
separately owned features, isolated tests, and contributed tools.
```

Leave `## Recommended module layout`, its `text` block, and its bullet list untouched. Replace the paragraph that begins `The three programs below are independent.` with:

```markdown
The three programs below are independent. After [installing DI Bag](../../README.md#install),
save any block as a TypeScript file and run it with Bun, or compile it as an ES
module and run the output with Node. Each includes executable assertions and
in-memory adapters; no database, payment account, or language-model API is needed.
```

Append to the end of the existing `## Where this approach fits` section:

```markdown
**Radical modularity** is the name this documentation uses for the practice:
independently composable, replaceable, and testable units are the normal way
to build the application, not an afterthought. Several such assignments can run
in parallel; the composition is checked when the modules are installed
together. Choose boundaries around coherent features, not a target number of
modules. Keep cross-feature invariants in integration tests and include the
affected contracts when a task spans modules.
```

- [ ] **Step 2: Restructure the type-checking guide**

Replace lines 1 to 31 of `docs/guides/examples-type-checking.md` (title through the `rejectedWiring` paragraph) with:

```markdown
# TypeScript first: catch composition errors at compile time

[Why DI Bag?](../../README.md#why-di-bag) · [Comparison](comparison.md)

Three independent programs. Each one builds a graph, then shows the wiring the
compiler rejects: a missing mailer, an adapter that no longer satisfies its
consumers, and a test replacement that breaks checkout. Save each block in its
own `.mts` file after following the [installation instructions](../../README.md#install),
enable TypeScript `strict` checking and Node types, and type-check before
running with Node 24 or Bun, because those runtimes do not type-check code.
Every adapter is an in-memory demonstration with no external service.

Each program contains an uncalled `rejectedWiring` function. Its
`@ts-expect-error` directives document deliberately invalid composition and make
the compiler check that those lines really fail. Remove a directive to inspect
the error. Leave the function uncalled: invalid composition is not executable
application code.
```

Append a closing section after program 3 (at the end of the file):

```markdown
## Where this fits in agentic development

Compile-time composition checks are an early evaluation step. A coding agent
can propose a wiring change, run the type checker, and use its diagnostics to
revise the composition without starting the application or external services.
Their cost depends on compiler launch and inference; they do not replace an
integration-test run.

For an LLM harness, that means checking the dependencies of agent graph nodes
before spending a model call, then substituting typed model and tool fixtures
for local behavioral evals. The [harness example](agent-harnesses-and-graphs.md)
shows both steps; LLM output quality still needs its own evaluations.

This evaluates declared composition, not business behavior: keep behavioral and
integration tests too. Compiler cost depends on graph size and composition
style; see the [compiler evidence](../benchmarks/typescript.md) for measured
costs and limits.
```

- [ ] **Step 3: Check and commit**

Run: `npm run docs:check && npm run docs:retired-names`
Expected: PASS. `checkLayoutBlock` still finds the layout block under `recommended-module-layout`; the standalone programs in both guides are unchanged and still compile.

```bash
git add docs/guides/examples-modularity.md docs/guides/examples-type-checking.md
git commit -m "docs: open the modules and type-checking guides with the layout and programs

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 11: One name for the flagship concept

Finding 11. After Tasks 7, 8, 9, and 10, the remaining occurrences of the old labels are in the documentation map and the explore table.

**Files:**
- Modify: `docs/README.md:29`
- Modify: `README.md` (verify only; Task 7 renamed its row)

- [ ] **Step 1: Find every remaining label**

Run: `grep -rn "Radical modularity\|Reuse named modules" README.md docs/README.md docs/guides docs/agent AGENTS.md tools/docs/vitepress.config.mjs`
Expected after the earlier tasks: only `docs/README.md:29`. Anything else listed is a miss from an earlier task; fix it in this task.

- [ ] **Step 2: Rename the documentation map row**

In `docs/README.md` change

```markdown
| [Radical modularity](guides/examples-modularity.md) | The recommended module layout, independent features, isolated automated tests, and contributed tools. |
```

to

```markdown
| [Modules as units of work](guides/examples-modularity.md) | The recommended module layout, independent features, isolated automated tests, and contributed tools. |
```

- [ ] **Step 3: Confirm the defined term survives only where it is defined**

Run: `grep -rn -i "radical modularity" README.md docs`
Expected: exactly two files: `docs/guides/examples-modularity.md` (the definition paragraph added in Task 10) and `docs/guides/comparison.md` (its existing paragraph that defines the term). Nothing in headings, tables, or navigation.

- [ ] **Step 4: Check and commit**

Run: `npm run docs:check && npm run docs:retired-names`

```bash
git add docs/README.md README.md
git commit -m "docs: call the module concept by one name everywhere

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 12: Index the runnable examples

Finding 12.

**Files:**
- Create: `examples/README.md`
- Modify: `README.md` ("Explore further" row for runnable examples)
- Modify: `docs/README.md` ("Runnable examples" row)

- [ ] **Step 1: Verify each description against the file**

Read the first 30 lines of each file listed below and adjust a description if it misstates what the file does. Keep one row per file; do not add or drop rows.

- [ ] **Step 2: Create `examples/README.md`**

````markdown
# Runnable examples

Each file is a complete program against the repository source. Run one from the
repository root with Bun:

```sh
bun run examples/composition.ts
```

| File | What it shows |
| --- | --- |
| [`composition.ts`](composition.ts) | Named factories, a class adapted with `createProviderFromClass`, and assertions on the resolved values. |
| [`modules.ts`](modules.ts) | A logging module with a private prefix, installed into an application builder. |
| [`tokens.ts`](tokens.ts) | Typed tokens for a clock and a connection, with `withTokenService` and positional injection. |
| [`contributions.ts`](contributions.ts) | A collection token whose members are contributed by separate modules and resolved in order. |
| [`scopes.ts`](scopes.ts) | Child containers with per-container services, disposal order, and what the parent closes. |
| [`observers.ts`](observers.ts) | Lifecycle observers receiving acquisition and disposal events, and how observer failures are reported. |
| [`plugins.ts`](plugins.ts) | A validated plugin descriptor admitted with `createProviderFromPlugin`. |
| [`provider-metadata.ts`](provider-metadata.ts) | Registration and acquisition metadata inspected with `serviceSnapshot` before and after resolving. |
| [`wbs-scope.ts`](wbs-scope.ts) | A work-breakdown-structure application with ownership per change; `npm run example:wbs`. |
| [`integration/owned-scope.ts`](integration/owned-scope.ts) | The acquire, work, close helper used by the integration guide. |
| [`react/`](react) | A browser application owning application and project runtimes from React effects; `npm run example:react` builds the page. |

The guides contain further complete programs that run against the published
package: [modules](../docs/guides/examples-modularity.md),
[type checking](../docs/guides/examples-type-checking.md),
[custom tooling](../docs/guides/examples-extensibility.md), and
[plain services](../docs/guides/examples-plain-services.md).
````

- [ ] **Step 3: Point the two tables at the index**

In `README.md`, "Explore further", change the examples row to:

```markdown
| [Runnable examples](examples/README.md) | One program per topic: modules, tokens, composition, collections, plugins, observers, child containers, and provider metadata. |
```

In `docs/README.md` change the examples row to:

```markdown
| [Runnable examples](../examples/README.md) | Execute focused examples from the repository; the index lists each file and its run command. |
```

- [ ] **Step 4: Run every example once**

```bash
for file in examples/*.ts; do echo "== $file"; bun run "$file" || exit 1; done
```

Expected: every program exits 0. This confirms the descriptions describe running code.

- [ ] **Step 5: Check and commit**

Run: `npm run docs:check && npm run docs:retired-names && npm run docs:build`
Expected: PASS. `rewriteMarkdownLinks` turns `examples/README.md` into a GitHub link on the site because `examples/` is not a site page.

```bash
git add examples/README.md README.md docs/README.md
git commit -m "docs: index the runnable examples

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

# Phase 4: verification

## Task 13: Run every gate and record the change

**Files:**
- Modify: `CHANGELOG.md:1-3`

- [ ] **Step 1: Add an unreleased changelog entry**

Insert after the `# Changelog` line:

```markdown
## Unreleased

### Documentation

- The README opens with the compiler message for a missing dependency, three
  verifiable reasons to use DI Bag, and a module in one screen; upgrade notes
  moved to an "Upgrading" section.
- The API card covers `module.withRenamedExport`, `module.moduleLabel`,
  `factoryContext.pushDisposer`, and `factoryContext.abortSignal`, and its task
  table grew from 21 to 32 rows. Snapshot examples read the fields they return.
- The website publishes `llms.txt` and `llms-full.txt`, has a home hero, and
  lists the tutorial and the modules guide first.
- The tutorial teaches modules directly after ownership. The modules and
  type-checking guides open with the layout and the programs. The module concept
  is called "Modules as units of work" on every surface.
- `examples/README.md` indexes the runnable examples.
```

- [ ] **Step 2: Run the full documentation and source gates**

```bash
npm run docs:generate && git status --short docs/reference docs/agent
npm run docs:check
npm run docs:retired-names
node --test --test-isolation=none tools/docs/test/*.test.mjs
npm run docs:build
npm run typecheck
npm run test:fast
```

Expected: `git status` shows nothing after regeneration (the committed reference is current); every command exits 0. `test:fast` covers `tests/api-naming.test.ts`, which reads the documentation for retired names and public-name rules.

- [ ] **Step 3: Read the README as GitHub renders it**

Run: `npx --yes markdownlint-cli2 README.md examples/README.md 2>&1 | head -40` and fix any heading or fence error it reports (ignore line-length rules). Then open `README.md` in a Markdown preview and confirm: badges under the title, the agent line, three bullets, Install, Quickstart, "What the compiler catches" with a `ts` block and a `text` block, "A module in one screen", then the existing sections, and "Upgrading" before "License". No `{#` anywhere.

- [ ] **Step 4: Confirm the shipped package contents**

```bash
npm pack --dry-run 2>&1 | grep -E "AGENTS.md|docs/agent/"
```

Expected: `AGENTS.md`, `docs/agent/api-card.md`, `docs/agent/errors.md`, `docs/agent/recipes.md`. The README claim "ships in the package" depends on this list.

- [ ] **Step 5: Commit and report**

```bash
git add CHANGELOG.md
git commit -m "docs: record the documentation review changes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git log --oneline next..HEAD
```

Report the commit list, the output of the gates in Step 2, and the compiler messages captured in Task 5. Do not push.
