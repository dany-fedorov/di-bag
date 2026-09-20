# Swift API style for DI Bag

Design note for renaming and reshaping the whole public API so that every call is
understood by reading it. It adopts the
[Swift API Design Guidelines](https://www.swift.org/documentation/api-design-guidelines/)
as the naming standard, translated to TypeScript. It also carries the four
[behavior changes](#behavior-changes) approved from the orthogonality review, so
that no call is renamed in 0.5.0 and then removed one release later.

Sixteen worked use cases are in the
[companion examples](2026-09-20-swift-api-style-examples.md).

**Status: proposed, awaiting review.** Each phase in the [roadmap](#roadmap) gets
its own implementation plan under `docs/superpowers/plans/` once this note is
approved.

## Problem

The 0.4.0 surface has 34 callables, 42 runtime codes and 102 exported types. Its
names were chosen one feature at a time, and the review that led to this note
found the same failures repeatedly:

- **Names that need the docs.** `buildAndStart(keys, { signal, timeoutMs,
  startupOrder })` took three rounds of explanation before the author of the
  library agreed on what `keys` is for. The glossary word for a factory creating a
  service, "acquisition", had to be asked for.
- **Immutability is invisible.** Every builder method returns a new builder, yet
  the methods are named `register`, `alias` and `replace`. In other containers
  `register` mutates. A discarded result compiles whenever nothing depends on the
  dropped service. The tutorial mentions immutability in one sentence.
- **Swappable positional pairs.** `alias(destination, target)`,
  `renameExport(oldKey, newKey)` and `fork(keys, overrides)` give no name to
  either argument at the call site.
- **One axis, several vocabularies.** Sync versus async is spelled
  `acquisitionMode: 'raw' | 'nativePromise'`, `mode: 'direct' | 'awaited'`,
  `fromSyncFactory` / `fromAsyncFactory`, and `PluginAcquisitionMode`.
- **Summaries that need "or".** `fromFactory` is described as "an explicit
  acquisition mode or the acquisition's abort signal", and `withMetadata` as
  "static registration metadata, or per-acquisition metadata". Each fuses two
  purposes.
- **One token, two hidden channels.** A token holds a single service through
  `register` and, separately, a list through `contribute`. Nothing in the token
  says which is meant. A registration on the wrong channel compiles, and the
  reader gets an empty list or a missing-service error.
- **Two words for one concept.** Cleanup and disposal. Registration and provider.
  `token.key` holds a symbol while "key" elsewhere means a name or a token.

The library targets coding agents. An agent reads names, option keys and error
codes before it reads a guide, so the names are the primary documentation.

## Decision

Adopt the Swift API Design Guidelines as the standard, with the
[W3C Web Platform Design Principles](https://www.w3.org/TR/design-principles/) as
the secondary source for option dictionaries and string values. Breaking changes
are accepted. Everything ships in one breaking release, 0.5.0, so consumers
migrate once.

Swift has argument labels and TypeScript does not, so the rules are translated:

| Swift | TypeScript in DI Bag |
| --- | --- |
| Argument label | Property name in an options bag |
| Omitted first label, because the argument reads as a phrase with the method name | Positional first parameter |
| Defaulted parameter | Optional property of the options bag |
| Non-mutating counterpart of a verb, `sorted` for `sort` | `with…` prefix, as in `Array.prototype.with` and this library's own facade |
| Factory method prefix `make` | `create`, because JavaScript precedent is `createElement` and "Embrace precedent" decides it |

## The standard

Each rule cites the guideline it comes from. This section becomes
`docs/guides/api-naming.md` in phase 0.

1. **Clarity at the point of use.** "Clarity is more important than brevity."
   Long names are fine. "Include all the words needed to avoid ambiguity":
   `resolveAllContributions`, never `resolveAll`.
2. **Every word carries information.** "Omit needless words." `resolve` stays
   `resolve`, because adding "Service" says nothing new at the call site.
3. **Effects decide the part of speech.** "Those with side-effects should read as
   imperative verb phrases": `ensureServicesReady`, `close`. "Those without
   side-effects should read as noun phrases": `graphSnapshot()`. A method that
   returns a modified copy is named `with…`: `withServices`.
4. **Parameter shape follows the count of required inputs.**
   - None required: one optional options bag.
   - Exactly one required, and it reads as a phrase with the method name: that
     input positional, then a bag in which every property is optional.
     `ensureServicesReady(serviceKeys, options?)`.
   - Two or more required: one bag with named properties.
     `withServiceAlias({ aliasKey, targetServiceKey })`.
   - A builder method always takes exactly one bag, even for a single input:
     `withInstalledModule({ module })`. A builder chain is read far more often than
     it is written, and every line then names what it adds. `withServices` already
     is one: its bag maps each service name to its provider.
   - Never two positional parameters. When the single required input does not read
     as a phrase with the method name, it goes into the bag under its role name:
     `buildModule({ exportedServiceKeys })`, because "build module greeter" says the
     wrong thing.
5. **Names state role, subject and unit.** "Name variables, parameters, and
   associated types according to their roles." `abortSignal`, `totalTimeoutMs`,
   `maxConcurrentServiceKeys`. This includes generic parameters and the parameter
   names of callbacks shown in documentation.
6. **Booleans read as assertions.** `isOwnedByBag`, `isPresent`,
   `allowsScopedDependencies`, `factoryReceivesContext`.
7. **No abbreviations.** `factoryContext`, `dependencies`. The unit suffix `Ms`
   is kept as established precedent.
8. **Terms of art keep their established meaning.** `resolve`, `scoped`,
   `transient`, `singleton`, `fork`, `provider`, `token`. "Don't surprise an
   expert": a name borrowed from other containers must behave as it does there.
9. **Common words before library words.** "Avoid obscure terms if a more common
   word conveys meaning just as well." "Acquisition" names observability data
   only: snapshots, events, and the metadata an author attaches for them. It never
   names how a factory is written or how its result is treated.
10. **One word per concept.** The [vocabulary](#vocabulary) is the dictionary and
    `CONTEXT.md` holds the definitions.
11. **One casing per kind.** Identifiers are camelCase, types are PascalCase,
    runtime codes are `DI_BAG_SCREAMING_SNAKE`, and every string value is
    kebab-case.
12. **Methods before free functions.** "Prefer methods and properties to free
    functions." A facade function remains only when there is no object to hang it
    on.
13. **The summary test.** "If you are having trouble describing your API's
    functionality in simple terms, you may have designed the wrong API." A summary
    that needs "or" between two purposes marks a call to split.
14. **One way per task.** The existing rule stays. When this standard offers two
    shapes for one task, one is chosen and the other is not shipped.
15. **Exceptions are measured.** A shape that the compiler cannot support within
    budget falls back to its previous form. The exception is recorded in the
    naming guide with the measurement that forced it.

## Vocabulary

| Concept | Word | Retired words |
| --- | --- | --- |
| The value other code receives | service | |
| Name or typed token that identifies a service | service key | key, name, selection |
| Declaration of how a service is obtained | provider | registration, when it means the value |
| A provider stored under a service key in a builder | registration | |
| A registration's node in a built graph, public or module-private | binding | |
| One attempt to obtain a service from a binding | acquisition, observability only | |
| Releasing an owned value | disposal, disposer | cleanup |
| How a factory's return value is treated | factory return kind | acquisition mode, mode |
| What a decorator callback is handed | callback receives | direct, awaited |
| Waiting until listed services exist and are settled | service readiness | startup, start |
| Family-wide cached lifetime | singleton | root |
| A provider appended to a collection token's list | contribution | |
| Token that identifies exactly one service | single-service token | |
| Token that identifies an ordered list of services | collection token | the `all` reference, the contribution channel |
| Tracked derived bag | child scope | scope |
| Untracked derived bag | independent fork | fork, as a method name |

"Binding" is new to `CONTEXT.md`. "Cleanup", "startup" and "acquisition mode" are
removed from it.

## Rename map

`tools/codemod/rename-map.json` will be the single source for this map. The
codemod, the throwing stubs, the negative type fixture and the migration guide
are generated from it.

### Facade

| 0.4.0 | 0.5.0 | Rule |
| --- | --- | --- |
| `DiBag.createBuilder()` | unchanged | |
| `import { DiBag } from 'di-bag/node'` | removed: `import { DiBag } from 'di-bag'`, see [one entry point](#one-entry-point) | 14 |
| `DiBag.withConfiguration({ runtime, observers })` | `DiBag.withConfiguration({ runtime, lifecycleObservers })` | 5 |
| observer `{ onEvent, onError }` | `{ onLifecycleEvent, onObserverFailure }` | 5 |
| `runtime.isNativePromise` | unchanged, it already reads as an assertion | 6 |
| `DiBag.fromFactory(callback, { acquisitionMode, context })` | `DiBag.createProvider(factory, { factoryReturnKind?, factoryReceivesContext? })` | 3, 4, 9 |
| `DiBag.fromSyncFactory(callback)` | `DiBag.createProvider(factory, { factoryReturnKind: 'sync-value' })` | 10 |
| `DiBag.fromAsyncFactory(callback)` | `DiBag.createProvider(factory, { factoryReturnKind: 'native-promise' })` | 10 |
| `DiBag.fromFunction(tokens, callback, options?)` | `DiBag.createProviderFromFunction({ dependencies, factoryFunction, factoryReturnKind?, factoryReceivesContext? })` | 4 |
| `DiBag.fromClass(tokens, constructor, options?)` | `DiBag.createProviderFromClass({ dependencies, serviceClass, factoryReturnKind? })` | 4 |
| `DiBag.fromPlugin(dependencies, plugin, { acquisitionMode, validate })` | `DiBag.createProviderFromPlugin({ dependencies, pluginDescriptor, isValidPluginOutput, factoryReturnKind })` | 4, 5, 6 |
| `DiBag.token(key).of<S>()` | `DiBag.createToken(symbol).forService<S>()` | 3, 5 |
| new | `DiBag.createToken(symbol).forCollectionOf<Item>()`, see [collection tokens](#collection-tokens) | |
| `token.key` | `token.symbol` | 10 |
| `DiBag.optional(token)`, `DiBag.lazy(token)` | unchanged | 2 |
| `DiBag.all(token)` | removed: pass the collection token itself | 14 |
| `DiBag.withDisposal`, `withLifetime`, `withMetadata`, `transformService` | methods on the provider, below | 12 |

`factoryReturnKind` values: `'auto-detect'` (default, was `auto`), `'sync-value'`
(was `fromSyncFactory`, keeps its compile-time rejection of a Promise output),
`'native-promise'` (was `nativePromise`), `'uninspected'` (was `raw`: the returned
value is the service even when it is a Promise or a thenable).

### Provider

A plain factory is still accepted wherever a provider is. To decorate one, wrap
it with `createProvider` first.

| 0.4.0 | 0.5.0 | Rule |
| --- | --- | --- |
| `DiBag.withDisposal(registration, dispose)` | `provider.withDisposal(disposeService)` | 12 |
| `DiBag.withLifetime(registration, 'root', { allowScopedDependencies })` | `provider.withLifetime('singleton', { allowsScopedDependencies }?)` | 6, 8, 12 |
| `DiBag.withMetadata(registration, { static })` | `provider.withRegistrationMetadata(registrationMetadata)` | 13 |
| `DiBag.withMetadata(registration, { dynamic: { mode, describe } })` | `provider.withAcquisitionMetadata({ describeAcquisition, callbackReceives })` | 4, 13 |
| `DiBag.transformService(registration, { mode, transform, acquisitionMode })` | `provider.withTransformedService({ transformService, callbackReceives, transformReturnKind? })` | 4, 12 |

`callbackReceives` values: `'exposed-service'` (was `direct`: exactly what the
provider exposes, which for an asynchronous factory is its Promise) and
`'fulfilled-value'` (was `awaited`). The choice stays, because it is how a
decorator handles an asynchronous factory either as a Promise or as its result.
Lifetime values: `'singleton'`, `'scoped'`,
`'transient'`. A child scope that overrides a singleton gets its own instance; the
lifetime guide must say so, because a term of art must not surprise an expert.

The single-bag alternative, `createProvider(factory, { disposeService, lifetime,
registrationMetadata })`, is rejected by rule 14: it would be a second way to do
what the methods do.

### Builder

| 0.4.0 | 0.5.0 | Rule |
| --- | --- | --- |
| `register(more)` | `withServices(providersByName)` | 3 |
| `register(token, registration)` | `withTokenService({ token, provider })` | 3, 4 |
| `alias(destination, target)` | `withServiceAlias({ aliasKey, targetServiceKey })` | 3, 4 |
| `contribute(token, registration)` | `withCollectionContribution({ collectionToken, provider })`, collection tokens only | 3, 4 |
| `replace(key, registration)` | `withReplacedService({ serviceKey, provider })` | 3, 4 |
| `installModule(module)` | `withInstalledModule({ module })` | 3, 4 |
| `verifyGraph()` | `verifyGraphAtCompileTime()` | 1 |
| `buildModule(keys, { label })` | `buildModule({ exportedServiceKeys, moduleLabel? })` | 4, 5 |
| `build()` | `buildBag()` | 1 |
| `buildAndStart(keys, options)` | removed: `buildBag().ensureServicesReady(serviceKeys, options?)` | |

The internal `BindingGraph` already names these operations `withPublicBinding`,
`withContribution` and `withInstallation`. The public surface catches up with it.

### Bag

| 0.4.0 | 0.5.0 | Rule |
| --- | --- | --- |
| `resolve(token)` | `resolve(serviceKey)` | 2, 8 |
| `resolveAll(token)` | removed: `resolve(collectionToken)` returns the list | 14 |
| `inspect(token)` | `serviceSnapshot(serviceKey)` | 3 |
| `inspectAll(token)` | removed: `serviceSnapshot(collectionToken)` returns a list of snapshots | 14 |
| `inspectGraph()` | `graphSnapshot()` | 3 |
| `createScope()`, `createScope({ share })`, `createScope(keys, overrides, { share })` | `createChildScope({ replacedServiceKeys?, replacementProviders?, sharedParentServiceKeys? }?)` | 4 |
| `fork()`, `fork(keys, overrides)` | `createIndependentFork({ replacedServiceKeys?, replacementProviders? }?)` | 4 |
| `close({ signal, timeoutMs })` | `close({ abortSignal?, waitTimeoutMs? }?)` | 5 |
| new | `ensureServicesReady(serviceKeys, { abortSignal?, totalTimeoutMs?, maxConcurrentServiceKeys? }?)` | |

`ensureServicesReady` is the design agreed on 2026-09-20. It runs on any bag,
including a child scope and a fork. It waits until every listed service is ready,
resolves to the same bag, and closes the bag it was called on when a factory
fails, the signal aborts, or the deadline passes. A child scope closes only
itself. Invalid input rejects and leaves the bag untouched. A cancelled call
reports which services were still pending, as `close` does today.

### Module

| 0.4.0 | 0.5.0 | Rule |
| --- | --- | --- |
| `module.renameExport(oldKey, newKey)` | `module.withRenamedExport({ currentExportKey, newExportKey })` | 3, 4 |
| new | `module.withRenamedRequirement({ currentRequirementKey, newRequirementKey })`, see [requirement renaming](#requirement-renaming) | 3, 4 |

### Factory and disposer contexts

| 0.4.0 | 0.5.0 | Rule |
| --- | --- | --- |
| `AcquisitionContext` | `FactoryContext` | 9 |
| `factoryCtx.signal` | `factoryContext.abortSignal` | 5, 7 |
| `factoryCtx.pushDisposer(disposer)` | `factoryContext.pushDisposer(disposer)` | 7 |
| documented parameter `deps` | `dependencies` | 7 |
| documented parameter `disposerCtx` | `disposerContext` | 7 |
| `disposerCtx.reason` and its values | unchanged, already kebab-case | |

### Snapshots and events

| 0.4.0 | 0.5.0 | Rule |
| --- | --- | --- |
| `Presence.present` | `Presence.isPresent` | 6 |
| `label`, in snapshots, events and failures | `bindingLabel` | 5 |
| `BindingSnapshot.keys` | `serviceKeys` | 5 |
| `BindingSnapshot.owned` | `isOwnedByBag` | 6 |
| `BindingSnapshot.acquisitionMode` | `factoryReturnKind` | 10 |
| `tokenDependencies[].key`, `.kind` | `tokenSymbol`, `dependencyKind`; the kind `'all'` is removed, because a collection token says it | 5, 11 |
| `contributions[].token` | `collectionTokenSymbol` | 5 |
| `observedEdges[].from`, `.to` | `consumerBindingId`, `dependencyBindingId` | 5 |
| `CloseProgress.pending`, `.acquiring` | `disposersStillRunning`, `acquisitionsStillPending` | 5 |
| event kinds `cleanup-started`, `cleanup-failed`, `cleanup-completed` | `disposal-started`, `disposal-failed`, `disposal-completed` | 10 |
| other event kinds, `acquisitionId`, `bindingId`, `scopeId`, `state` values | unchanged | |

### Errors

A code names a failure kind and never a method. The method is in
`details.operation`. That is why today's codes went stale: `DI_BAG_INVALID_STARTUP`
and `DI_BAG_INVALID_ACQUISITION_MODE` embed names this note retires.

| 0.4.0 | 0.5.0 |
| --- | --- |
| `DiBagStartupError`, `DI_BAG_STARTUP_FAILED` | `DiBagServiceReadinessError`, `DI_BAG_SERVICE_READINESS_FAILED` |
| `DiBagStartupCancelledError`, `DI_BAG_STARTUP_CANCELLED`, `DI_BAG_STARTUP_TIMEOUT` | `DiBagServiceReadinessCancelledError`, `DI_BAG_SERVICE_READINESS_CANCELLED`, `DI_BAG_SERVICE_READINESS_TIMEOUT` |
| `DiBagCleanupError`, `CleanupFailure`, `DI_BAG_CLEANUP_FAILED` | `DiBagDisposalError`, `DisposalFailure`, `DI_BAG_DISPOSAL_FAILED` |
| `cleanupPromise`, `cleanupFailures`, `cleanupError` | `disposalPromise`, `disposalFailures`, `disposalError` |
| `DI_BAG_CLEANUP_AFTER_FACTORY` | `DI_BAG_DISPOSER_PUSHED_AFTER_FACTORY` |
| `DI_BAG_CYCLE` | `DI_BAG_DEPENDENCY_CYCLE` |
| `DI_BAG_DUPLICATE_REGISTRATION` | `DI_BAG_DUPLICATE_SERVICE_KEY` |
| `DI_BAG_DUPLICATE_METADATA` | `DI_BAG_DUPLICATE_METADATA_KEY` |
| `DI_BAG_MISSING_REGISTRATION`, `DI_BAG_INVALID_REPLACEMENT`, `DI_BAG_INVALID_ALIAS`, and the unknown-key sites of `DI_BAG_INVALID_OVERRIDE`, `_SCOPE`, `_STARTUP`, `_EXPORT` | `DI_BAG_UNKNOWN_SERVICE_KEY` |
| the missing-override sites of `DI_BAG_INVALID_OVERRIDE` and `_SCOPE` | `DI_BAG_MISSING_REPLACEMENT_PROVIDER` |
| the share-and-replace and share-a-transient sites of `DI_BAG_INVALID_SCOPE` | `DI_BAG_CONFLICTING_SCOPE_SELECTION` |
| `DI_BAG_INVALID_REGISTRATION`, when the value is neither a function nor a provider | `DI_BAG_INVALID_PROVIDER` |
| `DI_BAG_INVALID_METADATA`, when a describe callback returns a bad record | `DI_BAG_INVALID_ACQUISITION_METADATA` |
| every remaining malformed-input site of `DI_BAG_INVALID_ACQUISITION_MODE`, `_CLEANUP`, `_CLOSE`, `_CONFIGURATION`, `_CONSTRUCTOR`, `_EXPORT`, `_FACTORY`, `_FUNCTION`, `_LIFETIME`, `_METADATA`, `_OVERRIDE`, `_PLUGIN_OPTIONS`, `_REGISTRATION`, `_SCOPE`, `_STARTUP`, `_TRANSFORM` | `DI_BAG_INVALID_ARGUMENT` with `details: { operation, argument, expected }` |
| new | `DI_BAG_WRONG_TOKEN_KIND`, for a single-service token where a collection token is required, or the reverse |
| `DiBagCloseCancelledError`, `DiBagPluginValidationError`, and the 15 codes not listed | unchanged |

The 42 codes become about 31, including the new `DI_BAG_REMOVED_API` and `DI_BAG_WRONG_TOKEN_KIND`. The phase 8 plan fixes the mapping for each of the
123 throw sites by reading it. Compile-time message families keep their
anchors except `root-capture`, which becomes `singleton-capture`. Every message
that names a retired call is rewritten.

### Exported types

A type is renamed only when its name contains a retired word.

| 0.4.0 | 0.5.0 |
| --- | --- |
| `Registration` | `ProviderOrFactory` |
| `FactoryWithDisposal` | removed from the public surface, see spike S2 |
| `AcquisitionMode`, `PluginAcquisitionMode` | `FactoryReturnKind`, `PluginReturnKind` |
| `AcquisitionContext` | `FactoryContext` |
| `StartupOptions` | `EnsureServicesReadyOptions` |
| `ScopeOptions` | `CreateChildScopeOptions`, plus new `CreateIndependentForkOptions` |
| `ModuleOptions.label` | `ModuleOptions.moduleLabel` |
| `ObserverOptions` | `LifecycleObserver` |
| `ConfigurationOptions.observers` | `ConfigurationOptions.lifecycleObservers` |
| `CollectionDependency` | removed; new `CollectionToken` |
| `Renamed` and the other export-renaming support types | kept, joined by their requirement-renaming twins |
| `PluginOptions` | folded into the `createProviderFromPlugin` bag |
| `CompositionArguments`, `CompositionFunction` | `PositionalFactoryArguments`, `PositionalFactoryFunction` |
| `BuilderContribute` | `BuilderWithCollectionContribution` |
| `RegistrationSnapshot`, `BindingSnapshot`, `GraphSnapshot`, `AcquisitionSnapshot` | unchanged |

Generic parameters get role names: `Provider<Factory, RegistrationMetadata,
AcquisitionMetadataFrames, GraphContract, AcquiredValue>`, `Bag<Registrations,
Constraints>`, `Module<ExportedServices, RequiredServices, Constraints,
PublicProviders>`, `Token<TokenSymbol, Service>`. This does not break callers.

### Unchanged on purpose

| Name | Reason |
| --- | --- |
| `DiBag`, `Bag`, `Builder`, `Module`, `Provider`, `Token` | Product and term-of-art nouns |
| `resolve`, `close`, `pushDisposer` | Imperative verbs with effects, already clear |
| `'scoped'`, `'transient'`, `optional`, `lazy` | Established terms, rule 8 and rule 2 |
| Plugin descriptor `{ apiVersion: 1, create, dispose }` | It is a versioned contract with third parties; renaming it needs `apiVersion: 2` and is a separate decision |
| The `Ms` unit suffix | Established JavaScript precedent |

## Behavior changes

Four changes from the orthogonality review of 2026-09-19 ship in the same
release. Each deletes a call that this note would otherwise only rename. Each
states what it costs.

### Collection tokens

A token is either a single-service token or a collection token, never both.

```ts
const clockToken       = DiBag.createToken(clockSymbol).forService<Clock>();
const controllersToken = DiBag.createToken(controllersSymbol).forCollectionOf<Controller>();

builder.withTokenService({ token: clockToken, provider: createClock });
builder.withCollectionContribution({ collectionToken: controllersToken, provider: createUsersController });

bag.resolve(controllersToken);                       // readonly Controller[]
await bag.ensureServicesReady([controllersToken]);   // waits for every contribution
```

- A collection token is an ordinary service key whose service is
  `readonly Item[]`. It works in `resolve`, dependency tuples, `lazy`,
  `ensureServicesReady`, `serviceSnapshot` and as an alias target, so a named
  factory reaches the list through `withServiceAlias`.
- The wrong kind is a compile error and throws `DI_BAG_WRONG_TOKEN_KIND`.
  `optional` on a collection token is a compile error, because a collection is
  never absent.
- The list is not cached. Every read builds a fresh frozen array. Each
  contribution keeps its own dependencies, lifetime and disposer. An empty list
  is valid.
- A collection symbol can no longer hold a single service, so that slot holds
  the replacement list in a fork, a child scope or `withReplacedService`. A test
  can now swap the whole list.
- Sharing a list with a child scope stays out: members can have different
  lifetimes and a transient member cannot be shared.

**Cost.** One identity can no longer serve as both the one and the many. The four
designs that used both channels (a composite built from its parts, a default plus
candidates, a fallback after a chain, an override on top of defaults) need two
tokens, such as `loggerToken` and `loggerSinksToken`. The composite becomes a
recipe in `docs/agent/recipes.md`.

### One entry point

`di-bag/node` is removed. `di-bag` already configures itself: on Node from 22.3,
on Bun and on Deno it reads the host's native Promise check through
`process.getBuiltinModule`, a call and not an import, so the entry still bundles
for browsers. Everywhere else it is configurable:
`DiBag.withConfiguration({ runtime: { isNativePromise } })`, or every registration
states its `factoryReturnKind` and no check is needed.

**Cost.** Node before 22.3, which is past or near its end of life, no longer works
by changing an import. It needs the one-line configuration above, and
`DI_BAG_CLASSIFIER_REQUIRED` already says so. About 200 files in this repo import
the second entry and move to the main one, 39 of them tests.

### Requirement renaming

`module.withRenamedRequirement({ currentRequirementKey, newRequirementKey })` is
the twin of `withRenamedExport`. Today only exports can be renamed. Two modules
that both require `config`, as the module layout in `AGENTS.md` suggests, collide,
and the fix is a wrapper module with an adapter service and hand-written
re-exports. Both methods return a new module value, so a renamed module stays
reusable across hosts. Only string service keys can be renamed. Tokens are
globally unique identities and need no renaming.

**Cost.** One more method on `Module`, and new type-level remapping of a module's
requirements and constraints. The work lands on a rarely called method, not on
module installation, which is a hot path.

### Factory context for positional functions

`createProviderFromFunction` accepts `factoryReceivesContext: true` and passes the
`FactoryContext` as the last argument. Today a factory that depends on tokens has
no way to receive the abort signal or to push a disposer. Classes and plugins do
not get this: a plain class should not depend on the library, and the plugin
contract belongs to third parties. A class that needs the signal is wrapped in a
function factory.

### Orthogonality items not taken

| Item | Reason |
| --- | --- |
| Dependency references accepted by `resolve`, `serviceSnapshot` and `ensureServicesReady`, and nested references | Collection tokens cover the valuable part. What remains is `resolve` with `optional`, which a membership check covers, and `resolve` with `lazy`, which is pointless |
| References registrable as providers, folding `withServiceAlias` | References take tokens only. Giving named factories optional and lazy dependencies on named services needs references typed from the builder's registrations, which is heavy type machinery for a gap the positional adapter already fills |
| A multi-key builder replace | The single-key form has the compile-cost fast path, and forks already replace several keys |
| One cancelled-error class for readiness and close | The two now mean different things: a readiness cancellation closes the bag, a close cancellation only stops waiting |
| One input rule for decorators, removing the choice of what a callback receives | It takes away the ability to handle the pending Promise of an asynchronous factory inside a decorator. The choice stays as `callbackReceives` |
| Configuration at bag creation in place of `withConfiguration` | The facade is the only object that exists before any bag does. If building steps are ever observed, that is the only home for the observer. Observers for a single scope move to the follow-up program |
| Install-time name mapping in place of module methods | A renamed module is a reusable value, and module installation is a hot path that should not gain type-level work |
| Factory context for classes and plugins | See above |

## Shapes decided by measurement

Six shapes change how TypeScript infers callback parameters or how much work the
checker does. Each is spiked in phase 1 before any rename lands. A shape is
adopted when all three hold:

1. Every positive and negative compiler fixture passes, and each diagnostic still
   lands on the offending property with its `Unsatisfied` message.
2. `npm run benchmark:types` regresses by no more than 10% in compile time and
   instantiations at the 100 and 500 operation cases.
3. `npm run benchmark:compiler-ceiling` limits drop by no more than 10%.

| Spike | Shape | Fallback when it fails |
| --- | --- | --- |
| S1 | Two-input builder methods take a bag: `withTokenService({ token, provider })` | That method keeps two positional parameters |
| S2 | Decorators are methods on `Provider`, and `FactoryWithDisposal` leaves the public surface. The zero-dependency fast path of `withReplacedService` must survive | Facade functions with bags: `DiBag.providerWithDisposal({ provider, disposeService })` |
| S3 | `replacementProviders` is contextually typed from `replacedServiceKeys` inside one object literal | The pair stays positional, followed by the bag |
| S4 | `factoryFunction` parameters are inferred from `dependencies` inside one object literal | The pair stays positional, followed by the bag |
| S5 | `resolve` returns `readonly Item[]` for a collection token through a conditional on the hottest signature | A separate `resolveCollection(collectionToken)` call |
| S6 | `withRenamedRequirement` remaps a module's requirements and constraints in its type | Requirement renaming is dropped |

Rule 15 applies to every fallback.

## Migration support

- **A type-aware codemod.** A text replacement is unsafe: `.replace(`, `.all(`
  and `.resolve(` match `String.replace`, `Promise.all` and `Promise.resolve`
  thousands of times in this repo alone. The codemod uses the TypeScript compiler
  API, as `tools/graph` already does, and rewrites only calls whose receiver is a
  DI Bag facade, builder, bag, module or provider. It also reshapes arguments,
  for example `alias(a, b)` into `withServiceAlias({ aliasKey: a,
  targetServiceKey: b })`. It rewrites the creation of a token that is only ever
  contributed to into `forCollectionOf`, and its reads into plain `resolve` calls
  and plain dependency entries. It ships as the package `di-bag-codemod`, next to
  `di-bag-graph`. The repo is its first user: about 1,100 `build()` calls, 2,000
  `register` calls and 1,700 `createBuilder` chains.
- **Throwing stubs.** Every removed runtime name stays for the 0.5 line as a
  function that throws `DI_BAG_REMOVED_API` and names its replacement. Agents
  trained on 0.3 and 0.4 will call the old names.
- **Compile-time removal.** `tests/types/negative/api-renaming.ts` is extended
  from the rename map, so every old name fails to compile.
- **A migration guide** generated from the same map, and a breaking-changes
  section in `CHANGELOG.md`.
- **Manual steps the codemod reports but does not perform.** A token used on
  both channels must be split into two tokens by hand. In this repo only one
  control test does that.

## Roadmap

All phases land on an integration branch, `next`. The documentation site deploys
from `main` on every push, so a half-renamed `main` would publish unreleased
names while npm still serves 0.4.0. Each phase is one pull request and is green
on `npm run check`, `npm run docs:check` and `npm run graph:check` by itself.

| Phase | Content | Kind |
| --- | --- | --- |
| 0 | The naming guide, the `CONTEXT.md` vocabulary, and a naming test that reads the built declarations. The test checks `with…` on builder methods, assertion-style booleans, kebab-case string values and an abbreviation denylist. It starts with a list of known violations that must be empty by phase 8 | Not breaking |
| 1 | Spikes S1 to S6 with recorded measurements. `rename-map.json` and the codemod, proven on a copy of the test suite | Not breaking |
| 2 | Documented parameter names, callback parameter names, generic parameter names, and summaries that pass the "or" test | Not breaking |
| 3 | `ensureServicesReady`, the pending-work report, `close` options, and the service readiness errors. `buildAndStart` is removed | Behavior |
| 4 | Collection tokens. `all`, `resolveAll` and `inspectAll` are removed under their old names | Behavior |
| 5 | Builder, bag and module methods and the configuration option names, applied with the codemod. `di-bag/node` is removed and its imports move to `di-bag`. The graph tool learns the new chain endings and keeps the old ones | Rename |
| 6 | Requirement renaming | Behavior, additive |
| 7 | The provider authoring surface: `createProvider` family, `factoryReturnKind`, `FactoryContext`, provider methods or their fallback, the metadata split, `callbackReceives`, `singleton`, `createToken`, and the factory context for positional functions | Rename |
| 8 | Snapshot and event fields, the disposal vocabulary, error classes and codes, the errors page and compile-time messages. The known-violations list is empty | Rename |
| 9 | Throwing stubs, the extended negative fixture, the migration guide, the changelog, regenerated agent docs, and the 0.5.0 release candidate through `PUBLISHING.md`. `next` merges into `main` | Release |

Phase 3 comes first among the breaking phases so the first method written under
the standard exists as the example. Every behavior phase comes before the rename
phase that would touch the same calls, so nothing is renamed and then removed:
4 comes before 5. Phase 5 proves the codemod on the largest call counts. Phase 8
is late because error codes touch the most test assertions.

## Out of scope

This note changes names and parameter shapes, adds `ensureServicesReady`, and
makes the four [behavior changes](#behavior-changes). These approved items are a
separate program, and the names above leave room for them:

- Richer context and control: factory context identity, failure context for
  factory errors, scope and bag labels, event timing, bag state and membership,
  runtime description of modules, disposer context, `Symbol.asyncDispose`,
  services marked must-be-ready, acquisition interceptors, observers for a single
  scope or fork, per-provider time limits, a failure policy for
  `ensureServicesReady`.

## Risks

- **Compile cost.** Bags, provider methods, collection tokens and requirement
  renaming can raise instantiation counts. The spikes and rule 15 contain this.
- **Behavior and names change in one release.** Four behavior changes ride along
  with the renames, which raises the risk of the release and lowers the number of
  migrations to one. Each behavior phase is its own pull request with its own
  tests, so a problem can be reverted without touching a rename phase.
- **Agent regressions.** Longer names cost tokens and old names are in training
  data. The throwing stubs answer the second. For the first, run the agent eval
  in `scripts/agent-eval` on 0.4.0 before phase 3 and on the release candidate in
  phase 7, and compare pass rates.
- **Review load.** Phases 4 to 6 produce very large mechanical diffs. Each of
  those pull requests separates the hand-written commits from the codemod commit,
  and records the codemod command in the commit message so a reviewer can
  reproduce it.
- **A second package to release.** `di-bag-graph` must ship a version that reads
  0.5.0 chains before 0.5.0 is published.

## Acceptance

- The naming test passes with an empty known-violations list.
- No token is accepted by both `withTokenService` and
  `withCollectionContribution`, at compile time and at run time.
- A fork replaces a whole collection in a test, and `ensureServicesReady` waits
  for a collection.
- `withRenamedRequirement` renames a requirement without a wrapper module.
- No 0.4.0 name in the rename map compiles, and each throws
  `DI_BAG_REMOVED_API` at runtime.
- The codemod turns the 0.4.0 copies of `examples/` into code that type-checks
  against 0.5.0 without hand edits.
- `npm run check`, `docs:check`, `graph:check`, `check:native`, `check:platform`
  and `check:react-browser` pass on `next`.
- Every API card summary passes the "or" test, and every task in the card's
  "one way per task" table names a 0.5.0 call.
