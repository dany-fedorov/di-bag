# Migrating from 0.4 to 0.5 {#migrating-to-0-5}

0.5.0 renames almost every public name so that a call reads as a sentence, and
makes several contracts more explicit. The graph, scoped default, disposal and
compile-time checks work as before. This page is the whole path.

## 1. Run the codemod before you upgrade {#run-the-codemod}

The codemod is type-aware: it rewrites a call only when the TypeScript checker
resolves it to a `di-bag` declaration, which is how it tells `builder.replace`
from `String.prototype.replace`. It therefore needs the 0.4.0 types to be
installed while it runs. Upgrade afterwards.

```sh
npx di-bag-codemod --project tsconfig.json            # dry run: prints what it would change
npx di-bag-codemod --project tsconfig.json --write --report di-bag-codemod-report.json
npm install di-bag@0.5
npx tsc --noEmit
```

Whatever it could not decide is in the report, with file, line and the reason.
It never guesses. What it does not read: Markdown, source code held in strings,
and JavaScript without types. A missed removed callable method name still exists
at run time as a function that throws `DI_BAG_REMOVED_API` and names its
replacement. Renamed fields, exported types, and import specifiers have no such
runtime stub or error-code guarantee; TypeScript, module resolution, and
ordinary JavaScript property semantics handle them instead.

## 2. Changes to review {#behavior-changes}

**Lifetime names now state their caching boundary.** The default remains
`'scoped:one-per-container'`, so existing unmarked providers keep one instance
per container. Use `'singleton:one-per-container-tree'` for one instance shared
by the root and its children, or `'transient:one-per-resolve'` for a new instance
on every read.

```ts
import { DiBag } from 'di-bag';

let nextId = 0;
const clock = DiBag.providerWithLifetime({
  provider: () => ({ now: () => Date.now() }),
  lifetime: 'singleton:one-per-container-tree',
});
const app = DiBag.createBuilder()
  .withServices({ clock, request: () => ({ id: ++nextId }) })
  .buildContainer();
const perRequest = app.createChildContainer();
console.log(perRequest.resolve('clock') === app.resolve('clock'), perRequest.resolve('request') === app.resolve('request'));
await app.close();
```

That prints `true false`: the explicit singleton clock is shared, while the
unmarked request service uses the scoped default.

**A child container replaces only scoped and transient services.** Replacing a
singleton in a child does not compile, because every other container of the
tree would keep the original. Mark the service scoped, or use
`createIndependentContainer`, which may replace anything.

**A token is either for one service or for a collection.** In 0.4.0 one token
could carry a single service and contributions at the same time. Now
`createToken(symbol).forService<S>()` and `createToken(symbol).forCollectionOf<Item>()`
are different tokens, a collection is read with `resolveCollection(collectionToken)`
or by listing the token as a dependency, and `DiBag.all`, `resolveAll` and
`inspectAll` are gone. The codemod converts a token that was only ever
contributed to. A token used both ways is reported, and you split it by hand
into two tokens with distinct symbols.

```ts
import { DiBag } from 'di-bag';

const sinks = DiBag.createToken(Symbol('sinks')).forCollectionOf<(line: string) => void>();
const app = DiBag.createBuilder()
  .withCollectionContribution({ collectionToken: sinks, provider: () => (line: string) => console.log(line) })
  .buildContainer();
for (const write of app.resolveCollection(sinks)) write('ready');
await app.close();
```

**Provider helpers use named option bags.** `createProvider` takes the factory
and an optional classification object. Source adapters use
`createProviderFromFunction({ dependencies, factoryFunction })`,
`createProviderFromClass({ dependencies, serviceClass })`, and
`createProviderFromPlugin({ dependencies, pluginDescriptor, factoryReturnKind,
isValidPluginOutput })`. Provider decorators moved to facade calls such as
`providerWithDisposal({ provider, disposeService })`,
`providerWithLifetime({ provider, lifetime })`, and
`providerWithTransformedService({ provider, transformService, callbackReceives })`.
Registration and acquisition metadata now use separate helpers; if an old
`withMetadata` call combined both, compose the two new helpers in the same
evaluation order.

