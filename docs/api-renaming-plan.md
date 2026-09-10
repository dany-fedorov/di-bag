# API renaming and consolidation plan

Recorded on 2026-09-10 from the API review and subsequent naming discussion.
The changes are implemented with the consolidated forms selected below. See the
[final decisions and assumptions](superpowers/specs/2026-09-10-api-renaming-design.md)
and [migration guide](migrations/api-renaming.md) for the current API. The
[implementation verification report](reports/2026-09-10-api-renaming-verification.md)
records the final checks. The original
review inventory below retains the alternatives considered during planning.

Supporting reviews contain source links, reproduced diagnostics, and the full
inventory:

- [API clarity review: all 97 exported names](reports/2026-09-10-api-clarity-review.md)
- [API consolidation review: all 39 public method names](reports/2026-09-10-api-consolidation-review.md)

**Naming direction.** Use explicit verbs and objects for operations and
descriptive nouns for types. Related operations should share the same stem.
Use `direct` and `awaited` to describe whether an operation awaits its input;
`direct` may still expose a Promise when that is the exact result. Retain
domain terms when they distinguish provider declarations, acquisitions, and
resource ownership.

**Decision status.**

| Area | Status |
| --- | --- |
| Combined `withMetadata(provider, { static, dynamic })` | Accepted, including mode-dependent callback and output types. |
| `transformServiceDirect` / `transformServiceAwaited` | Superseded by the single mode-based method. |
| Single `transformService(provider, { mode, transform })` | Selected and implemented; direct output acquisition remains independently configurable. |
| More descriptive builder, type, and diagnostic names | Preferred names below implemented, including `installModule` and plugin validation error naming. |
| Consolidating adapters, registration, factory context, and facade configuration | All implemented; `fromFactory` defaults to `auto`, with context explicitly opt-in. |

**Accepted metadata API.**

Replace the current static-only `withMetadata`, `withAcquisitionMetadata`, and
`withAcquisitionMetadataAsync` with one method:

```ts
DiBag.withMetadata(databaseProvider, {
  static: {
    module: 'billing',
    ownerTeam: 'payments',
  },
  dynamic: {
    mode: 'awaited',
    describe: connection => ({
      connectionId: connection.id,
      server: connection.server,
      connectedAt: Date.now(),
    }),
  },
});
```

Either level can be supplied independently:

```ts
DiBag.withMetadata(provider, {
  static: { module: 'billing' },
});

DiBag.withMetadata(provider, {
  dynamic: {
    mode: 'direct',
    describe: value => ({ observedAt: Date.now() }),
  },
});
```

Static metadata belongs to the registration and is available before resolution.
Dynamic metadata belongs to a particular acquisition; cached resolutions reuse
it, while new acquisitions compute fresh metadata. One named or typed-token
binding can carry both. Keep the two levels separate in inspection and events.

| Source output | Dynamic mode | Callback input | Exposed service |
| --- | --- | --- | --- |
| `User` | `direct` | `User` | `User` |
| `Promise<User>` | `direct` | `Promise<User>` | `Promise<User>` |
| `User` | `awaited` | `User` | `Promise<User>` |
| `Promise<User>` | `awaited` | `User` | `Promise<User>` |

Require the dynamic mode explicitly and use it to infer callback and result
types. Reject invalid modes and async metadata callbacks: `describe` must
return a synchronous plain record in either mode. Static-only calls retain the
original output. Direct annotation also retains the source acquisition policy;
awaited annotation introduces a native Promise stage. Neither adds ownership.

Retain existing composition behavior: static key collisions reject; repeated
dynamic annotations append separate metadata frames; presence distinguishes
absent metadata from present undefined payloads.

This options shape needs an explicit migration from today's
`withMetadata(provider, record)`. An old record can already contain keys named
`static` or `dynamic`, so those keys cannot be used to guess the caller's intent.

**Service transformation.**

The earlier accepted pair was:

| Current | Accepted name |
| --- | --- |
| `mapSync` | `transformServiceDirect` |
| `mapAsync` | `transformServiceAwaited` |

The implemented API combines them using the same mode convention as metadata:

```ts
DiBag.transformService(connectionProvider, {
  mode: 'awaited',
  transform: connection => new UserRepository(connection),
});

DiBag.transformService(promiseProvider, {
  mode: 'direct',
  transform: promise => ({ pending: promise }),
});
```

