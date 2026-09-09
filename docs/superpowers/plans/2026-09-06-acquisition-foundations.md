# Acquisition Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track ownership and dependency edges per acquisition attempt, preserve
retry correctness, and report every shutdown failure through structured errors.

**Architecture:** Keep immutable binding descriptions separate from mutable
attempt records. The cache selects a current attempt for a binding; graph edges
refer to attempt IDs and never retarget a failed attempt to its replacement.
Shutdown drains pending attempts, orders accepted finalizers through the full
attempt graph, and retains all cleanup causes.

**Tech Stack:** TypeScript 5.9.3, Bun runtime/compiler tests, real Node CJS/ESM
package consumers.

**Spec:** `docs/superpowers/specs/2026-09-06-enterprise-di-design.md` and
`docs/superpowers/specs/2026-09-06-lifecycle-design.md`.

## Global Constraints

- No required decorators, reflect-metadata, parameter-name parsing, custom compiler transforms, or dynamic code generation.
- Plain functions, classes through adapters, promises, and ordinary service values remain supported.
- Preserve exact synchronous versus Promise-valued service types; never silently await an ordinary factory dependency.
- Preserve `DiBag.withDisposal` and explicit owned-versus-borrowed intent; method names alone never transfer ownership.
- Sharing is configurable and explicit; sharing an instance also shares its already-bound dependencies.
- Application startup closes resources it owns and initiates closure of bags it created; factories clean partial acquisitions before returning ownership.
- Justified public API changes are authorized; document migration and retain supported inference cases in regression tests.
- Test production behavior and compile-time contracts, including negative fixtures; record failing evidence before implementation.
- No publication, remote push, or credential storage without a separate explicit request; prepare local commits, package artifacts, and publishing instructions.
- Do not describe casts, unchecked JavaScript, or dynamically unknown plugins as compile-time proofs.

## Prerequisites and scope

Execute after the named-module increment's review gate. Preserve installed
module requirements, private identities, override visibility and original
Promise exposure. This is the identity/shutdown foundation of L2, not all of L2
or L1: transient multiplicity, child scopes, sharing and startup remain required
later tasks. Owned provider transformations consume the attempt bookkeeping
after this foundation; they are not introduced here.

The current runtime uses a binding-keyed edge map. A confirmed failure case is:
A catches B's first failure and becomes cached; B retries and reads cached A;
the old A-to-B edge incorrectly points at the retry and reports a cycle. Attempt
IDs must correct the relationship without disabling genuine cycle detection.

The current cleanup contract attempts every disposer but exposes only the first
error. Changing the rejected value to an aggregate is intentional and requires
public migration coverage. Do not merely change the error message.

### Final-review refinement: native observation boundary

The final broad review found that Promise.resolve before intrinsic observation
assimilates native subclasses through their overridable then method. The one
final fix wave must observe genuine native Promise state directly and use an
independent native pending barrier, not the derived species result. Preserve
same/foreign native Promise identity and original inspection/setup errors.

A portable TypeError fallback cannot distinguish a structural brand failure
from a genuine Promise's constructor/species setup throwing that very same
error. Automatic raw structural-thenable assimilation is therefore intentionally
replaced with explicit conversion inside the factory: Promise.resolve or an
async factory. Preserve their first-fulfillment/then-throw and rejection/retry
tests through that explicit supported path, and add direct-structural rejection
with no callback/ownership. No host-specific brand hook or new helper is added.
Document this migration; the enterprise/lifecycle specs carry the same policy.

Required fix regressions: native subclass/foreign-native overridden then cannot
substitute disposal values; constructor/species TypeError preserves original
error and retry; arbitrary species results cannot settle/starve pending close;
converted structural thenables preserve fulfillment, rejection and exact exposed
native Promise identity. This review-driven API refinement is recorded as a
ruling, not a claim that the earlier implementation already met it.

## File responsibilities

- `src/acquisition.ts`: internal attempt records and ownership/failure record
  types, without a public unchecked acquisition constructor.
- `src/runtime.ts`: binding-cache selection, dependency resolution against
  attempt identities, pending-work bookkeeping and shutdown orchestration.
- `src/errors.ts`: public immutable cleanup-failure views and
  `DiBagCleanupError`.
- `src/index.ts`: public error/type exports; runtime mutation authority remains
  internal.
- `tests/acquisition.test.ts`: caught-failure/retry identities and lifecycle
  state regressions.
- `tests/disposal.test.ts`: ordering, aggregate errors and exact close barrier.
- `tests/modules.test.ts`: cleanup and retry through private module bindings.

### Task 1: Attempt identities and complete shutdown diagnostics