**There is one entry point.** `di-bag/node` is removed. Import everything from
`di-bag`; the package finds the host's Promise classifier by itself, and
`DiBag.withConfiguration({ runtime })` still overrides it.

## 3. Errors {#errors}

A runtime code now names a kind of failure and never a method; the method is in
`details.operation`. Every malformed argument, whatever the call, is
`DI_BAG_INVALID_ARGUMENT` with `details: { operation, argument, expected }`.
If your code branches on `error.code`, check it against the table of codes
below: six old codes were split, and for those the right new code depends on
what went wrong, so the codemod reports them instead of rewriting them.
`DiBagCleanupError` is `DiBagDisposalError`, the startup errors are the service
readiness errors, and their `cleanup...` fields are `disposal...`.

```ts
import { DiBag } from 'di-bag';

try {
  DiBag.createProvider(42 as never);
} catch (error) {
  const { operation, argument, expected } = (error as { details: Record<string, unknown> }).details;
  console.error(`${String(operation)}: ${String(argument)} must be ${String(expected)}`);
}
```

## 4. Every rename {#every-rename}

<!-- generated:rename-tables:start -->

<!-- Generated by scripts/generate-migration-guide.mjs from tools/codemod/rename-map.json. Edit the map, not this block. -->

### Container, which was `Bag`

| 0.4.0 | 0.5.0 |
| --- | --- |
| `resolveAll(...)` | by hand: container.resolveCollection(collectionToken); create collectionToken with DiBag.createToken(symbol).forCollectionOf&lt;Item&gt;(), and manually split any mixed single-service and collection uses into tokens with distinct symbols |
| `inspectAll(...)` | by hand: container.serviceSnapshot(collectionToken); create collectionToken with DiBag.createToken(symbol).forCollectionOf&lt;Item&gt;(), and manually split any mixed single-service and collection uses into tokens with distinct symbols |
| `inspect(...)` | by hand: container.serviceSnapshot(serviceKey) |
| `inspectGraph(...)` | by hand: container.graphSnapshot() |
| `createScope(...)` | by hand: container.createChildContainer(replacedServiceKeys, replacementProviders, { sharedParentServiceKeys }); use container.createChildContainer() or container.createChildContainer({ sharedParentServiceKeys }) when no services are replaced |
| `fork(...)` | by hand: container.createIndependentContainer(replacedServiceKeys, replacementProviders); use container.createIndependentContainer() when no services are replaced |

### Builder

| 0.4.0 | 0.5.0 |
| --- | --- |
| `buildAndStart(...)` | by hand: builder.buildContainer().ensureServicesReady(serviceKeys, options); rename signal to abortSignal and timeoutMs to totalTimeoutMs; replace startupOrder with maxConcurrentServiceKeys (omit for parallel, 1 for sequential, or the number); options may be omitted |
| `register(...)` | by hand: builder.withServices({ key: provider }) or builder.withTokenService(token, provider) |
| `alias(...)` | by hand: builder.withServiceAlias({ aliasKey, targetServiceKey }) |
| `contribute(...)` | by hand: builder.withCollectionContribution({ collectionToken, provider }); create collectionToken with DiBag.createToken(symbol).forCollectionOf&lt;Item&gt;() |
| `replace(...)` | `withReplacedService(...)` |
| `installModule(...)` | by hand: builder.withInstalledModules([module]) |
| `verifyGraph(...)` | `verifyGraphAtCompileTime(...)` |
| `buildModule(...)` | `buildModule(...)` |
| `build(...)` | `buildContainer(...)` |

### The facade, `DiBag`

