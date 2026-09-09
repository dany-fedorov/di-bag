# DI Bag

A small dependency bag for service factories, with inferred requirements,
lazy resolution, scoped forks, and optional disposal. Zero runtime dependencies.

The [enterprise DI comparison](docs/research/2026-09-09-enterprise-parity.md)
maps its capabilities to NestJS, Angular and established containers. See the
[integration guide](docs/guides/enterprise-integration.md) for tested request
scope ownership, checked test substitutions and dynamic feature lifecycles.

## Compose services

```ts
import { DiBag } from 'di-bag/node';

const bag = DiBag.begin()
  .add({
    stamp: ({ clock }: { clock: { now(): number } }) => clock.now(),
  })
  .add({
    clock: () => ({ now: () => 42 }),
  })
  .end();

const stamp: number = bag.resolve('stamp'); // 42, synchronous
```

A factory's parameter type declares its dependencies. There is no separate
dependency-key list. Registration order does not matter: `.add()` checks all
known dependency shapes, including consumers registered earlier, and `.end()`
rejects missing factories at compile time. Values are created lazily and cached
once per bag, including `undefined` values and in-flight promises.

Factories are ordinary functions; the bag calls them without a `this` binding.
A factory requiring a receiver is rejected. Builders are immutable: `.add(map)`
introduces new tokens and rejects duplicates. Use `.replace(key, registration)`
to replace one existing literal key after checking all known consumers:

```ts
const builder = DiBag.begin().add({ clock: () => 42 });
const changed = builder.replace('clock', () => 'ready').end();
changed.resolve('clock'); // string; no existing consumer requires a number
```

Replacement can change a service's type when its consumers remain compatible.
Forward dependencies remain allowed until `.end()`.

The `di-bag/node` facade supplies native-Promise classification for Node and Bun.
It shares tokens, modules and provider descriptions with the host-independent
root entry. Other runtimes can configure an application-local facade once:

```ts
import { DiBag as CoreDiBag } from 'di-bag';
const DiBag = CoreDiBag.configure({ isNativePromise: trustedHostPredicate });
```

The callback must be a trustworthy host native-Promise predicate, not a structural
thenable test or an `instanceof` check. TypeScript cannot prove native branding.
No standard predicate is assumed available and no global configuration changes.
The context follows builders, bags and forks. Without a predicate, `.end()` checks
the entire graph, including private modules, and rejects automatic stages before
any factory runs. Portable applications can instead declare each stage explicitly:

```ts
const resource = CoreDiBag.factory(() => ({ id: 7 }), { acquisition: 'raw' });
const portable = CoreDiBag.begin().add({ resource }).end();
```

`factory` selects acquisition behavior without transferring ownership. `raw`
accepts the exact return value without inspecting `then`; `native` observes native
fulfillment while exposing the exact returned Promise; `auto` uses the configured
predicate. `fromTokens` and `mapSync` accept the same acquisition option for their
new output stage. Earlier stages and their disposers retain their own modes.

Factories may be declared inline or separately, and returned services may use
ordinary object methods. `.add()`, `.replace()`, and `.fork()` preserve their inferred
return types without needing a separate declaration or return-type annotation.

## Reuse named modules

```ts
const feature = DiBag.module().add({
  connection: () => ({ open: true }),
  service: ({ connection, logger }: {
    connection: { open: boolean }; logger: { log(message: string): void };
  }) => ({ read() { logger.log('read'); return connection.open; } }),
  handler: ({ service }: { service: { read(): boolean } }) => () => service.read(),
}).exports(['service', 'handler']);

const root = DiBag.begin().install(feature).add({
  logger: () => ({ log(message: string) { console.log(message); } }),
}).end();
```

`DiBag.module()` is an immutable, non-resolving builder with checked `add` and
singleton `replace`. `.exports(keys)` seals a nominal module. Only the selected
names become public slots; `connection` stays private to the installation.
Use an inline tuple or `as const` tuple with individually known names. Empty
exports are allowed. All local providers retain their external requirements,
including unexported providers that no exported factory currently reaches.
Later host additions or other modules can satisfy forward requirements before
`.end()`. Duplicate exports reject before changing either input.

`feature.rename('service', 'otherService')` creates a new export view without
changing factory parameter names. Rename every exported name to install the
same module twice in one host. Each installation allocates independent private
bindings and owns its own acquired resources. A new public name may equal a
private name; the original private and exported identities stay distinct.
Unrelated external requirement names do not change during renaming.

Host `replace` and bag `fork` overrides are visible to the module's own consumers
of exported services, including private consumers. Their dependency contracts
remain checked through installation, renaming, replacement, and finalization.
Forks start with fresh instances and ownership for the entire graph, including
private module providers; close each fork separately.

`ModuleProvides<M>` and `ModuleRequires<M>` expose readonly views of a module's
exports and external requirements. Module values are invariant and cannot be
constructed from descriptors or spreads. Inferred modules also retain the
private consumers' requirements of replaceable public slots. Use `typeof feature`
or a function's `ReturnType` when annotating one of these modules or its installed
builder/bag. The optional third `Module<P, R, C, D>` parameter and second `Bag<R, C>`
parameter retain these contracts; their empty defaults cannot erase them.
Consequently `Module<P, R>` and plain `Bag<R>` annotations reject values carrying
nonempty retained constraints. Plain bags can still use `Bag<R>`.

An inline async fork override may depend on a richer service returned by another
selected inline override. TypeScript 6.0.3 infers both exact service shapes while
checking their shared dependency view, and preserves the Promise-valued result;
no separate override declaration, return annotation, or cast is needed.

Run `bun run examples/modules.ts` for a runnable two-module composition with
cleanup and an exported service override.

## Use typed tokens for explicit positional injection

Named factories declare dependencies with one finite object parameter. Typed
tokens instead pair a caller-declared `const` symbol with an invariant service
contract and list dependencies explicitly:

```ts
export const clockKey = Symbol('clock');
export const clock = DiBag.token(clockKey).of<{ now(): number }>();

const stamp = DiBag.fromTokens([clock], selectedClock => selectedClock.now());
const bag = DiBag.begin().bind(clock, () => ({ now: () => 42 }))
  .add({ stamp }).end();
const result: number = bag.resolve('stamp');
```

The tuple passed to `fromTokens` is the dependency declaration and positional
argument order. It must be a finite tuple of individually known genuine tokens;
the bag does not parse parameter names or infer a token list from callback text.
Arguments are acquired without awaiting them. A `Promise<T>` token supplies the
same raw Promise object to the callback, and a synchronous callback remains
synchronous. Await only at an explicit async factory, `mapAsync`, or async box
adapter boundary.

