# Compiler scalability design

Date: 2026-09-08. Status: specified for implementation; no new scale success is claimed.

Binding program: `2026-09-06-enterprise-di-design.md`, requirement T2. Companion:
`2026-09-08-native-diagnostics-design.md`. Inspected source checkpoint:
`739b509eb7942e4e26c972a711d003aaf8769997`.

## Objective and evidence

Reduce actual compiler work for individual registrations and installations while
preserving exact graph contracts. Run all original 100/500/1000 programs on both
supported compiler lanes and retain every failure as required work. Passing a
report collector, grouped graph, or intended rejection with TS2589 does not prove
the original valid fluent program works.

The corrected historical TypeScript 5.9.3 matrix at `8daad9a` accepted 30/36 named
and 9/18 token cases. All 500 named cases passed. Six 1000 named chained/replacement
cases overflowed the stack; 500 token modules and all 1000 token cases timed out.
The earlier binder overflow and later expression-checker overflow are separate
observations. There is no full replacement classic 6.0.3 large matrix.

Native 7.0.2 measurements at `cc9dbdcdc70edb9872177b77cddf9767aa0b67ab` accepted
28/36 named and 10/18 token cases. These precede later acquisition/lifetime/plugin
changes and must not be relabelled as current source measurements.

| Failed native identity | Outcome |
| --- | --- |
| 100 and 500 replacement/wrong-shape | TS2769 hides the useful named message; companion diagnostic work |
| 1000 chained/valid, missing, wrong-shape | 60-second timeout |
| 1000 replacement/valid, missing, wrong-shape | sampled RSS exceeded 3072 MiB |
| 500 modules/valid, missing-final-token, mismatched-invariant-service | timeout |
| 1000 bindings/valid | TS2589 at generated line 2002, column 15 |
| 1000 bindings/mismatched-invariant-service | TS2589 at 2003:15 plus intended TS2345 at 3003:19 |
| 1000 modules/valid, missing-final-token, mismatched-invariant-service | timeout |

The passing 1000 bindings/missing-final-token case does not establish valid graph
support. Native 500 named chains cost about 29.8 seconds; replacements about
21–22 seconds; token bindings about 8.1–8.4 seconds. These are historical single
observations. Actual nominal named-module coverage uses 20 modules of 50 providers;
registration groups and 1000 individual module installations remain distinct.

Evidence: `docs/benchmarks/typescript.md`, the incremental/modern compiler reports,
and `.superpowers/sdd/2026-09-07-modern-compilers/task-2-native-{named,token}-matrix.jsonl`.

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

## Architecture and selection

Select dependency-directed projections over the existing flat `Entry` history,
followed by incremental installation constraints. `Builder<E,C>` keeps its
invariant readonly `[E,C]`; `ModuleBuilder<E,C>` keeps invariant `[From<E>,C]`.
There is no new independently supplied cache generic or public constructor.

Root `IncrementalChecked` already checks incoming registrations and relationships
crossing the incoming/history boundary. It still repeatedly constructs
`Provided<From<E>>` and scans consumers unrelated to changed keys. Introduce
internal `RelevantEntries<E,Keys>` and `RelevantProvided<E,Keys>` projections,
and skip an old named/token consumer only when its relevant dependency-key
intersection is empty. Required and optional token needs both participate.
Incoming `Checked<N>`, receiver/finite-key/opaque-graph admission and error
precedence remain unchanged: incoming errors, then token cross-errors, then named
cross-errors. Keep exact per-consumer requirements rather than intersecting all
requirements into a potentially misleading `never`.

Installation currently repeats `Checked<Merge<From<E>,D>>` and
`CheckedConstraints<C|MC,Merge<From<E>,D>>`. Replace only the proven redundant
relationships. New public registrations use `IncrementalChecked<E,D>`. For plain
named/token constraints, old constraints need checking against newly available
slots, while new module constraints need checking against the complete graph.
Retain every C member for later replacement/fork/closure. For contributions,
`all`, opaque and lifetime tags, use the existing whole-constraint check until
separate algebraic proof supports incrementality. No closure/lifetime traversal
is skipped, and no private requirements disappear through public projection.

Named/token module-builder additions and replacements keep their existing
whole-map checker unless measurements isolate them as a remaining bottleneck.
The original token-module matrix creates one binding per module: root installation
is the first justified target, rather than rewriting every module operation.

## Alternatives and bounded decisions

