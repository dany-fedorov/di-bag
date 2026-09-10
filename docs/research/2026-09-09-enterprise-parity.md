# Enterprise DI feature parity, 2026-09-09

> Historical feature inventory for the revision reviewed on this date. API names
> and implementation status below may be outdated. Its parity assessment covers
> the selected features, not equivalent semantics, maturity, or framework support.
> Use the [current comparison guide](../guides/comparison.md) for adoption tradeoffs.

## Scope and method

This is a dependency-injection comparison, not a claim that `di-bag` is a web or
UI framework. NestJS and Angular bundle DI with application bootstrapping,
routing or transport integration, component/controller creation, and framework
lifecycle. Those surfaces are useful integration reference points, but matching
their DI equivalents would not make a standalone DI library framework-equivalent.

The review uses the repository's current public surface and tests, the earlier
[DI comparison](2026-09-06-di-comparison.md), the
[enterprise design](../superpowers/specs/2026-09-06-enterprise-di-design.md), and
the [enterprise program](../superpowers/plans/2026-09-06-enterprise-di-program.md).
External claims come from current first-party documentation, manifests, or
source read on 2026-09-09. In particular, the reviewed upstream heads identify
Awilix 13.0.5, Typed Inject 5.0.0, TSyringe 4.10.0, and Effect
4.0.0-rc.112 in their own manifests: [Awilix manifest], [Typed Inject manifest],
[TSyringe manifest], and [Effect manifest].

“Graph closure” below means that the type system retains declared provider
requirements and prevents execution of an open graph. A generic `get<T>()`, a
typed token, or framework compilation alone is not that guarantee.

Legend: **Yes** means a documented first-class DI capability; **Composed** means
the capability is expressed from smaller primitives; **Special** means it exists
for a narrower framework facility; **No** means no documented first-class
equivalent. These labels compare behavior, not API spelling.

## Executive assessment

`di-bag` now has broad parity with the reviewed standalone containers on the core
DI dimensions. It has declared graph closure for supported factory shapes,
typed symbol tokens, object and positional injection, optional/lazy/all
references, aliases, ordered contributions, private/exported modules, three
lifetimes, tracked child scopes, selected sharing, checked overrides, explicit
async startup, cancellation, rollback, dependency-aware disposal, inspection,
lifecycle observation, and a runtime-validated plugin boundary. This is all
visible in the current [README](../../README.md) and public facade in
[`src/di-bag.ts`](../../src/di-bag.ts).

The strongest distinctions are architectural:

- NestJS owns a server application and request-context lifecycle. Angular owns a
  component/router injector hierarchy. `di-bag` supplies scope and ownership
  primitives but does not create a scope from an HTTP request, route, component,
  job, or message automatically.
- NestJS and Angular use runtime tokens plus decorators, compiler metadata, or an
  ambient injection context. `di-bag` keeps dependencies explicit in an object
  parameter or authenticated token tuple and closes the declared graph at
  `.end()` / `.start()`.
- NestJS transparently awaits async factory providers; Effect embeds async,
  failure, cancellation, and requirements in one program type. `di-bag` instead
  preserves an exact `T` versus `Promise<T>` service contract and waits only at
  explicit startup or mapping boundaries.
- Inversify exposes a mutable registry with load/unload/rebind. `di-bag` uses
  immutable descriptions and fresh bags/scopes. Application-owned dynamic import
  plus `fromPlugin`, module installation, `start()`, and `close()` already form a
  load/use/unload lifecycle without mutating a live registry.

The remaining work is mainly evidence, integration guidance, and maintainability.
A framework or transport host can bind request data, open a child scope, run a
handler, and close the scope. A small test helper can package the existing
checked replace/fork/start/close workflow. Neither requires weakening the static
graph or adding an ambient service locator. This comparison does not recommend
shipping direct NestJS or Angular adapters without a concrete user requirement.

**Implementation status, 2026-09-09.** The comparison confirmed no missing core
DI primitive among the assessed equivalents. The host-neutral
[`withOwnedScope` example](../../examples/integration/owned-scope.ts),
[enterprise integration guide](../guides/enterprise-integration.md), and
[focused integration suite](../../tests/enterprise-integration.test.ts) now
deliver the owned-scope/test-fixture and application-owned dynamic-import
recommendations below. The focused runtime suite passed all seven current tests; the full suite
passed 1,004 tests, followed by fresh classic/native checks and focused
verification of the recipe's awaited result type. See the
[readiness report](../reports/2026-09-09-enterprise-readiness.md). The
delivered seam is not a direct NestJS, Angular, or transport adapter: the host
remains responsible for connecting disconnect/destruction events, keeping scopes
alive for streams, and observing cancellation and cleanup failures.

## Feature matrix: graph and composition

