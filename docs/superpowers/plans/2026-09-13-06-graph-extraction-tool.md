# Static Dependency Graph Extraction Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tool that reads a TypeScript project, finds every DI Bag builder chain, and writes a JSON dependency graph with declared named dependencies, module exports and installations, lifetimes, async outputs, cycles, and unresolved names, so agents and CI can see the graph without running the application.

**Architecture:** A standalone package `di-bag-graph` in `tools/graph` (like `tools/docs`), written as plain ES modules, depending on `typescript`. It is not part of the published `di-bag` package because the release contract requires zero peer dependencies (`scripts/verify-release-artifacts.ts` line 120). The extractor walks each source file for builder chains (`DiBag.createBuilder()` ... `build()` / `buildAndStart()` / `buildModule()`), follows identifiers to partial builders, and uses the type checker to read each factory's first parameter properties as declared dependencies. A CLI wraps it.

**Tech Stack:** Node 24 ES modules, TypeScript compiler API, `node --test`.

**Spec:** `docs/superpowers/specs/2026-09-13-agentic-scale-hardening.md` (decision D2, static half)

**Verified on 2026-09-13:** a 40-line prototype of the checker walk produced correct keys, line numbers, dependency names, and async flags for `examples/modules.ts`.

## Global Constraints

- `di-bag` itself keeps zero runtime, peer, optional, and bundled dependencies; the tool lives in `tools/graph` with its own `package.json` and lockfile and is excluded from the root package (`files: ["dist"]` already excludes it).
- The tool must handle split builder chains (`const partial = DiBag.createBuilder().register(...)` then `partial.register(...).build()`), as used in `docs/guides/agent-harnesses-and-graphs.md`.
- Output is deterministic: units and nodes in source order, edges sorted.
- `npm run check` and the new `npm run graph:check` pass before every commit.
- Commit prefixes: `feat:`, `fix:`, `test:`, `docs:`, `chore:`.

---

### Task 1: Package scaffold and the chain walker

**Files:**
- Create: `tools/graph/package.json`, `tools/graph/lib/extract.mjs`
- Create: `tools/graph/test/fixtures/split-builder.ts`
- Test: `tools/graph/test/extract.test.mjs`
- Modify: `package.json` (root; add `graph:check` script)
- Modify: `.gitignore` (add `/tools/graph/node_modules/`)

**Interfaces:**
- Produces: `extractDependencyGraph({ project?, files?, root? }) => { version: 1, units: Unit[], issues: Issue[] }` where
  `Unit = { id: string; kind: 'bag' | 'module'; file: string; line: number; exports: string[]; installs: string[]; requirements?: string[]; nodes: Node[]; edges: { from: string; to: string }[] }` (`requirements` only on modules: names no registration or installed export supplies),
  `Node = { key: string; line: number; dependencies: string[]; async: boolean; lifetime: 'root' | 'scoped' | 'transient'; owned: boolean }`,
  `Issue = { kind: 'cycle'; unit: string; path: string[] } | { kind: 'unresolved'; unit: string; consumer: string; dependency: string }`.

- [ ] **Step 1: Create the package files**

```json
// tools/graph/package.json
{
  "name": "di-bag-graph",
  "version": "0.1.0",
  "private": true,
  "description": "Extract a static dependency graph from DI Bag builder chains.",
  "type": "module",
  "bin": { "di-bag-graph": "./cli.mjs" },
  "exports": { ".": "./lib/extract.mjs" },
  "scripts": { "test": "node --test test/*.test.mjs" },
  "dependencies": { "typescript": "npm:@typescript/typescript6@6.0.2" }
}
```

Run: `cd tools/graph && npm install --no-audit --no-fund && cd ../..`
Expected: `tools/graph/package-lock.json` and `tools/graph/node_modules` created. Add `/tools/graph/node_modules/` to `.gitignore` under the "Documentation dependencies" block.

- [ ] **Step 2: Write the failing test and fixture**

