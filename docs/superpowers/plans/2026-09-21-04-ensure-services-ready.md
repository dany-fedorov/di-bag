# ensureServicesReady Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `builder.buildAndStart(keys, options)` with `bag.ensureServicesReady(serviceKeys, options?)`, which works on a built bag, a child scope and a fork, and give the wait options and the readiness errors their 0.5.0 names.

**Architecture:** The scheduling, deadline and rollback logic of `startRuntime` in `src/startup.ts` is copied into a new function, `ensureRuntimeReady`, that takes an existing `BagRuntime` instead of constructing one. `Bag.ensureServicesReady` is a thin `async` method over it. The phase follows expand, migrate, contract: the new method, options type and error classes are added next to the old ones, every call site moves, then `buildAndStart`, `StartupOptions`, the two startup error classes and the three startup codes are deleted. The `close` options and the close progress fields are renamed first, in one small hand-made step, because the new cancelled error reuses the progress shape.

**Tech Stack:** TypeScript 6.0.2 (`tsc6`) and 7.0.2 (`tsc`), Bun 1.4.0 (`bun test`), Node 24.20.0, the `tools/codemod` built in phase 1, TypeDoc under `tools/docs`.

**Spec:** `docs/superpowers/specs/2026-09-20-swift-api-style.md`, sections "Container" (the `ensureServicesReady` paragraph and the `close` row), "Errors" (the two service readiness rows), and "Snapshots and events" (the `CloseProgress` row). Worked examples 1, 2 and 15 in `docs/superpowers/specs/2026-09-20-swift-api-style-examples.md`. Read `docs/superpowers/plans/2026-09-21-00-swift-api-style-master.md` first: its protocol, environment, commit format and gate list apply to every task here.

## Global Constraints

- This is phase 3 of the master plan. Branch: `phase-03-ensure-services-ready`, cut from `next`.
- Names introduced here are final 0.5.0 names and come from the spec: `ensureServicesReady`, `EnsureServicesReadyOptions`, `abortSignal`, `totalTimeoutMs`, `maxConcurrentServiceKeys`, `waitTimeoutMs`, `DiBagServiceReadinessError`, `DiBagServiceReadinessCancelledError`, `disposalFailures`, `disposalError`, `disposalPromise`, `disposersStillRunning`, `acquisitionsStillPending`, `DI_BAG_SERVICE_READINESS_FAILED`, `DI_BAG_SERVICE_READINESS_CANCELLED`, `DI_BAG_SERVICE_READINESS_TIMEOUT`. Do not shorten or vary them.
- Names that are NOT changed in this phase, even though later phases change them: the class `Bag`, `builder.build()`, `createScope`, `fork`, `register`, the code `DI_BAG_INVALID_STARTUP`, the type `CleanupFailure`, the class `DiBagCleanupError`, and the field `DiBagCloseCancelledError.cleanupPromise`. Leave every one of them alone.
- `ensureServicesReady(serviceKeys, options?)`: one positional input and one bag in which every property is optional (spec, standard rule 4).
- The package keeps zero runtime dependencies, and `src/index.ts` must not import a `node:` module.
- Every library error message keeps the form `DI_BAG_CODE: message; see <errors page>#<anchor>` and every `'DI_BAG_*'` literal in `src/` has exactly one section in `docs/agent/errors.md`. `npm run docs:check` enforces both directions.
- `AGENTS.md` is at its 150-line budget. Do not add a line to it.
- Executors commit on the phase branch only. No push, no publish, no merge, no edits to the spec.
- Environment for every command (master plan, "Environment"):

```bash
export PATH="/tmp/claude-1000/-home-df-wd-personal-di-bag/7818417c-3b3a-48db-9bef-85624eff953b/scratchpad/bun/bin:$PATH"
export npm_config_update_notifier=false
bun --version   # 1.4.0
```

## State on entry

Phases 0 to 2 are merged into `next`. Confirm each line with the command next to it before Task 1. If one differs, find the real name with `grep` and adjust only that reference.

| Expectation | Check |
| --- | --- |
| The naming guide and the naming ratchet test exist | `ls docs/guides/api-naming.md && ls tests | grep -i naming` |
| The codemod exists with a `buildAndStart` transform and a fixture for it | `ls tools/codemod/cli.mjs tools/codemod/rename-map.json && grep -rl buildAndStart tools/codemod` |
| Phase 2 renamed documented parameter names in `src` only | `grep -n "factoryContext" src/acquisition-context.ts` prints matches |
| `Builder.buildAndStart` exists and `Bag.ensureServicesReady` does not | `grep -n "buildAndStart\|ensureServicesReady" src/di-bag.ts` |
| The class is still `Bag` and the terminal is still `build()` | `grep -n "^class Bag\|  build(this" src/di-bag.ts` |

Phase 2 may have renamed the type parameters of `Bag` (they were `R` and `C` in 0.4.0). Wherever this plan writes `Selection<R, K, …>` or `Bag<R, C>`, use the names you find in the `createScope` signature of `src/di-bag.ts`, which reads `Selection<R, K, 'createScope'>` in 0.4.0. Test files may name callback parameters `factoryCtx` or `factoryContext`; both are local names and both compile.

## File Structure

| File | Change |
| --- | --- |
| `src/startup.ts` | `CloseOptions` fields renamed. New `EnsureServicesReadyOptions`, `snapshotReadinessOptions`, `ensureRuntimeReady`. Later: `StartupOptions`, `snapshotStartupOptions`, `startRuntime` deleted |
| `src/errors.ts` | `CloseProgress` fields renamed, `DiBagCloseCancelledError` details follow. New `DiBagServiceReadinessError`, `DiBagServiceReadinessCancelledError`. Later: the two startup classes deleted |
| `src/runtime.ts` | `BagRuntime.closeProgress()` returns the renamed fields |
| `src/di-bag.ts` | New `Bag.ensureServicesReady`. `close` JSDoc. Later: `Builder.buildAndStart` deleted |
| `src/index.ts` | Exports follow |
| `tests/ensure-services-ready.test.ts` | New. Fifteen runtime tests for the new method |
| `tests/startup.test.ts`, `tests/startup-runtime-fixture.ts`, `tests/runtime-diagnostics.test.ts`, `tests/acquisition-cleanup.test.ts`, `tests/final-adversarial-runtime-fixture.ts`, `tests/*.node.mjs`, other tests, `examples/` | Migrated call sites |
| `tests/types/startup.ts`, `tests/types/startup-consumer.ts`, `tests/types/negative/startup.ts`, `tests/types/negative/api-renaming.ts` | Compiler fixtures |
| `tools/codemod/rename-map.json`, `tools/codemod/test/fixtures/…` | Map entries and a fixture for this phase |
| `docs/agent/errors.md`, `docs/agent/api-card.md` (generated), `docs/reference/` (generated), `tools/docs/api-card-tasks.json`, `tools/docs/test/exact-rendering.test.mjs`, `docs/guides/api-reference.md` (four table rows only) | Documentation that `npm run docs:check` verifies |
| `tools/graph/README.md`, `tools/graph/test/extract.test.mjs`, `tools/graph/test/fixtures/ready-chain.ts` | The graph tool keeps finding `build()` inside `build().ensureServicesReady()` |
| `scripts/verify-release-artifacts.ts` | Expected error class names in release evidence |
| `docs/superpowers/plans/evidence/phase-03.md` | Measurements |

The guides under `docs/guides/` and `README.md` are rewritten in phase 12. This phase touches `docs/guides/api-reference.md` only because three of its table rows link to reference pages that this phase deletes, and `npm run docs:check` fails on a dead link.

---

### Task 0: Branch and entry check

**Files:** none.

- [ ] **Step 1: Create the branch**

```bash
git switch next && git pull --ff-only 2>/dev/null; git switch -c phase-03-ensure-services-ready
```

- [ ] **Step 2: Run the checks of "State on entry"**

Run each command of the table. Expected: every expectation holds. Write down the names of the `Bag` type parameters and the path of the naming test and of the codemod fixture that mentions `buildAndStart`; later tasks need them.

- [ ] **Step 3: Build once, so that tests reading `dist/` start from a current build**

Run: `npm run build`
Expected: exits 0.

---

### Task 1: Rename the close options and the close progress fields

