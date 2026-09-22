# Migration Support and Release Candidate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give 0.4.0 users a way across (throwing stubs, a generated migration guide, a published codemod that is proven on the 0.4.0 examples), then prepare a locally verified release candidate of `di-bag` 0.5.0, `di-bag-graph` 0.2.0 and `di-bag-codemod` 0.1.0.

**Architecture:** `tools/codemod/rename-map.json` is the single description of the distance from 0.4.0. Three things are generated from it and kept current by a `--check` mode that a test runs: the throwing stubs in `src/removed-api.ts`, the rename tables of the migration guide, and the coverage of the negative compile fixture. The release candidate follows `PUBLISHING.md` step by step. The EXECUTOR of this plan stops at a verified candidate commit; the CONTROLLER pushes, merges, publishes and tags, from the checklist at the end.

**Tech Stack:** Node 24.20.0 scripts (`.mjs`, no dependencies), Bun 1.4.0 tests, TypeScript 6.0.2 and 7.0.2, npm 11.19.0, the release scripts under `scripts/`.

**Spec:** `docs/superpowers/specs/2026-09-20-swift-api-style.md`, sections "Migration support" and "Acceptance". Master plan: `docs/superpowers/plans/2026-09-21-00-swift-api-style-master.md`, phase 13.

## Global Constraints

- Versions: `di-bag` 0.5.0, `di-bag-graph` 0.2.0, `di-bag-codemod` 0.1.0. One breaking release.
- The executor never pushes, never opens or merges a pull request, never publishes, never tags, and never reads or writes an npm token. Those steps are the controller's and are listed in the last section for the controller only.
- No credential of any kind goes into the repository, a plan, a log that is committed, or a commit message.
- Stubs cover CALLABLE names only, the `methods` section of the map. A removed property of a returned value, such as `binding.label`, gets no stub: a getter that throws would break logging and serialisation of snapshots. The compiler and the migration guide cover those.
- A stub is not enumerable and is absent from the public types: TypeScript callers get a compile error, JavaScript callers and agents get `DI_BAG_REMOVED_API` with `details: { operation, removed, replacement }`.
- Memory: `npm run benchmark:types`, its `--tokens` and native variants, and `npm run benchmark:compiler-ceiling` need up to 17 GB each. Run them one at a time, never in parallel with each other or with `npm run check`, and look at `free -g` first; with less than 18 GB available, stop and tell the controller instead of starting.
- Use `/tmp/di-bag-release-candidate` for archives, manifests and logs, as `PUBLISHING.md` requires. Durable evidence committed to the repository omits absolute paths.
- Gates, commit format and environment (pinned Bun first on `PATH`, `npm_config_update_notifier=false`) are in the master plan.

## State on entry

Phases 0 to 12 are merged. Everything is 0.5.0 in content, versions still say 0.4.0, and old names are simply absent.

```bash
node -p "require('./package.json').version + ' ' + require('./tools/graph/package.json').version + ' ' + require('./tools/codemod/package.json').version + ' private=' + require('./tools/codemod/package.json').private"
# expect: 0.4.0 0.1.0 0.1.0 private=true
node -e "console.log(require('./tests/api-naming-known-violations.json').violations.length)"   # expect: 0
git tag -l v0.4.0                                                                              # expect: v0.4.0 (if empty: git fetch --tags)
ls src/removed-api.ts docs/guides/migrating-to-0.5.md scripts/generate-removed-api.mjs 2>&1 | grep -c "No such file"   # expect: 3
grep -c "DI_BAG_REMOVED_API" docs/agent/errors.md src/*.ts | grep -v ":0"                     # expect no output
```

If the first line shows other versions, or the ratchet is not empty, an earlier phase is incomplete: stop and report.

Also read the final `docs/superpowers/plans/evidence/phase-04.md` before executing any task. A selected but budget-unverified S5 fallback is not adopted evidence. If it records `Decision: fallback`, final user-facing collection reads and replacement text use `resolveCollection`; ordinary `resolve` remains single-service-only. The accumulated map still spans original 0.4.0 directly to final names, and Phase 4's four-entry ratchet shrink is not changed here.

## File Structure

| File | Responsibility |
| --- | --- |
| `scripts/generate-removed-api.mjs` (create) | writes `src/removed-api.ts` from the map's `methods`; `--check` fails when the file is stale |
| `src/removed-api.ts` (generated, committed) | the table of removed callable names, `installRemovedMembers(owner, target)`, `isRemovedApiStub(value)` |
| `tests/removed-api-generator.test.ts`, `tests/fixtures/removed-api/map.json` (create) | the generator against a small map |
| `tests/removed-api.test.ts` (create) | every name in the generated table is a stub on the live facade, builder, container and module, and throws the right error |
| `src/di-bag.ts`, `src/module.ts`, `src/tokens.ts` (modify) | one `installRemovedMembers` call per owner |
| `tests/api-renaming-coverage.test.ts` (create) | every removed method and type in the map has a line in `tests/types/negative/api-renaming.ts` |
| `scripts/generate-migration-guide.mjs`, `tests/migration-guide-generator.test.ts`, `tests/fixtures/migration-guide/` (create) | the rename tables of the guide, between two markers |
| `docs/guides/migrating-to-0.5.md` (create) | hand-written sections plus the generated tables |
| `scripts/codemod-acceptance.mjs` (create) | the v0.4.0 examples, migrated by the codemod alone, type-check and run against the 0.5.0 build |
| `tools/codemod/package.json`, `tools/graph/package.json`, `package.json`, lockfiles, `CHANGELOG.md`, `README.md`, `PUBLISHING.md`, `.github/workflows/ci.yml`, `docs/benchmarks/typescript.md` (modify) | the release facts |

---

### Task 1: The stub generator

**Files:**
- Create: `scripts/generate-removed-api.mjs`, `tests/removed-api-generator.test.ts`, `tests/fixtures/removed-api/map.json`

**Interfaces:**
- Produces: `node scripts/generate-removed-api.mjs [--map <file>] [--out <file>] [--check]`. Defaults: `tools/codemod/rename-map.json` and `src/removed-api.ts`. It prints `<out>: <n> stubs for <m> owners`. With `--check` it writes nothing and exits 1 when the file is stale.
- Produces, in the generated module: `removedApi: Readonly<Record<string, Readonly<Record<string, string>>>>` (owner, then removed name, then replacement text), `installRemovedMembers(owner: string, target: object): void`, `isRemovedApiStub(value: unknown): boolean`.

Which `methods` entries get a stub. An entry whose `from` differs from its `to`: yes. An entry with `manual` and no `to`: yes, with the sentence as the replacement. An entry whose `from` equals its `to` (only the arguments changed, such as `buildModule`): no, the name is live, UNLESS the script's `replacementText` table names it, which is how a call that moved to another object under the same name is expressed (`DiBag.withDisposal` became `provider.withDisposal`). A name that another entry of the same owner produces as its `to` is live and gets no stub.

This generator, its fixture and its test were run when the plan was written: red with the script absent (`0 pass`, both tests report `Expected: 0`, `Received: 1`), then `2 pass`. The generated module was also loaded next to the real `src/errors.ts` in a scratch copy and behaved: the message, the frozen details, a live member never replaced, stubs not enumerable on a frozen plain object.

- [ ] **Step 1: The fixture map**

If final Phase 4 evidence records the S5 fallback, the `resolveAll` fixture's manual replacement printed below and its exact assertion must say `resolveCollection(collectionToken)`. Keep the old key `resolveAll`: it describes the original 0.4.0 call.

`tests/fixtures/removed-api/map.json`:

```json
{
  "version": 1,
  "methods": [
    { "owner": "DiBagApi", "from": "fromFactory", "to": "createProvider" },
    { "owner": "DiBagApi", "from": "withDisposal", "to": "withDisposal", "transform": "decorator-to-method" },
    { "owner": "DiBagApi", "from": "token", "to": "createToken" },
    { "owner": "Builder", "from": "build", "to": "buildContainer" },
    { "owner": "Builder", "from": "buildModule", "to": "buildModule", "transform": "build-module-bag" },
    { "owner": "Builder", "from": "buildAndStart", "to": "ensureServicesReady", "transform": "build-and-start" },
    { "owner": "Bag", "from": "inspect", "to": "serviceSnapshot" },
    { "owner": "Bag", "from": "resolveAll", "manual": "resolve(collectionToken)" }
  ]
}
```

- [ ] **Step 2: The failing test**

`tests/removed-api-generator.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const script = resolve(__dirname, '../scripts/generate-removed-api.mjs');
const map = resolve(__dirname, 'fixtures/removed-api/map.json');
const run = (out: string, ...flags: string[]) => spawnSync('node', [script, '--map', map, '--out', out, ...flags], { encoding: 'utf8' });

test('one stub per removed callable name, none for a name that is still live', () => {
  const out = join(mkdtempSync(join(tmpdir(), 'removed-api-')), 'removed-api.ts');
  const result = run(out);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('7 stubs for 3 owners');
  const text = readFileSync(out, 'utf8');
  // Renamed: a stub that names the new call, with the receiver a reader would type.
  expect(text).toContain('"fromFactory": "DiBag.createProvider",');
  expect(text).toContain('"build": "builder.buildContainer",');
  expect(text).toContain('"inspect": "container.serviceSnapshot",');
  // Moved to another object under the SAME name: still a stub on the old owner.
  expect(text).toContain('"withDisposal": "DiBag.createProvider(factory).withDisposal(disposeService)",');
  // No single successor: the sentence from the map, or from the script's table.
  expect(text).toContain('"resolveAll": "resolve(collectionToken)",');
  expect(text).toContain('"buildAndStart": "buildContainer(), then container.ensureServicesReady(serviceKeys)",');
  // Only the arguments changed: the name is live and gets no stub.
  expect(text).not.toContain('"buildModule"');
});

test('--check accepts the generated file and rejects a stale one', () => {
  const out = join(mkdtempSync(join(tmpdir(), 'removed-api-')), 'removed-api.ts');
  expect(run(out).status).toBe(0);
  expect(run(out, '--check').status).toBe(0);
  writeFileSync(out, readFileSync(out, 'utf8').replace('createProvider', 'somethingElse'));
  const stale = run(out, '--check');
  expect(stale.status).toBe(1);
  expect(stale.stderr).toContain('is stale');
});
```

