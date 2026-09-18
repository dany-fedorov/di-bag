# Acquisition-Local Disposer Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unreleased `context.defer(action)` with `factoryCtx.pushDisposer(disposer)`: a LIFO disposer stack that rolls back at once when the factory fails and that the bag owns, below every service-level disposer, once the factory returns. Each pushed disposer receives a `DisposerContext` saying why it runs. Issue #32 is fixed on the way: rollback is anchored on the source stage, not on the attempt's result.

**Architecture:** `AcquisitionRollback` in `src/provider-execution.ts` becomes `DisposerStack` and stays the only thing the frozen `AcquisitionContext` references. `ProviderExecution.settleDisposers(state)` runs wherever the source stage settles (`evaluate` for a synchronous source, `finish()` for a native promise). A failed source schedules the stack as pending work of the execution with reason `'factory-failed'`; a ready source accepts the stack into ownership, so `hasOwnership` is true, `compact()` keeps the record, `disposeAll` visits the attempt, and `disposeStages` runs the stack after the accepted stages with a reason computed from their outcomes. `ScopeAcquisitions` changes only in names, the `retire()` guard, and `collectProgress`.

**Tech Stack:** TypeScript, bun:test, node:test with `--expose-gc` for retention.

**Spec:** `docs/superpowers/specs/2026-09-17-acquisition-local-cleanup.md` (rewritten in Task 7).

**Starting point:** `main` at 2e6602f. Prototypes in the session scratchpad `<scratchpad>/`: `proto/` (fix (d) only; 482/482 fast, tsc, 32/32 retention), `proto3/` (fix (d) + stack ownership without reasons; 479/482 fast — the three expected semantic changes — tsc, 32/32 retention), `proto3-provider-execution.diff` (main → proto3), and the probes `issue32.test.ts` (P1–P9), `stack-probe.test.ts` (S1–S11), `lifetime-probe.test.ts` (L1–L3), `pinned-shape.mjs`, `stack-retention.node.mjs`. The code quoted below is proto3 plus the reason plumbing; reuse it.

## Global Constraints

- Zero runtime dependencies; minimum TypeScript 6.0.3; `npm run check:native` must keep passing.
- Library errors only through `libraryError` with a `DI_BAG_*` code and frozen `details`. The two codes here are unchanged: `DI_BAG_INVALID_CLEANUP`, `DI_BAG_CLEANUP_AFTER_FACTORY`.
- `AGENTS.md` is at 150/150 lines (`tools/docs/lib/agent-docs.mjs` `agentsBudget`); every edit must keep it at 150 or fewer. Each `##` recipe in `docs/agent/recipes.md` must stay under 60 lines (`recipeBudget`; the check is `lines >= 60` → error). `docs/agent/api-card.md` (337 lines) must stay at or under 400 and is generated — never hand-edit it.
- `npm run docs:check` type-checks every snippet in `AGENTS.md` and `docs/agent/` against declarations emitted from `src`, so a docs snippet can be written before `npm run build`.
- `CHANGELOG.md` gains no `## Unreleased` heading (`tests/release-artifacts.test.ts`); the changelog text lives in the design note.
- Retention suites are CI-only and have caught two bugs on this feature. Run `npm run build && node --expose-gc --test --test-isolation=none tests/runtime-scale.node.mjs tests/acquisition-retention.node.mjs tests/graph-retention.node.mjs` at the end of Tasks 2, 3, 4 and 5.
- Negative fixture markers (`// diagnostic: <substring>`) must match tsc6 and native tsc; verify with the command in Task 1 Step 3, never by guessing.
- `tests/package.test.ts` has a pre-existing 5 s timeout flake under load; rerun it alone before treating it as a regression.
- Parameter names in every doc, JSDoc, test and fixture: `factoryCtx` for the factory context, `disposerCtx` for the disposer context. Never `context` or `ctx`.
- Commit prefixes: `feat:`, `fix:`, `test:`, `docs:`, `chore:`. `npm run typecheck && npm run test:fast` before every commit.

## Decisions this plan takes where the design was silent

1. **Reason with mixed stage outcomes.** `disposeStages` first awaits every barrier (`while (this.pending.size) await Promise.all(this.pending)`), so by the time a reason is computed no stage is pending and every owner queued on a pending stage has either been accepted or dropped by that stage's rejection. The reason is then a pure function of the accepted stages: none → `'no-service-disposer'`; any disposer threw → `'service-disposal-failed'`; otherwise `'service-disposed'`. A `map-async` stage still pending at close is settled by the barrier wait before any disposer runs, exactly as today (S1 confirmed the order `projected.dispose, session.close, socket.close, pool.end` with the projection still pending when `close()` was called).
2. **#32 fulfil shape** (`withDisposal(transformService(src, { mode: 'direct', transform: p => ({ wrapped: p }) }), dispose)` whose source fulfils after the wrapper was handed out): the stack is accepted at source fulfilment; the wrapper's stage was accepted synchronously in `evaluate`. At close the reason is `'service-disposed'` (or `'service-disposal-failed'`), and `'no-service-disposer'` when nothing owns the wrapper. Order: wrapper disposer, then the stack (S4, S4b).
3. **Retire after a projection failure** (source returned, `map-async` projection threw): the stages accepted are the source's `withDisposal` (index 0); the failed projection's own `owned` stage was never accepted. Reason `'service-disposed'` / `'service-disposal-failed'` / `'no-service-disposer'` from those stages; order `session.close, socket.close, pool.end` (S3). This is the desired semantics: the attempt is dead, nobody received a value, everything it acquired is released, each once.
4. **`disposerCtx` is one frozen object per run**, built once in `runDisposers` and passed to every disposer of that run: `Object.freeze({ reason })`. Disposers of one run therefore see the same object; a disposer that mutates it throws in strict mode, which the negative fixture also pins at the type level.
5. **Export.** `DisposerContext` is exported from `src/index.ts` next to `AcquisitionContext`; `src/node.ts` does `export * from './index'`, so `di-bag/node` gets it for free. It is an `interface`, matching `CloseProgress` and `AcquisitionContext`.
6. **Failure path reason is always `'factory-failed'`**, including the #32 failure shape where the attempt owns a projection stage: the stack runs at source failure before that stage is disposed at close (the F2 inversion, documented). The stack is drained by then, so the close-time run disposes only the wrapper.
7. **`raw` asynchronous factories.** A push before the first `await` is accepted when the factory returns (the raw stage is ready on return) and runs at close with a service reason; the promise's later rejection is never observed, so such a push never runs with `'factory-failed'`. A push after the first `await` throws `DI_BAG_CLEANUP_AFTER_FACTORY` as today (S6). Documented under F3.
8. **Close progress.** `ProviderExecution` gains `get rollingBack(): boolean`, true while the failure-path run is in flight; `collectProgress` reports such an attempt under `pending`. The ordinary failure shape is already covered by `retired`; this closes the #32-shape gap.
9. **`api-card-tasks.json` is not changed.** The card is generated from facade/builder/bag JSDoc and cannot link an interface member, so no "own a resource acquired inside a factory" row is possible. AGENTS.md rule 6 and the recipe are the discovery path.
10. **Test parameter names** follow the docs convention (`factoryCtx`, `disposerCtx`) so the rule is greppable everywhere. The `ContextFactory` type and the `fromFactory` overload rename their `context` parameter to `factoryCtx` as well, since typedoc prints them.
11. **The spec file keeps its name**; the tests and issue link to it.

---