Token identity includes both the unique symbol key and its exact service
declaration. Rewrapping the same key with the same service is compatible. The
same key rewrapped as a wider or narrower service is not: token contracts are
invariant even when one provider output happens to fit both service types.
Export canonical keys and tokens from the module that owns the contract. Two
independent `Symbol('name')` calls remain separate, while `Symbol.for('name')`
returns one runtime key and therefore collides with an existing binding even if
different handles were created.

`.bind(token, registration)` preserves a provider's output, static metadata,
acquisition frames, ownership stages, named requirements, and token requirements.
Provider handles remain reusable inputs; every binding is still a normal lazy,
per-bag cache slot, so reuse does not implicitly share an acquired instance.
Within a named module, an unexported bound token is private and receives a fresh
binding per installation. An exported bound token becomes a public slot. A token
selected by `fromTokens` but not bound locally is an external requirement that
the host must satisfy before `.end()`.

Public tokens participate in module consumers just like public names. Override
one in a fork with both an explicit token selection and the symbol-keyed own
property:

```ts
const child = bag.fork([clock], {
  [clockKey]: () => ({ now: () => 7 }),
});
```

Only selected own keys are read. An exported-token override is visible to the
module's private consumers, and the fork owns an independent graph; close it
separately. Run `bun run examples/tokens.ts` for canonical exports, a private
owned token, a public override, plain service values, and both close barriers.

`Provider<F, M, A, G>` uses its fourth invariant contract to retain required and
bound token identities. Its default `G` is an empty token graph, so existing
short `Provider<F>`, `Provider<F, M>`, and `Provider<F, M, A>` annotations remain
valid for token-free providers. Such a default is not an erasure mechanism:
providers with nonempty or opaque token graphs reject those shorter annotations.
For portable inferred library declarations, the supporting `Binding`,
`TokenGraph`, `From`, `Provided`, and `PublicProviders` types are available as
type-only root exports.

`Module<P, R, C, D>` still has four contracts. `D` has the zero-needs public
projection, including provider metadata, frames, and bound-token contracts.
`C` retains exported or external requirements of every local consumer,
including private consumers; already-satisfied private requirements do not
become host constraints. Preserve inferred module types with `typeof` or
`ReturnType`; shorter annotations cannot erase nonempty retained contracts.

Runtime authentication and missing-binding checks still protect JavaScript and
dynamic boundaries, but they are not compile-time proofs. Casts, erased provider
or module types, widened selections, and dynamically unknown plugins can bypass
or lack static evidence. Typed tokens complement named composition; they do not
make every dynamic graph universally type safe. A validated dynamic-plugin
boundary remains planned work.

## Adapt classes and positional functions

Use typed token tuples to pass services to existing constructors and functions:

```ts
class Client {
  constructor(readonly port: number) {}
}
function address(client: Client, host: string) {
  return `${host}:${client.port}`;
}
const portKey = Symbol('port');
const clientKey = Symbol('client');
const hostKey = Symbol('host');
const port = DiBag.token(portKey).of<number>();
const client = DiBag.token(clientKey).of<Client>();
const host = DiBag.token(hostKey).of<string>();

const bag = DiBag.begin()
  .bind(port, () => 8080)
  .bind(client, DiBag.fromClass([port], Client))
  .bind(host, () => 'localhost')
  .add({ address: DiBag.fromFunction([client, host], address) })
  .end();
bag.resolve('address'); // 'localhost:8080'
await bag.close();
```

The selected service tuple must match the declared parameter types and arity,
including optional and rest parameters. Constructors retain prototypes, private
fields and `new.target`. Adapters snapshot tokens and create nothing until
acquisition. Bind a method explicitly if it needs a receiver, for example
`DiBag.fromFunction([port], settings.format.bind(settings))`.

Arguments and returned Promises keep their identity. Options follow the existing
`{ acquisition: 'auto' | 'raw' | 'native' }` modes; use `raw` for deliberate
structural thenable values. Metadata, lifetime, projection and disposal wrappers
apply normally. A class with a method named `close` is still borrowed until an
explicit `withDisposal` wrapper transfers ownership. `fromTokens` remains available
for existing callback adapters. See [`examples/composition.ts`](examples/composition.ts).

## Declare optional and lazy dependencies

All three positional adapters accept `DiBag.optional(token)` and
`DiBag.lazy(token)` alongside ordinary tokens:

```ts
class Reporter {
  constructor(
    private readonly getPort: () => number,
    private readonly host: string | undefined,
  ) {}
  address() { return `${this.host ?? 'localhost'}:${this.getPort()}`; }
}

const reporter = DiBag.fromClass([DiBag.lazy(port), DiBag.optional(host)], Reporter);
const bag = DiBag.begin().bind(port, () => 8080).add({ reporter }).end();
bag.resolve('reporter').address(); // 'localhost:8080'; host was not bound
await bag.close();
```

An optional reference supplies `Service | undefined`. Only an absent binding
produces absence: a present `undefined` service is still acquired and owned,
and acquisition failures retain their normal behavior. A present binding must
match the token's contract. Optional function parameters alone do not make a
declared graph dependency optional.

A lazy reference supplies `() => Service` and acquires its target on each call.
The target must still exist in the completed graph. Scoped/root targets retain
their cache, transients create a new acquisition per call, and dependency edges
are recorded when called. The function retains its provider's graph, context and
shutdown admission rules, including parent ownership after selected sharing.
Calling it after that owner closes throws. Root-captive checks still apply.

References preserve exact Promise values and add no ownership or implicit
awaiting. They wrap one genuine token, cannot be nested, and cannot be used as
binding identities. The adapter snapshots their tuple just as it does ordinary
tokens.

## Give a dependency another lookup name

Use `.alias(destination, target)` on a builder or module builder:

```ts
const bag = DiBag.begin()
  .add({ service: () => new Client(8080) })
  .alias('primary', 'service')
  .alias(client, 'primary')
  .end();

bag.resolve(client) === bag.resolve('service'); // true
await bag.close();
```

Both arguments can be a singleton name or genuine token. The destination must be
new. A named target must already exist so its output can be inferred; a token
target may be supplied later or by a module host, and completion still checks its
binding. An alias to a token promises that token's declared service type. A token
destination must accept that output.

Aliases resolve the canonical target acquisition without creating another cache,
attempt or owner. They preserve scoped/root identity, exact Promises, startup
readiness and per-call transient behavior. Cleanup runs for the target's declared
owners. Explicit raw/native targets retain those modes through aliases.

