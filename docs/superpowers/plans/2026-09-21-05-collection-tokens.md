# Collection Tokens Implementation Plan

> **Planning review accepted:** see `handoff/resume-2026-09-21.md`. Execution still requires the master plan entry state and lifted phase-gate hold; uncompiled signatures and predicted results below remain executor obligations.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a token either a single-service token or a collection token, never both: add `DiBag.token(key).forCollectionOf<Item>()`, read a collection through `resolve`, `inspect`, `ensureServicesReady`, dependency lists, `lazy` and alias targets, let `fork`, `createScope` and `replace` swap a whole list, and remove `DiBag.all`, `bag.resolveAll`, `bag.inspectAll`, `CollectionDependency` and the dependency kind `'all'`.

**Architecture:** A second token class, `CollectionToken<TokenSymbol, Item>`, is authenticated by the same WeakMap in `src/tokens.ts`, which now also records the kind. At run time a collection symbol never gets a public slot from `contribute`; every read (`resolve`, `acquire`, `inspect`, the dependency proxy, an alias) asks one helper that uses the replacement's public slot when present and the contribution list otherwise. A replacement provider caches and owns its original list normally, while every exposed collection read receives a fresh frozen shallow copy. At compile time contributions stay in the builder's constraint parameter; `resolve` and `inspect` gain one conditional on the token kind (spike S5), dependency tuples route a collection token into the graph contract's collection member, and replacement signatures see a collection token as a synthetic slot of the registrations map. The contract step adds graph-scoped kind claims after migration, so one graph cannot restore the two channels under one symbol. The phase follows expand, migrate, contract: both kinds are accepted by `contribute`, `all`, `resolveAll` and `inspectAll` until every call site has moved.

**Tech Stack:** TypeScript 6.0.2 (`tsc6`) and 7.0.2 (`tsc`), Bun 1.4.0 (`bun test`), Node 24.20.0, `tools/codemod` from phase 1, TypeDoc under `tools/docs`, `scripts/evidence-cases.mjs` from phase 0.

**Spec:** `docs/superpowers/specs/2026-09-20-swift-api-style.md`, sections "Collection tokens" (under "Behavior changes"), "Facade", "Builder" and "Container" rows for `all`, `contribute`, `resolveAll`, `inspectAll`, "Snapshots and events" (the `tokenDependencies` row), "Errors" (`DI_BAG_WRONG_TOKEN_KIND`), "Exported types" (`CollectionDependency`), "Shapes decided by measurement" (S5) and "Migration support". Worked examples 4, 7 and 8 in `docs/superpowers/specs/2026-09-20-swift-api-style-examples.md`. Read `docs/superpowers/plans/2026-09-21-00-swift-api-style-master.md` first: its protocol, environment, commit format, evidence rules and gate list apply to every task here. This is phase 4 of its phase table. The spec's names win over anything written here.

## Global Constraints

