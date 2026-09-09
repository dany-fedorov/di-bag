# Incremental Dependency Checks Implementation Plan

Status: this implementation/measurement increment is complete and reviewed at
`9d09eef`; enterprise requirement T2 remains open. Evidence and the two explicitly
carried nonblocking review follow-ups are recorded in
`docs/reports/2026-09-07-incremental-checks.md` and the enterprise program tracker.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce repeated dependency checking without losing a supported contract, protect the improvement with compiler-work gates, and measure the original larger graph forms.

**Architecture:** Retain flat Entry history and check incoming/new-to-new/new-to-old/old-to-new relationships. Keep full retained module constraints and final closure. Reuse the existing compiler and isolated worker infrastructure; do not add a second provider graph representation.

**Tech Stack:** TypeScript 5.9.3, Node 24.20.0, Bun 1.4.0, existing package consumers.

**Spec:** `docs/superpowers/specs/2026-09-07-incremental-checks-design.md`.

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

Work in the existing approved `feat/v0.1` checkout. Dependencies already exist;
do not install or change versions. The controller separately has user authority
for non-force feature-branch pushes. Workers commit their own files but never
push, publish, merge, delete workspaces or dispatch subagents. This plan is a T2
increment: it does not waive larger scale/inference or any enterprise acceptance row.

## File boundaries

- `src/types.ts`, `src/di-bag.ts`: the only production algorithm/signature changes.
- `tests/compiler.ts`: preserve its host/options; expose the real Program for metrics.
- Existing `scripts/benchmark-types.ts`, `scripts/check-token-scale.ts`: metrics,
  then bounded named/token report execution. No extra worker or runtime dependency.
- `tests/incremental-scale.test.ts`: two isolated compiler-work regression gates.
- `tests/types/incremental.ts`, `tests/types/negative/incremental.ts`: exact public
  contracts and intentionally rejected inputs.
- `tests/types.test.ts`, `tests/box-package.test.ts`: source and actual installed
  CJS/ESM fixture routing. The latter already installs real di-bag/box archives.
- `tests/benchmark-types.test.ts`: report-boundary and CLI controls in Task2.
- `docs/reports/2026-09-07-incremental-checks.md`, `docs/benchmarks/typescript.md`:
  actual RED/GREEN, diagnostic, scale, package, review and limitation evidence.

### Task 1: Integrate incremental checking with compiler-work and contract gates

**Files:** Modify `src/types.ts`, `src/di-bag.ts`, `tests/compiler.ts`,
`scripts/benchmark-types.ts`, `scripts/check-token-scale.ts`, `tests/types.test.ts`,
`tests/box-package.test.ts`; create `tests/incremental-scale.test.ts`,
`tests/types/incremental.ts`, `tests/types/negative/incremental.ts`,
`docs/reports/2026-09-07-incremental-checks.md`.

**Interfaces:** Consume existing `Entry`, `From`, `Needs`, `Provided`, `Checked`,
`Unsatisfied`, `ProviderTokenNeeds` and `WrongToken`. Produce exported internal
`IncrementalChecked<E extends Entry, N extends Registrations>` in types.ts;
do not add a root export without demonstrated portability evidence/controller ruling.
Expose `compilerProgram(path: string, source?: string): ts.Program` from the test
helper, preserving exactly the existing compiler options and virtual source host.
Existing `diagnostics(path, source)` becomes `ts.getPreEmitDiagnostics(compilerProgram(path, source))`.
Both existing workers add `instantiations: program.getInstantiationCount()` after
collecting diagnostics; keep their existing JSON fields and CLI arguments intact.

- [x] **Step 1: Add measurable regression tests before the production change.**

Extract the existing diagnostics host construction into `compilerProgram` without
changing its behavior. In each worker use the resulting Program:

```ts
const program = compilerProgram(path, source);
const errors = ts.getPreEmitDiagnostics(program).map(describeDiagnostic);
const instantiations = program.getInstantiationCount();
```

Here `path`/`source` are the worker's existing scale path/source, not new graphs.
Add two isolated tests with the following complete cases and assertions:

```ts
const cases = [
  { name: '100 named additions', args: ['scripts/benchmark-types.ts', '--worker', '100', 'chained', 'valid'], ceiling: 1_500_000 },
  { name: '100 token bindings', args: ['scripts/check-token-scale.ts', 'bindings', 'valid'], ceiling: 2_000_000 },
] as const;
for (const item of cases) {
  test(`incremental compiler work: ${item.name}`, () => {
    const child = spawnSync('node', [
      '--max-old-space-size=3072', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', ...item.args,
    ], { cwd: resolve(__dirname, '..'), encoding: 'utf8', timeout: 60_000, maxBuffer: 1024 * 1024 });
    expect({ status: child.status, signal: child.signal, error: child.error?.message, stderr: child.stderr })
      .toEqual({ status: 0, signal: null, error: undefined, stderr: '' });
    expect(child.stdout.trim().length).toBeGreaterThan(0);
    const result = JSON.parse(child.stdout);
    expect(result.count).toBe(100);
    expect(result.scenario).toBe('valid');
    expect(result.form).toBe(item.args[0].includes('benchmark') ? 'chained' : 'bindings');
    expect(result.typescript).toBe('5.9.3');
    if ('diagnostics' in result) expect(result.diagnostics).toEqual([]);
    else { expect(result.accepted).toBe(true); expect(result.diagnosticCount).toBe(0); }
    expect(Number.isInteger(result.instantiations)).toBe(true);
    expect(result.instantiations).toBeGreaterThan(0);
    expect(result.instantiations).toBeLessThanOrEqual(item.ceiling);
  }, 65_000);
}
```

Import `spawnSync` from node:child_process, `resolve` from node:path and expect/test
from bun:test. Do not loosen the ceilings to accommodate the baseline. The compiler
is exactly pinned; a future upgrade must explicitly review these work counters.

- [x] **Step 2: Run RED and capture actual counts.**

Run `bun test tests/incremental-scale.test.ts` under approved execution.
Both real programs must have zero diagnostics but exceed the work ceilings on
the unchanged production checker (prior observations approximately 3.75M / 10.3M).
Record the actual failures. Empty child stdout, missing metrics or crashes are
harness failures, not the required RED. Do not modify production until this
baseline evidence exists. The current focused source baseline already passes.

- [x] **Step 3: Add explicit contract fixtures.**

The positive fixture imports DiBag and exact Assert/Equal helpers from existing
test paths. Include these public calls and exact assertions:

```ts
const forward = DiBag.begin().add({ read: ({ value }: { value: number }) => value })
  .add({ value: () => 1 }).end();
const forwardValue = forward.resolve('read');
type Forward = Assert<Equal<typeof forwardValue, number>>;
const key = Symbol('service');
const token = DiBag.token(key).of<{ value: number }>();
const same = DiBag.token(key).of<{ value: number }>();
const initial = DiBag.begin().add({ read: DiBag.fromTokens([same], value => value.value) })
  .bind(token, () => ({ value: 1, original: true as const }));
const replaced = initial.replace(token, () => ({ value: 2, richer: true as const })).end();
const actual = replaced.resolve(token);
type Rich = Assert<Equal<typeof actual, { value: number; richer: true }>>;
const feature = DiBag.module().add({ hidden: ({ external }: { external: number }) => external }).exports([]);
DiBag.begin().install(feature).add({ external: () => 1 }).replace('external', () => 2).end();
```

Also include this metadata/frames/G and explicit-generic control. Import
fromValBox from '../../src/val-box', ProviderGraph from '../../src/provider', and
ProviderMetadata/ProviderAcquisitionMetadata/ValBoxFrame/TokenGraph from the root.
Preserve the existing replacement-context fixture's supported method-return calls.

```ts
const frameSource = DiBag.withMetadata(DiBag.fromTokens([token], value => ({
  snapshot: () => ({ value: { present: true as const, value: Promise.resolve(value.value) },
    metadata: { present: true as const, value: { stage: 'framed' as const } }, alias: null }),
})), { owner: 'fixture' as const });
const framed = fromValBox(frameSource);
const framedBag = DiBag.begin().add({ framed }).bind(token, () => ({ value: 1 }))
  .replace('framed', framed).end();
const framedValue = framedBag.resolve('framed');
const inspection = framedBag.inspect('framed');
type Frames = [Assert<Equal<typeof framedValue, Promise<number>>>,
  Assert<Equal<ProviderGraph<typeof framed>, TokenGraph<readonly [typeof token]>>>,
  Assert<Equal<typeof inspection.metadata, ProviderMetadata<typeof framed>>>,
  Assert<Equal<ProviderAcquisitionMetadata<typeof framed>, readonly [ValBoxFrame<{ stage: 'framed' }>]>>];
const numberFactory = () => 2;
DiBag.begin().add({ value: () => 1 }).replace<'value', typeof numberFactory>('value', numberFactory).end();
```

