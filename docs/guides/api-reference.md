# API reference

[Introduction](../../README.md) · [Complete tutorial](tutorial.md) · [Server recipes](server-integration.md)

Use this page to find an API and understand its role. The
[complete tutorial](tutorial.md) teaches the concepts with examples; the generated
reference provides exact signatures, generic constraints, overloads, parameters,
return types, and links to source declarations.

## Generated reference

| Entry point | What it exposes |
| --- | --- |
| [`di-bag`](../reference/index/index.md) | Portable facade, public types, and structured library errors. |

Start with the [`DiBagApi`](../reference/index/interfaces/DiBagApi.md),
[`Builder`](../reference/index/interfaces/Builder.md), and
[`Container`](../reference/index/interfaces/Container.md). The same builder seals a reusable
[`Module`](../reference/index/interfaces/Module.md). The reference represents
these type-only exports as interfaces; construct values through `DiBag`.

The generated Markdown is committed alongside the source. CI compares it with
fresh output and verifies public export and callable-overload coverage against
the TypeScript compiler. See [documentation maintenance](documentation.md) for
how to regenerate it.

## API at a glance

Import `DiBag` and the error classes from `di-bag`. On Node, Bun, and Deno it
detects native Promises itself; elsewhere see [portable mode](tutorial.md#portable-mode).
`di-bag/node` is the explicit Node/Bun form. Both entries expose the same
methods and types. Each table links to explanations and examples
in the tutorial; the [server guide](server-integration.md) puts them into an application.

### Configure and describe services

These methods are available on `DiBag` and every derived facade. A provider
is a reusable declaration; creating one does not acquire a service.

| Method | Result and purpose |
| --- | --- |
| `createBuilder()` | Create an empty immutable [builder](tutorial.md#compose-services) that can build a bag or seal a [module](tutorial.md#reuse-named-modules). |
| `withConfiguration({ runtime?, observers? })` | Return a new facade; inherit omitted runtime options and append the ordered observer array. |
| `fromFactory(create, options?)` | Describe a named-dependency factory; `acquisitionMode` defaults to `auto`. Add `context: 'acquisition'` to supply the owner's cancellation context. |
| `fromSyncFactory(create, options?)` | `fromFactory` with `acquisitionMode: 'raw'` fixed and a Promise or thenable output rejected at compile time: the [portable](tutorial.md#portable-mode) synchronous form. |
| `fromAsyncFactory(create, options?)` | `fromFactory` with `acquisitionMode: 'nativePromise'` fixed and a non-Promise output rejected: the portable asynchronous form; `withDisposal` receives the fulfilled value. |
| `token(key).of<Service>()` | Create a [typed token](tutorial.md#use-typed-tokens-for-explicit-positional-injection) from a canonical unique symbol. |
| `fromFunction(dependencies, fn, options?)` | Inject a tuple of tokens/references into a positional callback, checking its actual optional/rest parameter tuple. Write selected but unused parameters explicitly. |
| `fromClass(dependencies, Constructor, options?)` | Adapt an existing [constructor](tutorial.md#adapt-classes-and-positional-functions). |
| `optional(token)` / `lazy(token)` / `all(token)` | Supply an optional value, lazy lookup, or ordered collection through a positional dependency tuple. |
| `fromPlugin(dependencies, descriptor, options)` | Validate a selected plugin with explicit `acquisitionMode: 'raw'` or `'nativePromise'` and a synchronous output validator. |
| `withDisposal(registration, dispose)` | Accept cleanup ownership of that stage's acquired value. |
| `withLifetime(registration, lifetime, options?)` | Select `root`, `scoped`, or `transient`; only root accepts `allowScopedDependencies`. |
| `withMetadata(registration, { static?, dynamic? })` | Attach registration metadata, acquisition metadata, or both. Dynamic options require `mode` and synchronous `describe`. |
| `transformService(registration, { mode, transform, acquisitionMode? })` | Expose a transformed service, retaining earlier ownership; output acquisition options apply only to direct mode. |

`direct` passes the exact source output and preserves the callback result.
`awaited` waits for the source and exposes a native Promise. Transformation
callbacks may return Promises. Metadata callbacks must synchronously return
plain object records; direct metadata preserves its source acquisition policy.
Static-only metadata preserves the source output. Each dynamic annotation appends
one ordered metadata presence frame; no metadata or transformation adds ownership.

### Build and reuse a graph

Builder operations return a new builder. Keep the returned value or chain the
next call; they do not mutate the original.

| Method | Available on | Purpose |
| --- | --- | --- |
| `register(registrations)` | Builder | Add new [named factories](tutorial.md#compose-services); duplicate keys reject. |
| `register(token, registration)` | Builder | Bind a [typed token](tutorial.md#use-typed-tokens-for-explicit-positional-injection). |
| `replace(nameOrToken, registration)` | Builder | Replace one existing registration while checking its consumers and token contract. |
| `alias(destination, target)` | Builder | Add another [name or token lookup](tutorial.md#give-a-dependency-another-lookup-name) for an existing service. |
| `contribute(token, registration)` | Builder | Append an [ordered contribution](tutorial.md#compose-an-ordered-collection). |
| `installModule(module)` | Builder | Install a sealed [module](tutorial.md#reuse-named-modules) with private services and public exports; modules nest. |
| `build()` | Builder | Check graph completeness and return a lazy bag. |
| `buildAndStart(keys, options?)` | Builder | Return a promise for a fresh bag after [selected services are ready](tutorial.md#start-selected-services-and-cancel-cooperatively). |
| `buildModule(keys, { label? })` | Builder | Seal the graph as a module and choose its public names and tokens; unmet dependencies become requirements. A `label` names private bindings `<label>/<key>` in diagnostics. |
| `verifyGraph()` | Builder | Runtime no-op whose return type is `void` only when the graph would [build](tutorial.md#read-compile-time-rejections). |
| `renameExport(oldName, newName)` | Sealed Module | Return a module view with one string-named export renamed. |

There is one builder. `build()` requires a complete graph; `buildModule(keys)`
accepts an incomplete one and records the gaps as requirements of the module.
Modules do not resolve services or have a close method. Installing a module
gives its acquisitions an owning bag and fresh private identities at every
nesting depth.

### Use and close a bag

| Method | Purpose |
| --- | --- |
| `resolve(nameOrToken)` | Lazily acquire a service, preserving its inferred return type. |
| `resolveAll(token)` | Resolve the [ordered contributions](tutorial.md#compose-an-ordered-collection) as a readonly array. |
| `inspect(nameOrToken)` | Copy [metadata and acquisition state](tutorial.md#attach-metadata-and-inspect-without-resolving) without resolving. |
| `inspectAll(token)` | Inspect contribution descriptions and attempts without resolving. |
| `inspectGraph()` | Describe every binding, contribution group, and [observed edge](tutorial.md#attach-metadata-and-inspect-without-resolving) without resolving. |
| `createScope()` | Create a tracked [child scope](tutorial.md#create-tracked-child-scopes). |
| `createScope({ share: keys })` | Create a child that explicitly borrows selected parent acquisitions. |
| `createScope(keys, overrides, options?)` | Create a child with checked replacements and optional disjoint `share` selection. |
| `fork()` | Create an [independent bag](tutorial.md#fork-for-scopes-and-tests) with fresh instances. |
| `fork(keys, overrides)` | Create an independent bag with selected replacements. |
| `close()` | Return the shutdown promise; stop new resolutions, drain work, and dispose owned resources. Repeated calls share the same promise. |
| `close({ timeoutMs?, signal? })` | Start the same cleanup but stop waiting at the deadline or on abort with `DiBagCloseCancelledError`. |

## Errors and recovery

Every library-created message has the form
`<code>: <message>; see https://dany-fedorov.github.io/di-bag/agent/errors.html#<code-slug>`,
where the slug is the code lower-cased with `_` replaced by `-`. For example:
`DI_BAG_CYCLE: cycle: a -> b -> a; see https://dany-fedorov.github.io/di-bag/agent/errors.html#di-bag-cycle`.
The [errors page](../agent/errors.md) has one section per code and per compile-time message family.

The specialized error classes below are runtime exports from both `di-bag` and
`di-bag/node`. Each extends the built-in `Error` family and has a corresponding
`name`. Catch them with `instanceof` when choosing a recovery path.

| Error | When it appears | Public information |
| --- | --- | --- |
| [`DiBagCleanupError`](../reference/index/classes/DiBagCleanupError.md) | `close()` finishes attempting cleanup and one or more disposers failed. | Extends `AggregateError`; `errors` contains the original errors, and readonly `failures` associates each with `acquisitionId`, `bindingId`, `label`, and `error`. |
| [`DiBagPluginValidationError`](../reference/index/classes/DiBagPluginValidationError.md) | A plugin descriptor or acquired output fails the plugin boundary checks. | `phase` is `'descriptor'` or `'output'`; `reason` describes the rejection. |
| [`DiBagServiceReadinessError`](../reference/index/classes/DiBagServiceReadinessError.md) | `ensureServicesReady` could not make a listed service ready, and the bag it was called on has closed. | `cause` is the acquisition error; `disposalFailures` contains disposal failures; `disposalError` retains the complete shutdown error when present. |
| [`DiBagServiceReadinessCancelledError`](../reference/index/classes/DiBagServiceReadinessCancelledError.md) | An abort signal or the deadline interrupts `ensureServicesReady`. | `reason` is `'aborted'` or `'timeout'`; `cause` retains the cancellation reason; `details.acquisitionsStillPending` names the services that were not ready; `disposalPromise` is a `Promise<void>` for the eventual shutdown. |
| [`DiBagCloseCancelledError`](../reference/index/classes/DiBagCloseCancelledError.md) | `close({ waitTimeoutMs, abortSignal })` stops waiting before cleanup finishes. | `code` is `DI_BAG_CLOSE_TIMEOUT` or `DI_BAG_CLOSE_ABORTED`; `details.disposersStillRunning` lists unfinished disposer labels and `details.acquisitionsStillPending` pending acquisitions; `cleanupPromise` settles when cleanup finishes. |

Given an existing application bag named `app`:

```ts
import { DiBagCleanupError } from 'di-bag';

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
`new DiBagPluginValidationError(phase, reason)`,
`new DiBagStartupError(cause, cleanupFailures, cleanupError?)`,
`new DiBagStartupCancelledError(reason, cause, cleanupPromise)`, and
`new DiBagCloseCancelledError(reason, cause, cleanupPromise, progress, timeoutMs?)`. Applications usually
catch errors created by the library rather than constructing them.

Factory errors and transformation errors retain their original identity on
resolution. Library-created failures expose stable `DI_BAG_*` codes and frozen
structured `details`; inspect those fields instead of parsing message text.
Observer callback failures are delivered to the observer's
`onError` callback and do not become service or shutdown failures.
`DI_BAG_INVALID_DEPENDENCY_ACCESS` reports enumeration or `in` checks on a factory's dependency object; its `details.consumer` names the factory.

## Exported TypeScript types

All names in this section are type-only exports from `di-bag` and `di-bag/node`.
Use `import type` for them. They provide annotations and preserve contracts in generated
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
| [`DiBagApi`](../reference/index/interfaces/DiBagApi.md) | The complete `DiBag` method surface, including configured and observed facades. |
| [`ConfigurationOptions`](../reference/index/interfaces/ConfigurationOptions.md) | Runtime classification and observer options for `withConfiguration`. |
| [`Builder`](../reference/index/interfaces/Builder.md), [`Container`](../reference/index/interfaces/Container.md) | A checked immutable builder and a resolving/owning bag. |
| [`Module`](../reference/index/interfaces/Module.md) | A sealed export view of a builder graph, installable in other builders. |
| [`Registration`](../reference/index/type-aliases/Registration.md), [`FactoryWithDisposal`](../reference/index/interfaces/FactoryWithDisposal.md) | Accepted registration shapes and an owned factory description. |
| [`Provider`](../reference/index/interfaces/Provider.md) | A provider description retaining its factory, metadata, frames, graph contracts, and acquired-value type. |
| [`AcquisitionMode`](../reference/index/type-aliases/AcquisitionMode.md), [`RuntimeOptions`](../reference/index/interfaces/RuntimeOptions.md) | Acquisition mode literals and the `isNativePromise` configuration callback. |
| [`Lifetime`](../reference/index/type-aliases/Lifetime.md) | The `'root'`, `'scoped'`, and `'transient'` caching choices. |
| [`AcquisitionContext`](../reference/index/interfaces/AcquisitionContext.md), [`ContextualFactory`](../reference/index/type-aliases/ContextualFactory.md) | Factory cancellation context (`signal`) and the adapted contextual factory signature. |
| [`EnsureServicesReadyOptions`](../reference/index/interfaces/EnsureServicesReadyOptions.md) | Optional `abortSignal`, `totalTimeoutMs`, and `maxConcurrentServiceKeys` fields for `ensureServicesReady`. |
| [`CreateChildContainerOptions`](../reference/index/type-aliases/CreateChildContainerOptions.md), [`CreateIndependentContainerOptions`](../reference/index/type-aliases/CreateIndependentContainerOptions.md) | Checked selections accepted when deriving child and independent containers. |
| [`Token`](../reference/index/interfaces/Token.md), [`TokenBase`](../reference/index/interfaces/TokenBase.md), [`TokenKey`](../reference/index/type-aliases/TokenKey.md), [`TokenService`](../reference/index/type-aliases/TokenService.md) | Typed token identity, its common handle type, and key/service projections. |
| [`OptionalDependency`](../reference/index/type-aliases/OptionalDependency.md), [`LazyDependency`](../reference/index/type-aliases/LazyDependency.md), [`DependencyReference`](../reference/index/type-aliases/DependencyReference.md) | The token reference forms accepted in positional dependency tuples. |
| [`CompositionArguments`](../reference/index/type-aliases/CompositionArguments.md), [`CompositionFunction`](../reference/index/type-aliases/CompositionFunction.md) | Positional argument compatibility and callback signatures for function/constructor adaptation. |
| [`Presence`](../reference/index/type-aliases/Presence.md) | `{ present: false }` or `{ present: true, value }`, including present `undefined`. |
| [`AcquisitionMetadataPresence`](../reference/index/type-aliases/AcquisitionMetadataPresence.md), [`AcquisitionSnapshot`](../reference/index/interfaces/AcquisitionSnapshot.md), [`RegistrationSnapshot`](../reference/index/interfaces/RegistrationSnapshot.md) | Inspection frames, acquisition state, and registration metadata snapshots. |
| `GraphSnapshot`, `BindingSnapshot` | The frozen result of `inspectGraph()` and its per-binding entries. |
| [`CleanupFailure`](../reference/index/interfaces/CleanupFailure.md) | The detached acquisition identity, label, and original cleanup error. |
| [`DiBagErrorCode`](../reference/index/type-aliases/DiBagErrorCode.md), [`DiBagDiagnostic`](../reference/index/interfaces/DiBagDiagnostic.md) | Stable library error codes and their structured diagnostic fields. |
| [`LifecycleObserver`](../reference/index/interfaces/LifecycleObserver.md), [`ObserverCallback`](../reference/index/type-aliases/ObserverCallback.md), [`ObserverErrorCallback`](../reference/index/type-aliases/ObserverErrorCallback.md) | Observer configuration and its event/failure callbacks. |
| [`LifecycleEvent`](../reference/index/type-aliases/LifecycleEvent.md), [`ObserverFailure`](../reference/index/interfaces/ObserverFailure.md), [`ScopeEventFields`](../reference/index/interfaces/ScopeEventFields.md), [`AcquisitionEventFields`](../reference/index/interfaces/AcquisitionEventFields.md) | Discriminated lifecycle events and observer failure context. |
| [`PluginAcquisitionMode`](../reference/index/type-aliases/PluginAcquisitionMode.md), [`PluginOptions`](../reference/index/interfaces/PluginOptions.md), [`PluginOutputValidator`](../reference/index/type-aliases/PluginOutputValidator.md), [`PluginProvider`](../reference/index/type-aliases/PluginProvider.md) | Plugin mode, validation options, output predicate, and resulting provider. |
| [`PluginProviderFactory`](../reference/index/type-aliases/PluginProviderFactory.md) | The callable type of `DiBag.fromPlugin`; use it directly as a type. |
| [`CompositionReport`](../reference/index/type-aliases/CompositionReport.md) | The compile-time verdict for a builder: `void` when buildable, otherwise the `build()` failure with details. |
| [`DiBagPolicy`](../reference/index/interfaces/DiBagPolicy.md) | Empty interface for project-wide compile-time switches; augment with `structuralThenables: 'allow'` to relax the [thenable check](tutorial.md#attach-cleanup-with-withdisposal). |

### Provider and module projections

| Exports | Purpose |
| --- | --- |
| [`ProviderFactory`](../reference/index/type-aliases/ProviderFactory.md), [`ProviderOutput`](../reference/index/type-aliases/ProviderOutput.md), [`ProviderAcquiredValue`](../reference/index/type-aliases/ProviderAcquiredValue.md), [`ProviderNamedDependencies`](../reference/index/type-aliases/ProviderNamedDependencies.md) | Extract the factory, exposed result, acquired value, and named requirements from a registration. Output and acquired value can differ across async boundaries. |
| [`ProviderRegistrationMetadata`](../reference/index/type-aliases/ProviderRegistrationMetadata.md), [`ProviderAcquisitionMetadata`](../reference/index/type-aliases/ProviderAcquisitionMetadata.md) | Extract static metadata and the tuple of acquisition metadata frames. |
| [`ProviderGraphContract`](../reference/index/type-aliases/ProviderGraphContract.md) | Retain a provider's token and other graph obligations. |
| [`ProviderRequiredTokens`](../reference/index/type-aliases/ProviderRequiredTokens.md), [`ProviderOptionalTokens`](../reference/index/type-aliases/ProviderOptionalTokens.md), [`ProviderCollectionTokens`](../reference/index/type-aliases/ProviderCollectionTokens.md) | Extract required/lazy, optional, and collection token requirements. |
| [`ModuleExportedServices`](../reference/index/type-aliases/ModuleExportedServices.md), [`ModuleRequiredServices`](../reference/index/type-aliases/ModuleRequiredServices.md) | Extract the readonly service exports and external requirements of a sealed module. |
| [`ModuleConstraints`](../reference/index/type-aliases/ModuleConstraints.md) | Compute retained private-consumer and lifetime constraints for a registration map and public selection. |
| [`SealedConstraints`](../reference/index/type-aliases/SealedConstraints.md), [`ModuleSealedConstraints`](../reference/index/type-aliases/ModuleSealedConstraints.md) | Re-scope constraints retained from installed modules when a builder seals; the complete constraint set of a sealed module. |
| [`PublicProviders`](../reference/index/type-aliases/PublicProviders.md), [`ModulePublicProviders`](../reference/index/type-aliases/ModulePublicProviders.md) | Preserve provider contracts when projecting public module registrations. |
| [`Renamed`](../reference/index/type-aliases/Renamed.md) | Represent the checked renaming of a module's public view. |

### Graph composition support types

These exports support reusable generic helpers and portable declaration output.
Most applications can let the builder infer them. They express compile-time
contracts; they do not perform runtime validation.

| Exports | Purpose |
| --- | --- |
| [`ServicesOf`](../reference/index/type-aliases/ServicesOf.md) | Map registrations to their exposed service types. |
| [`RegistrationEntries`](../reference/index/type-aliases/RegistrationEntries.md), [`RegistrationsFromEntries`](../reference/index/type-aliases/RegistrationsFromEntries.md) | Convert between a registration map and its entry representation. |
| [`OverrideRegistrations`](../reference/index/type-aliases/OverrideRegistrations.md), [`SelectedRegistrations`](../reference/index/type-aliases/SelectedRegistrations.md) | Model merged registration maps and selected override registrations. |
| [`CheckDependencyCompatibility`](../reference/index/type-aliases/CheckDependencyCompatibility.md), [`CheckDependencyCompleteness`](../reference/index/type-aliases/CheckDependencyCompleteness.md) | Check dependency shape compatibility and graph completeness. |
| [`Selection`](../reference/index/type-aliases/Selection.md), [`Overrides`](../reference/index/type-aliases/Overrides.md), [`OverrideFactoryContext`](../reference/index/type-aliases/OverrideFactoryContext.md) | Validate selections and replacement compatibility while preserving contextual inference. |
| [`TokenBinding`](../reference/index/type-aliases/TokenBinding.md), [`TokenMember`](../reference/index/type-aliases/TokenMember.md), [`TokenDependencyContract`](../reference/index/type-aliases/TokenDependencyContract.md) | Retain typed bindings, validate token membership, and represent token obligations. |
| [`ReboundProviders`](../reference/index/type-aliases/ReboundProviders.md), [`ReboundSelection`](../reference/index/type-aliases/ReboundSelection.md), [`SelectionKey`](../reference/index/type-aliases/SelectionKey.md) | Preserve token bindings across replacement and map selections to their string/symbol keys. |
| [`AliasRegistration`](../reference/index/type-aliases/AliasRegistration.md), [`AliasEntries`](../reference/index/type-aliases/AliasEntries.md), [`AliasOutput`](../reference/index/type-aliases/AliasOutput.md) | Model an alias registration, its graph entries, and its exposed result. |
| [`Contribution`](../reference/index/type-aliases/Contribution.md), [`ContributionConstraint`](../reference/index/type-aliases/ContributionConstraint.md) | Describe an ordered contribution and its retained requirements. |
| [`ModuleContributions`](../reference/index/type-aliases/ModuleContributions.md), [`ModuleContributionConstraints`](../reference/index/type-aliases/ModuleContributionConstraints.md) | Preserve contributions and their requirements in modules. |
| [`BuilderWithCollectionContribution`](../reference/index/type-aliases/BuilderWithCollectionContribution.md) | The checked collection-contribution callable on the builder. |
| [`DisjointChildContainerSelection`](../reference/index/type-aliases/DisjointChildContainerSelection.md) | Enforce separate override and sharing selections. |
| [`UnsharedAliases`](../reference/index/type-aliases/UnsharedAliases.md), [`ScopedAliases`](../reference/index/type-aliases/ScopedAliases.md), [`SharedAliasProviders`](../reference/index/type-aliases/SharedAliasProviders.md) | Preserve alias contracts as scopes inherit or explicitly share services. |
| [`CheckedLifetimes`](../reference/index/type-aliases/CheckedLifetimes.md), [`CheckedChildContainerLifetimes`](../reference/index/type-aliases/CheckedChildContainerLifetimes.md) | Check root capture and lifetime compatibility in completed graphs and scope overrides. |
| [`LifetimeObligation`](../reference/index/type-aliases/LifetimeObligation.md), [`Reach`](../reference/index/type-aliases/Reach.md) | Compact seal-time lifetime records a module retains instead of its private registrations. |

The authoritative export lists are [`src/index.ts`](../../src/index.ts) and
`src/node.ts`.
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

### Represent acquisition values and metadata natively

[Read the tutorial section](tutorial.md#represent-acquisition-values-and-metadata-natively).
