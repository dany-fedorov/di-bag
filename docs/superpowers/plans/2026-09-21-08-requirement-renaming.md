# Requirement Renaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Planning review accepted; see `handoff/resume-2026-09-21.md`. Execution requires the master entry state and lifted phase-gate hold.

**Goal:** Add immutable, composable string requirement renaming to modules so independently authored modules can consume differently shaped services that originally shared a requirement name.

**Architecture:** A module records a persistent local-requirement-to-host-key map beside its graph, exports, label, and phase-4 token-kind metadata. `withRenamedRequirement` rewrites the required-service and constraint contracts at the type level while runtime graph installation applies the map only after local and exported names have been considered. Type checking rejects unknown names and collisions that runtime cannot generally observe because factory parameter types are erased and dependencies are discovered lazily.

**Tech Stack:** TypeScript 6.0.x type system and compiler API, Bun 1.4.0, Node 24, TypeDoc/VitePress, `di-bag` persistent graph structures, and the phase-1 TypeScript-aware codemod.

**Spec:** `docs/superpowers/specs/2026-09-20-swift-api-style.md`, with worked examples in `docs/superpowers/specs/2026-09-20-swift-api-style-examples.md` and sequencing in `docs/superpowers/plans/2026-09-21-00-swift-api-style-master.md`.

## Global Constraints

- This is phase 7. Start from phases 0–6 merged on `next`; branch `phase-07-requirement-renaming`. Executors do not push, publish, merge, or revise the spec.
- Preserve the zero-runtime-dependency and browser-safe source contract. Do not import `node:` modules anywhere reachable from `src/index.ts`.
- Only string service requirements can be renamed. Collection and service tokens cannot be passed to this API.
- Preserve lazy factory execution. Never execute factories to discover requirements and never parse factory source.
- Runtime cannot know the complete erased requirement set. Compile-time admission owns general unknown-name and unobserved-collision rejection; runtime validates the options bag, string keys, known exports, recorded rename collisions, and reports unknown services if resolution later fails.
- New malformed-argument failures use `DI_BAG_INVALID_ARGUMENT` with literal details `{ operation, argument, expected }`. Unknown and duplicate service keys use `DI_BAG_UNKNOWN_SERVICE_KEY` / `DI_BAG_DUPLICATE_SERVICE_KEY` with literal details `{ operation, serviceKey }`.
- Preserve phase 4's `GraphDescription.tokenKinds` through every description copy and the final phase-6 `CreateChildContainerOptions` generic order and contract, including inherited registrations/shared-keys positions, defaulted constraints third, and later defaulted replacement generics. Do not restore the retired `ScopeOptions` name.
- Preserve accumulated codemod behavior. Map owners are their original 0.4.0 declaration names and transforms obtain emitted names through `api.nameOf`.
- All twelve evidence cases must remain at or below 110% of the phase-0 instantiation baseline. Spike S6 additionally measures 20 modules with renamed requirements; if its type shape breaches the rule, execute the complete fallback task and drop the feature.
- Each declared commit must be green. Tasks 1–4 form one implementation/test/docs commit; their intermediate states remain uncommitted. This phase has no generated-documentation exception.
- `AGENTS.md` remains at or below 150 lines. Replace text within rule 8; do not add a line.
- The pinned runtime is `/tmp/claude-1000/-home-df-wd-personal-di-bag/7818417c-3b3a-48db-9bef-85624eff953b/scratchpad/bun/bin/bun` (1.4.0).

## State on entry

Phases 0–6 have landed. Confirm the entry tree before editing:

```bash
grep -n "class Module<ExportedServices extends object, RequiredServices extends object" src/module.ts
grep -n "withRenamedExport<const CurrentExportKey extends string" src/module.ts
grep -n "withInstalledModules" src/di-bag.ts
grep -n "readonly buildModule: BuilderBuildModule" src/di-bag.ts
grep -n "snapshotOptionsBag" src/options-bag.ts
grep -n "readonly tokenKinds" src/runtime.ts
grep -n "export type CreateChildContainerOptions" src/scope-types.ts
grep -n "withRenamedRequirement" src/module.ts || true
```

Expected: the first seven commands find phase-2/4/5/6 declarations; the last prints nothing. `Module<ExportedServices, RequiredServices, Constraints, PublicProviders>` has only `withRenamedExport({ currentExportKey, newExportKey })`. Builders install through `withInstalledModules([...])` unless phase-5 evidence selected its named singular fallback, and seal through `buildModule({ exportedServiceKeys, moduleLabel? })`. `GraphDescription` includes optional `tokenKinds`; every complete graph copy below retains it. `CreateChildContainerOptions` is phase 6's rename of phase 4's `ScopeOptions<ServiceRegistrations, SharedKeys, Constraints = never>` and remains untouched.

Before executing Task 1, read the final `docs/superpowers/plans/evidence/phase-04.md`. A selected but budget-unverified S5 fallback is not adopted evidence. If it records `Decision: fallback`, change only the collection assertion in the printed Task 1 fixture from `container.resolve(values)` to `container.resolveCollection(values)`. Named and single-service reads remain `resolve`; Phase 4's four-entry ratchet result is unchanged.

Use the recorded S1/S7 choices consistently in every implementation, runtime/type fixture, documentation example and generated source in this plan. When S7 selected its singular fallback, a literal `.withInstalledModules([a, b])` becomes `.withInstalledModule(a).withInstalledModule(b)` in the same order, and an empty list is omitted. The Task 5 string generator has its exact singular variant below. For the two-input replacement example, use the recorded S1 positional form if required; no new S1 decision is made here.

No 0.4.0 name is retired by this phase, so the naming ratchet is expected not to shrink. The new name follows the naming rules and must never be added as a known violation.

## File Structure

| Path | Change | Responsibility |
| --- | --- | --- |
| `src/module.ts` | modify | immutable runtime rename map, public method, nested lexical remapping |
| `src/module-types.ts` | modify | requirement-name admission and required/constraint remapping |
| `src/lifetime-types.ts` | modify | remap external reaches without touching exports or factory consumers |
| `tests/requirement-renaming.test.ts` | create | runtime behavior, composition, validation, labels and laziness |
| `tests/types/requirement-renaming.ts`, `tests/types/requirement-renaming-consumer.ts` | create | positive inference and declaration-consumer contract |
| `tests/types/negative/requirement-renaming.ts` | create | property-local unknown/collision/wrong-shape diagnostics |
| `tests/types.test.ts` | modify | register the positive and declaration-consumer fixtures |
| `tools/graph/lib/extract.mjs`, `tools/graph/test/cross-module.test.mjs`, `tools/graph/test/fixtures/cross-module/*` | modify | follow export and requirement view chains in either order |
| `tools/graph/test/renamed-exports.test.mjs` | preserve and extend | retain phase-6 literal/opacity/identity coverage while adding requirement-view parity |
| `docs/agent/errors.md` | modify | first sections for the two final 0.5.0 key codes |
| `AGENTS.md`, `docs/agent/recipes.md` | modify | concise rule and the two-config recipe |
| `tools/docs/api-card-tasks.json`, `tools/docs/test/*.test.mjs` | modify | add and pin the public method without removing prior rows |
| `docs/agent/api-card.md`, `docs/reference/index/**` | regenerate | checked generated public documentation |
| `tests/compiler.ts`, `scripts/check-requirement-rename-scale.ts` | modify/create | complete 20-module S6 worker source |
| `docs/superpowers/plans/evidence/phase-07.md` | create | twelve cumulative rows and S6 decision |

---

### Task 1: Expand the runtime module view

**Files:**
- Modify: `src/module.ts`, `src/module-types.ts`, `src/lifetime-types.ts`
- Create: `tests/requirement-renaming.test.ts`
- Modify: `docs/agent/errors.md`

**Interfaces:**
- Consumes: `snapshotOptionsBag(options, operation, required, optional?)`, phase-6 `Module` generics and `withRenamedExport`, and phase-4 `GraphDescription.tokenKinds`.
- Produces: `Module.withRenamedRequirement({ currentRequirementKey, newRequirementKey })`, `ModuleDescription.requirementRenames: ReadonlyMap<string, string>`, and all type helpers named in Task 2.

