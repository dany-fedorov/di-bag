# Phase 11 observability and errors evidence

Recorded on 2026-09-25 at `d3e9826` with Bun 1.4.0 first on `PATH`, Node v24.20.0 and TypeScript 6.0.3. The comparison baseline is [`baseline.md`](baseline.md), produced from the 0.4.0 source. The first sandboxed harness attempt could not spawn its isolated Node workers (`EPERM`) and produced no usable compiler rows; the identical permitted rerun below completed all twelve workers successfully.

| Case | Count | Instantiations | Baseline | Change | Milliseconds | Max RSS MiB | Accepted |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| bulk | 100 | 143,100 | 159,001 | -10.0% | 1,056 | 361 | yes |
| chained | 100 | 766,567 | 787,814 | -2.7% | 1,515 | 414 | yes |
| grouped | 100 | 150,393 | 166,348 | -9.6% | 1,089 | 363 | yes |
| replacement | 100 | 1,016,677 | 1,031,260 | -1.4% | 1,520 | 413 | yes |
| bindings | 100 | 831,200 | 847,247 | -1.9% | 1,885 | 425 | yes |
| modules | 100 | 790,192 | 1,241,644 | -36.4% | 2,144 | 490 | yes |
| bulk | 500 | 791,500 | 806,601 | -1.9% | 1,697 | 436 | yes |
| chained | 500 | 13,914,167 | 13,956,214 | -0.3% | 10,758 | 1,680 | yes |
| grouped | 500 | 1,044,785 | 1,060,372 | -1.5% | 1,732 | 418 | yes |
| replacement | 500 | 21,758,677 | 21,767,660 | -0.0% | 13,261 | 2,265 | yes |
| bindings | 500 | 12,136,600 | 12,153,047 | -0.1% | 10,480 | 1,798 | yes |
| modules | 500 | 10,524,792 | 19,719,044 | -46.6% | 11,461 | 1,818 | yes |

Decision: accepted. Every worker accepted its case, and every cumulative change remains within the baseline +10% ceiling.