Private module targets and export renames retain their lexical graph. Replacing
a target affects aliases in that graph; overriding an alias destination replaces
that destination independently. A selected shared alias uses the parent's target
and context even when the child overrides that target. Transient targets cannot
be shared through an alias, and root-captive checks follow alias chains.

`bag.inspect(alias).alias` identifies the direct target by binding ID and label in
the effective owner graph. Its acquisition snapshots follow the canonical target.
Alias metadata types are conservative because replacing a target can change its
metadata. To project a value or add a disposer, declare an ordinary provider that
reads the dependency.

## Compose an ordered collection

Use `.contribute(token, registration)` to append providers under a token's service
contract, and `.resolveAll(token)` to read the collection:

```ts
type Step = (text: string) => string;
const stepKey = Symbol('pipeline step');
const step = DiBag.token(stepKey).of<Step>();
const feature = DiBag.module()
  .add({ prefix: () => 'Hello, ' })
  .contribute(step, ({ prefix }: { prefix: string }): Step => text => prefix + text)
  .exports([]);

const bag = DiBag.begin()
  .contribute(step, (): Step => text => text.trim())
  .install(feature)
  .contribute(step, (): Step => text => text + '!')
  .add({
    pipeline: DiBag.fromFunction([DiBag.all(step)], operations =>
      (text: string) => operations.reduce((value, operation) => operation(value), text)),
  })
  .end();

bag.resolve('pipeline')('  DI  '); // 'Hello, DI!'
bag.resolveAll(step); // readonly Step[] in declaration/installation order
await bag.close();
```

Contributions and singular bindings have separate lookup channels. `.bind`
does not add an item, and a contribution does not satisfy `.resolve(step)`. An
empty collection returns an empty array. Every read returns a fresh frozen array;
the service objects themselves retain their identity and mutability.

`DiBag.all(token)` supplies that readonly array to `fromTokens`, `fromFunction` or
`fromClass`. It wraps one genuine token, cannot be nested with another dependency
reference, and permits an absent collection. Each present contribution must match
the token's service contract and retain its own checked dependencies.

A module's explicit contributions are installed even when `.exports([])` selects
no ordinary services. Contributors can use module-private helpers, and ordinary
export renames retain their lexical dependencies. `ModuleContributions<typeof
feature>` exposes readonly collection service contracts separately from
`ModuleProvides`. Host operations and module installation/declaration order define
item order. Repeating a provider or module creates distinct contribution bindings;
there is no deduplication.

Each contribution keeps ordinary root/scoped/transient caching, exact Promise
mode, acquisition context and cleanup ownership. Collection reads preserve the
exposed values without awaiting them or adding an aggregate owner. A partial
failure propagates the original error; accepted items remain owned until normal
shutdown, and a retry can reuse them. Startup failure keeps its existing rollback
policy. A contributor reading its own collection participates in cycle detection.

To share a collection with a child, select an ordinary aggregate provider such as
`pipeline` above in the existing scope `share` option. It keeps the parent's whole
acquisition and graph. Direct child collection reads follow normal child overrides
and lifetime routing. Strict roots check every present contribution and dependency.
`bag.inspectAll(token)` returns frozen ordered snapshots without acquiring items;
collection metadata types remain conservative.

Run [`examples/contributions.ts`](examples/contributions.ts) for the complete
private-module extension pipeline.

## Attach metadata and inspect without resolving

```ts
const service = DiBag.withMetadata(
  ({ clock }: { clock: { now(): number } }) => ({ read: () => clock.now() }),
  { 'app:owner': { team: 'platform' } },
);
const feature = DiBag.module().add({ service }).exports(['service']);
const bag = DiBag.begin().install(feature.rename('service', 'client'))
  .add({ clock: () => ({ now: () => 42 }) }).end();

const before = bag.inspect('client'); // Does not call either factory.
const team: string = before.metadata['app:owner'].team;
before.acquisitions; // []
bag.resolve('client').read(); // 42
bag.inspect('client').acquisitions[0]?.state; // 'ready'
await bag.close();
bag.inspect('client').acquisitions; // []; static metadata is still available.
```

`withMetadata` accepts ordinary factories, disposal handles, and existing typed
providers. It preserves exact synchronous/Promise outputs, dependencies, and
the source's explicit ownership declaration. It snapshots all own metadata keys,
including non-enumerable keys, and freezes the record. Payload objects keep their
identity and remain unfrozen. Repeated calls add new keys: visible duplicates fail
type checking, and every own collision is checked before any metadata getter runs.
Choose application-specific string or unique-symbol keys; no punctuation format
is required. Numeric keys and widened string/symbol indices are rejected statically.

Inspection is a frozen snapshot with `bindingId`, `label`, `metadata`, and
`acquisitions`. Each acquisition has `acquisitionId`, `state`, and an ordered
`metadata` tuple of presence records. Plain providers currently have empty tuples.
Snapshots contain no service values or mutable runtime collections, and remain
unchanged as attempts settle or retry. Failed attempts are evicted; inspection
does not retain an attempt history. Inspection remains available after close,
when the runtime has released all acquisitions.

`Provider<F, M, A, G>` and its `ProviderOutput`, `ProviderNeeds`, `ProviderMetadata`,
and `ProviderAcquisitionMetadata` utilities are type-only exports. Provider handles
are immutable and nominal; spreads and forged objects cannot be registered.
`Presence<T>`, `FramePresenceTuple<A>`, `AcquisitionSnapshot<A>`, and
`InspectionSnapshot<M, A>` expose readonly snapshot contracts without a box dependency.

Module export, rename, and install retain metadata through the fourth `D` carrier
of `Module<P, R, C, D>`. Its synthetic public registrations expose no private
dependencies; `C` separately retains all consumer requirements. Use `typeof`
or `ReturnType` to preserve complete inferred module annotations. An annotation
cannot erase nonempty metadata or acquisition-frame contracts. Modules with empty
metadata and frames keep the existing synthetic defaults and annotation support.

## Observe lifecycle transitions

```ts
const observed = DiBag.observe({
  onEvent(event) { console.log(event.kind, event.scopeId); },
  onError({ event, error }) { console.error('Telemetry failed', event.kind, error); },
});
const bag = observed.begin().add({ answer: () => 42 }).end();
bag.resolve('answer'); // 42
await bag.close();
```

Both callbacks are required. `observe` returns a new facade; repeated calls append
observers, and `configure` preserves them. Existing facades, builders and bags keep
their earlier configuration. Observation on `di-bag/node` retains native Promise
classification. The portable core still requires explicit acquisition modes or a
configured classifier.

