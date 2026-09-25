# Codemod Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `tools/codemod`, the type-aware package `di-bag-codemod` that later phases feed with data to move every DI Bag 0.4.0 call site to 0.5.0.

**Architecture:** One pass over the original TypeScript program. A node is rewritten only when the checker resolves it to a declaration of the library; the new text of a node is assembled from the already rewritten text of its children, so nested rewrites compose without re-parsing. All API knowledge lives in `rename-map.json`; the engine and its generic transforms know no DI Bag name. A custom transform is a function that receives the call and asks the map for every name it emits.

**Tech Stack:** Node 24.20.0 ES modules (`.mjs`), the TypeScript 6 compiler API (`typescript@^6.0.3`, the project's copy when it is 6.0.3 or later, else the bundled one), `node --test`. No other dependency. Modelled on `tools/graph`.

**Spec:** `docs/superpowers/specs/2026-09-20-swift-api-style.md` (section "Migration support"), and `docs/superpowers/plans/2026-09-21-00-swift-api-style-master.md` (sections "The codemod contract", "Protocol for every phase", "Environment"). Read both before starting. This plan is phase 1 of the master plan's phase table.

## Global Constraints

- The master plan's "Global Constraints" and "Assumptions" apply. The ones that bind this phase: executors never push, publish or merge; commits use Conventional Commits and end with the two attribution lines from the master plan's "Commit format"; the phase ends green on the full gate list.
- This phase changes no file under `src/`, `tests/`, `examples/` or `docs/`, except one paragraph in `docs/guides/development.md`. It is not breaking.
- The codemod contract, verbatim from the master plan: the CLI is `node tools/codemod/cli.mjs --project <tsconfig> [--library-root <dir>] [--extra-files <glob>]... [--write] [--report <file>]`; it is type-aware; it makes one pass over the original program and every decision uses the original types; `rename-map.json` holds `methods`, `options`, `values`, `types`, `codes`, `imports`, `properties`; a transform never hardcodes an API name it emits and asks `api.nameOf(owner, oldName)`; the map always describes the distance from 0.4.0; anything it cannot decide goes to the report as a manual item with file, line and reason; it never guesses.
- Two additions this plan makes to that CLI, both supersets: `--library-root` may be repeated, and `--map <file>` selects another map. The first is required in this repository: `tests/platform/*.ts`, `tests/package.test.ts` and four more files import `di-bag` by name, which resolves to `dist/index.d.ts`, so this repository runs the codemod with `--library-root src --library-root dist`.
- The shipped `tools/codemod/rename-map.json` starts with phase 3 entries only. Names from later phases appear in this phase only inside fixture-local `map.json` files, which are test data for the generic transforms and are not shipped.
- The package is `di-bag-codemod` 0.1.0 with `"private": true`. Phase 13 removes `private` and publishes it.
- The package must not import anything from `tools/graph` or from the repository's `src`. The two tools are published separately.

## State on entry

Phase 0 is merged into `next`. Nothing in phase 0 touches what this plan needs. Confirm before starting:

| Expectation | Command | Expected |
| --- | --- | --- |
| On a fresh phase branch | `git switch next && git switch -c phase-01-codemod-foundation && git status --short` | no output |
| Pinned tools | `bun --version && node --version` | `1.4.0` and `v24.20.0` |
| `tools/codemod` does not exist | `ls tools/codemod` | `No such file or directory` |
| `tools/graph` is the model | `ls tools/graph` | `cli.mjs lib LICENSE node_modules package.json package-lock.json README.md test` (`node_modules` only after `npm ci --prefix tools/graph`) |
| The published 0.4.0 is reachable | `npm view di-bag@0.4.0 dist.shasum` | `56ac7ce26a5114addad33e3da9c73872c8cab3a9` |
| The 0.4.0 API is still in `src` | `grep -c "buildAndStart" src/di-bag.ts` | a number above 0 |
| A nested `node_modules` fixture is not ignored by git | `git check-ignore -v tools/codemod/test/fixtures/node_modules/di-bag/package.json; echo $?` | prints only `1` |

If the last check prints a rule instead of `1`, a global ignore file matches `node_modules`; add the fixture in Task 3 with `git add -f`.

## File Structure

Every file is new except the five listed under "Modified".

| File | Responsibility |
| --- | --- |
| `tools/codemod/package.json`, `package-lock.json`, `LICENSE`, `README.md` | the package `di-bag-codemod`, shaped like `tools/graph` |
| `tools/codemod/cli.mjs` | argument parsing, the summary and manual-item output, exit codes |
| `tools/codemod/rename-map.json` | the shipped data: the distance from 0.4.0, phase 3 entries only for now |
| `tools/codemod/rename-map.schema.json` | the JSON Schema that documents every field of a map |
| `tools/codemod/lib/load-typescript.mjs` | the project's TypeScript when it is 6.0.3 or later, else the bundled one |
| `tools/codemod/lib/glob.mjs` | `--extra-files` expansion: `*`, `**`, `?` |
| `tools/codemod/lib/rename-map.mjs` | load, validate and index a map; `nameOf` |
| `tools/codemod/lib/library.mjs` | which declarations are the library, and the owner name of a member |
| `tools/codemod/lib/rewrite.mjs` | the engine for one source file: recursive text assembly and the generic transforms |
| `tools/codemod/lib/codemod.mjs` | the public entry: build the program, run every file, write, collect manual items |
| `tools/codemod/lib/transforms/index.mjs` | the registry of custom transforms |
| `tools/codemod/lib/transforms/build-and-start.mjs` | the one custom transform of this phase |
| `tools/codemod/test/helpers.mjs` | one shared program over the fixture project; `runFixture` |
| `tools/codemod/test/*.test.mjs` | `glob`, `rename-map`, `fixtures`, `transforms`, `cli`, `pack` |
| `tools/codemod/test/fixtures/` | a project that type-checks against the vendored published 0.4.0 declarations; one directory per transform with `input.ts`, `expected.ts`, `expected-manual.json` and, for generic transforms, its own `map.json` |
| `tools/codemod/test/fixtures/node_modules/di-bag/` | vendored from the npm archive of 0.4.0: `package.json`, `LICENSE`, `dist/*.d.ts` |
| `tools/codemod/test/library-root-fixture/` | a tiny checked-out "library" under `src/` with callers, for `--library-root` and `--extra-files` |

Modified: `package.json` (script `codemod:check`), `.gitignore`, `.github/workflows/ci.yml`, `docs/guides/development.md`, and nothing else.

### How the engine decides, in one page

Read this before Task 3. It is the design the code implements.

- **Library.** A declaration belongs to the library when its file is under a `--library-root` directory, or, with none given, under a `node_modules/di-bag/` directory. Files of the library are never rewritten.
- **Owner.** The owner of a member is the nearest enclosing named declaration of its declaration: a class, interface or type alias gives `Name` (`Builder`, `DiBagApi`, `StartupOptions`, `Presence`); a function gives `name()` (`token()`, `fromFactory()`); a method's inline types give `Owner.method()`. `DiBag.withDisposal` resolves to the property `withDisposal` of the interface `DiBagApi`, so its owner is `DiBagApi`, also on a facade derived with `withConfiguration`. `builder.contribute` is a readonly property of the class `Builder`, so its owner is `Builder`. `token.key` is a constructor parameter property in `src` and a property declaration in the published declarations; both walk up to the class `Token`. `DiBag.token(key).of` is declared in an inline type literal of the function `token`, so its owner is `token()`.
- **Symbols.** The engine asks the checker for the symbol of a name and follows import aliases. A property of a union (`event.scopeId` on `LifecycleEvent`) has one declaration per member; the rename applies only when the map gives every one of them the same new name, else it is a manual item. Overloads and `this`-typed methods (`build`, `fork`) resolve like any method, even when the call itself has a type error, which is what makes `tests/types/negative/*.ts` work.
- **Cheap first.** A node is offered to the checker only when its text is a name the map mentions.
- **Assembly.** `text(node)` returns the rewritten text of a node without its leading trivia. A handler returns the whole new text of its node, or `undefined`. Without a handler result, `assemble(node, replacements)` copies the source between children and recurses into each child. A replacement is `{ start, end, text }` in file positions. A child that contains replacements is assembled with them and is not offered to a handler again; every other child is. A transform therefore builds its result from `text(child)` and never from source slices of nodes that may contain library calls.
- **Never half.** When a call cannot be rewritten completely (a spread argument, options that are not a literal where keys must merge), it is left untouched, reported, and its callee is remembered so the property-access handler does not rename the method name alone.
- **Manual items** carry `file`, `line`, `column`, `reason` and the first line of the node's text. After a file is assembled, every old code from `codes` that still occurs in it (a split code, a regular expression, a template with substitutions, a comment) is reported with its line in the new text.

### The rename map, field by field

`rename-map.schema.json` (Task 2) is the normative description. In short:

```jsonc
{
  "version": 1,
  "methods": [
    // rename only
    { "owner": "Builder", "from": "verifyGraph", "to": "verifyGraphAtCompileTime" },
    // overloads told apart by argument count; the first match wins
    { "owner": "Builder", "from": "register", "to": "withServices", "arity": [1] },
    // positional arguments become one bag; an extra last argument is merged with renamed keys, kept, or dropped
    { "owner": "Bag", "from": "createScope", "to": "createChildContainer", "arity": [2, 3],
      "arguments": { "kind": "bag", "names": ["replacedServiceKeys", "replacementProviders"],
                     "trailing": { "mode": "merge", "keys": { "share": "sharedParentServiceKeys" } } } },
    // the single argument is wrapped in an array
    { "owner": "Builder", "from": "installModule", "to": "withInstalledModules", "arguments": { "kind": "array" } },
    // a custom transform; "to" is what nameOf answers for the old name
    { "owner": "Builder", "from": "buildAndStart", "to": "ensureServicesReady", "transform": "build-and-start" }
  ],
  "options":    [{ "owner": "Bag", "method": "close", "argument": 0, "path": [], "from": "signal", "to": "abortSignal" }],
  "values":     [{ "owner": "DiBagApi", "method": "withLifetime", "argument": 1, "from": "root", "to": "singleton:one-per-container-tree" },
                 { "owner": "LifecycleEvent", "property": "kind", "from": "scope-opened", "to": "container-opened" }],
  "properties": [{ "owner": "Token", "from": "key", "to": "symbol" },
                 { "owner": "StartupOptions", "from": "startupOrder", "manual": "the sentence shown to the person who decides" }],
  "types":      [{ "from": "Bag", "to": "Container" }],
  "codes":      [{ "from": "DI_BAG_CYCLE", "to": "DI_BAG_DEPENDENCY_CYCLE" }, { "from": "DI_BAG_INVALID_SCOPE", "manual": "how to choose" }],
  "imports":    [{ "from": "di-bag/node", "to": "di-bag" }, { "fromSuffix": "/src/node", "toSuffix": "/src" }]
}
```

The examples above use names of later phases to show the shapes. They are not the content of the shipped map.

Rules for everyone who adds entries in a later phase:

1. **The map is the distance from 0.4.0.** `from` is always the 0.4.0 name and `owner` the 0.4.0 declaration name. When a later phase renames something an earlier entry already produced, edit that entry's `to`; do not add a second hop. Example: phase 5 renames `build`. It adds `{ "owner": "Builder", "from": "build", "to": "buildContainer" }`, and the `build-and-start` transform follows by itself, because it emits `api.nameOf('Builder', 'build')`. Phase 5 then updates `tools/codemod/test/fixtures/build-and-start/expected.ts`.
2. **`options` and `properties` overlap on purpose.** `options` finds a key by call and position and needs no types, so it works in files that do not type-check. `properties` finds a key through the contextual type of any object literal, so it reaches options built in a variable typed `CloseOptions`. Add both for an options type that has a name.
3. **A code that was split gets `manual`**, with a sentence that lists the new codes and how to choose. The master plan's spelling `"to": "manual"` is accepted and means the same with a default sentence.
4. **Every new kind of rewrite gets a fixture** under `tools/codemod/test/fixtures/<id>/`, and every fixture input must type-check against the vendored 0.4.0 declarations.

---

### Task 1: Package skeleton, TypeScript loader and glob expansion

**Files:**
- Create: `tools/codemod/package.json`, `tools/codemod/package-lock.json` (generated), `tools/codemod/LICENSE`
- Create: `tools/codemod/lib/load-typescript.mjs`, `tools/codemod/lib/glob.mjs`
- Create: `tools/codemod/test/glob.test.mjs`
- Create: `tools/codemod/test/library-root-fixture/package.json`, `tsconfig.json`, `src/index.ts`, `app/main.ts`, `app/excluded/extra.ts`
- Modify: `.gitignore`, `package.json` (root)

**Interfaces:**
- Consumes: nothing.
- Produces: `loadTypeScript(from: string): { ts, version: string, source: 'project' | 'bundled' }` and `expandGlob(pattern: string, root: string): string[]` (sorted absolute paths; `node_modules` is never entered). The fixture project under `test/library-root-fixture` is reused by Task 5.

- [ ] **Step 1: Create the package manifest**

Create `tools/codemod/package.json`:

```json
{
  "name": "di-bag-codemod",
  "version": "0.1.0",
  "private": true,
  "description": "Type-aware codemod that migrates DI Bag 0.4 call sites to 0.5: it rewrites only what the TypeScript checker resolves to a di-bag declaration.",
  "keywords": ["di-bag", "codemod", "migration", "typescript", "dependency-injection", "agents", "coding-agents"],
  "license": "MIT",
  "repository": { "type": "git", "url": "git+https://github.com/dany-fedorov/di-bag.git", "directory": "tools/codemod" },
  "homepage": "https://github.com/dany-fedorov/di-bag/tree/main/tools/codemod#readme",
  "bugs": { "url": "https://github.com/dany-fedorov/di-bag/issues" },
  "type": "module",
  "bin": { "di-bag-codemod": "cli.mjs" },
  "exports": { ".": "./lib/codemod.mjs", "./package.json": "./package.json" },
  "files": ["cli.mjs", "lib", "rename-map.json", "rename-map.schema.json"],
  "engines": { "node": ">=22" },
  "publishConfig": { "access": "public" },
  "scripts": { "test": "node --test test/*.test.mjs" },
  "dependencies": { "typescript": "^6.0.3" }
}
```

- [ ] **Step 2: Copy the licence, ignore the tool's dependencies, install them**

```bash
cp tools/graph/LICENSE tools/codemod/LICENSE
```

In `.gitignore`, directly under the line `/tools/graph/node_modules/`, add:

```
/tools/codemod/node_modules/
```

Then:

```bash
npm install --prefix tools/codemod --no-audit --no-fund
node -e "console.log(require('./tools/codemod/node_modules/typescript').version)"
```

Expected: `added 1 package`, a new `tools/codemod/package-lock.json`, and a version `6.0.3` or later in the 6 line.

- [ ] **Step 3: Add the root script**

In the root `package.json`, directly under the `"graph:check"` line, add:

```json
    "codemod:check": "node --test tools/codemod/test/*.test.mjs",
```

- [ ] **Step 4: Create the library-root fixture project**

It stands in for a library that is checked out next to its callers, as `src/` is in this repository. Task 5 uses it for `--library-root` and `--extra-files`; this task uses it for the glob tests.

`tools/codemod/test/library-root-fixture/package.json`:

```json
{
  "name": "di-bag-codemod-library-root-fixture",
  "private": true,
  "type": "module"
}
```

`tools/codemod/test/library-root-fixture/tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "skipLibCheck": true,
    "lib": ["ES2023", "DOM"],
    "types": []
  },
  "include": ["src", "app"],
  "exclude": ["app/excluded"]
}
```

`tools/codemod/test/library-root-fixture/src/index.ts`:

```ts
// A stand-in for a library checked out next to its callers: the declarations live under src/, not in node_modules.
export interface StartupOptions { readonly signal?: AbortSignal; readonly timeoutMs?: number }
export interface CloseOptions { readonly signal?: AbortSignal; readonly timeoutMs?: number }

export class Bag {
  async close(options?: CloseOptions): Promise<void> { void options; }
}

export class Builder {
  build(): Bag { return new Bag(); }
  async buildAndStart(keys: readonly string[], options?: StartupOptions): Promise<Bag> { void keys; void options; return this.build(); }
}

// The library's own calls are never rewritten; its authors change them by hand.
export const started = new Builder().buildAndStart(['inside']);
```

`tools/codemod/test/library-root-fixture/app/main.ts`:

```ts
import { Builder } from '../src/index.js';

export async function main(signal: AbortSignal) {
  const bag = await new Builder().buildAndStart(['db'], { signal, timeoutMs: 5 });
  await bag.close({ timeoutMs: 10 });
}
```

`tools/codemod/test/library-root-fixture/app/excluded/extra.ts`:

```ts
import { Builder } from '../../src/index.js';

export const extra = new Builder().buildAndStart(['db']);
```

- [ ] **Step 5: Write the failing test**

Create `tools/codemod/test/glob.test.mjs`:

```js
// tools/codemod/test/glob.test.mjs
import assert from 'node:assert/strict';
import { relative, resolve } from 'node:path';
import { test } from 'node:test';
import { expandGlob } from '../lib/glob.mjs';

const root = resolve(import.meta.dirname, 'library-root-fixture');
const names = pattern => expandGlob(pattern, root).map(file => relative(root, file).replaceAll('\\', '/'));

test('a star stays inside one directory and two stars cross directories', () => {
  assert.deepEqual(names('app/*.ts'), ['app/main.ts']);
  assert.deepEqual(names('app/**/*.ts'), ['app/excluded/extra.ts', 'app/main.ts']);
  assert.deepEqual(names('**/extra.ts'), ['app/excluded/extra.ts']);
});

test('a plain path names one file, and a missing one names none', () => {
  assert.deepEqual(names('app/main.ts'), ['app/main.ts']);
  assert.deepEqual(names('app/absent.ts'), []);
  assert.deepEqual(names('absent/*.ts'), []);
});
```

- [ ] **Step 6: Run it to make sure it fails**

Run: `node --test tools/codemod/test/glob.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `lib/glob.mjs`.

- [ ] **Step 7: Implement glob expansion and the TypeScript loader**

Create `tools/codemod/lib/glob.mjs`:

```js
// tools/codemod/lib/glob.mjs
import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const WILDCARD = /[*?]/;

function toRegExp(pattern) {
  let source = '';
  for (let index = 0; index < pattern.length; index++) {
    const character = pattern[index];
    if (character === '*' && pattern[index + 1] === '*') {
      // `**/` matches any number of directories, including none.
      if (pattern[index + 2] === '/') { source += '(?:.*/)?'; index += 2; } else { source += '.*'; index += 1; }
    } else if (character === '*') source += '[^/]*';
    else if (character === '?') source += '[^/]';
    else source += character.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`);
}

/**
 * Expand one glob (`*`, `**`, `?`) relative to `root` into sorted absolute file paths.
 * A pattern without wildcards names one file. `node_modules` directories are never entered.
 * @param {string} pattern
 * @param {string} root
 * @returns {string[]}
 */
export function expandGlob(pattern, root) {
  const normalized = pattern.replaceAll('\\', '/');
  if (!WILDCARD.test(normalized)) {
    const file = resolve(root, normalized);
    return existsSync(file) && statSync(file).isFile() ? [file] : [];
  }
  const segments = normalized.split('/');
  const firstWild = segments.findIndex(segment => WILDCARD.test(segment));
  const base = resolve(root, segments.slice(0, firstWild).join('/') || '.');
  if (!existsSync(base)) return [];
  const matcher = toRegExp(segments.slice(firstWild).join('/'));
  const found = [];
  const walk = (directory, prefix) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(resolve(directory, entry.name), relative);
      else if (matcher.test(relative)) found.push(resolve(directory, entry.name));
    }
  };
  walk(base, '');
  return found.sort();
}
```

Create `tools/codemod/lib/load-typescript.mjs`. It is the loader of `tools/graph/lib/extract.mjs`, copied because the two packages are published separately:

```js
// tools/codemod/lib/load-typescript.mjs
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

function atLeast(version, minimum) {
  const parts = String(version).split(/[.-]/).map(Number);
  for (let index = 0; index < minimum.length; index++) {
    if ((parts[index] ?? 0) !== minimum[index]) return (parts[index] ?? 0) > minimum[index];
  }
  return true;
}

/**
 * The project's `typescript` when it exposes the compiler API at 6.0.3 or later, else the bundled copy.
 * TypeScript 7 ships no compatible JavaScript API, so a project on 7 is analyzed with the bundled 6.
 * @param {string} from - A directory inside the project.
 * @returns {{ ts: typeof import('typescript'), version: string, source: 'project' | 'bundled' }}
 */
export function loadTypeScript(from) {
  const bundledPath = createRequire(import.meta.url).resolve('typescript');
  try {
    const require = createRequire(resolve(from, 'package.json'));
    const path = require.resolve('typescript');
    const candidate = require(path);
    if (path !== bundledPath && typeof candidate.createProgram === 'function' && atLeast(candidate.version, [6, 0, 3])) {
      return { ts: candidate, version: candidate.version, source: 'project' };
    }
  } catch {
    // No resolvable typescript in the project.
  }
  const bundled = createRequire(import.meta.url)(bundledPath);
  return { ts: bundled, version: bundled.version, source: 'bundled' };
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `node --test tools/codemod/test/glob.test.mjs`
Expected: `pass 2`, `fail 0`.

- [ ] **Step 9: Commit**

```bash
git add .gitignore package.json tools/codemod
git commit -F - <<'MSG'
feat(codemod): package skeleton, TypeScript loader and glob expansion

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

Check that `git show --stat HEAD` lists no file under `tools/codemod/node_modules/`.

---

### Task 2: The rename map: schema, validation, index and the shipped data

**Files:**
- Create: `tools/codemod/rename-map.json`, `tools/codemod/rename-map.schema.json`
- Create: `tools/codemod/lib/rename-map.mjs`
- Test: `tools/codemod/test/rename-map.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces, from `lib/rename-map.mjs`:
  - `validateRenameMap(map, transformIds?: string[]): string[]`, every problem as a sentence, empty when valid.
  - `loadRenameMap(file, transformIds?): RenameMap`, throws one `Error` whose message starts with `invalid rename map <file>:` and lists every problem.
  - `indexRenameMap(map)` returning `{ methods, properties, options, argumentValues, propertyValues, codes, types, imports, callNames, methodNames, memberNames, propertyNames, valuePropertyNames, propertyValueTexts, methodFor(owner, name, count), optionsFor(owner, method, argument, path), valuesFor(owner, method, argument, path), hasArgumentEntries(owner, method), hasEntriesBelow(owner, method, argument, path), describeArgumentEntries(owner, method, argument), nameOf(owner, oldName) }`. Task 3's engine uses exactly these names.
- The shipped map names the transform id `build-and-start`, which Task 4 creates.

- [ ] **Step 1: Write the failing test**

Create `tools/codemod/test/rename-map.test.mjs`:

```js
// tools/codemod/test/rename-map.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { indexRenameMap, loadRenameMap, validateRenameMap } from '../lib/rename-map.mjs';

const packageRoot = resolve(import.meta.dirname, '..');
const shipped = JSON.parse(readFileSync(join(packageRoot, 'rename-map.json'), 'utf8'));

test('the shipped map is valid', () => {
  assert.deepEqual(validateRenameMap(shipped, ['build-and-start']), []);
  assert.equal(loadRenameMap(join(packageRoot, 'rename-map.json'), ['build-and-start']).version, 1);
});

test('loading a broken map throws one error that lists every problem', () => {
  assert.throws(() => loadRenameMap(join(packageRoot, 'package.json'), []), /invalid rename map .*package\.json:\nversion must be 1\nunknown section name/);
});

test('the schema file lists the same sections the validator accepts', () => {
  const schema = JSON.parse(readFileSync(join(packageRoot, 'rename-map.schema.json'), 'utf8'));
  assert.deepEqual(Object.keys(schema.properties).sort(), ['$schema', 'codes', 'imports', 'methods', 'options', 'properties', 'types', 'values', 'version']);
});

test('validation names every problem', () => {
  const problems = validateRenameMap({
    version: 2,
    surprises: [],
    methods: [{ owner: 'Builder', from: 'alias' }, { owner: 'Builder', from: 'x', to: 'y', transform: 'missing' }, { owner: 'Builder', from: 'a', to: 'b', arguments: { kind: 'tuple' } }],
    properties: [{ owner: 'Token', from: 'key', to: 'symbol', manual: 'both' }],
    codes: [{ from: 'NOT_A_CODE', to: 'DI_BAG_X' }],
    imports: [{ from: 'a' }],
    values: [{ owner: 'X', from: 'a', to: 'b' }],
  }, []);
  assert.deepEqual(problems, [
    'version must be 1',
    'unknown section surprises',
    'methods[0]: owner, from and to are required strings',
    'methods[1]: unknown transform missing',
    'methods[2]: arguments.kind must be bag or array',
    'values[0]: owner, from, to and either method with argument or property are required',
    'properties[0]: owner, from and exactly one of to or manual are required',
    'codes[0]: from must be a DI_BAG_ code with exactly one of to or manual',
    'imports[0]: use either from with to, or fromSuffix with toSuffix',
  ]);
});

test('nameOf answers from the map and falls back to the old name', () => {
  const index = indexRenameMap({ version: 1, methods: [{ owner: 'Builder', from: 'build', to: 'buildContainer' }], properties: [{ owner: 'Token', from: 'key', to: 'symbol' }] });
  assert.equal(index.nameOf('Builder', 'build'), 'buildContainer');
  assert.equal(index.nameOf('Token', 'key'), 'symbol');
  assert.equal(index.nameOf('Builder', 'register'), 'register');
});

test('an entry with arity applies only to calls with that many arguments', () => {
  const index = indexRenameMap({ version: 1, methods: [
    { owner: 'Builder', from: 'register', to: 'withServices', arity: [1] },
    { owner: 'Builder', from: 'register', to: 'withTokenService', arity: [2] },
  ] });
  assert.equal(index.methodFor('Builder', 'register', 1).to, 'withServices');
  assert.equal(index.methodFor('Builder', 'register', 2).to, 'withTokenService');
  assert.equal(index.methodFor('Builder', 'register', 3), undefined);
});

test("a code whose target is the word manual is reported, never rewritten", () => {
  const index = indexRenameMap({ version: 1, codes: [{ from: 'DI_BAG_INVALID_SCOPE', to: 'manual' }, { from: 'DI_BAG_CYCLE', to: 'DI_BAG_DEPENDENCY_CYCLE' }] });
  assert.equal(index.codes.get('DI_BAG_INVALID_SCOPE').to, undefined);
  assert.match(index.codes.get('DI_BAG_INVALID_SCOPE').manual, /split/);
  assert.equal(index.codes.get('DI_BAG_CYCLE').to, 'DI_BAG_DEPENDENCY_CYCLE');
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test tools/codemod/test/rename-map.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `lib/rename-map.mjs`.

- [ ] **Step 3: Write the shipped map**

Create `tools/codemod/rename-map.json`. These are the phase 3 renames that the spec fixes: `buildAndStart`, the `close` options, the startup options, the service readiness errors with their fields and codes, and the pending-work fields. `DI_BAG_INVALID_STARTUP` is absent on purpose: phase 3 keeps that code and phase 11 splits it. Phase 3's plan is authoritative for phase 3; where its map tasks differ from this data, its executor edits this file.

```json
{
  "$schema": "./rename-map.schema.json",
  "version": 1,
  "methods": [
    { "owner": "Builder", "from": "buildAndStart", "to": "ensureServicesReady", "transform": "build-and-start" }
  ],
  "options": [
    { "owner": "Bag", "method": "close", "argument": 0, "from": "signal", "to": "abortSignal" },
    { "owner": "Bag", "method": "close", "argument": 0, "from": "timeoutMs", "to": "waitTimeoutMs" }
  ],
  "properties": [
    { "owner": "CloseOptions", "from": "signal", "to": "abortSignal" },
    { "owner": "CloseOptions", "from": "timeoutMs", "to": "waitTimeoutMs" },
    { "owner": "StartupOptions", "from": "signal", "to": "abortSignal" },
    { "owner": "StartupOptions", "from": "timeoutMs", "to": "totalTimeoutMs" },
    { "owner": "StartupOptions", "from": "startupOrder", "manual": "startupOrder is gone; use maxConcurrentServiceKeys: omit it for 'parallel', 1 for 'sequential', or the number" },
    { "owner": "DiBagStartupError", "from": "cleanupFailures", "to": "disposalFailures" },
    { "owner": "DiBagStartupError", "from": "cleanupError", "to": "disposalError" },
    { "owner": "DiBagStartupCancelledError", "from": "cleanupPromise", "to": "disposalPromise" },
    { "owner": "DiBagCloseCancelledError", "from": "timeoutMs", "to": "waitTimeoutMs" },
    { "owner": "CloseProgress", "from": "pending", "to": "disposersStillRunning" },
    { "owner": "CloseProgress", "from": "acquiring", "to": "acquisitionsStillPending" }
  ],
  "types": [
    { "from": "StartupOptions", "to": "EnsureServicesReadyOptions" },
    { "from": "DiBagStartupError", "to": "DiBagServiceReadinessError" },
    { "from": "DiBagStartupCancelledError", "to": "DiBagServiceReadinessCancelledError" }
  ],
  "codes": [
    { "from": "DI_BAG_STARTUP_FAILED", "to": "DI_BAG_SERVICE_READINESS_FAILED" },
    { "from": "DI_BAG_STARTUP_CANCELLED", "to": "DI_BAG_SERVICE_READINESS_CANCELLED" },
    { "from": "DI_BAG_STARTUP_TIMEOUT", "to": "DI_BAG_SERVICE_READINESS_TIMEOUT" }
  ]
}
```

- [ ] **Step 4: Write the JSON Schema**

Create `tools/codemod/rename-map.schema.json`. Editors validate `rename-map.json` against it through the `$schema` key; the runtime validation is `validateRenameMap`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "di-bag-codemod rename map",
  "description": "The distance from di-bag 0.4.0 to the current API. Owners are library declaration names: a class, interface or type alias is `Name`, a function is `name()`, a method's inline types are `Owner.method()`.",
  "type": "object",
  "additionalProperties": false,
  "required": ["version"],
  "properties": {
    "$schema": { "type": "string" },
    "version": { "const": 1 },
    "methods": {
      "description": "A renamed or reshaped method. Several entries may share owner and from when `arity` tells them apart; the first match wins.",
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["owner", "from", "to"],
        "properties": {
          "owner": { "type": "string" },
          "from": { "type": "string" },
          "to": { "type": "string", "description": "The 0.5 name. Equal to `from` when only the arguments change." },
          "arity": { "type": "array", "items": { "type": "integer", "minimum": 0 }, "description": "Argument counts this entry applies to. Omit for any." },
          "arguments": {
            "oneOf": [
              {
                "type": "object",
                "additionalProperties": false,
                "required": ["kind", "names"],
                "properties": {
                  "kind": { "const": "bag" },
                  "names": { "type": "array", "items": { "type": "string" }, "minItems": 1, "description": "Bag property for each positional argument, in order." },
                  "trailing": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["mode"],
                    "properties": {
                      "mode": { "enum": ["merge", "keep", "drop"], "description": "What happens to one extra argument after `names`: merge its properties into the bag, keep it as a second argument, or drop it." },
                      "keys": { "type": "object", "additionalProperties": { "type": "string" }, "description": "Key renames applied while merging." }
                    }
                  }
                }
              },
              {
                "type": "object",
                "additionalProperties": false,
                "required": ["kind"],
                "properties": { "kind": { "const": "array", "description": "Wrap the single argument in an array." } }
              }
            ]
          },
          "transform": { "type": "string", "description": "Id of a custom transform in lib/transforms/index.mjs. Excludes `arguments`." }
        }
      }
    },
    "options": {
      "description": "A renamed key of an object-literal argument, found by position. Works even when the call does not type-check.",
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["owner", "method", "argument", "from", "to"],
        "properties": {
          "owner": { "type": "string" },
          "method": { "type": "string", "description": "The 0.4.0 method name." },
          "argument": { "type": "integer", "minimum": 0 },
          "path": { "type": "array", "items": { "type": "string" }, "description": "Keys leading to a nested object literal. Omit for the argument itself." },
          "from": { "type": "string" },
          "to": { "type": "string" }
        }
      }
    },
    "values": {
      "description": "A renamed string value: either at an argument path of a call, or wherever a library property is compared with or assigned that string.",
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "additionalProperties": false,
            "required": ["owner", "method", "argument", "from", "to"],
            "properties": {
              "owner": { "type": "string" },
              "method": { "type": "string" },
              "argument": { "type": "integer", "minimum": 0 },
              "path": { "type": "array", "items": { "type": "string" }, "description": "Keys leading to the string inside an object-literal argument. Omit when the argument is the string." },
              "from": { "type": "string" },
              "to": { "type": "string" }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": ["owner", "property", "from", "to"],
            "properties": {
              "owner": { "type": "string" },
              "property": { "type": "string" },
              "from": { "type": "string" },
              "to": { "type": "string" }
            }
          }
        ]
      }
    },
    "properties": {
      "description": "A renamed property of a library type: property access, destructuring, and keys of object literals typed by it. `manual` reports every use instead.",
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["owner", "from"],
        "oneOf": [{ "required": ["to"] }, { "required": ["manual"] }],
        "properties": {
          "owner": { "type": "string" },
          "from": { "type": "string" },
          "to": { "type": "string" },
          "manual": { "type": "string", "description": "The sentence shown to the person who has to decide." }
        }
      }
    },
    "types": {
      "description": "A renamed export: classes, interfaces, type aliases and error classes, in imports and wherever they are referenced.",
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["from", "to"],
        "properties": { "from": { "type": "string" }, "to": { "type": "string" } }
      }
    },
    "codes": {
      "description": "A renamed runtime code. A code that was split has `manual` with the sentence that helps choose.",
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["from"],
        "oneOf": [{ "required": ["to"] }, { "required": ["manual"] }],
        "properties": {
          "from": { "type": "string", "pattern": "^DI_BAG_[A-Z_]+$" },
          "to": { "type": "string", "description": "The new code, or the word manual." },
          "manual": { "type": "string" }
        }
      }
    },
    "imports": {
      "description": "A rewritten module specifier: an exact match, or the end of a relative path.",
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "additionalProperties": false,
            "required": ["from", "to"],
            "properties": { "from": { "type": "string" }, "to": { "type": "string" } }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": ["fromSuffix", "toSuffix"],
            "properties": { "fromSuffix": { "type": "string" }, "toSuffix": { "type": "string" } }
          }
        ]
      }
    }
  }
}
```

- [ ] **Step 5: Implement loading, validation and the index**

Create `tools/codemod/lib/rename-map.mjs`:

```js
// tools/codemod/lib/rename-map.mjs
import { readFileSync } from 'node:fs';

