# Named Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compose reusable, typed, open modules with explicit public exports and
isolated private providers, preserving ordinary factories and bag ownership.

**Architecture:** Separate public lookup slots from physical provider bindings.
Each module installation gets fresh private binding identities inside the same
runtime graph. Public exports are lookup routes, not wrapper factories or nested
bags. The builder tracks exported types and every remaining module requirement.

**Tech Stack:** TypeScript 5.9.3, Bun tests, strict compiler fixtures, packaged
CommonJS/ESM consumers.

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

## Prerequisites and scope

Execute after `2026-09-06-type-foundations.md`. That increment supplies nominal
owned registrations, duplicate-rejecting additions, singleton-key replacement,
selected-key forks, and flat registration-entry accumulation. Preserve those
contracts. This plan implements the named-module portion of M1; typed symbol
tokens, explicit dependency adapters, and lifetime policies have separate
subsystem tasks in the enterprise program. Do not claim M1 complete here.

The two prerequisite tasks and their specified scale gates are complete. Its
final scoped review retained one explicit observer-setup obligation for this
runtime task: an own `then` override on a native Promise can synchronously run
an ownership callback and then throw. Task 1 must close that reviewed residual
before adding module behavior; it is not an accepted permanent limitation.

The runtime is still one cached acquisition per binding per independent bag.
Do not introduce child-scope sharing or transient policy during this plan.
Keep `fork()` a fresh independent root with no inherited acquisitions.

## File responsibilities

- `src/runtime.ts`: internal binding graph, acquisition, cycle detection, and
  cleanup. No public unchecked constructor export through the package.
- `src/di-bag.ts`: checked bag facade and immutable builder composition.
- `src/module.ts`: nominal module values, module builder, export/rename views,
  and internal installation metadata.
- `src/module-types.ts`: open requirement constraints, export maps, installation
  validation, and public module type utilities.
- `src/types.ts`: shared finite-map/key/tuple checks and registration algebra.
- `src/index.ts`: documented public API; internal registry access stays private.

If the prerequisite separated `src/builder.ts`, put host builder methods there
instead of duplicating a builder in `src/di-bag.ts`. Never make runtime imports
cycle among bag, builder, and module files.

### Task 1: Binding identities and public lookup slots

**Files:**
- Create: `src/runtime.ts`, `tests/binding-graph.test.ts`.
- Modify: `src/di-bag.ts`, `tests/runtime.test.ts`, `tests/disposal.test.ts`.

**Interfaces:**
- The checked public API and inferred result types do not change in this task.
- Preserve exception-safe failed acquisition rollback, and complete the
  prerequisite's observer-setup correction. Observe normalized promises through
  the trusted native Promise `then` intrinsic, not an own override on the
  returned Promise. Preserve the original exposed object/Promise identity.
  A native Promise's custom observer method must not commit ownership early,
  throw after callbacks, or mutate bookkeeping belonging to a later retry.
- Runtime accepts an immutable graph description separating public keys from
  binding IDs. Binding descriptions retain the normalized registration and a
  local-name lookup table; each bag owns its own mutable acquisition state.
- Missing local-name mappings fall back to the graph's public slot of that
  name. Explicit mappings distinguish private direct bindings and public slots.
- IDs are opaque runtime symbols, not guessed string prefixes. Display labels
  are separate from identity and must not determine cache keys.

```ts
type BindingId = symbol;
type BindingRef =
  | { readonly kind: 'private'; readonly id: BindingId }
  | { readonly kind: 'public'; readonly key: string };

interface BindingDescription {
  readonly id: BindingId;
  readonly label: string;
  readonly registration: Registration;
  readonly localNames: ReadonlyMap<string, BindingRef>;
}

interface GraphDescription {
  readonly bindings: ReadonlyMap<BindingId, BindingDescription>;
  readonly publicSlots: ReadonlyMap<string, BindingId>;
}
```

The implementation may encapsulate these maps in an internal class to avoid
claiming that `Object.freeze(new Map())` prevents mutation. Never expose mutable
description maps or acquisition records through the public facade.

- [ ] **Step 0: Close the carried observer-setup residual with a regression.**

