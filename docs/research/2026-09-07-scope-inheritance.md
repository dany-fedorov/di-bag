# Scope inheritance, first-child construction, and borrowing

**Date / retrieval date:** 2026-09-07

**Status:** Research only. The recommendation below is **unadopted** and does
not amend the binding lifecycle design.

## Question and fixed local target

This note answers only two open questions for the approved lifecycle program:

1. Should a child be allowed to override a slot whose effective inherited
   registration is `root`, or should that override be rejected?
2. Should a child's explicit `share` tuple admit `root` or `transient` slots in
   addition to ordinary `scoped` slots?

The fixed target is the lifecycle design at commit
`0b1aba76f456599dc68318f47fe0375cd9e802b8`: an independent `fork()` is a
fresh root; a tracked child shares root acquisitions; even a first request from
a child constructs a root service through root bindings; sharing an ordinary
scoped service is explicit, borrows the parent's acquisition with its original
dependency bindings, and does not transfer ownership. Ownership is independent
of caching. Nothing here proposes decorators or runtime parameter metadata.
The existing [lifetime-contract investigation](../reports/2026-09-06-lifetime-contract-investigation.md)
already identifies root-slot override policy as open.

Sources below are first-party documentation and upstream source. Awilix source
is pinned to v13.0.5. Inversify documentation identifies itself as 8.x (the
site banner reports 8.2). Effect source is pinned to `effect@4.0.0-rc.112`; its
relevant child-memo-map API is pre-release. No upstream packages were installed
and no framework runtime tests or benchmarks were executed.

## Executive finding

The three systems demonstrate three different choices rather than one common
industry rule:

| System | Inherited singleton/layer first requested below the parent | Override effect | Borrow / cleanup model |
|---|---|---|---|
| Awilix 13.0.5, strict | Singleton cache is in the root and a miss is constructed with the root container. | A child dependency override cannot enter that singleton. A local non-singleton registration can still shadow the parent's singleton slot; a child-local singleton registration is rejected. | Scoped caches belong to the resolving container; transients are uncached. Disposal visits only the disposed container's cached entries. |
| InversifyJS 8.x | A parent singleton first resolved through a child is cached on the parent binding. | The documented result captures the child's overridden dependency and is later returned even from the parent. | Only singleton bindings have deactivation. Request/transient results have no general scope-ownership cleanup contract. |
| Effect 4 RC `Layer` | A child `MemoMap` reuses a parent entry only if already present; a miss is memoized locally in the child map. | A first child miss is therefore an isolated child allocation, not a root allocation. A reused layer retains the already-built graph. | Reuse is a reference-counted lease: each observing scope registers a finalizer; the layer's private scope closes when the observer count reaches zero. |

Awilix strict mode is the closest precedent for di-bag's binding root-
construction rule. Inversify is a direct warning about allowing the first
requesting child to parameterize a shared singleton. Effect provides strong
evidence for explicit identity-based sharing and retained construction context,
but its first-miss and reference-counted ownership choices intentionally differ
from the fixed di-bag target.

## Primary-source findings

### Awilix 13.0.5

