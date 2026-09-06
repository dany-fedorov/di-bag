# Typed Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add checked typed-symbol tokens, explicit injection, reusable module
boundaries and selected overrides on the existing ownership runtime.

**Architecture:** Nominal invariant token handles retain caller symbol identity
and service contracts. A fourth provider graph contract carries token requirements
and slot-specific bound-token evidence; module C/D preserve public/private proof.
Runtime symbol edges use existing binding and acquisition identities.

**Tech Stack:** TypeScript5.9.3, Bun tests, actual Node CJS/ESM package consumers.

**Spec:** `docs/superpowers/specs/2026-09-07-typed-tokens-design.md`, bound by
`docs/superpowers/specs/2026-09-06-enterprise-di-design.md`.

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

## Starting evidence and boundaries

Production fix6874760 and provider-plan final review are complete; checkpoint
23e300f is pushed. Design/evidence commit e26bb16 adds the token spec. Existing
native Promise observation, retirement and replacement-inference contracts remain
load-bearing. Do not reopen their completed review loops or adopt an earlier
rejected inline/fork inference workaround.

The token identity proof and corrected carrier model have independent source/
emitted evidence in the two typed-token investigation reports. A nested generic
resolve return exhausted the prototype heap; direct indexed output with unchanged
membership gates passed all29 negative locations. This is an implementation
constraint, not evidence that production fork/rename/scales already work.

Keep production's flat Entry history and export-time PublicProvider projection.
The prototype's registration intersections, install-time projection, delayed
shape checks and simplified named external view are NOT adopted.

## File responsibilities

- `src/tokens.ts`: genuine frozen token identity, checked capture, runtime key and
  tuple snapshots; token constructors remain unavailable as runtime exports.
- `src/token-types.ts`: key/service/tuple gates and provider graph contract types.
- `src/provider.ts`: graph-aware invariant handles/utilities, checked internal
  token-source and bound-slot factories; all transforms retain contracts.
- `src/provider-operations.ts`: immutable declared token keys on source descriptions.
- `src/types.ts`: flat string/symbol internal entries, named admission, graph
  checking and mixed explicit selections without changing ordinary factory needs.
- `src/module-types.ts`, `src/module.ts`: tagged retained constraints, public
  zero-needs views, token exports and installation-local private identities.
- `src/runtime.ts`, `src/acquisition.ts`: symbol slot routing through existing
  acquisitions, not separate caches or wrapper bags.
- `src/di-bag.ts`, `src/index.ts`: checked public APIs and type-only exports.
- `src/registration.ts`, `src/sas-box.ts`, `src/val-box.ts`: retain G through
  ownership and adapter transformations, without changing invocation semantics.
- `tests/tokens.test.ts`, `tests/token-modules.test.ts`: runtime token behavior.
- `tests/types/tokens.ts`, `tests/types/token-modules/`, negative fixtures:
  exact source contracts; existing package runners verify emitted consumers.
- `tests/token-package.test.ts`, `tests/token-scale.test.ts`: actual packaged
  interoperability and bounded token-specific compiler gates.

### Task 1: Token contracts and internal acquisition routing

**Files:** Create `src/tokens.ts`, `src/token-types.ts`, `tests/tokens.test.ts`,
`tests/types/token-contracts.ts`, `tests/types/negative/token-contracts.ts`.
Modify `src/provider.ts`, `src/provider-operations.ts`, `src/registration.ts`,
`src/sas-box.ts`, `src/val-box.ts`, `src/types.ts`, `src/runtime.ts`,
`src/acquisition.ts`, `src/module-types.ts`, `src/di-bag.ts`, `src/index.ts`,
`tests/types.test.ts`, `tests/package.test.ts` and `tests/box-package.test.ts`.

**Interfaces:**
- Expose `DiBag.token(key).of<Service>()`, type-only Token<K,S>, TokenKey<T>,
  TokenService<T> and ProviderTokenNeeds<R>. No unchecked token constructor.
- `readTokenKey(value: unknown): symbol` authenticates the original frozen handle
  through private storage; `snapshotTokens(value: unknown): readonly TokenBase[]`
  snapshots indexed tuple values and validates every handle before returning.
