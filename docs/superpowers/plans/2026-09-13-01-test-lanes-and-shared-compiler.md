# Test Lanes and Shared Compiler Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the library's own test loop by sharing one TypeScript program across compiler-driven tests and by splitting the suite into a fast runtime lane and a slow compiler lane.

**Architecture:** `tests/compiler.ts` keeps one compiler host for the whole test process, caches parsed on-disk source files, reuses the previous `ts.Program`, and can compile many independent fixtures in one program with per-file diagnostics. A small script selects test files per lane from one list so `npm test` still runs everything.

**Tech Stack:** TypeScript compiler API (`ts.createProgram` with `oldProgram`), bun:test, Node scripts.

**Spec:** `docs/superpowers/specs/2026-09-13-agentic-scale-hardening.md` (decision D6)

## Global Constraints

- Minimum supported TypeScript 6.0.3; `npm run check:native` must keep passing.
- Zero runtime, peer, optional, and bundled dependencies in the published package.
- `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` stay on.
- `npm run check` passes before every commit.
- Total test count after the split must equal the count `bun test tests` printed before the split (967 on 2026-09-13).
- Commit prefixes: `feat:`, `fix:`, `test:`, `docs:`, `chore:`.

---

### Task 1: Shared compiler host with cached source files and program reuse

**Files:**
- Modify: `tests/compiler.ts:1-41` (the `options`, `compilerProgram`, `diagnostics` block)
- Test: `tests/compiler-reuse.test.ts` (new)

**Interfaces:**
- Consumes: `ts.createProgram(rootNames, options, host, oldProgram)`.
- Produces: `export const options: ts.CompilerOptions`, `compilerProgram(path, source?)`, `diagnostics(path, source?)` (unchanged signatures, same results for fixture files), and new `diagnosticsByFile(paths: readonly string[]): Map<string, readonly ts.Diagnostic[]>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/compiler-reuse.test.ts
import { expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { compilerProgram, describeDiagnostic, diagnostics, diagnosticsByFile } from './compiler';

const fixture = resolve(__dirname, 'types/negative/fork-missing.ts');
const sibling = resolve(__dirname, 'types/negative/fork-extra.ts');
const librarySource = resolve(__dirname, '../src/di-bag.ts');

test('consecutive programs share parsed library source files', () => {
  const first = compilerProgram(fixture);
  const second = compilerProgram(sibling);
  expect(second.getSourceFile(librarySource)).toBe(first.getSourceFile(librarySource)!);
});

test('a batch program reports the same per-file diagnostics as a single-root program', () => {
  const single = diagnostics(fixture).map(describeDiagnostic);
  const batch = diagnosticsByFile([fixture, sibling]);
  expect(batch.get(fixture)!.map(describeDiagnostic)).toEqual(single);
  expect(batch.get(sibling)!.length).toBeGreaterThan(0);
  expect(batch.get(sibling)!.every(error => error.file?.fileName === sibling)).toBe(true);
});

test('a virtual source at a reused path is recompiled', () => {
  const path = resolve(__dirname, 'generated-compiler-reuse.ts');
  const valid = "import { DiBag } from '../src';\nconst value: number = DiBag.createBuilder().register({ a: () => 1 }).build().resolve('a');\n";
  const invalid = valid.replace('const value: number', 'const value: string');
  expect(diagnostics(path, valid)).toEqual([]);
  expect(diagnostics(path, invalid).map(error => describeDiagnostic(error).code)).toEqual([2322]);
  expect(diagnostics(path, valid)).toEqual([]);
});

test('diagnostics for a consumer fixture still include its producer file', () => {
  // types/plugins-consumer.ts imports types/plugins.ts; both must be checked, src/ is not.
  const consumer = resolve(__dirname, 'types/plugins-consumer.ts');
  const program = compilerProgram(consumer);
  expect(program.getSourceFile(resolve(__dirname, 'types/plugins.ts'))).toBeDefined();
  expect(diagnostics(consumer)).toEqual([]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test tests/compiler-reuse.test.ts`
