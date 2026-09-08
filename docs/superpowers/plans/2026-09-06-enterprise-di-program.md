# Enterprise DI Program

**Goal:** Implement the complete enterprise DI design, including independently
publishable sas-box and val-box improvements, type safety, composition,
lifecycles, extensions, compatibility evidence, and release instructions.

**Spec:** `docs/superpowers/specs/2026-09-06-enterprise-di-design.md`.

This is the cross-repository program tracker. Detailed subsystem plans carry
the executable test-first tasks. The user explicitly requested continuous
execution; do not stop for another planning approval between increments.

## Milestones

- [x] Box libraries: `2026-09-06-box-foundations.md` completed; final review clean after the sas-box generic-constructor correction. Evidence: `docs/reports/2026-09-06-box-foundations.md`.
- [x] Type foundation: `2026-09-06-type-foundations.md` tasks complete; carried observer correction resolved by reviewed named-module Task1. Evidence: `docs/reports/2026-09-06-type-foundations.md`. Initial scale gates pass; larger limits remain required work below.
- [x] Providers and modules: named open modules, private bindings, checked exports and overrides are complete (`2026-09-06-named-modules.md`; evidence in `docs/reports/2026-09-06-named-modules.md`). Immutable provider transformations are complete through final correction `6874760`. Typed tokens are complete through `75bc1f9`: all tasks, broad review, one consolidated fix and scoped re-review finished. One empty-selection efficiency Minor is explicitly carried into the next runtime increment below.
- [x] Box integration: adapters use real packaged libraries, typed acquisition frames and plain service values; final shared union-type correction `6874760` and scoped review are complete. Evidence: `docs/reports/2026-09-06-provider-transformations.md`.
- [x] Acquisition foundation: `2026-09-06-acquisition-foundations.md` completed through `fd83085`; task review and final scoped review are clean. Evidence: `docs/reports/2026-09-06-acquisition-foundations.md`, including the explicit structural-thenable conversion migration.
- [x] Native-Promise classification correction: implemented at `664f6e3`, with
  clean scoped review of the complete `48752ec..664f6e3` correction. Configured
  automatic classification and explicit raw/native modes preserve native state,
  exposed identity and the correct disposer value; `di-bag/node` supplies the
  host predicate. Whole-graph preflight catches missing capability before effects.
  Final full check passes 433 tests/2,170 assertions; independent committed-code
  checks pass 96 runtime/supervisor tests and 3 focused type tests/464 assertions.
  M2 monitor-failure coverage is also reviewed and closed. Evidence and migration:
  `docs/reports/2026-09-07-modern-compilers.md`.
- [x] Tracked default child-scope foundation: `Bag.scope()` owns fresh acquisitions
  over the shared immutable graph, deterministic tree shutdown and independent
  child detachment. Actual classic/native archives run in Node/Bun CJS/ESM, and
  physical declaration-only consumers preserve the exact inferred contracts.
  M1's explicit empty-fork graph-reuse finding is addressed. Evidence:
  `docs/reports/2026-09-07-child-scopes.md`.
- [x] Lifetime runtime:
  - [x] Root/scoped/transient cache and ownership policies, root-context capture,
    and static/runtime captive-dependency checks on the per-attempt foundation.
  - [x] Selected sharing and child overrides across tracked scope boundaries.
    Implemented through `8836b8f` under `2026-09-07-selected-scopes.md`; complete
    check: 557 tests / 2,878 assertions, strict classic typecheck/build. Native
    audit matches all 23 new negative regions without new gap allowances; actual
    classic/native archives preserve physical inferred declarations and execute
    on Node/Bun CJS/ESM. Independent runtime and final reviews pass without findings.
    Evidence: `docs/reports/2026-09-07-selected-scopes.md`.
- [x] Startup and shutdown: eager acquisition, partial-failure cleanup, cancellation,
  timeout and late-completion handling, structured aggregate cleanup failures.
  `Builder.start` and `DiBag.withContext` are implemented under
  `2026-09-07-startup-context.md`; final check passes 528 tests / 2,714 assertions.
  Native source diagnostics, inferred physical declarations and both archives'
  Node/Bun CommonJS/ESM runtime lanes pass. Evidence:
  `docs/reports/2026-09-07-startup-context.md`. Cancellation exposes eventual
  cleanup separately and does not forcibly terminate uncooperative factories.
