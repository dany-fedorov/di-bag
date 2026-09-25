# Errors and messages {#errors}

One section per compile-time message family and per runtime `DI_BAG_*` code:
when it appears, the cause, the fix, and the recipe that applies.

A library-created runtime error has a stable `code` and frozen `details`; branch
on those. Its message has the form
`<code>: <message>; see https://dany-fedorov.github.io/di-bag/agent/errors.html#<fragment>`,
where the fragment is the code lower-cased with `_` replaced by `-`. Errors
thrown by your factories and disposers keep their identity.

A private binding of a module built with `buildModule({ exportedServiceKeys: keys, moduleLabel })` appears
as `<label>/<key>` in messages and `details` paths (`outer/inner/key` when
nested), which names the module directory to open.

A compile-time rejection is an assignability error whose type reads
`Unsatisfied<"message", details>`. The message ends with
`; see https://dany-fedorov.github.io/di-bag/agent/errors.html#<family>`, one of
the sections below. Put `builder.verifyGraphAtCompileTime() satisfies void;` on its own line
to report it there, and set `"noErrorTruncation": true` to print the details.

## Compile-time messages {#compile-time}

### Missing service {#missing-service}

**When:** `buildContainer()`, `verifyGraphAtCompileTime()`, or `check.ts` reports
`required services are missing: <keys>; see https://dany-fedorov.github.io/di-bag/agent/errors.html#missing-service`.

**Cause:** a factory declares a dependency that no provider, installed
module, or host supplies. A module's unmet dependencies become requirements of
the builder that installs it.

**Fix:** add each listed key in the host with `withServices`, or add a typed fixture in `check.ts`
and tests.

```ts
// expect-error: required services are missing: config; see https://dany-fedorov.github.io/di-bag/agent/errors.html#missing-service
import { DiBag } from 'di-bag';

DiBag.createBuilder()
  .withServices({ greeter: ({ config }: { config: { greeting: string } }) => config.greeting })
  .verifyGraphAtCompileTime() satisfies void;
```

```ts
import { DiBag } from 'di-bag';

DiBag.createBuilder()
  .withServices({
    config: () => ({ greeting: 'Hello' }),
    greeter: ({ config }: { config: { greeting: string } }) => config.greeting,
  })
  .verifyGraphAtCompileTime() satisfies void;
```