/**
 * @typedef {{ kind: 'bag', names: string[], trailing?: { mode: 'merge' | 'keep' | 'drop', keys?: Record<string, string> } } | { kind: 'array' }} ArgumentShape
 * @typedef {{ owner: string, from: string, to: string, arity?: number[], arguments?: ArgumentShape, transform?: string }} MethodEntry
 * @typedef {{ owner: string, method: string, argument: number, path?: string[], from: string, to: string }} OptionEntry
 * @typedef {{ owner: string, method: string, argument: number, path?: string[], from: string, to: string } | { owner: string, property: string, from: string, to: string }} ValueEntry
 * @typedef {{ owner: string, from: string, to: string } | { owner: string, from: string, manual: string }} PropertyEntry
 * @typedef {{ from: string, to: string }} TypeEntry
 * @typedef {{ from: string, to: string } | { from: string, manual: string }} CodeEntry
 * @typedef {{ from: string, to: string } | { fromSuffix: string, toSuffix: string }} ImportEntry
 * @typedef {{ version: 1, methods?: MethodEntry[], options?: OptionEntry[], values?: ValueEntry[], properties?: PropertyEntry[], types?: TypeEntry[], codes?: CodeEntry[], imports?: ImportEntry[] }} RenameMap
 */

const SECTIONS = ['methods', 'options', 'values', 'properties', 'types', 'codes', 'imports'];
const isString = value => typeof value === 'string' && value.length > 0;
const isStrings = value => Array.isArray(value) && value.every(isString);

