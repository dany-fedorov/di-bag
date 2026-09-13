# Structural Thenable Compile-Time Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject, at compile time, a factory whose declared output is a thenable that is not a `Promise` when the registration would use `auto` acquisition, with a per-registration and a global way to opt out.

**Architecture:** A `StructuralThenable<O>` type in `src/types.ts` detects outputs with a callable `then` that are not `Promise` (and are not `any`). `ThenableAdmission<R>` applies it to plain and disposable factories in a registration map; `AutoOutput<O, M>` applies it to `fromFactory`, `fromFunction`, and `fromClass` when their mode is `auto`. Both consult an empty exported `DiBagPolicy` interface; augmenting it with `structuralThenables: 'allow'` disables the check project-wide.

**Tech Stack:** TypeScript conditional types and module augmentation, bun:test.

**Spec:** `docs/superpowers/specs/2026-09-13-agentic-scale-hardening.md` (decision D5)

**Depends on:** plan 03 Task 1 (`NameText` in `src/types.ts`) and plan 01 Task 1 (`options` exported from `tests/compiler.ts`).

## Global Constraints

- Minimum supported TypeScript 6.0.3; `npm run check:native` must keep passing.
- `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` stay on.
- `npm run check` passes before every commit; `npm run docs:generate` after public API changes.
- The 1,000-grouped and 1,000-named-module scale cases must stay accepted (no TS2589/TS2590).
- Existing runtime tests that deliberately return structural thenables keep testing the runtime path; they are annotated, not rewritten.
- Commit prefixes: `feat:`, `fix:`, `test:`, `docs:`, `chore:`.

---

### Task 1: Detect structural thenables in `register`

**Files:**
- Modify: `src/types.ts` (imports; new block before `declare const diBagTypeError`)
- Modify: `src/di-bag.ts` (`register` overloads; type import list)
- Modify: `src/index.ts` (export `DiBagPolicy`)
- Modify: `tests/disposal.test.ts:123` and `tests/disposal.test.ts:306` (add `@ts-expect-error` directives)
- Test: `tests/types/negative/structural-thenable.ts` (new)

**Interfaces:**
- Produces: `export interface DiBagPolicy {}`, `export type StructuralThenable<O>`, `export type ThenableAdmission<R extends Registrations>` from `src/types.ts`.

- [ ] **Step 1: Write the failing fixture**

```ts
// tests/types/negative/structural-thenable.ts
import { DiBag } from '../../../src';
// A query-builder style value: callable `then`, not a Promise. Auto acquisition rejects it at runtime.
class QueryBuilder { where() { return this; } then(onFulfilled: (rows: number[]) => void) { onFulfilled([]); } }
// diagnostic: factory output is a structural thenable: users
DiBag.createBuilder().register({ users: () => new QueryBuilder() });
// diagnostic: factory output is a structural thenable: owned
DiBag.createBuilder().register({ owned: DiBag.withDisposal(() => new QueryBuilder(), () => {}) });
// diagnostic: factory output is a structural thenable: maybe
DiBag.createBuilder().register({ maybe: (): QueryBuilder | undefined => undefined });
declare const promiseLike: PromiseLike<number>;
// diagnostic: factory output is a structural thenable: like
DiBag.createBuilder().register({ like: () => promiseLike });
const key = Symbol('users');
const usersToken = DiBag.token(key).of<QueryBuilder>();
// diagnostic: factory output is a structural thenable: typed token
DiBag.createBuilder().register(usersToken, () => new QueryBuilder());
```

- [ ] **Step 2: Run the fixture to verify it fails**

Run: `bun test tests/types.test.ts -t "structural-thenable"`
Expected: FAIL: `expect(errors.length).toBeGreaterThan(0)` fails because every line compiles today.

- [ ] **Step 3: Add the policy interface and the check to `src/types.ts`**

Change the first import to include `Factory`:

```ts
import type {
  Factory,
  FactoryWithDisposal,
  Registration,
  Registrations,
} from './registration';
```

Insert immediately before `/** Render dependency names inside diagnostic messages` (added by plan 03):

