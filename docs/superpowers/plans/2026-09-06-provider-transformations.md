# Provider Transformations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add typed immutable provider transformations, retained ownership, and
optional real-box adapters without changing ordinary factory semantics.

**Architecture:** Immutable provider operations describe source acquisition,
mapping, ownership stages, and metadata. The acquisition runtime evaluates those
operations once per attempt and retains every accepted ownership stage, including
late fulfillment after projection failure. Checked inspection keeps static
metadata separate from stage-owned acquisition frames.

**Tech Stack:** TypeScript 5.9.3, Bun tests, Node CJS/ESM declaration consumers,
real locally packed sas-box and val-box packages.

**Spec:** `docs/superpowers/specs/2026-09-06-provider-transformations-design.md`,
bound by `docs/superpowers/specs/2026-09-06-enterprise-di-design.md`.

## Global Constraints

- No required decorators, reflect-metadata, parameter-name parsing, custom compiler transforms, or dynamic code generation.
- Plain functions, classes through adapters, promises, and ordinary service values remain supported.
- Preserve exact synchronous versus Promise-valued service types; never silently await an ordinary factory dependency.
- Preserve `DiBag.withDisposal` and explicit owned-versus-borrowed intent; method names alone never transfer ownership.
- Sharing is configurable and explicit; sharing an instance also shares its already-bound dependencies.
- Application startup closes resources it owns and initiates closure of bags it created; factories clean partial acquisitions before returning ownership.
- Justified public API changes are authorized; document migration and retain supported inference cases in regression tests.
- Test production behavior and compile-time contracts, including negative fixtures; record failing evidence before implementation.
- No publication, remote push, or credential storage without a separate explicit request; prepare local commits, package artifacts, and publishing instructions.
- Do not describe casts, unchecked JavaScript, or dynamically unknown plugins as compile-time proofs.

## Prerequisite and boundaries

Execute after the acquisition-foundation review gate. Preserve its trusted native
observer, exact exposed values, attempt-based edges, conditional retry eviction,
same close barrier, failed-inspection no-raw-disposal contract, and all cleanup
causes. Public typed tokens, lifetimes, sharing, startup, observer hooks, plugins,
and the remaining compiler limits are separate required program increments.

Consume the acquisition final-review native-Promise boundary: automatic tracking
uses direct intrinsic native observation and its own native pending barrier;
structural thenables require explicit native conversion in the source factory.
Explicit async mapping/unboxing may await as named, but sync helpers must not
silently normalize their exact raw output. No TypeError fallback may classify
native versus structural values or erase original setup errors.

## File responsibilities

- `src/provider.ts`: nominal immutable handles, typed provider utilities, metadata
  and transformation helpers, private description registry.
- `src/provider-operations.ts`: internal immutable operation descriptions and
  source normalization contract. No public unchecked constructor.
- `src/provider-execution.ts`: attempt-local evaluation, stage observation and
  stage cleanup, separate from cross-acquisition ordering.
- `src/inspection.ts`: readonly snapshot types and snapshot construction.
- `src/registration.ts`: existing plain/owned compatibility, normalization bridge
  and additive `withDisposal` overload for derived providers.
- `src/types.ts`, `src/module-types.ts`, `src/module.ts`, `src/di-bag.ts`: preserve
  output, requirements, metadata and module export contracts across operations.
- `src/acquisition.ts`, `src/runtime.ts`: attempt retention, inspection, retired
  cleanup integration and shutdown barrier.
- `src/sas-box.ts`, `src/val-box.ts`: optional structural adapter entry points.
- `tests/providers.test.ts`, `tests/projections.test.ts`, `tests/box-adapters.test.ts`:
  focused runtime contracts; `tests/types/providers.ts` and compiler negatives
  carry no-cast source contracts; package tests exercise emitted declarations.

### Task 1: Immutable typed providers, static metadata and checked inspection

**Files:**
- Create: `src/provider.ts`, `src/provider-operations.ts`, `src/inspection.ts`,
  `tests/providers.test.ts`, `tests/types/providers.ts`,
  `tests/types/negative/provider-boundaries.ts`,
  `tests/types/negative/provider-module-metadata.ts`.
- Modify: `src/registration.ts`, `src/types.ts`, `src/module-types.ts`,
  `src/module.ts`, `src/di-bag.ts`, `src/runtime.ts`, `src/acquisition.ts`,
  `src/index.ts`, `tests/types.test.ts`, `tests/package.test.ts`,
  `README.md`, `docs/migrations/0.1-to-enterprise.md`.

