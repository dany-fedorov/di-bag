# Typed-token carrier: bounded compiler evidence

This is a throwaway declaration-model investigation, not an implemented token
API or a completed token milestone. Production source was pinned to `6874760`;
the verified repository checkpoint is `23e300f`. The existing identity-only
proof remains in [the token identity report](2026-09-06-typed-token-investigation.md).

## Candidate and limits

The candidate adds one invariant provider graph contract carrying required
tokens and an optional bound token contract, alongside existing factory F,
metadata M and acquisition frames A. It generalizes internal description-map
keys to string/symbol, keeps named admission string-only, and retains token
consumer constraints in module C without a fifth Module generic.

Its public token D retains original bound registrations; install projects a
zero-needs host view while retaining bound identity, output, metadata and frames.
That is a material difference from current export-time PublicProvider projection
in [module-types.ts](../../src/module-types.ts). The model also uses accumulated
registration intersections rather than production's flat Entry history, and
simplifies add-time checking and external-requirement views. None of these
differences has been selected as a production change.

The first model produced ordinary diagnostics: generic tuple/needs constraint
plumbing, declaration-emission TS4118 on anonymous symbol-keyed maps, and two
failed exact opaque-carrier assertions. No negative directive was unused, but
the complete directive-removal source/emitted proof did not run.

One combined refinement named map aliases, narrowed generic branches, added an
erased-provider guard and made host projection explicit. Its API alone compiles;
the complete consumer exhausts TypeScript's default approximately 4 GiB heap.
A diagnostic-only 512 MiB run reproduces the exhaustion before declaration emit.
This does not prove the fourth carrier itself is inherently expensive or that
production di-bag has this failure.

## Independent controller isolation

The controller read the complete model and report, then used a virtual source
host and isolated 384 MiB / 10-second compiler children. No model API changes
were made in these controls. TypeScript 5.9.3, Node 24.20.0:

| Consumer prefix or appended operation | Source diagnostic result |
| --- | --- |
| First 20 declarations, through plain module export | Zero diagnostics, 742 ms |
| First 40 declarations, through two token exports | Zero diagnostics, 787 ms |
| First 45 declarations, including exact exported metadata/frame proofs | Zero diagnostics, 788 ms |
| Declaration 46: install token module, install consumer module, build, resolve | Heap exhaustion |
| Prefix45 plus first token-module install | Zero diagnostics, 778 ms |
| Prefix45 plus both module installs | Zero diagnostics, 781 ms |
| Prefix45 plus both installs and build | Zero diagnostics, 781 ms |
| Prefix45 plus both installs, build and resolve | Heap exhaustion |
| Prefix45 plus first install, build and resolve | Zero diagnostics, 790 ms |

The first failing operation is therefore resolution from the twice-installed
graph in this model, not either installation or graph closure on its own.
The follow-up below isolates the inferred return boundary and completes the
bounded source/emitted safety matrix, without establishing production integration.

Local reproductions:

```sh
node /tmp/di-bag-token-carrier-prefix.cjs 20 40 60 80
node /tmp/di-bag-token-carrier-prefix.cjs 50 45 48 49
node /tmp/di-bag-token-carrier-prefix.cjs 46 47
node /tmp/di-bag-token-carrier-prefix.cjs stages
```

The parent harness returns zero when it reports child outcomes; inspect each
child's status, signal and fatal flag, not the parent exit code alone. A SIGABRT
heap failure is not a passing negative type test. These controls do not emit
declarations and do not execute a DI runtime.

Full advisor evidence and exact first/refined delta:
`/tmp/di-bag-token-carrier-advisory.md` and
`/tmp/di-bag-token-carrier.XcLUDA/refinement.diff`. The model, consumer and intended
29-case negative matrix remain in that scratch directory. A bounded follow-up
isolated the generic resolve boundary as described below.

## Isolated return correction and completed bounded proof

Predeclaring the built bag still exhausts the heap; supplying resolve's token
generic explicitly passes with exact Rich output. Direct bound-token and output
lookups also pass. Removing argument admission gates does not help. Replacing
only the return with void avoids exhaustion but intentionally loses output
typing; wrapping the existing return lookups in NoInfer still exhausts the heap.

The smallest successful model correction keeps every admission gate and replaces
the nested conditional return with `Output<R[Key<V> & keyof R]>`. R already
constrains each indexed value to a registration; the key intersection limits the
lookup to actual graph keys. Missing and incompatible tokens remain rejected by
the unchanged parameter check. This is evidence of a problematic inferred-return
interaction, not a minimized claim about TypeScript compiler internals.

Controller independently read and ran the full verifier:

```sh
node /tmp/di-bag-token-carrier-resolved-check.mjs
```

Each phase uses a fresh 384 MiB / 10-second compiler process. Actual results:

- Source plus declaration emission: zero diagnostics, 963 ms.
- The same consumer against emitted declarations: zero diagnostics, 943 ms.
- Directive removal: 32 exact diagnostics at all 29 intended source locations,
  938 ms. Three lines each reject admission and closure; the verifier checks both.
- Emitted directive removal: the same complete line/code matrix, 925 ms.

The verifier also checks emitted exact Rich/Promise/number/string outputs and
declaration-preserved provider/module invariant witnesses. Original failing
api.ts/probe.ts remain intact; the correction is virtual. These results establish
feasibility of the bounded carrier model, not runtime behavior, production
add/fork/rename inference, the chosen projection timing, or compiler scalability.
The typed-token subsystem design must carry those remaining obligations.
