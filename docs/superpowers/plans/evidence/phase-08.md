# Phase 08 provider-source compiler evidence

The first authorized guarded attempt (`phase08-task2-s4`) was invalid: sandboxed child compiler `spawnSync` returned `EPERM` for all twelve cases. Its rows were `n/a`, not a budget result. The controller reran the same evidence lane through the approved execution path as `phase08-task2-s4-escalated`; it exited 0 without a resource stop (minimum available memory 10.21 GiB). The valid JSON is `/tmp/phase-08-s4-escalated.json`, with receipt and log under `/tmp/di-bag-resume-20260921/gates-phase00/`.

The S4 decision used `node scripts/evidence-cases.mjs --compare docs/superpowers/plans/evidence/baseline.md --json /tmp/phase-08-s4-escalated.json`, guarded with `DI_BAG_GUARD_MIN_AVAILABLE_GIB=12`, `GOMAXPROCS=2`, and a task-owned Node compile cache. Node was v24.20.0. The compiler wrapper is `6.0.2`; the actual TypeScript API reported by every JSON row is `6.0.3`.

After the compatibility surface was removed at `d6084c2`, the authorized final command was `node scripts/evidence-cases.mjs --compare docs/superpowers/plans/evidence/baseline.md --json /tmp/phase-08-final-evidence.json`, under the same 12 GiB launch floor, pinned Bun 1.4.0/Node 24.20.0, `GOMAXPROCS=2`, and Task 6 caches. Its guarded receipt is `/tmp/di-bag-resume-20260921/gates-phase00/phase08-task6-final-evidence.json`: exit 0, no resource stop, 64.01 seconds, minimum available memory 10.52 GiB. All twelve workers reported `accepted: true`; for the `bindings` and `modules` token workers, accepted means no compiler diagnostics. The rows below are the literal final instantiation, time, and memory values from `/tmp/phase-08-final-evidence.json`; percentages are calculated against the phase-0 baseline.

| Case | Count | Baseline instantiations | Final instantiations | Change | Milliseconds | Max RSS MiB | Accepted |
| --- | --- | --- | --- | --- | --- | --- | --- |
| bulk | 100 | 159,001 | 145,509 | -8.49% | 1,114 | 366 | yes |
| chained | 100 | 787,814 | 768,976 | -2.39% | 1,587 | 395 | yes |
| grouped | 100 | 166,348 | 152,802 | -8.14% | 1,108 | 340 | yes |
| replacement | 100 | 1,031,260 | 1,017,968 | -1.29% | 1,559 | 393 | yes |
| bindings | 100 | 847,247 | 835,248 | -1.42% | 1,964 | 434 | yes |
| modules | 100 | 1,241,644 | 794,540 | -36.01% | 2,208 | 438 | yes |
| bulk | 500 | 806,601 | 794,709 | -1.47% | 1,757 | 417 | yes |
| chained | 500 | 13,956,214 | 13,917,376 | -0.28% | 10,984 | 1,668 | yes |
| grouped | 500 | 1,060,372 | 1,047,994 | -1.17% | 1,794 | 398 | yes |
| replacement | 500 | 21,767,660 | 21,756,768 | -0.05% | 13,241 | 2,247 | yes |
| bindings | 500 | 12,153,047 | 12,147,848 | -0.04% | 10,709 | 1,869 | yes |
| modules | 500 | 19,719,044 | 10,537,540 | -46.56% | 11,188 | 1,884 | yes |

The guarded four-case compiler fixture passed 4/4 before the S4 measurement. It proves exact inline required, optional, lazy, and collection arguments, default/rest parameters, and the optional final `FactoryContext`; all nine planned negative cases are rejected at their offending properties, and declaration consumption retains exact types. S4 serious repair 1 of at most 3 was the accepted type shape; no further signature repair was needed. Every final cumulative change is below the +10% ceiling; the highest is `bindings`/500 at -0.04%.

The final retired-name audit has 20 classified physical lines: eleven unrelated `readonly token:` data fields, six deliberately vendored 0.4 graph fixture lines, two `tokenScaleSource`/`tokenScaleBoundaryLine` function names, and one retired-name scanner regex. The broader Task 4 audit also retains exactly eleven historical `.token(` lines in `scripts/phase05-strings.py`, byte-identical to `21817b0` with whole-file SHA-256 `814c708fc113a48860f9597c86c25002c27dff0c57e2e9733382d30b694c08a3`. `docs/guides/api-reference.md:44-51` still describes retired methods; Task 5's independent review explicitly deferred that guide prose to the later guides plan. It is not a current API or checked agent-documentation surface.

Decision: S4 adopted