The existing runtime invokes an overridden native-Promise `then` directly.
This strict no-cast case currently throws after registering cleanup, violating
the failed-setup ownership contract. Protect the real fulfilled resource and
assert that observing it does not invoke the custom method:

```ts
const resource = { id: 'real' };
const original = Promise.resolve(resource);
const disposed: typeof resource[] = [];
let customThenCalled = false;
original.then = (fulfilled) => {
  customThenCalled = true;
  fulfilled?.({ id: 'not-the-fulfilled-resource' });
  throw new Error('custom then');
};
const bag = DiBag.begin().add({
  resource: DiBag.withDisposal(() => original, value => { disposed.push(value); }),
}).end();
expect(bag.resolve('resource')).toBe(original);
await bag.close();
expect(customThenCalled).toBe(false);
expect(disposed).toHaveLength(1);
expect(disposed[0]).toBe(resource);
```

Run the focused test to record RED. Normalize with `Promise.resolve(value)`
inside the existing exception boundary and attach bookkeeping using the native
intrinsic, capturing it in the runtime module. One typed formulation is:

```ts
const observePromise = Promise.prototype.then<void, void>;
// Native reactions run asynchronously; an own then override is not the observer.
const observed = observePromise.call(Promise.resolve(value), onFulfilled, onRejected);
```

Retain constructor/then-getter setup-failure rollback and error identity. Add a
structural PromiseLike that calls its fulfillment handler and then throws:
native promise assimilation must accept its first settlement and dispose the
actual fulfilled value once. Keep rejected-thenable retry and pending-close
regressions. This is an internal observation correction, not a new public
raw-ownership API. Run runtime/disposal tests GREEN before extracting the graph.

- [ ] **Step 1: Write failing internal graph tests and run them.**

Create two private `connection` bindings with distinct symbol IDs. Give two
public services different local-name maps. Assert each gets its own connection,
memoized identity is per binding, and private names cannot resolve publicly.
Include one explicit public alias mapping and verify that it reaches the same
acquisition as direct public resolution, without acquiring twice.

```ts
// Use the internal graph constructor, not a public unchecked Bag constructor.
// Factories close over distinct, typed leftConnection/rightConnection fixtures.
expect(runtime.resolve('left')).toEqual({ connection: leftConnection });
expect(runtime.resolve('right')).toEqual({ connection: rightConnection });
expect(leftConnection).not.toBe(rightConnection);
expect(runtime.resolve('left')).toBe(runtime.resolve('left'));
expect(() => runtime.resolve('connection')).toThrow('no factory');
```

Add an owned private dependency with a public dependent and assert cleanup order
`['dependent', 'private']`. Add an original Promise-valued factory and assert
identity, not just fulfillment equality. Capture the failing command/output.

- [ ] **Step 2: Extract the runtime and switch graph edges to binding IDs.**

Translate existing named registrations to public binding descriptions. Every
dependency access resolves its local reference first, then records the edge to
the actual target binding. Keep pending acquisition observation separate from
the returned Promise. Cached rejection removes the failed binding's memo and
outgoing edges so a later resolve retries correctly. Labels produce readable
cycle diagnostics, including paths discovered after `await`.

```ts
const ref = binding.localNames.get(localName)
  ?? { kind: 'public' as const, key: localName };
const target = ref.kind === 'private'
  ? ref.id
  : graph.publicSlots.get(ref.key);
```

Continue to drain in-flight acquisitions to a fixed point during close; then
dispose dependents before dependencies once. Preserve current cleanup failure
behavior in this extraction; the later lifecycle task introduces structured
aggregate failures with migration coverage.

- [ ] **Step 3: Preserve override and fresh-root semantics.**

Selected fork overrides replace only the selected public slot bindings. A
fork's new runtime has no shared memo, pending map, cleanup state, or ownership.
Preserve each unchanged binding's lexical lookup table while resolving its
public references against the new graph's slot table. Runtime validation still
rejects hidden duplicate additions atomically and ignores unselected override
getters. No unchecked Bag value export is introduced.

- [ ] **Step 4: Verify and commit.**

Run `bun test tests/binding-graph.test.ts tests/runtime.test.ts
tests/disposal.test.ts tests/boundaries.test.ts`, then `npm run check` and
`npm run example:wbs`. Record output and commit as
`refactor: separate public slots from runtime binding identity`.