- This is phase 4 of the master plan. Branch: `phase-04-collection-tokens`, cut from `next`. Executors never push, publish, merge, or edit the spec.
- Names introduced here are final 0.5.0 names from the spec: `forCollectionOf`, `CollectionToken`, `DI_BAG_WRONG_TOKEN_KIND`, and the two kind values `'single-service'` and `'collection'` (the spec's vocabulary words "single-service token" and "collection token", in kebab-case). Do not shorten or vary them.
- Support types this plan adds are not in the spec, so the plan names them, and they follow the naming guide: `CollectionTokenBase`, `CollectionItem`, `CollectionSelection`, `SingleServiceTokenAdmission`, and `CollectionTokenAdmission`. If the naming test rejects one, choose another compliant name; never add a violation to the list.
- Names that are NOT changed in this phase, even though later phases change them: `DiBag.token`, `.of<S>()`, `token.key`, `register`, `contribute`, `alias`, `replace`, `installModule`, `build`, `buildModule`, `resolve`, `inspect`, `inspectGraph`, `fork`, `createScope`, the class `Bag`, the snapshot fields `tokenDependencies[].key` and `.kind`, `contributions[].token`, and the codes `DI_BAG_INVALID_OVERRIDE`, `DI_BAG_INVALID_SCOPE`, `DI_BAG_INVALID_REPLACEMENT`, `DI_BAG_INVALID_STARTUP`, `DI_BAG_INVALID_EXPORT`. Leave every one of them alone.
- A NEW validation site in this phase raises `DI_BAG_WRONG_TOKEN_KIND` with `details: { operation, expectedKind, receivedKind }`. `operation` is the method name as it is in this phase (`register`, `alias`, `contribute`, `optional`, `createScope`, `buildModule`); each later rename phase updates it.
- Every library error message keeps the form `DI_BAG_CODE: message; see <errors page>#<anchor>`, and every single-quoted `'DI_BAG_*'` literal in `src/` has exactly one section in `docs/agent/errors.md`. `npm run docs:check` enforces both directions, so the code and its section land in the same commit. Keep the literal on the same line as its `libraryError(` call: the inventory script of phase 11 reads it that way.
- Compile budget: the twelve evidence cases may grow by at most 10% in total across all phases (master plan). This phase touches hot signatures (`resolve`, `register`, `fromFunction`), so it measures twice: after the expand step, which is spike S5, and after the contract step.
- Every compile-time signature in this plan is UNCOMPILED (master plan, assumption 11): it was designed by reading the code, and the TypeScript compiler was not run. Each task that changes types lists the positive and negative cases that must hold. Compile them first. When a signature does not hold, repair it within the names above; after three serious attempts, or over budget, take the fallback of Task 5.
- `AGENTS.md` is at its 150-line budget. This phase does not edit it.
- The package keeps zero runtime dependencies, and `src/index.ts` must not import a `node:` module.
- Never delete, skip or weaken a test or a negative fixture to get green. A failing assertion on a message this phase did not touch is a behavior change to report.
- Environment for every command (master plan, "Environment"):

```bash
export PATH="<the directory that holds Bun 1.4.0>/bin:$PATH"
export npm_config_update_notifier=false
bun --version   # 1.4.0
node --version  # v24.20.0
```

## What was run for this plan, and what was not

Written on 2026-09-21 against the 0.4.0 source (`src/` is unchanged on `next` since `v0.4.0`), with Bun 1.4.0 and Node 24.20.0.

Evidence provenance is explicit. The prototype source was inherited from the interrupted planner under `/tmp/claude-1000/-home-df-wd-personal-di-bag/7818417c-3b3a-48db-9bef-85624eff953b/scratchpad/p05b`; no `zz-*` probe survives under the assigned archive. This finishing planner freshly reran the original 15-test runtime command, the two-file codemod command, and then a 16-test runtime copy with the graph-scoped symbol-kind regression. `/tmp/di-bag-resume-20260921/probe-05/plan-evidence.txt` records their exact working directories, commands and concise results. The remaining bullets explicitly identify historical inherited results.

**Run.**

- Historical inherited result: a probe at the unmodified 0.4.0 source (4 tests, 21 assertions, all passed) confirmed what this phase changes: for a token that only has contributions, `resolve` and `inspect` throw `DI_BAG_MISSING_REGISTRATION`, `fork` throws `DI_BAG_INVALID_OVERRIDE`, `createScope` (keys and `share`) throws `DI_BAG_INVALID_SCOPE`, `replace` throws `DI_BAG_INVALID_REPLACEMENT`, `buildModule` throws `DI_BAG_INVALID_EXPORT`, `buildAndStart` rejects with `DI_BAG_INVALID_STARTUP`; a bare token, `lazy` and an alias read only the single channel (`DI_BAG_MISSING_DEPENDENCY`), `optional` yields `undefined`; with one token on both channels `resolveAll` and an `all` reader ignore the public slot; `Object.keys(DiBag.token(key))` is `['of']`. Its temporary `zz-*` file had already been deleted, so treat this bullet as historical context rather than freshly reproducible evidence.
- The runtime edits of Tasks 1 to 3 (expand) and Task 8 (contract) were applied to two scratch copies of `src/`: expand at `/tmp/claude-1000/-home-df-wd-personal-di-bag/7818417c-3b3a-48db-9bef-85624eff953b/scratchpad/p05b/repo`, contract at the sibling `p05b/contract`. `bun test` does not type-check, so this proves behavior only. Because phase 3 had not been executed, the expand copy got a stand-in `Bag.ensureServicesReady(serviceKeys)` with the key loop of the phase 3 plan and no options; the collection branch of Task 2 Step 6 was applied to that stand-in.
- Fresh rerun: from the expand path above, `/tmp/claude-1000/-home-df-wd-personal-di-bag/7818417c-3b3a-48db-9bef-85624eff953b/scratchpad/bun/bin/bun test tests/collection-tokens.test.ts` reports 15 pass, 0 fail and 89 `expect()` calls. The complete source is `p05b/repo/tests/collection-tokens.test.ts`; the concise log is `/tmp/di-bag-resume-20260921/probe-05/plan-evidence.txt`.
- Fresh regression rerun: the independently retained copy at `/tmp/di-bag-resume-20260921/probe-05/symbol-kind-runtime` adds a graph-scoped persistent kind claim, the Task 8 same-symbol regression, and fresh frozen views over a replacement's owned original list. The same Bun command there reports 16 pass, 0 fail and 101 `expect()` calls. It proves the extra contract behavior in isolation; the complete final contract suite remains executor work.
- On the expand copy the untouched `tests/contributions.test.ts` still passes (13 tests): the old channel keeps working until the contract step.
- Historical inherited result: on the contract copy, after the migration this plan prescribes, the nine named runtime suites pass, `examples/contributions.ts` prints `Hello, DI!`, and the three migrated fixture strings evaluate without an assertion failure. The unmigrated `contributionRuntimeAssertions` fails there, showing the harness is sensitive.
- Historical inherited result: Task 7 Step 3's `p05b/strings/phase05_strings.py` matched every count on copies of five files and reported `already migrated` on its second run.
- Fresh rerun: from `.../scratchpad/p05b`, `node run-fixture.mjs collection-tokens/input.ts collection-tokens-import/input.ts` reports diagnostics `[]`, four rewrites in the main file, two in the imported file, the exact four manual items below, and 236 MiB maximum RSS. Transform sources are under `p05b/codemod/lib/transforms`; fixture inputs are under `p05b/codemod/test/fixtures`. The command and result are also in `plan-evidence.txt`.
- Fresh syntax-only check: `node /tmp/di-bag-resume-20260921/probe-05/parse-plan-blocks.mjs` extracts all 68 TypeScript/JavaScript code blocks, calls `ts.createSourceFile` on each (wrapping method-only blocks in a declared class), and reports `syntax failures 0`. This checks grammar only; it is not a TypeScript program or semantic check.
- Every count in this plan was measured with the command next to it.

**Not run.** `tsc`, `tsc6`, `npm run typecheck`, `npm run build`, `npm run check`, `npm run docs:check`, the evidence cases, and the codemod over this repository (its program would load `src`). So: no type-level signature, no fixture under `tests/types/`, no TypeDoc output, no instantiation count and no list of codemod manual items for this repository is confirmed. Task 7's repository manual items are a prediction from a text census.

## State on entry

Phases 0 to 3 are merged into `next`. Confirm each line before Task 1. If a name differs, find the real one with `grep` and adjust only that reference; do not guess.

| Expectation | Command | Expected |
| --- | --- | --- |
| Phase 0: the naming ratchet and the evidence helper exist | `ls tests/api-naming.test.ts tests/api-naming-known-violations.json scripts/evidence-cases.mjs docs/superpowers/plans/evidence/baseline.md` | four paths, no error |
| Phase 1: the codemod exists, with one transform | `ls tools/codemod/cli.mjs tools/codemod/rename-map.json && ls tools/codemod/lib/transforms` | the two files, then `build-and-start.mjs index.mjs` |
| Phase 2: role names for class type parameters | `grep -n "^class Bag<\|^class Builder<" src/di-bag.ts` | `class Bag<ServiceRegistrations extends Registrations, Constraints extends NeedConstraint = never>` and `class Builder<Entries extends Entry, Constraints extends NeedConstraint = never>` |
| Phase 2: `Token<TokenSymbol, Service>` | `grep -n "^class Token<" src/tokens.ts` | `class Token<TokenSymbol extends symbol, Service> extends TokenBase {` |
| Phase 2: `dependencies`, not `deps`, in signatures | `grep -c "deps: \|factoryCtx" src/alias-types.ts src/acquisition-context.ts` | `0` for both files |
| Phase 3: `ensureServicesReady` exists, `buildAndStart` is gone | `grep -c "ensureServicesReady" src/di-bag.ts; grep -c "buildAndStart" src/di-bag.ts src/startup.ts` | a number above 0, then `0` twice |
| Phase 3: the key loop this phase edits | `grep -n "graph.hasPublic(key)" src/startup.ts` | one line, inside `ensureRuntimeReady` |
| This phase has not run | `grep -rn "forCollectionOf\|WRONG_TOKEN_KIND" src docs/agent tools/codemod \| wc -l` | `0` |
| Still 0.4.0 names | `grep -c "resolveAll\|inspectAll" src/di-bag.ts; grep -c "  all: typeof all;" src/di-bag.ts` | a number above 0, then `1` |

Public names this phase works with, as they are on entry: `DiBag.token(key).of<S>()`, `token.key`, `DiBag.optional`, `DiBag.lazy`, `DiBag.all`, `DiBag.fromFunction`, `DiBag.fromClass`, `DiBag.fromPlugin`, `builder.register`, `builder.contribute`, `builder.alias`, `builder.replace`, `builder.installModule`, `builder.buildModule`, `builder.build`, `bag.resolve`, `bag.resolveAll`, `bag.inspect`, `bag.inspectAll`, `bag.inspectGraph`, `bag.fork`, `bag.createScope`, `bag.ensureServicesReady(serviceKeys, { abortSignal, totalTimeoutMs, maxConcurrentServiceKeys })`, `bag.close({ abortSignal, waitTimeoutMs })`.

Inside `class Bag` the type parameters are `ServiceRegistrations` and `Constraints`; inside `class Builder` they are `Entries` and `Constraints`. Type parameters of methods, functions and helper types kept their letters. Where this plan quotes a 0.4.0 line that contains `R`, `E` or `C` of those two classes, the line on disk has the role name.

Facts about the code that the tasks rely on, all read on 2026-09-21:

- `src/tokens.ts` authenticates a token through the module-private `const keys = new WeakMap<TokenBase, symbol>()`; `readTokenKey(value)` throws `DI_BAG_INVALID_TOKEN` for anything that is not in it.
- Contributions live in `BindingGraph.#contributions`, keyed by symbol, separate from `#publicSlots`. `contribute` never creates a public slot. `fork`, `createScope` and `replace` write a public slot with `withPublicBinding`.
- `ScopeAcquisitions.resolve(key)` goes through `graph.publicBinding(key)`, which throws `DI_BAG_MISSING_REGISTRATION` without a slot. The dependency proxy in `resolveBinding` reads through the local `read(key, optional, all)`.
- `Selection`, `TokenMember`, `Overrides`, `OverrideFactoryContext` and `SelectedRegistrations` (`src/types.ts`, `src/token-types.ts`) admit a token only when its symbol is a key of the registrations map. Contributions are `Contribution<T, V>` members of the constraint parameter, never keys of that map.
- `ReferenceGraph<T>` (`src/token-types.ts`) has a fast path, `T extends readonly TokenBase[] ? TokenDependencyContract<T>`, that treats every bare token as required; `MissingTokens` then demands a binding for it.
- `tools/graph/lib/extract.mjs` does not read `contribute`, `all`, `resolveAll` or `inspectAll` (`grep -n "contribut\|resolveAll\|inspectAll" tools/graph/lib/*.mjs tools/graph/test/*.mjs` prints nothing), and neither do `scripts/agent-eval`, `AGENTS.md` or `docs/agent/recipes.md`. The generators `scaleSource` and `tokenScaleSource` in `tests/compiler.ts` emit none of the calls this phase renames. None of them changes in this phase.

## File Structure

| Path | Action | Responsibility in this phase |
| --- | --- | --- |
| `src/tokens.ts` | modify | define/authenticate `CollectionToken`; expose token kind readers and the one wrong-kind error helper |
| `src/token-types.ts` | modify | distinguish token kinds, collection values, collection admission, dependency graph routing, and replacement slots |
| `src/contribution-types.ts` | modify | admit only `CollectionToken`, project lists, and keep module contributions checked |
| `src/dependency-references.ts` | modify | make bare/lazy collection tokens yield lists; reject `optional`; remove `CollectionDependency` and `'all'` |
| `src/types.ts`, `src/replacement-types.ts`, `src/scope-types.ts`, `src/alias-types.ts`, `src/module-types.ts` | modify | propagate collection slots through selection, replacement, alias and module contracts |
| `src/acquisition.ts`, `src/runtime.ts`, `src/startup.ts` | modify | route reads/readiness/inspection to replacement-or-contributions |
| `src/aliases.ts`, `src/contributions.ts`, `src/scope-selection.ts`, `src/module.ts`, `src/di-bag.ts` | modify | runtime admission and public surface |
| `src/index.ts` | modify | export `CollectionToken`; stop exporting `CollectionDependency` |
| `tests/collection-tokens.test.ts` | create | complete runtime contract (15 expand tests plus the contract-only wrong-kind test) |
| `tests/types/collection-tokens.ts`, `tests/types/negative/collection-tokens.ts` | create | positive inference and exact negative diagnostics |
| `tests/types.test.ts`, `tests/types/negative/api-renaming.ts` | modify | register fixtures and pin removed names |
| `tools/codemod/rename-map.json` | modify | exact 0.4.0-to-0.5.0 collection method entries |
| `tools/codemod/lib/rewrite.mjs` | modify | expose program/checker/library facts to whole-program transforms |
| `tools/codemod/lib/transforms/collection-*.mjs`, `tools/codemod/lib/transforms/index.mjs` | create/modify | classify token use, rewrite safe uses, report mixed/external uses |
| `tools/codemod/test/fixtures/collection-tokens*/`, `tools/codemod/test/fixtures/collection-token-partial/` | create | cross-file rewrite, four-manual-item golden, and incomplete-symbol boundary fixture |
| `scripts/phase05-strings.py` | create | counted, idempotent migration for generated/untyped source strings |
| `tests/contributions*.ts`, `tests/types/contributions*.ts`, `tests/*runtime-fixture.ts`, `tests/acquisition-retention.node.mjs`, `examples/contributions.ts` | modify | migrate collection declarations and reads; split the two-channel control |
| `docs/agent/api-card.md`, `docs/reference/`, `docs/guides/api-reference.md`, `docs/agent/errors.md`, `docs/agent/recipes.md`, `tools/docs/api-card-tasks.json`, `tools/docs/test/exact-rendering.test.mjs` | modify/regenerate | generated/public docs, error coverage, composite recipe, exact signatures |
| `tests/api-naming-known-violations.json` | modify in Task 8 | remove exactly the four legacy-collection findings in the same green contract commit that removes their public surface |
| `docs/superpowers/plans/evidence/phase-04.md` | create/modify in Tasks 4, 5 and 9 | record S5 and final evidence |

### Task 0: Create the phase branch and prove the entry state

**Files:**
- Read: the files in `State on entry`

**Interfaces:**
- Consumes: phase 3's `Bag.ensureServicesReady(serviceKeys, options?)` and renamed readiness errors.
- Produces: branch `phase-04-collection-tokens`, based exactly on merged `next`.

- [ ] **Step 1: Create the branch and configure the pinned tools**

```bash
git switch next
git pull --ff-only
git switch -c phase-04-collection-tokens
export PATH="<bun-1.4.0-directory>/bin:$PATH"
export npm_config_update_notifier=false
bun --version
node --version
```

Expected: `1.4.0`, then `v24.20.0`. Do not use the planning-session scratch path unless it still exists.

- [ ] **Step 2: Run every command in `State on entry`**

Expected: every row matches. If a phase-3 signature differs, update references in this plan to the actual merged signature while preserving the spec's behavior.

- [ ] **Step 3: Record the starting tree**

```bash
git status --short
git log -1 --oneline
```

Expected: empty status; the log is the controller's phase-3 merge.

### Task 1: Add authenticated collection-token identities and the wrong-kind diagnostic

**Files:**
- Modify: `src/tokens.ts`
- Modify: `src/index.ts`
- Create: `tests/collection-tokens.test.ts`
- Modify: `docs/agent/errors.md`

**Interfaces:**
- Consumes: `TokenBase`, `Token<K, S>`, and the private `WeakMap` authentication in `src/tokens.ts`.
- Produces: `CollectionToken<TokenSymbol extends symbol, Item> extends CollectionTokenBase`; `CollectionItem<T>`; `TokenKind = 'single-service' | 'collection'`; `readToken(value): Readonly<{ key: symbol; kind: TokenKind }>`; `readSingleServiceKey(value, operation): symbol`; `wrongTokenKind(operation, expectedKind, key)`; and this full public factory signature:

```ts
export function token<const TokenSymbol extends symbol>(
  key: TokenSymbol & TokenKeyAdmission<TokenSymbol>,
  ...invalid: [TokenSymbol] extends [never] ? [TokenKeyAdmission<TokenSymbol>] : []
): {
  readonly of: <Service>() => Token<TokenSymbol, Service>;
  readonly forCollectionOf: <Item>() => CollectionToken<TokenSymbol, Item>;
};
```

- [ ] **Step 1: Write the first two runtime tests**

Create `tests/collection-tokens.test.ts` with these imports/helpers and tests; later tasks append the remaining tests to this same file.

```ts
import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';
import { deferred } from './helpers';

type Diagnostic = { readonly code: string; readonly details: Readonly<Record<string, unknown>>; readonly message: string };
const thrown = (run: () => unknown): Diagnostic => {
  try { run(); } catch (error) { return error as Diagnostic; }
  throw new Error('expected a throw');
};
const turn = () => new Promise<void>(resolve => setImmediate(resolve));

test('forCollectionOf creates a frozen genuine handle next to of', () => {
  const key = Symbol('numbers');
  const factory = DiBag.token(key);
  expect(Object.keys(factory)).toEqual(['of', 'forCollectionOf']);
  expect(Object.isFrozen(factory)).toBe(true);
  const numbers = factory.forCollectionOf<number>();
  expect(numbers.key).toBe(key);
  expect(Object.isFrozen(numbers)).toBe(true);
  expect(numbers).not.toBe(factory.forCollectionOf<number>());
  for (const fake of [{ ...numbers }, Object.create(numbers), { key }]) {
    expect(thrown(() => (DiBag.createBuilder().contribute as Function)(fake, () => 1)).code).toBe('DI_BAG_INVALID_TOKEN');
  }
});

test('register rejects a collection token as the wrong kind, before it reads the provider', () => {
  const numbers = DiBag.token(Symbol('numbers')).forCollectionOf<number>();
  const error = thrown(() => (DiBag.createBuilder().register as Function)(numbers, 'not a provider'));
  expect(error.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
  expect(error.details).toEqual({ operation: 'register', expectedKind: 'single-service', receivedKind: 'collection' });
  expect(Object.isFrozen(error.details)).toBe(true);
  expect(error.message).toBe('DI_BAG_WRONG_TOKEN_KIND: register requires a single-service token, but Symbol(numbers) is a collection token; see https://dany-fedorov.github.io/di-bag/agent/errors.html#di-bag-wrong-token-kind');
});
```

- [ ] **Step 2: Run the focused test and see the intended failure**

Run: `bun test tests/collection-tokens.test.ts`

Expected: 0 pass, 2 fail; the first failure says `forCollectionOf is not a function`.

- [ ] **Step 3: Implement the token classes and authentication**

Add `CollectionTokenBase` and `CollectionToken` next to `Token`. Handles live in a `WeakMap` for authentication. Kind consistency belongs to each immutable `BindingGraph`, not process-global token construction: independent graphs may intentionally reuse the same symbol with different handles, while one graph cannot expose both channels. Use exactly:

```ts
export type TokenKind = 'single-service' | 'collection';
declare const collectionTokenInvariant: unique symbol;
class CollectionTokenBase extends TokenBase {
  declare private readonly collectionNominal: void;
}
class CollectionToken<TokenSymbol extends symbol, Item>
  extends CollectionTokenBase {
  declare readonly [collectionTokenInvariant]:
    (value: [TokenSymbol, Item]) => [TokenSymbol, Item];
  constructor(readonly key: TokenSymbol) {
    super();
  }
}
export type CollectionItem<T> = T extends CollectionToken<infer _TokenSymbol, infer Item> ? Item : never;

const tokens = new WeakMap<TokenBase, Readonly<{ key: symbol; kind: TokenKind }>>();

export function readToken(value: unknown): Readonly<{ key: symbol; kind: TokenKind }> {
  if (typeof value !== 'object' || value === null) {
    throw libraryError('DI_BAG_INVALID_TOKEN', 'invalid token', {
      expected: 'genuine typed token',
    });
  }
  const token = tokens.get(value as TokenBase);
  if (token === undefined) {
    throw libraryError('DI_BAG_INVALID_TOKEN', 'invalid token', {
      expected: 'genuine typed token',
    });
  }
  return token;
}

export function wrongTokenKind(operation: string, expectedKind: TokenKind, key: symbol): Error & DiBagDiagnostic {
  const receivedKind: TokenKind = expectedKind === 'collection' ? 'single-service' : 'collection';
  return libraryError(
    'DI_BAG_WRONG_TOKEN_KIND',
    `${operation} requires a ${expectedKind} token, but ${String(key)} is a ${receivedKind} token`,
    { operation, expectedKind, receivedKind },
  );
}

export function readSingleServiceKey(value: unknown, operation: string): symbol {
  const { key, kind } = readToken(value);
  if (kind === 'collection') throw wrongTokenKind(operation, 'single-service', key);
  return key;
}

export function readTokenKey(value: unknown): symbol {
  return readToken(value).key;
}

export function token<const TokenSymbol extends symbol>(
  key: TokenSymbol & TokenKeyAdmission<TokenSymbol>,
  ...invalid: [TokenSymbol] extends [never]
    ? [TokenKeyAdmission<TokenSymbol>]
    : []
): {
  readonly of: <Service>() => Token<TokenSymbol, Service>;
  readonly forCollectionOf:
    <Item>() => CollectionToken<TokenSymbol, Item>;
} {
  if (typeof key !== 'symbol') {
    throw libraryError(
      'DI_BAG_INVALID_TOKEN',
      'token key must be a symbol',
      { operation: 'token' },
    );
  }
  return Object.freeze({
    of: <Service>(): Token<TokenSymbol, Service> => {
      const handle = new Token<TokenSymbol, Service>(key);
      tokens.set(handle, Object.freeze({ key, kind: 'single-service' }));
      Object.freeze(handle);
      return handle;
    },
    forCollectionOf: <Item>(): CollectionToken<TokenSymbol, Item> => {
      const handle = new CollectionToken<TokenSymbol, Item>(key);
      tokens.set(handle, Object.freeze({ key, kind: 'collection' }));
      Object.freeze(handle);
      return handle;
    },
  });
}
```

The two token classes both extend `TokenBase` and each carries its own invariant tuple. Token creation itself is side-effect-free apart from authenticating its returned handle; Task 3 prints the graph-scoped kind registry used by every graph-changing operation.

Export `CollectionToken`, `CollectionTokenBase`, `CollectionItem`, and `TokenKind` from `src/index.ts`. Keep `TokenKey<T>` able to extract a key from either token kind; keep `TokenService<T>` for a single token and make the collection service type `readonly CollectionItem<T>[]` through a separate conditional helper in Task 4.

- [ ] **Step 4: Add the error documentation with the code**

Add this exact section to `docs/agent/errors.md`:

```md
## DI_BAG_WRONG_TOKEN_KIND

A genuine typed token was used in an operation that requires the other token kind. A token is either a single-service token or a collection token and cannot serve both roles. Read `details.operation`, `details.expectedKind`, and `details.receivedKind`; create the token with `.of<Service>()` for one service or `.forCollectionOf<Item>()` for a collection. Split an old token that used both channels into two tokens.
```

The throw site has the literal code and object-literal details on the same line if required by the phase-11 inventory script.

- [ ] **Step 5: Make `register` and alias destinations use `readSingleServiceKey`**

In `Builder.register`, call `readSingleServiceKey(moreOrToken, 'register')` before `normalize`. In `aliasEntry`, use `readSingleServiceKey(destination, 'alias')`. Do not reject collection alias targets.

- [ ] **Step 6: Verify and commit the identity boundary**

Run: `bun test tests/collection-tokens.test.ts`

Expected: 2 pass, 0 fail.

```bash
git add src/tokens.ts src/index.ts src/di-bag.ts src/aliases.ts tests/collection-tokens.test.ts docs/agent/errors.md
git commit -m "feat!: add authenticated collection tokens" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL"
```

### Task 2: Route collection reads, dependencies, aliases and readiness at run time

**Files:**
- Modify: `src/acquisition.ts`, `src/runtime.ts`, `src/startup.ts`, `src/dependency-references.ts`, `src/aliases.ts`, `src/di-bag.ts`
- Modify: `tests/collection-tokens.test.ts`

**Interfaces:**
- Consumes: Task 1's `readToken`; phase 3's real `ensureRuntimeReady` pipeline and cancellation options.
- Produces: `ScopeAcquisitions.resolveCollection(key: symbol): unknown`; `ScopeAcquisitions.acquireCollection(key: symbol): Promise<void>`; `BagRuntime.resolveCollection`, `acquireCollection`, `inspectCollection`; bare/lazy collection reference metadata with `isCollection: true`.

- [ ] **Step 1: Append the read, lifetime, inspect and readiness tests**

Append these first three read/readiness tests:

```ts
test('resolve of a collection token returns a fresh frozen list in contribution order, and an empty list is valid', async () => {
  const numbers = DiBag.token(Symbol('numbers')).forCollectionOf<number>();
  const empty = DiBag.createBuilder().build();
  const none = empty.resolve(numbers);
  expect(none).toEqual([]); expect(Object.isFrozen(none)).toBe(true);
  const bag = DiBag.createBuilder().contribute(numbers, () => 1).contribute(numbers, () => 2).build();
  const first = bag.resolve(numbers);
  expect(first).toEqual([1, 2]); expect(Object.isFrozen(first)).toBe(true); expect(bag.resolve(numbers)).not.toBe(first);
  await bag.close(); await empty.close();
  expect(thrown(() => bag.resolve(numbers)).code).toBe('DI_BAG_CLOSED');
});

test('inspect of a collection token returns one snapshot per contribution and runs no factory', async () => {
  const items = DiBag.token(Symbol('items')).forCollectionOf<number>(); let calls = 0;
  const bag = DiBag.createBuilder().contribute(items, DiBag.withMetadata(() => ++calls, { static: { name: 'a' } })).contribute(items, () => ++calls).build();
  const before = bag.inspect(items);
  expect(calls).toBe(0); expect(Object.isFrozen(before)).toBe(true);
  expect(before.map(snapshot => snapshot.acquisitions.length)).toEqual([0, 0]);
  expect(before[0]!.registrationMetadata).toEqual({ name: 'a' });
  bag.resolve(items);
  expect(bag.inspect(items).map(snapshot => snapshot.acquisitions.length)).toEqual([1, 1]);
  expect(DiBag.createBuilder().build().inspect(items)).toEqual([]);
  await bag.close();
});

test('ensureServicesReady waits for every contribution of a collection token', async () => {
  const clients = DiBag.token(Symbol('clients')).forCollectionOf<Promise<string>>();
  const slow = deferred<string>(); const started: string[] = [];
  const bag = DiBag.createBuilder().contribute(clients, () => { started.push('fast'); return Promise.resolve('fast'); })
    .contribute(clients, () => { started.push('slow'); return slow.promise; })
    .register({ unrelated: () => { started.push('unrelated'); return 1; } }).build();
  let ready = false;
  const ensuring = bag.ensureServicesReady([clients]).then(same => { ready = true; return same; });
  await turn(); expect(started).toEqual(['fast', 'slow']); expect(ready).toBe(false);
  slow.resolve('slow'); expect(await ensuring).toBe(bag);
  expect(await Promise.all(bag.resolve(clients))).toEqual(['fast', 'slow']);
  expect(started).toEqual(['fast', 'slow']); await bag.close();
});
```

Append these remaining tests for this task:

```ts
test('each contribution keeps its own lifetime and disposer when the list is read through resolve', async () => {
  const objects = DiBag.token(Symbol('objects')).forCollectionOf<{ id: number }>();
  let ids = 0; const disposed: number[] = [];
  const create = DiBag.withDisposal(() => ({ id: ++ids }), value => { disposed.push(value.id); });
  const bag = DiBag.createBuilder()
    .contribute(objects, DiBag.withLifetime(create, 'root'))
    .contribute(objects, create)
    .contribute(objects, DiBag.withLifetime(create, 'transient'))
    .build();
  const first = bag.resolve(objects); const again = bag.resolve(objects);
  expect(first[0]).toBe(again[0]); expect(first[1]).toBe(again[1]); expect(first[2]).not.toBe(again[2]);
  const child = bag.createScope(); const scoped = child.resolve(objects);
  expect(scoped[0]).toBe(first[0]); expect(scoped[1]).not.toBe(first[1]);
  await child.close(); await bag.close();
  expect(disposed.length).toBe(ids); expect(new Set(disposed).size).toBe(ids);
});

test('ensureServicesReady accepts a collection token nothing contributes to, and closes the bag when a contribution fails', async () => {
  const hooks = DiBag.token(Symbol('hooks')).forCollectionOf<number>();
  const empty = DiBag.createBuilder().build();
  expect(await empty.ensureServicesReady([hooks])).toBe(empty); await empty.close();
  const disposed: number[] = [];
  const failing = DiBag.createBuilder()
    .contribute(hooks, DiBag.withDisposal(() => 1, value => { disposed.push(value); }))
    .contribute(hooks, () => { throw new Error('failed contribution'); }).build();
  await expect(failing.ensureServicesReady([hooks])).rejects.toThrow();
  expect(disposed).toEqual([1]); expect(thrown(() => failing.resolve(hooks)).code).toBe('DI_BAG_CLOSED');
});
```

- [ ] **Step 2: Run and observe the missing-registration failures**

Run: `bun test tests/collection-tokens.test.ts`

Expected: the Task 1 tests pass; new tests fail with `DI_BAG_MISSING_REGISTRATION` or missing collection branches.

- [ ] **Step 3: Implement one replacement-or-contributions runtime path**

In `ScopeAcquisitions`, rename the old private collection helper to `resolveContributions` and add:

```ts
function freshCollectionView(value: unknown): readonly unknown[] {
  return Object.freeze([...(value as readonly unknown[])]);
}
```

```ts
resolveCollection(key: symbol): readonly unknown[] {
  this.assertOpen();
  return this.graph.hasPublic(key)
    ? freshCollectionView(
        this.takeExposed(
          this.resolveBinding(this.graph.publicBinding(key)),
        ),
      )
    : this.resolveContributions(key);
}

async acquireCollection(key: symbol): Promise<void> {
  this.assertOpen();
  const ids = this.graph.hasPublic(key) ? [this.graph.publicBinding(key)] : this.graph.contributionBindings(key);
  const attempts = ids.map(id => {
    const attempt = this.resolveBinding(id);
    this.takeExposed(attempt);
    return attempt;
  });
  await Promise.all(attempts.map(attempt => attempt.execution.ready()));
}
```

`freshCollectionView` is a shallow copy of the exposed replacement output. The provider still caches and owns its original list according to its lifetime, and its disposer receives that original value; callers, lazy readers, and collection aliases receive a new frozen view on every read.

Expose matching methods on `BagRuntime`. Implement `inspectCollection` by choosing `[graph.publicBinding(key)]` when a public slot exists, else `graph.contributionBindings(key)`, then freezing the mapped snapshots.

Use these complete `BagRuntime` bodies:

```ts
resolveCollection(key: symbol): unknown {
  return this.acquisitions.resolveCollection(key);
}

acquireCollection(key: symbol): Promise<void> {
  return this.acquisitions.acquireCollection(key);
}

inspectCollection(
  key: symbol,
): readonly RegistrationSnapshot<object, readonly unknown[]>[] {
  const bindingIds = this.graph.hasPublic(key)
    ? [this.graph.publicBinding(key)]
    : this.graph.contributionBindings(key);
  return Object.freeze(
    bindingIds.map(bindingId => this.inspectBinding(bindingId)),
  );
}
```

- [ ] **Step 4: Mark collection dependency references**

Change `ArgumentReference` to:

```ts
export interface ArgumentReference {
  readonly slot: symbol;
  readonly key: symbol;
  readonly kind: 'required' | 'optional' | 'lazy';
  readonly isCollection: boolean;
}
```

`snapshotReferences` authenticates a bare token with `readToken` and emits `kind: 'required'`, `isCollection: kind === 'collection'`. `lazy(collectionToken)` retains `kind: 'lazy'` and `isCollection: true`. `optional(collectionToken)` throws `wrongTokenKind('optional', 'single-service', key)`. Remove `'all'` only in the contract task; during expand keep old `all(singleToken)` and map it to the old contribution path.

The expand implementation is:

```ts
const references = new WeakMap<object, Readonly<{
  key: symbol;
  kind: 'required' | 'optional' | 'lazy' | 'all';
  isCollection: boolean;
}>>();

function reference<
  TokenHandle extends TokenBase,
  Kind extends 'optional' | 'lazy' | 'all',
>(token: TokenHandle, kind: Kind): DependencyHandle<TokenHandle, Kind> {
  const { key, kind: tokenKind } = readToken(token);
  const isCollection = tokenKind === 'collection';
  if (isCollection && kind === 'optional') {
    throw wrongTokenKind('optional', 'single-service', key);
  }
  const handle = new DependencyHandle<TokenHandle, Kind>();
  references.set(handle, Object.freeze({
    key,
    kind: isCollection && kind === 'all' ? 'required' : kind,
    isCollection,
  }));
  Object.freeze(handle);
  return handle;
}

export function snapshotReferences(value: unknown): readonly ArgumentReference[] {
  if (!Array.isArray(value)) {
    throw libraryError('DI_BAG_INVALID_TOKEN', 'tokens must be a tuple', {
      operation: 'token',
    });
  }
  const selected: unknown[] = [];
  const length = value.length;
  for (let index = 0; index < length; index++) selected[index] = value[index];
  return Object.freeze(selected.map(handle => {
    const retained = typeof handle === 'object' && handle !== null
      ? references.get(handle)
      : undefined;
    if (retained) {
      return Object.freeze({
        slot: Symbol('argument'),
        key: retained.key,
        kind: retained.kind,
        isCollection: retained.isCollection,
      });
    }
    const { key, kind } = readToken(handle);
    return Object.freeze({
      slot: Symbol('argument'),
      key,
      kind: 'required' as const,
      isCollection: kind === 'collection',
    });
  }));
}
```

- [ ] **Step 5: Route proxy reads and aliases**

Change the acquisition proxy's local reader to accept `isCollection`; if there is no public dependency binding and it is a collection, call `resolveContributions(key, attempt)` instead of raising missing dependency. A collection alias cannot use canonical alias routing because there is no binding id, so `aliasEntry` creates a transient raw provider whose single `ArgumentReference` has `isCollection: true`; its factory returns `Reflect.get(dependencies, reference.slot)`. This preserves fresh-list behavior and sees replacements.

Replace the local reader and reference dispatch with these complete bodies:

```ts
const read = (
  key: BindingKey,
  optional = false,
  all = false,
  isCollection = false,
): unknown => {
  if (
    this.state === 'closed'
    || (this.state === 'closing' && !attempt.execution.sourceInFlight)
  ) {
    throw libraryError(
      this.state === 'closing' ? 'DI_BAG_CLOSING' : 'DI_BAG_CLOSED',
      `bag is ${this.state}`,
      { state: this.state },
    );
  }
  if (all) return this.resolveContributions(key as symbol, attempt);
  const target = this.graph.findDependency(bindingId, key);
  if (isCollection) {
    return target === undefined
      ? this.resolveContributions(key as symbol, attempt)
      : freshCollectionView(
          this.takeExposed(this.resolveBinding(target, attempt)),
        );
  }
  if (target === undefined && !optional) {
    const path = this.family.dependencyPath(attempt, String(key));
    throw libraryError(
      'DI_BAG_MISSING_DEPENDENCY',
      `Cannot resolve ${JSON.stringify(attempt.label)}: dependency ${JSON.stringify(String(key))} is not registered. Resolution path: ${path.join(' -> ')}.`,
      {
        operation: 'resolve',
        consumer: attempt.label,
        dependency: key,
        path,
      },
    );
  }
  return target === undefined
    ? undefined
    : this.takeExposed(this.resolveBinding(target, attempt));
};

const reference = typeof key === 'symbol' ? references.get(key) : undefined;
if (reference) {
  return reference.kind === 'lazy'
    ? () => read(reference.key, false, false, reference.isCollection)
    : read(
        reference.key,
        reference.kind === 'optional',
        reference.kind === 'all',
        reference.isCollection,
      );
}
```

Use this exact alias implementation; the ordinary target path remains canonical, while a collection target gets a transient raw reader:

```ts
const collectionAliasLifetime = Object.freeze({
  kind: 'transient' as const,
  allowScopedDependencies: false,
});

export function aliasEntry(
  destination: unknown,
  target: unknown,
  hasKey: (key: BindingKey) => boolean,
): readonly [BindingKey, Registration] {
  const key = typeof destination === 'string'
    ? destination
    : readSingleServiceKey(destination, 'alias');
  const targetToken = typeof target === 'string' ? undefined : readToken(target);
  const targetKey = targetToken === undefined ? target as string : targetToken.key;
  if (hasKey(key)) {
    throw libraryError(
      'DI_BAG_DUPLICATE_REGISTRATION',
      `duplicate registration: ${String(key)}`,
      { operation: 'alias', key },
    );
  }
  if (typeof target === 'string' && !hasKey(targetKey)) {
    throw libraryError(
      'DI_BAG_INVALID_ALIAS',
      'alias requires an existing named target',
      { operation: 'alias', target: targetKey },
    );
  }
  const handle = createProvider();
  if (targetToken?.kind === 'collection') {
    const reference = Object.freeze({
      slot: Symbol('argument'),
      key: targetToken.key,
      kind: 'required' as const,
      isCollection: true,
    });
    retainDescription(handle, Object.freeze({
      ...sourceDescription(
        (dependencies: Record<symbol, unknown>) =>
          Reflect.get(dependencies, reference.slot),
        undefined,
        [targetToken.key],
        'raw',
        false,
        [reference],
      ),
      lifetime: collectionAliasLifetime,
    }));
    return [key, handle];
  }
  retainDescription(handle, Object.freeze({
    ...sourceDescription(
      () => {
        throw libraryError(
          'DI_BAG_INTERNAL_STATE',
          'alias source cannot execute',
          {},
        );
      },
      undefined,
      [],
      'raw',
    ),
    alias: targetKey,
  }));
  return [key, handle];
}
```

- [ ] **Step 6: Route public read, inspect and readiness calls**

In `Bag.resolve` and `Bag.inspect`, authenticate nonstrings through `readToken` and branch to the collection methods. In phase 3's `ensureRuntimeReady`, snapshot `{ key, isCollection }`, accept any collection token even without contributions, and schedule `runtime.acquireCollection(key)` for it. Preserve phase 3 concurrency, abort, timeout, rollback, and error-class logic unchanged.

The two public runtime bodies are:

```ts
resolve(serviceKey: unknown): unknown {
  if (typeof serviceKey === 'string') return this.#runtime.resolve(serviceKey);
  const { key, kind } = readToken(serviceKey);
  return kind === 'collection'
    ? this.#runtime.resolveCollection(key)
    : this.#runtime.resolve(key);
}

inspect(serviceKey: unknown): unknown {
  if (typeof serviceKey === 'string') return this.#runtime.inspect(serviceKey);
  const { key, kind } = readToken(serviceKey);
  return kind === 'collection'
    ? this.#runtime.inspectCollection(key)
    : this.#runtime.inspect(key);
}
```

Replace phase 3's complete `ensureRuntimeReady` with this phase-entry-adjusted body. The only algorithm changes are the `SelectedReadinessEntry` snapshot and the local `acquire` dispatch; cancellation, bounded workers, rollback, and error wrapping remain present:

```ts
type SelectedReadinessEntry = Readonly<{
  key: BindingKey;
  isCollection: boolean;
}>;

export function ensureRuntimeReady(
  runtime: BagRuntime,
  graph: BindingGraph,
  keys: readonly unknown[],
  options?: EnsureServicesReadyOptions,
): Promise<void> {
  runtime.assertOpen();
  if (!Array.isArray(keys)) {
    throw libraryError(
      'DI_BAG_INVALID_STARTUP',
      'ensureServicesReady requires a tuple of service keys',
      { operation: 'ensureServicesReady' },
    );
  }
  const selected: SelectedReadinessEntry[] = [];
  const length = keys.length;
  for (let index = 0; index < length; index++) {
    const value: unknown = keys[index];
    const token = typeof value === 'string' ? undefined : readToken(value);
    const key = token === undefined ? value as string : token.key;
    const isCollection = token?.kind === 'collection';
    if (!isCollection && !graph.hasPublic(key)) {
      throw libraryError(
        'DI_BAG_INVALID_STARTUP',
        `ensureServicesReady accepts existing names or typed tokens only: ${String(key)}`,
        { operation: 'ensureServicesReady' },
      );
    }
    selected.push({ key, isCollection });
  }
  const { abortSignal, totalTimeoutMs, maxConcurrentServiceKeys } =
    snapshotReadinessOptions(options);
  const acquire = (entry: SelectedReadinessEntry): Promise<void> =>
    entry.isCollection
      ? runtime.acquireCollection(entry.key as symbol)
      : runtime.acquire(entry.key);
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const began = performance.now();
    const release = () => {
      if (timer !== undefined) clearTimeout(timer);
      abortSignal?.removeEventListener('abort', aborted);
    };
    const cancel = (reason: 'aborted' | 'timeout', cause: unknown) => {
      if (settled) return;
      settled = true;
      release();
      const progress = runtime.closeProgress();
      reject(new DiBagServiceReadinessCancelledError(
        reason,
        cause,
        runtime.close(cause),
        progress,
        reason === 'timeout' ? totalTimeoutMs : undefined,
      ));
    };
    const aborted = () => {
      if (abortSignal?.aborted) cancel('aborted', abortSignal.reason);
    };
    const checkCancellation = () => {
      aborted();
      if (
        !settled
        && totalTimeoutMs !== undefined
        && performance.now() - began >= totalTimeoutMs
      ) {
        cancel(
          'timeout',
          formatted(diagnostic(
            new DOMException(
              diagnosticMessage(
                'DI_BAG_SERVICE_READINESS_TIMEOUT',
                'The listed services were not ready before the deadline',
              ),
              'TimeoutError',
            ),
            'DI_BAG_SERVICE_READINESS_TIMEOUT',
            { operation: 'ensureServicesReady', totalTimeoutMs },
          )),
        );
      }
      return settled;
    };
    const schedule = () => {
      if (checkCancellation() || totalTimeoutMs === undefined) return;
      timer = setTimeout(
        schedule,
        Math.min(
          2 ** 31 - 1,
          Math.max(1, totalTimeoutMs - (performance.now() - began)),
        ),
      );
    };
    abortSignal?.addEventListener('abort', aborted, { once: true });
    if (checkCancellation()) return;
    if (totalTimeoutMs !== undefined) schedule();

    const runBounded = (limit: number) => {
      let next = 0;
      let failed = false;
      const worker = async () => {
        while (next < selected.length) {
          if (failed || checkCancellation()) return;
          const entry = selected[next++]!;
          try {
            await acquire(entry);
          } catch (cause) {
            failed = true;
            throw cause;
          }
        }
      };
      return Promise.all(
        Array.from({ length: Math.min(limit, selected.length) }, worker),
      );
    };
    const runAllAtOnce = () => {
      const pending: Promise<void>[] = [];
      for (const entry of selected) {
        if (checkCancellation()) break;
        pending.push(acquire(entry));
      }
      return Promise.all(pending);
    };
    const work = maxConcurrentServiceKeys === undefined
      ? runAllAtOnce()
      : runBounded(maxConcurrentServiceKeys);
    void work.then(() => {
      if (checkCancellation()) return;
      settled = true;
      release();
      resolve();
    }, async cause => {
      if (checkCancellation()) return;
      let disposalError: unknown;
      try {
        await runtime.close(cause);
      } catch (error) {
        disposalError = error;
      }
      if (checkCancellation()) return;
      settled = true;
      release();
      reject(new DiBagServiceReadinessError(
        cause,
        disposalError instanceof DiBagCleanupError
          ? disposalError.failures
          : [],
        disposalError,
      ));
    });
  });
}
```

- [ ] **Step 7: Run the focused runtime suite and commit**

Run: `bun test tests/collection-tokens.test.ts`

Expected: all tests present through this task pass.

```bash
git add src/acquisition.ts src/runtime.ts src/startup.ts src/dependency-references.ts src/aliases.ts src/di-bag.ts tests/collection-tokens.test.ts
git commit -m "feat: read collection tokens through ordinary APIs" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL"
```

### Task 3: Enforce single-service positions and whole-list replacement at run time

**Files:**
- Modify: `src/contributions.ts`, `src/scope-selection.ts`, `src/module.ts`, `src/di-bag.ts`
- Modify: `tests/collection-tokens.test.ts`

**Interfaces:**
- Consumes: `readToken`, `readSingleServiceKey`, `wrongTokenKind`; the public-slot-wins path from Task 2.
- Produces: collection-aware `fork`, `createScope` replacement and `replace`; rejected collection sharing/export. The old single-token contribution channel remains accepted until Task 8 so expand stays compatible with unmigrated callers.

- [ ] **Step 1: Append the dependency, alias and channel-separation tests**

```ts
test('a dependency list accepts a collection token, lazy supplies a getter, and optional is the wrong kind', async () => {
  const numbers = DiBag.token(Symbol('numbers')).forCollectionOf<number>();
  class Total { constructor(readonly values: readonly number[]) {} }
  const plugin: unknown = { apiVersion: 1, create: (values: readonly number[]) => values.length };
  const bag = DiBag.createBuilder().contribute(numbers, () => 3).contribute(numbers, () => 4).register({
    sum: DiBag.fromFunction([numbers], values => values.reduce((total, value) => total + value, 0)),
    total: DiBag.fromClass([numbers], Total),
    count: DiBag.fromPlugin([numbers], plugin, { acquisitionMode: 'raw', validate: (value): value is number => typeof value === 'number' }),
    later: DiBag.fromFunction([DiBag.lazy(numbers)], getNumbers => getNumbers),
  }).build();
  expect(bag.resolve('sum')).toBe(7); expect(bag.resolve('total').values).toEqual([3, 4]);
  expect(Object.isFrozen(bag.resolve('total').values)).toBe(true); expect(bag.resolve('count')).toBe(2);
  const getNumbers = bag.resolve('later'); expect(getNumbers()).toEqual([3, 4]); expect(getNumbers()).not.toBe(getNumbers());
  const graph = bag.inspectGraph();
  const kinds = (label: string) => graph.bindings.find(binding => binding.label === label)!.tokenDependencies.map(dependency => dependency.kind);
  expect(kinds('sum')).toEqual(['required']); expect(kinds('later')).toEqual(['lazy']);
  const error = thrown(() => (DiBag.optional as Function)(numbers));
  expect(error.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
  expect(error.details).toEqual({ operation: 'optional', expectedKind: 'single-service', receivedKind: 'collection' });
  expect(error.message).toContain('optional requires a single-service token'); expect(error.message).toContain('#di-bag-wrong-token-kind');
  await bag.close();
});

test('a consumer of an empty collection receives an empty list, also inside a module', async () => {
  const hooks = DiBag.token(Symbol('hooks')).forCollectionOf<() => void>();
  const feature = DiBag.createBuilder().register({ hookCount: DiBag.fromFunction([hooks], list => list.length) }).buildModule(['hookCount']);
  const lonely = DiBag.createBuilder().installModule(feature).build();
  expect(lonely.resolve('hookCount')).toBe(0);
  const host = DiBag.createBuilder().contribute(hooks, () => () => {}).installModule(feature).build();
  expect(host.resolve('hookCount')).toBe(1);
  await lonely.close(); await host.close();
});

test('an alias gives the list a name, so a named factory reaches it', async () => {
  const controllers = DiBag.token(Symbol('controllers')).forCollectionOf<string>();
  const feature = DiBag.createBuilder().contribute(controllers, () => 'users').buildModule([]);
  const bag = DiBag.createBuilder().installModule(feature).contribute(controllers, () => 'orders')
    .alias('controllers', controllers)
    .register({ router: ({ controllers }: { controllers: readonly string[] }) => controllers.join(',') }).build();
  expect(bag.resolve('router')).toBe('users,orders');
  const named = bag.resolve('controllers'); expect(named).toEqual(['users', 'orders']); expect(Object.isFrozen(named)).toBe(true);
  expect(bag.resolve('controllers')).not.toBe(named); expect(bag.inspect('controllers').aliasTarget).toBeUndefined();
  await bag.close();
});

test('an alias destination rejects a collection token as the wrong kind', () => {
  const numbers = DiBag.token(Symbol('numbers')).forCollectionOf<number>();
  const error = thrown(() => (DiBag.createBuilder().register({ value: () => 1 }).alias as Function)(numbers, 'value'));
  expect(error.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
  expect(error.details).toEqual({ operation: 'alias', expectedKind: 'single-service', receivedKind: 'collection' });
});

test('a single-service token and a collection token never merge', async () => {
  const logger = DiBag.token(Symbol('logger')).of<string>();
  const loggerSinks = DiBag.token(Symbol('loggerSinks')).forCollectionOf<string>();
  const bag = DiBag.createBuilder().contribute(loggerSinks, () => 'console').contribute(loggerSinks, () => 'file')
    .register(logger, DiBag.fromFunction([loggerSinks], sinks => `fan-out(${sinks.join(',')})`)).build();
  expect(bag.resolve(logger)).toBe('fan-out(console,file)'); expect(bag.resolve(loggerSinks)).toEqual(['console', 'file']);
  expect(bag.inspectGraph().contributions.map(group => group.token)).toEqual([loggerSinks.key]); await bag.close();
});
```

- [ ] **Step 2: Append the replacement and unsupported-sharing tests**

Append these complete replacement tests before the sharing test:

```ts
test('fork replaces a whole list, and the replacement wins for every reader', async () => {
  const controllers = DiBag.token(Symbol('controllers')).forCollectionOf<string>();
  let real = 0;
  const app = DiBag.createBuilder()
    .contribute(controllers, () => { real++; return 'users'; })
    .contribute(controllers, () => { real++; return 'orders'; })
    .alias('controllers', controllers)
    .register({
      router: ({ controllers }: { controllers: readonly string[] }) => controllers.join(','),
      count: DiBag.fromFunction([controllers], list => list.length),
      later: DiBag.fromFunction([DiBag.lazy(controllers)], getList => getList),
    }).build();
  const fake: readonly string[] = ['fake'];
  let disposed: readonly string[] | undefined;
  const replacement = DiBag.withDisposal(
    () => fake,
    value => { disposed = value; },
  );
  const testApp = app.fork(
    [controllers],
    { [controllers.key]: replacement },
  );
  const direct = testApp.resolve(controllers);
  const lazy = testApp.resolve('later')();
  const named = testApp.resolve('controllers');
  expect(direct).toEqual(fake); expect(direct).not.toBe(fake);
  expect(Object.isFrozen(direct)).toBe(true);
  expect(lazy).toEqual(fake); expect(lazy).not.toBe(direct);
  expect(named).toEqual(fake); expect(named).not.toBe(lazy);
  expect(Object.isFrozen(named)).toBe(true);
  expect(testApp.resolve('router')).toBe('fake');
  expect(testApp.resolve('count')).toBe(1);
  expect(testApp.inspect(controllers).map(snapshot => snapshot.acquisitions.length)).toEqual([1]);
  expect(await testApp.ensureServicesReady([controllers])).toBe(testApp); expect(real).toBe(0);
  expect(app.resolve(controllers)).toEqual(['users', 'orders']); expect(app.inspect(controllers).length).toBe(2);
  const again = testApp.fork([controllers], { [controllers.key]: () => ['again'] });
  expect(again.resolve(controllers)).toEqual(['again']);
  const unused = DiBag.token(Symbol('unused')).forCollectionOf<number>();
  const filled = app.fork([unused], { [unused.key]: () => [1, 2] });
  expect(filled.resolve(unused)).toEqual([1, 2]);
  expect(thrown(() => (app.fork as Function)([controllers], {})).code).toBe('DI_BAG_INVALID_OVERRIDE');
  await again.close(); await filled.close(); await testApp.close();
  expect(disposed).toBe(fake);
  await app.close();
});

test('createScope and builder replace swap a list the same way', async () => {
  const sinks = DiBag.token(Symbol('sinks')).forCollectionOf<string>();
  const builder = DiBag.createBuilder().contribute(sinks, () => 'console')
    .register({ names: DiBag.fromFunction([sinks], list => list.join('+')) });
  const app = builder.build();
  const child = app.createScope([sinks], { [sinks.key]: () => ['memory'] });
  expect(child.resolve(sinks)).toEqual(['memory']); expect(child.resolve('names')).toBe('memory');
  expect(app.resolve('names')).toBe('console');
  const replaced = builder.replace(sinks, () => ['file', 'syslog']).build();
  expect(replaced.resolve(sinks)).toEqual(['file', 'syslog']); expect(replaced.resolve('names')).toBe('file+syslog');
  const later = builder.replace(sinks, () => ['first']).contribute(sinks, () => 'ignored').build();
  expect(later.resolve(sinks)).toEqual(['first']);
  expect(thrown(() => (app.createScope as Function)([sinks], {})).code).toBe('DI_BAG_INVALID_SCOPE');
  await child.close(); await app.close(); await replaced.close(); await later.close();
});
```

```ts
test('share and buildModule reject a collection token as the wrong kind', async () => {
  const numbers = DiBag.token(Symbol('numbers')).forCollectionOf<number>();
  const builder = DiBag.createBuilder().contribute(numbers, () => 1);
  const wrong = (operation: string) => ({ operation, expectedKind: 'single-service', receivedKind: 'collection' });
  const exported = thrown(() => (builder.buildModule as Function)([numbers]));
  expect(exported.code).toBe('DI_BAG_WRONG_TOKEN_KIND'); expect(exported.details).toEqual(wrong('buildModule'));
  const bag = builder.build();
  const shared = thrown(() => (bag.createScope as Function)({ share: [numbers] }));
  expect(shared.code).toBe('DI_BAG_WRONG_TOKEN_KIND'); expect(shared.details).toEqual(wrong('createScope'));
  const replaced = bag.fork([numbers], { [numbers.key]: () => [5] });
  expect(thrown(() => (replaced.createScope as Function)({ share: [numbers] })).code).toBe('DI_BAG_WRONG_TOKEN_KIND');
  await replaced.close(); await bag.close();
});
```

- [ ] **Step 3: Implement runtime admission**

Leave `contributionEntry` accepting the legacy single-service token during expand. `sealModule` calls `readSingleServiceKey(value, 'buildModule')`. `selectScope` snapshots `{ key, isCollection }`, permits collections among replacement keys even without a public slot, and rejects them among `share` keys before lifetime lookup with operation `createScope`.

In `Bag.fork`, track collection symbols while snapshotting selected values and skip `hasPublic` only for those symbols. In `Builder.replace`, authenticate the token and skip the existing-slot check for a collection token. Continue to require an own override property and normalize every replacement provider.


Replace `selectScope` with the complete tested implementation:

```ts
type SelectedKey = {
  readonly key: BindingKey;
  readonly isCollection: boolean;
};

function snapshot(selection: unknown): SelectedKey[] {
  if (!Array.isArray(selection)) {
    throw libraryError(
      'DI_BAG_INVALID_SCOPE',
      'createScope requires a selected key array',
      { operation: 'createScope' },
    );
  }
  const values: unknown[] = [];
  const length = selection.length;
  for (let index = 0; index < length; index++) values.push(selection[index]);
  return values.map(value => {
    if (typeof value === 'string') {
      return { key: value, isCollection: false };
    }
    const { key, kind } = readToken(value);
    return { key, isCollection: kind === 'collection' };
  });
}

export function selectScope(
  graph: BindingGraph,
  args: readonly unknown[],
  isTransient: (key: BindingKey) => boolean,
): { readonly graph: BindingGraph; readonly shared: readonly BindingId[] } {
  if (args.length === 0) return { graph, shared: [] };
  if (args.length > 3) {
    throw libraryError(
      'DI_BAG_INVALID_SCOPE',
      'createScope accepts sharing options or selected keys, overrides and optional sharing options',
      { operation: 'createScope' },
    );
  }
  const hasOverrides = args.length >= 2;
  const selectedKeys = hasOverrides ? snapshot(args[0]) : [];
  const selected = selectedKeys.map(entry => entry.key);
  const overrides = hasOverrides ? args[1] : undefined;
  if (
    hasOverrides
    && (typeof overrides !== 'object' || overrides === null || Array.isArray(overrides))
  ) {
    throw libraryError(
      'DI_BAG_INVALID_SCOPE',
      'createScope requires an override object',
      { operation: 'createScope' },
    );
  }
  const options = hasOverrides ? args[2] : args[0];
  let shareKeys: BindingKey[] = [];
  let sharedSelection: SelectedKey[] = [];
  if (options !== undefined || !hasOverrides) {
    if (
      typeof options !== 'object'
      || options === null
      || Array.isArray(options)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(options))
      || Reflect.ownKeys(options).some(key => key !== 'share')
      || !Object.hasOwn(options, 'share')
    ) {
      throw libraryError(
        'DI_BAG_INVALID_SCOPE',
        'createScope options require only an own share selection',
        { operation: 'createScope' },
      );
    }
    sharedSelection = snapshot(Reflect.get(options, 'share'));
    shareKeys = sharedSelection.map(entry => entry.key);
  }
  for (const { key, isCollection } of sharedSelection) {
    if (isCollection) {
      throw wrongTokenKind('createScope', 'single-service', key as symbol);
    }
  }
  for (const { key, isCollection } of [...selectedKeys, ...sharedSelection]) {
    if (!isCollection && !graph.hasPublic(key)) {
      throw libraryError(
        'DI_BAG_INVALID_SCOPE',
        `createScope accepts existing names or typed tokens only: ${String(key)}`,
        { operation: 'createScope' },
      );
    }
  }
  const selectedSet = new Set(selected);
  const shared = [...new Set(shareKeys)].map(key => {
    if (selectedSet.has(key)) {
      throw libraryError(
        'DI_BAG_INVALID_SCOPE',
        `createScope cannot share and override the same token: ${String(key)}`,
        { operation: 'createScope' },
      );
    }
    const id = graph.publicBinding(key);
    if (isTransient(key)) {
      throw libraryError(
        'DI_BAG_INVALID_SCOPE',
        `createScope cannot share transient providers: ${String(key)}`,
        { operation: 'createScope' },
      );
    }
    return id;
  });
  for (const key of selectedSet) {
    if (!Object.hasOwn(overrides!, key)) {
      throw libraryError(
        'DI_BAG_INVALID_SCOPE',
        `missing createScope override: ${String(key)}`,
        { operation: 'createScope' },
      );
    }
  }
  const bindings: Array<readonly [BindingKey, Registration]> = [];
  for (const key of selectedSet) {
    const registration: unknown = Reflect.get(overrides!, key);
    normalize(registration);
    bindings.push([key, registration as Registration]);
  }
  return { graph: graph.withPublicBindings(bindings), shared };
}
```

Use these complete changed method bodies:

```ts
createScope(...args: unknown[]): unknown {
  this.#runtime.assertOpen();
  const { graph, shared } = selectScope(
    this.#graph,
    args,
    key => this.#runtime.isTransient(key),
  );
  return new Bag(graph, this.context, this.#runtime.scope(graph, shared));
}

fork(keys?: readonly unknown[], overrides?: object): unknown {
  this.#runtime.assertOpen();
  if (keys === undefined && overrides === undefined) {
    return new Bag(this.#graph, this.context);
  }
  if (!Array.isArray(keys) || typeof overrides !== 'object' || overrides === null) {
    throw libraryError(
      'DI_BAG_INVALID_OVERRIDE',
      'fork requires selected keys and an override object',
      { operation: 'fork' },
    );
  }
  const selectedKeys: unknown[] = [];
  const length = keys.length;
  for (let index = 0; index < length; index++) {
    selectedKeys[index] = keys[index];
  }
  if (selectedKeys.length === 0) return new Bag(this.#graph, this.context);
  const collectionKeys = new Set<BindingKey>();
  const publicKeys = selectedKeys.map(value => {
    if (typeof value === 'string') return value;
    const { key, kind } = readToken(value);
    if (kind === 'collection') collectionKeys.add(key);
    return key;
  });
  for (const key of publicKeys) {
    if (!collectionKeys.has(key) && !this.#graph.hasPublic(key)) {
      throw libraryError(
        'DI_BAG_INVALID_OVERRIDE',
        `fork accepts existing names or typed tokens only: ${String(key)}`,
        { operation: 'fork' },
      );
    }
    if (!Object.hasOwn(overrides, key)) {
      throw libraryError(
        'DI_BAG_INVALID_OVERRIDE',
        `missing override: ${String(key)}`,
        { operation: 'fork' },
      );
    }
  }
  const selectedBindings: Array<readonly [BindingKey, Registration]> = [];
  for (const key of publicKeys) {
    const registration: unknown = Reflect.get(overrides, key);
    normalize(registration);
    selectedBindings.push([key, registration as Registration]);
  }
  return new Bag(
    this.#graph.withPublicBindings(selectedBindings),
    this.context,
  );
}

replace(selection: string | TokenBase, registration: Registration): unknown {
  const selected = typeof selection === 'string'
    ? undefined
    : readToken(selection);
  const key = selected === undefined ? selection as string : selected.key;
  if (selected?.kind !== 'collection' && !this.#graph.hasPublic(key)) {
    throw libraryError(
      'DI_BAG_INVALID_REPLACEMENT',
      `replace accepts existing names or typed tokens only: ${String(key)}`,
      { operation: 'replace', key },
    );
  }
  normalize(registration);
  return new Builder(
    this.#graph.withPublicBinding(key, registration),
    this.context,
  );
}
```

`Builder.register` uses this complete implementation; `withTokenBinding` is unchanged in this phase and still normalizes/retains the provider after token authentication:

```ts
register(moreOrToken: unknown, registration?: Registration): unknown {
  if (arguments.length === 1) {
    const snapshot = snapshotAdd(
      moreOrToken,
      key => this.#graph.hasPublic(key),
    );
    return new Builder(
      this.#graph.withPublicRegistrations(snapshot),
      this.context,
    );
  }
  const key = readSingleServiceKey(moreOrToken, 'register');
  if (this.#graph.hasPublic(key)) {
    throw libraryError(
      'DI_BAG_DUPLICATE_REGISTRATION',
      `duplicate registration: ${String(key)}`,
      { operation: 'register', key },
    );
  }
  return new Builder(
    this.#graph.withPublicBinding(
      key,
      withTokenBinding(moreOrToken as never, registration as never),
    ),
    this.context,
  );
}
```

In `sealModule`, the complete changed loop is:

```ts
const selected: unknown[] = [];
const length = keys.length;
for (let index = 0; index < length; index++) selected[index] = keys[index];
const exports = new Map<BindingKey, BindingKey>();
for (const value of selected) {
  const key = typeof value === 'string'
    ? value
    : readSingleServiceKey(value, 'buildModule');
  if (!graph.hasPublic(key)) {
    throw libraryError(
      'DI_BAG_INVALID_EXPORT',
      'buildModule accepts existing names or typed tokens only',
      { operation: 'buildModule' },
    );
  }
  exports.set(key, key);
}
```

- [ ] **Step 4: Verify every runtime behavior and error detail**

Run: `bun test tests/collection-tokens.test.ts`

Expected after the fresh-view assertions: 15 pass, 0 fail, 95 `expect()` calls. The original archived expand run was 15/89; the independent regression copy proves these six added assertions together with Task 8's kind rule.

- [ ] **Step 5: Commit runtime behavior**

```bash
git add src/contributions.ts src/scope-selection.ts src/module.ts src/di-bag.ts tests/collection-tokens.test.ts
git commit -m "feat: replace complete token collections" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL"
```

### Task 4: Make the collection contract type-safe across builders, modules and containers

**Files:**
- Modify: `src/tokens.ts`, `src/token-types.ts`, `src/contribution-types.ts`, `src/dependency-references.ts`, `src/types.ts`, `src/replacement-types.ts`, `src/scope-types.ts`, `src/alias-types.ts`, `src/module-types.ts`, `src/di-bag.ts`, `src/index.ts`
- Create: `tests/types/collection-tokens.ts`, `tests/types/negative/collection-tokens.ts`
- Modify: `tests/types.test.ts`

**Interfaces:**
- Consumes: contributions in `Constraints`, not `ServiceRegistrations`; phase-2 class generic names.
- Produces: the primary S5 conditional signatures and collection-aware selection/replacement helpers. These signatures are proposals and were not compiled while planning.

- [ ] **Step 1: Create the positive compiler fixture**

```ts
// tests/types/collection-tokens.ts
import { DiBag } from '../../src';
import type { CollectionToken, RegistrationSnapshot } from '../../src';

const controllersSymbol = Symbol('controllers');
type Controller = { readonly path: string };
const controllers = DiBag.token(controllersSymbol).forCollectionOf<Controller>();
const empty = DiBag.token(Symbol('empty')).forCollectionOf<number>();
controllers satisfies CollectionToken<typeof controllersSymbol, Controller>;

const module = DiBag.createBuilder()
  .contribute(controllers, () => ({ path: '/users' }))
  .register({ count: DiBag.fromFunction([controllers], list => list.length) })
  .buildModule(['count']);

const builder = DiBag.createBuilder()
  .installModule(module)
  .contribute(controllers, () => ({ path: '/orders' }))
  .alias('controllers', controllers)
  .register({
    first: ({ controllers }: { controllers: readonly Controller[] }) => controllers[0],
    lazy: DiBag.fromFunction([DiBag.lazy(controllers)], get => get),
  });
const bag = builder.build();
bag.resolve(controllers) satisfies readonly Controller[];
bag.resolve(empty) satisfies readonly number[];
bag.inspect(controllers) satisfies readonly RegistrationSnapshot[];
bag.resolve('controllers') satisfies readonly Controller[];
bag.resolve('lazy') satisfies () => readonly Controller[];
bag.ensureServicesReady([controllers, empty] as const) satisfies Promise<typeof bag>;

const replacement = (): readonly Controller[] => [{ path: '/fake' }];
bag.fork([controllers] as const, { [controllers.key]: replacement }).resolve(controllers) satisfies readonly Controller[];
bag.createScope([controllers] as const, { [controllers.key]: replacement }).resolve(controllers) satisfies readonly Controller[];
builder.replace(controllers, replacement).build().resolve(controllers) satisfies readonly Controller[];
```

Register it in `tests/types.test.ts` beside the existing contribution fixtures.

- [ ] **Step 2: Create exact negative cases**

```ts
// tests/types/negative/collection-tokens.ts
import { DiBag } from '../../../src';

const service = DiBag.token(Symbol('service')).of<number>();
const collection = DiBag.token(Symbol('collection')).forCollectionOf<number>();
const builder = DiBag.createBuilder().contribute(collection, () => 1);
const sharedKey = Symbol('shared');
const sharedService = DiBag.token(sharedKey).of<number>();
const sharedCollection = DiBag.token(sharedKey).forCollectionOf<number>();

// diagnostic: register requires a single-service token
DiBag.createBuilder().register(collection, () => [1]);
// diagnostic: alias destination requires a single-service token
DiBag.createBuilder().register({ value: () => 1 }).alias(collection, 'value');
// diagnostic: optional requires a single-service token
DiBag.optional(collection);
// diagnostic: createScope cannot share a collection token
builder.build().createScope({ share: [collection] as const });
// diagnostic: buildModule cannot export a collection token
builder.buildModule([collection] as const);
// diagnostic: token binding output is not assignable to its service
builder.replace(collection, () => [1, 'wrong']);
// diagnostic: token binding output is not assignable to its service
builder.build().fork([collection] as const, { [collection.key]: () => ['wrong'] });
// diagnostic: token symbol is already a single service in this graph
DiBag.createBuilder().register(sharedService, () => 1).contribute(sharedCollection, () => 2);
// diagnostic: token symbol is already a collection in this graph
DiBag.createBuilder().contribute(sharedCollection, () => 2).register(sharedService, () => 1);
```

The exact `Unsatisfied` strings above are the public contract. If TypeScript prints a wrapper but not the named phrase, repair the admission helper rather than weakening the marker.

- [ ] **Step 3: Define the kind and value helpers**

Use these complete signatures in `src/token-types.ts` (imports include `CollectionTokenBase`, `CollectionToken`, and `CollectionItem`):

```ts
export type TokenKindOf<T> = T extends CollectionTokenBase ? 'collection' : T extends TokenBase ? 'single-service' : never;
export type TokenValue<T> = T extends CollectionTokenBase ? readonly CollectionItem<T>[] : TokenService<T>;
export type SingleServiceTokenAdmission<TokenHandle> =
  TokenHandle extends CollectionTokenBase
    ? Unsatisfied<'operation requires a single-service token', {}>
    : unknown;
```

Make the source extractors total over both token classes:

```ts
export type TokenKey<T> = T extends infer Value & {}
  ? Value extends Token<infer TokenSymbol, infer _Service> ? TokenSymbol
    : Value extends CollectionToken<infer TokenSymbol, infer _Item> ? TokenSymbol
    : never
  : never;
export type TokenService<T> = T extends infer Value & {}
  ? Value extends Token<infer _TokenSymbol, infer Service> ? Service : never
  : never;
export type CollectionItem<T> = T extends infer Value & {}
  ? Value extends CollectionToken<infer _TokenSymbol, infer Item> ? Item : never
  : never;
```

Use `TokenValue` for a whole token binding. A contribution has a distinct output check because it produces one item:

```ts
export type BindingOutput<TokenHandle extends TokenBase, Provider extends Registration> =
  [ProviderOutput<Provider>] extends [TokenValue<TokenHandle>] ? unknown
    : Unsatisfied<'token binding output is not assignable to its service', {
        token: TokenKey<TokenHandle>; expected: TokenValue<TokenHandle>; provided: ProviderOutput<Provider>;
      }>;
export type CollectionBindingOutput<TokenHandle extends CollectionTokenBase, Provider extends Registration> =
  [ProviderOutput<Provider>] extends [CollectionItem<TokenHandle>] ? unknown
    : Unsatisfied<'collection contribution output is not assignable to its item', {
        token: TokenKey<TokenHandle>; expected: CollectionItem<TokenHandle>; provided: ProviderOutput<Provider>;
      }>;
```

In `src/contribution-types.ts`, keep the old `TokenBase` constraint only during expand. The contract step replaces the declarations and collection projection with these complete bodies:

```ts
export type Contribution<
  TokenHandle extends CollectionTokenBase = CollectionTokenBase,
  Provider extends Registration = Registration,
> = {
  readonly kind: 'contribution';
  readonly token: TokenHandle;
  readonly registration: Provider;
};
export type ContributionConstraint = Contribution<CollectionTokenBase, Registration>;
type Groups<Constraints> = Extract<Constraints, ContributionConstraint>;
type Same<Left, Right> = [Left] extends [Right] ? [Right] extends [Left] ? true : false : false;
type WrongMember<TokenHandle, Group> = Group extends ContributionConstraint
  ? TokenKey<TokenHandle> extends TokenKey<Group['token']>
    ? Same<TokenHandle, Group['token']> extends true ? never : TokenKey<TokenHandle>
    : never
  : never;
export type WrongGroup<TokenHandle, Constraints> = TokenHandle extends unknown
  ? ValidToken<TokenHandle> extends true
    ? WrongMember<TokenHandle, Groups<Constraints>>
    : 'opaque collection contract'
  : never;
export type CollectionMember<TokenHandle, Constraints> = TokenHandle extends CollectionTokenBase
  ? [WrongGroup<TokenHandle, Constraints>] extends [never] ? unknown
    : Unsatisfied<'collection token has an incompatible or opaque contract', {}>
  : Unsatisfied<'collection token has an incompatible or opaque contract', {}>;

export type ModuleContributions<ModuleValue> =
  ModuleValue extends Module<infer _Public, infer _Requirements, infer Constraints, infer _Providers>
    ? Readonly<{
        [TokenHandle in Groups<Constraints>['token'] as TokenKey<TokenHandle>]:
          readonly CollectionItem<TokenHandle>[];
      }>
    : never;
```

Give operation-specific wrappers the exact messages from the negative fixture (`RegisterTokenAdmission`, `AliasDestinationAdmission`, `OptionalTokenAdmission`, `ScopeShareAdmission`, `ModuleExportAdmission`) instead of exposing the generic word `operation`.

- [ ] **Step 4: Route dependency contracts by token kind**

`DependencyValue<CollectionToken<...>>` is `readonly Item[]`; `DependencyValue<LazyDependency<CollectionToken<...>>>` is `() => readonly Item[]`. `DependencyKind` for a bare collection remains `'required'` in inspection, but `ReferenceGraph` must place collection tokens into the graph contract's collection member so `MissingTokens` does not demand a singular registration. Replace the old `all` property with a named `collections` tuple internally if retaining a separate member keeps `CheckedContributions` cheap; the public snapshot still reports `kind: 'required'`.

Exact target:

```ts
export type TokenDependencyContract<
  Required extends readonly TokenBase[] = readonly [],
  Bound extends TokenBase = never,
  Optional extends readonly TokenBase[] = readonly [],
  Collections extends readonly CollectionTokenBase[] = readonly [],
> = { readonly kind: 'tokens'; readonly required: Required; readonly bound: Bound; readonly optional: Optional; readonly collections: Collections };
```

Replace the old `ReferenceTokens` and tuple fast path with this routing. The expand-only `'all'` branch accepts old callers; Task 8 deletes that branch.

```ts
type ReferenceRoute<Reference extends DependencyReference> =
  DependencyKind<Reference> extends 'optional' ? 'optional'
    : DependencyKind<Reference> extends 'all' ? 'collection'
    : DependencyToken<Reference> extends CollectionTokenBase ? 'collection'
    : 'required';
type ReferenceTokens<
  References extends readonly DependencyReference[],
  Kind extends 'required' | 'optional' | 'collection',
  Selected extends readonly TokenBase[] = readonly [],
> = References extends readonly [infer Head extends DependencyReference, ...infer Rest extends readonly DependencyReference[]]
  ? ReferenceRoute<Head> extends Kind
    ? ReferenceTokens<Rest, Kind, readonly [...Selected, DependencyToken<Head>]>
    : ReferenceTokens<Rest, Kind, Selected>
  : Selected;
export type ReferenceGraph<References extends readonly DependencyReference[]> = TokenDependencyContract<
  ReferenceTokens<References, 'required'>,
  never,
  ReferenceTokens<References, 'optional'>,
  Extract<ReferenceTokens<References, 'collection'>, readonly CollectionTokenBase[]>
>;
```

Use the four-member graph everywhere rather than leaving an old three-argument structural test:

```ts
export type GraphContract =
  | TokenDependencyContract<
      readonly TokenBase[],
      TokenBase,
      readonly TokenBase[],
      readonly CollectionTokenBase[]
    >
  | OpaqueGraph;
export type ReboundGraph<Graph extends GraphContract, TokenHandle extends TokenBase> =
  Graph extends infer Value & {}
    ? Value extends TokenDependencyContract<
        readonly TokenBase[],
        TokenBase,
        readonly TokenBase[],
        readonly CollectionTokenBase[]
      >
      ? { [Key in keyof Value]: Key extends 'bound' ? TokenHandle : Value[Key] }
      : Value extends GraphContract ? Value : never
    : never;

type RequiredTokens<Graph> = Graph extends TokenDependencyContract<
  infer Required,
  TokenBase,
  readonly TokenBase[],
  readonly CollectionTokenBase[]
> ? Required[number] : TokenBase;
type Bound<Graph> = Graph extends TokenDependencyContract<
  readonly TokenBase[],
  infer TokenHandle,
  readonly TokenBase[],
  readonly CollectionTokenBase[]
> ? TokenHandle : TokenBase;
type OptionalTokens<Graph> = Graph extends TokenDependencyContract<
  readonly TokenBase[],
  TokenBase,
  infer Optional,
  readonly CollectionTokenBase[]
> ? Optional[number] : TokenBase;
type CollectionTokens<Graph> = Graph extends TokenDependencyContract<
  readonly TokenBase[],
  TokenBase,
  readonly TokenBase[],
  infer Collections
> ? Collections[number] : never;

export type ProviderCollectionTokens<ProviderValue> =
  ProviderGraphContract<ProviderValue> extends infer Graph
    ? CollectionTokens<Graph>
    : never;
```

In `InvalidGraphs` and both structural checks in `src/module-types.ts`, use the same complete `TokenDependencyContract<readonly TokenBase[], TokenBase, readonly TokenBase[], readonly CollectionTokenBase[]>`. In `PublicGraph`, clear `'required' | 'optional' | 'collections'`; retain `bound`, `lifetime`, `alias`, and other metadata. `MissingTokens` continues to inspect `ProviderRequiredTokens` only. `CheckedContributions` includes `ProviderCollectionTokens` in `AllNeeds`. The expand shape may retain `{ kind: 'all' }` only for old callers; Task 8 removes it.

- [ ] **Step 5: Admit collection tokens through `Constraints` and replacements**

Add a second `TokenMember` path:

```ts
export type CollectionTokenMember<Constraints, T> = T extends CollectionTokenBase
  ? CollectionMember<T, Constraints>
  : never;
export type ServiceKeyMember<ServiceRegistrations extends Registrations, Constraints, T> =
  T extends CollectionTokenBase ? CollectionTokenMember<Constraints, T> : TokenMember<ServiceRegistrations, T>;
```

For a collection with no contribution, admission is still valid: its own nominal type is sufficient. `CollectionMember` checks incompatibility only when the same symbol exists among retained contributions. `Selection` and `SelectedRegistrations` overlay synthetic `Record<TokenKey<T>, () => TokenValue<T>>` slots for selected collection tokens, so `fork`, `createScope`, and `replace` contextually type replacement output as `readonly Item[]`. `ReboundSelection` must preserve that exact collection-token contract. Sharing uses the explicit negative admission before `Transients` indexing.

Replace the selection/rebinding block with this complete proposed code:

```ts
type InvalidSelectionElements<Keys extends readonly unknown[]> = {
  [Index in keyof Keys]-?: Singleton<Keys[Index]> extends true ? never
    : ValidToken<Keys[Index]> extends true ? never : Index;
}[number];
type InvalidSelectionMembers<ServiceRegistrations extends Registrations, Constraints, Value> =
  Value extends string ? never
    : Value extends CollectionTokenBase
      ? unknown extends CollectionMember<Value, Constraints> ? never : Value
      : unknown extends TokenMember<ServiceRegistrations, Value> ? never : Value;
type MissingSelectionKeys<ServiceRegistrations extends Registrations, Value> =
  Value extends CollectionTokenBase ? never : Exclude<SelectionKey<Value>, keyof ServiceRegistrations>;

export type Selection<
  ServiceRegistrations extends Registrations,
  Constraints,
  Keys extends readonly unknown[],
  Operation extends string = 'fork',
> = true extends IsUnion<Keys> ? InvalidSelection<Operation>
  : number extends Keys['length'] ? InvalidSelection<Operation>
  : Keys extends Required<Keys>
    ? [InvalidSelectionElements<Keys>] extends [never]
      ? [MissingSelectionKeys<ServiceRegistrations, Keys[number]>
          | InvalidSelectionMembers<ServiceRegistrations, Constraints, Keys[number]>] extends [never]
        ? unknown
        : Unsatisfied<
            `${Operation} accepts existing names or typed tokens only: unknown ${NameText<MissingSelectionKeys<ServiceRegistrations, Keys[number]> | InvalidSelectionMembers<ServiceRegistrations, Constraints, Keys[number]>>}${SeeErrors<'unknown-key'>}`,
            { extra: MissingSelectionKeys<ServiceRegistrations, Keys[number]> | InvalidSelectionMembers<ServiceRegistrations, Constraints, Keys[number]> }
          >
      : InvalidSelection<Operation>
    : InvalidSelection<Operation>;

export type SingleServiceSelection<Keys extends readonly unknown[], Operation extends string> =
  [Extract<Keys[number], CollectionTokenBase>] extends [never] ? unknown
    : Unsatisfied<`${Operation} cannot select a collection token`, {
        tokens: TokenKey<Extract<Keys[number], CollectionTokenBase>>;
      }>;

type CollectionSelectionMember<Value> = Value extends CollectionTokenBase
  ? Record<TokenKey<Value>, () => readonly CollectionItem<Value>[]>
  : never;
export type CollectionSelection<Keys extends readonly unknown[]> =
  [Extract<Keys[number], CollectionTokenBase>] extends [never] ? {}
    : Extract<Intersect<CollectionSelectionMember<Keys[number]>>, Registrations>;
export type SelectionRegistrations<
  ServiceRegistrations extends Registrations,
  Keys extends readonly unknown[],
> = OverrideRegistrations<ServiceRegistrations, CollectionSelection<Keys>>;
export type SelectedRegistrations<Keys extends readonly unknown[], OverridesObject> = {
  [Key in Extract<SelectionKey<Keys[number]>, keyof OverridesObject>]: Extract<OverridesObject[Key], Registration>;
};

type SelectedTokenForKey<Keys extends readonly unknown[], Key extends PropertyKey> =
  Keys[number] extends infer Value ? Value extends TokenBase
    ? TokenKey<Value> extends Key ? Value : never : never : never;
export type ReboundProviders<
  ServiceRegistrations extends Registrations,
  Keys extends readonly unknown[],
  OverridesMap extends Registrations,
> = {
  [Key in keyof OverridesMap]: Key extends symbol
    ? SelectedTokenForKey<Keys, Key> extends infer Selected extends TokenBase
      ? [Selected] extends [never]
        ? Key extends keyof ServiceRegistrations
          ? TokenBinding<BoundToken<ServiceRegistrations[Key]>, OverridesMap[Key]>
          : OverridesMap[Key]
        : TokenBinding<Selected, OverridesMap[Key]>
      : never
    : OverridesMap[Key];
};
export type ReboundSelection<
  ServiceRegistrations extends Registrations,
  Keys extends readonly unknown[],
  OverridesMap extends Registrations,
> = [Extract<keyof OverridesMap, symbol>] extends [never] ? OverridesMap
  : ReboundProviders<ServiceRegistrations, Keys, OverridesMap>;
export type ReboundSelected<
  ServiceRegistrations extends Registrations,
  Keys extends readonly unknown[],
  OverridesObject,
> = ReboundSelection<
  SelectionRegistrations<ServiceRegistrations, Keys>,
  Keys,
  SelectedRegistrations<Keys, OverridesObject>
>;
export type AppliedSelection<
  ServiceRegistrations extends Registrations,
  Keys extends readonly unknown[],
  OverridesObject,
> = OverrideRegistrations<
  SelectionRegistrations<ServiceRegistrations, Keys>,
  ReboundSelected<ServiceRegistrations, Keys, OverridesObject>
>;
```

Replace `OverrideFactoryContext` with:

```ts
export type OverrideFactoryContext<
  ServiceRegistrations extends Registrations,
  Keys extends readonly unknown[],
  OverridesObject,
  Base extends Registrations = SelectionRegistrations<ServiceRegistrations, Keys>,
  Applied extends Registrations = AppliedSelection<ServiceRegistrations, Keys, OverridesObject>,
> = {
  [Key in Extract<SelectionKey<Keys[number]>, keyof Base>]:
    | ((this: void, dependencies: ServicesOf<Applied>) => ServicesOf<Base>[Key])
    | FactoryWithDisposal<(this: void, dependencies: ServicesOf<Applied>) => ServicesOf<Base>[Key]>
    | ProviderContext<
        (this: void, dependencies: ServicesOf<Applied>) => ServicesOf<Base>[Key],
        Key extends keyof OverridesObject
          ? ProviderGraphContract<Extract<OverridesObject[Key], Registration>>
          : TokenDependencyContract
      >;
};
```

- [ ] **Step 6: Use the full primary public signatures**

Inside the phase-2 generic names, use:

```ts
resolve<Key extends (keyof ServiceRegistrations & string) | TokenBase>(
  serviceKey: Key & ([Key] extends [string] ? unknown : ServiceKeyMember<ServiceRegistrations, Constraints, Key>),
): Key extends CollectionTokenBase
  ? TokenValue<Key>
  : ServicesOf<ServiceRegistrations>[SelectionKey<Key> & keyof ServiceRegistrations];

inspect<Key extends (keyof ServiceRegistrations & string) | TokenBase>(
  serviceKey: Key & ([Key] extends [string] ? unknown : ServiceKeyMember<ServiceRegistrations, Constraints, Key>),
): Key extends CollectionTokenBase
  ? readonly RegistrationSnapshot[]
  : RegistrationSnapshot<
      ProviderRegistrationMetadata<ServiceRegistrations[SelectionKey<Key> & keyof ServiceRegistrations]>,
      ProviderAcquisitionMetadata<ServiceRegistrations[SelectionKey<Key> & keyof ServiceRegistrations]>
    >;
```

Define the operation-specific admissions and alias/replacement helpers exactly as follows:

```ts
type RetainedCollectionKeys<Constraints> =
  TokenKey<Extract<Constraints, ContributionConstraint>['token']>;
export type RegisterTokenAdmission<TokenHandle, Constraints> =
  TokenHandle extends CollectionTokenBase
    ? Unsatisfied<'register requires a single-service token', {}>
    : TokenKey<TokenHandle> extends RetainedCollectionKeys<Constraints>
      ? Unsatisfied<'token symbol is already a collection in this graph', {}>
      : unknown;
export type CollectionTokenAdmission<
  ServiceRegistrations extends Registrations,
  TokenHandle,
> = TokenHandle extends CollectionTokenBase
  ? TokenKey<TokenHandle> extends keyof ServiceRegistrations
    ? BoundToken<ServiceRegistrations[TokenKey<TokenHandle>]> extends CollectionTokenBase
      ? unknown
      : Unsatisfied<'token symbol is already a single service in this graph', {}>
    : unknown
  : Unsatisfied<'contribute requires a collection token', {}>;
export type AliasDestinationAdmission<Destination> = Destination extends CollectionTokenBase
  ? Unsatisfied<'alias destination requires a single-service token', {}> : unknown;
export type OptionalTokenAdmission<TokenHandle> = TokenHandle extends CollectionTokenBase
  ? Unsatisfied<'optional requires a single-service token', {}> : unknown;
export type ScopeShareAdmission<Keys extends readonly unknown[]> =
  [Extract<Keys[number], CollectionTokenBase>] extends [never] ? unknown
    : Unsatisfied<'createScope cannot share a collection token', {
        tokens: TokenKey<Extract<Keys[number], CollectionTokenBase>>;
      }>;
export type ModuleExportAdmission<Keys extends readonly unknown[]> =
  [Extract<Keys[number], CollectionTokenBase>] extends [never] ? unknown
    : Unsatisfied<'buildModule cannot export a collection token', {
        tokens: TokenKey<Extract<Keys[number], CollectionTokenBase>>;
      }>;

export type AliasTarget<ServiceRegistrations extends Registrations, Constraints, Target> =
  Target extends string
    ? Target extends keyof ServiceRegistrations ? unknown
      : Unsatisfied<'alias requires an existing named target', {}>
    : Target extends CollectionTokenBase ? CollectionMember<Target, Constraints>
    : [WrongToken<Target, ServiceRegistrations>] extends [never] ? unknown
    : Unsatisfied<'token dependency has an incompatible or opaque contract', {}>;
export type AliasOutput<ServiceRegistrations extends Registrations, Target> =
  Target extends string
    ? Target extends keyof ServiceRegistrations ? ProviderOutput<ServiceRegistrations[Target]> : never
    : TokenValue<Target>;
export type AliasDestination<
  ServiceRegistrations extends Registrations,
  Destination,
  Target,
> = Destination extends TokenBase
  ? [AliasOutput<ServiceRegistrations, Target>] extends [TokenValue<Destination>] ? unknown
    : Unsatisfied<'alias output is not assignable to destination service', {}>
  : unknown;

export type AliasRegistration<
  ServiceRegistrations extends Registrations,
  Destination,
  Target,
> = Provider<
  (
    this: void,
    dependencies: Target extends string
      ? Record<Target, AliasOutput<ServiceRegistrations, Target>>
      : Record<never, never>,
  ) => AliasOutput<ServiceRegistrations, Target>,
  Readonly<object>,
  readonly unknown[],
  Target extends CollectionTokenBase
    ? TokenDependencyContract<
        readonly [],
        Destination extends TokenBase ? Destination : never,
        readonly [],
        readonly [Target]
      >
    : TokenDependencyContract<
        Target extends TokenBase ? readonly [Target] : readonly [],
        Destination extends TokenBase ? Destination : never
      > & { readonly alias: SelectionKey<Target> },
  unknown
>;
export type AliasEntries<
  ServiceRegistrations extends Registrations,
  Destination,
  Target,
> = Record<
  SelectionKey<Destination>,
  AliasRegistration<ServiceRegistrations, Destination, Target>
>;
export type AliasEntry<
  ServiceRegistrations extends Registrations,
  Destination,
  Target,
> = unknown extends AliasAdmission<Destination> & AliasAdmission<Target>
  ? {
      key: SelectionKey<Destination>;
      registration: AliasRegistration<ServiceRegistrations, Destination, Target>;
    }
  : never;

export type ReplacementAdmission<
  ServiceRegistrations extends Registrations,
  Constraints,
  Key extends string | TokenBase,
> = [Key] extends [string] ? ReplacementKey<ServiceRegistrations, Key>
  : Key extends CollectionTokenBase ? CollectionMember<Key, Constraints>
  : TokenMember<ServiceRegistrations, Key>;
```

`BuilderReplacementRegistration` keeps its string branch. Its token branch uses `BindingOutput` (now based on `TokenValue`) and overlays the collection slot before checking constraints:

```ts
export type BuilderReplacementRegistration<
  Entries extends Entry,
  Constraints extends NeedConstraint,
  Key extends string | TokenBase,
  Provider extends Registration,
> = [Key] extends [string]
  ? IncrementalChecked<Entries, Record<Key, NoInfer<Provider>>>
    & CheckedConstraints<Constraints, OverrideRegistrations<RegistrationsFromEntries<Entries>, Record<Key, NoInfer<Provider>>>>
  : [Key] extends [TokenBase]
    ? BindingOutput<NoInfer<Key>, NoInfer<Provider>>
      & IncrementalChecked<Entries, Record<TokenKey<Key>, TokenBinding<NoInfer<Key>, NoInfer<Provider>>>>
      & CheckedConstraints<
          Constraints,
          OverrideRegistrations<
            SelectionRegistrations<RegistrationsFromEntries<Entries>, readonly [Key]>,
            Record<TokenKey<Key>, TokenBinding<NoInfer<Key>, NoInfer<Provider>>>
          >
        >
    : never;
```

Use these complete `Bag` overloads. Every call to the new four-parameter `Selection` supplies `Constraints`; this includes phase 2's `buildAndStart` and phase 3's `ensureServicesReady`:

```ts
createScope(): Bag<UnsharedAliases<ServiceRegistrations>, Constraints>;

ensureServicesReady<const Keys extends readonly unknown[]>(
  serviceKeys: Keys & Selection<ServiceRegistrations, Constraints, Keys, 'ensureServicesReady'>,
  options?: EnsureServicesReadyOptions,
): Promise<this>;

fork(
  this: Bag<ServiceRegistrations, Constraints>
    & CheckedLifetimes<UnsharedAliases<ServiceRegistrations>, Constraints>,
): Bag<UnsharedAliases<ServiceRegistrations>, Constraints>;

fork<
  const Keys extends readonly unknown[],
  OverridesObject extends OverrideFactoryContext<ServiceRegistrations, Keys, OverridesObject>,
>(
  keys: Keys & Selection<ServiceRegistrations, Constraints, Keys>,
  overrides: OverridesObject & object
    & Record<SelectionKey<Keys[number]>, Registration>
    & Overrides<SelectionRegistrations<ServiceRegistrations, Keys>, ReboundSelected<ServiceRegistrations, Keys, OverridesObject>>
    & CheckDependencyCompatibility<AppliedSelection<ServiceRegistrations, Keys, OverridesObject>>
    & CheckDependencyCompleteness<AppliedSelection<ServiceRegistrations, Keys, OverridesObject>>
    & CheckedConstraints<Constraints, AppliedSelection<ServiceRegistrations, Keys, OverridesObject>>
    & CompleteConstraints<Constraints, AppliedSelection<ServiceRegistrations, Keys, OverridesObject>>
    & CheckedLifetimes<
        UnsharedAliases<AppliedSelection<ServiceRegistrations, Keys, OverridesObject>>,
        WithoutExportObligations<Constraints, SelectionKey<Keys[number]>>
      >,
): Bag<
  UnsharedAliases<AppliedSelection<ServiceRegistrations, Keys, OverridesObject>>,
  WithoutExportObligations<Constraints, SelectionKey<Keys[number]>>
>;

createScope<const SharedKeys extends readonly unknown[]>(
  options: ScopeOptions<ServiceRegistrations, SharedKeys, Constraints>,
): Bag<ScopedAliases<ServiceRegistrations, ServiceRegistrations, SharedKeys>, Constraints>;

createScope<
  const Keys extends readonly unknown[],
  OverridesObject extends OverrideFactoryContext<ServiceRegistrations, Keys, OverridesObject>,
  const SharedKeys extends readonly unknown[] = readonly [],
>(
  keys: Keys & Selection<ServiceRegistrations, Constraints, Keys, 'createScope'>,
  overrides: OverridesObject & object
    & Record<SelectionKey<Keys[number]>, Registration>
    & Overrides<SelectionRegistrations<ServiceRegistrations, Keys>, ReboundSelected<ServiceRegistrations, Keys, OverridesObject>>
    & CheckDependencyCompatibility<AppliedSelection<ServiceRegistrations, Keys, OverridesObject>>
    & CheckDependencyCompleteness<AppliedSelection<ServiceRegistrations, Keys, OverridesObject>>
    & CheckedConstraints<Constraints, AppliedSelection<ServiceRegistrations, Keys, OverridesObject>>
    & CompleteConstraints<Constraints, AppliedSelection<ServiceRegistrations, Keys, OverridesObject>>
    & CheckedScopeLifetimes<
        NoInfer<ScopedAliases<AppliedSelection<ServiceRegistrations, Keys, OverridesObject>, ServiceRegistrations, SharedKeys>>,
        NoInfer<ReboundSelected<ServiceRegistrations, Keys, OverridesObject>>,
        WithoutExportObligations<Constraints, SelectionKey<Keys[number]>>
      >,
  options?: ScopeOptions<ServiceRegistrations, SharedKeys, Constraints> & DisjointScopeSelection<Keys, SharedKeys>,
): Bag<
  ScopedAliases<AppliedSelection<ServiceRegistrations, Keys, OverridesObject>, ServiceRegistrations, SharedKeys>,
  WithoutExportObligations<Constraints, SelectionKey<Keys[number]>>
>;

buildAndStart<const Keys extends readonly unknown[]>(
  this: Builder<Entries, Constraints>
    & CheckDependencyCompleteness<RegistrationsFromEntries<Entries>>
    & CompleteConstraints<Constraints, RegistrationsFromEntries<Entries>>
    & CheckedLifetimes<RegistrationsFromEntries<Entries>, Constraints>,
  keys: Keys & Selection<
    RegistrationsFromEntries<Entries>,
    Constraints,
    Keys,
    'buildAndStart'
  >,
  options?: StartupOptions,
): Promise<Bag<RegistrationsFromEntries<Entries>, Constraints>>;
```

Change `ScopeOptions` so sharing remains singular:

```ts
export type ScopeOptions<
  ServiceRegistrations extends Registrations,
  SharedKeys extends readonly unknown[],
  Constraints extends NeedConstraint = never,
> = {
  readonly share: SharedKeys
    & Selection<ServiceRegistrations, Constraints, SharedKeys, 'createScope share'>
    & ScopeShareAdmission<SharedKeys>
    & ([Transients<ServiceRegistrations, SharedKeys>] extends [never] ? unknown
      : Unsatisfied<'createScope cannot share transient providers', {
          tokens: Transients<ServiceRegistrations, SharedKeys>;
        }>);
};
```

Keep `ServiceRegistrations` and `SharedKeys` as the first two generic positions from 0.4.0 and append defaulted `Constraints` third. Existing explicit `ScopeOptions<R, S>` annotations therefore keep compiling and default to `never`; the bag's overloads pass their retained constraints explicitly as the third argument.

Use these complete changed `Builder` overloads:

```ts
register<Named extends { [Key in keyof Named]: Registration }>(
  more: Named & Registrations & ([Named] extends [never]
    ? never
    : NamedAdmission<Named>
      & ThenableAdmission<Named>
      & IntroducesKeys<EntryKeys<Entries>, keyof Named>
      & IncrementalChecked<Entries, Named>
      & CheckedConstraints<
          Constraints,
          OverrideRegistrations<RegistrationsFromEntries<Entries>, Named>
        >),
): Builder<Entries | RegistrationEntries<Named>, Constraints>;

register<TokenHandle extends TokenBase, Provider extends Registration>(
  token: TokenHandle
    & TokenTupleAdmission<readonly [TokenHandle]>
    & RegisterTokenAdmission<TokenHandle, Constraints>
    & IntroducesKeys<EntryKeys<Entries>, TokenKey<TokenHandle>>,
  registration: Provider & Registration
    & BindingOutput<NoInfer<TokenHandle>, NoInfer<Provider>>
    & ThenableAdmission<Record<TokenKey<TokenHandle>, NoInfer<Provider>>>
    & IncrementalChecked<Entries, Record<TokenKey<TokenHandle>, TokenBinding<NoInfer<TokenHandle>, NoInfer<Provider>>>>
    & CheckedConstraints<
        Constraints,
        OverrideRegistrations<
          RegistrationsFromEntries<Entries>,
          Record<TokenKey<TokenHandle>, TokenBinding<NoInfer<TokenHandle>, NoInfer<Provider>>>
        >
      >,
): Builder<Entries | {
  key: TokenKey<TokenHandle>;
  registration: TokenBinding<TokenHandle, Provider>;
}, Constraints>;

alias<const Destination extends AliasSelection, const Target extends AliasSelection>(
  destination: Destination
    & AliasDestinationAdmission<Destination>
    & (unknown extends AliasAdmission<Destination>
      ? Introduces<RegistrationsFromEntries<Entries>, AliasEntries<RegistrationsFromEntries<Entries>, Destination, Target>>
      : AliasAdmission<Destination>),
  target: Target & AliasAdmission<Target>
    & (unknown extends AliasAdmission<Target>
      ? AliasTarget<RegistrationsFromEntries<Entries>, Constraints, Target>
        & AliasDestination<RegistrationsFromEntries<Entries>, NoInfer<Destination>, Target>
      : unknown)
    & (unknown extends AliasAdmission<Destination> & AliasAdmission<Target>
      ? IncrementalChecked<Entries, AliasEntries<RegistrationsFromEntries<Entries>, NoInfer<Destination>, NoInfer<Target>>>
        & CheckedConstraints<
            Constraints,
            OverrideRegistrations<
              RegistrationsFromEntries<Entries>,
              AliasEntries<RegistrationsFromEntries<Entries>, NoInfer<Destination>, NoInfer<Target>>
            >
          >
      : unknown),
  ...invalid: [Destination] extends [never] ? [never] : [Target] extends [never] ? [never] : []
): Builder<Entries | AliasEntry<RegistrationsFromEntries<Entries>, Destination, Target>, Constraints>;

replace<
  const Key extends string,
  Provider extends
    | ReplacementFactory<
        ReplacementOutput<NoInfer<RegistrationsFromEntries<Entries>>, Key, Constraints>
      >
    | FactoryWithDisposal<
        ReplacementFactory<
          ReplacementOutput<NoInfer<RegistrationsFromEntries<Entries>>, Key, Constraints>
        >
      >,
>(
  key: Key & ReplacementKeyOf<EntryKeys<Entries>, Key>,
  registration: Provider
    & (Factory | FactoryWithDisposal<Factory>)
    & ZeroDependencyAdmission<NoInfer<Provider>>
    & CheckedConstraints<
        Constraints,
        OverrideRegistrations<
          RegistrationsFromEntries<Entries>,
          Record<Key, NoInfer<Provider>>
        >
      >,
): Builder<
  Exclude<Entries, { key: Key }> | { key: Key; registration: Provider },
  WithoutExportObligations<Constraints, Key>
>;

replace<const Key extends string | TokenBase, Provider extends Registration>(
  key: Key & NoInfer<ReplacementAdmission<RegistrationsFromEntries<Entries>, Constraints, Key>>,
  registration: Provider & Registration
    & BuilderReplacementRegistration<Entries, Constraints, NoInfer<Key>, Provider>,
): Builder<
  ReplacedEntries<Entries, Key, Provider>,
  WithoutExportObligations<Constraints, SelectionKey<Key>>
>;

buildModule<const Keys extends readonly unknown[]>(
  keys: Keys
    & Selection<RegistrationsFromEntries<Entries>, Constraints, Keys, 'buildModule'>
    & ModuleExportAdmission<Keys>
    & SealAdmission<
        RegistrationsFromEntries<Entries>,
        Extract<SelectionKey<Keys[number]>, keyof RegistrationsFromEntries<Entries>>,
        Constraints
      >,
  options?: ModuleOptions,
): Module<
  ExportedServices<ServicesOf<RegistrationsFromEntries<Entries>>, Extract<SelectionKey<Keys[number]>, keyof RegistrationsFromEntries<Entries>>>,
  ExternalRequirements<ModuleSealedConstraints<Entries, Constraints, Extract<SelectionKey<Keys[number]>, keyof RegistrationsFromEntries<Entries>>>>,
  ModuleSealedConstraints<Entries, Constraints, Extract<SelectionKey<Keys[number]>, keyof RegistrationsFromEntries<Entries>>>,
  ModulePublicProviders<RegistrationsFromEntries<Entries>, Extract<SelectionKey<Keys[number]>, keyof RegistrationsFromEntries<Entries>>>
>;
```

The dependency helper signature is also changed and must expose its own exact compile-time admission:

```ts
export function optional<TokenHandle extends TokenBase>(
  token: TokenHandle
    & TokenTupleAdmission<readonly [TokenHandle]>
    & OptionalTokenAdmission<TokenHandle>,
  ...invalid: [TokenHandle] extends [never]
    ? [TokenTupleAdmission<readonly [TokenHandle]>]
    : []
): OptionalDependency<TokenHandle>;
```

Runtime implementations pair with those overloads exactly: token `register` calls `readSingleServiceKey(moreOrToken, 'register')` before duplicate/provider work; `aliasEntry` authenticates its destination with `readSingleServiceKey(destination, 'alias')`; `buildModule` authenticates token exports with `readSingleServiceKey(value, 'buildModule')`; `contributionEntry` remains expand-compatible until Task 8, then checks for `kind === 'collection'` before `normalize`.

`ensureServicesReady`'s tuple admission uses the same member check. Add a `BuilderContribute` overload constrained as `Token extends CollectionTokenBase`, returning `Builder<Entries, Constraints | Contribution<Token, Provider>>` and checking output against `CollectionItem<Token>`, not the list type. Keep the existing single-token signature directly after it as an `@deprecated` expand-only compatibility overload; Task 8 deletes it after migration. Alias target output is `TokenValue<Target>`; alias destination is restricted to string or single-service token.

The complete expand callable is:

```ts
export interface BuilderContribute<Entries extends Entry, Constraints extends NeedConstraint> {
  <Token extends CollectionTokenBase, Provider extends Registration>(
    token: Token
      & TokenTupleAdmission<readonly [Token]>
      & CollectionTokenAdmission<RegistrationsFromEntries<Entries>, Token>,
    registration: Provider & Registration
      & CollectionBindingOutput<NoInfer<Token>, NoInfer<Provider>>
      & CheckedConstraints<Constraints | Contribution<NoInfer<Token>, NoInfer<Provider>>, RegistrationsFromEntries<Entries>>,
    ...invalid: [Token] extends [never] ? [never] : [Provider] extends [never] ? [never] : []
  ): import('./di-bag').Builder<Entries, Constraints | Contribution<Token, Provider>>;
  /** @deprecated Expand-only compatibility; removed in this phase's contract step. */
  <Token extends TokenBase, Provider extends Registration>(
    token: Token & TokenTupleAdmission<readonly [Token]>,
    registration: Provider & Registration
      & BindingOutput<NoInfer<Token>, NoInfer<Provider>>
      & CheckedConstraints<Constraints | Contribution<NoInfer<Token>, NoInfer<Provider>>, RegistrationsFromEntries<Entries>>,
    ...invalid: [Token] extends [never] ? [never] : [Provider] extends [never] ? [never] : []
  ): import('./di-bag').Builder<Entries, Constraints | Contribution<Token, Provider>>;
}
```

Use the bracketed `CollectionBindingOutput` definition from Step 3; do not add a second conditional with different distribution behavior.

Before compiling, reconcile imports by owner rather than creating duplicate helpers:

- `src/tokens.ts` owns and exports `CollectionTokenBase`, `CollectionToken`, `CollectionItem`, `TokenKind`, `readToken`, `readSingleServiceKey`, and `wrongTokenKind`.
- `src/token-types.ts` owns `TokenValue`, `CollectionBindingOutput`, `CollectionTokenMember`, `ServiceKeyMember`, `AliasDestinationAdmission`, `OptionalTokenAdmission`, the four-member `TokenDependencyContract`, and `ReferenceGraph`; it imports the collection classes/extractor from `./tokens`.
- `src/contribution-types.ts` owns `Contribution`, `ContributionConstraint`, `CollectionMember`, `RegisterTokenAdmission`, `CollectionTokenAdmission`, and `ModuleContributions`; it imports `CollectionTokenBase` and `CollectionItem` from `./tokens`, plus `BoundToken` and `CollectionBindingOutput` from `./token-types`.
- `src/types.ts` owns `Selection`, `CollectionSelection`, `SelectionRegistrations`, `SelectedRegistrations`, `ReboundProviders`, `ReboundSelection`, `ReboundSelected`, `AppliedSelection`, and `OverrideFactoryContext`; it imports `CollectionMember` and the collection token helpers, while reusing its existing private `Intersect`.
- `src/alias-types.ts` owns every `Alias*` declaration printed above; it imports `CollectionMember`, `TokenValue`, and `TokenDependencyContract`.
- `src/replacement-types.ts` owns `ReplacementAdmission` and `BuilderReplacementRegistration`; it imports `SelectionRegistrations` and `CollectionMember`.
- `src/scope-types.ts` owns `ScopeShareAdmission` and the new three-parameter `ScopeOptions`. `src/module-types.ts` owns `ModuleExportAdmission`. `src/di-bag.ts` imports each admission from that single owner; do not duplicate declarations.

- [ ] **Step 7: Compile only the focused fixtures first**

Run the existing compiler-fixture command used by neighboring entries in `tests/types.test.ts`; if no per-case script exists, run `bun test tests/types.test.ts --test-name-pattern 'collection tokens'`.

Expected: the positive fixture has zero diagnostics; each negative marker matches one diagnostic on the following line.

This is the first compile attempt for these proposed types. Make at most three serious repairs. Do not erase nominal invariance, turn errors into `never`, weaken the negative fixtures, or move contributions into the ordinary registrations map.

- [ ] **Step 8: Run spike S5 measurements and decide**

```bash
node scripts/evidence-cases.mjs --compare docs/superpowers/plans/evidence/baseline.md --json /tmp/phase-04-expand-rows.json > /tmp/phase-04-expand-table.md
```

Expected: exit 0, twelve accepted cases, no diagnostics, and each case at most +10% over the baseline. Copy the complete table from `/tmp/phase-04-expand-table.md` into `docs/superpowers/plans/evidence/phase-04.md` under `## Expand (S5)`, then append `Decision: adopted`. The JSON file is raw reproducibility data and stays outside the repository.

- [ ] **Step 9: Commit the adopted primary shape**

```bash
git add src tests/types tests/types.test.ts docs/superpowers/plans/evidence/phase-04.md
git commit -m "feat: type collection tokens across the graph" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL"
```

### Task 5: Apply the complete S5 fallback if the conditional shape fails

**Files:**
- Modify: the Task 4 files and fixtures
- Modify: `docs/superpowers/plans/evidence/phase-04.md`

**Interfaces:**
- Consumes: Task 4's three-attempt rule or evidence failure.
- Produces: fallback `resolveCollection` and `inspectCollection`; ordinary `resolve` and `inspect` remain single-service-only.

- [ ] **Step 1: Record why the primary shape failed**

In `phase-04.md`, record each attempted signature, the fixture diagnostic or twelve-case numbers, and `Decision: fallback`. Also add the measured exception to `docs/guides/api-naming.md` as rule 15 requires.

- [ ] **Step 2: Replace only the hot conditional calls**

Use these full signatures:

```ts
resolve<Key extends (keyof ServiceRegistrations & string) | TokenBase>(
  serviceKey: Key & ([Key] extends [string] ? unknown : TokenMember<ServiceRegistrations, Key>),
): ServicesOf<ServiceRegistrations>[SelectionKey<Key> & keyof ServiceRegistrations];

resolveCollection<Token extends CollectionTokenBase>(
  collectionToken: Token & CollectionMember<Token, Constraints>,
  ...invalid: [Token] extends [never] ? [never] : []
): readonly CollectionItem<Token>[];

inspect<Key extends (keyof ServiceRegistrations & string) | TokenBase>(
  serviceKey: Key & ([Key] extends [string] ? unknown : TokenMember<ServiceRegistrations, Key>),
): RegistrationSnapshot<ProviderRegistrationMetadata<ServiceRegistrations[SelectionKey<Key> & keyof ServiceRegistrations]>, ProviderAcquisitionMetadata<ServiceRegistrations[SelectionKey<Key> & keyof ServiceRegistrations]>>;

inspectCollection<Token extends CollectionTokenBase>(
  collectionToken: Token & CollectionMember<Token, Constraints>,
  ...invalid: [Token] extends [never] ? [never] : []
): readonly RegistrationSnapshot[];
```

All other phase behavior stays: bare collection dependency entries, alias targets, readiness and replacement. Change positive fixtures and runtime tests to call the fallback names only for direct reads/inspection.

- [ ] **Step 3: Adjust codemod targets before Task 6**

The `Bag.resolveAll` map entry targets `resolveCollection`; `Bag.inspectAll` targets `inspectCollection`. The `DiBag.all(token)` transform still produces the bare token, and token creation still produces `forCollectionOf`.

- [ ] **Step 4: Re-run focused compilation and all twelve evidence cases**

Run the focused fixture command from Task 4 Step 7, then:

```bash
node scripts/evidence-cases.mjs --compare docs/superpowers/plans/evidence/baseline.md --json /tmp/phase-04-fallback-rows.json > /tmp/phase-04-fallback-table.md
```

Expected: fixtures pass; the evidence command exits 0; every case is within the cumulative +10% budget. Replace the failed primary table under `## Expand (S5)` with the fallback table while retaining the failed attempts immediately above it. If even the fallback misses the budget, stop and report to the controller; the spec has no third API shape.

- [ ] **Step 5: Commit the fallback**

```bash
git add src tests/types tests/collection-tokens.test.ts docs/guides/api-naming.md docs/superpowers/plans/evidence/phase-04.md
git commit -m "feat: use measured collection read fallback" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL"
```

Execute this task only when Task 4's decision rule selects it.

### Task 6: Add the collection-token codemod and golden fixtures

**Files:**
- Modify: `tools/codemod/rename-map.json`, `tools/codemod/lib/rewrite.mjs`, `tools/codemod/lib/transforms/index.mjs`
- Create: `tools/codemod/lib/transforms/collection-tokens.mjs`, `collection-token.mjs`, `collection-reference.mjs`, `collection-read.mjs`
- Create: `tools/codemod/test/fixtures/collection-tokens/input.ts`, `expected.ts`, `expected-manual.json`
- Create: `tools/codemod/test/fixtures/collection-tokens-import/input.ts`, `expected.ts`, `expected-manual.json`
- Create: `tools/codemod/test/fixtures/collection-token-alias-source/{input.ts,expected.ts,expected-manual.json}` and `collection-token-alias-use/{input.ts,expected.ts,expected-manual.json}`
- Create: `tools/codemod/test/fixtures/collection-token-partial/{input.ts,expected.ts,expected-manual.json}`

**Interfaces:**
- Consumes: phase-1 `api.nameOf`, `api.nameForRole`, `api.assemble`, `api.text`, `api.manual`, entry-bound custom dispatch, library-symbol resolution and one original TypeScript program.
- Produces: whole-program token-use classification and safe rewrites; mixed and external/untraceable tokens become manual items.

- [ ] **Step 1: Add the exact map entries**

Append these entries to `methods`; `owner` is the 0.4.0 declaration name:

```json
{ "owner": "token()", "from": "of", "to": "forCollectionOf", "transform": "collection-token" },
{ "owner": "DiBagApi", "from": "all", "to": "forCollectionOf", "transform": "collection-reference" },
{ "owner": "Bag", "from": "resolveAll", "to": "resolve", "transform": "collection-read" },
{ "owner": "Bag", "from": "inspectAll", "to": "inspect", "transform": "collection-read" }
```

If S5 took the fallback, the last two `to` values are `resolveCollection` and `inspectCollection`. `forCollectionOf` in the `DiBagApi.all` entry is an analysis lookup name, not emitted text; the transform emits only its argument.

- [ ] **Step 2: Write the cross-file input fixtures**

Use the complete `collection-tokens/input.ts` shown here:

```ts
import { DiBag } from 'di-bag';

type Controller = { readonly path: string };

const controllersKey = Symbol('controllers');
export const controllers = DiBag.token(controllersKey).of<Controller>();

const clockKey = Symbol('clock');
const clock = DiBag.token(clockKey).of<{ now(): number }>();

// One token on both channels: a single service is registered under it and providers are contributed to it.
const loggerKey = Symbol('logger');
const logger = DiBag.token(loggerKey).of<string>();

const feature = DiBag.createBuilder()
  .contribute(
    controllers,
    () => ({ path: '/users' }),
  )
  .buildModule([]);

const builder = DiBag.createBuilder()
  .installModule(feature)
  .register(clock, () => ({ now: () => 0 }))
  .contribute(controllers, () => ({ path: '/orders' }))
  .contribute(logger, () => 'console')
  .register(logger, () => 'fan-out')
  .register({
    router: DiBag.fromFunction([clock, DiBag.all(controllers)], (time, list) => `${time.now()}:${list.length}`),
    sinks: DiBag.fromFunction([DiBag.all(logger)], list => list.join(',')),
  });

export const bag = builder.build();
export const paths = bag.resolveAll(controllers).map(controller => controller.path);
export const snapshots = bag.inspectAll(controllers);
export const overrides = { [controllers.key]: () => [] };
export type ControllersToken = typeof controllers;
export const sinks = bag.resolveAll(logger);
export const stamp = bag.resolve(clock).now();

export function later(token: ControllersToken) {
  return bag.resolveAll(token);
}
```

The imported input is:

```ts
import { bag, controllers as importedControllers } from '../collection-tokens/input.js';

// The token is declared in another file of the program; its uses here count, and follow its creation.
export const again = bag.resolveAll(importedControllers);
export const described = bag.inspectAll(importedControllers).length;
```

- [ ] **Step 3: Extend the transform API by exactly two read-only fields**

The checker and phase-1 entry-bound `nameForRole` mechanism already exist in the transform API.
Thread the original `program` into `rewriteSourceFile`, and expose both `program` and the existing
`library` resolver without dropping that mechanism. These are the complete edits:

```diff
-export function rewriteSourceFile({ ts, checker, sourceFile, library, index, transforms, manualItems, fileLabel }) {
+export function rewriteSourceFile({ ts, checker, program, sourceFile, library, index, transforms, manualItems, fileLabel }) {
```

Replace the existing `transformApi` with this complete superset:

```js
function transformApi(member, entry) {
  return {
    ts, checker, program, library, sourceFile, member,
    text, slice, start, assemble, objectLiteral, quote, manual,
    nameOf: index.nameOf,
    nameForRole(role) {
      const value = entry?.transformNames?.[role];
      if (value === undefined) throw new Error(`transform ${entry?.transform ?? '<unknown>'} has no name for role ${role}`);
      return value;
    },
  };
}
```

Keep the existing custom-transform dispatch exactly
`transforms[entry.transform](call, transformApi(member, entry))`. This phase adds only `program`
and `library`; it does not revert the phase-1 entry binding, coverage gate, or role lookup.

In `tools/codemod/lib/codemod.mjs`, replace its call with:

```js
result = rewriteSourceFile({
  ts, checker, program: built, sourceFile, library, index, transforms,
  manualItems: manual,
  fileLabel,
});
```

`built` is the phase-1 `runCodemod` local that holds the supplied or loaded original program; its optional input parameter `program` may be undefined. Do not create another program and do not reparse transformed text.

- [ ] **Step 4: Implement whole-program classification**

Create `tools/codemod/lib/transforms/collection-tokens.mjs` with the exact implementation exercised by the planning probe:

```js
// tools/codemod/lib/transforms/collection-tokens.mjs
const COLLECTION_POSITIONS = new Set(['Builder.contribute', 'DiBagApi.all', 'Bag.resolveAll', 'Bag.inspectAll']);
const analyses = new WeakMap();

function analyze(api) {
  const { ts, checker, program, library } = api;
  let analysis = analyses.get(program);
  if (analysis) return analysis;
  analysis = new Map();
  analyses.set(program, analysis);
  const files = program.getSourceFiles().filter(file =>
    !file.isDeclarationFile && !library.isLibraryFile(file.fileName) && !file.fileName.includes('/node_modules/'));
  const visitDeclarations = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && isTokenCreation(api, node.initializer)) {
      const symbol = checker.getSymbolAtLocation(node.name);
      if (symbol) {
        analysis.set(symbol, { declaration: node, creation: node.initializer, collectionUses: [], otherUses: [] });
      }
    }
    ts.forEachChild(node, visitDeclarations);
  };
  for (const file of files) visitDeclarations(file);
  const visitUses = node => {
    if (ts.isIdentifier(node)) {
      const entry = analysis.get(variableSymbol(api, node));
      if (entry && node !== entry.declaration.name) {
        const use = classify(api, node);
        if (use === 'collection') entry.collectionUses.push(node);
        else if (use === 'other') entry.otherUses.push(node);
      }
    }
    ts.forEachChild(node, visitUses);
  };
  for (const file of files) visitUses(file);
  return analysis;
}

function isTokenCreation(api, node) {
  const { ts, library } = api;
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return false;
  const coverage = library.memberCoverage(library.symbolAt(node.expression.name));
  return coverage.complete && coverage.members.length > 0
    && coverage.members.every(member => member.owner === 'token()' && member.name === 'of');
}

function variableSymbol(api, identifier) {
  const { ts, checker } = api;
  const parent = identifier.parent;
  let symbol = ts.isShorthandPropertyAssignment(parent) ? checker.getShorthandAssignmentValueSymbol(parent)
    : ts.isExportSpecifier(parent) ? checker.getExportSpecifierLocalTargetSymbol(parent)
    : checker.getSymbolAtLocation(identifier);
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  return symbol;
}

function classify(api, identifier) {
  const { ts, library } = api;
  const parent = identifier.parent;
  if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent) || ts.isImportClause(parent) || ts.isTypeQueryNode(parent)) return 'neutral';
  if (ts.isPropertyAccessExpression(parent) && parent.expression === identifier && parent.name.text === 'key') return 'neutral';
  if (ts.isCallExpression(parent) && parent.arguments[0] === identifier && ts.isPropertyAccessExpression(parent.expression)) {
    const coverage = library.memberCoverage(library.symbolAt(parent.expression.name));
    if (coverage.complete && coverage.members.length > 0
        && coverage.members.every(member => COLLECTION_POSITIONS.has(`${member.owner}.${member.name}`))) {
      return 'collection';
    }
  }
  return 'other';
}

export function tokenUse(api, expression) {
  const { ts } = api;
  if (!ts.isIdentifier(expression)) return { state: 'untraceable' };
  const entry = analyze(api).get(variableSymbol(api, expression));
  if (!entry) return { state: 'untraceable' };
  return describe(expression.text, entry);
}

export function creationUse(api, call) {
  const { ts, checker } = api;
  const declaration = call.parent;
  if (!ts.isVariableDeclaration(declaration) || declaration.initializer !== call || !ts.isIdentifier(declaration.name)) {
    return { state: 'untraceable' };
  }
  const entry = analyze(api).get(checker.getSymbolAtLocation(declaration.name));
  return entry ? describe(declaration.name.text, entry) : { state: 'untraceable' };
}

function describe(name, entry) {
  if (entry.collectionUses.length === 0) return { state: 'single', name };
  if (entry.otherUses.length > 0) return { state: 'mixed', name, otherUse: entry.otherUses[0] };
  return { state: 'collection', name };
}

export function locate(node) {
  const file = node.getSourceFile();
  return `${file.fileName.split('/').slice(-2).join('/')}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1}`;
}
```

