# Development and verification

[← Back to the README](../../README.md) · [API reference](api-reference.md)

Build, test, and release-candidate workflows, with the compiler and performance
limits that the checks enforce. Run commands from the repository root. The
[CI workflow](../../.github/workflows/ci.yml) pins Node 24.20.0, npm 11.19.0, and
Bun 1.4.0; use those versions to reproduce its checks.

## Package entry points and release-candidate checks

The package has two entry points: `di-bag`, which classifies native Promises
through `process.getBuiltinModule` where the host has it and has no `node:`
imports, and the explicit Node/Bun facade `di-bag/node`. It has no runtime,
peer, optional, or bundled dependencies.
The [tutorial](tutorial.md) explains acquisition modes, provider metadata,
selected scopes, non-blocking observers, and plugin ownership of the
original acquired value.

`npm ci` installs the locked development toolchain. `npm run check` is the
primary source, runtime, declaration, package, and build
gate. Run `npm run typecheck:native`, `npm run build:native`, and
`npm run check:native` as separate native checks. A release candidate additionally
requires the local, offline archive workflow in [`PUBLISHING.md`](../../PUBLISHING.md).
Passing local checks establishes a release candidate, not a registry publication.

`npm test` runs two lanes. `npm run test:fast` covers the runtime suites and
finishes in a few seconds; run it after every source change.
`tests/react/` holds the React recipe's owner and composition tests; they run in the fast lane without React.
`npm run test:compiler` covers the compiler, package, native, platform, and
benchmark suites; run it before committing. `scripts/test-lane.mjs` holds the
single list that assigns files to lanes. Compiler-driven tests share one
TypeScript program through `tests/compiler.ts`, so a fixture's diagnostics cover
that fixture and the other test files it imports; `npm run typecheck` covers `src/`.

