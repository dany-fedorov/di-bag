# DI Bag

Connect your services. Let TypeScript check the wiring.

[![CI](https://github.com/dany-fedorov/di-bag/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/dany-fedorov/di-bag/actions/workflows/ci.yml)
[![Runtime dependencies: 0](https://img.shields.io/badge/runtime_dependencies-0-2563eb)](package.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-16a34a)](LICENSE)

DI Bag is a TypeScript dependency injection library. You write ordinary functions
that create services; it connects their dependencies, creates them when needed,
and cleans up resources when you tell it how.

A **service** can be a configuration object, a database client, or a function.
A **factory** creates a service. A **bag** holds those factories and gives each
one access to the services it needs.

[Documentation](https://dany-fedorov.github.io/di-bag/) · [Quickstart](#quickstart) · [Comparison](#how-it-compares) · [Tutorial](docs/guides/tutorial.md) · [API reference](docs/guides/api-reference.md)

## Why DI Bag?

- **[Radical modularity for agentic development](docs/guides/examples-modularity.md).**
  Compose small features with private internals and explicit contracts. Give
  humans and coding agents focused units to implement, replace, and test
  independently, then check their composition together.
- **[TypeScript-first composition](docs/guides/examples-type-checking.md).**
  Catch missing dependencies, incompatible service contracts, and invalid
  replacements at compile time—not just incorrect arguments at the call site.
- **[Rich metadata and extensibility](docs/guides/examples-extensibility.md).**
  Inspect registrations and acquisitions, attach your own metadata, and build
  metadata-driven tools and actions. Extend providers with composable wrappers
  and configure lifecycle observers without changing your services.
- **[Inject anything with plain JavaScript](docs/guides/examples-plain-services.md).**
  Functions, class instances, configuration, clients, or promises: a service is
  just a value. No decorators, reflection metadata, or special base classes.
  Add TypeScript for compile-time composition checks.

Each guide above contains three complete application examples. Lazy creation,
configurable lifetimes, scopes, and dependency-ordered cleanup support these
patterns; the [tutorial](docs/guides/tutorial.md) explains how.

For a small graph, passing dependencies directly is often simpler. Other DI
libraries also offer typed composition and resource management; the
[comparison below](#how-it-compares) explains the tradeoffs.

## Install

This checkout is a pre-1.0 release candidate, currently versioned `0.1.0`.
It includes breaking API changes, so expect to review migrations when updating.
These instructions install the current checkout without assuming an npm release
is available. Build a local package with Node 24 and npm:

```sh
git clone https://github.com/dany-fedorov/di-bag.git
cd di-bag
npm ci
npm pack
```

Then, from your application, install the generated archive using its local path:

```sh
npm install /path/to/di-bag/di-bag-0.1.0.tgz
```

The minimum supported TypeScript version is **6.0.3**; enable `strict` in your
`tsconfig.json`. The repository checks classic TypeScript 6.0.3 and native 7.0.2.
For browsers and Deno, see [runtime support](#runtime-support).

For an older checkout, follow the [single builder](docs/migrations/single-builder.md) and [API renaming](docs/migrations/api-renaming.md) migration guides.

## Quickstart

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

The replacement must satisfy the original service contract. Each fork creates
its own instances and owns its own cleanup; close it separately.

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
  lifecycles. Direct NestJS and Angular adapters are not included.

## Explore further

| Resource | What you'll find |
| --- | --- |
| [Complete tutorial](docs/guides/tutorial.md) | Learn every public API through examples, from first composition to advanced ownership. |
| [API reference](docs/guides/api-reference.md) | Exact generated signatures, overloads, type parameters, and API inventories. |
| [Server guide](docs/guides/server-integration.md) | Node HTTP, Express, Fastify, Bun, and Deno: shared services, request scopes, startup, and shutdown. |
| [Runnable examples](examples) | Modules, tokens, composition, collections, plugins, observers, scopes, and provider metadata. |
| [Integration guide](docs/guides/enterprise-integration.md) | Tested recipes for request ownership, substitutions, and dynamic features. |
| [Comparison with alternatives](docs/guides/comparison.md) | When DI Bag or another approach may be a better fit, with primary sources. |
| [Migration guides](docs/migrations/single-builder.md) | Before/after examples for the single builder and the [earlier API renaming](docs/migrations/api-renaming.md). |
| [Development and verification](docs/guides/development.md) | Full checks, portable runtime testing, compiler scale, and performance evidence. |
| [Documentation map](docs/README.md) | Current guides, migration history, and archived research and design notes. |

## Working on DI Bag

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
