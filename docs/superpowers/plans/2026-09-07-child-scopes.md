# Tracked Child Scopes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add lazy, tracked default-scoped children with deterministic tree shutdown, retaining exact public contracts and independent forks.

**Architecture:** Runtime coordinates live children; Acquisitions retains all attempt and finalizer bookkeeping. A fulfilling child-settlement prerequisite delays parent shutdown finalizers while immediately closing its acquisition admission gate. Child bags reuse immutable graphs and the existing R/C contracts without a new type carrier.

**Tech Stack:** TypeScript classic 6.0.3 and native 7.0.2, Bun tests, Node 24, current dependency-free core and packed CJS/ESM fixtures.

**Spec:** `docs/superpowers/specs/2026-09-07-child-scopes-design.md`, refining `docs/superpowers/specs/2026-09-06-lifecycle-design.md`.

## Global Constraints

- No required decorators, reflect-metadata, parameter-name parsing, custom compiler transforms, or dynamic code generation.
- Plain functions, classes through adapters, promises, and ordinary service values remain supported.
- Preserve exact synchronous versus Promise-valued service types; never silently await an ordinary factory dependency.
- Preserve `DiBag.withDisposal` and explicit owned-versus-borrowed intent; method names alone never transfer ownership.
- Sharing is configurable and explicit; sharing an instance also shares its already-bound dependencies.
- Application startup closes resources it owns and initiates closure of bags it created; factories clean partial acquisitions before returning ownership.
- Justified public API changes are authorized; document migration and retain supported inference cases in regression tests.
- Test production behavior and compile-time contracts, including negative fixtures; record failing evidence before implementation.
- Do not describe casts, unchecked JavaScript, or dynamically unknown plugins as compile-time proofs.
- Existing explicit authorization permits intermediate commits and ordinary non-force feature-branch pushes. No publication, PR, merge or credential storage.
- Preserve all acquisition modes, nominal provider/token/module contracts, module C constraints, acquired V, and the existing strict diagnostic matcher. No new native diagnostic-gap allowances.
- This plan exposes only no-argument `scope()`. Root/transient policies, sharing/overrides, captive checking, startup and cancellation remain required subsequent increments.

## File responsibilities

`src/runtime.ts` owns child registration, closing coordination and graph reuse.
`src/acquisition.ts` owns its existing attempts plus the narrow shutdown
prerequisite. `src/di-bag.ts` constructs genuine child bags and exposes `scope()`.
Runtime regression coverage belongs in `tests/scopes.test.ts`; graph identity
coverage in `tests/binding-graph.test.ts` and `tests/boundaries.test.ts`.
Cross-file type fixtures and existing package harnesses cover the public boundary.
No provider graph or module carrier redesign is part of this increment.

### Task 1: Tracked child runtime and exact public scope contracts

**Files:** Modify `src/runtime.ts`, `src/acquisition.ts`, `src/di-bag.ts`,
`tests/types.test.ts`, `tests/binding-graph.test.ts`, `tests/boundaries.test.ts`.
Create `tests/scopes.test.ts`, `tests/types/scopes.ts`,
`tests/types/scopes-consumer.ts`, `tests/types/negative/scopes.ts`.

**Interfaces:**

- Consumes `BindingGraph`, `RuntimeContext`, `Acquisitions`, `CleanupFailure`,
  `DiBagCleanupError`, `Bag<R, C>` and existing `fork` validation.
- Produces `Bag.scope(): Bag<R, C>` and internal `Runtime.scope(): Runtime`.
- `Runtime` accepts an optional internal detachment callback supplied only by
  its parent creation path. A bag can accept a genuine existing runtime through
  its non-public constructor; do not export a new runtime constructor.
- `Acquisitions.close(beforeDispose?: Promise<void>): Promise<void>` immediately
  enters closing and retains its identical barrier; its existing disposal drain
  awaits this internally supplied, always-fulfilling prerequisite. The runtime
  obtains it from settlement of all child close promises, not their fulfillment.
- `BindingGraph.withPublicBindings([])` returns the identical immutable graph.

- [ ] **Step 1: Add behavioral RED tests before runtime changes.**

Use the actual public Node facade and the existing deferred-promise helper.
The following is the minimum identity/ownership test; expand into separate
focused cases for the spec acceptance scenarios so failures identify behavior.