`LifecycleEvent` is a frozen union narrowed by `kind`. Scope events are
`scope-opened`, `scope-closing`, `scope-closed` and `scope-close-failed`. They carry
`scopeId` and, for tracked children, `parentScopeId`. Acquisition events are
`acquisition-started`, `acquisition-ready` and `acquisition-failed`. Cleanup emits
`cleanup-started`, per-disposer `cleanup-failed`, and `cleanup-completed` with an
`outcome` of `'success'` or `'failure'`. Acquisition and cleanup events carry the
owner's `scopeId`, canonical `bindingId` and `acquisitionId`, `label`, `lifetime`,
copied static `metadata`, and copied frame-presence records in `frames`. Failures
retain the original `error`; cleanup failures also identify `disposalIndex`.

Aliases retain their target's attempt, shared acquisitions report their actual
owner, and each contribution or transient acquisition has its own identity.
Readiness describes the exposed final stage: raw Promise values are immediately
ready as values, while native stages report their final settlement. Observation
preserves service and Promise identity and adds no cleanup ownership. Frozen
snapshots leave application-owned metadata and error payloads untouched.

Callbacks run in emission and registration order on a microtask queue, outside
synchronous factory execution. Throws and rejected callback results reach that
observer's `onError` as a frozen `ObserverFailure`; failures in `onError` are
consumed without recursive reporting. Callback work never gates resolution,
startup or shutdown. Applications own completion of asynchronous logging; a
resolved `close()` does not promise that telemetry has finished. See
[`examples/observers.ts`](examples/observers.ts) for an application-owned completion
barrier and cleanup assertions.

## Admit an application-selected plugin

Use `DiBag.fromPlugin(dependencies, descriptor, { acquisition, validate })` when
the application selects unknown code and needs one checked provider boundary. The
application chooses the module/export and passes its descriptor; DI Bag does not
load paths or infer a default export. A descriptor must have own `apiVersion: 1`
and `create` fields, with an optional own callable `dispose`. Required inherited
fields, arrays, `null`, present `undefined` disposal, and malformed versions fail
with `DiBagPluginError` whose `phase` is `'descriptor'`.

```ts
interface Handler { handle(text: string): string }
const handler = DiBag.token(Symbol('handler')).of<Handler>();
const selected: unknown = {
  apiVersion: 1,
  create: () => ({ handle: (text: string) => text.toUpperCase() }),
};
const provider = DiBag.fromPlugin([], selected, {
  acquisition: 'raw',
  validate: (value: unknown): value is Handler =>
    typeof value === 'object' && value !== null && 'handle' in value
    && typeof value.handle === 'function',
});
const feature = DiBag.module().bind(handler, provider).exports([handler]);
const bag = DiBag.begin().install(feature).end();
```

Both options are required. `raw` validates and exposes the exact factory return
value synchronously, including a Promise or thenable. `native` requires a genuine
native source Promise and exposes one stable final Promise after its fulfilled
value passes validation. The predicate must synchronously return exactly `true`;
a false result, Promise, thenable, or thrown error does not become a service.
False/non-boolean validation produces `DiBagPluginError` with `phase: 'output'`.

Dependencies use the existing required, optional, lazy, and all reference
handles, so the adapter receives only its declared host values in positional
order. Descriptor callbacks, the predicate, and dependency tuple are captured at
adapter construction. Later mutation cannot change the provider. An optional
plugin disposer owns the original acquired value before result validation: a
failed validator still releases that original value exactly once during rollback
or close. Validation admits a service at this boundary; it does not sandbox
unknown code or continuously prove mutable behavior. Run
[`examples/plugins.ts`](examples/plugins.ts) for typed module composition,
unknown descriptor selection, validation, and cleanup.

## Async edges are explicit

```ts
const bag = DiBag.begin()
  .add({
    number: async () => 21,
    answer: async ({ number }: { number: Promise<number> }) =>
      (await number) * 2,
    synchronous: () => 'ready',
  })
  .end();

const answer: Promise<number> = bag.resolve('answer');
console.log(await answer); // 42
console.log(bag.resolve('synchronous')); // 'ready', not a promise
```

The bag preserves each factory's return type. An async dependency must be
declared as a promise and explicitly awaited by its consumer. Declaring
`number: number` in the example is a compile-time error. No transparent
awaiting or conversion of synchronous factories takes place.

Concurrent resolutions share a promise. A thrown factory error or rejected
factory promise is evicted so later resolution can retry. Every attempt has its
own identity: when a dependency fails, its incoming consumer edges are abandoned.
The failed attempt retains its outgoing dependencies and any pending work or
accepted ownership needed for cleanup; none of those redirect to a later retry.
Dependency cycles throw or reject with a path such as `cycle: a -> b -> a`, including dependency
reads after `await`.

## Project services explicitly

`DiBag.mapSync(registration, project)` passes the exact source value to a
receiver-free projector and exposes its exact return value. A Promise stays a
Promise with its original identity. `DiBag.mapAsync(registration, project)`
explicitly awaits the source and the projector result, always exposing
`Promise<Awaited<ReturnType<typeof project>>>`. Source and projector throws become
rejections at this asynchronous boundary. Both helpers preserve dependencies and
static metadata; they invoke the source once per acquisition attempt.

```ts
const connection = DiBag.withDisposal(openConnection, value => value.close());
const client = DiBag.withDisposal(
  DiBag.mapAsync(connection, value => makeClient(value)),
  value => value.close(),
);
const bag = DiBag.begin().add({ client }).end();
const readyClient = await bag.resolve('client');
await bag.close(); // closes the client, then its original connection
```

Ownership is additive: wrapping a provider with `withDisposal(provider, dispose)`
owns that stage's fulfilled output and retains every earlier disposer with its
original value. Explicitly owning the same object twice runs both finalizers.
Mapping alone never transfers ownership based on a value's cleanup methods.
Disposers, like factories and projectors, run receiver-free; bind a method or use
a closure if it needs an object receiver.

A synchronous projection can expose a usable status object containing a pending
source Promise. That object stays cached even if the raw Promise later rejects.
The source remains tracked, including dependency reads while it is pending.
If a projection fails, its original error reaches the caller and that attempt's
accepted stages are released; separately cached dependencies remain owned by the
bag. A synchronous failure starts cleanup without waiting for asynchronous
disposers. Late ownership is released once, and `close()` drains pending sources,
projections, and retired cleanup before it finishes. Cleanup failures appear in
`DiBagCleanupError` in finalizer invocation order, with original attempt IDs.
Before releasing a failed attempt's stages, cleanup waits for that attempt's
pending source and projectors so they can finish using accepted values.
Nonsettling work therefore retains those values and keeps `close()` pending.