| 0.4.0 | 0.5.0 |
| --- | --- |
| `fromFactory(...)` | by hand: DiBag.createProvider(factory, options); rename acquisitionMode to factoryReturnKind (auto -&gt; auto-detect, raw -&gt; uninspected, nativePromise -&gt; native-promise) and context: 'acquisition' to factoryReceivesContext: true; options may be omitted |
| `fromSyncFactory(...)` | by hand: DiBag.createProvider(factory, { factoryReturnKind: 'sync-value' }); add factoryReceivesContext: true if the old call used context: 'acquisition' |
| `fromAsyncFactory(...)` | by hand: DiBag.createProvider(factory, { factoryReturnKind: 'native-promise' }); add factoryReceivesContext: true if the old call used context: 'acquisition' |
| `fromFunction(...)` | by hand: DiBag.createProviderFromFunction({ dependencies, factoryFunction }); move any acquisitionMode option into this object as factoryReturnKind (auto -&gt; auto-detect, raw -&gt; uninspected, nativePromise -&gt; native-promise) |
| `fromClass(...)` | by hand: DiBag.createProviderFromClass({ dependencies, serviceClass }); move any acquisitionMode option into this object as factoryReturnKind (auto -&gt; auto-detect, raw -&gt; uninspected, nativePromise -&gt; native-promise) |
| `fromPlugin(...)` | by hand: DiBag.createProviderFromPlugin({ dependencies, pluginDescriptor, factoryReturnKind, isValidPluginOutput }); rename validate to isValidPluginOutput and map acquisitionMode raw -&gt; uninspected or nativePromise -&gt; native-promise |
| `withDisposal(...)` | by hand: DiBag.providerWithDisposal({ provider, disposeService }) |
| `withLifetime(...)` | by hand: DiBag.providerWithLifetime({ provider, lifetime }); map root -&gt; singleton:one-per-container-tree, scoped -&gt; scoped:one-per-container, or transient -&gt; transient:one-per-resolve; move allowScopedDependencies into this object as allowsScopedDependencies |
| `withMetadata(...)` | by hand: DiBag.providerWithRegistrationMetadata({ provider, registrationMetadata }) for static metadata, or DiBag.providerWithAcquisitionMetadata({ provider, describeAcquisition, callbackReceives }) for dynamic metadata; map mode direct -&gt; exposed-service or awaited -&gt; fulfilled-value; combined static and dynamic metadata requires manually composing both calls while preserving evaluation order |
| `transformService(...)` | by hand: DiBag.providerWithTransformedService({ provider, transformService, callbackReceives }); map mode direct -&gt; exposed-service or awaited -&gt; fulfilled-value; for exposed-service callbacks, rename acquisitionMode to transformReturnKind (auto -&gt; auto-detect, raw -&gt; uninspected, nativePromise -&gt; native-promise) |
| `token(...)` | by hand: DiBag.createToken(symbol).forService&lt;Service&gt;() or DiBag.createToken(symbol).forCollectionOf&lt;Item&gt;(); choose the kind manually from its uses, and split mixed single-service and collection uses into tokens with distinct symbols |
| `all(...)` | by hand: the collection token itself, from DiBag.createToken(symbol).forCollectionOf&lt;Item&gt;() |

### Module

| 0.4.0 | 0.5.0 |
| --- | --- |
| `renameExport(...)` | by hand: module.withRenamedExport({ currentExportKey, newExportKey }) |

### `token()`

| 0.4.0 | 0.5.0 |
| --- | --- |
| `of(...)` | by hand: DiBag.createToken(symbol).forService&lt;Service&gt;() or DiBag.createToken(symbol).forCollectionOf&lt;Item&gt;(); choose the kind manually from its uses, and split mixed single-service and collection uses into tokens with distinct symbols |

### Option names

| 0.4.0 | 0.5.0 |
| --- | --- |
| `close({ signal })` | `close({ abortSignal })` |
| `close({ timeoutMs })` | `close({ waitTimeoutMs })` |
| `withConfiguration({ observers })` | `withConfiguration({ lifecycleObservers })` |
| `withLifetime({ allowScopedDependencies })` | `providerWithLifetime({ allowsScopedDependencies })` |
| `transformService({ acquisitionMode })` | `providerWithTransformedService({ transformReturnKind })` |