| System | Declared graph closure | Dependency declaration / context | Optional and lazy | Multiple contributions | Alias | Module boundary |
| --- | --- | --- | --- | --- | --- | --- |
| `di-bag` | **Yes**, at `.end()` / `.start()` for supported declared shapes | One object parameter, or an authenticated token/reference tuple | **Yes**: `optional`, `lazy` | **Yes**: `contribute`, `all`, `resolveAll` | **Yes**, name/token combinations | **Yes**: private providers, explicit exports, renaming, retained external requirements |
| NestJS | **No** complete TypeScript closure; graph planning is framework runtime work | Constructor metadata/decorators; custom factories duplicate an ordered `inject` list; `ModuleRef` is a service-locator escape hatch | **Yes** optional; `forwardRef` handles declaration cycles; `ModuleRef` supports deferred lookup | **Special** for `APP_*` enhancers; the general `Provider` type has no `multi` field | **Yes**: `useExisting` | **Yes**: encapsulated imports/providers/exports; configurable and dynamic modules |
| Angular | **No** complete provider-map closure; missing lookup reaches `NullInjector` at runtime | Constructor/compiler metadata or synchronous ambient `inject()` | **Yes** optional; deferred reads use a captured `Injector`; no generic lazy-reference provider | **Yes**: `multi: true` | **Yes**: `useExisting` | **Yes**: `EnvironmentInjector`, element hierarchy, NgModule/import flattening, route providers |
| Awilix | **No**; inferred cradle output and optional strict runtime checks | Proxy cradle property reads, or parsed positional names in `CLASSIC` mode | **Composed**: proxy reads are lazy; `resolve(..., { allowUnregistered: true })` | **Composed** with an explicit array/custom resolver; no `resolveAll` primitive | **Yes**: `aliasTo` | File glob loading and child scopes, but no typed private/export contract |
| InversifyJS | **No**; binding and lookup calls are locally generic | Decorators/metadata for classes; explicit identifiers for resolved-value factories | **Yes**: optional lookup/decorator; deferred lookup can use the resolution context | **Yes**: repeated binding, `getAll`, `multiInject` | **Yes**: `toService` | **Yes**: `ContainerModule`, load and unload |
| TSyringe | **No**; generic registration/lookup is local | Legacy decorator metadata; factories receive the whole container | **Yes**: optional `inject`/`injectAll`; `delay` proxy for cycles | **Yes**: repeated registration, `resolveAll`, `injectAll` | **Yes**: `useToken` | Registry decorators and child containers; no encapsulated import/export module value |
| Typed Inject | **Yes** against the current accumulated context; normal construction is registration-order-sensitive | `static inject` / `fn.inject` ordered string tuple | **No** dedicated optional/lazy reference; `$injector` enables manual lookup | **No** documented first-class collection | **Composed** by child shadowing | **No** current module import/export; the proposal is still an open PR |
| Effect Context/Layer | **Yes**: `Effect<A,E,R>` and `Layer<ROut,E,RIn>` retain requirements | Yield/use typed `Context.Service` keys in Effect code | **Yes** through `Context.getOption` / `Reference` defaults and lazy Effects | **Composed** as an explicit collection-valued service | **Composed** by providing one value under another key | **Yes**: Layer composition tracks outputs, errors, and remaining inputs |

Nest evidence: the current [`Provider` source] defines class, value, factory,
and existing providers, including optional factory dependencies, but no general
`multi` property. The [custom-provider guide] documents erased interfaces,
symbols/strings/classes, `useFactory`, optional factory dependencies, and
`useExisting`; the [module guide] documents provider encapsulation, imports,
exports, and dynamic modules. Nest's test guide calls `APP_*` registration a
“multi-provider”, so the matrix treats that as a special framework token rather
than a general collection facility. [Nest testing]

Angular evidence: the [provider guide] documents `useClass`, `useValue`,
`useFactory`, `useExisting`, and general `multi: true`; the [hierarchical DI
guide] documents the EnvironmentInjector and ElementInjector trees plus
`optional`, `self`, `skipSelf`, and `host`; and the [injection-context guide]
documents where ambient `inject()` is valid. `InjectionToken<T>` gives a typed
lookup key, but the official API still describes missing-provider behavior as a
runtime injector result. [Angular InjectionToken]

Comparator evidence: [Awilix README], [Inversify binding syntax], [Inversify
decorators], [TSyringe README], [Typed Inject README], [Typed Inject module PR],
and current Effect [`Context.ts`] and [`Layer.ts`].

## Feature matrix: runtime and operations

