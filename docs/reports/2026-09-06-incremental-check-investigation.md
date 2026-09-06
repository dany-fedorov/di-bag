# Incremental graph checks: bounded compiler evidence

This is a virtual candidate against `88b390d`, not a production optimization or
a completed compiler-scale milestone. Source and original generated fixtures
were loaded from that commit with a virtual CompilerHost. No runtime or public
fixture changes were used to obtain these results.

## Candidate and invariant

The current builder rechecks the entire reconstructed graph at every add and
replacement. The candidate keeps the flat entry representation but checks only
new/changed relationships:

1. Validate new registrations' dependency domains and their mutual shapes.
2. Check new consumers against surviving old providers.
3. Check surviving old consumers against new/replaced providers.

Already valid unchanged relationships need no repeated validation. Final
missing-dependency closure, module constraints, key restrictions and contextual
inference remain in place. Fork/install checks are unchanged. This invariant
requires broader production verification before adoption.

## Single-observation results

TypeScript 5.9.3, Node 24.20.0, strict original fixture options, one 60-second
limited compiler child per case, shared machine:

| Calls | Form | Case | Compiler time | Peak memory | Result |
| ---: | --- | --- | ---: | ---: | --- |
| 100 | add | valid | 984 ms | 351 MiB | No diagnostics |
| 100 | replace | valid | 1,475 ms | 429 MiB | No diagnostics |
| 500 | add | valid | 9,596 ms | 1,508 MiB | No diagnostics |
| 500 | add | missing | 9,189 ms | 1,383 MiB | Intended missing-factory diagnostic |
| 500 | add | wrong shape | 9,367 ms | 1,517 MiB | Intended error at offending add |
| 500 | replace | valid | 24,298 ms | 2,693 MiB | No diagnostics |
| 500 | replace | missing | 24,381 ms | 2,793 MiB | Intended missing-factory diagnostic |
| 500 | replace | wrong shape | 24,365 ms | 2,704 MiB | Intended replacement/consumer errors |

The controller independently repeated the 100-add valid candidate: 877 compiler
ms, 356 MiB, zero diagnostics. The 500-call observations above are the advisor's
runs, not independent repeated measurements. Earlier whole-graph checking
timed out at 500 calls; these measurements are not a controlled statistical
comparison or an editor-latency guarantee. Memory remains a material limitation.

## Focused contracts and limits

The advisor checked positive forward references, exact method-return inference,
existing inline-add and boundary fixtures, and ten negative markers covering
wrong shapes in both registration orders, provider/consumer replacements,
missing closure, duplicate/missing keys and explicit erasure restrictions.
No measured case produced TS2589. Invalid operations remain rejected at their
own call; the candidate no longer repeats the same invalid graph diagnostic at
later unrelated additions.

An explicitly erased `add<{}>` key set hides a duplicate from the baseline and
candidate alike; runtime duplicate rejection remains. The investigation does
not claim to recover type information explicitly erased by a caller.

Not run: full suites, emitted declarations, module/grouped scale matrices or
1000-call experiments. The existing 1000-call binder failure is untouched.
The current provider-metadata implementation is also outside this pinned proof.
Adoption requires a separate planned implementation and complete review against
the then-current source contracts.

Local detailed evidence: `/tmp/di-bag-incremental-check-advisory.md` and
`/tmp/di-bag-incremental-check-probe.mjs`. Example read-only command:

```sh
node /tmp/di-bag-incremental-check-probe.mjs run incremental 500 chained
```
