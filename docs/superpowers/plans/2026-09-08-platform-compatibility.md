# Platform compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce reproducible, packed-artifact evidence for Deno root imports and minified browser Worker execution while retaining the existing Node/Bun archive gate.

**Architecture:** `scripts/platform-evidence.ts` owns tool verification, isolated packaging, canonical child evaluation and JSONL output. Pure portable-contract code is built into a fresh installed archive consumer for Deno and into the same archive's browser bundle for Chromium; the parent evaluates each result rather than trusting a child exit code.

**Tech Stack:** TypeScript 6, Node 24.20.0, npm pack/offline install, Bun 1.4.0 existing archive tests, pinned Deno 2, esbuild, Playwright Chromium, Bun test.

**Spec:** `docs/superpowers/specs/2026-09-08-platform-compatibility-design.md`

## Global Constraints

- Test only an archive built from an isolated copied package tree; never `src`, worktree `dist`, `npm:di-bag`, registry URLs or a published package.
- Pin absolute invocation argv, version text and executable/script SHA-256 for Node, npm CLI, TypeScript 6 `tsc6`, Bun, Deno, esbuild, Playwright and Chromium in `tools/platform-versions.json`; normal lanes never download a tool.
- Scope Deno/browser claims to the root export; `di-bag/node` remains Node/Bun-only.
- Treat missing/mismatched pinned tools as retained `unavailable` evidence, never pass or a fallback.
- Require exit 0, empty stderr, one exact child JSON object, expected lane identity and expected portable-contract data before a pass.
- Write sorted-key JSONL and human summary under `docs/benchmarks/results/<UTC-date>-<short-sha>/`; do not commit binary bundles or temporary archives.
- Historical Node/Bun results and prior test counts remain explicitly historical until a new row is executed.
- Keep the existing Node/Bun archive suite, type checks and full package checks as redundant gates.

### Task 1: Tool manifest and evidence primitives

**Files:** Create `tools/platform-versions.json`, `scripts/platform-evidence.ts`, `tests/platform-evidence.test.ts`; modify `package.json`, `package-lock.json`.

**Interfaces:** Produce `PlatformTool`, `PlatformEnvironment`, `PlatformRow`, `verifyTool(root, name): Promise<VerifiedTool | { status: 'unavailable'; reason: string }>`; `packIsolatedClassic(root, node, npm, classic6): Promise<PackedArchive>`; `evaluatePlatformChild(expected, supervised): PlatformAssertion`; `writePlatformEvidence(root, row): Promise<string>`. `PlatformRow.status` is exactly `'pass' | 'fail' | 'unavailable'`.

- [ ] **Step 1: Write failing unit tests for tool identity and hostile child output.**

```ts
test('rejects version drift, hash drift, stderr and noncanonical child JSON', async () => {
  expect(await evaluatePlatformChild(expected, { status: 0, signal: null, stderr: '', stdout: '{"lane":"deno","ok":true}\nnoise' }))
    .toMatchObject({ status: 'fail', reason: 'child stdout is not one canonical JSON object' });
  expect(await verifyTool(root, 'deno')).toMatchObject({ status: 'unavailable' });
});
```

- [ ] **Step 2: Run the focused RED test.**

Run: `bun test tests/platform-evidence.test.ts`

Expected: FAIL because `scripts/platform-evidence.ts` and its exported functions do not exist.

- [ ] **Step 3: Add the exact manifest and minimal verifier/evaluator.**

```ts
type ToolPin =
  | { status: 'pinned'; argv: readonly [string, ...string[]]; versionArgv: readonly [string, ...string[]]; version: string; versionText: string; sha256: string }
  | { status: 'unavailable'; reason: 'not-provisioned' | 'version-mismatch' | 'hash-mismatch' };
type PlatformVersions = { schema: 1; node: ToolPin; npm: ToolPin; classic6: ToolPin; bun: ToolPin; deno: ToolPin; esbuild: ToolPin; playwright: ToolPin; chromium: ToolPin };
```

The initial non-network probe creates a `pinned` entry only after it has exact argv, version text and SHA-256; otherwise it writes the explicit `unavailable` union arm. Resolve `npmCli` with `realpath(join(dirname(node.argv[0]), 'npm'))`; pin it as `argv: [node.argv[0], npmCli]` and hash `npmCli`. Resolve classic6 as `realpath(join(root, 'node_modules/typescript/bin/tsc6'))`; pin it as `argv: [node.argv[0], classic6]` and hash that script. Implement the reader to reject incomplete pinned identity, run `versionArgv`, compare exact stdout, and return `unavailable` before spawning a lane. `packIsolatedClassic` copies `src`, `package.json`, `tsconfig.json`, `tsconfig.build.json`, `README.md` and `LICENSE` into `mkdtempSync(join(tmpdir(), 'di-bag-platform-'))`; invokes `[node.argv[0], classic6, '-p', 'tsconfig.build.json']`; then invokes `[node.argv[0], npmCli, 'pack', '--ignore-scripts', '--json']` and validates exactly one archive, its package documents and all declared export files.

- [ ] **Step 4: Make the test pass and add archive mutation coverage.**

