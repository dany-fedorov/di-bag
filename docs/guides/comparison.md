# Choosing a dependency injection approach

[README](../../README.md) · [Tutorial](tutorial.md) · [API reference](api-reference.md)

DI Bag is a good fit when you want ordinary TypeScript factories, checked
composition, and explicit ownership of resources across requests, jobs, or tests.
Its useful combination is named object dependencies, checked replacements and
module boundaries, inspectable metadata, configurable provider policies, lazy
creation, tracked child scopes, and startup with rollback. See the
[worked examples](../../README.md#why-di-bag) and [tutorial](tutorial.md).

These are reasons to consider it, not exclusive features. Other libraries also
support decorator-free composition, compile-time dependency checks, async
factories, and cleanup. The choice depends on which contracts and programming
style your application needs.

“Radical modularity” describes small features with explicit contracts that can
be composed and tested independently. The
[modularity examples](examples-modularity.md) show why it can suit work divided
among coding agents: each feature exposes a contract, keeps helpers private, and
can be tested with replacement dependencies. Test cross-feature behavior at the
integration boundary. Metadata inspection supplies application-defined data,
not reflection over erased TypeScript types.

This guide reviews selected alternatives against their official documentation and
public source on **2026-09-10**. Effect links explicitly target its v3 guides.
Upstream default-branch sources can change; this is not a benchmark, a release
certification, or an exhaustive feature audit. Recommendations below are judgments
based on the cited behavior.

## What “type-safe” means here

A typed lookup tells TypeScript what `resolve('database')` returns. Checking
composition additionally proves that the declared dependencies have compatible
providers before a bag can be built. DI Bag retains those requirements through
registration, modules, and checked replacement, then checks completeness at
`build()` or `buildAndStart()`. Its
[public builder signatures](../../src/di-bag.ts) encode that distinction.

This only covers dependencies expressed through the supported types. It cannot
validate arbitrary JavaScript, dishonest casts, external data, or the behavior of
a factory. Dependency cycles are detected during resolution, and factory failures
remain possible after compilation. See [boundaries](tutorial.md#boundaries) and
[async behavior](tutorial.md#async-edges-are-explicit).

## Alternatives worth considering

### Plain functions and constructors

Start here if your application has a small, stable composition root. Passing a
database to a repository constructor is already dependency injection, and ordinary
TypeScript calls check argument types. You can await initialization and arrange
cleanup yourself without adding a container. [TypeScript function checking](https://www.typescriptlang.org/docs/handbook/2/functions.html).

DI Bag becomes useful when repeated wiring, lazy caching, substitutions, or
resource ownership justify a shared abstraction. Manual composition keeps those
policies visible in application code; a container gives you reusable policies but
adds an API to learn.

### Awilix

Awilix is a close fit for services that accept an object of dependencies. It
supports functions and classes without decorators, three lifetimes, child scopes,
mutable registration, and file-based registration. Its current API can infer
cradle output types from chained registrations. Strict mode checks problematic
lifetime capture at runtime. [Awilix documentation](https://github.com/jeffijoe/awilix#readme).

That inference does not retain and verify every factory's dependency requirements:
the [registration signatures](https://github.com/jeffijoe/awilix/blob/master/src/container.ts)
accumulate resolver outputs. DI Bag adds checking of declared requirements and
replacements. Ownership also differs: Awilix disposes its own cached scoped or
singleton values; callers dispose child scopes separately. DI Bag's parent closes
tracked children. Compare that behavior with your request lifecycle before
choosing. [Awilix disposal](https://github.com/jeffijoe/awilix#disposing).

### InversifyJS

Consider Inversify when you need contextual bindings, multiple bindings per
identifier, or a mutable registry with module load/unload and snapshots. Its
factory bindings can be used without decorators; decorator-based constructor
injection is another supported style. Async bindings can await dependencies before
passing values to consumers through `getAsync`. [Container API](https://inversify.io/docs/api/container/),
[binding syntax](https://inversify.io/docs/api/binding-syntax/),
[async bindings](https://inversify.io/docs/fundamentals/binding/#asynchronously-resolved-bindings).

Inversify's typed bindings and lookups do not prove complete registration of the
graph; missing or ambiguous bindings can fail at resolution. DI Bag instead checks
its declared graph before building and creates new bags for replacements. Also,
Inversify's “request” scope means one resolution operation, not an HTTP request;
deactivation handlers apply to singleton bindings. [Lookup behavior](https://inversify.io/docs/api/container/),
[scopes](https://inversify.io/docs/fundamentals/binding/#scope),
[deactivation](https://inversify.io/docs/api/binding-syntax/#ondeactivation).

### TSyringe

TSyringe fits a class-oriented application that prefers constructor decorators.
It documents singleton, transient, resolution-scoped, and container-scoped
lifetimes, child containers, interception, and disposal of container-created
disposable instances. Its documented setup uses emitted decorator metadata and a
Reflect polyfill. [TSyringe documentation](https://github.com/microsoft/tsyringe#readme).

Its generic registration and resolution methods do not accumulate a statically
complete graph. Factories can return a `Promise<T>`, but this is a service value,
not automatic awaiting of each dependency or a startup barrier. DI Bag likewise
preserves Promise-valued services, while providing explicit startup and ownership
APIs. [Container interface](https://github.com/microsoft/tsyringe/blob/master/src/types/dependency-container.ts),
[factory provider](https://github.com/microsoft/tsyringe/blob/master/src/providers/factory-provider.ts).

### Typed Inject

Typed Inject is a direct alternative when compile-time dependency checking and
avoiding decorators matter. Its typed injector accumulates available services and
checks ordered dependency tuples against that context. Dependencies normally need
to be provided before their consumers. DI Bag's object-parameter factories can be
registered in any order before finalization. [Typed Inject interface](https://github.com/nicojs/typed-inject/blob/master/src/api/Injector.ts).

Typed Inject offers singleton/transient caching and child-first disposal of
instances created by registered classes or factories when they implement
`dispose()`. Values supplied through `provideValue` remain caller-owned.
Factory results can also be Promises. Detecting `dispose()` on a returned Promise differs from
owning the resource it eventually fulfills with. DI Bag makes that ownership
explicit and adds selected startup with rollback. [Disposal and scopes](https://github.com/nicojs/typed-inject#readme),
[factory result handling](https://github.com/nicojs/typed-inject/blob/master/src/InjectorImpl.ts).

### Effect Context and Layer

Effect already tracks required services in program types and composes their
construction with Layers. It also supplies typed errors, interruption, and scoped
resource finalization. If your application uses Effect, Layers are a natural
starting point; a second container may add little. [Effect type](https://effect.website/docs/v3/getting-started/the-effect-type),
[Layers](https://effect.website/docs/v3/requirements-management/layers),
[Scope](https://effect.website/docs/v3/resource-management/scope).

DI Bag fits ordinary synchronous and Promise-based service factories without
requiring Effect composition. Effect's broader execution model is valuable when
you also want those runtime capabilities. Adopting Layers does not mean every
service implementation must be rewritten: Layers can wrap ordinary construction.
[Layer constructors](https://effect.website/docs/v3/requirements-management/layers).

### NestJS and Angular

If the application already uses either framework, start with its built-in DI.
Nest's testing module creates controllers and providers in a framework test
environment. Angular's injector hierarchy connects service visibility and
lifetime to application environments and components.
[Nest testing](https://docs.nestjs.com/fundamentals/testing),
[Angular injector hierarchy](https://angular.dev/guide/di/hierarchical-dependency-injection).

DI Bag can compose ordinary services alongside a framework, but the application
must bridge those ownership boundaries. It does not include direct NestJS or
Angular adapters; the [integration recipes](enterprise-integration.md) explain
what a host would need to connect.

## Costs and limits of choosing DI Bag

- **Explicit async edges.** Consumers declare and await Promise-valued
  dependencies. There is no transparent conversion of every dependency to its
  fulfilled value. See [async services](tutorial.md#async-edges-are-explicit).
- **Explicit cleanup.** Ordinary factory results are borrowed until you attach
  ownership with `withDisposal`. Cancellation is cooperative; work that never
  settles can keep cleanup pending. See [resource ownership](tutorial.md#attach-cleanup-with-withdisposal).
- **Host integration is application work.** You connect scopes to HTTP requests,
  jobs, streams, and shutdown. DI Bag does not replace framework DI or include
  direct NestJS or Angular adapters. See the [server guide](server-integration.md).
- **Compiler and host requirements matter.** The minimum supported TypeScript
  version is 6.0.3. Very large registration expressions have measured compiler
  limits; bulk registration and modules can help. Portable hosts require explicit
  acquisition modes or a trusted Promise predicate. See
  [compiler scale](../benchmarks/typescript.md) and [portable mode](tutorial.md#portable-mode).
- **Release status matters.** This checkout describes the `0.1.0` release
  candidate. Review its [installation instructions](../../README.md#install) and
  validate your application's integration before adoption. Feature breadth alone
  does not establish production history or ecosystem maturity.

The repository's [performance measurements](development.md#performance-evidence)
have specific workloads and exclusions;
they do not establish that DI Bag is universally faster than these alternatives.
