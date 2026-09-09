# Learn DI Bag

[Install DI Bag](../../README.md#install) · [API reference](api-reference.md) ·
[Server integration](server-integration.md) · [Runnable examples](../../examples)

DI Bag connects ordinary TypeScript factories, checks their dependency shapes,
creates services when they are first requested, and releases the resources that
an application explicitly gives it. This guide starts with a small application
and then introduces the APIs in the order in which most applications need them.

Examples use `DiBag` from `di-bag/node`, the Node and Bun entry point. Unless a
note says that a snippet continues an earlier example, each snippet stands alone.
Run repository examples from the repository root with `bun run examples/<name>.ts`.

## Learning path

1. [Compose and resolve services](#compose-services).
2. Learn how [async work](#async-edges-are-explicit), [ownership](#attach-cleanup-with-withdisposal), and [failures](#errors-and-recovery) behave.
3. Choose between [tracked child scopes](#create-tracked-child-scopes), [independent forks](#fork-for-scopes-and-tests), and [lifetimes](#choose-root-scoped-or-transient-caching).
4. Package a feature as a [module](#reuse-named-modules).
5. Use [typed tokens and positional adapters](#use-typed-tokens-for-explicit-positional-injection) when names and object parameters do not fit.
6. Add [optional or lazy dependencies](#declare-optional-and-lazy-dependencies), [aliases](#give-a-dependency-another-lookup-name), and [ordered collections](#compose-an-ordered-collection).
7. Introduce [projections](#project-services-explicitly), [metadata and inspection](#attach-metadata-and-inspect-without-resolving), [observers](#observe-lifecycle-transitions), or [plugin validation](#admit-an-application-selected-plugin) at explicit boundaries.
8. Read the [portable runtime](#portable-mode) and [native provider metadata](#represent-acquisition-values-and-metadata-natively) rules when those environments apply.

The [API reference](api-reference.md) is the compact source for exact signatures,
error fields, and exported TypeScript types. This guide concentrates on when to
use each operation and what it means for the graph.

## Compose services

Start with `DiBag.begin()`, add named factories, and finish the graph with
`.end()`. A factory's object parameter declares its dependencies.

**Standalone example:**

```ts
import { DiBag } from 'di-bag/node';

const app = DiBag.begin()
  .add({
    config: () => ({ greeting: 'Hello' }),
    greeter: ({ config }: { config: { greeting: string } }) => ({
      greet(name: string) {
        return `${config.greeting}, ${name}!`;
      },
    }),
  })
  .end();

console.log(app.resolve('greeter').greet('Ada')); // Hello, Ada!
await app.close();
```

`begin()` returns an immutable `Builder`. `add()` returns another builder with
new named registrations, and `end()` checks the complete graph and returns a
`Bag`. Keep the returned builder or chain the call. Registration order does not
matter, so a dependency may be added after its consumer. Duplicate names fail;
use `replace()` when changing an existing registration is intentional.

**Continuation of the preceding composition example:**

```ts
const initial = DiBag.begin().add({ clock: () => 42 });
const changed = initial.replace('clock', () => 'ready').end();

changed.resolve('clock'); // inferred as string
```

`replace(nameOrToken, registration)` checks the replacement against known
consumers and, for a token, against its service contract. It may change a named
service's type only while every surviving consumer remains valid. Missing forward
dependencies remain allowed until `end()`.

Factories are called without a `this` receiver. `resolve(nameOrToken)` lazily
creates the selected service and its dependencies. Scoped services are cached,
including `undefined` and an in-flight Promise, so repeated resolutions in one
bag return the same value. A factory is still borrowed by default even if its
result has a method called `close` or `dispose`.

`DiBag.factory(create, { acquisition })` describes the output stage explicitly.
It is useful for deliberate raw Promise-like values and is required by one of the
portable-runtime strategies described under [portable mode](#portable-mode). It
does not run the factory or transfer cleanup ownership.

## Async edges are explicit

An async factory exposes its Promise. A consumer declares that Promise in its
dependency type and decides where to await it.

**Standalone example:**

```ts
import { DiBag } from 'di-bag/node';

const app = DiBag.begin()
  .add({
    number: async () => 21,
    answer: async ({ number }: { number: Promise<number> }) =>
      (await number) * 2,
    synchronous: () => 'ready',
  })
  .end();

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
Failed attempts keep the work and accepted ownership stages needed for cleanup;
they do not redirect their dependency edges to a later retry.

### Start selected services and cancel cooperatively

Use `builder.start(keys, options?)` when selected services must be ready before
the application accepts work. It creates a fresh bag, eagerly acquires only the
selection and dependencies, and leaves everything else lazy.

**Standalone example:**

```ts
import { DiBag, DiBagStartupCancelledError } from 'di-bag/node';

const builder = DiBag.begin().add({
  url: () => 'https://example.com/settings.json',
  settings: DiBag.withContext(
    async ({ url }: { url: string }, { signal }) => {
      const response = await fetch(url, { signal });
      return response.text();
    },
  ),
});

try {
  const app = await builder.start(['settings'], {
    timeoutMs: 5_000,
    concurrency: 'parallel',
  });
  try {
    console.log(await app.resolve('settings'));
  } finally {
    await app.close();
  }
} catch (error) {
  if (error instanceof DiBagStartupCancelledError) {
    await error.cleanup;
  }
  throw error;
}
```

The selection may contain existing names and typed tokens. Parallel startup is
the default; `concurrency: 'sequential'` waits in tuple order and does not start
later selections after a failure. An empty selection is valid. Options also
accept a genuine external `AbortSignal` and a finite positive `timeoutMs`.
Invalid options and an already-aborted signal start no factories. Once startup
succeeds, the timer and external listener are removed; a later abort of that
external signal does not close the bag.

`DiBag.withContext(factory, options?)` passes a frozen acquisition context as the
factory's second argument. Its `signal` belongs to the bag that owns the attempt.
Root services use the family root signal even when a child first asks for them.
Closing a scope aborts its signal before draining pending work. Cancellation is
cooperative: JavaScript that ignores the signal can keep cleanup pending.

Startup waits according to the selected service's final acquisition mode. A raw
Promise or thenable is already a ready value; a native Promise waits for
settlement without changing its identity. On acquisition failure, startup closes
the new bag and rejects with `DiBagStartupError`. Abort or timeout rejects promptly
with `DiBagStartupCancelledError`; its `cleanup` Promise lets the application wait
for eventual shutdown, including resources acquired after cancellation.

## Attach cleanup with `withDisposal`

Use `DiBag.withDisposal(registration, dispose)` when the bag should own the value
successfully acquired by a registration.

**Standalone example:**

```ts
import { DiBag } from 'di-bag/node';

const app = DiBag.begin()
  .add({
    cache: DiBag.withDisposal(
      () => new Map<string, string>(),
      cache => cache.clear(),
    ),
  })
  .end();

try {
  app.resolve('cache').set('answer', '42');
} finally {
  await app.close();
}
```

The wrapper describes ownership; neither callback runs when it is constructed.
For a native async factory, the disposer receives the fulfilled value. Cleanup
may be synchronous or asynchronous. Ordinary factories remain borrowed, and
method names never imply ownership. A never-resolved provider owns nothing.

Ownership is additive. If a provider is projected and wrapped again, each
accepted stage retains its original value and disposer. Cleanup runs dependents
before their dependencies; unrelated resources run in reverse successful
acquisition order. Explicitly owning the same object twice runs both finalizers.

`bag.close()` immediately blocks new public resolutions, scopes, and forks. It
aborts the scope signal, waits for pending acquisitions and retired cleanup, and
then runs disposers sequentially. Repeated calls return the same Promise and
cleanup runs once. A parent closes live child scopes before releasing its own
resources. Stop application work before closing: already-returned services cannot
be revoked, and a disposer must not await the same bag's `close()` Promise.

An automatic synchronous stage accepts ordinary values and observes native
Promises. A structural thenable returned directly is rejected without invoking
its `then` or transferring ownership. Normalize such a value explicitly inside
an async boundary, for example `() => Promise.resolve(legacyThenable)`. Use a raw
stage when the Promise object itself is the owned value.

**Conceptual snippet:** `pendingPromise`, `releasePromiseHandle`, and the fulfilled
resource's `close` method are application values.

```ts
const rawOwned = DiBag.withDisposal(
  DiBag.factory(() => pendingPromise, { acquisition: 'raw' }),
  promise => releasePromiseHandle(promise),
);

const fulfilledOwned = DiBag.withDisposal(
  DiBag.factory(() => pendingPromise, { acquisition: 'native' }),
  resource => resource.close(),
);
```

Raw ownership does not wait for the Promise; native ownership transfers only
after fulfillment. A factory
must release anything it acquires before it successfully returns an owned value.

## Errors and recovery

Factory and projection failures keep their original identity. The four DI Bag
error classes cover cleanup, startup, and plugin boundaries; invalid API inputs
may still throw ordinary `Error` or `TypeError`.

| Error | Recovery information |
| --- | --- |
| `DiBagCleanupError` | `close()` attempted all finalizers. `errors` holds their original errors, while `failures` adds `acquisitionId`, `bindingId`, `label`, and `error`. |
| `DiBagStartupError` | Startup acquisition failed and rollback finished. Read `cause`, `cleanupFailures`, and optional `cleanupError`. |
| `DiBagStartupCancelledError` | Startup was aborted or timed out. Read `reason`, `cause`, and await `cleanup` if shutdown completion matters. |
| `DiBagPluginError` | A plugin descriptor or output failed validation. `phase` is `'descriptor'` or `'output'`, and `reason` explains the rejection. |

**Continuation of the cache ownership example:**

```ts
import { DiBagCleanupError } from 'di-bag/node';

try {
  await app.close();
} catch (error) {
  if (error instanceof DiBagCleanupError) {
    for (const failure of error.failures) {
      console.error(failure.label, failure.error);
    }
  }
  throw error;
}
```

When one disposer fails, remaining disposers still run. The bag remains closed,
and another `close()` observes the
same rejected Promise. Acquisition failures remain on their resolution Promises;
they are not added to a later close error. See the [API reference](api-reference.md#errors-and-recovery)
for exact class shapes and constructors.

## Create tracked child scopes

A scope represents work owned by a parent, such as one request or job. The
zero-argument form creates fresh scoped acquisitions while automatically using
family-root services according to their lifetime.

**Standalone example:**

```ts
import { DiBag } from 'di-bag/node';

const root = DiBag.begin().add({
  requestId: () => crypto.randomUUID(),
}).end();

const child = root.scope();
root.resolve('requestId');
child.resolve('requestId'); // a different value, cached by child

await root.close(); // closes the live child first
```

There are three `scope` forms:

- `scope()` creates a tracked child with the same graph.
- `scope({ share: keys })` also borrows selected parent acquisitions.
- `scope(keys, overrides, { share: otherKeys }?)` replaces selected bindings in
  the child and may borrow a disjoint selection from the parent.

**Standalone example:**

```ts
import { DiBag } from 'di-bag/node';

const parent = DiBag.begin().add({
  config: () => ({ region: 'eu' }),
  client: ({ config }: { config: { region: string } }) =>
    ({ region: config.region }),
}).end();

const child = parent.scope(['config'], {
  config: () => ({ region: 'us' }),
}, { share: ['client'] });

child.resolve('config').region; // us
child.resolve('client') === parent.resolve('client'); // true; client keeps eu
const grandchild = child.scope({ share: ['client'] });
await parent.close();
```

Both selections accept existing names and genuine typed tokens. Overrides must
preserve the original service contracts. Only
selected override properties are read; extra properties cannot alter the graph.
A key cannot be selected for both override and sharing.

Sharing borrows the parent's entire acquisition: value, pending Promise,
dependencies, metadata, cancellation context, and cleanup ownership. Child
shutdown cannot abort or dispose it. Scoped sharing must be selected again in
each descendant. Transient services cannot be shared because there is no parent
cache to borrow. Root services are inherited automatically.

An inherited root service keeps the graph and dependencies of the scope that
defined it, even when a child overrides one of those dependencies. A root override
introduced by a child is instead anchored to that child's graph and may be reused
by its descendants.

Closing a child independently leaves parent and siblings open. Closing a parent
begins closing its live descendants and waits for them before parent finalizers.
An independently closed child detaches only after its close settles, so the caller
owns any failure from that close.

## Fork for scopes and tests

Use a fork when the new bag must have independent ownership, memoization, and
shutdown. `fork()` keeps the graph and creates all instances afresh.
`fork(keys, overrides)` also replaces an explicit selection.

**Standalone example:**

```ts
import { DiBag } from 'di-bag/node';

const app = DiBag.begin().add({
  clock: () => ({ now: () => 42 }),
  stamp: ({ clock }: { clock: { now(): number } }) => clock.now(),
}).end();

const testApp = app.fork(['clock'], {
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

Forks are never tracked by their source, including forks created from child
scopes. Close each one separately. A fork may replace an owned provider with an
ordinary factory to borrow an external value, or add disposal to an ordinary
provider. Do not register the same shared value as owned in several bags unless
multiple disposal calls are intentional.

### WBS-shaped ownership example

[`examples/wbs-scope.ts`](../../examples/wbs-scope.ts) shows an application-owned
source, a root bag, and independently closed batch forks. The following is a
conceptual excerpt; `scope`, `openCollector`, and the root services are application
values defined in that example:

```ts
const batch = root.fork(
  ['source', 'clock', 'replayBuffer', 'stores', 'broadcast'],
  {
    source: () => root.resolve('source'),
    clock: () => root.resolve('clock'),
    replayBuffer: () => root.resolve('replayBuffer'),
    stores: () => scope.stores,
    broadcast: DiBag.withDisposal(
      openCollector,
      collector => collector.close(),
    ),
  },
);
```

Borrowed values use ordinary factories; the batch owns only its collector. The
application closes batches first, then the root, then the source it created.
Transaction rollback is application behavior rather than a DI Bag feature.

For request scopes, shutdown signals, Node HTTP, Express, Fastify, Bun, Deno,
streaming, WebSockets, jobs, and message consumers, continue with the
[server integration guide](server-integration.md).

## Choose root, scoped or transient caching

Providers are `scoped` by default: one acquisition per bag. Wrap a registration
with `DiBag.withLifetime` to choose a family-root cache or a new acquisition for
every read.

**Standalone example:**

```ts
import { DiBag } from 'di-bag/node';

const root = DiBag.begin().add({
  config: DiBag.withLifetime(() => ({ region: 'eu' }), 'root'),
  request: () => ({ id: crypto.randomUUID() }),
  nonce: DiBag.withLifetime(() => ({ value: Math.random() }), 'transient'),
}).end();

const child = root.scope();
child.resolve('config') === root.resolve('config'); // true
child.resolve('request') === child.resolve('request'); // true
child.resolve('nonce') === child.resolve('nonce'); // false
await root.close();
```

Lifetime controls caching and attempt ownership; it does not add cleanup. Root
attempts belong to the earliest scope that defines the binding, even if a
descendant resolves them first. A root override introduced in a child belongs to
that child. Scoped and transient attempts belong to the resolving scope or to the
owner of the acquisition that requests them. A fork starts a new root family.

A root provider cannot depend on a scoped provider by default because that would
capture one scope's value. Use `{ captureScoped: true }` only for a deliberate
root-context capture:

**Standalone example:**

```ts
import { DiBag } from 'di-bag/node';

const app = DiBag.begin().add({
  rootContext: () => ({ region: 'eu' }),
  client: DiBag.withLifetime(
    ({ rootContext }: { rootContext: { region: string } }) =>
      ({ region: rootContext.region }),
    'root',
    { captureScoped: true },
  ),
}).end();
```

Capture always builds through the root context; it does not borrow a child-owned
value. Capture options are valid only for an
individually known `'root'` lifetime. An outer lifetime wrapper replaces an
earlier caching policy. Graph completion and selected scope/fork replacements
recheck captive dependencies.

## Reuse named modules

Modules group a feature's private services and publish only the entry points an
application needs. `DiBag.module()` returns an immutable `ModuleBuilder`.

**Standalone example:**

```ts
import { DiBag } from 'di-bag/node';

const reports = DiBag.module()
  .add({
    connection: () => ({ open: true }),
    service: ({ connection, logger }: {
      connection: { open: boolean };
      logger: { log(message: string): void };
    }) => ({
      read() {
        logger.log('read');
        return connection.open;
      },
    }),
  })
  .exports(['service']);

const app = DiBag.begin()
  .install(reports)
  .add({ logger: () => ({ log: console.log }) })
  .end();

app.resolve('service').read();
await app.close();
```

`ModuleBuilder.add`, `bind`, `replace`, `alias`, and `contribute` have the same
roles as their application-builder counterparts. `exports(keys)` seals the
module and chooses its public string names and typed tokens. An empty export
tuple is valid; contributions are still installed. A module builder cannot
install, resolve, start, or close anything. The application builder's
`install(module)` gives module acquisitions an owning bag.

Private providers keep their external requirements, including requirements from
providers that are not currently reachable from an export. The host may satisfy
them later with `add`, another installation, or a forward registration before
`end()`. Each installation gets fresh private binding identities and ownership.

`module.rename(oldName, newName)` returns a new export view. It changes a public
string lookup name without changing the name used inside factory dependency
parameters. Typed-token exports retain their symbol identity and cannot be
renamed. Renaming every string export lets an application install the same module
twice under distinct public names.

**Continuation of the preceding module example:**

```ts
const eastReports = reports.rename('service', 'eastReports');
const westReports = reports.rename('service', 'westReports');

const regionalApp = DiBag.begin()
  .install(eastReports)
  .install(westReports)
  .add({ logger: () => ({ log: console.log }) })
  .end();
```

Host `replace` and selected bag overrides are visible to consumers inside the
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
import { DiBag } from 'di-bag/node';

const clockKey = Symbol('clock');
const clock = DiBag.token(clockKey).of<{ now(): number }>();

const stamp = DiBag.fromTokens([clock], selectedClock => selectedClock.now());

const app = DiBag.begin()
  .bind(clock, () => ({ now: () => 42 }))
  .add({ stamp })
  .end();

app.resolve(clock).now(); // 42
app.resolve('stamp'); // 42
clock.key === clockKey; // true
await app.close();
```

`token.key` is the original symbol and is useful as a computed property in
selected overrides. The token handle is the lookup identity; copied, proxied, or
fabricated shapes are rejected. Keep both the symbol and token canonical. Do not
pass a temporary inline `Symbol()` call to `token`; it cannot establish the stable
unique-symbol identity required by type admission.

`bind(token, registration)` adds a singular service and verifies that the
provider output satisfies the token's service type. The same token can identify
contributions as a separate channel, but one channel does not satisfy the other.

`DiBag.fromTokens(dependencies, callback, options?)` resolves a tuple of tokens
and dependency references and calls the callback with values in tuple order. The
tuple is captured when the provider is created, callbacks run without a receiver,
and no work happens before resolution. The optional acquisition option describes
the callback's output stage.

### Adapt classes and positional functions

Use `fromClass` and `fromFunction` for existing code whose constructor or
function already takes positional arguments.

**Standalone example:**

```ts
import { DiBag } from 'di-bag/node';

class Client {
  constructor(private readonly port: number) {}
  address() { return `localhost:${this.port}`; }
}

function endpoint(client: Client, path: string) {
  return `http://${client.address()}/${path}`;
}

const portKey = Symbol('port');
const clientKey = Symbol('client');
const pathKey = Symbol('path');
const port = DiBag.token(portKey).of<number>();
const client = DiBag.token(clientKey).of<Client>();
const path = DiBag.token(pathKey).of<string>();

const app = DiBag.begin()
  .bind(port, () => 8080)
  .bind(client, DiBag.fromClass([port], Client))
  .bind(path, () => 'health')
  .add({ endpoint: DiBag.fromFunction([client, path], endpoint) })
  .end();

console.log(app.resolve('endpoint')); // http://localhost:8080/health
await app.close();
```

`fromClass(dependencies, Constructor, options?)` calls `new Constructor(...args)`.
`fromFunction(dependencies, fn, options?)` calls the function without a receiver.
Their tuples accept tokens plus `optional`, `lazy`, and `all` references. Argument
and returned Promise identity are preserved. Bind a method first if it needs its
receiver, for example `settings.format.bind(settings)`.

The optional `{ acquisition: 'auto' | 'raw' | 'native' }` selects the adapter's
output stage. A class with a `close` method remains borrowed until explicitly
wrapped with `withDisposal`. [`examples/composition.ts`](../../examples/composition.ts)
combines tokens, classes, functions, references, and aliases.

## Declare optional and lazy dependencies

Dependency references work only inside the positional dependency tuples accepted
by `fromTokens`, `fromFunction`, `fromClass`, and `fromPlugin`.

**Standalone example:**

```ts
import { DiBag } from 'di-bag/node';

const portKey = Symbol('port');
const hostKey = Symbol('host');
const port = DiBag.token(portKey).of<number>();
const host = DiBag.token(hostKey).of<string>();

class Reporter {
  constructor(
    private readonly getPort: () => number,
    private readonly host: string | undefined,
  ) {}
  address() { return `${this.host ?? 'localhost'}:${this.getPort()}`; }
}

const reporter = DiBag.fromClass(
  [DiBag.lazy(port), DiBag.optional(host)],
  Reporter,
);
const app = DiBag.begin().bind(port, () => 8080).add({ reporter }).end();

app.resolve('reporter').address(); // localhost:8080
await app.close();
```

`optional(token)` supplies `Service | undefined` only when the binding is absent.
A bound service whose value is `undefined` is present, acquired, and owned in the
ordinary way. Failures from a present optional service still propagate. An
optional TypeScript function parameter alone does not make a graph dependency
optional.

`lazy(token)` supplies `() => Service` and acquires the target when called. The
target must exist when the graph is completed. Scoped and root targets keep their
cache; a transient target creates an attempt per call. The lookup records the
dependency edge at call time and retains the provider's graph, owner, cancellation
context, and shutdown rules. Calling it after that owner closes throws.

References preserve exact values and Promises and add no implicit awaiting or
ownership. Each wraps one genuine token. References cannot be nested or used as
binding identities.

## Give a dependency another lookup name

`alias(destination, target)` adds a lookup for the target's canonical service.
It is available on application and module builders.

**Standalone example:**

```ts
import { DiBag } from 'di-bag/node';

const clientKey = Symbol('client');
const client = DiBag.token(clientKey).of<{ port: number }>();

const app = DiBag.begin()
  .add({ service: () => ({ port: 8080 }) })
  .alias('primary', 'service')
  .alias(client, 'primary')
  .end();

app.resolve(client) === app.resolve('service'); // true
await app.close();
```

Both arguments can be a string name or typed token. The destination must be new.
A named target must already exist so TypeScript can infer its output. A token
target may be supplied later, and completion checks it. A token destination also
checks that it accepts the target output.

An alias creates no cache, attempt, or owner. It preserves the canonical target's
identity, Promise, lifetime, readiness, and acquisition mode. Replacing the target
changes aliases in that graph. Overriding the alias destination replaces only
that destination. A shared alias borrows the parent's target and context even if
the child overrides that target. Transient targets cannot be shared through an
alias, and root captive checks follow alias chains.

`inspect(alias).alias` reports its direct target, while acquisition snapshots
come from the canonical service. Use an ordinary provider when the new lookup
must transform a value or add separate ownership.

## Compose an ordered collection

Contributions let features append middleware, handlers, validators, or other
ordered services without competing for one singular binding.

**Standalone example:**

```ts
import { DiBag } from 'di-bag/node';

type Step = (text: string) => string;
const stepKey = Symbol('pipeline step');
const step = DiBag.token(stepKey).of<Step>();

const prefixFeature = DiBag.module()
  .add({ prefix: () => 'Hello, ' })
  .contribute(step, ({ prefix }: { prefix: string }): Step =>
    text => prefix + text)
  .exports([]);

const app = DiBag.begin()
  .contribute(step, (): Step => text => text.trim())
  .install(prefixFeature)
  .contribute(step, (): Step => text => `${text}!`)
  .add({
    pipeline: DiBag.fromFunction([DiBag.all(step)], operations =>
      (text: string) => operations.reduce(
        (value, operation) => operation(value),
        text,
      )),
  })
  .end();

app.resolve('pipeline')('  DI  '); // Hello, DI!
app.resolveAll(step); // readonly Step[]
await app.close();
```

`contribute(token, registration)` appends one checked provider. Host and module
installation order determine the result order. `resolveAll(token)` returns a new
frozen array on every read; acquired service objects retain their identity and
mutability. An empty collection is valid. Repeated providers or module installs
create distinct contribution bindings; there is no deduplication.

`all(token)` supplies the collection to a positional adapter and does not require
a singular binding. Singular `bind` and collection `contribute` remain separate
lookup channels. Each contribution keeps its own dependencies, lifetime,
acquisition mode, attempt, and cleanup ownership. Collection reads do not await
items or create an aggregate owner. A partial failure propagates the original
error while accepted items remain owned until normal shutdown; a retry can reuse
them.

A module contribution is installed even from a module with `exports([])` and may
use private helpers. `inspectAll(token)` returns ordered frozen inspection
snapshots without acquiring the items. To share a computed collection with a
child, share an ordinary aggregate provider such as `pipeline`; direct child
collection reads follow the child's graph and lifetime routing.

## Project services explicitly

Use `mapSync` when a projection must receive the exact source value immediately.
Use `mapAsync` when it must await the source and its projector result.

**Conceptual example:** `openConnection` and `makeClient` are application
functions, and both returned objects provide the shown `close` method.

```ts
const connection = DiBag.withDisposal(
  openConnection,
  value => value.close(),
);
const client = DiBag.withDisposal(
  DiBag.mapAsync(connection, value => makeClient(value)),
  value => value.close(),
);

const app = DiBag.begin().add({ client }).end();
const readyClient = await app.resolve('client');
await app.close(); // client, then its source connection
```

`mapSync(registration, project, options?)` passes the source exactly as exposed.
If that value is a Promise, the projector receives the Promise with its identity
unchanged. The projector's exact return value is exposed and its output stage may
select `auto`, `raw`, or `native` acquisition.

`mapAsync(registration, project)` awaits the source and projector result, always
exposing a native `Promise<Awaited<Result>>`. Both helpers call the source once
per attempt and retain dependencies and static metadata. Mapping alone adds no
ownership. Projectors run without a receiver.

If projection fails, the caller receives the original error. Accepted ownership
stages from that attempt are released; separately cached dependencies stay owned
by their bags. Shutdown waits for pending sources and projections before releasing
values they might still use. Nonsettling work can therefore keep `close()` pending.

## Attach metadata and inspect without resolving

Static metadata describes a provider without acquiring it. Inspection combines
that description with a copied view of current acquisition attempts.

**Standalone example:**

```ts
import { DiBag } from 'di-bag/node';

const service = DiBag.withMetadata(
  ({ clock }: { clock: { now(): number } }) =>
    ({ read: () => clock.now() }),
  { 'app:owner': { team: 'platform' } },
);
const feature = DiBag.module().add({ service }).exports(['service']);
const app = DiBag.begin()
  .install(feature.rename('service', 'client'))
  .add({ clock: () => ({ now: () => 42 }) })
  .end();

const before = app.inspect('client'); // no factory runs
before.metadata['app:owner'].team; // platform
before.acquisitions; // []
app.resolve('client').read(); // 42
app.inspect('client').acquisitions[0]?.state; // ready
await app.close();
app.inspect('client').acquisitions; // []
```

`withMetadata(registration, metadata)` preserves the provider's output,
dependencies, acquisition mode, and ownership. It copies and freezes all own
string and symbol entries, including non-enumerable keys; payload objects keep
their identity. Repeated metadata wrappers may add keys but cannot collide.

Use `withAcquisitionMetadata(registration, describe)` when the metadata is known
only after a value is produced. `describe` synchronously receives the exact
source output, including a raw or native Promise itself, and its record becomes
the next typed acquisition frame. The provider still exposes the exact source
value with the same acquisition mode. Use
`withAcquisitionMetadataAsync(registration, describe)` to await the source,
describe its fulfilled value, and expose a native
`Promise<Awaited<SourceOutput>>`. Both callbacks must synchronously return a
plain object record with the current realm's `Object.prototype` or `null` as its
prototype. Arrays, functions, class instances, dates, Promises, and thenable
records are rejected.

`inspect(nameOrToken)` returns a frozen snapshot with `bindingId`, `label`,
`metadata`, and `acquisitions`. Each acquisition has `acquisitionId`, `state`, and
an ordered tuple of acquisition metadata frames. It contains no service values
or live mutable runtime collections. A snapshot does not update after it is
returned. Failed attempts are evicted rather than retained as history. After
close, static metadata remains available and acquisition lists are empty.

`inspectAll(token)` does the same for each contribution in declaration order.
Aliases expose their direct target description and canonical acquisition state.
Native metadata decorators add frames as described under
[acquisition values and metadata](#represent-acquisition-values-and-metadata-natively).

## Observe lifecycle transitions

Observers send telemetry without joining the service or cleanup control flow.

**Standalone example:**

```ts
import { DiBag } from 'di-bag/node';

const observed = DiBag.observe({
  onEvent(event) {
    console.log(event.kind, event.scopeId);
  },
  onError({ event, error }) {
    console.error('Telemetry failed', event.kind, error);
  },
});

const app = observed.begin().add({ answer: () => 42 }).end();
app.resolve('answer');
await app.close();
```

Both callbacks are required. `observe()` returns a new `Facade`; repeated calls
append observers. `configure()` preserves them. Existing facades, builders, and
bags keep the configuration with which they were created.

Events cover scope opening/closing, acquisition start/readiness/failure, and
cleanup start/failure/completion. They carry stable scope and attempt identities,
canonical binding information, lifetime, static metadata, and copied acquisition
frames where applicable. Shared attempts report their actual owner. A raw Promise
is ready as a value; a native stage reports readiness after settlement.

Callbacks run in emission and registration order on a microtask queue, outside
synchronous factory execution. Callback throws or rejections go to that
observer's `onError`; errors in `onError` are consumed. Observer work never gates
resolution, startup, or close. If delivery completion matters, the application
must maintain and await its own barrier. [`examples/observers.ts`](../../examples/observers.ts)
shows that pattern.

## Admit an application-selected plugin

`fromPlugin` creates a checked boundary for an unknown descriptor selected by
application code. DI Bag does not load a path or choose an export.

**Standalone example:**

```ts
import { DiBag } from 'di-bag/node';

interface Handler { handle(text: string): string }
const handlerKey = Symbol('handler');
const handler = DiBag.token(handlerKey).of<Handler>();

const selected: unknown = {
  apiVersion: 1,
  create: () => ({ handle: (text: string) => text.toUpperCase() }),
};

const provider = DiBag.fromPlugin([], selected, {
  acquisition: 'raw',
  validate: (value: unknown): value is Handler =>
    typeof value === 'object' && value !== null &&
    'handle' in value && typeof value.handle === 'function',
});

const feature = DiBag.module().bind(handler, provider).exports([handler]);
const app = DiBag.begin().install(feature).end();
console.log(app.resolve(handler).handle('hello')); // HELLO
await app.close();
```

A descriptor requires own `apiVersion: 1` and callable `create` properties; an
own `dispose` is optional and must be callable. `fromPlugin(dependencies,
descriptor, options)` requires both `validate` and `acquisition: 'raw' | 'native'`.
Dependencies may be tokens or required/optional/lazy/all references and arrive in
tuple order. The tuple, callbacks, and descriptor fields are captured immediately.

Raw mode validates the exact returned value synchronously. Native mode requires
a genuine native source Promise and exposes one stable Promise whose fulfilled
value is validated. The predicate must synchronously return exactly `true`.
Descriptor failures use `DiBagPluginError` phase `'descriptor'`; invalid output
uses phase `'output'`.

When a descriptor has a disposer, the source value becomes owned before output
validation. A failed validator therefore still releases the original acquired
value during rollback or close. Validation checks this boundary once; it does not
sandbox plugin code or continuously validate a mutable service.

## Portable mode

Use `di-bag/node` in Node and Bun. It supplies native-Promise classification. Use
the portable `di-bag` entry in Deno, browsers, or hosts where an application must
choose classification policy.

There are two portable strategies. Configure an application-local facade with a
trusted native-Promise predicate:

**Conceptual snippet:** `trustedHostPredicate` is supplied by the application.

```ts
import { DiBag as CoreDiBag } from 'di-bag';

const DiBag = CoreDiBag.configure({
  isNativePromise: trustedHostPredicate,
});
```

It must identify native Promises without using a structural thenable test or a
plain `instanceof` test. `configure()` returns a new facade; it does not mutate
global state. Its context follows builders, bags, scopes, and forks.

Alternatively, make every reachable automatic stage explicit:

**Standalone example:**

```ts
import { DiBag } from 'di-bag';

const resource = DiBag.factory(
  () => ({ id: 7 }),
  { acquisition: 'raw' },
);
const app = DiBag.begin().add({ resource }).end();
```

Without a configured predicate, graph completion checks the entire graph,
including private module providers, before factories
run. Any stage still using `auto` is rejected.

The stage rules are precise:

- `raw` exposes the exact return value without reading `then`.
- `native` requires a Promise-shaped TypeScript output, observes native
  fulfillment, and still exposes the exact source Promise.
- `auto` asks the configured predicate. The Node/Bun facade supplies its own
  classifier.
- `factory`, `fromTokens`, `fromFunction`, `fromClass`, `withContext`, and
  `mapSync` select the acquisition mode of the stage they add. Omitting their
  optional mode uses `auto`; `factory` always requires an explicit mode.
- `mapAsync` and `withAcquisitionMetadataAsync` always add a native stage.
- `withDisposal`, `withLifetime`, `withMetadata`,
  `withAcquisitionMetadata`, token binding, aliases, and module installation
  retain the modes already described by their sources.

Automatic or native observation tracks fulfillment for ownership and readiness
without replacing the exposed Promise. A raw Promise is an immediate value. See
the [server guide's Deno section](server-integration.md#deno-and-portable-acquisition)
for a full portable-host composition.

## Represent acquisition values and metadata natively

Use ordinary factory return values to carry a payload and facts learned while
producing it. Then use `mapSync` or `mapAsync` to project the part consumers need.
`Presence<T>` preserves the difference between an absent value and a present
value whose payload is `undefined`.

**Standalone example:**

```ts
import { DiBag, type Presence } from 'di-bag/node';

type Located<T> = {
  readonly value: Presence<T>;
  readonly origin: string;
};

const located = DiBag.withAcquisitionMetadata(
  (): Located<number | undefined> => ({
    value: { present: true, value: undefined },
    origin: 'environment',
  }),
  result => ({ origin: result.origin }),
);
const value = DiBag.mapSync(located, result => result.value);

const app = DiBag.begin().add({ value }).end();
const acquired = app.resolve('value');
console.log(acquired.present); // true
console.log(acquired.present && acquired.value); // undefined
console.log(app.inspect('value').acquisitions[0]?.metadata[0]);
await app.close();
```

The immediate decorator calls its synchronous `describe` callback with the
exact source output and preserves that output's identity and acquisition policy.
This matters when a raw stage intentionally exposes a Promise as an ordinary
value: the callback and consumer see the same Promise object.

The asynchronous decorator awaits the source before calling `describe` and
always exposes a native Promise of the source's awaited value:

```ts
const located = DiBag.withAcquisitionMetadataAsync(
  async () => ({ value: 42, origin: 'remote-config' }),
  result => ({ origin: result.origin }),
);
const value = DiBag.mapAsync(located, result => result.value);
```

Each decorator reserves an absent frame before its source runs. The immediate
form fills that frame as soon as the source returns and `describe` succeeds,
even when the exact source output is a still-pending Promise. The asynchronous
form leaves its frame absent until the source fulfills and `describe` succeeds.
Frames from repeated decorators remain in declaration order. Inspection itself
never starts an acquisition.

Each captured metadata frame is a shallow, frozen copy of the returned record.
Nested objects and service payloads keep their identities and are not
deep-frozen. Invalid records, asynchronous metadata callbacks, and callback
errors fail the acquisition through the decorator's selected mode.

Metadata decorators and projections add no ownership. Existing ownership from
`withDisposal` is retained through them; add a new `withDisposal` only when the
bag should own the projected value too. Ordinary factories remain borrowed even
when their values have `close()` or `dispose()` methods. Run
[`examples/provider-metadata.ts`](../../examples/provider-metadata.ts) for sync
and async acquisition metadata, present `undefined`, projection, and cleanup.

## Exported TypeScript types

Prefer inference for builders, bags, providers, and modules. When a value crosses
a source-file boundary, `typeof` and `ReturnType` preserve private module
constraints, token contracts, lifetime rules, ownership stages, and inspection
metadata better than a shorter annotation.

**Conceptual type-extraction snippet:** these names refer to declarations in the
typed-token examples above.

```ts
import type { ProviderOutput, TokenService } from 'di-bag';

type Clock = TokenService<typeof clock>;
type Stamp = ProviderOutput<typeof stamp>;
type Application = typeof app;
```

`TokenKey`, `TokenService`, `ProviderOutput`, `ProviderNeeds`,
`ProviderMetadata`, `ProviderAcquired`, `ModuleProvides`, `ModuleRequires`, and
the remaining public types are catalogued in the [API reference](api-reference.md#exported-typescript-types).

## Boundaries

DI Bag checks the declared graph and manages explicitly described ownership. Its
runtime checks do not restore guarantees erased by casts, unchecked JavaScript,
or an inaccurate plugin validator. It does not add framework-specific request
hooks, transaction rollback, dynamic module loading, decorators, or reflection
metadata. Connect those application lifecycles explicitly; the
[server integration guide](server-integration.md) provides concrete Node HTTP,
Express, Fastify, Bun, Deno, background-job, and shutdown patterns.