The negative fixture uses adjacent `// diagnostic:` markers. Include each of these
distinct scenarios as a separate public expression, with valid callback bodies:

```ts
// diagnostic: a dependency has the wrong shape
DiBag.begin().add({ read: ({ value }: { value: number }) => value }).add({ value: () => 'wrong' });
// diagnostic: a dependency has the wrong shape
DiBag.begin().add({ value: () => 'wrong' }).add({ read: ({ value }: { value: number }) => value });
// diagnostic: a dependency has the wrong shape
DiBag.begin().add({ value: () => 1, read: ({ value }: { value: string }) => value });
// diagnostic: a dependency has the wrong shape
DiBag.begin().add({ value: () => 1, read: ({ value }: { value: number }) => value }).replace('value', () => 'wrong');
// diagnostic: a dependency has the wrong shape
DiBag.begin().add({ value: () => 1, read: ({ value }: { value: number }) => value }).replace('read', ({ value }: { value: string }) => value);
const key = Symbol('value'); const token = DiBag.token(key).of<number>(); const wider = DiBag.token(key).of<number | string>();
// diagnostic: incompatible or opaque
DiBag.begin().add({ read: DiBag.fromTokens([wider], value => value) }).bind(token, () => 1);
// diagnostic: incompatible or opaque
DiBag.begin().bind(token, () => 1).add({ read: DiBag.fromTokens([wider], value => value) });
// diagnostic: incompatible or opaque
DiBag.begin().bind(token, () => 1).add({ read: () => 1 }).replace('read', DiBag.fromTokens([wider], value => value));
// diagnostic: output is not assignable
DiBag.begin().bind(token, () => 1).replace(token, () => 'wrong');
// diagnostic: a dependency has the wrong shape
DiBag.begin().add({ value: () => 1 }).bind(token, ({ value }: { value: string }) => value.length);
// diagnostic: missing factories
DiBag.begin().add({ read: DiBag.fromTokens([token], value => value) }).end();
declare const opaque: Provider<() => number, {}, readonly [], OpaqueGraph>;
// diagnostic: incompatible or opaque
DiBag.begin().add({ opaque });
declare const opaqueBound: Provider<() => number, {}, readonly [], TokenGraph<readonly [], TokenBase>>;
// diagnostic: incompatible or opaque
DiBag.begin().add({ opaqueBound });
const privateModule = DiBag.module().add({ hidden: ({ external }: { external: number }) => external }).exports([]);
// diagnostic: a dependency has the wrong shape
DiBag.begin().install(privateModule).add({ external: () => 'wrong' });
// diagnostic: a dependency has the wrong shape
DiBag.begin().install(privateModule).add({ external: () => 1 }).replace('external', () => 'wrong');
// diagnostic: missing factories
DiBag.begin().install(privateModule).end();
const privateToken = DiBag.module().add({ hidden: DiBag.fromTokens([wider], value => value) }).exports([]);
// diagnostic: a dependency has the wrong shape
DiBag.begin().install(privateToken).bind(token, () => 1);
```

Import Provider/TokenGraph from the public root, and OpaqueGraph/TokenBase from
their existing internal type modules as current opaque fixtures do. Installed
fixtures must route these exact type edges to installed declarations, not mix
local source types into the installed public API. Add these simultaneous-error
controls. The second intentionally changes which useful error is selected:
capture its baseline diagnostic as semantic RED before adoption rather than
claiming every new negative already passes.

```ts
// diagnostic: incompatible or opaque
DiBag.begin().add({ read: ({ value }: { value: number }) => value }).add({ opaque, value: () => 'wrong' });
// diagnostic: a dependency has the wrong shape
DiBag.begin().bind(token, () => 1).add({ local: () => 1,
  invalidNamed: ({ local }: { local: string }) => local.length,
  wrongToken: DiBag.fromTokens([wider], value => value) });
```

Add the positive fixture to `tests/types.test.ts`; its negative file is discovered
automatically. Add both to the real installed commonjs/module fixture list in
`tests/box-package.test.ts`, using that runner's existing import redirection.
Record contracts that already pass before the optimization honestly as coverage.

