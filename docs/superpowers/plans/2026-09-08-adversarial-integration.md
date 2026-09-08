# Adversarial Cross-Feature Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mechanically prove that real box adapters, plugins, lifetimes, scopes, observers, startup, declarations, exports, and offline packages preserve one DI Bag identity and ownership model when combined.

**Architecture:** A focused source test and reusable runtime-string oracle own the matrix. Existing package harnesses embed that oracle from fresh archives while retaining their separate responsibilities for box provenance, CJS/ESM loading, classic/native emitters, source-deleted declarations, and Node/Bun.

**Tech Stack:** TypeScript 6/7, Bun test, Node CJS/ESM, npm offline installs, fixed `sas-box`/`val-box` fixture tarballs.

**Spec:** `docs/superpowers/specs/2026-09-08-adversarial-integration-design.md`

## Global Constraints

- Implement I1-I15 exactly; use controlled deferred promises and never sleeps.
- Compare errors, payloads, raw promises, scopes, bindings, and acquisitions by reference.
- Use real fixed box archives for archive lanes; do not add a DI Bag box dependency.
- Read the current reviewed native-gap inventory before every native gate; allow it to shrink from the prior 27 to zero, but reject every new gap ID, changed fingerprint, unexpected diagnostic, or unreviewed inventory entry.
- Package consumers use `npm install --offline --ignore-scripts --no-audit --no-fund --no-package-lock` and explicit tarball paths.
- This is test-only validation: a confirmed production defect stops this plan for a separate bug design.
- Do not access a network, alter fixture archives, publish, tag, or push.

---

## File structure

| File | Responsibility |
| --- | --- |
| `tests/final-adversarial-integration.test.ts` | Deterministic source I1-I14 matrix. |
| `tests/final-adversarial-runtime-fixture.ts` | Runtime assertion string and exact JSON expected result for I1-I15 package lanes. |
| `tests/types/final-adversarial-integration.ts` | Inferred positive module/token/adapter/plugin producer. |
| `tests/types/final-adversarial-integration-consumer.ts` | Source-deleted producer declaration consumer. |
| `tests/types/negative/final-adversarial-integration.ts` | Selected-override and automatic-graph diagnostic markers. |
| `tests/types.test.ts` | Source-deleted declaration test registration. |
| `tests/box-contract-fixtures.ts` | Classic/native physical package fixture registration. |
| `tests/box-package.test.ts` | Fixture hash, real-box/core-only, exported-file and archive oracle assertions. |
| `tests/package.test.ts` | Classic installed CJS/ESM oracle route. |
| `tests/native-package.test.ts` | Classic6/native7 CJS/MJS Node/Bun oracle and declaration route. |

### Task 1: Build the deterministic source RED matrix

**Files:**
- Create: `tests/final-adversarial-integration.test.ts`
- Create: `tests/final-adversarial-runtime-fixture.ts`
- Modify: `tests/box-adapters.test.ts`
- Modify: `tests/plugins.test.ts`
- Modify: `tests/observers.test.ts`
- Modify: `tests/startup.test.ts`

**Interfaces:**
- Consumes: public `DiBag`, `DiBagCleanupError`, `DiBagPluginError`, `DiBagStartupError`, `DiBagStartupCancelledError`, `fromSasBox`, `fromValBox`, `fromValBoxAsync`, `SasBox`, and `ValBox` APIs already exported by the repository and fixtures.
- Produces: `FinalAdversarialRuntimeResult`, `finalAdversarialExpectedResult`, and `finalAdversarialRuntimeAssertions` from `tests/final-adversarial-runtime-fixture.ts`.

- [ ] **Step 1: Write the failing source tests for I1-I4.**

```ts
test('I1 preserves real-box payload/frame references and reverse ownership', async () => {
  const payload = { id: 'payload' };
  const metadata = { source: 'real-box' };
  const events: unknown[] = [];
  const boxed = new ValBox.WithValue.WithMetadata(payload, metadata);
  const source = DiBag.withDisposal(() => SasBox.fromValue(boxed), value => events.push(value));
  const bag = DiBag.begin().add({ value: DiBag.withDisposal(fromValBox(fromSasBox(source, { mode: 'sync' })), value => events.push(value)) }).end();
  expect(bag.resolve('value')).toBe(payload);
  await bag.close();
  expect(events).toEqual([payload, expect.anything()]);
});
```