The scanner intentionally recognizes original 0.4.0 symbols. A later phase can rename `contribute` in the same codemod pass without changing `COLLECTION_POSITIONS`, because analysis uses the original program and emitted names use the map.

- [ ] **Step 5: Implement and register all three transforms**

Create these exact files:

```js
// tools/codemod/lib/transforms/collection-token.mjs
import { creationUse, locate } from './collection-tokens.mjs';

export default function collectionToken(call, api) {
  const callee = call.expression;
  const use = creationUse(api, call);
  if (use.state === 'collection') {
    return api.assemble(call, [{
      start: api.start(callee.name), end: callee.name.end,
      text: api.nameOf(api.member.owner, api.member.name),
    }]);
  }
  if (use.state === 'mixed') {
    api.manual(call, `${use.name} is used as a collection and as a single service (${locate(use.otherUse)}); a 0.5 token is one or the other, so create a second token for the list with ${api.nameOf(api.member.owner, api.member.name)} and move the collection uses to it`);
  }
  return undefined;
}
```

```js
// tools/codemod/lib/transforms/collection-reference.mjs
import { locate, tokenUse } from './collection-tokens.mjs';

export default function collectionReference(call, api) {
  const use = tokenUse(api, call.arguments[0]);
  if (use.state === 'collection' && call.arguments.length === 1) return api.text(call.arguments[0]);
  api.manual(call, use.state === 'mixed'
    ? `${use.name} is also used as a single service (${locate(use.otherUse)}); split it into two tokens, then pass the collection token itself here`
    : `${api.member.name} is removed; create this token as a collection token, then pass the token itself here`);
  return undefined;
}
```

