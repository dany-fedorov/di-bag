# DI Bag

TypeScript dependency composition and resource ownership for modular codebases,
including the ones coding agents build one feature at a time.

[Documentation](https://dany-fedorov.github.io/di-bag/) · [Quickstart](#quickstart) · [Modules as units of work](#modules-as-units-of-work) · [Comparison](#how-it-compares) · [Tutorial](docs/guides/tutorial.md) · [API reference](docs/guides/api-reference.md)

## Why DI Bag?

Compose ordinary TypeScript factories into reusable features. DI Bag checks
declared dependencies, keeps module internals private, and manages resource
creation and cleanup. Build each feature against an explicit contract, test it
with replaced dependencies, and let the compiler check the composition when
independently developed features come together.

- **[Modules a single owner can build in isolation](docs/guides/examples-modularity.md).**
  A person or a coding agent implements one feature against its contract
  without exposing its internals or reading another feature's source.
- **[Compile-time wiring checks](docs/guides/examples-type-checking.md).**
  Catch missing dependencies and incompatible replacements before starting the app.
- **[Metadata inspection without service startup](docs/guides/examples-extensibility.md).**
  Build capability catalogs without running factories or opening clients.
- **[Inject anything with a simple factory function](docs/guides/examples-plain-services.md).**
  Supply functions, objects, clients, or promises—no decorators or base classes.

## Install

Install [di-bag from npm](https://www.npmjs.com/package/di-bag):

```sh
npm install di-bag
```

The API is pre-1.0 and includes breaking changes, so review the changelog and
migration guides when updating.

The minimum supported TypeScript version is **6.0.3**; enable `strict` in your
`tsconfig.json`. The repository checks classic TypeScript 6.0.3 and native 7.0.2.
For browsers and Deno, see [runtime support](#runtime-support).

## Quickstart

A **service** can be a configuration object, a database client, or a function.
A **factory** creates a service. A **bag** holds those factories and gives each
one access to the services it needs. Services are created when needed, and
resources are cleaned up when you provide a disposer and close their bag.

Import from `di-bag`. Here, `greeter` needs `config`. Its parameter
type describes that dependency, and its return value is the service it provides:

```ts
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder()
  .register({
    config: () => ({ greeting: 'Hello' }),
    greeter: ({ config }: { config: { greeting: string } }) => ({
      greet(name: string) {
        return `${config.greeting}, ${name}!`;
      },
    }),
  })
  .build();

const greeter = app.resolve('greeter');
console.log(greeter.greet('Ada')); // Hello, Ada!
```

`.register()` adds factories to an immutable builder, `.build()` checks the
declared graph and creates the bag, and
`resolve('greeter')` creates the greeter and the config it needs. Resolving
`greeter` again returns the same instance. Registration order does not matter.

TypeScript knows that `greeter` has a `greet(name: string): string` method.
Removing the `config` factory makes `.build()` a compile-time error. Changing
`greeting` to a number also fails the type check because the greeter needs a string.

## Swap a dependency for a test

Use `fork()` to create a separate bag with a replacement dependency.
Continuing the [quickstart](#quickstart):

```ts
const testApp = app.fork(['config'], {
  config: () => ({ greeting: 'Hi' }),
});

try {
  console.log(testApp.resolve('greeter').greet('Ada')); // Hi, Ada!
  console.log(app.resolve('greeter').greet('Ada')); // Hello, Ada!
} finally {
  await testApp.close();
}
```

The replacement must satisfy the original service contract. Each fork has
independent acquisition and cleanup ownership; close it separately. Factories
can still return shared objects captured outside the fork.

## Work with async services

An async factory provides a promise. Declare that promise in any dependent
factory and await it where you need the value:

```ts
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder()
  .register({
    greeting: async () => 'Hello',
    message: async ({ greeting }: { greeting: Promise<string> }) =>
      `${await greeting}, Ada!`,
  })
  .build();

console.log(await app.resolve('message')); // Hello, Ada!
```

By default, repeated resolutions share the same in-flight promise. Synchronous
factories keep returning ordinary values. See
[async behavior](docs/guides/tutorial.md#async-edges-are-explicit) for details.

## Give resources a clear owner

Wrap a factory with `withDisposal` to tell the bag how to release its result:

```ts
import { DiBag } from 'di-bag';

const resources = DiBag.createBuilder()
  .register({
    cache: DiBag.withDisposal(
      () => new Map<string, string>(),
      (cache) => cache.clear(),
    ),
  })
  .build();

try {
  resources.resolve('cache').set('answer', '42');
} finally {
  await resources.close();
}
```

The same pattern works for connections, clients, and subscriptions. Cleanup can
be asynchronous. Dependents close before their dependencies, and resources that
were never created need no cleanup. Ordinary factories return borrowed values;
having a `close()` method alone does not transfer ownership to the bag.

## Scopes and forks

| Operation | What it creates | Who closes it? |
| --- | --- | --- |
| `bag.createScope()` | A tracked child with fresh scoped services; root services are shared | Close it when its work ends. The parent also closes live children. |
| `bag.fork()` | An independent bag with the same registrations and fresh instances | The caller closes it separately. |
| `bag.fork(keys, overrides)` | An independent bag with selected dependencies replaced | The caller closes it separately. |

For request handling, checked test replacements, and loading dynamic features,
see the [server guide](docs/guides/server-integration.md) and
[integration recipes](docs/guides/enterprise-integration.md).

The [tutorial](docs/guides/tutorial.md) also covers modules with private services,
typed tokens, class and function adapters, optional and lazy dependencies,
collections, startup, metadata, observers, and plugin validation.

## Modules as units of work

A DI Bag **module** is the unit of work that one person or one coding agent can
own: a directory with a small exported contract, private services, and its own
tests. The composition is checked when the modules meet, so several modules can
be developed in parallel and merged with confidence.

- **A boundary an owner can hold.** `buildModule(keys)` seals a feature and
  exports only the named services. Private services and their types stay
  inside, and two modules can use the same private names without collision.
- **Verification without the whole application.** A module type-checks
  against the contracts it declares. `fork()` replaces its external
  dependencies with typed fixtures for deterministic tests, so a module's tests
  need neither the other modules nor live clients.
- **Checks at merge time.** Installing every module into one builder is where
  independently developed work meets. A missing requirement, an incompatible
  replacement, or a contract that no longer matches its consumers fails at
  `build()` or `verifyGraph()`. The `di-bag-graph` tool exports the declared
  edges and cycles for review.

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
| Manual dependency injection | Direct function calls may be all a small application needs. TypeScript checks their arguments. | Adds lazy caching, graph-wide composition checks, scopes, and coordinated cleanup. |
| Awilix | Function and class registration, inferred cradle types, lifetime options, and runtime strict checks. | Checks declared factory requirements against the registrations at compile time. |
| InversifyJS / TSyringe | Token and class-oriented containers; Inversify also offers decorator-free factory bindings and awaited async resolution. | Starts with object-parameter factories and immutable builders; checks accumulated graph contracts. |
| Typed Inject | A close alternative with compile-time dependency checks, explicit dependency tuples, child injectors, and disposal. | Adds object-parameter dependencies, forward references, private module exports, and selected startup with rollback. |
| Effect Context / Layer | Typed requirements, scoped resources, and composition within Effect's broader async and error model. | Keeps ordinary `T` and `Promise<T>` service values and explicit bag lifecycles. |
| NestJS / Angular DI | Their native containers connect directly to framework components, testing tools, and lifecycles. | Provides standalone composition; applications supply the framework integration. |

See the [comparison guide](docs/guides/comparison.md) for primary sources,
differences in async and cleanup behavior, and the limits of these comparisons.
There is no verified performance ranking against these libraries.

## Runtime support

The package has **zero runtime dependencies** and two entry points:

| Import | Purpose |
| --- | --- |
| `di-bag` | The entry to use. Configures native Promise detection itself on Node, Bun, and Deno through `process.getBuiltinModule`; has no `node:` imports, so it also bundles for browsers. |
| `di-bag/node` | The same API with detection configured explicitly at import, for Node and Bun. |

On hosts without `process.getBuiltinModule` (browsers, workers), `build()`
rejects automatic acquisition stages and names them. Register with
`DiBag.fromSyncFactory` / `DiBag.fromAsyncFactory` there, or configure a trusted
classifier. See [portable mode](docs/guides/tutorial.md#portable-mode).

## Tradeoffs and limits

- **Agent context is still your responsibility.** DI Bag does not choose module
  boundaries, manage an agent's context window, or replace behavioral tests.
- **Async dependencies are explicit.** A factory returning `Promise<T>` exposes
  that promise. Consumers declare and await it themselves.
- **Cleanup waits for your work by default.** Cancellation is cooperative; a
  factory or disposer that never settles keeps `close()` pending. Pass
  `close({ timeoutMs, signal })` to stop waiting: the rejection names the
  disposers still running and cleanup continues in the background.
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
| [Server guide](docs/guides/server-integration.md) | Node HTTP, Express, Fastify, Bun, and Deno: shared services, request scopes, startup, and shutdown. |
| [React guide](docs/guides/react-integration.md) | Browser applications: one app runtime at bootstrap, project runtimes owned from effects, Strict Mode, cancellation, bounded teardown, and `useSyncExternalStore`. |
| [Radical modularity](docs/guides/examples-modularity.md) | The recommended module layout, separately owned features, isolated tests, and contributed tools. |
| [Agent docs](AGENTS.md) | Rules, module layout, and check commands for coding agents, with [recipes](docs/agent/recipes.md) and [errors](docs/agent/errors.md). Shipped in the package. |
| [Agent harnesses and graphs](docs/guides/agent-harnesses-and-graphs.md) | One worked application: model and tool modules, metadata inspection, and node tests with typed fixtures. |
| [Static dependency graph](docs/agent/recipes.md#review-merge) | Export every builder chain, declared edge, and cycle to JSON with `di-bag-graph` for merge review and CI. |
| [Runnable examples](examples) | Modules, tokens, composition, collections, plugins, observers, scopes, and provider metadata. |
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