- [ ] **Step 1: Write the failing runtime test**

Create `tests/requirement-renaming.test.ts` exactly as follows (if S7 selected the singular fallback, mechanically replace each `.withInstalledModules([x, y])` by ordered `.withInstalledModule(x).withInstalledModule(y)` calls; apply the evidence-conditioned S5 collection-read substitution stated in State on entry):

```ts
import { describe, expect, test } from 'bun:test';
import { DiBag } from '../src';

type OrdersConfig = { currency: string };
type BillingConfig = { vatRate: number };

const ordersModule = DiBag.createBuilder().withServices({
  store: () => ({ prefix: 'order:' }),
  orders: ({ config, store }: { config: OrdersConfig; store: { prefix: string } }) => store.prefix + config.currency,
}).buildModule({ exportedServiceKeys: ['orders'], moduleLabel: 'orders' });
const billingModule = DiBag.createBuilder().withServices({
  billing: ({ config }: { config: BillingConfig }) => config.vatRate,
}).buildModule({ exportedServiceKeys: ['billing'], moduleLabel: 'billing' });

describe('module requirement renaming', () => {
  test('installs modules with incompatible requirements that originally share a name', async () => {
    const container = DiBag.createBuilder().withInstalledModules([
      ordersModule.withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'ordersConfig' }),
      billingModule.withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'billingConfig' }),
    ]).withServices({
      ordersConfig: (): OrdersConfig => ({ currency: 'EUR' }),
      billingConfig: (): BillingConfig => ({ vatRate: 0.2 }),
    }).buildContainer();
    expect(container.resolve('orders')).toBe('order:EUR');
    expect(container.resolve('billing')).toBe(0.2);
    expect(container.graphSnapshot().bindings.map(binding => binding.label)).toContain('orders/store');
    expect(container.serviceSnapshot('orders').label).toBe('orders');
    await container.close();
  });

  test('a renamed requirement can resolve another module export', async () => {
    const configModule = DiBag.createBuilder().withServices({ ordersConfig: (): OrdersConfig => ({ currency: 'GBP' }) })
      .buildModule({ exportedServiceKeys: ['ordersConfig'] });
    const container = DiBag.createBuilder().withInstalledModules([
      ordersModule.withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'ordersConfig' }),
      configModule,
    ]).buildContainer();
    expect(container.resolve('orders')).toBe('order:GBP');
    await container.close();
  });

  test('nested modules forward and rename a requirement again without changing the factory parameter', async () => {
    const inner = ordersModule.withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'featureConfig' });
    const outer = DiBag.createBuilder().withInstalledModules([inner])
      .buildModule({ exportedServiceKeys: ['orders'], moduleLabel: 'outer' })
      .withRenamedRequirement({ currentRequirementKey: 'featureConfig', newRequirementKey: 'applicationConfig' });
    const container = DiBag.createBuilder().withInstalledModules([outer])
      .withServices({ applicationConfig: (): OrdersConfig => ({ currency: 'UAH' }) }).buildContainer();
    expect(container.resolve('orders')).toBe('order:UAH');
    expect(container.graphSnapshot().bindings.map(binding => binding.label)).toContain('outer/orders/store');
    await container.close();
  });

  test('private names shadow requirement maps and export views compose in either order', async () => {
    const local = DiBag.createBuilder().withServices({
      config: () => 7,
      service: ({ config }: { config: number }) => config,
    }).buildModule({ exportedServiceKeys: ['service'] });
    const exported = local.withRenamedExport({ currentExportKey: 'service', newExportKey: 'answer' });
    const exportFirst = (exported.withRenamedRequirement as Function)({ currentRequirementKey: 'config', newRequirementKey: 'ignored' });
    const requirementFirst = (local.withRenamedRequirement as Function)({ currentRequirementKey: 'config', newRequirementKey: 'ignored' })
      .withRenamedExport({ currentExportKey: 'service', newExportKey: 'answer' });
    for (const module of [exportFirst, requirementFirst]) {
      const container = DiBag.createBuilder().withInstalledModules([module]).buildContainer();
      expect(container.resolve('answer')).toBe(7);
      await container.close();
    }
  });

  test('renames a requirement used by a sealed collection contribution', async () => {
    const values = DiBag.token(Symbol('values')).forCollectionOf<string>();
    const feature = DiBag.createBuilder().withCollectionContribution({
      collectionToken: values,
      provider: ({ config }: { config: OrdersConfig }) => config.currency,
    }).buildModule({ exportedServiceKeys: [] })
      .withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'ordersConfig' });
    const container = DiBag.createBuilder().withInstalledModules([feature])
      .withServices({ ordersConfig: (): OrdersConfig => ({ currency: 'EUR' }) }).buildContainer();
    expect(container.resolve(values)).toEqual(['EUR']);
    await container.close();
  });

  test('preserves token-kind claims through nested requirement-renamed modules', () => {
    const key = Symbol('shared-kind');
    const serviceToken = DiBag.token(key).of<number>();
    const collectionToken = DiBag.token(key).forCollectionOf<number>();
    const inner = DiBag.createBuilder()
      .withTokenService(serviceToken, ({ config }: { config: OrdersConfig }) => config.currency.length)
      .buildModule({ exportedServiceKeys: [serviceToken] })
      .withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'innerConfig' });
    const outer = DiBag.createBuilder().withInstalledModules([inner])
      .buildModule({ exportedServiceKeys: [serviceToken] })
      .withRenamedRequirement({ currentRequirementKey: 'innerConfig', newRequirementKey: 'outerConfig' });
    expect(() => DiBag.createBuilder()
      .withCollectionContribution({ collectionToken, provider: () => 1 })
      .withInstalledModules([outer]))
      .toThrow('token kind');
  });

  test('returns immutable views and snapshots the options bag', () => {
    const options = { currentRequirementKey: 'config', newRequirementKey: 'ordersConfig' } as const;
    const renamed = ordersModule.withRenamedRequirement(options);
    expect(renamed).not.toBe(ordersModule);
    expect(Object.isFrozen(renamed)).toBe(true);
    expect(renamed.withRenamedRequirement({ currentRequirementKey: 'ordersConfig', newRequirementKey: 'ordersConfig' })).toBe(renamed);
  });

  test('rejects malformed bags, known exports, stale names, and recorded collisions with final codes', () => {
    const feature = DiBag.createBuilder().withServices({
      shown: () => 1,
      result: ({ first, second }: { first: number; second: number }) => first + second,
    }).buildModule({ exportedServiceKeys: ['shown', 'result'] });
    const malformed = () => (feature.withRenamedRequirement as Function)({ currentRequirementKey: 1, newRequirementKey: 'x' });
    expect(malformed).toThrow('currentRequirementKey');
    try { malformed(); } catch (error: any) {
      expect(error.code).toBe('DI_BAG_INVALID_ARGUMENT');
      expect(error.details).toEqual({ operation: 'withRenamedRequirement', argument: 'currentRequirementKey', expected: 'a string' });
    }
    const unknown = () => (feature.withRenamedRequirement as Function)({ currentRequirementKey: 'shown', newRequirementKey: 'x' });
    expect(unknown).toThrow('existing requirement');
    try { unknown(); } catch (error: any) {
      expect(error.code).toBe('DI_BAG_UNKNOWN_SERVICE_KEY');
      expect(error.details).toEqual({ operation: 'withRenamedRequirement', serviceKey: 'shown' });
    }
    const first = (feature.withRenamedRequirement as Function)({ currentRequirementKey: 'first', newRequirementKey: 'one' });
    const second = (first.withRenamedRequirement as Function)({ currentRequirementKey: 'second', newRequirementKey: 'two' });
    const collision = () => (second.withRenamedRequirement as Function)({ currentRequirementKey: 'one', newRequirementKey: 'two' });
    expect(collision).toThrow('duplicate service key');
    try { collision(); } catch (error: any) {
      expect(error.code).toBe('DI_BAG_DUPLICATE_SERVICE_KEY');
      expect(error.details).toEqual({ operation: 'withRenamedRequirement', serviceKey: 'two' });
    }
    const stale = () => (first.withRenamedRequirement as Function)({ currentRequirementKey: 'first', newRequirementKey: 'other' });
    expect(stale).toThrow('existing requirement');
    try { stale(); } catch (error: any) {
      expect(error.code).toBe('DI_BAG_UNKNOWN_SERVICE_KEY');
      expect(error.details).toEqual({ operation: 'withRenamedRequirement', serviceKey: 'first' });
    }
  });
});
```

