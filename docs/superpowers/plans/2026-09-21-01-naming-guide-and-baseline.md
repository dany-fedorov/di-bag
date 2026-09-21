# Naming Guide, Naming Ratchet and Evidence Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Swift API style program its three fixed points before any name changes: the written naming standard, a test that lets naming violations only shrink, and the 0.4.0 compile-cost baseline that every later phase is measured against.

**Architecture:** A scanner walks the public surface with the TypeScript compiler API, starting at the exports of `src/index.ts` and following type references into `src/`. It reports five mechanical rule violations with owner-free ids, and a ratchet test compares them with a committed list that can only shrink. A small Node script runs the twelve compile-budget cases and renders or compares a Markdown table. The naming guide documents the rules, the vocabulary and how both tools are used. Nothing under `src/` changes in this phase.

**Tech Stack:** TypeScript 6 compiler API through `tests/compiler.ts`, Bun 1.4.0 test runner (fast lane), Node 24.20.0 for the script, Markdown guides published by `tools/docs`.

**Spec:** `docs/superpowers/specs/2026-09-20-swift-api-style.md` (sections "The standard", "Vocabulary", "Shapes decided by measurement") and the master plan `docs/superpowers/plans/2026-09-21-00-swift-api-style-master.md` (phase 0 row, "Evidence", "Protocol for every phase"). Read both before starting. The spec's names win over anything written here.

## Global Constraints

- This is phase 0 of the master plan. Work on branch `phase-00-naming-guide-and-baseline`, created from `next`. Never push, publish, merge, or edit the spec or the master plan.
- Do not change any file under `src/`. The baseline must describe the 0.4.0 source.
- Names, string values and vocabulary in `docs/guides/api-naming.md` are copied from the spec. Do not invent, shorten or improve a name.
- Environment for every command, from the repository root:

  ```bash
  export PATH="<the directory that holds Bun 1.4.0>/bin:$PATH"
  export npm_config_update_notifier=false
  bun --version   # must print 1.4.0
  node --version  # must print v24.20.0
  ```

  If that Bun is missing, install it with `curl -fsSL https://bun.sh/install | BUN_INSTALL=<dir> bash -s "bun-v1.4.0"` and put `<dir>/bin` first on `PATH`.
- The phase ends green on all of: `npm run check`, `npm run docs:check`, `npm run graph:check`, `npm run typecheck:native`, `npm run build:native`, `npm run check:native`, and every `examples/*.ts` run with Bun.
- Compiler-lane tests have a 5,000 ms timeout per test. A timeout under host load is a flake only if `bun test <that file>` passes when run alone; say so in the report. Never delete or skip a test to get green.
- Commit after each task with Conventional Commits and these two trailer lines:

  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
  ```

## State on entry

Confirm each line before Task 1. If one differs, stop and find out why; do not guess.

```bash
git switch next && git status --short              # expect: no output
git diff --stat v0.4.0 -- src | tail -1            # expect: no output (src is the 0.4.0 source)
ls docs/guides/api-naming.md tests/api-naming.test.ts tests/api-naming-surface.ts scripts/evidence-cases.mjs 2>&1 | grep -c "No such file"   # expect: 4
ls docs/superpowers/plans/evidence 2>/dev/null     # expect: empty or missing
grep -c "^\*\*Container\*\*:" CONTEXT.md           # expect: 1
grep -c "^\*\*Binding\*\*:" CONTEXT.md             # expect: 0
ls tests/fixtures                                  # expect: enterprise-feature.ts
git switch -c phase-00-naming-guide-and-baseline
```

Facts this plan relies on, all checked against the code on 2026-09-21:

- `tests/compiler.ts` exports `compilerProgram(path: string, source?: string): ts.Program`, which creates a program with that single root file and reuses parsed files between calls. It imports the compiler as `import ts from 'typescript'`.
- `scripts/test-lane.mjs` puts a test in the fast lane unless its name is in the `compilerLane` set. `tests/compiler-reuse.test.ts` is a fast-lane test that builds small compiler programs, which is the precedent for the naming test: the scan takes about half a second. `tests/test-lanes.test.ts` checks that the two lanes partition every `*.test.ts`; new test files need no registration.
- `npm run typecheck` compiles everything under `tests/`, including fixtures, with `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- `scripts/benchmark-types.ts --worker <count> <form> valid` prints one JSON row with `accepted`, `instantiations`, `milliseconds`, `maxRssMiB`, `typescript`, `node`. `scripts/check-token-scale.ts <form> valid <count>` prints a row with `diagnostics`, `instantiations`, `milliseconds`, `maxRssMiB`, `typescript`, `node` and **no** `accepted` field. The master plan says both print `accepted`; for the token cases acceptance is `diagnostics.length === 0`, and the helper script below computes it that way.
- Both workers resolve `src` relative to the current directory, so they must run from the repository root.
- Every `docs/guides/*.md` file becomes a website page automatically (`sitePages` in `tools/docs/lib/markdown.mjs`). `npm run docs:check` fails when a relative link in a page points at a file that does not exist. The naming guide links to the test, the list, the script and the baseline, which is why the guide is written after them, in Task 5.
- The sidebar is the `guide` array in `tools/docs/vitepress.config.mjs`. The list of guides for contributors is the "Contribute" table in `docs/README.md`, and `docs/guides/documentation.md` has a table that says where each kind of documentation is edited. No test pins any of the three.
- On `next` the fast lane has 538 tests and the compiler lane has 575. This phase adds 8 fast-lane tests.

## File Structure

| File | Responsibility |
| --- | --- |
| Create `tests/api-naming-surface.ts` | The scanner. `collectFindings(root)` returns the rule violations of the public surface under `<root>/src/index.ts`; `words(identifier)` splits names. Not a test file. |
| Create `tests/fixtures/api-naming/src/index.ts`, `tests/fixtures/api-naming/src/surface.ts` | A deliberately badly named miniature surface that proves every rule fires and every exemption holds. |
| Create `tests/api-naming.test.ts` | Scanner self-tests (Task 1) and the ratchet (Task 2). Fast lane. |
| Create `tests/api-naming-known-violations.json` | The 61 violations of the 0.4.0 surface. Generated, then only ever shrunk. |
| Create `scripts/evidence-cases.mjs` | Runs the twelve compile-budget cases, prints a Markdown table, compares with a baseline table, exits 1 over budget. Later phases reuse it. |
| Create `tests/evidence-cases.test.ts` | Tests the script through saved rows, so no compiler case runs. Fast lane. |
| Create `docs/superpowers/plans/evidence/baseline.md` | The 0.4.0 baseline table with provenance. |
| Create `docs/guides/api-naming.md` | The naming standard: translation table, fifteen rules, `term:description`, vocabulary, what the test checks, measured exceptions. |
| Modify `tools/docs/vitepress.config.mjs`, `docs/README.md`, `docs/guides/documentation.md` | List the new guide. |
| Modify `CONTEXT.md` | Add the vocabulary words that have no definition yet; retire "cleanup" from the prose. |

---

### Task 1: The public-surface scanner

**Files:**
- Create: `tests/api-naming-surface.ts`
- Create: `tests/fixtures/api-naming/src/index.ts`
- Create: `tests/fixtures/api-naming/src/surface.ts`
- Test: `tests/api-naming.test.ts`

**Interfaces:**
- Consumes: `compilerProgram` from `tests/compiler.ts`.
- Produces: `collectFindings(root: string): Finding[]`, sorted by `id`; `interface Finding { readonly id: string; readonly rule: Rule; readonly where: string }` where `id` is `<rule>: <subject>`; `words(identifier: string): string[]`. Task 2 and the naming guide rely on the five rule names `builder-method-prefix`, `boolean-name`, `abbreviation`, `value-casing`, `retired-word` and on the subject forms `export <Name>`, `member <name>`, `parameter <name>`, `value '<value>'`, `code <DI_BAG_CODE>`, and the bare method name for `builder-method-prefix`.

Design decisions, already made:
- An id never names an owner. `Bag.fork` and `Container.fork` are the same violation, so renaming an owner in a later phase does not move a violation in the list. `where` records the first place a subject was seen and is for messages only.
- The boolean rule accepts a name that **contains** one of the words `is`, `has`, `allows`, `receives`, not only one that starts with it, because the spec's own `factoryReceivesContext` puts the subject first.
- A string value is checked only when it consists of `[A-Za-z0-9_:-]`. Anything else is prose or a URL inside a compile-time message, not a value anyone passes.
- `DI_BAG_` codes are read from the text of `src/*.ts`, because most codes appear only in calls and never in a type.

- [ ] **Step 1: Write the fixture surface**

Create `tests/fixtures/api-naming/src/index.ts`:

```ts
// A deliberately badly named surface. tests/api-naming.test.ts expects exactly the findings marked in surface.ts.
export type { Builder, FixtureKind, FixtureOptions, StartupThing } from './surface';
export { fixtureFacade } from './surface';
```

Create `tests/fixtures/api-naming/src/surface.ts`:

```ts
// Every "finding" comment below is asserted by tests/api-naming.test.ts; every "fine" comment must stay silent.
export type FixtureKind =
  | 'camelValue' // finding: value-casing
  | 'kebab-value' // fine
  | 'scoped:one-per-container' // fine: term:description
  | 'a message with spaces is prose'; // fine: not a value anyone passes
export type StartupThing = { readonly kind: 'cleanup-started' }; // findings: retired-word export, retired-word value
interface Hidden { readonly enabled: boolean } // reached through FixtureOptions.hidden; same subject as below, reported once
export interface FixtureOptions {
  readonly enabled: boolean; // finding: boolean-name
  readonly isEnabled: boolean; // fine
  readonly factoryReceivesContext?: true; // fine: the assertion verb may follow its subject
  readonly hidden: Hidden;
  readonly onEvent: (this: void, ctx: string) => void; // finding: abbreviation
}
class Builder {
  declare private readonly nominal: void; // fine: private
  /** @internal */
  internalThing(): void {} // fine: internal
  register(options: FixtureOptions): Builder; // finding: builder-method-prefix
  register(options: FixtureOptions, more: FixtureOptions): Builder;
  register(): Builder { return this; } // fine: the implementation of an overload set is not public
  withServices(): Builder { return this; } // fine
  buildContainer(): void {} // fine
  verifyGraphAtCompileTime(): void {} // fine
  readonly contribute: (deps: string) => Builder = () => this; // findings: builder-method-prefix, abbreviation
  constructor(readonly scopeId: symbol, plain: boolean) { void plain; } // finding: retired-word member scopeId; `plain` is fine
}
export type { Builder };
export const fixtureFacade: { readonly createBuilder: () => Builder } = {
  createBuilder: () => new Builder(Symbol('fixture'), true),
};
export function notExported(): string { return 'DI_BAG_startup_BAD'; } // findings: value-casing code, retired-word code
```