```ts
// tools/graph/test/fixtures/split-builder.ts
import { DiBag } from '../../../../src/node';
type Search = { find(query: string): Promise<readonly string[]> };
const retrievalModule = DiBag.createBuilder().register({
  normalize: () => (question: string) => question.trim(),
  retrieve: ({ search, normalize }: { search: Search; normalize: (question: string) => string }) => async (question: string) => search.find(normalize(question)),
}).buildModule(['retrieve']);
const incomplete = DiBag.createBuilder()
  .installModule(retrievalModule)
  .register({
    search: (): Search => ({ find: async () => [] }),
    run: ({ retrieve }: { retrieve: (question: string) => Promise<readonly string[]> }) => retrieve,
  });
export const app = incomplete.register({
  db: DiBag.withLifetime(DiBag.withDisposal(async ({ search }: { search: Search }) => search, () => {}), 'root'),
}).build();
// A bag with a dependency cycle and an unregistered name. The cycle is not a type error; the
// missing name is, and the extractor does not require the fixture to type-check.
// @ts-expect-error missing is not registered
export const cyclic = DiBag.createBuilder().register({
  a: ({ b }: { b: number }) => b + 1,
  b: ({ a }: { a: number }) => a + 1,
  lonely: ({ missing }: { missing: string }) => missing,
}).build();
```

```js
// tools/graph/test/extract.test.mjs
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { extractDependencyGraph } from '../lib/extract.mjs';

const root = resolve(import.meta.dirname, '../../..');
const fixture = resolve(root, 'tools/graph/test/fixtures/split-builder.ts');
const graph = extractDependencyGraph({ files: [fixture], root });
const unit = id => graph.units.find(candidate => candidate.id === id);

test('every builder chain becomes a unit in source order with its kind and exports', () => {
  assert.deepEqual(graph.units.map(candidate => [candidate.kind, candidate.exports]), [
    ['module', ['retrieve']], ['bag', []], ['bag', []],
  ]);
  assert.equal(graph.units[0].file, 'tools/graph/test/fixtures/split-builder.ts');
  assert.equal(graph.units[0].line, 4);
  assert.equal(graph.units[2].line, 20);
  assert.deepEqual(graph.units[0].requirements, ['search']);
  assert.equal(graph.units[1].requirements, undefined);
});

test('a chain continued from a partial builder collects every registration', () => {
  const app = graph.units[1];
  assert.deepEqual(app.nodes.map(node => node.key), ['search', 'run', 'db']);
  assert.deepEqual(app.installs, [graph.units[0].id]);
  const db = app.nodes.find(node => node.key === 'db');
  assert.deepEqual(db, { key: 'db', line: 15, dependencies: ['search'], async: true, lifetime: 'root', owned: true });
  assert.deepEqual(app.edges, [{ from: 'db', to: 'search' }, { from: 'run', to: 'retrieve' }]);
});

test('declared dependencies come from the factory parameter type', () => {
  const retrieve = graph.units[0].nodes.find(node => node.key === 'retrieve');
  assert.deepEqual(retrieve.dependencies, ['search', 'normalize']);
  assert.equal(retrieve.async, false);
  assert.equal(retrieve.lifetime, 'scoped');
});

test('cycles and unresolved names are reported as issues', () => {
  const cyclic = graph.units[2];
  assert.deepEqual(graph.issues.filter(issue => issue.unit === cyclic.id), [
    { kind: 'cycle', unit: cyclic.id, path: ['a', 'b', 'a'] },
    { kind: 'unresolved', unit: cyclic.id, consumer: 'lonely', dependency: 'missing' },
  ]);
  // `run` depends on `retrieve`, which an installed module exports: resolved, not an issue.
  assert.equal(graph.issues.some(issue => issue.unit === graph.units[1].id), false);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test tools/graph/test/*.test.mjs`
Expected: FAIL: cannot find module `../lib/extract.mjs`.

- [ ] **Step 4: Write the extractor**

