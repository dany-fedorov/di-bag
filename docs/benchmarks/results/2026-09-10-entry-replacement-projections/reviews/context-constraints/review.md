# Independent compatibility review: replacement context and deferred constraint projection

Base source: `3a42173d9faacc63ad7728545580a63389d56de2` (the PR9 source tree specified by the coordinator).
Candidate: only `/tmp/di-bag-replacement-context-factory-probe/combined.di-bag.ts` and `combined.module-types.ts`, substituted into an archived copy of that base.

Candidate SHA-256:

- `di-bag.ts`: `cc2f7d4e835925acc36e84b1c54df62468d8076f2472fbac4e71df5239425085`
- `module-types.ts`: `8c1c4de6d8a49e56b6a14683e195a948398f751130ce6d89a87eebeb3fa89ed5`

## Strengths

- `di-bag.ts:55,330` introduces a private, unconditional `ReplacementFactory<O>` alias with the same explicit `this: void` receiver. The two contextual factory occurrences still receive exactly `ReplacementOutput<NoInfer<From<E>>, K, C>`. The registration type retained in history, both overloads, key admission, dependency admission, and retained constraints remain intact. No runtime code changes.
- `module-types.ts:18,36` defers the existing `Provided<A>` projection until the named-needs branch requires it. The mapped key intersection, indexed value comparison, consumer distribution, token checks, and contribution checks are preserved. Moving the entire projection, rather than reconstructing its output from registrations differently, retains optional, readonly, numeric, symbol, and registration-union behavior in the tested public utility cases.
- The paired compatibility results cover source calls, public generic utilities, extracted overloads, and emitted declaration consumers on both pinned compiler engines. The review did not rely solely on ordinary successful builder chains.

## Issues

### Critical

None found.

### Important

None found in the reviewed two-file candidate.

### Minor

None identified that warrants delaying this change.

## Independent verification

All work was performed under `/tmp/di-bag-replacement-projection-review`; the production checkout, index, and HEAD were not mutated by this reviewer. `setup.py` archives the pinned source and tests, asserts that both baseline snapshots match the archive, and substitutes only the two candidate files. `source-identity.json` records all 35 source hashes and confirms that only those two files differ.

Compiler processes were serialized with `flock /tmp/di-bag-compiler-heavy.lock`. Bun reported `1.4.0`; classic TypeScript asserted runtime `6.0.3`; the repository native resolver authenticated the `7.0.2` wrapper, platform package, and executable. Both engines used strict checking, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `skipLibCheck: false`. Native checks used the repository's unmodified supervision limits.

- **Public `CheckedConstraints` cases:** 352 concrete equality assertions against the copied legacy module definition passed on both versions and both compilers. The matrix includes `C = never`, `any`, the full constraint union, opaque and token constraints, exported/external needs, inner value unions, incompatible consumer unions, empty needs, optional and readonly properties, number and unique-symbol keys; registration maps include `never`, `any`, empty and broad maps, optional/readonly entries, numeric/symbol entries, union-valued registrations, union maps, `never`/`any`/opaque providers, promises, and unknown outputs.
- **Deferred public utility comparisons:** 114 open-generic equality/reciprocal-assignment probes produced the same 63 baseline rejections at the same codes and locations. The 51 accepted probes were also included in the clean declaration fixture: 15 equality assertions over arbitrary registration maps and 36 reciprocal assignments. This includes named needs, incompatible consumer unions, number/symbol needs, and broad constraint unions.
- **Unresolved generic limitations:** Equality and reciprocal assignment of completely unresolved public conditionals against a copied legacy helper definition already fail on the baseline. Generic `C` comparisons and `C = any` similarly retain their baseline results. These failures are retained as differential evidence, not counted as successful equality proofs. No rejected baseline case became accepted, and no accepted case became rejected in this probe.
- **Replacement inference and reflection:** Existing `replacement-supported`, `replacement-reflection`, `replacement-reflection-consumer`, and `replacement-context` fixtures pass. Additional probes cover generic equality and reciprocal assignability of the full extracted replacement overload set against its original spelling; specialized and extracted calls; exact inferred method returns; explicit `this: void`; disposable output; async promises; raw/native provider acquisition metadata; typed-token replacement; required and optional dependency-bearing replacements; and retained private module requirements. Additional deliberately invalid calls remain rejected. Baseline nested-parameter implicit-any behavior and unconstrained generic-factory admission failures were checked separately and remained unchanged.
- **Negative behavior:** Each compiler/version pair reported 172 diagnostics across 13 selected negative fixtures, with identical codes and locations. All 170 repository diagnostic markers matched, with zero missing or unexpected diagnostics. Fixtures include replacement context/reflection/views, wrong output, union key replacement, module exports/hidden requirements/narrowing/rename, contributions, and lifetimes.
- **Inferred types:** Of 253 top-level variable/function type renderings in the final classic semantic probe, 252 are identical. The sole difference is union-arm ordering in the rendered constraint of the extracted `replace` overload; generic callable equality and reciprocal assignment both pass. All 77 renderings in the separate open-generic probe and all seven fresh-consumer renderings match exactly.
- **Declarations and consumers:** Both versions emitted 42 `.d.ts` files with zero diagnostics on both engines. Fresh consumers of those declarations passed with `skipLibCheck: false`, including exact output assertions and expected failures for wrong output, lost promise wrappers, erased reflected dependency history, and missing callback dependencies. Native emitted only the two intended production declaration differences. Classic additionally reordered the union arms of the extracted method in the review fixture's declaration; its other fixture declarations are identical.
- **Diagnostic text:** Source negative diagnostics have 14 text differences on classic (11 alias/union-rendering changes, three absolute-path truncation differences) and three on native (absolute-path truncation). The open-generic probe has 20 text differences from the private helper's changed second argument. Codes, locations, admission behavior, and all repository diagnostic markers remain unchanged. This is not a claim that full human-readable compiler messages are byte-identical.

The first exploratory fixture versions and their failures are retained with `initial-` prefixes. They are not acceptance results. The final fixture separates unresolved negative generic comparisons from emitted positive assertions so deliberately invalid assertion aliases do not contaminate declaration consumers.

## Reproduction and evidence

Run `bash /tmp/di-bag-replacement-projection-review/reproduce.sh`. This rebuilds the isolated source snapshots and runs paired semantic, open-generic, declaration, consumer, hash, and diagnostic-marker checks.

Primary evidence: `summary.json`, `markers.json`, `source-identity.json`, `constraints.ts`, `open-generics.ts`, `replacement.ts`, `consumer.ts`, `run.mjs`, `verify-results.py`, and the per-compiler JSON results and declaration diffs beside this report.

## Assessment

**Ready to merge: Yes, conditional on the coordinator's complete repository gates and original-limit scale verification for this exact candidate.**

No change-specific correctness or compatibility blocker was found. This review did not rerun full repository suites or large scale cases and does not independently validate the reported near-limit native 1,000-replacement memory result. The coordinator owns those acceptance gates and any subsequent candidate changes; this assessment is restricted to the two source hashes above.