**Interfaces:**
- Add `DiBag.withMetadata(registration, metadata)` and `bag.inspect(key)`.
- Export type-only `Provider<F, M, A>`, `ProviderOutput<R>`, `ProviderNeeds<R>`,
  `ProviderMetadata<R>`, `ProviderAcquisitionMetadata<R>`. Here F is the exact
  factory contract, M the readonly static metadata shape, and A an ordered
  readonly tuple of acquisition-frame payload contracts (initially `readonly []`).
- Keep Factory and DisposableFactory registrations supported. A typed Provider
  has a declaration-preserved invariant F/M/A witness and separate private
  nominal provenance. A non-generic internal base may admit concrete providers
  to Registration without violating invariance; an erased base must yield
  unknown output/requirements and fail checked graph closure, never `never`
  output or an empty-needs proof. Do not export its constructor.
- `withMetadata` retains exact source output/needs and all source ownership.
  It accepts only finite namespaced string/unique-symbol keys; reject numeric,
  widened symbol/string indices, and duplicate statically visible keys. Runtime
  preflight uses all own keys (including non-enumerable keys), checks collisions
  before any metadata getter runs, then snapshots/freezes the record. Payloads
  keep identity and remain unfrozen. Namespaced means application-chosen keys,
  not a mandatory punctuation format.
- Inspection does not resolve. Its frozen result has `bindingId: symbol`,
  `label: string`, `metadata: Readonly<M>`, and `acquisitions: readonly
  AcquisitionSnapshot<A>[]`. An attempt snapshot has `acquisitionId: symbol`,
  `state`, and `metadata: FramePresenceTuple<A>`. Each tuple element is a frozen
  `{present:false}` or `{present:true,value:Frame}` record. No service values,
  mutable sets/maps or generic caller assertions are exposed. Empty before
  resolution/after close; plain providers have empty metadata/frames.
- Export readonly snapshot types with exact keys above, including a structural
  `Presence<T>` compatible with val-box; no runtime import from either box.
- Preserve module metadata across exports/rename/install. Add a fourth retained
  module carrier D for public registration contracts, defaulting to existing
  synthetic `PublicRegistrations<P>`. Exported registration contracts expose no
  private needs: existing C still retains every consumer requirement. Use a
  `PublicProvider<R>` type which is `() => ProviderOutput<R>` when metadata/frames
  are empty, otherwise a synthetic Provider with that zero-needs callable and
  exact M/A. `Module<P,R,C,D>` keeps all four contracts invariant; rename maps
  D's public keys, install consumes D instead of discarding it to P alone.
  Keep ModuleProvides/ModuleRequires views unchanged. Explicit annotations may
  not erase nonempty M/A; plain complete annotations remain compatible.
- Normalize operations without adding a second core registry identity. Task1
  only needs source and metadata operations, preserving the existing single
  ownership declaration; additive ownership/mapping is Task2.

- [x] **Step 1: Add runtime and no-cast inference regressions.**

```ts
test('metadata is a snapshot and inspection never starts a factory', async () => {
  let calls = 0;
  const payload = { team: 'platform' };
  const input = { 'app:owner': payload };
  const source = () => { calls++; return { read: () => 42 }; };
  const provider = DiBag.withMetadata(source, input);
  const bag = DiBag.begin().add({ service: provider }).end();
  input['app:owner'] = { team: 'changed' };
  const before = bag.inspect('service');
  expect(calls).toBe(0);
  expect(before.metadata['app:owner']).toBe(payload);
  expect(before.acquisitions).toEqual([]);
  expect(Object.isFrozen(before.metadata)).toBe(true);
  expect(Object.isFrozen(payload)).toBe(false);
  expect(bag.resolve('service').read()).toBe(42);
  expect(bag.inspect('service').acquisitions).toHaveLength(1);
  expect(before.acquisitions).toEqual([]);
  await bag.close();
  expect(bag.inspect('service').acquisitions).toEqual([]);
});
```

Include getter-event assertions proving duplicate preflight precedes value
reads, hidden-own-key collisions through narrowed objects, symbols and frozen
copies, invalid spread/forged providers, retry snapshots and original raw
disposer arguments. Compile the following alongside exact type assertions:

```ts
const decorated = DiBag.withMetadata(
  ({ clock }: { clock: { now(): number } }) => ({ read: () => clock.now() }),
  { 'app:owner': { team: 'platform' } },
);
const unit = DiBag.module().add({ service: decorated }).exports(['service']);
const renamed = unit.rename('service', 'client');
const bag = DiBag.begin().install(renamed).add({ clock: () => ({ now: () => 42 }) }).end();
const team: string = bag.inspect('client').metadata['app:owner'].team;
const value: number = bag.resolve('client').read();
```

Negative fixture markers must reject missing/wrong clock after export/rename,
metadata erasure annotations, duplicate metadata, required callback receivers,
spread handles, incorrect inspection fields and explicit registration erasure.
Existing negative files remain intact; add emitted-declaration equivalents.

- [x] **Step 2: Run the new tests and record RED.**

Run `bun test tests/providers.test.ts` and focused compiler tests added to
`tests/types.test.ts`. Record missing APIs separately from behavioral failures.

- [x] **Step 3: Implement descriptors and carry their complete contracts.**

Use immutable source/metadata descriptions, a private WeakMap, and type-only
provider exports. Introduce public utilities at the existing FactoryOf/Needs/
Provided boundary so add/replace/fork/module checking uses the same extraction.
Preserve the load-bearing direct Registration contextual intersections and
ForkContext's selected-key validation. Extend its accepted registration forms
to genuine typed providers without erasing output compatibility or missing needs.
Implement metadata preflight and frozen inspection snapshots with copied frames.

```ts
type FramePresenceTuple<A extends readonly unknown[]> = {
  readonly [I in keyof A]: Presence<A[I]>;
};
// These are snapshots, not mutable runtime acquisition records.
interface AcquisitionSnapshot<A extends readonly unknown[]> {
  readonly acquisitionId: symbol;
  readonly state: 'creating' | 'pending' | 'ready' | 'failed' | 'disposing' | 'disposed';
  readonly metadata: FramePresenceTuple<A>;
}
```

Module carrier changes must preserve private lexical binding resolution and
all existing independent consumer constraints. Static metadata is still
available after close; acquisition snapshots release retained graphs/values.

- [x] **Step 4: Verify, document and commit.**

Run `bun test tests/providers.test.ts tests/types.test.ts tests/modules.test.ts
tests/package.test.ts`, then `npm run check`, both examples and `git diff --check`.
This changes graph types, so the full nominal-module/registration scale gates
are required. Document snapshot/annotation semantics. Commit
`feat: add typed provider metadata and checked inspection`.

Task1 complete at `06918c8`: independent full verification and task review are
clean. Evidence: `docs/reports/2026-09-06-provider-transformations.md`.

### Task 2: Explicit mappings and separately owned acquisition stages

**Files:**
- Create: `src/provider-execution.ts`, `tests/projections.test.ts`,
  `tests/types/negative/provider-projections.ts`.
- Modify: `src/provider.ts`, `src/provider-operations.ts`, `src/registration.ts`,
  `src/acquisition.ts`, `src/di-bag.ts`,
  `tests/types/providers.ts`, `tests/package.test.ts`,
  `README.md`, `docs/migrations/0.1-to-enterprise.md`.

**Interfaces:**
- Add `DiBag.mapSync<R, P>(registration, project)` with exact input
  ProviderOutput<R>, exact ReturnType<P>, unchanged needs/M/A and receiver-free
  projector. Add `mapAsync` with Awaited<ProviderOutput<R>> input and always
  Promise<Awaited<ReturnType<P>>> output. Validation must not back-infer a wider
  source contract from projector parameters; use NoInfer at that boundary.
- Add `withDisposal(provider, dispose)` as an ownership operation for that
  provider's fulfilled output, retaining every earlier stage. Preserve the
  original factory overload's inferred factory/DisposableFactory contract and
  readonly original create callback exactly. Both disposer parameters require
  `this: void`, rejecting explicit required receivers that bare invocation
  cannot satisfy.
- Internal operations source/owned/map-sync/map-async/metadata evaluate source
  once per attempt. Record finalizers at stable stage indices, not fulfillment
  arrival order. Outer accepted stages close before inner stages; the cross-
  acquisition dependency order remains authoritative.
