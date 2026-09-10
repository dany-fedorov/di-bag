# Development and verification

[← Back to the README](../../README.md) · [API reference](api-reference.md)

Build, test, and release-candidate workflows, with links to the recorded compiler
and performance evidence. Run commands from the repository root. The
[CI workflow](../../.github/workflows/ci.yml) pins Node 24.20.0, npm 11.19.0, and
Bun 1.4.0; use those versions to reproduce its checks.

## Package entry points and release-candidate checks

The package has two entry points: portable `di-bag` and the Node/Bun facade
`di-bag/node`. It has no runtime, peer, optional, or bundled dependencies.
The [tutorial](tutorial.md) explains acquisition modes, provider metadata,
selected scopes, non-blocking observers, and plugin ownership of the
original acquired value.

`npm ci` installs the locked development toolchain. `npm run check` is the
primary source, runtime, declaration, package, and build
gate. Run `npm run typecheck:native`, `npm run build:native`, and
`npm run check:native` as separate native checks. A release candidate additionally
requires the local, offline archive workflow in [`PUBLISHING.md`](../../PUBLISHING.md).
Passing local checks establishes a release candidate, not a registry publication.

```sh
npm ci
npm run platform:pin   # capture the installed foundation tool identities
npm run check          # strict types, runtime/type/package tests, build
npm run check:native   # native 7.0.2 source rejection gate; requires zero message gaps
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
Chromium Worker. To reproduce that job locally:

```sh
npm ci
npm ci --prefix tools/platform --no-audit --no-fund
export PLAYWRIGHT_BROWSERS_PATH="$PWD/tools/platform/.browsers"
node tools/platform/node_modules/playwright/cli.js install chromium
npm run platform:pin -- --all
npm run check:platform
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
portable tools. CI configuration is separate from evidence that a run passed.
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
matches every expected diagnostic, including all replacement diagnostics, with
zero reviewed gaps or unexpected diagnostics. The scale matrices allow no
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
wrong-shaped dependencies. For applications at 1,000 providers, bulk registration,
registration groups of 50, or reusable named modules keep expressions manageable.
Classic TypeScript 6.0.3 still overflows on the recorded 1,000-call named
registration and replacement expressions. The later follow-up accepts the
original 1,000-operation token binding and module cases on both compilers, and
all four forms on native 7.0.2. These are measured cases with fixed limits, not a
promise about every application or editor session. The
[compiler benchmark guide](../benchmarks/typescript.md) distinguishes the latest
results from earlier matrices and links every retained failure.

Run the informational matrices separately from the main checks:

```sh
npm run benchmark:types
npm run benchmark:types -- --tokens
npm run benchmark:types -- --native
npm run benchmark:types -- --native --tokens
npm run benchmark:compiler-controls
```

A benchmark command can finish successfully while recording failed cases; read
its acceptance summary. Timings are not test pass criteria.

## Performance evidence

Measurements compare specific revisions and workloads on the recorded host.
They establish neither universal latency guarantees nor a ranking against other
libraries. The [September 10 performance report](../reports/2026-09-10-performance-completion.md)
records improvements to graph updates, module installation, dependency reads,
cleanup, and borrowed-value retention. It also records costs that increased,
remaining deep-resolution limits, and metadata retained until a scope closes.
Its linked follow-ups retain their own source identities.

The [earlier runtime runs](../benchmarks/results/2026-09-08-8ee8696/README.md) and
[compiler controls](../benchmarks/results/2026-09-08-e5456f8/README.md) remain
historical evidence. Later measurements do not turn earlier failures into passes.

Optional third-party measurements require a reviewed adapter that passes the
**restricted common-subset throughput** contract for synchronous named graphs,
singleton and transient resolution, and explicit lifecycle. Typed Inject and
Awilix were **unavailable in that collection** because neither package was
lockfile-pinned. The repository has no verified third-party timing comparison.
The exact status rows and
admission rules are retained in the
[comparator evidence directory](../../docs/benchmarks/results/2026-09-08-ad70a14/README.md).

Current code lives in `src/`. The [documentation map](../README.md) separates
current guides from historical experiments, design decisions, and reports.
