# Observability and Errors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename snapshot and event fields, adopt the disposal vocabulary, and replace the per-method runtime codes with codes that name a failure kind.

**Architecture:** A code names a failure kind and never a method; the method is in `details.operation`. Each target code lands in one commit that changes its throw sites, writes its section in `docs/agent/errors.md` and deletes the sections that are no longer raised, because `npm run docs:check` requires a section for every code in `src` and rejects a section whose code `src` no longer raises. The list of throw sites is produced by a committed script at the start of the phase, not copied from this plan, because phases 3 to 10 reword most messages.

**Tech Stack:** TypeScript 6.0.2, Bun 1.4.0 tests, Node 24.20.0 scripts, the docs checks under `tools/docs`.

**Spec:** `docs/superpowers/specs/2026-09-20-swift-api-style.md`, sections "Snapshots and events" and "Errors". Master plan: `docs/superpowers/plans/2026-09-21-00-swift-api-style-master.md`, phase 11.

## Global Constraints

- Names and codes are exactly those in the spec. The spec wins over this plan.
- Runtime messages keep the format `DI_BAG_CODE: message; see <errors page>#<anchor>`; the anchor derives from the code in `diagnosticMessage` (`src/errors.ts`).
- `npm run docs:check` enforces, in `tools/docs/lib/agent-docs.mjs` `checkErrorCoverage`: every `'DI_BAG_X'` literal anywhere in `src` has a heading `### DI_BAG_X {#di-bag-x}` in `docs/agent/errors.md`, and every such heading names a code that still appears in `src`. Both directions fail the check, so a code and its section change in the same commit.
- Each section keeps the page's format: **When**, **Cause**, **Fix**, one `ts` example, optional **Recipe**. Examples are type-checked against the emitted declarations.
- The inventory is the list of THROW SITES, not the list of places to edit. At the 0.4.0 source `src` holds 123 single-quoted code literals and another 99 backticked mentions, 54 of them in `src/di-bag.ts`, nearly all in JSDoc `@throws` lines. `checkErrorCoverage` and the inventory script both match single quotes only, so neither sees a stale backticked code. A stale one is caught late and indirectly: the API card renders it as a link to `errors.md#<old-anchor>`, and the site check in `npm run docs:check` reports `missing anchor`.
- Every per-code task therefore ends with the same gate, which ignores quoting: the two `grep` commands that the facts script of Task 2 prints as its last two lines for that code, one for the old code and one for the old anchor, must both print nothing. They search `src tests examples scripts AGENTS.md README.md docs/agent docs/guides tools/docs/lib tools/docs/test tools/docs/*.json tools/graph/lib tools/graph/test tools/graph/README.md` and end the pattern with `([^A-Z_]|$)`, so that the new code `DI_BAG_DUPLICATE_METADATA_KEY` is not mistaken for the old `DI_BAG_DUPLICATE_METADATA`. `tools/codemod` is left out on purpose: `rename-map.json` keeps `"from": "<OLD_CODE>"` for good, because the map describes the distance from 0.4.0, and the codemod's fixtures use old codes as input. `CHANGELOG.md` and `docs/superpowers` are left out for the same kind of reason. Do not add them to the search and do not 'fix' what it would find there. Run `npm run build && npm run docs:generate` before the gate so the generated API card and reference are current.
- Anchors: a runtime message's URL is built by `diagnosticMessage` from the code, so it follows a rename by itself. URLs written by hand do not follow, and `src` holds three of them at 0.4.0, all in JSDoc `@see` lines: `src/errors.ts` links to `#di-bag-cleanup-failed` and to `#di-bag-close-timeout`, and `src/startup.ts` links to `#di-bag-close-timeout`. One of the three breaks in this phase: `#di-bag-cleanup-failed` becomes `#di-bag-disposal-failed`. `checkMessageUrlsInSources` resolves every site URL found in `src` to an existing heading, so a missed one fails `npm run docs:check` with `names a missing anchor`. Find them with `grep -rnoE "errors\.html#di-bag-[a-z0-9-]+" src`. Outside `docs/agent`, an errors-page anchor occurs ten times (`AGENTS.md` 4, `docs/guides/tutorial.md` 5, `docs/guides/api-reference.md` 1). Six are real Markdown links and four are plain text inside a code span, which the site check ignores. Exactly one real link breaks in this phase: `docs/guides/tutorial.md` links to `#di-bag-cleanup-after-factory`. The `#root-capture` link in `AGENTS.md` belongs to phase 9. The guides and READMEs mention the 24 codes this phase renames only three times in total (`DI_BAG_CYCLE` twice as example text, `DI_BAG_CLEANUP_AFTER_FACTORY` once in that link), so `docs/guides` stays in the gate above: fixing those three is a text edit, not a guide rewrite, which is phase 12.
- What the codemod does with a code (phase 1 plan, fixture `codes`, and its rewrite looks the WHOLE text of a string literal up in the map): it rewrites a string literal or plain template whose entire text is the code, and only when the map gives one target, `{ "from", "to" }`. It reports, without rewriting, every old code that still occurs: a code inside a longer string such as `'DI_BAG_INVALID_FACTORY: fromSyncFactory requires a function'` or a test title, a regular expression, a template with substitutions, a comment, and ANY occurrence of a split code, `{ "from", "manual" }`, even a string equal to it. In the words of the phase 1 plan it does not read "Markdown, generated source held in strings, or JavaScript without types", so `tests/*.node.mjs` is edited by hand with no report at all; only the gate above catches a miss there. For codes the codemod is therefore a reporting tool. Counted at the 0.4.0 source by running the facts script of Task 2 once per code: the 24 codes this phase renames occur 30 times in tests, in 11 of the 24 codes. Four occurrences are rewritten (`DI_BAG_CYCLE`, `DI_BAG_DUPLICATE_METADATA`, `DI_BAG_INVALID_CLOSE`, `DI_BAG_MISSING_REGISTRATION`, one each), 22 are edited after a report (5 equal strings of split codes, 17 whole-message assertions, titles, regular expressions and templates), and 4 are in `tests/runtime-scale.node.mjs`. A whole-message assertion such as `/^DI_BAG_CYCLE: cycle: a -> b -> d -> a; see https:...errors\.html#di-bag-cycle$/` needs two edits: the code, and the URL fragment after `#`. These counts are a prediction from the phase 1 plan's rules: the codemod did not exist when this plan was written.
- Thirteen of the 24 codes have NO occurrence in the tests: the suite asserts on message text (about 385 `toThrow` assertions with a string or a regular expression) far more than on codes (15 `.code` assertions). That includes the most heavily split codes, `DI_BAG_INVALID_SCOPE`, `DI_BAG_INVALID_OVERRIDE`, `DI_BAG_INVALID_STARTUP` and `DI_BAG_INVALID_REGISTRATION`, so nothing fails today if a throw site receives the wrong new code. Rule for every task below: each throw site whose code changes gets an assertion on its new `code` and on its `details`, written first and seen to fail. Where an assertion on the old code exists, edit it; where none exists, add one next to the test that already triggers that condition (find it by the site's message text).
- `AGENTS.md` is at its 150-line budget: edits must not add lines.
- Never delete, skip or weaken a test. Most caught errors in tests are typed `any`, so the compiler does not flag a missed field rename: use the audit greps in each task.
- Gates, commit format and the expand, migrate, contract protocol are in the master plan.

## State on entry

Phases 0 to 10 are merged. Already renamed, do NOT redo: the service readiness errors and codes and the `CloseProgress` fields (phase 3); `DI_BAG_WRONG_TOKEN_KIND` (phase 4); `DI_BAG_UNKNOWN_SERVICE_KEY` and `DI_BAG_DUPLICATE_SERVICE_KEY` as raised by `withRenamedRequirement` (phase 7); `factoryReturnKind` in snapshots (phase 8); lifetime values, `allowsScopedDependencies` and the `singleton-captures-scoped` family (phase 9); the child-container replacement error (phase 10); every `details.operation` value (each phase).

Confirm with the three checks below. Each was run against the 0.4.0 source to prove it fires: there, check 1 lists three files, check 2 reports 12 hits in code and 9 in comments, and check 3 finds neither name because the field is still `owned`.

```bash
# 1. Phase 3 landed: no startup code is left. Expect no output.
grep -c "DI_BAG_STARTUP" src/*.ts | grep -v ":0"

# 2. Phases 3 and 6 landed: the old method names are gone from CODE. Expect 0.
grep -rn "buildAndStart\|createScope(\|\.fork(" src | grep -vcE ':[0-9]+:\s*(\*|//|/\*\*)'
#    The same names in comments or JSDoc are stale prose, not a missing phase. Fix them in passing; do not stop for them.
grep -rn "buildAndStart\|createScope(\|\.fork(" src | grep -cE ':[0-9]+:\s*(\*|//|/\*\*)'

# 3. This phase has not run yet: the first grep prints nothing, the second prints the line `readonly owned: boolean;`.
grep -n "isOwnedByContainer\|isOwnedByBag" src/inspection.ts; grep -n "readonly owned" src/inspection.ts
```

A non-zero count in check 2's first command, or any output from check 1, means an earlier phase is incomplete: stop and report it to the controller instead of renaming around it.

## File Structure

| File | Responsibility |
| --- | --- |
| `scripts/error-code-inventory.mjs` (create) | lists every SINGLE-QUOTED `DI_BAG_` literal in `src`, which is every throw site, with its owning call and message; exits 1 unless each one is accounted for and every `DI_BAG_INVALID_ARGUMENT` site names `operation`, `argument` and `expected`. It does not see backticked mentions in JSDoc |
| `tests/error-code-inventory.test.ts` (create) | drives the script as a process against a fixture directory |
| `scripts/error-code-facts.mjs` (create) | read-only facts for ONE rename: throw sites, JSDoc mentions, test occurrences by what the codemod does with them, Markdown mentions and real links, longer codes sharing the prefix |
| `tests/error-code-facts.test.ts`, `tests/fixtures/error-code-facts/` (create) | drives that script inside a miniature repository |
| `tests/error-code-taxonomy.test.ts` (create) | one row per throw site whose code changes: the call that reaches it, the new code, the details it must carry. 73 rows, added by Tasks 5 to 9 |
| `tests/observability-field-names.test.ts` (create) | one scenario that pins the new snapshot, failure and event field names and the nine event kinds (Tasks 10 and 11) |
| `src/errors.ts`, `src/startup.ts`, and every file the inventory lists (modify) | new codes and `details` |
| `src/inspection.ts`, `src/observers.ts`, `src/runtime.ts`, `src/acquisition.ts` (modify) | field, kind and type renames |
| `docs/agent/errors.md` (modify) | one section per new code, each listing the operations that raise it |
| `tools/codemod/rename-map.json` (modify) | `codes`, `properties`, `values` and `types` entries; one new fixture pair, `snapshot-fields` |
| `tests/types/negative/api-renaming.ts` (modify) | one line per removed export: `DiBagCleanupError`, `CleanupFailure`, `ScopeEventFields` |

---

### Task 1: The throw-site inventory script

**Files:**
- Create: `scripts/error-code-inventory.mjs`
- Test: `tests/error-code-inventory.test.ts`

**Interfaces:**
- Produces: `node scripts/error-code-inventory.mjs [dir] [--json]`. Standard output is one tab-separated row per line of source that holds a code: `file`, `line`, `owner`, `codes` joined by `|`, `message`. Standard error is one summary line. With `--json` a row whose code is `DI_BAG_INVALID_ARGUMENT` also has `missingDetails`, the list of `operation`, `argument` and `expected` keys that its details do not name. Exit code 0 only when every literal is accounted for, no row is `UNCLASSIFIED`, and no row has a missing detail key. The last rule is the ratchet for Task 9: a site cannot take the new code without the three keys the spec requires.

- [ ] **Step 1: Create the three fixtures**

They are valid TypeScript, because `tsconfig.json` includes everything under `tests/` and only excludes `tests/types/negative` and `tests/types/isolated`. The `declare function` lines exist so the file compiles; nothing runs it, the script reads it as text. Do not add an `exclude` to `tsconfig.json`. The fixtures use codes that this phase keeps (`DI_BAG_CLOSING`, `DI_BAG_CLOSED`, `DI_BAG_INVALID_DEPENDENCY_ACCESS`) or invented ones (`DI_BAG_SAMPLE_OPTIONS`, `DI_BAG_ORPHAN`). Never put a code that this phase retires into a fixture: the gate of every rename task reads `tests` and would report it for ever.

`tests/fixtures/error-code-inventory/ok/sample.ts`:

```ts
// Fixture for tests/error-code-inventory.test.ts. It compiles, but nothing runs it: the script reads it as text.
declare function libraryError(code: string, message: string, details?: object): Error;
declare function snapshotOptions(value: unknown, operation: string, code: string, supported: readonly string[]): object | undefined;

/** Raises 'DI_BAG_IN_JSDOC' when things go wrong. */
export class Sample extends Error { declare readonly code: 'DI_BAG_DECLARED'; }
function assertOpen(state: string) {
  if (state !== 'open') throw libraryError(state === 'closing' ? 'DI_BAG_CLOSING' : 'DI_BAG_CLOSED', `bag is ${state}`, { state });
}
function options(value: unknown) {
  const selected = snapshotOptions(value, 'close', 'DI_BAG_SAMPLE_OPTIONS', ['signal']);
  if (selected === undefined) return;
  if (typeof value !== 'object' || value === null) throw libraryError('DI_BAG_SAMPLE_OPTIONS', 'close options must be an object', { operation: 'close' });
}
function access(label: string) {
  return libraryError(
    'DI_BAG_INVALID_DEPENDENCY_ACCESS',
    `Cannot inspect the dependencies of ${label}`,
  );
}
```

`tests/fixtures/error-code-inventory/bad/orphan.ts`:

```ts
export const orphan = 'DI_BAG_ORPHAN';
```

`tests/fixtures/error-code-inventory/incomplete/sample.ts`:

```ts
// Fixture for tests/error-code-inventory.test.ts: DI_BAG_INVALID_ARGUMENT must carry operation, argument and expected.
declare function libraryError(code: string, message: string, details?: object): Error;

export function complete(operation: string) {
  return libraryError('DI_BAG_INVALID_ARGUMENT', `${operation} options must be an object`, {
    operation,
    argument: 'options',
    expected: 'an object',
  });
}
export const missingExpected = libraryError('DI_BAG_INVALID_ARGUMENT', 'close waitTimeoutMs must be a number', { operation: 'close', argument: 'waitTimeoutMs' });
export const wordOnlyInMessage = libraryError('DI_BAG_INVALID_ARGUMENT', 'resolve expected one argument', { operation: 'resolve' });
```

Its third site is the trap: the words `expected` and `argument` occur in the MESSAGE, not in the details, and must not count.

- [ ] **Step 2: Write the failing test**

The test drives the script as a process, because a strict `.ts` test cannot import an untyped `.mjs` module (phase 0 set this precedent with `tests/evidence-cases.test.ts`). Each test pins one bug the extractor had while it was being developed.

`tests/error-code-inventory.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const script = resolve(__dirname, '../scripts/error-code-inventory.mjs');
function run(directory: string) {
  const result = spawnSync('node', [script, resolve(__dirname, 'fixtures/error-code-inventory', directory), '--json'], { encoding: 'utf8' });
  return { status: result.status, summary: result.stderr.trim(), rows: JSON.parse(result.stdout) as Array<{ line: number; owner: string; codes: string[]; message: string; missingDetails?: string[] }> };
}

test('every literal is accounted for, and declarations and JSDoc are not rows', () => {
  const { status, summary, rows } = run('ok');
  expect(status).toBe(0);
  expect(summary).toBe('literals: 7; accounted: 7; rows: 4; codes: 4; unclassified: 0; incomplete details: 0');
  expect(rows.flatMap(row => row.codes)).not.toContain('DI_BAG_IN_JSDOC');
  expect(rows.flatMap(row => row.codes)).not.toContain('DI_BAG_DECLARED');
});

test('a ternary is one row with two codes and its own message', () => {
  const row = run('ok').rows.find(item => item.codes.length === 2)!;
  expect(row.codes).toEqual(['DI_BAG_CLOSING', 'DI_BAG_CLOSED']);
  expect(row.message).toBe('bag is ${state}');
});

test('a helper call does not borrow the message of a throw two lines below', () => {
  const [helper, thrower] = run('ok').rows.filter(item => item.codes[0] === 'DI_BAG_SAMPLE_OPTIONS');
  expect(helper!.owner).toBe('snapshotOptions');
  expect(helper!.message).toBe('');
  expect(thrower!.message).toBe('close options must be an object');
});

test('a call split over lines finds its message on the next line', () => {
  const row = run('ok').rows.find(item => item.codes[0] === 'DI_BAG_INVALID_DEPENDENCY_ACCESS')!;
  expect(row.owner).toBe('libraryError');
  expect(row.message).toBe('Cannot inspect the dependencies of ${label}');
});

test('a literal with no recognisable owner fails the run', () => {
  const { status, summary } = run('bad');
  expect(status).toBe(1);
  expect(summary).toContain('unclassified: 1');
});

test('DI_BAG_INVALID_ARGUMENT must carry operation, argument and expected; a word in the message does not count', () => {
  const { status, summary, rows } = run('incomplete');
  expect(status).toBe(1);
  expect(summary).toContain('unclassified: 0; incomplete details: 2');
  expect(rows.map(row => row.missingDetails)).toEqual([[], ['expected'], ['argument', 'expected']]);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun test tests/error-code-inventory.test.ts`

Expected: `0 pass`, `6 fail`. Every test fails with `SyntaxError: JSON Parse error: Unexpected EOF`, because the script does not exist yet and the helper parses empty output.

- [ ] **Step 4: Create the script**
```js
// Lists every DI_BAG_ code literal in src with its owning call and message. Exits 1 unless every literal is accounted for
// and every DI_BAG_INVALID_ARGUMENT site names operation, argument and expected in its details.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? 'src';
const literal = /'(DI_BAG_[A-Z_]+)'/g;
const starter = /\b(libraryError|libraryTypeError|diagnosticMessage|diagnostic|snapshotOptions|classifierRequired)\(/;
const argument = /^\s*,\s*(`(?:[^`\\]|\\.)*`|'(?:[^'\\]|\\.)*')/;
const rows = [];
let found = 0, accounted = 0;

for (const file of readdirSync(root).filter(name => name.endsWith('.ts')).sort()) {
  const lines = readFileSync(join(root, file), 'utf8').split('\n');
  lines.forEach((line, index) => {
    const matches = [...line.matchAll(literal)];
    if (!matches.length) return;
    found += matches.length;
    const text = line.trim();
    const nonThrow = text.startsWith('*') || text.startsWith('//') || text.startsWith('/**')
      || text.includes('declare readonly code') || /^export type DiBagErrorCode/.test(text);
    if (nonThrow) { accounted += matches.length; return; }
    let owner;
    for (let back = 0; back < 3 && index - back >= 0 && !owner; back++) owner = starter.exec(lines[index - back])?.[1];
    owner ??= /const code\s*=/.test(line) ? 'code variable' : 'UNCLASSIFIED';
    // Anchor on the LAST literal of THIS line, then read the string argument that follows it, across line breaks.
    const last = matches[matches.length - 1];
    const tail = line.slice(last.index + last[0].length) + ' ' + lines.slice(index + 1, index + 3).map(next => next.trim()).join(' ');
    const quoted = argument.exec(tail)?.[1];
    const message = quoted?.slice(1, -1) ?? '';
    accounted += matches.length;
    const row = { file: `${root}/${file}`, line: index + 1, owner, codes: matches.map(match => match[1]), message };
    if (row.codes.includes('DI_BAG_INVALID_ARGUMENT') && /^library(Type)?Error$/.test(owner)) {
      // The details are whatever follows the message up to the end of the statement; a word inside the message does not count.
      const rest = (line.slice(last.index + last[0].length) + ' ' + lines.slice(index + 1, index + 6).map(next => next.trim()).join(' ')).replace(quoted ?? '', '');
      const details = rest.slice(0, rest.indexOf(');') === -1 ? rest.length : rest.indexOf(');'));
      row.missingDetails = ['operation', 'argument', 'expected'].filter(key => !new RegExp(`\\b${key}\\b`).test(details));
    }
    rows.push(row);
  });
}

const unclassified = rows.filter(row => row.owner === 'UNCLASSIFIED');
const incomplete = rows.filter(row => row.missingDetails?.length);
if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 2));
else for (const row of rows) console.log([row.file, row.line, row.owner, row.codes.join('|'), row.message].join('\t'));
console.error(`literals: ${found}; accounted: ${accounted}; rows: ${rows.length}; codes: ${new Set(rows.flatMap(row => row.codes)).size}; unclassified: ${unclassified.length}; incomplete details: ${incomplete.length}`);
process.exitCode = found === accounted && unclassified.length === 0 && incomplete.length === 0 ? 0 : 1;
```

Why it is written this way, so nobody "simplifies" it back into a bug. The message is read from the text that follows the literal ON ITS OWN LINE; an earlier version searched a three-line window for the first quoted span and captured fragments of code, and a second version let a line borrow the message of a throw two lines below when both named the same code. A line with two literals, such as `closing ? 'DI_BAG_CLOSING' : 'DI_BAG_CLOSED'`, is one row with two codes. An error class appears twice, once for `diagnosticMessage` and once for `diagnostic`. Rows are therefore not a count of throw statements. The details of a `DI_BAG_INVALID_ARGUMENT` site are read from the text after its message up to the end of the statement, with the message itself removed first; leaving the message in makes the last test fail and no other, which was checked when the plan was written. The check reads an object literal written at the throw site, so do not move such details into a variable.

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun test tests/error-code-inventory.test.ts`

