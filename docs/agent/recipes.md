# Recipes {#recipes}

Six tasks in the [module layout](../../AGENTS.md#module-layout). Code blocks start
with their file path; the files on this page form one application. Every module
directory also has the `tsconfig.json` and check command from
[Check one module](../../AGENTS.md#check-one-module).

## Add a request-scoped service with cleanup {#add-scoped-service}

Providers are scoped per container by default, so each child gets its own request state and consumers.
Explicit scoped marks document that intent; `providerWithDisposal` releases owned instances when the child closes.

```ts
// src/features/audit/contract.ts
export type Audit = { record(event: string): void; flush(): Promise<void> };
export type AuditSink = { write(lines: readonly string[]): Promise<void> };
```

```ts
// src/features/audit/module.ts
import { DiBag } from 'di-bag';
import type { Audit, AuditSink } from './contract.js';
export const auditModule = DiBag.createBuilder().withServices({
    audit: DiBag.providerWithLifetime({
      provider: DiBag.providerWithDisposal({
        provider: ({ sink }: { sink: AuditSink }): Audit => {
          const lines: string[] = [];
          return { record: event => { lines.push(event); }, flush: () => sink.write(lines.splice(0)) };
        },
        disposeService: audit => audit.flush(),
      }), lifetime: 'scoped:one-per-container' }),
}).buildModule({ exportedServiceKeys: ['audit'] });
```

```ts
// src/features/audit/check.ts
import { DiBag } from 'di-bag';
import type { AuditSink } from './contract.js';
import { auditModule } from './module.js';
DiBag.createBuilder().withInstalledModules([auditModule])
  .withServices({ sink: (): AuditSink => ({ write: async () => {} }) })
  .verifyGraphAtCompileTime() satisfies void;
```

Open one child container per request and close it when the request ends:

```ts
// src/server.ts
import { DiBag } from 'di-bag';
import type { Audit } from './features/audit/contract.js';
import { composition } from './app.js';
type RequestContext = { requestId: string };
const app = composition.withServices({
  request: DiBag.providerWithLifetime({ provider: (): RequestContext => ({ requestId: 'outside-request' }), lifetime: 'scoped:one-per-container' }),
  handler: DiBag.providerWithLifetime({
    provider: ({ request, audit }: { request: RequestContext; audit: Audit }) => ({ run() { audit.record(`request:${request.requestId}`); } }),
    lifetime: 'scoped:one-per-container',
  }),
}).buildContainer();
export async function handle(requestId: string) {
  const requestContainer = app.createChildContainer(['request'], { request: (): RequestContext => ({ requestId }) });
  try { requestContainer.resolve('handler').run(); }
  finally { await requestContainer.close(); } // flushes this request's audit
}
export async function shutdown() { await app.close(); }
```

## Write a fixture test with an independent container {#fixture-test}

Build the module once with a default for each requirement that fails if used,
then give each test an independent container with its own fixture. Independent containers are separate: close
each one.

```ts
// src/features/audit/audit.test.ts
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { DiBag } from 'di-bag';
import type { AuditSink } from './contract.js';
import { auditModule } from './module.js';

const fixture = DiBag.createBuilder()
  .withInstalledModules([
    auditModule,
  ])
  .withServices({ sink: (): AuditSink => ({ write: async () => { throw new Error('supply a sink'); } }) })
  .buildContainer();
after(() => fixture.close());

test('closing a child container flushes what it recorded', async () => {
  const written: string[][] = [];
  const testContainer = fixture.createIndependentContainer(['sink'], {
    sink: (): AuditSink => ({ write: async lines => { written.push([...lines]); } }),
  });
  try {
    const request = testContainer.createChildContainer();
    request.resolve('audit').record('GET /');
    await request.close();
    assert.deepEqual(written, [['GET /']]);
  } finally {
    await testContainer.close();
  }
});
```

Run it with the module's [fast check](../../AGENTS.md#fast-check).

## Build one composite from collection members

Use separate identities for the composite service and its ordered members. A collection token supplies a fresh frozen list directly in a positional dependency.

```ts
import { DiBag } from 'di-bag';

type Logger = { log(message: string): void };

const loggerKey = Symbol('logger');
const loggerSinksKey = Symbol('logger sinks');
const logger = DiBag.createToken(loggerKey).forService<Logger>();
const loggerSinks = DiBag.createToken(loggerSinksKey).forCollectionOf<Logger>();

const container = DiBag.createBuilder()
  .withCollectionContribution({ collectionToken: loggerSinks, provider: (): Logger => ({ log: message => console.log(message) }) })
  .withCollectionContribution({ collectionToken: loggerSinks, provider: (): Logger => ({ log: message => { process.stderr.write(`${message}\n`); } }) })
  .withTokenService(
    logger,
    DiBag.createProviderFromFunction({ dependencies: [loggerSinks], factoryFunction: sinks => ({
      log(message: string) { for (const sink of sinks) sink.log(message); },
    }) }),
  )
  .buildContainer();

container.resolve(logger).log('ready');
await container.close();
```

A token created with `.forService<Service>()` cannot receive contributions, and a token created with `.forCollectionOf<Item>()` cannot hold the composite service.

## Split a feature into a module with private services {#split-module}

1. Create `src/features/billing/` and move the types other code uses into
   `contract.ts`: what the module exports and what it requires from the host.
2. Move helpers into private files. Their registration names stay inside the
   module, so another module may also define a `store`.
3. Register the factories in `module.ts`, export only the entry points, and pass
   `{ label: 'billing' }` so runtime messages name private services `billing/store`.
4. Add `check.ts` and `tsconfig.json`, run the per-module check, then replace
   the old registrations in `src/app.ts` with `.withInstalledModules([billingModule])`.

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
import { DiBag } from 'di-bag';
import type { Billing, PaymentGateway } from './contract.js';
import { createStore, type Store } from './store.js';

export const billingModule = DiBag.createBuilder()
  .withServices({
    store: createStore,
    billing: ({ store, gateway }: { store: Store; gateway: PaymentGateway }): Billing => ({
      async charge(orderId, cents) {
        const receipt = store.get(orderId) ?? await gateway.charge(cents);
        store.set(orderId, receipt);
        return receipt;
      },
    }),
  })
  .buildModule({ exportedServiceKeys: ['billing'], moduleLabel: 'billing' });
```

```ts
// src/features/billing/check.ts
import { DiBag } from 'di-bag';
import type { PaymentGateway } from './contract.js';
import { billingModule } from './module.js';

DiBag.createBuilder()
  .withInstalledModules([
    billingModule,
  ])
  .withServices({ gateway: (): PaymentGateway => ({ charge: async () => 'receipt' }) })
  .verifyGraphAtCompileTime() satisfies void;
```

## Debug a missing-dependency rejection {#debug-missing-dependency}

Without the `gateway` fixture, `check.ts` fails on the `verifyGraphAtCompileTime()` line:

```ts
// src/features/billing/check.ts
// expect-error: required services are missing: gateway
import { DiBag } from 'di-bag';
import { billingModule } from './module.js';

DiBag.createBuilder()
  .withInstalledModules([
    billingModule,
  ])
  .verifyGraphAtCompileTime() satisfies void;
```

1. The text after `missing:` lists the keys. Without `verifyGraphAtCompileTime()`, the same
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

The client is created once for the container tree, awaited by consumers, and
closed with the root container. Its configuration must use the singleton lifetime too.

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
import { DiBag } from 'di-bag';
import { connect } from './client.js';
import type { Catalog, Db, DbConfig } from './contract.js';

const source = DiBag.createProvider(async ({ config }: { config: DbConfig }) => connect(config.url), { factoryReturnKind: 'native-promise' });
const registered = DiBag.providerWithRegistrationMetadata({ provider: source, registrationMetadata: { owner: 'platform' } });
const observed = DiBag.providerWithAcquisitionMetadata({ provider: registered, callbackReceives: 'fulfilled-value', describeAcquisition: () => ({ driver: 'database' }) });
const mapped = DiBag.providerWithTransformedService({ provider: observed, callbackReceives: 'fulfilled-value', transformService: connection => connection });
const owned = DiBag.providerWithDisposal({ provider: mapped, disposeService: connection => connection.end() });
const database = DiBag.providerWithLifetime({ provider: owned, lifetime: 'singleton:one-per-container-tree' });

export const catalogModule = DiBag.createBuilder()
  .withServices({
    db: database,
    catalog: ({ db }: { db: Promise<Db> }): Catalog => ({
      names: async () => (await db).query('select name from products'),
    }),
  })
  .buildModule({ exportedServiceKeys: ['catalog'] });
```

```ts
// src/features/catalog/check.ts
import { DiBag } from 'di-bag';
import type { DbConfig } from './contract.js';
import { catalogModule } from './module.js';

DiBag.createBuilder().withInstalledModules([catalogModule])
  .withServices({ config: DiBag.providerWithLifetime({ provider: (): DbConfig => ({ url: 'memory:' }), lifetime: 'singleton:one-per-container-tree' }) })
  .verifyGraphAtCompileTime() satisfies void;
```

A scoped `config` fails with `singleton lifetime cannot capture scoped dependency: db -> config`.
If a driver returns a query builder, return `Promise.resolve(builder)`; see
[structural thenable](errors.md#structural-thenable).

## Own a resource a factory acquires on the way {#partial-acquisition}

`providerWithDisposal` owns the value a provider *returns*; `pushDisposer` owns what the
factory acquires on the way. A resource that is both — acquired before the
factory can fail, then returned — gets both, with a reason check on the push.

```ts
// src/features/feed/contract.ts
export type Socket = { send(text: string): Promise<void>; close(): Promise<void> };
export type Feed = { publish(text: string): Promise<void> };
export type FeedConfig = { url: string; token: string };
```

```ts
// src/features/feed/client.ts
import type { Socket } from './contract.js';

export async function open(url: string): Promise<Socket> {
  return { send: async () => {}, close: async () => {} }; // a driver's connect()
}
export async function authenticate(socket: Socket, token: string): Promise<void> {
  await socket.send(token); // rejects on a bad token, after the socket is open
}
```

```ts
// src/features/feed/module.ts
import { DiBag } from 'di-bag';
import { authenticate, open } from './client.js';
import type { Feed, FeedConfig, Socket } from './contract.js';

export const feedModule = DiBag.createBuilder()
  .withServices({
    socket: DiBag.providerWithDisposal({ provider: DiBag.createProvider(async ({ config }: { config: FeedConfig }, factoryContext): Promise<Socket> => {
      const socket = await open(config.url);
      factoryContext.pushDisposer(disposerContext => { if (disposerContext.reason !== 'service-disposed') return socket.close(); });
      await authenticate(socket, config.token);
      return socket;
    }, { factoryReceivesContext: true }), disposeService: socket => socket.close() }),
    feed: ({ socket }: { socket: Promise<Socket> }): Feed => ({
      publish: async text => (await socket).send(text),
    }),
  })
  .buildModule({ exportedServiceKeys: ['feed'] });
```

A pushed disposer runs exactly once, last pushed first: at once if the factory
fails, otherwise at `close()` after the `providerWithDisposal` disposer. A failed
handshake closes the socket through the push; a clean shutdown closes it through
`providerWithDisposal`, and the push sees `'service-disposed'` and does nothing. The
reason describes `providerWithDisposal` on the returned value, not ownership a
consumer attaches to a transformed value. A rejecting disposer is reported
through [`DI_BAG_DISPOSAL_FAILED`](errors.md#di-bag-disposal-failed); pushing after
the factory settled throws [`DI_BAG_DISPOSER_PUSHED_AFTER_FACTORY`](errors.md#di-bag-disposer-pushed-after-factory).

## Make a graph portable to browsers and workers {#portable-graph}

Hosts without `process.getBuiltinModule` cannot classify Promises, so every registration states its factory kind; the same module then runs on Node, Bun, Deno, and in a browser Worker.

```ts
// src/features/search/contract.ts
export type Index = { lookup(term: string): Promise<string[]>; close(): Promise<void> };
export type IndexConfig = { url: string }; export type Search = { find(term: string): Promise<string[]> };
```

```ts
// src/features/search/module.ts
import { DiBag } from 'di-bag';
import type { Index, IndexConfig, Search } from './contract.js';
export const searchModule = DiBag.createBuilder().withServices({
  index: DiBag.providerWithLifetime({
    provider: DiBag.providerWithDisposal({
      provider: DiBag.createProvider(async ({ config }: { config: IndexConfig }): Promise<Index> => ({
      lookup: async term => [`${config.url}#${term}`],
      close: async () => {},
      }), { factoryReturnKind: 'native-promise' }),
      disposeService: index => index.close(),
    }),
    lifetime: 'singleton:one-per-container-tree',
  }),
  search: DiBag.createProvider(({ index }: { index: Promise<Index> }): Search => ({
    find: async term => (await index).lookup(term),
  }), { factoryReturnKind: 'sync-value' }),
}).buildModule({ exportedServiceKeys: ['search'], moduleLabel: 'search' });
```

```ts
// src/features/search/check.ts
import { DiBag } from 'di-bag';
import type { IndexConfig } from './contract.js';
import { searchModule } from './module.js';
DiBag.createBuilder().withInstalledModules([searchModule]).withServices({ config: DiBag.providerWithLifetime({ provider: DiBag.createProvider((): IndexConfig => ({ url: 'memory:' }), { factoryReturnKind: 'sync-value' }), lifetime: 'singleton:one-per-container-tree' }) })
  .verifyGraphAtCompileTime() satisfies void;
