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
- [ ] Lifetime runtime: root/scoped/transient policies, explicit sharing and lifetime-leak checks on the per-attempt acquisition foundation. Also restore graph reuse for explicit `fork([], overrides)`, the tracked Minor from the token final review; ordinary `fork()` still reuses its graph.
- [ ] Startup and shutdown: eager acquisition, partial-failure cleanup, cancellation, timeout and late-completion handling, structured aggregate cleanup failures.
- [ ] Composition extensions: direct classes/positional functions, aliases, optional/lazy dependencies, typed contributions.
- [ ] Diagnostics and plugins: typed lifecycle observers, immutable inspection views, validated dynamic plugin boundary.
- [ ] Compatibility and comparison: package consumers, runtime/bundler matrix, reproducible performance and compiler measurements, adversarial integration tests. In the next benchmark-harness change, add direct parent evaluator failure-path tests for malformed JSON/identity/diagnostics, process failures, wrong diagnostic boundaries and TS2589; this is the nonblocking Minor retained by the incremental-check final review.
- [ ] Compiler/inference follow-up: resolve the measured 500/1000 individual-chain limits, large-graph latency, and the inline async richer-selected override combination; preserve all existing contracts and the cast-free predeclared-object workaround. Actual nominal-module 1000-provider gates now pass, separately from registration groups. A bounded inference candidate and its unproved boundaries are recorded in `docs/reports/2026-09-06-inline-fork-inference.md`; it has not been adopted.
  Also resolve the context-sensitive inline nested `snapshot()` factory case
  found during adapter Task3; predeclaring the identical factory preserves exact
  types without annotations/casts. See the provider-transformations report.
- [ ] Release handoff: complete examples, migrations, changelogs, verified tarballs, and safe publication instructions for all three libraries.

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
  The TypeScript 7 experiment has not run and the 5.9.3 production pin is unchanged.