Run: `bun test tests/platform-evidence.test.ts`

Expected: PASS; include mutations for multiple tarballs, missing `dist/index.js`, `dist/node.js`, `dist/sas-box.js`, `dist/val-box.js`, wrong hash, unexpected stderr and lane-ID mismatch.

- [ ] **Step 5: Add pinned development dependencies after recording actual RED-probe versions.**

In `package.json`, add exact (no range) `esbuild` and `playwright` dev dependencies chosen by the pinned-tool provisioning policy, regenerate `package-lock.json`, and update their manifest entries with the exact version text and SHA-256. Do not use this operation to download Chromium during tests.

- [ ] **Step 6: Run redundant foundation gates.**

Run: `bun test tests/platform-evidence.test.ts && npm run typecheck && npm run build && bun test tests/native-package.test.ts`

Expected: focused evidence tests, classic type/build and existing real Node/Bun archive matrix all pass. If Bun/Node tools are absent, record the actual unavailable reason; do not claim this gate passed.

### Task 2: Portable contract and archive-installed Deno consumer

**Files:** Create `tests/platform/portable/contract.ts`, `tests/platform/deno-consumer.ts`, `tests/platform/deno.json`, `tests/platform-deno.test.ts`; modify `scripts/platform-evidence.ts`, `README.md`.

**Interfaces:** Produce `portableContract(DiBag: PortableDiBag): Promise<PortableContractResult>` from `tests/platform/portable/contract.ts`, where `PortableContractResult` is `{ aliasCanonical: true; rootOnce: true; scopedOnce: true; transientDistinct: true; cleanupLog: readonly ['scoped', 'transient-2', 'transient-1', 'root']; rawPromiseIdentity: true; rawDisposerIdentity: true; inspectionFrozen: true; metadataFrozen: true }`; `PortableDiBag` is the minimal public root static surface used by the fixture. Produce `runDenoLane(archive, tool): Promise<PlatformRow>`.

- [ ] **Step 1: Write a Node control test for the exact portable result.**

```ts
test('portable root contract has host-independent semantics', async () => {
  await expect(portableContract(DiBag)).resolves.toEqual({
    aliasCanonical: true, rootOnce: true, scopedOnce: true, transientDistinct: true,
    cleanupLog: ['scoped', 'transient-2', 'transient-1', 'root'], rawPromiseIdentity: true,
    rawDisposerIdentity: true, inspectionFrozen: true, metadataFrozen: true,
  });
});
```

- [ ] **Step 2: Run the RED test.**

Run: `bun test tests/platform-deno.test.ts`

Expected: FAIL because `tests/platform/portable/contract.ts` does not exist.

- [ ] **Step 3: Implement the pure fixture and consumer.**

Build the complete portable fixture tree with one private helper/exported token, a string alias, root/scoped/transient owned providers and an explicit `DiBag.factory(() => rawPromise, { acquisition: 'raw' })` provider wrapped by `DiBag.withDisposal`. It must await close, compare the original raw object passed to its disposer, and return only the exact data shape above. `deno-consumer.ts` imports `DiBag` from bare `'di-bag'`, imports `portableContract` from `./portable/contract.ts`, resolves `import.meta.resolve('di-bag')`, and prints exactly `JSON.stringify({ lane: 'deno-root', resolvedDiBag, result })` once.

- [ ] **Step 4: Establish and freeze Deno local-package resolution with one RED probe.**

Run: `bun test tests/platform-deno.test.ts`

Expected: the first run may FAIL only with a documented local-resolution error. Change only `tests/platform/deno.json`, which is copied as `consumer/deno.json`, to establish the needed `node_modules/di-bag` configuration; rerun until its resolved module is inside `consumer/node_modules/di-bag`. Do not substitute a source or registry import.

- [ ] **Step 5: Implement Deno lane parent validation.**

`runDenoLane` uses `[node.argv[0], npmCli, 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', archive.path]` in a fresh consumer, recursively copies `tests/platform/portable/` to `consumer/portable/`, copies `tests/platform/deno-consumer.ts` and `tests/platform/deno.json` to `consumer/`, then invokes the verified Deno executable with `run --node-modules-dir=manual --allow-read deno-consumer.ts`. Validate exact stdout, empty stderr, local resolution and result; `fileURLToPath(resolvedDiBag)` must begin with `realpath(consumer/node_modules/di-bag) + sep`. Write a `deno-root` row even when the tool is unavailable.

- [ ] **Step 6: Run focused and package gates.**

Run: `bun test tests/platform-deno.test.ts tests/platform-evidence.test.ts && bun test tests/package.test.ts tests/native-package.test.ts`

Expected: contract and Deno lane pass when pinned Deno is provisioned; otherwise Deno reports `unavailable` while Node/Bun package gates still pass.

### Task 3: Minified browser bundle and Worker execution

**Files:** Create `tests/platform/browser-entry.ts`, `tests/platform/browser-worker.test.ts`; modify `scripts/platform-evidence.ts`, `tests/platform-evidence.test.ts`.

