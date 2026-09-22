# Provider Sources (Phase 8) Implementation Plan

> **Status: Controller-reviewed plan. Implementation and full phase verification remain pending.**
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 0.4.0 provider-source and token-authoring surface with the Swift-style `createProvider` family, explicit return-kind vocabulary, factory-context names, and token names while preserving every existing compile-time and runtime guarantee.

**Architecture:** Expand the facade with the new source constructors and immutable option-bag parsing, route all constructors through the existing provider-description and execution pipeline, and add positional factory context as a final argument. Measure spike S4 on the real type shape, then migrate the repository through accumulated codemod data and source-aware transforms before removing compatibility declarations at a separate green contract boundary.

**Tech Stack:** TypeScript 6.0.x type system and compiler API, Bun 1.4.0, Node 24, TypeDoc/VitePress, `di-bag` provider descriptions and execution runtime, and the phase-1 TypeScript-aware codemod.

**Spec:** `docs/superpowers/specs/2026-09-20-swift-api-style.md`, with worked examples in `docs/superpowers/specs/2026-09-20-swift-api-style-examples.md` and sequencing in `docs/superpowers/plans/2026-09-21-00-swift-api-style-master.md`.

## Global Constraints

- This is phase 8. Start from phases 0–7 merged on `next`; branch `phase-08-provider-sources`. Executors do not push, publish, merge, or revise the spec.
- Preserve the zero-runtime-dependency and browser-safe source contract. Do not import `node:` modules anywhere reachable from `src/index.ts`.
- Preserve phase 4 collection-token admission and runtime behavior, including `GraphDescription.tokenKinds` and fresh frozen collection replacement views backed by the provider-owned original list.
- Preserve the inherited generic prefix/default of `CreateChildContainerOptions<ServiceRegistrations, SharedParentServiceKeys, Constraints = never, ...>` and all finalized phase-5-to-phase-7 helper contracts. Reuse `snapshotOptionsBag(options, operation, required, optional?, inspectValue?)`; do not duplicate option-bag validation.
- Preserve accumulated codemod behavior. Map owners remain their original 0.4.0 declaration names, transforms emit renamed identifiers through `api.nameOf`, and nonliteral trailing option bags become manual items.
- Preserve the complete transform API (`ts`, `checker`, `program`, `library`, source/text/assembly helpers, `nameOf`, and `nameForRole`) and accumulated registry ids `build-and-start`, `collection-read`, `collection-reference`, `collection-token`, and `container-derivation`; `collection-tokens.mjs` remains a packed nonregistry helper.
- New malformed-argument failures use `DI_BAG_INVALID_ARGUMENT` with literal details `{ operation, argument, expected }` and the closed `expected` vocabulary. Closing/closed and singleton-captures-scoped message families remain unchanged for plan 12 Task 12.
- Every measured bag-method overload has a negative compiler fixture whose diagnostic is located on the offending property.
- All twelve evidence cases must stay at or below 110% of the phase-0 instantiation baseline. Spike S4 additionally proves contextual parameter inference from an inline dependencies bag; after three serious repairs or a budget breach, execute the complete positional fallback in this plan.
- Each declared commit is green. Contract removal and checked docs land together when separating them would make `docs:check` fail.
- `AGENTS.md` stays at or below 150 lines. Replace existing lines; do not add lines.
- Use pinned Bun `/tmp/claude-1000/-home-df-wd-personal-di-bag/7818417c-3b3a-48db-9bef-85624eff953b/scratchpad/bun/bin/bun` (1.4.0).
- Evidence, benchmark, compiler, build, and full-gate lanes remain held until the controller explicitly lifts the applicable hold. Permission to run one serialized `tsc6` fixture with at least 6 GiB available authorizes only that fixture; it does not authorize evidence or the full gate.
- Planning-time type signatures are uncompiled. The executor must prove the positive and negative cases in this plan before adopting them.

## State on entry

Phases 0–7 are merged. Builder, container, and module calls use their 0.5 names. Requirement renaming exists. Provider-source names remain at 0.4.0: `fromFactory`, `fromSyncFactory`, `fromAsyncFactory`, `fromFunction`, `fromClass`, `fromPlugin`, `token(symbol).of<Service>()`, `AcquisitionMode`, `AcquisitionContext`, and `BindingSnapshot.acquisitionMode`. Provider decorators remain facade functions until phase 9.

Before executing any task, read the final `docs/superpowers/plans/evidence/phase-04.md`. A selected but budget-unverified S5 fallback is not adopted evidence. If it records `Decision: fallback`, collection reads use `resolveCollection`; ordinary `resolve` remains single-service-only. Preserve the accumulated map, including plan 07's final `inspectAll -> serviceSnapshot` target, and Phase 4's exact four-entry naming-ratchet shrink.

Run these checks before changing source:

```bash
export PATH="/tmp/claude-1000/-home-df-wd-personal-di-bag/7818417c-3b3a-48db-9bef-85624eff953b/scratchpad/bun/bin:$PATH"
export npm_config_update_notifier=false
bun --version
node --version
git status --short

rg -n "withServices|withTokenService|withCollectionContribution|buildContainer|createChildContainer|createIndependentContainer|withRenamedRequirement" src/di-bag.ts src/module.ts
rg -n "fromFactory|fromSyncFactory|fromAsyncFactory|fromFunction|fromClass|fromPlugin|readonly token:|AcquisitionMode|AcquisitionContext" src/di-bag.ts src/index.ts src/acquisition-context.ts src/composition.ts src/plugins.ts
rg -n "tokenKinds" src/runtime.ts src/module.ts
rg -n "export function snapshotOptionsBag|inspectValue" src/options-bag.ts
rg -n "freshCollectionView" src
node -e "const m=require('./tools/codemod/rename-map.json'); console.log(m.version, m.methods.length, m.types.length)"
```

Expected: Bun `1.4.0`; Node `v24.20.0`; only controller-owned changes in `git status`; the first grep finds every phase-5-to-phase-7 name; the second finds the old provider-source surface and none of `createProviderFromFunction`, `FactoryReturnKind`, or `FactoryContext`; `tokenKinds`, the five-parameter helper whose last two parameters are optional, and `freshCollectionView` are present. Phase 7's `ModuleDescription.requirementRenames` and `withRenamedRequirement` are present; every graph-description copy retains `tokenKinds`, while every module-description copy separately retains `requirementRenames`.

The following contracts are fixed on entry and are not redesigned here:

```ts
export function snapshotOptionsBag(
  options: unknown,
  operation: string,
  required: readonly string[],
  optional: readonly string[] = [],
  inspectValue?: (name: string, value: unknown) => void,
): Record<string, unknown>;

export interface GraphDescription {
  readonly bindings: ReadonlyMap<BindingId, BindingDescription>;
  readonly publicSlots: ReadonlyMap<BindingKey, BindingId>;
  readonly contributions?: ReadonlyMap<symbol, readonly BindingId[]>;
  readonly tokenKinds?: ReadonlyMap<symbol, TokenKind>;
}

export type CreateChildContainerOptions<
  ServiceRegistrations extends Registrations,
  SharedParentServiceKeys extends readonly unknown[],
  Constraints extends NeedConstraint = never,
  ReplacedServiceKeys extends readonly unknown[] = readonly [],
  ReplacementProviders = never,
> = ReplacementOptions<ServiceRegistrations, Constraints, ReplacedServiceKeys, ReplacementProviders, 'createChildContainer'> & {
  readonly sharedParentServiceKeys?: SharedParentServiceKeys
    & Selection<ServiceRegistrations, Constraints, SharedParentServiceKeys, 'createChildContainer sharedParentServiceKeys'>
    & ScopeShareAdmission<SharedParentServiceKeys> & (
    [Transients<ServiceRegistrations, SharedParentServiceKeys>] extends [never] ? unknown
      : Unsatisfied<'createChildContainer cannot share transient providers', { tokens: Transients<ServiceRegistrations, SharedParentServiceKeys> }>
  );
} & DisjointChildContainerSelection<ReplacedServiceKeys, SharedParentServiceKeys>;
```

`ReplacementOptions` and `DisjointChildContainerSelection` remain the complete accepted phase-6 helpers; the declaration above is the exact accepted public alias. Collection replacement providers keep ownership of the original array. Every public collection read, lazy read, and alias read returns a new shallow copy frozen by `freshCollectionView`.

## File Structure

| Path | Action | Responsibility |
| --- | --- | --- |
| `src/acquisition-mode.ts` | modify | `FactoryReturnKind`, return-kind admission helpers, runtime option parsing, classifier wording |
| `src/acquisition-context.ts` | modify | `FactoryContext`, `createProvider`, contextual named factories |
| `src/acquisition.ts`, `src/provider-execution.ts`, `src/provider-operations.ts`, `src/runtime.ts` | modify | internal return-kind/context field names and snapshot propagation without changing ownership |
| `src/composition.ts` | modify | bag-based positional function/class adapters and final factory context |
| `src/plugins.ts` | modify | bag-based plugin adapter and renamed plugin contracts |
| `src/tokens.ts`, `src/token-types.ts`, `src/dependency-references.ts` | modify | `createToken(symbol)`, `forService`, and `token.symbol` while retaining collection-token kinds |
| `src/inspection.ts`, `src/types.ts`, `src/provider.ts`, `src/registration.ts`, `src/di-bag.ts`, `src/index.ts` | modify | public signatures, snapshots, structural-thenable messages, exports, JSDoc |
| `tests/provider-sources.test.ts` | create | focused runtime coverage for all new source constructors, validation, snapshots, context ordering, and tokens |
| `tests/types/provider-sources.ts`, `tests/types/negative/provider-sources.ts` | create | exact positive types and property-located negative diagnostics, including spike S4 |
| existing relevant `tests/types/*.ts`, `tests/*.test.ts` | modify | mechanically migrate retained behavior tests; update only assertions whose provider-source wording changes |
| `tools/codemod/rename-map.json` | modify | original-owner 0.4-to-0.5 method, type, property, option, and value entries |
| `tools/codemod/lib/transforms/provider-sources.mjs` | create | complete source-family argument reshaping and manual reports |
| `tools/codemod/lib/transforms/index.mjs`, `tools/codemod/test/transforms.test.mjs` | modify | register and pin the transform |
| `tools/codemod/test/fixtures/provider-sources/{input.ts,expected.ts,expected-manual.json}` | create | exact golden migration and literal manual report |
| `scripts/benchmark-types.ts`, `scripts/check-token-scale.ts`, `tests/compiler.ts` | modify | final source names in generated evidence cases |
| `tools/graph/lib/extract.mjs`, graph fixtures/tests/README | inspect; create/modify tests and docs | prove provider wrappers remain transparent to the bilingual extractor; document final examples |
| `scripts/agent-eval/reference`, `scripts/agent-eval/skeleton`, `examples` | modify | final provider-source and token calls |
| `AGENTS.md`, `docs/agent/api-card.md`, `docs/agent/errors.md`, `docs/agent/recipes.md`, `tools/docs/api-card-tasks.json`, docs tests | modify | checked agent documentation and API-card contracts |
| `tests/api-naming-known-violations.json` | regenerate | remove this phase's acquisition-mode and mode-options entries |
| `docs/superpowers/plans/evidence/phase-08.md` | create | all twelve post-contract rows and S4 decision |

---

### Task 0: Entry audit and a clean phase branch

**Files:**
- Inspect only: the state-on-entry files and `docs/superpowers/plans/evidence/phase-07.md`

**Interfaces:**
- Consumes: phases 0–7 merged on `next`.
- Produces: branch `phase-08-provider-sources`, confirmed accumulated interfaces, and recorded pre-edit call-site counts.

- [ ] **Step 1: Create the phase branch and run the entry checks**

```bash
git switch next
git switch -c phase-08-provider-sources
# Run every command in State on Entry verbatim.
```

Expected: the branch is created and every state assertion holds. Stop and report to the controller if phase 7 is not merged or if the actual phase-5 helper has more than the four fixed parameters.

- [ ] **Step 2: Record exact migration counts**

```bash
rg -n "\b(fromFactory|fromSyncFactory|fromAsyncFactory|fromFunction|fromClass|fromPlugin)\b|\bAcquisitionMode\b|\bAcquisitionContext\b|\bPluginAcquisitionMode\b|\bPluginOptions\b|\bCompositionArguments\b|\bCompositionFunction\b|\bacquisitionMode\b|\bnativePromise\b|\.token\(|\.of<|\.key\b" src tests examples scripts tools AGENTS.md docs/agent > /tmp/phase-08-provider-source-sites.txt
wc -l /tmp/phase-08-provider-source-sites.txt
grep -rhoE "toThrow\((/|['\`])[^)]*" tests | grep -iE "\b(fromFactory|fromSyncFactory|fromAsyncFactory|fromFunction|fromClass|fromPlugin|acquisitionMode|nativePromise|token key|AcquisitionContext)\b" | sort | uniq -c
```

Expected: the first count is recorded in the phase report. At the 0.4.0 planning archive, the exact broken assertion strings were:

```text
1 toThrow('DI_BAG_INVALID_FACTORY: fromAsyncFactory context must be acquisition'
1 toThrow('DI_BAG_INVALID_FACTORY: fromAsyncFactory requires a function'
1 toThrow('DI_BAG_INVALID_FACTORY: fromAsyncFactory selects its acquisitionMode itself'
1 toThrow('DI_BAG_INVALID_FACTORY: fromSyncFactory options must be an object'
1 toThrow('DI_BAG_INVALID_FACTORY: fromSyncFactory requires a function'
1 toThrow('DI_BAG_INVALID_FACTORY: fromSyncFactory selects its acquisitionMode itself'
1 toThrow('acquisitionMode'
```

Replace those assertions with the exact new `createProvider` or `factoryReturnKind` text in Task 1; do not blanket-edit unrelated strings.

---

### Task 1: Expand `FactoryReturnKind`, `FactoryContext`, and `createProvider`

**Files:**
- Modify: `src/acquisition-mode.ts`, `src/acquisition-context.ts`, `src/acquisition.ts`, `src/provider-execution.ts`, `src/provider-operations.ts`, `src/provider.ts`, `src/runtime.ts`, `src/aliases.ts`, `src/inspection.ts`, `src/types.ts`, `src/di-bag.ts`, `src/index.ts`
- Create: `tests/provider-sources.test.ts`
- Create: `tests/types/provider-sources.ts`, `tests/types/provider-sources-consumer.ts`, `tests/types/negative/provider-sources.ts`
- Modify: `tests/types.test.ts`

**Interfaces:**
- Consumes: `snapshotOptionsBag(options, operation, required, optional?, inspectValue?)`; phase-2 `Provider<ExposedFactory, RegistrationMetadata, AcquisitionMetadataFrames, RetainedGraphContract, AcquiredValue>`; existing `sourceDescription`/`retainDescription` path.
- Produces: `FactoryReturnKind`, `FactoryContext`, `ContextualFactory`, `createProvider`, `BindingSnapshot.factoryReturnKind`, and internal source/stage descriptions using the same field name. Decorator option `transformService({ acquisitionMode })` keeps that public key through phase 8, but its accepted values are the new `FactoryReturnKind` strings.

This type design is **UNCOMPILED**. The executor must prove every positive and negative case below. `native-promise` through `createProvider` retains the old `NativeOutput` Promise requirement; `sync-value` retains `SyncOutput`; `auto-detect` retains structural-thenable rejection; `uninspected` retains exact identity and never reads `then`.

- [ ] **Step 1: Add failing runtime tests for the four return kinds and factory context**

Create `tests/provider-sources.test.ts` with this complete initial content. Later tasks append to this same file.

```ts
import { expect, test } from 'bun:test';
import { runInNewContext } from 'node:vm';
import { DiBag } from '../src';
import { withoutBuiltinModule } from './host-builtin-module';

test('createProvider preserves every factory return policy', async () => {
  let thenReads = 0;
  const structural = Object.defineProperty({}, 'then', { get() { thenReads++; throw new Error('must not read'); } });
  const pending = Promise.resolve({ id: 1 });
  const disposed: unknown[] = [];
  const container = DiBag.createBuilder().withServices({
    automatic: DiBag.createProvider(async () => 1),
    synchronous: DiBag.createProvider((): object => structural, { factoryReturnKind: 'sync-value' }),
    uninspected: DiBag.withDisposal(
      DiBag.createProvider((): object => pending, { factoryReturnKind: 'uninspected' }),
      value => { disposed.push(value); },
    ),
    native: DiBag.withDisposal(
      DiBag.createProvider(() => pending, { factoryReturnKind: 'native-promise' }),
      value => { disposed.push(value); },
    ),
  }).buildContainer();

  expect(container.resolve('automatic')).toBeInstanceOf(Promise);
  expect(container.resolve('synchronous')).toBe(structural);
  expect(container.resolve('uninspected')).toBe(pending);
  expect(container.resolve('native')).toBe(pending);
  expect(thenReads).toBe(0);
  const kinds = new Map(container.graphSnapshot().bindings.map(binding => [binding.label, binding.factoryReturnKind]));
  expect(kinds).toEqual(new Map([
    ['automatic', 'auto-detect'],
    ['synchronous', 'sync-value'],
    ['uninspected', 'uninspected'],
    ['native', 'native-promise'],
  ]));
  await container.close();
  expect(disposed).toContain(pending);
  expect(disposed).toContain(await pending);
});

test('native-promise uses the engine native-Promise check without invoking then', async () => {
  const crossRealm = runInNewContext('Promise.resolve({ id: 2 })') as Promise<{ id: number }>;
  class ServicePromise<T> extends Promise<T> {}
  const subclass = ServicePromise.resolve({ id: 3 });
  subclass.then = () => { throw new Error('own then must not run'); };
  for (const promise of [crossRealm, subclass]) {
    const container = withoutBuiltinModule(() => DiBag.createBuilder().withServices({
      service: DiBag.createProvider(() => promise, { factoryReturnKind: 'native-promise' }),
    }).buildContainer());
    expect(container.resolve('service')).toBe(promise);
    await container.close();
  }
  let calls = 0;
  const thenable = { then() { calls++; } };
  const invalid = withoutBuiltinModule(() => DiBag.createBuilder().withServices({
    service: DiBag.createProvider(() => thenable as never, { factoryReturnKind: 'native-promise' }),
  }).buildContainer());
  expect(() => invalid.resolve('service')).toThrow(TypeError);
  expect(calls).toBe(0);
  await invalid.close();
});

test('factoryReceivesContext supplies abortSignal and acquisition-local disposal', async () => {
  const events: string[] = [];
  let signal: AbortSignal | undefined;
  const container = DiBag.createBuilder().withServices({
    service: DiBag.createProvider((_dependencies: {}, factoryContext) => {
      signal = factoryContext.abortSignal;
      factoryContext.pushDisposer(disposerContext => { events.push(disposerContext.reason); });
      return 1;
    }, { factoryReturnKind: 'sync-value', factoryReceivesContext: true }),
  }).buildContainer();
  expect(container.resolve('service')).toBe(1);
  expect(signal).toBeInstanceOf(AbortSignal);
  expect(signal?.aborted).toBe(false);
  await container.close();
  expect(signal?.aborted).toBe(true);
  expect(events).toEqual(['no-service-disposer']);
});

test('createProvider snapshots its option bag and reports final validation details', () => {
  let kindReads = 0;
  let contextReads = 0;
  const options = {
    get factoryReturnKind() { kindReads++; return 'sync-value' as const; },
    get factoryReceivesContext() { contextReads++; return true as const; },
  };
  const provider = DiBag.createProvider((_dependencies: {}, _factoryContext) => 1, options);
  expect(typeof provider).toBe('object');
  expect([kindReads, contextReads]).toEqual([1, 1]);

  const call = DiBag.createProvider as (...arguments_: unknown[]) => unknown;
  for (const [arguments_, expected] of [
    [[1], { operation: 'createProvider', argument: 'factory', expected: 'a function' }],
    [[() => 1, null], { operation: 'createProvider', argument: 'options', expected: 'an object' }],
    [[() => 1, { extra: true }], { operation: 'createProvider', argument: 'options', expected: 'only the own properties: factoryReturnKind, factoryReceivesContext' }],
    [[() => 1, { factoryReturnKind: 'raw' }], { operation: 'createProvider', argument: 'factoryReturnKind', expected: "one of: 'auto-detect', 'sync-value', 'native-promise', 'uninspected'" }],
    [[() => 1, { factoryReceivesContext: false }], { operation: 'createProvider', argument: 'factoryReceivesContext', expected: "one of: 'true'" }],
  ] as const) {
    try { Reflect.apply(call, undefined, arguments_ as unknown as unknown[]); throw new Error('expected rejection'); }
    catch (error) {
      expect((error as { code?: string }).code).toBe('DI_BAG_INVALID_ARGUMENT');
      expect((error as { details?: unknown }).details).toEqual(expected);
    }
  }
});
```

- [ ] **Step 2: Add failing compiler fixtures**

Create `tests/types/provider-sources.ts`:

```ts
import { DiBag } from '../../src';
import type { FactoryContext, FactoryReturnKind, ProviderAcquiredValue, ProviderOutput } from '../../src';
import type { Assert, Equal } from './assert';

const pending = Promise.resolve({ id: 1 });
export const automatic = DiBag.createProvider(async () => ({ id: 1 }));
export const synchronous = DiBag.createProvider(() => ({ id: 1 }), { factoryReturnKind: 'sync-value' });
export const uninspected = DiBag.createProvider(() => pending, { factoryReturnKind: 'uninspected' });
export const native = DiBag.createProvider(() => pending, { factoryReturnKind: 'native-promise' });
export const contextual = DiBag.createProvider((_dependencies: { port: number }, factoryContext) => {
  const exact: FactoryContext = factoryContext;
  const signal: AbortSignal = exact.abortSignal;
  return { signal };
}, { factoryReceivesContext: true, factoryReturnKind: 'sync-value' });
const disposerOnly = DiBag.createProvider((_dependencies: {}, factoryContext: Pick<FactoryContext, 'pushDisposer'>) => {
  factoryContext.pushDisposer(() => {});
  return 1;
}, { factoryReceivesContext: true, factoryReturnKind: 'sync-value' });

export type Exact = [
  Assert<Equal<FactoryReturnKind, 'auto-detect' | 'sync-value' | 'native-promise' | 'uninspected'>>,
  Assert<Equal<ProviderOutput<typeof automatic>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof automatic>, { id: number }>>,
  Assert<Equal<ProviderOutput<typeof synchronous>, { id: number }>>,
  Assert<Equal<ProviderOutput<typeof uninspected>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof uninspected>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderOutput<typeof native>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof native>, { id: number }>>,
  Assert<Equal<ProviderOutput<typeof contextual>, { signal: AbortSignal }>>,
];
```

Create `tests/types/negative/provider-sources.ts`:

```ts
import { DiBag } from '../../../src';

const thenable = { then(_resolve: (value: number) => void) {} };
// diagnostic: factory output is a structural thenable; return a native Promise or select factoryReturnKind 'uninspected' or 'native-promise'
DiBag.createProvider(() => thenable);
DiBag.createProvider(async () => 1, {
  // diagnostic: sync-value output must not be a Promise or thenable
  factoryReturnKind: 'sync-value',
});
DiBag.createProvider(() => thenable, {
  // diagnostic: sync-value output must not be a Promise or thenable
  factoryReturnKind: 'sync-value',
});
DiBag.createProvider(() => 1, {
  // diagnostic: native-promise factory return kind requires a Promise output
  factoryReturnKind: 'native-promise',
});
DiBag.createProvider(() => 1, {
  // diagnostic: not assignable
  factoryReturnKind: 'raw',
});
DiBag.createProvider(() => 1, {
  // diagnostic: not assignable
  factoryReceivesContext: false,
});
// diagnostic: not assignable
DiBag.createProvider(function (this: { id: number }) { return this.id; });
// diagnostic: Types of property 'abortSignal' are incompatible
DiBag.createProvider((_dependencies: {}, factoryContext: { readonly abortSignal: string }) => factoryContext, { factoryReceivesContext: true });
// diagnostic: No overload matches
DiBag.createProvider((_dependencies: {}, factoryContext) => factoryContext.abortSignal);
```

The negative directory is discovered automatically; do not add a fake negative table entry. Add this exact positive-source check to `tests/types.test.ts` beside the existing direct checks:

```ts
test('provider sources retain exact inferred contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/provider-sources.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});
```

Task 2 completes and registers the declaration consumer. For every options overload, keep the `// diagnostic` comment immediately above the line whose offending property is underlined; do not replace these with a generic call-level test.

- [ ] **Step 3: Run the narrow tests to verify the API is absent**

Run:

```bash
bun test tests/provider-sources.test.ts
```

Expected: FAIL because `DiBag.createProvider` is absent. Coordinate with the controller before running the compiler fixture command; when serialized, it must fail on the new positive fixture and find the expected negative lines.

- [ ] **Step 4: Replace the acquisition-mode public vocabulary**

In `src/acquisition-mode.ts`, add the final return-kind block below beside the legacy compatibility block printed immediately after it; retain `RuntimeOptions`, `RuntimeContext`, host-classifier code, and observers around it. The internal engine uses only `FactoryReturnKind` after this task, while deprecated entry points use the legacy helpers until Task 5.

