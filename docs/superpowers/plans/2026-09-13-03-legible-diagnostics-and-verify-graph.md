# Legible Diagnostics and `verifyGraph()` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the names of missing, mismatched, and captured dependencies into the compile-time error message itself, and add `builder.verifyGraph()` so an agent can get the full report on one line anchored at a call it chose.

**Architecture:** `Unsatisfied<Message, Details>` keeps its shape (an intersection whose first member is `{ readonly [diBagTypeError]: Message }`; TypeScript prints that member structurally in the "required in type" elaboration). Only the `Message` strings change: they become template literal types built from the same unions that already feed `Details`. `verifyGraph()` is a no-op method whose return type is `CompositionReport<Builder<E, C>>`: `void` when every build-time check passes, otherwise the union of the failing checks' `Unsatisfied` types.

**Tech Stack:** TypeScript conditional and template literal types, bun:test, the negative-fixture marker harness (`tests/diagnostic-markers.ts`).

**Spec:** `docs/superpowers/specs/2026-09-13-agentic-scale-hardening.md` (decision D3)

## Global Constraints

- Minimum supported TypeScript 6.0.3; `npm run check:native` must keep passing with zero message gaps.
- `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` stay on.
- `npm run check` passes before every commit; `npm run docs:generate` after public API changes.
- Every existing `// diagnostic:` marker in `tests/types/negative/*.ts` must still match (markers are prefixes of the new messages).
- The type-scale gates must stay green: 100 chained, 100 replacement, 1,000 grouped, 1,000 named-module providers, valid and rejected. A TS2589 or TS2590 in any of them is a failure of this plan, not of the gate.
- Commit prefixes: `feat:`, `fix:`, `test:`, `docs:`, `chore:`.

---

### Task 1: Names in the missing-dependency and wrong-shape messages

**Files:**
- Modify: `src/types.ts` (the `Unsatisfied` block, `CheckDependencyCompatibility`, `IncrementalChecked`, `CheckDependencyCompleteness`, `Overrides`, `ReplacementKey`, `ReplacementKeyOf`, `Selection`)
- Test: `tests/types/negative/diagnostic-names.ts` (new)

**Interfaces:**
- Produces: `export type NameText<K>`, `export type RelationshipText<Rel>`, and `export type WithNames<Prefix, Names>` from `src/types.ts`, reused by Tasks 2 and 3 and by plan 04.

- [ ] **Step 1: Write the failing fixture**

```ts
// tests/types/negative/diagnostic-names.ts
import { DiBag } from '../../../src';
// diagnostic: required service registrations are missing: clock
DiBag.createBuilder().register({ db: ({ clock }: { clock: number }) => clock }).build();
// diagnostic: provided service does not satisfy its consumer dependency: db needs config
DiBag.createBuilder().register({ config: () => ({ retries: '3' }), db: ({ config }: { config: { retries: number } }) => config.retries });
const accepted = DiBag.createBuilder().register({ config: () => ({ retries: 3 }) });
// diagnostic: provided service does not satisfy its consumer dependency: check db
accepted.register({ db: ({ config }: { config: { retries: string } }) => config.retries });
const bag = DiBag.createBuilder().register({ config: () => 1 }).build();
// diagnostic: fork accepts existing names or typed tokens only: unknown missing
bag.fork(['missing'], { missing: () => 2 });
// diagnostic: replace requires one existing singleton string-literal key: absent
DiBag.createBuilder().register({ config: () => 1 }).replace('absent', () => 2);
```

- [ ] **Step 2: Run the fixture to verify it fails**

Run: `bun test tests/types.test.ts -t "diagnostic-names"`
Expected: FAIL with `matched.missing` listing every marker, because the current messages stop before the colon.

- [ ] **Step 3: Add the name renderers and change the messages in `src/types.ts`**

Insert immediately before `declare const diBagTypeError: unique symbol;`:

```ts
/** Render dependency names inside diagnostic messages; typed tokens have no printable name. */
export type NameText<K> = K extends string ? K : K extends number ? `${K}` : 'typed token';
/** Render `consumer needs dependency` for each relationship record. */
export type RelationshipText<Rel> = Rel extends { consumer: infer C; dependency: infer D } ? `${NameText<C>} needs ${NameText<D>}` : never;
/** Append names only when there are names: a message that collapses to `never` hides the diagnostic. */
export type WithNames<Prefix extends string, Names extends string> = [Names] extends [never] ? Prefix : `${Prefix}: ${Names}`;
```