### Task 1: The API surface — `pushDisposer`, `DisposerContext`, `DisposerStack`

Semantics are unchanged in this task (success still discards the stack), so the renamed suite must pass unchanged.

**Files:**
- Modify: `src/acquisition-context.ts:10-26` (the `AcquisitionContext` JSDoc and interface, `ContextFactory`) and `:47`, `:70` (parameter names)
- Modify: `src/provider-execution.ts:9-42` (`AcquisitionRollback`), `:99-100`, `:111`, `:119`, `:161`, `:258`, `:302`, `:332`
- Modify: `src/acquisition.ts:7` (import), `:171-186` (`acquisitionContext`), `:293-300` (`rollback` destructure)
- Modify: `src/index.ts:12`
- Modify: `tests/types/startup.ts:1,27-31,45-47`, `tests/types/negative/startup.ts:48-57`
- Modify: `tests/acquisition-cleanup.test.ts` (mechanical rename only)

**Interfaces:**
- Produces: `export interface DisposerContext { readonly reason: 'factory-failed' | 'no-service-disposer' | 'service-disposed' | 'service-disposal-failed' }`.
- Produces: `AcquisitionContext.pushDisposer(this: void, disposer: (this: void, disposerCtx: DisposerContext) => void | Promise<void>): void`; `defer` is removed.
- Consumes (internal): `ProviderExecution.disposers: DisposerStack | undefined`, `DisposerStack.push/settle/pending/drain`.

- [ ] **Step 1: Write the failing type fixtures**

In `tests/types/startup.ts` change the import on line 1 to include `type DisposerContext`, replace lines 27–31 with:

```ts
export const pushed = DiBag.fromFactory((_deps: {}, factoryCtx) => {
  factoryCtx.pushDisposer(() => {});
  factoryCtx.pushDisposer(async disposerCtx => { const reason: DisposerContext['reason'] = disposerCtx.reason; void reason; });
  return 'owned' as const;
}, { context: 'acquisition' });
```

and replace the three `defer`/`rollback` assertions (lines 45–47) with:

```ts
  Assert<Equal<Parameters<AcquisitionContext['pushDisposer']>, [disposer: (this: void, disposerCtx: DisposerContext) => void | Promise<void>]>>,
  Assert<Equal<ReturnType<AcquisitionContext['pushDisposer']>, void>>,
  Assert<Equal<DisposerContext['reason'], 'factory-failed' | 'no-service-disposer' | 'service-disposed' | 'service-disposal-failed'>>,
  Assert<Equal<ProviderOutput<typeof pushed>, 'owned'>>,
```

Rename every remaining `context` parameter in that file to `factoryCtx` (`_context` → `_factoryCtx`).

In `tests/types/negative/startup.ts` add `DisposerContext` to the type import and replace lines 48–57 with:

```ts
DiBag.fromFactory((_deps: {}, factoryCtx) => {
  // diagnostic: Cannot assign to 'signal' because it is a read-only property
  factoryCtx.signal = new AbortController().signal;
  // diagnostic: Property 'abort' does not exist on type 'AcquisitionContext'
  factoryCtx.abort();
  // diagnostic: Argument of type 'number' is not assignable to parameter of type '(this: void, disposerCtx: DisposerContext) => void | Promise<void>'
  factoryCtx.pushDisposer(1);
  // diagnostic: Target signature provides too few arguments. Expected 2 or more, but got 1.
  factoryCtx.pushDisposer((_disposerCtx: DisposerContext, extra: number) => extra);
  factoryCtx.pushDisposer(disposerCtx => {
    // diagnostic: Cannot assign to 'reason' because it is a read-only property
    disposerCtx.reason = 'factory-failed';
    // diagnostic: have no overlap
    if (disposerCtx.reason === 'disposed') return;
  });
}, { context: 'acquisition' });
```

The old marker "Target signature provides too few arguments. Expected 1 or more, but got 0." is wrong under the new signature (the callback now receives one argument); the replacement passes a two-parameter callback so the message stays "too few arguments" with the new counts. Do not keep the old line.

- [ ] **Step 2: Run the type check to verify it fails**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: errors in `tests/types/startup.ts` — `pushDisposer` does not exist on `AcquisitionContext`, `DisposerContext` is not exported.

- [ ] **Step 3: Implement the surface**

`src/acquisition-context.ts` — replace lines 10–26 with:

```ts
/**
 * Why a pushed disposer is running: the factory never returned, or it did and the
 * attempt's service-level disposers — `withDisposal` on the returned value and any
 * projection ownership — have just run.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#release-partial-acquisition
 */
export interface DisposerContext {
  /**
   * `'factory-failed'`: the factory threw, rejected, or was cancelled; no service exists.
   * `'no-service-disposer'`: the factory returned and nothing owns the service.
   * `'service-disposed'`: every service-level disposer ran without throwing.
   * `'service-disposal-failed'`: a service-level disposer threw; pushed disposers still run.
   */
  readonly reason: 'factory-failed' | 'no-service-disposer' | 'service-disposed' | 'service-disposal-failed';
}
/**
 * Cooperative cancellation and acquisition-local ownership supplied to a context-aware factory.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#start-selected-services-and-cancel-cooperatively
 */
export interface AcquisitionContext {
  /** Aborted when the acquisition's owning scope begins closing. */
  readonly signal: AbortSignal;
  /**
   * Own a resource this factory has already acquired. Pushed disposers run exactly once, last
   * pushed first: at once if the factory fails, otherwise at `close()` after every service-level
   * disposer, with `disposerCtx.reason` saying which. Give each resource one disposer — here or
   * in `withDisposal`, not both — or test `reason` before releasing a resource the service owns.
   * @param disposer - Releases the resource acquired immediately before this call.
   */
  pushDisposer(this: void, disposer: (this: void, disposerCtx: DisposerContext) => void | Promise<void>): void;
}
type ContextFactory = (this: void, deps: never, factoryCtx: AcquisitionContext) => unknown;
```

Also rename `context` → `factoryCtx` in the overload on line 47 and the wrapper on line 70 (`(deps: never, factoryCtx?: AcquisitionContext) => (callback as ContextFactory)(deps, factoryCtx!)`).

`src/index.ts:12` → `export type { AcquisitionContext, ContextualFactory, DisposerContext } from './acquisition-context';`

`src/provider-execution.ts` — delete `type DeferredAction` (line 9) and replace `AcquisitionRollback` (lines 11–42) with:

```ts
type PushedDisposer = (this: void, disposerCtx: DisposerContext) => void | Promise<void>;

/**
 * One factory's pushed disposers. It is held by the frozen acquisition context
 * handed to that factory, so it deliberately references neither the execution
 * nor its scope: a context the application retains must keep nothing but its
 * own registrations alive.
 */
export class DisposerStack {
  private readonly disposers: PushedDisposer[] = [];
  private settled = false;

  /** Own a resource the running factory already holds. */
  push(disposer: PushedDisposer): void {
    if (typeof disposer !== 'function') throw libraryError('DI_BAG_INVALID_CLEANUP', 'pushDisposer requires a function', { operation: 'pushDisposer', provided: typeof disposer });
    // A retained context is a leak, not a stack: registration closes with the factory.
    if (this.settled) throw libraryError('DI_BAG_CLEANUP_AFTER_FACTORY', 'pushDisposer is only available while its factory is running', { operation: 'pushDisposer' });
    this.disposers.push(disposer);
  }

  /** The factory settled; nothing more can be pushed. Success keeps the stack (Task 3); until then it is discarded. */
  settle(state: 'ready' | 'failed'): void {
    this.settled = true;
    if (state === 'ready') this.disposers.length = 0;
  }

  get pending(): boolean { return this.disposers.length > 0; }

  /** Take every pushed disposer, last pushed first, and close registration for good. */
  drain(): readonly PushedDisposer[] {
    this.settled = true;
    return this.disposers.splice(0).reverse();
  }
}
```

