# Type Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make di-bag's supported registration and override operations honest
under structural typing, preserve precise inference, and remove the current
moderate-size chained-builder compiler failure.

**Architecture:** Use duplicate-rejecting bulk introduction, explicit
single-key replacement, and explicitly selected fork overrides. Keep disposal
metadata behind nominal handles. Accumulate registration entries as a flat
union and reconstruct map views only at validation/resolution boundaries.

**Tech Stack:** TypeScript 5.9.3, Bun tests, strict in-memory TypeScript compiler
fixtures, ES2022 package consumers.

**Spec:** `docs/superpowers/specs/2026-09-06-enterprise-di-design.md`.

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

## Scope and layout

Work in `/home/df/wd/personal/di-bag` on the existing feature branch, not the box
checkouts. The existing runtime remains the reference for acquisition and
cleanup semantics; this plan does not add new lifetimes or startup behavior.
Keep factory registrations in `src/registration.ts`, type algebra in
`src/types.ts`, runtime/builders in `src/di-bag.ts`, exports in `src/index.ts`.
Extract `src/builder.ts` only if it materially separates the accumulating type
model from the lifecycle runtime; do not create circular runtime imports.

### Task 1: Registration and override boundaries

**Files:**
- Modify: `src/registration.ts`, `src/types.ts`, `src/di-bag.ts`, `src/index.ts`.
- Modify: `tests/runtime.test.ts`, `tests/disposal.test.ts`, `tests/types.test.ts`, `tests/package.test.ts`, existing fork/replacement fixtures in `tests/types/`.
- Modify: `examples/wbs-scope.ts`, `README.md`.
- Create: `tests/boundaries.test.ts`, `tests/types/negative/required-this.ts`, `tests/types/negative/spread-disposal.ts`, `tests/types/negative/duplicate-add.ts`, `tests/types/negative/union-replace.ts`, `tests/types/negative/fork-selection.ts`, `tests/types/boundaries.ts`, `docs/migrations/0.1-to-enterprise.md`.

**Interfaces:**
- `Factory = (this: void, deps: never) => unknown`.
- `DiBag.begin().add(map)` introduces new keys only. Reject visible duplicates
  statically and all actual duplicate own keys at runtime, atomically before
  changing any builder. Keep finite plain string-keyed maps and forward refs.
- `builder.replace(key, registration)` replaces exactly one existing singleton
  string-literal key. Reject union/widened/template keys; validate the entire
  resulting declared graph. It can change the provided type when existing
  consumers remain compatible, as the previous builder replacement did.
- `bag.fork()` creates a fresh equivalent bag.
- `bag.fork(keys, overrides)` replaces exactly selected own keys; infer keys as
  a const finite tuple. Reject widened arrays, variadic tuples, optional tuple
  entries, and union-valued tuple entries because they cannot prove the exact
  runtime set. Only selected overrides participate in static checks and result
  types. Every selected key must already exist in the bag and be an own property
  of overrides. The override value must preserve the original service contract.
- Remove the old one-map fork overload; its hidden-key behavior is unsound.
- `withDisposal(create, dispose)` returns a frozen nominal handle. Its public
  type preserves create's exact F, but spreading it loses assignability to a
  registration. Store create/dispose normalization metadata privately; runtime
  clone/forgery rejection complements static nominal identity.
- Unchecked Bag construction is not publicly available through source/package
  value exports. Export the Bag type while creating runtime bags internally.

- [ ] **Step 1: Capture the accepted unsound cases before implementation.**

Use current one-map fork syntax for the initial reproduction, recording zero
compiler diagnostics and the wrong runtime type. Then write the selected-key
acceptance test that fails because the safe overload does not yet exist:

```ts
const root = DiBag.begin().add({ a: () => 1, b: () => 2 }).end();
const actual = { a: () => 3, b: () => 'wrong' };
const narrowed: { a: () => number } = actual;
const child = root.fork(['a'], narrowed);
const b: number = child.resolve('b');
expect(b).toBe(2);
```

Add the analogous hidden duplicate `.add(narrowed)` runtime test: it must throw
without modifying the original builder. Hidden entirely new keys cannot later
replace a visible registration silently; that later duplicate addition throws.
Also reproduce a spread-modified disposal descriptor whose new create returns
a string while its old disposer calls number.toFixed, and a factory with
`this: { value: number }` that dereferences its missing receiver. Turn these into
strict no-any/no-cast negative fixtures; diagnostic assertions must name the
actual violated contract rather than merely accept any compiler error.

- [ ] **Step 2: Implement nominal disposal and explicit receiver contract.**

Keep the disposer inference gate `Awaited<ReturnType<NoInfer<F>>>`. Use a
non-exported class with a private nominal member for the handle, expose its
exact `create: F` as readonly, and keep erased disposer metadata in a private
WeakMap. A public generic disposer field is not required and would complicate
registration variance. Freeze handles and reject objects absent from the
private registry during normalization.

```ts
type Factory = (this: void, deps: never) => unknown;
// A private member is lost on object spread; an enumerable symbol is not.
class Owned<F extends Factory> {
  declare private readonly nominal: void;
  constructor(readonly create: F) {}
}
```

Preserve direct plain factories and owned fulfilled values. Test valid owned
sync/async services, independent child ownership, and callback error behavior.

- [ ] **Step 3: Implement introduction, replacement, and selected overrides.**

