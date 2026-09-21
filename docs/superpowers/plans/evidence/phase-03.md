# Phase 3 evidence: ensure services ready

Measured on branch `phase-03-ensure-services-ready` after the last
implementation task. Every case was accepted and remains below the cumulative
+10% ceiling.

| Case | Baseline instantiations | Instantiations now | Accepted | Change |
| --- | ---: | ---: | --- | ---: |
| bulk 100 | 159,001 | 159,087 | yes | +0.1% |
| chained 100 | 787,814 | 787,900 | yes | +0.0% |
| grouped 100 | 166,348 | 166,434 | yes | +0.1% |
| replacement 100 | 1,031,260 | 1,031,346 | yes | +0.0% |
| bindings 100 | 847,247 | 847,333 | yes | +0.0% |
| modules 100 | 1,241,644 | 1,241,730 | yes | +0.0% |
| bulk 500 | 806,601 | 806,687 | yes | +0.0% |
| chained 500 | 13,956,214 | 13,956,300 | yes | +0.0% |
| grouped 500 | 1,060,372 | 1,060,458 | yes | +0.0% |
| replacement 500 | 21,767,660 | 21,767,746 | yes | +0.0% |
| bindings 500 | 12,153,047 | 12,153,133 | yes | +0.0% |
| modules 500 | 19,719,044 | 19,719,130 | yes | +0.0% |

The phase adds 86 instantiations to each case. The largest displayed change is
+0.1%.
