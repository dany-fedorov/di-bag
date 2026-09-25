# Learn DI Bag

[Install DI Bag](../../README.md#install) · [API reference](api-reference.md) ·
[Server integration](server-integration.md) · [Runnable examples](../../examples)

DI Bag connects ordinary TypeScript factories, checks their dependency shapes,
creates services when they are first requested, and releases the resources that
an application explicitly gives it. This guide starts with a small application
and then introduces the APIs in the order in which most applications need them.

Examples use `DiBag` from `di-bag`, which configures itself on Node, Bun, and
Deno; for browsers and workers see [portable mode](#portable-mode). Complete
examples are labeled **Standalone**. Shorter snippets illustrate individual
operations or build on the declarations in their surrounding section.
Run repository examples from the repository root with `bun run examples/<name>.ts`.

## Learning path

1. [Compose and resolve services](#compose-services).
2. Learn how [async work](#async-edges-are-explicit), [ownership](#attach-disposal-with-providerwithdisposal), and [failures](#errors-and-recovery) behave.
3. Choose between [child containers](#create-child-containers), [independent containers](#create-an-independent-container), and [lifetimes](#choose-a-lifetime).
4. Package a feature as a [module](#reuse-named-modules).
5. Use [typed tokens and positional adapters](#use-typed-tokens-for-explicit-positional-injection) when names and object parameters do not fit.
6. Add [optional or lazy dependencies](#declare-optional-and-lazy-dependencies), [aliases](#give-a-dependency-another-lookup-name), and [ordered collections](#compose-an-ordered-collection).
7. Introduce [projections](#project-services-explicitly), [metadata and inspection](#attach-metadata-and-inspect-without-resolving), [observers](#observe-lifecycle-transitions), or [plugin validation](#admit-an-application-selected-plugin) at explicit boundaries.
8. Read the [portable runtime](#portable-mode) and [native provider metadata](#represent-acquisition-values-and-metadata-natively) rules when those environments apply.

The [API reference](api-reference.md) is the compact source for exact signatures,
error fields, and exported TypeScript types. This guide concentrates on when to
use each operation and what it means for the graph.

## Compose services

Start with `DiBag.createBuilder()`, add named factories, and finish the graph with
`.buildContainer()`. A factory's object parameter declares its dependencies.

**Standalone example:**

```ts
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder()
  .withServices({
    config: () => ({ greeting: 'Hello' }),
    greeter: ({ config }: { config: { greeting: string } }) => ({
      greet(name: string) {
        return `${config.greeting}, ${name}!`;
      },
    }),
  })
  .buildContainer();

console.log(app.resolve('greeter').greet('Ada')); // Hello, Ada!
await app.close();
```

`createBuilder()` returns an immutable `Builder`. `withServices()` returns another builder with
new named providers, and `buildContainer()` checks the complete graph and returns a
`Container`. The same builder can instead seal a reusable [module](#reuse-named-modules). Keep the returned builder or chain the call. Provider order does not
matter, so a dependency may be added after its consumer. Duplicate names fail;
use `withReplacedService()` when changing an existing provider is intentional.

**Using the same `DiBag` import:**

```ts
const initial = DiBag.createBuilder().withServices({ clock: () => 42 });
const changed = initial.withReplacedService('clock', () => 'ready').buildContainer();

changed.resolve('clock'); // inferred as string
await changed.close();
```

`withReplacedService(serviceKey, provider)` checks the replacement against known
consumers and, for a token, against its service contract. It may change a named
service's type only while every surviving consumer remains valid. Missing forward
dependencies remain allowed until `buildContainer()`.

Factories are called without a `this` receiver. `resolve(nameOrToken)` lazily
creates the selected service and its dependencies. Scoped services are cached,
including `undefined` and an in-flight Promise, so repeated resolutions in one
container return the same value. A factory is still borrowed by default even if its
result has a method called `close` or `dispose`.

The dependency object is a lazy view, not a plain record. Reading a property
acquires that dependency; destructuring in the parameter list is the usual way
to do it. Testing `'name' in deps`, calling `Object.keys(deps)`, spreading
`{ ...deps }`, or serializing it with `JSON.stringify` throws
`DI_BAG_INVALID_DEPENDENCY_ACCESS`, because those operations would otherwise
report an empty object. Read every dependency by name.

`DiBag.createProvider(factory, { factoryReturnKind })` describes the output stage explicitly.
It is useful for deliberate uninspected Promise-like values and is required by one of the
portable-runtime strategies described under [portable mode](#portable-mode). It
does not run the factory or transfer disposal ownership.

## Async edges are explicit

An async factory exposes its Promise. A consumer declares that Promise in its
dependency type and decides where to await it.

**Standalone example:**

```ts
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder()
  .withServices({
    number: async () => 21,
    answer: async ({ number }: { number: Promise<number> }) => (await number) * 2,
    synchronous: () => 'ready',
  })
  .buildContainer();

const answer: Promise<number> = app.resolve('answer');
console.log(await answer); // 42
console.log(app.resolve('synchronous')); // ready
await app.close();
```

DI Bag does not await dependency values implicitly or turn synchronous outputs
into Promises. Concurrent resolutions share an in-flight cached Promise. A
thrown factory error or rejected factory Promise evicts that failed attempt, so
a later resolution can retry with a new attempt.

Dependency cycles throw or reject with a path such as `cycle: a -> b -> a`.
Cycle detection also follows dependency reads that happen after an `await`.
Failed attempts keep the work and accepted ownership stages needed for disposal;
they do not redirect their dependency edges to a later retry.

### Make selected services ready, and cancel cooperatively {#make-selected-services-ready}

Use `container.ensureServicesReady(keys, options?)` when selected services must be
ready before the application accepts work. Call `builder.buildContainer()` first.
Readiness acquires only the selection and its dependencies in that container.
Everything else stays lazy.

**Standalone example:**

```ts
import { DiBag, DiBagServiceReadinessCancelledError } from 'di-bag';

const builder = DiBag.createBuilder().withServices({
  url: () => 'https://example.com/settings.json',
  settings: DiBag.createProvider(
    async ({ url }: { url: string }, { abortSignal: signal }) => {
      const response = await fetch(url, { signal });
      return response.text();
    },
    { factoryReceivesContext: true },
  ),
});

try {
  const app = await builder.buildContainer().ensureServicesReady(['settings'], {
    totalTimeoutMs: 5_000,
  });
  try {
    console.log(await app.resolve('settings'));
  } finally {
    await app.close();
  }
} catch (error) {
  if (error instanceof DiBagServiceReadinessCancelledError) {
    await error.disposalPromise;
  }
  throw error;
}
```

The selection may contain existing names, service tokens, and collection tokens.
All selections begin concurrently by default. `maxConcurrentServiceKeys: 1`
waits in tuple order and does not start later selections after a failure.
A positive safe integer, such as `maxConcurrentServiceKeys: 8`, limits the number
of selected keys waiting for readiness at once. Numeric scheduling stops admitting
queued selections after a failure or cancellation; started work still belongs to
the container and is disposed. Dependencies inside a provider and contributions
inside a collection are not bounded by this option. It does not await uninspected
thenables. Zero, negative,
fractional, nonfinite, and unsafe integer bounds are rejected before factories.
An empty selection is valid. Options also
accept a genuine external `abortSignal` and a finite positive `totalTimeoutMs`.
Invalid options and an already-aborted signal start no factories. Once readiness
succeeds, the timer and external listener are removed; a later abort of that
external signal does not close the container.

`DiBag.createProvider(factory, { factoryReceivesContext: true })` passes a frozen factory context as the
factory's second argument. Each acquisition receives its own context object. Its
`abortSignal` belongs to the container that owns the attempt.
Singleton services use their defining container's signal even when a child first asks for them.
Closing a container aborts its signal before draining pending work. Cancellation is
cooperative: JavaScript that ignores the signal can keep disposal pending.

#### Release a partially acquired resource {#release-partial-acquisition}

`providerWithDisposal` owns the value a factory *returns*, so a factory that acquires a
resource and then fails has nothing to hand over. `factoryCtx.pushDisposer(disposer)`
makes the container own a resource the factory already holds:

```ts
import { DiBag } from 'di-bag';

declare function openPool(): Promise<{ end(): Promise<void>; connect(): Promise<{ close(): Promise<void> }> }>;
declare function handshake(socket: { close(): Promise<void> }): Promise<void>;

const session = DiBag.providerWithDisposal({ provider: DiBag.createProvider(async (_deps: {}, factoryCtx) => {
    const pool = await openPool();
    factoryCtx.pushDisposer(() => pool.end());
    const socket = await pool.connect();
    factoryCtx.pushDisposer(disposerCtx => { if (disposerCtx.reason !== 'service-disposed') return socket.close(); });
    await handshake(socket);
    return { socket, close: () => socket.close() };
  }, { factoryReceivesContext: true }), disposeService: session => session.close() });
```

Each pushed disposer runs exactly once, last pushed first. If the factory
throws or rejects, disposal starts immediately with `socket.close()` before
`pool.end()`. In that case `disposerCtx.reason` is `'factory-failed'`. If the
factory returns, the container owns them below the returned value: at `close()`, and
at retirement when a later projection fails, every disposer of the service runs
first and then the pushed disposers. `reason` says how disposal of the returned
value went: `'service-disposed'`,
`'service-disposal-failed'` (it threw; the pushed disposers still run), or
`'no-service-disposer'`. Ownership a consumer attaches to a transformed value is
not the service disposer; its failures are reported on their own.

`providerWithDisposal` owns the returned value; `pushDisposer` owns what is acquired on
the way. `pool` above is released only by its pushed disposer. The socket is the
returned value, released by `session.close()`, so its pushed disposer acts only
when `reason` is not `'service-disposed'`. A pushed disposer that ignores
`disposerCtx` runs unconditionally, which is right when nothing else releases
the resource.

Every disposer is attempted even when one rejects; each rejection is reported
like a `close()` disposer failure, through `disposal-failed` observer events and
the `DiBagDisposalError` of the owning `close()`. Two shapes deserve a note. An
`exposed-service` projection over an asynchronous source is ready while the source is
still running, so a source that then fails runs its pushed disposers at once and
its projection's own disposer at `close()`. An `uninspected` asynchronous factory
completes when it returns its Promise: a disposer pushed before its first
`await` is owned and runs at `close()`, one pushed after throws, and a later
rejection of that Promise is not a factory failure. Transient services keep
each attempt's pushed disposers until `close()`, like `providerWithDisposal`.

Rollback starts one microtask after the factory fails and is not awaited by the
failing `resolve`; `close()` or the `disposalPromise` of
`DiBagServiceReadinessCancelledError` waits for it to finish. Without a projection the
rejection reaches the consumer first. Under `providerWithTransformedService` or acquisition
metadata the pushed disposers can run before the projected Promise rejects and
before `acquisition-failed`.
`pushDisposer` belongs to one running factory; calling it on a context retained
past that factory throws
[`DI_BAG_DISPOSER_PUSHED_AFTER_FACTORY`](../agent/errors.md#di-bag-disposer-pushed-after-factory).

Readiness waits according to the selected service's final factory return kind. An uninspected
Promise or thenable is already a ready value; a native Promise waits for
settlement without changing its identity. On acquisition failure, readiness closes
the container and rejects with `DiBagServiceReadinessError`. Abort or timeout rejects promptly
with `DiBagServiceReadinessCancelledError`; its `disposalPromise` Promise lets the application wait
for eventual shutdown, including resources acquired after cancellation.

## Attach disposal with `providerWithDisposal` {#attach-disposal-with-providerwithdisposal}

Use `DiBag.providerWithDisposal({ provider, disposeService })` when the container should own the value
successfully acquired by a provider.

**Standalone example:**

```ts
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder()
  .withServices({
    cache: DiBag.providerWithDisposal({ provider: () => new Map<string, string>(), disposeService: (cache) => cache.clear() }),
  })
  .buildContainer();

try {
  app.resolve('cache').set('answer', '42');
} finally {
  await app.close();
}
```

The wrapper describes ownership; neither callback runs when it is constructed.
For a native async factory, the disposer receives the fulfilled value. Disposal
may be synchronous or asynchronous. Ordinary factories remain borrowed, and
method names never imply ownership. A never-resolved provider owns nothing.

Ownership is additive. If a provider is projected and wrapped again, each
accepted stage retains its original value and disposer. Disposal runs dependents
before their dependencies; unrelated resources run in reverse successful
acquisition order. Explicitly owning the same object twice runs both finalizers.

`container.close()` immediately blocks new public resolutions, child containers, and independent containers. It
aborts the container signal, waits for pending acquisitions and retired disposal, and
then runs disposers sequentially. Repeated calls return the same Promise and
disposal runs once. A parent closes live child containers before releasing its own
resources. Stop application work before closing: already-returned services cannot
be revoked, and a disposer must not await the same container's `close()` Promise.

By default `close()` waits as long as disposal takes. `close({ waitTimeoutMs, abortSignal })`
starts the same disposal but stops waiting when the deadline passes or the signal
aborts. It rejects with `DiBagCloseCancelledError`: `code` is
`DI_BAG_CLOSE_TIMEOUT` or `DI_BAG_CLOSE_ABORTED`, `details.disposersStillRunning` lists the
labels of disposers that started and have not finished, `details.acquisitionsStillPending` lists
acquisitions disposal is still draining, and `disposalPromise` settles when disposal
eventually finishes. Child and independent containers accept the same options.

An automatic synchronous stage accepts ordinary values and observes native
Promises. A structural thenable returned directly is rejected without invoking
its `then` or transferring ownership. Query builders from libraries such as Knex,
Drizzle, or Mongoose are thenables, so a plain factory that returns one is
rejected at compile time with
`factory output is a structural thenable: users; ...`. Normalize such a value
explicitly inside an async boundary, for example
`() => Promise.resolve(legacyThenable)`, or select the stage explicitly with
`DiBag.createProvider(create, { factoryReturnKind: 'uninspected' })` when the builder object
itself is the service. Use an uninspected stage when the Promise object itself is the
owned value. To disable the compile-time check for a whole project, augment the
policy interface once:

```ts
declare module 'di-bag' {
  interface DiBagPolicy { readonly structuralThenables: 'allow' }
}
```

The runtime rejection stays in place either way.

**Conceptual snippet:** `pendingPromise`, `releasePromiseHandle`, and the fulfilled
resource's `close` method are application values.

```ts
const uninspectedOwned = DiBag.providerWithDisposal({
  provider: DiBag.createProvider(() => pendingPromise, { factoryReturnKind: 'uninspected' }),
  disposeService: (promise) => releasePromiseHandle(promise),
});

const fulfilledOwned = DiBag.providerWithDisposal({
  provider: DiBag.createProvider(() => pendingPromise, { factoryReturnKind: 'native-promise' }),
  disposeService: (resource) => resource.close(),
});
```

Uninspected ownership does not wait for the Promise; native ownership transfers only
after fulfillment. A factory
must release anything it acquires before it successfully returns an owned value.

## Errors and recovery

Factory and projection failures keep their original identity. DI Bag errors expose a stable `code` and frozen `details` for recovery and
telemetry. Disposal, readiness, and plugin failures also have specialized classes.
Application exceptions keep their identity and are never relabeled as library errors.

| Error | Recovery information |
| --- | --- |
| `DiBagDisposalError` | `close()` attempted all finalizers. `errors` holds their original errors, while `failures` adds `acquisitionId`, `bindingId`, `bindingLabel`, and `error`. |
| `DiBagServiceReadinessError` | Readiness acquisition failed and rollback finished. Read `cause`, `disposalFailures`, and optional `disposalError`. |
| `DiBagServiceReadinessCancelledError` | Readiness was aborted or timed out. Read `reason`, `cause`, and await `disposalPromise` if shutdown completion matters. |
| `DiBagCloseCancelledError` | `close({ waitTimeoutMs, abortSignal })` stopped waiting. Read `code`, `details.disposersStillRunning`, and await `disposalPromise` if shutdown completion matters. |
| `DiBagPluginValidationError` | A plugin descriptor or output failed validation. `phase` is `'descriptor'` or `'output'`, and `reason` explains the rejection. |

Every library-created message has the form
`<code>: <message>; see https://dany-fedorov.github.io/di-bag/agent/errors.html#<code-slug>`,
for example `DI_BAG_DEPENDENCY_CYCLE: cycle: a -> b -> a; see https://dany-fedorov.github.io/di-bag/agent/errors.html#di-bag-dependency-cycle`.
The linked section explains the cause and the fix. Branch on `code` and
`details`, not on message text.

**Standalone example:**

```ts
import { DiBag, DiBagDisposalError } from 'di-bag';

const app = DiBag.createBuilder().withServices({
  cache: DiBag.providerWithDisposal({
    provider: () => new Map<string, string>(),
    disposeService: cache => cache.clear(),
  }),
}).buildContainer();
app.resolve('cache');

try {
  await app.close();
} catch (error) {
  if (error instanceof DiBagDisposalError) {
    for (const failure of error.failures) {
      console.error(failure.bindingLabel, failure.error);
    }
  }
  throw error;
}
```

When one disposer fails, remaining disposers still run. The container remains closed,
and another `close()` observes the
same rejected Promise. Acquisition failures remain on their resolution Promises;
they are not added to a later close error. See the [API reference](api-reference.md#errors-and-recovery)
for exact class shapes and constructors.

## Read compile-time rejections

`buildContainer()`, `withServices()`, `withReplacedService()`, `createIndependentContainer()`, and `createChildContainer()` reject an
invalid graph at compile time. TypeScript reports these as assignability errors
whose message names the problem and, where it is cheap to compute, the services involved.
Each message ends with the section of the
[errors page](../agent/errors.md#compile-time) that gives the cause and fix, for
example `; see https://dany-fedorov.github.io/di-bag/agent/errors.html#missing-service`;
the table omits that suffix:

| Message | Meaning |
| --- | --- |
| `required services are missing: clock` | No provider supplies `clock`. |
| `provided service does not satisfy its consumer dependency` | A service's type does not match what a consumer declares. `verifyGraphAtCompileTime()` shows the consumer, dependency, expected type, and provided type. |
| `singleton lifetime cannot capture scoped dependency: db -> config` | A singleton service would hold a scoped one. |
| `createIndependentContainer accepts existing names or typed tokens only: unknown extra` | A selected key is not registered. |

The full detail object (expected and provided types, every relationship) is part
of the error type. With the default error truncation it prints as `{ ...; }`;
set `"noErrorTruncation": true` in `tsconfig.json` to read it.

`buildContainer()` errors are anchored where the builder expression starts. To get the
verdict on a line of your choice, call `verifyGraphAtCompileTime()`; it does nothing at
runtime and its return type is `void` exactly when the graph would build:

```ts
const builder = DiBag.createBuilder().withServices({
  db: ({ config }: { config: { url: string } }) => config.url,
});
builder.verifyGraphAtCompileTime() satisfies void;
// error: Type 'Unsatisfied<"required services are missing: config; see https://dany-fedorov.github.io/di-bag/agent/errors.html#missing-service", { missing: "config"; ... }>' does not satisfy the expected type 'void'.
```

`CompositionReport<typeof builder>` is the same verdict as a type, for
assertions in test files.

## Create child containers {#create-child-containers}

A child container represents work owned by a parent, such as one request or job. The
zero-argument form creates fresh scoped acquisitions while automatically using
singleton services according to their lifetime.

**Standalone example:**

```ts
import { DiBag } from 'di-bag';

const root = DiBag.createBuilder()
  .withServices({
    requestId: () => crypto.randomUUID(),
  })
  .buildContainer();

const child = root.createChildContainer();
root.resolve('requestId');
child.resolve('requestId'); // a different value, cached by child

await root.close(); // closes the live child first
```

There are three `createChildContainer` forms:

- `createChildContainer()` creates a tracked child with the same graph.
- `createChildContainer({ sharedParentServiceKeys: keys })` also borrows selected parent acquisitions.
- `createChildContainer(keys, providers, { sharedParentServiceKeys: otherKeys }?)` replaces selected bindings in
  the child and may borrow a disjoint selection from the parent.

**Standalone example:**

```ts
import { DiBag } from 'di-bag';

const parent = DiBag.createBuilder()
  .withServices({
    config: () => ({ region: 'eu' }),
    client: ({ config }: { config: { region: string } }) => ({ region: config.region }),
  })
  .buildContainer();

const child = parent.createChildContainer(
  ['config'],
  {
    config: () => ({ region: 'us' }),
  },
  { sharedParentServiceKeys: ['client'] },
);

child.resolve('config').region; // us
child.resolve('client') === parent.resolve('client'); // true; client keeps eu
const grandchild = child.createChildContainer({ sharedParentServiceKeys: ['client'] });
await parent.close();
```

Both selections accept existing names and genuine typed tokens. Overrides must
preserve the original service contracts. Only
selected override properties are read; extra properties cannot alter the graph.
A key cannot be selected for both override and sharing.

Sharing borrows the parent's entire acquisition: value, pending Promise,
dependencies, metadata, cancellation context, and disposal ownership. Child
shutdown cannot abort or dispose it. Scoped sharing must be selected again in
each descendant. Transient services cannot be shared because there is no parent
cache to borrow. Singleton services are inherited automatically.

An inherited singleton service keeps the graph and dependencies of the container
that defined it, even when a child replaces one of those dependencies.
A child cannot replace a singleton service. Use an independent container for that
replacement.

Closing a child independently leaves parent and siblings open. Closing a parent
begins closing its live descendants and waits for them before parent finalizers.
An independently closed child detaches only after its close settles, so the caller
owns any failure from that close.

## Create an independent container for tests {#create-an-independent-container}

Use an independent container when it needs independent ownership, memoization, and
shutdown. `createIndependentContainer()` keeps the graph and creates all instances afresh.
`createIndependentContainer(keys, providers)` also replaces an explicit selection.

**Standalone example:**

```ts
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder()
  .withServices({
    clock: () => ({ now: () => 42 }),
    stamp: ({ clock }: { clock: { now(): number } }) => clock.now(),
  })
  .buildContainer();

const testApp = app.createIndependentContainer(['clock'], {
  clock: () => ({ now: () => 7 }),
});

console.log(testApp.resolve('stamp')); // 7
console.log(app.resolve('stamp')); // 42
await testApp.close();
await app.close();
```

The selection must be an inline tuple or a separately declared `as const` tuple.
Every selected key must be an own property of the override object. Extra
properties are ignored. Explicit selection keeps TypeScript's checked keys equal
to the runtime keys despite structural object typing.

Independent containers are never tracked by their source, including independent containers created from child
containers. Close each one separately. An independent container may replace an owned provider with an
ordinary factory to borrow an external value, or add disposal to an ordinary
provider. Do not register the same shared value as owned in several containers unless
multiple disposal calls are intentional.

### WBS-shaped ownership example

The [WBS example](../../examples/wbs-scope.ts) shows an application-owned
source, a root container, and independently closed batch containers. The following is a
conceptual excerpt; `scope`, `openCollector`, and the singleton services are application
values defined in that example:

```ts
const batch = root.createIndependentContainer(['source', 'clock', 'replayBuffer', 'stores', 'broadcast'], {
  source: () => root.resolve('source'),
  clock: () => root.resolve('clock'),
  replayBuffer: () => root.resolve('replayBuffer'),
  stores: () => scope.stores,
  broadcast: DiBag.providerWithDisposal({ provider: openCollector, disposeService: collector => collector.close() }),
});
```

Borrowed values use ordinary factories; the batch owns only its collector. The
application closes batches first, then the root, then the source it created.
Transaction rollback is application behavior rather than a DI Bag feature.

For request child containers, shutdown signals, Node HTTP, Express, Fastify, Bun, Deno,
streaming, WebSockets, jobs, and message consumers, continue with the
[server integration guide](server-integration.md).

## Choose a lifetime: singleton, scoped or transient {#choose-a-lifetime}

A lifetime says how many instances of a service a container tree holds. A
container tree is a root container and all its child containers. Every value is
written in full, `term:description`. The term is what other dependency injection
containers call it. The description is what it means here.

| Value | Instances | Owned and disposed by |
| --- | --- | --- |
| `'singleton:one-per-container-tree'` | one, shared by the root and every child | the container that defines the provider, usually the root |
| `'scoped:one-per-container'`, the default | one in each container that resolves it | that container |
| `'transient:one-per-resolve'` | a new one for every `resolve` and every dependency read | the container that resolved it |

An unmarked provider is scoped; choose singleton explicitly when child containers should share it.
With one container, singleton and scoped behave the same. Lifetimes start to
matter with the first `createChildContainer()`, typically one per request or job.

**Standalone example:**

```ts
import { DiBag } from 'di-bag';

type RequestContext = { requestId: string };
let served = 0;
const app = DiBag.createBuilder()
  .withServices({
    clock: DiBag.providerWithLifetime({
      provider: () => ({ now: () => Date.now() }),
      lifetime: 'singleton:one-per-container-tree',
    }),
    request: (): RequestContext => ({ requestId: `request-${++served}` }),
    handler: ({ clock, request }: { clock: { now(): number }; request: RequestContext }) =>
      () => `${request.requestId} at ${clock.now()}`,
  })
  .buildContainer();

const first = app.createChildContainer();
const second = app.createChildContainer();
console.log(first.resolve('clock') === second.resolve('clock')); // true: one clock for the tree
console.log(first.resolve('request') === second.resolve('request')); // false: one request per container
await app.close();
```

Two rules are checked when the graph is built, at compile time:

- **A singleton may not depend on a scoped service.** It would keep the defining
  container's instance forever. The message names both services. Leave the
  consumer scoped too, as `handler` is above, or make the dependency a singleton.
- **A child container replaces only scoped and transient services.** Replacing
  a singleton in one child would leave every other container with the original.
  Mark the service scoped, or use `createIndependentContainer`, which shares no
  cached instance with its source and may replace anything.

A provider that holds per-request state remains separate in each child container
with the scoped default, even when all its dependencies are singletons.

A transient service with a disposer stays owned by the container that resolved
it until that container closes. Resolved from the root of a long-running
process, such instances pile up. Resolve disposable transients in a child
container, which releases them when it closes.

Lifetime controls caching and attempt ownership; it does not add disposal.
Singleton attempts belong to the container that defines the binding, even if a
descendant resolves them first. Scoped and transient attempts belong to the
resolving container or to the owner of the acquisition that requests them.
An independent container starts a new container tree.

Use `allowsScopedDependencies: true` only for a deliberate singleton capture
through the defining container's context:

**Standalone example:**

```ts
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder()
  .withServices({
    rootContext: () => ({ region: 'eu' }),
    client: DiBag.providerWithLifetime({ provider: ({ rootContext }: { rootContext: { region: string } }) => ({
        region: rootContext.region,
      }), lifetime: 'singleton:one-per-container-tree', allowsScopedDependencies: true }),
  })
  .buildContainer();
await app.close();
```

Capture always builds through the root context; it does not borrow a child-owned
value. Capture options are valid only for an
individually known `'singleton:one-per-container-tree'` lifetime. An outer lifetime wrapper replaces an
earlier caching policy. Graph completion and selected container replacements
recheck captive dependencies.

## Reuse named modules

Modules group a feature's private services and publish only the entry points an
application needs. There is no separate module builder: any `Builder` seals into
a module with `buildModule({ exportedServiceKeys })`, and any builder installs modules.

**Standalone example:**

```ts
import { DiBag } from 'di-bag';

const reports = DiBag.createBuilder()
  .withServices({
    connection: () => ({ open: true }),
    service: ({
      connection,
      logger,
    }: {
      connection: { open: boolean };
      logger: { log(message: string): void };
    }) => ({
      read() {
        logger.log('read');
        return connection.open;
      },
    }),
  })
  .buildModule({ exportedServiceKeys: ['service'] });

const app = DiBag.createBuilder()
  .withInstalledModules([reports])
  .withServices({ logger: () => ({ log: console.log }) })
  .buildContainer();

app.resolve('service').read();
await app.close();
```

`buildModule({ exportedServiceKeys })` seals the builder's graph and chooses its public string
names and typed tokens. An empty export tuple is valid; contributions are still
installed. Where `buildContainer()` rejects a missing dependency, `buildModule` records
it as a requirement the installing host must satisfy. A sealed module cannot
resolve, start, or close anything; `withInstalledModules([module])` gives module
acquisitions an owning container.

Modules nest. A builder that has installed modules can seal into a module of its
own. Names resolve lexically: an inner module's own registrations first, then
the enclosing module's, then the host's. Each installation, at every depth,
receives fresh private identities and separate disposal ownership. Requirements
an inner module leaves unmet pass outward unless the enclosing module satisfies
them; a requirement satisfied by an enclosing export stays checked when the host
replaces that export, while one satisfied privately is final.

`buildModule({ exportedServiceKeys, moduleLabel: 'reports' })` names each installation's private
bindings `reports/connection` in error messages, cycle paths, `graphSnapshot()`,
and observer events. Exported bindings keep their bare key. Labels compose when
modules nest: a private `state` of an `inner` module installed in an `outer`
module appears as `outer/inner/state`. Without a label, bindings keep their bare
key.

Private providers keep their external requirements, including requirements from
providers that are not currently reachable from an export. The host may satisfy
them later with `withServices`, another installation, or a forward registration before
`buildContainer()`. Each installation gets fresh private binding identities and ownership.

`module.withRenamedExport({ currentExportKey, newExportKey })` returns a new export view. It changes a public
string lookup name without changing the name used inside factory dependency
parameters. Typed-token exports retain their symbol identity and cannot be
renamed. Renaming every string export lets an application install the same module
twice under distinct public names.

**Continuation of the preceding module example:**

```ts
const eastReports = reports.withRenamedExport({ currentExportKey: 'service', newExportKey: 'eastReports' });
const westReports = reports.withRenamedExport({ currentExportKey: 'service', newExportKey: 'westReports' });

const regionalApp = DiBag.createBuilder()
  .withInstalledModules([eastReports, westReports])
  .withServices({ logger: () => ({ log: console.log }) })
  .buildContainer();
await regionalApp.close();
```

Use `module.withRenamedRequirement({ currentRequirementKey, newRequirementKey })`
when a string requirement needs a different host key. Internal dependency names
stay the same. Token requirements keep their global symbol identity.

Host `withReplacedService` and selected container replacements are visible to consumers inside the
installed module, including its
private providers. Module constraints keep those replacements checked. Preserve
inferred module types with `typeof` or `ReturnType`; see the [exported type
reference](api-reference.md#exported-typescript-types) when publishing these
contracts from a library.

## Use typed tokens for explicit positional injection

Names work well for application-owned services. A typed token is useful for a
shared contract, a symbol identity, or positional adapters. Give the symbol a
canonical `const` declaration, create one token from it, and export that token
when other files need the identity.

**Standalone example:**

```ts
import { DiBag } from 'di-bag';

const clockKey = Symbol('clock');
const clock = DiBag.createToken(clockKey).forService<{ now(): number }>();

const stamp = DiBag.createProviderFromFunction({ dependencies: [clock], factoryFunction: (selectedClock) => selectedClock.now() });

const app = DiBag.createBuilder()
  .withTokenService(clock, () => ({ now: () => 42 }))
  .withServices({ stamp })
  .buildContainer();

app.resolve(clock).now(); // 42
app.resolve('stamp'); // 42
clock.symbol === clockKey; // true
await app.close();
```

`token.symbol` is the original symbol and is useful as a computed property in
selected overrides. The token handle is the lookup identity; copied, proxied, or
fabricated shapes are rejected. Keep both the symbol and token canonical. Do not
pass a temporary inline `Symbol()` call to `createToken`; it cannot establish the stable
unique-symbol identity required by type admission.

`withTokenService(token, provider)` adds a single service and verifies that the
provider output satisfies the token's service type. A token is either for one
service or for a collection. Use `forService<T>()` for one service and
`forCollectionOf<T>()` for contributions.

`DiBag.createProviderFromFunction({ dependencies, factoryFunction, factoryReturnKind })` resolves a tuple of tokens
and dependency references and calls the callback with values in tuple order. The
tuple is captured when the provider is created, callbacks run without a receiver,
and no work happens before resolution. The optional `factoryReturnKind` describes
the callback's output stage.

### Adapt classes and positional functions

Use `createProviderFromClass` and `createProviderFromFunction` for existing code whose constructor or
function already takes positional arguments.

**Standalone example:**

```ts
import { DiBag } from 'di-bag';

class Client {
  constructor(private readonly port: number) {}
  address() {
    return `localhost:${this.port}`;
  }
}

function endpoint(client: Client, path: string) {
  return `http://${client.address()}/${path}`;
}

const portKey = Symbol('port');
const clientKey = Symbol('client');
const pathKey = Symbol('path');
const port = DiBag.createToken(portKey).forService<number>();
const client = DiBag.createToken(clientKey).forService<Client>();
const path = DiBag.createToken(pathKey).forService<string>();

const app = DiBag.createBuilder()
  .withTokenService(port, () => 8080)
  .withTokenService(client, DiBag.createProviderFromClass({ dependencies: [port], serviceClass: Client }))
  .withTokenService(path, () => 'health')
  .withServices({ endpoint: DiBag.createProviderFromFunction({ dependencies: [client, path], factoryFunction: endpoint }) })
  .buildContainer();

console.log(app.resolve('endpoint')); // http://localhost:8080/health
await app.close();
```

`DiBag.createProviderFromClass({ dependencies, serviceClass, factoryReturnKind })`
calls `new serviceClass(...args)`.
`DiBag.createProviderFromFunction({ dependencies, factoryFunction, factoryReturnKind })`
calls the function without a receiver.
Their tuples accept service tokens, collection tokens, and `optional` or `lazy` references. Argument
and returned Promise identity are preserved. Bind a method first if it needs its
receiver, for example `settings.format.bind(settings)`.

The optional `factoryReturnKind` selects the adapter's
output stage. A class with a `close` method remains borrowed until explicitly
wrapped with `providerWithDisposal`. [`examples/composition.ts`](../../examples/composition.ts)
combines tokens, classes, functions, references, and aliases.

## Declare optional and lazy dependencies

Dependency references work only inside the positional dependency tuples accepted
by `createProviderFromFunction`, `createProviderFromClass`, and `createProviderFromPlugin`.

**Standalone example:**

```ts
import { DiBag } from 'di-bag';

const portKey = Symbol('port');
const hostKey = Symbol('host');
const port = DiBag.createToken(portKey).forService<number>();
const host = DiBag.createToken(hostKey).forService<string>();

class Reporter {
  constructor(
    private readonly getPort: () => number,
    private readonly host: string | undefined,
  ) {}
  address() {
    return `${this.host ?? 'localhost'}:${this.getPort()}`;
  }
}

const reporter = DiBag.createProviderFromClass({ dependencies: [DiBag.lazy(port), DiBag.optional(host)], serviceClass: Reporter });
const app = DiBag.createBuilder()
  .withTokenService(port, () => 8080)
  .withServices({ reporter })
  .buildContainer();

app.resolve('reporter').address(); // localhost:8080
await app.close();
```

`optional(token)` supplies `Service | undefined` only when the binding is absent.
A bound service whose value is `undefined` is present, acquired, and owned in the
ordinary way. Failures from a present optional service still propagate. An
optional TypeScript function parameter alone does not make a graph dependency
optional.

`lazy(token)` supplies `() => Service` and acquires the target when called. The
target must exist when the graph is completed. Scoped and singleton targets keep their
cache; a transient target creates an attempt per call. The lookup records the
dependency edge at call time and retains the provider's graph, owner, cancellation
context, and shutdown rules. Calling it after that owner closes throws.

References preserve exact values and Promises and add no implicit awaiting or
ownership. Each wraps one genuine token. References cannot be nested or used as
binding identities.

## Give a dependency another lookup name

`withServiceAlias({ aliasKey, targetServiceKey })` adds a lookup for the target's canonical service.

**Standalone example:**

```ts
import { DiBag } from 'di-bag';

const clientKey = Symbol('client');
const client = DiBag.createToken(clientKey).forService<{ port: number }>();

const app = DiBag.createBuilder()
  .withServices({ service: () => ({ port: 8080 }) })
  .withServiceAlias({ aliasKey: 'primary', targetServiceKey: 'service' })
  .withServiceAlias({ aliasKey: client, targetServiceKey: 'primary' })
  .buildContainer();

app.resolve(client) === app.resolve('service'); // true
await app.close();
```

Both keys can be a string name or service token. The alias key must be new.
A named target must already exist so TypeScript can infer its output. A token
target may be supplied later, and completion checks it. A token destination also
checks that it accepts the target output.

An alias creates no cache, attempt, or owner. It preserves the canonical target's
identity, Promise, lifetime, readiness, and factory return kind. Replacing the target
changes aliases in that graph. Overriding the alias destination replaces only
that destination. A shared alias borrows the parent's target and context even if
the child overrides that target. Transient targets cannot be shared through an
alias, and singleton captive checks follow alias chains.

`serviceSnapshot(alias).aliasTarget` reports its direct target, while acquisition snapshots
come from the canonical service. Use an ordinary provider when the new lookup
must transform a value or add separate ownership.

## Compose an ordered collection

Contributions let features append middleware, handlers, validators, or other
ordered services without competing for one service binding.

**Standalone example:**

```ts
import { DiBag } from 'di-bag';

type Step = (text: string) => string;
const stepKey = Symbol('pipeline step');
const step = DiBag.createToken(stepKey).forCollectionOf<Step>();

const prefixFeature = DiBag.createBuilder()
  .withServices({ prefix: () => 'Hello, ' })
  .withCollectionContribution({
    collectionToken: step,
    provider: ({ prefix }: { prefix: string }): Step =>
      (text) =>
        prefix + text,
  })
  .buildModule({ exportedServiceKeys: [] });

const app = DiBag.createBuilder()
  .withCollectionContribution({ collectionToken: step, provider: (): Step => (text) => text.trim() })
  .withInstalledModules([prefixFeature])
  .withCollectionContribution({ collectionToken: step, provider: (): Step => (text) => `${text}!` })
  .withServices({
    pipeline: DiBag.createProviderFromFunction(
      { dependencies: [step], factoryFunction: (operations) => (text: string) =>
        operations.reduce((value, operation) => operation(value), text) },
    ),
  })
  .buildContainer();

app.resolve('pipeline')('  DI  '); // Hello, DI!
app.resolveCollection(step); // readonly Step[]
await app.close();
```

`withCollectionContribution({ collectionToken, provider })` appends one checked provider. Host and module
installation order determine the result order. `resolveCollection(token)` returns a new
frozen array on every read; acquired service objects retain their identity and
mutability. An empty collection is valid. Repeated providers or module installs
create distinct contribution bindings; there is no deduplication.

A collection token in a positional dependency tuple supplies the whole collection.
It does not require a single-service binding. A token created with
`forCollectionOf<T>()` identifies a collection and cannot register a single service.
Each contribution keeps its own dependencies, lifetime,
factory return kind, attempt, and disposal ownership. Collection reads do not await
items or create an aggregate owner. A partial failure propagates the original
error while accepted items remain owned until normal shutdown; a retry can reuse
them.

A module contribution is installed even from a module with `buildModule({ exportedServiceKeys: [] })` and may
use private helpers. `serviceSnapshot(token)` returns ordered frozen inspection
snapshots without acquiring the items. To share a computed collection with a
child, share an ordinary aggregate provider such as `pipeline`; direct child
collection reads follow the child's graph and lifetime routing.

## Project services explicitly

Use `DiBag.providerWithTransformedService` with
`callbackReceives: 'exposed-service'` to pass the exact source value to the
transformation. Use `callbackReceives: 'fulfilled-value'` to await the source and
adopt the result into a native Promise.

**Conceptual example:** `openConnection` and `makeClient` are application
functions, and both returned objects provide the shown `close` method.

```ts
const connection = DiBag.providerWithDisposal({
  provider: openConnection,
  disposeService: value => value.close(),
});
const client = DiBag.providerWithDisposal({
  provider: DiBag.providerWithTransformedService({
    provider: connection,
    callbackReceives: 'fulfilled-value',
    transformService: value => makeClient(value),
  }),
  disposeService: value => value.close(),
});

const app = DiBag.createBuilder().withServices({ client }).buildContainer();
const readyClient = await app.resolve('client');
await app.close(); // client, then its source connection
```

`DiBag.providerWithTransformedService({ provider, callbackReceives: 'exposed-service', transformService, transformReturnKind })`
passes the source exactly as exposed.
If that value is a Promise, the projector receives the Promise with its identity
unchanged. The projector's exact return value is exposed and its output stage may
select `auto-detect`, `sync-value`, `uninspected`, or `native-promise` as its
`transformReturnKind`.

`DiBag.providerWithTransformedService({ provider, callbackReceives: 'fulfilled-value', transformService })`
awaits the source and projector result, always
exposing a native `Promise<Awaited<Result>>`. Both helpers call the source once
per attempt and retain dependencies and registration metadata. Mapping alone adds no
ownership. Projectors run without a receiver.

If projection fails, the caller receives the original error. Accepted ownership
stages from that attempt are released; separately cached dependencies stay owned
by their containers. Shutdown waits for pending sources and projections before releasing
values they might still use. Nonsettling work can therefore keep `close()` pending.

## Attach metadata and inspect without resolving

A provider's registration metadata describes it without acquiring it. Inspection combines
that description with a copied view of current acquisition attempts.

**Standalone example:**

```ts
import { DiBag } from 'di-bag';

const service = DiBag.providerWithRegistrationMetadata({ provider: ({ clock }: { clock: { now(): number } }) => ({ read: () => clock.now() }), registrationMetadata: { 'app:owner': { team: 'platform' } } });
const feature = DiBag.createBuilder()
  .withServices({ service })
  .buildModule({ exportedServiceKeys: ['service'] });
const app = DiBag.createBuilder()
  .withInstalledModules([feature.withRenamedExport({ currentExportKey: 'service', newExportKey: 'client' })])
  .withServices({ clock: () => ({ now: () => 42 }) })
  .buildContainer();

const before = app.serviceSnapshot('client'); // no factory runs
before.registrationMetadata['app:owner'].team; // platform
before.acquisitions; // []
app.resolve('client').read(); // 42
app.serviceSnapshot('client').acquisitions[0]?.state; // ready
await app.close();
app.serviceSnapshot('client').acquisitions; // []
```

`DiBag.providerWithRegistrationMetadata({ provider, registrationMetadata })` preserves the provider's output,
dependencies, factory return kind, and ownership. It copies and freezes all own
string and symbol entries, including non-enumerable keys; payload objects keep
their identity. Repeated metadata wrappers may add keys but cannot collide.

Use `DiBag.providerWithAcquisitionMetadata({ provider, callbackReceives: 'exposed-service', describeAcquisition })`
when the metadata is known only after a value is produced.
`describeAcquisition` synchronously receives the exact
source output, including an uninspected or native Promise itself, and its record becomes
the next typed acquisition frame. The provider still exposes the exact source
value with the same factory return kind. Use
`DiBag.providerWithAcquisitionMetadata({ provider, callbackReceives: 'fulfilled-value', describeAcquisition })` to await the source,
describe its fulfilled value, and expose a native
`Promise<Awaited<SourceOutput>>`. Both callbacks must synchronously return a
plain object record with the current realm's `Object.prototype` or `null` as its
prototype. Arrays, functions, class instances, dates, Promises, and thenable
records are rejected.

`serviceSnapshot(nameOrToken)` returns a frozen snapshot with `bindingId`, `bindingLabel`,
`registrationMetadata`, and `acquisitions`. Each acquisition has `acquisitionId`, `state`, and
an ordered `acquisitionMetadata` tuple of presence records. It contains no service values
or live mutable runtime collections. A snapshot does not update after it is
returned. Failed attempts are evicted rather than retained as history. After
close, registration metadata remains available and acquisition lists are empty.

`serviceSnapshot(collectionToken)` does the same for each contribution in declaration order.
Aliases expose their direct target description and canonical acquisition state.
Metadata wrappers add frames as described under
[acquisition values and metadata](#represent-acquisition-values-and-metadata-natively).

`graphSnapshot()` describes the whole container at once: every binding with its public
keys, label, lifetime, factory return kind, ownership, typed-token dependencies,
registration metadata, and current attempts; every contribution group; and the
consumer-to-dependency edges observed during acquisition so far. Private
bindings from installed modules appear with an empty key list. Nothing is
acquired, and the snapshot is frozen. Named dependencies read from a factory's
object parameter are unknown until that factory runs, so the edge list grows as
services are acquired; the static graph tool reports declared edges from source.

```ts
const graph = app.graphSnapshot();
graph.bindings.map(binding => [binding.serviceKeys, binding.lifetime]);
graph.observedEdges; // [] before any resolve
```

## Observe lifecycle transitions

Observers send telemetry without joining the service or disposal control flow.

**Standalone example:**

```ts
import { DiBag } from 'di-bag';

const observed = DiBag.withConfiguration({
  lifecycleObservers: [
    {
      onLifecycleEvent(event) {
        console.log(event.kind, event.containerId);
      },
      onObserverFailure({ event, error }) {
        console.error('Telemetry failed', event.kind, error);
      },
    },
  ],
});

const app = observed
  .createBuilder()
  .withServices({ answer: () => 42 })
  .buildContainer();
app.resolve('answer');
await app.close();
```

Both callbacks are required for every observer. `withConfiguration({ lifecycleObservers })`
returns a new `DiBagApi` and appends that array in order after inherited observers.
An omitted `runtime` preserves the current native-Promise classifier. Existing facades, builders, and
containers keep the configuration with which they were created.

Events cover container opening/closing, acquisition start/readiness/failure, and
disposal start/failure/completion. They carry stable container and attempt identities,
canonical binding information, lifetime, `registrationMetadata`, and copied
`acquisitionMetadata` where applicable. Shared attempts report their actual owner. An uninspected Promise
is ready as a value; a native stage reports readiness after settlement.

Callbacks run in emission and registration order on a microtask queue, outside
synchronous factory execution. Callback throws or rejections go to that
observer's `onObserverFailure`; errors in `onObserverFailure` are consumed. Observer work never gates
resolution, readiness, or close. If delivery completion matters, the application
must maintain and await its own barrier. A synchronous burst queues events until
the microtask drain; pending callback results do not slow the producer or prevent
later callbacks from starting. An indefinitely slower consumer therefore has no
finite lossless memory bound. Keep callbacks small and control production or
explicitly batch work in the application. Externally pending callback work and
its associated failure-reporting state remain live until that work settles. [`examples/observers.ts`](../../examples/observers.ts)
shows that pattern.

## Admit an application-selected plugin

`createProviderFromPlugin` creates a checked boundary for an unknown descriptor selected by
application code. DI Bag does not load a path or choose an export.

**Standalone example:**

```ts
import { DiBag } from 'di-bag';

interface Handler {
  handle(text: string): string;
}
const handlerKey = Symbol('handler');
const handler = DiBag.createToken(handlerKey).forService<Handler>();

const selected: unknown = {
  apiVersion: 1,
  create: () => ({ handle: (text: string) => text.toUpperCase() }),
};

const provider = DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor: selected, factoryReturnKind: 'uninspected', isValidPluginOutput: (value: unknown): value is Handler =>
    typeof value === 'object' &&
    value !== null &&
    'handle' in value &&
    typeof value.handle === 'function' });

const feature = DiBag.createBuilder()
  .withTokenService(handler, provider)
  .buildModule({ exportedServiceKeys: [handler] });
const app = DiBag.createBuilder().withInstalledModules([feature]).buildContainer();
console.log(app.resolve(handler).handle('hello')); // HELLO
await app.close();
```

A descriptor requires own `apiVersion: 1` and callable `create` properties; an
own `dispose` is optional and must be callable.
`DiBag.createProviderFromPlugin({ dependencies, pluginDescriptor, isValidPluginOutput, factoryReturnKind })`
requires both a validator and `factoryReturnKind: 'uninspected' | 'native-promise'`.
Dependencies may be service tokens, collection tokens, or optional/lazy references and arrive in
tuple order. The tuple, callbacks, and descriptor fields are captured immediately.

The `uninspected` return kind validates the exact returned value synchronously.
The `native-promise` return kind requires
a genuine native source Promise and exposes one stable Promise whose fulfilled
value is validated. The predicate must synchronously return exactly `true`.
Descriptor failures use `DiBagPluginValidationError` phase `'descriptor'`; invalid output
uses phase `'output'`.

When a descriptor has a disposer, the source value becomes owned before output
validation. A failed validator therefore still releases the original acquired
value during rollback or close. Validation checks this boundary once; it does not
sandbox plugin code or continuously validate a mutable service.

## Portable mode

On Node, Bun, and Deno, `di-bag` classifies native Promises with the host's
`util.types.isPromise`, loaded through `process.getBuiltinModule` at the first
`buildContainer()` that needs it. There is one package entry point: `di-bag`.
Browsers, workers, and other hosts have no `process.getBuiltinModule`, so there
`buildContainer()` throws `DI_BAG_CLASSIFIER_REQUIRED`, naming each provider that
still uses automatic acquisition.

The portable style says on each provider whether its factory is synchronous
or asynchronous, so no classifier is needed anywhere:

**Standalone example:**

```ts
import { DiBag } from 'di-bag';

type Config = { readonly url: string };
type Catalog = { names(): Promise<string[]>; close(): Promise<void> };

const app = DiBag.createBuilder()
  .withServices({
    config: DiBag.createProvider((): Config => ({ url: 'memory:' }), { factoryReturnKind: 'sync-value' }),
    catalog: DiBag.providerWithDisposal({ provider: DiBag.createProvider(async ({ config }: { config: Config }): Promise<Catalog> => ({
        names: async () => [config.url],
        close: async () => {},
      }), { factoryReturnKind: 'native-promise' }), disposeService: catalog => catalog.close() }),
    handler: DiBag.createProvider(({ catalog }: { catalog: Promise<Catalog> }) => ({
      list: async () => (await catalog).names(),
    }), { factoryReturnKind: 'sync-value' }),
  })
  .buildContainer();

console.log(await app.resolve('handler').list()); // ['memory:']
await app.close();
```

`DiBag.createProvider(factory, { factoryReturnKind: 'sync-value' })` exposes the
exact synchronous return value without inspecting `then`. The compiler rejects
an async function, a Promise-returning function, a union with a Promise member,
or a structural thenable such as a query builder.
`DiBag.createProvider(factory, { factoryReturnKind: 'native-promise' })` exposes
the returned Promise. Consumers declare and await it, and `providerWithDisposal`
receives its fulfilled value. The compiler rejects a non-Promise output, a union,
or a `PromiseLike`. Both forms accept `factoryReceivesContext: true` when the
factory needs its context. Choosing a return kind adds no ownership.

Native Promise observation uses the engine's own check,
`Promise.prototype.then` called on the value, so a Promise from another realm or
a `Promise` subclass is observed like any native Promise, and an own `then`
override on the instance is never called. A value that is not a native Promise,
reachable only through a cast because the type is rejected, fails that
acquisition with the engine's `TypeError` and never has its `then` called. A
Promise object that is itself the service, or a thenable that is the service,
keeps `DiBag.createProvider(create, { factoryReturnKind: 'uninspected' })`.

Everything reachable must be explicit: private module services, replacements in
`createIndependentContainer` and `createChildContainer`, and positional adapters.
`createProviderFromFunction` and `createProviderFromClass` take `factoryReturnKind`.
`providerWithTransformedService` with `callbackReceives: 'exposed-service'` takes
`transformReturnKind`. Graph completion
checks the whole graph before any factory runs and lists what is still
automatic. The other portable strategy is a trusted application-local
classifier:

**Conceptual snippet:** `trustedHostPredicate` is supplied by the application.

```ts
import { DiBag as CoreDiBag } from 'di-bag';

declare const trustedHostPredicate: (value: unknown) => boolean;

const DiBag = CoreDiBag.withConfiguration({
  runtime: {
    isNativePromise: trustedHostPredicate,
  },
});
```

It must identify native Promises without using a structural thenable test or a
plain `instanceof` test. `withConfiguration()` returns a new facade; it does not mutate
global state. Its context follows builders, containers, child containers, and independent containers.

The stage rules are precise:

- `uninspected` exposes the exact return value without reading `then`.
- `native-promise` requires a Promise-shaped TypeScript output, observes native
  fulfillment, and still exposes the exact source Promise.
- `sync-value` exposes the exact synchronous value and checks at compile time
  that it is neither a Promise nor a thenable.
- `auto-detect` asks the configured predicate, or the host's `util.types.isPromise`
  when none is configured and the host exposes `process.getBuiltinModule`.
- `createProvider`, `createProviderFromFunction`, and `createProviderFromClass` select their result stage's
  `factoryReturnKind`; omission defaults to `auto-detect`.
- `providerWithTransformedService` with `callbackReceives: 'exposed-service'`
  selects `transformReturnKind`, defaulting to `auto-detect`. Choose `uninspected`
  to expose a returned Promise itself and attach disposal to own it.
- `providerWithTransformedService` and `providerWithAcquisitionMetadata` with
  `callbackReceives: 'fulfilled-value'` introduce a native Promise stage.
  They expose a Promise even for a synchronous source.
- `providerWithDisposal`, `providerWithLifetime`, registration metadata, acquisition
  metadata with `callbackReceives: 'exposed-service'`, token binding, aliases, and
  module installation retain the source factory return kind.

Automatic or native observation tracks fulfillment for ownership and readiness
without replacing the exposed Promise. An uninspected Promise is an immediate value. See
the [server guide's Deno section](server-integration.md#deno-and-portable-acquisition)
for a full portable-host composition.

## Represent acquisition values and metadata natively

Use ordinary factory return values to carry a payload and facts learned while
producing it. Then use `providerWithTransformedService` to project the part consumers need.
`Presence<T>` preserves the difference between an absent value and a present
value whose payload is `undefined`.

**Standalone example:**

```ts
import { DiBag, type Presence } from 'di-bag';

type Located<T> = {
  readonly value: Presence<T>;
  readonly origin: string;
};

const located = DiBag.providerWithAcquisitionMetadata({ provider: (): Located<number | undefined> => ({
    value: { isPresent: true, value: undefined },
    origin: 'environment',
  }), describeAcquisition: (result) => ({ origin: result.origin }), callbackReceives: 'exposed-service' });
const value = DiBag.providerWithTransformedService({ provider: located, transformService: (result) => result.value, callbackReceives: 'exposed-service' });

const app = DiBag.createBuilder().withServices({ value }).buildContainer();
const acquired = app.resolve('value');
console.log(acquired.isPresent); // true
console.log(acquired.isPresent && acquired.value); // undefined
console.log(app.serviceSnapshot('value').acquisitions[0]?.acquisitionMetadata[0]);
await app.close();
```

With `callbackReceives: 'exposed-service'`, the synchronous `describeAcquisition` callback receives the
exact source output and preserves that output's identity and factory return kind.
This matters when an uninspected stage intentionally exposes a Promise as an ordinary
value: the callback and consumer see the same Promise object.

With `callbackReceives: 'fulfilled-value'`, the wrapper awaits the source before
calling `describeAcquisition`. It always exposes a native Promise of the source's
awaited value:

```ts
const located = DiBag.providerWithAcquisitionMetadata({
  provider: async () => ({ value: 42, origin: 'remote-config' }),
  callbackReceives: 'fulfilled-value',
  describeAcquisition: result => ({ origin: result.origin }),
});
const value = DiBag.providerWithTransformedService({
  provider: located,
  callbackReceives: 'fulfilled-value',
  transformService: result => result.value,
});
```

Each metadata wrapper reserves an absent frame before its source runs. The
`exposed-service` mode fills that frame as soon as the source returns and `describeAcquisition`
succeeds, even when the source output is a still-pending Promise. The `fulfilled-value`
mode leaves its frame absent until the source fulfills and `describeAcquisition` succeeds.
Frames from repeated wrappers remain in declaration order. Inspection itself
never starts an acquisition.

Each captured metadata frame is a shallow, frozen copy of the returned record.
Nested objects and service payloads keep their identities and are not
deep-frozen. Invalid records, asynchronous metadata callbacks, and callback
errors fail the acquisition through the wrapper's selected mode.

Metadata wrappers and projections add no ownership. Existing ownership from
`providerWithDisposal` is retained through them; add a new `providerWithDisposal` only when the
container should own the projected value too. Ordinary factories remain borrowed even
when their values have `close()` or `dispose()` methods. Run
[`examples/provider-metadata.ts`](../../examples/provider-metadata.ts) for sync
and async acquisition metadata, present `undefined`, projection, and disposal.

## Exported TypeScript types

Prefer inference for builders, containers, providers, and modules. When a value crosses
a source-file boundary, `typeof` and `ReturnType` preserve private module
constraints, token contracts, lifetime rules, ownership stages, and inspection
metadata better than a shorter annotation.

**Standalone type-extraction example:**

```ts
import { DiBag, type ProviderOutput, type TokenService } from 'di-bag';

const clockSymbol = Symbol('clock');
const clock = DiBag.createToken(clockSymbol).forService<{ now(): number }>();
const stamp = DiBag.createProviderFromFunction({
  dependencies: [clock],
  factoryFunction: clock => clock.now(),
});
const app = DiBag.createBuilder()
  .withTokenService(clock, () => ({ now: () => 42 }))
  .withServices({ stamp })
  .buildContainer();

type Clock = TokenService<typeof clock>;
type Stamp = ProviderOutput<typeof stamp>;
type Application = typeof app;
await app.close();
```

The package exports types for each boundary:

- `Container`, `Builder`, `DiBagApi`, and `Module` describe composition handles.
- `Token`, `CollectionToken`, `TokenKey`, `TokenService`, and `CollectionItem`
  describe token contracts.
- `Provider`, `ProviderOrFactory`, `ProviderOutput`, `ProviderNamedDependencies`,
  `ProviderRegistrationMetadata`, `ProviderAcquisitionMetadata`, and
  `ProviderAcquiredValue` describe providers.
- `FactoryReturnKind`, `Lifetime`, `FactoryContext`, `DisposerContext`,
  `EnsureServicesReadyOptions`, `CloseOptions`, `CreateChildContainerOptions`, and
  `CreateIndependentContainerOptions` describe runtime choices.
- `ModuleExportedServices`, `ModuleRequiredServices`, `CompositionReport`,
  `RegistrationSnapshot`, `GraphSnapshot`, `LifecycleEvent`, and `LifecycleObserver`
  describe contracts and inspection.

The [API reference](api-reference.md#exported-typescript-types) catalogs all public
types exported by `src/index.ts`.

## Boundaries

DI Bag checks the declared graph and manages explicitly described ownership. Its
runtime checks do not restore guarantees erased by casts, unchecked JavaScript,
or an inaccurate plugin validator. It does not add framework-specific request
hooks, transaction rollback, dynamic module loading, decorators, or reflection
metadata. Connect those application lifecycles explicitly; the
[server integration guide](server-integration.md) provides concrete Node HTTP,
Express, Fastify, Bun, Deno, background-job, and shutdown patterns.
