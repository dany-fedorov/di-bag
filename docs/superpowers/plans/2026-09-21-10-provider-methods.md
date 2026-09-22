# Provider Methods Implementation Plan

> **Planning review accepted:** see `handoff/resume-2026-09-21.md`. Implementation, semantic compiler checks, measured selection and full phase verification remain pending under the existing hold.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move provider decorators onto immutable `Provider` handles, rename lifetime values and contracts, and migrate source, tooling, examples, and documentation without weakening compile-time or runtime guarantees.

**Architecture:** Extend the existing prototype-backed `Provider` handle so each method derives a fresh frozen handle from the WeakMap-held description while preserving the exact type stages accumulated by the 0.4.0 helpers. A source-aware codemod uses phase-7 method-entry naming and phase-8 provider-source contracts to turn facade decorators into chains, while runtime lifetime policy keeps compact internal kinds and translates every public snapshot, event, diagnostic, and external lifetime-reach edge to the full 0.5.0 vocabulary.

**Tech Stack:** TypeScript 6.0.x compiler API, Bun 1.4.0, Node 24, TypeDoc/VitePress, DI Bag provider descriptions and execution runtime, phase-1 TypeScript-aware codemod.

**Spec:** `docs/superpowers/specs/2026-09-20-swift-api-style.md` and `docs/superpowers/specs/2026-09-20-swift-api-style-examples.md`, sequenced by `docs/superpowers/plans/2026-09-21-00-swift-api-style-master.md`.

## Global Constraints

- Start from phases 0–8 merged on `next`; this is the provider-method phase and must preserve every earlier migration map entry and API-card row.
- Use the original 0.4.0 declaration owner and `api.nameOf` for declaration-backed emitted names; use phase 7's method-entry `transformNames` plus `api.nameForRole(role)` only for generated bag fields with no original declaration owner.
- Preserve phase 8's `CreateProviderFromPluginOptions<ReturnKind, Service, Dependencies = ...>` generic prefix and its accumulated `types[].genericArguments` mapping/manual behavior; provider-method map edits append to it.
- Preserve phase 4 collection-token admission and replacement behavior, phase 5/6 option snapshots, and phase 8's external lifetime-reach remapping when lifetime types are renamed.
- New malformed-argument sites use `DI_BAG_INVALID_ARGUMENT` with literal `{ operation, argument, expected }` details and plan-12 vocabulary. Closing/closed and singleton-capture message-family text, anchors, and assertions remain deferred to plan 12 Task 12.
- Compile-time designs in this plan are uncompiled planning signatures until the executor runs the serialized compiler lane.
- Do not accept short public lifetime strings after contract removal; public lifetime fields always expose the full string values.

---

## State on entry

Phases 0–8 are merged. Builder/container/module names are final; `Provider` uses the phase-2 generic names `ExposedFactory, RegistrationMetadata, AcquisitionMetadataFrames, RetainedGraphContract, AcquiredValue`; phase 8 exports `FactoryReturnKind`, `FactoryContext`, and the four `createProvider*` calls. Provider decoration is still the 0.4 facade surface, lifetime values are short, and the default remains scoped.

Run before editing:

```bash
export PATH="/tmp/claude-1000/-home-df-wd-personal-di-bag/7818417c-3b3a-48db-9bef-85624eff953b/scratchpad/bun/bin:$PATH"
bun --version
git status --short
rg -n "createProvider|createProviderFromFunction|FactoryReturnKind|FactoryContext|forCollectionOf|nameForRole" src tools/codemod
rg -n "withDisposal|withLifetime|withMetadata|transformService|FactoryWithDisposal|type Registration" src
rg -n "root-reach|RenamedExternalObligation|root-capture|allowScopedDependencies" src docs/agent tools/docs
```

Expected: Bun `1.4.0`; the first grep proves phase 8 and phase 7 interfaces; the second finds all old decorators/types; the third finds phase 8's `RenamedExternalObligation` and every lifetime contract that this phase must migrate. Stop if `FactoryReturnKind` differs from `'auto-detect' | 'sync-value' | 'native-promise' | 'uninspected'`, if `FactoryContext` differs from `{ abortSignal, pushDisposer }`, or if `snapshotOptionsBag(options, operation, required, optional?)` is absent.

The exact phase-8 source contracts consumed here are:

```text
export type FactoryReturnKind = 'auto-detect' | 'sync-value' | 'native-promise' | 'uninspected';
export interface FactoryContext {
  readonly abortSignal: AbortSignal;
  pushDisposer(disposeService: () => void | Promise<void>): void;
}
createProvider(factory, { factoryReturnKind?, factoryReceivesContext?: true }): Provider<...>;
createProviderFromFunction({ dependencies, factoryFunction, factoryReturnKind?, factoryReceivesContext?: true }): Provider<...>;
createProviderFromClass({ dependencies, serviceClass, factoryReturnKind? }): Provider<...>;
createProviderFromPlugin({ dependencies, pluginDescriptor, isValidPluginOutput, factoryReturnKind }): Provider<...>;
```

If spike S4 selected its positional fallback, only the `createProviderFromFunction` call syntax differs; no provider method in this phase changes.

## File Structure

| Path | Action | Responsibility |
| --- | --- | --- |
| `src/provider.ts` | modify | prototype methods, retained type stages, metadata/transform implementations |
| `src/lifetime.ts`, `src/lifetime-types.ts` | modify | public lifetime strings, internal/public mapping, graph contracts and obligations |
| `src/registration.ts`, `src/provider-operations.ts` | modify | `ProviderOrFactory`, remove public disposal wrapper, default description and normalization |
| `src/acquisition.ts`, `src/runtime.ts`, `src/inspection.ts`, `src/observers.ts` | modify | internal policy checks and full public lifetime values |
| `src/di-bag.ts`, `src/index.ts`, `src/module-types.ts`, builder/contribution types | modify | remove facade decorators, export new types, preserve replacement fast path |
| `tests/provider-methods.test.ts`, `tests/types/provider-methods.ts`, `tests/types/negative/provider-methods.ts` | create | focused runtime, positive types, property-located negatives |
| existing provider/lifetime/disposal/metadata tests and fixtures | modify | migrate old decorator calls and exact assertions |
| `tools/codemod/rename-map.json` | modify | accumulated original-owner entries, value/property mappings, transform role names |
| `tools/codemod/lib/transforms/provider-methods.mjs` | create | source-aware decorator-chain transform |
| `tools/codemod/test/fixtures/provider-methods/*`, transform tests | create/modify | exact golden and manual rows |
| `tools/graph/lib/extract.mjs`, its tests/fixtures/README | modify | recognize final chains and all full lifetime values while retaining old forms |
| evidence workers in `tests/compiler.ts` and scripts | modify | twelve migrated cases plus 100-provider S2 case |
| `examples`, `scripts/agent-eval`, `AGENTS.md`, `docs/agent/*`, docs task/test files | modify | final provider vocabulary and calls without resetting earlier edits |
| `tests/api-naming-known-violations.json` | regenerate | remove this phase's retired words only |
| `docs/superpowers/plans/evidence/phase-09.md` | create | all measurements and S2 decision |

---

### Task 0: Audit entry state and isolate the spike

**Files:**
- Inspect only: paths in State on Entry
- Create during execution only: `/tmp/phase-09-provider-sites.txt`

**Interfaces:**
- Consumes: merged phase-8 branch and `docs/superpowers/plans/evidence/phase-08.md`.
- Produces: exact migration inventory and a clean `phase-09-provider-methods` branch.

- [ ] **Step 1: Create the branch and run every State on Entry command**

```bash
git switch next
git switch -c phase-09-provider-methods
# Then run the State on Entry block verbatim.
```

Expected: phase-8 names exist and only pre-existing controller changes appear.

- [ ] **Step 2: Capture call sites and broken message assertions**

```bash
rg -n "\b(withDisposal|withLifetime|withMetadata|transformService|FactoryWithDisposal|Registration|root-reach|root-capture|allowScopedDependencies)\b|'root'|'scoped'|'transient'" src tests examples scripts tools AGENTS.md docs/agent > /tmp/phase-09-provider-sites.txt
grep -rhoE "toThrow\((/|['\`])[^)]*" tests | grep -iE "\b(root lifetime|withLifetime|withMetadata|transformService|allowScopedDependencies)\b" | sort | uniq -c
```

Expected lifetime-family rows from the planning archive, recorded only so the executor proves they remain unchanged in this phase:

```text
8 toThrow('root lifetime cannot capture scoped dependency'
4 toThrow('root lifetime cannot capture scoped'
2 toThrow(/root lifetime cannot capture scoped/
2 toThrow('root lifetime'
```

Do not replace these four rows: the final common-rules override defers the singleton-capture message family to plan 12 Task 12. Also preserve `root-capture`, `SeeErrors<'root-capture'>`, `familyIds`, and inbound links for that phase. Do not change `runtime package root is not canonical`, `root failed`, or `exactly one di-bag root entry`. Closing/closed assertions are likewise outside this phase.

No commit: this task is read-only inventory.

**Execution order:** after Task 0, execute Task 3 (codemod implementation) against the untouched phase-8 tree and commit it green. Then execute Tasks 1–2 plus Task 5 Step 1 as the additive expand commit: the scale source and worker must exist in that exact commit before either old/new measurement is attributed to it. Execute Task 4 as the mechanical migration commit, Task 5 Steps 2–3 as the S2 decision checkpoint, and Task 6 as the contract commit. The numbering groups related implementation text; this order is binding and prevents a tools-only commit or evidence row from depending on an uncommitted source generator.

---

### Task 1: Add provider prototype methods with retained contracts

**Files:**
- Modify: `src/provider.ts`, `src/lifetime.ts`, `src/lifetime-types.ts`, `src/registration.ts`, `src/provider-operations.ts`, `src/acquisition-mode.ts`, `src/acquisition.ts`, `src/runtime.ts`, `src/inspection.ts`, `src/observers.ts`, `src/module-types.ts`, `src/builder-method-types.ts`
- Modify: `tests/types/builder-renames.ts`, `tests/types/builder-renames-consumer.ts`
- Create: `tests/types/negative/provider-replacement-output.ts`
- Create: `tests/provider-methods.test.ts`, `tests/types/provider-methods.ts`, `tests/types/negative/provider-methods.ts`
- Modify: `tests/types.test.ts`

**Interfaces:**
- Consumes: phase-8 `Provider<ExposedFactory, RegistrationMetadata, AcquisitionMetadataFrames, RetainedGraphContract, AcquiredValue>`, `FactoryReturnKind`, `Acquired<Output, Kind>`, `snapshotOptionsBag`.
- Produces: the five method signatures below, final lifetime contracts, and an additive `ProviderOrFactory = Factory | ProviderBase` alias. `Registration` and `FactoryWithDisposal` remain as compatibility contracts until Task 6.

This design is **UNCOMPILED**. Runtime feasibility is fresh evidence; declaration nameability, invariant inference, and every negative diagnostic remain executor proofs. Tasks 1 and 2 are one expand unit: do not commit at the former Task-1 checkpoint. Finish every lifetime step in Task 2, migrate the old lifetime snapshot assertions needed for green tests, run the combined gates, and make the single expand commit at the end of Task 2. The old facade functions continue accepting private `LegacyLifetime` values during this expand unit, while provider methods accept only final values.

- [ ] **Step 1: Write focused runtime tests first**

Create `tests/provider-methods.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { DiBag } from '../src';

const caught = (run: () => unknown): any => { try { run(); } catch (error) { return error; } throw new Error('expected throw'); };

test('frozen providers derive frozen providers and retain ordered stages', async () => {
  const events: string[] = [];
  const source = DiBag.createProvider(() => ({ value: 2 }))
    .withDisposal(service => { events.push(`source:${service.value}`); })
    .withRegistrationMetadata({ owner: 'platform' as const })
    .withAcquisitionMetadata({ callbackReceives: 'exposed-service', describeAcquisition: service => ({ before: service.value }) })
    .withTransformedService({ callbackReceives: 'exposed-service', transformService: service => service.value * 3 })
    .withDisposal(service => { events.push(`mapped:${service}`); });
  expect(Object.isFrozen(source)).toBe(true);
  expect(Object.hasOwn(source, 'withDisposal')).toBe(false);
  const container = DiBag.createBuilder().withServices({ value: source }).buildContainer();
  expect(container.resolve('value')).toBe(6);
  const snapshot = container.serviceSnapshot('value');
  expect(snapshot.registrationMetadata).toEqual({ owner: 'platform' });
  expect(snapshot.acquisitions[0]?.acquisitionMetadata).toEqual([{ present: true, value: { before: 2 } }]);
  await container.close();
  expect(events).toEqual(['mapped:6', 'source:2']);
});

test('fulfilled callbacks await input while exposed callbacks preserve identity', async () => {
  const pending = Promise.resolve(4);
  let exposed: unknown;
  const direct = DiBag.createProvider(() => pending, { factoryReturnKind: 'native-promise' })
    .withAcquisitionMetadata({ callbackReceives: 'exposed-service', describeAcquisition: value => { exposed = value; return { direct: true }; } })
    .withTransformedService({ callbackReceives: 'exposed-service', transformService: value => value, transformReturnKind: 'native-promise' });
  const fulfilled = DiBag.createProvider(() => pending, { factoryReturnKind: 'native-promise' })
    .withAcquisitionMetadata({ callbackReceives: 'fulfilled-value', describeAcquisition: value => ({ value }) })
    .withTransformedService({ callbackReceives: 'fulfilled-value', transformService: value => value + 1 });
  const container = DiBag.createBuilder().withServices({ direct, fulfilled }).buildContainer();
  expect(container.resolve('direct')).toBe(pending);
  expect(await container.resolve('fulfilled')).toBe(5);
  expect(exposed).toBe(pending);
  await container.close();
});

test('provider method bags snapshot own fields and reject malformed combinations', () => {
  const provider = DiBag.createProvider(() => 1);
  let reads = 0;
  const transformed = provider.withTransformedService({
    get transformService() { reads++; return (value: number) => value + reads; },
    get callbackReceives() { reads++; return 'exposed-service' as const; },
  });
  expect(reads).toBe(2);
  const container = DiBag.createBuilder().withServices({ transformed }).buildContainer();
  expect(container.resolve('transformed')).toBe(3);
  expect(container.resolve('transformed')).toBe(3);
  expect(reads).toBe(2);
  const inherited = Object.create({ callbackReceives: 'exposed-service' }); inherited.transformService = (value: number) => value;
  const cases: readonly [() => unknown, string, object][] = [
    [() => (provider as any).withDisposal(1), 'DI_BAG_INVALID_ARGUMENT', { operation: 'withDisposal', argument: 'disposeService', expected: 'a function' }],
    [() => (provider as any).withLifetime('scoped'), 'DI_BAG_INVALID_ARGUMENT', { operation: 'withLifetime', argument: 'lifetime', expected: "one of: 'singleton:one-per-container-tree', 'scoped:one-per-container', 'transient:one-per-resolve'" }],
    [() => (provider as any).withAcquisitionMetadata({ callbackReceives: 'other', describeAcquisition() { return {}; } }), 'DI_BAG_INVALID_ARGUMENT', { operation: 'withAcquisitionMetadata', argument: 'callbackReceives', expected: "one of: 'exposed-service', 'fulfilled-value'" }],
    [() => (provider as any).withTransformedService({ callbackReceives: 'fulfilled-value', transformService: (x: unknown) => x, transformReturnKind: 'sync-value' }), 'DI_BAG_INVALID_ARGUMENT', { operation: 'withTransformedService', argument: 'transformReturnKind', expected: "absent when callbackReceives is 'fulfilled-value'" }],
    [() => (provider as any).withTransformedService(inherited), 'DI_BAG_INVALID_ARGUMENT', { operation: 'withTransformedService', argument: 'options', expected: 'only the own properties: transformService, callbackReceives, transformReturnKind' }],
    [() => (provider as any).withAcquisitionMetadata({ describeAcquisition: () => ({}), callbackReceives: 'exposed-service', [Symbol('extra')]: true }), 'DI_BAG_INVALID_ARGUMENT', { operation: 'withAcquisitionMetadata', argument: 'options', expected: 'only the own properties: describeAcquisition, callbackReceives' }],
  ];
  for (const [run, code, details] of cases) { const error = caught(run); expect(error.code).toBe(code); expect(error.details).toEqual(details); }
});

test('acquisition metadata callback failures name the provider method', () => {
  for (const result of [() => [], () => new Date(), () => ({ then() {} })]) {
    const provider = DiBag.createProvider(() => 1).withAcquisitionMetadata({
      callbackReceives: 'exposed-service',
      describeAcquisition: result as () => never,
    });
    const container = DiBag.createBuilder().withServices({ value: provider }).buildContainer();
    const error = caught(() => container.resolve('value'));
    expect(error.code).toBe('DI_BAG_INVALID_METADATA');
    expect(error.details.operation).toBe('withAcquisitionMetadata');
  }
});
```

Run: `bun test tests/provider-methods.test.ts`
Expected: FAIL because the methods do not exist.

- [ ] **Step 2: Add the exact public method signatures**

Inside `Provider`, keep the invariant witness and add these methods. `MappedProviderFactory` retains the original dependency object.

