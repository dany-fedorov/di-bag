# Acquisition-local cleanup

Design note for [issue #27](https://github.com/dany-fedorov/di-bag/issues/27),
"Support acquisition-local cleanup registration for partially initialized
providers". The issue states the problem and the acceptance criteria but leaves
the API a design choice. This note settles the choice.

**Status: implemented.** The open question is resolved in favour of opt-in, and
the two assumptions implementation forced are recorded in "Decisions taken
during implementation" at the end.

## Problem

`withDisposal` owns the value a factory *returns*. A factory that acquires a
resource and then throws before returning hands the bag nothing to dispose, so
the resource leaks:

```ts
const session = DiBag.withDisposal(async () => {
  const socket = await connect();      // acquired
  await handshake(socket);             // throws: socket leaks
  return new Session(socket);
}, session => session.close());
```

`buildAndStart` rollback closes acquisitions the bag already owns, but cannot
see a resource still hidden inside an unfinished factory.

## Decision: rollback-only semantics

Actions registered during an acquisition run **only when that acquisition fails
or is cancelled**. Successful completion discards them; the value the factory
returns is owned by `withDisposal` as it is today.

This is the smaller of the two candidate rules. The alternative — adopting
registered actions as real ownership stages that also run at `close()` — would
need an extra rule to stop `withDisposal` from double-owning the same value.
Under rollback-only that criterion is true by construction: the two mechanisms
never both own anything, because registered actions cease to exist the moment
the factory returns.

The rule stated for users: *a deferred action runs if, and only if, the factory
that registered it does not complete.* The anchor is the factory, not the whole
acquisition: once the factory has returned, ownership has moved to the value it
produced, and a later projection failure disposes that value through its
ownership stages alone.

## API

Extend `AcquisitionContext` with one method:

```ts
export interface AcquisitionContext {
  /** Aborted when the acquisition's owning scope begins closing. */
  readonly signal: AbortSignal;
  /** Release an already-acquired resource if this acquisition does not complete. */
  defer(action: (this: void) => void | Promise<void>): void;
}
```

Usage:

```ts
const session = DiBag.withDisposal(
  DiBag.fromFactory(async (_deps, context) => {
    const socket = await connect();
    context.defer(() => socket.close());   // covers the window below
    await handshake(socket);               // throws: socket.close() runs
    return new Session(socket);            // succeeds: defer discarded
  }, { context: 'acquisition' }),
  session => session.close(),
);
```

One method, no new exported type, no new registration form. `defer` is chosen
over `use(value, dispose)` because it composes with resources whose release is
not a method on the value, and it reads the same as the `using` proposal's
`AsyncDisposableStack.defer`.

`defer` throws `DI_BAG_INVALID_CLEANUP` (new code) when passed a non-function,
and `DI_BAG_CLEANUP_AFTER_FACTORY` (new code) when called after its
acquisition has settled — a retained `context` is a leak, not a stack.

## Runtime changes

### 1. The context becomes per-acquisition

`ScopeAcquisitions.getContext()` (`src/acquisition.ts:163`) memoises **one**
frozen `{ signal }` for the whole scope and hands the same object to every
contextual factory. A per-acquisition action list cannot hang off a shared
object, so the context becomes per-attempt:

- the scope keeps its single `AbortController`, unchanged;
- each contextual acquisition gets a fresh frozen context wrapping that scope
  signal plus its own `defer` bound to that attempt.

The signal's observable behaviour is unchanged: same scope-wide abort, same
cause, same already-aborted case when the scope is closing.

### 2. Deferred actions live in an `AcquisitionRollback` record

The list is its own small object, held by `ProviderExecution` next to `stages`
and allocated only for a contextual registration. It is separate from `stages`:
stages are owned values disposed at close, deferred actions are rollback only.

The record exists so the frozen context can carry `defer` while referencing
neither the execution nor the scope — see "A retained context must pin nothing"
below. It owns its own settled flag, so registration closes in one place.

- `defer(action)` pushes onto the list while the source is unsettled.
- When the source stage settles ready — synchronously in `evaluate`, or from the
  promise handler in `capture` — the list is cleared without running anything.
- When the source stage settles failed, the list is kept and runs LIFO from
  `disposeStages`.

Cancellation needs no separate path: a factory that observes `signal` and
throws is the failure path.

### 3. Ordering

Deferred actions run LIFO among themselves, and **before** any accepted
ownership stage of the same attempt.

The two cannot both release the same resource, because the list is settled by
the **source** stage, not by the attempt's final result stage. A factory that
returns discards its list immediately, even while later projections are still
running; if one of those projections then fails, the accepted `withDisposal`
stage disposes the value exactly once. Anchoring on the result stage instead
double-releases in exactly that shape, which is what the first review of this
change found (`tests/acquisition-cleanup.test.ts`, "a projection failing after
the factory returned releases the value exactly once").

### 4. Failures

Rollback reuses the existing best-effort machinery rather than inventing a
second one: every action is attempted even when one rejects, and each rejection
goes to the observer `cleanup-failed` channel and to `ScopeAcquisitions.failures`
with an `invoking()` sequence, exactly as a close-time disposer failure does.
A failing rollback is therefore visible in `DiBagCleanupError` at close and in
observer output, and never replaces or masks the initialization error.

The initialization error keeps propagating as it does today.

### 5. Scheduling

Rollback runs through the existing retirement path: `retire(attempt)` already
calls `execution.dispose()` for a failed attempt, publishes the resulting
promise in `retired`, and `disposeAll` already awaits it. Deferred actions
therefore run inside `disposeStages`, ahead of the accepted stages, and need no
second mechanism.

This means rollback is *scheduled* when the acquisition settles, not awaited by
the failing `resolve`. A synchronous factory's failure still propagates
synchronously; its release completes on the microtask queue. Callers that need
to observe completion await `close()`, or `DiBagStartupCancelledError.cleanupPromise`
— both of which already wait for retired attempts.

The alternative, running synchronous actions inline before the throw, would add
a second rollback path for a guarantee no acceptance criterion asks for.

No new timeout option. The acceptance criterion's "bounded waiting" is met by
the existing `buildAndStart({ timeoutMs })` and `close({ timeoutMs })` waits,
which already bound the time a caller spends waiting for factory and disposer
code without claiming to stop it.

## Acceptance criteria, mapped

| Criterion | Covered by |
| --- | --- |
| A closes exactly once when B fails | rollback-only rule; list cleared after running |
| Success then close closes each resource once | success discards deferred actions; `withDisposal` unchanged |
| No double ownership | true by construction under rollback-only |
| Documented order, others attempted on rejection | §3, §4 |
| Both failures preserved | §4: init error propagates, cleanup failures to observers/`DiBagCleanupError` |
| Cooperative cancellation, bounded waiting | unchanged scope signal; existing `timeoutMs` waits |
| Nothing acquired by declaring a provider | unchanged: providers are lazy handles |

## Tests

`tests/acquisition-cleanup.test.ts`, 22 cases:

- acquire, then fail — the resource is released once and the init error propagates
- success — no deferred action runs; `close()` runs the `withDisposal` disposer once
- LIFO order across three deferred actions
- one action rejects — the rest still run; the failure surfaces at `close()` in `DiBagCleanupError`
- a rejecting source runs rollback and never reaches its ownership stage
- **a projection failing after the factory returned releases the value exactly once**
  (the regression test for the source-anchoring fix in §3)
- rollback runs without waiting for `close()`
- rollback reports each failure as `cleanup-started` / `cleanup-failed` / `cleanup-completed`
- scope close aborts mid-acquisition — the factory throws on `signal` and rollback runs
- `defer` after a synchronous acquisition settles throws `DI_BAG_CLEANUP_AFTER_FACTORY`
- `defer` after an asynchronous acquisition settles throws the same code
- `defer(nonFunction)` throws `DI_BAG_INVALID_CLEANUP`
- a synchronous factory's resource is released after its failure propagates (§5)
- each transient attempt owns its own action list
- `buildAndStart` rollback releases a resource hidden inside an unfinished factory
- a `direct` projection over a rejecting source defers rollback to `close()` —
  pins the known limitation below, and the only shape where rollback and an owned
  value of the same acquisition both run, in that order
- `close()` waits for a Promise-returning deferred action
- a `raw` asynchronous factory settles at its first `await`, as documented
- a rollback failure during startup appears in `DiBagStartupError.cleanupFailures`
- a retried scoped acquisition registers on a fresh list, and the failed
  attempt's context is closed
- a root service acquired through a child runs its rollback on the owning bag

`tests/acquisition-retention.node.mjs` adds the retained-context case; it runs
only in CI's `contracts` job.

Type fixtures: `tests/types/startup.ts` pins `defer`'s signature and return type;
`tests/types/negative/startup.ts` rejects a non-function and a callback that
declares a parameter.

## Docs

`docs/agent/recipes.md` (one recipe; the API card is generated from JSDoc and
covers only the facade, builder, and bag surfaces, so an interface member cannot
get a card entry), `docs/agent/errors.md` (two new codes),
the tutorial section the `AcquisitionContext` JSDoc links to, and a CHANGELOG
entry. `AGENTS.md` rule 6 gains one sentence on partial acquisition.

## Changelog entry for the next release chore

`tests/release-artifacts.test.ts` pins `CHANGELOG.md` to the published
`package.json` version and rejects an `## Unreleased` heading, so this branch
carries no changelog change. Paste the following under the next version heading
when the release chore bumps it.

```md
### Added

- `context.defer(action)` on the acquisition context registers acquisition-local
  cleanup for a resource a factory already holds, closing the gap where a factory
  that fails after acquiring a resource has nothing to hand to `withDisposal`
  ([#27](https://github.com/dany-fedorov/di-bag/issues/27)). A deferred action
  runs if, and only if, the factory that registered it does not complete:
  returning a value discards every deferred action, so `withDisposal` stays the
  single owner of the returned value, including when a later projection fails. Failure and cancellation run them in reverse registration
  order, before any value the same attempt owns; each rejection is reported like
  a `close()` disposer failure. New codes `DI_BAG_INVALID_CLEANUP` and
  `DI_BAG_CLEANUP_AFTER_FACTORY`.

### Changed

- Each acquisition now receives its own frozen `AcquisitionContext` object rather
  than one shared per scope, because deferred cleanup belongs to a single
  attempt. The `signal` is unchanged: it is still the owning bag's, shared by
  every acquisition that bag owns. Code comparing context objects by identity
  should compare `context.signal` instead.
```

## Decisions taken during implementation

**Opt-in, as designed.** `defer` requires `{ context: 'acquisition' }`. Adding
rollback to an existing plain factory is therefore a signature change, which is
the intended cost: a universal context would allocate one per acquisition
whether or not a factory uses it, and the `context: 'acquisition'` marker is
what already tells a reader that a factory participates in cancellation.

**The context object is now per-acquisition (behaviour change).**
`getContext()` memoised one frozen context per scope, and two tests pinned that
identity: `tests/startup.test.ts` compared the contexts of two bindings in one
scope, and `tests/selected-scope-runtime.test.ts` compared a late acquisition's
context with an earlier one. A per-attempt `defer` cannot live on a shared
object, so both now compare `context.signal` instead. The contract that matters
— *which owner's cancellation an acquisition observes* — is unchanged; only the
object wrapping the signal is no longer shared. Recorded in the changelog.

**A retained context must pin nothing.** Two rounds of review found retention
bugs here, both of the same shape: a reference the context reached indirectly.
First, building the context inline in `resolveBinding` put the
`ProviderExecution` into the scope record shared with the dependency proxy's
handlers. Then, after that was fixed, the `defer` closure still captured the
execution directly, so a factory that kept its context — the documented way to
read `signal` later — kept the execution, its frames, and through
`execution.events` the attempt and the whole scope. Compaction made it worse:
`compact()` copies the frames into a `CompletedExecution` and the original's copy
was never cleared, because `release()` only ever runs on `attempt.execution`.

The fix is structural rather than another severed reference. `defer` closes over
an `AcquisitionRollback` and nothing else, the signal is read eagerly when the
context is built, and `compact()` clears the frames it has handed over. A
retained context now pins one small record and the signal, which is the profile
it had before this feature existed.
`tests/acquisition-retention.node.mjs` covers both routes: the dependency proxy
and the retained context. Neither runs in `npm run check` — they need
`--expose-gc` and live in CI's `contracts` job.

**A known limitation: one exotic shape leaks.** A `direct`-mode projection over
an asynchronous source produces a result stage that is ready while the source is
still pending — `transformService(asyncContextualFactory, { mode: 'direct',
transform: promise => ({ wrapped: promise }) })`. If that source then rejects,
the attempt's result is already ready, so nothing retires it: its deferred
actions run at `close()` if the attempt owns anything else, and not at all if it
does not.

This is a real leak in that shape, not parity with existing ownership. The
superficially similar case — `own()` queuing a disposer on a pending stage whose
promise then rejects, and the rejection path clearing `stage.owners` — drops
nothing, because a rejected promise has no fulfilled value to dispose. A deferred
action is different: it names a resource the factory said it already holds.

Fixing it needs a retirement path for an attempt whose source failed while its
result stayed ready, which is a change to the attempt lifecycle rather than to
this feature. Tracked as
[issue 32](https://github.com/dany-fedorov/di-bag/issues/32); the tutorial
carries the caveat so the "if, and only if" rule is not read as unconditional.

**`compact()` and `retire()` learned about rollback.** An attempt holding only
deferred actions has no accepted stage, so `hasOwnership` was not enough:
`retire` would have released it without running them, and `compact()` would have
discarded the list. Both now also consult `hasRollback`. In `retire()` the guard
is load-bearing. In `compact()` it is not: the only shape it retains is the
`direct`-projection leak above, where nothing consumes the list anyway. It is
kept so that a future retirement path for that shape finds the list intact.