```ts
export type FactoryReturnKind = 'auto-detect' | 'sync-value' | 'native-promise' | 'uninspected';

export type Acquired<Output, ReturnKind extends FactoryReturnKind> =
  ReturnKind extends 'sync-value' | 'uninspected' ? Output : Awaited<Output>;

export type ReturnKindOptions<
  ReturnKind extends FactoryReturnKind,
  Default extends FactoryReturnKind = 'auto-detect',
> = Default extends ReturnKind
  ? { readonly factoryReturnKind?: ReturnKind }
  : { readonly factoryReturnKind: ReturnKind };

export type StageOptions<ReturnKind extends FactoryReturnKind> = 'auto-detect' extends ReturnKind
  ? [options?: { readonly factoryReturnKind: ReturnKind }]
  : [options: { readonly factoryReturnKind: ReturnKind }];

export type NativeOutput<Output, ReturnKind extends FactoryReturnKind> =
  'native-promise' extends ReturnKind
    ? [Output] extends [Promise<unknown>]
      ? unknown
      : Unsatisfied<'native-promise factory return kind requires a Promise output', {}>
    : unknown;

export type AutoOutput<Output, ReturnKind extends FactoryReturnKind> =
  'auto-detect' extends ReturnKind
    ? true extends StructuralThenable<Output>
      ? Unsatisfied<`factory output is a structural thenable; return a native Promise or select factoryReturnKind 'uninspected' or 'native-promise'${SeeErrors<'structural-thenable'>}`, {}>
      : unknown
    : unknown;

type PromiseOutput<Output> = Output extends infer Value & {}
  ? Value extends Promise<unknown> ? true : false
  : false;

export type SyncOutput<Output, ReturnKind extends FactoryReturnKind = 'sync-value'> =
  'sync-value' extends ReturnKind
    ? IsAny<Output> extends true
      ? unknown
      : true extends PromiseOutput<Output> | StructuralThenable<Output>
        ? Unsatisfied<`sync-value output must not be a Promise or thenable; use factoryReturnKind 'native-promise' for a Promise, or 'uninspected' to make the Promise object the service${SeeErrors<'portable-factory-output'>}`, {}>
        : unknown
    : unknown;

export type AsyncOutput<Output> = [Output] extends [Promise<unknown>]
  ? unknown
  : Unsatisfied<`native-promise factory return kind requires a Promise output; use 'sync-value' for a synchronous value${SeeErrors<'portable-factory-output'>}`, {}>;

const returnKinds: readonly FactoryReturnKind[] = ['auto-detect', 'sync-value', 'native-promise', 'uninspected'];

export function factoryReturnKind(
  value: unknown,
  operation: string,
  fallback: FactoryReturnKind = 'auto-detect',
): FactoryReturnKind {
  const selected = value === undefined ? fallback : value;
  if (!returnKinds.includes(selected as FactoryReturnKind)) {
    throw libraryError(
      'DI_BAG_INVALID_ARGUMENT',
      `${operation} factoryReturnKind must name a supported return policy`,
      { operation, argument: 'factoryReturnKind', expected: "one of: 'auto-detect', 'sync-value', 'native-promise', 'uninspected'" },
    );
  }
  return selected as FactoryReturnKind;
}
```

Keep this complete deprecated compatibility block during expand so unmigrated tests and consumers retain their old literal types and diagnostic text:

```ts
/** @deprecated Use FactoryReturnKind. Removed in Task 5 after migration. */
export type AcquisitionMode = 'auto' | 'raw' | 'nativePromise';

export type LegacyAcquired<Output, Mode extends AcquisitionMode> = Mode extends 'raw' ? Output : Awaited<Output>;
export type LegacyModeOptions<Mode extends AcquisitionMode> = 'auto' extends Mode
  ? { readonly acquisitionMode?: Mode }
  : { readonly acquisitionMode: Mode };
export type LegacyStageOptions<Mode extends AcquisitionMode> = 'auto' extends Mode
  ? [options?: { readonly acquisitionMode: Mode }]
  : [options: { readonly acquisitionMode: Mode }];
export type LegacyNativeOutput<Output, Mode extends AcquisitionMode> = 'nativePromise' extends Mode
  ? [Output] extends [Promise<unknown>] ? unknown : Unsatisfied<'nativePromise acquisition requires a Promise output', {}>
  : unknown;
export type LegacyAutoOutput<Output, Mode extends AcquisitionMode> = 'auto' extends Mode
  ? true extends StructuralThenable<Output>
    ? Unsatisfied<`factory output is a structural thenable; return a native Promise or select acquisitionMode raw or nativePromise${SeeErrors<'structural-thenable'>}`, {}>
    : unknown
  : unknown;
export type LegacySyncOutput<Output> = IsAny<Output> extends true ? unknown
  : true extends PromiseOutput<Output> | StructuralThenable<Output>
    ? Unsatisfied<`fromSyncFactory output must not be a Promise or thenable; use fromAsyncFactory for a Promise, or fromFactory with acquisitionMode raw to make the Promise object the service${SeeErrors<'portable-factory-output'>}`, {}>
    : unknown;
export type LegacyAsyncOutput<Output> = [Output] extends [Promise<unknown>] ? unknown
  : Unsatisfied<`fromAsyncFactory requires a Promise output; use fromSyncFactory for a synchronous value${SeeErrors<'portable-factory-output'>}`, {}>;

export function acquisitionMode(options: { readonly acquisitionMode?: AcquisitionMode } | undefined, fallback: AcquisitionMode = 'auto'): AcquisitionMode {
  if (options === undefined) return fallback;
  if (typeof options !== 'object' || options === null) throw libraryError('DI_BAG_INVALID_ACQUISITION_MODE', 'invalid acquisition options', { option: 'acquisitionMode' });
  const selected = options.acquisitionMode;
  const mode = selected === undefined ? fallback : selected;
  if (mode !== 'auto' && mode !== 'raw' && mode !== 'nativePromise') throw libraryError('DI_BAG_INVALID_ACQUISITION_MODE', 'invalid acquisitionMode: use auto, raw, or nativePromise', { option: 'acquisitionMode' });
  return mode;
}

export function normalizeLegacyMode(mode: AcquisitionMode): FactoryReturnKind {
  return mode === 'auto' ? 'auto-detect' : mode === 'raw' ? 'uninspected' : 'native-promise';
}

export function legacyModeOf(kind: FactoryReturnKind): AcquisitionMode {
  return kind === 'auto-detect' ? 'auto' : kind === 'native-promise' ? 'nativePromise' : 'raw';
}
```

Rename `classifierRequired`'s prose only: “automatic acquisition” becomes “auto-detect factory return kind”, and its fix becomes `DiBag.createProvider(factory, { factoryReturnKind: 'sync-value' })`, `factoryReturnKind: 'native-promise'`, or a configured classifier. Keep code `DI_BAG_CLASSIFIER_REQUIRED` and its detail keys until plan 12.

- [ ] **Step 5: Implement `FactoryContext` and `createProvider`**

In `src/acquisition-context.ts`, keep `DisposerContext`, add `FactoryContext`, retain the deprecated `AcquisitionContext` view through migration, and add `createProvider` beside all three old facade constructors. Use this final implementation for the new surface:

```ts
export interface FactoryContext {
  readonly abortSignal: AbortSignal;
  pushDisposer(
    this: void,
    disposer: (this: void, disposerContext: DisposerContext) => void | Promise<void>,
  ): void;
}

type ContextFactory = (this: void, dependencies: never, factoryContext: FactoryContext) => unknown;

export type ContextualFactory<Factory extends (this: void, dependencies: never, factoryContext: never) => unknown> = (
  this: void,
  dependencies: Parameters<Factory> extends [] ? {} : Parameters<Factory>[0],
) => ReturnType<Factory>;

type CreateProviderOptions<ReturnKind extends FactoryReturnKind> =
  'auto-detect' extends ReturnKind
    ? { readonly factoryReturnKind?: ReturnKind; readonly factoryReceivesContext?: never }
    : { readonly factoryReturnKind: ReturnKind; readonly factoryReceivesContext?: never };

export function createProvider<
  Factory extends (this: void, dependencies: never, factoryContext: FactoryContext) =>
    ('native-promise' extends ReturnKind ? Promise<unknown> : unknown),
  ReturnKind extends FactoryReturnKind = 'auto-detect',
>(
  factory: Factory
    & NativeOutput<ReturnType<NoInfer<Factory>>, NoInfer<ReturnKind>>
    & AutoOutput<ReturnType<NoInfer<Factory>>, NoInfer<ReturnKind>>
    & SyncOutput<ReturnType<NoInfer<Factory>>, NoInfer<ReturnKind>>,
  options: { readonly factoryReceivesContext: true } & ReturnKindOptions<ReturnKind>,
): Provider<ContextualFactory<Factory>, Readonly<{}>, readonly [], TokenDependencyContract, Acquired<ReturnType<Factory>, ReturnKind>>;

export function createProvider<
  Factory extends import('./registration').Factory,
  ReturnKind extends FactoryReturnKind = 'auto-detect',
>(
  factory: Factory
    & NativeOutput<ReturnType<NoInfer<Factory>>, NoInfer<ReturnKind>>
    & AutoOutput<ReturnType<NoInfer<Factory>>, NoInfer<ReturnKind>>
    & SyncOutput<ReturnType<NoInfer<Factory>>, NoInfer<ReturnKind>>,
  ...options: 'auto-detect' extends ReturnKind
    ? [options?: CreateProviderOptions<ReturnKind>]
    : [options: CreateProviderOptions<ReturnKind>]
): Provider<Factory, Readonly<{}>, readonly [], TokenDependencyContract, Acquired<ReturnType<Factory>, ReturnKind>>;

export function createProvider(
  factory: import('./registration').Factory | ContextFactory,
  options?: unknown,
): ProviderBase {
  if (typeof factory !== 'function') {
    throw libraryError('DI_BAG_INVALID_ARGUMENT', 'createProvider requires a factory function', {
      operation: 'createProvider', argument: 'factory', expected: 'a function',
    });
  }
  const bag = options === undefined
    ? Object.create(null) as Record<string, unknown>
    : snapshotOptionsBag(options, 'createProvider', [], ['factoryReturnKind', 'factoryReceivesContext']);
  const returnKind = factoryReturnKind(bag.factoryReturnKind, 'createProvider');
  if (bag.factoryReceivesContext !== undefined && bag.factoryReceivesContext !== true) {
    throw libraryError('DI_BAG_INVALID_ARGUMENT', 'createProvider factoryReceivesContext must be true when present', {
      operation: 'createProvider', argument: 'factoryReceivesContext', expected: "one of: 'true'",
    });
  }
  return factoryProvider(factory, returnKind, bag.factoryReceivesContext === true);
}

function factoryProvider(
  factory: import('./registration').Factory | ContextFactory | LegacyContextFactory,
  returnKind: FactoryReturnKind,
  contextual: boolean,
): ProviderBase {
  const handle = createProviderHandle<import('./registration').Factory, Readonly<{}>, readonly [], TokenDependencyContract, unknown>();
  const create: import('./registration').Factory = contextual
    ? ((dependencies: never, factoryContext?: FactoryContext & AcquisitionContext) =>
        (factory as ContextFactory | LegacyContextFactory)(dependencies, factoryContext!))
    : factory as import('./registration').Factory;
  retainDescription(handle, sourceDescription(create, undefined, [], returnKind, contextual));
  return handle;
}
```

Alias the imported provider-handle constructor as `createProviderHandle` to avoid a local name collision. Import the accepted five-parameter `snapshotOptionsBag` contract unchanged. Calls in this task pass its first four arguments because they do not need `inspectValue`; do not remove or shadow the optional fifth hook used by earlier phases.

The expand-only helpers live in `src/acquisition-mode.ts` because all three source modules need the same translations. Export them internally as printed above, but do not re-export them from `src/index.ts`. In `src/acquisition-context.ts`, import `LegacyAcquired`, `LegacyAsyncOutput`, `LegacyAutoOutput`, `LegacyModeOptions`, `LegacyNativeOutput`, `LegacySyncOutput`, `acquisitionMode`, and `normalizeLegacyMode`. In `src/composition.ts`, import `LegacyAcquired`, `LegacyAutoOutput`, `LegacyNativeOutput`, `LegacyStageOptions`, `acquisitionMode`, and `normalizeLegacyMode`. In `src/provider.ts`, import `legacyModeOf` and `normalizeLegacyMode` along with the public return-kind helpers. Task 5 removes these imports together with the expand-only declarations.

During expand, append this compatibility declaration and keep the existing three overload families with the complete translated bodies below. These wrappers deliberately retain old codes, messages, option reads, output admissions, and generic positions; only the final call translates the old policy to the new engine vocabulary:

```ts
/** @deprecated Use FactoryContext. */
export interface AcquisitionContext extends FactoryContext {
  readonly signal: AbortSignal;
}
type LegacyContextFactory = (this: void, dependencies: never, acquisitionContext: AcquisitionContext) => unknown;
type LegacyFactoryOptions<Mode extends AcquisitionMode> = 'auto' extends Mode
  ? [options?: { readonly context?: never; readonly acquisitionMode?: Mode }]
  : [options: { readonly context?: never; readonly acquisitionMode: Mode }];
type LegacyPortableOptions = { readonly context?: never; readonly acquisitionMode?: never };
type LegacyContextualPortableOptions = { readonly context: 'acquisition'; readonly acquisitionMode?: never };

function portableContext(operation: 'fromSyncFactory' | 'fromAsyncFactory', options: unknown): boolean {
  if (options === undefined) return false;
  if (typeof options !== 'object' || options === null) throw libraryError('DI_BAG_INVALID_FACTORY', `${operation} options must be an object`, { operation });
  if ('acquisitionMode' in options) throw libraryError('DI_BAG_INVALID_FACTORY', `${operation} selects its acquisitionMode itself`, { operation });
  const context: unknown = (options as { readonly context?: unknown }).context;
  if (context !== undefined && context !== 'acquisition') throw libraryError('DI_BAG_INVALID_FACTORY', `${operation} context must be acquisition`, { operation });
  return context === 'acquisition';
}

export function fromFactory<
  Factory extends (this: void, dependencies: never, acquisitionContext: AcquisitionContext) => ('nativePromise' extends Mode ? Promise<unknown> : unknown),
  Mode extends AcquisitionMode = 'auto',
>(factory: Factory & LegacyAutoOutput<ReturnType<NoInfer<Factory>>, NoInfer<Mode>>, options: { readonly context: 'acquisition' } & LegacyModeOptions<Mode>):
  Provider<ContextualFactory<Factory>, Readonly<{}>, readonly [], TokenDependencyContract, LegacyAcquired<ReturnType<Factory>, Mode>>;
export function fromFactory<Factory extends import('./registration').Factory, Mode extends AcquisitionMode = 'auto'>(
  factory: Factory & LegacyNativeOutput<ReturnType<NoInfer<Factory>>, NoInfer<Mode>> & LegacyAutoOutput<ReturnType<NoInfer<Factory>>, NoInfer<Mode>>,
  ...options: LegacyFactoryOptions<Mode>
): Provider<Factory, Readonly<{}>, readonly [], TokenDependencyContract, LegacyAcquired<ReturnType<Factory>, Mode>>;
export function fromFactory(factory: import('./registration').Factory | LegacyContextFactory, options?: { readonly context?: 'acquisition'; readonly acquisitionMode?: AcquisitionMode }): ProviderBase {
  if (typeof factory !== 'function') throw libraryError('DI_BAG_INVALID_FACTORY', 'fromFactory requires a function', { operation: 'fromFactory' });
  const mode = acquisitionMode(options);
  if (options?.context !== undefined && options.context !== 'acquisition') throw libraryError('DI_BAG_INVALID_FACTORY', 'fromFactory context must be acquisition', { operation: 'fromFactory' });
  return factoryProvider(factory, normalizeLegacyMode(mode), options?.context === 'acquisition');
}

export function fromSyncFactory<Factory extends LegacyContextFactory>(factory: Factory & LegacySyncOutput<ReturnType<NoInfer<Factory>>>, options: LegacyContextualPortableOptions):
  Provider<ContextualFactory<Factory>, Readonly<{}>, readonly [], TokenDependencyContract, ReturnType<Factory>>;
export function fromSyncFactory<Factory extends import('./registration').Factory>(factory: Factory & LegacySyncOutput<ReturnType<NoInfer<Factory>>>, options?: LegacyPortableOptions):
  Provider<Factory, Readonly<{}>, readonly [], TokenDependencyContract, ReturnType<Factory>>;
export function fromSyncFactory(factory: import('./registration').Factory | LegacyContextFactory, options?: { readonly context?: 'acquisition' }): ProviderBase {
  if (typeof factory !== 'function') throw libraryError('DI_BAG_INVALID_FACTORY', 'fromSyncFactory requires a function', { operation: 'fromSyncFactory' });
  return factoryProvider(factory, 'sync-value', portableContext('fromSyncFactory', options));
}

export function fromAsyncFactory<Factory extends (this: void, dependencies: never, acquisitionContext: AcquisitionContext) => Promise<unknown>>(factory: Factory, options: LegacyContextualPortableOptions):
  Provider<ContextualFactory<Factory>, Readonly<{}>, readonly [], TokenDependencyContract, Awaited<ReturnType<Factory>>>;
export function fromAsyncFactory<Factory extends import('./registration').Factory>(factory: Factory & LegacyAsyncOutput<ReturnType<NoInfer<Factory>>>, options?: LegacyPortableOptions):
  Provider<Factory, Readonly<{}>, readonly [], TokenDependencyContract, Awaited<ReturnType<Factory>>>;
export function fromAsyncFactory(factory: import('./registration').Factory | LegacyContextFactory, options?: { readonly context?: 'acquisition' }): ProviderBase {
  if (typeof factory !== 'function') throw libraryError('DI_BAG_INVALID_FACTORY', 'fromAsyncFactory requires a function', { operation: 'fromAsyncFactory' });
  return factoryProvider(factory, 'native-promise', portableContext('fromAsyncFactory', options));
}
```

The `factoryProvider` implementation printed above accepts either context-factory type. The runtime context object exposes both names during expand:

```ts
private factoryContext(disposers: DisposerStack): FactoryContext & AcquisitionContext {
  const abortSignal = this.cancellationSignal();
  return Object.freeze({
    abortSignal,
    signal: abortSignal,
    pushDisposer: (disposer: (this: void, disposerContext: DisposerContext) => void | Promise<void>) => { disposers.push(disposer); },
  });
}
```

Task 5 removes `AcquisitionContext`, `LegacyContextFactory`, the `signal` alias, all legacy option/helper types, the expand-only union member on `factoryProvider`, and the three wrappers only after every call site is migrated. Its final `factoryProvider` parameter contracts back to `Factory | ContextFactory`, and the contextual cast contracts back to `ContextFactory`. Calls in this phase continue to pass four arguments to `snapshotOptionsBag`; its accepted optional fifth hook remains available to phases 6–7.

- [ ] **Step 6: Carry the new names through execution and inspection**

Perform a symbol-aware rename of internal source/stage fields from `acquisitionMode` to `factoryReturnKind` in `src/provider-operations.ts`, `src/provider-execution.ts`, `src/runtime.ts`, and `src/provider.ts`. Change comparisons as follows:

```text
// old -> new
'auto'          -> 'auto-detect'
'raw'           -> 'uninspected'
'nativePromise' -> 'native-promise'
```

In `publishSource`, replace the old raw branch condition and leave its complete body unchanged:

```ts
if (description.factoryReturnKind === 'uninspected' || description.factoryReturnKind === 'sync-value') {
  this.sourceInFlight = false;
  this.result = { exposed: undefined, consumed: true, state: 'ready', value: undefined, error: undefined, owners: [] };
  if (description.dispose) this.accept(0, value, description.dispose, true);
  return;
}
```

In `capture`, use these exact decisions around the existing promise-observation body:

```ts
let native = factoryReturnKind === 'native-promise';
if (factoryReturnKind === 'auto-detect') {
  const { isNativePromise } = this.context;
  const classified = isNativePromise!(exposed);
  if (typeof classified !== 'boolean') throw libraryError('DI_BAG_INVALID_CLASSIFIER_RESULT', 'isNativePromise must return a boolean', { option: 'isNativePromise', provided: classified });
  native = classified;
}
if (factoryReturnKind !== 'uninspected' && factoryReturnKind !== 'sync-value' && exposed !== null && (typeof exposed === 'object' || typeof exposed === 'function') && 'then' in exposed) {
  const then = Reflect.get(exposed, 'then');
  if (!native && typeof then === 'function') throw libraryTypeError(
    'DI_BAG_STRUCTURAL_THENABLE',
    "Structural thenables require a native Promise or factoryReturnKind 'uninspected'",
    { factoryReturnKind },
  );
}
```

Rename the `capture` parameter to `factoryReturnKind: FactoryReturnKind`; every existing `'nativePromise'` literal used by async map/frame operations becomes `'native-promise'`. `sync-value` and `uninspected` are identical at runtime; only compile-time admission differs. `native-promise` still checks with `isNativePromise` before observing fulfillment. `auto-detect` still uses the configured/host classifier. Retain the existing runtime codes until plan 12.

Audit every old literal across `src`, including sources outside the acquisition files:

```bash
rg -n "'auto'|'raw'|'nativePromise'|acquisitionMode" src
```

In `src/aliases.ts`, change its internal alias source call from `sourceDescription(..., 'raw')` to `sourceDescription(..., 'uninspected')`; preserve the callback, ownership, dependencies, and alias graph contract byte-for-byte. After the audit, remaining old literals are confined to the explicit compatibility helpers/wrappers, dual snapshot conversion, and `transformService`'s temporary legacy overload.

In `src/acquisition.ts`, use the dual-name compatibility object printed in Step 5 during expand. In Task 5, after legacy contextual factories are migrated, contract it to:

```ts
private factoryContext(disposers: DisposerStack): FactoryContext {
  return Object.freeze({
    abortSignal: this.cancellationSignal(),
    pushDisposer: (disposer: (this: void, disposerContext: DisposerContext) => void | Promise<void>) => { disposers.push(disposer); },
  });
}
```

This final contraction removes only the deprecated `signal` alias; do not add validation or alter `DisposerStack`. During expand, `src/inspection.ts` exposes both snapshot fields so legacy assertions stay green:

```ts
export interface BindingSnapshot<
  RegistrationMetadata = Readonly<{}>,
  AcquisitionMetadataFrames extends readonly unknown[] = readonly [],
> extends RegistrationSnapshot<RegistrationMetadata, AcquisitionMetadataFrames> {
  readonly keys: readonly (string | symbol)[];
  readonly lifetime: Lifetime;
  readonly factoryReturnKind: FactoryReturnKind;
  /** @deprecated Use factoryReturnKind. */
  readonly acquisitionMode: AcquisitionMode;
  readonly owned: boolean;
  readonly tokenDependencies: readonly { readonly key: symbol; readonly kind: 'required' | 'optional' | 'lazy' }[];
}
```

Construct both fields from the same description using `legacyModeOf` (`auto-detect` -> `auto`, `sync-value` and `uninspected` -> `raw`, `native-promise` -> `nativePromise`). Task 5 deletes `acquisitionMode` and changes the interface to the final phase-8 shape:

```ts
export interface BindingSnapshot<
  RegistrationMetadata = Readonly<{}>,
  AcquisitionMetadataFrames extends readonly unknown[] = readonly [],
> extends RegistrationSnapshot<RegistrationMetadata, AcquisitionMetadataFrames> {
  readonly keys: readonly (string | symbol)[];
  readonly lifetime: Lifetime;
  readonly factoryReturnKind: FactoryReturnKind;
  readonly owned: boolean;
  readonly tokenDependencies: readonly {
    readonly key: symbol;
    readonly kind: 'required' | 'optional' | 'lazy';
  }[];
}
```

Use `factoryReturnKind` in its construction in `src/runtime.ts`. Snapshot fields `label`, `keys`, `owned`, and `tokenDependencies[].key/kind` remain unchanged until plan 12. Do not alter `GraphDescription.tokenKinds`, any description-copy field, collection views, lifetimes, or ownership order.

In `src/provider.ts`, the public `transformService` option key remains `acquisitionMode`. During expand it accepts both vocabularies so unmigrated tests remain green; use this complete normalization layer with the existing overload bodies otherwise unchanged:

```ts
type ExpandReturnKind = FactoryReturnKind | AcquisitionMode;
type NormalizedReturnKind<ReturnKind extends ExpandReturnKind> =
  ReturnKind extends 'auto' ? 'auto-detect'
    : ReturnKind extends 'raw' ? 'uninspected'
      : ReturnKind extends 'nativePromise' ? 'native-promise'
        : ReturnKind;
type ExpandTransformOptions<ReturnKind extends ExpandReturnKind> =
  'auto-detect' extends NormalizedReturnKind<ReturnKind>
    ? { readonly acquisitionMode?: ReturnKind }
    : 'auto' extends ReturnKind
      ? { readonly acquisitionMode?: ReturnKind }
      : { readonly acquisitionMode: ReturnKind };

function expandTransformReturnKind(options: { readonly acquisitionMode?: ExpandReturnKind }): FactoryReturnKind {
  const selected = options.acquisitionMode ?? 'auto-detect';
  if (selected === 'auto' || selected === 'raw' || selected === 'nativePromise') return normalizeLegacyMode(selected);
  if (selected === 'auto-detect' || selected === 'sync-value' || selected === 'native-promise' || selected === 'uninspected') return selected;
  throw libraryError('DI_BAG_INVALID_ACQUISITION_MODE', 'invalid acquisitionMode: use auto, raw, nativePromise, auto-detect, sync-value, native-promise, or uninspected', { option: 'acquisitionMode' });
}

export function transformService<
  ServiceRegistration extends Registration,
  Transform extends (this: void, exposedService: ProviderOutput<NoInfer<ServiceRegistration>>) => ('native-promise' extends NormalizedReturnKind<ReturnKind> ? Promise<unknown> : unknown),
  ReturnKind extends ExpandReturnKind = 'auto-detect',
>(
  registration: ServiceRegistration & Registration,
  options: { readonly mode: 'direct'; readonly transform: Transform } & ExpandTransformOptions<ReturnKind>
    & NativeOutput<ReturnType<NoInfer<Transform>>, NormalizedReturnKind<NoInfer<ReturnKind>>>
    & AutoOutput<ReturnType<NoInfer<Transform>>, NormalizedReturnKind<NoInfer<ReturnKind>>>
    & SyncOutput<ReturnType<NoInfer<Transform>>, NormalizedReturnKind<NoInfer<ReturnKind>>>,
): Provider<MappedFactory<ServiceRegistration, ReturnType<Transform>>, RetainedMetadata<ServiceRegistration>, ProviderAcquisitionMetadata<ServiceRegistration>, ProviderGraphContract<ServiceRegistration>, Acquired<ReturnType<Transform>, NormalizedReturnKind<ReturnKind>>>;

export function transformService<
  ServiceRegistration extends Registration,
  Transform extends (this: void, fulfilledValue: Awaited<ProviderOutput<NoInfer<ServiceRegistration>>>) => unknown,
>(registration: ServiceRegistration & Registration, options: { readonly mode: 'awaited'; readonly transform: Transform; readonly acquisitionMode?: never }):
  Provider<MappedFactory<ServiceRegistration, Promise<Awaited<ReturnType<Transform>>>>, RetainedMetadata<ServiceRegistration>, ProviderAcquisitionMetadata<ServiceRegistration>, ProviderGraphContract<ServiceRegistration>>;

export function transformService(registration: Registration, options: { readonly mode: 'direct' | 'awaited'; readonly transform: (exposedService: never) => unknown; readonly acquisitionMode?: ExpandReturnKind }): ProviderBase {
  if (typeof options !== 'object' || options === null || (options.mode !== 'direct' && options.mode !== 'awaited')) throw libraryTypeError('DI_BAG_INVALID_TRANSFORM', 'transformService mode must be direct or awaited', { operation: 'transformService' });
  if (typeof options.transform !== 'function') throw libraryTypeError('DI_BAG_INVALID_TRANSFORM', 'transformService requires a transform callback', { operation: 'transformService' });
  if (options.mode === 'awaited' && 'acquisitionMode' in options) throw libraryTypeError('DI_BAG_INVALID_TRANSFORM', 'transformService awaited mode does not accept acquisitionMode', { operation: 'transformService' });
  return transform(registration, { kind: options.mode === 'direct' ? 'map-sync' : 'map-async', project: options.transform,
    factoryReturnKind: options.mode === 'direct' ? expandTransformReturnKind(options) : 'native-promise' });
}
```

After Task 4 migrates every direct-transform value, Task 5 replaces that temporary layer with the phase-2 generic names and final-only complete signatures below; phase 9 owns the option-key and decorator-method reshaping:

```ts
type LegacyTransformReturnKindOptions<ReturnKind extends FactoryReturnKind> =
  'auto-detect' extends ReturnKind
    ? { readonly acquisitionMode?: ReturnKind }
    : { readonly acquisitionMode: ReturnKind };

function legacyTransformReturnKind(options: { readonly acquisitionMode?: FactoryReturnKind }): FactoryReturnKind {
  const selected = options.acquisitionMode ?? 'auto-detect';
  if (selected !== 'auto-detect' && selected !== 'sync-value' && selected !== 'native-promise' && selected !== 'uninspected') throw libraryError(
    'DI_BAG_INVALID_ACQUISITION_MODE',
    "invalid acquisitionMode: use auto-detect, sync-value, native-promise, or uninspected",
    { option: 'acquisitionMode' },
  );
  return selected;
}

export function transformService<
  ServiceRegistration extends Registration,
  Transform extends (this: void, exposedService: ProviderOutput<NoInfer<ServiceRegistration>>) => ('native-promise' extends ReturnKind ? Promise<unknown> : unknown),
  ReturnKind extends FactoryReturnKind = 'auto-detect',
>(
  registration: ServiceRegistration & Registration,
  options: { readonly mode: 'direct'; readonly transform: Transform } & LegacyTransformReturnKindOptions<ReturnKind>
    & NativeOutput<ReturnType<NoInfer<Transform>>, NoInfer<ReturnKind>>
    & AutoOutput<ReturnType<NoInfer<Transform>>, NoInfer<ReturnKind>>
    & SyncOutput<ReturnType<NoInfer<Transform>>, NoInfer<ReturnKind>>,
): Provider<MappedFactory<ServiceRegistration, ReturnType<Transform>>, RetainedMetadata<ServiceRegistration>, ProviderAcquisitionMetadata<ServiceRegistration>, ProviderGraphContract<ServiceRegistration>, Acquired<ReturnType<Transform>, ReturnKind>>;

export function transformService<
  ServiceRegistration extends Registration,
  Transform extends (this: void, fulfilledValue: Awaited<ProviderOutput<NoInfer<ServiceRegistration>>>) => unknown,
>(
  registration: ServiceRegistration & Registration,
  options: { readonly mode: 'awaited'; readonly transform: Transform; readonly acquisitionMode?: never },
): Provider<MappedFactory<ServiceRegistration, Promise<Awaited<ReturnType<Transform>>>>, RetainedMetadata<ServiceRegistration>, ProviderAcquisitionMetadata<ServiceRegistration>, ProviderGraphContract<ServiceRegistration>>;

export function transformService(
  registration: Registration,
  options: { readonly mode: 'direct' | 'awaited'; readonly transform: (exposedService: never) => unknown; readonly acquisitionMode?: FactoryReturnKind },
): ProviderBase {
  if (typeof options !== 'object' || options === null || (options.mode !== 'direct' && options.mode !== 'awaited')) throw libraryTypeError('DI_BAG_INVALID_TRANSFORM', 'transformService mode must be direct or awaited', { operation: 'transformService' });
  if (typeof options.transform !== 'function') throw libraryTypeError('DI_BAG_INVALID_TRANSFORM', 'transformService requires a transform callback', { operation: 'transformService' });
  if (options.mode === 'awaited' && 'acquisitionMode' in options) throw libraryTypeError('DI_BAG_INVALID_TRANSFORM', 'transformService awaited mode does not accept acquisitionMode', { operation: 'transformService' });
  return transform(registration, {
    kind: options.mode === 'direct' ? 'map-sync' : 'map-async',
    project: options.transform,
    factoryReturnKind: options.mode === 'direct'
      ? legacyTransformReturnKind(options)
      : 'native-promise',
  });
}
```

The exact public phase-8 option is `{ mode, transform, acquisitionMode?: FactoryReturnKind }`; it never exposes `factoryReturnKind` inside `transformService`.

- [ ] **Step 7: Publish the facade and exact exports**

In `DiBagApi`, add:

```ts
readonly createProvider: typeof createProvider;
```

and add `createProvider` to the frozen facade object. In `src/index.ts`, export exactly:

```ts
export type { FactoryReturnKind, RuntimeOptions } from './acquisition-mode';
export type { FactoryContext, ContextualFactory, DisposerContext } from './acquisition-context';
```

Keep the old constructors and old exported types during expand. Update `src/types.ts`'s named-factory structural-thenable diagnostic to the new `createProvider(..., { factoryReturnKind: 'uninspected' })` wording.

- [ ] **Step 8: Run narrow runtime tests and the serialized compiler fixture**

```bash
bun test tests/provider-sources.test.ts tests/portable-factories.test.ts tests/acquisition-mode.test.ts
```

Expected: all tests pass. With controller serialization and at least 6 GiB available, run the single fixture lane that includes `provider-sources`; expected: positive fixture has no diagnostics, every negative marker matches, and the diagnostic span is the offending option property for each overload.

- [ ] **Step 9: Record the expand checkpoint for Task 2's additive commit**

Do not commit the partial expand yet; Task 2 completes the additive surface, generates dual-surface docs, runs the authorized green checks, and owns the expand commit. Save `git diff --stat` and continue in the same working tree.

---

### Task 2: Expand positional, plugin, and token source constructors; measure spike S4

**Files:**
- Modify: `src/composition.ts`, `src/plugins.ts`, `src/errors.ts`, `src/tokens.ts`, `src/token-types.ts`, `src/dependency-references.ts`, `src/di-bag.ts`, `src/index.ts`
- Modify: `tests/provider-sources.test.ts`, `tests/types/provider-sources.ts`, `tests/types/provider-sources-consumer.ts`, `tests/types/negative/provider-sources.ts`, `tests/types.test.ts`
- Create: `docs/superpowers/plans/evidence/phase-08.md`

**Interfaces:**
- Consumes: Task 1's `FactoryReturnKind`, `FactoryContext`, `factoryReturnKind`, `Acquired`, `NativeOutput`, `AutoOutput`, `SyncOutput`; phase-4 `DependencyReference`, `DependencyTupleAdmission`, `TokenArguments`, `ReferenceGraph`, collection-token types and graph kinds.
- Produces: `PositionalFactoryArguments`, `PositionalFactoryFunction`, `createProviderFromFunction`, `createProviderFromClass`, `PluginReturnKind`, `CreateProviderFromPluginOptions`, `CreateProviderFromPlugin`, `createProviderFromPlugin`, `createToken`, `Token.symbol`, `forService`, and unchanged `forCollectionOf`.

Spike S4 adopts one object literal only when callback parameters, including defaults/rest and the optional final `FactoryContext`, infer from `dependencies` within the same literal and all twelve evidence cases stay within the cumulative +10% budget. Otherwise execute Step 9's complete positional fallback.

- [ ] **Step 1: Append focused runtime tests**

Append to `tests/provider-sources.test.ts`:

```ts
test('positional function appends FactoryContext after required, optional, lazy, and collection values', async () => {
  const required = DiBag.createToken(Symbol('required')).forService<number>();
  const absent = DiBag.createToken(Symbol('absent')).forService<number>();
  const lazy = DiBag.createToken(Symbol('lazy')).forService<number>();
  const items = DiBag.createToken(Symbol('items')).forCollectionOf<number>();
  let seen: readonly unknown[] | undefined;
  const provider = DiBag.createProviderFromFunction({
    dependencies: [required, DiBag.optional(absent), DiBag.lazy(lazy), items],
    factoryReceivesContext: true,
    factoryReturnKind: 'sync-value',
    factoryFunction(value, maybe, get, collection, factoryContext) {
      seen = [value, maybe, get(), collection, factoryContext.abortSignal];
      return value + get() + collection.length;
    },
  });
  const container = DiBag.createBuilder()
    .withTokenService(required, () => 1)
    .withTokenService(lazy, () => 2)
    .withCollectionContribution({ collectionToken: items, provider: () => 3 })
    .withCollectionContribution({ collectionToken: items, provider: () => 4 })
    .withServices({ provider })
    .buildContainer();
  expect(container.resolve('provider')).toBe(5);
  expect(seen?.slice(0, 4)).toEqual([1, undefined, 2, [3, 4]]);
  expect(seen?.[4]).toBeInstanceOf(AbortSignal);
  await container.close();
});

test('class adapter constructs with new and never receives FactoryContext', async () => {
  const port = DiBag.createToken(Symbol('port')).forService<number>();
  class Client {
    readonly argumentCount: number;
    constructor(readonly port: number) { this.argumentCount = arguments.length; }
  }
  const provider = DiBag.createProviderFromClass({ dependencies: [port], serviceClass: Client, factoryReturnKind: 'sync-value' });
  const container = DiBag.createBuilder()
    .withTokenService(port, () => 8080)
    .withServices({ provider })
    .buildContainer();
  const client = container.resolve('provider');
  expect(client).toBeInstanceOf(Client);
  expect([client.port, client.argumentCount]).toEqual([8080, 1]);
  await container.close();
});

test('plugin adapter snapshots its bag, validates output, and preserves source ownership', async () => {
  const dependency = DiBag.createToken(Symbol('dependency')).forService<number>();
  const valid = { run: () => 42 };
  const disposed: unknown[] = [];
  const provider = DiBag.createProviderFromPlugin({
    dependencies: [dependency],
    pluginDescriptor: {
      apiVersion: 1,
      create: (value: number) => value === 7 ? valid : null,
      dispose: (value: unknown) => { disposed.push(value); },
    },
    factoryReturnKind: 'uninspected',
    isValidPluginOutput: (value: unknown): value is typeof valid => value === valid,
  });
  const container = DiBag.createBuilder()
    .withTokenService(dependency, () => 7)
    .withServices({ provider })
    .buildContainer();
  expect(container.resolve('provider')).toBe(valid);
  await container.close();
  expect(disposed).toEqual([valid]);
});

test('native-promise plugin validates fulfillment, disposes it, and never assimilates structural thenables', async () => {
  const fulfilled = { run: () => 9 };
  const pending = Promise.resolve(fulfilled);
  const disposed: unknown[] = [];
  const provider = DiBag.createProviderFromPlugin({
    dependencies: [],
    pluginDescriptor: { apiVersion: 1, create: () => pending, dispose: (value: unknown) => { disposed.push(value); } },
    factoryReturnKind: 'native-promise',
    isValidPluginOutput: (value: unknown): value is typeof fulfilled => value === fulfilled,
  });
  const container = DiBag.createBuilder().withServices({ provider }).buildContainer();
  expect(container.resolve('provider')).toBe(pending);
  await expect(container.resolve('provider')).resolves.toBe(fulfilled);
  await container.close();
  expect(disposed).toEqual([fulfilled]);

  const rejected = DiBag.createBuilder().withServices({
    provider: DiBag.createProviderFromPlugin({
      dependencies: [],
      pluginDescriptor: { apiVersion: 1, create: () => Promise.reject(new Error('plugin failed')) },
      factoryReturnKind: 'native-promise',
      isValidPluginOutput: (_value: unknown): _value is never => false,
    }),
  }).buildContainer();
  await expect(rejected.resolve('provider')).rejects.toThrow('plugin failed');
  await rejected.close();

  let thenCalls = 0;
  const thenable = { then() { thenCalls++; } };
  const invalid = DiBag.createBuilder().withServices({
    provider: DiBag.createProviderFromPlugin({
      dependencies: [],
      pluginDescriptor: { apiVersion: 1, create: () => thenable },
      factoryReturnKind: 'native-promise',
      isValidPluginOutput: (_value: unknown): _value is never => false,
    }),
  }).buildContainer();
  expect(() => invalid.resolve('provider')).toThrow(TypeError);
  expect(thenCalls).toBe(0);
  await invalid.close();
});

test('new source bags reject malformed arguments before factory effects', () => {
  const call = (name: 'createProviderFromFunction' | 'createProviderFromClass' | 'createProviderFromPlugin', options: unknown) => {
    try { Reflect.apply(DiBag[name] as (...arguments_: unknown[]) => unknown, undefined, [options]); throw new Error('expected rejection'); }
    catch (error) { return error as { code: string; details: unknown }; }
  };
  expect(call('createProviderFromFunction', { dependencies: [], factoryFunction: 1 })).toMatchObject({
    code: 'DI_BAG_INVALID_ARGUMENT', details: { operation: 'createProviderFromFunction', argument: 'factoryFunction', expected: 'a function' },
  });
  expect(call('createProviderFromFunction', { dependencies: null, factoryFunction: () => 1 })).toMatchObject({
    code: 'DI_BAG_INVALID_ARGUMENT', details: { operation: 'createProviderFromFunction', argument: 'dependencies', expected: 'an array' },
  });
  expect(call('createProviderFromClass', { dependencies: [], serviceClass: () => 1 })).toMatchObject({
    code: 'DI_BAG_INVALID_ARGUMENT', details: { operation: 'createProviderFromClass', argument: 'serviceClass', expected: 'a constructor that can be called with new' },
  });
  expect(call('createProviderFromPlugin', { dependencies: [], pluginDescriptor: {}, factoryReturnKind: 'uninspected' })).toMatchObject({
    code: 'DI_BAG_INVALID_ARGUMENT', details: { operation: 'createProviderFromPlugin', argument: 'isValidPluginOutput', expected: 'present' },
  });
});

test('createToken publishes symbol and both exclusive token constructors', () => {
  const symbol = Symbol('service');
  const factory = DiBag.createToken(symbol);
  expect(Object.keys(factory)).toEqual(['forService', 'forCollectionOf', 'of']);
  const service = factory.forService<number>();
  const collection = factory.forCollectionOf<number>();
  expect(service.symbol).toBe(symbol);
  expect(collection.symbol).toBe(symbol);
  expect(Object.isFrozen(service)).toBe(true);
  expect(Object.isFrozen(collection)).toBe(true);
  const builder = DiBag.createBuilder();
  expect(() => Reflect.apply(builder.withTokenService, builder, [collection, () => 1])).toThrow('DI_BAG_WRONG_TOKEN_KIND');
});
```

- [ ] **Step 2: Append S4 positive and property-located negative fixtures**

Append to `tests/types/provider-sources.ts`:

```ts
const port = DiBag.createToken(Symbol('port')).forService<number>();
const host = DiBag.createToken(Symbol('host')).forService<string>();
const values = DiBag.createToken(Symbol('values')).forCollectionOf<number>();

const inline = DiBag.createProviderFromFunction({
  dependencies: [port, DiBag.optional(host), DiBag.lazy(port), values],
  factoryFunction: (selected, maybe, get, all) => ({ selected, maybe, lazy: get(), all }),
});
const contextualPosition = DiBag.createProviderFromFunction({
  dependencies: [port],
  factoryReceivesContext: true,
  factoryFunction: (selected, factoryContext) => [selected, factoryContext.abortSignal] as const,
});
const defaulted = DiBag.createProviderFromFunction({ dependencies: [port], factoryFunction: (selected, extra = 3) => selected + extra });
const rested = DiBag.createProviderFromFunction({ dependencies: [port, port], factoryFunction: (first, ...rest) => first + rest[0] });
export const explicit = DiBag.createProviderFromFunction<
  readonly [typeof port],
  (value: number) => number,
  'sync-value'
>({ dependencies: [port], factoryFunction: value => value, factoryReturnKind: 'sync-value' });
class Client { constructor(readonly port: number, readonly host: string | undefined) {} }
const constructed = DiBag.createProviderFromClass({ dependencies: [port, DiBag.optional(host)], serviceClass: Client });
const plugin = DiBag.createProviderFromPlugin({
  dependencies: [port],
  pluginDescriptor: {} as unknown,
  factoryReturnKind: 'uninspected',
  isValidPluginOutput: (value: unknown): value is { run(): void } => typeof value === 'object' && value !== null && 'run' in value,
});

export type PositionalExact = [
  Assert<Equal<ProviderOutput<typeof inline>, { selected: number; maybe: string | undefined; lazy: number; all: readonly number[] }>>,
  Assert<Equal<ProviderOutput<typeof contextualPosition>, readonly [number, AbortSignal]>>,
  Assert<Equal<ProviderOutput<typeof defaulted>, number>>,
  Assert<Equal<ProviderOutput<typeof rested>, number>>,
  Assert<Equal<ProviderOutput<typeof explicit>, number>>,
  Assert<Equal<ProviderOutput<typeof constructed>, Client>>,
  Assert<Equal<ProviderOutput<typeof plugin>, { run(): void }>>,
];
```

Append to `tests/types/negative/provider-sources.ts`. These comments remain immediately above the object-property line that must carry the diagnostic:

```ts
const port = DiBag.createToken(Symbol('port')).forService<number>();
declare const broad: readonly typeof port[];

DiBag.createProviderFromFunction({
  // diagnostic: finite tuple
  dependencies: broad,
  factoryFunction: (...values: number[]) => values,
});
DiBag.createProviderFromFunction<readonly [typeof port], (value: number) => number, 'native-promise'>({
  dependencies: [port],
  factoryFunction: value => value,
  // diagnostic: native-promise factory return kind requires a Promise output
  factoryReturnKind: 'native-promise',
});
DiBag.createProviderFromFunction({
  dependencies: [port],
  // diagnostic: arguments must match the declared parameter tuple
  factoryFunction: (value: string) => value,
});
DiBag.createProviderFromFunction({
  dependencies: [port],
  factoryReceivesContext: true,
  // diagnostic: arguments must match the declared parameter tuple
  factoryFunction: (value: number) => value,
});
DiBag.createProviderFromFunction({
  dependencies: [port],
  // diagnostic: native-promise factory return kind requires a Promise output
  factoryFunction: value => value,
  factoryReturnKind: 'native-promise',
});
DiBag.createProviderFromClass({
  dependencies: [port],
  // diagnostic: not assignable
  serviceClass: class { constructor(_value: string) {} },
});
DiBag.createProviderFromClass({
  dependencies: [port],
  // diagnostic: Object literal may only specify known properties
  factoryReceivesContext: true,
  serviceClass: class { constructor(_value: number) {} },
});
DiBag.createProviderFromPlugin({
  dependencies: [],
  pluginDescriptor: {},
  // diagnostic: not assignable
  factoryReturnKind: 'auto-detect',
  isValidPluginOutput: (value: unknown): value is number => typeof value === 'number',
});
DiBag.createProviderFromPlugin({
  dependencies: [],
  pluginDescriptor: {},
  factoryReturnKind: 'uninspected',
  // diagnostic: not assignable
  isValidPluginOutput: (_value: unknown): boolean => true,
});
```

Create `tests/types/provider-sources-consumer.ts`:

```ts
import { DiBag } from '../../src';
import type { ProviderAcquiredValue, ProviderOutput } from '../../src';
import { automatic, contextual, explicit, inline, plugin } from './provider-sources';
import type { Assert, Equal } from './assert';

const symbol = Symbol('consumer');
const token = DiBag.createToken(symbol).forService<number>();
const positional = DiBag.createProviderFromFunction({ dependencies: [token], factoryFunction: value => value + 1 });

export type DeclarationContract = [
  Assert<Equal<ProviderOutput<typeof automatic>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof automatic>, { id: number }>>,
  Assert<Equal<ProviderOutput<typeof contextual>, { signal: AbortSignal }>>,
  Assert<Equal<ProviderOutput<typeof inline>, { selected: number; maybe: string | undefined; lazy: number; all: readonly number[] }>>,
  Assert<Equal<ProviderOutput<typeof positional>, number>>,
  Assert<Equal<ProviderOutput<typeof explicit>, number>>,
  Assert<Equal<ProviderOutput<typeof plugin>, { run(): void }>>,
  Assert<Equal<typeof token.symbol, typeof symbol>>,
];
```

Export `inline` and `plugin` from `provider-sources.ts`. Add the consumer's direct check:

```ts
test('provider source declarations retain exact inferred contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/provider-sources-consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});
```

Finally append `'provider-sources'` immediately after `'portable-factories'` in the existing declaration round-trip fixture array. Change only that array literal; retain its complete emit/consume callback byte-for-byte and do not introduce a second loop.

- [ ] **Step 3: Implement positional function and class adapters**

Add the complete definitions below to the public portion of `src/composition.ts`. Keep `OutputFactory` and the deprecated compatibility block printed after the new implementation; import `FactoryContext`, `snapshotOptionsBag`, and the Task-1 helpers.