```text
type MappedProviderFactory<ExposedFactory extends Factory, Output> =
  Parameters<ExposedFactory> extends []
    ? (this: void) => Output
    : (this: void, dependencies: Exclude<Parameters<ExposedFactory>[0], undefined>) => Output;

type TransformReturnKindOptions<ReturnKind extends FactoryReturnKind> =
  'auto-detect' extends ReturnKind
    ? { readonly transformReturnKind?: ReturnKind }
    : { readonly transformReturnKind: ReturnKind };

withDisposal(
  disposeService: (this: void, service: AcquiredValue) => void | Promise<void>,
): Provider<ExposedFactory, RegistrationMetadata, AcquisitionMetadataFrames, RetainedGraphContract, AcquiredValue>;

withLifetime<const SelectedLifetime extends Lifetime>(
  lifetime: SelectedLifetime & LifetimeAdmission<SelectedLifetime>,
): Provider<ExposedFactory, RegistrationMetadata, AcquisitionMetadataFrames, LifetimeGraph<RetainedGraphContract, SelectedLifetime, undefined>, AcquiredValue>;
withLifetime<const SelectedLifetime extends Lifetime, const Options extends object | undefined>(
  lifetime: SelectedLifetime & LifetimeAdmission<SelectedLifetime>,
  options: Options & LifetimeOptions<NoInfer<SelectedLifetime>, NoInfer<Options>>,
): Provider<ExposedFactory, RegistrationMetadata, AcquisitionMetadataFrames, LifetimeGraph<RetainedGraphContract, SelectedLifetime, Options>, AcquiredValue>;

withRegistrationMetadata<AddedMetadata extends object>(
  registrationMetadata: AddedMetadata & MetadataKeys<Provider<ExposedFactory, RegistrationMetadata, AcquisitionMetadataFrames, RetainedGraphContract, AcquiredValue>, AddedMetadata>,
): Provider<ExposedFactory, Readonly<RegistrationMetadata & AddedMetadata>, AcquisitionMetadataFrames, RetainedGraphContract, AcquiredValue>;

withAcquisitionMetadata<Describe extends (this: void, service: ReturnType<ExposedFactory>) => object>(options: {
  readonly describeAcquisition: Describe & AcquisitionMetadataAdmission<ReturnType<Describe>>;
  readonly callbackReceives: 'exposed-service';
}): Provider<ExposedFactory, RegistrationMetadata, readonly [...AcquisitionMetadataFrames, Readonly<ReturnType<Describe>>], RetainedGraphContract, AcquiredValue>;
withAcquisitionMetadata<Describe extends (this: void, service: Awaited<ReturnType<ExposedFactory>>) => object>(options: {
  readonly describeAcquisition: Describe & AcquisitionMetadataAdmission<ReturnType<Describe>>;
  readonly callbackReceives: 'fulfilled-value';
}): Provider<MappedProviderFactory<ExposedFactory, Promise<Awaited<ReturnType<ExposedFactory>>>>, RegistrationMetadata, readonly [...AcquisitionMetadataFrames, Readonly<ReturnType<Describe>>], RetainedGraphContract, Awaited<ReturnType<ExposedFactory>>>;

withTransformedService<Transform extends (this: void, service: ReturnType<ExposedFactory>) => ('native-promise' extends ReturnKind ? Promise<unknown> : unknown), ReturnKind extends FactoryReturnKind = 'auto-detect'>(options:
  { readonly transformService: Transform; readonly callbackReceives: 'exposed-service' }
  & TransformReturnKindOptions<ReturnKind>
  & NativeOutput<ReturnType<NoInfer<Transform>>, NoInfer<ReturnKind>>
  & AutoOutput<ReturnType<NoInfer<Transform>>, NoInfer<ReturnKind>>
  & SyncOutput<ReturnType<NoInfer<Transform>>, NoInfer<ReturnKind>>
): Provider<MappedProviderFactory<ExposedFactory, ReturnType<Transform>>, RegistrationMetadata, AcquisitionMetadataFrames, RetainedGraphContract, Acquired<ReturnType<Transform>, ReturnKind>>;
withTransformedService<Transform extends (this: void, service: Awaited<ReturnType<ExposedFactory>>) => unknown>(options: {
  readonly transformService: Transform;
  readonly callbackReceives: 'fulfilled-value';
  readonly transformReturnKind?: never;
}): Provider<MappedProviderFactory<ExposedFactory, Promise<Awaited<ReturnType<Transform>>>>, RegistrationMetadata, AcquisitionMetadataFrames, RetainedGraphContract, Awaited<ReturnType<Transform>>>;
```

Each overload is followed by the implementation signature shown here; do not mutate `this`:

```ts
withDisposal(disposeService: (service: AcquiredValue) => void | Promise<void>): Provider<ExposedFactory, RegistrationMetadata, AcquisitionMetadataFrames, RetainedGraphContract, AcquiredValue> {
  return addDisposal(this, disposeService) as never;
}
// Place both withLifetime overload declarations above this implementation.
withLifetime(lifetime: Lifetime, options?: object): ProviderBase { return selectLifetime(this, lifetime, options); }
withRegistrationMetadata<AddedMetadata extends object>(registrationMetadata: AddedMetadata): Provider<ExposedFactory, Readonly<RegistrationMetadata & AddedMetadata>, AcquisitionMetadataFrames, RetainedGraphContract, AcquiredValue> {
  return addRegistrationMetadata(this, registrationMetadata) as never;
}
// Place both withAcquisitionMetadata overload declarations above this implementation.
withAcquisitionMetadata(options: unknown): ProviderBase { return addAcquisitionMetadata(this, options); }
// Place both withTransformedService overload declarations above this implementation.
withTransformedService(options: unknown): ProviderBase { return addTransformedService(this, options); }
```

TypeScript requires overload declarations to be adjacent to their implementation. The printed grouping above describes that exact class layout; do not place all declarations first and implementations later.

- [ ] **Step 3: Implement the runtime helpers completely**

Extract the operation-appending work used by the new methods into these internal functions; keep `transform` as the one operation-appending primitive. During the expand commit, keep the phase-8 facade overloads and their validation bodies byte-for-byte except for the explicit `compatibilityProvider` and `selectLegacyLifetime` bridge printed below. In particular, the first `withDisposal(factory, disposer)` overload continues constructing `FactoryWithDisposal`, and legacy `withMetadata` / `transformService` continue reporting their old codes and option names until Task 6.

```ts
function addDisposal(provider: ProviderBase, disposeService: unknown, operation = 'withDisposal'): ProviderBase {
  if (typeof disposeService !== 'function') throw libraryTypeError('DI_BAG_INVALID_ARGUMENT', `${operation} disposeService must be a function`, { operation, argument: 'disposeService', expected: 'a function' });
  return transform(provider as ProviderOrFactory, { kind: 'owned', dispose: disposeService as (value: never) => void | Promise<void> });
}

function addRegistrationMetadata(provider: ProviderBase, registrationMetadata: unknown, operation = 'withRegistrationMetadata'): ProviderBase {
  if (typeof registrationMetadata !== 'object' || registrationMetadata === null || Array.isArray(registrationMetadata)) throw libraryTypeError('DI_BAG_INVALID_ARGUMENT', `${operation} registrationMetadata must be an object`, { operation, argument: 'registrationMetadata', expected: 'an object' });
  const description = describe(provider);
  const keys = Reflect.ownKeys(registrationMetadata);
  for (const key of keys) if (Object.hasOwn(description.metadata, key)) throw libraryError('DI_BAG_DUPLICATE_METADATA', `duplicate registration metadata: ${String(key)}`, { operation, key });
  const added = Object.create(null) as Record<PropertyKey, unknown>;
  for (const key of keys) added[key] = Reflect.get(registrationMetadata, key);
  Object.freeze(added);
  const metadata = Object.freeze(Object.assign(Object.create(null), description.metadata, added));
  const handle = createProviderHandle<Factory, object, readonly unknown[], GraphContract, unknown>();
  retainDescription(handle, Object.freeze({ ...description, operations: Object.freeze([...description.operations, Object.freeze({ kind: 'metadata' as const, metadata: added })]), metadata }));
  return handle;
}

function addAcquisitionMetadata(provider: ProviderBase, options: unknown, operation = 'withAcquisitionMetadata'): ProviderBase {
  const { describeAcquisition, callbackReceives } = snapshotOptionsBag(options, operation, ['describeAcquisition', 'callbackReceives']);
  if (typeof describeAcquisition !== 'function') throw libraryTypeError('DI_BAG_INVALID_ARGUMENT', `${operation} describeAcquisition must be a function`, { operation, argument: 'describeAcquisition', expected: 'a function' });
  if (callbackReceives !== 'exposed-service' && callbackReceives !== 'fulfilled-value') throw libraryTypeError('DI_BAG_INVALID_ARGUMENT', `${operation} callbackReceives must name the callback input`, { operation, argument: 'callbackReceives', expected: "one of: 'exposed-service', 'fulfilled-value'" });
  return annotate(provider as ProviderOrFactory, describeAcquisition as (value: never) => object, callbackReceives === 'fulfilled-value', operation);
}

function addTransformedService(provider: ProviderBase, options: unknown, operation = 'withTransformedService'): ProviderBase {
  const bag = snapshotOptionsBag(options, operation, ['transformService', 'callbackReceives'], ['transformReturnKind']);
  const { transformService, callbackReceives, transformReturnKind } = bag;
  if (typeof transformService !== 'function') throw libraryTypeError('DI_BAG_INVALID_ARGUMENT', `${operation} transformService must be a function`, { operation, argument: 'transformService', expected: 'a function' });
  if (callbackReceives !== 'exposed-service' && callbackReceives !== 'fulfilled-value') throw libraryTypeError('DI_BAG_INVALID_ARGUMENT', `${operation} callbackReceives must name the callback input`, { operation, argument: 'callbackReceives', expected: "one of: 'exposed-service', 'fulfilled-value'" });
  if (callbackReceives === 'fulfilled-value' && Object.hasOwn(bag, 'transformReturnKind')) throw libraryTypeError('DI_BAG_INVALID_ARGUMENT', `${operation} transformReturnKind is absent for fulfilled-value callbacks`, { operation, argument: 'transformReturnKind', expected: "absent when callbackReceives is 'fulfilled-value'" });
  const selected = callbackReceives === 'fulfilled-value' ? 'native-promise' : factoryReturnKind(transformReturnKind, operation, 'auto-detect', 'transformReturnKind');
  return transform(provider as ProviderOrFactory, { kind: callbackReceives === 'fulfilled-value' ? 'map-async' : 'map-sync', project: transformService as (value: never) => unknown, factoryReturnKind: selected });
}

function annotate<ServiceProvider extends ProviderOrFactory, OutputFactory extends Factory, Metadata extends object, AcquiredValue>(provider: ServiceProvider, describeAcquisition: (this: void, service: never) => object, fulfilled: boolean, operation = 'withAcquisitionMetadata'): Provider<OutputFactory, RetainedMetadata<ServiceProvider>, readonly [...ProviderAcquisitionMetadata<ServiceProvider>, Readonly<Metadata>], ProviderGraphContract<ServiceProvider>, AcquiredValue> {
  if (typeof describeAcquisition !== 'function') throw libraryTypeError('DI_BAG_INVALID_ARGUMENT', `${operation} describeAcquisition must be a function`, { operation, argument: 'describeAcquisition', expected: 'a function' });
  const description = describe(provider);
  let selected = description.source.factoryReturnKind;
  for (const operation of description.operations) if ('factoryReturnKind' in operation) selected = operation.factoryReturnKind;
  return transform(provider, {
    kind: fulfilled ? 'frame-async' : 'frame-sync',
    factoryReturnKind: fulfilled ? 'native-promise' : selected,
    project(service: never) {
      const metadata = describeAcquisition(service);
      if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) return invalidAcquisitionMetadata(metadata, operation);
      const prototype = Object.getPrototypeOf(metadata);
      if (prototype !== null && prototype !== Object.prototype) return invalidAcquisitionMetadata(metadata, operation);
      const frame = Object.create(null) as Record<PropertyKey, unknown>;
      for (const key of Reflect.ownKeys(metadata)) frame[key] = Reflect.get(metadata, key);
      const then = Object.hasOwn(frame, 'then') ? frame.then : Reflect.get(metadata, 'then');
      if (typeof then === 'function') return invalidAcquisitionMetadata(metadata, operation);
      return { value: service, frame: Object.freeze(frame) };
    },
  }) as never;
}

function invalidAcquisitionMetadata(value: unknown, operation: string): never {
  try { Promise.prototype.then.call(value, () => {}, () => {}); } catch { /* Not an observable native Promise. */ }
  throw libraryTypeError('DI_BAG_INVALID_METADATA', 'acquisition metadata must be a synchronous plain object record', { operation });
}

/** @internal expand-only bridge; delete with FactoryWithDisposal in Task 6. */
function compatibilityProvider(registration: Registration, operation: string): ProviderBase {
  if (typeof registration === 'function') return createProvider(registration);
  describe(registration, operation);
  return registration as ProviderBase;
}
```

Extend the authenticated-description boundary in `src/provider-operations.ts` during expand, before the bridge is used:

```ts
export function describe(registration: unknown, operation = 'withServices'): ProviderDescription {
  if (typeof registration === 'function') return sourceDescription(registration as Factory);
  if (typeof registration === 'object' && registration !== null) {
    const description = descriptions.get(registration);
    if (description) return description;
  }
  throw libraryError('DI_BAG_INVALID_REGISTRATION', 'invalid factory registration', { operation });
}
```

Existing callers that omit the second argument now report the phase-6 builder vocabulary. The compatibility bridge and fallback pass their own operation. Replace the existing `invalidAcquisitionMetadata` body with the two-parameter body above; do not leave two declarations.

Extend plan 9's validator without changing its existing first three parameters:

```ts
export function factoryReturnKind(value: unknown, operation: string, fallback: FactoryReturnKind = 'auto-detect', argument = 'factoryReturnKind'): FactoryReturnKind {
  const selected = value === undefined ? fallback : value;
  if (!returnKinds.includes(selected as FactoryReturnKind)) throw libraryError('DI_BAG_INVALID_ARGUMENT', `${operation} ${argument} must name a supported return policy`, { operation, argument, expected: "one of: 'auto-detect', 'sync-value', 'native-promise', 'uninspected'" });
  return selected as FactoryReturnKind;
}
```

Every phase-8 caller remains source-compatible. `withTransformedService` passes the fourth parameter so malformed values identify `transformReturnKind`.

- [ ] **Step 4: Add the final alias and replacement fast path while retaining compatibility**

Replace the public registration contract exactly:

```ts
export type ProviderOrFactory = Factory | ProviderBase;
export type Registration = Factory | FactoryWithDisposal<Factory> | ProviderBase;
export type Registrations = Record<string, Registration>;
```

Keep every `FactoryWithDisposal` projection branch and the old facade overload until Task 6, so all pre-migration tests stay green. Phase 5 moved the checked replacement signatures into `BuilderWithReplacedService` in `src/builder-method-types.ts`; `src/di-bag.ts` owns only its typed field and shared private runtime implementation. Phase 5 selected `withReplacedService(serviceKey, provider)` after two serious options-bag inference repairs failed, so every current and future overload in this plan remains positional with the public `ServiceKey, Replacement` generic pair. Add the following private output admission and put the new positional call signature first in that existing callable interface, before its legacy fast and general positional overloads. Import `ProviderOutput`, `ReplacementOutput`, `WrongShapeMessage` and the other existing helpers internally; do not export the private admission from the package.

```ts
type FastReplacementOutputAdmission<Entries extends Entry, Constraints extends NeedConstraint, ServiceKey extends string, Replacement extends ProviderOrFactory> =
  [ProviderOutput<NoInfer<Replacement>>] extends [ReplacementOutput<NoInfer<RegistrationsFromEntries<Entries>>, ServiceKey, Constraints>]
    ? unknown
    : Unsatisfied<WrongShapeMessage, {
        dependency: ServiceKey;
        expected: ReplacementOutput<RegistrationsFromEntries<Entries>, ServiceKey, Constraints>;
        provided: ProviderOutput<Replacement>;
      }>;

// First call signature inside BuilderWithReplacedService<Entries, Constraints>:
<const ServiceKey extends string, Replacement extends ProviderOrFactory>(
  serviceKey: ServiceKey & ReplacementKeyOf<EntryKeys<Entries>, ServiceKey>,
  provider: Replacement & ZeroDependencyAdmission<NoInfer<Replacement>>
    & FastReplacementOutputAdmission<Entries, Constraints, NoInfer<ServiceKey>, NoInfer<Replacement>>
    & CheckedConstraints<Constraints, OverrideRegistrations<RegistrationsFromEntries<Entries>, Record<ServiceKey, NoInfer<Replacement>>>>,
): import('./di-bag').Builder<ReplacedEntries<Entries, ServiceKey, Replacement>, WithoutExportObligations<Constraints, ServiceKey>>;
```

This preserves the two-part fast algorithm: output admission against surviving consumer requirements and `CheckedConstraints`, without the `IncrementalChecked` history rescan in the general replacement helper. It is an **uncompiled future-state proposal**, including its diagnostic details; it does not claim that provider inference or performance has passed. Prove plain-factory and provider-object inference, provider-argument diagnostics, overload order, physical nameability and the unchanged S2 budget before adopting it. Keep the general string/token overload positional with the same two public generic parameters and all phase-4 collection admissions; do not reintroduce a whole-options generic or a deferred options-object admission.

Create `tests/types/negative/provider-replacement-output.ts` separately from the twelve-case provider-method fixture:

```ts
import { DiBag } from '../../../src';
DiBag.createBuilder().withServices({
  value: () => 1,
  consumer: ({ value }: { value: number }) => value,
}).withReplacedService(
  'value',
  // diagnostic: provided service does not satisfy its consumer dependency
  DiBag.createProvider(() => 'wrong'),
);
```

The error must remain on the provider argument, and the existing twelve provider-method cases remain intact. Extend the existing builder physical producer with an unannotated exported zero-dependency numeric provider, then consume it through the emitted `withReplacedServiceMethod` and assert the inferred result is exactly `number`. Keep the original factory-fast and dependency-bearing positional calls. Run the focused builder source/negative fixtures and existing classic6/native7 CTS/MTS producer-deletion matrix before the combined Task 2 expand commit, and again after Task 6 contraction. No new physical harness or producer method annotation is needed.

- [ ] **Step 5: Add complete type fixtures**

Create `tests/types/provider-methods.ts`:

```ts
import { DiBag, type ProviderAcquiredValue, type ProviderOutput, type ProviderRegistrationMetadata, type ProviderAcquisitionMetadata, type ProviderGraphContract } from '../../src';
import type { Assert, Equal } from './assert';
const source = DiBag.createProvider(async ({ count }: { count: number }) => ({ count }));
export const decorated = source
  .withDisposal(value => { const n: number = value.count; void n; })
  .withRegistrationMetadata({ owner: 'team' as const })
  .withAcquisitionMetadata({ callbackReceives: 'fulfilled-value', describeAcquisition: value => ({ count: value.count }) })
  .withLifetime('singleton:one-per-container-tree', { allowsScopedDependencies: true })
  .withTransformedService({ callbackReceives: 'fulfilled-value', transformService: value => value.count });
type _Output = Assert<Equal<ProviderOutput<typeof decorated>, Promise<number>>>;
type _Acquired = Assert<Equal<ProviderAcquiredValue<typeof decorated>, number>>;
type _Metadata = Assert<Equal<ProviderRegistrationMetadata<typeof decorated>, Readonly<{ owner: 'team' }>>>;
type _Frames = Assert<Equal<ProviderAcquisitionMetadata<typeof decorated>, readonly [Readonly<{ count: number }> ]>>;
type _Lifetime = Assert<Equal<ProviderGraphContract<typeof decorated>['lifetime'], Readonly<{ kind: 'singleton'; allowsScopedDependencies: true }>>>;
const replacement = DiBag.createProvider(() => 2).withDisposal(value => { const n: number = value; void n; });
DiBag.createBuilder().withServices({ value: () => 1 }).withReplacedService('value', replacement);
const mappedReplacement = DiBag.createProvider(() => 2)
  .withTransformedService({ callbackReceives: 'exposed-service', transformService: value => value + 1 });
DiBag.createBuilder().withServices({ value: () => 1 }).withReplacedService('value', mappedReplacement);
const framedReplacement = DiBag.createProvider(() => Promise.resolve(2), { factoryReturnKind: 'native-promise' })
  .withAcquisitionMetadata({ callbackReceives: 'fulfilled-value', describeAcquisition: value => ({ value }) });
DiBag.createBuilder().withServices({ value: () => Promise.resolve(1) }).withReplacedService('value', framedReplacement);
const numberToken = DiBag.createToken(Symbol('number')).forService<number>();
const tokenProvider = DiBag.createProvider(() => 3).withLifetime('transient:one-per-resolve');
DiBag.createBuilder().withTokenService(numberToken, tokenProvider).buildContainer().resolve(numberToken) satisfies number;
```

Create `tests/types/negative/provider-methods.ts`:

```ts
import { DiBag } from '../../../src';
const provider = DiBag.createProvider(async () => 1);
// diagnostic: lifetime requires an individually known policy literal
provider.withLifetime('scoped');
// diagnostic: withLifetime allowsScopedDependencies requires singleton lifetime and a boolean value
provider.withLifetime('scoped:one-per-container', { allowsScopedDependencies: true });
// diagnostic: withLifetime allowsScopedDependencies requires singleton lifetime and a boolean value
provider.withLifetime('singleton:one-per-container-tree', { allowsScopedDependencies: 'yes' });
// diagnostic: Type '"later"' is not assignable to type '"exposed-service" | "fulfilled-value"'
provider.withAcquisitionMetadata({ callbackReceives: 'later', describeAcquisition: value => ({ value }) });
// diagnostic: acquisition metadata must be a synchronous object record
provider.withAcquisitionMetadata({ callbackReceives: 'fulfilled-value', describeAcquisition: async value => ({ value }) });
// diagnostic: Type 'string' is not assignable to type 'never'
provider.withTransformedService({ callbackReceives: 'fulfilled-value', transformService: value => value, transformReturnKind: 'sync-value' });
// diagnostic: native-promise factory return kind requires a Promise output
provider.withTransformedService({ callbackReceives: 'exposed-service', transformService: () => 1, transformReturnKind: 'native-promise' });
// diagnostic: sync-value output must not be a Promise or thenable
provider.withTransformedService({ callbackReceives: 'exposed-service', transformService: () => Promise.resolve(1), transformReturnKind: 'sync-value' });
// diagnostic: factory output is a structural thenable
provider.withTransformedService({ callbackReceives: 'exposed-service', transformService: () => ({ then() {} }) });
// diagnostic: Property 'transformReturnKind' is missing
provider.withTransformedService<() => Promise<number>, 'native-promise'>({ callbackReceives: 'exposed-service', transformService: () => Promise.resolve(1) });
// diagnostic: duplicate metadata keys
provider.withRegistrationMetadata({ owner: 'one' }).withRegistrationMetadata({ owner: 'two' });
const dependent = DiBag.createProvider(({ value }: { value: number }) => value)
  .withTransformedService({ callbackReceives: 'exposed-service', transformService: value => value + 1 });
// diagnostic: not assignable to type 'never'
DiBag.createBuilder().withServices({ value: () => 1 }).withReplacedService('value', dependent);
```

Append `provider-methods` to the declaration loop's fixture list and create `tests/types/provider-methods-consumer.ts` exactly:

```ts
import type { ProviderOutput } from '../../src';
import { decorated } from './provider-methods.js';
import type { Assert, Equal } from './assert';
type _ConsumedOutput = Assert<Equal<Awaited<ProviderOutput<typeof decorated>>, number>>;
```

Add this isolated positive test before the loop:

```ts
test('provider methods retain exact inferred contracts', () => {
  expect(diagnostics(resolve(__dirname, 'types/provider-methods-consumer.ts')).map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});
```

The existing negative loop reads every marker and compares exact file/line/column through `matchDiagnosticMarkers`; do not add a catch-all assertion. Run the serialized `tsc6` lane only when the controller grants it; expected: positive/declaration fixtures clean and each of the twelve diagnostics attached to the immediately following offending property or literal. If TypeScript's actual wording differs, capture it and update the marker without moving it to the call.

Add this provider-specific assertion after the general negative loop so fixture discovery cannot accidentally hide a missing case:

```ts
test('provider method rejections remain twelve property-located diagnostics', () => {
  const path = resolve(negativeDirectory, 'provider-methods.ts');
  const source = readFileSync(path, 'utf8');
  const markers = [...source.matchAll(/\/\/ diagnostic: (.+)/g)];
  const errors = negativeDiagnostics.get(path)!;
  expect(markers).toHaveLength(12);
  expect(errors).toHaveLength(12);
  const matched = matchDiagnosticMarkers(source, path, errors.map(describeDiagnostic));
  expect(matched).toEqual({ missing: [], unexpected: [] });
  const lines = source.split('\n');
  for (const error of errors) {
    const position = error.file!.getLineAndCharacterOfPosition(error.start!);
    expect(lines[position.line]).toMatch(/(withLifetime\(|callbackReceives:|describeAcquisition:|transformReturnKind:|transformService:|withRegistrationMetadata\()/);
  }
});
```

- [ ] **Step 6: Keep the expand work uncommitted until lifetime migration is complete**

Run: `bun test tests/provider-methods.test.ts tests/providers.test.ts tests/disposal.test.ts tests/acquisition-metadata.test.ts`
Expected after Task 2: pass. Before Task 2 these tests are intentionally not a commit boundary; `selectLifetime` and snapshot values are completed next.

---

### Task 2: Rename public lifetime values and lifetime obligations

**Files:**
- Modify: `src/lifetime.ts`, `src/lifetime-types.ts`, `src/provider-operations.ts`, `src/acquisition.ts`, `src/runtime.ts`, `src/inspection.ts`, `src/observers.ts`, `src/module-types.ts`
- Modify: `tests/lifetimes.test.ts`, `tests/modules.test.ts`, `tests/observers.test.ts`, relevant type fixtures
- Create then delete before commit: `scripts/migrate-phase09-lifetime-types.mjs`

**Interfaces:**
- Produces: `Lifetime = 'singleton:one-per-container-tree' | 'scoped:one-per-container' | 'transient:one-per-resolve'`; internal `LifetimePolicy.kind = 'singleton' | 'scoped' | 'transient'`; `LifetimeObligation` member `singleton` and kinds `'singleton' | 'singleton-reach'`.
- Preserves: phase-8 `RenamedExternalObligation` on singleton/export/contribution branches.

- [ ] **Step 1: Add the public/internal mapping and lifetime selector**

```ts
export type Lifetime = 'singleton:one-per-container-tree' | 'scoped:one-per-container' | 'transient:one-per-resolve';
export type LifetimeKind = 'singleton' | 'scoped' | 'transient';
type LegacyLifetime = 'root' | 'scoped' | 'transient';
export interface LifetimePolicy { readonly kind: LifetimeKind; readonly allowsScopedDependencies: boolean }
export const publicLifetime = (kind: LifetimeKind): Lifetime => kind === 'singleton' ? 'singleton:one-per-container-tree' : kind === 'scoped' ? 'scoped:one-per-container' : 'transient:one-per-resolve';

export type LifetimeAdmission<SelectedLifetime> = Singleton<SelectedLifetime> extends true
  ? unknown
  : Unsatisfied<'lifetime requires an individually known policy literal', {}>;
type InvalidLifetimeOptions<SelectedLifetime, Options> = Options extends infer Candidate & {}
  ? Candidate extends unknown
    ? Exclude<keyof Candidate, 'allowsScopedDependencies'> extends never
      ? SelectedLifetime extends 'singleton:one-per-container-tree'
        ? Candidate extends { readonly allowsScopedDependencies?: boolean } ? never : true
        : 'allowsScopedDependencies' extends keyof Candidate ? true : never
      : true
    : never
  : never;
export type LifetimeOptions<SelectedLifetime, Options> = [InvalidLifetimeOptions<SelectedLifetime, Options>] extends [never]
  ? unknown
  : Unsatisfied<'withLifetime allowsScopedDependencies requires singleton lifetime and a boolean value', {}>;
type LifetimeKindOf<SelectedLifetime extends Lifetime> =
  SelectedLifetime extends 'singleton:one-per-container-tree' ? 'singleton'
  : SelectedLifetime extends 'scoped:one-per-container' ? 'scoped'
  : 'transient';
export type LifetimeGraph<Graph extends GraphContract, SelectedLifetime extends Lifetime, Options> = Graph extends infer Candidate & {}
  ? Candidate extends GraphContract
    ? LifetimeKindOf<SelectedLifetime> extends 'scoped'
      ? 'lifetime' extends keyof Candidate ? Omit<Candidate, 'lifetime'> : Candidate
      : Omit<Candidate, 'lifetime'> & { readonly lifetime: {
          readonly kind: LifetimeKindOf<SelectedLifetime>;
          readonly allowsScopedDependencies: [Options] extends [{ readonly allowsScopedDependencies: true }] ? true : false;
        } }
    : never
  : never;

function selectLifetime(provider: ProviderBase, lifetime: unknown, options?: unknown, operation = 'withLifetime'): ProviderBase {
  if (lifetime !== 'singleton:one-per-container-tree' && lifetime !== 'scoped:one-per-container' && lifetime !== 'transient:one-per-resolve') throw libraryTypeError('DI_BAG_INVALID_ARGUMENT', `${operation} lifetime must use a full lifetime value`, { operation, argument: 'lifetime', expected: "one of: 'singleton:one-per-container-tree', 'scoped:one-per-container', 'transient:one-per-resolve'" });
  const bag = options === undefined ? {} : snapshotOptionsBag(options, operation, [], ['allowsScopedDependencies']);
  if (Object.hasOwn(bag, 'allowsScopedDependencies') && lifetime !== 'singleton:one-per-container-tree') throw libraryTypeError('DI_BAG_INVALID_ARGUMENT', `${operation} allowsScopedDependencies is available only for singleton lifetime`, { operation, argument: 'allowsScopedDependencies', expected: "absent unless lifetime is 'singleton:one-per-container-tree'" });
  if (Object.hasOwn(bag, 'allowsScopedDependencies') && typeof bag.allowsScopedDependencies !== 'boolean') throw libraryTypeError('DI_BAG_INVALID_ARGUMENT', `${operation} allowsScopedDependencies must be boolean`, { operation, argument: 'allowsScopedDependencies', expected: 'a boolean' });
  const kind: LifetimeKind = lifetime === 'singleton:one-per-container-tree' ? 'singleton' : lifetime === 'scoped:one-per-container' ? 'scoped' : 'transient';
  const description = describe(provider);
  const handle = createProviderHandle<Factory, object, readonly unknown[], GraphContract, unknown>();
  retainDescription(handle, Object.freeze({ ...description, lifetime: Object.freeze({ kind, allowsScopedDependencies: bag.allowsScopedDependencies === true }) }));
  return handle;
}

/** @internal compatibility used only until Task 6 removes the facade. */
function selectLegacyLifetime(registration: Registration, lifetime: LegacyLifetime, options?: unknown): ProviderBase {
  if (lifetime !== 'root' && lifetime !== 'scoped' && lifetime !== 'transient') throw libraryError('DI_BAG_INVALID_LIFETIME', 'invalid lifetime policy', { operation: 'withLifetime', lifetime });
  if (options !== undefined && (typeof options !== 'object' || options === null || Array.isArray(options))) throw libraryError('DI_BAG_INVALID_LIFETIME', 'invalid lifetime options', { operation: 'withLifetime', lifetime });
  const keys = options === undefined ? [] : Reflect.ownKeys(options);
  if (keys.some(key => key !== 'allowScopedDependencies') || (options !== undefined && 'allowScopedDependencies' in options && !Object.hasOwn(options, 'allowScopedDependencies'))) throw libraryError('DI_BAG_INVALID_LIFETIME', 'invalid lifetime options', { operation: 'withLifetime', lifetime });
  if (keys.length && lifetime !== 'root') throw libraryError('DI_BAG_INVALID_LIFETIME', 'withLifetime allowScopedDependencies requires root lifetime', { operation: 'withLifetime', lifetime });
  const allowed = keys.length ? Reflect.get(options as object, 'allowScopedDependencies') : false;
  if (typeof allowed !== 'boolean') throw libraryError('DI_BAG_INVALID_LIFETIME', 'withLifetime allowScopedDependencies must be boolean', { operation: 'withLifetime', lifetime });
  const translated = lifetime === 'root' ? 'singleton:one-per-container-tree'
    : lifetime === 'scoped' ? 'scoped:one-per-container'
    : 'transient:one-per-resolve';
  const translatedOptions = keys.length ? { allowsScopedDependencies: allowed } : undefined;
  return selectLifetime(compatibilityProvider(registration, 'withLifetime'), translated, translatedOptions);
}
```

Keep the phase-8 facade overloads and use this exact implementation after them:

```ts
export function withLifetime(registration: Registration, lifetime: LegacyLifetime, options?: object): ProviderBase {
  return selectLegacyLifetime(registration, lifetime, options);
}
```

The other three compatibility facades retain their complete phase-8 implementations: `withDisposal` still constructs `FactoryWithDisposal` for a plain function and uses `transform` for an authenticated object; `withMetadata` still snapshots its legacy `{ static, dynamic }` bag and calls the shared metadata primitives; `transformService` still validates `{ mode, transform, acquisitionMode }` before calling `transform`. Do not change their public result types, codes, messages, or option evaluation during expand. Add this focused bridge test to `tests/provider-methods.test.ts` before the combined expand gate:

```ts
test('expand compatibility composes the retained disposal wrapper', async () => {
  const events: number[] = [];
  const owned = DiBag.withDisposal(() => 2, value => { events.push(value); });
  const lifetimed = DiBag.withLifetime(owned, 'root');
  const metadata = DiBag.withMetadata(lifetimed, { static: { legacy: true } });
  const transformed = DiBag.transformService(metadata, { mode: 'direct', transform: value => value + 1 });
  const container = DiBag.createBuilder().withServices({ value: transformed }).buildContainer();
  expect(container.resolve('value')).toBe(3);
  expect(container.serviceSnapshot('value').registrationMetadata).toEqual({ legacy: true });
  await container.close();
  expect(events).toEqual([2]);
});
```

Keep `sourceDescription` default as internal `scoped`; plan 10 flips it. Every snapshot/event producer calls `publicLifetime(description.lifetime.kind)`. No internal comparison uses the long strings.

- [ ] **Step 2: Rewrite the type-level lifetime graph and obligations**

Use internal graph kinds `singleton|scoped|transient`, rename every exported obligation `root` field to `singleton`, every `root-reach` to `singleton-reach`, and obligation policy `'root'` to `'singleton'`. Preserve phase 8's helper with this exact branch:

```ts
export type RenamedExternalObligation<Obligation, Current extends string, New extends string> =
  Obligation extends { readonly kind: 'export-reach'; readonly export: infer Export; readonly reach: infer Target }
    ? { readonly kind: 'export-reach'; readonly export: Export; readonly reach: RenamedExternalReach<Target, Current, New> }
  : Obligation extends { readonly kind: 'singleton-reach'; readonly singleton: infer Singleton; readonly reach: infer Target }
    ? { readonly kind: 'singleton-reach'; readonly singleton: Singleton; readonly reach: RenamedExternalReach<Target, Current, New> }
  : Obligation extends { readonly kind: 'contribution-reach'; readonly group: infer Group; readonly policy: infer Policy; readonly reach: infer Target }
    ? { readonly kind: 'contribution-reach'; readonly group: Group; readonly policy: Policy; readonly reach: RenamedExternalReach<Target, Current, New> }
  : Obligation;
```

Apply the same singleton branch to `RenamedObligation`, retained obligations, host walks, and selected-child checks. Runtime `DI_BAG_LIFETIME_DEPENDENCY` details become `{ consumer, dependency, lifetime: 'singleton:one-per-container-tree' }`, but its code and old `root lifetime cannot capture scoped dependency` message remain until plan 12 Task 12. Compile-time `Unsatisfied` text, `SeeErrors<'root-capture'>`, docs heading, `familyIds`, inbound links, and their assertions also remain unchanged for that task.

Create and run this one-use migration script so no host/child walk is left on the old discriminants:

```js
import { readFileSync, writeFileSync } from 'node:fs';
const files = ['src/lifetime-types.ts', 'src/module-types.ts', 'src/acquisition.ts'];
const replacements = [
  ["readonly kind: 'root-reach'; readonly root:", "readonly kind: 'singleton-reach'; readonly singleton:"],
  ["readonly policy: 'root' | 'transient'", "readonly policy: 'singleton' | 'transient'"],
  ["{ readonly kind: 'root-reach'; readonly root:", "{ readonly kind: 'singleton-reach'; readonly singleton:"],
  ["{ readonly kind: 'root' }", "{ readonly kind: 'singleton' }"],
  ["{ readonly kind: 'root'; readonly allowScopedDependencies:", "{ readonly kind: 'singleton'; readonly allowsScopedDependencies:"],
  [".allowScopedDependencies", ".allowsScopedDependencies"],
  ["? 'root'", "? 'singleton'"],
  ["policy: 'root'", "policy: 'singleton'"],
  ["readonly policy: 'root'", "readonly policy: 'singleton'"],
  ["kind !== 'root'", "kind !== 'singleton'"],
  ["kind === 'root'", "kind === 'singleton'"],
];
let total = 0;
for (const file of files) {
  let source = readFileSync(file, 'utf8');
  for (const [from, to] of replacements) {
    const count = source.split(from).length - 1;
    if (count) { source = source.replaceAll(from, to); total += count; }
  }
  writeFileSync(file, source);
}
if (total < 20) throw new Error(`expected at least 20 lifetime discriminant replacements, saw ${total}`);
```

Then replace the exported obligation constructors, not just their consumers, with:

```ts
export type LifetimeObligation =
  | { readonly kind: 'singleton-reach'; readonly singleton: PropertyKey; readonly reach: Reach }
  | { readonly kind: 'export-reach'; readonly export: PropertyKey; readonly reach: Reach }
  | { readonly kind: 'contribution-reach'; readonly group: symbol; readonly policy: 'singleton' | 'transient'; readonly reach: Reach };
type AsSingleton<SingletonKey, Target> = Target extends Reach ? { readonly kind: 'singleton-reach'; readonly singleton: SingletonKey; readonly reach: Target } : never;
```

Rename `AsRoot` to `AsSingleton`, `PrivateRoots` to `PrivateSingletons`, `RetainedRoots` to `RetainedSingletons`, `RootCaptives` to `SingletonCaptives`, and `ContributionRootCaptives` to `ContributionSingletonCaptives`, updating every reference. Preserve the diagnostic template's literal word `root`. Delete the one-use script after `rg` proves no old discriminant/member remains.

Make public translation explicit at both producers:

```text
// src/runtime.ts binding snapshot
lifetime: publicLifetime(description.lifetime.kind),
// src/acquisition.ts event fields
lifetime: publicLifetime(description.lifetime.kind),
```

Every cache/owner/host walk compares internal `singleton|scoped|transient`; no public full string is used in a hot-path comparison. `sourceDescription` remains `{ kind: 'scoped', allowsScopedDependencies: false }`; plan 11 changes only the default kind.

- [ ] **Step 3: Pin the deferred message family while changing its surrounding types**

Run `rg -n "root lifetime cannot capture scoped|root-capture|SeeErrors<'root-capture'>" src tests AGENTS.md docs tools` before and after the type migration and compare the hit set. Expected: obligation field/type occurrences change, while every diagnostic string, anchor, `SeeErrors`, `familyIds`, inbound link, and assertion is byte-identical. Do not opportunistically add `portable-factory-output`; plan 12 owns the anchor-list edit.

- [ ] **Step 4: Prove lifetime runtime behavior**

Append:

```ts
test('full lifetime values drive caches, snapshots, events, and diagnostics', async () => {
  let singleton = 0, scoped = 0, transient = 0;
  const events: string[] = [];
  const observed = DiBag.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent(event) { if ('lifetime' in event) events.push(event.lifetime); }, onObserverFailure() {} }] });
  const root = observed.createBuilder().withServices({
    singleton: DiBag.createProvider(() => ++singleton).withLifetime('singleton:one-per-container-tree'),
    scoped: DiBag.createProvider(() => ++scoped).withLifetime('scoped:one-per-container'),
    transient: DiBag.createProvider(() => ++transient).withLifetime('transient:one-per-resolve'),
  }).buildContainer();
  expect(root.resolve('singleton')).toBe(root.resolve('singleton'));
  expect(root.resolve('scoped')).toBe(root.resolve('scoped'));
  expect(root.resolve('transient')).not.toBe(root.resolve('transient'));
  const child = root.createChildContainer();
  expect(child.resolve('singleton')).toBe(root.resolve('singleton'));
  expect(child.resolve('scoped')).not.toBe(root.resolve('scoped'));
  expect(root.graphSnapshot().bindings.map(binding => binding.lifetime)).toEqual(['singleton:one-per-container-tree', 'scoped:one-per-container', 'transient:one-per-resolve']);
  await child.close(); await root.close();
  await Promise.resolve();
  expect(events.length).toBeGreaterThan(0);
  expect(events.every(value => value.includes(':one-per-'))).toBe(true);
});
```

Run: `bun test tests/provider-methods.test.ts tests/lifetimes.test.ts tests/observers.test.ts tests/modules.test.ts`
Expected: pass. Before committing, add the complete new-method JSDoc from Task 4 Step 3 and migrate existing short lifetime snapshot/event assertions to full values. Keep the four compatibility `DiBagApi` decorator members and their checked API-card rows public through this expand commit, so `docs:check` sees a complete documented surface. Task 4 performs the atomic documentation switch after source migration. Regenerate the reference and run:

For the preferred method shape, append this exact group to `surfaceGroups` in `tools/docs/lib/api-card.mjs` before generating docs:

```js
surfaceGroups.push({ name: 'Provider', receiver: 'provider', title: 'Provider' });
```

Add a focused API-card test that `runtimeSurface(project)` contains all five `provider.*` calls and that every corresponding task resolves to the `Provider` group. Preserve the existing DiBagApi, Builder, and renamed Container groups. If S2 later selects the facade fallback, remove only this Provider group and replace its five tasks with the `DiBag.providerWith*` rows; those fallback calls resolve through the existing DiBagApi group.

```bash
bun test tests/provider-methods.test.ts tests/providers.test.ts tests/disposal.test.ts tests/acquisition-metadata.test.ts tests/lifetimes.test.ts tests/observers.test.ts tests/modules.test.ts
npm run docs:check
npm run graph:check
```

Expected: all pass. Before this commit, complete Task 5 Step 1, run its parse-only/name-preservation unit assertion, and stage `tests/compiler.ts` plus `scripts/check-provider-method-scale.ts` with the expand sources. The serialized compiler lane must also pass before this commit; controller permission for one `tsc6` run does not authorize evidence. Stage only the listed source/tests/docs/worker files, then commit:

```text
feat(provider): add provider methods and full lifetimes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
```

---

### Task 3: Implement the source-aware decorator codemod

**Files:**
- Modify: `tools/codemod/rename-map.json`, `tools/codemod/lib/transforms/index.mjs`, `tools/codemod/test/transforms.test.mjs`, `tools/codemod/test/rename-map.test.mjs`
- Create: `tools/codemod/lib/transforms/provider-methods.mjs`
- Create: `tools/codemod/test/fixtures/provider-methods/{input.ts,expected.ts,expected-manual.json}`

**Interfaces:**
- Consumes: original-program checker, `api.assemble`, `api.manual`, `api.nameOf`, phase-7 `api.nameForRole`.
- Produces: nested decorator chains using original argument types; no fake declaration owners.

- [ ] **Step 1: Merge exact map entries without resetting accumulated arrays**

```json
{
  "methods": [
    { "owner": "DiBagApi", "from": "withDisposal", "to": "withDisposal", "transform": "provider-methods", "transformNames": { "disposeService": "disposeService" } },
    { "owner": "DiBagApi", "from": "withLifetime", "to": "withLifetime", "transform": "provider-methods", "transformNames": { "allowsScopedDependencies": "allowsScopedDependencies" } },
    { "owner": "DiBagApi", "from": "withMetadata", "to": "withRegistrationMetadata", "transform": "provider-methods", "transformNames": { "acquisitionMethod": "withAcquisitionMetadata", "registrationMetadata": "registrationMetadata", "describeAcquisition": "describeAcquisition", "callbackReceives": "callbackReceives" } },
    { "owner": "DiBagApi", "from": "transformService", "to": "withTransformedService", "transform": "provider-methods", "transformNames": { "transformService": "transformService", "callbackReceives": "callbackReceives", "transformReturnKind": "transformReturnKind" } }
  ],
  "options": [
    { "owner": "DiBagApi", "method": "withLifetime", "argument": 2, "from": "allowScopedDependencies", "to": "allowsScopedDependencies" },
    { "owner": "DiBagApi", "method": "transformService", "argument": 1, "from": "acquisitionMode", "to": "transformReturnKind" }
  ],
  "values": [
    { "owner": "DiBagApi", "method": "withLifetime", "argument": 1, "from": "root", "to": "singleton:one-per-container-tree" },
    { "owner": "DiBagApi", "method": "withLifetime", "argument": 1, "from": "scoped", "to": "scoped:one-per-container" },
    { "owner": "DiBagApi", "method": "withLifetime", "argument": 1, "from": "transient", "to": "transient:one-per-resolve" },
    { "owner": "BindingSnapshot", "property": "lifetime", "from": "root", "to": "singleton:one-per-container-tree" },
    { "owner": "BindingSnapshot", "property": "lifetime", "from": "scoped", "to": "scoped:one-per-container" },
    { "owner": "BindingSnapshot", "property": "lifetime", "from": "transient", "to": "transient:one-per-resolve" },
    { "owner": "AcquisitionEventFields", "property": "lifetime", "from": "root", "to": "singleton:one-per-container-tree" },
    { "owner": "AcquisitionEventFields", "property": "lifetime", "from": "scoped", "to": "scoped:one-per-container" },
    { "owner": "AcquisitionEventFields", "property": "lifetime", "from": "transient", "to": "transient:one-per-resolve" }
  ],
  "types": [{ "from": "Registration", "to": "ProviderOrFactory" }, { "from": "FactoryWithDisposal", "to": "Provider" }],
  "properties": [{ "owner": "LifetimeObligation", "from": "root", "to": "singleton" }]
}
```

`FactoryWithDisposal<Factory>` maps exactly to `Provider<Factory>` because `Provider` defaults registration metadata, frames, graph contract, and acquired value to the same contracts. Add a transform test proving a declaration annotation preserves its factory output and dependency parameter after this simple phase-1 type rename; no unsupported `manual` field is invented.

- [ ] **Step 2: Implement the complete transform**

Create `provider-methods.mjs`:

```js
export function originalKind(node, api) {
  const type = api.checker.getTypeAtLocation(node);
  if (type.flags & (api.ts.TypeFlags.Any | api.ts.TypeFlags.Unknown | api.ts.TypeFlags.TypeParameter)) return 'manual';
  const members = type.isUnion() ? type.types : [type];
  const kinds = members.map(member => {
    if (api.checker.getSignaturesOfType(member, api.ts.SignatureKind.Call).length > 0) return 'factory';
    const unresolved = member.aliasSymbol ?? member.getSymbol();
    const symbol = unresolved?.flags & api.ts.SymbolFlags.Alias ? api.checker.getAliasedSymbol(unresolved) : unresolved;
    const bases = member.getBaseTypes?.() ?? [];
    const authentic = candidate => candidate?.declarations?.some(declaration => api.library.isLibraryFile(declaration.getSourceFile().fileName));
    if (authentic(symbol) && (symbol?.name === 'FactoryWithDisposal' || symbol?.name === 'Provider' || symbol?.name === 'ProviderBase')) return 'provider';
    if (bases.some(base => { const unresolvedBase = base.aliasSymbol ?? base.getSymbol(); const baseSymbol = unresolvedBase?.flags & api.ts.SymbolFlags.Alias ? api.checker.getAliasedSymbol(unresolvedBase) : unresolvedBase; return authentic(baseSymbol) && baseSymbol?.name === 'ProviderBase'; })) return 'provider';
    return 'invalid';
  });
  return kinds.every(kind => kind === 'factory') ? 'factory'
    : kinds.every(kind => kind === 'provider') ? 'provider'
    : 'manual';
}
export const text = (node, api) => api.text(node);
export const textWithTrivia = (node, api) => `${api.slice(node.pos, api.start(node))}${api.text(node)}`;
const prop = (property, api) => (api.ts.isPropertyAssignment(property) || api.ts.isShorthandPropertyAssignment(property)) && !api.ts.isComputedPropertyName(property.name) ? property.name.text : undefined;
export function literalBag(node, allowed, call, reason, api) {
  if (!api.ts.isObjectLiteralExpression(node) || node.properties.some(item => api.ts.isSpreadAssignment(item) || api.ts.isMethodDeclaration(item) || api.ts.isGetAccessorDeclaration(item) || api.ts.isSetAccessorDeclaration(item) || prop(item, api) === undefined || !allowed.has(prop(item, api)))) { api.manual(call, reason); return undefined; }
  const names = node.properties.map(item => prop(item, api));
  if (new Set(names).size !== names.length || /\/\*|\/\//.test(api.slice(api.start(node), node.end))) { api.manual(call, `${reason}; duplicate keys and comments require a hand rewrite`); return undefined; }
  return new Map(node.properties.map(item => [prop(item, api), item]));
}
export function valueOf(map, name, api) { const item = map.get(name); return item && api.ts.isShorthandPropertyAssignment(item) ? text(item.name, api) : item && api.ts.isPropertyAssignment(item) ? textWithTrivia(item.initializer, api).trimStart() : undefined; }
export function nodeOf(map, name, api) { const item = map.get(name); return item && api.ts.isShorthandPropertyAssignment(item) ? item.name : item && api.ts.isPropertyAssignment(item) ? item.initializer : undefined; }
export function renamedLiteral(node, values, call, reason, api) {
  if (!node || (!api.ts.isStringLiteral(node) && !api.ts.isNoSubstitutionTemplateLiteral(node))) { api.manual(call, reason); return undefined; }
  return api.quote(node, values.get(node.text) ?? node.text);
}
export function lifetimeOptions(node, call, api) {
  if (node === undefined) return undefined;
  const bag = literalBag(node, new Set(['allowScopedDependencies']), call, 'the withLifetime options are not a supported object literal; rewrite the provider chain by hand', api); if (bag === undefined) return null;
  const item = bag.get('allowScopedDependencies');
  if (item === undefined) return text(node, api);
  if (api.ts.isShorthandPropertyAssignment(item)) return api.assemble(node, [{ start: api.start(item), end: item.end, text: `${api.nameForRole('allowsScopedDependencies')}: ${text(item.name, api)}` }]);
  return api.assemble(node, [{ start: api.start(item.name), end: item.name.end, text: api.nameForRole('allowsScopedDependencies') }]);
}
function method(receiver, oldName, args, api) { return `(${receiver}).${api.nameOf('DiBagApi', oldName)}(${args.join(', ')})`; }
function receiverFor(call, api) {
  const registration = call.arguments[0];
  const kind = originalKind(registration, api);
  if (kind === 'manual') { api.manual(call, 'the decorated value is any, unknown, invalid, or a factory/provider union; wrap a factory with createProvider or supply a provider by hand'); return undefined; }
  const source = text(registration, api);
  if (kind === 'provider') return source;
  const facade = text(call.expression.expression, api);
  return `${facade}.${api.nameOf('DiBagApi', 'fromFactory')}(${source})`;
}
export default function providerMethods(call, api) {
  const oldName = call.expression.name.text;
  const receiver = receiverFor(call, api); if (receiver === undefined) return undefined;
  if (oldName === 'withDisposal') return method(receiver, oldName, [textWithTrivia(call.arguments[1], api).trimStart()], api);
  if (oldName === 'withLifetime') {
    const lifetime = renamedLiteral(call.arguments[1], new Map([['root', 'singleton:one-per-container-tree'], ['scoped', 'scoped:one-per-container'], ['transient', 'transient:one-per-resolve']]), call, 'withLifetime uses a nonliteral lifetime; rewrite it to a full lifetime value by hand', api);
    if (lifetime === undefined) return undefined;
    const options = lifetimeOptions(call.arguments[2], call, api); if (options === null) return undefined;
    return method(receiver, oldName, options === undefined ? [lifetime] : [lifetime, options], api);
  }
  const allowed = oldName === 'transformService' ? new Set(['mode', 'transform', 'acquisitionMode']) : new Set(['static', 'dynamic']);
  const options = literalBag(call.arguments[1], allowed, call, `the ${oldName} options are not a supported object literal; rewrite the provider chain by hand`, api);
  if (options === undefined) return undefined;
  if (oldName === 'transformService') {
    const callback = valueOf(options, 'transform', api);
    const receives = renamedLiteral(nodeOf(options, 'mode', api), new Map([['direct', 'exposed-service'], ['awaited', 'fulfilled-value']]), call, 'transformService mode is nonliteral; choose callbackReceives by hand', api);
    const returnNode = nodeOf(options, 'acquisitionMode', api);
    const returnKind = returnNode === undefined ? undefined : renamedLiteral(returnNode, new Map([['auto', 'auto-detect'], ['raw', 'uninspected'], ['nativePromise', 'native-promise']]), call, 'transformService acquisitionMode is nonliteral; choose transformReturnKind by hand', api);
    if (callback === undefined || receives === undefined || (returnNode !== undefined && returnKind === undefined)) { if (callback === undefined) api.manual(call, 'transformService options must contain transform and mode; rewrite the provider chain by hand'); return undefined; }
    const fields = [`${api.nameForRole('transformService')}: ${callback}`, `${api.nameForRole('callbackReceives')}: ${receives}`];
    if (returnKind !== undefined) fields.push(`${api.nameForRole('transformReturnKind')}: ${returnKind}`);
    return method(receiver, oldName, [`{ ${fields.join(', ')} }`], api);
  }
  const staticValue = valueOf(options, 'static', api), dynamicNode = options.get('dynamic');
  if (staticValue !== undefined && dynamicNode !== undefined) {
    api.manual(call, 'combined static and dynamic metadata can change evaluation order when split; rewrite the two provider methods by hand');
    return undefined;
  }
  let result = receiver;
  if (staticValue !== undefined) result = method(result, oldName, [staticValue], api);
  if (dynamicNode !== undefined && !api.ts.isPropertyAssignment(dynamicNode)) { api.manual(call, 'withMetadata shorthand dynamic options are opaque; rewrite the provider chain by hand'); return undefined; }
  if (dynamicNode !== undefined && api.ts.isPropertyAssignment(dynamicNode)) {
    const dynamic = literalBag(dynamicNode.initializer, new Set(['mode', 'describe']), call, 'withMetadata dynamic options are not a supported object literal; rewrite the provider chain by hand', api); if (dynamic === undefined) return undefined;
    const describe = valueOf(dynamic, 'describe', api);
    const mode = renamedLiteral(nodeOf(dynamic, 'mode', api), new Map([['direct', 'exposed-service'], ['awaited', 'fulfilled-value']]), call, 'withMetadata dynamic mode is nonliteral; choose callbackReceives by hand', api);
    if (describe === undefined || mode === undefined) { api.manual(call, 'withMetadata dynamic options must contain describe and mode; rewrite the provider chain by hand'); return undefined; }
    result = `(${result}).${api.nameForRole('acquisitionMethod')}({ ${api.nameForRole('describeAcquisition')}: ${describe}, ${api.nameForRole('callbackReceives')}: ${mode} })`;
  }
  if (staticValue === undefined && dynamicNode === undefined) { api.manual(call, 'withMetadata has neither static nor dynamic metadata; rewrite the provider chain by hand'); return undefined; }
  return result;
}
```