### Task 2: Typed open modules, export views, and installation

**Files:**
- Create: `src/module.ts`, `src/module-types.ts`, `tests/modules.test.ts`,
  `tests/types/modules/feature.ts`, `tests/types/modules/consumer.ts`,
  `tests/types/negative/module-private.ts`,
  `tests/types/negative/module-missing.ts`,
  `tests/types/negative/module-wrong-shape.ts`,
  `tests/types/negative/module-hidden-private-needs.ts`,
  `tests/types/negative/module-narrowing.ts`,
  `tests/types/negative/module-exports.ts`,
  `tests/types/negative/module-rename.ts`, `examples/modules.ts`.
- Modify: `src/di-bag.ts`, `src/builder.ts` if present, `src/runtime.ts`,
  `src/types.ts`, `src/index.ts`, `tests/types.test.ts`,
  `tests/package.test.ts`, `tests/type-scale.test.ts`, `README.md`,
  `docs/migrations/0.1-to-enterprise.md`.

**Interfaces:**
- `DiBag.module()` returns a non-resolving immutable module builder supporting
  checked `add` and singleton `replace`, with forward references.
- `.exports(keys)` seals an immutable nominal module with exact selected public
  exports and the unsatisfied external requirements of **all** local providers.
  Private providers do not disappear from requirement validation merely because
  they are unexported or not reachable from an exported factory today.
- Use the existing element-wise singleton finite-tuple checks for `exports`.
  Reject missing names, widened arrays, optional/variadic entries, and union
  elements. Empty exports are allowed and retain external requirements.
- A module exposes no unchecked public constructor and no mutable registry.
  The public `Module<Provides, Requires>` type is invariant in both contracts;
  structural narrowing must not hide exports or requirements. Retain individual
  requirement constraints internally so intersecting incompatible needs cannot
  erase checks by collapsing a type to `never`.
- `ModuleProvides<M>` and `ModuleRequires<M>` expose useful readonly contract
  views without turning them into a forgeable module representation.
- `module.rename(oldKey, newKey)` produces a new module view. Both keys must be
  singleton finite strings; oldKey must be exported and newKey must not collide
  with a different export. Renaming a key to itself is an identity operation.
  Rename changes public slots and corresponding internal exported references,
  not the factory's object parameter names or unrelated external requirements.
- Host `builder.install(module)` adds exactly its public exports and carries
  its open constraints. Duplicate exports reject statically and atomically at
  runtime. Every installation allocates fresh private binding IDs. Later host
  additions and modules may fulfill forward requirements; `.end()` closes all.
- Host replacement and forks of exported services affect the module's own
  consumers of those services. They must still satisfy those consumers' needs.
- Retain installed constraints in both the host builder and the returned bag,
  not only in the module value. Use an invariant constraint parameter with an
  empty default, such as `Bag<R, C extends NeedConstraint = never>`, and an
  invariant type-only witness on builders/bags carrying `C`. Ordinary `Bag<R>`
  annotations remain available for plain graphs; they must not erase a
  nonempty installed contract. Every add/replace/fork result retains the exact
  constraint union. Fork validates that union against its resulting public
  service view as well as checking ordinary factory declarations.
- Installed constraints include public-slot dependencies of private consumers,
  not only still-missing external dependencies. Module-local private targets
  were checked at sealing; public targets remain replaceable and therefore
  their consumer contracts must survive installation, export renaming, and
  bag finalization. Rename their lookup keys using the module's explicit
  exported-reference mapping, without renaming private targets or unrelated
  external names.

- [ ] **Step 1: Add failing runtime and cross-file compiler fixtures.**

```ts
type Logger = { log(message: string): void };
const feature = DiBag.module().add({
  connection: DiBag.withDisposal(() => ({ open: true }), () => {}),
  service: ({ connection, logger }: {
    connection: { open: boolean }; logger: Logger;
  }) => ({ read: () => { logger.log('read'); return connection.open; } }),
  handler: ({ service }: { service: { read(): boolean } }) =>
    () => service.read(),
}).exports(['service', 'handler']);

const root = DiBag.begin().install(feature).add({
  logger: () => ({ log(_message: string) {} }),
}).end();
const child = root.fork(['service'], {
  service: () => ({ read: () => false }),
});
expect(root.resolve('handler')()).toBe(true);
expect(child.resolve('handler')()).toBe(false);
```

