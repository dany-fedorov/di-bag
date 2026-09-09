# Compiler scalability closeout

Task 4 measured the final combined source at commit
`348b105b5535e3446e2e50be1a4d93d928db7a56`. The production-source SHA-256 is
`90d656f628878dd926da736db2ce4781f9763e9d5fdc0f6834ae0128f475c198`.
The supported lanes remain the TypeScript 6.0.3 API through wrapper 6.0.2 and
native TypeScript 7.0.2. Node was v24.20.0 and Bun was 1.4.0.

The bounded installation change resolves the original 500 individual-module
limit on both lanes. It does not resolve the original 1000-call limits or the
two native replacement diagnostic-quality rows. The final original matrices
accept 83 of 108 rows, so enterprise requirement T2 remains incomplete.

## Declaration and package proof

The new `incremental-modules-consumer.ts` imports the inferred `result`, `token`
and `tokenGraph` exports and proves both resolved values remain exactly `number`.
The positive and five-marker negative module fixtures now run through the shared
installed archive corpus. Classic and native emitters produce physical `.d.cts`
and `.d.mts` files; their producer directories are deleted before classic and
native downstream checking. The classic archive path explicitly uses the classic
emitter for this feature. Existing builder/reflection and supported-replacement
fixtures remain in both installed CommonJS and ESM routes.

The declaration-consumer test first failed with the expected missing-file
diagnostic. The initial installed token archive run then exposed two harness
routing failures: the local assertion helper and internal `module-types` import
were unresolved. Inlining only the test assertion aliases and routing the internal
type import to the installed archive made the unchanged producer and consumer
contracts pass. No production export, source annotation, cast, `any`, compiler
option or `skipLibCheck` exception was added.

Focused GREEN evidence:

- source type contracts: 110 tests, 430 assertions, 0 failures in 79.44 seconds;
- token archive: 10 tests, 32 assertions, 0 failures in 8.07 seconds;
- combined classic archive packages: 175 tests, 713 assertions, 0 failures in
  143.95 seconds;
- physical classic/native emitter packages: 2 tests, 696 assertions, 0 failures
  in 140.03 seconds.

## Original 108-row matrix

All collectors ran serially under `/tmp/di-bag-compiler-heavy.lock`. The native
matrices ran once. The classic matrices were regenerated once after the
provenance correction described below. Reconciliation found the exact
36/18/36/18 final identities with no duplicates or missing rows. Native rows record the source
commit, production-source hash, generated-source hash and executable identity.
Review found that the initial classic collector did not. That run remains in Git
history as pre-fix evidence and was superseded, not retroactively relabelled. The
classic collector now uses the same closed selected-case provenance path and the
affected 54 rows were regenerated once at commit
`ba418e1c460f215c82db297b656f66605c517773`. Every classic row, including
timeouts and stack failures, records matching before/after commit, clean source
status, source hash, generated hash, TypeScript 6.0.3 and Node v24.20.0. The
production source and generated forms did not change.

| Lane and matrix | Accepted | Failed | Result |
| --- | ---: | ---: | --- |
| classic named | 30/36 | 6 | all six 1000 chained/replacement expressions overflowed the compiler stack |
| classic token | 12/18 | 6 | all six 1000 binding/module rows timed out at 60 seconds |
| native named | 28/36 | 8 | two diagnostic-quality failures, three 1000 chained timeouts, three 1000 replacement RSS kills |
| native token | 13/18 | 5 | two 1000-binding TS2589 failures and three 1000-module timeouts |
| **Total** | **83/108** | **25** | **T2 remains open** |

The unresolved rows are exact required failures:

- classic named: 1000 chained and replacement, each valid, missing and
  wrong-shape, fail with `RangeError: Maximum call stack size exceeded`;
- classic token: 1000 bindings and modules, each of their three scenarios, time
  out without a compiler result;
- native named: 100 and 500 replacement/wrong-shape return TS2769 without the
  required useful primary message; 1000 chained rows time out; 1000 replacement
  rows exceed 3072 MiB sampled RSS;
