# Swift API style: worked examples

Companion to [Swift API style for DI Bag](2026-09-20-swift-api-style.md). Every
example uses the proposed 0.5.0 names. Where the shape changes a lot, the 0.4.0
code comes first. The 0.4.0 snippets are taken from `examples/`, the tutorial and
the server guide. Nothing here type-checks yet: 0.5.0 does not exist.

## 1. Boot a server: connect first, then listen

The database and the cache must be connected before the server accepts traffic.
The mailer stays lazy.

```ts
// 0.4.0
const app = await DiBag.createBuilder()
  .register({
    config: DiBag.withLifetime(() => loadConfig(), 'root'),
    db: DiBag.withLifetime(
      DiBag.withDisposal(
        async ({ config }: { config: Config }) => connectToDatabase(config.databaseUrl),
        db => db.end(),
      ),
      'root',
    ),
    cache: DiBag.withLifetime(
      DiBag.withDisposal(
        async ({ config }: { config: Config }) => connectToCache(config.cacheUrl),
        cache => cache.quit(),
      ),
      'root',
    ),
    mailer: ({ config }: { config: Config }) => createMailer(config.smtpUrl),
  })
  .buildAndStart(['db', 'cache'], { timeoutMs: 10_000, signal: shutdown.signal, startupOrder: 2 });
```

```ts
// 0.5.0
const app = await DiBag.createBuilder()
  .withServices({
    config: () => loadConfig(),
    db: DiBag.createProvider(async ({ config }: { config: Config }) => connectToDatabase(config.databaseUrl))
      .withDisposal(db => db.end()),
    cache: DiBag.createProvider(async ({ config }: { config: Config }) => connectToCache(config.cacheUrl))
      .withDisposal(cache => cache.quit()),
    mailer: ({ config }: { config: Config }) => createMailer(config.smtpUrl),
  })
  .buildContainer()
  .ensureServicesReady(['db', 'cache'], {
    totalTimeoutMs: 10_000,
    abortSignal: shutdown.signal,
    maxConcurrentServiceKeys: 2,
  });

server.listen(3000);
```

- Decorators read top to bottom in the order they apply, not inside out.
- The three `'root'` marks are gone: a singleton per container tree is the default.
- The list says what to wait for. `config` comes along as a dependency.
- If the cache fails or the deadline passes, the container closes and the database
  connection is released.

## 2. One child container per request

```ts
// 0.4.0
const scope = app.createScope(['request'], { request: () => ({ id: requestId }) });
```

```ts
// 0.5.0
const requestContainer = app.createChildContainer({
  replacedServiceKeys: ['request'],
  replacementProviders: { request: () => ({ id: requestId }) },
});
try {
  return await requestContainer.resolve('handler').list();
} finally {
  await requestContainer.close();
}
```

- `request` is registered with `.withLifetime('scoped:one-per-container')`. A child container may
  replace only scoped and transient services, because a singleton consumer would silently keep
  the root's value.
- "Child" says who closes it: the parent closes its live child containers, and you may
  close one earlier.
- The keys are listed separately from the providers on purpose. TypeScript lets
  an object carry extra properties when it comes from a variable, so the tuple
  is what pins the checked keys to the runtime keys.
- New in 0.5.0, a child container can be warmed with a deadline:

```ts
const requestContainer = await app
  .createChildContainer({ replacedServiceKeys: ['request'], replacementProviders: { request: () => ({ id: requestId }) } })
  .ensureServicesReady(['session'], { totalTimeoutMs: 2_000 });
```

## 3. A child container that borrows a parent service

```ts
// 0.4.0
const child = root.createScope(['config'], { config: () => ({ region: 'us' }) }, { share: ['session'] });
const grandchild = child.createScope({ share: ['session'] });
```

```ts
// 0.5.0
const child = root.createChildContainer({
  replacedServiceKeys: ['config'],
  replacementProviders: { config: () => ({ region: 'us' }) },
  sharedParentServiceKeys: ['session'],
});
const grandchild = child.createChildContainer({ sharedParentServiceKeys: ['session'] });

child.resolve('session') === root.resolve('session'); // true: borrowed, and the child never disposes it
// `config` and `session` are marked 'scoped:one-per-container'. Singletons need no borrowing: every container of the tree already uses them.
```

## 4. Tests: an independent container with fakes