Use actual cleanup event arrays in ownership tests rather than only no-op
callbacks. Test two fully renamed installations with same-named private
providers: instances and cleanups stay isolated. Test duplicate installation
failure leaves the input builder/module usable. Add a renamed export whose new
name collides with a private local name; explicit local reference maps must
retain both identities correctly.

Compiler negatives must reject private lookup, missing/wrong external providers,
requirements of unexported providers, hidden contracts via module narrowing,
invalid exports and rename keys, incompatible public overrides used by private
consumers, and incompatible external requirements from two installed modules.
Positive fixtures cross a file boundary and retain exact method/Promise types.

Include a private provider that requires an extra method on an exported
service, with a public handler consuming the private provider. Verify the bag
still rejects an override missing that method. Add a no-cast negative fixture
that attempts to assign this installed bag or builder to a type lacking its
installed constraints before overriding. Invariance must reject that erasure;
the compiler must not rely on the user retaining the original inferred type.

- [ ] **Step 2: Implement module values and type reconciliation.**

Use private nominal identity plus invariant contract witnesses for modules, and
an internal registry for normalization. Return copies/views through immutable
operations; never trust a spread descriptor. Keep provided entries flat. Store
each module requirement as an independently checked constraint against host
public services; missing requirements survive until finalization. Module-local
private services satisfy local requirements without becoming host-visible.

```ts
type NeedConstraint = { readonly consumer: string; readonly needs: object };
type WrongConstraint<C extends NeedConstraint, Available extends object> =
  C extends NeedConstraint
    ? Pick<Available, keyof C['needs'] & keyof Available> extends
        Pick<C['needs'], keyof C['needs'] & keyof Available>
      ? never
      : C
    : never;
type MissingConstraint<C extends NeedConstraint, Available extends object> =
  C extends NeedConstraint ? Exclude<keyof C['needs'], keyof Available> : never;
// Type-only member on each carrier; never invoke it or expose a mutable value.
// This prevents a structural view from dropping an installed constraint.
// declare private readonly constraintInvariant: (value: C) => C;
```

Apply these distributive checks to the retained constraint union. Format wrong
and missing results through the shared named diagnostics; do not merely expose
the constraint union as an assignability assertion.

When exporting a local provider, references to its local name become public
slot references. Unexported local providers use private binding references.
External references also use public slots. Allocate fresh IDs on installation,
including for repeated installs of the same module with different export views.
Do not wrap each exported service in a nested bag or copy its already-acquired
instance during installation.

- [ ] **Step 3: Verify cleanup, overrides, and compiler-scale preservation.**

Test dependency-aware cleanup across private/public/external edges, original
Promise identity, async failure/retry, post-await cycle diagnostics, and fork
independence through installed modules. Include host `replace` changing a
service type compatibly and one rejected by a private module consumer.
Compose 1000 providers from reusable named modules in generated compiler
fixtures with exact final consumer assignments. Wrong/missing requirements at
scale must fail with their intended contract diagnostic, never TS2589.

- [ ] **Step 4: Document, verify, and commit.**

Document private versus public names, forward requirements, override visibility,
repeated installation via explicit renaming, and fresh-root fork semantics.
Explain that explicit bag annotations for installed modules must preserve their
inferred contract (for example with `typeof` or `ReturnType`); a plain `Bag<R>`
annotation is not a mechanism for discarding private-consumer requirements.
Add a runnable two-module example and packaged declarations/import consumers.
Run focused module/type/scale tests, `npm run check`, `npm run example:wbs`,
and `bun run examples/modules.ts`. Commit as
`feat: compose typed modules with isolated private providers`.

## Self-review of plan coverage

This plan covers named module composition, all-provider external requirements,
private identity, public override visibility, cleanup-edge preservation, and
actual reusable-module compiler-scale fixtures. It intentionally leaves typed
symbol tokens and the remainder of the enterprise acceptance matrix open.
Task 1's binding graph is consumed by Task 2's installation without changing
the public plain-factory contract. Both task test cycles preserve the preceding
type-foundation and WBS regression assertions.