`close({ signal, timeoutMs })` becomes `close({ abortSignal, waitTimeoutMs })`. `CloseProgress.pending` and `.acquiring` become `disposersStillRunning` and `acquisitionsStillPending`, and so do the keys of `DiBagCloseCancelledError.details`. The `details.timeoutMs` key becomes `details.waitTimeoutMs`. The field `cleanupPromise` of that error stays until phase 11. There are about twenty call sites and most hold the error as `any`, so this task is done by hand; the codemod learns the same renames in Task 4 for users.

**Files:**
- Modify: `src/errors.ts` (the `CloseProgress` interface and the `DiBagCloseCancelledError` class, at the end of the file)
- Modify: `src/runtime.ts` (`closeProgress`)
- Modify: `src/startup.ts` (`CloseOptions`, `snapshotOptions`, `closeRuntime`)
- Modify: `src/di-bag.ts` (JSDoc of `Bag.close`)
- Modify: `tests/runtime-diagnostics.test.ts`, `tests/acquisition-cleanup.test.ts`, `tests/types/startup.ts`, `tests/types/negative/startup.ts`
- Modify: `docs/agent/errors.md` (sections `DI_BAG_CLOSE_ABORTED`, `DI_BAG_CLOSE_TIMEOUT`, `DI_BAG_INVALID_CLOSE`)

**Interfaces:**
- Produces: `CloseOptions { readonly abortSignal?: AbortSignal; readonly waitTimeoutMs?: number }`; `CloseProgress { readonly disposersStillRunning: readonly string[]; readonly acquisitionsStillPending: readonly string[] }`; `BagRuntime.closeProgress()` returns that shape; `snapshotOptions(options, operation, code, supported, timeoutKey, signalKey)`.

- [ ] **Step 1: Make the tests state the new names (they fail first)**

In `tests/runtime-diagnostics.test.ts` make these replacements. The file holds the caught error as `any`, so the compiler will not find these for you.

| Find | Replace with |
| --- | --- |
| `test('close({ timeoutMs }) rejects naming` | `test('close({ waitTimeoutMs }) rejects naming` |
| `test('close({ signal }) stops the wait` | `test('close({ abortSignal }) stops the wait` |
| every `.close({ timeoutMs: ` (seven places) | `.close({ waitTimeoutMs: ` |
| `bag.close({ signal: controller.signal, timeoutMs: 60_000 })` | `bag.close({ abortSignal: controller.signal, waitTimeoutMs: 60_000 })` |
| `await bag.close({ signal: controller.signal }).catch` | `await bag.close({ abortSignal: controller.signal }).catch` |
| `await bag.close({ timeoutMs: 1_000, signal: controller.signal });` | `await bag.close({ waitTimeoutMs: 1_000, abortSignal: controller.signal });` |
| `{ operation: 'close', reason: 'timeout', timeoutMs: 1, pending: ['stuck'], acquiring: [] }` | `{ operation: 'close', reason: 'timeout', waitTimeoutMs: 1, disposersStillRunning: ['stuck'], acquisitionsStillPending: [] }` |
| `{ operation: 'close', reason: 'aborted', pending: ['stuck'], acquiring: [] }` | `{ operation: 'close', reason: 'aborted', disposersStillRunning: ['stuck'], acquisitionsStillPending: [] }` |
| `expect(error.details.pending).toEqual([]);` | `expect(error.details.disposersStillRunning).toEqual([]);` |
| `expect(error.details.acquiring).toEqual(['slow']);` | `expect(error.details.acquisitionsStillPending).toEqual(['slow']);` |
| `expect(childError.details.pending).toEqual(['session']);` | `expect(childError.details.disposersStillRunning).toEqual(['session']);` |
| `expect(rootError.details.pending).toEqual(['session']);` | `expect(rootError.details.disposersStillRunning).toEqual(['session']);` |

In the test `close rejects malformed options without starting cleanup`, replace the list of options with this one. The old option names are now rejected like any unknown key:

```ts
  for (const options of [null, [], { waitTimeoutMs: 0 }, { waitTimeoutMs: Infinity }, { waitTimeoutMs: '1' }, { abortSignal: {} }, { timeoutMs: 1 }, { signal: new AbortController().signal }, { startupOrder: 'sequential' }, Object.create({ waitTimeoutMs: 1 })]) {
```

In `tests/acquisition-cleanup.test.ts`, in the test near line 719, change `bag.close({ timeoutMs: 5 })` to `bag.close({ waitTimeoutMs: 5 })` and `.details.pending` to `.details.disposersStillRunning`. Leave `.cleanupPromise` on that `DiBagCloseCancelledError` alone.

In `tests/types/startup.ts` change the two lines and the last contract:

```ts
export const boundedClose = closeBag.close({ waitTimeoutMs: 100, abortSignal: new AbortController().signal });
export const scopeClosed = closeBag.createScope().close({ waitTimeoutMs: 1 });
```

```ts
  Assert<Equal<DiBagCloseCancelledError['details']['disposersStillRunning'], readonly string[]>>,
```

In `tests/types/negative/startup.ts` replace the three `closable.close` cases with these five:

```ts
const closable = DiBag.createBuilder().register({ value: () => 1 }).build();
// diagnostic: not assignable
closable.close({ waitTimeoutMs: '1' });
// diagnostic: does not exist in type 'CloseOptions'
closable.close({ maxConcurrentServiceKeys: 1 });
// diagnostic: missing the following properties from type 'AbortSignal'
closable.close({ abortSignal: {} });
// diagnostic: does not exist in type 'CloseOptions'
closable.close({ timeoutMs: 1 });
// diagnostic: does not exist in type 'CloseOptions'
closable.close({ signal: new AbortController().signal });
```

- [ ] **Step 2: Run the runtime test to verify it fails**

Run: `bun test tests/runtime-diagnostics.test.ts`
Expected: FAIL. The close tests reject with `DI_BAG_INVALID_CLOSE` or report `details` with the old keys.

- [ ] **Step 3: Rename in `src/errors.ts`**

Replace everything from the comment that begins `What a close deadline or abort interrupted` to the end of the file with:

````ts
/**
 * What a close deadline or abort interrupted: labels still in progress when the wait stopped.
 * @see https://dany-fedorov.github.io/di-bag/agent/errors.html#di-bag-close-timeout
 */
export interface CloseProgress {
  /** Labels of disposers that started and had not completed. */
  readonly disposersStillRunning: readonly string[];
  /** Labels of acquisitions that had started and were not ready yet. */
  readonly acquisitionsStillPending: readonly string[];
}

/**
 * A `close({ waitTimeoutMs, abortSignal })` wait stopped before cleanup finished; cleanup keeps running.
 * `code` is `DI_BAG_CLOSE_TIMEOUT` for the deadline and `DI_BAG_CLOSE_ABORTED` for the signal.
 * @example
 * ```ts
 * import { DiBag, DiBagCloseCancelledError } from 'di-bag';
 *
 * const bag = DiBag.createBuilder().register({ value: () => 1 }).build();
 * try {
 *   await bag.close({ waitTimeoutMs: 5_000 });
 * } catch (error) {
 *   if (error instanceof DiBagCloseCancelledError) console.error(error.details.disposersStillRunning);
 *   throw error;
 * }
 * ```
 */