```ts
// 0.4.0
const testApp = app.fork(['clock'], { clock: (): Clock => ({ now: () => 0 }) });
```

```ts
// 0.5.0
const testApp = app.createIndependentContainer({
  replacedServiceKeys: ['clock', controllersToken],
  replacementProviders: {
    clock: (): Clock => ({ now: () => 0 }),
    [controllersToken.symbol]: (): readonly Controller[] => [fakeController], // a whole list, new in 0.5.0
  },
});
try {
  expect(testApp.resolve('stamp')).toBe(0);
} finally {
  await testApp.close(); // "independent": the app never closes it
}
```

## 5. A feature module and its check file

```ts
// src/features/greeting/module.ts
export const greetingModule = DiBag.createBuilder()
  .withServices({
    templates: () => new Map([['en', 'Hello']]), // private to the module
    greeter: ({ config, templates }: { config: GreetingConfig; templates: Map<string, string> }): Greeter => ({
      greet: name => `${templates.get(config.language) ?? 'Hello'}, ${name}!`,
    }),
  })
  .buildModule({ exportedServiceKeys: ['greeter'], moduleLabel: 'greeting' });
```

```ts
// src/features/greeting/check.ts
DiBag.createBuilder()
  .withInstalledModules([greetingModule])
  .withServices({ config: (): GreetingConfig => ({ language: 'en' }) })
  .verifyGraphAtCompileTime() satisfies void;
```

- `exportedServiceKeys` names what the list is. In 0.4.0, `buildModule(['greeter'])`
  read as "build the module greeter".
- `verifyGraphAtCompileTime` says that the call does nothing when it runs.

## 6. Two modules that both require `config`

```ts
// 0.4.0: a wrapper module per collision
const ordersForThisApp = DiBag.createBuilder()
  .installModule(ordersModule)
  .register({ config: ({ ordersConfig }: { ordersConfig: OrdersConfig }) => ordersConfig }) // adapter service
  .buildModule(['handler']);                                                                // re-export by hand
```

```ts
// 0.5.0
const app = DiBag.createBuilder()
  .withInstalledModules([
    ordersModule
      .withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'ordersConfig' })
      .withRenamedExport({ currentExportKey: 'handler', newExportKey: 'ordersHandler' }),
    billingModule
      .withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'billingConfig' })
      .withRenamedExport({ currentExportKey: 'handler', newExportKey: 'billingHandler' }),
  ])
  .withServices({
    ordersConfig: (): OrdersConfig => ({ currency: 'EUR' }),
    billingConfig: (): BillingConfig => ({ vatRate: 0.2 }),
  })
  .buildContainer();
```

A renamed module is a value, so it can also be exported once and installed by
several hosts.

## 7. A list that modules add to: API controllers

```ts
const controllersToken = DiBag.createToken(controllersSymbol).forCollectionOf<Controller>();

// inside the users module, which exports nothing
const usersModule = DiBag.createBuilder()
  .withServices({ usersRepository: createUsersRepository })
  .withCollectionContribution({
    collectionToken: controllersToken,
    provider: ({ usersRepository }: { usersRepository: UsersRepository }): Controller =>
      new UsersController(usersRepository),
  })
  .buildModule({ exportedServiceKeys: [], moduleLabel: 'users' });

// the app never names a controller
const app = DiBag.createBuilder()
  .withInstalledModules([usersModule, ordersModule])
  .withServiceAlias({ aliasKey: 'controllers', targetServiceKey: controllersToken })
  .withServices({
    router: ({ controllers }: { controllers: readonly Controller[] }) => createRouter(controllers),
  })
  .buildContainer();

app.resolve(controllersToken); // readonly Controller[]
```

- In 0.4.0 the router had to be a positional `fromFunction([DiBag.all(step)], …)`.
  Now a collection token is an ordinary key, so an alias gives the list a name
  and the router is a normal named factory.
- Contributing to a single-service token does not compile, and neither does
  registering a single service under `controllersToken`.

## 8. The composite: one logger that fans out to many sinks