Expected: FAIL. The first test fails because each `compilerProgram` call creates a fresh host (different `SourceFile` objects), and `diagnosticsByFile` is not exported ("export named 'diagnosticsByFile' not found" or a type error).

- [ ] **Step 3: Replace the program construction in `tests/compiler.ts`**

Replace lines 1-41 of `tests/compiler.ts` (everything up to and including the `describeDiagnostic` function) with:

```ts
import { resolve, sep } from 'node:path';
import ts from 'typescript';

export const options: ts.CompilerOptions = {
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  noUncheckedIndexedAccess: true,
  exactOptionalPropertyTypes: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  types: [],
};

// One host per test process: on-disk files parse once, virtual sources replace their path.
const sourceFiles = new Map<string, ts.SourceFile>();
const virtualSources = new Map<string, string>();
let sharedHost: ts.CompilerHost | undefined;
let previousProgram: ts.Program | undefined;
// cwd-relative like scalePath: __dirname is undefined when Node loads this module for the scripts.
const librarySources = resolve('src') + sep;

function host(): ts.CompilerHost {
  if (sharedHost) return sharedHost;
  const created = ts.createCompilerHost(options);
  const read = created.getSourceFile.bind(created);
  created.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    const virtual = virtualSources.get(fileName);
    if (virtual !== undefined) return ts.createSourceFile(fileName, virtual, languageVersion, true);
    const cached = sourceFiles.get(fileName);
    if (cached && !shouldCreateNewSourceFile) return cached;
    const file = read(fileName, languageVersion, onError, shouldCreateNewSourceFile);
    if (file) sourceFiles.set(fileName, file);
    return file;
  };
  return sharedHost = created;
}

function program(roots: readonly string[]): ts.Program {
  return previousProgram = ts.createProgram([...roots], options, host(), previousProgram);
}

export function compilerProgram(path: string, source?: string): ts.Program {
  if (source === undefined) virtualSources.delete(path); else virtualSources.set(path, source);
  return program([path]);
}

// The library itself is checked by `npm run typecheck`; fixtures only need their own files.
function fixtureFiles(compiled: ts.Program): readonly ts.SourceFile[] {
  return compiled.getSourceFiles().filter(file => !file.isDeclarationFile && !file.fileName.startsWith(librarySources));
}

export function diagnostics(path: string, source?: string): readonly ts.Diagnostic[] {
  const compiled = compilerProgram(path, source);
  return fixtureFiles(compiled).flatMap(file => ts.getPreEmitDiagnostics(compiled, file));
}

/** Compile many independent fixtures in one program; each path keeps only its own file's diagnostics. */
export function diagnosticsByFile(paths: readonly string[]): Map<string, readonly ts.Diagnostic[]> {
  for (const path of paths) virtualSources.delete(path);
  const compiled = program(paths);
  return new Map(paths.map(path => [path, ts.getPreEmitDiagnostics(compiled, compiled.getSourceFile(path))]));
}

export function describeDiagnostic(error: ts.Diagnostic) {
  const position = error.file && error.start !== undefined
    ? error.file.getLineAndCharacterOfPosition(error.start)
    : undefined;
  return {
    code: error.code,
    file: error.file?.fileName,
    line: position === undefined ? undefined : position.line + 1,
    column: position === undefined ? undefined : position.character + 1,
    message: ts.flattenDiagnosticMessageText(error.messageText, '\n'),
  };
}
```

Keep everything after `describeDiagnostic` (the `ScaleForm` types and generators) unchanged.

- [ ] **Step 4: Run the new test and the existing type suites**

Run: `bun test tests/compiler-reuse.test.ts tests/types.test.ts tests/type-scale.test.ts tests/token-scale.test.ts tests/compiler-case.test.ts tests/incremental-scale.test.ts`
Expected: all PASS. `incremental-scale` and `compiler-case` spawn `node scripts/*.ts`, which import this module as ESM: any `__dirname` use here fails there. Note the wall time printed for `types.test.ts` for the measurement in Task 4 (validated 2026-09-13: 88 s before, 22.5 s after). If a fixture that imports a sibling test file reports fewer diagnostics than before, the sibling is under `src/`; nothing else is excluded.

