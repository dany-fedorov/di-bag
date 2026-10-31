# Documentation Follow-up (Phases A and B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close out the parked items from the 2026-10-31 documentation review (Phase A) and fix link and index hygiene the review left behind (Phase B).

**Architecture:** Docs-only. Two tasks, each one commit: Task 1 covers the parked items (a pin test for the README's quoted compiler message, resolved providers in two card examples, a safer disposer example, an accessor-aware Module classification test, a real target for the AGENTS.md entry in `llms.txt`). Task 2 covers hygiene (site URLs for links into custom-id anchors from the README, verified example descriptions, forward links in the tutorial's module section). Every change ends green on `npm run docs:check`.

**Tech Stack:** Markdown, TypeDoc Markdown generation (`npm run docs:generate`), Node test runner for `tools/docs/test/*.test.mjs`, VitePress build (`npm run docs:build`).

**Spec:** the "Phases A and B" list in the controller's session summary of 2026-10-31, recorded here in full as the tasks below.

## Global Constraints

- Branch `docs/follow-up` off `origin/main` (a492840). Do not push or merge from inside a task; the controller does that.
- Every `@example` in `src/**/*.ts` is compiled by `npm run docs:check` with `import { DiBag } from 'di-bag';` prepended when it has no import line; the API card is regenerated from them by `npm run docs:generate` and must be committed with the source change.
- Human-facing pages must pass `npm run docs:retired-names` (never write: bag, scope, scopes, fork, cleanup, startup, family, "root lifetime", "acquisition mode", or a pre-0.5 API name such as `replace(`; `scoped` is fine). No em-dashes in new prose.
- `AGENTS.md` is at 149 of its 150-line budget; do not add lines to it. Its module layout block stays byte-identical to the one in `docs/guides/examples-modularity.md`.
- The API card budget is 460 lines (`cardBudget`); the card is at about 413.
- Deployed-site check (Phase A item 1) is already done by the controller: the live site serves the hero, `llms.txt`, and the `#reuse-named-modules` bookmark on the API overview. No task for it.
- Commit messages end with the attribution trailer the implementer's harness instructs.

---

## Task 1: Close the parked items

**Files:**
- Create: `tools/docs/test/readme-quotes.test.mjs`
- Modify: `src/acquisition-context.ts` (three `@example` blocks)
- Modify: `tools/docs/test/api-card.test.mjs` (the test "every public Module method is classified for the API card")
- Modify: `tools/docs/lib/llms.mjs`, `tools/docs/test/llms.test.mjs`
- Regenerate: `docs/agent/api-card.md`, `docs/reference/index/interfaces/FactoryContext.md`, `docs/reference/index/interfaces/DisposerContext.md`

- [ ] **Step 1: Pin the README's quoted compiler message to the error index**

Create `tools/docs/test/readme-quotes.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

test('the README quotes the missing-service message exactly as the error index states it', () => {
  const readme = readFileSync(resolve(root, 'README.md'), 'utf8');
  const errors = readFileSync(resolve(root, 'docs/agent/errors.md'), 'utf8');
  const section = readme.slice(readme.indexOf('## What the compiler catches'));
  const quoted = section.match(/```text\n([^\n]+)\n```/)?.[1];
  assert.ok(quoted, 'README has a text block quoting the compiler message');
  const template = errors.match(/`(required services are missing: <keys>; see [^`]+)`/)?.[1];
  assert.ok(template, 'errors.md states the missing-service message template');
  assert.equal(quoted, template.replace('<keys>', 'config'));
  assert.match(section, /`provided service does not satisfy its consumer dependency`/);
  assert.ok(errors.includes('provided service does not satisfy its consumer dependency'), 'errors.md states the wrong-shape message');
});
```

Run: `node --test tools/docs/test/readme-quotes.test.mjs`
Expected: PASS (the README already quotes the message). Then temporarily change one character of the README's `text` block, run again, expect FAIL, and revert; mention both runs in the report.

- [ ] **Step 2: Resolve the providers in the two factory-context examples**

In `src/acquisition-context.ts`, replace the `abortSignal` example with:

```ts
   * @example
   * ```ts
   * declare function fetchCatalog(signal: AbortSignal): Promise<string[]>;
   * const catalog = DiBag.createProvider(async (_dependencies: {}, factoryContext) => fetchCatalog(factoryContext.abortSignal), {
   *   factoryReceivesContext: true, factoryReturnKind: 'native-promise',
   * });
   * const container = DiBag.createBuilder().withServices({ catalog }).buildContainer();
   * const names: Promise<string[]> = container.resolve('catalog'); // close() aborts the signal while fetchCatalog is pending
   * await container.close();
   * ```