- [ ] **Step 2: Write the failing tests**

Create `tests/api-naming.test.ts`:

```ts
// tests/api-naming.test.ts
// Tests for the public-surface scanner in tests/api-naming-surface.ts. The naming ratchet
// for docs/guides/api-naming.md is added to this file in the next task.
import { expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { collectFindings, words } from './api-naming-surface';

test('words splits identifiers, values and codes and ignores the product prefix', () => {
  expect(words('buildAndStart')).toEqual(['build', 'and', 'start']);
  expect(words('DiBagStartupCancelledError')).toEqual(['startup', 'cancelled', 'error']);
  expect(words('DiBag')).toEqual([]);
  expect(words('parentScopeId')).toEqual(['parent', 'scope', 'id']);
  expect(words('scoped:one-per-container')).toEqual(['scoped', 'one', 'per', 'container']);
  expect(words('acquisition-started')).toEqual(['acquisition', 'started']);
  expect(words('INVALID_ACQUISITION_MODE')).toEqual(['invalid', 'acquisition', 'mode']);
  expect(words('HTTPServer')).toEqual(['http', 'server']);
});

test('the scanner reports every rule on the badly named fixture surface', () => {
  expect(collectFindings(resolve(__dirname, 'fixtures/api-naming')).map(finding => finding.id)).toEqual([
    'abbreviation: parameter ctx',
    'abbreviation: parameter deps',
    'boolean-name: member enabled',
    'builder-method-prefix: contribute',
    'builder-method-prefix: register',
    'retired-word: code DI_BAG_startup_BAD',
    'retired-word: export StartupThing',
    'retired-word: member scopeId',
    "retired-word: value 'cleanup-started'",
    'value-casing: code DI_BAG_startup_BAD',
    "value-casing: value 'camelValue'",
  ]);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun test tests/api-naming.test.ts`
Expected: FAIL with `error: Cannot find module './api-naming-surface' from '…/tests/api-naming.test.ts'`, and the summary `1 fail`, `1 error`.

- [ ] **Step 4: Write the scanner**

Create `tests/api-naming-surface.ts`:

```ts
// tests/api-naming-surface.ts
// Scans the public surface for the mechanical rules of docs/guides/api-naming.md.
// The public surface is every declaration reachable from the exports of src/index.ts through
// type references: exported names, member names, parameter names and string values. Bodies,
// constructors' plain parameters, private members, #private names, symbol-keyed members and
// members tagged @internal are not public.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import ts from 'typescript';
import { compilerProgram } from './compiler';

export type Rule = 'builder-method-prefix' | 'boolean-name' | 'abbreviation' | 'value-casing' | 'retired-word';
export interface Finding {
  /** Stable identity used by the known-violations list: `<rule>: <subject>`. It never names an owner, so renaming an owner does not move a violation. */
  readonly id: string;
  readonly rule: Rule;
  /** First place the subject was seen; for messages only. */
  readonly where: string;
}

/** Rule 7 of the naming guide. Matched against whole words of an identifier. */
export const abbreviations: ReadonlySet<string> = new Set(['ctx', 'deps', 'opts', 'cfg']);
/** The mechanically checkable retired words of the naming guide's vocabulary table. Matched against whole words. */
export const retiredWords: ReadonlySet<string> = new Set([
  'cleanup', 'startup', 'start', 'bag', 'root', 'family', 'scope', 'fork', 'mode', 'direct', 'awaited', 'all',
]);
/** Rule 6: a boolean name asserts something, so one of its words is one of these verbs. */
export const assertionVerbs: ReadonlySet<string> = new Set(['is', 'has', 'allows', 'receives']);
const builderPrefix = /^(with|build|verify)/;
const kebab = '[a-z][a-z0-9]*(?:-[a-z0-9]+)*';
const valuePattern = new RegExp(`^${kebab}(?::${kebab})?$`);
const codePattern = /^DI_BAG_[A-Z0-9]+(?:_[A-Z0-9]+)*$/;

/** Lower-case words of an identifier, a kebab-case value or a code. The product prefix `DiBag` is not a word. */
export function words(identifier: string): string[] {
  return identifier.replace(/^DiBag/, '')
    .split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|[_\-:\s]+/)
    .filter(Boolean)
    .map(word => word.toLowerCase());
}

export function collectFindings(root: string): Finding[] {
  const sourceDirectory = resolve(root, 'src');
  const sourceRoot = sourceDirectory + sep;
  const indexPath = resolve(sourceDirectory, 'index.ts');
  const program = compilerProgram(indexPath);
  const checker = program.getTypeChecker();
  const index = program.getSourceFile(indexPath);
  if (!index) throw new Error(`cannot load ${indexPath}`);
  const moduleSymbol = checker.getSymbolAtLocation(index);
  if (!moduleSymbol) throw new Error(`${indexPath} has no exports`);

  const findings = new Map<string, Finding>();
  const add = (rule: Rule, subject: string, where: string) => {
    const id = `${rule}: ${subject}`;
    if (!findings.has(id)) findings.set(id, { id, rule, where });
  };
  const checkName = (kind: 'export' | 'member' | 'parameter', name: string, where: string) => {
    for (const word of words(name)) {
      if (retiredWords.has(word)) add('retired-word', `${kind} ${name}`, where);
      if (abbreviations.has(word)) add('abbreviation', `${kind} ${name}`, where);
    }
  };
  const checkValue = (value: string, where: string) => {
    if (!/^[A-Za-z0-9_:-]+$/.test(value)) return; // prose or a URL inside a diagnostic, not a value anyone passes
    if (value.startsWith('DI_BAG_')) return; // codes are checked from the source text below
    if (!valuePattern.test(value)) add('value-casing', `value '${value}'`, where);
    if (words(value).some(word => retiredWords.has(word))) add('retired-word', `value '${value}'`, where);
  };

  const resolveSymbol = (symbol: ts.Symbol | undefined): ts.Symbol | undefined =>
    symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  const inLibrary = (node: ts.Node) => node.getSourceFile().fileName.startsWith(sourceRoot);
  const seen = new Set<ts.Node>();
  const hasModifier = (node: ts.Node, kind: ts.SyntaxKind) =>
    ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some(modifier => modifier.kind === kind);
  const isHidden = (node: ts.Node) =>
    hasModifier(node, ts.SyntaxKind.PrivateKeyword) || hasModifier(node, ts.SyntaxKind.ProtectedKeyword) ||
    ts.getJSDocTags(node).some(tag => tag.tagName.text === 'internal');
  const plainName = (name: ts.PropertyName | ts.BindingName | undefined): string | undefined =>
    name && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? name.text : undefined;

  const isBooleanish = (node: ts.TypeNode): boolean => {
    if (node.kind === ts.SyntaxKind.BooleanKeyword) return true;
    if (ts.isLiteralTypeNode(node)) return node.literal.kind === ts.SyntaxKind.TrueKeyword || node.literal.kind === ts.SyntaxKind.FalseKeyword;
    if (ts.isParenthesizedTypeNode(node)) return isBooleanish(node.type);
    if (ts.isUnionTypeNode(node)) {
      const parts = node.types.filter(part => part.kind !== ts.SyntaxKind.UndefinedKeyword);
      return parts.length > 0 && parts.every(isBooleanish);
    }
    if (ts.isConditionalTypeNode(node)) return isBooleanish(node.trueType) && isBooleanish(node.falseType);
    return false;
  };
  const stringValues = (node: ts.TypeNode | undefined): string[] => {
    if (!node) return [];
    if (ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal)) return [node.literal.text];
    if (ts.isParenthesizedTypeNode(node)) return stringValues(node.type);
    if (ts.isUnionTypeNode(node)) return node.types.flatMap(stringValues);
    return [];
  };
  const checkTyped = (name: string, type: ts.TypeNode | undefined, where: string) => {
    if (!type) return;
    if (isBooleanish(type) && !words(name).some(word => assertionVerbs.has(word))) add('boolean-name', `member ${name}`, where);
    for (const value of stringValues(type)) checkValue(value, where);
  };

  function visitSymbol(symbol: ts.Symbol | undefined) {
    for (const declaration of resolveSymbol(symbol)?.declarations ?? []) if (inLibrary(declaration)) visitDeclaration(declaration);
  }

  function visitType(node: ts.Node | undefined, owner: string) {
    if (!node) return;
    if (ts.isTypeReferenceNode(node)) visitSymbol(checker.getSymbolAtLocation(node.typeName));
    else if (ts.isExpressionWithTypeArguments(node)) visitSymbol(checker.getSymbolAtLocation(node.expression));
    else if (ts.isTypeQueryNode(node)) visitSymbol(checker.getSymbolAtLocation(node.exprName));
    else if (ts.isImportTypeNode(node) && node.qualifier) visitSymbol(checker.getSymbolAtLocation(node.qualifier));
    if (ts.isTypeLiteralNode(node)) { for (const member of node.members) visitMember(member, owner); return; }
    if (ts.isFunctionTypeNode(node) || ts.isConstructorTypeNode(node)) { visitSignature(node, owner); return; }
    ts.forEachChild(node, child => visitType(child, owner));
  }

  function visitTypeParameters(parameters: ts.NodeArray<ts.TypeParameterDeclaration> | undefined, owner: string) {
    for (const parameter of parameters ?? []) { visitType(parameter.constraint, owner); visitType(parameter.default, owner); }
  }

  function visitSignature(node: ts.SignatureDeclarationBase, owner: string) {
    visitTypeParameters(node.typeParameters, owner);
    for (const parameter of node.parameters) {
      const name = plainName(parameter.name);
      if (name !== undefined && name !== 'this') {
        checkName('parameter', name, owner);
        for (const value of stringValues(parameter.type)) checkValue(value, `${owner}(${name})`);
      }
      visitType(parameter.type, owner);
    }
    visitType(node.type, owner);
  }

  function visitMember(member: ts.Node, owner: string) {
    if (isHidden(member)) return;
    if (ts.isConstructorDeclaration(member)) {
      // Only parameter properties are members; the constructor itself is not a public call.
      for (const parameter of member.parameters) {
        const name = plainName(parameter.name);
        const isProperty = hasModifier(parameter, ts.SyntaxKind.ReadonlyKeyword) || hasModifier(parameter, ts.SyntaxKind.PublicKeyword);
        if (name === undefined || !isProperty || isHidden(parameter)) continue;
        checkName('member', name, `${owner}.${name}`);
        checkTyped(name, parameter.type, `${owner}.${name}`);
        visitType(parameter.type, `${owner}.${name}`);
      }
      return;
    }
    if (ts.isCallSignatureDeclaration(member) || ts.isConstructSignatureDeclaration(member) || ts.isIndexSignatureDeclaration(member)) {
      visitSignature(member, owner);
      return;
    }
    if (!ts.isPropertySignature(member) && !ts.isPropertyDeclaration(member) && !ts.isMethodSignature(member) &&
      !ts.isMethodDeclaration(member) && !ts.isGetAccessorDeclaration(member)) return;
    const name = plainName(member.name);
    if (name === undefined) return; // #private names and symbol-keyed invariants are not public names
    const where = `${owner}.${name}`;
    if (ts.isMethodDeclaration(member) && member.body) {
      const siblings = (member.parent as ts.ClassLikeDeclaration).members;
      // The implementation signature of an overload set is not public.
      if (siblings.some(other => other !== member && ts.isMethodDeclaration(other) && !other.body && plainName(other.name) === name)) return;
    }
    checkName('member', name, where);
    if (ts.isMethodSignature(member) || ts.isMethodDeclaration(member) || ts.isGetAccessorDeclaration(member)) { visitSignature(member, where); return; }
    checkTyped(name, member.type, where);
    visitType(member.type, where);
  }

  function visitDeclaration(declaration: ts.Declaration) {
    if (seen.has(declaration)) return;
    seen.add(declaration);
    if (ts.isClassDeclaration(declaration) || ts.isInterfaceDeclaration(declaration)) {
      const owner = declaration.name?.text ?? '(anonymous)';
      visitTypeParameters(declaration.typeParameters, owner);
      for (const clause of declaration.heritageClauses ?? []) for (const type of clause.types) visitType(type, owner);
      for (const member of declaration.members) visitMember(member, owner);
    } else if (ts.isTypeAliasDeclaration(declaration)) {
      const owner = declaration.name.text;
      visitTypeParameters(declaration.typeParameters, owner);
      for (const value of stringValues(declaration.type)) checkValue(value, owner);
      visitType(declaration.type, owner);
    } else if (ts.isFunctionDeclaration(declaration)) {
      const owner = declaration.name?.text ?? '(anonymous)';
      const symbol = declaration.name && checker.getSymbolAtLocation(declaration.name);
      const overloads = (symbol?.declarations ?? []).filter(ts.isFunctionDeclaration);
      if (declaration.body && overloads.some(other => !other.body)) return; // implementation of an overload set
      visitSignature(declaration, owner);
    } else if (ts.isVariableDeclaration(declaration)) {
      visitType(declaration.type, plainName(declaration.name) ?? '(variable)');
    }
  }

  const exported = checker.getExportsOfModule(moduleSymbol);
  for (const symbol of exported) {
    checkName('export', symbol.name, `export ${symbol.name}`);
    visitSymbol(symbol);
  }

  const builder = resolveSymbol(exported.find(symbol => symbol.name === 'Builder'))?.declarations?.find(ts.isClassDeclaration);
  if (!builder) throw new Error(`${indexPath} must export the Builder class`);
  for (const member of builder.members) {
    if (!ts.isMethodDeclaration(member) && !ts.isPropertyDeclaration(member)) continue;
    if (isHidden(member) || hasModifier(member, ts.SyntaxKind.StaticKeyword)) continue;
    const name = plainName(member.name);
    if (name === undefined) continue;
    const callable = ts.isMethodDeclaration(member) || checker.getTypeAtLocation(member).getCallSignatures().length > 0;
    if (callable && !builderPrefix.test(name)) add('builder-method-prefix', name, `Builder.${name}`);
  }

  // Runtime codes live in calls, not in types, so they are read from the source text.
  for (const file of readdirSync(sourceDirectory).filter(name => name.endsWith('.ts')).sort()) {
    for (const [, code] of readFileSync(resolve(sourceDirectory, file), 'utf8').matchAll(/'(DI_BAG_[A-Za-z0-9_]*)'/g)) {
      if (!codePattern.test(code!)) add('value-casing', `code ${code}`, `src/${file}`);
      if (words(code!.slice('DI_BAG_'.length)).some(word => retiredWords.has(word))) add('retired-word', `code ${code}`, `src/${file}`);
    }
  }
  return [...findings.values()].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun test tests/api-naming.test.ts`
