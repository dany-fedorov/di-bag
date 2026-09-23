# Phase 7 requirement-renaming evidence

Measured on 2026-09-23 against the Phase 0 [baseline](baseline.md), from
`64f030774bd0041da1ed56b16722ad5eec9ee19c` with the Task 5 generator and
worker uncommitted. Linux 7.0.11-76070011-generic, x64, 24 CPUs, 31,689 MiB
physical memory; Node v24.20.0, npm 11.19.0, Bun 1.4.0, TypeScript 6.0.3.
The compiler measurements used Node and TypeScript 6.0.3. Each heavy command
ran separately under `run-guarded.py` with a 12 GiB available-memory launch
floor, `GOMAXPROCS=2`, the npm update notifier disabled, and Task 5 caches.

```sh
node scripts/evidence-cases.mjs --compare docs/superpowers/plans/evidence/baseline.md --json /tmp/phase-07-evidence.json
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-requirement-rename-scale.ts 20 | tee /tmp/phase-07-requirements-20.json
```

The first twelve-case launch in the sandbox could not spawn child Node
workers (`EPERM`). The same guarded command completed with child-process
permission; the table and saved JSON are from that completed run.

| Case | Count | Instantiations | Baseline | Change | Milliseconds | Max RSS MiB | Accepted |
| --- | --- | --- | --- | --- | --- | --- | --- |
| bulk | 100 | 146,886 | 159,001 | -7.6% | 1,106 | 369 | yes |
| chained | 100 | 770,353 | 787,814 | -2.2% | 1,522 | 419 | yes |
| grouped | 100 | 154,179 | 166,348 | -7.3% | 1,080 | 364 | yes |
| replacement | 100 | 1,019,345 | 1,031,260 | -1.2% | 1,511 | 412 | yes |
| bindings | 100 | 834,136 | 847,247 | -1.5% | 1,931 | 464 | yes |
| modules | 100 | 793,428 | 1,241,644 | -36.1% | 2,090 | 489 | yes |
| bulk | 500 | 796,086 | 806,601 | -1.3% | 1,679 | 443 | yes |
| chained | 500 | 13,918,753 | 13,956,214 | -0.3% | 10,607 | 1,751 | yes |
| grouped | 500 | 1,049,371 | 1,060,372 | -1.0% | 1,815 | 425 | yes |
| replacement | 500 | 21,758,145 | 21,767,660 | -0.0% | 12,538 | 2,257 | yes |
| bindings | 500 | 12,137,136 | 12,153,047 | -0.1% | 10,567 | 1,764 | yes |
| modules | 500 | 10,526,828 | 19,719,044 | -46.6% | 10,889 | 1,858 | yes |

S6 uses the selected plural `withInstalledModules` syntax. The separate
20-module requirement-renaming worker reported `accepted: true`,
`diagnosticCount: 0`, 194,205 instantiations, 1,266 milliseconds, and 370 MiB
max RSS. It has no independent numeric ceiling without a comparable baseline.
The focused requirement-renaming compile fixtures, declaration consumer,
relationship-detail assertion, and negative property-location markers passed:
4 tests, 16 assertions, zero failures. They ran with pinned Bun 1.4.0 as
`bun test tests/types.test.ts -t "requirement renaming|requirement-renaming"`.
The earlier Tasks 1–4 aggregate gate
also passed the runtime, graph, build, and documentation checks at the commit
above.

S6 decision: adopt requirement renaming. All twelve cumulative cases were
accepted and each stayed at or below the 10% growth limit; the 20-module
source had no diagnostics, and the compile fixtures retained their expected
diagnostics and locations.