- [ ] **Step 5: Run the library typecheck**

Run: `npm run typecheck`
Expected: no diagnostics (the test file is included by `tsconfig.json`).

- [ ] **Step 6: Commit**

```bash
git add tests/compiler.ts tests/compiler-reuse.test.ts
git commit -m "test: share one compiler host and program across type fixtures"
```

---

### Task 2: Compile the negative fixtures in one program

**Files:**
- Modify: `tests/types.test.ts:212-229` (the `for (const name of readdirSync(...))` loop)

**Interfaces:**
- Consumes: `diagnosticsByFile` from Task 1.
- Produces: no new exports.

- [ ] **Step 1: Replace the negative fixture loop**

Replace the final `for` loop in `tests/types.test.ts` with:

```ts
const negativeDirectory = resolve(__dirname, 'types/negative');
const negativeFixtures = readdirSync(negativeDirectory)
  .filter((name) => name.endsWith('.ts'))
  .map((name) => resolve(negativeDirectory, name));
// One program for every independent rejection fixture; each test reads its own file's diagnostics.
const negativeDiagnostics = diagnosticsByFile(negativeFixtures);

for (const path of negativeFixtures) {
  test(`type rejection: ${basename(path)}`, () => {
    const source = readFileSync(path, 'utf8');
    const expected = [...source.matchAll(/\/\/ diagnostic: (.+)/g)];
    expect(expected.length).toBeGreaterThan(0);
    const errors = negativeDiagnostics.get(path)!;
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every((error) => error.file?.fileName === path)).toBe(true);
    const matched = matchDiagnosticMarkers(source, path, errors.map(describeDiagnostic));
    expect(matched.missing).toEqual([]); expect(matched.unexpected).toEqual([]);
  });
}
```

Update the imports at the top of the file:

```ts
import { readdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import ts from 'typescript';
import { diagnostics, diagnosticsByFile, describeDiagnostic } from './compiler';
```

- [ ] **Step 2: Run the suite and record the time**

Run: `time bun test tests/types.test.ts`
Expected: 119 pass, 0 fail. Expected wall time well under the previous 88 s (the twelve-fixture experiment went from 8.9 s to 0.8 s).

- [ ] **Step 3: Commit**

```bash
git add tests/types.test.ts
git commit -m "test: compile negative type fixtures in one shared program"
```

---

### Task 3: Fast and compiler test lanes

**Files:**
- Create: `scripts/test-lane.mjs`
- Modify: `package.json` (`scripts.test`, add `scripts.test:fast`, `scripts.test:compiler`)
- Test: `tests/test-lanes.test.ts` (new)

**Interfaces:**
- Produces: `node scripts/test-lane.mjs fast|compiler [extra bun test args]`; `export const compilerLane: ReadonlySet<string>` is not exported, the script is the single source of truth and the test reads its output.

- [ ] **Step 1: Write the failing test**

```ts
// tests/test-lanes.test.ts
import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
// Bun's fs typings lack readdirSync's recursive option; walk explicitly.
function walk(directory: string, prefix = ''): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(resolve(directory, entry.name), `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`]);
}
function lane(name: string): string[] {
  const result = spawnSync(process.execPath, ['scripts/test-lane.mjs', name, '--list'], { cwd: root, encoding: 'utf8' });
  expect(result.status).toBe(0);
  return result.stdout.trim().split('\n').filter(Boolean);
}

test('the two lanes partition every test file exactly once', () => {
  const fast = lane('fast');
  const compiler = lane('compiler');
  const all = walk(resolve(root, 'tests'))
    .filter(name => name.endsWith('.test.ts'))
    .map(name => `tests/${name}`)
    .sort();
  expect([...fast, ...compiler].sort()).toEqual(all);
  expect(fast.some(file => file === 'tests/types.test.ts')).toBe(false);
  expect(compiler).toContain('tests/types.test.ts');
  expect(compiler).toContain('tests/platform/browser-worker.test.ts');
  expect(fast).toContain('tests/scopes.test.ts');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test tests/test-lanes.test.ts`
Expected: FAIL with a non-zero status because `scripts/test-lane.mjs` does not exist.

