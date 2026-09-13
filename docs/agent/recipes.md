# Recipes {#recipes}

Six tasks in the [module layout](../../AGENTS.md#module-layout). Code blocks start
with their file path; the files on this page form one application. Every module
directory also has the `tsconfig.json` and check command from
[Check one module](../../AGENTS.md#check-one-module).

## Add a request-scoped service with cleanup {#add-scoped-service}

Services are scoped by default: each `createScope()` gets its own instance, and
`withDisposal` releases it when that scope closes.

```ts
// src/features/audit/contract.ts
export type Audit = { record(event: string): void; flush(): Promise<void> };
export type AuditSink = { write(lines: readonly string[]): Promise<void> };
```

```ts
// src/features/audit/module.ts
import { DiBag } from 'di-bag/node';
import type { Audit, AuditSink } from './contract.js';

export const auditModule = DiBag.createBuilder()
  .register({
    audit: DiBag.withDisposal(
      ({ sink }: { sink: AuditSink }): Audit => {
        const lines: string[] = [];
        return { record: event => { lines.push(event); }, flush: () => sink.write(lines.splice(0)) };
      },
      audit => audit.flush(),
    ),
  })
  .buildModule(['audit']);
```

```ts
// src/features/audit/check.ts
import { DiBag } from 'di-bag/node';
import type { AuditSink } from './contract.js';
import { auditModule } from './module.js';

DiBag.createBuilder()
  .installModule(auditModule)
  .register({ sink: (): AuditSink => ({ write: async () => {} }) })
  .verifyGraph() satisfies void;
```

Open one scope per request and close it when the request ends:

```ts
// src/server.ts
import { composition } from './app.js';

const app = composition.build();
export async function handle(path: string) {
  const scope = app.createScope();
  try {
    scope.resolve('audit').record(path);
  } finally {
    await scope.close(); // runs this request's disposers
  }
}
```

## Write a fixture test with `fork` {#fixture-test}

Build the module once with a default for each requirement that fails if used,
then give each test a fork with its own fixture. Forks are independent: close
each one.

```ts
// src/features/audit/audit.test.ts
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { DiBag } from 'di-bag/node';
import type { AuditSink } from './contract.js';
import { auditModule } from './module.js';

const fixture = DiBag.createBuilder()
  .installModule(auditModule)
  .register({ sink: (): AuditSink => ({ write: async () => { throw new Error('supply a sink'); } }) })
  .build();
after(() => fixture.close());

test('closing a scope flushes what it recorded', async () => {
  const written: string[][] = [];
  const bag = fixture.fork(['sink'], {
    sink: (): AuditSink => ({ write: async lines => { written.push([...lines]); } }),
  });
  try {
    const scope = bag.createScope();
    scope.resolve('audit').record('GET /');
    await scope.close();
    assert.deepEqual(written, [['GET /']]);
  } finally {
    await bag.close();
  }
});
```

Run it with the module's [fast check](../../AGENTS.md#fast-check).

## Split a feature into a module with private services {#split-module}

1. Create `src/features/billing/` and move the types other code uses into
   `contract.ts`: what the module exports and what it requires from the host.
2. Move helpers into private files. Their registration names stay inside the
   module, so another module may also register a `store`.
3. Register the factories in `module.ts`, export only the entry points, and pass
   `{ label: 'billing' }` so runtime messages name private services `billing/store`.
4. Add `check.ts` and `tsconfig.json`, run the per-module check, then replace
   the old registrations in `src/app.ts` with `.installModule(billingModule)`.

```ts
// src/features/billing/contract.ts
export type Billing = { charge(orderId: string, cents: number): Promise<string> };
export type PaymentGateway = { charge(cents: number): Promise<string> };
```

```ts
// src/features/billing/store.ts
export const createStore = () => new Map<string, string>();
export type Store = ReturnType<typeof createStore>;
```

```ts
// src/features/billing/module.ts
import { DiBag } from 'di-bag/node';
import type { Billing, PaymentGateway } from './contract.js';
import { createStore, type Store } from './store.js';

export const billingModule = DiBag.createBuilder()
  .register({
    store: createStore,
    billing: ({ store, gateway }: { store: Store; gateway: PaymentGateway }): Billing => ({
      async charge(orderId, cents) {
        const receipt = store.get(orderId) ?? await gateway.charge(cents);
        store.set(orderId, receipt);
        return receipt;
      },
    }),
  })
  .buildModule(['billing'], { label: 'billing' });
```

```ts
// src/features/billing/check.ts
import { DiBag } from 'di-bag/node';
import type { PaymentGateway } from './contract.js';
import { billingModule } from './module.js';

DiBag.createBuilder()
  .installModule(billingModule)
  .register({ gateway: (): PaymentGateway => ({ charge: async () => 'receipt' }) })
  .verifyGraph() satisfies void;
```

## Debug a missing-dependency rejection {#debug-missing-dependency}

Without the `gateway` fixture, `check.ts` fails on the `verifyGraph()` line:

```ts
// src/features/billing/check.ts
// expect-error: required service registrations are missing: gateway
import { DiBag } from 'di-bag/node';
import { billingModule } from './module.js';

DiBag.createBuilder()
  .installModule(billingModule)
  .verifyGraph() satisfies void;
```

1. The text after `missing:` lists the keys. Without `verifyGraph()`, the same
   message appears where the builder expression starts.
2. Find who declares the key: `grep -rn "gateway" src/features/*/contract.ts src/features/*/module.ts`.
3. Decide where it belongs. A dependency the module requires is registered by
   the host (`src/app.ts`) and by `check.ts` and tests as a typed fixture. Add it
   to the module only if the module should own the implementation.
4. Rerun the [per-module check](../../AGENTS.md#check-one-module) and
   `src/app.check.ts`.

At runtime the same problem is
[`DI_BAG_MISSING_DEPENDENCY`](errors.md#di-bag-missing-dependency): `details.path`
is the resolution chain and `details.dependency` the key. It is reachable only
when a cast, `any`, or JavaScript hid the dependency from the compiler; remove
the cast rather than adding a registration by trial.

## Add and consume an async client {#async-client}

The client is created once for the application (`root`), awaited by
consumers, and closed with the root bag. Its configuration must be root too.

```ts
// src/features/catalog/contract.ts
export type Catalog = { names(): Promise<string[]> };
export type Db = { query(sql: string): Promise<string[]>; end(): Promise<void> };
export type DbConfig = { url: string };
```

```ts
// src/features/catalog/client.ts
import type { Db } from './contract.js';

export async function connect(url: string): Promise<Db> {
  return { query: async () => [url], end: async () => {} }; // a driver's connect()
}
```

```ts
// src/features/catalog/module.ts
import { DiBag } from 'di-bag/node';
import { connect } from './client.js';
import type { Catalog, Db, DbConfig } from './contract.js';

export const catalogModule = DiBag.createBuilder()
  .register({
    db: DiBag.withLifetime(
      DiBag.withDisposal(({ config }: { config: DbConfig }) => connect(config.url), db => db.end()),
      'root',
    ),
    catalog: ({ db }: { db: Promise<Db> }): Catalog => ({
      names: async () => (await db).query('select name from products'),
    }),
  })
  .buildModule(['catalog']);
```

```ts
// src/features/catalog/check.ts
import { DiBag } from 'di-bag/node';
import type { DbConfig } from './contract.js';
import { catalogModule } from './module.js';

DiBag.createBuilder()
  .installModule(catalogModule)
  .register({ config: DiBag.withLifetime((): DbConfig => ({ url: 'memory:' }), 'root') })
  .verifyGraph() satisfies void;
```

A scoped `config` fails with `root lifetime cannot capture scoped dependency: db -> config`.
If a driver returns a query builder, return `Promise.resolve(builder)`; see
[structural thenable](errors.md#structural-thenable).

## Review a merge {#review-merge}

The merge check is `src/app.check.ts` plus the full test suite. `src/app.ts`
installs one module per line and registers what the modules require.

```ts
// src/app.ts
import { DiBag } from 'di-bag/node';
import type { AuditSink } from './features/audit/contract.js';
import { auditModule } from './features/audit/module.js';
import type { PaymentGateway } from './features/billing/contract.js';
import { billingModule } from './features/billing/module.js';
import type { DbConfig } from './features/catalog/contract.js';
import { catalogModule } from './features/catalog/module.js';

export const composition = DiBag.createBuilder()
  .installModule(auditModule)
  .installModule(billingModule)
  .installModule(catalogModule)
  .register({
    config: DiBag.withLifetime((): DbConfig => ({ url: 'memory:' }), 'root'),
    gateway: (): PaymentGateway => ({ charge: async cents => `receipt:${cents}` }),
    sink: (): AuditSink => ({ write: async lines => { console.log(lines.join('\n')); } }),
  });
```

```ts
// src/app.check.ts
import { composition } from './app.js';

composition.verifyGraph() satisfies void;
```

1. Resolve conflicts in `src/app.ts` by keeping every `installModule` line.
2. `npx tsc --noEmit -p tsconfig.json` checks `src/app.check.ts`: a requirement
   no branch registers, or a contract one branch changed under another's
   consumer, fails there by name.
3. Run the full test suite.
4. Optionally, in CI: `npx di-bag-graph --project tsconfig.json --check` exits 1
   on dependency cycles and unresolved names before any factory runs. The type
   check does not see cycles; without this step they fail at first resolve with
   [`DI_BAG_CYCLE`](errors.md#di-bag-cycle). The graph is a merge-review and CI
   artifact, not a map for finding code; the layout is the map.