```

Replace the `pushDisposer` example with:

```ts
   * @example
   * ```ts
   * declare function openLock(name: string): Promise<{ release(): Promise<void> }>;
   * declare function verify(name: string): Promise<void>;
   * const worker = DiBag.createProvider(async ({ name }: { name: string }, factoryContext) => {
   *   const lock = await openLock(name);
   *   factoryContext.pushDisposer(() => lock.release()); // released at close(), or at once if verify() rejects
   *   await verify(name);
   *   return { name };
   * }, { factoryReceivesContext: true });
   * const container = DiBag.createBuilder().withServices({ name: () => 'nightly', worker }).buildContainer();
   * const started: Promise<{ name: string }> = container.resolve('worker');
   * await container.close(); // runs lock.release() after the worker settled
   * ```
```

- [ ] **Step 3: Make the DisposerContext example safe under `noImplicitReturns`**

In the `DisposerContext` example, replace the line

```ts
   *     factoryContext.pushDisposer(disposerContext => { if (disposerContext.reason !== 'service-disposed') return connection.close(); });
```

with

```ts
   *     factoryContext.pushDisposer(async disposerContext => { if (disposerContext.reason !== 'service-disposed') await connection.close(); });
```

- [ ] **Step 4: Regenerate and check the examples**

Run: `npm run docs:generate && npm run docs:check`
Expected: PASS; `git status --short` shows `src/acquisition-context.ts`, `docs/agent/api-card.md`, and the two reference pages. Confirm `wc -l docs/agent/api-card.md` is at most 460.

- [ ] **Step 5: Teach the Module classification test about accessors**

In `tools/docs/test/api-card.test.mjs`, the test "every public Module method is classified for the API card" hard-codes `'module.moduleLabel'` as "the one non-method member". Change it so accessors are reflected too: build `reflected` from every public child of the `Module` reflection that is a method **or** an accessor, keep `included`/`excluded` for methods, add an `accessors` set initialised from the reflected accessors (expected to equal `['moduleLabel']`), and assert the card's Module entries equal `[...accessors.map(name => `module.${name}`), ...included.map(name => `module.${name}`)]` in source order. Keep the existing `assert.throws` for an unclassified method and add a second: an unexpected accessor name (`'futureLabel'`) also throws with a message containing `every reflected public Module accessor must be listed`.

Run: `node --test --test-isolation=none tools/docs/test/api-card.test.mjs`
Expected: PASS.

- [ ] **Step 6: Give the AGENTS.md entry in llms.txt a real target**

In `tools/docs/lib/llms.mjs` change the AGENTS.md page entry to

```js
  { file: 'AGENTS.md', title: 'AGENTS.md', url: 'https://github.com/dany-fedorov/di-bag/blob/main/AGENTS.md' },
```

and make `absoluteLinks` rewrite a link to AGENTS.md (with or without a fragment) to that URL, keeping the fragment (`https://github.com/dany-fedorov/di-bag/blob/main/AGENTS.md#module-layout`), since GitHub resolves heading fragments. Remove the `<a id="agents-md"></a>` line from `renderLlmsFull`. Update `tools/docs/test/llms.test.mjs`: the index entry assertion becomes the GitHub URL; the `[rules](../../AGENTS.md)` assertion becomes the GitHub URL; add one assertion that `[layout](docs/agent/../../AGENTS.md#module-layout)` is not required but that `[rules](../../AGENTS.md#rules)` rewrites to `https://github.com/dany-fedorov/di-bag/blob/main/AGENTS.md#rules` (add that link to the fixture's api-card.md).

