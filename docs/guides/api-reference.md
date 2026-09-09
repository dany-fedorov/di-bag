# API reference

[Introduction](../../README.md) · [Complete tutorial](tutorial.md) · [Server recipes](server-integration.md)

Use this page to find an API and understand its role. The
[complete tutorial](tutorial.md) teaches the concepts with examples; the generated
reference provides exact signatures, generic constraints, overloads, parameters,
return types, and links to source declarations.

## Generated reference

| Entry point | What it exposes |
| --- | --- |
| [`di-bag`](../reference/index/index.md) | Portable facade, public types, and the four error classes. |
| [`di-bag/node`](../reference/node/index.md) | The same API with Node/Bun native-Promise detection configured. |
| [`di-bag/sas-box`](../reference/sas-box/index.md) | `fromSasBox` structural adapter. |
| [`di-bag/val-box`](../reference/val-box/index.md) | `fromValBox`, `fromValBoxAsync`, and the `ValBoxFrame` type. |

Start with the [`Facade`](../reference/index/interfaces/Facade.md),
[`Builder`](../reference/index/interfaces/Builder.md), and
[`Bag`](../reference/index/interfaces/Bag.md). Reusable graph composition uses
[`ModuleBuilder`](../reference/index/interfaces/ModuleBuilder.md) and
[`Module`](../reference/index/interfaces/Module.md). The reference represents
these type-only exports as interfaces; construct values through `DiBag`.

The generated Markdown is committed alongside the source. CI compares it with
fresh output and verifies public export and callable-overload coverage against
the TypeScript compiler. See [documentation maintenance](documentation.md) for
how to regenerate it.

## API at a glance

Import `DiBag` and the four error classes from `di-bag/node` in Node or Bun,
or from `di-bag` when using explicit portable acquisition modes. Both entries
expose the same methods and types. Each table links to explanations and examples
in the tutorial; the [server guide](server-integration.md) puts them into an application.

### Configure and describe services

These methods are available on `DiBag` and every facade returned by `configure`
or `observe`. Creating a provider describes work; registration and resolution
happen separately.