```js
// tools/codemod/lib/transforms/collection-read.mjs
import { locate, tokenUse } from './collection-tokens.mjs';

export default function collectionRead(call, api) {
  const callee = call.expression;
  const target = api.nameOf(api.member.owner, api.member.name);
  const use = tokenUse(api, call.arguments[0]);
  if (use.state === 'collection') {
    return api.assemble(call, [{ start: api.start(callee.name), end: callee.name.end, text: target }]);
  }
  api.manual(call, use.state === 'mixed'
    ? `${use.name} is also used as a single service (${locate(use.otherUse)}); split it into two tokens, then write ${target}(token) here`
    : `${api.member.name} is removed; create this token as a collection token, then write ${target}(token) here`);
  return undefined;
}
```

Replace `tools/codemod/lib/transforms/index.mjs` with:

```js
import buildAndStart from './build-and-start.mjs';
import collectionRead from './collection-read.mjs';
import collectionReference from './collection-reference.mjs';
import collectionToken from './collection-token.mjs';

export const transforms = {
  'build-and-start': buildAndStart,
  'collection-read': collectionRead,
  'collection-reference': collectionReference,
  'collection-token': collectionToken,
};
```

Before running the codemod gate, update its exact registry and package expectations in this same task. Add `tools/codemod/test/transforms.test.mjs`, `tools/codemod/test/rename-map.test.mjs`, and `tools/codemod/test/pack.test.mjs` to the task's modified files and commit staging. Both the `Object.keys(transforms)` expectation and every shipped-map `loadRenameMap` / `validateRenameMap` allowed-transform list are now:

```js
['build-and-start', 'collection-read', 'collection-reference', 'collection-token']
```

Preserve all earlier non-transform package entries. Replace only the transform-file portion of the sorted `pack.files` expected list with the entries of this array:

```js
[
'lib/transforms/build-and-start.mjs',
'lib/transforms/collection-read.mjs',
'lib/transforms/collection-reference.mjs',
'lib/transforms/collection-token.mjs',
'lib/transforms/collection-tokens.mjs',
'lib/transforms/index.mjs',
]
```

The helper `collection-tokens.mjs` ships in the archive but is not a callable transform ID. Later phases append their IDs/files to these accumulated expectations; they must never reset the lists to phase 1.

- [ ] **Step 6: Write exact golden output and manual items**

The primary-shape `tools/codemod/test/fixtures/collection-tokens/expected.ts` is exactly:

```ts
import { DiBag } from 'di-bag';

type Controller = { readonly path: string };

const controllersKey = Symbol('controllers');
export const controllers = DiBag.token(controllersKey).forCollectionOf<Controller>();

const clockKey = Symbol('clock');
const clock = DiBag.token(clockKey).of<{ now(): number }>();

// One token on both channels: a single service is registered under it and providers are contributed to it.
const loggerKey = Symbol('logger');
const logger = DiBag.token(loggerKey).of<string>();

const feature = DiBag.createBuilder()
  .contribute(
    controllers,
    () => ({ path: '/users' }),
  )
  .buildModule([]);

const builder = DiBag.createBuilder()
  .installModule(feature)
  .register(clock, () => ({ now: () => 0 }))
  .contribute(controllers, () => ({ path: '/orders' }))
  .contribute(logger, () => 'console')
  .register(logger, () => 'fan-out')
  .register({
    router: DiBag.fromFunction([clock, controllers], (time, list) => `${time.now()}:${list.length}`),
    sinks: DiBag.fromFunction([DiBag.all(logger)], list => list.join(',')),
  });

export const bag = builder.build();
export const paths = bag.resolve(controllers).map(controller => controller.path);
export const snapshots = bag.inspect(controllers);
export const overrides = { [controllers.key]: () => [] };
export type ControllersToken = typeof controllers;
export const sinks = bag.resolveAll(logger);
export const stamp = bag.resolve(clock).now();

export function later(token: ControllersToken) {
  return bag.resolveAll(token);
}
```

