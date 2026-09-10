# Remaining classic compiler expression-depth failures

The original classic 1,000-call named and replacement cases remain failures. The new controls strongly support an upstream execution-stack limit in recursive expression handling. They do not prove that every possible library declaration arrangement must fail, and they do not reclassify the six original valid/error failures as accepted cases.

This investigation uses source `59d10c6c8ac13d63171f9f39c170da048d7e208c`, preserved unchanged by publication commit `c9f8c181c53116c27c5411389af19773f5e802a6`. That source and its tests and benchmark artifacts are published in [PR 10](https://github.com/dany-fedorov/di-bag/pull/10). This separate evidence package records the subsequent investigation without changing production source or the original acceptance results.

The [official summary](original/summary.json) retains all 40 original comparison rows: 34 accepted and six classic stack failures. All twelve original native 1,000-operation valid/error cases pass. Classic 1,000-operation token bindings and modules also pass. The remaining limitation specifically concerns the long named/replacement fluent expressions, not all graphs with 1,000 registrations. Raw stderr and stdout for all six failures are copied into `original/`.

## What the controls establish

Every control uses authentic classic TypeScript 6.0.3 and Node 24.20.0, original generated expressions, strict options, default execution stack, a 3,072 MiB V8 old-space limit and 60-second deadline. The controls are diagnostics, never replacements for the original acceptance cases. The library-free controls virtualize only the imported API module; the other controls retain the real library source graph. The classic heap option is not an RSS enforcement limit.

| Source variant | 100 named instantiations | 100 replacement instantiations | Original 1,000-call named/replacement result |
| --- | ---: | ---: | --- |
| Exact final source | 773,356 | 1,011,125 | Both stack overflow |
| Private finite-key distribution | 771,320 | 1,009,678 | Both stack overflow; not adopted |
| Add admission checks erased | 137,679 | 990,363 | Both stack overflow; deliberately incompatible |
| Add/replace history erased | 76,266 | 76,267 | Both stack overflow; deliberately incompatible |
| Entire exported facade typed as `any` | 78,350 | 78,350 | Both stack overflow in untyped-call checking; deliberately incompatible |

The paired baseline 100-call runs and every variant's raw stdout/stderr are retained in `probes/`. History erasure produces three expected unresolved-name diagnostics at 100 calls, so normal process completion is not successful library acceptance. No weakened signature was applied to production. The finite-key prototype's small work reduction was insufficient to solve the target failure and did not receive adoption or compatibility approval.

Earlier [library-free imported controls](probes/imported-controls.jsonl) passed at 500 calls and overflowed during binding at 1,000 calls. Their different compiler phase prevented them from identifying the original checker failure on their own. [Validation/history erasure](probes/erasure-ablation-rows.jsonl) showed that admission predicates and accumulated history were unnecessary for a checker overflow. The stronger [root-any control](probes/root-any-ablation-rows.jsonl) changes exactly one annotation, `DiBag: Facade` to `DiBag: any`, preserving the whole actual source graph and original expression. Both 1,000-call forms still fail inside `resolveCallExpression` when entering `resolveUntypedCall`. Thus the failure persists while typing through the exported facade is entirely bypassed. The rest of the source program and callback syntax still undergo normal compilation.

## Repeated checker frames

Extended error captures use `--stack-trace-limit=15000`, which controls recorded error frames and does not increase execution-stack size. Compiler implementation, generated source, heap and deadline remain unchanged. Every capture stays below 4 MiB output. These diagnostic repeats are separate from original acceptance rows.

| Source / form | Visible named frames | Collapsed duplicate frames | Expanded named frame count |
| --- | ---: | ---: | ---: |
| Final / named | 99 | 9,980 | 10,079 |
| Final / replacement | 89 | 9,990 | 10,079 |
| Root-any / named | 59 | 9,990 | 10,049 |
| Root-any / replacement | 59 | 10,000 | 10,059 |

The formatter collapses repeated ten-frame blocks, so 59 visible lines is not a 59-frame execution stack. The [derived comparison](probes/full-stack-comparison.json) adds the explicitly recorded collapsed counts; it excludes anonymous frames. The initial visible-only summary remains labeled separately. The raw traces show approximately 1,000 repeated receiver/call cycles in both the original typed and root-any cases.

The [installed compiler excerpts](compiler-excerpts.txt) show the relevant recursion: call checking requests the callee expression; property access requests its receiver; the next nested call repeats that work. Typed overload handling subsequently instantiates parameter types, explaining why a private admission map appeared at the top of an original failure. Removing that map's work cannot remove the preceding receiver stack. The untyped branch still needs ordinary argument checking and also overflows.

A separate diagnostic compiler copy recorded a first `add` signature with `E = C = never`. That is useful supporting evidence, but its four reference-capture insertions can alter stack behavior; the replacement capture moved to module resolution. These captures are not a complete causal trace or acceptance evidence. The copy of the compiler is intentionally omitted from this package: `probes/instrument-setup.py` rebuilds it from the pinned installation and records its identity. The decisive root-any and extended-error runs use the unmodified compiler.

## Independent assessment and next boundary

The [independent architecture review](review.md) found no evidence-backed compatible library reformulation to recommend for these remaining failures. The original [unmodified reviewer text](review-original.txt) is retained; the portable copy changes only local evidence links. The recommended architectural direction is an upstream explicit continuation stack for ordinary call/property-access chains, including the binder's treatment of the syntax, while preserving check order, contextual inference, overload selection and diagnostics. That is a proposed direction, not an implemented compiler fix or a demonstrated original-case pass.

An [upstream issue draft](upstream-issue-draft.md) is prepared locally and has not been submitted. The six original classic failures remain unresolved. Larger execution stacks, warmup expressions, grouped substitutes, erased validation, or a patched compiler are not silently counted as successes under the supported original configuration.

## Reproduction and identity

Use the repository's pinned dependencies and a clean checkout at the source revision. The scratch workers preserve their original `/tmp/di-bag-replacement-spike` and `/tmp/di-bag-classic-depth-probe` paths; adjust them to equivalent isolated directories when reproducing elsewhere. Compiler processes were serialized with `/tmp/di-bag-compiler-heavy.lock`.

For the authentic root-any control, run the recorded `classic-worker.mjs root-api-any 1000 chained` or `replacement` command from the checkout, with the original heap and timeout settings. The variant snapshots differ from final source only as recorded in their identity file. The rows retain full commands and results. Reproducing an intentionally invalid control is distinct from passing a library contract test.

[source-manifest.json](source-manifest.json) fingerprints all 35 production files, the original compiler/generator/package inputs and the installed compiler. [artifact-manifest.json](artifact-manifest.json) checksums every other artifact. Production, tests, index and HEAD remained unchanged throughout this investigation.
