# Singleton by Default Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Planning review accepted:** see `handoff/resume-2026-09-21.md`. Implementation, semantic compiler checks, S8 selection and full phase verification remain pending under the existing hold.

**Goal:** Make one singleton instance per container tree the default lifetime, prevent child containers from replacing inherited singletons, and give existing applications a precise lifetime-pinning migration.

**Architecture:** Change the runtime and type-level canonical default together, preserving explicit scoped and transient policies and phase-7 renamed external obligations. Add a child-replacement admission over the inherited provider graph plus a runtime guard at selection time; independent containers continue accepting every replacement. Extend the type-aware codemod with a whole-program lifetime-pin transform that uses the accumulated 0.4.0 map and phase-6 emitted-name roles.

**Tech Stack:** TypeScript 6.0.x type system and compiler API, Bun 1.4.0, Node 24, TypeDoc/VitePress, DI Bag's immutable binding graph, and the phase-1 type-aware codemod.

**Spec:** `docs/superpowers/specs/2026-09-20-swift-api-style.md`, with worked examples in `docs/superpowers/specs/2026-09-20-swift-api-style-examples.md` and sequencing in `docs/superpowers/plans/2026-09-21-00-swift-api-style-master.md`.

## Global Constraints

- This is phase 10. Start from phases 0–9 merged on `next`; branch `phase-10-singleton-default`. Executors do not publish or revise the spec.
- Preserve phase 4 collection-token type/runtime admission and fresh frozen replacement reads; provider acquisition and disposal retain the original array.
- Preserve `GraphDescription.tokenKinds` through every description reconstruction and pass the actual public operation to token-kind checks.
- Preserve phase 7's `RenamedExternalObligation` in every lifetime-obligation branch; a lifetime rename/default change must not erase requirement renaming.
- Preserve the phase-6 compatibility order `CreateChildContainerOptions<ServiceRegistrations, SharedKeys, Constraints = never>`.
- Preserve all accumulated codemod map entries and API-card rows. Map owners are their original 0.4.0 declaration names. Custom transforms emit declaration-backed names through `api.nameOf(owner, oldName)` and generated option fields through method-entry `transformNames` plus `api.nameForRole(role)`.
- Compile-time designs in this plan are uncompiled planning signatures until the executor runs the serialized compiler lane. The executor must prove every positive and property-local negative case before adopting S8.
- All twelve evidence cases must remain at or below 110% of the phase-0 instantiation baseline; S8 also measures a 100-provider chain whose only scoped service is its final dependency. A measured budget breach takes the complete fallback; a correctness or diagnostic-location failure first receives the master's three serious repair attempts in Task 5.
- Closing/closed and singleton-capture message-family rewrites remain deferred to plan 12 Task 12. This phase changes the lifetime semantics and types while retaining the current capture message text and error code.
- New malformed-argument sites use final `DI_BAG_INVALID_ARGUMENT` details. The new child-singleton replacement failure uses `DI_BAG_SINGLETON_REPLACEMENT` with `{ operation, serviceKey }`; `DI_BAG_CONFLICTING_SERVICE_SELECTION` remains reserved for share-and-replace conflicts.
- `AGENTS.md` remains at or below 150 lines. Rewrite rule 3 in place.
- Use pinned Bun `/tmp/claude-1000/-home-df-wd-personal-di-bag/7818417c-3b3a-48db-9bef-85624eff953b/scratchpad/bun/bin/bun` (1.4.0) for runtime checks.
- Every compiler, declaration, evidence-worker, benchmark, native build, or compiler-backed test
  remains prohibited until the controller explicitly lifts the heavy hold for that exact command
  and grants its serialized slot. Memory availability or an idle slot is not authorization. Report
  completion and release the slot after each command; never overlap heavy commands.

**Binding execution order:** execute Task 3 first on the untouched phase-10 tree and commit the
green codemod. Execute only Task 4 Step 1 next and commit the mechanical scoped pins while scoped
is still the default. Then execute Tasks 1–2 and commit the runtime/type default on top of those
pins. Finish Task 4 Steps 2–7, then Tasks 5–7. This order gives the mechanical migration its own
master-required commit and keeps every committed tree green.

## State on entry

Phases 0–9 have landed. Confirm the entry tree before editing:

```bash
grep -n "export type Lifetime = 'singleton:one-per-container-tree' | 'scoped:one-per-container' | 'transient:one-per-resolve'" src/lifetime.ts
grep -n "withLifetime(lifetime" src/provider.ts
grep -n "allowsScopedDependencies" src/lifetime.ts src/provider.ts
grep -n "createChildContainer" src/di-bag.ts
grep -n "createIndependentContainer" src/di-bag.ts
grep -n "export type CreateChildContainerOptions" src/scope-types.ts
grep -n "RenamedExternalObligation" src/lifetime-types.ts
grep -n "transformNames" tools/codemod/rename-map.schema.json tools/codemod/lib/rename-map.mjs
grep -n "nameForRole" tools/codemod/lib/transform-file.mjs tools/codemod/lib/transforms/*.mjs
grep -n "const scopedLifetime" src/provider-operations.ts
git rev-parse HEAD > /tmp/di-bag-phase-10-entry-commit
```

Expected: the public lifetime values and selected phase-10 provider shape exist;
`allowsScopedDependencies` is accepted only for singleton lifetime; both container derivation
methods and the three-parameter-compatible child options type exist; requirement-renaming
obligations and phase-7 transform-role APIs exist; the runtime default constant is still scoped.
Every code block below shows the preferred provider-method shape. If
`docs/superpowers/plans/evidence/phase-09.md` records S2 fallback, replace each complete
`provider.withLifetime(lifetime, options?)` expression with the exact callable form
`DiBag.providerWithLifetime({ provider, lifetime, ...options })`; for example:

```ts
const scoped = DiBag.providerWithLifetime({
  provider: DiBag.createProvider(() => 1),
  lifetime: 'scoped:one-per-container',
});
const permissive = DiBag.providerWithLifetime({
  provider: DiBag.createProvider(({ request }: { request: Request }) => request),
  lifetime: 'singleton:one-per-container-tree',
  allowsScopedDependencies: true,
});
```

Use this exact option-bag form in source, fixtures, docs, and goldens; never emit a provider method
when the recorded phase-10 public surface is the facade fallback.

Before executing any task, also read the final `docs/superpowers/plans/evidence/phase-04.md`. A selected but budget-unverified S5 fallback is not adopted evidence. If it records `Decision: fallback`, collection reads use `resolveCollection` while named and single-service-token calls remain on `resolve`; Phase 4's four-entry ratchet result is unchanged.

No public identifier is renamed or removed in this phase, so the naming known-violations list should not shrink. The new `DI_BAG_SINGLETON_REPLACEMENT` code and `--pin-lifetimes` flag comply with the naming rules and must never be added to the violations file.

## File Structure

| Path | Change | Responsibility |
| --- | --- | --- |
| `src/provider-operations.ts` | modify | singleton runtime default |
| `src/lifetime.ts`, `src/lifetime-types.ts` | modify | absent-policy singleton meaning, scoped explicit policy, fast lifetime walk, retained renamed obligations |
| `src/scope-types.ts`, `src/di-bag.ts`, `src/scope-selection.ts`, `src/runtime.ts` | modify | child replacement type admission and runtime lifetime lookup/guard |
| `tests/singleton-default.test.ts` | create | focused runtime default, sharing, replacement, and silent-gap coverage |
| `tests/types/singleton-default.ts`, `tests/types/singleton-default-consumer.ts` | create | source and emitted-declaration positive contracts |
| `tests/types/negative/singleton-default.ts` | create | property-local capture and child replacement diagnostics for every overload path |
| `tests/types.test.ts` | modify | register new positive and declaration-consumer fixtures |
| `tools/codemod/cli.mjs`, `tools/codemod/lib/codemod.mjs` | modify | `--pin-lifetimes` policy and whole-program detection |
| `tools/codemod/lib/transforms/lifetime-pin.mjs`, `tools/codemod/lib/transforms/index.mjs` | create/modify | exact provider wrapping/chaining transform |
| `tools/codemod/rename-map.json`, `tools/codemod/rename-map.schema.json` | preserve | phase-7 roles remain only on actual custom transforms |
| `tools/codemod/test/fixtures/lifetime-pin/*`, `tools/codemod/test/*.test.mjs` | create/modify | exact golden, manual rows, CLI defaults, id/schema coverage |
| `tests/**`, `examples/scopes.ts` | modify mechanically | preserve scoped-dependent meanings or deliberately assert the new default |
| `docs/adr/0001-singleton-by-default.md` | create | durable decision, rules, gap, and rejected alternatives |
| `AGENTS.md`, `docs/agent/recipes.md`, `docs/agent/errors.md`, `docs/agent/api-card.md` | modify | agent-facing lifetime/default/replacement contract |
| `tools/docs/api-card-tasks.json`, `tools/docs/test/*.test.mjs`, `docs/reference/index/**` | modify/regenerate | preserve and pin changed lifetime summaries/signatures |
| `tests/compiler.ts`, `scripts/check-singleton-default-scale.ts` | modify/create | complete 100-provider measured-case source |
| `docs/superpowers/plans/evidence/phase-10.md` | create | twelve cumulative evidence rows, S8 row, commands, decision |

---

### Task 1: Expand singleton-default runtime and child replacement safety

**Files:**
- Modify: `src/provider-operations.ts`, `src/acquisition.ts`, `src/runtime.ts`, `src/scope-selection.ts`, `src/di-bag.ts`
- Create: `tests/singleton-default.test.ts`
- Modify: `docs/agent/errors.md`

**Interfaces:**
- Consumes: phase-10 `ProviderDescription.lifetime.kind: LifetimeKind`, phase-7 `createChildContainer` options and token-selection helpers, and phase-10's deferred diagnostic vocabulary.
- Produces: public default `singleton:one-per-container-tree`, internal `BagRuntime.lifetimeOf(key): LifetimeKind`, and `DI_BAG_SINGLETON_REPLACEMENT` with `{ operation: 'createChildContainer', serviceKey }`.

- [ ] **Step 1: Write the focused runtime contract**

If final Phase 4 evidence records the S5 fallback, substitute `child.resolveCollection(items)` for all three `child.resolve(items)` expressions in the printed collection replacement test. Do not change adjacent named-service reads.

Create `tests/singleton-default.test.ts` exactly as follows:

```ts
import { expect, test } from 'bun:test';
import { DiBag } from '../src';

test('an unmarked provider is shared by a container tree while an explicit scoped provider is per container', async () => {
  let singletonCalls = 0;
  let scopedCalls = 0;
  const root = DiBag.createBuilder().withServices({
    singleton: () => ({ call: ++singletonCalls }),
    scoped: DiBag.createProvider(() => ({ call: ++scopedCalls }))
      .withLifetime('scoped:one-per-container'),
  }).buildContainer();
  const child = root.createChildContainer();
  const sibling = root.createChildContainer();

  expect(child.resolve('singleton')).toBe(root.resolve('singleton'));
  expect(sibling.resolve('singleton')).toBe(root.resolve('singleton'));
  expect(child.resolve('scoped')).not.toBe(root.resolve('scoped'));
  expect(sibling.resolve('scoped')).not.toBe(child.resolve('scoped'));
  expect(singletonCalls).toBe(1);
  expect(scopedCalls).toBe(3);
  await root.close();
});

test('a child rejects an inherited singleton before reading replacement getters', async () => {
  let reads = 0;
  const root = DiBag.createBuilder().withServices({ value: () => 1 }).buildContainer();
  const replacementProviders = Object.defineProperty({}, 'value', {
    enumerable: true,
    get() { reads++; return () => 2; },
  }) as { value: () => number };

  let failure: unknown;
  try {
    (root.createChildContainer as (options: object) => unknown)({
      replacedServiceKeys: ['value'],
      replacementProviders,
    });
  } catch (error) { failure = error; }
  expect(failure).toBeInstanceOf(Error);
  expect((failure as { code: string }).code).toBe('DI_BAG_SINGLETON_REPLACEMENT');
  expect((failure as { details: object }).details).toEqual({ operation: 'createChildContainer', serviceKey: 'value' });
  expect((failure as Error).message).toContain("cannot replace singleton service 'value'; mark it 'scoped:one-per-container' or use createIndependentContainer");
  expect(reads).toBe(0);
  await root.close();
});

test('a child may replace scoped and transient services', async () => {
  const root = DiBag.createBuilder().withServices({
    scoped: DiBag.createProvider(() => 1).withLifetime('scoped:one-per-container'),
    transient: DiBag.createProvider(() => 2).withLifetime('transient:one-per-resolve'),
  }).buildContainer();
  const child = root.createChildContainer({
    replacedServiceKeys: ['scoped', 'transient'],
    replacementProviders: { scoped: () => 3, transient: () => 4 },
  });
  expect(child.resolve('scoped')).toBe(3);
  expect(child.resolve('transient')).toBe(4);
  await root.close();
});

test('an independent container may replace a singleton', async () => {
  const root = DiBag.createBuilder().withServices({ value: () => ({ source: 'root' }) }).buildContainer();
  const independent = root.createIndependentContainer({
    replacedServiceKeys: ['value'],
    replacementProviders: { value: () => ({ source: 'independent' }) },
  });
  expect(independent.resolve('value')).toEqual({ source: 'independent' });
  expect(independent.resolve('value')).not.toBe(root.resolve('value'));
  await independent.close();
  await root.close();
});

test('a singleton replacement is anchored to the child that introduces it', async () => {
  const root = DiBag.createBuilder().withServices({
    value: DiBag.createProvider(() => ({ source: 'root' })).withLifetime('scoped:one-per-container'),
  }).buildContainer();
  const child = root.createChildContainer({
    replacedServiceKeys: ['value'],
    replacementProviders: { value: () => ({ source: 'child' }) },
  });
  const grandchild = child.createChildContainer();
  expect(grandchild.resolve('value')).toBe(child.resolve('value'));
  expect(child.resolve('value')).not.toBe(root.resolve('value'));
  expect(() => (child.createChildContainer as (options: object) => unknown)({
    replacedServiceKeys: ['value'], replacementProviders: { value: () => ({ source: 'grandchild' }) },
  })).toThrow(/cannot replace singleton service 'value'/);
  await root.close();
});

test('an alias uses its target singleton lifetime for child replacement', async () => {
  const root = DiBag.createBuilder().withServices({ target: () => ({ value: 1 }) })
    .withServiceAlias({ aliasKey: 'alias', targetServiceKey: 'target' })
    .buildContainer();
  expect(() => (root.createChildContainer as (options: object) => unknown)({
    replacedServiceKeys: ['alias'], replacementProviders: { alias: () => ({ value: 2 }) },
  })).toThrow(/cannot replace singleton service 'alias'/);
  await root.close();
});

test('a collection token keeps its fresh replacement view and has no singular lifetime lookup', async () => {
  const items = DiBag.createToken(Symbol('items')).forCollectionOf<number>();
  const root = DiBag.createBuilder()
    .withCollectionContribution({ collectionToken: items, provider: () => 1 })
    .buildContainer();
  const child = root.createChildContainer({
    replacedServiceKeys: [items],
    replacementProviders: { [items.symbol]: () => [2, 3] },
  });
  expect(child.resolve(items)).toEqual([2, 3]);
  expect(child.resolve(items)).not.toBe(child.resolve(items));
  await child.close(); await root.close();
});

test('the documented silent gap remains: an unmarked dependency-free request value is shared', async () => {
  let next = 0;
  const root = DiBag.createBuilder().withServices({ request: () => ({ id: ++next }) }).buildContainer();
  const first = root.createChildContainer();
  const second = root.createChildContainer();
  expect(first.resolve('request')).toBe(second.resolve('request'));
  expect(next).toBe(1);
  await root.close();
});
```

The cast in the rejection test bypasses only compile-time admission so the runtime boundary is exercised. It must not be copied into examples.

- [ ] **Step 2: Run the new test and observe the old default**

Run: `bun test tests/singleton-default.test.ts`

Expected before implementation: at least the first test fails because the child receives a distinct unmarked service; the singleton replacement test does not throw. Do not commit this red state.

- [ ] **Step 3: Flip the runtime default and expose one internal lifetime query**

In `src/provider-operations.ts`, replace the default constant and its use with:

```ts
const singletonLifetime: LifetimePolicy = Object.freeze({
  kind: 'singleton',
  allowsScopedDependencies: false,
});

export function sourceDescription(
  create: Factory,
  dispose?: (value: never) => void | Promise<void>,
  tokenKeys: readonly symbol[] = [],
  factoryReturnKind: FactoryReturnKind = 'auto-detect',
  factoryReceivesContext = false,
  references: readonly ArgumentReference[] = [],
): ProviderDescription {
  const selected = Object.freeze([...tokenKeys]);
  const argumentsSnapshot = Object.freeze(references.map(reference => Object.freeze({ ...reference })));
  const source: SourceOperation = Object.freeze(dispose
    ? { kind: 'source', create, dispose, tokenKeys: selected, references: argumentsSnapshot, factoryReturnKind, factoryReceivesContext }
    : { kind: 'source', create, tokenKeys: selected, references: argumentsSnapshot, factoryReturnKind, factoryReceivesContext });
  return Object.freeze({ source, operations: Object.freeze([]), metadata: emptyMetadata, lifetime: singletonLifetime });
}
```

This is the phase-10 internal representation: `LifetimePolicy.kind` uses the compact `LifetimeKind`, while `publicLifetime` alone maps it to the full public string. Preserve phase-4 token data and every phase-9 source field exactly.

In `src/acquisition.ts`, replace `ScopeAcquisitions.isTransient` with a canonical policy query
that preserves its existing parent-sharing, alias-cycle, and `graph.dependency` traversal:

```ts
  lifetimeKind(bindingId: BindingId, path: readonly BindingId[] = []): LifetimeKind {
    if (this.parent && this.shared.has(bindingId)) return this.parent.lifetimeKind(bindingId, path);
    const description = this.graph.registration(bindingId);
    if (description.alias === undefined) return description.lifetime.kind;
    this.assertAliasPath(bindingId, path);
    return this.lifetimeKind(
      this.graph.dependency(bindingId, description.alias),
      [...path, bindingId],
    );
  }

  isTransient(bindingId: BindingId): boolean {
    return this.lifetimeKind(bindingId) === 'transient';
  }
```

Then add the public-key adapter beside `BagRuntime.isTransient` in `src/runtime.ts`:

```ts
  lifetimeOf(key: BindingKey): LifetimeKind {
    return this.acquisitions.lifetimeKind(this.graph.publicBinding(key));
  }

  isTransient(key: BindingKey): boolean {
    return this.acquisitions.isTransient(this.graph.publicBinding(key));
  }
```

Import `LifetimeKind` from `src/lifetime.ts`; do not use the public `Lifetime` union. A direct
`graph.registration(graph.publicBinding(key))` lookup is forbidden because it observes the alias
wrapper/default and misses shared-parent routing.

- [ ] **Step 4: Reject inherited singleton replacements at the selection boundary**

In the phase-6 renamed `src/scope-selection.ts`, replace the selector with this complete body. It preserves the phase-4 token-kind claims and uses the actual public operation at every helper call:

```ts
export function selectChildContainer(
  graph: BindingGraph,
  options: unknown,
  lifetimeOf: (serviceKey: BindingKey) => LifetimeKind,
): {
  readonly graph: BindingGraph;
  readonly shared: readonly BindingId[];
} {
  if (options === undefined) return { graph, shared: [] };
  const bag = snapshotOptionsBag(options, 'createChildContainer', [], [
    'replacedServiceKeys', 'replacementProviders', 'sharedParentServiceKeys',
  ]);
  const { selected, providers } = replacementPair(bag, 'createChildContainer');
  const sharedKeys = Object.hasOwn(bag, 'sharedParentServiceKeys')
    ? snapshotSelection(bag.sharedParentServiceKeys, 'createChildContainer', 'sharedParentServiceKeys')
    : [];
  const selectedGraph = claimContainerSelectionTokenKinds(graph, selected, 'createChildContainer');
  const claimedGraph = claimContainerSelectionTokenKinds(selectedGraph, sharedKeys, 'createChildContainer');
  for (const { key, isCollection } of sharedKeys) {
    if (isCollection) throw wrongTokenKind('createChildContainer', 'single-service', key as symbol);
  }
  for (const { key, isCollection } of [...selected, ...sharedKeys]) {
    if (!isCollection && !claimedGraph.hasPublic(key)) {
      throw libraryError(
        'DI_BAG_INVALID_SCOPE',
        `createChildContainer accepts existing names or typed tokens only: ${String(key)}`,
        { operation: 'createChildContainer' },
      );
    }
  }
  const selectedSet = new Set(selected.map(entry => entry.key));
  const shared = [...new Set(sharedKeys.map(entry => entry.key))].map(serviceKey => {
    if (selectedSet.has(serviceKey)) {
      throw libraryError(
        'DI_BAG_INVALID_SCOPE',
        `createChildContainer cannot share and replace the same service: ${String(serviceKey)}`,
        { operation: 'createChildContainer' },
      );
    }
    if (lifetimeOf(serviceKey) === 'transient') {
      throw libraryError(
        'DI_BAG_INVALID_SCOPE',
        `createChildContainer cannot share transient providers: ${String(serviceKey)}`,
        { operation: 'createChildContainer' },
      );
    }
    return claimedGraph.publicBinding(serviceKey);
  });
  for (const { key: serviceKey, isCollection } of selected) {
    if (!isCollection && lifetimeOf(serviceKey) === 'singleton') {
      throw libraryError(
        'DI_BAG_SINGLETON_REPLACEMENT',
        `createChildContainer cannot replace singleton service '${String(serviceKey)}'; mark it 'scoped:one-per-container' or use createIndependentContainer`,
        { operation: 'createChildContainer', serviceKey },
      );
    }
  }
  const bindings = selected.length === 0
    ? []
    : selectedBindings(claimedGraph, 'createChildContainer', selected, providers);
  return {
    graph: bindings.length === 0
      ? claimedGraph
      : claimedGraph.withPublicBindings(bindings, 'createChildContainer'),
    shared,
  };
}
```

