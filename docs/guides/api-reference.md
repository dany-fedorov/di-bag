# Complete API guide

[← Back to the README](../../README.md) · [Server guide](server-integration.md) · [Integration recipes](enterprise-integration.md)

Detailed usage and behavioral contracts for DI Bag. Start with the
[quickstart](../../README.md#quickstart) if you are new to the library.
Examples use `DiBag` from `di-bag/node` unless another entry point is shown.
Run the example commands from the repository root.

## On this page

- [API at a glance](#api-at-a-glance)
- [Compose services](#compose-services)
- [Reuse named modules](#reuse-named-modules)
- [Use typed tokens for explicit positional injection](#use-typed-tokens-for-explicit-positional-injection)
- [Adapt classes and positional functions](#adapt-classes-and-positional-functions)
- [Declare optional and lazy dependencies](#declare-optional-and-lazy-dependencies)
- [Give a dependency another lookup name](#give-a-dependency-another-lookup-name)
- [Compose an ordered collection](#compose-an-ordered-collection)
- [Attach metadata and inspect without resolving](#attach-metadata-and-inspect-without-resolving)
- [Observe lifecycle transitions](#observe-lifecycle-transitions)
- [Admit an application-selected plugin](#admit-an-application-selected-plugin)
- [Async edges are explicit](#async-edges-are-explicit)
- [Project services explicitly](#project-services-explicitly)
- [Attach cleanup with `withDisposal`](#attach-cleanup-with-withdisposal)
- [Start selected services and cancel cooperatively](#start-selected-services-and-cancel-cooperatively)
- [Choose root, scoped or transient caching](#choose-root-scoped-or-transient-caching)
- [Create tracked child scopes](#create-tracked-child-scopes)
- [Fork for scopes and tests](#fork-for-scopes-and-tests)
- [WBS-shaped ownership example](#wbs-shaped-ownership-example)
- [Optional box adapters](#optional-box-adapters)
- [Errors and recovery](#errors-and-recovery)
- [Exported TypeScript types](#exported-typescript-types)
- [Boundaries](#boundaries)

## API at a glance

Import `DiBag` and the four error classes from `di-bag/node` in Node or Bun,
or from `di-bag` when using explicit portable acquisition modes. Both entries
expose the same methods and types. Each table links to explanations and examples
below; the [server guide](server-integration.md) puts them into an application.

### Configure and describe services

These methods are available on `DiBag` and every facade returned by `configure`
or `observe`. Creating a provider describes work; registration and resolution
happen separately.

| Method | Result and purpose |
| --- | --- |
| `begin()` | Create an empty immutable [builder](#compose-services). |
| `module()` | Create an immutable [module builder](#reuse-named-modules). |
| `configure({ isNativePromise })` | Return a new facade with an application-supplied [native-Promise predicate](#compose-services). |
| `observe({ onEvent, onError })` | Return a new facade with another [lifecycle observer](#observe-lifecycle-transitions). Both callbacks are required. |
| `factory(create, { acquisition })` | Describe a factory with explicit `raw`, `native`, or `auto` [acquisition](#compose-services). |
| `token(key).of<Service>()` | Create a [typed token](#use-typed-tokens-for-explicit-positional-injection) from a canonical unique symbol. |
| `fromTokens(dependencies, create, options?)` | Inject a tuple of [tokens or dependency references](#use-typed-tokens-for-explicit-positional-injection) into a callback in tuple order. |
| `fromFunction(dependencies, fn, options?)` | Adapt an existing [positional function](#adapt-classes-and-positional-functions). |
| `fromClass(dependencies, Constructor, options?)` | Adapt an existing [constructor](#adapt-classes-and-positional-functions). |
| `optional(token)` | Describe a dependency that supplies `undefined` when [absent](#declare-optional-and-lazy-dependencies). |
| `lazy(token)` | Describe a dependency supplied as a [lookup function](#declare-optional-and-lazy-dependencies). |
| `all(token)` | Describe an [ordered collection](#compose-an-ordered-collection) dependency. |
| `fromPlugin(dependencies, descriptor, options)` | [Validate an application-selected plugin](#admit-an-application-selected-plugin); options require `acquisition: 'raw'` or `'native'` and `validate`. |
| `withDisposal(registration, dispose)` | Add [ownership and cleanup](#attach-cleanup-with-withdisposal) of the registration's acquired value. |
| `withLifetime(registration, lifetime, options?)` | Choose [`root`, `scoped`, or `transient`](#choose-root-scoped-or-transient-caching); only `root` accepts `captureScoped`. |
| `withContext(create, options?)` | Give a factory an [acquisition context](#start-selected-services-and-cancel-cooperatively) as its second argument. |
| `withMetadata(registration, metadata)` | Attach [static metadata](#attach-metadata-and-inspect-without-resolving). |
| `mapSync(registration, project, options?)` | [Project the exposed value](#project-services-explicitly) immediately, preserving raw arguments and results. |
| `mapAsync(registration, project)` | Await the source and project it through an explicit [async boundary](#project-services-explicitly). |

The optional options argument on `fromTokens`, `fromFunction`, `fromClass`,
`withContext`, and `mapSync` selects the new stage's `acquisition` mode. Omitting
it uses `auto`. `mapAsync` is always an async boundary. Configuration returns a
new facade; it does not change global state or retrofit existing builders.

### Build and reuse a graph

Builder operations return a new builder. Keep the returned value or chain the
next call; they do not mutate the original.

| Method | Available on | Purpose |
| --- | --- | --- |
| `add(registrations)` | Builder, ModuleBuilder | Add new [named factories](#compose-services); duplicate keys reject. |
| `bind(token, registration)` | Builder, ModuleBuilder | Bind a [typed token](#use-typed-tokens-for-explicit-positional-injection). |
| `replace(nameOrToken, registration)` | Builder, ModuleBuilder | Replace one existing registration while checking its consumers and token contract. |
| `alias(destination, target)` | Builder, ModuleBuilder | Add another [name or token lookup](#give-a-dependency-another-lookup-name) for an existing service. |
| `contribute(token, registration)` | Builder, ModuleBuilder | Append an [ordered contribution](#compose-an-ordered-collection). |
| `install(module)` | Builder | Install a sealed [module](#reuse-named-modules) with private services and public exports. |
| `end()` | Builder | Check graph completeness and return a lazy bag. |
| `start(keys, options?)` | Builder | Return a promise for a fresh bag after [selected services are ready](#start-selected-services-and-cancel-cooperatively). |
| `exports(keys)` | ModuleBuilder | Seal the module and choose its public names and tokens. |
| `rename(oldName, newName)` | Sealed Module | Return a module view with one string-named export renamed. |

Modules do not resolve services or have a close method. Installing a module
gives its acquisitions an owning bag. Module builders do not expose `install`,
`end`, or `start`; compose sealed modules through an application builder.

### Use and close a bag

| Method | Purpose |
| --- | --- |
| `resolve(nameOrToken)` | Lazily acquire a service, preserving its inferred return type. |
| `resolveAll(token)` | Resolve the [ordered contributions](#compose-an-ordered-collection) as a readonly array. |
| `inspect(nameOrToken)` | Copy [metadata and acquisition state](#attach-metadata-and-inspect-without-resolving) without resolving. |
| `inspectAll(token)` | Inspect contribution descriptions and attempts without resolving. |
| `scope()` | Create a tracked [child scope](#create-tracked-child-scopes). |
| `scope({ share: keys })` | Create a child that explicitly borrows selected parent acquisitions. |
| `scope(keys, overrides, options?)` | Create a child with checked replacements and optional disjoint `share` selection. |
| `fork()` | Create an [independent bag](#fork-for-scopes-and-tests) with fresh instances. |
| `fork(keys, overrides)` | Create an independent bag with selected replacements. |
| `close()` | Return the shutdown promise; stop new resolutions, drain work, and dispose owned resources. Repeated calls share the same promise. |

### Optional adapter entry points

| Import | Function | Options |
| --- | --- | --- |
| `di-bag/sas-box` | `fromSasBox(registration, options)` | Required `mode: 'sync'`, `'async'`, or `'sync-first'`; `acquisition` is allowed only in `sync` mode. |
| `di-bag/val-box` | `fromValBox(registration, options?)` | Immediate snapshot; optional `value: 'required'` or `'presence'` and compatible `acquisition`. An acquisition-only object selects required mode. |
| `di-bag/val-box` | `fromValBoxAsync(registration, options?)` | Await source and result; supplied options must specify `value: 'required'` or `'presence'`. |

These are standalone named imports from their subpaths, not methods on `DiBag`.
See [box adapters](#optional-box-adapters) for capability requirements, metadata,
absence, and ownership.

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
introduces new names and rejects duplicates. Use `.replace(nameOrToken, registration)`
to replace one existing name or typed token after checking all known consumers:

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
single-registration `replace`. `.exports(keys)` seals a nominal module. Only the selected
names become public slots; `connection` stays private to the installation.
Use an inline tuple or `as const` tuple with individually known names. Empty
exports are allowed. All local providers retain their external requirements,
including unexported providers that no exported factory currently reaches.
Later host additions or other modules can satisfy forward requirements before
`.end()`. Duplicate exports reject before changing either input.

`feature.rename('service', 'otherService')` creates a new export view without
changing factory parameter names. For a module with only string-named exports,
rename every exported name to install it twice in one host. Typed-token exports
retain their symbol identity and cannot be renamed with `.rename()`; create a
module with distinct public tokens if you need two such installations.
Each installation allocates independent private
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

The token's readonly `key` property exposes its canonical symbol (`clock.key ===
clockKey`). Tokens are authentic handles, so copying the property into an object
does not create another valid token.

Both application and module builders can replace a typed-token binding:

```ts
const changed = DiBag.begin()
  .bind(clock, () => ({ now: () => 42 }))
  .replace(clock, () => ({ now: () => 7 }))
  .end();
changed.resolve(clock).now(); // 7
```

Unlike a name whose result type can change when consumers permit it, a token's
replacement must still satisfy that token's declared service contract.

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

`Provider<F, M, A, G, V>` uses its fourth invariant contract to retain required and
bound token identities. Its default `G` is an empty token graph, so existing
short `Provider<F>`, `Provider<F, M>`, and `Provider<F, M, A>` annotations remain
valid for token-free providers. Such a default is not an erasure mechanism:
providers with nonempty or opaque token graphs reject those shorter annotations.
The fifth parameter, `V`, retains the acquired-value type used by disposal. Its
default is `Awaited<ReturnType<F>>`; raw Promise-valued acquisitions need their
inferred `V` preserved as well.
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
make every dynamic graph universally type safe. Use
[`DiBag.fromPlugin`](#admit-an-application-selected-plugin) to validate a selected
plugin descriptor and its output at the dynamic boundary.

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
for existing callback adapters. See [`examples/composition.ts`](../../examples/composition.ts).

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

Run [`examples/contributions.ts`](../../examples/contributions.ts) for the complete
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

`Provider<F, M, A, G, V>` and its `ProviderOutput`, `ProviderNeeds`, `ProviderMetadata`,
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
[`examples/observers.ts`](../../examples/observers.ts) for an application-owned completion
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
[`examples/plugins.ts`](../../examples/plugins.ts) for typed module composition,
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
[`examples/wbs-scope.ts`](../../examples/wbs-scope.ts) demonstration. It models the
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
default; `{ value: 'presence' }` exposes `Presence<T>` instead.
`fromValBox` also accepts an acquisition-only object such as
`{ acquisition: 'raw' }`, which keeps required-value mode. An empty `{}` is
rejected. `fromValBoxAsync` options must include `value: 'required' | 'presence'`
and cannot select acquisition. Present
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

## Errors and recovery

The four error classes below are runtime exports from both `di-bag` and
`di-bag/node`. Each extends the built-in `Error` family and has a corresponding
`name`. Catch them with `instanceof` when choosing a recovery path.

| Error | When it appears | Public information |
| --- | --- | --- |
| `DiBagCleanupError` | `close()` finishes attempting cleanup and one or more disposers failed. | Extends `AggregateError`; `errors` contains the original errors, and readonly `failures` associates each with `acquisitionId`, `bindingId`, `label`, and `error`. |
| `DiBagPluginError` | A plugin descriptor or acquired output fails the plugin boundary checks. | `phase` is `'descriptor'` or `'output'`; `reason` describes the rejection. |
| `DiBagStartupError` | Selected startup acquisition fails and rollback has completed. | `cause` is the acquisition error; `cleanupFailures` contains disposal failures; `cleanupError` retains the complete cleanup error when present. |
| `DiBagStartupCancelledError` | An external signal or startup deadline interrupts startup. | `reason` is `'aborted'` or `'timeout'`; `cause` retains the cancellation reason; `cleanup` is a `Promise<void>` for eventual shutdown. |

```ts
import { DiBagCleanupError } from 'di-bag/node';

try {
  await bag.close();
} catch (error) {
  if (error instanceof DiBagCleanupError) {
    for (const failure of error.failures) {
      console.error(failure.label, failure.error);
    }
  }
  throw error;
}
```

Constructors are `new DiBagCleanupError(failures)`,
`new DiBagPluginError(phase, reason)`,
`new DiBagStartupError(cause, cleanupFailures, cleanupError?)`, and
`new DiBagStartupCancelledError(reason, cause, cleanup)`. Applications usually
catch errors created by the library rather than constructing them.

Factory errors and projection errors retain their original identity on
resolution. Other invalid runtime inputs can throw ordinary `Error` or
`TypeError`; these four classes are not an exhaustive classification of every
possible failure. Observer callback failures are delivered to the observer's
`onError` callback and do not become service or shutdown failures.

## Exported TypeScript types

All names in this section are type-only exports from `di-bag` and `di-bag/node`.
Use `import type` for them. `ValBoxFrame` is also a type-only export from
`di-bag/val-box`. They provide annotations and preserve contracts in generated
declarations; they do not provide unchecked runtime constructors.

For application code, prefer inferred values and `typeof` or `ReturnType` when
passing a graph across a module boundary:

```ts
import type { ProviderOutput, TokenService } from 'di-bag';

type Clock = TokenService<typeof clock>;
type Stamp = ProviderOutput<typeof stamp>;
type Application = typeof bag;
```

These names refer to the clock, stamp registration, and bag in the earlier
token example. Shorter `Bag`, `Module`, or `Provider` annotations cannot erase
retained private-consumer, token, lifetime, or ownership contracts.

### Application-facing types

| Exports | Purpose |
| --- | --- |
| `Facade` | The complete `DiBag` method surface, including configured and observed facades. |
| `Builder`, `Bag` | A checked immutable builder and a resolving/owning bag. |
| `ModuleBuilder`, `Module` | A private composition builder and its sealed export view. |
| `Registration`, `DisposableFactory` | Accepted registration shapes and an owned factory description. |
| `Provider` | A provider description retaining its factory, metadata, frames, graph contracts, and acquired-value type. |
| `AcquisitionMode`, `RuntimeOptions` | Acquisition mode literals and the `isNativePromise` configuration callback. |
| `Lifetime` | The `'root'`, `'scoped'`, and `'transient'` caching choices. |
| `AcquisitionContext`, `ContextualFactory` | Factory cancellation context (`signal`) and the adapted contextual factory signature. |
| `StartupOptions` | Optional `signal`, `timeoutMs`, and `concurrency` fields for `start`. |
| `ScopeOptions` | The checked `share` selection accepted by `scope`. |
| `Token`, `TokenBase`, `TokenKey`, `TokenService` | Typed token identity, its common handle type, and key/service projections. |
| `OptionalReference`, `LazyReference`, `AllReference`, `Dependency` | The token reference forms accepted in positional dependency tuples. |
| `CompositionArguments`, `CompositionFunction` | Positional argument compatibility and callback signatures for function/constructor adaptation. |
| `Presence` | `{ present: false }` or `{ present: true, value }`, including present `undefined`. |
| `FramePresenceTuple`, `AcquisitionSnapshot`, `InspectionSnapshot` | Inspection frames, acquisition state, and registration metadata snapshots. |
| `ValBoxFrame` | Acquired box metadata with `kind`, `metadata`, and `alias`. |
| `CleanupFailure` | The detached acquisition identity, label, and original cleanup error. |
| `ObserverOptions`, `ObserverCallback`, `ObserverErrorCallback` | Observer configuration and its event/failure callbacks. |
| `LifecycleEvent`, `ObserverFailure`, `ScopeEventFields`, `AcquisitionEventFields` | Discriminated lifecycle events and observer failure context. |
| `PluginAcquisition`, `PluginOptions`, `PluginPredicate`, `PluginResult` | Plugin mode, validation options, output predicate, and resulting provider. |
| `fromPlugin` | A type-only export of the function declaration, usable with `typeof fromPlugin`; call the runtime API as `DiBag.fromPlugin`. |

### Provider and module projections

| Exports | Purpose |
| --- | --- |
| `ProviderFactory`, `ProviderOutput`, `ProviderAcquired`, `ProviderNeeds` | Extract the factory, exposed result, acquired value, and named requirements from a registration. Output and acquired value can differ across async boundaries. |
| `ProviderMetadata`, `ProviderAcquisitionMetadata` | Extract static metadata and the tuple of acquisition metadata frames. |
| `ProviderGraph` | Retain a provider's token and other graph obligations. |
| `ProviderTokenNeeds`, `ProviderOptionalTokenNeeds`, `ProviderAllTokenNeeds` | Extract required/lazy, optional, and collection token requirements. |
| `ModuleProvides`, `ModuleRequires` | Extract the readonly service exports and external requirements of a sealed module. |
| `ModuleConstraints` | Compute retained private-consumer and lifetime constraints for a registration map and public selection. |
| `PublicProviders`, `ModulePublicProviders` | Preserve provider contracts when projecting public module registrations. |
| `Renamed` | Represent the checked renaming of a module's public view. |

### Graph composition support types

These exports support reusable generic helpers and portable declaration output.
Most applications can let the builder infer them. They express compile-time
contracts; they do not perform runtime validation.

| Exports | Purpose |
| --- | --- |
| `Provided` | Map registrations to their exposed service types. |
| `Entries`, `From` | Convert between a registration map and its entry representation. |
| `Merge`, `Selected` | Model merged registration maps and selected override registrations. |
| `Checked`, `Complete` | Check dependency shape compatibility and graph completeness. |
| `Selection`, `Overrides`, `ForkContext` | Validate selections and replacement compatibility while preserving contextual inference. |
| `Binding`, `TokenMember`, `TokenGraph` | Retain typed bindings, validate token membership, and represent token obligations. |
| `ReboundProviders`, `ReboundSelection`, `SelectionKey` | Preserve token bindings across replacement and map selections to their string/symbol keys. |
| `AliasRegistration`, `AliasEntries`, `AliasOutput` | Model an alias registration, its graph entries, and its exposed result. |
| `Contribution`, `ContributionConstraint` | Describe an ordered contribution and its retained requirements. |
| `ModuleContributions`, `ModuleContributionConstraints` | Preserve contributions and their requirements in modules. |
| `BuilderContribute`, `ModuleContribute` | The generic `contribute` signatures on application and module builders. |
| `DisjointScopeSelection` | Enforce separate override and sharing selections. |
| `UnsharedAliases`, `ScopedAliases`, `SharedAliasProviders` | Preserve alias contracts as scopes inherit or explicitly share services. |
| `CheckedLifetimes`, `CheckedScopeLifetimes` | Check root capture and lifetime compatibility in completed graphs and scope overrides. |
| `LexicalContext`, `RenamedLifetimeObligation`, `RenamedLifetimeProviders` | Retain lifetime ownership and requirements through lexical module boundaries and renaming. |

The authoritative export lists are [`src/index.ts`](../../src/index.ts),
[`src/sas-box.ts`](../../src/sas-box.ts), and [`src/val-box.ts`](../../src/val-box.ts).
Internal helpers in other source files are not package exports.

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
