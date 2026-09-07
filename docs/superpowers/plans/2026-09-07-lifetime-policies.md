# Root, Scoped and Transient Policies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement retained lifetime declarations, captive checks and root/scoped/transient ownership on tracked no-argument scopes.

**Architecture:** Add an immutable lifetime policy to authenticated provider descriptions and retain policy/lexical information through G and module C/D. Validate declared captivity at end/fork, then route observed acquisitions by owner with family-wide attempt identity and local cleanup. Publish the facade only when runtime behavior is implemented.

**Tech Stack:** TypeScript classic 6.0.3 / native 7.0.2, Node 24.20.0, Bun 1.4.0, existing compiler and physical-package harnesses.

**Spec:** `docs/superpowers/specs/2026-09-07-lifetime-policies-design.md`, refining `docs/superpowers/specs/2026-09-06-lifecycle-design.md`.

## Global Constraints

- Preserve exact factory requirements/output, metadata, frame tuple, token contracts and acquired value.
- Ordinary registrations remain borrowed; do not infer disposal from a method name.
- Keep Provider F/M/A/G/V, Module P/R/C/D and Bag R/C dimensions; preserve default annotations and opaque/NoInfer guards.
- `scope()` continues to reject all supplied arguments. `fork()` creates an independent family.
- Root construction uses root bindings; explicit capture never borrows child-owned state.
- No decorators, reflection dependency, new package dependency, implicit awaiting or reserved service names.
- No new native diagnostic allowance for lifetime fixtures; no timeout/OOM as rejection evidence.
- Work in the approved `feat/v0.1` checkout, one implementation writer, preserve related repositories and ignored evidence workspaces.
- User authorized intermediate commits and ordinary non-force pushes, not merge, publication or cleanup.
- Commands use pinned Node/Bun PATH and `login:false`; actual execution and git writes require escalation in this environment.

## File boundaries

Create `src/lifetime-types.ts` for policy vocabulary and static lexical traversal;
`src/lifetime.ts` for the authenticated non-evaluating wrapper. Keep provider
operations/normalization in `src/provider-operations.ts`; do not create another
registry. Keep acquisition routing in `src/acquisition.ts` and family plumbing
in `src/runtime.ts`. If acquisition bookkeeping needs a focused helper, use
`src/acquisition-family.ts` only for attempt indexing/ancestry, not a new bag.

### Task 1: Internal lifetime declarations and retained static validation

**Files:**
- Create: `src/lifetime.ts`, `src/lifetime-types.ts`, `tests/lifetime-declarations.test.ts`, `tests/types/lifetimes.ts`, `tests/types/lifetimes-consumer.ts`, `tests/types/negative/lifetimes.ts`.
- Modify: `src/provider-operations.ts`, `src/provider.ts`, `src/token-types.ts`, `src/module-types.ts`, `src/module.ts`, `src/di-bag.ts` (validation only), `tests/types.test.ts`.
- Modify `src/index.ts` only for specific type-only names required by an actual emitter diagnostic; no runtime lifetime export yet.
- Create: `docs/reports/2026-09-07-lifetime-policies.md` (explicitly partial until later tasks).

**Interfaces:**
- Produces internal `withLifetime(registration, lifetime, options?)` with exactly retained F/M/A/G/V.
- Produces `Lifetime = 'root' | 'scoped' | 'transient'` and immutable normalized `lifetime: { readonly kind: Lifetime; readonly captureScoped: boolean }`.
- Produces `CheckedLifetimes<R, C>` admission, used by `Builder.end` and selected `Bag.fork` overrides.
- Consumes existing `ProviderGraph`, `ReboundGraph`, `ModuleConstraints`, `PublicProviders`, retained constraints and flat builder entries.
- Do not add `withLifetime` to Facade or root runtime exports in this task. Source contract fixtures import the helper from `../../src/lifetime`; Task 2 changes that import to the public facade. No real lifetime acquisition assertion belongs in this task.

- [ ] **Step 1: Write declaration and type RED cases, then run them.**

Start the runtime declaration test with real descriptions, not mocked providers:

```ts
import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';
import { withLifetime } from '../src/lifetime';
import { normalize } from '../src/provider-operations';

test('lifetime replacement preserves the source and owned stages', () => {
  let calls = 0;
  const source = DiBag.withDisposal(() => { calls++; return { n: 1 }; }, () => {});
  const root = withLifetime(source, 'root', { captureScoped: true });
  const next = withLifetime(DiBag.withMetadata(root, { owner: 'app' }), 'transient');
  expect(calls).toBe(0);
  expect(normalize(root).lifetime).toEqual({ kind: 'root', captureScoped: true });
  expect(normalize(next).lifetime).toEqual({ kind: 'transient', captureScoped: false });
  expect(normalize(next).create).toBe(normalize(source).create);
  expect(normalize(next).dispose).toBe(normalize(source).dispose);
  expect(Object.isFrozen(normalize(next).lifetime)).toBe(true);
});
```

Add distinct validation tests for invalid policy/options, mutable options
snapshotted once, nested replacement clearing capture, and every transformation
retaining the policy (metadata, ownership, sync/async mapping, token binding,
sas-box and val-box adapters). Use unchecked calls only in JS validation tests.

In `lifetimes.ts`, export inferred providers/modules/builders/bags with the
internal helper. In `lifetimes-consumer.ts`, import them and assert exact types
using existing Assert/Equal helpers and a local `type IsAny<T> = 0 extends (1 & T)
? true : false`; do not annotate away emitted inference.
Register the positive consumer in `tests/types.test.ts`; negative fixtures are
already discovered there. The minimum static gate is:

```ts
import { DiBag } from '../../src';
import { withLifetime } from '../../src/lifetime';
export const graph = DiBag.begin().add({
  db: withLifetime(() => ({ query: () => 1 }), 'root'),
  repo: withLifetime(({ db }: { db: { query(): number } }) => db.query(), 'root'),
}).end();
export const scoped = graph.scope();
export const independent = graph.fork();
```

Self-contained negative fixture uses real calls and marker matching:

```ts
import { DiBag } from '../../../src';
import { withLifetime } from '../../../src/lifetime';
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().add({
  db: () => 1,
  root: withLifetime(({ db }: { db: number }) => db, 'root'),
}).end();
```

Use diagnostic text that the implementation actually emits at the intended
boundary; adapt marker region to the existing harness, never accept unrelated
missing-export errors as a captive rejection. Record genuine initial missing-
helper RED separately from the later missing-validation RED before adding checks.
Run `bun test tests/lifetime-declarations.test.ts` and
`bun test tests/types.test.ts -t 'lifetime|type rejection: lifetimes'`.

- [ ] **Step 2: Implement immutable policy and lossless transformations.**

Use the existing authentication registry and this runtime shape:

```ts
const lifetime = Object.freeze({ kind, captureScoped });
const description = describe(registration);
retainDescription(handle, Object.freeze({ ...description, lifetime }));
```

Validate before snapshotting options, preserve the reusable source, and add the
default scoped policy to source descriptions. Normalize includes that same
immutable record. `withMetadata` must retain `...description` while replacing
its operations/metadata, so future description extensions are not erased.

For the type carrier, extend G structurally without replacing its token kind.
Rebinding preserves fields other than `bound`. Normalize an explicit scoped
wrapper back to the default carrier where no other extension exists. Preserve
opaque contracts and distribution through NoInfer. Literal lifetime validation
rejects unknown/union policy; capture options on non-root reject regardless of
value. A root capture option inferred as boolean does not prove permissiveness.

- [ ] **Step 3: Implement lexical captive traversal and graph admission.**

Create one traversal in `lifetime-types.ts`, not copies for modules/tokens:

```text
check graph:
  for each public strict root, walk its declared dependencies
  for each retained module-private strict root, walk in its lexical context
walk dependency:
  resolve public slot, private local binding, or external host slot
  scoped -> emit captive diagnostic with root and dependency identity
  root -> stop (that root is independently checked)
  transient -> traverse every named/token dependency unless this exact site
               is already on this path; still check sibling branches
```

Use tagged public/private visited sites; a private name must not collide with a
public key or another module context. Retain private root obligations in C even
for exportless modules. Public non-default exports retain lexical provenance in
D; rename updates export mappings. Replaced exported roots are checked through
the replacement only; original private roots remain obligations. All-default
module representation stays compatible with existing explicit annotations.

Connect `CheckedLifetimes<From<E>, C>` to `end` and the independent selected fork
graph, not every `add`. Missing shape/token errors retain existing precedence.
No scope revalidation is necessary with the identical graph and no options.

