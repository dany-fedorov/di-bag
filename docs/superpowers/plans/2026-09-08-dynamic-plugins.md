# Dynamic plugin boundary implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Admit unknown plugin descriptors and validate their exposed services
while retaining checked host dependencies and original acquisition ownership.

**Architecture:** A dependency-tuple adapter snapshots a versioned descriptor,
creates an explicit raw/native source stage and appends output validation using
existing staged provider operations. It reuses canonical acquisition, module,
lifetime, observer and cleanup behavior.

**Tech Stack:** TypeScript classic/native, Bun tests, Node/Bun actual archives,
existing authenticated providers and dependency reference snapshots.

**Spec:** `docs/superpowers/specs/2026-09-08-dynamic-plugins-design.md`.

## Global constraints

- Unknown plugins cross an explicit runtime protocol/result validation boundary.
- Preserve exact dependency values and raw result identity; awaiting is explicit.
- Accept original source ownership before validation and dispose it exactly once.
- Reuse canonical acquisitions; no wrapper bags, synthetic attempts or plugin runtime.
- Snapshot callbacks and dependencies without invoking factories during adaptation.
- Keep all existing invariant carriers, diagnostic allowances and compiler-work ceilings.
- Statically typed modules retain their existing exact contracts.

### Task 1: Checked plugin adapter and runtime validation

**Files:** create `src/plugins.ts`; modify `src/di-bag.ts`, `src/index.ts` and
`src/errors.ts` as needed; use existing private bridges in `src/provider.ts`,
`src/provider-operations.ts` and `src/dependency-references.ts`; create
`tests/plugins.test.ts`, `tests/types/plugins.ts`, `tests/types/plugins-consumer.ts`,
`tests/types/negative/plugins.ts`; modify `tests/types.test.ts`.

**Interfaces:** Consume dependency tuple snapshots, `ReferenceGraph<T>`,
`DependencyTupleAdmission<T>` and staged raw/native providers. Produce
`DiBag.fromPlugin(dependencies, plugin: unknown, { acquisition, validate })`,
root `DiBagPluginError` with `phase: 'descriptor' | 'output'`, and nameable public
option/predicate/result types. The raw output/acquired type is predicate result
`V`; native output/acquired types are `Promise<Awaited<V>>`/`Awaited<V>`.

- [ ] Write and run the public runtime RED below before adding the API.
- [ ] Validate required explicit mode and synchronous predicate callback shape;
  snapshot the checked dependency tuple before descriptor callback reads.
- [ ] Validate own apiVersion/create fields, exact version1 and optional own
  callable dispose; preserve getter exceptions, ignore extra values and snapshot
  callbacks once without invoking them. Invalid descriptor errors have phase
  descriptor; invalid output errors have phase output and retain no rejected value.
- [ ] Adapt create to positional dependency values using existing reference slots
  with undefined receiver. Create an explicit raw/native source stage; declare
  optional source ownership before appending a synchronous predicate projection.
- [ ] Require predicate result exactlytrue; never assimilate a raw result or an
  unchecked validator result. Native uses an explicit validated final Promise;
  cache identity, readiness, pending acceptance and disposal stay in existing code.
- [ ] Preserve original factory/validator/native errors and once-only retirement
  cleanup on failed validation, including cleanup failures and startup rollback.
- [ ] Cover protocol/version/accessor preflight and snapshot mutation, all four
  dependency reference kinds, raw/native values, private module helpers, aliases,
  contribution collections, selected sharing and lifecycle observer attribution.
- [ ] Add exact inferred producer/consumer and strict negative fixtures preserving
  all graph/lifetime/ownership contracts and rejecting invalid mode/predicate/
  receiver/tuple/erased-provider claims. Keep unannotated extracted facade methods.
- [ ] Run focused runtime/type/native/source-removed declaration checks serially,
  self-review the actual diff, report RED/GREEN and commit only owned source/tests.

