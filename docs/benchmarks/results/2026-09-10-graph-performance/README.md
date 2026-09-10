# Persistent graph and module storage evidence

Base: `56e502e125fd29760f03493ea4b16f126edb145e` (includes the independently reviewed acquisition changes). The final source/build hashes are in `manifest-after.json`; the baseline source was verified byte-for-byte against that commit. Both production emits use classic TypeScript 6.0.3 / native 7.0.2. No acquisition code or public type contracts changed.

All measurements use serial fresh Node 24.20.0 workers, default stack, `--expose-gc --max-old-space-size=512`, and `timeout 30s`. Counts are 100 / 1,000 / 5,000, with three samples for each compiler. Construction time is recorded before explicit GC; retained heap is a separate forced-GC delta. `retained-versions` intentionally retains prior graphs and is separate from current-only memory controls. Original scenarios use an unchanged byte copy of the original audit probe.

Final paired graph data: `commands-{before,after}.jsonl`, `rows-{before,after}.jsonl`, `summary-{before,after}.json`. Module data: `module-commands.jsonl`, `module-commands-after.jsonl`, corresponding rows and summaries. Every command preserves argv, status, stdout and stderr. Summary metrics include min/median/max. The six baseline 5,000-version workers fail with V8 heap exhaustion at the 512 MiB limit (recorded status 1); there are no timeouts. Every other baseline worker and every final worker succeeds.

## Classic medians at 5,000

| Scenario | Metric | Before | Final |
| --- | --- | ---: | ---: |
| build-incremental | incrementalMs | 2,001.839 | 29.253 |
| build-incremental | bulkMs | 3.686 | 11.117 |
| build-incremental | retainedHeapBytes | 2,908,488.000 | 3,385,968.000 |
| replace-history | incrementalMs | 1,187.320 | 19.881 |
| replace-history | retainedHeapBytes | 4,407,128.000 | 403,272.000 |
| scope-override | overrideMs | 107.346 | 1.478 |
| module-install | installMs | 11.111 | 20.603 |
| module-install | retainedHeapBytes | 1,726,112.000 | 1,716,856.000 |
| warm-proxy | proxyMs | 1.885 | 1.425 |
| warm-proxy | directMs | 0.644 | 0.787 |
| bulk-strings | elapsedMs | 5.290 | 12.195 |
| bulk-strings | retainedHeapBytes | 2,643,024.000 | 3,141,848.000 |
| bulk-tokens | elapsedMs | 5.948 | 13.524 |
| bulk-tokens | retainedHeapBytes | 2,797,688.000 | 3,708,408.000 |
| incremental-strings | elapsedMs | 1,912.687 | 21.803 |
| incremental-strings | retainedHeapBytes | 2,708,944.000 | 3,196,032.000 |
| incremental-tokens | elapsedMs | 1,854.798 | 14.887 |
| incremental-tokens | retainedHeapBytes | 2,863,112.000 | 3,771,336.000 |
| replacement-memory | elapsedMs | 1,229.269 | 22.659 |
| replacement-memory | retainedHeapBytes | 14,831,936.000 | 363,984.000 |
| contribution-append | elapsedMs | 1,217.769 | 15.232 |
| contribution-append | retainedHeapBytes | 2,846,920.000 | 3,359,776.000 |
| contribution-cached-memory | elapsedMs | 1,212.658 | 200.245 |
| contribution-cached-memory | retainedHeapBytes | 2,847,048.000 | 3,368,072.000 |
| retained-versions | elapsedMs | heap exhaustion | 26.463 |
| retained-versions | retainedHeapBytes | heap exhaustion | 9,471,624.000 |

Module local construction (measured through `exports`, before installation):

| Compiler | Scenario | Before ms | Final ms |
| --- | --- | ---: | ---: |
| classic | module-local-incremental | 1730.209 | 24.524 |
| native | module-local-incremental | 1720.547 | 22.615 |
| classic | module-local-contribution | 24.840 | 8.889 |
| native | module-local-contribution | 24.519 | 6.207 |

## Warm-read tradeoff

The original 10,000-read probe is retained above. The additional `hot-probe.mjs` warms both paths 100,000 times before measuring 500,000 reads. It asserts the returned values in both implementations. `hot-commands.jsonl` and `hot-summary.json` retain the fully warmed controls, so the shorter original probe does not conceal steady lookup overhead.

| Compiler | Count | Before direct ms | Final direct ms | Before proxy ms | Final proxy ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| classic | 100 | 20.868 | 24.532 | 42.681 | 44.449 |
| native | 100 | 21.918 | 24.929 | 41.478 | 44.219 |
| classic | 1000 | 28.478 | 29.167 | 43.062 | 45.719 |
| native | 1000 | 22.569 | 23.496 | 40.577 | 42.493 |
| classic | 5000 | 19.321 | 24.618 | 39.486 | 42.811 |
| native | 5000 | 25.210 | 21.927 | 44.664 | 43.554 |

