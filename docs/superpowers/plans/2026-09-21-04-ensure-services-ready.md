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
export PATH="<the directory that holds Bun 1.4.0>/bin:$PATH"
export npm_config_update_notifier=false
bun --version   # 1.4.0
```

## State on entry

Phases 0 to 2 are merged into `next`. Confirm each line with the command next to it before Task 1. If one differs, find the real name with `grep` and adjust only that reference.

| Expectation | Check |
| --- | --- |
| The naming guide and the naming ratchet test exist | `ls docs/guides/api-naming.md && ls tests | grep -i naming` |
| The codemod exists with a `buildAndStart` transform and a fixture for it | `ls tools/codemod/cli.mjs tools/codemod/rename-map.json && grep -rl buildAndStart tools/codemod` |
| Phase 2 renamed documented parameter names and `Bag` generics | `grep -n "factoryContext" src/acquisition-context.ts` prints matches; `grep -F "class Bag<ServiceRegistrations extends Registrations, Constraints extends NeedConstraint = never>" src/di-bag.ts` succeeds |
| `Builder.buildAndStart` exists and `Bag.ensureServicesReady` does not | `grep -n "buildAndStart\|ensureServicesReady" src/di-bag.ts` |
| The class is still `Bag` and the terminal is still `build()` | `grep -n "^class Bag\|  build(this" src/di-bag.ts` |

Phase 2 renamed the type parameters of `Bag` from `R` and `C` to `ServiceRegistrations` and `Constraints`. Confirm that `class Bag<ServiceRegistrations extends Registrations, Constraints extends NeedConstraint = never>` and `Selection<ServiceRegistrations, K, 'createScope'>` are present. Every method added to that class in this phase uses those exact class type-parameter names. Test files use the phase-2 callback spelling `factoryContext` when they name that parameter.

The phase has three green commit boundaries that differ from the one-heading-per-commit default. Task 1 atomically migrates repository readers and renames the returned close-progress fields, because adding both returned field sets would break exact-object assertions. Tasks 2 and 3 form one green expand commit: do not commit the error classes until the method and all three error sections exist. Tasks 5 and 6 form one green contract-and-docs commit: do not commit removed declarations while generated references or the naming ratchet still describe them. No commit in this phase is intentionally red.

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
| `tests/api-naming-known-violations.json` | Tasks 5–6 delete exactly the ten known violations whose public startup names disappear in the contract step |
| `tools/codemod/rename-map.json`, `tools/codemod/test/fixtures/…` | Map entries and a fixture for this phase |
| `docs/agent/errors.md`, `docs/agent/api-card.md` (generated), `docs/reference/` (generated), `tools/docs/api-card-tasks.json`, `tools/docs/test/exact-rendering.test.mjs`, `docs/guides/api-reference.md` (the close row in Task 1; three removed-name rows in Task 6) | Documentation that `npm run docs:check` verifies |
| `tools/graph/README.md`, `tools/graph/test/extract.test.mjs`, `tools/graph/test/fixtures/ready-chain.ts` | The graph tool keeps finding `build()` inside `build().ensureServicesReady()` |
| `scripts/verify-release-artifacts.ts` | Expected error class names in release evidence |
| `docs/superpowers/plans/evidence/phase-03.md` | Measurements |

The guides under `docs/guides/` and `README.md` are rewritten in phase 12. This phase touches `docs/guides/api-reference.md` only to keep its close-progress field names atomic with Task 1 and because three other rows link to reference pages that Tasks 5–6 delete; `npm run docs:check` rejects those dead links.

---

### Task 0: Branch and entry check

**Files:** none.

- [ ] **Step 1: Create the branch**

```bash
git switch next && git pull --ff-only 2>/dev/null; git switch -c phase-03-ensure-services-ready
```

- [ ] **Step 2: Run the checks of "State on entry"**

Run each command of the table. Expected: every expectation holds. Record the path of the naming test and of the phase-1 codemod fixture that mentions `buildAndStart`; later tasks need them. The `Bag` parameters are not adaptive: they must be `ServiceRegistrations` and `Constraints`.

- [ ] **Step 3: Build once, so that tests reading `dist/` start from a current build**

Run: `npm run build`
Expected: exits 0.

---

### Task 1: Rename the close options and the close progress fields

`close({ signal, timeoutMs })` becomes `close({ abortSignal, waitTimeoutMs })`. `CloseProgress.pending` and `.acquiring` become `disposersStillRunning` and `acquisitionsStillPending`, and so do the keys of `DiBagCloseCancelledError.details`. The `details.timeoutMs` key becomes `details.waitTimeoutMs`. The field `cleanupPromise` of that error stays until phase 11. Phase 1 already put these 0.4-to-0.5 entries in the shipped codemod map. A returned progress object cannot carry both enumerable field sets without breaking exact-object behavior, so this task migrates every repository reader and the declarations/producers/docs atomically in one green commit. Most caught errors are `any`, so the repository edits are done by hand and checked with searches as well as the compiler.

**Files:**
- Modify: `src/errors.ts` (the `CloseProgress` interface and the `DiBagCloseCancelledError` class, at the end of the file)
- Modify: `src/runtime.ts` (`closeProgress`)
- Modify: `src/startup.ts` (`CloseOptions`, `snapshotOptions`, `closeRuntime`)
- Modify: `src/di-bag.ts` (JSDoc of `Bag.close`)
- Modify: `tests/runtime-diagnostics.test.ts`, `tests/acquisition-cleanup.test.ts`, `tests/types/startup.ts`, `tests/types/negative/startup.ts`
- Modify: `docs/agent/errors.md` (sections `DI_BAG_CLOSE_ABORTED`, `DI_BAG_CLOSE_TIMEOUT`, `DI_BAG_INVALID_CLOSE`)
- Modify: `docs/guides/api-reference.md` (the `DiBagCloseCancelledError` row only)

**Interfaces:**
- Produces: `CloseOptions { readonly abortSignal?: AbortSignal; readonly waitTimeoutMs?: number }`; `CloseProgress { readonly disposersStillRunning: readonly string[]; readonly acquisitionsStillPending: readonly string[] }`; `BagRuntime.closeProgress()` returns that shape; `snapshotOptions(options, operation, code, supported, timeoutKey, signalKey)`.

- [ ] **Step 0: Inventory every repository consumer before the atomic rename**

```bash
grep -rnE "close\(\{ ?(timeoutMs|signal)|details\.(pending|acquiring)|CloseProgress|CloseOptions" src tests examples scripts docs/agent AGENTS.md
```

Read every hit. The edits below name the phase-entry hits; if phases 1 or 2 added another real close option or progress reader, migrate it in this task. Do not change acquisition-context `signal`, startup options, local variables that merely share a word, or codemod 0.4 input fixtures.

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

- [ ] **Step 8a: Update the close row in `docs/guides/api-reference.md`**

Replace only the `DiBagCloseCancelledError` row with:

```md
| [`DiBagCloseCancelledError`](../reference/index/classes/DiBagCloseCancelledError.md) | `close({ waitTimeoutMs, abortSignal })` stops waiting before cleanup finishes. | `code` is `DI_BAG_CLOSE_TIMEOUT` or `DI_BAG_CLOSE_ABORTED`; `details.disposersStillRunning` lists unfinished disposer labels and `details.acquisitionsStillPending` pending acquisitions; `cleanupPromise` settles when cleanup finishes. |
```

The class and `cleanupPromise` keep their current names in this phase. Do not edit another guide row here.

- [ ] **Step 9: Regenerate and check the docs**

Run: `npm run build && npm run docs:generate && npm run docs:check`
Expected: the last line reads `Prepared … Markdown pages; repository-only links point to GitHub.` and the command exits 0.

- [ ] **Step 9a: Prove that the atomic rename covered every repository consumer**

```bash
if grep -rnE "close\(\{ ?(timeoutMs|signal)|details\.(pending|acquiring)" src tests examples scripts docs/agent AGENTS.md | grep -v '^tests/types/negative/startup.ts:'; then exit 1; fi
grep -nE "closable\.close\(\{ (timeoutMs|signal)" tests/types/negative/startup.ts
```

Expected: the first command prints nothing; the second prints exactly the two compile-time rejection cases for the old close keys. Then run `git diff --check`. Other old spellings remain only in the phase-1 codemod's 0.4 input/map.

- [ ] **Step 10: Commit**

```bash
git add -A src tests docs/agent docs/reference docs/guides/api-reference.md
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

### Task 2: Add the service readiness error classes (first half of the green expand)

Two new classes go next to the startup ones. Nothing throws them until Task 3, and their checked documentation examples need the new method. Complete the steps here, keep the changes uncommitted, and continue directly into Task 3. Tasks 2 and 3 are reviewed and committed as one green expand unit.

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

- [ ] **Step 6: Keep the tested changes uncommitted and continue to Task 3**

Run `git diff --check`, then continue immediately. Do not run `docs:check` or commit yet: Task 3 adds the public method, timeout code and all three errors-page sections, after which the combined expand boundary is green. This is not an intentionally red commit.

---

### Task 3: Add `Bag.ensureServicesReady` and commit the green expand