| System | Scope / cache model | Async acquisition / startup | Disposal | Override and testing | Dynamic loading / removal | Inspection / interception |
| --- | --- | --- | --- | --- | --- | --- |
| `di-bag` | Root, scoped, transient; tracked children; checked captive-dependency policy; selected parent sharing | Exact sync/Promise services; `mapAsync`; selected parallel/sequential `start`; timeout, signal, rollback | Explicit ownership; drains in-flight work; dependents before dependencies; aggregated cleanup failure | Checked builder `replace`, independent `fork`, scoped overrides | Application imports code; `fromPlugin` validates one boundary; install before finalization; close owning bag/scope to unload | Frozen non-resolving snapshots and non-gating lifecycle observers |
| NestJS | Default singleton, request, transient; request scope bubbles; custom context IDs and durable request subtrees | Async factory providers are awaited before dependents; async bootstrap hooks | Application/module shutdown hooks await Promises; request-scoped classes do not receive application lifecycle hooks | Dedicated TestingModule, provider/module/enhancer overrides, request-context tests | Cached `LazyModuleLoader` adds modules to the shared graph; lazy-loaded services do not receive lifecycle hooks | `ModuleRef`, debug logging, Discovery/metadata facilities; framework interceptors are outside DI itself |
| Angular | One cached instance per owning environment/element injector; child injector hierarchy; no transient-per-lookup scope enum | Provider lookup/injection context is synchronous; `provideAppInitializer` may delay bootstrap for Promise/Observable completion | `DestroyRef` ties callbacks to component/directive or injector destruction; destroyable environment/module/component refs | TestBed config, provider/module/component overrides, reset and injection context | Router lazy-loads code and creates route environment injectors; programmatic environment injectors can be created/destroyed | Angular DevTools injector tree; framework hooks outside DI |
| Awilix | Transient, scoped, singleton; strict runtime captive checks | Promise is normally a service value; ESM glob loading itself is async; no graph startup barrier in core | Explicit resolver disposer for cached values; disposing a container does not dispose child scopes | Register over a key/create a scope; fresh containers are the normal test unit | Node-only glob loader; live registration is mutable; no module-scoped unload primitive | Public registrations/cache and local injector hooks; no lifecycle event stream |
| InversifyJS | Transient, singleton, resolution-request; parent containers | `getAsync` / `getAllAsync`; async resolved-value factories and activation | Activation/deactivation and pre-destroy; unload/unbind can await deactivation | `rebind`, snapshots/restore, child containers | Sync/async ContainerModule load and unload, binding-level unbind | Activation/deactivation handlers, named/tagged constraints |
| TSyringe | Transient, singleton, resolution-scoped, container-scoped; child containers | Synchronous container model; a Promise can be a returned value, with no graph startup API | Structural `Disposable` for container-created instances; async disposal can be awaited | Child containers, reset and `clearInstances` | Side-effect registry imports; no module load/unload ownership unit | Before/after resolution interception |
| Typed Inject | Singleton or transient per providing injector; disposable child-injector tree | Synchronous resolution shape; Promise can be the service value; no startup graph | Structural `dispose()` on class/factory results, child first; values and one-off injections are borrowed | Build a fresh immutable injector chain / child shadow | No current loader or module unload unit | `$injector` and `$target`; error path reporting |
| Effect Context/Layer | Layer memoization per build/memo map; Scope and fiber-local contexts | First-class lazy async, typed errors, interruption, Layer build/launch | Scope finalizers on success, failure, or interruption; Layer build owns resources | Provide a service or test Layer at the program boundary; Effect-aware test package | Compose/import a Layer before provision; Scope closes it; no mutable binding registry | First-class logging/tracing/metrics in the wider Effect system |

Nest sources: [injection scopes] covers request/default/transient, scope bubbling,
request tokens, custom context strategies, and durable providers. [Async
providers] states that Nest waits for a factory Promise before constructing its
dependents. [ModuleRef] covers static lookup, scoped `resolve`, context IDs, and
dynamic class creation. [Lifecycle events] documents async bootstrap/shutdown and
also states that request-scoped classes do not receive application lifecycle
hooks. [Lazy module loading] documents cache/shared-graph behavior and its missing
lifecycle-hook behavior. [Nest testing] documents provider and module overrides.

Angular sources: [`runInInjectionContext`] explicitly limits `inject()` to the
synchronous stack frame. [`provideAppInitializer`] waits for returned Promises or
Observables, which is a bootstrap facility rather than transparent async DI.
[`DestroyRef`] binds cleanup to a component/directive or injector lifecycle.
[`EnvironmentInjector`] and [`createEnvironmentInjector`] expose an explicitly
destroyable hierarchy. [TestBed] supplies provider/module/component overrides.
The [router loading guide] and [`Route.providers`] show lazy code loading and
route child injectors; the latter are framework integration, not a generic
container hot-unload contract.

Comparator sources: Awilix documents its three [lifetimes], strict checks, glob
loading, and the fact that [container disposal] does not dispose scopes.
Inversify documents async [container load/unload and optional lookups],
[ContainerModule] ownership, and activation/deactivation. TSyringe documents its
[four scopes, collections, interception, child containers], and [disposal].
Typed Inject documents its [two scopes and child injectors] plus child-first
[structural disposal]. Effect's source documents typed service keys in
[`Context.ts`], typed Layer requirements and memoized scoped construction in
[`Layer.ts`], and resource finalization in [`Scope.ts`].

## Exact `di-bag` evidence

The following is evidence for implemented behavior, not a proposed roadmap.