- [x] Composition extensions (implemented and verified locally):
  - [x] Direct classes and positional functions through `68930c0`: exact tuple,
    return and acquired contracts, concrete constructor semantics and bound-method
    support. Full check passes 586 tests / 3,043 assertions. Physical classic/native
    declarations and Node/Bun CommonJS/ESM routes pass; both packaging review
    findings are corrected and scoped re-review approves. Evidence:
    `docs/reports/2026-09-07-composition-adapters.md`.
  - [x] Optional/lazy dependency references through `55bfcb7`: exact immutable
    token contracts, optional absence and lazy owner/graph/admission semantics.
    Full check passes 613 tests / 3,209 assertions; physical classic/native
    declarations and Node/Bun runtime lanes pass. Independent review approves
    source/types, and scoped review closes the package fixture-routing correction.
    Evidence: `docs/reports/2026-09-07-dependency-references.md`.
  - [x] Checked name/token aliases through `e6c5bb6`: canonical acquisition,
    lexical module/privacy routing, parent sharing and conservative inspection.
    Full check passes 643 tests / 3,356 assertions; both actual archive emitters
    and Node/Bun CommonJS/ESM routes pass. The declaration portability and native
    archive coverage findings are corrected; scoped review is clean. Evidence:
    `docs/reports/2026-09-07-aliases.md`.
  - [x] Typed contributions through `123cd0d`: ordered, individually checked
    providers with private module dependencies, exact values and canonical
    per-item lifetime/ownership. Full check passes 667 tests / 3,497 assertions;
    both actual archive emitters and all Node/Bun CommonJS/ESM routes pass.
    Source/type review passes, and scoped review closes pending-raw archive
    coverage. All seven examples and final native checks pass; the audit retains
    the same 27 existing message gaps. Evidence:
    `docs/reports/2026-09-07-contributions.md`. Branch push remains pending the
    specific export approval requested after automatic review rejected it.
- [x] Diagnostics and plugins (validated locally; conditional push/remote-SHA
  verification remains in the release handoff):
  - [x] Typed lifecycle observers and immutable lifecycle snapshots through
    `b5d6575`: canonical scope/acquisition/cleanup identity, queued failure-isolated
    callbacks, physical declarations and Node/Bun CommonJS/ESM archive routes.
    Full check passes 691 tests / 3,657 assertions; native strict/build/source
    audit and all eight examples pass. Independent review is clean. Evidence:
    `docs/reports/2026-09-07-lifecycle-observers.md`.
  - [x] Validated dynamic plugin boundary through final reviewed source `57021fc`:
    physical classic/native declarations with source-deleted consumers and actual
    Node/Bun CJS/ESM package lanes, lifecycle shutdown boundaries, and all nine
    examples pass. Final check is 720 tests / 3,830 assertions; native audit keeps
    27 declared diagnostic-message gaps with zero unexpected diagnostics. Evidence:
    `docs/reports/2026-09-08-dynamic-plugins.md` (retained final command logs).