```ts
/**
 * Project-wide compile-time policy switches. Augment it to relax a check:
 * `declare module 'di-bag' { interface DiBagPolicy { readonly structuralThenables: 'allow' } }`.
 */
export interface DiBagPolicy {}
type StructuralThenablesAllowed = DiBagPolicy extends { readonly structuralThenables: 'allow' } ? true : false;
type IsAny<T> = 0 extends 1 & T ? true : false;
/** True for a declared output with a callable `then` that is not a native Promise; `any` is exempt. */
export type StructuralThenable<O> = StructuralThenablesAllowed extends true ? false
  : IsAny<O> extends true ? false
    // Infer through an intersection first: a NoInfer wrapper otherwise defers the check in adapter signatures.
    : O extends infer T & {} ? T extends Promise<unknown> ? false : T extends { then(...args: never[]): unknown } ? true : false : false;
type ThenableOutputs<R extends Registrations> = {
  [K in keyof R]: R[K] extends Factory | FactoryWithDisposal<Factory> ? true extends StructuralThenable<ProviderOutput<R[K]>> ? K : never : never;
}[keyof R];
/** Reject plain or disposable factories whose declared output auto acquisition would reject at runtime. */
export type ThenableAdmission<R extends Registrations> = [ThenableOutputs<R>] extends [never] ? unknown
  : Unsatisfied<`factory output is a structural thenable: ${NameText<ThenableOutputs<R>>}; return a native Promise or use DiBag.fromFactory with acquisitionMode raw or nativePromise`, { tokens: ThenableOutputs<R> }>;
```

`ProviderOutput` is already imported from `./provider` in this file. `NameText` is defined by plan 03; if it is absent, add `export type NameText<K> = K extends string ? K : K extends number ? \`${K}\` : 'typed token';` above this block.

- [ ] **Step 4: Apply the admission in both `register` overloads of `src/di-bag.ts`**

Add `ThenableAdmission,` to the `import type { ... } from './types';` list.

In the named overload, change

```ts
      : NamedAdmission<N> & IntroducesKeys<EntryKeys<E>, keyof N> & IncrementalChecked<E, N> &
```

to

```ts
      : NamedAdmission<N> & ThenableAdmission<N> & IntroducesKeys<EntryKeys<E>, keyof N> & IncrementalChecked<E, N> &
```

In the token overload, change

```ts
    registration: V & Registration & BindingOutput<NoInfer<T>, NoInfer<V>> &
```

to

```ts
    registration: V & Registration & BindingOutput<NoInfer<T>, NoInfer<V>> & ThenableAdmission<Record<TokenKey<T>, NoInfer<V>>> &
```

- [ ] **Step 5: Export the policy from `src/index.ts`**

Add before the `CheckDependencyCompatibility` type export line:

```ts
export type { DiBagPolicy } from './types';
```

- [ ] **Step 6: Annotate the two runtime tests that deliberately register thenables**

In `tests/disposal.test.ts`, the test `a PromiseLike with a throwing then getter never reaches the fulfilled-value disposer` and the test around line 298 that registers `raw` (a `PromiseLike` with `Symbol.toStringTag`) both call `DiBag.createBuilder().register({` on one line. Insert directly above each of those two lines:

```ts
  // @ts-expect-error The runtime rejection of a structural thenable is what this test exercises.
```

- [ ] **Step 7: Typecheck, run the fixture, the type suites, and the disposal tests**

Run: `npm run typecheck && bun test tests/types.test.ts tests/type-scale.test.ts tests/token-scale.test.ts tests/disposal.test.ts tests/api-renaming.test.ts`
Expected: all PASS (validated 2026-09-13). `tests/api-renaming.test.ts` registers `() => any` factories and must stay clean (the `IsAny` guard). After Task 2, `tests/composition-adapters.test.ts` gains one more deliberate case (see Task 2 Step 6); nothing else in the repository returns a structural thenable through a plain factory.

- [ ] **Step 8: Commit**

```bash
git add src/types.ts src/di-bag.ts src/index.ts tests/disposal.test.ts tests/types/negative/structural-thenable.ts
git commit -m "feat: reject structural thenable outputs at registration time"
```

---

### Task 2: The same check for `auto`-mode adapters

**Files:**
- Modify: `src/acquisition-mode.ts` (import; new `AutoOutput` type)
- Modify: `src/acquisition-context.ts` (`fromFactory` overloads)
- Modify: `src/composition.ts` (`fromFunction` and `fromClass` overloads)
- Modify: `tests/types/negative/structural-thenable.ts` (append)

- [ ] **Step 1: Extend the fixture**

Append to `tests/types/negative/structural-thenable.ts`:

```ts
// diagnostic: factory output is a structural thenable
DiBag.fromFactory(() => new QueryBuilder());
// diagnostic: factory output is a structural thenable
DiBag.fromFactory((_deps: {}, context) => { void context.signal; return new QueryBuilder(); }, { context: 'acquisition' });
// diagnostic: factory output is a structural thenable
DiBag.fromFunction([], () => new QueryBuilder());
// diagnostic: factory output is a structural thenable
DiBag.fromClass([], QueryBuilder);
```