| Capability | Public implementation | Direct behavioral evidence |
| --- | --- | --- |
| Graph closure and checked replacement | `Builder.add`, `replace`, `end`, and `start` in [`src/di-bag.ts`](../../src/di-bag.ts) | [`tests/types/negative/missing.ts`](../../tests/types/negative/missing.ts), [`tests/types/negative/replacement-wrong-shape.ts`](../../tests/types/negative/replacement-wrong-shape.ts), and “replacement context preserves exact contracts from surviving consumers” in [`tests/types.test.ts`](../../tests/types.test.ts) |
| Typed names/tokens and positional/class adapters | `bind`, `fromTokens`, `fromFunction`, `fromClass` in [`src/di-bag.ts`](../../src/di-bag.ts) | “token bindings preserve source reuse, promise identity and public replacement” in [`tests/token-modules.test.ts`](../../tests/token-modules.test.ts) and “class adapters construct lazily with private fields, inherited prototypes and new.target” in [`tests/composition-adapters.test.ts`](../../tests/composition-adapters.test.ts) |
| Optional, lazy, and all references | [`src/dependency-references.ts`](../../src/dependency-references.ts) | “optional absence is distinct from a present undefined acquisition” and the lazy lifetime matrix in [`tests/dependency-references.test.ts`](../../tests/dependency-references.test.ts); “all adapters select frozen arrays” in [`tests/contributions.test.ts`](../../tests/contributions.test.ts) |
| Alias and ordered multi-contribution | `Builder.alias`, `Builder.contribute`, `Bag.resolveAll` in [`src/di-bag.ts`](../../src/di-bag.ts) | “named aliases preserve exact canonical object” in [`tests/aliases.test.ts`](../../tests/aliases.test.ts); “contributions preserve order, empty reads and array immutability” in [`tests/contributions.test.ts`](../../tests/contributions.test.ts) |
| Private/exported modules and lexical identity | `Builder.install` and module API in [`src/module.ts`](../../src/module.ts) | “renamed repeated installations isolate private instances and cleanup” and “module providers can be replaced before sealing” in [`tests/modules.test.ts`](../../tests/modules.test.ts); “private tokens get independent installations and dependency ordered cleanup” in [`tests/token-modules.test.ts`](../../tests/token-modules.test.ts) |
| Root/scoped/transient and child scopes | `Bag.scope`, `withLifetime`, selected sharing in [`src/di-bag.ts`](../../src/di-bag.ts) and [`src/lifetime.ts`](../../src/lifetime.ts) | “root, scoped and transient identity have distinct ownership” in [`tests/lifetimes.test.ts`](../../tests/lifetimes.test.ts); “children own fresh acquisitions while independent forks outlive their source” in [`tests/scopes.test.ts`](../../tests/scopes.test.ts); selected parent routing in [`tests/selected-scopes.test.ts`](../../tests/selected-scopes.test.ts) |
| Checked overrides / test isolation | `Builder.replace` and `Bag.fork` in [`src/di-bag.ts`](../../src/di-bag.ts) | “fork snapshots mixed selection indices and reads only selected own overrides” in [`tests/token-modules.test.ts`](../../tests/token-modules.test.ts), plus override validation in [`tests/boundaries.test.ts`](../../tests/boundaries.test.ts) |
| Exact async values, eager startup, cancellation, rollback | `Builder.start` and [`src/startup.ts`](../../src/startup.ts) | “startup waits for selected native acquisition while leaving unrelated providers lazy”, sequential/parallel cases, cancellation, timeout, and rollback in [`tests/startup.test.ts`](../../tests/startup.test.ts) |
| Explicit ownership and dependency-aware shutdown | `Bag.close`, `withDisposal`, runtime acquisition graph | “cleanup runs in reverse acquisition order through unmanaged intermediates”, “dependency ordering wins over async completion order”, and cleanup aggregation in [`tests/disposal.test.ts`](../../tests/disposal.test.ts) |
| Dynamic boundary | `fromPlugin` in [`src/plugins.ts`](../../src/plugins.ts) | Descriptor authentication, dependency routing, output validation, native readiness, rollback, and exactly-once cleanup in [`tests/plugins.test.ts`](../../tests/plugins.test.ts) |
| Inspection and lifecycle observation | `inspect`, `inspectAll`, `observe` in [`src/di-bag.ts`](../../src/di-bag.ts) | Non-resolving immutable snapshots in [`tests/providers.test.ts`](../../tests/providers.test.ts) and observer ordering/failure isolation/owner identity in [`tests/observers.test.ts`](../../tests/observers.test.ts) |

Two boundaries matter when interpreting this evidence:

1. Dynamic JavaScript can bypass static evidence. `fromPlugin` authenticates a
   descriptor and validates its output at one explicit boundary; it does not
   prove arbitrary mutable behavior after admission or sandbox unknown code.
2. The supported compiler-scale contract deliberately uses bulk registration,
   groups, and reusable modules for very large graphs. The enterprise program
   records the classic compiler's binder limit for a 1000-call fluent source and
   the rejected forgeable carrier experiment. This is a maintainability and
   source-shape constraint, not a runtime feature omission.

## NestJS: DI equivalents and non-equivalents

### Provider declaration and static safety

Nest providers use runtime class, string, or symbol tokens. Class construction
normally relies on `@Injectable()` and emitted constructor metadata; interface
tokens need explicit `@Inject`. Custom factory providers declare an ordered
`inject` array separately from the function signature, and may mark individual
entries optional. `useExisting` aliases another provider. [Custom providers]

This model lets the framework instantiate controllers, guards, and other classes,
but its provider type does not accumulate one registry type or prove module-graph
closure. Missing visibility, duplicate-token choices, and many lifecycle errors
are found during Nest graph construction. `di-bag` provides a stronger static
closure claim for its supported declared factory shapes, while requiring an
explicit factory or typed tuple to adapt positional constructors.

