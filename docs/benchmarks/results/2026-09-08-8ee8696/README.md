# Runtime baseline evidence at `8ee8696`

These are ordinary-machine informational measurements of commit
`8ee869616229ec54a547c4b980d96fc0c5a4e9ad` against the intrinsic baseline
`739b509eb7942e4e26c972a711d003aaf8769997`. They do not establish a universal
performance claim or a regression verdict.

Both runs built the baseline from `git archive 739b509`. The retained run
headers record commit `739b509eb7942e4e26c972a711d003aaf8769997`, tree
`9630be16dd0280575c6fc097ddaaf046e6280e24`, source-archive SHA-256
`3ba2a8bc772efa0481013d76fc9106e987b674475fdb31990417547b2d6e8b85`,
lockfile SHA-256
`a68e095582633c5b4d58b6fd01a26d982b9e932c4072db94473210dfc89fc4eb`,
and the exact Node, npm, TypeScript, Git, and tar identities.

Each seed covers all seven scenarios at 10 and 100 providers. Each of the 14
rows has five warmups and 31 measured children for each implementation. The
runner alternated current/baseline order within pairs and reversed the pair
orientation on every next pair. It retained every child execution before
validation, then retained the validated summary. No sample was removed.

| Seed | Rows | Measured children | Warmup children | Status |
| ---: | ---: | ---: | ---: | --- |
| 17 | 14 | 868 | 140 | informational |
| 29 | 14 | 868 | 140 | informational |

The two runs are:

- [`runtime-baseline-739b509-seed-17-2026-09-08T10-59-25-027Z.jsonl`](runtime-baseline-739b509-seed-17-2026-09-08T10-59-25-027Z.jsonl)
- [`runtime-baseline-739b509-seed-29-2026-09-08T11-01-28-718Z.jsonl`](runtime-baseline-739b509-seed-29-2026-09-08T11-01-28-718Z.jsonl)

No row met all three review predicates. A controlled runner marker was absent,
so every row remains informational regardless of an individual median, p95, or
confidence-interval value. A possible regression may be named only when all
three predicates hold on a controlled runner and a second distinct-seed run
independently confirms them.