/** Every problem in a map, as readable sentences. An empty array means the map is valid. */
export function validateRenameMap(map, transformIds = []) {
  const problems = [];
  const bad = (section, index, message) => problems.push(`${section}[${index}]: ${message}`);
  if (typeof map !== 'object' || map === null || Array.isArray(map)) return ['the rename map must be an object'];
  if (map.version !== 1) problems.push('version must be 1');
  for (const key of Object.keys(map)) if (key !== 'version' && key !== '$schema' && !SECTIONS.includes(key)) problems.push(`unknown section ${key}`);
  for (const section of SECTIONS) if (map[section] !== undefined && !Array.isArray(map[section])) problems.push(`${section} must be an array`);
  (map.methods ?? []).forEach((entry, index) => {
    if (!isString(entry.owner) || !isString(entry.from) || !isString(entry.to)) bad('methods', index, 'owner, from and to are required strings');
    if (entry.arity !== undefined && !(Array.isArray(entry.arity) && entry.arity.every(Number.isInteger))) bad('methods', index, 'arity must be an array of integers');
    if (entry.transform !== undefined && !transformIds.includes(entry.transform)) bad('methods', index, `unknown transform ${entry.transform}`);
    if (entry.transform !== undefined && entry.arguments !== undefined) bad('methods', index, 'use either transform or arguments');
    const shape = entry.arguments;
    if (shape !== undefined) {
      if (shape.kind === 'bag') {
        if (!isStrings(shape.names) || shape.names.length === 0) bad('methods', index, 'arguments.names must list at least one property name');
        if (shape.trailing !== undefined && !['merge', 'keep', 'drop'].includes(shape.trailing.mode)) bad('methods', index, 'arguments.trailing.mode must be merge, keep or drop');
      } else if (shape.kind !== 'array') bad('methods', index, 'arguments.kind must be bag or array');
    }
  });
  (map.options ?? []).forEach((entry, index) => {
    if (!isString(entry.owner) || !isString(entry.method) || !Number.isInteger(entry.argument) || !isString(entry.from) || !isString(entry.to)) bad('options', index, 'owner, method, argument, from and to are required');
    if (entry.path !== undefined && !isStrings(entry.path) && entry.path.length !== 0) bad('options', index, 'path must be an array of property names');
  });
  (map.values ?? []).forEach((entry, index) => {
    const byArgument = isString(entry.method) && Number.isInteger(entry.argument);
    const byProperty = isString(entry.property);
    if (!isString(entry.owner) || byArgument === byProperty || !isString(entry.from) || !isString(entry.to)) bad('values', index, 'owner, from, to and either method with argument or property are required');
  });
  (map.properties ?? []).forEach((entry, index) => {
    if (!isString(entry.owner) || !isString(entry.from) || isString(entry.to) === isString(entry.manual)) bad('properties', index, 'owner, from and exactly one of to or manual are required');
  });
  (map.types ?? []).forEach((entry, index) => { if (!isString(entry.from) || !isString(entry.to)) bad('types', index, 'from and to are required'); });
  (map.codes ?? []).forEach((entry, index) => {
    if (!isString(entry.from) || !/^DI_BAG_[A-Z_]+$/.test(entry.from) || isString(entry.to) === isString(entry.manual)) bad('codes', index, 'from must be a DI_BAG_ code with exactly one of to or manual');
  });
  (map.imports ?? []).forEach((entry, index) => {
    const exact = isString(entry.from) && isString(entry.to);
    const suffix = isString(entry.fromSuffix) && isString(entry.toSuffix);
    if (exact === suffix) bad('imports', index, 'use either from with to, or fromSuffix with toSuffix');
  });
  return problems;
}

/** Read and validate a map file. Throws one error that lists every problem. */
export function loadRenameMap(file, transformIds = []) {
  const map = JSON.parse(readFileSync(file, 'utf8'));
  const problems = validateRenameMap(map, transformIds);
  if (problems.length) throw new Error(`invalid rename map ${file}:\n${problems.join('\n')}`);
  return map;
}

const pathKey = path => (path ?? []).join('.');

/** Lookup tables over a valid map. Every lookup answers from the map alone; nothing is hardcoded. */
export function indexRenameMap(map) {
  const methods = new Map();
  for (const entry of map.methods ?? []) {
    const key = `${entry.owner}.${entry.from}`;
    methods.set(key, [...(methods.get(key) ?? []), entry]);
  }
  const properties = new Map((map.properties ?? []).map(entry => [`${entry.owner}.${entry.from}`, entry]));
  const options = new Map();
  for (const entry of map.options ?? []) {
    const key = `${entry.owner}.${entry.method}`;
    options.set(key, [...(options.get(key) ?? []), entry]);
  }
  const argumentValues = new Map();
  const propertyValues = new Map();
  for (const entry of map.values ?? []) {
    if (entry.property !== undefined) propertyValues.set(`${entry.owner}.${entry.property}=${entry.from}`, entry.to);
    else {
      const key = `${entry.owner}.${entry.method}`;
      argumentValues.set(key, [...(argumentValues.get(key) ?? []), entry]);
    }
  }
  const codes = new Map((map.codes ?? []).map(entry => [entry.from, entry.to === 'manual' ? { from: entry.from, manual: 'this code was split; pick the new code by reading the errors page' } : entry]));
  return {
    methods, properties, options, argumentValues, propertyValues, codes,
    types: new Map((map.types ?? []).map(entry => [entry.from, entry.to])),
    imports: map.imports ?? [],
    /** Names worth asking the checker about; everything else is skipped without a type query. */
    callNames: new Set([...(map.methods ?? []).map(entry => entry.from), ...(map.options ?? []).map(entry => entry.method), ...(map.values ?? []).filter(entry => entry.method !== undefined).map(entry => entry.method)]),
    methodNames: new Set((map.methods ?? []).map(entry => entry.from)),
    memberNames: new Set([...(map.methods ?? []).map(entry => entry.from), ...(map.properties ?? []).map(entry => entry.from)]),
    propertyNames: new Set([...(map.properties ?? []).map(entry => entry.from), ...(map.values ?? []).filter(entry => entry.property !== undefined).map(entry => entry.property)]),
    valuePropertyNames: new Set((map.values ?? []).filter(entry => entry.property !== undefined).map(entry => entry.property)),
    propertyValueTexts: new Set((map.values ?? []).filter(entry => entry.property !== undefined).map(entry => entry.from)),
    /** The method entry for a call with `count` arguments, or undefined. */
    methodFor(owner, name, count) {
      return (methods.get(`${owner}.${name}`) ?? []).find(entry => entry.arity === undefined || count === undefined || entry.arity.includes(count));
    },
    optionsFor(owner, method, argument, path) {
      return (options.get(`${owner}.${method}`) ?? []).filter(entry => entry.argument === argument && pathKey(entry.path) === pathKey(path));
    },
    valuesFor(owner, method, argument, path) {
      return (argumentValues.get(`${owner}.${method}`) ?? []).filter(entry => entry.argument === argument && pathKey(entry.path) === pathKey(path));
    },
    /** The renames that apply to one argument, as a sentence for a manual item. */
    describeArgumentEntries(owner, method, argument) {
      const label = entry => `${[...(entry.path ?? []), ''].join('.')}`;
      return [
        ...(options.get(`${owner}.${method}`) ?? []).filter(entry => entry.argument === argument).map(entry => `key ${label(entry)}${entry.from} to ${entry.to}`),
        ...(argumentValues.get(`${owner}.${method}`) ?? []).filter(entry => entry.argument === argument).map(entry => `value '${entry.from}' to '${entry.to}'${entry.path?.length ? ` at ${entry.path.join('.')}` : ''}`),
      ].join('; ');
    },
    /** True when some option or value entry rewrites an argument of this method. */
    hasArgumentEntries(owner, method) {
      return options.has(`${owner}.${method}`) || argumentValues.has(`${owner}.${method}`);
    },
    /** True when some option or value entry sits below `path` of this argument. */
    hasEntriesBelow(owner, method, argument, path) {
      const prefix = pathKey(path);
      const below = entry => entry.argument === argument && (prefix === '' ? true : pathKey(entry.path) === prefix || pathKey(entry.path).startsWith(`${prefix}.`));
      return (options.get(`${owner}.${method}`) ?? []).some(below) || (argumentValues.get(`${owner}.${method}`) ?? []).some(below);
    },
    /** The current name of a library member: the map's target, or the old name when the map does not rename it. */
    nameOf(owner, oldName) {
      const method = (methods.get(`${owner}.${oldName}`) ?? [])[0];
      if (method) return method.to;
      const property = properties.get(`${owner}.${oldName}`);
      return property?.to ?? oldName;
    },
  };
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `node --test tools/codemod/test/rename-map.test.mjs`
Expected: `pass 7`, `fail 0`.

- [ ] **Step 7: Commit**

```bash
git add tools/codemod
git commit -F - <<'MSG'
feat(codemod): rename map format, validation, index and the phase 3 data

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

---

### Task 3: Vendored 0.4.0 declarations, the engine and the generic transforms

**Files:**
- Create: `tools/codemod/test/fixtures/node_modules/di-bag/` (vendored: `package.json`, `LICENSE`, 36 files `dist/*.d.ts`)
- Create: `tools/codemod/test/fixtures/package.json`, `tools/codemod/test/fixtures/tsconfig.json`
- Create: eight fixture directories under `tools/codemod/test/fixtures/`: `method-rename`, `arguments-to-bag`, `array-argument`, `options-and-values`, `properties`, `types-and-imports`, `codes`, `untouched`; each with `map.json`, `input.ts`, `expected.ts`, `expected-manual.json`
- Create: `tools/codemod/test/helpers.mjs`, `tools/codemod/test/fixtures.test.mjs`
- Create: `tools/codemod/lib/library.mjs`, `tools/codemod/lib/rewrite.mjs`, `tools/codemod/lib/codemod.mjs`, `tools/codemod/lib/transforms/index.mjs`

**Interfaces:**
- Consumes: `loadTypeScript`, `expandGlob` (Task 1); `loadRenameMap`, `validateRenameMap`, `indexRenameMap` and every index member listed in Task 2.
- Produces:
  - `createLibrary({ ts, checker, root, libraryRoots?: string[] })` returning `{ isLibraryFile(fileName), symbolAt(node), membersOf(symbol): { owner, name }[], exportNameOf(symbol): string | undefined }`.
  - `rewriteSourceFile({ ts, checker, sourceFile, library, index, transforms, manualItems, fileLabel }): { text: string, rewrites: number }`.
  - `runCodemod({ typescript, root, project?, files?, extraFiles?, libraryRoots?, map?, mapFile?, write?, only?, program? }): { files: { file, rewrites, text }[], manual: { file, line, column, reason, text }[], rewrites: number }`, plus the exports `defaultMapFile`, `transforms`, `validateRenameMap`, `loadTypeScript` from `lib/codemod.mjs`. `only` restricts the run to the listed files; `program` lets tests share one program.
  - The transform API that Task 4 and later phases use, built by `transformApi(member)` in `lib/rewrite.mjs`: `{ ts, checker, sourceFile, member, text(node), slice(start, end), start(node), assemble(node, replacements), objectLiteral(literal, spec), quote(literal, value), manual(node, reason), nameOf(owner, oldName) }`. `objectLiteral` returns `{ text, changed, remaining }`, or `undefined` when a `replace` callback gave up.
  - `test/helpers.mjs`: `packageRoot`, `fixturesRoot`, `compiler`, `fixtureNames`, `fixturesProgram()`, `runFixture(name): { text, manual: { line, reason }[] }`, `readFixture(name, file)`.

- [ ] **Step 1: Vendor the published 0.4.0 declarations**

One time, with network access. The fixtures must type-check against what users have installed, not against this repository's `src`.

```bash
work="$(mktemp -d)"
( cd "$work" && npm pack di-bag@0.4.0 --silent && sha1sum di-bag-0.4.0.tgz && tar -xzf di-bag-0.4.0.tgz )
mkdir -p tools/codemod/test/fixtures/node_modules/di-bag/dist
cp "$work/package/package.json" "$work/package/LICENSE" tools/codemod/test/fixtures/node_modules/di-bag/
cp "$work"/package/dist/*.d.ts tools/codemod/test/fixtures/node_modules/di-bag/dist/
rm -rf "$work"
ls tools/codemod/test/fixtures/node_modules/di-bag/dist | wc -l
```

Expected: the checksum `56ac7ce26a5114addad33e3da9c73872c8cab3a9` and the count `36`. Only declarations are vendored; no `.js` file is copied, because nothing runs the fixtures. Never edit these files.

- [ ] **Step 2: Create the fixture project**

`tools/codemod/test/fixtures/package.json`:

```json
{
  "name": "di-bag-codemod-fixtures",
  "private": true,
  "type": "module"
}
```

`tools/codemod/test/fixtures/tsconfig.json`. Only `input.ts` files belong to the program: the `expected.ts` files use 0.5 names that 0.4.0 does not declare.

```json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "skipLibCheck": true,
    "lib": ["ES2023", "DOM"],
    "types": []
  },
  "include": ["*/input.ts"]
}
```

- [ ] **Step 3: Fixture `method-rename`**

Proves: a plain rename; `arity` telling overloads apart; a facade alias (`DiBag as DI`) and a facade derived with `withConfiguration`; `contribute`, which is a property holding a callable; the `this`-typed `build` and `fork`; an optional chain; a comment inside a chain; a method referenced without a call; destructuring with and without a local name.

`tools/codemod/test/fixtures/method-rename/map.json`:

```json
{
  "version": 1,
  "methods": [
    { "owner": "Builder", "from": "register", "to": "withServices", "arity": [1] },
    { "owner": "Builder", "from": "contribute", "to": "withCollectionContribution" },
    { "owner": "Builder", "from": "verifyGraph", "to": "verifyGraphAtCompileTime" },
    { "owner": "Builder", "from": "build", "to": "buildContainer" },
    { "owner": "Bag", "from": "inspectGraph", "to": "graphSnapshot" },
    { "owner": "Bag", "from": "fork", "to": "createIndependentContainer", "arity": [0] },
    { "owner": "DiBagApi", "from": "fromFactory", "to": "createProvider" }
  ]
}
```

`tools/codemod/test/fixtures/method-rename/input.ts`:

```ts
import { DiBag as DI } from 'di-bag';

const toolsKey = Symbol('tools');
const tools = DI.token(toolsKey).of<string>();

const Observed = DI.withConfiguration({ observers: [] });

const builder = Observed.createBuilder()
  .register({ greeting: DI.fromFactory(() => 'hello', { acquisitionMode: 'raw' }) })
  // A comment inside the chain survives.
  .contribute(tools, () => 'search');

builder.verifyGraph() satisfies void;

export const bag = builder.build();
export const copy = bag.fork();
export const labels = bag?.inspectGraph().bindings.map(binding => binding.label);

// A reference that is not a call is renamed when the map only renames.
export const buildLater = builder.build;
export const { inspectGraph } = bag;
export const { inspectGraph: snapshotGraph } = bag;
```

`tools/codemod/test/fixtures/method-rename/expected.ts`:

```ts
import { DiBag as DI } from 'di-bag';

const toolsKey = Symbol('tools');
const tools = DI.token(toolsKey).of<string>();

const Observed = DI.withConfiguration({ observers: [] });

const builder = Observed.createBuilder()
  .withServices({ greeting: DI.createProvider(() => 'hello', { acquisitionMode: 'raw' }) })
  // A comment inside the chain survives.
  .withCollectionContribution(tools, () => 'search');

builder.verifyGraphAtCompileTime() satisfies void;

export const bag = builder.buildContainer();
export const copy = bag.createIndependentContainer();
export const labels = bag?.graphSnapshot().bindings.map(binding => binding.label);

// A reference that is not a call is renamed when the map only renames.
export const buildLater = builder.buildContainer;
export const { graphSnapshot: inspectGraph } = bag;
export const { graphSnapshot: snapshotGraph } = bag;
```

`tools/codemod/test/fixtures/method-rename/expected-manual.json`:

```json
[]
```

- [ ] **Step 4: Fixture `arguments-to-bag`**

Proves: positional arguments into one bag; the shorthand `{ token }` when the argument is an identifier with the property's name; a trailing options argument merged with renamed keys (`buildModule`, `createScope`), kept (`withLifetime`), and dropped (`fromFunction`); a value rename applied while the argument moves into the bag; one entry per arity for `createScope`; a call written over several lines; a spread argument and a non-literal trailing argument, both left untouched and reported.

`tools/codemod/test/fixtures/arguments-to-bag/map.json`:

```json
{
  "version": 1,
  "methods": [
    { "owner": "Builder", "from": "register", "to": "withServices", "arity": [1] },
    { "owner": "Builder", "from": "register", "to": "withTokenService", "arity": [2], "arguments": { "kind": "bag", "names": ["token", "provider"] } },
    { "owner": "Builder", "from": "alias", "to": "withServiceAlias", "arguments": { "kind": "bag", "names": ["aliasKey", "targetServiceKey"] } },
    { "owner": "Builder", "from": "buildModule", "to": "buildModule", "arguments": { "kind": "bag", "names": ["exportedServiceKeys"], "trailing": { "mode": "merge", "keys": { "label": "moduleLabel" } } } },
    { "owner": "Bag", "from": "fork", "to": "createIndependentContainer", "arguments": { "kind": "bag", "names": ["replacedServiceKeys", "replacementProviders"] } },
    { "owner": "Bag", "from": "createScope", "to": "createChildContainer", "arity": [0, 1] },
    { "owner": "Bag", "from": "createScope", "to": "createChildContainer", "arity": [2, 3], "arguments": { "kind": "bag", "names": ["replacedServiceKeys", "replacementProviders"], "trailing": { "mode": "merge", "keys": { "share": "sharedParentServiceKeys" } } } },
    { "owner": "DiBagApi", "from": "withLifetime", "to": "withLifetime", "arguments": { "kind": "bag", "names": ["provider", "lifetime"], "trailing": { "mode": "keep" } } },
    { "owner": "DiBagApi", "from": "fromFunction", "to": "createProviderFromFunction", "arguments": { "kind": "bag", "names": ["dependencies", "factoryFunction"], "trailing": { "mode": "drop" } } }
  ],
  "options": [
    { "owner": "Bag", "method": "createScope", "argument": 0, "from": "share", "to": "sharedParentServiceKeys" }
  ],
  "values": [
    { "owner": "DiBagApi", "method": "withLifetime", "argument": 1, "from": "root", "to": "singleton:one-per-container-tree" }
  ]
}
```

`tools/codemod/test/fixtures/arguments-to-bag/input.ts`:

```ts
import { DiBag } from 'di-bag';

