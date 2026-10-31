# Comparison with alternatives {#choosing-a-dependency-injection-approach}

[README](../../README.md) · [Tutorial](tutorial.md) · [API reference](api-reference.md)

DI Bag's distinguishing check is that a missing or mismatched dependency fails `tsc`, naming
the service, before any container exists; most of the alternatives below find it when the
service is first resolved. The other differences are object-parameter factories, modules with
private services, and explicit ownership of what each container acquired.

```ts
import { DiBag } from 'di-bag';

type Db = { query(sql: string): Promise<readonly unknown[]> };

const builder = DiBag.createBuilder().withServices({
  repository: ({ db }: { db: Db }) => ({ list: () => db.query('select 1') }),
});

// @ts-expect-error required services are missing: db
builder.buildContainer();
```

The message is `required services are missing: db`; `builder.verifyGraphAtCompileTime() satisfies void;` reports it without building. See the [error index](../agent/errors.md#missing-service).

| Alternative | Reasons to choose it | DI Bag's different emphasis |
| --- | --- | --- |
| [Manual dependency injection](#plain-functions-and-constructors) | Direct function calls may be all a small application needs. TypeScript checks their arguments. | Adds lazy caching, graph-wide composition checks, child containers, and coordinated disposal. |
| [Awilix](#awilix) | Function and class registration, inferred cradle types, lifetime options, and runtime strict checks. | Checks declared factory requirements against the registrations at compile time. |
| [InversifyJS](#inversifyjs) / [TSyringe](#tsyringe) | Token and class-oriented containers; Inversify also offers decorator-free factory bindings and awaited async resolution. | Starts with object-parameter factories and immutable builders; checks accumulated graph contracts. |
| [Typed Inject](#typed-inject) | A close alternative with compile-time dependency checks, explicit dependency tuples, child injectors, and disposal. | Adds object-parameter dependencies, forward references, private module exports, and selected service readiness with rollback. |
| [Effect Context / Layer](#effect-context-and-layer) | Typed requirements, scoped resources, and composition within Effect's broader async and error model. | Keeps ordinary `T` and `Promise<T>` service values and explicit container ownership. |
| [NestJS / Angular DI](#nestjs-and-angular) | Their native containers connect directly to framework components, testing tools, and lifecycles. | Provides standalone composition; applications supply the framework integration. |

These are reasons to consider it, not exclusive features. Other libraries also
support decorator-free composition, compile-time dependency checks, async
factories, and disposal. The choice depends on which contracts and programming
style your application needs.

"Modules as units of work" describes small features with explicit contracts that can
be composed and tested independently. The
[modularity examples](examples-modularity.md) and the
[module layout](../../AGENTS.md#module-layout) show why it can suit work divided
among coding agents: each feature exposes a contract, keeps helpers private, and
can be tested with replacement dependencies. Test cross-feature behavior at the
integration boundary. Metadata inspection supplies application-defined data,
not reflection over erased TypeScript types.

This guide reviews selected alternatives against their official documentation and
public source on **2026-10-31**. Effect links explicitly target its v3 guides.
Upstream default-branch sources can change; this is not a benchmark, a release
certification, or an exhaustive feature audit. Recommendations below are judgments
based on the cited behavior.

Versions reviewed: Awilix 13.0.5, InversifyJS 8.2.3, TSyringe 4.10.0,
Typed Inject 5.0.0, Effect 3.22.4 (the v3 line the links target). Source links
for Awilix and Typed Inject use the tag of that version; the TSyringe source
links stay on the default branch because no tag URL resolved.

## What “type-safe” means here

A typed lookup tells TypeScript what `resolve('database')` returns. Checking
composition additionally proves that the declared dependencies have compatible
providers before a container can be built. DI Bag retains those requirements through
registration, modules, and checked replacement, then checks completeness at
`buildContainer()`. Its
[public builder signatures](../../src/di-bag.ts) encode that distinction.

This only covers dependencies expressed through the supported types. It cannot
validate arbitrary JavaScript, dishonest casts, external data, or the behavior of
a factory. Dependency cycles are detected at resolution, or before running by [`di-bag-graph`](../../tools/graph/README.md), and factory failures
remain possible after compilation. See [boundaries](tutorial.md#boundaries) and
[async behavior](tutorial.md#async-edges-are-explicit).

## Summary by library

Reviewed 2026-10-31. Each filled cell links the sentence it summarizes; blank
cells are not stated in the sources cited below.

| | Missing dependency found | Async dependency | Who closes child containers | Decorators |
| --- | --- | --- | --- | --- |
| DI Bag | [`tsc` at `buildContainer()` / `verifyGraphAtCompileTime()`](#what-type-safe-means-here) | [`Promise<T>` service, consumer awaits](#costs-and-limits-of-choosing-di-bag) | [Parent closes tracked children](#awilix) | [None](#what-type-safe-means-here) |
| Awilix | [Resolution; strict mode checks lifetimes at runtime](#awilix) | | [Caller](#awilix) | [None](#awilix) |
| InversifyJS | [Resolution](#inversifyjs) | [`getAsync` awaits](#inversifyjs) | | [Optional](#inversifyjs) |
| TSyringe | [Not checked statically](#tsyringe) | [`Promise<T>` value, not awaited](#tsyringe) | | [Documented setup uses emitted decorator metadata](#tsyringe) |
| Typed Inject | [`tsc`, in registration order](#typed-inject) | [`Promise<T>` value](#typed-inject) | [Child-first `dispose()`](#typed-inject) | [None](#typed-inject) |
| Effect | [Program type](#effect-context-and-layer) | | [Scoped resource finalization](#effect-context-and-layer) | |

## Alternatives worth considering

### Plain functions and constructors

Start here if your application has a small, stable composition root. Passing a
database to a repository constructor is already dependency injection, and ordinary
TypeScript calls check argument types. You can await initialization and arrange
disposal yourself without adding a container. [TypeScript function checking](https://www.typescriptlang.org/docs/handbook/2/functions.html).

DI Bag becomes useful when repeated wiring, lazy caching, substitutions, or
resource ownership justify a shared abstraction. Manual composition keeps those
policies visible in application code; a container gives you reusable policies but
adds an API to learn.

### Awilix

Awilix is a close fit for services that accept an object of dependencies. It
supports functions and classes without decorators, three lifetimes, child containers,
mutable registration, and file-based registration. Its current API can infer
cradle output types from chained registrations. Strict mode checks problematic
lifetime capture at runtime. [Awilix documentation](https://github.com/jeffijoe/awilix#readme).

That inference does not retain and verify every factory's dependency requirements:
the [registration signatures](https://github.com/jeffijoe/awilix/blob/v13.0.5/src/container.ts)
accumulate resolver outputs. DI Bag adds checking of declared requirements and
replacements. Ownership also differs: Awilix disposes its own cached scoped or
singleton values; callers dispose child containers separately. DI Bag's parent closes
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
its declared graph before building and creates new containers for replacements. Also,
Inversify's “request” lifetime means one resolution operation, not an HTTP request;
deactivation handlers apply to singleton bindings. [Lookup behavior](https://inversify.io/docs/api/container/),
[lifetime documentation](https://inversify.io/docs/fundamentals/binding/#scope),
[deactivation](https://inversify.io/docs/api/binding-syntax/#ondeactivation).

### TSyringe

TSyringe fits a class-oriented application that prefers constructor decorators.
It documents singleton, transient, resolution-scoped, and container-scoped
lifetimes, child containers, interception, and disposal of container-created
disposable instances. Its documented setup uses emitted decorator metadata and a
Reflect polyfill. [TSyringe documentation](https://github.com/microsoft/tsyringe#readme).

Its generic registration and resolution methods do not accumulate a statically
complete graph. Factories can return a `Promise<T>`, but this is a service value,
not automatic awaiting of each dependency or a readiness barrier. DI Bag likewise
preserves Promise-valued services, while providing explicit service readiness and ownership
APIs. [Container interface](https://github.com/microsoft/tsyringe/blob/master/src/types/dependency-container.ts),
[factory provider](https://github.com/microsoft/tsyringe/blob/master/src/providers/factory-provider.ts).

### Typed Inject

Typed Inject is a direct alternative when compile-time dependency checking and
avoiding decorators matter. Its typed injector accumulates available services and
checks ordered dependency tuples against that context. Dependencies normally need
to be provided before their consumers. DI Bag's object-parameter factories can be
registered in any order before finalization. [Typed Inject interface](https://github.com/nicojs/typed-inject/blob/v5.0.0/src/api/Injector.ts).

Typed Inject offers singleton/transient caching and child-first disposal of
instances created by registered classes or factories when they implement
`dispose()`. Values supplied through `provideValue` remain caller-owned.
Factory results can also be Promises. Detecting `dispose()` on a returned Promise differs from
owning the resource it eventually fulfills with. DI Bag makes that ownership
explicit and adds selected service readiness with rollback. [Disposal and lifetimes](https://github.com/nicojs/typed-inject#readme),
[factory result handling](https://github.com/nicojs/typed-inject/blob/v5.0.0/src/InjectorImpl.ts).

### Effect Context and Layer

Effect already tracks required services in program types and composes their
construction with Layers. It also supplies typed errors, interruption, and scoped
resource finalization. If your application uses Effect, Layers are a natural
starting point; a second container may add little. [Effect type](https://effect.website/docs/v3/getting-started/the-effect-type),
[Layers](https://effect.website/docs/v3/requirements-management/layers),
[resource management](https://effect.website/docs/v3/resource-management/scope).

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

- **Lifetimes.** An unmarked DI Bag provider is scoped, with one instance per container. Choose
  `'singleton:one-per-container-tree'` to share one instance across a container tree,
  `'scoped:one-per-container'` for one instance per container, or
  `'transient:one-per-resolve'` for a new instance at each resolution. The compiler
  rejects a singleton that depends on a scoped service unless that
  registration sets `allowsScopedDependencies: true`, and it names both services:
  `singleton lifetime cannot capture scoped dependency: <singleton> -> <scoped>`.
  It also rejects a child container replacement of a singleton.
- **Explicit async edges.** Consumers declare and await Promise-valued
  dependencies. There is no transparent conversion of every dependency to its
  fulfilled value. See [async services](tutorial.md#async-edges-are-explicit).
- **Explicit disposal.** Ordinary factory results are borrowed until you attach
  ownership with `DiBag.providerWithDisposal`. Cancellation is cooperative; work that never
  settles can keep disposal pending. See [resource ownership](tutorial.md#attach-disposal-with-providerwithdisposal).
- **Host integration is application work.** You connect child containers to HTTP requests,
  jobs, streams, and shutdown. DI Bag does not replace framework DI or include
  direct NestJS or Angular adapters. See the [server guide](server-integration.md).
- **Compiler and host requirements matter.** The minimum supported TypeScript
  version is 6.0.3. Very large registration expressions have measured compiler
  limits; bulk registration and modules can help. Portable hosts require explicit
  factory return kinds or a trusted Promise predicate. See
  [compiler scale](../benchmarks/typescript.md) and [portable mode](tutorial.md#portable-mode).
- **Release status matters.** DI Bag's API is pre-1.0.
  Review its [installation instructions](../../README.md#install) and
  validate your application's integration before adoption. Feature breadth alone
  does not establish production history or ecosystem maturity.

The repository's [performance measurements](development.md#performance-evidence)
have specific workloads and exclusions;
they do not establish that DI Bag is universally faster than these alternatives.