In `CheckDependencyCompatibility`, replace

```ts
    : Unsatisfied<'provided service does not satisfy its consumer dependency', { tokens: WrongShapes<R>; relationships: WrongRelationships<R, WrongShapes<R>> }>
```

with

```ts
    : Unsatisfied<`provided service does not satisfy its consumer dependency: ${RelationshipText<WrongRelationships<R, WrongShapes<R>>>}`, { tokens: WrongShapes<R>; relationships: WrongRelationships<R, WrongShapes<R>> }>
```

In `IncrementalChecked`, replace the first line of the wrong-shape branch

```ts
      : Unsatisfied<'provided service does not satisfy its consumer dependency', { tokens: NewWrong<E, N> | OldWrong<E, N>; relationships:
```

with

```ts
      // Name only the consumers here: expanding relationships at every register call exceeds the
      // compiler's union budget at 1,000 grouped providers (TS2590). Details keep the relationships.
      : Unsatisfied<`provided service does not satisfy its consumer dependency: check ${NameText<NewWrong<E, N> | OldWrong<E, N>>}`, { tokens: NewWrong<E, N> | OldWrong<E, N>; relationships:
```

In `CheckDependencyCompleteness`, replace

```ts
  : Unsatisfied<
      'required service registrations are missing',
      { missing: Exclude<RequiredOf<R>, keyof R> | MissingTokens<CompletionMap<R>>; relationships: MissingRelationships<R> }
    >;
```

with

```ts
  : Unsatisfied<
      `required service registrations are missing: ${NameText<Exclude<RequiredOf<R>, keyof R> | MissingTokens<CompletionMap<R>>>}`,
      { missing: Exclude<RequiredOf<R>, keyof R> | MissingTokens<CompletionMap<R>>; relationships: MissingRelationships<R> }
    >;
```

In `Overrides`, replace the two messages:

```ts
    : Unsatisfied<
        `override value is not assignable to the original token: ${NameText<BadOverrides<F, O>>}`,
        { tokens: BadOverrides<F, O> }
      >
  : Unsatisfied<
      `fork accepts existing names or typed tokens only: unknown ${NameText<Exclude<keyof O, keyof F>>}`,
      { extra: Exclude<keyof O, keyof F> }
    >;
```

In `ReplacementKey` and `ReplacementKeyOf`, replace every
`Unsatisfied<'replace requires one existing singleton string-literal key', { key: K }>` with
`Unsatisfied<`replace requires one existing singleton string-literal key: ${NameText<K>}`, { key: K }>`.

In `Selection`, replace

```ts
            : Unsatisfied<
                `${Operation} accepts existing names or typed tokens only`,
                { extra: Exclude<SelectionKey<K[number]>, keyof R> | InvalidMembers<R, K[number]> }
              >
```

with

```ts
            : Unsatisfied<
                `${Operation} accepts existing names or typed tokens only: unknown ${NameText<Exclude<SelectionKey<K[number]>, keyof R> | InvalidMembers<R, K[number]>>}`,
                { extra: Exclude<SelectionKey<K[number]>, keyof R> | InvalidMembers<R, K[number]> }
              >
```

- [ ] **Step 4: Run the fixture, every negative fixture, and the scale gates**

Run: `npm run typecheck && bun test tests/types.test.ts tests/type-scale.test.ts tests/token-scale.test.ts`
Expected: all PASS, including `type rejection: diagnostic-names.ts`. If `diagnostic-names.ts` reports an `unexpected` diagnostic for the `fork` or `replace` line, read its message and adjust the marker text to the exact rendered prefix; the name must appear.

- [ ] **Step 5: Confirm the rendered messages by hand**

Run:

```sh
cat > /tmp/di-bag-probe.ts <<'EOF'
import { DiBag } from './src/node';
DiBag.createBuilder().register({ db: ({ clock }: { clock: { now(): number } }) => clock.now() }).build();
EOF
cp /tmp/di-bag-probe.ts ./probe-message.ts && npx tsc6 --noEmit --strict --module NodeNext --moduleResolution NodeNext --target es2022 --types bun probe-message.ts; rm probe-message.ts
```

