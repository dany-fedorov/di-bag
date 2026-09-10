# Research: prior art for `val-box` presence and metadata channels

> Historical research from 2026-09-09, published on 2026-09-10. DI Bag has since removed the box adapters in favor of native provider metadata. API descriptions and source assessments below refer to the original research snapshot; see the [current API guide](../guides/api-reference.md) for supported behavior.

**Date:** 2026-09-09

**Status:** Research only; no API change is approved.

**Question:** Is `val-box` (a mutable box with independent value and metadata
channels, each with its own presence flag, nine static presence classes,
`convert({ hasValue, hasMetadata })`, an `alias`, and a frozen `snapshot()`
returning `Presence<T> = { present: false } | { present: true; value: T }`)
justified by established patterns, or over-engineered relative to them?

## Scope and method

Every row below was checked against a primary source fetched during this
session: specifications, official docs, upstream source, commits, or issues.
Secondary write-ups were not used. Where a lead's URL failed, the GitHub
source or the docs repository was read instead and the substitute URL is
cited. `di-bag` consumes `val-box` through `fromValBox(factory, { value:
'required' | 'presence' })`, unboxing the value as the service and recording
the metadata channel into a per-acquisition frame `{ kind: 'val-box',
metadata: Presence<M>, alias }`
([`src/val-box.ts`](https://github.com/dany-fedorov/di-bag/blob/68dcfa288ad9014e4866ff938fae7f6976d77dd4/src/val-box.ts)). Local facts checked:
`val-box` 0.1.0 exports exactly nine `ValBox*` classes and freezes each
`Presence` and the snapshot object
([`.related-repos/val-box/src/index.ts`](https://github.com/dany-fedorov/val-box/blob/7cec56e2716165d7f161cb91db65b5ab6761486c/src/index.ts),
[`snapshot.ts`](https://github.com/dany-fedorov/val-box/blob/7cec56e2716165d7f161cb91db65b5ab6761486c/src/snapshot.ts)).

Feature keys used in the tables: **P** independent presence flag,
**U** present-`undefined`, **M** metadata channel, **A** alias for
diagnostics, **S** frozen snapshot, **9** static presence variants.

## Verified precedents

| Pattern | Source | What it establishes | Maps to |
|---|---|---|---|
| TypeScript `exactOptionalPropertyTypes` | [TS 4.4 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-4.html) | "reading a *missing* property on an object produces the value `undefined`. It's also possible to *have* an actual property with the value `undefined`." With the flag, `age: undefined` is "Error! undefined isn't a number". | P, U, 9 (type-level only) |
| `in` operator | [MDN `in`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/in) | "A property may be present in an object but have value `undefined`. Therefore, `"x" in obj` is not the same as `obj.x !== undefined`." Example: `myCar.make = undefined; "make" in myCar; // returns true`. | P, U |
| `Object.hasOwn` | [MDN `Object.hasOwn`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwn) | Returns `true` "even if the property value is `null` or `undefined`"; example `example.prop = undefined; Object.hasOwn(example, "prop"); // true`. | P, U |
| `Map.prototype.has` | [MDN `Map.has`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/has) | Returns "whether an entry with the specified key exists"; keyed on entry existence, not value. No `undefined` example on the page. | P |
| JSON Merge Patch | [RFC 7396](https://www.rfc-editor.org/rfc/rfc7396.txt) | Abstract: "Null values in the merge patch are given special meaning to indicate the removal of existing values in the target." Algorithm: `if Value is null: if Name exists in Target: remove the Name/Value pair from Target`; unmentioned members are untouched by omission from the loop. | P |
| Protobuf field presence | [protobuf.dev field presence](https://protobuf.dev/programming-guides/field_presence/) | "*Field presence* is the notion of whether a protobuf field has a value." Explicit presence "stores whether or not a field has been set"; implicit presence stores "field values (only)" so "the default value is synonymous with 'not present'". proto3 `optional` (explicit presence) is on by default since v3.15.0. | P, 9 (per-field static label) |
| `JsonNullable<T>` | [jackson-databind-nullable README](https://github.com/OpenAPITools/jackson-databind-nullable) | Wrapper "for which it is important to distinguish between an explicit `"null"` and the field not being present"; `JsonNullable.undefined()` → `{}`, `JsonNullable.of(null)` → `{"name":null}`, `JsonNullable.of("Rex")` → `{"name":"Rex"}`. Motivation: JSON Merge Patch. | P, U (as null) |
| serde double `Option` | [serde-rs/serde#984](https://github.com/serde-rs/serde/issues/984); [`serde_with::rust::double_option`](https://docs.rs/serde_with/latest/serde_with/rust/double_option/index.html) | Issue "Treat null and missing field as being different" (2017-07-10) asks for `Option<Option<i32>>` "where Some(None) means a null value, and None means it didn't exist at all"; dtolnay's reply gives a `deserialize_some` helper. `serde_with` documents `None` = missing, `Some(None)` = null, `Some(Some(v))` = value. | P, 9 (nested type, no classes) |
| Prisma null vs undefined | [Prisma docs](https://www.prisma.io/docs/orm/v7/prisma-client/special-fields-and-types/null-and-undefined) | "`null` is a **value**", "`undefined` means **do nothing**"; "if `undefined` is passed as a value, it is not included in the generated query. This behavior can lead to unexpected results and data loss." Recommends `exactOptionalPropertyTypes`. | P, U |
| GraphQL input coercion | [graphql-spec §3 source](https://raw.githubusercontent.com/graphql/graphql-spec/main/spec/Section%203%20--%20Type%20System.md) | "there is a semantic difference between the explicitly provided value {null} versus having not provided a value." `{ b: 123 }` vs `{ a: null, b: 123 }` coerce to different maps. | P |
| Angular `isValueProvider` | [`provider_collection.ts`](https://raw.githubusercontent.com/angular/angular/main/packages/core/src/di/provider_collection.ts) L404-410 | `USE_VALUE = getClosureSafeProperty<ValueProvider>({provide: String, useValue: getClosureSafeProperty})`; `isValueProvider` returns `value !== null && typeof value == 'object' && USE_VALUE in value`. Contrast: `isFactoryProvider` / `isExistingProvider` use truthiness (`!!(value && value.useFactory)`). | P, U |
| Angular `useValue: undefined` fix | [PR #27035](https://github.com/angular/angular/pull/27035), [commit 6552471](https://github.com/angular/angular/commit/6552471c493cc69aa19012ddc03da9bee6fb5deb) | "Resolving a token from a module injector that is provided as `useValue: undefined` will crash." Root cause in diff: `makeRecord(factory, value: T | {} = NOT_YET)` — a default parameter turned the present `undefined` into the "not yet created" sentinel. Adds test "injects a useValue token with value undefined". | U |
| Angular View Engine vs Ivy | [commit 15fefdb](https://github.com/angular/angular/commit/15fefdbb8d750c59dbddb0f69f1cd1edee1742c3) | "`{provide: X} -> {provide: X, useValue: undefined}` // this is how it works in View Engine; `{provide: X} -> {provide: X, useClass: X}` // this is how it works in Ivy". Absent `useValue` and present `useValue: undefined` diverged across engines; a migration was written. | P, U |
| NestJS `isCustomValue` | [`module.ts`](https://raw.githubusercontent.com/nestjs/nest/master/packages/core/injector/module.ts) L329-333; [commit 4cddcfb](https://github.com/nestjs/nest/commit/4cddcfb492ed55c6d90b6af25258d89e3075cfc6) | "fix(core): false-negative value provider not registered error when the value of the provider is `undefined`" (2023-03-03) replaced `!isUndefined(provider.useValue)` with `isObject(provider) && Object.prototype.hasOwnProperty.call(provider, 'useValue')`. | P, U |
| NestJS user reports | [nestjs/nest#2732](https://github.com/nestjs/nest/issues/2732), [#4743](https://github.com/nestjs/nest/issues/4743) | #2732 (2019): "When 'useValue' is undefined, you will get an error 'Nest can't resolve dependencies…'". #4743 (2020): a provider whose value is `undefined` cannot be overridden by `overrideProvider()`; workaround "use `null` instead of `undefined`". | U |
| Angular not-found sentinels | [`injector_compatibility.ts`](https://raw.githubusercontent.com/angular/angular/main/packages/core/src/di/injector_compatibility.ts), [`primitives/di/src/not_found.ts`](https://raw.githubusercontent.com/angular/angular/main/packages/core/primitives/di/src/not_found.ts), [`Injector` API](https://angular.dev/api/core/Injector) | `THROW_IF_NOT_FOUND = {}` passed as `notFoundValue` when not `Optional`; `NOT_FOUND: unique symbol = Symbol('NotFound')` with `isNotFound()`. `get()` returns "the instance from the injector if defined, otherwise the `notFoundValue`". | P (sentinel alternative) |
| Vue `inject` | [Vue API](https://vuejs.org/api/composition-api-dependency-injection.html) | `inject<T>(key): T \| undefined`; "If no value with matching key was found, `inject()` returns `undefined` unless a default value is provided." | Counter-evidence for U |
| Effect / fp-ts `Option` | [Effect Option](https://effect.website/docs/data-types/option/), [fp-ts Option](https://gcanti.github.io/fp-ts/modules/Option.ts.html) | `Some<A> \| None`; `fromNullable` maps both `null` and `undefined` to `None`. No metadata slot on either page. | P; counter for M |
| Java `Optional` | [Java 21 `Optional`](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Optional.html) | "A container object which may or may not contain a non-`null` value"; `of(null)` throws NPE; "primarily intended for use as a method return type". | P; counter for U |
| Spring Boot `OriginTrackedValue` / `Origin` | [`OriginTrackedValue`](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/origin/OriginTrackedValue.html), [`Origin`](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/origin/Origin.html), [actuator `env`](https://docs.spring.io/spring-boot/api/rest/actuator/env.html) | "A wrapper for an `Object` value and `Origin`"; `getOrigin()`: "Return the source origin or `null` if the origin is not known." `Origin`: "an item loaded from a `File` may have an origin made up of the file name along with line/column numbers." Actuator exposes `origin` per property, e.g. `"origin" : "class path resource [...application.properties] - 1:29"`. | M (independently optional), A |
| .NET configuration debug view | [`GetDebugView`](https://learn.microsoft.com/en-us/dotnet/api/microsoft.extensions.configuration.configurationrootextensions.getdebugview), [`IConfigurationRoot.Providers`](https://learn.microsoft.com/en-us/dotnet/api/microsoft.extensions.configuration.iconfigurationroot.providers) | "Generates a human-readable view of the configuration showing where each value came from." `Providers` "Gets the `IConfigurationProvider` providers for this configuration." | M, A, S (read-only view for tooling) |
| node-config sources | [node-config wiki](https://github.com/node-config/node-config/wiki/Examining-Configuration-Sources) | `config.util.getConfigSources()` "can be used to see all sources contributing to the ultimate configuration, and the order in which they were applied"; entries carry `name`, `original`, `parsed`. Provenance is per source, not per key. | A (weak M) |
| PEP 593 `Annotated` | [PEP 593](https://peps.python.org/pep-0593/) | "A type T can be annotated with metadata x via the typehint Annotated[T, x]"; tools without "special logic for metadata x … should ignore it and simply treat the type as T"; `get_type_hints(include_extras=True)` reads it back. | M (ignorable by consumers) |
| W3C Baggage properties | [W3C Baggage](https://www.w3.org/TR/baggage/) | `list-member = key OWS "=" OWS value *( OWS ";" OWS property )`; "Additional metadata MAY be appended to values"; "Property keys and values are given no specific meaning by this specification." | M (optional, per value) |
| JSON:API `meta` | [JSON:API format](https://jsonapi.org/format/) | "a `meta` member can be used to include non-standard meta-information. The value of each `meta` member MUST be an object"; sits beside `data` at top level and on resource objects. | M |
| GraphQL `extensions` | [graphql-spec §7 source](https://raw.githubusercontent.com/graphql/graphql-spec/main/spec/Section%207%20--%20Response.md) | `extensions` "is reserved for implementers to extend the protocol however they see fit"; only `data`, `errors`, `extensions` allowed at top level. | M (response-level, not per value) |
| NestJS `Reflector` / `SetMetadata` | [NestJS execution context](https://docs.nestjs.com/fundamentals/execution-context) | Custom metadata attached to handlers via `Reflector.createDecorator` or `SetMetadata`, read with `reflector.get(Roles, context.getHandler())`. Metadata is per target, read at runtime by guards. | M (per registration, not per acquisition) |
| Inversify named/tagged | [Inversify binding syntax](https://inversify.io/docs/api/binding-syntax/) | `whenNamed`: "Constrains the binding to be used if and only if … a named service is requested with the given name." Metadata selects a binding; it is not a diagnostics channel. | Counter for M |
| Awilix `registrations` | [Awilix README](https://raw.githubusercontent.com/jeffijoe/awilix/master/README.md) | `container.registrations`: "A read-only getter that returns the internal registrations… Not really useful for public use." `container.cache`: "Not meant for public use". | Counter for M/S |
| OpenTelemetry Resource | [OTel Resource SDK](https://opentelemetry.io/docs/specs/otel/resource/sdk/) | "A Resource is an immutable representation of the observed entity … expressed as Attributes." Merge: "the value of the updating resource MUST be picked (even if the updated value is empty)". Empty is present; no separate metadata channel. | S, P (borderline) |

## Counter-evidence

- **Nullish conversion helpers collapse absence; `Option<T>` need not.**
  Java `Optional.of(null)` throws and the class holds only non-null values.
  Effect and fp-ts `fromNullable` fold both nullish values into `None`, but
  this is a conversion policy, not a limit of the TypeScript Option model.
  In particular, fp-ts exposes `some<A>(a: A): Option<A>`; choosing `A` as
  `undefined` preserves a present `undefined` separately from `None`.
  This corrects the original report's broader claim about Option.
  [fp-ts constructors and conversions](https://gcanti.github.io/fp-ts/modules/Option.ts.html#some).
- **DI containers use sentinels or `T | undefined`, not presence records.**
  Angular resolves "not found" with `THROW_IF_NOT_FOUND` / `NOT_FOUND` symbols
  and a `notFoundValue` parameter; Vue `inject` returns `undefined` when the
  key is missing. Neither exposes a `{ present }` record to callers. The
  presence concern is confined to the provider-classification line
  (`USE_VALUE in value`, `hasOwnProperty('useValue')`), not to the resolution
  API.
- **No DI container found carries a per-value metadata channel from the
  provider to the consumer.** Nest metadata hangs off handlers/classes via
  `Reflector`; Inversify names/tags are resolution constraints; Awilix labels
  its registration/cache internals as not for public use. Per-acquisition
  provenance frames have their precedent in configuration tooling (Spring
  `Origin`, .NET `GetDebugView`, node-config sources), not in DI.
- **The nine-class matrix has no located precedent.** Every verified precedent
  encodes presence with one primitive: a type modifier (`?:` under
  `exactOptionalPropertyTypes`), a field label (`optional`), a nested type
  (`Option<Option<T>>`), or one runtime wrapper with a boolean/state
  (`JsonNullable`, `OriginTrackedValue` with nullable origin, `Presence<T>`).
  "Unknown presence" appears only as the default, un-narrowed state of those
  primitives, never as a distinct class. Two independent tri-state channels
  realized as 3 × 3 classes exceeds anything found.
- **Metadata is usually attached per source or per registration, not per
  value.** node-config records provenance per loaded file; Nest per handler;
  JSON:API and GraphQL per document/response. Only Spring `OriginTrackedValue`
  and W3C Baggage attach it per individual value, and both use a single
  optional slot rather than a second presence-tracked channel.

## Leads that did not check out

- **Angular motivating issue for `USE_VALUE in value`:** not located. PR #27035
  fixed a different mechanism (default parameter) and links no issue; a
  `gh search issues --repo angular/angular 'useValue undefined'` returned only
  unrelated hits (#42451, #35673 is a `ViewChild` bug). The commit that
  introduced the `in` check itself was not traced.
- **RxJS `EMPTY`:** [`empty.ts` (7.x)](https://raw.githubusercontent.com/ReactiveX/rxjs/7.x/src/internal/observable/empty.ts)
  documents "A simple Observable that emits no items to the Observer and
  immediately emits a complete notification." It is an empty stream, not a
  presence sentinel; rejected as a precedent.
- **convict:** [README](https://raw.githubusercontent.com/mozilla/node-convict/master/packages/convict/README.md)
  documents source precedence (default, file, env, args) but no API returning
  which source supplied a key. Per-key provenance claim rejected.
- **`Map.prototype.has` with an `undefined` value:** MDN states existence
  semantics but shows no `undefined` example; the explicit statements are on
  the `in` and `Object.hasOwn` pages instead.
- **Spring `OriginTrackedValue` equals/hashCode ignoring origin:** not on the
  Javadoc page fetched; not claimed.
- **Original lead URLs:** the Prisma `special-cases/null-and-undefined` path
  returns 404 (current page cited above); `spec.graphql.org` returned 403, so
  the spec's GitHub source was used.
- **Inversify named/tagged as inspectable metadata:** verified as resolution
  constraints only; the "exposed for inspection" framing did not hold.
- **OpenTelemetry Resource:** attributes-only model; only the immutability and
  "empty is present" merge rule are relevant. No value+metadata semantics.

## Conclusions

1. **The value channel's independent presence flag is well precedented.**
   TypeScript 4.4, `in`/`Object.hasOwn`, RFC 7396, protobuf explicit presence,
   `JsonNullable`, serde `Option<Option<T>>`, Prisma, and the GraphQL spec all
   distinguish "absent" from "present with an empty value". `Presence<T>` in
   `snapshot()` is the discriminated-union form of what `in` gives on objects.
2. **Present-`undefined` is a real, recurring DI bug, and `val-box` sidesteps
   it by construction.** Angular PR #27035 (default parameter swallowed
   `undefined`), the View Engine/Ivy divergence over `{provide: X}` vs
   `useValue: undefined`, NestJS commit 4cddcfb (`!isUndefined` →
   `hasOwnProperty`), and issues #2732/#4743 are the same bug class. This is
   the strongest argument for the `value: 'presence'` adapter mode.
3. **The mainstream alternative is lighter and adequate for most consumers.**
   `Option`, `T | undefined`, sentinels (`THROW_IF_NOT_FOUND`, `NOT_FOUND`), and
   `notFoundValue` defaults cover the resolution API in Angular, Vue, Effect,
   and Java. `val-box` earns its keep only where present-`undefined` must
   survive a boundary; elsewhere it is a formalization, not a necessity.
4. **An independently optional metadata channel has precedent in diagnostics
   tooling, not in DI.** Spring's `OriginTrackedValue.getOrigin()` returning
   `null` "if the origin is not known" is exactly a value with an independently
   absent metadata slot; .NET `GetDebugView` and node-config sources show the
   same "where did this come from" use case. The `di-bag` frame
   `{ kind, metadata, alias }` mirrors the actuator `{ origin, value }` shape.
5. **Alias as a free string is weaker than the precedents.** Spring `Origin`
   carries file plus line/column; .NET names the provider; node-config names
   the source. A structured origin would match precedent better than an
   arbitrary label, though a label is a defensible minimum.
6. **The nine-class static matrix is not precedented and is the over-engineered
   part.** No verified source models "unknown presence" as a distinct static
   variant per channel; all use one composable primitive. Static narrowing via
   `convert()` could likely be served by a two-variant type per channel with
   the runtime `Presence<T>` snapshot unchanged, without losing any verified
   guarantee.
7. **Frozen snapshots are consistent with precedent but not distinctive.**
   OTel Resources are immutable; .NET and Spring expose read-only diagnostic
   views; PEP 593 reads metadata back without altering the value. Keep it; do
   not cite it as a differentiator.
8. **Honest summary:** presence is well-precedented and the DI bug history
   justifies it; the metadata channel is precedented only by configuration
   provenance tooling; the 9-class matrix and free-string alias are the parts
   with no supporting prior art.