- [ ] **Step 2: Run the red test**

Run: `bun test tests/requirement-renaming.test.ts`

Expected: failures say `withRenamedRequirement is not a function`; no factory runs before a resolve.

- [ ] **Step 3: Add the complete type helpers, runtime state and method**

First add the five complete helper definitions printed in Task 2 Step 1 to `src/lifetime-types.ts` and `src/module-types.ts`, including their imports. This makes the public signature below green in the same commit; do not defer those definitions to Task 2.

Import `snapshotOptionsBag` in `src/module.ts`. Add `readonly requirementRenames: ReadonlyMap<string, string>` to `ModuleDescription`. Every `new Module(...)`, including `sealModule` and `withRenamedExport`, passes it; sealing starts with `new Map()`, and constructors snapshot it with `new Map(description.requirementRenames)`.

Add this exact method to `Module` after `withRenamedExport` (Task 2 Step 1 prints the helper types installed now):

````ts
/**
 * Return a module view that asks its host for a requirement under a new name.
 * Factory parameter names and private bindings retain their lexical meaning.
 * @param options - The current requirement and its noncolliding new host key.
 * @returns A new sealed module, or this module when both keys are equal.
 * @throws `DI_BAG_INVALID_ARGUMENT` for malformed options; `DI_BAG_UNKNOWN_SERVICE_KEY`
 * for a known non-requirement; `DI_BAG_DUPLICATE_SERVICE_KEY` for a known collision.
 * @remarks Type checking rejects unknown requirements and all name collisions.
 * Runtime checks cover only facts available without executing a factory.
 * @example
 * ```ts
 * const feature = DiBag.createBuilder()
 *   .withServices({ answer: ({ config }: { config: number }) => config })
 *   .buildModule({ exportedServiceKeys: ['answer'] });
 * const app = DiBag.createBuilder()
 *   .withInstalledModules([feature.withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'featureConfig' })])
 *   .withServices({ featureConfig: () => 42 }).buildContainer();
 * console.log(app.resolve('answer'));
 * await app.close();
 * ```
 */
withRenamedRequirement<const CurrentRequirementKey extends string, const NewRequirementKey extends string>(
  options: {
    readonly currentRequirementKey: CurrentRequirementKey & CurrentRequirementKeyAdmission<RequiredServices, CurrentRequirementKey>;
    readonly newRequirementKey: NewRequirementKey & NewRequirementKeyAdmission<ExportedServices, RequiredServices, CurrentRequirementKey, NewRequirementKey>;
  },
): Module<ExportedServices, Renamed<RequiredServices, CurrentRequirementKey, NewRequirementKey>, RenamedRequirementConstraints<Constraints, CurrentRequirementKey, NewRequirementKey>, RenamedRequirementProviders<PublicProviders, CurrentRequirementKey, NewRequirementKey>> {
  const { currentRequirementKey, newRequirementKey } = snapshotOptionsBag(
    options, 'withRenamedRequirement', ['currentRequirementKey', 'newRequirementKey'],
  );
  if (typeof currentRequirementKey !== 'string') {
    throw libraryError('DI_BAG_INVALID_ARGUMENT', 'withRenamedRequirement currentRequirementKey must be a string', {
      operation: 'withRenamedRequirement', argument: 'currentRequirementKey', expected: 'a string',
    });
  }
  if (typeof newRequirementKey !== 'string') {
    throw libraryError('DI_BAG_INVALID_ARGUMENT', 'withRenamedRequirement newRequirementKey must be a string', {
      operation: 'withRenamedRequirement', argument: 'newRequirementKey', expected: 'a string',
    });
  }
  const description = descriptions.get(this)!;
  const source = [...description.requirementRenames].find(([, hostKey]) => hostKey === currentRequirementKey)?.[0];
  if (description.exports.has(currentRequirementKey) || (description.requirementRenames.has(currentRequirementKey) && source === undefined)) {
    throw libraryError('DI_BAG_UNKNOWN_SERVICE_KEY', `withRenamedRequirement requires an existing requirement: ${currentRequirementKey}`, {
      operation: 'withRenamedRequirement', serviceKey: currentRequirementKey,
    });
  }
  if (currentRequirementKey === newRequirementKey) return this as never;
  if (description.exports.has(newRequirementKey) || [...description.requirementRenames].some(([original, hostKey]) => original !== source && hostKey === newRequirementKey)) {
    throw libraryError('DI_BAG_DUPLICATE_SERVICE_KEY', `duplicate service key: ${newRequirementKey}`, {
      operation: 'withRenamedRequirement', serviceKey: newRequirementKey,
    });
  }
  const requirementRenames = new Map(description.requirementRenames);
  requirementRenames.set(source ?? currentRequirementKey, newRequirementKey);
  return new Module({ graph: description.graph, exports: description.exports, label: description.label, requirementRenames });
}
````

This is deliberately the maximum runtime validation possible without reflection. An untyped first call naming an unknown, unobserved requirement is accepted; it stays silent when unused, and an actual dependency subsequently left unresolved fails during resolution. An untyped collision with an unobserved requirement is likewise not detectable here. Do not add an eager scan, execute factories, or parse source text.

Replace `moduleGraph` with this complete primary-S7 body. If phase 5 recorded the singular fallback, change only the signature/error operation to its recorded `withInstalledModule` form; the graph body is identical.

```ts
export function moduleGraph(value: unknown, operation: 'withInstalledModules', index: number): GraphDescription {
  const description = typeof value === 'object' && value !== null ? descriptions.get(value) : undefined;
  if (!description) {
    throw libraryError('DI_BAG_INVALID_MODULE', `withInstalledModules requires genuine modules: element ${index} is not one`, {
      operation, index,
    });
  }
  const { graph, exports, label, requirementRenames } = description;
  const exported = new Set<BindingId>();
  for (const localKey of exports.values()) exported.add(graph.publicSlots.get(localKey)!);
  const labelOf = (id: BindingId, binding: BindingDescription) =>
    label === undefined || exported.has(id) ? binding.label : `${label}/${binding.label}`;
  const ids = new Map<BindingId, BindingId>();
  for (const [id, binding] of graph.bindings) ids.set(id, Symbol(labelOf(id, binding)));
  const exportNames = new Map<BindingKey, BindingKey>();
  for (const [publicKey, localKey] of exports) exportNames.set(localKey, publicKey);
  const scopeNames = new Map<BindingKey, BindingRef>();
  for (const [key, id] of graph.publicSlots) {
    const publicKey = exportNames.get(key);
    scopeNames.set(key, publicKey === undefined
      ? { kind: 'private', id: ids.get(id)! }
      : { kind: 'public', key: publicKey });
  }
  const hostNames = new Map(scopeNames);
  for (const [localKey, hostKey] of requirementRenames) {
    if (!hostNames.has(localKey)) hostNames.set(localKey, { kind: 'public', key: hostKey });
  }
  const remap = (ref: BindingRef): BindingRef => ref.kind === 'private'
    ? { kind: 'private', id: ids.get(ref.id) ?? ref.id }
    : scopeNames.get(ref.key) ?? {
        kind: 'public',
        key: typeof ref.key === 'string' ? requirementRenames.get(ref.key) ?? ref.key : ref.key,
      };
  const nested = new Map<BindingDescription['localNames'], ReadonlyMap<BindingKey, BindingRef>>();
  const localNamesFor = (binding: BindingDescription): ReadonlyMap<BindingKey, BindingRef> => {
    if (binding.localNames.size === 0) return hostNames;
    let names = nested.get(binding.localNames);
    if (!names) {
      const merged = new Map(hostNames);
      for (const [name, ref] of binding.localNames) merged.set(name, remap(ref));
      names = merged;
      nested.set(binding.localNames, names);
    }
    return names;
  };
  const bindings = new Map<BindingId, BindingDescription>();
  for (const [id, binding] of graph.bindings) {
    const fresh = ids.get(id)!;
    bindings.set(fresh, {
      id: fresh, label: labelOf(id, binding), registration: binding.registration,
      localNames: localNamesFor(binding),
    });
  }
  const publicSlots = new Map<BindingKey, BindingId>();
  for (const [publicKey, localKey] of exports) publicSlots.set(publicKey, ids.get(graph.publicSlots.get(localKey)!)!);
  const contributions = new Map<symbol, BindingId[]>();
  for (const [key, group] of graph.contributions ?? []) contributions.set(key, group.map(id => ids.get(id)!));
  return {
    bindings,
    publicSlots,
    contributions,
    tokenKinds: new Map(graph.tokenKinds ?? []),
  };
}
```

