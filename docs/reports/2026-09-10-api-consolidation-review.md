# API consolidation review

Reviewed the current working tree on 2026-09-10 after the user selected the
combined `withMetadata(provider, { static, dynamic })` design. This is a review
of further candidates, not an implementation. The chosen long transformation
names remain the current decision until a combined replacement is accepted.

See the consolidated [API renaming plan](../api-renaming-plan.md) for the
current decision status and migration outline.

The criterion is whether methods perform the same operation with a selectable
policy. Combining operations should preserve readable calls, useful TypeScript
errors, and explicit resource ownership.

**Accepted: metadata.** The single `withMetadata` method covers fixed
registration metadata and acquisition-specific metadata. `dynamic` requires
`{ mode: 'direct' | 'awaited', describe }`. The mode determines the callback
input and exposed output; static-only calls preserve the original output.
Callbacks remain synchronous, dynamic annotations remain separate frames, and
static collisions still reject. This replaces the current `withMetadata`,
`withAcquisitionMetadata`, and `withAcquisitionMetadataAsync` methods. The
[naming review](2026-09-10-api-clarity-review.md) records the complete decision.

**1. Recommend combining transformation variants.**

Use the same policy pattern as metadata:

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

This could replace the previously chosen `transformServiceDirect` and
`transformServiceAwaited` pair, currently `mapSync` and `mapAsync` in code.
The explicit verb and object remain in the method name. The literal mode
controls callback inference and whether the provider preserves the exact
callback result or exposes a Promise of its awaited result. Unlike metadata
callbacks, service transformation callbacks may return Promises.

The direct branch must retain the existing explicit acquisition policy for
its new output stage (`auto`, `raw`, or `native` in the current API). That
policy controls readiness and disposal; it is distinct from whether the
transformation awaits its input. The awaited branch always produces a native
Promise stage. Combining names must not discard raw-Promise ownership support.
Previous dependencies, metadata, lifetime, and cleanup stages remain attached.