```ts
const loggerToken      = DiBag.createToken(loggerSymbol).forService<Logger>();
const loggerSinksToken = DiBag.createToken(loggerSinksSymbol).forCollectionOf<Logger>();

const app = DiBag.createBuilder()
  .withCollectionContribution({ collectionToken: loggerSinksToken, provider: createConsoleSink })
  .withCollectionContribution({ collectionToken: loggerSinksToken, provider: createFileSink })
  .withTokenService({
    token: loggerToken,
    provider: DiBag.createProviderFromFunction({
      dependencies: [loggerSinksToken],
      factoryFunction: sinks => createFanOutLogger(sinks),
    }),
  })
  .buildContainer();
```

This is the one design that used both channels of a single token in 0.4.0. It
now needs two tokens, and the names say which is which.

## 9. Tokens with a class, an optional and a lazy dependency

```ts
// 0.4.0
const reporter = DiBag.fromClass([DiBag.lazy(port), DiBag.optional(host)], Reporter);
```

```ts
// 0.5.0
const portToken = DiBag.createToken(portSymbol).forService<number>();
const hostToken = DiBag.createToken(hostSymbol).forService<string>();

const reporter = DiBag.createProviderFromClass({
  dependencies: [DiBag.lazy(portToken), DiBag.optional(hostToken)],
  serviceClass: Reporter, // constructor(getPort: () => number, host: string | undefined)
});

const app = DiBag.createBuilder()
  .withTokenService({ token: portToken, provider: () => 8080 })
  .withServices({ reporter })
  .buildContainer();
```

## 10. The factory context: cancel, and release what was acquired on the way

```ts
const session = DiBag.createProvider(
  async ({ config }: { config: Config }, factoryContext) => {
    const socket = await connect(config.url, { signal: factoryContext.abortSignal });
    factoryContext.pushDisposer(disposerContext => {
      if (disposerContext.reason !== 'service-disposed') socket.destroy();
    });
    await handshake(socket); // if this throws, the socket is released at once
    return new Session(socket);
  },
  { factoryReceivesContext: true },
).withDisposal(session => session.close());
```

New in 0.5.0, a factory that takes tokens can receive the context too. It comes
last:

```ts
const settings = DiBag.createProviderFromFunction({
  dependencies: [configToken],
  factoryReceivesContext: true,
  factoryFunction: async (config, factoryContext) =>
    fetchSettings(config.url, { signal: factoryContext.abortSignal }),
});
```

## 11. A browser or worker graph, and a query builder

```ts
// 0.4.0
config:  DiBag.fromSyncFactory((): Config => ({ url: 'memory:' })),
catalog: DiBag.withDisposal(DiBag.fromAsyncFactory(async ({ config }) => openCatalog(config.url)), c => c.close()),
query:   DiBag.fromFactory(() => knex('users').where({ active: true }), { acquisitionMode: 'raw' }),
```

```ts
// 0.5.0
config:  DiBag.createProvider((): Config => ({ url: 'memory:' }), { factoryReturnKind: 'sync-value' }),
catalog: DiBag.createProvider(async ({ config }: { config: Config }) => openCatalog(config.url), {
           factoryReturnKind: 'native-promise',
         }).withDisposal(catalog => catalog.close()),
query:   DiBag.createProvider(() => knex('users').where({ active: true }), { factoryReturnKind: 'uninspected' }),
```

Or configure a check once and keep plain factories:

```ts
const Configured = DiBag.withConfiguration({ runtime: { isNativePromise: value => value instanceof Promise } });
```

On Node, Bun and Deno none of this is needed. `import { DiBag } from 'di-bag'`
configures itself, and `di-bag/node` is gone.

## 12. An async factory handled both ways, with metadata and a snapshot

```ts
const connection = DiBag.createProvider(async () => openConnection())
  .withDisposal(conn => conn.close())
  .withRegistrationMetadata({ owner: 'platform-team' });

const client = connection
  .withAcquisitionMetadata({
    callbackReceives: 'fulfilled-value',
    describeAcquisition: conn => ({ serverVersion: conn.serverVersion }),
  })
  .withTransformedService({
    callbackReceives: 'fulfilled-value',          // the callback gets the Connection
    transformService: conn => makeClient(conn),
  });

const guarded = connection.withTransformedService({
  callbackReceives: 'exposed-service',            // the callback gets the Promise<Connection> itself
  transformService: pending => withTimeout(pending, 5_000),
});

const snapshot = container.serviceSnapshot('client');
snapshot.registrationMetadata.owner;               // 'platform-team'
snapshot.acquisitions[0]?.acquisitionMetadata[0];  // { isPresent: true, value: { serverVersion: '16.2' } }
container.graphSnapshot().bindings.map(binding => binding.bindingLabel);
```

