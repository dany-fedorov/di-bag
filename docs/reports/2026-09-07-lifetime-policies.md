# Lifetime policies: runtime and static integration

Date: 2026-09-07. The internal declaration checkpoint is now integrated with
runtime ownership and the public `DiBag.withLifetime` facade member. `Lifetime`
is a type-only package export. Physical installed-package lifetime acceptance
now covers both emitters and every existing Node/Bun CommonJS/ESM route.

The authenticated provider description now carries a frozen lifetime record.
Descriptions default to scoped; a replacement wrapper snapshots root capture
options once and preserves the source, owned stages, metadata, frames, tokens,
and acquired-value contract. Metadata copies the complete description. Token
rebinding changes only its binding field.

Graph completion and selected independent forks check strict roots. One lexical
traversal follows named/token edges through transients, stops at another root,
and rejects a scoped dependency with root/dependency identities. Public and
private visited sites are separate. Policy-bearing module exports retain their
local graph and renamed export mapping; private roots remain constraints even
in exportless modules. Replacing an exported root replaces its public lifetime
obligation. Default modules retain compatibility with existing annotations.

Capture permission requires a statically present literal true. Boolean values,
optional fields, and options that might be undefined remain strict. Separate
required-option overloads prevent explicit capture type arguments from granting
permission when the runtime options argument is omitted. Union validation
checks every option/registration branch, including through `NoInfer`.

## Compiler evidence and representation cost

The unannotated producer exports providers, builders, modules, bags, scopes,
named/token forks, raw/native acquisitions, and frames. Its unchanged consumer
asserts exact values and non-any inference. Both compilers also check copies of
that consumer against emitted declarations with producer sources absent. This
is early declaration integration evidence, not the later installed-package
lifetime acceptance claim.

| Task 1 bounded check | Classic API 6.0.3¹ | Native 7.0.2 |
| --- | ---: | ---: |
| Producer declaration bytes | 42,000 | 42,000 |
| All emitted declaration bytes | 106,505 | 106,505 |
| Producer emission time | 1,311 ms | 129 ms |
| Emitted consumer check time | 445 ms | 247 ms |
| Producer/consumer diagnostics | 0 / 0 | 0 / 0 |

¹ The installed classic wrapper is `@typescript/typescript6` 6.0.2, whose
compiler API reports the pinned underlying 6.0.3 implementation. Timings are
single observations during other checks, not comparative benchmarks.

Actual emitter failures determined two new root type-only exports: `Builder`
(TS4023/4094/7056 on an inferred builder) and `ModulePublicProviders` (native
installed-producer TS2883). A named internal `ReboundProviders` mapped alias
removed TS4118 on inferred symbol-selected forks. No producer annotation or
diagnostic allowance was added to address these failures.

## Verification

- Focused declaration/source/emitted-consumer tests: 7 passing, 54 assertions.
- Final full type suite plus lifetime declaration tests: 87 passing tests,
  382 assertions after the diagnostic-precedence correction.
- Lifetime negative fixture: 47 exact diagnostic markers on both compilers;
  no supplemental lifetime diagnostics or lifetime allowances.
- Final classic/native typechecks and classic build: exit 0.
- Final native source gate: 89 files, 407 expected diagnostics, 380 matched,
  27 previously recorded unrelated native diagnostic gaps, zero failures or
  unexpected diagnostics. All 47 lifetime markers match directly.
- A stable `npm run check` passed all 464 tests (2,383 assertions), followed
  by a successful build. An earlier overlapping integration run exposed two
  installed-producer TS2883 errors, fixed by the specific type-only export.
- After that full pass, a narrow type-only guard correction preserved shape
  and missing-dependency diagnostic precedence for chained calls and local
  module graphs. Final coverage reran the entire type suite plus declaration
  tests, both typechecks, the native source audit and both emitted consumers.
  Runtime/scale implementation did not change after the full pass.
- All existing named, token, incremental, and benchmark scale checks passed in
  the full run, including 1,000-provider named modules; no compiler timeout or
  excessive-instantiation diagnostic was accepted as a useful rejection.

The results above describe the internal declaration checkpoint. Runtime,
public-facade and physical installed-package evidence follows below.

## Runtime ownership and public facade

Each scope retains its local attempts, scoped cache and finalizers. Root reads
route to the original family root's acquisitions and graph; transient reads
create an independently owned attempt each time. Root inspection reads the root
attempts without acquiring, while scoped/transient inspection stays local.
Independent forks begin new families, and `scope()` still accepts no arguments.

A focused family index shares acquisition identities and dependency traversal,
but never finalizers. Active binding/owner ancestry catches transient recursion,
including synchronous public reentry, while acquisition-ID edges retain cached
and post-await cycle detection. Ancestry contains symbol IDs, not references to
ancestor acquisitions or child owners. Failed/closed attempts leave the family
index. Failed incoming edges are abandoned across owners while outgoing rollback
dependencies survive until cleanup finishes. Ready and retired ancestry does not
block a later legitimate transient acquisition.