**Recipe:** [debug a missing-dependency rejection](recipes.md#debug-missing-dependency).

### Unsatisfied consumer {#unsatisfied-consumer}

**When:** `verifyGraphAtCompileTime()` reports
`provided service does not satisfy its consumer dependency; see https://dany-fedorov.github.io/di-bag/agent/errors.html#unsatisfied-consumer`,
with details `{ consumer, dependency, expected, provided }`, or any builder composition
call (`withCollectionContribution`, `withInstalledModules`, `withServices`, `withReplacedService`,
`createIndependentContainer`, `createChildContainer`) and `verifyGraphAtCompileTime()` report
`contribution service is incompatible with its consumer dependency contract; see https://dany-fedorov.github.io/di-bag/agent/errors.html#unsatisfied-consumer`,
with details `{ failures: { consumer, diagnostic } }` where `diagnostic` carries
the same four fields for the contributed service.

**Cause:** a registered service's type is not assignable to the type a consumer
declares for it, often after one branch changed a contract.

**Fix:** change the provider's output or the consumer's declared type so they
agree; the details name both keys and both types.

```ts
// expect-error: provided service does not satisfy its consumer dependency; see https://dany-fedorov.github.io/di-bag/agent/errors.html#unsatisfied-consumer
import { DiBag } from 'di-bag';

DiBag.createBuilder()
  .withServices({
    port: () => 'eighty',
    server: ({ port }: { port: number }) => port + 1,
  })
  .verifyGraphAtCompileTime() satisfies void;
```

**Recipe:** [review a merge](recipes.md#review-merge).

### Singleton captures scoped {#singleton-captures-scoped}

**When:** `singleton lifetime cannot capture scoped dependency: <singleton> -> <scoped>; see https://dany-fedorov.github.io/di-bag/agent/errors.html#singleton-captures-scoped`.

**Cause:** a singleton service would keep one child container's scoped dependency
for the whole container tree. Providers are scoped per container by default.

**Fix:** mark the consumer with `DiBag.providerWithLifetime({ provider, lifetime:
'scoped:one-per-container' })`, make the dependency singleton as well, or use
`DiBag.providerWithLifetime({ provider, lifetime: 'singleton:one-per-container-tree',
allowsScopedDependencies: true })` only for a deliberate capture of the root
container's instance.

```ts
// expect-error: singleton lifetime cannot capture scoped dependency: client -> config; see https://dany-fedorov.github.io/di-bag/agent/errors.html#singleton-captures-scoped
import { DiBag } from 'di-bag';

DiBag.createBuilder()
  .withServices({
    config: () => ({ url: 'memory:' }),
    client: DiBag.providerWithLifetime({ provider: ({ config }: { config: { url: string } }) => config.url, lifetime: 'singleton:one-per-container-tree' }),
  })
  .verifyGraphAtCompileTime() satisfies void;
```

```ts
import { DiBag } from 'di-bag';

DiBag.createBuilder()
  .withServices({
    config: DiBag.providerWithLifetime({ provider: () => ({ url: 'memory:' }), lifetime: 'singleton:one-per-container-tree' }),
    client: DiBag.providerWithLifetime({ provider: ({ config }: { config: { url: string } }) => config.url, lifetime: 'singleton:one-per-container-tree' }),
  })
  .verifyGraphAtCompileTime() satisfies void;
```

**Recipe:** [add and consume an async client](recipes.md#async-client).

### Unknown key {#unknown-key}

**When:** `createIndependentContainer accepts existing names or typed tokens only: unknown <key>`, the
same message for `createChildContainer` and `ensureServicesReady`,
`withReplacedService requires one existing singleton string-literal key: <key>`, or, on
`resolve`, `serviceSnapshot`, or `withReplacedService`,
`token must be an individually known genuine handle` or
`token must match an existing binding contract`, or
`<op> requires a finite tuple of singleton string-literal names or typed tokens`
when the selection is a `string[]`, a union, or a widened array (`createIndependentContainer`,
`createChildContainer`, `createChildContainer` sharing, `buildModule`, `ensureServicesReady`), each
followed by `; see https://dany-fedorov.github.io/di-bag/agent/errors.html#unknown-key`.

**Cause:** the selected or resolved key is not registered in this graph, or is
a private name of an installed module, or the key is registered under a
different typed token than the one passed.

**Fix:** select only exported or registered keys; add the registration first
when the key is new. Pass the selection as a literal tuple
(`['a', 'b'] as const`, or a `const` type parameter), not a `string[]`.

```ts
// expect-error: createIndependentContainer accepts existing names or typed tokens only: unknown host; see https://dany-fedorov.github.io/di-bag/agent/errors.html#unknown-key
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder().withServices({ port: () => 80 }).buildContainer();
app.createIndependentContainer(['host'], { host: () => 'localhost' });
```

**Recipe:** [write a fixture test with an independent container](recipes.md#fixture-test).

### Structural thenable {#structural-thenable}

**When:** `factory output is a structural thenable: <keys>; return a native Promise or use DiBag.createProvider with factoryReturnKind 'uninspected' or 'native-promise'; see https://dany-fedorov.github.io/di-bag/agent/errors.html#structural-thenable`,
or at a provider construction site:
`factory output is a structural thenable; return a native Promise or select factoryReturnKind 'uninspected' or 'native-promise'; see https://dany-fedorov.github.io/di-bag/agent/errors.html#structural-thenable`.

**Cause:** a factory returns an object with a `then` method that is not a native
Promise, such as a query builder. Automatic acquisition cannot tell whether to
await it.

**Fix:** convert it to a native Promise, or keep the object as the service with
`factoryReturnKind: 'uninspected'`.

```ts
// expect-error: factory output is a structural thenable: query; return a native Promise or use DiBag.createProvider with factoryReturnKind 'uninspected' or 'native-promise'; see https://dany-fedorov.github.io/di-bag/agent/errors.html#structural-thenable
import { DiBag } from 'di-bag';

type Query = { then(onFulfilled: (rows: string[]) => void): void };
const select = (): Query => ({ then: onFulfilled => onFulfilled([]) });
DiBag.createBuilder().withServices({ query: select }).buildContainer();
```

```ts
import { DiBag } from 'di-bag';

type Query = { then(onFulfilled: (rows: string[]) => void): void };
const select = (): Query => ({ then: onFulfilled => onFulfilled([]) });
DiBag.createBuilder()
  .withServices({
    rows: () => new Promise<string[]>(resolve => select().then(resolve)),
    query: DiBag.createProvider(select, { factoryReturnKind: 'uninspected' }),
  })
  .buildContainer();
```

**Recipe:** [add and consume an async client](recipes.md#async-client).

### Portable factory output {#portable-factory-output}

**When:** `sync-value output must not be a Promise or thenable; use factoryReturnKind 'native-promise' for a Promise, or 'uninspected' to make the Promise object the service; see https://dany-fedorov.github.io/di-bag/agent/errors.html#portable-factory-output`,
or `native-promise factory return kind requires a Promise output; use 'sync-value' for a synchronous value; see https://dany-fedorov.github.io/di-bag/agent/errors.html#portable-factory-output`.

**Cause:** the explicit return kind must agree with the factory's declared output.
`'sync-value'` never
reads `then`: an `async` function, a `Promise`-returning function, a union with a
Promise member, or a thenable such as a query builder cannot be its service.
`'native-promise'` requires a native Promise: a plain value, a union, or a
`PromiseLike` cannot be its service.

**Fix:** pick the return kind that matches the output. When the Promise object itself
is the service, use `DiBag.createProvider(create, { factoryReturnKind: 'uninspected' })`.

```ts
// expect-error: sync-value output must not be a Promise or thenable
import { DiBag } from 'di-bag';

const config = DiBag.createProvider(async () => ({ url: 'memory:' }), { factoryReturnKind: 'sync-value' });
```

```ts
import { DiBag } from 'di-bag';

const config = DiBag.createProvider(async () => ({ url: 'memory:' }), { factoryReturnKind: 'native-promise' });
const ownedPromise = DiBag.createProvider(() => Promise.resolve({ url: 'memory:' }), { factoryReturnKind: 'uninspected' });
```

**Recipe:** [make a graph portable to browsers and workers](recipes.md#portable-graph).

### Wrong shape at a call {#wrong-shape}

**When:** `withServices`, `withInstalledModules`, or `withReplacedService` reports
`provided service does not satisfy its consumer dependency; see https://dany-fedorov.github.io/di-bag/agent/errors.html#wrong-shape`.

**Cause:** the same mismatch as an [unsatisfied consumer](#unsatisfied-consumer).
These call sites keep a short message because naming the keys there costs
compile time on every valid graph.

**Fix:** add `verifyGraphAtCompileTime() satisfies void;` after the call to get the consumer,
dependency, expected type, and provided type.

```ts
// expect-error: provided service does not satisfy its consumer dependency; see https://dany-fedorov.github.io/di-bag/agent/errors.html#wrong-shape
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder().withServices({ port: () => 80 });
app.withServices({ server: ({ port }: { port: string }) => port.length });
```

**Recipe:** [debug a missing-dependency rejection](recipes.md#debug-missing-dependency).

### Wrong override {#wrong-override}

**When:** `createIndependentContainer` or `createChildContainer` reports
`replacement value is not assignable to the original token: <keys>; see https://dany-fedorov.github.io/di-bag/agent/errors.html#wrong-override`,
or a plain `Type 'X' is not assignable to type 'Y'` on an override factory.

**Cause:** an override's service value is not assignable to the type the
original registration declares for that key. An independent or child container substitutes a
service but cannot change its contract, and its consumers are typed against the
original.

**Fix:** return the original service type (or a subtype) from the override. To
change the contract, change the registration in the builder and call `buildContainer()` again.

```ts
// expect-error: Type 'string' is not assignable to type 'number'
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder().withServices({ port: () => 80 }).buildContainer();
app.createIndependentContainer(['port'], { port: () => 'eighty' });
```

**Recipe:** [write a fixture test with an independent container](recipes.md#fixture-test).

## Runtime codes {#runtime-codes}

### DI_BAG_CLASSIFIER_REQUIRED {#di-bag-classifier-required}

**When:** `buildContainer()` completes a graph on a host without
`process.getBuiltinModule`: browsers, Web Workers, and other non-Node runtimes.
Node, Bun, and Deno never raise it.

**Cause:** a provider uses automatic acquisition, no native-Promise classifier
is configured, and the host offers none. The message and `details.bindings` name
every such provider, sorted, with private module services as `<label>/<key>`;
a direct `providerWithTransformedService` without a `transformReturnKind` counts under its
provider's name.

**Fix:** add each named service with `DiBag.createProvider(factory, { factoryReturnKind: 'sync-value' })`
or `'native-promise'`; give positional providers an explicit return kind and direct
`providerWithTransformedService` an explicit `transformReturnKind`; or configure a trusted
classifier with `withConfiguration({ runtime: { isNativePromise } })`.

```ts
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder()
  .withServices({
    answer: DiBag.createProvider(() => 42, { factoryReturnKind: 'sync-value' }),
    later: DiBag.createProvider(async ({ answer }: { answer: number }) => answer * 2, { factoryReturnKind: 'native-promise' }),
  })
  .buildContainer();
```

**Recipe:** [make a graph portable to browsers and workers](recipes.md#portable-graph).

### DI_BAG_CLOSE_ABORTED {#di-bag-close-aborted}

**When:** `close({ abortSignal })` rejects with `DiBagCloseCancelledError`,
`reason: 'aborted'`, because the signal aborted before cleanup finished.

**Cause:** the caller stopped waiting. Cleanup continues: `details.disposersStillRunning`
names disposers that started and have not finished, `details.acquisitionsStillPending` the
acquisitions close is still draining, and `cause` is the abort reason.

**Fix:** await `disposalPromise` before exiting when cleanup must complete; fix
the named disposer or acquisition if it never settles.

```ts
import { DiBag, DiBagCloseCancelledError } from 'di-bag';

const app = DiBag.createBuilder().withServices({ answer: () => 42 }).buildContainer();
const controller = new AbortController();
try {
  await app.close({ abortSignal: controller.signal });
} catch (error) {
  if (!(error instanceof DiBagCloseCancelledError)) throw error;
  console.error(error.details.disposersStillRunning, error.details.acquisitionsStillPending);
  await error.disposalPromise;
}
```

**Recipe:** [add a request-scoped service with cleanup](recipes.md#add-scoped-service).

### DI_BAG_CLOSE_FAILED {#di-bag-close-failed}

**When:** `close()` rejects with an `AggregateError` carrying this code.

**Cause:** closing a child container or the root container's own acquisitions failed with
something other than disposer failures. `errors` holds each failure, preceded
by a `DiBagDisposalError` when disposers also failed.

**Fix:** inspect `errors`; each entry keeps its own `code` when the library
created it.

```ts
import { DiBag, type DiBagDiagnostic } from 'di-bag';

const app = DiBag.createBuilder().withServices({ answer: () => 42 }).buildContainer();
await app.close().catch((error: unknown) => {
  const failures = error instanceof AggregateError ? error.errors : [error];
  for (const failure of failures) console.error((failure as Partial<DiBagDiagnostic>).code, failure);
});
```

**Recipe:** [add a request-scoped service with cleanup](recipes.md#add-scoped-service).

### DI_BAG_CLOSE_TIMEOUT {#di-bag-close-timeout}

**When:** `close({ waitTimeoutMs })` rejects with `DiBagCloseCancelledError`,
`reason: 'timeout'`; its `cause` is a `TimeoutError` with the same code.

**Cause:** cleanup did not finish within `waitTimeoutMs`. The message and
`details.disposersStillRunning` name the disposers still running, or `details.acquisitionsStillPending` the
acquisitions still pending; `disposalPromise` settles when cleanup ends.

**Fix:** find why the named disposer or factory never settles (a missing
`await`, an ignored acquisition signal); raise `waitTimeoutMs` only for slow but
finite cleanup.

```ts
import { DiBag, DiBagCloseCancelledError } from 'di-bag';

const app = DiBag.createBuilder().withServices({ answer: () => 42 }).buildContainer();
await app.close({ waitTimeoutMs: 5_000 }).catch((error: unknown) => {
  if (error instanceof DiBagCloseCancelledError) console.error('still running:', error.details.disposersStillRunning);
  throw error;
});
```

**Recipe:** [add a request-scoped service with cleanup](recipes.md#add-scoped-service).

### DI_BAG_CLOSED {#di-bag-closed}

**When:** `resolve`, `createChildContainer`, `createIndependentContainer`, or a `lazy` reference is used on a
container whose `close()` has finished.

**Cause:** application work outlived the container that serves it. `details.state` is
`'closed'`.

**Fix:** finish or cancel work before closing; give request work its own child container
and close that child, not the application container.

```ts
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder().withServices({ answer: () => 42 }).buildContainer();
const request = app.createChildContainer();
try {
  request.resolve('answer');
} finally {
  await request.close();
}
await app.close();
```

**Recipe:** [add a request-scoped service with cleanup](recipes.md#add-scoped-service).

### DI_BAG_CLOSING {#di-bag-closing}

**When:** the same operations as [`DI_BAG_CLOSED`](#di-bag-closed), while
`close()` is still in progress. Also the message of `factoryContext.signal.reason`
after `close()`: an `AbortError` that is the same object for every container. A
cancelled or failed startup aborts with its own cause instead.

**Cause:** a request, timer, or factory started new resolution after shutdown
began. Only a factory already running when `close()` started may still read its
dependencies.

**Fix:** stop accepting work (close the server, clear timers), await in-flight
work, then call `close()`; see the snippet for `DI_BAG_CLOSED`.

**Recipe:** [add a request-scoped service with cleanup](recipes.md#add-scoped-service).

### DI_BAG_CONFLICTING_SERVICE_SELECTION {#di-bag-conflicting-service-selection}

**When:** `createChildContainer` names one key in both `replacedServiceKeys` and
`sharedParentServiceKeys` (`details.conflict` is `'shared-and-replaced'`), or
shares a transient service (`'shared-transient'`). `details.serviceKey` names
the key.

**Cause:** sharing means the child uses the parent's instance and replacing
means it builds its own, so one key cannot do both. A transient service has no
instance to share.

**Fix:** list each key once, and do not share a transient service.

```ts
import { DiBag } from 'di-bag';

const parent = DiBag.createBuilder()
  .withServices({
    config: DiBag.providerWithLifetime({ provider: () => ({ region: 'eu' }), lifetime: 'scoped:one-per-container' }),
    client: DiBag.providerWithLifetime({ provider: () => ({ id: 1 }), lifetime: 'scoped:one-per-container' }),
  })
  .buildContainer();
const child = parent.createChildContainer(
  ['config'],
  { config: () => ({ region: 'us' }) },
  { sharedParentServiceKeys: ['client'] },
);
console.log(child.resolve('config').region);
await parent.close();
```

**Recipe:** [add a request-scoped service with cleanup](recipes.md#add-scoped-service).

### DI_BAG_DEPENDENCY_CYCLE {#di-bag-dependency-cycle}

**When:** resolving a service whose dependencies lead back to it; the message is
`cycle: a -> b -> a` (or `alias cycle: ...`) and `details.path` lists the keys.

**Cause:** factories depend on each other in a loop. The compiler does not
detect cycles.

**Fix:** move the shared part into a third service both depend on, or defer one
edge with `DiBag.lazy(token)`.

```ts
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder()
  .withServices({
    rates: () => ({ vat: 0.2 }),
    prices: ({ rates }: { rates: { vat: number } }) => (cents: number) => cents * (1 + rates.vat),
    invoices: ({ rates }: { rates: { vat: number } }) => (cents: number) => cents * rates.vat,
  })
  .buildContainer();
```

**Recipe:** [review a merge](recipes.md#review-merge) (`di-bag-graph --check`
reports cycles before running).

### DI_BAG_DISPOSAL_FAILED {#di-bag-disposal-failed}

**When:** `close()` rejects with `DiBagDisposalError` after attempting every
disposer.

**Cause:** one or more disposers threw or rejected. The others still ran and the
container is closed; `failures` lists `bindingLabel` and `error` for each.

**Fix:** fix the failing disposer; log the failures where the application closes.

```ts
import { DiBag, DiBagDisposalError } from 'di-bag';

const app = DiBag.createBuilder().withServices({ answer: () => 42 }).buildContainer();
try {
  await app.close();
} catch (error) {
  if (!(error instanceof DiBagDisposalError)) throw error;
  for (const failure of error.failures) console.error(failure.bindingLabel, failure.error);
}
```

**Recipe:** [add a request-scoped service with cleanup](recipes.md#add-scoped-service).

### DI_BAG_DISPOSER_PUSHED_AFTER_FACTORY {#di-bag-disposer-pushed-after-factory}

**When:** `factoryContext.pushDisposer(disposer)` throws because the factory that
owns the context has already returned or failed. Its projections may still be
running; the factory is the boundary, not the whole acquisition.

**Cause:** the acquisition context escaped its factory and was called later —
from the service it produced, from a projection of the registration, or from
inside a pushed disposer already running. A context belongs to one running
factory, not to the service it produced.

**Fix:** push inside the factory, immediately after acquiring the resource; own
the returned value with `DiBag.providerWithDisposal`, and give a pushed disposer for that
same value a `reason` check.

```ts
import { DiBag } from 'di-bag';

const handle = DiBag.providerWithDisposal({
  provider: DiBag.createProvider(async (_dependencies: {}, factoryContext) => {
    const socket = { close: async () => {} };
    factoryContext.pushDisposer(disposerContext => { if (disposerContext.reason !== 'service-disposed') return socket.close(); });
    return socket;
  }, { factoryReceivesContext: true }),
  disposeService: socket => socket.close(),
});
```

**Recipe:** [own a resource a factory acquires on the way](recipes.md#partial-acquisition).

### DI_BAG_DUPLICATE_METADATA_KEY {#di-bag-duplicate-metadata-key}

**When:** `DiBag.providerWithRegistrationMetadata({ provider, registrationMetadata })` adds a key the
registration already carries. `details.metadataKey` names the repeated key.

**Cause:** two metadata wrappers use the same key.

**Fix:** use distinct, namespaced keys such as `'app:owner'` and `'app:node'`.

```ts
import { DiBag } from 'di-bag';

const service = DiBag.providerWithRegistrationMetadata({
  provider: DiBag.providerWithRegistrationMetadata({
    provider: () => 42,
    registrationMetadata: { 'app:owner': 'billing' },
  }),
  registrationMetadata: { 'app:node': 'tool' },
});
```

**Recipe:** none.

### DI_BAG_DUPLICATE_SERVICE_KEY {#di-bag-duplicate-service-key}

**When:** `withServices`, `withTokenService`, `withServiceAlias`,
`withInstalledModules`, `withRenamedExport` or `withRenamedRequirement` would
give two services the same key. `details.operation` names the call and
`details.serviceKey` the key.

**Cause:** a builder holds one service per key. Adding a key that exists is
never a replacement.

**Fix:** to change an existing service use `withReplacedService`; otherwise pick
another key, or rename the module's export before installing it.

```ts
import { DiBag } from 'di-bag';

const base = DiBag.createBuilder().withServices({ clock: () => ({ now: () => 0 }) });
const app = base.withReplacedService('clock', () => ({ now: () => 1 })).buildContainer();
console.log(app.resolve('clock').now());
await app.close();
```

### DI_BAG_INTERNAL_STATE {#di-bag-internal-state}

**When:** a library invariant failed, for example an acquisition without a
result.

**Cause:** a DI Bag defect, not application code.

**Fix:** report it at https://github.com/dany-fedorov/di-bag/issues with the
stack trace and the smallest graph that reproduces it.

**Recipe:** none.

### DI_BAG_INVALID_ACQUISITION_METADATA {#di-bag-invalid-acquisition-metadata}

**When:** a `describeAcquisition` callback returns something other than a plain
object, synchronously: a Promise, an array, `null` or a primitive. It is raised
while the service is acquired, so `resolve` throws or rejects with a
`TypeError`.

**Cause:** acquisition metadata is recorded at the moment the service becomes
available. A Promise cannot be recorded, and the library does not await it.

**Fix:** return a plain record. To describe the fulfilled value of an
asynchronous factory, ask for it with `callbackReceives: 'fulfilled-value'`.

```ts
import { DiBag } from 'di-bag';

const db = DiBag.providerWithAcquisitionMetadata({
  provider: async () => ({ version: 7 }),
  describeAcquisition: value => ({ version: value.version }),
  callbackReceives: 'fulfilled-value',
});
const app = DiBag.createBuilder().withServices({ db }).buildContainer();
await app.resolve('db');
await app.close();
```

### DI_BAG_INVALID_ARGUMENT {#di-bag-invalid-argument}

**When:** a call receives an argument of the wrong shape: a factory that is not a
function, an options bag that is not an object or holds an unknown property, an
option of the wrong type, a value outside a fixed set. Every public method
raises it, some as a `TypeError`.

**Cause:** the call site is not type-checked, or a cast silenced the compiler,
which rejects every one of these. `details` says exactly what was wrong:
`operation` is the method, `argument` is the parameter or option (a dotted path
for a nested option, `[]` for an element of a list), and `expected` completes
the sentence "must be ...".

**Fix:** branch on `details.argument`, not on the message. Remove the cast and
let the compiler point at the argument.

```ts
import { DiBag } from 'di-bag';

try {
  DiBag.createProvider(42 as never);
} catch (error) {
  const { operation, argument, expected } = (error as { details: Record<string, unknown> }).details;
  console.error(`${String(operation)}: ${String(argument)} must be ${String(expected)}`);
}
```

### DI_BAG_INVALID_CLASSIFIER_RESULT {#di-bag-invalid-classifier-result}

**When:** a factory runs under a configured `runtime.isNativePromise` that
returned something other than a boolean.

**Cause:** the predicate returns `undefined`, a truthy value, or a Promise.

**Fix:** return exactly `true` or `false`, without structural `then` checks.

```ts
import { types } from 'node:util';
import { DiBag as CoreDiBag } from 'di-bag';

const DiBag = CoreDiBag.withConfiguration({
  runtime: { isNativePromise: candidate => types.isPromise(candidate) },
});
```

**Recipe:** none.

### DI_BAG_INVALID_DEPENDENCY_ACCESS {#di-bag-invalid-dependency-access}

**When:** a factory spreads its dependency object, enumerates it
(`Object.keys`, `JSON.stringify`), or uses `in` or a property descriptor on it.
`details.consumer` names the factory and `details.access` the operation.

**Cause:** the dependency object resolves each property lazily when read, so it
cannot list its properties.

**Fix:** destructure the declared dependencies or read them one by one.

```ts
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder()
  .withServices({
    port: () => 80,
    host: () => 'localhost',
    address: ({ host, port }: { host: string; port: number }) => ({ host, port }),
  })
  .buildContainer();
```

**Recipe:** none; see [rule 2](../../AGENTS.md#rules).

### DI_BAG_INVALID_MODULE {#di-bag-invalid-module}

**When:** an element of `withInstalledModules(values)` is something that `buildModule` did not
create, such as a copied or proxied module.

**Cause:** the module was cloned, serialized, or constructed by hand.

**Fix:** import and install the module value exported by `module.ts`.

```ts
import { DiBag } from 'di-bag';

const feature = DiBag.createBuilder().withServices({ answer: () => 42 }).buildModule({ exportedServiceKeys: ['answer'] });
const app = DiBag.createBuilder().withInstalledModules([
  feature,
]).buildContainer();
```

**Recipe:** [split a feature into a module](recipes.md#split-module).

### DI_BAG_INVALID_PROVIDER {#di-bag-invalid-provider}

**When:** a value given where a factory or a provider is required is neither a
function nor a provider made by this library: a value of `withServices`, the
`provider` of `withTokenService`, `withCollectionContribution` or
`withReplacedService`, or an entry of `replacementProviders`.

**Cause:** the service itself was passed instead of a factory for it, or a
provider object was copied. A provider is recognised by identity, so a spread
copy of one is not a provider.

**Fix:** pass `() => value`, or a provider returned by `DiBag.createProvider` and
its sibling calls.

```ts
import { DiBag } from 'di-bag';

const config = { region: 'eu' };
const app = DiBag.createBuilder().withServices({ config: () => config }).buildContainer();
console.log(app.resolve('config').region);
await app.close();
```

### DI_BAG_INVALID_TOKEN {#di-bag-invalid-token}

**When:** `DiBag.createToken(key)` receives a non-symbol, a token argument is a copied
or fabricated object, or a dependency list is not an array.

**Cause:** token identity comes from the handle `createToken(key).forService()` returns, not
from its shape.

**Fix:** declare the symbol and token once, export the token, and import it
wherever it is used.

```ts
import { DiBag } from 'di-bag';

const clockKey = Symbol('clock');
export const clock = DiBag.createToken(clockKey).forService<{ now(): number }>();
```

**Recipe:** none.

### DI_BAG_LIFETIME_DEPENDENCY {#di-bag-lifetime-dependency}

**When:** a singleton service resolves a scoped dependency at runtime;
`details.consumer` and `details.dependency` name both.

**Cause:** the [singleton captures scoped](#singleton-captures-scoped) check was bypassed by a cast or
untyped code.

**Fix:** as for singleton capture: make the dependency singleton, or the consumer scoped.

**Recipe:** [add and consume an async client](recipes.md#async-client).

### DI_BAG_MISSING_DEPENDENCY {#di-bag-missing-dependency}

**When:** a factory reads a dependency that no registration supplies. The
message is `Cannot resolve "<consumer>": dependency "<key>" is not registered`,
and `details.path` is the resolution chain.

**Cause:** a cast, `any`, or JavaScript hid the dependency from the
[missing service](#missing-service) check.

**Fix:** remove the cast so the compiler reports the key, then add it with `withServices`.

**Recipe:** [debug a missing-dependency rejection](recipes.md#debug-missing-dependency).

### DI_BAG_MISSING_REPLACEMENT_PROVIDER {#di-bag-missing-replacement-provider}

**When:** `createChildContainer` or `createIndependentContainer` receives a key in
its positional `replacedServiceKeys` argument and the positional
`replacementProviders` record has no own property for it.
`details.serviceKey` names the key.

**Cause:** the two positional arguments are read together: the list says which
services the new container replaces, the record says with what.

**Fix:** give one provider for every listed key, or take the key off the list.

```ts
import { DiBag } from 'di-bag';

const parent = DiBag.createBuilder().withServices({ config: () => ({ region: 'eu' }) }).buildContainer();
const copy = parent.createIndependentContainer(
  ['config'],
  { config: () => ({ region: 'us' }) },
);
console.log(copy.resolve('config').region);
await copy.close();
await parent.close();
```

### DI_BAG_PLUGIN_VALIDATION {#di-bag-plugin-validation}

**When:** a `createProviderFromPlugin` provider acquires; `DiBagPluginValidationError` with
`phase: 'descriptor'` or `'output'` and a `reason`.

**Cause:** the descriptor lacks own `apiVersion: 1` and a callable `create`, or
`isValidPluginOutput` did not return exactly `true` for the output.

**Fix:** correct the plugin, or reject it before registering; see the
[`createProviderFromPlugin` example](api-card.md#dibag-createproviderfromplugin)
for a valid descriptor and required options. Malformed constructor options
report [`DI_BAG_INVALID_ARGUMENT`](#di-bag-invalid-argument).

**Recipe:** none.

### DI_BAG_REMOVED_API {#di-bag-removed-api}

**When:** code written for 0.4.0 or earlier calls a name that 0.5.0 removed, for
example `DiBag.fromFactory`, `builder.register`, `builder.build`, `bag.fork`.
TypeScript rejects the call at compile time; this error is what JavaScript, an
`any`-typed value, or generated code gets at run time.

**Cause:** 0.5.0 renamed the API. The old names stay for the 0.5 line as
functions that only throw. `details.removed` names the old call and
`details.replacement` says what to write instead.

**Fix:** write the replacement. For a whole project, run `npx di-bag-codemod`
BEFORE upgrading, while the 0.4.0 types are still installed; see the
[migration guide](../guides/migrating-to-0.5.md).

```ts
import { DiBag } from 'di-bag';

const legacy = DiBag as unknown as { fromFactory?: (factory: () => number) => unknown };
try {
  legacy.fromFactory?.(() => 1);
} catch (error) {
  console.error((error as { details: { replacement: string } }).details.replacement);
}
```

### DI_BAG_SERVICE_READINESS_CANCELLED {#di-bag-service-readiness-cancelled}

**When:** `ensureServicesReady` rejects with `DiBagServiceReadinessCancelledError`,
`reason` `'aborted'` or `'timeout'`.

**Cause:** `abortSignal` aborted or `totalTimeoutMs` elapsed before the listed
services were ready. This container is closing. `details.acquisitionsStillPending`
names the services that were not ready yet, `details.disposersStillRunning` the
disposers that had started.

**Fix:** await `disposalPromise` before exiting; fix or speed up the named
service, and make slow factories honor the acquisition `signal`.

```ts
import { DiBag, DiBagServiceReadinessCancelledError } from 'di-bag';

const container = DiBag.createBuilder().withServices({ settings: async () => 'ready' }).buildContainer();
try {
  await container.ensureServicesReady(['settings'], { totalTimeoutMs: 5_000 });
  await container.close();
} catch (error) {
  if (error instanceof DiBagServiceReadinessCancelledError) {
    console.error(error.details.acquisitionsStillPending);
    await error.disposalPromise;
  }
  throw error;
}
```

**Recipe:** [add and consume an async client](recipes.md#async-client).

### DI_BAG_SERVICE_READINESS_FAILED {#di-bag-service-readiness-failed}

**When:** `ensureServicesReady` rejects with `DiBagServiceReadinessError` after
this container has closed.

**Cause:** a listed service or one of its dependencies failed to acquire;
`cause` is that error and `disposalFailures` lists disposers that failed while
the container closed. A child container closes only itself, never its parent.

**Fix:** fix `cause`, then build a new container, or create a new child container, and call
`ensureServicesReady` again.

```ts
import { DiBag, DiBagServiceReadinessError } from 'di-bag';

const container = DiBag.createBuilder().withServices({ settings: async () => 'ready' }).buildContainer();
const app = await container.ensureServicesReady(['settings']).catch((error: unknown) => {
  throw error instanceof DiBagServiceReadinessError ? error.cause : error;
});
await app.close();
```

**Recipe:** [add and consume an async client](recipes.md#async-client).

### DI_BAG_SERVICE_READINESS_TIMEOUT {#di-bag-service-readiness-timeout}

**When:** the `cause` of a
[`DI_BAG_SERVICE_READINESS_CANCELLED`](#di-bag-service-readiness-cancelled)
error with `reason: 'timeout'`: a `DOMException` named `TimeoutError`, with
`details.totalTimeoutMs`.

**Cause:** the listed services took longer than `totalTimeoutMs`, which covers
the whole call and not each service.

**Fix:** raise `totalTimeoutMs`, list fewer services, or make factories honor
the signal so they stop promptly.

**Recipe:** [add and consume an async client](recipes.md#async-client).

### DI_BAG_SINGLETON_REPLACEMENT {#di-bag-singleton-replacement}

**When:** `container.createChildContainer(replacedServiceKeys, replacementProviders)`
selects a service whose inherited provider has lifetime
`'singleton:one-per-container-tree'`.

**Cause:** a singleton is anchored to the container tree and has already fixed the
dependencies of the container that introduced it. Replacing it only in a child would
leave singleton consumers using the inherited value.

**Fix:** mark the replaceable provider with `DiBag.providerWithLifetime` and
`'scoped:one-per-container'`, or use `createIndependentContainer` when the
replacement must rebuild the whole graph.

```ts
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder().withServices({
  request: DiBag.providerWithLifetime({
    provider: () => ({ id: 'outside-request' }),
    lifetime: 'scoped:one-per-container',
  }),
}).buildContainer();

const requestContainer = app.createChildContainer(
  ['request'],
  { request: () => ({ id: crypto.randomUUID() }) },
);
await requestContainer.close();
await app.close();
```

**Details:** `{ operation: 'createChildContainer', serviceKey }`.

**Recipe:** [add a request-scoped service](recipes.md#add-scoped-service).

### DI_BAG_STRUCTURAL_THENABLE {#di-bag-structural-thenable}

**When:** a factory with automatic or native acquisition returns a non-Promise
object with a callable `then`; a `TypeError` with `details.factoryReturnKind`.

**Cause:** the compile-time [structural thenable](#structural-thenable) check was
disabled through `DiBagPolicy` or bypassed by a cast.

**Fix:** as for the compile-time message: return a native Promise or use
`factoryReturnKind: 'uninspected'`.

**Recipe:** [add and consume an async client](recipes.md#async-client).

### DI_BAG_UNKNOWN_SERVICE_KEY {#di-bag-unknown-service-key}

**When:** a call names a service key that the builder, container or module does
not have: `resolve`, `ensureServicesReady`, `withServiceAlias` (the target),
`withReplacedService`, `createChildContainer`, `createIndependentContainer`,
`buildModule` (an exported key), `withRenamedExport` and
`withRenamedRequirement` (the current key). `details.operation` names the call
and `details.serviceKey` the key.

For `withRenamedRequirement`, runtime validation covers known exports and
recorded requirement renames. An unseen absent requirement may pass an untyped
call; type-check the requirement name against the module to catch it.

**Cause:** the key is misspelled, was never registered, or is private to a
module. The compiler reports this first; the runtime error is what an untyped
call gets.

**Fix:** register the service before the call, or correct the key.

```ts
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder().withServices({ clock: () => ({ now: () => 0 }) }).buildContainer();
console.log(app.resolve('clock').now());
await app.close();
```

### DI_BAG_WRONG_TOKEN_KIND {#di-bag-wrong-token-kind}

A genuine typed token was used in an operation that requires the other token kind. A token is either a single-service token or a collection token and cannot serve both roles. Read `details.operation`, `details.expectedKind`, and `details.receivedKind`; create the token with `.forService<Service>()` for one service or `.forCollectionOf<Item>()` for a collection. Split a token that used both channels into two tokens.
