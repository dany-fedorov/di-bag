# Typed-token implementation evidence

Status: All three implementation tasks and their independent task reviews are
complete, including the Task3 diagnostic-assertion correction. Broad whole-branch
review remains required. This does not complete the enterprise program or claim
universal type safety.

Spec: `../superpowers/specs/2026-09-07-typed-tokens-design.md`.
Plan: `../superpowers/plans/2026-09-07-typed-tokens.md`.

## Task1: authenticated contracts and shared internal routing

Commit `1048e29ac2ecfa5a742d299bdd81fec40cab97e3` adds genuine frozen tokens,
invariant key/service identity, a fourth provider graph contract, checked internal
token source/binding helpers, and declared-symbol routing through the existing
acquisition graph. Metadata, mappings, disposal and both optional box adapters
preserve the graph contract. Ordinary factory values and native Promise identity
retain their existing behavior.

The public addition at this checkpoint is `DiBag.token(key).of<Service>()` and
type views. Nonempty or opaque token graphs are temporarily rejected by public
named composition until Task2 supplies complete token graph checks. Public
fromTokens/bind/resolve/fork/module token APIs were deferred to Task2, now below.

RED began with missing APIs, separately from runtime behavior. Once handles and
the graph slot API existed, runtime tests produced3pass/7fail: selected arguments
were undefined, a token cycle did not throw and a Promise value was absent. Symbol
routing made those cases pass. An explicit-never key fixture then exposed a
missing arity rejection; a conditional arity guard addressed it without widening
normal key inference. No source/emitted type proof relies on a cast.

Verification on the committed implementation:

- Implementer `npm run check`:264pass/0fail/1560assertions across15files,
  305.77seconds of tests; strict typecheck and final declaration build passed.
  Existing100/1000-provider controls, named-module scales, source/owned cleanup,
  native Promise regressions and real package consumers all remain in that run.
- All3 existing examples passed: WBS ownership ordering, modules/fork behavior,
  and real box projections with original ownership.
- Controller independent strict typecheck/build and focused runtime/source/
  emitted/actual CJS/ESM artifact checks:30pass/0fail/250assertions in8.47seconds,
  followed by all3 examples and a clean diff check.
- No source or test changes occurred after the full run began. A restricted
  artifact attempt with empty output was not counted as success; actual artifact
  checks were rerun with approved execution permissions and visible results.
- Initial independent task review: spec compliant, task quality Approved, no
  Critical/Important/Minor findings. The controller retained full-run evidence for
  unchanged native/cleanup/inference paths that the task diff alone cannot prove.

Both independent box checkouts remain clean at sas-box `b895f9d` and val-box
`07506fc`; token integration needed no additional box implementation change.
No package was published and no branch was merged or deleted.

## Task2: checked public and module composition

Commit `d58937cd95cea87d438fc8fec00c698f9dd66325` adds public fromTokens,
root/module bind and token replace, exact token resolve/inspect, mixed exports and
selected fork overrides. Tagged module C retains named/token exported/external
requirements, while public D projects zero needs and preserves exact output,
metadata, frames and bound token contracts. Private token IDs are fresh per
installation. No fifth Module generic or separate token runtime was added.

The actual feature-library declaration test exposed TS4118 at the inferred
feature export. Distributing `Record<TokenKey<T>, TokenService<T>>` over external
requirements preserved a serializable named representation, with no user cast or
annotation. Its unchanged consumer then passes against the emitted feature,
with an explicit assertion that the source feature is absent. Missing external
token rejection and exact provides/requires remain checked. Self-review also
added regressions for an opaque bound contract and ambiguous union token reads.

Verification:

- Full `npm run check`:287pass/0fail/1812assertions across16files in357.95seconds;
  strict typecheck/build, all unchanged scale gates, all3examples and diffcheck.
- Two later fixture-only exact assertions cover ModuleBuilder token replacement
  and token-bound frame inspection. Strict typecheck and source/emitted/installed
  CJS/ESM covering checks pass5tests/5assertions after those additions. No production
  changes followed the full run. A duplicate inline import in the fixture was
  consolidated into its top-level public import before accepting that covering run.