Run: `bun test tests/removed-api-generator.test.ts`. Expected: `0 pass`, `2 fail`, each with `Expected: 0`, `Received: 1`, because `node` cannot find the script.

- [ ] **Step 3: The script**

`scripts/generate-removed-api.mjs`:

```js
// Generates src/removed-api.ts from tools/codemod/rename-map.json: one throwing stub per callable name that 0.5.0 removed.
// Usage: node scripts/generate-removed-api.mjs [--map <file>] [--out <file>] [--check]
import { readFileSync, writeFileSync } from 'node:fs';

const option = name => { const index = process.argv.indexOf(name); return index === -1 ? undefined : process.argv[index + 1]; };
const mapFile = option('--map') ?? 'tools/codemod/rename-map.json';
const outFile = option('--out') ?? 'src/removed-api.ts';

// What to tell the caller when the new name alone would mislead, because the call moved to another object or split in two.
const replacementText = {
  'DiBagApi.token': 'DiBag.createToken(symbol).forService<Service>()',
  'DiBagApi.all': 'the collection token itself, from DiBag.createToken(symbol).forCollectionOf<Item>()',
  'DiBagApi.fromSyncFactory': "DiBag.createProvider(factory, { factoryReturnKind: 'sync-value' })",
  'DiBagApi.fromAsyncFactory': "DiBag.createProvider(factory, { factoryReturnKind: 'native-promise' })",
  'DiBagApi.withDisposal': 'DiBag.createProvider(factory).withDisposal(disposeService)',
  'DiBagApi.withLifetime': 'DiBag.createProvider(factory).withLifetime(lifetime)',
  'DiBagApi.withMetadata': 'provider.withRegistrationMetadata(registrationMetadata) or provider.withAcquisitionMetadata({ describeAcquisition, callbackReceives })',
  'DiBagApi.transformService': 'provider.withTransformedService({ transformService, callbackReceives })',
  'Builder.register': 'withServices({ key: provider }) or withTokenService(token, provider)',
  'Builder.buildAndStart': 'buildContainer(), then container.ensureServicesReady(serviceKeys)',
  'Bag.fork': 'createIndependentContainer({ replacedServiceKeys, replacementProviders })',
  'Bag.createScope': 'createChildContainer({ replacedServiceKeys, replacementProviders, sharedParentServiceKeys })',
};
const receiver = { DiBagApi: 'DiBag.', Builder: 'builder.', Bag: 'container.', Module: 'module.', Provider: 'provider.' };

const map = JSON.parse(readFileSync(mapFile, 'utf8'));
const owners = new Map();
for (const entry of map.methods ?? []) {
  const moved = replacementText[`${entry.owner}.${entry.from}`];
  // Same name on both sides: only the arguments changed and the name is still live, UNLESS the table above says the call moved to another object.
  if (entry.from === entry.to && moved === undefined) continue;
  const replacement = moved ?? (entry.to === undefined ? entry.manual : `${receiver[entry.owner] ?? ''}${entry.to}`);
  if (typeof replacement !== 'string' || replacement === '') throw new Error(`methods: ${entry.owner}.${entry.from} has neither "to" nor "manual"`);
  if (!owners.has(entry.owner)) owners.set(entry.owner, new Map());
  owners.get(entry.owner).set(entry.from, replacement);
}
// A name that another entry of the same owner produces is live, so it must not get a stub.
for (const entry of map.methods ?? []) if (entry.from !== entry.to) owners.get(entry.owner)?.delete(entry.to);

const quote = text => JSON.stringify(text);
const table = [...owners].sort(([a], [b]) => a.localeCompare(b)).filter(([, names]) => names.size)
  .map(([owner, names]) => `  ${quote(owner)}: {\n${[...names].sort(([a], [b]) => a.localeCompare(b)).map(([name, text]) => `    ${quote(name)}: ${quote(text)},`).join('\n')}\n  },`).join('\n');

const text = `// GENERATED by scripts/generate-removed-api.mjs from tools/codemod/rename-map.json. Do not edit by hand.
import { libraryError } from './errors';

/** Every callable name that 0.5.0 removed, by the 0.4.0 declaration that owned it, with what replaces it. */
export const removedApi: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.freeze({
${table}
});

const stubs = new WeakSet<object>();
/** True for a function that exists only to say that a 0.4.0 name is gone. */
export function isRemovedApiStub(value: unknown): boolean { return typeof value === 'function' && stubs.has(value); }

