# DI Bag: notes for coding agents

DI Bag composes TypeScript factories into a dependency graph that the compiler
checks. Modules keep a feature's services private behind exported keys; a bag
creates services on first use and releases what it owns when closed.

This file ships in `node_modules/di-bag/`. Task recipes are in
[docs/agent/recipes.md](docs/agent/recipes.md); every compiler and runtime
message is in [docs/agent/errors.md](docs/agent/errors.md).

## Rules

1. **Import from `di-bag/node` in Node and Bun:** `import { DiBag } from 'di-bag/node';`.
   The bare `di-bag` entry is the portable core; there `build()` throws
   [`DI_BAG_CLASSIFIER_REQUIRED`](docs/agent/errors.md#di-bag-classifier-required)
   unless you configure `DiBag.withConfiguration({ runtime: { isNativePromise } })`
   or give every factory an explicit `acquisitionMode`.
2. **A factory declares its dependencies in the type of its one object
   parameter; destructure it** (`({ clock }: { clock: Clock }) => ...`) or read
   `deps.clock` directly. The object is a Proxy that resolves each property when
   read: spreading it, `Object.keys`, `in`, and `JSON.stringify` throw
   [`DI_BAG_INVALID_DEPENDENCY_ACCESS`](docs/agent/errors.md#di-bag-invalid-dependency-access).
3. **Lifetimes.** The default is `scoped`: one instance per bag or child scope.
   Mark a shared client `DiBag.withLifetime(factory, 'root')` only when nothing
   it depends on is scoped; otherwise the compiler reports a
   [root capture](docs/agent/errors.md#root-capture) naming both keys.
   `'transient'` creates an instance on every read.
4. **Async is explicit.** An async factory's service is its Promise. A consumer
   declares `{ db: Promise<Db> }` and awaits it; nothing is awaited for you.
5. **No thenables.** A factory that returns a non-Promise object with a `then`
   method (query builders) is [rejected](docs/agent/errors.md#structural-thenable).
   Return `Promise.resolve(builder)` or use `DiBag.fromFactory(create, { acquisitionMode: 'raw' })`.
6. **Ownership.** `DiBag.withDisposal(factory, dispose)` makes the bag own the
   value; `close()` runs disposers, dependents first. Close every scope and fork
   you create. A parent closes its live scopes, never forks.
7. **Replace dependencies in tests with `fork(keys, overrides)`**; each
   override must satisfy the original contract.
8. **Modules.** Register a feature's factories, then `buildModule(['exported'])`.
   What its factories need and the module does not register becomes a
   requirement: the host that calls `installModule(module)` must register it.
   Pass `buildModule(keys, { label: 'billing' })` so messages name private
   services `billing/store`.
9. **Read a rejection at its name.** A graph error is an assignability error
   whose type is `Unsatisfied<"message", details>`, reported where the builder
   expression starts. `builder.verifyGraph() satisfies void;` reports the same
   message on its own line; `"noErrorTruncation": true` prints the details.
   Runtime errors carry `code` and `details`: branch on `code`, never on message
   text. The section for a code is `docs/agent/errors.md#<code>`, lower-cased
   with `_` replaced by `-`.

## Module layout

```text
src/features/invoicing/
  contract.ts        # exported service types and the requirements the host must supply
  module.ts          # buildModule([...]) over the private factories
  store.ts           # private services; free to use names other modules also use
  check.ts           # type-checks this module alone; never imported, not built
  tsconfig.json      # extends the root tsconfig and includes only this directory
  invoicing.test.ts
src/app.ts           # installs every module, one installModule call per line
src/app.check.ts     # verifyGraph() on the application builder: the merge check
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
import { DiBag } from 'di-bag/node';
import type { Greeter, GreetingConfig } from './contract.js';

export const greetingModule = DiBag.createBuilder()
  .register({
    greeter: ({ config }: { config: GreetingConfig }): Greeter => ({
      greet: name => `${config.greeting}, ${name}!`,
    }),
  })
  .buildModule(['greeter']);
```

`check.ts` is one statement: install the module, register a typed fixture for
each requirement, and verify.

```ts
// src/features/greeting/check.ts
import { DiBag } from 'di-bag/node';
import type { GreetingConfig } from './contract.js';
import { greetingModule } from './module.js';

DiBag.createBuilder()
  .installModule(greetingModule)
  .register({ config: (): GreetingConfig => ({ greeting: 'Hello' }) })
  .verifyGraph() satisfies void;
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
- [Write a fixture test with `fork`](docs/agent/recipes.md#fixture-test)
- [Split a feature into a module with private services](docs/agent/recipes.md#split-module)
- [Debug a missing-dependency rejection](docs/agent/recipes.md#debug-missing-dependency)
- [Add and consume an async client](docs/agent/recipes.md#async-client)
- [Review a merge](docs/agent/recipes.md#review-merge)
