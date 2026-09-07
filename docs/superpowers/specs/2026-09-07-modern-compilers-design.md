# Modern compiler support and inference design

Date: 2026-09-07. Baseline: `46d3b08e1f9cf657f0f1b04e1937c57f987e0432`.
Selected under the user's continuous plan-and-implement authorization. This is
the next enterprise T2/Q1 increment, not completion of the enterprise program.
Binding program: `2026-09-06-enterprise-di-design.md`.

Final-review correction Ruling9: Tasks1/2 retain their no-production-change
boundary and completed evidence. The single final correction wave additionally
implements `2026-09-07-acquisition-classification-design.md` to repair Important
I1. Its scoped runtime/API changes supersede this document's no-change wording
only for that correction; the original compiler matrices remain historical.

## Objective and evidence

Make the two previously failing inline inference cases supported, regression-
tested public contracts on a modern compiler, then verify the original large
graphs and package consumers with the current native compiler. Preserve exact
outputs, dependencies, metadata, acquisition frames and graph constraints without
changing library signatures or weakening inputs.

The isolated comparison in `docs/reports/2026-09-07-typescript6-inference.md`
already proves both reproductions and 129 selected negative boundaries against
source/emitted declarations on TypeScript 6.0.3. Actual installed consumers and
the complete contract suite are still required before adoption. TypeScript 7.0.2
is the verified current npm release. Its classic `createProgram` API is absent;
the native CLI and the classic API must remain separate verification lanes.

The official `@typescript/typescript6` compatibility wrapper is version 6.0.2,
not 6.0.3. It delegates to `@typescript/old` (`npm:typescript@^6`). A temporary
installation resolves that implementation to 6.0.3; its compiler JS SHA-256 is
identical to the previously tested plain 6.0.3 package. Pin the implementation
alias through an exact npm override as well as pinning the wrapper, rather than
relying on that range. Do not make `@typescript/old` a direct development
dependency: its `tsc` bin would compete with the native compiler's command.

## Alternatives and selection

1. Selected: official side-by-side tooling. Use the classic 6.0.3 API for existing
   diagnostic fixtures/work counters and native 7.0.2 CLI for independent package,
   source and scaling evidence. Both remain development-only dependencies.
2. Keep 5.9.3 primary and continue changing contextual signatures. Prior probes
   failed or introduced weaker preliminary inputs; this retains demonstrated
   compiler limitations despite the modern compiler fixing both reproductions.
3. Replace the classic harness wholesale with native or unstable APIs. This loses
   established compiler-work evidence and couples tests to a different API before
   equivalent diagnostic and declaration coverage exists.

The cost of the selected approach is two compiler lanes and a documented supported
compiler floor of 6.0.3 for the new inference guarantees. Preserve all 5.9.3
measurements as labeled history; do not imply those old failures were repaired on
5.9.3. JavaScript runtime consumers acquire no new dependency or runtime minimum.

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

The controller has separate authority for ordinary feature-branch pushes in all
three repos. No publication, PR, merge, credential storage or workspace cleanup.
Work in the existing approved `feat/v0.1` checkout. Box repos remain unchanged
unless a demonstrated package defect requires its own scoped correction.

## Classic API lane and inference adoption

Pin development alias `typescript: npm:@typescript/typescript6@6.0.2` and npm
override `@typescript/old: npm:typescript@6.0.3`, with a checked lockfile. Classic scripts
use `tsc6`; package tests use `node node_modules/typescript/bin/tsc6` explicitly.
Move source/build configuration and the compiler helper to explicit NodeNext
module/resolution, retaining ES2022 and all current strictness flags. Existing
package scope remains CommonJS; runtime output/export format must not change.
Do not add `ignoreDeprecations`, optional compiler transforms or callback erasure.