### Fields of options, snapshots, events and errors

| 0.4.0 | 0.5.0 |
| --- | --- |
| `Token.key` | `symbol` |
| `CollectionToken.key` | `symbol` |
| `AcquisitionContext.signal` | `abortSignal` |
| `Presence.present` | `isPresent` |
| `RegistrationSnapshot.label` | `bindingLabel` |
| `BindingSnapshot.keys` | `serviceKeys` |
| `BindingSnapshot.owned` | `isOwnedByContainer` |
| `BindingSnapshot.key` | `tokenSymbol` |
| `BindingSnapshot.kind` | `dependencyKind` |
| `GraphSnapshot.token` | `collectionTokenSymbol` |
| `GraphSnapshot.from` | `consumerBindingId` |
| `GraphSnapshot.to` | `dependencyBindingId` |
| `BindingSnapshot.acquisitionMode` | `factoryReturnKind` |
| `CloseOptions.signal` | `abortSignal` |
| `CloseOptions.timeoutMs` | `waitTimeoutMs` |
| `StartupOptions.signal` | `abortSignal` |
| `StartupOptions.timeoutMs` | `totalTimeoutMs` |
| `StartupOptions.startupOrder` | by hand: startupOrder is gone; use maxConcurrentServiceKeys: omit it for 'parallel', 1 for 'sequential', or the number |
| `ModuleOptions.label` | `moduleLabel` |
| `DiBagStartupError.cleanupFailures` | `disposalFailures` |
| `DiBagStartupError.cleanupError` | `disposalError` |
| `DiBagStartupCancelledError.cleanupPromise` | `disposalPromise` |
| `DiBagCloseCancelledError.timeoutMs` | `waitTimeoutMs` |
| `DiBagCloseCancelledError.cleanupPromise` | `disposalPromise` |
| `CleanupFailure.label` | `bindingLabel` |
| `CloseProgress.pending` | `disposersStillRunning` |
| `CloseProgress.acquiring` | `acquisitionsStillPending` |
| `ObserverOptions.onEvent` | `onLifecycleEvent` |
| `ObserverOptions.onError` | `onObserverFailure` |
| `ScopeOptions.share` | `sharedParentServiceKeys` |
| `ScopeEventFields.scopeId` | `containerId` |
| `ScopeEventFields.parentScopeId` | `parentContainerId` |
| `AcquisitionEventFields.scopeId` | `containerId` |
| `AcquisitionEventFields.label` | `bindingLabel` |
| `GraphSnapshot.scopeId` | `containerId` |
| `Captive.root` | `singleton` |
| `LifetimeObligation.root` | `singleton` |

### String values

| 0.4.0 | 0.5.0 |
| --- | --- |
| `'auto'` in `transformService(...)` | `'auto-detect'` |
| `'raw'` in `transformService(...)` | `'uninspected'` |
| `'nativePromise'` in `transformService(...)` | `'native-promise'` |
| `'root'` in `withLifetime(...)` | `'singleton:one-per-container-tree'` |
| `'scoped'` in `withLifetime(...)` | `'scoped:one-per-container'` |
| `'transient'` in `withLifetime(...)` | `'transient:one-per-resolve'` |
| `'root'` in `BindingSnapshot.lifetime` | `'singleton:one-per-container-tree'` |
| `'scoped'` in `BindingSnapshot.lifetime` | `'scoped:one-per-container'` |
| `'transient'` in `BindingSnapshot.lifetime` | `'transient:one-per-resolve'` |
| `'root'` in `AcquisitionEventFields.lifetime` | `'singleton:one-per-container-tree'` |
| `'scoped'` in `AcquisitionEventFields.lifetime` | `'scoped:one-per-container'` |
| `'transient'` in `AcquisitionEventFields.lifetime` | `'transient:one-per-resolve'` |
| `'scope-opened'` in `LifecycleEvent.kind` | `'container-opened'` |
| `'scope-closing'` in `LifecycleEvent.kind` | `'container-closing'` |
| `'scope-closed'` in `LifecycleEvent.kind` | `'container-closed'` |
| `'scope-close-failed'` in `LifecycleEvent.kind` | `'container-close-failed'` |
| `'cleanup-started'` in `LifecycleEvent.kind` | `'disposal-started'` |
| `'cleanup-failed'` in `LifecycleEvent.kind` | `'disposal-failed'` |
| `'cleanup-completed'` in `LifecycleEvent.kind` | `'disposal-completed'` |