- Fourth `Provider<F,M,A,G>` contract defaults to the empty token contract:

```ts
type TokenGraph<T extends readonly TokenBase[] = readonly [], B extends TokenBase = never> = {
  readonly kind: 'tokens'; readonly required: T; readonly bound: B;
};
type OpaqueGraph = { readonly kind: 'opaque' };
type GraphContract = TokenGraph<readonly TokenBase[], TokenBase> | OpaqueGraph;
// Retain a function-valued invariant witness for [F,M,A,G].
```

- Internal checked `fromTokens(tuple, callback)` and `withTokenBinding(token,
  registration)` live in provider.ts, where genuine handles can be created
  without exporting a generic unchecked constructor. Task2 exposes fromTokens
  through DiBag and uses withTokenBinding in builders. The tuple adapter returns
  Provider<() => ReturnType<F>, Readonly<{}>, readonly [], TokenGraph<T>>; binding
  retains original F/M/A/required tokens and sets only the bound token contract.
- `ProviderTokenNeeds<R>` returns the required-token union; opaque returns an
  unprovable TokenBase, never an empty union. Factory/Owned defaults remain empty.
- Internal type utilities `ProviderGraph<R>` and `BoundToken<R>` extract the
  exact retained G and bound token respectively, or OpaqueGraph/TokenBase for
  erased contracts. Task2 consumes these names; no public runtime constructor
  or arbitrary caller-selected graph-contract assertion is introduced.
- Source operations gain frozen `tokenKeys: readonly symbol[]` (empty normally),
  retained by normalize and every transformation. Runtime `BindingKey` is
  `string | symbol`; BindingRef public keys and lexical maps use BindingKey.
- `BindingGraph.withPublicBinding(key, registration)` is the internal single-slot
  counterpart to existing named withPublicRegistrations. It rejects no valid
  symbol merely due to its description; public builders own duplicate policy.
- Until Task2 supplies token graph validation, existing public graph checks MUST
  reject registrations with nonempty or opaque token contracts. Internal helpers
  must not create an unchecked path through the existing named add/end API.

- [x] **Step 1: Add failing runtime and exact contract tests.**

```ts
test('token symbols participate in the same acquisition graph', async () => {
  const key = Symbol('resource');
  const resource = DiBag.token(key).of<{ read(): number }>();
  const disposed: string[] = [];
  const owned = DiBag.withDisposal(() => ({ read: () => 42 }), () => { disposed.push('resource'); });
  const use = DiBag.withDisposal(fromTokens([resource], value => ({ read: () => value.read() })),
    () => { disposed.push('consumer'); });
  const graph = new BindingGraph().withPublicBinding(key, owned)
    .withPublicRegistrations({ use });
  const runtime = new Runtime(graph);
  expect((runtime.resolve('use') as { read(): number }).read()).toBe(42);
  await runtime.close();
  expect(disposed).toEqual(['consumer', 'resource']);
});
```

The runtime assertion above is an internal unknown-value boundary, not a type
proof. Add cast-free source/emitted Equal assertions for exact token identities,
service invariance, F/M/A/G through all existing transforms and NoInfer mixed
unions. Cover actual distinct/equal symbols, frozen handles, spread/forgery,
broad/union/inline symbol admission, explicit generic erasure and default Provider
annotations. Add required receiver/too-many callback arguments, widened/optional/
union tuple rejection and exact Promise-valued callback arguments/output.
Runtime controls cover indexed snapshots/custom iterators, invalid handles before
factory side effects, token-to-named and named-to-token cycles, same cache reuse,
retry after rejection, post-await reads and undeclared well-known symbol reads
remaining undefined. Keep current source/owned cleanup and native boundaries.

- [x] **Step 2: Record RED before implementation.**

Run `bun test tests/tokens.test.ts` and focused source/emitted contract tests.
Separate missing API diagnostics from the runtime/type behavior being established.

- [x] **Step 3: Implement the immutable internal boundary.**