**Files:**
- Modify: `src/startup.ts`, `src/di-bag.ts`, `src/index.ts`
- Modify: `tests/types/startup.ts`, `tests/types/negative/startup.ts`
- Modify: `docs/agent/errors.md`
- Test: `tests/ensure-services-ready.test.ts`

**Interfaces:**
- Consumes: `BagRuntime.assertOpen()`, `BagRuntime.acquire(key): Promise<void>`, `BagRuntime.close(cause?): Promise<void>`, `BagRuntime.closeProgress()` from `src/runtime.ts`; `BindingGraph.hasPublic(key)`; `readTokenKey` from `src/tokens.ts`; the two classes of Task 2; `snapshotOptions` with the six parameters of Task 1; the private fields `#runtime` and `#graph` of `Bag`.
- Produces: `export interface EnsureServicesReadyOptions { readonly abortSignal?: AbortSignal; readonly totalTimeoutMs?: number; readonly maxConcurrentServiceKeys?: number }`; `export function ensureRuntimeReady(runtime: BagRuntime, graph: BindingGraph, keys: readonly unknown[], options?: EnsureServicesReadyOptions): Promise<void>`; `Bag.prototype.ensureServicesReady<const K extends readonly unknown[]>(serviceKeys: K & Selection<ServiceRegistrations, K, 'ensureServicesReady'>, options?: EnsureServicesReadyOptions): Promise<this>`.

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