### Exported types and classes

| 0.4.0 | 0.5.0 |
| --- | --- |
| `AcquisitionMode` | `FactoryReturnKind`; map literal values `'auto'` to `'auto-detect'`, `'raw'` to `'uninspected'`, `'nativePromise'` to `'native-promise'` |
| `AcquisitionContext` | `FactoryContext` |
| `CompositionArguments` | `PositionalFactoryArguments` |
| `CompositionFunction` | `PositionalFactoryFunction` |
| `PluginAcquisitionMode` | `PluginReturnKind`; map literal values `'raw'` to `'uninspected'`, `'nativePromise'` to `'native-promise'` |
| `PluginOptions` | `CreateProviderFromPluginOptions`; in generic argument 1, map `'raw'` to `'uninspected'`, `'nativePromise'` to `'native-promise'` |
| `PluginProviderFactory` | `CreateProviderFromPlugin` |
| `PluginProvider` | `PluginProvider`; in generic argument 3, map `'raw'` to `'uninspected'`, `'nativePromise'` to `'native-promise'` |
| `StartupOptions` | `EnsureServicesReadyOptions` |
| `DiBagStartupError` | `DiBagServiceReadinessError` |
| `DiBagStartupCancelledError` | `DiBagServiceReadinessCancelledError` |
| `DiBagCleanupError` | `DiBagDisposalError` |
| `CleanupFailure` | `DisposalFailure` |
| `BuilderContribute` | `BuilderWithCollectionContribution` |
| `Bag` | `Container` |
| `ScopeOptions` | `CreateChildContainerOptions` |
| `CheckedScopeLifetimes` | `CheckedChildContainerLifetimes` |
| `DisjointScopeSelection` | `DisjointChildContainerSelection` |
| `ObserverOptions` | `LifecycleObserver` |
| `Registration` | `ProviderOrFactory` |
| `FactoryWithDisposal` | `Provider` |
| `ScopeEventFields` | `ContainerEventFields` |

### Runtime error codes

