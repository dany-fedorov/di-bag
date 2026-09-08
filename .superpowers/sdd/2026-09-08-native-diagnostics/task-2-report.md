# Task 2 report — bounded replacement result normalization

Source checkpoint: `e29de571c8750b956ca09eb1a845f0b848c74a4a`.

## Outcome

Neither permitted factoring reached strict native diagnostic parity, so no
replacement helper or signature was adopted. Production `src/di-bag.ts` and
`src/module.ts`, all ten invalid fixture bodies, and all 27 native gap
fingerprints remain unchanged. Native parity remains open.

Fresh final-source verification after restoring baseline passed 13 focused
classic/oracle tests with 45 assertions. The supervised strict native audit
reconfirmed the honest baseline at 68/95 useful primary messages, 1/1 exact
supplemental, 27 missing primaries and 27 corresponding unexpected diagnostics.

The prescribed direct `ReplacedEntries` candidate recovered 26 of the 27 useful
messages. Its sole failure was the unchanged union-name expression in
`negative/union-replace.ts`: native TypeScript 7.0.2 printed the private alias
`NoInfer<InvalidReplacement<"a" | "b">>` and did not expose the required
`replace requires one existing singleton string-literal key` text. The only
allowed equivalent `ReplacementState<E,K,V>['entries']` factoring produced the
same result.

## TDD and bounded candidate evidence

The Task 2 parity test was added first and observed RED against baseline:
4 existing oracle tests passed, the new parity test failed on `accepted ===
false`, and 25 assertions ran. Because feasibility failed, the plan-required
success assertion was removed from the ordinary passing suite; the independent
strict CLI remains intentionally red and the RED output is retained in
`task-2-evidence.log`.

Both candidates passed the smallest soundness gates before strict parity:

| Gate | Direct result | Indexed state |
| --- | ---: | ---: |
| classic focused tests | 9/9, 21 assertions | 9/9, 21 assertions |
| native positive controls | 7/7, zero diagnostics | 7/7, zero diagnostics |
| native negative controls | 53/53 exact | 53/53 exact |
| strict primary messages | 94/95 | 94/95 |
| strict supplements | 1/1 | 1/1 |
| strict unexpected | 1 | 1 |

The focused controls include `FunctionMatch`, non-any root/module `ReturnType`,
exact forwarding `Parameters`, cast-free root-history rejection, retained
numeric module output, implicit and explicit named/token calls, exact required,
optional/default-argument and method-return behavior, and explicit invalid
`unknown` registration generics. No token inference, utility safety, entry
history or contribution-C regression was observed before the diagnostic blocker.

The strict source audit was the adoption gate. Since it failed, package,
installed-declaration and scale matrices were deliberately not run, as required
by Task 2 Step 4. Running them could not make the failed useful-message contract
acceptable.

## Reproduction and next decision

`task-2-candidate-direct.patch` applies to the recorded checkpoint.
`task-2-candidate-indexed-state.patch` applies on top of it. Both replay checks
exit zero. `task-2-minimal-function-match.ts` reduces the compiler behavior: the
combined overload has a successful non-any conditional `FunctionMatch` through
the indexed state result, yet a union argument emits TS2769 whose final overload
keeps the branded diagnostic hidden behind `NoInfer<InvalidReplacement<...>>`.

The exhausted experiment leaves two designed alternatives. A public
named/token method split needs an explicit API migration amendment and honest
old/new fixture mapping. Otherwise the minimized case can support an upstream
native TypeScript fix or a separately approved compiler-version migration.
Neither alternative is authorized by this task.

## Retained files

- `task-2-candidate-direct.patch`
- `task-2-candidate-indexed-state.patch`
- `task-2-minimal-function-match.ts`
- `task-2-evidence.log`
- `task-2-manifest.json`