1. Selected existing-state projections/incremental installation offer the smallest
   soundness surface. They may improve constants without resolving fluent depth.
2. A sealed registration/reverse-dependency cache can avoid repeated history scans,
   but adds correlated state. A default `R=From<E>` generic is not a proof that
   callers cannot name a mismatched state. This fallback requires a new state
   invariant amendment covering explicit generics, utilities, declarations,
   replacement removal, and equivalent-history assignability before source edits.
3. A separately justified compiler-support migration can address minimized syntax
   depth. A non-generic same-expression control distinguishes syntax depth from
   DI checking; alternate statements are diagnostic controls, never acceptance.

Do not repeat the rejected reconstructed-full-map optimization: it introduced
TS2589 at the mandatory 1000 grouped gate despite passing small fixtures. Do not
reuse the early token-carrier intersection model that exhausted memory at inferred
resolve. Its successful direct indexed-output correction is already present in
the production resolve boundary. Do not assume native implementation language
eliminates type-instantiation depth.

At most three distinct causal projection/state experiments per gate. A failed
soundness gate stops that candidate before package/matrix execution. If existing-
state optimization cannot meet the original bound, preserve measured failures and
write the explicit fallback amendment; do not describe this design as completion
of T2 or adopt ineffective complexity to create a nominal finished task.

## Measurement interface

Add `scripts/compiler-case.ts` with `runCompilerCase(root, lane, item)` and a
strict `scripts/check-compiler-case.ts` CLI taking exactly
`classic|native count form scenario`. Use current `MatrixCase`, generators,
`nativeScale`, native identity resolver, and classic parent evaluator. One selected
case returns visible structured evidence and exits 1 unless accepted. Existing
report commands remain collectors whose exit 0 only proves collection completed.

Use an OS-enforced exclusive lock in the outer compiler-command invocation on
Linux, covering the whole command rather than nesting locks in child compilers.
All implementers/reviewers share `/tmp/di-bag-compiler-heavy.lock`; a lock failure
means another compiler command owns the slot, not a failed graph. Preserve explicit
process supervision inside each selected case. No worker runs without a parent
timeout merely because its heap flag is present.

Record generated/source SHA-256, source commit, compiler implementation identity,
options, diagnostic locations/messages, process state, and measured work/time/RSS.
If source is dirty, say so and use the source hash as the actual measured identity.
Scratch projects preserve original relative imports and source text.

## Acceptance and verification

Write baseline-failing performance/scale assertions before changing production
types. Existing semantic tests that pass initially are compatibility controls,
not alleged bug RED. New counterexamples must genuinely fail for their stated
reason. Preserve all source negatives and add both-order, replacement/removal,
private-module, token invariance, optional/all/lifetime and utility-view controls.

For candidate selection, target at least 25% lower work on the targeted original
100-case classic graph versus a fresh same-source baseline. This is an optimization
selection target, not a replacement for either unchanged ceiling. A smaller work
gain that fixes an original failure requires a documented tradeoff decision.

Final scale acceptance requires all original 36 named and 18 token cases per
compiler: 108 rows on final stable source. Valid rows have zero diagnostics;
negative rows have exactly one intended useful message at the original boundary,
no diagnostic in another file, no TS2589, and clean supervised completion within
unchanged limits. Same-file cascades retain the existing evaluator rules. The two
native replacement-message rows depend on the companion design and stay failed
until useful messages appear. No native source gap allowance applies to matrices.

Add physical classic/native archive consumers in .cts/.mts, inferred .d.cts/.d.mts
producers with source deleted, and both downstream compilers. Exercise utility
views, exact provider dimensions, nominal modules, modern inline inference, real
box frames, and runtime package smoke routes. Run focused gates, the full matrix,
native source audit, packages, a redundant final `npm run check`, all nine examples,
and independent covering verification serially. Preserve original evidence tables.

Reject/revert a candidate on lost negative requirements, any-based or broad-view
history erasure, altered outputs/G/C/ownership, new grouped1000 failure, additional
native allowances, changed bounds, or substituted source syntax. Retain its RED
evidence. Cold-time medians/ranges from three selected serial repeats support only
those observations; editor latency remains unclaimed without editor measurements.

## Delivery mapping

The implementation plan has four independently reviewable tasks: bounded selected
case evidence; root projections; incremental installations and remaining-depth
decision; physical consumers/full matrices/reporting. The diagnostics plan owns
replacement signature redesign. Execute source mutations serially and rebase
measurements on the actual combined source before final acceptance.