This is an existing selection path plus one new semantic rejection. Preserve phase-4 token-kind validation and collection replacement snapshots around it. Do not use `DI_BAG_CONFLICTING_SERVICE_SELECTION` here.
Collection-token selections still claim `tokenKind`, but skip `lifetimeOf`: a collection has no
single public binding whose lifetime could be queried. Its contributed providers continue through
the existing collection replacement path. Single-service typed tokens and aliases use the claimed
graph and the same canonical public binding as string keys.

Pass `serviceKey => this.#runtime.lifetimeOf(serviceKey)` from `Container.createChildContainer`. Do not pass the callback to `createIndependentContainer`; its selector intentionally has no inherited-lifetime restriction.

- [ ] **Step 5: Add the runtime error reference section now that the code exists**

Add this complete section to `docs/agent/errors.md` in code order:

```md
### DI_BAG_SINGLETON_REPLACEMENT {#di-bag-singleton-replacement}

**When:** `container.createChildContainer({ replacedServiceKeys, replacementProviders })`
selects a service whose inherited provider has lifetime
`'singleton:one-per-container-tree'`.

**Cause:** a singleton is anchored to the container tree and has already fixed the
dependencies of the container that introduced it. Replacing it only in a child would
leave singleton consumers using the inherited value.

**Fix:** mark the replaceable provider `.withLifetime('scoped:one-per-container')`, or
use `createIndependentContainer` when the replacement must rebuild the whole graph.

```ts
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder().withServices({
  request: DiBag.createProvider(() => ({ id: 'outside-request' }))
    .withLifetime('scoped:one-per-container'),
}).buildContainer();

const requestContainer = app.createChildContainer({
  replacedServiceKeys: ['request'],
  replacementProviders: { request: () => ({ id: crypto.randomUUID() }) },
});
await requestContainer.close();
await app.close();
```

**Details:** `{ operation: 'createChildContainer', serviceKey }`.

**Recipe:** [add a request-scoped service](recipes.md#add-scoped-service).
```

- [ ] **Step 6: Run the focused runtime contract and keep the expand work uncommitted**

Run: `bun test tests/singleton-default.test.ts`

Expected: `8 pass`, `0 fail`.

Do not commit yet. The binding execution order has already committed Task 4's mechanical pins;
continue through Task 2 so runtime and type defaults land as one green expand commit.

---
### Task 2: Expand the type-level default, fast path, and child admission

**Files:**
- Modify: `src/lifetime.ts`, `src/lifetime-types.ts`, `src/scope-types.ts`, `src/di-bag.ts`, `src/index.ts`
- Create: `tests/types/singleton-default.ts`, `tests/types/singleton-default-consumer.ts`, `tests/types/negative/singleton-default.ts`
- Modify: `tests/types.test.ts`

**Interfaces:**
- Consumes: phase-9 `Provider` methods/full lifetime strings and `LifetimeObligation` singleton spellings, phase-8 `RenamedExternalObligation`, and phase-6 `CreateChildContainerOptions<ServiceRegistrations, SharedParentServiceKeys, Constraints = never, ...>`.
- Produces: absent lifetime means singleton, explicit scoped lifetime remains visible in the graph contract, `ChildReplacementAdmission<ServiceRegistrations, ReplacedServiceKeys>`, and a no-scoped-service fast path for complete host graphs.

- [ ] **Step 1: Add complete positive source and declaration-consumer fixtures**

Create `tests/types/singleton-default.ts`:

```ts
import { DiBag, type CanonicalLifetime } from '../../src';

type Request = { readonly id: string };

const feature = DiBag.createBuilder().withServices({
  repository: () => ({ read: () => 1 }),
  request: DiBag.createProvider((): Request => ({ id: 'outside-request' }))
    .withLifetime('scoped:one-per-container'),
  handler: DiBag.createProvider(
    ({ repository, request }: { repository: { read(): number }; request: Request }) =>
      ({ run: () => `${request.id}:${repository.read()}` }),
  ).withLifetime('scoped:one-per-container'),
}).buildContainer();

export const child = feature.createChildContainer({
  replacedServiceKeys: ['request'],
  replacementProviders: { request: (): Request => ({ id: 'request-1' }) },
});

export const independent = feature.createIndependentContainer({
  replacedServiceKeys: ['repository'],
  replacementProviders: { repository: () => ({ read: () => 2 }) },
});

const permissive = DiBag.createProvider(
  ({ request }: { request: Request }) => request,
).withLifetime('singleton:one-per-container-tree', { allowsScopedDependencies: true });
export const permissiveContainer = DiBag.createBuilder().withServices({
  request: DiBag.createProvider((): Request => ({ id: 'shared-on-purpose' }))
    .withLifetime('scoped:one-per-container'),
  permissive,
}).buildContainer();

const renamedModule = DiBag.createBuilder().withServices({
  api: ({ request }: { request: Request }) => request.id,
}).buildModule({ exportedServiceKeys: ['api'], moduleLabel: 'feature' })
  .withRenamedRequirement({ currentRequirementKey: 'request', newRequirementKey: 'featureRequest' });
export const installed = DiBag.createBuilder()
  .withInstalledModules([renamedModule])
  .withServices({
    featureRequest: DiBag.createProvider((): Request => ({ id: 'module' }))
      .withLifetime('singleton:one-per-container-tree'),
  })
  .buildContainer();

const aliasRoot = DiBag.createBuilder()
  .withServices({
    request: DiBag.createProvider((): Request => ({ id: 'alias' }))
      .withLifetime('scoped:one-per-container'),
  })
  .withServiceAlias({ aliasKey: 'requestAlias', targetServiceKey: 'request' })
  .buildContainer();
export const sharedChild = aliasRoot.createChildContainer({
  sharedParentServiceKeys: ['requestAlias'],
});

type Registrations = typeof feature extends import('../../src').Container<infer R, infer _C> ? R : never;
type SharedRegistrations = typeof sharedChild extends import('../../src').Container<infer R, infer _C> ? R : never;
export type RepositoryLifetime = CanonicalLifetime<Registrations, 'repository'>;
export type RequestLifetime = CanonicalLifetime<Registrations, 'request'>;
export type SharedAliasLifetime = CanonicalLifetime<SharedRegistrations, 'requestAlias'>;
const repositoryLifetime: RepositoryLifetime = 'singleton:one-per-container-tree';
const requestLifetime: RequestLifetime = 'scoped:one-per-container';
const sharedAliasLifetime: SharedAliasLifetime = 'scoped:one-per-container';
void repositoryLifetime; void requestLifetime; void sharedAliasLifetime;
```

Create `tests/types/singleton-default-consumer.ts`:

```ts
import { child, independent, installed, permissiveContainer } from './singleton-default';
import type { RepositoryLifetime, RequestLifetime, SharedAliasLifetime } from './singleton-default';

const handler: { run(): string } = child.resolve('handler');
const repository: { read(): number } = independent.resolve('repository');
const moduleValue: string = installed.resolve('api');
const request: { readonly id: string } = permissiveContainer.resolve('permissive');
const singleton: RepositoryLifetime = 'singleton:one-per-container-tree';
const scoped: RequestLifetime = 'scoped:one-per-container';
const sharedScoped: SharedAliasLifetime = 'scoped:one-per-container';
void handler; void repository; void moduleValue; void request; void singleton; void scoped; void sharedScoped;
```

Register both fixtures beside the phase-9 provider-method fixtures in `tests/types.test.ts`:

```ts
test('singleton default source contract type-checks', () => {
  expect(diagnostics(resolve(__dirname, 'types/singleton-default.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});

test('singleton default declaration consumer type-checks', () => {
  expect(diagnostics(resolve(__dirname, 'types/singleton-default-consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});
```

Append `'singleton-default'` to the existing declaration-consumption fixture array; do not add a
second emitter.

- [ ] **Step 2: Add complete negative cases with one marker per rejected path**

Create `tests/types/negative/singleton-default.ts`:

```ts
import { DiBag } from '../../../src';

const root = DiBag.createBuilder().withServices({
  singleton: () => ({ value: 1 }),
  scoped: DiBag.createProvider(() => ({ value: 2 })).withLifetime('scoped:one-per-container'),
  transient: DiBag.createProvider(() => ({ value: 3 })).withLifetime('transient:one-per-resolve'),
}).buildContainer();

root.createChildContainer({
  replacedServiceKeys: ['singleton'],
  // diagnostic: createChildContainer cannot replace singleton service: singleton; mark it scoped:one-per-container or use createIndependentContainer
  replacementProviders: { singleton: () => ({ value: 4 }) },
});

const singletonToken = DiBag.createToken(Symbol('singleton')).forService<{ value: number }>();
const tokenRoot = DiBag.createBuilder()
  .withTokenService(singletonToken, () => ({ value: 1 }))
  .buildContainer();
tokenRoot.createChildContainer({
  replacedServiceKeys: [singletonToken],
  // diagnostic: createChildContainer cannot replace singleton service
  replacementProviders: { [singletonToken.symbol]: () => ({ value: 2 }) },
});

// diagnostic: root lifetime cannot capture scoped dependency: consumer -> scoped
DiBag.createBuilder().withServices({
  scoped: DiBag.createProvider(() => 1).withLifetime('scoped:one-per-container'),
  consumer: ({ scoped }: { scoped: number }) => scoped,
}).buildContainer();

// diagnostic: root lifetime cannot capture scoped dependency: aliasConsumer -> scopedAlias
DiBag.createBuilder()
  .withServices({ scopedAliasTarget: DiBag.createProvider(() => 1).withLifetime('scoped:one-per-container') })
  .withServiceAlias({ aliasKey: 'scopedAlias', targetServiceKey: 'scopedAliasTarget' })
  .withServices({ aliasConsumer: ({ scopedAlias }: { scopedAlias: number }) => scopedAlias })
  .buildContainer();

const throughModule = DiBag.createBuilder().withServices({
  api: ({ external }: { external: number }) => external,
}).buildModule({ exportedServiceKeys: ['api'], moduleLabel: 'feature' })
  .withRenamedRequirement({ currentRequirementKey: 'external', newRequirementKey: 'renamedExternal' });
// diagnostic: root lifetime cannot capture scoped dependency: api -> renamedExternal
DiBag.createBuilder().withInstalledModules([throughModule]).withServices({
  renamedExternal: DiBag.createProvider(() => 1).withLifetime('scoped:one-per-container'),
}).buildContainer();

// These remain valid and ensure admission is specific to child containers.
root.createChildContainer({
  replacedServiceKeys: ['scoped', 'transient'],
  replacementProviders: { scoped: () => ({ value: 4 }), transient: () => ({ value: 5 }) },
});
root.createIndependentContainer({
  replacedServiceKeys: ['singleton'],
  replacementProviders: { singleton: () => ({ value: 6 }) },
});
```

If phase 6 selected its positional S3 fallback, replace only the two child replacement calls with positional arguments and put each diagnostic marker immediately above the second `replacementProviders` argument. Keep the options-bag fixture as a separate direct instantiation of `CreateChildContainerOptions` so property-local admission is still proved:

```ts
const rejectedOptions: import('../../../src').CreateChildContainerOptions<
  { singleton: () => { value: number } }, readonly [], never, readonly ['singleton'],
  { singleton: () => { value: number } }
> = {
  replacedServiceKeys: ['singleton'],
  // diagnostic: createChildContainer cannot replace singleton service
  replacementProviders: { singleton: () => ({ value: 2 }) },
};
void rejectedOptions;
```

The executor must inspect diagnostic start positions, not only message substrings: each singleton replacement diagnostic starts on `replacementProviders`, and both the string and token selection paths are covered. This compile-time design is uncompiled in this planning session.

Add this location assertion to `tests/types.test.ts` using its existing `diagnostics` helper:

```ts
test('singleton default child diagnostics start on replacementProviders', () => {
  const file = resolve(__dirname, 'types/negative/singleton-default.ts');
  const errors = diagnostics(file).filter(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n')
      .includes('createChildContainer cannot replace singleton service'),
  );
  expect(errors).toHaveLength(2);
  expect(errors.map(error => {
    const source = error.file!;
    const { line } = source.getLineAndCharacterOfPosition(error.start!);
    return source.text.slice(source.getLineStarts()[line], source.getLineStarts()[line + 1]).trimStart();
  })).toEqual([
    "replacementProviders: { singleton: () => ({ value: 4 }) },",
    "replacementProviders: { [singletonToken.symbol]: () => ({ value: 2 }) },",
  ]);
});
```

- [ ] **Step 3: Make explicit scoped policy survive in `LifetimeGraph`**

Keep phase 9's public `Lifetime` and option validation. Replace `LifetimeGraph` in `src/lifetime.ts` with this distributive definition, using phase-2 generic names:

```ts
export type LifetimeGraph<
  RetainedGraphContract extends GraphContract,
  SelectedLifetime extends Lifetime,
  Options,
> = RetainedGraphContract extends infer Graph & {}
  ? Graph extends GraphContract
      ? Omit<Graph, 'lifetime'> & {
        readonly lifetime: {
          readonly kind: LifetimeKindOf<SelectedLifetime>;
          readonly allowsScopedDependencies:
            [Options] extends [{ readonly allowsScopedDependencies: true }] ? true : false;
        };
      }
    : never
  : never;
```

Retain phase 10's `LifetimeKindOf` mapper. An undecorated provider has no `lifetime` key and is therefore the default singleton. Explicit scoped policy can no longer be represented by removing the key.

- [ ] **Step 4: Replace the lifetime classifier/walker core**

In `src/lifetime-types.ts`, retain all public exports and replace the policy classifiers with this complete block. Provider graph contracts use phase 10's compact internal `LifetimeKind`; full strings remain restricted to the public `withLifetime` API and public inspection output.

```ts
type Members<Value> = Value extends infer Member & {}
  ? Member extends ProviderOrFactory ? Member : never
  : never;

type Policy<Value> = ProviderGraphContract<Value> extends infer Graph
  ? Graph extends { readonly lifetime: { readonly kind: infer Kind extends LifetimeKind } }
    ? Kind
    : 'singleton'
  : never;

type AllowsScoped<Value> = ProviderGraphContract<Value> extends infer Graph
  ? Graph extends { readonly lifetime: { readonly allowsScopedDependencies: true } } ? true : false
  : false;

type Strict<Value> = ProviderGraphContract<Value> extends { readonly kind: 'opaque' }
  ? false
  : ProviderGraphContract<Value> extends { readonly alias: PropertyKey } | { readonly sharedAlias: unknown }
    ? false
    : Policy<Value> extends 'singleton'
      ? true extends AllowsScoped<Value> ? false : true
      : false;

type Carrying<Value> = ProviderGraphContract<Value> extends infer Graph
  ? Graph extends { readonly alias: PropertyKey }
    ? true
    : Policy<Value> extends 'transient' ? true : Strict<Value>
  : false;

type StrictMembers<Value> = Members<Value> extends infer Member
  ? Member extends ProviderOrFactory ? true extends Strict<Member> ? Member : never : never
  : never;

type CarrierMembers<Value> = Members<Value> extends infer Member
  ? Member extends ProviderOrFactory ? true extends Carrying<Member> ? Member : never : never
  : never;

type ScopedMembers<Value> = Members<Value> extends infer Member
  ? Member extends ProviderOrFactory
    ? Policy<Member> extends 'scoped' ? Member : never
    : never
  : never;

type ContributionProviders<Constraints> = Constraints extends ContributionConstraint
  ? Constraints['registration']
  : never;

type ScopedRegistrationKeys<ServiceRegistrations extends Registrations> = {
  [ServiceKey in keyof ServiceRegistrations]:
    PolicyOf<ServiceRegistrations, ServiceKey, never> extends 'scoped' ? ServiceKey : never;
}[keyof ServiceRegistrations];

type HasScopedProvider<ServiceRegistrations extends Registrations, Constraints> = [
  ScopedRegistrationKeys<ServiceRegistrations> |
  ScopedMembers<ContributionProviders<Constraints>>
] extends [never] ? false : true;

type HasLifetimeObligation<Constraints> = [Extract<Constraints, LifetimeObligation>] extends [never]
  ? false
  : true;

type NeedsHostLifetimeWalk<ServiceRegistrations extends Registrations, Constraints> =
  true extends HasScopedProvider<ServiceRegistrations, Constraints> | HasLifetimeObligation<Constraints>
    ? true
    : false;
```

Keep the file's `Dependencies`, `AliasKeys`, `CollectionKeys`, `ExportReaches`, and phase-8 requirement-renaming helpers. Change every policy branch in the seal/host walkers as follows:

```ts
type ReachTarget<ServiceRegistrations extends Registrations, PublicKeys, Constraints, Value, Dependency, Visited> =
  Members<Value> extends infer Member
    ? Member extends ProviderOrFactory
      ? ProviderGraphContract<Member> extends { readonly kind: 'opaque' } ? never
        : ProviderGraphContract<Member> extends { readonly alias: PropertyKey }
          ? Reaches<ServiceRegistrations, PublicKeys, Constraints, Member, Dependency, Visited>
          : Policy<Member> extends 'scoped'
            ? { readonly kind: 'scoped'; readonly key: Dependency }
            : Policy<Member> extends 'transient'
              ? Reaches<ServiceRegistrations, PublicKeys, Constraints, Member, Dependency, Visited>
              : never
      : never
    : never;

type HostTarget<ServiceRegistrations extends Registrations, Constraints, Value, Dependency, Visited> =
  Members<Value> extends infer Member
    ? Member extends ProviderOrFactory
      ? ProviderGraphContract<Member> extends infer Graph
        ? Graph extends { readonly sharedAlias: { readonly registrations: infer Parent extends Registrations; readonly source: infer Source } }
          ? HostReach<Parent, Constraints, Source, never>
          : Graph extends { readonly kind: 'opaque' } ? never
          : Graph extends { readonly alias: PropertyKey }
            ? HostReaches<ServiceRegistrations, Constraints, Member, Dependency, Visited>
            : Policy<Member> extends 'scoped' ? Captured<Dependency>
            : Policy<Member> extends 'transient'
              ? HostReaches<ServiceRegistrations, Constraints, Member, Dependency, Visited>
              : never
        : never
      : never
    : never;

type ContributionPolicy<Value> = true extends Strict<Value>
  ? 'singleton'
  : Policy<Value> extends 'transient' ? 'transient' : never;
```

Use phase-9 obligation kinds exactly: `singleton-reach`, `export-reach`, and `contribution-reach` whose policy is `'singleton' | 'transient'`. Rename local helpers such as `PrivateRoots`, `RootCaptives`, and `AsRoot` to `PrivateSingletons`, `SingletonCaptives`, and `AsSingleton` only if phase 9 has already done so; do not create a second naming pass.

Change `CheckedLifetimes` and `CheckedChildContainerLifetimes` fast paths to:

```ts
export type CheckedLifetimes<
  ServiceRegistrations extends Registrations,
  Constraints extends NeedConstraint,
> = NeedsHostLifetimeWalk<ServiceRegistrations, Constraints> extends false
  ? unknown
  : [Captives<ServiceRegistrations, Constraints>] extends [never] ? unknown
    : unknown extends
        CheckDependencyCompatibility<ServiceRegistrations> &
        CheckDependencyCompleteness<ServiceRegistrations> &
        CheckedConstraints<Constraints, ServiceRegistrations> &
        CompleteConstraints<Constraints, ServiceRegistrations>
      ? Unsatisfied<
          `root lifetime cannot capture scoped dependency: ${CaptiveText<Captives<ServiceRegistrations, Constraints>>}${SeeErrors<'root-capture'>}`,
          { readonly captives: Captives<ServiceRegistrations, Constraints> }
        >
      : unknown;

export type CheckedChildContainerLifetimes<
  ServiceRegistrations extends Registrations,
  ReplacementProviders extends Registrations,
  Constraints = never,
> = NeedsHostLifetimeWalk<ServiceRegistrations, Constraints> extends false
  ? unknown
  : [OverrideCaptives<ServiceRegistrations, ReplacementProviders, Constraints>] extends [never] ? unknown
    : Unsatisfied<
        `root lifetime cannot capture scoped dependency: ${CaptiveText<OverrideCaptives<ServiceRegistrations, ReplacementProviders, Constraints>>}${SeeErrors<'root-capture'>}`,
        { readonly captives: OverrideCaptives<ServiceRegistrations, ReplacementProviders, Constraints> }
      >;
```

The old `root lifetime` text and `root-capture` anchor remain deliberately until plan 12 Task 12. Do not update the 16 existing message assertions in this phase.

For seal-time work, do not use the host fast path. Add this separate guard:

```ts
type NeedsSealLifetimeWalk<ServiceRegistrations extends Registrations, Constraints> =
  [keyof ServiceRegistrations] extends [never]
    ? HasLifetimeObligation<Constraints>
    : true;
```

Replace only the leading condition in `SealedLifetimes` and `SealAdmission` with
`NeedsSealLifetimeWalk<ServiceRegistrations, Constraints> extends false`; retain the rest of
each phase-10 definition byte-for-byte. Every nonempty module must walk because an unmarked
singleton can reach an external requirement that the installing host satisfies with an explicit
scoped provider. Preserve every branch of both `RenamedObligation` and phase-8
`RenamedExternalObligation`; update only their phase-10 `singleton`/`singleton-reach`
spellings. Add the positive/negative renamed-module cases from Steps 1–2 to prove the
obligation survives.

- [ ] **Step 5: Add canonical policy and child-replacement admission**

Replace the terminal default in `PolicyTarget` and add these exported helpers:

```ts
type PolicyTarget<ServiceRegistrations extends Registrations, Value, Visited> =
  ProviderGraphContract<Value> extends infer Graph
    ? Graph extends { readonly sharedAlias: { readonly registrations: infer Parent extends Registrations; readonly source: infer Source } }
      ? PolicyOf<Parent, Source, never>
      : Graph extends { readonly alias: infer Alias }
        ? PolicyOf<ServiceRegistrations, Alias, Visited>
        : Graph extends { readonly lifetime: { readonly kind: infer Selected extends LifetimeKind } }
          ? Selected
          : 'singleton'
    : never;

type PublicLifetime<Kind extends LifetimeKind> =
  Kind extends 'singleton' ? 'singleton:one-per-container-tree'
  : Kind extends 'scoped' ? 'scoped:one-per-container'
  : 'transient:one-per-resolve';

export type CanonicalLifetime<
  ServiceRegistrations extends Registrations,
  ServiceKey extends keyof ServiceRegistrations,
> = PublicLifetime<PolicyOf<ServiceRegistrations, ServiceKey, never>>;

type SingletonReplacementKeys<
  ServiceRegistrations extends Registrations,
  ReplacedServiceKeys extends readonly unknown[],
> = {
  [ServiceKey in SelectionKey<ReplacedServiceKeys[number]> & keyof ServiceRegistrations]:
    CanonicalLifetime<ServiceRegistrations, ServiceKey> extends 'singleton:one-per-container-tree'
      ? ServiceKey
      : never;
}[SelectionKey<ReplacedServiceKeys[number]> & keyof ServiceRegistrations];

type SingletonReplacementMessage<ServiceKey> = ServiceKey extends PropertyKey
  ? `createChildContainer cannot replace singleton service: ${NameText<ServiceKey>}; mark it scoped:one-per-container or use createIndependentContainer`
  : never;

export type ChildReplacementAdmission<
  ServiceRegistrations extends Registrations,
  ReplacedServiceKeys extends readonly unknown[],
> = [SingletonReplacementKeys<ServiceRegistrations, ReplacedServiceKeys>] extends [never]
  ? unknown
  : Unsatisfied<
      SingletonReplacementMessage<SingletonReplacementKeys<ServiceRegistrations, ReplacedServiceKeys>>,
      { readonly serviceKey: SingletonReplacementKeys<ServiceRegistrations, ReplacedServiceKeys> }
    >;
```

Export `CanonicalLifetime` and `ChildReplacementAdmission` from `src/index.ts` beside the existing lifetime helpers.

In `CreateChildContainerOptions`, intersect only the `replacementProviders` property with `ChildReplacementAdmission<ServiceRegistrations, ReplacedServiceKeys>`:

```ts
readonly replacementProviders?: ReplacementProviders &
  ChildReplacementAdmission<ServiceRegistrations, ReplacedServiceKeys> &
  object &
  Record<SelectionKey<ReplacedServiceKeys[number]>, ProviderOrFactory> &
  Overrides<
    ServiceRegistrations,
    ReboundSelection<ServiceRegistrations, ReplacedServiceKeys, SelectedRegistrations<ReplacedServiceKeys, ReplacementProviders>>,
    ReplacedServiceKeys
  >;
```

Retain every existing compatibility, completeness, constraint, and `CheckedChildContainerLifetimes` intersection following that excerpt. This carries forward Phase4's reviewed public declaration facades (`b22f2b3`): keep the third selection argument to `Overrides`, and keep synthetic collection-selection helpers private behind `ReboundSelection`/`OverrideRegistrations`. The new singleton admission still requires this phase's compiler and physical consumer proof. Do not add this admission to `CreateIndependentContainerOptions`.

Replace the complete phase-7 replacement overload, after phase-10 type renames, with:

```ts
createChildContainer<
  const ReplacedServiceKeys extends readonly unknown[],
  ReplacementProviders extends OverrideFactoryContext<ServiceRegistrations, ReplacedServiceKeys, ReplacementProviders>,
  const SharedParentServiceKeys extends readonly unknown[] = readonly [],
>(
  options: CreateChildContainerOptions<
    ServiceRegistrations,
    SharedParentServiceKeys,
    Constraints,
    ReplacedServiceKeys,
    ReplacementProviders & ChildReplacementAdmission<ServiceRegistrations, ReplacedServiceKeys> & object &
      Record<SelectionKey<ReplacedServiceKeys[number]>, ProviderOrFactory> &
      Overrides<ServiceRegistrations, ReboundSelection<ServiceRegistrations, ReplacedServiceKeys, SelectedRegistrations<ReplacedServiceKeys, ReplacementProviders>>, ReplacedServiceKeys> &
      CheckDependencyCompatibility<OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, ReplacedServiceKeys, SelectedRegistrations<ReplacedServiceKeys, ReplacementProviders>>>> &
      CheckDependencyCompleteness<OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, ReplacedServiceKeys, SelectedRegistrations<ReplacedServiceKeys, ReplacementProviders>>>> &
      CheckedConstraints<Constraints, OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, ReplacedServiceKeys, SelectedRegistrations<ReplacedServiceKeys, ReplacementProviders>>>> &
      CompleteConstraints<Constraints, OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, ReplacedServiceKeys, SelectedRegistrations<ReplacedServiceKeys, ReplacementProviders>>>> &
      CheckedChildContainerLifetimes<
        NoInfer<ScopedAliases<OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, ReplacedServiceKeys, SelectedRegistrations<ReplacedServiceKeys, ReplacementProviders>>>, ServiceRegistrations, SharedParentServiceKeys>>,
        NoInfer<ReboundSelection<ServiceRegistrations, ReplacedServiceKeys, SelectedRegistrations<ReplacedServiceKeys, ReplacementProviders>>>,
        WithoutExportObligations<Constraints, SelectionKey<ReplacedServiceKeys[number]>>
      >
  >,
): Container<
  ScopedAliases<OverrideRegistrations<ServiceRegistrations, ReboundSelection<ServiceRegistrations, ReplacedServiceKeys, SelectedRegistrations<ReplacedServiceKeys, ReplacementProviders>>>, ServiceRegistrations, SharedParentServiceKeys>,
  WithoutExportObligations<Constraints, SelectionKey<ReplacedServiceKeys[number]>>
>;
```

This overload and the `replacementProviders` property both carry the admission, so inference
cannot select a class overload that bypasses the options alias. Collection selections retain their
phase-7 metadata but produce no `SingletonReplacementKeys` member because they have no singular
entry in `ServiceRegistrations`.

If S3 selected positional overloads, replace `replacementProviders: ReplacementProviders & object`
in the complete phase-7 fallback overload with
`replacementProviders: ReplacementProviders & ChildReplacementAdmission<ServiceRegistrations, ReplacedServiceKeys> & object`, retaining the entire `Record`, `Overrides`, dependency,
constraint, and `CheckedChildContainerLifetimes` tail printed above. The message and detail key
remain identical.

- [ ] **Step 6: Run each focused type command only after a separate explicit heavy-hold lift**

```bash
bun test tests/types.test.ts --test-name-pattern 'singleton default'
```

Release the first slot and ask the controller to explicitly lift the hold and grant a new serialized slot before running:

```bash
npm run typecheck:native -- --pretty false
```

Expected: the source and emitted-declaration consumer fixtures have zero diagnostics; every negative marker has exactly one matching diagnostic; the two child errors start on the `replacementProviders` property/parameter; the renamed external capture names `renamedExternal`; no unrelated diagnostic appears.

- [ ] **Step 7: Commit the green runtime/type expand unit**

Run the focused runtime tests plus the controller-held type commands from Steps 1 and 6, then
stage only this expand unit:

```bash
git add -- src/provider-operations.ts src/acquisition.ts src/runtime.ts src/scope-selection.ts src/di-bag.ts src/lifetime.ts src/lifetime-types.ts src/scope-types.ts src/index.ts tests/singleton-default.test.ts tests/types/singleton-default.ts tests/types/singleton-default-consumer.ts tests/types/negative/singleton-default.ts tests/types.test.ts docs/agent/errors.md
git commit -F - <<'MSG'
feat!: default providers to singleton lifetime

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

---

### Task 3: Migrate with the whole-program lifetime-pin transform

**Files:**
- Modify: `tools/codemod/cli.mjs`, `tools/codemod/lib/codemod.mjs`, `tools/codemod/lib/rewrite.mjs`, `tools/codemod/lib/transforms/index.mjs`
- Create: `tools/codemod/lib/transforms/lifetime-pin.mjs`
- Create: `tools/codemod/test/fixtures/lifetime-pin/input.ts`, `tools/codemod/test/fixtures/lifetime-pin/expected.ts`, `tools/codemod/test/fixtures/lifetime-pin/expected-manual.json`, `tools/codemod/test/fixtures/whole-program-pin/source.ts`, `tools/codemod/test/current-lifetime-pin/{input,expected}.ts`
- Modify: `tools/codemod/test/helpers.mjs`, `tools/codemod/test/fixtures.test.mjs`, `tools/codemod/test/cli.test.mjs`, `tools/codemod/test/transforms.test.mjs`, `tools/codemod/test/rename-map.test.mjs`

**Interfaces:**
- Consumes: the phase-1 original-program selector, one-pass child rendering, `api.nameOf`; phase-7 method-entry `transformNames`/`api.nameForRole`; phase-9 provider-source and phase-10 provider-shape transforms.
- Produces: CLI `--pin-lifetimes`, auto-enable only for a resolved 0.4.0 `Bag.createScope` call, and scoped pins for every syntactically visible registration/replacement without an explicit lifetime.

- [ ] **Step 1: Add CLI policy tests**

Add `writeFileSync` to the existing `node:fs` import and append these cases using phase 2's
actual `run(cwd, ...args)` and `copyOf(directory)` helpers:

```js
test('old createScope enables lifetime pins by default', () => {
  const project = copyOf('fixtures');
  const result = run(project, 'lifetime-pin/input.ts', '--write');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    readFileSync(join(project, 'lifetime-pin/input.ts'), 'utf8'),
    readFileSync(join(project, 'lifetime-pin/expected.ts'), 'utf8'),
  );
  rmSync(project, { recursive: true, force: true });
});

test('a project without old createScope pins only when requested', () => {
  const project = copyOf('fixtures');
  const input = join(project, 'lifetime-pin/input.ts');
  const withoutScope = readFileSync(input, 'utf8')
    .replace('root.createScope()', 'root.fork()')
    .replace("root.createScope(['service'], { service: () => 2 })", "root.fork(['service'], { service: () => 2 })");
  writeFileSync(input, withoutScope);
  const automatic = run(project, 'lifetime-pin/input.ts', '--write');
  assert.equal(automatic.status, 0, automatic.stderr);
  assert.doesNotMatch(readFileSync(input, 'utf8'), /scoped:one-per-container/);
  writeFileSync(input, withoutScope);
  const explicit = run(project, 'lifetime-pin/input.ts', '--pin-lifetimes', '--write');
  assert.equal(explicit.status, 0, explicit.stderr);
  assert.match(readFileSync(input, 'utf8'), /withLifetime\('scoped:one-per-container'\)/);
  rmSync(project, { recursive: true, force: true });
});

test('pin-lifetimes rejects a value', () => {
  const project = copyOf('fixtures');
  const result = run(project, 'lifetime-pin/input.ts', '--pin-lifetimes=true');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /--pin-lifetimes takes no value/);
  rmSync(project, { recursive: true, force: true });
});
```

- [ ] **Step 2: Add exact fixture input**

Create `tools/codemod/test/fixtures/lifetime-pin/input.ts`:

```ts
import { DiBag as ContainerKit } from 'di-bag';
import * as Library from 'di-bag';

const clock = () => ({ now: () => Date.now() });
const explicit = ContainerKit.withLifetime(() => ({ id: 'explicit' }), 'root');
const decorated = ContainerKit.withDisposal(() => ({ close() {} }), value => value.close());
const shared = { fromVariable: () => 1 };
const item = ContainerKit.token(Symbol('item')).of<number>();
const items = ContainerKit.token(Symbol('items')).of<number>();
const unrelated = { createScope: () => 'user-method' };

const feature = ContainerKit.createBuilder().register({
  plain: () => 1,
  clock,
  explicit,
  decorated,
}).buildModule(['plain']);

export const root = ContainerKit.createBuilder()
  .register({ service: () => 1 })
  .installModule(feature)
  .build();

export const forms = ContainerKit.createBuilder()
  .register(item, () => 1)
  .contribute(items, () => 2)
  .replace(items, () => [3]);
export const untouched = unrelated.createScope();

export const empty = root.createScope();
export const child = root.createScope(['service'], { service: () => 2 });
export const independent = root.fork(['service'], { service: () => 3 });
export const manual = ContainerKit.createBuilder().register(shared).build();
export const spread = ContainerKit.createBuilder().register({ ...shared }).build();
export const namespaceFeature = Library.DiBag.createBuilder().register({ ns: () => 1 }).build();
```

- [ ] **Step 3: Add exact golden output and literal manual rows**

Create `tools/codemod/test/fixtures/lifetime-pin/expected.ts`:

```ts
import { DiBag as ContainerKit } from 'di-bag';
import * as Library from 'di-bag';

const clock = () => ({ now: () => Date.now() });
const explicit = (ContainerKit.createProvider(() => ({ id: 'explicit' }))).withLifetime('singleton:one-per-container-tree');
const decorated = (ContainerKit.createProvider(() => ({ close() {} }))).withDisposal(value => value.close());
const shared = { fromVariable: () => 1 };
const item = ContainerKit.createToken(Symbol('item')).forService<number>();
const items = ContainerKit.createToken(Symbol('items')).forCollectionOf<number>();
const unrelated = { createScope: () => 'user-method' };

const feature = ContainerKit.createBuilder().withServices({
  plain: (ContainerKit.createProvider(() => 1)).withLifetime('scoped:one-per-container'),
  clock: (ContainerKit.createProvider(clock)).withLifetime('scoped:one-per-container'),
  explicit,
  decorated: (decorated).withLifetime('scoped:one-per-container'),
}).buildModule({ exportedServiceKeys: ['plain'] });

export const root = ContainerKit.createBuilder()
  .withServices({ service: (ContainerKit.createProvider(() => 1)).withLifetime('scoped:one-per-container') })
  .withInstalledModules([feature])
  .buildContainer();

export const forms = ContainerKit.createBuilder()
  .withTokenService(item, (ContainerKit.createProvider(() => 1)).withLifetime('scoped:one-per-container'))
  .withCollectionContribution({ collectionToken: items, provider: (ContainerKit.createProvider(() => 2)).withLifetime('scoped:one-per-container') })
  .withReplacedService(items, (ContainerKit.createProvider(() => [3])).withLifetime('scoped:one-per-container'));
export const untouched = unrelated.createScope();

export const empty = root.createChildContainer();
export const child = root.createChildContainer({ replacedServiceKeys: ['service'], replacementProviders: { service: (ContainerKit.createProvider(() => 2)).withLifetime('scoped:one-per-container') } });
export const independent = root.createIndependentContainer({ replacedServiceKeys: ['service'], replacementProviders: { service: (ContainerKit.createProvider(() => 3)).withLifetime('scoped:one-per-container') } });
export const manual = ContainerKit.createBuilder().withServices(shared).buildContainer();
export const spread = ContainerKit.createBuilder().withServices({ ...shared }).buildContainer();
export const namespaceFeature = Library.DiBag.createBuilder().withServices({ ns: (ContainerKit.createProvider(() => 1)).withLifetime('scoped:one-per-container') }).buildContainer();
```

If phase 10 selected S2 fallback, use this complete `expected.ts` instead:

```ts
import { DiBag as ContainerKit } from 'di-bag';
import * as Library from 'di-bag';

const clock = () => ({ now: () => Date.now() });
const explicit = ContainerKit.providerWithLifetime({ provider: () => ({ id: 'explicit' }), lifetime: 'singleton:one-per-container-tree' });
const decorated = ContainerKit.providerWithDisposal({ provider: () => ({ close() {} }), disposeService: value => value.close() });
const shared = { fromVariable: () => 1 };
const item = ContainerKit.createToken(Symbol('item')).forService<number>();
const items = ContainerKit.createToken(Symbol('items')).forCollectionOf<number>();
const unrelated = { createScope: () => 'user-method' };

const feature = ContainerKit.createBuilder().withServices({
  plain: ContainerKit.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }),
  clock: ContainerKit.providerWithLifetime({ provider: clock, lifetime: 'scoped:one-per-container' }),
  explicit,
  decorated: ContainerKit.providerWithLifetime({ provider: decorated, lifetime: 'scoped:one-per-container' }),
}).buildModule({ exportedServiceKeys: ['plain'] });

export const root = ContainerKit.createBuilder()
  .withServices({ service: ContainerKit.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) })
  .withInstalledModules([feature])
  .buildContainer();

export const forms = ContainerKit.createBuilder()
  .withTokenService(item, ContainerKit.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }))
  .withCollectionContribution({ collectionToken: items, provider: ContainerKit.providerWithLifetime({ provider: () => 2, lifetime: 'scoped:one-per-container' }) })
  .withReplacedService(items, ContainerKit.providerWithLifetime({ provider: () => [3], lifetime: 'scoped:one-per-container' }));
export const untouched = unrelated.createScope();

export const empty = root.createChildContainer();
export const child = root.createChildContainer({ replacedServiceKeys: ['service'], replacementProviders: { service: ContainerKit.providerWithLifetime({ provider: () => 2, lifetime: 'scoped:one-per-container' }) } });
export const independent = root.createIndependentContainer({ replacedServiceKeys: ['service'], replacementProviders: { service: ContainerKit.providerWithLifetime({ provider: () => 3, lifetime: 'scoped:one-per-container' }) } });
export const manual = ContainerKit.createBuilder().withServices(shared).buildContainer();
export const spread = ContainerKit.createBuilder().withServices({ ...shared }).buildContainer();
export const namespaceFeature = Library.DiBag.createBuilder()
  .withServices({ ns: ContainerKit.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) })
  .buildContainer();