```

`factoryReturnKind: 'sync-value'` makes the exact synchronous value the service, never reads `then`, and rejects Promise and structural-thenable outputs at compile time.
`'native-promise'` requires a native Promise, exposes that Promise, and gives its fulfilled value to disposal callbacks.
`'uninspected'` preserves the exact returned value, including a Promise or structural thenable.
Omit the option for `'auto-detect'` on hosts with a native-Promise classifier.

```ts
import { DiBag } from 'di-bag';
type Config = { url: string };
declare function openCatalog(url: string): Promise<{ url: string }>;
declare function knex(table: string): { readonly table: string; then(resolve: (value: string) => void): void };
const config = DiBag.createProvider((): Config => ({ url: 'memory:' }), { factoryReturnKind: 'sync-value' });
const catalog = DiBag.createProvider(async ({ config }: { config: Config }) => openCatalog(config.url), {
  factoryReturnKind: 'native-promise',
});
const query = DiBag.createProvider(() => knex('users'), { factoryReturnKind: 'uninspected' });
const app = DiBag.createBuilder().withServices({ config, catalog, query }).buildContainer();
```

An auto-detect registration fails `buildContainer()` with [`DI_BAG_CLASSIFIER_REQUIRED`](errors.md#di-bag-classifier-required) on hosts without a native-Promise classifier; the error names the registration.

## Review a merge {#review-merge}

The merge check is `src/app.check.ts` plus the full test suite. `src/app.ts`
installs its modules together and supplies what the modules require.

```ts
// src/app.ts
import { DiBag } from 'di-bag';
import type { AuditSink } from './features/audit/contract.js';
import { auditModule } from './features/audit/module.js';
import type { PaymentGateway } from './features/billing/contract.js';
import { billingModule } from './features/billing/module.js';
import type { DbConfig } from './features/catalog/contract.js';
import { catalogModule } from './features/catalog/module.js';

