# Box production use cases: evidence and limits

Research date: 2026-09-10. This note independently checks primary sources and
the local implementations. The older 2026-09-09 notes were leads, not evidence.
These are **production API analogues and proposed applications**, not evidence
that Babel, Sass, Spring, or other named projects use `sas-box` or `val-box`.
No third-party adoption of either package was established by this bounded review.

## Verdict

`sas-box` has a defensible niche at a reusable producer boundary where callers
need to select or require a synchronous acquisition method. `val-box` has a
defensible niche where acquisition produces both an optional value and diagnostic
information, and callers need to preserve those channels independently. Neither
is necessary for ordinary DI factories. The sources justify their underlying
contracts more strongly than their particular class hierarchies.

## sas-box: three strong precedents

| Primary precedent | Actual motivation | Implication and limit |
| --- | --- | --- |
| [gensync](https://github.com/loganfsmyth/gensync), [Babel transform runner](https://raw.githubusercontent.com/babel/babel/main/packages/babel-core/src/transform.ts), [Babel plugin/preset loader](https://raw.githubusercontent.com/babel/babel/main/packages/babel-core/src/config/full.ts) | gensync shares an implementation between synchronous and asynchronous entry points. Babel uses it for `transformSync`/`transformAsync`; its plugin factory loader supplies a specific error for async plugins invoked from a synchronous call. | Mixed plugin hosts really face this compatibility problem. An explicit box can advertise a provider's callable routes before invocation. gensync additionally composes whole generator pipelines; sas-box does not provide that machinery or prove an arbitrary callback is synchronous. |
| [Sass `Importer<sync>`](https://sass-lang.com/documentation/js-api/interfaces/importer/) | `Importer<'sync'>` works with both compile modes; `Importer<'async'>` permits Promise results and works only with asynchronous compilation. | Strong direct precedent for a static capability distinction. A host can reject async-only producers at a synchronous boundary. Sass already has its own adequate generic interface, so adding boxes inside Sass integrations is optional. |
| [Inversify container API](https://inversify.io/docs/api/container/) | `get` requires a synchronously resolved binding; `getAsync` supports asynchronous factories. | The same distinction occurs in DI. A sas-box adapter makes route selection local to a registration. It does not turn an asynchronous service graph into a synchronous one or remove producer failures. |

**Reasoned applications with di-bag:** a plugin host may accept local schema
loaders and network-backed loaders through a shared capability contract; a CLI
may require the synchronous producer while a server startup path accepts either.
A cache can create a new sync-capable box from a captured warm value and an
async-only box on a miss. That is application cache policy, not a sas-box cache
or an automatically changing readiness state.

The local [sas-box implementation](https://github.com/dany-fedorov/sas-box/blob/b895f9d1f1d168992f44e9f46025bc1ac9d26e14/src/index.ts)
stores callbacks and invokes them on each access; it supplies no memoization,
refresh, deduplication, or disposal. `sync()` preserves the exact callback result,
including a Promise. Thus `SasBox.Sync<Promise<T>>` proves an immediate method
call, not immediate availability of `T`. Require `SasBox.Sync<T>` with the actual
non-Promise payload contract when that distinction matters. Its `async()` can
execute synchronous callback work before returning; a Promise-shaped result is
not an off-thread or deferred-work guarantee.

The [di-bag adapter](../../src/sas-box.ts) explicitly chooses `sync`, `async`,
or `sync-first`, retains provider policy, and binds structural methods to their
box receiver. The latter two modes await the box and expose a native Promise.
`sync-first` is route preference, not an immediate-value API, a microtask-elision
guarantee, or a retry-on-sync-error policy. Sass documents faster synchronous
compilation specifically for its `sass` npm implementation; that cannot establish
a general sas-box speedup. [Sass performance qualification](https://sass-lang.com/documentation/js-api/functions/compileasync/).

**Prefer less machinery when:** a plain `() => T` or `() => Promise<T>` already
states the required route; all consumers can await a `T | Promise<T>`; or an
existing producer interface already exposes the needed methods. DI can also
await initialization before constructing dependents, as documented by
[Nest async providers](https://docs.nestjs.com/fundamentals/async-providers).
[.NET's DI guidance](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/guidelines)
instead recommends fast synchronous factories. These are valid architectural
alternatives, not missing features that always need boxes.

## val-box: five strong precedents

| Primary precedent | Actual motivation | Implication and limit |
| --- | --- | --- |
| [Spring `OriginTrackedValue`](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/origin/OriginTrackedValue.html), [Actuator environment response](https://docs.spring.io/spring-boot/api/rest/actuator/env.html) | Wrap a configuration value with optional origin; diagnostics expose the source and sometimes file position alongside a value. | Strong provenance precedent. Spring's wrapper factory returns null for a null source value, so it is not an equivalent two-channel presence model. |
| [.NET `GetDebugView`](https://learn.microsoft.com/en-us/dotnet/api/microsoft.extensions.configuration.configurationrootextensions.getdebugview?view=net-10.0-pp) | Show where each configuration value came from, with an optional value-processing callback. | Supports an inspection path for configuration provenance. It returns diagnostic text; it does not establish frozen snapshots, nine variants, or per-acquisition DI metadata. |
| [OpenFeature evaluation/resolution details](https://openfeature.dev/specification/types/) | Carry a flag's value with reason, variant, error information, and metadata. | Strong per-evaluation diagnostics analogue for tenant/request-dependent results. The evaluation value is required; an error/default reason is not absence, and the standard does not require val-box's independent channels. |
| [Protocol Buffers field presence](https://protobuf.dev/programming-guides/field_presence/) | Explicit presence allows merging a field intentionally set to its default; implicit presence cannot express that patch without an additional mechanism. | Establishes why unset and present-with-default differ. It does not establish JavaScript `undefined`, metadata, or the box hierarchy. |
| [Nest issue #2732](https://github.com/nestjs/nest/issues/2732), [current provider classification source](https://raw.githubusercontent.com/nestjs/nest/master/packages/core/injector/module.ts) | A user reported failed injection for `useValue: undefined`; current `isCustomValue` checks ownership of the `useValue` property. | Concrete DI motivation for presence independent of payload. Also counterevidence to necessity: the production solution is a property-presence check, without a box. |

**Reasoned application with di-bag:** resolve a tenant's effective setting as
the service value and record its selected source, revision, and fallback reason
for inspection. Use presence mode when an absent setting and a deliberately
present `undefined` differ, or when a failed lookup should return no value but
still explain which source was checked. That final state is an application
contract; OpenFeature does not supply evidence that its own evaluations omit
the value.

The [local snapshot implementation](https://github.com/dany-fedorov/val-box/blob/07506fcb3e49f460b6de357ecad7d88262a7f32d/src/snapshot.ts)
copies two presence flags, payload references, and the intentional alias.
It freezes the outer snapshot and both presence records, not the payloads.
Later box mutation cannot replace the references in an earlier snapshot, while
mutations through those shared references remain visible. The
[nine classes](https://github.com/dany-fedorov/val-box/blob/07506fcb3e49f460b6de357ecad7d88262a7f32d/src/index.ts) encode known present,
known absent, or statically unknown for each channel. Unknown is uncertainty in
the type, not a third runtime presence state. The sourced use cases do not
demand nine named classes; their compatibility and ergonomic value must be
judged separately. A free-string alias is a label, not structured provenance.

The [di-bag adapter](../../src/val-box.ts) snapshots once during acquisition,
returns a required value or a presence record, and appends metadata/alias as an
inspection frame. Missing required values throw; presence mode preserves the
distinction. [Inspection](../../src/inspection.ts) is a point-in-time view of
acquisition state, not a live box subscription or retained audit history.
If flags/settings must change within a bag's lifetime, inject an evaluation
service or use appropriate scopes rather than treating one cached acquisition
as a continuously refreshed value.

**Prefer less machinery when:** a plain record or `Presence<T>` union already
carries the state, metadata is unnecessary, or one fixed provider annotation
is enough. [di-bag `withMetadata`](../../src/provider.ts) attaches static metadata
without acquisition, so ownership/team/source labels known at registration do
not need val-box. `mapSync`/`mapAsync` suffice for ordinary projection. Dynamic
metadata justifies the frame adapter when inspection must describe what that
particular acquisition returned.

Do not claim `Option` intrinsically loses present `undefined`:
[fp-ts `some`](https://raw.githubusercontent.com/gcanti/fp-ts/master/src/Option.ts)
accepts any `A`, including `undefined`; `fromNullable` deliberately collapses
nullish input. Two `Option`/presence fields in an ordinary record can model the
same independent channels. A structural `snapshot()` object also works with
di-bag without installing val-box. The package's value is standardizing these
operations and compatibility contracts when repeated use warrants it.

## Documentation recommendation

Together, the protocols answer different questions: sas-box selects how to
acquire a result; val-box describes whether that result exists and where it came
from; DI Bag applies caching and explicit ownership. For a plugin that can load
configuration locally or remotely and report its selected source, the async
composition is `fromValBoxAsync(fromSasBox(registration, { mode: 'async' }))`.
That is a plausible combined use, not a reason to add both wrappers when one
ordinary factory returning a record already serves the application.

Lead sas-box with mixed sync/async producer capabilities and val-box with
acquisition provenance plus explicit presence. Present the di-bag adapters as
optional integration boundaries that retain provider policy. Keep cache,
lifetime, ownership, scheduling, payload immutability, and refresh claims tied
to the component that actually provides them. Describe the examples as proposed
uses supported by analogous APIs; make no package-adoption or general benchmark
claim.
