# TypeScript 6 inline inference: isolated comparison

Both known inline inference reproductions pass on TypeScript 6.0.3 without any
library change in this bounded experiment. This is not yet a supported-compiler
upgrade or full package/scale compatibility claim. The repository remains pinned
to TypeScript 5.9.3.

## Inputs and isolation

The same immutable `git archive` of
`9d09eefb0a92910f6ce9d69ef76eaca9195a0bb7` supplies both compiler runs. There are
no virtual production patches, weakened callbacks, casts, or changed source forms.
The compiler package is the sole substantive variable. TypeScript 6 also receives
`ignoreDeprecations: '6.0'` to retain the explicit Node10 resolution option without
confusing a configuration warning with a user-contract diagnostic.

The official npm registry returned exact version 6.0.3 with integrity
`sha512-y2TvuxSZPDyQakkFRPZHKFm+KKVqIisdg9/CZwm9ftvKXLP8NRWj38/ODjNbr43SsoXqNuAisEf1GdCxqWcdBw==`.
It was installed only into `/tmp/di-bag-typescript6.hvVoza`, using a local cache,
disabled lifecycle scripts, and no audit/funding step. No repository dependency
or lockfile changed. npm printed its unrelated update notice; neither compiler
child produced warnings or stderr.

Both fresh Node children had a 15-second timeout and 768 MiB old-space cap.
The virtual host retained strict checking, exact optional properties, unchecked
indexed access, ES2022/CommonJS, explicit Node10 resolution, no ambient types,
and the existing skipLibCheck setting. Declaration output stayed in memory;
no `compat-dist` directory was written.

## Reproductions and results

The probe combines the unchanged inline nested `snapshot()` factory and inline
async richer-selected fork from their earlier investigations. The identical
predeclared factories/overrides remain positive controls. Exact assertions cover
the nested adapted output, needs, factory, metadata, ordered acquisition frames,
second adaptation's Promise output, and richer fork service/Promise outputs.

| Check | TypeScript 5.9.3 | TypeScript 6.0.3 |
| --- | --- | --- |
| Inline nested snapshot | TS2345; six exact-type failures | No diagnostics |
| Inline async richer fork | TS2322; one exact-type failure | No diagnostics |
| Identical predeclared controls | No diagnostics | No diagnostics |
| Selected existing positive fixtures | No diagnostics | No diagnostics |
| 129 negative boundaries, source | All retained | All retained |
| 129 negative boundaries, emitted declarations | All retained | All retained |
| Declaration emission | 34 files; no emit diagnostics | 34 files; no emit diagnostics |

The positive fixtures cover boxes, supported inline forks, incremental contracts
and equivalent builder views. Selected negatives cover boxes, provider unions,
explicit fork generics, inline fork dependency/shape/key boundaries, builder
history, incremental checking, invariant token contracts and token modules.
Negative expectations use each fixture's existing diagnostic-marker regions and
message; no missing expectation or out-of-region diagnostic was observed.

Both children exited 0 with null signal, no process error, empty stderr and
visible JSON. The 5.9.3 run took 2,611 ms / 512 MiB peak RSS; 6.0.3 took
2,630 ms / 505 MiB. These are single observations for this probe, not library
performance benchmarks. Source/emitted instantiation counts were 239,777/226,667
and 247,222/234,000 respectively; counters across compilers are not the existing
pinned regression gates.

## Interpretation and remaining proof

The observed result is consistent with the documented change to contextual
inference of methods that do not use `this`, discussed in
[the compiler research at its archived revision](https://github.com/dany-fedorov/di-bag/blob/317af4a3c374893aa9be8581b0bf8e97c7ebb998/docs/research/2026-09-07-typescript-compiler-limits.md).
This comparison changes the whole compiler release, so it does not isolate one
upstream change as the sole cause.

Next, verify real installed CommonJS/ESM consumers, feature declaration emission
and unchanged downstream consumption, all supported source contracts, and current
scale cases under the new compiler. Retain the 5.9.3 baseline before deciding on
a supported-version floor. This probe alone does not complete either inference
requirement, promise compatibility for all TypeScript 6 programs, or address the
large graph failures. The TypeScript 7 native-CLI experiment has not run.

Reproduction script and raw results, retained locally:

- `/tmp/di-bag-typescript6.hvVoza/compare-inference.cjs`
- `/tmp/di-bag-typescript6.hvVoza/results.jsonl`

The script takes a compiler package path and commit label as arguments and the
matching git archive on stdin. Its parent must retain the stated timeout/heap
bounds. No production implementation is imported from the mutable checkout.