Before the version change, real repository source and installed fixtures must
reproduce the inline nested-snapshot TS2345 and richer-selected async-fork TS2322
failures, with their failed exact assertions. Keep the predeclared controls.
After adoption, source, installed CJS/ESM, feature declaration emission and
unchanged downstream consumers must pass without annotated substitute factories.
Add matched invalid inline cases and preserve every existing negative fixture.
Include a real ValBox nested inline snapshot in actual installed box consumption.

The actual API must report 6.0.3. Keep the existing 100-case work ceilings of
1,500,000 named and 2,000,000 token instantiations provisionally; measure them on
the new compiler and report exact values separately from 5.9 history. A ceiling
failure requires evidence and a controller decision, not automatic relaxation.
No new runtime or public declaration export is planned. A demonstrated inferred
declaration naming failure must be reported before any export/API expansion.

## Native lane and supervised execution

Pin `@typescript/native: npm:typescript@7.0.2`. Its `tsc` is distinct from `tsc6`.
Add explicit native typecheck/build/check commands, but do not silently replace
classic API counters with native metrics. The native binary's exact version and
platform package version are checked before use. Use the published platform
executable directly for supervised work, not a wrapper process whose child's RSS
would be missed. Do not use the package's unstable API exports.

Native report workers run sequentially, with a 60-second timeout, 3,072 MiB
observed-RSS termination threshold, 20 ms sampling and bounded output. Node heap
flags do not constrain Go. Record sampled peak RSS honestly, not an exact kernel
maximum or a hard instantaneous ceiling. The supervised report lane is Linux-only
until another OS has equivalent measured memory supervision; unsupported hosts
must fail clearly rather than silently dropping the bound. Ordinary CLI commands
remain available wherever the compiler's own platform package runs.

The supervisor must terminate and reap a child on timeout, memory threshold,
output overflow or monitor failure, and clear all timers/listeners. Preserve
stdout, stderr, exit status, signal and termination reason. Test these paths with
small real children; do not allocate gigabytes or leave background processes.
Compiler error exit codes are distinct from supervisor failures. CLI diagnostics
must be parsed with their actual file, line, column, code and multiline message;
unexpected non-diagnostic output/configuration failures cannot become acceptance.

Use physical scratch projects for native checking, with unmodified production
source, explicit compiler options and actual root files. For generated graphs,
retain the original relative import layout, source forms, counts and boundary
lines. Copies into scratch are file placement, not source/AST rewrites. Bound
temporary artifacts to owned paths; preserve matrix evidence in this plan's
workspace. No alternative statement syntax, grouping, changed stack or erased
types may stand in for an originally failing graph.

## Package and scale coverage

Diagnostic fixture refinement after actual cross-lane comparison: retain all
invalid programs and321 primary marked requirements. Seven fork marker messages
must retain their exact offending factory/value text and `is not assignable to
type`, without depending on which internal union member prints first. The missing
token generic marker uses the shared `Property '[key]' is missing` message;
classic reports TS2344 with that detail and native reports TS2741 directly.
Eleven existing cascade errors also occur on classic6.0.3. Declare them explicitly
with `// diagnostic-also: TS2684 missing factories` (ten cases) or
`// diagnostic-also: TS2345 add introduces new tokens only` (indexed registration),
associated with the preceding primary marker's region. A shared matcher requires
the exact supplemental code, message, source file and region in addition to the
primary requirement. No arbitrary same-region error is accepted. Both source
compiler lanes must check321 primary plus11 supplementary expectations.
This changes comments/verification only, not program bodies or input contracts.

### Native diagnostic-quality limitation (controller Ruling7)

Keep the existing production signatures. An isolated combined replacement
overload preserved direct-call inference and all original invalid inputs, but
made ReturnType<typeof builder.replace> become any. That enabled cast-free
erasure of a dependency-bearing builder and an unsafe replacement. The attempted
neutral validation correction did not close it. No experimental signature or
union-alias comment is adopted. Standard utility-type non-any and history-view
regressions must preserve the existing safe behavior. A dependency-bearing
builder assignment through its reflected replacement return type rejects.
The analogous module view is assignable but retains its consumer contracts:
exports/install/resolve still infer number, and assigning that result to string
rejects. Test those actual invariants, not a blanket ban on safe module views.