Add `import type { AcquisitionContext, DisposerContext } from './acquisition-context';` (line 5). Rename the field: `readonly rollback: AcquisitionRollback | undefined` → `readonly disposers: DisposerStack | undefined` (line 100), `this.rollback = new AcquisitionRollback()` → `this.disposers = new DisposerStack()` (line 111), `this.rollback?.pending` (119), `this.rollback?.settle(...)` (161, 258), `this.rollback?.drain()` (302, 332). In `disposeStages` (line 302) call each drained disposer as `await disposer(Object.freeze({ reason: 'factory-failed' }))` for now — Task 3 replaces this loop. `CompletedExecution.rollback` (line 80) → `readonly disposers = undefined`.

`src/acquisition.ts` — import `DisposerStack` instead of `AcquisitionRollback` (line 7); `acquisitionContext(disposers: DisposerStack)` returns

```ts
    return Object.freeze({
      signal: this.cancellationSignal(),
      pushDisposer: (disposer: (this: void, disposerCtx: DisposerContext) => void | Promise<void>) => { disposers.push(disposer); },
    });
```

(add `DisposerContext` to the type import on line 11); `const { rollback } = execution;` → `const { disposers } = execution;` and `disposers && this.acquisitionContext(disposers)`.

- [ ] **Step 4: Mechanical rename in the runtime tests**

In `tests/acquisition-cleanup.test.ts` apply, in order: `context.defer(` → `factoryCtx.pushDisposer(`; `, context)` → `, factoryCtx)` and `, context):` → `, factoryCtx):`; `escaped = context` / `first = context` → `= factoryCtx`; `escaped.defer` / `first.defer` → `.pushDisposer`; `{ defer: (action: () => void) => void }` → `{ pushDisposer: (disposer: () => void) => void }`; `(context as { defer: (action: unknown) => void }).defer(42)` → `(factoryCtx as { pushDisposer: (disposer: unknown) => void }).pushDisposer(42)`; `context.signal` → `factoryCtx.signal`; `=> context,` → `=> factoryCtx,`. Then `grep -n "context\b" tests/acquisition-cleanup.test.ts` must show only `{ context: 'acquisition' }`. Also rename the `context` parameters in `tests/startup.test.ts` and `tests/selected-scope-runtime.test.ts` (signal-only uses) to `factoryCtx`.

- [ ] **Step 5: Verify the markers against both compilers**

Run (the scratch config exists from the review; it only points `include` at the negative fixture and `typeRoots` at the project):

```sh
for c in "npx tsc6" "npx tsc"; do echo "== $c"; $c -p <scratchpad>/tsconfig.negative.json 2>&1 | grep -A3 "negative/startup.ts(4[8-9]\|negative/startup.ts(5[0-9]\|negative/startup.ts(6[0-3]"; done
```

Expected: both compilers print, for the new lines, messages containing each marker substring — in particular `parameter of type '(this: void, disposerCtx: DisposerContext) => void | Promise<void>'`, `Expected 2 or more, but got 1.`, `Cannot assign to 'reason'`, and `have no overlap`. If a compiler prints the parameter type without `disposerCtx` or with different spacing, copy the printed text into the marker; if the two compilers differ, shorten the marker to the common substring. Then `npm run test:compiler -- tests/types.test.ts` is not needed here; `npm run typecheck` plus this check is the gate for the fixtures until Task 8.

- [ ] **Step 6: Run the type check and fast lane, then commit**

Run: `npm run typecheck && npm run test:fast`
Expected: PASS, 482 tests (behaviour unchanged).

```bash
git add src tests/types tests/acquisition-cleanup.test.ts tests/startup.test.ts tests/selected-scope-runtime.test.ts
git commit -m "feat(acquisition): rename defer to pushDisposer and hand each disposer a DisposerContext"
```

---

### Task 2: Rollback anchored on the source stage (issue #32), reason `'factory-failed'`

**Files:**
- Modify: `src/provider-execution.ts` (`settleDisposers`, `rollbackDisposers`, `runDisposers`; `evaluate`, `finish`)
- Modify: `tests/acquisition-cleanup.test.ts`

**Interfaces:**
- `ProviderExecution` gains private `settleDisposers(state)`, `rollbackDisposers()`, `runDisposers(reason): Promise<boolean>`.

- [ ] **Step 1: Write the failing tests**

Replace the pinned test `'a direct projection over a rejecting source defers its rollback to close'` (lines 107–127) with the four below, and add the rest at the end of the file. Every assertion that rollback already ran is preceded by a macrotask yield: bun's `rejects` on an already-settled promise resumes the test before the rollback microtask, so `expect(events).toEqual([])` right after the rejection passes even when rollback has run (`pinned-shape.mjs` demonstrates it). Add `const tick = () => new Promise<void>(resolve => setImmediate(resolve));` near the top.