Expected: the second line of the diagnostic reads `Property '[diBagTypeError]' is missing in type '…' but required in type '{ readonly [diBagTypeError]: "required service registrations are missing: clock"; }'`.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts tests/types/negative/diagnostic-names.ts
git commit -m "feat: name missing and mismatched dependencies in compile-time messages"
```

---

### Task 2: Names in lifetime-capture messages

**Files:**
- Modify: `src/lifetime-types.ts` (imports; `CheckedScopeLifetimes`; `CheckedLifetimes`)
- Modify: `tests/types/negative/diagnostic-names.ts` (append)

- [ ] **Step 1: Extend the fixture**

Append to `tests/types/negative/diagnostic-names.ts`:

```ts
// diagnostic: root lifetime cannot capture scoped dependency: db -> config
DiBag.createBuilder().register({ config: () => 1, db: DiBag.withLifetime(({ config }: { config: number }) => config, 'root') }).build();
const scoped = DiBag.createBuilder().register({ config: () => 1, db: ({ config }: { config: number }) => config }).build();
// diagnostic: root lifetime cannot capture scoped dependency: db -> config
scoped.createScope(['db'], { db: DiBag.withLifetime(({ config }: { config: number }) => config, 'root') });
```

- [ ] **Step 2: Run the fixture to verify the new markers fail**

Run: `bun test tests/types.test.ts -t "diagnostic-names"`
Expected: FAIL; the two new markers are listed as missing.

- [ ] **Step 3: Render captive sites in `src/lifetime-types.ts`**

Change the import line

```ts
import type { CheckDependencyCompatibility, CheckDependencyCompleteness, Unsatisfied } from './types';
```

to

```ts
import type { CheckDependencyCompatibility, CheckDependencyCompleteness, NameText, Unsatisfied } from './types';

type SiteText<S> = S extends { readonly key: infer K } ? NameText<K> : S extends { readonly kind: 'contribution' } ? 'contribution' : never;
type CaptiveText<C> = C extends { readonly root: infer R; readonly dependency: infer D } ? `${SiteText<R>} -> ${SiteText<D>}` : never;
```

In `CheckedScopeLifetimes` replace

```ts
    : Unsatisfied<'root lifetime cannot capture scoped dependency', { readonly captives: OverrideCaptives<R, O, G> }>;
```

with

```ts
    : Unsatisfied<`root lifetime cannot capture scoped dependency: ${CaptiveText<OverrideCaptives<R, O, G>>}`, { readonly captives: OverrideCaptives<R, O, G> }>;
```

In `CheckedLifetimes` replace

```ts
      ? Unsatisfied<'root lifetime cannot capture scoped dependency', { readonly captives: Captives<R, C> }>
```

with

```ts
      ? Unsatisfied<`root lifetime cannot capture scoped dependency: ${CaptiveText<Captives<R, C>>}`, { readonly captives: Captives<R, C> }>
```

- [ ] **Step 4: Run the lifetime fixtures and the suites**

Run: `npm run typecheck && bun test tests/types.test.ts tests/type-scale.test.ts tests/lifetime-declarations.test.ts`
Expected: all PASS, including `type rejection: lifetimes.ts` (its markers are prefixes) and `diagnostic-names.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lifetime-types.ts tests/types/negative/diagnostic-names.ts
git commit -m "feat: name the root and the captured dependency in lifetime messages"
```

---

### Task 3: Names in module-constraint messages

**Files:**
- Modify: `src/module-types.ts` (imports; `CheckedConstraints`; `CompleteConstraints`)
- Modify: `tests/types/negative/diagnostic-names.ts` (append)

- [ ] **Step 1: Extend the fixture**

Append:

```ts
const feature = DiBag.createBuilder().register({
  value: () => ({ read() { return 1; }, extra() { return true; } }),
  hidden: ({ value }: { value: { extra(): boolean } }) => value.extra(),
}).buildModule(['value']);
// diagnostic: provided service does not satisfy its consumer dependency: hidden needs value
DiBag.createBuilder().installModule(feature).replace('value', () => ({ read() { return 2; } }));
const needy = DiBag.createBuilder().register({ hidden: ({ external }: { external: number }) => external }).buildModule([]);
// diagnostic: required service registrations are missing: external
DiBag.createBuilder().installModule(needy).build();
```

- [ ] **Step 2: Run the fixture to verify the new markers fail**

Run: `bun test tests/types.test.ts -t "diagnostic-names"`
Expected: FAIL; the two new markers are missing.

- [ ] **Step 3: Render constraint failures in `src/module-types.ts`**

Change the import

```ts
import type { Entry, Needs, RegistrationsFromEntries, ServicesOf, Singleton, Unsatisfied } from './types';
```

to

```ts
import type { Entry, NameText, Needs, RegistrationsFromEntries, RelationshipText, ServicesOf, Singleton, Unsatisfied, WithNames } from './types';
```

Replace `CheckedConstraints` with:

```ts
export type CheckedConstraints<C extends NeedConstraint, A extends Registrations> =
  [WrongConstraint<C, A> | WrongTokenConstraint<C, A>] extends [never] ? CheckedContributions<C, A>
    // Token-contract mismatches have no relationship records; WithNames keeps the message intact for them.
    : Unsatisfied<WithNames<'provided service does not satisfy its consumer dependency', RelationshipText<ConstraintRelationships<C, ServicesOf<A>>>>, { tokens: WrongConstraint<C, A> | WrongTokenConstraint<C, A>; relationships: ConstraintRelationships<C, ServicesOf<A>> }>;