Both variants produce a new provider exposing the transformed service while
retaining dependencies, lifetime, metadata, and existing cleanup stages.
Transformation adds no cleanup ownership for its result. This supports, for
example, exposing a repository while retaining disposal of its underlying
connection.

Direct transformation preserves the exact callback result. Awaited
transformation awaits its input and adopts the callback result into a Promise.
Unlike metadata callbacks, transformation callbacks may return Promises.
Preserve the direct variant's separate output acquisition policy for readiness
and disposal; `mode: 'direct'` must not erase explicit raw-Promise support.

The consolidated method is the only public form; no aliases are retained.

**Further consolidation recommendations.**

| Current APIs | Proposed API | Behavior to preserve |
| --- | --- | --- |
| `fromTokens`, `fromFunction` | `fromFunction` | Positional dependency injection, exact argument checking, optional/rest parameters, and provider contracts. |
| Builder and ModuleBuilder `add`, `bind` | `register` overloads | Named bulk registration and typed-token registration; duplicate rejection and output/dependency checks. |
| `factory`, `withContext` | `fromFactory` with optional acquisition context | Exact named-dependency callback types, acquisition-owner cancellation, and explicit acquisition policies. |
| `configure`, `observe` | `withConfiguration({ runtime, observers })` | Immutable facades, inherited runtime options, and observers appended in order. Lower priority. |

Proposed registration shapes:

```ts
builder.register({ config: provideConfig, logger: provideLogger });
builder.register(databaseToken, databaseProvider);
```

For the function-adapter consolidation, retain strict argument checks and
write intentionally unused selected dependencies explicitly:

```ts
// Current permissive form:
DiBag.fromTokens([loggerToken], () => 42);

// Recommended common form:
DiBag.fromFunction([loggerToken], (_logger) => 42);
```

The selected logger is acquired in both cases. Dropping it from the tuple
would change behavior. The two current methods cannot be replaced by a simple
alias without deciding which acceptance rules survive.

For `fromFactory`, an explicit option such as `context: 'acquisition'` should
select the two-argument callback and keep context allocation opt-in. Do not
infer context use from function arity. The merged method defaults to `auto`; the migration guide explains explicit raw
and native Promise policies.

**Other method and field renames.**

| Current | Preferred direction |
| --- | --- |
| `DiBag.begin()` | `DiBag.createBuilder()` |
| `DiBag.module()` | `DiBag.createModuleBuilder()` |
| `Builder.end()` | `Builder.build()` |
| `Builder.start()` | `Builder.buildAndStart()` |
| `Bag.scope()` | `Bag.createScope()` |
| `ModuleBuilder.exports(keys)` | `ModuleBuilder.buildModule(keys)` |
| `Module.rename(oldName, newName)` | `Module.renameExport(oldName, newName)` |
| `install(module)` | `installModule(module)`, optional expansion |
| `configure` / `observe`, if kept separate | `withRuntimeOptions` / `withObserver` |
| `factory` / `withContext`, if kept separate | `fromFactory` / `fromContextualFactory` |
| Option `acquisition` | `acquisitionMode` |
| Acquisition literal `native` | `nativePromise`; retain `auto` and `raw` |
| Lifetime option `captureScoped` | `allowScopedDependencies` |
| Startup option `concurrency` | `startupOrder`, candidate name for parallel/sequential scheduling |
| Static snapshot/event `metadata` | `registrationMetadata` |
| Acquisition snapshot `metadata` and event `frames` | `acquisitionMetadata` |
| Inspection `alias` | `aliasTarget` |
| Startup cancellation error `cleanup` | `cleanupPromise`, preferred over the alternative `cleanupComplete` |
| Cleanup event `disposalIndex` | `disposalSequence` |

Keep `acquisitionId` and `AcquisitionSnapshot`: they identify a particular
attempt, including pending or failed work. Keep `Presence.present` and
`Presence.value`. Keep lifetime literals `root`, `scoped`, and `transient`, and
document how roots relate to scope ancestry and independent forks.

**Public type and class names.** These are representative recommendations;
the [full export inventory](reports/2026-09-10-api-clarity-review.md) records
every exported name and additional optional spellings.

