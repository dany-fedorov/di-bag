# Reliable acquisition classification

Date: 2026-09-07. Binding final-review correction I1, controller Ruling9.
This refines the enterprise acquisition contract under the user's continuous
implementation and justified-public-API-change authorization. It is not a
claim that the correction is already implemented or verified.

## Problem and decision

A genuine pending Promise can have an own `then: undefined`. The current
callable-then heuristic treats that Promise as a ready resource and closes its
owner before fulfillment. A plain `{then: undefined}` must still be an ordinary
value. Catching intrinsic observation errors cannot distinguish a non-Promise
receiver from a native Promise whose constructor/species setup throws.

Select immutable, application-local automatic classification plus explicit
per-stage acquisition modes. Provide a `di-bag/node` configured facade using
`node:util/types.isPromise`; keep the root entry point host-independent. Plain
factories retain automatic semantics on a configured facade. Portable core
users either supply a trustworthy host predicate or explicitly describe every
unknown-output stage. There is no heuristic fallback and no mutable global
configuration. Missing automatic-classification capability fails at bag
finalization, before any factory effects, including private module factories.

Alternatives: explicit modes everywhere impose migration on every provider;
conditional root exports reduce Node import changes but add resolver-dependent
behavior and risk separate registries. Neither is needed for this correction.
Reject instance/tag/error-message guesses, Promise.resolve probing, object
mutation and assumed availability of a future standard predicate.

## Public boundary

```ts
type AcquisitionMode = 'auto' | 'raw' | 'native';
interface RuntimeOptions {
  readonly isNativePromise: (this: void, value: unknown) => boolean;
}

// Root: no host capability inferred or imported.
const appDi = DiBag.configure({ isNativePromise: trustedHostPredicate });
const raw = DiBag.factory(() => value, { acquisition: 'raw' });
const native = DiBag.factory(() => pending, { acquisition: 'native' });
const mapped = DiBag.mapSync(raw, project, { acquisition: 'raw' });
```

`configure` returns a new facade of the same structural public API. Its immutable
context follows every builder, finalized bag and fork created through it.
Configuration does not mutate the root facade, another configured facade, or
providers/modules. Copy and validate the predicate reference once; callback
throws remain original errors, and a non-boolean runtime result fails clearly.
It is trusted runtime input, not a type-level proof or a portable polyfill.

`di-bag/node` re-exports root public types and values, replacing only `DiBag`
with the configured facade. It uses the same core modules, token identities and
provider registry. No separate bundle, conditional root export, runtime npm
dependency, Node import in core, or Node type in core declarations is introduced.

`factory(create, {acquisition})` creates a provider, not ownership. Plain
factories and existing `withDisposal(factory, disposer)` remain automatic.
Source mode is selected at creation, never retroactively on an owned provider.
`fromTokens(tokens, create, {acquisition})` gets the same optional source choice;
omission remains automatic. `mapSync(registration, project, {acquisition})`
selects only that new output stage; omission is automatic. `mapAsync` creates a
known native acquisition and needs no classifier for its own output stage.

Synchronous box adapters take an optional `acquisition` option for the new
output stage, distinct from sas-box's existing capability `mode` and val-box's
existing `value` selection. Preserve existing call forms. Async adapter output
is known native. A val-box presence projection always creates an ordinary
presence object, so defaults to raw; required-value projection defaults to auto.
Explicit native presence mode is invalid. Source stages remain independent.

## Exposed versus acquired values

| Stage mode | Exposed service | Acquired value used by its disposer |
| --- | --- | --- |
| auto | Exact callback result | Native fulfillment if the trusted predicate matches; otherwise the ordinary result |
| raw | Exact callback result | The exact result, even a Promise or structural thenable |
| native | Exact callback result | Native fulfillment; non-native observation fails |

Raw mode deliberately performs no then lookup or assimilation and does not wait
for a raw Promise to settle. It is the explicit way to own the Promise object
itself. Native mode statically requires a Promise-valued output; TypeScript's
structural Promise shape cannot prove native branding at runtime. A mixed
`T | Promise<T>` result can use configured auto, deliberate raw ownership of the
union, or explicit producer normalization to a native Promise.