- An exposed projection determines cache success independently of a raw Promise
  it did not await. Track source pending work and cleanup even if a synchronous
  outer projection succeeds. Failed attempts remain retained while any stage
  can transfer ownership or any finalizer is unfinished.
- Projection failure preserves its original boundary error. It releases only
  that attempt's accepted stages, not cached dependency acquisitions. Late
  accepted ownership is released once. Cleanup failures join close's existing
  DiBagCleanupError with original causes and attempt identities. A failed sync
  resolve does not await asynchronous cleanup. Close drains all pending source,
  projection and retired-cleanup work to a fixed point before completion.
- A retired attempt waits for its own pending source/projection work before
  invoking accepted finalizers, because an in-flight projector may still use
  those values. Then dispose accepted stages in reverse nesting order. This
  does not delay the original resolution error or wait for unrelated retries;
  nonsettling work can retain resources and keep eventual close pending.
- Retired cleanup may overlap across attempts. Preserve the existing aggregate
  contract by ordering cleanup failures by finalizer invocation, not rejection
  completion time: assign an internal sequence at invocation and sort copied
  diagnostic records when closing. This sequence does not retain a stage,
  disposer, exposed value or dependency graph in the final error.
- Pending stages retain in-flight dependency-read permission until their source
  work finishes, even when the exposed projection is already ready. Completed
  and failed escaped proxies cannot borrow another attempt's permission.

- [x] **Step 1: Add exact-value and owned-projection regressions.**

```ts
test('a projected service does not replace its source disposer argument', async () => {
  const raw = { id: 'connection' };
  const events: string[] = [];
  const source = DiBag.withDisposal(() => raw, value => {
    expect(value).toBe(raw); events.push('raw');
  });
  const client = DiBag.withDisposal(
    DiBag.mapSync(source, connection => ({ connection })),
    value => { expect(value.connection).toBe(raw); events.push('client'); },
  );
  const bag = DiBag.begin().add({ client }).end();
  expect(bag.resolve('client').connection).toBe(raw);
  await bag.close();
  expect(events).toEqual(['client', 'raw']);
});

test('a failed sync projection releases late source ownership', async () => {
  const gate = deferred<{ id: string }>();
  const cause = new Error('project');
  const events: string[] = [];
  const raw = DiBag.withDisposal(() => gate.promise, value => { events.push(value.id); });
  const projected = DiBag.mapSync(raw, () => { throw cause; });
  const bag = DiBag.begin().add({ projected }).end();
  expect(() => bag.resolve('projected')).toThrow(cause);
  const closing = bag.close();
  gate.resolve({ id: 'released' });
  await closing;
  expect(events).toEqual(['released']);
});
```

Test mapSync receiving the identical Promise and returning an identical
projected Promise; mapAsync source/projector throws reject and recursive
thenables await. Add a sync status projection holding a rejected source Promise
that stays cached/usable. Test inner pending raw and ready outer owned stages
close in nesting order, two explicit same-object finalizers both run, original
undefined cleanup causes aggregate, and projection failure does not dispose a
separately cached dependency. Gate asynchronous cleanup and assert close remains
pending until the gate resolves; retry before late old completion must not evict
the successful new attempt. Preserve genuine cycles through mapped dependencies.
Add two failed projections whose cleanup starts in A/B order but rejects in B/A
order using separate deferred gates. Assert the aggregate still contains A/B
causes in invocation order and retains each original attempt identity.
Add a gated async projector using an already accepted owned source after a
later mapSync fails. Assert the original sync error is immediate, cleanup has
not run before the gate releases that projector, the projector can use the live
source, close stays pending meanwhile, and finalization happens exactly once.
Source and emitted negative fixtures reject an explicitly receiver-dependent
disposer for both the original factory overload and the added provider overload;
retain exact factory inference and positive receiver-free finalizer cases.

- [x] **Step 2: Record RED for missing helpers and stage ownership.**

Run `bun test tests/projections.test.ts` and projection compiler fixtures. Keep
behavioral failure evidence separate from helper-export loading failures.

- [x] **Step 3: Implement operation evaluation and retired cleanup.**

Keep evaluation in provider-execution.ts; Acquisitions owns cache identity,
cross-attempt edges and close state. Native observer callbacks only update their
own attempt/stage, and internally observed Promises do not leak unhandled
rejections. Retire failed attempts rather than deleting accepted/pending work.

