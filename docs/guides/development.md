# Development and verification

[← Back to the README](../../README.md) · [API reference](api-reference.md)

Build, test and release-candidate workflows, with the limits of the recorded
compiler and performance evidence. Run commands from the repository root.

## Package entry points and release-candidate checks

The package manifest declares two entry points: host-independent `di-bag` and the
Node/Bun native-Promise facade `di-bag/node`. The package has no runtime, peer,
optional, or bundled dependencies. Ordinary factory functions, records,
projections, presence values, and provider metadata cover acquisition boundaries
without a companion package.

Choose `raw` when the exact value, Promise, or thenable is the service. Choose
`native` only for a genuine native Promise whose fulfillment is the service. Use
selected scopes to make sharing and overrides explicit. Lifecycle callbacks are
non-blocking observers, so applications separately await telemetry when needed.
Plugin loading remains application-owned: validation admits the output while an
optional plugin disposer retains ownership of the original acquired value.

`npm ci` installs the locked development toolchain. `npm run check` is the
primary source, runtime, declaration, package, and build
gate. Run `npm run typecheck:native`, `npm run build:native`, and
`npm run check:native` as separate native checks. A release candidate additionally
requires the local, offline archive workflow in [`PUBLISHING.md`](../../PUBLISHING.md).
That workflow records unavailable registry facts rather than claiming a release,
tag, remote commit, publication, or version availability.

```sh
npm ci
npm run platform:pin   # capture the installed foundation tool identities
npm run check          # strict types, runtime/type/package tests, build
npm run check:native   # native 7.0.2 source rejection gate; requires zero message gaps
npm run typecheck:native
npm run build:native
npm run benchmark:types # isolated Node compiler measurements (Node 24+)
npm run benchmark:types -- --native # supervised native named matrix (Linux)
npm run benchmark:types -- --native --tokens # supervised native token matrix (Linux)
node scripts/check-token-scale.ts bindings valid # one isolated 100-token case
npm pack --dry-run    # builds and previews the publication contents
```

CI runs the source, package and both compiler gates on Linux with Node 24.20.0,
npm 11.19.0 and Bun 1.4.0. A separate portable job runs the actual packed root
package in Deno and a minified Chromium Worker. To reproduce that job locally:

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

Tests compile positive usage and each negative fixture independently. Package
smoke tests build the distribution and exercise Node's CommonJS and ESM loaders
and TypeScript's emitted-declaration resolution. Distribution files and type
declarations are emitted to `dist/`.

Classic TypeScript 6.0.3 remains the primary compiler. Native 7.0.2 checks the
source and installed declaration contracts. The strict native audit currently
matches every expected diagnostic, including all replacement diagnostics, with
zero reviewed gaps or unexpected diagnostics. The scale matrices allow no
diagnostic exceptions. The native development tests and
supervised reports currently require Linux. Native reports supervise the actual
Linux executable with a 60-second limit, 3,072 MiB sampled child-RSS threshold,
and 4 MiB combined output cap. These are bounded observations, not universal
scale or editor-latency guarantees. See the
[compiler scalability report](../../docs/reports/2026-09-08-compiler-scalability.md).

Builders accumulate a flat union of registration entries internally; the public
`Bag<R>` type still takes a registration map. Compile-time acceptance tests cover
100 chained additions, 100 replacements, and 1,000 providers assembled from
reusable registration groups and named modules, including missing and
wrong-shaped dependencies. TypeScript 6.0.3 cannot bind an unchanged fluent AST
beyond 550-575 calls under its default stack, so applications at 1,000 providers
must use bulk registration, registration groups of 50, or reusable named
modules. The [compiler benchmark report](../../docs/benchmarks/typescript.md) records
the passing supported routes and retains every failed original fluent row.

## Performance evidence

Runtime measurements are retained as ordinary-machine **informational**
evidence. Two complete, independently ordered runs compare the measured source
at `8ee8696` with the intrinsic `739b509` baseline built from `git archive`.
Neither run met all review predicates, and neither ran on a marked controlled
host, so they establish no universal speed claim. The raw children, statistics,
package identities and limitations are in the
[runtime evidence directory](../../docs/benchmarks/results/2026-09-08-8ee8696/README.md).

Repeated compiler controls are also informational and comparable only when the
compiler and fixture identities match. They cover supported controls and do not
replace the exhaustive matrix or its retained failures. See the
[compiler-control evidence](../../docs/benchmarks/results/2026-09-08-e5456f8/README.md).
Earlier single-observation tables in the
[compiler benchmark history](../../docs/benchmarks/typescript.md) remain explicitly
**historical**.

Optional third-party measurements require a reviewed adapter that passes the
**restricted common-subset throughput** contract for synchronous named graphs,
singleton and transient resolution, and explicit lifecycle. Typed Inject and
Awilix are **unavailable** because neither package is lockfile-pinned. No
third-party timing row or comparison claim exists. The exact status rows and
admission rules are retained in the
[comparator evidence directory](../../docs/benchmarks/results/2026-09-08-ad70a14/README.md).

Current code lives in `src/`. Previous experiments are preserved under
[`docs/history/`](../../docs/history/README.md). The [v0.1 design](../../docs/superpowers/specs/2026-09-06-v0.1-design.md)
and [implementation plan](../../docs/superpowers/plans/2026-09-06-v0.1.md) record the
decisions, including the deferred investigation into Effect-style requirement
inference.
