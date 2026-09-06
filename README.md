# DI Bag

A small dependency bag for service factories, with inferred requirements,
lazy resolution, scoped forks, and optional disposal. Zero runtime dependencies.

## Compose services

```ts
import { DiBag } from 'di-bag';

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
builder/bag. The optional third `Module<P, R, C>` parameter and second `Bag<R, C>`
parameter retain these contracts; their empty defaults cannot erase them.
Consequently `Module<P, R>` and plain `Bag<R>` annotations reject values carrying
nonempty retained constraints. Plain bags can still use `Bag<R>`.

When an async fork override needs a new method provided by another selected
override, declare the override object before passing it to `fork`. This lets
TypeScript infer both factories before checking their shared dependency view;
the Promise-valued result remains exact and no cast is needed.

Run `bun run examples/modules.ts` for a runnable two-module composition with
cleanup and an exported service override.

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
own identity: when a consumer catches a failed dependency, its recorded edge
continues to name that failed attempt and never redirects to a later retry.
Dependency cycles throw or reject with a path such as `cycle: a -> b -> a`, including dependency
reads after `await`.

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
and failed acquisitions have no cleanup callback to run.

Ownership transfers after a synchronous result is successfully classified, or
after a Promise/thenable fulfills. If reading `then` or setting up its observer
throws, resolution rethrows that same error and discards the failed cache entry
and dependency edges so a later resolution can retry. Malformed or unobservable
results are not accepted as owned acquisitions: their factories remain
responsible for resources that were not successfully transferred. The bag never
passes an unfulfilled raw PromiseLike to a fulfilled-value disposer. Explicit
ownership of opaque synchronous values is a separate future capability.

`close()` immediately stops public resolution and forking, waits for in-flight
factories and their dependencies, then disposes resources sequentially.
Dependents close before their dependencies; unrelated resources close in reverse
successful acquisition order. This dependency ordering also holds when async
factories complete out of order.

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
Promise cycles cannot be forcibly completed. There is no cancellation or shutdown
timeout: a factory or disposer that never settles keeps `close()` pending.

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
  run the development tests. Type checks are verified with TypeScript 5.9.3.

## Development

```sh
npm install
npm run check          # strict types, runtime/type/package tests, build
npm run benchmark:types # isolated Node compiler measurements (Node 24+)
npm pack --dry-run    # builds and previews the publication contents
```

Tests compile positive usage and each negative fixture independently. Package
smoke tests build the distribution and exercise Node's CommonJS and ESM loaders
and TypeScript's emitted-declaration resolution. Distribution files and type
declarations are emitted to `dist/`.

Builders accumulate a flat union of registration entries internally; the public
`Bag<R>` type still takes a registration map. Compile-time acceptance tests cover
100 chained additions, 100 replacements, and 1,000 providers assembled from
reusable registration groups, including missing and wrong-shaped dependencies.
These groups are ordinary registration objects; they are not a nominal module
API. The [compiler benchmark report](docs/benchmarks/typescript.md) records
100/500/1,000-provider results and remaining limits. Passing the grouped gate
does not establish that equally long individual call chains are supported.

Current code lives in `src/`. Previous experiments are preserved under
[`docs/history/`](docs/history/README.md). The [v0.1 design](docs/superpowers/specs/2026-09-06-v0.1-design.md)
and [implementation plan](docs/superpowers/plans/2026-09-06-v0.1.md) record the
decisions, including the deferred investigation into Effect-style requirement
inference.
