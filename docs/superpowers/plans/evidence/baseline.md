# Compile-cost baseline: 0.4.0 source

The compile budget of the
[Swift API style program](../2026-09-21-00-swift-api-style-master.md#evidence):
across all phases, the instantiation count of each case below may grow by at
most 10% over this table. Instantiation counts are deterministic. Milliseconds
and memory depend on the host and are recorded for information only.

The table was produced by `node scripts/evidence-cases.mjs` at the unchanged
0.4.0 library source. Each case is one fresh Node process: the named forms run
`scripts/benchmark-types.ts --worker <count> <form> valid`, and `bindings` and
`modules` run `scripts/check-token-scale.ts <form> valid <count>`. The named
worker reports `accepted` itself; for the token worker, accepted means that it
reported no diagnostics.

Compare the current source with this baseline, and fail when a case is over
budget:

```sh
node scripts/evidence-cases.mjs --compare docs/superpowers/plans/evidence/baseline.md
```

Recorded 2026-09-20T22:16:33.698Z at 7b9164d on Linux 7.0.11-76070011-generic, x64, 24 CPUs, 31,689 MiB, Node v24.20.0, TypeScript 6.0.3.

| Case | Count | Instantiations | Milliseconds | Max RSS MiB | Accepted |
| --- | --- | --- | --- | --- | --- |
| bulk | 100 | 159,001 | 1,147 | 365 | yes |
| chained | 100 | 787,814 | 1,637 | 403 | yes |
| grouped | 100 | 166,348 | 1,171 | 367 | yes |
| replacement | 100 | 1,031,260 | 1,534 | 402 | yes |
| bindings | 100 | 847,247 | 1,942 | 432 | yes |
| modules | 100 | 1,241,644 | 2,507 | 550 | yes |
| bulk | 500 | 806,601 | 1,788 | 451 | yes |
| chained | 500 | 13,956,214 | 11,860 | 1,522 | yes |
| grouped | 500 | 1,060,372 | 1,827 | 420 | yes |
| replacement | 500 | 21,767,660 | 12,723 | 2,035 | yes |
| bindings | 500 | 12,153,047 | 11,414 | 1,686 | yes |
| modules | 500 | 19,719,044 | 19,753 | 2,307 | yes |