The refreshed steady controls show -13.0–27.4% direct-read and -2.5–8.4% proxy-read changes across these samples. At 5,000 the classic increase is about 10.6 ns/direct read and 6.7 ns/proxy read. Bulk construction and one-shot module installation are also slower; a current unique live graph retains more memory because trie nodes and symbol-hash storage replace compact native tables. These are measured tradeoffs, not claims of parity. Incremental construction, repeated overrides, replacement payload retention, contribution append and intentionally retained prior versions improve substantially.

## Retention and compatibility

- Local/well-known symbol hashes use a process-global WeakMap only; registered symbols hash their registry strings. There is no global strong index of collectible symbols. True hash collisions compare full string/symbol identity. The real hosts Node 24.20.0, Bun 1.4.2, Deno 2.9.6 and Chromium 153.0.8010.12 passed the controller-provided capability smoke, copied here with its raw output. This is capability evidence, not a claim that this task reran full portable integration.
- A VM-based emitted regression simulates a host rejecting weak symbol keys and exercises lookup, replacement, deletion and earlier-version identity. The fallback hashes local symbol descriptions and remains correct but can be quadratic for many same-description symbols; that fallback is not used by the tested hosts.
- Lexical input snapshots are scanned once, with separate snapshot-user/private-ID counts. Removing the last live snapshot releases former-public targets iteratively. Constructor-only private registrations remain for preflight. Still-referenced cycles and intentionally retained old builders remain live; no general private-cycle garbage collector is claimed.
- Per-graph native caches contain only graph-owned keys and are not inherited by derived graphs. Contribution append shares cache-free sequence nodes; older materialized arrays are collectible. Node WeakRef/GC regressions prove obsolete factory/payload/ID release, ancestor-cache release, old contribution-array release and private-protection release.
- Module builders reuse the same storage primitives and keep a separate persistent insertion-order sequence. Replacements keep their positions; exports materialize native snapshots once. Public module signatures are unchanged (only new private methods appear in the declaration diff).

## Verification and prior experiments

Final: 384 runtime-only Bun tests, 15,013 assertions, zero failures; both full typechecks and both builds pass; 27 Node regressions pass after each emitter. The CI commands include the new graph GC regression file for both emitters. `runtime-tests.log`, `typecheck*.log`, `build*.log`, and `node-{classic,native}-green.log` retain output.

Expected RED logs are `graph-red.log` (obsolete public IDs), `retention-red.log` (300 old factory/payload/ID weak targets), `live-private-red.log` (last-user and cascade pruning), and `module-red.log` (one module update revisits 2,001 existing native-map entries). Initial typecheck logs preserve finite-key/token test-fixture errors. `runtime-initial.log` catches an input getter read twice; the code now consults the frozen snapshot. `node-private-gc-context-failure.log` preserves a test-fixture false positive caused by replacement closures sharing the old payload lexical context; replacements were moved out of that context, and production code was unchanged for that correction. `node-intermediate.log` is an intermediate emit check, not final evidence.

`initial-after/` preserves the first after graph/module rows and warmed-read regression, including its exact runtime source snapshot verified against its manifest hash. Other source files are identical to the final files. The cache refinement experiment has `hot-cache-focused.jsonl`, `hot-cache-manifest.json`, and `hot-cache-runtime.ts.snapshot`. Final after rows were rerun in full after the cache changes. Including archived initial-after, focused cache, and final passes there were 894 timed workers before the scoped-review fix, with only the six baseline heap-exhaustion failures. Probe hashes and final test/workflow identities are in `evidence-identity.json`.

Run `python3 run.py before` / `after`, `python3 run-module.py`, `python3 run-module-after.py`, and `python3 run-hot.py` from this directory or the repository. The saved build paths in manifests must exist; recreate them with the recorded source and compiler versions when reproducing on another host.

Scoped-review fix: contribution construction now freezes caller IDs once and uses that exact array for storage and pruning protection. `review-fix-red.log` records the getter being read twice and the contributed target being pruned; `review-fix-green.log` records 56 covering tests passing. `pre-review-fix/` preserves the prior final measurement rows, manifests, logs and exact runtime source snapshot. All 306 refreshed workers pass; including previous phases there are now 1,200 actual timed workers, with the same six historical baseline heap failures. The original baseline artifacts are unchanged. `review-fix-identity.json` identifies fix base, new source/builds and the archived source.