Cover direct and transient-mediated named/token negatives; private name/host
collision; renamed public export to an external name collision; private and
exportless roots; replaced exported versus private roots; root A -> capturing
root B positive alongside unrelated strict-root negative; cycles with a separate
scoped branch; wrapper/token rebinding policy retention; mixed/NoInfer unions;
opaque and default annotation erasure; exact raw/native acquired values and
frame/metadata tuples. Include valid scoped/transient-only cyclic graphs: runtime
resolution detects cycles, static lifetime validation must terminate.

- [ ] **Step 4: Verify, record representation cost and commit.**

Run focused tests until green, then `npm run check` once and
`npm run typecheck:native`, `npm run check:native`. No new allowance is acceptable
for lifetime fixture diagnostics. Existing scale tests must not regress; do not
rerun the old 54-case native investigation. Emit the inferred lifetime producer
with both compilers using the existing declaration harness or a bounded temporary
consumer and record declaration bytes, timing and actual diagnostics; this is
early integration evidence, not Task 3's physical installed-package claim.

Report actual RED/GREEN, final commands/counts, files, declaration cost and any
constraint issue. The public report must state that the helper is internal and
runtime/public lifetimes are not yet shipped. Self-review and commit with
`feat: retain internal lifetime declarations and captive contracts`.

### Task 2: Lifetime acquisition routing and public facade

**Files:**
- Modify: `src/acquisition.ts`, `src/runtime.ts`, `src/di-bag.ts`, `src/index.ts`, `tests/types/lifetimes.ts`, `tests/types/lifetimes-consumer.ts`, `tests/types/negative/lifetimes.ts`, `docs/reports/2026-09-07-lifetime-policies.md`.
- Create: `tests/lifetimes.test.ts`; optionally `src/acquisition-family.ts` for the focused index/ancestry responsibility described above.

**Interfaces:**
- Consumes normalized immutable `lifetime.kind` and `lifetime.captureScoped` from Task 1.
- Publishes `Facade.withLifetime: typeof withLifetime` and type-only `Lifetime`; no new Bag/Module generic dimension.
- Root family plumbing passes the original root acquisitions/graph and a shared attempt index to children. `scope()` stays zero-argument; `fork()` does not inherit this plumbing.
- `inspect` uses the selected binding's policy to inspect root or local attempts without acquisition.

- [ ] **Step 1: Write runtime RED using the final public operation.**

```ts
test('root, scoped and transient identity have distinct ownership', async () => {
  const log: string[] = [];
  const registration = (label: string) => DiBag.withDisposal(
    () => ({ label }), value => { log.push(value.label); },
  );
  const parent = DiBag.begin().add({
    root: DiBag.withLifetime(registration('root'), 'root'),
    scoped: registration('scoped'),
    transient: DiBag.withLifetime(registration('transient'), 'transient'),
  }).end();
  const child = parent.scope();
  const shared = child.resolve('root');
  expect(parent.resolve('root')).toBe(shared);
  expect(child.resolve('scoped')).not.toBe(parent.resolve('scoped'));
  expect(child.resolve('transient')).not.toBe(child.resolve('transient'));
  await child.close();
  expect(log.filter(value => value === 'root')).toHaveLength(0);
  expect(log.filter(value => value === 'transient')).toHaveLength(2);
  await parent.close();
  expect(log.filter(value => value === 'root')).toHaveLength(1);
});
```

Add separate deterministic tests for child-first root dependency context,
grandchildren/forks, repeated same-object transient ownership, raw/native pending
classification and identity, cached root retry, cross-owner failed incoming
edges, sync public transient reentrancy, pure/mixed post-await cycles, independent
pending transient calls, late dependencies during closing and cleanup failures.
Use existing deferred helpers and explicit releases, not sleeps/time races.

Unchecked runtime captive fixtures bypass compile checks only at a named JS
boundary. Exercise direct/transient paths, cached scoped state and post-await
reads, plus strict-root-to-capturing-root positive. Verify errors occur before
the forbidden dependency factory or cached return. Module private exports and
renamed bindings must exercise actual runtime ownership, not only inspection.

- [ ] **Step 2: Implement routing, ancestry and family retirement.**

```text
resolve binding(requesting owner, from attempt):
  read immutable description
  validate inherited capture boundary before cache lookup
  target owner = family root for root policy, otherwise requesting owner
  root establishes its own capture boundary
  return target-owner cached attempt only for root/scoped
  detect repeated active binding+owner ancestry / sync construction stack
  create fresh target-owner attempt; add to local and family indexes
  evaluate using target-owner graph and dependency proxy
```

