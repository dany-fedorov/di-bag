# Task 3 report — minified browser bundle and Worker parent

Implementation checkpoint: `7455a34`.

## RED/GREEN evidence

The browser tests were written before the browser exports. The first focused
run failed while loading both test files because
`assertBrowserMetafile` was absent from `scripts/platform-evidence.ts`:

```text
$ bun test tests/platform/browser-worker.test.ts tests/platform-evidence.test.ts
Export named 'assertBrowserMetafile' not found
0 pass, 2 fail, 2 errors
```

The final focused suite exercises malformed esbuild metadata, root-versus-
internal inputs, duplicate real root entries, the Node facade, direct and
external `node:` imports, foreign packages, traversal and symlink provenance.
Artifact mutations cover empty and changed output, wrong output byte and gzip
counts, stale output/metafile hashes, absent or malformed metadata and a wrong
resolved root. Worker mutations cover missing, extra, malformed and wrong-lane
messages, wrong and cyclic results, error events, console output and timeout.
The lane revalidates and executes the same byte array, so a changed file cannot
slip between hash validation and launch.

```text
$ bun test tests/platform/browser-worker.test.ts tests/platform-evidence.test.ts
17 pass
0 fail
147 expect() calls
```

The archive-building suite ran with native child-process access; managed
sandbox interception otherwise suppresses npm and compiler process output.

## Offline tool boundary

The browser entry imports bare `di-bag` plus the shared portable fixture. The
bundler installs only the validated archive offline in a fresh consumer and is
configured for browser IIFE, ES2022, minification, tree shaking, no legal
comments and error-only logging. The metafile and generated bundle stay in
that temporary consumer.

`tools/platform-versions.json` still records esbuild, Playwright and Chromium
as `unavailable: not-provisioned`. Their lanes return or throw the explicit
unavailable result before an archive or browser fallback. No tool was fetched,
no registry package was substituted and no browser runtime pass is claimed.

The implemented Chromium parent is ready for a provisioned exact pin: it loads
the verified Playwright package, launches the verified Chromium executable,
creates a classic Worker from the recorded bytes, waits for one message, keeps
a short extra-message window, terminates the Worker and rejects timeout,
console output or Worker errors.

## Redundant gates

```text
$ npm run typecheck
exit 0
$ npm run typecheck:native
exit 0
$ npm run build
exit 0
$ npm run build:native
exit 0

$ bun test tests/package.test.ts
77 pass
0 fail
495 expect() calls
Ran 77 tests across 1 file. [58.06s]

$ bun test tests/native-package.test.ts
2 pass
0 fail
1,152 expect() calls
Ran 2 tests across 1 file. [155.27s]
```

Task 4 still owns the evidence command, retained result rows and final
documentation matrix.

## Independent review fix round

Review found no Critical issues and four Important false-certification or
supervision gaps. RED probes demonstrated that external `di-bag/node` and URL
imports, a nested `node_modules` dependency, extra message keys, an extra
`undefined` result key and a never-settling driver could pass or hang. The
unavailable test also depended directly on this checkout's manifest, so it
would fail rather than exercise a newly provisioned browser lane.

Metafile validation now rejects every external import, classifies any lexical
`node_modules` segment as a dependency, checks lexical plus resolved node
facades, and requires exactly one output. Worker messages and their nested
portable result use exact own-key/value comparison. The parent starts one
overall deadline before driver setup, aborts on expiry, gives cancellation a
bounded cleanup window and returns a timeout row. Tool-unavailable unit cases
use explicit values, while a conditional integration test builds the isolated
archive and uses real esbuild, Playwright and Chromium whenever all exact pins
are provisioned. On this checkout it records only the manifest's unavailable
state.

The review's two Minor findings were also addressed: gzip bytes now have a
retained and revalidated SHA-256, and default execution checks Playwright
availability before inspecting an artifact, matching the Chromium unavailable
boundary. The final focused counts above supersede the pre-review `16 / 138`
run. Classic/native typechecks and builds all exited zero after these fixes;
package matrices were not repeated because package source and declarations did
not change.