Run: `node --test tools/docs/test/llms.test.mjs && npm run docs:check && npm run docs:build`
Expected: PASS; `head -12 tools/docs/site/.vitepress/dist/llms.txt` shows the GitHub URL for AGENTS.md.

- [ ] **Step 7: Commit**

```bash
git add tools/docs/test/readme-quotes.test.mjs src/acquisition-context.ts tools/docs/test/api-card.test.mjs tools/docs/lib/llms.mjs tools/docs/test/llms.test.mjs docs/agent/api-card.md docs/reference
git commit -m "docs: close the parked review items (quote pin, resolved examples, accessor test, llms target)"
```

---

## Task 2: Link and index hygiene

**Files:**
- Modify: `README.md` (one link in "Explore further")
- Modify: `examples/README.md` (descriptions verified against the files)
- Modify: `docs/guides/tutorial.md` (forward links in the module section, lines 350 to 449)

- [ ] **Step 1: Site URLs for custom-id anchors linked from the README**

`README.md` "Explore further" has the row `[Static dependency graph](docs/agent/recipes.md#review-merge)`. GitHub and npm slug that heading as `review-a-merge-review-merge`, so the fragment misses there. Change the href to `https://dany-fedorov.github.io/di-bag/agent/recipes.html#review-merge`. Run `grep -n "docs/agent/[a-z-]*\.md#" README.md`; expected: no output. (AGENTS.md also links into custom-id anchors; leave it: it is read as files in `node_modules`, where fragments do not apply, and it has no spare line for a URL. Say so in the report.)

- [ ] **Step 2: Verify the seven unchecked example descriptions**

Read the first 40 lines of `examples/modules.ts`, `examples/tokens.ts`, `examples/contributions.ts`, `examples/plugins.ts`, `examples/wbs-scope.ts`, `examples/integration/owned-scope.ts`, and `examples/react/main.tsx` (plus `examples/react/README.md` if present). Facts already established by grep: `modules.ts` also uses `providerWithDisposal` and `createIndependentContainer`; `tokens.ts` also seals a module and creates an independent container; `contributions.ts` uses `withCollectionContribution`, `createProviderFromFunction`, and `resolveCollection`; `plugins.ts` uses `createProviderFromPlugin` with a typed token; `wbs-scope.ts` uses `providerWithDisposal` and `createIndependentContainer`; `integration/owned-scope.ts` is a 20-line helper referenced by the integration guide. Rewrite each of the seven rows so it names the APIs the file actually demonstrates, in one sentence each, keeping the run-command notes. Do not add or drop rows.

- [ ] **Step 3: Forward links inside the tutorial's module section**

In `docs/guides/tutorial.md` between `## Build modules as units of work` and `## Errors and recovery`, link the first mention of each later topic:

- "names and typed tokens" → `names and [typed tokens](#use-typed-tokens-for-explicit-positional-injection)`
- "and observer events" → `and [observer events](#observe-lifecycle-transitions)`
- "or a forward registration before" → `or a [forward registration](#compose-services) before`
- "Host `withReplacedService` and selected container replacements" → `Host `withReplacedService` and selected [container replacements](#create-child-containers)`

Anchors exist: `#use-typed-tokens-for-explicit-positional-injection`, `#observe-lifecycle-transitions`, `#compose-services`, `#create-child-containers`. Change nothing else in the section.

- [ ] **Step 4: Check and commit**

Run: `npm run docs:check && npm run docs:retired-names && npm run docs:build`
Expected: PASS; the site build verifies the four new fragments.

```bash
git add README.md examples/README.md docs/guides/tutorial.md
git commit -m "docs: site URL for the recipes link, verified example descriptions, forward links in the module section"
```