### Scope and injection context

Nest's default singleton belongs to the application. Request providers belong to
an inbound request context and cause request scope to bubble into consumers;
transients are dedicated to each consumer. `ContextIdFactory`, `REQUEST`, and
`ModuleRef.resolve(..., contextId)` let framework code find or synthesize the
right request subtree; durable providers can aggregate request subtrees by a
custom strategy. [Injection scopes] [ModuleRef]

`di-bag` root/scoped/transient policies are the library-level equivalents, and
its strict lifetime checks catch captive reads. A `Bag.scope()` is not by itself
an HTTP request scope: an adapter must open it at request/message/job entry,
bind contextual values through checked overrides or providers, and close it in a
`finally` path. That missing automatic hook is framework integration, not a new
cache policy.

Nest's `ModuleRef` is also an explicit service locator, while di-bag's
`AcquisitionContext` intentionally carries cooperative cancellation rather than
the whole bag. `DiBag.lazy(token)` covers declared deferred lookup without making
arbitrary token access ambient. Adding a bag-valued magic dependency would weaken
dependency visibility and should not be treated as required parity.

### Modules, async, lifecycle, testing, and lazy loading

Nest modules encapsulate providers and export a public subset. Dynamic modules
may be computed synchronously or asynchronously and configurable-module helpers
standardize `forRoot` / `forRootAsync` patterns. This is close to a di-bag module
returned by an ordinary configuration function; di-bag additionally retains a
typed `Provides`/`Requires` contract and independent private identities per
installation. [Nest modules]

Nest awaits async factory providers before constructing dependents. It also
awaits asynchronous bootstrap and shutdown hooks. This is convenient but changes
the service boundary from “Promise as the declared service” to “fulfilled value
after framework acquisition.” `di-bag` has consciously chosen exact Promise
identity plus explicit `mapAsync` and `start` boundaries. Neither semantic is a
drop-in substitute for the other. [Async providers] [Lifecycle events]

Nest's TestingModule supplies provider/module/guard/etc. override helpers and can
resolve a request-scoped instance under a chosen context ID. `di-bag` already has
the underlying stronger typed operations (`replace`, `fork`, and `scope`), but no
single test harness that standardizes start/cleanup and selected overrides.
[Nest testing]

`LazyModuleLoader` imports a module into the shared module graph and caches it.
Its own documentation says lifecycle hooks are not invoked for those lazy-loaded
modules and services. That feature is not a strict superset of application-owned
`import()` + di-bag `fromPlugin`/module + owned bag startup/close. A live,
mutable, shared registry would be a different operating model and should be added
only for a demonstrated hot-extension requirement. [Lazy module loading]

Nest has special multi-provider behavior for application-wide enhancers such as
`APP_GUARD`; its general provider interface has no Angular-style `multi` option.
`di-bag` contributions are therefore broader as a library primitive.

## Angular: DI equivalents and non-equivalents

### Tokens, providers, and injection context

Angular accepts class and `InjectionToken<T>` identifiers and provider records
using `useClass`, `useValue`, `useFactory`, or `useExisting`. `multi: true`
aggregates repeated providers under a token. The typed token determines the local
result type, but the injector does not expose an accumulating provider-map type
that proves every consumer requirement is present. [Angular provider guide]
[Angular InjectionToken]

Angular can infer class constructor dependencies through its compiler and also
offers ambient `inject()`. The latter works only while Angular has installed a
current injector: class construction/field initialization, provider factories,
token factories, or a synchronous `runInInjectionContext` frame. It cannot be
called after `await`. [`inject`] [`runInInjectionContext`]

`di-bag` has no ambient current-bag stack. Object factories and typed tuples make
dependencies visible in the provider type, while `withContext` adds only the
owner's `AbortSignal`. This explicitness is an architectural safety property.
An ambient `inject()` clone would make ordinary call sites depend on hidden
dynamic state and is not needed for DI parity.

### Hierarchy, optional/multi/alias, and lazy code

Angular's hierarchy follows both the component element tree and the environment
tree. Resolution modifiers control where lookup starts and stops. A provider is
normally cached by the injector/component that owns it; a component-level or
route-level provider yields isolated instances, but Angular has no general
transient-per-resolution provider scope corresponding to di-bag's transient.
[Hierarchical DI]

`di-bag` child scopes and selective sharing model explicit ownership trees, not
DOM visibility. It has no `self`/`skipSelf`/`host` query modifiers because a
provider's graph is fixed by lexical module identity plus selected sharing. Those
Angular modifiers matter for component projection and should remain an adapter or
framework concern.

Angular's optional and multi facilities correspond directly to `DiBag.optional`
and `DiBag.all`/contributions. `useExisting` corresponds to `alias`. A captured
Angular `Injector` can perform later lookup; `DiBag.lazy` offers a narrower,
declared deferred dependency that preserves scope ownership and static closure.

Angular router loaders can dynamically import routes/components inside the
current route injection context. Route providers create a child
`EnvironmentInjector`. Programmatic environment injectors can likewise be
created and destroyed. These facilities combine code loading, route lifetime,
and DI; di-bag leaves the code-loading trigger to its host and can give the
loaded feature an owned bag/scope. [Angular route loading] [Route providers]

