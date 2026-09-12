# Documentation map

Start with the [README](../README.md) or browse the
[documentation website](https://dany-fedorov.github.io/di-bag/).
The guides below describe the current public API.

## Learn and use DI Bag

| Document | Purpose |
| --- | --- |
| [Tutorial](guides/tutorial.md) | Build a first graph, then learn ownership, scopes, modules, tokens, and advanced APIs. |
| [Comparison with alternatives](guides/comparison.md) | Assess DI Bag alongside manual DI and other libraries, with primary sources and tradeoffs. |
| [Server guide](guides/server-integration.md) | Connect application services to Node HTTP, Express, Fastify, Bun, and Deno. |
| [Integration recipes](guides/enterprise-integration.md) | Own request scopes, substitute test services, and manage dynamic features. |
| [Agent harnesses and graphs](guides/agent-harnesses-and-graphs.md) | Compose model and tool dependencies, inspect metadata, and test nodes with typed fixtures. |
| [API overview](guides/api-reference.md) | Find methods, error fields, and exported types. |
| [Generated reference](reference/index.md) | Read exact signatures and source comments for both package entries. |
| [Runnable examples](../examples) | Execute focused examples from the repository. |

## Why DI Bag? In practice

Each guide contains three complete, independently runnable application examples.

| Guide | Scenarios |
| --- | --- |
| [Radical modularity](guides/examples-modularity.md) | Independent features, isolated automated tests, and contributed tools. |
| [TypeScript-first composition](guides/examples-type-checking.md) | Missing dependencies, incompatible contracts, and checked replacements. |
| [Custom tooling](guides/examples-extensibility.md) | A programmable DI layer for metadata-driven actions, acquisition diagnostics, and custom instrumentation. |
| [Simple service injection](guides/examples-plain-services.md) | TypeScript-first composition with ordinary functions, undecorated classes, and arbitrary service values. |

## Contribute

| Document | Purpose |
| --- | --- |
| [Changelog](../CHANGELOG.md) | Review changes by release. |
| [Development](guides/development.md) | Run source, package, compiler, and platform checks. |
| [Documentation maintenance](guides/documentation.md) | Edit guides, regenerate the API reference, and preview the website. |
| [Publishing](../PUBLISHING.md) | Prepare and verify a local package candidate. |
| [Compiler scale](benchmarks/typescript.md) | Understand the measured limits of large fluent expressions and run the compiler benchmarks. |

Generated reference pages belong in `docs/reference/`; edit their source comments
and regenerate them.
