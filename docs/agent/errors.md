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
`required service registrations are missing: <keys>; see https://dany-fedorov.github.io/di-bag/agent/errors.html#missing-service`.

**Cause:** a factory declares a dependency that no registration, installed
module, or host supplies. A module's unmet dependencies become requirements of
the builder that installs it.

**Fix:** add each listed key in the host with `withServices`, or add a typed fixture in `check.ts`
and tests.

```ts
// expect-error: required service registrations are missing: config; see https://dany-fedorov.github.io/di-bag/agent/errors.html#missing-service
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
call (`withCollectionContribution`, `withInstalledModules`, `withServices`, `withReplacedService`, `fork`,
`createScope`) and `verifyGraphAtCompileTime()` report
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

### Root capture {#root-capture}

**When:** `root lifetime cannot capture scoped dependency: <root> -> <scoped>; see https://dany-fedorov.github.io/di-bag/agent/errors.html#root-capture`.

**Cause:** a `root` service would keep one scope's instance of a `scoped` (the
default) dependency for the whole application.

**Fix:** make the dependency `root` as well, or leave the consumer scoped. Use
`{ allowScopedDependencies: true }` only for a deliberate capture of the root
bag's instance.

```ts
// expect-error: root lifetime cannot capture scoped dependency: client -> config; see https://dany-fedorov.github.io/di-bag/agent/errors.html#root-capture
import { DiBag } from 'di-bag';

DiBag.createBuilder()
  .withServices({
    config: () => ({ url: 'memory:' }),
    client: DiBag.withLifetime(({ config }: { config: { url: string } }) => config.url, 'root'),
  })
  .verifyGraphAtCompileTime() satisfies void;
```

```ts
import { DiBag } from 'di-bag';

DiBag.createBuilder()
  .withServices({
    config: DiBag.withLifetime(() => ({ url: 'memory:' }), 'root'),
    client: DiBag.withLifetime(({ config }: { config: { url: string } }) => config.url, 'root'),
  })
  .verifyGraphAtCompileTime() satisfies void;
```

