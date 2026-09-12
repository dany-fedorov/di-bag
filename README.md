# DI Bag

TypeScript dependency composition and resource ownership for agentic development, LLM harnesses, and agent graphs.

[Documentation](https://dany-fedorov.github.io/di-bag/) · [Quickstart](#quickstart) · [Agent harnesses](docs/guides/agent-harnesses-and-graphs.md) · [Comparison](#how-it-compares) · [Tutorial](docs/guides/tutorial.md) · [API reference](docs/guides/api-reference.md)

## Why DI Bag?

DI Bag composes ordinary service factories into reusable modules, checks their
declared dependencies, and manages acquisition and explicit cleanup. In an LLM
harness, those services can be model clients, tools, or agent graph node functions.
Your application or graph framework still owns execution and routing.

Module boundaries can support task-specific context selection when their contracts
and tests capture the relevant obligations. DI Bag helps you compose those
boundaries, replace dependencies in tests, and check declared service contracts.
Smaller context and better coding-agent outcomes are potential benefits, not
measured results. See the [mechanisms, baselines, and evidence](docs/research/2026-09-12-harness-engineering-claim-audit.md).

- **[Reusable modules with private bindings](docs/guides/examples-modularity.md).**
  Install separately authored features without exposing their private services.
  Retain their declared host requirements through nested composition and test
  substitutions. Coherent feature boundaries matter more than module count.
- **[Compile-time wiring checks](docs/guides/examples-type-checking.md).**
  Catch missing dependencies, incompatible service contracts, and invalid
  replacements at compile time—not just incorrect arguments at the call site.
  Check declared wiring without starting the app; run behavioral tests separately.
  This is an early contract check, not proof of workflow correctness or a measured
  improvement in evaluation speed.
- **[Metadata inspection without service startup](docs/guides/examples-extensibility.md).**
  Inspect selected registrations to build a catalog without opening their clients
  or running their factories. Provider wrappers and observers support acquisition
  diagnostics; your tooling defines metadata semantics and invocation tracing.
- **[Inject anything with a simple factory function](docs/guides/examples-plain-services.md).**
  DI Bag is TypeScript-first, but injecting services is as simple as writing an
  ordinary JavaScript function: receive dependencies and return a value.
  Functions, class instances, configuration, clients, or promises—no decorators,
  reflection metadata, or special base classes required.

Each guide above contains three complete application examples. Lazy creation,
configurable lifetimes, scopes, and dependency-ordered cleanup support these
patterns; the [tutorial](docs/guides/tutorial.md) explains how.

For a small dependency graph, passing dependencies directly is often simpler.
Other DI libraries also offer typed composition and resource management; the
[comparison below](#how-it-compares) explains the tradeoffs.

## LLM harnesses and agent graphs

The same boundaries help when the application you are building is itself an
agentic system. Use DI Bag to compose an **LLM harness** from model clients,
tools, context sources, and ordinary functions that serve as **agent graph**
nodes.

- **Explicit feature boundaries:** give each node or tool a small contract
  and private implementation. Local changes can use focused context when contracts
  and tests capture their obligations; the harness selects tools and context for the LLM.
- **Contract checks and fixture tests:** check declared wiring before a model call,
  then fork the composition with typed model and tool fixtures for deterministic
  behavioral tests. Keep live-model evals for quality and task success.
- **Inspectable capability descriptions:** describe public nodes and tools next
  to their factories. Inspect that metadata without creating services, and use
  it in application-defined catalogs, diagnostics, or dispatch policies.

DI Bag's dependency graph describes how services are supplied. The agent graph
describes execution: which node runs next and what state it receives. Your
harness or graph framework owns routing, retries, persistence, and execution;
DI Bag supplies checked composition and resource ownership.

The [agent harness and graph guide](docs/guides/agent-harnesses-and-graphs.md)
combines private feature modules, an LLM-backed node, metadata inspection, and
fork-based evals in one runnable example. The [detailed claim audit](docs/research/2026-09-12-di-bag-harness-evidence.md)
compares manual DI and documents limits: inspection does not export complete
dependency edges, observers do not trace ordinary node calls, and forks are not
workflow checkpoints.

## Install

Install [di-bag from npm](https://www.npmjs.com/package/di-bag):

```sh
npm install di-bag
```

Version `0.1.0` is available on npm. The API is pre-1.0 and includes breaking
changes, so expect to review migrations when updating.

The minimum supported TypeScript version is **6.0.3**; enable `strict` in your
`tsconfig.json`. The repository checks classic TypeScript 6.0.3 and native 7.0.2.
For browsers and Deno, see [runtime support](#runtime-support).

For an older checkout, follow the [single builder](docs/migrations/single-builder.md) and [API renaming](docs/migrations/api-renaming.md) migration guides.

## Quickstart

A **service** can be a configuration object, a database client, or a function.
A **factory** creates a service. A **bag** holds those factories and gives each
one access to the services it needs. Services are created when needed, and
resources are cleaned up when you provide a disposer and close their bag.

Use `di-bag/node` in Node or Bun. Here, `greeter` needs `config`. Its parameter
type describes that dependency, and its return value is the service it provides:

```ts
import { DiBag } from 'di-bag/node';

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
import { DiBag } from 'di-bag/node';

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
import { DiBag } from 'di-bag/node';

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
| `di-bag/node` | Ready-to-use factory composition in Node and Bun, with native Promise detection. |
| `di-bag` | Portable core for other hosts, including Deno and bundled browsers. Use explicit acquisition modes or configure a trusted native Promise predicate. |

The portable entry rejects automatic acquisition stages unless you configure a
trusted classifier. See [portable mode](docs/guides/tutorial.md#portable-mode)
for both setup options.

## Tradeoffs and limits

- **Agent context is still your responsibility.** DI Bag does not choose module
  boundaries, manage an agent's context window, or replace behavioral tests.
- **Async dependencies are explicit.** A factory returning `Promise<T>` exposes
  that promise. Consumers declare and await it themselves.
- **Cleanup waits for your work.** Cancellation is cooperative; a factory or
  disposer that never settles can keep `close()` pending.
- **Type safety follows the declared graph.** Casts, unchecked JavaScript, and
  unknown plugins need appropriate runtime checks. Dependency cycles are detected
  at runtime.
- **Graph types have a compiler cost.** Very long fluent expressions can exceed
  compiler limits. Classic TypeScript still fails the recorded 1,000-call named
  registration and replacement cases; use bulk registration or smaller groups.
  See the [compiler evidence](docs/benchmarks/typescript.md) for tested forms and limits.
- **Framework integration belongs to the application.** DI Bag provides the
  composition and ownership primitives; the host connects request, job, or UI
  lifecycles.

## Explore further

| Resource | What you'll find |
| --- | --- |
| [Complete tutorial](docs/guides/tutorial.md) | Learn every public API through examples, from first composition to advanced ownership. |
| [API reference](docs/guides/api-reference.md) | Exact generated signatures, overloads, type parameters, and API inventories. |
| [Server guide](docs/guides/server-integration.md) | Node HTTP, Express, Fastify, Bun, and Deno: shared services, request scopes, startup, and shutdown. |
| [Agent harnesses and graphs](docs/guides/agent-harnesses-and-graphs.md) | Compose model and tool dependencies, inspect metadata, and test nodes with typed fixtures. |
| [Runnable examples](examples) | Modules, tokens, composition, collections, plugins, observers, scopes, and provider metadata. |
| [Integration guide](docs/guides/enterprise-integration.md) | Tested recipes for request ownership, substitutions, and dynamic features. |
| [Comparison with alternatives](docs/guides/comparison.md) | When DI Bag or another approach may be a better fit, with primary sources. |
| [Migration guides](docs/migrations/single-builder.md) | Before/after examples for the single builder and the [earlier API renaming](docs/migrations/api-renaming.md). |
| [Development and verification](docs/guides/development.md) | Full checks, portable runtime testing, compiler scale, and performance evidence. |
| [Documentation map](docs/README.md) | Current guides, migration history, and archived research and design notes. |

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