```

`explicit` remains explicitly singleton. `decorated` is pinned only at its registration use, where its already-transformed provider expression is rendered as one chain. The variable declaration itself is not a registration site. Independent-container replacements are pinned too because their 0.4.0 default was scoped.

Create `tools/codemod/test/fixtures/lifetime-pin/expected-manual.json` exactly:

```json
[
  {
    "line": 34,
    "reason": "register receives a nonliteral registration bag; add withLifetime('scoped:one-per-container') to each provider in that bag"
  },
  {
    "line": 35,
    "reason": "register contains a spread registration; add withLifetime('scoped:one-per-container') to each provider contributed by that spread"
  }
]
```

The phase-1 fixture harness accepts only `{ "line", "reason" }`. Do not add `reasonPattern` or `manual` fields.

- [ ] **Step 4: Preserve the accumulated map and phase-7 role rule exactly**

Do not add `transformNames` to `Builder.register`, `Builder.contribute`, or `Builder.replace`:
phase 7 rejects roles on an entry without a custom `transform`. The source hook sees those original
0.4 calls before rendering and targets their positional provider argument or registration-bag
values directly, so it needs no emitted-field role. Reuse the existing
`Bag.createScope`/`Bag.fork` `container-derivation` entries and their exact
`keys`/`providers`/`sharing` roles without modification; their custom transform already emits the
options bag. This phase makes no rename-map or schema change. Add a regression assertion to
`rename-map.test.mjs` that the four ordinary builder entries still have
`transformNames === undefined`, while the two container-derivation entries retain their phase-7
role objects.

- [ ] **Step 5: Implement the complete lifetime-pin classifier**

Create `tools/codemod/lib/transforms/lifetime-pin.mjs`:

```js
function member(api, call) {
  return api.originalMember(call);
}

function isMethod(api, call, owner, ...names) {
  const selected = member(api, call);
  return selected?.owner === owner && names.includes(selected.name);
}

function ownProperties(ts, literal, api, operation) {
  const values = [];
  for (const property of literal.properties) {
    if (ts.isSpreadAssignment(property)) {
      api.manual(property, `${operation} contains a spread registration; add withLifetime('scoped:one-per-container') to each provider contributed by that spread`);
      continue;
    }
    if (ts.isPropertyAssignment(property)) values.push({ node: property.initializer, valueNode: property.initializer, kind: 'value' });
    else if (ts.isShorthandPropertyAssignment(property)) values.push({ node: property, valueNode: property.name, kind: 'shorthand', name: property.name });
    else if (ts.isMethodDeclaration(property) && property.body && property.name && !ts.isComputedPropertyName(property.name)) {
      values.push({ node: property, valueNode: property, kind: 'method', name: property.name });
    }
    else api.manual(property, `${operation} contains a computed or accessor registration; add its scoped lifetime by hand`);
  }
  return values;
}

function propertyNamed(ts, literal, name) {
  return literal.properties.find(property =>
    (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) &&
    !property.name?.questionToken &&
    ((ts.isIdentifier(property.name) && property.name.text === name) ||
      (ts.isStringLiteralLike(property.name) && property.name.text === name)),
  );
}

function currentRoute(api, call, owner, from, originalArity) {
  if (!api.ts.isPropertyAccessExpression(call.expression)) return undefined;
  const entry = api.entryFor(owner, from, originalArity);
  if (!entry || call.expression.name.text !== entry.to) return undefined;
  const coverage = api.library.memberCoverage(api.library.symbolAt(call.expression.name));
  if (coverage.members.length === 0) return undefined;
  if (!coverage.complete) {
    api.manual(call, `${entry.to} resolves to both DI Bag and non-library declarations; preserve provider lifetimes by hand`);
    return undefined;
  }
  if (coverage.members.length !== 1) return undefined;
  return entry;
}

function mappedOutputs(api, owner, from) {
  const names = new Set();
  for (let arity = 0; arity <= 5; arity++) {
    const entry = api.entryFor(owner, from, arity);
    if (!entry) continue;
    names.add(entry.to);
    for (const value of Object.values(entry.transformNames ?? {})) names.add(value);
  }
  return names;
}

function emittedField(entry, role, argumentPosition) {
  return entry.transformNames?.[role] ?? entry.arguments?.names?.[argumentPosition];
}

function currentProviderField(ts, options, api, entry, operation, role, argumentPosition, bag) {
  if (!ts.isObjectLiteralExpression(options)) {
    api.manual(options, `${operation} options are not an object literal; preserve provider lifetimes by hand`);
    return [];
  }
  const name = emittedField(entry, role, argumentPosition);
  if (name === undefined) throw new Error(`${entry.owner}.${entry.from} has no emitted ${role} field`);
  let property;
  for (const candidate of options.properties) {
    if (ts.isSpreadAssignment(candidate)) {
      api.manual(candidate, `${operation} options contain a spread; preserve provider lifetimes in the spread source by hand`);
      continue;
    }
    if (propertyNamed(ts, ts.factory.createObjectLiteralExpression([candidate]), name)) property = candidate;
  }
  if (!property) return [];
  if (ts.isPropertyAssignment(property)) {
    return bag
      ? registrationsFromBag(ts, property.initializer, api, operation)
      : [{ node: property.initializer, valueNode: property.initializer, kind: 'value' }];
  }
  if (ts.isShorthandPropertyAssignment(property)) {
    if (bag) {
      api.manual(property, `${operation} receives a nonliteral registration bag; add withLifetime('scoped:one-per-container') to each provider in that bag`);
      return [];
    }
    return [{ node: property, valueNode: property.name, kind: 'shorthand', name: property.name }];
  }
  api.manual(property, `${operation} has a computed or accessor ${name} field; preserve its lifetime by hand`);
  return [];
}

function mappedEntryForOutput(api, owner, from, output) {
  for (let arity = 0; arity <= 5; arity++) {
    const entry = api.entryFor(owner, from, arity);
    if (entry && (entry.to === output || Object.values(entry.transformNames ?? {}).includes(output))) return entry;
  }
  return undefined;
}

function registrationsFromBag(ts, expression, api, operation) {
  if (!ts.isObjectLiteralExpression(expression)) {
    api.manual(expression, `${operation} receives a nonliteral registration bag; add withLifetime('scoped:one-per-container') to each provider in that bag`);
    return [];
  }
  return ownProperties(ts, expression, api, operation);
}

function providerForm(ts, expression, api, visited = new Set()) {
  let current = expression;
  while (ts.isParenthesizedExpression(current)) current = current.expression;
  if (ts.isArrowFunction(current) || ts.isFunctionExpression(current) || ts.isMethodDeclaration(current)) return 'factory';
  if (ts.isConditionalExpression(current)) {
    const left = providerForm(ts, current.whenTrue, api, new Set(visited));
    const right = providerForm(ts, current.whenFalse, api, new Set(visited));
    return left === right ? left : 'unknown';
  }
  if (ts.isAsExpression(current) || ts.isSatisfiesExpression(current)) {
    return providerForm(ts, current.expression, api, visited);
  }
  if (ts.isIdentifier(current)) {
    const symbol = ts.isShorthandPropertyAssignment(current.parent)
      ? api.checker.getShorthandAssignmentValueSymbol(current.parent)
      : api.checker.getSymbolAtLocation(current);
    if (!symbol || visited.has(symbol)) return 'unknown';
    visited.add(symbol);
    const declaration = symbol.valueDeclaration;
    if (!declaration || !ts.isVariableDeclaration(declaration) ||
        !declaration.initializer || !(declaration.parent.flags & ts.NodeFlags.Const)) return 'unknown';
    return providerForm(ts, declaration.initializer, api, visited);
  }
  if (!ts.isCallExpression(current)) return 'unknown';
  const selected = member(api, current);
  if (selected?.owner === 'DiBagApi' && selected.name === 'withLifetime') return 'explicit';
  if (selected?.owner === 'Provider' && selected.name === 'withLifetime') return 'explicit';
  if (selected?.owner === 'Provider' && ts.isPropertyAccessExpression(current.expression)) {
    const inner = providerForm(ts, current.expression.expression, api, visited);
    return inner === 'explicit' ? 'explicit' : inner === 'unknown' ? 'unknown' : 'provider';
  }
  if (selected?.owner === 'DiBagApi') {
    if (['fromFactory', 'fromSyncFactory', 'fromAsyncFactory', 'fromFunction', 'fromClass', 'fromPlugin'].includes(selected.name)) return 'provider';
    if (['withDisposal', 'withMetadata', 'transformService'].includes(selected.name) && current.arguments[0]) {
      const inner = providerForm(ts, current.arguments[0], api, visited);
      return inner === 'explicit' ? 'explicit' : inner === 'unknown' ? 'unknown' : 'provider';
    }
  }
  if (ts.isPropertyAccessExpression(current.expression)) {
    const coverage = api.library.memberCoverage(api.library.symbolAt(current.expression.name));
    if (!coverage.complete || coverage.members.length !== 1) return 'unknown';
    const [resolvedCurrent] = coverage.members;
    const currentName = current.expression.name.text;
    if (mappedOutputs(api, 'DiBagApi', 'withLifetime').has(currentName)) return 'explicit';
    const decoratorOutputs = new Set(['withDisposal', 'withMetadata', 'transformService']
      .flatMap(name => [...mappedOutputs(api, 'DiBagApi', name)]));
    if (decoratorOutputs.has(currentName)) {
      let inner;
      if (resolvedCurrent.owner === 'Provider') {
        inner = providerForm(ts, current.expression.expression, api, visited);
      } else {
        const entry = ['withDisposal', 'withMetadata', 'transformService']
          .map(from => mappedEntryForOutput(api, 'DiBagApi', from, currentName))
          .find(Boolean);
        const field = entry && emittedField(entry, 'provider', 0);
        const options = current.arguments[0];
        if (!field || !options || !ts.isObjectLiteralExpression(options)) return 'unknown';
        const property = propertyNamed(ts, options, field);
        if (!property) return 'unknown';
        const nested = ts.isPropertyAssignment(property) ? property.initializer
          : ts.isShorthandPropertyAssignment(property) ? property.name : undefined;
        if (!nested) return 'unknown';
        inner = providerForm(ts, nested, api, visited);
      }
      return inner === 'explicit' ? 'explicit' : inner === 'unknown' ? 'unknown' : 'provider';
    }
    const sourceOutputs = new Set(['fromFactory', 'fromSyncFactory', 'fromAsyncFactory', 'fromFunction', 'fromClass', 'fromPlugin']
      .flatMap(name => [...mappedOutputs(api, 'DiBagApi', name)]));
    if (sourceOutputs.has(currentName)) return 'provider';
  }
  return 'unknown';
}

function importedFacade(ts, sourceFile, api) {
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        if (api.library.exportNameOf(api.library.symbolAt(element.name)) === 'DiBag') return element.name.text;
      }
    }
    if (bindings && ts.isNamespaceImport(bindings)) {
      const moduleSymbol = api.checker.getSymbolAtLocation(statement.moduleSpecifier);
      const exported = moduleSymbol?.exports?.get('DiBag');
      if (exported && api.library.exportNameOf(exported) === 'DiBag') return `${bindings.name.text}.DiBag`;
    }
  }
  return undefined;
}

/**
 * Analyze the original source and return registration expressions that need scoped pins.
 * All symbol decisions use api.originalMember; rendering happens later through api.text.
 */
export function lifetimePinTargets(sourceFile, api) {
  const { ts } = api;
  const targets = new Map();
  const facade = importedFacade(ts, sourceFile, api);

  function add(entries) {
    for (const entry of entries) {
      const form = providerForm(ts, entry.valueNode ?? entry.node, api);
      if (form === 'explicit') continue;
      if (form === 'unknown') {
        api.manual(entry.node, `this provider's lifetime is not visible in the source file; preserve its 0.4 scoped behavior by hand`);
        continue;
      }
      targets.set(entry.node, { ...entry, form, facade });
    }
  }

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const selected = member(api, node);
      if (selected?.owner === 'Builder') {
        if (selected.name === 'register') {
          if (node.arguments.length === 1) add(registrationsFromBag(ts, node.arguments[0], api, 'register'));
          else if (node.arguments[1]) add([{ node: node.arguments[1] }]);
        } else if ((selected.name === 'contribute' || selected.name === 'replace') && node.arguments[1]) {
          add([{ node: node.arguments[1] }]);
        }
      } else if (selected?.owner === 'Bag' || selected?.owner === 'Container') {
        if ((selected.name === 'createScope' || selected.name === 'fork') && node.arguments[1]) {
          add(registrationsFromBag(ts, node.arguments[1], api, selected.name));
        }
      } else if (currentRoute(api, node, 'Builder', 'register', 1)) {
        add(registrationsFromBag(ts, node.arguments[0], api, 'withServices'));
      } else {
        const token = currentRoute(api, node, 'Builder', 'register', 2);
        const contribution = currentRoute(api, node, 'Builder', 'contribute', 2);
        const replacement = currentRoute(api, node, 'Builder', 'replace', 2);
        const child = currentRoute(api, node, 'Bag', 'createScope', 2);
        const independent = currentRoute(api, node, 'Bag', 'fork', 2);
        const singular = token ?? contribution ?? replacement;
        if (singular) {
          // S1 is positional; the preferred route and S2 use the emitted options bag.
          if (node.arguments[1]) add([{ node: node.arguments[1], valueNode: node.arguments[1], kind: 'value' }]);
          else if (node.arguments[0]) add(currentProviderField(ts, node.arguments[0], api, singular, singular.to, 'provider', 1, false));
        } else if (child || independent) {
          const route = child ?? independent;
          // S3 is positional; the preferred route uses replacementProviders in the options bag.
          if (node.arguments[1]) add(registrationsFromBag(ts, node.arguments[1], api, route.to));
          else if (node.arguments[0]) add(currentProviderField(ts, node.arguments[0], api, route, route.to, 'providers', 1, true));
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return targets;
}

export function renderLifetimePin(node, target, rendered, api) {
  const value = target.valueNode ?? node;
  const factoryText = target.kind === 'method'
    ? `${value.modifiers?.some(modifier => modifier.kind === api.ts.SyntaxKind.AsyncKeyword) ? 'async ' : ''}function${value.asteriskToken ? '*' : ''}${value.typeParameters?.length ? `<${value.typeParameters.map(parameter => api.text(parameter)).join(', ')}>` : ''}(${value.parameters.map(parameter => api.text(parameter)).join(', ')})${value.type ? `: ${api.text(value.type)}` : ''} ${api.text(value.body)}`
    : rendered;
  const withLifetime = api.nameOf('DiBagApi', 'withLifetime');
  let pinned;
  if (withLifetime !== 'withLifetime') {
    if (target.facade === undefined) {
      api.manual(node, `no resolved DiBag import is available to add providerWithLifetime; preserve scoped lifetime by hand`);
      return rendered;
    }
    pinned = `${target.facade}.${withLifetime}({ provider: ${factoryText}, lifetime: 'scoped:one-per-container' })`;
  } else {
    const providerText = target.form === 'factory'
      ? target.facade === undefined
        ? undefined
        : `${target.facade}.${api.nameOf('DiBagApi', 'fromFactory')}(${factoryText})`
      : rendered;
    if (providerText === undefined) {
      api.manual(node, `no resolved DiBag import is available to wrap this factory; create a provider and add withLifetime('scoped:one-per-container') by hand`);
      return rendered;
    }
    pinned = `(${providerText}).${withLifetime}('scoped:one-per-container')`;
  }
  return target.kind === 'shorthand' || target.kind === 'method'
    ? `${api.text(target.name)}: ${pinned}`
    : pinned;
}

export function hasOldCreateScope({ ts, sourceFiles, library, index }) {
  for (const sourceFile of sourceFiles) {
    let found = false;
    function visit(node) {
      if (found) return;
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const name = node.expression.name.text;
        const coverage = library.memberCoverage(library.symbolAt(node.expression.name));
        found = name === 'createScope' && coverage.complete && coverage.members.length === 1
          && index.methodFor(coverage.members[0].owner, name, node.arguments.length)?.owner === 'Bag';
      }
      if (!found) ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    if (found) return true;
  }
  return false;
}
```

`api.originalMember(call)` is a thin public view over the phase-1 selector and returns the real original declaration `{ owner, name, entry } | undefined`; it must not infer membership from spelling. `api.nameForRole` is phase 7's exact method-entry lookup. The hook analyzes original 0.4 calls before any renamed text exists; current names are output selected with `nameOf`/`nameForRole`, never fabricated selector inputs.

- [ ] **Step 6: Integrate pin rendering into the phase-2 engine with concrete APIs**

Add these imports at the top of `tools/codemod/lib/rewrite.mjs`:

```js
import { lifetimePinTargets, renderLifetimePin } from './transforms/lifetime-pin.mjs';
```

Extend `rewriteSourceFile`'s destructured argument with `pinLifetimes = false`. Replace the
phase-7 `transformApi` with this complete superset and add `originalMember` immediately before it:

```js
function originalMember(call) {
  const callee = call.expression;
  if (!ts.isPropertyAccessExpression(callee)) return undefined;
  const name = callee.name.text;
  const coverage = library.memberCoverage(library.symbolAt(callee.name));
  const candidates = [];
  for (const resolved of coverage.members) {
    const entry = index.methodFor(resolved.owner, name, call.arguments.length);
    if (entry) candidates.push({ ...resolved, name, entry });
  }
  if (!coverage.complete || candidates.length !== coverage.members.length || candidates.length !== 1) return undefined;
  return candidates[0];
}

function transformApi(member, entry) {
  return {
    ts, checker, program, sourceFile, library, member, text, slice, start, assemble,
    objectLiteral, quote, manual, originalMember, nameOf: index.nameOf,
    nameForRole(role) {
      const value = entry?.transformNames?.[role];
      if (value === undefined) {
        throw new Error(`transform ${entry?.transform ?? '<source-hook>'} has no name for role ${role}`);
      }
      return value;
    },
    entryFor: index.methodFor,
  };
}
```

Keep the phase-7 custom-transform call exactly
`transforms[entry.transform](call, transformApi(member, entry))`. The source hook calls
`originalMember` but never `nameForRole`: it targets original positional providers and bag values,
while the existing custom transforms retain their correctly bound phase-7 role lookup. Current
spellings are never assigned invented owners.

Replace phase 2's `text` function with this exact hook and declare the two variables beside
`skip`:

```js
const activeLifetimePins = new Set();
let lifetimeTargets = new Map();

function text(node) {
  const replaced = rewriteNode(node);
  let rendered = replaced === undefined ? assemble(node, []) : replaced;
  const target = lifetimeTargets.get(node);
  if (target !== undefined && !activeLifetimePins.has(node)) {
    activeLifetimePins.add(node);
    try {
      rendered = renderLifetimePin(node, target, rendered, transformApi(undefined, target.entry));
    } finally {
      activeLifetimePins.delete(node);
    }
  }
  if (replaced !== undefined || target !== undefined) rewrites++;
  return rendered;
}
```

Immediately before phase 2's `let result = assemble(sourceFile, []);`, initialize the map once:

```js
lifetimeTargets = pinLifetimes
  ? lifetimePinTargets(sourceFile, transformApi(undefined, undefined))
  : new Map();
```

The complete `renderLifetimePin(node, target, rendered, api)` body in Step 5 is final. Its
`withLifetime !== 'withLifetime'` branch is the phase-10 S2 facade fallback: it emits
`providerWithLifetime({ provider, lifetime })` through the resolved facade and current rename-map
target. The other branch emits the adopted provider method chain. Do not mechanically substitute
method syntax when phase-10 evidence selected the facade shape.

Replace `importedFacade` with symbol-based discovery so checked-out `../src`, package, aliased,
and namespace imports all work only when the compiler resolves them to this configured library:

```js
function importedFacade(ts, sourceFile, api) {
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        if (api.library.exportNameOf(api.library.symbolAt(element.name)) === 'DiBag') {
          return element.name.text;
        }
      }
    }
    if (bindings && ts.isNamespaceImport(bindings)) {
      const moduleSymbol = api.checker.getSymbolAtLocation(statement.moduleSpecifier);
      const exported = moduleSymbol?.exports?.get('DiBag');
      if (exported && api.library.exportNameOf(exported) === 'DiBag') {
        return `${bindings.name.text}.DiBag`;
      }
    }
  }
  return undefined;
}
```

Call it as `importedFacade(ts, sourceFile, api)`. Classification returns one of
`'explicit' | 'provider' | 'factory' | 'unknown'`, follows local `const` aliases with a symbol
cycle set, treats old provider-source/decorator calls as providers, preserves an explicit
`withLifetime` through provider wrappers, and reports imported aliases, mutable bindings,
conditionals with unequal forms, opaque calls, and unresolved wrappers as manual. Store that result
as `target.form`; skip `'explicit'`, report `'unknown'`, and pin the other two. This is the required
safe fallback for syntax the transform cannot prove. Add direct unit cases for every form.

In `tools/codemod/lib/codemod.mjs`, import `hasOldCreateScope`, add `pinLifetimes = false` to
`runCodemod`, build the exact non-library candidate list once, and compute/pass policy as follows:

```js
const analysisFiles = built.getSourceFiles().filter(sourceFile => {
  const fileName = resolve(sourceFile.fileName);
  return !sourceFile.isDeclarationFile
    && !fileName.includes('/node_modules/')
    && !library.isLibraryFile(fileName);
});
const outputFiles = analysisFiles.filter(sourceFile =>
  !selected || selected.has(resolve(sourceFile.fileName)),
);
const shouldPinLifetimes = pinLifetimes || hasOldCreateScope({
  ts, sourceFiles: analysisFiles, library, index,
});