- [ ] Compatibility and comparison: package consumers, runtime/bundler matrix,
  reproducible performance and compiler measurements, adversarial integration
  tests. Concrete execution plans are `2026-09-08-platform-compatibility.md`,
  `2026-09-08-performance-evidence.md`, and
  `2026-09-08-adversarial-integration.md`. Every task uses focused mutation and
  negative tests, neighboring regression suites, physical archive consumers,
  and final full gates; retain unavailable lanes and failed measurements rather
  than weakening them. The prior parent benchmark evaluator Minor is closed by
  direct malformed JSON/identity/diagnostic, process-failure, boundary and
  TS2589 tests in the reviewed native compiler checkpoint `ad73249`.
  - [x] Packed platform evidence command at final reviewed source `62e72b9`: the isolated
    classic TypeScript 6 archive build and pack row passes with retained source,
    lockfile, tool, command and artifact hashes. Deno is explicitly
    `unavailable: not-provisioned`; the browser Worker lane is explicitly
    `unavailable: esbuild-not-provisioned`, with Playwright and Chromium also
    retained as unavailable. These rows do not claim Deno/browser execution or
    extend support to `di-bag/node`. Evidence:
    `docs/benchmarks/results/2026-09-08-62e72b9/`.
  - [x] Reproducible performance evidence: two complete intrinsic-baseline
    runtime seeds remain informational, repeated compiler controls retain all
    raw children and identities, and the exhaustive 83/108 compiler matrix
    remains separate. The optional comparator boundary rejects semantic and
    lifecycle mismatches. Typed Inject and Awilix are truthfully recorded
    `unavailable: not-lockfile-pinned`; no third-party timing row exists.
    Evidence: `docs/reports/2026-09-08-performance-evidence.md`.
  - [x] Final adversarial integration is locally complete at reviewed checkpoint
    `e93b0a5`. The deterministic I1-I15 oracle passes in source, classic and
    native physical declarations, installed CJS/ESM archives, and Node/Bun
    runtime lanes. The final redundant gate passed 902 tests / 5,305 assertions;
    the focused source/package/native rerun passed 215 tests / 2,065 assertions;
    all nine examples passed. The existing 27 native diagnostic gaps remain
    exact with zero new or unexpected diagnostics. Evidence:
    `docs/reports/2026-09-08-final-integration-release.md`.
- [ ] Compiler/inference follow-up: execute
  `2026-09-08-compiler-scalability.md` and
  `2026-09-08-native-diagnostics.md` to resolve the remaining measured 500/1000
  individual-chain limits, large-graph latency and modern native compiler
  compatibility. Actual nominal-module 1000-provider gates pass, separately
  from registration groups; this does not prove equally long individual call
  chains. Preserve the original 108 matrix rows and utility-type soundness as
  independent acceptance gates.
  - [x] Both inline inference cases now pass on the supported TypeScript 6.0.3
    compiler: the richer selected async override and nested `snapshot()` factory.
    Checkpoint `9126993` adds source, installed CJS/ESM, declaration emission and
    unchanged downstream regression gates without production API changes.
    The identical predeclared factories remain controls; TypeScript 5.9 failures
    remain labeled history, not claimed fixes on that compiler.
  - [x] Native TypeScript 7 source/package rejection verification and all original
    scale outcomes are implemented and task-reviewed at `ad73249` under
    `2026-09-07-modern-compilers.md` Task2. Source checks explicitly retain
    27diagnostic-quality gaps; named28/36 and token10/18 matrix cases meet the
    unchanged acceptance rules. All16failures remain required scale work, not
    successful type rejections. Whole-branch review and its consolidated
    classification/monitor correction are complete through `664f6e3`.
  - [x] Bounded compiler-scalability implementation and evidence are complete at
    production-source hash `90d656f6`. Incremental installation resolves every
    original 500 individual-module row on classic and native compilers; physical
    `.d.cts`/`.d.mts` consumers, both emitters, full gates and all nine examples
    pass. The final frozen 108-row matrix accepts 83 rows and retains 25 failures,
    so T2 and the parent compiler follow-up remain open. Evidence:
    `docs/reports/2026-09-08-compiler-scalability.md`.
  - [ ] Native replacement diagnostic quality: 27 existing invalid calls are
    rejected but 7.0.2 prints only the last token-overload error. Task 2 records
    exact native-only rejection fingerprints separately from useful messages;
    this does not complete diagnostic parity. A proposed overload redesign was
    rejected because standard ReturnType views introduced cast-free history
    erasure. Production signatures remain unchanged; new regression tests must
    preserve utility-type soundness alongside direct-call inference.
    The bounded follow-up is complete with honest no-adoption evidence: both
    permitted factorizations reached 94/95 strict messages but the union-name
    diagnostic still hid the useful requirement. Fresh strict audits remain
    68/95 with exactly 27 gaps; source, utility, package, full and example gates
    pass. Native parity and T2 remain open. Evidence:
    `docs/reports/2026-09-08-native-diagnostics.md`.
- [ ] Release handoff: execute `2026-09-08-release-handoff.md` after the
  adversarial integration plan to complete examples, migrations, changelogs,
  verified local tarballs, and safe publication instructions for all three
  libraries. Registry checks, login, push, tag, and publication remain outside
  that plan and require fresh explicit authorization.

