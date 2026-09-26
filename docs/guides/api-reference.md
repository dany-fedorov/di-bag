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
The root import works on every supported runtime. Each table links to explanations
and examples in the tutorial; the [server guide](server-integration.md) puts them into an application.

### Configure and describe services

These methods are available on `DiBag` and every derived facade. A provider
is a reusable declaration; creating one does not acquire a service.

| Method | Result and purpose |
| --- | --- |
| `createProvider(factory, options?)` | Describe a named-dependency factory; specify a [factory return kind](tutorial.md#portable-mode) outside Node, Bun, and Deno. |
| `createProviderFromFunction({ dependencies, factoryFunction, ... })` | Inject positional token dependencies into a function. |
| `createProviderFromClass({ dependencies, serviceClass, ... })` | Adapt a [constructor](tutorial.md#adapt-classes-and-positional-functions) to positional dependencies. |
| `createProviderFromPlugin({ dependencies, pluginDescriptor, ... })` | Validate a selected [plugin](tutorial.md#admit-an-application-selected-plugin) and its output. |
| `createToken(symbol).forService<Service>()` / `.forCollectionOf<Service>()` | Create a [single-service or collection token](tutorial.md#use-typed-tokens-for-explicit-positional-injection). |
| `withConfiguration(options)` | Return a facade with inherited runtime settings and appended lifecycle observers. |
| `optional(token)` | Supply `undefined` when a positional token dependency is unregistered. |
| `lazy(token)` | Supply a function that resolves a positional token dependency when called. |
| `createBuilder()` | Create an immutable [builder](tutorial.md#compose-services) for a container or [module](tutorial.md#reuse-named-modules). |
| `providerWithDisposal({ provider, disposeService })` | Give the container ownership of this provider's acquired value. |
| `providerWithLifetime({ provider, lifetime })` | Choose singleton, scoped, or transient caching; [scoped is the default](tutorial.md#choose-a-lifetime). |
| `providerWithRegistrationMetadata({ provider, registrationMetadata })` | Attach metadata available without acquiring the service. |
| `providerWithAcquisitionMetadata({ provider, callbackReceives, describeAcquisition })` | Append one synchronous acquisition-metadata frame. |
| `providerWithTransformedService({ provider, callbackReceives, transformService })` | Project an exposed service while retaining its ownership and graph contracts. |

### Build and reuse a graph

Builder operations return a new builder. Keep the returned value or chain the
next call; they do not mutate the original.

| Method | Available on | Purpose |
| --- | --- | --- |
| `withServices(providersByName)` | Builder | Add new [string-named providers](tutorial.md#compose-services). |
| `withTokenService(token, provider)` | Builder | Bind a [single-service token](tutorial.md#use-typed-tokens-for-explicit-positional-injection). |
| `withServiceAlias({ aliasKey, targetServiceKey })` | Builder | Add another [lookup name](tutorial.md#give-a-dependency-another-lookup-name) for a service. |
| `withCollectionContribution({ collectionToken, provider })` | Builder | Append an [ordered collection contribution](tutorial.md#compose-an-ordered-collection). |
| `withReplacedService(serviceKey, provider)` | Builder | Replace an existing binding with a compatible provider. |
| `withInstalledModules(modules)` | Builder | Install sealed [modules](tutorial.md#reuse-named-modules) in list order. |
| `verifyGraphAtCompileTime()` | Builder | Report an incomplete graph through its TypeScript return type. |
| `buildModule({ exportedServiceKeys, moduleLabel? })` | Builder | Seal public exports; unmet dependencies become module requirements. |
| `buildContainer()` | Builder | Check graph completeness and create a lazy owning container. |
| `moduleLabel` | Sealed Module | Read the exact optional label supplied at sealing without acquiring a service; rename views preserve it. |
| `withRenamedExport({ currentExportKey, newExportKey })` | Sealed Module | Return a module view with a renamed string export. |
| `withRenamedRequirement({ currentRequirementKey, newRequirementKey })` | Sealed Module | Return a module view that asks its host for a renamed string requirement. |

There is one builder. `buildContainer()` requires a complete graph; `buildModule()`
records unmet dependencies as requirements. Modules do not resolve services or
have a close method. Each installation allocates fresh private bindings.

### Use and close a container {#use-and-close-a-container}

For each server request, create a child container, resolve its services, then
close it after the response. Unmarked providers are scoped to each container.

| Method | Purpose |
| --- | --- |
| `resolve(serviceKey)` | Lazily acquire a single service with its inferred return type. |
| `resolveCollection(token)` | Resolve [ordered contributions](tutorial.md#compose-an-ordered-collection) as a frozen readonly list. |
| `serviceSnapshot(serviceKey)` | Inspect [service or collection metadata and acquisition state](tutorial.md#attach-metadata-and-inspect-without-resolving) without acquiring anything. |
| `graphSnapshot()` | Describe every binding, module installation, and dependency edge observed so far. |
| `createChildContainer(options?)` / `createChildContainer(keys, providers, options?)` | Create a tracked [child container](tutorial.md#create-child-containers) with optional sharing and checked scoped or transient replacements. |
| `createIndependentContainer()` / `createIndependentContainer(keys, providers)` | Create an [independent container](tutorial.md#create-an-independent-container) with fresh instances and optional checked replacements. |
| `ensureServicesReady(serviceKeys, options?)` | Wait for selected services to become [ready](tutorial.md#make-selected-services-ready). |
| `close(options?)` | Stop resolutions, drain work, and dispose owned resources; a timed or aborted wait can be cancelled. |

## Errors and recovery

Each library error code names a kind of failure, while `details.operation` names
the method where it occurred. The [errors page](../agent/errors.md) lists all codes
and compile-time messages. Catch specialized error classes with `instanceof`
when choosing a recovery path.

| Error | When it appears | Public information |
| --- | --- | --- |
| [`DiBagDisposalError`](../reference/index/classes/DiBagDisposalError.md) | `close()` attempted every disposer and one or more failed. | `failures` records each binding label and original error. |
| [`DiBagServiceReadinessError`](../reference/index/classes/DiBagServiceReadinessError.md) | `ensureServicesReady()` could not make a selected service ready. | `cause`, `disposalFailures`, and `disposalError` retain the failure and disposal outcome. |
| [`DiBagServiceReadinessCancelledError`](../reference/index/classes/DiBagServiceReadinessCancelledError.md) | An abort signal or timeout stopped a readiness wait. | `reason`, `details.acquisitionsStillPending`, and `disposalPromise` describe the cancellation and eventual disposal. |
| [`DiBagCloseCancelledError`](../reference/index/classes/DiBagCloseCancelledError.md) | An abort signal or timeout stopped a `close()` wait. | `details` lists pending work; `disposalPromise` settles when disposal finishes. |
| [`DiBagPluginValidationError`](../reference/index/classes/DiBagPluginValidationError.md) | A plugin descriptor or acquired output failed validation. | `phase` identifies the boundary and `reason` describes the rejection. |

For a container whose disposer fails:

```ts
import { DiBag, DiBagDisposalError } from 'di-bag';

const app = DiBag.createBuilder().withServices({
  resource: DiBag.providerWithDisposal({
    provider: () => ({ name: 'example' }),
    disposeService: () => { throw new Error('disposal failed'); },
  }),
}).buildContainer();
app.resolve('resource');

try {
  await app.close();
} catch (error) {
  if (error instanceof DiBagDisposalError) {
    for (const failure of error.failures) {
      console.error(failure.bindingLabel, failure.error);
    }
  }
  throw error;
}
```

Factory errors and transformation errors retain their original identity on
resolution. Library-created failures expose stable `DI_BAG_*` codes and frozen
structured `details`; inspect those fields instead of parsing message text.
Observer callback failures are delivered to the observer's
`onObserverFailure` callback and do not become service or shutdown failures.
`DI_BAG_INVALID_DEPENDENCY_ACCESS` reports enumeration or `in` checks on a factory's dependency object; its `details.consumer` names the factory.

## Exported TypeScript types

All names in this section are type-only exports from `di-bag`.
Use `import type` for them. They provide annotations and preserve contracts in generated
declarations; they do not provide unchecked runtime constructors.

For application code, prefer inferred values and `typeof` or `ReturnType` when
passing a graph across a module boundary:

```ts
import { DiBag, type ProviderOutput, type TokenService } from 'di-bag';

const clockSymbol = Symbol('clock');
const clock = DiBag.createToken(clockSymbol).forService<{ now(): number }>();
const stamp = DiBag.createProviderFromFunction({
  dependencies: [clock],
  factoryFunction: source => source.now(),
});
const app = DiBag.createBuilder()
  .withTokenService(clock, () => ({ now: () => 42 }))
  .withServices({ stamp })
  .buildContainer();

type Clock = TokenService<typeof clock>;
type Stamp = ProviderOutput<typeof stamp>;
type Application = typeof app;
await app.close();
```

These names refer to the clock, stamp provider, and app in the tutorial's
[typed-token example](tutorial.md#use-typed-tokens-for-explicit-positional-injection). Inferred types
retain private-consumer, token, lifetime, and ownership contracts.

### Application-facing types

| Exports | Purpose |
| --- | --- |
| [`DiBagApi`](../reference/index/interfaces/DiBagApi.md) | The complete `DiBag` method surface, including configured and observed facades. |
| [`ConfigurationOptions`](../reference/index/interfaces/ConfigurationOptions.md) | Runtime classification and observer options for `withConfiguration`. |
| [`Builder`](../reference/index/interfaces/Builder.md), [`Container`](../reference/index/interfaces/Container.md) | A checked immutable builder and a resolving, owning container. |
| [`Module`](../reference/index/interfaces/Module.md) | A sealed export view of a builder graph, installable in other builders. |
| [`ModuleOptions`](../reference/index/interfaces/ModuleOptions.md) | Optional non-empty `moduleLabel` for naming private bindings; labels are descriptive and may repeat or contain `/`. |
| [`ProviderOrFactory`](../reference/index/type-aliases/ProviderOrFactory.md) | Accepted provider or factory shapes. |
| [`Provider`](../reference/index/interfaces/Provider.md) | A provider description retaining its factory, metadata, frames, graph contracts, and acquired-value type. |
| [`FactoryReturnKind`](../reference/index/type-aliases/FactoryReturnKind.md), [`RuntimeOptions`](../reference/index/interfaces/RuntimeOptions.md) | Factory return-kind literals and the `isNativePromise` configuration callback. |
| [`Lifetime`](../reference/index/type-aliases/Lifetime.md) | Singleton, scoped, and transient caching choices; scoped is the default. |
| [`FactoryContext`](../reference/index/interfaces/FactoryContext.md), [`ContextualFactory`](../reference/index/type-aliases/ContextualFactory.md), [`DisposerContext`](../reference/index/interfaces/DisposerContext.md) | Factory cancellation, contextual factory, and disposal callback contracts. |
| [`EnsureServicesReadyOptions`](../reference/index/interfaces/EnsureServicesReadyOptions.md) | Optional `abortSignal`, `totalTimeoutMs`, and `maxConcurrentServiceKeys` fields for `ensureServicesReady`. |
| [`CloseOptions`](../reference/index/interfaces/CloseOptions.md), [`CloseProgress`](../reference/index/interfaces/CloseProgress.md) | Close wait controls and pending work reported after cancellation. |
| [`CreateChildContainerOptions`](../reference/index/type-aliases/CreateChildContainerOptions.md), [`CreateIndependentContainerOptions`](../reference/index/type-aliases/CreateIndependentContainerOptions.md) | Checked selections accepted when deriving child and independent containers. |
| [`Token`](../reference/index/interfaces/Token.md), [`TokenBase`](../reference/index/interfaces/TokenBase.md), [`TokenKey`](../reference/index/type-aliases/TokenKey.md), [`TokenKind`](../reference/index/type-aliases/TokenKind.md), [`TokenService`](../reference/index/type-aliases/TokenService.md) | Single-service token identity, common handle, kind, and key/service projections. |
| [`CollectionToken`](../reference/index/interfaces/CollectionToken.md), [`CollectionTokenBase`](../reference/index/interfaces/CollectionTokenBase.md), [`CollectionItem`](../reference/index/type-aliases/CollectionItem.md) | Collection token identity and the type of one contribution. |
| [`OptionalDependency`](../reference/index/type-aliases/OptionalDependency.md), [`LazyDependency`](../reference/index/type-aliases/LazyDependency.md), [`DependencyReference`](../reference/index/type-aliases/DependencyReference.md) | The token reference forms accepted in positional dependency tuples. |
| [`PositionalFactoryArguments`](../reference/index/type-aliases/PositionalFactoryArguments.md), [`PositionalFactoryFunction`](../reference/index/type-aliases/PositionalFactoryFunction.md) | Positional argument compatibility and callback signatures for function/constructor adaptation. |
| [`Presence`](../reference/index/type-aliases/Presence.md) | `{ isPresent: false }` or `{ isPresent: true, value }`, including a present `undefined` value. |
| [`AcquisitionMetadataPresence`](../reference/index/type-aliases/AcquisitionMetadataPresence.md), [`AcquisitionSnapshot`](../reference/index/interfaces/AcquisitionSnapshot.md), [`RegistrationSnapshot`](../reference/index/interfaces/RegistrationSnapshot.md) | Inspection frames, acquisition state, and registration metadata snapshots. |
| [`GraphSnapshot`](../reference/index/interfaces/GraphSnapshot.md), [`BindingSnapshot`](../reference/index/interfaces/BindingSnapshot.md), [`ModuleInstallationSnapshot`](../reference/index/interfaces/ModuleInstallationSnapshot.md) | The frozen graph description, per-binding origin, and installation records with parent IDs. |
| [`DisposalFailure`](../reference/index/interfaces/DisposalFailure.md) | The detached acquisition identity, label, and original disposal error. |
| [`DiBagErrorCode`](../reference/index/type-aliases/DiBagErrorCode.md), [`DiBagDiagnostic`](../reference/index/interfaces/DiBagDiagnostic.md) | Stable library error codes and their structured diagnostic fields. |
| [`LifecycleObserver`](../reference/index/interfaces/LifecycleObserver.md), [`ObserverCallback`](../reference/index/type-aliases/ObserverCallback.md), [`ObserverErrorCallback`](../reference/index/type-aliases/ObserverErrorCallback.md) | Observer configuration and its event/failure callbacks. |
| [`LifecycleEvent`](../reference/index/type-aliases/LifecycleEvent.md), [`ObserverFailure`](../reference/index/interfaces/ObserverFailure.md), [`ContainerEventFields`](../reference/index/interfaces/ContainerEventFields.md), [`AcquisitionEventFields`](../reference/index/interfaces/AcquisitionEventFields.md) | Discriminated lifecycle events and observer failure context. |
| [`PluginReturnKind`](../reference/index/type-aliases/PluginReturnKind.md), [`CreateProviderFromPluginOptions`](../reference/index/interfaces/CreateProviderFromPluginOptions.md), [`PluginOutputValidator`](../reference/index/type-aliases/PluginOutputValidator.md), [`PluginProvider`](../reference/index/type-aliases/PluginProvider.md) | Plugin return policy, validation options, output predicate, and resulting provider. |
| [`CreateProviderFromPlugin`](../reference/index/type-aliases/CreateProviderFromPlugin.md) | The callable type of `DiBag.createProviderFromPlugin`; use it directly as a type. |
| [`CompositionReport`](../reference/index/type-aliases/CompositionReport.md) | The compile-time verdict for a builder: `void` when buildable, otherwise the `buildContainer()` failure with details. |
| [`DiBagPolicy`](../reference/index/interfaces/DiBagPolicy.md) | Empty interface for project-wide compile-time switches; augment with `structuralThenables: 'allow'` to relax the [thenable check](tutorial.md#attach-disposal-with-providerwithdisposal). |

### Provider and module projections

| Exports | Purpose |
| --- | --- |
| [`ProviderFactory`](../reference/index/type-aliases/ProviderFactory.md), [`ProviderOutput`](../reference/index/type-aliases/ProviderOutput.md), [`ProviderAcquiredValue`](../reference/index/type-aliases/ProviderAcquiredValue.md), [`ProviderNamedDependencies`](../reference/index/type-aliases/ProviderNamedDependencies.md) | Extract the factory, exposed result, acquired value, and named requirements from a registration. Output and acquired value can differ across async boundaries. |
| [`ProviderRegistrationMetadata`](../reference/index/type-aliases/ProviderRegistrationMetadata.md), [`ProviderAcquisitionMetadata`](../reference/index/type-aliases/ProviderAcquisitionMetadata.md) | Extract static metadata and the tuple of acquisition metadata frames. |
| [`ProviderGraphContract`](../reference/index/type-aliases/ProviderGraphContract.md) | Retain a provider's token and other graph obligations. |
| [`ProviderRequiredTokens`](../reference/index/type-aliases/ProviderRequiredTokens.md), [`ProviderOptionalTokens`](../reference/index/type-aliases/ProviderOptionalTokens.md), [`ProviderCollectionTokens`](../reference/index/type-aliases/ProviderCollectionTokens.md) | Extract required/lazy, optional, and collection token requirements. |
| [`ModuleExportedServices`](../reference/index/type-aliases/ModuleExportedServices.md), [`ModuleRequiredServices`](../reference/index/type-aliases/ModuleRequiredServices.md) | Extract the readonly service exports and external requirements of a sealed module. |
| [`ModuleConstraints`](../reference/index/type-aliases/ModuleConstraints.md) | Compute retained private-consumer and lifetime constraints for a registration map and public selection. |
| [`SealedConstraints`](../reference/index/type-aliases/SealedConstraints.md), [`ModuleSealedConstraints`](../reference/index/type-aliases/ModuleSealedConstraints.md) | Rebase constraints retained from installed modules when a builder seals; the complete constraint set of a sealed module. |
| [`PublicProviders`](../reference/index/type-aliases/PublicProviders.md), [`ModulePublicProviders`](../reference/index/type-aliases/ModulePublicProviders.md) | Preserve provider contracts when projecting public module registrations. |
| [`Renamed`](../reference/index/type-aliases/Renamed.md) | Represent the checked renaming of a module's public view. |

### Graph composition support types

These exports support reusable generic helpers and portable declaration output.
Most applications can let the builder infer them. They express compile-time
contracts; they do not perform runtime validation.

| Exports | Purpose |
| --- | --- |
| [`ServicesOf`](../reference/index/type-aliases/ServicesOf.md) | Map providers to their exposed service types. |
| [`RegistrationEntries`](../reference/index/type-aliases/RegistrationEntries.md), [`RegistrationsFromEntries`](../reference/index/type-aliases/RegistrationsFromEntries.md) | Convert between a registration map and its entry representation. |
| [`OverrideRegistrations`](../reference/index/type-aliases/OverrideRegistrations.md), [`SelectedRegistrations`](../reference/index/type-aliases/SelectedRegistrations.md) | Model merged registration maps and selected override registrations. |
| [`CheckDependencyCompatibility`](../reference/index/type-aliases/CheckDependencyCompatibility.md), [`CheckDependencyCompleteness`](../reference/index/type-aliases/CheckDependencyCompleteness.md) | Check dependency shape compatibility and graph completeness. |
| [`Selection`](../reference/index/type-aliases/Selection.md), [`Overrides`](../reference/index/type-aliases/Overrides.md), [`OverrideFactoryContext`](../reference/index/type-aliases/OverrideFactoryContext.md) | Validate selections and replacement compatibility while preserving contextual inference. |
| [`TokenBinding`](../reference/index/type-aliases/TokenBinding.md), [`TokenMember`](../reference/index/type-aliases/TokenMember.md), [`TokenDependencyContract`](../reference/index/type-aliases/TokenDependencyContract.md) | Retain typed bindings, validate token membership, and represent token obligations. |
| [`CollectionTokenMember`](../reference/index/type-aliases/CollectionTokenMember.md), [`SingleServiceTokenMember`](../reference/index/type-aliases/SingleServiceTokenMember.md) | Check collection and single-service token membership. |
| [`ReboundProviders`](../reference/index/type-aliases/ReboundProviders.md), [`ReboundSelection`](../reference/index/type-aliases/ReboundSelection.md), [`SelectionKey`](../reference/index/type-aliases/SelectionKey.md) | Preserve token bindings across replacement and map selections to their string/symbol keys. |
| [`AliasRegistration`](../reference/index/type-aliases/AliasRegistration.md), [`AliasEntries`](../reference/index/type-aliases/AliasEntries.md), [`AliasOutput`](../reference/index/type-aliases/AliasOutput.md) | Model an alias registration, its graph entries, and its exposed result. |
| [`Contribution`](../reference/index/type-aliases/Contribution.md), [`ContributionConstraint`](../reference/index/type-aliases/ContributionConstraint.md) | Describe an ordered contribution and its retained requirements. |
| [`ModuleContributions`](../reference/index/type-aliases/ModuleContributions.md), [`ModuleContributionConstraints`](../reference/index/type-aliases/ModuleContributionConstraints.md) | Preserve contributions and their requirements in modules. |
| [`BuilderWithCollectionContribution`](../reference/index/type-aliases/BuilderWithCollectionContribution.md) | The checked collection-contribution callable on the builder. |
| [`BuilderBuildModule`](../reference/index/interfaces/BuilderBuildModule.md), [`BuilderWithInstalledModules`](../reference/index/type-aliases/BuilderWithInstalledModules.md), [`BuilderWithReplacedService`](../reference/index/interfaces/BuilderWithReplacedService.md) | Checked module sealing, installation, and replacement call signatures. |
| [`BuilderWithServiceAlias`](../reference/index/type-aliases/BuilderWithServiceAlias.md), [`BuilderWithServices`](../reference/index/type-aliases/BuilderWithServices.md), [`BuilderWithTokenService`](../reference/index/type-aliases/BuilderWithTokenService.md) | Checked alias and service registration call signatures. |
| [`DisjointChildContainerSelection`](../reference/index/type-aliases/DisjointChildContainerSelection.md) | Enforce separate override and sharing selections. |
| [`UnsharedAliases`](../reference/index/type-aliases/UnsharedAliases.md), [`ScopedAliases`](../reference/index/type-aliases/ScopedAliases.md), [`SharedAliasProviders`](../reference/index/type-aliases/SharedAliasProviders.md) | Preserve alias contracts as child containers inherit or explicitly share services. |
| [`CanonicalLifetime`](../reference/index/type-aliases/CanonicalLifetime.md), [`LifetimeObligation`](../reference/index/type-aliases/LifetimeObligation.md), [`Reach`](../reference/index/type-aliases/Reach.md) | Normalize lifetimes and retain compact module lifetime obligations. |
| [`CheckedLifetimes`](../reference/index/type-aliases/CheckedLifetimes.md), [`CheckedChildContainerLifetimes`](../reference/index/type-aliases/CheckedChildContainerLifetimes.md), [`ChildReplacementAdmission`](../reference/index/type-aliases/ChildReplacementAdmission.md) | Check singleton capture and child replacement compatibility. |

The authoritative export list is [`src/index.ts`](../../src/index.ts).
Internal helpers in other source files are not package exports.

## Boundaries

- Token maps and dependency parameters must have finite string keys. Index
  signatures, including open template keys, cannot prove that tokens exist.
- Containers are created through checked builders and independent containers.
  `Container` is exported as a type only; there is no public unchecked constructor.
- Parameters may be omitted or be a single object type. Optional dependency
  properties still require providers. Union, callable, and symbol-keyed
  dependency parameter types are rejected.
- Dependency proxies support named property reads. Do not enumerate, spread,
  or use rest destructuring on them: parameter types are erased at runtime,
  so the container cannot enumerate a particular factory's declared requirements.
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

### Attach disposal with `providerWithDisposal`

[Read the tutorial section](tutorial.md#attach-disposal-with-providerwithdisposal).

### Make selected services ready, and cancel cooperatively

[Read the tutorial section](tutorial.md#make-selected-services-ready).

### Choose a lifetime: singleton, scoped or transient

[Read the tutorial section](tutorial.md#choose-a-lifetime).

### Create child containers

[Read the tutorial section](tutorial.md#create-child-containers).

### Create an independent container for tests

[Read the tutorial section](tutorial.md#create-an-independent-container).

### WBS-shaped ownership example

[Read the tutorial section](tutorial.md#wbs-shaped-ownership-example).

### Represent acquisition values and metadata natively

[Read the tutorial section](tutorial.md#represent-acquisition-values-and-metadata-natively).