- [x] **Step 4: Implement exactly the directional checks and five replacements.**

Add imports for ProviderTokenNeeds and WrongToken and the following types:

```ts
type NewWrong<E extends Entry, N extends Registrations> = {
  [K in keyof N]: Pick<Provided<From<E>>, Exclude<keyof Needs<N[K]>, keyof N> & E['key']> extends
    Pick<Needs<N[K]>, Exclude<keyof Needs<N[K]>, keyof N> & E['key']> ? never : K
}[keyof N];
type OldWrong<E extends Entry, N extends Registrations> = E extends Entry
  ? E['key'] extends keyof N ? never
    : Pick<Provided<N>, keyof Needs<E['registration']> & keyof N> extends
      Pick<Needs<E['registration']>, keyof Needs<E['registration']> & keyof N> ? never : E['key']
  : never;
type NewTokenWrong<E extends Entry, N extends Registrations> = {
  [K in keyof N]: WrongToken<ProviderTokenNeeds<N[K]>, From<Exclude<E, { key: keyof N }>>>
}[keyof N];
type OldTokenWrong<E extends Entry, N extends Registrations> = E extends Entry
  ? E['key'] extends keyof N ? never : WrongToken<ProviderTokenNeeds<E['registration']>, N>
  : never;
export type IncrementalChecked<E extends Entry, N extends Registrations> = unknown extends Checked<N>
  ? [NewTokenWrong<E, N> | OldTokenWrong<E, N>] extends [never]
    ? [NewWrong<E, N> | OldWrong<E, N>] extends [never] ? unknown
      : Unsatisfied<'a dependency has the wrong shape', { tokens: NewWrong<E, N> | OldWrong<E, N> }>
    : Unsatisfied<'token dependency has an incompatible or opaque contract', { tokens: NewTokenWrong<E, N> | OldTokenWrong<E, N> }>
  : Checked<N>;
```

In src/di-bag.ts import IncrementalChecked and replace these operands only:

| Existing | Replacement | Count |
| --- | --- | ---: |
| `Checked<Merge<From<E>, N>>` | `IncrementalChecked<E, N>` | 1 |
| `Checked<Merge<From<E>, Record<K, NoInfer<V>>>>` | `IncrementalChecked<E, Record<K, NoInfer<V>>>` | 2 |
| `Checked<Merge<From<E>, Record<TokenKey<T>, Binding<NoInfer<T>, NoInfer<V>>>>>` | `IncrementalChecked<E, Record<TokenKey<T>, Binding<NoInfer<T>, NoInfer<V>>>>` | 2 |

No other public inference input, return, contextual type, key admission, C/G
validation, runtime body, module/install/fork or closure changes. Explain the
accepted-history invariant and incoming-first error precedence in short comments.
Escalate a demonstrated contract conflict rather than silently broadening this code.

- [x] **Step 5: Verify, report and commit.**

Run `bun test tests/incremental-scale.test.ts`; require both work gates GREEN.
Run `bun test tests/types.test.ts tests/box-package.test.ts tests/token-package.test.ts`
for full source/installed contracts and unchanged inferred feature declaration
emission. Iterate with only failing focused fixtures. Run full `npm run check`
once when ready, all four examples and diffcheck; report actual counts and any
remaining limits. No restricted empty child output is success; use approved
execution. Commit `perf: validate changed dependency relationships incrementally`.

### Task 2: Publish bounded current large-graph evidence without hiding failures

**Amendment:** Close the demonstrated root-builder view erasure before complete
matrices. This replaces the original no-production-change restriction only for
the existing phantom member; checker algorithms and method signatures stay fixed.

**Files:** Modify `scripts/benchmark-types.ts`, `scripts/check-token-scale.ts`,
`tests/compiler.ts`, `docs/benchmarks/typescript.md`,
`docs/reports/2026-09-07-incremental-checks.md`, `src/di-bag.ts`,
`tests/types.test.ts`, `tests/box-package.test.ts`,
`docs/migrations/0.1-to-enterprise.md`; create `tests/benchmark-types.test.ts`,
`tests/types/builder-views.ts`, `tests/types/negative/builder-views.ts`.