Strict root boundaries travel on dependency proxies through transients and
survive `await` and retained methods. Scoped reads reject before the factory or
cached value is reached. A root dependency establishes its own boundary, so an
explicitly capturing root can supply a strict root using root-context state.
Unchecked captive fixtures use one named JS graph-completion boundary; normal
fixtures exercise the public typed facade.

Provider execution, stage acceptance, native/raw classification and original
Promise identity are unchanged. In-flight sources retain their own closing
permission even when a projection is ready or failed. Public resolution closes
immediately. Child draining permits late root acquisition, and the existing
shutdown tree gates root cleanup behind child settlement.

Concrete ownership evidence includes two transient attempts returning the exact
same object and yielding two separate cleanup failure records/IDs. Child-first
root capture disposes child scoped state first, then root, root-owned transient,
and root-owned scoped dependency. Renamed module transient exports dispose child
attempts `[3, 2]`, then parent attempt `4`, then their shared private root `1`.
Late root acquisition records `root:open`, `child:close`, `root:close`.

The first public-operation RED ran 11 tests: 0 passed, 11 failed because
`DiBag.withLifetime` did not exist. After routing and facade implementation the
initial focused regression run passed 30 tests with 182 assertions. Expanded
self-review coverage passes 47 lifetime/scope/acquisition tests (252 assertions),
including 28 new lifetime tests, and 68 provider/module/token/disposal/mode tests
(290 assertions). Focused lifetime type/declaration selection passes 5 tests
(39 assertions), including all lifetime negative diagnostic markers and the
virtual source-erased declaration consumer. No new concrete type export beyond
the requested `Lifetime` was necessary for the public facade.

Final runtime/public integration gates ran after self-review with no overlapping
source changes. `npm run check` passed the classic typecheck, all 492 tests
(2,514 assertions across 29 files, 386.56 s), and the final classic build.
`npm run typecheck:native` passed. `npm run check:native` accepted 89 files:
407 expected diagnostics, 380 directly matched, 27 previously recorded unrelated
native diagnostic gaps, zero unexpected diagnostics and zero failures. All 47
lifetime negative markers matched directly with no gaps or allowances. The full
run also passed both existing native installed-archive suites and all scale
fixtures, including the three 1,000-provider reusable named-module cases. There
were no later production or test changes after these final gates.

## Review and independent checks

Task 1 committed as `9b869a3`. Its task review approved both specification
compliance and quality with no findings. Independent committed-code verification
passed seven focused declaration/type tests (54 assertions), including the
virtual-source-erased consumer. A separate repeat of both actual emitters and
copied source-absent consumers produced zero diagnostics and the declaration
sizes above. These are early declaration checks, not installed lifetime runtime
coverage; the existing package routes continue to pass.

Task 2 committed as `9aa95df`. Its specification and quality review is approved
with no findings. Independent committed-code coverage passes 119 runtime and
declaration tests (585 assertions), including lifetime, scope, acquisition,
provider, module, token-module, disposal and classification regressions.
Both actual emitters and copied source-absent consumers again produce zero
diagnostics with the public facade: 42,000 producer declaration bytes and
107,942 total declaration bytes per compiler. The added runtime declarations
account for the total-size change from the internal-only checkpoint above.
Equal byte counts do not mean byte-identical compiler output. This verification
still does not substitute for Task 3's installed lifetime acceptance routes.

## Physical installed package checkpoint

The first classic installed-producer emission reached the real lifetime source
and failed with portable-name diagnostics before downstream consumption. The
unique required aliases were `LexicalContext`, `RenamedLifetimeProviders`,
`RenamedLifetimeObligation`, `CheckedLifetimes`, `Renamed`, `Merge`, `Selected`,
`Checked`, `Complete`, `ForkContext`, `Overrides`, `Selection`, `ReboundProviders`,
`ReboundSelection`, `SelectionKey` and `Registration`. Those exact names are now
type-only root exports. No producer annotation, runtime helper, public subpath or
diagnostic allowance was added. The native emitter required no additional name.

After that correction, the classic and native archive lanes each passed one
test with 168 assertions. Each emitter built and packed a physical package,
installed it twice, removed the unannotated lifetime producer source after
emission, and checked the same downstream consumer against `.d.cts` and `.d.mts`
output with both compilers. Positive lifetime contracts passed and all 47
negative lifetime regions retained useful diagnostics with zero lifetime gaps.
The shared direct installed fixture lane separately passed four CJS/ESM positive
and negative lifetime checks with eight assertions.