Distinguish native rejection evidence from native diagnostic-quality parity.
The unchanged source has27 replacement calls where native7.0.2 emits TS2769 at
the intended call but prints only the last token overload. Classic6.0.3 still
must match every original useful message. Declare those27 native gaps explicitly
beside their existing primary markers, without changing any invalid program or
primary requirement. A native-only matcher may recognize only their exact
observed TS2769 fingerprints, in the same file and primary region. There are
three fingerprints: the ordinary string argument, the string-union form with
its additional intersection elaboration, and the open-template argument.
No generic TS2769, never, unrelated error, missing rejection, configuration
failure, TS2589 or extra diagnostic may stand in for a declared gap.

Require separate counts for original useful matches, explicit native overload
rejections and supplemental matches. The baseline is321primary requirements:
294useful native matches and27declared overload rejections, plus11supplemental
matches. Do not report332useful native messages or full diagnostic parity.
Installed consumers use the same declarations/fingerprints; four such gaps occur
in negative/incremental.ts per emitter/module-mode variant. Unknown, duplicate,
misplaced and stale gap declarations fail, and classic matching never uses them.
Direct mutation tests must prove these boundaries. Added regression fixtures
increase totals explicitly; they do not replace any original expectation.

The native source/package rejection gates may pass with these explicitly counted
diagnostic limitations before the large reports run. Native diagnostic-quality
parity remains an open enterprise T2 item. Scale acceptance is UNCHANGED: a
matrix row still requires its intended useful message at its original boundary;
do not apply fixture exceptions to generated graphs or classify failures as
success. Retain and explain any resulting native matrix failures.

Native source verification includes the supported positive fixtures and every
existing negative diagnostic-marker region, not only the two new positives.
Retain useful messages at intended boundaries except the explicitly counted
Ruling7 native-only gaps; reject unrelated-file/config diagnostics and TS2589.
Use actual installed di-bag and box tarballs for CJS/ESM
checks, including modern inline inference and real-box frames. Verify inferred
feature emission and downstream consumption with producer source unavailable.
Exercise both classic-emitted and native-emitted library declarations; runtime
examples and core-without-box-dependency checks remain required.

Extend the existing report command with `--native` and `--native --tokens` for
the original 36 named and 18 token cases. Default and `--tokens` stay the classic
lane. Extract and directly test the parent row evaluator while touching it,
resolving the prior final-review Minor. Its tests cover malformed JSON/identity/
diagnostics, process failures, wrong file/line/message, TS2589, legitimate valid
and negative results, raw failure evidence and aggregate counts.

Every native case must run, with an explicit accepted/failure outcome and retained
raw output. Negative acceptance requires one diagnostic with both the intended
message and boundary; crashes/timeouts/memory kills are not rejections. Large
matrices remain explicit report commands, not part of ordinary unit runs.
Any remaining large failure drives further required enterprise T2 work. Native
success alone does not assert the same scale on the classic compiler.

## Verification and completion boundary

Two independently reviewable deliverables: classic inference/toolchain adoption,
then native supervision/consumer/scale integration. Each has genuine RED/GREEN,
focused checks, one final full project check, examples, scoped commits and task
review. The increment finishes with whole-branch review and independent committed-
state verification. All remaining lifetime/startup/extension/platform/release
rows stay open, as does the empty-selected-fork runtime efficiency follow-up.

## Self-review and primary sources

No placeholder APIs, runtime policy changes, erasure-based workarounds or implicit
compiler-version claims. Exact package/API versions are distinguished, classic
and native evidence are not conflated, and physical native supervision is
required before large execution. The known report-evaluator gap is assigned to
the task that changes it; runtime follow-ups stay outside this compiler increment.

[Official side-by-side compiler guidance](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
and [TypeScript 6 inference changes](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)
support the tooling direction, not di-bag compatibility or performance claims.