Do not copy the 0.4.0 three-field return from current source. In `BindingGraph.withInstallation`, preserve phase 6's `operation` argument in the inherited host-versus-module `assertTokenKind` loop; this task does not replace that body.

- [ ] **Step 4: Add the two new error sections and pass the runtime test**

Create the two key-code sections if absent and otherwise extend their **When** lists; phase 6 already created `DI_BAG_INVALID_ARGUMENT`, so verify its existing section covers options bags and do not duplicate its heading. The target text is below. Do not migrate any old code yet.

Phase 5 selected the measured positional `withReplacedService(serviceKey, provider)` fallback. Keep that
shape in executable examples; options-bag spellings are historical/custom-map controls only.

````markdown
### DI_BAG_DUPLICATE_SERVICE_KEY {#di-bag-duplicate-service-key}

**When:** `withServices`, `withTokenService`, `withServiceAlias`,
`withInstalledModules`, `withRenamedExport` or `withRenamedRequirement` would
give two services the same key. `details.operation` names the call and
`details.serviceKey` the key.

**Cause:** a builder holds one service per key. Adding a key that exists is
never a replacement.

**Fix:** to change an existing service use `withReplacedService`; otherwise pick
another key, or rename the module's export before installing it.

```ts
import { DiBag } from 'di-bag';

const base = DiBag.createBuilder().withServices({ clock: () => ({ now: () => 0 }) });
const app = base.withReplacedService('clock', () => ({ now: () => 1 })).buildContainer();
console.log(app.resolve('clock').now());
await app.close();
```

### DI_BAG_INVALID_ARGUMENT {#di-bag-invalid-argument}

**When:** a call receives an argument of the wrong shape: a factory that is not a
function, an options bag that is not an object or holds an unknown property, an
option of the wrong type, a value outside a fixed set. Every public method
raises it, some as a `TypeError`.

**Cause:** the call site is not type-checked, or a cast silenced the compiler,
which rejects every one of these. `details` says exactly what was wrong:
`operation` is the method, `argument` is the parameter or option (a dotted path
for a nested option, `[]` for an element of a list), and `expected` completes
the sentence "must be ...".

**Fix:** branch on `details.argument`, not on the message. Remove the cast and
let the compiler point at the argument.

```ts
import { DiBag } from 'di-bag';

try {
  DiBag.createBuilder().withInstalledModules(42 as never);
} catch (error) {
  const { operation, argument, expected } = (error as { details: Record<string, unknown> }).details;
  console.error(`${String(operation)}: ${String(argument)} must be ${String(expected)}`);
}
```

### DI_BAG_UNKNOWN_SERVICE_KEY {#di-bag-unknown-service-key}

**When:** a call names a service key that the builder, container or module does
not have: `resolve`, `ensureServicesReady`, `withServiceAlias` (the target),
`withReplacedService`, `createChildContainer`, `createIndependentContainer`,
`buildModule` (an exported key), `withRenamedExport` and
`withRenamedRequirement` (the current key). `details.operation` names the call
and `details.serviceKey` the key.

**Cause:** the key is misspelled, was never registered, or is private to a
module. The compiler reports this first. For requirement renaming, runtime
checks cover only known exports and recorded rename facts; an unused unknown
requirement name can remain undetected because its type is erased.

**Fix:** register the service before the call, or correct the key.

```ts
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder().withServices({ clock: () => ({ now: () => 0 }) }).buildContainer();
console.log(app.resolve('clock').now());
await app.close();
```
````

Run: `bun test tests/requirement-renaming.test.ts tests/modules.test.ts tests/nested-modules.test.ts tests/persistent-module.test.ts`

Expected: pass. Leave these changes uncommitted. Continue through Task 4 and commit the verified source, tests, and checked documentation together.

---

### Task 2: Prove compile-time remapping and diagnostics

**Files:**
- Modify: `src/module-types.ts`, `src/lifetime-types.ts`, `src/module.ts`
- Create: `tests/types/requirement-renaming.ts`, `tests/types/requirement-renaming-consumer.ts`, `tests/types/negative/requirement-renaming.ts`
- Modify: `tests/types.test.ts`

**Interfaces:**
- Consumes: Task 1's `CurrentRequirementKeyAdmission`, `NewRequirementKeyAdmission`, `RenamedRequirementConstraints`, and `RenamedExternalObligation`.
- Preserves: consumers and factory parameter names; only external `needs` keys and external lifetime reaches change.

- [ ] **Step 1: Verify the exact helper implementations landed with Task 1**

Task 1 must have added this exact `src/lifetime-types.ts` code:

```ts
type RenamedExternalReach<X, Current extends string, New extends string> =
  X extends { readonly kind: 'external'; readonly key: Current }
    ? { readonly kind: 'external'; readonly key: New }
    : X;
/** Rename one external requirement inside retained lifetime obligations. */
export type RenamedExternalObligation<O, Current extends string, New extends string> =
  O extends { readonly kind: 'export-reach'; readonly export: infer K; readonly reach: infer X }
    ? { readonly kind: 'export-reach'; readonly export: K; readonly reach: RenamedExternalReach<X, Current, New> }
  : O extends { readonly kind: 'root-reach'; readonly root: infer Root; readonly reach: infer X }
    ? { readonly kind: 'root-reach'; readonly root: Root; readonly reach: RenamedExternalReach<X, Current, New> }
  : O extends { readonly kind: 'contribution-reach'; readonly group: infer T; readonly policy: infer Policy; readonly reach: infer X }
    ? { readonly kind: 'contribution-reach'; readonly group: T; readonly policy: Policy; readonly reach: RenamedExternalReach<X, Current, New> }
  : O;
```

It must also have imported that type and added this exact `src/module-types.ts` code:

```ts
type InvalidCurrentRequirement = Unsatisfied<'withRenamedRequirement requires an existing singleton string-literal requirement', {}>;
type InvalidNewRequirement = Unsatisfied<'withRenamedRequirement requires a noncolliding singleton string-literal name', {}>;

export type CurrentRequirementKeyAdmission<RequiredServices, Current extends string> =
  Singleton<Current> extends true ? Current extends keyof RequiredServices ? unknown : InvalidCurrentRequirement : InvalidCurrentRequirement;

export type NewRequirementKeyAdmission<ExportedServices, RequiredServices, Current extends string, New extends string> =
  Singleton<New> extends true
    ? New extends Current ? unknown
      : New extends keyof ExportedServices | Exclude<keyof RequiredServices, Current> ? InvalidNewRequirement : unknown
    : InvalidNewRequirement;

export type RenamedRequirementConstraints<C extends NeedConstraint, Current extends string, New extends string> =
  C extends LifetimeObligation ? RenamedExternalObligation<C, Current, New>
  : C extends { readonly kind: 'external'; readonly consumer: string | symbol; readonly needs: object }
    ? { readonly consumer: C['consumer']; readonly needs: Renamed<C['needs'], Current, New>; readonly kind: 'external' }
  : C;

/** Retarget retained public aliases that reach the renamed external requirement. */
export type RenamedRequirementProviders<Providers extends object, Current extends string, New extends string> = {
  [K in keyof Providers]: RenamedAlias<Providers[K], Current, New>;
};
```

