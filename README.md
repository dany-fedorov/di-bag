# DI Bag

**Connect your services. Let TypeScript check the wiring.**

[![CI](https://github.com/dany-fedorov/di-bag/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/dany-fedorov/di-bag/actions/workflows/ci.yml)
[![Runtime dependencies: 0](https://img.shields.io/badge/runtime_dependencies-0-2563eb)](package.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-16a34a)](LICENSE)

DI Bag is a TypeScript dependency injection library. You write ordinary functions
that create services; it connects their dependencies, creates them when needed,
and cleans up resources when you tell it how.

A **service** can be a configuration object, a database client, or a function.
A **factory** creates a service. A **bag** holds those factories and gives each
one access to the services it needs.

[Documentation website](https://dany-fedorov.github.io/di-bag/) · [Tutorial](docs/guides/tutorial.md) · [Quickstart](#quickstart) · [Server guide](docs/guides/server-integration.md) · [API reference](docs/guides/api-reference.md) · [Examples](examples)

## Why DI Bag?

- **Catch wiring mistakes early.** TypeScript checks missing dependencies,
  incompatible service types, and invalid replacements.
- **Keep services ordinary.** Use functions or classes without decorators,
  reflection metadata, or a base class.
- **Create only what you use.** Services are lazy and cached within a bag by
  default. Synchronous factories stay synchronous.
- **Make cleanup part of composition.** Attach a disposer to a resource and
  close its bag when the work is done.
- **Choose what each task shares.** Give requests, jobs, and tests their own
  services, with explicit sharing and checked overrides.

## Install

This checkout contains the `0.1.0` release candidate. To try it, build a local
package with Node and npm:

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

The minimum supported TypeScript version is **6.0.3**. For browser and Deno
applications, use the portable root entry described under
[runtime support](#runtime-support). See [PUBLISHING.md](PUBLISHING.md) for
release-candidate verification and publication steps.

## Quickstart

Use `di-bag/node` in Node or Bun. Here, `greeter` needs `config`. Its parameter
type describes that dependency, and its return value is the service it provides:

```ts
import { DiBag } from 'di-bag/node';

const app = DiBag.begin()
  .add({
    config: () => ({ greeting: 'Hello' }),
    greeter: ({ config }: { config: { greeting: string } }) => ({
      greet(name: string) {
        return `${config.greeting}, ${name}!`;
      },
    }),
  })
  .end();

const greeter = app.resolve('greeter');
console.log(greeter.greet('Ada')); // Hello, Ada!
```

`.add()` registers the factories, `.end()` finishes the bag, and
`resolve('greeter')` creates the greeter and the config it needs. Resolving
`greeter` again returns the same instance. Registration order does not matter.

TypeScript knows that `greeter` has a `greet(name: string): string` method.
Removing the `config` factory makes `.end()` a compile-time error. Changing
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

const app = DiBag.begin()
  .add({
    greeting: async () => 'Hello',
    message: async ({ greeting }: { greeting: Promise<string> }) =>
      `${await greeting}, Ada!`,
  })
  .end();

console.log(await app.resolve('message')); // Hello, Ada!
```

By default, repeated resolutions share the same in-flight promise. Synchronous
factories keep returning ordinary values. See
[async behavior](docs/guides/tutorial.md#async-edges-are-explicit) for details.

## Give resources a clear owner

Wrap a factory with `withDisposal` to tell the bag how to release its result:

```ts
import { DiBag } from 'di-bag/node';

const resources = DiBag.begin()
  .add({
    cache: DiBag.withDisposal(
      () => new Map<string, string>(),
      cache => cache.clear(),
    ),
  })
  .end();

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

## What you can build

Start with named factories, then add the features your application needs.

| When you need to… | Use… |
| --- | --- |
| Reuse a feature while keeping its internals private | [Modules and exports](docs/guides/tutorial.md#reuse-named-modules) |
| Inject services into existing constructors and functions | [Typed tokens and adapters](docs/guides/tutorial.md#adapt-classes-and-positional-functions) |
| Allow a missing dependency or defer a lookup | [Optional and lazy dependencies](docs/guides/tutorial.md#declare-optional-and-lazy-dependencies) |
| Assemble middleware, handlers, or other ordered lists | [Contributions and collections](docs/guides/tutorial.md#compose-an-ordered-collection) |
| Isolate a request or background job | [Child scopes and sharing](docs/guides/tutorial.md#create-tracked-child-scopes) |
| Choose one instance per family, per scope, or per resolution | [Root, scoped, and transient lifetimes](docs/guides/tutorial.md#choose-root-scoped-or-transient-caching) |
| Start selected services before accepting work | [Startup and cooperative cancellation](docs/guides/tutorial.md#start-selected-services-and-cancel-cooperatively) |
| Inspect registrations or observe their lifecycle | [Metadata and inspection](docs/guides/tutorial.md#attach-metadata-and-inspect-without-resolving), [observers](docs/guides/tutorial.md#observe-lifecycle-transitions) |
| Validate the output of an application-selected plugin | [Plugin providers](docs/guides/tutorial.md#admit-an-application-selected-plugin) |

### Scopes and forks at a glance

| Operation | What it creates | Who closes it? |
| --- | --- | --- |
| `bag.scope()` | A tracked child with fresh scoped services; root services are shared | Close it when its work ends. The parent also closes live children. |
| `bag.fork()` | An independent bag with the same registrations and fresh instances | The caller closes it separately. |
| `bag.fork(keys, overrides)` | An independent bag with selected dependencies replaced | The caller closes it separately. |

For request handling, checked test replacements, and loading dynamic features,
see the [server guide](docs/guides/server-integration.md) and
[integration recipes](docs/guides/enterprise-integration.md).

## Runtime support

The package has **zero runtime dependencies** and four entry points:

| Import | Purpose |
| --- | --- |
| `di-bag/node` | Ready-to-use factory composition in Node and Bun, with native Promise detection. |
| `di-bag` | Portable core for other hosts, including Deno and bundled browsers. Use explicit acquisition modes or configure a trusted native Promise predicate. |
| `di-bag/sas-box` | Optional structural adapters for SasBox values. |
| `di-bag/val-box` | Optional structural adapters for ValBox values. |

The box adapters are separate entry points; applications supply their own box
libraries. See [host configuration](docs/guides/tutorial.md#portable-mode)
and [box adapters](docs/guides/tutorial.md#optional-box-adapters) for details.

Use `sas-box` when reusable plugins must declare which sync/async acquisition
routes they support. Use `val-box` when an acquired result needs explicit
presence and provenance, such as the configuration source or secret version
that actually supplied it. Ordinary factories and static `withMetadata` labels
already cover simpler cases. The [production use-case assessment](docs/research/2026-09-10-box-production-use-cases.md)
compares these patterns with Babel, Sass, Spring Boot, and other primary sources,
including where plain functions or records are sufficient.

### A few things to know

- **Async dependencies are explicit.** A factory returning `Promise<T>` exposes
  that promise. Consumers declare and await it themselves.
- **Cleanup waits for your work.** Cancellation is cooperative; a factory or
  disposer that never settles can keep `close()` pending.
- **Type safety follows the declared graph.** Casts, unchecked JavaScript, and
  unknown plugins need appropriate runtime checks.
- **Framework integration belongs to the application.** DI Bag provides the
  composition and ownership primitives; the host connects request, job, or UI
  lifecycles. Direct NestJS and Angular adapters are not included.

## Explore further

| Resource | What you'll find |
| --- | --- |
| [Complete tutorial](docs/guides/tutorial.md) | Learn every public API through examples, from first composition to advanced ownership. |
| [API reference](docs/guides/api-reference.md) | Exact generated signatures, overloads, type parameters, and API inventories. |
| [Server guide](docs/guides/server-integration.md) | Node HTTP, Express, Fastify, Bun, and Deno: shared services, request scopes, startup, and shutdown. |
| [Runnable examples](examples) | Modules, tokens, composition, collections, plugins, observers, scopes, and adapters. |
| [Integration guide](docs/guides/enterprise-integration.md) | Tested recipes for request ownership, substitutions, and dynamic features. |
| [Comparison with alternatives](docs/research/2026-09-09-enterprise-parity.md) | Capability comparisons with Awilix, InversifyJS, TSyringe, Typed Inject, Effect, NestJS, and Angular, including differences and limits. |
| [Migration guide](docs/migrations/0.1-to-enterprise.md) | Changes across the enterprise capability work. |
| [Development and verification](docs/guides/development.md) | Full checks, portable runtime testing, compiler scale, and performance evidence. |

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
