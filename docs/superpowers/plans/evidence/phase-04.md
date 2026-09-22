# Phase 04 compiler evidence

## Expand (S5)

The primary `resolve(collectionToken)` / `inspect(collectionToken)` shape was
not measured because its required compiler fixture did not pass. The bounded
repair attempts were:

1. The proposal used `Extract<Intersect<finite symbol records>, Registrations>`;
   against the repository's string-indexed `Registrations` alias, that result
   collapsed to `never`. The first repair added an intersection with
   `Registrations`, which admitted broad string keys; removing that widening
   preserved finite keys, while the wrong-output fork still reported a generic
   computed-property error.
2. Inferring the override object before intersecting its contextual contract
   caused the fixture compiler to overflow its call stack. This change was
   reverted.
3. Separating collection output admission from contextual return typing still
   did not produce the two required `token binding output is not assignable to
   its service` diagnostics for `replace` and `fork`.

The three-attempt limit selected the explicit `resolveCollection` and
`inspectCollection` fallback. Primary S5 measurement was not run because the
compiler contract was already rejected. An initial fallback measurement was
also rejected because the source still contained expand-compatibility compiler
errors; its table and JSON were retained outside the repository and were not
used as cost evidence. After those errors were corrected, the full typecheck
passed and the valid fallback measured as follows.

| Case | Count | Instantiations | Baseline | Change | Milliseconds | Max RSS MiB | Accepted |
| --- | --- | --- | --- | --- | --- | --- | --- |
| bulk | 100 | 169,494 | 159,001 | +6.6% | 1,087 | 360 | yes |
| chained | 100 | 798,307 | 787,814 | +1.3% | 1,529 | 413 | yes |
| grouped | 100 | 176,841 | 166,348 | +6.3% | 1,066 | 363 | yes |
| replacement | 100 | 1,041,753 | 1,031,260 | +1.0% | 1,500 | 409 | yes |
| bindings | 100 | 863,755 | 847,247 | +1.9% | 1,887 | 458 | yes |
| modules | 100 | 1,259,583 | 1,241,644 | +1.4% | 2,356 | 547 | yes |
| bulk | 500 | 817,094 | 806,601 | +1.3% | 1,689 | 443 | yes |
| chained | 500 | 13,966,707 | 13,956,214 | +0.1% | 10,677 | 1,690 | yes |
| grouped | 500 | 1,070,865 | 1,060,372 | +1.0% | 1,824 | 420 | yes |
| replacement | 500 | 21,778,153 | 21,767,660 | +0.0% | 13,627 | 2,245 | yes |
| bindings | 500 | 12,193,555 | 12,153,047 | +0.3% | 10,860 | 1,765 | yes |
| modules | 500 | 19,766,583 | 19,719,044 | +0.2% | 16,987 | 2,256 | yes |

Decision: fallback

## Migration admission repair

Migrating the last `resolveAll` negative control exposed that the fallback
`resolveCollection` and `inspectCollection` signatures had omitted the existing
finite, individually-known token admission. Both reads now apply that admission
before collection-contract compatibility, so mixed and wholly incompatible
unions keep the finite-tuple diagnostic while a single incompatible handle keeps
its collection-contract diagnostic. A sandboxed comparator attempt was invalid
because every nested Node compiler spawn failed with `EPERM`; the unchanged
escalated run below is the accepted measurement.

Recorded 2026-09-22T03:20:32.129Z at `24d5e47` with uncommitted Task 7 hand
changes on Linux 7.0.11-76070011-generic, x64, 24 CPUs, 31,689 MiB, Node
v24.20.0, TypeScript 6.0.3.

| Case | Count | Instantiations | Baseline | Change | Milliseconds | Max RSS MiB | Accepted |
| --- | --- | --- | --- | --- | --- | --- | --- |
| bulk | 100 | 169,650 | 159,001 | +6.7% | 1,042 | 365 | yes |
| chained | 100 | 798,463 | 787,814 | +1.4% | 1,463 | 414 | yes |
| grouped | 100 | 176,997 | 166,348 | +6.4% | 1,028 | 366 | yes |
| replacement | 100 | 1,041,909 | 1,031,260 | +1.0% | 1,478 | 410 | yes |
| bindings | 100 | 863,911 | 847,247 | +2.0% | 1,832 | 460 | yes |
| modules | 100 | 1,259,739 | 1,241,644 | +1.5% | 2,255 | 577 | yes |
| bulk | 500 | 817,250 | 806,601 | +1.3% | 1,642 | 433 | yes |
| chained | 500 | 13,966,863 | 13,956,214 | +0.1% | 10,145 | 1,697 | yes |
| grouped | 500 | 1,071,021 | 1,060,372 | +1.0% | 1,662 | 421 | yes |
| replacement | 500 | 21,778,309 | 21,767,660 | +0.0% | 11,907 | 2,261 | yes |
| bindings | 500 | 12,193,711 | 12,153,047 | +0.3% | 9,708 | 1,802 | yes |
| modules | 500 | 19,766,739 | 19,719,044 | +0.2% | 15,954 | 2,316 | yes |

