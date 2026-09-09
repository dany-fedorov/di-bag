# Modern compiler adoption and inline inference

The compiler-adoption checkpoint uses the classic TypeScript 6.0.3 API through the
`@typescript/typescript6` 6.0.2 wrapper. This compiler change, with no production
library signature or runtime change, makes both previously bounded inline forms
supported: a nested method-returning val-box factory and a selected async fork
that consumes a richer service from another selected inline override.

## Toolchain and configuration

The `typescript` development alias is exactly
`npm:@typescript/typescript6@6.0.2`. Its transitive `@typescript/old` dependency
is overridden to exactly `npm:typescript@6.0.3`; `@typescript/old` is not a direct
dependency. The installed wrapper reports package version 6.0.2, while importing
`typescript` reports API version 6.0.3. The development commands use the
wrapper's unambiguous `tsc6` binary.

Strict source checking now uses NodeNext module and resolution modes with the
repository root as `rootDir`. The package build still overrides `rootDir` to
`src` and emits the existing CommonJS `.js` and `.d.ts` distribution. No runtime
dependency, compiler peer, box dependency, global install, deprecation ignore,
or stable-ordering flag was added.

## Regression proof

Before the dependency change, the exact source fixture failed under TypeScript
5.9.3 with TS2345 for the inline nested val-box capability and TS2322 for the
inline richer fork override. Exact assertions also failed with TS2344. The same
fixture failed through both actual installed CommonJS and ESM package routes.
The identical predeclared val-box and fork forms remained controls in the
fixture.

Four proof layers now use the TypeScript 6.0.3 API:

1. The source consumer imports the unchanged producer exports and proves exact
   output, needs, metadata, factory, frame and Promise contracts with zero
   diagnostics.
2. Actual installed package consumers compile the positive and matched negative
   fixtures in CommonJS and ESM modes. Invalid fork dependency shape and invalid
   val-box snapshot capabilities remain rejected.
3. The installed producer emits in memory as `modern-feature.d.cts` and
   `modern-feature.d.mts`, with zero pre-emit or emit diagnostics.
4. A separate downstream program receives only that declaration—the producer
   source is absent—and compiles the unchanged exact consumer assertions with
   zero diagnostics.

The installed real val-box fixture also proves nested inline adaptation through
the archived `val-box` package: the first output is the exact box, the second is
`Promise<number>`, and acquisition metadata is exactly the two ordered val-box
frames.

## Compiler-work gates

Fresh single-worker measurements on Node v24.20.0 and TypeScript 6.0.3 retained
the existing graphs and ceilings:

| Gate | Diagnostics | Instantiations | Ceiling |
| --- | ---: | ---: | ---: |
| 100 chained named additions | 0 | 839,103 | 1,500,000 |
| 100 token bindings | 0 | 1,361,600 | 2,000,000 |

These are bounded regression gates, not universal compiler-performance claims.
The TypeScript 5.9 scale tables and limitations remain historical records; this
adoption does not claim to improve them on 5.9.

## Scope still open

The native verification below is a separate lane, not a claim of full compiler
or enterprise parity. Those original compiler increments did not change ownership,
disposal, borrowing, sharing, factory awaiting, or public library APIs. The later
classification correction described below changes the public acquisition boundary.

## Final-review classification correction, 2026-09-07

