# Guides and README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite every human guide, the README and the smaller documents to the 0.5.0 API and vocabulary, and make that state checkable: the guides' standalone examples are compiled, and a checker finds any 0.4.0 name or retired word that is left.

**Architecture:** Three tools come first, because a rewrite of about 5,000 lines of prose cannot be proofread into correctness. The docs check learns to compile the 43 standalone examples of the guides and the README, which turns "the guides are stale" into a list of compiler errors. A script runs the codemod over exactly those examples and writes them back in place. A second script lists every removed name and retired word that remains, by file and line. The rewrite itself is then one task per file, and the files do not overlap, so the executor may hand them to parallel workers.

**Tech Stack:** Node 24.20.0 scripts (`.mjs`), the docs tooling under `tools/docs` (its own TypeScript and VitePress), Bun 1.4.0 tests, the codemod from phase 1.

**Spec:** `docs/superpowers/specs/2026-09-20-swift-api-style.md` (vocabulary, rename map, "Singleton by default") and its examples companion `docs/superpowers/specs/2026-09-20-swift-api-style-examples.md`, whose seventeen use cases are reused verbatim where they fit. Master plan: `docs/superpowers/plans/2026-09-21-00-swift-api-style-master.md`, phase 12.

## Global Constraints

- The spec's words win: container, child container, independent container, container tree, disposal, service readiness, factory return kind, service key, provider. `DI Bag`, `DiBag` and `di-bag` stay: they are the product and the package. "Bag" otherwise only means an options bag.
- Lifetimes are written in full wherever a value is shown: `'singleton:one-per-container-tree'`, `'scoped:one-per-container'`, `'transient:one-per-resolve'`. In prose the three terms singleton, scoped and transient are enough.
- A heading's anchor may change only together with every link to it, in the same commit. `src` holds 88 JSDoc URLs to 20 anchors of the guides (18 in the tutorial, 2 in the API overview); `npm run docs:check` resolves each one. The table in Task 4 lists them.
- Code in a guide is 0.5.0 code that compiles. A standalone example (one that imports `di-bag` and nothing else except Node's own modules) is compiled by `npm run docs:check` after Task 1. A fragment is not, so write fewer fragments: where a fragment can become a standalone example by adding an import and a declaration, do that.
- `CHANGELOG.md` history is not rewritten. `docs/guides/migrating-to-0.5.md` belongs to phase 13 and is not created here. `AGENTS.md`, `docs/agent/*` and the generated reference were kept current by every earlier phase and are touched here only where this plan says so.
- No em-dashes and no arrows in new prose; one idea per sentence; American spelling as the existing guides use.
- Gates, commit format and environment are in the master plan. This phase changes no file under `src` except JSDoc URLs (Task 4), so the evidence benchmarks are not rerun.
- Every example below assumes the preferred spike outcomes. Before editing, read the recorded S1–S8 decisions in the preceding phase evidence and `docs/guides/api-naming.md`. Apply the selected contracts to every guide, README claim, task instruction and recipe; a measured fallback is part of the shipped API. An unmeasured decision blocks entry to this phase rather than silently selecting either shape.

Use this checklist when a recorded fallback applies. The preceding phase's verified declarations and fallback fixtures supply the exact generic and callback contracts; do not restore a preferred API to make a guide compile.

| Decision | Documentation adjustment |
| --- | --- |
| S1 | Use the recorded positional form for each affected builder method, including examples in Tasks 4–9. |
| S2 | Use the five `DiBag.providerWith*` option-bag functions from plan 10's selected fallback. Update disposal/lifetime prose and fragments as well as compiled examples. |
| S3 | Write `createChildContainer(keys, providers, options?)` and `createIndependentContainer(keys, providers)` using the exact optional forms selected by plan 07. Preserve the verified no-argument, empty-bag, share-only, and explicit-`undefined` forms; do not teach an options bag for replacement pairs. |
| S4 | The composite recipe uses `DiBag.createProviderFromFunction([loggerSinksToken], (sinks: readonly Logger[]): Logger => ({ log: line => { for (const sink of sinks) sink.log(line); } }))`. Preserve the selected trailing options form where an example supplies one. |
| S5 | Read collection tokens with `resolveCollection`; read single-service tokens with `resolve`. Use the final collection-snapshot name recorded by plan 07. |
| S6 | Omit the requirement-renaming recipe and its API claims. For the two-module example, declare distinct `ordersConfig` and `billingConfig` dependencies in their factories, remove both `withRenamedRequirement` calls, and retain the two export renames and host registrations. |
| S7 | Replace a list installation with one `withInstalledModule(module)` call per module, preserving order. |
| S8 | State that the default is scoped. In Task 4's lifetime table mark scoped as the default; explicitly mark `clock` singleton so its identity assertion stays true. Replace “An application with a single container never writes a lifetime” with “An unmarked provider is scoped; choose singleton explicitly when child containers should share it.” In Task 6 retain request containers as the opening recipe; in Task 7's comparison and Task 8's README describe the recorded scoped default. Keep the singleton-capture and child-replacement rules only as implemented and verified by plan 11's selected fallback. |

In Task 10's report, list the recorded spike outcomes and confirm that both the compiled examples and the prose agree with them. Passing snippet compilation alone cannot prove a statement about the default lifetime.

## State on entry

Phases 0 to 11 are merged. `src`, the tests, the examples, `AGENTS.md`, `docs/agent/*`, the API card and the reference are 0.5.0. The guides and the README still describe 0.4.0.

```bash
npm run docs:check                      # expect exit 0: the guides are not compiled yet, so their staleness is invisible
grep -c "isStandaloneProgram" tools/docs/lib/agent-docs.mjs   # expect 0
ls scripts/migrate-doc-snippets.mjs scripts/check-docs-retired-names.mjs 2>&1 | grep -c "No such file"   # expect 2
grep -c "createBuilder().register(" README.md                  # expect a number above 0: the README is still 0.4.0
```

Measured at the 0.4.0 source when this plan was written, for orientation: the guides and the README hold 72 TypeScript blocks, 43 of them standalone (tutorial 24, README 3, server integration 3, the three example pages 3 each, API overview 2, React integration 1, agent harnesses 1). With a provisional map of the spec's renames, the checker of Task 2 reported 916 findings in 18 files: 440 removed calls, 57 removed types and codes, 29 retired string values, 390 retired words. By file: tutorial 333, server integration 146, API overview 105, React integration 71, README 49, enterprise integration 38, examples-modularity 34, examples-extensibility 28, agent harnesses 27, examples-type-checking 23, comparison 21, examples-plain-services 10, graph README 8, benchmarks 8, documentation 6, development 5, PUBLISHING 2, docs README 2.

## File Structure

| File | Responsibility |
| --- | --- |
| `tools/docs/lib/agent-docs.mjs`, `tools/docs/test/agent-docs.test.mjs` (modify) | `collectSnippets` also takes the standalone `ts` blocks of `README.md` and `docs/guides/*.md`; new export `isStandaloneProgram` |
| `scripts/check-docs-retired-names.mjs`, `tests/check-docs-retired-names.test.ts`, `tests/fixtures/docs-retired-names/` (create) | lists removed names and retired words in the human documents; exit 1 when any is left |
| `scripts/migrate-doc-snippets.mjs`, `tests/migrate-doc-snippets.test.ts`, `tests/fixtures/doc-snippets/fake-codemod.mjs` (create) | runs the codemod over the standalone blocks and writes them back in place |
| `docs/guides/*.md`, `README.md`, `docs/README.md`, `tools/graph/README.md`, `docs/benchmarks/typescript.md`, `PUBLISHING.md` (modify) | the rewrite, one task per file or group |
| `docs/agent/recipes.md` (modify) | two new recipes: the composite service, and two modules that require the same key |
| `src/*.ts` (modify, JSDoc only) | the URLs of the tutorial anchors that are renamed in Task 4 |

---

### Task 1: Compile the standalone examples of the guides and the README

**Files:**
- Modify: `tools/docs/lib/agent-docs.mjs`, `tools/docs/test/agent-docs.test.mjs`

**Interfaces:**
- Produces: `isStandaloneProgram(code: string): boolean`, exported from `tools/docs/lib/agent-docs.mjs`. `collectSnippets(root)` returns, in addition to today's snippets, one `{ where: '<page>:<line>', file: '<page without .md>/block-<line>.ts', code }` per standalone `ts` block of `README.md` and `docs/guides/*.md`.

This change and its test were made on a scratch copy when the plan was written: the test failed first (`7 pass, 1 fail`), then all 23 tests of the docs tool passed, and the extended collector found 43 guide snippets in the real repository with no collection error. What was NOT run is the type-check of those 43 snippets, which is the point of Step 4.

- [ ] **Step 1: Write the failing test**

Append to `tools/docs/test/agent-docs.test.mjs`:

```js
test('guides and the README contribute their standalone blocks, and only those', () => {
  const standalone = "import { make } from 'di-bag';\nimport { strict as assert } from 'node:assert';\nassert.equal(make(1), 1);";
  const root = fixture({
    'README.md': `# Readme\n${fence(standalone)}${fence("const fragment = builder.withServices({});")}`,
    'docs/guides/tutorial.md': [
      '# Tutorial',
      fence("import { make } from 'di-bag';\nconst wrong: string = make(2);"),
      // A relative import names a file the page does not hold, and a third-party import a package the check does not install.
      fence("import { make } from 'di-bag';\nimport { handle } from './handle-request.ts';\nhandle(make(3));"),
      fence("import { make } from 'di-bag';\nimport express from 'express';\nexpress(make(4));"),
      fence("import { make } from 'di-bag';\nexport const view = <p>{make(5)}</p>;", 'tsx'),
      fence('npm install di-bag', 'sh'),
    ].join('\n'),
    'src/api.ts': 'export {};\n',
    'node_modules/di-bag/package.json': '{ "name": "di-bag", "exports": { ".": { "types": "./index.d.ts" } } }',
    'node_modules/di-bag/index.d.ts': 'export declare function make(value: number): number;',
  });
  try {
    const { snippets, errors } = collectSnippets(root);
    assert.deepEqual(errors, []);
    assert.deepEqual(snippets.map(snippet => snippet.where), ['README.md:2', 'docs/guides/tutorial.md:2']);
    assert.deepEqual(snippets.map(snippet => snippet.file), ['README/block-2.ts', 'docs/guides/tutorial/block-2.ts']);
    const failures = checkSnippets(snippets, root, typeRoots);
    assert.equal(failures.length, 1, failures.join('\n'));
    assert.match(failures[0], /^docs\/guides\/tutorial\.md:2: line 2: TS2322/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
```

Run: `node --test --test-isolation=none tools/docs/test/agent-docs.test.mjs`. Expected: the new test fails, because `collectSnippets` returns no snippet for the two pages; the other seven pass.

- [ ] **Step 2: Extend the collector**

In `tools/docs/lib/agent-docs.mjs`, inside `collectSnippets`, directly BEFORE the loop `for (const file of listSources(join(root, 'src')))`, add:

```js
  // Guides and the README mix whole programs with fragments, and only a whole program can be compiled.
  const guidePages = [...(existsSync(join(root, 'README.md')) ? ['README.md'] : []), ...listMarkdown(join(root, 'docs/guides')).map(file => `docs/guides/${file}`)];
  for (const page of guidePages) {
    const { blocks } = parseMarkdown(readFileSync(join(root, page), 'utf8'));
    for (const block of blocks) {
      if (block.lang !== 'ts' || !isStandaloneProgram(block.code)) continue;
      snippets.push({ where: `${page}:${block.line}`, file: posix.join(page.replace(/\.md$/, ''), `block-${block.line}.ts`), code: block.code });
    }
  }
```

In the same file, directly before the JSDoc comment of `writeDeclarationPackage`, add:

```js
/**
 * A block that can compile by itself: it imports `di-bag`, and nothing else except Node's own modules.
 * A relative import names a file the page does not hold; any other package is one this check does not install.
 */
export function isStandaloneProgram(code) {
  const specifiers = [...code.matchAll(/^\s*import\s[^'"]*?['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]/gm)].map(match => match[1] ?? match[2]);
  return specifiers.includes('di-bag') && specifiers.every(specifier => specifier === 'di-bag' || specifier.startsWith('node:'));
}

```

Only `ts` blocks are taken. A `tsx` block needs React's types and JSX settings, and a `js` block has no types to check.

- [ ] **Step 3: Run the docs tool's tests**

Run: `node --test --test-isolation=none tools/docs/test/*.test.mjs`. Expected: every test passes (23 at the 0.4.0 source).

- [ ] **Step 4: See the guides fail, and keep the list**

```bash
npm run docs:check 2>&1 | tee /tmp/docs-check-guides.txt | grep -cE "^(README\.md|docs/guides/)"
```

Expected: a number far above zero and a non-zero exit. Every line names a page, the line of the block's opening fence, and the compiler's message, for example `docs/guides/tutorial.md:39: line 4: TS2339: Property 'register' does not exist`. This red state is the worklist of Tasks 3 to 8. `npm run docs:check` stays red until Task 9; that is intended, and it is why this task is NOT committed alone.

- [ ] **Step 5: Commit together with Task 2 and Task 3**

Stage nothing yet. The commit is at the end of Task 3.

---

### Task 2: The checker for removed names and retired words

**Files:**
- Create: `scripts/check-docs-retired-names.mjs`, `tests/check-docs-retired-names.test.ts`, `tests/fixtures/docs-retired-names/map.json`, `tests/fixtures/docs-retired-names/docs/guides/clean.md`, `tests/fixtures/docs-retired-names/docs/guides/stale.md`
- Modify: `package.json` (script `docs:retired-names`)

**Interfaces:**
- Produces: `node scripts/check-docs-retired-names.mjs [--map <file>] [--root <dir>] [file.md ...]`. One line per finding on standard output, `<file>:<line>: retired <call|name|value|import|word> <what>`; a count on standard error; exit 1 when there is a finding. Without file arguments it reads `README.md`, `docs/README.md`, `PUBLISHING.md`, `tools/graph/README.md`, `docs/guides/*.md` and `docs/benchmarks/*.md`, and skips `docs/guides/migrating-to-0.5.md`.

What it looks for. From the codemod's map: a removed method written as a call or as a code span (`` `build` ``, `build(`, but not the English word build); a removed type or error code as a whole word; a retired string value in single quotes; a removed import specifier. From the spec's vocabulary: cleanup, startup, acquisition mode, bag, scope and child scope, fork, root lifetime, family. A retired WORD is looked for in prose only, with code spans blanked out, and these spellings are allowed: the product names, "options bag", "bag of options", "in scope", "out of scope", "fork the repository". A method whose name is still live on some owner, such as `buildModule` or `withLifetime`, is not reported.

The script, its fixtures and its test were run when the plan was written. The test caught three real defects on the way, which is why the code looks the way it does: the allowed spellings must not hide `DI_BAG_CYCLE` or `'di-bag/node'`, which are themselves spelled with allowed text; the removed type `Bag` must not match inside the product name `DI Bag`; and a code span must not be read as prose.

- [ ] **Step 1: The fixtures**

`tests/fixtures/docs-retired-names/map.json`:

```json
{
  "version": 1,
  "methods": [
    { "owner": "Builder", "from": "build", "to": "buildContainer" },
    { "owner": "Builder", "from": "buildModule", "to": "buildModule", "transform": "bag" },
    { "owner": "DiBagApi", "from": "withLifetime", "to": "withLifetime", "transform": "method" }
  ],
  "types": [{ "from": "Bag", "to": "Container" }, { "from": "PluginProvider", "to": "PluginProvider", "genericArguments": [{ "index": 2, "values": { "raw": "uninspected" } }] }],
  "codes": [{ "from": "DI_BAG_CYCLE", "to": "DI_BAG_DEPENDENCY_CYCLE" }],
  "values": [{ "owner": "DiBagApi", "method": "withLifetime", "argument": 1, "from": "root", "to": "singleton:one-per-container-tree" }],
  "imports": [{ "from": "di-bag/node", "to": "di-bag" }]
}
```

`tests/fixtures/docs-retired-names/docs/guides/clean.md`:

````markdown
# Clean

DI Bag builds a container with `buildContainer()` from one options bag. Import `di-bag`.
We build the graph once. A service is in scope of nothing; the root container owns it.
See `DI_BAG_DEPENDENCY_CYCLE` and `buildModule({ exportedServiceKeys })`.
The `PluginProvider` type keeps its name.
````

`tests/fixtures/docs-retired-names/docs/guides/stale.md`:

````markdown
# Stale

Call `build` or `.build()` on the builder; the type is `Bag`.
Use `'root'` and import 'di-bag/node'. It raises DI_BAG_CYCLE.
The bag runs cleanup at startup of a child scope, or a fork.
````

- [ ] **Step 2: The failing test**

`tests/check-docs-retired-names.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const script = resolve(__dirname, '../scripts/check-docs-retired-names.mjs');
const root = resolve(__dirname, 'fixtures/docs-retired-names');
const run = (...files: string[]) => spawnSync('node', [script, '--root', root, '--map', resolve(root, 'map.json'), ...files], { encoding: 'utf8' });

test('current names, the product name, an options bag and ordinary English pass', () => {
  const result = run('docs/guides/clean.md');
  expect(result.stdout).toBe('');
  expect(result.status).toBe(0);
});

test('a removed call, type, code, value, import and each retired word are reported with file and line', () => {
  const result = run('docs/guides/stale.md');
  expect(result.status).toBe(1);
  expect(result.stdout.trim().split('\n')).toEqual([
    'docs/guides/stale.md:3: retired call build',
    'docs/guides/stale.md:3: retired name Bag',
    'docs/guides/stale.md:4: retired name DI_BAG_CYCLE',
    'docs/guides/stale.md:4: retired value root',
    'docs/guides/stale.md:4: retired import di-bag/node',
    'docs/guides/stale.md:5: retired word cleanup',
    'docs/guides/stale.md:5: retired word startup',
    'docs/guides/stale.md:5: retired word bag',
    'docs/guides/stale.md:5: retired word scope',
    'docs/guides/stale.md:5: retired word fork',
  ]);
});

test('without file arguments it reads the guides of the root', () => {
  const result = run();
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('10 finding(s) in 2 file(s)');
});
```

Run: `bun test tests/check-docs-retired-names.test.ts`. Expected: `0 pass`, `3 fail`, because the script does not exist.

- [ ] **Step 3: The script**

`scripts/check-docs-retired-names.mjs`:

```js
// Finds 0.4.0 names and retired vocabulary in the human guides. Exit 1 when it finds any.
// Usage, from the repository root: node scripts/check-docs-retired-names.mjs [--map <file>] [--root <dir>] [file.md ...]
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const take = name => { const index = args.indexOf(name); return index === -1 ? undefined : args.splice(index, 2)[1]; };
const root = resolve(take('--root') ?? '.');
const map = JSON.parse(readFileSync(take('--map') ?? join(root, 'tools/codemod/rename-map.json'), 'utf8'));
const markdownIn = directory => existsSync(join(root, directory)) ? readdirSync(join(root, directory)).filter(file => file.endsWith('.md')).sort().map(file => `${directory}/${file}`) : [];
// The migration guide and the changelog describe 0.4.0 on purpose; the agent docs and the reference have their own checks.
const skipped = new Set(['docs/guides/migrating-to-0.5.md']);
const files = (args.length ? args : ['README.md', 'docs/README.md', 'PUBLISHING.md', 'tools/graph/README.md', ...markdownIn('docs/guides'), ...markdownIn('docs/benchmarks')])
  .filter(file => existsSync(join(root, file)) && !skipped.has(file));

const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A removed callable name counts when it is written as a call or as a code span: `build`, `build(...)`, .build( and DiBag.token(
const live = new Set((map.methods ?? []).map(entry => entry.to));
const calls = [...new Set((map.methods ?? []).filter(entry => entry.from !== entry.to && !live.has(entry.from)).map(entry => entry.from))];
const names = [...(map.types ?? []).filter(entry => entry.from !== entry.to).map(entry => entry.from), ...(map.codes ?? []).map(entry => entry.from)];
const quoted = [...new Set((map.values ?? []).map(entry => entry.from))];
const imports = (map.imports ?? []).filter(entry => entry.from).map(entry => entry.from);
const rules = [
  ...calls.map(name => ({ kind: 'call', name, pattern: new RegExp('(?<![A-Za-z0-9_$])' + escape(name) + '\\(|`' + escape(name) + '`') })),
  ...names.map(name => ({ kind: 'name', name, pattern: new RegExp('(?<![A-Za-z0-9_])' + escape(name) + '(?![A-Za-z0-9_])') })),
  ...quoted.map(name => ({ kind: 'value', name, pattern: new RegExp("'" + escape(name) + "'") })),
  ...imports.map(name => ({ kind: 'import', name, pattern: new RegExp("'" + escape(name) + "'") })),
  ...[['cleanup', /\bcleanups?\b/i], ['startup', /\bstartup\b/i], ['acquisition mode', /\bacquisition ?modes?\b/i], ['bag', /\bbags?\b/i],
    ['scope', /\b(child )?scopes?\b/i], ['fork', /\bfork(s|ed|ing)?\b/i], ['root lifetime', /\broot (lifetime|service|provider)s?\b/i], ['family', /\b(ownership )?famil(y|ies)\b/i]]
    .map(([name, pattern]) => ({ kind: 'word', name, pattern })),
];
// Spellings that contain a retired word and are fine. They are blanked out before the rules run.
// The product name is fine everywhere, also where the removed type `Bag` is looked for.
const product = [/DI Bag/g, /(?<![A-Za-z0-9_])DiBag(?![A-Za-z0-9_])/g];
const allowed = [...product, /DiBag[A-Za-z]*/g, /di-bag[a-z-]*/g, /DI_BAG_[A-Z_]+/g, /\boptions? bags?\b/gi, /\bbags? of options\b/gi, /\b(one|single|the) bag\b(?= of| with| whose| that holds)/gi,
  /\b(in|out of|within) scope\b/gi, /\bfork (the|this|a) repo(sitory)?\b/gi];

let findings = 0;
for (const file of files) {
  readFileSync(join(root, file), 'utf8').split('\n').forEach((line, index) => {
    // A retired WORD is looked for in prose only: code spans and the allowed spellings are blanked out first.
    // A removed NAME is looked for in the whole line, because `DI_BAG_CYCLE` and 'di-bag/node' are themselves spelled with allowed text.
    let prose = line.replace(/`[^`]*`/g, match => ' '.repeat(match.length));
    for (const pattern of allowed) prose = prose.replace(pattern, match => ' '.repeat(match.length));
    let named = line;
    for (const pattern of product) named = named.replace(pattern, match => ' '.repeat(match.length));
    for (const rule of rules) if (rule.pattern.test(rule.kind === 'word' ? prose : named)) { findings += 1; console.log(`${file}:${index + 1}: retired ${rule.kind} ${rule.name}`); }
  });
}
console.error(`${findings} finding(s) in ${files.length} file(s)`);
process.exit(findings ? 1 : 0);
```

Run the test again. Expected: `3 pass`. Add to `package.json` scripts: `"docs:retired-names": "node scripts/check-docs-retired-names.mjs"`.

- [ ] **Step 4: Record the starting point**

```bash
npm run --silent docs:retired-names > /tmp/retired-names-before.txt; tail -1 /tmp/retired-names-before.txt
cut -d: -f1 /tmp/retired-names-before.txt | sort | uniq -c | sort -rn
```

Expected: several hundred findings; the order of files should resemble the list in "State on entry". A finding that is wrong, because an ordinary English use of a word is reported, is fixed in the script's `allowed` list with a fixture line and an assertion, never by rewording good prose to please the tool.

---

### Task 3: Migrate the standalone examples with the codemod

**Files:**
- Create: `scripts/migrate-doc-snippets.mjs`, `tests/migrate-doc-snippets.test.ts`, `tests/fixtures/doc-snippets/fake-codemod.mjs`
- Modify: `.gitignore` (`tools/codemod/.doc-snippets/`), the pages the script rewrites

**Interfaces:**
- Consumes: `isStandaloneProgram` and `parseMarkdown` from `tools/docs/lib/agent-docs.mjs` (Task 1); the codemod CLI; the 0.4.0 types that phase 1 vendored under `tools/codemod/test/fixtures/node_modules/di-bag`.
- Produces: `node scripts/migrate-doc-snippets.mjs [--write] [--root <dir>] [--command "<codemod command>"] [page.md ...]`. A dry run by default.

The guides primarily contain 0.4.0 examples, but earlier correctness edits can introduce current calls. Treat snippets as mixed-generation input. The script writes each standalone block to a file in a scratch project that has the 0.4.0 types, runs the codemod once over the project, and puts each changed block back between its fences. Reuse Phase 5 Task 7’s shipped-engine same-name `buildModule` guard: an existing options bag must not become a second nested `exportedServiceKeys` object, and independent nested old calls may still migrate. Add a mixed old/new snippet integration case using the real shipped engine (the two-call stand-in alone cannot prove this), cite the Phase 5 classifier regressions, and compile the final rewritten snippets against current declarations. Do not rely on every guide still being wholly old as the safety argument.

What was run when the plan was written: the script and its test, with a stand-in for the codemod that renames two calls (`2 pass`); then the script over the real guides with that stand-in, where it found 43 blocks, rewrote 36, changed 8 pages, and changed NOTHING outside TypeScript fences, which a comparison of the text around the blocks confirmed. With the real codemod it was not run.

- [ ] **Step 1: The stand-in and the failing test**

`tests/fixtures/doc-snippets/fake-codemod.mjs`:

```js
// Stands in for the codemod in tests/migrate-doc-snippets.test.ts: it renames two calls in every file of the project it is given.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const project = process.argv[process.argv.indexOf('--project') + 1];
const report = process.argv[process.argv.indexOf('--report') + 1];
const walk = directory => readdirSync(directory).flatMap(name => { const path = join(directory, name); return statSync(path).isDirectory() ? walk(path) : [path]; });
for (const file of walk(join(dirname(project), 'snippets'))) {
  const text = readFileSync(file, 'utf8');
  writeFileSync(file, text.replaceAll('.register(', '.withServices(').replace('.build();', '\n  .buildContainer();'));
}
writeFileSync(report, JSON.stringify({ manual: [{ file: 'snippets/x.ts', line: 1, reason: 'a reason a person must read' }] }));
```

`tests/migrate-doc-snippets.test.ts`:

````ts
import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const script = resolve(__dirname, '../scripts/migrate-doc-snippets.mjs');
const fake = resolve(__dirname, 'fixtures/doc-snippets/fake-codemod.mjs');
const fence = (code: string, lang = 'ts') => '```' + lang + '\n' + code + '\n```';
const standalone = "import { DiBag } from 'di-bag';\nconst app = DiBag.createBuilder().register({ a: () => 1 }).build();";
const page = ['# Guide', '', 'First.', '', fence(standalone), '', 'A fragment stays as it is:', '', fence('builder.register({ b: () => 2 });'), '', 'Second.', '', fence(standalone.replace('a:', 'c:')), '', 'End.', ''].join('\n');

function workspace() {
  const root = mkdtempSync(join(tmpdir(), 'doc-snippets-'));
  mkdirSync(join(root, 'docs/guides'), { recursive: true });
  writeFileSync(join(root, 'docs/guides/guide.md'), page);
  return { root, run: (...flags: string[]) => spawnSync('node', [script, '--root', root, '--command', `node ${fake}`, ...flags], { encoding: 'utf8' }) };
}

test('a dry run reports and changes nothing', () => {
  const { root, run } = workspace();
  const result = run();
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('2 standalone blocks from 1 pages');
  expect(result.stdout).toContain('would rewrite docs/guides/guide.md:5');
  expect(result.stdout).toContain('would rewrite docs/guides/guide.md:18');
  expect(result.stdout).toContain('manual: snippets/x.ts:1 a reason a person must read');
  expect(readFileSync(join(root, 'docs/guides/guide.md'), 'utf8')).toBe(page);
});

test('--write puts each migrated block back where it came from, even when a block above it grew', () => {
  const { root, run } = workspace();
  expect(run('--write').status).toBe(0);
  const migrated = "import { DiBag } from 'di-bag';\nconst app = DiBag.createBuilder().withServices({ a: () => 1 })\n  .buildContainer();";
  expect(readFileSync(join(root, 'docs/guides/guide.md'), 'utf8')).toBe(page.replace(standalone, migrated).replace(standalone.replace('a:', 'c:'), migrated.replace('a:', 'c:')));
});
````

Run: `bun test tests/migrate-doc-snippets.test.ts`. Expected: `0 pass`, `2 fail`.

- [ ] **Step 2: The script**

`scripts/migrate-doc-snippets.mjs`:

```js
// Migrates the standalone TypeScript blocks of the guides and the README with the codemod, then writes them back in place.
// A standalone block imports 'di-bag' and nothing else except Node's own modules, so the codemod can resolve its calls.
// Usage, from the repository root: node scripts/migrate-doc-snippets.mjs [--write] [--root <dir>] [--command "<codemod command>"] [page.md ...]
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isStandaloneProgram, parseMarkdown } from '../tools/docs/lib/agent-docs.mjs';

const args = process.argv.slice(2);
const take = name => { const index = args.indexOf(name); return index === -1 ? undefined : args.splice(index, 2)[1]; };
const root = resolve(take('--root') ?? '.');
const command = (take('--command') ?? 'node tools/codemod/cli.mjs').split(' ');
const write = args.includes('--write') && args.splice(args.indexOf('--write'), 1).length > 0;
const pages = args.length ? args : [...(existsSync(join(root, 'README.md')) ? ['README.md'] : []),
  ...(existsSync(join(root, 'docs/guides')) ? readdirSync(join(root, 'docs/guides')).filter(file => file.endsWith('.md')).sort().map(file => `docs/guides/${file}`) : [])];

const work = join(root, 'tools/codemod/.doc-snippets');
const vendored = join(root, 'tools/codemod/test/fixtures/node_modules/di-bag');
rmSync(work, { recursive: true, force: true });
mkdirSync(join(work, 'node_modules'), { recursive: true });
if (existsSync(vendored)) cpSync(vendored, join(work, 'node_modules/di-bag'), { recursive: true });

// One file per block. The name carries the page and the line of the opening fence, which is how it finds its way back.
const found = [];
for (const page of pages) {
  const { blocks } = parseMarkdown(readFileSync(join(root, page), 'utf8'));
  for (const block of blocks) {
    if (block.lang !== 'ts' || !isStandaloneProgram(block.code)) continue;
    const file = join(work, 'snippets', page.replaceAll('/', '__').replace(/\.md$/, ''), `block-${block.line}.ts`);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, block.code);
    found.push({ page, line: block.line, file, before: block.code });
  }
}
writeFileSync(join(work, 'package.json'), '{ "name": "doc-snippets", "private": true, "type": "module" }\n');
writeFileSync(join(work, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, module: 'NodeNext', moduleResolution: 'NodeNext', target: 'es2022', skipLibCheck: true, types: [] }, include: ['snippets'] }, null, 2) + '\n');
console.log(`${found.length} standalone blocks from ${new Set(found.map(item => item.page)).size} pages`);

const report = join(work, 'report.json');
const run = spawnSync(command[0], [...command.slice(1), '--project', join(work, 'tsconfig.json'), '--write', '--report', report], { cwd: root, encoding: 'utf8' });
if (run.status !== 0) { console.error(`the codemod failed:\n${run.stdout}${run.stderr}`); process.exit(1); }

// Write back from the bottom of each page upwards, so that a block that changed its length does not move the ones above it.
let changed = 0;
for (const page of new Set(found.map(item => item.page))) {
  const lines = readFileSync(join(root, page), 'utf8').split('\n');
  for (const item of found.filter(candidate => candidate.page === page).sort((a, b) => b.line - a.line)) {
    const after = readFileSync(item.file, 'utf8');
    if (after === item.before) continue;
    changed += 1;
    console.log(`${write ? 'rewrote' : 'would rewrite'} ${page}:${item.line}`);
    // item.line is the 1-based line of the opening fence, so the code starts at index item.line.
    lines.splice(item.line, item.before.split('\n').length - 1, ...after.replace(/\n$/, '').split('\n'));
  }
  if (write) writeFileSync(join(root, page), lines.join('\n'));
}
console.log(`${changed} of ${found.length} blocks ${write ? 'rewritten' : 'would change'}`);
if (existsSync(report)) {
  const manual = JSON.parse(readFileSync(report, 'utf8')).manual ?? [];
  for (const item of manual) console.log(`manual: ${item.file}:${item.line} ${item.reason}`);
}
```

Run the test again. Expected: `2 pass`. Add `tools/codemod/.doc-snippets/` to `.gitignore`.

- [ ] **Step 3: Dry run, then write**

```bash
npm ci --prefix tools/docs --no-audit --no-fund      # the script imports the docs tool's Markdown parser
node scripts/migrate-doc-snippets.mjs                # dry run: which blocks would change, and the codemod's manual items
node scripts/migrate-doc-snippets.mjs --write
git diff --stat -- README.md docs/guides
```

Every `manual:` line is an example the codemod would not decide; rewrite that example by hand in the task of its page. Expect two kinds. A token that one example uses both for a single service and for contributions is split into two tokens, as use case 8 of the examples companion shows. An example that creates child scopes gets lifetimes pinned by the codemod; read each pin and keep only those the example needs, because a guide should show the singleton default, not a migration artifact.

- [ ] **Step 4: Look at what is left, commit the three tools and the mechanical rewrite**

```bash
npm run docs:check 2>&1 | grep -cE "^(README\.md|docs/guides/)"    # the compiler's worklist after the codemod
npm run --silent docs:retired-names | tail -1                        # the checker's worklist
git add tools/docs/lib/agent-docs.mjs tools/docs/test/agent-docs.test.mjs scripts/check-docs-retired-names.mjs scripts/migrate-doc-snippets.mjs tests/check-docs-retired-names.test.ts tests/migrate-doc-snippets.test.ts tests/fixtures/docs-retired-names tests/fixtures/doc-snippets package.json .gitignore README.md docs/guides
git commit -m "docs(guides): compile standalone examples, migrate them with the codemod, list what is left" -m "Produced by: node scripts/migrate-doc-snippets.mjs --write. npm run docs:check stays red until the guides are rewritten; the last task of this plan turns it green."
```

This is the one commit of the phase that leaves `docs:check` red. The master plan's controller knows; say it again in the report.

---

## How every rewrite task below works

Tasks 4 to 8 each own a set of files that no other task touches. For each file the loop is the same, and it ends only when both tools are silent for that file:

```bash
page=docs/guides/tutorial.md                                   # the file of the task
npm run docs:check 2>&1 | grep "^$page"                        # compiler errors in its standalone examples
node scripts/check-docs-retired-names.mjs "$page"              # removed names and retired words, by line
```

Rules for the rewrite, in the order in which they settle an argument:

1. **The spec's rename map and vocabulary decide every name.** When in doubt about a call's 0.5.0 shape, read its signature in `docs/agent/api-card.md`, which is generated from the source, not this plan and not memory.
2. **Reuse the examples companion.** `docs/superpowers/specs/2026-09-20-swift-api-style-examples.md` has seventeen worked use cases in 0.5.0. Where a guide shows the same situation, use that code. The map of situations to use cases is in each task.
3. **Fix the example, never the check.** A standalone example that does not compile is wrong, or the API card is; find out which.
4. **A fragment is rewritten by hand and by analogy** with the standalone example nearest to it. Where adding an import and one declaration makes it standalone, do that, so that it is compiled from now on.
5. **Prose changes only where a name or a retired word requires it, or where the behavior changed** (the singleton default, child containers that replace only scoped services, collection tokens, one entry point, `ensureServicesReady` on a container). Do not restyle paragraphs that are still true.
6. **Anchors.** A heading that names a retired word is reworded and gets an explicit id, `## New title {#new-id}`. Before changing any anchor: `grep -rn "#<old-id>" src AGENTS.md README.md docs tools/graph/README.md`, and change every hit in the same commit.

---

### Task 4: The tutorial, and the anchors that `src` links to

**Files:**
- Modify: `docs/guides/tutorial.md` (1,404 lines, 33 TypeScript blocks of which 24 are standalone, 333 findings at the 0.4.0 source), `docs/guides/api-reference.md` ONLY for the section titles under "Usage topics" that mirror the tutorial's headings, and the JSDoc URLs in `src/*.ts`

- [ ] **Step 1: Rename the headings that use retired words, with every link to them**

The tutorial's anchors are generated from its headings, and `src` links to 18 of them from JSDoc (`grep -rhoE "guides/tutorial\.html#[a-z0-9-]+" src | sort | uniq -c` lists them with counts). These five change; all others keep their text and therefore their anchor.

| Heading at 0.4.0 | Anchor at 0.4.0 | New heading | New explicit id |
| --- | --- | --- | --- |
| Start selected services and cancel cooperatively | `start-selected-services-and-cancel-cooperatively` | Make selected services ready, and cancel cooperatively | `make-selected-services-ready` |
| Attach cleanup with `withDisposal` | `attach-cleanup-with-withdisposal` | Attach disposal with `withDisposal` | `attach-disposal-with-withdisposal` |
| Create tracked child scopes | `create-tracked-child-scopes` | Create child containers | `create-child-containers` |
| Fork for scopes and tests | `fork-for-scopes-and-tests` | Create an independent container for tests | `create-an-independent-container` |
| Choose root, scoped or transient caching | `choose-root-scoped-or-transient-caching` | Choose a lifetime: singleton, scoped or transient | `choose-a-lifetime` |

For each row, one substitution over everything that can link to it, then the heading itself by hand:

```bash
for pair in start-selected-services-and-cancel-cooperatively=make-selected-services-ready attach-cleanup-with-withdisposal=attach-disposal-with-withdisposal create-tracked-child-scopes=create-child-containers fork-for-scopes-and-tests=create-an-independent-container choose-root-scoped-or-transient-caching=choose-a-lifetime; do
  old="${pair%%=*}"; new="${pair##*=}"
  grep -rlE "#${old}([^a-z0-9-]|$)" src AGENTS.md README.md docs/agent docs/guides docs/README.md tools/graph/README.md | xargs -r sed -i -E "s/#${old}([^a-z0-9-]|$)/#${new}\\1/g"
done
npm run build && npm run docs:generate     # docs/reference and the API card repeat the JSDoc URLs
grep -rnE "#(start-selected-services|attach-cleanup-with|create-tracked-child-scopes|fork-for-scopes|choose-root-scoped)" src AGENTS.md README.md docs tools/graph/README.md | grep -v "^docs/superpowers/"   # expect no output
```

At the 0.4.0 source these five anchors are linked 3, 1, 5, 5 and 1 times from `src`, and 3, 4, 3, 3 and 4 times from the Markdown the loop reads; on a scratch copy the loop changed 30 lines in 11 files. Before the regeneration the last `grep` still lists `docs/reference`, which is generated from the JSDoc. `docs/superpowers` holds plans and specs that quote the old anchors as history: leave them. Then write the five headings with their explicit ids. `docs/guides/api-reference.md` repeats the tutorial's headings as titles under "Usage topics": give those five the new titles.

- [ ] **Step 2: Replace the lifetime section**

Replace the whole section that Step 1 renamed to "Choose a lifetime" with this text. Keep, below it, any subsection of the old text that is still true and is not covered here.

````markdown
## Choose a lifetime: singleton, scoped or transient {#choose-a-lifetime}

A lifetime says how many instances of a service a container tree holds. A
container tree is a root container and all its child containers. Every value is
written in full, `term:description`: the term is what other dependency
injection containers call it, and the description is what it means here.

| Value | Instances | Owned and disposed by |
| --- | --- | --- |
| `'singleton:one-per-container-tree'`, the default | one, shared by the root and every child | the container that defines the provider, usually the root |
| `'scoped:one-per-container'` | one in each container that resolves it | that container |
| `'transient:one-per-resolve'` | a new one for every `resolve` and every dependency read | the container that resolved it |

An application with a single container never writes a lifetime: with one
container, singleton and scoped behave the same. Lifetimes start to matter with
the first `createChildContainer()`, typically one per request or job.

```ts
import { DiBag } from 'di-bag';

type RequestContext = { requestId: string };
let served = 0;
const app = DiBag.createBuilder()
  .withServices({
    clock: () => ({ now: () => Date.now() }),
    request: DiBag.createProvider((): RequestContext => ({ requestId: `request-${++served}` })).withLifetime('scoped:one-per-container'),
    handler: DiBag.createProvider(({ clock, request }: { clock: { now(): number }; request: RequestContext }) =>
      () => `${request.requestId} at ${clock.now()}`).withLifetime('scoped:one-per-container'),
  })
  .buildContainer();

const first = app.createChildContainer();
const second = app.createChildContainer();
console.log(first.resolve('clock') === second.resolve('clock'));     // true: one clock for the tree
console.log(first.resolve('request') === second.resolve('request')); // false: one request per container
await app.close();
```

Two rules are checked when the graph is built, at compile time:

- **A singleton may not depend on a scoped service.** It would keep the first
  container's instance for ever. The message names both services; mark the
  consumer scoped too, as `handler` is above, or make the dependency a
  singleton. `withLifetime('singleton:one-per-container-tree', {
  allowsScopedDependencies: true })` opts out for a singleton that reads a
  scoped service lazily and never keeps it.
- **A child container replaces only scoped and transient services.** Replacing
  a singleton in one child would leave every other container with the original.
  Mark the service scoped, or use `createIndependentContainer`, which shares no
  instance with its source and may replace anything.

One gap stays silent. A service that holds per-request state and depends on
nothing scoped, such as a unit of work over a singleton database, has no
dependency for the compiler to object to. Nothing forces its mark, and without
it there is one instance for all requests. Mark it by hand.

A transient service with a disposer stays owned by the container that resolved
it until that container closes. Resolved from the root of a long-running
process, such instances pile up. Resolve disposable transients in a child
container, which releases them when it closes.
````

What this text claims was checked at the 0.4.0 source with the equivalent 0.4.0 calls when the plan was written: a root service is one instance for parent and child while a scoped one is not, and a disposable transient resolved from the root is released only when the root closes, while one resolved in a child is released when the child closes. The two compile-time rules are the spec's and were not compiled.

- [ ] **Step 3: The rest of the tutorial, section by section**

Work from the top. The situations that have a ready 0.5.0 version in the examples companion:

| Tutorial section | Use case in the companion |
| --- | --- |
| Compose services; Async edges are explicit | 1, 12 |
| Make selected services ready | 1, 15 |
| Attach disposal with `withDisposal`; release partial acquisition | 10 |
| Create child containers | 2, 3, 17 |
| Create an independent container for tests | 4 |
| Reuse named modules | 5, 6 |
| Use typed tokens; adapt classes and positional functions; optional and lazy | 9 |
| Compose an ordered collection | 7, 8 |
| Attach metadata and inspect without resolving | 12 |
| Observe lifecycle transitions | 13 |
| Admit an application-selected plugin | 14 |
| Portable mode | 11 |
| Errors and recovery | 15 |

Three sections need more than new names. "Compose an ordered collection" described one token with two channels; it now describes a collection token, read with plain `resolve` or as a dependency, and says that a token is either for one service or for a collection. "Portable mode" and every mention of `di-bag/node` now say that there is one entry point and that the package finds the host's classifier by itself. "Exported TypeScript types" lists type names; take the current list from `src/index.ts`, not from the old text.

- [ ] **Step 4: Verify and commit**

```bash
npm run docs:check 2>&1 | grep -c "^docs/guides/tutorial.md"          # expect 0
node scripts/check-docs-retired-names.mjs docs/guides/tutorial.md    # expect exit 0
git add docs/guides/tutorial.md docs/guides/api-reference.md src docs/agent docs/reference AGENTS.md README.md
git commit -m "docs(tutorial): 0.5.0 API and vocabulary, the lifetime section, anchors renamed with their links"
```

---

### Task 5: Server recipes

**Files:**
- Modify: `docs/guides/server-integration.md` (715 lines, 14 TypeScript blocks of which 3 are standalone and 1 imports sibling files, 146 findings)

- [ ] **Step 1: Reorder the opening around the singleton default**

At 0.4.0 the guide starts from "one scope per request". With singletons by default, most servers need no child container at all. The guide's first recipe becomes: build one container, make the listed services ready, handle every request with singleton services, close on shutdown (use case 1 of the companion). Child containers come SECOND, under a heading "One child container per request" with the explicit id `request-containers`, for state that really is per request (use cases 2, 3 and 17): `request` is marked `'scoped:one-per-container'`, and so is everything that depends on it, which the compiler enforces. The section "Close each request scope" is renamed "Close each request container", id `close-each-request-container`; fix the links to the old anchor as in Task 4 Step 1 (`grep -rn "#close-each-request-scope" .`).

- [ ] **Step 2: The framework sections**

Node HTTP, Express, Fastify, Bun, Deno: new names in every block; `buildAndStart(keys, options)` becomes `buildContainer()` followed by `await container.ensureServicesReady(serviceKeys, { totalTimeoutMs, abortSignal })`; `close({ signal, timeoutMs })` becomes `close({ abortSignal, waitTimeoutMs })`; "Startup failures and deadlines" becomes "Readiness failures and deadlines", id `readiness-failures-and-deadlines`, with `DiBagServiceReadinessError` and `DiBagServiceReadinessCancelledError` and their `disposal...` fields.

- [ ] **Step 3: Elysia, only if it can be proven**

The companion's use case 16 is an Elysia server. Add it as a section after Bun only if its claims about Elysia's API hold: install `elysia` into a scratch directory outside the repository, put the example there next to the built `di-bag` package, and type-check it. If it compiles, add the section and say in the report which Elysia version was used. If it does not compile, or the package cannot be installed, leave Elysia out and say why in the report. Do not add `elysia` to any `package.json` of this repository.

- [ ] **Step 4: Verify and commit**

```bash
npm run docs:check 2>&1 | grep -c "^docs/guides/server-integration.md"          # expect 0
node scripts/check-docs-retired-names.mjs docs/guides/server-integration.md    # expect exit 0
git add docs/guides/server-integration.md
git commit -m "docs(server): singleton services first, then request containers; readiness and close options"
```

---

### Task 6: The API overview

**Files:**
- Modify: `docs/guides/api-reference.md` (351 lines, 105 findings)

This page is tables of names with links into the generated reference under `docs/reference/`. Earlier phases already fixed the rows whose links died when a type was removed. Now every row is brought to 0.5.0.

- [ ] **Step 1: Rebuild the three "API at a glance" tables from the API card**

`docs/agent/api-card.md` is generated from the source and lists every public call with its signature. Rewrite "Configure and describe services", "Build and reuse a graph" and "Use and close a bag" (renamed "Use and close a container", id `use-and-close-a-container`) so that each row names a 0.5.0 call, in the card's order, one line of description each. A row for a removed call is deleted, not annotated: the migration guide of phase 13 is where old names live.

- [ ] **Step 2: Errors, types, topics**

"Errors and recovery": the classes `DiBagDisposalError`, `DiBagServiceReadinessError`, `DiBagServiceReadinessCancelledError`, `DiBagCloseCancelledError`, `DiBagPluginValidationError`, and one sentence that a code names a kind of failure with the method in `details.operation`; link to `../agent/errors.md` for the list instead of repeating it. "Exported TypeScript types": regenerate the lists from `src/index.ts` (`grep -n "^export" src/index.ts`); every name links to its page under `docs/reference/`, and `npm run docs:check` fails on a dead link. "Usage topics": the titles mirror the tutorial's headings after Task 4.

- [ ] **Step 3: Verify and commit**

```bash
npm run docs:check 2>&1 | grep -c "^docs/guides/api-reference.md"          # expect 0
node scripts/check-docs-retired-names.mjs docs/guides/api-reference.md    # expect exit 0
git add docs/guides/api-reference.md
git commit -m "docs(api-overview): every row names a 0.5.0 call"
```

---

### Task 7: The remaining guides

One commit per file. They do not overlap with each other or with Tasks 4 to 6, so they can be given to parallel workers, each with this task's text, the section "How every rewrite task below works", and the Global Constraints.

| File | Size and findings at 0.4.0 | What needs more than new names |
| --- | --- | --- |
| `docs/guides/react-integration.md` | 356 lines, 7 blocks (1 standalone, 4 `tsx`), 71 findings | "A project runtime borrows, owns, and starts": a project runtime is a child container that shares parent services with `sharedParentServiceKeys`, and readiness is `ensureServicesReady`. The `tsx` blocks are not compiled by the docs check; the real code is `examples/react/`, which phase 6 to 11 migrated and `npm run check:react-browser` runs. Copy from there, do not write React code from memory. |
| `docs/guides/enterprise-integration.md` | 145 lines, 2 fragments, 38 findings | "One owned scope per operation" becomes "One child container per operation", id `one-child-container-per-operation`; "Checked test substitutions" uses `createIndependentContainer(replacedServiceKeys, replacementProviders)`. The matching example is `examples/integration/owned-scope.ts`; if phase 6 renamed that file, use its new name in links. |
| `docs/guides/comparison.md` | 177 lines, no code, 21 findings | Vocabulary only, plus one fact about DI Bag itself: a provider without a lifetime is now a singleton. Where the page compared lifetimes, state the three values and the two compile-time rules. Do not add or change any statement about another library; this phase does not verify them. |
| `docs/guides/agent-harnesses-and-graphs.md` | 225 lines, 1 standalone block, 27 findings | The `di-bag-graph` node field is `isOwnedByContainer` only after phase 13; until then this page describes the tool as it is. Use the names the tool prints TODAY (`node tools/graph/cli.mjs --help` and its README). |
| `docs/guides/examples-modularity.md` | 366 lines, 3 standalone, 34 findings | It holds the text block "Recommended module layout", which `AGENTS.md` must copy byte for byte (`checkLayoutBlock`). Do not touch that block. |
| `docs/guides/examples-extensibility.md` | 374 lines, 3 standalone, 28 findings | Observers: `lifecycleObservers`, `onLifecycleEvent`, `onObserverFailure`, event kinds `container-*` and `disposal-*`. |
| `docs/guides/examples-type-checking.md` | 327 lines, 3 standalone, 23 findings | It quotes compile-time messages. Copy each message from `docs/agent/errors.md`, which earlier phases kept current, not from the old text. |
| `docs/guides/examples-plain-services.md` | 309 lines, no TypeScript blocks, 10 findings | Vocabulary only. |
| `docs/guides/development.md`, `docs/guides/documentation.md` | 160 and 157 lines, 5 and 6 findings | Command names did not change. Add the two new scripts of this plan to the list of checks in `development.md`: `npm run docs:retired-names`, and the sentence that `npm run docs:check` compiles the standalone examples of the guides. |

For every file: the loop from "How every rewrite task below works", then

```bash
git add <the one file>
git commit -m "docs(<guide name>): 0.5.0 API and vocabulary"
```

---

### Task 8: README and the small documents

**Files:**
- Modify: `README.md` (294 lines, 4 blocks of which 3 standalone, 49 findings), `docs/README.md`, `tools/graph/README.md`, `docs/benchmarks/typescript.md` (prose and captions only), `PUBLISHING.md` (names only, not versions)

- [ ] **Step 1: `README.md`**

The tagline and "Why DI Bag?" stay. "Quickstart": the companion's use case 1, shortened, with `createBuilder().withServices({...}).buildContainer()`. "Swap a dependency for a test": use case 4, `createIndependentContainer`. "Work with async services" and "Give resources a clear owner": use cases 12 and 10. "Scopes and forks" becomes "Child and independent containers", id `child-and-independent-containers`, with use cases 2 and 17 and ONE sentence on the singleton default; fix links to `#scopes-and-forks` as in Task 4 Step 1. "Modules as units of work": use cases 5 and 6. "Runtime support": one entry point, no `di-bag/node`. "How it compares" and "Tradeoffs and limits": vocabulary only. The README is what npm shows, so keep it at about its present length.

- [ ] **Step 2: The small documents**

`docs/README.md`: link texts. `tools/graph/README.md`: the builder names in its prose and examples, as the tool reads them after phases 5 to 10; its output format is described as it is today. `docs/benchmarks/typescript.md`: API names in prose and captions; the numbers are refreshed in phase 13 and are not touched here. `PUBLISHING.md`: the two example names in its commands' prose if any is a 0.4.0 API name; the version strings are phase 13's.

- [ ] **Step 3: Verify and commit**

```bash
npm run docs:check 2>&1 | grep -c "^README.md"            # expect 0
node scripts/check-docs-retired-names.mjs README.md docs/README.md tools/graph/README.md docs/benchmarks/typescript.md PUBLISHING.md   # expect exit 0
git add README.md docs/README.md tools/graph/README.md docs/benchmarks/typescript.md PUBLISHING.md
git commit -m "docs(readme): 0.5.0 quickstart, child and independent containers, one entry point"
```

---

### Task 9: Two new recipes for agents

**Files:**
- Modify: `docs/agent/recipes.md`

The spec asks for the composite recipe. The second recipe, two modules that require the same key, is added only if phase 7 did not already add one: `grep -n "withRenamedRequirement" docs/agent/recipes.md`. Every block in this file is compiled by `npm run docs:check`, with the file markers on the first line of each block, so both recipes below are complete programs. They were written from the spec and the examples companion and were NOT compiled when the plan was written. If one fails, fix the recipe against the API card.

- [ ] **Step 1: Add the recipes before "Review a merge"**

````markdown
## Fan one service out to many: the composite {#composite-service}

One logger that writes to every sink. Two tokens: a collection token that sinks
are added to, and a single-service token for the logger everyone depends on. A
token cannot be both, which is what keeps "the logger" and "the sinks" apart.

```ts
// src/features/logging/contract.ts
import { DiBag } from 'di-bag';

export type Logger = { log(line: string): void };
const loggerSymbol = Symbol('logger');
const loggerSinksSymbol = Symbol('logger-sinks');
export const loggerToken = DiBag.createToken(loggerSymbol).forService<Logger>();
export const loggerSinksToken = DiBag.createToken(loggerSinksSymbol).forCollectionOf<Logger>();
```

```ts
// src/features/logging/module.ts
import { DiBag } from 'di-bag';
import { loggerSinksToken, loggerToken, type Logger } from './contract.js';

export const lines: string[] = [];
export const loggingModule = DiBag.createBuilder()
  .withCollectionContribution({ collectionToken: loggerSinksToken, provider: (): Logger => ({ log: line => { console.log(line); } }) })
  .withCollectionContribution({ collectionToken: loggerSinksToken, provider: (): Logger => ({ log: line => { lines.push(line); } }) })
  .withTokenService(loggerToken, DiBag.createProviderFromFunction({
    dependencies: [loggerSinksToken],
    factoryFunction: (sinks: readonly Logger[]): Logger => ({ log: line => { for (const sink of sinks) sink.log(line); } }),
  }))
  .buildModule({ exportedServiceKeys: [loggerToken], moduleLabel: 'logging' });
```

```ts
// src/features/logging/check.ts
import { DiBag } from 'di-bag';
import { loggerToken } from './contract.js';
import { loggingModule } from './module.js';

const app = DiBag.createBuilder().withInstalledModules([loggingModule]).buildContainer();
app.resolve(loggerToken).log('ready');
await app.close();
```

Another module adds a sink with one more `withCollectionContribution`; the
logger's factory does not change. Sinks are read in the order they were added.

## Install two modules that require the same key {#shared-requirement-key}

Both modules were written to require `config`, with different types. Rename the
requirement on each module value before installing it; no wrapper module is
needed, and a renamed module is a value that several hosts can install.

```ts
// src/app/contract.ts
export type OrdersConfig = { currency: string };
export type BillingConfig = { vatRate: number };
```

```ts
// src/app/modules.ts
import { DiBag } from 'di-bag';
import type { BillingConfig, OrdersConfig } from './contract.js';

export const ordersModule = DiBag.createBuilder()
  .withServices({ handler: ({ config }: { config: OrdersConfig }) => () => config.currency })
  .buildModule({ exportedServiceKeys: ['handler'], moduleLabel: 'orders' });
export const billingModule = DiBag.createBuilder()
  .withServices({ handler: ({ config }: { config: BillingConfig }) => () => config.vatRate })
  .buildModule({ exportedServiceKeys: ['handler'], moduleLabel: 'billing' });
```

```ts
// src/app/check.ts
import { DiBag } from 'di-bag';
import type { BillingConfig, OrdersConfig } from './contract.js';
import { billingModule, ordersModule } from './modules.js';

const app = DiBag.createBuilder()
  .withInstalledModules([
    ordersModule
      .withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'ordersConfig' })
      .withRenamedExport({ currentExportKey: 'handler', newExportKey: 'ordersHandler' }),
    billingModule
      .withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'billingConfig' })
      .withRenamedExport({ currentExportKey: 'handler', newExportKey: 'billingHandler' }),
  ])
  .withServices({
    ordersConfig: (): OrdersConfig => ({ currency: 'EUR' }),
    billingConfig: (): BillingConfig => ({ vatRate: 0.2 }),
  })
  .buildContainer();
console.log(app.resolve('ordersHandler')(), app.resolve('billingHandler')());
await app.close();
```
````

- [ ] **Step 2: Budgets, check, commit**

`npm run docs:check` enforces line budgets for the agent docs (`checkBudgets` in `tools/docs/lib/agent-docs.mjs`). If `docs/agent/recipes.md` exceeds its budget, the check says by how much: shorten the prose of THESE two recipes first, and only then ask the controller whether the budget should grow.

```bash
npm run docs:check 2>&1 | grep "^docs/agent/recipes.md"      # expect no output
git add docs/agent/recipes.md
git commit -m "docs(recipes): the composite service, and two modules that require the same key"
```

---

### Task 10: Green again, and the gate for good

- [ ] **Step 1: Both tools silent, site builds**

```bash
npm run docs:check            # expect exit 0: every standalone example of every guide compiles, every link and anchor resolves
npm run docs:retired-names    # expect exit 0 and "0 finding(s)"
npm run docs:build            # expect exit 0
```

A finding that is a legitimate use of a word, for example "the repository root" if the checker reported "root lifetime" there, is fixed in the checker's `allowed` list with a fixture line and an assertion in `tests/check-docs-retired-names.test.ts`, never by an ignore comment in a guide.

- [ ] **Step 2: Keep it that way**

Add the checker to the docs gate, so that a later change cannot bring an old name back. In `package.json`, append ` && node scripts/check-docs-retired-names.mjs` to the `docs:check` script. Run `npm run docs:check` once more; expected: exit 0. CI already runs `docs:check`.

- [ ] **Step 3: The master plan's gate list, then commit and report**

This phase changed no runtime code, so `npm run check` is expected to pass unchanged; run the full gate list anyway, because Task 4 edited JSDoc in `src`, which changes the generated API card and the reference.

```bash
git add package.json
git commit -m "build(docs): the retired-name check is part of docs:check"
```

Report in the master plan's format, and add: the number of findings before (Task 2 Step 4) and after (zero); the codemod's manual items from Task 3 and what you did with each; whether the Elysia section was added, with the version, or why not; every anchor you renamed beyond the five of Task 4 and the three of Tasks 5, 6 and 8; and the hash of the one commit that left `docs:check` red.

---

## Assumptions made in this plan

1. **Only standalone examples are compiled.** A block that imports a sibling file or another package is skipped by the check. The 29 fragments of the 0.4.0 guides stay unchecked unless the rewrite makes them standalone, which the rules encourage.
2. **`tsx` examples are not compiled by the docs check.** Their source of truth is `examples/react/`, which has its own browser lane.
3. **Anchors with retired words are renamed**, with explicit ids and every link updated, instead of keeping old anchors for stability. The site has no redirect mechanism for fragments, and the JSDoc URLs in `src` are updated in the same commit, so nothing inside the repository breaks; an external link to an old tutorial fragment lands on the top of the page.
4. **The checker's vocabulary is the spec's table of retired words**, minus "registration", "key", "name", "mode" and "start", which are retired only in one sense and are too common as ordinary English to check by pattern.
5. **The comparison page keeps its statements about other libraries** unverified and unchanged; this phase is a rename, not a review of competitors.

## Self-review

**Spec coverage.** Roadmap phase 12, "every guide, the README and the comparison rewritten to 0.5.0": Tasks 4 to 8. "The composite recipe": Task 9. "The lifetime guide", with the mapping of the three values, the rule that a singleton may not depend on a scoped service, the rule that a child container replaces only scoped and transient services, the remaining silent gap, and the note on disposable transients: Task 4 Step 2. "Two modules both require config": Task 9. The spec's risk "guides drift from the API": Tasks 1 and 10 make the standalone examples part of `docs:check` for good.

**What was run when this plan was written.** Run: the collector change with its test on a scratch copy (red, then 23 of 23), and the collector over the real repository (43 guide snippets, no collection error); the retired-name checker with its fixtures (three defects found by its own test and fixed), and over the real guides with a provisional map (916 findings, the per-file numbers quoted above); the snippet migration script with a stand-in codemod, in its test and over the real guides (43 blocks found, 36 rewritten, no text outside TypeScript fences changed); 0.4.0 probes for the lifetime section's runtime claims. Not run: the type-check of the 43 guide snippets, the migration with the real codemod, every new or rewritten example in its 0.5.0 form, including the two recipes and the lifetime section's example.

**Names used across tasks.** `isStandaloneProgram` (Task 1, used by Task 3); `scripts/check-docs-retired-names.mjs` and the npm script `docs:retired-names` (Task 2, used by every later task); `tools/codemod/.doc-snippets` (Task 3, in the script and `.gitignore`); the five renamed tutorial anchors (Task 4, mirrored in Task 6).
