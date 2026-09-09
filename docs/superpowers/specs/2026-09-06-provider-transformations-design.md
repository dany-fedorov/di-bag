# Provider transformations and box integration

Date: 2026-09-06. Status: design refinement under the approved enterprise
program; not implemented or an acceptance-completion claim.

Binding parent: `2026-09-06-enterprise-di-design.md`. This refinement covers
immutable provider transformations, typed metadata, and real optional box
adapters. Typed tokens remain a separate composition increment. Per-acquisition
state is a prerequisite for transformations with ownership; child scopes and
new lifetime policies do not need to arrive in the same task.

## Preserve the ordinary path

A function is still a valid registration. Dependencies are still ordinary
values with their exact declared Promise types. There is no required wrapper,
decorator, runtime parameter parsing, or dependency on either box package.

Automatic asynchronous bookkeeping follows the enterprise native-Promise
boundary. Structural thenables need explicit native conversion inside the
source factory. Explicit asynchronous mapping/unboxing may perform standard
awaiting as its named contract; it must not use an observation-error heuristic
to guess whether a raw input was native. Synchronous mappings preserve their
exact input/output and do not silently convert a structural thenable.

Retain `DiBag.withDisposal(factory, dispose)` and its existing inferred
`DisposableFactory<F>` contract, including the readonly original `create`
callback. Additional provider helpers produce nominal, immutable handles whose
full type contract cannot be forged by spreading a description. Public
description views are informational, not unchecked registration constructors.
Both disposal overloads require a receiver-free disposer (`this: void`), matching
their actual bare-callback invocation. A disposer with an explicit required
receiver is rejected; use an arrow or an explicitly bound callback instead.
The original factory's inferred type and readonly create callback remain intact.

Internally, normalize plain factories and handles into immutable provider
operations. Keep the source operation and its own ownership policy available
when a later operation changes the consumer-visible result. Do not replace an
owned factory with a callback that forgets its original disposer argument.

Useful public type utilities are `ProviderOutput<R>`, `ProviderNeeds<R>`,
`ProviderMetadata<R>` (static metadata), and `ProviderAcquisitionMetadata<R>`.
They expose exact readonly contract views, not mutable
runtime registries. Explicit annotations must not erase retained requirements
or ownership semantics before a subsequent helper/registration operation.
Use declaration-preserved invariant witnesses where those contracts require
invariance; TypeScript strips ordinary private field types from emitted class
declarations. Keep nominal provenance separate so a spread copy cannot acquire
registration authority merely by retaining a public symbol-keyed type witness.

## Two explicit mapping operations

Use separate APIs because mapping a returned Promise object and mapping its
eventual fulfillment are different operations:

```ts
DiBag.mapSync(registration, project);
DiBag.mapAsync(registration, project);
```

`mapSync` calls `project` with the exact value returned by its source. It never
awaits or unwraps that input. Its result type is exactly the projector's return
type, including a returned Promise's identity. A source returning a Promise
therefore supplies that Promise to the projector, just as an ordinary factory
dependency would. The projector must be receiver-free; requirements remain the
source provider's requirements.

`mapAsync` explicitly awaits its source and passes the fulfilled value to its
projector. It always exposes `Promise<Awaited<Projected>>`. Source throws and
projector throws become rejections. This is an opt-in asynchronous adapter, not
a change to ordinary dependency injection.

Do not infer whether a mapping helper itself returns a Promise by inspecting an
erased object type at runtime. A structurally broad object type does not prove
that its runtime value lacks a `then` method. The two explicit APIs avoid
promising a synchronous mapping result while silently returning a Promise.

For `mapSync`, the source's returned Promise may fail while a successfully
created projection remains usable—for example, a status object that intentionally
holds that Promise and handles its rejection. The projection is not implicitly
invalidated by an input Promise it deliberately did not await. Its own exposed
result determines its cache-success/retry boundary. Source pending work and
already-declared ownership still participate in shutdown.

## Ownership belongs to each accepted stage

Extend `withDisposal` to accept a typed provider as well as a plain factory.
Adding it to a derived provider declares cleanup for that stage's fulfilled
output. It does not replace or erase earlier ownership declarations. Two
explicit declarations register two finalizers, even if both receive the same
object; they may represent distinct cleanup responsibilities. They are not
automatically deduplicated by object identity.

```ts
const connection = DiBag.withDisposal(openConnection, closeConnection);
const client = DiBag.mapSync(connection, raw => new Client(raw));
const ownedClient = DiBag.withDisposal(client, value => value.close());
```

The client is the consumer-visible service. `closeConnection` still receives
the original connection. If both stages are owned, client cleanup precedes
connection cleanup. Merely mapping/unboxing a value never gives the projection
an implicit finalizer.