| Current | Recommended |
| --- | --- |
| `Builder` | `BagBuilder` |
| `Facade` | `DiBagApi` |
| `DisposableFactory` | `FactoryWithDisposal` |
| `ProviderAcquired` | `ProviderAcquiredValue` |
| `ProviderNeeds` | `ProviderNamedDependencies` |
| `ProviderMetadata` | `ProviderRegistrationMetadata` |
| `FramePresenceTuple` | `AcquisitionMetadataPresence` |
| `InspectionSnapshot` | `RegistrationSnapshot` |
| `ProviderTokenNeeds` / `ProviderOptionalTokenNeeds` / `ProviderAllTokenNeeds` | `ProviderRequiredTokens` / `ProviderOptionalTokens` / `ProviderCollectionTokens` |
| `ProviderGraph` / `TokenGraph` | `ProviderGraphContract` / `TokenDependencyContract` |
| `Provided` / `Entries` / `From` | `ServicesOf` / `RegistrationEntries` / `RegistrationsFromEntries` |
| `Merge` / `Selected` | `OverrideRegistrations` / `SelectedRegistrations` |
| `Checked` / `Complete` | `CheckDependencyCompatibility` / `CheckDependencyCompleteness` |
| `ModuleProvides` / `ModuleRequires` | `ModuleExportedServices` / `ModuleRequiredServices` |
| `ForkContext` / `Binding` | `OverrideFactoryContext` / `TokenBinding` |
| `OptionalReference` / `LazyReference` / `AllReference` | `OptionalDependency` / `LazyDependency` / `CollectionDependency` |
| `Dependency` | `DependencyReference` |
| `PluginResult` / `PluginPredicate` / `PluginAcquisition` | `PluginProvider` / `PluginOutputValidator` / `PluginAcquisitionMode` |
| Type-only function export `fromPlugin` | A callable type `PluginProviderFactory`, or the public API's `['fromPlugin']` type |
| `DiBagPluginError` | Consider `DiBagPluginValidationError` |

Document public generic parameters or expand opaque letters such as
`Provider<F, M, A, G, V>`. Preserve helper exports required for nameable consumer
declarations. Internal class candidates are `Acquisitions` →
`ScopeAcquisitions`, `Runtime` → `BagRuntime`, `Owned` →
`FactoryWithDisposal`, and `Observers` → `LifecycleObservers`.

**Keep distinct APIs where behavior differs materially.**

- `createScope` and `fork`: parent-tracked ownership versus independent ownership.
- `resolve` and `resolveAll`, with matching inspection methods: single bindings
  and contributions are different lookup collections.
- `build` and `buildAndStart`: lazy construction versus eager acquisition with
  cancellation, scheduling, and rollback.
- `fromFunction`, `fromClass`, and `fromPlugin`: function invocation, class
  construction, and a checked plugin boundary.
- `replace`, `alias`, `contribute`, and registration: different identity and
  collision rules.
- `withDisposal`, `withLifetime`, metadata, and transformation: independent
  policies and ordered cleanup stages.
- `optional`, `lazy`, `all`, and `token(key).of<Service>()`: concise dependency
  expressions and typed identity construction.
- Portable and Node entry points; distinct cleanup, startup, cancellation, and
  plugin error contracts.

**Diagnostic work accompanying the renames.**

Correct the reproduced factual errors: count failed disposal callbacks
accurately, report a closed bag as closed, and retain the full reentrant
resolution cycle path. Fix compiler errors that describe registration keys as
factory dependencies or mention only string selections when tokens are valid.

Messages should identify the actual public operation, service, dependency,
option, and corrective action. For example:

```text
Cannot resolve "api": dependency "db" is not registered.
Resolution path: api -> db.
```

Add stable library error codes and structured diagnostic fields. Preserve
original application exceptions and error causes. Type errors should identify
consumer/dependency relationships, including expected and provided types where
feasible. Measure richer type diagnostics against compiler-scale fixtures.
Update error messages to use the final chosen API spellings.

**Migration sequence and checks.**

1. Settle the outstanding consolidation choices and compatibility policy.
2. Correct factual diagnostics and inaccurate source comments.
3. Implement metadata and the selected transformations/adapters/registration
   shapes while preserving inference, authentication, and ownership.
4. Apply method, option, type, and internal-name changes in coherent groups.
5. Update examples, tutorials, migration notes, and generated reference output.
6. Run affected runtime tests, both compiler contract suites, declaration
   consumer checks, diagnostic markers, applicable scale checks, and docs checks.

Retain deprecated aliases only when compatibility requires them; show one
preferred form in documentation. Preserve static/dynamic metadata separation,
raw versus fulfilled acquisition semantics, and ordered disposal throughout.

The original reviews used targeted runtime tests and compiler probes to establish
the pre-migration findings. Verification of the implemented combined signatures
is recorded separately in the implementation verification report.