## Attach cleanup with `withDisposal`

```ts
const bag = DiBag.begin()
  .add({
    cache: DiBag.withDisposal(
      () => new Map<string, string>(),
      (cache) => cache.clear(),
    ),
  })
  .end();

try {
  const cache = bag.resolve('cache'); // Map<string, string>
  cache.set('answer', '42');
} finally {
  await bag.close();
}
```

`DiBag.withDisposal(create, dispose)` returns a frozen, nominal registration
handle. Its readonly `create` property retains the exact factory type; disposal
metadata is private. Spreading or cloning a handle does not produce a valid
registration. Call `withDisposal` again to pair a new factory and disposer.
It runs neither callback immediately. Consumers receive the created value
directly. For an async factory, `dispose` receives the fulfilled value;
cleanup itself may return `void` or `Promise<void>`.

Only registrations wrapped in `withDisposal` are owned by the bag. Ordinary
factories can return borrowed objects, even objects exposing `.close()` or
`.dispose()` methods, without transferring ownership. Never-resolved factories
and sources that fail before ownership transfers have no cleanup callback to run.
If a later projection fails after ownership transfers, the failed attempt retains
and disposes its accepted ownership stages; `close()` waits for that cleanup.

Ownership transfers after a synchronous result is successfully classified, or
after a native Promise fulfills. Automatic async tracking observes native Promise
state directly, including subclasses and Promises from another realm, without
invoking an overridden `then` method. A structural thenable returned directly by
a factory is rejected at runtime without invoking its `then` or accepting ownership.
Convert structural thenables explicitly inside the factory:

```ts
const owned = DiBag.withDisposal(
  () => Promise.resolve(legacyThenable),
  resource => resource.close(),
);
```

An async factory also performs standard thenable conversion. Consumers receive
the exact native Promise returned by that factory, and disposal receives its
fulfilled value. TypeScript's structural `PromiseLike` types do not prove native
Promise state. Ordinary synchronous results keep their exact value and type.

If reading `then` or setting up the native observer (including constructor/species)
throws, resolution rethrows that same error and discards the failed cache entry
and dependency edges so a later resolution can retry. Malformed or unobservable
results are not accepted as owned acquisitions: their factories remain
responsible for resources that were not successfully transferred. The bag never
passes an unfulfilled raw PromiseLike to a fulfilled-value disposer. Explicit
ownership of an opaque value uses a raw stage:

```ts
const rawOwned = DiBag.withDisposal(
  DiBag.factory(() => pendingPromise, { acquisition: 'raw' }),
  promise => { /* receives the Promise object itself */ },
);
const fulfilledOwned = DiBag.withDisposal(
  DiBag.factory(() => pendingPromise, { acquisition: 'native' }),
  resource => { /* receives native fulfillment */ },
);
```

Raw ownership deliberately does not wait for a returned Promise. The exported
`ProviderAcquired<R>` type describes the disposer input; `ProviderOutput<R>`
describes the exact exposed service. Metadata, token bindings and modules retain
both contracts. Native modes require Promise-shaped TypeScript outputs and check
native observation at runtime. Mixed ordinary/Promise outputs can use configured
auto, deliberate raw ownership of the union, or producer normalization.

Synchronous sas-box adapters accept `acquisition` separately from capability
`mode`; synchronous required val-box projections accept it separately from
`value`. Presence projections default to raw because their output is an ordinary
presence object, and cannot select native acquisition. Async adapter outputs are
always native and do not accept acquisition selection. Source modes remain
independent of adapter output modes.

`close()` immediately stops public resolution and forking, waits for in-flight
factories and their dependencies, then disposes resources sequentially.
Dependents close before their dependencies; unrelated resources close in reverse
successful acquisition order. This dependency ordering also holds when async
factories complete out of order. The bag waits on its own pending barrier; it
does not consume the native observer's potentially customized species result.

If cleanup throws or rejects, the remaining callbacks still run, then `close()`
rejects with `DiBagCleanupError`, exported from `di-bag`. Its frozen `failures`
array contains frozen records with `acquisitionId`, `bindingId`, `label`, and
the original `error`. The IDs are symbols; a retry has a new acquisition ID.
Its inherited `AggregateError.errors` contains all original causes in cleanup
attempt order, including thrown `undefined`. Repeated calls return the same promise;
cleanup runs once and the bag remains closed even when cleanup fails. Acquisition
failures stay on their resolution promises rather than becoming close errors.

Stop application work before closing. Already-returned services cannot be
revoked, and disposal callbacks must not resolve services or await the same
bag's `close()` promise. A disposer may call `close()` to observe the identical
barrier, but awaiting it would wait on its own completion. Arbitrary user-created
Promise cycles cannot be forcibly completed. Closing aborts acquisition-context
signals before draining work. A factory or disposer that ignores cancellation
and never settles keeps `close()` pending; startup deadlines provide a separate
prompt rejection boundary.

## Start selected services and cancel cooperatively

`builder.start(keys, options?)` is the eager alternative to `.end()`. It creates
a fresh bag and returns `Promise<Bag<...>>` once the selected services are ready.
The same named, token, module and lifetime checks apply, including when the
selection is empty. Unselected services remain lazy unless selected services
request them as dependencies.

```ts
import { DiBag, DiBagStartupCancelledError } from 'di-bag/node';

const builder = DiBag.begin().add({
  url: () => 'https://example.com/settings.json',
  settings: DiBag.withContext(async ({ url }: { url: string }, { signal }) => {
    const response = await fetch(url, { signal });
    return response.text();
  }),
});

try {
  const bag = await builder.start(['settings'], {
    timeoutMs: 5_000,
    concurrency: 'parallel', // default; 'sequential' follows tuple order
  });
  const settings: Promise<string> = bag.resolve('settings');
  console.log(await settings);
  await bag.close();
} catch (error) {
  if (error instanceof DiBagStartupCancelledError) {
    await error.cleanup; // eventual shutdown, including late owned acquisitions
  }
  throw error;
}
```

`DiBag.withContext(callback, options?)` supplies a frozen `AcquisitionContext`
as the callback's second argument. Its first argument declares named dependencies.
The context contains the acquisition owner's `AbortSignal`; no controller is
exposed. Root providers use the root signal even on a child's first request.
Closing a child aborts its signal independently; closing the parent aborts the
live tree after immediately blocking new public resolutions. In-flight factories
can still finish their dependency graph. Ordinary factory signatures are unchanged.