```ts
test('a direct projection over a rejecting source runs its rollback when the source settles', async () => {
  const events: string[] = [];
  const bag = DiBag.createBuilder().register({
    service: DiBag.withDisposal(
      DiBag.transformService(
        DiBag.fromFactory((_deps: {}, factoryCtx) => {
          factoryCtx.pushDisposer(() => { events.push('rollback'); });
          return Promise.reject(new Error('source'));
        }, { context: 'acquisition', acquisitionMode: 'nativePromise' }),
        { mode: 'direct', transform: promise => ({ wrapped: promise }) },
      ),
      () => { events.push('dispose'); },
    ),
  }).build();
  const wrapper = bag.resolve('service');
  await expect(wrapper.wrapped).rejects.toThrow('source');
  await tick();
  expect(events).toEqual(['rollback']);
  await bag.close();
  // The owned wrapper is disposed at close; the stack already ran when the factory failed.
  expect(events).toEqual(['rollback', 'dispose']);
});

test('a direct projection over a rejecting source with no ownership still runs its rollback', async () => {
  const events: string[] = [];
  const bag = DiBag.createBuilder().register({
    service: DiBag.transformService(DiBag.fromFactory(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { events.push('rollback'); });
      await Promise.resolve();
      throw new Error('source');
    }, { context: 'acquisition' }), { mode: 'direct', transform: promise => ({ wrapped: promise }) }),
  }).build();
  await expect(bag.resolve('service').wrapped).rejects.toThrow('source');
  await tick();
  expect(events).toEqual(['rollback']);
  expect(bag.inspect('service').acquisitions[0]!.state).toBe('ready');
  await bag.close();
  expect(events).toEqual(['rollback']);
});

test('a disposer pushed after a direct wrapper was handed out is still honoured', async () => {
  const events: string[] = [];
  const bag = DiBag.createBuilder().register({
    service: DiBag.transformService(DiBag.fromFactory(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { events.push('early'); });
      await Promise.resolve();
      factoryCtx.pushDisposer(() => { events.push('late'); });
      throw new Error('source');
    }, { context: 'acquisition' }), { mode: 'direct', transform: promise => ({ wrapped: promise }) }),
  }).build();
  await expect(bag.resolve('service').wrapped).rejects.toThrow('source');
  await tick();
  expect(events).toEqual(['late', 'early']);
  await bag.close();
});

test('a close racing an in-flight rollback waits for it before disposing anything', async () => {
  const events: string[] = [];
  const gate = deferred<void>();
  const bag = DiBag.createBuilder().register({
    service: DiBag.withDisposal(DiBag.transformService(DiBag.fromFactory(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(async () => { events.push('rollback-start'); await gate.promise; events.push('rollback-end'); });
      await Promise.resolve();
      throw new Error('source');
    }, { context: 'acquisition' }), { mode: 'direct', transform: promise => ({ wrapped: promise }) }), () => { events.push('dispose'); }),
  }).build();
  await expect(bag.resolve('service').wrapped).rejects.toThrow('source');
  const closing = bag.close();
  await tick();
  expect(events).toEqual(['rollback-start']);
  gate.resolve();
  await closing;
  expect(events).toEqual(['rollback-start', 'rollback-end', 'dispose']);
});

test('a failing factory hands every pushed disposer the same frozen factory-failed context', async () => {
  const seen: unknown[] = [];
  const bag = DiBag.createBuilder().register({
    service: DiBag.fromFactory(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(disposerCtx => { seen.push(disposerCtx); });
      factoryCtx.pushDisposer(disposerCtx => { seen.push(disposerCtx); });
      throw new Error('handshake');
    }, { context: 'acquisition' }),
  }).build();
  await expect(bag.resolve('service')).rejects.toThrow('handshake');
  await tick();
  expect(seen).toHaveLength(2);
  expect(seen[0]).toBe(seen[1]);
  expect(seen[0]).toEqual({ reason: 'factory-failed' });
  expect(Object.isFrozen(seen[0])).toBe(true);
  await bag.close();
});

test('a synchronous failure never runs a pushed disposer inline with the throw', async () => {
  const released: string[] = [];
  const bag = DiBag.createBuilder().register({
    service: DiBag.fromFactory((_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => { released.push('handle'); });
      throw new Error('sync');
    }, { context: 'acquisition' }),
  }).build();
  expect(() => bag.resolve('service')).toThrow('sync');
  expect(released).toEqual([]);
  await tick();
  expect(released).toEqual(['handle']);
  await bag.close();
});

test('rollback events follow acquisition-failed and never precede it', async () => {
  const kinds: string[] = [];
  const Observed = DiBag.withConfiguration({ observers: [{ onEvent: event => { if (!event.kind.startsWith('scope')) kinds.push(event.kind); }, onError: () => {} }] });
  const bag = Observed.createBuilder().register({
    service: Observed.fromFactory(async (_deps: {}, factoryCtx) => { factoryCtx.pushDisposer(() => {}); await Promise.resolve(); throw new Error('source'); }, { context: 'acquisition' }),
  }).build();
  await expect(bag.resolve('service')).rejects.toThrow('source');
  await tick();
  expect(kinds).toEqual(['acquisition-started', 'acquisition-failed', 'cleanup-started', 'cleanup-completed']);
  await bag.close();
  expect(kinds).toEqual(['acquisition-started', 'acquisition-failed', 'cleanup-started', 'cleanup-completed']);
});
```

Also fold the existing `'a synchronous factory releases its deferred resource after the failure propagates'` into the "never inline" test above (delete the old one) and rename the remaining tests whose names say "deferred action(s)" or "rollback" to say "pushed disposer(s)" — names only.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/acquisition-cleanup.test.ts`
Expected: the five #32-shape tests fail (`events` is `[]` before close, or the disposer never runs); "never inline" fails because `released` is `['handle']` only after `close()`; the events test fails because no cleanup events are emitted before close.

- [ ] **Step 3: Anchor rollback on the source**

In `src/provider-execution.ts`, `DisposerStack.settle` no longer takes a state:

```ts
  /** The factory settled; nothing more can be pushed. */
  settle(): void { this.settled = true; }
```

Add to `ProviderExecution`, before `ready()`:

```ts
  /**
   * The source stage settles the stack. A failed factory releases what it pushed
   * at once, as pending work of this execution: anchoring on the source rather
   * than on the attempt's result covers a direct projection that is already
   * ready while its source is still running, which no retirement reaches
   * (issue 32). Success is handled in Task 3.
   */
  private settleDisposers(state: 'ready' | 'failed'): void {
    if (!this.disposers) return;
    this.disposers.settle();
    if (!this.disposers.pending) return;
    if (state === 'ready') { this.disposers.drain(); return; } // Task 3 replaces this line
    const work: Promise<void> = this.rollbackDisposers().then(() => {
      this.pending.delete(work);
      if (!this.pending.size) this.events.drained();
    });
    this.pending.add(work);
  }

  private async rollbackDisposers(): Promise<void> {
    // The initialization error propagates first; a synchronous failure never runs cleanup inline.
    await undefined;
    this.events.cleanupStarted?.();
    const failed = await this.runDisposers('factory-failed');
    this.events.cleanupCompleted?.(failed ? 'failure' : 'success');
  }

  /** Run every pushed disposer, last pushed first, all attempted; true when one threw. */
  private async runDisposers(reason: DisposerContext['reason']): Promise<boolean> {
    const disposerCtx: DisposerContext = Object.freeze({ reason });
    let failed = false;
    for (const disposer of this.disposers?.drain() ?? []) {
      const sequence = this.events.invoking();
      try {
        await disposer(disposerCtx);
      } catch (error) {
        failed = true;
        this.events.cleanupFailed(sequence, error);
      }
    }
    return failed;
  }