export class DiBagCloseCancelledError extends Error {
  declare readonly code: 'DI_BAG_CLOSE_TIMEOUT' | 'DI_BAG_CLOSE_ABORTED';
  declare readonly details: Readonly<{ operation: 'close'; reason: 'aborted' | 'timeout'; waitTimeoutMs?: number } & CloseProgress>;
  /**
   * @param reason - Whether an external abort or the close deadline stopped the wait.
   * @param cause - The abort reason, or a `TimeoutError` DOMException for the deadline.
   * @param cleanupPromise - The bag's shared shutdown promise; it settles when cleanup eventually finishes.
   * @param progress - Labels still in progress when the wait stopped.
   * @param waitTimeoutMs - The deadline that elapsed, for `reason: 'timeout'`.
   */
  constructor(
    readonly reason: 'aborted' | 'timeout',
    cause: unknown,
    readonly cleanupPromise: Promise<void>,
    progress: CloseProgress,
    waitTimeoutMs?: number,
  ) {
    const code = reason === 'timeout' ? 'DI_BAG_CLOSE_TIMEOUT' : 'DI_BAG_CLOSE_ABORTED';
    const waiting = progress.disposersStillRunning.length ? `; disposers still running: ${progress.disposersStillRunning.join(', ')}`
      : progress.acquisitionsStillPending.length ? `; acquisitions still pending: ${progress.acquisitionsStillPending.join(', ')}` : '';
    super(diagnosticMessage(code, `Bag close ${reason === 'timeout' ? `timed out after ${waitTimeoutMs}ms` : 'aborted'}${waiting}`), { cause });
    this.name = 'DiBagCloseCancelledError';
    diagnostic(this, code, {
      operation: 'close', reason, ...(waitTimeoutMs === undefined ? {} : { waitTimeoutMs }),
      disposersStillRunning: Object.freeze([...progress.disposersStillRunning]),
      acquisitionsStillPending: Object.freeze([...progress.acquisitionsStillPending]),
    });
    void cleanupPromise.catch(() => {});
  }
}
````

- [ ] **Step 4: Rename in `src/runtime.ts`**

In `BagRuntime.closeProgress`, change the return type and the return statement. The two local arrays keep their names:

```ts
  closeProgress(): { readonly disposersStillRunning: readonly string[]; readonly acquisitionsStillPending: readonly string[] } {
```

```ts
    return { disposersStillRunning: pending, acquisitionsStillPending: acquiring };
```

- [ ] **Step 5: Rename in `src/startup.ts`**

Replace the `CloseOptions` interface body:

```ts
export interface CloseOptions {
  /** Aborting it stops the wait promptly. Cleanup keeps running. */
  readonly abortSignal?: AbortSignal;
  /** A finite positive deadline in milliseconds for the wait, not for the cleanup. */
  readonly waitTimeoutMs?: number;
}
```

Give `snapshotOptions` two more parameters, with defaults that keep `buildAndStart` working until Task 5, and use them where the function validates the deadline and the signal:

```ts
function snapshotOptions(options: unknown, operation: 'buildAndStart' | 'close', code: DiBagErrorCode, supported: readonly string[], timeoutKey = 'timeoutMs', signalKey = 'signal'): Record<string, unknown> {
```

```ts
  const timeout = selected[timeoutKey];
  if (Object.hasOwn(selected, timeoutKey) && (typeof timeout !== 'number' || !Number.isFinite(timeout) || timeout <= 0)) {
    throw libraryError(code, `${operation} ${timeoutKey} must be finite and positive`, { operation });
  }
  if (Object.hasOwn(selected, signalKey)) {
    try { Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted')!.get!.call(selected[signalKey]); }
    catch { throw libraryError(code, `${operation} ${signalKey} must be an AbortSignal`, { operation }); }
  }
```

In `closeRuntime`, read the new names into the existing local variables, and rename the key in the timeout error's details:

```ts
  try { selected = snapshotOptions(options, 'close', 'DI_BAG_INVALID_CLOSE', ['abortSignal', 'waitTimeoutMs'], 'waitTimeoutMs', 'abortSignal') as CloseOptions; }
  catch (error) { return Promise.reject(error); }
  const { abortSignal: signal, waitTimeoutMs: timeoutMs } = selected;
```

```ts
        cancel('timeout', formatted(diagnostic(new DOMException(diagnosticMessage('DI_BAG_CLOSE_TIMEOUT', 'Bag close timed out'), 'TimeoutError'), 'DI_BAG_CLOSE_TIMEOUT', { operation: 'close', waitTimeoutMs: timeoutMs })));
```

- [ ] **Step 6: Update the JSDoc of `Bag.close` in `src/di-bag.ts`**

Three replacements inside that comment. In the sentence that starts "With", the two option names `timeoutMs` and `signal` become `waitTimeoutMs` and `abortSignal`. In the `@throws` text, `details.pending` becomes `details.disposersStillRunning`. The example line becomes:

```ts
   * await bag.close({ waitTimeoutMs: 10_000, abortSignal: AbortSignal.timeout(15_000) });
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm run typecheck && bun test tests/runtime-diagnostics.test.ts tests/acquisition-cleanup.test.ts`
Expected: typecheck exits 0; both files pass with 0 fail.

Run: `bun test tests/types.test.ts -t startup`
Expected: PASS for `startup and contextual providers retain exact inferred cross-file contracts` and `type rejection: startup.ts`. This takes one to three minutes because the file compiles every negative fixture once.

- [ ] **Step 8: Update three sections of `docs/agent/errors.md`**

In `DI_BAG_CLOSE_ABORTED`: `close({ signal })` becomes `close({ abortSignal })`; `details.pending` becomes `details.disposersStillRunning`; `details.acquiring` becomes `details.acquisitionsStillPending`; the code block calls `app.close({ abortSignal: controller.signal })` and logs `error.details.disposersStillRunning, error.details.acquisitionsStillPending`. Keep `cleanupPromise`.

In `DI_BAG_CLOSE_TIMEOUT`: `close({ timeoutMs })` becomes `close({ waitTimeoutMs })`; both other mentions of `timeoutMs` become `waitTimeoutMs`; `details.pending` and `details.acquiring` as above; the code block calls `app.close({ waitTimeoutMs: 5_000 })` and logs `error.details.disposersStillRunning`.

In `DI_BAG_INVALID_CLOSE`: the options shape `{ timeoutMs?, signal? }` becomes `{ waitTimeoutMs?, abortSignal? }`; the words "a finite positive" are followed by `waitTimeoutMs` instead of `timeoutMs`; the fix line names `waitTimeoutMs` and `abortSignal` instead of `timeoutMs` and `signal`; the code block calls `app.close({ waitTimeoutMs: 1_000, abortSignal: AbortSignal.timeout(2_000) })`.

- [ ] **Step 9: Regenerate and check the docs**

Run: `npm run build && npm run docs:generate && npm run docs:check`
Expected: the last line reads `Prepared … Markdown pages; repository-only links point to GitHub.` and the command exits 0.

- [ ] **Step 10: Commit**

```bash
git add -A src tests docs/agent docs/reference
git commit -F - <<'MSG'
refactor!: close takes abortSignal and waitTimeoutMs; progress fields say what they list

CloseProgress.pending and .acquiring become disposersStillRunning and
acquisitionsStillPending, in DiBagCloseCancelledError.details too, where
timeoutMs becomes waitTimeoutMs.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

---

### Task 2: Add the service readiness error classes

Two new classes next to the startup ones. Nothing throws them yet; Task 3 does.

**Files:**
- Modify: `src/errors.ts`, `src/index.ts`
- Test: `tests/ensure-services-ready.test.ts` (created here with one test, completed in Task 3)

**Interfaces:**
- Consumes: `CloseProgress` with the fields of Task 1; `CleanupFailure`, `diagnostic`, `diagnosticMessage` from `src/errors.ts`.
- Produces: `new DiBagServiceReadinessError(cause: unknown, disposalFailures: readonly CleanupFailure[], disposalError?: unknown)` with `code: 'DI_BAG_SERVICE_READINESS_FAILED'`; `new DiBagServiceReadinessCancelledError(reason: 'aborted' | 'timeout', cause: unknown, disposalPromise: Promise<void>, progress: CloseProgress, totalTimeoutMs?: number)` with `code: 'DI_BAG_SERVICE_READINESS_CANCELLED'`. Both exported from `src/index.ts`, and so from `src/node.ts`.

- [ ] **Step 1: Write the failing test**

Create `tests/ensure-services-ready.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { DiBagServiceReadinessCancelledError, DiBagServiceReadinessError } from '../src/node';