Expected: `2 pass`, `0 fail`.

If the fixture test fails, read the difference before touching anything: an extra id means an exemption stopped working (private members, `@internal`, overload implementations, constructors' plain parameters, prose values), a missing id means a rule stopped firing. Fix the scanner, never the expected list, unless the fixture file itself was changed.

- [ ] **Step 6: Type-check the new files**

Run: `npm run typecheck`
Expected: exit 0 and no `error TS` line. The fixture is compiled too, because `tsconfig.json` includes `tests`.

- [ ] **Step 7: Commit**

```bash
git add tests/api-naming-surface.ts tests/api-naming.test.ts tests/fixtures/api-naming
git commit -F - <<'MSG'
test(naming): scan the public surface for the mechanical naming rules

The scanner walks everything reachable from the exports of src/index.ts and
reports builder method prefixes, boolean names, abbreviations, string value
casing and retired words. A badly named fixture surface proves every rule
and every exemption.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

---

### Task 2: The naming ratchet

**Files:**
- Modify: `tests/api-naming.test.ts` (replace the whole file)
- Create: `tests/api-naming-known-violations.json` (generated)

**Interfaces:**
- Consumes: `collectFindings`, `words` from Task 1.
- Produces: `tests/api-naming-known-violations.json` with the shape `{ "note": string, "violations": string[] }`, sorted. The environment variable `UPDATE_API_NAMING_VIOLATIONS=1` creates the list when it is missing and otherwise only removes entries. Every later phase runs `bun test tests/api-naming.test.ts` and shrinks the list with that variable.

- [ ] **Step 1: Replace the test file with the version that contains the ratchet**

Replace the whole content of `tests/api-naming.test.ts` with:

```ts
// tests/api-naming.test.ts
// The naming ratchet for docs/guides/api-naming.md.
//
// tests/api-naming-known-violations.json lists the violations that existed when the Swift API
// style program started (docs/superpowers/specs/2026-09-20-swift-api-style.md). The list can only
// shrink: a violation that is not listed fails this test, and so does a listed violation that no
// longer occurs. The list must be empty at the end of phase 11 of
// docs/superpowers/plans/2026-09-21-00-swift-api-style-master.md, and it stays empty afterwards.
//
// After fixing names, shrink the list with:
//   UPDATE_API_NAMING_VIOLATIONS=1 bun test tests/api-naming.test.ts
// That mode only removes entries. It never adds one.
import { expect, test } from 'bun:test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { collectFindings, words } from './api-naming-surface';

const root = resolve(__dirname, '..');
const listPath = resolve(__dirname, 'api-naming-known-violations.json');
const update = process.env.UPDATE_API_NAMING_VIOLATIONS === '1';
const note = 'Known violations of docs/guides/api-naming.md. This list can only shrink and must be empty after phase 11 of the Swift API style program. Shrink it with UPDATE_API_NAMING_VIOLATIONS=1 bun test tests/api-naming.test.ts';

function readKnown(): string[] | undefined {
  if (!existsSync(listPath)) return undefined;
  const parsed: unknown = JSON.parse(readFileSync(listPath, 'utf8'));
  const violations = typeof parsed === 'object' && parsed !== null ? (parsed as { violations?: unknown }).violations : undefined;
  if (!Array.isArray(violations) || violations.some(item => typeof item !== 'string')) throw new Error(`${listPath} must be { "note": string, "violations": string[] }`);
  return violations as string[];
}

test('words splits identifiers, values and codes and ignores the product prefix', () => {
  expect(words('buildAndStart')).toEqual(['build', 'and', 'start']);
  expect(words('DiBagStartupCancelledError')).toEqual(['startup', 'cancelled', 'error']);
  expect(words('DiBag')).toEqual([]);
  expect(words('parentScopeId')).toEqual(['parent', 'scope', 'id']);
  expect(words('scoped:one-per-container')).toEqual(['scoped', 'one', 'per', 'container']);
  expect(words('acquisition-started')).toEqual(['acquisition', 'started']);
  expect(words('INVALID_ACQUISITION_MODE')).toEqual(['invalid', 'acquisition', 'mode']);
  expect(words('HTTPServer')).toEqual(['http', 'server']);
});

test('the scanner reports every rule on the badly named fixture surface', () => {
  expect(collectFindings(resolve(__dirname, 'fixtures/api-naming')).map(finding => finding.id)).toEqual([
    'abbreviation: parameter ctx',
    'abbreviation: parameter deps',
    'boolean-name: member enabled',
    'builder-method-prefix: contribute',
    'builder-method-prefix: register',
    'retired-word: code DI_BAG_startup_BAD',
    'retired-word: export StartupThing',
    'retired-word: member scopeId',
    "retired-word: value 'cleanup-started'",
    'value-casing: code DI_BAG_startup_BAD',
    "value-casing: value 'camelValue'",
  ]);
});

test('the public surface has no naming violation outside the known list, and the list only shrinks', () => {
  const current = collectFindings(root);
  const currentIds = new Set(current.map(finding => finding.id));
  let known = readKnown();
  if (update) {
    // The first run records the starting point. Every later run may only remove entries.
    const next = known === undefined ? [...currentIds] : known.filter(id => currentIds.has(id));
    writeFileSync(listPath, `${JSON.stringify({ note, violations: next.sort() }, null, 2)}\n`);
    known = next;
  }
  if (known === undefined) throw new Error(`Missing ${listPath}. Create it once with UPDATE_API_NAMING_VIOLATIONS=1 bun test tests/api-naming.test.ts`);
  const listed = new Set(known);
  const unlisted = current.filter(finding => !listed.has(finding.id)).map(finding => `${finding.id} (first seen at ${finding.where})`);
  const fixed = known.filter(id => !currentIds.has(id));
  const problems = [
    ...(unlisted.length ? [`New naming violations. Fix the names; the known list cannot grow:\n  ${unlisted.join('\n  ')}`] : []),
    ...(fixed.length ? [`Fixed violations are still listed. Run UPDATE_API_NAMING_VIOLATIONS=1 bun test tests/api-naming.test.ts and commit the smaller list:\n  ${fixed.join('\n  ')}`] : []),
  ];
  if (problems.length) throw new Error(problems.join('\n'));
  expect([...known].sort()).toEqual(known);
});
```

- [ ] **Step 2: Run it to verify the ratchet fails without a list**

Run: `bun test tests/api-naming.test.ts`
Expected: `2 pass`, `1 fail`, and the failure says `Missing …/tests/api-naming-known-violations.json. Create it once with UPDATE_API_NAMING_VIOLATIONS=1 bun test tests/api-naming.test.ts`.

- [ ] **Step 3: Record the starting point**

Run: `UPDATE_API_NAMING_VIOLATIONS=1 bun test tests/api-naming.test.ts`
Expected: `3 pass`, `0 fail`, and the new file `tests/api-naming-known-violations.json`.

- [ ] **Step 4: Check the recorded list**

Run: `node -e "const list=require('./tests/api-naming-known-violations.json').violations; console.log(list.length)"`
Expected: `61`

The file must be exactly this. `src` is the 0.4.0 source, so any difference means the scanner was changed; find out why before continuing.

```json
{
  "note": "Known violations of docs/guides/api-naming.md. This list can only shrink and must be empty after phase 11 of the Swift API style program. Shrink it with UPDATE_API_NAMING_VIOLATIONS=1 bun test tests/api-naming.test.ts",
  "violations": [
    "abbreviation: parameter deps",
    "abbreviation: parameter disposerCtx",
    "abbreviation: parameter factoryCtx",
    "boolean-name: member allowScopedDependencies",
    "boolean-name: member owned",
    "boolean-name: member present",
    "builder-method-prefix: alias",
    "builder-method-prefix: contribute",
    "builder-method-prefix: installModule",
    "builder-method-prefix: register",
    "builder-method-prefix: replace",
    "retired-word: code DI_BAG_CLEANUP_AFTER_FACTORY",
    "retired-word: code DI_BAG_CLEANUP_FAILED",
    "retired-word: code DI_BAG_INVALID_ACQUISITION_MODE",
    "retired-word: code DI_BAG_INVALID_CLEANUP",
    "retired-word: code DI_BAG_INVALID_SCOPE",
    "retired-word: code DI_BAG_INVALID_STARTUP",
    "retired-word: code DI_BAG_STARTUP_CANCELLED",
    "retired-word: code DI_BAG_STARTUP_FAILED",
    "retired-word: code DI_BAG_STARTUP_TIMEOUT",
    "retired-word: export AcquisitionMode",
    "retired-word: export Bag",
    "retired-word: export CheckedScopeLifetimes",
    "retired-word: export CleanupFailure",
    "retired-word: export DiBagCleanupError",
    "retired-word: export DiBagStartupCancelledError",
    "retired-word: export DiBagStartupError",
    "retired-word: export DisjointScopeSelection",
    "retired-word: export PluginAcquisitionMode",
    "retired-word: export ScopeEventFields",
    "retired-word: export ScopeOptions",
    "retired-word: export StartupOptions",
    "retired-word: member acquisitionMode",
    "retired-word: member all",
    "retired-word: member buildAndStart",
    "retired-word: member cleanupError",
    "retired-word: member cleanupFailures",
    "retired-word: member cleanupPromise",
    "retired-word: member createScope",
    "retired-word: member fork",
    "retired-word: member inspectAll",
    "retired-word: member mode",
    "retired-word: member parentScopeId",
    "retired-word: member resolveAll",
    "retired-word: member root",
    "retired-word: member scopeId",
    "retired-word: member startupOrder",
    "retired-word: parameter modeOptions",
    "retired-word: value 'all'",
    "retired-word: value 'awaited'",
    "retired-word: value 'cleanup-completed'",
    "retired-word: value 'cleanup-failed'",
    "retired-word: value 'cleanup-started'",
    "retired-word: value 'direct'",
    "retired-word: value 'root'",
    "retired-word: value 'root-reach'",
    "retired-word: value 'scope-close-failed'",
    "retired-word: value 'scope-closed'",
    "retired-word: value 'scope-closing'",
    "retired-word: value 'scope-opened'",
    "value-casing: value 'nativePromise'"
  ]
}
```

Every entry is removed by a later phase of the master plan. As a guide: the abbreviations go in phase 2; `buildAndStart`, `startupOrder`, `StartupOptions` and the `STARTUP` codes and error names in phase 3; `all`, `resolveAll`, `inspectAll` and `'all'` in phase 4; the five builder methods in phase 5; `Bag`, `fork`, `createScope`, `ScopeOptions`, `DisjointScopeSelection` and `CheckedScopeLifetimes` in phase 6; `acquisitionMode`, `AcquisitionMode`, `PluginAcquisitionMode`, `modeOptions` and `'nativePromise'` in phase 8; `mode`, `'direct'`, `'awaited'`, `'root'`, `'root-reach'`, `root` and `allowScopedDependencies` in phases 9 and 10; and the `cleanup` names, the `scope-` event kinds, `scopeId`, `parentScopeId`, `ScopeEventFields`, `owned`, `present` and the remaining codes in phase 11. An id disappears only when its last occurrence does: `cleanupPromise` stays listed after phase 3 because `DiBagCloseCancelledError` keeps it until phase 11.

- [ ] **Step 5: Prove that the list can only shrink**

```bash
cp tests/api-naming-known-violations.json /tmp/known-violations.backup.json
node -e "
const fs = require('node:fs');
const path = 'tests/api-naming-known-violations.json';
const list = JSON.parse(fs.readFileSync(path, 'utf8'));
list.violations = list.violations.filter(id => id !== 'builder-method-prefix: alias').concat('retired-word: member alreadyFixedName').sort();
fs.writeFileSync(path, JSON.stringify(list, null, 2) + '\n');
"
bun test tests/api-naming.test.ts
```

Expected: `1 fail`, with both messages: `New naming violations. Fix the names; the known list cannot grow:` naming `builder-method-prefix: alias (first seen at Builder.alias)`, and `Fixed violations are still listed.` naming `retired-word: member alreadyFixedName`.

```bash
UPDATE_API_NAMING_VIOLATIONS=1 bun test tests/api-naming.test.ts
grep -c "alreadyFixedName\|prefix: alias" tests/api-naming-known-violations.json
```

Expected: the test still fails with only the `New naming violations` message, and `grep` prints `0`: update mode removed the stale entry and did not add the missing one.

```bash
cp /tmp/known-violations.backup.json tests/api-naming-known-violations.json
bun test tests/api-naming.test.ts
```

Expected: `3 pass`, `0 fail`.

- [ ] **Step 6: Type-check and commit**

Run: `npm run typecheck`
Expected: exit 0.

```bash
git add tests/api-naming.test.ts tests/api-naming-known-violations.json
git commit -F - <<'MSG'
test(naming): ratchet the 61 naming violations of the 0.4.0 surface

A violation that is not listed fails, and so does a listed violation that no
longer occurs, so the list can only shrink. It must be empty at the end of
phase 11 of the Swift API style program.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

---

### Task 3: The evidence helper script

**Files:**
- Create: `scripts/evidence-cases.mjs`
- Test: `tests/evidence-cases.test.ts`

**Interfaces:**
- Consumes: `scripts/benchmark-types.ts --worker` and `scripts/check-token-scale.ts`, unchanged.
- Produces: the CLI below. Later phases call exactly these forms.

  ```bash
  node scripts/evidence-cases.mjs                                                       # run the twelve cases, print provenance and a table
  node scripts/evidence-cases.mjs --compare docs/superpowers/plans/evidence/baseline.md # add Baseline and Change columns; exit 1 when a case grows by more than 10%, is rejected, fails to run, or is missing from the baseline
  node scripts/evidence-cases.mjs --counts 100                                          # only the six 100-operation cases, about 12 seconds
  node scripts/evidence-cases.mjs --json rows.json                                      # also save the raw rows
  node scripts/evidence-cases.mjs --rows rows.json [--compare …]                        # render saved rows; nothing is run
  ```

  The table header is `| Case | Count | Instantiations | Milliseconds | Max RSS MiB | Accepted |`, or with `--compare`, `| Case | Count | Instantiations | Baseline | Change | Milliseconds | Max RSS MiB | Accepted |`. `--compare` reads the first table of the given Markdown file whose header starts with `| Case | Count | Instantiations |`. Exit codes: 0 fine, 1 a problem with a case, 2 bad arguments.

The repo's other scripts are TypeScript files with tests that import them. This one is an `.mjs` file because the controller fixed the name `scripts/evidence-cases.mjs` for the later phases, and a `.ts` test cannot import an untyped `.mjs` module under `strict`. The test therefore drives it as a process, the way `tests/test-lanes.test.ts` drives `scripts/test-lane.mjs`, and feeds it saved rows so that no compiler case runs in the fast lane.

- [ ] **Step 1: Write the failing test**

Create `tests/evidence-cases.test.ts`:

```ts
// tests/evidence-cases.test.ts
import { afterAll, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(__dirname, '..');
const workspace = mkdtempSync(join(tmpdir(), 'di-bag-evidence-'));
afterAll(() => rmSync(workspace, { recursive: true, force: true }));

const rows = [
  { form: 'bulk', count: 100, instantiations: 159001, milliseconds: 1100, maxRssMiB: 366, accepted: true, typescript: '6.0.3', node: 'v24.20.0' },
  { form: 'bindings', count: 500, instantiations: 12152666, milliseconds: 9300, maxRssMiB: 1684, accepted: true, typescript: '6.0.3', node: 'v24.20.0' },
];
const baseline = (bulk: string, bindings: string) => [
  '# Baseline', '', 'Some prose.', '',
  '| Case | Count | Instantiations | Milliseconds | Max RSS MiB | Accepted |', '| --- | --- | --- | --- | --- | --- |',
  `| bulk | 100 | ${bulk} | 1,000 | 364 | yes |`, `| bindings | 500 | ${bindings} | 9,300 | 1,684 | yes |`, '', 'More prose.', '',
].join('\n');

function write(name: string, content: string): string {
  const path = join(workspace, name);
  writeFileSync(path, content);
  return path;
}
function run(...args: string[]) {
  // Saved rows keep this test away from the compiler: no case is run.
  return spawnSync(process.execPath, ['scripts/evidence-cases.mjs', ...args], { cwd: root, encoding: 'utf8' });
}

test('renders saved rows as a table without a baseline', () => {
  const result = run('--rows', write('rows.json', JSON.stringify(rows)));
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('| Case | Count | Instantiations | Milliseconds | Max RSS MiB | Accepted |');
  expect(result.stdout).toContain('| bulk | 100 | 159,001 | 1,100 | 366 | yes |');
  expect(result.stdout).toContain('| bindings | 500 | 12,152,666 | 9,300 | 1,684 | yes |');
});

test('compares with a baseline table and passes inside the budget', () => {
  const result = run('--rows', write('rows.json', JSON.stringify(rows)), '--compare', write('inside.md', baseline('158,620', '12,152,666')));
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('| bulk | 100 | 159,001 | 158,620 | +0.2% | 1,100 | 366 | yes |');
  expect(result.stdout).toContain('| bindings | 500 | 12,152,666 | 12,152,666 | 0.0% | 9,300 | 1,684 | yes |');
});

test('exits 1 when a case grows by more than ten percent', () => {
  const result = run('--rows', write('rows.json', JSON.stringify(rows)), '--compare', write('over.md', baseline('140,000', '12,152,666')));
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('bulk 100: +13.6% is over the 10% budget');
});

test('exits 1 when a case was rejected, failed to run, or is missing from the baseline', () => {
  const rejected = [{ ...rows[0], accepted: false, failure: 'exit 1: boom' }, rows[1]];
  const result = run('--rows', write('rejected.json', JSON.stringify(rejected)), '--compare', write('partial.md', baseline('158,620', 'n/a')));
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('bulk 100: not accepted (exit 1: boom)');
  expect(result.stderr).toContain('bindings 500: missing from the baseline');
});

test('saves the rows it rendered and rejects unknown arguments', () => {
  const saved = join(workspace, 'saved.json');
  expect(run('--rows', write('rows.json', JSON.stringify(rows)), '--json', saved).status).toBe(0);
  expect(JSON.parse(readFileSync(saved, 'utf8'))).toEqual(rows);
  const unknown = run('--wat', 'x');
  expect(unknown.status).toBe(2);
  expect(unknown.stderr).toContain('unknown argument: --wat');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test tests/evidence-cases.test.ts`
Expected: `0 pass`, `5 fail`. The received stderr is `error: Module not found "scripts/evidence-cases.mjs"`, because the script does not exist yet.

- [ ] **Step 3: Write the script**

Create `scripts/evidence-cases.mjs`:

```js
// scripts/evidence-cases.mjs
// Runs the compile-budget cases of docs/superpowers/plans/2026-09-21-00-swift-api-style-master.md
// ("Evidence") one after another, each in a fresh Node process, and prints a Markdown table.
//
//   node scripts/evidence-cases.mjs                                   run the twelve cases
//   node scripts/evidence-cases.mjs --compare <baseline.md>           add baseline and change columns; exit 1 over budget
//   node scripts/evidence-cases.mjs --counts 100                      run only the 100-operation cases
//   node scripts/evidence-cases.mjs --json <rows.json>                also save the raw rows
//   node scripts/evidence-cases.mjs --rows <rows.json> [--compare …]  render saved rows instead of running anything
//
// A case may grow by at most 10% over its baseline. Instantiation counts are deterministic;
// milliseconds and memory are recorded for information only.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { arch, cpus, release, totalmem, type as osType } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const budgetPercent = 10;
const namedForms = ['bulk', 'chained', 'grouped', 'replacement'];
const tokenForms = ['bindings', 'modules'];
const allowedCounts = [100, 500];

function fail(message) {
  console.error(message);
  process.exit(2);
}

function parseArguments(argv) {
  const options = { compare: undefined, rows: undefined, json: undefined, counts: allowedCounts, root: resolve(dirname(fileURLToPath(import.meta.url)), '..') };
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (value === undefined) fail(`usage: node scripts/evidence-cases.mjs [--compare <baseline.md>] [--counts 100,500] [--json <file>] [--rows <file>] [--root <dir>]`);
    if (flag === '--compare') options.compare = value;
    else if (flag === '--rows') options.rows = value;
    else if (flag === '--json') options.json = value;
    else if (flag === '--root') options.root = resolve(value);
    else if (flag === '--counts') {
      options.counts = value.split(',').map(Number);
      if (!options.counts.length || options.counts.some(count => !allowedCounts.includes(count))) fail('--counts accepts 100, 500 or 100,500');
    } else fail(`unknown argument: ${flag}`);
  }
  return options;
}

/** The cases in the order of the master plan: per count, the named forms, then the token forms. */
function evidenceCases(counts) {
  return counts.flatMap(count => [
    ...namedForms.map(form => ({ form, count, argv: ['scripts/benchmark-types.ts', '--worker', String(count), form, 'valid'] })),
    ...tokenForms.map(form => ({ form, count, argv: ['scripts/check-token-scale.ts', form, 'valid', String(count)] })),
  ]);
}

function runCase(root, item) {
  // The workers are TypeScript files that Node strips; never run them with the Bun that may be running this script.
  const node = process.versions.bun ? 'node' : process.execPath;
  const result = spawnSync(node, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', ...item.argv], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 10 * 60 * 1000 });
  const failure = result.error ? String(result.error) : result.status !== 0 ? `exit ${result.status ?? result.signal}: ${result.stderr.trim().split('\n').at(-1) ?? ''}` : undefined;
  if (failure) return { form: item.form, count: item.count, accepted: false, failure };
  let row;
  try { row = JSON.parse(result.stdout.trim().split('\n').at(-1) ?? ''); }
  catch { return { form: item.form, count: item.count, accepted: false, failure: 'the worker did not print a JSON row' }; }
  // The named worker reports `accepted`; the token worker reports only its diagnostics.
  const accepted = typeof row.accepted === 'boolean' ? row.accepted : Array.isArray(row.diagnostics) && row.diagnostics.length === 0;
  return {
    form: item.form, count: item.count, instantiations: row.instantiations, milliseconds: row.milliseconds, maxRssMiB: row.maxRssMiB,
    accepted: accepted && Number.isSafeInteger(row.instantiations), typescript: row.typescript, node: row.node,
  };
}

/** Read `| form | count | instantiations | …` rows from the first evidence table of a Markdown file. */
function readBaseline(path) {
  const baseline = new Map();
  let inTable = false;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (/^\|\s*Case\s*\|\s*Count\s*\|\s*Instantiations\s*\|/.test(line)) { inTable = true; continue; }
    if (!inTable) continue;
    if (!line.startsWith('|')) { if (baseline.size) break; continue; }
    const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
    const instantiations = Number((cells[2] ?? '').replaceAll(',', ''));
    if (/^\d+$/.test(cells[1] ?? '') && Number.isSafeInteger(instantiations) && instantiations > 0) baseline.set(`${cells[0]}@${cells[1]}`, instantiations);
  }
  if (!baseline.size) fail(`${path} has no evidence table (a header row starting with "| Case | Count | Instantiations |")`);
  return baseline;
}

const number = value => (Number.isFinite(value) ? value.toLocaleString('en-US') : 'n/a');
const percent = value => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

function render(rows, baseline) {
  const problems = [];
  const header = baseline
    ? ['| Case | Count | Instantiations | Baseline | Change | Milliseconds | Max RSS MiB | Accepted |', '| --- | --- | --- | --- | --- | --- | --- | --- |']
    : ['| Case | Count | Instantiations | Milliseconds | Max RSS MiB | Accepted |', '| --- | --- | --- | --- | --- | --- |'];
  const lines = rows.map(row => {
    const id = `${row.form} ${row.count}`;
    if (!row.accepted) problems.push(`${id}: not accepted${row.failure ? ` (${row.failure})` : ''}`);
    const measured = [number(row.milliseconds), number(row.maxRssMiB), row.accepted ? 'yes' : 'no'];
    if (!baseline) return `| ${row.form} | ${row.count} | ${number(row.instantiations)} | ${measured.join(' | ')} |`;
    const before = baseline.get(`${row.form}@${row.count}`);
    if (before === undefined) problems.push(`${id}: missing from the baseline`);
    const change = before === undefined || !Number.isFinite(row.instantiations) ? undefined : (row.instantiations - before) / before * 100;
    if (change !== undefined && change > budgetPercent) problems.push(`${id}: ${percent(change)} is over the ${budgetPercent}% budget`);
    return `| ${row.form} | ${row.count} | ${number(row.instantiations)} | ${number(before)} | ${change === undefined ? 'n/a' : percent(change)} | ${measured.join(' | ')} |`;
  });
  return { table: [...header, ...lines].join('\n'), problems };
}

function provenance(root, rows) {
  const git = args => spawnSync('git', args, { cwd: root, encoding: 'utf8' }).stdout.trim();
  const commit = git(['rev-parse', '--short', 'HEAD']) || 'unknown commit';
  const dirty = git(['status', '--porcelain', '--', 'src', 'tests', 'scripts']) ? ' with uncommitted changes under src, tests or scripts' : '';
  const first = rows.find(row => row.typescript) ?? {};
  return `Recorded ${new Date().toISOString()} at ${commit}${dirty} on ${osType()} ${release()}, ${arch()}, ${cpus().length} CPUs, ${Math.round(totalmem() / 1024 / 1024).toLocaleString('en-US')} MiB, Node ${first.node ?? process.version}, TypeScript ${first.typescript ?? 'unknown'}.`;
}

const options = parseArguments(process.argv.slice(2));
const rows = options.rows
  ? JSON.parse(readFileSync(options.rows, 'utf8'))
  : evidenceCases(options.counts).map(item => {
    console.error(`running ${item.form} ${item.count} …`);
    return runCase(options.root, item);
  });
if (options.json) writeFileSync(options.json, `${JSON.stringify(rows, null, 2)}\n`);
const { table, problems } = render(rows, options.compare ? readBaseline(options.compare) : undefined);
console.log(options.rows ? 'Rendered from saved rows.' : provenance(options.root, rows));
console.log('');
console.log(table);
if (problems.length) {
  console.error(`\n${problems.join('\n')}`);
  process.exitCode = 1;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test tests/evidence-cases.test.ts`
Expected: `5 pass`, `0 fail`.

- [ ] **Step 5: Run the six small cases for real**

Run: `node scripts/evidence-cases.mjs --counts 100`
Expected, after about 12 seconds: six `running … 100 …` lines on stderr, one `Recorded … at <commit> on Linux …, Node v24.20.0, TypeScript 6.0.3.` line, and this table. The instantiation counts are deterministic and must match exactly; milliseconds and memory will differ.

```
| Case | Count | Instantiations | Milliseconds | Max RSS MiB | Accepted |
| --- | --- | --- | --- | --- | --- |
| bulk | 100 | 159,001 | 1,115 | 363 | yes |
| chained | 100 | 787,814 | 1,617 | 407 | yes |
| grouped | 100 | 166,348 | 1,085 | 363 | yes |
| replacement | 100 | 1,031,260 | 1,546 | 408 | yes |
| bindings | 100 | 847,247 | 1,899 | 441 | yes |
| modules | 100 | 1,241,644 | 2,345 | 549 | yes |
```

The provenance line says `with uncommitted changes under src, tests or scripts` at this point, because the script and its test are not committed yet. That is expected here and must not appear in Task 4.

- [ ] **Step 6: Type-check and commit**

Run: `npm run typecheck`
Expected: exit 0.

```bash
git add scripts/evidence-cases.mjs tests/evidence-cases.test.ts
git commit -F - <<'MSG'
test(evidence): run and compare the twelve compile-budget cases

scripts/evidence-cases.mjs runs each case in a fresh Node process, prints a
Markdown table, and with --compare exits 1 when a case grows by more than
10% over a baseline table. Its test renders saved rows, so the fast lane
never starts the compiler.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

---

### Task 4: Record the 0.4.0 baseline

**Files:**
- Create: `docs/superpowers/plans/evidence/baseline.md`

**Interfaces:**
- Consumes: `scripts/evidence-cases.mjs` from Task 3.
- Produces: the baseline table that `--compare` reads in every later phase. Its path is fixed by the master plan.

- [ ] **Step 1: Make sure the tree is clean and the source is 0.4.0**

```bash
git status --short                       # expect: no output
git diff --stat v0.4.0 -- src | tail -1  # expect: no output
```

- [ ] **Step 2: Run the twelve cases**

Do not run anything else heavy at the same time; the 500-operation cases use up to 2.3 GB each and the whole run takes about 75 seconds.

```bash
mkdir -p docs/superpowers/plans/evidence
node scripts/evidence-cases.mjs > /tmp/evidence-baseline-table.md
echo "exit=$?"
cat /tmp/evidence-baseline-table.md
```

Expected: `exit=0`, a `Recorded …` line without the words `uncommitted changes`, and twelve rows that all end in `yes`. The instantiation counts must be exactly:

| Case | 100 | 500 |
| --- | --- | --- |
| bulk | 159,001 | 806,601 |
| chained | 787,814 | 13,956,214 |
| grouped | 166,348 | 1,060,372 |
| replacement | 1,031,260 | 21,767,660 |
| bindings | 847,247 | 12,153,047 |
| modules | 1,241,644 | 19,719,044 |

If a count differs, `src/`, `tests/compiler.ts` or the TypeScript version differs from what this plan was written against. Check `git diff v0.4.0 -- src tests/compiler.ts` and `node -p "require('typescript').version"` (expect `6.0.3`), and report the difference instead of recording a baseline you cannot explain.

- [ ] **Step 3: Write the baseline file**

````bash
{
  cat <<'HEAD'
# Compile-cost baseline: 0.4.0 source

The compile budget of the
[Swift API style program](../2026-09-21-00-swift-api-style-master.md#evidence):
across all phases, the instantiation count of each case below may grow by at
most 10% over this table. Instantiation counts are deterministic. Milliseconds
and memory depend on the host and are recorded for information only.

The table was produced by `node scripts/evidence-cases.mjs` at the unchanged
0.4.0 library source. Each case is one fresh Node process: the named forms run
`scripts/benchmark-types.ts --worker <count> <form> valid`, and `bindings` and
`modules` run `scripts/check-token-scale.ts <form> valid <count>`. The named
worker reports `accepted` itself; for the token worker, accepted means that it
reported no diagnostics.

Compare the current source with this baseline, and fail when a case is over
budget:

```sh
node scripts/evidence-cases.mjs --compare docs/superpowers/plans/evidence/baseline.md
```

HEAD
  cat /tmp/evidence-baseline-table.md
} > docs/superpowers/plans/evidence/baseline.md
````

- [ ] **Step 4: Verify that the file compares cleanly with itself**

Run: `node scripts/evidence-cases.mjs --counts 100 --compare docs/superpowers/plans/evidence/baseline.md`
Expected: exit 0, and the `Change` column reads `0.0%` in all six rows.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/evidence/baseline.md
git commit -F - <<'MSG'
docs(plans): record the 0.4.0 compile-cost baseline

Twelve cases, six forms at 100 and 500 operations. Every later phase of the
Swift API style program compares against this table with a 10% budget.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

---

### Task 5: The naming guide

**Files:**
- Create: `docs/guides/api-naming.md`
- Modify: `tools/docs/vitepress.config.mjs` (the `Contribute` group of the `guide` array)
- Modify: `docs/README.md` (the `## Contribute` table)
- Modify: `docs/guides/documentation.md` (the table that says where each kind of documentation is edited)

**Interfaces:**
- Consumes: the files of Tasks 1 to 4, which the guide links to.
- Produces: the section `## Measured exceptions` with an empty table whose columns are `Shape in the design note`, `Fallback taken`, `Measurement that forced it`, `Recorded in`. Later phases append one row per fallback. The anchors `#vocabulary`, `#term-and-description-values` and `#measured-exceptions`.

Two deliberate differences from the spec's wording, both reported to the controller: rule 1 uses `verifyGraphAtCompileTime` as its example, because the spec's example `resolveAllContributions` was later removed by the collection token decision; and rule 6 leaves out `isOwnedByBag`, because "bag" is a retired concept word in the same spec and the naming test will reject it. Do not add either name back.

- [ ] **Step 1: Write the guide**

Create `docs/guides/api-naming.md` with exactly this content:

````markdown
# API naming standard

[Documentation map](../README.md) · [Documentation maintenance](documentation.md) · [Glossary](../../CONTEXT.md)

This guide is for contributors. Every public name of DI Bag follows it: methods,
options, string values, error codes, exported types, and the parameter names that
show up in editor hints. The library is written mostly by and for coding agents,
and an agent reads names before it reads a guide, so the names are the primary
documentation.

The standard is the
[Swift API Design Guidelines](https://www.swift.org/documentation/api-design-guidelines/),
translated to TypeScript. The
[W3C Web Platform Design Principles](https://www.w3.org/TR/design-principles/)
are the secondary source for option dictionaries and string values. The decision
and the complete 0.4.0 to 0.5.0 rename map are recorded in the
[Swift API style design note](../superpowers/specs/2026-09-20-swift-api-style.md).

## From Swift to TypeScript

Swift has argument labels and TypeScript does not, so the rules are translated:

| Swift | TypeScript in DI Bag |
| --- | --- |
| Argument label | Property name in an options bag |
| Omitted first label, because the argument reads as a phrase with the method name | Positional first parameter |
| Defaulted parameter | Optional property of the options bag |
| Non-mutating counterpart of a verb, `sorted` for `sort` | `with…` prefix, as in `Array.prototype.with` and this library's own facade |
| Factory method prefix `make` | `create`, because JavaScript precedent is `createElement` and "Embrace precedent" decides it |

## The rules

Quotations are from the Swift guidelines unless a rule names the W3C principles.

1. **Clarity at the point of use.** "Clarity at the point of use is your most
   important goal", and "Clarity is more important than brevity." Long names are
   fine. "Include all the words needed to avoid ambiguity":
   `verifyGraphAtCompileTime`, never `verifyGraph`, because the call does nothing
   when it runs.
2. **Every word carries information.** "Omit needless words. Every word in a name
   should convey salient information at the use site." `resolve` stays `resolve`,
   because adding "Service" says nothing new at the call site.
3. **Effects decide the part of speech.** "Those with side-effects should read as
   imperative verb phrases": `ensureServicesReady`, `close`. "Those without
   side-effects should read as noun phrases": `graphSnapshot()`. A method that
   returns a modified copy is named `with…`: `withServices`. Every builder method
   returns a new builder, so every builder method that adds to the graph is a
   `with…` method.
4. **Parameter shape follows the count of required inputs.** W3C:
   ["Accept optional and/or primitive arguments through dictionaries"](https://www.w3.org/TR/design-principles/#prefer-dictionaries)
   and ["Make method arguments optional if possible"](https://www.w3.org/TR/design-principles/#optional-parameters).
   Swift: omit the first label when the argument "forms part of a grammatical
   phrase", and "Label all other arguments."
   - None required: one optional options bag.
   - Exactly one required, and it reads as a phrase with the method name: that
     input positional, then a bag in which every property is optional.
     `ensureServicesReady(serviceKeys, options?)`.
   - Two or more required: one bag with named properties.
     `withServiceAlias({ aliasKey, targetServiceKey })`.
   - A builder method with two or more inputs takes one bag with named
     properties. `withInstalledModules(modules)` keeps its single positional
     input: the list reads as a phrase with the method name, and a bag that only
     wraps one value adds nothing. An optional bag can follow it later without
     breaking callers. `withServices` takes a bag by nature: it maps each service
     name to its provider.
   - Never two positional parameters. When the single required input does not read
     as a phrase with the method name, it goes into the bag under its role name:
     `buildModule({ exportedServiceKeys })`, because "build module greeter" says the
     wrong thing.
5. **Names state role, subject and unit.** "Name variables, parameters, and
   associated types according to their roles, rather than their type
   constraints." W3C:
   ["Name optional arguments appropriately"](https://www.w3.org/TR/design-principles/#naming-optional-parameters).
   `abortSignal`, `totalTimeoutMs`, `maxConcurrentServiceKeys`. This includes
   generic parameters and the parameter names of callbacks shown in
   documentation.
6. **Booleans read as assertions.** "Uses of Boolean methods and properties should
   read as assertions about the receiver when the use is nonmutating".
   `isPresent`, `allowsScopedDependencies`, `factoryReceivesContext`. The
   asserting verb is `is`, `has`, `allows` or `receives`, and it may follow its
   subject.
7. **No abbreviations.** "Avoid abbreviations." `factoryContext`, `dependencies`.
   The unit suffix `Ms` is kept as established precedent.
8. **Terms of art keep their established meaning.** "Stick to the established
   meaning if you do use a term of art", and "Embrace precedent." `resolve`,
   `container`, `child container`, `provider`, `token`. "Don't surprise an
   expert": a name borrowed from other containers must behave as it does there. A
   string value that has an established term carries it together with its
   description, as [`term:description`](#term-and-description-values).
9. **Common words before library words.** "Avoid obscure terms if a more common
   word conveys meaning just as well." W3C:
   ["Use common words"](https://www.w3.org/TR/design-principles/#naming-common-words).
   "Acquisition" names observability data only: snapshots, events, and the
   metadata an author attaches for them. It never names how a factory is written
   or how its result is treated.
10. **One word per concept.** W3C:
    ["Name things consistently"](https://www.w3.org/TR/design-principles/#naming-consistency).
    The [vocabulary](#vocabulary) is the dictionary and
    [`CONTEXT.md`](../../CONTEXT.md) holds the definitions.
11. **One casing per kind.** Identifiers are camelCase, types are PascalCase,
    runtime codes are `DI_BAG_SCREAMING_SNAKE`, and every string value is
    kebab-case, with one colon where rule 8 joins a term to its description.
12. **Methods before free functions.** "Prefer methods and properties to free
    functions." A facade function remains only when there is no object to hang it
    on.
13. **The summary test.** "If you are having trouble describing your API's
    functionality in simple terms, you may have designed the wrong API." A summary
    that needs "or" between two purposes marks a call to split.
14. **One way per task.** The
    [API card's table](../agent/api-card.md#one-way-per-task) names one call per
    task. When this standard offers two shapes for one task, one is chosen and the
    other is not shipped.
15. **Exceptions are measured.** A shape that the compiler cannot support within
    budget falls back to its previous form. The exception is recorded under
    [Measured exceptions](#measured-exceptions) with the measurement that forced
    it.

## Term and description values

A string value that has an established term of art is written `term:description`.
The term leads, so an expert finds it and an editor completes it after two
letters. The description removes the doubt about what the term means in this
library. Both halves are kebab-case and one colon joins them.

```ts
provider.withLifetime('singleton:one-per-container-tree'); // the default, rarely written
provider.withLifetime('scoped:one-per-container');
provider.withLifetime('transient:one-per-resolve');
```

Only the full value is accepted. `'scoped'` alone is rejected with a message that
names `'scoped:one-per-container'`, because two spellings of one value would break
rule 14. The pattern applies only where an established term exists. Today that is
the three lifetimes.

## Vocabulary

One word per concept. A retired word does not appear in a public name, a string
value or an error code.

| Concept | Word | Retired words |
| --- | --- | --- |
| The value other code receives | service | |
| Name or typed token that identifies a service | service key | key, name, selection |
| Declaration of how a service is obtained | provider | registration, when it means the value |
| A provider stored under a service key in a builder | registration | |
| A registration's node in a built graph, public or module-private | binding | |
| One attempt to obtain a service from a binding | acquisition, observability only | |
| Releasing an owned value | disposal, disposer | cleanup |
| How a factory's return value is treated | factory return kind | acquisition mode, mode |
| What a decorator callback is handed | callback receives | direct, awaited |
| Waiting until listed services exist and are settled | service readiness | startup, start |
| A resolvable set of services with its own cache and ownership | container | bag, as a concept word. `DiBag` stays the product and facade name, and "bag" now only means an options bag |
| One instance for a root container and all its child containers, the default | `'singleton:one-per-container-tree'` | root |
| One instance in each container that resolves it | `'scoped:one-per-container'` | |
| A new instance for every resolve and every dependency read | `'transient:one-per-resolve'` | |
| A root container and all its child containers | container tree | family, ownership family |
| A provider appended to a collection token's list | contribution | |
| Token that identifies exactly one service | single-service token | |
| Token that identifies an ordered list of services | collection token | the `all` reference, the contribution channel |
| A container nested in a parent for one unit of work | child container | scope, child scope |
| A container made from another's providers that shares no instance with it | independent container | fork, bag fork |

## What the naming test checks

[`tests/api-naming.test.ts`](../../tests/api-naming.test.ts) enforces the rules a
machine can judge. It reads the public surface with the TypeScript compiler API,
starting from the exports of `src/index.ts` and following every type reference
into `src/`. The public surface is what that walk reaches: exported names, member
names, parameter names and string values. Function bodies, constructors' plain
parameters, private members, `#private` names, symbol-keyed members and members
tagged `@internal` are not public. Names of helper types that are not exported
from `src/index.ts` are not checked, but their members, parameters and values
are, because they show up in editor hints and compiler messages.

| Check | Rule | What fails |
| --- | --- | --- |
| `builder-method-prefix` | 3 | A callable public member of `Builder` that does not start with `with`, `build` or `verify` |
| `boolean-name` | 6 | A member typed `boolean`, `true` or `false` with none of the words `is`, `has`, `allows`, `receives` |
| `abbreviation` | 7 | An exported name, member or parameter with one of the words `ctx`, `deps`, `opts`, `cfg` |
| `value-casing` | 11 | A string value that is neither kebab-case nor `term:description`, or a `DI_BAG_` code in `src/` that is not `SCREAMING_SNAKE` |
| `retired-word` | 10 | An exported name, member, parameter, string value or `DI_BAG_` code with one of the words `cleanup`, `startup`, `start`, `bag`, `root`, `family`, `scope`, `fork`, `mode`, `direct`, `awaited`, `all` |

Words are whole words of a camelCase, kebab-case or snake-case name, so
`acquisition-started` does not contain `start` and `scoped` is not `scope`. The
product prefix `DiBag` and the code prefix `DI_BAG_` are not words. The retired
words "key", "name", "selection", "registration" as a value, and "acquisition"
outside observability cannot be judged by a machine. Reviewers judge them, and
they judge rules 1, 2, 4, 5, 9, 12, 13 and 14.

The test is a ratchet.
[`tests/api-naming-known-violations.json`](../../tests/api-naming-known-violations.json)
lists the violations that existed in 0.4.0. A violation that is not listed fails
the test, and so does a listed violation that no longer occurs, so the list can
only shrink. It must be empty when phase 11 of the
[Swift API style program](../superpowers/plans/2026-09-21-00-swift-api-style-master.md)
ends, and it stays empty afterwards. After fixing names, shrink the list:

```sh
UPDATE_API_NAMING_VIOLATIONS=1 bun test tests/api-naming.test.ts
```

That mode only removes entries. A new violation is fixed by renaming, never by
listing it.

## Measured exceptions

Rule 15 allows a shape to fall back to its previous form when the compiler cannot
support it within the compile budget: a case of
[`scripts/evidence-cases.mjs`](../../scripts/evidence-cases.mjs) may grow by at
most 10% in instantiations over
[the 0.4.0 baseline](../superpowers/plans/evidence/baseline.md). Each exception is
one row here, added by the change that takes the fallback.

| Shape in the design note | Fallback taken | Measurement that forced it | Recorded in |
| --- | --- | --- | --- |

No exception has been recorded.
````

- [ ] **Step 2: List the guide in the sidebar**

In `tools/docs/vitepress.config.mjs`, replace

```js
  { text: 'Contribute', items: [
    { text: 'Development', link: '/guides/development' },
    { text: 'Writing and publishing docs', link: '/guides/documentation' },
  ] },
```

with

```js
  { text: 'Contribute', items: [
    { text: 'Development', link: '/guides/development' },
    { text: 'API naming standard', link: '/guides/api-naming' },
    { text: 'Writing and publishing docs', link: '/guides/documentation' },
  ] },
```

- [ ] **Step 3: List the guide in the documentation map**

In `docs/README.md`, in the table under `## Contribute`, insert this row directly after the `| [Development](guides/development.md) | … |` row:

```markdown
| [API naming standard](guides/api-naming.md) | Name a public method, option, string value, error code, or type; see what the naming test enforces. |
```

- [ ] **Step 4: Say where names are decided**

In `docs/guides/documentation.md`, insert this row directly before the `| Site navigation and appearance | … |` row:

```markdown
| The name of a public method, option, string value, error code, or type | [api-naming.md](api-naming.md); `tests/api-naming.test.ts` enforces the mechanical rules |
```

- [ ] **Step 5: Verify the documentation checks**

Run: `npm run docs:check`
Expected: exit 0. The last three lines are `Generated API Markdown and the API card are current; all entry points and callable overloads are covered.`, `Agent docs are consistent: 112 snippets type-check against the emitted declarations.` and `Prepared 130 Markdown pages; repository-only links point to GitHub.` (one page more than the 129 on `next`).

If it fails with `docs/guides/api-naming.md: missing documentation link …`, the linked file of an earlier task is missing or misnamed. Fix the file name, not the link.

- [ ] **Step 6: Build the site once to check anchors and the sidebar**

Run: `npm run docs:build 2>&1 | tail -5`
Expected: exit 0, a VitePress `build complete` line, and a last line of the form `Verified <n> rendered pages and <m> internal links, anchors, assets, and message URLs.` That check fails on a dead internal link or a missing anchor, which covers `#vocabulary`, `#term-and-description-values`, `#measured-exceptions` and the link to the API card's `#one-way-per-task`. If `tools/docs/node_modules` is missing, run `npm ci --prefix tools/docs --no-audit --no-fund` first. Do not commit anything under `tools/docs/site`; it is ignored.

- [ ] **Step 7: Commit**

```bash
git status --short   # expect only the four files of this task
git add docs/guides/api-naming.md tools/docs/vitepress.config.mjs docs/README.md docs/guides/documentation.md
git commit -F - <<'MSG'
docs(guides): the API naming standard

The Swift API Design Guidelines translated to TypeScript: fifteen rules with
their sources, term:description values, the vocabulary, what the naming test
checks, and the table for measured exceptions.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

---

### Task 6: Bring the glossary in line with the vocabulary

**Files:**
- Modify: `CONTEXT.md`

**Interfaces:**
- Consumes: the vocabulary table of the spec, which the guide of Task 5 repeats.
- Produces: a definition in `CONTEXT.md` for every word of that table. Rule 10 of the standard says the vocabulary is the dictionary and `CONTEXT.md` holds the definitions.

`CONTEXT.md` is a glossary and nothing else: a term, one or two sentences that say what it is, and an `_Avoid_` line for retired words. It runs ahead of the 0.4.0 code on purpose. It already defines container, child container, container tree, independent container and the three lifetimes. Missing are service key, registration, binding, disposal, factory return kind, callback receives, service readiness, contribution, single-service token and collection token, and the prose still says "cleanup" in five places. No test reads `CONTEXT.md`.

- [ ] **Step 1: Retire "cleanup" from the prose**

Make these five replacements. Each left side occurs exactly once.

| Replace | With |
| --- | --- |
| `dependencies, lifetime, metadata, and existing cleanup obligations. The` | `dependencies, lifetime, metadata, and existing disposal obligations. The` |
| `acquisitions may use the same provider and have distinct cleanup obligations.` | `acquisitions may use the same provider and have distinct disposal obligations.` |
| `A successfully acquired value whose cleanup responsibility was explicitly` | `A successfully acquired value whose disposal was explicitly` |
| `_Avoid_: Disposable object when merely having a cleanup method is meant` | `_Avoid_: Disposable object when merely having a disposal method is meant` |
| `A value used without accepting responsibility for its cleanup. Its actual` | `A value used without accepting responsibility for its disposal. Its actual` |

After the third replacement the entry must read:

```markdown
**Owned resource**:
A successfully acquired value whose disposal was explicitly
accepted by a container or another application owner.
_Avoid_: Disposable object when merely having a disposal method is meant
```

- [ ] **Step 2: Add the token kinds and the service key after the Token entry**

Directly after the block

```markdown
**Token**:
The identity by which a provided service and its consumers agree on a
dependency.
_Avoid_: Alias when identity rather than an alternative name is intended
```

insert, separated by one blank line before and after:

```markdown
**Single-service token**:
A token that identifies exactly one service.
_Avoid_: Plain token when the kind matters

**Collection token**:
A token that identifies an ordered list of services built from contributions.
Reading it yields the list.
_Avoid_: The `all` reference, contribution channel

**Contribution**:
A provider appended to a collection token's list. Each contribution keeps its
own dependencies, lifetime and disposal.
_Avoid_: Collection member when the provider is meant

**Service key**:
The name or token by which a service is registered, required and resolved.
_Avoid_: Key or name alone, selection
```

- [ ] **Step 3: Add registration and binding after the Module entry**

Directly after the block that ends with `_Avoid_: Container when referring to a reusable declaration; Builder when referring to the sealed value`, insert:

```markdown
**Registration**:
A provider stored under a service key in a builder.
_Avoid_: Registration when the provider itself is meant

**Binding**:
A registration's node in a built service dependency graph, public or private to
a module. An acquisition is an attempt against one binding.
_Avoid_: Registration when a node of a built graph is meant
```

- [ ] **Step 4: Add the factory and readiness words after the Acquisition stage entry**

Directly after the block that ends with `_Avoid_: Factory when referring to a later transformation result`, insert:

```markdown
**Factory return kind**:
How a factory's return value is treated: inspected for a native Promise, taken as
a synchronous value, taken as a native Promise, or left uninspected.
_Avoid_: Acquisition mode, mode

**Callback receives**:
The choice of what a provider decorator's callback is handed: the service exactly
as exposed, or its fulfilled value.
_Avoid_: Direct, awaited, mode

**Service readiness**:
The state in which listed services exist and their acquisitions have settled. A
caller waits for it before other work continues.
_Avoid_: Startup, start
```

- [ ] **Step 5: Add disposal after the Borrowed resource entry**

Directly after the block that ends with `_Avoid_: Unmanaged resource`, insert:

```markdown
**Disposal**:
Releasing an owned resource when its container closes or its acquisition fails. A
disposer is the callback that does it.
_Avoid_: Cleanup, teardown
```

- [ ] **Step 6: Verify the glossary**

```bash
grep -n -i "cleanup\|startup\|acquisition mode" CONTEXT.md | grep -v "_Avoid_"
```

Expected: no output. The three retired words remain only on `_Avoid_` lines.

```bash
for term in "Service key" "Registration" "Binding" "Disposal" "Factory return kind" "Callback receives" "Service readiness" "Container" "Container tree" "Contribution" "Single-service token" "Collection token" "Child container" "Independent container" "Singleton" "Scoped" "Transient" "Provider" "Service" "Acquisition"; do
  grep -q "^\*\*$term\*\*:" CONTEXT.md || echo "missing: $term"
done
```

Expected: no output.

```bash
grep -c "^\*\*" CONTEXT.md
```

Expected: `35` (25 entries before this task plus 10 new ones).

- [ ] **Step 7: Commit**

```bash
git add CONTEXT.md
git commit -F - <<'MSG'
docs(glossary): define every word of the naming vocabulary

Adds service key, registration, binding, disposal, factory return kind,
callback receives, service readiness, contribution and the two token kinds,
and retires "cleanup" from the prose.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

---

### Task 7: Phase gate and report

**Files:** none.

**Interfaces:**
- Consumes: everything above.
- Produces: the phase report for the controller.

- [ ] **Step 1: Run the full gate list, in this order**

```bash
npm run check 2>&1 | tee /tmp/phase-00-check.log | tail -15
```

Expected: exit 0 after about ten minutes. The fast lane reports `546 pass` and `0 fail` (538 before this phase, plus 3 in `tests/api-naming.test.ts` and 5 in `tests/evidence-cases.test.ts`). The compiler lane reports `575 pass` and `0 fail`. Confirm with `grep -E "^\s*[0-9]+ (pass|fail)" /tmp/phase-00-check.log`.

```bash
npm run docs:check 2>&1 | tail -3
npm run graph:check 2>&1 | tail -5
npm run typecheck:native 2>&1 | tail -3
npm run build:native 2>&1 | tail -3
npm run check:native 2>&1 | tail -3
for example in examples/*.ts; do bun run "$example" > /dev/null || { echo "FAILED: $example"; break; }; done; echo examples done
npm run build 2>&1 | tail -2
```

Expected: every command exits 0, `docs:check` ends with `Prepared 130 Markdown pages; repository-only links point to GitHub.`, no `FAILED:` line, and `examples done`. The final `npm run build` restores the classic build of `dist/` after the native one. If `npm run graph:check` fails because `tools/graph/node_modules` is missing, run `npm ci --prefix tools/graph --no-audit --no-fund` and repeat.

A compiler-lane timeout is a flake only if `bun test <that file>` passes when run alone. Report it; do not change the test.

- [ ] **Step 2: Confirm the branch content**

```bash
git status --short            # expect: no output
git log --oneline next..HEAD  # expect: six commits, one per task 1 to 6
git diff --stat next -- src   # expect: no output
```

- [ ] **Step 3: Report to the controller**

Reply in under 60 lines with: the branch name `phase-00-naming-guide-and-baseline`; the output of `git log --oneline next..HEAD`; the last lines of each gate command; the twelve baseline instantiation counts; the number of known violations (61); any flake; and anything that deviated from this plan, with the reason. Include these three notes for the controller, which come from the planning of this phase:

1. The spec names `isOwnedByBag` in rule 6 and in the snapshot table. "bag" is a retired word in the same spec, so the naming test will reject that name in phase 11. `isOwnedByContainer` fits the vocabulary; the spec needs the correction before phase 11 is planned.
2. The ratchet also lists names the spec's rename map does not spell out, because they contain a retired word: the exported types `CheckedScopeLifetimes`, `DisjointScopeSelection` and `ScopeEventFields`, the member `root` and the values `'root'` and `'root-reach'` of `LifetimeObligation`, and the parameter `modeOptions`. The phases that own those areas must choose names for them.
3. The master plan's "Evidence" section says both workers print `accepted`. Only the named worker does; `scripts/evidence-cases.mjs` derives it for the token cases.

Do not push, merge or publish.

---

## Self-Review

**Spec coverage.** The master plan's phase 0 row asks for `docs/guides/api-naming.md` (Task 5), the naming test with its known-violations ratchet (Tasks 1 and 2), and the evidence baseline (Tasks 3 and 4). The spec's roadmap row for phase 0 also names the `CONTEXT.md` vocabulary (Task 6) and the four checks of the naming test, `with…` on builder methods, assertion-style booleans, kebab-case string values and an abbreviation denylist, all in Task 1 together with the retired-word check the controller added. The spec's "Shapes decided by measurement" and rule 15 need a place to record exceptions: the "Measured exceptions" table of Task 5 and the comparison mode of Task 3. The master plan's "Evidence" commands are exactly what `evidenceCases` runs in Task 3.

**Placeholder scan.** Every code step contains the complete file. Every command has its expected output. The baseline numbers are the ones measured at commit `0e3a946` on `next`, which has the 0.4.0 `src`.

**Type consistency.** `collectFindings(root)` and `words(identifier)` have the same signatures in the scanner, in both versions of the test, and in the interfaces blocks. Finding ids use the same five rule names and the same subject forms in the scanner, the fixture expectation, the recorded list and the guide's table. The script's flags `--compare`, `--counts`, `--json`, `--rows` and `--root` are the ones the test passes, and the table header that `readBaseline` looks for is the header that `render` prints. The environment variable is spelled `UPDATE_API_NAMING_VIOLATIONS` everywhere.

**Verified before writing.** The scanner, the fixture, both versions of the test, the ratchet's shrink-only behavior, the script, its test, a real run of all twelve cases, the strict type-check of every new TypeScript file, and the resolution of every relative link of the guide were all run in a scratch copy against the current source.
