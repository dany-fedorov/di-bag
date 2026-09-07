# Lifecycle observers implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Observe canonical lifecycle transitions without changing graph values,
readiness, ownership or original failures.

**Architecture:** An immutable observed facade captures callbacks in its runtime
context. Existing scope/acquisition transitions publish frozen typed events to a
microtask dispatcher. Callback failures go to a required separate handler; callback
work never joins acquisition or cleanup ownership.

**Tech stack:** TypeScript classic/native, Bun tests, Node/Bun actual archives,
existing scope and provider execution state machines.

**Spec:** `docs/superpowers/specs/2026-09-07-lifecycle-observers-design.md`.

## Global constraints

- Canonical owner/attempt IDs match inspection; aliases create no synthetic attempt.
- Events expose immutable copied state and conservative metadata, not resolvers/controllers.
- Observer return values cannot transform services, readiness or cleanup ownership.
- Callback delivery is ordered and queued; callback completion never gates shutdown.
- Original errors retain identity; observer failures use a separate error callback.
- No-observer paths avoid event/snapshot/monitor allocation.
- Preserve exact inferred contracts, all diagnostic allowances and compiler-work ceilings.

### Task 1: Observed facade and canonical lifecycle events

**Files:** create `src/observers.ts`; modify `src/di-bag.ts`,
`src/acquisition-mode.ts`, `src/runtime.ts`, `src/acquisition.ts`,
`src/provider-execution.ts`, `src/inspection.ts`, `src/index.ts` as needed; create
`tests/observers.test.ts`, `tests/types/observers.ts`,
`tests/types/observers-consumer.ts`, `tests/types/negative/observers.ts`; modify
`tests/types.test.ts`.

**Interfaces:** Consume runtime context, actual scope/attempt identities and
ProviderExecution's final-stage readiness/cleanup transitions. Produce
`DiBag.observe({ onEvent, onError })`, immutable facade composition and the root
`LifecycleEvent`, `ObserverFailure`, observer callback/configuration types.
Existing Bag/Builder/Module/provider types retain their exact contracts.

- [x] Add and run a public runtime RED using the portable core and explicit raw
  mode; retain one service identity and one owner while collecting lifecycle events.
- [x] Implement checked callback configuration and immutable facade append/preserve
  behavior. Validate both callbacks before constructing the returned facade; retain
  prior observers through configure and the node classifier through observe.
- [x] Add the typed event union and frozen event/failure snapshots. Match actual
  owner/attempt IDs and copy frame presence records without deep-freezing payloads.
- [x] Publish scope open/closing/closed/failure transitions only after state is
  consistent; keep tracked parent IDs and independent fork ownership distinct.
- [x] Publish canonical attempt start and final-stage ready/failure once each.
  Follow aliases/root/sharing before attribution; each contribution/transient
  attempt remains independently identifiable.
- [x] Publish accepted ownership cleanup start/completion and per-disposer failure,
  including early retirement/rollback. Preserve the original disposal order and
  aggregate errors; unowned attempts do not invent cleanup ownership.
- [x] Queue ordered event delivery outside the synchronous factory ancestry stack.
  Monitor callback results only for failure, route to the corresponding onError,
  and consume secondary errors without recursion or unhandled rejection. Do not
  await callbacks during resolve/start/close.
- [x] Cover failures, pending final stages, metadata frames, modules/contributions,
  scope sharing/roots/forks, startup cancellation/rollback and callback reentrancy.
  Add strict negative callback/event-narrowing and inferred facade declarations.
- [x] Run focused runtime, relevant classic/native source and physical declarations
  serially; self-review, record RED/GREEN and locally commit only owned source/tests.

Start the runtime fixture with this observable contract, expanding events and
failure assertions from the binding spec:

```ts
import { expect, test } from 'bun:test';
import { DiBag, type LifecycleEvent, type ObserverFailure } from '../src';

test('observers preserve raw identity and explicit ownership', async () => {
  const events: LifecycleEvent[] = [];
  const failures: ObserverFailure[] = [];
  let closedEvent!: () => void;
  const delivered = new Promise<void>(resolve => { closedEvent = resolve; });
  const observed = DiBag.observe({
    onEvent(event) {
      events.push(event);
      if (event.kind === 'scope-closed') closedEvent();
    },
    onError(failure) { failures.push(failure); },
  });
  const value = { id: 1 };
  let disposed = 0;
  const bag = observed.begin().add({
    value: observed.withDisposal(observed.factory(() => value, { acquisition: 'raw' }),
      acquired => { expect(acquired).toBe(value); disposed++; }),
  }).alias('copy', 'value').end();
  expect(bag.resolve('copy')).toBe(value);
  expect(bag.resolve('value')).toBe(value);
  expect(events).toEqual([]);
  await Promise.all([bag.close(), delivered]);
  expect(disposed).toBe(1);
  expect(failures).toEqual([]);
  expect(events.filter(event => event.kind === 'acquisition-started')).toHaveLength(1);
  expect(events.filter(event => event.kind === 'acquisition-ready')).toHaveLength(1);
  expect(events.every(Object.isFrozen)).toBe(true);
});
```

Run `bun test tests/observers.test.ts` before implementation and record the missing
observe API failure. Use a controlled pending native final projection for readiness
RED, and explicit rejected/throwing-then observer return values for failure handling.
A callback awaiting a never-settling Promise must not prevent bag.close from
completing; use a separately controlled event-delivery promise to observe results.

Export the observed facade and its concrete/reflected methods without annotations
in the type producer. Assert event discrimination and unchanged service/provider
contracts in the consumer. Negative regions use `// diagnostic:` and prove missing
or invalid callbacks, required receivers, invalid variant fields and erased frame
claims reject. Run `bun test tests/types.test.ts -t observers`, related lifecycle
runtime checks, native primary-marker matching and actual source-removed inferred
declaration consumption. Controller owns full/package/compiler-work gates.

### Task 2: Physical observer routes, examples and E2 evidence

**Files:** create `tests/observers-runtime-fixture.ts`, `examples/observers.ts`;
modify classic/native package fixture lists and harnesses, README, CHANGELOG,
`docs/migrations/0.1-to-enterprise.md`, enterprise tracker; create
`docs/reports/2026-09-07-lifecycle-observers.md`.

**Interfaces:** Consume Task 1's observed facade and typed producer/consumer/negative
fixtures. Produce one shared actual-archive assertion string and a concise logging
example with an explicit observer error sink.

- [x] Exercise canonical alias/contribution identity, parent owner attribution,
  pending native readiness, raw mode, cleanup failure, callback failure/rejection,
  reentrant delivery and nonsettling observers from both actual archives under
  Node/Bun CommonJS/ESM. Include portable core explicit-mode observation.
- [x] Route inferred `.cts`/`.mts` producers through both emitters, delete source
  and consume with both compilers. Retain strict negative markers and no-observer
  declaration controls without relaxing root import or skipLibCheck checks.
- [x] Document required onError, immutable facade composition, queued delivery,
  exact values/owners and application responsibility for asynchronous telemetry
  completion. Execute a lifecycle logging example with cleanup assertions.
- [x] Run full check, native strict/build/source audit, all examples and diff checks
  serially on stable source/harness; record completed logs and precise counts.
- [x] Independent task/final review, one consolidated correction, scoped review and
  verified local commit. Mark the observer portion of E2 only after its gates pass.
- [ ] Non-force push when export approval permits, verifying remote SHA; no publish.

Wire the shared observer string beside the contribution string in both package
harnesses. Add `observers.ts`, `negative/observers.ts` and inferred producer/consumer
routes without weakening existing source removal, classic/native downstream checks
or native allowances. Use the actual `bun test tests/native-package.test.ts
tests/package.test.ts` matrix after Task 1 stabilizes. After review/correction run
`npm run check`, native strict/build/source audit and every runnable example
serially. Dynamic-plugin validation, individual-chain limits/native message gaps
and broader runtime/bundler/performance/release work remain open.