```js
// tools/graph/lib/extract.mjs
import { relative, resolve } from 'node:path';
import ts from 'typescript';

const TERMINALS = new Set(['build', 'buildAndStart', 'buildModule']);
const WRAPPERS = new Set(['withLifetime', 'withDisposal', 'withMetadata', 'transformService']);

const defaultOptions = {
  strict: true, noEmit: true, skipLibCheck: true, types: [],
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
};

function loadProgram({ project, files, root }) {
  if (project) {
    const config = ts.getParsedCommandLineOfConfigFile(resolve(root, project), {}, {
      ...ts.sys, onUnRecoverableConfigFileDiagnostic: diagnostic => { throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')); },
    });
    return ts.createProgram(config.fileNames, { ...config.options, noEmit: true });
  }
  return ts.createProgram(files.map(file => resolve(root, file)), defaultOptions);
}

/** The property-access method name of a call such as `x.register(...)`, or undefined. */
function methodName(call) {
  return ts.isPropertyAccessExpression(call.expression) ? call.expression.name.text : undefined;
}

/** Walk a fluent chain downward, following identifiers to the partial builders they name. */
function chainCalls(call, checker, seen = new Set()) {
  const calls = [];
  let current = call;
  while (current) {
    if (ts.isCallExpression(current)) {
      calls.push(current);
      current = ts.isPropertyAccessExpression(current.expression) ? current.expression.expression : undefined;
    } else if (ts.isIdentifier(current)) {
      const symbol = checker.getSymbolAtLocation(current);
      const declaration = symbol?.valueDeclaration;
      if (!declaration || !ts.isVariableDeclaration(declaration) || !declaration.initializer || seen.has(declaration)) break;
      seen.add(declaration);
      current = declaration.initializer;
    } else if (ts.isParenthesizedExpression(current)) {
      current = current.expression;
    } else break;
  }
  return calls.reverse();
}

function isChainStart(calls) {
  return calls.length > 0 && methodName(calls[0]) === 'createBuilder';
}

/** Unwrap DiBag decorators around a registration expression, reading lifetime and ownership on the way. */
function unwrap(expression) {
  let lifetime = 'scoped', owned = false, inner = expression;
  while (ts.isCallExpression(inner) && WRAPPERS.has(methodName(inner) ?? '') && inner.arguments.length > 0) {
    const name = methodName(inner);
    if (name === 'withLifetime' && inner.arguments[1] && ts.isStringLiteral(inner.arguments[1])) lifetime = inner.arguments[1].text;
    if (name === 'withDisposal') owned = true;
    inner = inner.arguments[0];
  }
  return { inner, lifetime, owned };
}

/** Declared named dependencies and async-ness of a factory expression, through the checker. */
function describeFactory(expression, checker) {
  let type = checker.getTypeAtLocation(expression);
  let signature = type.getCallSignatures()[0];
  const isReference = (type.getFlags() & ts.TypeFlags.Object) !== 0 && (type.objectFlags & ts.ObjectFlags.Reference) !== 0;
  if (!signature && isReference) {
    // Provider<F, ...> and FactoryWithDisposal<F> both carry the factory as their first type argument.
    const [first] = checker.getTypeArguments(type);
    signature = first?.getCallSignatures()[0];
  }
  if (!signature) return { dependencies: [], async: false };
  const parameter = signature.getParameters()[0];
  const dependencies = parameter ? checker.getTypeOfSymbolAtLocation(parameter, expression).getProperties().map(property => property.name) : [];
  const returned = checker.getReturnTypeOfSignature(signature);
  const async = checker.typeToString(returned).startsWith('Promise<');
  return { dependencies, async };
}

function keyText(expression) {
  if (ts.isStringLiteral(expression)) return expression.text;
  if (ts.isIdentifier(expression)) return expression.text;
  return expression.getText();
}

function readUnit(terminal, sourceFile, checker, root, units) {
  const calls = chainCalls(terminal, checker);
  const nodes = [], installs = [], aliases = [];
  let exports = [];
  for (const call of calls) {
    const name = methodName(call);
    if ((name === 'register' || name === 'replace') && call.arguments.length === 1 && ts.isObjectLiteralExpression(call.arguments[0])) {
      for (const property of call.arguments[0].properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const { inner, lifetime, owned } = unwrap(property.initializer);
        const { dependencies, async } = describeFactory(inner, checker);
        const { line } = sourceFile.getLineAndCharacterOfPosition(property.getStart(sourceFile));
        nodes.push({ key: keyText(property.name), line: line + 1, dependencies, async, lifetime, owned });
      }
    } else if ((name === 'register' || name === 'replace') && call.arguments.length === 2) {
      const { inner, lifetime, owned } = unwrap(call.arguments[1]);
      const { dependencies, async } = describeFactory(inner, checker);
      const { line } = sourceFile.getLineAndCharacterOfPosition(call.getStart(sourceFile));
      nodes.push({ key: keyText(call.arguments[0]), line: line + 1, dependencies, async, lifetime, owned });
    } else if (name === 'alias' && call.arguments.length === 2) {
      aliases.push({ from: keyText(call.arguments[0]), to: keyText(call.arguments[1]) });
    } else if (name === 'installModule' && call.arguments.length === 1) {
      installs.push(call.arguments[0]);
    } else if (name === 'buildModule' && call.arguments[0] && ts.isArrayLiteralExpression(call.arguments[0])) {
      exports = call.arguments[0].elements.map(keyText);
    }
  }
  const { line } = sourceFile.getLineAndCharacterOfPosition(calls[0].getStart(sourceFile));
  const file = relative(root, sourceFile.fileName);
  return { id: `${file}:${line + 1}`, kind: methodName(terminal) === 'buildModule' ? 'module' : 'bag', file, line: line + 1, exports, installs, nodes, aliases, terminal };
}

/** Map each install argument to the unit whose terminal call initializes the referenced variable. */
function resolveInstalls(units, checker) {
  const byTerminal = new Map(units.map(unit => [unit.terminal, unit]));
  for (const unit of units) {
    unit.installs = unit.installs.map(argument => {
      let expression = argument;
      while (ts.isCallExpression(expression) && methodName(expression) === 'renameExport' && ts.isPropertyAccessExpression(expression.expression)) expression = expression.expression.expression;
      const symbol = ts.isIdentifier(expression) ? checker.getSymbolAtLocation(expression) : undefined;
      const initializer = symbol?.valueDeclaration && ts.isVariableDeclaration(symbol.valueDeclaration) ? symbol.valueDeclaration.initializer : undefined;
      return (initializer && byTerminal.get(initializer)?.id) ?? argument.getText();
    });
    delete unit.terminal;
  }
}

function findIssues(units) {
  const byId = new Map(units.map(unit => [unit.id, unit]));
  const issues = [];
  for (const unit of units) {
    const provided = new Set([...unit.nodes.map(node => node.key), ...unit.aliases.map(alias => alias.from)]);
    for (const install of unit.installs) for (const exported of byId.get(install)?.exports ?? []) provided.add(exported);
    const local = new Map(unit.nodes.map(node => [node.key, node.dependencies]));
    // Depth-first search over local edges first; report each cycle once at its first discovery.
    const state = new Map();
    const stack = [];
    const visit = key => {
      state.set(key, 'active'); stack.push(key);
      for (const dependency of local.get(key) ?? []) {
        if (state.get(dependency) === 'active') { issues.push({ kind: 'cycle', unit: unit.id, path: [...stack.slice(stack.indexOf(dependency)), dependency] }); continue; }
        if (!state.has(dependency) && local.has(dependency)) visit(dependency);
      }
      stack.pop(); state.set(key, 'done');
    };
    for (const node of unit.nodes) if (!state.has(node.key)) visit(node.key);
    // A module's unmet names are requirements the host supplies; only a bag reports them as issues.
    const unmet = [...new Set(unit.nodes.flatMap(node => node.dependencies.filter(dependency => !provided.has(dependency))))].sort();
    if (unit.kind === 'module') unit.requirements = unmet;
    else for (const node of unit.nodes) for (const dependency of node.dependencies) {
      if (!provided.has(dependency)) issues.push({ kind: 'unresolved', unit: unit.id, consumer: node.key, dependency });
    }
    unit.edges = unit.nodes.flatMap(node => node.dependencies.map(dependency => ({ from: node.key, to: dependency })))
      .sort((left, right) => left.from.localeCompare(right.from) || left.to.localeCompare(right.to));
    delete unit.aliases;
  }
  return issues;
}

/**
 * Extract every DI Bag builder chain in a project or file list.
 * @param {{ project?: string, files?: string[], root?: string }} input - A tsconfig path or files, resolved against `root`.
 */
export function extractDependencyGraph({ project, files, root = process.cwd() }) {
  if (!project && !files?.length) throw new Error('extractDependencyGraph requires a project or files');
  const program = loadProgram({ project, files, root });
  const checker = program.getTypeChecker();
  const units = [];
  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile || sourceFile.fileName.includes('/node_modules/')) continue;
    const visit = node => {
      if (ts.isCallExpression(node) && TERMINALS.has(methodName(node) ?? '') && isChainStart(chainCalls(node, checker))) {
        units.push(readUnit(node, sourceFile, checker, root, units));
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  resolveInstalls(units, checker);
  const issues = findIssues(units);
  return { version: 1, units, issues };
}
```