## 13. Observe the lifecycle

```ts
const Observed = DiBag.withConfiguration({
  lifecycleObservers: [
    {
      onLifecycleEvent: event => {
        if (event.kind === 'acquisition-failed') metrics.increment('service.failed', { service: event.bindingLabel });
      },
      onObserverFailure: failure => console.error(failure.error),
    },
  ],
});

const app = Observed.createBuilder().withServices({ db }).buildContainer();
```

## 14. Admit a plugin chosen at run time

```ts
const handler = DiBag.createProviderFromPlugin({
  dependencies: [],
  pluginDescriptor: selected, // unknown: { apiVersion: 1, create, dispose? }
  factoryReturnKind: 'uninspected',
  isValidPluginOutput: (value: unknown): value is Handler =>
    typeof value === 'object' && value !== null && 'handle' in value && typeof value.handle === 'function',
});
```

## 15. Failures and shutdown

```ts
try {
  await app.ensureServicesReady(['db'], { totalTimeoutMs: 5_000 });
} catch (error) {
  if (error instanceof DiBagServiceReadinessCancelledError) {
    console.error(error.reason, error.details.acquisitionsStillPending); // 'timeout', ['db']
    await error.disposalPromise;
  } else if (error instanceof DiBagServiceReadinessError) {
    console.error(error.cause, error.disposalFailures);
  }
  throw error;
}

try {
  await app.close({ waitTimeoutMs: 10_000 });
} catch (error) {
  if (error instanceof DiBagCloseCancelledError) console.error(error.details.disposersStillRunning);
  if (error instanceof DiBagDisposalError) {
    for (const failure of error.failures) console.error(failure.bindingLabel, failure.error);
  }
}

// Branch on the failure kind. The method that raised it is in the details.
if (error.code === 'DI_BAG_UNKNOWN_SERVICE_KEY') console.error(error.details.operation, error.details.serviceKey);
```

## 16. An Elysia server

The app container is built once and connects before the server listens. Every request
gets a child container through one Elysia plugin. Hook names follow the Elysia
documentation: `derive`, `onAfterResponse`, `onError`, `onStop`, and
`{ as: 'global' }` so the plugin's hooks reach the routes of the app that uses it.

```ts
// app-container.ts
import { DiBag } from 'di-bag';

export type RequestContext = { readonly requestId: string; readonly userId: string | undefined };

const ordersModule = DiBag.createBuilder()
  .withServices({
    // built once: a singleton per container tree is the default
    ordersRepository: ({ db }: { db: Promise<Db> }) => ({
      findByUser: async (userId: string) => (await db).query('select * from orders where user_id = $1', [userId]),
    }),
    // built per request: it depends on the request, so it must carry the mark
    ordersService: DiBag.createProvider(
      ({ ordersRepository, request }: { ordersRepository: OrdersRepository; request: RequestContext }) => ({
        listMyOrders: () => ordersRepository.findByUser(request.userId ?? 'anonymous'),
      }),
    ).withLifetime('scoped:one-per-container'),
  })
  .buildModule({ exportedServiceKeys: ['ordersService'], moduleLabel: 'orders' });

export function createAppContainer(shutdownSignal: AbortSignal) {
  return DiBag.createBuilder()
    .withServices({
      config: () => loadConfig(),
      db: DiBag.createProvider(async ({ config }: { config: Config }) => connectToDatabase(config.databaseUrl))
        .withDisposal(db => db.end()),
      request: DiBag.createProvider((): RequestContext => ({ requestId: 'outside-request', userId: undefined }))
        .withLifetime('scoped:one-per-container'), // replaced per request
    })
    .withInstalledModules([ordersModule])
    .buildContainer()
    .ensureServicesReady(['db'], { totalTimeoutMs: 10_000, abortSignal: shutdownSignal });
}

export type AppContainer = Awaited<ReturnType<typeof createAppContainer>>;
```