test('the readiness errors carry their code, their details and a message that says what happened to the bag', () => {
  const cause = new Error('offline');
  const failed = new DiBagServiceReadinessError(cause, []);
  expect(failed.name).toBe('DiBagServiceReadinessError');
  expect(failed.code).toBe('DI_BAG_SERVICE_READINESS_FAILED');
  expect(failed.cause).toBe(cause);
  expect(failed.message).toContain('The listed services are not ready: a factory failed; this bag is closed;');
  const cancelled = new DiBagServiceReadinessCancelledError('timeout', cause, Promise.resolve(), { disposersStillRunning: [], acquisitionsStillPending: ['db'] }, 5);
  expect(cancelled.name).toBe('DiBagServiceReadinessCancelledError');
  expect(cancelled.code).toBe('DI_BAG_SERVICE_READINESS_CANCELLED');
  expect(cancelled.details).toEqual({ operation: 'ensureServicesReady', reason: 'timeout', totalTimeoutMs: 5, disposersStillRunning: [], acquisitionsStillPending: ['db'] });
  expect(cancelled.message).toContain('the wait timed out after 5ms; acquisitions still pending: db; this bag is closing;');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test tests/ensure-services-ready.test.ts`
Expected: FAIL, the import has no `DiBagServiceReadinessError`.

- [ ] **Step 3: Add the classes to `src/errors.ts`**

Insert this block immediately before the comment that begins `What a close deadline or abort interrupted`. `CloseProgress` is declared below it in the same file, which TypeScript allows for an interface.

````ts
/**
 * `ensureServicesReady` could not make a listed service ready, and this bag is now closed.
 * `cause` is the original failure and `disposalFailures` lists disposers that failed while the bag closed.
 * @example
 * ```ts
 * import { DiBag, DiBagServiceReadinessError } from 'di-bag';
 *
 * const bag = DiBag.createBuilder().register({ db: async (): Promise<number> => { throw new Error('offline'); } }).build();
 * try {
 *   await bag.ensureServicesReady(['db']);
 * } catch (error) {
 *   if (error instanceof DiBagServiceReadinessError) console.error(error.cause, error.disposalFailures);
 * }
 * ```
 */
export class DiBagServiceReadinessError extends Error {
  declare readonly code: 'DI_BAG_SERVICE_READINESS_FAILED';
  declare readonly details: Readonly<Record<string, unknown>>;
  /** Frozen disposal failures in invocation order, collected while this bag closed. */
  readonly disposalFailures: readonly CleanupFailure[];

  /**
   * @param cause - The original failure of a listed service or of one of its dependencies.
   * @param disposalFailures - Structured failures collected while closing the bag.
   * @param disposalError - The complete shutdown error, when closing itself rejected.
   */
  constructor(cause: unknown, disposalFailures: readonly CleanupFailure[], readonly disposalError?: unknown) {
    super(diagnosticMessage('DI_BAG_SERVICE_READINESS_FAILED', 'The listed services are not ready: a factory failed; this bag is closed'), { cause });
    this.name = 'DiBagServiceReadinessError';
    this.disposalFailures = Object.freeze(disposalFailures.map(item => Object.freeze({ ...item })));
    diagnostic(this, 'DI_BAG_SERVICE_READINESS_FAILED', { operation: 'ensureServicesReady', disposalFailures: this.disposalFailures });
  }
}

/**
 * `ensureServicesReady` stopped waiting on abort or timeout; this bag is closing and `disposalPromise` settles when it has closed.
 * `details` names what was still in progress. On timeout, `cause` carries `DI_BAG_SERVICE_READINESS_TIMEOUT`.
 * @example
 * ```ts
 * import { DiBag, DiBagServiceReadinessCancelledError } from 'di-bag';
 *
 * const bag = DiBag.createBuilder().register({ db: () => new Promise<number>(() => {}) }).build();
 * try {
 *   await bag.ensureServicesReady(['db'], { totalTimeoutMs: 1_000 });
 * } catch (error) {
 *   if (error instanceof DiBagServiceReadinessCancelledError) console.error(error.details.acquisitionsStillPending);
 * }
 * ```
 */
export class DiBagServiceReadinessCancelledError extends Error {
  declare readonly code: 'DI_BAG_SERVICE_READINESS_CANCELLED';
  declare readonly details: Readonly<{ operation: 'ensureServicesReady'; reason: 'aborted' | 'timeout'; totalTimeoutMs?: number } & CloseProgress>;
  /**
   * @param reason - Whether an external abort or the deadline cancelled the wait.
   * @param cause - The abort reason or the generated timeout error.
   * @param disposalPromise - Eventual shutdown of this bag; cancellation does not await it.
   * @param progress - Labels still in progress when the wait stopped.
   * @param totalTimeoutMs - The deadline that elapsed, for `reason: 'timeout'`.
   */
  constructor(
    readonly reason: 'aborted' | 'timeout',
    cause: unknown,
    readonly disposalPromise: Promise<void>,
    progress: CloseProgress,
    totalTimeoutMs?: number,
  ) {
    const waiting = progress.acquisitionsStillPending.length ? `; acquisitions still pending: ${progress.acquisitionsStillPending.join(', ')}`
      : progress.disposersStillRunning.length ? `; disposers still running: ${progress.disposersStillRunning.join(', ')}` : '';
    super(diagnosticMessage('DI_BAG_SERVICE_READINESS_CANCELLED', `The listed services were not ready: the wait ${reason === 'timeout' ? `timed out after ${totalTimeoutMs}ms` : 'was aborted'}${waiting}; this bag is closing`), { cause });
    this.name = 'DiBagServiceReadinessCancelledError';
    diagnostic(this, 'DI_BAG_SERVICE_READINESS_CANCELLED', {
      operation: 'ensureServicesReady', reason, ...(totalTimeoutMs === undefined ? {} : { totalTimeoutMs }),
      disposersStillRunning: Object.freeze([...progress.disposersStillRunning]),
      acquisitionsStillPending: Object.freeze([...progress.acquisitionsStillPending]),
    });
    void disposalPromise.catch(() => {});
  }
}
````

- [ ] **Step 4: Export them from `src/index.ts`**

In the first export statement add the two names next to the startup ones:

```ts
export { DiBagCleanupError, DiBagCloseCancelledError, DiBagPluginValidationError, DiBagServiceReadinessError, DiBagServiceReadinessCancelledError, DiBagStartupError, DiBagStartupCancelledError } from './errors';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun test tests/ensure-services-ready.test.ts && npm run typecheck`
Expected: 1 pass, 0 fail; typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/errors.ts src/index.ts tests/ensure-services-ready.test.ts
git commit -F - <<'MSG'
feat: service readiness error classes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

`npm run docs:check` fails between this commit and the next, because the two new codes have no section in `docs/agent/errors.md` yet. Task 3 adds all three sections together.

---

### Task 3: Add `Bag.ensureServicesReady`

**Files:**
- Modify: `src/startup.ts`, `src/di-bag.ts`, `src/index.ts`
- Modify: `tests/types/startup.ts`, `tests/types/negative/startup.ts`
- Modify: `docs/agent/errors.md`
- Test: `tests/ensure-services-ready.test.ts`

**Interfaces:**
- Consumes: `BagRuntime.assertOpen()`, `BagRuntime.acquire(key): Promise<void>`, `BagRuntime.close(cause?): Promise<void>`, `BagRuntime.closeProgress()` from `src/runtime.ts`; `BindingGraph.hasPublic(key)`; `readTokenKey` from `src/tokens.ts`; the two classes of Task 2; `snapshotOptions` with the six parameters of Task 1; the private fields `#runtime` and `#graph` of `Bag`.
- Produces: `export interface EnsureServicesReadyOptions { readonly abortSignal?: AbortSignal; readonly totalTimeoutMs?: number; readonly maxConcurrentServiceKeys?: number }`; `export function ensureRuntimeReady(runtime: BagRuntime, graph: BindingGraph, keys: readonly unknown[], options?: EnsureServicesReadyOptions): Promise<void>`; `Bag.prototype.ensureServicesReady<const K extends readonly unknown[]>(serviceKeys: K & Selection<R, K, 'ensureServicesReady'>, options?: EnsureServicesReadyOptions): Promise<this>`.

Behavior, which the tests below pin:
- The bag must be open, else the call rejects with `DI_BAG_CLOSING` or `DI_BAG_CLOSED`.
- Keys are read by index once, then the options are read once. A key that is not a public name or a genuine token, or a malformed option, rejects with `DI_BAG_INVALID_STARTUP` or `DI_BAG_INVALID_TOKEN`. No factory has run and the bag stays open and usable. The old option names `signal`, `timeoutMs` and `startupOrder` are unknown options.
- An already aborted signal closes the bag and runs no factory.
- With no `maxConcurrentServiceKeys` every listed key is acquired at once. With a number, that many keys are in flight, in tuple order, and no queued key starts after a failure or a cancellation.
- A factory failure closes this bag with the failure as cause, waits for the close, and rejects with `DiBagServiceReadinessError`.
- An abort or the deadline rejects at once with `DiBagServiceReadinessCancelledError`. Its `details` list what was still pending, read before the close starts. `disposalPromise` settles when the bag has closed.
- A child scope closes only itself. Its parent and any service it borrows stay usable.
- On success the timer and the abort listener are removed, and the call resolves to the same bag. The call may be repeated.
- Every failure is a rejection, never a synchronous throw, because the method is `async`. The first factory still runs synchronously inside the call, as it did in `buildAndStart`.

- [ ] **Step 1: Write the failing runtime tests**

Replace the whole content of `tests/ensure-services-ready.test.ts` with the file below, and then append the one test of Task 2 at its end unchanged, so that it keeps running.

````ts
import { expect, test } from 'bun:test';
import { getEventListeners } from 'node:events';
import { DiBag, DiBagCleanupError, DiBagServiceReadinessCancelledError, DiBagServiceReadinessError } from '../src/node';
import { deferred } from './helpers';

const turn = () => new Promise<void>(resolve => setImmediate(resolve));

test('ensureServicesReady resolves to the same bag once the listed services are ready and leaves the rest lazy', async () => {
  const gate = deferred<number>();
  let mailerCalls = 0;
  const bag = DiBag.createBuilder().register({
    db: () => gate.promise,
    mailer: () => ++mailerCalls,
  }).build();
  const ensuring = bag.ensureServicesReady(['db']);
  let ready = false;
  void ensuring.then(() => { ready = true; });
  await turn();
  expect(ready).toBe(false);
  gate.resolve(7);
  expect(await ensuring).toBe(bag);
  expect(bag.resolve('db')).toBe(gate.promise);
  expect(mailerCalls).toBe(0);
  await bag.close();
});

test('ensureServicesReady accepts typed tokens, duplicates and an empty tuple', async () => {
  const key = Symbol('port');
  const port = DiBag.token(key).of<number>();
  let calls = 0;
  const bag = DiBag.createBuilder().register(port, () => ++calls).register({ name: () => 'api' }).build();
  expect(await bag.ensureServicesReady([])).toBe(bag);
  expect(calls).toBe(0);
  await bag.ensureServicesReady([port, 'name', port]);
  expect(calls).toBe(1);
  expect(bag.resolve(port)).toBe(1);
  await bag.close();
});

test('repeated readiness calls reuse cached services and may add more', async () => {
  let calls = 0;
  const bag = DiBag.createBuilder().register({ a: () => ++calls, b: () => 'b' }).build();
  await bag.ensureServicesReady(['a']);
  await bag.ensureServicesReady(['a', 'b']);
  expect(calls).toBe(1);
  expect(bag.resolve('b')).toBe('b');
  await bag.close();
});

test('maxConcurrentServiceKeys 1 acquires the listed services one after another in tuple order', async () => {
  const gate = deferred<number>();
  const calls: string[] = [];
  const bag = DiBag.createBuilder().register({
    first: () => { calls.push('first'); return gate.promise; },
    second: () => { calls.push('second'); return 2; },
  }).build();
  const ensuring = bag.ensureServicesReady(['first', 'second'], { maxConcurrentServiceKeys: 1 });
  expect(calls).toEqual(['first']);
  gate.resolve(1);
  await ensuring;
  expect(calls).toEqual(['first', 'second']);
  await bag.close();
});

test('an omitted bound acquires every listed service at once', async () => {
  const gate = deferred<number>();
  const calls: string[] = [];
  const bag = DiBag.createBuilder().register({
    first: () => { calls.push('first'); return gate.promise; },
    second: () => { calls.push('second'); return 2; },
  }).build();
  const ensuring = bag.ensureServicesReady(['first', 'second']);
  expect(calls).toEqual(['first', 'second']);
  gate.resolve(1);
  await ensuring;
  await bag.close();
});

test('a child scope is made ready and resolves to that scope', async () => {
  const parent = DiBag.createBuilder().register({ session: () => ({ id: Math.random() }) }).build();
  const child = parent.createScope();
  expect(await child.ensureServicesReady(['session'])).toBe(child);
  expect(child.resolve('session')).not.toBe(parent.resolve('session'));
  await parent.close();
});

test('a failed readiness call on a child scope closes that scope only', async () => {
  const cause = new Error('session store offline');
  const disposed: string[] = [];
  const parent = DiBag.createBuilder().register({
    pool: DiBag.withDisposal(() => ({ name: 'pool' }), () => { disposed.push('pool'); }),
    cache: DiBag.withDisposal(() => ({ name: 'cache' }), () => { disposed.push('cache'); }),
    session: DiBag.withDisposal(({ pool }: { pool: { name: string } }) => ({ owner: pool.name }), () => { disposed.push('session'); }),
    broken: (): number => { throw cause; },
  }).build();
  const parentCache = parent.resolve('cache');
  const child = parent.createScope({ share: ['cache'] });
  const error: unknown = await child.ensureServicesReady(['session', 'cache', 'broken'], { maxConcurrentServiceKeys: 1 }).catch(caught => caught);
  expect(error).toBeInstanceOf(DiBagServiceReadinessError);
  if (!(error instanceof DiBagServiceReadinessError)) throw error;
  expect(error.cause).toBe(cause);
  expect(disposed).toEqual(['session', 'pool']);
  expect(() => child.resolve('session')).toThrow('DI_BAG_CLOSED');
  expect(parent.resolve('cache')).toBe(parentCache);
  expect(parent.resolve('pool')).toEqual({ name: 'pool' });
  await parent.close();
  expect(disposed.slice(2).sort()).toEqual(['cache', 'pool']);
});

test('an independent fork is made ready and closed on its own', async () => {
  const app = DiBag.createBuilder().register({
    clock: () => ({ now: () => 42 }),
    stamp: ({ clock }: { clock: { now(): number } }) => clock.now(),
  }).build();
  const forked = app.fork(['clock'], { clock: () => ({ now: () => 7 }) });
  expect(await forked.ensureServicesReady(['stamp'])).toBe(forked);
  expect(forked.resolve('stamp')).toBe(7);
  await forked.close();
  expect(app.resolve('stamp')).toBe(42);
  await app.close();
});

test('a factory failure closes this bag and reports disposal failures', async () => {
  const cause = new Error('offline');
  const disposalFailure = new Error('dispose');
  const calls: string[] = [];
  const bag = DiBag.createBuilder().register({
    owned: DiBag.withDisposal(() => { calls.push('owned'); return 1; }, () => { throw disposalFailure; }),
    db: (): number => { calls.push('db'); throw cause; },
    queued: () => { calls.push('queued'); return 3; },
  }).build();
  const error: unknown = await bag.ensureServicesReady(['owned', 'db', 'queued'], { maxConcurrentServiceKeys: 1 }).catch(caught => caught);
  expect(error).toBeInstanceOf(DiBagServiceReadinessError);
  if (!(error instanceof DiBagServiceReadinessError)) throw error;
  expect(error.name).toBe('DiBagServiceReadinessError');
  expect(error.code).toBe('DI_BAG_SERVICE_READINESS_FAILED');
  expect(error.cause).toBe(cause);
  expect(error.disposalFailures.map(failure => failure.error)).toEqual([disposalFailure]);
  expect(Object.isFrozen(error.disposalFailures)).toBe(true);
  expect(error.disposalError).toBeInstanceOf(DiBagCleanupError);
  expect(error.details).toEqual({ operation: 'ensureServicesReady', disposalFailures: error.disposalFailures });
  expect(error.message).toContain('DI_BAG_SERVICE_READINESS_FAILED: The listed services are not ready: a factory failed; this bag is closed;');
  expect(error.message).toContain('#di-bag-service-readiness-failed');
  expect(calls).toEqual(['owned', 'db']);
  expect(() => bag.resolve('owned')).toThrow('DI_BAG_CLOSED');
});

test('a timeout names the services that were still pending and closes the bag', async () => {
  const gate = deferred<number>();
  const bag = DiBag.createBuilder().register({ fast: () => 1, slow: () => gate.promise }).build();
  const error: unknown = await bag.ensureServicesReady(['fast', 'slow'], { totalTimeoutMs: 5 }).catch(caught => caught);
  expect(error).toBeInstanceOf(DiBagServiceReadinessCancelledError);
  if (!(error instanceof DiBagServiceReadinessCancelledError)) throw error;
  expect(error.name).toBe('DiBagServiceReadinessCancelledError');
  expect(error.reason).toBe('timeout');
  expect(error.code).toBe('DI_BAG_SERVICE_READINESS_CANCELLED');
  expect(error.details).toEqual({ operation: 'ensureServicesReady', reason: 'timeout', totalTimeoutMs: 5, disposersStillRunning: [], acquisitionsStillPending: ['slow'] });
  expect(error.message).toContain('The listed services were not ready: the wait timed out after 5ms; acquisitions still pending: slow; this bag is closing;');
  const cause = error.cause as DOMException & { code?: string; details?: unknown };
  expect(cause.name).toBe('TimeoutError');
  expect(cause.code).toBe('DI_BAG_SERVICE_READINESS_TIMEOUT');
  expect(cause.details).toEqual({ operation: 'ensureServicesReady', totalTimeoutMs: 5 });
  expect(() => bag.resolve('fast')).toThrow(/DI_BAG_CLOS/);
  gate.resolve(1);
  await error.disposalPromise;
  expect(() => bag.resolve('fast')).toThrow('DI_BAG_CLOSED');
});

test('an abort rejects promptly with the abort reason and settles disposalPromise after cleanup', async () => {
  const gate = deferred<number>();
  const controller = new AbortController();
  const reason = new Error('shutting down');
  const disposed: number[] = [];
  const bag = DiBag.createBuilder().register({
    slow: DiBag.withDisposal(() => gate.promise, value => { disposed.push(value); }),
  }).build();
  const outcome = bag.ensureServicesReady(['slow'], { abortSignal: controller.signal }).catch(caught => caught);
  expect(getEventListeners(controller.signal, 'abort')).toHaveLength(1);
  controller.abort(reason);
  const error: unknown = await outcome;
  expect(error).toBeInstanceOf(DiBagServiceReadinessCancelledError);
  if (!(error instanceof DiBagServiceReadinessCancelledError)) throw error;
  expect(error.reason).toBe('aborted');
  expect(error.cause).toBe(reason);
  expect(error.details).toEqual({ operation: 'ensureServicesReady', reason: 'aborted', disposersStillRunning: [], acquisitionsStillPending: ['slow'] });
  expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
  expect(disposed).toEqual([]);
  gate.resolve(9);
  await error.disposalPromise;
  expect(disposed).toEqual([9]);
});

test('an already aborted signal closes the bag and runs no factory', async () => {
  const controller = new AbortController();
  const reason = { cancelled: true };
  controller.abort(reason);
  let calls = 0;
  const bag = DiBag.createBuilder().register({ value: () => ++calls }).build();
  const error: unknown = await bag.ensureServicesReady(['value'], { abortSignal: controller.signal }).catch(caught => caught);
  expect(error).toBeInstanceOf(DiBagServiceReadinessCancelledError);
  if (!(error instanceof DiBagServiceReadinessCancelledError)) throw error;
  expect(error.cause).toBe(reason);
  await error.disposalPromise;
  expect(calls).toBe(0);
  expect(() => bag.resolve('value')).toThrow('DI_BAG_CLOSED');
});

test('after success the abort listener and the timer are gone and a later abort does not close the bag', async () => {
  const controller = new AbortController();
  const bag = DiBag.createBuilder().register({ value: () => 1 }).build();
  await bag.ensureServicesReady(['value'], { abortSignal: controller.signal, totalTimeoutMs: 2 ** 32 });
  expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
  controller.abort();
  expect(bag.resolve('value')).toBe(1);
  await bag.close();
});

test('invalid input rejects before any factory runs and leaves the bag usable', async () => {
  let effects = 0;
  const bag = DiBag.createBuilder().register({ value: () => ++effects }).build();
  const ensure = bag.ensureServicesReady.bind(bag) as (...args: unknown[]) => Promise<unknown>;
  const invalidOptions = [
    null, [], true,
    { totalTimeoutMs: 0 }, { totalTimeoutMs: -1 }, { totalTimeoutMs: Infinity }, { totalTimeoutMs: NaN }, { totalTimeoutMs: '1' },
    { maxConcurrentServiceKeys: 0 }, { maxConcurrentServiceKeys: -1 }, { maxConcurrentServiceKeys: 0.5 }, { maxConcurrentServiceKeys: NaN },
    { maxConcurrentServiceKeys: Infinity }, { maxConcurrentServiceKeys: Number.MAX_SAFE_INTEGER + 1 }, { maxConcurrentServiceKeys: 'serial' },
    { abortSignal: {} },
    { timeoutMs: 1 }, { signal: new AbortController().signal }, { startupOrder: 'sequential' },
    { other: true, get totalTimeoutMs() { effects++; return 1; } },
    Object.create({ totalTimeoutMs: 1 }),
  ];
  for (const options of invalidOptions) {
    const error = await ensure(['value'], options).catch((caught: unknown) => caught) as { code?: string; message?: string; details?: unknown };
    expect(error.code).toBe('DI_BAG_INVALID_STARTUP');
    expect(error.message).toContain('ensureServicesReady');
  }
  const bound = await ensure(['value'], { maxConcurrentServiceKeys: 0 }).catch((caught: unknown) => caught) as { message: string; details: unknown };
  expect(bound.message).toContain('ensureServicesReady maxConcurrentServiceKeys must be a positive safe integer');
  expect(bound.details).toEqual({ operation: 'ensureServicesReady', option: 'maxConcurrentServiceKeys' });
  for (const keys of [undefined, 'value', [null], ['missing'], [{ key: Symbol('fake') }]]) {
    await expect(ensure(keys)).rejects.toThrow();
  }
  expect(effects).toBe(0);
  expect(bag.resolve('value')).toBe(1);
  await bag.ensureServicesReady(['value'], { maxConcurrentServiceKeys: Number.MAX_SAFE_INTEGER });
  await bag.close();
});

test('a closing or closed bag rejects with its state code', async () => {
  const bag = DiBag.createBuilder().register({ value: () => 1 }).build();
  await bag.close();
  const error = await bag.ensureServicesReady(['value']).catch((caught: unknown) => caught) as { code?: string };
  expect(error.code).toBe('DI_BAG_CLOSED');
});
````

- [ ] **Step 2: Move the compiler fixtures to the new method**

In `tests/types/startup.ts`:

1. Add `type EnsureServicesReadyOptions` to the import list from `'../../src'`.
2. Replace the five lines that call `buildAndStart` (`started`, `sequential`, `bounded`, `empty`, `reflected`) with:

```ts
export const started = lazy.ensureServicesReady(['contextual', selectedToken, 'raw', 'renamed']);
export const sequential = lazy.ensureServicesReady(['contextual'], { maxConcurrentServiceKeys: 1, abortSignal: new AbortController().signal, totalTimeoutMs: 100 });
export const bounded = lazy.ensureServicesReady(['contextual'], { maxConcurrentServiceKeys: 4 });
export const empty = lazy.ensureServicesReady([]);
```

```ts
export const reflected = lazy.ensureServicesReady<readonly ['contextual']>;
```

   `export const lazy = builder.build();` must stand above them. Move it up if it does not.
3. After the `pushed` constant add:

```ts
const readyChild = lazy.createScope();
export const readyInChild = readyChild.ensureServicesReady(['contextual']);
const readyFork = lazy.fork();
export const readyInFork = readyFork.ensureServicesReady([selectedToken]);
export type ReadinessContracts = [
  Assert<Equal<Awaited<typeof readyInChild>, typeof readyChild>>,
  Assert<Equal<Awaited<typeof readyInFork>, typeof readyFork>>,
  Assert<Equal<Parameters<typeof lazy.ensureServicesReady>[1], EnsureServicesReadyOptions | undefined>>,
];
```

   The existing `Contracts` tuple already asserts `Equal<Awaited<typeof started>, typeof lazy>` and that `sequential`, `empty`, `bounded` and `reflected` have the type of `started`. Leave it as it is: it now proves that the call resolves to the same bag type.

`tests/types/startup-consumer.ts` needs no edit: it imports `started`, `bounded` and `lazy` by those names.

In `tests/types/negative/startup.ts` replace the block from `const builder = …` down to the `{ extra: true }` case with:

```ts
const builder = DiBag.createBuilder().register({ value: () => 1 });
const ready = builder.build();
// diagnostic: ensureServicesReady accepts existing names or typed tokens only
ready.ensureServicesReady(['missing']);
const widened: string[] = ['value'];
// diagnostic: ensureServicesReady requires a finite tuple
ready.ensureServicesReady(widened);
declare const optional: readonly ['value'?];
// diagnostic: ensureServicesReady requires a finite tuple
ready.ensureServicesReady(optional);
// diagnostic: Expected 1-2 arguments
ready.ensureServicesReady();
// diagnostic: not assignable
ready.ensureServicesReady(['value'], { maxConcurrentServiceKeys: 'serial' });
// diagnostic: not assignable
ready.ensureServicesReady(['value'], { maxConcurrentServiceKeys: true });
// diagnostic: not assignable
ready.ensureServicesReady(['value'], { totalTimeoutMs: '1' });
// diagnostic: missing the following properties from type 'AbortSignal'
ready.ensureServicesReady(['value'], { abortSignal: {} });
// diagnostic: does not exist in type 'EnsureServicesReadyOptions'
ready.ensureServicesReady(['value'], { extra: true });
// diagnostic: does not exist in type 'EnsureServicesReadyOptions'
ready.ensureServicesReady(['value'], { timeoutMs: 1 });
// diagnostic: does not exist in type 'EnsureServicesReadyOptions'
ready.ensureServicesReady(['value'], { startupOrder: 'sequential' });
```

and the four later `buildAndStart` cases with these. The graph error now lands on `build()`, on the same line, once:

```ts
// diagnostic: required service registrations are missing
missing.build().ensureServicesReady([]);
```

```ts
// diagnostic: root lifetime cannot capture scoped dependency
captive.build().ensureServicesReady(['root']);
```

```ts
// diagnostic: required service registrations are missing
DiBag.createBuilder().installModule(exportless).build().ensureServicesReady([]);
```

```ts
// diagnostic: ensureServicesReady accepts existing names or typed tokens only
DiBag.createBuilder().register(token, () => 1).build().ensureServicesReady([other]);
```

These exact messages were produced with both compilers on a prototype of the signature below.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun test tests/ensure-services-ready.test.ts; npm run typecheck`
Expected: the test file fails with `bag.ensureServicesReady is not a function`; typecheck reports `Property 'ensureServicesReady' does not exist on type 'Bag<…>'`.

- [ ] **Step 4: Add the options type and the function to `src/startup.ts`**

Change the import of error classes at the top of the file to:

```ts
import { DiBagCleanupError, DiBagCloseCancelledError, DiBagServiceReadinessCancelledError, DiBagServiceReadinessError, DiBagStartupCancelledError, DiBagStartupError } from './errors';
```

Add `'ensureServicesReady'` to the `operation` union of `snapshotOptions`:

```ts
function snapshotOptions(options: unknown, operation: 'buildAndStart' | 'ensureServicesReady' | 'close', code: DiBagErrorCode, supported: readonly string[], timeoutKey = 'timeoutMs', signalKey = 'signal'): Record<string, unknown> {
```

Add the interface directly after `CloseOptions`:

```ts
/**
 * Options of {@link Bag.ensureServicesReady}.
 * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#start-selected-services-and-cancel-cooperatively
 */
export interface EnsureServicesReadyOptions {
  /** Aborting it stops the wait and closes this bag. */
  readonly abortSignal?: AbortSignal;
  /** A finite positive deadline in milliseconds for the whole call, until every listed service is ready. It is not per service. On expiry this bag is closed. */
  readonly totalTimeoutMs?: number;
  /** How many entries of `serviceKeys` are acquired at once, in tuple order. Omitted means all at once, `1` means one after another. It does not limit the dependencies a factory reads. */
  readonly maxConcurrentServiceKeys?: number;
}
```

The `@see` URL is checked against the documentation site by `npm run docs:check`. That tutorial heading exists until phase 12 rewrites the guides. Do not change the URL here.

Insert this block immediately before the comment `/** One startup transaction; never assimilate an exposed service to establish readiness. */`. It is `startRuntime` with four differences: it receives the runtime, it checks that the runtime is open, it reads the new option names, and it reads the progress report before it closes.

````ts
function snapshotReadinessOptions(options: EnsureServicesReadyOptions | undefined): EnsureServicesReadyOptions {
  const selected = snapshotOptions(options, 'ensureServicesReady', 'DI_BAG_INVALID_STARTUP', ['abortSignal', 'totalTimeoutMs', 'maxConcurrentServiceKeys'], 'totalTimeoutMs', 'abortSignal');
  const bound = selected.maxConcurrentServiceKeys;
  if (Object.hasOwn(selected, 'maxConcurrentServiceKeys') && !(typeof bound === 'number' && Number.isSafeInteger(bound) && bound > 0)) {
    throw libraryError('DI_BAG_INVALID_STARTUP', 'ensureServicesReady maxConcurrentServiceKeys must be a positive safe integer', { operation: 'ensureServicesReady', option: 'maxConcurrentServiceKeys' });
  }
  return selected as EnsureServicesReadyOptions;
}

/**
 * Acquire the listed services on an existing runtime and wait until each is ready.
 * Invalid input throws before any factory runs and leaves the runtime untouched. A factory
 * failure, an abort, or the deadline closes this runtime; never assimilate an exposed service
 * to establish readiness.
 */
export function ensureRuntimeReady(runtime: BagRuntime, graph: BindingGraph, keys: readonly unknown[], options?: EnsureServicesReadyOptions): Promise<void> {
  runtime.assertOpen();
  if (!Array.isArray(keys)) throw libraryError('DI_BAG_INVALID_STARTUP', 'ensureServicesReady requires a tuple of service keys', { operation: 'ensureServicesReady' });
  const selected: BindingKey[] = [];
  const length = keys.length;
  for (let index = 0; index < length; index++) {
    const value: unknown = keys[index];
    const key = typeof value === 'string' ? value : readTokenKey(value);
    if (!graph.hasPublic(key)) throw libraryError('DI_BAG_INVALID_STARTUP', `ensureServicesReady accepts existing names or typed tokens only: ${String(key)}`, { operation: 'ensureServicesReady' });
    selected.push(key);
  }
  const { abortSignal, totalTimeoutMs, maxConcurrentServiceKeys } = snapshotReadinessOptions(options);
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const began = performance.now();
    const release = () => {
      if (timer !== undefined) clearTimeout(timer);
      abortSignal?.removeEventListener('abort', aborted);
    };
    const cancel = (reason: 'aborted' | 'timeout', cause: unknown) => {
      if (settled) return;
      settled = true;
      release();
      // Read the report before close starts, while the slow acquisitions are still pending.
      const progress = runtime.closeProgress();
      reject(new DiBagServiceReadinessCancelledError(reason, cause, runtime.close(cause), progress, reason === 'timeout' ? totalTimeoutMs : undefined));
    };
    const aborted = () => { if (abortSignal?.aborted) cancel('aborted', abortSignal.reason); };
    const checkCancellation = () => {
      aborted();
      if (!settled && totalTimeoutMs !== undefined && performance.now() - began >= totalTimeoutMs) {
        cancel('timeout', formatted(diagnostic(new DOMException(diagnosticMessage('DI_BAG_SERVICE_READINESS_TIMEOUT', 'The listed services were not ready before the deadline'), 'TimeoutError'), 'DI_BAG_SERVICE_READINESS_TIMEOUT', { operation: 'ensureServicesReady', totalTimeoutMs })));
      }
      return settled;
    };
    const schedule = () => {
      if (checkCancellation() || totalTimeoutMs === undefined) return;
      // Long deadlines must not wrap into an immediate timer on Node/Bun.
      timer = setTimeout(schedule, Math.min(2 ** 31 - 1, Math.max(1, totalTimeoutMs - (performance.now() - began))));
    };
    abortSignal?.addEventListener('abort', aborted, { once: true });
    if (checkCancellation()) return;
    if (totalTimeoutMs !== undefined) schedule();

    const runBounded = (limit: number) => {
      let next = 0;
      let failed = false;
      const worker = async () => {
        while (next < selected.length) {
          if (failed || checkCancellation()) return;
          const key = selected[next++]!;
          try { await runtime.acquire(key); }
          catch (cause) {
            // Stop other workers before rollback begins, even if cleanup waits.
            failed = true;
            throw cause;
          }
        }
      };
      return Promise.all(Array.from({ length: Math.min(limit, selected.length) }, worker));
    };
    const runAllAtOnce = () => {
      const pending: Promise<void>[] = [];
      for (const key of selected) {
        if (checkCancellation()) break;
        pending.push(runtime.acquire(key));
      }
      return Promise.all(pending);
    };
    const work = maxConcurrentServiceKeys === undefined ? runAllAtOnce() : runBounded(maxConcurrentServiceKeys);
    void work.then(() => {
      if (checkCancellation()) return;
      settled = true;
      release();
      resolve();
    }, async cause => {
      if (checkCancellation()) return;
      let disposalError: unknown;
      try { await runtime.close(cause); }
      catch (error) { disposalError = error; }
      if (checkCancellation()) return;
      settled = true;
      release();
      reject(new DiBagServiceReadinessError(cause, disposalError instanceof DiBagCleanupError ? disposalError.failures : [], disposalError));
    });
  });
}
````

- [ ] **Step 5: Add the method to `Bag` in `src/di-bag.ts`**

Change the two imports from `./startup`:

```ts
import { closeRuntime, ensureRuntimeReady, startRuntime } from './startup';
```

```ts
import type { CloseOptions, EnsureServicesReadyOptions, StartupOptions } from './startup';
```

Insert the method between `fork` and `close`. Use the class's own first type parameter where this code says `R`:

````ts
  /**
   * Make the listed services ready before continuing, then resolve to this same bag.
   * Each listed service is acquired now, with whatever its factory reads, and the call waits until it is ready;
   * every other service stays lazy. List the services whose readiness you need before the next line runs, such as
   * a database pool or a cache client. Works on a built bag, a child scope, and a fork, and may be called again.
   * A failed factory, an aborted signal, or an elapsed deadline closes this bag: a child scope closes only itself,
   * never its parent or a service it borrows.
   * @param serviceKeys - A finite tuple of existing names or typed tokens to wait for; an empty tuple is valid.
   * @param options - An optional abort signal, a deadline for the whole call, and a bound on how many listed keys are acquired at once.
   * @returns A promise for this bag once every listed service is ready.
   * @throws {@link DiBagServiceReadinessError} (`DI_BAG_SERVICE_READINESS_FAILED`) after this bag has closed because a factory failed;
   * {@link DiBagServiceReadinessCancelledError} (`DI_BAG_SERVICE_READINESS_CANCELLED`) promptly on abort or timeout, naming what was still pending;
   * `DI_BAG_INVALID_STARTUP` for malformed keys or options and `DI_BAG_INVALID_TOKEN` for a bad token, both before any factory runs and with this bag left open;
   * `DI_BAG_CLOSING` or `DI_BAG_CLOSED` after `close()`. Each arrives as a rejection.
   * @example
   * ```ts
   * const bag = await DiBag.createBuilder()
   *   .register({ db: async () => ({ ping: () => true }) })
   *   .build()
   *   .ensureServicesReady(['db'], { totalTimeoutMs: 5_000 });
   * ```
   */
  async ensureServicesReady<const K extends readonly unknown[]>(
    serviceKeys: K & Selection<R, K, 'ensureServicesReady'>,
    options?: EnsureServicesReadyOptions,
  ): Promise<this> {
    await ensureRuntimeReady(this.#runtime, this.#graph, serviceKeys, options);
    return this;
  }
````

`Promise<this>` and `Promise<Bag<R, C>>` were compared on a prototype: both type-check every fixture of Step 2 and differ by 28 instantiations out of 115,000. Keep `Promise<this>`.

- [ ] **Step 6: Export the options type from `src/index.ts`**

```ts
export type { CloseOptions, EnsureServicesReadyOptions, StartupOptions } from './startup';
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm run typecheck && bun test tests/ensure-services-ready.test.ts`
Expected: typecheck exits 0; `16 pass`, `0 fail`.

Run: `bun test tests/types.test.ts -t startup`
Expected: both startup tests pass.

Run: `bun test tests/startup.test.ts`
Expected: still passes; `buildAndStart` is untouched.

- [ ] **Step 8: Add the three sections to `docs/agent/errors.md`**

Insert them between the `DI_BAG_PLUGIN_VALIDATION` section and the `DI_BAG_STARTUP_CANCELLED` section. The code blocks are type-checked by `npm run docs:check`.

````md
### DI_BAG_SERVICE_READINESS_CANCELLED {#di-bag-service-readiness-cancelled}

**When:** `ensureServicesReady` rejects with `DiBagServiceReadinessCancelledError`,
`reason` `'aborted'` or `'timeout'`.

**Cause:** `abortSignal` aborted or `totalTimeoutMs` elapsed before the listed
services were ready. This bag is closing. `details.acquisitionsStillPending`
names the services that were not ready yet, `details.disposersStillRunning` the
disposers that had started.

**Fix:** await `disposalPromise` before exiting; fix or speed up the named
service, and make slow factories honor the acquisition `signal`.

```ts
import { DiBag, DiBagServiceReadinessCancelledError } from 'di-bag';

const bag = DiBag.createBuilder().register({ settings: async () => 'ready' }).build();
try {
  await bag.ensureServicesReady(['settings'], { totalTimeoutMs: 5_000 });
  await bag.close();
} catch (error) {
  if (error instanceof DiBagServiceReadinessCancelledError) {
    console.error(error.details.acquisitionsStillPending);
    await error.disposalPromise;
  }
  throw error;
}
```

**Recipe:** [add and consume an async client](recipes.md#async-client).

### DI_BAG_SERVICE_READINESS_FAILED {#di-bag-service-readiness-failed}

**When:** `ensureServicesReady` rejects with `DiBagServiceReadinessError` after
this bag has closed.

**Cause:** a listed service or one of its dependencies failed to acquire;
`cause` is that error and `disposalFailures` lists disposers that failed while
the bag closed. A child scope closes only itself, never its parent.

**Fix:** fix `cause`, then build a new bag, or create a new scope, and call
`ensureServicesReady` again.

```ts
import { DiBag, DiBagServiceReadinessError } from 'di-bag';

const bag = DiBag.createBuilder().register({ settings: async () => 'ready' }).build();
const app = await bag.ensureServicesReady(['settings']).catch((error: unknown) => {
  throw error instanceof DiBagServiceReadinessError ? error.cause : error;
});
await app.close();
```

**Recipe:** [add and consume an async client](recipes.md#async-client).

### DI_BAG_SERVICE_READINESS_TIMEOUT {#di-bag-service-readiness-timeout}

**When:** the `cause` of a
[`DI_BAG_SERVICE_READINESS_CANCELLED`](#di-bag-service-readiness-cancelled)
error with `reason: 'timeout'`: a `DOMException` named `TimeoutError`, with
`details.totalTimeoutMs`.

**Cause:** the listed services took longer than `totalTimeoutMs`, which covers
the whole call and not each service.

**Fix:** raise `totalTimeoutMs`, list fewer services, or make factories honor
the signal so they stop promptly.

**Recipe:** [add and consume an async client](recipes.md#async-client).
````

- [ ] **Step 9: Regenerate and check the docs**

Run: `npm run build && npm run docs:generate && npm run docs:check`
Expected: exits 0. If `docs:generate` reports that the API card is over its 400-line budget, shorten the `@example` of `ensureServicesReady` to one line; do not touch other examples.

- [ ] **Step 10: Commit**

```bash
git add -A src tests docs/agent docs/reference
git commit -F - <<'MSG'
feat: bag.ensureServicesReady makes listed services ready on any bag

It runs on a built bag, a child scope and a fork, resolves to the same bag,
and closes the bag it was called on when a factory fails, the signal aborts or
the deadline passes. A cancelled call names the services still pending.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```