- [ ] **Step 5: Run the tests and adjust line numbers**

Run: `node --test tools/graph/test/*.test.mjs`
Expected: PASS (validated 2026-09-13). Line numbers count the path comment as line 1: the first `createBuilder` chain starts on line 4, `db` is on line 15, and the cyclic chain on line 20.

- [ ] **Step 6: Root script and commit**

Add to root `package.json` scripts:

```json
    "graph:check": "node --test tools/graph/test/*.test.mjs",
```

Run: `npm run graph:check`
Expected: PASS.

```bash
git add tools/graph/package.json tools/graph/package-lock.json tools/graph/lib/extract.mjs tools/graph/test .gitignore package.json
git commit -m "feat: add di-bag-graph static dependency extraction"
```

---

### Task 2: The command line

**Files:**
- Create: `tools/graph/cli.mjs`
- Test: `tools/graph/test/cli.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// tools/graph/test/cli.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '../../..');
const cli = resolve(root, 'tools/graph/cli.mjs');
const fixture = 'tools/graph/test/fixtures/split-builder.ts';

test('the CLI writes JSON and summarizes units and issues', () => {
  const directory = mkdtempSync(join(tmpdir(), 'di-bag-graph-'));
  const out = join(directory, 'graph.json');
  const result = spawnSync(process.execPath, [cli, fixture, '--out', out], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const graph = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(graph.units.length, 3);
  assert.match(result.stdout, /3 units, 8 nodes, 2 issues/);
  rmSync(directory, { recursive: true, force: true });
});

test('--check exits non-zero when issues exist and prints them', () => {
  const result = spawnSync(process.execPath, [cli, fixture, '--check'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /cycle .*a -> b -> a/);
  assert.match(result.stdout, /unresolved .*lonely needs missing/);
});

test('--project reads a tsconfig', () => {
  // Write to a file: the whole repository's JSON exceeds spawnSync's default stdout buffer.
  const directory = mkdtempSync(join(tmpdir(), 'di-bag-graph-'));
  const out = join(directory, 'graph.json');
  const result = spawnSync(process.execPath, [cli, '--project', 'tsconfig.json', '--out', out], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^\d+ units, \d+ nodes, \d+ issues -> /);
  assert.ok(JSON.parse(readFileSync(out, 'utf8')).units.length > 10);
  rmSync(directory, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tools/graph/test/cli.test.mjs`