Add `toBe` assertions for I2 root/scoped/transient identity, I3 absent/present-undefined and snapshot errors, and I4 direct plugin error phase/identity plus original-result disposal. For the I4 startup route assert `DiBagStartupError` and `startupError.cause === directPluginError`; never expect `start()` to reject the raw plugin error. Use fixture packages; do not mock their protocol.

- [ ] **Step 2: Run the new source test to verify RED.**

Run: `bun test tests/final-adversarial-integration.test.ts`

Expected: FAIL because the source matrix and runtime fixture have not been created.

- [ ] **Step 3: Implement the shared result shape and I1-I4 tests.**

```ts
export const finalAdversarialExpectedResult: FinalAdversarialRuntimeResult = {
  I1: { payloadIdentity: true, metadataIdentity: true, aliasIdentity: true, dispose: ['payload', 'sas'], acquisitions: 1 },
  I2: { nativePromise: true, rootShared: true, transientDistinct: true, childDispose: ['transient-2', 'transient-1', 'scoped'], parentDispose: ['transient-2', 'transient-1', 'scoped', 'root'], acquisitions: 4 },
  I3: { absentIdentity: true, presentUndefined: true, getterIdentity: true, dispose: ['source'], acquisitions: 3 },
  I4: { outputPhase: 'output', errorIdentity: true, startupWrapper: 'DiBagStartupError', startupCauseIdentity: true, dispose: ['plugin', 'sas'], payloadDisposals: 0, acquisitions: 1 },
  I5: { directRetained: true, directDispose: ['direct-1'], startupWrapper: 'DiBagStartupError', startupCauseIdentity: true, startupDispose: ['startup-first'], retryFresh: true },
  I6: { aliasAcquisitions: 0, sharedIdentity: true, unsharedDistinct: true, dispose: ['installation-2', 'installation-1'], acquisitions: 2 },
  I7: { root: 1, scoped: 1, transient: 2, contributions: 2, cleanupFailureIdentity: true, independentCleanupCount: 5 },
  I8: { callbackOrder: ['A:acquisition-ready', 'B:acquisition-ready', 'A:cleanup-completed', 'B:cleanup-completed'], filteredOnEventCalls: 4, aOnErrorCalls: 1, bOnErrorCalls: 0, observerErrorIdentity: true, observerErrorEventIdentity: true, telemetryBlocksClose: false, lateDisposals: 1 },
  I9: { automaticEffects: 0, rawIdentity: true, thenReads: 0, rawDisposals: 1 },
  I10: { syncIdentity: true, rawIdentity: true, syncRawThenReads: 0, asyncThenReads: 1, failureIdentity: true, disposerCalls: 0 },
  I11: { boundaryErrorIdentity: true, retryFresh: true, dispose: ['source', 'source'] },
  I12: { ordinaryWrapper: 'DiBagStartupError', ordinaryCauseIdentity: true, ordinaryCleanupFailures: 0, abortWrapper: 'DiBagStartupCancelledError', abortCauseIdentity: true, timeoutWrapper: 'DiBagStartupCancelledError', timeoutCauseName: 'TimeoutError', dispose: ['immediate', 'late'] },
  I13: { closingEffects: 0, parentDispose: ['child', 'parent'], finalDispose: ['child', 'parent', 'fork'], unsharedDistinct: true },
  I14: { classicPositiveDiagnostics: 0, cjsPositiveDiagnostics: 0, mjsPositiveDiagnostics: 0, classicNegativeMarkers: 2, newNativeGapIds: [] },
  I15: { cjsMatchesSource: true, esmMatchesSource: true, coreHasBoxes: false, rootLoadsNode: false, forbiddenFiles: 0 },
};
```

Define the complete deterministic I1-I15 expected object before archive wiring. The runtime string throws `Error('I1: payload identity changed')` (and the corresponding literal message for every other row) and writes exactly one JSON line only after all assertions pass.