```ts
import { expect, test } from 'bun:test';
import { DiBag, DiBagCleanupError } from '../src/node';

test('children own fresh acquisitions while independent forks outlive their source', async () => {
  let next = 0;
  const disposed: number[] = [];
  const root = DiBag.begin().add({
    service: DiBag.withDisposal(() => ++next, value => { disposed.push(value); }),
  }).end();
  const child = root.scope();
  const sibling = root.scope();
  const fork = child.fork();
  expect(next).toBe(0);
  expect(root.resolve('service')).toBe(1);
  expect(child.resolve('service')).toBe(2);
  expect(child.resolve('service')).toBe(2);
  expect(sibling.resolve('service')).toBe(3);
  expect(fork.resolve('service')).toBe(4);
  await root.close();
  expect([...disposed].sort()).toEqual([1, 2, 3]);
  expect(disposed.at(-1)).toBe(1);
  expect(() => child.resolve('service')).toThrow('closed');
  expect(fork.resolve('service')).toBe(4);
  await fork.close();
  expect(disposed).toHaveLength(4);
});
```

Add controlled gates proving every live child starts closing before waiting for
one, every parent/descendant top-level admission gate closes synchronously,
parent-owned finalization waits for children, and pending source dependencies
may still arrive. Nested failures must flatten and retain exact errors (including
`undefined`) and binding/acquisition identity; test reversed child completion
against registration-order diagnostics. Independently closed children detach
on success and failure, without retaining closures or replaying their errors.
Use narrow internal runtime inspection only for deterministic detachment/memory
evidence; do not rely on GC timing. Include raw Promise and shadowed-then native
acquisitions, projection rollback, genuine module private bindings, and
configured portable-core children. Preserve automatic rollback that already
occurs during acquisition; the ordering prerequisite gates shutdown finalizers.

For empty forks assert `graph.withPublicBindings([]) === graph`; extend the
existing narrow graph-method instrumentation to prove `fork([], object)` does
not reconstruct a graph or read unselected getters/custom iterators, while still
rejecting a null/non-object override argument and creating fresh ownership.

Write the type fixtures described in Step 3 now as well, before adding scope.
Run `bun test tests/scopes.test.ts tests/binding-graph.test.ts tests/boundaries.test.ts`
and `bun test tests/types.test.ts -t 'scope|type rejection: scopes'`.
Record actual expected runtime and type RED output before changing production files.

- [ ] **Step 2: Implement the narrow runtime coordination.**

The coordination order must follow this sketch, adapted to the existing class:

```ts
// Runtime private state: children Set<Runtime>, closing?: Promise<void>.
scope(): Runtime {
  this.assertOpen();
  const child = new Runtime(this.graph, this.context, () => this.children.delete(child));
  this.children.add(child);
  return child;
}

// On first close, publish the public closing promise before invoking cleanup.
// Synchronously call close on every current child and this.acquisitions.close.
// Pass childResults.then(() => undefined) as the local drain prerequisite,
// where childResults = Promise.allSettled(childClosingPromises).
// The public promise waits for all children and local cleanup, then flattens
// DiBagCleanupError.failures in child registration order followed by local order.
// Run local cleanup even when a child failed. Never discard an unexpected
// internal rejection: preserve it, after all cleanup, in an AggregateError
// if it cannot truthfully carry an acquisition identity.
// Attach fulfillment AND rejection detachment handlers returning void; clear
// the callback link. Return the original published public promise every time.
```

`Runtime.resolve` and child/fork creation consult its closing state. Its own
Acquisitions admission closes immediately too, preserving factory dependency
proxy rules during closing. Keep per-acquisition maps local and unchanged.
The Bag child constructor receives its parent's graph/context and the new
child Runtime; a plain Bag/fork constructor still creates an independent runtime.
Reject any supplied public scope arguments before child creation, including an
unchecked `{ share: [...] }` or explicit undefined argument; test this boundary.
For an empty validated selection bypass graph rebuilding and do not consume any
unselected property. Add the internal graph empty-batch fast path as well.

- [ ] **Step 3: Verify exact type and negative source fixtures.**

Export inferred root/child/grandchild values from `tests/types/scopes.ts`, using
named async dependencies, a nominal token, a renamed module with private external
requirements, metadata and an explicitly raw-owned Promise provider. The consumer
must contain these exact checks plus concrete resolved-value assertions:

```ts
import type { Assert, Equal } from './assert';
import { root, child, grandchild } from './scopes';
type SameChild = Assert<Equal<typeof child, typeof root>>;
type SameGrandchild = Assert<Equal<typeof grandchild, typeof root>>;
type NotAny<T> = 0 extends (1 & T) ? false : true;
type ChildIsNotAny = Assert<NotAny<typeof child>>;
```

Keep the negative fixture self-contained so existing single-file installed
consumers do not depend on missing sibling fixture sources.
In the producer create a module-private consumer requiring an external `{ exact:
true }` service. On the child, reject an override returning `{ exact: false }`.
Separately prove C retention with an exportless module requiring that external
service: assigning its child to `Bag<{ external: () => { exact: true } }>` (default
C=never) must reject. Exact child/root type equality plus this erasure control
prove retained C without constructing an invalid initially widened provider.
Reject missing/private keys, wrong-token handles and any supplied scope
arguments. Add diagnostic markers with useful text and verify expected lines via
the existing source harness, not casts or `any` escape tests. The runtime tests
may use explicit unchecked boundaries only when testing JavaScript validation.