Expected: `6 pass`, `0 fail`. The file is not listed in `scripts/test-lane.mjs`, so it joins the fast lane, whose total grows by six.

Then run `npm run typecheck`. Expected: no error. The three fixtures were type-checked on their own under the project's strict options when this plan was written.

- [ ] **Step 6: Run the script on the library**

Run: `node scripts/error-code-inventory.mjs src > /tmp/error-code-inventory.tsv; echo exit=$?`

Expected: `exit=0` and a summary line on standard error with `unclassified: 0` and equal `literals` and `accounted` numbers. For reference only, the 0.4.0 source gave `literals: 123; accounted: 123; rows: 110; codes: 42; unclassified: 0; incomplete details: 0`; your numbers differ because phases 3 to 10 changed codes and messages. If the exit code is 1 and the summary says `incomplete details: N` with `unclassified: 0`, an earlier phase introduced `DI_BAG_INVALID_ARGUMENT` sites without the three keys: that is work for Task 9, which ends with this number at 0, so continue. If the exit code is 1 because `unclassified` is not 0 or the two totals differ, a throw site uses a shape the script does not know: extend `starter` or the non-throw rules, add a fixture line and a test for the new shape, and only then continue. Keep `/tmp/error-code-inventory.tsv`: Tasks 4 to 9 find their throw sites in it, by old code and message text, never by line number.

- [ ] **Step 7: Commit**

```bash
git add scripts/error-code-inventory.mjs tests/error-code-inventory.test.ts tests/fixtures/error-code-inventory
git commit -m "test(errors): inventory every runtime code literal in src"
```

Use the full commit format from the master plan, with the two attribution lines.

---

### Task 2: The per-code facts script

Every rename task below starts from the same questions: where is the code raised, which tests quote it and in what form, which pages mention it, does a longer code share its prefix, and what exactly must be gone afterwards. This script answers them in one read-only run, so no task relies on a line number or a count copied from 0.4.0.

**Files:**
- Create: `scripts/error-code-facts.mjs`
- Test: `tests/error-code-facts.test.ts`
- Create: a miniature repository under `tests/fixtures/error-code-facts/` (five files)

**Interfaces:**
- Produces: `node scripts/error-code-facts.mjs OLD_CODE NEW_CODE`, run from the repository root. It reads `src`, `tests`, `AGENTS.md`, `README.md`, `docs/agent`, `docs/guides` and `tools/graph/README.md` relative to the working directory, writes nothing, and exits 0. With fewer than two well-formed codes it prints a usage line on standard error and exits 2.
- Produces: three labels for an occurrence in `tests`, which the rename tasks quote. `string equal to the code (codemod rewrites)`: a string literal whose whole text is the code. `other TypeScript occurrence (codemod reports, edit by hand)`: the code inside a longer string, a title, a regular expression or a template. `JavaScript without types (not reported, edit by hand)`: any occurrence in a `.mjs` file. For a SPLIT code, one the map gives `manual` instead of `to`, the codemod rewrites nothing, so read the first label as "reported" too.
- Produces: the last two lines of its output are THE GATE for that code, two `grep` commands that must print nothing once the rename is complete. Every rename task ends by running them. They are boundary-safe: `DI_BAG_DUPLICATE_METADATA([^A-Z_]|$)` does not match the new code `DI_BAG_DUPLICATE_METADATA_KEY`, which a plain search for the old name would.

- [ ] **Step 1: Create the fixture tree**

It is a miniature repository that the test runs the script inside, with the invented code `DI_BAG_SAMPLE`, so the test does not depend on which real codes exist. Never use a code that this phase retires in a fixture: the gate reads `tests` and would report it for ever. The two `.ts` files are valid TypeScript, because `tsconfig.json` includes everything under `tests/`. The file under the fixture's `tests/` is deliberately NOT named `*.test.ts`: `scripts/test-lane.mjs` collects every `tests/**/*.test.ts` and would run it.

`tests/fixtures/error-code-facts/src/sample.ts`:

```ts
// Fixture tree for tests/error-code-facts.test.ts: a miniature repository that the script reads as text.
declare function libraryError(code: string, message: string): Error;
/** Raises `DI_BAG_SAMPLE` for a bad sample. */
export const failure = libraryError('DI_BAG_SAMPLE', 'sample is malformed');
export const longer = libraryError('DI_BAG_SAMPLES_ARE_LONGER', 'a longer code that shares the prefix');
```

`tests/fixtures/error-code-facts/tests/assertions.ts`:

```ts
// Not named *.test.ts on purpose: scripts/test-lane.mjs would run it as a real test.
export const equal = 'DI_BAG_SAMPLE';
export const wholeMessage = 'DI_BAG_SAMPLE: sample is malformed';
export const title = 'rejects a bad sample with DI_BAG_SAMPLE';
export const pattern = /^DI_BAG_SAMPLE: sample/;
export const other = 'DI_BAG_SAMPLES_ARE_LONGER';
```

`tests/fixtures/error-code-facts/tests/plain.node.mjs`:

```js
export const plain = 'DI_BAG_SAMPLE';
```

`tests/fixtures/error-code-facts/docs/agent/errors.md`:

```markdown
### DI_BAG_SAMPLE {#di-bag-sample}

See [`DI_BAG_SAMPLE`](errors.md#di-bag-sample).
```

`tests/fixtures/error-code-facts/docs/guides/guide.md`:

```markdown
For example `DI_BAG_SAMPLE: sample is malformed; see https://example.test/errors.html#di-bag-sample`.
```

The fixture holds the five shapes the classification must tell apart: an equal string, a whole-message string, a title, a regular expression, and the longer code `DI_BAG_SAMPLES_ARE_LONGER`, which must not count as an occurrence of `DI_BAG_SAMPLE` at all.

- [ ] **Step 2: Write the failing test**

`tests/error-code-facts.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const script = resolve(__dirname, '../scripts/error-code-facts.mjs');
const tree = resolve(__dirname, 'fixtures/error-code-facts');
const run = (...codes: string[]) => spawnSync('node', [script, ...codes], { cwd: tree, encoding: 'utf8' });

test('source sites, JSDoc mentions and the word boundary', () => {
  const { status, stdout } = run('DI_BAG_SAMPLE', 'DI_BAG_RENAMED_SAMPLE');
  expect(status).toBe(0);
  expect(stdout).toContain('DI_BAG_SAMPLE -> DI_BAG_RENAMED_SAMPLE   anchor #di-bag-sample -> #di-bag-renamed-sample');
  expect(stdout).toContain('src single-quoted: 1  src/sample.ts:4[throw]');
  expect(stdout).toContain('src backticked (JSDoc): 1  src/sample.ts x1');
  expect(stdout).toContain('longer codes sharing the old prefix: ["DI_BAG_SAMPLES_ARE_LONGER"]');
  expect(stdout).toContain('new name already used in src/tests/docs: False');
});

test('only a string equal to the code is rewritable; a longer string, a title and a pattern are not', () => {
  const { stdout } = run('DI_BAG_SAMPLE', 'DI_BAG_RENAMED_SAMPLE');
  expect(stdout).toContain('tests: 5 occurrences');
  expect(stdout).toContain('   1  string equal to the code (codemod rewrites): tests/assertions.ts');
  expect(stdout).toContain('   3  other TypeScript occurrence (codemod reports, edit by hand): tests/assertions.ts');
  expect(stdout).toContain('   1  JavaScript without types (not reported, edit by hand): tests/plain.node.mjs');
});

test('a Markdown link is told apart from the same anchor as plain text', () => {
  const { stdout } = run('DI_BAG_SAMPLE', 'DI_BAG_RENAMED_SAMPLE');
  expect(stdout).toContain('   docs/agent/errors.md: code x2, anchor x2 of which real links x1');
  expect(stdout).toContain('   docs/guides/guide.md: code x1, anchor x1 of which real links x0');
});

test('the gate it prints is boundary-safe, so a new code that extends the old one passes it', () => {
  const { stdout } = run('DI_BAG_SAMPLE', 'DI_BAG_SAMPLE_KEY');
  expect(stdout).toContain('new code starts with the old code: True');
  expect(stdout).toContain("  grep -rnE 'DI_BAG_SAMPLE([^A-Z_]|$)' src tests examples scripts AGENTS.md");
  expect(stdout).toContain("  grep -rnE 'di-bag-sample([^a-z0-9-]|$)' src tests examples scripts AGENTS.md");
  expect(run('DI_BAG_SAMPLE', 'DI_BAG_RENAMED_SAMPLE').stdout).toContain('new code starts with the old code: False');
});

test('two codes are required', () => {
  const { status, stderr } = run('DI_BAG_SAMPLE');
  expect(status).toBe(2);
  expect(stderr).toContain('usage: node scripts/error-code-facts.mjs OLD_CODE NEW_CODE');
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun test tests/error-code-facts.test.ts`

Expected: `0 pass`, `5 fail`. The script does not exist yet, so `node` exits 1 with empty standard output: the first test reports `Expected: 0`, `Received: 1`, the next three report `Received: ""`, and the last reports `Expected: 2`, `Received: 1`.

- [ ] **Step 4: Create the script**

`scripts/error-code-facts.mjs`:

```js
// Read-only facts for renaming one runtime code. Usage, from the repository root: node scripts/error-code-facts.mjs OLD_CODE NEW_CODE
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const [OLD, NEW] = process.argv.slice(2);
if (!/^DI_BAG_[A-Z_]+$/.test(OLD ?? '') || !/^DI_BAG_[A-Z_]+$/.test(NEW ?? '')) {
  console.error('usage: node scripts/error-code-facts.mjs OLD_CODE NEW_CODE');
  process.exit(2);
}
const Q = "'", BT = '`';
const fragment = code => '#' + code.toLowerCase().replaceAll('_', '-');
const word = () => new RegExp('(?<![A-Z_])' + OLD + '(?![A-Z_])', 'g');
const read = file => readFileSync(file, 'utf8');
function walk(directory, extensions) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).sort().flatMap(name => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path, extensions) : extensions.some(extension => name.endsWith(extension)) ? [path] : [];
  });
}
const sources = readdirSync('src').filter(name => name.endsWith('.ts')).sort().map(name => join('src', name));

console.log(`${OLD} -> ${NEW}   anchor ${fragment(OLD)} -> ${fragment(NEW)}`);

const sites = [], ticks = [];
for (const file of sources) {
  read(file).split('\n').forEach((line, index) => {
    if (line.includes(Q + OLD + Q)) sites.push(`${file}:${index + 1}[${/(libraryError|libraryTypeError|diagnostic|diagnosticMessage|snapshotOptions)\(/.test(line) ? 'throw' : 'other'}]`);
    if (line.includes(BT + OLD + BT)) ticks.push(file);
  });
}
console.log(`src single-quoted: ${sites.length}  ${sites.join(', ')}`);
console.log(`src backticked (JSDoc): ${ticks.length}  ${[...new Set(ticks)].sort().map(file => `${file} x${ticks.filter(item => item === file).length}`).join(', ')}`);

const EQ = 'string equal to the code (codemod rewrites)', REP = 'other TypeScript occurrence (codemod reports, edit by hand)', JS = 'JavaScript without types (not reported, edit by hand)';
const forms = new Map([[EQ, new Set()], [REP, new Set()], [JS, new Set()]]), counts = new Map([[EQ, 0], [REP, 0], [JS, 0]]);
for (const file of walk('tests', ['.ts', '.tsx', '.mjs'])) {
  for (const line of read(file).split('\n')) {
    for (const match of line.matchAll(word())) {
      const before = line[match.index - 1] ?? '', after = line[match.index + OLD.length] ?? '';
      const kind = file.endsWith('.mjs') ? JS : [Q, '"', BT].includes(before) && after === before ? EQ : REP;
      counts.set(kind, counts.get(kind) + 1); forms.get(kind).add(file);
    }
  }
}
console.log(`tests: ${[...counts.values()].reduce((sum, value) => sum + value, 0)} occurrences`);
for (const [kind, count] of counts) if (count) console.log(`   ${count}  ${kind}: ${[...forms.get(kind)].sort().join(', ')}`);

const markdown = [...['AGENTS.md', 'README.md'].filter(existsSync), ...walk('docs/agent', ['.md']), ...walk('docs/guides', ['.md']), ...['tools/graph/README.md'].filter(existsSync)].sort();
const escaped = fragment(OLD).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const file of markdown) {
  const text = read(file), codes = [...text.matchAll(word())].length, anchors = text.split(fragment(OLD)).length - 1;
  if (!codes && !anchors) continue;
  const links = [...text.matchAll(new RegExp('\\]\\([^)]*' + escaped + '\\)', 'g'))].length;
  console.log(`   ${file}${file.endsWith('api-card.md') ? ' (generated)' : ''}: code x${codes}, anchor x${anchors} of which real links x${links}`);
}
const all = [...new Set(sources.flatMap(file => read(file).match(/DI_BAG_[A-Z_]+/g) ?? []))].sort();
const longer = all.filter(code => code.startsWith(OLD) && code !== OLD);
console.log(`longer codes sharing the old prefix: ${longer.length ? JSON.stringify(longer) : 'none'}`);
const used = [...sources, ...walk('tests', ['.ts']), ...walk('docs/agent', ['.md'])].some(file => read(file).includes(NEW));
console.log(`new name already used in src/tests/docs: ${used ? 'True' : 'False'}`);
console.log(`new code starts with the old code: ${NEW.startsWith(OLD) ? 'True' : 'False'}`);
const places = 'src tests examples scripts AGENTS.md README.md docs/agent docs/guides tools/docs/lib tools/docs/test tools/docs/*.json tools/graph/lib tools/graph/test tools/graph/README.md';
console.log('gate, run after `npm run build && npm run docs:generate`; both commands must print nothing:');
console.log(`  grep -rnE '${OLD}([^A-Z_]|$)' ${places}`);
console.log(`  grep -rnE '${fragment(OLD).slice(1)}([^a-z0-9-]|$)' ${places}`);
```

Two details carry the weight, so keep them. The word boundary `(?<![A-Z_])` ... `(?![A-Z_])` stops `DI_BAG_INVALID_SCOPE` from matching inside `DI_BAG_INVALID_SCOPE_KEY`. The label `string equal to the code` requires the SAME quote character directly before and directly after the code. An earlier version only looked at the character before, and counted `'DI_BAG_SAMPLE: sample is malformed'` as rewritable, which the codemod never rewrites. Putting that rule back makes the second test fail and no other; this was checked when the plan was written.

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun test tests/error-code-facts.test.ts`

Expected: `5 pass`, `0 fail`. The fast lane's total grows by five.

Then run `npm run typecheck`. Expected: no error. The two fixture `.ts` files were type-checked on their own under the project's strict options when this plan was written.

- [ ] **Step 6: Run the script on the library**

Run, from the repository root: `node scripts/error-code-facts.mjs DI_BAG_CYCLE DI_BAG_DEPENDENCY_CYCLE`

Expected: exit 0 and the shape below. This is the output at the 0.4.0 source. On your tree the line numbers differ, and the file lists may differ if an earlier phase moved a test; the three `[throw]` sites and the absence of a longer code should not.

```text
DI_BAG_CYCLE -> DI_BAG_DEPENDENCY_CYCLE   anchor #di-bag-cycle -> #di-bag-dependency-cycle
src single-quoted: 3  src/acquisition-family.ts:74[throw], src/acquisition-family.ts:123[throw], src/acquisition.ts:147[throw]
src backticked (JSDoc): 2  src/di-bag.ts x2
tests: 7 occurrences
   1  string equal to the code (codemod rewrites): tests/runtime-diagnostics.test.ts
   2  other TypeScript occurrence (codemod reports, edit by hand): tests/runtime-diagnostics.test.ts, tests/runtime-scale.test.ts
   4  JavaScript without types (not reported, edit by hand): tests/runtime-scale.node.mjs
   docs/agent/api-card.md (generated): code x2, anchor x2 of which real links x2
   docs/agent/errors.md: code x1, anchor x1 of which real links x0
   docs/agent/recipes.md: code x1, anchor x1 of which real links x1
   docs/guides/api-reference.md: code x1, anchor x1 of which real links x0
   docs/guides/tutorial.md: code x1, anchor x1 of which real links x0
longer codes sharing the old prefix: none
new name already used in src/tests/docs: False
new code starts with the old code: False
gate, run after `npm run build && npm run docs:generate`; both commands must print nothing:
  grep -rnE 'DI_BAG_CYCLE([^A-Z_]|$)' src tests examples scripts AGENTS.md README.md docs/agent docs/guides tools/docs/lib tools/docs/test tools/docs/*.json tools/graph/lib tools/graph/test tools/graph/README.md
  grep -rnE 'di-bag-cycle([^a-z0-9-]|$)' src tests examples scripts AGENTS.md README.md docs/agent docs/guides tools/docs/lib tools/docs/test tools/docs/*.json tools/graph/lib tools/graph/test tools/graph/README.md
```

How to read it. Every `[throw]` site gets the new code. Every backticked mention is JSDoc prose and is edited by hand. A file marked `(generated)` is never edited: `npm run docs:generate` rewrites it. `longer codes sharing the old prefix` other than `none`, or `new code starts with the old code: True`, means a plain `sed 's/OLD/NEW/g'` is unsafe: it would corrupt the longer code, or turn an already renamed `OLD_KEY` into `OLD_KEY_KEY` when run twice. In that case use the boundary-safe form `sed -E 's/OLD([^A-Z_]|$)/NEW\1/g'`. `new name already used` being `True` means an earlier phase or task already raises the target code, so the target's section in `docs/agent/errors.md` exists and you ADD to it instead of creating it. The two `grep` lines at the end are the gate. At this point they print many lines, because nothing is renamed yet.

- [ ] **Step 7: Commit**

```bash
git add scripts/error-code-facts.mjs tests/error-code-facts.test.ts tests/fixtures/error-code-facts
git commit -m "test(errors): per-code facts script for the code renames"
```

Use the full commit format from the master plan, with the two attribution lines.

---

### Task 3: `DI_BAG_CYCLE` becomes `DI_BAG_DEPENDENCY_CYCLE`

This is the pattern for every one-to-one rename. The code's throw sites and its section heading change in ONE commit, because the docs check is two-way.

**Files:**
- Modify: `src/acquisition-family.ts` (two throw sites, messages start `cycle:`), `src/acquisition.ts` (one throw site, message starts `alias cycle:`), `src/di-bag.ts` (two backticked JSDoc mentions, on `resolve` and on the snapshot call)
- Modify: `docs/agent/errors.md` (the heading), `docs/agent/recipes.md` (one link), `docs/guides/tutorial.md` and `docs/guides/api-reference.md` (one example message each), `tools/codemod/rename-map.json`
- Test: `tests/runtime-diagnostics.test.ts`, `tests/runtime-scale.test.ts`, `tests/runtime-scale.node.mjs`

**Interfaces:**
- Consumes: `node scripts/error-code-facts.mjs DI_BAG_CYCLE DI_BAG_DEPENDENCY_CYCLE` from Task 2. Run it before Step 1 and keep the output open: it lists every place this task edits, and its last two lines are the gate of Step 7.
- Produces: the runtime code `DI_BAG_DEPENDENCY_CYCLE`, anchor `#di-bag-dependency-cycle`. `details.path` is unchanged.

- [ ] **Step 1: Change the assertions first**

Line numbers have moved since 0.4.0, so find each line by its text: `grep -n "DI_BAG_CYCLE\|di-bag-cycle" tests/runtime-diagnostics.test.ts tests/runtime-scale.test.ts tests/runtime-scale.node.mjs`. A whole-message assertion needs both edits, the code and the fragment after `#`.

`tests/runtime-diagnostics.test.ts`:

```ts
// before
expect(cycle.message).toBe(`DI_BAG_CYCLE: cycle: a -> b -> a; see ${page}#di-bag-cycle`);
// after
expect(cycle.message).toBe(`DI_BAG_DEPENDENCY_CYCLE: cycle: a -> b -> a; see ${page}#di-bag-dependency-cycle`);
```

```ts
// before
expect(cycle.code).toBe('DI_BAG_CYCLE');
// after
expect(cycle.code).toBe('DI_BAG_DEPENDENCY_CYCLE');
```

`tests/runtime-scale.test.ts`:

```ts
// before
expect(() => family.recordEdge(d, a)).toThrow(/^DI_BAG_CYCLE: cycle: a -> b -> d -> a; see https:\/\/dany-fedorov\.github\.io\/di-bag\/agent\/errors\.html#di-bag-cycle$/);
// after
expect(() => family.recordEdge(d, a)).toThrow(/^DI_BAG_DEPENDENCY_CYCLE: cycle: a -> b -> d -> a; see https:\/\/dany-fedorov\.github\.io\/di-bag\/agent\/errors\.html#di-bag-dependency-cycle$/);
```

`tests/runtime-scale.node.mjs` (plain JavaScript, so the codemod never touches it):

```js
// before
assert.throws(() => nodes.at(-1).link(), /^Error: DI_BAG_CYCLE: cycle:/);
// after
assert.throws(() => nodes.at(-1).link(), /^Error: DI_BAG_DEPENDENCY_CYCLE: cycle:/);
```

```js
// before
assert.throws(() => bag.resolve('value'), /^Error: DI_BAG_CYCLE: cycle: value -> value; see https:\/\/dany-fedorov\.github\.io\/di-bag\/agent\/errors\.html#di-bag-cycle$/);
// after
assert.throws(() => bag.resolve('value'), /^Error: DI_BAG_DEPENDENCY_CYCLE: cycle: value -> value; see https:\/\/dany-fedorov\.github\.io\/di-bag\/agent\/errors\.html#di-bag-dependency-cycle$/);
```

```js
// before
await assert.rejects(bag.resolve('a'), /^Error: DI_BAG_CYCLE: cycle: a -> b -> a; see https:\/\/dany-fedorov\.github\.io\/di-bag\/agent\/errors\.html#di-bag-cycle$/);
// after
await assert.rejects(bag.resolve('a'), /^Error: DI_BAG_DEPENDENCY_CYCLE: cycle: a -> b -> a; see https:\/\/dany-fedorov\.github\.io\/di-bag\/agent\/errors\.html#di-bag-dependency-cycle$/);
```

```js
// before
assert.throws(reader.next().next, /^Error: DI_BAG_CYCLE: cycle: reader -> link -> reader; see https:\/\/dany-fedorov\.github\.io\/di-bag\/agent\/errors\.html#di-bag-cycle$/);
// after
assert.throws(reader.next().next, /^Error: DI_BAG_DEPENDENCY_CYCLE: cycle: reader -> link -> reader; see https:\/\/dany-fedorov\.github\.io\/di-bag\/agent\/errors\.html#di-bag-dependency-cycle$/);
```

- [ ] **Step 2: Run the two test files to verify they fail**

Run: `bun test tests/runtime-diagnostics.test.ts tests/runtime-scale.test.ts`

Expected: exactly these three tests fail, one per edited line, and every other test passes:

- `library messages carry the code, the original text, and the errors-page section`
- `a module label names private bindings in messages, cycle paths, inspectGraph, and observers`
- `a branching late cycle reports the first dependency-order path and leaves its rejected edge absent`

Each failure shows the new name expected and the old one received, for example `Received message: "DI_BAG_CYCLE: cycle: a -> b -> d -> a; see https://dany-fedorov.github.io/di-bag/agent/errors.html#di-bag-cycle"`. Observed at the 0.4.0 source: `17 pass`, `3 fail`, 20 tests in the two files; the totals may differ now, the three names must not. A fourth failure means an edit touched something else: undo and redo it. `tests/runtime-scale.node.mjs` reads `dist/` and is run in Step 7.

- [ ] **Step 3: Rename the code at its throw sites and in its section heading**

The single-quoted literal occurs three times in `src`, each as the first argument of `libraryError`: twice in `src/acquisition-family.ts` (messages that start `cycle:`) and once in `src/acquisition.ts` (`alias cycle:`). No longer code shares the prefix, so the substitution is exact.

```bash
sed -i "s/'DI_BAG_CYCLE'/'DI_BAG_DEPENDENCY_CYCLE'/" src/acquisition.ts src/acquisition-family.ts
grep -rc "'DI_BAG_DEPENDENCY_CYCLE'" src | grep -v ':0'   # expect src/acquisition.ts:1 and src/acquisition-family.ts:2
grep -rc "'DI_BAG_CYCLE'" src | grep -v ':0'              # expect no output
```

In `docs/agent/errors.md` change only the heading; the body never repeats the code. Leave the section where it is: `DI_BAG_CYCLE` and `DI_BAG_DEPENDENCY_CYCLE` sort next to each other, so it moves only if an earlier phase added a code that now sorts between them. The page orders its runtime codes alphabetically word by word, with an underscore ahead of a letter (`DI_BAG_CLOSE_TIMEOUT` comes before `DI_BAG_CLOSED`). That order is a convention every section follows today; `npm run docs:check` does not enforce it, so a misplaced section fails nothing and must be caught by eye. Later tasks in this plan place each new section by the same rule.

```md
<!-- before -->
### DI_BAG_CYCLE {#di-bag-cycle}
<!-- after -->
### DI_BAG_DEPENDENCY_CYCLE {#di-bag-dependency-cycle}
```

- [ ] **Step 4: Run the two test files to verify they pass**

Run: `bun test tests/runtime-diagnostics.test.ts tests/runtime-scale.test.ts`

Expected: `0 fail`; the three tests named in Step 2 pass. This passing state was not observed when the plan was written, because that needs an edit to `src`; the failing state in Step 2 was.

- [ ] **Step 5: Update the mentions that no tool sees**

Two backticked mentions in JSDoc in `src/di-bag.ts` (the list of acquisition errors on `resolve`, and the `@throws` line about an alias cycle on the snapshot call), one link in `docs/agent/recipes.md`, and one example message each in `docs/guides/tutorial.md` and `docs/guides/api-reference.md`. A fifth file is easy to miss: `tools/docs/test/agent-docs.test.mjs`, the docs tool's own test, uses `DI_BAG_CYCLE` as sample data inside a temporary tree it builds for itself. It is self-consistent, so nothing fails if it is left alone, but the gate reads it; rename it there too. Plain substitutions are safe in these five files, because no other code or anchor starts with the old text and the new code does not start with the old one.

```bash
sed -i -e 's/DI_BAG_CYCLE/DI_BAG_DEPENDENCY_CYCLE/g' -e 's/di-bag-cycle/di-bag-dependency-cycle/g' src/di-bag.ts docs/agent/recipes.md docs/guides/tutorial.md docs/guides/api-reference.md tools/docs/test/agent-docs.test.mjs
git diff --numstat src/di-bag.ts docs/agent/recipes.md docs/guides/tutorial.md docs/guides/api-reference.md tools/docs/test/agent-docs.test.mjs
```

Expected at the 0.4.0 source, as `added removed file`: `2 2 src/di-bag.ts`, `1 1` for each of the three Markdown files, `9 9 tools/docs/test/agent-docs.test.mjs`. This exact command was run on a scratch copy when the plan was written, and the docs tool's tests gave 22 pass, 0 fail both before and after it.

- [ ] **Step 6: Add the code to the codemod's map**

In `tools/codemod/rename-map.json`, add one entry to the `codes` array, in the form the phase 1 plan defines:

```json
{ "from": "DI_BAG_CYCLE", "to": "DI_BAG_DEPENDENCY_CYCLE" }
```

Run: `npm run codemod:check`. Expected: every test passes. The generic `codes` transform already has a fixture that uses this very pair, so no new fixture is needed.

- [ ] **Step 7: Regenerate, then run the gate for this code**

```bash
npm run build && npm run docs:generate
node --expose-gc --test --test-isolation=none tests/runtime-scale.node.mjs   # expect: pass, 0 fail
npm run docs:check                                                           # expect: exit 0
node scripts/error-code-facts.mjs DI_BAG_CYCLE DI_BAG_DEPENDENCY_CYCLE | grep '^  grep' | bash   # the gate: expect no output
```

The last line runs the two `grep` commands the facts script prints. At the 0.4.0 source, before any edit, they print 41 lines; after this task they print none.

`docs:check` is what proves the pairing: it fails with `no section for DI_BAG_DEPENDENCY_CYCLE` if the heading was missed, and with `section DI_BAG_CYCLE is not raised in src` if the heading was left behind.

- [ ] **Step 8: Commit**

```bash
git add src/acquisition.ts src/acquisition-family.ts src/di-bag.ts docs/agent/errors.md docs/agent/recipes.md docs/agent/api-card.md docs/reference docs/guides/tutorial.md docs/guides/api-reference.md tools/docs/test/agent-docs.test.mjs tools/codemod/rename-map.json tests/runtime-diagnostics.test.ts tests/runtime-scale.test.ts tests/runtime-scale.node.mjs
git commit -m "refactor(errors)!: DI_BAG_CYCLE becomes DI_BAG_DEPENDENCY_CYCLE"
```

Use the full commit format from the master plan, with the two attribution lines. The same holds for every commit below and is not repeated.

---

### Task 4: The disposal vocabulary

The spec retires the word "cleanup" for releasing an owned value. Phase 3 already renamed the fields of the service readiness errors. What is left: the class `DiBagCleanupError`, the type `CleanupFailure`, the field `DiBagCloseCancelledError.cleanupPromise`, and two codes. The field `CleanupFailure.label` is renamed here too, in the same codemod pass, because the codemod's map names an owner as it was at 0.4.0 and after this task the type is no longer called `CleanupFailure`. The `cleanup-*` event kinds are Task 11; leave them alone here.

| 0.4.0 | 0.5.0 |
| --- | --- |
| class `DiBagCleanupError`, and its `name` string | `DiBagDisposalError` |
| type `CleanupFailure` | `DisposalFailure` |
| `CleanupFailure.label` | `DisposalFailure.bindingLabel` |
| `DiBagCloseCancelledError.cleanupPromise` | `disposalPromise` |
| `DI_BAG_CLEANUP_FAILED`, anchor `#di-bag-cleanup-failed` | `DI_BAG_DISPOSAL_FAILED`, `#di-bag-disposal-failed` |
| `DI_BAG_CLEANUP_AFTER_FACTORY`, anchor `#di-bag-cleanup-after-factory` | `DI_BAG_DISPOSER_PUSHED_AFTER_FACTORY`, `#di-bag-disposer-pushed-after-factory` |

**Files:**
- Modify: `src/errors.ts` (class, type, field, two `diagnostic` calls, one `@see` URL), `src/index.ts` (two export lines), `src/provider-execution.ts` (one throw site), `src/di-bag.ts` and every other `src` file that imports the class or the type
- Modify: `docs/agent/errors.md` (two headings and their bodies), `docs/agent/recipes.md` (two links), `docs/guides/tutorial.md` (one link), `tools/codemod/rename-map.json`
- Test: `tests/runtime-diagnostics.test.ts`, `tests/acquisition-cleanup.test.ts`, and the files the codemod rewrites

**Interfaces:**
- Consumes: the facts script (Task 2) and the codemod CLI (master plan, "The codemod contract").
- Produces: `class DiBagDisposalError extends AggregateError` with `code: 'DI_BAG_DISPOSAL_FAILED'` and `failures: readonly DisposalFailure[]`; `interface DisposalFailure`; `DiBagCloseCancelledError.disposalPromise: Promise<void>`. Constructor parameters and `details` keep their shape.

Counted at the 0.4.0 source, for orientation only: `DiBagCleanupError` occurs 71 times in 15 test files, all as an identifier except two generated-source strings in `tests/package.test.ts` and `tests/final-adversarial-runtime-fixture.ts`; `cleanupPromise` occurs 23 times in tests, often on a caught error typed `any`, which the codemod cannot see.

- [ ] **Step 1: Read the facts for both codes**

```bash
node scripts/error-code-facts.mjs DI_BAG_CLEANUP_FAILED DI_BAG_DISPOSAL_FAILED
node scripts/error-code-facts.mjs DI_BAG_CLEANUP_AFTER_FACTORY DI_BAG_DISPOSER_PUSHED_AFTER_FACTORY
```

At 0.4.0 the first reports three single-quoted sites in `src/errors.ts` (one `[other]`, the `declare readonly code` line, and two `[throw]`), one JSDoc mention in `src/di-bag.ts`, one test occurrence and one real link in `docs/agent/recipes.md`. The second reports one site in `src/provider-execution.ts`, four test occurrences in `tests/acquisition-cleanup.test.ts`, and one real link each in `docs/agent/recipes.md` and `docs/guides/tutorial.md`.

- [ ] **Step 2: Change the assertions first**

In `tests/acquisition-cleanup.test.ts`, four assertions match `/DI_BAG_CLEANUP_AFTER_FACTORY/`. Replace the pattern in all four, and strengthen the first one so the code and the details are pinned, not only the message:

```ts
// before
expect(() => escaped.pushDisposer(() => {})).toThrow(/DI_BAG_CLEANUP_AFTER_FACTORY/);
// after
expect(() => escaped.pushDisposer(() => {})).toThrow(/DI_BAG_DISPOSER_PUSHED_AFTER_FACTORY/);
```

Directly after the FIRST of the four, add:

```ts
const late = (() => { try { escaped.pushDisposer(() => {}); } catch (error) { return error as { code: string; details: unknown }; } throw new Error('expected a throw'); })();
expect(late.code).toBe('DI_BAG_DISPOSER_PUSHED_AFTER_FACTORY');
expect(late.details).toEqual({ operation: 'pushDisposer' });
```

In `tests/runtime-diagnostics.test.ts`, the whole-message assertion needs both edits, and gains a `code` assertion on the next line:

```ts
// before
expect(cleanup.message).toBe(`DI_BAG_CLEANUP_FAILED: Failed to run 1 disposal callback(s); see ${page}#di-bag-cleanup-failed`);
// after
expect(cleanup.message).toBe(`DI_BAG_DISPOSAL_FAILED: Failed to run 1 disposal callback(s); see ${page}#di-bag-disposal-failed`);
expect(cleanup.code).toBe('DI_BAG_DISPOSAL_FAILED');
expect(cleanup.name).toBe('DiBagDisposalError');
expect(cleanup.failures.map((failure: { bindingLabel: string }) => failure.bindingLabel)).toEqual(['value']);
expect(cleanup.failures[0]).not.toHaveProperty('label');
```

The service in that test is registered under the key `value`, and a failure carries the label of its binding, which for a named service is its key (observed at 0.4.0 with the old field name).

If `cleanup` is typed so that `.code` or `.name` does not compile, read them through the file's `caught` helper type, which already declares `code`.

- [ ] **Step 3: Run the two files to verify they fail**

Run: `bun test tests/acquisition-cleanup.test.ts tests/runtime-diagnostics.test.ts`

Expected: failures in exactly the tests you edited. The pattern assertions report that the thrown message contains `DI_BAG_CLEANUP_AFTER_FACTORY`; the message assertion reports `Received` starting with `DI_BAG_CLEANUP_FAILED:`. Any other failing test means the tree was not green on entry: stop and find out why.

- [ ] **Step 4: Add the map entries and run the codemod while the old names still resolve**

In `tools/codemod/rename-map.json` add, to the arrays of the same name:

```json
"types":      [{ "from": "DiBagCleanupError", "to": "DiBagDisposalError" }, { "from": "CleanupFailure", "to": "DisposalFailure" }]
"properties": [{ "owner": "DiBagCloseCancelledError", "from": "cleanupPromise", "to": "disposalPromise" }, { "owner": "CleanupFailure", "from": "label", "to": "bindingLabel" }]
"codes":      [{ "from": "DI_BAG_CLEANUP_FAILED", "to": "DI_BAG_DISPOSAL_FAILED" }, { "from": "DI_BAG_CLEANUP_AFTER_FACTORY", "to": "DI_BAG_DISPOSER_PUSHED_AFTER_FACTORY" }]
```

The generic `types` transform already has a fixture with `DiBagCleanupError` in an import, behind an alias, through a namespace and in `instanceof` (phase 1 plan, fixture `types`), so no new fixture is needed. Run `npm run codemod:check`, expect every test to pass, then:

```bash
npm run build
node tools/codemod/cli.mjs --project tsconfig.json --library-root src --library-root dist --extra-files 'tests/types/negative/*.ts' --write --report /tmp/codemod-disposal.json
git status --short | grep -v '^ M tests/\|^ M examples/\|^ M tools/codemod/rename-map.json'   # expect no output: the codemod never edits src
```

Commit this rewrite on its own, with the command in the body. The tree does not compile at this commit, on purpose: the tests now import `DiBagDisposalError`, which `src` does not export until Step 5. Say so in the body.

```bash
git add tools/codemod/rename-map.json tests examples
git commit -m "refactor(errors)!: codemod rewrite for the disposal vocabulary" -m "Produced by: node tools/codemod/cli.mjs --project tsconfig.json --library-root src --library-root dist --extra-files 'tests/types/negative/*.ts' --write. Does not compile until the next commit renames the declarations in src."
```

- [ ] **Step 5: Rename the declarations in `src`**

All five names are distinctive words with no other meaning in this repository, so a word-bounded substitution over `src` is safe. `\b` stops `cleanupPromise` from matching inside a longer identifier.

```bash
grep -rlE '\b(DiBagCleanupError|CleanupFailure|cleanupPromise)\b|DI_BAG_CLEANUP_(FAILED|AFTER_FACTORY)|di-bag-cleanup-(failed|after-factory)' src | xargs sed -i -E \
  -e 's/\bDiBagCleanupError\b/DiBagDisposalError/g' \
  -e 's/\bCleanupFailure\b/DisposalFailure/g' \
  -e 's/\bcleanupPromise\b/disposalPromise/g' \
  -e 's/DI_BAG_CLEANUP_FAILED/DI_BAG_DISPOSAL_FAILED/g' \
  -e 's/DI_BAG_CLEANUP_AFTER_FACTORY/DI_BAG_DISPOSER_PUSHED_AFTER_FACTORY/g' \
  -e 's/di-bag-cleanup-failed/di-bag-disposal-failed/g' \
  -e 's/di-bag-cleanup-after-factory/di-bag-disposer-pushed-after-factory/g'
npm run typecheck
```

Expected: no error. On a scratch copy of the 0.4.0 source this exact command changed seven files (`git diff --numstat`: `src/errors.ts` 21 lines, `src/runtime.ts` 6, `src/acquisition.ts` 5, `src/index.ts` 2, `src/startup.ts` 2, `src/di-bag.ts` 1, `src/provider-execution.ts` 1) and left no old name behind; the type-check after it was NOT run when the plan was written. The substitution also fixes the `this.name = 'DiBagCleanupError'` string, the `@see` URL above the failure type (the one hand-written URL that breaks in this phase, see Global Constraints), and the `{@link DiBagCleanupError}` in the JSDoc of `close`. If `typecheck` reports an unknown name in `tests` or `examples`, the codemod missed a use there: fix it by hand, it is one of the cases in Step 6.

Then the field, by hand, because `label` is far too common a word for a substitution: in `src/errors.ts` rename `readonly label: string` inside `interface DisposalFailure` to `bindingLabel`, fix the `failure.label` in the JSDoc example of `DiBagDisposalError`, and run `npm run typecheck` again. It now lists every producer of a failure record; at 0.4.0 there are two, both in `src/acquisition.ts` (`this.failures.push({ ..., label: attempt.label, error })` and the `.map(({ acquisitionId, bindingId, label, error }) => ...)` that strips the sequence number). Write `bindingLabel: attempt.label` in the first and rename the destructured property in the second. Reads of `failure.label` on a caught error typed `any` are invisible to the compiler and to the codemod: `grep -rnE "failures?\b[^;]*\.label\b|failure\.label" src tests examples docs/agent AGENTS.md` finds them. Measured at 0.4.0, ten lines: `tests/acquisition.test.ts` two, `tests/acquisition-cleanup.test.ts` one, `tests/scopes.test.ts` one, `tests/package.test.ts` two (inside generated source held in a string, which no tool rewrites), the JSDoc example in `src/errors.ts`, the producer in `src/acquisition.ts`, the example in the errors page, and one line of `docs/agent/api-card.md`, which is generated and follows the JSDoc.

- [ ] **Step 6: Audit what no tool sees**

```bash
grep -rnwE 'DiBagCleanupError|CleanupFailure|cleanupPromise' src tests examples scripts AGENTS.md README.md docs/agent tools/docs/lib tools/docs/*.json
```

Expected leftovers, all edited by hand with the same substitutions: uses on a value typed `any` (a caught error), the two generated-source strings, and Markdown in `docs/agent`. `docs/guides` is not in this search on purpose, the guides are rewritten in phase 12, with ONE exception: the link in `docs/guides/tutorial.md` to `#di-bag-cleanup-after-factory` is a real link and breaks the site check, so fix that one now:

```bash
sed -i -e 's/DI_BAG_CLEANUP_AFTER_FACTORY/DI_BAG_DISPOSER_PUSHED_AFTER_FACTORY/g' -e 's/di-bag-cleanup-after-factory/di-bag-disposer-pushed-after-factory/g' docs/guides/tutorial.md docs/agent/recipes.md
sed -i -e 's/DI_BAG_CLEANUP_FAILED/DI_BAG_DISPOSAL_FAILED/g' -e 's/di-bag-cleanup-failed/di-bag-disposal-failed/g' docs/agent/recipes.md
```

Run the audit again. Expected: no output.

- [ ] **Step 7: Rename the two sections of `docs/agent/errors.md`**

Change the two headings, and inside their bodies the class name and nothing else:

```markdown
### DI_BAG_DISPOSAL_FAILED {#di-bag-disposal-failed}
### DI_BAG_DISPOSER_PUSHED_AFTER_FACTORY {#di-bag-disposer-pushed-after-factory}
```

In the body of the first, `DiBagCleanupError` becomes `DiBagDisposalError`, three times at 0.4.0: in **When**, in the `import`, and in the `instanceof`; and `label` becomes `bindingLabel` twice, in **Cause** and in the example's `failure.label`. Then move both sections so the page stays in word-by-word alphabetical order, which is a convention of the page and not enforced by a tool: both go after `DI_BAG_DEPENDENCY_CYCLE` and before `DI_BAG_DUPLICATE_METADATA`, with `DISPOSAL_FAILED` first.

- [ ] **Step 8: Verify, then run the gate for both codes**

```bash
bun test tests/acquisition-cleanup.test.ts tests/runtime-diagnostics.test.ts   # expect 0 fail
npm run test:fast                                                              # expect 0 fail
npm run build && npm run docs:generate && npm run docs:check                   # expect exit 0
node scripts/error-code-facts.mjs DI_BAG_CLEANUP_FAILED DI_BAG_DISPOSAL_FAILED | grep '^  grep' | bash                       # expect no output
node scripts/error-code-facts.mjs DI_BAG_CLEANUP_AFTER_FACTORY DI_BAG_DISPOSER_PUSHED_AFTER_FACTORY | grep '^  grep' | bash  # expect no output
```

The gate reads `docs/guides`. If it reports a line there other than the tutorial link you already fixed, that line quotes one of the two codes as text: apply the same substitution to it.

Append to `tests/types/negative/api-renaming.ts`, in the form phase 3 used there. The import path must be exactly `'../../../src'`, because `tests/provider-contract-fixtures.ts` rewrites that spelling when the fixture is compiled against the packed package. The file is already registered in `tests/types.test.ts`; the compiler lane runs it, not the fast lane.

```ts
// diagnostic: has no exported member
type RemovedCleanupError = import('../../../src').DiBagCleanupError;
// diagnostic: has no exported member
type RemovedCleanupFailure = import('../../../src').CleanupFailure;
```

- [ ] **Step 9: Commit**

```bash
git add src docs/agent docs/reference docs/guides/tutorial.md tests
git commit -m "refactor(errors)!: DiBagDisposalError, DisposalFailure and the two disposal codes"
```

---

### Task 5: The taxonomy test file, and the two duplicate codes

Tasks 5 to 9 share one new test file, `tests/error-code-taxonomy.test.ts`: one row per throw site whose code changes, holding the call that reaches the site, the new code, and the details it must carry. This task creates the file with its first five rows. Tasks 6 to 9 each append one `check([...])` block.

How far these rows were verified when the plan was written. Every row was first written against the 0.4.0 API and RUN: all 77 probe calls reached the intended throw site, which the old code, the message and the details in the output showed. The rows below are those same calls translated to the 0.5.0 names of the spec. The translated file type-checks with the facade stubbed, and its harness was run once at 0.4.0, where all 73 rows fail because the 0.5.0 methods do not exist. The translated calls themselves were NOT run: the 0.5.0 API did not exist. Each row keeps its 0.4.0 call as a comment. Rule: if a row does not reach its site on your tree (the failure output shows another code or message), fix the CALL, using the 0.4.0 comment to see what was meant; never change the expected `code` or `details`, they are the contract. If the inventory shows that an earlier phase removed the site altogether, delete the row and say so in the phase report.

The details vocabulary, decided here because the spec fixes it only for `DI_BAG_INVALID_ARGUMENT`. `operation` is always the 0.5.0 method name. The key of a service is `serviceKey`, never `key` or `target`; a metadata key is `metadataKey`. Keys that a site already has and that are not listed here (`lifetime`, `provided`, `currentExportKey`, `newExportKey`, `path`, `bindingId`) stay. The rows use `toMatchObject`, so extra keys do not fail them.

| 0.4.0 code | 0.5.0 code | `details` |
| --- | --- | --- |
| `DI_BAG_DUPLICATE_REGISTRATION`, and the `duplicate export` site of `DI_BAG_INVALID_EXPORT` | `DI_BAG_DUPLICATE_SERVICE_KEY` | `{ operation, serviceKey }` |
| `DI_BAG_DUPLICATE_METADATA` | `DI_BAG_DUPLICATE_METADATA_KEY` | `{ operation, metadataKey }` |

**Files:**
- Create: `tests/error-code-taxonomy.test.ts`
- Modify: the throw sites the inventory lists for the two old codes (at 0.4.0: `src/aliases.ts`, `src/di-bag.ts`, `src/registration.ts`, `src/runtime.ts`, `src/module.ts`, `src/provider.ts`), JSDoc in `src/di-bag.ts`, `docs/agent/errors.md`, `tools/codemod/rename-map.json`
- Test: also `tests/api-renaming.test.ts`, which holds the one existing assertion on `DI_BAG_DUPLICATE_METADATA`

**Interfaces:**
- Produces: `check(rows)` and the fixtures `builder()`, `container()`, `scoped(factory)` inside the test file, which Tasks 6 to 9 reuse.

- [ ] **Step 1: Read the facts and list the sites**

```bash
node scripts/error-code-facts.mjs DI_BAG_DUPLICATE_REGISTRATION DI_BAG_DUPLICATE_SERVICE_KEY
node scripts/error-code-facts.mjs DI_BAG_DUPLICATE_METADATA DI_BAG_DUPLICATE_METADATA_KEY
node scripts/error-code-inventory.mjs src 2>/dev/null | awk -F'\t' '$4 ~ /DUPLICATE_REGISTRATION|DUPLICATE_METADATA/ || $5 ~ /^duplicate export/'
```

The second command prints `new code starts with the old code: True`: in this task never use a plain `sed 's/OLD/NEW/g'` for the metadata code, use the boundary-safe form from Task 2. If the first prints `new name already used in src/tests/docs: True`, phase 7 already created the `DI_BAG_DUPLICATE_SERVICE_KEY` section: extend it in Step 5 instead of creating it.

- [ ] **Step 2: Create the test file with the first block**

`tests/error-code-taxonomy.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { DiBag } from '../src';

// One row per throw site whose code changed in phase 11: the call that reaches the site, its code, and the details it must carry.
// Every call is malformed on purpose, so the facade is untyped here: the compiler would reject these calls.
type Diagnostic = Error & { code: string; details: Record<string, unknown> };
type Row = readonly [title: string, run: () => unknown, code: string, details: Record<string, unknown>];
const D = DiBag as any;

async function diagnosticOf(run: () => unknown): Promise<Diagnostic> {
  try { await run(); } catch (error) { return error as Diagnostic; }
  throw new Error('expected a throw or a rejection');
}
function check(rows: readonly Row[]): void {
  for (const [title, run, code, details] of rows) {
    test(title, async () => {
      const error = await diagnosticOf(run);
      expect(error.code).toBe(code);
      expect(error.details).toMatchObject(details);
      expect(error.message).toStartWith(`${code}: `);
    });
  }
}

// `config` is scoped so that a child container may replace it; `id` is transient so that sharing it is a conflict.
const scoped = (factory: () => unknown) => D.createProvider(factory).withLifetime('scoped:one-per-container');
const builder = () => D.createBuilder().withServices({
  config: scoped(() => ({ region: 'eu' })),
  id: D.createProvider(() => 1).withLifetime('transient:one-per-resolve'),
});
const container = () => builder().buildContainer();
check([
  // 0.4.0: builder().register({ config: () => 1 })
  ['a service key registered twice', () => builder().withServices({ config: () => 1 }), 'DI_BAG_DUPLICATE_SERVICE_KEY', { operation: 'withServices', serviceKey: 'config' }],
  // 0.4.0: builder().alias('config', 'id')
  ['an alias key that is already registered', () => builder().withServiceAlias({ aliasKey: 'config', targetServiceKey: 'id' }), 'DI_BAG_DUPLICATE_SERVICE_KEY', { operation: 'withServiceAlias', serviceKey: 'config' }],
  // 0.4.0: builder().installModule(<a module that exports config>)
  ['a module that exports a key the host already has', () => builder().withInstalledModules([D.createBuilder().withServices({ config: () => 1 }).buildModule({ exportedServiceKeys: ['config'] })]), 'DI_BAG_DUPLICATE_SERVICE_KEY', { operation: 'withInstalledModules', serviceKey: 'config' }],
  // 0.4.0: <module exporting a and b>.renameExport('a', 'b')
  ['an export renamed onto another export', () => D.createBuilder().withServices({ a: () => 1, b: () => 2 }).buildModule({ exportedServiceKeys: ['a', 'b'] }).withRenamedExport({ currentExportKey: 'a', newExportKey: 'b' }), 'DI_BAG_DUPLICATE_SERVICE_KEY', { operation: 'withRenamedExport', serviceKey: 'b' }],
  // 0.4.0: DiBag.withMetadata(DiBag.withMetadata(f, { static: { owner: 1 } }), { static: { owner: 2 } })
  ['a registration metadata key set twice', () => D.createProvider(() => 1).withRegistrationMetadata({ owner: 1 }).withRegistrationMetadata({ owner: 2 }), 'DI_BAG_DUPLICATE_METADATA_KEY', { operation: 'withRegistrationMetadata', metadataKey: 'owner' }],
]);
```

A token registered twice is a sixth site of the same code (`withTokenService`). It has no row because its call needs a token, and a module-level token makes the row hard to read; assert it next to the existing token tests instead: `grep -rn "duplicate registration" tests/*.test.ts` finds them.

In `tests/api-renaming.test.ts`, change the one assertion on `'DI_BAG_DUPLICATE_METADATA'` to `'DI_BAG_DUPLICATE_METADATA_KEY'`.

- [ ] **Step 3: Run it to verify it fails**

Run: `bun test tests/error-code-taxonomy.test.ts tests/api-renaming.test.ts`

Expected: the five rows fail with `Expected: "DI_BAG_DUPLICATE_SERVICE_KEY"` or `"DI_BAG_DUPLICATE_METADATA_KEY"` and `Received:` the old code, and the edited assertion fails the same way. A row that fails with `Received: undefined` did not reach a library error at all: its call does not fit the API on your tree. Fix the call before going on.

- [ ] **Step 4: Change the throw sites**

At every site the inventory listed: the code literal, and the details. Messages stay exactly as they are; about 385 assertions in the suite quote message text.

```ts
// before (0.4.0 shape)
throw libraryError('DI_BAG_DUPLICATE_REGISTRATION', `duplicate registration: ${String(key)}`, { operation: 'register', key });
// after: the operation is whatever the site has at entry
throw libraryError('DI_BAG_DUPLICATE_SERVICE_KEY', `duplicate registration: ${String(key)}`, { operation: 'withServices', serviceKey: key });
```

The `duplicate export` site in `src/module.ts` keeps its existing keys and gains `serviceKey`, the NEW export key. The metadata site turns `key` into `metadataKey`. Then run the two test files again. Expected: `0 fail`.

- [ ] **Step 5: `docs/agent/errors.md`**

Rename the heading of `DI_BAG_DUPLICATE_METADATA` to `### DI_BAG_DUPLICATE_METADATA_KEY {#di-bag-duplicate-metadata-key}` and, in its body, say that `details.metadataKey` names the key. Delete the section `DI_BAG_DUPLICATE_REGISTRATION`. If `DI_BAG_DUPLICATE_SERVICE_KEY` has no section yet, create it with the text below; if it has, make its **When** list match this one. Its place in the alphabetical order is after `DI_BAG_DUPLICATE_METADATA_KEY`.

````markdown
### DI_BAG_DUPLICATE_SERVICE_KEY {#di-bag-duplicate-service-key}

**When:** `withServices`, `withTokenService`, `withServiceAlias`,
`withInstalledModules`, `withRenamedExport` or `withRenamedRequirement` would
give two services the same key. `details.operation` names the call and
`details.serviceKey` the key.

**Cause:** a builder holds one service per key. Adding a key that exists is
never a replacement.

**Fix:** to change an existing service use `withReplacedService`; otherwise pick
another key, or rename the module's export before installing it.

```ts
import { DiBag } from 'di-bag';

const base = DiBag.createBuilder().withServices({ clock: () => ({ now: () => 0 }) });
const app = base.withReplacedService({ serviceKey: 'clock', provider: () => ({ now: () => 1 }) }).buildContainer();
console.log(app.resolve('clock').now());
await app.close();
```
````

The example is type-checked by `npm run docs:check` against the emitted declarations. It was written from the spec and not compiled; if it fails, fix the example, not the check.

- [ ] **Step 6: JSDoc, the codemod map, the gate, the commit**

```bash
grep -rlE 'DI_BAG_DUPLICATE_(REGISTRATION|METADATA)([^A-Z_]|$)' src | xargs sed -i -E -e 's/DI_BAG_DUPLICATE_REGISTRATION/DI_BAG_DUPLICATE_SERVICE_KEY/g' -e 's/DI_BAG_DUPLICATE_METADATA([^A-Z_]|$)/DI_BAG_DUPLICATE_METADATA_KEY\1/g'
```

That fixes the backticked `@throws` mentions in `src/di-bag.ts` (four and one at 0.4.0) and any literal Step 4 missed. On a scratch copy of the 0.4.0 source this command left 8 occurrences of `DI_BAG_DUPLICATE_SERVICE_KEY` and 2 of `DI_BAG_DUPLICATE_METADATA_KEY` in `src`, and no `_KEY_KEY`. Add to the `codes` array of `tools/codemod/rename-map.json`:

```json
{ "from": "DI_BAG_DUPLICATE_REGISTRATION", "to": "DI_BAG_DUPLICATE_SERVICE_KEY" },
{ "from": "DI_BAG_DUPLICATE_METADATA", "to": "DI_BAG_DUPLICATE_METADATA_KEY" }
```

```bash
npm run codemod:check && npm run build && npm run docs:generate && npm run docs:check
node scripts/error-code-facts.mjs DI_BAG_DUPLICATE_REGISTRATION DI_BAG_DUPLICATE_SERVICE_KEY | grep '^  grep' | bash   # expect no output
node scripts/error-code-facts.mjs DI_BAG_DUPLICATE_METADATA DI_BAG_DUPLICATE_METADATA_KEY | grep '^  grep' | bash      # expect no output
git add tests/error-code-taxonomy.test.ts tests/api-renaming.test.ts src docs/agent docs/reference tools/codemod/rename-map.json
git commit -m "refactor(errors)!: DI_BAG_DUPLICATE_SERVICE_KEY and DI_BAG_DUPLICATE_METADATA_KEY"
```

---

### Task 6: `DI_BAG_UNKNOWN_SERVICE_KEY`

Every site that rejects a service key nobody registered takes this code, with `details: { operation, serviceKey }`. Three old codes move here whole and disappear: `DI_BAG_MISSING_REGISTRATION`, `DI_BAG_INVALID_REPLACEMENT`, `DI_BAG_INVALID_ALIAS`. Four more give up only their unknown-key site and live on until Task 9: `DI_BAG_INVALID_OVERRIDE`, `DI_BAG_INVALID_SCOPE`, `DI_BAG_INVALID_STARTUP`, `DI_BAG_INVALID_EXPORT`.

| Site, by its 0.4.0 message | 0.4.0 code |
| --- | --- |
| `Service "<key>" is not registered.` (twice in `src/runtime.ts`: `requirePublicBinding` and `requireRegistration`) | `DI_BAG_MISSING_REGISTRATION` |
| `replace accepts existing names or typed tokens only: <key>` | `DI_BAG_INVALID_REPLACEMENT` |
| `alias requires an existing named target` | `DI_BAG_INVALID_ALIAS` |
| `fork accepts existing names or typed tokens only: <key>` | `DI_BAG_INVALID_OVERRIDE` |
| `createScope accepts existing names or typed tokens only: <key>` (one site serves replaced and shared keys) | `DI_BAG_INVALID_SCOPE` |
| `buildAndStart accepts existing names or typed tokens only: <key>` | `DI_BAG_INVALID_STARTUP` |
| `renameExport requires an existing export` | `DI_BAG_INVALID_EXPORT` |
| `buildModule accepts existing names or typed tokens only` | `DI_BAG_INVALID_EXPORT` |

Phases 3 to 10 reworded these messages to the new method names. Find each site by the part of the message that cannot have changed: `is not registered`, `existing names or typed tokens only`, `requires an existing`.

**Files:**
- Modify: the sites above, `src/di-bag.ts` (JSDoc), `docs/agent/errors.md`, `docs/agent/recipes.md` if it links to a removed section, `tools/codemod/rename-map.json`
- Test: `tests/error-code-taxonomy.test.ts`, `tests/runtime-diagnostics.test.ts` (the existing assertions on `DI_BAG_MISSING_REGISTRATION`)

- [ ] **Step 1: Read the facts and list the sites**

```bash
for code in DI_BAG_MISSING_REGISTRATION DI_BAG_INVALID_REPLACEMENT DI_BAG_INVALID_ALIAS; do node scripts/error-code-facts.mjs $code DI_BAG_UNKNOWN_SERVICE_KEY; done
node scripts/error-code-inventory.mjs src 2>/dev/null | grep -E 'is not registered|existing names or typed tokens only|requires an existing'
```

At the 0.4.0 source the second command lists eleven rows: the nine sites of the table and two rows of `DI_BAG_MISSING_DEPENDENCY` (`Cannot resolve ...: dependency ... is not registered`). That code is unchanged: leave those two alone.

- [ ] **Step 2: Append the rows and edit the existing assertions**

Append to `tests/error-code-taxonomy.test.ts`:

```ts
check([
  // 0.4.0: bag.resolve('absent')
  ['resolve of an unknown key', () => container().resolve('absent'), 'DI_BAG_UNKNOWN_SERVICE_KEY', { operation: 'resolve', serviceKey: 'absent' }],
  // 0.4.0: builder().alias('other', 'absent')
  ['an alias to an unknown key', () => builder().withServiceAlias({ aliasKey: 'other', targetServiceKey: 'absent' }), 'DI_BAG_UNKNOWN_SERVICE_KEY', { operation: 'withServiceAlias', serviceKey: 'absent' }],
  // 0.4.0: builder().replace('absent', () => 1)
  ['a replacement of an unknown key', () => builder().withReplacedService({ serviceKey: 'absent', provider: () => 1 }), 'DI_BAG_UNKNOWN_SERVICE_KEY', { operation: 'withReplacedService', serviceKey: 'absent' }],
  // 0.4.0: bag.fork(['absent'], { absent: () => 1 })
  ['an independent container that replaces an unknown key', () => container().createIndependentContainer({ replacedServiceKeys: ['absent'], replacementProviders: { absent: () => 1 } }), 'DI_BAG_UNKNOWN_SERVICE_KEY', { operation: 'createIndependentContainer', serviceKey: 'absent' }],
  // 0.4.0: bag.createScope(['absent'], { absent: () => 1 })
  ['a child container that replaces an unknown key', () => container().createChildContainer({ replacedServiceKeys: ['absent'], replacementProviders: { absent: () => 1 } }), 'DI_BAG_UNKNOWN_SERVICE_KEY', { operation: 'createChildContainer', serviceKey: 'absent' }],
  // 0.4.0: bag.createScope({ share: ['absent'] })
  ['a child container that shares an unknown key', () => container().createChildContainer({ sharedParentServiceKeys: ['absent'] }), 'DI_BAG_UNKNOWN_SERVICE_KEY', { operation: 'createChildContainer', serviceKey: 'absent' }],
  // 0.4.0: builder().buildAndStart(['absent'])
  ['readiness of an unknown key', () => container().ensureServicesReady(['absent']), 'DI_BAG_UNKNOWN_SERVICE_KEY', { operation: 'ensureServicesReady', serviceKey: 'absent' }],
  // 0.4.0: <module>.renameExport('absent', 'x')
  ['a rename of an unknown export', () => builder().buildModule({ exportedServiceKeys: ['config'] }).withRenamedExport({ currentExportKey: 'absent', newExportKey: 'x' }), 'DI_BAG_UNKNOWN_SERVICE_KEY', { operation: 'withRenamedExport', serviceKey: 'absent' }],
  // 0.4.0: builder().buildModule(['absent'])
  ['a module that exports an unknown key', () => builder().buildModule({ exportedServiceKeys: ['absent'] }), 'DI_BAG_UNKNOWN_SERVICE_KEY', { operation: 'buildModule', serviceKey: 'absent' }],
]);
```

In `tests/runtime-diagnostics.test.ts` the first test asserts the old code three ways. All three change, and the whole-message assertion needs the code and the fragment:

```ts
// before
expect(missing.code).toBe('DI_BAG_MISSING_REGISTRATION');
expect(missing.message).toBe(`DI_BAG_MISSING_REGISTRATION: Service "absent" is not registered.; see ${page}#di-bag-missing-registration`);
expect(missing.details).toEqual({ operation: 'resolve', key: 'absent' });
// after
expect(missing.code).toBe('DI_BAG_UNKNOWN_SERVICE_KEY');
expect(missing.message).toBe(`DI_BAG_UNKNOWN_SERVICE_KEY: Service "absent" is not registered.; see ${page}#di-bag-unknown-service-key`);
expect(missing.details).toEqual({ operation: 'resolve', serviceKey: 'absent' });
```

- [ ] **Step 3: Run to verify the failures**

Run: `bun test tests/error-code-taxonomy.test.ts tests/runtime-diagnostics.test.ts`

Expected: the nine new rows and the edited test fail, each with `Received:` one of the old codes in the table. The rows of Task 5 still pass.

- [ ] **Step 4: Change the sites**

Code literal and details only; messages stay. Four decisions that are not mechanical:

1. The second `is not registered` site, `requireRegistration` in `src/runtime.ts`, has no public key in hand. Give it `{ bindingId, bindingLabel: this.label(id) }` next to the new code, with whatever name the label accessor has on your tree. No row reaches it: it guards an internal invariant. Do not write a test that fakes one.
2. `renameExport requires an existing export` is a combined condition at 0.4.0, `typeof oldKey !== 'string' || !description.exports.has(oldKey)`. Split it. The `typeof` half is malformed input and belongs to Task 9: leave it raising the old code for now, as its own `if`. The `has` half takes the new code with `serviceKey` set to the current export key.
3. The `buildModule` site names no key in its message or details today. Add `serviceKey` to the details; leave the message.
4. The alias site has `target` in its details: it becomes `serviceKey`.

Then run the two test files again. Expected: `0 fail`.

- [ ] **Step 5: `docs/agent/errors.md`**

Delete the sections `DI_BAG_MISSING_REGISTRATION`, `DI_BAG_INVALID_REPLACEMENT` and `DI_BAG_INVALID_ALIAS`. Leave the sections of the four split codes alone, but remove the unknown-key clause from their **When** text (for example "an unregistered key" in `DI_BAG_INVALID_SCOPE`). Create or complete this section, after `DI_BAG_STRUCTURAL_THENABLE` in the alphabetical order:

````markdown
### DI_BAG_UNKNOWN_SERVICE_KEY {#di-bag-unknown-service-key}

**When:** a call names a service key that the builder, container or module does
not have: `resolve`, `ensureServicesReady`, `withServiceAlias` (the target),
`withReplacedService`, `createChildContainer`, `createIndependentContainer`,
`buildModule` (an exported key), `withRenamedExport` and
`withRenamedRequirement` (the current key). `details.operation` names the call
and `details.serviceKey` the key.

**Cause:** the key is misspelled, was never registered, or is private to a
module. The compiler reports this first; the runtime error is what an untyped
call gets.

**Fix:** register the service before the call, or correct the key.

```ts
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder().withServices({ clock: () => ({ now: () => 0 }) }).buildContainer();
console.log(app.resolve('clock').now());
await app.close();
```
````

- [ ] **Step 6: JSDoc, links, the map, the gate, the commit**

At 0.4.0 `src/di-bag.ts` mentions the three whole codes in JSDoc two, two and one times (`DI_BAG_MISSING_REGISTRATION`, `DI_BAG_INVALID_REPLACEMENT`, `DI_BAG_INVALID_ALIAS`). None of the three is a prefix of another code and the new code does not start with any of them, so:

```bash
grep -rlE 'DI_BAG_(MISSING_REGISTRATION|INVALID_REPLACEMENT|INVALID_ALIAS)|di-bag-(missing-registration|invalid-replacement|invalid-alias)' src docs/agent/recipes.md AGENTS.md docs/guides | xargs -r sed -i -E \
  -e 's/DI_BAG_(MISSING_REGISTRATION|INVALID_REPLACEMENT|INVALID_ALIAS)/DI_BAG_UNKNOWN_SERVICE_KEY/g' \
  -e 's/di-bag-(missing-registration|invalid-replacement|invalid-alias)/di-bag-unknown-service-key/g'
wc -l AGENTS.md   # must still be at most 150
```

On a scratch copy of the 0.4.0 source this command changed `src/di-bag.ts` (6 lines), `src/runtime.ts` (2) and `src/aliases.ts` (1), and nothing in `AGENTS.md`, the recipes or the guides. Read the diff of `src/di-bag.ts` afterwards: if one `@throws` line now names `DI_BAG_UNKNOWN_SERVICE_KEY` twice, merge the two mentions (at 0.4.0 none does). Add to `codes` in `tools/codemod/rename-map.json`:

```json
{ "from": "DI_BAG_MISSING_REGISTRATION", "to": "DI_BAG_UNKNOWN_SERVICE_KEY" },
{ "from": "DI_BAG_INVALID_REPLACEMENT", "to": "DI_BAG_UNKNOWN_SERVICE_KEY" },
{ "from": "DI_BAG_INVALID_ALIAS", "to": "DI_BAG_UNKNOWN_SERVICE_KEY" }
```

```bash
npm run codemod:check && npm run build && npm run docs:generate && npm run docs:check
for code in DI_BAG_MISSING_REGISTRATION DI_BAG_INVALID_REPLACEMENT DI_BAG_INVALID_ALIAS; do node scripts/error-code-facts.mjs $code DI_BAG_UNKNOWN_SERVICE_KEY | grep '^  grep' | bash; done   # expect no output
git add tests/error-code-taxonomy.test.ts tests/runtime-diagnostics.test.ts src docs/agent docs/reference docs/guides AGENTS.md tools/codemod/rename-map.json
git commit -m "refactor(errors)!: DI_BAG_UNKNOWN_SERVICE_KEY for every unknown key"
```

The gate is run only for the three codes that are gone. The four split codes still have sites; their gate is in Task 9.

---

### Task 7: `DI_BAG_MISSING_REPLACEMENT_PROVIDER` and `DI_BAG_CONFLICTING_SERVICE_SELECTION`

Four sites, all in the selection logic of `createChildContainer` and `createIndependentContainer` (`src/scope-selection.ts` and `src/di-bag.ts` at 0.4.0). Both target codes are new, so both sections are new. No old code disappears in this task.

| Site, by its 0.4.0 message | 0.5.0 code | `details` |
| --- | --- | --- |
| `missing override: <key>` (independent container) | `DI_BAG_MISSING_REPLACEMENT_PROVIDER` | `{ operation: 'createIndependentContainer', serviceKey }` |
| `missing createScope override: <key>` | `DI_BAG_MISSING_REPLACEMENT_PROVIDER` | `{ operation: 'createChildContainer', serviceKey }` |
| `createScope cannot share and override the same token: <key>` | `DI_BAG_CONFLICTING_SERVICE_SELECTION` | `{ operation: 'createChildContainer', serviceKey, conflict: 'shared-and-replaced' }` |
| `createScope cannot share transient providers: <key>` | `DI_BAG_CONFLICTING_SERVICE_SELECTION` | `{ operation: 'createChildContainer', serviceKey, conflict: 'shared-transient' }` |

The values of `conflict` are kebab-case strings, as the naming guide requires of every string value. Phase 10 added a fifth rule to this code path, a child may not replace a singleton: it has its own code and section from that phase. Do not touch it.

**Files:**
- Modify: the four sites, `docs/agent/errors.md`
- Test: `tests/error-code-taxonomy.test.ts`

- [ ] **Step 1: List the sites**

```bash
node scripts/error-code-inventory.mjs src 2>/dev/null | grep -iE 'missing .*(override|replacement)|cannot share'
```

- [ ] **Step 2: Append the rows**

```ts
check([
  // 0.4.0: bag.fork(['config'], {})
  ['an independent container without the provider for a replaced key', () => container().createIndependentContainer({ replacedServiceKeys: ['config'], replacementProviders: {} }), 'DI_BAG_MISSING_REPLACEMENT_PROVIDER', { operation: 'createIndependentContainer', serviceKey: 'config' }],
  // 0.4.0: bag.createScope(['config'], {})
  ['a child container without the provider for a replaced key', () => container().createChildContainer({ replacedServiceKeys: ['config'], replacementProviders: {} }), 'DI_BAG_MISSING_REPLACEMENT_PROVIDER', { operation: 'createChildContainer', serviceKey: 'config' }],
  // 0.4.0: bag.createScope(['config'], { config: ... }, { share: ['config'] })
  ['a key both replaced and shared', () => container().createChildContainer({ replacedServiceKeys: ['config'], replacementProviders: { config: scoped(() => ({ region: 'us' })) }, sharedParentServiceKeys: ['config'] }), 'DI_BAG_CONFLICTING_SERVICE_SELECTION', { operation: 'createChildContainer', serviceKey: 'config', conflict: 'shared-and-replaced' }],
  // 0.4.0: bag.createScope({ share: ['id'] })
  ['a transient service shared with a child', () => container().createChildContainer({ sharedParentServiceKeys: ['id'] }), 'DI_BAG_CONFLICTING_SERVICE_SELECTION', { operation: 'createChildContainer', serviceKey: 'id', conflict: 'shared-transient' }],
]);
```

- [ ] **Step 3: Run to verify the failures**

Run: `bun test tests/error-code-taxonomy.test.ts`. Expected: four failures, `Received:` being `DI_BAG_INVALID_OVERRIDE` or `DI_BAG_INVALID_SCOPE`, or whatever those sites raise at entry. If the third row is rejected earlier by the singleton rule of phase 10, the fixture's `config` is not scoped on your tree: check `scoped()` at the top of the file.

- [ ] **Step 4: Change the four sites**

Code literal and details as in the table; messages stay. Run the file again. Expected: `0 fail`.

- [ ] **Step 5: Add the two sections to `docs/agent/errors.md`**

`DI_BAG_CONFLICTING_SERVICE_SELECTION` goes after `DI_BAG_CLOSING`, and `DI_BAG_MISSING_REPLACEMENT_PROVIDER` after `DI_BAG_MISSING_DEPENDENCY`. Remove the matching clauses from the **When** text of `DI_BAG_INVALID_SCOPE` and `DI_BAG_INVALID_OVERRIDE` ("a key both shared and overridden, a shared transient service, or a selected key without an override").

````markdown
### DI_BAG_CONFLICTING_SERVICE_SELECTION {#di-bag-conflicting-service-selection}

**When:** `createChildContainer` names one key in both `replacedServiceKeys` and
`sharedParentServiceKeys` (`details.conflict` is `'shared-and-replaced'`), or
shares a transient service (`'shared-transient'`). `details.serviceKey` names
the key.

**Cause:** sharing means the child uses the parent's instance and replacing
means it builds its own, so one key cannot do both. A transient service has no
instance to share.

**Fix:** list each key once, and do not share a transient service.

```ts
import { DiBag } from 'di-bag';

const scoped = 'scoped:one-per-container';
const parent = DiBag.createBuilder()
  .withServices({
    config: DiBag.createProvider(() => ({ region: 'eu' })).withLifetime(scoped),
    client: DiBag.createProvider(() => ({ id: 1 })).withLifetime(scoped),
  })
  .buildContainer();
const child = parent.createChildContainer({
  replacedServiceKeys: ['config'],
  replacementProviders: { config: () => ({ region: 'us' }) },
  sharedParentServiceKeys: ['client'],
});
console.log(child.resolve('config').region);
await parent.close();
```

**Recipe:** [add a request-scoped service with cleanup](recipes.md#add-scoped-service).

### DI_BAG_MISSING_REPLACEMENT_PROVIDER {#di-bag-missing-replacement-provider}

**When:** `createChildContainer` or `createIndependentContainer` lists a key in
`replacedServiceKeys` and `replacementProviders` has no own property for it.
`details.serviceKey` names the key.

**Cause:** the two options are read together: the list says which services the
new container replaces, the record says with what.

**Fix:** give one provider for every listed key, or take the key off the list.

```ts
import { DiBag } from 'di-bag';

const parent = DiBag.createBuilder().withServices({ config: () => ({ region: 'eu' }) }).buildContainer();
const copy = parent.createIndependentContainer({
  replacedServiceKeys: ['config'],
  replacementProviders: { config: () => ({ region: 'us' }) },
});
console.log(copy.resolve('config').region);
await copy.close();
await parent.close();
```
````

Check the recipe anchor before keeping the **Recipe** line: `grep -n "{#add-scoped-service}" docs/agent/recipes.md`. If an earlier phase renamed it, use the new anchor.

- [ ] **Step 6: Verify and commit**

```bash
npm run build && npm run docs:generate && npm run docs:check   # expect exit 0: both new codes have a section and are raised in src
git add tests/error-code-taxonomy.test.ts src docs/agent docs/reference
git commit -m "refactor(errors)!: DI_BAG_MISSING_REPLACEMENT_PROVIDER and DI_BAG_CONFLICTING_SERVICE_SELECTION"
```

---

### Task 8: `DI_BAG_INVALID_PROVIDER` and `DI_BAG_INVALID_ACQUISITION_METADATA`

Two single sites that are not malformed call arguments, which is why they do not join `DI_BAG_INVALID_ARGUMENT`.

| Site, by its 0.4.0 message | Where at 0.4.0 | 0.5.0 code | `details` |
| --- | --- | --- | --- |
| `invalid factory registration` | `describe` in `src/provider-operations.ts` | `DI_BAG_INVALID_PROVIDER` | what the site has at entry, `{ operation }` |
| `acquisition metadata must be a synchronous plain object record` | `invalidAcquisitionMetadata` in `src/provider.ts` | `DI_BAG_INVALID_ACQUISITION_METADATA` | `{ operation: 'withAcquisitionMetadata' }` |

Out of scope, decided here: `describe` has seven callers and does not know which service key it is describing, so the first site keeps `{ operation }` and does not gain a `serviceKey`. Threading the key through is a change of behavior, not a rename. The second site stays a `libraryTypeError`.

**Files:**
- Modify: the two sites, `docs/agent/errors.md`
- Test: `tests/error-code-taxonomy.test.ts`, `tests/api-renaming.test.ts`

- [ ] **Step 1: Append the rows**

```ts
check([
  // 0.4.0: builder().register({ bad: 42 })
  ['a service that is neither a function nor a provider', () => builder().withServices({ bad: 42 }), 'DI_BAG_INVALID_PROVIDER', { operation: 'withServices' }],
  // 0.4.0: resolve of DiBag.withMetadata(f, { dynamic: { mode: 'direct', describe: () => 42 } })
  ['a describe callback that returns a bad record', () => D.createBuilder().withServices({ value: D.createProvider(() => 1).withAcquisitionMetadata({ describeAcquisition: () => 42, callbackReceives: 'exposed-service' }) }).buildContainer().resolve('value'), 'DI_BAG_INVALID_ACQUISITION_METADATA', { operation: 'withAcquisitionMetadata' }],
]);
```

Two existing assertions pin this very site with the old code. In `tests/api-renaming.test.ts`, the test about asynchronous metadata callbacks loops over both callback modes and expects `DI_BAG_INVALID_METADATA` from `resolve`, once with `caught(...)` and once with `rejects.toMatchObject`: change both to `DI_BAG_INVALID_ACQUISITION_METADATA`. The two OTHER assertions on `DI_BAG_INVALID_METADATA` in that file are about malformed options and belong to Task 9.

- [ ] **Step 2: Run to verify the failures**

Run: `bun test tests/error-code-taxonomy.test.ts tests/api-renaming.test.ts`. Expected: the two new rows and the two edited assertions fail, `Received:` being `DI_BAG_INVALID_REGISTRATION` and `DI_BAG_INVALID_METADATA`, or what those sites raise at entry.

- [ ] **Step 3: Change the two sites, then run again**

Expected: `0 fail`.

- [ ] **Step 4: Add the two sections to `docs/agent/errors.md`**

`DI_BAG_INVALID_ACQUISITION_METADATA` is the first of the `DI_BAG_INVALID_` sections in the alphabetical order; `DI_BAG_INVALID_PROVIDER` goes after `DI_BAG_INVALID_PLUGIN_OPTIONS`, a section that Task 9 removes; its final neighbours are `DI_BAG_INVALID_MODULE` before it and `DI_BAG_INVALID_TOKEN` after it. Remove the clause about a bad describe result from the **When** text of `DI_BAG_INVALID_METADATA`, and the clause about a value that is not a factory from `DI_BAG_INVALID_REGISTRATION`.

````markdown
### DI_BAG_INVALID_ACQUISITION_METADATA {#di-bag-invalid-acquisition-metadata}

**When:** a `describeAcquisition` callback returns something other than a plain
object, synchronously: a Promise, an array, `null` or a primitive. It is raised
while the service is acquired, so `resolve` throws or rejects with a
`TypeError`.

**Cause:** acquisition metadata is recorded at the moment the service becomes
available. A Promise cannot be recorded, and the library does not await it.

**Fix:** return a plain record. To describe the fulfilled value of an
asynchronous factory, ask for it with `callbackReceives: 'fulfilled-value'`.

```ts
import { DiBag } from 'di-bag';

const db = DiBag.createProvider(async () => ({ version: 7 }))
  .withAcquisitionMetadata({ describeAcquisition: value => ({ version: value.version }), callbackReceives: 'fulfilled-value' });
const app = DiBag.createBuilder().withServices({ db }).buildContainer();
await app.resolve('db');
await app.close();
```

### DI_BAG_INVALID_PROVIDER {#di-bag-invalid-provider}

**When:** a value given where a factory or a provider is required is neither a
function nor a provider made by this library: a value of `withServices`, the
`provider` of `withTokenService`, `withCollectionContribution` or
`withReplacedService`, or an entry of `replacementProviders`.

**Cause:** the service itself was passed instead of a factory for it, or a
provider object was copied. A provider is recognised by identity, so a spread
copy of one is not a provider.

**Fix:** pass `() => value`, or a provider returned by `DiBag.createProvider` and
its sibling calls.

```ts
import { DiBag } from 'di-bag';

const config = { region: 'eu' };
const app = DiBag.createBuilder().withServices({ config: () => config }).buildContainer();
console.log(app.resolve('config').region);
await app.close();
```
````

- [ ] **Step 5: Verify and commit**

```bash
npm run build && npm run docs:generate && npm run docs:check   # expect exit 0
git add tests/error-code-taxonomy.test.ts tests/api-renaming.test.ts src docs/agent docs/reference
git commit -m "refactor(errors)!: DI_BAG_INVALID_PROVIDER and DI_BAG_INVALID_ACQUISITION_METADATA"
```

---

### Task 9: `DI_BAG_INVALID_ARGUMENT`

Every remaining site that rejects a malformed input takes one code, `DI_BAG_INVALID_ARGUMENT`, with `details: { operation, argument, expected }`, which is the one details shape the spec fixes. Sixteen old codes end here. Ten move whole: `DI_BAG_INVALID_ACQUISITION_MODE`, `_CLEANUP`, `_CLOSE`, `_CONFIGURATION`, `_CONSTRUCTOR`, `_FACTORY`, `_FUNCTION`, `_LIFETIME`, `_PLUGIN_OPTIONS`, `_TRANSFORM`. Six were split, and Tasks 5 to 8 already took their other sites: `DI_BAG_INVALID_EXPORT`, `_METADATA`, `_OVERRIDE`, `_REGISTRATION`, `_SCOPE`, `_STARTUP`. At the 0.4.0 source this is 52 throw statements plus the four conditions inside the shared options validator.

**The three keys.** These rules are the contract; the rows below apply them.

- `operation`: the 0.5.0 name of the public method the caller used, never the name of an internal helper.
- `argument`: the documented name of the parameter, or the name of the option when the method takes one bag. A nested option is a dotted path, `runtime.isNativePromise`. An element of a list is the list's name followed by `[]`, `lifecycleObservers[].onLifecycleEvent`. The bag as a whole is `options`.
- `expected`: a short phrase that completes "<argument> must be ...", in lower case, with no full stop, from this vocabulary and no other: `a function`, `an object`, `an array`, `a boolean`, `a string`, `a non-empty string`, `a positive safe integer`, `a finite positive number`, `an AbortSignal`, `a constructor that can be called with new`, `only string keys`, `present`, `one of: 'a', 'b'` (every accepted value, in single quotes, in the order of the type's declaration), `only the own properties: a, b` (every accepted property, in the order of the interface), `absent when <option> is '<value>'`, `absent unless <option> is '<value>'`.
- Every other key a site already has stays (`lifetime`, `provided`, `currentExportKey`, `newExportKey`). The old key `option` goes: `argument` replaces it.
- Messages stay exactly as they are at entry. `libraryError` stays `libraryError` and `libraryTypeError` stays `libraryTypeError`, site by site.

A caller can now tell twin checks apart. At 0.4.0 seven pairs of adjacent throws share one message and one details object, for example "not an object" and "has no `isNativePromise`" in `runtimeContext`. Under the new code each half gets its own `argument` and `expected`. Where one `if` tests two things with `||`, split it into two `if`s so each can say which one failed.

**Files:**
- Modify: every file the inventory lists for the sixteen codes (at 0.4.0: `src/acquisition-context.ts`, `src/acquisition-mode.ts`, `src/composition.ts`, `src/di-bag.ts`, `src/lifetime.ts`, `src/module.ts`, `src/observers.ts`, `src/plugins.ts`, `src/provider-execution.ts`, `src/provider.ts`, `src/registration.ts`, `src/scope-selection.ts`, `src/startup.ts`), `docs/agent/errors.md`, `tools/codemod/rename-map.json`
- Test: `tests/error-code-taxonomy.test.ts`, and the existing assertions the facts script finds (at 0.4.0: `tests/portable-factories.test.ts` 7, `tests/api-renaming.test.ts` 2, `tests/runtime-diagnostics.test.ts` 3, `tests/acquisition-cleanup.test.ts` 1)

**Interfaces:**
- Consumes: `check`, `builder`, `container` from Task 5; the inventory's `incomplete details` count from Task 1.
- Produces: the code `DI_BAG_INVALID_ARGUMENT` with `details: { operation: string; argument: string; expected: string }` at every malformed-input site.

**The sites, by the message each had at 0.4.0, and the row that pins it.** Every one of these conditions was reached by a probe call at the 0.4.0 source when the plan was written. "none" means an earlier phase removed the condition; confirm with the inventory and skip it.

| Site, by its 0.4.0 message | 0.4.0 code | Row that pins it | Note |
| --- | --- | --- | --- |
| fromFactory requires a function | `INVALID_FACTORY` | `createProvider: factory is not a function` |  |
| fromSyncFactory requires a function | `INVALID_FACTORY` | `createProvider: factory is not a function` | phase 8 folds the three sources into `createProvider`; one site should be left |
| fromAsyncFactory requires a function | `INVALID_FACTORY` | `createProvider: factory is not a function` | as above |
| <operation> options must be an object | `INVALID_FACTORY` | `createProvider: options is not an object` |  |
| fromFactory context must be acquisition | `INVALID_FACTORY` | `createProvider: factoryReceivesContext is not a boolean` | phase 8 turns `context: 'acquisition'` into the boolean |
| <operation> context must be acquisition | `INVALID_FACTORY` | `createProvider: factoryReceivesContext is not a boolean` | as above |
| <operation> selects its acquisitionMode itself | `INVALID_FACTORY` | none | gone with `fromSyncFactory` and `fromAsyncFactory` in phase 8 |
| invalid acquisition options | `INVALID_ACQUISITION_MODE` | `createProviderFromFunction: options is not an object` | a shared helper: see Step 4 |
| invalid acquisitionMode: use auto, raw, or nativePromise | `INVALID_ACQUISITION_MODE` | `createProvider: unknown factoryReturnKind` | a shared helper: see Step 4 |
| fromFunction callback must be a function | `INVALID_FUNCTION` | `createProviderFromFunction: factoryFunction is not a function` |  |
| fromClass requires a concrete constructor (the `typeof` check) | `INVALID_CONSTRUCTOR` | `createProviderFromClass: serviceClass is not a function` | twin throw, first half |
| fromClass requires a concrete constructor (the `catch` around the construct probe) | `INVALID_CONSTRUCTOR` | `createProviderFromClass: serviceClass cannot be constructed` | twin throw, second half |
| fromPlugin requires acquisitionMode and validate options | `INVALID_PLUGIN_OPTIONS` | `createProviderFromPlugin: options is not an object` |  |
| fromPlugin requires acquisitionMode | `INVALID_PLUGIN_OPTIONS` | `createProviderFromPlugin: factoryReturnKind is missing` |  |
| fromPlugin acquisitionMode must be raw or nativePromise | `INVALID_PLUGIN_OPTIONS` | `createProviderFromPlugin: factoryReturnKind may not be inspected` |  |
| fromPlugin requires a validation predicate | `INVALID_PLUGIN_OPTIONS` | `createProviderFromPlugin: isValidPluginOutput is missing` |  |
| fromPlugin validate must be a function | `INVALID_PLUGIN_OPTIONS` | `createProviderFromPlugin: isValidPluginOutput is not a function` |  |
| invalid lifetime policy | `INVALID_LIFETIME` | `withLifetime: unknown lifetime` |  |
| invalid lifetime options (not an object) | `INVALID_LIFETIME` | `withLifetime: options is not an object` | twin throw, first half |
| invalid lifetime options (an unknown or inherited property) | `INVALID_LIFETIME` | `withLifetime: unknown option` | twin throw, second half |
| withLifetime allowScopedDependencies requires root lifetime | `INVALID_LIFETIME` | `withLifetime: allowsScopedDependencies on a scoped service` |  |
| withLifetime allowScopedDependencies must be boolean | `INVALID_LIFETIME` | `withLifetime: allowsScopedDependencies is not a boolean` |  |
| metadata must be a string or symbol-keyed object | `INVALID_METADATA` | `withRegistrationMetadata: registrationMetadata is not an object` |  |
| withMetadata requires static or dynamic metadata (twice) | `INVALID_METADATA` | `withAcquisitionMetadata: options is not an object` | phase 9 splits `withMetadata`; the "neither static nor dynamic" half is gone |
| withMetadata static and dynamic options must be own properties | `INVALID_METADATA` | none | gone with the `{ static, dynamic }` bag in phase 9 |
| withMetadata dynamic mode must be direct or awaited (twice) | `INVALID_METADATA` | `withAcquisitionMetadata: unknown callbackReceives` |  |
| acquisition metadata requires a function (twice) | `INVALID_METADATA` | `withAcquisitionMetadata: describeAcquisition is not a function` |  |
| transformService mode must be direct or awaited | `INVALID_TRANSFORM` | `withTransformedService: unknown callbackReceives` |  |
| transformService requires a transform callback | `INVALID_TRANSFORM` | `withTransformedService: transformService is not a function` |  |
| transformService awaited mode does not accept acquisitionMode | `INVALID_TRANSFORM` | `withTransformedService: transformReturnKind with a fulfilled value` |  |
| pushDisposer requires a function | `INVALID_CLEANUP` | `pushDisposer: disposer is not a function` | keeps its `provided` key |
| registrations must be a string-keyed object | `INVALID_REGISTRATION` | `withServices: services is not an object` |  |
| registration keys must be strings | `INVALID_REGISTRATION` | `withServices: a symbol key` |  |
| buildModule requires a key tuple | `INVALID_EXPORT` | `buildModule: exportedServiceKeys is not an array` |  |
| buildModule options must be { label?: string } with a non-empty label | `INVALID_EXPORT` | `buildModule: moduleLabel is empty` | one site for several malformed inputs today: see Step 4 |
| renameExport requires a string name | `INVALID_EXPORT` | `withRenamedExport: newExportKey is not a string` |  |
| renameExport requires an existing export (the `typeof` half, split off in Task 6) | `INVALID_EXPORT` | `withRenamedExport: currentExportKey is not a string` |  |
| createScope requires a selected key array | `INVALID_SCOPE` | `createChildContainer: replacedServiceKeys is not an array` |  |
| createScope requires an override object | `INVALID_SCOPE` | `createChildContainer: replacementProviders is not an object` |  |
| createScope options require only an own share selection | `INVALID_SCOPE` | `createChildContainer: unknown option` |  |
| createScope accepts sharing options or selected keys, overrides and optional sharing options | `INVALID_SCOPE` | none | gone with the positional form in phase 6 |
| fork requires selected keys and an override object | `INVALID_OVERRIDE` | `createIndependentContainer: replacedServiceKeys is not an array` | one combined condition today; its other half is the next row |
| fork requires selected keys and an override object | `INVALID_OVERRIDE` | `createIndependentContainer: replacementProviders is not an object` |  |
| buildAndStart requires selected keys | `INVALID_STARTUP` | `ensureServicesReady: serviceKeys is not an array` |  |
| buildAndStart startupOrder must be parallel, sequential, or a positive safe integer | `INVALID_STARTUP` | `ensureServicesReady: maxConcurrentServiceKeys is zero` | phase 3 replaced `startupOrder` |
| invalid <operation> options (not an object), in `snapshotOptions` | `INVALID_STARTUP, INVALID_CLOSE` | `ensureServicesReady: options is not an object` | and `close: options is not an object` |
| invalid <operation> options (an unknown or inherited property), in `snapshotOptions` | `INVALID_STARTUP, INVALID_CLOSE` | `close: unknown option` |  |
| <operation> timeoutMs must be finite and positive, in `snapshotOptions` | `INVALID_STARTUP, INVALID_CLOSE` | `close: waitTimeoutMs is zero` | and `ensureServicesReady: totalTimeoutMs is negative` |
| <operation> signal must be an AbortSignal, in `snapshotOptions` | `INVALID_STARTUP, INVALID_CLOSE` | `close: abortSignal is not an AbortSignal` | and the `ensureServicesReady` row |
| withConfiguration requires an options object | `INVALID_CONFIGURATION` | `withConfiguration: options is not an object` | stays a `libraryTypeError` |
| withConfiguration observers must be an array | `INVALID_CONFIGURATION` | `withConfiguration: lifecycleObservers is not an array` | stays a `libraryTypeError` |
| withConfiguration runtime requires isNativePromise (the `typeof options` check) | `INVALID_CONFIGURATION` | `withConfiguration: runtime is not an object` | twin throw, first half |
| withConfiguration runtime requires isNativePromise (the `typeof isNativePromise` check) | `INVALID_CONFIGURATION` | `withConfiguration: runtime has no classifier` | twin throw, second half |
| withConfiguration observers require onEvent and onError callbacks (the `typeof options` check) | `INVALID_CONFIGURATION` | `withConfiguration: an observer is not an object` | twin throw, first half |
| withConfiguration observers require onEvent and onError callbacks (the callbacks check) | `INVALID_CONFIGURATION` | `withConfiguration: onLifecycleEvent is not a function` | one combined condition today: split it, the other half is `onObserverFailure is not a function` |

Four rows of the block are the SECOND row of a site, named in that site's Note: `close: options is not an object`, `ensureServicesReady: abortSignal is not an AbortSignal`, `ensureServicesReady: totalTimeoutMs is negative`, `withConfiguration: onObserverFailure is not a function`. Some rows test a property that only the 0.5.0 bags have, such as `factoryReceivesContext`. If the validation for such a property does not exist on your tree, add it in Step 4: a bag that silently accepts a malformed property is the defect these rows exist to catch.

- [ ] **Step 1: List the sites on your tree**

```bash
node scripts/error-code-inventory.mjs src 2>/dev/null | awk -F'\t' '$4 ~ /DI_BAG_INVALID_(ACQUISITION_MODE|CLEANUP|CLOSE|CONFIGURATION|CONSTRUCTOR|EXPORT|FACTORY|FUNCTION|LIFETIME|METADATA|OVERRIDE|PLUGIN_OPTIONS|REGISTRATION|SCOPE|STARTUP|TRANSFORM)/' > /tmp/invalid-argument-sites.tsv
wc -l < /tmp/invalid-argument-sites.tsv
for code in ACQUISITION_MODE CLEANUP CLOSE CONFIGURATION CONSTRUCTOR EXPORT FACTORY FUNCTION LIFETIME METADATA OVERRIDE PLUGIN_OPTIONS REGISTRATION SCOPE STARTUP TRANSFORM; do node scripts/error-code-facts.mjs DI_BAG_INVALID_$code DI_BAG_INVALID_ARGUMENT > /tmp/facts-$code.txt; done
grep -h "^tests:\|^   [0-9]" /tmp/facts-*.txt
```

At the 0.4.0 source the first file has 66 rows, because it still holds the sites that Tasks 5 to 8 take; on your tree those are gone. Every row of the file is a site to change. A row whose owner column is `snapshotOptions` is a CALL of the shared validator that passes a code down; the throw statements are inside the validator.

- [ ] **Step 2: Append the rows**

Append to `tests/error-code-taxonomy.test.ts`:

```ts
const plugin = { apiVersion: 1, create: () => 1, dispose: () => {} };
const isNumber = (value: unknown): value is number => typeof value === 'number';
const singleton = 'singleton:one-per-container-tree';
const argument = (title: string, run: () => unknown, operation: string, name: string, expected: string): Row =>
  [`${operation}: ${title}`, run, 'DI_BAG_INVALID_ARGUMENT', { operation, argument: name, expected }];

check([
  // Provider sources. 0.4.0: fromFactory, fromSyncFactory, fromAsyncFactory, fromFunction, fromClass, fromPlugin.
  argument('factory is not a function', () => D.createProvider(42), 'createProvider', 'factory', 'a function'),
  argument('options is not an object', () => D.createProvider(() => 1, 42), 'createProvider', 'options', 'an object'),
  argument('unknown factoryReturnKind', () => D.createProvider(() => 1, { factoryReturnKind: 'bad' }), 'createProvider', 'factoryReturnKind', "one of: 'auto-detect', 'sync-value', 'native-promise', 'uninspected'"),
  argument('factoryReceivesContext is not a boolean', () => D.createProvider(() => 1, { factoryReceivesContext: 'bad' }), 'createProvider', 'factoryReceivesContext', 'a boolean'),
  argument('options is not an object', () => D.createProviderFromFunction(42), 'createProviderFromFunction', 'options', 'an object'),
  argument('factoryFunction is not a function', () => D.createProviderFromFunction({ dependencies: [], factoryFunction: 42 }), 'createProviderFromFunction', 'factoryFunction', 'a function'),
  argument('serviceClass is not a function', () => D.createProviderFromClass({ dependencies: [], serviceClass: 42 }), 'createProviderFromClass', 'serviceClass', 'a function'),
  argument('serviceClass cannot be constructed', () => D.createProviderFromClass({ dependencies: [], serviceClass: () => 1 }), 'createProviderFromClass', 'serviceClass', 'a constructor that can be called with new'),
  argument('options is not an object', () => D.createProviderFromPlugin(42), 'createProviderFromPlugin', 'options', 'an object'),
  argument('factoryReturnKind is missing', () => D.createProviderFromPlugin({ dependencies: [], pluginDescriptor: plugin, isValidPluginOutput: isNumber }), 'createProviderFromPlugin', 'factoryReturnKind', 'present'),
  argument('factoryReturnKind may not be inspected', () => D.createProviderFromPlugin({ dependencies: [], pluginDescriptor: plugin, isValidPluginOutput: isNumber, factoryReturnKind: 'auto-detect' }), 'createProviderFromPlugin', 'factoryReturnKind', "one of: 'uninspected', 'native-promise'"),
  argument('isValidPluginOutput is missing', () => D.createProviderFromPlugin({ dependencies: [], pluginDescriptor: plugin, factoryReturnKind: 'uninspected' }), 'createProviderFromPlugin', 'isValidPluginOutput', 'present'),
  argument('isValidPluginOutput is not a function', () => D.createProviderFromPlugin({ dependencies: [], pluginDescriptor: plugin, isValidPluginOutput: 1, factoryReturnKind: 'uninspected' }), 'createProviderFromPlugin', 'isValidPluginOutput', 'a function'),

  // Provider methods. 0.4.0: withLifetime, withMetadata, transformService, and pushDisposer on the factory context.
  argument('unknown lifetime', () => D.createProvider(() => 1).withLifetime('bad'), 'withLifetime', 'lifetime', "one of: 'singleton:one-per-container-tree', 'scoped:one-per-container', 'transient:one-per-resolve'"),
  argument('options is not an object', () => D.createProvider(() => 1).withLifetime(singleton, 42), 'withLifetime', 'options', 'an object'),
  argument('unknown option', () => D.createProvider(() => 1).withLifetime(singleton, { other: true }), 'withLifetime', 'options', 'only the own properties: allowsScopedDependencies'),
  argument('allowsScopedDependencies on a scoped service', () => D.createProvider(() => 1).withLifetime('scoped:one-per-container', { allowsScopedDependencies: true }), 'withLifetime', 'allowsScopedDependencies', "absent unless lifetime is 'singleton:one-per-container-tree'"),
  argument('allowsScopedDependencies is not a boolean', () => D.createProvider(() => 1).withLifetime(singleton, { allowsScopedDependencies: 1 }), 'withLifetime', 'allowsScopedDependencies', 'a boolean'),
  argument('registrationMetadata is not an object', () => D.createProvider(() => 1).withRegistrationMetadata(42), 'withRegistrationMetadata', 'registrationMetadata', 'an object'),
  argument('options is not an object', () => D.createProvider(() => 1).withAcquisitionMetadata(42), 'withAcquisitionMetadata', 'options', 'an object'),
  argument('unknown callbackReceives', () => D.createProvider(() => 1).withAcquisitionMetadata({ describeAcquisition: () => ({}), callbackReceives: 'bad' }), 'withAcquisitionMetadata', 'callbackReceives', "one of: 'exposed-service', 'fulfilled-value'"),
  argument('describeAcquisition is not a function', () => D.createProvider(() => 1).withAcquisitionMetadata({ describeAcquisition: 42, callbackReceives: 'exposed-service' }), 'withAcquisitionMetadata', 'describeAcquisition', 'a function'),
  argument('unknown callbackReceives', () => D.createProvider(() => 1).withTransformedService({ transformService: (value: unknown) => value, callbackReceives: 'bad' }), 'withTransformedService', 'callbackReceives', "one of: 'exposed-service', 'fulfilled-value'"),
  argument('transformService is not a function', () => D.createProvider(() => 1).withTransformedService({ transformService: 42, callbackReceives: 'exposed-service' }), 'withTransformedService', 'transformService', 'a function'),
  argument('transformReturnKind with a fulfilled value', () => D.createProvider(() => 1).withTransformedService({ transformService: (value: unknown) => value, callbackReceives: 'fulfilled-value', transformReturnKind: 'uninspected' }), 'withTransformedService', 'transformReturnKind', "absent when callbackReceives is 'fulfilled-value'"),
  argument('disposer is not a function', () => D.createBuilder().withServices({ value: D.createProvider((_dependencies: unknown, factoryContext: any) => { factoryContext.pushDisposer(42); return 1; }, { factoryReceivesContext: true }) }).buildContainer().resolve('value'), 'pushDisposer', 'disposer', 'a function'),

  // Builder and module. 0.4.0: register, buildModule, renameExport.
  argument('services is not an object', () => D.createBuilder().withServices(42), 'withServices', 'services', 'an object'),
  argument('a symbol key', () => D.createBuilder().withServices({ [Symbol('s')]: () => 1 }), 'withServices', 'services', 'only string keys'),
  argument('exportedServiceKeys is not an array', () => builder().buildModule({ exportedServiceKeys: 'bad' }), 'buildModule', 'exportedServiceKeys', 'an array'),
  argument('moduleLabel is empty', () => builder().buildModule({ exportedServiceKeys: ['config'], moduleLabel: '' }), 'buildModule', 'moduleLabel', 'a non-empty string'),
  argument('currentExportKey is not a string', () => builder().buildModule({ exportedServiceKeys: ['config'] }).withRenamedExport({ currentExportKey: 1, newExportKey: 'x' }), 'withRenamedExport', 'currentExportKey', 'a string'),
  argument('newExportKey is not a string', () => builder().buildModule({ exportedServiceKeys: ['config'] }).withRenamedExport({ currentExportKey: 'config', newExportKey: 1 }), 'withRenamedExport', 'newExportKey', 'a string'),

  // Container. 0.4.0: createScope, fork, buildAndStart, close.
  argument('replacedServiceKeys is not an array', () => container().createChildContainer({ replacedServiceKeys: 'bad', replacementProviders: {} }), 'createChildContainer', 'replacedServiceKeys', 'an array'),
  argument('replacementProviders is not an object', () => container().createChildContainer({ replacedServiceKeys: ['config'], replacementProviders: 42 }), 'createChildContainer', 'replacementProviders', 'an object'),
  argument('unknown option', () => container().createChildContainer({ other: [] }), 'createChildContainer', 'options', 'only the own properties: replacedServiceKeys, replacementProviders, sharedParentServiceKeys'),
  argument('replacedServiceKeys is not an array', () => container().createIndependentContainer({ replacedServiceKeys: 'bad', replacementProviders: {} }), 'createIndependentContainer', 'replacedServiceKeys', 'an array'),
  argument('replacementProviders is not an object', () => container().createIndependentContainer({ replacedServiceKeys: ['config'], replacementProviders: null }), 'createIndependentContainer', 'replacementProviders', 'an object'),
  argument('serviceKeys is not an array', () => container().ensureServicesReady('bad'), 'ensureServicesReady', 'serviceKeys', 'an array'),
  argument('options is not an object', () => container().ensureServicesReady(['config'], 42), 'ensureServicesReady', 'options', 'an object'),
  argument('maxConcurrentServiceKeys is zero', () => container().ensureServicesReady(['config'], { maxConcurrentServiceKeys: 0 }), 'ensureServicesReady', 'maxConcurrentServiceKeys', 'a positive safe integer'),
  argument('totalTimeoutMs is negative', () => container().ensureServicesReady(['config'], { totalTimeoutMs: -1 }), 'ensureServicesReady', 'totalTimeoutMs', 'a finite positive number'),
  argument('abortSignal is not an AbortSignal', () => container().ensureServicesReady(['config'], { abortSignal: {} }), 'ensureServicesReady', 'abortSignal', 'an AbortSignal'),
  argument('options is not an object', () => container().close(42), 'close', 'options', 'an object'),
  argument('unknown option', () => container().close({ other: 1 }), 'close', 'options', 'only the own properties: abortSignal, waitTimeoutMs'),
  argument('waitTimeoutMs is zero', () => container().close({ waitTimeoutMs: 0 }), 'close', 'waitTimeoutMs', 'a finite positive number'),
  argument('abortSignal is not an AbortSignal', () => container().close({ abortSignal: {} }), 'close', 'abortSignal', 'an AbortSignal'),

  // Configuration. 0.4.0: withConfiguration({ runtime, observers }).
  argument('options is not an object', () => D.withConfiguration(null), 'withConfiguration', 'options', 'an object'),
  argument('runtime is not an object', () => D.withConfiguration({ runtime: 42 }), 'withConfiguration', 'runtime', 'an object'),
  argument('runtime has no classifier', () => D.withConfiguration({ runtime: {} }), 'withConfiguration', 'runtime.isNativePromise', 'a function'),
  argument('lifecycleObservers is not an array', () => D.withConfiguration({ lifecycleObservers: 42 }), 'withConfiguration', 'lifecycleObservers', 'an array'),
  argument('an observer is not an object', () => D.withConfiguration({ lifecycleObservers: [null] }), 'withConfiguration', 'lifecycleObservers[]', 'an object'),
  argument('onLifecycleEvent is not a function', () => D.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent: 1, onObserverFailure: () => {} }] }), 'withConfiguration', 'lifecycleObservers[].onLifecycleEvent', 'a function'),
  argument('onObserverFailure is not a function', () => D.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent: () => {}, onObserverFailure: 2 }] }), 'withConfiguration', 'lifecycleObservers[].onObserverFailure', 'a function'),
]);
```

- [ ] **Step 3: Run to verify the failures, and edit the existing assertions**

Run: `bun test tests/error-code-taxonomy.test.ts`

Expected: every row of Tasks 5 to 8 passes; the 53 added rows audit the phase-entry argument sites. Rows already migrated by earlier phases may pass immediately. Record the actual remaining failures; do not force a passing final-code site back to an old code to create a red test. A failing row has one of three forms, and each tells you something. `Received:` an old `DI_BAG_INVALID_*` code: the call reached its site, which is the state you want. `Received: undefined`: no library error was thrown, so either the call does not fit your API (fix the call) or the validation is missing (add it in Step 4). `expected a throw or a rejection`: the malformed input was ACCEPTED, which is a missing validation.

Then the existing assertions. For each file the facts listed, change the old code to `DI_BAG_INVALID_ARGUMENT`; a whole-message assertion also needs the fragment `#di-bag-invalid-argument`. One existing test needs more than a substitution: `buildModule rejects malformed label options` in `tests/runtime-diagnostics.test.ts` loops over several malformed inputs and asserts ONE details object for all of them with `toEqual`. Under the new contract each input has its own `argument` and `expected`. Turn the list into triples of input, `argument`, `expected`, and keep `toEqual` on the whole details object; do not loosen it to `toMatchObject`.

- [ ] **Step 4: Change the sites**

Work through `/tmp/invalid-argument-sites.tsv` from top to bottom. At each site: the code literal, and the details written as an object literal AT the throw site (the inventory's check reads the statement text, so details kept in a variable count as missing).

```ts
// before (0.4.0 shape)
if (typeof options !== 'object' || options === null) throw libraryError('DI_BAG_INVALID_CONFIGURATION', 'withConfiguration runtime requires isNativePromise', { operation: 'withConfiguration' });
const { isNativePromise } = options;
if (typeof isNativePromise !== 'function') throw libraryError('DI_BAG_INVALID_CONFIGURATION', 'withConfiguration runtime requires isNativePromise', { operation: 'withConfiguration' });
// after
if (typeof options !== 'object' || options === null) throw libraryError('DI_BAG_INVALID_ARGUMENT', 'withConfiguration runtime requires isNativePromise', { operation: 'withConfiguration', argument: 'runtime', expected: 'an object' });
const { isNativePromise } = options;
if (typeof isNativePromise !== 'function') throw libraryError('DI_BAG_INVALID_ARGUMENT', 'withConfiguration runtime requires isNativePromise', { operation: 'withConfiguration', argument: 'runtime.isNativePromise', expected: 'a function' });
```

Three places need more than that.

1. The shared options validator, `snapshotOptions` in `src/startup.ts` at 0.4.0. It receives a code from its callers and throws it from four conditions. After this task it throws `DI_BAG_INVALID_ARGUMENT` itself and its `code` parameter is REMOVED, from the signature and from every caller. Its four conditions get: `options` and `an object`; `options` and `only the own properties: <the supported names joined by ", ">`; the name of the timeout option it was given and `a finite positive number`; `abortSignal` and `an AbortSignal`. The timeout option is `waitTimeoutMs` for `close` and `totalTimeoutMs` for `ensureServicesReady`, so the validator must use the name it was asked to check, not a constant.
2. The return-kind helper, `acquisitionMode()` in `src/acquisition-mode.ts` at 0.4.0. Its details are `{ option: 'acquisitionMode' }` with no operation, because it does not know who called it. Give it an `operation` parameter, pass the public method's name from every caller, and build `expected` from the list of values the caller accepts, because the plugin source accepts two of the four.
3. Combined conditions. `typeof a !== 'function' || typeof b !== 'function'` on the observer callbacks, the selection check of `createIndependentContainer`, and any other `||` whose halves name different arguments: one `if` per argument.

Run the file again. Expected: `0 fail`.

- [ ] **Step 5: Prove that no site was missed**

```bash
node scripts/error-code-inventory.mjs src > /tmp/error-code-inventory-after.tsv; echo exit=$?
cut -f4 /tmp/error-code-inventory-after.tsv | tr '|' '\n' | sort -u
```

Expected: `exit=0` with `unclassified: 0; incomplete details: 0` in the summary, and a list of codes with none of the sixteen in it. A non-zero `incomplete details` names sites that took the new code without the three keys: `node scripts/error-code-inventory.mjs src --json | grep -B7 '"missingDetails": \[$'` shows them.

- [ ] **Step 6: `docs/agent/errors.md`**

Delete the sixteen sections. Before deleting each one, read its **Fix** text: where it says something a caller cannot get from `details` (for example why a plugin's return kind may not be inspected), move that sentence into the JSDoc of the method it is about. Add this section; in the alphabetical order it is the first `DI_BAG_INVALID_` section after `DI_BAG_INVALID_ACQUISITION_METADATA`:

````markdown
### DI_BAG_INVALID_ARGUMENT {#di-bag-invalid-argument}

**When:** a call receives an argument of the wrong shape: a factory that is not a
function, an options bag that is not an object or holds an unknown property, an
option of the wrong type, a value outside a fixed set. Every public method
raises it, some as a `TypeError`.

**Cause:** the call site is not type-checked, or a cast silenced the compiler,
which rejects every one of these. `details` says exactly what was wrong:
`operation` is the method, `argument` is the parameter or option (a dotted path
for a nested option, `[]` for an element of a list), and `expected` completes
the sentence "must be ...".

**Fix:** branch on `details.argument`, not on the message. Remove the cast and
let the compiler point at the argument.

```ts
import { DiBag } from 'di-bag';

try {
  DiBag.createProvider(42 as never);
} catch (error) {
  const { operation, argument, expected } = (error as { details: Record<string, unknown> }).details;
  console.error(`${String(operation)}: ${String(argument)} must be ${String(expected)}`);
}
```
````

- [ ] **Step 7: JSDoc in `src`**

The ten whole codes are a substitution. `DI_BAG_INVALID_CLOSE` is a prefix of nothing and none of the ten is a prefix of another code on the final list, but run the facts script's `longer codes` line for each before trusting that on your tree.

```bash
grep -rlE 'DI_BAG_INVALID_(ACQUISITION_MODE|CLEANUP|CLOSE|CONFIGURATION|CONSTRUCTOR|FACTORY|FUNCTION|LIFETIME|PLUGIN_OPTIONS|TRANSFORM)([^A-Z_]|$)' src | xargs -r sed -i -E 's/DI_BAG_INVALID_(ACQUISITION_MODE|CLEANUP|CLOSE|CONFIGURATION|CONSTRUCTOR|FACTORY|FUNCTION|LIFETIME|PLUGIN_OPTIONS|TRANSFORM)([^A-Z_]|$)/DI_BAG_INVALID_ARGUMENT\2/g'
grep -rnE 'DI_BAG_INVALID_(EXPORT|METADATA|OVERRIDE|REGISTRATION|SCOPE|STARTUP)([^A-Z_]|$)' src
```

The second command lists the mentions of the six split codes, all in JSDoc by now (at 0.4.0: `DI_BAG_INVALID_REGISTRATION` 11, `_METADATA` 2, `_SCOPE` 2, the others 1 each). Each is rewritten by hand: replace the old code with the codes that method can raise now, which the inventory tells you (`grep "operation: '<method>'" src` lists them). A `@throws` line that ends up naming `DI_BAG_INVALID_ARGUMENT` twice is merged into one mention.

- [ ] **Step 8: The codemod map**

Add to `codes` in `tools/codemod/rename-map.json`. The six split codes are `manual`, so the codemod reports them with this text instead of guessing:

```json
{"from": "DI_BAG_INVALID_ACQUISITION_MODE", "to": "DI_BAG_INVALID_ARGUMENT"},
{"from": "DI_BAG_INVALID_CLEANUP", "to": "DI_BAG_INVALID_ARGUMENT"},
{"from": "DI_BAG_INVALID_CLOSE", "to": "DI_BAG_INVALID_ARGUMENT"},
{"from": "DI_BAG_INVALID_CONFIGURATION", "to": "DI_BAG_INVALID_ARGUMENT"},
{"from": "DI_BAG_INVALID_CONSTRUCTOR", "to": "DI_BAG_INVALID_ARGUMENT"},
{"from": "DI_BAG_INVALID_FACTORY", "to": "DI_BAG_INVALID_ARGUMENT"},
{"from": "DI_BAG_INVALID_FUNCTION", "to": "DI_BAG_INVALID_ARGUMENT"},
{"from": "DI_BAG_INVALID_LIFETIME", "to": "DI_BAG_INVALID_ARGUMENT"},
{"from": "DI_BAG_INVALID_PLUGIN_OPTIONS", "to": "DI_BAG_INVALID_ARGUMENT"},
{"from": "DI_BAG_INVALID_TRANSFORM", "to": "DI_BAG_INVALID_ARGUMENT"},
{"from": "DI_BAG_INVALID_EXPORT", "manual": "DI_BAG_INVALID_EXPORT was split: DI_BAG_UNKNOWN_SERVICE_KEY for a key the module does not export, DI_BAG_DUPLICATE_SERVICE_KEY for a rename onto an existing export, DI_BAG_INVALID_ARGUMENT for malformed input"},
{"from": "DI_BAG_INVALID_METADATA", "manual": "DI_BAG_INVALID_METADATA was split: DI_BAG_INVALID_ACQUISITION_METADATA when a describe callback returns a bad record, DI_BAG_INVALID_ARGUMENT for malformed input"},
{"from": "DI_BAG_INVALID_OVERRIDE", "manual": "DI_BAG_INVALID_OVERRIDE was split: DI_BAG_UNKNOWN_SERVICE_KEY, DI_BAG_MISSING_REPLACEMENT_PROVIDER, or DI_BAG_INVALID_ARGUMENT for malformed input"},
{"from": "DI_BAG_INVALID_REGISTRATION", "manual": "DI_BAG_INVALID_REGISTRATION was split: DI_BAG_INVALID_PROVIDER for a value that is neither a function nor a provider, DI_BAG_INVALID_ARGUMENT for malformed input"},
{"from": "DI_BAG_INVALID_SCOPE", "manual": "DI_BAG_INVALID_SCOPE was split: DI_BAG_UNKNOWN_SERVICE_KEY, DI_BAG_MISSING_REPLACEMENT_PROVIDER, DI_BAG_CONFLICTING_SERVICE_SELECTION, or DI_BAG_INVALID_ARGUMENT for malformed input"},
{"from": "DI_BAG_INVALID_STARTUP", "manual": "DI_BAG_INVALID_STARTUP was split: DI_BAG_UNKNOWN_SERVICE_KEY for an unknown key, DI_BAG_INVALID_ARGUMENT for malformed input"}
```

The phase 1 fixture `codes` already proves both forms, so no new fixture. Run `npm run codemod:check`. Expected: every test passes.

- [ ] **Step 9: The gate for all sixteen codes, then the commit**

```bash
npm run build && npm run docs:generate && npm run docs:check   # expect exit 0
npm run test:fast                                              # expect 0 fail
for code in ACQUISITION_MODE CLEANUP CLOSE CONFIGURATION CONSTRUCTOR EXPORT FACTORY FUNCTION LIFETIME METADATA OVERRIDE PLUGIN_OPTIONS REGISTRATION SCOPE STARTUP TRANSFORM; do
  node scripts/error-code-facts.mjs DI_BAG_INVALID_$code DI_BAG_INVALID_ARGUMENT | grep '^  grep' | bash
done   # expect no output at all
git add tests src docs/agent docs/reference tools/codemod/rename-map.json
git commit -m "refactor(errors)!: DI_BAG_INVALID_ARGUMENT with operation, argument and expected"
```

If `docs:check` reports `missing anchor` for `errors.md#di-bag-invalid-...`, a backticked mention of an old code survived in JSDoc and the API card turned it into a link: the gate's first `grep` names the line.

---

### Task 10: Snapshot fields

| 0.4.0 | 0.5.0 | Owner in the codemod's map |
| --- | --- | --- |
| `Presence.present` | `isPresent` | `Presence` |
| `RegistrationSnapshot.label`, `aliasTarget.label` | `bindingLabel` | `RegistrationSnapshot` (the inline `aliasTarget` type belongs to the interface around it) |
| `BindingSnapshot.keys` | `serviceKeys` | `BindingSnapshot` |
| `BindingSnapshot.owned` | `isOwnedByContainer` | `BindingSnapshot` |
| `tokenDependencies[].key`, `.kind` | `tokenSymbol`, `dependencyKind` | `BindingSnapshot` |
| `contributions[].token` | `collectionTokenSymbol` | `GraphSnapshot` |
| `observedEdges[].from`, `.to` | `consumerBindingId`, `dependencyBindingId` | `GraphSnapshot` |

`BindingSnapshot.acquisitionMode` became `factoryReturnKind` in phase 8, the dependency kind `'all'` went in phase 4, and `GraphSnapshot.scopeId` is Task 11.

These are fields of values the library RETURNS. The master plan's expand step, the old and the new name side by side, does not fit them: a snapshot that carries both names breaks every whole-object assertion twice, once when the new name appears and once when the old one goes. So this task, like Task 4, is a pair of commits made back to back: the codemod's rewrite of the readers while the old names still resolve, which leaves the tree red on purpose, then the rename of the declarations and producers, which turns it green.

The old names are ordinary words, `label`, `keys`, `key`, `kind`, `from`, `to`, `token`. No text search can tell a snapshot's `label` from any other. Three things find the uses: the codemod (typed reads), the compiler (everything typed in `src`, `tests` and `examples`), and failing tests (object literals inside `toEqual`, which no type reaches). Trust those three, not `grep`.

**Files:**
- Create: `tests/observability-field-names.test.ts`
- Modify: `src/inspection.ts` (the declarations), the producers the compiler lists (at 0.4.0 in `src/acquisition.ts`, `src/runtime.ts`, `src/di-bag.ts`), `tools/codemod/rename-map.json`, `docs/agent/*.md`, `AGENTS.md`, `examples/provider-metadata.ts` (it builds `Presence` values by hand)
- Test: every test file the codemod rewrites or that fails afterwards

**Interfaces:**
- Produces: the field names in the table, on `Presence`, `RegistrationSnapshot`, `BindingSnapshot` and `GraphSnapshot`. `scenario()` in the new test file, which Task 11 reuses.

How far the new test was verified when the plan was written: the same scenario and the same assertions, written with the 0.4.0 names and the 0.4.0 API, were RUN and passed, so the shapes it expects are the real ones (one required token dependency, one observed edge from `reader` to the clock, an alias target, one contribution, one acquisition-metadata frame). The file below is that test with every name translated to 0.5.0, plus the one line that asserts the retired names are gone. It passed a syntax check; it was not run, because the 0.5.0 API did not exist. If a call does not fit the API on your tree, fix the call and keep the assertions.

- [ ] **Step 1: Write the failing test**

`tests/observability-field-names.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { DiBag, DiBagDisposalError, type LifecycleEvent } from '../src';

// One scenario for both tests: a token service with a failing disposer, a positional factory that depends on it and
// describes its acquisition, an alias, and one contribution to a collection.
function scenario() {
  const events: LifecycleEvent[] = [];
  const clockKey = Symbol('clock');
  const clock = DiBag.createToken(clockKey).forService<{ now(): number }>();
  const pluginsKey = Symbol('plugins');
  const plugins = DiBag.createToken(pluginsKey).forCollectionOf<string>();
  const app = DiBag.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent: event => { events.push(event); }, onObserverFailure: () => {} }] }).createBuilder()
    .withTokenService({ token: clock, provider: DiBag.createProvider(() => ({ now: () => 0 })).withDisposal(() => { throw new Error('boom'); }) })
    .withServices({
      reader: DiBag.createProviderFromFunction({ dependencies: [clock], factoryFunction: (dependency: { now(): number }) => dependency.now() })
        .withAcquisitionMetadata({ describeAcquisition: () => ({ tag: 1 }), callbackReceives: 'exposed-service' }),
    })
    .withServiceAlias({ aliasKey: 'alias', targetServiceKey: 'reader' })
    .withCollectionContribution({ collectionToken: plugins, provider: () => 'a' })
    .buildContainer();
  app.resolve('reader');
  return { app, events, clockKey, pluginsKey };
}

test('snapshots use the 0.5.0 field names and none of the retired ones', async () => {
  const { app, clockKey, pluginsKey } = scenario();
  const graph = app.graphSnapshot();
  const reader = graph.bindings.find(binding => binding.bindingLabel === 'reader')!;
  const clockBinding = graph.bindings.find(binding => binding.serviceKeys.includes(clockKey))!;
  expect(reader).toMatchObject({ bindingLabel: 'reader', serviceKeys: ['reader'], isOwnedByContainer: false, tokenDependencies: [{ tokenSymbol: clockKey, dependencyKind: 'required' }] });
  for (const retired of ['label', 'keys', 'owned']) expect(reader).not.toHaveProperty(retired);
  expect(clockBinding.isOwnedByContainer).toBe(true);
  expect(Object.keys(reader.tokenDependencies[0]!).sort()).toEqual(['dependencyKind', 'tokenSymbol']);
  expect(graph.contributions.map(item => Object.keys(item).sort())).toEqual([['bindingIds', 'collectionTokenSymbol']]);
  expect(graph.contributions[0]!.collectionTokenSymbol).toBe(pluginsKey);
  expect(graph.observedEdges).toEqual([{ consumerBindingId: reader.bindingId, dependencyBindingId: clockBinding.bindingId }]);
  expect(app.serviceSnapshot('alias').aliasTarget).toEqual({ bindingId: reader.bindingId, bindingLabel: 'reader' });
  expect(app.serviceSnapshot('reader').acquisitions[0]!.acquisitionMetadata).toEqual([{ isPresent: true, value: { tag: 1 } }]);
  await app.close().catch(() => {});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test tests/observability-field-names.test.ts`

Expected: `1 fail`. The first assertion to fail is on `graph.bindings.find(...)`: no binding has a `bindingLabel` yet, so `reader` is undefined and the test throws a `TypeError` that names `serviceKeys` or `undefined`. If instead it fails inside `scenario()`, a call there does not fit your API: fix it first.

- [ ] **Step 3: Add the map entries, run the codemod, commit the rewrite**

Add to `properties` in `tools/codemod/rename-map.json`:

```json
{ "owner": "Presence", "from": "present", "to": "isPresent" },
{ "owner": "RegistrationSnapshot", "from": "label", "to": "bindingLabel" },
{ "owner": "BindingSnapshot", "from": "keys", "to": "serviceKeys" },
{ "owner": "BindingSnapshot", "from": "owned", "to": "isOwnedByContainer" },
{ "owner": "BindingSnapshot", "from": "key", "to": "tokenSymbol" },
{ "owner": "BindingSnapshot", "from": "kind", "to": "dependencyKind" },
{ "owner": "GraphSnapshot", "from": "token", "to": "collectionTokenSymbol" },
{ "owner": "GraphSnapshot", "from": "from", "to": "consumerBindingId" },
{ "owner": "GraphSnapshot", "from": "to", "to": "dependencyBindingId" }
```

The owner of a property declared in an inline type literal is the named declaration around it (phase 1 plan, "Owner"), which is why `key` and `kind` belong to `BindingSnapshot`. Add a fixture pair for this, because no existing fixture covers an inline element type: copy the phase 1 fixture `properties` to `tools/codemod/test/fixtures/snapshot-fields/`, and make its input read `graph.observedEdges[0].from`, `binding.tokenDependencies.map(item => item.key)`, `snapshot.aliasTarget?.label`, and build one `Presence` value as an object literal in a typed variable; the expected file holds the new names. Register it the way its neighbours are registered, run `npm run codemod:check`, and expect every test to pass. If the inline cases are NOT rewritten, the transform needs the fix first: that is a defect of the codemod, which ships to users, so fix it there with this fixture as its test, do not work around it by hand.

```bash
npm run build
node tools/codemod/cli.mjs --project tsconfig.json --library-root src --library-root dist --extra-files 'tests/types/negative/*.ts' --write --report /tmp/codemod-snapshot-fields.json
git add tools/codemod tests examples
git commit -m "refactor(inspection)!: codemod rewrite for the snapshot field names" -m "Produced by: node tools/codemod/cli.mjs --project tsconfig.json --library-root src --library-root dist --extra-files 'tests/types/negative/*.ts' --write. Does not compile until the next commit renames the declarations in src."
```

Do not add the new test file to this commit's staging by accident before it exists in its final form; it is staged in Step 6.

- [ ] **Step 4: Rename the declarations, then let the compiler list the producers**

In `src/inspection.ts`, rename the nine properties in their declarations, exactly as in the table; `present` occurs in both members of the `Presence` union. Then:

```bash
npm run typecheck 2>&1 | grep -E "^(src|tests|examples)/" | cut -d'(' -f1 | sort | uniq -c
```

Every error is a producer or a typed reader that still uses an old name. Fix `src` first, by reading each error: an object literal that builds a snapshot gets the new property name, its VALUE expression does not change (`bindingLabel: this.graph.label(target)`). Internal names such as `graph.label()` or a local `keys` variable are not public and stay. Repeat until `typecheck` is clean.

- [ ] **Step 5: Run the suite and fix what only a run can find**

```bash
npm run test:fast 2>&1 | grep -E "^\(fail\)|^ [0-9]+ (pass|fail)"
```

What fails now is, almost entirely, whole-object assertions: `toEqual({ label: 'reader', ... })`, `toEqual([{ from: a, to: b }])`, `{ present: true, value }`. Counted at 0.4.0 for orientation: `present: true` or `present: false` occurs 31 times in tests, `owned: true|false` 4 times, `keys: [` 6 times. Rename the property inside the expected literal; never change the expected VALUE. Also by hand, because no tool reads them: generated source held in strings (`tests/package.test.ts`, `tests/compiler.ts`, `scripts/`), `AGENTS.md` and `docs/agent/*.md` (at 0.4.0 they read `.keys` and `label:` a few times each; `wc -l AGENTS.md` must stay at most 150), and the JSDoc examples in `src`. The guides under `docs/guides` are phase 12.

Expected at the end: `0 fail`, including the new test file.

- [ ] **Step 6: Regenerate, check, commit**

```bash
npm run build && npm run docs:generate && npm run docs:check   # expect exit 0; the snippets in docs/agent are type-checked, so a stale field name fails here
npm run graph:check && npm run agent-eval:test                 # expect pass: neither reads a runtime snapshot, this only proves nothing else broke
git add src tests examples docs/agent docs/reference AGENTS.md scripts tools/codemod
git commit -m "refactor(inspection)!: snapshot fields say what they hold"
```

`tools/graph` has an output key `owned` of its own, derived from a `withDisposal` call in source text. It is NOT a runtime snapshot and is not renamed in this phase; the release plan decides the format of `di-bag-graph` 0.2.0.

---

### Task 11: Event kinds, container ids and `ContainerEventFields`

| 0.4.0 | 0.5.0 |
| --- | --- |
| kinds `scope-opened`, `scope-closing`, `scope-closed`, `scope-close-failed` | `container-opened`, `container-closing`, `container-closed`, `container-close-failed` |
| kinds `cleanup-started`, `cleanup-failed`, `cleanup-completed` | `disposal-started`, `disposal-failed`, `disposal-completed` |
| `scopeId`, `parentScopeId` on events, `GraphSnapshot.scopeId` | `containerId`, `parentContainerId`, `GraphSnapshot.containerId` |
| `AcquisitionEventFields.label` | `bindingLabel` |
| type `ScopeEventFields` | `ContainerEventFields` |

The kinds `acquisition-started`, `acquisition-ready` and `acquisition-failed`, and the fields `acquisitionId`, `bindingId`, `disposalSequence`, `outcome` and `error`, do not change.

**Files:**
- Modify: `src/observers.ts` (the types), `src/index.ts` (the export), `src/inspection.ts` (`GraphSnapshot.scopeId`), the emitters (at 0.4.0: `src/acquisition.ts` and `src/runtime.ts`), one comment in `src/provider-execution.ts`, `examples/observers.ts`, `tools/codemod/rename-map.json`
- Test: `tests/observability-field-names.test.ts`, `tests/observers*.ts`, and what the codemod rewrites

- [ ] **Step 1: Append the failing test**

Append to `tests/observability-field-names.test.ts`:

```ts
test('failures and events use the 0.5.0 field names and kinds', async () => {
  const { app, events } = scenario();
  const child = app.createChildContainer();
  await child.close();
  const error = await app.close().catch((reason: unknown) => reason);
  expect(error).toBeInstanceOf(DiBagDisposalError);
  expect((error as DiBagDisposalError).failures.map(failure => failure.bindingLabel)).toEqual(['Symbol(clock)']);
  expect(Object.keys((error as DiBagDisposalError).failures[0]!).sort()).toEqual(['acquisitionId', 'bindingId', 'bindingLabel', 'error']);
  expect(Object.keys(app.graphSnapshot()).sort()).toEqual(['bindings', 'containerId', 'contributions', 'observedEdges']);
  expect([...new Set(events.map(event => event.kind))].sort()).toEqual(['acquisition-ready', 'acquisition-started', 'container-close-failed', 'container-closed', 'container-closing', 'container-opened', 'disposal-completed', 'disposal-failed', 'disposal-started']);
  const opened = events.filter(event => event.kind === 'container-opened');
  expect(opened.map(event => Object.keys(event).sort())).toEqual([['containerId', 'kind'], ['containerId', 'kind', 'parentContainerId']]);
  const started = events.find(event => event.kind === 'acquisition-started')!;
  expect(Object.keys(started).sort()).toEqual(['acquisitionId', 'acquisitionMetadata', 'bindingId', 'bindingLabel', 'containerId', 'kind', 'lifetime', 'registrationMetadata']);
});
```

The 0.4.0 edition of this test passed at the 0.4.0 source when the plan was written: a root container and one child emit exactly these nine kinds, the root's opening event has no parent id and the child's has one, and an acquisition event has exactly the eight keys listed. Its first three assertions, on the failure record, already pass after Task 4.

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test tests/observability-field-names.test.ts`. Expected: the new test fails on `Object.keys(app.graphSnapshot())`, which still holds `scopeId`; the test of Task 10 passes.

- [ ] **Step 3: Map entries, codemod, commit the rewrite**

```json
"types":      [{ "from": "ScopeEventFields", "to": "ContainerEventFields" }]
"properties": [{ "owner": "ScopeEventFields", "from": "scopeId", "to": "containerId" }, { "owner": "ScopeEventFields", "from": "parentScopeId", "to": "parentContainerId" },
               { "owner": "AcquisitionEventFields", "from": "scopeId", "to": "containerId" }, { "owner": "AcquisitionEventFields", "from": "label", "to": "bindingLabel" },
               { "owner": "GraphSnapshot", "from": "scopeId", "to": "containerId" }]
"values":     [{ "owner": "LifecycleEvent", "property": "kind", "from": "scope-opened", "to": "container-opened" },
               { "owner": "LifecycleEvent", "property": "kind", "from": "scope-closing", "to": "container-closing" },
               { "owner": "LifecycleEvent", "property": "kind", "from": "scope-closed", "to": "container-closed" },
               { "owner": "LifecycleEvent", "property": "kind", "from": "scope-close-failed", "to": "container-close-failed" },
               { "owner": "LifecycleEvent", "property": "kind", "from": "cleanup-started", "to": "disposal-started" },
               { "owner": "LifecycleEvent", "property": "kind", "from": "cleanup-failed", "to": "disposal-failed" },
               { "owner": "LifecycleEvent", "property": "kind", "from": "cleanup-completed", "to": "disposal-completed" }]
```

The phase 1 fixture `values` already holds the first and third of these `kind` entries in its own map, so the transform is proven; no new fixture. Run `npm run codemod:check`, then the same build, codemod and commit commands as Task 10 Step 3, with the subject `refactor(observers)!: codemod rewrite for event kinds and container ids`.

- [ ] **Step 4: Rename in `src`**

Unlike the snapshot fields, every old name here is distinctive, so a substitution over `src` is safe. The kinds are replaced only inside quotes, so prose is not touched.

```bash
grep -rlE "\b(scopeId|parentScopeId|ScopeEventFields)\b|'(scope|cleanup)-[a-z-]+'" src | xargs sed -i -E \
  -e 's/\bparentScopeId\b/parentContainerId/g' -e 's/\bscopeId\b/containerId/g' -e 's/\bScopeEventFields\b/ContainerEventFields/g' \
  -e "s/'scope-(opened|closing|closed|close-failed)'/'container-\1'/g" -e "s/'cleanup-(started|failed|completed)'/'disposal-\1'/g"
npm run typecheck
```

On a scratch copy of the 0.4.0 source this command changed five files (`git diff --numstat`: `src/observers.ts` 11 lines, `src/runtime.ts` 9, `src/acquisition.ts` 5, `src/index.ts` 1, `src/inspection.ts` 1) and left one mention behind, a comment in `src/provider-execution.ts` that says `cleanup-failed` without quotes; the audit of Step 5 finds it. The type-check after it was not run when the plan was written.

Then, by hand in `src/observers.ts`, `readonly label: string` inside `AcquisitionEventFields` becomes `bindingLabel`, and `typecheck` lists the emitters (at 0.4.0 one, `eventFields` in `src/acquisition.ts`). Internal names that merely contain the word, such as a private `scopeId` field of the runtime, are renamed by the same substitution; that is intended, the glossary retired the word.

- [ ] **Step 5: The rest, by audit**

```bash
grep -rnE "\b(scopeId|parentScopeId|ScopeEventFields)\b|(scope-(opened|closing|closed|close-failed)|cleanup-(started|failed|completed))" src tests examples scripts AGENTS.md README.md docs/agent tools/docs/lib
```

At the 0.4.0 source, before any edit, this prints 114 lines: 79 in `tests`, 29 in `src`, 4 in `docs/agent`, 1 in `examples`, 1 in `scripts`. Expected leftovers after Steps 3 and 4, fixed with the same substitutions: event literals inside `toEqual` in the observer tests, kinds inside test titles, generated source held in strings (at 0.4.0: `tests/package.test.ts`), and `examples/observers.ts` if the codemod reported it instead of rewriting it. Run the audit again; expected: no output. Then `npm run test:fast`; expected: `0 fail`.

- [ ] **Step 6: Negative fixture, regenerate, commit**

Append to `tests/types/negative/api-renaming.ts`:

```ts
// diagnostic: has no exported member
type RemovedScopeEventFields = import('../../../src').ScopeEventFields;
```

```bash
npm run build && npm run docs:generate && npm run docs:check
git add src tests examples docs/agent docs/reference AGENTS.md scripts tools/codemod
git commit -m "refactor(observers)!: container and disposal event kinds, containerId, ContainerEventFields"
```

---

### Task 12: Retired words in messages and JSDoc, and an empty naming ratchet

The renames are done; what is left is prose. A runtime message, a compile-time message or a JSDoc line that still says a retired word sends the reader looking for something that no longer exists.

**Files:**
- Modify: `src/*.ts` (string literals and comments only), the tests that quote a changed message, `docs/agent/errors.md` where it quotes one, `tests/api-naming-known-violations.json`

- [ ] **Step 1: List what is left**

```bash
grep -rnE "\b(bag|bags|Bag)\b|\b(scope|scopes|fork|forks|forked)\b|\bcleanup\b|\bstartup\b|\bregistrations?\b|\boverrides?\b|acquisition ?[Mm]ode|\broot lifetime\b" src --include='*.ts' | grep -vE "DiBag|di-bag|DI_BAG" > /tmp/retired-words.txt; wc -l < /tmp/retired-words.txt
```

The list is long, 357 lines at the 0.4.0 source, and most of it is fine: internal identifiers (`BagRuntime`, a local `scope` variable) are not public and stay, and "scoped" as a lifetime is a current word. Go through the file once and change ONLY these two kinds of line:

1. A string literal that reaches a user: a runtime message, or a compile-time message inside `Unsatisfied<'...'>`. Replace the retired word by its glossary word from `CONTEXT.md`: bag by container, child scope by child container, fork by independent container, cleanup by disposal, startup by service readiness, registration by service or provider according to what is meant, override by replacement, acquisition mode by factory return kind, root lifetime by singleton lifetime.
2. A JSDoc comment on an exported declaration, which the API card and the reference publish.

Two message changes were deliberately left to this task by earlier phases, because each breaks many assertions at once (counted at 0.4.0): `bag is closing` and `bag is closed` are quoted by 15 assertions, and the singleton-captures-scoped message by 16. If the inventory still shows them with the old words, change them here. For every message you change: `grep -rn "<old text>" tests docs/agent AGENTS.md` first, change the message, then change every quote of it to the new text, in the same commit. A compile-time message keeps its `SeeErrors<'family'>` anchor.

- [ ] **Step 2: Verify**

```bash
npm run typecheck && npm run test:fast      # expect 0 fail: every quoted message was updated with its source
npm run test:compiler                        # expect 0 fail: compile-time messages are asserted there
npm run build && npm run docs:generate && npm run docs:check
```

- [ ] **Step 3: Empty the naming ratchet**

```bash
npm run build
UPDATE_API_NAMING_VIOLATIONS=1 bun test tests/api-naming.test.ts
node -e "const list = require('./tests/api-naming-known-violations.json').violations; console.log(list.length); for (const item of list) console.log(item)"
```

Expected: `0`. The update run only ever REMOVES entries that no longer occur. Every entry still printed is a public name that breaks a rule of `docs/guides/api-naming.md` and that no phase renamed. For each one: if the spec's rename map lists it, the phase that owned it missed it, so rename it now by that phase's procedure (expand, codemod entry, contract). If the spec does not list it, do not invent a name: record it in `docs/guides/api-naming.md` under "Measured exceptions" with the rule it breaks and why it stays, remove it from the list by hand, make the test's scanner skip exactly that subject with a comment that points to the exception, and name it in the phase report. The list must be empty when this task ends, because the master plan's release gate assumes it.

- [ ] **Step 4: Commit**

```bash
git add src tests docs/agent docs/reference docs/guides/api-naming.md AGENTS.md
git commit -m "docs(messages)!: glossary words in messages and JSDoc, naming ratchet empty"
```

---

### Task 13: The phase gate and the report

- [ ] **Step 1: Evidence**

This phase changed no signature in `src/di-bag.ts` or a `src/*-types.ts` file except property names in object types, which do not change the amount of type-level work. Measure anyway, because Task 12 edited message strings inside `Unsatisfied<...>` types and a longer literal is a different type: run the twelve cases with `node scripts/evidence-cases.mjs` as the master plan describes, and append the table to `docs/superpowers/plans/evidence/phase-11.md`. The cumulative change per case must stay within +10% of the baseline.

- [ ] **Step 2: The full gate**

Run every command of the master plan's gate list, in its order, with the pinned Bun first on `PATH` and `npm_config_update_notifier=false`. All must pass. Then the three checks that belong to this phase:

```bash
node scripts/error-code-inventory.mjs src > /dev/null; echo exit=$?     # expect exit=0, "unclassified: 0; incomplete details: 0"
node scripts/error-code-inventory.mjs src 2>/dev/null | cut -f4 | tr '|' '\n' | sort -u | wc -l   # the number of runtime codes; the spec expects about 31
node -e "console.log(require('./tests/api-naming-known-violations.json').violations.length)"        # expect 0
```

- [ ] **Step 3: The report**

Reply to the controller in the master plan's format, and add: the final list of runtime codes; every row of `tests/error-code-taxonomy.test.ts` that you deleted because its site was gone, or whose call you changed, and why; every naming exception you recorded; and the two red commits (Task 10 Step 3 and Task 11 Step 3) by hash, so the controller knows that `git bisect` must skip them.

---

## Assumptions made in this plan

The spec wins over all of them; each is here so that a reviewer can overturn it in one place.

1. **Details vocabulary.** The spec fixes `details` only for `DI_BAG_INVALID_ARGUMENT`. For the other codes this plan uses `serviceKey`, `metadataKey`, `conflict` and the existing `operation`, and turns today's `key`, `target` and `option` into them.
2. **Messages do not change with their code.** Tasks 3 to 9 change codes and details only. About 385 assertions quote message text; rewording messages is Task 12, word by word, not a side effect of a code change.
3. **No dual emit for returned fields.** Tasks 4, 10 and 11 each contain one commit that does not compile, followed directly by the one that does.
4. **`DI_BAG_INVALID_PROVIDER` does not gain a service key**, because the function that raises it has seven callers and does not know the key.
5. **The `expected` vocabulary of Task 9** is closed. A new phrase is a decision for the controller, not for the executor.
6. **`tools/graph` output keys are out of scope.** The tool reads source text, not runtime snapshots; its `owned` key is decided with the `di-bag-graph` 0.2.0 release.
7. **The spec's own roadmap calls this work "phase 9"; the master plan numbers it phase 11.** The master plan's numbering is the one used here and in branch names.

## Self-review

**Spec coverage.** "Snapshots and events" table: `isPresent`, `bindingLabel`, `serviceKeys`, `isOwnedByContainer`, `tokenSymbol`, `dependencyKind`, `collectionTokenSymbol`, `consumerBindingId`, `dependencyBindingId` (Task 10); the seven event kinds, `containerId`, `parentContainerId` (Task 11); `factoryReturnKind` and the `CloseProgress` fields belong to phases 8 and 3. "Errors" table: disposal class, type, field and codes (Task 4); `DI_BAG_DEPENDENCY_CYCLE` (Task 3); `DI_BAG_DUPLICATE_SERVICE_KEY`, `DI_BAG_DUPLICATE_METADATA_KEY` (Task 5); `DI_BAG_UNKNOWN_SERVICE_KEY` (Task 6); `DI_BAG_MISSING_REPLACEMENT_PROVIDER`, `DI_BAG_CONFLICTING_SERVICE_SELECTION` (Task 7); `DI_BAG_INVALID_PROVIDER`, `DI_BAG_INVALID_ACQUISITION_METADATA` (Task 8); `DI_BAG_INVALID_ARGUMENT` with `operation`, `argument`, `expected` (Task 9); service readiness codes and `DI_BAG_WRONG_TOKEN_KIND` belong to phases 3 and 4, `DI_BAG_REMOVED_API` to phase 13. "Exported types": `ContainerEventFields` (Task 11), `DisposalFailure` (Task 4). "Every message that names a retired call is rewritten" and the empty ratchet (Task 12).

**What was run when this plan was written, and what was not.** Run: both scripts and their eleven tests, red and green, with two mutation checks; the fixtures' type-check; every `sed`, `grep` and `awk` command that Tasks 3 to 9 quote, on a scratch copy of the 0.4.0 source; 77 probe calls that reach the throw sites of Tasks 5 to 9 at the 0.4.0 API; the 0.4.0 edition of the two field-name tests. Not run: anything that needs the 0.5.0 API, which means the translated rows of `tests/error-code-taxonomy.test.ts`, `tests/observability-field-names.test.ts`, every example in a new errors-page section, the codemod, and the type-check after each substitution. Each such place says so where it stands.

**Names used across tasks.** `check`, `builder`, `container`, `scoped` (Task 5, used by 6 to 9); `scenario` (Task 10, used by 11); `scripts/error-code-inventory.mjs` and its `incomplete details` count (Task 1, used by 9 and 13); `scripts/error-code-facts.mjs` and its two gate lines (Task 2, used by 3 to 9).