- native token: 1000 bindings valid returns TS2589, invariant mismatch returns
  TS2589 plus the intended TS2345, and all three 1000-module rows time out.

Collector exit zero means collection completed. Failed rows above are not
accepted rejections. The non-generic 1000-call control retained from Task 3 also
overflows the classic binder stack, isolating a syntax-depth ceiling from DI
checker work. Native accepts that syntax shape but the original generic programs
still cross the fixed time, memory or instantiation bounds.

The unchanged limits were 60,000 ms, 3072 MiB, default stack and 4 MiB combined
output. The classic 100-case ceilings remain 1,500,000 named and 2,000,000 token
instantiations. The final focused work gate observed 902,444 named and 1,479,703
token instantiations.

Complete row evidence and summaries are clone-safe in:

- `.superpowers/sdd/2026-09-08-compiler-scalability/task-4-classic-named.log`
- `.superpowers/sdd/2026-09-08-compiler-scalability/task-4-classic-token.log`
- `.superpowers/sdd/2026-09-08-compiler-scalability/task-4-native-named.log`
- `.superpowers/sdd/2026-09-08-compiler-scalability/task-4-native-token.log`

Retained package, full-check, native-audit, focused-suite and exact per-example
path/status/output evidence is indexed in
`.superpowers/sdd/2026-09-08-compiler-scalability/task-4-verification.md`.

## Repeat observations

Three serial observations per selected valid control use the same production
source hash. Times are compiler milliseconds, with median and full range. The
500-module set combines the Task 3 selected observation with the final matrix
and final repeat; all three share the exact production-source hash.

| Lane | Original control | Median ms | Range ms | Instantiations |
| --- | --- | ---: | ---: | ---: |
| classic | 100 chained | 1,442 | 1,416-1,453 | 902,444 |
| classic | 100 bindings | 1,945 | 1,940-1,952 | 1,479,703 |
| classic | 500 modules | 29,898 | 26,733-30,778 | 41,313,485 |
| native | 100 chained | 395 | 392-427 | 882,741 |
| native | 100 bindings | 584 | 566-590 | 1,452,944 |
| native | 500 modules | 15,257 | 14,898-16,467 | 41,297,853 |

These are cold observations on a shared machine. They do not claim editor
latency or general performance guarantees.

## Redundant verification

- `npm run check`: classic typecheck and build passed; 746 tests, 3,989
  assertions, 0 failures across 39 files in 496.65 seconds.
- Native typecheck and declaration build exited zero.
- Native source audit: 118 fixtures, 657 expected diagnostics, 630 matched,
  the same 27 declared diagnostic gaps, 0 unexpected diagnostics and 0 failures.
- Focused compiler-case, work and native-supervision gate: 25 tests, 144
  assertions, 0 failures in 9.20 seconds.
- After the provenance correction, the expanded compiler collector, boundary,
  work and native-supervision suite passed 51 tests and 263 assertions in 34.73
  seconds; classic typecheck also passed.
- All nine runnable examples exited zero: WBS scope, modules, box adapters,
  tokens, scopes, composition, contributions, observers and plugins.

Independent review reran the physical native package gate (2 tests, 696
assertions, 139.32 seconds) and compiler-case gate (16 tests, 89 assertions).
It statically reconciled all 108 tracked rows, compiler/source/generated
identities and recomputed boundaries, confirmed the retained gate/example logs,
and found no Critical, Important or Minor issue.

No source, generator, diagnostic acceptance, compiler ceiling, stack setting or
native gap allowance changed after the matrix freeze. No push or publication was
performed.

## 2026-09-09 follow-up

At `5c085b3`, classic TypeScript 6.0.3 compiled the 100/500 valid replacement
rows with 3,045,479/69,620,879 instantiations and 2.357/38.980 seconds. A TDD
work-ceiling regression then covered the 100 replacement form. The adopted
optimization removes redundant whole-history validation only from the
zero-dependency named replacement overload in `Builder` and `ModuleBuilder`.
Candidate results were 1,098,024/23,983,624 instantiations and 1.408/14.458
seconds, reductions of 63.9% and 65.6% in work. All six 100/500 replacement
valid/missing/wrong-shape rows passed their unchanged boundaries and messages.
The classic type corpus, strict 103/103 native diagnostic audit, classic/native
typechecks and builds, 79-test package suite, and both physical declaration
emitters passed.