- [ ] **Step 2: Create complete positive and consumer fixtures**

Create `tests/types/requirement-renaming.ts`:

```ts
import { DiBag, type ModuleRequiredServices } from '../../src';
import type { Assert, Equal } from './assert';
type Config = { value: number };
export const renamed = DiBag.createBuilder().withServices({
  service: ({ config }: { config: Config }) => config.value,
}).buildModule({ exportedServiceKeys: ['service'] })
  .withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'featureConfig' });
export type Requirement = Assert<Equal<ModuleRequiredServices<typeof renamed>, Readonly<{ featureConfig: Config }>>>;
export const rerouted = renamed.withRenamedRequirement({ currentRequirementKey: 'featureConfig', newRequirementKey: 'appConfig' });
export const host = DiBag.createBuilder().withInstalledModules([rerouted])
  .withServices({ appConfig: (): Config => ({ value: 1 }) }).buildContainer();
export const result: number = host.resolve('service');
export const strict = DiBag.createBuilder().withServices({
  service: DiBag.withLifetime(({ config }: { config: Config }) => config.value, 'root'),
}).buildModule({ exportedServiceKeys: ['service'] })
  .withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'strictConfig' });
DiBag.createBuilder().withInstalledModules([strict])
  .withServices({ strictConfig: DiBag.withLifetime((): Config => ({ value: 1 }), 'root') })
  .buildContainer();
```

Create `tests/types/requirement-renaming-consumer.ts`:

```ts
import { DiBag, type ModuleRequiredServices } from '../../src';
import { renamed, rerouted } from './requirement-renaming.js';
import type { Assert, Equal } from './assert';
type Config = { value: number };
export type First = Assert<Equal<ModuleRequiredServices<typeof renamed>, Readonly<{ featureConfig: Config }>>>;
export type Second = Assert<Equal<ModuleRequiredServices<typeof rerouted>, Readonly<{ appConfig: Config }>>>;
DiBag.createBuilder().withInstalledModules([rerouted]).withServices({ appConfig: (): Config => ({ value: 2 }) }).buildContainer();
```

Append this exact direct-consumer test to `tests/types.test.ts`:

```ts
test('requirement-renaming retains exact cross-file contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/requirement-renaming-consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});
```

Append the literal `'requirement-renaming'` to the existing declaration-consumption loop's fixture list; retain every previous fixture. The existing `negativeFixtures` discovery reads every `types/negative/*.ts`, so the negative file requires no separate registration. The focused command below matches all three tests by the hyphenated fixture name.

- [ ] **Step 3: Create complete negative fixtures with property-local markers**

Create `tests/types/negative/requirement-renaming.ts`:

```ts
import { DiBag } from '../../../src';
type Config = { value: number };
const module = DiBag.createBuilder().withServices({
  shown: () => 1,
  service: ({ config, region }: { config: Config; region: string }) => config.value + region.length,
}).buildModule({ exportedServiceKeys: ['shown', 'service'] });

module.withRenamedRequirement({
  // diagnostic: withRenamedRequirement requires an existing singleton string-literal requirement
  currentRequirementKey: 'missing',
  newRequirementKey: 'other',
});
module.withRenamedRequirement({
  currentRequirementKey: 'config',
  // diagnostic: withRenamedRequirement requires a noncolliding singleton string-literal name
  newRequirementKey: 'region',
});
module.withRenamedRequirement({
  currentRequirementKey: 'config',
  // diagnostic: withRenamedRequirement requires a noncolliding singleton string-literal name
  newRequirementKey: 'shown',
});
declare const widened: string;
module.withRenamedRequirement({
  // diagnostic: withRenamedRequirement requires an existing singleton string-literal requirement
  currentRequirementKey: widened,
  newRequirementKey: 'other',
});
const renamed = module.withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'featureConfig' });
DiBag.createBuilder().withInstalledModules([renamed]).withServices({
  // diagnostic: provided service does not satisfy its consumer dependency; see https://dany-fedorov.github.io/di-bag/agent/errors.html#wrong-shape
  featureConfig: () => ({ value: 'wrong' }),
  region: () => 'eu',
}).buildContainer();
```

Append these additional cases to the negative fixture:

```ts
const token = DiBag.token(Symbol('config')).of<Config>();
module.withRenamedRequirement({
  // diagnostic: not assignable
  currentRequirementKey: token,
  newRequirementKey: 'other',
});
module.withRenamedRequirement({
  currentRequirementKey: 'config',
  // diagnostic: not assignable
  newRequirementKey: Symbol('other'),
});
const strict = DiBag.createBuilder().withServices({
  service: DiBag.withLifetime(({ config }: { config: Config }) => config.value, 'root'),
}).buildModule({ exportedServiceKeys: ['service'] })
  .withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'strictConfig' });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([strict])
  .withServices({ strictConfig: (): Config => ({ value: 1 }) }).buildContainer();
```

These use the phase-entry lifetime values; phase 9 renames those values and phase 11 updates deferred message wording. The capture marker follows the existing lifetime fixture's graph-expression location. The isolated controller probe verifies that a capture error exists, not this final location.

The wrong-shape diagnostic details must name consumer `service`, dependency `featureConfig`, expected `Config`, and the provided object shape. The final phase-entry design and diagnostic locations remain uncompiled; the narrower controller type probe is recorded below. Repair a failing signature or diagnostic site up to the master's three serious attempts; then use Task 6's fallback if it still fails, or use the fallback when the cumulative budget is exceeded.

- [ ] **Step 4: Run type tests and commit**

Run: `bun test tests/types.test.ts -t "requirement renaming|requirement-renaming"`

Expected: positive and declaration-consumer cases have no diagnostics; all negative markers match at their documented properties or graph-expression sites.

Leave these changes uncommitted. Continue through Task 4 and commit the verified source, tests, and checked documentation together.

---

### Task 3: Teach the static graph extractor requirement views

**Files:**
- Modify: `tools/graph/lib/extract.mjs`
- Modify: `tools/graph/test/fixtures/cross-module/app.ts`
- Modify: `tools/graph/test/cross-module.test.mjs`
- Preserve and extend: `tools/graph/test/renamed-exports.test.mjs`

**Interfaces:**
- Produces: ordered `exportRenames` and `requirementRenames` for literal `withRenamedExport` / `withRenamedRequirement` bags while retaining positional `renameExport` support for 0.4.0 projects.

- [ ] **Step 1: Add a failing fixture and assertion**

Append to the fixture app:

```ts
export const renamedRequirement = DiBag.createBuilder()
  .withInstalledModules([billingModule.withRenamedRequirement({ currentRequirementKey: 'shipping', newRequirementKey: 'delivery' })])
  .withServices({ delivery: () => ({ label: () => 'ok' }) })
  .buildContainer();
```

Also append these complete fixture hosts to the same `app.ts`:

```ts
export const repeatedRequirement = DiBag.createBuilder()
  .withInstalledModules([billingModule
    .withRenamedRequirement({ currentRequirementKey: 'shipping', newRequirementKey: 'delivery' })
    .withRenamedRequirement({ currentRequirementKey: 'delivery', newRequirementKey: 'transport' })])
  .withServices({ transport: () => ({ label: () => 'ok' }) }).buildContainer();
export const exportFirstRequirement = DiBag.createBuilder()
  .withInstalledModules([billingModule
    .withRenamedExport({ currentExportKey: 'billing', newExportKey: 'invoice' })
    .withRenamedRequirement({ currentRequirementKey: 'shipping', newRequirementKey: 'delivery' })])
  .withServices({ delivery: () => ({ label: () => 'ok' }) }).buildContainer();
export const requirementFirstExport = DiBag.createBuilder()
  .withInstalledModules([billingModule
    .withRenamedRequirement({ currentRequirementKey: 'shipping', newRequirementKey: 'delivery' })
    .withRenamedExport({ currentExportKey: 'billing', newExportKey: 'invoice' })])
  .withServices({ delivery: () => ({ label: () => 'ok' }) }).buildContainer();
const nestedRequirementModule = DiBag.createBuilder()
  .withInstalledModules([billingModule.withRenamedRequirement({ currentRequirementKey: 'shipping', newRequirementKey: 'delivery' })])
  .buildModule({ exportedServiceKeys: ['billing'] });
export const nestedRequirementHost = DiBag.createBuilder()
  .withInstalledModules([nestedRequirementModule.withRenamedRequirement({ currentRequirementKey: 'delivery', newRequirementKey: 'transport' })])
  .withServices({ transport: () => ({ label: () => 'ok' }) }).buildContainer();
declare const requirementName: string;
declare const requirementOptions: { currentRequirementKey: string; newRequirementKey: string };
export const dynamicRequirement = DiBag.createBuilder()
  .withInstalledModules([billingModule.withRenamedRequirement({ currentRequirementKey: requirementName, newRequirementKey: 'delivery' })])
  .withServices({ delivery: () => ({ label: () => 'ok' }) }).buildContainer();
export const dynamicRequirementBag = DiBag.createBuilder()
  .withInstalledModules([billingModule.withRenamedRequirement(requirementOptions)])
  .withServices({ delivery: () => ({ label: () => 'ok' }) }).buildContainer();
```

These are syntactic graph fixtures; as in the existing fixture, they need not type-check. Use the recorded S7 singular installation spelling when required.

Append to `cross-module.test.mjs`:

```js
test('literal requirement renames satisfy static cross-module edges', () => {
  for (const name of ['renamedRequirement', 'repeatedRequirement', 'exportFirstRequirement', 'requirementFirstExport', 'nestedRequirementHost']) {
    const id = idOf('app.ts', `export const ${name} =`);
    const unit = graph.units.find(candidate => candidate.id === id);
    assert(unit, `missing extracted host ${name}`);
    assert.deepEqual(unit.installs, [name === 'nestedRequirementHost'
      ? idOf('app.ts', 'const nestedRequirementModule =')
      : idOf('billing.ts', 'export const billingModule')], name);
    assert.deepEqual(issuesOf(id), [], name);
  }
});

test('dynamic requirement names and bags remain opaque', () => {
  for (const name of ['dynamicRequirement', 'dynamicRequirementBag']) {
    const id = idOf('app.ts', `export const ${name} =`);
    const unit = graph.units.find(candidate => candidate.id === id);
    assert(unit, `missing extracted host ${name}`);
    assert(unit.installs.some(value => value.includes('withRenamedRequirement')), name);
    assert.deepEqual(issuesOf(id), [], name);
  }
});
```

Run: `node --test tools/graph/test/cross-module.test.mjs`

Expected: the new unit reports unresolved dependency `shipping`.

- [ ] **Step 2: Implement literal view-chain extraction**

Generalize phase6's final strict `renamedExportPair` into `literalBagPair` below, retaining its existing `optionsBag` and `literalString` helpers. Use the generalized parser from `moduleView` and `resolveInstalls`. Preserve all phase6 graph regressions, and add equivalent requirement-bag controls for closed literal values, outer-expression unwrapping, same-name identity, and whole-view opacity for shorthand/identifier/spread/nonliteral inputs. Never interpret a variable name as its string value or accept duplicate/extra keys:

```js
function literalBagPair(call, currentName, newName) {
  const bag = optionsBag(call);
  if (!bag || bag.properties.length !== 2) return undefined;
  const values = new Map();
  for (const property of bag.properties) {
    if (!ts.isPropertyAssignment(property) || ts.isComputedPropertyName(property.name)
        || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) return undefined;
    const name = property.name.text;
    if (![currentName, newName].includes(name) || values.has(name)) return undefined;
    const value = literalString(property.initializer);
    if (value === undefined) return undefined;
    values.set(name, value);
  }
  const current = values.get(currentName), next = values.get(newName);
  if (current === undefined || next === undefined) return undefined;
  return current === next ? [] : [current, next];
}

function moduleView(expression) {
  const exportRenames = [], requirementRenames = [];
  let current = skipOuter(expression);
  while (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
    const name = methodName(current);
    if (name === 'renameExport') {
      const [from, to] = current.arguments;
      if (from && to) exportRenames.unshift([keyText(from), keyText(to)]);
    } else if (name === 'withRenamedExport') {
      const pair = literalBagPair(current, 'currentExportKey', 'newExportKey');
      if (!pair) break;
      if (pair.length > 0) exportRenames.unshift(pair);
    } else if (name === 'withRenamedRequirement') {
      const pair = literalBagPair(current, 'currentRequirementKey', 'newRequirementKey');
      if (!pair) break;
      if (pair.length > 0) requirementRenames.unshift(pair);
    } else break;
    current = skipOuter(current.expression.expression);
  }
  return { expression: current, exportRenames, requirementRenames };
}
```

Replace the complete `resolveInstalls` and `instantiate` bodies with these. Keep phase 6's `readUnit` array-install handling; it still produces the individual `unit.installs` expressions these functions consume:

```js
function resolveInstalls(units, checker) {
  const byTerminal = new Map(units.map(unit => [unit.terminal, unit]));
  for (const unit of units) {
    unit.installRefs = unit.installs.map(argument => {
      const view = moduleView(argument);
      const initializer = ts.isIdentifier(view.expression) ? initializerOf(view.expression, checker) : view.expression;
      const target = initializer && byTerminal.get(skipOuter(initializer));
      return {
        unit: target?.kind === 'module' ? target : undefined,
        label: view.expression.getText(),
        exportRenames: view.exportRenames,
        requirementRenames: view.requirementRenames,
      };
    });
    unit.installs = unit.installRefs.map((ref, index) => ref.unit?.id ?? unit.installs[index].getText());
  }
  for (const unit of units) delete unit.terminal;
}

function instantiate(unit, prefix, outer, graph, active) {
  const local = new Set(unit.nodes.map(node => node.key));
  const aliases = new Map(unit.aliases.map(alias => [alias.from, alias.to]));
  let opaque = false;
  const installed = [];
  for (const ref of unit.installRefs) {
    if (!ref.unit || active.has(ref.unit)) { opaque = true; continue; }
    const exported = new Map(ref.unit.exports.map(key => [key, key]));
    for (const [from, to] of ref.exportRenames) {
      if (exported.has(from)) { exported.set(to, exported.get(from)); exported.delete(from); }
    }
    const requirements = new Map();
    for (const [from, to] of ref.requirementRenames) {
      const original = [...requirements].find(([, current]) => current === from)?.[0] ?? from;
      requirements.set(original, to);
    }
    active.add(ref.unit);
    // The module's own label matches runtime messages; the install expression names unlabeled modules.
    const own = instantiate(ref.unit, `${prefix}${ref.unit.label ?? ref.label}/`, name => lookup(requirements.get(name) ?? name), graph, active);
    active.delete(ref.unit);
    installed.push({ exported, own });
  }
  // Returns { id } for a node, { opaque: true } when an untraceable install may supply the name, or undefined.
  const own = (name, seen = new Set()) => {
    if (local.has(name)) return { id: prefix + name };
    if (aliases.has(name) && !seen.has(name)) return own(aliases.get(name), seen.add(name));
    for (const install of installed) if (install.exported.has(name)) return install.own(install.exported.get(name));
    return opaque ? { opaque: true } : undefined;
  };
  const lookup = name => {
    const found = own(name);
    if (found?.id || !outer) return found;
    return outer(name) ?? found;
  };
  // Resolved after every install exists: a requirement may name a module installed later.
  const top = prefix ? prefix.split('/')[0] : '';
  for (const node of unit.nodes) {
    graph.set(prefix + node.key, { top, dependencies: node.dependencies.map(name => ({ name, lookup })) });
  }
  return own;
}

```

The surrounding phase-6 support for array installation remains unchanged. A nonliteral bag makes the installation opaque, exactly as an untraceable module expression does.

- [ ] **Step 3: Pass graph tests and commit**

Run: `node --test tools/graph/test/*.test.mjs`

Expected: pass, including old positional export rename and the new requirement case.