Use nominal TokenBase plus a declaration-retained invariant [K,S] property, a
readonly key, private WeakMap authentication and Object.freeze. Capture key in a
receiver-free of callback. Type tuple admission validates every index, not merely
T[number]. Do not parse descriptions or intern a global erased service mapping.
For runtime token-source creation, the checked helper performs this sequence:

```ts
const selected = snapshotTokens(tokens);
const tokenKeys = Object.freeze(selected.map(readTokenKey));
const create = (deps: Record<symbol, unknown>) => {
  const args = tokenKeys.map(key => Reflect.get(deps, key));
  return Reflect.apply(callback, undefined, args);
};
// Retain create and tokenKeys in one authenticated source description.
```

The actual helper signature proves the callback/tuple contract; internal erasure
for runtime invocation cannot be exposed as a generic unchecked public constructor.
Add declared-symbol routing at the dependency Proxy's existing permission/edge
boundary. A symbol not declared by that source still returns undefined. Use
String(key) in diagnostics so symbol errors do not throw accidental conversion
TypeErrors. Preserve every existing source tokenKeys field through descriptors.
Extend provider/context/metadata/frame extraction to G with opaque and NoInfer
guards. Preserve all existing exact callbacks, replacement overloads and plain
module defaults. Add the temporary nonempty-token graph rejection described above.

- [x] **Step 4: Verify and commit the internal foundation.**

Run covering runtime/source/emitted tests, full `npm run check`, all3 existing
examples and `git diff --check`. Record exact commands/counts and any changes
after the full run. Commit task-owned files as
`feat: add invariant token contracts and internal symbol routing`.

Completed at `1048e29`; initial task review is spec-compliant and Approved with no
findings. Full check:264tests/1560assertions, typecheck/build and all3examples.
Controller committed-state covering check:30tests/250assertions, strict builds and
all3examples. Evidence: `docs/reports/2026-09-07-typed-tokens.md`.

### Task 2: Checked root and module token composition

**Files:** Modify `src/token-types.ts`, `src/provider.ts`, `src/types.ts`,
`src/module-types.ts`, `src/module.ts`, `src/di-bag.ts`, `src/index.ts`,
`src/runtime.ts`, the Task1 contract fixtures, `tests/types.test.ts`,
`tests/package.test.ts` and `tests/box-package.test.ts`.
Create `tests/token-modules.test.ts`,
`tests/types/tokens.ts`, `tests/types/token-modules/feature.ts`,
`tests/types/token-modules/consumer.ts`, `tests/types/negative/tokens.ts`,
`tests/types/negative/token-modules.ts`; wire source and emitted package runners.

**Consumes:** Task1 genuine Token<K,S>, TokenGraph<T,B>, graph-aware Provider,
ProviderTokenNeeds, internal fromTokens/withTokenBinding, symbol-capable runtime.

**Produces:** DiBag.fromTokens; Builder/ModuleBuilder bind and token replace;
Bag token resolve/inspect; mixed name/token exports and fork selections. Preserve
Module<P,R,C,D> with tagged C and public D, no fifth Module generic.

- [x] **Step 1: Write failing cross-file and runtime composition tests.**

```ts
const databaseKey = Symbol('database');
const database = DiBag.token(databaseKey).of<{ read(): number }>();
const feature = DiBag.module()
  .bind(database, () => ({ read: () => 1 }))
  .add({ handler: DiBag.fromTokens([database], db => ({ run: () => db.read() })) })
  .exports([database, 'handler']);
const root = DiBag.begin().install(feature).end();
const child = root.fork([database], { [database.key]: () => ({ read: () => 9 }) });
expect(root.resolve('handler').run()).toBe(1);
expect(child.resolve('handler').run()).toBe(9);
await Promise.all([root.close(), child.close()]);
```