- [ ] **Step 4: Add I5-I13 deterministic failure/closure cases.**

```ts
const deferred = <T>() => { let resolve!: (value: T) => void;
  const promise = new Promise<T>(next => { resolve = next; }); return { promise, resolve }; };
const late = deferred<{ id: string }>();
const abort = new AbortController();
const started = bag.start(['adapter', 'plugin', 'items'], { signal: abort.signal });
abort.abort(cause);
const cancelled: unknown = await started.catch(error => error);
expect(cancelled).toBeInstanceOf(DiBagStartupCancelledError);
if (!(cancelled instanceof DiBagStartupCancelledError)) throw cancelled;
expect(cancelled.reason).toBe('aborted');
expect(cancelled.cause).toBe(cause);
late.resolve({ id: 'late' });
await cancelled.cleanup;
```

For I5, separately assert direct `resolveAll`: first call throws `i5Error`, leaves `['direct-1']` owned and undisposed, retry returns `[1, 2]`, and close disposes `['direct-1']`. Then assert `start()` rejects `DiBagStartupError`, `error.cause === i5StartupError`, and rollback disposes `['startup-first']`. For I8, capture one binding/acquisition ID and filter both observers to only its ready and cleanup-completed events; push the four literal callback labels in order, throw `i8ObserverError` only from A's ready callback, and assert A `onError` once/B `onError` zero with `failure.event` identical to captured ready event. For I12, assert ordinary failure is `DiBagStartupError` with `cause === i12PluginCause` and `cleanupFailures` length `0`; assert abort is `DiBagStartupCancelledError` with `reason === 'aborted'`, `cause === i12AbortCause`, and awaitable cleanup; separately assert timeout is `DiBagStartupCancelledError` with `reason === 'timeout'` and `cause.name === 'TimeoutError'`. Apply the remaining exact row values from the shared oracle; capture every required cause/error and assert `toBe(original)`.

- [ ] **Step 5: Run focused source matrix to verify GREEN.**

Run: `bun test tests/final-adversarial-integration.test.ts tests/box-adapters.test.ts tests/plugins.test.ts tests/observers.test.ts tests/startup.test.ts`

Expected: PASS with I1-I13 and all pre-existing focused suites.

- [ ] **Step 6: Commit the source-matrix task.**

```bash
git add tests/final-adversarial-integration.test.ts tests/final-adversarial-runtime-fixture.ts tests/box-adapters.test.ts tests/plugins.test.ts tests/observers.test.ts tests/startup.test.ts
git commit -m "test: add adversarial integration source matrix"
```

### Task 2: Add typed and source-deleted declaration RED/GREEN coverage

**Files:**
- Create: `tests/types/final-adversarial-integration.ts`
- Create: `tests/types/final-adversarial-integration-consumer.ts`
- Create: `tests/types/negative/final-adversarial-integration.ts`
- Modify: `tests/types.test.ts`
- Modify: `tests/box-contract-fixtures.ts`

**Interfaces:**
- Consumes: Task 1 real-box/provider scenarios plus existing `Assert`, `Equal`, marker, and package-routing conventions.
- Produces: `finalAdversarialFeature` declaration consumed only through `.d.cts`/`.d.mts` and selected-override markers.

- [ ] **Step 1: Write positive producer and source-deleted consumer.**

```ts
export const finalAdversarialFeature = DiBag.module()
  .bind(port, () => 8080)
  .add({ client: DiBag.fromClass([port], Client), plugin, boxed })
  .exports(['client', 'plugin', 'boxed']);
```

Assert inferred class/function, plugin, box, token, alias, and selected-scope contracts through existing public type carriers without application casts.

- [ ] **Step 2: Write negative fixture and run RED.**

```ts
// diagnostic: scope cannot share and override the same token
base.scope(['boxed'], { boxed: () => boxedValue }, { share: ['boxed'] });
// diagnostic: Type '() => { incompatible: boolean; }' is not assignable
base.scope(['plugin'], { plugin: () => ({ incompatible: true }) }, { share: ['boxed'] });
```

