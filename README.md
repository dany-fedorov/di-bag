# DI Bag

TypeScript dependency composition and resource ownership for modular codebases.
Built for coding agents that ship one feature at a time.

[Documentation](https://dany-fedorov.github.io/di-bag/) · [Quickstart](#quickstart) · [Modules as units of work](#modules-as-units-of-work) · [Comparison](#how-it-compares) · [Tutorial](docs/guides/tutorial.md) · [API reference](docs/guides/api-reference.md)

## Why DI Bag?

Compose ordinary TypeScript factories into reusable features. DI Bag checks
declared dependencies, keeps module internals private, and manages resource
creation and disposal. Build each feature against an explicit contract, test it
with replaced dependencies, and let the compiler check the composition when
independently developed features come together.

- **[Modules a single owner can build in isolation](docs/guides/examples-modularity.md).**
  A person or a coding agent implements one feature against its contract
  without exposing its internals or reading another feature's source.
- **[Compile-time wiring checks](docs/guides/examples-type-checking.md).**
  Catch missing dependencies and incompatible replacements before starting the app.
- **[Metadata inspection without creating services](docs/guides/examples-extensibility.md).**
  Build capability catalogs without running factories or opening clients.
- **[Inject anything with a simple factory function](docs/guides/examples-plain-services.md).**
  Supply functions, objects, clients, or promises without decorators or base classes.

## Install

Install [di-bag from npm](https://www.npmjs.com/package/di-bag):

```sh
npm install di-bag
```

The API is pre-1.0 and includes breaking changes, so review the changelog and
migration guides when updating.

The minimum supported TypeScript version is **6.0.3**; enable `strict` in your
`tsconfig.json`. The repository checks classic TypeScript 6.0.3 and native 7.0.2.
For browsers and workers, see [runtime support](#runtime-support).

## Quickstart

A **service** can be a configuration object, a database client, or a function.
A **factory** creates a service. A **container** resolves its factories' declared
dependencies. Services are created when needed. The container disposes owned
resources when you close it.

Import from `di-bag`. Here, `greeter` needs `config`. Its parameter
type describes that dependency, and its return value is the service it provides:

```ts
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder()
  .withServices({
    config: () => ({ greeting: 'Hello' }),
    greeter: ({ config }: { config: { greeting: string } }) => ({
      greet(name: string) {
        return `${config.greeting}, ${name}!`;
      },
    }),
  })
  .buildContainer();

const greeter = app.resolve('greeter');
console.log(greeter.greet('Ada')); // Hello, Ada!
await app.close();
```

`withServices({...})` adds factories to an immutable builder. `buildContainer()`
checks the declared graph and creates a container. `resolve('greeter')` creates
the greeter and its config on first use. The default scoped lifetime returns the
same greeter on later resolutions in this container. Provider order does not matter.

TypeScript knows that `greeter` has a `greet(name: string): string` method.
Removing the `config` factory makes `buildContainer()` a compile-time error. Changing
`greeting` to a number also fails the type check because the greeter needs a string.

## Swap a dependency for a test

Use `createIndependentContainer()` for a test with a replacement dependency.
This example uses the graph from the [quickstart](#quickstart):

```ts
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder().withServices({
  config: () => ({ greeting: 'Hello' }),
  greeter: ({ config }: { config: { greeting: string } }) =>
    ({ greet: (name: string) => `${config.greeting}, ${name}!` }),
}).buildContainer();

const testApp = app.createIndependentContainer(['config'], {
  config: () => ({ greeting: 'Hi' }),
});

try {
  console.log(testApp.resolve('greeter').greet('Ada')); // Hi, Ada!
  console.log(app.resolve('greeter').greet('Ada')); // Hello, Ada!
} finally {
  await testApp.close();
  await app.close();
}
```

The replacement must satisfy the original service contract. Each independent
container owns its own acquisitions and disposal. Close it separately. Factories
can still return shared objects captured outside the container.

## Work with async services

An async factory provides a promise. Declare that promise in any dependent
factory and await it where you need the value:

```ts
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder()
  .withServices({
    greeting: async () => 'Hello',
    message: async ({ greeting }: { greeting: Promise<string> }) =>
      `${await greeting}, Ada!`,
  })
  .buildContainer();

console.log(await app.resolve('message')); // Hello, Ada!
await app.close();
```

Within one container, repeated resolutions share the same pending promise. Synchronous
factories keep returning ordinary values. See
[async behavior](docs/guides/tutorial.md#async-edges-are-explicit) for details.

## Give resources a clear owner

Use `DiBag.providerWithDisposal` to tell the container how to release a factory's result:

```ts
import { DiBag } from 'di-bag';

const resources = DiBag.createBuilder()
  .withServices({
    cache: DiBag.providerWithDisposal({
      provider: () => new Map<string, string>(),
      disposeService: cache => cache.clear(),
    }),
  })
  .buildContainer();

try {
  resources.resolve('cache').set('answer', '42');
} finally {
  await resources.close();
}
```

The same pattern works for connections, clients, and subscriptions. Disposal can
be asynchronous. Dependents close before their dependencies, and resources that
were never created need no disposal. Ordinary factories return borrowed values.
Having a `close()` method alone does not transfer ownership to the container.

## Child and independent containers {#child-and-independent-containers}

| Operation | What it creates | Who closes it? |
| --- | --- | --- |
| `container.createChildContainer()` | A tracked child with its own scoped services | Close it when its work ends. The parent closes live children. |
| `container.createChildContainer(keys, providers)` | A tracked child with selected scoped or transient services replaced | Close it when its work ends. The parent closes live children. |
| `container.createIndependentContainer()` | A separate container with fresh instances | The caller closes it separately. |
| `container.createIndependentContainer(keys, providers)` | A separate container with selected dependencies replaced | The caller closes it separately. |

An unmarked provider is scoped. Choose singleton explicitly when child containers should share it.

For request handling, checked test replacements, and loading dynamic features,
see the [server guide](docs/guides/server-integration.md) and
[integration recipes](docs/guides/enterprise-integration.md).

The [tutorial](docs/guides/tutorial.md) also covers modules with private services,
typed tokens, class and function adapters, optional and lazy dependencies,
collections, service readiness, metadata, observers, and plugin validation.

## Modules as units of work

A DI Bag **module** is the unit of work that one person or one coding agent can
own: a directory with a small exported contract, private services, and its own
tests. The composition is checked when the modules meet, so several modules can
be developed in parallel and merged with confidence.

- **A boundary an owner can hold.** `buildModule({ exportedServiceKeys })` seals a feature and
  exports only the named services. Private services and their types stay
  inside, and two modules can use the same private names without collision.
- **Verification without the whole application.** A module declares what its host
  must supply. A small check file installs the module with typed fixtures and calls
  `verifyGraphAtCompileTime()`. Tests can use `createIndependentContainer(keys, providers)`
  for checked replacements without live clients.
- **Checks at merge time.** Installing every module into one builder is where
  independently developed work meets. A missing requirement, an incompatible
  replacement, or a contract that no longer matches its consumers fails at
  `buildContainer()` or `verifyGraphAtCompileTime()`. The `di-bag-graph` tool exports the declared
  edges and cycles for review.

Install modules with `withInstalledModules([...])`. If two modules require the
same name for different contracts, rename each requirement before installation
with `withRenamedRequirement({ currentRequirementKey, newRequirementKey })`. Use
`withRenamedExport({ currentExportKey, newExportKey })` for colliding exports.

For discovery, the directory layout is the map: one directory per module, the
contract first. The [modularity guide](docs/guides/examples-modularity.md)
describes the recommended layout and shows separately owned features, isolated
tests, and contributed tools in three runnable programs.

DI Bag's dependency graph describes how services are supplied, not what runs
next. LLM harnesses and agent graphs are one application of the module pattern:
model clients, tools, and context sources become modules, and the harness or
graph framework owns routing, retries, persistence, and execution. The
[agent harness and graph guide](docs/guides/agent-harnesses-and-graphs.md) is a
complete example.

## How it compares

DI Bag's appeal is the combination of object-parameter factories, checks across
the declared graph, and explicit resource ownership. Decorator-free composition,
async factories, and TypeScript support are also available in other libraries.

| Alternative | Reasons to choose it | DI Bag's different emphasis |
| --- | --- | --- |
| Manual dependency injection | Direct function calls may be all a small application needs. TypeScript checks their arguments. | Adds lazy caching, graph-wide composition checks, child containers, and coordinated disposal. |
| Awilix | Function and class registration, inferred cradle types, lifetime options, and runtime strict checks. | Checks declared factory requirements against the registrations at compile time. |
| InversifyJS / TSyringe | Token and class-oriented containers; Inversify also offers decorator-free factory bindings and awaited async resolution. | Starts with object-parameter factories and immutable builders; checks accumulated graph contracts. |
| Typed Inject | A close alternative with compile-time dependency checks, explicit dependency tuples, child injectors, and disposal. | Adds object-parameter dependencies, forward references, private module exports, and selected service readiness with rollback. |
| Effect Context / Layer | Typed requirements, scoped resources, and composition within Effect's broader async and error model. | Keeps ordinary `T` and `Promise<T>` service values and explicit container ownership. |
| NestJS / Angular DI | Their native containers connect directly to framework components, testing tools, and lifecycles. | Provides standalone composition; applications supply the framework integration. |

See the [comparison guide](docs/guides/comparison.md) for primary sources,
differences in async and disposal behavior, and the limits of these comparisons.
There is no verified performance ranking against these libraries.

## Runtime support

The package has **zero runtime dependencies** and one entry point: `di-bag`.
The root import configures native Promise detection on Node, Bun, and Deno.
It also bundles for browsers and workers because it has no `node:` imports.

In browsers and workers, `buildContainer()` names any factory that needs an
explicit return kind. Register synchronous factories with
`DiBag.createProvider(factory, { factoryReturnKind: 'sync-value' })` and native
Promise factories with `'native-promise'`. See
[portable mode](docs/guides/tutorial.md#portable-mode).

## Tradeoffs and limits

- **Agent context is still your responsibility.** DI Bag does not choose module
  boundaries, manage an agent's context window, or replace behavioral tests.
- **Async dependencies are explicit.** A factory returning `Promise<T>` exposes
  that promise. Consumers declare and await it themselves.
- **Disposal waits for your work by default.** Cancellation is cooperative; a
  factory or disposer that never settles keeps `close()` pending. Pass
  `close({ waitTimeoutMs, abortSignal })` to stop waiting. The rejection names the
  disposers still running, and disposal continues in the background.
- **Type safety follows the declared graph.** Casts, unchecked JavaScript, and
  unknown plugins need appropriate runtime checks. Dependency cycles are detected
  at runtime, or before running by [`di-bag-graph`](tools/graph/README.md).
- **Graph types have a compiler cost.** One fluent expression is bounded by the
  compiler's recursion budget: classic TypeScript 6.0.3 accepts about 1,000
  chained calls and overflows beyond that (about 950 for a bulk map followed by
  individual replacements); native 7.0.2 has no such ceiling. Keep an
  expression to 500 calls or fewer and use bulk registration, groups, or named
  modules beyond that. See the [compiler evidence](docs/benchmarks/typescript.md).
- **Framework integration belongs to the application.** DI Bag provides the
  composition and ownership primitives; the host connects request, job, or UI
  lifecycles. The [server guide](docs/guides/server-integration.md) and the
  [React guide](docs/guides/react-integration.md) are tested recipes for both.

## Explore further

| Resource | What you'll find |
| --- | --- |
| [Complete tutorial](docs/guides/tutorial.md) | Learn every public API through examples, from first composition to advanced ownership. |
| [API reference](docs/guides/api-reference.md) | Exact generated signatures, overloads, type parameters, and API inventories. |
| [Server guide](docs/guides/server-integration.md) | Node HTTP, Express, Fastify, Bun, and Deno: shared services, request containers, service readiness, and shutdown. |
| [React guide](docs/guides/react-integration.md) | Browser applications: one app runtime at bootstrap, project runtimes owned from effects, Strict Mode, cancellation, bounded teardown, and `useSyncExternalStore`. |
| [Radical modularity](docs/guides/examples-modularity.md) | The recommended module layout, separately owned features, isolated tests, and contributed tools. |
| [Agent docs](AGENTS.md) | Rules, module layout, and check commands for coding agents, with [recipes](docs/agent/recipes.md) and [errors](docs/agent/errors.md). Shipped in the package. |
| [Agent harnesses and graphs](docs/guides/agent-harnesses-and-graphs.md) | One worked application: model and tool modules, metadata inspection, and node tests with typed fixtures. |
| [Static dependency graph](docs/agent/recipes.md#review-merge) | Export every builder chain, declared edge, and cycle to JSON with `di-bag-graph` for merge review and CI. |
| [Runnable examples](examples) | Modules, tokens, composition, collections, plugins, observers, child containers, and provider metadata. |
| [Integration guide](docs/guides/enterprise-integration.md) | Tested recipes for request ownership, substitutions, and dynamic features. |
| [Comparison with alternatives](docs/guides/comparison.md) | When DI Bag or another approach may be a better fit, with primary sources. |
| [Development and verification](docs/guides/development.md) | Full checks, portable runtime testing, compiler scale, and performance evidence. |
| [Documentation map](docs/README.md) | Every guide, the generated reference, and the contributor documents. |

## Working on DI Bag

[![CI](https://github.com/dany-fedorov/di-bag/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/dany-fedorov/di-bag/actions/workflows/ci.yml)
[![Runtime dependencies: 0](https://img.shields.io/badge/runtime_dependencies-0-2563eb)](package.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-16a34a)](LICENSE)

After `npm ci`, run the main checks with Node and Bun installed:

```sh
npm run platform:pin
npm run check
npm run check:native
```

Run an example with `bun run examples/composition.ts`. The
[development guide](docs/guides/development.md) covers the remaining compiler,
platform, and packaging checks and their tool requirements.

## License

[MIT](LICENSE) © Dany Fedorov
