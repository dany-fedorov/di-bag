# Lifecycle design refinement

Date: 2026-09-06. Status: design refinement under the approved enterprise
program; not an implementation or a completed acceptance claim.

Binding parent spec: `2026-09-06-enterprise-di-design.md`. This document narrows
the L1/L2/A1 behavior before its executable implementation plan. It preserves
ordinary factory return values and explicit acquisition ownership.

## Identity, caching, and ownership

Use acquisition records, not one finalizer per service name:

```ts
type AcquisitionState =
  | 'creating' | 'pending' | 'ready' | 'failed' | 'disposing' | 'disposed';

interface AcquisitionRecord {
  readonly id: symbol;
  readonly bindingId: symbol;
  readonly ownerScopeId: symbol;
  readonly dependencies: Set<symbol>;
  state: AcquisitionState;
  rawValue: unknown;
  exposedValue: unknown;
}
```

These records are internal mutable state; public inspection returns separate
immutable views. Each successfully transferred owned acquisition receives its
own finalizer. Repeated transient acquisitions therefore cannot overwrite one
another's finalizers, even if they return the same object identity. An alias
refers to the same acquisition and does not introduce another owner.

`DiBag.withLifetime(registration, lifetime, options?)` declares one of:

- `scoped` (default): cache once per requesting scope.
- `root`: cache once in the root of a child-scope tree, using root bindings for
  construction even when a child requests it first.
- `transient`: no binding cache; create an acquisition for each resolution.

Ownership is independent. Ordinary registrations remain borrowed, including
objects exposing methods named `close` or `dispose`. `DiBag.withDisposal`
explicitly transfers ownership of each fulfilled acquisition. A transient's
owner is the requesting acquisition's owner scope, or the resolving scope for
a top-level call. Transient means no cache, not an automatically shorter lexical
resource scope: a root provider may intentionally own a private transient.

`fork()` remains a fresh independent root. It shares no acquisitions, cleanup
state, or implicit child relationship with its source bag. A separate `scope()`
operation creates a tracked child: root providers are shared; scoped providers
are fresh. Closing a parent initiates closing its children before parent-owned
acquisitions. A child closes only its owned acquisitions, never borrowed root
acquisitions.

Root construction never resolves through child overrides. An override visible
to a child's own consumers does not retarget dependencies already bound to a
shared root instance. This differs intentionally from an independent fork,
whose new instances all resolve against its new public slot table.

## Captive dependencies and explicit sharing

Default lifetime validation rejects a root provider capturing a scoped provider,
including a scoped dependency reached through a transient intermediary. The
type checker rejects statically provable declared edges, and runtime acquisition
tracking checks observed edges, including property reads after `await`.

For the deliberate root-context case, `withLifetime` accepts
`{ captureScoped: true }` on a root registration. This explicitly allows scoped
dependencies acquired in the root context and retained until root shutdown;
it never permits redirecting a root provider to a child-owned resource. The
option is invalid for non-root registrations. Prefer assigning genuine root
dependencies their own root lifetime; capture is a narrowly explicit policy.

For user-selected sharing of ordinary scoped instances, a child scope may carry
an exact finite tuple of `share` keys. Sharing uses the parent's acquisition
and retains the parent's dependency bindings. It is a borrow, not a new owned
acquisition or an automatic disposal declaration. Conflicting selection of the
same key for sharing and overriding rejects before side effects. The executable
plan must reuse the selected-key type checks; structurally hidden keys must not
alter the selected runtime set.

Private module bindings retain installation-local identity. Sharing a public
module export shares its actual acquisition, including its private dependencies;
it does not recreate a separate wrapper bag or copy finalizers into the child.

## Acquisition and shutdown

Keep the original ordinary factory value or native Promise as the exposed value.
Observe native Promise state separately for pending bookkeeping and fulfilled-
value ownership, bypassing overridden then methods and preserving original
setup errors. Structural thenables remain supported through explicit standard
conversion inside the factory, not a guessed fallback after native observation
fails. Use an independent native pending barrier rather than assimilating an
arbitrary derived species result. A cached rejection removes the failed cache
entry and abandons unsuccessful incoming consumer edges; subsequent resolution
can retry. The retired attempt retains its outgoing dependencies, pending work
and accepted ownership until cleanup can safely finish, then releases them.

Detect cycles before recursive construction, including repeated transient
bindings along an active resolution path. Acquisition IDs alone cannot detect
an infinite transient recursion because each invocation would have a new ID.
Retain dependency-aware paths for cycles discovered after `await` as well.

`close()` is idempotent and returns the same closing promise. New top-level
resolution is prohibited as soon as closing starts. Already in-flight factories
can complete their acquisition graph, including necessary dependency reads.
Signal cancellation is cooperative; ordinary factories may ignore it and still
finish normally. Drain pending work to a fixed point, then dispose dependents
before dependencies. Include unowned intermediates in dependency ordering.