Run `bun test tests/types.test.ts -t 'scope|type rejection: scopes'`; compare
GREEN against the genuine pre-implementation RED captured in Step 1.

- [ ] **Step 4: Verify the final task and commit.**

Run focused scope/ownership/acquisition/graph/module tests while iterating.
Before committing run `npm run check` once and `npm run typecheck:native`.
Read full exit status and counts. Record RED/GREEN, limitations and changed files
in the task report. Commit only task files with `feat: add tracked child scopes`.

### Task 2: Actual package and declaration-only scope consumers

**Files:** Modify `tests/package.test.ts`, `tests/native-package.test.ts`,
`tests/box-contract-fixtures.ts`, `README.md`,
`docs/superpowers/plans/2026-09-06-enterprise-di-program.md`.
Create `CHANGELOG.md`, `docs/reports/2026-09-07-child-scopes.md`.

**Interfaces:** Consumes Task 1 `Bag.scope(): Bag<R, C>`, source fixtures and
existing local archive/physical declaration consumers. Produces actual runtime
and source-erased declaration evidence for both compilers and module formats.

- [ ] **Step 1: Wire the source fixtures into existing package routes.**

Add `scopes.ts` and `negative/scopes.ts` to `boxContractFixtures` (this is the
existing shared emitted/installed contract list, despite its historical name).
Add `scopes` to the physical producer/consumer feature loop in
`tests/native-package.test.ts`. Extend its import reroute to `./scopes` and
emit this producer with the selected emitter, as acquisition-mode already does.
Both classic and native consumers must load its actual `.d.cts`/`.d.mts` after
physical removal of producer source. Require zero diagnostics for positives,
strict expected-line/message matches for negatives and no new native gap.

```ts
// Existing producer routes retain the source text except package/import edges.
// For each emitter and CTS/MTS route:
expect(classic.getSourceFile(producer)).toBeUndefined();
expect(classic.getSourceFile(declaration)).toBeDefined();
expect(ts.getPreEmitDiagnostics(classic)).toEqual([]);
// Native downstream result must likewise be checked with diagnostics: [].
```

Run the targeted new package route first. Record wiring/runtime failures as RED
only if genuinely observed; this task also adds integration coverage of a feature
already green at source, so do not fabricate a feature RED by claiming otherwise.

- [ ] **Step 2: Exercise real installed scopes in Node/Bun and CJS/ESM.**

Extend existing real installed consumer scripts (reuse their fixture/runner;
avoid another copy of archive setup) to resolve a parent and child service, create
an independent child fork, assert cleanup order and then close the fork.

```js
const log = [];
let id = 0;
const parent = DiBag.begin().add({
  service: DiBag.withDisposal(() => ++id, value => { log.push(value); }),
}).end();
const child = parent.scope();
const independent = child.fork();
if (parent.resolve('service') !== 1 || child.resolve('service') !== 2)
  throw new Error('scope identity');
independent.resolve('service');
await parent.close();
if (JSON.stringify(log) !== '[2,1]' || independent.resolve('service') !== 3)
  throw new Error('scope ownership');
await independent.close();
if (JSON.stringify(log) !== '[2,1,3]') throw new Error('fork ownership');
```

The selected emitter's installed runtime may be included in the native archive
harness to ensure both compiler outputs execute. Assert subprocess exit status,
stderr and expected JSON, not only successful archive installation.

- [ ] **Step 3: Document the actual boundary and evidence.**

Add a concise README child-scope example and the shutdown/detachment/fork
distinction. Add a changelog entry. Write the evidence report with commands,
counts and actual environments; explicitly retain root/transient/share/captive/
startup follow-ups. In the enterprise tracker record this completed slice only;
do not tick complete L1/L2/A1. Record M1 empty-fork graph reuse as addressed.

- [ ] **Step 4: Verify and commit the integrated task.**

Run the covering installed/declaration package tests while iterating. Run
`npm run check`, `npm run typecheck:native`, `npm run build:native` and
`npm run check:native` once on final code; inspect results. Native source keeps
the existing 27 known gaps only, with all new scope regions strictly matched.
Run all four existing examples. `git diff --check` must pass. Commit task files
with `test: verify packaged child-scope contracts` and record the report.

## Completion and continuation

Review each task against its brief and implementation evidence. The completed
compiler checkpoint already has a broad review; the final integration review
must examine this full increment and its interactions with that reviewed code,
without repeating the original 54-case historical compiler measurement.
Verify the final committed delta, then use the user's existing non-force push
authorization. Preserve evidence workspaces. Continue to root/scoped/transient
policies, explicit sharing and lifetime checks; neither this plan nor a green
test run completes the enterprise program.