```ts
interface AcceptedStage {
  readonly index: number;
  readonly value: unknown;
  readonly dispose: (value: never) => void | Promise<void>;
  state: 'accepted' | 'disposing' | 'disposed';
}
// Reverse index orders nested ownership independently of asynchronous arrival.
// Mark a stage disposing before invoking its receiver-free finalizer.
// Publish and reuse its completion barrier to prevent concurrent double cleanup.
// Record an invocation sequence before each call, not when its Promise rejects.
```

Use explicit map operation tags for awaiting behavior. Never infer sync-vs-async
helper semantics from erased structural output types. Preserve inspection's
copied views and free successful/retired attempt state in shutdown's finally.

- [x] **Step 4: Verify, document and commit.**

Run providers/projections/acquisition/disposal/runtime/modules/package tests and
the provider compiler fixtures, then `npm run check`, both examples and diff
checks. Document additive ownership and sync-failure/asynchronous-cleanup timing.
Commit `feat: preserve staged ownership through provider mappings`.
The existing `src/index.ts` DiBag re-export exposes the new static methods;
no additional barrel symbol or textual barrel edit is required by this task.

Task2 complete at `6a71ab4`: independent exact-commit full verification and task
review are clean. Evidence: `docs/reports/2026-09-06-provider-transformations.md`.

### Task 3: Optional real sas-box and val-box adapters

**Files:**
- Create: `src/sas-box.ts`, `src/val-box.ts`, `tests/box-adapters.test.ts`,
  `tests/box-package.test.ts`, `tests/types/box-adapters.ts`,
  `tests/types/negative/box-adapters.ts`, `examples/box-adapters.ts`.
- Generate test-only artifacts: `tests/fixtures/box-packages/sas-box-0.1.0.tgz`,
  `tests/fixtures/box-packages/val-box-0.1.0.tgz`; create
  `tests/fixtures/box-packages/README.md` with revision/checksum provenance.
- Modify: `src/provider.ts`, `src/provider-operations.ts`, `src/provider-execution.ts`,
  `src/acquisition.ts`, `src/runtime.ts`, `src/index.ts`, `tests/types.test.ts`,
  `tests/projections.test.ts`, `tests/providers.test.ts`, `package.json`,
  `tsconfig.build.json`, `README.md`, `docs/migrations/0.1-to-enterprise.md`.

**Interfaces:**
- `di-bag/sas-box` exports fromSasBox with mandatory mode sync/async/sync-first.
  Sync requires immediate callable sync capability and returns its exact raw
  value. Async awaits source then calls async; sync-first awaits source then
  chooses callable sync else async. Both async modes return native Promise of
  Awaited value. Preserve receiver and exact capability requirements.
- Sync-first requires an explicitly present `sync` field. An always-callable
  sync method is sufficient; if undefined is possible, async must be callable
  too. Missing/optional sync fields reject this mode even when async is present:
  structural narrowing can hide an incompatible sync method. Real SasBox
  Sync/Async/Unknown classes have the required field. Compute the union of all
  possible awaited callback outputs; only an always-callable sync excludes the
  async fallback result. A union mode validates every possible route.
- Selected capability methods must accept zero ordinary arguments, and their
  explicit receiver type (if any) must accept the acquired box. Preserve the
  receiver at runtime; accepting an incompatible declared receiver is not a
  substitute for forwarding it. Apply the same zero-argument/receiver check
  to val-box snapshot methods.
- `di-bag/val-box` exports fromValBox (immediate source) and fromValBoxAsync
  (awaited source, always Promise). No options means required value; supplied
  options requires `value: 'required' | 'presence'`. Union modes yield union
  outputs; `{}` must not select a hidden mode. Default absence throws.
- Use the structural snapshot protocol once per acquisition. Validate outer
  record, each presence discriminator, required present value slots and
  string/null alias; inspect no erased payload types. Copy/freeze snapshots,
  preserving present-undefined and payload identity.
- Append a val-box acquisition frame `{kind:'val-box', metadata:Presence<M>,
  alias:string|null}`. Earlier frames are retained in order. Failure while
  snapshotting/unboxing uses Task2's ordinary retired cleanup. Raw box disposal
  never receives the unboxed result; outer ownership remains explicit.
  Export its `ValBoxFrame<M>` type from the adapter and root type-only barrel;
  the root export introduces no runtime adapter import or box dependency.