| 0.4.0 | 0.5.0 |
| --- | --- |
| `DI_BAG_MISSING_REGISTRATION` | `DI_BAG_UNKNOWN_SERVICE_KEY` |
| `DI_BAG_INVALID_REPLACEMENT` | `DI_BAG_UNKNOWN_SERVICE_KEY` |
| `DI_BAG_INVALID_ALIAS` | `DI_BAG_UNKNOWN_SERVICE_KEY` |
| `DI_BAG_DUPLICATE_REGISTRATION` | `DI_BAG_DUPLICATE_SERVICE_KEY` |
| `DI_BAG_DUPLICATE_METADATA` | `DI_BAG_DUPLICATE_METADATA_KEY` |
| `DI_BAG_CYCLE` | `DI_BAG_DEPENDENCY_CYCLE` |
| `DI_BAG_STARTUP_FAILED` | `DI_BAG_SERVICE_READINESS_FAILED` |
| `DI_BAG_STARTUP_CANCELLED` | `DI_BAG_SERVICE_READINESS_CANCELLED` |
| `DI_BAG_STARTUP_TIMEOUT` | `DI_BAG_SERVICE_READINESS_TIMEOUT` |
| `DI_BAG_CLEANUP_FAILED` | `DI_BAG_DISPOSAL_FAILED` |
| `DI_BAG_CLEANUP_AFTER_FACTORY` | `DI_BAG_DISPOSER_PUSHED_AFTER_FACTORY` |
| `DI_BAG_INVALID_ACQUISITION_MODE` | `DI_BAG_INVALID_ARGUMENT` |
| `DI_BAG_INVALID_CLEANUP` | `DI_BAG_INVALID_ARGUMENT` |
| `DI_BAG_INVALID_CLOSE` | `DI_BAG_INVALID_ARGUMENT` |
| `DI_BAG_INVALID_CONFIGURATION` | `DI_BAG_INVALID_ARGUMENT` |
| `DI_BAG_INVALID_CONSTRUCTOR` | `DI_BAG_INVALID_ARGUMENT` |
| `DI_BAG_INVALID_FACTORY` | `DI_BAG_INVALID_ARGUMENT` |
| `DI_BAG_INVALID_FUNCTION` | `DI_BAG_INVALID_ARGUMENT` |
| `DI_BAG_INVALID_LIFETIME` | `DI_BAG_INVALID_ARGUMENT` |
| `DI_BAG_INVALID_PLUGIN_OPTIONS` | `DI_BAG_INVALID_ARGUMENT` |
| `DI_BAG_INVALID_TRANSFORM` | `DI_BAG_INVALID_ARGUMENT` |
| `DI_BAG_INVALID_EXPORT` | by hand: DI_BAG_INVALID_EXPORT was split: DI_BAG_UNKNOWN_SERVICE_KEY for a key the module does not export, DI_BAG_DUPLICATE_SERVICE_KEY for a rename onto an existing export, DI_BAG_INVALID_ARGUMENT for malformed input |
| `DI_BAG_INVALID_METADATA` | by hand: DI_BAG_INVALID_METADATA was split: DI_BAG_INVALID_ACQUISITION_METADATA when a describe callback returns a bad record, DI_BAG_INVALID_ARGUMENT for malformed input |
| `DI_BAG_INVALID_OVERRIDE` | by hand: DI_BAG_INVALID_OVERRIDE was split: DI_BAG_UNKNOWN_SERVICE_KEY, DI_BAG_MISSING_REPLACEMENT_PROVIDER, or DI_BAG_INVALID_ARGUMENT for malformed input |
| `DI_BAG_INVALID_REGISTRATION` | by hand: DI_BAG_INVALID_REGISTRATION was split: DI_BAG_INVALID_PROVIDER for a value that is neither a function nor a provider, DI_BAG_INVALID_ARGUMENT for malformed input |
| `DI_BAG_INVALID_SCOPE` | by hand: DI_BAG_INVALID_SCOPE was split: DI_BAG_UNKNOWN_SERVICE_KEY, DI_BAG_MISSING_REPLACEMENT_PROVIDER, DI_BAG_CONFLICTING_SERVICE_SELECTION, or DI_BAG_INVALID_ARGUMENT for malformed input |
| `DI_BAG_INVALID_STARTUP` | by hand: DI_BAG_INVALID_STARTUP was split: DI_BAG_UNKNOWN_SERVICE_KEY for an unknown key, DI_BAG_INVALID_ARGUMENT for malformed input |

### Import specifiers

| 0.4.0 | 0.5.0 |
| --- | --- |
| `'di-bag/node'` | `'di-bag'` |

<!-- generated:rename-tables:end -->

## 5. If something is still red {#still-red}

- A name the compiler does not know: find it in the tables above.
- `DI_BAG_REMOVED_API` from a removed callable at run time: the message names
  the replacement.
- A singleton that now captures a scoped service does not compile: either the
  captured service should be a singleton too, or the capturing one should be
  scoped. See [the errors page](../agent/errors.md#singleton-captures-scoped).
- A child cannot replace an explicit singleton: use an independent container,
  or make the service scoped when each child should own an instance.