```

Replace `this.disposers?.settle(current.state)` in `evaluate` with `this.settleDisposers(current.state)`, and in `finish()` `this.disposers?.settle(...)` with `this.settleDisposers(stage.state === 'ready' ? 'ready' : 'failed')`. In `disposeStages` delete the drained-disposer loop and the `|| this.hasRollback` term in `owned` (the barrier wait `while (this.pending.size)` already orders an in-flight rollback before the stages). Keep `release()`'s `this.disposers?.drain()`.

The event order in the new test holds because `settled()` fires synchronously inside `finish()` after `settleDisposers` queued the rollback, and the rollback body starts after `await undefined`.

- [ ] **Step 4: Run the tests, the fast lane, and the retention suites**

Run: `bun test tests/acquisition-cleanup.test.ts && npm run typecheck && npm run test:fast`
Expected: PASS. Then `npm run build && node --expose-gc --test --test-isolation=none tests/runtime-scale.node.mjs tests/acquisition-retention.node.mjs tests/graph-retention.node.mjs` — expected 32 pass.

```bash
git add src/provider-execution.ts tests/acquisition-cleanup.test.ts
git commit -m "fix(acquisition): run pushed disposers when the source fails, not when the attempt is disposed"
```

---

### Task 3: The bag owns the stack on success; ordering and reasons

**Files:**
- Modify: `src/provider-execution.ts` (`hasOwnership`, `settleDisposers`, `disposeStages`, `compact`, `release`, `CompletedExecution`)
- Modify: `src/acquisition.ts:354` (the `retire()` guard)
- Modify: `tests/acquisition-cleanup.test.ts`

**Interfaces:**
- `ProviderExecution.hasOwnership` is true when the stack was accepted; `hasRollback` is deleted from both execution classes.

- [ ] **Step 1: Write the failing tests**

Rewrite these three (they pin the discarded-on-success semantics):

- `'a successful acquisition discards its deferred actions and keeps withDisposal ownership'` → `'a successful acquisition keeps its pushed disposers and runs them after the service disposer at close'`: expect `events` to equal `['dispose:session', 'rollback']` after `close()` and `[]` before.
- `'a projection failing after the factory returned releases the value exactly once'` → `'a projection failing after the factory returned disposes the service, then the stack, once each'`: expect `['dispose', 'rollback']` after the rejection plus a `tick()`, unchanged by `close()`.
- `'a raw asynchronous factory settles at its first await, as documented'`: keep the `afterAwait` assertion; change the final expectation to `expect(released).toEqual(['before'])` after `close()` and add `expect(released).toEqual([])` before it.

Add, from `stack-probe.test.ts` and `lifetime-probe.test.ts` (copy the bodies; replace `log` calls with the expectations given here):

- `'close runs projection ownership, then the service disposer, then pushed disposers last-pushed-first'` (S1): `['projected.dispose', 'session.close', 'socket.close', 'pool.end']`, with the `map-async` gate released only after `close()` started.
- `'failure before return runs the stack last-pushed-first before close'` (S2): `['socket.close', 'pool.end']` after a tick.
- `'a direct projection over a source that later fulfils accepts the stack into ownership'` (S4): `['wrapper.dispose', 'socket.close', 'pool.end']` at close, state `ready` throughout.
- `'a pushed stack alone makes the attempt owned'` (S4b): `['pool.end']` at close.
- `'every successful transient attempt keeps its stack until close'` (S7): three attempts inspected before close; `['end2', 'end1', 'end0']` after.
- `'a consumer disposes its stages and stack before its dependency starts'` (S8): `['consumer.service', 'consumer.stack', 'dep.service', 'dep.stack']`.
- `'startup rollback releases the stack of a service that had already succeeded'` (S9): `['a.stack']` and `cleanupFailures` `['b.stack failed']`.
- `'a factory that succeeds while the bag is closing still has its stack disposed'` (S11): `['pool.end']`.
- `'a root service acquired through a child owns its stack on the root'` (L1), `'a fork owns the stacks of its own acquisitions'` (L2), `'a binding shared to the parent owns its stack on the parent'` (L3, `root.createScope({ share: ['a'] })`).
- One test per success reason:

```ts
test('pushed disposers learn that no service disposer exists', async () => {
  const reasons: string[] = [];
  const bag = DiBag.createBuilder().register({
    service: DiBag.fromFactory((_deps: {}, factoryCtx) => { factoryCtx.pushDisposer(disposerCtx => { reasons.push(disposerCtx.reason); }); return 1; }, { context: 'acquisition' }),
  }).build();
  bag.resolve('service');
  await bag.close();
  expect(reasons).toEqual(['no-service-disposer']);
});

test('pushed disposers learn that every service disposer succeeded', async () => {
  const reasons: string[] = [];
  const bag = DiBag.createBuilder().register({
    service: DiBag.withDisposal(DiBag.transformService(DiBag.withDisposal(DiBag.fromFactory((_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(disposerCtx => { reasons.push(disposerCtx.reason); });
      return 1;
    }, { context: 'acquisition' }), () => {}), { mode: 'direct', transform: value => value }), () => {}),
  }).build();
  bag.resolve('service');
  await bag.close();
  expect(reasons).toEqual(['service-disposed']);
});

test('pushed disposers learn that a service disposer threw and still run', async () => {
  const reasons: string[] = [];
  const bag = DiBag.createBuilder().register({
    service: DiBag.withDisposal(DiBag.transformService(DiBag.withDisposal(DiBag.fromFactory((_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(disposerCtx => { reasons.push(disposerCtx.reason); });
      return 1;
    }, { context: 'acquisition' }), () => { throw new Error('inner'); }), { mode: 'direct', transform: value => value }), () => {}),
  }).build();
  bag.resolve('service');
  const failure = await bag.close().then(() => undefined, (error: unknown) => error);
  expect(failure).toBeInstanceOf(DiBagCleanupError);
  expect((failure as DiBagCleanupError).failures).toHaveLength(1);
  expect(reasons).toEqual(['service-disposal-failed']);
});

test('the recommended reason check releases a resource the service owns exactly once', async () => {
  const closes: string[] = [];
  const socket = { closed: false, close() { if (this.closed) throw new Error('double close'); this.closed = true; closes.push('socket'); } };
  const bag = DiBag.createBuilder().register({
    session: DiBag.withDisposal(DiBag.fromFactory((_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(disposerCtx => { if (disposerCtx.reason !== 'service-disposed') socket.close(); });
      return { close: () => socket.close() };
    }, { context: 'acquisition' }), session => session.close()),
  }).build();
  bag.resolve('session');
  await bag.close();
  expect(closes).toEqual(['socket']);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/acquisition-cleanup.test.ts`
Expected: every new success-path test fails because the stack is drained on success; the three rewritten tests fail on their new expectations.

- [ ] **Step 3: Accept the stack into ownership and run it after the stages**

In `src/provider-execution.ts`:

```ts
  private disposersOwned = false;
  get hasOwnership(): boolean { return this.stages.length > 0 || this.disposersOwned; }
```

Delete `get hasRollback()` here and the `hasRollback`/`rollback` fields on `CompletedExecution` (keep `readonly disposers = undefined`). In `settleDisposers` replace the Task 2 placeholder line with:

```ts
    if (state === 'ready') {
      // The factory returned: the bag owns what it pushed, below stage 0.
      this.disposersOwned = true;
      this.events.accepted();
      return;
    }
```

Replace `disposeStages` with:

```ts
  private async disposeStages(): Promise<void> {
    // All later acceptances must be known before reversing stable stage indices.
    while (this.pending.size) await Promise.all(this.pending);
    const owned = this.hasOwnership;
    let failed = false;
    if (owned) this.events.cleanupStarted?.();
    for (const stage of this.stages.sort((a, b) => b.index - a.index)) {
      stage.state = 'disposing';
      const sequence = this.events.invoking();
      const { dispose, value } = stage;
      try {
        await dispose(value as never);
      } catch (error) {
        failed = true;
        this.events.cleanupFailed(sequence, error);
      } finally {
        stage.state = 'disposed';
      }
    }
    // Pushed disposers are the bottom of the ownership stack: they run after every
    // service-level disposer and are told how those went.
    const reason = !this.stages.length ? 'no-service-disposer' : failed ? 'service-disposal-failed' : 'service-disposed';
    if (await this.runDisposers(reason)) failed = true;
    this.disposersOwned = false;
    if (owned) this.events.cleanupCompleted?.(failed ? 'failure' : 'success');
    this.stages.length = 0;
    this.result = undefined;
  }
```

`compact()` guard: `if (this.state !== 'ready' || this.pending.size || this.hasOwnership) return this;`. `release()`: add `this.disposersOwned = false;` after the drain.

In `src/acquisition.ts:354` the guard becomes `if (!attempt.execution.hasOwnership && !attempt.execution.work.length) { release(); return; }` — an in-flight rollback is in `work`, an accepted stack is in `hasOwnership` (proto2 proved the `hasRollback` term dead: 482/482 with it removed).

- [ ] **Step 4: Run the tests, the fast lane, and the retention suites**

Run: `bun test tests/acquisition-cleanup.test.ts && npm run typecheck && npm run test:fast`
Expected: PASS. `tests/observers.test.ts` and `tests/plugins.test.ts` sequence pins are unaffected (verified on proto3). Retention: 32 pass.

```bash
git add src tests/acquisition-cleanup.test.ts
git commit -m "feat(acquisition): own pushed disposers below the service disposers once the factory returns"
```

---

### Task 4: Observers and close progress

**Files:**
- Modify: `src/provider-execution.ts` (`rollback` promise field, `get rollingBack()`, `CompletedExecution.rollingBack`)
- Modify: `src/acquisition.ts:155-160` (`collectProgress`)
- Modify: `tests/acquisition-cleanup.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
test('a successful acquisition reports one cleanup pair at close covering stages and stack', async () => {
  const kinds: string[] = [];
  const Observed = DiBag.withConfiguration({ observers: [{ onEvent: event => { if (!event.kind.startsWith('scope')) kinds.push(event.kind); }, onError: () => {} }] });
  const bag = Observed.createBuilder().register({
    service: Observed.withDisposal(Observed.fromFactory((_deps: {}, factoryCtx) => { factoryCtx.pushDisposer(() => {}); return 1; }, { context: 'acquisition' }), () => {}),
  }).build();
  bag.resolve('service');
  await bag.close();
  expect(kinds).toEqual(['acquisition-started', 'acquisition-ready', 'cleanup-started', 'cleanup-completed']);
});

test('a direct projection whose source fails reports a rollback run and, at close, a disposal run', async () => {
  const kinds: string[] = [];
  const Observed = DiBag.withConfiguration({ observers: [{ onEvent: event => { if (!event.kind.startsWith('scope')) kinds.push(event.kind); }, onError: () => {} }] });
  const bag = Observed.createBuilder().register({
    service: Observed.withDisposal(Observed.transformService(Observed.fromFactory(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => {}); await Promise.resolve(); throw new Error('source');
    }, { context: 'acquisition' }), { mode: 'direct', transform: promise => ({ wrapped: promise }) }), () => {}),
  }).build();
  await expect(bag.resolve('service').wrapped).rejects.toThrow('source');
  await tick();
  expect(kinds).toEqual(['acquisition-started', 'acquisition-ready', 'cleanup-started', 'cleanup-completed']);
  await bag.close();
  expect(kinds).toEqual(['acquisition-started', 'acquisition-ready', 'cleanup-started', 'cleanup-completed', 'cleanup-started', 'cleanup-completed']);
});