Source: [transformation implementations](../../src/provider.ts#L160).

**2. Recommend one positional function adapter.**

`fromTokens` and `fromFunction` both resolve a dependency tuple and invoke a
callback with the resulting values in positional order. Keep `fromFunction`
as the public method and use its existing argument-compatibility checks.

```ts
DiBag.fromFunction([configToken, loggerToken], (config, logger) =>
  createClient(config, logger),
);
```

The difference that must be handled is unused selected arguments:

```ts
DiBag.fromTokens([loggerToken], () => 42);             // Accepted today.
DiBag.fromFunction([loggerToken], () => 42);           // Rejected today.
DiBag.fromFunction([loggerToken], (_logger) => 42);    // Accepted today.
```

Recommend requiring explicit unused parameters when an extra dependency is
intentionally acquired. Preserve the strict optional/rest-parameter checks.
Simply aliasing the current functions would either break some callers or
weaken an existing check. Keep a deprecated compatibility method if migration
requires it. A runtime probe confirmed that even an ignored selected dependency
is acquired; removing the token from the tuple would change behavior.

Sources: [fromTokens](../../src/provider.ts#L94),
[fromFunction](../../src/composition.ts#L11),
[intentional difference in positive fixtures](../../tests/types/composition-adapters.ts#L38),
[negative fixture](../../tests/types/negative/composition-adapters.ts#L17).

**3. Recommend a common registration verb for named and token bindings.**

`add` and `bind` both introduce new service registrations. One `register`
method can retain their current call shapes on both builder types:

```ts
builder.register({ config: provideConfig, logger: provideLogger });
builder.register(databaseToken, databaseProvider);
```

Use separate overloads for the named registration map and typed token.
Continue to reject duplicate bindings, non-string bulk keys, and token output
type mismatches. Preserve bulk inference and forward dependency checking.
The token overload must retain token identity, provider metadata, lifetime,
and acquisition contracts. `replace` should remain separate: it requires an
existing registration and checks compatibility with surviving consumers.
`contribute` also remains separate: it appends to an ordered collection.

Sources: [add](../../src/di-bag.ts#L251),
[bind](../../src/di-bag.ts#L297),
[module registration](../../src/module.ts#L82).

**4. Consider combining factory declaration and acquisition context.**

`factory` and `withContext` both construct providers from factories taking
named dependencies. Context is an optional capability of that construction.
The combined method could use the earlier recommended name `fromFactory`:

```ts
DiBag.fromFactory(createService, { acquisition: 'raw' });

DiBag.fromFactory(
  (deps: { config: Config }, { signal }) => connect(deps.config, signal),
  { context: 'acquisition', acquisition: 'native' },
);
```

These examples retain the current acquisition option spelling. The naming
review separately suggests making that spelling more explicit.

An explicit context option lets TypeScript select the callback signature and
keeps context allocation opt-in. Preserve the acquisition owner's signal,
including root and shared-owner routing, child shutdown, and independent
forks. Do not infer contextual invocation from a function's `.length`:
defaults, rest parameters, and wrappers can make that misleading.

This is a reasonable consolidation, but less immediate than the first three:
the two current APIs have different callback signatures, acquisition defaults,
and reflection contracts. A probe confirmed that the current `factory`
signature rejects the required second argument that `withContext` accepts.
Choose whether the merged acquisition option stays required explicitly before
implementation; the examples above deliberately provide it in both cases.

Sources: [factory](../../src/provider.ts#L316),
[contextual factory](../../src/acquisition-context.ts#L14).

**5. Optional: one immutable facade configuration method.**

`configure` and `observe` both return another facade with additional runtime
configuration. They could become:

```ts
const AppDI = DiBag.withConfiguration({
  runtime: { isNativePromise },
  observers: [{ onEvent, onError }],
});
```

Either field may be provided independently. Preserve an inherited classifier
when `runtime` is omitted, and append observers in declaration order. Return
a new facade and retain the current snapshot behavior. This combination is
coherent, but it saves only one method and puts options around otherwise
readable `withObserver` calls, so it is lower priority.

Sources: [facade construction](../../src/di-bag.ts#L436),
[runtime configuration](../../src/acquisition-mode.ts#L16),
[observer append](../../src/observers.ts#L66).

**Other surfaces: keep the meaningful distinctions.**

| APIs considered | Recommendation and reason |
| --- | --- |
| `fromFunction`, `fromClass`, `fromPlugin` | Keep separate. Calling a function, constructing a class, and validating an unknown plugin descriptor have distinct runtime and type contracts. |
| `factory`/`fromFactory` and `fromFunction` | Keep separate after the contextual consolidation above. A named dependency object and positional token injection are different dependency declaration forms. |
| `withDisposal`, `withLifetime`, `withMetadata`, service transformation | Keep composable operations. Disposal can attach to different transformation stages; lifetime selects caching; metadata describes values. A single provider-options object would need to encode their ordering to preserve existing ownership. |
| `optional`, `lazy`, `all` | Keep clear tuple helpers. They yield a possibly absent value, a lookup function, or a collection. Independent boolean options would introduce combinations the current API does not support. |
| `token` and its `of` method | Keep. The two-step construction retains an inferred unique-symbol key while the caller explicitly specifies the service type. Collapsing it needs equivalent partial generic inference. |
| `begin`, `module` | Keep separate creation methods, using the proposed `createBuilder` and `createModuleBuilder` names. Their resulting objects have different capabilities. |
| `end`, `start` | Keep separate as `build` and `buildAndStart`. Startup adds eager acquisition, cancellation, scheduling, and rollback. One overloaded `build({ start })` is possible but hides a substantial lifecycle transition behind an optional field. |
| `scope`, `fork` | Keep separate. A scope is tracked by its parent and may borrow acquisitions; a fork has independent ownership. A mode switch here affects shutdown responsibilities. |
| `resolve`, `resolveAll` | Keep separate. Single bindings and contributions are separate collections; `resolveAll(token)` does not include its ordinary binding. |
| `inspect`, `inspectAll` | Keep the corresponding single-binding/contribution pair, mirroring resolution. |
| `resolve`, `inspect` | Keep separate. Inspection intentionally avoids acquisition. |
| `replace`, `alias`, `contribute`, registration | Keep distinct operations with distinct collision and identity rules. An alias reuses a target; a contribution appends; replacement changes an existing binding. |
| `install`, module `exports`, module `rename` | Keep their different stages: install a sealed declaration, select public exports when sealing, and rename a public export. Prefer explicit verb/object names from the naming review. |
| `close` | Keep one idempotent async cleanup method. It already combines child shutdown, draining, and resource cleanup with the appropriate ownership semantics. |
| `di-bag`, `di-bag/node` | Keep the portable and host-configured entry points. Consolidating them would require all hosts to supply detection or introduce host-specific dependencies into the portable entry. |
| `DiBagCleanupError`, `DiBagStartupError`, `DiBagStartupCancelledError`, `DiBagPluginError` | Keep distinct recovery contracts. Cleanup aggregates failures; ordinary startup failure waits for rollback; cancellation exposes pending cleanup; plugin validation identifies its phase. Common error codes are useful without collapsing the classes. |
| Exported provider, module, token, and graph helper types | Keep types that represent distinct inputs/results. Shared internal implementations are possible, but removing a public helper must preserve consumer declaration emit and useful diagnostics. Consolidate obsolete method-signature aliases only after the corresponding methods are consolidated. |

**Verification.** Inspected every current public method on the facade, bag,
application builder, module builder, and sealed module, including `token().of`.
Revisited exported type/error families and both package entries. Ran 120
existing tests across seven files: all passed, with 551 assertions. Seven
compiler probes confirmed adapter argument rules and the context-signature
distinction; one runtime probe confirmed acquisition of ignored dependencies.
The proposed merged signatures have not been implemented or compiled. Before
adoption, they require both compiler contract suites, consumer declaration
checks, diagnostic-marker updates, and the applicable inference/scale checks.
