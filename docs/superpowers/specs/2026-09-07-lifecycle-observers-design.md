# Lifecycle observers

This E2 increment follows typed contribution collections. It adds typed lifecycle
observations to the existing immutable facade and canonical acquisition machinery.
Provider transformations remain the API for changing values or ownership.

## Public observation boundary

`DiBag.observe({ onEvent, onError })` returns a new immutable facade with one
additional observer. Existing facades, builders and bags retain their configured
observers. Repeated calls append observers in order; they do not deduplicate
callbacks. `configure({ isNativePromise })` on an observed facade preserves its
observers while changing the classification capability. `di-bag/node` retains its
host classifier when observation is added. Portable core observation does not
supply automatic classification: explicit modes remain sufficient without a host
predicate.

Both callbacks are required and validated before a facade is returned. Their
references are copied from the caller's object; later mutation does not change
existing configurations. Callbacks receive no receiver. Public callback return
values are ignored by the DI graph. Synchronous callbacks and Promise-returning
callbacks are supported; callback completion never gates acquisition, startup or
shutdown. No mutable runtime/controller/resolver or service value is exposed in
an event.

`onEvent` receives a typed, frozen `LifecycleEvent` discriminated by `kind`.
`onError` receives a frozen `ObserverFailure` containing the original callback
error and the event whose delivery failed. The event and failure records are
snapshots; application-owned metadata/error payloads retain their identity and
are not deep-frozen.

## Events and identity

Scope events identify the scope's acquisition owner with a stable symbol
`scopeId`. Tracked children also carry `parentScopeId`; independent roots/forks do
not. Acquisition and cleanup events carry the same `bindingId`, `acquisitionId`
and `label` available through inspection, plus the owning scope ID. Canonical
routing occurs before event creation: shared/root acquisitions are attributed to
their actual owner, aliases add no synthetic attempt, and each contribution or
transient attempt keeps its own identity.

Scope variants have `scopeId` and an optional `parentScopeId`, omitted for roots.
Acquisition/cleanup variants have `scopeId`, `bindingId`, `acquisitionId`, `label`,
`lifetime`, copied static `metadata` and a copied frame-presence array named
`frames`. Failure variants carry `error`. `cleanup-failed` also has the nonnegative
`disposalIndex` from the existing disposer invocation ordering;
`cleanup-completed.outcome` is exactly `'success' | 'failure'`.

The event union includes:

- `scope-opened` after construction and graph preflight succeed.
- `scope-closing` when the public admission gate closes, once per scope.
- `scope-closed` after tree/local shutdown succeeds, or `scope-close-failed` with
  the original close rejection after all accepted cleanup has been attempted.
- `acquisition-started` after the attempt is registered and before provider
  execution. It includes copied static metadata and a conservative frame snapshot.
- `acquisition-ready` exactly once when the exposed final stage is ready, with a
  copied final frame snapshot. Raw Promise values are ready as raw values; native
  mode uses final-stage native readiness. Intermediate source/projection settlement
  must not announce readiness of a still-pending final stage.
- `acquisition-failed` exactly once for exposed final-stage acquisition failure,
  retaining the original error. Failures intentionally bypassed by an explicit
  later projection do not turn a successful final value into a failed acquisition.
- `cleanup-started` and `cleanup-completed` around each attempt's accepted ownership
  cleanup. The latter has a typed success/failure outcome; per-disposer
  `cleanup-failed` events retain the original error and disposal invocation index.
  Rollback/retired ownership uses the same events and once-only rules. Attempts
  with no accepted ownership do not invent a cleanup event pair.

Event IDs are observations, never lookup/admission capabilities.
No events are emitted for failed registration/configuration/preflight operations
that never construct a scope or attempt.

## Delivery and failures

Events are captured when the state transition occurs and delivered through a
microtask queue after runtime state has been published. This keeps observer
callbacks outside the synchronous factory ancestry stack. Delivery follows
emission order across observed facade configurations, and each event visits its
captured configured observers in registration order. Interleaving operations on
an original facade and an appended facade must not reorder events received by a
callback present in both configurations.
A callback may use an application-held bag reference; any resulting resolution or
close uses the ordinary admission, dependency and ownership rules.

Synchronous exceptions and rejected callback results are delivered to that
observer's `onError`. Error-handler exceptions/rejections are consumed without
recursive reporting. They cannot alter a promised service, change the original
factory/cleanup error, bypass accepted cleanup or become an unhandled rejection
from the library's callback monitoring. Structural assimilation is limited to
observer callback results and is independent of service acquisition modes.

The queue invokes callbacks without awaiting their returned work. `close()` does
not wait for arbitrary asynchronous observer work. A callback that never settles
cannot stall the scope; applications own completion of their external logging or
telemetry work. Observation creates no acquired resource or disposer. With no
observers configured, lifecycle paths avoid event/snapshot/monitor allocations.

## Types and compatibility

Export the event union, event callback/configuration and failure types from the
package root. Narrowing by `kind` exposes only that variant's fields. Global
metadata/frame types remain conservative; they cannot claim one provider's shape
for every event. Keep every existing provider/builder/bag/module generic contract,
exact service/Promise identity, reflected facade declarations, native diagnostic
allowances and compiler-work ceiling intact.

Test raw/native/synchronous/failed acquisition, final-stage readiness, alias and
contribution identities, module-private providers, selected sharing/root ownership,
independent forks, partial startup rollback/cancellation, reentrant delivery and
cleanup failures. Check throws, rejected/throwing-then callback results, failures
inside onError, nonsettling callbacks and immutable configuration/snapshots.
Actual classic/native archives must run the observer assertions on Node/Bun
CommonJS/ESM, and inferred declarations must survive source deletion and both
compilers. Dynamic plugin validation, compiler hardening and release confidence
remain separate required increments.