Insert the method between `fork` and `close`. Phase 2 named the class's first type parameter `ServiceRegistrations`; use that exact name:

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
    serviceKeys: K & Selection<ServiceRegistrations, K, 'ensureServicesReady'>,
    options?: EnsureServicesReadyOptions,
  ): Promise<this> {
    await ensureRuntimeReady(this.#runtime, this.#graph, serviceKeys, options);
    return this;
  }
````

`Promise<this>` and `Promise<Bag<ServiceRegistrations, Constraints>>` were compared on a prototype: both type-check every fixture of Step 2 and differ by 28 instantiations out of 115,000. Keep `Promise<this>`.

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

- [ ] **Step 10: Commit Tasks 2 and 3 as one green expand**

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

---

### Task 4: Migrate every call site

The old API still exists, so the codemod can resolve it. First verify the phase-1 codemod already knows this phase, then it rewrites the typed call sites, then the rest is done by hand. About 80 `buildAndStart` calls live in `tests/`, `examples/` and `tools/`; the guides are not touched.

**Files:**
- Verify: `tools/codemod/rename-map.json`, `tools/codemod/rename-map.schema.json`, `tools/codemod/lib/rename-map.mjs`, `tools/codemod/lib/rewrite.mjs`, `tools/codemod/lib/transforms/build-and-start.mjs`
- Verify without editing: the two lexical controls in `tests/api-naming.test.ts`, the still-live rows in `tests/api-naming-known-violations.json`, and the two statements in `tests/types/negative/startup.ts` that deliberately reject `close({ timeoutMs })` and `close({ signal })`. The inclusive dry run may propose rewriting those two close controls, but the mechanical write omits that file and proves its bytes remain unchanged; preserve the rest of the fixture unless an actual hand migration requires an edit
- Create: one fixture pair under `tools/codemod/test/fixtures/`
- Modify: `tests/startup.test.ts`, `tests/startup-runtime-fixture.ts`, `tests/final-adversarial-runtime-fixture.ts`, `tests/runtime-diagnostics.test.ts`, `tests/acquisition-cleanup.test.ts`, `tests/acquisition-mode.test.ts`, `tests/aliases.test.ts`, `tests/contributions.test.ts`, `tests/enterprise-integration.test.ts`, `tests/nested-modules.test.ts`, `tests/observers.test.ts`, `tests/plugins.test.ts`, `tests/react/runtime-owner.test.ts`, `tests/react/project-runtime.test.ts`, `tests/acquisition-retention.node.mjs`, `tests/runtime-scale.node.mjs`
- Modify: `examples/scopes.ts`, `examples/react/app-runtime.ts`, `examples/react/project-runtime.ts`, `examples/react/runtime-owner.ts`, `examples/react/bootstrap.tsx`, `examples/react/app.tsx`
- Modify: `scripts/verify-release-artifacts.ts`

**Interfaces:**
- Consumes: the codemod CLI and map of the master plan, "The codemod contract"; `Bag.ensureServicesReady` of Task 3.
- Produces: migrated repository consumer call sites. Until the green Tasks 5–6 contract, the old declarations and error sections remain in `src/` and `docs/agent/errors.md`; codemod map/input fixtures, graph legacy compatibility, guides owned by phase 12, and explicit old-name rejection cases also retain old spellings. The dry run covers every negative fixture; the mechanical write excludes only `tests/types/negative/startup.ts` so its two deliberate rejected old-close controls remain byte-identical. Every manual item in both codemod reports is either migrated in a named hand commit or explicitly accounted for before contract.

The rules, for the codemod and for your hands alike:

| 0.4.0 | 0.5.0 |
| --- | --- |
| `x.buildAndStart(keys)` | `x.build().ensureServicesReady(keys)`, where the emitted `build` comes from `api.nameOf('Builder', 'build')` |
| `x.buildAndStart(keys, options)` | `x.build().ensureServicesReady(keys, options)` with the option rows below |
| option `signal: s`, or shorthand `signal` | `abortSignal: s`, `abortSignal: signal` |
| option `timeoutMs: n` | `totalTimeoutMs: n` |
| option `startupOrder: 'parallel'` | removed. When the bag literal becomes empty, the whole second argument is removed |
| option `startupOrder: 'sequential'` | `maxConcurrentServiceKeys: 1` |
| option `startupOrder: <number literal>` | `maxConcurrentServiceKeys: <the same number>` |
| option `startupOrder: <any other expression>` | leave the whole `buildAndStart` call unchanged and report: `startupOrder is not a literal; use maxConcurrentServiceKeys: omit it for 'parallel', 1 for 'sequential', or the number` |
| options passed as an identifier typed `StartupOptions` | passed through unchanged, plus a manual item: "rename the properties where this object is built" |
| `bag.close({ signal, timeoutMs })` | `bag.close({ abortSignal: signal, waitTimeoutMs: … })` |
| type `StartupOptions` | `EnsureServicesReadyOptions` |
| `DiBagStartupError` | `DiBagServiceReadinessError` |
| `DiBagStartupCancelledError` | `DiBagServiceReadinessCancelledError` |
| property `cleanupFailures` of `DiBagStartupError` | `disposalFailures` |
| property `cleanupError` of `DiBagStartupError` | `disposalError` |
| property `cleanupPromise` of `DiBagStartupCancelledError` | `disposalPromise` |
| property `cleanupPromise` of `DiBagCloseCancelledError` | unchanged in this phase |
| property `pending` of `CloseProgress` | `disposersStillRunning` |
| property `acquiring` of `CloseProgress` | `acquisitionsStillPending` |
| `'DI_BAG_STARTUP_FAILED'`, `'DI_BAG_STARTUP_CANCELLED'`, `'DI_BAG_STARTUP_TIMEOUT'` | `'DI_BAG_SERVICE_READINESS_FAILED'`, `'DI_BAG_SERVICE_READINESS_CANCELLED'`, `'DI_BAG_SERVICE_READINESS_TIMEOUT'` |

- [ ] **Step 1: Verify the complete phase-1 map and role mechanism**

Phase 1 owns and has already landed the schema, validator, rewrite engine, build transform, and
complete phase-3 map entry. Verify that the map equals the complete content below; do not append a
duplicate and do not remove `$schema`, `to`, `argument`, or `transformNames`. Verify that the
phase-1 implementation still has closed method-entry validation, includes `transformNames` in
effective-method conflict comparison, binds the selected entry into `nameForRole(role)`, resolves
`StartupOptions.signal` and `.timeoutMs` through `api.nameOf`, and resolves the concurrency field
through `api.nameForRole('concurrency')`. Preserve that implementation unchanged. Any semantic
difference is an entry-check failure to report before continuing.

```json
{
  "$schema": "./rename-map.schema.json",
  "version": 1,
  "methods": [
    { "owner": "Builder", "from": "buildAndStart", "to": "ensureServicesReady", "transform": "build-and-start", "transformNames": { "concurrency": "maxConcurrentServiceKeys" } }
  ],
  "options": [
    { "owner": "Bag", "method": "close", "argument": 0, "from": "signal", "to": "abortSignal" },
    { "owner": "Bag", "method": "close", "argument": 0, "from": "timeoutMs", "to": "waitTimeoutMs" }
  ],
  "properties": [
    { "owner": "CloseOptions", "from": "signal", "to": "abortSignal" },
    { "owner": "CloseOptions", "from": "timeoutMs", "to": "waitTimeoutMs" },
    { "owner": "StartupOptions", "from": "signal", "to": "abortSignal" },
    { "owner": "StartupOptions", "from": "timeoutMs", "to": "totalTimeoutMs" },
    { "owner": "StartupOptions", "from": "startupOrder", "manual": "startupOrder is gone; use maxConcurrentServiceKeys: omit it for 'parallel', 1 for 'sequential', or the number" },
    { "owner": "DiBagStartupError", "from": "cleanupFailures", "to": "disposalFailures" },
    { "owner": "DiBagStartupError", "from": "cleanupError", "to": "disposalError" },
    { "owner": "DiBagStartupCancelledError", "from": "cleanupPromise", "to": "disposalPromise" },
    { "owner": "DiBagCloseCancelledError", "from": "timeoutMs", "to": "waitTimeoutMs" },
    { "owner": "CloseProgress", "from": "pending", "to": "disposersStillRunning" },
    { "owner": "CloseProgress", "from": "acquiring", "to": "acquisitionsStillPending" }
  ],
  "types": [
    { "from": "StartupOptions", "to": "EnsureServicesReadyOptions" },
    { "from": "DiBagStartupError", "to": "DiBagServiceReadinessError" },
    { "from": "DiBagStartupCancelledError", "to": "DiBagServiceReadinessCancelledError" }
  ],
  "codes": [
    { "from": "DI_BAG_STARTUP_FAILED", "to": "DI_BAG_SERVICE_READINESS_FAILED" },
    { "from": "DI_BAG_STARTUP_CANCELLED", "to": "DI_BAG_SERVICE_READINESS_CANCELLED" },
    { "from": "DI_BAG_STARTUP_TIMEOUT", "to": "DI_BAG_SERVICE_READINESS_TIMEOUT" }
  ]
}
```

`StartupOptions.startupOrder` has a manual property entry because a standalone typed object cannot be rewritten safely without its value. The `concurrency` role is transform-local metadata, not a declaration owner: `signal` and `timeoutMs` already have real `StartupOptions` property entries, while `startupOrder` has no one-to-one target. The build transform handles literal values inside a call, shorthand `signal`, and an emptied bag literal. It intentionally leaves the whole call unchanged for a nonliteral `startupOrder` and emits the manual item above. Do not broaden that behavior in this phase.

The phase-1 role mechanism is generic transform metadata, not a declaration namespace. This phase only verifies and consumes it; it does not edit the schema, validator, typedef, conflict comparison, transform API, or build transform.

- [ ] **Step 2: Add a fixture that pins this phase**

Create a fixture pair in the layout the existing fixtures use (look at the directory that `grep -rl buildAndStart tools/codemod/test/fixtures` prints). Name it `ensure-services-ready`. The input is 0.4.0 code and is checked against the 0.4.0 declarations that phase 1 vendored:

```ts
import { DiBag, DiBagCloseCancelledError, DiBagStartupCancelledError, DiBagStartupError, type StartupOptions } from 'di-bag';

const builder = DiBag.createBuilder().register({ db: async () => 1, cache: () => 2 });

export async function main(signal: AbortSignal, options: StartupOptions, bound: number) {
  const plain = await builder.buildAndStart(['db']);
  const all = await builder.buildAndStart(['db', 'cache'], { signal, timeoutMs: 5_000, startupOrder: 'sequential' });
  const parallel = await builder.buildAndStart(['db'], { startupOrder: 'parallel' });
  const four = await builder.buildAndStart(['db'], { startupOrder: 4, signal: signal });
  const computed = await builder.buildAndStart(['db'], { startupOrder: bound });
  const passed = await builder.buildAndStart(['db'], options);
  await plain.close({ timeoutMs: 1_000, signal });
  try {
    await builder.buildAndStart(['db']);
  } catch (error) {
    if (error instanceof DiBagStartupError) console.error(error.code === 'DI_BAG_STARTUP_FAILED', error.cleanupFailures, error.cleanupError);
    if (error instanceof DiBagStartupCancelledError) await error.cleanupPromise;
    if (error instanceof DiBagCloseCancelledError) console.error(error.details.pending, error.details.acquiring, error.cleanupPromise);
  }
  return [all, parallel, four, computed, passed];
}
```

The expected output. Its `build` is whatever `api.nameOf('Builder', 'build')` answers, which is `build` until phase 5 changes the map and this file with it:

```ts
import { DiBag, DiBagCloseCancelledError, DiBagServiceReadinessCancelledError, DiBagServiceReadinessError, type EnsureServicesReadyOptions } from 'di-bag';

const builder = DiBag.createBuilder().register({ db: async () => 1, cache: () => 2 });

export async function main(signal: AbortSignal, options: EnsureServicesReadyOptions, bound: number) {
  const plain = await builder.build().ensureServicesReady(['db']);
  const all = await builder.build().ensureServicesReady(['db', 'cache'], { abortSignal: signal, totalTimeoutMs: 5_000, maxConcurrentServiceKeys: 1 });
  const parallel = await builder.build().ensureServicesReady(['db']);
  const four = await builder.build().ensureServicesReady(['db'], { maxConcurrentServiceKeys: 4, abortSignal: signal });
  const computed = await builder.buildAndStart(['db'], { startupOrder: bound });
  const passed = await builder.build().ensureServicesReady(['db'], options);
  await plain.close({ waitTimeoutMs: 1_000, abortSignal: signal });
  try {
    await builder.build().ensureServicesReady(['db']);
  } catch (error) {
    if (error instanceof DiBagServiceReadinessError) console.error(error.code === 'DI_BAG_SERVICE_READINESS_FAILED', error.disposalFailures, error.disposalError);
    if (error instanceof DiBagServiceReadinessCancelledError) await error.disposalPromise;
    if (error instanceof DiBagCloseCancelledError) console.error(error.details.disposersStillRunning, error.details.acquisitionsStillPending, error.cleanupPromise);
  }
  return [all, parallel, four, computed, passed];
}
```

Create `expected-manual.json` with the exact two manual items. These line numbers are for the input above:

```json
[
  {
    "line": 10,
    "reason": "startupOrder is not a literal; use maxConcurrentServiceKeys: omit it for 'parallel', 1 for 'sequential', or the number"
  },
  {
    "line": 11,
    "reason": "these options are not an object literal; where they are built, rename signal to abortSignal, timeoutMs to totalTimeoutMs, and replace startupOrder with maxConcurrentServiceKeys"
  }
]
```

Run:

```bash
node --test tools/codemod/test/fixtures.test.mjs tools/codemod/test/transforms.test.mjs
npm run codemod:check
```

Expected: the new fixture and all phase-1 fixtures pass; the transform tests still prove that emitted method names come from `api.nameOf`; `codemod:check` exits 0. If the fixture fails because the phase-1 transform behaves differently, stop and compare the landed phase-1 repair with its plan. Do not weaken the nonliteral fallback.

- [ ] **Step 3: Dry-run the codemod, resolve preconditions, then make the separate mechanical commit**

Keep the dry run inclusive so it measures every compiler-negative fixture, including `tests/types/negative/startup.ts`:

```bash
npm run build
node tools/codemod/cli.mjs --project tsconfig.json --library-root src --library-root dist --extra-files 'tests/types/negative/*.ts' --report /tmp/phase-03-codemod-dry-run-report.json
node - <<'JS'
const report = require('/tmp/phase-03-codemod-dry-run-report.json');
const skipped = report.manual.filter(item => item.reason.startsWith('this file was left untouched'));
const startup = report.files.filter(item => item.file === 'tests/types/negative/startup.ts');
console.log({ files: report.files.length, rewrites: report.files.reduce((sum, item) => sum + item.rewrites, 0), manual: report.manual.length, skipped: skipped.length, startup });
if (report.written !== false || skipped.length !== 0 || startup.length !== 1 || startup[0].rewrites !== 5) process.exit(1);
JS
```

Expected: a summary that lists rewrites in `tests/` and `examples/`, and nothing in `src/`; the report says `written: false`, `skipped: 0`, and exactly five internal rewrites for `tests/types/negative/startup.ts`. The exact-text proof below establishes that those five edits affect only the two source lines containing the deliberate rejected `close({ timeoutMs })` and `close({ signal })` controls. Read every JSON manual item; those two lines are accepted dry-run findings rather than migration input.

Prove the proposed diff for that fixture is exactly those two controls, and snapshot its original bytes for the later omitted-file check:

```bash
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { loadTypeScript, runCodemod } from './tools/codemod/lib/codemod.mjs';
const root = process.cwd();
const file = 'tests/types/negative/startup.ts';
const before = readFileSync(file, 'utf8');
const replacements = [
  ['closable.close({ timeoutMs: 1 });', 'closable.close({ waitTimeoutMs: 1 });'],
  ['closable.close({ signal: new AbortController().signal });', 'closable.close({ abortSignal: new AbortController().signal });'],
];
let expected = before;
for (const [from, to] of replacements) {
  assert.equal(expected.split(from).length - 1, 1, `expected one control: ${from}`);
  expected = expected.replace(from, to);
}
const compiler = loadTypeScript(root);
const result = runCodemod({
  typescript: compiler.ts,
  root,
  project: 'tsconfig.json',
  extraFiles: ['tests/types/negative/*.ts'],
  libraryRoots: ['src', 'dist'],
  only: [file],
});
assert.equal(result.files.length, 1);
assert.equal(result.files[0].file, file);
assert.equal(result.files[0].rewrites, 5);
assert.equal(result.files[0].text, expected);
assert.equal(result.manual.filter(item => item.reason.startsWith('this file was left untouched')).length, 0);
writeFileSync('/tmp/phase-03-negative-startup-before.ts', before);
console.log('negative startup dry-run diff: exactly two accepted close controls; original bytes saved');
JS
```

The master requires the codemod's mechanical rewrite to remain a separate commit. If inspection shows that a manual case would make the mechanical result fail typecheck, the codemod tests, or the affected runtime tests, migrate that coherent manual case first while both APIs exist, then run and commit exactly this prior preparation:

```bash
npm run typecheck
npm run codemod:check
bun test tests/startup.test.ts tests/runtime-diagnostics.test.ts tests/acquisition-cleanup.test.ts tests/react/runtime-owner.test.ts tests/react/project-runtime.test.ts
git diff --check
git add -A tests examples scripts
git commit -F - <<'MSG'
refactor: prepare manual readiness migrations

Resolve codemod manual items that would otherwise leave the following separate
mechanical rewrite unable to pass its type and affected-runtime checks.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

After any such preparation commit, rebuild and repeat the inclusive dry run, its report assertion, and the exact startup-fixture preview/snapshot above. Do not stage `tools/codemod` in this prior commit, fold hand edits into the mechanical commit, declare a red exception, or change the map or engine. If the report's manual cases leave the mechanical tree green, omit this optional preparation commit and handle them in Steps 4–5.

For the write, retain `--project` and both library roots but omit exactly `tests/types/negative/startup.ts`. Generate and save the explicit sorted inventory of every other negative TypeScript fixture, prove that no other fixture is omitted, and build one argument per saved path:

```bash
rg --files tests/types/negative -g '*.ts' | LC_ALL=C sort > /tmp/phase-03-all-negative-files.txt
grep -vxF 'tests/types/negative/startup.ts' /tmp/phase-03-all-negative-files.txt > /tmp/phase-03-codemod-write-negative-files.txt
python3 - <<'PY'
from pathlib import Path
all_files = Path('/tmp/phase-03-all-negative-files.txt').read_text().splitlines()
write_files = Path('/tmp/phase-03-codemod-write-negative-files.txt').read_text().splitlines()
assert all_files == sorted(set(all_files)), 'full negative-fixture inventory is not sorted and unique'
assert write_files == sorted(set(write_files)), 'write inventory is not sorted and unique'
assert [item for item in all_files if item not in write_files] == ['tests/types/negative/startup.ts']
assert write_files == [item for item in all_files if item != 'tests/types/negative/startup.ts']
print(f'write inventory: {len(write_files)} sorted unique negative fixtures; only startup.ts omitted')
PY
mapfile -t negative_extra_files < /tmp/phase-03-codemod-write-negative-files.txt
negative_extra_args=()
for file in "${negative_extra_files[@]}"; do negative_extra_args+=(--extra-files "$file"); done
write_command=(node tools/codemod/cli.mjs --project tsconfig.json --library-root src --library-root dist "${negative_extra_args[@]}" --write --report /tmp/phase-03-codemod-write-report.json)
printf '%q ' "${write_command[@]}" > /tmp/phase-03-codemod-write-command.sh
printf '\n' >> /tmp/phase-03-codemod-write-command.sh
"${write_command[@]}"
node - <<'JS'
const report = require('/tmp/phase-03-codemod-write-report.json');
const skipped = report.manual.filter(item => item.reason.startsWith('this file was left untouched'));
const startup = report.files.filter(item => item.file === 'tests/types/negative/startup.ts');
console.log({ files: report.files.length, rewrites: report.files.reduce((sum, item) => sum + item.rewrites, 0), manual: report.manual.length, skipped: skipped.length, startup: startup.length });
if (report.written !== true || skipped.length !== 0 || startup.length !== 0) process.exit(1);
JS
cmp --silent tests/types/negative/startup.ts /tmp/phase-03-negative-startup-before.ts
bun test tests/types.test.ts -t startup
npm run typecheck
npm run codemod:check
bun test tests/startup.test.ts tests/runtime-diagnostics.test.ts tests/acquisition-cleanup.test.ts tests/react/runtime-owner.test.ts tests/react/project-runtime.test.ts
git diff --check
```

Expected: the inventory comparison proves that the write includes every current negative `.ts` fixture except exactly `tests/types/negative/startup.ts`. The write report says `written: true`, `skipped: 0`, and contains no entry for that omitted file. The byte comparison proves the whole startup fixture, including its two deliberate rejected old-close controls, is unchanged; the focused startup compiler check and every remaining command exit 0. There is no restoration step. Inspect every manual item and changed file again. If a manual case was harmless because the old API still exists, leave it for Steps 4–5; if it caused a failure, preserve unrelated work, make the prior coherent manual commit described above, and rerun this whole step from the inclusive dry run. In `task-4-report.md`, record the exact inclusive dry-run command, the saved exact write command and explicit inventory, each report's totals and `skipped: 0`, the five-rewrite/two-control preview result, and the omitted-file byte proof.

Only after the actual mechanical tree is green:

```bash
git add -A tests examples tools/codemod
printf '%s\n' \
  'refactor: move call sites to ensureServicesReady with the codemod' \
  '' \
  'Exact producing command:' > /tmp/phase-03-codemod-commit-message.txt
cat /tmp/phase-03-codemod-write-command.sh >> /tmp/phase-03-codemod-commit-message.txt
printf '%s\n' '' 'Explicit sorted --extra-files inventory:' >> /tmp/phase-03-codemod-commit-message.txt
cat /tmp/phase-03-codemod-write-negative-files.txt >> /tmp/phase-03-codemod-commit-message.txt
printf '%s\n' \
  '' \
  'The inclusive dry run covered startup.ts; the write omitted exactly that' \
  'deliberate rejected-old-close fixture and preserved its bytes.' \
  '' \
  'Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>' \
  'Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL' \
  >> /tmp/phase-03-codemod-commit-message.txt
git commit -F /tmp/phase-03-codemod-commit-message.txt
```

If the codemod changed `tests/types/startup.ts` or `tests/ensure-services-ready.test.ts`, check with `git diff HEAD~1 -- <file>` that Tasks 1–3 content is intact. The write must not change `tests/types/negative/startup.ts`; the byte proof above is authoritative.

- [ ] **Step 4: Finish `tests/startup.test.ts` by hand**

Most values in this file are `any`, so check every rule of the table with `grep`, not with the compiler. Apply these exact rewrites where the codemod left the old text:

| Find | Replace with |
| --- | --- |
| `.buildAndStart(` | `.build().ensureServicesReady(` |
| `DiBagStartupCancelledError`, `DiBagStartupError` | `DiBagServiceReadinessCancelledError`, `DiBagServiceReadinessError` |
| `.cleanupPromise`, `.cleanupFailures` | `.disposalPromise`, `.disposalFailures`. Every error in this file is a readiness error |
| `{ startupOrder: 'sequential' }`, `{ startupOrder: 1 }` | `{ maxConcurrentServiceKeys: 1 }` |
| `{ startupOrder }` | `{ maxConcurrentServiceKeys: startupOrder }`. The loop variable keeps its name |
| `{ startupOrder: Number.MAX_SAFE_INTEGER }` | `{ maxConcurrentServiceKeys: Number.MAX_SAFE_INTEGER }` |
| `startupOrder: 2, signal: abort.signal` | `maxConcurrentServiceKeys: 2, abortSignal: abort.signal` |
| `{ timeoutMs: 5 }`, `{ timeoutMs: 30 }` | `{ totalTimeoutMs: 5 }`, `{ totalTimeoutMs: 30 }` |
| `{ signal: controller.signal, timeoutMs: outcome === 'timeout' ? 5 : 10000 }` | `{ abortSignal: controller.signal, totalTimeoutMs: outcome === 'timeout' ? 5 : 10000 }` |
| `{ signal: abort.signal }`, `{ signal: controller.signal }` | `{ abortSignal: abort.signal }`, `{ abortSignal: controller.signal }` |
| `{ signal: controller.signal, timeoutMs: 2 ** 32 }` | `{ abortSignal: controller.signal, totalTimeoutMs: 2 ** 32 }` |

Do not touch `factoryCtx.signal` or `context.signal`: that is the acquisition context, which phase 8 renames.

Four tests need hand-written code. In `startup snapshots option getters once after snapshotting all selected keys`, the getter becomes:

```ts
  }).build().ensureServicesReady(keys, { get maxConcurrentServiceKeys() {
    reads++;
    Reflect.set(keys, 0, 'second');
    return 1;
  } });
```

In `numeric startup ${startupOrder} snapshots options and retains duplicate selected lifetimes`, the getter becomes `{ get maxConcurrentServiceKeys() { reads++; return startupOrder; } }`.

In `numeric startup rejects invalid bounds before factories`, the expected message becomes:

```ts
    await expect(builder.build().ensureServicesReady(['value'], { maxConcurrentServiceKeys: startupOrder })).rejects.toThrow('ensureServicesReady maxConcurrentServiceKeys must be a positive safe integer');
```

In `invalid startup inputs reject before factory or unsupported option getter effects`, replace the body down to `expect(effects).toBe(0);` with:

```ts
  let effects = 0;
  const bag = DiBag.createBuilder().register({ value: () => ++effects }).build();
  const start = bag.ensureServicesReady.bind(bag) as (...args: unknown[]) => Promise<unknown>;
  for (const options of [null, [], true, { totalTimeoutMs: 0 }, { totalTimeoutMs: -1 }, { totalTimeoutMs: Infinity }, { totalTimeoutMs: NaN }, { totalTimeoutMs: '1' }, { maxConcurrentServiceKeys: 'serial' }, { abortSignal: {} }, { timeoutMs: 1 }, { startupOrder: 'sequential' }, { other: true, get totalTimeoutMs() { effects++; return 1; } }, Object.create({ totalTimeoutMs: 1 })]) {
    await expect(start(['value'], options)).rejects.toThrow(/ensureServicesReady/);
  }
  for (const keys of [undefined, 'value', [null], ['missing'], [{ key: Symbol('fake') }]]) {
    await expect(start(keys)).rejects.toThrow();
  }
  expect(effects).toBe(0);
  await bag.close();
```

Run: `bun test tests/startup.test.ts`
Expected: `33 pass`, `0 fail`. This exact migration was run against a prototype of Task 3 and passed.

- [ ] **Step 5: Migrate the string and JavaScript fixtures by hand**

The codemod cannot read these: the code is inside a template string, or the file is `.mjs`, or the API is typed `any`.

`tests/startup-runtime-fixture.ts` (one template string). Apply the table of Step 4, and also: `{ startupOrder: 'sequential' }` becomes `{ maxConcurrentServiceKeys: 1 }`; `{ signal: controller.signal }` becomes `{ abortSignal: controller.signal }`; `{ timeoutMs: 5 }` becomes `{ totalTimeoutMs: 5 }`; both `{ startupOrder }` become `{ maxConcurrentServiceKeys: startupOrder }`; `failed.cleanupFailures[0].error` becomes `failed.disposalFailures[0].error`; `cancelled.cleanupPromise` becomes `cancelled.disposalPromise`; the last loop's assertion becomes:

```js
    await assert.rejects(boundedBuilder.build().ensureServicesReady(['item'], { maxConcurrentServiceKeys: startupOrder }), /ensureServicesReady maxConcurrentServiceKeys must be a positive safe integer/);
```

Keep `context.signal` and `childContext.signal`.

`tests/final-adversarial-runtime-fixture.ts` and `scripts/verify-release-artifacts.ts`. In both files replace every `DiBagStartupCancelledError` with `DiBagServiceReadinessCancelledError` and every `DiBagStartupError` with `DiBagServiceReadinessError`: identifiers, the literal types of the expected-evidence table, its values, and the two generated `require` and `import` lines near the end of the fixture. Keep the evidence keys `startupWrapper`, `startupCauseIdentity`, `startupDispose`, `ordinaryCleanupFailures`: they are this repo's own record names. In the fixture also: five `.buildAndStart(` become `.build().ensureServicesReady(`; `{ startupOrder: 'sequential' }` becomes `{ maxConcurrentServiceKeys: 1 }`; `{ signal: i12Abort.signal }` becomes `{ abortSignal: i12Abort.signal }`; `{ timeoutMs: 5 }` becomes `{ totalTimeoutMs: 5 }`; both `.cleanupPromise` become `.disposalPromise`; both `.cleanupFailures` become `.disposalFailures`.

`tests/runtime-diagnostics.test.ts`, first test. Replace the four lines that start at `const startup = await` with:

```ts
  const readiness = await DiBag.createBuilder().register({ slow: () => new Promise(() => {}) }).build().ensureServicesReady(['slow'], { totalTimeoutMs: 1 }).catch(error => error);
  expect(readiness).toBeInstanceOf(DiBagServiceReadinessCancelledError);
  expect(readiness.message).toBe(`DI_BAG_SERVICE_READINESS_CANCELLED: The listed services were not ready: the wait timed out after 1ms; acquisitions still pending: slow; this bag is closing; see ${page}#di-bag-service-readiness-cancelled`);
  expect(readiness.cause.message).toBe(`DI_BAG_SERVICE_READINESS_TIMEOUT: The listed services were not ready before the deadline; see ${page}#di-bag-service-readiness-timeout`);
```

and import `DiBagServiceReadinessCancelledError` instead of `DiBagStartupCancelledError`.

`tests/acquisition-retention.node.mjs`: line 39 becomes `await builder.build().ensureServicesReady(['copy'])`; near line 289, `slowBuilder().buildAndStart(['value'], { timeoutMs: 1 })` becomes `slowBuilder().build().ensureServicesReady(['value'], { totalTimeoutMs: 1 })`, the expected name becomes `'DiBagServiceReadinessCancelledError'`, and `failure.cleanupPromise` becomes `failure.disposalPromise`.

`tests/runtime-scale.node.mjs`: both `.buildAndStart(keys, { startupOrder })` become `.build().ensureServicesReady(keys, { maxConcurrentServiceKeys: startupOrder })`.

`examples/react/runtime-owner.ts`: the two comments that name `buildAndStart` say `ensureServicesReady`; `DiBagStartupCancelledError` and its `cleanupPromise` follow the table. `examples/react/bootstrap.tsx`: `{ timeoutMs: 5_000 }` becomes `{ totalTimeoutMs: 5_000 }` and `{ signal, timeoutMs: 5_000 }` becomes `{ abortSignal: signal, totalTimeoutMs: 5_000 }`. In that example, `closeTimeoutMs` and the `timeoutMs` field of the `close-wait-expired` failure are the example's own names: leave them. `tests/react/project-runtime.test.ts`: `{ signal: controller.signal }` passed to `createProjectRuntime` becomes `{ abortSignal: controller.signal }`.

- [ ] **Step 6: Audit with `grep`**

```bash
rg -n "buildAndStart|StartupOptions|DiBagStartup|DI_BAG_STARTUP_" tests examples scripts tools/graph AGENTS.md docs/agent/recipes.md > /tmp/phase-03-retired-startup.txt
python3 - <<'PY'
from collections import Counter
from pathlib import Path
def normalized(line: str) -> tuple[str, str]:
    path, line_number, text = line.split(':', 2)
    assert line_number.isdigit()
    return path, text
actual = Counter(normalized(line) for line in Path('/tmp/phase-03-retired-startup.txt').read_text().splitlines())
expected = Counter({
    ("tests/api-naming.test.ts", "  expect(words('buildAndStart')).toEqual(['build', 'and', 'start']);"): 1,
    ("tests/api-naming.test.ts", "  expect(words('DiBagStartupCancelledError')).toEqual(['startup', 'cancelled', 'error']);"): 1,
    ('tests/api-naming-known-violations.json', '    "retired-word: code DI_BAG_STARTUP_CANCELLED",'): 1,
    ('tests/api-naming-known-violations.json', '    "retired-word: code DI_BAG_STARTUP_FAILED",'): 1,
    ('tests/api-naming-known-violations.json', '    "retired-word: code DI_BAG_STARTUP_TIMEOUT",'): 1,
    ('tests/api-naming-known-violations.json', '    "retired-word: export DiBagStartupCancelledError",'): 1,
    ('tests/api-naming-known-violations.json', '    "retired-word: export DiBagStartupError",'): 1,
    ('tests/api-naming-known-violations.json', '    "retired-word: export StartupOptions",'): 1,
    ('tests/api-naming-known-violations.json', '    "retired-word: member buildAndStart",'): 1,
    ('tools/graph/lib/extract.mjs', "const TERMINALS = new Set(['build', 'buildAndStart', 'buildModule']);"): 1,
    ('tools/graph/README.md', 'chain that ends in `build()`, `buildAndStart()`, or `buildModule()`, and reports'): 1,
    ('tools/graph/README.md', '- **unresolved**: a bag (`build()` or `buildAndStart()`) has a declared'): 1,
})
assert actual == expected, f'missing={sorted((expected - actual).elements())}; unexpected={sorted((actual - expected).elements())}'
PY
```

Expected: the exact assertion passes. The two naming-test rows are lexical scanner controls, the seven JSON rows are still-live known violations removed only by the combined Tasks 5–6 contract, and the three graph rows are deliberate compatibility/documentation: Task 6 retains `extract.mjs`'s `TERMINALS.buildAndStart` support for 0.4 input while updating the README wording. Any other row is an executable caller, generated source, assertion, or document that Task 4 missed. Do not edit any of the twelve controls to make this audit pass.

```bash
grep -rnE "startupOrder:" tests examples scripts
```

Expected: only the entries that prove the old option is now rejected: `{ startupOrder: 'sequential' }` in the invalid-option lists of `tests/ensure-services-ready.test.ts`, `tests/startup.test.ts` and `tests/runtime-diagnostics.test.ts`, plus the `ensureServicesReady` negative case in `tests/types/negative/startup.ts`. Loop variables named `startupOrder` may stay. The other deliberate old close-option negatives use `timeoutMs` and `signal` and are pinned by the final audit below.

```bash
grep -rnE "cleanupPromise|cleanupFailures|\.cleanupError" tests examples scripts
```

Expected: the JSON rows for `retired-word: member cleanupFailures` and `retired-word: member cleanupPromise` remain and must not be edited here. Tasks 5–6 remove `cleanupFailures` when the startup error surface contracts. The shared `cleanupPromise` finding stays after that contraction because `DiBagCloseCancelledError.cleanupPromise` remains public until Phase 11. Every code hit for `cleanupPromise` is read from that close error (in `tests/runtime-diagnostics.test.ts`, `tests/acquisition-cleanup.test.ts` near line 723, `tests/observers.test.ts` only if that error comes from `close`). Open each non-JSON hit and check which error it is. No code hit for `cleanupFailures` or `.cleanupError` may remain; local variables named `cleanupError` in `tests/observers.test.ts`, `tests/observers-runtime-fixture.ts` and `examples/integration/owned-scope.ts` are not the library field and stay.

```bash
rg -n "close\(\{ ?(timeoutMs|signal)" tests examples scripts > /tmp/phase-03-old-close-options.txt
python3 - <<'PY'
from collections import Counter
from pathlib import Path
def normalized(line: str) -> tuple[str, str]:
    path, line_number, text = line.split(':', 2)
    assert line_number.isdigit()
    return path, text
actual = Counter(normalized(line) for line in Path('/tmp/phase-03-old-close-options.txt').read_text().splitlines())
expected = Counter({
    ('tests/types/negative/startup.ts', 'closable.close({ timeoutMs: 1 });'): 1,
    ('tests/types/negative/startup.ts', 'closable.close({ signal: new AbortController().signal });'): 1,
})
assert actual == expected, f'missing={sorted((expected - actual).elements())}; unexpected={sorted((actual - expected).elements())}'
PY
```

Expected: the exact assertion passes. These two compile-time negatives deliberately prove that `CloseOptions` rejects the 0.4 option names. Any other row is a missed executable caller; fix that caller without changing these negative cases.

- [ ] **Step 7: Run the tests**

Run: `npm run typecheck && npm run test:fast`
Expected: typecheck exits 0; the fast lane reports `0 fail`.

Run: `npm run build && node --expose-gc --test --test-isolation=none tests/runtime-scale.node.mjs tests/acquisition-retention.node.mjs tests/graph-retention.node.mjs`
Expected: `# fail 0`. This mid-phase run catches migration regressions before contract; the same master gate runs again on the final candidate.

Run: `for example in examples/*.ts; do bun run "$example" || exit 1; done`
Expected: every example exits 0.

Run: `npm run codemod:check`
Expected: exits 0 after the hand migrations as well as after the mechanical commit.

- [ ] **Step 8: Commit**

```bash
git add -A tests examples scripts
git commit -F - <<'MSG'
refactor: finish the move to ensureServicesReady by hand

String fixtures, JavaScript tests, any-typed errors and the release evidence
names, which the codemod cannot resolve.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

---

### Task 5: Remove `buildAndStart` and the startup names (first half of the green contract)

Tasks 5 and 6 are one green contract-and-docs boundary. Complete the source removal and its narrow checks here, keep the changes uncommitted, then regenerate the API card/reference, update the graph/docs and shrink the naming ratchet in Task 6 before committing. A commit with removed declarations and stale generated documentation or stale known-violation entries is not permitted.

**Files:**
- Modify: `src/di-bag.ts`, `src/startup.ts`, `src/errors.ts`, `src/index.ts`
- Modify: `tests/types/negative/api-renaming.ts`, `tests/ensure-services-ready.test.ts`
- Modify: `docs/agent/errors.md`

**Interfaces:**
- Produces: `src/index.ts` no longer exports `StartupOptions`, `DiBagStartupError`, `DiBagStartupCancelledError`. `Builder` has no `buildAndStart`. `src/` contains no `'DI_BAG_STARTUP_*'` literal. `snapshotOptions(options: unknown, operation: 'ensureServicesReady' | 'close', code: DiBagErrorCode, supported: readonly string[], timeoutKey: string, signalKey: string)`.

- [ ] **Step 1: Write the failing removal checks**

Append to `tests/types/negative/api-renaming.ts`:

```ts
// diagnostic: does not exist
DiBag.createBuilder().register({ value: () => 1 }).buildAndStart(['value']);
// diagnostic: has no exported member
type RemovedStartupOptions = import('../../../src').StartupOptions;
// diagnostic: has no exported member
type RemovedStartupError = import('../../../src').DiBagStartupError;
// diagnostic: has no exported member
type RemovedStartupCancelledError = import('../../../src').DiBagStartupCancelledError;
```

The import path must be exactly `'../../../src'`: `tests/provider-contract-fixtures.ts` rewrites that spelling to `'di-bag'` when the fixture is compiled against the packed package. Both compilers print `Property 'buildAndStart' does not exist on type 'Builder<…>'` and `Namespace '…' has no exported member 'StartupOptions'` for these lines; this was checked.

Append to `tests/ensure-services-ready.test.ts`:

```ts
test('the 0.4 startup names are gone at run time', async () => {
  const api = await import('../src/node') as Record<string, unknown>;
  expect('buildAndStart' in DiBag.createBuilder()).toBe(false);
  expect(api.DiBagStartupError).toBeUndefined();
  expect(api.DiBagStartupCancelledError).toBeUndefined();
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `bun test tests/ensure-services-ready.test.ts -t "0.4 startup names"`
Expected: FAIL, `buildAndStart` is still on the builder.

- [ ] **Step 3: Delete from `src/di-bag.ts`**

Delete the whole `buildAndStart` method of `Builder` with its JSDoc comment. Change the imports to:

```ts
import { closeRuntime, ensureRuntimeReady } from './startup';
```

```ts
import type { CloseOptions, EnsureServicesReadyOptions } from './startup';
```

In the JSDoc of the `Bag` class, the sentence that links `Builder.build` and `Builder.buildAndStart` becomes:

```ts
 * Create bags through {@link DiBagApi.createBuilder} followed by {@link Builder.build}, and make services
 * ready ahead of use with {@link Bag.ensureServicesReady}; the class is exported as a type and has no public constructor.
```

Run `grep -n "buildAndStart" src/di-bag.ts`. Expected: no output. A leftover `{@link Builder.buildAndStart}` makes `npm run docs:generate` warn about a broken link.

- [ ] **Step 4: Delete from `src/startup.ts`**

Delete the `StartupOptions` interface with its comment, the function `snapshotStartupOptions`, and the function `startRuntime` with its comment. Then:

```ts
import { diagnostic, diagnosticMessage, libraryError } from './errors';
import type { BagRuntime, BindingGraph, BindingKey } from './runtime';
import { readTokenKey } from './tokens';
import { DiBagCleanupError, DiBagCloseCancelledError, DiBagServiceReadinessCancelledError, DiBagServiceReadinessError } from './errors';
import type { DiBagErrorCode } from './errors';
```

`BagRuntime` was imported as a value only because `startRuntime` constructed one; it is a type-only import now, and the import of `RuntimeContext` goes away. Make the two keys of `snapshotOptions` required and drop the old operation:

```ts
function snapshotOptions(options: unknown, operation: 'ensureServicesReady' | 'close', code: DiBagErrorCode, supported: readonly string[], timeoutKey: string, signalKey: string): Record<string, unknown> {
```

In the comment above `formatted`, "a startup timeout" becomes "a readiness timeout".

- [ ] **Step 5: Delete from `src/errors.ts` and `src/index.ts`**

Delete the classes `DiBagStartupError` and `DiBagStartupCancelledError` with their comments. In `src/index.ts`:

```ts
export { DiBagCleanupError, DiBagCloseCancelledError, DiBagPluginValidationError, DiBagServiceReadinessError, DiBagServiceReadinessCancelledError } from './errors';
```

```ts
export type { CloseOptions, EnsureServicesReadyOptions } from './startup';
```

Run: `grep -rnE "buildAndStart|StartupOptions|DiBagStartup|DI_BAG_STARTUP_|startupOrder" src`
Expected: no output.

- [ ] **Step 6: Update `docs/agent/errors.md`**

Delete the three sections `DI_BAG_STARTUP_CANCELLED`, `DI_BAG_STARTUP_FAILED` and `DI_BAG_STARTUP_TIMEOUT`.

Replace the `DI_BAG_INVALID_STARTUP` section body, keeping its heading and its recipe line:

````md
**When:** `ensureServicesReady(serviceKeys, options)` receives a list that is not
an array, an unregistered key, an unknown option (the 0.4 names `signal`,
`timeoutMs` and `startupOrder` are unknown), a non-positive `totalTimeoutMs`, a
`maxConcurrentServiceKeys` that is not a positive safe integer, or an
`abortSignal` that is not an `AbortSignal`. No factory runs and the bag stays
open.

**Cause:** keys or options computed at runtime.

**Fix:** pass registered keys and valid options.

```ts
import { DiBag } from 'di-bag';

const app = await DiBag.createBuilder()
  .register({ settings: async () => 'ready' })
  .build()
  .ensureServicesReady(['settings'], { totalTimeoutMs: 5_000, maxConcurrentServiceKeys: 1 });
await app.close();
```
````

In the "Unknown key" family, both mentions of `buildAndStart` become `ensureServicesReady`. In `DI_BAG_CLASSIFIER_REQUIRED`, "`build()` or `buildAndStart()` completes a graph" becomes "`build()` completes a graph".

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm run typecheck`
Expected: exits 0. Any error here is a call site that Task 4 missed; fix it by the rule table of Task 4.

Run: `bun test tests/ensure-services-ready.test.ts tests/startup.test.ts && bun test tests/types.test.ts -t "startup|api-renaming"`
Expected: `0 fail` in both commands.

- [ ] **Step 8: Keep the verified contract changes uncommitted and continue to Task 6**

Run `git diff --check`. Do not commit yet: the tracked API card, generated reference and naming ratchet still describe the declarations removed here. Continue directly to Task 6 and make the combined green contract/docs commit there.

---

### Task 6: API card, reference, graph tool, naming ratchet and the green Tasks 5–6 contract commit

**Files:**
- Modify: `tools/docs/api-card-tasks.json`, `tools/docs/test/exact-rendering.test.mjs`
- Modify: `docs/agent/api-card.md` and `docs/reference/` (generated)
- Modify: `docs/guides/api-reference.md` (three removed-name rows; assert Task 1's close row)
- Modify: `tests/api-naming-known-violations.json` (delete exactly ten retired startup entries)
- Modify: `tools/graph/README.md`, `tools/graph/test/extract.test.mjs`
- Create: `tools/graph/test/fixtures/ready-chain.ts`

- [ ] **Step 1: Add the task row**

In `tools/docs/api-card-tasks.json`, after the `"Build a bag"` entry:

```json
  { "task": "Wait for services before accepting work", "call": "bag.ensureServicesReady" },
```

- [ ] **Step 2: Point the rendering test at the new class**

In `tools/docs/test/exact-rendering.test.mjs`, the variable `startupError` becomes `readinessError` in its three places, the file it reads becomes `index/classes/DiBagServiceReadinessError.md`, and the assertion becomes:

```js
  assert.match(readinessError, /readonly disposalError\?: unknown;/);
  assert.doesNotMatch(readinessError, /readonly optional/);
```

`tools/docs/test/syntax.test.mjs` writes its own sample page that happens to say `cleanupError`. It does not read `src/`. Leave it.

- [ ] **Step 3: Fix the three removed-name rows and preserve Task 1's close row**

Three rows link to reference pages that no longer exist, and `npm run docs:check` stops on a dead link. Replace the rows for `DiBagStartupError`, `DiBagStartupCancelledError` and `StartupOptions` with:

```md
| [`DiBagServiceReadinessError`](../reference/index/classes/DiBagServiceReadinessError.md) | `ensureServicesReady` could not make a listed service ready, and the bag it was called on has closed. | `cause` is the acquisition error; `disposalFailures` contains disposal failures; `disposalError` retains the complete shutdown error when present. |
| [`DiBagServiceReadinessCancelledError`](../reference/index/classes/DiBagServiceReadinessCancelledError.md) | An abort signal or the deadline interrupts `ensureServicesReady`. | `reason` is `'aborted'` or `'timeout'`; `cause` retains the cancellation reason; `details.acquisitionsStillPending` names the services that were not ready; `disposalPromise` is a `Promise<void>` for the eventual shutdown. |
```

```md
| [`EnsureServicesReadyOptions`](../reference/index/interfaces/EnsureServicesReadyOptions.md) | Optional `abortSignal`, `totalTimeoutMs`, and `maxConcurrentServiceKeys` fields for `ensureServicesReady`. |
```

Then assert that Task 1's unchanged close row is still present exactly once:

```bash
test "$(grep -cF '| [`DiBagCloseCancelledError`](../reference/index/classes/DiBagCloseCancelledError.md) | `close({ waitTimeoutMs, abortSignal })` stops waiting before cleanup finishes.' docs/guides/api-reference.md)" -eq 1
```

Do not edit anything else in the guides. Phase 12 rewrites them.

- [ ] **Step 4: Regenerate**

Run: `npm run build && npm run docs:generate`
Expected: `docs/agent/api-card.md` retains the `bag.ensureServicesReady` section created by Tasks 2–3, gains its task row, and loses `builder.buildAndStart`. `docs/reference/index/classes/` retains the two readiness-error pages and loses the two startup-error pages; `docs/reference/index/interfaces/StartupOptions.md` is gone and `EnsureServicesReadyOptions.md` remains. If TypeDoc warns about an unresolved `{@link}`, fix that comment in `src/`.

- [ ] **Step 5: Shrink and verify the naming ratchet inside the green contract boundary**

The fresh classic build in Step 4 exposes the contracted public surface to the phase-0 scanner. Task 1 removed no entry from `tests/api-naming-known-violations.json`: `signal`, `timeoutMs`, `pending` and `acquiring` were never listed. Tasks 2–3 only expand the surface, and Task 4 changes migration support rather than the exported source surface. The Task 5 contraction removes exactly these ten listed violations:

```text
retired-word: code DI_BAG_STARTUP_CANCELLED
retired-word: code DI_BAG_STARTUP_FAILED
retired-word: code DI_BAG_STARTUP_TIMEOUT
retired-word: export DiBagStartupCancelledError
retired-word: export DiBagStartupError
retired-word: export StartupOptions
retired-word: member buildAndStart
retired-word: member cleanupError
retired-word: member cleanupFailures
retired-word: member startupOrder
```

Run the ratchet's shrink mode now, before the Tasks 5–6 commit:

```bash
UPDATE_API_NAMING_VIOLATIONS=1 bun test tests/api-naming.test.ts
```

Expected: the test passes and removes exactly those ten sorted strings from `tests/api-naming-known-violations.json`; it adds nothing. Inspect the diff against the phase-entry version. If any other entry disappears or a new violation is reported, stop and find the unintended public-surface change rather than accepting a broader ratchet edit.

Run the ordinary mode to prove the smaller list matches the freshly built surface:

```bash
bun test tests/api-naming.test.ts
```

Then prove the shrink is exactly the phase-owned set, preserves the note and adds nothing. The `next` ref remains the phase-entry tree until the controller merges this phase:

```bash
python3 - <<'PY'
import json, subprocess
from pathlib import Path
path = 'tests/api-naming-known-violations.json'
before = json.loads(subprocess.check_output(['git', 'show', f'next:{path}'], text=True))
after = json.loads(Path(path).read_text())
expected = {
    'retired-word: code DI_BAG_STARTUP_CANCELLED', 'retired-word: code DI_BAG_STARTUP_FAILED',
    'retired-word: code DI_BAG_STARTUP_TIMEOUT', 'retired-word: export DiBagStartupCancelledError',
    'retired-word: export DiBagStartupError', 'retired-word: export StartupOptions',
    'retired-word: member buildAndStart', 'retired-word: member cleanupError',
    'retired-word: member cleanupFailures', 'retired-word: member startupOrder',
}
old, new = set(before['violations']), set(after['violations'])
assert before['note'] == after['note'], 'the ratchet note changed'
assert old - new == expected, f'unexpected removals: {sorted(old - new)}'
assert not new - old, f'ratchet additions: {sorted(new - old)}'
assert after['violations'] == [item for item in before['violations'] if item not in expected], \
    'ratchet content or ordering changed beyond the exact expected removals'
print('naming ratchet: unchanged note, exactly 10 expected removals, 0 additions')
PY
```

Expected: the naming test passes without changing the file, then the audit prints `naming ratchet: unchanged note, exactly 10 expected removals, 0 additions`.

- [ ] **Step 6: Teach the graph tool's tests the new chain**

`tools/graph/lib/extract.mjs` needs no change: its visitor descends into `x.build().ensureServicesReady(…)` and finds the `build()` call, and `TERMINALS` keeps `buildAndStart` for 0.4 code. This was run against the current extractor. Pin it.

Create `tools/graph/test/fixtures/ready-chain.ts`:

```ts
// tools/graph/test/fixtures/ready-chain.ts
import { DiBag } from '../../../../src/node';
export const app = DiBag.createBuilder()
  .register({
    db: async () => ({ ping: () => true }),
    report: ({ db }: { db: Promise<{ ping(): boolean }> }) => db,
  })
  .build()
  .ensureServicesReady(['db']);
```

Append to `tools/graph/test/extract.test.mjs`:

```js
test('build() is still the end of the chain when ensureServicesReady follows it', () => {
  const ready = extractDependencyGraph({ files: [resolve(root, 'tools/graph/test/fixtures/ready-chain.ts')], root });
  assert.deepEqual(ready.units.map(candidate => [candidate.kind, candidate.nodes.map(node => node.key)]), [['bag', ['db', 'report']]]);
  assert.deepEqual(ready.units[0].edges, [{ from: 'report', to: 'db' }]);
  assert.deepEqual(ready.issues, []);
});
```

In `tools/graph/README.md`, line 5 says a chain "ends in `build()`, `buildAndStart()`, or `buildModule()`". Make it: "ends in `build()` or `buildModule()`; a `build()` followed by `ensureServicesReady()` counts, and so does the 0.4 `buildAndStart()`". On line 38, "a bag (`build()` or `buildAndStart()`)" becomes "a bag (`build()`)".

- [ ] **Step 7: Run the checks**

Run: `npm run docs:check && npm run graph:check && bun test tests/api-naming.test.ts`
Expected: all three checks exit 0; `graph:check` reports one more passing test than before, and the naming test leaves the ten-entry-smaller ratchet unchanged.

- [ ] **Step 8: Commit Tasks 5 and 6 as one green contract/docs unit**

```bash
git add -A src tests tools docs
git commit -F - <<'MSG'
refactor!: contract startup API and publish ensureServicesReady docs

builder.build().ensureServicesReady(serviceKeys, options) replaces
builder.buildAndStart(keys, options). StartupOptions, the startup error classes
and DI_BAG_STARTUP_* codes are gone; generated references and the graph tool
describe the contracted surface, and the naming ratchet drops their ten retired
entries in this same green commit.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

---

### Task 7: Evidence, naming-ratchet audit, full gate, report

**Files:**
- Create: `docs/superpowers/plans/evidence/phase-03.md`

`tests/api-naming-known-violations.json` is an audit input in this task, not a Task 7-owned file. Do not edit or stage it here.

- [ ] **Step 1: Audit the phase-wide naming-ratchet result without editing it**

Tasks 5–6 already removed and verified the ten stale startup entries before their green commit. Run the naming test of phase 0 in ordinary mode and prove Task 7 does not edit the list:

```bash
bun test tests/api-naming.test.ts
python3 - <<'PY'
import json, subprocess
from pathlib import Path
path = 'tests/api-naming-known-violations.json'
before = json.loads(subprocess.check_output(['git', 'show', f'next:{path}'], text=True))
after = json.loads(Path(path).read_text())
expected = {
    'retired-word: code DI_BAG_STARTUP_CANCELLED', 'retired-word: code DI_BAG_STARTUP_FAILED',
    'retired-word: code DI_BAG_STARTUP_TIMEOUT', 'retired-word: export DiBagStartupCancelledError',
    'retired-word: export DiBagStartupError', 'retired-word: export StartupOptions',
    'retired-word: member buildAndStart', 'retired-word: member cleanupError',
    'retired-word: member cleanupFailures', 'retired-word: member startupOrder',
}
old, new = set(before['violations']), set(after['violations'])
assert before['note'] == after['note'], 'the ratchet note changed'
assert old - new == expected, f'unexpected removals: {sorted(old - new)}'
assert not new - old, f'ratchet additions: {sorted(new - old)}'
assert after['violations'] == [item for item in before['violations'] if item not in expected], \
    'ratchet content or ordering changed beyond the exact expected removals'
print('naming ratchet: unchanged note, exactly 10 expected removals, 0 additions')
PY
git diff --exit-code HEAD -- tests/api-naming-known-violations.json
```

Expected: the naming test passes, the Python audit prints `naming ratchet: unchanged note, exactly 10 expected removals, 0 additions`, and the diff command prints nothing. Record that output in the phase report: Task 1 removed no listed violation; the combined Tasks 5–6 commit removed exactly the three startup codes, three startup exports and four startup members named in Task 6 Step 5; no phase task added a known violation. If the test or exact audit reports another fixed, removed or new violation, repair it in the task/commit that owns the public-surface change rather than editing the list in this evidence task.

- [ ] **Step 2: Measure the twelve cases**

This phase changed a signature in `src/di-bag.ts`, so the master plan asks for the measurement. Use the phase-0 helper: it runs each worker in a fresh process, proves acceptance/empty diagnostics, compares against the baseline and enforces the cumulative +10% ceiling.

```bash
node scripts/evidence-cases.mjs --compare docs/superpowers/plans/evidence/baseline.md
```

Expected: the helper exits 0 and prints twelve accepted rows. Write `docs/superpowers/plans/evidence/phase-03.md` with one table: case, baseline instantiations, instantiations now, accepted, and change in percent. The builder lost a method and the bag gained one, so a change below 1% is expected, but only the master's cumulative `<= +10%` limit is a gate. If the helper rejects a case or reports a case above that limit, stop and find the cause before the phase ends.

- [ ] **Step 3: Run the full gate**

Run each command of the master plan's gate list and keep the last lines of its output for the report:

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
for example in examples/*.ts; do bun run "$example" || exit 1; done
npm run agent-eval:test
```

Expected: every command exits 0. The `npm run build` immediately after the native commands restores classic `dist/` before the retention suites and examples read it. The example loop exits nonzero on its first failure. A compiler-lane test that times out under host load is a flake only under the rule in the master plan's "Environment" section: rerun that file alone, and report it either way.

- [ ] **Step 4: Commit and report**

```bash
git add -A docs/superpowers/plans/evidence
git commit -F - <<'MSG'
docs(plans): phase 3 evidence

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
```

Reply to the controller in the format of the master plan, "Protocol for every phase", step 9: the branch, `git log --oneline next..HEAD`, the gate results, the evidence table, every manual item that the codemod reported and its resolution, and every deviation from this plan with its reason. Include a compact commit table with rows for Task 1, the combined Tasks 2–3 expand, any prior manual-preparation commit, the separate mechanical codemod commit, the hand-migration commit, the combined Tasks 5–6 contract/docs commit, and Task 7 evidence. Mark every produced hash green; this phase has no bisect-skip hashes. Under 60 lines.

---

## Self-review

**Spec coverage.** `ensureServicesReady` on a bag, a child scope and a fork, the same-bag result, close on failure, untouched bag on invalid input, rejections only, repeated calls: the green Tasks 2–3 expand, with tests in `tests/ensure-services-ready.test.ts`. The pending-work report is defined and consumed in that same expand commit. `close` options `abortSignal` and `waitTimeoutMs`: atomic Task 1. `CloseProgress.disposersStillRunning` and `.acquisitionsStillPending`: atomic Task 1. `DiBagServiceReadinessError`, `DiBagServiceReadinessCancelledError`, `disposalFailures`, `disposalError`, `disposalPromise`, the three codes: Tasks 2–3. `buildAndStart` removed, `StartupOptions` renamed and not aliased, old names fail to compile, generated docs contract, graph compatibility, and the exact ten-entry naming-ratchet shrink: the green Tasks 5–6 contract. Codemod data and fixture: Task 4. Evidence and the read-only phase-wide ratchet audit: Task 7.

**Task 4 audit precision.** Migration audits scan every owned consumer path and accept only exact intentional artifacts: two lexical naming-scanner controls, seven still-live startup ratchet rows, three graph compatibility/documentation rows, explicit invalid-option list entries, the two `CloseOptions` negative cases in `tests/types/negative/startup.ts`, and the two still-live cleanup member rows in the ratchet. The exact audits normalize away line numbers but compare `(path, line text)` with multiplicity; they exclude no whole test file, so an additional executable legacy caller fails the comparison. The inclusive codemod dry run proves its only proposed `tests/types/negative/startup.ts` diff is those two close controls; the explicit mechanical-write inventory omits exactly that file and the byte comparison preserves it without restoration. Tasks 5–6, not Task 4, remove the startup ratchet rows and `cleanupFailures`; graph compatibility remains for 0.4 input while Task 6 updates its README wording, and the shared `cleanupPromise` finding remains for the close error until Phase 11.

**Left to later phases on purpose.** `DiBagCloseCancelledError.cleanupPromise`, `DiBagCleanupError`, `CleanupFailure` and the `cleanup-*` events (phase 11). The code `DI_BAG_INVALID_STARTUP` (phase 11 folds it into `DI_BAG_INVALID_ARGUMENT` and `DI_BAG_UNKNOWN_SERVICE_KEY`). The acquisition context's `signal` (phase 8). `build` to `buildContainer` (phase 5), `Bag` to `Container`, `createScope` and `fork` (phase 6); the words "bag", "scope" and "fork" in this phase's messages and comments are renamed with them. The tutorial section on startup and every other guide (phase 12); until then the `@see` URL of `EnsureServicesReadyOptions` points at the existing tutorial heading. Throwing stubs for the removed runtime names and the changelog (phase 13).

**Known limit, stated in the JSDoc by its wording "what was still pending".** The report lists acquisitions owned by the bag the call ran on and by its child scopes. A singleton that a child scope asked for is owned by the root bag and does not appear in the child's report.

**Placeholder scan.** No step says "handle", "similar to" or "as appropriate" without the content. The production map, phase fixture input/output/manual file, both-root commands and commit boundaries are written in full. Only the fixture directory path is discovered from phase 1, with the exact search that finds it.

**Type consistency.** `ensureRuntimeReady(runtime, graph, keys, options?)` is defined in Task 3 Step 4 and called in Step 5 with `this.#runtime, this.#graph, serviceKeys, options`. The public selection is `Selection<ServiceRegistrations, K, 'ensureServicesReady'>`, using the exact phase-2 class parameter. The cancelled error's constructor `(reason, cause, disposalPromise, progress, totalTimeoutMs?)` is defined in Task 2 Step 3 and called in Task 3 Step 4 with `runtime.close(cause)` third and `runtime.closeProgress()` fourth, whose shape Task 1 Step 4 produces. `snapshotOptions` has six parameters from Task 1 Step 5 on; Task 3 Step 4 widens its `operation` union and Task 5 Step 4 narrows it. Option names are spelled `abortSignal`, `totalTimeoutMs`, `maxConcurrentServiceKeys`, `waitTimeoutMs` everywhere.

**Verified before writing.** The source edits of Tasks 1 to 3 were applied to a scratch copy of `src/`. It type-checked with `tsc6`. The fifteen method tests plus the retained error-constructor test, the migrated `tests/startup.test.ts` (33 tests) and the edited `tests/runtime-diagnostics.test.ts` (13 tests) passed on Bun 1.4.0. The fixture lines of Task 3 Step 2 and Task 5 Step 1 produced exactly the quoted diagnostics, one per line, with both compilers. The graph extractor found `build()` inside `build().ensureServicesReady()`. Phase 1's planned transform is the authority for the codemod fixture: a nonliteral `startupOrder` leaves its whole call unchanged and produces a manual item.