function stub(owner: string, name: string, replacement: string): () => never {
  const removedApiStub = (): never => {
    throw libraryError('DI_BAG_REMOVED_API', \`\${name} was removed in 0.5.0; use \${replacement}\`, { operation: name, removed: \`\${owner}.\${name}\`, replacement });
  };
  stubs.add(removedApiStub);
  return removedApiStub;
}

/**
 * Define the stubs of one owner on a class prototype, or on a plain object such as the facade BEFORE it is frozen.
 * A stub is not enumerable, so Object.keys(DiBag) lists only the live API, and it never replaces a member the target still has.
 */
export function installRemovedMembers(owner: string, target: object): void {
  for (const [name, replacement] of Object.entries(removedApi[owner] ?? {})) {
    if (name in target) continue;
    Object.defineProperty(target, name, { value: stub(owner, name, replacement), enumerable: false, configurable: false, writable: false });
  }
}
`;

if (process.argv.includes('--check')) {
  let current = '';
  try { current = readFileSync(outFile, 'utf8'); } catch { /* missing counts as stale */ }
  if (current !== text) { console.error(`${outFile} is stale: run node scripts/generate-removed-api.mjs`); process.exit(1); }
} else {
  writeFileSync(outFile, text);
  console.log(`${outFile}: ${[...owners.values()].reduce((sum, names) => sum + names.size, 0)} stubs for ${[...owners].filter(([, names]) => names.size).length} owners`);
}
```

Keep backticks out of the comments inside the big template literal: a backtick there ends the template and the script no longer parses. Run the test again. Expected: `2 pass`.

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-removed-api.mjs tests/removed-api-generator.test.ts tests/fixtures/removed-api/map.json
git commit -m "feat(migration): generator for the removed-API stubs"
```

Use the full commit format from the master plan, with the two attribution lines. The same holds for every commit below.

---

### Task 2: Generate the stubs and install them

**Files:**
- Create: `src/removed-api.ts` (generated), `tests/removed-api.test.ts`
- Modify: `src/di-bag.ts` (the facade, `Builder`, `Container`), `src/module.ts` (`Module`), `src/tokens.ts` (the object `createToken` returns), `tests/removed-api-generator.test.ts` (one more test), `docs/agent/errors.md`

**Interfaces:**
- Consumes: `installRemovedMembers`, `isRemovedApiStub`, `removedApi` from Task 1.
- Produces: at run time every removed callable name throws `DI_BAG_REMOVED_API`. Nothing is added to `src/index.ts`: the module is internal, so the public types do not change.

Nothing in this task was run when the plan was written, because it needs the 0.5.0 source and the final map. The install points below were read in the 0.4.0 source: `facade()` in `src/di-bag.ts` returns `Object.freeze({ ... })`, and `token()` in `src/tokens.ts` returns `Object.freeze({ of })`.

- [ ] **Step 1: Generate, and read the table**

```bash
node scripts/generate-removed-api.mjs
sed -n '/^export const removedApi/,/^});/p' src/removed-api.ts
```

Read every line of the table as a user would read the error message: "`<name>` was removed in 0.5.0; use `<replacement>`". Where the replacement misleads, because the call moved to another object, split in two, or needs an argument the old call did not have, add or correct an entry in the script's `replacementText` table, regenerate, and extend the fixture test if you added a new kind of case. Owners are the 0.4.0 declaration names, so the container's removed names are under `Bag`, and the object returned by `DiBag.token(key)` is the owner `token()`.

- [ ] **Step 2: Write the failing runtime test**

`tests/removed-api.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { DiBag } from '../src';
import { isRemovedApiStub, removedApi } from '../src/removed-api';

// One live object per owner in the generated table. Owners carry their 0.4.0 declaration names.
const builder = () => DiBag.createBuilder().withServices({ value: () => 1 });
const targets: Record<string, () => object> = {
  DiBagApi: () => DiBag,
  Builder: () => builder(),
  Bag: () => builder().buildContainer(),
  Module: () => builder().buildModule({ exportedServiceKeys: ['value'] }),
  'token()': () => DiBag.createToken(Symbol('removed-api')),
};

test('every owner in the generated table has a live object here', () => {
  expect(Object.keys(removedApi).filter(owner => targets[owner] === undefined)).toEqual([]);
});

test('every removed name is a hidden stub that throws DI_BAG_REMOVED_API and names its replacement', () => {
  for (const [owner, names] of Object.entries(removedApi)) {
    const target = targets[owner]!() as Record<string, unknown>;
    for (const [name, replacement] of Object.entries(names)) {
      const member = target[name];
      // A failure here prints the name: either the stub was never installed, or a live member still has this name.
      expect(`${owner}.${name} stub=${isRemovedApiStub(member)}`).toBe(`${owner}.${name} stub=true`);
      expect(Object.keys(target)).not.toContain(name);
      let error: (Error & { code?: string; details?: unknown }) | undefined;
      try { (member as () => never)(); } catch (caught) { error = caught as Error; }
      expect(error?.code).toBe('DI_BAG_REMOVED_API');
      expect(error?.details).toEqual({ operation: name, removed: `${owner}.${name}`, replacement });
      expect(error?.message).toStartWith(`DI_BAG_REMOVED_API: ${name} was removed in 0.5.0; use ${replacement}; see `);
    }
  }
});

test('a configured facade carries the stubs too, and the live API is all that Object.keys shows', () => {
  const configured = DiBag.withConfiguration({}) as unknown as Record<string, unknown>;
  for (const name of Object.keys(removedApi.DiBagApi ?? {})) expect(`${name} stub=${isRemovedApiStub(configured[name])}`).toBe(`${name} stub=true`);
  expect(Object.keys(DiBag).filter(name => isRemovedApiStub((DiBag as unknown as Record<string, unknown>)[name]))).toEqual([]);
});
```

Run: `bun test tests/removed-api.test.ts`. Expected: the first test passes or names a missing owner; the second fails on its first name with `stub=false`.

- [ ] **Step 3: Install**

In `src/di-bag.ts`, `facade()` builds the object, installs, then freezes. The return type stays `DiBagApi`, which is what keeps the stubs out of the public types:

```ts
import { installRemovedMembers } from './removed-api';

function facade(context: RuntimeContext): DiBagApi {
  const api: DiBagApi = {
    // ...every live member, exactly as it is today...
  };
  installRemovedMembers('DiBagApi', api);
  return Object.freeze(api);
}
```

After the class declarations in the same file, and in `src/module.ts` after `class Module`:

```ts
installRemovedMembers('Builder', Builder.prototype);
installRemovedMembers('Bag', Container.prototype);
```

```ts
installRemovedMembers('Module', Module.prototype);
```

In `src/tokens.ts`, the object that `createToken` returns is built, given the stubs of the owner `token()`, then frozen, the same three lines as the facade. If `src/removed-api.ts` importing `./errors` creates an import cycle with one of these files, `bun test` fails at load with a `ReferenceError` before any test runs: `src/errors.ts` imports nothing from them at 0.4.0, so this is not expected.

Two traps. A class FIELD with a removed name, even one that is only declared, becomes an own property set to `undefined` on every instance and hides the stub on the prototype; `Builder.contribute` was such a field at 0.4.0. The second test catches it with `stub=false`. And `installRemovedMembers` skips a name that the target still has, so a stub can never break a live call; if a name you expected to be a stub is skipped, the map lists as removed a name that is live, and the map is what is wrong.

Run `bun test tests/removed-api.test.ts`. Expected: `3 pass`.

- [ ] **Step 4: Keep the generated file current**

Append to `tests/removed-api-generator.test.ts`:

```ts

test('the committed src/removed-api.ts is what the generator writes from the real map', () => {
  const result = spawnSync('node', [script, '--check'], { cwd: resolve(__dirname, '..'), encoding: 'utf8' });
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
});
```

- [ ] **Step 5: The errors page**

Add to `docs/agent/errors.md`, after `DI_BAG_PLUGIN_VALIDATION` in the alphabetical order. `npm run docs:check` requires it as soon as `src/removed-api.ts` holds the code literal.

````markdown
### DI_BAG_REMOVED_API {#di-bag-removed-api}

**When:** code written for 0.4.0 or earlier calls a name that 0.5.0 removed, for
example `DiBag.fromFactory`, `builder.register`, `builder.build`, `bag.fork`.
TypeScript rejects the call at compile time; this error is what JavaScript, an
`any`-typed value, or generated code gets at run time.

**Cause:** 0.5.0 renamed the API. The old names stay for the 0.5 line as
functions that only throw. `details.removed` names the old call and
`details.replacement` says what to write instead.

**Fix:** write the replacement. For a whole project, run `npx di-bag-codemod`
BEFORE upgrading, while the 0.4.0 types are still installed; see the
[migration guide](../guides/migrating-to-0.5.md).

```ts
import { DiBag } from 'di-bag';

const legacy = DiBag as unknown as { fromFactory?: (factory: () => number) => unknown };
try {
  legacy.fromFactory?.(() => 1);
} catch (error) {
  console.error((error as { details: { replacement: string } }).details.replacement);
}
```
````

- [ ] **Step 6: Verify and commit**

```bash
npm run typecheck && bun test tests/removed-api.test.ts tests/removed-api-generator.test.ts
node scripts/error-code-inventory.mjs src > /dev/null; echo exit=$?      # expect exit=0: the new literal has a known owner
npm run build && npm run docs:generate && npm run docs:check
git add src tests/removed-api.test.ts tests/removed-api-generator.test.ts docs/agent docs/reference
git commit -m "feat(migration)!: removed 0.4.0 names throw DI_BAG_REMOVED_API and name their replacement"
```

---

### Task 3: Every old name fails to compile

Each phase added a line to `tests/types/negative/api-renaming.ts` for what it removed. This task proves that none was forgotten.

**Files:**
- Create: `tests/api-renaming-coverage.test.ts`
- Modify: `tests/types/negative/api-renaming.ts`

The first test below, the self-test of the word matching, was run when the plan was written and passes. The second reads the real map and fixture and was not run.

- [ ] **Step 1: The test**

`tests/api-renaming-coverage.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type RenameMap = { methods?: { owner: string; from: string }[]; types?: { from: string }[] };
const asWord = (name: string) => new RegExp(`(?<![A-Za-z0-9_$])${name.replace(/[$]/g, '\\$&')}(?![A-Za-z0-9_$])`);

/** The removed callable names and exported types that the negative fixture never mentions as a whole word. */
export function uncovered(map: RenameMap, fixture: string): string[] {
  const removed = [...(map.methods ?? []).map(entry => ({ label: `${entry.owner}.${entry.from}`, name: entry.from })), ...(map.types ?? []).map(entry => ({ label: entry.from, name: entry.from }))];
  return [...new Set(removed.filter(item => !asWord(item.name).test(fixture)).map(item => item.label))].sort();
}

test('a name counts only as a whole word', () => {
  const map = { methods: [{ owner: 'Builder', from: 'build' }, { owner: 'Builder', from: 'buildAndStart' }, { owner: 'Bag', from: 'fork' }], types: [{ from: 'Bag' }, { from: 'StartupOptions' }] };
  const fixture = "builder.buildAndStart(['a']);\ntype Removed = import('../../../src').StartupOptions;\nconst bags = 1; // DiBag\n";
  expect(uncovered(map, fixture)).toEqual(['Bag', 'Bag.fork', 'Builder.build']);
});

const mapFile = resolve(__dirname, '../tools/codemod/rename-map.json');
const fixtureFile = resolve(__dirname, 'types/negative/api-renaming.ts');
test('every removed method and type of the rename map has a line in the negative fixture', () => {
  expect(uncovered(JSON.parse(readFileSync(mapFile, 'utf8')), readFileSync(fixtureFile, 'utf8'))).toEqual([]);
});
```

Properties, options and string values are left out on purpose: `label`, `keys`, `from` and `to` are ordinary words, so their presence in the fixture proves nothing. Their removal is proven where it happened, by the type fixtures of phases 3 to 11.

- [ ] **Step 2: Run it, and add what it lists**

Run: `bun test tests/api-renaming-coverage.test.ts`. If the second test lists names, add one line per name to `tests/types/negative/api-renaming.ts` in the form its neighbours use: a comment `// diagnostic: <text the compiler prints>`, then the smallest expression that uses the old name. For a method that is `does not exist`; for an exported type it is `has no exported member`, written as `type RemovedX = import('../../../src').X;`. The import path must be exactly `'../../../src'`. Then run the compiler lane for that fixture, because only the compiler proves the diagnostic text: `npm run test:compiler`.

- [ ] **Step 3: Commit**

```bash
git add tests/api-renaming-coverage.test.ts tests/types/negative/api-renaming.ts
git commit -m "test(migration): every removed method and type has a negative compile fixture"
```

---

### Task 4: The migration guide

**Files:**
- Create: `scripts/generate-migration-guide.mjs`, `tests/migration-guide-generator.test.ts`, `tests/fixtures/migration-guide/map.json`, `tests/fixtures/migration-guide/guide.md`, `docs/guides/migrating-to-0.5.md`
- Modify: `tools/docs/vitepress.config.mjs` (sidebar), `README.md` (one link), `docs/README.md` if it lists the guides

The generator, its two fixtures and its test were run when the plan was written: red with the script absent, then `2 pass`.

- [ ] **Step 1: The fixtures**

If final Phase 4 evidence records the S5 fallback, make this fixture's `resolveAll` manual text explicitly say `resolveCollection(collectionToken)` and update the exact generated-row assertion accordingly. Do not rewrite the 0.4.0 column.

`tests/fixtures/migration-guide/map.json`:

```json
{
  "version": 1,
  "methods": [
    { "owner": "Builder", "from": "build", "to": "buildContainer" },
    { "owner": "Builder", "from": "alias", "to": "withServiceAlias", "transform": "positional-to-bag" },
    { "owner": "Bag", "from": "resolveAll", "manual": "resolve the collection token itself" }
  ],
  "options": [{ "owner": "Bag", "method": "close", "argument": 0, "from": "signal", "to": "abortSignal" }],
  "properties": [{ "owner": "Presence", "from": "present", "to": "isPresent" }],
  "values": [
    { "owner": "DiBagApi", "method": "withLifetime", "argument": 1, "from": "root", "to": "singleton:one-per-container-tree" },
    { "owner": "LifecycleEvent", "property": "kind", "from": "scope-opened", "to": "container-opened" }
  ],
  "types": [{ "from": "Bag", "to": "Container" }],
  "codes": [
    { "from": "DI_BAG_CYCLE", "to": "DI_BAG_DEPENDENCY_CYCLE" },
    { "from": "DI_BAG_INVALID_SCOPE", "manual": "split: DI_BAG_UNKNOWN_SERVICE_KEY | DI_BAG_INVALID_ARGUMENT" }
  ],
  "imports": [{ "from": "di-bag/node", "to": "di-bag" }, { "fromSuffix": "/src/node", "toSuffix": "/src" }]
}
```

`tests/fixtures/migration-guide/guide.md`:

```markdown
# Migrating

Written by hand, above.

<!-- generated:rename-tables:start -->
old block
<!-- generated:rename-tables:end -->

Written by hand, below.
```

- [ ] **Step 2: The failing test**

`tests/migration-guide-generator.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const script = resolve(__dirname, '../scripts/generate-migration-guide.mjs');
const fixtures = resolve(__dirname, 'fixtures/migration-guide');
function workspace() {
  const guide = join(mkdtempSync(join(tmpdir(), 'migration-guide-')), 'guide.md');
  copyFileSync(join(fixtures, 'guide.md'), guide);
  return { guide, run: (...flags: string[]) => spawnSync('node', [script, '--map', join(fixtures, 'map.json'), '--guide', guide, ...flags], { encoding: 'utf8' }) };
}

test('the tables replace the block between the markers and leave the hand-written text alone', () => {
  const { guide, run } = workspace();
  const result = run();
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('11 rows');
  const text = readFileSync(guide, 'utf8');
  expect(text.startsWith('# Migrating\n\nWritten by hand, above.\n\n<!-- generated:rename-tables:start -->\n')).toBe(true);
  expect(text.endsWith('<!-- generated:rename-tables:end -->\n\nWritten by hand, below.\n')).toBe(true);
  expect(text).not.toContain('old block');
  expect(text).toContain('### Container, which was `Bag`\n\n| 0.4.0 | 0.5.0 |\n| --- | --- |\n| `resolveAll(...)` | by hand: resolve the collection token itself |');
  expect(text).toContain('| `alias(...)` | `withServiceAlias(...)`, with reshaped arguments |');
  expect(text).toContain("| `close({ signal })` | `close({ abortSignal })` |");
  expect(text).toContain("| `'root'` in `withLifetime(...)` | `'singleton:one-per-container-tree'` |");
  expect(text).toContain("| `'scope-opened'` in `LifecycleEvent.kind` | `'container-opened'` |");
  // A vertical bar inside a cell would end the cell, so it is escaped.
  expect(text).toContain('| `DI_BAG_INVALID_SCOPE` | by hand: split: DI_BAG_UNKNOWN_SERVICE_KEY \\| DI_BAG_INVALID_ARGUMENT |');
  // A suffix rule has no single old specifier to show, so it has no row.
  expect(text).toContain("| `'di-bag/node'` | `'di-bag'` |");
  expect(text).not.toContain('/src/node');
});

test('--check accepts a current guide, rejects a stale one, and a guide without markers is an error', () => {
  const { guide, run } = workspace();
  expect(run('--check').status).toBe(1);
  expect(run().status).toBe(0);
  expect(run('--check').status).toBe(0);
  writeFileSync(guide, '# no markers\n');
  const broken = run();
  expect(broken.status).toBe(2);
  expect(broken.stderr).toContain('needs the two markers');
});
```

Run it. Expected: `0 pass`, `2 fail`, `Expected: 0`, `Received: 1`.

- [ ] **Step 3: The script**

`scripts/generate-migration-guide.mjs`:

```js
// Writes the rename tables of docs/guides/migrating-to-0.5.md from tools/codemod/rename-map.json, between two markers.
// Everything outside the markers is written by hand and is left alone.
// Usage: node scripts/generate-migration-guide.mjs [--map <file>] [--guide <file>] [--check]
import { readFileSync, writeFileSync } from 'node:fs';

const option = name => { const index = process.argv.indexOf(name); return index === -1 ? undefined : process.argv[index + 1]; };
const mapFile = option('--map') ?? 'tools/codemod/rename-map.json';
const guideFile = option('--guide') ?? 'docs/guides/migrating-to-0.5.md';
const START = '<!-- generated:rename-tables:start -->', END = '<!-- generated:rename-tables:end -->';

const map = JSON.parse(readFileSync(mapFile, 'utf8'));
const code = text => '`' + String(text).replaceAll('|', '\\|') + '`';
const after = entry => entry.to === undefined ? `by hand: ${String(entry.manual).replaceAll('|', '\\|')}` : code(entry.to);
const heading = { DiBagApi: 'The facade, `DiBag`', Builder: 'Builder', Bag: 'Container, which was `Bag`', Module: 'Module', Provider: 'Provider' };
const byOwner = entries => { const groups = new Map(); for (const entry of entries) groups.set(entry.owner, [...(groups.get(entry.owner) ?? []), entry]); return [...groups].sort(([a], [b]) => a.localeCompare(b)); };
const table = (head, rows) => rows.length ? [`| ${head[0]} | ${head[1]} |`, '| --- | --- |', ...rows.map(([before, now]) => `| ${before} | ${now} |`), ''] : [];

const lines = [START, '', '<!-- Generated by scripts/generate-migration-guide.mjs from tools/codemod/rename-map.json. Edit the map, not this block. -->', ''];
for (const [owner, entries] of byOwner(map.methods ?? [])) {
  lines.push(`### ${heading[owner] ?? code(owner)}`, '');
  lines.push(...table(['0.4.0', '0.5.0'], entries.map(entry => [code(`${entry.from}(...)`), entry.to === undefined ? after(entry) : code(`${entry.to}(...)`) + (entry.transform ? ', with reshaped arguments' : '')])));
}
const options = (map.options ?? []).map(entry => [code(`${entry.method}({ ${entry.from} })`), entry.to === undefined ? after(entry) : code(`${entry.method}({ ${entry.to} })`)]);
if (options.length) lines.push('### Option names', '', ...table(['0.4.0', '0.5.0'], options));
const properties = (map.properties ?? []).map(entry => [code(`${entry.owner}.${entry.from}`), after(entry)]);
if (properties.length) lines.push('### Fields of options, snapshots, events and errors', '', ...table(['0.4.0', '0.5.0'], properties));
const values = (map.values ?? []).map(entry => [code(`'${entry.from}'`) + ` in ${code(entry.property === undefined ? `${entry.method}(...)` : `${entry.owner}.${entry.property}`)}`, entry.to === undefined ? after(entry) : code(`'${entry.to}'`)]);
if (values.length) lines.push('### String values', '', ...table(['0.4.0', '0.5.0'], values));
const types = (map.types ?? []).map(entry => [code(entry.from), after(entry)]);
if (types.length) lines.push('### Exported types and classes', '', ...table(['0.4.0', '0.5.0'], types));
const codes = (map.codes ?? []).map(entry => [code(entry.from), after(entry)]);
if (codes.length) lines.push('### Runtime error codes', '', ...table(['0.4.0', '0.5.0'], codes));
const imports = (map.imports ?? []).filter(entry => entry.from !== undefined).map(entry => [code(`'${entry.from}'`), after({ ...entry, to: entry.to === undefined ? undefined : `'${entry.to}'` })]);
if (imports.length) lines.push('### Import specifiers', '', ...table(['0.4.0', '0.5.0'], imports));
lines.push(END);
const block = lines.join('\n');

const guide = readFileSync(guideFile, 'utf8');
const start = guide.indexOf(START), end = guide.indexOf(END);
if (start === -1 || end === -1 || end < start) { console.error(`${guideFile} needs the two markers ${START} and ${END}`); process.exit(2); }
const next = guide.slice(0, start) + block + guide.slice(end + END.length);
if (process.argv.includes('--check')) {
  if (next !== guide) { console.error(`${guideFile} is stale: run node scripts/generate-migration-guide.mjs`); process.exit(1); }
} else {
  writeFileSync(guideFile, next);
  console.log(`${guideFile}: ${block.split('\n').filter(line => line.startsWith('| `')).length} rows`);
}
```

Run the test again. Expected: `2 pass`.

- [ ] **Step 4: Write the guide**

Create `docs/guides/migrating-to-0.5.md` with the text below, then run `node scripts/generate-migration-guide.mjs`, which fills the block between the two markers. Every code block in it is 0.5.0 code and is checked by `npm run docs:check` if phase 12 extended the snippet check to the guides; if it did not, type-check the three blocks by hand in a scratch file against the built package.

````markdown
# Migrating from 0.4 to 0.5 {#migrating-to-0-5}

0.5.0 renames almost every public name so that a call reads as a sentence, and
changes four behaviors. Nothing else moved: the graph, the lifetimes, disposal
and the compile-time checks work as before. This page is the whole path.

## 1. Run the codemod before you upgrade {#run-the-codemod}

The codemod is type-aware: it rewrites a call only when the TypeScript checker
resolves it to a `di-bag` declaration, which is how it tells `builder.replace`
from `String.prototype.replace`. It therefore needs the 0.4.0 types to be
installed while it runs. Upgrade afterwards.

```sh
npx di-bag-codemod --project tsconfig.json            # dry run: prints what it would change
npx di-bag-codemod --project tsconfig.json --write --report di-bag-codemod-report.json
npm install di-bag@0.5
npx tsc --noEmit
```

Whatever it could not decide is in the report, with file, line and the reason.
It never guesses. What it does not read: Markdown, source code held in strings,
and JavaScript without types. For those, the old names still exist at run time
as functions that throw `DI_BAG_REMOVED_API` and name their replacement, so a
missed call fails loudly the first time it runs.

## 2. Four things that behave differently {#behavior-changes}

**A provider without a lifetime is a singleton.** In 0.4.0 it was scoped, one
instance per container. In 0.5.0 it is built once for the whole container tree.
With a single container nothing changes. If your project creates child
containers, the codemod detects that and marks every provider that had no
lifetime as `'scoped:one-per-container'`, which is exactly its old meaning; pass
`--pin-lifetimes` to force that in a project where it found no child container.
Afterwards remove the mark wherever one shared instance is what you want.

```ts
import { DiBag } from 'di-bag';

let nextId = 0;
const request = DiBag.createProvider(() => ({ id: ++nextId })).withLifetime('scoped:one-per-container');
const app = DiBag.createBuilder().withServices({ clock: () => ({ now: () => Date.now() }), request }).buildContainer();
const perRequest = app.createChildContainer();
console.log(perRequest.resolve('clock') === app.resolve('clock'), perRequest.resolve('request') === app.resolve('request'));
await app.close();
```

That prints `true false`: the clock is shared, the request is not.

**A child container replaces only scoped and transient services.** Replacing a
singleton in a child does not compile, because every other container of the
tree would keep the original. Mark the service scoped, or use
`createIndependentContainer`, which may replace anything.

**A token is either for one service or for a collection.** In 0.4.0 one token
could carry a single service and contributions at the same time. Now
`createToken(symbol).forService<S>()` and `createToken(symbol).forCollectionOf<Item>()`
are different tokens, a collection is read with plain `resolve(collectionToken)`
or by listing the token as a dependency, and `DiBag.all`, `resolveAll` and
`inspectAll` are gone. The codemod converts a token that was only ever
contributed to. A token used both ways is reported, and you split it by hand
into two tokens.

```ts
import { DiBag } from 'di-bag';

const sinks = DiBag.createToken(Symbol('sinks')).forCollectionOf<(line: string) => void>();
const app = DiBag.createBuilder()
  .withCollectionContribution({ collectionToken: sinks, provider: () => (line: string) => console.log(line) })
  .buildContainer();
for (const write of app.resolve(sinks)) write('ready');
await app.close();
```

When writing this Task 4 guide from a recorded S5 fallback, replace only the collection-read prose and example above with `resolveCollection(collectionToken)` and `app.resolveCollection(sinks)`. A collection token listed as a dependency remains bare and unchanged.

**There is one entry point.** `di-bag/node` is removed. Import everything from
`di-bag`; the package finds the host's Promise classifier by itself, and
`DiBag.withConfiguration({ runtime })` still overrides it.

## 3. Errors {#errors}

A runtime code now names a kind of failure and never a method; the method is in
`details.operation`. Every malformed argument, whatever the call, is
`DI_BAG_INVALID_ARGUMENT` with `details: { operation, argument, expected }`.
If your code branches on `error.code`, check it against the table of codes
below: six old codes were split, and for those the right new code depends on
what went wrong, so the codemod reports them instead of rewriting them.
`DiBagCleanupError` is `DiBagDisposalError`, the startup errors are the service
readiness errors, and their `cleanup...` fields are `disposal...`.

```ts
import { DiBag } from 'di-bag';

try {
  DiBag.createProvider(42 as never);
} catch (error) {
  const { operation, argument, expected } = (error as { details: Record<string, unknown> }).details;
  console.error(`${String(operation)}: ${String(argument)} must be ${String(expected)}`);
}
```

## 4. Every rename {#every-rename}

<!-- generated:rename-tables:start -->
<!-- generated:rename-tables:end -->

## 5. If something is still red {#still-red}

- A name the compiler does not know: find it in the tables above.
- `DI_BAG_REMOVED_API` at run time: the message names the replacement.
- A singleton that now captures a scoped service does not compile: either the
  captured service should be a singleton too, or the capturing one should be
  scoped. See [the errors page](../agent/errors.md#singleton-captures-scoped).
- A test that counted instances per container: the default lifetime changed, see
  section 2.
````

- [ ] **Step 5: Link it, keep it current, commit**

In `tools/docs/vitepress.config.mjs`, in the group `Start here`, add after the tutorial: `{ text: 'Migrating to 0.5', link: '/guides/migrating-to-0.5' },`. In `README.md`, add one sentence with a link to the guide where the README first names the version. Append to `tests/migration-guide-generator.test.ts`:

```ts

test('the committed guide holds the tables that the real map produces', () => {
  const result = spawnSync('node', [script, '--check'], { cwd: resolve(__dirname, '..'), encoding: 'utf8' });
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
});
```

```bash
bun test tests/migration-guide-generator.test.ts          # expect 3 pass
npm run docs:check && npm run docs:build                  # expect exit 0: no dead link, the new page builds
git add scripts/generate-migration-guide.mjs tests/migration-guide-generator.test.ts tests/fixtures/migration-guide docs/guides/migrating-to-0.5.md tools/docs/vitepress.config.mjs README.md
git commit -m "docs(migration): guide to 0.5 with rename tables generated from the codemod's map"
```

---

### Task 5: Codemod acceptance on the 0.4.0 examples

The spec's acceptance: the codemod turns the 0.4.0 copies of `examples/` into code that type-checks against 0.5.0 without hand edits, and a 0.4.0 project with child scopes into one that still behaves. `examples/scopes.ts` and `examples/wbs-scope.ts` are that project: they create child scopes and assert on what they resolve.

**Files:**
- Create: `scripts/codemod-acceptance.mjs`
- Modify: `package.json` (script `codemod:acceptance`), `.gitignore` (`tools/codemod/.acceptance/`), `.github/workflows/ci.yml`

What was run when the plan was written: the first half of the script, `--prepare-only`, on a scratch copy. It extracted 20 example files from the tag `v0.4.0`, rewrote their `'../src'` imports to `'di-bag'` at every directory depth, and left no import of the source tree behind. Everything after that needs the codemod and the 0.5.0 build and was NOT run.

- [ ] **Step 1: The script**

`scripts/codemod-acceptance.mjs`:

```js
// Acceptance for di-bag-codemod: the examples as they were at the v0.4.0 tag are migrated by the codemod alone and must
// then type-check and run against the 0.5.0 build, with no hand edits.
// Usage, from the repository root, after `npm run build`: node scripts/codemod-acceptance.mjs [--prepare-only] [--keep]
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const TAG = 'v0.4.0';
// Inside the repository on purpose: module resolution walks up to the root node_modules for react and the type packages,
// while the workspace's own node_modules/di-bag decides which di-bag the examples see.
const work = 'tools/codemod/.acceptance';
const library = join(work, 'node_modules/di-bag');
const vendored = 'tools/codemod/test/fixtures/node_modules/di-bag';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const step = (title, command, args, options = {}) => {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status !== 0) { console.error(`FAILED: ${title}\n${result.stdout}${result.stderr}`); process.exit(1); }
  console.log(`ok: ${title}`);
  return result.stdout;
};

rmSync(work, { recursive: true, force: true });
const files = git('ls-tree', '-r', '--name-only', TAG, 'examples/').split('\n').filter(name => /\.tsx?$/.test(name));
if (files.length === 0) { console.error(`no examples at ${TAG}: is the tag fetched?`); process.exit(1); }
for (const file of files) {
  const target = join(work, file);
  mkdirSync(dirname(target), { recursive: true });
  // At the tag the examples import the source tree. A user's project imports the package, so rewrite exactly that specifier.
  const depth = file.split('/').length - 1;
  const source = `'${'../'.repeat(depth)}src'`;
  const text = git('show', `${TAG}:${file}`);
  writeFileSync(target, text.replaceAll(source, "'di-bag'").replaceAll(`'${'../'.repeat(depth)}src/node'`, "'di-bag/node'"));
}
const compilerOptions = { ...JSON.parse(git('show', `${TAG}:tsconfig.json`)).compilerOptions, rootDir: '.' };
writeFileSync(join(work, 'tsconfig.json'), JSON.stringify({ compilerOptions, include: ['examples'] }, null, 2) + '\n');
writeFileSync(join(work, 'package.json'), JSON.stringify({ name: 'di-bag-codemod-acceptance', private: true, type: 'module' }, null, 2) + '\n');
const leftovers = files.filter(file => /from '(\.\.\/)+src/.test(readFileSync(join(work, file), 'utf8')));
if (leftovers.length) { console.error(`these examples still import the source tree: ${leftovers.join(', ')}`); process.exit(1); }
console.log(`ok: ${files.length} examples from ${TAG} in ${work}`);
if (process.argv.includes('--prepare-only')) process.exit(0);

// 1. The project as a 0.4.0 user has it: the published 0.4.0 declarations, which phase 1 vendored for the codemod's own tests.
if (!existsSync(join(vendored, 'package.json'))) { console.error(`${vendored} is missing: phase 1 vendors it`); process.exit(1); }
cpSync(vendored, library, { recursive: true });
step('the 0.4.0 examples type-check against 0.4.0 before the codemod runs', 'node_modules/.bin/tsc6', ['-p', join(work, 'tsconfig.json')]);

// 2. The codemod, exactly as the README tells a user to run it: before upgrading, with no library root.
const report = join(work, 'codemod-report.json');
step('the codemod rewrites the project', 'node', ['tools/codemod/cli.mjs', '--project', join(work, 'tsconfig.json'), '--write', '--report', report]);
const manual = JSON.parse(readFileSync(report, 'utf8')).manual ?? [];
if (manual.length) { console.error(`the codemod left ${manual.length} manual item(s); acceptance allows none:\n${manual.map(item => `  ${item.file}:${item.line} ${item.reason}`).join('\n')}`); process.exit(1); }
console.log('ok: no manual items');

// 3. The upgrade: the package this checkout builds.
if (!existsSync('dist/index.d.ts')) { console.error('dist is missing: run npm run build first'); process.exit(1); }
rmSync(library, { recursive: true, force: true });
mkdirSync(library, { recursive: true });
cpSync('dist', join(library, 'dist'), { recursive: true });
cpSync('package.json', join(library, 'package.json'));
step('the migrated examples type-check against the 0.5.0 build', 'node_modules/.bin/tsc6', ['-p', join(work, 'tsconfig.json')]);

// 4. They still do what they did. The React examples need a browser and are covered by check:react-browser.
for (const file of files.filter(name => !name.startsWith('examples/react/'))) step(`bun run ${file}`, 'bun', ['run', join(work, file)]);
if (!process.argv.includes('--keep')) rmSync(work, { recursive: true, force: true });
console.log('codemod acceptance passed');
```

Add to `package.json` scripts: `"codemod:acceptance": "node scripts/codemod-acceptance.mjs"`. Add the line `tools/codemod/.acceptance/` to `.gitignore`.

- [ ] **Step 2: Run it**

```bash
npm run build
node scripts/codemod-acceptance.mjs --keep
```

Expected: a line `ok: ...` per step and `codemod acceptance passed`. Each way it can fail is a finding, not an obstacle to route around:

- `FAILED: the 0.4.0 examples type-check against 0.4.0 before the codemod runs`: the workspace is wrong, not the codemod. Read the diagnostics; the usual cause is a type package that does not resolve from `tools/codemod/.acceptance`.
- `the codemod left N manual item(s)`: acceptance allows none. Either a transform is missing a case, which you fix in `tools/codemod` with a fixture pair that reproduces it, or the item is one the spec declares manual. The spec declares exactly one kind: a token used both for a single service and for contributions. At the 0.4.0 tag no example does that, so the allowed number here is zero.
- `FAILED: the migrated examples type-check against the 0.5.0 build`: the codemod produced code that is not valid 0.5.0. Reproduce the smallest case as a fixture pair in `tools/codemod/test/fixtures/`, fix the transform, run `npm run codemod:check`, and run the acceptance again. Never edit the migrated examples by hand: "without hand edits" is the point of the test.
- `FAILED: bun run examples/...`: the migrated example compiles and behaves differently. The likely cause is the singleton default: a provider that had no lifetime and is resolved in a child scope must have been pinned to `'scoped:one-per-container'` by the codemod. Look at the migrated file under `tools/codemod/.acceptance/examples/`.

- [ ] **Step 3: CI, commit**

In `.github/workflows/ci.yml`, job `contracts`, after the step `- run: npm run codemod:check`, add with the same indentation `- run: npm run codemod:acceptance`. It runs after `npm run check`, which has already built `dist`.

```bash
git add scripts/codemod-acceptance.mjs package.json .gitignore .github/workflows/ci.yml tools/codemod
git commit -m "test(codemod): the 0.4.0 examples migrate to 0.5.0 with no hand edits"
```

---

### Task 6: `di-bag-codemod` 0.1.0 becomes publishable

Phase 1 shaped the package like `tools/graph`, with `README.md`, `LICENSE`, `bin`, `files`, `engines` and a pack test, and left it private.

**Files:**
- Modify: `tools/codemod/package.json`, `tools/codemod/README.md`, `.github/workflows/ci.yml`, `PUBLISHING.md`

- [ ] **Step 1: Remove `"private": true`, keep the version at 0.1.0**

```bash
node -e "const fs=require('fs'),f='tools/codemod/package.json',p=JSON.parse(fs.readFileSync(f));delete p.private;fs.writeFileSync(f,JSON.stringify(p,null,2)+'\n')"
npm install --prefix tools/codemod --package-lock-only --no-audit --no-fund
npm run codemod:check      # the pack test asserts the archive's file list; it must still pass
```

- [ ] **Step 2: The README says when to run it**

Make sure `tools/codemod/README.md` states, in its first screen: run it BEFORE upgrading, because it resolves calls through the installed 0.4.0 types; the dry run is the default and `--write` applies; `--report <file>` lists what it left for a person; `--pin-lifetimes`; and a link to `docs/guides/migrating-to-0.5.md`. If phase 1's text already says all of that, change nothing.

- [ ] **Step 3: A packed smoke test in CI, next to the graph tool's**

In `.github/workflows/ci.yml`, after the step `Smoke-test the packed graph tool`, add:

```yaml
      - name: Smoke-test the packed codemod
        run: |
          consumer="$(mktemp -d)"
          mkdir -p "$consumer/packs"
          printf '%s\n' '{ "name": "codemod-consumer", "private": true, "type": "module" }' > "$consumer/package.json"
          printf '%s\n' '{ "compilerOptions": { "strict": true, "noEmit": true, "module": "NodeNext", "moduleResolution": "NodeNext", "target": "es2022", "skipLibCheck": true }, "include": ["app.ts"] }' > "$consumer/tsconfig.json"
          printf '%s\n' "import { DiBag } from 'di-bag';" "export const app = DiBag.createBuilder().register({ value: () => 1 }).build();" > "$consumer/app.ts"
          npm pack ./tools/codemod --pack-destination "$consumer/packs"
          cd "$consumer"
          npm install --no-audit --no-fund packs/*.tgz
          cp -R "$GITHUB_WORKSPACE/tools/codemod/test/fixtures/node_modules/di-bag" node_modules/di-bag
          npx di-bag-codemod --project tsconfig.json --write
          grep -q "withServices" app.ts
          grep -q "buildContainer" app.ts
```

The 0.4.0 types are copied in AFTER `npm install`, because an install removes packages that `package.json` does not list. Run the same lines locally once, with `$GITHUB_WORKSPACE` replaced by the repository root, before committing.

- [ ] **Step 4: `PUBLISHING.md`**

After the section "Releasing di-bag-graph", add a section "Releasing di-bag-codemod" with the same five steps, the paths changed to `tools/codemod`, the check to `npm run codemod:check` and `npm run codemod:acceptance`, and the smoke test's name.

- [ ] **Step 5: Commit**

```bash
git add tools/codemod/package.json tools/codemod/package-lock.json tools/codemod/README.md .github/workflows/ci.yml PUBLISHING.md
git commit -m "feat(codemod): di-bag-codemod 0.1.0 is publishable, with a packed smoke test"
```

---

### Task 7: `di-bag-graph` 0.2.0

The tool reads builder chains by NAME from source text, so phases 5 to 10 already taught `tools/graph/lib/extract.mjs` the 0.5.0 names. This task releases that. It has no dependency on `di-bag` (its only dependency is `typescript`), so there is no range to update.

- [ ] **Step 1: Confirm it reads 0.5.0 and no longer needs 0.4.0**

```bash
grep -nE "'(register|build|installModule|alias|replace|contribute|withDisposal|withLifetime)'" tools/graph/lib/extract.mjs
npm ci --prefix tools/graph --no-audit --no-fund && npm run graph:check
```

The `grep` lists every name the extractor still matches. A 0.4.0 builder name there (`register`, `build`, `installModule`, `alias`, `replace`, `contribute`) is a leftover from an earlier phase: the tool's 0.2.0 reads 0.5.0 projects only, so remove it together with its test. `withDisposal` and `withLifetime` stay, they are provider methods now.

- [ ] **Step 2: Decide the output keys, once**

The tool prints one node per service: `{ key, line, dependencies, async, lifetime, owned }`. `lifetime` already carries the 0.5.0 values after phase 9. Rename `owned` to `isOwnedByContainer`, the name `BindingSnapshot` uses for the same fact, so the two packages say one thing one way; this is a breaking change of the tool's JSON and 0.2.0 is where it belongs. Change it in `tools/graph/lib/extract.mjs` (at 0.4.0: one variable in `unwrap`, two destructurings and two object literals), in `tools/graph/test/extract.test.mjs` (the `deepEqual` on the `db` node), in `tools/graph/README.md` (the description of `nodes`), and in any consumer under `scripts/agent-eval` that reads `owned` from the tool's output: `grep -rn "\.owned\b\|owned:" scripts/agent-eval tools/graph` lists them. At 0.4.0 that search finds only the tool's own test; `scripts/agent-eval/lib/harness.mjs` uses the word `owned` for module directories, which is unrelated and stays. `key`, `line`, `dependencies` and `async` stay.

- [ ] **Step 3: Version, lockfile, check, commit**

```bash
(cd tools/graph && npm version 0.2.0 --no-git-tag-version) && npm install --prefix tools/graph --package-lock-only --no-audit --no-fund
npm run graph:check && npm run agent-eval:test
git add tools/graph scripts/agent-eval
git commit -m "feat(graph)!: di-bag-graph 0.2.0 reads 0.5.0 projects; owned becomes isOwnedByContainer"
```

---

### Task 8: Version 0.5.0 and the changelog

Phase 5 selected the positional replacement fallback; release snippets and scanners must not recreate
the rejected options bag outside an explicitly historical/custom-map control. Keep this execution instruction outside the changelog payload.

**Files:**
- Modify: `package.json`, `package-lock.json`, `CHANGELOG.md`, `PUBLISHING.md`, `tests/release-artifacts.test.ts`, `README.md`

- [ ] **Step 1: The version, everywhere it is written**

```bash
npm version 0.5.0 --no-git-tag-version
grep -rn "0\.4\.0" --include='*.ts' --include='*.mjs' --include='*.json' --include='*.md' --include='*.yml' . | grep -v "node_modules\|CHANGELOG.md\|docs/superpowers\|package-lock\|/dist/\|tools/docs/site\|tools/codemod/\|migrating-to-0.5\|\.related-repos"
```

At the 0.4.0 source that search listed four lines of `PUBLISHING.md` and one assertion, `version: '0.4.0'` in `tests/release-artifacts.test.ts`; the 0.4.0 release commit changed exactly those. Change each to `0.5.0`. Everything under `tools/codemod/` that says 0.4.0 is the vendored old package or a statement about it, and stays.

- [ ] **Step 2: The changelog**

When final Phase 4 evidence records the S5 fallback, the collection bullet in the changelog text below must say `resolveCollection(collectionToken)`; keep ordinary dependency wording and the statements that `resolveAll`/`inspectAll` were removed.

Insert above `## 0.4.0` in `CHANGELOG.md`. Replace the two bracketed counts with the numbers from your tree (`node scripts/error-code-inventory.mjs src 2>/dev/null | cut -f4 | tr '|' '\n' | sort -u | wc -l` for the codes); everything else is final text.

````markdown
## 0.5.0

The API is pre-1.0. This release renames almost every public name, so that a
call reads as a sentence and an option says what it holds, and it changes four
behaviors. Run the codemod BEFORE upgrading, then read the
[migration guide](docs/guides/migrating-to-0.5.md), which lists every rename.

### Migration

- `npx di-bag-codemod --project tsconfig.json --write` rewrites a project while
  the 0.4.0 types are still installed. It is type-aware, reshapes arguments,
  pins lifetimes where a project creates child containers, and reports what it
  cannot decide. New package: `di-bag-codemod` 0.1.0.
- Every removed callable name still exists at run time for the 0.5 line as a
  function that throws `DI_BAG_REMOVED_API` and names its replacement in
  `details.replacement`. The types do not have it, so TypeScript rejects the
  call at compile time.

### Breaking changes: behavior

- A provider without a lifetime is a singleton, built once for a container
  tree. It was scoped. With one container nothing changes. Lifetime values are
  `'singleton:one-per-container-tree'`, `'scoped:one-per-container'` and
  `'transient:one-per-resolve'`; the short forms are rejected with a message
  that names the full one.
- A child container replaces only scoped and transient services. Replacing a
  singleton in a child does not compile; `createIndependentContainer` may
  replace anything.
- A token is either for one service, `createToken(symbol).forService<S>()`, or
  for a collection, `createToken(symbol).forCollectionOf<Item>()`. A collection
  is read with `resolve(collectionToken)` or as an ordinary dependency.
  `DiBag.all`, `resolveAll` and `inspectAll` are removed. Using a token of the
  wrong kind is a compile error and `DI_BAG_WRONG_TOKEN_KIND` at run time.
- `di-bag/node` is removed. Import from `di-bag`; the package finds the host's
  Promise classifier by itself.

### Breaking changes: names

- The builder: `withServices`, `withTokenService`, `withServiceAlias`,
  `withCollectionContribution`, `withReplacedService(serviceKey, provider)`, `withInstalledModules`
  (a list), `verifyGraphAtCompileTime`, `buildModule({ exportedServiceKeys,
  moduleLabel })`, `buildContainer`. `buildAndStart` is
  `container.ensureServicesReady(serviceKeys, options)`.
- The container, which was `Bag`: `serviceSnapshot`, `graphSnapshot`,
  `createChildContainer`, `createIndependentContainer`, each with one options
  bag, and `close({ abortSignal, waitTimeoutMs })`.
- Providers: `DiBag.createProvider`, `createProviderFromFunction`,
  `createProviderFromClass`, `createProviderFromPlugin`, with
  `factoryReturnKind` and `factoryReceivesContext`. Decorators are methods of
  the provider: `withDisposal`, `withLifetime`, `withRegistrationMetadata`,
  `withAcquisitionMetadata`, `withTransformedService`.
- Modules: `withRenamedExport({ currentExportKey, newExportKey })`.
- Configuration: `withConfiguration({ runtime, lifecycleObservers })`, an
  observer being `{ onLifecycleEvent, onObserverFailure }`.
- Snapshots and events: `isPresent`, `bindingLabel`, `serviceKeys`,
  `isOwnedByContainer`, `factoryReturnKind`, `tokenSymbol`, `dependencyKind`,
  `collectionTokenSymbol`, `consumerBindingId`, `dependencyBindingId`,
  `containerId`, `parentContainerId`; event kinds `container-*` and
  `disposal-*`.
- Errors: a code names a kind of failure and never a method, which is in
  `details.operation`. [N] codes replace the 42 of 0.4.0. Every malformed
  argument is `DI_BAG_INVALID_ARGUMENT` with `details: { operation, argument,
  expected }`. `DiBagCleanupError` is `DiBagDisposalError`, the startup errors
  are `DiBagServiceReadinessError` and `DiBagServiceReadinessCancelledError`,
  and `cleanup...` fields are `disposal...`. The guide has the full table,
  including the six codes that were split.

### Added

- `module.withRenamedRequirement({ currentRequirementKey, newRequirementKey })`
  renames what a module requires, without a wrapper module.
- `ensureServicesReady` works on any container, reports what is still pending
  when it is cancelled, and takes `maxConcurrentServiceKeys`.
- `FactoryContext.abortSignal`, and a factory context for positional factories.
- `docs/guides/api-naming.md`, the naming rules this release follows, with a
  test that holds the public surface to them.

### Tools

- `di-bag-graph` 0.2.0 reads 0.5.0 builder chains. Its node field `owned` is now
  `isOwnedByContainer`.
- `di-bag-codemod` 0.1.0, see Migration.

### Measured

- Compiler cost on the twelve evidence cases stayed within [+N%] of 0.4.0;
  `docs/benchmarks/typescript.md` shows 0.4.0 and 0.5.0 side by side.
````

- [ ] **Step 3: Verify and commit**

```bash
bun test tests/release-artifacts.test.ts tests/package.test.ts     # expect 0 fail
npm run docs:check
git add package.json package-lock.json CHANGELOG.md PUBLISHING.md README.md tests/release-artifacts.test.ts
git commit -m "chore(release): 0.5.0"
```

---

### Task 9: Refresh the benchmark page

`docs/benchmarks/typescript.md` records compiler cost per graph size. Its numbers are from 0.4.0 and its prose uses 0.4.0 names.

- [ ] **Step 1: Memory first**

The active heavy-command hold must first be lifted. A single-compiler exception does not authorize these matrices. Run `free -g`. Each command below can need up to 17 GB. With less than 18 GB in the `available` column, do not start: report to the controller and go on with Task 10, which does not depend on this page. Never run two of these at once, and never while `npm run check` runs. Preparing Task 10 while this task is held does not complete Task 9: the required final matrices remain pending and block release completion unless the maintainer explicitly changes that scope.

- [ ] **Step 2: One at a time, in this order**

```bash
npm run benchmark:types
npm run benchmark:types -- --tokens
npm run benchmark:types -- --native
npm run benchmark:types -- --native --tokens
npm run benchmark:compiler-controls
npm run benchmark:compiler-ceiling
npm run benchmark:compiler-ceiling -- --native --from 1000 --to 2500
```

These are the page's own reproduction commands. After each, copy its table into the page where the 0.4.0 table is, and keep the 0.4.0 number next to the new one in a column named "0.4.0", so the change is visible. State the change per row in percent. The program's budget was +10% of instantiations on the twelve evidence cases; a row of this page that grew by more than that is reported to the controller with its numbers, not hidden.

- [ ] **Step 3: Names in prose, commit**

Replace 0.4.0 API names in the page's prose and captions by their 0.5.0 names (`register` by `withServices`, `build` by `buildContainer`, `installModule` by `withInstalledModules`, and so on from the migration guide's tables). Then:

```bash
npm run docs:check
git add docs/benchmarks/typescript.md
git commit -m "docs(benchmarks): compiler cost at 0.5.0 next to 0.4.0"
```

---

### Task 10: The release candidate

Follow `PUBLISHING.md`, section "Local candidate workflow", exactly. It is reproduced here so that the list cannot drift from what was reviewed; if the file on your tree differs, the file wins and you report the difference.

- [ ] **Step 1: A clean, recorded commit**

```bash
git status --short          # expect no output
git rev-parse HEAD          # record it: this is the candidate commit
free -g                     # the compiler lane of npm run check is heavy; with less than 12 GB available, wait and tell the controller
```

- [ ] **Step 2: The required local gates, in order, each to completion**

```bash
npm ci
npm ci --prefix tools/docs
npm run platform:pin
mkdir -p /tmp/di-bag-release-candidate
npm run check
npm run typecheck:native
npm run build:native
npm run check:native
npm run docs:check
npm run docs:build
npm run graph:check
npm run codemod:check
npm run codemod:acceptance
npm run agent-eval:test
node --expose-gc --test --test-isolation=none tests/runtime-scale.node.mjs tests/acquisition-retention.node.mjs tests/graph-retention.node.mjs
bun test tests/final-adversarial-integration.test.ts
bun test tests/package.test.ts
bun test tests/native-package.test.ts
for example in provider-metadata composition contributions modules observers plugins scopes tokens wbs-scope; do bun run examples/$example.ts || exit 1; done
bun test tests/release-artifacts.test.ts
npm run build
npm pack --dry-run
npm run build
npm pack --ignore-scripts --json --pack-destination /tmp/di-bag-release-candidate
npm pack ./tools/graph --pack-destination /tmp/di-bag-release-candidate
npm pack ./tools/codemod --pack-destination /tmp/di-bag-release-candidate
```

`npm run check:platform` and `npm run check:react-browser` need Deno, a browser and the platform tools; run them if `npm ci --prefix tools/platform` and the Playwright install succeed on this machine, otherwise say in the report that CI is what proves them. A flaky timeout in the compiler lane under load is handled by the master plan's rule: rerun that file alone once, and report it.

- [ ] **Step 3: Inspect the three archives as untrusted input**

```bash
cd /tmp/di-bag-release-candidate
for archive in di-bag-0.5.0.tgz di-bag-graph-0.2.0.tgz di-bag-codemod-0.1.0.tgz; do echo "== $archive"; tar -tzf $archive | sort; sha256sum $archive; done
tar -xOzf di-bag-0.5.0.tgz package/package.json | node -e "const p=JSON.parse(require('fs').readFileSync(0));console.log(p.name,p.version,JSON.stringify(p.exports),Object.keys(p.dependencies??{}).length)"
```

Expected for `di-bag`: only `package/LICENSE`, `package/README.md`, `package/package.json`, `package/AGENTS.md`, `package/docs/agent/*` and `package/dist/*`; name `di-bag`, version `0.5.0`; `exports` with the single key `"."` (the `./node` entry is gone); zero dependencies. No file under `dist` is named `node.js` or `node.d.ts`. Expected for the two tools: the file lists their pack tests assert. Then install the library archive into a fresh directory and load it both ways:

```bash
consumer="$(mktemp -d)" && cd "$consumer" && npm init -y >/dev/null
npm install --offline --ignore-scripts --no-audit --no-fund --no-package-lock /tmp/di-bag-release-candidate/di-bag-0.5.0.tgz
node -e "const { DiBag } = require('di-bag'); const app = DiBag.createBuilder().withServices({ value: () => 42 }).buildContainer(); console.log(app.resolve('value')); try { DiBag.fromFactory(() => 1) } catch (error) { console.log(error.code) }"
node --input-type=module -e "import { DiBag } from 'di-bag'; console.log(typeof DiBag.createProvider)"
```

Expected output: `42`, `DI_BAG_REMOVED_API`, `function`.

- [ ] **Step 4: Record the candidate**

Write `/tmp/di-bag-release-candidate/candidate.txt` with the candidate commit, the three archive names with their SHA-256, the tool versions (`node -v`, `npm -v`, `bun -v`, `npx tsc6 -v`, `npx tsc -v`), and the last line of every gate. This file is local evidence and is NOT committed. Nothing in this task changes the repository; if a gate made you change a file, commit the fix, and start Task 10 again from Step 1 on the new commit.

---

### Task 11: Prove the spec acceptance list on the exact candidate

Every line must hold on the candidate commit. Read the assertions in the named tests and run them; a search result locates evidence but never proves behavior or a diagnostic location. Record the test name, command, exit status and candidate hash for each row. Reuse existing tests rather than adding duplicates. If a spec-authorized measured fallback was selected, cite its failed criterion and recorded decision, then run the fallback's complete acceptance cases; do not silently mark the preferred shape as passing.

| Spec acceptance item | Proof |
| --- | --- |
| The naming test passes with an empty known-violations list | `bun test tests/api-naming.test.ts` and `node -e "console.log(require('./tests/api-naming-known-violations.json').violations.length)"` prints `0` |
| No token is accepted by both `withTokenService` and `withCollectionContribution`, at compile time and at run time | Run `bun test tests/collection-tokens.test.ts` and the candidate compiler lane (`npm run test:compiler`); inspect the single/collection channel rejection assertions and the corresponding `tests/types/negative/collection-tokens.ts` markers |
| An independent container replaces a whole collection, and `ensureServicesReady` waits for a collection | Run `bun test tests/collection-tokens.test.ts`; inspect whole-list replacement, direct/lazy/alias fresh frozen views, and readiness success/failure cases |
| `withRenamedRequirement` renames a requirement without a wrapper module | Run `bun test tests/requirement-renaming.test.ts` plus the candidate compiler lane; inspect direct/nested/private-shadow/renamed-requirement fixtures and their exact type errors |
| A provider without a lifetime is built once per tree; a singleton that depends on a scoped service does not compile; neither does replacing a singleton in a child | Run `bun test tests/singleton-default.test.ts` and the candidate compiler lane; inspect instance-count assertions and capture/child-replacement diagnostic locations. If S8 retained scoped default, run its explicitly recorded replacement-rule and scoped-default fixtures instead and report that measured exception |
| Only the full lifetime values are accepted; `'scoped'` alone is rejected with a message that names `'scoped:one-per-container'` | Run `bun test tests/provider-methods.test.ts` and the candidate compiler lane; inspect rejection of each short lifetime value and the exact full-value guidance in runtime errors |
| The codemod turns a 0.4.0 project with child scopes into one whose tests pass unchanged; the 0.4.0 examples type-check against 0.5.0 without hand edits | `npm run codemod:acceptance` |
| `withInstalledModules` reports an export collision on the list element that causes it, and installs in list order | Run `bun test tests/builder-renames.test.ts` and the candidate compiler lane; inspect contribution order and the exact offending list-element diagnostic in `tests/types/negative/installed-modules.ts`. Under S7 fallback, run its sequential-install order/collision cases and report the recorded shape exception |
| No 0.4.0 name in the rename map compiles, and each throws `DI_BAG_REMOVED_API` at run time | `bun test tests/api-renaming-coverage.test.ts tests/removed-api.test.ts` and `npm run test:compiler` |
| `npm run check`, `docs:check`, `graph:check`, `check:native`, `check:platform`, `check:react-browser` pass on `next` | Task 10, and CI on the pull request for the two platform lanes |
| Every API card summary passes the "or" test, and every task in the "one way per task" table names a 0.5.0 call | `npm run docs:check`, which runs `tools/docs/test/api-card-summaries.test.mjs`; and `node -e "for (const t of require('./tools/docs/api-card-tasks.json')) console.log(JSON.stringify(t))"` read against the migration guide's tables |

If a named test moved or disappeared, find its replacement and inspect its assertions. Missing behavior or location coverage requires a focused test and a new verified candidate commit; a passing filename search, message substring, or empty filtered test run cannot close an item. The compiler lane may run once for all rows on the unchanged candidate; record its shared log instead of repeating it per row.

---

### Task 12: Report to the controller

Reply in the master plan's format and add: the candidate commit; the three archive names with their SHA-256; every gate's last line; the benchmark changes by row, or the reason Task 9 was not run; every manual item or transform fix that Task 5 needed; what `check:platform` and `check:react-browser` did on this machine. Then STOP. Do not push.

---

## For the controller only: push, merge, publish, tag

The executor does not run anything in this section. Each step is outward-facing or irreversible; do them in order and stop at the first surprise.

1. `git push -u origin next`. Open the pull request: `gh pr create --base main --head next --title "di-bag 0.5.0: Swift API style" --body-file <a file holding the CHANGELOG 0.5.0 section>`.
2. Wait for CI on the pull request: `gh pr checks --watch`. Both jobs must be green, including the two platform lanes that the local candidate may not have run.
3. `gh pr merge --merge`. If the permission system refuses the merge, STOP and report to the user. Do not push to `main` any other way.
4. Re-create the three archives from the MERGE commit with Task 10 Step 2's last six lines, and compare their SHA-256 with the candidate's. `npm pack` is deterministic for identical content; a difference means the merge changed content, and the candidate must be re-verified.
5. Registry checks, read-only: `npm view di-bag@0.5.0 version`, `npm view di-bag-graph@0.2.0 version`, `npm view di-bag-codemod version`. Each must print nothing or a 404. A version that exists cannot be overwritten: stop.
6. Publish in this order, each from the verified archive, with the token only through a user config file outside the repository, and never pipe the output into `head`:

```bash
npm publish /tmp/di-bag-release-candidate/di-bag-graph-0.2.0.tgz   --access public --userconfig <scratchpad>/publish.npmrc
npm publish /tmp/di-bag-release-candidate/di-bag-codemod-0.1.0.tgz --access public --userconfig <scratchpad>/publish.npmrc
npm publish /tmp/di-bag-release-candidate/di-bag-0.5.0.tgz         --access public --userconfig <scratchpad>/publish.npmrc
```

   The tools go first, because the library's guide and changelog tell readers to run `npx di-bag-codemod`. Provenance is not used: it needs a CI identity, and 0.2.0 to 0.4.0 were published from a local archive in the same way (master plan, assumption 7).
7. Confirm: `npm view di-bag version`, `npm view di-bag-graph version`, `npm view di-bag-codemod version` print `0.5.0`, `0.2.0`, `0.1.0`. In a fresh directory, `npm install di-bag@0.5.0` and run the two `node -e` lines of Task 10 Step 3.
8. Tag the merge commit and push the tag: `git tag -a v0.5.0 <merge commit> -m "di-bag 0.5.0"`, `git push origin v0.5.0`. Create the GitHub release from the changelog section: `gh release create v0.5.0 --title "0.5.0" --notes-file <the same file as in step 1>`.
9. If a published version turns out defective, follow "Immutable-version recovery" in `PUBLISHING.md`: a new patch version, never an overwrite.

## Assumptions made in this plan

1. **Stubs for callable names only.** The spec says "every removed runtime name". A removed FIELD of a returned value gets no stub, because a throwing getter breaks logging and serialisation of snapshots and errors.
2. **Coverage instead of generation for the negative fixture.** The spec says the fixture "is extended from the rename map". A test that fails when the map has a name the fixture lacks enforces that, and keeps the hand-written lines, whose diagnostics were each verified by the phase that wrote them.
3. **`di-bag-graph` 0.2.0 renames its output key `owned` to `isOwnedByContainer`.** The spec does not mention the tool's JSON. One fact, one name across both packages; 0.2.0 is the breaking release of the tool anyway.
4. **Acceptance allows zero manual items on the 0.4.0 examples**, because none of them uses one token on both channels.
5. **No provenance**, as in the master plan.

## Self-review

**Spec coverage.** "Migration support": type-aware codemod, published as `di-bag-codemod` (Tasks 5 and 6); throwing stubs (Tasks 1 and 2); compile-time removal (Task 3); lifetimes pinned by the codemod (phase 10 built it, Task 5 proves it on `examples/scopes.ts` and `examples/wbs-scope.ts`, the guide documents it); a migration guide generated from the same map and a breaking-changes section in the changelog (Tasks 4 and 8); manual steps reported, not performed (the guide, section 2). "Acceptance": Task 11, item by item. Master plan, phase 13: `di-bag-graph` 0.2.0 (Task 7), changelog and version (Task 8), release candidate gates (Task 10).

**What was run when this plan was written.** Run: both generators with their fixtures and tests, red and green; the generated stub module next to the real `src/errors.ts` (message, frozen details, a live member never replaced, stubs not enumerable on a frozen object); the self-test of the coverage test; the workspace half of the acceptance script against the real `v0.4.0` tag (20 files); the 0.4.0 equivalent of the guide's first example, which prints `true false`; the entry checks that do not need phase 1. Not run: everything that needs the 0.5.0 API, the final map or the codemod, which is Task 2's runtime test and install code, the second coverage test, the three guide examples and the errors-page example in their 0.5.0 form, the acceptance script after `--prepare-only`, the CI smoke test, and every gate of Task 10.

**Names used across tasks.** `installRemovedMembers`, `isRemovedApiStub`, `removedApi` (Task 1, used by Task 2); the markers `<!-- generated:rename-tables:start -->` and `<!-- generated:rename-tables:end -->` (Task 4, in the script, the fixture and the guide); `tools/codemod/.acceptance` (Task 5, in the script and `.gitignore`); `/tmp/di-bag-release-candidate` (Tasks 10 and the controller's section).