### Async startup, destruction, and tests

Angular DI lookup is synchronous. A factory may provide a Promise as its token
value, while `provideAppInitializer` separately delays application bootstrap
until its Promise or Observable completes. That split is closer to di-bag's
exact Promise values plus selected `start()` than to Nest's transparent async
provider resolution. Angular's initializer is application-global; di-bag start
selects named or typed services, supports sequential/parallel acquisition,
timeout/cancellation, and rolls back its fresh bag. [Angular app initializer]

`DestroyRef` registers cleanup against a component/directive or injector owner,
and destroyable injector/module/component refs expose `destroy()`. This is a
lifecycle callback model. `di-bag` uses explicit provider ownership and an
observed dependency graph to drain work and close dependents before dependencies;
it also awaits and aggregates cleanup failures. [`DestroyRef`]

TestBed supplies a framework test injector, provider and metadata overrides,
component creation, and a test injection context. The useful standalone-DI
equivalent for di-bag is a small test helper around existing checked forks and
guaranteed close, rather than component/compiler emulation. [Angular TestBed]

## Comparator refresh

### Awilix 13.0.5

Awilix still offers three lifetimes, child scopes, `aliasTo`, local injection,
strict runtime captive checks, explicit disposers for cached resolver values,
and Node glob loading. The object registration overload now accumulates inferred
cradle outputs, but dependency compatibility and complete closure remain runtime
concerns. `PROXY` mode resolves cradle property reads; `CLASSIC` parses parameter
names and remains sensitive to minification. `allowUnregistered` is an optional
manual lookup, and multiple contributions remain a custom resolver/array pattern
rather than a built-in `resolveAll`. Container disposal clears its own cache and
does not dispose child scopes. [Awilix README] [Awilix container source]

Compared with Awilix, di-bag has less live mutability and file-system automation,
and more static graph, module-privacy, contribution, shutdown-order, and exact
Promise evidence. Awilix glob loading is Node-only and depends on `fast-glob`, so
copying it would conflict with di-bag's host-independent core and zero-runtime-
dependency target. [Awilix manifest]

### InversifyJS

Current Inversify documents transient/singleton/request scopes; optional,
multi, named, and tagged resolution; decorator metadata; explicit
`toResolvedValue` dependency lists; `toService` aliases; parent containers;
sync/async lookup; activation/deactivation; snapshots/rebind; and sync/async
ContainerModule load/unload. Its current container API can remove one binding by
binding identifier and invokes deactivation during unbind/unload. [Inversify
binding syntax] [Inversify container] [Inversify ContainerModule]

This is the broadest live-registry feature set in the standalone group. It still
does not express one closed TypeScript registry graph: `bind<T>(id)` and
`get<T>(id)` are local generic claims. Its deactivation is binding/cache oriented,
whereas di-bag's explicit ownership graph covers independent transient attempts,
pending acquisition, failed rollback, and dependent-before-dependency shutdown.

### TSyringe 4.10.0

TSyringe still requires legacy decorators, `emitDecoratorMetadata`, and a
Reflect metadata polyfill for its conventional constructor path. It supplies
transient, singleton, resolution-scoped, and container-scoped lifetimes; child
containers; optional injection; aliases; repeated registrations with
`resolveAll`/`injectAll`; resolution interceptors; structural disposal; reset and
instance-clearing test helpers; and a `delay` proxy for circular dependencies.
Factories receive the whole container, so their requirements are service-locator
calls rather than a declared graph. [TSyringe README] [TSyringe manifest]

There is still no structured async-acquisition/startup graph or encapsulated
module import/export unit. A Promise can be a service value. Container-created
instances that implement `Disposable` are disposed, but the current source path
does not give factory/value results the same explicit ownership semantics as
di-bag's provider stages.

### Typed Inject 5.0.0

Typed Inject retains strong compile-time checking between the current injector
context, an ordered `static inject`/`fn.inject` tuple, and parameter types. It
offers singleton and transient providers, child injectors, `$injector` and
`$target` magic tokens, synchronous resolution, and child-first structural
disposal for class/factory-created values. Values and one-off injected results
are borrowed. Normal providers can only depend on tokens already in the current
injector, unlike di-bag's forward requirements and final closure boundary.
[Typed Inject README]

The April 2026 import/export module proposal is still open and is therefore not
a current capability. The released/main README does not document optional
references, ordered multi-contribution, aliases, async startup, module privacy,
or dynamic loading. [Typed Inject module PR] [Typed Inject manifest]

### Effect Context/Layer/Scope 4.0.0-rc.112

Effect v4's current `Context.Service<Identifier, Shape>` is both a typed key and
an Effect requirement. `Context.Reference` provides a cached default;
`Context.getOption` provides optional lookup. `Layer<ROut,E,RIn>` tracks provided
services, typed construction errors, and remaining requirements. Layer building
uses memo maps and scopes; scoped construction and finalizers participate in
success, failure, and interruption. [`Context.ts`] [`Layer.ts`] [`Scope.ts`]