Expected: FAIL: cannot find `cli.mjs`.

- [ ] **Step 3: Write the CLI**

```js
#!/usr/bin/env node
// tools/graph/cli.mjs
import { writeFileSync } from 'node:fs';
import { extractDependencyGraph } from './lib/extract.mjs';

const args = process.argv.slice(2);
const files = [];
let project, out, check = false;
for (let index = 0; index < args.length; index++) {
  const argument = args[index];
  if (argument === '--project') project = args[++index];
  else if (argument === '--out') out = args[++index];
  else if (argument === '--check') check = true;
  else if (argument === '--help' || argument === '-h') { usage(); process.exit(0); }
  else files.push(argument);
}
if (!project && files.length === 0) { usage(); process.exit(2); }

function usage() {
  console.log('usage: di-bag-graph (--project tsconfig.json | file.ts ...) [--out graph.json] [--check]');
}

const graph = extractDependencyGraph({ project, files, root: process.cwd() });
if (out) writeFileSync(out, JSON.stringify(graph, null, 2) + '\n');
else if (!check) console.log(JSON.stringify(graph, null, 2));
const nodes = graph.units.reduce((total, unit) => total + unit.nodes.length, 0);
console.log(`${graph.units.length} units, ${nodes} nodes, ${graph.issues.length} issues${out ? ` -> ${out}` : ''}`);
for (const issue of graph.issues) {
  console.log(issue.kind === 'cycle'
    ? `cycle in ${issue.unit}: ${issue.path.join(' -> ')}`
    : `unresolved in ${issue.unit}: ${issue.consumer} needs ${issue.dependency}`);
}
process.exit(check && graph.issues.length > 0 ? 1 : 0);
```