`boxedValue` has the original box-payload type. The first marker isolates the share/override collision on `boxed`; the second uses disjoint `plugin` override and `boxed` share keys and asserts only the payload mismatch.

Run: `bun test tests/types.test.ts`

Expected: FAIL until the new producer/consumer and physical fixture names are registered. The first unsuppressed marker isolates the `boxed` share/override collision; the second overrides `plugin` while sharing `boxed`, so its diagnostic isolates the incompatible output and one compiler error cannot satisfy both markers.

- [ ] **Step 3: Register exact declaration routes.**

Add `final-adversarial-integration.ts` and `negative/final-adversarial-integration.ts` to `boxContractFixtures`; register the producer/consumer in `tests/types.test.ts` so host source is absent and only emitted declaration is present.

- [ ] **Step 4: Run classic fixtures to verify GREEN.**

Run: `bun test tests/types.test.ts tests/diagnostic-markers.test.ts`

Expected: PASS; positive consumer has no diagnostics and every marker matches with no unexpected diagnostic.

- [ ] **Step 5: Run native classification.**

Run: `npm run typecheck:native && npm run check:native`

Expected: exit 0, zero unexpected diagnostics, and current gap IDs equal the reviewed inventory or a strict subset of it. A subset, including zero gaps, is accepted only after each removed ID is absent from the fresh output; any new ID or changed fingerprint fails.

- [ ] **Step 6: Commit type-contract task.**

```bash
git add tests/types/final-adversarial-integration.ts tests/types/final-adversarial-integration-consumer.ts tests/types/negative/final-adversarial-integration.ts tests/types.test.ts tests/box-contract-fixtures.ts
git commit -m "test: cover adversarial integration declarations"
```

### Task 3: Wire archive oracle through every package lane

**Files:**
- Modify: `tests/box-package.test.ts`
- Modify: `tests/package.test.ts`
- Modify: `tests/native-package.test.ts`
- Modify: `tests/final-adversarial-runtime-fixture.ts`

**Interfaces:**
- Consumes: Task 1 fixture exports and fixed fixture archives.
- Produces: full parsed `FinalAdversarialRuntimeResult` comparisons in Node CJS/ESM, Bun, classic6/native7, real-box, and core-only lanes.

- [ ] **Step 1: Embed only public imports in every installed runtime.**

```ts
import { finalAdversarialRuntimeAssertions } from './final-adversarial-runtime-fixture';
const runtimeSource = `${existingRuntimeSource}\n${finalAdversarialRuntimeAssertions}`;
```

CJS imports `DiBag`/errors from `di-bag/node`; MJS uses named `di-bag/node` imports; boxes use `di-bag/sas-box` and `di-bag/val-box`. Never import `src/**` or test helper paths from consumer code.

- [ ] **Step 2: Run one archive lane to verify RED.**

Run: `bun test tests/box-package.test.ts -t "real box"`

Expected: FAIL until stdout parses/compares full result and generated runtime includes I1-I15.

- [ ] **Step 3: Compare complete JSON and enforce I15.**

```ts
expect(JSON.parse(executed.stdout.trim())).toEqual(finalAdversarialExpectedResult);
expect(existsSync(join(coreOnly, 'node_modules', 'sas-box'))).toBe(false);
expect(existsSync(join(coreOnly, 'node_modules', 'val-box'))).toBe(false);
```

Retain fixture SHA-512 assertions. Reject `.tgz`, test, source, `node_modules`, credential, and unexported adapter paths in DI Bag archive; exercise all four public subpaths in both formats.

- [ ] **Step 4: Run all package routes to verify GREEN.**

Run: `bun test tests/box-package.test.ts tests/package.test.ts tests/native-package.test.ts`

Expected: PASS from fresh offline CJS/ESM Node/Bun classic6/native7 real-box/core-only lanes; physical source-deleted declarations remain green.

- [ ] **Step 5: Commit package-oracle task.**

```bash
git add tests/box-package.test.ts tests/package.test.ts tests/native-package.test.ts tests/final-adversarial-runtime-fixture.ts
git commit -m "test: run adversarial matrix from package archives"
```