Independent review found that optional and defaulted parameters are callable with
zero arguments but still carry provider needs. Eight direct/explicit builder/module
negative regions reproduced the unsound fast route. `ZeroDependencyAdmission`
now excludes every dependency-bearing union branch from that overload, while the
unchanged general overload validates those factories. The expanded strict native
audit matches 103/103 useful primary regions plus its supplement, with zero gaps
or unexpected diagnostics.

A non-generic control with `add(value: object): Chain` passes at 550 chained calls
and fails at 575 with `RangeError: Maximum call stack size exceeded` in the
classic binder. A matching non-generic replacement chain also fails at 1000.
These controls contain no library generics or instantiations, proving the pinned
classic compiler cannot bind the unchanged original 1000-call AST under the
required default stack. Grouping 1000 providers in modules of 50 remains accepted
in 3.15-3.30 seconds for valid, missing and wrong-shape scenarios, but is evidence
for the documented usage route rather than acceptance of the original row.

### Remaining native 1000-entry boundary

Fresh selected-case runs at `ccf5b32352eb6c1150424087b424480d6a5d155f`
revalidated all three native 1000 replacement scenarios. Valid, missing and
wrong-shape were killed at the 3072 MiB sampled-RSS limit after 30.019, 25.968
and 28.415 seconds respectively. The source SHA-256 was
`6ea5528505d8dee131477a6057fd7e94cb2f099118f8a214bacce5d42788c914`, and
the native compiler binary SHA-256 was
`4f2de678286401759b3fb4475bafe35b8f32b4b3a07d92642bbf37eadc9b34a4`.
Short-circuiting the impossible old-token scan for string-key registrations
reduced native chained work by 14.6% at 100 and 18.6% at 500, but the 1000 row
still timed out. It missed the plan's 25% work-reduction adoption threshold and
did not resolve a required row, so it was rejected. Direct per-property variants
were slower and were also rejected.

Token-binding ablations localized most work to bind admission and final graph
completion. Sound old/new-token scan short-circuits reduced work by 24.7% at
100 and 31.3% at 500, but the 1000 row still returned TS2589 at about 70.6
million instantiations. Removing final invalid-graph validation allowed the row
to pass but was unsound for manually declared `Builder<E, C>` values.

A correlated third generic was then tested as an adversarial feasibility probe.
The first prototype let native TypeScript complete 1000 valid bindings in 40.93
seconds at 2884.7 MiB sampled RSS and 124,358,713 instantiations, but its exported
transition helper let callers mint a proof for an invalid graph. Making the
transition private rejected malicious synthesis plus `any`, `never`, `unknown`,
widened-builder and foreign-proof probes. That sounder form failed TypeScript 6
declaration emission with TS4023/TS4094 because the private proof could not be
named. Exporting enough structure for declaration emission again made arbitrary
invalid proofs spellable. The prototype is therefore rejected: under the current
public inferred-declaration contract, it cannot be both non-synthesizable and
nameable.

### Decision boundary

No tested type-only change satisfies the unchanged 1000-row source, compiler,
soundness and declaration requirements. The next implementation must be preceded
by an explicit design choice between a supported grouped source/API shape and a
compiler-support migration. Grouped modules are already a passing operational
route, but they do not close original fluent-row acceptance. A compiler migration
must rerun the complete source, declaration, package, diagnostic and 108-row
evidence rather than inheriting results from the pinned lanes.

After diagnostic parity, the prior frozen 83/108 matrix is historical. The two
native replacement diagnostic rows are now closed, leaving 23 expected scale
failures based on individually revalidated affected rows: six classic named,
six classic token, six native named and five native token. This is not relabelled
as an 85/108 final matrix because all 108 rows have not been regenerated on the
post-optimization source.