**Interfaces:** Consume Task1's compilerProgram and worker instantiation field.
Keep `npm run benchmark:types` as the original 36 named cases. Add the explicit
`--tokens` report mode for 18 token cases: 100/500/1000 × bindings/modules ×
valid/missing-final-token/mismatched-invariant-service. Keep old token worker
arguments `form scenario`; permit an optional third count argument defaulting to
100, validated against exactly 100,500,1000. No production algorithm changes.
Root Builder's phantom contract becomes invariant in readonly [E, C]; no other
class marker changes. Use existing source/installed fixture routing.

- [x] **Prerequisite A: Add view-contract fixtures and record genuine RED.**

The negative fixture imports DiBag and Bag from '../../../src'. The first two
assignments currently compile; RED must show their missing expected diagnostics,
not an unrelated syntax error:

```ts
const empty = DiBag.begin();
const actual = empty.add({ value: () => 1,
  read: ({ value }: { value: number }) => value.toFixed() });
const erasedAdd = empty.add<{ value: () => number; read: () => string }>;
const widenedAdd = empty.add<{ value: () => number | string;
  read: (deps: { value: number }) => string }>;
// diagnostic: not assignable
const erased: ReturnType<typeof erasedAdd> = actual;
// diagnostic: not assignable
const widened: ReturnType<typeof widenedAdd> = actual;
// Already-rejecting neighborhood controls, not new bug claims.
// diagnostic: not assignable
const erasedBag: Bag<{ value: () => number | string; read: () => string }> = actual.end();
const emptyModule = DiBag.module();
const actualModule = emptyModule.add({ value: () => 1,
  read: ({ value }: { value: number }) => value.toFixed() });
const erasedModuleAdd = emptyModule.add<{ value: () => number; read: () => string }>;
// diagnostic: not assignable
const erasedModule: ReturnType<typeof erasedModuleAdd> = actualModule;
```

The positive fixture imports DiBag from '../../src' and Assert/Equal from './assert'. Preserve
exact contracts, identity and equivalent histories:

```ts
const registrations = { value: () => 1,
  read: ({ value }: { value: number }) => value.toFixed() };
const original = DiBag.begin().add(registrations);
const same: typeof original = DiBag.begin().add(registrations);
const individual: typeof original = DiBag.begin()
  .add({ value: registrations.value }).add({ read: registrations.read });
const identity = <B,>(builder: B): B => builder;
const retained: typeof original = identity(original);
const result = retained.add({ extra: async () => true }).end();
const text = result.resolve('read');
const promised = result.resolve('extra');
type Exact = [Assert<Equal<typeof text, string>>,
  Assert<Equal<typeof promised, Promise<boolean>>>];
void [same, individual];
```

Register the positive fixture in tests/types.test.ts with the same zero-diagnostic
expectation as neighboring positives. Negative discovery is automatic. Add both
to the actual installed CJS/ESM list in tests/box-package.test.ts; its redirects
already support these imports. Run
`bun test tests/types.test.ts --test-name-pattern builder` before production
changes and retain the missing-diagnostic failure.

- [x] **Prerequisite B: Integrate the one-member guard and verify compatibility.**

In root Builder only, replace
`declare readonly [constraintInvariant]: (value: C) => C;` with:

```ts
// Preserve accepted registration history and module constraints through views.
declare readonly [constraintInvariant]:
  (value: readonly [E, C]) => readonly [E, C];
```

Do not change Bag's same-named member, ModuleBuilder, the existing symbol,
runtime code, overloads or checker helpers. No new exports without actual
portability RED and a controller ruling. Run the focused builder fixture GREEN,
then `bun test tests/types.test.ts tests/box-package.test.ts tests/token-package.test.ts tests/incremental-scale.test.ts`.
Retain existing contracts and ceilings. If an equivalent-contract assignment or
supported fixture fails, report the exact failure before broadening the correction.
Document the cast-free counterexample, its pre-existing nature and stricter
annotations in docs/migrations/0.1-to-enterprise.md and the incremental report.
Recommend inferred/exact builder types, not casts. Record actual new compiler-work
counts; older counts remain historical. No runtime implementation change is needed.

- [x] **Step 1: Add report-boundary and CLI tests.**

Add `scaleBoundaryLine(source: string, count: number, form: ScaleForm, scenario: ScaleCase)`
to the existing compiler helper. Use the graph's actual starting line and original
source layout, not arbitrary any-error acceptance:

```ts
export function scaleBoundaryLine(source: string, count: number, form: ScaleForm, scenario: ScaleCase) {
  if (scenario === 'valid') return undefined;
  const graphLine = source.split('\n').findIndex(line => line.startsWith('const bag =')) + 1;
  if (graphLine === 0) throw new Error('missing generated graph boundary');
  if (scenario === 'missing' || form === 'bulk') return graphLine;
  const changed = Math.floor(count / 2);
  return graphLine + (form === 'chained' ? changed : form === 'grouped' ? Math.floor(changed / 50) : count - 1 + changed);
}
```

For each named form at100 and each negative scenario, compile the actual source
and assert a single diagnostic has both this boundary and the intended message;
reject TS2589 or diagnostics from other files. Validate formulas against actual
diagnostics before adoption; if an overload reports the replacement key/callback
on a different legitimate line, fix the boundary mapping with that evidence,
not the graph or message requirement. Valid reports require zero diagnostics.
CLI tests launch the token worker with valid default100 and reject extra args,
count0/count101 and invalid forms/scenarios with nonzero exit before compilation.
Do not run large matrices inside unit tests.

- [x] **Step 2: Extend existing report runners and retain strict child evidence.**

The token worker validates optional count and passes it to tokenScaleSource;
its existing boundary mapper and all JSON fields remain. The named worker emits
boundaryLine from scaleBoundaryLine and its complete diagnostics array, retaining
all previous summary fields. For every report child:

```ts
const child = spawnSync('node', [
  '--max-old-space-size=3072', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', ...workerArgs,
], { encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024 });
const completed = child.status === 0 && child.signal === null && child.error === undefined
  && child.stderr === '' && child.stdout.trim().length > 0;
```

Choose named workerArgs from the existing script's --worker form; --tokens uses
the adjacent check-token-scale.ts plus form,scenario,count. Confirm parsed case
identity, catch malformed JSON as a failed measurement and retain child error/
stderr/signal. For negative acceptance require no TS2589 and one diagnostic with
both intended message and boundaryLine in the generated file; for valid require
zero diagnostics. Named messages are missing factories/wrong shape; token-bind
invariant mismatch uses incompatible/opaque, token-module mismatch uses wrong
shape. Keep complete diagnostics in worker JSON; the report may summarize the
first diagnostic and codes with full artifact output retained. Never count OOM,
timeout or missing JSON as a type rejection. Print an explicit cases/accepted/
failures summary for each matrix; report completion is not all-gates-passed.

- [x] **Step 3: Verify the harness and execute the actual larger matrices.**

Run `bun test tests/benchmark-types.test.ts tests/incremental-scale.test.ts tests/token-scale.test.ts`
and strict typecheck/build. Then run `npm run benchmark:types` and
`npm run benchmark:types -- --tokens` under approved execution, retaining full
JSON-line artifacts in the plan workspace. Each worker is bounded; do not run
the two high-memory matrices in parallel. Communicate progress between bounded
waits. Exact time/RSS are single observations, not stable editor guarantees.

- [x] **Step 4: Document actual results and commit.**

Append current tables and command/version/commit evidence to the benchmark and
incremental report; retain historical pre-change tables explicitly as history.
List every failed form/count/scenario and its real cause. Preserve original
1000-fluent failures; no changed stack, alternate statement syntax, batching,
reduced counts or erased types may silently replace a requested case. A remaining
failure drives the next required T2 change, not a completion claim. Record source,
emitted/installed and full Task1 evidence plus this task's covering runs. Run full
`npm run check` once after the final harness changes, all examples and diffcheck.
Commit the guard/tests/migration as
`fix(types): retain builder history through structural views`, and the harness/
matrix report as `test: measure current named and token compiler scaling`.
Both belong to this task's recorded BASE..HEAD review; do not drop either.
Retain existing partial harness work while integrating the prerequisite, but
run the complete matrices on the corrected source. Do not stage controller-owned
files. One full check after final code changes covers this task, not one per commit.

## Coverage self-review and handoff

Task1 supplies all production changes, baseline/GREEN compiler-work evidence,
directional/opaque/simultaneous-error contracts and real installed consumption.
Task2 supplies strict report boundaries and both original large-size matrices.
Both retain exact outputs and all existing semantic gates. Whole-branch final
review remains required at the end of this plan, with the SDD single final-fix
wave rule. Failures in larger shapes remain explicit T2 obligations, as do both
known inline inference cases and all uncompleted enterprise rows.