`npm run graph:check` tests the standalone `di-bag-graph` tool in `tools/graph`
(`npm ci --prefix tools/graph` first). The tool depends on the TypeScript
compiler, so it is published as its own package; see [PUBLISHING.md](../../PUBLISHING.md#releasing-di-bag-graph).

`npm run codemod:check` tests the standalone `di-bag-codemod` tool in
`tools/codemod` (`npm ci --prefix tools/codemod` first). Its fixtures type-check
against the published 0.4.0 declarations, vendored under
`tools/codemod/test/fixtures/node_modules/di-bag`; do not edit them.

```sh
npm ci
npm run platform:pin   # capture the installed foundation tool identities
npm run check          # strict types, runtime/type/package tests, build
npm run check:native   # native 7.0.2 source rejection gate; only declared message gaps pass
npm run typecheck:native
npm run build:native
npm pack --dry-run    # builds and previews the publication contents
```

For Markdown or API-comment changes, also run the documentation checks:

```sh
npm ci --prefix tools/docs
npm run docs:check
npm run docs:build
```

After changing public API comments, run `npm run docs:generate` before checking.
See [documentation maintenance](documentation.md) for the preview workflow.

## Portable runtime checks

A separate CI job runs the actual packed root package in Deno and a minified
Chromium Worker, and the React example in a Chromium page. To reproduce that job locally:

```sh
npm ci
npm ci --prefix tools/platform --no-audit --no-fund
export PLAYWRIGHT_BROWSERS_PATH="$PWD/tools/platform/.browsers"
node tools/platform/node_modules/playwright/cli.js install chromium
npm run platform:pin -- --all
npm run check:platform
npm run check:react-browser
```

On Linux hosts missing browser system libraries, use Playwright's
[`install --with-deps chromium`](https://playwright.dev/docs/browsers#install-system-dependencies).
`platform:pin` without `--all` captures only the foundation tools. Pinning never
downloads tools: it validates installed versions and writes version-probe entry hashes
to ignored `tools/platform-versions.local.json`. A local manifest takes precedence
over the historical machine-specific manifest; an invalid one fails explicitly.
The private platform tools have their own lockfile and are excluded from the
published package. `check:platform` requires all three lanes to pass, while
`evidence:platform` remains an informational collector that can record unavailable
portable tools. `check:react-browser` bundles `examples/react` with the pinned
esbuild and runs it in the pinned Chromium in development and production builds,
writing `react-browser.jsonl` next to the platform evidence; both rows must pass. CI configuration is separate from evidence that a run passed.
Evidence also records the platform lockfile hash. A script tool's entry hash
identifies its version-probe wrapper, not every transitive driver/compiler file;
use the locked `npm ci` installation when reproducing the run.

## Compiler checks and scale

Tests compile positive usage and each negative fixture independently. Package
smoke tests build the distribution and exercise Node's CommonJS and ESM loaders
and TypeScript's emitted-declaration resolution. Distribution files and type
declarations are emitted to `dist/`.

Classic TypeScript 6.0.3 remains the primary compiler. Native 7.0.2 checks the
source and installed declaration contracts. The strict native audit currently
matches every expected diagnostic, including all replacement diagnostics, with no
unexpected diagnostics and one reviewed gap: native 7.0.2 rejects a contextual
`fromFactory` that returns a structural thenable, but reports the last overload's
arity error instead of the thenable message. Gaps are declared in
`tests/native-diagnostic-markers.ts` with the exact native message. The scale matrices allow no
diagnostic exceptions. The native development tests and
supervised reports require Linux. Native reports supervise the actual
Linux executable with a 60-second limit, 3,072 MiB sampled child-RSS threshold,
and 4 MiB combined output cap. These are bounded observations, not universal
scale or editor-latency guarantees. See the
[compiler benchmark guide](../benchmarks/typescript.md).

Builders accumulate a flat union of registration entries internally; the public
`Bag<R>` type still takes a registration map. Compile-time acceptance tests cover
100 chained additions, 100 replacements, and 1,000 providers assembled from
reusable registration groups and named modules, including missing and
wrong-shaped dependencies. One fluent expression is bounded by the compiler's
recursion budget on V8's default stack: on the recorded host, classic 6.0.3
accepts a 1,000-call chain and overflows at 1,015 calls, one step below a
library-free chain (accepted at 1,015, overflowing at 1,031); a bulk map
followed by individual replacements is accepted at 952, exceeded the
60-second budget once in three runs at 968, and overflows at 1,000.
Native 7.0.2 has no stack ceiling. Budget 500 calls per expression; for
applications at 1,000 providers, bulk registration or registration groups of 50 check in about 3.5 s
and 0.6 GiB on classic, and named modules of 50 in about 15.5 s and 3 GiB.
These are measured brackets with fixed limits, not a promise about every
application or editor session. The
[compiler benchmark guide](../benchmarks/typescript.md) records the measured
limits, the ceiling search, and the benchmark commands.

Run the informational matrices separately from the main checks:

```sh
npm run benchmark:types
npm run benchmark:types -- --tokens
npm run benchmark:types -- --native
npm run benchmark:types -- --native --tokens
npm run benchmark:compiler-controls
npm run benchmark:compiler-ceiling
```

A benchmark command can finish successfully while recording failed cases; read
its acceptance summary. Timings are not test pass criteria.

## Performance evidence

Measurements compare specific revisions and workloads on the recorded host.
They establish neither universal latency guarantees nor a ranking against other
libraries. `npm run benchmark:runtime` measures the current source, and CI runs
the runtime-scale, acquisition-retention, and graph-retention tests with
`--expose-gc` to bound memory. Known limits: deep resolution chains stay within
fixed bounds, and per-acquisition metadata is retained until its scope closes.

Optional third-party measurements require a reviewed adapter that passes the
**restricted common-subset throughput** contract for synchronous named graphs,
singleton and transient resolution, and explicit lifecycle. The repository has
no verified third-party timing comparison.

Current code lives in `src/`. The [documentation map](../README.md) lists every
guide.