test('a bounded close reports an in-flight rollback as pending', async () => {
  const gate = deferred<void>();
  const bag = DiBag.createBuilder().register({
    service: DiBag.transformService(DiBag.fromFactory(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(() => gate.promise); await Promise.resolve(); throw new Error('source');
    }, { context: 'acquisition' }), { mode: 'direct', transform: promise => ({ wrapped: promise }) }),
  }).build();
  await expect(bag.resolve('service').wrapped).rejects.toThrow('source');
  const failure = await bag.close({ timeoutMs: 5 }).then(() => undefined, (error: unknown) => error);
  expect(failure).toBeInstanceOf(DiBagCloseCancelledError);
  expect((failure as DiBagCloseCancelledError).details.pending).toEqual(['service']);
  gate.resolve();
  await (failure as DiBagCloseCancelledError).cleanupPromise;
});
```

Import `DiBagCloseCancelledError` from `'../src'`; its shared shutdown promise is the public `cleanupPromise` property (`src/errors.ts:211`), and `details.pending` is the `CloseProgress.pending` label list.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/acquisition-cleanup.test.ts -t "pending"`
Expected: the progress test fails with `pending` equal to `[]`; the two observer tests should already pass after Task 3 and are kept as pins.

- [ ] **Step 3: Expose the in-flight rollback**

In `ProviderExecution` add `private rollback: Promise<void> | undefined;` and `get rollingBack(): boolean { return this.rollback !== undefined; }`; in `settleDisposers` set `this.rollback = work` before `this.pending.add(work)` and clear it (`this.rollback = undefined`) first thing in the `.then`. Add `readonly rollingBack = false;` to `CompletedExecution`. In `collectProgress`:

```ts
      if (attempt.state === 'disposing' || this.retired.has(attempt.id) || attempt.execution.rollingBack) pending.push(attempt.label);
```

- [ ] **Step 4: Run, then commit**

Run: `npm run typecheck && npm run test:fast` and the retention suites.

```bash
git add src tests/acquisition-cleanup.test.ts
git commit -m "fix(acquisition): report an in-flight rollback in close progress"
```

---

### Task 5: Retention

**Files:**
- Modify: `tests/acquisition-retention.node.mjs` (append)

- [ ] **Step 1: Add the case** (from `stack-retention.node.mjs`; it passed on proto3)

```js
test('pushed disposer closures live until close and are collectible afterwards even with the context retained', async () => {
  const refs = [];
  let kept;
  const bag = DiBag.createBuilder().register({
    value: DiBag.fromFactory((_deps, factoryCtx) => {
      kept = factoryCtx;
      const payload = Array(256).fill(1);
      refs.push(new WeakRef(payload));
      factoryCtx.pushDisposer(() => payload.length);
      return 1;
    }, { context: 'acquisition' }),
  }).build();
  bag.resolve('value');
  await setImmediate();
  globalThis.gc();
  assert.notEqual(refs[0].deref(), undefined, 'the bag owns the pushed disposer until close');
  await bag.close();
  await collected(refs);
  assert.throws(() => kept.pushDisposer(() => {}), /CLEANUP_AFTER_FACTORY/);
});
```

Also rename `context` → `factoryCtx` in the existing retained-context case (line 172).

- [ ] **Step 2: Run the suites**

Run: `npm run build && node --expose-gc --test --test-isolation=none tests/runtime-scale.node.mjs tests/acquisition-retention.node.mjs tests/graph-retention.node.mjs`
Expected: 33 pass. If the new case fails on `collected`, the stack is being retained past `close()`: check that `disposeAll`'s `finally` reaches `execution.release()` for the attempt and that `runDisposers` drains before `disposersOwned` is cleared.

```bash
git add tests/acquisition-retention.node.mjs
git commit -m "test(acquisition): pushed disposers are released at close even when the context is retained"
```

---

### Task 6: Docs — JSDoc is done; tutorial, recipe, errors, AGENTS.md, reference

**Files:**
- Modify: `docs/guides/tutorial.md:191-245` (the `#release-partial-acquisition` section through the `DI_BAG_CLEANUP_AFTER_FACTORY` paragraph; the `#32` caveat goes)
- Modify: `docs/agent/recipes.md:245-301` (must stay under 60 lines; it is 57 now)
- Modify: `docs/agent/errors.md:264-290` and `:574-594`
- Modify: `AGENTS.md:33-36` (rule 6; exactly four lines, budget 150/150)
- Regenerate: `docs/reference/**`, `docs/reference/api-coverage.json` (`npm run docs:generate`)

- [ ] **Step 1: Tutorial**

Replace lines 191–245 with (the outer fence is four backticks only because the block contains a code fence; copy the content, not the fence):

````markdown
#### Release a partially acquired resource {#release-partial-acquisition}

`withDisposal` owns the value a factory *returns*, so a factory that acquires a
resource and then fails has nothing to hand over. `factoryCtx.pushDisposer(disposer)`
makes the bag own a resource the factory already holds:

```ts
import { DiBag } from 'di-bag';

declare function openPool(): Promise<{ end(): Promise<void>; connect(): Promise<{ close(): Promise<void> }> }>;
declare function handshake(socket: { close(): Promise<void> }): Promise<void>;

const session = DiBag.withDisposal(
  DiBag.fromFactory(async (_deps: {}, factoryCtx) => {
    const pool = await openPool();
    factoryCtx.pushDisposer(() => pool.end());
    const socket = await pool.connect();
    factoryCtx.pushDisposer(disposerCtx => { if (disposerCtx.reason !== 'service-disposed') return socket.close(); });
    await handshake(socket);
    return { socket, close: () => socket.close() };
  }, { context: 'acquisition' }),
  session => session.close(),
);
```

Each pushed disposer runs exactly once, last pushed first. If the factory
throws, rejects, or is cancelled, they run at once — `pool.end()` after
`socket.close()` — and `disposerCtx.reason` is `'factory-failed'`. If the
factory returns, the bag owns them below the returned value: at `close()`, and
at retirement when a later projection fails, every service-level disposer runs
first — `withDisposal` on the returned value and any projection ownership — and
then the pushed disposers, with `reason` `'service-disposed'`,
`'service-disposal-failed'` (a service disposer threw; the pushed disposers
still run), or `'no-service-disposer'`.

Give each resource one disposer. `pool` above is released only by its pushed
disposer. The socket is released by `session.close()`, so its pushed disposer
checks `reason` and acts only when no service disposer released it. A pushed
disposer that ignores `disposerCtx` runs unconditionally, which is right when
nothing else releases the resource.

Every disposer is attempted even when one rejects; each rejection is reported
like a `close()` disposer failure, through `cleanup-failed` observer events and
the `DiBagCleanupError` of the owning `close()`. Two shapes deserve a note. A
`direct` projection over an asynchronous source is ready while the source is
still running, so a source that then fails runs its pushed disposers at once and
its projection's own disposer at `close()`. A `raw` asynchronous factory
completes when it returns its promise: a disposer pushed before its first
`await` is owned and runs at `close()`, one pushed after throws, and a later
rejection of that promise is not a factory failure. Transient services keep
each attempt's pushed disposers until `close()`, like `withDisposal`.