- Controller committed-state strict builds and45focused source/runtime/emitted/
  real-package tests passed472assertions in17.45seconds, including actual feature
  emission and unchanged consumption. All3examples passed. A separate unfiltered
  token runtime run passed18tests/67assertions, including duplicate-symbol atomic
  rejection and builder reuse. These runs overlap; their counts are not additive.
- Independent task review:spec compliant, task quality Approved, no Critical or
  Important findings. Existing runtime/index interfaces were checked as concrete
  integration points and needed no redundant edits.

One Minor performance finding remains for the broad final review: bulk fork
currently reconstructs the immutable graph per selected override, approximately
O(KN+K²) rather than the previous batched O(N+K). A symbol-capable batch graph
operation is the proposed correction. This is recorded, not silently discarded;
the token increment's final review/fix pass has not run yet.

## Task3: installed packages, bounded compiler controls and documentation

The actual packed `di-bag` artifact now has reciprocal Node loader evidence:
the CommonJS consumer creates tokens/providers through `require` and composes
them through ESM, while the ESM consumer performs the inverse. Both paths retain
private module installation isolation, public computed-symbol fork overrides,
plain service payloads and raw Promise identity on synchronous token injection.
The pinned real sas-box/val-box archives also compose through `fromTokens`, both
adapters, static metadata and typed frames. The bag explicitly cleans the original
boxes; the unchanged core-only consumer installs and loads neither box package.

Most new integration coverage was first-green against Task2. The installed
library-author declaration case was a real RED that the earlier local-source gate
could not expose: inferred `.cts` and `.mts` feature emission both reported
TS2742 because the retained module type needed non-portable
`node_modules/di-bag/dist/{module-types,token-types,types}` names. Type-only root
exports for exactly `PublicProviders`, `Binding`, `TokenGraph`, `From` and
`Provided` made those inferred declarations portable without a user cast,
annotation erasure, runtime entrypoint change, internal subpath export or carrier
redesign. The unchanged Task2 consumer is compiled in both modes with the feature
source hidden and its import explicitly resolved to the emitted sibling
`.d.cts`/`.d.mts` output.

The first restricted token-worker test produced status0 with empty captured
stdout/stderr and then failed JSON parsing. A minimal Bun-to-Volta-Node probe
reproduced that only under restricted execution; approved execution captured the
expected output. The temporary result-file fallback was removed. The committed
gate reads stdout only after checking status, signal, spawn error and stderr, and
every intended negative must point into the generated source with no TS2589,
timeout or OOM acceptance. Initial diagnostic-line/message expectation failures
were test-wiring corrections; direct worker output already showed the intended
public graph rejections, so they were not recorded as production RED.

Fresh single-worker evidence on Node24.20.0/TypeScript5.9.3:

- 100 bindings valid:4605ms,877MiB maximum RSS,0 diagnostics.
- 100 bindings missing-final-token:4476ms,873MiB, TS2684 at the marked final
  graph boundary with `missing factories`.
- 100 bindings mismatched invariant service:4518ms,874MiB, TS2684/TS2345;
  the marked bind rejects the same key declared as `number|string` while the
  actual `number` output and the callback body remain valid.
- 100 distinct modules valid:5078ms,775MiB maximum RSS,0 diagnostics.
- 100 distinct modules missing-final-token:5073ms,780MiB, TS2684 at the marked
  final graph boundary with `missing factories`.
- 100 distinct modules mismatched invariant service:5132ms,782MiB, TS2345 at
  the marked final install with `a dependency has the wrong shape`.

These are one-machine process maximums, not portable budgets. They cover exactly
100 individual bindings and 100 distinct modules in fresh 60-second-bounded Node
workers. They preserve all existing named/grouped/module gates, but do not satisfy
the larger T2/compiler-latency obligations of the enterprise program.

