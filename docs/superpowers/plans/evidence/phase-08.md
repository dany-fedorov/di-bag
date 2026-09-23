# Phase 08 S4 compiler evidence

The first authorized guarded attempt (`phase08-task2-s4`) was invalid: sandboxed child compiler `spawnSync` returned `EPERM` for all twelve cases. Its rows were `n/a`, not a budget result. The controller reran the same evidence lane through the approved execution path as `phase08-task2-s4-escalated`; it exited 0 without a resource stop (minimum available memory 10.21 GiB). The valid JSON is `/tmp/phase-08-s4-escalated.json`, with receipt and log under `/tmp/di-bag-resume-20260921/gates-phase00/`.

Command: `node scripts/evidence-cases.mjs --compare docs/superpowers/plans/evidence/baseline.md --json /tmp/phase-08-s4-escalated.json`, guarded with `DI_BAG_GUARD_MIN_AVAILABLE_GIB=12`, `GOMAXPROCS=2`, and a task-owned Node compile cache. Node was v24.20.0. The compiler wrapper is `6.0.2`; the actual TypeScript API reported by every JSON row is `6.0.3`.

| Case | Count | Instantiations | Baseline | Change | Milliseconds | Max RSS MiB | Accepted |
| --- | --- | --- | --- | --- | --- | --- | --- |
| bulk | 100 | 149,320 | 159,001 | -6.1% | 1,131 | 343 | yes |
| chained | 100 | 772,787 | 787,814 | -1.9% | 1,570 | 384 | yes |
| grouped | 100 | 156,613 | 166,348 | -5.9% | 1,147 | 343 | yes |
| replacement | 100 | 1,021,779 | 1,031,260 | -0.9% | 1,582 | 386 | yes |
| bindings | 100 | 837,067 | 847,247 | -1.2% | 2,004 | 413 | yes |
| modules | 100 | 796,359 | 1,241,644 | -35.9% | 2,201 | 433 | yes |
| bulk | 500 | 798,520 | 806,601 | -1.0% | 1,782 | 425 | yes |
| chained | 500 | 13,921,187 | 13,956,214 | -0.3% | 10,312 | 1,390 | yes |
| grouped | 500 | 1,051,805 | 1,060,372 | -0.8% | 1,812 | 393 | yes |
| replacement | 500 | 21,760,579 | 21,767,660 | -0.0% | 12,285 | 1,971 | yes |
| bindings | 500 | 12,142,067 | 12,153,047 | -0.1% | 11,169 | 1,609 | yes |
| modules | 500 | 10,531,759 | 19,719,044 | -46.6% | 11,418 | 1,550 | yes |

The guarded four-case compiler fixture passed 4/4 before measurement. It proves exact inline required, optional, lazy, and collection arguments, default/rest parameters, and the optional final `FactoryContext`; all nine planned negative cases are rejected at their offending properties, and declaration consumption retains exact types. S4 serious repair 1 of at most 3 was the accepted type shape; no further signature repair was needed. Every measured cumulative change is at or below +10%.

Decision: S4 adopted
