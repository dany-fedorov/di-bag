# DI value proposition: feature overlap

> Research snapshot from 2026-09-10, published with its original findings and limitations. API names and external source assessments reflect the reviewed versions; see the [current API guide](../guides/api-reference.md) for supported DI Bag usage.

Research date: 2026-09-10. This note distinguishes advertised type safety from checks visible in ordinary TypeScript signatures. It compares upstream repository snapshots, not independently verified npm releases. A capability present in a competitor does not establish equal semantics, completeness, maturity, or performance.

## Close standalone alternatives

| Capability | InferDI | Iti | TypeWired |
| --- | --- | --- | --- |
| No mandatory decorators, metadata reflection, or DI compiler transform | Yes | Yes | Yes |
| Ordinary async factories | Yes; Promise values and a separate awaited-graph API | Yes; Promise values | Yes; explicit async provider and awaited resolution |
| Missing-provider checks during typed composition | Yes, within its accumulated registration model | Known-key callback checks; mutable operations limit the guarantee | No; typed tokens do not prove registration |
| Compatible dependency types checked by TypeScript | Yes | Yes, through ordinary typed factory/constructor calls | Yes, token and positional parameter checks |
| Explicit singleton/scoped/transient registration policy | Yes | No equivalent policy API found | Yes |
| Standalone DI core | Yes; optional server adapters | Yes; React bindings are separate | Yes |

Evidence and qualifications follow. “Async” deliberately includes Promise-valued services: requiring consumers to await a dependency is a supported design, not missing async support.

### InferDI