Also test two installations with private token bindings and renamed named
exports: distinct resources, no public private-token resolve, dependency-aware
cleanup. A private provider consuming an exported token must follow the public
slot; an external token requirement survives a token-free public output and
later ordinary add. Include the twice-installed inferred resolve regression.
Emit declarations for the cross-file feature fixture itself, then compile its
unchanged consumer against those generated declarations, not just against
di-bag's own emitted package types. This proves a feature-library author's
inferred token/module export can survive declaration emission, including symbols
and private requirements; an application-only noEmit run cannot prove that.
Assert exact richer outputs, Promise types, metadata/frames, default annotations,
same-symbol rewrap and named factory requirements on token-bound registrations.
Negative source/emitted calls must reject missing/distinct/incompatible tokens,
wrong bound outputs, duplicates, conflicting same-symbol declared services,
opaque G/C/D, selection unions/broad/optional tuples, hidden overrides, explicit
erasure, wrong selected-to-selected edges and missing replacement dependencies.

- [x] **Step 2: Record RED for public APIs and retained constraints.**

Run focused token runtime/source/emitted tests. Keep a no-cast missing-token
module example and its exact call location in the report; no arbitrary diagnostic
elsewhere may stand in for the intended rejection.

- [x] **Step 3: Implement graph checks and lexical module composition.**

Generalize internal Entry keys, but keep named add's separate finite string-key
gate. Validate every consumer's named needs and every required token's identity
AND invariant service against the slot's retained bound contract. Preserve
order-independent adds and shape feedback at the operation that introduces the
mismatch. Replace Task1's temporary rejection with real token checks and closure.

Retain C variants for named exported/external needs, token exported/external
requirements, and opaque/unprovable contracts. Do not filter C by consumer label
when replacing a slot. A module's satisfied private requirements do not become
host requirements. Apply public projection at EXPORT time:

```ts
// Conceptual contract of the public view, not its runtime implementation:
type ExportedTokenView<R extends Registration> = Provider<
  () => ProviderOutput<R>, RetainedMetadata<R>, ProviderAcquisitionMetadata<R>,
  TokenGraph<readonly [], BoundToken<R>>
>;
```

Define BoundToken<R> as the checked retained binding contract; opaque extraction
must remain opaque rather than matching the empty case. Preserve the existing
plain synthetic shortcut only when metadata, frames and bound/token contracts
are genuinely empty. ModuleProvides/Requires expose name/symbol views while C/D
retain proof. Named rename changes named export references only, not token keys.

Use genuine token selection to derive runtime symbols. The fork override object
uses computed token.key properties; read only selected own properties after
complete indexed-selection preflight. Keep original actual-output assignability
for forks and declared-service plus surviving-consumer checks for replacements.
No selection-key erasure through explicit generics. Use direct bounded indexed
output for resolve; retain the predeclared and explicit-generic baseline controls.
Public token bind/replace output checks must inspect actual R with NoInfer, not
just a separately widened selected output. Runtime source/binding descriptions
remain immutable, and private token IDs are fresh per installation.

- [x] **Step 4: Verify and commit public composition.**

Run all new source/emitted/runtime cases, full `npm run check`, all3 existing
examples and diff checks. Commit task-owned files as
`feat: compose typed tokens across bags and modules`.

Completed at `d58937c`; initial task review is spec-compliant and Approved, with
one deferred bulk-fork efficiency finding for the broad final review. Full check:
287tests/1812assertions, strict builds/all3examples. Two later fixture assertions
have covering source/emitted/installed checks; controller committed-state checks
passed45focused tests/472assertions plus all18token runtime tests/67assertions.
The producer declaration gate exposed TS4118 and now passes without caller casts
or annotations. Full evidence is in `docs/reports/2026-09-07-typed-tokens.md`.

### Task 3: Real-package token integration, compiler gates and documentation

**Files:** Create `tests/token-package.test.ts`, `tests/token-scale.test.ts`,
`scripts/check-token-scale.ts`, `examples/tokens.ts`; extend `tests/compiler.ts`.
Reuse `scripts/benchmark-types.ts`'s isolated Node compiler-worker pattern:
the existing `tests/type-scale.test.ts` gates run in-process, not in child workers.
Keep those existing tests unchanged. Update `README.md`,
`docs/migrations/0.1-to-enterprise.md`, and
`docs/reports/2026-09-07-typed-tokens.md`. Extend `tests/box-package.test.ts` using existing real
versioned fixtures; do not copy box implementations or add runtime dependencies.

