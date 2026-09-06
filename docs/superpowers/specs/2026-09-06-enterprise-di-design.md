# Enterprise DI program design

Date: 2026-09-06. Status: approved direction, implementation in progress.

The user approved the preceding architectural recommendation and explicitly
requested a plan followed by implementation, including changes in `sas-box`
and `val-box`. This document records that direction and the acceptance scope;
it is not a claim that the current implementation satisfies it.

## Objective and evidence

Build an enterprise-class, decorator-independent dependency composition and
resource-management library with unusually strong TypeScript inference,
reusable modules, explicit lifetimes and ownership, useful extension points,
and repaired, independently publishable box packages. Preserve the full scope
across implementation increments. Universal superiority is not a verifiable
claim: substantiate comparisons through a published capability matrix,
compiler fixtures, runtime benchmarks, and integration scenarios.

Reference: `docs/research/2026-09-06-di-comparison.md`. Initial di-bag revision:
`ebe3685185ad511145b0ae7e3dd705478087626f`; fresh baseline: 73 tests pass,
typecheck and build pass. Initial sas-box revision:
`105c796cebaabb08127674b118bf1e4665f15d6f`; val-box revision:
`9da16d922883accdb09a4ffc53267911887ab07b`.

## Global constraints

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

## Architecture

### Provider descriptions and composition

Normalize plain factories and explicit helpers into immutable provider
descriptions. Factory/disposer relationships cannot be severed by spreading a
descriptor. Separate static description from acquired instances and scope state.
Registration operations must not apply runtime keys hidden by a structurally
narrowed TypeScript type. Operations that replace existing keys therefore need
an explicit runtime selection or a provenance-preserving registration builder;
a generic `Exact` utility is not an adequate defense.

A typed module carries provided services and unsatisfied requirements. Modules
compose independently of registration order and have explicit export views;
private providers remain available to their own implementation. Finalization
requires a compatible provider for every declared required dependency. Typed
tokens at module boundaries complement ergonomic named local services.

The ordinary-factory path learns runtime edges from property reads. Full graph
inspection before acquisition additionally requires explicitly authored runtime
dependencies. A typed token/construction adapter may supply that information;
the implementation must not pretend erased parameter annotations are available.

### Lifetimes and acquisition ownership

Root, scope, and transient caching policies are independent from owned/borrowed
cleanup policy. Store acquisition records per instance, not just per token, so
transient owned instances are each released. Preserve dependency-aware cleanup,
in-flight deduplication for cached providers, retry after rejected acquisition,
and deterministic cycle paths, including edges discovered after `await`.

Reject longer-lived instances capturing shorter-lived instances when observable
and statically when explicit descriptors make it provable. Scope sharing must
not redirect a root singleton to a child override. Child ownership and shutdown
relationships are explicit; borrowed resources are never disposed twice.

Startup can eagerly acquire selected providers while ordinary resolution keeps
its exact return types. A failed startup releases resources acquired for that
startup according to the documented scope contract. Cooperative cancellation
uses AbortSignal; timeout cannot be described as forcibly stopping arbitrary
JavaScript. Late acquisition and shutdown races must have deterministic cleanup.
Cleanup attempts every applicable finalizer and exposes all cleanup failures
through structured diagnostics; migration explains changes from first-error
behavior. Standard disposal protocols are opt-in adapters.

Automatic asynchronous acquisition observation uses genuine native Promise
state, including subclasses and foreign-realm Promises, without consulting an
overridden `then` method for fulfillment. Native observation setup failures
preserve their original thrown value and roll back. A structural thenable is
supported through an explicit standard conversion inside its factory, such as
`() => Promise.resolve(thenable)` or an async factory, not a brand-guessing
fallback after native observation fails. This is an intentional migration from
automatic raw-thenable assimilation. Ordinary synchronous values remain supported,
and exposed native Promise identity remains exact. The library's own pending
barrier must not assimilate a Promise subclass's arbitrary derived species value.

### Extension capabilities

Provide checked direct-class/positional-function adapters, aliases, genuinely
optional dependencies, lazy references, and typed contribution collections.
Extensions either observe lifecycle events or transform typed provider
descriptions; an untyped hook cannot secretly change a promised service type,
acquisition mode, or ownership policy. Static and acquisition metadata have
separate views and namespaced keys where extensions need independent ownership.

When a value-transforming adapter wraps an owned provider, the original
acquisition and its consumer-visible projection are distinct. Retain the
original disposer with the original acquired value; do not apply it to the
projected value or transfer ownership merely by unboxing. If projection fails
after acquisition returned ownership, release that acquisition. Async adapter
operations explicitly select awaiting behavior; ordinary factory dependencies
still preserve their exact original values and promises. Adapter tests must
cover projection failures and pending projected work during shutdown.

Runtime-selected plugins cross an explicit validated boundary. Statically
imported or statically typed dynamic imports retain module contracts; arbitrary
configuration-selected code cannot receive a global compile-time guarantee.

