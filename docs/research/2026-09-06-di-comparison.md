# Research: TypeScript DI landscape for `di-bag`

**Date:** 2026-09-06

**Status:** Research only; not approved architecture.

**Question:** How can `di-bag` pursue unusually strong TypeScript inference and
safety while becoming feature-full, staying decorator/metadata/transform free,
and integrating ordinary TypeScript/JavaScript functions, classes, and modules?

## Scope and method

This report compares the current repository design with Typed Inject, Awilix,
Effect Context/Layer/Scope, InversifyJS, TSyringe, and one additional contender:
Snapchat's `@snap/ts-inject`. The additional library is justified because its
decorator-free `PartialContainer` explicitly models provided and still-required
services, making it directly relevant to typed module extensibility.

Sources are first-party documentation, manifests, and upstream source. “Type
safe” is separated into two materially different guarantees:

- **Declared graph closure:** every declared requirement has a compatible
  provider before resolution/execution.
- **Typed token lookup:** a registration or `resolve<T>` call has a useful local
  type, but the compiler does not prove the complete graph.

No benchmark or unqualified “best” claim is made. Effect is in transition: the
current manifest identifies `4.0.0-rc.112`, while its detailed service guides are
published under v3. The Effect discussion therefore uses current source for type
signatures and the v3 guides only for the stable conceptual model. See Effect's
[manifest](https://github.com/Effect-TS/effect/blob/main/packages/effect/package.json),
[`Effect` source](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts),
and [service guide](https://effect.website/docs/v3/requirements-management/services).

## Executive findings

1. `di-bag` has an unusual declared-graph check: one object-parameter type,
   forward registration references, and an `.end()` closure boundary. It is not
   a complete soundness proof. Known accepted structural-narrowing,
   disposal-descriptor, and required-`this` cases qualify the guarantee.

2. Typed Inject and `@snap/ts-inject` also check declared dependencies, but
   ordinary providers need explicit ordered token tuples and already-available
   dependencies. `@snap/ts-inject` adds a typed open-module escape hatch.

3. Awilix, Inversify, and TSyringe primarily provide typed lookup surfaces.
   Missing providers and cross-registration inconsistency remain runtime
   concerns. Richer runtime features do not imply compile-time graph closure.

4. Effect provides the strongest reviewed model for compositional requirements
   and scoped async resources. Its inference comes from typed tags, yielded
   Effects, and `Layer<Provides, Error, Requires>` values—not from erased
   JavaScript parameter types.

5. The promising extension seam is an immutable typed provider/module
   description plus a small lifecycle runtime. Keep plain values at consumer
   boundaries and keep static metadata, acquisition results, and per-scope state
   distinct.

6. Type-system scalability is already a release concern. Under the repository's
   strict fixture options and pinned TypeScript 5.9.3, generated single-map
   `.add()` cases with 20, 50, and 100 number-valued providers produced no
   diagnostics. Equivalent one-provider-per-`.add()` chains produced zero
   diagnostics at 20, 11 TS2589 excessive-instantiation diagnostics at 50, and
   161 at 100. This local result is not a cross-library benchmark and does not
   prove a root cause; it establishes the need for explicit compiler-scale
   acceptance tests before adding more type algebra.

## Static-safety comparison

| System | Compile-time guarantee | Dependency declaration | Missing dependency | Decorator-free ordinary-code path |
|---|---|---|---|---|
| `di-bag` v0.1 | Declared closure under supported shapes; not fully sound. Forward references are allowed. Chained builder types currently hit TS2589 at moderate generated sizes. | One finite object parameter type; no runtime token list. | Recognized mismatch at `.add()`; declared missing key at `.end()`. | Functions directly; classes through a factory such as `({x}) => new C(x)`. |
| Typed Inject | Current-context availability and positional compatibility are checked. Normal registration is ordered. | `static inject`/`fn.inject`: ordered `as const` string tuple plus parameter types. | Provider/injection call fails to type-check. | Functions and classes; no decorators, but dependent consumers need the tuple. |
| Awilix | Inferred cradle output, not complete consumer/provider reconciliation. | Proxy property reads or runtime parsing of positional names in `CLASSIC`. | Runtime resolution. | Functions/classes; proxy mode needs no list, classic needs stable names. |
| Effect | Remaining tagged requirements are tracked in `R`/`RIn`; execution requires closure. | Yield/compose typed service keys and Effects. | Provision or runner boundary fails to type-check. | Implementations can be ordinary values, but use/acquisition cross Effect APIs. |
| InversifyJS | Generic binding/lookup calls, not one enforced registry map. | Legacy constructor metadata/decorators, or explicit identifiers in factories. | Runtime planning/resolution. | Values/dynamic factories; `toResolvedValue` takes an ordered token list. |
| TSyringe | Generic token/provider calls, not accumulated graph closure. | Decorated constructor metadata; interfaces/primitives use parameter `@inject`. | Runtime resolution. | Values/factories; dependency-bearing direct classes need metadata/decorators. |
| `@snap/ts-inject` | Complete containers check current-key availability; `PartialContainer<Provides, Requires>` tracks open requirements. | Ordered tuple for factories; `static dependencies` for classes. | Registration or partial-container installation fails to type-check. | Functions/classes without decorators, but with explicit tuples. |

The repository baseline is documented in its [README](../../README.md) and
[v0.1 design](../superpowers/specs/2026-09-06-v0.1-design.md). The current
limitations above are important: “declared closure under supported shapes” is
the defensible claim, not “all incompatible TypeScript programs are rejected.”

## What the systems actually support

### Typed Inject

`Injector<TContext>` is an accumulating token-to-value type. An injectable's
readonly token tuple is checked against both the current context and positional
parameter types; `provideClass`/`provideFactory` return a child injector with an
extended context. This is real provider checking, but it duplicates dependency
identity beside parameter types and makes normal construction dependency-order
sensitive. The [upstream API documentation](https://github.com/nicojs/typed-inject#api)
contains deliberate negative type examples.

The runtime offers singleton (default) and transient providers plus child
injectors. It structurally calls `dispose()` on class/factory-created services,
closes children first, and awaits async disposers; values and one-off injection
results are not owned. Resolution itself remains synchronous in shape, so a
Promise may be the service rather than participating in graph-aware async
acquisition. The package is ESM, declares Node 18+, has no runtime dependencies,
and asks for `strictFunctionTypes`; see [lifecycle documentation](https://github.com/nicojs/typed-inject#disposing-provided-stuff)
and the [manifest](https://github.com/nicojs/typed-inject/blob/master/package.json).

### Awilix

Awilix injects ordinary classes/functions through a proxy cradle, or parses
runtime parameter names in `CLASSIC` mode. Its own docs warn that classic mode
is unsafe under minification. `InferCradleFromResolvers` usefully infers
provider outputs, but consumer requirements are not reconciled with that map;
the proxy delegates to runtime resolution. See [injection modes](https://github.com/jeffijoe/awilix#injection-modes),
[`container.ts`](https://github.com/jeffijoe/awilix/blob/master/src/container.ts),
and [`resolvers.ts`](https://github.com/jeffijoe/awilix/blob/master/src/resolvers.ts).

Transient, scoped, and singleton lifetimes are built in. Strict mode performs
runtime lifetime-leak and registration checks. Resolver descriptors can carry
explicit async disposers for cached values; disposing a container clears its own
cache and does not cascade to child scopes. Awilix also supplies aliases, local
injections, scopes, inspection, and glob module loading. Those dynamic features
are useful but cannot honestly join a compile-time proof of a statically unknown
plugin set. The current [manifest](https://github.com/jeffijoe/awilix/blob/master/package.json)
publishes Node/browser variants, requires Node 20 for its Node package, and lists
`fast-glob` as a runtime dependency.

### Effect Context, Layer, and Scope

Effect's core types are conceptually:

```ts
Effect<Value, Error, Requirements>
Layer<Provides, Error, Requires>
```

A `Context.Service<Identifier, Shape>` key is a typed service identity. Yielding
that key in `Effect.gen` both retrieves the service and contributes its
identifier to the program's inferred requirements. `Layer.effect` carries the
construction Effect's requirements; merging layers unions requirements and
outputs; providing a layer subtracts its outputs while retaining what the layer
itself still needs. Runners accept Effects with no remaining `R`. These
relationships are visible in [`Context.Service`](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Context.ts),
[`Effect.gen`, `provide`, and runner signatures](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts),
and the [`Layer` algebra](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Layer.ts).

That is compositional graph closure, not parameter introspection. An ordinary
`(database: Database) => ...` signature is erased; Effect can infer `Database`
only when code performs a typed service operation whose requirement remains in
the Effect value. Service implementations may still be ordinary objects,
functions, or class instances.

Layers model lazy sync/async acquisition and memoization. Scopes own finalizers;
sequential finalizers run in reverse registration order, and nested scopes have
defined parent/child closure behavior. Layers are also replaceable module/test
units. This is powerful lifecycle evidence, but adopting it wholesale would
also adopt Effects, typed failures, interruption, and explicit tags as an
application programming model. See [`Scope.ts`](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Scope.ts),
the [layers guide](https://effect.website/docs/v3/requirements-management/layers),
and [direct service mocking](https://effect.website/docs/v3/requirements-management/layers#mocking-the-service-directly).

### InversifyJS

Inversify types individual `bind<T>(id)` and `get<T>(id)` calls, but a string or
symbol identifier does not enforce one registry-wide `T`; closure is planned at
runtime. Its conventional class path uses `@injectable`, parameter `@inject`,
and `emitDecoratorMetadata`. Decorator-free values and dynamic factories exist;
`toResolvedValue(factory, identifiers)` is the stronger factory form and can
await async dependencies, at the cost of an ordered token list. See the
[Container API](https://inversify.io/docs/api/container/),
[decorator API](https://inversify.io/docs/api/decorator/), and
[`toResolvedValue`](https://inversify.io/docs/api/binding-syntax/#toresolvedvalue).

It provides transient, singleton, and request caching, sync/async resolution,
activation/deactivation, container modules, parent containers, snapshots, and a
plugin API. Deactivation is singleton binding/unload oriented rather than a
general owned-resource scope close. A documented `jitless` mode supports CSP;
optional JIT needs `Function`/`unsafe-eval`. TypeScript's standard decorators are
incompatible with `emitDecoratorMetadata` and do not permit parameter
decorators, reinforcing why this legacy path should not be fundamental to
`di-bag`; see the official [TypeScript 5.0 decorator notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html#differences-with-experimental-legacy-decorators).

### TSyringe

TSyringe requires legacy decorators, emitted metadata, and a Reflect metadata
polyfill; its Babel route adds a metadata transform. Generic `register<T>` and
`resolve<T>` calls remain local assertions rather than an accumulated registry
proof. Factory providers avoid decorators but receive the whole container, so
their requirements become unrestricted service-locator calls. A zero-argument
class can be built without metadata; current source throws `TypeInfo not known`
for a dependency-bearing class whose metadata was not populated. See the
[upstream setup/API](https://github.com/microsoft/tsyringe#installation) and
[`dependency-container.ts`](https://github.com/microsoft/tsyringe/blob/master/src/dependency-container.ts).

It includes transient, singleton, resolution, and container scopes, child
containers, interceptors, aliases, and multiple bindings. Disposal is
structural for instances created through its constructor path, is awaited in
parallel, and does not include current factory/value results because those
bypass `construct`. The [manifest](https://github.com/microsoft/tsyringe/blob/master/package.json)
publishes CommonJS and ESM variants and depends on `tslib`.

### Additional contender: `@snap/ts-inject`

A `Container<Services>` restricts `get` to known keys and checks each normal
factory/class tuple against services already present. More unusually,
`PartialContainer<Provides, Requires>` can remain open but cannot resolve; it
can be installed only into a host satisfying `Requires`. Containers can merge,
copy selected tokens into a new memoization scope, append type-checked array
contributions, and eagerly `run` selected services. See [`Container.ts`](https://github.com/Snapchat/ts-inject/blob/main/src/Container.ts),
[`PartialContainer.ts`](https://github.com/Snapchat/ts-inject/blob/main/src/PartialContainer.ts),
and the [composition examples](https://github.com/Snapchat/ts-inject#sample-usage).

These are strong typed-module and contribution ideas, but dependency tuples are
still duplicated runtime metadata. The current implementation memoizes all
services and documents no transient lifetime, ownership/disposal API, or
structured async acquisition. A Promise can be a memoized service, but startup
and cleanup are not sequenced as an async resource graph. The
[manifest](https://github.com/Snapchat/ts-inject/blob/main/package.json)
publishes CommonJS/ESM, marks the package side-effect-free, and lists no runtime
dependencies.

## Cross-cutting interpretation

### Erasure sets an honest boundary

Without a decorator, transform, metadata, stable parameter-name convention, or
explicit token operation, runtime JavaScript cannot recover the identity of an
erased interface parameter. The reviewed bridges are:

1. object property names plus a proxy (`di-bag`, Awilix proxy mode);
2. ordered runtime tuples (Typed Inject, `@snap/ts-inject`, Inversify factory);
3. legacy decorator metadata/tokens (Inversify and TSyringe class paths); or
4. typed service operations embedded in a program value (Effect).

A completely ordinary class can therefore remain ordinary through a factory:

```ts
({ database, logger }: Deps) => new Service(database, logger)
```

Direct positional/class adapters must honestly introduce a checked token tuple,
static dependency property, or equivalent explicit graph-authoring protocol.
Dependency metadata cannot be assumed available at runtime merely because a
provider descriptor exists; it is optional unless the chosen API records it.

### Typed modules can preserve closure

A static module can carry `Module<Provides, Requires>`. Composition unions
providers and subtracts satisfied requirements; only a closed module or a host
satisfying `Requires` becomes resolvable. Effect Layers and Snap PartialContainers
demonstrate this algebra. It can support private implementations, typed exports,
test substitutions, and array/set contributions without forcing registration
order.

Runtime-discovered globs/configuration cannot receive the same promise because
TypeScript cannot prove which code will load. Treat that as an explicit runtime
validation boundary rather than weakening the static API's meaning.

### Separate description, acquisition, and state

Three concerns should not become one mutable universal box:

- immutable provider description: key, factory, any explicitly authored
  requirements, lifetime/eager policy, and cleanup policy;
- acquisition result: value or in-flight Promise, error, and observed edges;
- per-scope state: presence-aware cache, ownership, closing state, ordering,
  and parent/share relationships.

Consumers should receive plain values. The project's history already sketched
factory/resolver plugins and `SasBox<ValBox<...>>` in
[the historical design](../../final-design.md), while archived v12 exposed
`values`, `metadata`, and `boxes` separately in
[`FactoryArgs`](../history/src/pattrern-next-version-v12.ts). The useful lesson
is capability and state separation, not mandatory nesting. The current runtime's
`Map.has` already distinguishes absence from presence with `undefined`.

Prior parent-reproduced primary-package audits also counsel against direct reuse:

- `sas-box@0.0.7` declares a nested `Promise<Promise<T>>` case where runtime
  Promise assimilation yields `Promise<T>`; see the [published tarball](https://registry.npmjs.org/sas-box/-/sas-box-0.0.7.tgz).
- In `val-box@0.0.12`, the audited metadata assertions consult `hasValue`, and
  `convert({ hasValue: true })` changed an existing numeric value `42` to
  `null`; see the [published tarball](https://registry.npmjs.org/val-box/-/val-box-0.0.12.tgz).

Those findings motivate repairing or reimplementing before reuse, not discarding
the concepts. A sync/async/dual adapter can describe acquisition capabilities;
it must not make async I/O synchronous. Promise flattening, shared memoization,
and exactly-once ownership must be explicit.

### Ownership and startup are separate policies

The reviewed systems show four patterns: structural disposal (Typed Inject,
TSyringe), explicit resolver disposers (Awilix), scope finalizers (Effect), and
binding deactivation (Inversify). `di-bag.withDisposal(create, dispose)` has the
useful property that ownership is opted into instead of inferred from a method
name. Preserve owned-versus-borrowed intent and dependency-aware shutdown.
`Symbol.dispose`/`Symbol.asyncDispose` can be opt-in adapters; the
[TC39 explicit-resource-management repository](https://github.com/tc39/proposal-explicit-resource-management)
is interoperability input, not a reason to claim every matching object.

Exact sync/Promise service types need not be erased to add eager startup. A
separate async `start()`/`initialize(tokens)` can acquire eager providers while
`resolve` retains exact return types. Its contract must address partial-startup
cleanup, retry, timeout/cancellation, and owned resource transfer. Effect
demonstrates the comprehensive model; a DI library can choose a narrower one.

## Design recommendations (proposals, not decisions)

1. **Harden the current proof before expanding it.** Turn every known accepted
   loophole into compile-negative acceptance tests, retain positive cases, and
   add generated 20/50/100-provider single-map and chained-builder scale gates.
   Investigate TS2589 without claiming the nested merge type is proven causal.

2. **Preserve the semantic safety target.** Keep forward references and a final
   closure boundary; describe guarantees narrowly as declared closure under
   supported shapes until unsound cases are fixed.

3. **Keep object-parameter factories primary.** They give ordinary code a
   zero-duplication path. Offer checked token tuples only as optional adapters
   for positional functions and direct class construction.

4. **Build a small descriptor/runtime core.** Normalize provider forms into
   immutable policy descriptions, but keep acquisition results, dependency
   observations, memoization, and ownership in per-bag/per-scope state.

5. **Prototype typed static modules before dynamic plugins.** Evaluate
   `Module<Provides, Requires>`, private providers/export views, checked
   overrides, and contribution collections. Runtime-loaded plugins need a
   separately named, runtime-validated escape hatch.

6. **Evolve lifetimes and eager startup orthogonally.** Preserve exact
   synchronous resolution, explicit owned/borrowed cleanup, and dependency-aware
   disposal. Define cache sharing and lifetime-leak rules before adding scopes.

7. **Borrow Effect's algebra selectively.** Provides/requires subtraction,
   scoped acquisition, and closure at execution are applicable; requiring all
   consumers to yield Effects would conflict with ordinary-code integration.

8. **Treat `SasBox`/`ValBox` as concepts, not required wrappers.** Their
   acquisition-capability and typed-metadata ideas may support optional adapters,
   but audited type/runtime mismatches must be corrected before reuse.

No API change is approved by this report. In particular, whether a justified
async-related API break is acceptable remains a product decision, not a
research conclusion.

## Suggested acceptance sequence

1. soundness regressions and compiler-scale gates;
2. typed reusable modules with open requirements and export views;
3. checked direct-class/positional-function adapters;
4. eager startup over the exact sync/Promise model;
5. lifetimes, ownership rules, and leak validation;
6. typed contribution collections and test overrides;
7. runtime validation for genuinely dynamic plugins.

## Primary source index

- `di-bag`: [README](../../README.md), [v0.1 design](../superpowers/specs/2026-09-06-v0.1-design.md)
- Typed Inject: [README](https://github.com/nicojs/typed-inject), [manifest](https://github.com/nicojs/typed-inject/blob/master/package.json)
- Awilix: [README](https://github.com/jeffijoe/awilix), [`container.ts`](https://github.com/jeffijoe/awilix/blob/master/src/container.ts), [`resolvers.ts`](https://github.com/jeffijoe/awilix/blob/master/src/resolvers.ts), [manifest](https://github.com/jeffijoe/awilix/blob/master/package.json)
- Effect: [`Effect.ts`](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts), [`Context.ts`](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Context.ts), [`Layer.ts`](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Layer.ts), [`Scope.ts`](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Scope.ts), [services guide](https://effect.website/docs/v3/requirements-management/services), [layers guide](https://effect.website/docs/v3/requirements-management/layers)
- InversifyJS: [binding](https://inversify.io/docs/fundamentals/binding/), [binding API](https://inversify.io/docs/api/binding-syntax/), [container API](https://inversify.io/docs/api/container/), [decorators](https://inversify.io/docs/api/decorator/), [lifecycle](https://inversify.io/docs/fundamentals/lifecycle/deactivation/)
- TSyringe: [README](https://github.com/microsoft/tsyringe), [container source](https://github.com/microsoft/tsyringe/blob/master/src/dependency-container.ts), [manifest](https://github.com/microsoft/tsyringe/blob/master/package.json)
- `@snap/ts-inject`: [README](https://github.com/Snapchat/ts-inject), [`Container.ts`](https://github.com/Snapchat/ts-inject/blob/main/src/Container.ts), [`PartialContainer.ts`](https://github.com/Snapchat/ts-inject/blob/main/src/PartialContainer.ts), [manifest](https://github.com/Snapchat/ts-inject/blob/main/package.json)
- Platform: [TypeScript 5.0 decorators](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html), [TC39 explicit resource management](https://github.com/tc39/proposal-explicit-resource-management)