const clockKey = Symbol('clock');
const clock = DiBag.token(clockKey).of<{ now(): number }>();
const token = clock;

const feature = DiBag.createBuilder()
  .register({ config: () => ({ region: 'eu' }) })
  .register(clock, () => ({ now: () => 42 }))
  .alias('now', clock)
  .buildModule(['now', 'config'], { label: 'feature' });

const provider = DiBag.withLifetime(() => ({ region: 'eu' }), 'root', { allowScopedDependencies: true });
const stamp = DiBag.fromFunction([clock], source => source.now(), { acquisitionMode: 'raw' });

const root = DiBag.createBuilder()
  .register(token, () => ({ now: () => 1 }))
  .register({
    config: provider,
    stamp,
    session: ({ config }: { config: { region: string } }) => ({ region: config.region }),
  })
  .build();

export const plainChild = root.createScope();
export const sharing = root.createScope({ share: ['session'] });
export const replacing = root.createScope(['config'], { config: () => ({ region: 'us' }) }, { share: ['session'] });
export const test = root.fork(
  ['config'],
  {
    config: () => ({ region: 'test' }),
  },
);
export const sealed = feature;

const overrides = [['config'], { config: () => ({ region: 'x' }) }] as const;
export const spread = root.fork(...overrides);
const shareOptions = { share: ['session'] } as const;
export const indirect = root.createScope(['config'], { config: () => ({ region: 'y' }) }, shareOptions);
```

`tools/codemod/test/fixtures/arguments-to-bag/expected.ts`:

```ts
import { DiBag } from 'di-bag';

const clockKey = Symbol('clock');
const clock = DiBag.token(clockKey).of<{ now(): number }>();
const token = clock;

const feature = DiBag.createBuilder()
  .withServices({ config: () => ({ region: 'eu' }) })
  .withTokenService({ token: clock, provider: () => ({ now: () => 42 }) })
  .withServiceAlias({ aliasKey: 'now', targetServiceKey: clock })
  .buildModule({ exportedServiceKeys: ['now', 'config'], moduleLabel: 'feature' });

const provider = DiBag.withLifetime({ provider: () => ({ region: 'eu' }), lifetime: 'singleton:one-per-container-tree' }, { allowScopedDependencies: true });
const stamp = DiBag.createProviderFromFunction({ dependencies: [clock], factoryFunction: source => source.now() });

const root = DiBag.createBuilder()
  .withTokenService({ token, provider: () => ({ now: () => 1 }) })
  .withServices({
    config: provider,
    stamp,
    session: ({ config }: { config: { region: string } }) => ({ region: config.region }),
  })
  .build();

export const plainChild = root.createChildContainer();
export const sharing = root.createChildContainer({ sharedParentServiceKeys: ['session'] });
export const replacing = root.createChildContainer({ replacedServiceKeys: ['config'], replacementProviders: { config: () => ({ region: 'us' }) }, sharedParentServiceKeys: ['session'] });
export const test = root.createIndependentContainer({
  replacedServiceKeys: ['config'],
  replacementProviders: {
    config: () => ({ region: 'test' }),
  },
});
export const sealed = feature;

const overrides = [['config'], { config: () => ({ region: 'x' }) }] as const;
export const spread = root.fork(...overrides);
const shareOptions = { share: ['session'] } as const;
export const indirect = root.createScope(['config'], { config: () => ({ region: 'y' }) }, shareOptions);
```

`tools/codemod/test/fixtures/arguments-to-bag/expected-manual.json`:

```json
[
  {
    "line": 37,
    "reason": "fork is called with a spread argument; rewrite it to createIndependentContainer by hand"
  },
  {
    "line": 39,
    "reason": "the last argument of createScope is not an object literal; merge it into the createChildContainer bag by hand"
  }
]
```

- [ ] **Step 5: Fixture `array-argument`**

Proves: the single argument wrapped in an array, and a rewritten call nested inside another rewritten call's argument.

`tools/codemod/test/fixtures/array-argument/map.json`:

```json
{
  "version": 1,
  "methods": [
    { "owner": "Builder", "from": "installModule", "to": "withInstalledModules", "arguments": { "kind": "array" } },
    { "owner": "Module", "from": "renameExport", "to": "withRenamedExport", "arguments": { "kind": "bag", "names": ["currentExportKey", "newExportKey"] } }
  ]
}
```

`tools/codemod/test/fixtures/array-argument/input.ts`:

```ts
import { DiBag } from 'di-bag';

const logging = DiBag.createBuilder().register({ logger: () => console }).buildModule(['logger']);
const clocks = DiBag.createBuilder().register({ clock: () => Date }).buildModule(['clock']);

export const app = DiBag.createBuilder()
  .installModule(logging)
  .installModule(clocks.renameExport('clock', 'wallClock'))
  .build();
```

`tools/codemod/test/fixtures/array-argument/expected.ts`:

```ts
import { DiBag } from 'di-bag';

const logging = DiBag.createBuilder().register({ logger: () => console }).buildModule(['logger']);
const clocks = DiBag.createBuilder().register({ clock: () => Date }).buildModule(['clock']);

export const app = DiBag.createBuilder()
  .withInstalledModules([logging])
  .withInstalledModules([clocks.withRenamedExport({ currentExportKey: 'clock', newExportKey: 'wallClock' })])
  .build();
```

`tools/codemod/test/fixtures/array-argument/expected-manual.json`:

```json
[]
```

- [ ] **Step 6: Fixture `options-and-values`**

Proves: an option key renamed by position; a quoted key keeping its quotes; a shorthand property expanded; a nested path (`dynamic.describe`, `dynamic.mode`); a string value at an argument and inside an options bag; a template literal without substitutions; a value that is not a literal, a spread, and a non-literal argument, all reported.

`tools/codemod/test/fixtures/options-and-values/map.json`:

```json
{
  "version": 1,
  "methods": [
    { "owner": "DiBagApi", "from": "fromFactory", "to": "createProvider" }
  ],
  "options": [
    { "owner": "DiBagApi", "method": "fromFactory", "argument": 1, "from": "acquisitionMode", "to": "factoryReturnKind" },
    { "owner": "DiBagApi", "method": "withMetadata", "argument": 1, "from": "static", "to": "registrationMetadata" },
    { "owner": "DiBagApi", "method": "withMetadata", "argument": 1, "path": ["dynamic"], "from": "describe", "to": "describeAcquisition" }
  ],
  "values": [
    { "owner": "DiBagApi", "method": "fromFactory", "argument": 1, "path": ["acquisitionMode"], "from": "raw", "to": "uninspected" },
    { "owner": "DiBagApi", "method": "fromFactory", "argument": 1, "path": ["acquisitionMode"], "from": "nativePromise", "to": "native-promise" },
    { "owner": "DiBagApi", "method": "withMetadata", "argument": 1, "path": ["dynamic", "mode"], "from": "direct", "to": "exposed-service" },
    { "owner": "DiBagApi", "method": "withLifetime", "argument": 1, "from": "root", "to": "singleton:one-per-container-tree" }
  ]
}
```

`tools/codemod/test/fixtures/options-and-values/input.ts`:

```ts
import { DiBag } from 'di-bag';

const acquisitionMode = 'raw' as const;
const shared = { acquisitionMode: 'raw' } as const;

export const query = DiBag.fromFactory(() => ({ then: (done: (rows: string[]) => void) => done([]) }), { acquisitionMode: 'raw' });
export const quoted = DiBag.fromFactory(async () => 1, { "acquisitionMode": "nativePromise" });
export const shorthand = DiBag.fromFactory(() => 2, { acquisitionMode });
export const spread = DiBag.fromFactory(() => 3, { ...shared });
export const cache = DiBag.withLifetime(() => new Map<string, string>(), 'root');
export const scoped = DiBag.withLifetime(() => new Map<string, string>(), `scoped`);
export const described = DiBag.withMetadata(() => ({ id: 7 }), {
  static: { owner: 'billing' },
  dynamic: { mode: 'direct', describe: value => ({ id: value.id }) },
});
const lifetime = 'root' as const;
export const indirect = DiBag.withLifetime(() => 1, lifetime);
```

`tools/codemod/test/fixtures/options-and-values/expected.ts`:

```ts
import { DiBag } from 'di-bag';

const acquisitionMode = 'raw' as const;
const shared = { acquisitionMode: 'raw' } as const;

export const query = DiBag.createProvider(() => ({ then: (done: (rows: string[]) => void) => done([]) }), { factoryReturnKind: 'uninspected' });
export const quoted = DiBag.createProvider(async () => 1, { "factoryReturnKind": "native-promise" });
export const shorthand = DiBag.createProvider(() => 2, { factoryReturnKind: acquisitionMode });
export const spread = DiBag.createProvider(() => 3, { ...shared });
export const cache = DiBag.withLifetime(() => new Map<string, string>(), 'singleton:one-per-container-tree');
export const scoped = DiBag.withLifetime(() => new Map<string, string>(), `scoped`);
export const described = DiBag.withMetadata(() => ({ id: 7 }), {
  registrationMetadata: { owner: 'billing' },
  dynamic: { mode: 'exposed-service', describeAcquisition: value => ({ id: value.id }) },
});
const lifetime = 'root' as const;
export const indirect = DiBag.withLifetime(() => 1, lifetime);
```

`tools/codemod/test/fixtures/options-and-values/expected-manual.json`:

```json
[
  {
    "line": 8,
    "reason": "the value of acquisitionMode is not a string literal; where it is produced, rename 'raw' to 'uninspected', 'nativePromise' to 'native-promise'"
  },
  {
    "line": 9,
    "reason": "an options object is spread here; rename its keys where that object is built"
  },
  {
    "line": 17,
    "reason": "argument 2 of withLifetime is not a literal; where it is built, apply: value 'root' to 'singleton:one-per-container-tree'"
  }
]
```

- [ ] **Step 7: Fixture `properties`**

Proves: property access on a class (`Token.key`), on an interface, and on a union where every member is renamed alike (`scopeId`, `label`); a computed key; destructuring of a library object and of a plain object; object literals typed by a library type, with a plain and a quoted key; an object that only looks alike; a string compared with a library property through `===` and through `switch`; a `manual` property.

`tools/codemod/test/fixtures/properties/map.json`:

```json
{
  "version": 1,
  "properties": [
    { "owner": "Token", "from": "key", "to": "symbol" },
    { "owner": "RegistrationSnapshot", "from": "label", "to": "bindingLabel" },
    { "owner": "AcquisitionEventFields", "from": "label", "to": "bindingLabel" },
    { "owner": "ScopeEventFields", "from": "scopeId", "to": "containerId" },
    { "owner": "AcquisitionEventFields", "from": "scopeId", "to": "containerId" },
    { "owner": "Presence", "from": "present", "to": "isPresent" },
    { "owner": "BindingSnapshot", "from": "owned", "manual": "owned became isOwnedByBag and now means something narrower; check this use" }
  ],
  "values": [
    { "owner": "LifecycleEvent", "property": "kind", "from": "scope-opened", "to": "container-opened" },
    { "owner": "LifecycleEvent", "property": "kind", "from": "scope-closed", "to": "container-closed" }
  ]
}
```

`tools/codemod/test/fixtures/properties/input.ts`:

```ts
import { DiBag } from 'di-bag';
import type { LifecycleEvent, Presence } from 'di-bag';

const clockKey = Symbol('clock');
const clock = DiBag.token(clockKey).of<{ now(): number }>();
const bag = DiBag.createBuilder().register(clock, () => ({ now: () => 42 })).register({ value: () => 1 }).build();

export const sameKey = clock.key === clockKey;
export const overrides = { [clock.key]: () => ({ now: () => 0 }) };
export const label = bag.inspect('value').label;
const { label: valueLabel, bindingId } = bag.inspect('value');
const { label: plainLabel } = { label: 'mine' };
export const names = [valueLabel, bindingId, plainLabel];
export const owned = bag.inspectGraph().bindings.map(binding => binding.owned);

export const found: Presence<number> = { present: true, value: 1 };
export const missing: Presence<number> = { 'present': false };
export const unrelated = { present: true, label: 'not a library object', key: 'k' };

export function observe(event: LifecycleEvent): symbol | string {
  if (event.kind === 'scope-opened') return event.scopeId;
  switch (event.kind) {
    case 'scope-closed': return event.scopeId;
    case 'acquisition-ready': return event.label;
    default: return 'scope-opened';
  }
}
```

`tools/codemod/test/fixtures/properties/expected.ts`:

```ts
import { DiBag } from 'di-bag';
import type { LifecycleEvent, Presence } from 'di-bag';

const clockKey = Symbol('clock');
const clock = DiBag.token(clockKey).of<{ now(): number }>();
const bag = DiBag.createBuilder().register(clock, () => ({ now: () => 42 })).register({ value: () => 1 }).build();

export const sameKey = clock.symbol === clockKey;
export const overrides = { [clock.symbol]: () => ({ now: () => 0 }) };
export const label = bag.inspect('value').bindingLabel;
const { bindingLabel: valueLabel, bindingId } = bag.inspect('value');
const { label: plainLabel } = { label: 'mine' };
export const names = [valueLabel, bindingId, plainLabel];
export const owned = bag.inspectGraph().bindings.map(binding => binding.owned);

export const found: Presence<number> = { isPresent: true, value: 1 };
export const missing: Presence<number> = { 'isPresent': false };
export const unrelated = { present: true, label: 'not a library object', key: 'k' };

export function observe(event: LifecycleEvent): symbol | string {
  if (event.kind === 'container-opened') return event.containerId;
  switch (event.kind) {
    case 'container-closed': return event.containerId;
    case 'acquisition-ready': return event.bindingLabel;
    default: return 'scope-opened';
  }
}
```

`tools/codemod/test/fixtures/properties/expected-manual.json`:

```json
[
  {
    "line": 14,
    "reason": "owned became isOwnedByBag and now means something narrower; check this use"
  }
]
```

- [ ] **Step 8: Fixture `types-and-imports`**

Proves: a renamed export in a named import, behind a local alias, through a namespace import, in an `import()` type and in `instanceof`; a re-export that keeps its old public name and is reported; a local property that only shares the name; the `di-bag/node` specifier in `import`, `export … from`, `import()` types and dynamic `import()`.

`tools/codemod/test/fixtures/types-and-imports/map.json`:

```json
{
  "version": 1,
  "types": [
    { "from": "Bag", "to": "Container" },
    { "from": "DiBagCleanupError", "to": "DiBagDisposalError" }
  ],
  "imports": [
    { "from": "di-bag/node", "to": "di-bag" },
    { "fromSuffix": "/src/node", "toSuffix": "/src" }
  ]
}
```

`tools/codemod/test/fixtures/types-and-imports/input.ts`:

```ts
import { DiBag, DiBagCleanupError } from 'di-bag/node';
import type { Bag, Bag as AnyBag, Builder } from 'di-bag/node';
import type * as DiBagTypes from 'di-bag';

export type { Bag } from 'di-bag/node';
export { DiBagCleanupError };

type Registrations = Record<string, () => unknown>;
export type App = Bag<Registrations>;
export type Other = AnyBag<Registrations>;
export type Qualified = DiBagTypes.Bag<Registrations>;
export type Lazy = import('di-bag/node').Bag<Registrations>;
export type Unchanged = Builder<never>;

// A local type with a library name is not a library type.
interface Shelf { Bag: string }
export const shelf: Shelf = { Bag: 'paper' };

export function isCleanup(error: unknown): error is DiBagCleanupError {
  return error instanceof DiBagCleanupError;
}

export const bag: Bag<{ value: () => number }> = DiBag.createBuilder().register({ value: () => 1 }).build();
export const loaded = import('di-bag/node');
```

`tools/codemod/test/fixtures/types-and-imports/expected.ts`:

```ts
import { DiBag, DiBagDisposalError } from 'di-bag';
import type { Container, Container as AnyBag, Builder } from 'di-bag';
import type * as DiBagTypes from 'di-bag';

export type { Container as Bag } from 'di-bag';
export { DiBagDisposalError as DiBagCleanupError };

type Registrations = Record<string, () => unknown>;
export type App = Container<Registrations>;
export type Other = AnyBag<Registrations>;
export type Qualified = DiBagTypes.Container<Registrations>;
export type Lazy = import('di-bag').Container<Registrations>;
export type Unchanged = Builder<never>;

// A local type with a library name is not a library type.
interface Shelf { Bag: string }
export const shelf: Shelf = { Bag: 'paper' };

export function isCleanup(error: unknown): error is DiBagDisposalError {
  return error instanceof DiBagDisposalError;
}

export const bag: Container<{ value: () => number }> = DiBag.createBuilder().register({ value: () => 1 }).build();
export const loaded = import('di-bag');
```

`tools/codemod/test/fixtures/types-and-imports/expected-manual.json`:

```json
[
  {
    "line": 5,
    "reason": "Bag is re-exported; the re-export keeps its old public name, rename it when your own consumers can follow"
  },
  {
    "line": 6,
    "reason": "DiBagCleanupError is re-exported; the re-export keeps its old public name, rename it when your own consumers can follow"
  }
]
```

- [ ] **Step 9: Fixture `codes`**

Proves: a code renamed in single quotes, double quotes and a plain template; a split code reported; an old code inside a regular expression and a comment reported with the line of the new text; a longer identifier that only starts like a code left alone.

`tools/codemod/test/fixtures/codes/map.json`:

```json
{
  "version": 1,
  "codes": [
    { "from": "DI_BAG_CYCLE", "to": "DI_BAG_DEPENDENCY_CYCLE" },
    { "from": "DI_BAG_INVALID_SCOPE", "manual": "DI_BAG_INVALID_SCOPE was split into DI_BAG_INVALID_ARGUMENT, DI_BAG_UNKNOWN_SERVICE_KEY, DI_BAG_MISSING_REPLACEMENT_PROVIDER and DI_BAG_CONFLICTING_SERVICE_SELECTION; pick by the failure you expect" }
  ]
}
```

`tools/codemod/test/fixtures/codes/input.ts`:

```ts
type Coded = { code?: string };