**Verified behavior.** Registration lookup checks the current container before
recursing to the parent, so any local registration shadows the inherited one.
Singleton values are looked up and stored in the root cache. Crucially, on a
singleton cache miss strict mode calls the resolver with `rootContainer`, while
non-strict mode calls it with the requesting `container`; see the pinned
[`getRegistration` and resolution implementation](https://github.com/jeffijoe/awilix/blob/v13.0.5/src/container.ts#L470-L600).
Thus strict mode gives the exact first-child property relevant here: a child
may trigger construction, but the singleton's dependencies resolve from the
root graph.

Strict mode also rejects registering a singleton on any non-root container, but
the check is on the new resolver's lifetime, not on the lifetime of a shadowed
ancestor registration; see the pinned
[`register` check](https://github.com/jeffijoe/awilix/blob/v13.0.5/src/container.ts#L436-L454).
Consequently a child cannot install another singleton, but it can install a
scoped or transient registration under the same key and thereby shadow the
parent singleton. This is coherent only because Awilix treats the chosen local
registration, rather than the key itself, as carrying lifetime policy.

Awilix gives each container its own scoped cache, resolves a transient without
caching, and disposes by iterating and clearing only `container.cache`; see the
pinned [resolution and disposal source](https://github.com/jeffijoe/awilix/blob/v13.0.5/src/container.ts#L546-L724).
The first-party README likewise says a disposed container does not dispose its
scopes and that only cached `SCOPED`/`SINGLETON` values can be disposed; see
[Disposing](https://github.com/jeffijoe/awilix/tree/v13.0.5?tab=readme-ov-file#disposing).

**Ownership inference.** Awilix has no finite child `share` selection. If
application code explicitly resolves a scoped value from the parent and hands
that value to a child, the only cache entry and disposer remain in the parent;
disposing the child cannot find it. If it resolves a parent transient, there is
no cache entry and therefore no Awilix-managed disposal at all. Registering the
same object again under a disposable child resolver would create a second,
application-authored cleanup obligation rather than a borrow primitive. These
statements follow from the cited cache/dispose code; they are not claims about a
documented `share` API.

### InversifyJS 8.x

**Verified behavior.** Hierarchical lookup uses the first container with a
binding; any child binding for a service identifier hides parent bindings under
standard resolution. More importantly, the official hierarchy guide documents
the exact first-child singleton case: the parent binds `Samurai` as singleton,
the child overrides `Katana`, and `child.get(Samurai)` caches a `Samurai`
containing the child's `LegendaryKatana`; a later `parent.get(Samurai)` returns
that same captured graph. See [DI hierarchy and cached bindings](https://inversify.io/docs/fundamentals/di-hierarchy/#di-hierarchies-and-cached-bindings).
This behavior is incompatible with di-bag's fixed root-context rule even though
the singleton identity is shared.

Inversify distinguishes singleton, transient, and request scope. Request scope
means reuse within one `container.get` resolution request, not reuse by a child
container; transient produces a new value per resolution. See the official
[binding scope documentation](https://inversify.io/docs/fundamentals/binding/#scope).
Deactivation is dispatched for singleton-scoped services, and binding-level
deactivation handlers are rejected for non-singletons; see
[Deactivation](https://inversify.io/docs/fundamentals/lifecycle/deactivation/)
and [`onDeactivation`](https://inversify.io/docs/api/binding-syntax/#ondeactivation).
The container API says `unbindAll` removes bindings only "in this container" and
triggers deactivation; see [`unbindAll`](https://inversify.io/docs/api/container/#unbindall).

**Ownership inference.** Resolving an inherited parent singleton through a
child borrows the value cached on the parent binding; removing child-local
bindings is not removal of that parent binding, so cleanup remains associated
with the parent binding's unbind/unload operation. There is no corresponding
container-owned acquisition record for request/transient results because those
scopes cannot carry deactivation handlers. Calling `parent.get` explicitly and
passing such a value into a child therefore provides identity sharing but no
general Inversify ownership transfer or child-close cleanup. Inversify's
[`toConstantValue`](https://inversify.io/docs/api/binding-syntax/#toconstantvalue)
or `toService` can author aliases, but neither is documented as a cross-
container borrow with retained original ownership.

### Effect 4.0.0 RC Layer / MemoMap / Scope

Effect does not expose hierarchical slot containers or `root`, `scoped`, and
`transient` registration flags, so this is an analogy, not API equivalence. A
`Layer` describes a service graph and is memoized by the identity of the Layer
object within a `MemoMap`.

**Verified behavior.** The current RC adds `forkMemoMap`: the child map may
reuse layers already memoized in its parent, while new layer allocations remain
in the child. The implementation checks the local map, recursively checks the
parent, and on a total miss calls `memoMapBuild(this, ...)`, storing the new
entry in the child map. See the pinned
[`MemoMapImpl` and `forkMemoMap`](https://github.com/Effect-TS/effect/blob/effect@4.0.0-rc.112/packages/effect/src/Layer.ts#L175-L543).
Thus its closest "first request through a child" behavior is deliberately
different from di-bag root lifetime: an already-built parent layer is shared,
but a first miss belongs to the child memo map. Because a Layer build consumes
its typed input Context, it follows that a child-local first build can use the
inputs supplied to that build; this last dependency-override sentence is an
inference from the build signature and memo-map placement, not a separately
executed test.

Layer reuse also differs in ownership. Reuse increments an observer count and
adds the entry finalizer to the observing `Scope`; each finalizer decrements the
count, and the layer's private scope is closed only when the count reaches zero.
See the pinned [reuse and finalizer implementation](https://github.com/Effect-TS/effect/blob/effect@4.0.0-rc.112/packages/effect/src/Layer.ts#L232-L405).
This is a reference-counted lease shared by all observing scopes, not di-bag's
single parent owner plus non-owning child borrower.

**Transient analogy and uncertainty.** Re-executing an ordinary Effect is the
closest transient analogue; there is no canonical service-name acquisition for
a child to select and share. Scoped acquisition is governed by the explicit
`Scope` supplied to the resource/layer build. A raw service value can be placed
in another Context, but doing so is value propagation, not a Layer-level
ownership transfer. The cited Effect behavior is current only for
`4.0.0-rc.112`; `forkMemoMap` is marked `@since 4.0.0`, so it should not be
treated as a settled v3 compatibility promise.

## Decision analysis for di-bag

### 1. Inherited root-slot overrides

**Unadopted recommendation: reject them before acquisition or other side
effects.** If the effective ancestor registration for key `K` is `root`, a
tracked child must not override `K` with any lifetime. An independent `fork()`
remains free to replace `K` because it is a new root.

This is the smallest policy consistent with the already-binding statement that
root providers are shared and constructed through root bindings even when a
child requests them first. It gives one stable meaning to `child.K`: the shared
root acquisition. It also prevents a child's apparent slot type or dependency
graph from promising a value that root consumers do not see. Awilix strict
supports the root-construction half of this policy; Inversify demonstrates the
capture bug avoided by it.

A coherent child-shadowing alternative is possible, as Awilix shows, but it is
not merely "allow override." It must define a separate child acquisition,
owner, lifetime, descendant inheritance rule, conflict rule with `share`, and
type-level meaning for a key whose root and child identities differ. It would
also make "root slot" mean "root only unless shadowed," weakening the simple
shared-root contract. If demanded later, it should be a visibly separate
operation such as explicit root shadowing, not an accidental consequence of
ordinary override syntax.

This recommendation does **not** reject a child override merely because some
unrelated root service depends on the same key. Root construction already uses
the root graph, so an allowed child override of a non-root slot may serve the
child's own consumers without retargeting a shared root acquisition.

### 2. `share` selections for root and transient slots

**Unadopted recommendation: admit only effective parent `scoped` slots. Reject
selected `root` and `transient` keys during child-scope validation, before
acquisition.** Keep the existing share/override conflict rejection.

For an admitted scoped key, resolution through the child should be resolution
in the parent scope: if the parent has not acquired it yet, the first child
request creates the parent's scoped acquisition through the parent's bindings.
The child borrows that acquisition and its dependency edges. Its ownership and
disposer remain with the parent; the child never copies a finalizer. This is
already the fixed target, made explicit for the first-miss case.

- A `root` selection is redundant because every tracked child already uses the
  root acquisition through the root graph. Accepting it as a silent no-op makes
  configuration errors harder to detect and suggests that omitting it might
  stop root sharing. Rejecting it adds no runtime mechanism.
- A `transient` key has no unique acquisition denoted by the key. Selecting it
  would either eagerly choose one arbitrary parent acquisition, promote the
  transient to a scoped cache, or require an acquisition handle. All three are
  new semantics; the first two contradict "transient means no binding cache."
  If explicit borrowing of one transient acquisition is later required, use a
  separate acquisition-handle/alias facility rather than overloading `share`.

This restriction preserves the design's separation of identity, caching, and
ownership. It also needs no decorator or consumer annotation: lifetime metadata
on registrations and the finite selected key tuple are sufficient.

## Remaining uncertainty and acceptance consequences

- The comparison is source/documentation analysis only. No upstream runtime
  claims beyond those sources were independently executed.
- Effect's child memo-map evidence is from a release candidate and may change;
  it is useful design evidence, not a stability commitment.
- If the recommendation is adopted, acceptance coverage should include: root
  override rejection before factories run; independent-fork replacement;
  rejection of `share` selections for effective root/transient slots; a
  parent-scoped first miss triggered by a sharing child; retained parent
  dependencies despite child overrides; and disposal only by the parent owner.
  Those are proposed consequences, not tests performed by this report.
