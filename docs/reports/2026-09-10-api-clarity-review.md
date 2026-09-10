# API and diagnostic clarity review

Reviewed the current working tree on 2026-09-10, including the uncommitted
provider-metadata and runtime changes. This report records review
recommendations and selected naming decisions.

See the consolidated [API renaming plan](../api-renaming-plan.md) for the
current decision status and migration outline.

Chosen transformation names: `transformServiceDirect` and
`transformServiceAwaited`. Preserve symmetric method families with a shared
verb/object and consistent suffixes. Favor explicit verbs for operations and
descriptive nouns for types. These are naming decisions for a future API
change; the implementation still uses `mapSync` and `mapAsync`.

Chosen metadata API: a single `withMetadata(provider, { static, dynamic })`,
where dynamic metadata supplies an explicit `mode: 'direct' | 'awaited'` and
a synchronous `describe` callback. Further consolidation candidates are in the
[API consolidation review](2026-09-10-api-consolidation-review.md).

The main improvement is to make names reveal what a call returns, what it
awaits, and which object owns the resulting resource. Several diagnostics also
need factual corrections. Longer names alone would not address those problems.

**Scope and evidence.** Reviewed both package entry points, their 97 exported
names, the facade and builder/bag/module methods, public options and snapshots,
runtime throw sites, and branded TypeScript diagnostics. Compared the source
with CONTEXT.md, the API guide, generated reference, and relevant tests.
Ran 127 tests across eight runtime test files: all passed, with 656 assertions.
Temporary probes exercised runtime messages and five compiler scenarios.
The full repository test suite, native compiler suite, and build were not run.
Passing runtime tests do not establish that the naming is clear.

**1. Correct misleading diagnostics first — high priority.**

| Current behavior, reproduced | Problem | Suggested behavior |
| --- | --- | --- |
| Two disposers fail on one acquisition: `Failed to dispose 2 acquisition(s)` | The count is disposer failures, not distinct acquisitions. | `2 disposal callbacks failed across 1 acquisition.` |
| After `await bag.close()`, `resolve()` says `bag is closed`, while `scope()` says `bag is closing`. | The second message reports an obsolete state. | `Cannot create a child scope: the bag is closed.` |
| Factories call public resolution along `a → b → a`; error says `cycle: a -> a`. | The intervening service is omitted, making a multi-service cycle look like a direct self-dependency. | `Circular dependency while resolving "a": a -> b -> a.` |
| Invalid numeric registration key produces `factory dependencies must be finite string-keyed objects`. | The invalid input is the registration map, not a factory's dependency parameter. | `Named registrations must use individually known string keys.` |
| Widened typed-token array passed to `fork()` produces `fork requires a finite tuple of singleton string-literal keys`. | Typed tokens are supported, but the message describes only strings. | `fork requires a const tuple of individually known service names or typed tokens; use [token] as const.` |