| Method | Result and purpose |
| --- | --- |
| `begin()` | Create an empty immutable [builder](tutorial.md#compose-services). |
| `module()` | Create an immutable [module builder](tutorial.md#reuse-named-modules). |
| `configure({ isNativePromise })` | Return a new facade with an application-supplied [native-Promise predicate](tutorial.md#compose-services). |
| `observe({ onEvent, onError })` | Return a new facade with another [lifecycle observer](tutorial.md#observe-lifecycle-transitions). Both callbacks are required. |
| `factory(create, { acquisition })` | Describe a factory with explicit `raw`, `native`, or `auto` [acquisition](tutorial.md#compose-services). |
| `token(key).of<Service>()` | Create a [typed token](tutorial.md#use-typed-tokens-for-explicit-positional-injection) from a canonical unique symbol. |
| `fromTokens(dependencies, create, options?)` | Inject a tuple of [tokens or dependency references](tutorial.md#use-typed-tokens-for-explicit-positional-injection) into a callback in tuple order. |
| `fromFunction(dependencies, fn, options?)` | Adapt an existing [positional function](tutorial.md#adapt-classes-and-positional-functions). |
| `fromClass(dependencies, Constructor, options?)` | Adapt an existing [constructor](tutorial.md#adapt-classes-and-positional-functions). |
| `optional(token)` | Describe a dependency that supplies `undefined` when [absent](tutorial.md#declare-optional-and-lazy-dependencies). |
| `lazy(token)` | Describe a dependency supplied as a [lookup function](tutorial.md#declare-optional-and-lazy-dependencies). |
| `all(token)` | Describe an [ordered collection](tutorial.md#compose-an-ordered-collection) dependency. |
| `fromPlugin(dependencies, descriptor, options)` | [Validate an application-selected plugin](tutorial.md#admit-an-application-selected-plugin); options require `acquisition: 'raw'` or `'native'` and `validate`. |
| `withDisposal(registration, dispose)` | Add [ownership and cleanup](tutorial.md#attach-cleanup-with-withdisposal) of the registration's acquired value. |
| `withLifetime(registration, lifetime, options?)` | Choose [`root`, `scoped`, or `transient`](tutorial.md#choose-root-scoped-or-transient-caching); only `root` accepts `captureScoped`. |
| `withContext(create, options?)` | Give a factory an [acquisition context](tutorial.md#start-selected-services-and-cancel-cooperatively) as its second argument. |
| `withMetadata(registration, metadata)` | Attach [static metadata](tutorial.md#attach-metadata-and-inspect-without-resolving). |
| `mapSync(registration, project, options?)` | [Project the exposed value](tutorial.md#project-services-explicitly) immediately, preserving raw arguments and results. |
| `mapAsync(registration, project)` | Await the source and project it through an explicit [async boundary](tutorial.md#project-services-explicitly). |

The optional options argument on `fromTokens`, `fromFunction`, `fromClass`,
`withContext`, and `mapSync` selects the new stage's `acquisition` mode. Omitting
it uses `auto`. `mapAsync` is always an async boundary. Configuration returns a
new facade; it does not change global state or retrofit existing builders.

### Build and reuse a graph

Builder operations return a new builder. Keep the returned value or chain the
next call; they do not mutate the original.

| Method | Available on | Purpose |
| --- | --- | --- |
| `add(registrations)` | Builder, ModuleBuilder | Add new [named factories](tutorial.md#compose-services); duplicate keys reject. |
| `bind(token, registration)` | Builder, ModuleBuilder | Bind a [typed token](tutorial.md#use-typed-tokens-for-explicit-positional-injection). |
| `replace(nameOrToken, registration)` | Builder, ModuleBuilder | Replace one existing registration while checking its consumers and token contract. |
| `alias(destination, target)` | Builder, ModuleBuilder | Add another [name or token lookup](tutorial.md#give-a-dependency-another-lookup-name) for an existing service. |
| `contribute(token, registration)` | Builder, ModuleBuilder | Append an [ordered contribution](tutorial.md#compose-an-ordered-collection). |
| `install(module)` | Builder | Install a sealed [module](tutorial.md#reuse-named-modules) with private services and public exports. |
| `end()` | Builder | Check graph completeness and return a lazy bag. |
| `start(keys, options?)` | Builder | Return a promise for a fresh bag after [selected services are ready](tutorial.md#start-selected-services-and-cancel-cooperatively). |
| `exports(keys)` | ModuleBuilder | Seal the module and choose its public names and tokens. |
| `rename(oldName, newName)` | Sealed Module | Return a module view with one string-named export renamed. |

Modules do not resolve services or have a close method. Installing a module
gives its acquisitions an owning bag. Module builders do not expose `install`,
`end`, or `start`; compose sealed modules through an application builder.

### Use and close a bag

| Method | Purpose |
| --- | --- |
| `resolve(nameOrToken)` | Lazily acquire a service, preserving its inferred return type. |
| `resolveAll(token)` | Resolve the [ordered contributions](tutorial.md#compose-an-ordered-collection) as a readonly array. |
| `inspect(nameOrToken)` | Copy [metadata and acquisition state](tutorial.md#attach-metadata-and-inspect-without-resolving) without resolving. |
| `inspectAll(token)` | Inspect contribution descriptions and attempts without resolving. |
| `scope()` | Create a tracked [child scope](tutorial.md#create-tracked-child-scopes). |
| `scope({ share: keys })` | Create a child that explicitly borrows selected parent acquisitions. |
| `scope(keys, overrides, options?)` | Create a child with checked replacements and optional disjoint `share` selection. |
| `fork()` | Create an [independent bag](tutorial.md#fork-for-scopes-and-tests) with fresh instances. |
| `fork(keys, overrides)` | Create an independent bag with selected replacements. |
| `close()` | Return the shutdown promise; stop new resolutions, drain work, and dispose owned resources. Repeated calls share the same promise. |

### Optional adapter entry points

| Import | Function | Options |
| --- | --- | --- |
| `di-bag/sas-box` | `fromSasBox(registration, options)` | Required `mode: 'sync'`, `'async'`, or `'sync-first'`; `acquisition` is allowed only in `sync` mode. |
| `di-bag/val-box` | `fromValBox(registration, options?)` | Immediate snapshot; optional `value: 'required'` or `'presence'` and compatible `acquisition`. An acquisition-only object selects required mode. |
| `di-bag/val-box` | `fromValBoxAsync(registration, options?)` | Await source and result; supplied options must specify `value: 'required'` or `'presence'`. |

These are standalone named imports from their subpaths, not methods on `DiBag`.
See [box adapters](tutorial.md#optional-box-adapters) for capability requirements, metadata,
absence, and ownership.

## Errors and recovery

The four error classes below are runtime exports from both `di-bag` and
`di-bag/node`. Each extends the built-in `Error` family and has a corresponding
`name`. Catch them with `instanceof` when choosing a recovery path.

| Error | When it appears | Public information |
| --- | --- | --- |
| [`DiBagCleanupError`](../reference/index/classes/DiBagCleanupError.md) | `close()` finishes attempting cleanup and one or more disposers failed. | Extends `AggregateError`; `errors` contains the original errors, and readonly `failures` associates each with `acquisitionId`, `bindingId`, `label`, and `error`. |
| [`DiBagPluginError`](../reference/index/classes/DiBagPluginError.md) | A plugin descriptor or acquired output fails the plugin boundary checks. | `phase` is `'descriptor'` or `'output'`; `reason` describes the rejection. |
| [`DiBagStartupError`](../reference/index/classes/DiBagStartupError.md) | Selected startup acquisition fails and rollback has completed. | `cause` is the acquisition error; `cleanupFailures` contains disposal failures; `cleanupError` retains the complete cleanup error when present. |
| [`DiBagStartupCancelledError`](../reference/index/classes/DiBagStartupCancelledError.md) | An external signal or startup deadline interrupts startup. | `reason` is `'aborted'` or `'timeout'`; `cause` retains the cancellation reason; `cleanup` is a `Promise<void>` for eventual shutdown. |

Given an existing application bag named `app`:

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
type Application = typeof app;
```

These names refer to the clock, stamp registration, and app in the tutorial’s
[typed-token example](tutorial.md#use-typed-tokens-for-explicit-positional-injection). Shorter `Bag`, `Module`, or `Provider` annotations cannot erase
retained private-consumer, token, lifetime, or ownership contracts.

### Application-facing types

| Exports | Purpose |
| --- | --- |
| [`Facade`](../reference/index/interfaces/Facade.md) | The complete `DiBag` method surface, including configured and observed facades. |
| [`Builder`](../reference/index/interfaces/Builder.md), [`Bag`](../reference/index/interfaces/Bag.md) | A checked immutable builder and a resolving/owning bag. |
| [`ModuleBuilder`](../reference/index/interfaces/ModuleBuilder.md), [`Module`](../reference/index/interfaces/Module.md) | A private composition builder and its sealed export view. |
| [`Registration`](../reference/index/type-aliases/Registration.md), [`DisposableFactory`](../reference/index/type-aliases/DisposableFactory.md) | Accepted registration shapes and an owned factory description. |
| [`Provider`](../reference/index/interfaces/Provider.md) | A provider description retaining its factory, metadata, frames, graph contracts, and acquired-value type. |
| [`AcquisitionMode`](../reference/index/type-aliases/AcquisitionMode.md), [`RuntimeOptions`](../reference/index/interfaces/RuntimeOptions.md) | Acquisition mode literals and the `isNativePromise` configuration callback. |
| [`Lifetime`](../reference/index/type-aliases/Lifetime.md) | The `'root'`, `'scoped'`, and `'transient'` caching choices. |
| [`AcquisitionContext`](../reference/index/interfaces/AcquisitionContext.md), [`ContextualFactory`](../reference/index/type-aliases/ContextualFactory.md) | Factory cancellation context (`signal`) and the adapted contextual factory signature. |
| [`StartupOptions`](../reference/index/interfaces/StartupOptions.md) | Optional `signal`, `timeoutMs`, and `concurrency` fields for `start`. |
| [`ScopeOptions`](../reference/index/type-aliases/ScopeOptions.md) | The checked `share` selection accepted by `scope`. |
| [`Token`](../reference/index/interfaces/Token.md), [`TokenBase`](../reference/index/interfaces/TokenBase.md), [`TokenKey`](../reference/index/type-aliases/TokenKey.md), [`TokenService`](../reference/index/type-aliases/TokenService.md) | Typed token identity, its common handle type, and key/service projections. |
| [`OptionalReference`](../reference/index/type-aliases/OptionalReference.md), [`LazyReference`](../reference/index/type-aliases/LazyReference.md), [`AllReference`](../reference/index/type-aliases/AllReference.md), [`Dependency`](../reference/index/type-aliases/Dependency.md) | The token reference forms accepted in positional dependency tuples. |
| [`CompositionArguments`](../reference/index/type-aliases/CompositionArguments.md), [`CompositionFunction`](../reference/index/type-aliases/CompositionFunction.md) | Positional argument compatibility and callback signatures for function/constructor adaptation. |
| [`Presence`](../reference/index/type-aliases/Presence.md) | `{ present: false }` or `{ present: true, value }`, including present `undefined`. |
| [`FramePresenceTuple`](../reference/index/type-aliases/FramePresenceTuple.md), [`AcquisitionSnapshot`](../reference/index/interfaces/AcquisitionSnapshot.md), [`InspectionSnapshot`](../reference/index/interfaces/InspectionSnapshot.md) | Inspection frames, acquisition state, and registration metadata snapshots. |
| [`ValBoxFrame`](../reference/val-box/type-aliases/ValBoxFrame.md) | Acquired box metadata with `kind`, `metadata`, and `alias`. |
| [`CleanupFailure`](../reference/index/interfaces/CleanupFailure.md) | The detached acquisition identity, label, and original cleanup error. |
| [`ObserverOptions`](../reference/index/interfaces/ObserverOptions.md), [`ObserverCallback`](../reference/index/type-aliases/ObserverCallback.md), [`ObserverErrorCallback`](../reference/index/type-aliases/ObserverErrorCallback.md) | Observer configuration and its event/failure callbacks. |
| [`LifecycleEvent`](../reference/index/type-aliases/LifecycleEvent.md), [`ObserverFailure`](../reference/index/interfaces/ObserverFailure.md), [`ScopeEventFields`](../reference/index/interfaces/ScopeEventFields.md), [`AcquisitionEventFields`](../reference/index/interfaces/AcquisitionEventFields.md) | Discriminated lifecycle events and observer failure context. |
| [`PluginAcquisition`](../reference/index/type-aliases/PluginAcquisition.md), [`PluginOptions`](../reference/index/interfaces/PluginOptions.md), [`PluginPredicate`](../reference/index/type-aliases/PluginPredicate.md), [`PluginResult`](../reference/index/type-aliases/PluginResult.md) | Plugin mode, validation options, output predicate, and resulting provider. |
| [`fromPlugin`](../reference/index/type-aliases/fromPlugin.md) | A type-only export of the function declaration, usable with `typeof fromPlugin`; call the runtime API as `DiBag.fromPlugin`. |

### Provider and module projections

| Exports | Purpose |
| --- | --- |
| [`ProviderFactory`](../reference/index/type-aliases/ProviderFactory.md), [`ProviderOutput`](../reference/index/type-aliases/ProviderOutput.md), [`ProviderAcquired`](../reference/index/type-aliases/ProviderAcquired.md), [`ProviderNeeds`](../reference/index/type-aliases/ProviderNeeds.md) | Extract the factory, exposed result, acquired value, and named requirements from a registration. Output and acquired value can differ across async boundaries. |
| [`ProviderMetadata`](../reference/index/type-aliases/ProviderMetadata.md), [`ProviderAcquisitionMetadata`](../reference/index/type-aliases/ProviderAcquisitionMetadata.md) | Extract static metadata and the tuple of acquisition metadata frames. |
| [`ProviderGraph`](../reference/index/type-aliases/ProviderGraph.md) | Retain a provider's token and other graph obligations. |
| [`ProviderTokenNeeds`](../reference/index/type-aliases/ProviderTokenNeeds.md), [`ProviderOptionalTokenNeeds`](../reference/index/type-aliases/ProviderOptionalTokenNeeds.md), [`ProviderAllTokenNeeds`](../reference/index/type-aliases/ProviderAllTokenNeeds.md) | Extract required/lazy, optional, and collection token requirements. |
| [`ModuleProvides`](../reference/index/type-aliases/ModuleProvides.md), [`ModuleRequires`](../reference/index/type-aliases/ModuleRequires.md) | Extract the readonly service exports and external requirements of a sealed module. |
| [`ModuleConstraints`](../reference/index/type-aliases/ModuleConstraints.md) | Compute retained private-consumer and lifetime constraints for a registration map and public selection. |
| [`PublicProviders`](../reference/index/type-aliases/PublicProviders.md), [`ModulePublicProviders`](../reference/index/type-aliases/ModulePublicProviders.md) | Preserve provider contracts when projecting public module registrations. |
| [`Renamed`](../reference/index/type-aliases/Renamed.md) | Represent the checked renaming of a module's public view. |

### Graph composition support types

These exports support reusable generic helpers and portable declaration output.
Most applications can let the builder infer them. They express compile-time
contracts; they do not perform runtime validation.

| Exports | Purpose |
| --- | --- |
| [`Provided`](../reference/index/type-aliases/Provided.md) | Map registrations to their exposed service types. |
| [`Entries`](../reference/index/type-aliases/Entries.md), [`From`](../reference/index/type-aliases/From.md) | Convert between a registration map and its entry representation. |
| [`Merge`](../reference/index/type-aliases/Merge.md), [`Selected`](../reference/index/type-aliases/Selected.md) | Model merged registration maps and selected override registrations. |
| [`Checked`](../reference/index/type-aliases/Checked.md), [`Complete`](../reference/index/type-aliases/Complete.md) | Check dependency shape compatibility and graph completeness. |
| [`Selection`](../reference/index/type-aliases/Selection.md), [`Overrides`](../reference/index/type-aliases/Overrides.md), [`ForkContext`](../reference/index/type-aliases/ForkContext.md) | Validate selections and replacement compatibility while preserving contextual inference. |
| [`Binding`](../reference/index/type-aliases/Binding.md), [`TokenMember`](../reference/index/type-aliases/TokenMember.md), [`TokenGraph`](../reference/index/type-aliases/TokenGraph.md) | Retain typed bindings, validate token membership, and represent token obligations. |
| [`ReboundProviders`](../reference/index/type-aliases/ReboundProviders.md), [`ReboundSelection`](../reference/index/type-aliases/ReboundSelection.md), [`SelectionKey`](../reference/index/type-aliases/SelectionKey.md) | Preserve token bindings across replacement and map selections to their string/symbol keys. |
| [`AliasRegistration`](../reference/index/type-aliases/AliasRegistration.md), [`AliasEntries`](../reference/index/type-aliases/AliasEntries.md), [`AliasOutput`](../reference/index/type-aliases/AliasOutput.md) | Model an alias registration, its graph entries, and its exposed result. |
| [`Contribution`](../reference/index/type-aliases/Contribution.md), [`ContributionConstraint`](../reference/index/type-aliases/ContributionConstraint.md) | Describe an ordered contribution and its retained requirements. |
| [`ModuleContributions`](../reference/index/type-aliases/ModuleContributions.md), [`ModuleContributionConstraints`](../reference/index/type-aliases/ModuleContributionConstraints.md) | Preserve contributions and their requirements in modules. |
| [`BuilderContribute`](../reference/index/type-aliases/BuilderContribute.md), [`ModuleContribute`](../reference/index/type-aliases/ModuleContribute.md) | The generic `contribute` signatures on application and module builders. |
| [`DisjointScopeSelection`](../reference/index/type-aliases/DisjointScopeSelection.md) | Enforce separate override and sharing selections. |
| [`UnsharedAliases`](../reference/index/type-aliases/UnsharedAliases.md), [`ScopedAliases`](../reference/index/type-aliases/ScopedAliases.md), [`SharedAliasProviders`](../reference/index/type-aliases/SharedAliasProviders.md) | Preserve alias contracts as scopes inherit or explicitly share services. |
| [`CheckedLifetimes`](../reference/index/type-aliases/CheckedLifetimes.md), [`CheckedScopeLifetimes`](../reference/index/type-aliases/CheckedScopeLifetimes.md) | Check root capture and lifetime compatibility in completed graphs and scope overrides. |
| [`LexicalContext`](../reference/index/type-aliases/LexicalContext.md), [`RenamedLifetimeObligation`](../reference/index/type-aliases/RenamedLifetimeObligation.md), [`RenamedLifetimeProviders`](../reference/index/type-aliases/RenamedLifetimeProviders.md) | Retain lifetime ownership and requirements through lexical module boundaries and renaming. |

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

## Usage topics

The detailed examples live in the [complete tutorial](tutorial.md). These links
also preserve existing bookmarks into the earlier combined guide.

### Compose services

[Read the tutorial section](tutorial.md#compose-services).

### Reuse named modules

[Read the tutorial section](tutorial.md#reuse-named-modules).

### Use typed tokens for explicit positional injection

[Read the tutorial section](tutorial.md#use-typed-tokens-for-explicit-positional-injection).

### Adapt classes and positional functions

[Read the tutorial section](tutorial.md#adapt-classes-and-positional-functions).

### Declare optional and lazy dependencies

[Read the tutorial section](tutorial.md#declare-optional-and-lazy-dependencies).

### Give a dependency another lookup name

[Read the tutorial section](tutorial.md#give-a-dependency-another-lookup-name).

### Compose an ordered collection

[Read the tutorial section](tutorial.md#compose-an-ordered-collection).

### Attach metadata and inspect without resolving

[Read the tutorial section](tutorial.md#attach-metadata-and-inspect-without-resolving).

### Observe lifecycle transitions

[Read the tutorial section](tutorial.md#observe-lifecycle-transitions).

### Admit an application-selected plugin

[Read the tutorial section](tutorial.md#admit-an-application-selected-plugin).

### Async edges are explicit

[Read the tutorial section](tutorial.md#async-edges-are-explicit).

### Project services explicitly

[Read the tutorial section](tutorial.md#project-services-explicitly).

### Attach cleanup with `withDisposal`

[Read the tutorial section](tutorial.md#attach-cleanup-with-withdisposal).

### Start selected services and cancel cooperatively

[Read the tutorial section](tutorial.md#start-selected-services-and-cancel-cooperatively).

### Choose root, scoped or transient caching

[Read the tutorial section](tutorial.md#choose-root-scoped-or-transient-caching).

### Create tracked child scopes

[Read the tutorial section](tutorial.md#create-tracked-child-scopes).

### Fork for scopes and tests

[Read the tutorial section](tutorial.md#fork-for-scopes-and-tests).

### WBS-shaped ownership example

[Read the tutorial section](tutorial.md#wbs-shaped-ownership-example).

### Optional box adapters

[Read the tutorial section](tutorial.md#optional-box-adapters).