- [ ] **Step 3: Create the lane script**

```js
// scripts/test-lane.mjs
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

// Files that build compiler programs, pack the package, spawn native or platform tools, or benchmark.
const compilerLane = new Set([
  'benchmark-compiler-controls', 'benchmark-types', 'comparator-contract', 'compiler-case', 'incremental-scale',
  'native-compiler', 'native-diagnostic-markers', 'native-package', 'native-process', 'native-replacement-diagnostics',
  'package', 'performance-baseline', 'performance-evidence', 'platform-deno', 'platform-evidence', 'platform-tools',
  'platform/browser-worker', 'release-artifacts', 'runtime-benchmark-child', 'token-package', 'token-scale',
  'type-scale', 'types',
]);

const [lane, ...rest] = process.argv.slice(2);
if (lane !== 'fast' && lane !== 'compiler') {
  console.error('usage: node scripts/test-lane.mjs fast|compiler [--list] [bun test arguments]');
  process.exit(2);
}
const files = readdirSync('tests', { recursive: true })
  .map(String)
  .filter(name => name.endsWith('.test.ts'))
  .filter(name => compilerLane.has(name.replace(/\.test\.ts$/, '')) === (lane === 'compiler'))
  .map(name => `tests/${name}`)
  .sort();
if (rest[0] === '--list') {
  console.log(files.join('\n'));
  process.exit(0);
}
const result = spawnSync('bun', ['test', ...files, ...rest], { stdio: 'inherit' });
process.exit(result.status ?? 1);
```

- [ ] **Step 4: Add the npm scripts**

In `package.json`, replace `"test": "bun test tests",` with:

```json
    "test": "npm run test:fast && npm run test:compiler",
    "test:fast": "node scripts/test-lane.mjs fast",
    "test:compiler": "node scripts/test-lane.mjs compiler",
```

- [ ] **Step 5: Run the lane test, then both lanes, and compare counts**

Run: `bun test tests/test-lanes.test.ts`
Expected: PASS.

Run: `time npm run test:fast` and `time npm run test:compiler`
Expected: both report 0 fail. Add the two "Ran N tests" counts; the sum must equal the count of `bun test tests` (967 on 2026-09-13, plus the tests added by this plan). Record both wall times for Task 4.

- [ ] **Step 6: Commit**

```bash
git add scripts/test-lane.mjs package.json tests/test-lanes.test.ts
git commit -m "chore: split tests into fast and compiler lanes"
```

---

### Task 4: Document the lanes and the measured loop

**Files:**
- Modify: `docs/guides/development.md` (the "Package entry points and release-candidate checks" section, after the `npm ci` code block)
- Modify: `CHANGELOG.md` (top)

- [ ] **Step 1: Add the lane description**

After the sentence "Passing local checks establishes a release candidate, not a registry publication." insert:

```markdown
`npm test` runs two lanes. `npm run test:fast` covers the runtime suites and
finishes in well under a minute; run it after every source change.
`npm run test:compiler` covers the compiler, package, native, platform, and
benchmark suites; run it before committing. `scripts/test-lane.mjs` holds the
single list that assigns files to lanes. Compiler-driven tests share one
TypeScript program through `tests/compiler.ts`, so a fixture's diagnostics cover
that fixture and the other test files it imports; `npm run typecheck` covers `src/`.
```

Replace the two numbers in the previous sentence with the wall times measured in Task 3 if they differ materially from "well under a minute".

- [ ] **Step 2: Add the changelog entry**

At the top of `CHANGELOG.md`, before `## 0.1.1`, add:

```markdown
## Unreleased

- Split `npm test` into `test:fast` and `test:compiler` lanes and share one
  TypeScript program across compiler-driven tests. No runtime or public API changes.
```

If an `## Unreleased` heading already exists, append the bullet under it.

- [ ] **Step 3: Run the full check and commit**

Run: `npm run check`
Expected: typecheck clean, both lanes pass, build succeeds.

```bash
git add docs/guides/development.md CHANGELOG.md
git commit -m "docs: describe the fast and compiler test lanes"
```