The adapter accepts `{ acquisition: 'raw' | 'native' | 'auto' }`, with automatic
classification as the default. Startup follows the final service stage's declared
acquisition mode. A raw Promise or thenable is already ready, while a native
Promise waits on its observed state without changing its original identity.
A fulfilled projection may be ready while earlier source work is still pending;
shutdown continues to drain that work.

Startup options accept a genuine external `signal`, a finite positive `timeoutMs`,
and `concurrency: 'parallel' | 'sequential'`. A finite tuple selects existing
names/tokens. Parallel mode starts the selections without waiting between them;
sequential mode waits for each one and stops starting later selections on failure.
Duplicate selections follow lifetime policy, including separate transient attempts.
Invalid inputs and already-aborted signals start no factories. Timers and external
signal listeners are removed when startup settles; later external aborts do not
close a successfully started bag.

An acquisition failure closes the new bag before rejecting with
`DiBagStartupError`. Its `cause` is the original acquisition error, its frozen
`cleanupFailures` preserve structured disposal failures, and `cleanupError`
retains the complete shutdown error if one occurred. Abort or deadline expiry
instead rejects promptly with `DiBagStartupCancelledError`: `reason` is `aborted`
or `timeout`, `cause` retains the abort reason or timeout error, and `cleanup`
observes eventual shutdown. Cancellation can interrupt the wait for failure
cleanup too. It cannot forcibly stop uncooperative JavaScript; cleanup may remain
pending if a factory or disposer never settles.

## Choose root, scoped or transient caching

Registrations are scoped by default: one acquisition is cached by each bag that
resolves it. `DiBag.withLifetime` can instead select a root-family cache or a
fresh acquisition for every resolution without changing the factory's input,
output, metadata, acquisition mode, token contracts or disposer value:

```ts
const root = DiBag.begin().add({
  config: DiBag.withLifetime(
    DiBag.withDisposal(() => ({ region: 'eu' }), () => {}),
    'root',
  ),
  request: DiBag.withDisposal(() => ({ id: crypto.randomUUID() }), () => {}),
  nonce: DiBag.withLifetime(
    DiBag.withDisposal(() => ({ value: Math.random() }), () => {}),
    'transient',
  ),
}).end();

const child = root.scope();
child.resolve('config') === root.resolve('config'); // true: family root cache
child.resolve('request') === child.resolve('request'); // true: child cache
child.resolve('nonce') === child.resolve('nonce'); // false: per resolution
```

Lifetime controls caching and which bag owns an acquisition attempt. It does not
infer disposal from a returned method name; only an explicit ownership stage such
as `withDisposal` transfers cleanup responsibility. Root acquisitions belong to
the earliest scope defining that binding, even when a descendant resolves them
first. A root override introduced by a child belongs to that child. Scoped and transient
attempts belong to the scope resolving them, or to the owner of the acquisition
that asks for the dependency. Closing a child therefore leaves family-root
acquisitions live, while closing the root closes descendants first and then
root-owned work.

A root registration cannot depend on a scoped registration by default. The
type checker reports that captive dependency when the graph is completed with
`.end()`, or when selected `fork` replacements complete a new graph. For the
deliberate case, `{ captureScoped: true }` permits only that root boundary:

```ts
const bag = DiBag.begin().add({
  rootContext: () => ({ region: 'eu' }),
  client: DiBag.withLifetime(
    ({ rootContext }: { rootContext: { region: string } }) =>
      ({ region: rootContext.region }),
    'root',
    { captureScoped: true },
  ),
}).end();
```

Explicit capture always constructs through the root context; it never borrows
state already owned by a child. An individually known lifetime literal is
required, and capture options are accepted only for `root`. An outer lifetime
wrapper replaces an earlier caching policy. `fork()` creates an independent
family, so its root cache and ownership are independent too. Forks validate all
root dependencies against the new graph, including after child overrides.

## Create tracked child scopes

```ts
const root = DiBag.begin().add({
  requestId: () => crypto.randomUUID(),
}).end();

const child = root.scope();
root.resolve('requestId');  // cached by the root
child.resolve('requestId'); // a fresh value cached by the child

await root.close(); // closes the child before root-owned resources
```

`scope()` preserves the parent's exact registrations, tokens, module constraints,
metadata and resolved-value types while creating fresh lazy scoped acquisitions
and resource ownership. Root and transient policies follow the rules above. A
parent close synchronously begins closing its live descendant tree;
each child finishes before the parent's own finalizers run. Closing a child
independently leaves its parent and siblings open, and detaches it after that close
settles, so the caller owns any cleanup failure from the independent close.

A child-created `fork()` is still an independent root. It is not tracked by the
child or closed with the parent tree, so close it separately. Use `scope()` for a
tracked child with the same graph, `fork()` for independent ownership, and selected
`fork(keys, overrides)` for an independent graph with explicit replacements.

Select sharing and child overrides explicitly:

```ts
const parent = DiBag.begin().add({
  config: () => ({ region: 'eu' }),
  client: ({ config }: { config: { region: string } }) => ({ region: config.region }),
}).end();
const child = parent.scope(['config'], {
  config: () => ({ region: 'us' }),
}, { share: ['client'] });

child.resolve('config').region; // 'us'
child.resolve('client') === parent.resolve('client'); // true; client retains 'eu'
const grandchild = child.scope({ share: ['client'] });
await parent.close(); // closes descendants, then releases parent-owned work
```

Both tuples accept existing names and genuine typed tokens. Only selected override
properties are read; additional properties cannot change the graph. Override
outputs must remain assignable to the original service contract. Selecting a key
for both sharing and overriding rejects before override getters run.

Sharing is lazy and borrows the parent's whole acquisition: value, pending Promise,
metadata, dependencies, cancellation context and ownership. A shared module export
retains its private dependencies. Child shutdown cannot abort or dispose those
borrowed resources. Scoped sharing must be selected again by each descendant;
root providers are inherited automatically. Transient sharing rejects because
there is no cached parent instance to borrow. A child-defined root override uses
that child's graph and is shared with descendants; inherited roots always keep
their original graph, even when child consumers use overridden dependencies.

## Fork for scopes and tests

```ts
const bag = DiBag.begin()
  .add({
    clock: () => ({ now: () => 42 }),
    stamp: ({ clock }: { clock: { now(): number } }) => clock.now(),
  })
  .end();

const scoped = bag.fork(['clock'], { clock: () => ({ now: () => 7 }) });
scoped.resolve('stamp'); // 7
bag.resolve('stamp'); // 42

await scoped.close();
await bag.close();
```