## Execution rules

The design's Global Constraints apply to every milestone. Add the detailed
subsystem plan before implementation of that milestone. Record discoveries and
decisions in a plan-scoped ledger. Never replace a missing capability with a
documentation-only claim or treat a generated CI file as a successful run.

Execution refinement: per-acquisition shutdown bookkeeping precedes owned
provider transformations and box adapters, so projection failures and late
ownership have a correct place to be tracked. The provider/adapter refinement
is `docs/superpowers/specs/2026-09-06-provider-transformations-design.md`.
This prerequisite does not remove or complete later lifetime/startup work.
The completed provider plan is `2026-09-06-provider-transformations.md`: typed
metadata/inspection, staged mappings/ownership, then real optional box adapters.
Its metadata/inspection task is complete at `06918c8`, staged mappings/
ownership at `6a71ab4`, and box adapters at `ae36def`. Broad final review found a
shared `NoInfer` union extraction defect; `6874760` corrects it and preserves
replacement inference, with clean final scoped review. Typed-token integration
now has the binding design `2026-09-07-typed-tokens-design.md` and executable
plan `2026-09-07-typed-tokens.md`: internal identity/routing, checked public/module
composition, then actual package/compiler integration. The increment is complete
through `75bc1f9`, with one explicitly carried empty-selection efficiency Minor.
The internal token foundation is complete at `1048e29`, with clean task review;
public token/module composition is complete at `d58937c`, with task review
Approved and one bulk-fork efficiency follow-up. Final package/scale integration
at `8088852`/`887d417` and broad review correction at `75bc1f9` are complete.
The initial incremental-check investigation is historical. The refined checker
is now implemented at `d6c2710` under `2026-09-07-incremental-checks.md`, with clean
Task 1 review and independent verification. Its larger-matrix Task 2 and broad
final review are complete through `659acdd` / reviewed checkpoint `9d09eef`;
the complete enterprise T2 requirement is still open. Both final-review Minors
are assigned above to the next runtime/lifecycle and benchmark-harness changes.
Modern compiler Task1 is complete and reviewed at `9126993`: exact classic
TypeScript 6.0.3 inference is adopted with no production source changes. Native
Task2 is complete and task-reviewed at `ad73249`:397tests/0failures/1980assertions,
strict classic/native builds, both installed emitter/module-mode routes, physical
declaration consumers and all4examples. Independent committed-state checks cover
the harness, inference and80native source rows; all54matrix identities, hashes,
raw diagnostics and strict outcomes are validated. The full compiler requirement
and enterprise program remain open. Whole-branch review of `48752ec` requires
the native-Promise classification correction above; it also requests a direct
monitor-failure termination test in the native harness. That M2 coverage is
committed at `e5ac466` with genuine RED/GREEN and independent verification of
21 focused tests/104 assertions. The single scoped re-review of
`48752ec..664f6e3` closes both I1 and M2
with no new Critical/Important findings. Independent committed-code verification
passes 99 covering tests/464 assertions, and revalidates original 54 matrix rows' provenance
without rerunning or relabelling those rows. I1 follows the classification spec
committed `3361341`; implementation is committed `664f6e3`. The original54matrix
rows measure source revision `cc9dbdc`, not the classification API changes. Evidence:
`docs/reports/2026-09-07-modern-compilers.md`.

## Current evidence

- Initial di-bag `npm run check`: 73 tests passed; strict typecheck/build passed.
- Both upstream box repositories were resolved and cloned. After separate
  user authorization, verified intermediate checkpoints were non-force pushed
  to their `feat/enterprise-foundations` branches, with exact remote SHA checks.
  No package has been published. Evidence is in the box-foundations report.
- Type-boundary investigation ran independently of box implementation.
- Read-only type investigation completed: nominal disposal handles, explicit
  selected overrides, duplicate-rejecting additions, and singleton replacement
  address the concrete counterexamples; flat entry unions compiled 250 chained
  additions in the feasibility probe. These findings are not implementation.
