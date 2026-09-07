# Typed contribution collections implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Compose ordered collections of independently acquired, checked providers.

**Architecture:** Retain contribution bindings and nominal group contracts alongside
singular registrations; all-references resolve each canonical contribution without
creating an aggregate acquisition. Immutable composition carriers retain private
requirements, lifetime walks and physical declaration contracts.

**Tech stack:** TypeScript classic/native compilers, Bun tests, Node/Bun package
consumers, and the existing per-binding acquisition graph.

**Spec:** `docs/superpowers/specs/2026-09-07-contributions-design.md`.

## Global constraints

- Collection order follows host operations and module installation/declaration order.
- Singular and collection lookup channels remain distinct; empty collections are valid.
- No implicit awaiting, aggregate ownership, identity deduplication or transactional rollback.
- Each contribution retains existing lifetime, context, privacy and cleanup behavior.
- Preserve exact existing no-contribution contracts, invariant histories and all diagnostic/work gates.
- Observers/plugins, compiler hardening and release confidence remain required after E1.

### Task 1: Collection runtime and complete checked composition

**Files:** new `src/contributions.ts`, `src/contribution-types.ts`; `src/di-bag.ts`,
`src/module.ts`, `src/runtime.ts`, `src/acquisition.ts`, `src/provider.ts`,
`src/provider-operations.ts`, `src/dependency-references.ts`, `src/composition.ts`,
`src/token-types.ts`, `src/module-types.ts`, `src/lifetime-types.ts`, `src/types.ts`,
`src/alias-types.ts`, `src/scope-types.ts`, `src/inspection.ts`, `src/index.ts` as
required; new `tests/contributions.test.ts`, `tests/types/contributions.ts`,
`tests/types/contributions-consumer.ts`, `tests/types/negative/contributions.ts`;
`tests/types.test.ts`.

**Interfaces:** Consume existing genuine tokens, provider descriptions and
canonical runtime acquisition. Produce immutable `.contribute(token, registration)`
on both builders, `.resolveAll(token)` and `.inspectAll(token)` on bags,
`DiBag.all(token)` for all three adapters, and `ModuleContributions<M>` at the
package root. Runtime collections use a distinct lookup channel from singular
bindings. Static carrier representation is internal; retain the exact default
generic contracts for graphs with no contributions.

- [ ] Record runtime/type RED for a genuine `DiBag.token(SymbolKey).of<number>()`,
  two `.contribute(token, () => number)` operations and exact readonly number-array
  `.resolveAll(token)`. Add empty collection and mixed-token mismatch controls.
- [ ] Add immutable builder/module contribution registration with individually
  checked provider outputs and nominal group contracts. Preserve append order,
  repeated provider/module contributions and private helpers. Module exports select
  ordinary services without dropping explicit contributions; add ModuleContributions.
- [ ] Extend immutable runtime graph construction with distinct contribution
  binding identities and ordered group lookup. Reuse ordinary acquisition/cache/
  ownership machinery for each item. Collection resolution returns a fresh frozen
  array of exact exposed values; accepted items remain owned after partial failure.
- [ ] Add genuine `DiBag.all(token)` references to all three positional adapters,
  exact readonly Service[] extraction and deferred graph reads through existing
  attempt admission. Add non-resolving immutable ordered inspectAll snapshots with
  conservative metadata where only a collection service contract is known.
- [ ] Retain contribution state in invariant builders, bags and modules. Validate
  each contributor's named/token/optional/lazy/all obligations independently at
  full/incremental/install/replace/scope/fork boundaries. Empty all-references do
  not require a collection; present incompatible groups reject, including later
  contributions and exportless/private module requirements.
- [ ] Traverse all present contribution dependencies in static/runtime lifetime
  checks, including aliases and effective shared contexts. Root/scoped/transient
  items keep normal owner routing, fork independence and source-specific closing
  admission. No new owner or hidden automatic acquisition capability is required.
- [ ] Cover the spec's ordering, partial failure/retry, Promise identity, cycles,
  cleanup, scope/private graph and adversarial erasure/forgery cases. Preserve
  utility/reflected/explicit generic and physical inferred declaration soundness.
- [ ] Run focused runtime, all affected classic/native source and declaration
  checks. Record real RED/GREEN, self-review and commit only owned source/tests.

Start `tests/contributions.test.ts` with an observable public-contract check:

```ts
import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';

test('contributions preserve order, empty reads and array immutability', async () => {
  const key = Symbol('number');
  const numbers = DiBag.token(key).of<number>();
  const empty = DiBag.begin().end();
  expect(empty.resolveAll(numbers)).toEqual([]);
  const bag = DiBag.begin().contribute(numbers, () => 1)
    .contribute(numbers, () => 2).end();
  const first = bag.resolveAll(numbers);
  expect(first).toEqual([1, 2]);
  expect(Object.isFrozen(first)).toBe(true);
  expect(bag.resolveAll(numbers)).not.toBe(first);
  await bag.close();
  await empty.close();
});
```

Run `bun test tests/contributions.test.ts` before implementation; the missing
public operation must cause RED. In the positive producer, export the token,
builder, module and final bag without annotations; compare `typeof values` from
`bag.resolveAll(numbers)` with `ReadonlyArray<number>` using `Assert<Equal<...>>`.
Export the concrete and reflected builder methods and check them from the separate
consumer so declaration nameability is exercised. Negative regions use the
existing `// diagnostic:` marker format and must prove wrong output, same-key
different-service handles, contribution-only singular resolution, missing ordinary
dependencies, erased histories and root captives reject at the proper boundary.

Use `bun test tests/types.test.ts -t contributions` for the positive, negative and
source-removed classic declarations, then focused alias/reference/module/lifetime
regressions. Use the existing native diagnostic and physical declaration helpers
for the same source producers and consumers; compare every primary negative marker
without adding allowances. Controller owns the full suite and actual archive
matrix once source stabilizes, so coordinate compiler-heavy checks serially.

### Task 2: Actual archives, examples and final E1 evidence

**Files:** package fixture lists and classic/native harnesses; new
`tests/contributions-runtime-fixture.ts`, new `examples/contributions.ts`, README,
changelog/migration, `docs/reports/2026-09-07-contributions.md`, enterprise tracker.

**Interfaces:** Consume Task 1's exact public methods and its inferred positive,
consumer and negative fixtures. Produce one shared executable archive assertion
string, routed through both existing package harnesses, and an example using the
ordinary `DiBag.all(token)` aggregate-provider pattern.

- [ ] Run ordered host/module/repeated contributions, private helpers, exact
  Promise values, transient multiplicity, shared aggregate parent graph and
  once-only cleanup assertions in actual Node/Bun CommonJS/ESM archives from
  both declaration emitters.
- [ ] Physically emit inferred producer `.d.cts`/`.d.mts`, delete source and
  consume with both compilers. Include the full collection negative fixture and
  no-contribution compatibility controls without relaxed diagnostic matching.
- [ ] Document collection versus singular lookup, module contribution exports,
  ordering, partial failure, array immutability and lifetime/ownership behavior.
  Execute an extension-pipeline example using contributions from a private module.
- [ ] Run complete check, native strict/build/source audit, all examples and diff
  checks serially. Preserve measured unresolved compiler/plugin/release work.
- [ ] Independent task/final review, consolidated correction and verified local
  commit. Mark E1 implemented only after all its increments pass their gates.
- [ ] Non-force branch push when required export approval permits; verify remote
  SHA. No publication as part of this implementation checkpoint.

Wire the shared archive assertions beside `aliasRuntimeAssertions` in
`tests/package.test.ts` and `tests/native-package.test.ts`. Add `contributions.ts`
and `negative/contributions.ts` to the shared package fixture route; add the
contributions inferred producer and consumer to both physical emitter loops.
Preserve recursive producer-root import routing, `.cts`/`.mts` formats, actual
source deletion, both downstream compilers and `skipLibCheck: false`.

The shared fixture must include pending explicit-native and raw Promise targets,
not just fulfilled values. Assert exact exposed identity, readiness during close,
and the correct disposal payload for each mode. Resolve one transient collection
twice and observe two distinct attempts. Install an exportless module twice and
observe two private-helper instances and declaration order. Share an ordinary
aggregate provider into a child that overrides a named helper and verify the
aggregate still uses the parent's lexical graph and cleanup owner.

Run `bun test tests/native-package.test.ts tests/package.test.ts` after Task 1 is
stable. Use authorized subprocess execution for the actual Node/Bun lanes. After
review and correction, run `npm run check`, `npm run typecheck:native`,
`npm run build:native` and `npm run check:native` serially, followed by every
`examples/*.ts` with Bun and `git diff --check`. Keep source and harness unchanged
during the full check, and record counts and log paths from completed commands.
