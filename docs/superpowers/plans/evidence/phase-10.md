# Phase 10 S8 singleton-default measurement

The candidate is `d2757752d013631a62ad6204f141178b607d75c8` plus the uncommitted Task 5 generator and worker. `git diff HEAD -- src` was empty: the measured library source and dependencies were unchanged by Task 5. The comparison baseline is [`baseline.md`](baseline.md), produced from 0.4.0 source. The Phase 9 base for the authorized paired ceiling comparison is `next` at `632bf90ec5fb2ebe89854ec3f6901695fe168783`; that comparison was not launched after the cumulative baseline rejected S8.

## Provenance and receipts

All commands used `/tmp/di-bag-resume-20260921/run-guarded.py` with its pinned Bun `1.4.0` PATH and unchanged runtime stop conditions. The launch floor was `DI_BAG_GUARD_MIN_AVAILABLE_GIB=9`. Each command had a separate controller-granted slot and a fresh prelaunch MemAvailable reading above 9 GiB. The two S8 workers and all twelve real evidence workers reported Node `v24.20.0` and the TypeScript API `6.0.3`. The installed TypeScript wrapper metadata reports `6.0.2`; the native `7.0.2` compiler was not used in these commands.

| Slot | Exact guarded command suffix after `run-guarded.py` | Fresh MemAvailable | Guard launch / minimum GiB | Exit | Receipt and raw-output SHA-256 |
| --- | --- | ---: | ---: | ---: | --- |
| 1 | `phase10-task5-s8-fast /tmp/di-bag-resume-20260921/phase10 node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-singleton-default-scale.ts no-scoped-service 100` | 13.83 GiB | 14.19 / 13.99 | 0 | `phase10-task5-s8-fast.json`; log `2777b54912b78884fd9aa721a07370813bbf249e02f6a25d017116686d1efd0d` |
| 2 | `phase10-task5-s8-capture /tmp/di-bag-resume-20260921/phase10 node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-singleton-default-scale.ts scoped-service-at-chain-end 100` | 13.79 GiB | 12.93 / 12.45 | 0 | `phase10-task5-s8-capture.json`; log `df4548fa762835f6a8f8111cd44a6c0071af0eaa5533af7130e7ac3f8de4d58a` |
| 3 | `phase10-task5-standard /tmp/di-bag-resume-20260921/phase10 node scripts/evidence-cases.mjs --compare docs/superpowers/plans/evidence/baseline.md --json /tmp/di-bag-phase-10-evidence.json` | 11.16 GiB | 13.60 / 6.71 | 1 | `phase10-task5-standard.json`; log `86af38c5314c9b138fab5e37dbdd0b6c45de228719b45fb5d92b7ed638c90dd3` |
| 3R | `phase10-task5-standard-subprocess /tmp/di-bag-resume-20260921/phase10 node scripts/evidence-cases.mjs --compare docs/superpowers/plans/evidence/baseline.md --json /tmp/di-bag-phase-10-evidence.json` | 13.48 GiB | 12.64 / 8.98 | 1 | `phase10-task5-standard-subprocess.json`; log `a11d3e62b942fe48becf8951c2ff71140b77bd51aad63c698f6470f46d5ce510` |

Receipt files and complete logs are under `/tmp/di-bag-resume-20260921/gates-phase00/`. None of the four guards resource-stopped. Slot 3 produced twelve `spawnSync …/node EPERM` failures under the sandbox and **no usable compiler rows**. The controller granted a narrow child-spawn escalation for slot 3R with the same workload. Its complete JSON evidence is `/tmp/di-bag-phase-10-evidence.json`, SHA-256 `250dda214b7de32535dc28476d2124d50bd3e5d32f3897e164efc08c6f9a348a`. The CLI exited 1 because the measured budget rejected the candidate, not because the guard stopped it.

## Twelve cumulative baseline rows

Change is `(phase 10 / baseline − 1) × 100`, rounded to two decimals. `Accepted` is the worker's correctness flag, independent of the +10% cumulative budget. Eleven workers accepted; the 500-module worker rejected its case.

| Case | Count | Baseline instantiations | Phase 10 instantiations | Change | Accepted |
| --- | ---: | ---: | ---: | ---: | --- |
| bulk | 100 | 159,001 | 236,619 | +48.82% | yes |
| chained | 100 | 787,814 | 860,086 | +9.17% | yes |
| grouped | 100 | 166,348 | 243,912 | +46.63% | yes |
| replacement | 100 | 1,031,260 | 1,110,196 | +7.65% | yes |
| bindings | 100 | 847,247 | 925,625 | +9.25% | yes |
| modules | 100 | 1,241,644 | 1,330,506 | +7.16% | yes |
| bulk | 500 | 806,601 | 3,055,819 | +278.85% | yes |
| chained | 500 | 13,956,214 | 16,178,486 | +15.92% | yes |
| grouped | 500 | 1,060,372 | 3,309,104 | +212.07% | yes |
| replacement | 500 | 21,767,660 | 24,022,996 | +10.36% | yes |
| bindings | 500 | 12,153,047 | 14,405,425 | +18.53% | yes |
| modules | 500 | 19,719,044 | 19,499,483 | -1.11% | no |

The CLI's first budget failure is `bulk 100`: 236,619 versus 159,001 baseline, +48.82% against the allowed +10%. Six more rows also exceed +10%. The rejected 500-module row is recorded exactly as `failure: "worker rejected the case"` in the JSON; this comparison did not include that worker's diagnostic details.

## S8 100-provider rows

| Scenario | Providers | Instantiations | Milliseconds | Max RSS MiB | Diagnostics | Accepted |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| no-scoped-service | 100 | 236,183 | 1,138 | 365 | `[]`; boundary line 2 | true |
| scoped-service-at-chain-end | 100 | 685,493 | 1,472 | 388 | one TS2684 at generated file line 2, column 52; `root lifetime cannot capture scoped dependency: svc98 -> svc99`; no TS2589 | true |

The negative worker's full diagnostic and both exact JSON rows are preserved in the hashed guard logs above. The marker remained on the builder expression, where TypeScript reported the graph rejection.

## Unrun acceptance checks and decision

The property-location fixture and the controller-authorized `phase-10-s8-ceiling-pair` were not run: the cumulative baseline already failed the adoption gate. Consequently there are no Phase 9/Phase 10 ceiling evidence paths or four-form comparison values to report. The controller explicitly ruled to stop heavy work at this measured rejection and proceed to Task 6; no type-shape repairs or budget adjustments were attempted. Task 5's adoption commit is skipped. The Task 5 generator, worker, test, and this raw evidence record remain uncommitted for Task 6 to own according to its fallback instructions.

Decision: retain scoped by default (S8 fallback) — first failed rule: bulk 100 uses 236,619 instantiations against baseline 159,001, +48.82% over the +10% limit.