Reviewed commit: [`d4d21048`](https://github.com/inferdi/inferdi/tree/d4d21048f346d0783d9bc440978585aef8c2dc11). The project documents a standalone core without decorators, reflection, or runtime dependencies. Its README describes singleton, scoped, and transient lifetimes and separate Fastify, Hono, Koa, Express, and Elysia packages. These claims substantially overlap the proposed positioning. This review does not independently validate the README's speed comparisons. [README](https://github.com/inferdi/inferdi/blob/d4d21048f346d0783d9bc440978585aef8c2dc11/README.md).

The generic registry grows with registration. Factory callbacks receive a container narrowed to known, lifetime-compatible providers. `registerClass` checks dependency keys against constructor parameter types. `AllowedDeps` excludes scoped/transient dependencies from singleton consumers. The ordinary factory overload preserves its return type, including `Promise<T>`; declarative async registration records `AsyncSpec<Awaited<R>, L>` and has a separate `getAsync` path. These are ordinary TypeScript types, not compiler-plugin checks. [Container source](https://github.com/inferdi/inferdi/blob/d4d21048f346d0783d9bc440978585aef8c2dc11/packages/inferdi/src/Container.ts).

Upstream type tests cover missing keys, wrong dependency order and arity, mismatched types, and singleton capture of shorter-lived services. The guarantee concerns supported registration calls against the accumulated container type. Callback-only factories use contextual resolver checks; declared scope-input requirements require the dependency-aware overload. This is not a claim that arbitrary captured JavaScript state is statically analyzed. [Registration type tests](https://github.com/inferdi/inferdi/blob/d4d21048f346d0783d9bc440978585aef8c2dc11/packages/inferdi/__tests__/container.test-d.ts).

Separate async tests distinguish Promise-valued ordinary factories from declarative async dependencies: the latter propagate async status through class dependencies and require async resolution. Therefore “native async plus compile-time checks” is not exclusive to DI Bag. [Async type tests](https://github.com/inferdi/inferdi/blob/d4d21048f346d0783d9bc440978585aef8c2dc11/packages/inferdi/__tests__/async-dependency-graph.test-d.ts).

Teardown tests document reverse creation order, async disposal, multiple-error aggregation, and caller-owned transients. They also explicitly document that disposing a parent does **not** close an undisposed child. Scope ownership is consequently a meaningful comparison dimension beyond a “supports disposal” checkbox. No transactional startup API was identified in the reviewed public surface; this absence finding is limited to that snapshot. [Teardown tests](https://github.com/inferdi/inferdi/blob/d4d21048f346d0783d9bc440978585aef8c2dc11/packages/inferdi/__tests__/teardown.test.ts), [public implementation](https://github.com/inferdi/inferdi/blob/d4d21048f346d0783d9bc440978585aef8c2dc11/packages/inferdi/src/Container.ts).

### Iti

Reviewed commit: [`d8c7cfb5`](https://github.com/molszanski/iti/tree/d8c7cfb50beab1d65bf2855d74d0f4f26750bf1c). Iti explicitly promotes ordinary functions, async factories, compile-time checking, and no decorators or metadata setup. React integration is separate. Its lifecycle examples show cached providers and a pattern returning another factory for callers to invoke when fresh values are needed. [Package README](https://github.com/molszanski/iti/blob/d8c7cfb50beab1d65bf2855d74d0f4f26750bf1c/iti/README.md).

`Container<Context, DisposeContext>` accumulates context through `add`. Its callbacks receive `ContextGetter<Context>`, and `get` restricts keys to that context. Consequently, unknown dependency properties and incompatible arguments in ordinary construction are TypeScript errors. However, `delete` removes only a key from the resulting type; it does not retain and recheck downstream requirements. `upsert` is expressly available for replacement. Describe this as typed contextual composition, not immutable graph validation across every mutation. [Container source](https://github.com/molszanski/iti/blob/d8c7cfb50beab1d65bf2855d74d0f4f26750bf1c/iti/src/iti.ts), [type helpers](https://github.com/molszanski/iti/blob/d8c7cfb50beab1d65bf2855d74d0f4f26750bf1c/iti/src/_utils.ts).

Factories cache their returned Promise; consumers explicitly await dependencies. `getItems` can await multiple values. `addDisposer`, `dispose`, and `disposeAll` support cleanup; `disposeAll` starts registered cleanup concurrently rather than traversing dependency edges. No first-class child scope or per-provider lifetime configuration was found in the reviewed core. Those are source-review findings, not an executed conformance audit. [Container implementation](https://github.com/molszanski/iti/blob/d8c7cfb50beab1d65bf2855d74d0f4f26750bf1c/iti/src/iti.ts), [async usage guide](https://github.com/molszanski/iti/blob/d8c7cfb50beab1d65bf2855d74d0f4f26750bf1c/website/src/content/docs/guides/async-di/iti.mdx).

### TypeWired

Reviewed commit: [`1485b6a7`](https://github.com/valehasadli/TypeWired/tree/1485b6a7da4a0f1799bc7268987a57e1b72bbc2d). The README describes an independent container without decorators or reflection, explicit lifetimes, async resolution, and disposal. Its broad suggestion that a compiling graph necessarily resolves should be qualified by the implementation below. [README](https://github.com/valehasadli/TypeWired/blob/1485b6a7da4a0f1799bc7268987a57e1b72bbc2d/README.md).

Provider types compare values, classes, aliases, and positional dependency tokens with their expected types. `Lifetime` enumerates singleton, scoped, and transient; `AsyncFactoryProvider` explicitly accepts a Promise result. [Provider types](https://github.com/valehasadli/TypeWired/blob/1485b6a7da4a0f1799bc7268987a57e1b72bbc2d/src/types.ts).

However, `Container` carries no accumulated registration type, registration returns `this`, and `resolve<T>(token: Token<T>): T` accepts any typed token. An unregistered dependency therefore passes compilation and fails at runtime. Async resolution awaits dependencies and caches in-flight construction; lifetime capture checks also occur at runtime. No transactional startup API was identified. [Container implementation](https://github.com/valehasadli/TypeWired/blob/1485b6a7da4a0f1799bc7268987a57e1b72bbc2d/src/container.ts).

Async tests cover shared initialization and disposal waiting for pending container/scope construction. These capabilities are genuine overlap even though complete registration checking is absent. [Async tests](https://github.com/valehasadli/TypeWired/blob/1485b6a7da4a0f1799bc7268987a57e1b72bbc2d/tests/core/Async.test.ts).

## Verification performed

An isolated probe using the workspace's TypeScript 6.0.2 compiled the downloaded InferDI and TypeWired sources. TypeWired accepted both direct resolution of an unregistered token and a registered consumer depending on an unregistered token. InferDI produced the expected errors for missing lookup keys, missing factory dependencies, incompatible constructor dependencies, and singleton capture of scoped services; its ordinary async factory retained `Promise<number>`. The probe used `strict`, no emission, and no decorators or transforms. It passed with the expected errors asserted. No packages were installed, competitor runtime suites were not run, and Iti findings are source review only.

The proposed combination is useful positioning, but this review does not support exclusivity: InferDI already overlaps substantially. Specific composition, async-value, startup, replacement, and ownership semantics require separate comparison.

## Comparison with established alternatives

Reviewed on 2026-09-10 from the public documentation and source linked below. These are API/source assessments, not performance measurements or a test run of each competitor. The Effect documentation used here is explicitly version 3; no version-4 API equivalence is asserted.

Here, **wiring checks** means checking required registrations and compatible dependency types across the declared composition using ordinary TypeScript. Typed lookup results alone do not establish that guarantee. **Plain code** means no mandatory DI-specific decorator emit or compiler transformation; it does not mean an API has no runtime implementation. **Standalone** describes product scope, not automatic integration with every host.

| Library | Plain code / build requirements | Async factory behavior | Compile-time wiring checks | Explicit lifetime configuration | Product scope |
| --- | --- | --- | --- | --- | --- |
| DI Bag | Ordinary functions/classes; no decorator metadata | Preserves `T` / `Promise<T>`; explicit startup and owned cleanup | Missing dependencies, incompatible shapes, checked replacements and declared lifetime captures | Root, scoped, transient; tracked children and independent forks | Standalone DI and resource ownership |
| NestJS | Normal factory functions supported; standard application setup uses legacy decorators/metadata | Awaits async factory results before injecting dependents | Provider graph is resolved at runtime; factory argument types and `inject` lists are not a closed graph type | Singleton, request, transient | Server application framework |
| Awilix | Ordinary functions/classes, no decorator emit | Factory promises can be service values and cached | Inferred cradle types; no complete check that factory requirements have compatible registrations | Singleton, scoped, transient | Standalone DI |
| InversifyJS | Explicit factory bindings avoid class decorator emit; metadata-based class injection also supported | Awaits async bindings; `getAsync` / `getAllAsync` | Typed identifiers and results; missing bindings still checked at runtime | Singleton, transient, resolution-request | Standalone DI |
| TSyringe | Factories supported, but public entry requires reflection metadata support; normal class path uses legacy decorators | Factory generic output can be `Promise<T>`; no async graph startup API found | Registration and lookup types are local; no accumulated complete graph | Transient, singleton, resolution-scoped, container-scoped; factory caching uses helpers/custom logic | Standalone DI |
| Typed Inject | No decorators; dependency tuples stored in `inject` properties | Preserves factory return type, including promises | Checks requirements against accumulated registration context | Singleton or transient, with child injectors | Standalone DI |
| Effect Context/Layer (v3 docs) | No decorator emit; composition uses Effect/Layer APIs | Async acquisition through Effects; scoped resource management | Tracks provided and remaining service requirements | Layer memoization and explicit Scope ownership | Broader runtime/library, including concurrency and error management |

### Source details behind the table

**DI Bag.** The local [README](../../README.md), [public facade](../../src/di-bag.ts), [composition types](../../src/types.ts), and [lifetime checks](../../src/lifetime-types.ts) support the row. Type safety applies to supported declared TypeScript graphs, not unchecked JavaScript or arbitrary runtime plugin contents. `di-bag/node` configures Promise detection for Node/Bun; the portable entry needs explicit acquisition modes or a trusted classifier. This qualifies an unbounded "works everywhere with no setup" claim. See the [server integration guide](../guides/server-integration.md) for host-owned boundaries.

**NestJS.** Its [async-provider guide](https://docs.nestjs.com/fundamentals/async-providers) explicitly describes waiting before constructing dependents. The [custom-provider guide](https://docs.nestjs.com/fundamentals/custom-providers) describes a separately supplied ordered `inject` list and runtime tokens; factory support means claiming that every Nest service must be a decorated class would be inaccurate. The [starter configuration](https://github.com/nestjs/typescript-starter/blob/master/tsconfig.json) enables both legacy decorator options. [Injection scopes](https://docs.nestjs.com/fundamentals/injection-scopes) documents the lifetime policies and request-scope propagation. These are DI differences, not evidence that DI Bag is faster than a whole Nest application.

**Awilix.** The [README](https://github.com/jeffijoe/awilix) documents factory/class composition, lifetimes and runtime strict checks. Its [container interface and implementation](https://github.com/jeffijoe/awilix/blob/master/src/container.ts) accumulates inferred result types but registers `Resolver<T>` without a corresponding requirement type. Its [resolver implementation](https://github.com/jeffijoe/awilix/blob/master/src/resolvers.ts) calls the factory and returns the result; the container caches that result according to lifetime. A Promise is therefore a possible service value. Marking async factories wholly unsupported would be misleading.

**InversifyJS.** [Binding documentation](https://inversify.io/docs/fundamentals/binding/) covers `toResolvedValue`, awaited async dependency values, decorator metadata and lifetime configuration. The [container API](https://inversify.io/docs/api/container/) exposes locally generic binding/lookup operations and documents runtime failure when an identifier lacks a valid binding. The graph-completeness assessment follows those signatures; it is not a claim that Inversify has no TypeScript safety. Factory bindings also make a categorical "decorators always required" claim inaccurate.

**TSyringe.** The [README](https://github.com/microsoft/tsyringe) documents decorator settings, four lifetime policies, factories and containers. The [public entry](https://github.com/microsoft/tsyringe/blob/master/src/index.ts) throws if `Reflect.getMetadata` is absent. The [factory provider interface](https://github.com/microsoft/tsyringe/blob/master/src/providers/factory-provider.ts) returns generic `T`, which may be a Promise; the same file delegates caching to the factory. That differs from automatically awaiting dependencies and managing asynchronous startup.

**Typed Inject.** Its [API declaration](https://github.com/nicojs/typed-inject/blob/master/src/api/Injector.ts) restricts requested dependencies to the accumulated context. The [README](https://github.com/nicojs/typed-inject) explains dependency tuples, two cache policies, and children. The [implementation](https://github.com/nicojs/typed-inject/blob/master/src/InjectorImpl.ts) returns and caches factory results directly, so Promise-valued services are supported. Its disposal detection examines the returned object for `dispose()`; this does not imply automatic disposal of a resource eventually contained in a Promise. No equivalent to DI Bag's selected startup/rollback API was found in the reviewed public interface.

**Effect.** The versioned [Layer guide](https://effect.website/docs/v3/requirements-management/layers) demonstrates input/output requirement types, composition, asynchronous acquisition and finalizers. [Layer memoization](https://effect.website/docs/v3/requirements-management/layer-memoization) describes reuse boundaries; [Scope](https://effect.website/docs/v3/resource-management/scope) describes resource lifetime control. Its composition model requires Effect APIs, but application services can still wrap ordinary code. "Broader runtime" is a scope distinction, not a claim that adopting one Layer requires rewriting an entire application.

## Recommended positioning and claim boundaries

> Full-featured dependency injection for ordinary TypeScript and JavaScript.
> Compose sync and async factories, check your wiring with TypeScript, and configure service lifetimes explicitly—without decorators, emitted type metadata, or a framework.

This is a coherent value proposition, but the reviewed close competitors prevent treating the combination as unique. Async factories are common; several libraries also combine no decorators with static dependency checks.

"Full-featured standalone DI" is defensible as a description of the current breadth: tokens, classes/functions, modules and exports, optional/lazy dependencies, collections, aliases, lifetimes, scopes, replacements, async startup and disposal. It does not establish implementation maturity, universal ecosystem support or every feature found in every other container. The [existing core comparison](2026-09-09-enterprise-parity.md) maps that breadth; the public source remains authoritative as the checkout evolves.

Prefer "framework-independent" or "use it alongside your chosen server/framework" to "composable with everything." The application still bridges host lifecycles and runtime capabilities. Prefer "compile-time dependency checks" to an unqualified "type-safe": the former can name missing requirements, incompatible contracts, replacements and lifetime captures. JavaScript runtime usability does not itself provide TypeScript compile-time guarantees.

For stronger comparative claims, assess exact contracts: ordinary object-parameter dependencies, retained private-module constraints across replacements, parent-owned child cleanup, and startup rollback. A familiar feature name alone is insufficient evidence of equivalent behavior. No comparative speed or universal uniqueness claim is established by this review.