export function classify(error: Coded): string {
  if (error.code === 'DI_BAG_CYCLE') return "DI_BAG_CYCLE";
  if (error.code === 'DI_BAG_INVALID_SCOPE') return 'scope';
  if (/DI_BAG_CYCLE: alias cycle/.test(String(error))) return `DI_BAG_CYCLE`;
  // DI_BAG_CYCLE in a comment is reported, not rewritten.
  return 'DI_BAG_CYCLES_ARE_NOT_A_CODE';
}
```

`tools/codemod/test/fixtures/codes/expected.ts`:

```ts
type Coded = { code?: string };

export function classify(error: Coded): string {
  if (error.code === 'DI_BAG_DEPENDENCY_CYCLE') return "DI_BAG_DEPENDENCY_CYCLE";
  if (error.code === 'DI_BAG_INVALID_SCOPE') return 'scope';
  if (/DI_BAG_CYCLE: alias cycle/.test(String(error))) return `DI_BAG_DEPENDENCY_CYCLE`;
  // DI_BAG_CYCLE in a comment is reported, not rewritten.
  return 'DI_BAG_CYCLES_ARE_NOT_A_CODE';
}
```

`tools/codemod/test/fixtures/codes/expected-manual.json`:

```json
[
  {
    "line": 5,
    "reason": "DI_BAG_INVALID_SCOPE was split into DI_BAG_INVALID_ARGUMENT, DI_BAG_UNKNOWN_SERVICE_KEY, DI_BAG_MISSING_REPLACEMENT_PROVIDER and DI_BAG_CONFLICTING_SERVICE_SELECTION; pick by the failure you expect"
  },
  {
    "line": 6,
    "reason": "DI_BAG_CYCLE appears outside a plain string; replace it with DI_BAG_DEPENDENCY_CYCLE by hand"
  },
  {
    "line": 7,
    "reason": "DI_BAG_CYCLE appears outside a plain string; replace it with DI_BAG_DEPENDENCY_CYCLE by hand"
  }
]
```

- [ ] **Step 10: Fixture `untouched`**

Proves the contract's central promise. `String.prototype.replace`, `Promise.all`, `Promise.resolve`, a user's own `register`, `alias` and `resolve`, and the `signal` key passed to `fetch` stay as they are, while the library's `register`, `replace` and `resolve` in the same file are rewritten. A receiver of type `any` is reported for a name the map renames and that no built-in object has (`alias`), and is not reported for a built-in name (`replace`).

`tools/codemod/test/fixtures/untouched/map.json`:

```json
{
  "version": 1,
  "methods": [
    { "owner": "Builder", "from": "register", "to": "withServices", "arity": [1] },
    { "owner": "Builder", "from": "replace", "to": "withReplacedService", "arguments": { "kind": "bag", "names": ["serviceKey", "provider"] } },
    { "owner": "Builder", "from": "alias", "to": "withServiceAlias", "arguments": { "kind": "bag", "names": ["aliasKey", "targetServiceKey"] } },
    { "owner": "Bag", "from": "resolve", "to": "resolveService" },
    { "owner": "Bag", "from": "resolveAll", "to": "resolveAllContributions" },
    { "owner": "DiBagApi", "from": "all", "to": "allContributions" }
  ],
  "options": [
    { "owner": "Bag", "method": "close", "argument": 0, "from": "signal", "to": "abortSignal" }
  ],
  "properties": [
    { "owner": "CloseOptions", "from": "signal", "to": "abortSignal" }
  ]
}
```

`tools/codemod/test/fixtures/untouched/input.ts`:

```ts
import { DiBag } from 'di-bag';

class Registry {
  register(entries: Record<string, number>): this { void entries; return this; }
  alias(destination: string, target: string): this { void destination; void target; return this; }
  resolve(name: string): string { return name; }
}

export async function untouched(url: string, signal: AbortSignal, loose: any) {
  const text = 'a-b'.replace('-', '+');
  const settled = await Promise.all([Promise.resolve(1), Promise.resolve(text)]);
  const registry = new Registry().register({ one: 1 }).alias('uno', 'one');
  const response = fetch(url, { signal });
  loose.replace('x', 'y');
  loose.alias('a', 'b');
  return [settled, registry.resolve('one'), response];
}

export const bag = DiBag.createBuilder().register({ value: () => 1 }).replace('value', () => 2).build();
export const value = bag.resolve('value');
```

`tools/codemod/test/fixtures/untouched/expected.ts`:

```ts
import { DiBag } from 'di-bag';

class Registry {
  register(entries: Record<string, number>): this { void entries; return this; }
  alias(destination: string, target: string): this { void destination; void target; return this; }
  resolve(name: string): string { return name; }
}

export async function untouched(url: string, signal: AbortSignal, loose: any) {
  const text = 'a-b'.replace('-', '+');
  const settled = await Promise.all([Promise.resolve(1), Promise.resolve(text)]);
  const registry = new Registry().register({ one: 1 }).alias('uno', 'one');
  const response = fetch(url, { signal });
  loose.replace('x', 'y');
  loose.alias('a', 'b');
  return [settled, registry.resolve('one'), response];
}

export const bag = DiBag.createBuilder().withServices({ value: () => 1 }).withReplacedService({ serviceKey: 'value', provider: () => 2 }).build();
export const value = bag.resolveService('value');
```

`tools/codemod/test/fixtures/untouched/expected-manual.json`:

```json
[
  {
    "line": 15,
    "reason": "the receiver of alias has type any, so this call cannot be checked; migrate it by hand if it is a DI Bag call"
  }
]
```

- [ ] **Step 11: Write the failing tests**

Create `tools/codemod/test/helpers.mjs`:

```js
// tools/codemod/test/helpers.mjs
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadTypeScript, runCodemod } from '../lib/codemod.mjs';

export const packageRoot = resolve(import.meta.dirname, '..');
export const fixturesRoot = resolve(import.meta.dirname, 'fixtures');
export const compiler = loadTypeScript(fixturesRoot);
const ts = compiler.ts;

/** Every fixture directory: it holds `input.ts`, `expected.ts`, `expected-manual.json` and usually its own `map.json`. */
export const fixtureNames = readdirSync(fixturesRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && existsSync(join(fixturesRoot, entry.name, 'input.ts')))
  .map(entry => entry.name)
  .sort();

