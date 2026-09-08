# Platform compatibility design

**Status:** proposed implementation design, 2026-09-08.

## Decision

Treat portability as an executable property of a freshly packed `di-bag`
archive. Retain the existing strong Node/Bun archive matrix and add three
missing target lanes: Deno 2 root-package execution, browser bundling, and a
minified browser Worker execution. Every new lane consumes the same archive;
none may import `src`, an existing `dist`, a published package, or a registry
URL.

`di-bag` root is the portable boundary. `di-bag/node` deliberately imports
`node:util/types`, so it is excluded from Deno/browser support and is covered
by the existing Node/Bun archive suite.

## Evidence contract

The implementation will add `tools/platform-versions.json` containing exact
Node `24.20.0`, the Node-derived npm CLI, the TypeScript 6 `tsc6` program, Bun
`1.4.0`, Deno 2 patch, esbuild patch, Playwright patch and Chromium
revision/executable identities selected by the initial RED probes. Each entry
includes absolute invocation argv, expected `--version` text and SHA-256 of the
invoked executable or script. A runner resolves, probes and then uses that
exact argv. The archive build is exactly `nodePath compilerScript -p
tsconfig.build.json`; packing and offline installation are exactly `nodePath
npmCli pack --ignore-scripts --json` and `nodePath npmCli install --offline
--ignore-scripts --no-audit --no-fund --no-package-lock archivePath`. It never
downloads a tool. A missing, wrong-version or wrong-hash tool yields the
explicit `unavailable` status; it is never converted into `pass`, `skip`, or a
network fallback.

The runner writes sorted-key JSON Lines under
`docs/benchmarks/results/<UTC-date>-<short-sha>/platform.jsonl`, plus a compact
Markdown index in that directory. Temporary packed archives and bundles live
only in a unique temporary directory. Every row records schema, lane, status,
UTC time, full Git SHA/dirty state, machine facts without home paths or ambient
environment, lockfile/source/tarball hashes, command argv/cwd, stdout/stderr
hashes, elapsed time, and checked assertion data. Child success requires exit
zero, empty stderr, one canonical JSON object, expected lane ID and exact
portable-contract result. Child output alone cannot certify a lane.

Historical facts must remain labelled: the committed Node/Bun classic6/native7
archive result and the `720 tests / 3,830 assertions` report are prior
execution records, not new evidence for a dirty checkout. Existing `dist/` is
untracked, therefore all archive work builds an isolated copied tree first.

## Required matrix

| Lane | Artifact and execution | Required result |
| --- | --- | --- |
| archive | isolated classic TypeScript 6 build then `npm pack --ignore-scripts --json` | copied package tree includes `src`, `package.json`, `tsconfig.json`, `tsconfig.build.json`, `README.md` and `LICENSE`; exactly one archive contains those package documents plus all declared root/node/sas-box/val-box exports; hashes are retained |
| Node/Bun | existing `tests/native-package.test.ts` classic6/native7 CJS/ESM matrix | keep as required archive regression gate; do not replace it with source smoke tests |
| Deno root | offline local installation of the archive in a fresh consumer and bare `import { DiBag } from 'di-bag'` | pinned Deno returns the exact portable result and resolves inside local `node_modules/di-bag` |
| browser bundle | installed root package bundled by pinned esbuild with browser/IIFE/ES2022/minify/tree-shaking/no legal comments | metafile has exactly one local package root entry, `node_modules/di-bag/dist/index.js`; it may include package-local `dist` dependencies, but has no `node:` input, `dist/node.js`, or package input outside that installed tarball; nonempty bundle and gzip hashes/bytes are retained |
| browser Worker | the recorded minified bundle executes as a classic Worker in pinned Chromium | Worker returns the exact portable result; a stale or hash-mismatched bundle fails |

The initial Deno RED probe decides the committed local configuration
(`nodeModulesDir`, import map, or neither). It may not use `npm:di-bag`, a
published version, a relative source path, or a registry request. Chromium
provisioning belongs to a separate CI setup job; a CI YAML declaration is not
execution evidence.

## Portable contract

`tests/platform/portable/contract.ts` is pure public-root fixture code. It
returns plain JSON and contains no host error messages, clocks or timers. A
Node control test, Deno consumer and browser Worker share its complete fixture
tree: the parent recursively copies `tests/platform/portable/` plus the target
entry/configuration files into each fresh archive consumer before
execution/bundling. The Deno consumer resolves `di-bag` by bare specifier and
emits the canonical real path; the parent requires that path to be inside that
consumer's `node_modules/di-bag`. The browser parent resolves every metafile
input and requires the sole `di-bag` root input to be inside that same local
package path before it launches the Worker. The canonical result proves: private-module helper and
canonical alias identity; root/scoped/transient lifetime identity;
child-before-root cleanup order; `raw` Promise identity through disposer; and
frozen inspection/metadata snapshots. It does not test native Promise subclass
or foreign-realm classification, which requires `di-bag/node` and stays in the
Node/Bun archive suite.

## Gate policy and documentation

Archive integrity and an available lane's exact contract are required. Deno and
browser are required once their exact pinned tools are provisioned; otherwise
their evidence is `unavailable` and documentation says so. Bundle byte counts
are informational until two clean baseline runs establish a reviewed budget.
README wording may say browser/Deno support only after retained successful rows
exist, and may never extend that claim to `di-bag/node`.