Forks accept existing tokens only. Overrides must preserve the original value
type, and their dependency requirements are checked against the merged graph.
Pass an inline selection tuple, or a separately declared `as const` tuple.
Widened arrays, optional/variadic tuples, and union-valued elements cannot prove
the exact runtime selection and are rejected. Each selected key must be an own
property of the override object. Unselected properties are ignored, including
getters. Use `bag.fork()` for a fresh bag with equivalent registrations.

The explicit selection is needed because TypeScript uses structural typing:
a variable typed as `{ clock: () => number }` can also contain hidden runtime
keys. A one-map fork could silently overwrite those hidden keys without checking
their types. Explicit selection gives the type checker and runtime the same keys.

Each fork starts with a fresh memo and owns its own created resources. Closing
a parent does not close its forks, or vice versa.

A fork can replace a disposable registration with an ordinary factory to borrow
an externally owned instance, or add disposal to an ordinary registration.
Registering the same shared instance as owned in multiple bags would dispose it
multiple times; use ordinary factories for borrowed instances.

Explicit sharing reuses the whole instance, including its original dependencies.
If a shared service was built with root stores, overriding stores in a batch
does not rebind that service. Let its factory run again when it needs batch stores.

## WBS-shaped ownership example

Run `npm run example:wbs` to see the full
[`examples/wbs-scope.ts`](examples/wbs-scope.ts) demonstration. It models the
composition boundaries proposed for `wbs-tool-v1`: a startup-owned source,
shared clock and replay buffer, scoped store adapters, separate announcement
collectors, and freshly created work-item services.

Sharing is configured at the fork call:

```ts
const batch = root.fork(['source', 'clock', 'replayBuffer', 'stores', 'broadcast'], {
  source: () => root.resolve('source'),
  clock: () => root.resolve('clock'),
  replayBuffer: () => root.resolve('replayBuffer'),
  stores: () => scope.stores,
  broadcast: DiBag.withDisposal(openCollector, (collector) =>
    collector.close(),
  ),
});
```

Startup initiates shutdown: close borrowing batch bags first, then the root bag,
then the source it opened. The example's `stopApplication` attempts every close
and aggregates failures so one failing disposer cannot skip another owner's
cleanup. Its application aggregate retains each bag's `DiBagCleanupError`,
including that scope's acquisition diagnostics. A factory that fails halfway
through acquisition must release what it acquired before rethrowing; the bag
only owns successfully returned values.

The example uses small in-memory adapters. Store writes are immediate; collector
isolation is demonstrated, but transaction rollback and WBS integration are not.
Its tests check actual instance identity, dependency binding, announcement routing,
and shutdown on success, failed work, failed cleanup, and failed acquisition.

## Optional box adapters

Import `fromSasBox` from `di-bag/sas-box` and `fromValBox` / `fromValBoxAsync`
from `di-bag/val-box`. These structural adapters do not install, import, or own
either box library. Core consumers need neither package. Real `SasBox` instances
and `ValBox` instances with `snapshot()` work directly:

```ts
import { DiBag } from 'di-bag/node';
import { fromSasBox } from 'di-bag/sas-box';
import { fromValBoxAsync } from 'di-bag/val-box';
import { SasBox } from 'sas-box';
import { ValBox } from 'val-box';

const service = fromValBoxAsync(fromSasBox(
  () => SasBox.fromAsync(async () => new ValBox.WithValue.WithMetadata(
    { read: () => 42 }, { team: 'platform' }, 'db',
  )),
  { mode: 'sync-first' },
));
const bag = DiBag.begin().add({ service }).end();
const value = await bag.resolve('service');
console.log(value.read());
await bag.close();
```

Sas mode is mandatory. `sync` requires an immediate box with a callable `sync`
and preserves its raw return type and Promise identity. `async` awaits the box
and invokes `async`; `sync-first` awaits the box and prefers callable `sync`,
using `async` when `sync` is undefined. Both asynchronous modes expose a native
`Promise<Awaited<...>>`. Selected methods must take zero required arguments and
accept the acquired box as their receiver. Union modes check every possible
route and retain all possible output types.

`sync-first` requires the complete, required `sync` field in the source type.
A callable field needs no fallback; a field that may be undefined also requires
callable `async`. A view with missing or optional `sync` cannot prove which
capability exists at runtime. Use explicit `async` mode for such a narrowed view.

`fromValBox` snapshots an immediate source once and returns its raw present
value. `fromValBoxAsync` awaits the source and result. An absent value throws by
default; `{ value: 'presence' }` exposes `Presence<T>` instead. Supplied options
must include `value: 'required' | 'presence'`; `{}` is rejected. Present
`undefined` differs from absence, and an empty alias differs from `null`.

Context-sensitive factories returning nested object methods may be passed inline.
TypeScript 6.0.3 preserves the exact payload, empty dependency view, factory and
metadata contracts, including across a second `fromValBox` adaptation and its
ordered acquisition frames. Predeclared forms remain supported.

Every val adapter appends a typed `ValBoxFrame<M>` to
`bag.inspect(key).acquisitions[i].metadata`. Each slot starts as
`{ present: false }`, including during source creation. A completed frame has
`{ kind: 'val-box', metadata: Presence<M>, alias: string | null }`. Presence
records, frames, and copied inspection tuples are frozen; payload objects retain
their identity and mutability. Nested adapters keep frames in acquisition order.
Static metadata, mapping, ownership, module exports, and forks retain these types.

Adapters do not transfer ownership. `fromValBox(DiBag.withDisposal(openBox,
box => box.close()))` owns the raw box and borrows its payload. Wrapping the
adapted provider in another `DiBag.withDisposal` explicitly adds ownership of
the unboxed result, disposed before the raw box. Snapshot or unboxing failures
use ordinary failed-acquisition cleanup. Factories still clean resources they
acquire before returning ownership. Run `bun run examples/box-adapters.ts` for
a dependency-free structural example with separate box and payload owners.

## Boundaries

- Token maps and dependency parameters must have finite string keys. Index
  signatures, including open template keys, cannot prove that tokens exist.
- Bags are created through checked builders and forks. `Bag` is exported as a
  type only; there is no public unchecked constructor.
- Parameters may be omitted or be a single object type. Optional dependency
  properties still require providers. Union, callable, and symbol-keyed
  dependency parameter types are rejected.
- Dependency proxies support named property reads. Do not enumerate, spread,
  or use rest destructuring on them: parameter types are erased at runtime,
  so the bag cannot enumerate a particular factory's declared requirements.
- Use a single, explicit factory signature. TypeScript utility types see the
  last signature of overloaded functions; arbitrary overload behavior cannot
  be inferred. As with other TypeScript APIs, casts and unchecked JavaScript can
  bypass compile-time checks; runtime resolution still checks missing tokens.