Native Promises with a shadowed non-callable `then` are now observed by native state
through an application-local classification context. `di-bag/node` supplies Node's
host predicate through a facade sharing the existing core modules and registries.
The root stays host-independent; applications configure it or select explicit
raw/native stages. Whole-graph preflight rejects missing automatic capability at
finalization before factory effects. Provider types retain an acquired-value
dimension so raw Promise ownership cannot be confused with native fulfillment.
See the [classification design](../superpowers/specs/2026-09-07-acquisition-classification-design.md)
and [migration guide](../migrations/0.1-to-enterprise.md#select-the-runtime-classification-boundary).

The original compiler measurements and 54 native matrix rows below remain historical
evidence for source `cc9dbdcdc70edb9872177b77cddf9767aa0b67ab`; they were not rerun or
relabelled as measurements of this changed API. Fresh correction work gates and
final suite results are recorded separately. Native diagnostic gaps and outstanding
scale/lifecycle work remain open.

The completed correction is committed at `664f6e3c1c7318847409d006560a6ede2e42fc30`.
Scoped review of the full `48752ec..664f6e3` correction closes I1 native-Promise
classification and M2 monitor-failure coverage, with no new Critical/Important
findings. The existing empty-selected-fork optimization remains assigned to
the lifetime increment.

Independent verification of that commit passed 96 runtime/supervisor tests with
457 assertions and 3 focused ownership/replacement type tests with 7 assertions.
The original 54 matrix rows were revalidated against Git source at `cc9dbdc`,
their exact hashes, raw diagnostics and strict outcomes; this adds no new scale
measurement. The final 433-test run and compiler/package evidence appear below.

## Native 7.0.2 contracts and declarations

The additional development alias `@typescript/native: npm:typescript@7.0.2`
resolves the matching native platform package. The harness verifies both package
versions and the actual `lib/tsc --version` before invoking that executable
directly. Classic API 6.0.3 and its 6.0.2 wrapper remain separate identities.
`typecheck:native`, `build:native`, and `check:native` keep this lane explicit.

The original 78-file corpus has 321 primary and 11 supplemental expectations.
Classic matches all 332 strictly. Native matches 294 useful primary messages
and all 11 supplements, and rejects the remaining 27 marked expressions with
three exact, explicitly declared TS2769 fingerprints. Its status is
`accepted-with-diagnostic-gaps`, not useful-message parity. Those gap records
retain the unmet primary requirement. Unknown, stale, misplaced, duplicate or
malformed declarations, wrong fingerprints/code/file/region, absent diagnostics,
TS2589 and unrelated extra errors fail the native gate. Classic receives no
fallback acceptance.

Two added regression files bring the source inventory to 80 files and 323
primary expectations: 296 useful native primary matches, 27 known overload
rejections, 11 matched supplements, zero unexpected diagnostics. They preserve
exact explicit named/token replacement calls and concrete forwarding wrappers,
non-any reflected method returns, builder-view assignment rejection, and safe
module reflection with exact numeric exported consumers and wrong-output
rejection.

An isolated combined replacement overload candidate improved native message
coverage but made standard `ReturnType` fall through to `any`, permitting
cast-free builder-history erasure. It was rejected; **no production signature
change was adopted**. Concrete wrappers using a known builder, key and factory
contract remain the checked forwarding pattern. The unchanged module reflected
view is non-any and retains its named consumer types; unlike the builder view,
its assignment need not be rejected to remain safe.

Both classic and native package emitters build separate actual archives. Native
checks all 17 shared installed fixtures in both `.cts` and `.mts` modes. Each of
the four emitter/mode variants reports exactly four known diagnostic gaps in
the original incremental negative fixture; all other installed fixtures have
zero. The two added fixtures are also in the classic installed lane.
Modern-inline and token-module producers emit actual native `.d.cts`/`.d.mts`
files; after removing producer source, native and classic consumers both check
the unchanged downstream assertions against those physical declarations.

## Supervision and limits

Native compiler invocations use Linux `/proc/<owned-pid>/status`, sampling VmRSS
every 20 ms, with a 60-second timeout, 3,072 MiB threshold and 4 MiB combined
stdout/stderr bound. Timeout, memory, output, monitor and spawn failures retain
explicit process evidence. The direct child is killed and reaped, streams close,
and pending samples finish before completion. Sampled RSS is neither a true
unsampled peak nor a whole-process-tree measurement. Unsupported monitoring
platforms fail explicitly. Native metrics are not substituted for classic
`Program.getInstantiationCount` regression gates.

Package setup resolves the actual Node executable and adjacent real npm CLI;
it does not supervise a launcher shim as though it owned the real npm process.
The harness requires that npm layout and fails visibly if it is unavailable.
The parent evaluator also has direct mutation tests covering malformed worker
JSON, case identity, diagnostic boundaries and raw process failures.

## Original native scale outcomes

All 54 original cases ran sequentially with unchanged source and limits: 28/36
named and 10/18 token cases met the strict matrix contract. No source fixture
gap exception applies to matrices. The named failures were the 100/500
replacement wrong-shape messages, three 1,000-call chained timeouts, and three
1,000-call replacement memory-limit stops. The token failures were all six
500/1,000-module timeouts and TS2589 in the 1,000-binding valid/invariant cases.
The 1,000-binding missing-final-token case passed its intended rejection check;
that alone does not establish general 1,000-binding support.

The [benchmark report](../benchmarks/typescript.md) preserves every case, measured
wall time, sampled RSS and outcome, alongside the unchanged historical 5.9.3
tables. These 16 native matrix failures and the 27 source useful-message gaps
remain open enterprise compiler work. The unrelated empty-selected-fork runtime
efficiency issue is also outside this task. No full native or enterprise
completion, new classic large-matrix result, publication or public API migration
is claimed.

Original integration verification passed `npm run check` (397 tests, zero failures,
1,980 assertions and classic build), then native typecheck/build/source checks
and all four runtime examples. The native source result remains explicitly
`accepted-with-diagnostic-gaps`; passing the integration suite does not convert
the 16 matrix failures into supported scale cases.

## Final-review correction verification

After the acquisition-classification correction, fresh `npm run check` passed
classic no-emit, **433 tests with zero failures and 2,170 assertions** (338.68
seconds), and classic build. The suite includes real installed package CJS/ESM
consumers, both package emitters, declaration-only downstream consumers on both
compiler lanes, real box adapters, Node/Bun root/node registry interoperation,
the portable core boundary, bounded work gates and small native scale controls.

Fresh native typecheck, build and source-contract checks also passed. The source
inventory is now 83 files: 342 primary expectations, 315 useful primary matches,
the same 27 known native rejections, 11/11 supplemental matches, zero unexpected
diagnostics and zero failed files. All three new acquisition-mode fixtures are
strictly accepted with no new diagnostic exceptions. All four migrated runtime
examples passed. Emitted declarations contain no Node type references.

Fresh classic API 6.0.3 measurements on Node v24.20.0 after the acquired-value
type change remain below the unchanged work ceilings:

| Gate | Diagnostics | Instantiations | Ceiling |
| --- | ---: | ---: | ---: |
| 100 chained named additions | 0 | 840,742 | 1,500,000 |
| 100 token bindings | 0 | 1,371,986 | 2,000,000 |

These are correction measurements, separate from the historical measurements
above. The original 54 native matrix rows were not rerun or relabelled. The 16
matrix failures, 27 useful-message gaps, future lifecycle work and M1's explicit
empty-selected-fork optimization remain open; this correction does not claim
native diagnostic parity or enterprise completion.