Rollback is scheduled when the factory fails, not awaited by the failing
`resolve`: the initialization error propagates first, and `close()` — or the
`cleanupPromise` of `DiBagStartupCancelledError` — waits for it to finish.
`pushDisposer` belongs to one running factory; calling it on a context retained
past that factory throws
[`DI_BAG_CLEANUP_AFTER_FACTORY`](../agent/errors.md#di-bag-cleanup-after-factory).
````

Rename the two remaining `context` parameters in the tutorial's signal-only examples (search `, context)` in the file) to `factoryCtx`.

- [ ] **Step 2: Recipe** (`docs/agent/recipes.md:245-301`, keep the three code blocks; the heading, prose and module block change; count lines afterwards)

Heading: `## Own a resource a factory acquires on the way {#partial-acquisition}`. Intro paragraph:

```markdown
`withDisposal` owns the value a factory *returns*. A factory that acquires a
resource before it can return pushes a disposer for it as soon as it holds it;
the bag releases it if the factory fails and, otherwise, after the service.
```

Module block: the socket factory becomes

```ts
    socket: DiBag.withDisposal(
      DiBag.fromFactory(async ({ config }: { config: FeedConfig }, factoryCtx): Promise<Socket> => {
        const socket = await open(config.url);
        factoryCtx.pushDisposer(disposerCtx => { if (disposerCtx.reason !== 'service-disposed') return socket.close(); });
        await authenticate(socket, config.token);
        return socket;
      }, { context: 'acquisition' }),
      socket => socket.close(),
    ),
```

Closing paragraph (replaces the current one):

```markdown
A pushed disposer runs exactly once: at once if the factory fails, otherwise at
`close()` after every service-level disposer, told which through
`disposerCtx.reason`. Give each resource one disposer: here the socket is the
service, so its pushed disposer acts only when `withDisposal` did not release it.
A resource the returned value does not own needs no check. A rejecting disposer
does not skip the rest; it is reported through
[`DI_BAG_CLEANUP_FAILED`](errors.md#di-bag-cleanup-failed). Calling `pushDisposer`
after the factory settled throws
[`DI_BAG_CLEANUP_AFTER_FACTORY`](errors.md#di-bag-cleanup-after-factory).
```

Run `awk 'NR>=245 && NR<303' docs/agent/recipes.md | wc -l` after editing (recompute the heading lines with `grep -n "^## "`); the count must be 59 or fewer.

- [ ] **Step 3: errors.md**

`DI_BAG_CLEANUP_AFTER_FACTORY` (lines 264–290): "**When:** `factoryCtx.pushDisposer(disposer)` throws because the factory that owns the context has already returned or failed. …"; "**Cause:** … from inside a pushed disposer already running …"; "**Fix:** push inside the factory, immediately after acquiring the resource; own the returned value with `DiBag.withDisposal`." Example:

```ts
import { DiBag } from 'di-bag';

const handle = DiBag.withDisposal(
  DiBag.fromFactory(async (_deps: {}, factoryCtx) => {
    const socket = { close: async () => {} };
    factoryCtx.pushDisposer(disposerCtx => { if (disposerCtx.reason !== 'service-disposed') return socket.close(); });
    return socket;
  }, { context: 'acquisition' }),
  socket => socket.close(),
);
```

`DI_BAG_INVALID_CLEANUP` (lines 574–594): "**When:** `factoryCtx.pushDisposer(disposer)` throws because `disposer` is not a function."; "**Cause:** a value was passed where a disposer callback belongs, usually the result of calling the release instead of passing it."; "**Fix:** pass a function: `factoryCtx.pushDisposer(() => socket.close())`, not `factoryCtx.pushDisposer(socket.close())`." Example: the same factory without `withDisposal`, pushing `() => handle.close()`.

Update both "**Recipe:**" links' text to "own a resource a factory acquires on the way".

- [ ] **Step 4: AGENTS.md rule 6** (replace lines 33–36; four lines, no more)

```markdown
6. **Ownership.** `DiBag.withDisposal(factory, dispose)` makes the bag own the
   value; `close()` runs disposers, dependents first. Close every scope and fork
   you create; a parent closes its live scopes, never forks. Inside a factory,
   [`factoryCtx.pushDisposer`](docs/agent/recipes.md#partial-acquisition) owns what it acquires on the way.
```

Run: `wc -l AGENTS.md` → 150.

- [ ] **Step 5: Regenerate and check**

Run: `npm run docs:generate && npm run docs:check`
Expected: `docs/reference/index/interfaces/AcquisitionContext.md` shows `pushDisposer`, a new `DisposerContext.md` appears, `api-coverage.json` gains `index.DisposerContext.reason`/`node.DisposerContext.reason` and drops the `defer` rows; `docs:check` prints "Agent docs are consistent". If a snippet fails to type-check, the emitted declaration is missing `DisposerContext` — recheck `src/index.ts`.

```bash
git add docs AGENTS.md
git commit -m "docs: pushDisposer owns what a factory acquires on the way"
```

---

### Task 7: Design note, changelog block, issue text

**Files:**
- Rewrite: `docs/superpowers/specs/2026-09-17-acquisition-local-cleanup.md`

- [ ] **Step 1: Rewrite the note** with this structure (keep the title and the issue links):

1. **Status:** implemented; supersedes the rollback-only decision; closes #27 and #32.
2. **Problem** (unchanged).
3. **Decision: a disposer stack the bag owns.** Why rollback-only was dropped: an intermediate the returned value does not own leaked on success, and the "if, and only if" rule failed one shape (#32). What replaced the by-construction "no double ownership" property: the one-disposer-per-resource rule plus `DisposerContext.reason`, which lets a disposer for a resource the service owns act only when the service disposer did not.
4. **API:** `pushDisposer`, `DisposerContext` with the four reasons and when each is produced (Decisions 1–3, 6, 7 above verbatim), parameter-name convention, error codes.
5. **Runtime:** `DisposerStack`, `settleDisposers` at the two source-settle sites, `runDisposers` shared by the failure path (`rollbackDisposers`, `await undefined`, one cleanup pair) and `disposeStages` (stages in reverse index order, then the stack, reason from the stages), `hasOwnership` including the accepted stack, `compact`/`retire` guards, `rollingBack` and `collectProgress`.
6. **Ordering**, including the F2 inversion in the #32 failure shape and why it is harmless, and cross-attempt order.
7. **Observers and failures:** one pair per run; two runs for the #32 failure shape; `DiBagCleanupError`, `DiBagStartupError.cleanupFailures`, close progress.
8. **Retention:** what a retained context pins (the `DisposerStack` and the signal); the stack holds closures until close by design; both retention cases.
9. **Tests:** the final list of `tests/acquisition-cleanup.test.ts` cases and the retention case.
10. **Changelog entry for the next release chore:**

```md
### Added

- `factoryCtx.pushDisposer(disposer)` on the acquisition context makes the bag own
  a resource a factory acquired before it could return
  ([#27](https://github.com/dany-fedorov/di-bag/issues/27),
  [#32](https://github.com/dany-fedorov/di-bag/issues/32)). Pushed disposers run
  exactly once, last pushed first: at once when the factory throws, rejects, or is
  cancelled, otherwise at `close()` — or at retirement after a later projection
  fails — after every service-level disposer. Each receives a `DisposerContext`
  whose `reason` is `'factory-failed'`, `'no-service-disposer'`,
  `'service-disposed'`, or `'service-disposal-failed'`, so a disposer for a
  resource the returned value also releases can act only when the service
  disposer did not. Failures are reported like `close()` disposer failures. New
  codes `DI_BAG_INVALID_CLEANUP` and `DI_BAG_CLEANUP_AFTER_FACTORY`; new exported
  type `DisposerContext`.

### Changed

- Each acquisition now receives its own frozen `AcquisitionContext` rather than
  one shared per scope. The `signal` is unchanged — still the owning bag's, shared
  by every acquisition it owns — so code comparing context objects by identity
  should compare `context.signal` instead.
- A `close({ timeoutMs, signal })` that stops waiting while a failed factory's
  pushed disposers are still running lists that acquisition under
  `details.pending`.
```

11. **Decisions taken during implementation:** carry over "opt-in", "per-acquisition context", "a retained context must pin nothing"; replace the "known limitation" and "`compact()` and `retire()` learned about rollback" paragraphs with one paragraph on source-anchored rollback (the invariant: the lifecycle had no "source settled" event; `settleDisposers` is that event) and one on why `hasRollback` went away.

- [ ] **Step 2: Issue #32 text** (for the PR description and the issue edit; not committed)

Title: "Run pushed disposers when the source fails, not when the attempt is disposed". Criteria: a source that rejects under a `direct` projection runs its pushed disposers exactly once without waiting for `close()`; a racing `close()` waits for that rollback before disposing anything; an accepted projection stage is a delivered service and is disposed at `close()` after its dependents; no change to the ordinary shapes. Drop "the attempt's inspected state distinguishes a ready projection from a failed source".

```bash
git add docs/superpowers/specs/2026-09-17-acquisition-local-cleanup.md
git commit -m "docs(spec): pushed disposers replace rollback-only cleanup; issue 32 fixed by source-anchored rollback"
```

---

### Task 8: Full gate

- [ ] Run, in order: `npm run check`; the retention suites; `npm run typecheck:native`; `npm run build:native`; the retention suites again; `npm run check:native`; `npm run graph:check`; `npm run agent-eval:test`; `for f in examples/*.ts; do bun "$f" || exit 1; done`.
- [ ] Expected: all green. `tests/package.test.ts` may time out under load; rerun `bun test tests/package.test.ts` alone before investigating.
- [ ] Confirm `git diff --stat main` touches no file outside `src/`, `tests/`, `docs/`, `AGENTS.md`, and that `CHANGELOG.md` is untouched.
- [ ] PR body: the semantics paragraph from the changelog block, "Closes #27 (follow-up), Closes #32", and the verification line in the style of 2e6602f ("Verified: N fast, N compiler, 33 retention, native typecheck/build/contracts, graph, agent-eval, and all examples.").

---

## Risks

1. **Negative fixture markers** (Task 1 Step 5). The printed parameter type may differ between tsc6 and native tsc; the plan already tells you to shorten to the common substring. Highest-probability stall.
2. **`AGENTS.md` at 150/150.** Rule 6 must stay exactly four lines; the fourth line is long but the budget counts lines, not characters.
3. **Recipe under 60 lines.** The rewritten prose is two lines longer than today's; if the count reaches 60, drop the sentence beginning "A resource the returned value does not own".
4. **Bun `rejects` timing.** Any test asserting that rollback ran must `await tick()` first; a test asserting it has *not* run yet proves nothing without the yield (see `pinned-shape.mjs`).
5. **Event order.** Without a projection, `cleanup-started` follows `acquisition-failed`; the `await undefined` at the top of `rollbackDisposers` is load-bearing and pinned by a test. *Correction after review:* under a projection the rollback pair may precede `acquisition-failed`, because the run is anchored on the source and the event on the result; that shape is pinned too.
6. **Retention.** The stack holds user closures until `close()` by design; the new case asserts both "alive before" and "collected after". Do not build the context anywhere but `acquisitionContext()`. *Correction after review:* the retained-context case checks frame payloads, which `compact()` and `release()` clear either way, so it cannot detect a closure that captured `execution`. The graph-payload cases added in the PR #34 follow-up can.
7. **`hasRollback` removal.** The `retire()` guard relies on an in-flight rollback being in `work` (it is added to `pending` synchronously in `settleDisposers`, before `evaluate` throws or `finish()` calls `settled()`); the "never inline" test and the sync `transient` test pin this.
8. **`docs:generate` output.** typedoc rewrites `docs/reference/**`; commit everything it changes, including line-number links in `ContextualFactory.md`.
9. **Two cleanup pairs per attempt** in the #32 failure shape is new observable behaviour; it is documented in the tutorial and pinned by a test so it is a decision, not an accident.

## Line estimate

| Area | Files | Estimate |
| --- | --- | --- |
| Runtime | `src/provider-execution.ts` | +75 / −40 |
| Runtime | `src/acquisition.ts`, `src/acquisition-context.ts`, `src/index.ts` | +45 / −25 |
| Runtime tests | `tests/acquisition-cleanup.test.ts` (22 → ~40 cases) | +360 / −130 |
| Type fixtures | `tests/types/startup.ts`, `tests/types/negative/startup.ts` | +14 / −10 |
| Retention | `tests/acquisition-retention.node.mjs` | +22 |
| Agent docs | `AGENTS.md`, `docs/agent/recipes.md`, `docs/agent/errors.md` | +40 / −35 (budgets: 150, <60 per recipe) |
| Guide | `docs/guides/tutorial.md` | +45 / −55 |
| Reference (generated) | `docs/reference/**`, `api-coverage.json` | ~+50 / −25 |
| Design note | `docs/superpowers/specs/2026-09-17-acquisition-local-cleanup.md` | ~300 rewritten |