Its `expected-manual.json` uses the phase-1 fixture schema and literal reasons:

```json
[
  { "line": 13, "reason": "logger is used as a collection and as a single service (collection-tokens/input.ts:27); a 0.5 token is one or the other, so create a second token for the list with forCollectionOf and move the collection uses to it" },
  { "line": 30, "reason": "logger is also used as a single service (collection-tokens/input.ts:27); split it into two tokens, then pass the collection token itself here" },
  { "line": 38, "reason": "logger is also used as a single service (collection-tokens/input.ts:27); split it into two tokens, then write resolve(token) here" },
  { "line": 42, "reason": "resolveAll is removed; create this token as a collection token, then write resolve(token) here" }
]
```

`tools/codemod/test/fixtures/collection-tokens-import/expected.ts` is:

```ts
import { bag, controllers as importedControllers } from '../collection-tokens/input.js';

// The token is declared in another file of the program; its uses here count, and follow its creation.
export const again = bag.resolve(importedControllers);
export const described = bag.inspect(importedControllers).length;
```

Its `expected-manual.json` is `[]`. If S5 takes the fallback, change only `resolve`/`inspect` in both expected files and the two corresponding literal reason suffixes to `resolveCollection`/`inspectCollection`.

The alias-only regression uses two independent fixture directories so the source declaration has no local collection use to hide a name-based classification bug. `collection-token-alias-source/input.ts`:

```ts
import { DiBag } from 'di-bag';
export const importedOnlyItems = DiBag.token(Symbol('imported-only-items')).of<number>();
```

`collection-token-alias-source/expected.ts`:

```ts
import { DiBag } from 'di-bag';
export const importedOnlyItems = DiBag.token(Symbol('imported-only-items')).forCollectionOf<number>();
```

`collection-token-alias-use/input.ts`:

```ts
import { DiBag } from 'di-bag';
import { importedOnlyItems as localItems } from '../collection-token-alias-source/input.js';
const app = DiBag.createBuilder().contribute(localItems, () => 1).build();
export const items = app.resolveAll(localItems);
```

`collection-token-alias-use/expected.ts`:

```ts
import { DiBag } from 'di-bag';
import { importedOnlyItems as localItems } from '../collection-token-alias-source/input.js';
const app = DiBag.createBuilder().contribute(localItems, () => 1).build();
export const items = app.resolve(localItems);
```

Write `[]` to both `expected-manual.json` files. The phase-1 fixture glob discovers both `input.ts` files and its original program includes the imported declaration. Under S5 fallback only the final `resolve` becomes `resolveCollection`. Classification resolves every identifier's original symbol; it must not prefilter by the spelling of declarations, because imports may rename them.

Add a `collection-token-partial` fixture that covers both completeness boundaries without changing
the existing four-item golden. Its `input.ts` and `expected.ts` are byte-for-byte identical:

```ts
import { DiBag } from 'di-bag';

declare const chooseUser: boolean;
const uncertain = DiBag.token(Symbol('uncertain')).of<number>();
const receiver = chooseUser
  ? DiBag.createBuilder()
  : { userKind: 'user-builder' as const, contribute(_token: unknown, _provider: () => number) { return this; } };
export const unchangedUse = receiver.contribute(uncertain, () => 1);

const tokenFactory = chooseUser
  ? DiBag.token(Symbol('factory'))
  : { userKind: 'user-token' as const, of<T>() { return undefined as T; } };
export const unchangedCreation = tokenFactory.of<number>();
```

Its `expected-manual.json` is exactly:

```json
[
  { "line": 8, "reason": "contribute resolves to both DI Bag and non-library declarations; migrate this use by hand" },
  { "line": 13, "reason": "of resolves to both DI Bag and non-library declarations; migrate this use by hand" }
]
```

Add `'collection-token-partial'` to the fixture-name array in `fixtures.test.mjs`. The first row
proves an incomplete receiver is classified as `other`, so it cannot make `uncertain` a collection
token; the second proves an incomplete token-factory receiver is not admitted as a token creation.
Both calls remain byte-for-byte unchanged and receive only the phase-1 partial-declaration report.

- [ ] **Step 7: Run codemod tests**

```bash
node --test tools/codemod/test/transforms.test.mjs tools/codemod/test/fixtures.test.mjs
npm run codemod:check
```

Expected: pass; inputs type-check against vendored 0.4.0 declarations; golden output matches; the
primary fixture has its exact four manual items and `collection-token-partial` has its exact two
partial-declaration items, with no additional report.

- [ ] **Step 8: Commit**

```bash
git add tools/codemod
git commit -m "feat(codemod): migrate collection tokens" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL"
```

### Task 7: Migrate all repository call sites and split the two-channel control

**Files:**
- Modify: `examples/contributions.ts`
- Modify: `tests/contributions.test.ts`, `tests/contributions-runtime-fixture.ts`, `tests/observers-runtime-fixture.ts`, `tests/plugins-runtime-fixture.ts`, `tests/final-adversarial-runtime-fixture.ts`, `tests/acquisition-retention.node.mjs`
- Modify: `tests/enterprise-integration.test.ts`, `tests/fixtures/enterprise-feature.ts`, `tests/inspect-graph.test.ts`, `tests/nested-modules.test.ts`, `tests/observers.test.ts`, `tests/persistent-graph.test.ts`, `tests/persistent-module.test.ts`, `tests/plugins.test.ts`
- Modify: `tests/types/contributions-consumer.ts`, `tests/types/contributions.ts`, `tests/types/negative/contributions.ts`, `tests/types/negative/nested-modules.ts`, `tests/types/nested-modules.ts`, `tests/types/plugins.ts`
- Verify and preserve: `tests/types/negative/startup.ts` (the two rejected old `close` option statements must remain byte-identical; modify only if the inclusive proof first exposes a legitimate collection migration, and then only in the separate preparation commit below)
- Create then delete: `/tmp/phase-04-codemod-dry-run-report.json`, `/tmp/phase-04-negative-startup-before.ts`, `/tmp/phase-04-all-negative-files.txt`, `/tmp/phase-04-codemod-write-negative-files.txt`, `/tmp/phase-04-codemod-write-command.sh`, `/tmp/phase-04-codemod-write-report.json`, `/tmp/phase-04-codemod-generated-files.txt`, `/tmp/phase-04-codemod-working-tree-files.txt`, `/tmp/phase-04-codemod-staged-files.txt`, `/tmp/phase-04-codemod-untracked-files.txt`, optional `/tmp/phase-04-codemod-preparation-files.txt`, `/tmp/phase-04-codemod-commit-message.txt`
- Create: `scripts/phase05-strings.py`

**Interfaces:**
- Consumes: Task 6 codemod and Task 4's expand compatibility overload; Task 8 tightens admission after every call site is migrated.
- Produces: a green pure mechanical commit from the report's exact generated-file inventory, followed by a separate green hand/string migration commit; no old collection API uses in executable TypeScript/JavaScript; explicit two-token composite control.

- [ ] **Step 1: Build, prove the inclusive result, then apply the codemod exactly once**

Keep the dry run inclusive so it exercises every compiler-negative fixture. The accumulated map still
contains Phase 3's `Bag.close` option renames, so the inclusive result must also prove exactly what it
would do to the two deliberately rejected old-close statements in
`tests/types/negative/startup.ts`:

```bash
npm run build
node tools/codemod/cli.mjs --project tsconfig.json --library-root src --library-root dist --extra-files 'tests/types/negative/*.ts' --report /tmp/phase-04-codemod-dry-run-report.json
node - <<'JS'
const report = require('/tmp/phase-04-codemod-dry-run-report.json');
const skipped = report.manual.filter(item => item.reason.startsWith('this file was left untouched'));
const startup = report.files.filter(item => item.file === 'tests/types/negative/startup.ts');
console.log({ files: report.files.length, rewrites: report.files.reduce((sum, item) => sum + item.rewrites, 0), manual: report.manual.length, skipped: skipped.length, startup });
if (report.written !== false || skipped.length !== 0 || startup.length !== 1) process.exit(1);
JS
```

Expected: the report says `written: false`, `skipped: 0`, and contains one entry for
`tests/types/negative/startup.ts`. Do not pin its internal rewrite count: the exact proposed source
text is the contract. Read every manual item. Mixed-channel uses are split; declarations outside the
program and parameters are migrated by tracing their callers/types, never guessed.

Prove read-only that the omitted fixture's complete proposed text differs only at the two inherited
old-close controls, then save its original bytes:

```bash
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { loadTypeScript, runCodemod } from './tools/codemod/lib/codemod.mjs';
const root = process.cwd();
const file = 'tests/types/negative/startup.ts';
const before = readFileSync(file, 'utf8');
const replacements = [
  ['closable.close({ timeoutMs: 1 });', 'closable.close({ waitTimeoutMs: 1 });'],
  ['closable.close({ signal: new AbortController().signal });', 'closable.close({ abortSignal: new AbortController().signal });'],
];
let expected = before;
for (const [from, to] of replacements) {
  assert.equal(expected.split(from).length - 1, 1, `expected one control: ${from}`);
  expected = expected.replace(from, to);
}
const compiler = loadTypeScript(root);
const result = runCodemod({
  typescript: compiler.ts,
  root,
  project: 'tsconfig.json',
  extraFiles: ['tests/types/negative/*.ts'],
  libraryRoots: ['src', 'dist'],
  only: [file],
});
assert.equal(result.files.length, 1);
assert.equal(result.files[0].file, file);
assert.equal(result.files[0].text, expected);
assert.equal(result.manual.filter(item => item.reason.startsWith('this file was left untouched')).length, 0);
writeFileSync('/tmp/phase-04-negative-startup-before.ts', before);
console.log('phase 4 negative startup preview: exactly two inherited close controls; original bytes saved');
JS
```

If this proof exposes a legitimate collection edit in that fixture, do not exclude or overwrite it.
Likewise, if inspection of any manual item shows that the generated tree cannot pass the type,
codemod, or affected-runtime checks below without a hand precondition, make that coherent migration
while both collection surfaces exist. Preserve the two old-close controls. Record the exact
preparation paths, run the green checks, and make a prior preparation commit with adjacent trailers:

```bash
git diff --name-only | LC_ALL=C sort -u > /tmp/phase-04-codemod-preparation-files.txt
test -s /tmp/phase-04-codemod-preparation-files.txt
bun test tests/types.test.ts -t startup
npm run typecheck
npm run codemod:check
bun test tests/collection-tokens.test.ts tests/contributions.test.ts tests/nested-modules.test.ts tests/persistent-module.test.ts tests/plugins.test.ts tests/inspect-graph.test.ts tests/observers.test.ts tests/enterprise-integration.test.ts tests/persistent-graph.test.ts tests/final-adversarial-integration.test.ts
bun examples/contributions.ts
git diff --check
git add --pathspec-from-file=/tmp/phase-04-codemod-preparation-files.txt
git commit -F - <<'MSG'
refactor: prepare manual collection migrations

Resolve coherent codemod preconditions so the following generated rewrite is
green while retaining the two rejected old-close controls.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

Then rebuild and repeat the inclusive report and exact-text proof until the only proposed changes are
the two old-close controls. Omit this preparation commit only when neither a legitimate collection
edit in the fixture nor any other manual precondition is needed to keep the generated boundary green.
Do not use a red exception, change the accumulated map, or fold a hand edit into the mechanical commit.

For the one actual write, keep the project and both library roots, but replace the negative glob with
an explicit sorted inventory that omits exactly `tests/types/negative/startup.ts`:

```bash
rg --files tests/types/negative -g '*.ts' | LC_ALL=C sort > /tmp/phase-04-all-negative-files.txt
grep -vxF 'tests/types/negative/startup.ts' /tmp/phase-04-all-negative-files.txt > /tmp/phase-04-codemod-write-negative-files.txt
python3 - <<'PY'
from pathlib import Path
all_files = Path('/tmp/phase-04-all-negative-files.txt').read_text().splitlines()
write_files = Path('/tmp/phase-04-codemod-write-negative-files.txt').read_text().splitlines()
assert all_files == sorted(set(all_files)), 'full negative-fixture inventory is not sorted and unique'
assert write_files == sorted(set(write_files)), 'write inventory is not sorted and unique'
assert [item for item in all_files if item not in write_files] == ['tests/types/negative/startup.ts']
assert write_files == [item for item in all_files if item != 'tests/types/negative/startup.ts']
print(f'phase 4 write inventory: {len(write_files)} sorted unique negative fixtures; only startup.ts omitted')
PY
mapfile -t negative_extra_files < /tmp/phase-04-codemod-write-negative-files.txt
negative_extra_args=()
for file in "${negative_extra_files[@]}"; do negative_extra_args+=(--extra-files "$file"); done
write_command=(node tools/codemod/cli.mjs --project tsconfig.json --library-root src --library-root dist "${negative_extra_args[@]}" --write --report /tmp/phase-04-codemod-write-report.json)
printf '%q ' "${write_command[@]}" > /tmp/phase-04-codemod-write-command.sh
printf '\n' >> /tmp/phase-04-codemod-write-command.sh
"${write_command[@]}"
node - <<'JS'
const { writeFileSync } = require('node:fs');
const report = require('/tmp/phase-04-codemod-write-report.json');
const skipped = report.manual.filter(item => item.reason.startsWith('this file was left untouched'));
const startup = report.files.filter(item => item.file === 'tests/types/negative/startup.ts');
const generated = report.files.filter(item => item.rewrites > 0).map(item => item.file).sort();
console.log({ files: report.files.length, rewrites: report.files.reduce((sum, item) => sum + item.rewrites, 0), manual: report.manual.length, skipped: skipped.length, startup: startup.length, generated: generated.length });
if (report.written !== true || skipped.length !== 0 || startup.length !== 0 || generated.length === 0 || new Set(generated).size !== generated.length) process.exit(1);
writeFileSync('/tmp/phase-04-codemod-generated-files.txt', `${generated.join('\n')}\n`);
JS
cmp --silent tests/types/negative/startup.ts /tmp/phase-04-negative-startup-before.ts
bun test tests/types.test.ts -t startup
npm run typecheck
npm run codemod:check
bun test tests/collection-tokens.test.ts tests/contributions.test.ts tests/nested-modules.test.ts tests/persistent-module.test.ts tests/plugins.test.ts tests/inspect-graph.test.ts tests/observers.test.ts tests/enterprise-integration.test.ts tests/persistent-graph.test.ts tests/final-adversarial-integration.test.ts
bun examples/contributions.ts
git diff --check
```

Expected: the inventory includes every current negative TypeScript fixture except exactly
`tests/types/negative/startup.ts`. The write report says `written: true`, `skipped: 0`, and has no
entry for the omitted fixture. The byte comparison and focused compiler check prove the fixture and
its two old-close rejection controls remain intact. Typecheck, the complete codemod gate and the
named affected runtime/example gate all pass on the generated tree. If one fails because a reported
manual item needs a coherent precondition, restore exactly the generated paths with
`git restore --pathspec-from-file=/tmp/phase-04-codemod-generated-files.txt`, verify the mechanical
diff is gone with `git diff --exit-code`, make the prior green preparation commit above, rebuild, and
repeat the inclusive proof and actual write. Do not restore unrelated work and do not commit a red
mechanical tree. There is no restoration after the successful write.

- [ ] **Step 2: Commit only the generated rewrite as the mechanical boundary**

Derive the staged file inventory from the successful write report and prove it is exactly the current
tracked diff. No hand split, source-string migration, or manual-item repair from the later steps may
be present yet:

```bash
git diff --name-only | LC_ALL=C sort > /tmp/phase-04-codemod-working-tree-files.txt
cmp --silent /tmp/phase-04-codemod-generated-files.txt /tmp/phase-04-codemod-working-tree-files.txt
git ls-files --others --exclude-standard > /tmp/phase-04-codemod-untracked-files.txt
test ! -s /tmp/phase-04-codemod-untracked-files.txt
git diff --cached --quiet
git add --pathspec-from-file=/tmp/phase-04-codemod-generated-files.txt
git diff --cached --name-only | LC_ALL=C sort > /tmp/phase-04-codemod-staged-files.txt
cmp --silent /tmp/phase-04-codemod-generated-files.txt /tmp/phase-04-codemod-staged-files.txt
printf '%s\n' \
  'refactor!: mechanically migrate collection call sites' \
  '' \
  'Exact producing command:' > /tmp/phase-04-codemod-commit-message.txt
cat /tmp/phase-04-codemod-write-command.sh >> /tmp/phase-04-codemod-commit-message.txt
printf '%s\n' '' 'Explicit sorted --extra-files inventory:' >> /tmp/phase-04-codemod-commit-message.txt
cat /tmp/phase-04-codemod-write-negative-files.txt >> /tmp/phase-04-codemod-commit-message.txt
printf '%s\n' '' 'Generated files staged from the write report:' >> /tmp/phase-04-codemod-commit-message.txt
cat /tmp/phase-04-codemod-generated-files.txt >> /tmp/phase-04-codemod-commit-message.txt
printf '%s\n' \
  '' \
  'The inclusive dry run covered startup.ts; the write omitted exactly that' \
  'deliberate rejected-old-close fixture and preserved its bytes.' \
  '' \
  'Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>' \
  'Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL' \
  >> /tmp/phase-04-codemod-commit-message.txt
git commit -F /tmp/phase-04-codemod-commit-message.txt
```

Expected: both comparisons print nothing, there is no untracked repository file, and the commit
contains exactly the generated paths named by the write report. Save the exact expanded command,
negative-fixture inventory, generated-file inventory, both report totals, manual-item accounting,
byte-proof result and mechanical hash for the Task 9 controller report. This commit is green and is
the only commit described as mechanical.

- [ ] **Step 3: Split the accidental-merging control into two tokens**

In `tests/contributions.test.ts` and its runtime fixture, replace the one token that was both registered and contributed to with `singularItem = DiBag.token(Symbol('singular item')).of<Item>()` and `items = DiBag.token(itemKey).forCollectionOf<Item>()`. Register/resolve only `singularItem`; contribute/resolve the list only through `items`. Preserve the intent: singular resolution stays singular and never merges into the list.

- [ ] **Step 4: Add the counted migration script for source strings**

Create `scripts/phase05-strings.py` with an `EDITS` map and a two-pass guard: first verify every old string has exactly the expected count; only then write. Required counts:

| File | Token declarations | `resolveAll` | `inspectAll` | `DiBag.all` |
| --- | ---: | ---: | ---: | ---: |
| `tests/contributions-runtime-fixture.ts` | 5 to `forCollectionOf` plus one new singular token | 9 | 2 | 1 |
| `tests/observers-runtime-fixture.ts` | 1 | 2 | 1 | 0 |
| `tests/plugins-runtime-fixture.ts` | 1 | 0 | 0 | 1 |
| `tests/final-adversarial-runtime-fixture.ts` | 3 | 3 | 1 | 2 |
| `tests/acquisition-retention.node.mjs` | 1 | 1 | 1 | 0 |

The script replaces collection `.of()` declarations with `.forCollectionOf()`, `resolveAll` with the adopted direct-read name, `inspectAll` with the adopted inspect name, and `DiBag.all(token)` with `token`. A second run prints `already migrated` for all five and exits 0. Do not use a general regex over source files.

Use this complete tested script for the primary S5 shape:

```python
#!/usr/bin/env python3
"""Phase 4 (collection tokens): migrate the call sites the codemod cannot read.

These five files hold library calls inside template strings, behind `any`, or in untyped JavaScript.
Every replacement states how many times it must match; any other count stops the script before a
file is written. Run it from the repository root. A second run changes nothing and reports that.
"""
import pathlib, re, sys

EDITS = {
    'tests/contributions-runtime-fixture.ts': [
        ("const item = DiBag.token(itemKey).of();", "const item = DiBag.token(itemKey).forCollectionOf();\n    const singularItem = DiBag.token(Symbol('singular item')).of();", 1),
        (".register(item, () => ({ id: 'singular' }))", ".register(singularItem, () => ({ id: 'singular' }))", 1),
        ("ordered.resolve(item).id === 'singular'", "ordered.resolve(singularItem).id === 'singular'", 1),
        ("const lifetimeItem = DiBag.token(lifetimeKey).of();", "const lifetimeItem = DiBag.token(lifetimeKey).forCollectionOf();", 1),
        ("const promiseItem = DiBag.token(promiseKey).of();", "const promiseItem = DiBag.token(promiseKey).forCollectionOf();", 1),
        ("const retryItem = DiBag.token(retryKey).of();", "const retryItem = DiBag.token(retryKey).forCollectionOf();", 1),
        ("const portableItem = PortableContributionBag.token(portableKey).of();", "const portableItem = PortableContributionBag.token(portableKey).forCollectionOf();", 1),
        ("DiBag.all(lifetimeItem)", "lifetimeItem", 1),
        (".resolveAll(", ".resolve(", 9),
        (".inspectAll(", ".inspect(", 2),
    ],
    'tests/observers-runtime-fixture.ts': [
        ("const item = DiBag.token(itemKey).of();", "const item = DiBag.token(itemKey).forCollectionOf();", 1),
        (".resolveAll(", ".resolve(", 2),
        (".inspectAll(", ".inspect(", 1),
    ],
    'tests/plugins-runtime-fixture.ts': [
        ("const all = DiBag.token(allKey).of();", "const all = DiBag.token(allKey).forCollectionOf();", 1),
        ("DiBag.all(all)", "all", 1),
    ],
    'tests/final-adversarial-runtime-fixture.ts': [
        ("const i5Token = DiBag.token(Symbol('I5')).of();", "const i5Token = DiBag.token(Symbol('I5')).forCollectionOf();", 1),
        ("const i7Token = DiBag.token(Symbol('I7')).of();", "const i7Token = DiBag.token(Symbol('I7')).forCollectionOf();", 1),
        ("const i12Items = DiBag.token(Symbol('I12-items')).of();", "const i12Items = DiBag.token(Symbol('I12-items')).forCollectionOf();", 1),
        ("i5Observed.all(i5Token)", "i5Token", 1),
        ("i12Observed.all(i12Items)", "i12Items", 1),
        (".resolveAll(", ".resolve(", 3),
        (".inspectAll(", ".inspect(", 1),
    ],
    'tests/acquisition-retention.node.mjs': [
        ("const token = DiBag.token(Symbol('arrays')).of();", "const token = DiBag.token(Symbol('arrays')).forCollectionOf();", 1),
        (".resolveAll(", ".resolve(", 1),
        (".inspectAll(", ".inspect(", 1),
    ],
}

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.')
pending = {}
for name, edits in EDITS.items():
    path = root / name
    text = path.read_text()
    if all(old not in text for old, _new, _count in edits):
        print(f'{name}: already migrated')
        continue
    for old, new, count in edits:
        found = text.count(old)
        if found != count:
            sys.exit(f'{name}: expected {count} of {old!r}, found {found}. Nothing was written. Read the file and migrate it by hand.')
        text = text.replace(old, new)
    pending[path] = text
for path, text in pending.items():
    path.write_text(text)
    print(f'{path.relative_to(root)}: migrated')
leftovers = [f'{name}: {word}' for name in EDITS for word in ('resolveAll', 'inspectAll', '.all(')
             for line in (root / name).read_text().split('\n') if word in line and 'Promise.all(' not in line]
if leftovers:
    sys.exit('left over:\n' + '\n'.join(leftovers))
print('no resolveAll, inspectAll or all( is left in the five files')
```

If S5 takes the fallback, change only the replacement strings `".resolve("` and `".inspect("` to `".resolveCollection("` and `".inspectCollection("` before running it; counts and guards remain identical.

- [ ] **Step 5: Run the script and audit every old use**

```bash
python3 scripts/phase05-strings.py
python3 scripts/phase05-strings.py
rg -n "resolveAll|inspectAll|DiBag\.all\(|CollectionDependency|kind: 'all'|kind === 'all'" tests examples scripts tools/graph docs/agent AGENTS.md src
```

Expected after the contract task is prepared: matches only in codemod input fixtures, migration documentation, and negative removal fixtures. No generated-source string remains.

- [ ] **Step 6: Check error assertion text explicitly**

```bash
grep -rhoE "toThrow\((/|['\`])[^)]*" tests | grep -iE "\b(all|resolveAll|inspectAll|collection|contribute)\b" | sort | uniq -c
```

Expected at 0.4.0 entry: no lines, so this phase has no pre-existing message-string assertion replacement. New wrong-kind tests assert the exact new message/details. If this command finds a phase-3-added string, replace only retired API wording and record it in the phase report.

- [ ] **Step 7: Run the final migrated checks**

```bash
npm run typecheck
npm run codemod:check
bun test tests/collection-tokens.test.ts tests/contributions.test.ts tests/nested-modules.test.ts tests/persistent-module.test.ts tests/plugins.test.ts tests/inspect-graph.test.ts tests/observers.test.ts tests/enterprise-integration.test.ts tests/persistent-graph.test.ts tests/final-adversarial-integration.test.ts
bun examples/contributions.ts
git diff --check
```

Expected: all pass; example prints `Hello, DI!`. These checks make the later hand/string boundary
green independently of the already committed mechanical tree.

- [ ] **Step 8: Commit the remaining hand and source-string migrations separately**

```bash
git add examples tests scripts/phase05-strings.py
git commit -F - <<'MSG'
refactor!: finish collection call-site migrations

Resolve the codemod's inspected manual items, split the deliberate two-channel
control, and migrate counted source strings after the pure mechanical commit.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

Expected: this green commit contains only the post-mechanical hand split, inspected manual-item
resolutions and counted source-string migration. It does not claim codemod generation and does not
repeat the producing command. If the optional preparation commit was required, list it separately in
the phase report as well.

### Task 8: Remove the old collection channel and finish public documentation

**Files:**
- Modify: `src/dependency-references.ts`, `src/acquisition.ts`, `src/runtime.ts`, `src/startup.ts`, `src/scope-selection.ts`, `src/module.ts`, `src/contributions.ts`, `src/contribution-types.ts`, `src/di-bag.ts`, `src/index.ts`
- Modify: `tests/collection-tokens.test.ts`, `tests/types/negative/collection-tokens.ts`, `tests/types/negative/api-renaming.ts`, `tests/inspect-graph.test.ts`
- Modify: `tests/api-naming-known-violations.json` (remove exactly four legacy-collection findings)
- Modify: `docs/agent/errors.md`, `docs/agent/recipes.md`, `docs/agent/api-card.md`, `docs/guides/api-reference.md`, `tools/docs/api-card-tasks.json`, `tools/docs/test/exact-rendering.test.mjs`
- Delete: `docs/reference/index/type-aliases/CollectionDependency.md`
- Regenerate: `docs/reference/`

**Interfaces:**
- Consumes: all migrated call sites.
- Produces: no `DiBag.all`, `Bag.resolveAll`, `Bag.inspectAll`, `CollectionDependency`, runtime `'all'` reference, or two-channel behavior.

- [ ] **Step 1: Add compile-time removals before deleting declarations**

Append to `tests/types/negative/api-renaming.ts`:

```ts
const removedCollection = DiBag.token(Symbol('removed collection')).forCollectionOf<number>();
const removedBag = DiBag.createBuilder().contribute(removedCollection, () => 1).build();
// diagnostic: Property 'all' does not exist
DiBag.all(removedCollection);
// diagnostic: Property 'resolveAll' does not exist
removedBag.resolveAll(removedCollection);
// diagnostic: Property 'inspectAll' does not exist
removedBag.inspectAll(removedCollection);
```

Add a type-only import/use marker showing `CollectionDependency` is no longer exported, matching the fixture's established import-diagnostic style.

- [ ] **Step 2: Remove the old runtime and type surface**

Delete `all`, `CollectionDependency`, the `'all'` generic branch and reference kind; delete `resolveAll`/`inspectAll` from `Bag`, `BagRuntime`, and `ScopeAcquisitions`; remove `all` from `DiBagApi` and `facade`; remove the export from `src/index.ts`. Rename remaining private helpers to contribution-specific names so no deleted public term survives accidentally.

Delete `{ kind: 'all' }` from `NeedConstraint`, `AllNeeds`, `RegistrationConstraints`, `SealedConstraints`, and the old `TokenDependencyContract.all`. The graph snapshot `tokenDependencies[].kind` now permits only `'required' | 'optional' | 'lazy'`; a collection dependency is `'required'`. Do not rename snapshot fields; phase 11 owns them.

Delete the expand-only single-token `BuilderContribute` overload. Change `contributionEntry` to authenticate with `readToken`, throw `wrongTokenKind('contribute', 'collection', key)` before normalizing the provider, and return the entry. Add these contract checks:

Now enforce the one-kind-per-graph rule after every legacy caller has migrated. The implementation below is part of this contract step; applying it during expand would reject the old two-channel fixtures before migration.

Make token-kind consistency graph-scoped. Add `tokenKinds` to `GraphDescription`, copy it through sealing/installation, and use a persistent map so a graph retains no symbol it did not already retain through a binding, contribution, or positional dependency:

```ts
export interface GraphDescription {
  readonly bindings: ReadonlyMap<BindingId, BindingDescription>;
  readonly publicSlots: ReadonlyMap<BindingKey, BindingId>;
  readonly contributions?: ReadonlyMap<symbol, readonly BindingId[]>;
  readonly tokenKinds?: ReadonlyMap<symbol, TokenKind>;
}
```

```ts
// BindingGraph field
#tokenKinds = new PersistentMap<TokenKind>();

private claimTokenKind(
  key: symbol,
  receivedKind: TokenKind,
  operation: string,
): void {
  const expectedKind = this.#tokenKinds.get(key);
  if (expectedKind !== undefined && expectedKind !== receivedKind) {
    throw wrongTokenKind(operation, expectedKind, key);
  }
  this.#tokenKinds = this.#tokenKinds.set(key, receivedKind);
}

assertTokenKind(
  key: symbol,
  receivedKind: TokenKind,
  operation: string,
): void {
  const expectedKind = this.#tokenKinds.get(key);
  if (expectedKind !== undefined && expectedKind !== receivedKind) {
    throw wrongTokenKind(operation, expectedKind, key);
  }
}

withTokenKind(
  key: symbol,
  kind: TokenKind,
  operation: string,
): BindingGraph {
  this.assertTokenKind(key, kind, operation);
  if (this.#tokenKinds.get(key) === kind) return this;
  const graph = this.copy();
  graph.claimTokenKind(key, kind, operation);
  return graph;
}
```

The constructor imports every `description.tokenKinds` entry through `claimTokenKind(key, kind, 'installModule')`. `copy()` copies the persistent root. `describe()` materializes it into a new `Map<symbol, TokenKind>`. Before `withInstallation` mutates a copy, it validates every incoming kind against the host and then merges the installation's persistent kind root; a conflict throws `DI_BAG_WRONG_TOKEN_KIND` with operation `installModule`. Use these exact propagation fragments in the existing complete bodies:

```ts
// BindingGraph constructor, before importing bindings:
for (const [key, kind] of description.tokenKinds ?? []) {
  this.claimTokenKind(key, kind, 'installModule');
}

// BindingGraph.copy():
graph.#tokenKinds = this.#tokenKinds;

// BindingGraph.describe(), after publicSlots and before return:
const tokenKinds = new Map<symbol, TokenKind>();
for (const [key, kind] of this.#tokenKinds) {
  tokenKinds.set(key as symbol, kind);
}
return { bindings, publicSlots, contributions, tokenKinds };

// BindingGraph.withInstallation(), before any host graph mutation:
const installation = new BindingGraph(description);
for (const [key, kind] of installation.#tokenKinds) {
  this.assertTokenKind(key as symbol, kind, 'installModule');
}
const graph = this.copy();
for (const [key, kind] of installation.#tokenKinds) {
  graph.#tokenKinds = graph.#tokenKinds.set(key, kind);
}
```

In `src/module.ts`, `moduleGraph` also reconstructs a `GraphDescription`; preserving the map only in `BindingGraph.describe()` is insufficient. Replace its final return with this exact return. Module installation remaps binding identities but leaves token symbols unchanged:

```ts
return {
  bindings,
  publicSlots,
  contributions,
  tokenKinds: new Map(graph.tokenKinds ?? []),
};
```

Change `addBinding(label, registration, operation)` to normalize once and claim each `normalized.references` entry as `reference.isCollection ? 'collection' : 'single-service'` before retaining the binding. Pass the originating operation through `withPublicBinding(s)`, `withContribution`, and installation. `withContribution` first claims its own key as `'collection'`. Direct token registration, alias destination/target, replace, fork, and scope replacement call `withTokenKind(read.key, read.kind, operation)` before adding the public binding. Named registrations need no explicit claim for their string key, but `addBinding` still claims their positional token references.

Use these complete graph mutation bodies:

```ts
private addBinding(
  label: string,
  registration: Registration,
  operation: string,
): BindingId {
  const id = Symbol(label);
  const normalized = Object.freeze(normalize(registration));
  for (const reference of normalized.references) {
    this.claimTokenKind(
      reference.key,
      reference.isCollection ? 'collection' : 'single-service',
      operation,
    );
  }
  this.#bindings = this.#bindings.set(id, {
    description: Object.freeze({
      id,
      label,
      registration,
      localNames: emptyNames,
    }),
    normalized,
  });
  return id;
}

withContribution(
  key: symbol,
  registration: Registration,
  operation = 'contribute',
): BindingGraph {
  const graph = this.copy();
  graph.claimTokenKind(key, 'collection', operation);
  const id = graph.addBinding(
    `contribution:${String(key)}`,
    registration,
    operation,
  );
  graph.#contributions = graph.#contributions.set(
    key,
    append(graph.#contributions.get(key), { values: [id] }),
  );
  graph.#contributed = graph.#contributed.set(id, true);
  return graph;
}

withPublicBindings(
  entries: readonly (readonly [BindingKey, Registration])[],
  operation = 'register',
): BindingGraph {
  if (entries.length === 0) return this;
  const graph = this.copy();
  for (const [key, registration] of entries) {
    const previous = graph.#publicSlots.get(key);
    if (previous === undefined) {
      graph.#publicOrder = append(graph.#publicOrder, { values: [key] });
    }
    const id = graph.addBinding(String(key), registration, operation);
    graph.#publicSlots = graph.#publicSlots.set(key, id);
    graph.#publicReferences = graph.#publicReferences.set(id, 1);
    if (previous !== undefined) {
      const remaining = (graph.#publicReferences.get(previous) ?? 1) - 1;
      if (remaining) {
        graph.#publicReferences =
          graph.#publicReferences.set(previous, remaining);
      } else {
        graph.#publicReferences = graph.#publicReferences.delete(previous);
        graph.#obsolete = graph.#obsolete.set(previous, true);
        graph.prune([previous]);
      }
    }
  }
  return graph;
}

withPublicBinding(
  key: BindingKey,
  registration: Registration,
  operation = 'register',
): BindingGraph {
  return this.withPublicBindings([[key, registration]], operation);
}

withPublicRegistrations(
  registrations: Registrations,
  operation = 'register',
): BindingGraph {
  return this.withPublicBindings(
    Object.keys(registrations).map(
      key => [key, registrations[key]!] as const,
    ),
    operation,
  );
}
```