Leave these changes uncommitted. Continue through Task 4 and commit the verified source, tests, and checked documentation together.

---

### Task 4: Ship checked agent documentation

**Files:**
- Modify: `AGENTS.md`, `docs/agent/recipes.md`, `tools/docs/api-card-tasks.json`, `tools/docs/test/api-card.test.mjs`, `tools/docs/test/exact-rendering.test.mjs`
- Regenerate: `docs/agent/api-card.md`, `docs/reference/index/**`

**Interfaces:**
- Produces: one discoverable API-card row and a copyable two-config recipe.

- [ ] **Step 1: Make the exact source edits**

Replace the final sentence of AGENTS rule 8, without adding a line, with: `Rename colliding string requirements with module.withRenamedRequirement({ currentRequirementKey, newRequirementKey }); tokens keep their global identity.` Keep the phase-6 method names already present in that rule.

Append this recipe section to `docs/agent/recipes.md`, using the existing heading depth:

````markdown
## Install modules that both require `config` {#rename-module-requirements}

Rename each module value at the install site. The factories still read `config`;
the host supplies the new names.

```ts
import { DiBag } from 'di-bag';
type OrdersConfig = { currency: string };
type BillingConfig = { vatRate: number };
const ordersModule = DiBag.createBuilder().withServices({
  orders: ({ config }: { config: OrdersConfig }) => config.currency,
}).buildModule({ exportedServiceKeys: ['orders'] });
const billingModule = DiBag.createBuilder().withServices({
  billing: ({ config }: { config: BillingConfig }) => config.vatRate,
}).buildModule({ exportedServiceKeys: ['billing'] });

const app = DiBag.createBuilder()
  .withInstalledModules([
    ordersModule.withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'ordersConfig' }),
    billingModule.withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'billingConfig' }),
  ])
  .withServices({
    ordersConfig: (): OrdersConfig => ({ currency: 'EUR' }),
    billingConfig: (): BillingConfig => ({ vatRate: 0.2 }),
  })
  .buildContainer();
console.log(app.resolve('orders'), app.resolve('billing'));
await app.close();
```
````

Insert `{ "task": "Rename a module requirement", "call": "module.withRenamedRequirement" }` after the existing module-install row (`builder.withInstalledModules`, or its recorded S7 singular fallback) in `tools/docs/api-card-tasks.json`; preserve every earlier row. Append these exact tests, using the existing page/project variables:

```js
// tools/docs/test/exact-rendering.test.mjs
test('requirement renaming publishes both labeled keys', () => {
  const text = compact(moduleInterface);
  assert.match(text, /withRenamedRequirement<const CurrentRequirementKey extends string, const NewRequirementKey extends string>/);
  assert.match(text, /currentRequirementKey: CurrentRequirementKey/);
  assert.match(text, /newRequirementKey: NewRequirementKey/);
});
```

```js
// tools/docs/test/api-card.test.mjs
test('requirement renaming has one task and a documented runtime call', () => {
  assert.equal(tasks.filter(task => task.call === 'module.withRenamedRequirement').length, 1);
  assert(runtimeSurface(project).some(item => item.name === 'module.withRenamedRequirement'));
  assert.match(renderApiCard(project, tasks), /module\.withRenamedRequirement/);
});
```

- [ ] **Step 2: Generate and test**

```bash
npm run build
npm run docs:generate
node --test tools/docs/test/api-card.test.mjs tools/docs/test/api-card-summaries.test.mjs tools/docs/test/exact-rendering.test.mjs
npm run docs:check
```

Expected: pass; generated reference and API card contain the new method and both new error anchors; `wc -l AGENTS.md` is at most 150.

```bash
git add src/module.ts src/module-types.ts src/lifetime-types.ts tests/requirement-renaming.test.ts tests/types.test.ts tests/types/requirement-renaming.ts tests/types/requirement-renaming-consumer.ts tests/types/negative/requirement-renaming.ts tools/graph/lib/extract.mjs tools/graph/test/fixtures/cross-module/app.ts tools/graph/test/cross-module.test.mjs tools/graph/test/renamed-exports.test.mjs AGENTS.md docs/agent docs/reference tools/docs
git commit -m "feat: add checked module requirement renaming" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL"
```

---

### Task 5: Measure S6 and record the decision

**Files:**
- Modify: `tests/compiler.ts`
- Create: `scripts/check-requirement-rename-scale.ts`
- Create: `docs/superpowers/plans/evidence/phase-07.md`

**Interfaces:**
- Produces: `requirementRenameScaleSource(count)` and one JSON worker row with `accepted`, `diagnosticCount`, `instantiations`, `milliseconds`, `maxRssMiB`.

- [ ] **Step 1: Add the complete source generator**

Append to `tests/compiler.ts`:

```ts
export function requirementRenameScaleSource(count: number): string {
  if (!Number.isInteger(count) || count < 1) throw new Error('requirement rename scale count must be at least one');
  const modules = Array.from({ length: count }, (_, index) => `
const feature${index} = DiBag.createBuilder().withServices({
  service${index}: ({ config }: { config: { value: ${index} } }) => config.value,
}).buildModule({ exportedServiceKeys: ['service${index}'] })
  .withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'config${index}' });`).join('\n');
  const installed = Array.from({ length: count }, (_, index) => `feature${index}`).join(', ');
  const configs = Array.from({ length: count }, (_, index) => `config${index}: () => ({ value: ${index} as const })`).join(',\n');
  return `import { DiBag } from '../src';\n${modules}\nconst container = DiBag.createBuilder().withInstalledModules([${installed}]).withServices({${configs}}).buildContainer();\nconst result: ${count - 1} = container.resolve('service${count - 1}');\n`;
}
```

If S7 selected the singular fallback, replace the generator's `installed` declaration and its final return with exactly:

```ts
const installed = Array.from({ length: count }, (_, index) => `.withInstalledModule(feature${index})`).join('');
return `import { DiBag } from '../src';\n${modules}\nconst container = DiBag.createBuilder()${installed}.withServices({${configs}}).buildContainer();\nconst result: ${count - 1} = container.resolve('service${count - 1}');\n`;
```

Keep the `configs` declaration before the return.

Create `scripts/check-requirement-rename-scale.ts`:

```ts
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import ts from 'typescript';
import { compilerProgram, describeDiagnostic, requirementRenameScaleSource } from '../tests/compiler.ts';

const count = Number(process.argv[2]);
if (process.argv.length !== 3 || count !== 20) throw new Error('usage: check-requirement-rename-scale.ts 20');
const source = requirementRenameScaleSource(count);
const path = resolve('tests/generated-requirement-rename-scale.ts');
const start = performance.now();
const program = compilerProgram(path, source);
program.getTypeChecker();
const diagnostics = ts.getPreEmitDiagnostics(program).map(describeDiagnostic);
const instantiations = program.getInstantiationCount();
const milliseconds = Math.round(performance.now() - start);
const maxRssMiB = Math.round(process.resourceUsage().maxRSS / 1024);
console.log(JSON.stringify({
  case: 'requirements-20', count, accepted: diagnostics.length === 0,
  diagnosticCount: diagnostics.length, diagnostics, instantiations,
  milliseconds, maxRssMiB, typescript: ts.version, node: process.version,
}));
```

- [ ] **Step 2: Run the authoritative measurements**

These measurements are heavy commands and require the controller to confirm that the preserved heavy-command hold was explicitly lifted. The 6 GiB single-source-check exception does not authorize the evidence CLI or this worker. Once that prerequisite is met, run exactly:

```bash
node scripts/evidence-cases.mjs --compare docs/superpowers/plans/evidence/baseline.md --json /tmp/phase-07-evidence.json
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-requirement-rename-scale.ts 20 | tee /tmp/phase-07-requirements-20.json
```

Expected: all twelve rows accepted and each `change <= 10%`; the S6 row has `accepted: true`, `diagnosticCount: 0`. Record actual rows, tool/compiler versions, hardware, commit, and commands in `phase-07.md`. Adopt only if the compile fixtures and property locations pass and cumulative budget passes. Do not claim an unrun number.

- [ ] **Step 3: Commit an adopted result**

