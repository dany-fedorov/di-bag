# Migrating to the consolidated API

This is a breaking pre-1.0 API change. Update all callers together: deprecated
aliases are not retained. The package still exposes `di-bag` and `di-bag/node`,
with no runtime dependencies. The underlying dependency graph, lifetime,
acquisition, and ownership rules remain intact.

## Builders and registration

| Previous | Current |
| --- | --- |
| `DiBag.begin()` | `DiBag.createBuilder()` |
| `DiBag.module()` | `DiBag.createModuleBuilder()` |
| `builder.add(registrations)` | `builder.register(registrations)` |
| `builder.bind(token, provider)` | `builder.register(token, provider)` |
| `builder.end()` | `builder.build()` |
| `builder.start(keys, options)` | `builder.buildAndStart(keys, options)` |
| `builder.install(module)` | `builder.installModule(module)` |
| `moduleBuilder.exports(keys)` | `moduleBuilder.buildModule(keys)` |
| `module.rename(oldName, newName)` | `module.renameExport(oldName, newName)` |
| `bag.scope(...)` | `bag.createScope(...)` |

Both builders support the two `register` overloads. Registrations remain
immutable, duplicates reject, and token binding still checks the service output.
`replace`, `alias`, `contribute`, `resolve`, `resolveAll`, `inspect`, `inspectAll`,
`fork`, and `close` retain their names and separate responsibilities.

`createScope` creates a child owned by its parent. `fork` creates an independent
ownership family that must be closed separately. Root services belong to their
owning scope ancestry; a root override introduced by a child belongs to that
child's ancestry. A fork constructs fresh root services.

## Metadata

Move an old static metadata record into the explicit `static` field:

```ts
// Before
DiBag.withMetadata(provider, { owner: 'billing' });

// After
DiBag.withMetadata(provider, { static: { owner: 'billing' } });
```

No runtime detection of old records is possible: application records may already
contain keys named `static` or `dynamic`. Wrap the entire old record, including
those keys. Use `dynamic` to replace `withAcquisitionMetadata` (direct) or
`withAcquisitionMetadataAsync` (awaited). At least one metadata level is required;
one provider can carry both:

```ts
const described = DiBag.withMetadata(loadConnection, {
  static: { owner: 'billing' },
  dynamic: {
    mode: 'awaited',
    describe: (connection) => ({ connectionId: connection.id }),
  },
});
```

| Source output | Dynamic mode | Callback input | Exposed service |
| --- | --- | --- | --- |
| `User` | `direct` | `User` | `User` |
| `Promise<User>` | `direct` | Same `Promise<User>` | Same `Promise<User>` |
| `User` | `awaited` | `User` | `Promise<User>` |
| `Promise<User>` | `awaited` | `User` | `Promise<User>` |

`describe` must synchronously return a plain record in both modes. Arrays,
class instances, functions, thenables, and async callbacks are rejected. Records
are shallow-copied and frozen; payload identity is preserved. Static collisions
reject, and repeated dynamic annotations append ordered frames. Cached reads
reuse metadata; retries, transient reads, and new scopes compute new frames.
`Presence.present` and `Presence.value` still distinguish absence from a present
undefined payload. Metadata does not accept cleanup ownership.

## Transformations

Replace `mapSync(provider, callback, options?)` with:

```ts
DiBag.transformService(provider, {
  mode: 'direct',
  transform: callback,
  acquisitionMode: 'raw', // optional; defaults to auto
});
```

Replace `mapAsync(provider, callback)` with:

```ts
DiBag.transformService(provider, { mode: 'awaited', transform: callback });
```

Direct mode passes the exact source output and exposes the exact callback result;
either may be a Promise. Its independent `acquisitionMode` controls readiness and
the value received by a newly attached disposer. Awaited mode awaits the source
and adopts the result into a native Promise; it rejects an acquisition override.
Both retain dependencies, lifetime, metadata, and existing cleanup stages. Neither
owns its transformed result unless `withDisposal` is explicitly attached.

## Provider adapters and configuration

Replace `factory(callback, { acquisition })` with
`fromFactory(callback, { acquisitionMode })`. An omitted options argument now
defaults to `auto`. Replace `withContext(callback, options?)` with:

```ts
DiBag.fromFactory((dependencies, { signal }) => load(dependencies, signal), {
  context: 'acquisition',
  acquisitionMode: 'nativePromise',
});
```

Only `context: 'acquisition'` selects the second callback argument. Callback arity
does not enable context allocation. The signal belongs to the acquisition owner,
including parent-owned root and shared services.

Replace `fromTokens` with `fromFunction`. The unified adapter checks the actual
parameter tuple, including optional and rest arguments. Preserve selected but
unused dependencies explicitly:

```ts
// Before: logger was acquired even though the callback omitted it.
DiBag.fromTokens([loggerToken], () => 42);
// After: keep that acquisition and make the unused parameter explicit.
DiBag.fromFunction([loggerToken], (_logger) => 42);
```

`fromClass` and `fromPlugin` remain distinct. Replace the old type-only function
import `fromPlugin` and `typeof fromPlugin` with `PluginProviderFactory`.

Replace `configure(runtime)` and `observe(observer)` with:

```ts
const configured = DiBag.withConfiguration({
  runtime: { isNativePromise: trustedHostPredicate },
  observers: [{ onEvent, onError }],
});
```

Either field can be omitted. Runtime settings are inherited, and each observer
array is appended in order after inherited observers. Both observer callbacks
are required. Older facades, builders, and bags retain their configuration.

## Options and diagnostics

| Previous | Current |
| --- | --- |
| `acquisition` option | `acquisitionMode` |
| Acquisition literal `'native'` | `'nativePromise'` |
| Root lifetime `captureScoped` | `allowScopedDependencies` |
| Startup `concurrency` | `startupOrder` (`parallel`, `sequential`, or a positive safe integer) |
| Registration snapshot/event `metadata` | `registrationMetadata` |
| Acquisition snapshot `metadata`, event `frames` | `acquisitionMetadata` |
| Registration snapshot `alias` | `aliasTarget` |
| Startup cancellation error `cleanup` | `cleanupPromise` |
| Cleanup event `disposalIndex` | `disposalSequence` |
| `DiBagPluginError` | `DiBagPluginValidationError` |

`auto` uses the configured native-Promise classifier, `raw` accepts the exact
value including a Promise, and `nativePromise` observes native fulfillment for
readiness and disposal while exposing the original Promise. The Node entry is
preconfigured; portable graphs must supply a trusted classifier or explicit modes.

Inspection's outer `bindingId` identifies the inspected binding, including an
alias's own identity. `aliasTarget` describes its direct target; acquisition
snapshots follow the canonical target through alias chains.

Library errors expose stable `DI_BAG_*` codes and frozen structured `details`.
Use these for recovery instead of parsing message text. Application exceptions
retain their identity and causes; observer failures still go to `onError`.
Cleanup messages count failed disposer callbacks, including multiple callbacks
on one acquisition. Closed bags report their actual state and reentrant cycles
include the full resolution path. Type diagnostics distinguish invalid named
registration keys from invalid dependency declarations and include the failing
consumer/dependency relationship where it is known.

## Type names

Preserve inferred graph/provider types, especially across declaration boundaries.
The renamed helpers carry the same constraints; shortening annotations must not
erase dependency, token, metadata, lifetime, or ownership information.

| Previous | Current |
| --- | --- |
| `Builder` | `BagBuilder` |
| `Facade` | `DiBagApi` |
| `DisposableFactory` | `FactoryWithDisposal` |
| `ProviderAcquired` | `ProviderAcquiredValue` |
| `ProviderNeeds` | `ProviderNamedDependencies` |
| `ProviderMetadata` | `ProviderRegistrationMetadata` |
| `FramePresenceTuple` | `AcquisitionMetadataPresence` |
| `InspectionSnapshot` | `RegistrationSnapshot` |
| `ProviderTokenNeeds` | `ProviderRequiredTokens` |
| `ProviderOptionalTokenNeeds` | `ProviderOptionalTokens` |
| `ProviderAllTokenNeeds` | `ProviderCollectionTokens` |
| `ProviderGraph` | `ProviderGraphContract` |
| `TokenGraph` | `TokenDependencyContract` |
| `Provided` | `ServicesOf` |
| `Entries` | `RegistrationEntries` |
| `From` | `RegistrationsFromEntries` |
| `Merge` | `OverrideRegistrations` |
| `Selected` | `SelectedRegistrations` |
| `Checked` | `CheckDependencyCompatibility` |
| `Complete` | `CheckDependencyCompleteness` |
| `ModuleProvides` | `ModuleExportedServices` |
| `ModuleRequires` | `ModuleRequiredServices` |
| `ForkContext` | `OverrideFactoryContext` |
| `Binding` | `TokenBinding` |
| `OptionalReference` | `OptionalDependency` |
| `LazyReference` | `LazyDependency` |
| `AllReference` | `CollectionDependency` |
| `Dependency` | `DependencyReference` |
| `PluginResult` | `PluginProvider` |
| `PluginPredicate` | `PluginOutputValidator` |
| `PluginAcquisition` | `PluginAcquisitionMode` |

Internal classes now use `ScopeAcquisitions`, `BagRuntime`,
`FactoryWithDisposal`, and `LifecycleObservers`; these are not runtime exports.

The [decision record](../superpowers/specs/2026-09-10-api-renaming-design.md)
documents assumptions selected while executing the original plan.