let program;
/** One program for all fixtures; the engine never mutates it. */
export function fixturesProgram() {
  if (!program) {
    const config = ts.getParsedCommandLineOfConfigFile(join(fixturesRoot, 'tsconfig.json'), {}, {
      ...ts.sys, onUnRecoverableConfigFileDiagnostic: diagnostic => { throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')); },
    });
    program = ts.createProgram(config.fileNames, { ...config.options, noEmit: true });
  }
  return program;
}

/** Run one fixture with its own map, or with the shipped map when it has none. */
export function runFixture(name) {
  const mapFile = join(fixturesRoot, name, 'map.json');
  const map = existsSync(mapFile) ? JSON.parse(readFileSync(mapFile, 'utf8')) : undefined;
  const result = runCodemod({ typescript: ts, root: fixturesRoot, program: fixturesProgram(), only: [`${name}/input.ts`], ...(map ? { map } : {}) });
  return {
    text: result.files[0]?.text ?? readFileSync(join(fixturesRoot, name, 'input.ts'), 'utf8'),
    manual: result.manual.map(({ line, reason }) => ({ line, reason })),
  };
}

export const readFixture = (name, file) => readFileSync(join(fixturesRoot, name, file), 'utf8');
```

Create `tools/codemod/test/fixtures.test.mjs`:

```js
// tools/codemod/test/fixtures.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compiler, fixtureNames, fixturesProgram, readFixture, runFixture } from './helpers.mjs';

test('every fixture input type-checks against the published di-bag 0.4.0 declarations', () => {
  const ts = compiler.ts;
  const messages = ts.getPreEmitDiagnostics(fixturesProgram()).map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
  assert.deepEqual(messages, []);
  assert.ok(fixtureNames.length >= 8, `found ${fixtureNames.length} fixtures`);
});

for (const name of fixtureNames) {
  test(`fixture ${name}: rewritten text and manual items`, () => {
    const result = runFixture(name);
    assert.equal(result.text, readFixture(name, 'expected.ts'));
    assert.deepEqual(result.manual, JSON.parse(readFixture(name, 'expected-manual.json')));
  });
}

test('a rewritten file is stable: a second run changes nothing the first run could decide', () => {
  // The expected files use 0.5 names that the 0.4.0 declarations lack, so only the text-level guarantee is checked:
  // no old method name that the map renames without conditions is left in an expected file.
  assert.doesNotMatch(readFixture('method-rename', 'expected.ts'), /\.(register|contribute|verifyGraph|inspectGraph)\(/);
  assert.doesNotMatch(readFixture('array-argument', 'expected.ts'), /\.(installModule|renameExport)\(/);
});
```

- [ ] **Step 12: Run them to make sure they fail**

Run: `node --test tools/codemod/test/fixtures.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `lib/codemod.mjs`.

- [ ] **Step 13: Implement library detection**

Create `tools/codemod/lib/library.mjs`:

```js
// tools/codemod/lib/library.mjs
import { resolve } from 'node:path';

const normalize = file => file.replaceAll('\\', '/');

/**
 * Decides which declarations belong to DI Bag and names their owner.
 * With `libraryRoots` the library is those directories (this repository runs with `src` and `dist`);
 * without any, the library is every `node_modules/di-bag/` directory.
 */
export function createLibrary({ ts, checker, root, libraryRoots = [] }) {
  const prefixes = libraryRoots.map(directory => `${normalize(resolve(root, directory))}/`);
  const isLibraryFile = fileName => {
    const file = normalize(fileName);
    return prefixes.length === 0 ? file.includes('/node_modules/di-bag/') : prefixes.some(prefix => file.startsWith(prefix));
  };

  /** The symbol a name refers to, with import aliases followed. */
  function symbolAt(node) {
    let symbol = checker.getSymbolAtLocation(node);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    return symbol;
  }

  /**
   * The owner of a member declaration: the nearest enclosing named declaration.
   * A class, interface or type alias gives `Name`; a function gives `name()`;
   * a method gives `Owner.method()`. A type literal written inline in a signature
   * therefore belongs to that function or method.
   */
  function ownerOf(declaration) {
    for (let node = declaration.parent; node; node = node.parent) {
      if ((ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && node.name) return node.name.text;
      if (ts.isFunctionDeclaration(node) && node.name) return `${node.name.text}()`;
      if ((ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) && ts.isIdentifier(node.name)) {
        const container = node.parent;
        if ((ts.isClassDeclaration(container) || ts.isInterfaceDeclaration(container)) && container.name) return `${container.name.text}.${node.name.text}()`;
      }
    }
    return undefined;
  }

  /** Every distinct `{ owner, name }` a member symbol is declared as inside the library. */
  function membersOf(symbol) {
    const members = new Map();
    for (const declaration of symbol?.declarations ?? []) {
      if (!isLibraryFile(declaration.getSourceFile().fileName)) continue;
      const owner = ownerOf(declaration);
      if (owner !== undefined) members.set(`${owner}.${symbol.name}`, { owner, name: symbol.name });
    }
    return [...members.values()];
  }

  /** The exported name when the symbol is a top-level declaration of the library, else undefined. */
  function exportNameOf(symbol) {
    for (const declaration of symbol?.declarations ?? []) {
      if (!isLibraryFile(declaration.getSourceFile().fileName)) continue;
      const holder = ts.isVariableDeclaration(declaration) ? declaration.parent?.parent : declaration;
      if (holder?.parent && ts.isSourceFile(holder.parent)) return symbol.name;
    }
    return undefined;
  }

  return { isLibraryFile, symbolAt, membersOf, exportNameOf };
}
```

- [ ] **Step 14: Implement the engine**

Create `tools/codemod/lib/rewrite.mjs`. Copy it exactly; the section "How the engine decides" above explains each part. Three details are easy to get wrong when changing it later: `assemble` must never offer a child that carries replacements to a handler again; a handler that gives up on a call must add the callee to `skip`; the text a handler returns excludes the node's leading trivia, which `assemble` copies from the source.

```js
// tools/codemod/lib/rewrite.mjs

// Members of built-in objects. A call such as `text.replace(...)` on an `any` receiver is not worth a report.
const BUILTIN_MEMBERS = new Set([String.prototype, Array.prototype, Promise.prototype, Promise, Object, Object.prototype, Map.prototype, Set.prototype]
  .flatMap(target => Object.getOwnPropertyNames(target)));
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * Rewrite one source file. Every decision reads the original program; the new text is
 * assembled bottom-up, so a rewritten call may contain other rewritten calls.
 * @returns {{ text: string, rewrites: number }}
 */
export function rewriteSourceFile({ ts, checker, sourceFile, library, index, transforms, manualItems, fileLabel }) {
  const source = sourceFile.text;
  const start = node => node.getStart(sourceFile);
  const slice = (from, to) => source.slice(from, to);
  const skip = new Set();
  let rewrites = 0;

  function manual(node, reason) {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(start(node));
    manualItems.push({ file: fileLabel, line: line + 1, column: character + 1, reason, text: slice(start(node), node.end).split('\n')[0].slice(0, 120) });
  }

  /** The transformed text of a node without its leading trivia. */
  function text(node) {
    const replaced = rewriteNode(node);
    if (replaced !== undefined) { rewrites++; return replaced; }
    return assemble(node, []);
  }

  /**
   * The text of `node` with `replacements` applied and every other child transformed.
   * Replacements are `{ start, end, text }` in file positions, inside the node, sorted and disjoint.
   * A child that contains replacements is assembled with them and is not offered to the handlers again.
   */
  function assemble(node, replacements) {
    const pending = [...replacements].sort((left, right) => left.start - right.start || left.end - right.end);
    const children = [];
    ts.forEachChild(node, child => { children.push(child); });
    let cursor = start(node);
    let out = '';
    const emit = replacement => { out += slice(cursor, replacement.start) + replacement.text; cursor = replacement.end; };
    for (const child of children) {
      const childStart = start(child);
      while (pending.length && pending[0].end <= childStart) emit(pending.shift());
      if (child.end <= cursor) continue;
      if (pending.length && pending[0].start <= childStart && pending[0].end >= child.end) continue;
      const inner = [];
      while (pending.length && pending[0].start >= childStart && pending[0].end <= child.end) inner.push(pending.shift());
      if (pending.length && pending[0].start < child.end) throw new Error(`overlapping rewrite in ${fileLabel} at offset ${pending[0].start}`);
      if (childStart < cursor) throw new Error(`children out of order in ${fileLabel} at offset ${childStart}`);
      out += slice(cursor, childStart) + (inner.length ? assemble(child, inner) : text(child));
      cursor = child.end;
    }
    while (pending.length) emit(pending.shift());
    return out + slice(cursor, node.end);
  }

  const quote = (literal, value) => {
    const delimiter = slice(start(literal), start(literal) + 1);
    return `${delimiter}${value.replaceAll(delimiter, `\\${delimiter}`)}${delimiter}`;
  };
  const keyText = (nameNode, key) => ts.isStringLiteral(nameNode) ? quote(nameNode, key) : IDENTIFIER.test(key) ? key : `'${key}'`;
  const isStringValue = node => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
  const literalKey = property => property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) ? property.name.text : undefined;

  /**
   * Rewrite the properties of an object literal.
   * `rename(key)` gives a new key; `value(key, current)` a new string value; `nested(key, literal)` the whole
   * text of a nested literal; `replace[key](property)` the whole property, `null` to drop it, `undefined` to give up.
   * @returns {{ text: string, changed: boolean, remaining: number } | undefined} undefined when a `replace` callback gave up.
   */
  function objectLiteral(literal, { rename = () => undefined, value = () => undefined, renamedValues = () => [], nested = () => undefined, replace = {}, spreadReason } = {}) {
    const replacements = [];
    const properties = literal.properties;
    let removed = 0;
    let previousRemoved = false;
    for (let position = 0; position < properties.length; position++) {
      const property = properties[position];
      const wasPreviousRemoved = previousRemoved;
      previousRemoved = false;
      if (ts.isSpreadAssignment(property)) { if (spreadReason) manual(property, spreadReason); continue; }
      const key = literalKey(property);
      if (key === undefined) continue;
      if (Object.hasOwn(replace, key)) {
        const result = replace[key](property);
        if (result === undefined) return undefined;
        if (result === null) {
          removed++;
          previousRemoved = true;
          if (position + 1 < properties.length) replacements.push({ start: start(property), end: start(properties[position + 1]), text: '' });
          else replacements.push({ start: position > 0 && !wasPreviousRemoved ? properties[position - 1].end : start(property), end: property.end, text: '' });
        } else replacements.push({ start: start(property), end: property.end, text: result });
        continue;
      }
      const newKey = rename(key, property);
      if (ts.isShorthandPropertyAssignment(property)) {
        if (newKey !== undefined && newKey !== key) replacements.push({ start: start(property), end: property.end, text: `${keyText(property.name, newKey)}: ${key}` });
        if (renamedValues(key).length) manual(property, `the value of ${key} is not a string literal; where it is produced, rename ${renamedValues(key).join(', ')}`);
        continue;
      }
      if (newKey !== undefined && newKey !== key) replacements.push({ start: start(property.name), end: property.name.end, text: keyText(property.name, newKey) });
      if (!ts.isPropertyAssignment(property)) continue;
      const initializer = property.initializer;
      if (isStringValue(initializer)) {
        const newValue = value(key, initializer.text);
        if (newValue !== undefined) replacements.push({ start: start(initializer), end: initializer.end, text: quote(initializer, newValue) });
      } else if (renamedValues(key).length && !ts.isObjectLiteralExpression(initializer)) {
        manual(initializer, `the value of ${key} is not a string literal; where it is produced, rename ${renamedValues(key).join(', ')}`);
      } else if (ts.isObjectLiteralExpression(initializer)) {
        const newText = nested(key, initializer);
        if (newText !== undefined) replacements.push({ start: start(initializer), end: initializer.end, text: newText });
      }
    }
    return { text: assemble(literal, replacements), changed: replacements.length > 0, remaining: properties.length - removed };
  }

  /** An object-literal argument of a library call, rewritten by the map's `options` and `values` entries for that path. */
  function argumentObject(literal, member, argument, path) {
    const { owner, name } = member;
    const renames = new Map(index.optionsFor(owner, name, argument, path).map(entry => [entry.from, entry.to]));
    return objectLiteral(literal, {
      rename: key => renames.get(key),
      value: (key, current) => index.valuesFor(owner, name, argument, [...path, key]).find(entry => entry.from === current)?.to,
      renamedValues: key => index.valuesFor(owner, name, argument, [...path, key]).map(entry => `'${entry.from}' to '${entry.to}'`),
      nested: (key, inner) => index.hasEntriesBelow(owner, name, argument, [...path, key]) ? argumentObject(inner, member, argument, [...path, key]).text : undefined,
      spreadReason: renames.size ? 'an options object is spread here; rename its keys where that object is built' : undefined,
    });
  }

  /** The transformed text of one call argument, with the map's entries for its position applied. */
  function argumentText(argumentNode, member, argument) {
    if (isStringValue(argumentNode)) {
      const entry = index.valuesFor(member.owner, member.name, argument, []).find(candidate => candidate.from === argumentNode.text);
      if (entry) return quote(argumentNode, entry.to);
    }
    if (ts.isObjectLiteralExpression(argumentNode) && index.hasEntriesBelow(member.owner, member.name, argument, [])) return argumentObject(argumentNode, member, argument, []).text;
    return text(argumentNode);
  }

  const lineIndent = position => /^[ \t]*/.exec(slice(source.lastIndexOf('\n', position - 1) + 1, position))[0];

  /** Positional arguments as one options bag, or undefined after reporting why it cannot be done. */
  function bagArguments(call, entry, member) {
    const { names, trailing } = entry.arguments;
    const argumentNodes = [...call.arguments];
    const extra = argumentNodes.slice(names.length);
    if (extra.length > 1 || (extra.length === 1 && !trailing)) { manual(call, `${member.name} has more arguments than the rename map describes; rewrite it to ${entry.to} by hand`); return undefined; }
    const parts = argumentNodes.slice(0, names.length).map((argumentNode, position) => {
      const value = argumentText(argumentNode, member, position);
      return value === names[position] ? value : `${names[position]}: ${value}`;
    });
    let after = '';
    if (extra.length === 1 && trailing.mode === 'keep') after = `, ${argumentText(extra[0], member, names.length)}`;
    if (extra.length === 1 && trailing.mode === 'merge') {
      if (!ts.isObjectLiteralExpression(extra[0])) { manual(call, `the last argument of ${member.name} is not an object literal; merge it into the ${entry.to} bag by hand`); return undefined; }
      const keys = trailing.keys ?? {};
      const merged = objectLiteral(extra[0], { rename: key => keys[key], spreadReason: 'an options object is spread here; rename its keys where that object is built' });
      const inner = merged.text.slice(1, -1).trim().replace(/,$/, '');
      if (inner) parts.push(inner);
    }
    if (parts.length === 0) return after.replace(/^, /, '');
    const multiline = parts.some(part => part.includes('\n')) || slice(call.arguments.pos, call.arguments.end).includes('\n');
    if (!multiline) return `{ ${parts.join(', ')} }${after}`;
    const indent = lineIndent(start(call.expression.name));
    return `{\n${parts.map(part => `${indent}  ${part},`).join('\n')}\n${indent}}${after}`;
  }

  function reportAnyReceiver(callee) {
    const name = callee.name.text;
    if (BUILTIN_MEMBERS.has(name) || !index.methodNames.has(name)) return;
    const receiver = checker.getTypeAtLocation(callee.expression);
    if (receiver.flags & ts.TypeFlags.Any) manual(callee, `the receiver of ${name} has type any, so this call cannot be checked; migrate it by hand if it is a DI Bag call`);
  }

  function transformApi(member) {
    return { ts, checker, sourceFile, member, text, slice, start, assemble, objectLiteral, quote, manual, nameOf: index.nameOf };
  }

  function rewriteCall(call) {
    const callee = call.expression;
    if (!ts.isPropertyAccessExpression(callee) || !index.callNames.has(callee.name.text)) return undefined;
    const name = callee.name.text;
    const members = library.membersOf(library.symbolAt(callee.name));
    if (members.length === 0) { reportAnyReceiver(callee); return undefined; }
    for (const member of members) {
      const entry = index.methodFor(member.owner, name, call.arguments.length);
      const touched = call.arguments.map((_, position) => position).filter(position => index.hasEntriesBelow(member.owner, name, position, []));
      if (!entry && touched.length === 0) continue;
      if ((entry?.arguments || entry?.transform) && call.arguments.some(ts.isSpreadElement)) {
        manual(call, `${name} is called with a spread argument; rewrite it to ${entry.to} by hand`);
        skip.add(callee);
        return undefined;
      }
      if (entry?.transform) {
        const result = transforms[entry.transform](call, transformApi(member));
        if (result === undefined) skip.add(callee);
        return result;
      }
      const replacements = [];
      if (entry && entry.to !== name) replacements.push({ start: start(callee.name), end: callee.name.end, text: entry.to });
      if (entry?.arguments?.kind === 'bag') {
        const bag = bagArguments(call, entry, member);
        if (bag === undefined) { skip.add(callee); return undefined; }
        // Up to the closing parenthesis, so a bag written over several lines does not leave `}` and `)` on separate lines.
        const closing = source[call.end - 1] === ')' ? call.end - 1 : call.arguments.end;
        if (call.arguments.pos !== closing || bag !== '') replacements.push({ start: call.arguments.pos, end: closing, text: bag });
      } else if (entry?.arguments?.kind === 'array') {
        if (call.arguments.length !== 1) { manual(call, `${name} is expected to take one argument; rewrite it to ${entry.to} by hand`); skip.add(callee); return undefined; }
        replacements.push({ start: start(call.arguments[0]), end: call.arguments[0].end, text: `[${argumentText(call.arguments[0], member, 0)}]` });
      } else {
        for (const position of touched) {
          const argumentNode = call.arguments[position];
          if (isStringValue(argumentNode) || ts.isObjectLiteralExpression(argumentNode)) replacements.push({ start: start(argumentNode), end: argumentNode.end, text: argumentText(argumentNode, member, position) });
          else manual(argumentNode, `argument ${position + 1} of ${name} is not a literal; where it is built, apply: ${index.describeArgumentEntries(member.owner, name, position)}`);
        }
      }
      return replacements.length ? assemble(call, replacements) : undefined;
    }
    return undefined;
  }

  /** The single rename target of a member, `null` when it must stay, after reporting what cannot be decided. */
  function memberRename(node, members, name, { called }) {
    const propertyEntries = members.map(member => index.properties.get(`${member.owner}.${name}`));
    if (propertyEntries.some(Boolean)) {
      if (propertyEntries.some(entry => !entry)) { manual(node, `${name} resolves to several declarations and the rename map covers only some of them`); return null; }
      const manualEntry = propertyEntries.find(entry => entry.manual !== undefined);
      if (manualEntry) { manual(node, manualEntry.manual); return null; }
      const targets = new Set(propertyEntries.map(entry => entry.to));
      if (targets.size !== 1) { manual(node, `${name} resolves to declarations with different new names`); return null; }
      return [...targets][0];
    }
    if (called) return null;
    const entry = members.map(member => index.methodFor(member.owner, name, undefined)).find(Boolean);
    if (!entry) return null;
    if (entry.transform || entry.arguments) { manual(node, `${name} is referenced without being called; rewrite this reference to ${entry.to} by hand`); return null; }
    return entry.to;
  }

  function rewritePropertyAccess(node) {
    const name = node.name.text;
    if (skip.has(node) || !index.memberNames.has(name)) return undefined;
    const members = library.membersOf(library.symbolAt(node.name));
    if (members.length === 0) return undefined;
    const called = ts.isCallExpression(node.parent) && node.parent.expression === node;
    const target = memberRename(node, members, name, { called });
    return target === null || target === name ? undefined : assemble(node, [{ start: start(node.name), end: node.name.end, text: target }]);
  }

  function rewriteBindingElement(element) {
    if (!ts.isObjectBindingPattern(element.parent)) return undefined;
    const keyNode = element.propertyName ?? element.name;
    if (!ts.isIdentifier(keyNode) || !index.memberNames.has(keyNode.text)) return undefined;
    const members = library.membersOf(checker.getTypeAtLocation(element.parent).getProperty(keyNode.text));
    if (members.length === 0) return undefined;
    const entry = members.map(member => index.methodFor(member.owner, keyNode.text, undefined)).find(Boolean);
    const reshaped = entry?.transform !== undefined || entry?.arguments !== undefined || members.some(member => index.hasArgumentEntries(member.owner, keyNode.text));
    if (reshaped) manual(element, `${keyNode.text} is destructured; calls through the local name are not rewritten, migrate them by hand`);
    const target = memberRename(element, members, keyNode.text, { called: false });
    if (target === null || target === keyNode.text) return undefined;
    const replacement = element.propertyName
      ? { start: start(element.propertyName), end: element.propertyName.end, text: target }
      : { start: start(element.name), end: element.name.end, text: `${target}: ${keyNode.text}` };
    return assemble(element, [replacement]);
  }

  function rewriteObjectLiteral(literal) {
    if (!literal.properties.some(property => index.propertyNames.has(literalKey(property) ?? ''))) return undefined;
    const contextual = checker.getContextualType(literal);
    if (!contextual) return undefined;
    const membersFor = key => library.membersOf(checker.getPropertyOfType(contextual, key));
    const result = objectLiteral(literal, {
      rename: (key, property) => {
        if (!index.memberNames.has(key)) return undefined;
        const members = membersFor(key);
        if (members.length === 0) return undefined;
        const target = memberRename(property, members, key, { called: true });
        return target === null ? undefined : target;
      },
      value: (key, current) => index.valuePropertyNames.has(key)
        ? membersFor(key).map(member => index.propertyValues.get(`${member.owner}.${key}=${current}`)).find(candidate => candidate !== undefined)
        : undefined,
    });
    return result.changed ? result.text : undefined;
  }

  function rewriteIdentifier(node) {
    const target = index.types.get(node.text);
    if (target === undefined) return undefined;
    const parent = node.parent;
    if (ts.isPropertyAccessExpression(parent) && parent.name === node) return undefined;
    const isKey = (ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent) || ts.isPropertyDeclaration(parent) || ts.isMethodDeclaration(parent)
      || ts.isMethodSignature(parent) || ts.isBindingElement(parent) || ts.isEnumMember(parent)) && parent.name === node;
    if (isKey) return undefined;
    if ((ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent)) && parent.propertyName !== undefined && parent.propertyName !== node) return undefined;
    if (library.exportNameOf(library.symbolAt(node)) !== node.text) return undefined;
    if (ts.isShorthandPropertyAssignment(parent)) return `${node.text}: ${target}`;
    if (ts.isExportSpecifier(parent) && parent.propertyName === undefined) {
      manual(parent, `${node.text} is re-exported; the re-export keeps its old public name, rename it when your own consumers can follow`);
      return `${target} as ${node.text}`;
    }
    return target;
  }

  const isModuleSpecifier = node => {
    const parent = node.parent;
    if ((ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) && parent.moduleSpecifier === node) return true;
    if (ts.isLiteralTypeNode(parent) && ts.isImportTypeNode(parent.parent)) return true;
    if (ts.isExternalModuleReference(parent)) return true;
    return ts.isCallExpression(parent) && parent.arguments[0] === node
      && (parent.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(parent.expression) && parent.expression.text === 'require'));
  };

  /** The expression a string is compared with: the other side of `===`, or the subject of its `switch`. */
  function comparedWith(node) {
    const parent = node.parent;
    const equality = [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken];
    if (ts.isBinaryExpression(parent) && equality.includes(parent.operatorToken.kind)) return parent.left === node ? parent.right : parent.left;
    if (ts.isCaseClause(parent) && parent.expression === node) return parent.parent.parent.expression;
    return undefined;
  }

  function rewriteString(node) {
    if (isModuleSpecifier(node)) {
      for (const entry of index.imports) {
        if (entry.from !== undefined && node.text === entry.from) return quote(node, entry.to);
        if (entry.fromSuffix !== undefined && node.text.startsWith('.')) {
          if (node.text.endsWith(entry.fromSuffix)) return quote(node, node.text.slice(0, -entry.fromSuffix.length) + entry.toSuffix);
          if (/\.[cm]?[jt]sx?$/.test(node.text) && node.text.replace(/\.[cm]?[jt]sx?$/, '').endsWith(entry.fromSuffix)) manual(node, `this import names the file with an extension; point it at ${entry.toSuffix} by hand`);
        }
      }
      return undefined;
    }
    const code = index.codes.get(node.text);
    if (code?.to !== undefined) return quote(node, code.to);
    if (index.propertyValueTexts.has(node.text)) {
      const other = comparedWith(node);
      if (other && ts.isPropertyAccessExpression(other) && index.valuePropertyNames.has(other.name.text)) {
        const property = other.name.text;
        const target = library.membersOf(library.symbolAt(other.name)).map(member => index.propertyValues.get(`${member.owner}.${property}=${node.text}`)).find(candidate => candidate !== undefined);
        if (target !== undefined) return quote(node, target);
      }
    }
    return undefined;
  }

  function rewriteNode(node) {
    if (ts.isCallExpression(node)) return rewriteCall(node);
    if (ts.isPropertyAccessExpression(node)) return rewritePropertyAccess(node);
    if (ts.isObjectLiteralExpression(node)) return rewriteObjectLiteral(node);
    if (ts.isBindingElement(node)) return rewriteBindingElement(node);
    if (ts.isIdentifier(node)) return rewriteIdentifier(node);
    if (isStringValue(node)) return rewriteString(node);
    return undefined;
  }

  let result = assemble(sourceFile, []);
  // `assemble` starts at the first token; keep the file's leading comments.
  result = slice(0, start(sourceFile)) + result;
  // Codes that survive sit in places no literal rewrite reaches: a split code, a regular expression, a template, a comment.
  const lines = result.split('\n');
  for (const [from, entry] of index.codes) {
    const pattern = new RegExp(`\\b${from}\\b`);
    lines.forEach((line, position) => {
      if (pattern.test(line)) manualItems.push({ file: fileLabel, line: position + 1, column: line.search(pattern) + 1, reason: entry.manual ?? `${from} appears outside a plain string; replace it with ${entry.to} by hand`, text: line.trim().slice(0, 120) });
    });
  }
  return { text: result, rewrites };
}
```

- [ ] **Step 15: Create the empty transform registry and the runner**

Create `tools/codemod/lib/transforms/index.mjs` with an empty registry. Task 4 fills it.

```js
// tools/codemod/lib/transforms/index.mjs

/** Custom transforms by id. Task 4 adds the first one. */
export const transforms = {};
```

Create `tools/codemod/lib/codemod.mjs`:

```js
// tools/codemod/lib/codemod.mjs
import { writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expandGlob } from './glob.mjs';
import { createLibrary } from './library.mjs';
import { indexRenameMap, loadRenameMap, validateRenameMap } from './rename-map.mjs';
import { rewriteSourceFile } from './rewrite.mjs';
import { transforms } from './transforms/index.mjs';

export { loadTypeScript } from './load-typescript.mjs';
export { validateRenameMap } from './rename-map.mjs';
export { transforms };

/** The map shipped with this package: the distance from di-bag 0.4.0 to the current API. */
export const defaultMapFile = resolve(dirname(fileURLToPath(import.meta.url)), '../rename-map.json');

function loadProgram(ts, { project, files, root, extraFiles }) {
  const extra = extraFiles.flatMap(pattern => expandGlob(pattern, root));
  if (project) {
    const config = ts.getParsedCommandLineOfConfigFile(resolve(root, project), {}, {
      ...ts.sys, onUnRecoverableConfigFileDiagnostic: diagnostic => { throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')); },
    });
    return ts.createProgram([...new Set([...config.fileNames, ...extra])], { ...config.options, noEmit: true });
  }
  return ts.createProgram([...new Set([...files.map(file => resolve(root, file)), ...extra])], {
    strict: true, noEmit: true, skipLibCheck: true, types: [],
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
  });
}

/**
 * Rewrite every source file of a program that is neither a declaration file, nor under
 * `node_modules`, nor part of the library itself.
 * @param {{ typescript: typeof import('typescript'), root: string, project?: string, files?: string[], extraFiles?: string[],
 *   libraryRoots?: string[], map?: object, mapFile?: string, write?: boolean, only?: string[], program?: import('typescript').Program }} options
 * @returns {{ files: { file: string, rewrites: number, text: string }[], manual: { file: string, line: number, column: number, reason: string, text: string }[], rewrites: number }}
 */
export function runCodemod({ typescript: ts, root, project, files = [], extraFiles = [], libraryRoots = [], map, mapFile = defaultMapFile, write = false, only, program }) {
  const renameMap = map ?? loadRenameMap(mapFile, Object.keys(transforms));
  const problems = validateRenameMap(renameMap, Object.keys(transforms));
  if (problems.length) throw new Error(`invalid rename map:\n${problems.join('\n')}`);
  const index = indexRenameMap(renameMap);
  const built = program ?? loadProgram(ts, { project, files, root, extraFiles });
  const checker = built.getTypeChecker();
  const library = createLibrary({ ts, checker, root, libraryRoots });
  const selected = only === undefined ? undefined : new Set(only.map(file => resolve(root, file)));
  const changed = [];
  const manual = [];
  let rewrites = 0;
  for (const sourceFile of built.getSourceFiles()) {
    const fileName = resolve(sourceFile.fileName);
    if (sourceFile.isDeclarationFile || fileName.includes('/node_modules/') || library.isLibraryFile(fileName)) continue;
    if (selected && !selected.has(fileName)) continue;
    const fileLabel = relative(root, fileName).replaceAll('\\', '/');
    let result;
    try {
      result = rewriteSourceFile({ ts, checker, sourceFile, library, index, transforms, manualItems: manual, fileLabel });
    } catch (error) {
      manual.push({ file: fileLabel, line: 1, column: 1, reason: `this file was left untouched: ${error.message}`, text: '' });
      continue;
    }
    if (result.text === sourceFile.text) continue;
    changed.push({ file: fileLabel, rewrites: result.rewrites, text: result.text });
    rewrites += result.rewrites;
    if (write) writeFileSync(fileName, result.text);
  }
  manual.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line || left.column - right.column);
  return { files: changed, manual, rewrites };
}
```

- [ ] **Step 16: Run the tests to verify they pass**

Run: `node --test tools/codemod/test/fixtures.test.mjs`
Expected: `pass 10`, `fail 0`: the type-check of all inputs, eight fixtures, and the stability check.

When a fixture fails, print what the engine produced and compare it with the expected file:

```bash
node -e "import('./tools/codemod/test/helpers.mjs').then(h => { const r = h.runFixture('properties'); console.log(r.text); console.log(r.manual); })"
```

A difference is a transcription error in `lib/rewrite.mjs` or in the fixture, not a reason to edit `expected.ts`.

- [ ] **Step 17: Commit**

```bash
git add tools/codemod
git ls-files tools/codemod/test/fixtures/node_modules | wc -l
git commit -F - <<'MSG'
feat(codemod): type-aware engine with generic transforms

One pass over the original program, recursive text assembly, library
detection by declaration file, owners by enclosing declaration. Fixtures
type-check against the vendored published di-bag 0.4.0 declarations.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

Expected from `git ls-files … | wc -l`: `38` (36 declarations, `package.json`, `LICENSE`). If it prints `0`, a global ignore rule matched; run `git add -f tools/codemod/test/fixtures/node_modules` and check again before committing.

---

### Task 4: Custom transforms and the `buildAndStart` transform

**Files:**
- Create: `tools/codemod/lib/transforms/build-and-start.mjs`
- Modify: `tools/codemod/lib/transforms/index.mjs` (replace the empty registry)
- Create: `tools/codemod/test/fixtures/build-and-start/input.ts`, `expected.ts`, `expected-manual.json` (no `map.json`: this fixture runs the shipped map)
- Test: `tools/codemod/test/transforms.test.mjs`, and the fixture loop of `tools/codemod/test/fixtures.test.mjs`

**Interfaces:**
- Consumes: the transform API from Task 3 and the shipped map from Task 2.
- Produces: the contract every later custom transform follows. A transform is `export default function (call, api)`; it returns the text of the whole rewritten call without leading trivia, or `undefined` after calling `api.manual(node, reason)`, and then the call stays untouched. It is registered under an id in `lib/transforms/index.mjs` and named by a `methods` entry through `"transform": "<id>"`. It emits no API name as a string literal: `api.nameOf(owner, oldName)` answers from the map, including the transform's own new name, which is its entry's `to`. It builds its result with `api.assemble(call, replacements)`, so arguments it does not touch are still rewritten by the engine.

The rewrite, from the spec's rename map and "Behavior changes": `builder.buildAndStart(keys, options)` becomes `builder.build().ensureServicesReady(keys, options)`. In the options, `signal` becomes `abortSignal` and `timeoutMs` becomes `totalTimeoutMs`. `startupOrder: 'parallel'` is the new default and is dropped; `'sequential'` becomes `maxConcurrentServiceKeys: 1`; a number literal becomes `maxConcurrentServiceKeys: <number>`. A `startupOrder` that is not a literal, or a spread, is a manual item and the call is left untouched. Options that are not an object literal are passed through and reported, because the call itself is decidable. An options bag that becomes empty disappears with its comma.

- [ ] **Step 1: Write the fixture**

`tools/codemod/test/fixtures/build-and-start/input.ts`:

```ts
import { DiBag, DiBagCloseCancelledError, DiBagStartupCancelledError, DiBagStartupError } from 'di-bag';
import type { StartupOptions } from 'di-bag';

const builder = DiBag.createBuilder().register({
  db: async () => ({ ping: () => true }),
  cache: () => new Map<string, string>(),
});

export async function start(shutdown: AbortSignal, passedOptions: StartupOptions, order: 'parallel' | 'sequential') {
  const plain = await builder.buildAndStart(['db']);
  const sequential = await builder.buildAndStart(['db', 'cache'], { signal: shutdown, timeoutMs: 5_000, startupOrder: 'sequential' });
  const signal = shutdown;
  const bounded = await builder.buildAndStart(['db'], { signal, startupOrder: 4 });
  const parallel = await builder.buildAndStart(['db'], { startupOrder: 'parallel' });
  const mixed = await builder.buildAndStart(['db'], { startupOrder: 'parallel', timeoutMs: 1_000 });
  const passed = await builder.buildAndStart(['db'], passedOptions);
  const unknownOrder = await builder.buildAndStart(['db'], { startupOrder: order });
  const chained = await DiBag.createBuilder()
    .register({ value: () => 1 })
    .buildAndStart(['value'], {
      timeoutMs: 2_000,
    });
  await plain.close({ signal: shutdown, timeoutMs: 10_000 });
  return [sequential, bounded, parallel, mixed, passed, unknownOrder, chained];
}

export const typed: StartupOptions = { timeoutMs: 100, startupOrder: 'sequential' };

export function report(error: unknown): unknown {
  if (error instanceof DiBagCloseCancelledError) return [error.details.pending, error.details.acquiring, error.details.timeoutMs, error.cleanupPromise];
  if (error instanceof DiBagStartupCancelledError) return error.cleanupPromise;
  if (error instanceof DiBagStartupError && error.code === 'DI_BAG_STARTUP_FAILED') return [error.cleanupFailures, error.cleanupError];
  return /DI_BAG_STARTUP_TIMEOUT/.test(String(error));
}
```

`tools/codemod/test/fixtures/build-and-start/expected.ts`. `unknownOrder` is untouched on purpose. `typed` shows the `properties` entries reaching an object literal through its contextual type. The regular expression in the last line is untouched and reported.

```ts
import { DiBag, DiBagCloseCancelledError, DiBagServiceReadinessCancelledError, DiBagServiceReadinessError } from 'di-bag';
import type { EnsureServicesReadyOptions } from 'di-bag';

const builder = DiBag.createBuilder().register({
  db: async () => ({ ping: () => true }),
  cache: () => new Map<string, string>(),
});

export async function start(shutdown: AbortSignal, passedOptions: EnsureServicesReadyOptions, order: 'parallel' | 'sequential') {
  const plain = await builder.build().ensureServicesReady(['db']);
  const sequential = await builder.build().ensureServicesReady(['db', 'cache'], { abortSignal: shutdown, totalTimeoutMs: 5_000, maxConcurrentServiceKeys: 1 });
  const signal = shutdown;
  const bounded = await builder.build().ensureServicesReady(['db'], { abortSignal: signal, maxConcurrentServiceKeys: 4 });
  const parallel = await builder.build().ensureServicesReady(['db']);
  const mixed = await builder.build().ensureServicesReady(['db'], { totalTimeoutMs: 1_000 });
  const passed = await builder.build().ensureServicesReady(['db'], passedOptions);
  const unknownOrder = await builder.buildAndStart(['db'], { startupOrder: order });
  const chained = await DiBag.createBuilder()
    .register({ value: () => 1 })
    .build()
    .ensureServicesReady(['value'], {
      totalTimeoutMs: 2_000,
    });
  await plain.close({ abortSignal: shutdown, waitTimeoutMs: 10_000 });
  return [sequential, bounded, parallel, mixed, passed, unknownOrder, chained];
}

export const typed: EnsureServicesReadyOptions = { totalTimeoutMs: 100, startupOrder: 'sequential' };

export function report(error: unknown): unknown {
  if (error instanceof DiBagCloseCancelledError) return [error.details.disposersStillRunning, error.details.acquisitionsStillPending, error.details.waitTimeoutMs, error.cleanupPromise];
  if (error instanceof DiBagServiceReadinessCancelledError) return error.disposalPromise;
  if (error instanceof DiBagServiceReadinessError && error.code === 'DI_BAG_SERVICE_READINESS_FAILED') return [error.disposalFailures, error.disposalError];
  return /DI_BAG_STARTUP_TIMEOUT/.test(String(error));
}
```

`tools/codemod/test/fixtures/build-and-start/expected-manual.json`:

```json
[
  {
    "line": 16,
    "reason": "these options are not an object literal; where they are built, rename signal to abortSignal, timeoutMs to totalTimeoutMs, and replace startupOrder with maxConcurrentServiceKeys"
  },
  {
    "line": 17,
    "reason": "startupOrder is not a literal; use maxConcurrentServiceKeys: omit it for 'parallel', 1 for 'sequential', or the number"
  },
  {
    "line": 27,
    "reason": "startupOrder is gone; use maxConcurrentServiceKeys: omit it for 'parallel', 1 for 'sequential', or the number"
  },
  {
    "line": 34,
    "reason": "DI_BAG_STARTUP_TIMEOUT appears outside a plain string; replace it with DI_BAG_SERVICE_READINESS_TIMEOUT by hand"
  }
]
```

- [ ] **Step 2: Write the failing test**

Create `tools/codemod/test/transforms.test.mjs`:

```js
// tools/codemod/test/transforms.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { defaultMapFile, runCodemod, transforms, validateRenameMap } from '../lib/codemod.mjs';
import { compiler, fixturesProgram, fixturesRoot } from './helpers.mjs';

test('every transform the shipped map names exists in the registry', () => {
  const shipped = JSON.parse(readFileSync(defaultMapFile, 'utf8'));
  assert.deepEqual(validateRenameMap(shipped, Object.keys(transforms)), []);
  assert.deepEqual(Object.keys(transforms), ['build-and-start']);
});

test('a map that names an unknown transform is refused before any file is read', () => {
  const map = { version: 1, methods: [{ owner: 'Builder', from: 'build', to: 'buildContainer', transform: 'absent' }] };
  assert.throws(() => runCodemod({ typescript: compiler.ts, root: fixturesRoot, program: fixturesProgram(), map }), /unknown transform absent/);
});

test('a transform asks the map for the names it emits', () => {
  // The same input with a map that also renames `build`: the transform follows without being edited.
  const shipped = JSON.parse(readFileSync(defaultMapFile, 'utf8'));
  const map = { ...shipped, methods: [...shipped.methods, { owner: 'Builder', from: 'build', to: 'buildContainer' }] };
  const result = runCodemod({ typescript: compiler.ts, root: fixturesRoot, program: fixturesProgram(), only: ['build-and-start/input.ts'], map });
  assert.match(result.files[0].text, /builder\.buildContainer\(\)\.ensureServicesReady\(\['db'\]\);/);
  assert.doesNotMatch(result.files[0].text, /\.build\(\)/);
});
```

- [ ] **Step 3: Run the tests to make sure they fail**

Run: `node --test tools/codemod/test/fixtures.test.mjs tools/codemod/test/transforms.test.mjs`
Expected: FAIL. The `build-and-start` fixture and two tests of `transforms.test.mjs` fail with `unknown transform build-and-start`, because the shipped map names a transform the registry does not have yet.

- [ ] **Step 4: Implement the transform**

Create `tools/codemod/lib/transforms/build-and-start.mjs`:

```js
// tools/codemod/lib/transforms/build-and-start.mjs

/**
 * `builder.buildAndStart(keys, options)` becomes `builder.build().ensureServicesReady(keys, options)`.
 * `signal` and `timeoutMs` are renamed. `startupOrder` becomes `maxConcurrentServiceKeys`:
 * 'parallel' is the new default and is dropped, 'sequential' is 1, a number stays that number.
 * The name of `build` comes from the map, so a later rename of `build` needs no change here.
 * @returns {string | undefined} the new call, or undefined after reporting why it was left alone.
 */
export default function buildAndStart(call, api) {
  const { ts } = api;
  const callee = call.expression;
  const [keys, options, ...rest] = call.arguments;
  if (keys === undefined || rest.length > 0) {
    api.manual(call, 'buildAndStart is called with an unexpected number of arguments; rewrite it to build().ensureServicesReady(serviceKeys, options) by hand');
    return undefined;
  }
  // `.` or, in a multi-line chain, the line break and indentation before the dot.
  const separator = api.slice(callee.expression.end, api.start(callee.name));
  const replacements = [{
    start: api.start(callee.name), end: callee.name.end,
    text: `${api.nameOf('Builder', 'build')}()${separator}${api.nameOf('Builder', 'buildAndStart')}`,
  }];
  if (options === undefined) return api.assemble(call, replacements);
  if (!ts.isObjectLiteralExpression(options)) {
    api.manual(options, 'these options are not an object literal; where they are built, rename signal to abortSignal, timeoutMs to totalTimeoutMs, and replace startupOrder with maxConcurrentServiceKeys');
    return api.assemble(call, replacements);
  }
  const bag = api.objectLiteral(options, {
    rename: key => ({ signal: 'abortSignal', timeoutMs: 'totalTimeoutMs' })[key],
    spreadReason: 'options are spread here; rename signal, timeoutMs and startupOrder where that object is built',
    replace: {
      startupOrder(property) {
        const value = ts.isPropertyAssignment(property) ? property.initializer : undefined;
        if (value && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))) {
          if (value.text === 'parallel') return null;
          if (value.text === 'sequential') return 'maxConcurrentServiceKeys: 1';
        }
        if (value && ts.isNumericLiteral(value)) return `maxConcurrentServiceKeys: ${value.text}`;
        api.manual(property, "startupOrder is not a literal; use maxConcurrentServiceKeys: omit it for 'parallel', 1 for 'sequential', or the number");
        return undefined;
      },
    },
  });
  if (bag === undefined) return undefined;
  // An options bag that only said `startupOrder: 'parallel'` disappears together with its comma.
  replacements.push(bag.remaining === 0
    ? { start: keys.end, end: options.end, text: '' }
    : { start: api.start(options), end: options.end, text: bag.text });
  return api.assemble(call, replacements);
}
```

- [ ] **Step 5: Register it**

Replace the whole content of `tools/codemod/lib/transforms/index.mjs`:

```js
// tools/codemod/lib/transforms/index.mjs
import buildAndStart from './build-and-start.mjs';