- [ ] **Step 2: Run the fixture to verify the new markers fail**

Run: `bun test tests/types.test.ts -t "structural-thenable"`
Expected: FAIL; the four new markers are missing.

- [ ] **Step 3: Add `AutoOutput` to `src/acquisition-mode.ts`**

Change the import

```ts
import type { Unsatisfied } from './types';
```

to

```ts
import type { StructuralThenable, Unsatisfied } from './types';
```

Add after `NativeOutput`:

```ts
/** Reject a structural thenable output when the stage would classify it automatically. */
export type AutoOutput<O, M extends AcquisitionMode> = 'auto' extends M
  ? true extends StructuralThenable<O>
    ? Unsatisfied<'factory output is a structural thenable; return a native Promise or select acquisitionMode raw or nativePromise', {}>
    : unknown
  : unknown;
```

- [ ] **Step 4: Apply it in `src/acquisition-context.ts`**

Change the import to include `AutoOutput`:

```ts
import type { Acquired, AcquisitionMode, AutoOutput, NativeOutput, ModeOptions } from './acquisition-mode';
```

In the contextual overload change `callback: F,` to
`callback: F & AutoOutput<ReturnType<NoInfer<F>>, NoInfer<M>>,`.

In the plain overload change
`callback: F & NativeOutput<ReturnType<NoInfer<F>>, NoInfer<M>>,` to
`callback: F & NativeOutput<ReturnType<NoInfer<F>>, NoInfer<M>> & AutoOutput<ReturnType<NoInfer<F>>, NoInfer<M>>,`.

- [ ] **Step 5: Apply it in `src/composition.ts`**

Change the import to include `AutoOutput`:

```ts
import type { Acquired, AcquisitionMode, AutoOutput, NativeOutput, StageOptions } from './acquisition-mode';
```

In all three `fromFunction` signatures (two overloads and the implementation) append
`& AutoOutput<ReturnType<NoInfer<F>>, NoInfer<M>>` to the `callback` parameter type, directly after `NativeOutput<ReturnType<NoInfer<F>>, NoInfer<M>>`.

In `fromClass` append `& AutoOutput<InstanceType<NoInfer<C>>, NoInfer<M>>` to the `constructor` parameter type after `NativeOutput<InstanceType<NoInfer<C>>, NoInfer<M>>`.

- [ ] **Step 6: Annotate the one deliberate adapter case, then typecheck and run the fixtures**

`tests/composition-adapters.test.ts` has one test (`raw class adapters preserve thenables and auto rejects them without assimilation`) that passes a structural thenable through an `auto`-mode adapter on purpose. The diagnostic is reported on the object-literal property line `auto: DiBag.withDisposal(DiBag.fromClass([], Thenable), ...)`, not on the statement, so insert the directive directly above that property line:

```ts
  // @ts-expect-error The runtime rejection of a structural thenable is what this test exercises.
```

Run: `npm run typecheck && bun test tests/types.test.ts tests/composition-adapters.test.ts tests/acquisition-mode.test.ts`
Expected: all PASS (validated 2026-09-13: `examples/composition.ts`, which adapts a plain class and a string-returning function, stays clean). Runtime tests that pass raw thenables through `fromFactory(..., { acquisitionMode: 'raw' })` stay clean because `'auto' extends 'raw'` is false.

- [ ] **Step 7: Commit**

```bash
git add src/acquisition-mode.ts src/acquisition-context.ts src/composition.ts tests/composition-adapters.test.ts tests/types/negative/structural-thenable.ts
git commit -m "feat: reject structural thenable outputs in auto-mode adapters"
```

---

### Task 3: The global switch

**Files:**
- Modify: `tsconfig.json` (add `"tests/types/isolated"` to `exclude`)
- Test: `tests/types/isolated/thenable-policy.ts` (new), `tests/types.test.ts` (one added test)

A module augmentation is global to whichever program contains the file. If this fixture sat under a directory that `tsconfig.json` includes, `npm run typecheck` would silently disable the check for the whole repository (observed 2026-09-13: every deliberate-thenable directive became "unused"). It therefore lives in an excluded directory and is compiled by its own program.

- [ ] **Step 1: Exclude the directory, then write the failing fixture and test**

In `tsconfig.json` change `"exclude": ["tests/types/negative"]` to `"exclude": ["tests/types/negative", "tests/types/isolated"]`.

```ts
// tests/types/isolated/thenable-policy.ts
import { DiBag } from '../../../src';
// Project-wide opt-out. Compiled in its own program only: the augmentation is global.
declare module '../../../src' { interface DiBagPolicy { readonly structuralThenables: 'allow' } }
class QueryBuilder { then(onFulfilled: (rows: number[]) => void) { onFulfilled([]); } }
export const relaxed = DiBag.createBuilder().register({ users: () => new QueryBuilder() });
export const adapter = DiBag.fromFactory(() => new QueryBuilder());
```