Implementer verification after the final source/test change:

- `npm run check`: strict typecheck,297pass/0fail/1866assertions across18files
  in372.21seconds, followed by a successful declaration build. This includes all
  installed package/box tests, six isolated token workers and every unchanged
  100/1,000-provider scale gate.
- Focused installed token package:4pass/0fail/14assertions after a real pack and
  offline install. Focused pinned real-box package:22pass/0fail/284assertions.
  Focused token scale:6pass/0fail/40assertions in31.22seconds.
- All4 runnable examples passed: WBS scope ownership, named modules, real box
  adapters and the new canonical-token/private-owner/public-fork example.
- No runtime dependency or box implementation changed. The implementer did not
  publish or push; the controller coordinates authorized checkpoint pushes.

Task3 is committed at `8088852`, with the test-only review correction at `887d417`.
Controller independent committed-state verification passed strict builds,
32actual package/box/isolated compiler tests with338assertions in45.16seconds,
18source/emitted token/feature tests with253assertions in10.22seconds, all4examples
and diffcheck. These covering checks complement, not replace, the full run above.

The initial task review found one Important assertion weakness: the scale test
separately required a diagnostic at the marked line and the intended message
somewhere in the file. `887d417` now requires one diagnostic to satisfy both. The
implementer's covering rerun passed6tests/36assertions in30.98seconds; the
controller independently reran the committed correction with6tests/36assertions
in31.08seconds. No production or other test source changed after the full run.
Scoped re-review: finding addressed, no new breakage or other observations. Task3
is complete after one fix round. Broad final review and its fix wave follow.

## Whole-branch review and consolidated correction

The broad review covered the actual main merge-base `94d9e52` through `b505d66`
(40 commits). It found no Critical defect, one Important bulk-fork performance
regression, and two Minor documentation inaccuracies. Every selected override
rebuilt the whole binding graph; a 1,000-override synchronous fork took about
1,088 ms in a single reviewer probe. The README also overstated what module C
retains, and one migration paragraph still described a failed incoming edge as
retained. No binding design change was needed.

The single consolidated fix is `75bc1f9`:

- `Bag.fork` retains indexed selection snapshots and complete preflight, then
  reads/normalizes selected values in order and applies one mixed string/symbol
  batch. Existing named and single-binding graph helpers share that operation.
- Regression tests preserve duplicate getter order, final replacement routing,
  private module identity, independent parent/child ownership and exact-one-batch
  construction. The test guards reconstruction count, not a timing threshold.
- README clarifies that D is the zero-needs public projection and C retains
  exported/external requirements of all local consumers, including private ones.
  Satisfied private requirements do not become host constraints. This is the
  precise interpretation of the projection ruling below.
- Migration now describes abandoned failed incoming reads and retained outgoing
  dependencies/pending/owned cleanup on the failed acquisition itself.

RED demonstrated two failures: two single-binding calls where zero were expected,
and the absent batch operation. GREEN passed 29 tests / 94 assertions after a
test fixture stopped returning the live dependency proxy to a deep-equality
assertion. Six covering runtime files passed 65 tests / 211 assertions.

Full `npm run check` passed 300 tests / 1,877 assertions across 18 files in
379.30 seconds, strict typecheck and declaration build. All four examples passed.
The only later change strengthened the deterministic test to require exactly one
batch call; its boundary-file rerun passed 15 tests / 42 assertions. No production
code changed after the full run.

Controller independent committed-state checks passed strict builds, 77 runtime
and real token/box package tests / 477 assertions in 14.73 seconds, all four
examples, and a separate 14-test / 35-assertion general runtime run. That separate
run corrected the controller command's mistaken absent `tests/di-bag.test.ts`
path to the actual `tests/runtime.test.ts`; no absent file is counted as tested.
All commands and diff checks exited successfully.

Supporting measurements for 100 / 1,000 overrides were 0.626 / 3.156 ms in the
implementer's run and 0.775 / 3.091 ms in the controller's independent run,
resolving the final slot to 99 / 999. These are individual Bun 1.4.0 observations
without statistical controls, not portable performance guarantees. The structural
correction is one graph reconstruction per fork, preserving its public contracts.