Use one acquisition attempt identity with separately recorded stage outcomes
and finalizers. Each accepted stage records its original fulfilled value and
disposer. Cleanup order follows reverse stage nesting, not callback completion
order; a synchronous outer projection may finish before its source Promise.
Dependency ordering across provider acquisitions still takes precedence over
cleanup of their individual stages.

If a projector fails after source ownership transferred, release that failed
attempt's accepted stages. Do not dispose other cached dependency acquisitions
that remain owned by the bag. If source fulfillment arrives after a synchronous
projection failed, accept and release its declared ownership exactly once;
the failed attempt must remain tracked until that work finishes.

Preserve the original projection/acquisition error at the resolution boundary.
Synchronous failure remains synchronous even if cleanup is asynchronous. Keep
cleanup failures associated with the retired attempt and report them through
the bag's structured shutdown error. `close()` is the barrier for complete
release and all recorded cleanup failures; a failed `resolve` alone is not a
claim that arbitrary asynchronous finalizers already finished.

Retired-attempt cleanup waits for that attempt's pending source and projection
work before invoking its accepted finalizers, then follows reverse stage order.
A still-running projector can use an already accepted resource even after a
later synchronous projection fails; releasing it first would risk use after
cleanup. This wait is attempt-local, not a wait for unrelated retries. Pending
work that never settles can therefore retain accepted resources and keep the
eventual close barrier pending; failure is not forced interruption of JavaScript.

Retaining failed attempts for cleanup must not retain them as successful
dependencies of callers that caught their exposed failure. Abandon those
incoming failure edges when the exposed attempt fails, while retaining its
pending source, original identity, actual outgoing dependencies and finalizers.
Otherwise a late source reading its now-completed caller is falsely diagnosed
as a cycle. Genuine live acquisition cycles remain errors.

Automatic ownership retains the existing fulfilled-value boundary. Failed
then inspection/setup rolls back without passing an unfulfilled raw object to
an `Awaited` disposer. A universal opaque/raw acquisition mode is not introduced
by these mapping APIs; it would need its own explicit ownership contract.

## Static and acquisition metadata

`DiBag.withMetadata(registration, metadata)` adds static metadata without
changing service output, requirements, acquisition behavior, or ownership.
Metadata is an immutable own-key snapshot. Freeze the record, not application
payloads. Support namespaced strings and unique symbols as metadata keys;
metadata keys are not automatically DI service tokens.

Repeated metadata additions introduce new keys. Reject collisions visibly in
types and atomically at runtime, checking every own key before evaluating
values. This avoids a structurally hidden metadata key silently replacing a
previously promised metadata value. Do not add a general replacement API merely
to support the initial adapters.

Inspection separates static provider metadata from acquisition metadata.
Static metadata is available before resolution. Acquisition metadata describes
one actual attempt and may be produced by unboxing a runtime result. Namespace
adapter-owned fields so they do not overwrite application metadata. Inspection
views are frozen snapshots; they do not expose state maps or grant mutation
authority over providers.

An adapter's acquisition-metadata contract remains in its provider type, so a
checked inspection of that service can expose the actual metadata channel types
without a caller-supplied generic assertion. Mapping preserves retained source
metadata contracts; adapters add their own namespaced channels. Failed attempts
may publish failure/metadata events, but inspection is not an unbounded archive
of every retired attempt.

Aliases from val-box are diagnostic labels only. They do not automatically
rename public slots, change token identity, or transfer ownership.

### Inspection and composition refinements

Use `bag.inspect(key)` for a checked, non-resolving snapshot. It contains the
binding identity and label, static `metadata`, and an `acquisitions` array of
currently retained attempt snapshots. Each attempt contains its identity,
state, and acquisition metadata; it does not expose the acquired service or
live dependency sets. Before resolution and after completed closure, that
array is empty. This representation also accommodates multiple retained
transients without inventing an unbounded historical archive.

Acquisition metadata uses an ordered tuple of stage-owned frames, not one
flattened namespace map. Each adapter appends its own typed frame contract;
mapping and ownership wrappers preserve existing frames. Each inspection frame
is a `Presence<Frame>` snapshot because an inner asynchronous stage may not
have produced metadata when an outer synchronous projection is already usable.
Repeated val-box adapters therefore retain separate frames instead of silently
overwriting metadata or intersecting incompatible payload types. A val-box frame
has `kind: 'val-box'`, its copied `metadata: Presence<M>`, and `alias: string | null`.
Presence records and frame arrays are frozen; application payloads are not.

Named-module export types must retain static and acquisition metadata contracts
through installation and rename, alongside the existing service/requirement
contracts. Keep `ModuleProvides` and `ModuleRequires` as their existing value
views. An additional declaration-preserved module contract carrier is preferable
to discarding metadata during the synthetic public-registration conversion.
Existing plain-module annotations stay usable when their complete contracts
match; annotations cannot erase nonempty retained metadata contracts.