Sources: [cleanup count](../../src/errors.ts#L29),
[runtime close guard](../../src/runtime.ts#L218),
[acquisition close guard](../../src/acquisition.ts#L124),
[cached cycle guard](../../src/acquisition.ts#L170),
[registration admission](../../src/types.ts#L122),
[selection diagnostic](../../src/types.ts#L229).

The cycle example specifically uses public reentrant `bag.resolve()` calls.
Ordinary dependency-proxy cycles already have a separate path-tracking mechanism.
The correction must preserve the actual construction path for the public-call case.

**2. Make runtime errors identify the operation, subject, and remedy — high priority.**

`no factory for db`, `invalid token`, `invalid factory registration`, and
`Failed to start bag` are real outputs from the probes. Each leaves useful
context out of the main message. The startup error preserves its original
`cause`, which is good, but does not identify the failing service.

| Current message family | Suggested message pattern |
| --- | --- |
| `no factory for db` | `Cannot resolve "api": dependency "db" is not registered. Resolution path: api -> db.` |
| `invalid token` | `resolve expected a service name or a token created by DiBag.token(key).of<Service>(); received a symbol.` |
| `invalid factory registration` | `add: registration "db" must be a factory function or a provider returned by DiBag; received null.` |
| `duplicate registration: db` | `add: service "db" is already registered. Use replace() to change its provider.` |
| `invalid acquisition mode` | `factory: options.acquisition must be "auto", "raw", or "native"; received "guess".` |
| `invalid startup concurrency` | `start: options.concurrency must be "parallel" or "sequential".` |
| `install requires a genuine module` | `install expected a module returned by DiBag.module().exports(...). Copied or fabricated objects are not accepted.` |
| `Failed to start bag` | `Bag startup failed while acquiring "db"; rollback finished.` Attach structured rollback results and preserve the cause. |
| `Bag startup timeout` | `Bag startup timed out after 5000 ms; cleanup is still in progress.` Include the actual configured timeout. |

Use the actual operation and argument position at each call site. A shared
token validator should not hard-code `resolve` when it also serves `bind`,
`fork`, adapters, and module exports. Pass diagnostic context from the boundary.
Dependency-reference failures should identify the failing tuple index.

Under Bun, explicit `native` acquisition of an ordinary number currently
produces the intrinsic TypeError `|this| is not a Promise`. This unchecked-input
case deserves library context such as the service, stage, and expected native
Promise. Keep original callback/getter errors intact; do not relabel every
exception from Promise observation as an invalid value.

Add stable codes to library-generated errors, for example
`DIBAG_SERVICE_NOT_REGISTERED`, `DIBAG_DEPENDENCY_CYCLE`,
`DIBAG_INVALID_REGISTRATION`, and `DIBAG_BAG_CLOSED`, with structured fields
such as `operation`, `serviceKey`, `dependencyKey`, `resolutionPath`, and
`optionName`. This lets applications and agents act without parsing prose.
Use `TypeError` consistently for malformed arguments, or documented domain
error classes. An error class for every individual message is unnecessary.

Preserve the existing identity contract for exceptions thrown by application
factories and projectors. Additional context can live in lifecycle events and
startup wrappers without silently replacing the error returned by `resolve()`.
Format primitive keys and types without enumerating arbitrary application
objects or invoking their getters to construct an error message.

Sources: [binding lookup](../../src/runtime.ts#L105),
[registration validation](../../src/provider-operations.ts#L65),
[token validation](../../src/tokens.ts#L62),
[startup](../../src/startup.ts#L80),
[Promise observation](../../src/provider-execution.ts#L112).

**3. Make compiler diagnostics name the failing relationship — high priority.**

For a provider `db: () => 1` consumed as `{ db: string }` by `api`, the compiler
reports `a dependency has the wrong shape` and `{ tokens: "api" }`. The field
contains the consumer name, not the bad dependency. Prefer an explicit
relationship: `consumer: "api"`, `dependency: "db"`, `expected: string`,
`provided: number`, with the message `A provided service is incompatible with
its consumer's dependency type`.

Use `missing service registrations` instead of `missing factories`; a missing
service can be supplied by a decorated provider, token binding, alias, or
installed module. Use `duplicate service registrations` instead of
`add introduces new tokens only`, because the shared check also appears in
`bind`, `alias`, and `install`.

For collection errors, include the collection token and failing dependency.
Several checks currently use an empty details object, which leaves a consumer
with no specific location to investigate. Distinguish a mismatched token
service contract from a provider whose contract has been widened away instead
of calling both `incompatible or opaque` without explanation.

The hidden error brand is useful. A name such as `diBagTypeError` would be more
recognizable than `errorBrand` in compiler output. Any richer diagnostic type
must be measured against the repository's compiler-scale fixtures before
adoption; do not expand successful type checks just to improve failure output.

Sources: [shape diagnostics](../../src/types.ts#L69),
[incremental checks](../../src/types.ts#L115),
[completeness](../../src/types.ts#L129),
[collection diagnostics](../../src/contribution-types.ts#L32).

**4. Keep symmetric transformation names and specify what they await.**

| Current name | Recommended name | Reason |
| --- | --- | --- |
| `mapSync` | `transformServiceDirect` (chosen) | Transforms the exposed service without awaiting the source or callback result. Both can be Promises. |
| `mapAsync` | `transformServiceAwaited` (chosen) | Awaits the source and adopts the transformed service into a Promise. |

Both transformation methods return a new provider that exposes a transformed
service while retaining the original dependencies, lifetime, metadata, and
cleanup obligations. For example, a connection provider can expose a repository
while retaining responsibility for closing the underlying connection. The
transformation itself adds no cleanup ownership for the new service.

The following currently type-checks and creates a provider whose exposed
service is a `Promise<number>`:

```ts
const provider = DiBag.mapSync(() => 1, async value => value + 1);
```

An async callback passed to `withAcquisitionMetadataAsync` fails the compiler's
synchronous-object-record check. Describe source waiting, callback result
handling, and exposed output independently in each method's JSDoc. `Direct`
describes applying the operation without an await boundary; it does not promise
a non-Promise service. `Awaited` describes awaiting the source and exposing a
Promise-valued service. The metadata methods must both explicitly state that
their metadata callbacks are synchronous.

Sources: [mapSync](../../src/provider.ts#L160),
[mapAsync](../../src/provider.ts#L178),
[metadata methods](../../src/provider.ts#L204).

**5. Combine metadata authoring and use consistent inspection names.**

The accepted authoring shape groups both levels under one method:

```ts
DiBag.withMetadata(provider, {
  static: { module: 'billing', ownerTeam: 'payments' },
  dynamic: {
    mode: 'awaited',
    describe: connection => ({ connectionId: connection.id }),
  },
});
```

Either metadata level may be supplied independently. Static metadata is
available before acquisition. Dynamic metadata is computed once when an
acquisition reaches the annotation stage; cached reads reuse it. Both levels
remain separate in inspection and observer events. The dynamic callback must
return a synchronous plain record in both modes.

`direct` supplies the source output as-is and preserves the provider's exposed
output type and acquisition policy. `awaited` supplies its awaited value and
exposes a Promise-valued service, including for a synchronous source. The
mode literal must control callback inference and the returned provider type.
This accepted design replaces the earlier proposal for separate
`withRegistrationMetadata` and acquisition-metadata methods.

Preserve existing composition rules: reject colliding static metadata keys and
append each dynamic annotation as a separate metadata frame. The current
`withMetadata(provider, record)` accepts arbitrary record keys, so migration to
the new options shape must be explicit; detecting `static` or `dynamic` keys
cannot reliably distinguish old metadata from new options.

Static metadata is called `metadata` on inspection snapshots and events.
Acquisition metadata is called `metadata` inside acquisition snapshots, but
`frames` on events, and its exported tuple type is `FramePresenceTuple`.
These names make consumers learn multiple terms for the same data.

Prefer `registrationMetadata` for static metadata and `acquisitionMetadata`
for the ordered acquisition metadata tuple on both inspection and events.
Rename `ProviderMetadata` to `ProviderRegistrationMetadata`, and `FramePresenceTuple` to
`AcquisitionMetadataPresence`. Keep `Presence.present` and `Presence.value`:
they clearly distinguish absent metadata from a present undefined payload.

`InspectionSnapshot.alias` would be clearer as `aliasTarget`. Its outer
`bindingId` is the inspected binding's ID, including an alias binding's own ID;
the comment currently calls it the canonical binding. A runtime probe confirmed
that the alias's outer ID differs from its target's ID. Fix that comment, and
document that `aliasTarget` identifies the direct target, while acquisition
snapshots follow the canonical target through any alias chain.

Sources: [snapshots](../../src/inspection.ts#L4),
[event fields](../../src/observers.ts#L12),
[snapshot construction](../../src/runtime.ts#L209).

**6. Make object creation and immutable configuration explicit — medium priority.**

| Current name | Candidate | Reason |
| --- | --- | --- |
| `DiBag.begin()` | `DiBag.createBuilder()` | Names the returned object. |
| `DiBag.module()` | `DiBag.createModuleBuilder()` | Returns a builder, not a sealed module. |
| `Builder.end()` | `Builder.build()` | Produces a new resolvable bag; does not close anything. |
| `Builder.start()` | `Builder.buildAndStart()` | Makes creation of a fresh bag explicit. |
| `Bag.scope()` | `Bag.createScope()` | Creates a tracked child instead of retrieving the current scope. |
| `Facade.configure()` | `Facade.withRuntimeOptions()` | Returns another facade and does not mutate the original. |
| `Facade.observe()` | `Facade.withObserver()` | Returns another facade; does not subscribe to an existing bag or return an unsubscribe function. |
| `ModuleBuilder.exports()` | `ModuleBuilder.buildModule(exports)` | Makes sealing and the transition from builder to module explicit. |
| `Module.rename()` | `Module.renameExport()` | Changes one public export name. |

Keep `fork` if its first sentence consistently says it creates an independent
bag with fresh instances and separate cleanup. The `scope` versus `fork`
ownership distinction matters more than replacing every familiar short verb.
An explicit `forkIndependent()` is an optional alternative.

Keep `resolve`, `inspect`, `close`, `replace`, `alias`, `contribute`, and
`withDisposal`. Their names communicate their purposes in context. `add` and
`bind` are acceptable as a documented pair; `registerNamed` and `bindToken`
are optional if distinguishing string names from typed tokens is a priority.
`installModule` is similarly an optional expansion of `install`.

Sources: [bag operations](../../src/di-bag.ts#L74),
[builder finalization](../../src/di-bag.ts#L362),
[facade](../../src/di-bag.ts#L391),
[module finalization](../../src/module.ts#L174).

**7. Clarify provider construction and option semantics — medium priority.**

`factory` returns a provider description, not a callable factory. Consider
`fromFactory`, giving `fromFactory`, `fromFunction`, `fromClass`, and
`fromPlugin` a consistent family. Rename `withContext` to
`fromContextualFactory` or `withAcquisitionContext`: it supplies the acquisition
owner's cancellation signal, not arbitrary application context.

`fromTokens` and `fromFunction` both construct positional callback providers.
The latter additionally checks the selected argument tuple against the actual
parameter tuple, including optional/rest parameters. Prefer `fromFunction` as
the documented default and explain why `fromTokens` remains available. Do not
blindly alias or remove one: their compile-time acceptance rules differ.

Prefer `acquisitionMode` over the option name `acquisition`, and
`nativePromise` over the literal `native`. Retain `auto` and `raw`, with a
compact behavioral table explaining that `raw` treats even a Promise as the
acquired value, while `nativePromise` tracks its fulfillment for readiness and
disposal. Both can expose the original Promise to consumers. Avoid calling
these modes `sync` and `async`, which would repeat the transformation problem.

Keep lifetime literals `root`, `scoped`, and `transient`. Clarify that root
means the owning scope ancestry, with a fresh ownership family for a fork,
and that a root override introduced by a child belongs to that child ancestry.
Rename `captureScoped` to `allowScopedDependencies`: it is permission to accept
a dependency relationship, not an action that immediately captures a value.
`share` is reasonable if its docs explicitly describe borrowing the parent's
instance together with the dependencies already bound to it.

`StartupOptions.concurrency` could become `startupOrder`, because it selects
parallel versus sequential acquisition and is not a numeric concurrency limit.
Keep `timeoutMs`, `signal`, `isNativePromise`, and `onEvent`/`onError`.

Sources: [factory adapter](../../src/provider.ts#L316),
[composition adapters](../../src/composition.ts#L23),
[acquisition modes](../../src/acquisition-mode.ts#L5),
[lifetime](../../src/lifetime.ts#L26),
[startup options](../../src/startup.ts#L7).

**8. Public types should name their domain and their result — medium priority.**

The table covers all 97 current entry-point names. “Keep” means the name is
reasonable with accurate documentation. Advanced helper exports may be needed
for nameable consumer declarations, so reducing their prominence does not
necessarily mean removing their exports.

| Current exports | Recommendation |
| --- | --- |
| `DiBag`, `Bag`, `Module`, `ModuleBuilder`, `Provider`, `Registration` | Keep. These correspond to the library's domain. |
| `Builder`, `Facade` | Prefer `BagBuilder`, `DiBagApi`. The latter is a public API surface, not a domain facade callers need to understand. |
| `DisposableFactory` | Prefer `FactoryWithDisposal`; disposal applies to the acquired value, not the function object. |
| `DiBagCleanupError`, `DiBagStartupError`, `DiBagStartupCancelledError`, `CleanupFailure` | Keep names; improve the fields and messages described above. |
| `DiBagPluginError` | Consider `DiBagPluginValidationError`; it covers descriptor/output validation, not arbitrary plugin execution failures. |
| `Token`, `TokenBase`, `TokenKey`, `TokenService` | Keep; `TokenService` → `TokenServiceType` is optional. Keep `key` and `.of<Service>()`. |
| `AcquisitionContext`, `AcquisitionMode`, `Lifetime`, `StartupOptions`, `ScopeOptions` | Keep with the option and lifetime clarifications above. |
| `RuntimeOptions` | Consider `DiBagRuntimeOptions` when used outside the facade. |
| `ContextualFactory` | Prefer `FactoryFromContextualCallback`; this type extracts the ordinary one-argument factory shape, not the callback that receives context. |
| `AcquisitionSnapshot`, `Presence` | Keep. |
| `InspectionSnapshot` | Prefer `RegistrationSnapshot` to identify what is inspected. |
| `FramePresenceTuple` | Prefer `AcquisitionMetadataPresence`. |
| `ProviderFactory`, `ProviderOutput`, `ProviderAcquisitionMetadata` | Keep; `ProviderOutput` → `ProviderOutputType` is optional. |
| `ProviderAcquired`, `ProviderNeeds`, `ProviderMetadata` | Prefer `ProviderAcquiredValue`, `ProviderNamedDependencies`, `ProviderRegistrationMetadata`. |
| `ProviderTokenNeeds`, `ProviderOptionalTokenNeeds`, `ProviderAllTokenNeeds` | Prefer `ProviderRequiredTokens`, `ProviderOptionalTokens`, `ProviderCollectionTokens`. Document that required tokens include lazy references. |
| `ProviderGraph`, `TokenGraph` | Prefer `ProviderGraphContract`, `TokenDependencyContract`; these carry type contracts, not runtime graph objects. |
| `ModuleProvides`, `ModuleRequires`, `ModuleContributions` | Prefer `ModuleExportedServices`, `ModuleRequiredServices`, `ModuleContributionServices`. |
| `ModuleConstraints`, `ModuleContributionConstraints`, `Contribution`, `ContributionConstraint` | Keep as advanced type contracts; document the retained consumer/ownership relationships. |
| `PublicProviders`, `ModulePublicProviders` | Prefer `PublicProviderContracts`, `ModuleExportedProviderContracts`. |
| `Provided`, `Entries`, `From`, `Merge`, `Selected` | Prefer `ServicesOf`, `RegistrationEntries`, `RegistrationsFromEntries`, `OverrideRegistrations`, `SelectedRegistrations`. `Merge` replaces colliding keys; it does not deeply merge values. |
| `Checked`, `Complete` | Prefer `CheckDependencyCompatibility`, `CheckDependencyCompleteness`. These yield an admission result, not a checked or completed registration map. |
| `Selection`, `Overrides`, `TokenMember`, `DisjointScopeSelection` | Prefer `CheckServiceSelection`, `CheckOverrides`, `CheckTokenBinding`, `CheckDisjointScopeSelection`. |
| `CheckedLifetimes`, `CheckedScopeLifetimes` | Prefer `CheckLifetimes`, `CheckScopeLifetimes`, consistently naming their validation role. |
| `ForkContext` | Prefer `OverrideFactoryContext`; also used for child scopes. |
| `Binding`, `ReboundProviders`, `ReboundSelection`, `SelectionKey` | Prefer `TokenBinding`, `ReboundTokenProviders`, `ReboundOverrideSelection`, `ServiceSelectionKey`. |
| `Renamed` | Prefer `RenameKey`; this transforms a type rather than identifying a domain object. |
| `LexicalContext`, `RenamedLifetimeObligation`, `RenamedLifetimeProviders` | Prefer `ModuleBindingContext`; keep the latter two as advanced declaration support with examples and descriptive type parameters. |
| `UnsharedAliases`, `ScopedAliases`, `SharedAliasProviders` | Keep as advanced declaration support; document parent-sharing removal and routing instead of presenting these as ordinary alias services. |
| `AliasRegistration`, `AliasEntries`, `AliasOutput` | Keep; `AliasEntries` → `AliasRegistrations` would clarify that it is a registration map, unlike `Entries`' entry union. |
| `OptionalReference`, `LazyReference`, `AllReference`, `Dependency` | Prefer `OptionalDependency`, `LazyDependency`, `CollectionDependency`, `DependencyReference`. |
| `BuilderContribute`, `ModuleContribute` | Prefer `BagContributeMethod`, `ModuleContributeMethod`; these are callable method signatures. |
| `CompositionArguments`, `CompositionFunction` | Prefer `CheckDependencyArguments`, `InjectedFunction`; the former validates tuple compatibility. |
| `PluginOptions`, `PluginPredicate`, `PluginAcquisition`, `PluginResult` | Prefer `PluginOptions`, `PluginOutputValidator`, `PluginAcquisitionMode`, `PluginProvider`. `PluginResult` is a provider, not a plugin's service result. |
| `fromPlugin` | Replace the unusual type-only function export with an ordinary callable type named `PluginProviderFactory`, or document `Facade['fromPlugin']` as the way to name that signature. The runtime method remains `DiBag.fromPlugin`. |
| `LifecycleEvent`, `ObserverFailure`, `ObserverCallback`, `ObserverErrorCallback`, `ObserverOptions`, `ScopeEventFields`, `AcquisitionEventFields` | Keep. Clarify metadata fields, callback scheduling, and the meaning of `disposalIndex`. |

For public declarations, replace unexplained generic names such as
`Provider<F, M, A, G, V>` with `FactoryFn`, `RegistrationMetadata`,
`AcquisitionMetadata`, `GraphContract`, and `AcquiredValue`, or at least add
complete `@typeParam` descriptions. The current generated Provider reference
shows five parameters with no descriptions. Do the same for `Module`, `Bag`,
and exported helper types. Internal local generics need not all be expanded.

Sources: [entry-point inventory](../../src/index.ts),
[provider extractors](../../src/provider.ts#L48),
[graph helpers](../../src/types.ts#L11),
[module projections](../../src/module-types.ts#L98),
[plugin types](../../src/plugins.ts#L10),
[generated Provider reference](../reference/index/interfaces/Provider.md).

**9. Clarify remaining observable names and comments — lower priority.**

- `resolveAll`, `inspectAll`, and `all` operate on contributions. They do not
  include a normal `bind(token, ...)` registration for the same token. Keep the
  names with explicit first-sentence documentation, or consistently use
  `resolveContributions`, `inspectContributions`, and `allContributions`.
- `DiBagStartupCancelledError.cleanup` should be `cleanupPromise` or
  `cleanupComplete`; it is an awaitable completion signal, not a method.
- `disposalIndex` is carried on the `cleanup-failed` variant of
  `LifecycleEvent`; its counter is assigned per owning scope in
  disposer invocation order. Document that it is not an acquisition-local
  metadata index or a globally unique stage ID. `disposalSequence` is clearer.
- `fromPlugin` describes its `dependencies` parameter as “Host values”. The
  caller supplies dependency references, and the library resolves their values.
- In the glossary, add `Registration`, `Binding`, `Scope`, `Contribution`,
  `Registration metadata`, and `Acquisition metadata` if these recommendations
  are adopted. Define the distinctions once and reuse them in errors and docs.
- Public error class names already carry the useful `DiBag` prefix. Internal
  `BindingGraph`, `ProviderExecution`, and `AcquisitionFamily` are reasonable.
  `Acquisitions` → `ScopeAcquisitions`, `Runtime` → `BagRuntime`,
  `Owned` → `FactoryWithDisposal`, and `Observers` → `LifecycleObservers` would
  improve stack traces and source navigation, with less priority than public
  errors and APIs. These internal classes are not root runtime exports.

**Suggested implementation order.** Fix factual message errors and inaccurate
comments first. Next, standardize library error codes and diagnostic context,
then adopt consistent metadata names and symmetric method families. Choose a coherent set of
builder and helper-type names together rather than adding every optional alias.
If existing consumers require compatibility, retain deprecated aliases during
migration and make examples and generated docs show the preferred spelling.
Preserve inference and authentication behavior; rerun both compiler contract
suites, declaration-consumer checks, diagnostic markers, and relevant scale
checks for any type changes. Regenerate the reference from source comments.