Attempt every applicable finalizer. `DiBagCleanupError` extends `AggregateError`
and contains structured failures with acquisition/provider identity and the
original error value. Errors such as thrown `undefined` remain failures. Do not
silently discard failures or replace their causes with formatted strings.
Release runtime maps once shutdown finishes, whether cleanup succeeded or not.

An adapter may expose a projection of an acquisition. The original owned value
and disposer remain paired. Projection failure after ownership transfer must
release the acquisition, and shutdown must account for pending projected work.
An adapter that explicitly awaits may change its own exposed return type; no
ordinary dependency is implicitly awaited.

## Cooperative acquisition context

An explicit `DiBag.withContext` adapter supplies an acquisition context to a
factory without reserving magic service names:

```ts
type AcquisitionContext = {
  readonly signal: AbortSignal;
};
// Author-facing callback:
// (deps: DeclaredDependencies, context: AcquisitionContext) => Service
```

The dependency parameter remains the single named requirement declaration.
Ordinary one-parameter factories do not need the adapter. The runtime owns the
signal controller; observers and consumers cannot abort unrelated scopes by
mutating a context object. Child cancellation does not abort its parent.

## Startup, cancellation, and deadlines

Use `builder.start(keys, options?)` as the eager alternative to `.end()`. It
requires the same graph closure, creates a fresh bag, acquires the selected
public services, and returns `Promise<Bag<...>>` only after those acquisitions
fulfill. Other registrations remain lazy. A previously running bag is not
silently repurposed as a startup transaction.

Options accept an external `AbortSignal` and a finite positive `timeoutMs`.
Reject invalid options before acquisition. A signal already aborted starts no
factories. `concurrency` accepts `parallel` (default) or `sequential`. Parallel
starts the selected acquisitions together and shares cached in-flight work;
sequential follows the explicit key tuple and stops starting later selections
after failure. Remove timers and listeners when startup settles. Neither mode
claims to execute synchronous JavaScript simultaneously on multiple threads.

Normal acquisition failure initiates bag shutdown and waits for cleanup before
rejecting with `DiBagStartupError`. Retain the original acquisition failure and
all cleanup failures separately as `cause` and readonly `cleanupFailures`.
Factories remain responsible for cleaning
partial work before they return ownership; a bag cannot dispose a resource it
never received.

Cancellation and timeout have a different completion boundary: initiate
cooperative abort and bag shutdown, then reject promptly with
`DiBagStartupCancelledError`, carrying `reason: 'aborted' | 'timeout'`, the
original abort/timeout cause, and `cleanup: Promise<void>`. That promise observes
eventual shutdown, including late acquisitions and cleanup failures. Internally
observe it to prevent an unhandled-rejection warning, without changing what an
explicit consumer await receives. The application can await it when complete
resource release is required.

This choice is necessary because waiting for arbitrary uncooperative JavaScript
would make a startup timeout unbounded. Never claim that timeout forcibly stops
the factory or that rejection proves all resources have already been freed.
A factory that never settles can also prevent eventual cleanup from settling;
isolating or terminating such work in another worker/process is outside scope.

## Acceptance scenarios for the executable plan

- Root identity survives child scopes and is constructed using root bindings
  even on a child's first request; independent forks do not share that identity.
- Scoped instances differ across children; each transient resolution is distinct
  and each transferred acquisition is cleaned once.
- Shared scoped instances retain parent dependencies and ownership, despite
  child overrides; parent closure initiates children first.
- Root-to-scoped capture rejects by default, including an intermediary, and
  explicit root-context capture never reaches child-owned resources.
- Cached pending work is deduplicated, failure retries without stale edges, and
  synchronous and post-await cycles produce deterministic useful paths.
- A provider may catch a dependency's acquisition failure and still return a
  usable service. Retrying that dependency must use a new acquisition identity:
  if it now consumes the cached parent, the old failed edge must not create a
  false cycle. The completed acquisition/provider foundations cover this case;
  lifetime work must preserve it when introducing transient attempts and
  cross-scope ownership. See the provider-transformations evidence report.
- Shutdown covers owned and unowned intermediates, async completion order,
  transient multiplicity, reentrant close, and multiple failures.
- Successful eager startup leaves unrelated providers lazy; normal failure
  cleans the new bag, preserving both acquisition and cleanup causes.
- Abort/timeout rejects before a deliberately deferred non-cooperative factory
  finishes; releasing that factory later transfers and disposes ownership once.
  Awaiting the error's cleanup promise observes success or its actual failures.
- Already-aborted signals and invalid timeouts start no factories. Completion
  races release timer/listener state without changing original Promise identity.
- Projection failure after raw acquisition does not leak; pending projection
  and cancellation races preserve the original disposer argument.

## Trade-offs selected

Per-acquisition bookkeeping costs more memory than a finalizer map keyed only
by service name, but makes transients and adapters correct. Child scopes are
distinct from forks so sharing does not silently change existing semantics.
Default captive-dependency checks favor early feedback; explicit root-context
capture supports deliberate exceptions without child lifetime leaks. Timeout
rejection and eventual cleanup are separate promises because arbitrary
JavaScript cannot be forcibly interrupted inside the same execution context.
