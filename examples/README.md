# Runnable examples

Each `.ts` file at the top level is a complete program against the repository source. Run one from the
repository root with Bun:

```sh
bun run examples/composition.ts
```

| File | What it shows |
| --- | --- |
| [`composition.ts`](composition.ts) | Named factories, a class adapted with `createProviderFromClass`, lazy and optional dependencies, aliases, and assertions on the resolved values. |
| [`modules.ts`](modules.ts) | Two modules with private services and exports, one owning a connection with `providerWithDisposal`, installed with `withInstalledModules` and replaced in a `createIndependentContainer`. |
| [`tokens.ts`](tokens.ts) | Typed tokens for a clock and a connection registered with `withTokenService` and injected positionally with `createProviderFromFunction`, sealed into a module and replaced in a `createIndependentContainer`. |
| [`contributions.ts`](contributions.ts) | A collection token whose members are added with `withCollectionContribution` from separate modules, consumed through `createProviderFromFunction`, and read in order with `resolveCollection`. |
| [`scopes.ts`](scopes.ts) | Child containers that replace selected services and share others from the parent; shared services are released only when the parent closes. |
| [`observers.ts`](observers.ts) | Lifecycle observers receiving acquisition and disposal events, an observed alias, and the observer-failure callback. |
| [`plugins.ts`](plugins.ts) | A validated plugin descriptor admitted with `createProviderFromPlugin` and registered under a typed token. |
| [`provider-metadata.ts`](provider-metadata.ts) | Acquisition metadata recorded by providers and inspected with `serviceSnapshot` after resolving. |
| [`wbs-scope.ts`](wbs-scope.ts) | A work-breakdown-structure application whose per-change containers come from `createIndependentContainer` and own their resources with `providerWithDisposal`; `npm run example:wbs`. |
| [`integration/owned-container.ts`](integration/owned-container.ts) | The `withOwnedContainer` helper the server and integration guides teach; `tests/enterprise-integration.test.ts` exercises it. |
| [`react/`](react) | A browser application whose `main.tsx` calls `bootstrap` in `bootstrap.tsx` to own application and project runtimes outside React components; `npm run example:react` builds the page. |

The guides contain further complete programs that run against the published
package: [modules](../docs/guides/examples-modularity.md),
[type checking](../docs/guides/examples-type-checking.md),
[custom tooling](../docs/guides/examples-extensibility.md), and
[plain services](../docs/guides/examples-plain-services.md).
