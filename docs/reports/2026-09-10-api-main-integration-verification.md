# API refactor and main integration verification

This integration combines the complete API refactor at `b911776` with main at
`fb5fe6c736fc0c21b32b93dfc9e170c955209bb9`. The original dirty checkout remains
preserved. The [migration guide](../migrations/api-renaming.md) describes the
breaking API; the [decisions](../superpowers/specs/2026-09-10-api-renaming-design.md)
record the integration assumptions. The earlier
[API-only verification](2026-09-10-api-renaming-verification.md) retains its own
source identity and measurements.

## Preserved behavior and review

The combined implementation retains main's persistent graph and module storage,
obsolete-binding release, transient payload collection, cold resolution stack
behavior, linked acquisition ancestry, synchronized process-supervisor checks,
and incremental/completion/synthetic-output compiler caches. Removed `fromTokens`
output caching now belongs to the retained strict `fromFunction` adapter.

`startupOrder` also retains main's numeric scheduling: a positive safe integer
limits selected readiness waits. Provider dependency fanout remains independent.
Cancellation, pending source ownership, cleanup, and raw Promise/thenable identity
keep their existing contracts. Guides and incoming runtime/type fixtures use the
renamed options and methods; historical benchmark sources remain unchanged.

Independent source and consumer review approved the final integration. The
compiler regression found during integration was corrected by deferring unused
named-overload checks with a non-distributive `never` guard. The original two
signatures, order, reflection, and admission checks remain. Review caught an
explicit-interface intersection regression in an earlier guard; a fixture first
reproduced that rejection and then passed with both compilers after correction.
No compiler ceiling or diagnostic expectation was weakened.

## Source identity

The compiler-control source SHA-256 is
`8bbb61a78404699b97d89f852817ef8910103e00d46db83ab4fb3345975f306b`.
It hashes each sorted TypeScript path relative to the `src` directory, followed
by the file bytes.
Source identity excludes generated documentation and the integration commit.

## Final local gates

All gates completed on pinned Node 24.20.0, npm 11.19.0, Bun 1.4.0, classic
TypeScript 6.0.3, and native TypeScript 7.0.2. Subprocess gates ran outside the
restrictive subprocess sandbox with npm update notifications disabled. No source
or assertion was weakened to accommodate sandbox behavior.

| Gate | Result |
| --- | --- |
| `npm run check` | 952 tests passed, 0 failed, 18,980 assertions across 56 files; classic typecheck/build passed. |
| Native typecheck and build | Passed, including the explicit-interface regression. |
| `npm run check:native` | 126 fixtures accepted; all 640 primary and 17 supplemental diagnostics matched, with no gaps or unexpected diagnostics. |
| Node scale and GC retention after each build | 31 tests passed for each compiler build, including cold stack safety, payload collection, graph pruning, and numeric startup. |
| Existing incremental compiler ceilings | All four passed: named additions, replacements, token bindings, installed token modules. |
| Native 1,000-token and 1,000-module contracts | Both passed within the original process limits. |
| All nine runnable examples | Passed. |
| Documentation generation/check/build | 12 tests passed; 104 API pages, 210 valid TypeScript blocks, 112 rendered pages, and 13,877 verified links/anchors/assets. |
| Required platform lanes | Archive, installed Deno root, and minified Chromium Worker passed. |

The platform tools were Deno 2.9.6, esbuild 0.28.2, Playwright 1.63.0, and
Chromium 153.0.8010.12. Full package tests exercised Node/Bun CommonJS and ESM,
physical downstream declarations after deleting producer sources, and release
artifact checks. Documentation was checked again after adding this report.

## Compiler control observations

All 18 supported positive/negative controls passed in serial fresh processes.
Source hashes were identical before and after every execution. These are single
observations without warmups or repetitions, not statistical speedup claims or
an exhaustive scale matrix. The existing limits were unchanged.

| Compiler | Count / form | Case | Compiler ms | Process ms | Peak MiB | Instantiations |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| 6.0.3 | 100 / chained | valid | 1363 | 1643 | 405 | 778508 |
| 6.0.3 | 100 / chained | missing | 1360 | 1633 | 403 | 775033 |
| 6.0.3 | 100 / chained | wrong-shape | 1359 | 1634 | 404 | 784615 |
| 6.0.3 | 1000 / grouped | valid | 2977 | 3271 | 637 | 2418536 |
| 6.0.3 | 1000 / grouped | missing | 2949 | 3240 | 635 | 2394384 |
| 6.0.3 | 1000 / grouped | wrong-shape | 3005 | 3305 | 643 | 2430310 |
| 6.0.3 | 100 / bindings | valid | 1687 | 1953 | 426 | 830927 |
| 6.0.3 | 100 / bindings | missing-final-token | 1674 | 1943 | 426 | 826350 |
| 6.0.3 | 100 / bindings | mismatched-invariant-service | 1666 | 1921 | 427 | 828885 |
| 7.0.2 | 100 / chained | valid | 306 | 363 | 122.09 | 763389 |
| 7.0.2 | 100 / chained | missing | 315 | 368 | 131.85 | 759911 |
| 7.0.2 | 100 / chained | wrong-shape | 323 | 380 | 127.56 | 769945 |
| 7.0.2 | 1000 / grouped | valid | 1167 | 1238 | 237.8 | 2406037 |
| 7.0.2 | 1000 / grouped | missing | 1146 | 1217 | 241.92 | 2381882 |
| 7.0.2 | 1000 / grouped | wrong-shape | 1153 | 1225 | 233.01 | 2418260 |
| 7.0.2 | 100 / bindings | valid | 403 | 472 | 153.46 | 808457 |
| 7.0.2 | 100 / bindings | missing-final-token | 410 | 467 | 146.77 | 803870 |
| 7.0.2 | 100 / bindings | mismatched-invariant-service | 398 | 465 | 158.98 | 806419 |

[Retained sanitized evidence](../benchmarks/results/2026-09-10-api-main-integration/README.md)
contains the diagnostics, source/generated hashes, tool identities, and platform
results. Earlier benchmark evidence remains attributed to its original source.

## Integration status

This report verifies the local integration. Push, pull-request creation, merge to
remote main, and remote CI are not recorded as completed. Registry publication
and version selection remain separate release work.