Use this exact selection claimer before reading override properties:

```ts
function claimSelectedTokenKinds(
  graph: BindingGraph,
  values: readonly unknown[],
  operation: string,
): BindingGraph {
  let claimed = graph;
  for (const value of values) {
    if (typeof value === 'string') continue;
    const token = readToken(value);
    claimed = claimed.withTokenKind(token.key, token.kind, operation);
  }
  return claimed;
}
```

In the complete `fork` and `selectScope` bodies printed in Task 3, set the working graph with `claimSelectedTokenKinds` immediately after snapshotting the indexed selections, use that graph for `hasPublic`/lifetime lookup, and call `withPublicBindings(bindings, 'fork')` or `withPublicBindings(bindings, 'createScope')`. In the complete `register`, `replace`, and `alias` bodies, first call `withTokenKind` for each nonstring handle and then call `withPublicBinding` with the same operation. The final `contribute` body is:

```ts
readonly contribute: BuilderContribute<Entries, Constraints> = ((
  token: unknown,
  registration: Registration,
) => {
  const [key, value] = contributionEntry(token, registration);
  return new Builder(
    this.#graph
      .withTokenKind(key, 'collection', 'contribute')
      .withContribution(key, value, 'contribute'),
    this.context,
  );
}) as BuilderContribute<Entries, Constraints>;
```

The exact graph selection at the start/end of those three existing complete bodies is:

```ts
register(moreOrToken: unknown, registration?: Registration): unknown {
  if (arguments.length === 1) {
    const snapshot = snapshotAdd(
      moreOrToken,
      key => this.#graph.hasPublic(key),
    );
    return new Builder(
      this.#graph.withPublicRegistrations(snapshot, 'register'),
      this.context,
    );
  }
  const key = readSingleServiceKey(moreOrToken, 'register');
  const graph = this.#graph.withTokenKind(
    key,
    'single-service',
    'register',
  );
  if (graph.hasPublic(key)) {
    throw libraryError(
      'DI_BAG_DUPLICATE_REGISTRATION',
      `duplicate registration: ${String(key)}`,
      { operation: 'register', key },
    );
  }
  return new Builder(
    graph.withPublicBinding(
      key,
      withTokenBinding(moreOrToken as never, registration as never),
      'register',
    ),
    this.context,
  );
}

replace(selection: string | TokenBase, registration: Registration): unknown {
  const selected = typeof selection === 'string'
    ? undefined
    : readToken(selection);
  const key = selected === undefined ? selection as string : selected.key;
  const graph = selected === undefined
    ? this.#graph
    : this.#graph.withTokenKind(selected.key, selected.kind, 'replace');
  if (selected?.kind !== 'collection' && !graph.hasPublic(key)) {
    throw libraryError(
      'DI_BAG_INVALID_REPLACEMENT',
      `replace accepts existing names or typed tokens only: ${String(key)}`,
      { operation: 'replace', key },
    );
  }
  normalize(registration);
  return new Builder(
    graph.withPublicBinding(key, registration, 'replace'),
    this.context,
  );
}

alias(destination: unknown, target: unknown): unknown {
  let graph = this.#graph;
  for (const value of [destination, target]) {
    if (typeof value === 'string') continue;
    const selected = readToken(value);
    graph = graph.withTokenKind(selected.key, selected.kind, 'alias');
  }
  const [key, registration] = aliasEntry(
    destination,
    target,
    candidate => graph.hasPublic(candidate),
  );
  return new Builder(
    graph.withPublicBinding(key, registration, 'alias'),
    this.context,
  );
}
```

Every token read checks the graph before choosing a channel. The exact helper and call pattern are:

```ts
function readGraphToken(
  graph: BindingGraph,
  value: unknown,
  operation: string,
): Readonly<{ key: symbol; kind: TokenKind }> {
  const token = readToken(value);
  graph.assertTokenKind(token.key, token.kind, operation);
  return token;
}

// resolve/inspect/readiness use their own operation string:
const { key, kind } = readGraphToken(this.#graph, serviceKey, 'resolve');
```

The final public read bodies are:

```ts
resolve(serviceKey: unknown): unknown {
  if (typeof serviceKey === 'string') {
    return this.#runtime.resolve(serviceKey);
  }
  const { key, kind } = readGraphToken(this.#graph, serviceKey, 'resolve');
  return kind === 'collection'
    ? this.#runtime.resolveCollection(key)
    : this.#runtime.resolve(key);
}

inspect(serviceKey: unknown): unknown {
  if (typeof serviceKey === 'string') {
    return this.#runtime.inspect(serviceKey);
  }
  const { key, kind } = readGraphToken(this.#graph, serviceKey, 'inspect');
  return kind === 'collection'
    ? this.#runtime.inspectCollection(key)
    : this.#runtime.inspect(key);
}
```

In the complete readiness body from Task 2, replace its nonstring read with `readGraphToken(graph, value, 'ensureServicesReady')`. In `sealModule`, follow `readSingleServiceKey(value, 'buildModule')` with `graph.assertTokenKind(key, 'single-service', 'buildModule')`. These checks do not mutate a built graph.

An unknown collection token remains a valid empty read because `assertTokenKind` does not claim or retain it. The regression explicitly allows the same symbol in two independent graphs. Do not use a process-global `Map<symbol, TokenKind>`: it would retain dynamically created unique symbols forever and would impose a stronger identity rule than the spec requires.

Append this regression with the contract tests:

```ts
test('one graph cannot use the same symbol for both token kinds', async () => {
  const key = Symbol('shared');
  const service = DiBag.token(key).of<number>();
  const collection = DiBag.token(key).forCollectionOf<number>();

  const collectionAfterService = thrown(() =>
    DiBag.createBuilder().register(service, () => 1)
      .contribute(collection, () => 2),
  );
  expect(collectionAfterService.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
  expect(collectionAfterService.details).toEqual({
    operation: 'contribute',
    expectedKind: 'single-service',
    receivedKind: 'collection',
  });

  const serviceAfterCollection = thrown(() =>
    DiBag.createBuilder().contribute(collection, () => 2)
      .register(service, () => 1),
  );
  expect(serviceAfterCollection.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
  expect(serviceAfterCollection.details).toEqual({
    operation: 'register',
    expectedKind: 'collection',
    receivedKind: 'single-service',
  });

  const serviceBag = DiBag.createBuilder().register(service, () => 1).build();
  const collectionBag = DiBag.createBuilder()
    .contribute(collection, () => 2)
    .build();
  expect(serviceBag.resolve(service)).toBe(1);
  expect(collectionBag.resolve(collection)).toEqual([2]);
  await serviceBag.close();
  await collectionBag.close();
});
```


Add this separate runtime regression; it deliberately crosses the compile-time boundary through `any` to verify installation validation, and covers a nested sealing round trip:

```ts
test('module installation preserves token kinds through nested sealing', () => {
  const key = Symbol('module-shared');
  const service = DiBag.token(key).of<number>();
  const collection = DiBag.token(key).forCollectionOf<number>();
  const collectionModule = DiBag.createBuilder()
    .contribute(collection, () => 2).buildModule([]);
  const nested = DiBag.createBuilder()
    .installModule(collectionModule).buildModule([]);
  for (const module of [collectionModule, nested]) {
    const host = DiBag.createBuilder().register(service, () => 1);
    const error = thrown(() => (host as any).installModule(module));
    expect(error.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
    expect(error.details).toEqual({
      operation: 'installModule', expectedKind: 'single-service', receivedKind: 'collection',
    });
  }
  const serviceModule = DiBag.createBuilder()
    .register(service, () => 1).buildModule([service]);
  const host = DiBag.createBuilder().contribute(collection, () => 2);
  const error = thrown(() => (host as any).installModule(serviceModule));
  expect(error.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
  expect(error.details).toEqual({
    operation: 'installModule', expectedKind: 'collection', receivedKind: 'single-service',
  });
});
```

This added regression and the complete installation propagation have not been run against a final phase-entry prototype. The earlier 16-test probe is narrower evidence, not a claim that this test passed.


The final callable and runtime helper are exactly:

```ts
export type BuilderContribute<
  Entries extends Entry,
  Constraints extends NeedConstraint,
> = <
  TokenHandle extends CollectionTokenBase,
  Provider extends Registration,
>(
  token: TokenHandle
    & TokenTupleAdmission<readonly [TokenHandle]>
    & CollectionTokenAdmission<
        RegistrationsFromEntries<Entries>,
        TokenHandle
      >,
  registration: Provider
    & Registration
    & CollectionBindingOutput<NoInfer<TokenHandle>, NoInfer<Provider>>
    & CheckedConstraints<
        Constraints | Contribution<NoInfer<TokenHandle>, NoInfer<Provider>>,
        RegistrationsFromEntries<Entries>
      >,
  ...invalid: [TokenHandle] extends [never]
    ? [never]
    : [Provider] extends [never] ? [never] : []
) => import('./di-bag').Builder<
  Entries,
  Constraints | Contribution<TokenHandle, Provider>
>;

export function contributionEntry(
  token: unknown,
  registration: Registration,
): readonly [symbol, Registration] {
  const { key, kind } = readToken(token);
  if (kind !== 'collection') {
    throw wrongTokenKind('contribute', 'collection', key);
  }
  normalize(registration);
  return Object.freeze([key, registration]);
}
```

```ts
// tests/collection-tokens.test.ts
test('contribute rejects a single-service token as the wrong kind, before it reads the provider', () => {
  const service = DiBag.token(Symbol('service')).of<number>();
  const error = thrown(() => (DiBag.createBuilder().contribute as Function)(service, 'not a provider'));
  expect(error.code).toBe('DI_BAG_WRONG_TOKEN_KIND');
  expect(error.details).toEqual({ operation: 'contribute', expectedKind: 'collection', receivedKind: 'single-service' });
});
```

```ts
// tests/types/negative/collection-tokens.ts
// diagnostic: contribute requires a collection token
DiBag.createBuilder().contribute(service, () => 1);
```

The focused runtime total after this step is 17 tests and 103 `expect()` calls; Task 3's expand total is 15 tests and 95 calls.

- [ ] **Step 3: Update the agent-facing recipe and API task table**

Add one concrete `docs/agent/recipes.md` recipe, “Build one composite from collection members”, using separate `logger` and `loggerSinks` tokens, bare `[loggerSinks]`, and `bag.resolve(logger)`. Update the API card task row for collections to `DiBag.token(key).forCollectionOf<Item>()`, `builder.contribute(token, provider)`, and `bag.resolve(token)`. Remove old call rows. `AGENTS.md` and `tools/graph` require no edit: the entry census proved they contain no affected names and `AGENTS.md` remains at 150 lines.

Insert this exact recipe, adjusting only the heading level to match its neighbors:

````md
### Build one composite from collection members

Use separate identities for the composite service and its ordered members. A collection token supplies a fresh frozen list directly in a positional dependency.

```ts
import { DiBag } from 'di-bag';

type Logger = { log(message: string): void };

const logger = DiBag.token(Symbol('logger')).of<Logger>();
const loggerSinks = DiBag.token(Symbol('logger sinks')).forCollectionOf<Logger>();

const bag = DiBag.createBuilder()
  .contribute(loggerSinks, () => ({ log: message => console.log(message) }))
  .contribute(loggerSinks, () => ({ log: message => process.stderr.write(`${message}\n`) }))
  .register(
    logger,
    DiBag.fromFunction([loggerSinks], sinks => ({
      log(message: string) { for (const sink of sinks) sink.log(message); },
    })),
  )
  .build();

bag.resolve(logger).log('ready');
await bag.close();
```

A token created with `.of<Service>()` cannot receive contributions, and a token created with `.forCollectionOf<Item>()` cannot hold the composite service.
````

- [ ] **Step 4: Regenerate docs and repair exact rendering**

```bash
npm run build
npm run docs:generate
npm run docs:check
```

Expected: generated `CollectionToken` reference exists; `CollectionDependency.md` and links to it are gone; error coverage sees exactly one `DI_BAG_WRONG_TOKEN_KIND` section; exact-rendering expectations contain full `resolve`/`inspect` signatures selected by S5. Do not edit generated Markdown by hand.

- [ ] **Step 5: Audit the final public contract**

```bash
rg -n "resolveAll|inspectAll|DiBag\.all\(|CollectionDependency|kind: 'all'|kind === 'all'" src tests examples scripts docs/agent tools/graph
rg -n "DI_BAG_WRONG_TOKEN_KIND" src tests docs/agent/errors.md
```

Expected: the first command finds only codemod fixture inputs and intentional negative/migration text. The second finds throw/test/doc coverage. Every caught-error field audit uses `.code`/`.details`, not message parsing.

- [ ] **Step 6: Shrink and verify the naming ratchet inside the contract commit**

The fresh contracted `npm run build` in Step 4 exposes the final public surface to the phase-0 scanner. The S5 adopted/fallback choice does not affect this removal set: both paths delete the same legacy collection channel. Remove exactly these four current violations now, before committing Task 8:

```text
retired-word: member all
retired-word: member inspectAll
retired-word: member resolveAll
retired-word: value 'all'
```

`CollectionDependency` was never listed: neither word is retired. Run update mode, then ordinary mode:

```bash
UPDATE_API_NAMING_VIOLATIONS=1 bun test tests/api-naming.test.ts
bun test tests/api-naming.test.ts
```

Prove the phase-entry note is unchanged, exactly those four strings disappeared, nothing was added, and all remaining content and ordering stayed intact. The `next` ref remains the phase-entry tree until the controller merges this phase:

```bash
python3 - <<'PY'
import json, subprocess
from pathlib import Path
path = 'tests/api-naming-known-violations.json'
before = json.loads(subprocess.check_output(['git', 'show', f'next:{path}'], text=True))
after = json.loads(Path(path).read_text())
expected = {
    'retired-word: member all',
    'retired-word: member inspectAll',
    'retired-word: member resolveAll',
    "retired-word: value 'all'",
}
old, new = set(before['violations']), set(after['violations'])
assert before['note'] == after['note'], 'the ratchet note changed'
assert old - new == expected, f'unexpected removals: {sorted(old - new)}'
assert not new - old, f'ratchet additions: {sorted(new - old)}'
assert after['violations'] == [item for item in before['violations'] if item not in expected], \
    'ratchet content or ordering changed beyond the exact expected removals'
print('collection ratchet: unchanged note, exactly 4 expected removals, 0 additions')
PY
```

Expected: update and ordinary modes pass, and the audit prints `collection ratchet: unchanged note, exactly 4 expected removals, 0 additions`. Any different removal or any addition is an unintended public-surface change to repair before the contract commit.

- [ ] **Step 7: Commit the contract step**

```bash
git add src tests docs/agent docs/reference docs/guides/api-reference.md tools/docs
git commit -m "feat!: remove the legacy collection channel" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL"
```

### Task 9: Audit naming, measure the final shape, run every gate and report

**Files:**
- Audit without modifying: `tests/api-naming-known-violations.json`
- Modify: `docs/superpowers/plans/evidence/phase-04.md`

**Interfaces:**
- Consumes: complete contract step and the baseline evidence.
- Produces: final phase-04 evidence and a green phase handoff.

- [ ] **Step 1: Audit the phase-wide naming-ratchet result without editing it**

Task 8 already removed and verified the four stale legacy-collection entries before its green contract commit. Run ordinary mode and repeat the exact phase-entry comparison without changing the file:

```bash
bun test tests/api-naming.test.ts
python3 - <<'PY'
import json, subprocess
from pathlib import Path
path = 'tests/api-naming-known-violations.json'
before = json.loads(subprocess.check_output(['git', 'show', f'next:{path}'], text=True))
after = json.loads(Path(path).read_text())
expected = {
    'retired-word: member all',
    'retired-word: member inspectAll',
    'retired-word: member resolveAll',
    "retired-word: value 'all'",
}
old, new = set(before['violations']), set(after['violations'])
assert before['note'] == after['note'], 'the ratchet note changed'
assert old - new == expected, f'unexpected removals: {sorted(old - new)}'
assert not new - old, f'ratchet additions: {sorted(new - old)}'
assert after['violations'] == [item for item in before['violations'] if item not in expected], \
    'ratchet content or ordering changed beyond the exact expected removals'
print('collection ratchet: unchanged note, exactly 4 expected removals, 0 additions')
PY
git diff --exit-code HEAD -- tests/api-naming-known-violations.json
```

Expected: ordinary mode passes, the audit prints `collection ratchet: unchanged note, exactly 4 expected removals, 0 additions`, and the final command prints nothing. Task 9 does not own or stage this file. If any check fails, repair the task/commit that changed the public surface rather than editing the ratchet during evidence work.

- [ ] **Step 2: Measure the final contract**

```bash
node scripts/evidence-cases.mjs --compare docs/superpowers/plans/evidence/baseline.md --json /tmp/phase-04-contract-rows.json > /tmp/phase-04-contract-table.md
```

Expected: exit 0, twelve accepted cases, empty diagnostics, and each cumulative instantiation delta at most +10%. Copy the complete table from `/tmp/phase-04-contract-table.md` into `phase-04.md` under `## Contract`; state the adopted/fallback shape once. The raw JSON stays in `/tmp`.

- [ ] **Step 3: Run narrow contract checks**

```bash
bun test tests/collection-tokens.test.ts tests/contributions.test.ts
bun test tests/types.test.ts
node --test tools/codemod/test/*.test.mjs
bun test tests/api-naming.test.ts tests/documented-names.test.ts
```

Expected: all pass. The type suite proves both positive and exact negative cases; this is the executor's evidence, not the planning session's.

- [ ] **Step 4: Run the complete phase gate once**

```bash
npm run check
npm run docs:check
npm run graph:check
npm run codemod:check
npm run typecheck:native
npm run build:native
npm run check:native
node --expose-gc --test --test-isolation=none tests/runtime-scale.node.mjs tests/acquisition-retention.node.mjs tests/graph-retention.node.mjs
npm run agent-eval:test
for file in examples/*.ts; do bun "$file"; done
```

Expected: every command exits 0. Rebuild precedes the three Node suites because they read `dist/`. A compiler timeout is a flake only under the master plan's stated rerun rule.

- [ ] **Step 5: Review the diff and commit evidence**

```bash
git diff --check
git status --short
git diff next...HEAD --stat
git add docs/superpowers/plans/evidence/phase-04.md
git commit -m "test: record collection token evidence" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL"
```

- [ ] **Step 6: Send the controller report**

Report in at most 60 lines: branch; `git log --oneline next..HEAD`; each gate and last output line; S5 decision and twelve deltas; codemod manual items and how each was resolved; whether fallback ran; any deviation. Give the pure mechanical hash and separate hand-migration hash, plus any preparation hash. Cite `/tmp/phase-04-codemod-dry-run-report.json`, `/tmp/phase-04-codemod-write-report.json`, `/tmp/phase-04-codemod-write-command.sh`, `/tmp/phase-04-codemod-write-negative-files.txt`, `/tmp/phase-04-codemod-generated-files.txt` and the mechanical commit body for the exact expanded command and inventories; do not copy the long inventory into the under-60-line report. State both totals and `skipped: 0`, the exact two-control preview, and the omitted startup fixture's byte proof and focused compiler result. Do not push, merge, publish, or add removed-API stubs (phase 13 owns stubs).

## Self-review

- Spec coverage: Tasks 1–4 cover identity, wrong-kind errors, reads, empty/fresh/frozen lists, lifetimes, dependencies, aliases, readiness, snapshots, replacements, unsupported sharing and module propagation. Tasks 6–8 cover codemod, repository migration, deletion and the exact four-entry naming-ratchet shrink. Task 5 is the complete S5 fallback. Task 9 covers the required evidence, read-only phase-wide ratchet audit and gates.
- Expand/migrate/contract: Tasks 1–4 expand, Tasks 6–7 migrate, Task 8 contracts and removes the four now-stale naming findings in the same green commit. Task 5 conditionally replaces only the measured shape and does not affect that exact removal set.
- Mechanical migration boundary: Task 7 dry-runs every negative fixture but writes through an explicit sorted inventory that omits only `tests/types/negative/startup.ts`. The exact-text preview, byte comparison and focused compiler check preserve its two inherited rejected old-close controls. Any manual precondition needed for green generated output lands first in its own green preparation commit, after which the proof/write repeats. The report-derived generated-file inventory is staged and committed immediately after typecheck, codemod and named affected-runtime checks; only the later separate green commit contains the hand split, manual-item resolutions and counted source-string migration. The mechanical commit records the actual expanded command and both inventories and never claims the unsafe glob produced it.
- Public signature consistency: `CollectionToken<TokenSymbol, Item>` carries an item; its service value is `readonly Item[]`; contributions output one `Item`; replacement providers output the whole readonly list. `resolve` and `inspect` take the same admission helper. The fallback names are used consistently in its signatures, fixtures and codemod targets.
- Runtime consistency: contribution storage remains separate. A collection public slot exists only after replacement and wins in resolve, inspect, dependencies, aliases and readiness. Its provider caches/owns the original value, while reads get fresh frozen shallow copies. Empty collections remain valid. Sharing is rejected before lifetime lookup.
- Identity consistency: each graph persistently claims a symbol's token kind when a binding, contribution, or positional dependency enters it. The fresh 16-test probe proves conflicts fail in both operation orders while two independent graphs may reuse the symbol with different handles. No global strong map retains dynamic symbols.
- Error consistency: the only new runtime code is `DI_BAG_WRONG_TOKEN_KIND` with `{ operation, expectedKind, receivedKind }`; its section lands with its first throw. Existing malformed selection codes remain unchanged. No existing message assertion is predicted to break.
- Docs/tooling: the plan deliberately leaves `AGENTS.md`, `tools/graph`, scale-source generators and agent-eval unchanged because entry greps show no affected call. It updates generated docs, exact rendering, API task rows, the error page, the composite recipe and the dead reference link.
- Planning evidence boundary: runtime and isolated codemod behavior were run; all compile-time signatures are explicitly proposed and uncompiled. The executor validates positives, negatives and the twelve evidence cases before adoption.
- Syntax boundary: all 68 TS/JS plan blocks parse with `ts.createSourceFile`; undefined-name resolution, assignability, declaration emit, and performance remain explicitly uncompiled executor work.
- Completeness scan: every code-producing step includes its source or an exact signature and decision rule; every test named in a step has a complete body.

Controller alias-only regression probe: `/tmp/di-bag-resume-20260921/cumulative-codemod/check-import-alias.mjs` used the recovered phase01/04 engine and published0.4 declarations. Unaliased import migrated with no manual rows; an alias-only use incorrectly stayed unchanged. Removing the declaration-name filter made both migrate creation/read correctly with no manual rows (314MiB maxRSS). An initial probe used an unresolved extensionless NodeNext import; that run was discarded and the reported comparison uses `./tokens.js`. No compiler diagnostics, declaration emit or full gate ran. The plan's engine call also now passes the actual `built` program rather than the optional caller parameter.