Add to `tests/types.test.ts`:

```ts
test('the DiBagPolicy structuralThenables switch relaxes the compile-time check', () => {
  // Isolated program: the augmentation must not leak into the shared fixture program.
  const path = resolve(__dirname, 'types/isolated/thenable-policy.ts');
  const isolated = ts.createProgram([path], options, ts.createCompilerHost(options));
  expect(ts.getPreEmitDiagnostics(isolated).map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});
```

and import `options` from `./compiler` (exported by plan 01).

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test tests/types.test.ts -t "structuralThenables switch"`
Expected: FAIL only if the augmentation does not reach `DiBagPolicy`; if it passes immediately, confirm the check is active by temporarily removing the `declare module` line and observing the two errors, then restore it.

- [ ] **Step 3: Confirm the switch works through the package entry names**

Run:

```sh
cat > ./policy-probe.ts <<'EOF'
import { DiBag } from './src/node';
declare module './src' { interface DiBagPolicy { readonly structuralThenables: 'allow' } }
class QueryBuilder { then(onFulfilled: (rows: number[]) => void) { onFulfilled([]); } }
export const app = DiBag.createBuilder().register({ users: () => new QueryBuilder() }).build();
EOF
npx tsc6 --noEmit --strict --module NodeNext --moduleResolution NodeNext --target es2022 --types bun policy-probe.ts; echo "exit=$?"; rm policy-probe.ts
```

Expected: `exit=0`. Consumers write `declare module 'di-bag'`; the scratch validation on 2026-09-13 confirmed both `'di-bag'` and `'di-bag/node'` work once `DiBagPolicy` is exported from the index.

- [ ] **Step 4: Commit**

```bash
git add tsconfig.json tests/types/isolated/thenable-policy.ts tests/types.test.ts
git commit -m "test: cover the DiBagPolicy structural-thenable switch"
```

---

### Task 4: Docs, native audit, changelog

**Files:**
- Modify: `docs/guides/tutorial.md` (the paragraph in "Attach cleanup with `withDisposal`" that begins "An automatic synchronous stage accepts ordinary values")
- Modify: `docs/guides/api-reference.md` (`### Application-facing types` table)
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update the tutorial paragraph**

Replace

```markdown
An automatic synchronous stage accepts ordinary values and observes native
Promises. A structural thenable returned directly is rejected without invoking
its `then` or transferring ownership. Normalize such a value explicitly inside
an async boundary, for example `() => Promise.resolve(legacyThenable)`. Use a raw
stage when the Promise object itself is the owned value.
```

with

```markdown
An automatic synchronous stage accepts ordinary values and observes native
Promises. A structural thenable returned directly is rejected without invoking
its `then` or transferring ownership. Query builders from libraries such as Knex,
Drizzle, or Mongoose are thenables, so a plain factory that returns one is
rejected at compile time with
`factory output is a structural thenable: users; ...`. Normalize such a value
explicitly inside an async boundary, for example
`() => Promise.resolve(legacyThenable)`, or select the stage explicitly with
`DiBag.fromFactory(create, { acquisitionMode: 'raw' })` when the builder object
itself is the service. To disable the compile-time check for a whole project,
augment the policy interface once:

```ts
declare module 'di-bag' {
  interface DiBagPolicy { readonly structuralThenables: 'allow' }
}
```

The runtime rejection stays in place either way.
```

- [ ] **Step 2: Add the type row**

In `### Application-facing types`, add:

```markdown
| `DiBagPolicy` | Empty interface for project-wide compile-time switches; augment with `structuralThenables: 'allow'` to relax the [thenable check](tutorial.md#attach-cleanup-with-withdisposal). |
```

- [ ] **Step 3: Changelog**

Under `## Unreleased`:

```markdown
- Plain and disposable factories, and `auto`-mode `fromFactory`, `fromFunction`,
  and `fromClass`, now reject declared outputs that are thenables but not
  Promises at compile time. Select an explicit `acquisitionMode`, or augment
  `DiBagPolicy` with `structuralThenables: 'allow'` to disable the check.
```

- [ ] **Step 4: Regenerate, audit, check, commit**

Run: `npm run docs:generate && npm run docs:check && npm run check && npm run check:native`
Expected: PASS; the native audit reports zero gaps for the new message.

```bash
git add docs CHANGELOG.md
git commit -m "docs: describe the structural thenable check and its switch"
```