Add a retained acquired-value contract to Provider, defaulting compatibly to
`Awaited<ReturnType<F>>` for existing four-generic uses. Export
`ProviderAcquired<R>` alongside `ProviderOutput<R>`. Raw mode records the exact
output type; auto/native record its awaited type. `withDisposal` on a provider
uses that acquired type without letting the disposer infer or widen it.
Metadata, ownership, token binding and public module projections preserve it.
Value transformations select a new acquired type without retargeting any
previous disposer. Preserve exact factory dependencies, graph contracts,
acquisition frame tuples, invariant witnesses, union behavior and erased-view
unknown boundaries. No `any`-based public escape or replacement overload change.

## Execution and failure behavior

Store mode on each source and value-producing operation. Finalization preflights
all normalized registrations in the immutable graph: an automatic stage without
a configured predicate fails with an actionable error naming classification and
the configure/node/explicit-mode choices. No factory, dependency or projection
may run before that error. Internal known-native and known-raw operations do not
need automatic capability. Validate options before retaining descriptions.

For auto, classify with the supplied predicate independently of `.then`
callability. Native observation keeps intrinsic Promise.then, original exposed
identity, original setup errors, and an independent native pending barrier.
Preserve the existing throwing-then-getter error contract by reading that
property once when applicable before native observation; do not call overrides.
Ignore arbitrary species results entirely. Auto non-native callable thenables
reject without calling their then; ordinary non-callable-then values remain
synchronous. Explicit raw values bypass all such checks by definition.

Source, mapSync and synchronous frame output receive identical classification
handling. Pending source access permission, failed-attempt retirement, retry,
late acceptance, reverse stage disposal, cleanup aggregation and close races
retain their established semantics. A source responsible for an acquisition
whose observation setup throws must still clean its partial work; preflight
prevents avoidable missing-capability failures after allocation but cannot
prevent arbitrary user getters or trusted predicates from throwing.

## Migration and evidence

Node/Bun consumers wanting automatic ordinary-factory behavior import `DiBag`
from `di-bag/node`; other types/adapters may still come from root/subpaths.
Host-independent users configure the facade once or choose explicit stages.
Examples and runtime consumer fixtures must demonstrate the actual migration;
do not rewrite existing compile-only invalid programs to obtain green results.
Document raw-Promise ownership as different from native-fulfillment ownership.

Required evidence: original I1 source and projection controls, synchronous
val-box frame output, native cross-realm/shadowed/overridden then, exact
constructor/species/getter errors, structural rejection, arbitrary species,
whole-graph no-effect preflight, context isolation/forks/modules, raw/native
disposer types, source and installed CJS/ESM consumers, inferred declaration-only
downstream consumers on both compiler lanes, real box integration, root without
Node/box imports, and same-registry interoperation through root/node entries.

Original 54 native matrix rows remain immutable historical baseline evidence
at cc9dbdcdc70edb9872177b77cddf9767aa0b67ab. New acquired-type changes require
fresh normal 100-case work gates and small native scale controls; do not label
the old matrix as a measurement of this changed API. Large-scale diagnostic and
lifecycle obligations remain open. No unrelated M1 fork optimization or box
repository mutation is included in this correction.

## Sources and compatibility cost

[ECMAScript Promise.then](https://tc39.es/ecma262/2026/multipage/control-abstraction-objects.html#sec-promise.prototype.then)
performs brand validation and species construction; thrown errors are not a
classifier. The [Native Promise Predicate proposal](https://github.com/tc39/proposal-native-promise-predicate)
is not an available standard capability in the tested Node24.20.0/Bun1.4.0
runtimes. [Node util.types.isPromise](https://nodejs.org/api/util.html#utiltypesispromisevalue)
provides the host boundary used by the selected facade.

Cost: unconfigured root consumers need an import/configuration or provider-mode
migration; providers gain an acquired-value type dimension and adapters gain
stage options. If this choice proves too cumbersome, facade ergonomics can be
revised without returning to unsafe classification or weakening ownership types.