Use own-property checks and an own-entry snapshot before applying registrations.
Bulk add first checks all actual keys for duplicates and input validity; no
hidden key can alter an existing service. `replace` only writes its explicit
key. Fork constructs selected entries from the key tuple, never spreads the
entire override object. Extra unselected keys are ignored without invoking
their getters. Missing selected own keys fail before creating a child.

```ts
for (const key of selectedKeys) {
  if (!Object.hasOwn(overrides, key)) throw new Error(`missing override: ${key}`);
  selected[key] = overrides[key];
}
```

Implement named type diagnostics for duplicate additions and invalid key
selections. Test single-key replacement of an unknown key, union/widened key
rejection, selected override mismatch, missing dependency, and const selection
inference with method-returning factories. Preserve finite-key, union-parameter,
primitive-map, forward mismatch, and exact Promise negative cases.

- [ ] **Step 4: Migrate usages without dropping their original assertions.**

Every supported old `.fork({ x, y })` becomes `.fork(['x', 'y'], { x, y })`;
empty forks become `.fork()`. Builder replacement fixtures use
`.replace('key', factory)`. Keep their shape/totality/method-inference assertions
and expected runtime values. WBS keeps all explicit root borrowing and fresh
scoped resources. README explains the structural-typing reason and shows both
fork selection and replacement. Migration doc gives before/after examples and
states that dependency parameter annotations remain single-source declarations.

- [ ] **Step 5: Verify, review, and commit.**

Run focused boundary/runtime/type tests, then `npm run check` and
`npm run example:wbs`. Inspect emitted declarations for constructibility and
inference regressions through the public package tests. Commit task paths only
as `fix: enforce sound registration and override boundaries`; do not push.
The report must include RED/GREEN evidence and exact migration coverage.

### Task 2: Flat accumulation and compiler-scale acceptance

**Files:**
- Modify: `src/types.ts`, `src/di-bag.ts`, `src/builder.ts` if introduced in Task 1, `tests/types.test.ts`, `package.json`, `README.md`.
- Create: `tests/type-scale.test.ts`, `tests/compiler.ts`, `scripts/benchmark-types.ts`, `docs/benchmarks/typescript.md`.

**Interfaces:**
- Runtime/public behavior from Task 1 does not change.
- Internally accumulate entries with a flat union rather than recursive
  Omit/intersection chains. Exported Bag<R> retains a map-shaped generic.
- Generated source must use real public API calls and consumer assignments;
  no assertions or any that erase checking. Measure negative cases too.
- Test gates cover 100 chained additions and 100 replacements plus 1000
  providers composed from reusable groups without TS2589. Benchmark 100/500/1000
  bulk, chained, and modular forms, report any remaining failure explicitly,
  and continue improving failing forms before the enterprise program is done.

- [ ] **Step 1: Make the current chain-depth failure executable.**

Generate dependency chains in an in-memory strict TypeScript program:

```ts
const entries = Array.from({ length: count }, (_, index) => index === 0
  ? 'svc0: () => 1'
  : `svc${index}: ({svc${index - 1}}: {svc${index - 1}: number}) => svc${index - 1} + 1`);
const chain = entries.map(entry => `.add({${entry}})`).join('');
const source = `import { DiBag } from '../src';
  const bag = DiBag.begin()${chain}.end();
  const result: number = bag.resolve('svc${count - 1}');`;
```

Compiler helper supplies a virtual filename with correct relative imports;
test diagnostics including compiler-code and file locations. Confirm 100 chained
adds fail on the old accumulation while 100 bulk entries succeed. Also generate
a missing final dependency and a wrong-shaped intermediate dependency: both
must fail for the intended reason at scale, not pass through widening.

- [ ] **Step 2: Materialize registration entries.**

The read-only feasibility probe succeeded at 250 entries with this model:

```ts
type Entry = { key: string; registration: Registration };
type Entries<R extends Registrations> = {
  [K in keyof R & string]: { key: K; registration: R[K] }
}[keyof R & string];
type From<E extends Entry> = {
  [P in E as P['key']]: P['registration']
};
// add result: Builder<E | Entries<N>>
// replace result: Builder<Exclude<E, { key: K }> | { key: K; registration: F }>
```

Use reconstructed map views for Checked, Complete, Provided, and replacement
compatibility. Preserve self-mapped inference constraints for inline returned
methods. Do not add a public generic escape hatch that turns the scale test
green by discarding service/dependency information. Benchmark replacement-heavy
chains independently; flattening additions alone is not evidence about them.

- [ ] **Step 3: Exercise inference and collect reproducible evidence.**

Run 100/500/1000 sizes in bulk/chained/grouped forms; record TypeScript version,
Node/Bun versions, wall time, memory where available, and diagnostics. Use
separate process measurements for report comparisons so compiler caches/order
do not masquerade as improvements. No brittle timing threshold in unit tests;
the type acceptance gate is zero diagnostics for valid graphs and the intended
diagnostic for invalid ones. Document baseline and new results and retain a
single repeatable `npm run benchmark:types` command.

- [ ] **Step 4: Verify, review, and commit.**

Run `bun test tests/type-scale.test.ts tests/types.test.ts`, `npm run check`, and
the benchmark command. Verify exact returned method and Promise types still
pass emitted declarations. Commit as
`perf: flatten registration type accumulation and add scale gates`; do not push.
Record unsuccessful large forms as open program work, never as achieved gates.