The default val-box required-value mode uses the no-options overload. Whenever
an options object is supplied, require an explicit `value: 'required' | 'presence'`
discriminator, and preserve the corresponding union output for a union-valued
mode. An optional discriminator would allow a structurally narrowed `{}` to
hide a runtime presence-mode selection while promising a required service value.

## sas-box adapter subpath

Export `fromSasBox` from `di-bag/sas-box`. It consumes a registration producing
the structural capabilities exercised by the real packed sas-box library.
Select its acquisition route explicitly:

```ts
fromSasBox(registration, { mode: 'sync' });
fromSasBox(registration, { mode: 'async' });
fromSasBox(registration, { mode: 'sync-first' });
```

- `sync` requires a source whose exact output exposes a callable `sync` method.
  It invokes that method without awaiting the box or its return value, and
  preserves the method's exact result type. An async-only or Promise-valued box
  source is rejected statically; unchecked unsupported capabilities throw at
  runtime before invocation. This is a synchronous entry point, not a promise
  that the callback itself cannot return a Promise.
- `async` explicitly awaits the box source and calls its `async` method,
  returning a native Promise of the awaited service value.
- `sync-first` explicitly awaits the box source and then uses its callable
  `sync` capability when present, otherwise `async`. Like sas-box's existing
  sync-first operation, the adapter always returns a Promise of the awaited
  service value. Its type does not vary with a runtime capability check.

The `sync-first` source contract must expose a required `sync` field: either
a callable, or callable/undefined with a callable `async` fallback whenever
undefined is possible. A merely async-only view with a missing or optional
`sync` property cannot prove that it has not hidden an incompatible sync method.
Such a view uses explicit `async` mode or supplies an explicit `sync: undefined`
capability record. Actual SasBox Sync/Async/Unknown classes already expose the
required field. For a possibly absent sync capability, the output includes both
possible awaited callback result types; an always-callable sync capability uses
only its result. A union-valued mode must satisfy every possible route, not
collapse validation to whichever one happens to accept the source.

Calls preserve the box receiver. The box's methods still run per provider
acquisition; memoization belongs to the bag, not a global adapter cache. A
source disposer receives the original acquired box, never its unboxed value.
An explicit outer `withDisposal` can separately own the resulting service.

## val-box adapter subpath

Export `fromValBox` and `fromValBoxAsync` from `di-bag/val-box`. Both use the
structural `snapshot()` protocol implemented by the real packed val-box:

```ts
fromValBox(registration); // source returns a snapshot-capable object
fromValBox(registration, { value: 'presence' });
fromValBoxAsync(registration); // explicitly await a box source
fromValBoxAsync(registration, { value: 'presence' });
```

The synchronous adapter calls `snapshot()` once and does not await the source.
The async adapter awaits the source and always returns a Promise. Default
required-value mode rejects an absent value; presence mode returns the immutable
`Presence<V>` channel so absent and present-undefined stay distinguishable.
Do not use truthiness or `value !== undefined` as the presence check.

Record a copied immutable snapshot's metadata channel and intentional alias in
that acquisition's adapter metadata. Do not store a mutable box in every service
or let later box mutation change the captured view. Preserve payload identity;
the adapter does not deep-freeze the application value or metadata payload.
Validate the structural snapshot shape at the adapter boundary for unchecked
JavaScript, without claiming that shape validation proves its generic payload
types.

A raw-source disposer retains the raw box argument. Missing required values,
throwing snapshot getters, and projector failures enter the same retired-attempt
cleanup path as ordinary mappings. No special box-only ownership mechanism is
introduced.

## Packaging and verification obligations

Core imports must work with neither box package installed. Use structural
adapter protocols and type-only imports or no peer imports; optional peers may
describe compatibility but cannot make unpublished versions mandatory for core.
The adapters share the core's descriptor registry across CJS and ESM consumers.

Test against the verified local tarballs, not copied source or reimplemented
lookalikes. Install them in temporary package consumers without publication.
Retain those exact archives as versioned test-only fixtures, with original
checkout revisions and SHA-512 checksums documented beside them. This makes
fresh-checkout integration tests independent of temporary paths and unpublished
registry versions. They are not runtime dependencies or vendored source; verify
the di-bag package excludes the fixture archives and their extracted contents.
Cover source/declaration inference, required receivers, invalid capabilities,
all presence states including present-undefined, mutation isolation, original
raw disposer arguments, nested ownership, projection failures, pending/late
fulfillment, and all cleanup failures. Keep plain core consumers in the matrix.

The executable plan must implement per-acquisition identities and robust
retired-attempt cleanup before enabling owned transformations. This is a
prerequisite ordering refinement within the approved program, not a reason to
drop later root/scoped/transient policies, startup, or cancellation.