Run: `chmod +x tools/graph/cli.mjs`

- [ ] **Step 4: Run the tests**

Run: `npm run graph:check`
Expected: PASS. The `--project tsconfig.json` run compiles the whole repository once (a few seconds).

- [ ] **Step 5: Commit**

```bash
git add tools/graph/cli.mjs tools/graph/test/cli.test.mjs
git commit -m "feat: add the di-bag-graph command line"
```

---

### Task 3: CI, docs, changelog

**Files:**
- Modify: `.github/workflows/ci.yml` (contracts job: install and test the tool)
- Modify: `docs/guides/agent-harnesses-and-graphs.md` (new section before "## Connect your own harness or graph framework")
- Modify: `docs/guides/development.md` (a paragraph in "Package entry points and release-candidate checks")
- Modify: `README.md` ("Explore further" table)
- Modify: `CHANGELOG.md`

- [ ] **Step 1: CI steps**

In `.github/workflows/ci.yml`, in the `contracts` job after `- run: npm run check:native`, add:

```yaml
      - run: npm ci --prefix tools/graph --no-audit --no-fund
      - run: npm run graph:check
```

and add `tools/graph/package-lock.json` to the `cache-dependency-path` list of that job's `setup-node` step (create the list if the step currently uses the single `cache: npm` default):

```yaml
        with:
          node-version: '24.20.0'
          cache: npm
          cache-dependency-path: |
            package-lock.json
            tools/graph/package-lock.json
```

- [ ] **Step 2: Agent guide section**

Insert before `## Connect your own harness or graph framework`:

```markdown
## Export the declared dependency graph

Named dependencies are declared on factory parameters, so they are visible to
the TypeScript checker but not to the runtime. The `di-bag-graph` tool in
`tools/graph` reads a project and writes every builder chain as a unit with its
nodes, declared edges, module exports and installations, lifetimes, async
outputs, and issues:

```sh
node tools/graph/cli.mjs --project tsconfig.json --out graph.json
node tools/graph/cli.mjs src/app.ts --check   # exit 1 on cycles or unresolved names
```

Each node records `key`, `line`, `dependencies`, `async`, `lifetime`, and
`owned`. Cycles are reported per unit before any factory runs. Feed the JSON to
an agent as the map of a feature, or fail CI on new cycles. At runtime,
`bag.inspectGraph()` reports the same bindings plus the edges observed so far.
```

- [ ] **Step 3: Development guide, README, changelog**

In `docs/guides/development.md`, after the lane paragraph added by plan 01, add:

```markdown
`npm run graph:check` tests the standalone `di-bag-graph` tool in `tools/graph`
(`npm ci --prefix tools/graph` first). The tool depends on the TypeScript
compiler and is therefore not part of the published package.
```

In `README.md` "Explore further", add a row after "Agent harnesses and graphs":

```markdown
| [Static dependency graph](docs/guides/agent-harnesses-and-graphs.md#export-the-declared-dependency-graph) | Export every builder chain, declared edge, and cycle to JSON with `di-bag-graph`. |
```

Under `## Unreleased` in `CHANGELOG.md`:

```markdown
- Add the `di-bag-graph` tool (`tools/graph`) that extracts builder chains,
  declared named dependencies, module exports and installations, lifetimes,
  async outputs, cycles, and unresolved names into JSON.
```

- [ ] **Step 4: Check and commit**

Run: `npm run docs:check && npm run check && npm run graph:check`
Expected: PASS.

```bash
git add .github/workflows/ci.yml docs README.md CHANGELOG.md
git commit -m "docs: document the di-bag-graph tool and run it in CI"
```