**Files:**
- Create: `src/acquisition.ts`, `src/errors.ts`, `tests/acquisition.test.ts`.
- Modify: `src/runtime.ts`, `src/index.ts`, `tests/disposal.test.ts`,
  `tests/runtime.test.ts`, `tests/modules.test.ts`, `tests/package.test.ts`,
  `tests/wbs-scope.test.ts`, `README.md`,
  `docs/migrations/0.1-to-enterprise.md`.

**Interfaces:**
- Public Bag/Builder/Module inference and registration signatures do not
  change. `close()` still returns the identical Promise on every call, including
  after failure; new top-level resolution rejects once closing starts.
- Give each acquisition attempt an opaque symbol ID distinct from its binding
  ID. A cache maps binding IDs to current attempt records. A runtime has an
  owner identity that future scopes may use; it does not yet share acquisitions
  with other runtimes.
- An attempt retains binding ID, owner ID, diagnostic label, state, dependencies
  by attempt ID, exact exposed value, accepted ownership, and pending work.
  These are internal records, never live public inspection objects.
- Incoming dependency edges retain their target attempt identity. Failure
  evicts only that attempt if it is still current and removes its abandoned
  outgoing dependencies. It must not mutate a subsequent retry's cache/edges.
- Genuine synchronous and post-await cycles retain deterministic readable
  paths. A creating attempt cannot be returned as though it already had a value.
- Ordinary factories keep their exact result/Promise identity. Trusted native
  observation, failed-inspection/setup rollback, fulfilled-value disposal,
  pending-close fixed-point draining and unowned intermediary ordering remain.
- `DiBagCleanupError extends AggregateError` carries readonly `failures`, each
  containing `acquisitionId: symbol`, `bindingId: symbol`, `label: string`, and
  `error: unknown`. Freeze failure records and the array; retain original error
  identity, including thrown `undefined`. Its inherited `errors` contains those
  same error values in cleanup-attempt order.
- Shutdown attempts every accepted finalizer, then rejects with one
  `DiBagCleanupError` if any failed. Clear runtime acquisition/cache/pending
  state in the final shutdown path. The closing Promise/error may retain its
  diagnostic evidence, but not an entire reachable runtime graph.

- [x] **Step 1: Write the caught-failure and aggregate regressions.**

```ts
test('a retry does not inherit the identity of a caught failed attempt', async () => {
  let first = true;
  const valueA = { id: 'a' };
  const valueB = { id: 'b' };
  const bag = DiBag.begin().add({
    a: (deps: { b: typeof valueB }) => {
      try { void deps.b; } catch {}
      return valueA;
    },
    b: (deps: { a: typeof valueA }) => {
      if (first) { first = false; throw new Error('first attempt'); }
      expect(deps.a).toBe(valueA);
      return valueB;
    },
  }).end();
  expect(bag.resolve('a')).toBe(valueA);
  expect(bag.resolve('b')).toBe(valueB);
  expect(bag.resolve('a')).toBe(valueA);
  await bag.close();
});

test('shutdown preserves every cleanup cause and its acquisition identity', async () => {
  const first = new Error('first cleanup');
  const events: string[] = [];
  const bag = DiBag.begin().add({
    a: DiBag.withDisposal(() => 'a', () => { events.push('a'); throw first; }),
    b: DiBag.withDisposal(({ a }: { a: string }) => a + 'b', async () => {
      events.push('b');
      throw undefined;
    }),
    c: DiBag.withDisposal(() => 'c', () => { events.push('c'); }),
  }).end();
  bag.resolve('b');
  bag.resolve('c');
  const closing = bag.close();
  expect(bag.close()).toBe(closing);
  let failure: unknown;
  try { await closing; } catch (error) { failure = error; }
  expect(failure).toBeInstanceOf(DiBagCleanupError);
  if (!(failure instanceof DiBagCleanupError)) throw new Error('missing aggregate');
  expect(events).toEqual(['c', 'b', 'a']);
  expect(failure.errors).toEqual([undefined, first]);
  expect(failure.failures.map(item => item.error)).toEqual([undefined, first]);
  expect(failure.failures.map(item => item.label)).toEqual(['b', 'a']);
  expect(new Set(failure.failures.map(item => item.acquisitionId)).size).toBe(2);
  expect(Object.isFrozen(failure.failures)).toBe(true);
  expect(failure.failures.every(Object.isFrozen)).toBe(true);
  expect(bag.close()).toBe(closing);
});
```

Also cover the caught-failure path through a module's private B binding and an
async variant whose first rejected B Promise is awaited/caught by A before B
retries through cached A. Keep original Promise identity assertions and use
actual cleanup event arrays. Existing genuine-cycle tests must continue failing
with their original useful paths, not becoming successful resolutions.

- [x] **Step 2: Record the expected RED evidence.**

Run `bun test tests/acquisition.test.ts`. The current binding-keyed graph must
fail the caught-retry case with its false cycle; the aggregate test must fail
because the public class/structured failure contract is absent. Record distinct
behavioral evidence for the retry case even if a new missing error export would
otherwise prevent loading the entire file. Separate the tests temporarily or
run the retry regression before importing the new error.