- Module design investigation completed: installations need independent private
  identities and shared public lookup slots; private consumers of an exported
  service must observe a fork's public override. Per-export wrapper bags would
  hide ownership edges and are not the selected runtime architecture.
- Named-module Task1 implements the internal binding graph at `4f6aab4`:
  isolated symbol identities, lexical references, immutable descriptions, and
  native Promise bookkeeping with original exposed identity. Task review is
  clean; independent full check passes 122 tests / 419 assertions, typecheck,
  declaration build, package consumers and WBS.
- Public named modules are implemented at `9b9fb98`; task and final broad reviews
  are clean. Independent exact-HEAD verification passes 144 tests / 527
  assertions, typecheck/build, CJS/ESM consumers, all nominal-module scale cases
  and both examples. The lifecycle retry defect is addressed by the acquisition
  foundation below; compiler/inference limitations remain required follow-up.
- Acquisition identity and aggregate shutdown are implemented at `179fa2e`:
  full check 155 tests / 602 assertions, task review clean. Final review found
  native Promise-subclass assimilation; `fd83085` fixes it with direct native
  observation and an independent native pending barrier. Independent covering
  check passes 74 tests / 300 assertions, strict builds and both examples;
  final scoped review is clean. Structural thenables use explicit conversion
  inside factories; no host-specific core dependency or guessed fallback.
- Typed immutable provider metadata and checked inspection are implemented at
  `06918c8`, retaining metadata through module export/rename/install and exact
  original factory contracts. Task review is clean; independent full check:
  181 tests / 813 assertions, strict typecheck/build, real CJS/ESM consumers,
  all current scale gates, and both examples. Later provider tasks are below.
- Staged sync/async mappings and additive ownership are implemented at `6a71ab4`.
  Task review is clean; independent exact-commit full check: 204 tests / 956
  assertions, strict typecheck/build, all scale and package gates, both examples.
  Retired cleanup waits for its own pending work; explicit required disposer
  receivers are rejected. Adapter and final-review evidence follows.
- Optional adapter subpaths and ordered acquisition frames are implemented at
  `ae36def`, including failed-retirement incoming-edge correction. Task review
  is clean; independent exact-commit full check: 230 tests / 1,174 assertions,
  strict typecheck/build, real box/core consumers, all current scales and three
  examples. The nested inline snapshot factory needs a predeclared-factory
  workaround until the required inference follow-up.
- Final shared union extraction and compatible replacement inference are corrected
  at `6874760`. Full check: 240 tests / 1,322 assertions, strict typecheck/build,
  current scales and actual packages; six later negative calls have a separate
  source/CJS/ESM covering run. Controller independent committed-state check:
  27 tests / 381 assertions plus strict typecheck/build and all three examples.
  Final scoped review is clean, both findings addressed, no residual issues.
- Bounded token and lifetime carrier investigations are recorded in
  `docs/reports/2026-09-06-typed-token-investigation.md` and
  `docs/reports/2026-09-06-lifetime-contract-investigation.md`. Only the token
  identity sketch has source/emitted compiler evidence; the lifetime proposal
  remains unadopted. The additional token carrier investigation is recorded in
  `docs/reports/2026-09-06-typed-token-carrier-investigation.md`: isolating a nested
  inferred resolve return and using a bounded indexed output retained all 32
  expected diagnostics at 29 positions in both source and emitted consumers,
  under a 384 MiB / 10-second child bound. This supports the selected fourth
  provider contract, not a production scalability claim. The production plan
  preserves export-time module projection, unlike the bounded prototype.
- Fresh pre-token baseline at `e26bb16`: `npm run check` passed 240 tests / 1,334
  assertions in 312.67 seconds, strict typecheck and declaration build. No token
  production implementation was present in that run.
- Token Task1 is implemented at `1048e29`: genuine invariant token identities,
  retained provider graph contracts and shared internal symbol acquisition routes.
  Full check:264tests/1560assertions, typecheck/build and all3examples; controller
  independent committed-state covering run:30tests/250assertions, strict builds,
  actual package consumers and all3examples. Initial task review is clean, no
  findings. Evidence: `docs/reports/2026-09-07-typed-tokens.md`. This is an internal
  foundation checkpoint, not completion of public tokens or milestone M1.