/**
 * Custom transforms by id. A `methods` entry names one with `"transform": "<id>"`.
 * A transform receives `(call, api)` and returns the text of the whole rewritten call,
 * or `undefined` after calling `api.manual(node, reason)`; the call is then left untouched.
 * It asks `api.nameOf(owner, oldName)` for every API name it emits, except its own new name
 * when that is the entry's `to`, which `nameOf` also answers.
 */
export const transforms = {
  'build-and-start': buildAndStart,
};
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test tools/codemod/test/fixtures.test.mjs tools/codemod/test/transforms.test.mjs`
Expected: `pass 14`, `fail 0`: eleven from the fixtures file, three from the transforms file.

- [ ] **Step 7: Commit**

```bash
git add tools/codemod
git commit -F - <<'MSG'
feat(codemod): custom transforms and the buildAndStart rewrite

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

---

### Task 5: The command line

**Files:**
- Create: `tools/codemod/cli.mjs` (executable)
- Test: `tools/codemod/test/cli.test.mjs`

**Interfaces:**
- Consumes: `loadTypeScript`, `runCodemod` from `lib/codemod.mjs`; the fixture projects of Tasks 1, 3 and 4.
- Produces: `di-bag-codemod [--project tsconfig.json | file.ts ...] [--library-root dir]... [--extra-files glob]... [--map rename-map.json] [--write] [--report report.json]`. Output: one line `rewrote <file>: <n> rewrites` or `would rewrite …` per file; one entry `manual <file>:<line>:<column> <reason>` per manual item with the source line indented below it; a last line `<n> files, <n> rewrites, <n> manual items[ (dry run; pass --write to apply)] (TypeScript <version>, project|bundled)`. The report is `{ version: 1, written: boolean, files: { file, rewrites }[], manual: { file, line, column, reason, text }[] }`. Exit `0` when the run finished, `2` for a usage, tsconfig or map error. Manual items do not change the exit code: they are expected.

- [ ] **Step 1: Write the failing test**

Create `tools/codemod/test/cli.test.mjs`. Every test copies a fixture project to a temporary directory, so `--write` never touches the repository.