- [x] **Step 3: Replace binding-keyed acquisition state with attempt records.**

Use the following identity relationship; no edge lookup may substitute the
cache's latest attempt for an existing target ID:

```ts
type AcquisitionId = symbol;
type State = 'creating' | 'pending' | 'ready' | 'failed' | 'disposing' | 'disposed';
interface Acquisition {
  readonly id: AcquisitionId;
  readonly bindingId: BindingId;
  readonly ownerId: symbol;
  readonly label: string;
  readonly dependencies: Set<AcquisitionId>;
  state: State;
  exposed: unknown;
}
// Runtime-private maps:
// cache: Map<BindingId, Acquisition>
// attempts: Map<AcquisitionId, Acquisition>
// pending: Map<AcquisitionId, Promise<void>>
// Finalizers are associated with the owning attempt, not just bindingId.

function evictIfCurrent(attempt: Acquisition): void {
  if (cache.get(attempt.bindingId) === attempt) cache.delete(attempt.bindingId);
  attempt.dependencies.clear();
  attempt.state = 'failed';
}
```

Create and cache the `creating` attempt before invoking its factory. Dependency
resolution obtains the actual cached/new target attempt, records the edge and
checks its path before invoking a newly created target. Return an exposed value
only from an attempt that has actually produced it; reentrant construction is
a cycle, not a memoized `undefined` result. Distinguish a legitimate successfully
returned `undefined` with state/cache membership.

Keep an attempt's dependency proxy tied to that attempt and its lexical binding
description. During closing, allow necessary reads only from attempts still
creating/pending; completed and failed attempts cannot start late acquisitions.
Keep all relevant accepted ownership until it is disposed or handed to the
shutdown traversal. A failed unowned attempt with no pending work may be removed
once references can safely remain non-retargeting IDs.

Register the native observer against the attempt object and ID. Fulfillment
records the actual owned value; rejection evicts that attempt conditionally.
Setup failures retain the existing no-raw-disposal contract and original error.
Drain pending attempts to a fixed point before traversing ownership, because
in-flight factories can discover new dependencies after `await`.

- [x] **Step 4: Implement structured shutdown failures and migrate assertions.**

```ts
export interface CleanupFailure {
  readonly acquisitionId: symbol;
  readonly bindingId: symbol;
  readonly label: string;
  readonly error: unknown;
}

export class DiBagCleanupError extends AggregateError {
  readonly failures: readonly CleanupFailure[];
  constructor(failures: readonly CleanupFailure[]) {
    const snapshot = Object.freeze(failures.map(item => Object.freeze({ ...item })));
    super(snapshot.map(item => item.error), `Failed to dispose ${snapshot.length} acquisition(s)`);
    this.name = 'DiBagCleanupError';
    this.failures = snapshot;
  }
}
```

Traverse all attempt dependencies, including unowned intermediaries, and invoke
dependents' finalizers before dependencies' finalizers. Collect failures without
short-circuiting. Existing first-error tests must be migrated to assert the
aggregate's complete original-error list, preserving all ordering and
exactly-once assertions. The public package must expose one error-class identity
to its CJS and ESM consumers; test `instanceof` and typed failure fields through
emitted declarations.

The existing WBS multiple-owner test currently expects application aggregate
errors `[first, second]`. Preserve its lifecycle/order assertions, but now assert
that each application-level error is the respective bag's `DiBagCleanupError`,
and that its `.errors` is `[first]` or `[second]`. Do not flatten away scope-level
failure identities or alter the application's independent owner-close loop.

Add close-after-rejection and reentrant-close coverage where the disposer calls
`close()` and observes the same Promise without awaiting its own shutdown.
Document that a disposer must not await the scope-close Promise whose completion
requires that very disposer; arbitrary user-created Promise cycles cannot be
forcibly completed.

- [x] **Step 5: Verify, document and commit.**

Run focused acquisition/disposal/runtime/module tests, then `npm run check`,
`npm run example:wbs`, and `bun run examples/modules.ts`. Exercise real Node
subprocesses with permitted execution. Check `git diff --check`.

Document per-attempt retry identity and the intentional migration from first
cleanup error to `DiBagCleanupError.failures`/`.errors`, with original causes
and close-barrier semantics. Keep source and emitted declaration inference
unchanged. Commit as `fix: track acquisition identities and aggregate shutdown failures`.

## Coverage self-review

This plan implements the documented false-cycle correction, acquisition-owned
bookkeeping, conditional retry eviction, immutable structured cleanup failures,
and regression-preserving shutdown. It establishes the required foundation for
owned transformations and later transients. It does not claim transient, child
scope, sharing, startup, cancellation, or the complete L2 acceptance row.