```ts
import { expect, test } from 'bun:test';
import { DiBag, DiBagPluginError } from '../src';

test('plugin validation retains raw source ownership on success and failure', async () => {
  const valid = { run: () => 42 };
  const invalid = { run: 42 };
  const disposed: unknown[] = [];
  const wrap = (value: unknown) => DiBag.fromPlugin([], {
    apiVersion: 1,
    create: () => value,
    dispose: (acquired: unknown) => { disposed.push(acquired); },
  }, {
    acquisition: 'raw',
    validate: (value: unknown): value is { run(): number } =>
      typeof value === 'object' && value !== null &&
      'run' in value && typeof value.run === 'function',
  });
  const good = DiBag.begin().add({ plugin: wrap(valid) }).end();
  expect(good.resolve('plugin')).toBe(valid);
  expect(good.resolve('plugin').run()).toBe(42);
  const bad = DiBag.begin().add({ plugin: wrap(invalid) }).end();
  expect(() => bad.resolve('plugin')).toThrow(DiBagPluginError);
  await Promise.all([good.close(), bad.close()]);
  expect(disposed).toHaveLength(2);
  expect(disposed).toContain(valid);
  expect(disposed).toContain(invalid);
});
```

Run `bun test tests/plugins.test.ts` first (expected missing API/error export RED).
Use controlled native source and disposer gates to prove validation readiness and
accepted cleanup independently; use a raw hostile thenable and never-settling raw
Promise to detect accidental assimilation. An unchecked async validator must fail
immediately as output validation, not return a Promise-valued service.

Implement through existing provider construction/transform bridges so metadata,
frames, contexts, lifetime graphs and original ownership retain one representation.
Any additional root type exports must be type-only and driven by actual inferred
physical producer errors. Do not add application-side casts or annotations to hide
lost inference. Run `bun test tests/types.test.ts -t plugins`, related runtime
tests and focused native/physical declarations; controller owns broad gates.

### Task 2: Physical plugin routes, example and P1 evidence

**Files:** create `tests/plugins-runtime-fixture.ts`, `examples/plugins.ts`;
modify `tests/box-contract-fixtures.ts`, `tests/package.test.ts`,
`tests/native-package.test.ts`, README, CHANGELOG,
`docs/migrations/0.1-to-enterprise.md` and enterprise tracker; create
`docs/reports/2026-09-08-dynamic-plugins.md`.

**Interfaces:** Consume Task1's fromPlugin API, DiBagPluginError and typed
producer/consumer/negative files. Produce one shared actual-archive assertion
string and a runnable unknown-plugin validation/cleanup example.

- [ ] Begin shared source assertions from the standalone case below and prove
  malformed descriptors reject before create effects, valid raw identity and
  original owned invalid-value cleanup. Add pending native validation/cleanup,
  optional/lazy/all host dependencies, private module/alias/sharing and observer
  identity. Exercise portable core without a classifier and each archive runtime.
- [ ] Wire shared plugin assertions beside observer assertions in both harnesses.
  Route plugins.ts, negative/plugins.ts and unannotated cts/mts producer/consumer
  declarations through both emitters, delete source and consume with both compilers.
  Preserve strict negative markers, root import routing and existing allowances.
- [ ] Document protocol/result validation, required predicate/explicit mode,
  unknown-code limits, descriptor snapshots, native validation Promise and original
  ownership before validation. Show typed module composition around the provider
  and an application-selected unknown descriptor in the runnable example.
- [ ] Run the actual `bun test tests/native-package.test.ts tests/package.test.ts`
  matrix serially after Task1 stabilizes. Obtain independent Task1/Task2 spec and
  quality verdicts plus whole-increment review, one consolidated correction and
  scoped re-review if needed.
- [ ] On stable reviewed source/harness run `npm run check`, native strict/build/
  source audit and all examples serially. Record complete exit statuses, precise
  counts, logs and limitations; mark P1 locally complete only after those gates.
- [ ] Locally commit verified evidence. Non-force push when export approval permits,
  verify remote SHA and do not publish. Compiler and release confidence work remain.

Use `DiBagPluginError.phase` in shared runtime assertions, require exact acquired
identity in disposers, and retain separately controlled gates for native source,
failed-validation cleanup and external observer work. Full verification must not
overlap another implementer's source/test/harness changes or compiler-heavy run.

```ts
export const pluginRuntimeAssertions = `
  {
    const value = { run: () => 42 };
    let released = 0;
    const provider = DiBag.fromPlugin([], {
      apiVersion: 1,
      create: () => value,
      dispose(acquired) {
        if (acquired !== value) throw new Error('plugin ownership changed');
        released++;
      },
    }, {
      acquisition: 'raw',
      validate: item => item === value,
    });
    const bag = DiBag.begin().add({ plugin: provider }).end();
    if (bag.resolve('plugin') !== value) throw new Error('plugin identity changed');
    await bag.close();
    if (released !== 1) throw new Error('plugin cleanup was not once-only');
  }
`;
```
