# Native replacement diagnostics closeout

Task 4 closes the bounded native-diagnostics experiment at commit
`0e27438265763ac92ecca9fb5255197a27cec5b2`. It does not claim native
diagnostic parity. TypeScript 7.0.2 still rejects the 27 original replacement
expressions with the wrong final overload message, while TypeScript 6.0.3
continues to expose the useful requirements.

## Adoption decision

Neither permitted result-normalization candidate was adopted. Both retained
direct-call inference, non-`any` `ReturnType` views, forwarding `Parameters`,
cast-free history rejection, numeric module output, token inference and
contribution constraints. Each nevertheless reached only 94 of 95 strict native
primary messages. The remaining union-name case exposed
`NoInfer<InvalidReplacement<"a" | "b">>` instead of
`replace requires one existing singleton string-literal key`.

Because the strict 95/95 source gate failed, production replacement signatures,
the ten invalid fixture bodies and all 27 exact native gap fingerprints remain
unchanged. A named/token method split requires an API migration decision; the
alternative is an upstream native TypeScript fix or a separately approved
compiler migration.

## Fresh diagnostic evidence

The strict audit ran twice around the full integration gate. Both observations
reported 95 primary expectations, 68 useful matches, 27 missing primaries, 27
corresponding unexpected TS2769 diagnostics, and one of one exact supplemental
diagnostics. Every compiler process completed under the existing 60,000 ms,
3072 MiB sampled-child-RSS and 4 MiB output limits. No TS2589 or process failure
was accepted as diagnostic evidence.

The ordinary native contract audit remains intentionally distinct from strict
parity. It passed 121 source fixtures with 660 expected diagnostics, 633 matched,
exactly 27 declared gaps, 11 of 11 supplements, no unexpected diagnostics and
no failed fixture. The fixed strict inventory still contains all ten files and
all 95 primary expressions.

The four message-sensitive original matrix cases were rerun from clean source:

| Lane | Count | Boundary | Compiler outcome | Contract outcome |
| --- | ---: | ---: | --- | --- |
| classic 6.0.3 | 100 | 152 | TS2769 with `a dependency has the wrong shape` | accepted |
| classic 6.0.3 | 500 | 752 | TS2769 with `a dependency has the wrong shape` | accepted |
| native 7.0.2 | 100 | 152 | TS2769 ending at the token overload | useful message missing |
| native 7.0.2 | 500 | 752 | TS2769 ending at the token overload | useful message missing |

All rows have matching before/after commit, clean `src` status, exact original
boundary and stable generated-source hash. The recomputed production-source
SHA-256 is `90d656f628878dd926da736db2ce4781f9763e9d5fdc0f6834ae0128f475c198`,
which exactly matches the final compiler-scalability matrix. The existing
36/18/36/18 rows were therefore reused without another 108-case run. They still
accept 83/108 rows and retain 25 scale or diagnostic failures; enterprise T2
remains open.

## Utility and installed-declaration proof

The focused source, reflection, classic work-ceiling and native gap-mutation
suite passed 133 tests and 482 assertions. It covers direct calls, non-`any`
root/module views, the exact forwarding tuple, cast-free root-history rejection,
module numeric output, full registration validation and retained contribution
constraints. Native strict typecheck and declaration build both passed.

Physical package checks passed independently before the full gate:

- box/archive declarations: 113 tests, 313 assertions;
- token and reflected declarations: 12 tests, 60 assertions;
- core CJS/ESM archives: 77 tests, 495 assertions;
- classic/native emitters with producer deletion: 2 tests, 1,152 assertions.

The package matrix routes all ten original invalid programs through real
`.d.cts` and `.d.mts` files. The classic lane uses the classic emitter, the
native lane uses the native emitter, and downstream programs cannot fall back
to producer source. Both preserve the fixed 27-gap inventory without adding an
allowance.

## Redundant integration

`npm run check` passed classic typecheck, 780 tests in 40 files, 4,632
assertions, and the classic declaration build in 589.86 seconds. The physical
native package gate was deliberately repeated inside that suite. All nine
runnable examples exited zero: WBS scope, modules, box adapters, tokens, scopes,
composition, contributions, observers and plugins.

Raw selected-case, strict-audit, focused, native, package, full-check and example
logs are retained under
`.superpowers/sdd/2026-09-08-native-diagnostics/task-4-*`; their index is
`task-4-verification.md` in that directory. No push or publication was
performed.

## 2026-09-09 parity follow-up

The earlier no-adoption result above remains the record for its tested candidates.
A third candidate succeeded by combining the direct factored replacement overload
with the invalid-key `Unsatisfied` type written directly in both conditional
branches. Native 7.0.2 now matches all 95 primary messages, the one supplemental
message, and zero unexpected diagnostics across the unchanged invalid expressions.
The ordinary native audit reports 124 fixtures, 662 expected and 662 matched
regions, zero reviewed gaps, zero unexpected diagnostics and zero failed fixtures.

Focused utility/reflection/history verification passed 147 tests and 517
assertions. Native 100- and 500-entry replacement wrong-shape probes now retain the
useful message; the 1000-entry valid probe still exceeds the fixed 3072 MiB ceiling.
Release inventory and manifest tests were migrated from the historical 27-gap
checkpoint to the candidate-derived authority and explicitly reject a fresh gap
when the committed authority is empty. The prior `b4ff1f2` release evidence remains
historically valid, but these tracked source changes require a new release candidate.

Clean-commit selected probes at `69beafe0940af1dfdf03bc66f70bdb5a6bc168df`
and source hash `e9a52097e7fdbbde99bb20763e4318fef5f1906b5fe87c3ded86a0065e1c0f40`
accepted the classic/native 100- and 500-entry replacement wrong-shape rows with
the exact useful TS2769 message and no TS2589. Peaks were 546/2604 MiB for classic
and 175.76/1526.18 MiB for native. The complete working-tree suite then passed 992
tests across 50 files with 5,714 assertions; classic/native typechecks and builds,
the 89-test release suite, both physical package lanes, and all nine examples also
passed. Independent review found no Critical or Important issue.