for (const sourceFile of outputFiles) {
  const fileName = resolve(sourceFile.fileName);
  const fileLabel = relative(root, fileName).replaceAll('\\', '/');
  const result = rewriteSourceFile({
    ts, checker, program: built, sourceFile, library, index, transforms,
    manualItems: manual, fileLabel, pinLifetimes: shouldPinLifetimes,
  });
  if (result.text === sourceFile.text) continue;
  changed.push({ file: fileLabel, rewrites: result.rewrites, text: result.text });
  rewrites += result.rewrites;
  if (write) writeFileSync(fileName, result.text);
}
```

Implement `hasOldCreateScope` without a transform API:

```js
export function hasOldCreateScope({ ts, sourceFiles, library, index }) {
  for (const sourceFile of sourceFiles) {
    let found = false;
    function visit(node) {
      if (found) return;
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const name = node.expression.name.text;
        const coverage = library.memberCoverage(library.symbolAt(node.expression.name));
        found = name === 'createScope' && coverage.complete && coverage.members.length === 1
          && index.methodFor(coverage.members[0].owner, name, node.arguments.length)?.owner === 'Bag';
      }
      if (!found) ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    if (found) return true;
  }
  return false;
}
```

In the CLI parser's existing switch, add a zero-argument `--pin-lifetimes` case that rejects an
attached `=value`, sets `options.pinLifetimes = true`, and passes it to `runCodemod`. Add the flag
to the exact usage line. Import/export the two source-hook helpers from `transforms/index.mjs`
without adding `lifetime-pin` to the method-transform registry or id assertions.

- [ ] **Step 7: Prove exact composition, manual rows, aliases, and default policy**

Add `'lifetime-pin'` to the existing fixture-name array in `fixtures.test.mjs`. Append this test to
`transforms.test.mjs`, which already imports `runCodemod`, `compiler`, `fixturesProgram`,
`fixtureProgram`, and `fixturesRoot`. First modify `tools/codemod/test/helpers.mjs` so an ordinary
fixture is analyzed in isolation, while the dedicated policy test can still request the complete
program:

```js
const isolatedFixturePrograms = new Map();
let isolatedFixtureOptions;