Effect remains the strongest reviewed model for async resource composition and
typed remaining requirements. It is also a complete effect programming model:
services are obtained by yielding/using tags inside Effect values, and async
errors/cancellation live in Effect's types/runtime. di-bag can borrow lifecycle
principles without pretending that ordinary function factories provide the same
fiber-local context, interruption, typed failure, or concurrency semantics.

Effect has no same-key multi-binding registry or alias primitive comparable to
Angular/Inversify. Collections and alternate names are ordinary service values or
contexts/layers. Tests replace dependencies by providing another service or
Layer; the broader Effect repository includes a dedicated testing entry point.
[Effect manifest]

## Actual gaps and prioritized improvements

These priorities distinguish missing DI primitives from application-owned
integration. The current core does not need a generic multi-binding facility,
alias facility, third lifetime, async startup barrier, module privacy mechanism,
or disposal graph; all are already implemented and tested.

### P0: document one request/job scope adapter contract and prove it end to end

**Delivered at the host-neutral recipe level.** The example, guide, and
integration suite cited in the status note implement a small host adapter pattern
that:

1. creates a tracked child scope at an HTTP request, message, job, or command
   boundary;
2. binds typed context values through selected checked overrides/providers;
3. propagates the scope's `AbortSignal` to cooperative acquisitions;
4. optionally starts selected request services;
5. always awaits `scope.close()` and preserves both handler and cleanup failures.

This is a host-neutral example and contract test, not a request lifetime added to
core or a promise to ship direct framework packages. Nest's
`REQUEST`/ContextId integration and Angular's route/environment injectors show
why the hook is operationally valuable. The core already supplies every required
ownership primitive. A transport-specific package is justified only by concrete
adoption demand.

The focused suite proves concurrent operation isolation, shared parent-root
identity, checked overrides visible inside a private module, scope-signal abort
on close, handler-plus-cleanup failure preservation, transient independence, and
child cleanup before root cleanup. It does not implement or prove a real
transport disconnect bridge or streamed-response lifetime; the guide assigns
those responsibilities to the host.

### P0: document and test the application-owned dynamic feature lifecycle

**Delivered.** The guide and integration suite turn the intended seam into this
canonical recipe:

```text
application import/select -> validate descriptor -> construct/install module
-> start selected services -> use -> close owning bag/scope
```

The guide states which graph is static, which boundary is runtime validated, how
plugin version/output validation works, and who owns unload. The integration
test dynamically imports a local fixture, installs it before finalization,
starts an export, uses private dependencies and ordered contributions, then
proves exactly-once disposal of the handler, private provider, and plugin. This
adds the host-level import orchestration that the lower-level
`tests/plugins.test.ts` cases did not cover.

Do not add live registry mutation merely to resemble Inversify. Consider a
mutable load/unload API only if a product requirement needs a long-lived bag to
gain or lose providers while existing consumers remain alive. That design would
need atomic graph admission, collision policy, in-flight resolution policy,
module identity, dependency-aware unload refusal/cascade, and static-safety
language for newly unknown registrations.

### P1: provide a minimal test harness over checked primitives

**Delivered as a documented in-repository fixture.** `withOwnedScope` preserves
the acquired scope's exact type in its work callback, accepts a checked
builder/module/fork through the acquisition callback, and guarantees close after
success or failure. The integration suite proves a private module consumer sees
an exported override, transient acquisitions remain independent, and cleanup
runs for a failed operation without losing the original failure. This closes the
standalone DI-fixture ergonomics gap without separate override semantics or a
global singleton container. It is an example to copy, not a package export, and
the new suite also proves that failed fixture startup releases acquired
resources without admitting work. The broader startup suite supplies the
additional cancellation and late-completion evidence.

### P1: keep compiler-scale and diagnostic evidence as an API constraint

The fluent type state is a differentiator and a maintenance cost. Keep supported
100-operation gates and 500-operation measurements, and keep documenting the
grouped/module route for 1000-provider applications. Every new type-level feature
should include classic and native compiler diagnostics, declaration emit, editor-
relevant source shapes, and a bounded resource ceiling before it joins the public
surface.

This is more urgent than adding decorators, ambient injection, qualifier DSLs,
or mutable rebind because a regression here would weaken the feature that most
clearly separates di-bag from Nest, Angular, Awilix, Inversify, and TSyringe.

### P2: add opt-in interoperability adapters only when demanded

Low-cost candidates are an explicit `Symbol.dispose` / `Symbol.asyncDispose`
ownership adapter and transport-specific helpers. Keep them opt-in so a borrowed
object is never owned merely because it happens to have a cleanup-shaped method.

Activation middleware, consumer/inquirer injection, named/tagged constraint DSLs,
and ambient `inject()` should remain deferred. Metadata plus non-gating observers
already cover telemetry, tokens cover qualifiers, and `mapSync`/`mapAsync` cover
explicit provider transformation. Add a new cross-cutting interception primitive
only after a use case cannot be expressed without unsafe repetition.

## Capabilities that should not be copied for parity's sake

- **Framework request/component scopes in core.** Supply adapters over
  `Bag.scope()`; the framework owns the event that opens and closes them.
- **Transparent async unwrapping.** It would erase di-bag's exact Promise service
  contracts and conflict with current explicit acquisition modes.