```ts
// request-container-plugin.ts
import { Elysia } from 'elysia';
import type { AppContainer, RequestContext } from './app-container';

const closeContainer = (requestContainer: { close(): Promise<void> } | undefined) =>
  requestContainer?.close().catch(error => console.error('request container failed to close', error));

export const requestContainerPlugin = (appContainer: AppContainer) =>
  new Elysia({ name: 'di-bag-request-container' })
    .derive({ as: 'global' }, ({ headers }) => ({
      requestContainer: appContainer.createChildContainer({
        replacedServiceKeys: ['request'],
        replacementProviders: {
          request: (): RequestContext => ({ requestId: crypto.randomUUID(), userId: headers['x-user-id'] }),
        },
      }),
    }))
    .onAfterResponse({ as: 'global' }, ({ requestContainer }) => { void closeContainer(requestContainer); })
    .onError({ as: 'global' }, ({ requestContainer }) => { void closeContainer(requestContainer); });
```

```ts
// server.ts
import { Elysia } from 'elysia';
import { createAppContainer } from './app-container';
import { requestContainerPlugin } from './request-container-plugin';

const shutdown = new AbortController();
process.once('SIGTERM', () => shutdown.abort());

const appContainer = await createAppContainer(shutdown.signal); // SIGTERM during startup cancels it and releases the db

const server = new Elysia()
  .use(requestContainerPlugin(appContainer))
  .get('/orders', ({ requestContainer }) => requestContainer.resolve('ordersService').listMyOrders())
  .onStop(() => appContainer.close({ waitTimeoutMs: 10_000 }))
  .listen(3000);

shutdown.signal.addEventListener('abort', () => void server.stop());
```

- `db` and `ordersRepository` are built once. `request` and `ordersService` are
  built for each request, and `ordersService` sees that request's user.
- Creating the child container runs no factory, so `derive` stays cheap on routes that never
  resolve anything.
- `close()` returns the same promise when called twice, so closing in both
  `onAfterResponse` and `onError` is safe. A route that fails before `derive` runs
  has no child container, which is why the helper accepts `undefined`.
- The app container closes after the server stops accepting requests, so no request
  loses its database connection midway.

## 17. Singleton by default: mark only what is per request

```ts
const app = DiBag.createBuilder()
  .withServices({
    db: DiBag.createProvider(async () => connectToDatabase()).withDisposal(db => db.end()),
    ordersRepository: ({ db }: { db: Promise<Db> }) => createOrdersRepository(db), // singleton, no mark
    priceCalculator: () => createPriceCalculator(),                                // singleton, no mark
    request: DiBag.createProvider((): RequestContext => ({ requestId: 'outside-request', userId: undefined }))
      .withLifetime('scoped:one-per-container'),
    unitOfWork: DiBag.createProvider(({ db }: { db: Promise<Db> }) => createUnitOfWork(db))
      .withDisposal(unitOfWork => unitOfWork.release())
      .withLifetime('scoped:one-per-container'),                                              // by hand: nothing forces it
    ordersService: DiBag.createProvider(
      ({ ordersRepository, request, unitOfWork }: OrdersServiceDependencies) =>
        createOrdersService(ordersRepository, request, unitOfWork),
    ).withLifetime('scoped:one-per-container'),                                               // forced by the compiler
    nonce: DiBag.createProvider(() => crypto.randomUUID()).withLifetime('transient:one-per-resolve'),
  })
  .buildContainer();
```

- Without the mark on `ordersService` the build does not compile: a singleton may
  not depend on the scoped `request`, and the error names both.
- Without the mark on `request`, replacing it in a child container does not compile.
- `unitOfWork` depends on nothing scoped, so nothing catches a forgotten mark
  there. It would be one instance for all requests.
- An application that never creates a child container writes no lifetime marks at all.
- The value is `term:description`. The term is what other containers call it, and
  the description is what it means here. Only the full value is accepted.

## Where 0.5.0 is longer than 0.4.0

The standard trades brevity for clarity, and these are the places that pay most:

| Use | 0.4.0 | 0.5.0 |
| --- | --- | --- |
| Request scope | `createScope(['request'], { request })` | a bag with `replacedServiceKeys` and `replacementProviders` |
| Browser graph | `fromSyncFactory(f)` | `createProvider(f, { factoryReturnKind: 'sync-value' })` |
| One decorator on a plain factory | `withDisposal(f, dispose)` | `createProvider(f).withDisposal(dispose)` |
| Alias, token service, replace, contribution | two positional arguments | a bag with two named properties |

Two or more decorators, startup, module sealing and error handling get shorter
or read in a better order.