Preserve the existing exposed-value, ProviderExecution, stage acceptance and
failure paths. Share only identity/edge traversal, never finalizer ownership.
Retire incoming edges across the family; release each retired/closed attempt
from both indexes. Preserve outgoing dependencies until its rollback completes.
Do not create a per-public-key transient finalizer or use object equality as
acquisition identity. Keep local disposal traversal local; children already gate
parent cleanup. Public resolve checks admission before routing; in-flight proxy
reads retain their existing close permission in the correct owner.

Publish the facade after implementing routing and switch the type fixtures to
use that public member. Add only concrete type exports required by emission.

- [ ] **Step 3: Verify and commit runtime/public integration.**

Run `bun test tests/lifetimes.test.ts tests/scopes.test.ts tests/acquisition.test.ts`
and `bun test tests/providers.test.ts tests/modules.test.ts tests/token-modules.test.ts tests/disposal.test.ts tests/acquisition-mode.test.ts`
while iterating. Run focused lifetime types and declaration tests.
Finally run `npm run check`, `npm run typecheck:native`, `npm run check:native`.
Record exact results, acquired identity and cleanup order evidence, self-review
and commit `feat: add root and transient lifetime ownership`.

### Task 3: Physical declarations, installed runtimes and public documentation

**Files:**
- Modify: `tests/box-contract-fixtures.ts`, `tests/package.test.ts`, `tests/native-package.test.ts`, `scripts/check-native-contracts.ts`, `README.md`, `CHANGELOG.md`, `docs/reports/2026-09-07-lifetime-policies.md`, `docs/superpowers/plans/2026-09-06-enterprise-di-program.md`.
- Modify `src/index.ts` only for specific type-only helper exports proven necessary by actual producer diagnostics.

**Interfaces:**
- Consumes actual public lifetime facade and inferred `lifetimes.ts` producer / unchanged `lifetimes-consumer.ts` consumer.
- Reuses the existing classic/native physical producer lanes and Node/Bun CJS/ESM archived execution routes; keep successful native diagnostic logging opt-in.

- [ ] **Step 1: Add the new contracts to existing physical package routes.**

Add positive and self-contained negative lifetime fixtures to the existing shared
contract list. Use both actual emitters, physically remove producer source, then
compile the byte-identical consumer with classic and native compilers against
CTS/MTS output. Match every negative region/useful diagnostic; do not broaden gap
allowances. If emission requires a name, export that exact helper type instead
of annotating the producer to hide an inference failure.

- [ ] **Step 2: Execute ownership through actual installed archives.**

Extend the existing installed script with root/scoped/transient services and
child-first root construction. Resolve two child transients, close the child,
assert root remains live, then close the parent. Use actual assertions such as:

```ts
assert.equal(child.resolve('root'), root.resolve('root'));
assert.notEqual(child.resolve('transient'), child.resolve('transient'));
await child.close();
assert.equal(rootDisposed, 0);
await root.close();
assert.equal(rootDisposed, 1);
assert.equal(transientsDisposed, 2);
```

Run through all eight existing Node/Bun x CJS/ESM x emitter routes. Assert exit,
signal, termination, stderr and exact output; archive installation alone is not
runtime evidence. Preserve all earlier scope, raw/native and box contracts.

- [ ] **Step 3: Document only shipped semantics and verify the final checkpoint.**

README explains default scoped, root-family cache, per-resolution transient,
explicit ownership, root-context capture, completion-time type errors, independent
fork and unchanged no-argument scopes. Changelog/report record production and
actual package evidence with representation cost and limits. Mark only root/
scoped/transient/captive portions delivered; selected sharing, child overrides,
startup/context/cancellation and enterprise completion remain open.

Run covering package tests while iterating. Final gate is `npm run check`,
`npm run typecheck:native`, `npm run build:native`, `npm run check:native`, all four
existing examples and `git diff --check`. Record genuine failures honestly; no
fabricated feature RED when adding coverage for an already working route.
Commit `test: prove installed lifetime contracts and ownership`. Review the
integrated branch, resolve findings in one final wave if needed, push only the
reviewed exact commit to `feat/v0.1`, and verify the remote SHA. Preserve workspaces.