```ts
export type PositionalFactoryArguments<
  Supplied extends readonly unknown[],
  Parameters_ extends readonly unknown[],
> = [Supplied] extends [Parameters_]
  ? unknown
  : Unsatisfied<'positional factory arguments must match the declared parameter tuple', { supplied: Supplied; parameters: Parameters_ }>;

type FactoryContextArguments<ReceivesContext extends boolean> =
  ReceivesContext extends true ? [factoryContext: FactoryContext] : [];

type PositionalArguments<
  Dependencies extends readonly DependencyReference[],
  ReceivesContext extends boolean,
> = TokenArguments<Dependencies> extends [...infer Arguments]
  ? [...Arguments, ...FactoryContextArguments<ReceivesContext>]
  : never;

export type PositionalFactoryFunction<
  Dependencies extends readonly DependencyReference[],
  Output = unknown,
  ReceivesContext extends boolean = false,
> = (this: void, ...arguments_: PositionalArguments<Dependencies, ReceivesContext>) => Output;

type ContextSelection<ReceivesContext extends boolean> = ReceivesContext extends true
  ? { readonly factoryReceivesContext: true }
  : { readonly factoryReceivesContext?: never };

type PositionalFunctionOptions<
  Dependencies extends readonly DependencyReference[],
  FactoryFunction,
  ReturnKind extends FactoryReturnKind,
  ReceivesContext extends boolean,
> = {
  readonly dependencies: Dependencies & DependencyTupleAdmission<Dependencies>;
  readonly factoryFunction: FactoryFunction;
} & ContextSelection<ReceivesContext> & ReturnKindOptions<ReturnKind>;

export function createProviderFromFunction<
  const Dependencies extends readonly DependencyReference[],
  FactoryFunction extends (this: void, ...arguments_: never[]) => unknown = PositionalFactoryFunction<NoInfer<Dependencies>>,
  ReturnKind extends FactoryReturnKind = 'auto-detect',
  ReceivesContext extends boolean = false,
>(options: PositionalFunctionOptions<Dependencies, FactoryFunction &
  PositionalFactoryFunction<NoInfer<Dependencies>, ReturnType<NoInfer<FactoryFunction>>, NoInfer<ReceivesContext>> &
  PositionalFactoryArguments<PositionalArguments<NoInfer<Dependencies>, NoInfer<ReceivesContext>>, Parameters<NoInfer<FactoryFunction>>> &
  NativeOutput<ReturnType<NoInfer<FactoryFunction>>, NoInfer<ReturnKind>> &
  AutoOutput<ReturnType<NoInfer<FactoryFunction>>, NoInfer<ReturnKind>> &
  SyncOutput<ReturnType<NoInfer<FactoryFunction>>, NoInfer<ReturnKind>>, ReturnKind, ReceivesContext>):
  Provider<OutputFactory<ReturnType<FactoryFunction>>, Readonly<{}>, readonly [], ReferenceGraph<Dependencies>, Acquired<ReturnType<FactoryFunction>, ReturnKind>>;

export function createProviderFromFunction(options: unknown): Provider<OutputFactory<unknown>> {
  const bag = snapshotOptionsBag(options, 'createProviderFromFunction', ['dependencies', 'factoryFunction'], ['factoryReturnKind', 'factoryReceivesContext']);
  if (!Array.isArray(bag.dependencies)) throw libraryError(
    'DI_BAG_INVALID_ARGUMENT', 'createProviderFromFunction dependencies must be an array',
    { operation: 'createProviderFromFunction', argument: 'dependencies', expected: 'an array' },
  );
  const references = snapshotReferences(bag.dependencies);
  if (typeof bag.factoryFunction !== 'function') throw libraryError(
    'DI_BAG_INVALID_ARGUMENT', 'createProviderFromFunction requires a factory function',
    { operation: 'createProviderFromFunction', argument: 'factoryFunction', expected: 'a function' },
  );
  if (bag.factoryReceivesContext !== undefined && bag.factoryReceivesContext !== true) throw libraryError(
    'DI_BAG_INVALID_ARGUMENT', 'createProviderFromFunction factoryReceivesContext must be true when present',
    { operation: 'createProviderFromFunction', argument: 'factoryReceivesContext', expected: "one of: 'true'" },
  );
  const returnKind = factoryReturnKind(bag.factoryReturnKind, 'createProviderFromFunction');
  const contextual = bag.factoryReceivesContext === true;
  const factoryFunction = bag.factoryFunction as (...arguments_: readonly unknown[]) => unknown;
  const create = (dependencies: Record<symbol, unknown>, factoryContext?: FactoryContext) => Reflect.apply(
    factoryFunction,
    undefined,
    contextual
      ? [...references.map(reference => Reflect.get(dependencies, reference.slot)), factoryContext!]
      : references.map(reference => Reflect.get(dependencies, reference.slot)),
  );
  const handle = createProviderHandle<OutputFactory<unknown>, Readonly<{}>, readonly [], ReferenceGraph<readonly DependencyReference[]>, unknown>();
  retainDescription(handle, sourceDescription(create, undefined, references.map(reference => reference.key), returnKind, contextual, references));
  return handle;
}

type PositionalClassOptions<
  Dependencies extends readonly DependencyReference[],
  ServiceClass,
  ReturnKind extends FactoryReturnKind,
> = {
  readonly dependencies: Dependencies & DependencyTupleAdmission<Dependencies>;
  readonly serviceClass: ServiceClass;
} & ReturnKindOptions<ReturnKind>;

export function createProviderFromClass<
  const Dependencies extends readonly DependencyReference[],
  ServiceClass extends new (...arguments_: TokenArguments<NoInfer<Dependencies>>) => unknown,
  ReturnKind extends FactoryReturnKind = 'auto-detect',
>(options: PositionalClassOptions<Dependencies, ServiceClass &
  PositionalFactoryArguments<TokenArguments<NoInfer<Dependencies>>, ConstructorParameters<NoInfer<ServiceClass>>> &
  NativeOutput<InstanceType<NoInfer<ServiceClass>>, NoInfer<ReturnKind>> &
  AutoOutput<InstanceType<NoInfer<ServiceClass>>, NoInfer<ReturnKind>> &
  SyncOutput<InstanceType<NoInfer<ServiceClass>>, NoInfer<ReturnKind>>, ReturnKind>):
  Provider<() => InstanceType<ServiceClass>, Readonly<{}>, readonly [], ReferenceGraph<Dependencies>, Acquired<InstanceType<ServiceClass>, ReturnKind>>;

export function createProviderFromClass(options: unknown): Provider<() => unknown> {
  const bag = snapshotOptionsBag(options, 'createProviderFromClass', ['dependencies', 'serviceClass'], ['factoryReturnKind']);
  if (!Array.isArray(bag.dependencies)) throw libraryError(
    'DI_BAG_INVALID_ARGUMENT', 'createProviderFromClass dependencies must be an array',
    { operation: 'createProviderFromClass', argument: 'dependencies', expected: 'an array' },
  );
  const references = snapshotReferences(bag.dependencies);
  if (typeof bag.serviceClass !== 'function') throw invalidServiceClass();
  try { Reflect.construct(new Proxy(bag.serviceClass, { construct: () => ({}) }), []); }
  catch { throw invalidServiceClass(); }
  const serviceClass = bag.serviceClass as new (...arguments_: readonly unknown[]) => unknown;
  const returnKind = factoryReturnKind(bag.factoryReturnKind, 'createProviderFromClass');
  const create = (dependencies: Record<symbol, unknown>) => Reflect.construct(
    serviceClass,
    references.map(reference => Reflect.get(dependencies, reference.slot)),
  );
  const handle = createProviderHandle<() => unknown, Readonly<{}>, readonly [], ReferenceGraph<readonly DependencyReference[]>, unknown>();
  retainDescription(handle, sourceDescription(create, undefined, references.map(reference => reference.key), returnKind, false, references));
  return handle;
}

function invalidServiceClass(): Error {
  return libraryError('DI_BAG_INVALID_ARGUMENT', 'createProviderFromClass requires a concrete constructor', {
    operation: 'createProviderFromClass', argument: 'serviceClass', expected: 'a constructor that can be called with new',
  });
}
```

Keep the legacy aliases and adapters below until Task 5. Their first three generic positions and diagnostic helpers are unchanged; their bodies translate only the internal return kind:

```ts
/** @deprecated Use PositionalFactoryArguments. */
export type CompositionArguments<Supplied extends readonly unknown[], Parameters_ extends readonly unknown[]> =
  [Supplied] extends [Parameters_] ? unknown
    : Unsatisfied<'composition arguments must match the declared parameter tuple', { supplied: Supplied; parameters: Parameters_ }>;
/** @deprecated Use PositionalFactoryFunction. */
export type CompositionFunction<Dependencies extends readonly DependencyReference[], Output = unknown> =
  TokenArguments<Dependencies> extends [...infer Arguments] ? (this: void, ...arguments_: Arguments) => Output : never;

export function fromFunction<
  const Dependencies extends readonly DependencyReference[],
  FactoryFunction extends CompositionFunction<NoInfer<Dependencies>, 'nativePromise' extends Mode ? Promise<unknown> : unknown>,
  Mode extends AcquisitionMode = 'auto',
>(
  dependencies: Dependencies & DependencyTupleAdmission<Dependencies>,
  factoryFunction: FactoryFunction
    & CompositionArguments<TokenArguments<NoInfer<Dependencies>>, Parameters<NoInfer<FactoryFunction>>>
    & LegacyNativeOutput<ReturnType<NoInfer<FactoryFunction>>, NoInfer<Mode>>
    & LegacyAutoOutput<ReturnType<NoInfer<FactoryFunction>>, NoInfer<Mode>>,
  ...modeOptions: LegacyStageOptions<Mode>
): Provider<OutputFactory<ReturnType<FactoryFunction>>, Readonly<{}>, readonly [], ReferenceGraph<Dependencies>, LegacyAcquired<ReturnType<FactoryFunction>, Mode>>;
export function fromFunction(
  dependencies: readonly DependencyReference[],
  factoryFunction: (...arguments_: never[]) => unknown,
  ...modeOptions: LegacyStageOptions<AcquisitionMode>
): Provider<OutputFactory<unknown>> {
  const mode = acquisitionMode(modeOptions[0]);
  const references = snapshotReferences(dependencies);
  if (typeof factoryFunction !== 'function') throw libraryError('DI_BAG_INVALID_FUNCTION', 'fromFunction callback must be a function', { operation: 'fromFunction' });
  const create = (values: Record<symbol, unknown>) => Reflect.apply(factoryFunction, undefined, references.map(reference => Reflect.get(values, reference.slot)));
  const handle = createProviderHandle<OutputFactory<unknown>, Readonly<{}>, readonly [], ReferenceGraph<readonly DependencyReference[]>, unknown>();
  retainDescription(handle, sourceDescription(create, undefined, references.map(reference => reference.key), normalizeLegacyMode(mode), false, references));
  return handle;
}

export function fromClass<
  const Dependencies extends readonly DependencyReference[],
  ServiceClass extends new (...arguments_: TokenArguments<NoInfer<Dependencies>>) => unknown,
  Mode extends AcquisitionMode = 'auto',
>(
  dependencies: Dependencies & DependencyTupleAdmission<Dependencies>,
  serviceClass: ServiceClass
    & CompositionArguments<TokenArguments<NoInfer<Dependencies>>, ConstructorParameters<NoInfer<ServiceClass>>>
    & LegacyNativeOutput<InstanceType<NoInfer<ServiceClass>>, NoInfer<Mode>>
    & LegacyAutoOutput<InstanceType<NoInfer<ServiceClass>>, NoInfer<Mode>>,
  ...modeOptions: LegacyStageOptions<Mode>
): Provider<() => InstanceType<ServiceClass>, Readonly<{}>, readonly [], ReferenceGraph<Dependencies>, LegacyAcquired<InstanceType<ServiceClass>, Mode>>;
export function fromClass(dependencies: readonly DependencyReference[], serviceClass: new (...arguments_: never[]) => unknown, ...modeOptions: LegacyStageOptions<AcquisitionMode>): Provider<() => unknown> {
  const mode = acquisitionMode(modeOptions[0]);
  const references = snapshotReferences(dependencies);
  if (typeof serviceClass !== 'function') throw libraryError('DI_BAG_INVALID_CONSTRUCTOR', 'fromClass requires a concrete constructor', { operation: 'fromClass' });
  try { Reflect.construct(new Proxy(serviceClass, { construct: () => ({}) }), []); }
  catch { throw libraryError('DI_BAG_INVALID_CONSTRUCTOR', 'fromClass requires a concrete constructor', { operation: 'fromClass' }); }
  const create = (values: Record<symbol, unknown>) => Reflect.construct(serviceClass, references.map(reference => Reflect.get(values, reference.slot)));
  const handle = createProviderHandle<() => unknown, Readonly<{}>, readonly [], ReferenceGraph<readonly DependencyReference[]>, unknown>();
  retainDescription(handle, sourceDescription(create, undefined, references.map(reference => reference.key), normalizeLegacyMode(mode), false, references));
  return handle;
}
```

The first three generic positions deliberately preserve 0.4's `<Dependencies, FactoryFunction, ReturnKind>` order; `ReceivesContext` is appended fourth and defaulted. A permitted S4 repair may move `NoInfer` boundaries or the contextual intersection without changing those positions, the call surface, fixture meanings, or exposed aliases.

- [ ] **Step 4: Implement the plugin bag and renamed contracts**

In `src/plugins.ts`, keep `PluginDescriptor`, descriptor validation, ownership, and the legacy adapter, then add the new public option/callable types and adapter:

```ts
export type PluginReturnKind = 'uninspected' | 'native-promise';
export type PluginOutputValidator<Service> = (this: void, value: unknown) => value is Service;

export interface CreateProviderFromPluginOptions<
  ReturnKind extends PluginReturnKind,
  Service,
  Dependencies extends readonly DependencyReference[] = readonly DependencyReference[],
> {
  readonly dependencies: Dependencies;
  readonly pluginDescriptor: unknown;
  readonly isValidPluginOutput: PluginOutputValidator<Service>;
  readonly factoryReturnKind: ReturnKind;
}

export type PluginProvider<
  Dependencies extends readonly DependencyReference[],
  Service,
  ReturnKind extends PluginReturnKind | PluginAcquisitionMode,
> = Provider<
  () => ReturnKind extends 'uninspected' | 'raw' ? Service : Promise<Awaited<Service>>,
  Readonly<{}>,
  readonly [],
  ReferenceGraph<Dependencies>,
  ReturnKind extends 'uninspected' | 'raw' ? Service : Awaited<Service>
>;

export type CreateProviderFromPlugin = <
  const Dependencies extends readonly DependencyReference[],
  Service,
  ReturnKind extends PluginReturnKind,
>(options: CreateProviderFromPluginOptions<ReturnKind, Service, Dependencies> & {
  readonly dependencies: Dependencies & DependencyTupleAdmission<Dependencies>;
}) => PluginProvider<Dependencies, Service, ReturnKind>;

function createPluginProvider(options: unknown): PluginProvider<readonly DependencyReference[], unknown, PluginReturnKind> {
  const bag = snapshotOptionsBag(options, 'createProviderFromPlugin', [
    'dependencies', 'pluginDescriptor', 'isValidPluginOutput', 'factoryReturnKind',
  ]);
  if (!Array.isArray(bag.dependencies)) throw libraryError(
    'DI_BAG_INVALID_ARGUMENT', 'createProviderFromPlugin dependencies must be an array',
    { operation: 'createProviderFromPlugin', argument: 'dependencies', expected: 'an array' },
  );
  const references = snapshotReferences(bag.dependencies);
  if (bag.factoryReturnKind !== 'uninspected' && bag.factoryReturnKind !== 'native-promise') throw libraryError(
    'DI_BAG_INVALID_ARGUMENT', 'createProviderFromPlugin factoryReturnKind must be explicit',
    { operation: 'createProviderFromPlugin', argument: 'factoryReturnKind', expected: "one of: 'uninspected', 'native-promise'" },
  );
  if (typeof bag.isValidPluginOutput !== 'function') throw libraryError(
    'DI_BAG_INVALID_ARGUMENT', 'createProviderFromPlugin requires an output predicate',
    { operation: 'createProviderFromPlugin', argument: 'isValidPluginOutput', expected: 'a function' },
  );
  const descriptor = validateDescriptor(bag.pluginDescriptor);
  const validate = bag.isValidPluginOutput as PluginOutputValidator<unknown>;
  const create: Factory = (dependencies: Record<symbol, unknown>) => Reflect.apply(
    descriptor.create, undefined, references.map(reference => Reflect.get(dependencies, reference.slot)),
  );
  const dispose = descriptor.dispose === undefined ? undefined : (value: never) => Reflect.apply(descriptor.dispose!, undefined, [value]);
  const project = (value: unknown): unknown => {
    if (Reflect.apply(validate, undefined, [value]) !== true) throw new DiBagPluginValidationError('output', 'plugin output failed validation');
    return value;
  };
  if (bag.factoryReturnKind === 'uninspected') {
    const source = createProviderHandle<Factory, Readonly<{}>, readonly [], ReferenceGraph<readonly DependencyReference[]>, unknown>();
    retainDescription(source, sourceDescription(create, dispose, references.map(reference => reference.key), 'uninspected', false, references));
    return transformService(source, { mode: 'direct', transform: project, acquisitionMode: 'uninspected' }) as unknown as PluginProvider<readonly DependencyReference[], unknown, PluginReturnKind>;
  }
  const source = createProviderHandle<() => Promise<unknown>, Readonly<{}>, readonly [], ReferenceGraph<readonly DependencyReference[]>, unknown>();
  retainDescription(source, sourceDescription(create, dispose, references.map(reference => reference.key), 'native-promise', false, references));
  return transformService(source, { mode: 'awaited', transform: project }) as unknown as PluginProvider<readonly DependencyReference[], unknown, PluginReturnKind>;
}

export const createProviderFromPlugin: CreateProviderFromPlugin = createPluginProvider as CreateProviderFromPlugin;
```

Make the error operation entry-point-specific during expand. In `src/errors.ts`, change only this complete constructor; Task 5 changes its default to the final operation after deleting `fromPlugin`:

```ts
constructor(
  readonly phase: 'descriptor' | 'output',
  readonly reason: string,
  operation: 'fromPlugin' | 'createProviderFromPlugin' = 'fromPlugin',
) {
  super(diagnosticMessage('DI_BAG_PLUGIN_VALIDATION', `Invalid plugin ${phase}: ${reason}`));
  this.name = 'DiBagPluginValidationError';
  diagnostic(this, 'DI_BAG_PLUGIN_VALIDATION', { operation, phase, reason });
}
```

Thread the operation into `invalidDescriptor(reason, operation)` and `validateDescriptor(value, operation)`. The new adapter passes `'createProviderFromPlugin'` to descriptor and output errors; the compatibility adapter below passes `'fromPlugin'` and otherwise retains its exact behavior:

```ts
/** @deprecated Use PluginReturnKind. */
export type PluginAcquisitionMode = 'raw' | 'nativePromise';
/** @deprecated Use CreateProviderFromPluginOptions. */
export interface PluginOptions<Mode extends PluginAcquisitionMode, Service> {
  readonly acquisitionMode: Mode;
  readonly validate: PluginOutputValidator<Service>;
}
/** @deprecated Use CreateProviderFromPlugin. */
export type PluginProviderFactory = <
  const Dependencies extends readonly DependencyReference[],
  Service,
  Mode extends PluginAcquisitionMode,
>(dependencies: Dependencies & DependencyTupleAdmission<Dependencies>, plugin: unknown, options: PluginOptions<Mode, Service>) =>
  PluginProvider<Dependencies, Service, Mode extends 'raw' ? 'uninspected' : 'native-promise'>;

function validateLegacyPluginOptions<Service>(value: unknown): { readonly acquisitionMode: PluginAcquisitionMode; readonly validate: PluginOutputValidator<Service> } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw libraryError('DI_BAG_INVALID_PLUGIN_OPTIONS', 'fromPlugin requires acquisitionMode and validate options', { operation: 'fromPlugin' });
  if (!Object.hasOwn(value, 'acquisitionMode')) throw libraryError('DI_BAG_INVALID_PLUGIN_OPTIONS', 'fromPlugin requires acquisitionMode', { operation: 'fromPlugin' });
  const acquisitionMode = Reflect.get(value, 'acquisitionMode');
  if (acquisitionMode !== 'raw' && acquisitionMode !== 'nativePromise') throw libraryError('DI_BAG_INVALID_PLUGIN_OPTIONS', 'fromPlugin acquisitionMode must be raw or nativePromise', { operation: 'fromPlugin' });
  if (!Object.hasOwn(value, 'validate')) throw libraryError('DI_BAG_INVALID_PLUGIN_OPTIONS', 'fromPlugin requires a validation predicate', { operation: 'fromPlugin' });
  const validate = Reflect.get(value, 'validate');
  if (typeof validate !== 'function') throw libraryError('DI_BAG_INVALID_PLUGIN_OPTIONS', 'fromPlugin validate must be a function', { operation: 'fromPlugin' });
  return Object.freeze({ acquisitionMode, validate: validate as PluginOutputValidator<Service> });
}

function legacyPluginProvider(dependencies: readonly DependencyReference[], plugin: unknown, options: unknown): PluginProvider<readonly DependencyReference[], unknown, PluginReturnKind> {
  const selected = validateLegacyPluginOptions(options);
  return createPluginProvider({
    dependencies,
    pluginDescriptor: plugin,
    factoryReturnKind: selected.acquisitionMode === 'raw' ? 'uninspected' : 'native-promise',
    isValidPluginOutput: selected.validate,
  }, 'fromPlugin');
}

export const fromPlugin: PluginProviderFactory = legacyPluginProvider as PluginProviderFactory;
```

Give `createPluginProvider` a second internal parameter `operation: 'fromPlugin' | 'createProviderFromPlugin' = 'createProviderFromPlugin'`; use it only for plugin-validation error details while new option-bag failures always keep `operation: 'createProviderFromPlugin'`. `snapshotOptionsBag` reports a missing required property before this body, so the runtime test's missing `isValidPluginOutput` receives `{ argument: 'isValidPluginOutput', expected: 'present' }`.

`PluginProvider` keeps its public name. Its expanded third parameter accepts both vocabularies so an existing `PluginProvider<Dependencies, Service, 'raw'>` annotation still works; the new constructor accepts only `PluginReturnKind`. Task 5 narrows this alias to the final vocabulary. The codemod's same-name type entry still rewrites its third generic argument.

- [ ] **Step 5: Implement final token names without changing token kinds**

In `src/tokens.ts`, use these additive token declarations during expand; keep their existing invariant symbols and nominal bases:

```ts
class Token<TokenSymbol extends symbol, Service> extends TokenBase {
  declare readonly [tokenInvariant]: (service: [TokenSymbol, Service]) => [TokenSymbol, Service];
  readonly key: TokenSymbol;
  constructor(readonly symbol: TokenSymbol) { super(); this.key = symbol; }
}

class CollectionToken<TokenSymbol extends symbol, Item> extends CollectionTokenBase {
  declare readonly [collectionTokenInvariant]: (item: [TokenSymbol, Item]) => [TokenSymbol, Item];
  readonly key: TokenSymbol;
  constructor(readonly symbol: TokenSymbol) { super(); this.key = symbol; }
}
```

Keep the private authentication record named `{ key, kind }` because it is internal graph vocabulary. Replace only the public factory with:

```ts
export function createToken<const TokenSymbol extends symbol>(
  symbol: TokenSymbol & TokenKeyAdmission<TokenSymbol>,
  ...invalid: [TokenSymbol] extends [never] ? [TokenKeyAdmission<TokenSymbol>] : []
): {
  readonly forService: <Service>() => Token<TokenSymbol, Service>;
  readonly forCollectionOf: <Item>() => CollectionToken<TokenSymbol, Item>;
  /** @deprecated Use forService. */
  readonly of: <Service>() => Token<TokenSymbol, Service>;
} {
  if (typeof symbol !== 'symbol') throw libraryError(
    'DI_BAG_INVALID_TOKEN', 'createToken symbol must be a symbol', { operation: 'createToken' },
  );
  const forService = <Service>(): Token<TokenSymbol, Service> => {
      const handle = new Token<TokenSymbol, Service>(symbol);
      tokens.set(handle, Object.freeze({ key: symbol, kind: 'single-service' }));
      Object.freeze(handle);
      return handle;
    };
  return Object.freeze({
    forService,
    forCollectionOf: <Item>(): CollectionToken<TokenSymbol, Item> => {
      const handle = new CollectionToken<TokenSymbol, Item>(symbol);
      tokens.set(handle, Object.freeze({ key: symbol, kind: 'collection' }));
      Object.freeze(handle);
      return handle;
    },
    of: forService,
  });
}
```

Keep `token(symbol)` as a deprecated wrapper returning the same dual factory:

```ts
/** @deprecated Use createToken. */
export function token<const TokenSymbol extends symbol>(
  symbol: TokenSymbol & TokenKeyAdmission<TokenSymbol>,
  ...invalid: [TokenSymbol] extends [never] ? [TokenKeyAdmission<TokenSymbol>] : []
): ReturnType<typeof createToken<TokenSymbol>> {
  if (typeof symbol !== 'symbol') throw libraryError('DI_BAG_INVALID_TOKEN', 'token key must be a symbol', { operation: 'token' });
  return createToken(symbol);
}
```

Task 5 removes `token`, `of`, and both `key` properties, then changes the expand runtime assertion to `['forService', 'forCollectionOf']`. Until then, old token and collection tests continue to use the identical authenticated handles and `GraphDescription.tokenKinds`.

`TokenKey<T>` and `CollectionItem<T>` are conditional on nominal token types rather than the public property spelling, so leave both bodies unchanged. Do not modify `TokenKind`, `readToken`, graph claims, `GraphDescription.tokenKinds`, or collection return views.

- [ ] **Step 6: Publish all expand names**

Add these facade members and values:

```ts
readonly createProviderFromFunction: typeof createProviderFromFunction;
readonly createProviderFromClass: typeof createProviderFromClass;
readonly createProviderFromPlugin: CreateProviderFromPlugin;
readonly createToken: typeof createToken;
```

Export from `src/index.ts`:

```ts
export type { PositionalFactoryArguments, PositionalFactoryFunction } from './composition';
export type { CreateProviderFromPlugin, CreateProviderFromPluginOptions, PluginOutputValidator, PluginProvider, PluginReturnKind } from './plugins';
```

Keep old names during expand. Before Task 2's first `npm run docs:generate`, attach these fenced JSDoc blocks to the five new `DiBagApi` facade members. The generator ignores inline-code `@example` text; retain the literal fences and keep every snippet independently compilable after its automatic `DiBag` import:

````ts
/**
 * Creates a provider from a named-dependency factory.
 * @example
 * ```ts
 * const config = DiBag.createProvider(() => ({ url: 'memory:' }), { factoryReturnKind: 'sync-value' });
 * ```
 */
readonly createProvider: typeof createProvider;

/**
 * Creates a provider whose factory receives positional dependency values.
 * @example
 * ```ts
 * const port = DiBag.createToken(Symbol('port')).forService<number>();
 * const client = DiBag.createProviderFromFunction({ dependencies: [port], factoryFunction: value => ({ port: value }) });
 * ```
 */
readonly createProviderFromFunction: typeof createProviderFromFunction;

/**
 * Creates a provider that constructs a class from positional dependencies.
 * @example
 * ```ts
 * const port = DiBag.createToken(Symbol('port')).forService<number>();
 * class Client { constructor(readonly port: number) {} }
 * const client = DiBag.createProviderFromClass({ dependencies: [port], serviceClass: Client });
 * ```
 */
readonly createProviderFromClass: typeof createProviderFromClass;

/**
 * Creates a provider from a versioned plugin descriptor.
 * @example
 * ```ts
 * const pluginDescriptor = { apiVersion: 1 as const, create: () => ({ run() {} }) };
 * const plugin = DiBag.createProviderFromPlugin({ dependencies: [], pluginDescriptor, factoryReturnKind: 'uninspected', isValidPluginOutput: (value): value is { run(): void } => typeof value === 'object' && value !== null });
 * ```
 */
readonly createProviderFromPlugin: CreateProviderFromPlugin;

/**
 * Creates a nominal token from a symbol.
 * @example
 * ```ts
 * const clock = DiBag.createToken(Symbol('clock')).forService<{ now(): number }>();
 * ```
 */
readonly createToken: typeof createToken;
````

Ensure every public bag signature prints every property. The old facade members keep their existing fenced examples during expand so the dual-surface generation remains valid; Task 5 removes those members and their examples together.

- [ ] **Step 7: Run the S4 compiler proof and runtime tests**

Coordinate the only compiler run with the controller. Run the narrow fixture first. Run all twelve evidence cases only after the fixture is green **and** the controller separately lifts the evidence hold; the serialized compiler exception alone is insufficient:

```bash
bun test tests/provider-sources.test.ts tests/plugins.test.ts tests/composition-adapters.test.ts tests/collection-tokens.test.ts
node scripts/evidence-cases.mjs --compare docs/superpowers/plans/evidence/baseline.md --json /tmp/phase-08-s4.json
```

Expected runtime: all pass. Expected compiler: inline required/optional/lazy/collection parameters, default parameters, rest parameters, and the final `FactoryContext` are inferred; every negative marker is on its offending property. Expected evidence: twelve accepted rows, no token diagnostics, every cumulative change `<= 10%`.

Create `docs/superpowers/plans/evidence/phase-08.md` with the command, compiler wrapper version `6.0.2`, actual API version `6.0.3`, the twelve literal JSON rows rendered as a baseline/now/change table, and `Decision: S4 adopted` only if both inference and budget rules pass.

- [ ] **Step 8: Repair S4 no more than three times**

Permitted repairs are generic ordering, `NoInfer` placement, and tuple materialization in `PositionalArguments`. Do not weaken `DependencyTupleAdmission`, remove a negative test, annotate inline callback parameters, or move `factoryFunction` out of the bag. After each repair rerun the same serialized fixture and evidence command and append the attempt numbers to the evidence note.

- [ ] **Step 9: Complete fallback when S4 fails**

If the third serious attempt fails inference or any row exceeds +10%, replace only the function/class call shape with:

```ts
export function createProviderFromFunction<
  const Dependencies extends readonly DependencyReference[],
  FactoryFunction extends (this: void, ...arguments_: never[]) => unknown = PositionalFactoryFunction<NoInfer<Dependencies>>,
  ReturnKind extends FactoryReturnKind = 'auto-detect',
  ReceivesContext extends boolean = false,
>(
  dependencies: Dependencies & DependencyTupleAdmission<Dependencies>,
  factoryFunction: FactoryFunction
    & PositionalFactoryFunction<NoInfer<Dependencies>, ReturnType<NoInfer<FactoryFunction>>, NoInfer<ReceivesContext>>
    & PositionalFactoryArguments<PositionalArguments<NoInfer<Dependencies>, NoInfer<ReceivesContext>>, Parameters<NoInfer<FactoryFunction>>>
    & NativeOutput<ReturnType<NoInfer<FactoryFunction>>, NoInfer<ReturnKind>>
    & AutoOutput<ReturnType<NoInfer<FactoryFunction>>, NoInfer<ReturnKind>>
    & SyncOutput<ReturnType<NoInfer<FactoryFunction>>, NoInfer<ReturnKind>>,
  ...options: 'auto-detect' extends ReturnKind
    ? [options?: ContextSelection<ReceivesContext> & ReturnKindOptions<ReturnKind>]
    : [options: ContextSelection<ReceivesContext> & ReturnKindOptions<ReturnKind>]
): Provider<OutputFactory<ReturnType<FactoryFunction>>, Readonly<{}>, readonly [], ReferenceGraph<Dependencies>, Acquired<ReturnType<FactoryFunction>, ReturnKind>>;

export function createProviderFromFunction(
  dependencies: unknown,
  factoryFunction: unknown,
  options?: unknown,
): Provider<OutputFactory<unknown>> {
  const selected = options === undefined
    ? Object.create(null) as Record<string, unknown>
    : snapshotOptionsBag(options, 'createProviderFromFunction', [], ['factoryReturnKind', 'factoryReceivesContext']);
  return createProviderFromFunctionOptions({ dependencies, factoryFunction, ...selected });
}

export function createProviderFromClass<
  const Dependencies extends readonly DependencyReference[],
  ServiceClass extends new (...arguments_: TokenArguments<NoInfer<Dependencies>>) => unknown,
  ReturnKind extends FactoryReturnKind = 'auto-detect',
>(
  dependencies: Dependencies & DependencyTupleAdmission<Dependencies>,
  serviceClass: ServiceClass
    & PositionalFactoryArguments<TokenArguments<NoInfer<Dependencies>>, ConstructorParameters<NoInfer<ServiceClass>>>
    & NativeOutput<InstanceType<NoInfer<ServiceClass>>, NoInfer<ReturnKind>>
    & AutoOutput<InstanceType<NoInfer<ServiceClass>>, NoInfer<ReturnKind>>
    & SyncOutput<InstanceType<NoInfer<ServiceClass>>, NoInfer<ReturnKind>>,
  ...options: 'auto-detect' extends ReturnKind
    ? [options?: ReturnKindOptions<ReturnKind>]
    : [options: ReturnKindOptions<ReturnKind>]
): Provider<() => InstanceType<ServiceClass>, Readonly<{}>, readonly [], ReferenceGraph<Dependencies>, Acquired<InstanceType<ServiceClass>, ReturnKind>>;

export function createProviderFromClass(
  dependencies: unknown,
  serviceClass: unknown,
  options?: unknown,
): Provider<() => unknown> {
  const selected = options === undefined
    ? Object.create(null) as Record<string, unknown>
    : snapshotOptionsBag(options, 'createProviderFromClass', [], ['factoryReturnKind']);
  return createProviderFromClassOptions({ dependencies, serviceClass, ...selected });
}
```

Rename the adopted implementation bodies from Step 3 to private `createProviderFromFunctionOptions(options: unknown)` and `createProviderFromClassOptions(options: unknown)` functions without changing their printed bodies. The two fallback implementations above are the complete public wrappers: they call the accepted helper with four arguments while preserving its optional fifth parameter, form the object consumed by those private functions, and therefore preserve the same array, callable, constructor, return-kind, and context validation. Rewrite every new fixture and example to `createProviderFromFunction(dependencies, factoryFunction, options?)` and `createProviderFromClass(dependencies, serviceClass, options?)`. The codemod in Task 4 emits those positional pairs and merges renamed options. Add this exact measured exception to `docs/guides/api-naming.md`: “`createProviderFromFunction` and `createProviderFromClass` keep the dependency tuple and callable positional because one object literal failed S4 contextual inference or the +10% instantiation budget; an optional bag follows.” Record `Decision: S4 fallback` plus the failed rows/diagnostics in phase evidence.

Use these exact fallback fixture forms, retaining all existing assertions:

```ts
export const inline = DiBag.createProviderFromFunction(
  [port, DiBag.optional(host), DiBag.lazy(port), values],
  (selected, maybe, get, all) => ({ selected, maybe, lazy: get(), all }),
);
const contextualPosition = DiBag.createProviderFromFunction(
  [port],
  (selected, factoryContext) => [selected, factoryContext.abortSignal] as const,
  { factoryReceivesContext: true },
);
const defaulted = DiBag.createProviderFromFunction([port], (selected, extra = 3) => selected + extra);
const rested = DiBag.createProviderFromFunction([port, port], (first, ...rest) => first + rest[0]);
export const explicit = DiBag.createProviderFromFunction<readonly [typeof port], (value: number) => number, 'sync-value'>(
  [port], value => value, { factoryReturnKind: 'sync-value' },
);
const constructed = DiBag.createProviderFromClass([port, DiBag.optional(host)], Client);
```

```ts
// diagnostic: finite tuple
DiBag.createProviderFromFunction(broad, (...values: number[]) => values);
DiBag.createProviderFromFunction([port],
  // diagnostic: arguments must match the declared parameter tuple
  (value: string) => value,
);
DiBag.createProviderFromFunction([port],
  // diagnostic: arguments must match the declared parameter tuple
  (value: number) => value,
  { factoryReceivesContext: true },
);
DiBag.createProviderFromFunction([port], value => value, {
  // diagnostic: native-promise factory return kind requires a Promise output
  factoryReturnKind: 'native-promise',
});
DiBag.createProviderFromClass([port],
  // diagnostic: not assignable
  class { constructor(_value: string) {} },
);
DiBag.createProviderFromClass([port], class { constructor(_value: number) {} }, {
  // diagnostic: Object literal may only specify known properties
  factoryReceivesContext: true,
});
```

The plugin bag fixtures do not change under fallback. These forms keep each marker on the offending callable or option property rather than the opening call line.

- [ ] **Step 10: Generate dual-surface docs, prove the additive checkpoint green, and commit expand**

After S4 is selected, obtain the applicable controller authorization, then run:

```bash
npm run build
npm run docs:generate
bun test tests/provider-sources.test.ts tests/portable-factories.test.ts tests/acquisition-mode.test.ts tests/plugins.test.ts tests/composition-adapters.test.ts tests/collection-tokens.test.ts
npm run docs:check
```

Run the serialized provider-source compiler fixture and declaration-consumer checks from Steps 1–2. Expected: both API generations render, all legacy tests remain green through the compatibility layer, all new runtime tests pass, and every positive/negative/declaration fixture matches. Then commit the additive surface and generated dual docs:

```bash
git add src tests/provider-sources.test.ts tests/types/provider-sources.ts tests/types/provider-sources-consumer.ts tests/types/negative/provider-sources.ts tests/types.test.ts docs/agent/api-card.md docs/reference docs/superpowers/plans/evidence/phase-08.md
git commit -m "feat(provider): add provider source APIs" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL"
```

This commit is green because every old declaration and runtime view still exists; no generated-doc exception is requested.

---

### Task 3: Teach the accumulated codemod every provider-source shape

**Files:**
- Modify: `tools/codemod/rename-map.json`
- Create: `tools/codemod/lib/transforms/provider-sources.mjs`
- Modify: `tools/codemod/rename-map.schema.json`, `tools/codemod/lib/rename-map.mjs`, `tools/codemod/lib/rewrite.mjs`, `tools/codemod/lib/transforms/collection-token.mjs`, `tools/codemod/lib/transforms/index.mjs`
- Create: `tools/codemod/test/fixtures/provider-sources/input.ts`, `expected.ts`, `expected-manual.json`
- Create: `tools/codemod/test/fixtures/provider-sources-behavior/input.ts`, `expected.ts`, `expected-manual.json`
- Create: `tools/codemod/test/fixtures/provider-type-values/input.ts`, `expected.ts`, `expected-manual.json`
- Create: `tools/codemod/test/fixtures/provider-source-generics/input.ts`, `expected.ts`, `expected-manual.json`
- Create: `tools/codemod/test/fixtures/provider-token-classification/input.ts`, `expected.ts`, `expected-manual.json`
- Create: `tools/codemod/test/fixtures/provider-token-classification-import/input.ts`, `expected.ts`, `expected-manual.json`
- Modify: `tools/codemod/test/transforms.test.mjs`, `tools/codemod/test/rename-map.test.mjs`
- Modify: every older shipped-map fixture `expected.ts` containing a phase-8 name

**Interfaces:**
- Consumes: the accumulated 0.4.0-to-0.5.0 map, original-program symbol resolution, `api.nameOf(owner, oldName)`, and plan 07's method-entry `transformNames` plus `api.nameForRole(role)`.
- Produces: one-pass rewrites for factory, positional, class, plugin, context, return-kind, and token names. Owners remain real 0.4.0 declarations; every newly emitted bag field comes from `transformNames`.

- [ ] **Step 1: Merge exact rename-map entries**

Merge these objects into the existing arrays without removing earlier phases:

```json
{
  "methods": [
    { "owner": "DiBagApi", "from": "fromFactory", "to": "createProvider", "transform": "provider-sources", "transformNames": { "factory": "factory", "returnKind": "factoryReturnKind", "receivesContext": "factoryReceivesContext" } },
    { "owner": "DiBagApi", "from": "fromSyncFactory", "to": "createProvider", "transform": "provider-sources", "transformNames": { "factory": "factory", "returnKind": "factoryReturnKind", "receivesContext": "factoryReceivesContext" } },
    { "owner": "DiBagApi", "from": "fromAsyncFactory", "to": "createProvider", "transform": "provider-sources", "transformNames": { "factory": "factory", "returnKind": "factoryReturnKind", "receivesContext": "factoryReceivesContext" } },
    { "owner": "DiBagApi", "from": "fromFunction", "to": "createProviderFromFunction", "transform": "provider-sources", "transformNames": { "dependencies": "dependencies", "callable": "factoryFunction", "returnKind": "factoryReturnKind", "receivesContext": "factoryReceivesContext" } },
    { "owner": "DiBagApi", "from": "fromClass", "to": "createProviderFromClass", "transform": "provider-sources", "transformNames": { "dependencies": "dependencies", "callable": "serviceClass", "returnKind": "factoryReturnKind" } },
    { "owner": "DiBagApi", "from": "fromPlugin", "to": "createProviderFromPlugin", "transform": "provider-sources", "transformNames": { "dependencies": "dependencies", "descriptor": "pluginDescriptor", "validator": "isValidPluginOutput", "returnKind": "factoryReturnKind" } },
    { "owner": "DiBagApi", "from": "token", "to": "createToken" },
    { "owner": "token()", "from": "of", "to": "forCollectionOf", "transform": "collection-token", "transformNames": { "single": "forService", "collection": "forCollectionOf" } }
  ],
  "values": [
    { "owner": "DiBagApi", "method": "transformService", "argument": 1, "path": ["acquisitionMode"], "from": "auto", "to": "auto-detect" },
    { "owner": "DiBagApi", "method": "transformService", "argument": 1, "path": ["acquisitionMode"], "from": "raw", "to": "uninspected" },
    { "owner": "DiBagApi", "method": "transformService", "argument": 1, "path": ["acquisitionMode"], "from": "nativePromise", "to": "native-promise" }
  ],
  "properties": [
    { "owner": "Token", "from": "key", "to": "symbol" },
    { "owner": "CollectionToken", "from": "key", "to": "symbol" },
    { "owner": "AcquisitionContext", "from": "signal", "to": "abortSignal" },
    { "owner": "BindingSnapshot", "from": "acquisitionMode", "to": "factoryReturnKind" }
  ],
  "types": [
    { "from": "AcquisitionMode", "to": "FactoryReturnKind", "literalValues": { "auto": "auto-detect", "raw": "uninspected", "nativePromise": "native-promise" } },
    { "from": "AcquisitionContext", "to": "FactoryContext" },
    { "from": "CompositionArguments", "to": "PositionalFactoryArguments" },
    { "from": "CompositionFunction", "to": "PositionalFactoryFunction" },
    { "from": "PluginAcquisitionMode", "to": "PluginReturnKind", "literalValues": { "raw": "uninspected", "nativePromise": "native-promise" } },
    { "from": "PluginOptions", "to": "CreateProviderFromPluginOptions", "genericArguments": [{ "index": 0, "values": { "raw": "uninspected", "nativePromise": "native-promise" } }] },
    { "from": "PluginProviderFactory", "to": "CreateProviderFromPlugin" },
    { "from": "PluginProvider", "to": "PluginProvider", "genericArguments": [{ "index": 2, "values": { "raw": "uninspected", "nativePromise": "native-promise" } }] }
  ]
}
```

The `token().of` object **updates** phase 4's existing entry; do not append a second entry with the same owner/name. `token()` is the real phase-1 owner for the inline return type of the original `token` function. Extend `collection-token.mjs` so its collection classifier emits `api.nameForRole('collection')`, its single classifier emits `api.nameForRole('single')`, and mixed/untraceable creation remains manual. Preserve the phase-4 `collection-tokens.mjs` whole-program analysis and the `collection-read`/`collection-reference` transforms. `CreateProviderFromPluginOptions<ReturnKind, Service, Dependencies = readonly DependencyReference[]>` deliberately preserves `PluginOptions<ReturnKind, Service>`'s first two generic positions and appends the dependency tuple with a default. The type name alone is insufficient because its first generic uses renamed string values, so implement the explicit schema extension below. `PluginProvider` keeps its export name.

Replace the phase-4 `collection-token.mjs` body with:

```js
import { creationUse, locate } from './collection-tokens.mjs';

export default function collectionToken(call, api) {
  const callee = call.expression;
  const use = creationUse(api, call);
  if (use.state === 'collection' || use.state === 'single') {
    return api.assemble(call, [{
      start: api.start(callee.name),
      end: callee.name.end,
      text: api.nameForRole(use.state),
    }]);
  }
  if (use.state === 'mixed') {
    api.manual(call, `${use.name} is used as a collection and as a single service (${locate(use.otherUse)}); create a second token with ${api.nameForRole('collection')} and keep the single token with ${api.nameForRole('single')}`);
  } else {
    api.manual(call, `token creation is not bound to a traceable program variable; choose ${api.nameForRole('single')} or ${api.nameForRole('collection')} by hand`);
  }
  return undefined;
}
```

Phase 1's `types: [{ from, to }]` schema cannot transform generic arguments and has no `manual` field. Extend it rather than claiming the simple entry does more than a name rename. Add optional `genericArguments` to a type entry in `rename-map.schema.json`:

```json
"genericArguments": {
  "type": "array",
  "items": {
    "type": "object",
    "additionalProperties": false,
    "required": ["index", "values"],
    "properties": {
      "index": { "type": "integer", "minimum": 0 },
      "values": {
        "type": "object",
        "minProperties": 1,
        "additionalProperties": { "type": "string", "minLength": 1 }
      }
    }
  }
}
```

Add this sibling property to each type-entry schema beside `genericArguments`:

```json
"literalValues": {
  "type": "object",
  "minProperties": 1,
  "additionalProperties": { "type": "string", "minLength": 1 }
}
```

Update `TypeEntry` to `{ from: string, to: string, genericArguments?: { index: number, values: Record<string, string> }[], literalValues?: Record<string, string> }`. In `validateRenameMap`'s type loop, after the existing string check, add:

```js
const rules = entry.genericArguments;
if (rules !== undefined && (!Array.isArray(rules) || rules.some(rule =>
  typeof rule !== 'object' || rule === null || !Number.isInteger(rule.index) || rule.index < 0 ||
  typeof rule.values !== 'object' || rule.values === null || Array.isArray(rule.values) ||
  Object.keys(rule.values).length === 0 || !Object.entries(rule.values).every(([from, to]) => isString(from) && isString(to))
))) bad('types', index, 'genericArguments must map non-negative indices and string literal values');
if (Array.isArray(rules) && new Set(rules.map(rule => rule.index)).size !== rules.length) bad('types', index, 'genericArguments indices must be unique');
const literalValues = entry.literalValues;
if (literalValues !== undefined && (
  typeof literalValues !== 'object' || literalValues === null || Array.isArray(literalValues) ||
  Object.keys(literalValues).length === 0 || !Object.entries(literalValues).every(([from, to]) => isString(from) && isString(to))
)) bad('types', index, 'literalValues must map non-empty string literals');
```

Change the type index to retain whole entries:

```js
const types = new Map((map.types ?? []).map(entry => [entry.from, entry]));
```

Return that `types` map through the existing `indexRenameMap` result shorthand in place of the old string-valued map.

In `lib/rewrite.mjs`, add these complete alias-aware handlers before `rewriteIdentifier`:

```js
function typeTarget(node) {
  const name = ts.isTypeReferenceNode(node) ? node.typeName
    : ts.isImportTypeNode(node) ? node.qualifier
      : undefined;
  if (name === undefined) return undefined;
  const target = ts.isQualifiedName(name) ? name.right : name;
  if (!ts.isIdentifier(target)) return undefined;
  const canonical = library.exportNameOf(library.symbolAt(target));
  const entry = canonical === undefined ? undefined : index.types.get(canonical);
  return entry === undefined ? undefined : { name, target, canonical, entry };
}

function mapTypeArgument(argument, values, replacements) {
  if (ts.isLiteralTypeNode(argument) && isStringValue(argument.literal)) {
    const target = values[argument.literal.text];
    if (target === undefined) return false;
    replacements.push({ start: start(argument.literal), end: argument.literal.end, text: quote(argument.literal, target) });
    return true;
  }
  if (ts.isUnionTypeNode(argument)) return argument.types.every(item => mapTypeArgument(item, values, replacements));
  return false;
}

function rewriteMappedType(node) {
  const resolved = typeTarget(node);
  if (resolved === undefined || resolved.entry.genericArguments === undefined) return undefined;
  const { name, target, canonical, entry } = resolved;
  const replacements = [];
  if (target.text === canonical || ts.isQualifiedName(name) || ts.isImportTypeNode(node)) {
    replacements.push({ start: start(target), end: target.end, text: entry.to });
  }
  for (const rule of entry.genericArguments) {
    const argument = node.typeArguments?.[rule.index];
    if (argument === undefined || !mapTypeArgument(argument, rule.values, replacements)) {
      manual(node, `${entry.from} has a nonliteral or unsupported generic argument ${rule.index}; rewrite it to ${entry.to} by hand`);
      return replacements.length === 0 ? undefined : assemble(node, replacements);
    }
  }
  return assemble(node, replacements);
}

function rewriteTypedLegacyLiteral(node) {
  if (!isStringValue(node)) return undefined;
  const contextual = checker.getContextualType(node);
  const symbol = contextual?.aliasSymbol ?? contextual?.symbol;
  const canonical = symbol && library.exportNameOf(symbol);
  const entry = canonical === undefined ? undefined : index.types.get(canonical);
  const target = entry?.literalValues?.[node.text];
  return target === undefined ? undefined : quote(node, target);
}
```

Change `rewriteIdentifier`'s first two lines to:

```js
const entry = index.types.get(node.text);
if (entry === undefined) return undefined;
if ((ts.isTypeReferenceNode(node.parent) || ts.isImportTypeNode(node.parent)) && entry.genericArguments !== undefined) return undefined;
const target = entry.to;
```

Dispatch type-reference and import-type nodes to `rewriteMappedType(node)` before identifiers, and string literals to `rewriteTypedLegacyLiteral(node)` before the ordinary value handler. For a local alias (`import type { PluginOptions as P }`), keep `P` at the use and let the import-specifier rewrite change only its imported side; still rewrite its generic literals. For `NS.PluginOptions` and `import('di-bag').PluginOptions`, rename the right-hand qualifier and generic literals. A nonliteral generic is name-renamed where needed, left otherwise intact, and always emits the exact manual item; it is never silently skipped. This extension does not invent a `manual` property in the phase-1 schema.

Append these exact schema/index assertions to `rename-map.test.mjs` (the file already imports `assert`, `validateRenameMap`, and `indexRenameMap`):

```js
test('type literal-value and generic rules validate and remain indexed', () => {
  const entry = {
    from: 'PluginOptions', to: 'CreateProviderFromPluginOptions',
    literalValues: { raw: 'uninspected' },
    genericArguments: [{ index: 0, values: { raw: 'uninspected' } }],
  };
  const map = { version: 1, types: [entry] };
  assert.deepEqual(validateRenameMap(map, []), []);
  assert.deepEqual(indexRenameMap(map).types.get('PluginOptions'), entry);
  assert.deepEqual(validateRenameMap({ version: 1, types: [{ from: 'A', to: 'B', literalValues: {} }] }, []), [
    'types[0]: literalValues must map non-empty string literals',
  ]);
  assert.deepEqual(validateRenameMap({ version: 1, types: [{ from: 'A', to: 'B', genericArguments: [{ index: 0, values: {} }] }] }, []), [
    'types[0]: genericArguments must map non-negative indices and string literal values',
  ]);
  assert.deepEqual(validateRenameMap({ version: 1, types: [{ from: 'A', to: 'B', genericArguments: true }] }, []), [
    'types[0]: genericArguments must map non-negative indices and string literal values',
  ]);
});
```