```

Replace `CompleteConstraints` with:

```ts
export type CompleteConstraints<C extends NeedConstraint, A extends Registrations> =
  [MissingConstraint<C, ServicesOf<A>> | MissingTokenConstraint<C, A>] extends [never] ? CompleteContributions<C, A>
    : Unsatisfied<`required service registrations are missing: ${NameText<MissingConstraint<C, ServicesOf<A>> | MissingTokenConstraint<C, A>>}`, { missing: MissingConstraint<C, ServicesOf<A>> | MissingTokenConstraint<C, A>; relationships: MissingConstraintRelationships<C, ServicesOf<A>> }>;
```

- [ ] **Step 4: Run the module fixtures and the named-module scale gate**

Run: `npm run typecheck && bun test tests/types.test.ts tests/type-scale.test.ts`
Expected: all PASS, including `type scale: 1000 providers from reusable named modules: missing` and `wrong-shape`, and `token scale: 100 modules mismatched-invariant-service` (validated 2026-09-13 with `WithNames`). If either scale case reports TS2590 or TS2589, keep `CompleteConstraints` as written and change `CheckedConstraints` to name only the consumers, mirroring the incremental site: `${NameText<WrongConstraint<C, A> | WrongTokenConstraint<C, A>>}` with the prefix `check `, then update the fixture marker to `provided service does not satisfy its consumer dependency: check hidden`.

- [ ] **Step 5: Commit**

```bash
git add src/module-types.ts tests/types/negative/diagnostic-names.ts
git commit -m "feat: name module consumers in constraint messages"
```

---

### Task 4: `builder.verifyGraph()` and `CompositionReport`

**Files:**
- Create: `src/composition-report.ts`
- Modify: `src/di-bag.ts` (imports; `Builder` class, before `buildModule`)
- Modify: `src/index.ts` (type exports)
- Test: `tests/types/verify-graph.ts` (new, positive), `tests/types/negative/verify-graph.ts` (new), `tests/verify-graph.test.ts` (new, runtime), `tests/types.test.ts` (one added test)

**Interfaces:**
- Produces: `Builder.verifyGraph(): CompositionReport<Builder<E, C>>` and `export type CompositionReport<B>`.

- [ ] **Step 1: Write the failing fixtures and tests**

```ts
// tests/types/verify-graph.ts
import { DiBag } from '../../src';
import type { CompositionReport } from '../../src';
import type { Assert, Equal } from './assert';

const complete = DiBag.createBuilder().register({ config: () => ({ url: 'x' }), db: ({ config }: { config: { url: string } }) => config.url });
complete.verifyGraph() satisfies void;
type CompleteReport = Assert<Equal<CompositionReport<typeof complete>, void>>;

const incomplete = DiBag.createBuilder().register({ db: ({ config }: { config: { url: string } }) => config.url });
type Incomplete = CompositionReport<typeof incomplete>;
type IncompleteNamesTheMissingKey = Assert<Equal<Incomplete extends { missing: infer M } ? M : never, 'config'>>;
type IncompleteKeepsTheRelationship = Assert<Equal<Incomplete extends { relationships: { consumer: infer C } } ? C : never, 'db'>>;

