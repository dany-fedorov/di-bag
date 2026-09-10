# Architecture review: final-resolution constraint expansion

## Finding and recommendation

Factor synthetic zero-argument factory literals into a private output-parameterized alias:

```ts
type OutputFactory<O> = () => O;
```

Use `OutputFactory<ReturnType<F>>` for the four `fromTokens` factory occurrences in `provider.ts`, and `OutputFactory<ProviderOutput<R>>` for the two public factory projections in `module-types.ts`. Each module has its own private alias, avoiding new exports or imports. This is one representation change: synthetic callable types capture their computed service value, instead of the callback or registration from which that value was derived.

The bounded comparative probe supports this candidate strongly. It is recommended for the coordinator's contract and full-scale verification, not yet approved for adoption.

## Why this targets the actual work

The installed classic compiler is TypeScript 6.0.3. The relevant local implementation is `/tmp/di-bag-replacement-spike/node_modules/@typescript/old/lib/typescript.js`:

1. `inferTypeArguments` at line 80573 runs return-context inference before iterating over call arguments. For `const result: number = graph.resolve(token)`, the selected `K` is still generic when the compiler compares the expected numeric output with `Provided<R>[SelectionKey<K> & keyof R]`.
2. `inferFromObjectTypes` at line 73705 calls `typesDefinitelyUnrelated`, which requests apparent properties. The trace shows this reaching `getApparentType`, `computeBaseConstraint`, and `substituteIndexedMappedType`.
3. `computeBaseConstraint` at line 63592 treats a generic index into the homomorphic mapped output specially. `substituteIndexedMappedType` at line 67171 combines the map's existing mapper with the generic selected-index mapper and instantiates the map's `ProviderOutput<R[K]>` template. It also preserves optional-property behavior; bypassing this path accounts for the optionality regression of the earlier direct-output candidate.
4. `getObjectTypeInstantiation` at line 68098 first collects the declaration's captured outer parameters, combines mappers, and **maps those arguments before computing the cache key**. The existing-instantiation cache lookup occurs only after this traversal. Reusing an object already instantiated with the same effective concrete arguments therefore does not make a deep captured argument free to revisit.
5. The captured callback/factory structure is visible in the supplied trace: at 200,000 instantiations it reaches the original `value => value + 1` callback; at 250,000 it reaches the synthetic `() => ReturnType<F>` type in `provider.ts`. Earlier frames traverse `From` and `ModulePublicProviders` on the same route from the mapped output template.

`OutputFactory<ReturnType<F>>` moves the expensive derivation outside the anonymous callable's captured parameter list. Once a service output is the concrete `number`, revisiting the callable maps the cheap output argument rather than walking the callback and its retained context. The same reasoning applies to `OutputFactory<ProviderOutput<R>>` in public module projections. This addresses mapper traversal before cache lookup; it does not try to suppress inference or replace the public output map.

## The one bounded comparison

Both variants compiled the **original 200-module fixture**, including its original final `const result: number = graph.resolve(...)` expression, with the same strict options and classic 6.0.3. All other source types were pinned to baseline snapshots. The comparison was serialized under `/tmp/di-bag-compiler-heavy.lock`.

The diagnostic compiler copy added only a counter at the existing instantiation increment, gated on the generated final `resolve` call. It did not alter compiler checks, limits, source workloads, or production files.

| Metric | Baseline | Output-factory alias |
| --- | ---: | ---: |
| Diagnostics | 0 | 0 |
| Total instantiations | 6,349,369 | 3,685,817 |
| Instantiations attributed to final resolve | 295,172 | 11,000 |
| Measured elapsed milliseconds | 5,406 | 3,853 |

Total work falls by **2,663,552 (41.95%)**; attributed final-resolution work falls by **284,172 (96.27%)**. Timing is a single-run observation, not a statistical performance claim. The instrumented final-call count is broader than the coordinator's 287,600 output-isolation delta, so the two figures should not be treated as identical metrics.

Artifacts:

- `candidate.synthetic.provider.ts` and `candidate.synthetic.module-types.ts`: candidate source snapshots.
- `baseline.synthetic.provider.ts` and `baseline.synthetic.module-types.ts`: comparison source snapshots.
- `synthetic-factory-probe.mjs`: complete reproducible probe.
- `{baseline,candidate}.synthetic-result.json`: raw results.

All are under `/tmp/di-bag-selected-resolution-review`.

## Compatibility boundary

The candidate keeps `Bag.resolve`, `Provided`, `Entries`, `From`, token admission, provider graph/metadata retention, and invariant provider witness shape unchanged. It adds no conditional branch or `NoInfer` wrapper. Every factored callable still has exactly one zero-argument call signature `() => O`, with no added receiver, dependency parameter, optional parameter, or overload. Promise-valued output remains the same exact `O`; nothing adds `Awaited` to the exposed output.

These properties avoid the mechanisms behind the previously demonstrated regressions: lost optionality, `any` selection tightening, outward `NoInfer<T>` leakage, deferred `InstalledEntries` identity, and deferred symbol-conditionals in public entry construction. Nevertheless, the one permitted comparison only checked the 200-module workload; **the counterexample fixtures and emitted/package consumers have not yet been compiled with this candidate**. The recommendation is to run those checks next, including generic Provider factory equality/assignability and declaration nameability of the private aliases. No native 1000-module success or production readiness is claimed here.
