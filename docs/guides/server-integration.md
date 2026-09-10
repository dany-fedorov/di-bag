# Using DI Bag in a server

[← README](../../README.md) · [Complete API guide](api-reference.md) · [Ownership recipes](enterprise-integration.md)

This guide builds one small application and connects it to Node HTTP, Express,
Fastify, Bun, and Deno. The application owns its services. The server owns its
listener and decides when requests begin and end.

Start with the [README installation instructions](../../README.md#install).
The examples use TypeScript files in an application with `"type": "module"` in
`package.json`. Node examples can run with `node server.ts` on Node 24; Bun
examples use `bun run server.ts`. Runtime execution does not replace type
checking with the [supported compiler](development.md).

## Contents

- [Choose the owner of each service](#choose-the-owner-of-each-service)
- [Build the application once](#build-the-application-once)
- [Close each request scope](#close-each-request-scope)
- [Connect a shutdown signal](#connect-a-shutdown-signal)
- [Node HTTP](#node-http)
- [Express](#express)
- [Fastify](#fastify)
- [Bun](#bun)
- [Deno and portable acquisition](#deno-and-portable-acquisition)
- [Startup failures and deadlines](#startup-failures-and-deadlines)
- [Disconnects, streaming, and WebSockets](#disconnects-streaming-and-websockets)
- [Background jobs and message consumers](#background-jobs-and-message-consumers)
- [Test application services](#test-application-services)
- [Organize a larger application](#organize-a-larger-application)
- [Troubleshooting](#troubleshooting)

## Choose the owner of each service

| Service | Typical lifetime | Owner |
| --- | --- | --- |
| Configuration, connection pool, application cache | `root` | Application bag |
| Request ID, authenticated caller, transaction, request logger | `scoped` (default) | Request's child bag |
| A fresh operation object on each lookup | `transient` | Bag performing the acquisition |
| A replacement graph for an isolated test | Independent `fork()` | Test fixture |

`root` means shared within one bag and its descendants. Each worker process or
independent fork has its own root. Choose `withLifetime` for caching, and
`withDisposal` for resource cleanup; these are separate choices.

A root service must not capture request state. For example, keep a connection
pool at the root and create a transaction in the request scope. DI Bag rejects
root-to-scoped dependencies by default. The deliberate `captureScoped` option
uses the root's context, so it does not supply the current request's identity.
See [lifetime rules](tutorial.md#choose-root-scoped-or-transient-caching).

## Build the application once

Save this as `application.ts`. The in-memory catalog makes the example runnable
without a database. In an application, its async factory could open a client or
pool and its disposer could call that client's shutdown method.

```ts
import { DiBag } from 'di-bag/node';

type RequestContext = { id: string };
type Catalog = Map<string, string>;

export function createApplication() {
  return DiBag.begin()
    .add({
      catalog: DiBag.withLifetime(
        DiBag.withDisposal(
          async () => new Map([['book', 'A good book']]),
          catalog => catalog.clear(),
        ),
        'root',
      ),
      request: (): RequestContext => ({ id: 'outside-request' }),
      handler: ({ catalog, request }: {
        catalog: Promise<Catalog>;
        request: RequestContext;
      }) => ({
        async list() {
          return {
            requestId: request.id,
            items: Array.from((await catalog).values()),
          };
        },
      }),
    })
    .start(['catalog']);
}

export type Application = Awaited<ReturnType<typeof createApplication>>;

export function createRequestScope(app: Application, requestId: string) {
  return app.scope(['request'], {
    request: () => ({ id: requestId }),
  });
}
```

`start(['catalog'])` creates the application bag and waits for the catalog before
the server starts listening. The catalog still resolves as `Promise<Catalog>`;
startup does not rewrite its public type. Every request gets a fresh `handler`
and `request`, while inheriting the root's catalog. Resolving the handler through
the request scope is what makes it see that request's override.

The placeholder request establishes a type for checked overrides. Resolve
request-dependent handlers only from a request scope. Keep application services
independent of the HTTP library so jobs and tests can use them too.

## Close each request scope

Save the following helper as `owned-scope.ts`. It is application code, also
available in the repository as the tested
[`withOwnedScope` recipe](../../examples/integration/owned-scope.ts).

```ts
export async function withOwnedScope<S extends { close(): Promise<void> }, R>(
  acquire: () => S | Promise<S>,
  work: (scope: S) => R,
): Promise<Awaited<R>> {
  const scope = await acquire();
  let value: Awaited<R>;
  try {
    value = await work(scope);
  } catch (error) {
    try {
      await scope.close();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Work and scope cleanup both failed');
    }
    throw error;
  }
  await scope.close();
  return value;
}
```

It waits for application work and cleanup before returning. If both fail, it
preserves both errors. If acquiring the scope fails, there is no acquired scope
for this helper to close; `start()` handles its own startup rollback.

Now save `handle-request.ts`:

```ts
import { createRequestScope, type Application } from './application.ts';
import { withOwnedScope } from './owned-scope.ts';

export function handleRequest(app: Application, requestId: string) {
  return withOwnedScope(
    () => createRequestScope(app, requestId),
    scope => scope.resolve('handler').list(),
  );
}
```

These recipes return fully materialized JSON data. Cleanup finishes before the
HTTP response is sent, so a cleanup failure can still become an error response.
The returned data must remain usable after cleanup. A live cursor, stream, or
socket needs a longer scope, described [below](#disconnects-streaming-and-websockets).

## Connect a shutdown signal

For the Node, Express, Fastify, and Bun recipes, save `node-shutdown.ts`:

```ts
export function onShutdown(stop: () => Promise<void>) {
  let stopping = false;
  const beginShutdown = () => {
    if (stopping) return;
    stopping = true;
    void stop().catch(error => {
      console.error('Shutdown failed', error);
      process.exitCode = 1;
    });
  };
  process.on('SIGINT', beginShutdown);
  process.on('SIGTERM', beginShutdown);
}
```

The recipes stop accepting work, let active handlers finish, and then close the
application bag. Calling `app.close()` first begins closing its children and
blocks new resolutions, which can interrupt requests you intended to drain.
An operational shutdown deadline belongs to the host; DI Bag cannot force an
uncooperative factory or disposer to settle. To stop waiting at a host deadline,
race the original close promise while continuing to handle its eventual result:

```ts
const closing = app.close(); // Repeated calls return this same promise.
const cleanup = closing.then(
  () => ({ status: 'closed' as const }),
  error => ({ status: 'failed' as const, error }),
);
let timer: ReturnType<typeof setTimeout> | undefined;
const deadline = new Promise<{ status: 'deadline' }>(resolve => {
  timer = setTimeout(() => resolve({ status: 'deadline' }), 5_000);
});
const outcome = await Promise.race([cleanup, deadline]);
clearTimeout(timer);
if (outcome.status === 'deadline') {
  // Cleanup is still pending; keep observing its eventual success or failure.
  void cleanup.then(result => console.log('Eventual cleanup:', result));
} else if (outcome.status === 'failed') {
  console.error('Cleanup failed:', outcome.error);
}
```

The deadline only bounds the application's wait. It does not release pending
resources or cancel a disposer. The same pattern applies to the `cleanup` promise
on `DiBagStartupCancelledError`.

## Node HTTP

Save this as `server.ts` and run `node server.ts`:

```ts
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createApplication } from './application.ts';
import { handleRequest } from './handle-request.ts';
import { withOwnedScope } from './owned-scope.ts';
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
  })().catch(error => {
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

onShutdown(() => withOwnedScope(
  () => app,
  () => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  }),
));
```

Try `curl http://127.0.0.1:3000/items`. Each response has its own request ID.
The listener explicitly catches its async task because an HTTP event callback
does not await the returned promise. The shutdown sequence uses
[Node's `server.close()`](https://nodejs.org/docs/latest-v24.x/api/http.html#serverclosecallback)
to drain HTTP connections before releasing the application's resources.
Here the shutdown operation intentionally owns the application root. Reusing
`withOwnedScope` ensures application cleanup is attempted even if stopping the
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
import { withOwnedScope } from './owned-scope.ts';
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

onShutdown(() => withOwnedScope(
  () => services,
  () => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  }),
));
```

Express 5 forwards rejected async route handlers to error middleware. For
Express 4, explicitly forward rejection with `.catch(next)`. See the
[Express error-handling guide](https://expressjs.com/en/guide/error-handling/).

Keeping the scope inside a route is useful when one handler owns all the work.
If several middleware stages need it, attach a scope to a typed request-local
property and use one completion path for cleanup. Calling `next()` starts the
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

server.get('/items', request => handleRequest(services, request.id));
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

The root closes in `onClose`, after requests have drained under normal graceful
shutdown. See [Fastify's shutdown lifecycle](https://fastify.dev/docs/latest/Reference/Server/#close).
The route returns a promise containing plain response data; request cleanup
completes inside `handleRequest` before Fastify serializes it.

For a plugin that owns its own services, create its bag during plugin setup and
close it from that plugin's `onClose` hook. Decide whether plugins share the
application root or own independent bags. DI Bag modules organize service
registrations; Fastify plugins organize routes, hooks, and framework context.

## Bun

Use the same `application.ts` with `di-bag/node`. Save this as `server.ts` and run
`bun run server.ts`:

```ts
import { createApplication } from './application.ts';
import { handleRequest } from './handle-request.ts';
import { withOwnedScope } from './owned-scope.ts';
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

onShutdown(() => withOwnedScope(() => app, () => server.stop()));
```

[`server.stop()`](https://bun.sh/docs/runtime/http/server#server-stop) waits for
connections to finish. Passing `true` forces termination, which is a different
shutdown policy. Keep the scope open longer when returning a streaming response.

## Deno and portable acquisition

For Deno, change `application.ts` to import `DiBag` from `di-bag`. Resolve that
bare import through the local npm installation from the README; if needed, use
`"nodeModulesDir": "manual"` in `deno.json`. See
[Deno's manual npm installation mode](https://docs.deno.com/runtime/fundamentals/node/#manual-node_modules-creation).

The portable entry has no automatic native-Promise predicate. Declare the
acquisition mode of **every factory stage**, including overrides. Use this
complete portable version of `application.ts`:

```ts
import { DiBag } from 'di-bag';

type RequestContext = { id: string };
type Catalog = Map<string, string>;

export function createApplication() {
  return DiBag.begin()
    .add({
      catalog: DiBag.withLifetime(
        DiBag.withDisposal(
          DiBag.factory(async () => new Map([['book', 'A good book']]), {
            acquisition: 'native',
          }),
          catalog => catalog.clear(),
        ),
        'root',
      ),
      request: DiBag.factory(
        (): RequestContext => ({ id: 'outside-request' }),
        { acquisition: 'raw' },
      ),
      handler: DiBag.factory(({ catalog, request }: {
        catalog: Promise<Catalog>;
        request: RequestContext;
      }) => ({
        async list() {
          return {
            requestId: request.id,
            items: Array.from((await catalog).values()),
          };
        },
      }), { acquisition: 'raw' }),
    })
    .start(['catalog']);
}

export type Application = Awaited<ReturnType<typeof createApplication>>;

export function createRequestScope(app: Application, requestId: string) {
  return app.scope(['request'], {
    request: DiBag.factory(() => ({ id: requestId }), { acquisition: 'raw' }),
  });
}
```

Keep `owned-scope.ts` and `handle-request.ts` from the earlier sections.
`raw` preserves the exact value without inspecting `then`.
`native` tracks a genuine native promise and gives its fulfillment to the
disposer. Wrapping with `withDisposal`, `withLifetime`, `withMetadata`, or
`withAcquisitionMetadata` preserves the chosen mode. `mapSync` and
positional adapters may introduce new automatic stages; select explicit modes
where those APIs accept an acquisition option. `mapAsync` and
`withAcquisitionMetadataAsync` declare native acquisition. See
[portable host configuration](tutorial.md#portable-mode).

Save this as `server.ts` and run `deno run --allow-net server.ts`:

```ts
import { createApplication } from './application.ts';
import { handleRequest } from './handle-request.ts';

const app = await createApplication();
const server = await (async () => {
  try {
    return Deno.serve({ port: 3000, hostname: '127.0.0.1' }, async request => {
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

## Startup failures and deadlines

Use `.end()` for a completely lazy bag, or `.start(keys, options)` before
opening a listener when selected services must be ready. Starting a service
does not eagerly resolve unrelated registrations.

```ts
import { DiBagStartupCancelledError, DiBagStartupError } from 'di-bag/node';

// builder is your completed application builder, before .end() or .start().
try {
  const app = await builder.start(['catalog'], {
    timeoutMs: 5_000,
    concurrency: 'parallel',
  });
  // Start the listener, then close app during server shutdown.
} catch (error) {
  if (error instanceof DiBagStartupCancelledError) {
    try {
      await error.cleanup;
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Startup cancellation and cleanup failed');
    }
  } else if (error instanceof DiBagStartupError) {
    console.error(error.cause, error.cleanupFailures);
  }
  throw error;
}
```

Cancellation rejects promptly, so its cleanup may still be running. A factory
using `withContext` can forward the supplied signal to a cooperative operation
such as `fetch`. Cancelling the startup wait cannot terminate arbitrary code.
The full [startup API](tutorial.md#start-selected-services-and-cancel-cooperatively)
covers external signals, sequential or bounded startup, readiness, and rollback.
When selected providers compete for connections or temporary workspace, use a
positive safe integer such as `concurrency: 8` to limit simultaneous selected
readiness waits. The default stays parallel; `1` follows sequential readiness.
Dependencies started inside each selected provider can still fan out beyond that
bound. On failure or cancellation, queued selections stay unstarted and ownership
of already started work is retained through cleanup.

## Disconnects, streaming, and WebSockets

The JSON recipes above finish their application work even if a client
disconnects. To cancel a handler's work, pass an application-controlled signal
to its operations. On disconnect, abort that signal, wait for active work to
finish, and then close the request scope. Remove transport listeners when the
operation ends and observe cleanup rejection.

Scope closure tracks acquisitions and disposers, not every later method call
on a service. Directly closing a scope from a disconnect hook is appropriate
only when no active service method still needs its owned resources. Otherwise,
that can dispose a connection while a handler is using it. `withContext` lets
acquisition work cooperate with the scope's signal; it does not automatically
cancel later method calls. Closing a child cannot abort root-owned shared
resources. A signal alone does not prove that work has stopped.

For a streaming response, the lifetime is:

```text
open scope → create stream → send chunks → stream ends or is cancelled → close scope
```

Do not return a live stream from `withOwnedScope`: that helper closes the scope
as soon as its work callback returns. Instead, attach cleanup to the stream's
completion/cancellation path and handle errors there. For Node responses,
`finish` and premature `close` are distinct terminal events; guard cleanup so
both events cannot start separate disposal work. See
[Node response events](https://nodejs.org/docs/latest-v24.x/api/http.html#class-httpserverresponse).

A WebSocket can own a connection scope and create child scopes for individual
messages. Stop admitting messages, await active message work, close message
scopes, then close the connection scope. Account for upgraded connections in
the server's own shutdown procedure. DI Bag does not register HTTP, stream, or
WebSocket hooks automatically.

## Background jobs and message consumers

A job has the same ownership shape as a request. Continuing the common
application, handle one job like this:

```ts
const result = await withOwnedScope(
  () => createRequestScope(app, 'job-42'),
  scope => scope.resolve('handler').list(),
);
// Acknowledge the message after work and cleanup succeed.
console.log(result);
```

Give detached work its own scope. A job that outlives an HTTP request must not
reuse that request's scoped connection or transaction. Pass plain job input,
resolve services again in the job scope, and await jobs during worker shutdown.
Retries can create fresh scopes without replacing the shared root pool.

## Test application services

Use the same request helper to test behavior without opening a socket:

```ts
import assert from 'node:assert/strict';
import { DiBag } from 'di-bag/node';
import { createApplication } from './application.ts';
import { handleRequest } from './handle-request.ts';
import { withOwnedScope } from './owned-scope.ts';

const app = await createApplication();
try {
  await withOwnedScope(
    () => app.fork(['catalog'], {
      catalog: DiBag.withLifetime(
        DiBag.withDisposal(
          async () => new Map([['test', 'Test item']]),
          catalog => catalog.clear(),
        ),
        'root',
      ),
    }),
    async testApp => {
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
the original factory. This test uses the Node/Bun application; portable fixtures
also need explicit acquisition modes. A fork has independent
instances and is not closed by the original app. Use transport-level tests as
well when validating routing, serialization, disconnects, or streaming.

## Organize a larger application

| Need | API and example |
| --- | --- |
| Keep a feature's connection private while exposing its service | [`module`, `exports`, `install`, `rename`](tutorial.md#reuse-named-modules) |
| Inject a database contract into existing classes | [`token`, `bind`, `fromClass`](tutorial.md#adapt-classes-and-positional-functions) |
| Assemble ordered middleware or job handlers | [`contribute`, `all`, `resolveAll`](tutorial.md#compose-an-ordered-collection) |
| Enable optional telemetry | [`optional`](tutorial.md#declare-optional-and-lazy-dependencies) |
| Defer an expensive dependency until a method needs it | [`lazy`](tutorial.md#declare-optional-and-lazy-dependencies) |
| Give one service another public name | [`alias`](tutorial.md#give-a-dependency-another-lookup-name) |
| Expose a narrow interface while keeping ownership of the original client | [`mapSync`, `mapAsync`, `withDisposal`](tutorial.md#project-services-explicitly) |
| Label services and report acquisition events | [`withMetadata`, `inspect`, `observe`](tutorial.md#attach-metadata-and-inspect-without-resolving) |
| Load and validate an application-selected extension | [`fromPlugin`](tutorial.md#admit-an-application-selected-plugin) |

NestJS and Angular also own controllers, components, and framework-specific
scopes. Embedding a bag does not connect those lifecycles automatically. The
[framework boundary discussion](enterprise-integration.md#framework-boundaries)
describes the integration responsibilities.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Every request sees the placeholder ID | Resolve the handler from `createRequestScope`, not the root bag. |
| A client intended to be shared opens once per request | Mark its registration `root`, or explicitly select parent sharing with `scope({ share: [...] })`. |
| A child override does not affect a shared handler | Sharing borrows the parent's complete acquisition and original dependencies. Keep the handler scoped. |
| A promise appears where a service was expected | Async factories expose promises. Declare and await that dependency explicitly. |
| Portable `.end()` rejects before work begins | Check all factory and projection stages, including private modules and overrides, for an undeclared acquisition mode. |
| Cleanup never runs | Attach `withDisposal` and close the owning bag. A method named `close` does not imply ownership. |
| Shutdown remains pending | Look for unfinished acquisitions, uncooperative disposers, active streams, or server connections. |
| A dependency object cannot be spread or enumerated | Read declared properties directly; the runtime proxy cannot recover an erased parameter type's keys. |

The [complete API guide](api-reference.md) explains each method and its options.
The [development guide](development.md) describes the repository's verification
coverage. The server snippets are application recipes, not packaged framework
adapters.