function fixtureOptions() {
  if (isolatedFixtureOptions) return isolatedFixtureOptions;
  const config = compiler.ts.getParsedCommandLineOfConfigFile(join(fixturesRoot, 'tsconfig.json'), {}, {
    ...compiler.ts.sys,
    onUnRecoverableConfigFileDiagnostic: diagnostic => {
      throw new Error(compiler.ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    },
  });
  isolatedFixtureOptions = { ...config.options, noEmit: true };
  return isolatedFixtureOptions;
}

export function fixtureProgram(name) {
  let program = isolatedFixturePrograms.get(name);
  if (program) return program;
  const input = join(fixturesRoot, name, 'input.ts');
  program = compiler.ts.createProgram([input], fixtureOptions());
  isolatedFixturePrograms.set(name, program);
  return program;
}
```

Keep `fixturesProgram()` as the existing all-fixtures program for the one whole-program test.
Change the existing `runFixture(name)` helper to pass `program: fixtureProgram(name)`. This prevents
the authenticated `createScope` in `lifetime-pin` from enabling pins in unrelated fixture goldens;
the production implementation still analyzes every source in the supplied project.

```js
test('lifetime pins compose with provider, role, alias, and container transforms', () => {
  const result = runCodemod({
    typescript: compiler.ts,
    root: fixturesRoot,
    program: fixtureProgram('lifetime-pin'),
    only: ['lifetime-pin/input.ts'],
    pinLifetimes: true,
  });
  assert.equal(result.files.length, 1);
  const text = result.files[0].text;
  assert.match(text, /ContainerKit\.createProvider\(clock\)\.withLifetime\('scoped:one-per-container'\)/);
  assert.match(text, /decorated: \(decorated\)\.withLifetime\('scoped:one-per-container'\)/);
  assert.match(text, /withTokenService\(item, ContainerKit\.createProvider/);
  assert.match(text, /withCollectionContribution\(\{ collectionToken: items, provider: ContainerKit\.createProvider/);
  assert.match(text, /withReplacedService\(items, ContainerKit\.createProvider/);
  assert.match(text, /Library\.DiBag\.createBuilder\(\)\.withServices\(\{ ns: \(ContainerKit\.createProvider/);
  assert.match(text, /unrelated\.createScope\(\)/);
  assert.deepEqual(result.manual.map(item => item.reason), [
    "register receives a nonliteral registration bag; add withLifetime('scoped:one-per-container') to each provider in that bag",
    "register contains a spread registration; add withLifetime('scoped:one-per-container') to each provider contributed by that spread",
  ]);
});
```

Add `mkdirSync`, `mkdtempSync`, `writeFileSync`, and `rmSync` from `node:fs`, `tmpdir` from `node:os`, and `join`
from `node:path`; import `defaultMapFile` beside `runCodemod`. Append this independent shape test. Its synthetic authenticated declarations
expose both preferred and positional overloads, so production tests never depend on a temporary
decision record. The normal `current-lifetime-pin` fixture above still uses only the signatures
actually adopted by phases 5, 6, and 10.

```js
test('current lifetime pins accept preferred and measured-fallback arities', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'di-bag-lifetime-shapes-'));
  const library = join(scratch, 'library');
  mkdirSync(library);
  writeFileSync(join(library, 'index.ts'), `
export class Provider { withLifetime(_l: string): Provider { return this; } }
export class Container {
  createChildContainer(_options?: unknown, _providers?: unknown): Container { return this; }
  createIndependentContainer(_options?: unknown, _providers?: unknown): Container { return this; }
}
export class Builder {
  withTokenService(_optionsOrToken: unknown, _provider?: unknown): this { return this; }
  withCollectionContribution(_optionsOrToken: unknown, _provider?: unknown): this { return this; }
  withReplacedService(_optionsOrKey: unknown, _provider?: unknown): this { return this; }
  buildContainer(): Container { return new Container(); }
}
export class DiBag {
  static createProvider(_factory: unknown): Provider { return new Provider(); }
  static createBuilder(): Builder { return new Builder(); }
}
`);
  const input = join(scratch, 'input.ts');
  writeFileSync(input, `
import { DiBag } from './library/index.js';
const provider = () => 1;
const token = Symbol('token');
const options = { token, provider };
const container = DiBag.createBuilder()
  .withTokenService({ token, provider })
  .withTokenService(token, () => 2)
  .withCollectionContribution({ collectionToken: token, provider: () => 3 })
  .withCollectionContribution(token, () => 4)
  .withReplacedService({ serviceKey: token, provider: () => 5 })
  .withReplacedService(token, () => 6)
  .withTokenService({ ...options })
  .buildContainer();
container.createChildContainer({ replacedServiceKeys: ['a'], replacementProviders: { a: () => 7 } });
container.createChildContainer(['a'], { a: () => 8 });
container.createIndependentContainer({ replacedServiceKeys: ['a'], replacementProviders: { a: () => 9 } });
container.createIndependentContainer(['a'], { a: () => 10 });
`);
  const program = compiler.ts.createProgram([input], {
    strict: true, noEmit: true, skipLibCheck: true, types: [],
    target: compiler.ts.ScriptTarget.ES2022,
    module: compiler.ts.ModuleKind.NodeNext,
    moduleResolution: compiler.ts.ModuleResolutionKind.NodeNext,
  });
  const preferredMap = JSON.parse(readFileSync(defaultMapFile, 'utf8'));
  const preferredEntries = [
    { owner: 'Builder', from: 'register', to: 'withTokenService', arity: [2], arguments: { kind: 'bag', names: ['token', 'provider'] } },
    { owner: 'Builder', from: 'contribute', to: 'withCollectionContribution', arguments: { kind: 'bag', names: ['collectionToken', 'provider'] } },
    { owner: 'Builder', from: 'replace', to: 'withReplacedService', arguments: { kind: 'bag', names: ['serviceKey', 'provider'] } },
    { owner: 'Bag', from: 'createScope', to: 'createChildContainer', arity: [0, 1, 2, 3], transform: 'container-derivation', transformNames: { keys: 'replacedServiceKeys', providers: 'replacementProviders', sharing: 'sharedParentServiceKeys' } },
    { owner: 'Bag', from: 'fork', to: 'createIndependentContainer', arity: [0, 1, 2], transform: 'container-derivation', transformNames: { keys: 'replacedServiceKeys', providers: 'replacementProviders' } },
    { owner: 'DiBagApi', from: 'withLifetime', to: 'withLifetime' },
    { owner: 'DiBagApi', from: 'fromFactory', to: 'createProvider' },
  ];
  for (const preferred of preferredEntries) {
    preferredMap.methods = preferredMap.methods.filter(entry =>
      !(entry.owner === preferred.owner && entry.from === preferred.from),
    );
    preferredMap.methods.push(preferred);
  }
  const result = runCodemod({
    typescript: compiler.ts, root: scratch, program,
    libraryRoots: ['library'], only: ['input.ts'], pinLifetimes: true, map: preferredMap,
  });
  assert.equal(result.files.length, 1);
  const pinned = result.files[0].text;
  assert.equal((pinned.match(/scoped:one-per-container/g) ?? []).length, 10);
  assert.match(pinned, /provider: .*scoped:one-per-container/);
  assert.match(pinned, /withTokenService\(token, .*scoped:one-per-container/);
  assert.match(pinned, /createChildContainer\(\['a'\], \{ a: .*scoped:one-per-container/);
  assert.match(pinned, /createIndependentContainer\(\['a'\], \{ a: .*scoped:one-per-container/);
  assert.deepEqual(result.manual.map(item => item.reason), [
    'withTokenService options contain a spread; preserve provider lifetimes in the spread source by hand',
  ]);
  rmSync(scratch, { recursive: true, force: true });
});
```

For the S2 provider-facade row, add an authenticated current source containing:

```ts
const explicit = Alias.providerWithLifetime({ provider: () => 1, lifetime: 'singleton:one-per-container-tree' });
const decorated = Alias.providerWithDisposal({ provider: explicit, disposeService: () => {} });
Alias.createBuilder().withServices({ decorated });
```

Its exact output is unchanged. This proves facade decorators recurse through their map-recorded
`provider` field and do not overwrite a nested explicit singleton. Add the analogous preferred
provider-method chain row when S2 was not selected.

Create `tools/codemod/test/fixtures/whole-program-pin/source.ts`. The non-`input.ts` name keeps it
out of the fixture-golden enumerator while the all-fixtures compiler program still includes it:

```ts
import { DiBag } from 'di-bag';
export const container = DiBag.createBuilder().register({ value: () => 1 }).build();
```

Append this test; `fixturesProgram()` also contains the lifetime-pin source with an authenticated
old `createScope`, while `only` excludes it from output:

```js
test('whole-program policy analyzes files outside the output selection', () => {
  const result = runCodemod({
    typescript: compiler.ts,
    root: fixturesRoot,
    program: fixturesProgram(),
    only: ['whole-program-pin/source.ts'],
  });
  assert.match(result.files[0].text, /(withLifetime\('scoped:one-per-container'\)|providerWithLifetime\(\{)/);
});
```

Append this focused boundary test. It uses the scratch imports already added for the shape test
above. Add `import { createLibrary } from '../lib/library.mjs';` beside the existing codemod imports.
A mixed `Bag | UserBag` receiver must not enable project-wide pinning; a mixed current-name
builder receiver must not acquire a pin; a pure user `withServices` lookalike remains silent; and a
mixed current provider method remains unchanged with manual guidance when pinning is explicitly
requested.

```js
test('mixed library and user receivers do not authorize lifetime pins', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'di-bag-lifetime-coverage-'));
  const library = join(scratch, 'library');
  mkdirSync(library);
  writeFileSync(join(library, 'index.ts'), `
export class Provider {
  readonly providerKind = 'library-provider' as const;
  withLifetime(_lifetime: string): Provider { return this; }
}
export class Bag {
  readonly bagKind = 'library-bag' as const;
  createScope(): Bag { return this; }
}
export class Builder {
  readonly builderKind = 'library-builder' as const;
  register(_services: unknown): this { return this; }
  withServices(_services: unknown): this { return this; }
  build(): Bag { return new Bag(); }
}
export class DiBag {
  static createBuilder(): Builder { return new Builder(); }
}
`);
  const input = join(scratch, 'input.ts');
  writeFileSync(input, `
import { Bag, DiBag, Provider } from './library/index.js';
declare const chooseUser: boolean;
class UserBag {
  readonly bagKind = 'user-bag' as const;
  createScope(): UserBag { return this; }
}
class UserBuilder {
  readonly builderKind = 'user-builder' as const;
  withServices(_services: unknown): this { return this; }
}
class UserProvider {
  readonly providerKind = 'user-provider' as const;
  withLifetime(_lifetime: string): UserProvider { return this; }
}
const mixedBag = chooseUser ? new Bag() : new UserBag();
const mixedBuilder = chooseUser ? DiBag.createBuilder() : new UserBuilder();
const mixedProvider = chooseUser ? new Provider() : new UserProvider();
mixedBag.createScope();
mixedBuilder.withServices({ current: () => 1 });
new UserBuilder().withServices({ userOnly: () => 2 });
DiBag.createBuilder().register({
  plain: () => 3,
  current: mixedProvider.withLifetime('root'),
}).build();
`);
  const program = compiler.ts.createProgram([input], {
    strict: true, noEmit: true, skipLibCheck: true, types: [],
    target: compiler.ts.ScriptTarget.ES2022,
    module: compiler.ts.ModuleKind.NodeNext,
    moduleResolution: compiler.ts.ModuleResolutionKind.NodeNext,
  });
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(input);
  assert.ok(sourceFile, 'coverage fixture source must belong to the program');
  const libraryApi = createLibrary({
    ts: compiler.ts, checker, root: scratch, libraryRoots: ['library'],
  });
  const mixedCoverage = new Map();
  function inspectCoverage(node) {
    if (compiler.ts.isCallExpression(node) && compiler.ts.isPropertyAccessExpression(node.expression)
        && compiler.ts.isIdentifier(node.expression.expression)) {
      const receiver = node.expression.expression.text;
      if (['mixedBag', 'mixedBuilder', 'mixedProvider'].includes(receiver)) {
        mixedCoverage.set(receiver, libraryApi.memberCoverage(libraryApi.symbolAt(node.expression.name)));
      }
    }
    compiler.ts.forEachChild(node, inspectCoverage);
  }
  inspectCoverage(sourceFile);
  for (const receiver of ['mixedBag', 'mixedBuilder', 'mixedProvider']) {
    const coverage = mixedCoverage.get(receiver);
    assert.ok(coverage?.members.length > 0, `${receiver} must retain its DI Bag declaration`);
    assert.equal(coverage.complete, false, `${receiver} must also retain its user declaration`);
  }
  const automatic = runCodemod({
    typescript: compiler.ts, root: scratch, program,
    libraryRoots: ['library'], only: ['input.ts'],
  });
  assert.doesNotMatch(automatic.files[0].text, /scoped:one-per-container/);
  assert.ok(automatic.manual.some(item => item.reason ===
    'createScope resolves to both DI Bag and non-library declarations; migrate this use by hand'));
  assert.ok(!automatic.manual.some(item => item.text.includes('userOnly')),
    'a pure user lookalike must not produce a DI Bag migration report');

  const explicit = runCodemod({
    typescript: compiler.ts, root: scratch, program,
    libraryRoots: ['library'], only: ['input.ts'], pinLifetimes: true,
  });
  assert.match(explicit.files[0].text, /plain: .*scoped:one-per-container/);
  assert.match(explicit.files[0].text, /current: mixedProvider\.withLifetime\('root'\)/);
  assert.ok(explicit.manual.some(item => item.reason ===
    'withServices resolves to both DI Bag and non-library declarations; preserve provider lifetimes by hand'));
  assert.ok(explicit.manual.some(item => item.reason ===
    "this provider's lifetime is not visible in the source file; preserve its 0.4 scoped behavior by hand"));
  assert.ok(!explicit.manual.some(item => item.text.includes('userOnly')),
    'explicit pinning must also ignore a pure user lookalike');
  rmSync(scratch, { recursive: true, force: true });
});
```

For S2 fallback, `expected.ts` keeps the same imports/token/build chain and replaces the two
provider values with
`Alias.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' })` and
`Alias.providerWithLifetime({ provider: () => 2, lifetime: 'scoped:one-per-container' })`.
This sentence applies to `tools/codemod/test/current-lifetime-pin/expected.ts`; select that complete
two-value substitution before creating the file. Do not retain provider-method syntax when the
phase-10 evidence selected S2.

Create `tools/codemod/test/current-lifetime-pin/input.ts` and `expected.ts`:

`input.ts`:

```ts
import { DiBag as Alias } from '../../../../src/index.js';
const token = Alias.createToken(Symbol('value')).forService<number>();
export const container = Alias.createBuilder()
  .withServices({ named: () => 1 })
  .withTokenService(token, () => 2)
  .buildContainer();
```

`expected.ts`:

```ts
import { DiBag as Alias } from '../../../../src/index.js';
const token = Alias.createToken(Symbol('value')).forService<number>();
export const container = Alias.createBuilder()
  .withServices({ named: (Alias.createProvider(() => 1)).withLifetime('scoped:one-per-container') })
  .withTokenService(token, (Alias.createProvider(() => 2)).withLifetime('scoped:one-per-container'))
  .buildContainer();
```

Add `resolve` to the existing `node:path` import and append:

```js
test('explicit lifetime pin recognizes authenticated current phase-10 calls', () => {
  const projectRoot = resolve(import.meta.dirname, '../../..');
  const input = resolve(import.meta.dirname, 'current-lifetime-pin/input.ts');
  const program = compiler.ts.createProgram([input], {
    strict: true, noEmit: true, skipLibCheck: true, types: [],
    target: compiler.ts.ScriptTarget.ES2022,
    module: compiler.ts.ModuleKind.NodeNext,
    moduleResolution: compiler.ts.ModuleResolutionKind.NodeNext,
  });
  const source = program.getSourceFile(input);
  const importDeclaration = source.statements.find(compiler.ts.isImportDeclaration);
  const importSpecifier = importDeclaration.importClause.namedBindings.elements[0];
  const local = program.getTypeChecker().getSymbolAtLocation(importSpecifier.name);
  const exported = program.getTypeChecker().getAliasedSymbol(local);
  assert.ok(exported.declarations?.some(declaration =>
    resolve(declaration.getSourceFile().fileName).startsWith(resolve(projectRoot, 'src')),
  ), 'fixture must resolve Alias to this checkout, not a package or ambient declaration');
  const result = runCodemod({
    typescript: compiler.ts,
    root: projectRoot,
    program,
    libraryRoots: ['src'],
    only: ['tools/codemod/test/current-lifetime-pin/input.ts'],
    pinLifetimes: true,
  });
  assert.equal(result.files.length, 1);
  assert.ok(result.files[0].rewrites > 0, 'authenticated current calls must produce rewrites');
  assert.equal(result.files[0].text, readFileSync(resolve(import.meta.dirname, 'current-lifetime-pin/expected.ts'), 'utf8'));
});
```

Phase 5 selected the positional `withReplacedService(serviceKey, provider)` fallback. The paired bag and
positional calls and the custom `replace` bag-map entry in the isolated preferred-map fixture above are deliberate
bilingual transform controls; preserve them rather than treating the bag spelling as current API.

For S2 fallback, replace the first five `assert.match` lines with assertions for
`ContainerKit.providerWithLifetime({ provider: clock`,
`decorated: ContainerKit.providerWithLifetime({ provider: decorated`,
`withTokenService(item, ContainerKit.providerWithLifetime`,
`withCollectionContribution({ collectionToken: items, provider: ContainerKit.providerWithLifetime`,
and `withReplacedService(items, ContainerKit.providerWithLifetime`.
The unrelated-call and literal manual-row assertions are identical.

The aliased `ContainerKit` and namespace `Library.DiBag` rows prove both builder receiver forms.
Factory insertion deliberately uses the first authenticated `DiBag` import in source order, so
both namespace rows use `ContainerKit` in the golden. Assert that deterministic rule directly;
it avoids changing factory spelling according to the registration site's receiver. Append this
separate CLI test so the golden keeps exactly its two required manual rows:

```js
test('opaque, mutable, and mixed provider expressions are manual', () => {
  const project = copyOf('fixtures');
  const input = join(project, 'lifetime-pin/input.ts');
  writeFileSync(input, `${readFileSync(input, 'utf8')}
const stable = () => 0;
let mutableLet = () => 1;
var mutableVar = () => 2;
declare const opaqueProvider: unknown;
ContainerKit.createBuilder().register({
  stable,
  mutableLet,
  mutableVar,
  opaqueProvider,
  mixed: true ? () => 1 : ContainerKit.withLifetime(() => 2, 'root'),
});
`);
  const result = run(project, 'lifetime-pin/input.ts', '--pin-lifetimes', '--write');
  assert.equal(result.status, 0, result.stderr);
  assert.equal((result.stdout.match(/this provider's lifetime is not visible in the source file/g) ?? []).length, 4);
  const written = readFileSync(input, 'utf8');
  assert.match(written, /stable: .*(withLifetime\('scoped:one-per-container'\)|providerWithLifetime\(\{ provider: stable, lifetime: 'scoped:one-per-container' \}\))/);
  assert.match(written, /\n  mutableLet,\n  mutableVar,\n  opaqueProvider,/);
  rmSync(project, { recursive: true, force: true });
});
```

The `stable` assertion preserves the accepted `const` alias path. The four literal manual rows are
`mutableLet`, `mutableVar`, `opaqueProvider`, and `mixed`; both `let` and `var` therefore remain
unchanged instead of being mistaken for stable aliases.

The CLI no-old-scope test leaves `unrelated.createScope()` in the source, so its zero-pin assertion
proves a same-named user method does not auto-enable the hook.

Run:

```bash
node --test tools/codemod/test/fixtures.test.mjs tools/codemod/test/transforms.test.mjs tools/codemod/test/rename-map.test.mjs tools/codemod/test/cli.test.mjs
```

Expected: all pass; the golden is byte-for-byte exact; `expected-manual.json` deep-equals the two literal rows; the aliased facade is preserved; an unrelated `.createScope()` neither enables nor changes anything.

- [ ] **Step 8: Commit the green codemod feature**

```bash
git add -- tools/codemod/cli.mjs tools/codemod/lib/codemod.mjs tools/codemod/lib/rewrite.mjs tools/codemod/lib/transforms/index.mjs tools/codemod/lib/transforms/lifetime-pin.mjs tools/codemod/test/helpers.mjs tools/codemod/test/fixtures/lifetime-pin tools/codemod/test/fixtures/whole-program-pin tools/codemod/test/current-lifetime-pin tools/codemod/test/fixtures.test.mjs tools/codemod/test/cli.test.mjs tools/codemod/test/transforms.test.mjs tools/codemod/test/rename-map.test.mjs
git commit -F - <<'MSG'
feat(codemod): pin pre-0.5 provider lifetimes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
git rev-parse HEAD > /tmp/di-bag-phase-10-lifetime-pin-commit
```

---

### Task 4: Migrate repository semantics and record the decision

**Files:**
- Modify: the exact test files listed below
- Modify: `examples/scopes.ts`, `AGENTS.md`, `docs/agent/recipes.md`
- Create: `docs/adr/0001-singleton-by-default.md`

**Interfaces:**
- Consumes: Task 3's explicit `--pin-lifetimes` mode and Task 1's focused new-default tests.
- Produces: preserved legacy test intent, explicit request-scoped examples, and the durable architectural decision required by the spec.

- [ ] **Step 1: Pin only tests whose meaning depends on the 0.4.0 scoped default**

The following files either create a child container or assert singleton-capture behavior. Pin every syntactically visible registration and replacement in them; leave all other existing test files unmarked so single-container tests exercise the default naturally:

```text
tests/acquisition-cleanup.test.ts
tests/acquisition-metadata.test.ts
tests/acquisition-mode.test.ts
tests/aliases-runtime-fixture.ts
tests/aliases.test.ts
tests/api-renaming.test.ts
tests/benchmarks/runtime-scenarios.ts
tests/composition-adapters-runtime-fixture.ts
tests/composition-adapters.test.ts
tests/contributions-runtime-fixture.ts
tests/contributions.test.ts
tests/dependency-references-runtime-fixture.ts
tests/dependency-references.test.ts
tests/enterprise-integration.test.ts
tests/final-adversarial-runtime-fixture.ts
tests/inspect-graph.test.ts
tests/lifetimes.test.ts
tests/native-package.test.ts
tests/nested-modules.test.ts
tests/observers-runtime-fixture.ts
tests/observers.test.ts
tests/package.test.ts
tests/platform/portable/contract.ts
tests/plugins-runtime-fixture.ts
tests/plugins.test.ts
tests/portable-factories.test.ts
tests/runtime-diagnostics.test.ts
tests/scopes.test.ts
tests/selected-scope-runtime-fixture.ts
tests/selected-scope-runtime.test.ts
tests/selected-scopes.test.ts
tests/startup-runtime-fixture.ts
tests/startup.test.ts
tests/types/aliases-consumer.ts
tests/types/aliases.ts
tests/types/contributions-consumer.ts
tests/types/contributions.ts
tests/types/dependency-references.ts
tests/types/final-adversarial-integration.ts
tests/types/lifetimes.ts
tests/types/negative/aliases.ts
tests/types/negative/contributions.ts
tests/types/negative/dependency-references.ts
tests/types/negative/diagnostic-names.ts
tests/types/negative/final-adversarial-integration.ts
tests/types/negative/lifetimes.ts
tests/types/negative/module-erasure.ts
tests/types/negative/nested-modules.ts
tests/types/negative/plugins.ts
tests/types/negative/scopes.ts
tests/types/negative/selected-scopes.ts
tests/types/negative/startup.ts
tests/types/negative/verify-graph.ts
tests/types/observers.ts
tests/types/scopes.ts
tests/types/selected-scopes.ts
tests/types/startup-consumer.ts
tests/types/startup.ts
```

Create a temporary narrow project without touching a tracked file:

```bash
node - <<'NODE'
const { writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const files = `
tests/acquisition-cleanup.test.ts
tests/acquisition-metadata.test.ts
tests/acquisition-mode.test.ts
tests/aliases-runtime-fixture.ts
tests/aliases.test.ts
tests/api-renaming.test.ts
tests/benchmarks/runtime-scenarios.ts
tests/composition-adapters-runtime-fixture.ts
tests/composition-adapters.test.ts
tests/contributions-runtime-fixture.ts
tests/contributions.test.ts
tests/dependency-references-runtime-fixture.ts
tests/dependency-references.test.ts
tests/enterprise-integration.test.ts
tests/final-adversarial-runtime-fixture.ts
tests/inspect-graph.test.ts
tests/lifetimes.test.ts
tests/native-package.test.ts
tests/nested-modules.test.ts
tests/observers-runtime-fixture.ts
tests/observers.test.ts
tests/package.test.ts
tests/platform/portable/contract.ts
tests/plugins-runtime-fixture.ts
tests/plugins.test.ts
tests/portable-factories.test.ts
tests/runtime-diagnostics.test.ts
tests/scopes.test.ts
tests/selected-scope-runtime-fixture.ts
tests/selected-scope-runtime.test.ts
tests/selected-scopes.test.ts
tests/startup-runtime-fixture.ts
tests/startup.test.ts
tests/types/aliases-consumer.ts
tests/types/aliases.ts
tests/types/contributions-consumer.ts
tests/types/contributions.ts
tests/types/dependency-references.ts
tests/types/final-adversarial-integration.ts
tests/types/lifetimes.ts
tests/types/negative/aliases.ts
tests/types/negative/contributions.ts
tests/types/negative/dependency-references.ts
tests/types/negative/diagnostic-names.ts
tests/types/negative/final-adversarial-integration.ts
tests/types/negative/lifetimes.ts
tests/types/negative/module-erasure.ts
tests/types/negative/nested-modules.ts
tests/types/negative/plugins.ts
tests/types/negative/scopes.ts
tests/types/negative/selected-scopes.ts
tests/types/negative/startup.ts
tests/types/negative/verify-graph.ts
tests/types/observers.ts
tests/types/scopes.ts
tests/types/selected-scopes.ts
tests/types/startup-consumer.ts
tests/types/startup.ts
`.trim().split('\n').map(file => resolve(file));
writeFileSync('/tmp/di-bag-phase-10-pin.json', `${JSON.stringify({
  extends: resolve('tsconfig.json'),
  include: [],
  exclude: [],
  files,
}, null, 2)}\n`);
NODE
node tools/codemod/cli.mjs --project /tmp/di-bag-phase-10-pin.json --library-root src --pin-lifetimes --write --report /tmp/di-bag-phase-10-pin-report.json
```

Expected: exit 0. Review `/tmp/di-bag-phase-10-pin-report.json`; every manual row must be resolved in its named test before continuing. No file outside the list and its imported local fixture modules changes. Delete the temporary config after review.

The explicit empty `include`/`exclude` arrays prevent the root project's inherited globs from
adding `tests/singleton-default*`; TypeScript still follows imports for checking, while the codemod
rewrites only the root `files` selected by the project plus explicitly requested extra files.

The codemod must preserve explicit singleton, scoped, and transient policies. It pins replacement providers as well as builder registrations. If it pins a value already made explicit by a phase-9 provider chain, that is a bug in Task 3; fix the transform rather than hand-editing the duplicate.

Run the same pin hook over the agent-eval tests whose assertions compare services across child containers. Use another temporary `files` project containing exactly:

```text
scripts/agent-eval/hidden/tests/catalog.test.ts
scripts/agent-eval/hidden/tests/checkout.test.ts
scripts/agent-eval/hidden/tests/inventory.test.ts
scripts/agent-eval/hidden/tests/notifications.test.ts
scripts/agent-eval/reference/catalog/catalog.test.ts
scripts/agent-eval/reference/checkout/checkout.test.ts
scripts/agent-eval/reference/inventory/inventory.test.ts
scripts/agent-eval/reference/notifications/notifications.test.ts
```

Generate `/tmp/di-bag-phase-10-agent-eval-pin.json` with the same Node script shape and these eight absolute paths, then run:

```bash
node tools/codemod/cli.mjs --project /tmp/di-bag-phase-10-agent-eval-pin.json --library-root src --pin-lifetimes --write --report /tmp/di-bag-phase-10-agent-eval-pin-report.json
```

Resolve every literal manual row. Do not pin the task prose or explicit singleton providers in reference/check files. The hidden tests remain behavioral oracles; their cross-child equal/not-equal assertions must keep the same meaning after this migration.

- [ ] **Step 1b: Verify and commit only the mechanical lifetime pins**

Run `npm run test:fast`. Obtain an explicit heavy-hold lift and controller-held slot for `npm run typecheck`, report it,
and release the slot. Both must pass on the still-scoped-default tree. Stage exactly the files named
by the two codemod reports:

```bash
node - <<'NODE'
const { readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const files = ['/tmp/di-bag-phase-10-pin-report.json', '/tmp/di-bag-phase-10-agent-eval-pin-report.json']
  .flatMap(file => JSON.parse(readFileSync(file, 'utf8')).files.map(entry => entry.file));
const result = spawnSync('git', ['add', '--', ...new Set(files)], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
NODE
git diff --cached --name-only
git commit -F - <<'MSG'
refactor!: pin pre-0.5 scoped lifetime semantics

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
git rev-parse HEAD > /tmp/di-bag-phase-10-mechanical-pin-commit
```

Expected: the staged list is a subset of the explicit Step-1 test/agent-eval inventory, with no
focused singleton-default file, product source, prose, or generated artifact.

- [ ] **Step 2: Deliberately retain the focused new-default coverage**

Do not pin `tests/singleton-default.test.ts`, `tests/types/singleton-default.ts`, or `tests/types/negative/singleton-default.ts`. They are the focused set required by the spec and cover:

1. an unmarked provider shared by root, child, and sibling;
2. an unmarked consumer rejected when it reaches an explicit scoped provider;
3. child rejection for inherited string-key and token-key singletons;
4. allowed scoped/transient child replacement;
5. allowed independent singleton replacement;
6. a replacement singleton anchored to its introducing child;
7. the dependency-free request-state silent gap as expected behavior;
8. a renamed module requirement retaining the singleton reach obligation.

Run the focused runtime test after migration:

```bash
bun test tests/singleton-default.test.ts
```

Expected: `6 pass`, `0 fail`.

- [ ] **Step 3: Update the shipped scope example and request recipe explicitly**

In `examples/scopes.ts`, wrap the root `config` registration that is replaced in a child:

```ts
const providers = {
  config: DiBag.createProvider(() => ({ region: 'eu' }))
    .withLifetime('scoped:one-per-container'),
};
```

Do not change the example to `createIndependentContainer`; it demonstrates a child container and should teach the replacement rule.

In `docs/agent/recipes.md` under `#add-scoped-service`, make both the request context and every provider that captures it explicit:

```ts
const app = DiBag.createBuilder().withServices({
  request: DiBag.createProvider((): RequestContext => ({ requestId: 'outside-request' }))
    .withLifetime('scoped:one-per-container'),
  handler: DiBag.createProvider(
    ({ request }: { request: RequestContext }) => createHandler(request),
  ).withLifetime('scoped:one-per-container'),
}).buildContainer();
```

The child replacement remains:

```ts
const requestContainer = app.createChildContainer({
  replacedServiceKeys: ['request'],
  replacementProviders: { request: (): RequestContext => ({ requestId }) },
});
try {
  await requestContainer.resolve('handler').run();
} finally {
  await requestContainer.close();
  await app.close();
}
```

- [ ] **Step 4: Rewrite AGENTS.md rule 3 within its existing line budget**

Replace rule 3, without adding lines, with:

```md
3. **Lifetimes.** The default is `'singleton:one-per-container-tree'`. Mark
   request state and every consumer that captures it `'scoped:one-per-container'`;
   otherwise the compiler reports the capture. A child may replace only scoped or
   transient services; use `createIndependentContainer` to replace a singleton.
```

Run: `wc -l AGENTS.md`

Expected: 150 or fewer.

- [ ] **Step 5: Create the complete ADR**

Create `docs/adr/0001-singleton-by-default.md` exactly:

```md
---
status: accepted
---

# Default providers to one singleton per container tree

Most DI Bag services are stateless application services, repositories, or clients, so an
unmarked provider now creates one service for a root container and all of its child
containers. Per-request state and every consumer that captures it are marked
`'scoped:one-per-container'`; transient providers remain explicit. This makes the common
case terse while keeping request boundaries visible at the provider that owns them.

Two compile-time rules guard the model. A singleton may not depend on a scoped service
unless its provider explicitly uses
`.withLifetime('singleton:one-per-container-tree', { allowsScopedDependencies: true })`.
A child container may replace only scoped and transient services; replacing a singleton
requires an independent container because inherited singleton consumers have already fixed
their dependency graph. Runtime enforces the child replacement rule for JavaScript and for
callers that bypass TypeScript.

Module sealing retains an obligation when a singleton reaches an external requirement.
The installing host may satisfy that requirement with a scoped provider, including after
`withRenamedRequirement`, so discarding the reach at the module boundary would make the
capture check unsound.

## Remaining gap

The graph cannot infer that dependency-free state is conceptually per request. If a request
id, unit of work, or similar provider has no scoped dependency and its author forgets the
scoped mark, it is shared across child containers. The migration codemod pins the old scoped
meaning in programs that used `createScope`; developers then remove pins only where sharing
is intended.

## Considered options

- Keep scoped as the default. This preserves 0.4 behavior but makes every ordinary stateless
  service allocate once per child container and leaves the common application shape verbose.
- Select a default per builder. This moves lifetime meaning away from each provider, makes
  installed modules depend on host policy, and creates two interpretations of the same module.
- Use NestJS-style scope bubbling. DI Bag discovers named dependencies lazily through a Proxy,
  so it cannot know the complete runtime dependency graph before factories run; bubbling would
  make cache ownership change after acquisition and would still miss dependency-free request
  state.
- Remove child containers. Independent containers avoid the replacement ambiguity, but they
  also give up shared singleton clients, tracked parent-child shutdown, and the inexpensive
  request-container pattern.

## Consequences

Old code that creates child containers can compile with different instance counts, so this is
the release's one silent semantic migration. The type-aware `--pin-lifetimes` transform
preserves old behavior. Complete host graphs with no scoped provider skip the lifetime walk;
module sealing still retains external reaches. A disposable transient remains owned until the
container that resolved it closes.
```

- [ ] **Step 6: Audit assertion text without taking plan 12's message work**

Run:

```bash
grep -rhoE "toThrow\((/|['\x60])[^)]*" tests | grep -iE '\b(root lifetime|createChildContainer|scoped|lifetime)\b' | sort | uniq -c
```

The 0.4.0 inventory was:

```text
      4 toThrow(/lifetime/i
      2 toThrow('root lifetime'
      4 toThrow('root lifetime cannot capture scoped'
      2 toThrow(/root lifetime cannot capture scoped/
      8 toThrow('root lifetime cannot capture scoped dependency'
```

This phase intentionally breaks none of those strings: the capture-message family is deferred to plan 12 Task 12. The prior phase already migrated `createScope` operation text. Add assertions for the new code/message only in `tests/singleton-default.test.ts`; do not rewrite existing capture assertions.

- [ ] **Step 7: Run fast migration checks and commit the decision prose**

```bash
bun test tests/singleton-default.test.ts tests/scopes.test.ts tests/lifetimes.test.ts
node --test tools/codemod/test/fixtures.test.mjs tools/codemod/test/cli.test.mjs
wc -l AGENTS.md
```

Expected: all tests pass, golden/manual output is exact, and `AGENTS.md` is at most 150 lines.

```bash
git add -- examples/scopes.ts AGENTS.md docs/agent/recipes.md docs/adr/0001-singleton-by-default.md
git commit -F - <<'MSG'
docs: record the singleton default decision

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

---

### Task 5: Measure S8 and choose the adopted or fallback contract

**Files:**
- Modify: `tests/compiler.ts`
- Create: `scripts/check-singleton-default-scale.ts`, `tests/singleton-default-scale.test.ts`
- Create: `docs/superpowers/plans/evidence/phase-10.md`

**Interfaces:**
- Consumes: phase-0 `compilerProgram`, `describeDiagnostic`, evidence baseline and `scripts/evidence-cases.mjs`.
- Produces: reproducible 100-provider fast-path/capture rows and the recorded S8 decision.

- [ ] **Step 1: Add the complete measured-case source generator**

Append to `tests/compiler.ts`:

```ts
export type SingletonDefaultScaleCase = 'no-scoped-service' | 'scoped-service-at-chain-end';
export const singletonDefaultScalePath = resolve('tests/generated-singleton-default-scale.ts');

/** One hundred default-singleton providers; the negative case makes only the final provider scoped. */
export function singletonDefaultScaleSource(
  count: number,
  scenario: SingletonDefaultScaleCase,
): string {
  if (!Number.isInteger(count) || count < 2) {
    throw new Error('singleton-default scale count must be at least two');
  }
  const providers = Array.from({ length: count }, (_, index) => {
    if (index === count - 1) {
      const factory = `() => ${count}`;
      return scenario === 'scoped-service-at-chain-end'
        ? `svc${index}: DiBag.createProvider(${factory}).withLifetime('scoped:one-per-container')`
        : `svc${index}: ${factory}`;
    }
    return `svc${index}: ({ svc${index + 1} }: { svc${index + 1}: number }) => svc${index + 1}`;
  });
  return `import { DiBag } from '../src';
const container = /* singleton-default-boundary */ DiBag.createBuilder().withServices({
${providers.join(',\n')}
}).buildContainer();
const first: number = container.resolve('svc0');
const last: number = container.resolve('svc${count - 1}');
void first; void last;
`;
}

export function singletonDefaultBoundaryLine(source: string): number {
  const index = source.split('\n').findIndex(line => line.includes('singleton-default-boundary'));
  if (index === -1) throw new Error('missing singleton-default boundary');
  return index + 1;
}
```

- [ ] **Step 2: Add a cheap generator test**

Create `tests/singleton-default-scale.test.ts`:

```ts
import { expect, test } from 'bun:test';
import {
  singletonDefaultBoundaryLine,
  singletonDefaultScaleSource,
} from './compiler';

test('singleton default scale source has 100 providers and one optional scoped tail', () => {
  const fast = singletonDefaultScaleSource(100, 'no-scoped-service');
  const captured = singletonDefaultScaleSource(100, 'scoped-service-at-chain-end');
  expect((fast.match(/^svc\d+:/gm) ?? [])).toHaveLength(100);
  expect(fast).not.toContain("withLifetime('scoped:one-per-container')");
  expect((captured.match(/withLifetime\('scoped:one-per-container'\)/g) ?? [])).toHaveLength(1);
  expect(captured).toContain('svc99: DiBag.createProvider(() => 100)');
  expect(singletonDefaultBoundaryLine(fast)).toBe(2);
});
```

Run: `bun test tests/singleton-default-scale.test.ts`

Expected: `1 pass`, `0 fail`. This test does not invoke a compiler.

- [ ] **Step 3: Add the complete S8 worker**

Create `scripts/check-singleton-default-scale.ts`:

```ts
import { performance } from 'node:perf_hooks';
import ts from 'typescript';
import {
  compilerProgram,
  describeDiagnostic,
  singletonDefaultBoundaryLine,
  singletonDefaultScalePath,
  singletonDefaultScaleSource,
  type SingletonDefaultScaleCase,
} from '../tests/compiler.ts';

const scenarios: readonly SingletonDefaultScaleCase[] = [
  'no-scoped-service',
  'scoped-service-at-chain-end',
];
const scenario = scenarios.find(value => value === process.argv[2]);
const count = process.argv[3] === undefined ? 100 : Number(process.argv[3]);
if (scenario === undefined || process.argv.length > 4 || count !== 100) {
  throw new Error('usage: node scripts/check-singleton-default-scale.ts <no-scoped-service|scoped-service-at-chain-end> [100]');
}

const source = singletonDefaultScaleSource(count, scenario);
const boundaryLine = singletonDefaultBoundaryLine(source);
const start = performance.now();
const program = compilerProgram(singletonDefaultScalePath, source);
const diagnostics = ts.getPreEmitDiagnostics(program).map(describeDiagnostic);
const expectedMessage = 'root lifetime cannot capture scoped dependency: svc98 -> svc99';
const matching = diagnostics.filter(diagnostic =>
  diagnostic.file === singletonDefaultScalePath &&
  diagnostic.line === boundaryLine &&
  diagnostic.message.includes(expectedMessage),
);
const accepted = scenario === 'no-scoped-service'
  ? diagnostics.length === 0
  : diagnostics.length === 1 && matching.length === 1 && !diagnostics.some(diagnostic => diagnostic.code === 2589);

console.log(JSON.stringify({
  scenario,
  count,
  accepted,
  typescript: ts.version,
  node: process.version,
  milliseconds: Math.round(performance.now() - start),
  maxRssMiB: Math.round(process.resourceUsage().maxRSS / 1024),
  instantiations: program.getInstantiationCount(),
  boundaryLine,
  diagnostics,
}));
if (!accepted) process.exitCode = 1;
```

The marker sits on the builder expression where TypeScript reports the graph rejection; do not
move it to the terminal `buildContainer` line. The expected capture phrase stays on the deferred
plan-12 spelling. The worker exits nonzero for any unaccepted row. The case proves the fast path
is zero-diagnostic when no scoped provider exists and that a single scoped tail is still found
through the default-singleton set.

- [ ] **Step 4: Run S8 only in the controller-serialized compiler window**

Before **each** command below, ask the controller to explicitly lift the heavy hold for that exact
command, grant the serialized slot, and confirm the required memory. Run only that command, report
its completion, and release the slot before requesting the next. A reading of at least 6 GiB is
not authorization and permits at most one root TypeScript 6 process:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-singleton-default-scale.ts no-scoped-service 100
```

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-singleton-default-scale.ts scoped-service-at-chain-end 100
```

```bash
node scripts/evidence-cases.mjs --compare docs/superpowers/plans/evidence/baseline.md --json /tmp/di-bag-phase-10-evidence.json
```

Expected: both S8 JSON rows have `accepted: true`; the negative row has exactly one diagnostic at `boundaryLine`, contains `svc98 -> svc99`, and has no TS2589; the evidence CLI exits 0 with twelve accepted rows and every cumulative instantiation change at or below +10%. The CLI has no `--phase` or `--out` option.

Obtain a fresh explicit heavy-hold lift and compiler slot for the property-location fixture:

```bash
bun test tests/types.test.ts --test-name-pattern 'singleton default'
```

Expected: the child string-key and token-key diagnostics start on `replacementProviders`; both adopted S3 one-bag overload paths are exercised. If phase 6 uses its positional fallback, the diagnostics start on the replacement-provider parameter and the direct options-type fixture still starts on its property.

- [ ] **Step 5: Compare compiler ceilings before accepting S8**

This 500–1500 paired matrix is normally reserved by the master for phase 13. Before running it,
ask the controller to record the narrow named exception
`phase-10-s8-ceiling-pair`: two serialized compiler-ceiling commands, four existing forms,
`500..1500`, resolution 25, three repeats, used only to decide S8. General phase-13 matrices and
1000-operation runtime workloads remain deferred. If the controller does not grant that named
exception, record `Decision: pending controller-authorized S8 ceiling evidence`, leave the branch
at the green pre-decision checkpoint, and stop this phase. Held or missing evidence is not an S8
failure and does not trigger Task 6.

Use the phase-9 head (the merge base with `next`) in a detached temporary worktree and the same machine/load window. Each ceiling command is a separate heavy-slot operation; never overlap the before and after runs:

```bash
git worktree add --detach /tmp/di-bag-phase-10-ceiling-before next
ln -s "$(pwd)/node_modules" /tmp/di-bag-phase-10-ceiling-before/node_modules
(cd /tmp/di-bag-phase-10-ceiling-before && npm run benchmark:compiler-ceiling -- --from 500 --to 1500 --resolution 25 --repeats 3)
npm run benchmark:compiler-ceiling -- --from 500 --to 1500 --resolution 25 --repeats 3
```

Expected: each command writes a JSONL evidence path. For each of `chained`, `replacement`, `control`, and `named-modules`, the post-change `largestAccepted` is at least 90% of the phase-9 value. Record both evidence paths. Remove the symlink and temporary worktree after reading the records:

```bash
git worktree remove /tmp/di-bag-phase-10-ceiling-before
```

Do not use an earlier machine's timing or RSS as the ceiling decision; only accepted counts from this paired run decide the criterion.

- [ ] **Step 6: Record the evidence and decision**

Create `docs/superpowers/plans/evidence/phase-10.md` with:

1. provenance from the evidence CLI and both compiler versions;
2. the twelve exact `case | count | baseline | phase 10 | change | accepted` rows from `/tmp/di-bag-phase-10-evidence.json`;
3. both exact S8 JSON rows, rendered as `scenario | providers | instantiations | milliseconds | max RSS MiB | diagnostics | accepted`;
4. `form | phase 9 largest accepted | phase 10 largest accepted | change` for all four ceiling forms;
5. the property-location fixture result;
6. exactly one decision line: `Decision: adopt singleton by default` if every rule passes, otherwise `Decision: retain scoped by default (S8 fallback)` followed by the first failed rule and its observed numbers.

Do not invent numbers or copy this planning session's runtime probe into compiler evidence. The plan's current type signatures are explicitly uncompiled until this task.

- [ ] **Step 7: Repair correctness failures, then take fallback only on a recorded rejection**

A positive/negative fixture failure or misplaced diagnostic first enters the master's serious-repair
cycle. Preserve the fixture and make up to three distinct, technically justified repairs to the S8
type shape, recording each attempted signature and observed failure in
`docs/superpowers/plans/evidence/phase-10.md`. Formatting changes or rerunning the same signature do
not count as attempts. Take Task 6 only when three serious repairs fail, the required diagnostic
still cannot be property-local after those attempts, or measured evidence actually breaches a
budget: a twelve-case row exceeds +10% or a ceiling falls by more than 10%. Do not tune thresholds
or keep a partial singleton-default type change.

On failure, first finish the raw evidence record with the failed rule, numbers, and repair attempts.
Skip Step 8 entirely and execute Task 6; Task 6's commit owns that decision record and the worker
deletions. Do not return to the adoption commit after Task 6.

- [ ] **Step 8: Commit the measured adoption decision only**

Run this step only when every S8 rule passes and the decision is adoption. On fallback this step is
skipped as specified above.

```bash
git add -- tests/compiler.ts tests/singleton-default-scale.test.ts scripts/check-singleton-default-scale.ts docs/superpowers/plans/evidence/phase-10.md
git commit -F - <<'MSG'
test(types): measure singleton default graph cost

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

---

### Task 6: Complete S8 fallback when singleton-by-default misses a rule

**Files:**
- Modify: all Task 1–5 files whose singleton-default behavior differs
- Delete: `tools/codemod/lib/transforms/lifetime-pin.mjs`, `tools/codemod/test/fixtures/lifetime-pin/*`, `scripts/check-singleton-default-scale.ts`, `tests/singleton-default-scale.test.ts` only after their measured failure is recorded
- Modify: `docs/adr/0001-singleton-by-default.md`, `docs/superpowers/plans/evidence/phase-10.md`, `docs/guides/api-naming.md`

**Interfaces:**
- Consumes: Task 5's failed S8 evidence.
- Produces: scoped remains the default; the child-singleton replacement rule and its runtime/type safety remain; independent replacement remains unrestricted.

- [ ] **Step 1: Restore the exact phase-10 lifetime core, then reapply only child admission**

Restore the two type-policy files byte-for-byte from the recorded entry commit:

```bash
ENTRY_COMMIT="$(cat /tmp/di-bag-phase-10-entry-commit)"
git show "${ENTRY_COMMIT}:src/lifetime.ts" > src/lifetime.ts
git show "${ENTRY_COMMIT}:src/lifetime-types.ts" > src/lifetime-types.ts
```

This restores phase-10 `LifetimeGraph`, compact policy classifiers, `NeedsLifetimeWalk`, every
host/seal branch, and all `RenamedExternalObligation` branches exactly. Phase 10 does not contain
`CanonicalLifetime`; re-add its public mapping below. Do not reconstruct the restored walkers by hand.

In `src/provider-operations.ts`, restore:

```ts
const scopedLifetime: LifetimePolicy = Object.freeze({
  kind: 'scoped',
  allowsScopedDependencies: false,
});
```

and return `lifetime: scopedLifetime` from `sourceDescription`.

The restored classifiers are exactly:

```ts
type Policy<Value> = ProviderGraphContract<Value> extends infer Graph
  ? Graph extends { readonly lifetime: { readonly kind: infer Kind extends LifetimeKind } }
    ? Kind
    : 'scoped'
  : never;

type Strict<Value> = ProviderGraphContract<Value> extends infer Graph
  ? Graph extends { readonly lifetime: {
      readonly kind: 'singleton';
      readonly allowsScopedDependencies: infer Allows;
    } }
    ? [Allows] extends [true] ? false : true
    : false
  : false;
```

Immediately after the restored `PolicyOf`, re-add this phase-owned public mapping:

```ts
type PublicLifetime<Kind extends LifetimeKind> =
  Kind extends 'singleton' ? 'singleton:one-per-container-tree'
  : Kind extends 'scoped' ? 'scoped:one-per-container'
  : 'transient:one-per-resolve';

export type CanonicalLifetime<
  ServiceRegistrations extends Registrations,
  ServiceKey extends keyof ServiceRegistrations,
> = PublicLifetime<PolicyOf<ServiceRegistrations, ServiceKey, never>>;
```

Then re-add `SingletonReplacementKeys`, `SingletonReplacementMessage`, and exported
`ChildReplacementAdmission` from Task 2 Step 5, comparing
`CanonicalLifetime<...>` with `'singleton:one-per-container-tree'`. Keep the existing
`replacementProviders`/overload intersections in `src/scope-types.ts` and `src/di-bag.ts`.
Keep the Task 2 `CanonicalLifetime` and `ChildReplacementAdmission` exports in `src/index.ts` and
their fallback fixtures; both names therefore exist on adopted and fallback paths.

Do not remove `BagRuntime.lifetimeOf`, `DI_BAG_SINGLETON_REPLACEMENT`, `ChildReplacementAdmission`, or the child selector guard. They now reject only explicitly marked inherited singletons and remain sound without the default flip.

- [ ] **Step 2: Remove lifetime-pin shipping behavior completely**

Reverse the two isolated commits without committing yet, newest first:

```bash
git revert --no-commit "$(cat /tmp/di-bag-phase-10-mechanical-pin-commit)"
git revert --no-commit "$(cat /tmp/di-bag-phase-10-lifetime-pin-commit)"
```

Expected: the first reversal removes only mechanical `.withLifetime('scoped:one-per-container')`
pins; the second removes the source hook, fixture, CLI flag, and its tests. The rename map/schema
remain byte-identical to phase 10. Inspect `git diff --name-status`; abort fallback if either
reversal touches a phase-10 map role or transform id. Then delete the measured worker only after its
failed rows are copied to evidence:

```bash
git rm scripts/check-singleton-default-scale.ts tests/singleton-default-scale.test.ts
```

Remove only the `singletonDefaultScale*` exports added to `tests/compiler.ts`. The ordinary
accumulated codemod remains byte-for-byte as it was after phase 10.

Do not leave a no-op `--pin-lifetimes` flag or document it: the spec's fallback needs no semantic pinning.

- [ ] **Step 3: Replace focused tests with the fallback contract**

Replace `tests/singleton-default.test.ts` with `tests/child-singleton-replacement.test.ts` containing:

```ts
import { expect, test } from 'bun:test';
import { DiBag } from '../src';

test('scoped remains the default across child containers', async () => {
  let calls = 0;
  const root = DiBag.createBuilder().withServices({ value: () => ({ call: ++calls }) }).buildContainer();
  const child = root.createChildContainer();
  expect(child.resolve('value')).not.toBe(root.resolve('value'));
  expect(calls).toBe(2);
  await root.close();
});

test('a child rejects only an explicitly marked singleton', async () => {
  const root = DiBag.createBuilder().withServices({
    singleton: DiBag.createProvider(() => 1).withLifetime('singleton:one-per-container-tree'),
    scoped: () => 2,
  }).buildContainer();
  expect(() => (root.createChildContainer as (options: object) => unknown)({
    replacedServiceKeys: ['singleton'], replacementProviders: { singleton: () => 3 },
  })).toThrow("cannot replace singleton service 'singleton'");
  const child = root.createChildContainer({
    replacedServiceKeys: ['scoped'], replacementProviders: { scoped: () => 4 },
  });
  expect(child.resolve('scoped')).toBe(4);
  await root.close();
});

test('an independent container may replace an explicitly marked singleton', async () => {
  const root = DiBag.createBuilder().withServices({
    singleton: DiBag.createProvider(() => 1).withLifetime('singleton:one-per-container-tree'),
  }).buildContainer();
  const independent = root.createIndependentContainer({
    replacedServiceKeys: ['singleton'], replacementProviders: { singleton: () => 2 },
  });
  expect(independent.resolve('singleton')).toBe(2);
  await independent.close(); await root.close();
});

test('aliases follow explicit singleton targets while collection replacement remains allowed', async () => {
  const items = DiBag.createToken(Symbol('items')).forCollectionOf<number>();
  const root = DiBag.createBuilder()
    .withServices({
      target: DiBag.createProvider(() => 1).withLifetime('singleton:one-per-container-tree'),
    })
    .withServiceAlias({ aliasKey: 'alias', targetServiceKey: 'target' })
    .withCollectionContribution({ collectionToken: items, provider: () => 1 })
    .buildContainer();
  expect(() => (root.createChildContainer as (options: object) => unknown)({
    replacedServiceKeys: ['alias'], replacementProviders: { alias: () => 2 },
  })).toThrow("cannot replace singleton service 'alias'");
  const child = root.createChildContainer({
    replacedServiceKeys: [items], replacementProviders: { [items.symbol]: () => [2] },
  });
  expect(child.resolve(items)).toEqual([2]);
  await child.close(); await root.close();
});
```

Delete the three `tests/types/*singleton-default*` fixtures. Create
`tests/types/child-singleton-replacement.ts`:

When final Phase 4 evidence records the S5 fallback, use `child.resolveCollection(items)` in the restored runtime collection assertion immediately above and `collectionChild.resolveCollection(items)` in this positive compiler fixture. These substitutions change only the read method; replacement and lifetime semantics remain identical.

```ts
import { DiBag } from '../../src';

const root = DiBag.createBuilder().withServices({
  scoped: () => 1,
  singleton: DiBag.createProvider(() => 2).withLifetime('singleton:one-per-container-tree'),
}).buildContainer();

export const child = root.createChildContainer({
  replacedServiceKeys: ['scoped'], replacementProviders: { scoped: () => 3 },
});
export const independent = root.createIndependentContainer({
  replacedServiceKeys: ['singleton'], replacementProviders: { singleton: () => 4 },
});
const items = DiBag.createToken(Symbol('items')).forCollectionOf<number>();
const collectionRoot = DiBag.createBuilder()
  .withCollectionContribution({ collectionToken: items, provider: () => 1 })
  .buildContainer();
export const collectionChild = collectionRoot.createChildContainer({
  replacedServiceKeys: [items], replacementProviders: { [items.symbol]: () => [2] },
});
const childValue: number = child.resolve('scoped');
const independentValue: number = independent.resolve('singleton');
const collectionValue: readonly number[] = collectionChild.resolve(items);
void childValue; void independentValue; void collectionValue;
```

Create `tests/types/negative/child-singleton-replacement.ts`:

```ts
import { DiBag } from '../../../src';

const root = DiBag.createBuilder().withServices({
  singleton: DiBag.createProvider(() => 1).withLifetime('singleton:one-per-container-tree'),
  scoped: () => 2,
}).buildContainer();
root.createChildContainer({
  replacedServiceKeys: ['singleton'],
  // diagnostic: createChildContainer cannot replace singleton service: singleton
  replacementProviders: { singleton: () => 3 },
});

const token = DiBag.createToken(Symbol('singleton')).forService<number>();
const tokenRoot = DiBag.createBuilder().withTokenService(token, DiBag.createProvider(() => 1).withLifetime('singleton:one-per-container-tree')).buildContainer();
tokenRoot.createChildContainer({
  replacedServiceKeys: [token],
  // diagnostic: createChildContainer cannot replace singleton service
  replacementProviders: { [token.symbol]: () => 2 },
});

const aliasRoot = DiBag.createBuilder()
  .withServices({ target: DiBag.createProvider(() => 1).withLifetime('singleton:one-per-container-tree') })
  .withServiceAlias({ aliasKey: 'alias', targetServiceKey: 'target' })
  .buildContainer();
aliasRoot.createChildContainer({
  replacedServiceKeys: ['alias'],
  // diagnostic: createChildContainer cannot replace singleton service: alias
  replacementProviders: { alias: () => 2 },
});
```

In `tests/types.test.ts`, remove the three singleton-default named tests, declaration-array entry,
and two-location assertion. Add a zero-diagnostic test for `child-singleton-replacement.ts` and a
location assertion identical to Task 2 Step 2 but expecting three errors and the literal lines
for `singleton`, `[token.symbol]`, and `alias`. The existing negative-marker discovery picks up
the new file. Existing phase-10 lifetime fixtures retain explicit-singleton capture coverage.

- [ ] **Step 4: Replace the ADR with the complete fallback decision**

Keep the required filename `docs/adr/0001-singleton-by-default.md`, but replace its contents exactly:

```md
---
status: accepted
---

# Retain scoped as the default lifetime

DI Bag retains `'scoped:one-per-container'` as the unmarked provider lifetime because the
measured singleton-default type shape failed the S8 compiler budget recorded in
`docs/superpowers/plans/evidence/phase-10.md`. Explicit
`'singleton:one-per-container-tree'` and `'transient:one-per-resolve'` policies remain
available.

A child container may replace scoped and transient services, but it may not replace an
explicit singleton; use an independent container when the replacement must rebuild the
whole graph. Both TypeScript and runtime enforce that rule. The singleton-captures-scoped
check and module obligations retain their phase-9 behavior, including renamed external
requirements.

## Considered options

- Make singleton the default with a no-scoped-service fast path. S8 failed the recorded
  diagnostic-location, instantiation, or compiler-ceiling rule, so the release uses its
  specified fallback.
- Select a default per builder. This makes installed module meaning depend on the host.
- Use NestJS-style scope bubbling. Lazy Proxy dependency discovery cannot determine the
  complete graph before acquisition.
- Remove child containers. That loses tracked request ownership and parent singleton sharing.

## Consequences

Existing unmarked providers keep their 0.4 per-container instance behavior and need no
lifetime-pin migration. Singleton providers stay explicit. The new child replacement rule
prevents an explicit singleton consumer from silently retaining an inherited dependency.
```

Update `AGENTS.md` rule 3 to:

```md
3. **Lifetimes.** The default is `'scoped:one-per-container'`. Mark a shared client
   `'singleton:one-per-container-tree'` only when nothing it depends on is scoped.
   A child may replace only scoped or transient services; use an independent container
   to replace a singleton.
```

Remove singleton-default prose from `docs/agent/recipes.md`; keep the explicit-scoped request example valid but explain that its mark documents intent rather than overriding the default.

Under `docs/guides/api-naming.md`'s existing **Measured exceptions** table, append exactly one S8
row using the table's existing columns. Set the proposed shape to `singleton default`, the selected
fallback to `scoped default`, the reason to the first failed rule copied verbatim from
`docs/superpowers/plans/evidence/phase-10.md` with its observed numbers (or all three recorded serious
repair attempts when correctness never succeeded), and the evidence link to
`docs/superpowers/plans/evidence/phase-10.md`. Do not summarize a budget failure without its before,
after, and percentage values.

- [ ] **Step 5: Run the focused fallback tests and commit**

```bash
bun test tests/child-singleton-replacement.test.ts tests/scopes.test.ts tests/lifetimes.test.ts
node --test tools/codemod/test/fixtures.test.mjs tools/codemod/test/cli.test.mjs
```

Obtain an explicit heavy-hold lift and controller-held compiler slot around this command alone:

```bash
bun test tests/types.test.ts --test-name-pattern 'child singleton replacement|lifetimes'
```

Expected: all pass, explicit singleton child replacement fails at the provider property, independent replacement passes, and no lifetime-pin fixture/flag remains.

```bash
node - <<'NODE'
const { execFileSync, spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const lines = args => execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean);
const reverted = new Set();
for (const record of [
  '/tmp/di-bag-phase-10-lifetime-pin-commit',
  '/tmp/di-bag-phase-10-mechanical-pin-commit',
]) {
  const commit = readFileSync(record, 'utf8').trim();
  for (const file of lines(['diff-tree', '--no-commit-id', '--name-only', '-r', commit])) reverted.add(file);
}
const fallbackOwned = new Set([
  'src/provider-operations.ts', 'src/acquisition.ts', 'src/runtime.ts', 'src/scope-selection.ts',
  'src/di-bag.ts', 'src/lifetime.ts', 'src/lifetime-types.ts', 'src/scope-types.ts', 'src/index.ts',
  'tests/singleton-default.test.ts', 'tests/child-singleton-replacement.test.ts',
  'tests/types/singleton-default.ts', 'tests/types/singleton-default-consumer.ts',
  'tests/types/child-singleton-replacement.ts', 'tests/types/child-singleton-replacement-consumer.ts',
  'tests/types/negative/singleton-default.ts', 'tests/types/negative/child-singleton-replacement.ts',
  'tests/types.test.ts', 'tests/compiler.ts', 'tests/singleton-default-scale.test.ts',
  'scripts/check-singleton-default-scale.ts', 'AGENTS.md', 'docs/agent/errors.md',
  'docs/agent/recipes.md', 'docs/adr/0001-singleton-by-default.md', 'docs/guides/api-naming.md',
  'docs/superpowers/plans/evidence/phase-10.md',
]);
const allowed = new Set([...reverted, ...fallbackOwned]);
const changed = [...new Set([
  ...lines(['diff', 'HEAD', '--name-only']),
  ...lines(['ls-files', '--others', '--exclude-standard']),
])];
const unexpected = changed.filter(file => !allowed.has(file));
if (unexpected.length) throw new Error(`unexpected fallback paths:\n${unexpected.join('\n')}`);
const result = spawnSync('git', ['add', '--', ...changed], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
NODE
git commit -F - <<'MSG'
refactor: retain scoped default after S8

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

---

### Task 7: Contract tooling, generated docs, and integration gates

**Files:**
- Modify: `src/provider.ts`, `src/di-bag.ts`, `src/lifetime-types.ts`
- Modify: `tools/graph/lib/extract.mjs`, `tools/graph/test/extract.test.mjs`, relevant `tools/graph/test/fixtures/*`
- Modify: `tools/docs/api-card-tasks.json`, `tools/docs/test/api-card-summaries.test.mjs`, `tools/docs/test/exact-rendering.test.mjs`
- Regenerate: `docs/agent/api-card.md`, `docs/reference/index/**`
- Modify: `docs/agent/errors.md`
- Modify: `scripts/agent-eval/reference/**`, `scripts/agent-eval/skeleton/**` only where the default is described or per-child identity is intended

**Interfaces:**
- Consumes: the adopted S8 decision; if Task 6 ran, apply the fallback expectations explicitly called out below.
- Produces: one documented default across runtime inspection, graph extraction, API summaries, examples, agent eval, and emitted references.

- [ ] **Step 1: Lock exact public summaries and examples in source JSDoc**

For the adopted path, the complete `Provider.withLifetime` summary/example must read:

```ts
  /**
   * Return a provider with singleton, scoped, or transient caching.
   * Providers are singleton per container tree by default; use scoped for request state
   * and for every consumer that captures request state.
   * @param lifetime - The full lifetime value.
   * @param options - For singleton lifetime only, an optional deliberate scoped-capture allowance.
   * @returns A fresh immutable provider retaining every other provider stage.
   * @throws `DI_BAG_INVALID_LIFETIME` for an unknown lifetime or malformed options.
   * @example
   * ```ts
   * const request = DiBag.createProvider(() => ({ id: crypto.randomUUID() }))
   *   .withLifetime('scoped:one-per-container');
   * ```
   */
```

Keep the phase-9 overload signatures unchanged:

```ts
withLifetime<const SelectedLifetime extends Lifetime>(
  lifetime: SelectedLifetime & LifetimeAdmission<SelectedLifetime>,
): Provider<ExposedFactory, RegistrationMetadata, AcquisitionMetadataFrames,
  LifetimeGraph<RetainedGraphContract, SelectedLifetime, undefined>, AcquiredValue>;

withLifetime<const SelectedLifetime extends Lifetime, const Options extends object | undefined>(
  lifetime: SelectedLifetime & LifetimeAdmission<SelectedLifetime>,
  options: Options & LifetimeOptions<NoInfer<SelectedLifetime>, NoInfer<Options>>,
): Provider<ExposedFactory, RegistrationMetadata, AcquisitionMetadataFrames,
  LifetimeGraph<RetainedGraphContract, SelectedLifetime, Options>, AcquiredValue>;
```

Use phase 9's exact exported admission/options helper names if review changed them; do not introduce aliases. `allowsScopedDependencies` remains valid only with `'singleton:one-per-container-tree'`.

If phase 10 selected S2 facade fallback, place the selected adopted-or-S8-fallback summary on
`DiBag.providerWithLifetime` in `src/di-bag.ts`, keep phase 10's complete callable generic and
`{ provider, lifetime, allowsScopedDependencies? }` option-bag signature byte-for-byte, and make
the example call `DiBag.providerWithLifetime({ provider: DiBag.createProvider(...), lifetime })`.
There is no `Provider.withLifetime` declaration or reference page on that branch.

Update `Container.createChildContainer` JSDoc `@throws` with:

```text
`DI_BAG_SINGLETON_REPLACEMENT` when a selected inherited provider is singleton
```

and its example must show the replaced provider marked scoped at its original registration.

Under the S8 fallback, replace only the summary/example portion with this exact text and keep the
overloads and child throw unchanged:

```ts
  /**
   * Return a provider with singleton, scoped, or transient caching.
   * Providers are scoped per container by default; mark shared clients singleton when none of
   * their dependencies are scoped.
   * @param lifetime - The full lifetime value.
   * @param options - For singleton lifetime only, an optional deliberate scoped-capture allowance.
   * @returns A fresh immutable provider retaining every other provider stage.
   * @throws `DI_BAG_INVALID_LIFETIME` for an unknown lifetime or malformed options.
   * @example
   * ```ts
   * const client = DiBag.createProvider(() => createClient())
   *   .withLifetime('singleton:one-per-container-tree');
   * ```
   */
```

- [ ] **Step 2: Make static graph extraction report the new default**

Phase 9 must already recognize provider-method chains. In `tools/graph/lib/extract.mjs`, change only the initial default used by `unwrap`:

```js
let lifetime = 'singleton:one-per-container-tree';
```

Keep explicit `.withLifetime(...)` parsing and every old 0.4 facade-wrapper spelling that graph extraction intentionally supports. Update `tools/graph/test/extract.test.mjs` so the unmarked `retrieve` node is exactly:

```js
assert.equal(retrieve.lifetime, 'singleton:one-per-container-tree');
```

Add one explicit scoped fixture provider and assert:

```js
assert.equal(request.lifetime, 'scoped:one-per-container');
```

No graph JSON schema version changes: `lifetime` already exists and phase 9 changed its allowed values. Under the S8 fallback retain `'scoped:one-per-container'` as the extractor default.

- [ ] **Step 3: Update the deferred capture section's explanation without renaming it**

For the adopted path, replace the prose and examples under the existing heading `### Root capture {#root-capture}` with:

```md
**When:** `root lifetime cannot capture scoped dependency: <singleton> -> <scoped>;
see https://dany-fedorov.github.io/di-bag/agent/errors.html#root-capture`.

**Cause:** providers are singleton per container tree by default. A singleton consumer
would keep one child container's scoped dependency for the whole tree.

**Fix:** mark the consumer `.withLifetime('scoped:one-per-container')`, make the
dependency singleton as well, or use
`.withLifetime('singleton:one-per-container-tree', { allowsScopedDependencies: true })`
only for a deliberate capture of the root container's instance.

```ts
// expect-error: root lifetime cannot capture scoped dependency: client -> request; see https://dany-fedorov.github.io/di-bag/agent/errors.html#root-capture
import { DiBag } from 'di-bag';

DiBag.createBuilder().withServices({
  request: DiBag.createProvider(() => ({ id: 'outside-request' }))
    .withLifetime('scoped:one-per-container'),
  client: ({ request }: { request: { id: string } }) => request.id,
}).verifyGraphAtCompileTime() satisfies void;
```

```ts
import { DiBag } from 'di-bag';

DiBag.createBuilder().withServices({
  request: DiBag.createProvider(() => ({ id: 'outside-request' }))
    .withLifetime('scoped:one-per-container'),
  client: DiBag.createProvider(({ request }: { request: { id: string } }) => request.id)
    .withLifetime('scoped:one-per-container'),
}).verifyGraphAtCompileTime() satisfies void;
```
```

Keep the heading, `root-capture` anchor, `SeeErrors<'root-capture'>`, runtime `DI_BAG_LIFETIME_DEPENDENCY` message, family id, and all 16 assertion strings unchanged for plan 12 Task 12. Under fallback, retain phase-9 explanation except for full lifetime/method names.

- [ ] **Step 4: Preserve the API-card row and regenerate checked docs**

In `tools/docs/api-card-tasks.json`, preserve every prior row. The lifetime task must be exactly:

```json
{ "task": "Choose a lifetime", "call": "provider.withLifetime" }
```

If phase 10 selected S2 fallback, use exactly
`{ "task": "Choose a lifetime", "call": "DiBag.providerWithLifetime" }` and update the summary
test to the fallback option bag; do not publish a method row for an API that does not exist.

Do not reintroduce `DiBag.withLifetime` or overwrite the phase-9 file with the 0.4.0 rows. Update `api-card-summaries.test.mjs` and `exact-rendering.test.mjs` expected text to the JSDoc from Step 1. Do not add a summary exception; the new summary has one purpose.

Run:

```bash
npm run docs:generate
```

Obtain separate explicit heavy-hold lifts and controller-held slots for `npm run build` and, if the controller classifies
it as compiler-backed, `npm run docs:check`. Run each command alone, report it, and release its
slot.

Expected: build and docs gates exit 0; generated API card says singleton is the default, includes `DI_BAG_SINGLETON_REPLACEMENT` on child creation, and every reference signature uses the phase-9 provider methods/full lifetime strings.

- [ ] **Step 5: Update agent-eval intent without changing its tasks**

After the scoped pins from Task 4, replace prose saying “root lifetime” with “singleton per container tree” and remove explicit singleton marks only where the task is teaching that the ordinary default suffices. Keep explicit scoped marks in features whose hidden tests require distinct child instances, particularly inventory ledgers and notification/request state.

Run:

```bash
npm run agent-eval:test
```

Expected: exit 0. Catalog values intended to be shared remain identical across child containers; inventory/request values intended per child remain distinct. Under fallback, keep explicit singleton marks and describe scoped as the default.

- [ ] **Step 6: Run naming and stale-contract audits**

```bash
UPDATE_API_NAMING_VIOLATIONS=1 bun test tests/api-naming.test.ts
git diff --exit-code -- tests/api-naming-known-violations.json
grep -rnE "default.{0,20}(scoped:one-per-container|scoped)|scoped.{0,20}default" src tests examples scripts tools AGENTS.md docs/agent --exclude-dir=fixtures
grep -rnE "operation: '(createScope|fork)'|\.(createScope|fork)\(" src tests examples scripts tools/graph AGENTS.md docs/agent --exclude='api-renaming.ts' --exclude-dir=fixtures
grep -rnE "kind: 'root-reach'|policy: 'root'|readonly root:" src tests
grep -rn "DI_BAG_SINGLETON_REPLACEMENT" src tests docs/agent
```

Adopted-path expectations: the naming update passes and produces no known-violations diff because this phase removes no public name; default-scoped grep has no product/documentation hit; old operation grep has only deliberate 0.4 codemod input/removed-API fixtures; old obligation spellings have no hit; the new runtime code appears at its throw, focused tests, and one errors section. Under fallback, the first grep finds only the deliberate scoped-default source/docs and the evidence/ADR explanation.

Run the exact assertion inventory again and confirm Task 4's counts are unchanged. Any changed capture assertion is accidental plan-12 work.

- [ ] **Step 7: Run focused integration before the final suite**

```bash
bun test tests/singleton-default.test.ts tests/lifetimes.test.ts tests/scopes.test.ts tests/selected-scopes.test.ts tests/nested-modules.test.ts
node --test tools/codemod/test/*.test.mjs
npm run graph:check
npm run docs:check
npm run agent-eval:test
```

Expected: all pass. If Task 6 ran, substitute `tests/child-singleton-replacement.test.ts` for `tests/singleton-default.test.ts`.

- [ ] **Step 8: Audit the final task-owned change set before gates**

Run `git diff --name-status` and confirm every path belongs to Task 7's `Files` list. Do not stage
or commit yet. Contract source and checked generated docs will be committed only after the exact
master gates pass on this working tree.

- [ ] **Step 9: Run the complete master release gates with explicit heavy-slot handoffs**

Run these lightweight gates sequentially:

```bash
npm run docs:check
npm run graph:check
npm run codemod:check
npm run agent-eval:test
PATH=/tmp/claude-1000/-home-df-wd-personal-di-bag/7818417c-3b3a-48db-9bef-85624eff953b/scratchpad/bun/bin:$PATH bash -c 'for example in examples/*.ts; do bun "$example" || exit; done'
```

For every command below, obtain an explicit lift of the heavy hold and a controller-held slot for that command alone, run it,
report completion, and release the slot before requesting the next. Memory availability alone is
not authorization:

```bash
npm run check
```

```bash
npm run typecheck:native
```

```bash
npm run build:native
```

```bash
npm run check:native
```

```bash
npm run build
```

After `npm run build` completes and its slot is released, run the exact three CI retention suites:

```bash
node --expose-gc --test --test-isolation=none tests/runtime-scale.node.mjs tests/acquisition-retention.node.mjs tests/graph-retention.node.mjs
```

Obtain one final explicit heavy-hold lift and evidence slot, then run:

```bash
node scripts/evidence-cases.mjs --compare docs/superpowers/plans/evidence/baseline.md --json /tmp/di-bag-phase-10-final-evidence.json
```

Expected: every master gate exits 0, every example exits 0, the three exact Node suites pass
against `dist/`, and all twelve evidence rows remain within +10%. Do not substitute a glob for the
three Node files.

- [ ] **Step 10: Commit the checked contract and generated docs together**

Stage only changed Task-7 paths, rejecting anything else:

```bash
node - <<'NODE'
const { spawnSync } = require('node:child_process');
const changed = spawnSync('git', ['diff', 'HEAD', '--name-only'], { encoding: 'utf8' }).stdout.trim().split('\n').filter(Boolean);
const allowed = /^(src\/(provider|di-bag|lifetime-types)\.ts|tools\/graph\/|tools\/docs\/|docs\/agent\/|docs\/reference\/|scripts\/agent-eval\/|tests\/api-naming-known-violations\.json)$/;
const unexpected = changed.filter(file => !allowed.test(file));
if (unexpected.length) throw new Error(`unexpected final-contract paths:\n${unexpected.join('\n')}`);
const result = spawnSync('git', ['add', '--', ...changed], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
NODE
git commit -F - <<'MSG'
docs: explain singleton lifetime defaults

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
git status --short
```

Under fallback, change the subject to `docs: explain scoped lifetime defaults`. Expected: status
is clean. The committed tree is the exact tree that passed Step 9.

- [ ] **Step 11: Final report**

Report the branch, commits, adopted/fallback S8 decision, both 100-provider rows, twelve evidence
deltas, four paired ceiling deltas or the denied named exception, manual codemod rows resolved,
gate tails, and deviations. Keep the report under 60 lines and name the phase-9 evidence paths used
for comparison.

---

## Planning Evidence and Assumptions

- Fresh runtime evidence: `/tmp/di-bag-resume-20260921/probe-11/tests/zz-phase-10-singleton-default.test.ts` ran with pinned Bun 1.4.0 against a four-file runtime prototype; result was `1 pass`, `0 fail`, `6 expect()` calls. The probe changed the 0.4 names `root`/`createScope` only to test mechanics.
- Probe record: `/tmp/di-bag-resume-20260921/probe-11/prototype-result.md` records the exact command,
  result, and limitations. No repository compiler lane or heavy gate was run.
- Actual rewrite-engine probe: `/tmp/di-bag-resume-20260921/probe-11/actual-engine/run-plan11.mjs`
  copied phase 10's round-3 cumulative engine and inserted the Step 5 hook into its real
  `rewriteSourceFile` `text()`/`assemble()` path. Authenticated original 0.4, current preferred, S2
  facade, shorthand, nested explicit lifetime through disposal, whole-program analysis/output
  filtering, generated-output zero diagnostics, exact strings, and second-run idempotence passed.
  `/tmp/di-bag-resume-20260921/probe-11/actual-engine/result-plan11.json` records the result and its
  two omissions: the narrow map represents phase 6 only with `register -> withServices`, and leaves
  token/contribution/child routes to the plan's executor tests. The complete accumulated future map
  and repository golden suite remain executor evidence.
- Narrow compiler accounting: that engine proof called `ts.getPreEmitDiagnostics` on seven private
  programs and received zero diagnostics: one original and one two-file whole-program case against
  the copied fixture's vendored `di-bag` declarations, plus preferred, S2, and generated/idempotence
  cases against the probe's one-file `currentlib`. All used `skipLibCheck` and `types: []`; no repository
  `src` file was loaded. The command took 1.5 seconds. RSS was not captured and no memory check ran.
- Plan-only verification: `review-plan.py` reported balanced fences, zero placeholders, zero broad
  staging, a complete header/self-review, 7 tasks, and 53 steps. TypeScript's parser accepted all
  61 TS/JS/JSON fences after wrapping the five documented class/property fragments and excluding
  the two JSDoc snippets whose nested Markdown fences intentionally split extraction.
- Historical evidence: the phase-0 baseline counts and compiler contracts are taken from `docs/superpowers/plans/2026-09-21-01-naming-guide-and-baseline.md`; no historical number is presented as fresh evidence.
- Uncompiled planning work: every phase-10 repository type signature, negative diagnostic position,
  S8 instantiation count, and compiler ceiling in this plan remains uncompiled. The memory guard
  prohibited the repository source/full compiler lanes; the narrow private fixture programs above
  do not settle Task 5's adoption decision.
- Assumption: phase 10's evidence selects one provider shape before this phase begins. Preferred
  snippets use methods; the explicit entry-state, codemod render, API-card, and JSDoc branches give
  the exact S2 facade syntax when fallback won.
- Assumption: phase 8's `RenamedExternalObligation` has exactly the three distributive obligation branches shown in its accepted plan and must survive unchanged except for phase-9 singleton spelling.
- Assumption: `DI_BAG_SINGLETON_REPLACEMENT` is the final new failure kind. It is more specific than malformed arguments and does not collide with reserved `DI_BAG_CONFLICTING_SERVICE_SELECTION`.
- Runtime limitation: the container prototype did not exercise phase-6 option bags, phase-8 requirement renames, phase-9 provider methods, emitted declarations, graph extraction, or generated docs. The separate codemod probe exercised the actual cumulative rewrite engine but only the narrow routes and omissions recorded above.

## Self-Review

- **Spec coverage:** Tasks 1–2 implement the default and both safety rules; Task 3 supplies opt-in/automatic lifetime pins with exact golden/manual output; Task 4 migrates tests/examples and writes the full ADR; Task 5 measures all S8 rules plus the 100-provider tail; Task 6 is the complete spec fallback; Task 7 covers tools, docs, agent eval, generated artifacts, naming, and full gates.
- **Incomplete-content scan:** the plan contains no deferred implementation markers. Evidence values that cannot honestly exist before execution are required to be copied from named output files, never guessed.
- **Type consistency:** public values are the phase-9 full lifetime strings; absent policy is singleton only on the adopted path; `CreateChildContainerOptions` keeps its original first three generic positions; child admission attaches to `replacementProviders`; independent admission remains unrestricted; obligation kinds use singleton spelling while deferred diagnostics retain root wording.