In phase 7's transform API, preserve the complete `{ ts, checker, program, library, sourceFile, member, text, slice, start, assemble, objectLiteral, quote, manual, nameOf, nameForRole }` surface while adding the selected method entry. `api.text(node)` recursively incorporates child transforms but deliberately omits leading trivia; use `textWithTrivia` for moved arguments. Raw source slices alone would lose nested transforms. `api.nameOf('DiBagApi','fromFactory')` resolves to phase-8 `createProvider`, and method lookups resolve final names. Preserve the exact facade expression for factory wrapping and every earlier transform registry id, including collection transforms. The transform automatically handles static-only or dynamic-only metadata; it reports combined metadata, duplicate keys, and comments inside reconstructed option bags for manual migration because splitting those forms can change evaluation or trivia.

- [ ] **Step 3: Create exact golden fixtures**

`input.ts`:

```ts
import { DiBag, type Registration, type FactoryWithDisposal, type BindingSnapshot } from 'di-bag';
const f = () => Promise.resolve(1);
const p = DiBag.fromFactory(f, { acquisitionMode: 'nativePromise' });
const derived = DiBag.withConfiguration({ runtime: { isNativePromise: Promise.resolve.bind(Promise) as any } });
export const owned = DiBag.withDisposal(f, value => void value);
export const nested = DiBag.withLifetime(DiBag.withDisposal(f, value => void value), 'root', { allowScopedDependencies: true });
export const metadata = DiBag.withMetadata(p, { static: { owner: 'team' }, dynamic: { mode: 'awaited', describe: value => ({ value }) } });
export const transformed = DiBag.transformService(p, { mode: 'direct', transform: value => value, acquisitionMode: 'nativePromise' });
export const configured = derived.withDisposal(f, value => void value);
const options = { mode: 'direct', transform: (value: unknown) => value } as const;
export const manualOptions = DiBag.transformService(p, options);
declare const mixed: Registration;
export const manualUnion = DiBag.withDisposal(mixed, () => {});
declare const snapshot: BindingSnapshot;
export const shortComparison = snapshot.lifetime === 'root' || snapshot.lifetime === 'scoped' || snapshot.lifetime === 'transient';
export type OldOwned = FactoryWithDisposal<typeof f>;
```

`expected.ts`:

```ts
import { DiBag, type ProviderOrFactory, type Provider, type BindingSnapshot } from 'di-bag';
const f = () => Promise.resolve(1);
const p = DiBag.createProvider(f, { factoryReturnKind: 'native-promise' });
const derived = DiBag.withConfiguration({ runtime: { isNativePromise: Promise.resolve.bind(Promise) as any } });
export const owned = (DiBag.createProvider(f)).withDisposal(value => void value);
export const nested = ((DiBag.createProvider(f)).withDisposal(value => void value)).withLifetime('singleton:one-per-container-tree', { allowsScopedDependencies: true });
export const metadata = DiBag.withMetadata(p, { static: { owner: 'team' }, dynamic: { mode: 'awaited', describe: value => ({ value }) } });
export const transformed = (p).withTransformedService({ transformService: value => value, callbackReceives: 'exposed-service', transformReturnKind: 'native-promise' });
export const configured = (derived.createProvider(f)).withDisposal(value => void value);
const options = { mode: 'direct', transform: (value: unknown) => value } as const;
export const manualOptions = DiBag.transformService(p, options);
declare const mixed: ProviderOrFactory;
export const manualUnion = DiBag.withDisposal(mixed, () => {});
declare const snapshot: BindingSnapshot;
export const shortComparison = snapshot.lifetime === 'singleton:one-per-container-tree' || snapshot.lifetime === 'scoped:one-per-container' || snapshot.lifetime === 'transient:one-per-resolve';
export type OldOwned = Provider<typeof f>;
```

`expected-manual.json`:

```json
[
  { "line": 7, "reason": "combined static and dynamic metadata can change evaluation order when split; rewrite the two provider methods by hand" },
  { "line": 11, "reason": "the transformService options are not a supported object literal; rewrite the provider chain by hand" },
  { "line": 13, "reason": "the decorated value is any, unknown, invalid, or a factory/provider union; wrap a factory with createProvider or supply a provider by hand" }
]
```

The removed `FactoryWithDisposal` annotation is migrated to its exact `Provider<typeof f>` equivalent. Combined metadata remains unchanged and is reported because an automatic split cannot preserve all evaluation and throwing order. Update line numbers from `nl -ba` if formatting changes; the golden harness compares the projection `result.manual.map(({ line, reason }) => ({ line, reason }))`, while a separate assertion verifies every raw record has `{ file, line, column, reason, text }`.

Add a second discoverable fixture directory `tools/codemod/test/fixtures/provider-method-edges/` with this `input.ts` (do not place a second `*-input.ts` beside the main fixture; the golden harness discovers directories containing the exact name `input.ts`):

```ts
import { DiBag, type FactoryWithDisposal } from 'di-bag';
const p = DiBag.fromFactory(() => 1);
const describe = (value: number) => ({ value });
export const staticOnly = DiBag.withMetadata(p, { static: { owner: 'team' } });
export const dynamicOnly = DiBag.withMetadata(p, { dynamic: { mode: 'direct', describe } });
declare const condition: boolean;
export const conditional = DiBag.withDisposal((condition ? p : p), /* keep */ () => {});
declare const wrapped: FactoryWithDisposal<() => number>;
export const wrappedOwned = DiBag.withLifetime(wrapped, 'transient');
declare const opaqueAny: any;
export const manualAny = DiBag.withDisposal(opaqueAny, () => {});
declare const opaqueUnknown: unknown;
export const manualUnknown = DiBag.withDisposal(opaqueUnknown, () => {});
export const unsafeSpread = DiBag.withMetadata(p, { static: {}, ...({} as object) });
export const duplicate = DiBag.transformService(p, { mode: 'direct', mode: 'awaited', transform: value => value });
export const commentedBag = DiBag.transformService(p, { mode: 'direct', /* preserve */ transform: value => value });
const allowScopedDependencies = true;
export const shorthandLifetime = DiBag.withLifetime(p, 'root', { allowScopedDependencies });
```

Its exact `expected.ts` is:

```ts
import { DiBag, type Provider } from 'di-bag';
const p = DiBag.createProvider(() => 1);
const describe = (value: number) => ({ value });
export const staticOnly = (p).withRegistrationMetadata({ owner: 'team' });
export const dynamicOnly = (p).withAcquisitionMetadata({ describeAcquisition: describe, callbackReceives: 'exposed-service' });
declare const condition: boolean;
export const conditional = ((condition ? p : p)).withDisposal(/* keep */ () => {});
declare const wrapped: Provider<() => number>;
export const wrappedOwned = (wrapped).withLifetime('transient:one-per-resolve');
declare const opaqueAny: any;
export const manualAny = DiBag.withDisposal(opaqueAny, () => {});
declare const opaqueUnknown: unknown;
export const manualUnknown = DiBag.withDisposal(opaqueUnknown, () => {});
export const unsafeSpread = DiBag.withMetadata(p, { static: {}, ...({} as object) });
export const duplicate = DiBag.transformService(p, { mode: 'direct', mode: 'awaited', transform: value => value });
export const commentedBag = DiBag.transformService(p, { mode: 'direct', /* preserve */ transform: value => value });
const allowScopedDependencies = true;
export const shorthandLifetime = (p).withLifetime('singleton:one-per-container-tree', { allowsScopedDependencies: allowScopedDependencies });
```

Its exact `expected-manual.json` is:

```json
[
  { "line": 11, "reason": "the decorated value is any, unknown, invalid, or a factory/provider union; wrap a factory with createProvider or supply a provider by hand" },
  { "line": 13, "reason": "the decorated value is any, unknown, invalid, or a factory/provider union; wrap a factory with createProvider or supply a provider by hand" },
  { "line": 14, "reason": "the withMetadata options are not a supported object literal; rewrite the provider chain by hand" },
  { "line": 15, "reason": "the transformService options are not a supported object literal; rewrite the provider chain by hand; duplicate keys and comments require a hand rewrite" },
  { "line": 16, "reason": "the transformService options are not a supported object literal; rewrite the provider chain by hand; duplicate keys and comments require a hand rewrite" }
]
```

These fixtures make the safety rule executable: property assignments and callback shorthand are supported; moved disposal comments survive through `textWithTrivia`; lifetime shorthand becomes an explicit renamed key with the original value identifier; every preferred receiver is parenthesized. Spreads, accessors, methods, computed/unknown keys, duplicate keys, comments inside reconstructed bags, combined metadata, nonliteral option bags, `any`, `unknown`, type parameters, and mixed factory/provider unions are unchanged and manually reported. The ordinary golden harness now discovers and checks both directories.

- [ ] **Step 4: Test mapped-role and nested composition paths**

Append this test, retaining all accumulated registry ids in `expectedTransformIds` rather than replacing the array:

```js
test('provider methods use original types, mapped names, and transformed children', () => {
  const shipped = JSON.parse(readFileSync(defaultMapFile, 'utf8'));
  const renamed = {
    ...shipped,
    methods: shipped.methods.map(entry => entry.transform === 'provider-methods' ? {
      ...entry,
      to: ({ withDisposal: 'disposeUsing', withLifetime: 'cacheUsing', withMetadata: 'describeUsing', transformService: 'mapUsing' })[entry.from],
      transformNames: Object.fromEntries(Object.entries(entry.transformNames).map(([role, value]) => [role, `mapped${value[0].toUpperCase()}${value.slice(1)}`])),
    } : entry).map(entry => entry.owner === 'DiBagApi' && entry.from === 'fromFactory' ? { ...entry, to: 'makeProvider' } : entry),
  };
  const result = runCodemod({ typescript: compiler.ts, root: fixturesRoot, program: fixturesProgram(), map: renamed, only: ['provider-methods/input.ts'] });
  const output = result.files[0].text;
  assert.match(output, /\(derived\.makeProvider\(f\)\)\.disposeUsing/);
  assert.match(output, /\(\(DiBag\.makeProvider\(f\)\)\.disposeUsing[^\n]+\)\.cacheUsing/);
  assert.match(output, /mappedTransformReturnKind/);
  assert.equal(compiler.ts.createSourceFile('output.ts', output, compiler.ts.ScriptTarget.Latest, true, compiler.ts.ScriptKind.TS).parseDiagnostics.length, 0);
  assert.deepEqual(result.manual.map(({ file, line, reason }) => ({ file, line, reason })), [
    { file: 'provider-methods/input.ts', line: 7, reason: 'combined static and dynamic metadata can change evaluation order when split; rewrite the two provider methods by hand' },
    { file: 'provider-methods/input.ts', line: 11, reason: 'the transformService options are not a supported object literal; rewrite the provider chain by hand' },
    { file: 'provider-methods/input.ts', line: 13, reason: 'the decorated value is any, unknown, invalid, or a factory/provider union; wrap a factory with createProvider or supply a provider by hand' },
  ]);
  assert.ok(result.manual.every(item => Number.isInteger(item.column) && typeof item.text === 'string'));
  const edges = runCodemod({ typescript: compiler.ts, root: fixturesRoot, program: fixturesProgram(), map: renamed, only: ['provider-method-edges/input.ts'] });
  assert.match(edges.files[0].text, /mappedDescribeAcquisition/);
  assert.match(edges.files[0].text, /allowsScopedDependencies: allowScopedDependencies/);
  assert.match(edges.files[0].text, /\/\* keep \*\//);
  assert.equal(compiler.ts.createSourceFile('edges.ts', edges.files[0].text, compiler.ts.ScriptTarget.Latest, true, compiler.ts.ScriptKind.TS).parseDiagnostics.length, 0);
});
```

Run the same golden/manual harness over both fixture pairs. Update registry, pack, schema, and allowed-transform tests by appending `'provider-methods'` to their existing expected ids; never replace the accumulated arrays.

Planning probe evidence is archived at `/tmp/di-bag-resume-20260921/probe-10/probe-provider-codemod.mjs` with its real 0.4 source fixture. It ran `node probe-provider-codemod.mjs` against TypeScript 6.0.3 and classified: factory `f`; provider `FactoryWithDisposal`, `Provider`, and parenthesized conditional provider; manual `Registration` union. The executor still runs the shipped transform test above because the planning probe measures checker categories, not final text assembly.

Run: `node --test tools/codemod/test/rename-map.test.mjs tools/codemod/test/transforms.test.mjs`
Expected: pass. This task runs first after Task 0, on the untouched phase-8 tree. Stage exactly `tools/codemod/rename-map.json tools/codemod/lib/transforms/provider-methods.mjs tools/codemod/lib/transforms/index.mjs tools/codemod/test/fixtures/provider-methods tools/codemod/test/transforms.test.mjs tools/codemod/test/rename-map.test.mjs tools/codemod/test/pack.test.mjs`, then commit:

```text
feat(codemod): migrate decorators to provider methods

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
```

---

### Task 4: Migrate runtime tests, graph extraction, examples, and agent assets

**Files:**
- Modify: all inventory hits under `tests`, `examples`, `scripts/agent-eval`, `tools/graph`, `AGENTS.md`, `docs/agent`, docs tests/tasks

**Interfaces:**
- Consumes: adopted provider chain and full lifetime vocabulary.
- Produces: no old decorators or short public lifetime values outside codemod inputs/migration tests.

- [ ] **Step 1: Run the codemod and inspect every manual row**

```bash
npm run build
node tools/codemod/cli.mjs --project tsconfig.json --library-root src --library-root dist --extra-files 'tests/types/negative/*.ts' --write --report /tmp/phase-09-codemod-report.json
node tools/codemod/cli.mjs --project scripts/agent-eval/tsconfig.json --library-root src --library-root dist --write --report /tmp/phase-09-agent-report.json
rg -l "DiBag\.(withDisposal|withLifetime|withMetadata|transformService)|allowScopedDependencies|'root'|'scoped'|'transient'" tests examples scripts/agent-eval tools/graph AGENTS.md docs/agent > /tmp/phase-09-provider-assets.txt
node tools/codemod/cli.mjs --project tsconfig.json --library-root src --library-root dist --extra-files 'tests/**/*.ts,examples/**/*.ts,scripts/agent-eval/**/*.ts' --write --report /tmp/phase-09-assets-report.json
```

Expected: automatic decorator chains, option names and values migrate. Resolve every row in all three reports and check each file from `/tmp/phase-09-provider-assets.txt`. Markdown is deliberately outside the compiler codemod: replace only fenced TypeScript calls and the exact prose/API-card strings printed below. For string-source generators, update the emitted TypeScript template itself and run its existing snapshot test; do not postprocess generated strings. Resolve each manual row by the same original-type rule; never bulk-replace unrelated `root`, `mode`, or `direct` text.

- [ ] **Step 2: Update graph extraction with dual-version recognition**

Keep old wrapper names for analyzing 0.4 input and add final method names. Walk property-access call chains, collect `withLifetime` regardless of facade/method form, and map all six values:

```js
const LIFETIMES = new Map([
  ['root', 'singleton:one-per-container-tree'], ['scoped', 'scoped:one-per-container'], ['transient', 'transient:one-per-resolve'],
  ['singleton:one-per-container-tree', 'singleton:one-per-container-tree'], ['scoped:one-per-container', 'scoped:one-per-container'], ['transient:one-per-resolve', 'transient:one-per-resolve'],
]);
const PROVIDER_METHODS = new Set(['withDisposal', 'withLifetime', 'withRegistrationMetadata', 'withAcquisitionMetadata', 'withTransformedService']);

function literalLifetime(expression) {
  return expression && ts.isStringLiteralLike(expression) ? LIFETIMES.get(expression.text) : undefined;
}

function diBagDeclarationOwners(sourceFile, checker) {
  const owners = new Set();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    if (specifier !== 'di-bag' && specifier !== 'di-bag/node' && !specifier.endsWith('/provider-sources-0-4-library.js')) continue;
    let moduleSymbol = checker.getSymbolAtLocation(statement.moduleSpecifier);
    if (moduleSymbol?.flags & ts.SymbolFlags.Alias) moduleSymbol = checker.getAliasedSymbol(moduleSymbol);
    for (const exported of moduleSymbol ? checker.getExportsOfModule(moduleSymbol) : []) {
      const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
      if (symbol.name !== 'Provider' && symbol.name !== 'DiBagApi') continue;
      if ((symbol.declarations ?? []).some(declaration =>
        (ts.isClassDeclaration(declaration) || ts.isInterfaceDeclaration(declaration))
        && declaration.name?.text === symbol.name)) owners.add(symbol);
    }
  }
  return owners;
}
function declarationOwner(nameNode, checker, declarationOwners) {
  let symbol = checker.getSymbolAtLocation(nameNode);
  if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  for (const declaration of symbol?.declarations ?? []) {
    for (let node = declaration.parent; node; node = node.parent) {
      if (!(ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) || !node.name) continue;
      let owner = checker.getSymbolAtLocation(node.name);
      if (owner?.flags & ts.SymbolFlags.Alias) owner = checker.getAliasedSymbol(owner);
      if (owner && declarationOwners.has(owner)) return node.name.text;
      break;
    }
  }
  return undefined;
}

/** Understand both 0.4 DiBagApi wrappers and 0.5 Provider receivers by declaration owner. */
function unwrap(expression, checker, declarationOwners) {
  let lifetime = 'scoped:one-per-container', lifetimeSelected = false, owned = false, opaque = false;
  let inner = skipOuter(expression);
  while (ts.isCallExpression(inner) && ts.isPropertyAccessExpression(inner.expression)) {
    const name = inner.expression.name.text;
    const owner = declarationOwner(inner.expression.name, checker, declarationOwners);
    if (owner === 'DiBagApi' && WRAPPERS.has(name)) {
      if (name === 'withDisposal') owned = true;
      if (name === 'withLifetime' && !lifetimeSelected) {
        const selected = literalLifetime(inner.arguments[1]);
        if (selected === undefined) opaque = true; else lifetime = selected;
        lifetimeSelected = true;
      }
      inner = skipOuter(inner.arguments[0]);
      continue;
    }
    if (owner === 'Provider' && PROVIDER_METHODS.has(name)) {
      if (name === 'withDisposal') owned = true;
      if (name === 'withLifetime' && !lifetimeSelected) {
        const selected = literalLifetime(inner.arguments[0]);
        if (selected === undefined) opaque = true; else lifetime = selected;
        lifetimeSelected = true;
      }
      inner = skipOuter(inner.expression.expression);
      continue;
    }
    break;
  }
  return { inner, lifetime: opaque ? 'dynamic' : lifetime, owned };
}
```

Replace the old `unwrap` body with the code above. Compute `const declarationOwners = diBagDeclarationOwners(sourceFile, checker)` once per extracted source file and pass the existing checker plus that set at every `unwrap` call site. This resolves the actual `Provider` and `DiBagApi` exports of the module imported by that source; final `di-bag`/`di-bag/node` must contribute both owners, while the vendored module below deliberately contributes both from its own declaration. Assert those owner sets in `extract.test.mjs` before asserting nodes so a missing or indirect export fails visibly. Keep `WRAPPERS` as the old four-name set. Do not classify by spelling, declaration name alone, source filename, or directory: the containing class/interface symbol must be one of those authenticated exports. The same two names exist on both owners. Outermost lifetime wins, any disposal stage owns, and a nonliteral lifetime is explicitly `dynamic` rather than guessed. Create `tools/graph/test/fixtures/provider-methods.ts` exactly:

```ts
import { DiBag } from 'di-bag';
const chosen = 'scoped:one-per-container' as const;
const singleton = DiBag.createProvider(() => 1)
  .withDisposal(() => {})
  .withRegistrationMetadata({ owner: 'graph' })
  .withAcquisitionMetadata({ callbackReceives: 'exposed-service', describeAcquisition: value => ({ value }) })
  .withTransformedService({ callbackReceives: 'exposed-service', transformService: value => value })
  .withLifetime('singleton:one-per-container-tree');
const scoped = DiBag.createProvider(() => 2).withLifetime('scoped:one-per-container');
const transient = DiBag.createProvider(() => 3).withDisposal(() => {}).withLifetime('transient:one-per-resolve').withTransformedService({ callbackReceives: 'exposed-service', transformService: value => value });
const dynamic = DiBag.createProvider(() => 4).withLifetime(chosen);
const reset = DiBag.createProvider(() => 5).withLifetime('singleton:one-per-container-tree').withLifetime('scoped:one-per-container');
class Provider { withLifetime(_value: string) { return this; } }
const localProvider = new Provider().withLifetime('root') as any;
const localObject = ({ withDisposal() { return this; } }).withDisposal() as any;
export const container = DiBag.createBuilder().withServices({ singleton, scoped, transient, dynamic, reset, localProvider, localObject }).buildContainer();
```

Keep legacy-wrapper recognition in a separate `tools/graph/test/fixtures/provider-methods-0-4.ts` that imports `DiBag` from phase 8's vendored `./provider-sources-0-4-library.js`, never from the final package. Replace that vendored declaration with this exact additive superset of the phase-8 fixture contract; it retains token, builder, factory, function, and class coverage while giving legacy wrapper members an exported `DiBagApi` declaration owner:

```ts
export interface Provider<Factory> { readonly __factory?: Factory }
export interface Token<Service> { readonly key: symbol; readonly __service?: Service }
type Factory = (dependencies: never) => unknown;
type Registration = Factory | Provider<Factory>;
interface Builder {
  register(token: Token<unknown>, provider: () => unknown): Builder;
  register(providers: Record<string, Registration>): Builder;
  build(): unknown;
}
export interface DiBagApi {
  token(symbol: symbol): { of<Service>(): Token<Service> };
  createBuilder(): Builder;
  fromFactory<FactoryType extends Factory>(factory: FactoryType): Provider<FactoryType>;
  fromFunction<Service, Output>(tokens: readonly [Token<Service>], factory: (value: Service) => Output): Provider<() => Output>;
  fromClass<Service, Instance>(tokens: readonly [Token<Service>], serviceClass: new (value: Service) => Instance): Provider<() => Instance>;
  withConfiguration(options: object): DiBagApi;
  withDisposal<FactoryType extends Factory>(provider: FactoryType | Provider<FactoryType>, dispose: (value: Awaited<ReturnType<FactoryType>>) => void | Promise<void>): Provider<FactoryType>;
  withLifetime<FactoryType extends Factory>(provider: FactoryType | Provider<FactoryType>, lifetime: 'root' | 'scoped' | 'transient', options?: { readonly allowScopedDependencies?: boolean }): Provider<FactoryType>;
}
export const DiBag: DiBagApi;
```

Create the legacy fixture exactly:

```ts
import { DiBag } from './provider-sources-0-4-library.js';
const derived = DiBag.withConfiguration({});
const legacy = DiBag.withLifetime(DiBag.withDisposal(() => 1, () => {}), 'root');
const derivedLegacy = derived.withLifetime(derived.withDisposal(() => 6, () => {}), 'transient');
export const container = DiBag.createBuilder().register({ legacy, derivedLegacy }).build();
```

In `extract.test.mjs`, load this fixture as `providerUnit` and assert the exact nodes:

```js
assert.deepEqual(providerUnit.nodes.map(({ key, lifetime, owned }) => ({ key, lifetime, owned })), [
  { key: 'singleton', lifetime: 'singleton:one-per-container-tree', owned: true },
  { key: 'scoped', lifetime: 'scoped:one-per-container', owned: false },
  { key: 'transient', lifetime: 'transient:one-per-resolve', owned: true },
  { key: 'dynamic', lifetime: 'dynamic', owned: false },
  { key: 'reset', lifetime: 'scoped:one-per-container', owned: false },
  { key: 'localProvider', lifetime: 'scoped:one-per-container', owned: false },
  { key: 'localObject', lifetime: 'scoped:one-per-container', owned: false },
]);
assert.deepEqual(provider04Unit.nodes.map(({ key, lifetime, owned }) => ({ key, lifetime, owned })), [
  { key: 'legacy', lifetime: 'singleton:one-per-container-tree', owned: true },
  { key: 'derivedLegacy', lifetime: 'transient:one-per-resolve', owned: true },
]);
```

The two declaration-collision rows prove aliases and identical spellings cannot select the wrong argument position. Also assert that the final import authenticates the exported `Provider` and `DiBagApi` symbols, the vendored import authenticates its distinct exported owners, and neither local lookalike symbol belongs to either set. The final fixture remains valid after Task 6 removes the compatibility facade; the vendored 0.4 fixture remains valid independently.

Update the two existing assertions from `root/scoped` to normalized full values. In `tools/graph/README.md`, replace the lifetime sentence with: “`lifetime` is a full 0.5.0 lifetime value, or `dynamic` when the extractor cannot statically read the argument; old facade values are normalized.”

- [ ] **Step 3: Rewrite checked documentation without losing earlier rows**

After the codemod/manual migration has removed consumer calls, mark the four compatibility `DiBagApi` decorator members and `FactoryWithDisposal` `@internal`, and in the same working tree replace their API-card tasks with the provider-method tasks. Rule 3 uses full lifetimes and singleton/scoped/transient semantics; rule 6 shows `createProvider(factory).withDisposal(...)`. Update recipes/errors/examples, preserve all phase-3 through phase-8 rows, and keep `AGENTS.md` within 150 lines. Task 6 removes the source declarations and residual internal references atomically. Update exact-rendering and overload-count tests to the five provider methods. This is the first gate at which checked docs hide the old surface; there is no earlier docs-red interval.

Place these exact JSDoc blocks immediately above the corresponding complete overload groups printed in Task 1 (one block per overload group, not on implementations):

````ts
/**
 * Add an ownership stage whose disposer receives this provider's acquired value. Earlier stages run later in reverse order.
 * @param disposeService Called once for each acquired value owned by the closing container.
 * @returns A new frozen provider retaining every earlier stage.
 * @example
 * ```ts
 * const owned = DiBag.createProvider(() => ({ close() {} })).withDisposal(client => client.close());
 * ```
 */
/**
 * Select one full caching policy. Only singleton may opt into scoped dependencies.
 * @typeParam SelectedLifetime The individually known full lifetime literal.
 * @typeParam Options The singleton-only options bag, when supplied.
 * @param lifetime The full public lifetime value.
 * @param options Singleton capture policy; omitted for scoped and transient lifetimes.
 * @returns A new frozen provider carrying the selected graph contract.
 * @example
 * ```ts
 * const cached = DiBag.createProvider(() => new Map()).withLifetime('singleton:one-per-container-tree');
 * ```
 */
/**
 * Copy and freeze noncolliding registration metadata without acquiring the service.
 * @typeParam AddedMetadata The metadata record appended to the retained contract.
 * @param registrationMetadata An own-key object whose keys do not collide with retained metadata.
 * @returns A new frozen provider carrying the merged metadata.
 * @example
 * ```ts
 * const described = DiBag.createProvider(() => 1).withRegistrationMetadata({ owner: 'platform' });
 * ```
 */
/**
 * Append one synchronous acquisition-metadata frame from the exposed service or its fulfilled value.
 * @typeParam Describe The synchronous metadata callback selected by callbackReceives.
 * @param options The callback, plus whether it receives the exposed service or fulfilled value.
 * @returns A new frozen provider retaining the appended frame type.
 * @example
 * ```ts
 * const observed = DiBag.createProvider(() => 1).withAcquisitionMetadata({ callbackReceives: 'exposed-service', describeAcquisition: value => ({ value }) });
 * ```
 */
/**
 * Transform the exposed service or fulfilled value while retaining dependencies, metadata, lifetime and ownership stages.
 * @typeParam Transform The transformation callback selected by callbackReceives.
 * @typeParam ReturnKind The explicit return policy for exposed-service callbacks.
 * @param options The callback, callback input selection, and required return policy when inference is unsafe.
 * @returns A new frozen provider exposing the transformed service.
 * @example
 * ```ts
 * const mapped = DiBag.createProvider(() => 1).withTransformedService({ callbackReceives: 'exposed-service', transformService: value => String(value) });
 * ```
 */
````

In `tools/docs/api-card-tasks.json`, replace only the four old decorator objects with these five task rows and preserve array order and every prior row:

```json
{ "task": "Attach disposal", "call": "provider.withDisposal" },
{ "task": "Choose a lifetime", "call": "provider.withLifetime" },
{ "task": "Attach registration metadata", "call": "provider.withRegistrationMetadata" },
{ "task": "Attach acquisition metadata", "call": "provider.withAcquisitionMetadata" },
{ "task": "Transform a service", "call": "provider.withTransformedService" }
```

Replace AGENTS rule 3 with: “**Lifetimes.** The default remains `scoped:one-per-container` in this phase. Select `singleton:one-per-container-tree`, `scoped:one-per-container`, or `transient:one-per-resolve` with `provider.withLifetime(...)`; only singleton accepts `allowsScopedDependencies`.” Replace rule 6's first sentence with: “**Ownership.** Wrap a plain factory with `DiBag.createProvider(factory).withDisposal(disposeService)`; containers dispose dependents first.” These are line replacements, so the 150-line count is unchanged.

In `docs/agent/api-card.md` and `docs/agent/recipes.md`, use this complete representative example:

```ts
const database = DiBag.createProvider(async ({ config }: { config: Config }) => connect(config.url), { factoryReturnKind: 'native-promise' })
  .withRegistrationMetadata({ owner: 'platform' })
  .withAcquisitionMetadata({ callbackReceives: 'fulfilled-value', describeAcquisition: connection => ({ host: connection.host }) })
  .withDisposal(connection => connection.close())
  .withLifetime('singleton:one-per-container-tree');
```

Update `tools/docs/test/exact-rendering.test.mjs` against its existing generated-reference `output` value (and its existing `directory` fixture path where a page must be read), not a nonexistent repository-root variable. Assert the reference output contains `withDisposal(disposeService)`, both `withLifetime(lifetime)` and `withLifetime(lifetime, options)`, `withRegistrationMetadata(registrationMetadata)`, both callback-receiver overloads of `withAcquisitionMetadata(options)`, and both callback-receiver overloads of `withTransformedService(options)`. Also assert the relevant rendered member sections contain `allowsScopedDependencies`, `describeAcquisition`, `callbackReceives`, `transformService`, and `transformReturnKind`, and exclude `allowScopedDependencies`, `mode`, `describe`, `transform`, and `acquisitionMode`. Do not use the API card for overload/property coverage: it renders task calls and fenced examples, not readonly interface fields or every overload. In `coverage.test.mjs`, pin overload counts `1, 2, 1, 2, 2`. In `api-card.test.mjs`, separately assert each of the five task calls has at least one fenced TypeScript `@example`. Preserve every earlier rendering assertion.

- [ ] **Step 4: Run focused migration gates**

```bash
bun test tests/providers.test.ts tests/lifetimes.test.ts tests/disposal.test.ts tests/acquisition-metadata.test.ts tests/api-renaming.test.ts
node --test tools/graph/test/*.test.mjs tools/docs/test/*.test.mjs
npm run docs:check
```

Expected: all pass. If generated docs fail, fix the source/JSDoc contract; there is no phase-09 exception until an actual failure is captured and approved.

Stage exactly the migrated `tests`, `examples`, `scripts/agent-eval`, `tools/graph`, `tools/docs`, `AGENTS.md`, and `docs/agent` paths after inspecting both codemod reports. Commit:

```text
docs: migrate provider authoring examples

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
```

---

### Task 5: Measure S2 and choose the preferred or complete fallback contract

**Files:**
- Modify: `tests/compiler.ts`, `scripts/benchmark-types.ts`
- Create: `scripts/check-provider-method-scale.ts`, `docs/superpowers/plans/evidence/phase-09.md`

**Interfaces:**
- Produces: thirteen evidence rows and an explicit adopted/fallback decision.

- [ ] **Step 1: Add the complete 100-provider worker**

Create `scripts/check-provider-method-scale.ts`:

```ts
import ts from 'typescript';
import { performance } from 'node:perf_hooks';
import { compilerProgram, describeDiagnostic, providerMethodScalePath, providerMethodScaleSource } from '../tests/compiler.ts';
const shape = process.argv[2];
if (shape !== 'old' && shape !== 'new') throw new Error('usage: check-provider-method-scale.ts old|new');
const source = providerMethodScaleSource(shape);
const started = performance.now();
const program = compilerProgram(providerMethodScalePath, source);
const diagnostics = ts.getPreEmitDiagnostics(program).map(describeDiagnostic);
console.log(JSON.stringify({ case: `provider-methods-${shape}`, accepted: diagnostics.length === 0, typescript: ts.version, node: process.version, milliseconds: Math.round(performance.now() - started), maxRssMiB: Math.round(process.resourceUsage().maxRSS / 1024), diagnostics, instantiations: program.getInstantiationCount() }));
process.exitCode = diagnostics.length === 0 ? 0 : 1;
```

Add beside `scaleSource` in `tests/compiler.ts`:

```ts
export type ProviderMethodScaleShape = 'old' | 'new';
export const providerMethodScalePath = resolve('tests/provider-method-scale.ts');
export function providerMethodScaleSource(shape: ProviderMethodScaleShape): string {
  const services = Array.from({ length: 100 }, (_, index) => `svc${index}: () => ${index}`).join(',\n');
  const replacements = Array.from({ length: 100 }, (_, index) => shape === 'old'
    ? `.withReplacedService('svc${index}', DiBag.withLifetime(DiBag.withDisposal(() => ${index + 1}, () => {}), 'scoped'))`
    : `.withReplacedService('svc${index}', DiBag.createProvider(() => ${index + 1}).withDisposal(() => {}).withLifetime('scoped:one-per-container'))`).join('\n');
  return `import { DiBag } from '../src';\nDiBag.createBuilder().withServices({${services}})\n${replacements}\n.buildContainer();\n`;
}
```

Migrate the twelve standard generators in `tests/compiler.ts` at their provider-construction sites, rather than changing their graph sizes. Add one source helper and call it from every standard case that currently emits an old decorator:

```ts
export const providerMethodSyntax = (factorySource: string, lifetime: 'singleton:one-per-container-tree' | 'scoped:one-per-container' | 'transient:one-per-resolve' = 'scoped:one-per-container') =>
  `DiBag.createProvider(${factorySource}).withLifetime(${JSON.stringify(lifetime)})`;
```

Before editing the twelve builders, capture a provider-neutral topology fingerprint for every emitted source. Add this temporary helper beside the cases, run it once on the old generators, and save the JSON under `/tmp`; delete the helper after the post-edit comparison:

```ts
export function evidenceTopology(source: string) {
  const count = (pattern: RegExp) => [...source.matchAll(pattern)].length;
  return {
    services: count(/\bsvc\d+\s*:/g),
    tokens: count(/createToken\(/g),
    collections: count(/withCollectionContribution\(/g),
    modules: count(/buildModule\(/g),
    installs: count(/withInstalledModules\(/g),
    replacements: count(/withReplacedService\(/g),
    builds: count(/buildContainer\(/g),
    expectedRejection: /@ts-expect-error|diagnostic:|verifyGraphAtCompileTime/.test(source),
  };
}
```

For each of the twelve case builders, replace emitted `DiBag.withLifetime(factory, 'root'|'scoped'|'transient')` with `providerMethodSyntax(factory, fullValue)` and emitted `DiBag.withDisposal(factory, disposer)` with `DiBag.createProvider(factory).withDisposal(disposer)`. Do not alter service counts, token/collection topology, module boundaries, replacements, or accepted/rejected intent. After editing, assert: (1) `evidenceCases().map(row => row.name)` equals the existing twelve-name snapshot, (2) every emitted source parses, (3) no emitted source contains `DiBag.withLifetime` or `DiBag.withDisposal`, and (4) `Object.fromEntries(evidenceCases().map(row => [row.name, evidenceTopology(row.source)]))` deep-equals the saved old JSON. A name list alone is not topology evidence.

Run both worker shapes at the green expand commit, after prototype methods exist and before facade removal, so the same compiler/source tree accepts both and the comparison isolates call shape. Record that commit id. Run the twelve standard cases again after contract removal; do not attempt the `old` worker after its declarations are gone.

- [ ] **Step 2: Run the serialized evidence commands**

Do not run either command under the standing heavy-command hold. A free-memory reading and serialization are insufficient. Run them only after the controller explicitly lifts the evidence hold for these exact commands. Run the two provider rows at the expand commit; run the standard command again at the final contract commit:

```bash
node scripts/evidence-cases.mjs --compare docs/superpowers/plans/evidence/baseline.md --json /tmp/phase-09-evidence.json
node --import tsx scripts/check-provider-method-scale.ts old > /tmp/phase-09-provider-old.json
node --import tsx scripts/check-provider-method-scale.ts new > /tmp/phase-09-provider-new.json
```

Expected: every standard case's cumulative phase-09 count is `<= floor(baseline * 1.10)`; both provider cases are accepted; the new provider replacement case is `<= floor(old-provider-case * 1.10)`. Any standard row over its cumulative baseline cap or the new case over its old-shape cap triggers the fallback after at most three permitted repairs. Record exact numbers and tool/compiler versions in `phase-09.md`. No `--phase` or `--out` flags exist.

- [ ] **Step 3: Apply the decision rule**

Adopt methods if declaration/type fixtures pass and the new worker is within 110%. After three serious repairs or a budget breach, replace Tasks 1/3/4 public surface with this complete fallback and rerun all tests/evidence:

```ts
providerWithDisposal<ServiceProvider extends ProviderOrFactory>(options: { readonly provider: ServiceProvider; readonly disposeService: (this: void, service: ProviderAcquiredValue<NoInfer<ServiceProvider>>) => void | Promise<void> }): Provider<ProviderFactory<ServiceProvider>, RetainedMetadata<ServiceProvider>, ProviderAcquisitionMetadata<ServiceProvider>, ProviderGraphContract<ServiceProvider>, ProviderAcquiredValue<ServiceProvider>>;
providerWithLifetime<ServiceProvider extends ProviderOrFactory, const SelectedLifetime extends Lifetime, const Options extends { readonly allowsScopedDependencies?: boolean } = {}>(options: { readonly provider: ServiceProvider; readonly lifetime: SelectedLifetime & LifetimeAdmission<SelectedLifetime> } & Options & LifetimeOptions<NoInfer<SelectedLifetime>, NoInfer<Options>>): Provider<ProviderFactory<ServiceProvider>, RetainedMetadata<ServiceProvider>, ProviderAcquisitionMetadata<ServiceProvider>, LifetimeGraph<ProviderGraphContract<ServiceProvider>, SelectedLifetime, Options>, ProviderAcquiredValue<ServiceProvider>>;
providerWithRegistrationMetadata<ServiceProvider extends ProviderOrFactory, AddedMetadata extends object>(options: { readonly provider: ServiceProvider; readonly registrationMetadata: AddedMetadata & MetadataKeys<NoInfer<ServiceProvider>, AddedMetadata> }): Provider<ProviderFactory<ServiceProvider>, Readonly<RetainedMetadata<ServiceProvider> & AddedMetadata>, ProviderAcquisitionMetadata<ServiceProvider>, ProviderGraphContract<ServiceProvider>, ProviderAcquiredValue<ServiceProvider>>;
providerWithAcquisitionMetadata<ServiceProvider extends ProviderOrFactory, Describe extends (this: void, service: ProviderOutput<NoInfer<ServiceProvider>>) => object>(options: { readonly provider: ServiceProvider; readonly describeAcquisition: Describe & AcquisitionMetadataAdmission<ReturnType<Describe>>; readonly callbackReceives: 'exposed-service' }): Provider<ProviderFactory<ServiceProvider>, RetainedMetadata<ServiceProvider>, readonly [...ProviderAcquisitionMetadata<ServiceProvider>, Readonly<ReturnType<Describe>>], ProviderGraphContract<ServiceProvider>, ProviderAcquiredValue<ServiceProvider>>;
providerWithAcquisitionMetadata<ServiceProvider extends ProviderOrFactory, Describe extends (this: void, service: Awaited<ProviderOutput<NoInfer<ServiceProvider>>>) => object>(options: { readonly provider: ServiceProvider; readonly describeAcquisition: Describe & AcquisitionMetadataAdmission<ReturnType<Describe>>; readonly callbackReceives: 'fulfilled-value' }): Provider<MappedProviderFactory<ProviderFactory<ServiceProvider>, Promise<Awaited<ProviderOutput<ServiceProvider>>>>, RetainedMetadata<ServiceProvider>, readonly [...ProviderAcquisitionMetadata<ServiceProvider>, Readonly<ReturnType<Describe>>], ProviderGraphContract<ServiceProvider>, Awaited<ProviderOutput<ServiceProvider>>>;
providerWithTransformedService<ServiceProvider extends ProviderOrFactory, Transform extends (this: void, service: ProviderOutput<NoInfer<ServiceProvider>>) => ('native-promise' extends ReturnKind ? Promise<unknown> : unknown), ReturnKind extends FactoryReturnKind = 'auto-detect'>(options: { readonly provider: ServiceProvider; readonly transformService: Transform; readonly callbackReceives: 'exposed-service' } & TransformReturnKindOptions<ReturnKind> & NativeOutput<ReturnType<NoInfer<Transform>>, NoInfer<ReturnKind>> & AutoOutput<ReturnType<NoInfer<Transform>>, NoInfer<ReturnKind>> & SyncOutput<ReturnType<NoInfer<Transform>>, NoInfer<ReturnKind>>): Provider<MappedProviderFactory<ProviderFactory<ServiceProvider>, ReturnType<Transform>>, RetainedMetadata<ServiceProvider>, ProviderAcquisitionMetadata<ServiceProvider>, ProviderGraphContract<ServiceProvider>, Acquired<ReturnType<Transform>, ReturnKind>>;
providerWithTransformedService<ServiceProvider extends ProviderOrFactory, Transform extends (this: void, service: Awaited<ProviderOutput<NoInfer<ServiceProvider>>>) => unknown>(options: { readonly provider: ServiceProvider; readonly transformService: Transform; readonly callbackReceives: 'fulfilled-value'; readonly transformReturnKind?: never }): Provider<MappedProviderFactory<ProviderFactory<ServiceProvider>, Promise<Awaited<ReturnType<Transform>>>>, RetainedMetadata<ServiceProvider>, ProviderAcquisitionMetadata<ServiceProvider>, ProviderGraphContract<ServiceProvider>, Awaited<ReturnType<Transform>>>;
```

Each fallback accepts `ProviderOrFactory`; internally call `createProvider` for a function then the same private helpers. Restore `FactoryWithDisposal` only internally if required by the fast overload, never export it. Replace map entries with original-owner `DiBagApi` names `withDisposal/withLifetime/withMetadata/transformService` targeting the five fallback methods, using `transformNames` for every generated bag field. The custom transform emits one facade bag for each safe old decorator, preserves derived facades, and manually reports combined metadata rather than changing evaluation order. Replace runtime/type fixtures and API-card rows with fallback calls. This is a whole-contract switch; do not ship both shapes.

The fallback runtime is complete and reuses the same validated primitives:

```ts
function asProvider(provider: unknown, operation: string): ProviderBase {
  if (typeof provider === 'function') return createProvider(provider as Factory);
  describe(provider, operation);
  return provider as ProviderBase;
}
function providerWithDisposal(options: unknown): ProviderBase {
  const { provider, disposeService } = snapshotOptionsBag(options, 'providerWithDisposal', ['provider', 'disposeService']);
  return addDisposal(asProvider(provider, 'providerWithDisposal'), disposeService, 'providerWithDisposal');
}
function providerWithLifetime(options: unknown): ProviderBase {
  const bag = snapshotOptionsBag(options, 'providerWithLifetime', ['provider', 'lifetime'], ['allowsScopedDependencies']);
  const lifetimeOptions = Object.hasOwn(bag, 'allowsScopedDependencies') ? { allowsScopedDependencies: bag.allowsScopedDependencies } : undefined;
  return selectLifetime(asProvider(bag.provider, 'providerWithLifetime'), bag.lifetime, lifetimeOptions, 'providerWithLifetime');
}
function providerWithRegistrationMetadata(options: unknown): ProviderBase {
  const { provider, registrationMetadata } = snapshotOptionsBag(options, 'providerWithRegistrationMetadata', ['provider', 'registrationMetadata']);
  return addRegistrationMetadata(asProvider(provider, 'providerWithRegistrationMetadata'), registrationMetadata, 'providerWithRegistrationMetadata');
}
function providerWithAcquisitionMetadata(options: unknown): ProviderBase {
  const { provider, describeAcquisition, callbackReceives } = snapshotOptionsBag(options, 'providerWithAcquisitionMetadata', ['provider', 'describeAcquisition', 'callbackReceives']);
  return addAcquisitionMetadata(asProvider(provider, 'providerWithAcquisitionMetadata'), { describeAcquisition, callbackReceives }, 'providerWithAcquisitionMetadata');
}
function providerWithTransformedService(options: unknown): ProviderBase {
  const bag = snapshotOptionsBag(options, 'providerWithTransformedService', ['provider', 'transformService', 'callbackReceives'], ['transformReturnKind']);
  const transformed = Object.hasOwn(bag, 'transformReturnKind')
    ? { transformService: bag.transformService, callbackReceives: bag.callbackReceives, transformReturnKind: bag.transformReturnKind }
    : { transformService: bag.transformService, callbackReceives: bag.callbackReceives };
  return addTransformedService(asProvider(bag.provider, 'providerWithTransformedService'), transformed, 'providerWithTransformedService');
}
```

The fallback's focused runtime fixture is exact and replaces the preferred test's first case:

```ts
test('fallback bags retain all stages, ownership and operation names', async () => {
  const events: string[] = [];
  const source = DiBag.createProvider(() => ({ value: 2 }));
  const owned = DiBag.providerWithDisposal({ provider: source, disposeService: value => { events.push(`source:${value.value}`); } });
  const registered = DiBag.providerWithRegistrationMetadata({ provider: owned, registrationMetadata: { owner: 'platform' as const } });
  const framed = DiBag.providerWithAcquisitionMetadata({ provider: registered, callbackReceives: 'exposed-service', describeAcquisition: value => ({ before: value.value }) });
  const mapped = DiBag.providerWithTransformedService({ provider: framed, callbackReceives: 'exposed-service', transformService: value => value.value * 3 });
  const final = DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: mapped, disposeService: value => { events.push(`mapped:${value}`); } }), lifetime: 'singleton:one-per-container-tree' });
  const container = DiBag.createBuilder().withServices({ value: final }).buildContainer();
  expect(container.resolve('value')).toBe(6);
  expect(container.serviceSnapshot('value').registrationMetadata).toEqual({ owner: 'platform' });
  await container.close();
  expect(events).toEqual(['mapped:6', 'source:2']);
  const invalid = caught(() => (DiBag as any).providerWithTransformedService({ provider: {}, callbackReceives: 'exposed-service', transformService: (value: unknown) => value }));
  expect(invalid.details.operation).toBe('providerWithTransformedService');
  for (const result of [() => [], () => new Date(), () => ({ then() {} })]) {
    const invalidMetadata = DiBag.providerWithAcquisitionMetadata({ provider: () => 1, callbackReceives: 'exposed-service', describeAcquisition: result as () => never });
    const invalidContainer = DiBag.createBuilder().withServices({ invalidMetadata }).buildContainer();
    const error = caught(() => invalidContainer.resolve('invalidMetadata'));
    expect(error.details.operation).toBe('providerWithAcquisitionMetadata');
  }
});
```

The shared helper bodies and `describe(registration, operation = 'withServices')` from Task 1 already thread the optional operation through every options snapshot, callback-result error, and invalid-provider details object; the five runtime bodies above call `describe(provider, operation)` before any description access.

Use these exact fallback map entries in place of the four preferred method entries; merge them into the accumulated map and preserve every earlier value/type/property entry:

```json
[
  { "owner": "DiBagApi", "from": "withDisposal", "to": "providerWithDisposal", "transform": "provider-facades", "transformNames": { "method": "providerWithDisposal", "provider": "provider", "disposeService": "disposeService" } },
  { "owner": "DiBagApi", "from": "withLifetime", "to": "providerWithLifetime", "transform": "provider-facades", "transformNames": { "method": "providerWithLifetime", "provider": "provider", "lifetime": "lifetime", "allowsScopedDependencies": "allowsScopedDependencies" } },
  { "owner": "DiBagApi", "from": "withMetadata", "to": "providerWithRegistrationMetadata", "transform": "provider-facades", "transformNames": { "registrationFacade": "providerWithRegistrationMetadata", "acquisitionFacade": "providerWithAcquisitionMetadata", "provider": "provider", "registrationMetadata": "registrationMetadata", "describeAcquisition": "describeAcquisition", "callbackReceives": "callbackReceives" } },
  { "owner": "DiBagApi", "from": "transformService", "to": "providerWithTransformedService", "transform": "provider-facades", "transformNames": { "method": "providerWithTransformedService", "provider": "provider", "transformService": "transformService", "callbackReceives": "callbackReceives", "transformReturnKind": "transformReturnKind" } }
]
```

The fallback reuses the preferred transform's exported checker classification and literal-bag helpers, but supplies its own complete dispatcher because its receiver remains a bag field rather than becoming a method receiver. Create `tools/codemod/lib/transforms/provider-facades.mjs` exactly:

```js
import { originalKind, literalBag, valueOf, nodeOf, renamedLiteral, text, textWithTrivia } from './provider-methods.mjs';

const field = (role, value, api) => `${api.nameForRole(role)}: ${value}`;
const bagCall = (facade, role, fields, api) =>
  `${facade}.${api.nameForRole(role)}({ ${fields.join(', ')} })`;
const callbackValues = new Map([['direct', 'exposed-service'], ['awaited', 'fulfilled-value']]);
const lifetimeValues = new Map([['root', 'singleton:one-per-container-tree'], ['scoped', 'scoped:one-per-container'], ['transient', 'transient:one-per-resolve']]);
const returnValues = new Map([['auto', 'auto-detect'], ['raw', 'uninspected'], ['nativePromise', 'native-promise']]);

export default function providerFacades(call, api) {
  const oldName = call.expression.name.text;
  const registration = call.arguments[0];
  if (originalKind(registration, api) === 'manual') {
    api.manual(call, 'the decorated value is any, unknown, invalid, or a factory/provider union; wrap a factory with createProvider or supply a provider by hand');
    return undefined;
  }
  const facade = text(call.expression.expression, api);
  const receiver = text(registration, api);
  if (oldName === 'withDisposal') return bagCall(facade, 'method', [field('provider', receiver, api), field('disposeService', textWithTrivia(call.arguments[1], api).trimStart(), api)], api);
  if (oldName === 'withLifetime') {
    const lifetime = renamedLiteral(call.arguments[1], lifetimeValues, call, 'withLifetime uses a nonliteral lifetime; rewrite it to a full lifetime value by hand', api);
    if (lifetime === undefined) return undefined;
    const fields = [field('provider', receiver, api), field('lifetime', lifetime, api)];
    if (call.arguments[2] !== undefined) {
      const options = literalBag(call.arguments[2], new Set(['allowScopedDependencies']), call, 'the withLifetime options are not a supported object literal; rewrite the provider bag by hand', api);
      if (options === undefined) return undefined;
      const allows = valueOf(options, 'allowScopedDependencies', api);
      if (allows !== undefined) fields.push(field('allowsScopedDependencies', allows, api));
    }
    return bagCall(facade, 'method', fields, api);
  }
  const allowed = oldName === 'transformService' ? new Set(['mode', 'transform', 'acquisitionMode']) : new Set(['static', 'dynamic']);
  const options = literalBag(call.arguments[1], allowed, call, `the ${oldName} options are not a supported object literal; rewrite the provider bag by hand`, api);
  if (options === undefined) return undefined;
  if (oldName === 'transformService') {
    const transform = valueOf(options, 'transform', api);
    const receives = renamedLiteral(nodeOf(options, 'mode', api), callbackValues, call, 'transformService mode is nonliteral; choose callbackReceives by hand', api);
    const returnNode = nodeOf(options, 'acquisitionMode', api);
    const returnKind = returnNode === undefined ? undefined : renamedLiteral(returnNode, returnValues, call, 'transformService acquisitionMode is nonliteral; choose transformReturnKind by hand', api);
    if (transform === undefined || receives === undefined || (returnNode !== undefined && returnKind === undefined)) return undefined;
    const fields = [field('provider', receiver, api), field('transformService', transform, api), field('callbackReceives', receives, api)];
    if (returnKind !== undefined) fields.push(field('transformReturnKind', returnKind, api));
    return bagCall(facade, 'method', fields, api);
  }
  const registrationMetadata = valueOf(options, 'static', api);
  const dynamicProperty = options.get('dynamic');
  if (registrationMetadata !== undefined && dynamicProperty !== undefined) {
    api.manual(call, 'combined static and dynamic metadata can change evaluation order when split; rewrite the two provider bags by hand');
    return undefined;
  }
  if (registrationMetadata !== undefined) return bagCall(facade, 'registrationFacade', [field('provider', receiver, api), field('registrationMetadata', registrationMetadata, api)], api);
  if (!dynamicProperty || !api.ts.isPropertyAssignment(dynamicProperty)) {
    api.manual(call, 'withMetadata dynamic options are opaque; rewrite the provider bag by hand');
    return undefined;
  }
  const dynamic = literalBag(dynamicProperty.initializer, new Set(['mode', 'describe']), call, 'withMetadata dynamic options are not a supported object literal; rewrite the provider bag by hand', api);
  if (dynamic === undefined) return undefined;
  const describe = valueOf(dynamic, 'describe', api);
  const receives = renamedLiteral(nodeOf(dynamic, 'mode', api), callbackValues, call, 'withMetadata dynamic mode is nonliteral; choose callbackReceives by hand', api);
  if (describe === undefined || receives === undefined) return undefined;
  return bagCall(facade, 'acquisitionFacade', [field('provider', receiver, api), field('describeAcquisition', describe, api), field('callbackReceives', receives, api)], api);
}
```

