# Native replacement diagnostic parity design

Date: 2026-09-08. Status: bounded design selected for investigation and adoption
only after the soundness gates below. There is no demonstrated signature fix yet.

Binding program: `2026-09-06-enterprise-di-design.md`, requirement T2. Companion:
`2026-09-08-compiler-scalability-design.md`. Inspected checkpoint:
`739b509eb7942e4e26c972a711d003aaf8769997`.

## Objective and exact deficit

Make native TypeScript 7.0.2 report the original useful contract messages for all
27 currently declared replacement gaps without losing implicit inference,
explicit generic calls, reflected utility-type safety, or existing token errors.
These inputs already reject. This is diagnostic quality work, not a claim that
the compiler currently accepts those invalid programs.

The latest plugin evidence has 113 source files, 647 total expected regions, 620
matches, 27 known native gaps and zero unexpected diagnostics. Compute fresh
primary/supplemental totals from the matcher; do not describe combined totals as
all primary. The original 321-primary corpus had 294 useful native matches plus
27 known rejections and 11 supplemental matches. Source growth did not resolve
the original deficit.

The inventory below uses gap-comment line numbers at the inspected checkpoint,
relative to `tests/types/negative/`; the original primary marker is one line above.

| File | Gap lines | Intended contract |
| --- | --- | --- |
| incremental.ts | 12, 15, 46 | named wrong shape and retained private external needs |
| incremental.ts | 26 | invariant token needs introduced through named replacement |
| inline-replacement-wrong-shape.ts | 3 | inline method-returning wrong shape |
| module-hidden-private-needs.ts | 16 | surviving private local consumer |
| module-narrowing.ts | 22 | retained installed-module constraint |
| module-rename.ts | 21 | renamed public slot with private consumer |
| provider-boundaries.ts | 40 | erased registration finite-needs admission |
| replacement-context.ts | 10, 13, 16, 19 | multiple surviving consumers, root/module |
| replacement-context.ts | 24, 28 | hidden external/same-label exported needs |
| replacement-context.ts | 32, 35 | optional slot cannot become undefined |
| replacement-context.ts | 43, 46, 49, 52 | opaque/broad/owned finite-needs admission |
| replacement-wrong-shape.ts | 3 | numeric service replacement |
| required-this.ts | 8 | required receiver is incompatible |
| union-replace.ts | 7, 10, 13, 16 | union, broad string, open template, unknown key |

`tests/native-diagnostic-markers.ts` declares 25 `last-token-string`, one
`last-token-string-union`, and one `last-token-open-template` fingerprint. Each is
an exact TS2769 message reporting only the last token overload. Matching requires
the exact file, primary region, code and entire fingerprint. Stale, unknown,
duplicate/misplaced declarations and extra diagnostics fail. Four incremental
gaps occur in each installed emitter/module-mode variant.

The original native scale rows 100/replacement/wrong-shape and
500/replacement/wrong-shape also fail useful-message acceptance at lines 152 and
752. They are related to these signatures but receive no source-fixture fallback.
The other 14 native matrix failures concern time/memory/TS2589 and belong to the
scalability companion; a message fix cannot close them.

## Global Constraints

- Keep classic API TypeScript 6.0.3 through wrapper 6.0.2 and native TypeScript 7.0.2 pinned; compiler migration requires a separate justified design.
- Keep strict NodeNext checking, exactOptionalPropertyTypes, noUncheckedIndexedAccess, ES2022, and existing declaration/package routes.
- Preserve exact synchronous/Promise outputs, required receivers, provider metadata, acquisition frames, acquired values, token identity and graph G, and module constraints C.
- Preserve invariant Builder entry history and safe standard Parameters/ReturnType views; no cast-free history erasure or any-based validation escape is acceptable.
- Preserve all invalid program bodies, useful primary requirements, explicit supplemental diagnostics, and existing native gap fingerprints unless individually proved resolved.
- Keep original generated source forms, counts, imports, consumer assignments, and diagnostic boundaries; no batching, statement splitting, stack increase, or type erasure may substitute for a failed row.
- Keep 100-case classic ceilings at 1500000 named and 2000000 token instantiations, with zero diagnostics.
- Run one compiler-heavy process at a time across source audits, package builds, work gates, experiments, and matrices.
- Keep native limits at 60000 ms, 3072 MiB sampled child RSS, 20 ms sampling, and 4194304 combined output bytes; keep classic workers at 60000 ms, 3072 MiB old-space, default stack, and 4194304 output bytes.
- Do not conflate classic heap limits, native sampled RSS, native metrics, classic instantiations, or editor latency.
- No required decorators, reflect-metadata, custom compiler transforms, dynamic code generation, new runtime dependencies, or runtime ownership changes.
- Work in the existing approved checkout; do not change box repositories or publish, push, merge, remove workspaces, or store credentials under this plan.

## Existing signature and historical rejections

Both builders have a precise zero-argument named overload giving method-returning
factories a consumer-safe preliminary output, a general named overload, and a
token overload. The runtime implementation remains unchanged by this design.
Root validation uses incremental graph checks plus retained C; module validation
uses the full map plus contribution C. Do not accidentally drop module contribution
checking when adapting historical candidate text predating contributions.

Prior findings in `.superpowers/sdd/2026-09-07-modern-compilers/task-2-report.md`
and `task-2-diagnostic-addendum.md` rule out the following repeated approaches:

- Verbose/no-truncation flags did not recover missing messages.
- Moving token overload first improved named errors but lost token-output errors.
- A combined key-dispatch conditional rejected valid implicit token calls.
- Moving only registration inference behind NoInfer did not fix key admission.
- Inner NoInfer/two-way guards still inferred `string | TokenBase` for valid tokens.
- Whole-guard NoInfer restored direct calls and all 348 then-tested expectations,
  but `ReturnType` conditional function matching failed and selected `any`.
- A cast-free reflected builder view then erased a consumer dependency and accepted
  unsafe replacement. Changing only invalid registration fallback never to unknown
  did not fix this. Direct-call/package success is insufficient evidence.

The existing root reflected-view assignment must reject. The analogous module
view is safely assignable and exports numeric value/consumer results; changing
that supported case to an assignment rejection is not an acceptable shortcut.

## Selected experiment and interfaces

Investigate factored dispatch with a total history-preserving result. Keep the
precise first named overload. Define internal helpers in `src/replacement-types.ts`:
`ReplacementAdmission<R,K>`, `BuilderReplacementRegistration<E,C,K,V>`,
`ModuleReplacementRegistration<E,C,K,V>`, and `ReplacedEntries<E,K,V>`.
Use `K extends string | TokenBase`, `V extends Registration`; C has the existing
root or module constraint. The general overload still infers from naked K/V and
checks the actual inferred input, with NoInfer only at demonstrated validation
boundaries. Consumers receive `Builder<ReplacedEntries<E,K,V>,C>` or the module
equivalent, never a conditional union containing `any`.

For an admitted singleton name, replace exactly its entry; for an admitted token,
replace exactly its token key and retain `Binding<K,V>`. For a broad reflected
unadmitted domain, the result must keep E/C and a non-any checked view. Model the
existing reflected token entry `{key: never; registration: Binding<TokenBase,
Registration>}` rather than removing all named keys through a broad string union.
This is an unreachable-direct-call reflection representation, not a new accepting
overload: key/registration admission must still reject every invalid selection.
The plan gives the concrete candidate; this specification does not assert that
factoring will repair the compiler's conditional function match.

First isolate result normalization against the exact failed helper/admission
candidate. Require direct function-match, ReturnType/Parameters, reflection attacks,
implicit/explicit calls and message checks on both compilers before production.
At most two factorizations of this one causal hypothesis may run: a named entry
helper and an equivalent indexed state helper. Do not add arbitrary never-parameter
reflection overloads, accepting fallbacks, callback any, or manually patched
utility types to make a test pass.

## Alternatives and failed-feasibility boundary

An explicit named/token method split can keep simple checked signatures and useful
domain errors. Additive methods would only improve migrated calls, leaving the 27
original expressions unresolved. Removing token support from `replace` requires a
separate migration design and honest old/new fixture mapping. This plan does not
authorize silently performing that migration after a failed experiment.

An upstream native diagnostic fix or compiler-version migration preserves library
signatures, but requires a minimized reproduction and verified pinned release.
Prepare evidence locally; no issue submission or toolchain upgrade is implicit.

If the selected candidate fails either reflection or useful-message parity, retain
the production signatures, all existing allowances and recorded failures, and
deliver the minimized counterexample plus a concrete fallback amendment. The
investigation task can finish; native parity and the program remain incomplete.
Do not mislabel a plan's exhausted experiment budget as a completed capability.

## Tests and adoption contract

Create a strict native replacement audit using the existing primary/supplemental
matcher without native-gap fallback. Inventory fixtures from the explicit ten
files above, not by scanning for gap comments that will disappear when fixed.
The baseline strict audit must visibly report 27 missing useful primary messages.
Keep the existing fallback audit operational until individual gaps are resolved.

Positive source and emitted controls cover richer method-returning outputs,
required/optional/default parameters, explicit name/token generics, concrete
forwarders, async Promise identity in types, owned/provider registrations, graph
metadata/frames/acquired types, module contributions and safe module reflection.
Negative controls cover both relationship directions, overwritten-self removal,
surviving consumers, finite needs, required receivers, opaque graph/bound contracts,
union/broad/template/missing names, mixed/union/broad/forged tokens, and explicit
generics. Unknown, any, never and error-recovery outputs cannot count as exact
inference. Tests using any solely to detect IsAny are permitted; inputs must not
use it to erase checking.

Physical proof uses both actual library emitters and installed .cts/.mts fixtures,
then inferred .d.cts/.d.mts feature emission with producer source removed and both
downstream compilers. Test extracted generic methods for nameability, without
weaker annotations. Preserve root `[E,C]` and module `[From<E>,C]` invariant guards.

Acceptance: all useful requirements in unchanged source fixtures, exact supplements,
zero unexpected diagnostics, no native gap declarations after parity, zero new
token message regressions, exact utilities, and the original 100/500 replacement
wrong-shape matrix boundaries. Run small scale/work gates, packages, native source
audit, both full original matrices per compiler on final stable combined source,
and redundant full checks/examples. The scale companion owns canonical 108-row
collection; reuse its exact-source evidence instead of concurrently repeating it.

## Delivery mapping

Four tasks: strict audit and reflection oracle; bounded signature feasibility and
conditional adoption; physical declaration/package parity; final work/scale/native/
full verification and honest reporting. All heavy commands use the shared outer
exclusive compiler lock and existing per-process bounds. Reject a candidate on
any utility erasure, wrong output, lost C/G, missing useful error, new allowance,
or scale-work ceiling regression. Preserve experimental RED evidence and existing
source on failure.
