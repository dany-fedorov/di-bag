# Using DI Bag in a server

[← README](../../README.md) · [Complete API guide](api-reference.md) · [Integration patterns](enterprise-integration.md)

Each request gets a child container. Its request ID, caller, and transaction belong to that
child and are released when the child closes. The catalog (a connection pool in a real application) is created once in the
application container. If a shared service starts depending on per-request state, `tsc` rejects
the graph with `singleton lifetime cannot capture scoped dependency: <shared> -> <request>`
before any request runs.

One `application.ts` below serves Node HTTP, Express, Fastify, Bun, Elysia, and Deno; only the
server file changes. `ensureServicesReady` makes the catalog ready before the listener opens.
If it fails, the container closes itself; on cancellation, await `disposalPromise`.

The examples are TypeScript files in a package with `"type": "module"`. Node 24 runs them
with `node server.ts`; Bun with `bun run server.ts`. Type-check them with the settings in
[Type-check the recipes](#type-check-the-recipes).
Install `di-bag` as in the [README](../../README.md#install); the type check needs TypeScript 6.0.3 or later.

## Contents

- [Type-check the recipes](#type-check-the-recipes)
- [Build the application once](#build-the-application-once)
- [Choose the owner of each service](#choose-the-owner-of-each-service)
- [One child container per request](#request-containers)
- [Close each request container](#close-each-request-container)
- [Readiness failures and deadlines](#readiness-failures-and-deadlines)
- [Connect a shutdown signal](#connect-a-shutdown-signal)
- [Node HTTP](#node-http)
- [Express](#express)
- [Fastify](#fastify)
- [Bun](#bun)
- [Elysia](#elysia)
- [Deno](#deno-and-portable-acquisition)
- [Bound the shutdown wait](#bound-the-shutdown-wait)
- [Browsers, workers, and other hosts without process.getBuiltinModule](#browsers-workers-and-other-hosts-without-process-getbuiltinmodule)
- [Disconnects, streaming, and WebSockets](#disconnects-streaming-and-websockets)
- [Background jobs and message consumers](#background-jobs-and-message-consumers)
- [Test application services](#test-application-services)
- [Organize a larger application](#organize-a-larger-application)
- [Troubleshooting](#troubleshooting)

## Type-check the recipes {#type-check-the-recipes}

The recipes import sibling files with a `.ts` extension, so Node 24 and Bun can run them
directly. Type-check them with:

```json
{
  "compilerOptions": {
    "strict": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "noEmit": true,
    "allowImportingTsExtensions": true
  }
}
```

```sh
npx tsc -p tsconfig.json
```

To emit JavaScript instead, replace `noEmit` and `allowImportingTsExtensions` with
`"rewriteRelativeImportExtensions": true`.

## Build the application once

When no service needs request state, one container can serve every request.
Use this `application.ts` (save it under that name):

```ts
import { DiBag } from 'di-bag';

type Catalog = Map<string, string>;

export function createApplication() {
  const app = DiBag.createBuilder()
    .withServices({
      catalog: DiBag.providerWithDisposal({
        provider: async (): Promise<Catalog> => new Map([['book', 'A good book']]),
        disposeService: catalog => catalog.clear(),
      }),
      handler: ({ catalog }: { catalog: Promise<Catalog> }) => ({
        async list() {
          return { items: Array.from((await catalog).values()) };
        },
      }),
    })
    .buildContainer();
  return app.ensureServicesReady(['catalog']);
}

export type Application = Awaited<ReturnType<typeof createApplication>>;
```

`buildContainer()` creates the application container.
[`ensureServicesReady`](#readiness-failures-and-deadlines) waits for the catalog before the server listens. The catalog still resolves as
`Promise<Catalog>`. Readiness does not rewrite its public type. Every request
can call `app.resolve('handler').list()`. The container closes during server
shutdown.

## Choose the owner of each service

| Service | Typical lifetime | Owner |
| --- | --- | --- |
| Configuration, connection pool, application cache | `'singleton:one-per-container-tree'` when shared across children | Application container |
| Request ID, authenticated caller, transaction, request logger | `'scoped:one-per-container'` (default) | Request's child container |
| A fresh operation object on each lookup | `'transient:one-per-resolve'` | Resolving container |
| A replacement graph for an isolated test | Independent container | Test fixture |

Singleton providers are explicit when children should share them. Use
`DiBag.providerWithLifetime({ provider, lifetime })` to select a lifetime.
Use `DiBag.providerWithDisposal({ provider, disposeService })` to attach
disposal. These are separate choices. A singleton cannot depend on a scoped
provider unless its `providerWithLifetime` call sets `allowsScopedDependencies: true`. That exception uses
the defining container's context, not the current request's identity. See
[lifetime rules](tutorial.md#choose-a-lifetime).

## One child container per request {#request-containers}

Replace `application.ts` with this version, which adds a per-request value to the one from
[Build the application once](#build-the-application-once). The in-memory catalog
makes the example runnable without a database. In an application, its async factory could open a client
or pool. Its disposer could call that client's shutdown method. The catalog is
explicitly shared across the container tree. The request and its dependent
handler use the scoped default, so each child gets its own instances.

```ts
import { DiBag } from 'di-bag';

export type RequestContext = { id: string };
type Catalog = Map<string, string>;

export function createApplication() {
  const app = DiBag.createBuilder()
    .withServices({
      catalog: DiBag.providerWithLifetime({
        provider: DiBag.providerWithDisposal({
          provider: async (): Promise<Catalog> => new Map([['book', 'A good book']]),
          disposeService: catalog => catalog.clear(),
        }),
        lifetime: 'singleton:one-per-container-tree',
      }),
      request: (): RequestContext => ({ id: 'outside-request' }),
      handler: ({ catalog, request }: { catalog: Promise<Catalog>; request: RequestContext }) => ({
        async list() {
          return { requestId: request.id, items: Array.from((await catalog).values()) };
        },
      }),
    })
    .buildContainer();
  return app.ensureServicesReady(['catalog']);
}

export type Application = Awaited<ReturnType<typeof createApplication>>;

export function createRequestContainer(app: Application, requestId: string) {
  return app.createChildContainer(['request'], {
    request: (): RequestContext => ({ id: requestId }),
  });
}
```

The placeholder gives checked replacements a type. Resolve the handler from
the child container so it sees the request's replacement. A scoped provider is
the default. The compiler rejects a singleton that depends on a scoped
provider (unless it opts in with `allowsScopedDependencies: true`, above). Keep application services independent of the HTTP library so jobs
and tests can use them too.

## Close each request container {#close-each-request-container}

Save the following helper as `owned-container.ts`. It is a copy of [examples/integration/owned-container.ts](../../examples/integration/owned-container.ts), which `tests/enterprise-integration.test.ts` exercises.

```ts
/** Application recipe: acquire a fresh owned container, run work, then close it. */
export async function withOwnedContainer<C extends { close(): Promise<void> }, R>(
  acquire: () => C | Promise<C>,
  work: (container: C) => R,
): Promise<Awaited<R>> {
  const container = await acquire();
  let value: Awaited<R>;
  try {
    value = await work(container);
  } catch (error) {
    try {
      await container.close();
    } catch (disposalError) {
      throw new AggregateError([error, disposalError], 'Work and container disposal both failed');
    }
    throw error;
  }
  await container.close();
  return value;
}
```

It waits for application work and disposal before returning. If both fail, it
preserves both errors. If acquisition fails, there is no acquired container
for this helper to close. `ensureServicesReady()` closes the container after a
readiness failure.

Now save `handle-request.ts`:

```ts
import { createRequestContainer, type Application } from './application.ts';
import { withOwnedContainer } from './owned-container.ts';

export function handleRequest(app: Application, requestId: string) {
  return withOwnedContainer(
    () => createRequestContainer(app, requestId),
    container => container.resolve('handler').list(),
  );
}
```

These recipes return fully materialized JSON data. Disposal finishes before the
HTTP response is sent, so a disposal failure can still become an error response.
The returned data must remain usable after disposal. A live cursor, stream, or
socket needs a longer lived container, described [below](#disconnects-streaming-and-websockets).

The framework recipes below use the [request-container application](#request-containers).
When requests need no request state, use the
[single-container application](#build-the-application-once) and call
`app.resolve('handler').list()` directly.

## Readiness failures and deadlines {#readiness-failures-and-deadlines}

Use `builder.buildContainer()` for a lazy container. Call
`container.ensureServicesReady(serviceKeys, options)` before opening a listener
when selected services must be ready. Readiness
does not eagerly resolve unrelated registrations.

```ts
import { DiBag, DiBagServiceReadinessCancelledError, DiBagServiceReadinessError } from 'di-bag';

const builder = DiBag.createBuilder().withServices({
  catalog: async () => new Map([['book', 'A good book']]),
});
const app = builder.buildContainer();
try {
  await app.ensureServicesReady(['catalog'], {
    totalTimeoutMs: 5_000,
  });
  // Start the listener, then close app during server shutdown.
} catch (error) {
  if (error instanceof DiBagServiceReadinessCancelledError) {
    try {
      await error.disposalPromise;
    } catch (disposalError) {
      throw new AggregateError(
        [error, disposalError],
        'Readiness cancellation and disposal failed',
      );
    }
  } else if (error instanceof DiBagServiceReadinessError) {
    console.error(error.cause, error.disposalFailures);
  }
  throw error;
}
```

A failed `ensureServicesReady` has already closed the container, so the catch block only reports the failure. `totalTimeoutMs` and `abortSignal` bound the wait. The full readiness API, including `maxConcurrentServiceKeys` and cooperative `abortSignal` forwarding, is in the [tutorial](tutorial.md#make-selected-services-ready).

## Connect a shutdown signal

For the Node, Express, Fastify, Bun, and Elysia recipes, save `node-shutdown.ts`:

```ts
export function onShutdown(stop: () => Promise<void>) {
  let stopping = false;
  const beginShutdown = () => {
    if (stopping) return;
    stopping = true;
    void stop().catch((error) => {
      console.error('Shutdown failed', error);
      process.exitCode = 1;
    });
  };
  process.on('SIGINT', beginShutdown);
  process.on('SIGTERM', beginShutdown);
}
```

The recipes stop accepting work, let active handlers finish, and then close the
application container. Calling `app.close()` first begins closing its children and
blocks new resolutions, which can interrupt requests you intended to drain.

## Node HTTP

Save this as `server.ts` and run `node server.ts`:

```ts
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createApplication } from './application.ts';
import { handleRequest } from './handle-request.ts';
import { withOwnedContainer } from './owned-container.ts';
import { onShutdown } from './node-shutdown.ts';

const app = await createApplication();
const server = createServer((request, response) => {
  void (async () => {
    if (request.method !== 'GET' || request.url !== '/items') {
      response.writeHead(404).end();
      return;
    }
    const body = await handleRequest(app, crypto.randomUUID());
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  })().catch((error) => {
    console.error(error);
    if (!response.headersSent && !response.destroyed) {
      response.writeHead(500).end('Internal server error');
    } else {
      response.destroy();
    }
  });
});

try {
  server.listen(3000, '127.0.0.1');
  await once(server, 'listening');
} catch (error) {
  await app.close();
  throw error;
}

onShutdown(() =>
  withOwnedContainer(
    () => app,
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  ),
);
```

Try `curl http://127.0.0.1:3000/items`. Each response has its own request ID.
The listener explicitly catches its async task because an HTTP event callback
does not await the returned promise. The shutdown sequence uses
[Node's `server.close()`](https://nodejs.org/docs/latest-v24.x/api/http.html#serverclosecallback)
to drain HTTP connections before releasing the application's resources.
Here the shutdown operation intentionally owns the application container. Reusing
`withOwnedContainer` ensures application disposal is attempted even if stopping the
listener fails, and preserves both failures if necessary.

## Express

Install `express@5` in the application; for TypeScript checking, also install
`@types/express@5` and `@types/node` as development dependencies. Save this as
`server.ts` and run it with Node:

```ts
import express, { type ErrorRequestHandler } from 'express';
import { once } from 'node:events';
import { createApplication } from './application.ts';
import { handleRequest } from './handle-request.ts';
import { withOwnedContainer } from './owned-container.ts';
import { onShutdown } from './node-shutdown.ts';

const services = await createApplication();
const app = express();

app.get('/items', async (_request, response) => {
  const body = await handleRequest(services, crypto.randomUUID());
  response.json(body);
});

const errors: ErrorRequestHandler = (error, _request, response, next) => {
  console.error(error);
  if (response.headersSent) {
    next(error);
    return;
  }
  response.status(500).json({ error: 'Internal server error' });
};
app.use(errors);

const server = app.listen(3000, '127.0.0.1');
try {
  await once(server, 'listening');
} catch (error) {
  await services.close();
  throw error;
}

onShutdown(() =>
  withOwnedContainer(
    () => services,
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  ),
);
```

Express 5 forwards rejected async route handlers to error middleware. For
Express 4, explicitly forward rejection with `.catch(next)`. See the
[Express error-handling guide](https://expressjs.com/en/guide/error-handling/).

Keeping the child container inside a route is useful when one handler owns all the work.
If several middleware stages need it, attach a container to a typed request-local
property and use one completion path for disposal. Calling `next()` starts the
next stage; it does not tell you when the response finishes. Include error and
disconnect paths, and keep any resource used by serialization alive until that
work finishes.

## Fastify

Install `fastify@5` in the application. Save this as `server.ts`:

```ts
import Fastify from 'fastify';
import { createApplication } from './application.ts';
import { handleRequest } from './handle-request.ts';
import { onShutdown } from './node-shutdown.ts';

const services = await createApplication();
const server = Fastify({ logger: true });

server.get('/items', (request) => handleRequest(services, request.id));
server.addHook('onClose', async () => {
  await services.close();
});

try {
  await server.listen({ port: 3000, host: '127.0.0.1' });
} catch (error) {
  await server.close();
  throw error;
}

onShutdown(() => server.close());
```

The application container closes in `onClose`, after requests have drained under normal graceful
shutdown. See [Fastify's shutdown lifecycle](https://fastify.dev/docs/latest/Reference/Server/#close).
The route returns a promise containing plain response data; request disposal
completes inside `handleRequest` before Fastify serializes it.

For a plugin that owns its own services, create its container during plugin setup and
close it from that plugin's `onClose` hook. Decide whether plugins share the
application container or own independent containers. DI Bag modules organize service
registrations; Fastify plugins organize routes, hooks, and framework context.

## Bun

Use the same `application.ts`. Save this as `server.ts` and run
`bun run server.ts`:

```ts
import { createApplication } from './application.ts';
import { handleRequest } from './handle-request.ts';
import { withOwnedContainer } from './owned-container.ts';
import { onShutdown } from './node-shutdown.ts';

const app = await createApplication();
const server = await (async () => {
  try {
    return Bun.serve({
      port: 3000,
      hostname: '127.0.0.1',
      async fetch(request) {
        if (request.method !== 'GET' || new URL(request.url).pathname !== '/items') {
          return new Response('Not found', { status: 404 });
        }
        try {
          return Response.json(await handleRequest(app, crypto.randomUUID()));
        } catch (error) {
          console.error(error);
          return new Response('Internal server error', { status: 500 });
        }
      },
    });
  } catch (error) {
    await app.close();
    throw error;
  }
})();

onShutdown(() =>
  withOwnedContainer(
    () => app,
    () => server.stop(),
  ),
);
```

[`server.stop()`](https://bun.sh/docs/runtime/http/server#server-stop) waits for
connections to finish. Passing `true` forces termination, which is a different
shutdown policy. Keep the child container open longer when returning a streaming response.

## Elysia

Install `elysia@1.4.30` in the application. This recipe is not compiled or run by this
repository's checks; verify it against your Elysia version. It creates a child container
for each request. Save this as `server.ts` and run it with Bun:

```ts
import { Elysia } from 'elysia';
import { createApplication, createRequestContainer } from './application.ts';
import { onShutdown } from './node-shutdown.ts';

const app = await createApplication();

const closingContainers = new WeakSet<object>();
function closeRequestContainer(requestContainer: { close(): Promise<void> } | undefined) {
  if (!requestContainer || closingContainers.has(requestContainer)) return;
  closingContainers.add(requestContainer);
  void requestContainer.close().catch(error => console.error(error));
}

const requestContainerPlugin = new Elysia({ name: 'di-bag-request-container' })
  .derive({ as: 'global' }, () => ({
    requestContainer: createRequestContainer(app, crypto.randomUUID()),
  }))
  .onAfterResponse({ as: 'global' }, ({ requestContainer }) => {
    closeRequestContainer(requestContainer);
  })
  .onError({ as: 'global' }, ({ requestContainer }) => {
    closeRequestContainer(requestContainer);
  });

const server = new Elysia()
  .use(requestContainerPlugin)
  .get('/items', ({ requestContainer }) => requestContainer.resolve('handler').list())
  .onStop(() => app.close())
  .listen({ port: 3000, hostname: '127.0.0.1' });

onShutdown(async () => {
  await server.stop();
});
```

The response and error hooks may both run for one request. Either hook can
also run before `derive` creates a child container. The helper tolerates that
absence, starts disposal once per child container, and observes failures.
The `onStop` hook closes the application
container. Coordinate request draining and process exit with the host's
shutdown policy; a TypeScript check does not establish their runtime order.

## Deno {#deno-and-portable-acquisition}

Deno runs the same `application.ts`: `di-bag` finds the native-Promise
classifier through `process.getBuiltinModule` there, as on Node and Bun. Resolve
the bare import through the local npm installation from the README; if needed,
use `"nodeModulesDir": "manual"` in `deno.json`. See
[Deno's manual npm installation mode](https://docs.deno.com/runtime/fundamentals/node/#manual-node_modules-creation).
Keep `owned-container.ts` and `handle-request.ts` from the earlier sections.

Save this as `server.ts` and run `deno run --allow-net server.ts`:

```ts
import { createApplication } from './application.ts';
import { handleRequest } from './handle-request.ts';

const app = await createApplication();
const server = await (async () => {
  try {
    return Deno.serve({ port: 3000, hostname: '127.0.0.1' }, async (request) => {
      if (request.method !== 'GET' || new URL(request.url).pathname !== '/items') {
        return new Response('Not found', { status: 404 });
      }
      try {
        return Response.json(await handleRequest(app, crypto.randomUUID()));
      } catch (error) {
        console.error(error);
        return new Response('Internal server error', { status: 500 });
      }
    });
  } catch (error) {
    await app.close();
    throw error;
  }
})();

let stopping = false;
const shutdown = () => {
  if (stopping) return;
  stopping = true;
  void server.shutdown().catch(console.error);
};
Deno.addSignalListener('SIGINT', shutdown);
Deno.addSignalListener('SIGTERM', shutdown);

try {
  await server.finished;
} finally {
  Deno.removeSignalListener('SIGINT', shutdown);
  Deno.removeSignalListener('SIGTERM', shutdown);
  await app.close();
}
```

Use signal names supported by your host. Deno's `shutdown()` stops admission and
lets pending requests finish; `finished` observes server completion. See
[Deno's HTTP server API](https://docs.deno.com/api/deno/http-server/).

## Bound the shutdown wait

An operational shutdown deadline belongs to the host; DI Bag cannot force an
uncooperative factory or disposer to settle. Use `waitTimeoutMs` to bound the
wait while disposal continues:

```ts
import { DiBag, DiBagCloseCancelledError } from 'di-bag';

const app = DiBag.createBuilder()
  .withServices({ resource: () => ({ ready: true }) })
  .buildContainer();

try {
  await app.close({ waitTimeoutMs: 5_000 });
} catch (error) {
  if (error instanceof DiBagCloseCancelledError) {
    // Observe eventual disposal without extending this bounded wait.
    void error.disposalPromise.catch(disposalError => {
      console.error('Disposal failed after the shutdown deadline', disposalError);
      process.exitCode = 1;
    });
  } else {
    throw error;
  }
}
```

The catch branch returns after the bounded wait; it does not wait for disposal to
finish. The deadline does not release pending resources or cancel a disposer.
The rejection handler reports any eventual disposal failure, while the host decides
when to exit and how to handle still-pending resources.
`abortSignal` can also end the wait. The same principle applies to `disposalPromise` on
`DiBagServiceReadinessCancelledError`.

## Browsers, workers, and other hosts without process.getBuiltinModule

No server on this page needs this. Read it when the same `application.ts` must also load in a browser or worker; the [React guide](react-integration.md#build-the-application-runtime-once) is the browser recipe.

Hosts without `process.getBuiltinModule`, such as browsers and workers, have no
automatic native-Promise predicate. There, say on **every factory stage**,
including replacements, whether it is synchronous or asynchronous:
`factoryReturnKind: 'sync-value'` for a value or `'native-promise'` for a Promise. This portable
version of `application.ts` runs on every host, Deno included:

```ts
import { DiBag } from 'di-bag';

type RequestContext = { id: string };
type Catalog = Map<string, string>;

export function createApplication() {
  const app = DiBag.createBuilder()
    .withServices({
      catalog: DiBag.providerWithLifetime({
        provider: DiBag.providerWithDisposal({
          provider: DiBag.createProvider(
            async (): Promise<Catalog> => new Map([['book', 'A good book']]),
            { factoryReturnKind: 'native-promise' },
          ),
          disposeService: catalog => catalog.clear(),
        }),
        lifetime: 'singleton:one-per-container-tree',
      }),
      request: DiBag.createProvider((): RequestContext => ({ id: 'outside-request' }), { factoryReturnKind: 'sync-value' }),
      handler: DiBag.createProvider(
        ({ catalog, request }: { catalog: Promise<Catalog>; request: RequestContext }) => ({
          async list() {
            return {
              requestId: request.id,
              items: Array.from((await catalog).values()),
            };
          },
        }), { factoryReturnKind: 'sync-value' },
      ),
    })
    .buildContainer();
  return app.ensureServicesReady(['catalog']);
}

export type Application = Awaited<ReturnType<typeof createApplication>>;

export function createRequestContainer(app: Application, requestId: string) {
  return app.createChildContainer(['request'], {
    request: DiBag.createProvider(
      (): RequestContext => ({ id: requestId }),
      { factoryReturnKind: 'sync-value' },
    ),
  });
}
```

Keep `owned-container.ts` and `handle-request.ts` from the earlier sections.
The `'sync-value'` classification preserves a value without inspecting `then`.
The `'native-promise'` classification tracks a genuine native Promise and gives
its fulfillment to the disposer. `DiBag.providerWithDisposal` and
`DiBag.providerWithLifetime` preserve the chosen classification. New factory
stages need their own `factoryReturnKind`. If `buildContainer()` throws
`DI_BAG_CLASSIFIER_REQUIRED`, its message names the automatic registrations.
See [portable host configuration](tutorial.md#portable-mode).

## Disconnects, streaming, and WebSockets

The JSON recipes above finish their application work even if a client
disconnects. To cancel a handler's work, pass an application-controlled signal
to its operations. On disconnect, abort that signal, wait for active work to
finish, and then close the request container. Remove transport listeners when the
operation ends and observe disposal rejection.

Container closure tracks acquisitions and disposers, not every later method call
on a service. Directly closing a child container from a disconnect hook is appropriate
only when no active service method still needs its owned resources. Otherwise,
that can dispose a connection while a handler is using it. `DiBag.createProvider`
lets acquisition work cooperate with the container's signal when
`factoryReceivesContext` is true. It does not automatically cancel later method
calls. Closing a child cannot abort singleton shared
resources. A signal alone does not prove that work has stopped.

For a streaming response, the lifetime is:

```text
open container, create stream, send chunks, wait for completion or cancellation, close container
```

Do not return a live stream from `withOwnedContainer`: that helper closes the container
as soon as its work callback returns. Instead, attach disposal to the stream's
completion/cancellation path and handle errors there. For Node responses,
`finish` and premature `close` are distinct terminal events. Guard disposal so
both events cannot start separate disposal work. See
[Node response events](https://nodejs.org/docs/latest-v24.x/api/http.html#class-httpserverresponse).

A WebSocket can own a connection container and create child containers for individual
messages. Stop admitting messages, await active message work, close message
containers, then close the connection container. Account for upgraded connections in
the server's own shutdown procedure. DI Bag does not register HTTP, stream, or
WebSocket hooks automatically.

## Background jobs and message consumers

A job has the same ownership shape as a request. Continuing the common
application, handle one job like this:

```ts
const result = await withOwnedContainer(
  // The request helper is reused on purpose: a job is one owned operation.
  () => createRequestContainer(app, 'job-42'),
  container => container.resolve('handler').list(),
);
console.log(result);
```

Acknowledge the message only after this call resolves.

Give detached work its own container. A job that outlives an HTTP request must not
reuse that request's scoped connection or transaction. Pass plain job input,
resolve services again in the job container, and await jobs during worker shutdown.
Retries can create fresh containers without replacing the shared application pool.

## Test application services

Use the same request helper to test behavior without opening a socket. The same pattern with a module fixture is the [fixture-test recipe](../agent/recipes.md#fixture-test).

```ts
import assert from 'node:assert/strict';
import { DiBag } from 'di-bag';
import { createApplication } from './application.ts';
import { handleRequest } from './handle-request.ts';
import { withOwnedContainer } from './owned-container.ts';

const app = await createApplication();
try {
  await withOwnedContainer(
    () =>
      app.createIndependentContainer(['catalog'], {
        catalog: DiBag.providerWithLifetime({
          provider: DiBag.providerWithDisposal({
            provider: async () => new Map([['test', 'Test item']]),
            disposeService: catalog => catalog.clear(),
          }),
          lifetime: 'singleton:one-per-container-tree',
        }),
      }),
    async (testApp) => {
      const response = await handleRequest(testApp, 'test-request');
      assert.deepEqual(response, {
        requestId: 'test-request',
        items: ['Test item'],
      });
    },
  );
} finally {
  await app.close();
}
```

This replacement explicitly repeats the original lifetime and disposal policies. A
replacement is a complete registration: those wrappers are not inherited from
the original factory. Fixtures for hosts without `process.getBuiltinModule`
also use `DiBag.createProvider` with an explicit `factoryReturnKind`. An independent container has independent
instances and is not closed by the original app. Use transport-level tests as
well when validating routing, serialization, disconnects, or streaming.

## Organize a larger application

### Split features into modules

Move each feature's factories into `src/features/<name>/module.ts` and export only the
services the server resolves. Install every module in one list in `src/app.ts`, and keep a
`src/app.check.ts` that verifies the merged graph without building it. The layout and the
per-module check command are in [AGENTS.md](../../AGENTS.md#module-layout); the
[modules guide](examples-modularity.md) has runnable programs.

```ts
import { DiBag } from 'di-bag';

type Catalog = Map<string, string>;
type RequestContext = { id: string };

// src/features/catalog/module.ts
const catalogModule = DiBag.createBuilder()
  .withServices({
    handler: ({ catalog, request }: { catalog: Promise<Catalog>; request: RequestContext }) => ({
      async list() {
        return { requestId: request.id, items: Array.from((await catalog).values()) };
      },
    }),
  })
  .buildModule({ exportedServiceKeys: ['handler'], moduleLabel: 'catalog' });

// src/app.check.ts
DiBag.createBuilder()
  .withInstalledModules([catalogModule])
  .withServices({
    catalog: DiBag.providerWithLifetime({
      provider: async (): Promise<Catalog> => new Map([['book', 'A good book']]),
      lifetime: 'singleton:one-per-container-tree',
    }),
    request: (): RequestContext => ({ id: 'outside-request' }),
  })
  .verifyGraphAtCompileTime() satisfies void;
```

| Need | API and example |
| --- | --- |
| Keep a feature's connection private while exposing its service | `buildModule`, `withInstalledModules`, `withRenamedRequirement`, `withRenamedExport`: [Build modules as units of work](tutorial.md#reuse-named-modules) |
| Inject a database contract into existing classes | [`createToken`, `withTokenService`, `createProviderFromClass`](tutorial.md#adapt-classes-and-positional-functions) |
| Assemble ordered middleware or job handlers | [`withCollectionContribution`, `createToken(...).forCollectionOf`, `resolveCollection`](tutorial.md#compose-an-ordered-collection) |
| Enable optional telemetry | [`optional`](tutorial.md#declare-optional-and-lazy-dependencies) |
| Defer an expensive dependency until a method needs it | [`lazy`](tutorial.md#declare-optional-and-lazy-dependencies) |
| Give one service another public name | [`withServiceAlias`](tutorial.md#give-a-dependency-another-lookup-name) |
| Expose a narrow interface while keeping ownership of the original client | [`providerWithTransformedService`, `providerWithDisposal`](tutorial.md#project-services-explicitly) |
| Label services and report acquisition events | [`providerWithRegistrationMetadata`, `serviceSnapshot`, `withConfiguration`](tutorial.md#attach-metadata-and-inspect-without-resolving) |
| Load and validate an application-selected extension | [`createProviderFromPlugin`](tutorial.md#admit-an-application-selected-plugin) |

NestJS and Angular also own controllers, components, and framework-specific
lifetimes. Embedding a container does not connect those lifecycles automatically. The
[framework boundary discussion](enterprise-integration.md#framework-boundaries)
describes the integration responsibilities.

## Troubleshooting

| Symptom or message | Code / section | What to check |
| --- | --- | --- |
| `required services are missing: <key>` | [missing-service](../agent/errors.md#missing-service) | Register `<key>`, or supply it from the host when it is a module requirement. |
| `singleton lifetime cannot capture scoped dependency: <a> -> <b>` | [singleton-captures-scoped](../agent/errors.md#singleton-captures-scoped), [`DI_BAG_LIFETIME_DEPENDENCY`](../agent/errors.md#di-bag-lifetime-dependency) at run time | Make `<b>` singleton or `<a>` scoped; `allowsScopedDependencies: true` only for a deliberate capture. |
| `createChildContainer cannot replace singleton service: <key>` | [`DI_BAG_SINGLETON_REPLACEMENT`](../agent/errors.md#di-bag-singleton-replacement) | Mark it `'scoped:one-per-container'`, or use `createIndependentContainer`. |
| Every request sees the placeholder ID |  | Resolve the handler from `createRequestContainer`, not the application container. |
| A child override does not reach a handler |  | The handler is singleton or listed in `sharedParentServiceKeys`; keep it scoped. |
| `buildContainer()` throws in a browser or worker | [`DI_BAG_CLASSIFIER_REQUIRED`](../agent/errors.md#di-bag-classifier-required) | `details.bindings` names each factory; give it `factoryReturnKind`. |
| A dependency object cannot be spread or enumerated | [`DI_BAG_INVALID_DEPENDENCY_ACCESS`](../agent/errors.md#di-bag-invalid-dependency-access) | Read declared properties directly. |
| `ensureServicesReady` rejects with `DI_BAG_SERVICE_READINESS_FAILED` | [`DI_BAG_SERVICE_READINESS_FAILED`](../agent/errors.md#di-bag-service-readiness-failed) | The container is already closed; read `cause` and `disposalFailures`. |
| `ensureServicesReady` rejects with `DI_BAG_SERVICE_READINESS_CANCELLED` | [`DI_BAG_SERVICE_READINESS_CANCELLED`](../agent/errors.md#di-bag-service-readiness-cancelled) | `abortSignal` fired or `totalTimeoutMs` elapsed (`cause` is then `DI_BAG_SERVICE_READINESS_TIMEOUT`); the container is closing, so await `disposalPromise`. |
| `close()` rejects after `waitTimeoutMs` | [`DI_BAG_CLOSE_TIMEOUT`](../agent/errors.md#di-bag-close-timeout) | `details.disposersStillRunning` names the disposer that never settles. |
| `Property 'x' does not exist on type 'Promise<...>'` | [AGENTS.md rule 4](../../AGENTS.md#rules) | The factory is async, so its service is a Promise; declare `{ x: Promise<T> }` in the consumer and `await` it. |
| Disposal never runs |  | Attach `DiBag.providerWithDisposal` and close the owning container. |

The [complete API guide](api-reference.md) explains each method and its options.
The [development guide](development.md) describes the repository's verification
coverage. The server snippets are application recipes, not packaged framework
adapters.