### sas-box

Keep sas-box independently useful as a sync/async acquisition-capability
adapter. A sync callback returning `T` has async access returning
`Promise<Awaited<T>>`, including when `T` is Promise-like. Async entry points
convert callback throws to rejected promises. `fromAsync` exposes the known
async-only capability. Preserve named classes and existing namespace aliases
where they remain correct. Do not introduce implicit global memoization or
resource ownership into the box: the DI scope owns those policies.

Package tests must exercise ordinary results, nested thenables, callback errors,
capability checks, receiver forwarding, and emitted declaration consumers.
Provide convenient namespace constructors without requiring consumers to know
the legacy `Unknown` entry point. Keep the callback result as the generic type
for sync access; async access uses Awaited consistently.

### val-box

Repair the existing mutable compatibility API: metadata assertions consult
metadata presence, conversion preserves values/aliases and follows all nine
requested presence combinations, and conditional return types preserve literal
refinements without treating a widened boolean as a known state. Present
`undefined` is distinct from absence for both value and metadata.

Add an immutable snapshot boundary for DI metadata adapters, not a mutable box
inside every service. Export `Presence<T>` as a discriminated union of
`{ readonly present: false }` and `{ readonly present: true; readonly value: T }`.
Export `ValBoxSnapshot<V, M>` containing readonly `value: Presence<V>` and
`metadata: Presence<M>` plus the intentional alias. `box.snapshot()` and
`ValBox.snapshot(box)` copy current presence/value/metadata into frozen records;
it does not deep-freeze the service or metadata payload and later box mutation
does not change the snapshot. The instance method also gives di-bag a typed
structural adapter protocol without importing val-box into the core. This
boundary supports diagnostic snapshots and provider metadata adapters without
transferring ownership.

### Integration and packaging

The box repositories remain independent checkouts under the ignored
`.related-repos/` directory, each with its own branch, commits, changelog, tests,
declarations, package exports, and release instructions. Do not vendor copies
of their source into di-bag. Di-bag's adapter subpaths must be tested against
packed local box artifacts and must not require unpublished versions merely to
use the plain core. Preserve a dependency-light core; use optional peers or
structural adapter boundaries as appropriate and test their actual artifacts.

Test packaged CJS and ESM consumers and browser bundling/minification without
decorator configuration. Add Node/Bun/Deno/browser-worker verification targets
and record precisely which were executed locally versus provided in CI. A CI
configuration alone does not prove a runtime passed. Avoid module-identity
splits that create separate token or descriptor brands across import formats.

## Acceptance matrix

Every row is required before claiming the program complete.

| ID | Required deliverable | Evidence |
|---|---|---|
| B1 | Correct sas-box acquisition capability API and packaging | runtime tests, strict declaration fixtures, tarball consumers |
| B2 | Correct val-box conversions and immutable snapshots | nine-way runtime/type fixtures, mutation-isolation tests, tarball consumers |
| T1 | Registration, override, descriptor, and receiver hardening | no-cast regression fixtures plus runtime hidden-key tests |
| T2 | Scalable inference and useful errors | generated 100/500/1000-provider graphs, chained and modular composition measurements, negative diagnostics |
| M1 | Typed reusable modules, requirements, exports, and tokens | cross-file compiler fixtures and runtime private-provider isolation |
| L1 | Root/scoped/transient instances and explicit sharing | identity and lifetime-leak tests across nested scopes |
| L2 | Per-acquisition ownership and robust shutdown | async ordering, transient multiplicity, cleanup-error and race tests |
| A1 | Eager startup, partial-failure cleanup, cooperative cancellation | success/failure/late-completion/abort/timeout integration scenarios |
| E1 | Class adapters, aliases, optional/lazy dependencies, contributions | runtime behavior and incompatible/missing compile-negative cases |
| E2 | Metadata, observer hooks, and typed box adapters | plain consumer values, ownership retention, hook failure behavior |
| P1 | Static plugin composition and explicit runtime validation boundary | typed exports and invalid dynamic plugin rejection |
| Q1 | Cross-runtime/module packaging and comparative evidence | real package consumers, recorded environment results, benchmark commands/results |
| R1 | Documentation, migrations, and publication handoff for all packages | runnable examples, changelogs, exact build/test/pack/publish instructions |

## Delivery sequence

1. Repair and package the boxes in their own repositories, while independently
   investigating the type boundary. This yields real publishable libraries.
2. Harden di-bag's registration/type foundation and generated compiler gates.
3. Implement typed providers/modules/tokens and integrate the box adapters.
4. Implement lifetimes, per-acquisition ownership, startup, and cancellation.
5. Complete composition extensions, diagnostics, dynamic validation, platform
   evidence, benchmarks, migration documentation, and publication handoff.

Each subsystem has a detailed implementation plan and a reviewed test cycle.
Completion of an increment does not complete or narrow the program objective.