export const composition = DiBag.createBuilder()
  .withInstalledModules([
    auditModule,
    billingModule,
    catalogModule,
  ])
  .withServices({
    config: DiBag.providerWithLifetime({ provider: (): DbConfig => ({ url: 'memory:' }), lifetime: 'singleton:one-per-container-tree' }),
    gateway: (): PaymentGateway => ({ charge: async cents => `receipt:${cents}` }),
    sink: (): AuditSink => ({ write: async lines => { console.log(lines.join('\n')); } }),
  });
```

```ts
// src/app.check.ts
import { composition } from './app.js';

composition.verifyGraphAtCompileTime() satisfies void;
```

1. Resolve conflicts in `src/app.ts` by keeping every module in the `withInstalledModules` list.
2. `npx tsc --noEmit -p tsconfig.json` checks `src/app.check.ts`: a requirement
   no branch supplies, or a contract one branch changed under another's
   consumer, fails there by name.
3. Run the full test suite.
4. Optionally, in CI: `npx di-bag-graph --check` exits 1 on dependency cycles
   and unresolved names before any factory runs. It reads `./tsconfig.json`
   unless `--project` names another, and needs its own package:
   `npm install --save-dev di-bag-graph`. The type check does not see cycles;
   without this step they fail at first resolve with
   [`DI_BAG_DEPENDENCY_CYCLE`](errors.md#di-bag-dependency-cycle). The graph is a merge-review and CI
   artifact, not a map for finding code; the layout is the map. Options and
   output: [di-bag-graph README](https://github.com/dany-fedorov/di-bag/blob/main/tools/graph/README.md).

## Install modules that both require `config` {#rename-module-requirements}

Rename each module value at the install site. The factories still read `config`;
the host supplies the new names.

```ts
import { DiBag } from 'di-bag';
type OrdersConfig = { currency: string };
type BillingConfig = { vatRate: number };
const ordersModule = DiBag.createBuilder().withServices({
  orders: ({ config }: { config: OrdersConfig }) => config.currency,
}).buildModule({ exportedServiceKeys: ['orders'] });
const billingModule = DiBag.createBuilder().withServices({
  billing: ({ config }: { config: BillingConfig }) => config.vatRate,
}).buildModule({ exportedServiceKeys: ['billing'] });

const app = DiBag.createBuilder()
  .withInstalledModules([
    ordersModule.withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'ordersConfig' }),
    billingModule.withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'billingConfig' }),
  ])
  .withServices({
    ordersConfig: (): OrdersConfig => ({ currency: 'EUR' }),
    billingConfig: (): BillingConfig => ({ vatRate: 0.2 }),
  })
  .buildContainer();
console.log(app.resolve('orders'), app.resolve('billing'));
await app.close();
```
