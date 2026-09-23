# DI Bag: notes for coding agents

DI Bag composes TypeScript factories into a dependency graph that the compiler
checks. Modules keep a feature's services private behind exported keys; a container
creates services on first use and releases what it owns when closed.

This file ships in `node_modules/di-bag/`. Every call, with one way per task and an example: [docs/agent/api-card.md](docs/agent/api-card.md).
Task recipes: [docs/agent/recipes.md](docs/agent/recipes.md). Every compiler and runtime message: [docs/agent/errors.md](docs/agent/errors.md).

## Rules

1. **Import from `di-bag`:** `import { DiBag } from 'di-bag';`. It configures
   itself on Node, Bun, and Deno; use the same root import on every runtime.
   For browsers and workers register synchronous factories with
   `DiBag.createProvider(factory, { factoryReturnKind: 'sync-value' })`; use
   `'native-promise'` for a factory that returns a native Promise
   ([portable recipe](docs/agent/recipes.md#portable-graph)); an auto-detect factory there fails
   `buildContainer()` with [`DI_BAG_CLASSIFIER_REQUIRED`](docs/agent/errors.md#di-bag-classifier-required), which names it.
2. **A factory declares its dependencies in the type of its one object
   parameter; destructure it** (`({ clock }: { clock: Clock }) => ...`) or read
   `dependencies.clock` directly. The object is a Proxy that resolves each property when
   read: spreading it, `Object.keys`, `in`, and `JSON.stringify` throw
   [`DI_BAG_INVALID_DEPENDENCY_ACCESS`](docs/agent/errors.md#di-bag-invalid-dependency-access).
3. **Lifetimes.** The default remains `scoped:one-per-container` in this phase.
   Select `singleton:one-per-container-tree`, `scoped:one-per-container`, or
   `transient:one-per-resolve` with `DiBag.providerWithLifetime(...)`; only singleton
   accepts `allowsScopedDependencies`; otherwise the compiler reports a
   [root capture](docs/agent/errors.md#root-capture) naming both keys.
4. **Async is explicit.** An async factory's service is its Promise. A consumer
   declares `{ db: Promise<Db> }` and awaits it; nothing is awaited for you.
5. **No thenables.** A factory that returns a non-Promise object with a `then`
   method (query builders) is [rejected](docs/agent/errors.md#structural-thenable).
   Return `Promise.resolve(builder)` or use `DiBag.createProvider(create, { factoryReturnKind: 'uninspected' })`.
6. **Ownership.** Use `DiBag.providerWithDisposal({ provider, disposeService })`.
   `close()` runs disposers, dependents first. Close every child and
   independent container; a parent closes its live children, never independent containers. Inside a factory,
   [`factoryContext.pushDisposer`](docs/agent/recipes.md#partial-acquisition) owns what it acquires on the way; if that is also the returned value, act only when `disposerContext.reason !== 'service-disposed'`.
7. **Replace dependencies in tests with `createIndependentContainer(keys, providers)`**; each provider must satisfy the original contract.
8. **Modules.** Add factories with `withServices`, then
   `buildModule({ exportedServiceKeys: ['exported'], moduleLabel: 'billing' })`.
   Unregistered needs become requirements: the host supplies them after
   `withInstalledModules([module])`. Rename colliding string requirements with module.withRenamedRequirement({ currentRequirementKey, newRequirementKey }); tokens keep their global identity.
9. **Read a rejection at its name.** A graph error is an assignability error
   whose type is `Unsatisfied<"message", details>`, reported where the builder
   expression starts. `builder.verifyGraphAtCompileTime() satisfies void;`
   reports the same message on its own line; `"noErrorTruncation": true` prints the details.
   Runtime errors carry `code` and `details`: branch on `code`, never on message text.
   The section for a code is `docs/agent/errors.md#<code>`, lower-cased with `_` replaced by `-`.

## Module layout

```text
src/features/invoicing/
  contract.ts        # exported service types and the requirements the host must supply
  module.ts          # buildModule({ exportedServiceKeys: [...] }) over the private factories
  store.ts           # private services; free to use names other modules also use
  check.ts           # type-checks this module alone; never imported, not built
  tsconfig.json      # extends the root tsconfig and includes only this directory
  invoicing.test.ts
src/app.ts           # installs modules in one withInstalledModules([...]) list
src/app.check.ts     # verifyGraphAtCompileTime() on the application builder: the merge check
```

Inside a file, keep the same order: contract types, private factories, the
sealed module, then the host. Exclude `check.ts` files and `src/app.check.ts`
from an emitting build; they have no runtime purpose.

A complete module:

```ts
// src/features/greeting/contract.ts
export type Greeter = { greet(name: string): string };
export type GreetingConfig = { greeting: string };
```

```ts
// src/features/greeting/module.ts
import { DiBag } from 'di-bag';
import type { Greeter, GreetingConfig } from './contract.js';

export const greetingModule = DiBag.createBuilder()
  .withServices({
    greeter: ({ config }: { config: GreetingConfig }): Greeter => ({
      greet: name => `${config.greeting}, ${name}!`,
    }),
  })
  .buildModule({ exportedServiceKeys: ['greeter'] });
```

`check.ts` is one statement: install the module, add a typed fixture for
each requirement, and verify.

```ts
// src/features/greeting/check.ts
import { DiBag } from 'di-bag';
import type { GreetingConfig } from './contract.js';
import { greetingModule } from './module.js';

DiBag.createBuilder()
  .withInstalledModules([
    greetingModule,
  ])
  .withServices({ config: (): GreetingConfig => ({ greeting: 'Hello' }) })
  .verifyGraphAtCompileTime() satisfies void;
```

## Check one module

`src/features/<name>/tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.json",
  "include": ["."]
}
```

Type-check the module and its `check.ts` without the rest of the application:

```sh
npx tsc --noEmit -p src/features/<name>/tsconfig.json
```

A missing requirement fails with its key:
`required service registrations are missing: config`.

## Fast check

Define `check:fast` in the consumer's `package.json` as the per-module
type-check plus that module's tests, and run it after every edit:

```json
"check:fast": "tsc --noEmit -p src/features/$MODULE/tsconfig.json && tsx --test src/features/$MODULE/*.test.ts"
```

```sh
MODULE=greeting npm run check:fast
```

Replace `tsx --test` with the project's test runner. Run the full type-check and
test suite before merging: [review a merge](docs/agent/recipes.md#review-merge).

## Recipes

- [Add a request-scoped service with cleanup](docs/agent/recipes.md#add-scoped-service)
- [Write a fixture test with an independent container](docs/agent/recipes.md#fixture-test)
- [Split a feature into a module with private services](docs/agent/recipes.md#split-module)
- [Debug a missing-dependency rejection](docs/agent/recipes.md#debug-missing-dependency)
- [Add and consume an async client](docs/agent/recipes.md#async-client)
- [Review a merge](docs/agent/recipes.md#review-merge)