- Bounded scope-inheritance comparison is recorded in
  `docs/research/2026-09-07-scope-inheritance.md`, using pinned Awilix source,
  official Inversify hierarchy documentation and pinned Effect4RC source.
  It separates first-child construction, child shadowing and borrowing ownership.
  Recommendations remain unadopted until the lifecycle refinement; no upstream
  runtime test or benchmark was executed by that research.
- Token Task2 is implemented at `d58937c`: checked root/module binding, token
  replacement/resolution/inspection and mixed selected overrides. Real feature
  declaration emission exposed TS4118; a named Record view preserves emission and
  exact contracts without user casts/annotations. Full check:287tests/1812assertions,
  strict builds/all3examples; later fixture-only additions have covering checks.
  Controller committed-state verification:45focused tests/472assertions plus
  18token runtime tests/67assertions, strict builds and all3examples. Task review
  Approved; one bulk-fork repeated-graph-build performance finding remains for
  the broad final review. Token Task3 and larger enterprise rows remain required.
- A bounded lifetime-carrier model now has independent source/declaration evidence
  in `docs/reports/2026-09-07-lifetime-carrier-investigation.md`: all positive
  phases pass and the unsuppressed consumer has exactly26intended diagnostics.
  Extending existing G is only a candidate; declaration expansion, production
  compatibility, child/shared construction contexts and scale remain unproven.
  No lifecycle representation or policy is adopted by this investigation.
- Token Task3 is implemented at `8088852` and its review correction at `887d417`.
  Actual packed CJS/ESM inferred feature emission exposed TS2742; five type-only
  root exports fix portability without runtime changes. Full check passed297tests/
  1866assertions, strict builds/all4examples. Controller independently verified
  packages/boxes/source/emitted cases and all6token scale cases. Initial review's
  diagnostic-location assertion finding is fixed and scoped re-review is clean;
  its covering reruns pass6tests/36assertions. All token tasks are complete, but
  broad review and the recorded fork performance finding were still open at that
  checkpoint; they are addressed below. At100tokens,
  measured maximumRSS775–877MiB underscores the still-required larger T2 work.
- Token broad final review and its single consolidated correction are complete
  at `75bc1f9`. Selected forks build one graph per batch; module C/D and failed-edge
  migration prose are corrected. Full check: 300 tests / 1,877 assertions, strict
  builds and all four examples; a later exact-one-batch assertion has covering
  verification. Controller independently passed builds, 91 covering runtime/real
  package tests and all examples. Scoped review closes all three original findings,
  with no Critical/Important residual. One Minor remains required: graph reuse for
  explicit empty selection, carried into the next runtime/lifecycle increment.
- Current pinned T2 investigations are recorded in
  `docs/reports/2026-09-07-current-incremental-check.md` and
  `docs/reports/2026-09-07-current-inline-inference.md`. A refined incremental checker
  preserves all 17 focused negative boundaries and completes one 500-add fluent
  source in 11,953 ms / 1,752 MiB RSS. This was unadopted investigation evidence;
  production integration follows below. Both
  inline inference limitations reproduce; a preliminary-context fork candidate
  retains focused source/emitted contracts, while the nested snapshot case remains
  unresolved. Lifetimes/startup and all other acceptance rows remain required.
- Incremental checker Task 1 is implemented at `d6c2710`: five builder operations
  validate incoming and cross-boundary relationships while preserving runtime,
  inference inputs, module constraints and final closure. Real 100-case compiler
  work falls from 3,749,643 to 838,875 named instantiations and from 10,296,781 to
  1,361,372 token instantiations. Full check: 308 tests / 1,964 assertions, strict
  builds and all four examples. Controller committed-state verification: 32 tests /
  361 assertions covering work gates and actual installed declarations, builds
  and all examples. Task review is clean, with no findings. Checkpoint `aff1579`
  was non-force pushed and its exact remote SHA verified. Evidence:
  `docs/reports/2026-09-07-incremental-checks.md`. Task 2 has collected the original
  larger matrices; its task/final reviews are approved, and no large-case failure
  is waived. Final full check: 334 tests / 2,044 assertions; independent
  committed-code verification: 58 focused tests / 441 assertions, strict builds
  and all four examples.