The single scoped final re-review marks all three original findings addressed,
with no new Critical or Important breakage. One Minor remains: explicit
`fork([], overrides)` now reconstructs the graph in O(N) instead of reusing it.
Ordinary `fork()` still reuses the graph, and service/ownership correctness is
unchanged. It is explicitly deferred to the next runtime/lifecycle increment,
not waived from enterprise completion. No second fix wave was dispatched.

## Decisions and costs retained for the final review

Ruling: Capture caller-declared unique symbols in invariant token handles — equal
service types or labels cannot distinguish independent token identities — cost
if wrong is an extra key declaration and explicit canonical-token exports.

Ruling: Use one fourth provider graph contract plus existing module C/D — the
bounded corrected model retains token identity/needs without a parallel container
or fifth module generic — cost if wrong is type-instantiation and annotation
complexity; production inference and scale gates remain mandatory.

Ruling: Keep export-time public zero-needs projection, not the prototype's
install-time projection — current module architecture separates private needs in
C before public D escapes — cost if wrong is additional integration work beyond
the bounded model, to be covered by private/public/external token tests.

Ruling: Use explicit finite token tuples for positional injection while preserving
ordinary named factories — this supplies real runtime dependencies without
parameter parsing or hidden mapping-width effects — cost if wrong is positional
declaration verbosity and eager acquisition of every selected token; optional/lazy
adapters remain separate required enterprise extensions.

Ruling: Keep a temporary rejection for nonempty/opaque token graph contracts until
Task2's checked composition is implemented — internal foundations must not create
an unchecked public add/end path — cost if wrong is temporary unsupported internal
composition and test transition work; the completed increment must remove this
restriction through real validation, not narrow the final feature scope.

Ruling: Correct Task3's isolation reference to scripts/benchmark-types.ts and add
scripts/check-token-scale.ts as the single-case worker — actual type-scale tests
use in-process diagnostics with120-second test timeouts, whereas the benchmark
already uses isolated60-second Node children — cost if wrong is a small additional
test-worker file; existing production gates stay unchanged and token gates still
require real source calls, exact rejection locations and successful child exits.

Ruling: Make Task2's cross-file declaration obligation explicit by emitting the
feature producer's declarations and compiling its unchanged consumer against them
— compiling an application against di-bag.d.ts alone does not detect anonymous
unique-symbol export failures such as the carrier prototype's TS4118 — cost if
wrong is an additional compiler fixture phase; it does not add a new public API
or relax any identity/inference requirement.

Ruling: Permit the smallest necessary type-only public naming/export corrections
in Task3 to make inferred installed-package feature declarations portable — the
spec's reusable module/source-emitted contract and enterprise TypeScript goal take
precedence over the plan's assumption that package exports need no changes — cost
if wrong is a larger public type surface or annotation compatibility work. The
correction does not expose unchecked runtime constructors, blanket internal
subpaths or a new carrier.

Ruling: Defer the empty-selected-fork graph-reuse optimization to the next runtime/
lifecycle increment — it is a real but non-load-bearing Minor, ordinary fork()
retains graph reuse, and the single final fix wave is complete — cost if wrong
is avoidable O(N) synchronous work for explicit fork([], overrides) until that
follow-up; retain it as required runtime work before enterprise completion.

## Remaining work

The typed-token increment is complete through `75bc1f9`, with all three broad
review findings addressed and one explicitly deferred empty-selection efficiency
Minor. Larger T2, lifetimes,
startup/cancellation, extensions, observers/plugins, platform/comparison evidence
and release handoff remain required.

Current-source T2 evidence is recorded separately in
[incremental checker measurements](2026-09-07-current-incremental-check.md) and
[inline inference reproduction](2026-09-07-current-inline-inference.md). Both are
unadopted investigations, not extra production changes in this token fix wave.