Register `'provider-facades': providerFacades` in `transforms/index.mjs` only when the fallback wins, replacing the preferred `'provider-methods'` registry id and map entries in the same commit. The dispatcher preserves derived facade text, recursively transformed child calls, literal normalization, moved disposal trivia, shorthand option values, and the same conservative manual rules. There is no facade-method chain.

Create fallback golden input from Task 3's `input.ts`. The exact changed expression rows are:

```ts
export const owned = DiBag.providerWithDisposal({ provider: f, disposeService: value => void value });
export const nested = DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: f, disposeService: value => void value }), lifetime: 'singleton:one-per-container-tree', allowsScopedDependencies: true });
export const metadata = DiBag.withMetadata(p, { static: { owner: 'team' }, dynamic: { mode: 'awaited', describe: value => ({ value }) } });
export const transformed = DiBag.providerWithTransformedService({ provider: p, transformService: value => value, callbackReceives: 'exposed-service', transformReturnKind: 'native-promise' });
export const configured = derived.providerWithDisposal({ provider: f, disposeService: value => void value });
```

All unchanged/manual/type/value rows equal Task 3's preferred golden and manual JSON, including the combined-metadata manual row. Add a separate static-only and dynamic-only fallback fixture so alternate-name assertions cover `mappedProvider`, `mappedDisposeService`, both metadata facade roles, and `mappedTransformReturnKind`, plus parse diagnostics `[]`.

Create `tests/provider-facades.test.ts` from the four Task-1 runtime tests by replacing each chain stage with the corresponding fallback call, nesting the previous result in `provider`; preserve getter-count, freeze, disposal-order, inherited/symbol rejection, fulfilled/exposed identity, callback-result operation details, and malformed-argument assertions, with operations renamed to the fallback method. Create `tests/types/provider-facades.ts` from the positive fixture with the same five `Equal` assertions and the transformed/framed zero-dependency replacement assertions. Create `tests/types/negative/provider-facades.ts` with the same twelve marker comments and replace only the offending call/property shape: `lifetime`, `allowsScopedDependencies`, `callbackReceives`, `describeAcquisition`, `transformReturnKind`, `transformService`, and `registrationMetadata` remain diagnostic-bearing properties; the dependent replacement marker remains on the positional provider argument. Add explicit fallback negatives for scoped and transient lifetimes with `allowsScopedDependencies: false`, scoped with `allowsScopedDependencies: undefined`, singleton with a non-boolean value, and an unknown option key; these replace equivalent general lifetime-fixture rows so the total expected marker count is updated from actual markers rather than hard-coded to eleven. Register these files in the same declaration/negative loops and require `markers.length === errors.length` plus `matchDiagnosticMarkers(...)` with no missing or unexpected rows.

The fallback lifetime-only negative block is exact; place each marker immediately above the indicated property:

```ts
const provider = DiBag.createProvider(() => 1);
DiBag.providerWithLifetime({ provider, lifetime: 'scoped:one-per-container',
  // diagnostic: withLifetime allowsScopedDependencies requires singleton lifetime and a boolean value
  allowsScopedDependencies: false });
DiBag.providerWithLifetime({ provider, lifetime: 'transient:one-per-resolve',
  // diagnostic: withLifetime allowsScopedDependencies requires singleton lifetime and a boolean value
  allowsScopedDependencies: false });
DiBag.providerWithLifetime({ provider, lifetime: 'scoped:one-per-container',
  // diagnostic: Type 'undefined' is not assignable
  allowsScopedDependencies: undefined });
DiBag.providerWithLifetime({ provider, lifetime: 'singleton:one-per-container-tree',
  // diagnostic: Type 'string' is not assignable to type 'boolean'
  allowsScopedDependencies: 'yes' });
DiBag.providerWithLifetime({ provider, lifetime: 'singleton:one-per-container-tree',
  // diagnostic: withLifetime allowsScopedDependencies requires singleton lifetime and a boolean value
  extra: true });
```

For the positive fallback fixture, build each stage as a named constant exactly as in the fallback runtime test, export the final `decorated`, and reuse the five `ProviderOutput` / acquired / metadata / frames / lifetime `Equal` assertions from Task 1 verbatim. Add these two replacement proofs verbatim so the repaired zero-argument `MappedProviderFactory` is exercised:

```ts
const mappedReplacement = DiBag.providerWithTransformedService({ provider: () => 2, callbackReceives: 'exposed-service', transformService: value => value + 1 });
DiBag.createBuilder().withServices({ value: () => 1 }).withReplacedService('value', mappedReplacement);
const framedReplacement = DiBag.providerWithAcquisitionMetadata({ provider: () => Promise.resolve(2), callbackReceives: 'fulfilled-value', describeAcquisition: value => ({ value }) });
DiBag.createBuilder().withServices({ value: () => Promise.resolve(1) }).withReplacedService('value', framedReplacement);
```

Fallback API-card calls are `DiBag.providerWithDisposal`, `DiBag.providerWithLifetime`, `DiBag.providerWithRegistrationMetadata`, `DiBag.providerWithAcquisitionMetadata`, and `DiBag.providerWithTransformedService`. Replace the preferred representative recipe with this exact readable fallback recipe:

```ts
const source = DiBag.createProvider(async ({ config }: { config: Config }) => connect(config.url), { factoryReturnKind: 'native-promise' });
const registered = DiBag.providerWithRegistrationMetadata({ provider: source, registrationMetadata: { owner: 'platform' } });
const observed = DiBag.providerWithAcquisitionMetadata({ provider: registered, callbackReceives: 'fulfilled-value', describeAcquisition: connection => ({ host: connection.host }) });
const mapped = DiBag.providerWithTransformedService({ provider: observed, callbackReceives: 'fulfilled-value', transformService: connection => connection });
const owned = DiBag.providerWithDisposal({ provider: mapped, disposeService: connection => connection.close() });
const database = DiBag.providerWithLifetime({ provider: owned, lifetime: 'singleton:one-per-container-tree' });
```

Give each fallback `DiBagApi` signature a fenced `@example` using its exact bag fields so API-card example coverage remains green. Replace provider member overload-count expectations with facade overload counts `1, 1, 1, 2, 2`, and assert the generated reference `output` contains all five bag signatures and final property names. Extend graph extraction with this exact branch before `WRAPPERS`:

````ts
/** @example
 * ```ts
 * const owned = DiBag.providerWithDisposal({ provider: () => ({ close() {} }), disposeService: service => service.close() });
 * ```
 */
/** @example
 * ```ts
 * const cached = DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'singleton:one-per-container-tree' });
 * ```
 */
/** @example
 * ```ts
 * const registered = DiBag.providerWithRegistrationMetadata({ provider: () => 1, registrationMetadata: { owner: 'platform' } });
 * ```
 */
/** @example
 * ```ts
 * const observed = DiBag.providerWithAcquisitionMetadata({ provider: () => 1, callbackReceives: 'exposed-service', describeAcquisition: value => ({ value }) });
 * ```
 */
/** @example
 * ```ts
 * const mapped = DiBag.providerWithTransformedService({ provider: () => 1, callbackReceives: 'exposed-service', transformService: value => String(value) });
 * ```
 */
````

Place each block immediately above its corresponding overload group.

```js
const PROVIDER_FACADES = new Set(['providerWithDisposal', 'providerWithLifetime', 'providerWithRegistrationMetadata', 'providerWithAcquisitionMetadata', 'providerWithTransformedService']);
function ownBagValue(call, name) {
  const bag = call.arguments[0];
  if (!bag || !ts.isObjectLiteralExpression(bag)) return undefined;
  const item = bag.properties.find(property => ts.isPropertyAssignment(property) && !ts.isComputedPropertyName(property.name) && property.name.text === name);
  return item?.initializer;
}
// inside unwrap's call loop
if (declarationOwner(inner.expression.name, checker, declarationOwners) === 'DiBagApi' && PROVIDER_FACADES.has(name)) {
  if (name === 'providerWithDisposal') owned = true;
  if (name === 'providerWithLifetime' && !lifetimeSelected) {
    const selected = literalLifetime(ownBagValue(inner, 'lifetime'));
    if (selected === undefined) opaque = true; else lifetime = selected;
    lifetimeSelected = true;
  }
  const provider = ownBagValue(inner, 'provider');
  if (provider === undefined) { opaque = true; break; }
  inner = skipOuter(provider);
  continue;
}
```

Use the final seven-node Task-4 fixture (five DI Bag providers plus two local-collision rows) with the five DI Bag chains converted to nested fallback bags and keep its exact normalized assertion unchanged; retain the separate vendored 0.4 two-node fixture unchanged. The 100-provider new worker replaces each chain with `DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: () => n, disposeService: () => {} }), lifetime: 'scoped:one-per-container' })`. These alternate artifacts replace, rather than coexist with, the preferred artifacts before contract removal.

Stage exactly `tests/compiler.ts scripts/benchmark-types.ts scripts/check-provider-method-scale.ts docs/superpowers/plans/evidence/phase-09.md` plus the selected fallback files when the fallback won. Commit:

```text
test: record provider method evidence

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
```

---

### Task 6: Remove old contracts and run final gates

**Files:**
- Modify/delete: old facade members/helpers, exports, generated reference pages, naming violation list
- Modify: `src/builder-method-types.ts`, `tests/types/builder-renames.ts`, `tests/types/builder-renames-consumer.ts`, `tests/types/negative/provider-replacement-output.ts`
- Verify: all phase-owned files

**Interfaces:**
- Produces: one final provider-authoring surface, empty phase-owned naming violations, green complete phase.

- [ ] **Step 1: Remove facade declarations in one coherent contract commit**

Delete the four `DiBagApi` members and exported free functions. Delete public `FactoryWithDisposal` and `Registration`; export `ProviderOrFactory`. Keep private implementation helpers unexported. Remove old generated reference pages/links and old API-card ids in the same commit.

Concretely, remove `selectLegacyLifetime`, `LegacyLifetime`, `compatibilityProvider`, the compatibility overloads that admit `FactoryWithDisposal`, and every `ProviderFactory`/metadata/frames/graph/acquired conditional branch whose checked type is `FactoryWithDisposal`. Change `Registrations` to `Record<string, ProviderOrFactory>` and every builder/module/contribution generic constraint from `Registration` to `ProviderOrFactory`. Delete the `FactoryWithDisposal` interface/type export and its disposer-symbol runtime branch only after the mechanical migration has removed every constructed wrapper. Keep `describe`'s function-or-provider normalization and the new zero-dependency replacement fast overload. If fallback won, remove only the four old decorators and retain the five `providerWith*` calls; if preferred won, export only the five provider prototype methods.

Apply the builder changes explicitly to every callable facade in `src/builder-method-types.ts`: migrate `Registration` constraints to `ProviderOrFactory`, remove the `FactoryWithDisposal` import and compatibility-only branch/overload, and preserve the selected positional fast and general replacement paths with their provider-argument admissions. Retain all six facade exports and generated pages plus `BuilderWithCollectionContribution`; they are not retired provider compatibility contracts. The builder source/negative fixtures and physical producer-deletion proof from Task 1 must pass on the contracted signatures before this commit.

- [ ] **Step 2: Run contract greps**

```bash
rg -n "DiBag\.(withDisposal|withLifetime|withMetadata|transformService)|\bFactoryWithDisposal\b|\bRegistration\b|allowScopedDependencies|root-reach|'root'|'scoped'|'transient'" src tests examples scripts tools AGENTS.md docs/agent
rg -n "root lifetime cannot capture scoped|root-capture|SeeErrors<'root-capture'>" src tests AGENTS.md docs tools
rg -n "runtime package root is not canonical|root failed|exactly one di-bag root entry" tests
```

Expected: first grep finds only codemod inputs, explicit 0.4 compatibility tooling, internal registration-as-domain-word uses, and assertions proving removed APIs; each is reviewed. The second grep matches the same deferred message-family sites as Task 2. The third grep still finds all three unrelated phrases.

- [ ] **Step 3: Regenerate the naming ratchet**

```bash
UPDATE_API_NAMING_VIOLATIONS=1 bun test tests/api-naming.test.ts
bun test tests/api-naming.test.ts tests/documented-names.test.ts
```

Expected: phase-owned `direct`, `awaited`, `mode`, and lifetime `root` entries disappear; unrelated later-phase entries remain.

- [ ] **Step 4: Run full serialized verification**

Obtain the controller's explicit lift of the full-gate hold before this step. The evidence lift, a serialized compiler exception, and a free-memory reading do not authorize these commands.

```bash
npm run check
npm run docs:check
npm run graph:check
npm run codemod:check
npm run typecheck:native
npm run build:native
npm run check:native
npm run build
node --expose-gc --test --test-isolation=none tests/runtime-scale.node.mjs tests/acquisition-retention.node.mjs tests/graph-retention.node.mjs
npm run agent-eval:test
for example in examples/*.ts; do bun "$example"; done
```

Expected: all pass with the phase's selected S2 shape. Run compiler/full-suite commands only in the controller-authorized lane.

Stage every phase-owned source, migrated consumer, generated doc, ratchet, and evidence file after reviewing `git diff --cached --stat`; exclude `/tmp` probes. Commit only after every command above passes:

```text
refactor: remove provider decorator facades

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
```

## Planning Evidence and Self-Review

Fresh runtime evidence: on the disposable 0.4.0 archive, pinned Bun 1.4.0 ran `/tmp/di-bag-resume-20260921/probe-10/tests/zz-provider-methods-prototype.test.ts`; one test and five expectations passed. The probe adds a prototype method to `Provider`, calls it on a frozen handle, derives a frozen owned provider, resolves `7`, and observes disposal `[7]`. The source/test remain in `probe-10`; this is runtime feasibility evidence only.

Fresh syntax evidence after the repair: `node /tmp/di-bag-resume-20260921/probe-10/parse-plan10-repaired.mjs` parsed all 47 top-level complete TypeScript/JavaScript plan blocks with TypeScript 6.0.3 `createSourceFile`; class-member fragments were retried inside a class wrapper and no parse diagnostics remained. The preferred and fallback fenced `@example` blocks live inside four-backtick TypeScript blocks and are parsed as part of their JSDoc comments. Text-only signature sketches with ellipses were intentionally excluded.

Fresh narrow codemod evidence after the repair: `/tmp/di-bag-resume-20260921/review10-codemod-round3/assert.mjs` ran the recovered real rewrite engine against the repaired preferred transform logic and exact main/edge sources at 367 MiB maximum RSS. It proved combined metadata stays unchanged with a manual row, a moved disposal comment survives, duplicate and commented option bags stay unchanged with manual rows, lifetime shorthand emits `{ allowsScopedDependencies: allowScopedDependencies }`, and a local `Provider` lookalike stays unchanged/manual. The isolated engine copy intentionally omits phase 8's provider-source option transform, so the assertion normalizes only that known `createProvider` option difference. It ran no `getPreEmitDiagnostics`, compiler gate, or full cumulative migration.

Historical evidence: current 0.4.0 helper bodies and type stages were read from `src/provider.ts`, `src/provider-operations.ts`, `src/lifetime.ts`, `src/lifetime-types.ts`, and `src/registration.ts`. The four assertion counts come from the controller's measured common notes.

Predicted and uncompiled: all public method overloads, declaration emit, property-located diagnostics, S2 cost, codemod checker behavior on the phase-8 tree, and full integration. The executor must run the listed proofs; this plan claims none as compiled.

Self-review results: every scope item maps to a task; zero-argument mapped factories retain an empty parameter tuple; the expand bridge accepts the authenticated disposal wrapper; the phase-8 external lifetime remapper is explicitly preserved; closing/closed and singleton-capture message families are pinned for plan 12 Task 12; unsafe codemod reconstruction is manual; graph wrapper classification uses declaration owners; preferred and fallback runtime/codemod/worker contracts are printed; accumulated maps/docs are preserved rather than reset.
