# Typed contribution collections

This E1 increment follows checked aliases. Contributions compose an ordered set
of independently owned providers under one genuine token's service contract.
They support extension pipelines and registries assembled from several modules.

## Public composition and resolution

`Builder.contribute(token, registration)` and
`ModuleBuilder.contribute(token, registration)` append a checked contribution and
return a new immutable builder. Each provider output must satisfy the token's
service contract. Contributions to one collection must agree on that token's
nominal contract. Repeated contributions are permitted and keep their order.

`bag.resolveAll(token)` returns a frozen `ReadonlyArray<Service>`, including an
empty array when the collection has no contributions. `DiBag.all(token)` creates
an immutable authenticated dependency reference supplying the same readonly array
to `fromTokens`, `fromFunction` and `fromClass`. It wraps one genuine token and
cannot be nested with other reference wrappers. Its absence is valid, but every
present contribution must retain the matching collection contract.

Contributions and singular bindings have separate lookup channels: `.contribute`
does not satisfy `.resolve(token)`, and `.bind` does not add an item to
`.resolveAll(token)`. An ordinary provider using `DiBag.all(token)` can expose the
collection as a service, share it through existing scope selections, or adapt its
items into another value. The collection operation itself adds no aggregate owner.

An open module's `.contribute` call explicitly contributes to the host collection
when the module is installed. `.exports` continues selecting ordinary named/token
bindings; it does not discard those explicit contributions. Thus a module may
export no ordinary services while contributing providers that use its private
helpers. `ModuleContributions<M>` exposes the module's collection service contracts
separately from `ModuleProvides<M>`. Renaming an ordinary export preserves every
contribution's lexical dependencies and leaves collection token identity intact.
For each contributed token key its property type is `ReadonlyArray<Service>`;
a module with no contributions has `Readonly<{}>` as that view.

Collection order follows builder operations and module installation order. Each
installed module appends its contributions in their declaration order. Installing
the same module twice creates two distinct sets of private contribution bindings,
subject to the existing ordinary-export collision rules. Registering the same
provider handle twice likewise creates two contribution bindings; no deduplication
by service object identity or callback identity is implied.

## Acquisitions and lifetimes

Every contribution uses the existing provider acquisition machinery and its own
binding identity. Root/scoped/transient caching, owner context, raw/native modes,
explicit cleanup and observed dependency edges apply individually. Resolving a
collection returns a fresh frozen array of the canonical exposed values; it does
not cache, await or wrap those values. Repeated collection reads reuse root/scoped
attempts and create fresh transient attempts. Array immutability does not freeze
the application-owned service values.

`DiBag.all` records the consuming attempt's edges to the acquired contributions.
If acquisition fails partway through, the original failure propagates. Previously
accepted contributions remain owned by their scope and are cleaned through normal
shutdown; collection resolution does not invent transactional rollback. A startup
failure still uses the existing startup rollback policy. A contribution that reads
its own collection participates in ordinary cycle detection, without silently
excluding itself.

Module-private helpers resolve in each contribution's lexical graph. Child scopes
and independent forks retain the normal dependency override, context and ownership
rules. Shared ordinary collection-consuming providers retain the parent's entire
acquisition and graph. Strict root checks traverse every present contribution and
its dependencies; an empty collection has no captive edge. Runtime observed checks
remain before cache/owner routing, including reads during cooperative shutdown.

`bag.inspectAll(token)` returns an immutable ordered array of per-contribution
inspection snapshots without resolving services. Metadata/acquisition types must
remain conservative where a collection query only promises its service contract;
do not claim one contributor's metadata shape for every item.

## Static and runtime boundaries

The composition state retains contribution providers and their nominal collection
keys alongside ordinary registrations. These contracts must survive immutable
builder histories, module installation, replacements, selected overrides, scopes,
independent forks and physical declaration emission. An erased builder, bag or
module view cannot falsely prove an empty collection or a different service type.

Each contribution's dependency shape and nominal requirements are checked
individually; incompatible requirements cannot disappear in an intersection.
Missing ordinary dependencies still prevent completion. Optional/lazy/all
references and alias paths preserve their respective graph contracts. Private and
exportless module contributions retain external requirements and lifetime checks.
An all-reference imposes no missing-collection error but validates the contract of
every present contribution, including ones installed later.

Runtime registration and reference factories authenticate genuine tokens and
providers, snapshot state without consulting caller iterators, and reject invalid
inputs before provider effects. Runtime metadata must not expose mutable maps,
internal resolvers or controller objects. The common path without contributions
must preserve existing exact inferred contracts and compiler-work ceilings.

## Acceptance

Cover empty/single/multiple collections, deterministic host/module/repeated-install
order, output and nominal mismatches, missing contribution dependencies, private
helpers and renamed exports, exact Promise modes, mixed root/scoped/transient
identity, partial acquisition failure, retry, cycles and once-only cleanup.
Exercise lazy use through a normal registry service, child overrides, selected
sharing of an aggregate provider, independent forks, root-captive checks and late
dependency discovery during shutdown. Include forged/erased/reflected/generic
type boundaries, immutable arrays/inspection and all three positional adapters.

Actual classic/native archives must execute the assertions under Node/Bun in
CommonJS/ESM; inferred producer declarations must survive source deletion and
both downstream compilers. No compiler diagnostic allowance or scale ceiling is
relaxed. Observers/plugins, compiler hardening and release confidence remain
required work after the composition milestones.