const feature = DiBag.createBuilder().register({ hidden: ({ external }: { external: number }) => external }).buildModule([]);
const installed = DiBag.createBuilder().installModule(feature);
type InstalledReportsTheRequirement = Assert<Equal<CompositionReport<typeof installed> extends { missing: infer M } ? M : never, 'external'>>;
installed.register({ external: () => 1 }).verifyGraph() satisfies void;
export {};
```

```ts
// tests/types/negative/verify-graph.ts
import { DiBag } from '../../../src';
const incomplete = DiBag.createBuilder().register({ db: ({ config }: { config: { url: string } }) => config.url });
// diagnostic: required service registrations are missing: config
incomplete.verifyGraph() satisfies void;
const captive = DiBag.createBuilder().register({ config: () => 1, db: DiBag.withLifetime(({ config }: { config: number }) => config, 'root') });
// diagnostic: root lifetime cannot capture scoped dependency: db -> config
captive.verifyGraph() satisfies void;
```

```ts
// tests/verify-graph.test.ts
import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';

test('verifyGraph runs no factories, returns undefined, and leaves the builder usable', async () => {
  let calls = 0;
  const builder = DiBag.createBuilder().register({ config: () => { calls++; return 1; } });
  expect(builder.verifyGraph()).toBeUndefined();
  expect(calls).toBe(0);
  const bag = builder.build();
  expect(bag.resolve('config')).toBe(1);
  await bag.close();
});
```

Add to `tests/types.test.ts`, next to the other positive fixtures:

```ts
test('verifyGraph reports void for buildable graphs and the build failure otherwise', () => {
  expect(diagnostics(resolve(__dirname, 'types/verify-graph.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `bun test tests/verify-graph.test.ts tests/types.test.ts -t "verify"`
Expected: FAIL: `verifyGraph is not a function` at runtime; the positive fixture reports "Property 'verifyGraph' does not exist" and `CompositionReport` is not exported.

- [ ] **Step 3: Create `src/composition-report.ts`**

```ts
import type { Builder } from './di-bag';
import type { CheckedLifetimes } from './lifetime-types';
import type { CheckedConstraints, CompleteConstraints, NeedConstraint } from './module-types';
import type { CheckDependencyCompatibility, CheckDependencyCompleteness, Entry, RegistrationsFromEntries } from './types';

type ReportOf<Check> = unknown extends Check ? never : Check;
type Reports<E extends Entry, C extends NeedConstraint> =
  | ReportOf<CheckDependencyCompatibility<RegistrationsFromEntries<E>>>
  | ReportOf<CheckDependencyCompleteness<RegistrationsFromEntries<E>>>
  | ReportOf<CheckedConstraints<C, RegistrationsFromEntries<E>>>
  | ReportOf<CompleteConstraints<C, RegistrationsFromEntries<E>>>
  | ReportOf<CheckedLifetimes<RegistrationsFromEntries<E>, C>>;

/**
 * The compile-time verdict for a builder: `void` when `build()` would be accepted,
 * otherwise the same failure `build()` reports, including its details.
 * Read it through `builder.verifyGraph() satisfies void;` or as `CompositionReport<typeof builder>`.
 */
export type CompositionReport<B> = B extends Builder<infer E, infer C>
  ? [Reports<E, C>] extends [never] ? void : Reports<E, C>
  : never;
```

- [ ] **Step 4: Add the method to `Builder` in `src/di-bag.ts`**

Add the import next to the other type imports:

```ts
import type { CompositionReport } from './composition-report';
```

Insert before the `buildModule` JSDoc comment inside `class Builder`:

```ts
  /**
   * Report at the type level why this graph would not build; the runtime call does nothing.
   * Write `builder.verifyGraph() satisfies void;` so a rejected graph fails on that line with
   * the complete message and details, instead of at the start of the builder expression.
   * @returns `void` for a buildable graph; otherwise the failure that `build()` would report.
   */
  verifyGraph(): CompositionReport<Builder<E, C>>;
  verifyGraph(): unknown { return undefined; }
```

- [ ] **Step 5: Export the type from `src/index.ts`**

Add after the `Module` type export line:

```ts
export type { CompositionReport } from './composition-report';
```

- [ ] **Step 6: Run the tests and the declaration tests**

Run: `npm run typecheck && bun test tests/verify-graph.test.ts tests/types.test.ts tests/type-scale.test.ts && npm run build`
Expected: all PASS; the build emits `dist/composition-report.d.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/composition-report.ts src/di-bag.ts src/index.ts tests/types/verify-graph.ts tests/types/negative/verify-graph.ts tests/verify-graph.test.ts tests/types.test.ts
git commit -m "feat: add verifyGraph and CompositionReport for one-line build verdicts"
```

---

### Task 5: Native compiler audit, docs, and changelog

**Files:**
- Modify: `docs/guides/tutorial.md` (new section before `## Create tracked child scopes`)
- Modify: `docs/guides/api-reference.md` (`### Build and reuse a graph` table; `### Application-facing types` table)
- Modify: `CHANGELOG.md`
- Regenerate: `docs/reference/**` via `npm run docs:generate`

- [ ] **Step 1: Run the native audit**

Run: `npm run typecheck:native && npm run check:native`
Expected: PASS with zero message gaps. If the native compiler renders a template message differently, the audit lists the gap; adjust `tests/native-diagnostic-markers.ts` expectations to the new prefix-plus-name text.

- [ ] **Step 2: Add the tutorial section**

Insert before `## Create tracked child scopes`:

```markdown
## Read compile-time rejections

`build()`, `register()`, `replace()`, `fork()`, and `createScope()` reject an
invalid graph at compile time. TypeScript reports these as assignability errors
whose message names the problem and the services involved:

| Message | Meaning |
| --- | --- |
| `required service registrations are missing: clock` | No registration supplies `clock`. |
| `provided service does not satisfy its consumer dependency: db needs config` | `config` exists but its service type does not match what `db` declares. |
| `provided service does not satisfy its consumer dependency: check db` | The same mismatch found while adding a registration; the details list the dependency. |
| `root lifetime cannot capture scoped dependency: db -> config` | A `root` service would hold a `scoped` one. |
| `fork accepts existing names or typed tokens only: unknown extra` | A selected key is not registered. |

The full detail object (expected and provided types, every relationship) is part
of the error type. With the default error truncation it prints as `{ ...; }`;
set `"noErrorTruncation": true` in `tsconfig.json` to read it.

`build()` errors are anchored where the builder expression starts. To get the
verdict on a line of your choice, call `verifyGraph()`; it does nothing at
runtime and its return type is `void` exactly when the graph would build:

```ts
const builder = DiBag.createBuilder().register({
  db: ({ config }: { config: { url: string } }) => config.url,
});
builder.verifyGraph() satisfies void;
// error: Type 'Unsatisfied<"required service registrations are missing: config", { missing: "config"; ... }>' does not satisfy the expected type 'void'.
```

`CompositionReport<typeof builder>` is the same verdict as a type, for
assertions in test files.
```

- [ ] **Step 3: Update the API reference tables**

In `### Build and reuse a graph`, add after the `buildModule(keys)` row:

```markdown
| `verifyGraph()` | Builder | Runtime no-op whose return type is `void` only when the graph would [build](tutorial.md#read-compile-time-rejections). |
```

In `### Application-facing types`, add a row:

```markdown
| `CompositionReport<B>` | The compile-time verdict for a builder: `void` when buildable, otherwise the `build()` failure with details. |
```

- [ ] **Step 4: Changelog and reference regeneration**

Under `## Unreleased` in `CHANGELOG.md` add:

```markdown
- Compile-time messages now name the services involved, for example
  `required service registrations are missing: clock` and
  `root lifetime cannot capture scoped dependency: db -> config`.
- Add `builder.verifyGraph()` and the `CompositionReport<B>` type for a one-line
  build verdict anchored at the call.
```

Run: `npm run docs:generate && npm run docs:check`
Expected: the generated reference gains `CompositionReport` and the `verifyGraph` member; `docs:check` passes.

- [ ] **Step 5: Full check and commit**

Run: `npm run check && npm run check:native`
Expected: PASS.

```bash
git add docs CHANGELOG.md
git commit -m "docs: explain compile-time rejections and verifyGraph"
```