- **An ambient service locator.** Angular's `inject()` and Nest's `ModuleRef` are
  useful inside their managed execution contexts; di-bag's explicit parameter or
  token-reference graph is the stronger library default.
- **Unrestricted live registry mutation.** Immutable modules, fresh forks/scopes,
  and owner close provide deterministic static composition. Inversify's live
  load/unload is valuable for a different operating model.
- **Decorator or compiler-transform dependence.** Nest, Angular, Inversify, and
  TSyringe can integrate deeply with framework-created classes because they own
  metadata/compilation. `fromClass` and `fromFunction` already adapt ordinary
  code without making that toolchain mandatory.
- **Framework-wide parity language.** Nest and Angular provide routing,
  controllers/components, platform bootstrapping, testing environments, and
  developer tooling beyond DI. The defensible statement is broad standalone DI
  feature coverage with stronger declared-graph and ownership guarantees in the
  supported model.

## Primary sources

[Awilix manifest]: https://github.com/jeffijoe/awilix/blob/master/package.json
[Awilix README]: https://github.com/jeffijoe/awilix
[Awilix container source]: https://github.com/jeffijoe/awilix/blob/master/src/container.ts
[lifetimes]: https://github.com/jeffijoe/awilix#lifetime-management
[container disposal]: https://github.com/jeffijoe/awilix#disposing

[Typed Inject manifest]: https://github.com/nicojs/typed-inject/blob/master/package.json
[Typed Inject README]: https://github.com/nicojs/typed-inject
[Typed Inject module PR]: https://github.com/nicojs/typed-inject/pull/82
[two scopes and child injectors]: https://github.com/nicojs/typed-inject#-lifecycle-control
[structural disposal]: https://github.com/nicojs/typed-inject#-disposing-provided-stuff

[TSyringe manifest]: https://github.com/microsoft/tsyringe/blob/master/package.json
[TSyringe README]: https://github.com/microsoft/tsyringe
[four scopes, collections, interception, child containers]: https://github.com/microsoft/tsyringe#scoped
[disposal]: https://github.com/microsoft/tsyringe#disposable-instances

[Inversify binding syntax]: https://inversify.io/docs/api/binding-syntax/
[Inversify decorators]: https://inversify.io/docs/api/decorator/
[Inversify container]: https://inversify.io/docs/api/container/
[Inversify ContainerModule]: https://inversify.io/docs/api/container-module/
[container load/unload and optional lookups]: https://inversify.io/docs/api/container/
[ContainerModule]: https://inversify.io/docs/api/container-module/

[Effect manifest]: https://github.com/Effect-TS/effect/blob/main/packages/effect/package.json
[`Context.ts`]: https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Context.ts
[`Layer.ts`]: https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Layer.ts
[`Scope.ts`]: https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Scope.ts

[`Provider` source]: https://github.com/nestjs/nest/blob/master/packages/common/interfaces/modules/provider.interface.ts
[custom-provider guide]: https://docs.nestjs.com/fundamentals/custom-providers
[Custom providers]: https://docs.nestjs.com/fundamentals/custom-providers
[module guide]: https://docs.nestjs.com/modules
[Nest modules]: https://docs.nestjs.com/modules
[injection scopes]: https://docs.nestjs.com/fundamentals/injection-scopes
[Injection scopes]: https://docs.nestjs.com/fundamentals/injection-scopes
[Async providers]: https://docs.nestjs.com/v7/fundamentals/async-components
[ModuleRef]: https://docs.nestjs.com/fundamentals/module-ref
[Lifecycle events]: https://docs.nestjs.com/fundamentals/lifecycle-events
[Lazy module loading]: https://docs.nestjs.com/fundamentals/lazy-loading-modules
[Nest testing]: https://docs.nestjs.com/fundamentals/testing

[provider guide]: https://angular.dev/guide/di/defining-dependency-providers
[Angular provider guide]: https://angular.dev/guide/di/defining-dependency-providers
[Angular InjectionToken]: https://angular.dev/api/core/InjectionToken
[hierarchical DI guide]: https://angular.dev/guide/di/hierarchical-dependency-injection
[Hierarchical DI]: https://angular.dev/guide/di/hierarchical-dependency-injection
[injection-context guide]: https://angular.dev/guide/di/dependency-injection-context
[`inject`]: https://angular.dev/api/core/inject
[`runInInjectionContext`]: https://angular.dev/api/core/runInInjectionContext
[`provideAppInitializer`]: https://angular.dev/api/core/provideAppInitializer
[Angular app initializer]: https://angular.dev/api/core/provideAppInitializer
[`DestroyRef`]: https://angular.dev/api/core/DestroyRef
[`EnvironmentInjector`]: https://angular.dev/api/core/EnvironmentInjector
[`createEnvironmentInjector`]: https://angular.dev/api/core/createEnvironmentInjector
[TestBed]: https://angular.dev/api/core/testing/TestBed
[Angular TestBed]: https://angular.dev/api/core/testing/TestBed
[router loading guide]: https://angular.dev/guide/routing/loading-strategies
[Angular route loading]: https://angular.dev/guide/routing/loading-strategies
[`Route.providers`]: https://angular.dev/api/router/Route
[Route providers]: https://angular.dev/api/router/Route