- Extend the internal provider transformation helper to carry the adapter's
  appended frame tuple while retaining exact source needs/static metadata.
  Expose only copied execution-frame snapshots through Acquisitions.inspect;
  its current empty tuple is replaced by the actual attempt frames. Runtime's
  internal inspection return uses a readonly unknown-frame tuple, while the
  checked Bag facade retains exact provider A. These narrow bridges do not
  change ordinary resolution, ownership, cache, or graph identity contracts.
- Adapter subpaths use the same compiled CJS core registry for CJS/ESM users;
  no mandatory runtime/peer import of either box. Core-only consumers have
  neither package installed. Tests install real verified tarballs in temporary
  consumers, never copied box source.
- The existing generic frame types in `src/inspection.ts` already express the
  required tuple; retain them unchanged. Include the new subpath entry points
  in the declaration build, and use a focused provider-engine regression to
  distinguish frame behavior from missing public package exports.
- Keep the verified real tarballs as versioned test-only fixtures, not external
  temporary paths or unresolved unpublished dev dependencies. Document exact
  provenance/checksums and verify di-bag's own packed file list excludes both
  archives and extracted box implementations. No copied box source enters src.

- [x] **Step 0: Correct retained failed-exposure edges before adding adapters.**

A post-Task2 controller probe found that retaining a failed attempt for pending
cleanup also retains its caller's failed dependency edge. A late source can
then falsely cycle when it reads that caller after the caller caught the exposed
failure and completed. Add the following regression to projections.test.ts;
run it to record RED, then correct incoming failure-edge abandonment without
deleting the pending attempt, its own real dependencies, or genuine cycle checks.

```ts
test('a retired source can finish through a caller that caught its projection failure', async () => {
  const gate = deferred<void>();
  const cause = new Error('projection');
  const events: string[] = [];
  let pending!: Promise<{ name: string }>;
  const source = DiBag.withDisposal((deps: { parent: { name: string } }) => {
    pending = (async () => { await gate.promise; return { name: deps.parent.name }; })();
    return pending;
  }, value => { events.push(value.name); });
  const bag = DiBag.begin().add({
    parent: (deps: { failed: unknown }) => {
      try { void deps.failed; } catch (error) { expect(error).toBe(cause); }
      return { name: 'parent' };
    },
    failed: DiBag.mapSync(source, () => { throw cause; }),
  }).end();
  expect(bag.resolve('parent')).toEqual({ name: 'parent' });
  const closing = bag.close();
  gate.resolve();
  await expect(pending).resolves.toEqual({ name: 'parent' });
  await closing;
  expect(events).toEqual(['parent']);
});
```

Run the projections/acquisition/runtime/disposal/module suites after the fix.
Retain source in-flight permission and retry identity tests. Adapter regressions
must also cover a caught unboxing failure with legitimate pending source work.
This is a prerequisite correction to failed-attempt semantics, not a new
lifetime or caching policy.

- [x] **Step 1: Add structural runtime and packed-consumer regressions.**

```ts
test('val-box metadata captures presence and alias without owning the payload', async () => {
  const payload = { read: () => 42 };
  const metadata = { owner: 'platform' };
  const events: string[] = [];
  const raw = {
    snapshot() {
      return { value: { present: true as const, value: payload },
        metadata: { present: true as const, value: metadata }, alias: 'db' };
    },
  };
  const registration = fromValBox(DiBag.withDisposal(() => raw, value => {
    expect(value).toBe(raw); events.push('box');
  }));
  const bag = DiBag.begin().add({ service: registration }).end();
  expect(bag.resolve('service')).toBe(payload);
  const attempt = bag.inspect('service').acquisitions[0]!;
  const frame = attempt.metadata[0];
  expect(frame.present).toBe(true);
  if (frame.present) {
    expect(frame.value.alias).toBe('db');
    expect(frame.value.metadata).toEqual({ present: true, value: metadata });
  }
  await bag.close();
  expect(events).toEqual(['box']);
});
```

Test missing/undefined values and metadata, empty/null aliases, getter throws,
invalid unchecked snapshot shape, nested val-box frames, later box mutation,
and raw cleanup after unboxing failure. Test sas-box sync-only/async-only/dual
capabilities, Promise-returning sync access, receiver use, callback throws,
sync-first preference and one call per bag acquisition. Compiler negatives
reject sync Promise boxes, async-only sync use, wrong method shapes, hidden
options modes, wrong disposer arguments and erased metadata contracts.
Include the no-cast hidden-capability counterexample and rejection below in
source and emitted fixtures, while explicit async mode remains valid:

```ts
const dual = { sync: () => 42, async: async () => 'async' };
const asyncView: { async(): Promise<string> } = dual;
// diagnostic: sync-first requires the complete sync capability field
fromSasBox(() => asyncView, { mode: 'sync-first' });
```

Also reject a `sync?: never` narrowed view; optional absence does not rule out
the same hidden method. Accept `{sync: undefined, async: async () => 'async'}`,
a sync-only callable source, and the real SasBox Unknown capability union with
its exact awaited output. Reject an async-only source under a union mode that
can select sync, and assert the correct output union for fully supported modes.
Reject selected methods requiring an ordinary argument or an incompatible
explicit `this`; retain a positive method whose receiver is its actual box.

Packed-consumer tests use the verified local repositories' artifacts documented
in `docs/reports/2026-09-06-box-foundations.md`. Generate the committed test-only
archives using each unchanged box checkout's `npm pack --ignore-scripts
--pack-destination /absolute/repo/tests/fixtures/box-packages` and verify their
SHA-512 matches the recorded verified archive. Existing emitted box output is
already verified; rebuild only if needed and verify any changed artifact before
adoption. Record fixture paths/checksums and checkout revisions. The tests resolve
fixtures relative to the repo, without .related-repos or /tmp assumptions.
Install into mktemp consumers with `npm install
--offline --ignore-scripts` using explicit absolute tarball paths, then run real
Node CJS/ESM and strict declaration fixtures importing di-bag and both boxes.
Use the real box constructors/snapshot methods from their emitted declarations.
Include a core-only consumer without boxes and a cross-loader descriptor test.
Assert the packed di-bag archive contains neither fixture tarballs nor installed
box implementations; a fixture is testing input, not a bundled runtime library.

- [x] **Step 2: Record runtime and declaration RED.**

Run `bun test tests/box-adapters.test.ts tests/box-package.test.ts`; compiler
fixtures initially report missing subpaths/capabilities. Capture a separate
behavioral failure when packaging errors would otherwise mask lifecycle cases.

- [x] **Step 3: Implement explicit adapters and typed acquisition frames.**

Reuse mapping/source/ownership operations rather than special box cleanup.
Only trusted adapter evaluation can populate its own assigned frame index;
no public untyped callback may change provider output/mode/ownership promises.
Copy records at acquisition, not inspection time from a mutable raw box.
Allocate every declared frame position as absent when the attempt starts,
before any asynchronous adapter can finish; a pending frame is a frozen
`{present:false}` record, never a missing array element typed as present.

```ts
type ValBoxFrame<M> = {
  readonly kind: 'val-box';
  readonly metadata: Presence<M>;
  readonly alias: string | null;
};
// Adapter output carries readonly [...ExistingFrames, ValBoxFrame<M>].
// mapSync/mapAsync/withDisposal/withMetadata retain that tuple unchanged.
```

Add explicit package subpath exports to compiled files and declaration files.
Use no decorator configuration, dynamic generated functions, or copied library
implementation. The runnable example explains borrowed payload versus owned box.

- [x] **Step 4: Verify, document and commit.**

Run full `npm run check`, both existing examples, the new box example and real
packed-consumer tests. Record exact package revisions/artifacts and no-box core
proof. Update optional-adapter usage, absence modes, snapshot frames and disposal
examples. Commit `feat: add optional typed sas-box and val-box adapters`.

Record the bounded context-sensitive inline nested-method factory limitation
and its exact predeclared-factory workaround (same body, no annotation/cast).
Preserve exact inferred payload/frame contracts in positive fixtures. Carry
the original inline expression and failed signature hypotheses into the required
T2 compiler/inference follow-up; Task3 must not weaken source validation or claim
that this remaining inference requirement is complete.

## Coverage self-review

Task1 covers ordinary registration preservation, immutable nominal contracts,
static metadata, checked snapshots and module metadata retention. Task2 covers
explicit sync/async mapping, additive ownership, failed/late stage cleanup and
exact original error/value identity. Task3 covers both optional adapter subpaths,
presence frames, capabilities and real package integration. All tests retain the
existing type-negative and package gates. This plan completes transformation and
box-adapter portions of E2, not observer hooks or the whole enterprise program.