Decision: keep fallback with ordered finite-token admission

## Contract

The contracted public surface keeps the explicit `resolveCollection` and
`inspectCollection` fallback with ordered finite-token admission. The final
reviewed source at `fd5b72a` measured all twelve cases within the cumulative
10% budget using Node v24.20.0 and TypeScript 6.0.3.

| Case | Count | Instantiations | Baseline | Change | Milliseconds | Max RSS MiB | Accepted |
| --- | --- | --- | --- | --- | --- | --- | --- |
| bulk | 100 | 168,599 | 159,001 | +6.0% | 1,127 | 357 | yes |
| chained | 100 | 797,412 | 787,814 | +1.2% | 1,522 | 406 | yes |
| grouped | 100 | 175,946 | 166,348 | +5.8% | 1,062 | 359 | yes |
| replacement | 100 | 1,040,858 | 1,031,260 | +0.9% | 1,504 | 414 | yes |
| bindings | 100 | 862,860 | 847,247 | +1.8% | 1,897 | 455 | yes |
| modules | 100 | 1,258,088 | 1,241,644 | +1.3% | 2,315 | 575 | yes |
| bulk | 500 | 816,199 | 806,601 | +1.2% | 1,678 | 435 | yes |
| chained | 500 | 13,965,812 | 13,956,214 | +0.1% | 10,424 | 1,713 | yes |
| grouped | 500 | 1,069,970 | 1,060,372 | +0.9% | 1,680 | 421 | yes |
| replacement | 500 | 21,777,258 | 21,767,660 | +0.0% | 12,588 | 2,261 | yes |
| bindings | 500 | 12,192,660 | 12,153,047 | +0.3% | 10,139 | 1,746 | yes |
| modules | 500 | 19,762,688 | 19,719,044 | +0.2% | 16,996 | 2,287 | yes |

Decision: fallback retained

### Final repaired contract

The declaration-portability repair at `b22f2b3` moved reflected signatures
behind their exported facades and restored the 2,425-byte empty-module shape.
The fallback behavior and ordered finite-token admission are unchanged. This is
the final reviewed-source measurement; the preceding `fd5b72a` table is retained
as history from the failed complete-check boundary.

| Case | Count | Instantiations | Baseline | Change | Milliseconds | Max RSS MiB | Accepted |
| --- | --- | --- | --- | --- | --- | --- | --- |
| bulk | 100 | 168,543 | 159,001 | +6.0% | 1,081 | 368 | yes |
| chained | 100 | 791,812 | 787,814 | +0.5% | 1,518 | 422 | yes |
| grouped | 100 | 175,834 | 166,348 | +5.7% | 1,088 | 369 | yes |
| replacement | 100 | 1,040,802 | 1,031,260 | +0.9% | 1,476 | 423 | yes |
| bindings | 100 | 856,447 | 847,247 | +1.1% | 1,870 | 463 | yes |
| modules | 100 | 1,250,231 | 1,241,644 | +0.7% | 2,248 | 560 | yes |
| bulk | 500 | 817,743 | 806,601 | +1.4% | 1,670 | 432 | yes |
| chained | 500 | 13,939,412 | 13,956,214 | -0.1% | 11,133 | 1,747 | yes |
| grouped | 500 | 1,071,010 | 1,060,372 | +1.0% | 1,741 | 429 | yes |
| replacement | 500 | 21,778,802 | 21,767,660 | +0.1% | 11,819 | 2,242 | yes |
| bindings | 500 | 12,162,247 | 12,153,047 | +0.1% | 10,073 | 1,794 | yes |
| modules | 500 | 19,725,231 | 19,719,044 | +0.0% | 16,537 | 2,274 | yes |

Decision: fallback retained after declaration repair