Create `tools/codemod/test/fixtures/provider-type-values/input.ts`:

```ts
import type { AcquisitionMode, PluginAcquisitionMode, PluginOptions, PluginProvider } from 'di-bag';
import type { PluginOptions as P } from 'di-bag';
import type * as DB from 'di-bag';

export type Direct = PluginOptions<'raw' | 'nativePromise', number>;
export type Alias = P<'raw', number>;
export type Namespace = DB.PluginOptions<'nativePromise', number>;
export type Imported = import('di-bag').PluginOptions<'raw', number>;
export type Nested = Readonly<PluginOptions<'raw', number>>;
export type Generic<Mode extends PluginAcquisitionMode> = P<Mode, number>;

export const mode: AcquisitionMode = 'raw';
export const pluginMode: PluginAcquisitionMode = 'nativePromise';
export type ExistingName = PluginProvider<readonly [], number, 'raw' | 'nativePromise'>;
```

Its `expected.ts` is:

```ts
import type { FactoryReturnKind, PluginReturnKind, CreateProviderFromPluginOptions, PluginProvider } from 'di-bag';
import type { CreateProviderFromPluginOptions as P } from 'di-bag';
import type * as DB from 'di-bag';

export type Direct = CreateProviderFromPluginOptions<'uninspected' | 'native-promise', number>;
export type Alias = P<'uninspected', number>;
export type Namespace = DB.CreateProviderFromPluginOptions<'native-promise', number>;
export type Imported = import('di-bag').CreateProviderFromPluginOptions<'uninspected', number>;
export type Nested = Readonly<CreateProviderFromPluginOptions<'uninspected', number>>;
export type Generic<Mode extends PluginReturnKind> = P<Mode, number>;

export const mode: FactoryReturnKind = 'uninspected';
export const pluginMode: PluginReturnKind = 'native-promise';
export type ExistingName = PluginProvider<readonly [], number, 'uninspected' | 'native-promise'>;
```

Its `expected-manual.json` is:

```json
[
  { "line": 10, "reason": "PluginOptions has a nonliteral or unsupported generic argument 0; rewrite it to CreateProviderFromPluginOptions by hand" }
]
```

The fixture harness compares this file with `result.manual.map(({ line, reason }) => ({ line, reason }))`. `runCodemod` deliberately retains the richer raw records `{ file, line, column, reason, text }`; do not change the engine result shape merely to match the fixture projection.

The normal fixture runner supplies the vendored 0.4 declarations and proves direct, local-alias, namespace, import-type, literal-union, nested, generic-variable/manual, and typed-literal cases byte-for-byte.

Create `tools/codemod/test/fixtures/provider-source-generics/input.ts` to cover explicit method type arguments at their real 0.4 positions (`fromFactory` index 1; function/class/plugin index 2):

```ts
import { DiBag } from 'di-bag';
import type { AcquisitionMode } from 'di-bag';

const clock = DiBag.token(Symbol('clock')).of<{ now(): number }>();
type Dependencies = readonly [typeof clock];
type ReadClock = (clock: { now(): number }) => number;
class Client { constructor(readonly clock: { now(): number }) {} }

export const factory = DiBag.fromFactory<() => number, 'raw'>(() => 1, { acquisitionMode: 'raw' });
export const union = DiBag.fromFactory<() => Promise<number>, 'raw' | 'nativePromise'>(() => Promise.resolve(1), { acquisitionMode: 'raw' });
export const positional = DiBag.fromFunction<Dependencies, ReadClock, 'raw'>([clock], value => value.now(), { acquisitionMode: 'raw' });
export const constructed = DiBag.fromClass<Dependencies, typeof Client, 'raw'>([clock], Client, { acquisitionMode: 'raw' });
export const plugin = DiBag.fromPlugin<Dependencies, { run(): void }, 'raw'>([clock], { apiVersion: 1, create: () => ({ run() {} }) }, { acquisitionMode: 'raw', validate: (value): value is { run(): void } => typeof value === 'object' && value !== null });
export const unresolved = DiBag.fromFactory<() => never, AcquisitionMode>(() => { throw new Error('never'); });
```

Its `expected.ts` is:

```ts
import { DiBag } from 'di-bag';
import type { FactoryReturnKind } from 'di-bag';

const clock = DiBag.createToken(Symbol('clock')).forService<{ now(): number }>();
type Dependencies = readonly [typeof clock];
type ReadClock = (clock: { now(): number }) => number;
class Client { constructor(readonly clock: { now(): number }) {} }

export const factory = DiBag.createProvider<() => number, 'uninspected'>(() => 1, { factoryReturnKind: 'uninspected' });
export const union = DiBag.createProvider<() => Promise<number>, 'uninspected' | 'native-promise'>(() => Promise.resolve(1), { factoryReturnKind: 'uninspected' });
export const positional = DiBag.createProviderFromFunction<Dependencies, ReadClock, 'uninspected'>({ dependencies: [clock], factoryFunction: value => value.now(), factoryReturnKind: 'uninspected' });
export const constructed = DiBag.createProviderFromClass<Dependencies, typeof Client, 'uninspected'>({ dependencies: [clock], serviceClass: Client, factoryReturnKind: 'uninspected' });
export const plugin = DiBag.createProviderFromPlugin<Dependencies, { run(): void }, 'uninspected'>({ dependencies: [clock], pluginDescriptor: { apiVersion: 1, create: () => ({ run() {} }) }, factoryReturnKind: 'uninspected', isValidPluginOutput: (value): value is { run(): void } => typeof value === 'object' && value !== null });
export const unresolved = DiBag.createProvider<() => never, FactoryReturnKind>(() => { throw new Error('never'); });
```

Its `expected-manual.json` is:

```json
[
  { "line": 14, "reason": "fromFactory has a nonliteral or unsupported explicit return-kind type argument 1; rewrite it by hand" }
]
```

The transform scopes this rewrite to checker-resolved provider-source calls, so identical literal type arguments on unrelated generic functions remain untouched. Literal and literal-union return kinds map in place while all preceding explicit arguments remain byte-for-byte; a nonliteral return-kind argument is preserved, participates in the ordinary `AcquisitionMode` type rename, and emits the exact manual row.

Create `tools/codemod/test/fixtures/provider-token-classification/input.ts`:

The two `input.ts` files below model original 0.4.0 and must retain `resolveAll`/`inspectAll`. If final Phase 4 evidence records the S5 fallback, change only the two printed expected collection reads (`bag.resolve(collection)` and `bag.resolve(importedList)`) to `resolveCollection`. Keep the imported expected inspection as `serviceSnapshot`: plan 07 preserves the direct original `inspectAll -> serviceSnapshot` mapping.

```ts
import { DiBag } from 'di-bag';

export const single = DiBag.token(Symbol('single')).of<number>();
export const collection = DiBag.token(Symbol('collection')).of<number>();
export const mixed = DiBag.token(Symbol('mixed')).of<number>();
export const aliasOnly = DiBag.token(Symbol('alias-only')).of<number>();

const builder = DiBag.createBuilder()
  .register(single, () => 1)
  .contribute(collection, () => 2)
  .register(mixed, () => 3)
  .contribute(mixed, () => 4)
  .contribute(DiBag.token(Symbol('inline')).of<number>(), () => 5)
  .register({ total: DiBag.fromFunction([DiBag.all(collection)], values => values.length) });
export const bag = builder.build();
export const values = bag.resolveAll(collection);
```

Its `expected.ts` is:

```ts
import { DiBag } from 'di-bag';

export const single = DiBag.createToken(Symbol('single')).forService<number>();
export const collection = DiBag.createToken(Symbol('collection')).forCollectionOf<number>();
export const mixed = DiBag.createToken(Symbol('mixed')).of<number>();
export const aliasOnly = DiBag.createToken(Symbol('alias-only')).forCollectionOf<number>();

const builder = DiBag.createBuilder()
  .withTokenService(single, () => 1)
  .withCollectionContribution({ collectionToken: collection, provider: () => 2 })
  .withTokenService(mixed, () => 3)
  .withCollectionContribution({ collectionToken: mixed, provider: () => 4 })
  .withCollectionContribution({ collectionToken: DiBag.createToken(Symbol('inline')).of<number>(), provider: () => 5 })
  .withServices({ total: DiBag.createProviderFromFunction({ dependencies: [collection], factoryFunction: values => values.length }) });
export const bag = builder.buildContainer();
export const values = bag.resolve(collection);
```

Its `expected-manual.json` is:

```json
[
  { "line": 5, "reason": "mixed is used as a collection and as a single service (provider-token-classification/input.ts:11); create a second token with forCollectionOf and keep the single token with forService" },
  { "line": 13, "reason": "token creation is not bound to a traceable program variable; choose forService or forCollectionOf by hand" }
]
```

Create `tools/codemod/test/fixtures/provider-token-classification-import/input.ts`:

```ts
import { aliasOnly as importedList, bag } from '../provider-token-classification/input.js';
export const imported = bag.resolveAll(importedList);
export const described = bag.inspectAll(importedList);
```

Its `expected.ts` is:

```ts
import { aliasOnly as importedList, bag } from '../provider-token-classification/input.js';
export const imported = bag.resolve(importedList);
export const described = bag.serviceSnapshot(importedList);
```

Its `expected-manual.json` is `[]`. Run both fixture files in one original program. In the inherited `collection-tokens.mjs` analysis, preserve the accepted correction that visits every identifier and resolves its symbol; do not restore the `names.has(node.text)` prefilter, which misses aliases whose collection uses exist only under the imported name. Preserve the accumulated `inspectAll -> serviceSnapshot` target and pass `program: built` from the phase-1 codemod driver. `nameOf` is not transitive.

- [ ] **Step 2: Create the exact fixture input**

Create `tools/codemod/test/fixtures/provider-sources/input.ts`:

```ts
import { DiBag } from 'di-bag';
import type { AcquisitionContext, AcquisitionMode, CompositionArguments, CompositionFunction, PluginAcquisitionMode, PluginOptions, PluginProviderFactory } from 'di-bag';

const clockSymbol = Symbol('clock');
const clock = DiBag.token(clockSymbol).of<{ now(): number }>();
const items = DiBag.token(Symbol('items')).forCollectionOf<number>();
const query = DiBag.fromFactory(() => ({ then() {} }), { acquisitionMode: 'raw' });
const automatic = DiBag.fromFactory(() => 1, { acquisitionMode: 'auto', context: 'acquisition' });
const sync = DiBag.fromSyncFactory((_dependencies: {}, context) => context.signal.aborted, { context: 'acquisition' });
const asyncValue = DiBag.fromAsyncFactory(async () => 1);
const positional = DiBag.fromFunction([clock], value => Promise.resolve(value.now()), { acquisitionMode: 'nativePromise' });
const constructed = DiBag.fromClass([clock], class Service { constructor(readonly clock: { now(): number }) {} });
const plugin = DiBag.fromPlugin([clock], { apiVersion: 1, create: () => ({ run() {} }) }, {
  acquisitionMode: 'raw',
  validate: (value): value is { run(): void } => typeof value === 'object' && value !== null,
});

const shared = { acquisitionMode: 'raw' as const };
const manualFactory = DiBag.fromFactory(() => 2, shared);
const manualFunction = DiBag.fromFunction([clock], value => value.now(), shared);
const spread = DiBag.fromPlugin([clock], {}, { ...shared, validate: (value): value is number => typeof value === 'number' });
export const snapshot = DiBag.createBuilder().register({ query }).build().inspect('query').acquisitionMode;
export type Names = [AcquisitionContext, AcquisitionMode, CompositionArguments<[], []>, CompositionFunction<[]>, PluginAcquisitionMode, PluginOptions<'raw', number>, PluginProviderFactory];
export type GenericOptions<ReturnKind extends PluginAcquisitionMode> = PluginOptions<ReturnKind, number>;
void [items, automatic, sync, asyncValue, positional, constructed, plugin, manualFactory, manualFunction, spread];
```

- [ ] **Step 3: Create exact golden output and manual items**

For adopted S4, `expected.ts` is:

```ts
import { DiBag } from 'di-bag';
import type { FactoryContext, FactoryReturnKind, PositionalFactoryArguments, PositionalFactoryFunction, PluginReturnKind, CreateProviderFromPluginOptions, CreateProviderFromPlugin } from 'di-bag';

const clockSymbol = Symbol('clock');
const clock = DiBag.createToken(clockSymbol).forService<{ now(): number }>();
const items = DiBag.createToken(Symbol('items')).forCollectionOf<number>();
const query = DiBag.createProvider(() => ({ then() {} }), { factoryReturnKind: 'uninspected' });
const automatic = DiBag.createProvider(() => 1, { factoryReturnKind: 'auto-detect', factoryReceivesContext: true });
const sync = DiBag.createProvider((_dependencies: {}, context) => context.abortSignal.aborted, { factoryReturnKind: 'sync-value', factoryReceivesContext: true });
const asyncValue = DiBag.createProvider(async () => 1, { factoryReturnKind: 'native-promise' });
const positional = DiBag.createProviderFromFunction({ dependencies: [clock], factoryFunction: value => Promise.resolve(value.now()), factoryReturnKind: 'native-promise' });
const constructed = DiBag.createProviderFromClass({ dependencies: [clock], serviceClass: class Service { constructor(readonly clock: { now(): number }) {} } });
const plugin = DiBag.createProviderFromPlugin({ dependencies: [clock], pluginDescriptor: { apiVersion: 1, create: () => ({ run() {} }) }, factoryReturnKind: 'uninspected', isValidPluginOutput: (value): value is { run(): void } => typeof value === 'object' && value !== null });

const shared = { acquisitionMode: 'raw' as const };
const manualFactory = DiBag.fromFactory(() => 2, shared);
const manualFunction = DiBag.fromFunction([clock], value => value.now(), shared);
const spread = DiBag.fromPlugin([clock], {}, { ...shared, validate: (value): value is number => typeof value === 'number' });
export const snapshot = DiBag.createBuilder().withServices({ query }).buildContainer().serviceSnapshot('query').factoryReturnKind;
export type Names = [FactoryContext, FactoryReturnKind, PositionalFactoryArguments<[], []>, PositionalFactoryFunction<[]>, PluginReturnKind, CreateProviderFromPluginOptions<'uninspected', number>, CreateProviderFromPlugin];
export type GenericOptions<ReturnKind extends PluginReturnKind> = CreateProviderFromPluginOptions<ReturnKind, number>;
void [items, automatic, sync, asyncValue, positional, constructed, plugin, manualFactory, manualFunction, spread];
```

The nonliteral generic keeps its variable argument, receives the safe type-name rename (the new dependency generic has a default), and is reported manual because the codemod cannot prove that the variable's possible old string values were migrated. `expected-manual.json` is exactly:

```json
[
  { "line": 19, "reason": "fromFactory options are not an object literal; rewrite them to createProvider options with factoryReturnKind and factoryReceivesContext by hand" },
  { "line": 20, "reason": "fromFunction options are not an object literal; rewrite them to createProviderFromFunction options with factoryReturnKind by hand" },
  { "line": 21, "reason": "fromPlugin options contain a spread; rewrite them to createProviderFromPlugin with explicit factoryReturnKind and isValidPluginOutput by hand" },
  { "line": 24, "reason": "PluginOptions has a nonliteral or unsupported generic argument 0; rewrite it to CreateProviderFromPluginOptions by hand" }
]
```

If S4 falls back, change only the two positional golden calls to `createProviderFromFunction([clock], value => Promise.resolve(value.now()), { factoryReturnKind: 'native-promise' })` and `createProviderFromClass([clock], class Service { constructor(readonly clock: { now(): number }) {} })`; all other output and manual items stay exact.

- [ ] **Step 4: Implement the complete custom transform**

Create `tools/codemod/lib/transforms/provider-sources.mjs`:

```js
const returnKind = value => ({
  auto: 'auto-detect', raw: 'uninspected', nativePromise: 'native-promise',
})[value];

const modeTypeArgument = { fromFactory: 1, fromFunction: 2, fromClass: 2, fromPlugin: 2 };

function explicitKindReplacements(call, api) {
  const index = modeTypeArgument[api.member.name];
  const argument = index === undefined ? undefined : call.typeArguments?.[index];
  if (argument === undefined) return [];
  const replacements = [];
  const visit = node => {
    if (api.ts.isLiteralTypeNode(node) && (api.ts.isStringLiteral(node.literal) || api.ts.isNoSubstitutionTemplateLiteral(node.literal))) {
      const mapped = returnKind(node.literal.text);
      if (mapped === undefined) return false;
      const original = api.text(node.literal);
      const delimiter = original[0] === '"' ? '"' : original[0] === '`' ? '`' : "'";
      replacements.push({ start: api.start(node.literal), end: node.literal.end, text: `${delimiter}${mapped}${delimiter}` });
      return true;
    }
    return api.ts.isUnionTypeNode(node) && node.types.every(visit);
  };
  if (!visit(argument)) {
    api.manual(argument, `${api.member.name} has a nonliteral or unsupported explicit return-kind type argument ${index}; rewrite it by hand`);
    return [];
  }
  return [{ start: api.start(argument), end: argument.end, text: api.assemble(argument, replacements) }];
}

function literalProperties(literal, api, operation) {
  const values = new Map();
  for (const property of literal.properties) {
    if (api.ts.isSpreadAssignment(property)) {
      api.manual(operation, `${api.member.name} options contain a spread; rewrite them to ${api.nameOf('DiBagApi', api.member.name)} with explicit factoryReturnKind${api.member.name === 'fromPlugin' ? ' and isValidPluginOutput' : ''} by hand`);
      return undefined;
    }
    if (!api.ts.isPropertyAssignment(property) && !api.ts.isShorthandPropertyAssignment(property)) {
      api.manual(operation, `${api.member.name} options contain a computed or accessor property; rewrite them by hand`);
      return undefined;
    }
    const name = property.name && (api.ts.isIdentifier(property.name) || api.ts.isStringLiteral(property.name)) ? property.name.text : undefined;
    if (name === undefined) {
      api.manual(operation, `${api.member.name} options contain a computed property; rewrite them by hand`);
      return undefined;
    }
    values.set(name, api.ts.isShorthandPropertyAssignment(property) ? api.text(property.name) : api.text(property.initializer));
  }
  return values;
}

function optionFields(call, api, index) {
  const options = call.arguments[index];
  if (options === undefined) return new Map();
  if (!api.ts.isObjectLiteralExpression(options)) {
    api.manual(options, `${api.member.name} options are not an object literal; rewrite them to ${api.nameOf('DiBagApi', api.member.name)} options with factoryReturnKind${api.member.name === 'fromFactory' ? ' and factoryReceivesContext' : ''} by hand`);
    return undefined;
  }
  return literalProperties(options, api, call);
}

function quotedKind(expression, api, operation) {
  if (expression === undefined) return { present: false };
  const node = expression.trim();
  const match = /^(?:'([^']+)'|"([^"]+)")$/.exec(node);
  const mapped = match && returnKind(match[1] ?? match[2]);
  if (mapped === undefined) {
    api.manual(operation, `${api.member.name} acquisitionMode is not a supported string literal; rewrite factoryReturnKind by hand`);
    return undefined;
  }
  return { present: true, text: `'${mapped}'` };
}

function acceptsOnly(options, names, api, operation) {
  const unexpected = [...options.keys()].find(name => !names.includes(name));
  if (unexpected === undefined) return true;
  api.manual(operation, `${api.member.name} options contain unsupported property ${unexpected}; rewrite them by hand`);
  return false;
}

function property(api, role, value) {
  return `${api.nameForRole(role)}: ${value}`;
}

function bagCall(call, api, fields, typeReplacements) {
  const callee = call.expression;
  const replacements = [
    ...typeReplacements,
    { start: api.start(callee.name), end: callee.name.end, text: api.nameOf('DiBagApi', api.member.name) },
    { start: api.start(call.arguments[0]), end: call.arguments[call.arguments.length - 1].end, text: `{ ${fields.join(', ')} }` },
  ];
  return api.assemble(call, replacements);
}

export default function providerSources(call, api) {
  const name = api.member.name;
  const args = call.arguments;
  const typeReplacements = explicitKindReplacements(call, api);
  if (args.some(api.ts.isSpreadElement)) {
    api.manual(call, `${name} is called with a spread argument; rewrite it by hand`);
    return undefined;
  }

  if (name === 'fromFactory' || name === 'fromSyncFactory' || name === 'fromAsyncFactory') {
    if (args.length < 1 || args.length > 2) {
      api.manual(call, `${name} has an unexpected argument count; rewrite it to createProvider by hand`);
      return undefined;
    }
    const options = optionFields(call, api, 1);
    if (options === undefined) return undefined;
    if (!acceptsOnly(options, name === 'fromFactory' ? ['acquisitionMode', 'context'] : ['context'], api, call)) return undefined;
    const fields = [];
    const selected = name === 'fromFactory' ? quotedKind(options.get('acquisitionMode'), api, call) : { present: true, text: name === 'fromSyncFactory' ? `'sync-value'` : `'native-promise'` };
    if (selected === undefined) return undefined;
    if (selected.present) fields.push(property(api, 'returnKind', selected.text));
    const context = options.get('context');
    if (context !== undefined) {
      if (!/^(?:'acquisition'|"acquisition")$/.test(context.trim())) {
        api.manual(call, `${name} context is not the literal 'acquisition'; rewrite factoryReceivesContext by hand`);
        return undefined;
      }
      fields.push(property(api, 'receivesContext', 'true'));
    }
    const callee = call.expression;
    const replacement = [...typeReplacements, { start: api.start(callee.name), end: callee.name.end, text: api.nameOf('DiBagApi', name) }];
    if (fields.length === 0) {
      if (args[1] !== undefined) replacement.push({ start: args[0].end, end: args[1].end, text: '' });
      return api.assemble(call, replacement);
    }
    if (args[1] === undefined) replacement.push({ start: args[0].end, end: args[0].end, text: `, { ${fields.join(', ')} }` });
    else replacement.push({ start: api.start(args[1]), end: args[1].end, text: `{ ${fields.join(', ')} }` });
    return api.assemble(call, replacement);
  }

  if (name === 'fromFunction' || name === 'fromClass') {
    if (args.length < 2 || args.length > 3) {
      api.manual(call, `${name} has an unexpected argument count; rewrite it by hand`);
      return undefined;
    }
    const options = optionFields(call, api, 2);
    if (options === undefined) return undefined;
    if (!acceptsOnly(options, ['acquisitionMode'], api, call)) return undefined;
    const fields = [property(api, 'dependencies', api.text(args[0])), property(api, 'callable', api.text(args[1]))];
    const selected = quotedKind(options.get('acquisitionMode'), api, call);
    if (selected === undefined) return undefined;
    if (selected.present) fields.push(property(api, 'returnKind', selected.text));
    return bagCall(call, api, fields, typeReplacements);
  }

  if (name === 'fromPlugin') {
    if (args.length !== 3) {
      api.manual(call, 'fromPlugin has an unexpected argument count; rewrite it to createProviderFromPlugin by hand');
      return undefined;
    }
    const options = optionFields(call, api, 2);
    if (options === undefined) return undefined;
    if (!acceptsOnly(options, ['acquisitionMode', 'validate'], api, call)) return undefined;
    const selected = quotedKind(options.get('acquisitionMode'), api, call);
    if (selected === undefined) return undefined;
    const validator = options.get('validate');
    if (!selected.present || validator === undefined) {
      api.manual(call, 'fromPlugin options do not have literal acquisitionMode and validate properties; rewrite them by hand');
      return undefined;
    }
    return bagCall(call, api, [
      property(api, 'dependencies', api.text(args[0])),
      property(api, 'descriptor', api.text(args[1])),
      property(api, 'returnKind', selected.text),
      property(api, 'validator', validator),
    ], typeReplacements);
  }

  api.manual(call, `provider-sources does not recognize ${name}`);
  return undefined;
}
```

The transform emits every method with `api.nameOf('DiBagApi', name)` and every new field with `api.nameForRole`; it contains no fake declaration owner. If S4 selects the fallback, replace the **entire** `if (name === 'fromFunction' || name === 'fromClass')` block with this block:

```js
  if (name === 'fromFunction' || name === 'fromClass') {
    if (args.length < 2 || args.length > 3) {
      api.manual(call, `${name} has an unexpected argument count; rewrite it by hand`);
      return undefined;
    }
    const options = optionFields(call, api, 2);
    if (options === undefined) return undefined;
    if (!acceptsOnly(options, ['acquisitionMode'], api, call)) return undefined;
    const selected = quotedKind(options.get('acquisitionMode'), api, call);
    if (selected === undefined) return undefined;
    const trailing = selected.present
      ? `, { ${property(api, 'returnKind', selected.text)} }`
      : '';
    const callee = call.expression;
    return api.assemble(call, [
      ...typeReplacements,
      { start: api.start(callee.name), end: callee.name.end, text: api.nameOf('DiBagApi', name) },
      {
        start: api.start(args[0]),
        end: args[args.length - 1].end,
        text: `${api.text(args[0])}, ${api.text(args[1])}${trailing}`,
      },
    ]);
  }
```

This removes an old empty third options object, preserves the two positional expressions exactly, and emits the renamed trailing bag only when an old return kind exists.