**Interfaces:** Produce `bundleBrowserRoot(archive, esbuild): Promise<{ path: string; sha256: string; bytes: number; gzipBytes: number; metafileSha256: string; resolvedDiBag: string }>` and `runBrowserWorkerLane(bundle, chromium): Promise<PlatformRow>`. Browser entry must `postMessage({ lane: 'browser-worker-minified', result })` and no other messages.

- [ ] **Step 1: Write failing bundle/Worker tests.**

```ts
test('rejects node facade input and stale minified bundle', async () => {
  expect(() => assertBrowserMetafile({ inputs: { 'node_modules/di-bag/dist/node.js': {} } })).toThrow('node facade');
  await expect(runBrowserWorkerLane({ ...bundle, sha256: '0'.repeat(64) }, chromium)).resolves
    .toMatchObject({ status: 'fail', reason: 'bundle SHA-256 mismatch' });
});
```

- [ ] **Step 2: Run the RED test.**

Run: `bun test tests/platform/browser-worker.test.ts tests/platform-evidence.test.ts`

Expected: FAIL because bundler and Worker helpers are absent.

- [ ] **Step 3: Implement archive-root bundling and artifact validation.**

Install the archive with `[node.argv[0], npmCli, 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', archive.path]`, recursively copy `tests/platform/portable/` to `consumer/portable/`, and copy `tests/platform/browser-entry.ts` to `consumer/browser-entry.ts`. `browser-entry.ts` imports bare `di-bag` and `./portable/contract.ts`. Invoke pinned esbuild from that consumer with `--bundle --platform=browser --format=iife --target=es2022 --minify --tree-shaking=true --legal-comments=none` and explicit temporary output/metafile paths. Resolve every metafile input: fixture inputs may be under `realpath(consumer) + sep`; every `node_modules` input must be beneath `realpath(consumer/node_modules/di-bag) + sep`; that package input set must contain exactly one `dist/index.js` root entry and may contain additional package-local `dist/*.js` dependencies. Retain the resolved `dist/index.js` as `resolvedDiBag`. Reject empty output, gzip failure, any `node:` input, `dist/node.js`, a second/missing root entry, or any package input outside the local tarball. Store no bundle in the repository.

- [ ] **Step 4: Implement Chromium Worker parent.**

Launch only the verified Playwright Chromium executable, create a classic Worker from the recorded minified bytes, accept exactly one structured message, and terminate it. The parent must verify bundle hash immediately before launch and validate the same portable result as the Deno lane; timeout, console output, extra messages and Worker errors fail the row.

- [ ] **Step 5: Run focused and cross-package gates.**

Run: `bun test tests/platform/browser-worker.test.ts tests/platform-evidence.test.ts && npm run build && bun test tests/native-package.test.ts`

Expected: browser lane passes with cached pinned Chromium; otherwise it produces `unavailable` with executable/version/hash reason. Existing archive coverage remains green.

### Task 4: Evidence command, documentation and final matrix

**Files:** Modify `package.json`, `README.md`, `docs/benchmarks/results/`; modify `docs/superpowers/plans/2026-09-06-enterprise-di-program.md` only after successful rows exist.

**Interfaces:** Produce `npm run evidence:platform` mapped to `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/platform-evidence.ts`; its exit is nonzero for archive or an available-lane failure, zero for pass/unavailable-only results, and JSONL rows carry `status` explicitly.

- [ ] **Step 1: Write failing command/result-index assertions.**

```ts
test('platform command writes sorted JSONL and calls unavailable tools unavailable', async () => {
  const rows = await runPlatformEvidence(fixtureRoot);
  expect(rows.map(row => row.status)).toEqual(['pass', 'unavailable', 'unavailable']);
  expect(JSON.stringify(rows[0])).toBe(stableJson(rows[0]));
});
```

- [ ] **Step 2: Run the RED test.**

Run: `bun test tests/platform-evidence.test.ts`

Expected: FAIL until the command/result writer exists.

- [ ] **Step 3: Implement command and result summary.**

Run archive first, retain a row for archive, Deno and browser, and write a Markdown table with lane/status/execution environment/artifact hashes. State “unavailable” for absent pinned tools and label old Node/Bun counts historical. Only after actual retained Deno/browser passes, revise README's environment section to name exact tested versions and root-only boundary.

- [ ] **Step 4: Run all required gates and inspect evidence.**

Run: `npm run evidence:platform && bun test tests/platform-evidence.test.ts tests/platform-deno.test.ts tests/platform/browser-worker.test.ts && npm run typecheck && npm run typecheck:native && npm run build && npm run build:native && bun test tests/package.test.ts tests/native-package.test.ts && npm test`

Expected: every provisioned lane has a passing exact row; unavailable tools have explicit rows; all focused/package/full tests pass. Do not run a network installation as a substitute.

- [ ] **Step 5: Review claim language and commit the coherent increment.**

Run: `git diff --check && git diff -- docs/superpowers/specs/2026-09-08-platform-compatibility-design.md README.md docs/benchmarks/results`

Expected: no whitespace errors; no claim says Deno/browser passed without a corresponding result path; no claim includes `di-bag/node` in portable support.