**Recipe:** [add and consume an async client](recipes.md#async-client).

### Unknown key {#unknown-key}

**When:** `fork accepts existing names or typed tokens only: unknown <key>`, the
same message for `createScope` and `ensureServicesReady`,
`withReplacedService requires one existing singleton string-literal key: <key>`, or, on
`resolve`, `inspect`, or `withReplacedService`,
`token must be an individually known genuine handle` or
`token must match an existing binding contract`, or
`<op> requires a finite tuple of singleton string-literal names or typed tokens`
when the selection is a `string[]`, a union, or a widened array (`fork`,
`createScope`, `createScope` share, `buildModule`, `ensureServicesReady`), each
followed by `; see https://dany-fedorov.github.io/di-bag/agent/errors.html#unknown-key`.

**Cause:** the selected or resolved key is not registered in this graph, or is
a private name of an installed module, or the key is registered under a
different typed token than the one passed.

**Fix:** select only exported or registered keys; add the registration first
when the key is new. Pass the selection as a literal tuple
(`['a', 'b'] as const`, or a `const` type parameter), not a `string[]`.

```ts
// expect-error: fork accepts existing names or typed tokens only: unknown host; see https://dany-fedorov.github.io/di-bag/agent/errors.html#unknown-key
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder().withServices({ port: () => 80 }).buildContainer();
app.fork(['host'], { host: () => 'localhost' });
```

**Recipe:** [write a fixture test with `fork`](recipes.md#fixture-test).

### Structural thenable {#structural-thenable}

**When:** `factory output is a structural thenable: <keys>; return a native Promise or use DiBag.fromFactory with acquisitionMode raw or nativePromise; see https://dany-fedorov.github.io/di-bag/agent/errors.html#structural-thenable`,
or on `DiBag.fromFactory`, `fromFunction`, and `fromClass`
`factory output is a structural thenable; return a native Promise or select acquisitionMode raw or nativePromise; see https://dany-fedorov.github.io/di-bag/agent/errors.html#structural-thenable`.

**Cause:** a factory returns an object with a `then` method that is not a native
Promise, such as a query builder. Automatic acquisition cannot tell whether to
await it.

**Fix:** convert it to a native Promise, or keep the object as the service with
`acquisitionMode: 'raw'`.

```ts
// expect-error: factory output is a structural thenable: query; return a native Promise or use DiBag.fromFactory with acquisitionMode raw or nativePromise; see https://dany-fedorov.github.io/di-bag/agent/errors.html#structural-thenable
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
    query: DiBag.fromFactory(select, { acquisitionMode: 'raw' }),
  })
  .buildContainer();
```

**Recipe:** [add and consume an async client](recipes.md#async-client).

### Portable factory output {#portable-factory-output}

**When:** `fromSyncFactory output must not be a Promise or thenable; use fromAsyncFactory for a Promise, or fromFactory with acquisitionMode raw to make the Promise object the service; see https://dany-fedorov.github.io/di-bag/agent/errors.html#portable-factory-output`,
or `fromAsyncFactory requires a Promise output; use fromSyncFactory for a synchronous value; see https://dany-fedorov.github.io/di-bag/agent/errors.html#portable-factory-output`.

**Cause:** the helper fixes the acquisition mode from its name, so the factory's
declared output must agree with it. `fromSyncFactory` is a `raw` stage that never
reads `then`: an `async` function, a `Promise`-returning function, a union with a
Promise member, or a thenable such as a query builder cannot be its service.
`fromAsyncFactory` is a `nativePromise` stage: a plain value, a union, or a
`PromiseLike` cannot be its service.

**Fix:** pick the helper that matches the output. When the Promise object itself
is the service, use `DiBag.fromFactory(create, { acquisitionMode: 'raw' })`.

```ts
// expect-error: fromSyncFactory output must not be a Promise or thenable
import { DiBag } from 'di-bag';

const config = DiBag.fromSyncFactory(async () => ({ url: 'memory:' }));
```

```ts
import { DiBag } from 'di-bag';

const config = DiBag.fromAsyncFactory(async () => ({ url: 'memory:' }));
const ownedPromise = DiBag.fromFactory(() => Promise.resolve({ url: 'memory:' }), { acquisitionMode: 'raw' });
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

**When:** `fork` or `createScope` reports
`override value is not assignable to the original token: <keys>; see https://dany-fedorov.github.io/di-bag/agent/errors.html#wrong-override`,
or a plain `Type 'X' is not assignable to type 'Y'` on an override factory.

**Cause:** an override's service value is not assignable to the type the
original registration declares for that key. A fork or scope substitutes a
service but cannot change its contract, and its consumers are typed against the
original.

**Fix:** return the original service type (or a subtype) from the override. To
change the contract, change the registration in the builder and call `buildContainer()` again.

```ts
// expect-error: Type 'string' is not assignable to type 'number'
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder().withServices({ port: () => 80 }).buildContainer();
app.fork(['port'], { port: () => 'eighty' });
```

**Recipe:** [write a fixture test with `fork`](recipes.md#fixture-test).

## Runtime codes {#runtime-codes}

### DI_BAG_CLASSIFIER_REQUIRED {#di-bag-classifier-required}

**When:** `buildContainer()` completes a graph on a host without
`process.getBuiltinModule`: browsers, Web Workers, and other non-Node runtimes.
Node, Bun, and Deno never raise it.

**Cause:** a registration uses automatic acquisition, no native-Promise classifier
is configured, and the host offers none. The message and `details.bindings` name
every such registration, sorted, with private module services as `<label>/<key>`;
a direct `transformService` without an `acquisitionMode` counts under its
registration's name.

**Fix:** add each named service with `DiBag.fromSyncFactory` or
`DiBag.fromAsyncFactory`; give `fromFunction`, `fromClass`, and direct
`transformService` an explicit `acquisitionMode`; or configure a trusted
classifier with `withConfiguration({ runtime: { isNativePromise } })`.

```ts
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder()
  .withServices({
    answer: DiBag.fromSyncFactory(() => 42),
    later: DiBag.fromAsyncFactory(async ({ answer }: { answer: number }) => answer * 2),
  })
  .buildContainer();
```

**Recipe:** [make a graph portable to browsers and workers](recipes.md#portable-graph).

### DI_BAG_CLEANUP_AFTER_FACTORY {#di-bag-cleanup-after-factory}

**When:** `factoryContext.pushDisposer(disposer)` throws because the factory that
owns the context has already returned or failed. Its projections may still be
running; the factory is the boundary, not the whole acquisition.

**Cause:** the acquisition context escaped its factory and was called later —
from the service it produced, from a projection of the registration, or from
inside a pushed disposer already running. A context belongs to one running
factory, not to the service it produced.

**Fix:** push inside the factory, immediately after acquiring the resource; own
the returned value with `DiBag.withDisposal`, and give a pushed disposer for that
same value a `reason` check.

```ts
import { DiBag } from 'di-bag';

const handle = DiBag.withDisposal(
  DiBag.fromFactory(async (_dependencies: {}, factoryContext) => {
    const socket = { close: async () => {} };
    factoryContext.pushDisposer(disposerContext => { if (disposerContext.reason !== 'service-disposed') return socket.close(); });
    return socket;
  }, { context: 'acquisition' }),
  socket => socket.close(),
);
```

**Recipe:** [own a resource a factory acquires on the way](recipes.md#partial-acquisition).

### DI_BAG_CLEANUP_FAILED {#di-bag-cleanup-failed}

**When:** `close()` rejects with `DiBagCleanupError` after attempting every
disposer.

**Cause:** one or more disposers threw or rejected. The others still ran and the
bag is closed; `failures` lists `label` and `error` for each.

**Fix:** fix the failing disposer; log the failures where the application closes.

```ts
import { DiBag, DiBagCleanupError } from 'di-bag';

const app = DiBag.createBuilder().withServices({ answer: () => 42 }).buildContainer();
try {
  await app.close();
} catch (error) {
  if (!(error instanceof DiBagCleanupError)) throw error;
  for (const failure of error.failures) console.error(failure.label, failure.error);
}
```

**Recipe:** [add a request-scoped service with cleanup](recipes.md#add-scoped-service).

### DI_BAG_CLOSE_ABORTED {#di-bag-close-aborted}

**When:** `close({ abortSignal })` rejects with `DiBagCloseCancelledError`,
`reason: 'aborted'`, because the signal aborted before cleanup finished.

**Cause:** the caller stopped waiting. Cleanup continues: `details.disposersStillRunning`
names disposers that started and have not finished, `details.acquisitionsStillPending` the
acquisitions close is still draining, and `cause` is the abort reason.

**Fix:** await `cleanupPromise` before exiting when cleanup must complete; fix
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
  await error.cleanupPromise;
}
```

**Recipe:** [add a request-scoped service with cleanup](recipes.md#add-scoped-service).

### DI_BAG_CLOSE_FAILED {#di-bag-close-failed}

**When:** `close()` rejects with an `AggregateError` carrying this code.

**Cause:** closing a child scope or the bag's own acquisitions failed with
something other than disposer failures. `errors` holds each failure, preceded
by a `DiBagCleanupError` when disposers also failed.

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
acquisitions still pending; `cleanupPromise` settles when cleanup ends.

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

**When:** `resolve`, `createScope`, `fork`, or a `lazy` reference is used on a
bag whose `close()` has finished.

**Cause:** application work outlived the bag that serves it. `details.state` is
`'closed'`.

**Fix:** finish or cancel work before closing; give request work its own scope
and close the scope, not the application bag.

```ts
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder().withServices({ answer: () => 42 }).buildContainer();
const scope = app.createScope();
try {
  scope.resolve('answer');
} finally {
  await scope.close();
}
await app.close();
```

**Recipe:** [add a request-scoped service with cleanup](recipes.md#add-scoped-service).

### DI_BAG_CLOSING {#di-bag-closing}

**When:** the same operations as [`DI_BAG_CLOSED`](#di-bag-closed), while
`close()` is still in progress. Also the message of `factoryContext.signal.reason`
after `close()`: an `AbortError` that is the same object for every bag. A
cancelled or failed startup aborts with its own cause instead.

**Cause:** a request, timer, or factory started new resolution after shutdown
began. Only a factory already running when `close()` started may still read its
dependencies.

**Fix:** stop accepting work (close the server, clear timers), await in-flight
work, then call `close()`; see the snippet for `DI_BAG_CLOSED`.

**Recipe:** [add a request-scoped service with cleanup](recipes.md#add-scoped-service).

### DI_BAG_CYCLE {#di-bag-cycle}

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

### DI_BAG_DUPLICATE_METADATA {#di-bag-duplicate-metadata}

**When:** `DiBag.withMetadata(registration, { static })` adds a key the
registration already carries.

**Cause:** two metadata wrappers use the same key.

**Fix:** use distinct, namespaced keys such as `'app:owner'` and `'app:node'`.

```ts
import { DiBag } from 'di-bag';

const service = DiBag.withMetadata(
  DiBag.withMetadata(() => 42, { static: { 'app:owner': 'billing' } }),
  { static: { 'app:node': 'tool' } },
);
```

**Recipe:** none.

### DI_BAG_DUPLICATE_REGISTRATION {#di-bag-duplicate-registration}

**When:** `withServices`, `withServiceAlias`, or `withInstalledModules` adds a public key that already
exists. The compiler reports `withServices and withTokenService introduce new names or typed tokens only`.

**Cause:** two registrations or two installed modules export the same name.

**Fix:** use `withReplacedService(key, factory)` to substitute an implementation; install a
second copy of a module under another name with `renameExport`.

```ts
// expect-error: withServices and withTokenService introduce new names or typed tokens only
import { DiBag } from 'di-bag';

DiBag.createBuilder().withServices({ port: () => 80 }).withServices({ port: () => 81 });
```

```ts
import { DiBag } from 'di-bag';

DiBag.createBuilder().withServices({ port: () => 80 }).withReplacedService('port', () => 81).buildContainer();
```

**Recipe:** [split a feature into a module](recipes.md#split-module).

### DI_BAG_INTERNAL_STATE {#di-bag-internal-state}

**When:** a library invariant failed, for example an acquisition without a
result.

**Cause:** a DI Bag defect, not application code.

**Fix:** report it at https://github.com/dany-fedorov/di-bag/issues with the
stack trace and the smallest graph that reproduces it.

**Recipe:** none.

### DI_BAG_INVALID_ACQUISITION_MODE {#di-bag-invalid-acquisition-mode}

**When:** `fromFactory`, `fromFunction`, `fromClass`, or `transformService`
receives options that are not an object, or an `acquisitionMode` other than
`'auto'`, `'raw'`, or `'nativePromise'`.

**Cause:** a misspelled mode or options computed at runtime.

**Fix:** pass one of the three literals.

```ts
import { DiBag } from 'di-bag';

const handle = DiBag.fromFactory(() => Promise.resolve(1), { acquisitionMode: 'raw' });
```

**Recipe:** [add and consume an async client](recipes.md#async-client).

### DI_BAG_INVALID_ALIAS {#di-bag-invalid-alias}

**When:** `withServiceAlias({ aliasKey: destination, targetServiceKey: 'target' })` names a string target that is not yet
registered. The compiler reports `withServiceAlias requires an existing named target`.

**Cause:** the alias is declared before its named target.

**Fix:** add the target first, or alias a typed token, which may be bound
later.

```ts
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder()
  .withServices({ service: () => ({ port: 8080 }) })
  .withServiceAlias({ aliasKey: 'primary', targetServiceKey: 'service' })
  .buildContainer();
```

**Recipe:** none.

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
  DiBag.createBuilder().withInstalledModules('not a list' as never);
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

### DI_BAG_INVALID_CLEANUP {#di-bag-invalid-cleanup}

**When:** `factoryContext.pushDisposer(disposer)` throws because `disposer` is not a
function.

**Cause:** a value was passed where a disposer callback belongs, usually the
result of calling the release instead of passing it.

**Fix:** pass a function: `factoryContext.pushDisposer(() => socket.close())`, not
`factoryContext.pushDisposer(socket.close())`.

```ts
import { DiBag } from 'di-bag';

const socket = DiBag.fromFactory(async (_dependencies: {}, factoryContext) => {
  const handle = { close: async () => {} };
  factoryContext.pushDisposer(() => handle.close());
  return handle;
}, { context: 'acquisition' });
```

**Recipe:** [own a resource a factory acquires on the way](recipes.md#partial-acquisition).

### DI_BAG_INVALID_CLOSE {#di-bag-invalid-close}

**When:** `close(options)` rejects because options are not
`{ waitTimeoutMs?, abortSignal? }` with a finite positive `waitTimeoutMs` and a genuine
`AbortSignal`. Cleanup does not start.

**Cause:** options computed at runtime, extra keys, or a zero or negative
deadline.

**Fix:** pass only `waitTimeoutMs` and `abortSignal`, or call `close()` without options.

```ts
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder().withServices({ answer: () => 42 }).buildContainer();
await app.close({ waitTimeoutMs: 1_000, abortSignal: AbortSignal.timeout(2_000) });
```

**Recipe:** [add a request-scoped service with cleanup](recipes.md#add-scoped-service).
### DI_BAG_INVALID_CONFIGURATION {#di-bag-invalid-configuration}

**When:** `DiBag.withConfiguration(options)` receives a non-object, `observers`
that is not an array, an observer without both `onEvent` and `onError`, or a
`runtime` without an `isNativePromise` function.

**Cause:** incomplete configuration.

**Fix:** pass both observer callbacks and a function classifier.

```ts
import { DiBag } from 'di-bag';

const observed = DiBag.withConfiguration({
  observers: [{ onEvent: event => console.log(event.kind), onError: ({ error }) => console.error(error) }],
});
```

**Recipe:** none.

### DI_BAG_INVALID_CONSTRUCTOR {#di-bag-invalid-constructor}

**When:** `DiBag.fromClass(dependencies, value)` receives something that cannot
be called with `new`, such as an arrow function.

**Cause:** a function passed where a class is expected.

**Fix:** pass the class; adapt a plain function with `fromFunction`.

```ts
import { DiBag } from 'di-bag';

const portKey = Symbol('port');
const port = DiBag.token(portKey).of<number>();
class Client { constructor(readonly port: number) {} }
const client = DiBag.fromClass([port], Client);
const address = DiBag.fromFunction([port], portNumber => `localhost:${portNumber}`);
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

### DI_BAG_INVALID_EXPORT {#di-bag-invalid-export}

**When:** `buildModule({ exportedServiceKeys, moduleLabel })` receives a non-array key list, a key that is not
registered on that builder, or a `moduleLabel` that is not a non-empty string
(`details.option: 'moduleLabel'`), or `renameExport(old, new)` names a missing export,
a non-string name, or an existing export.

**Cause:** the export list and the registrations disagree.

**Fix:** export only keys the module registers; rename to an unused name.

```ts
import { DiBag } from 'di-bag';

const reports = DiBag.createBuilder().withServices({ service: () => ({ read: () => true }) }).buildModule({ exportedServiceKeys: ['service'] });
const east = reports.renameExport('service', 'eastReports');
```

**Recipe:** [split a feature into a module](recipes.md#split-module).

### DI_BAG_INVALID_FACTORY {#di-bag-invalid-factory}

**When:** `DiBag.fromFactory`, `fromSyncFactory`, or `fromAsyncFactory` receives a
non-function, or a `context` option other than `'acquisition'`; the two portable
helpers also refuse an `acquisitionMode` option, because they fix it themselves.

**Cause:** a value passed where a factory is expected, or a mode passed to a
helper whose name already selects it.

**Fix:** pass a function; use `{ context: 'acquisition' }` to receive the
acquisition context as the second argument; choose `fromSyncFactory` or
`fromAsyncFactory` instead of passing a mode to them.

```ts
import { DiBag } from 'di-bag';

const settings = DiBag.fromFactory(
  async ({ url }: { url: string }, { signal }) => (await fetch(url, { signal })).text(),
  { context: 'acquisition' },
);
```

**Recipe:** [add and consume an async client](recipes.md#async-client).

### DI_BAG_INVALID_FUNCTION {#di-bag-invalid-function}

**When:** `DiBag.fromFunction(dependencies, callback)` receives a non-function.

**Cause:** a value passed where the adapted function is expected.

**Fix:** pass the function; bind methods that need their receiver.

```ts
import { DiBag } from 'di-bag';

const nameKey = Symbol('name');
const name = DiBag.token(nameKey).of<string>();
const greeting = DiBag.fromFunction([name], personName => `Hello, ${personName}`);
```

**Recipe:** none.

### DI_BAG_INVALID_LIFETIME {#di-bag-invalid-lifetime}

**When:** `withLifetime(registration, lifetime, options)` receives a lifetime
other than `'root'`, `'scoped'`, or `'transient'`, unknown options, or
`allowScopedDependencies` on a non-root lifetime or as a non-boolean.

**Cause:** a computed or misspelled policy.

**Fix:** pass a literal lifetime; use `allowScopedDependencies: true` only with
`'root'`.

```ts
import { DiBag } from 'di-bag';

const config = DiBag.withLifetime(() => ({ region: 'eu' }), 'root');
```

**Recipe:** [add and consume an async client](recipes.md#async-client).

### DI_BAG_INVALID_METADATA {#di-bag-invalid-metadata}

**When:** `withMetadata` receives neither `static` nor `dynamic` options, a
non-object static record, a dynamic mode other than `'direct'` or `'awaited'`,
or a `describe` callback that is not a function or does not synchronously return
a plain object.

**Cause:** metadata that is not a plain record.

**Fix:** return a plain object literal from `describe`.

```ts
import { DiBag } from 'di-bag';

const client = DiBag.withMetadata(() => ({ region: 'eu' }), {
  dynamic: { mode: 'direct', describe: exposedClient => ({ 'app:region': exposedClient.region }) },
});
```

**Recipe:** none.

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

### DI_BAG_INVALID_OVERRIDE {#di-bag-invalid-override}

**When:** `fork(keys, overrides)` receives a non-array selection, a non-object
override record, a key that is not registered, or a selected key without an own
override property.

**Cause:** the selection and the override object disagree. The compiler reports
[unknown key](#unknown-key) for literal selections.

**Fix:** list each replaced key once and give it an override.

```ts
import { DiBag } from 'di-bag';

type Clock = { now(): number };
const app = DiBag.createBuilder().withServices({ clock: (): Clock => ({ now: () => 42 }) }).buildContainer();
const testApp = app.fork(['clock'], { clock: () => ({ now: () => 7 }) });
await testApp.close();
```

**Recipe:** [write a fixture test with `fork`](recipes.md#fixture-test).

### DI_BAG_INVALID_PLUGIN_OPTIONS {#di-bag-invalid-plugin-options}

**When:** `DiBag.fromPlugin(dependencies, descriptor, options)` receives options
without an own `acquisitionMode` of `'raw'` or `'nativePromise'`, or without a
`validate` function.

**Cause:** plugin output must be validated and its acquisition mode chosen.

**Fix:** pass both options.

```ts
import { DiBag } from 'di-bag';

type Handler = { handle(text: string): string };
const descriptor: unknown = { apiVersion: 1, create: () => ({ handle: (text: string) => text }) };
const handler = DiBag.fromPlugin([], descriptor, {
  acquisitionMode: 'raw',
  validate: (pluginOutput: unknown): pluginOutput is Handler => typeof pluginOutput === 'object' && pluginOutput !== null && 'handle' in pluginOutput,
});
```

**Recipe:** none.

### DI_BAG_INVALID_REGISTRATION {#di-bag-invalid-registration}

**When:** `withServices` receives a non-object, a record with symbol keys, or a value
that is neither a factory nor a DiBag provider.

**Cause:** a constant registered directly, or tokens mixed into a name record.

**Fix:** wrap values in factories; bind tokens with `withTokenService(token, provider)`.

```ts
import { DiBag } from 'di-bag';

const portKey = Symbol('port');
const port = DiBag.token(portKey).of<number>();
DiBag.createBuilder().withServices({ host: () => 'localhost' }).withTokenService(port, () => 80).buildContainer();
```

**Recipe:** none.

### DI_BAG_INVALID_REPLACEMENT {#di-bag-invalid-replacement}

**When:** `withReplacedService(key, registration)` names a key the builder does not expose.
The compiler reports [unknown key](#unknown-key).

**Cause:** the key is misspelled, not yet registered, or private to a module.

**Fix:** replace an exported or registered key; add a new one with `withServices` instead.

```ts
import { DiBag } from 'di-bag';

DiBag.createBuilder().withServices({ port: () => 80 }).withReplacedService('port', () => 8080).buildContainer();
```

**Recipe:** [write a fixture test with `fork`](recipes.md#fixture-test).

### DI_BAG_INVALID_SCOPE {#di-bag-invalid-scope}

**When:** `createScope` receives more than three arguments, a non-array
selection, a non-object override record, options other than `{ share }`, an
unregistered key, a key both shared and overridden, a shared transient service,
or a selected key without an override.

**Cause:** the selection, overrides, and sharing disagree. The compiler reports
most of these, for example `createScope cannot share transient providers`.

**Fix:** override and share disjoint, registered, non-transient keys.

```ts
import { DiBag } from 'di-bag';

const parent = DiBag.createBuilder()
  .withServices({ config: () => ({ region: 'eu' }), client: () => ({ id: 1 }) })
  .buildContainer();
const child = parent.createScope(['config'], { config: () => ({ region: 'us' }) }, { share: ['client'] });
await parent.close();
```

**Recipe:** [add a request-scoped service with cleanup](recipes.md#add-scoped-service).

### DI_BAG_INVALID_STARTUP {#di-bag-invalid-startup}

**When:** `ensureServicesReady(serviceKeys, options)` receives a list that is not
an array, an unregistered key, an unknown option (the 0.4 names `signal`,
`timeoutMs` and `startupOrder` are unknown), a non-positive `totalTimeoutMs`, a
`maxConcurrentServiceKeys` that is not a positive safe integer, or an
`abortSignal` that is not an `AbortSignal`. No factory runs and the bag stays
open.

**Cause:** keys or options computed at runtime.

**Fix:** pass registered keys and valid options.

```ts
import { DiBag } from 'di-bag';

const app = await DiBag.createBuilder()
  .withServices({ settings: async () => 'ready' })
  .buildContainer()
  .ensureServicesReady(['settings'], { totalTimeoutMs: 5_000, maxConcurrentServiceKeys: 1 });
await app.close();
```

**Recipe:** [add and consume an async client](recipes.md#async-client).

### DI_BAG_INVALID_TOKEN {#di-bag-invalid-token}

**When:** `DiBag.token(key)` receives a non-symbol, a token argument is a copied
or fabricated object, or a dependency list is not an array.

**Cause:** token identity comes from the handle `token(key).of()` returns, not
from its shape.

**Fix:** declare the symbol and token once, export the token, and import it
wherever it is used.

```ts
import { DiBag } from 'di-bag';

const clockKey = Symbol('clock');
export const clock = DiBag.token(clockKey).of<{ now(): number }>();
```

**Recipe:** none.

### DI_BAG_INVALID_TRANSFORM {#di-bag-invalid-transform}

**When:** `transformService(registration, options)` receives a mode other than
`'direct'` or `'awaited'`, no `transform` function, or `acquisitionMode` with
`'awaited'`.

**Cause:** options that do not match the transform mode.

**Fix:** pass `acquisitionMode` only with `'direct'`.

```ts
import { DiBag } from 'di-bag';

const upper = DiBag.transformService(async () => 'ready', { mode: 'awaited', transform: text => text.toUpperCase() });
```

**Recipe:** none.

### DI_BAG_LIFETIME_DEPENDENCY {#di-bag-lifetime-dependency}

**When:** a `root` service resolves a `scoped` dependency at runtime;
`details.consumer` and `details.dependency` name both.

**Cause:** the [root capture](#root-capture) check was bypassed by a cast or
untyped code.

**Fix:** as for root capture: make the dependency `root`, or the consumer scoped.

**Recipe:** [add and consume an async client](recipes.md#async-client).

### DI_BAG_MISSING_DEPENDENCY {#di-bag-missing-dependency}

**When:** a factory reads a dependency that no registration supplies. The
message is `Cannot resolve "<consumer>": dependency "<key>" is not registered`,
and `details.path` is the resolution chain.

**Cause:** a cast, `any`, or JavaScript hid the dependency from the
[missing service](#missing-service) check.

**Fix:** remove the cast so the compiler reports the key, then add it with `withServices`.

**Recipe:** [debug a missing-dependency rejection](recipes.md#debug-missing-dependency).

### DI_BAG_MISSING_REGISTRATION {#di-bag-missing-registration}

**When:** `resolve(key)` names a key the bag does not expose; the message is
`Service "<key>" is not registered`.

**Cause:** a key computed at runtime or cast to a registered name; module
private names are not public.

**Fix:** resolve literal exported keys; `bag.inspectGraph()` lists each binding's
public keys.

```ts
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder().withServices({ port: () => 80 }).buildContainer();
const keys = app.inspectGraph().bindings.flatMap(binding => binding.keys);
```

**Recipe:** [debug a missing-dependency rejection](recipes.md#debug-missing-dependency).

### DI_BAG_PLUGIN_VALIDATION {#di-bag-plugin-validation}

**When:** a `fromPlugin` provider acquires; `DiBagPluginValidationError` with
`phase: 'descriptor'` or `'output'` and a `reason`.

**Cause:** the descriptor lacks own `apiVersion: 1` and a callable `create`, or
`validate` did not return exactly `true` for the output.

**Fix:** correct the plugin, or reject it before registering; see
[`DI_BAG_INVALID_PLUGIN_OPTIONS`](#di-bag-invalid-plugin-options) for a valid
descriptor.

**Recipe:** none.

### DI_BAG_SERVICE_READINESS_CANCELLED {#di-bag-service-readiness-cancelled}

**When:** `ensureServicesReady` rejects with `DiBagServiceReadinessCancelledError`,
`reason` `'aborted'` or `'timeout'`.

**Cause:** `abortSignal` aborted or `totalTimeoutMs` elapsed before the listed
services were ready. This bag is closing. `details.acquisitionsStillPending`
names the services that were not ready yet, `details.disposersStillRunning` the
disposers that had started.

**Fix:** await `disposalPromise` before exiting; fix or speed up the named
service, and make slow factories honor the acquisition `signal`.

```ts
import { DiBag, DiBagServiceReadinessCancelledError } from 'di-bag';

const bag = DiBag.createBuilder().withServices({ settings: async () => 'ready' }).buildContainer();
try {
  await bag.ensureServicesReady(['settings'], { totalTimeoutMs: 5_000 });
  await bag.close();
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
this bag has closed.

**Cause:** a listed service or one of its dependencies failed to acquire;
`cause` is that error and `disposalFailures` lists disposers that failed while
the bag closed. A child scope closes only itself, never its parent.

**Fix:** fix `cause`, then build a new bag, or create a new scope, and call
`ensureServicesReady` again.

```ts
import { DiBag, DiBagServiceReadinessError } from 'di-bag';

const bag = DiBag.createBuilder().withServices({ settings: async () => 'ready' }).buildContainer();
const app = await bag.ensureServicesReady(['settings']).catch((error: unknown) => {
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

### DI_BAG_STRUCTURAL_THENABLE {#di-bag-structural-thenable}

**When:** a factory with automatic or native acquisition returns a non-Promise
object with a callable `then`; a `TypeError` with `details.acquisitionMode`.

**Cause:** the compile-time [structural thenable](#structural-thenable) check was
disabled through `DiBagPolicy` or bypassed by a cast.

**Fix:** as for the compile-time message: return a native Promise or use
`acquisitionMode: 'raw'`.

**Recipe:** [add and consume an async client](recipes.md#async-client).

### DI_BAG_WRONG_TOKEN_KIND {#di-bag-wrong-token-kind}

A genuine typed token was used in an operation that requires the other token kind. A token is either a single-service token or a collection token and cannot serve both roles. Read `details.operation`, `details.expectedKind`, and `details.receivedKind`; create the token with `.of<Service>()` for one service or `.forCollectionOf<Item>()` for a collection. Split an old token that used both channels into two tokens.