- A virtual conditional-arity val-box overload was rejected after reproducing
  the inline failure in both source and emitted declarations. It does not infer
  the exact nested snapshot return. Existing negatives still reject; no overload
  was adopted. The current-inline-inference report records the probe and the
  need for a deliberate inference/validation architecture review.
- The pre-existing cast-free root-builder view erasure is corrected at `8daad9a`
  by retaining entry history and module constraints in the existing invariant
  phantom member. Exact/equivalent builder histories remain supported; widened
  annotations are intentionally stricter. The corrected source's complete named
  matrix accepts 30/36 cases, and its token matrix accepts 9/18. All 1,000 named
  chained/replacement cases still crash the 5.9.3 binder; 500 token-module and
  all 1,000 token cases reach the 60-second bound. These are measured failures,
  not successful type rejections or completed enterprise T2 requirements.
- Bounded primary-source compiler research is recorded in
  `docs/research/2026-09-07-typescript-compiler-limits.md`. It identifies isolated
  TypeScript 6 inference and TypeScript 7 native-CLI compatibility experiments
  worth running next. A subsequent first TypeScript 6.0.3 probe passes both
  unchanged inline reproductions and retains 129 selected negative boundaries
  in source and emitted declarations; evidence is in
  `docs/reports/2026-09-07-typescript6-inference.md`. Real installed consumers,
  full compatibility and scale remain unexecuted parts of that experiment.
  At that experimental checkpoint, the TypeScript 7 experiment had not run and
  the 5.9.3 pin was unchanged. Subsequent adoption follows below.
- Modern compiler Task1 is implemented at `9126993` and its task review is
  approved with no findings. Genuine TypeScript 5.9 source and installed RED
  precedes the exact wrapper6.0.2 / classic API6.0.3 adoption. Both unchanged
  inline forms now pass source, actual installed CJS/ESM, inferred feature
  emission and downstream-only consumption; real archived ValBox frames remain
  exact. The task's full check passes342tests/2071assertions, strict typecheck/
  build and all4examples. Controller independently verifies12focused tests/
  29assertions, strict typecheck, clean diff and unchanged production source.
  Compiler-work counters839103named/1361600token remain below the unchanged
  1.5M/2M ceilings. The checkpoint is non-force pushed to feat/v0.1, with exact
  remote SHA verified. Native verification and original large matrices are
  subsequent Task2 work; the two box repositories are unchanged by this task.
- The tracked child-scope foundation is implemented and package-integrated under
  `2026-09-07-child-scopes.md`. Parent/child ownership, deterministic descendant
  shutdown, independent detachment and unchanged inferred Bag contracts are covered
  in source and in actual installed classic/native archives. Physical `.d.cts` and
  `.d.mts` consumers load with producer source removed. The previously carried M1
  empty-selection graph-reuse finding is closed. Root/transient lifetime policies,
  explicit sharing, captive-dependency checks, eager startup and cancellation remain
  open; this slice does not complete L1, L2 or A1.
- Root/scoped/transient policies and captive checks are implemented through
  `2026-09-07-lifetime-policies.md`. The public facade, runtime ownership, useful
  completion-time diagnostics and exact inferred declarations are exercised from
  physical classic/native archives. All eight Node/Bun CommonJS/ESM executions
  preserve child-first root ownership, per-call transients and independent forks.
  Selected sharing and child overrides across tracked scopes remain open, as do
  startup, context propagation and cancellation; the enterprise program is not
  complete.
- Eager startup and acquisition context are implemented under
  `2026-09-07-startup-context.md`. The complete local check exits 0:
  528 tests / 2,714 assertions, strict classic typecheck/build; native strict
  typecheck/build and the 92-file source audit also pass. All 17 new invalid calls
  receive matching diagnostics, with the same 27 pre-existing native gaps.
  Physical classic/native declarations preserve inferred startup/context contracts
  with producer source removed, and both archives execute on Node/Bun CJS/ESM.
  Independent review's final-stage-readiness correction and pending-native test
  strengthening are complete. Selected sharing, child overrides and the remaining
  composition, plugin, compiler and release milestones stay open.