### Task 4: Triage failures without semantic source changes

**Files:**
- Modify if assertion is wrong: `tests/final-adversarial-integration.test.ts` or `tests/final-adversarial-runtime-fixture.ts`
- Modify if source defect is proven: `docs/reports/2026-09-08-final-integration-release.md`

**Interfaces:**
- Consumes: matrix-ID failure, minimal reproducer, original error/value identity, and failing lane.
- Produces: corrected assertion with documented evidence, or an explicit report that stops this increment before a separate bug-design request; produces no runtime source change.

- [ ] **Step 1: Capture each red as one reproducible row.**

Run: `bun test tests/final-adversarial-integration.test.ts -t "I7"`

Expected: the literal I7 cleanup row fails with unaltered error/stdout and no unrelated selection. Repeat this command with literal I1 through I15 names as each row is reviewed.

- [ ] **Step 2: Classify the red.**

| Evidence | Required action |
| --- | --- |
| Documented contract supports runtime but assertion expects another result | Correct only expectation and cite contract next to test. |
| Runtime contradicts spec and minimal reproducer retains identity/order failure | Stop this plan, record the implicated `src/*.ts` path and exact evidence in the final integration report, then request a separate bug-specific design. |
| Archive fails while source passes and public import/file evidence identifies route | Correct package assertion only if public contract is already correct; otherwise stop for bug design. |

- [ ] **Step 3: Re-run precise red after expectation correction.**

Run: `bun test tests/final-adversarial-integration.test.ts -t "I7"`

Expected: PASS with actual public contract asserted by reference and no production edit.

- [ ] **Step 4: Re-run full matrix.**

Run: `bun test tests/final-adversarial-integration.test.ts tests/box-package.test.ts tests/package.test.ts tests/native-package.test.ts`

Expected: PASS. A remaining source defect ends this plan until its separate bug plan is green.

### Task 5: Redundant gates and evidence review

**Files:**
- Create: `docs/reports/2026-09-08-final-integration-release.md`
- Modify: `docs/superpowers/plans/2026-09-06-enterprise-di-program.md`

**Interfaces:**
- Consumes: exact output from Tasks 1-4 and current manifests.
- Produces: local report mapping I1-I15 to lanes/commands and tracker status that says locally verified, not published.

- [ ] **Step 1: Record matrix evidence.**

Write one I1-I15 row with source setup, expected literal sequence/count/result from the spec oracle, archive lanes, command, exit status, and timestamp. Record reviewed native inventory ID list, fresh ID list, removed ID list, new ID list, and that no registry/publish action ran.

- [ ] **Step 2: Run redundant build gates serially.**

Run: `npm run typecheck && npm test && npm run build && npm run typecheck:native && npm run build:native && npm run check:native`

Expected: every command exits 0; native has zero unexpected diagnostics and its fresh gap IDs are the reviewed list or a strict subset, including an empty list.

- [ ] **Step 3: Run examples and archive-facing tests.**

Run: `for file in examples/*.ts; do bun run "$file"; done`

Expected: all nine examples exit 0. Then run `bun test tests/final-adversarial-integration.test.ts tests/box-package.test.ts tests/package.test.ts tests/native-package.test.ts`; every matrix lane passes without timeout, OOM, or skip.

- [ ] **Step 4: Inspect final diff.**

Run: `git diff --check && git status --short`

Expected: `git diff --check` exits 0; report names only observed local evidence and no registry/publish/remote claim.

- [ ] **Step 5: Commit integration evidence.**

```bash
git add docs/reports/2026-09-08-final-integration-release.md docs/superpowers/plans/2026-09-06-enterprise-di-program.md
git commit -m "docs: record adversarial integration evidence"
```

## Plan self-review

- [ ] Every I1-I15 row maps to Tasks 1-3 in source and required archive lanes.
- [ ] Every named file, type, fixture, JSON field, import route, and command is defined here or in a named existing file.
- [ ] No incomplete, deferred, or vague implementation instruction remains in this plan.
- [ ] No task adds a semantic source change, network action, dependency, native-gap allowance, or publication command.