```bash
git add tests/compiler.ts scripts/check-requirement-rename-scale.ts docs/superpowers/plans/evidence/phase-07.md
git commit -m "test(evidence): record requirement rename cost" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL"
```

---

### Task 6: Execute the complete S6 fallback when required

**Files:**
- Revert/remove all feature files and edits from Tasks 1–5
- Modify: `docs/superpowers/plans/evidence/phase-07.md`

**Interfaces:**
- Trigger: an S6 signature/diagnostic failure remaining after three serious repair attempts, or a cumulative evidence row over 110%. Record the 20-module worker's acceptance and instantiations; it has no independent numeric ceiling without a comparable baseline.
- Produces: no `withRenamedRequirement` public API, as required by the spec fallback.

- [ ] **Step 1: Remove the feature coherently**

Delete `tests/requirement-renaming.test.ts`, all three requirement-renaming type fixtures, `scripts/check-requirement-rename-scale.ts`, and `requirementRenameScaleSource`. Remove the method, map, helper types, imports, graph extractor handling and fixture/assertion, AGENTS sentence, recipe, API-card task/test, generated reference entry, and only this phase's two new key-code sections if no source site anywhere under `src` still uses their codes. Preserve the pre-existing INVALID_ARGUMENT section and its earlier callers. Remove only requirement-view branches and their new controls from the generalized graph parser; retain phase6's exact export-view literal/opacity/identity behavior and every original `renamed-exports.test.mjs` regression. Regenerate docs. Leave every phase-0–6 row and declaration unchanged.

- [ ] **Step 2: Record and verify fallback**

In `phase-07.md`, retain the measured rows and state `S6: fallback — requirement renaming dropped`, the exact failed rule, and the wrapper-module workaround from spec example 6. Run the full Task-7 gate. Commit:

```bash
git add src/module.ts src/module-types.ts src/lifetime-types.ts tests/requirement-renaming.test.ts tests/types/requirement-renaming.ts tests/types/requirement-renaming-consumer.ts tests/types/negative/requirement-renaming.ts tests/types.test.ts tools/graph AGENTS.md docs/agent docs/reference tools/docs tests/compiler.ts scripts/check-requirement-rename-scale.ts docs/superpowers/plans/evidence/phase-07.md
git commit -m "revert: drop requirement renaming after S6" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL"
```

---

### Task 7: Contract audit and phase gate

**Files:**
- Modify: `tests/api-naming-known-violations.json` only if the ratchet itself removes an entry
- Audit: every phase file above and all migrated/generated surfaces

**Interfaces:**
- Produces: a green phase ready for controller review; no old API is removed in this additive behavior phase.

- [ ] **Step 1: Run focused audits**

```bash
grep -rn "withRenamedRequirement" src tests tools/graph AGENTS.md docs/agent | sort
grep -rn "operation: 'withRenamedRequirement'" src tests
grep -rhoE "toThrow\((/|['\`])[^)]*" tests | grep -iE "\b(requirement|withRenamedRequirement)\b" | sort | uniq -c
UPDATE_API_NAMING_VIOLATIONS=1 bun test tests/api-naming.test.ts
git diff -- tests/api-naming-known-violations.json
```

Expected: every validation site uses the final method name; the assertion inventory contains only the new deliberate strings and therefore has no old-to-new replacement; the naming-ratchet diff is empty. If the ratchet removes an entry, verify it actually described this newly added name before staging it; never add a violation.

- [ ] **Step 2: Run all required gates**

```bash
npm run check
npm run docs:check
npm run graph:check
npm run codemod:check
npm run typecheck:native
npm run build:native
npm run check:native
node --expose-gc --test --test-isolation=none tests/runtime-scale.node.mjs tests/acquisition-retention.node.mjs tests/graph-retention.node.mjs
npm run agent-eval:test
for example in examples/*.ts; do bun "$example"; done
```

Expected: every command exits 0. Then rerun the evidence CLI exactly as in Task 5 after any type edit and replace `phase-07.md` with the final rows.

- [ ] **Step 3: Report without overstating evidence**

Report the branch, commits, each gate's last summary line, all twelve cumulative percentages, the S6 20-module row and decision, whether S7 syntax was plural or fallback singular, and any deviation. State that runtime general unknown/collision validation is impossible over erased named dependencies and remains compile-time enforced. Never push, publish or merge.

## Planner Self-Review

**Spec coverage.** Task 1 covers immutable runtime renaming, nesting, re-renaming, module-export satisfaction, contributions, labels/snapshots, validation and the erased-type boundary. Task 2 covers required services, ordinary constraints, lifetime obligations, wrong host shapes, exact property diagnostics and declaration emit. Task 3 covers static graph extraction. Task 4 covers AGENTS, the example-6 recipe and generated API docs. Tasks 5–6 provide S6 measurement and the complete named fallback. Task 7 covers the naming ratchet, message inventory and every master gate.

**Runtime evidence.** `/tmp/di-bag-resume-20260921/probe-08/tests/zz-08-runtime-knowledge.test.ts` ran against untouched 0.4.0 source with pinned Bun 1.4.0: `2 pass, 0 fail`; it proved sealing/installing did not execute the factory, the frozen module exposed no own keys, the missing name appeared only at resolution, and a host key satisfied it. The proposed map was then adapted to a positional `renameRequirement` only in the private archive and exercised by `/tmp/di-bag-resume-20260921/probe-08/tests/zz-08-runtime-map.test.ts`: `1 pass, 0 fail`, covering direct, chained and nested rename, both export/requirement view orders, private shadowing, a contribution and no eager factory. The first prototype run exposed and fixed the `hostNames.has(localKey)` shadowing guard. Concise output is in `/tmp/di-bag-resume-20260921/probe-08/runtime-map.log`. Final 0.5.0 bags, validation and token-kind propagation were not present in that prototype.

**Type/evidence boundary.** The planner ran no compiler or evidence lane. The controller subsequently used the permitted serialized source-check exception in `/tmp/di-bag-resume-20260921/probe-08-types`: `node_modules/.bin/tsc6 -p tsconfig.json` exited 0 in 8.63 seconds, maximum RSS 1,157,532 KiB, with 11.1 GiB available before launch. It adds this plan's helper types and public bag signature to a separate 0.4.0 archive, adapting only the containing class's generic parameter names; the method body throws and proves no runtime behavior. `tests/types/requirement-plan-probe.ts` proves exact required-service projection, renamed-host acceptance, unknown/export-collision/wrong-host rejection, and retention of the external root-to-scoped capture obligation via checked `@ts-expect-error` directives. Log: `probe-08-types/typecheck.log`. This does not prove final phase-entry integration, declaration consumption, exact diagnostic property locations, token-kind behavior or compile cost. Those remain executor obligations in Tasks 2, 5 and 7; no heavy lane ran.

**Type consistency.** Requirement renaming changes `RequiredServices`, external named constraints, external lifetime reaches, and retained public-provider alias targets. It preserves exported-service/provider keys and outputs, consumer keys, token constraints, collection constraints, `GraphDescription.tokenKinds`, and `CreateChildContainerOptions`' inherited generic order.

**Codemod boundary.** The API is new, so `rename-map.json` gets no fabricated 0.4.0 mapping and no codemod fixture. Existing accumulated map entries and `api.nameOf` transforms remain unchanged. Graph tooling, which analyzes both 0.4.0 and 0.5.0 source, gets its own literal-chain support.

**Controller graph evidence.** After the review repairs, `/tmp/di-bag-resume-20260921/probe-08-graph` received the exact Task 3 extraction helpers/bodies and tests. Its fixture builder/terminal calls were mechanically adapted back to 0.4.0 names, retaining the new module view calls. `node --test --test-isolation=none tools/graph/test/cross-module.test.mjs` passed 9 tests, 0 failures. The literal cases assert that installed modules resolve to real unit IDs, so opaque installations cannot pass vacuously. Both dynamic key/bag cases assert opacity. Source adapter: `apply-probe.mjs`; captured output: `graph-probe-final.log`. This is a focused graph-tool proof, not the final accumulated phase-entry graph gate.
