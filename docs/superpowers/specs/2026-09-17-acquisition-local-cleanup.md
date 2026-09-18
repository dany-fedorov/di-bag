# Acquisition-local cleanup

Design note for [issue #27](https://github.com/dany-fedorov/di-bag/issues/27),
"Support acquisition-local cleanup registration for partially initialized
providers", and [issue #32](https://github.com/dany-fedorov/di-bag/issues/32),
the one shape the first design leaked in.

**Status: implemented.** A disposer stack the bag owns replaced the first,
rollback-only design (`context.defer`, never released). The implementation plan
is `docs/superpowers/plans/2026-09-18-01-push-disposer.md`.

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

## Decision: a disposer stack the bag owns

A context-aware factory pushes a disposer for each resource as soon as it holds
it. Every pushed disposer runs exactly once, last pushed first:

- **If the factory fails** — throws, rejects, or is cancelled through `signal` —
  the stack runs at once.
- **If the factory returns**, the bag owns the stack below the returned value.
  It runs at `close()`, or at retirement when a later projection fails, after
  every disposer of the service.

The first design was rollback-only: success discarded the list, so `withDisposal`
stayed the single owner of everything by construction. It was dropped for two
reasons. An intermediate the returned value does not own (a pool the factory
opened on the way) leaked on success. And its rule, "runs if, and only if, the
factory does not complete", failed one shape outright (#32).

A stack gives up the by-construction single-ownership property: a pushed
disposer and a service disposer can now name the same resource. What replaces
it is a rule plus information:

- **One rule, stated once:** `withDisposal` owns the returned value;
  `pushDisposer` owns what is acquired on the way; a pushed resource that is also
  the returned value acts only when `disposerCtx.reason !== 'service-disposed'`.
- **`DisposerContext.reason`** tells each pushed disposer why it is running, and
  describes only the `withDisposal` on the returned value — the one disposer a
  factory author can see.

The library cannot enforce the rule — it cannot know that `session.close()`
closes the socket — so the reason check is how a factory author states it.

## API

`AcquisitionContext` (published in 0.3.0) gains `pushDisposer`; the unreleased
`defer` is removed.

```ts
export interface AcquisitionContext {
  readonly signal: AbortSignal;
  pushDisposer(this: void, disposer: (this: void, disposerCtx: DisposerContext) => void | Promise<void>): void;
}
export interface DisposerContext {
  readonly reason: 'factory-failed' | 'no-service-disposer' | 'service-disposed' | 'service-disposal-failed';
}
```

The reasons:

| `reason` | when |
| --- | --- |
| `'factory-failed'` | the factory threw, rejected, or was cancelled; no service exists |
| `'no-service-disposer'` | the factory returned and no `withDisposal` owns the returned value |
| `'service-disposed'` | the service disposer ran without throwing |
| `'service-disposal-failed'` | the service disposer threw; the pushed disposers still run |

The service disposer is the ownership of the returned value: the source's own
`dispose` and any `withDisposal` attached before the first `transformService`.
Metadata frames preserve the value, so ownership after `withMetadata` still
counts. Ownership of a transformed value belongs to whoever transformed it; its
outcome is reported through `cleanup-failed` and `DiBagCleanupError`, not
through `reason`.

How the reason is decided:

- **Mixed outcomes.** `disposeStages` awaits every barrier before disposing, so no
  stage is pending when the reason is computed. Each accepted stage records
  whether it owns the returned value; the reason is decided from those alone. None
  → `'no-service-disposer'`; one threw → `'service-disposal-failed'`; otherwise
  `'service-disposed'`.
- **Retirement after a projection fails.** The source returned, so the stack is
  owned; the failed projection's own ownership was never accepted. The reason
  comes from the returned value's `withDisposal`, if any.
- **The #32 fulfil shape** — a `direct` projection over a source that fulfils
  after the wrapper was handed out: the stack is accepted at fulfilment, the
  wrapper's stage was accepted earlier and runs first, and the reason ignores it:
  the wrapper owns a transformed value.
- **The failure path is always `'factory-failed'`**, even when a projection stage
  is owned.
- **One frozen `DisposerContext` per run**, shared by every disposer in it.

Conventions: examples name the factory's context `factoryCtx` and the disposer's
`disposerCtx`, never `context` or `ctx`. `DisposerContext` is exported from
`di-bag` and, through `export *`, from `di-bag/node`.

Error codes: `DI_BAG_INVALID_CLEANUP` when the argument is not a function, and
`DI_BAG_CLEANUP_AFTER_FACTORY` when pushing after the factory settled — from the
service, a projection, or a disposer already running.

## Runtime

- **`DisposerStack`** (`src/provider-execution.ts`) holds one factory's pushed
  disposers and a settled flag. It is the only thing the frozen context
  references; see "A retained context must pin nothing".
- **`settleDisposers(state)`** runs where the *source* stage settles: in
  `evaluate` for a synchronous source, in the promise handler for a native one.
  - Failed: it schedules `rollbackDisposers()` as pending work of the execution.
    That run starts one microtask after the source settles, emits one
    `cleanup-started` / `cleanup-completed` pair, and passes `'factory-failed'`.
    Without a projection it follows `acquisition-failed`; under a projection it
    may precede it, because the run is anchored on the source and the event on
    the attempt's result.
  - Ready: it marks the stack owned and reports the acceptance, so
    `hasOwnership` is true.
- **`disposeStages`** runs the accepted stages in reverse index order, then the
  owned stack with the reason computed from them.
- **Ownership.** An accepted stack counts as ownership: `close()` visits the
  attempt, retirement disposes it, and `compact()` keeps it. An in-flight rollback
  is pending work, so `retire()` and `close()` already wait for it.
- **Close progress.** `rollingBack` is true while the failure-path run is in
  flight, and `collectProgress` reports such an attempt as pending.

### Why rollback is anchored on the source

Rollback used to be settled by the source stage but only ever *run* from the
attempt's disposal. That is reached by retirement, which fires only when the
*result* stage settles, or by `close()`, which visits only owned attempts. A
`direct` projection over an asynchronous source makes the result ready while the
source is still running, so a source that then rejected reached neither: its
cleanup ran at `close()` only if the attempt owned something else, and otherwise
never (#32).

The lifecycle had no "source settled" event. `settleDisposers` is that event.

## Ordering

At close, per attempt: projection ownership, then `withDisposal` on the source,
then the pushed disposers last-pushed-first. A `map-async` projection still
pending when `close()` starts is settled by the barrier wait before anything is
disposed. Across attempts the existing dependency order holds: a consumer's
stages *and* stack finish before its dependency's begin.

**One inversion, in the #32 failure shape.** A source that fails under a `direct`
projection runs its stack at once, while the projection's own disposer runs at
`close()`. It is harmless: the projection was handed a promise that rejected, so
it cannot hold the pushed resources unless the factory leaked them through a
side channel.

**`raw` asynchronous factories** complete when they return their promise. A
disposer pushed before the first `await` is owned and runs at `close()` with a
service reason; one pushed after throws; the promise's later rejection is never
observed, so it never produces `'factory-failed'`.

**Transient services** keep each successful attempt's stack until `close()`,
exactly as a transient `withDisposal` keeps its value.

## Observers and failures

- A successful acquisition emits one cleanup pair at close covering its stages
  and its stack.
- A failed factory emits one pair for the rollback run. Without a projection it
  follows `acquisition-failed`; under a projection it may precede it, and the
  first pushed disposer may run before the consumer sees the rejection. Waiting
  for the result instead would bring back #32 for a transform that delays or
  swallows the rejection.
- The #32 failure shape emits two: a rollback run when the factory fails and a
  disposal run at close. A pair brackets one cleanup *run*, not one attempt.
- Failures surface in `DiBagCleanupError` at close and in
  `DiBagStartupError.cleanupFailures`. Startup rollback also releases the stack
  of a selected service that had already succeeded.

## Acceptance criteria, mapped

| Criterion (#27 and #32) | Covered by |
| --- | --- |
| A closes exactly once when B fails | a failed factory runs its stack once, at once |
| Success then close closes each resource once | the one-disposer rule, and the reason check where the service also releases it |
| No double ownership | a documented rule plus `DisposerContext.reason`, no longer by construction |
| Documented order; others attempted on rejection | "Ordering"; every disposer is attempted |
| Both failures preserved | the initialization error propagates; cleanup failures reach observers and `DiBagCleanupError` |
| Cooperative cancellation, bounded waiting | unchanged scope signal; existing `timeoutMs` waits, now reporting in-flight rollback |
| Nothing acquired by declaring a provider | unchanged: providers are lazy handles |
| #32: rollback under a `direct` projection, without waiting for `close()` | source-anchored rollback |
| #32: a racing `close()` waits before disposing anything | rollback is pending work, which `close()` drains first |

Issue #32's original criterion "the attempt's inspected state distinguishes a
ready projection from a failed source" was dropped. The state describes the
service that was delivered: consumers hold it and `acquisition-ready` was true
when emitted, so a later `failed` would give one attempt two terminal outcomes.
The factory's failure is visible in the rejected promise the consumer holds and
in the cleanup events.

## Retention

The bag holds pushed disposers until `close()` by design; that is what owning
them means. After close, a context the application retains pins only its
`DisposerStack` and the signal, and the signal pins nothing of the bag.

That last part needed a fix, and it predates this feature. `close()` without a
cause used to call `abort()` with no reason, so the runtime created an
`AbortError` inside the closing call. An unformatted V8 stack keeps the frames it
captured alive, and those frames reached the scope and its graph. So any
application that kept a `signal` — or a context — kept the whole closed bag.
The bag now aborts with one reason built at module load, with its stack
formatted up front: still an `AbortError` with the legacy numeric `code` 20, its
message naming `DI_BAG_CLOSING`. A startup that is cancelled or fails aborts
with its own cause, used as-is, so the signal then retains whatever that cause
retains. The library's own startup and close timeout errors format their stacks
before they are handed on, for the same reason: they are created in closures
over the runtime, and a startup timeout becomes the signal's reason.

`tests/acquisition-retention.node.mjs` covers the dependency proxy, frames under
a retained context, a pushed disposer's payload being alive before close and
collectible after, and — the only cases that can detect a retained graph — a
payload reachable solely through the bag's graph, with the context or the signal
kept after the bag is dropped, and the same after a startup timeout. The frames cases cannot detect a context that
captured the execution: `compact()` and `release()` clear frames either way.
These suites need `--expose-gc` and run in CI's `contracts` job, not in
`npm run check`.

## Tests

`tests/acquisition-cleanup.test.ts`, 48 cases, covering:

- **Failure path:** release once, LIFO, best-effort, the frozen shared
  `'factory-failed'` context, never inline with a synchronous *factory* throw,
  cancellation, and event order with and without a projection. (Retirement after
  a projection fails may run disposers inline, as `withDisposal` already does.)
- **#32:** a `direct` projection over a rejecting source with and without
  ownership, a disposer pushed after the wrapper was handed out, and a `close()`
  racing the rollback. Each asserts after a macrotask yield: bun resumes a test
  awaiting an already-rejected promise before the rollback's microtask, so a
  "nothing ran yet" assertion without the yield proves nothing.
- **Success path:** ownership after the service disposer, retirement after a
  projection fails, close ordering against projections, the fulfil shape, a stack
  alone making an attempt owned, and late acceptance during close.
- **Lifetimes:** transient, root through a child, a fork, a binding shared to the
  parent, and cross-attempt order.
- **Reasons:** one test per reason, the recommended check releasing a
  service-owned resource exactly once, and a projection owner neither standing in
  for nor discrediting the returned value's disposer.
- **Startup, observers, close progress:** startup rollback of a succeeded
  service's stack, `cleanupFailures`, one and two cleanup pairs, and an in-flight
  rollback reported as pending.

Type fixtures in `tests/types/startup.ts` and `tests/types/negative/startup.ts`
pin the signatures; their diagnostic markers were checked against tsc6 and
native tsc.

## Changelog entry for the next release chore

`tests/release-artifacts.test.ts` pins `CHANGELOG.md` to the published
`package.json` version and rejects an `## Unreleased` heading, so paste this
under the next version heading when the release chore bumps it.

```md
### Added

- `factoryCtx.pushDisposer(disposer)` on the acquisition context makes the bag own
  a resource a factory acquired before it could return
  ([#27](https://github.com/dany-fedorov/di-bag/issues/27),
  [#32](https://github.com/dany-fedorov/di-bag/issues/32)). Pushed disposers run
  exactly once, last pushed first: at once when the factory throws, rejects, or is
  cancelled, otherwise at `close()` — or at retirement after a later projection
  fails — after every disposer of the service. Each receives a `DisposerContext`
  whose `reason` is `'factory-failed'`, `'no-service-disposer'`,
  `'service-disposed'`, or `'service-disposal-failed'`, describing the
  `withDisposal` on the returned value, so a disposer for a resource the returned
  value also releases can act only when that disposer did not. Failures are reported like `close()` disposer failures. New
  codes `DI_BAG_INVALID_CLEANUP` and `DI_BAG_CLEANUP_AFTER_FACTORY`; new exported
  type `DisposerContext`.

### Changed

- Each acquisition now receives its own frozen `AcquisitionContext` rather than
  one shared per scope. The `signal` is unchanged — still the owning bag's, shared
  by every acquisition it owns — so code comparing context objects by identity
  should compare `context.signal` instead.
- A `close({ timeoutMs, signal })` that stops waiting while a failed factory's
  pushed disposers are still running lists that acquisition under
  `details.pending`.

### Fixed

- A `signal` kept after its bag closed no longer keeps the closed bag in memory.
  A `close()` without a cause now aborts with one shared `AbortError`, created at
  load, whose message names `DI_BAG_CLOSING`; before, each close created an
  `AbortError` whose stack retained the bag's scope and graph.
```

## Decisions taken during implementation

**Opt-in.** `pushDisposer` requires `{ context: 'acquisition' }`, so adding it to
a plain factory is a signature change. That is the intended cost: a universal
context would allocate one per acquisition whether or not a factory uses it, and
the flag already tells a reader that a factory participates in cancellation.

**The context object is per-acquisition (behaviour change).** `getContext()`
used to memoise one frozen context per scope, and two tests pinned that
identity. A per-attempt stack cannot live on a shared object, so those tests now
compare `signal`. The contract that matters — which owner's cancellation an
acquisition observes — is unchanged.

**A retained context must pin nothing.** Two rounds of review found retention
bugs of the same shape: a reference the context reached indirectly. First,
building the context inline in `resolveBinding` put the `ProviderExecution` into
the scope record shared with the dependency proxy's handlers. Then the closure on
the context captured the execution directly, so a factory that kept its context
kept the execution, its frames, and through `execution.events` the attempt and
the scope; `compact()` also never cleared the frames it copied. The fix is
structural: the context closes over the `DisposerStack` alone, reads the signal
eagerly, and `compact()` clears the frames it hands over.

**Naming.** `defer` was replaced before release because every language that uses
it — Go, Swift, TC39 `DisposableStack` — means "always runs", which is right for
a stack but was wrong for the rollback-only design. `pushDisposer` says stack and
multiplicity; "disposer" is the library's word. The factory's context type stays
`AcquisitionContext` because it is published and matches the opt-in flag. The
error codes name the category the failures are reported under, cleanup, not the
method.

**The reason ignores projection owners.** The first version of the stack
computed `reason` over every accepted stage. A consumer that wrapped the service
in an owned `transformService` then decided it: a wrapper disposer that
succeeded read as `'service-disposed'` and the socket was never closed; one that
threw read as `'service-disposal-failed'` and the socket was closed twice. A
module author cannot see that consumer, so each accepted stage now records
whether it owns the returned value, and only those decide the reason.

**One pattern for a returned resource.** A socket that is acquired before the
factory can fail and then returned could be owned by a single push alone. The
recipe uses `withDisposal` plus a push with a reason check instead, so that
every codebase owns returned values the same way.

**`hasRollback` is gone.** It guarded `retire()` and `compact()` against dropping
a list nothing owned yet. With source-anchored rollback, an in-flight rollback is
pending work and an accepted stack is ownership; nothing else remains to guard.