- JavaScript output targets ES2022. The CommonJS package supports Node `require`
  and ESM named imports, and browsers through a bundler. Bun is only needed to
  run the development tests. The supported compiler floor and development type
  checks use TypeScript 6.0.3.

## Development

### Package entry points and release-candidate checks

The package manifest declares four entry points: host-independent `di-bag`, the
Node/Bun native-Promise facade `di-bag/node`, and the structural adapters
`di-bag/sas-box` and `di-bag/val-box`. The root and Node entry points do not import
either adapter, and the package has no dependency, peer dependency, optional
dependency, or bundled dependency on either box library. A core-only installation
therefore needs no box package. Applications that use an adapter install and own
the corresponding box implementation themselves.

Choose `raw` when the exact value, Promise, or thenable is the service. Choose
`native` only for a genuine native Promise whose fulfillment is the service. Use
selected scopes to make sharing and overrides explicit. Lifecycle callbacks are
non-blocking observers, so applications separately await telemetry when needed.
Plugin loading remains application-owned: validation admits the output while an
optional plugin disposer retains ownership of the original acquired value.

`npm run check` is the primary source, runtime, declaration, package, and build
gate. Run `npm run typecheck:native`, `npm run build:native`, and
`npm run check:native` as separate native checks. A release candidate additionally
requires the local, offline archive workflow in [`PUBLISHING.md`](PUBLISHING.md).
That workflow records unavailable registry facts rather than claiming a release,
tag, remote commit, publication, or version availability.

```sh
npm install
npm run check          # strict types, runtime/type/package tests, build
npm run check:native   # native 7.0.2 source rejection gate; requires zero message gaps
npm run typecheck:native
npm run build:native
npm run benchmark:types # isolated Node compiler measurements (Node 24+)
npm run benchmark:types -- --native # supervised native named matrix (Linux)
npm run benchmark:types -- --native --tokens # supervised native token matrix (Linux)
node scripts/check-token-scale.ts bindings valid # one isolated 100-token case
npm pack --dry-run    # builds and previews the publication contents
```

CI runs the source, package and both compiler gates on Linux with Node 24.20.0,
npm 11.19.0 and Bun 1.4.0. A separate portable job runs the actual packed root
package in Deno and a minified Chromium Worker. To reproduce that job locally:

```sh
npm ci
npm ci --prefix tools/platform --no-audit --no-fund
export PLAYWRIGHT_BROWSERS_PATH="$PWD/tools/platform/.browsers"
node tools/platform/node_modules/playwright/cli.js install chromium
npm run platform:pin -- --all
npm run check:platform
```

On Linux hosts missing browser system libraries, use Playwright's
[`install --with-deps chromium`](https://playwright.dev/docs/browsers#install-system-dependencies).
`platform:pin` without `--all` captures only the foundation tools. Pinning never
downloads tools: it validates installed versions and writes version-probe entry hashes
to ignored `tools/platform-versions.local.json`. A local manifest takes precedence
over the historical machine-specific manifest; an invalid one fails explicitly.
The private platform tools have their own lockfile and are excluded from the
published package. `check:platform` requires all three lanes to pass, while
`evidence:platform` remains an informational collector that can record unavailable
portable tools. CI configuration is separate from evidence that a run passed.
Evidence also records the platform lockfile hash. A script tool's entry hash
identifies its version-probe wrapper, not every transitive driver/compiler file;
use the locked `npm ci` installation when reproducing the run.

Tests compile positive usage and each negative fixture independently. Package
smoke tests build the distribution and exercise Node's CommonJS and ESM loaders
and TypeScript's emitted-declaration resolution. Distribution files and type
declarations are emitted to `dist/`.

Classic TypeScript 6.0.3 remains the primary compiler. Native 7.0.2 checks the
source and installed declaration contracts. The strict native audit currently
matches every expected diagnostic, including all replacement diagnostics, with
zero reviewed gaps or unexpected diagnostics. The scale matrices allow no
diagnostic exceptions. The native development tests and
supervised reports currently require Linux. Native reports supervise the actual
Linux executable with a 60-second limit, 3,072 MiB sampled child-RSS threshold,
and 4 MiB combined output cap. These are bounded observations, not universal
scale or editor-latency guarantees. See the
[compiler scalability report](docs/reports/2026-09-08-compiler-scalability.md).

Builders accumulate a flat union of registration entries internally; the public
`Bag<R>` type still takes a registration map. Compile-time acceptance tests cover
100 chained additions, 100 replacements, and 1,000 providers assembled from
reusable registration groups and named modules, including missing and
wrong-shaped dependencies. TypeScript 6.0.3 cannot bind an unchanged fluent AST
beyond 550-575 calls under its default stack, so applications at 1,000 providers
must use bulk registration, registration groups of 50, or reusable named
modules. The [compiler benchmark report](docs/benchmarks/typescript.md) records
the passing supported routes and retains every failed original fluent row.

## Performance evidence

Runtime measurements are retained as ordinary-machine **informational**
evidence. Two complete, independently ordered runs compare the measured source
at `8ee8696` with the intrinsic `739b509` baseline built from `git archive`.
Neither run met all review predicates, and neither ran on a marked controlled
host, so they establish no universal speed claim. The raw children, statistics,
package identities and limitations are in the
[runtime evidence directory](docs/benchmarks/results/2026-09-08-8ee8696/README.md).

Repeated compiler controls are also informational and comparable only when the
compiler and fixture identities match. They cover supported controls and do not
replace the exhaustive matrix or its retained failures. See the
[compiler-control evidence](docs/benchmarks/results/2026-09-08-e5456f8/README.md).
Earlier single-observation tables in the
[compiler benchmark history](docs/benchmarks/typescript.md) remain explicitly
**historical**.

Optional third-party measurements require a reviewed adapter that passes the
**restricted common-subset throughput** contract for synchronous named graphs,
singleton and transient resolution, and explicit lifecycle. Typed Inject and
Awilix are **unavailable** because neither package is lockfile-pinned. No
third-party timing row or comparison claim exists. The exact status rows and
admission rules are retained in the
[comparator evidence directory](docs/benchmarks/results/2026-09-08-ad70a14/README.md).

Current code lives in `src/`. Previous experiments are preserved under
[`docs/history/`](docs/history/README.md). The [v0.1 design](docs/superpowers/specs/2026-09-06-v0.1-design.md)
and [implementation plan](docs/superpowers/plans/2026-09-06-v0.1.md) record the
decisions, including the deferred investigation into Effect-style requirement
inference.