Create `tools/codemod/test/fixtures/provider-sources-behavior/input.ts`:

```ts
import { DiBag } from 'di-bag';
const clock = DiBag.token(Symbol('clock')).of<{ now(): number }>();
const Configured = DiBag.withConfiguration({ runtime: { isNativePromise: value => value instanceof Promise } });
export const kept = Configured.fromFunction([clock], value => /* keep positional comment */ Promise.resolve(value.now()), { acquisitionMode: 'nativePromise' });
const shared = { acquisitionMode: 'raw' as const };
export const manual = Configured.fromFactory(() => 1, shared);
```

Its `expected.ts` is:

```ts
import { DiBag } from 'di-bag';
const clock = DiBag.createToken(Symbol('clock')).forService<{ now(): number }>();
const Configured = DiBag.withConfiguration({ runtime: { isNativePromise: value => value instanceof Promise } });
export const kept = Configured.createProviderFromFunction({ dependencies: [clock], factoryFunction: value => /* keep positional comment */ Promise.resolve(value.now()), factoryReturnKind: 'native-promise' });
const shared = { acquisitionMode: 'raw' as const };
export const manual = Configured.fromFactory(() => 1, shared);
```

Its `expected-manual.json` is:

```json
[
  { "line": 6, "reason": "fromFactory options are not an object literal; rewrite them to createProvider options with factoryReturnKind and factoryReceivesContext by hand" }
]
```

This fixture makes supported output, a preserved inline comment, a derived configured facade, and a manual nonliteral bag executable instead of relying on parser-only evidence.

- [ ] **Step 5: Register and test the transform**

Import `providerSources` and add `'provider-sources': providerSources` to `tools/codemod/lib/transforms/index.mjs`. The final registry preserves every accumulated id:

```js
export const transforms = {
  'build-and-start': buildAndStart,
  'collection-read': collectionRead,
  'collection-reference': collectionReference,
  'collection-token': collectionToken,
  'container-derivation': containerDerivation,
  'provider-sources': providerSources,
};
```

Update the pinned sorted transform-id list in `transforms.test.mjs` and `rename-map.test.mjs` to those six values. Preserve `collection-tokens.mjs` in the packed-file list even though it is a helper rather than a registry entry. Do not replace `transformApi` with a reduced object: its returned object continues to expose `ts`, `checker`, `program`, `library`, `sourceFile`, `member`, all text/assembly/manual helpers, `nameOf`, and `nameForRole`.

Add an alternate-map test proving role names, using the vendored 0.4 declarations:

```js
test('provider source transforms ask their method entries for emitted field names', () => {
  const shipped = JSON.parse(readFileSync(defaultMapFile, 'utf8'));
  const map = {
    ...shipped,
    methods: shipped.methods.map(entry => entry.owner === 'DiBagApi' && entry.from === 'fromFunction'
      ? { ...entry, to: 'adapt', transformNames: { dependencies: 'needs', callable: 'make', returnKind: 'policy', receivesContext: 'takesContext' } }
      : entry),
  };
  const result = runCodemod({ typescript: compiler.ts, root: fixturesRoot, program: fixturesProgram(), only: ['provider-sources/input.ts'], map });
  assert.match(result.files[0].text, /DiBag\.adapt\(\{ needs: \[clock\], make: value => Promise\.resolve\(value\.now\(\)\), policy: 'native-promise' \}\)/);
});
```

Run:

```bash
node --test tools/codemod/test/fixtures.test.mjs tools/codemod/test/transforms.test.mjs tools/codemod/test/rename-map.test.mjs
```

Expected: all tests pass, byte-for-byte golden output matches, and the manual list deep-equals the four literal `{ line, reason }` objects.

- [ ] **Step 6: Commit the accumulated codemod implementation**

After the three codemod test files and every exact fixture pass, commit only map/schema/engine/transform/fixture changes:

```bash
git add tools/codemod
git commit -m "feat(codemod): migrate provider source APIs" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL"
```

The repository remains green because the expand commit still exposes compatibility declarations.

---

### Task 4: Migrate repository call sites, generators, tools, and checked agent material

**Files:**
- Modify: all codemod-selected TypeScript call sites under `tests`, `examples`, `scripts/agent-eval`, and `tools/graph/test/fixtures`
- Modify by hand: `tests/benchmarks/runtime-scenarios.ts`, `scripts/runtime-benchmark-child.ts`, `tests/runtime-benchmark-child.test.ts`
- Modify: `tests/compiler.ts`, `scripts/benchmark-types.ts`, `scripts/check-token-scale.ts`, other generated-source builders reported by the audit
- Create: `scripts/check-generated-provider-names.mjs`
- Inspect: `tools/graph/lib/extract.mjs`
- Create: `tools/graph/test/provider-sources.test.mjs`, `tools/graph/test/fixtures/provider-sources-0-4.ts`, `tools/graph/test/fixtures/provider-sources-0-5.ts`
- Modify: `tools/graph/README.md`
- Modify: `AGENTS.md`, `docs/agent/errors.md`, `docs/agent/recipes.md`, `tools/docs/api-card-tasks.json`, `tools/docs/test/api-card.test.mjs`, `tools/docs/test/exact-rendering.test.mjs`, `tools/docs/api-card-summary-exceptions.json`

**Interfaces:**
- Consumes: Tasks 1–3's adopted or fallback call shape and accumulated one-pass codemod.
- Produces: no checked repository consumer of the old provider-source/type/token names; generators emit only the final API; graph extraction accepts 0.4 and 0.5 input; checked docs teach one final call per task.

- [ ] **Step 1: Build once and run the codemod once**

```bash
npm run build
node tools/codemod/cli.mjs \
  --project tsconfig.json \
  --library-root src \
  --library-root dist \
  --extra-files 'tests/types/negative/*.ts' \
  --write \
  --report /tmp/phase-08-codemod-report.json
node -e "const r=require('/tmp/phase-08-codemod-report.json'); console.log(r.files.length, r.manual.length); for (const item of r.manual) console.log(item.file+':'+item.line, item.reason)"
```

Expected: exit 0; every decidable call is rewritten once. Manual items are limited to nonliteral/spread option bags, explicit receiver values typed `any`, arbitrary strings, and genuinely indirect cases. Record each item now, but resolve it at its construction site only after the mechanical commit below. Do not rerun the codemod.

Before resolving manual items or editing strings/Markdown, obtain authorization for and run `npm run check`; compatibility declarations make this mechanical state green. Stage exactly the files listed by the codemod report and give the mechanical rewrite its master-required own commit:

```bash
node -e "const r=require('/tmp/phase-08-codemod-report.json'); process.stdout.write(r.files.map(f => typeof f === 'string' ? f : f.file).join('\0')+'\0')" | xargs -0 git add --
git commit -F - <<'MSG'
refactor(provider): apply provider source codemod

Mechanical rewrite command:
node tools/codemod/cli.mjs --project tsconfig.json --library-root src --library-root dist --extra-files 'tests/types/negative/*.ts' --write --report /tmp/phase-08-codemod-report.json

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

Verify `git show --stat --oneline HEAD` contains only report-listed mechanical files. Manual reports, generated-source strings, graph fixtures, and docs belong to the next commit.

The runtime benchmark scenario is a deliberate two-version adapter, so it is not an old-name cleanup target. Do not resolve a codemod/manual/audit row by rewriting its pinned-739b509 branch. Extend the lane-selected adapter by hand: the `current` branch creates providers with `createProvider` and maps `raw` to `uninspected` and `nativePromise` to `native-promise`; the `baseline` branch retains `factory(create, { acquisition: 'raw' | 'native' })`, the actual version-0.1.0 API of commit `739b509`. Keep provider construction outside the measured interval exactly where it is now, keep one provider factory per binding, and make no capability probe. At this phase the existing disposal/lifetime wrapper bridge may remain behind the adapter until plan 10 migrates only its current branch. Run the focused current and exact pinned-`739b509` archive child smokes, including `raw-promise-identity` and `node-native-promise`, and validate the existing factory/disposer counts and identities. Record the exact baseline-branch rows in the old-name allowlist rather than weakening the repository-wide audit.

- [ ] **Step 2: Migrate generated TypeScript strings explicitly**

In `tests/compiler.ts`, `scripts/benchmark-types.ts`, `scripts/check-token-scale.ts`, and every `rg` hit that constructs TypeScript source as a string, apply this exact mapping to the generated program:

| Original emitted text | Final emitted text |
| --- | --- |
| `DiBag.fromFactory(f)` | `DiBag.createProvider(f)` |
| `DiBag.fromFactory(f, { acquisitionMode: 'raw' })` | `DiBag.createProvider(f, { factoryReturnKind: 'uninspected' })` |
| `DiBag.fromSyncFactory(f)` | `DiBag.createProvider(f, { factoryReturnKind: 'sync-value' })` |
| `DiBag.fromAsyncFactory(f)` | `DiBag.createProvider(f, { factoryReturnKind: 'native-promise' })` |
| `DiBag.fromFunction(tokens, f)` | adopted: `DiBag.createProviderFromFunction({ dependencies: tokens, factoryFunction: f })`; fallback: `DiBag.createProviderFromFunction(tokens, f)` |
| `DiBag.fromClass(tokens, C)` | adopted: `DiBag.createProviderFromClass({ dependencies: tokens, serviceClass: C })`; fallback: `DiBag.createProviderFromClass(tokens, C)` |
| `DiBag.token(s).of<T>()` | `DiBag.createToken(s).forService<T>()` |
| `DiBag.token(s).forCollectionOf<T>()` | `DiBag.createToken(s).forCollectionOf<T>()` |
| `DiBag.fromFactory(f, { context: 'acquisition', acquisitionMode: m })` | `DiBag.createProvider(f, { factoryReceivesContext: true, factoryReturnKind: <mapped m> })` |
| `DiBag.fromPlugin(d, p, { acquisitionMode: 'raw', validate: v })` | `DiBag.createProviderFromPlugin({ dependencies: d, pluginDescriptor: p, factoryReturnKind: 'uninspected', isValidPluginOutput: v })` |
| `DiBag.fromPlugin(d, p, { acquisitionMode: 'nativePromise', validate: v })` | `DiBag.createProviderFromPlugin({ dependencies: d, pluginDescriptor: p, factoryReturnKind: 'native-promise', isValidPluginOutput: v })` |
| `context.signal` where `context` is the factory context | `context.abortSignal` |
| `AcquisitionMode` / `AcquisitionContext` | `FactoryReturnKind` / `FactoryContext` |

The `<mapped m>` values are exactly `auto -> auto-detect`, `raw -> uninspected`, and `nativePromise -> native-promise`; a nonliteral `m` is a manual item and must be repaired where it is constructed. Do not change benchmark operation counts, graph widths, tuple widths, registration order, or zero-dependency fast paths.

Create this syntax-aware generated-string audit so template/string contents cannot hide old names:

```js
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const retired = /\b(?:fromFactory|fromSyncFactory|fromAsyncFactory|fromFunction|fromClass|fromPlugin|AcquisitionMode|AcquisitionContext|nativePromise|modeOptions)\b|\.token\s*\(|\.of\s*</;
let findings = 0;
for (const file of process.argv.slice(2)) {
  const source = readFileSync(file, 'utf8');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = node => {
    if ((ts.isStringLiteralLike(node) || ts.isTemplateLiteralToken(node)) && retired.test(node.text)) {
      const { line, character } = tree.getLineAndCharacterOfPosition(node.getStart(tree));
      console.error(`${file}:${line + 1}:${character + 1}: generated source retains ${node.text.match(retired)?.[0]}`);
      findings++;
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
}
if (findings) process.exitCode = 1;
```

Before edits, capture the exact syntax-aware inventory and line count; after applying the table, require the same generated worker/case counts and zero findings:

```bash
rg -l "fromFactory|fromSyncFactory|fromAsyncFactory|fromFunction|fromClass|fromPlugin|AcquisitionMode|AcquisitionContext|nativePromise|modeOptions|\.token\(|\.of<" tests/compiler.ts scripts --glob '*.ts' --glob '*.tsx' --glob '*.mjs' > /tmp/phase-08-generated-files.txt
xargs node scripts/check-generated-provider-names.mjs < /tmp/phase-08-generated-files.txt > /tmp/phase-08-generated-before.txt 2>&1 || true
wc -l /tmp/phase-08-generated-before.txt
xargs node scripts/check-generated-provider-names.mjs < /tmp/phase-08-generated-files.txt
```

The last command exits 0 with no output. Compare each worker's exported case count, loop bound, and dependency-width constant in the diff; any numeric change is rejected.

After editing, also run:

```bash
rg -n "fromFactory|fromSyncFactory|fromAsyncFactory|fromFunction|fromClass|fromPlugin|\.token\(|\.of<|acquisitionMode|nativePromise" tests/compiler.ts scripts --glob '*.ts' --glob '*.mjs'
```

Expected: only deliberate 0.4 fixture/input strings, codemod tests, and phase-later `transformService` key occurrences remain. Every allowed hit is enumerated in `/tmp/phase-08-old-string-allowlist.txt` as `path:line:reason`; compare with `comm -3` after sorting so a new hit fails the audit.

- [ ] **Step 3: Keep graph extraction bilingual**

Create `tools/graph/test/fixtures/provider-sources-0-4.ts`:

```ts
import { DiBag } from './provider-sources-0-4-library.js';
const clock = DiBag.token(Symbol('clock')).of<{ now(): number }>();
export const app = DiBag.createBuilder()
  .register(clock, () => ({ now: () => 1 }))
  .register({
    config: () => ({ prefix: 'v' }),
    stamp: DiBag.fromFunction([clock], async value => value.now()),
    client: DiBag.fromClass([clock], class Client { constructor(readonly clock: { now(): number }) {} }),
    db: DiBag.fromFactory(async ({ config }: { config: { prefix: string } }) => config.prefix),
  })
  .build();
```

Create the vendored original declaration context `tools/graph/test/fixtures/provider-sources-0-4-library.d.ts`:

```ts
export interface Provider<Factory> { readonly __factory?: Factory }
export interface Token<Service> { readonly key: symbol; readonly __service?: Service }
interface Builder {
  register(token: Token<unknown>, provider: () => unknown): Builder;
  register(providers: Record<string, ((dependencies: never) => unknown) | Provider<(dependencies: never) => unknown>>): Builder;
  build(): unknown;
}
export const DiBag: {
  token(symbol: symbol): { of<Service>(): Token<Service> };
  createBuilder(): Builder;
  fromFactory<Factory extends (dependencies: never) => unknown>(factory: Factory): Provider<Factory>;
  fromFunction<Service, Output>(tokens: readonly [Token<Service>], factory: (value: Service) => Output): Provider<() => Output>;
  fromClass<Service, Instance>(tokens: readonly [Token<Service>], serviceClass: new (value: Service) => Instance): Provider<() => Instance>;
};
```

Create `tools/graph/test/fixtures/provider-sources-0-5.ts` using the phase-5 builder names and adopted S4:

```ts
import { DiBag } from 'di-bag';
const clock = DiBag.createToken(Symbol('clock')).forService<{ now(): number }>();
export const app = DiBag.createBuilder()
  .withTokenService(clock, () => ({ now: () => 1 }))
  .withServices({
    config: () => ({ prefix: 'v' }),
    stamp: DiBag.createProviderFromFunction({ dependencies: [clock], factoryFunction: async value => value.now() }),
    client: DiBag.createProviderFromClass({ dependencies: [clock], serviceClass: class Client { constructor(readonly clock: { now(): number }) {} } }),
    db: DiBag.createProvider(async ({ config }: { config: { prefix: string } }) => config.prefix),
  })
  .buildContainer();
```

Under S4 fallback, use its positional function/class calls in the 0.5 fixture. Add `tools/graph/test/provider-sources.test.mjs`:

```js
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { extractDependencyGraph } from '../lib/extract.mjs';

for (const version of ['0-4', '0-5']) test(`extracts provider-source wrappers from ${version}`, () => {
  const file = resolve(import.meta.dirname, `fixtures/provider-sources-${version}.ts`);
  const graph = extractDependencyGraph({ root: resolve(import.meta.dirname, 'fixtures'), files: [file] });
  assert.equal(graph.units.length, 1);
  const [unit] = graph.units;
  assert.equal(unit.kind, 'bag');
  assert.equal(unit.file, `provider-sources-${version}.ts`);
  assert.match(unit.id, new RegExp(`^provider-sources-${version}\\.ts:[0-9]+$`));
  assert.deepEqual(unit.nodes.map(node => node.key), ['clock', 'config', 'stamp', 'client', 'db']);
  assert.equal(unit.nodes.find(node => node.key === 'stamp').async, true);
  assert.equal(unit.nodes.find(node => node.key === 'client').async, false);
  assert.deepEqual(unit.nodes.find(node => node.key === 'db').dependencies, ['config']);
  assert.equal(unit.nodes.find(node => node.key === 'db').async, true);
});
```

Phase-5 graph extraction is expected to understand both builder generations. `describeFactory` obtains provider output from the first `Provider` type argument, so positional token edges remain outside the graph package's named-dependency edge model in both generations. Do not invent string labels for symbol dependencies. Inspect `lib/extract.mjs` first and edit it only if this focused test fails because final provider wrappers are not resolved; record that concrete failure and the minimal repair. Update `tools/graph/README.md` examples to the final names.

Run:

```bash
node --test tools/graph/test/provider-sources.test.mjs tools/graph/test/extract.test.mjs
```

Expected: all pass and both fixtures yield the same five nodes, async flags, named `db -> config` dependency, and real unit identity. Only after this focused proof passes may the report state that no extractor implementation edit was needed.

- [ ] **Step 4: Migrate examples and agent-eval projects**

Migrate every `examples/*.ts`, `examples/react/*.ts*`, `scripts/agent-eval/reference/**`, and `scripts/agent-eval/skeleton/**` hit. Preserve dependency contracts and awaiting exactly:

```ts
const settings = DiBag.createProviderFromFunction({
  dependencies: [configToken],
  factoryReceivesContext: true,
  factoryFunction: async (config, factoryContext) =>
    fetchSettings(config.url, { signal: factoryContext.abortSignal }),
});

const reporter = DiBag.createProviderFromClass({
  dependencies: [DiBag.lazy(portToken), DiBag.optional(hostToken)],
  serviceClass: Reporter,
});
```

Use the S4 positional fallback if selected. Keep async services declared as `Promise<Service>` dependencies; `native-promise` does not auto-await dependency injection. Run each changed example with pinned Bun and `npm run agent-eval:test`; expected: all pass.

- [ ] **Step 5: Replace the shipped agent rules without adding lines**

In AGENTS rule 1, keep the phase-6 removal of `di-bag/node`, the portable-recipe link, and the classifier-required link. Replace only the old `fromSyncFactory` / `fromAsyncFactory` recommendation with:

```md
   For browsers and workers register synchronous factories with
   `DiBag.createProvider(factory, { factoryReturnKind: 'sync-value' })`; use
   `'native-promise'` for a factory that returns a native Promise.
```

Reword the following clause from “a plain factory” to “an auto-detect factory”; it still says that `buildContainer()` raises `DI_BAG_CLASSIFIER_REQUIRED` and names the registration.

Replace rule 5's second sentence with:

```md
   Return `Promise.resolve(builder)` or use `DiBag.createProvider(create, { factoryReturnKind: 'uninspected' })`.
```

In rule 6, rename `factoryCtx` to `factoryContext` and `factoryCtx.signal` to `factoryContext.abortSignal` without adding a line. Rules 4 and the opening import stay. Verify:

```bash
wc -l AGENTS.md
```

Expected: `150` or fewer.

- [ ] **Step 6: Rewrite the checked recipes and error families**

In `docs/agent/recipes.md`, replace the portable-factory explanation with:

```md
`factoryReturnKind: 'sync-value'` makes the exact synchronous value the service,
never reads `then`, and rejects Promise and structural-thenable outputs at compile
time. `'native-promise'` requires a native Promise, exposes that Promise, and gives
its fulfilled value to disposal callbacks. `'uninspected'` preserves the exact
returned value, including a Promise or structural thenable. Omit the option for
`'auto-detect'` on hosts with a native-Promise classifier.
```

Follow it with this complete checked example:

```ts
const config = DiBag.createProvider((): Config => ({ url: 'memory:' }), { factoryReturnKind: 'sync-value' });
const catalog = DiBag.createProvider(async ({ config }: { config: Config }) => openCatalog(config.url), {
  factoryReturnKind: 'native-promise',
});
const query = DiBag.createProvider(() => knex('users'), { factoryReturnKind: 'uninspected' });
const app = DiBag.createBuilder().withServices({ config, catalog, query }).buildContainer();
```

Retain the five fenced facade examples added before Task 2's expand docs generation. Do not replace them with inline-backtick `@example` text: `tools/docs/lib/api-card.mjs` and `jsDocExamples` extract only fenced `ts` or `typescript` blocks.

Update all recipe code to `createProvider`; use `factoryContext.abortSignal`. In `docs/agent/errors.md` update the existing sections, codes unchanged:

```text
structural-thenable:
factory output is a structural thenable; return a native Promise or select factoryReturnKind 'uninspected' or 'native-promise'

portable-factory-output:
sync-value output must not be a Promise or thenable; use factoryReturnKind 'native-promise' for a Promise, or 'uninspected' to make the Promise object the service
native-promise factory return kind requires a Promise output; use 'sync-value' for a synchronous value

classifier-required fix:
use DiBag.createProvider(factory, { factoryReturnKind: 'sync-value' }) or { factoryReturnKind: 'native-promise' }, or configure isNativePromise
```

Rename method references in existing invalid-factory/function/constructor/plugin/token sections. New option-bag malformations raised by this phase point to the existing `DI_BAG_INVALID_ARGUMENT` section. Retain old runtime codes and anchors. Do not touch closing/closed or singleton-capture families.

- [ ] **Step 7: Merge the two portable API-card tasks**

In `tools/docs/api-card-tasks.json`, delete both old portable rows and insert one row in their position:

```json
{ "task": "Register a portable factory", "call": "DiBag.createProvider" }
```

Retain every row added by phases 3–7; do not replace the whole file from the 0.4 archive. During expand, update `tools/docs/test/api-card.test.mjs` to require both API generations: the five new calls and the seven compatibility calls still deliberately rendered until Task 5. Replace that presence test with final-name/legacy-absence assertions only at the contract boundary. Pin the five call titles in the rendered card and pin interface members from their actual generated reference pages:

```text
DiBag.createProvider(factory, options)
DiBag.createProviderFromFunction(options)
DiBag.createProviderFromClass(options)
DiBag.createProviderFromPlugin(options)
DiBag.createToken(symbol)
readonly factoryReturnKind:
readonly abortSignal:
```

Add this complete expand assertion to `api-card.test.mjs`; it uses that file's existing in-memory TypeDoc `project` and `tasks`, so it does not invent a repository-root binding:

```js
test('provider-source API card renders the expand and compatibility calls', () => {
  const card = renderApiCard(project, tasks);
  for (const name of ['DiBag.createProvider', 'DiBag.createProviderFromFunction', 'DiBag.createProviderFromClass', 'DiBag.createProviderFromPlugin', 'DiBag.createToken']) {
    assert.match(card, new RegExp(name.replace('.', '\\.')));
  }
  for (const name of ['DiBag.fromFactory', 'DiBag.fromSyncFactory', 'DiBag.fromAsyncFactory', 'DiBag.fromFunction', 'DiBag.fromClass', 'DiBag.fromPlugin', 'DiBag.token']) {
    assert.match(card, new RegExp(name.replace('.', '\\.')));
  }
  for (const title of [
    'DiBag.createProvider(factory, options)',
    'DiBag.createProviderFromFunction(options)',
    'DiBag.createProviderFromClass(options)',
    'DiBag.createProviderFromPlugin(options)',
    'DiBag.createToken(symbol)',
  ]) assert.ok(card.includes(`### \`${title}\``), `missing call title: ${title}`);
});
```

In `exact-rendering.test.mjs`, add `let factoryContext; let bindingSnapshot;` beside its existing generated-page variables, then assign these inside the existing generation `try` block:

```js
factoryContext = readFileSync(join(output, 'index/interfaces/FactoryContext.md'), 'utf8');
bindingSnapshot = readFileSync(join(output, 'index/interfaces/BindingSnapshot.md'), 'utf8');
```

Append this test. It reuses the file's existing `facade`, `compact`, and generated-page variables; do not read the API card or refer to nonexistent `root`:

```js
test('provider-source reference pages render final members', () => {
  const facadeText = compact(facade);
  for (const text of ['createProvider:', 'createProviderFromFunction:', 'createProviderFromClass:', 'createProviderFromPlugin:', 'createToken:']) {
    assert.ok(facadeText.includes(text), `missing facade rendering: ${text}`);
  }
  assert.match(compact(bindingSnapshot), /readonly factoryReturnKind: FactoryReturnKind;/);
  assert.match(compact(factoryContext), /readonly abortSignal: AbortSignal;/);
});
```

Under S4 fallback, pin the two positional signatures instead. Remove old portable-task ids from `api-card-summary-exceptions.json`; preserve all unrelated rows.

Regenerate the expand card after changing the task table and tests:

```bash
npm run docs:generate
node --test tools/docs/test/api-card.test.mjs tools/docs/test/exact-rendering.test.mjs
```

Expected: both commands exit 0; the task table links the new `createProvider` call, while the runtime-call sections still include fenced examples for both the final and compatibility members. Task 5 performs the second regeneration after deleting compatibility declarations.

- [ ] **Step 8: Audit migration before contract**

```bash
rg -n "\b(fromFactory|fromSyncFactory|fromAsyncFactory|fromFunction|fromClass|fromPlugin)\b|\b(AcquisitionMode|AcquisitionContext|CompositionArguments|CompositionFunction|PluginAcquisitionMode|PluginOptions|PluginProviderFactory)\b|\.token\(|\.of<|\.key\b|\bacquisitionMode\b|\bnativePromise\b|\bmodeOptions\b" \
  tests examples scripts tools/graph AGENTS.md docs/agent \
  --glob '!tools/codemod/test/fixtures/**' \
  --glob '!docs/agent/api-card.md' \
  --glob '!tests/types/negative/api-renaming.ts'
```

Expected: no output outside the deliberate negative-removal fixture and the exact pinned-739b509 branch of `tests/benchmarks/runtime-scenarios.ts`. The generated API card is excluded here because the expand commit still documents the compatibility members it actually exports; Task 5 removes those declarations, regenerates the card, and runs the final unexcluded retired-name audit. Record the benchmark branch by path and selected adapter; no other executable consumer is exempt.

Expected: no old source/type/token names outside the exact pinned-739b509 benchmark adapter. The only allowed `acquisitionMode` hits are `transformService`'s public option key and 0.4 codemod fixture input. The pinned baseline adapter instead retains its historical `acquisition` key and `raw`/`native` values. Current-API values use the final strings. Record every allowed hit by exact path and branch and fail on any unlisted result.

Run the focused runtime, codemod, graph, agent-eval, generated-string, and docs checks from this task. With the applicable controller hold lifted, run `npm run check` and `npm run docs:check`; both must pass while compatibility declarations still exist. Commit the resolved manual items and non-codemod surfaces:

```bash
git add tests examples scripts tools/graph AGENTS.md docs/agent tools/docs docs/reference
git commit -m "docs(provider): migrate provider source consumers" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL"
```

Do not contract compatibility declarations in this commit.

---

### Task 5: Contract the 0.4 provider-source surface and regenerate checked docs

**Files:**
- Modify: `src/acquisition-mode.ts`, `src/acquisition-context.ts`, `src/acquisition.ts`, `src/composition.ts`, `src/plugins.ts`, `src/errors.ts`, `src/tokens.ts`, `src/inspection.ts`, `src/runtime.ts`, `src/provider.ts`, `src/di-bag.ts`, `src/index.ts`
- Modify: `tests/types/negative/api-renaming.ts`, `tests/api-naming-known-violations.json`
- Modify: `tools/docs/test/api-card.test.mjs`, `tools/docs/test/exact-rendering.test.mjs`
- Regenerate: `docs/agent/api-card.md`, `docs/reference/**`
- Delete: generated reference pages for removed types and facade methods, as selected by `npm run docs:generate`

**Interfaces:**
- Consumes: fully migrated repository from Task 4.
- Produces: only the 0.5 provider-source declarations compile; checked docs and generated references contain only final names; no dead link points at a removed declaration.

- [ ] **Step 1: Add compile-time removal fixtures before deleting declarations**

Append to `tests/types/negative/api-renaming.ts`:

```ts
// diagnostic: no exported member 'AcquisitionContext'
import type { AcquisitionContext } from '../../../src';
// diagnostic: no exported member 'AcquisitionMode'
import type { AcquisitionMode } from '../../../src';
// diagnostic: no exported member 'CompositionArguments'
import type { CompositionArguments } from '../../../src';
// diagnostic: no exported member 'CompositionFunction'
import type { CompositionFunction } from '../../../src';
// diagnostic: no exported member 'PluginAcquisitionMode'
import type { PluginAcquisitionMode } from '../../../src';
// diagnostic: no exported member 'PluginOptions'
import type { PluginOptions } from '../../../src';
// diagnostic: no exported member 'PluginProviderFactory'
import type { PluginProviderFactory } from '../../../src';

// diagnostic: Property 'fromFactory' does not exist
DiBag.fromFactory;
// diagnostic: Property 'fromSyncFactory' does not exist
DiBag.fromSyncFactory;
// diagnostic: Property 'fromAsyncFactory' does not exist
DiBag.fromAsyncFactory;
// diagnostic: Property 'fromFunction' does not exist
DiBag.fromFunction;
// diagnostic: Property 'fromClass' does not exist
DiBag.fromClass;
// diagnostic: Property 'fromPlugin' does not exist
DiBag.fromPlugin;
// diagnostic: Property 'token' does not exist
DiBag.token;

const token = DiBag.createToken(Symbol('service'));
// diagnostic: Property 'of' does not exist
token.of<number>();
const service = token.forService<number>();
// diagnostic: Property 'key' does not exist
service.key;

type RemovedContext = AcquisitionContext;
type RemovedMode = AcquisitionMode;
type RemovedArguments = CompositionArguments<[], []>;
type RemovedFunction = CompositionFunction<[]>;
type RemovedPluginMode = PluginAcquisitionMode;
type RemovedPluginOptions = PluginOptions<'raw', unknown>;
type RemovedPluginFactory = PluginProviderFactory;
```

Keep these as separate imports: each removed export needs its own diagnostic marker on the offending import line. Each removed member and facade property has its own line.

- [ ] **Step 2: Remove the old declarations and exports**

Delete `fromFactory`, `fromSyncFactory`, `fromAsyncFactory`, their portable-option aliases and validation helpers from `src/acquisition-context.ts`. Delete `fromFunction`, `fromClass`, `CompositionArguments`, and `CompositionFunction` from `src/composition.ts`. Delete `fromPlugin`, `PluginAcquisitionMode`, `PluginOptions`, and `PluginProviderFactory` from `src/plugins.ts`. Delete `token` and the `of` property from `src/tokens.ts`; `createToken` remains the only constructor and `forService`/`forCollectionOf` the only branches.

Also delete the complete expand-only compatibility layer: `AcquisitionMode`, every `Legacy*` admission/options alias, `acquisitionMode`, `normalizeLegacyMode`, and `legacyModeOf` from `src/acquisition-mode.ts`; `AcquisitionContext` and the runtime `signal` alias from `src/acquisition-context.ts` / `src/acquisition.ts`; `BindingSnapshot.acquisitionMode` and its producer from `src/inspection.ts` / `src/runtime.ts`; both token classes' public `key` properties; `ExpandReturnKind`, `NormalizedReturnKind`, `ExpandTransformOptions`, and `expandTransformReturnKind` from `src/provider.ts`. Replace the temporary dual transform overload/body with Task 1's printed final-only `FactoryReturnKind` form. Change `DiBagPluginValidationError`'s default/parameter to the final fixed `createProviderFromPlugin` operation and update its JSDoc example. These removals occur only after Task 4's old-name audit is empty outside codemod fixtures and negative removal fixtures.

Remove those facade properties/imports/values and old type exports. Search `src`:

```bash
rg -n "\b(fromFactory|fromSyncFactory|fromAsyncFactory|fromFunction|fromClass|fromPlugin)\b|\b(AcquisitionMode|AcquisitionContext|CompositionArguments|CompositionFunction|PluginAcquisitionMode|PluginOptions|PluginProviderFactory)\b|readonly token:|export function token|readonly of:" src
```

Expected: no output. `ContextualFactory`, `PluginOutputValidator`, `PluginProvider`, `optional`, and `lazy` remain public. Decorators remain facade functions until phase 9.

- [ ] **Step 3: Update the naming ratchet from actual declarations**

Before the ratchet check, contract `PluginProvider` itself: change its third constraint from `PluginReturnKind | PluginAcquisitionMode` to `PluginReturnKind`, and both conditional checks from `ReturnKind extends 'uninspected' | 'raw'` to `ReturnKind extends 'uninspected'`. The name and first two generic positions stay unchanged. Its original-input codemod fixture retains the old literals intentionally; its expected output uses only the final literals.

```bash
UPDATE_API_NAMING_VIOLATIONS=1 bun test tests/api-naming.test.ts
bun test tests/api-naming.test.ts
```

Expected: both pass. This phase removes `retired-word: export AcquisitionMode`, `retired-word: export PluginAcquisitionMode`, `retired-word: parameter modeOptions`, and `value-casing: value 'nativePromise'`, plus any token-key entry present in the actual phase-7 ratchet. It does **not** remove `retired-word: code DI_BAG_INVALID_ACQUISITION_MODE`, because plan 12 owns runtime-code renaming, or the `transformService` option-key occurrence of `acquisitionMode`, because phase 9 renames that key to `transformReturnKind`. If the scanner has one shared `retired-word: member acquisitionMode` id, retain it until phase 9; do not hand-delete a still-observed violation to satisfy this phase's count.

- [ ] **Step 4: Regenerate docs and remove dead references**

```bash
npm run build
npm run docs:generate
```

Expected: generated API card has one `createProvider` entry and entries for function/class/plugin/token constructors; removed pages disappear. Update `docs/guides/api-reference.md` only where it links directly to a deleted type/method page: point rows at `FactoryReturnKind`, `FactoryContext`, `PositionalFactoryArguments`, `PositionalFactoryFunction`, `PluginReturnKind`, `CreateProviderFromPluginOptions`, and `CreateProviderFromPlugin`. Do not rewrite guide prose; phase 12 owns that.

At this contract boundary, replace Task 4's dual-surface `api-card.test.mjs` assertion with the final assertion below. The test still renders from the in-memory `project` and `tasks`:

```js
test('provider-source API card contains only final task calls', () => {
  const card = renderApiCard(project, tasks);
  for (const name of ['DiBag.createProvider', 'DiBag.createProviderFromFunction', 'DiBag.createProviderFromClass', 'DiBag.createProviderFromPlugin', 'DiBag.createToken']) {
    assert.match(card, new RegExp(name.replace('.', '\\.')));
  }
  for (const name of ['DiBag.fromFactory', 'DiBag.fromSyncFactory', 'DiBag.fromAsyncFactory', 'DiBag.fromFunction', 'DiBag.fromClass', 'DiBag.fromPlugin', 'DiBag.token']) {
    assert.doesNotMatch(card, new RegExp(name.replace('.', '\\.')));
  }
});
```

The existing exact-rendering setup still reads the legacy `PluginProviderFactory.md` page and its first test still pins `fromClass`, `AcquisitionMode`, and `FactoryOptions`. Replace that generated-page variable and read inside the existing `try` block:

```js
let createProviderFromPlugin;
// Inside the existing try block, replacing the PluginProviderFactory read:
createProviderFromPlugin = readFileSync(join(output, 'index/type-aliases/CreateProviderFromPlugin.md'), 'utf8');
```

From `compiler declarations retain syntax that TypeDoc reflections cannot represent`, delete only its three assertions containing `fromClass`, `AcquisitionMode`, or `FactoryOptions`; retain its existing bag assertions byte-for-byte. Add this separate final-provider test:

```js
test('compiler declarations retain final provider-source facade syntax', () => {
  const facadeText = compact(facade);
  assert.match(facadeText, /createProvider: typeof createProvider;/);
  assert.match(facadeText, /createProviderFromFunction: typeof createProviderFromFunction;/);
  assert.match(facadeText, /createProviderFromClass: typeof createProviderFromClass;/);
  assert.match(facadeText, /createProviderFromPlugin: CreateProviderFromPlugin;/);
  assert.match(facadeText, /createToken: typeof createToken;/);
});

test('plugin provider constructor remains a callable type alias', () => {
  assert.match(createProviderFromPlugin, /^# Type Alias: CreateProviderFromPlugin$/m);
  assert.match(compact(createProviderFromPlugin), /type CreateProviderFromPlugin = <const Dependencies extends readonly DependencyReference\[\], Service, ReturnKind extends PluginReturnKind>/);
});
```

Delete only the superseded legacy provider/plugin tests and variables; keep the token, runtime-options, error, and builder exact-rendering checks, updating their names only when an earlier accepted phase already renamed them. Under the S4 fallback, the facade property assertions above stay identical because they reference `typeof` the exported functions; the declaration consumer remains the proof of positional parameters.

Verify exact generated content:

```bash
rg -n "fromFactory|fromSyncFactory|fromAsyncFactory|fromFunction|fromClass|fromPlugin|DiBag\.token|AcquisitionMode|AcquisitionContext|PluginAcquisitionMode|PluginOptions|PluginProviderFactory" docs/agent/api-card.md docs/reference tools/docs/api-card-tasks.json
rg -n "createProvider|createProviderFromFunction|createProviderFromClass|createProviderFromPlugin|createToken|factoryReturnKind|abortSignal" docs/agent/api-card.md docs/reference
```

Expected: first command has no output; second finds each final declaration.

- [ ] **Step 5: Update exact assertion strings and operation details**

Delete obsolete `fromSyncFactory`/`fromAsyncFactory` invalid-helper runtime tests after their equivalent `createProvider` option tests pass. For every renamed surviving site, assert `details.operation` uses the final method name. Update only these message families in this phase:

```text
fromFactory requires a function -> createProvider requires a factory function
fromFunction callback must be a function -> createProviderFromFunction requires a factory function
fromClass requires a concrete constructor -> createProviderFromClass requires a concrete constructor
descriptor-validation `details.operation: 'fromPlugin'` -> `details.operation: 'createProviderFromPlugin'`; descriptor/output message bodies stay unchanged
token key must be a symbol -> createToken symbol must be a symbol
acquisitionMode raw/nativePromise -> factoryReturnKind 'uninspected'/'native-promise'
```

Retain their existing runtime codes unless the call is a new Task-1/Task-2 `DI_BAG_INVALID_ARGUMENT` validation site. Do not alter the 15 closing/closed assertions or 16 singleton-capture assertions; plan 12 Task 12 owns both families.

- [ ] **Step 6: Run contract checks and commit the final surface**

```bash
bun test tests/provider-sources.test.ts tests/portable-factories.test.ts tests/plugins.test.ts tests/collection-tokens.test.ts tests/api-naming.test.ts
node --test tools/codemod/test/fixtures.test.mjs tools/codemod/test/transforms.test.mjs tools/codemod/test/rename-map.test.mjs
node --test tools/graph/test/provider-sources.test.mjs
npm run docs:check
```

Expected: all pass. Coordinate the compiler fixture run with the controller; expected: all positive provider-source fixtures compile, all negative markers including `api-renaming.ts` match, and no removed declaration is emitted.

Expected: all pass. With the applicable controller hold lifted, run `npm run check` as the final green proof for this boundary, then commit compatibility removal and final generated docs:

```bash
git add src tests docs/agent/api-card.md docs/reference docs/guides/api-reference.md tests/api-naming-known-violations.json
git commit -m "feat!: remove legacy provider source APIs" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL"
```

---

### Task 6: Post-contract evidence, full gate, green commit, and phase report

**Files:**
- Modify: `docs/superpowers/plans/evidence/phase-08.md`
- Inspect: every changed file and every phase gate output

**Interfaces:**
- Consumes: final contracted source, migrated consumers, generated docs, and S4 decision.
- Produces: twelve final evidence rows, an evidence-only conventional commit when the rows changed, and the controller report required by the master plan.

- [ ] **Step 1: Run the final retired-name and invariant audits**

```bash
rg -n "\b(fromFactory|fromSyncFactory|fromAsyncFactory|fromFunction|fromClass|fromPlugin)\b|\b(AcquisitionMode|AcquisitionContext|CompositionArguments|CompositionFunction|PluginAcquisitionMode|PluginOptions|PluginProviderFactory)\b|readonly token:|export function token|readonly of:|\bmodeOptions\b|\bnativePromise\b" \
  src tests examples scripts tools/graph AGENTS.md docs/agent \
  --glob '!tools/codemod/test/fixtures/**' \
  --glob '!tests/types/negative/api-renaming.ts'
rg -n "tokenKinds" src/runtime.ts src/module.ts
rg -n "freshCollectionView" src
rg -n "ScopeOptions<|CreateChildContainerOptions<" src/scope-types.ts src/di-bag.ts
rg -n "snapshotOptionsBag\(" src/acquisition-context.ts src/composition.ts src/plugins.ts
```

Expected: first command has no unlisted output; its only executable compatibility rows are the exact lane-selected pinned-739b509 benchmark adapter, proved against archive `739b509`. Token-kind propagation, fresh collection views, and the preserved scope generic order remain; every new bag parser calls the accepted helper with four arguments while its optional fifth `inspectValue` parameter remains declared. Inspect every diff hunk touching `runtime.ts` or `module.ts` and reject any deletion of `GraphDescription.tokenKinds` or route around `freshCollectionView`.

- [ ] **Step 2: Run final evidence with the real CLI**

Obtain the controller's explicit lift of the evidence hold, then coordinate the lane and wait for at least 6 GiB available memory. A prior serialized `tsc6` exception does not lift this hold. Run:

```bash
node scripts/evidence-cases.mjs \
  --compare docs/superpowers/plans/evidence/baseline.md \
  --json /tmp/phase-08-final-evidence.json
```

Expected: twelve rows, every named worker `accepted: true`, every token worker has no diagnostics, every cumulative instantiation change `<= 10%`. There is no `--phase` or `--out` option.

Replace the provisional rows in `docs/superpowers/plans/evidence/phase-08.md` with the literal final rows and a rendered table containing case, baseline instantiations, final instantiations, and percentage. Retain the S4 attempt notes and final adopted/fallback decision. If a row breaches the threshold, repair accidental type expansion first; if the selected bag shape causes it, execute Task 2 Step 9 in full and rerun all relevant tasks.

- [ ] **Step 3: Run the complete phase gate**

Obtain the controller's explicit lift of the full-gate hold before running any command in this step. Evidence-lane or single-fixture authorization does not lift the full-gate hold.

```bash
npm run check
npm run docs:check
npm run graph:check
npm run codemod:check
npm run typecheck:native
npm run build:native
npm run check:native
npm run build
node --expose-gc --test --test-isolation=none \
  tests/runtime-scale.node.mjs \
  tests/acquisition-retention.node.mjs \
  tests/graph-retention.node.mjs
npm run agent-eval:test
for example in examples/*.ts; do bun "$example"; done
```

Expected: every command exits 0. The Node retention suites read `dist`, so `npm run build` immediately precedes them. Run any nested React/example commands that the current phase-7 gate adds. A compiler timeout is a flake only under the master's stated isolated-rerun rule; report it even when the rerun passes.

- [ ] **Step 4: Review the complete diff and commit final evidence**

```bash
git diff --check
git status --short
git diff --stat
git diff -- src/runtime.ts src/module.ts src/scope-types.ts src/options-bag.ts
git add docs/superpowers/plans/evidence/phase-08.md
git commit -F - <<'MSG'
test(evidence): record provider source cost

Record the final twelve cumulative rows and the adopted or fallback S4 result.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

Expected: `git diff --check` has no output; only the final evidence file changed after the prior green commits; the commit succeeds after all gates passed. If final evidence is byte-identical to the expand evidence, omit this empty commit and report that fact.

- [ ] **Step 5: Report to the controller in at most 60 lines**

Include:

```text
Branch: phase-08-provider-sources
Commits: <expand>; <codemod>; <mechanical migration>; <manual/docs migration>; <contract>; <evidence or omitted-identical>
S4: adopted|fallback; <short inference result>; worst cumulative evidence row <case> <percent>%
Gates: one final line and exit status for each Task-6 command
Codemod: <rewrite count>; <manual count>; all manual items resolved
Compatibility preserved: GraphDescription.tokenKinds; scope generic order/default; original provider-owned collection arrays with fresh frozen read views
Deviation: <none, or exact repaired generic/fallback with reason>
```

Do not push, publish, merge, or start phase 9.

---

## Planning-Time Evidence and Assumptions

- Fresh runtime evidence was run only against the private 0.4.0 archive `/tmp/di-bag-resume-20260921/probe-09`, with pinned Bun 1.4.0: `bun test tests/zz-09-provider-sources.test.ts` reported `3 pass`, `0 fail`, `15 expect()` calls. The probe proves current positional adapters receive only dependency values, named contextual factories receive the existing acquisition context, raw/native-Promise stages preserve identity and disposal values, and the existing contextual execution channel can append context after positional values. The runnable probe remains at `/tmp/di-bag-resume-20260921/probe-09/tests/zz-09-provider-sources.test.ts`.
- A separate checker-backed cumulative codemod probe copied the recovered phase-01/04 engine and vendored 0.4 declarations into `/tmp/di-bag-resume-20260921/probe-09/cumulative`. Its narrow `check-provider.mjs` run exited 0 at 214 MiB peak RSS and produced the exact provider-source rewrites for single-service token classification, raw/sync/async factories, positional functions, classes, plugins, a configured facade, and one nonliteral manual item. It also demonstrated that the real raw manual record contains `{ file, line, column, reason, text }`; fixture comparison projects `{ line, reason }`. This is planning evidence for the transform assembly only, not a substitute for Task 3's complete fixture suite or final compiler/gate authorization.
- The same private cumulative engine ran `check-provider-types.mjs` against the vendored 0.4 declarations and exited 0 at 204 MiB peak RSS. Its output matched Task 3's direct, local-alias, namespace, import-type, nested, literal-union, contextual `AcquisitionMode`/`PluginAcquisitionMode`, and generic-variable/manual expectations byte-for-byte; the raw manual row was at line 10 with the printed reason. A direct validator/index assertion also passed for the valid entry and returned the exact problem array for truthy non-array `genericArguments`, confirming that malformed maps do not throw a stray `TypeError`.
- After the explicit-call-generic review, `check-provider-generics.mjs` ran through that same checker-backed engine and vendored 0.4 declarations at 214 MiB peak RSS. It mapped the real return-kind positions for factory/function/class/plugin calls, mapped a literal union, preserved every earlier generic argument, renamed a nonliteral `AcquisitionMode` reference through the ordinary type pass, and emitted only the exact line-14 manual row printed in Task 3.
- No compiler, evidence worker, benchmark, full test lane, docs generator, or build ran during planning. Every type-level signature in Tasks 1–2 is uncompiled and explicitly gated for the executor.
- Controller integration probe `/tmp/di-bag-resume-20260921/review09-same-name/check.mjs` asserts the complete type-reference fixture and projected manual rows, including the unchanged-name `PluginProvider` third-generic migration; it passed at 208 MiB peak RSS using the copied real engine and vendored 0.4 declarations. The guide retired-name checker now excludes same-name type entries and its clean fixture passed separately. Neither probe ran compiler diagnostics or a phase gate.
- The wrapper package recorded by the handoff is TypeScript 6.0.2 and the actual compiler API is 6.0.3; the phase-0 baseline matches the API.
- Plan 08 is the accepted 1,097-line plan present at phase entry. The executor must start from its implemented result, keep `ModuleDescription.requirementRenames` distinct from graph metadata, preserve it alongside `GraphDescription.tokenKinds`, and adapt only names that differ. No phase-8 code may discard requirement maps while copying graph descriptions.
- Plans 05 and 06 are controller-accepted at `fef67af`. Plan 07's codemod extension is binding: `transformNames` is optional method-entry metadata and `api.nameForRole(role)` is the only way this plan's custom transform emits fields with no original 0.4 declaration.
- `CreateProviderFromPluginOptions<ReturnKind, Service, Dependencies = readonly DependencyReference[]>` preserves the original `PluginOptions<ReturnKind, Service>` generic prefix so the schema-supported type rename remains sound.
- Runtime error-code renaming is deferred to plan 12. This phase updates renamed operations/details and new validation sites, while retaining existing codes and the closing/closed plus singleton-capture messages.

## Self-Review

- **Spec coverage:** Tasks 1–2 cover all provider-source, return-kind, context, positional, plugin, and token decisions; Task 2 contains the complete S4 fallback; Task 3 covers one-pass migration; Task 4 covers generators, graph tooling, examples, agent eval, AGENTS, error docs, and API-card merge; Tasks 5–6 cover contract, naming, generated docs, evidence, gates, and reporting.
- **Contract preservation:** The plan repeats and audits `GraphDescription.tokenKinds`, the scope generic order/default, the accepted five-parameter options helper (with four-argument calls where inspection is unnecessary), and provider-owned collection arrays with fresh frozen read views.
- **Diagnostic coverage:** Every new options overload has a negative fixture on the offending property. New malformed argument sites use `DI_BAG_INVALID_ARGUMENT` and literal final detail objects. Renamed existing runtime sites keep their old code.
- **Codemod coverage:** Owners are original 0.4 declarations; the provider-source transform uses `api.nameOf` for method names and `api.nameForRole` for new fields; fixtures include exact source, golden output, explicit call generic positions/unions, and literal `{ line, reason }` manual rows. Nonliteral/spread options and nonliteral explicit return-kind arguments remain manual.
- **Commit integrity:** Task 2 owns the additive green commit, Task 3 owns the codemod commit, Task 4 separates the exact mechanical invocation from manual/docs cleanup, Task 5 owns the green contract commit, and Task 6 adds only changed final evidence. Each boundary has its own stated checks.
- **Remaining execution risk:** S4 is intentionally uncompiled. The object-bag signature may need up to three `NoInfer`/generic-order repairs, then must take the printed positional fallback. Plan 08's final metadata field names must be threaded through any description-copy edits.