**Consumes:** All Task2 public APIs, unchanged package exports and pinned real
box archives. **Produces:** actual cross-loader integration evidence, token
compiler controls and a runnable module/ownership example.

- [ ] **Step 1: Add real-package and bounded compiler controls.**

Build/install an actual local di-bag artifact using existing package-test setup.
In separate Node CJS and ESM consumers, create a token/provider through one loader
and bind/resolve through the other. Combine fromTokens with both real box adapters,
metadata/frames and explicit original-box cleanup. Check exact plain exposed
payload, raw Promise identity on sync paths, private module isolation and public
token overrides. Verify core-only consumers do not load either box package.
Compile emitted token-module consumers and all new negative fixtures in both modes.

Generate 100 individual token bindings and 100 distinct token modules with final
exact resolve assertions. Each form has valid, missing-final-token and mismatched
invariant-service cases; use actual public calls and caller const symbols, not
ambient synthetic graph aliases or widened registrations. A representative row is:

```ts
const key0 = Symbol('service0');
const token0 = DiBag.token(key0).of<number>();
const key1 = Symbol('service1');
const token1 = DiBag.token(key1).of<number>();
const graph = DiBag.begin().bind(token0, () => 1)
  .bind(token1, DiBag.fromTokens([token0], value => value + 1)).end();
const result: number = graph.resolve(token1);
```

The wrong-contract case must distinguish invariant declaration checking from
ordinary output assignability: for example, bind a number token and require the
same key rewrapped as number|string. The actual number output fits both service
types, but the incompatible declared token contracts must still reject. Keep the
callback body valid for its declared argument so its own error cannot stand in for
the graph-boundary rejection. Apply this control to both binding and module forms.

The new token worker imports source generation and diagnostic helpers from
`tests/compiler.ts`, accepts one validated form/scenario, and emits the actual
diagnostics, time and maximum RSS as JSON. `tests/token-scale.test.ts` invokes a
fresh Node child for each case using the benchmark's 60-second bound; it checks
successful process completion before judging the intended diagnostic positions.
Do not reinterpret the existing in-process gate's120-second test timeout as
process isolation or change that gate while adding token coverage. Require
intended negative locations, not OOM/timeout as rejection. Record time/memory and
keep existing named/grouped/module gates unchanged. These100-token gates do not
complete the program's larger T2/compiler-latency obligations.

- [ ] **Step 2: Run tests and distinguish RED from missing coverage.**

Record actual runtime/declaration failures separately from missing test wiring.
If a newly added integration already works, record that honest result instead of
inventing a failing runtime claim. Fix only demonstrated integration gaps.

- [ ] **Step 3: Add the runnable example and migration documentation.**

The example defines and exports canonical tokens, composes a module with a private
owned dependency, forks one exported token, resolves plain service values, and
closes both independent bags. Document token vs named dependency declarations,
invariant identity/service, explicit tuple injection, exact sync/Promise behavior,
bound provider reuse, private/public/external requirements, selected computed-key
overrides, Symbol.for runtime collisions and erased/dynamic boundaries. Explain
Provider's fourth contract/default compatibility and Module C/D retention. Do not
claim lifetime/startup/extensions or universal superiority are complete.
Correct the migration's old failed-attempt description: retirement abandons
incoming failed-caller edges while accepted outgoing ownership dependencies remain
available for ordered cleanup. Do not claim outgoing dependencies are all cleared.

- [ ] **Step 4: Verify, report and commit.**

Run full `npm run check`, all4 examples, real package consumers, token compiler
controls and diff checks. Record exact actual results and production limitations.
Commit `test: verify packaged token composition and document contracts`.

## Coverage self-review and handoff

Task1 supplies genuine identity, invariant retained contracts and shared runtime
routing without an unchecked intermediate public graph path. Task2 supplies every
public composition/module/selection contract. Task3 proves real package/box
interoperation and records bounded compiler evidence and runnable documentation.
All tasks retain existing named inference, cleanup/native boundaries and scale
gates. The full enterprise program remains active after this token increment.
