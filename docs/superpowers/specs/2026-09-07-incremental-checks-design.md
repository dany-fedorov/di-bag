# Incremental dependency checking design

Date: 2026-09-07. Status: selected under the user's continuous implementation
authorization. Baseline: `33f8a8e0500218e34c5c1996c870ae1966932126`.

This is the next implementation increment within enterprise requirement T2,
not a replacement for T2 or the complete enterprise program. The binding program
is `docs/superpowers/specs/2026-09-06-enterprise-di-design.md`. Token work is
finished; its review loops must not restart. The empty-selected-fork Minor is
carried into the next runtime/lifecycle increment, not this type-only change.

## Objective and evidence

Reduce repeated validation of unchanged dependency relationships when adding or
replacing registrations, retaining every supported source, declaration, installed
package, receiver, metadata, ownership and token contract. Add reproducible
compiler-work regression gates and measure the larger original source forms.

Current evidence is in `docs/reports/2026-09-07-current-incremental-check.md`.
The refined virtual candidate reduces 100 named-add instantiations from 3,749,587
to 838,819 and 100 token-bind instantiations from 10,296,725 to 1,361,316. It
preserves 17 focused negative boundaries and completes one original 500-add fluent
source in 11,953 ms / 1,752 MiB RSS. These are preliminary observations; broad
contracts, production integration and larger negative/mixed graphs are unproved.

## Alternatives and selection

1. Incremental relationship checks over existing flat Entry history: selected.
   It changes when relationships are checked without a new graph representation.
   Existing consumers still require scans, so this is not a sublinear claim.
2. A reverse dependency index carried by builders: potentially reduces scans,
   but adds another public type-level state representation and declaration cost.
   Consider only if measured remaining limits justify that larger design.
3. Continue whole-graph validation at every operation: preserves the current
   implementation but repeats accepted old relationships and retains the measured
   compiler cost. It remains appropriate at boundaries not optimized here.

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

The user separately authorized commits and non-force feature-branch pushes in
all three repositories. The controller handles pushes; workers do not publish,
merge, create PRs, remove workspaces or store credentials.

## Relationship invariant

Let E be accepted old Entry history and N the incoming registration map. Check:

- N's finite domains, receiver/registration admission, opaque graph/bound-token
  rejection, and all new-to-new named/token relationships using `Checked<N>`.
- New named consumers against surviving old named providers; keys overwritten
  by N are checked within N, not against obsolete outputs.
- Surviving old named consumers against new/replaced outputs. Drop only the
  overwritten consumer's own old requirements, not requirements of other consumers.
- New token consumers against surviving old invariant binding contracts.
- Surviving old token consumers against new/replaced invariant binding contracts.

An unchanged accepted relationship does not need another check at that operation.
Missing dependencies remain open until finalization; supplying a previously
missing dependency still checks every surviving consumer. Self dependencies,
both registration orders, multi-registration adds, multiple consumers, replacement
and mixtures of plain/owned/provider registrations must preserve this invariant.
Explicit generic calls and structurally assignable intermediate builder views
must not become a new unchecked graph entrance.

## Integration boundary

Introduce `IncrementalChecked<E, N>` and four named/token directional helper
types in `src/types.ts`. Replace exactly five whole-graph operands in
`src/di-bag.ts`: add, bind, two named replace overloads, token replace. Keep
their inference inputs and return types, NoInfer positions, named/key admission,
BindingOutput, replacement contextual types and flat Entry history unchanged.

Module builder, install, retained module C checking, Bag.fork and final closure
remain unchanged. Do not erase G/C, widen callback inputs to any, add unchecked
constructors or relax existing tests to get a compiler-work win. No runtime
behavior or dependency changes belong in this increment. Existing five root
type-only portability exports remain; any newly demonstrated declaration naming
gap requires focused RED evidence and a controller ruling before an API expansion.

## Error selection

Return an incoming `Checked<N>` error directly. Only after N is accepted, select
token cross-relationship errors before named cross-relationship errors. Do not
intersect contradictory branded diagnostic-detail records, which collapsed the
first probe's opaque-G explanation to `never`. This intentionally chooses the
incoming error first when incoming and old/new relationships fail simultaneously;
it need not reproduce every incidental ordering of the previous whole-map checker.
Every individual rejected contract retains a useful error at its own public
operation; downstream repeated errors are not required. Add explicit simultaneous
error controls, alongside opaque G and bound-handle controls, for this precedence.

## Test and measurement contract

1. Source and emitted/actual-installed fixtures retain exact output, needs,
   metadata, acquisition frames, token G, module C, receiver and union behavior.
   Include both relationship directions, new/new checks, replacements, forward
   closure, overwritten token contracts, incompatible invariant service types,
   opaque contracts and explicit generic calls. Existing inline/predeclared
   inference contracts remain supported; the two known inline failures remain
   separate required follow-ups, not newly accepted error-recovery types.
2. Add compiler-work measurement using the actual TypeScript Program after
   collecting diagnostics. Under the pinned TypeScript 5.9.3, 100 original fluent
   named additions must use at most 1,500,000 instantiations; 100 original token
   bindings at most 2,000,000. Both require zero diagnostics. These deliberately
   generous ceilings must fail against the unchanged baseline before adoption.
   They are reproducible work counters, not millisecond/editor-latency promises.
3. Each new measurement case runs in a fresh Node child with a 60,000 ms timeout
   and 3,072 MiB old-space cap. Success requires status 0, no signal/error/stderr,
   visible valid JSON and the expected case identity. Timeouts, crashes, OOM and
   TS2589 never count as intended rejection. Negative assertions couple message
   and intended boundary in the same diagnostic. Preserve existing scale gates.
4. Run the original named 36-case 100/500/1000 matrix and token binding/module
   cases at all three sizes through bounded workers. Record actual pass/failure,
   source form, version, instantiations, diagnostic locations, elapsed time and
   RSS. Preserve old results as historical evidence, not current claims. A failed
   larger form remains required T2 work. Do not substitute groups/statements,
   change the Node stack, erase types or lower the requested count silently.
5. Run full npm run check, all four examples, source/emitted/installed contracts,
   then independent committed-state covering checks and reviews. Record exact
   RED/GREEN and separate new coverage that already passes from demonstrated bugs.

The 100-case ceilings protect the demonstrated optimization, not enterprise
completion. 500/1000 individual operations, large C/G/module costs, latency,
inline async fork inference, nested snapshot inference and all other enterprise
rows remain required. If measurements fail, diagnose the actual next limit and
continue under the program rather than reclassifying it as a passing gate.

## Self-review

The design preserves the existing representation and all boundary obligations;
only repeated relationship validation changes. Error precedence and work-counter
ceilings are explicit, with broad compiler contracts and genuine negative controls.
Its two deliverables are independently reviewable: production checker integration
with regression gates, then the larger reproducible measurement/report extension.
There is no new user API, callback-context erasure, implicit await, runtime policy,
unproved capability completion, placeholder or waived enterprise requirement.
