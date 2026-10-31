# Runnable examples

Each file is a complete program against the repository source. Run one from the
repository root with Bun:

```sh
bun run examples/composition.ts
```

| File | What it shows |
| --- | --- |
| [`composition.ts`](composition.ts) | Named factories, a class adapted with `createProviderFromClass`, lazy and optional dependencies, aliases, and assertions on the resolved values. |
| [`modules.ts`](modules.ts) | A logging module with a private prefix, installed into an application builder. |
| [`tokens.ts`](tokens.ts) | Typed tokens for a clock and a connection, with `withTokenService` and positional injection. |
| [`contributions.ts`](contributions.ts) | A collection token whose members are contributed by separate modules and resolved in order. |
| [`scopes.ts`](scopes.ts) | Child containers that replace some services and share others from the parent, which keeps ownership and releases dependents first. |
| [`observers.ts`](observers.ts) | Lifecycle observers receiving acquisition and disposal events, an observed alias, and the observer-failure callback. |
| [`plugins.ts`](plugins.ts) | A validated plugin descriptor admitted with `createProviderFromPlugin`. |
| [`provider-metadata.ts`](provider-metadata.ts) | Acquisition metadata recorded by providers and inspected with `serviceSnapshot` after resolving. |
| [`wbs-scope.ts`](wbs-scope.ts) | A work-breakdown-structure application with ownership per change; `npm run example:wbs`. |
| [`integration/owned-scope.ts`](integration/owned-scope.ts) | The acquire, work, close helper used by the integration guide. |
| [`react/`](react) | A browser application owning application and project runtimes from React effects; `npm run example:react` builds the page. |

The guides contain further complete programs that run against the published
package: [modules](../docs/guides/examples-modularity.md),
[type checking](../docs/guides/examples-type-checking.md),
[custom tooling](../docs/guides/examples-extensibility.md), and
[plain services](../docs/guides/examples-plain-services.md).