```js
// tools/codemod/test/cli.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const packageRoot = resolve(import.meta.dirname, '..');
const cli = join(packageRoot, 'cli.mjs');
const run = (cwd, ...args) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });

/** A private copy of a fixture project, so `--write` never touches the repository. */
function copyOf(directory) {
  const target = mkdtempSync(join(tmpdir(), 'di-bag-codemod-'));
  cpSync(join(import.meta.dirname, directory), target, { recursive: true });
  return target;
}

test('a dry run reports what it would rewrite and writes nothing', () => {
  const project = copyOf('fixtures');
  const before = readFileSync(join(project, 'build-and-start/input.ts'), 'utf8');
  const result = run(project, '--project', 'tsconfig.json');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /would rewrite build-and-start\/input\.ts: \d+ rewrites/);
  assert.match(result.stdout, /manual build-and-start\/input\.ts:17:\d+ startupOrder is not a literal/);
  assert.match(result.stdout, /\d+ files, \d+ rewrites, \d+ manual items \(dry run; pass --write to apply\) \(TypeScript \d+\.\d+\.\d+, (project|bundled)\)\n$/);
  assert.equal(readFileSync(join(project, 'build-and-start/input.ts'), 'utf8'), before);
  rmSync(project, { recursive: true, force: true });
});

test('--write applies the shipped map and --report lists files and manual items', () => {
  const project = copyOf('fixtures');
  const report = join(project, 'report.json');
  const result = run(project, '--write', '--report', report);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /rewrote build-and-start\/input\.ts/);
  assert.equal(readFileSync(join(project, 'build-and-start/input.ts'), 'utf8'), readFileSync(join(project, 'build-and-start/expected.ts'), 'utf8'));
  const written = JSON.parse(readFileSync(report, 'utf8'));
  assert.equal(written.version, 1);
  assert.equal(written.written, true);
  assert.ok(written.files.some(entry => entry.file === 'build-and-start/input.ts' && entry.rewrites > 0));
  assert.ok(written.manual.every(item => typeof item.file === 'string' && typeof item.line === 'number' && typeof item.reason === 'string'));
  rmSync(project, { recursive: true, force: true });
});

test('--map selects another rename map', () => {
  const project = copyOf('fixtures');
  const result = run(project, '--map', 'array-argument/map.json', '--write');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(project, 'array-argument/input.ts'), 'utf8'), readFileSync(join(project, 'array-argument/expected.ts'), 'utf8'));
  rmSync(project, { recursive: true, force: true });
});

test('without --library-root only node_modules/di-bag counts as the library', () => {
  const project = copyOf('library-root-fixture');
  const result = run(project, '--project', 'tsconfig.json');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^0 files, 0 rewrites, 0 manual items/m);
  rmSync(project, { recursive: true, force: true });
});

test('--library-root rewrites callers of a checked-out library and never the library itself', () => {
  const project = copyOf('library-root-fixture');
  const library = readFileSync(join(project, 'src/index.ts'), 'utf8');
  const result = run(project, '--project', 'tsconfig.json', '--library-root', 'src', '--write');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(project, 'src/index.ts'), 'utf8'), library);
  assert.equal(readFileSync(join(project, 'app/main.ts'), 'utf8'), [
    "import { Builder } from '../src/index.js';",
    '',
    'export async function main(signal: AbortSignal) {',
    "  const bag = await new Builder().build().ensureServicesReady(['db'], { abortSignal: signal, totalTimeoutMs: 5 });",
    '  await bag.close({ waitTimeoutMs: 10 });',
    '}',
    '',
  ].join('\n'));
  assert.match(readFileSync(join(project, 'app/excluded/extra.ts'), 'utf8'), /buildAndStart/);
  rmSync(project, { recursive: true, force: true });
});

test('--extra-files adds files the tsconfig excludes', () => {
  const project = copyOf('library-root-fixture');
  const result = run(project, '--project', 'tsconfig.json', '--library-root', 'src', '--extra-files', 'app/excluded/*.ts', '--write');
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(join(project, 'app/excluded/extra.ts'), 'utf8'), /new Builder\(\)\.build\(\)\.ensureServicesReady\(\['db'\]\)/);
  rmSync(project, { recursive: true, force: true });
});

test('usage errors exit 2', () => {
  const project = copyOf('library-root-fixture');
  assert.equal(run(project, '--projct', 'x').status, 2);
  assert.equal(run(project, '--project').status, 2);
  const missing = run(project, '--project', 'missing.json');
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /missing\.json/);
  const badMap = run(project, '--map', 'package.json');
  assert.equal(badMap.status, 2);
  assert.match(badMap.stderr, /invalid rename map/);
  rmSync(project, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test tools/codemod/test/cli.test.mjs`
Expected: FAIL, every test, because `cli.mjs` does not exist (`Cannot find module`, exit status 1).

- [ ] **Step 3: Implement the command line**

Create `tools/codemod/cli.mjs`:

```js
#!/usr/bin/env node
// tools/codemod/cli.mjs
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadTypeScript, runCodemod } from './lib/codemod.mjs';

const usage = 'usage: di-bag-codemod [--project tsconfig.json | file.ts ...] [--library-root dir]... [--extra-files glob]... [--map rename-map.json] [--write] [--report report.json]';
const args = process.argv.slice(2);
const files = [];
const extraFiles = [];
const libraryRoots = [];
let project, mapFile, report, write = false;
const value = index => {
  if (args[index] === undefined || args[index].startsWith('-')) fail(`${args[index - 1]} needs a value`);
  return args[index];
};
for (let index = 0; index < args.length; index++) {
  const argument = args[index];
  if (argument === '--project') project = value(++index);
  else if (argument === '--library-root') libraryRoots.push(value(++index));
  else if (argument === '--extra-files') extraFiles.push(value(++index));
  else if (argument === '--map') mapFile = value(++index);
  else if (argument === '--report') report = value(++index);
  else if (argument === '--write') write = true;
  else if (argument === '--help' || argument === '-h') { console.log(usage); process.exit(0); }
  else if (argument.startsWith('-')) fail(`unknown option ${argument}`);
  else files.push(argument);
}
if (!project && files.length === 0) {
  if (!existsSync('tsconfig.json')) fail('no tsconfig.json in the current directory; pass --project or files');
  project = 'tsconfig.json';
}

function fail(message) {
  console.error(`di-bag-codemod: ${message}\n${usage}`);
  process.exit(2);
}

const root = process.cwd();
const compiler = loadTypeScript(project ? dirname(resolve(root, project)) : root);
let result;
try {
  result = runCodemod({ typescript: compiler.ts, root, project, files, extraFiles, libraryRoots, write, ...(mapFile ? { mapFile: resolve(root, mapFile) } : {}) });
} catch (error) {
  fail(error.message);
}
if (report) writeFileSync(report, JSON.stringify({ version: 1, written: write, files: result.files.map(({ file, rewrites }) => ({ file, rewrites })), manual: result.manual }, null, 2) + '\n');
for (const file of result.files) console.log(`${write ? 'rewrote' : 'would rewrite'} ${file.file}: ${file.rewrites} rewrites`);
for (const item of result.manual) console.log(`manual ${item.file}:${item.line}:${item.column} ${item.reason}${item.text ? `\n       ${item.text}` : ''}`);
console.log(`${result.files.length} files, ${result.rewrites} rewrites, ${result.manual.length} manual items${write ? '' : ' (dry run; pass --write to apply)'} (TypeScript ${compiler.version}, ${compiler.source})`);
```

Make it executable, as `tools/graph/cli.mjs` is:

```bash
chmod +x tools/codemod/cli.mjs
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tools/codemod/test/cli.test.mjs`
Expected: `pass 7`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add tools/codemod
git commit -F - <<'MSG'
feat(codemod): command line with dry run, report, extra files and library roots

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

Check: `git ls-files -s tools/codemod/cli.mjs` starts with `100755`.

---

### Task 6: README, the packaging test, CI and the development guide

**Files:**
- Create: `tools/codemod/README.md`, `tools/codemod/test/pack.test.mjs`
- Modify: `.github/workflows/ci.yml`, `docs/guides/development.md`

**Interfaces:**
- Consumes: everything above.
- Produces: `npm run codemod:check` green in CI; an archive that contains only what `files` lists.

- [ ] **Step 1: Write the failing test**

Create `tools/codemod/test/pack.test.mjs`. `npm pack --dry-run` works on a private package.

```js
// tools/codemod/test/pack.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { test } from 'node:test';

const directory = resolve(import.meta.dirname, '..');

test('the package contains only the CLI, the library, the map, its schema and its documents', () => {
  const result = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: directory, encoding: 'utf8', env: { ...process.env, npm_config_update_notifier: 'false' },
  });
  assert.equal(result.status, 0, result.stderr);
  const [pack] = JSON.parse(result.stdout);
  assert.equal(pack.name, 'di-bag-codemod');
  assert.deepEqual(pack.files.map(file => file.path).sort(), [
    'LICENSE', 'README.md', 'cli.mjs',
    'lib/codemod.mjs', 'lib/glob.mjs', 'lib/library.mjs', 'lib/load-typescript.mjs', 'lib/rename-map.mjs', 'lib/rewrite.mjs',
    'lib/transforms/build-and-start.mjs', 'lib/transforms/index.mjs',
    'package.json', 'rename-map.json', 'rename-map.schema.json',
  ]);
  // npm marks bin targets executable in the archive.
  assert.equal(pack.files.find(file => file.path === 'cli.mjs').mode & 0o111, 0o111);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test tools/codemod/test/pack.test.mjs`
Expected: FAIL: the file list lacks `README.md`.

- [ ] **Step 3: Write the README**

Create `tools/codemod/README.md`:

````md
# di-bag-codemod

Moves code written for [DI Bag](https://github.com/dany-fedorov/di-bag) 0.4 to
the 0.5 API. It reads a TypeScript project and rewrites a call, a property, a
string value, a type reference or an import only when the TypeScript checker
resolves it to a DI Bag declaration. `text.replace(...)`, `Promise.all(...)` and
your own `register` method are never touched.

Run it **before** you upgrade, while `di-bag` 0.4 is still installed: every
decision reads the old types.

## Commands

```sh
npx di-bag-codemod                          # dry run over ./tsconfig.json
npx di-bag-codemod --write                  # apply
npx di-bag-codemod --project tsconfig.app.json --write --report codemod-report.json
```

Pass `--project <tsconfig>` or source files; without either, `./tsconfig.json`
is used. A run prints one line per file it rewrote, one entry per manual item,
and a summary:

```text
would rewrite src/app.ts: 3 rewrites
manual src/app.ts:41:52 startupOrder is not a literal; use maxConcurrentServiceKeys: omit it for 'parallel', 1 for 'sequential', or the number
       startupOrder: order
1 files, 3 rewrites, 1 manual items (dry run; pass --write to apply) (TypeScript 6.0.3, project)
```

| Option | Meaning |
| --- | --- |
| `--write` | Write the rewritten files. Without it nothing changes on disk. |
| `--report <file>` | Write the changed files and the manual items as JSON. |
| `--extra-files <glob>` | Add files the tsconfig excludes. Repeatable. `*`, `**` and `?` are supported. |
| `--library-root <dir>` | Treat declarations under this directory as DI Bag, instead of `node_modules/di-bag/`. Repeatable. For a checkout of DI Bag itself. |
| `--map <file>` | Use another rename map than the one in this package. |

Exit codes: `0` the run finished, with or without manual items; `2` usage,
tsconfig or rename map error.

## Manual items

The codemod never guesses. What it cannot decide from the types it leaves
unchanged and reports with file, line, column and the reason:

- options that are not an object literal, or that contain a spread;
- a string value that is not a literal;
- a method that is referenced or destructured without being called, when its
  arguments change shape;
- a call with a spread argument;
- a receiver of type `any`;
- a runtime code that was split into several, and any old code inside a regular
  expression, a template or a comment;
- a re-export of a renamed name, which keeps its old public name.

Fix these by hand, then run the compiler.

## The rename map

`rename-map.json` is data: it describes the distance from 0.4.0 to the current
API. `rename-map.schema.json` documents every field.

| Section | Rewrites |
| --- | --- |
| `methods` | a method name, its arguments into one options bag or an array, or a custom transform |
| `options` | a key of an object-literal argument, by argument position and path |
| `values` | a string at an argument path, or a string compared with or assigned to a library property |
| `properties` | a property of a library type: access, destructuring, and keys of object literals typed by it |
| `types` | an exported class, interface, type alias or error class, in imports and references |
| `codes` | a `DI_BAG_*` runtime code in a string |
| `imports` | a module specifier |

An owner is the declaration that holds the member: `Builder`, `Bag`,
`DiBagApi`, `StartupOptions`. A type written inline in a signature belongs to
that function, `fromFactory()`, or method, `Bag.createScope()`.

## Limits

It rewrites TypeScript and TSX files that belong to the program. It does not
read Markdown, generated source held in strings, or JavaScript without types.
It keeps your formatting and does not run a formatter. A project on TypeScript 7
is analyzed with the bundled TypeScript 6, because TypeScript 7 ships no
compatible compiler API.
````

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tools/codemod/test/pack.test.mjs`
Expected: `pass 1`, `fail 0`.

- [ ] **Step 5: Wire CI**

In `.github/workflows/ci.yml`, job `contracts`. Under `cache-dependency-path`, after the line `tools/graph/package-lock.json`, add with the same indentation:

```yaml
            tools/codemod/package-lock.json
```

Directly after the step `- run: npm run graph:check`, add:

```yaml
      - run: npm ci --prefix tools/codemod --no-audit --no-fund
      - run: npm run codemod:check
```

Do not add a packed smoke test. The package is private until phase 13, which adds one next to the graph tool's.

- [ ] **Step 6: Mention it in the development guide**

In `docs/guides/development.md`, after the paragraph that starts with `` `npm run graph:check` tests the standalone `` and before the code block that follows it, add this paragraph:

```md
`npm run codemod:check` tests the standalone `di-bag-codemod` tool in
`tools/codemod` (`npm ci --prefix tools/codemod` first). Its fixtures type-check
against the published 0.4.0 declarations, vendored under
`tools/codemod/test/fixtures/node_modules/di-bag`; do not edit them.
```

- [ ] **Step 7: Run the whole tool suite**

Run: `npm run codemod:check`
Expected: `tests 31`, `pass 31`, `fail 0`.

Run: `npm run docs:check`
Expected: it ends with `Prepared … Markdown pages; repository-only links point to GitHub.` and exit 0.

- [ ] **Step 8: Commit**

```bash
git add tools/codemod .github/workflows/ci.yml docs/guides/development.md
git commit -F - <<'MSG'
feat(codemod): README, packaging test, CI step and development guide entry

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

---

### Task 7: Dry run over this repository, and the phase gate

**Files:**
- No file changes. This task produces the numbers for the phase report.

**Interfaces:**
- Consumes: the finished tool.
- Produces: evidence that the engine reads this repository the way phase 3 will run it.

- [ ] **Step 1: Build, so that `di-bag` imports resolve**

Seven files import `di-bag` by name, which resolves to `dist/index.d.ts`.

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 2: Dry run with both library roots and the excluded negative fixtures**

```bash
node tools/codemod/cli.mjs --project tsconfig.json --library-root src --library-root dist \
  --extra-files 'tests/types/negative/*.ts' --report /tmp/di-bag-codemod-dry-run.json | tail -3
git status --short
```

Expected: the last line reads about `20 files, 121 rewrites, 26 manual items (dry run; pass --write to apply) (TypeScript 6.0.x, project|bundled)`; the counts were measured on the 0.4.0 source and may move by a few. `git status --short` prints nothing: a dry run writes no file. The run takes under 30 seconds.

- [ ] **Step 3: Check that no file was skipped and that the manual items are the expected kinds**

```bash
node -e "
const report = require('/tmp/di-bag-codemod-dry-run.json');
const kinds = {};
for (const item of report.manual) { const kind = item.reason.slice(0, 40); kinds[kind] = (kinds[kind] ?? 0) + 1; }
console.log(kinds);
console.log('skipped files:', report.manual.filter(item => item.reason.startsWith('this file was left untouched')).length);
"
```

Expected: `skipped files: 0`. The kinds are: options that are not an object literal, a non-literal argument of `close`, a receiver of type `any` for `buildAndStart`, `startupOrder` that is not a literal, `buildAndStart` referenced without a call, a spread, an unexpected argument count in `tests/types/negative/startup.ts`, and two old codes outside plain strings. Anything else, investigate before finishing. A `skipped files` count above 0 is an engine bug: the reason names the file and the offset; fix it and add a fixture that reproduces it.

- [ ] **Step 4: Run the full gate**

Run each and keep the last lines for the report: `npm run check`, `npm run docs:check`, `npm run graph:check`, `npm run codemod:check`, `npm run typecheck:native`, `npm run build:native`, `npm run check:native`, and `for example in examples/*.ts; do bun run "$example" || break; done`.
Expected: all exit 0. This phase changed no library code, so a failure here points at the environment (see the master plan's "Environment") or at the edits to `package.json`, `.gitignore`, `ci.yml` or `development.md`.

- [ ] **Step 5: Report**

Reply to the controller as the master plan's protocol step 9 asks: branch `phase-01-codemod-foundation`, `git log --oneline next..HEAD`, the gate results, the dry-run summary line and the manual kinds, and any deviation with its reason. There is no spike in this phase.

---

## Self-Review

**Spec coverage.** Spec "Migration support": a type-aware codemod that uses the TypeScript compiler API as `tools/graph` does (Tasks 1, 3); rewrites only calls whose receiver is a DI Bag declaration and leaves `String.replace`, `Promise.all`, `Promise.resolve` alone (Task 3, fixture `untouched`); reshapes arguments such as `alias(a, b)` (Task 3, fixture `arguments-to-bag`); ships as the package `di-bag-codemod` next to `di-bag-graph` (Tasks 1, 6; publishing is phase 13); `rename-map.json` as the single source (Task 2). Master plan contract: CLI flags (Task 5), type-awareness and single pass with recursive assembly (Task 3), the seven map sections and owners (Task 2), `api.nameOf` and fixture pairs per transform (Tasks 3, 4, test "a transform asks the map for the names it emits"), the distance from 0.4.0 (rules under "The rename map, field by field"), manual items never guessed (every fixture's `expected-manual.json`). Controller's scope list: owner detection for facade members, `this`-typed overloads and the `contribute` property (fixture `method-rename`, and the probe recorded in Task 7); every generic transform of item 2 (fixtures of Task 3); the custom-transform mechanism with `buildAndStart` (Task 4); fixtures against the published 0.4.0 declarations with the vendoring commands (Task 3 Step 1); negative fixtures (fixture `untouched`); root wiring, CI, README, LICENSE, `package.json` (Tasks 1, 6); the schema (Task 2). Not in this phase by design: throwing stubs, the generated negative fixture and migration guide, publishing (phase 13); the repository's own migration (each later phase).

**Placeholder scan.** No step defers content. Every file is given in full.

**Type consistency.** `libraryRoots` (array) is the option name in `createLibrary`, `runCodemod` and the CLI. The index members that `lib/rewrite.mjs` reads (`callNames`, `methodNames`, `memberNames`, `propertyNames`, `valuePropertyNames`, `propertyValueTexts`, `methodFor`, `optionsFor`, `valuesFor`, `hasArgumentEntries`, `hasEntriesBelow`, `describeArgumentEntries`, `nameOf`, `properties`, `propertyValues`, `codes`, `types`, `imports`) are all defined in `lib/rename-map.mjs`. The transform API members that `build-and-start.mjs` uses (`ts`, `manual`, `slice`, `start`, `nameOf`, `assemble`, `objectLiteral`) are all in `transformApi`. Test counts: glob 2, rename-map 7, fixtures 11, transforms 3, cli 7, pack 1, total 31.

**Verified by prototype.** All code in this plan was run in a scratch directory against the vendored 0.4.0 declarations (31 of 31 tests pass) and, in dry-run mode, against this repository at the 0.4.0 source with `--library-root src --library-root dist` (20 files, 121 rewrites, 26 manual items, no skipped file, 6 seconds). A second probe map confirmed owner detection in source form for `DiBagApi.withDisposal`, the `Builder.contribute` property, the `this`-typed `Bag.fork`, `token().of` and the parameter property `Token.key` (125 files, 719 rewrites, no skipped file).