The two emitters, two module formats and two runtimes produced eight successful
archive executions. Each had exit status 0, null signal, no termination reason,
empty stderr and exact output
`{"log":[2,1,3],"rootDisposed":1,"scopedDisposed":1,"transientsDisposed":2}`.
The script constructs the root from the child first, observes one shared root,
two distinct child transients, child-scoped cleanup on child close, no root
cleanup until parent close, and independent fork cleanup last.

The final bounded source declaration check after the installed-emitter aliases
produced 41,477-byte lifetime declarations and 107,690 total declaration bytes
with each compiler. Classic API 6.0.3 emitted in 1,076 ms and checked the
source-absent consumer in 367 ms; native 7.0.2 emitted in 121 ms and checked it
in 223 ms. Both producer and consumer phases reported zero diagnostics. Equal
sizes do not claim byte-identical emitted declarations. Relative to the Task 2
measurement, public aliases shorten the emitter's inferred spelling while adding
16 maintained public type names; that compatibility surface is the principal
representation cost.

The Task 3 implementation checkpoint ran after the implementation and harness
self-review. `npm run check` passed the classic typecheck, all 500 tests (2,567
assertions across 29 files in 384.00 seconds), and the classic build. Native
typecheck and native build both exited 0. The native source audit accepted all
89 fixtures: 407 expected diagnostics, 380 directly matched, 27 previously
recorded unrelated gaps, zero unexpected diagnostics and zero failures. The
modules, tokens, box-adapters and WBS examples all exited 0 with their expected
output. A later README-only correction clarified that lifetime selects cache and
attempt ownership while `withDisposal` transfers cleanup responsibility; it did
not change the verified implementation or package harness.

## Final review and independent acceptance

Task 3 is committed as `f55f5a1`; its specification and quality review is
approved with no findings. The final integrated review of `94d9e52..f55f5a1`
also found no Critical, Important or Minor issue. It covered the active runtime,
type integration, lifetime regressions, package boundaries and binding specs;
it does not claim exhaustive reinspection of every older historical snapshot.
No correction wave or deferred review finding remains for this increment.

Independent verification on the committed implementation passed:

- `npm run check`: classic typecheck/build, 500 tests, zero failures and 2,567
  assertions across 29 files (447.76 seconds).
- The native-emitted installed archive lane: 168 assertions, including all four
  Node/Bun CJS/ESM executions and both source-erased declaration consumers.
- Native typecheck and build, then the 89-file source audit: 407 expected
  diagnostics, 380 direct matches, 27 unchanged unrelated diagnostic-quality
  gaps, zero unexpected diagnostics and zero failures. Lifetime markers match
  47/47 directly, with zero lifetime gaps.
- All four examples (`modules`, `tokens`, `box-adapters`, `wbs-scope`) and
  `git diff --check`: exit 0.

No implementation or test change followed these gates. Final edits record
evidence and completed plan steps only. Both related repositories were checked
clean and remote-matching: sas-box `b895f9d` and val-box `07506fc` on their
`feat/enterprise-foundations` branches; lifetimes required no further box change.
This finishes the policy/captive-check increment, not selected sharing, child
overrides, startup, context/cancellation or the enterprise program. The feature
checkout and its evidence workspace are retained; no package was published.

## Decisions and costs

1. Implement policies before scope options. This avoids ambiguous root context;
   sharing and child overrides require a later integration pass.
2. Validate captivity at end/fork. This limits repeated graph traversal but
   reports lifetime errors at graph completion.
3. Each root establishes its own capture boundary. Strict A can consume an
   explicitly capturing root B; separate strict roots still validate independently.
4. Retain lifetime topology only where current captive checks need it. Default
   modules stay lightweight; partial sharing must revisit this elision rule.
5. Outer lifetime wrappers replace policy, not ownership stages. Wrapper order
   matters for caching, while disposer/value pairings remain unchanged.
6. Require known lifetime literals and snapshot supported own options. Dynamic
   choices require branching; inherited option declarations reject.
7. Keep the helper internal until routing works. The earlier internal-only
   checkpoint is now followed by runtime routing and public facade integration.
8. Preserve the approved checkout and evidence workspaces. There is no extra
   worktree isolation; one writer and explicit staging protect user state.
9. Guard active transient construction, not ready historical ancestry. Later
   lazy unrolling is supported; actual ID cycles and capture rules still apply.
10. Export `Builder` type-only after concrete emitter failures. Its name becomes
    a public type compatibility commitment, without exposing its constructor.
11. Export `ModulePublicProviders` type-only after installed producer TS2883.
    This preserves inference at the cost of another maintained public type name.
12. Export only the 16 aliases named by actual installed-producer diagnostics.
    This preserves the exact unannotated producer through physical package
    emission, at the cost of those public type-name compatibility commitments.
